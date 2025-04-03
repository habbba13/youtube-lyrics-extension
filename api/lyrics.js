const fetch = require('node-fetch');

let cache = {}; // Simple in-memory cache to store fetched lyrics

module.exports = async (req, res) => {
  const { title } = req.query;
  const accessToken = process.env.GENIUS_ACCESS_TOKEN;

  if (!title) {
    return res.status(400).json({ error: 'Song title is required.' });
  }
  if (!accessToken) {
    return res.status(500).json({ error: 'Genius API access token is missing.' });
  }

  if (cache[title]) {
    console.log("Returning cached lyrics for:", title);
    return res.status(200).json({ lyrics: cache[title] });
  }

  try {
    // Search for the song
    const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(title)}`;
    const searchResponse = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!searchResponse.ok) {
      return res.status(searchResponse.status).json({ error: 'Error fetching song search results.' });
    }

    const searchData = await searchResponse.json();
    const song = searchData.response.hits[0]?.result;

    if (!song) {
      return res.status(404).json({ error: 'Song not found on Genius.' });
    }

    // Fetch song details
    const songUrl = `https://api.genius.com/songs/${song.id}`;
    const songResponse = await fetch(songUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!songResponse.ok) {
      return res.status(songResponse.status).json({ error: 'Error fetching song details.' });
    }

    const songData = await songResponse.json();
    const lyricsPath = songData.response.song.path;

    if (!lyricsPath) {
      return res.status(404).json({ error: 'Lyrics path not found on Genius.' });
    }

    // Fetch lyrics using a proxy to bypass CORS
    const lyricsPageUrl = `https://genius.com${lyricsPath}`;
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(lyricsPageUrl)}`;

    const lyricsPageResponse = await fetch(proxyUrl);

    if (!lyricsPageResponse.ok) {
      return res.status(lyricsPageResponse.status).json({ error: 'Error fetching lyrics page.' });
    }

    const lyricsPageData = await lyricsPageResponse.json();
    if (!lyricsPageData.contents) {
      return res.status(500).json({ error: 'Failed to retrieve lyrics page content.' });
    }

    const lyrics = extractLyrics(lyricsPageData.contents);

    if (!lyrics) {
      return res.status(404).json({ error: 'Lyrics not found on Genius.' });
    }

    // Cache lyrics to reduce API calls
    cache[title] = lyrics;

    res.status(200).json({ lyrics });

  } catch (error) {
    console.error('Error fetching lyrics:', error);
    res.status(500).json({ error: 'Internal server error.' });
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

  return lyrics.trim() || null;
}
