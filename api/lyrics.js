
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { title } = req.query;
  if (!title) {
    return res.status(400).json({ error: 'Missing title parameter' });
  }

  const accessToken = process.env.GENIUS_ACCESS_TOKEN;

  const cleanedTitle = title
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/\s*\/\s*/g, " ")
    .replace(/[-_]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(cleanedTitle)}`;

  try {
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const searchData = await searchRes.json();
    const hits = (searchData?.response?.hits || []).filter(hit => hit.type === "song");

    console.log('[Cleaned Title]', cleanedTitle);
    console.log('[Filtered Genius Song Hits]', hits.map(h => h.result.full_title));

    if (!hits.length) {
      return res.status(404).json({ error: 'No song results from Genius' });
    }

    const firstSong = hits[0].result;

    const songId = firstSong.id;
    const songRes = await fetch(`https://api.genius.com/songs/${songId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const songData = await songRes.json();
    const canonicalUrl = songData?.response?.song?.url;

    if (!canonicalUrl) {
      return res.status(404).json({ error: 'Could not resolve canonical song URL' });
    }

    console.log('[Resolved Canonical URL]', canonicalUrl);
    res.status(200).json({ lyricsUrl: canonicalUrl });
  } catch (err) {
    console.error("Genius API error:", err);
    res.status(500).json({ error: 'Failed to retrieve Genius lyrics URL' });
  }
};
