// Vercel Edge Middleware — gates the main page behind the auth cookie.
// Runs before each request. If the user isn't authed, redirect them to /login.html.
//
// Uses Web Crypto (not Node crypto) because middleware runs in Edge Runtime.

export const config = {
  // Match everything except the login page, the auth API, and Next.js assets.
  matcher: ['/((?!api/auth|api/logout|login\\.html|_next/static|favicon\\.ico).*)']
};

const COOKIE_NAME = 'sp_auth';
const encoder = new TextEncoder();

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach(part => {
    const idx = part.indexOf('=');
    if (idx < 0) return;
    out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  });
  return out;
}

export default async function middleware(req) {
  const secret = process.env.AUTH_SECRET;

  // If no secret, fail open in dev but warn — in production this should be set.
  if (!secret) {
    return new Response(
      'Server not configured: AUTH_SECRET env var missing.',
      { status: 500 }
    );
  }

  const cookies = parseCookies(req.headers.get('cookie'));
  const got = cookies[COOKIE_NAME];
  let authed = false;

  if (got) {
    const expected = await sign('ok', secret);
    authed = (got === expected);
  }

  if (!authed) {
    const url = new URL(req.url);
    // If the request is for an API endpoint, return 401 JSON
    if (url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    // Otherwise redirect to login
    return Response.redirect(new URL('/login.html', req.url), 307);
  }

  // Authed → let the request through
  return; // undefined = pass through
}
