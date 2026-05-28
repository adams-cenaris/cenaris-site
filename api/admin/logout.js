// POST /api/admin/logout
// Clears the admin session cookie.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader(
    'Set-Cookie',
    'cenaris_admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0',
  );
  res.status(200).json({ ok: true });
};
