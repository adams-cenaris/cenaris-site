const jwt = require('jsonwebtoken');

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k) cookies[k.trim()] = v.join('=').trim();
  }
  return cookies;
}

function verifyAdmin(req) {
  const cookies = parseCookies(req.headers['cookie']);
  const token = cookies['cenaris_admin'] ?? null;
  if (!token || !process.env.JWT_SECRET) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload.role === 'admin' ? payload : null;
  } catch {
    return null;
  }
}

function requireAdmin(handler) {
  return async (req, res) => {
    const payload = verifyAdmin(req);
    if (!payload) return res.status(401).json({ error: 'Unauthorised' });
    return handler(req, res, payload);
  };
}

module.exports = { verifyAdmin, requireAdmin };
