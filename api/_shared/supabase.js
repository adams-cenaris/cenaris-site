const { createClient } = require('@supabase/supabase-js');

function getClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { persistSession: false } }
  );
}

module.exports = { getClient };
