'use strict';

function authHeaders() {
  return { 'Content-Type': 'application/json' };
}

async function apiFetch(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: { ...authHeaders(), ...(opts.headers || {}) } });
  if (r.status === 401) { location.href = '/admin/login'; }
  return r.json();
}

document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('/api/admin/auth', { method: 'DELETE' }).catch(() => {});
  location.href = '/admin/login';
});

// ── Mobile layout helpers ─────────────────────────────────
const isMobile = () => window.innerWidth <= 640;

function mobileShowList() {
  if (!isMobile()) return;
  document.querySelector('.sidebar').style.removeProperty('display');
  document.getElementById('chat-area').style.display = 'none';
}

function mobileShowChat() {
  if (!isMobile()) return;
  document.querySelector('.sidebar').style.display = 'none';
  document.getElementById('chat-area').style.removeProperty('display');
}

if (isMobile()) {
  document.getElementById('chat-area').style.display = 'none';
}

document.getElementById('mobile-back-btn').addEventListener('click', () => {
  clearInterval(pollTimer);
  activeConvId = null;
  lastMsgTime  = null;
  document.getElementById('chat-empty').style.display = '';
  document.getElementById('chat-conv').style.display  = 'none';
  mobileShowList();
  refreshConversations();
});

// ── State ─────────────────────────────────────────────────
let activeConvId = null;
let lastMsgTime  = null;
let pollTimer    = null;
let convPollTimer = null;
let isAvailable  = false;

// ── Availability ──────────────────────────────────────────
async function refreshAvailability() {
  const data = await fetch('/api/availability').then(r => r.json()).catch(() => null);
  if (!data) return;
  isAvailable = data.available;
  const dot   = document.getElementById('avail-dot');
  const label = document.getElementById('avail-label');
  const btn   = document.getElementById('avail-toggle');
  dot.className   = 'avail-dot ' + (isAvailable ? 'on' : 'off');
  label.textContent = isAvailable ? 'Online' : 'Offline';
  btn.textContent   = isAvailable ? 'Go offline' : 'Go online';
}
refreshAvailability();

document.getElementById('avail-toggle').addEventListener('click', async () => {
  const status = isAvailable ? 'unavailable' : 'available';
  await apiFetch('/api/admin/availability', {
    method: 'POST',
    body: JSON.stringify({ status, expiresMinutes: 480 }),
  });
  refreshAvailability();
});

