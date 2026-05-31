// POST /api/scrape
// Body: { url: string, brand?: string }
// Fetches article HTML, extracts text, uses Claude to pull headline/facts/topic/highlights.

import { checkAuth } from '../lib/check-auth.js';

function extractTextFromHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 18000);
}

function parseJsonFromText(rawText) {
  let text = String(rawText || '').replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(text);
  } catch {}
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return JSON.parse(text.slice(start, end + 1));
  }
  throw new Error('Could not parse extraction JSON');
}

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

  const { url, brand = 'winrips' } = req.body || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url' });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url.trim());
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid protocol');
    }
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  try {
    const pageRes = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SugarPauseBot/1.0; +https://sugarpause.app)',
        Accept: 'text/html,application/xhtml+xml'
      },
      redirect: 'follow'
    });

    if (!pageRes.ok) {
      return res.status(502).json({ error: `Could not fetch URL (${pageRes.status})` });
    }

    const html = await pageRes.text();
    const articleText = extractTextFromHtml(html);
    if (articleText.length < 120) {
      return res.status(422).json({ error: 'Page had too little readable text to extract from.' });
    }

    const brandHint = brand === 'winrips'
      ? 'Pokémon TCG / card collecting / pack openings context when relevant.'
      : brand === 'pointless'
        ? 'Sports, markets, or news context when relevant.'
        : 'Health, menopause, sugar, or wellness context when relevant.';

    const extractPrompt = `You extract structured fields from article text for a TikTok slideshow generator.

BRAND CONTEXT: ${brandHint}

ARTICLE TEXT (truncated):
${articleText.slice(0, 14000)}

Return ONLY valid JSON:
{
  "headline": "Original article headline or best title from the page",
  "topic": "Punchy TikTok one-liner rewrite of the story (NOT the raw headline). 8-18 words. Conversational hook energy.",
  "highlights": ["1-2 exact substrings to highlight on slide 1: the most shocking number, dollar amount, or proper name"],
  "facts": ["3-5 key facts as short strings"],
  "people": ["main people, cards, teams, or entities involved"]
}

Rules:
- topic must be rewritten for social, not copy-pasted journalistic title
- highlights must be exact phrases that could appear in the topic or headline (numbers like $37,000 or names like Charizard)
- Do not fabricate numbers not in the article
- No em dashes or en dashes
- Return ONLY JSON`;

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 900,
        messages: [{ role: 'user', content: extractPrompt }]
      })
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return res.status(aiRes.status).json({ error: `Anthropic API: ${errText}` });
    }

    const aiData = await aiRes.json();
    const aiText = aiData.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('');

    const extracted = parseJsonFromText(aiText);
    const highlights = Array.isArray(extracted.highlights)
      ? extracted.highlights.map(String).filter(Boolean).slice(0, 2)
      : [];
    const facts = Array.isArray(extracted.facts) ? extracted.facts.map(String).filter(Boolean).slice(0, 5) : [];
    const people = Array.isArray(extracted.people) ? extracted.people.map(String).filter(Boolean).slice(0, 6) : [];

    return res.status(200).json({
      headline: String(extracted.headline || '').trim(),
      topic: String(extracted.topic || '').trim(),
      highlights,
      facts,
      people,
      articleContext: [extracted.headline, ...facts].filter(Boolean).join('\n')
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Scrape failed' });
  }
}
