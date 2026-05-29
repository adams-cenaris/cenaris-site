'use strict';

// Cooldown windows per conversation per channel.
// Prevents the admin being spammed when a visitor sends several messages.
const PUSH_COOLDOWN_MS  =  5 * 60 * 1000;  // 5 minutes
const EMAIL_COOLDOWN_MS = 15 * 60 * 1000;  // 15 minutes

// Privacy-safe push titles — no visitor message content on the lock screen.
const NOTIFICATION_TITLES = {
  new_chat:        'New Cenaris website chat',
  new_message:     'New message from visitor',
  lead_captured:   'New lead captured from website',
  human_review:    'Chat requires human review',
  demo_request:    'New demo request from website',
  pricing_request: 'New pricing enquiry from website',
  enterprise:      'New enterprise enquiry from website',
  support_request: 'New support request received',
};

// These types also get an email notification.
// 'lead_captured' is excluded because lead.js already sends a detailed email.
// 'new_message' is excluded because it would be too noisy.
const EMAIL_TYPES = new Set([
  'new_chat',
  'human_review',
  'demo_request',
  'pricing_request',
  'enterprise',
  'support_request',
]);

// Keyword patterns that indicate a high-value or escalation-worthy message.
const KEYWORD_TRIGGERS = [
  { re: /\b(?:book|request|schedule|get)\s+(?:a\s+)?demo\b|\bdemo\b/i, type: 'demo_request' },
  { re: /\bpric(?:e|ing)\b|\bhow\s+much\b|\bcost\b|\bquote\b|\bproposal\b/i,  type: 'pricing_request' },
  { re: /\benterprise\b|\bpartner(?:ship)?\b|\breseller\b/i,                    type: 'enterprise' },
  { re: /\bsupport\b|\burgent\b|\bnot\s+working\b|\bbroken\b|\berror\b/i,      type: 'support_request' },
];

/**
 * Returns the escalation type if the visitor message matches a keyword trigger,
 * otherwise returns null.
 * @param {string} body
 * @returns {string|null}
 */
function detectKeywordType(body) {
  for (const { re, type } of KEYWORD_TRIGGERS) {
    if (re.test(body)) return type;
  }
  return null;
}

/**
 * Returns true if a notification of this type + channel was sent for this
 * conversation within the cooldown window.
 */
async function isOnCooldown(supabase, conversationId, type, channel, ms) {
  if (!conversationId) return false;
  try {
    const since = new Date(Date.now() - ms).toISOString();
    const { data } = await supabase
      .from('notification_log')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('notification_type', type)
      .eq('channel', channel)
      .gt('sent_at', since)
      .limit(1)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

async function logNotification(supabase, conversationId, type, channel) {
  try {
    await supabase.from('notification_log').insert({
      conversation_id: conversationId || null,
      notification_type: type,
      channel,
    });
  } catch (err) {
    console.error('[notify] log error', err?.message);
  }
}

/**
 * Send a push notification via ntfy.sh.
 * Returns 'sent', 'failed', or 'not_configured'.
 */
async function sendPush(title) {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) {
    console.log('[notify] push skipped — NTFY_TOPIC not set');
    return 'not_configured';
  }
  try {
    const res = await fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      headers: {
        'Title': title.replace(/[^\x00-\x7F]/g, '-'),
        'Priority': 'high',
        'Click': 'https://cenaris.com.au/admin/chat',
        'Icon': 'https://cenaris.com.au/assets/favicon-icon.png',
        'Content-Type': 'text/plain',
      },
      body: 'Tap to open the Cenaris admin console.',
    });
    if (!res.ok) {
      console.error('[notify] ntfy error status=%d', res.status);
      return 'failed';
    }
    console.log('[notify] ntfy sent topic=%s title=%s', topic, title);
    return 'sent';
  } catch (err) {
    console.error('[notify] ntfy error', err?.message);
    return 'failed';
  }
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Send an email notification via Resend.
 * Returns 'sent', 'failed', or 'not_configured'.
 */