// ── Conversations sidebar ─────────────────────────────────
function relativeTime(iso) {
  const diff = Date.now() - new Date(iso);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

let conversations = [];

async function refreshConversations() {
  const data = await apiFetch('/api/admin/conversations');
  conversations = data.conversations || [];

  const list = document.getElementById('sidebar-list');
  if (!conversations.length) {
    list.innerHTML = '<div class="empty-state">No active conversations</div>';
    return;
  }
  list.innerHTML = conversations.map(c => `
    <div class="conv-item ${c.id === activeConvId ? 'active' : ''}" data-id="${escAttr(c.id)}">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div class="conv-name">${escHtml(c.lead?.name || 'Visitor')}</div>
        <span class="conv-mode ${escAttr(c.mode)}">${escHtml(c.mode.toUpperCase())}</span>
      </div>
      <div class="conv-preview">${escHtml((c.lastMessage?.body || '—').slice(0, 60))}</div>
      <div class="conv-meta">
        <span class="conv-time">${relativeTime(c.createdAt)}</span>
        ${c.unread > 0 ? `<span class="conv-badge">${Number(c.unread)}</span>` : ''}
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.conv-item').forEach(el => {
    el.addEventListener('click', () => selectConversation(el.dataset.id));
  });
}

refreshConversations();
convPollTimer = setInterval(() => refreshConversations(), 5000);

// ── Select conversation ───────────────────────────────────
async function selectConversation(convId) {
  activeConvId = convId;
  lastMsgTime  = null;
  clearInterval(pollTimer);

  mobileShowChat();

  const conv = conversations.find(c => c.id === convId);
  document.getElementById('chat-empty').style.display = 'none';
  const convEl = document.getElementById('chat-conv');
  convEl.style.display = 'flex';

  document.getElementById('conv-name').textContent   = conv?.lead?.name || 'Visitor';
  document.getElementById('conv-detail').textContent =
    [conv?.lead?.email, conv?.lead?.phone, conv?.sourceUrl].filter(Boolean).join(' · ');

  document.getElementById('chat-messages').innerHTML = '';

  const data = await apiFetch(`/api/chat/message?conversationId=${convId}`);
  (data.messages || []).forEach(appendMessage);
  if (data.messages?.length) {
    lastMsgTime = data.messages[data.messages.length - 1].created_at;
  }

  refreshConversations();

  pollTimer = setInterval(pollMessages, 3000);
}

async function pollMessages() {
  if (!activeConvId) return;
  const url = `/api/chat/message?conversationId=${activeConvId}${lastMsgTime ? '&after=' + encodeURIComponent(lastMsgTime) : ''}`;
  const data = await apiFetch(url);
  let hasVisitorMsg = false;
  (data.messages || []).forEach(msg => {
    if (!document.querySelector(`[data-id="${msg.id}"]`)) {
      appendMessage(msg);
      if (msg.sender_type === 'visitor') hasVisitorMsg = true;
    }
  });
  if (hasVisitorMsg) playNotificationSound();
  if (data.messages?.length) {
    lastMsgTime = data.messages[data.messages.length - 1].created_at;
  }
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function escAttr(str) {
  return String(str).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function appendMessage(msg) {
  const div = document.createElement('div');
  div.className = 'msg ' + msg.sender_type;
  div.dataset.id = msg.id;
  div.innerHTML = `${escHtml(msg.body)}<div class="msg-meta">${escHtml(msg.sender_type)} · ${relativeTime(msg.created_at)}</div>`;
  document.getElementById('chat-messages').appendChild(div);
  const el = document.getElementById('chat-messages');
  el.scrollTop = el.scrollHeight;
}

// ── Send reply ────────────────────────────────────────────
async function sendReply() {
  const input = document.getElementById('chat-input');
  const body  = input.value.trim();
  if (!body || !activeConvId) return;

  const btn = document.getElementById('chat-send');
  btn.disabled = true;
  input.value  = '';

  const data = await apiFetch('/api/admin/reply', {
    method: 'POST',
    body: JSON.stringify({ conversationId: activeConvId, body }),
  });
  if (data.message && !document.querySelector(`[data-id="${data.message.id}"]`)) {
    appendMessage(data.message);
  }
  btn.disabled = false;
}

document.getElementById('chat-send').addEventListener('click', sendReply);
document.getElementById('chat-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); }
});
document.getElementById('chat-input').addEventListener('input', function () {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

// ── Close conversation ────────────────────────────────────
document.getElementById('close-conv-btn').addEventListener('click', async () => {
  if (!activeConvId || !confirm('Mark this conversation as closed?')) return;
  await apiFetch('/api/admin/reply', {
    method: 'POST',
    body: JSON.stringify({
      conversationId: activeConvId,
      body: 'This conversation has been closed by the team. Thank you for contacting Cenaris.',
    }),
  });
  await apiFetch('/api/admin/close', {
    method: 'POST',
    body: JSON.stringify({ conversationId: activeConvId }),
  });
  clearInterval(pollTimer);
  activeConvId = null;
  lastMsgTime  = null;
  document.getElementById('chat-empty').style.display = '';
  document.getElementById('chat-conv').style.display = 'none';
  mobileShowList();
  refreshConversations();
});

// Check URL param for pre-selected conversation
const urlParams = new URLSearchParams(location.search);
if (urlParams.get('c')) {
  selectConversation(urlParams.get('c'));
}

// ── In-page audio notification ────────────────────────────
let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _audioCtx;
}
document.addEventListener('click', () => getAudioCtx(), { once: true });

function playNotificationSound() {
  try {
    const ctx = getAudioCtx();
    const play = () => {
      [[880, 0], [1100, 0.14]].forEach(([freq, delay]) => {
        const gain = ctx.createGain();
        gain.connect(ctx.destination);
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.connect(gain);
        const t = ctx.currentTime + delay;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.3, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.start(t);
        osc.stop(t + 0.18);
      });
    };
    if (ctx.state === 'suspended') {
      ctx.resume().then(play);
    } else {
      play();
    }
  } catch (e) { console.warn('[audio]', e); }
}

// ── Page-title unread badge ───────────────────────────────
let prevUnreadTotal = 0;
const BASE_TITLE = document.title;

function updateTitleBadge(convList) {
  const total = convList.reduce((sum, c) => sum + (c.unread || 0), 0);
  document.title = total > 0 ? `(${total}) ${BASE_TITLE}` : BASE_TITLE;
  if (total > prevUnreadTotal) playNotificationSound();
  prevUnreadTotal = total;
}

// Patch refreshConversations to also update the title badge.
const _origRefresh = refreshConversations;
refreshConversations = async function () {
  await _origRefresh();
  updateTitleBadge(conversations);
};

// ── ntfy test button ──────────────────────────────────────
document.getElementById('notif-test-btn').addEventListener('click', async function () {
  this.textContent = 'Sending…';
  this.disabled = true;
  playNotificationSound();
  try {
    const r = await apiFetch('/api/admin/test-notification', { method: 'POST' });
    this.textContent = r?.ok === false ? 'Failed — check Vercel logs' : 'Sent ✓';
  } catch {
    this.textContent = 'Failed';
  }
  setTimeout(() => { this.textContent = 'Test notify'; this.disabled = false; }, 3000);
});
