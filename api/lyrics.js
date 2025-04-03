const fetch = require('node-fetch');

module.exports = async (req, res) => {
  const { title } = req.query;
  const accessToken = process.env.GENIUS_ACCESS_TOKEN;

  if (!accessToken) {
    return res.status(500).json({ error: 'Genius API access token is missing.' });
  }

  if (!title) {
    return res.status(400).json({ error: 'Song title is required.' });
  }

  try {
    // Step 1: Search for the song on Genius
    const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(title)}`;
    const searchResponse = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!searchResponse.ok) {
      throw new Error(`Genius API search responded with status: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    const song = searchData.response.hits[0]?.result;

    if (!song) {
      return res.status(404).json({ error: 'Song not found on Genius.' });
    }

    // Step 2: Get the song's Genius URL
    const lyricsPageUrl = song.url;
    
    res.status(200).json({ lyricsUrl: lyricsPageUrl });
  } catch (error) {
    console.error('Error fetching lyrics:', error);
    res.status(500).json({ error: 'Failed to fetch lyrics.' });
  }
};
