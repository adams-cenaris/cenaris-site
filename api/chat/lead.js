const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const { notifyAdmin } = require('../_shared/notify');
const { handleCors } = require('../_shared/cors');
const { checkRateLimit } = require('../_shared/ratelimit');

function getClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
}

const CONSENT_TEXT_VERSION = 'v1-2026-05';
const PRIVACY_NOTICE = 'We will use your name, email, and phone to respond to your enquiry. We will not use them for marketing unless you opt in. See our Privacy Policy at cenaris.com.au/privacy-policy-tcs';

function escHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escAttr(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 5 lead submissions per IP per 5 minutes
  if (await checkRateLimit(req, res, 'chat:lead', 5, 300)) return;

  const { conversationId, name, email, phone, enquiryType, marketingOptIn, sessionId } = req.body || {};
  if (!name?.trim() || !email?.trim()) return res.status(400).json({ error: 'name and email are required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email address' });

  const supabase = getClient();

  if (conversationId) {
    const { data: convCheck } = await supabase.from('conversations').select('session_id').eq('id', conversationId).maybeSingle();
    if (!convCheck || convCheck.session_id !== sessionId) return res.status(403).json({ error: 'Forbidden' });
  }

  const { data: lead, error: leadErr } = await supabase.from('leads').insert({
    conversation_id: conversationId || null,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone?.trim() || null,
    enquiry_type: enquiryType || 'general',
    privacy_accepted_at: new Date().toISOString(),
    marketing_opt_in: !!marketingOptIn,
  }).select('id').single();

  if (leadErr) return res.status(500).json({ error: 'Failed to save lead' });

  const rawIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '';
  const ipHash = crypto.createHash('sha256').update(rawIp).digest('hex');

  await supabase.from('consent_events').insert([
    { lead_id: lead.id, consent_type: 'privacy_notice', consent_value: true, consent_text_version: CONSENT_TEXT_VERSION, ip_hash: ipHash },
    { lead_id: lead.id, consent_type: 'marketing', consent_value: !!marketingOptIn, consent_text_version: CONSENT_TEXT_VERSION, ip_hash: ipHash },
  ]);

  if (conversationId) {
    await supabase.from('messages').insert({ conversation_id: conversationId, sender_type: 'system', body: `Contact details captured: ${name.trim()} (${email.trim()})${phone ? `, ${phone.trim()}` : ''}. Our team will follow up soon.` });
  }

  // Push notification — email is already sent below via Resend; push goes to
  // any admin device that has enabled notifications from admin/chat.html.
  notifyAdmin({
    type: 'lead_captured',
    chatId: conversationId || null,
    leadName: name.trim(),
    leadEmail: email.trim(),
    leadPhone: phone?.trim() || null,
  }, supabase).catch(err => console.error('[lead] notify error', err?.message));

  try {
    const { data: firstMsg } = await supabase.from('messages').select('body').eq('conversation_id', conversationId).eq('sender_type', 'visitor').order('created_at', { ascending: true }).limit(1).maybeSingle();
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'Cenaris Chat <noreply@cenaris.com.au>',
        to: [process.env.ADMIN_NOTIFICATION_EMAIL || 'info@cenaris.com.au'],
        subject: `New chat enquiry — ${name.trim()}`,
        html: `<h2>New chat enquiry</h2><table cellpadding="6"><tr><td><strong>Name</strong></td><td>${escHtml(name.trim())}</td></tr><tr><td><strong>Email</strong></td><td>${escHtml(email.trim())}</td></tr>${phone ? `<tr><td><strong>Phone</strong></td><td>${escHtml(phone.trim())}</td></tr>` : ''}<tr><td><strong>Enquiry type</strong></td><td>${escHtml(enquiryType || 'General')}</td></tr>${firstMsg ? `<tr><td><strong>First message</strong></td><td>${escHtml(firstMsg.body)}</td></tr>` : ''}<tr><td><strong>Marketing opt-in</strong></td><td>${marketingOptIn ? 'Yes' : 'No'}</td></tr></table>${conversationId ? `<p><a href="https://cenaris.com.au/admin/chat?c=${escAttr(conversationId)}">View in admin console</a></p>` : ''}<p style="color:#888;font-size:12px">${escHtml(PRIVACY_NOTICE)}</p>`,
      }),
    });
  } catch (emailErr) {
    console.error('email notification error', emailErr);
  }

  res.status(200).json({ ok: true });
};
