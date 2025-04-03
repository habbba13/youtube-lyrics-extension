
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
    const searchResponse = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const searchData = await searchResponse.json();
    const hits = searchData?.response?.hits || [];

    console.log('[Genius Hits]', hits.map(h => h.result.full_title));
    console.log('[Using Title]', title);

    if (hits.length === 0) {
      return res.status(404).json({ error: 'No results found on Genius' });
    }

    // Step 1: try to avoid translations, but be relaxed otherwise
    const bestHit = hits.find(hit => {
      const url = hit.result.url.toLowerCase();
      return (
        hit.result.type === 'song' &&
        !url.includes('translation') &&
        !url.includes('traducao')
      );
    }) || hits.find(hit => hit.result.type === 'song') || hits[0];

    console.log('[Chosen URL]', bestHit.result.url);

    const songId = bestHit.result.id;

    // Step 2: Use Genius song ID to fetch full song data
    const songResponse = await fetch(`https://api.genius.com/songs/${songId}?text_format=plain`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const songData = await songResponse.json();
    const song = songData?.response?.song;

    if (song?.lyrics?.plain) {
      return res.status(200).json({ lyrics: song.lyrics.plain });
    }

    return res.status(200).json({ lyricsUrl: song.url });
  } catch (error) {
    console.error('Genius relaxed fetch error:', error);
    res.status(500).json({ error: 'Failed to retrieve lyrics from Genius' });
  }
};
