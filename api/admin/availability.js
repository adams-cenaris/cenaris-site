const { getClient } = require('../_shared/supabase');
const { requireAdmin } = require('../_shared/auth');

// POST /api/admin/availability
// Body: { status: 'available'|'unavailable', expiresMinutes?: number }
// Returns: { ok: true, expiresAt }
module.exports = requireAdmin(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { status, expiresMinutes = 480 } = req.body || {};
  if (!['available', 'unavailable'].includes(status)) {
    return res.status(400).json({ error: "status must be 'available' or 'unavailable'" });
  }

  const supabase = getClient();
  const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000).toISOString();

  const { error } = await supabase.from('availability_overrides').insert({ status, expires_at: expiresAt });
  if (error) return res.status(500).json({ error: 'Failed to set availability' });

  res.status(200).json({ ok: true, status, expiresAt });
});
