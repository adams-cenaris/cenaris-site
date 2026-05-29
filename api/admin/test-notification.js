'use strict';

const { requireAdmin } = require('../_shared/auth');

module.exports = requireAdmin(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const topic = process.env.NTFY_TOPIC;
  if (!topic) {
    return res.status(400).json({ ok: false, error: 'NTFY_TOPIC not set in environment' });
  }

  try {
    const r = await fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      headers: {
        'Title': 'Test — Cenaris notifications working',
        'Priority': 'high',
        'Click': 'https://cenaris.com.au/admin/chat',
        'Content-Type': 'text/plain',
      },
      body: 'Push notifications are working correctly.',
    });
    if (!r.ok) {
      console.error('[test-notification] ntfy error', r.status);
      return res.status(500).json({ ok: false, error: `ntfy returned ${r.status}` });
    }
    console.log('[test-notification] ntfy sent topic=%s', topic);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[test-notification] error', err?.message);
    return res.status(500).json({ ok: false, error: err?.message });
  }
});
