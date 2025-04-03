const fetch = require('node-fetch');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing Genius URL' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/89.0.4389.82 Safari/537.36'
      }
    });

    const html = await response.text();
    const $ = cheerio.load(html);

    // First: try new method
    let lyrics = $('[data-lyrics-container]')
      .map((_, el) => $(el).text())
      .get()
      .join('\n\n');

    // Fallback: try old method
    if (!lyrics) {
      lyrics = $('.lyrics').text().trim();
    }

    if (!lyrics) {
      return res.status(404).json({ error: 'Lyrics not found on page' });
    }

    res.status(200).json({ lyrics });
  } catch (err) {
    console.error('Failed to scrape lyrics:', err);
    res.status(500).json({ error: 'Failed to fetch or parse lyrics' });
  }
};

