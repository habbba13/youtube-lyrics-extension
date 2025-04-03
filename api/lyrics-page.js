const fetch = require('node-fetch');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing Genius URL' });
  }

  const apiKey = process.env.SCRAPER_API_KEY;
  const scraperUrl = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(url)}`;

  try {
    const response = await fetch(scraperUrl);
    const html = await response.text();
    const $ = cheerio.load(html);

    // First try new Genius layout
    const lyricsContainers = $('[data-lyrics-container]');

    let lyrics = lyricsContainers
      .find('span')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(line => line && !/contributors|translations/i.test(line)) // 🧽 filter junk
      .join('\n\n');

    // Fallback for older layout
    if (!lyrics) {
      lyrics = $('.lyrics').text().trim();
    }

    if (!lyrics) {
      return res.status(404).json({ error: 'Lyrics not found on page' });
    }

    res.status(200).json({ lyrics });
  } catch (err) {
    console.error('ScraperAPI error:', err);
    res.status(500).json({ error: 'Failed to scrape lyrics with ScraperAPI' });
  }
};
