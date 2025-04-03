import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing Genius URL' });
  }

  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);

    // Genius uses data-lyrics-container spans now
    const lyricsElements = $('[data-lyrics-container]');
    const lyrics = lyricsElements
      .map((_, el) => $(el).text())
      .get()
      .join('\n\n');

    if (!lyrics) {
      return res.status(404).json({ error: 'Lyrics not found on page' });
    }

    res.status(200).json({ lyrics });
  } catch (err) {
    console.error('Failed to scrape lyrics:', err);
    res.status(500).json({ error: 'Failed to fetch or parse lyrics' });
  }
}
