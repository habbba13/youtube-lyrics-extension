const fetch = require('node-fetch');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
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
    let lyrics = $('[data-lyrics-container]')
      .map((_, el) => $(el).text())
      .get()
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
