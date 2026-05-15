// GET /api/search-images?q=<query>&num=10
// Returns: { images: [{thumbnail, original, title, source}, ...] }

import { checkAuth } from '../lib/check-auth.js';

export default async function handler(req, res) {
  if (!checkAuth(req)) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server missing SERPAPI_KEY env var' });
  }

  const query = req.query.q;
  const num = req.query.num || '10';

  if (!query) {
    return res.status(400).json({ error: 'Missing q parameter' });
  }

  try {
    const serpUrl = `https://serpapi.com/search.json?engine=google_images&q=${encodeURIComponent(query)}&num=${num}&api_key=${apiKey}&safe=active`;
    const r = await fetch(serpUrl);
    const data = await r.json();

    if (data.error) {
      return res.status(400).json({ error: data.error });
    }

    const images = (data.images_results || []).slice(0, parseInt(num)).map(img => ({
      thumbnail: img.thumbnail,
      original: img.original,
      title: img.title,
      source: img.source
    }));

    return res.status(200).json({ images });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
