// POST /api/auth
// Body: { password: string }
// Sets HttpOnly cookie if password matches APP_PASSWORD env var.

import { makeAuthCookie, COOKIE_NAME } from '../lib/check-auth.js';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const expected = process.env.APP_PASSWORD;
  const secret = process.env.AUTH_SECRET;
  if (!expected || !secret) {
    return res.status(500).json({ error: 'Server not configured (missing APP_PASSWORD or AUTH_SECRET)' });
  }

  const { password } = req.body || {};
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Password required' });
  }

  if (password !== expected) {
    return res.status(401).json({ error: 'Wrong password' });
  }

  // Build cookie: HttpOnly + Secure + SameSite=Lax, valid for 30 days
  const sig = makeAuthCookie(secret);
  const maxAge = 60 * 60 * 24 * 30; // 30 days
  res.setHeader('Set-Cookie', [
    `${COOKIE_NAME}=${sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
  ]);
  return res.status(200).json({ ok: true });
}
