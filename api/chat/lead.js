const { getClient } = require('../_shared/supabase');
const crypto = require('crypto');

const CONSENT_TEXT_VERSION = 'v1-2026-05';
const PRIVACY_NOTICE = 'We will use your name, email, and phone to respond to your enquiry. We will not use them for marketing unless you opt in. See our Privacy Policy at cenaris.com.au/privacy-policy-tcs';

// POST /api/chat/lead
// Body: { conversationId, name, email, phone, enquiryType, marketingOptIn }
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { conversationId, name, email, phone, enquiryType, marketingOptIn } = req.body || {};

  if (!name?.trim() || !email?.trim()) {
    return res.status(400).json({ error: 'name and email are required' });
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const supabase = getClient();

  // Insert lead
  const { data: lead, error: leadErr } = await supabase
    .from('leads')
    .insert({
      conversation_id: conversationId || null,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || null,
      enquiry_type: enquiryType || 'general',
      privacy_accepted_at: new Date().toISOString(),
      marketing_opt_in: !!marketingOptIn,
    })
    .select('id')
    .single();

  if (leadErr) {
    console.error('lead insert error', leadErr);
    return res.status(500).json({ error: 'Failed to save lead' });
  }

  // Hash IP for consent audit (no raw IP stored)
  const rawIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
  const ipHash = crypto.createHash('sha256').update(rawIp).digest('hex');

  // Record consent events
  await supabase.from('consent_events').insert([
    {
      lead_id: lead.id,
      consent_type: 'privacy_notice',
      consent_value: true,
      consent_text_version: CONSENT_TEXT_VERSION,
      ip_hash: ipHash,
    },
    {
      lead_id: lead.id,
      consent_type: 'marketing',
      consent_value: !!marketingOptIn,
      consent_text_version: CONSENT_TEXT_VERSION,
      ip_hash: ipHash,
    },
  ]);

  // Add system message to conversation if linked
  if (conversationId) {
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_type: 'system',
      body: `Contact details captured: ${name.trim()} (${email.trim()})${phone ? `, ${phone.trim()}` : ''}. Our team will follow up soon.`,
    });
  }

  // Email notification to staff via Resend
  try {
    const { data: firstMsg } = await supabase
      .from('messages')
      .select('body')
      .eq('conversation_id', conversationId)
      .eq('sender_type', 'visitor')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Cenaris Chat <noreply@cenaris.com.au>',
        to: ['info@cenaris.com.au'],
        subject: `New chat enquiry — ${name.trim()}`,
        html: `
          <h2>New chat enquiry</h2>
          <table cellpadding="6" style="border-collapse:collapse">
            <tr><td><strong>Name</strong></td><td>${name.trim()}</td></tr>
            <tr><td><strong>Email</strong></td><td>${email.trim()}</td></tr>
            ${phone ? `<tr><td><strong>Phone</strong></td><td>${phone.trim()}</td></tr>` : ''}
            <tr><td><strong>Enquiry type</strong></td><td>${enquiryType || 'General'}</td></tr>
            ${firstMsg ? `<tr><td><strong>First message</strong></td><td>${firstMsg.body}</td></tr>` : ''}
            <tr><td><strong>Marketing opt-in</strong></td><td>${marketingOptIn ? 'Yes' : 'No'}</td></tr>
          </table>
          ${conversationId ? `<p><a href="https://cenaris.com.au/admin/chat?c=${conversationId}">View conversation in admin console</a></p>` : ''}
          <p style="color:#888;font-size:12px">${PRIVACY_NOTICE}</p>
        `,
      }),
    });
  } catch (emailErr) {
    // Non-fatal — lead is saved regardless
    console.error('email notification error', emailErr);
  }

  res.status(200).json({ ok: true, leadId: lead.id });
};
