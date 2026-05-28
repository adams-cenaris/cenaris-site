const { createClient } = require('@supabase/supabase-js');
const { verifyAdmin } = require('../_shared/auth');

function getClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
}

module.exports = async function handler(req, res) {
  if (!verifyAdmin(req)) return res.status(401).json({ error: 'Unauthorised' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { status, expiresMinutes = 480 } = req.body || {};
  if (!['available', 'unavailable'].includes(status)) return res.status(400).json({ error: "status must be 'available' or 'unavailable'" });

  const mins = Number(expiresMinutes);
  if (!Number.isFinite(mins) || mins < 1 || mins > 1440) {
    return res.status(400).json({ error: 'expiresMinutes must be between 1 and 1440' });
  }

  const supabase = getClient();
  const expiresAt = new Date(Date.now() + mins * 60 * 1000).toISOString();
  const { error } = await supabase.from('availability_overrides').insert({ status, expires_at: expiresAt });
  if (error) return res.status(500).json({ error: 'Failed to set availability' });

  res.status(200).json({ ok: true, status, expiresAt });
};
