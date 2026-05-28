const { getClient } = require('../_shared/supabase');
const { requireAdmin } = require('../_shared/auth');

// POST /api/admin/reply
// Body: { conversationId, body }
// Returns: { message }
module.exports = requireAdmin(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { conversationId, body } = req.body || {};
  if (!conversationId || !body?.trim()) {
    return res.status(400).json({ error: 'conversationId and body required' });
  }

  const supabase = getClient();

  // Verify conversation exists
  const { data: conv, error: convErr } = await supabase
    .from('conversations')
    .select('id, status')
    .eq('id', conversationId)
    .maybeSingle();

  if (convErr || !conv) return res.status(404).json({ error: 'Conversation not found' });
  if (conv.status === 'closed') return res.status(400).json({ error: 'Conversation is closed' });

  const { data: message, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_type: 'agent', body: body.trim() })
    .select()
    .single();

  if (error) return res.status(500).json({ error: 'Failed to send reply' });

  res.status(200).json({ message });
});
