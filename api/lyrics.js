const fetch = require('node-fetch');
const AbortController = require('abort-controller');
const { JSDOM } = require('jsdom');

let cache = {}; // In-memory cache

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

    console.log("All Search Hits:", searchData.response.hits);

    // Find the best matching song
    const song = searchData.response.hits.length > 0 ? searchData.response.hits[0].result : null;
    
    if (!song) {
      return res.status(404).json({ error: 'Song not found on Genius.' });
    }

    console.log("Matched Song:", song.full_title);

    // Step 2: Fetch song details using the song ID
    const songUrl = `https://api.genius.com/songs/${song.id}`;
    const songResponse = await fetchWithTimeout(songUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const songData = await songResponse.json();
    const lyricsUrl = songData.response.song.url;

    console.log('Lyrics URL:', lyricsUrl);

    if (!lyricsUrl) {
      return res.status(404).json({ error: 'Lyrics URL not found.' });
    }

    // Step 3: Try fetching lyrics using Web Pages API (safer alternative)
    const webPageUrl = `https://api.genius.com/web_pages/lookup?raw_annotatable_url=${encodeURIComponent(lyricsUrl)}`;
    const webPageResponse = await fetchWithTimeout(webPageUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const webPageData = await webPageResponse.json();
    
    if (!webPageData.response.web_page) {
      console.warn('Web page data not found, attempting direct lyrics extraction...');
    }

    // Step 4: Attempt to scrape lyrics (Warning: Might not work due to Cloudflare)
    const lyricsPageResponse = await fetchWithTimeout(lyricsUrl);
    const lyricsPageHtml = await lyricsPageResponse.text();

    const dom = new JSDOM(lyricsPageHtml);
    let lyrics = "";

    // Genius uses multiple divs for lyrics, extract all
    dom.window.document.querySelectorAll("div[class^='Lyrics__Container']").forEach(lyricDiv => {
      lyrics += lyricDiv.textContent.trim() + "\n\n";
    });

    if (!lyrics.trim()) {
      return res.status(404).json({ error: 'Lyrics not found on Genius.' });
    }

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

