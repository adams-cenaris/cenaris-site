const { getClient } = require('../_shared/supabase');
const { requireAdmin } = require('../_shared/auth');

// GET /api/admin/conversations
// Returns: { conversations: [...] } — open conversations with last message preview
module.exports = requireAdmin(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = getClient();

  const { data: conversations, error } = await supabase
    .from('conversations')
    .select(`
      id, mode, status, source_url, created_at,
      leads ( name, email, phone ),
      messages ( sender_type, body, created_at )
    `)
    .neq('status', 'closed')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return res.status(500).json({ error: 'Failed to fetch conversations' });

  // Attach last message as a summary field
  const enriched = (conversations || []).map(c => {
    const msgs = (c.messages || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return {
      id: c.id,
      mode: c.mode,
      status: c.status,
      sourceUrl: c.source_url,
      createdAt: c.created_at,
      lead: c.leads?.[0] || null,
      lastMessage: msgs[0] || null,
      unread: msgs.filter(m => m.sender_type === 'visitor').length,
    };
  });

  res.status(200).json({ conversations: enriched });
});
