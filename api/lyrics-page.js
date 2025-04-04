const fetch = require('node-fetch');
const cheerio = require('cheerio');

const fetchWithTimeout = (url, options = {}, timeout = 10000) =>
  Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out')), timeout)
    )
  ]);

async function tryFetchLyrics(scraperUrl) {
  const response = await fetchWithTimeout(scraperUrl);
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
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing Genius URL' });

  const apiKey = process.env.SCRAPER_API_KEY;
  const baseUrl = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(url)}`;

  try {
    console.log('[Scraping with render=false]', url);
    let lyrics = await tryFetchLyrics(`${baseUrl}&render=false`);

    if (!lyrics) {
      console.warn('[Retrying with render=true]');
      lyrics = await tryFetchLyrics(`${baseUrl}&render=true`);
    }

    if (!lyrics) {
      console.warn('[No Lyrics Found]');
      return res.status(404).json({ error: 'Lyrics not found on page' });
    }

    return res.status(200).json({ lyrics });
  } catch (err) {
    console.error('[ScraperAPI Error]', err.message);
    return res.status(500).json({ error: 'Failed to scrape lyrics from Genius' });
  }
};
