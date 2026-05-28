const { getClient } = require('../_shared/supabase');
const crypto = require('crypto');

// POST /api/chat/session
// Body: { sourceUrl }
// Returns: { conversationId, sessionId, mode }
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { sourceUrl } = req.body || {};
  const supabase = getClient();

  // Determine mode by calling availability logic inline
  const { data: override } = await supabase
    .from('availability_overrides')
    .select('status')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let available;
  if (override) {
    available = override.status === 'available';
  } else {
    const parts = new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Sydney',
      weekday: 'short',
      hour: 'numeric',
      hour12: false,
    }).formatToParts(new Date());
    const weekday = parts.find(p => p.type === 'weekday').value;
    const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);
    available = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(weekday) && hour >= 9 && hour < 17;
  }

  const mode = available ? 'live' : 'ai';
  const sessionId = crypto.randomUUID();

  const { data, error } = await supabase
    .from('conversations')
    .insert({ session_id: sessionId, mode, source_url: sourceUrl || null })
    .select('id, session_id, mode')
    .single();

  if (error) {
    console.error('session insert error', error);
    return res.status(500).json({ error: 'Failed to create session' });
  }

  // System greeting message
  const greeting = available
    ? "Hi, welcome to Cenaris. You're chatting with our team. How can we help today?"
    : "Hi, our team is currently offline. Our AI assistant can help with general questions about Cenaris and NDIS compliance. For quotes, bookings, or anything needing follow-up, I'll connect you with our team.";

  await supabase.from('messages').insert({
    conversation_id: data.id,
    sender_type: 'system',
    body: greeting,
  });

  res.status(200).json({ conversationId: data.id, sessionId: data.session_id, mode });
};
