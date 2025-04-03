import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing URL parameter' });
  }

  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);

    // Genius now uses data-lyrics-container spans
    const lyricsElements = $('[data-lyrics-container]');
    const lyrics = lyricsElements
      .map((_, el) => $(el).text())
      .get()
      .join('\n\n');

    if (!lyrics) {
      return res.status(404).json({ error: 'Lyrics not found on page' });
    }

    res.status(200).json({ lyrics });
  } catch (error) {
    console.error('Error fetching lyrics page:', error);
    res.status(500).json({ error: 'Failed to fetch or parse lyrics' });
  }
}
