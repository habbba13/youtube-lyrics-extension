const fetch = require('node-fetch');
const AbortController = require('abort-controller');

let cache = {}; // Simple in-memory cache for lyrics

module.exports = async (req, res) => {
  const { title } = req.query; // Get the song title from the query params
  const accessToken = process.env.GENIUS_ACCESS_TOKEN; // Your Genius API access token

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
    const song = searchData.response.hits[0]?.result;

    if (!song) {
      return res.status(404).json({ error: 'Song not found on Genius.' });
    }

    // Step 2: Fetch song details using the song ID to get the lyrics URL
    const songUrl = `https://api.genius.com/songs/${song.id}`;
    const songResponse = await fetchWithTimeout(songUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const songData = await songResponse.json();
    const lyricsUrl = songData.response.song.url;

    if (!lyricsUrl) {
      return res.status(404).json({ error: 'Lyrics URL not found.' });
    }

    // Step 3: Use the Web Pages API to check if the page is annotatable
    const webPageUrl = `https://api.genius.com/web_pages/lookup?raw_annotatable_url=${encodeURIComponent(lyricsUrl)}`;
    const webPageResponse = await fetchWithTimeout(webPageUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const webPageData = await webPageResponse.json();
    if (!webPageData.response || !webPageData.response.web_page) {
      return res.status(404).json({ error: 'Web page not found or not annotatable on Genius.' });
    }

    // Logging Web Page Data for Debugging
    console.log('Web page data:', webPageData.response.web_page);

    // If no annotations are found, log a warning but proceed to scrape lyrics
    if (webPageData.response.web_page.annotation_count === 0) {
      console.warn('No annotations found on this page. Proceeding with lyrics extraction.');
    }

    // Step 4: Scrape the lyrics page to extract lyrics using a proxy service (AllOrigins)
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(lyricsUrl)}`;
    const lyricsPageResponse = await fetchWithTimeout(proxyUrl);
    const lyricsPageData = await lyricsPageResponse.json();
    const lyrics = extractLyrics(lyricsPageData.contents);

    if (!lyrics) {
      return res.status(404).json({ error: 'Lyrics not found on Genius.' });
    }

    // Cache the lyrics for future requests
    cache[title] = lyrics;

    // Return the lyrics as the response
    res.status(200).json({ lyrics });
  } catch (error) {
    console.error('Error fetching lyrics:', error);
    res.status(500).json({ error: 'Failed to fetch lyrics.' });
  }
};

// Helper function to extract lyrics from HTML
function extractLyrics(html) {
  const regex = /<div class="Lyrics__Container.*?>(.*?)<\/div>/gs;
  let lyrics = '';
  let match;

  while ((match = regex.exec(html)) !== null) {
    lyrics += match[1].replace(/<br\s*\/?>(?<!<a)/g, '\n')  // Replace <br> tags with newlines
                      .replace(/<.*?>/g, '')             // Remove HTML tags
                      .trim() + '\n\n';                 // Add newlines between lyrics
  }

  return lyrics.trim();
}

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

