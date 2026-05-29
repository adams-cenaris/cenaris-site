'use strict';

const { createClient } = require('@supabase/supabase-js');
const { requireAdmin } = require('../_shared/auth');

async function sendOneSignal(appId, apiKey, targeting) {
  const r = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${apiKey}` },
    body: JSON.stringify({
      app_id: appId,
      headings: { en: 'Test — Cenaris notifications working' },
      contents: { en: 'Push notifications are set up correctly on this device.' },
      url: 'https://cenaris.com.au/admin/chat',
      ...targeting,
    }),
  });
  const json = await r.json().catch(() => ({}));
  console.log('[test-notification] targeting=%s status=%d body=%s',
    JSON.stringify(targeting), r.status, JSON.stringify(json));
  return { ok: r.ok, json };
}

module.exports = requireAdmin(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const appId  = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !apiKey) {
    return res.status(400).json({ ok: false, error: 'ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY not set' });
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

  console.log('[test-notification] stored ids:', ids);

  if (ids.length === 0) {
    // No stored IDs — try segment as diagnostic fallback
    try {
      const { ok, json } = await sendOneSignal(appId, apiKey, { included_segments: ['All'] });
      return res.json({ ok, recipients: json.recipients ?? 0, errors: json.errors, reason: 'no_stored_ids_used_segment' });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err?.message });
    }
  }

  try {
    // Try subscription_ids first (SDK v16 naming)
    let { ok, json } = await sendOneSignal(appId, apiKey, { include_subscription_ids: ids });

    // If 0 recipients, retry with player_ids (v1 API legacy naming)
    if (ok && (json.recipients ?? 0) === 0) {
      console.log('[test-notification] 0 recipients with subscription_ids, retrying with player_ids');
      ({ ok, json } = await sendOneSignal(appId, apiKey, { include_player_ids: ids }));
    }

    if (!ok) {
      return res.status(500).json({ ok: false, httpStatus: json.status, errors: json.errors, error: json });
    }
    return res.json({ ok: true, recipients: json.recipients ?? 0, id: json.id, errors: json.errors });
  } catch (err) {
    console.error('[test-notification] fetch error', err?.message);
    return res.status(500).json({ ok: false, error: err?.message });
  }
});
