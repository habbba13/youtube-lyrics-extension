
const fetch = require('node-fetch');

const artistMap = {
  "lil tecca": 213210,
  "yeat": 2193783,
  "drake": 130,
  "kendrick lamar": 1421
};

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
  res.setHeader("Cache-Control", "no-store");

  const { title } = req.query;
  if (!title) return res.status(400).json({ error: 'Missing title parameter' });

  const accessToken = process.env.GENIUS_ACCESS_TOKEN;
  const cleanedTitle = cleanTitle(title);

  let rawArtist = '', rawSong = '';
  if (cleanedTitle.includes('-')) {
    [rawArtist, rawSong] = cleanedTitle.split('-').map(p => p.trim().toLowerCase());
  } else {
    rawArtist = cleanedTitle.toLowerCase();
  }

  console.log('[Cleaned]', { rawArtist, rawSong });

  try {
    const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(cleanedTitle)}&t=${Date.now()}`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const searchData = await searchRes.json();
    const hits = searchData?.response?.hits || [];

    const songHitsOnly = hits.filter(hit => hit.type === "song" && hit.index === "song");

    console.log('[Filtered Song Hits]');
    songHitsOnly.forEach((hit, i) => {
      const artist = hit.result.primary_artist.name;
      const songTitle = hit.result.title;
      console.log(`[${i}] ${artist} - ${songTitle}`);
    });

    const songHit = songHitsOnly.find(hit =>
      rawSong &&
      hit.result.primary_artist.name.toLowerCase().includes(rawArtist) &&
      hit.result.title.toLowerCase().includes(rawSong)
    );

    if (songHit) {
      const songId = songHit.result.id;
      const songRes = await fetch(`https://api.genius.com/songs/${songId}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const songData = await songRes.json();
      const songUrl = songData?.response?.song?.url;
      console.log('[Resolved via Filtered Search]', songUrl);
      return res.status(200).json({ lyricsUrl: songUrl });
    }

    // Fallback if artistMap has an entry
    const artistId = artistMap[rawArtist];
    if (!artistId) {
      console.warn('[Fallback Failed: No artistMap match]');
      return res.status(404).json({ error: 'Lyrics not found and no fallback available' });
    }

    const artistSongsUrl = `https://api.genius.com/artists/${artistId}/songs?per_page=50&sort=title`;
    const songsRes = await fetch(artistSongsUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const songsData = await songsRes.json();
    const songs = songsData?.response?.songs || [];

    console.log('[Fallback Artist Songs]', songs.map(s => s.title));

    const match = songs.find(song =>
      song.title.toLowerCase().includes(rawSong || '')
    );

    if (!match) {
      console.warn('[Fallback Failed: No title match]');
      return res.status(404).json({ error: 'Lyrics not found from artist fallback' });
    }

    console.log('[Resolved via Fallback]', match.url);
    return res.status(200).json({ lyricsUrl: match.url });

  } catch (err) {
    console.error("Lyrics API error:", err);
    return res.status(500).json({ error: 'Lyrics lookup failed' });
  }
};
