(function () {
  'use strict';

  // Skip on admin pages
  if (window.location.pathname.startsWith('/admin')) return;

  const API = '';  // same-origin — no prefix needed
  const POLL_MS = 3000;

  let state = {
    open: false,
    conversationId: null,
    sessionId: null,
    mode: null,       // 'live' | 'ai'
    lastMsgTime: null,
    pollTimer: null,
    leadCaptured: false,
    unread: 0,
  };

  // ── Inject CSS ────────────────────────────────────────────────
  function injectCSS() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/assets/chat-widget.css';
    document.head.appendChild(link);
  }

  // ── Build DOM ─────────────────────────────────────────────────
  function buildWidget() {
    const root = document.createElement('div');
    root.innerHTML = `
      <button class="cw-btn" id="cw-btn" aria-label="Open chat" aria-expanded="false">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </button>
      <div class="cw-panel" id="cw-panel" role="dialog" aria-label="Chat with Cenaris" aria-modal="true">
        <div class="cw-header">
          <div class="cw-header-logo" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><circle cx="12" cy="12" r="10"/></svg>
          </div>
          <div class="cw-header-info">
            <strong>Cenaris</strong>
            <span class="cw-mode-badge" id="cw-mode-badge">Connecting…</span>
          </div>
          <button class="cw-close" id="cw-close" aria-label="Close chat">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="cw-messages" id="cw-messages" aria-live="polite">
          <div class="cw-typing" id="cw-typing">
            <span></span><span></span><span></span>
          </div>
        </div>
        <div class="cw-lead-form" id="cw-lead-form">
          <p>To have our team follow up, please share your details. We'll only use them to respond to your enquiry.</p>
          <div class="cw-form-error" id="cw-form-error"></div>
          <input type="text"  id="cw-lead-name"  placeholder="Your name *"          autocomplete="name"  />
          <input type="email" id="cw-lead-email" placeholder="Email address *"       autocomplete="email" />
          <input type="tel"   id="cw-lead-phone" placeholder="Phone number (optional)" autocomplete="tel" />
          <label>
            <input type="checkbox" id="cw-lead-marketing" />
            I'd like to receive updates and offers from Cenaris. I can unsubscribe at any time.
          </label>
          <button class="cw-lead-form-submit" id="cw-lead-submit">Send to our team</button>
          <p class="cw-privacy-note">
            By submitting you agree to our <a href="/privacy-policy-tcs" target="_blank">Privacy Policy</a>.
          </p>
        </div>
        <div class="cw-escalate" id="cw-escalate" style="display:none">
          <button id="cw-escalate-btn">Talk to our team instead</button>
        </div>
        <div class="cw-input-area">
          <textarea class="cw-input" id="cw-input" placeholder="Type a message…" rows="1" aria-label="Chat message"></textarea>
          <button class="cw-send" id="cw-send" aria-label="Send message" disabled>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(root);
  }

  // ── UI helpers ────────────────────────────────────────────────
  const $ = id => document.getElementById(id);

  function setMode(mode) {
    const badge = $('cw-mode-badge');
    if (mode === 'live') {
      badge.textContent = 'Live support';
      badge.className = 'cw-mode-badge live';
    } else {
      badge.textContent = 'AI assistant';
      badge.className = 'cw-mode-badge ai';
    }
    if (mode === 'ai') {
      $('cw-escalate').style.display = 'block';
    }
  }

  function renderMessage(msg) {
    const div = document.createElement('div');
    div.className = `cw-msg ${msg.sender_type}`;
    div.textContent = msg.body;
    div.dataset.id = msg.id;
    $('cw-messages').insertBefore(div, $('cw-typing'));
    scrollBottom();
  }

  function scrollBottom() {
    const el = $('cw-messages');
    el.scrollTop = el.scrollHeight;
  }

  function showTyping(on) {
    $('cw-typing').className = on ? 'cw-typing visible' : 'cw-typing';
  }

  function updateBadge() {
    let badge = $('cw-btn').querySelector('.cw-btn-badge');
    if (state.unread > 0 && !state.open) {
      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'cw-btn-badge';
        $('cw-btn').appendChild(badge);
      }
      badge.textContent = state.unread > 9 ? '9+' : state.unread;
    } else if (badge) {
      badge.remove();
    }
  }

  // ── API calls ─────────────────────────────────────────────────
  async function post(path, body) {
    const r = await fetch(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return r.json();
  }

  async function get(path) {
    const r = await fetch(API + path);
    return r.json();
  }

  async function startSession() {
    showTyping(true);
    const data = await post('/api/chat/session', { sourceUrl: window.location.href });
    if (!data.conversationId) { showTyping(false); return; }

    state.conversationId = data.conversationId;
    state.sessionId = data.sessionId;
    state.mode = data.mode;
    setMode(data.mode);

    // Load initial greeting from server
    const msgs = await get(`/api/chat/message?conversationId=${data.conversationId}&sessionId=${data.sessionId}`);
    showTyping(false);
    if (msgs.messages) {
      msgs.messages.forEach(renderMessage);
      if (msgs.messages.length > 0) {
        state.lastMsgTime = msgs.messages[msgs.messages.length - 1].created_at;
      }
    }

    $('cw-send').disabled = false;
    startPolling();
  }

  async function sendMessage() {
    const input = $('cw-input');
    const text = input.value.trim();
    if (!text || !state.conversationId) return;

    input.value = '';
    input.style.height = '';
    $('cw-send').disabled = true;

    // Optimistic UI
    const tempId = 'tmp-' + Date.now();
    const tempDiv = document.createElement('div');
    tempDiv.className = 'cw-msg visitor';
    tempDiv.textContent = text;
    tempDiv.dataset.id = tempId;
    $('cw-messages').insertBefore(tempDiv, $('cw-typing'));
    scrollBottom();

    if (state.mode === 'ai') showTyping(true);

    try {
      const data = await post('/api/chat/message', { conversationId: state.conversationId, sessionId: state.sessionId, body: text });
      showTyping(false);
      $('cw-send').disabled = false;

      // Replace temp message with server-confirmed ones
      const existing = document.querySelector(`[data-id="${tempId}"]`);
      if (existing) existing.remove();

      if (data.messages) {
        data.messages.forEach(msg => {
          if (!document.querySelector(`[data-id="${msg.id}"]`)) renderMessage(msg);
        });
        if (data.messages.length > 0) {
          state.lastMsgTime = data.messages[data.messages.length - 1].created_at;
        }
      }
    } catch (_err) {
      showTyping(false);
      $('cw-send').disabled = false;
      const existing = document.querySelector(`[data-id="${tempId}"]`);
      if (existing) existing.remove();
      const errDiv = document.createElement('div');
      errDiv.className = 'cw-msg system';
      errDiv.textContent = 'Message failed to send. Please try again.';
      $('cw-messages').insertBefore(errDiv, $('cw-typing'));
      scrollBottom();
    }
  }

  async function pollMessages() {
    if (!state.conversationId) return;
    const url = `/api/chat/message?conversationId=${state.conversationId}&sessionId=${state.sessionId}${state.lastMsgTime ? '&after=' + encodeURIComponent(state.lastMsgTime) : ''}`;
    const data = await get(url).catch(() => null);
    if (!data?.messages) return;

    let gotNew = false;
    data.messages.forEach(msg => {
      if (!document.querySelector(`[data-id="${msg.id}"]`)) {
        renderMessage(msg);
        gotNew = true;
        if (!state.open && msg.sender_type !== 'visitor') {
          state.unread++;
          updateBadge();
        }
      }
    });
    if (gotNew && data.messages.length > 0) {
      state.lastMsgTime = data.messages[data.messages.length - 1].created_at;
    }
  }

  function startPolling() {
    clearInterval(state.pollTimer);
    state.pollTimer = setInterval(pollMessages, POLL_MS);
  }

  async function submitLead() {
    const btn = $('cw-lead-submit');
    const errEl = $('cw-form-error');
    const name  = $('cw-lead-name').value.trim();
    const email = $('cw-lead-email').value.trim();
    const phone = $('cw-lead-phone').value.trim();
    const marketing = $('cw-lead-marketing').checked;

    errEl.className = 'cw-form-error';
    errEl.textContent = '';

    if (!name || !email) {
      errEl.textContent = 'Please enter your name and email.';
      errEl.className = 'cw-form-error visible';
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errEl.textContent = 'Please enter a valid email address.';
      errEl.className = 'cw-form-error visible';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Sending…';

    let data;
    try {
      data = await post('/api/chat/lead', {
        conversationId: state.conversationId,
        sessionId: state.sessionId,
        name, email, phone,
        enquiryType: 'general',
        marketingOptIn: marketing,
      });
    } catch (_err) {
      btn.disabled = false;
      btn.textContent = 'Send to our team';
      errEl.textContent = 'Something went wrong. Please try again.';
      errEl.className = 'cw-form-error visible';
      return;
    }

    if (data.ok) {
      state.leadCaptured = true;
      $('cw-lead-form').className = 'cw-lead-form';
      $('cw-escalate').style.display = 'none';
    } else {
      btn.disabled = false;
      btn.textContent = 'Send to our team';
      errEl.textContent = data.error || 'Something went wrong. Please try again.';
      errEl.className = 'cw-form-error visible';
    }
  }

  // ── Open / close ──────────────────────────────────────────────
  function openWidget() {
    state.open = true;
    $('cw-panel').classList.add('open');
    $('cw-btn').setAttribute('aria-expanded', 'true');
    state.unread = 0;
    updateBadge();
    scrollBottom();
    $('cw-input').focus();

    if (!state.conversationId) startSession();
  }

  function closeWidget() {
    state.open = false;
    $('cw-panel').classList.remove('open');
    $('cw-btn').setAttribute('aria-expanded', 'false');
  }

  // ── Wire up events ────────────────────────────────────────────
  function bindEvents() {
    $('cw-btn').addEventListener('click', () => state.open ? closeWidget() : openWidget());
    $('cw-close').addEventListener('click', closeWidget);

    const input = $('cw-input');
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 100) + 'px';
      $('cw-send').disabled = !input.value.trim() || !state.conversationId;
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    $('cw-send').addEventListener('click', sendMessage);

    $('cw-lead-submit').addEventListener('click', submitLead);

    $('cw-escalate-btn').addEventListener('click', () => {
      $('cw-lead-form').className = 'cw-lead-form visible';
      $('cw-escalate').style.display = 'none';
      scrollBottom();
    });

    // Close on outside click
    document.addEventListener('click', e => {
      if (state.open && !$('cw-panel').contains(e.target) && e.target !== $('cw-btn') && !$('cw-btn').contains(e.target)) {
        closeWidget();
      }
    });

    // Escape key
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && state.open) closeWidget();
    });
  }

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    injectCSS();
    buildWidget();
    bindEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
