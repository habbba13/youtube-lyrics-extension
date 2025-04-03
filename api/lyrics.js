
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { title } = req.query;
  if (!title) {
    return res.status(400).json({ error: 'Missing title parameter' });
  }

  const accessToken = process.env.GENIUS_ACCESS_TOKEN;
  const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(title)}`;

  try {
    // Step 1: Search for song
    const searchResponse = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const searchData = await searchResponse.json();
    const hits = searchData?.response?.hits || [];

    if (hits.length === 0) {
      return res.status(404).json({ error: 'No results found on Genius' });
    }

    // Step 2: Try to find a clean match using normalized slug match
    const normalize = str =>
      str.toLowerCase()
        .replace(/[^a-z0-9]/gi, '-') // Genius slug style
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    const searchSlug = normalize(title);
    const bestHit = hits.find(hit => {
      const url = hit.result.url.toLowerCase();
      const path = hit.result.path.toLowerCase();
      return (
        hit.result.type === 'song' &&
        url.includes(searchSlug) &&
        !url.includes('translation') &&
        !url.includes('traducao') &&
        !path.includes('news') &&
        !path.includes('bio')
      );
    }) || hits.find(hit => hit.result.type === 'song') || hits[0];

    const songId = bestHit.result.id;

    // Step 3: Fetch full song data via Genius API
    const songResponse = await fetch(`https://api.genius.com/songs/${songId}?text_format=plain`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const songData = await songResponse.json();
    const song = songData?.response?.song;

    // Step 4: If API provides lyrics (rare), send them — else send URL to be scraped
    if (song?.lyrics?.plain) {
      return res.status(200).json({ lyrics: song.lyrics.plain });
    }

    // Step 5: Return URL so frontend can scrape if needed
    return res.status(200).json({ lyricsUrl: song.url });
  } catch (error) {
    console.error('Genius hybrid fetch error:', error);
    res.status(500).json({ error: 'Failed to retrieve lyrics from Genius' });
  }
};
