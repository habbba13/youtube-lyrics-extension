
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader(" "Access-Control-Allow-Origin", "*");

  const { title } = req.query;
  if (!title) {
    return res.status(400).json({ error: 'Missing title parameter' });
  }

  const accessToken = process.env.GENIUS_ACCESS_TOKEN;
  const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(title)}`;

  try {
    const response = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const data = await response.json();
    const hits = (data && data.response && data.response.hits) || [];

    if (hits.length === 0) {
      return res.status(404).json({ error: 'No results found on Genius' });
    }

    const normalize = str =>
      str.toLowerCase()
        .replace(/[^a-z0-9 ]/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

    const searchNormalized = normalize(title);

    const bestMatch = hits.find(hit => {
      const fullTitle = normalize(hit.result.full_title);
      const pagePath = hit.result.path.toLowerCase();
      return (
        hit.result.type === 'song' &&
        fullTitle.includes(searchNormalized) &&
        !pagePath.includes('translation') &&
        !pagePath.includes('traducao') &&
        !pagePath.includes('news') &&
        !pagePath.includes('bio') &&
        !pagePath.includes('tracklist')
      );
    }) || hits.find(hit => hit.result.type === 'song') || hits[0];

    const lyricsUrl = bestMatch.result.url;
    res.status(200).json({ lyricsUrl });
  } catch (error) {
    console.error('Genius fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch from Genius API' });
  }
};
