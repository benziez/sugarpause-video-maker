// GET /api/proxy-image?url=<image url>
// Streams back the image bytes so the browser can use them in <canvas> without CORS issues

import { checkAuth } from '../lib/check-auth.js';

export default async function handler(req, res) {
  if (!checkAuth(req)) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const imgUrl = req.query.url;
  if (!imgUrl) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    const r = await fetch(imgUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!r.ok) {
      return res.status(r.status).json({ error: 'Failed to fetch image' });
    }
    const contentType = r.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(buffer);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
