const { createClient } = require('@supabase/supabase-js');
const { verifyAdmin } = require('../_shared/auth');

function getClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
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
