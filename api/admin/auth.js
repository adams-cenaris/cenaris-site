const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { checkRateLimit } = require('../_shared/ratelimit');

const COOKIE_CLEAR = 'cenaris_admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0';
const COOKIE_SET = (token) =>
  `cenaris_admin=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`;

// POST /api/admin/auth  — login (sets HttpOnly cookie)
// DELETE /api/admin/auth — logout (clears cookie)
module.exports = async function handler(req, res) {
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', COOKIE_CLEAR);
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 5 login attempts per IP per 15 minutes
  if (await checkRateLimit(req, res, 'admin:auth', 5, 900)) return;

  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'password required' });

  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash || !process.env.JWT_SECRET) return res.status(500).json({ error: 'Admin auth not configured' });

  const valid = await bcrypt.compare(password, hash);

  if (!valid) {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
    console.warn(JSON.stringify({ event: 'admin_auth_failure', ip, timestamp: new Date().toISOString() }));
    await new Promise(r => setTimeout(r, 500));
    return res.status(401).json({ error: 'Invalid password' });
  }

  const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.setHeader('Set-Cookie', COOKIE_SET(token));
  res.status(200).json({ ok: true, token });
};
