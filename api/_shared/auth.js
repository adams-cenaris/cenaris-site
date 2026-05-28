const { jwtVerify } = require('jose');

async function verifyAdmin(req) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload.role === 'admin' ? payload : null;
  } catch {
    return null;
  }
}

function requireAdmin(handler) {
  return async (req, res) => {
    const payload = await verifyAdmin(req);
    if (!payload) return res.status(401).json({ error: 'Unauthorised' });
    return handler(req, res, payload);
  };
}

module.exports = { verifyAdmin, requireAdmin };
