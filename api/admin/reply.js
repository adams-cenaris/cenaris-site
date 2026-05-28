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

  const { conversationId, body } = req.body || {};
  if (!conversationId || !body?.trim()) return res.status(400).json({ error: 'conversationId and body required' });

  const supabase = getClient();
  const { data: conv, error: convErr } = await supabase.from('conversations').select('id, status').eq('id', conversationId).maybeSingle();
  if (convErr || !conv) return res.status(404).json({ error: 'Conversation not found' });
  if (conv.status === 'closed') return res.status(400).json({ error: 'Conversation is closed' });

  const { data: message, error } = await supabase.from('messages').insert({ conversation_id: conversationId, sender_type: 'agent', body: body.trim() }).select().single();
  if (error) return res.status(500).json({ error: 'Failed to send reply' });

  res.status(200).json({ message });
};
