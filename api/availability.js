const { getClient } = require('./_shared/supabase');

// Mon–Fri 09:00–17:00 AEST/AEDT (Australia/Sydney handles DST automatically)
const BUSINESS_HOURS = { start: 9, end: 17 };
const BUSINESS_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

function getSydneyParts(date) {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(date);
}

function isWithinBusinessHours() {
  const parts = getSydneyParts(new Date());
  const weekday = parts.find(p => p.type === 'weekday').value;
  const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);
  return BUSINESS_DAYS.includes(weekday) && hour >= BUSINESS_HOURS.start && hour < BUSINESS_HOURS.end;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = getClient();

  // Check for active manual override
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
    available = isWithinBusinessHours();
  }

  const mode = available ? 'live' : 'ai';
  res.status(200).json({ available, mode });
};