async function sendEmail({ type, chatId, leadName, leadEmail, leadPhone }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('[notify] email skipped — RESEND_API_KEY not set');
    return 'not_configured';
  }

  const to   = process.env.ADMIN_NOTIFICATION_EMAIL || 'info@cenaris.com.au';
  const from = process.env.EMAIL_FROM || 'Cenaris Chat <noreply@cenaris.com.au>';

  const subjectMap = {
    new_chat:        'New live chat started — Cenaris',
    human_review:    'Chat requires human review — Cenaris',
    demo_request:    'New demo request via Cenaris website',
    pricing_request: 'New pricing enquiry via Cenaris website',
    enterprise:      'New enterprise enquiry via Cenaris website',
    support_request: 'New support request via Cenaris website',
  };
  const subject = subjectMap[type] || 'New activity on Cenaris website chat';

  const link = chatId
    ? `<a href="https://cenaris.com.au/admin/chat?c=${encodeURIComponent(chatId)}">View conversation in admin console →</a>`
    : `<a href="https://cenaris.com.au/admin/chat">Open admin console →</a>`;

  const rows = [
    leadName  && `<tr><td><strong>Name</strong></td><td>${escHtml(leadName)}</td></tr>`,
    leadEmail && `<tr><td><strong>Email</strong></td><td>${escHtml(leadEmail)}</td></tr>`,
    leadPhone && `<tr><td><strong>Phone</strong></td><td>${escHtml(leadPhone)}</td></tr>`,
  ].filter(Boolean).join('');

  const html = [
    `<h2>${escHtml(subject)}</h2>`,
    rows ? `<table cellpadding="6">${rows}</table>` : '',
    `<p>${link}</p>`,
    `<p style="color:#888;font-size:12px">Cenaris automated notification — do not reply to this email.</p>`,
  ].join('');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[notify] email error', JSON.stringify(err));
      return 'failed';
    }
    console.log('[notify] email sent type=%s to=%s', type, to);
    return 'sent';
  } catch (err) {
    console.error('[notify] email error', err?.message);
    return 'failed';
  }
}

/**
 * Notify the admin of a chat event via push (OneSignal) and/or email (Resend).
 *
 * Deduplicates per conversation + type + channel within the cooldown window,
 * so a busy visitor does not spam the admin with repeated alerts.
 *
 * @param {{
 *   type: 'new_chat'|'new_message'|'lead_captured'|'human_review'|'demo_request'|'pricing_request'|'enterprise'|'support_request',
 *   chatId?: string,
 *   leadName?: string,
 *   leadEmail?: string,
 *   leadPhone?: string,
 * }} params
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function notifyAdmin(params, supabase) {
  const { type, chatId, leadName, leadEmail, leadPhone } = params;
  const title = NOTIFICATION_TITLES[type] || 'New activity on Cenaris website';

  // Check cooldowns in parallel to minimise latency
  const [pushCooldown, emailCooldown] = await Promise.all([
    isOnCooldown(supabase, chatId, type, 'push',  PUSH_COOLDOWN_MS),
    isOnCooldown(supabase, chatId, type, 'email', EMAIL_COOLDOWN_MS),
  ]);

  const ops = [];

  if (!pushCooldown) {
    ops.push(
      sendPush(title).then(result => {
        // Only log on success so a transient OneSignal failure doesn't activate
        // the cooldown and suppress future alerts for this conversation.
        if (result === 'sent') {
          return logNotification(supabase, chatId, type, 'push');
        }
      })
    );
  }

  if (EMAIL_TYPES.has(type) && !emailCooldown) {
    ops.push(
      sendEmail({ type, chatId, leadName, leadEmail, leadPhone }).then(result => {
        if (result === 'sent') {
          return logNotification(supabase, chatId, type, 'email');
        }
      })
    );
  }

  await Promise.allSettled(ops);
}

module.exports = { notifyAdmin, detectKeywordType };
