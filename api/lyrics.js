
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { title } = req.query;
  if (!title) {
    return res.status(400).json({ error: 'Missing title parameter' });
  }

  const accessToken = process.env.GENIUS_ACCESS_TOKEN;

  // Clean the title: strip parentheses, slashes, and odd characters
  const cleanedTitle = title
    .replace(/\(.*?\)/g, "")     // Remove (Official Video) etc.
    .replace(/\[.*?\]/g, "")
    .replace(/\s*\/\s*/g, " ")  // Replace slashes with space
    .replace(/[-_]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  console.log('[Using Cleaned Title]', cleanedTitle);

  const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(cleanedTitle)}`;

  try {
    const response = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await response.json();
    const hits = data?.response?.hits || [];

    console.log('[Genius Hits]', hits.map(hit => hit.result.full_title));

    if (!hits.length) {
      return res.status(404).json({ error: 'No results from Genius' });
    }

    // Attempt to extract artist from title
    const artistFromTitle = title.split('-')[0].replace(/[!@#$%^&*]/g, '').trim().toLowerCase();

    const prioritized = hits.find(hit => {
      const url = hit.result.url.toLowerCase();
      const artist = hit.result.primary_artist.name.toLowerCase();
      return (
        artist.includes(artistFromTitle) &&
        (url.includes("laylow") || url.includes("i-see"))
      );
    }) || hits.find(hit => hit.result.primary_artist.name.toLowerCase().includes(artistFromTitle)) || hits[0];

    console.log('[Chosen URL]', prioritized.result.url);

    res.status(200).json({ lyricsUrl: prioritized.result.url });
  } catch (error) {
    console.error("Genius API error:", error);
    res.status(500).json({ error: 'Failed to fetch from Genius' });
  }
};
