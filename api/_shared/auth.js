const jwt = require('jsonwebtoken');

function verifyAdmin(req) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  if (!process.env.JWT_SECRET) return null;
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
