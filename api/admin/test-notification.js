'use strict';

const { requireAdmin } = require('../_shared/auth');

module.exports = requireAdmin(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const appId  = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !apiKey) {
    return res.status(400).json({ ok: false, error: 'ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY not set in environment' });
  }

  try {
    const r = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${apiKey}` },
      body: JSON.stringify({
        app_id: appId,
        included_segments: ['Subscribed Users'],
        headings: { en: 'Test — Cenaris notifications working' },
        contents: { en: 'Push notifications are set up correctly on this device.' },
        url: 'https://cenaris.com.au/admin/chat',
      }),
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error('[test-notification] OneSignal error', JSON.stringify(json));
      return res.status(500).json({ ok: false, error: json });
    }
    console.log('[test-notification] sent id=%s recipients=%d', json.id, json.recipients);
    return res.json({ ok: true, recipients: json.recipients ?? 0, id: json.id });
  } catch (err) {
    console.error('[test-notification] fetch error', err?.message);
    return res.status(500).json({ ok: false, error: err?.message });
  }
});
