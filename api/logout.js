// POST /api/logout
// Clears the auth cookie.

import { COOKIE_NAME } from '../lib/check-auth.js';

export default function handler(req, res) {
  res.setHeader('Set-Cookie', [
    `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
  ]);
  return res.status(200).json({ ok: true });
}
