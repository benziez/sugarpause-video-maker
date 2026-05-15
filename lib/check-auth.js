// Shared auth helper used by all /api endpoints.
// Validates the `sp_auth` cookie against the AUTH_SECRET env var.

import crypto from 'crypto';

const COOKIE_NAME = 'sp_auth';

function sign(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

export function makeAuthCookie(secret) {
  // Cookie value = HMAC of "ok" string. Anyone who knows the secret can verify it.
  const sig = sign('ok', secret);
  return sig;
}

export function checkAuth(req) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    // If no AUTH_SECRET is configured, fail closed
    return false;
  }
  const cookieHeader = req.headers.cookie || '';
  const cookies = parseCookies(cookieHeader);
  const got = cookies[COOKIE_NAME];
  if (!got) return false;

  const expected = sign('ok', secret);
  // Constant-time comparison
  if (got.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(got, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

function parseCookies(header) {
  const out = {};
  header.split(';').forEach(part => {
    const idx = part.indexOf('=');
    if (idx < 0) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    out[k] = v;
  });
  return out;
}

export { COOKIE_NAME };
