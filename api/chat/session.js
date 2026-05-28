const crypto = require('crypto');

const BUSINESS_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

function isWithinBusinessHours() {
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', weekday: 'short', hour: 'numeric', hour12: false }).formatToParts(new Date());
  const weekday = parts.find(p => p.type === 'weekday').value;
  const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);
  return BUSINESS_DAYS.includes(weekday) && hour >= 9 && hour < 17;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

    const { sourceUrl } = req.body || {};

    let override = null;
    try {
      const { data } = await supabase.from('availability_overrides').select('status').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(1).maybeSingle();
      override = data;
    } catch {}

    const available = override ? override.status === 'available' : isWithinBusinessHours();
    const mode = available ? 'live' : 'ai';
    const sessionId = crypto.randomUUID();

    const { data, error } = await supabase.from('conversations').insert({ session_id: sessionId, mode, source_url: sourceUrl || null }).select('id, session_id, mode').single();
    if (error) return res.status(500).json({ error: 'DB insert failed', detail: error.message });

    const greeting = available
      ? "Hi, welcome to Cenaris. You're chatting with our team. How can we help today?"
      : "Hi, our team is currently offline. Our AI assistant can help with general questions about Cenaris and NDIS compliance. For quotes, bookings, or anything needing follow-up, I'll connect you with our team.";

    await supabase.from('messages').insert({ conversation_id: data.id, sender_type: 'system', body: greeting });

    res.status(200).json({ conversationId: data.id, sessionId: data.session_id, mode });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack?.split('\n').slice(0, 3) });
  }
};
