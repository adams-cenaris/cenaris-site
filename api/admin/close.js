const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

function getClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
}

function verifyAdmin(req) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload.role === 'admin' ? payload : null;
  } catch { return null; }
}

module.exports = async function handler(req, res) {
  if (!verifyAdmin(req)) return res.status(401).json({ error: 'Unauthorised' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { conversationId } = req.body || {};
  if (!conversationId) return res.status(400).json({ error: 'conversationId required' });

  const supabase = getClient();
  const { error } = await supabase
    .from('conversations')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', conversationId);

  if (error) return res.status(500).json({ error: 'Failed to close conversation' });

  res.status(200).json({ ok: true });
};
