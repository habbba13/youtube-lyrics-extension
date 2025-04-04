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

  const apiKey = process.env.SCRAPER_API_KEY;
  const scraperUrl = (key) =>
    `http://api.scraperapi.com?api_key=${key}&url=${encodeURIComponent(url)}&render=true`;

  async function tryScrape(attempt = 1) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s max
      const response = await fetch(scraperUrl(apiKey), { signal: controller.signal });
      clearTimeout(timeout);

      const html = await response.text();

      if (!html || html.startsWith("An error occurred")) {
        throw new Error("Bad HTML from ScraperAPI");
      }

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

      return lyrics || null;
    } catch (err) {
      console.warn(`[Attempt ${attempt}] Scrape error:`, err.message);
      return null;
    }
  }

  try {
    let lyrics = null;
    const maxTries = 3;
    for (let i = 1; i <= maxTries; i++) {
      lyrics = await tryScrape(i);
      if (lyrics) break;
      await new Promise(resolve => setTimeout(resolve, i * 1000)); // exponential backoff
    }

    if (!lyrics) {
      return res.status(504).json({ error: 'Lyrics not found or scraper timed out' });
    }

    return res.status(200).json({ lyrics });
  } catch (err) {
    console.error('[Lyrics Scraper Fatal]', err);
    return res.status(500).json({ error: 'Lyrics scraping failed' });
  }
};
