'use strict';

const ALLOWED_ORIGINS = [
  'https://cenaris.com.au',
  'https://www.cenaris.com.au',
];

/**
 * Set CORS headers and handle preflight.
 * Returns true if the request was an OPTIONS preflight (caller should return immediately).
 */
function handleCors(req, res) {
  const origin = req.headers['origin'];
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Session-Id');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

module.exports = { handleCors };
