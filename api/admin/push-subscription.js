'use strict';

const { createClient } = require('@supabase/supabase-js');
const { verifyAdmin }  = require('../_shared/auth');

function getClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
}

module.exports = async function handler(req, res) {
  if (!verifyAdmin(req)) return res.status(401).json({ error: 'Unauthorised' });

  const { subscriptionId } = req.body || {};
  if (!subscriptionId) return res.status(400).json({ error: 'subscriptionId required' });

  const supabase = getClient();

  if (req.method === 'POST') {
    await supabase
      .from('admin_push_subscriptions')
      .upsert({ subscription_id: subscriptionId }, { onConflict: 'subscription_id' });
    console.log('[push-subscription] saved', subscriptionId);
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    await supabase
      .from('admin_push_subscriptions')
      .delete()
      .eq('subscription_id', subscriptionId);
    console.log('[push-subscription] removed', subscriptionId);
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
