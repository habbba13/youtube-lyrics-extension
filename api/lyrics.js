export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*"); // ✅ THIS LINE

  const { title } = req.query;

  if (!title) {
    return res.status(400).json({ error: 'Missing title parameter' });
  }

  const accessToken = process.env.GENIUS_ACCESS_TOKEN;
  const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(title)}`;

  try {
    const response = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const data = await response.json();
    const hits = data.response.hits;

    if (!hits || hits.length === 0) {
      return res.status(404).json({ error: 'No results found on Genius' });
    }

    const lyricsUrl = hits[0].result.url;
    res.status(200).json({ lyricsUrl });
  } catch (error) {
    console.error('Error fetching from Genius API:', error);
    res.status(500).json({ error: 'Failed to fetch from Genius API' });
  }
}
