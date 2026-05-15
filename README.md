# SugarPause Generator — Vercel Deployment

A password-gated web app for generating SugarPause TikTok/IG slideshows and news-style single slides. AI keys live server-side so the URL is safe to use from any device (phone, tablet, laptop).

## One-time setup

### 1. Get the files into GitHub

1. Create a new private GitHub repo (e.g. `sugarpause-generator`)
2. Drop all files from this folder into the repo and push:
   - `index.html`, `login.html`
   - `middleware.js`
   - `package.json`, `vercel.json`
   - `api/` folder with all 6 endpoints

### 2. Deploy to Vercel

1. Go to https://vercel.com → "Add New" → "Project"
2. Import the GitHub repo you just created
3. Framework preset: **Other** (it'll auto-detect static + serverless functions)
4. Click **Deploy** (it'll fail or run partly — that's expected because env vars aren't set yet)

### 3. Set environment variables in Vercel

In your project's Vercel dashboard → **Settings** → **Environment Variables** → add these four:

| Variable | What it is | Example / how to get |
|---|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key | `sk-ant-api03-...` from https://console.anthropic.com |
| `SERPAPI_KEY` | Your SerpAPI key for image search | From https://serpapi.com — 100 free/month or $75/mo for 5,000 |
| `APP_PASSWORD` | The password YOU pick to log in | Anything you want — make it strong, write it down once. Only you (and anyone you share with) will type this. |
| `AUTH_SECRET` | A random string used to sign session cookies | Generate with `openssl rand -hex 32` on your Mac, or paste any long random string. Doesn't matter what it is, just keep it consistent. |

**Apply to all environments** (Production, Preview, Development) for each.

### 4. Redeploy

After saving env vars, hit **Deployments** → click the latest one → **Redeploy** (without the build cache is fine).

Once it's green, you'll have a URL like `sugarpause-generator-yourname.vercel.app`.

## Daily use

1. Visit your Vercel URL on any device (phone, laptop, etc.)
2. You'll be redirected to `/login.html` if you're not already signed in
3. Enter your `APP_PASSWORD` → cookie is set, valid for **30 days**
4. Generator loads — pick mode (Carousel or News), type topic, hit Generate
5. Bottom-right of the form has a **Log out** link if you want to clear the cookie

## Adding a VA / teammate

Just give them the URL and the password. They never see your API keys.

When they're done with the project, you can either:
- Tell them the password (and they keep using it on their device until 30 days lapse)
- Or rotate `APP_PASSWORD` in Vercel after they're done — old cookies invalidate immediately if you also rotate `AUTH_SECRET`

## Architecture notes

- **`middleware.js`** — Vercel Edge middleware. Intercepts every request. If `sugarpause_auth` cookie is missing or invalid, redirects to `/login.html`. Allows `/api/auth`, `/api/logout`, and `login.html` through without auth.
- **`api/auth.js`** — POST `{password}`. If correct, sets `sugarpause_auth` cookie (HMAC-SHA256 of "ok" using `AUTH_SECRET`). HttpOnly, Secure, SameSite=Lax, 30-day expiry.
- **`api/_check-auth.js`** — Helper that re-verifies the cookie HMAC. Used by all data endpoints.
- **`api/generate.js`** — Proxies prompts to Anthropic Messages API. Uses `claude-sonnet-4-6`.
- **`api/search-images.js`** — Proxies search queries to SerpAPI.
- **`api/proxy-image.js`** — Fetches image bytes server-side and pipes back, so canvas can use cross-origin images without CORS errors.
- **`api/logout.js`** — Clears the auth cookie.
- **`index.html`** — The actual generator UI. Same as before, but with API key inputs removed and all external API calls routed through `/api/*`.

## Updating the app

Edit any file → push to GitHub → Vercel auto-deploys in ~30 seconds. Your password and saved state persist across deploys.

## Troubleshooting

- **Login page just keeps reappearing**: `AUTH_SECRET` might have changed between when your cookie was set and now. Click "Log out" link or clear cookies and re-login.
- **"Server missing ANTHROPIC_API_KEY"**: env var not set or wrong name in Vercel dashboard.
- **All requests 401**: middleware can't verify cookie — check that `AUTH_SECRET` matches in both middleware and auth endpoints (they read from the same env var so this should just work, but if you mis-typed the variable name in Vercel it'll silently break).
- **News slide / image search times out**: SerpAPI free plan is 100 searches/month. Check your SerpAPI dashboard.
