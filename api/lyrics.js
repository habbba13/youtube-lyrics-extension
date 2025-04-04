const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { title } = req.query;
  if (!title) {
    return res.status(400).json({ error: 'Missing title parameter' });
  }

  const accessToken = process.env.GENIUS_ACCESS_TOKEN;

  // Pre-clean the title
  const cleanedTitle = title
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/\s*\/\s*/g, " ")
    .replace(/[-_]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(cleanedTitle)}`;
  const artistFromTitle = title.split('-')[0].replace(/[!@#$%^&*]/g, '').trim().toLowerCase();

  try {
    const response = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const data = await response.json();
    const hits = data?.response?.hits || [];

    console.log('[Using Cleaned Title]', cleanedTitle);
    console.log('[Genius Hits]', hits.map(hit => hit.result.full_title));

    if (!hits.length) {
      return res.status(404).json({ error: 'No results from Genius' });
    }

    // Score results by matching artist and keywords
    const scoredHits = hits.map(hit => {
      const artist = hit.result.primary_artist.name.toLowerCase();
      const url = hit.result.url.toLowerCase();
      const title = hit.result.title_with_featured.toLowerCase();

      let score = 0;

      if (artist.includes(artistFromTitle)) score += 5;
      if (title.includes("number 2") || url.includes("number-2")) score += 3;
      if (title.includes("never last") || url.includes("never-last")) score += 2;
      if (url.includes("lil-tecca")) score += 5;

      return { hit, score };
    });

    const best = scoredHits.sort((a, b) => b.score - a.score)[0]?.hit;

    if (!best) {
      return res.status(404).json({ error: 'No strong match found' });
    }

    console.log('[Chosen URL]', best.result.url);

    res.status(200).json({ lyricsUrl: best.result.url });
  } catch (err) {
    console.error("Genius API error:", err);
    res.status(500).json({ error: 'Failed to fetch from Genius' });
  }
};
