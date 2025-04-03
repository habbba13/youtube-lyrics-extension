const fetch = require('node-fetch');

module.exports = async (req, res) => {
  const { title } = req.query;
  const accessToken = process.env.GENIUS_ACCESS_TOKEN;

  // Ensure title and access token are provided
  if (!title) {
    return res.status(400).json({ error: 'Song title is required.' });
  }
  if (!accessToken) {
    return res.status(500).json({ error: 'Genius API access token is missing.' });
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

    // Step 2: Fetch the song details to get the lyrics path
    const songUrl = `https://api.genius.com/songs/${song.id}`;
    const songResponse = await fetch(songUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!songResponse.ok) {
      throw new Error(`Genius API song details responded with status: ${songResponse.status}`);
    }

    const songData = await songResponse.json();
    const lyricsPath = songData.response.song.path;

    // Step 3: Scrape the lyrics using a proxy to avoid CORS issues
    const lyricsPageUrl = `https://genius.com${lyricsPath}`;
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(lyricsPageUrl)}`;

    const lyricsPageResponse = await fetch(proxyUrl);

    if (!lyricsPageResponse.ok) {
      throw new Error(`Failed to fetch lyrics page with status: ${lyricsPageResponse.status}`);
    }

    const lyricsPageHtml = await lyricsPageResponse.text();
    const lyrics = extractLyrics(lyricsPageHtml);

    if (!lyrics) {
      return res.status(404).json({ error: 'Lyrics not found on Genius.' });
    }

    // Return the lyrics as the response
    res.status(200).json({ lyrics });

  } catch (error) {
    console.error('Error fetching lyrics:', error);
    res.status(500).json({ error: 'Failed to fetch lyrics.' });
  }
};

// Helper function to extract lyrics from the Genius song page HTML
function extractLyrics(html) {
  const regex = /<div class="Lyrics__Container.*?>(.*?)<\/div>/gs;
  let lyrics = '';
  let match;

  while ((match = regex.exec(html)) !== null) {
    lyrics += match[1]
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/<.*?>/g, '')
      .trim() + '\n\n';
  }

  return lyrics.trim();
}
