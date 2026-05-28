const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

function getClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
}

function verifyAdmin(req) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  if (!process.env.JWT_SECRET) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload.role === 'admin' ? payload : null;
  } catch { return null; }
}

module.exports = async function handler(req, res) {
  if (!verifyAdmin(req)) return res.status(401).json({ error: 'Unauthorised' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = getClient();
  const { data: conversations, error } = await supabase.from('conversations').select(`id, mode, status, source_url, created_at, leads ( name, email, phone ), messages ( sender_type, body, created_at )`).neq('status', 'closed').order('created_at', { ascending: false }).limit(50);

  if (error) return res.status(500).json({ error: 'Failed to fetch conversations' });

  const enriched = (conversations || []).map(c => {
    const msgs = (c.messages || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const lastReply = msgs.find(m => m.sender_type !== 'visitor');
    const unread = lastReply
      ? msgs.filter(m => m.sender_type === 'visitor' && new Date(m.created_at) > new Date(lastReply.created_at)).length
      : msgs.filter(m => m.sender_type === 'visitor').length;
    return { id: c.id, mode: c.mode, status: c.status, sourceUrl: c.source_url, createdAt: c.created_at, lead: c.leads?.[0] || null, lastMessage: msgs[0] || null, unread };
  });

  res.status(200).json({ conversations: enriched });
};
