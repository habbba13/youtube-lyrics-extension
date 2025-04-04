const fetch = require('node-fetch');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'Missing Genius URL' });
  }

  console.log('[Scraping]', url);

  const apiKey = process.env.SCRAPER_API_KEY;
  const scraperUrl = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(url)}&render=true`;

  async function tryFetchLyrics() {
    const response = await fetch(scraperUrl);
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

    // Fallback to old format
    if (!lyrics) {
      lyrics = $('.lyrics').text().trim();
    }

    return lyrics;
  }

  try {
    let lyrics = await tryFetchLyrics();

    if (!lyrics) {
      console.warn('[Retrying fetch]');
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
};

