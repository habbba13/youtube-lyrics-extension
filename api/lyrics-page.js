const fetch = require('node-fetch');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === 'OPTIONS') {
    return res.status(200).end(); // Handle preflight
  }

  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'Missing Genius URL' });
  }

  const apiKey = process.env.SCRAPER_API_KEY;
  const scraperUrl = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(url)}&render=true`;

  async function tryFetchLyrics() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    try {
      const response = await fetch(scraperUrl, { signal: controller.signal });
      clearTimeout(timeout);
      const html = await response.text();
      const $ = cheerio.load(html);

      const lyricsContainers = $('[data-lyrics-container]');
      let lyrics = lyricsContainers
        .map((_, el) => {
          return $(el)
            .contents()
            .map((_, child) => $(child).text())
            .get()
            .join('\n');
        })
        .get()
        .join('\n');

      lyrics = lyrics
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !/contributors|translations|avatars|lyrics/i.test(line))
        .join('\n');

      if (!lyrics) {
        lyrics = $('.lyrics').text().trim();
      }

      return lyrics;
    } catch (err) {
      clearTimeout(timeout);
      console.error('[Fetch error]', err.name === 'AbortError' ? 'Request timed out' : err);
      return null;
    }
  }

      try {
      let lyrics = await tryFetchLyrics();

      if (!lyrics) {
        console.warn('[Retrying fetch]');
        await new Promise(resolve => setTimeout(resolve, 1500)); // small delay
        lyrics = await tryFetchLyrics();
  }

      if (!lyrics) {
        console.warn('[No Lyrics Found]');
        return res.status(404).json({ error: 'Lyrics not found on page' });
  }

      return res.status(200).json({ lyrics });
    } catch (err) {
      console.error('ScraperAPI error:', err);
      return res.status(500).json({ error: 'Failed to scrape lyrics with ScraperAPI' });
}


    res.status(200).json({ lyrics });
  } catch (err) {
    console.error('ScraperAPI error:', err);
    res.status(500).json({ error: 'Failed to scrape lyrics with ScraperAPI' });
  }
};
