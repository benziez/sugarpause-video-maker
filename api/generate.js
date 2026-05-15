// POST /api/generate
// Body: { prompt: string, maxTokens?: number }
// Returns: { text: string }
//
// Calls Anthropic API server-side using ANTHROPIC_API_KEY env var.
// Gated by checkAuth() so randos can't burn through the budget.

import { checkAuth } from '../lib/check-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!checkAuth(req)) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server missing ANTHROPIC_API_KEY env var' });
  }

  const { prompt, maxTokens = 2000 } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!r.ok) {
      const errText = await r.text();
      return res.status(r.status).json({ error: `Anthropic API: ${errText}` });
    }

    const data = await r.json();
    const text = data.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('');

    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
