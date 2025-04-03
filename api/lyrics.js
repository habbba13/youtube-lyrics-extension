const fetch = require('node-fetch');
const AbortController = require('abort-controller');
const { JSDOM } = require('jsdom'); // We use jsdom to parse the HTML and extract lyrics

let cache = {}; // Simple in-memory cache for lyrics

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
    // Step 1: Search for the song on Genius
    const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(title)}`;
    const searchResponse = await fetchWithTimeout(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const searchData = await searchResponse.json();
    console.log("Search Data: ", searchData); // Log the search response
    const song = searchData.response.hits[0]?.result;
    console.log('Hits:', searchData.response.hits);  // Log all search hits for clarity

    if (!song) {
      return res.status(404).json({ error: 'Song not found on Genius.' });
    }

    // Step 2: Fetch song details using the song ID
    const songUrl = `https://api.genius.com/songs/${song.id}`;
    const songResponse = await fetchWithTimeout(songUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const songData = await songResponse.json();
    const lyricsUrl = songData.response.song.url;

    console.log('Lyrics URL:', lyricsUrl); // Log the URL to check if it's valid

    if (!lyricsUrl) {
      return res.status(404).json({ error: 'Lyrics URL not found.' });
    }

    // Step 3: Scrape the lyrics from the Genius page using JSDOM
    const lyricsPageResponse = await fetchWithTimeout(lyricsUrl);
    const lyricsPageHtml = await lyricsPageResponse.text();

    // Use JSDOM to parse the HTML and extract the lyrics
    const dom = new JSDOM(lyricsPageHtml);
    const lyricsElement = dom.window.document.querySelector('.lyrics');
    const lyrics = lyricsElement ? lyricsElement.textContent : null;

    if (!lyrics) {
      return res.status(404).json({ error: 'Lyrics not found on Genius.' });
    }

    // Cache the lyrics for future requests
    cache[title] = lyrics;
    res.status(200).json({ lyrics });
  } catch (error) {
    console.error('Error fetching lyrics:', error);
    res.status(500).json({ error: 'Failed to fetch lyrics.' });
  }
};

// Helper function to add a timeout to fetch requests
async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}
