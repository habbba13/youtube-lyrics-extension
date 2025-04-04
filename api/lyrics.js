
const fetch = require('node-fetch');

function cleanTitle(title) {
  return title
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\s*\/\s*/g, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { title } = req.query;
  if (!title) return res.status(400).json({ error: 'Missing title parameter' });

  const accessToken = process.env.GENIUS_ACCESS_TOKEN;
  const cleanedTitle = cleanTitle(title);
  const [rawArtist, rawSong] = cleanedTitle.split("-").map(part => part.trim().toLowerCase());

  try {
    // Step 1: Full search using full title
    const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(cleanedTitle)}`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const searchData = await searchRes.json();

    const songHits = searchData?.response?.hits || [];

    console.log('[Search Hits Returned]');
    songHits.forEach((hit, i) => {
      const artist = hit.result.primary_artist.name;
      const title = hit.result.title_with_featured || hit.result.full_title;
      console.log(`[${i}] ${artist} - ${title}`);
    });

    // Step 2: Force match only hits from correct artist
    const matchHit = songHits.find(hit =>
      hit.type === "song" &&
      hit.result.primary_artist.name.toLowerCase().includes(rawArtist)
    );

    if (!matchHit) {
      console.warn('[No artist match found from full query]');
      return res.status(404).json({ error: 'Artist not found from query' });
    }

    const artistId = matchHit.result.primary_artist.id;

    // Step 3: Use artist ID to list songs and match fuzzy title
    const artistSongsUrl = `https://api.genius.com/artists/${artistId}/songs?per_page=50&sort=title`;
    const songsRes = await fetch(artistSongsUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const songsData = await songsRes.json();
    const songs = songsData?.response?.songs || [];

    console.log('[Artist Songs]', songs.map(s => s.title));

    const match = songs.find(song =>
      song.title.toLowerCase().includes("number 2") ||
      song.title.toLowerCase().includes("never last")
    );

    if (!match) {
      return res.status(404).json({ error: 'No matching song found from artist' });
    }

    console.log('[Resolved Canonical URL]', match.url);
    res.status(200).json({ lyricsUrl: match.url });

  } catch (err) {
    console.error("Lyrics API error:", err);
    res.status(500).json({ error: 'Lyrics lookup failed' });
  }
};
