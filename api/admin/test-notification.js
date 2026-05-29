'use strict';

const { createClient } = require('@supabase/supabase-js');
const { requireAdmin } = require('../_shared/auth');

module.exports = requireAdmin(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const appId  = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !apiKey) {
    return res.status(400).json({ ok: false, error: 'ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY not set in environment' });
  }

  // Load stored subscription IDs from Supabase
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  let ids = [];
  try {
    const { data } = await supabase.from('admin_push_subscriptions').select('subscription_id');
    ids = (data || []).map(r => r.subscription_id);
  } catch (err) {
    console.error('[test-notification] supabase error', err?.message);
  }

  if (ids.length === 0) {
    return res.json({ ok: false, recipients: 0, reason: 'no_subscriptions' });
  }

  try {
    const r = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${apiKey}` },
      body: JSON.stringify({
        app_id: appId,
        include_subscription_ids: ids,
        headings: { en: 'Test — Cenaris notifications working' },
        contents: { en: 'Push notifications are set up correctly on this device.' },
        url: 'https://cenaris.com.au/admin/chat',
      }),
    });
    const json = await r.json().catch(() => ({}));
    console.log('[test-notification] status=%d body=%s', r.status, JSON.stringify(json));
    if (!r.ok) {
      return res.status(500).json({ ok: false, httpStatus: r.status, error: json });
    }
    return res.json({ ok: true, recipients: json.recipients ?? 0, id: json.id });
  } catch (err) {
    console.error('[test-notification] fetch error', err?.message);
    return res.status(500).json({ ok: false, error: err?.message });
  }
});
