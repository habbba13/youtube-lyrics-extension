const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { songId } = req.query;
  const accessToken = process.env.GENIUS_ACCESS_TOKEN;

  if (!songId) {
    return res.status(400).json({ error: 'Missing Genius song ID' });
  }

  try {
    const response = await fetch(`https://api.genius.com/songs/${songId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const data = await response.json();
    const lyrics = data?.response?.song?.lyrics?.plain;
    
    if (!lyrics) {
      return res.status(404).json({ error: 'Lyrics not found in Genius API' });
    }
    
    if (!songRes.ok) {
      throw new Error(`Genius API responded with ${songRes.status}`);
    }

    const songData = await songRes.json();
    const embedHtml = songData?.response?.song?.embed_content || '';

    const lyrics = extractLyricsFromEmbed(embedHtml);

    if (!lyrics) {
      return res.status(404).json({ error: 'Lyrics not found in embed' });
    }

    return res.status(200).json({ lyrics });
  } catch (err) {
    console.error('[Genius API Error]', err.message);
    return res.status(500).json({ error: 'Failed to get lyrics from Genius API' });
  }
};

function extractLyricsFromEmbed(embedHtml) {
  if (!embedHtml) return null;

  // Convert HTML entities and tags to plain text
  const decoded = embedHtml
    .replace(/<[^>]+>/g, '') // strip tags
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s{2,}/g, ' ') // collapse spacing
    .trim();

  return decoded || null;
}

