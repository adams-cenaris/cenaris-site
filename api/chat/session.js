module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Step 1: confirm handler runs at all
    const step1 = 'handler_reached';

    // Step 2: check body parsing
    const body = req.body;
    const step2 = typeof body;

    // Step 3: try requiring supabase
    let step3 = 'not_tried';
    try {
      const sb = require('@supabase/supabase-js');
      step3 = typeof sb.createClient;
    } catch (e3) {
      step3 = 'FAIL: ' + e3.message;
    }

    // Step 4: env vars present?
    const step4 = {
      hasUrl: !!process.env.SUPABASE_URL,
      hasKey: !!process.env.SUPABASE_SERVICE_KEY,
      urlStart: (process.env.SUPABASE_URL || '').slice(0, 20),
    };

    res.status(200).json({ step1, step2, step3, step4 });
  } catch (err) {
    res.status(500).json({ caught: err.message });
  }
};
