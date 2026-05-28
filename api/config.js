'use strict';

// Public runtime config endpoint.
// Only exposes values that are safe for the browser (no secrets).
// Used by admin/chat.html to initialise the OneSignal Web SDK.
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    oneSignalAppId: process.env.ONESIGNAL_APP_ID || null,
  });
};
