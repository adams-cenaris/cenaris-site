const { SignJWT } = require('jose');
const crypto = require('crypto');

// POST /api/admin/auth
// Body: { password }
// Returns: { token } — JWT valid for 8 hours
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'password required' });

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return res.status(500).json({ error: 'Admin auth not configured' });

  // Constant-time comparison to prevent timing attacks
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  const equal = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!equal) {
    // Small delay to slow brute-force even further
    await new Promise(r => setTimeout(r, 300));
    return res.status(401).json({ error: 'Invalid password' });
  }

  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  const token = await new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secret);

  res.status(200).json({ token });
};
