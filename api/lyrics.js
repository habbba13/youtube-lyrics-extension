const fetch = require('node-fetch');
const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

function cleanTitle(title) {
  return title
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\s*\/\s*/g, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

async function getArtistId(artistName) {
  const key = `artist:${artistName}`;
  const cachedId = await redis.get(key);
  if (cachedId) return cachedId;

  const fallbackMap = {
    "lil tecca": 213210,
    "yeat": 2193783,
    "drake": 130,
    "kendrick lamar": 1421,
    "gunnr": 1309438
  };

  const id = fallbackMap[artistName];
  if (id) {
    await redis.set(key, id);
  }

  return id;
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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

    const songHitsOnly = hits.filter(hit =>
      hit.type === "song" &&
      hit.index === "song" &&
      !/translations|traducciones|traducao|перевод|переклад/i.test(hit.result.primary_artist.name)
    );

    console.log('[Filtered Song Hits]');
    songHitsOnly.forEach((hit, i) => {
      const artist = hit.result.primary_artist.name;
      const songTitle = hit.result.title;
      console.log(`[${i}] ${artist} - ${songTitle}`);
    });

    const songHit = songHitsOnly.find(hit => {
      const artistMatch = hit.result.primary_artist.name.toLowerCase().includes(rawArtist);
      const songMatch = rawSong ? hit.result.title.toLowerCase().includes(rawSong) : true;
      return artistMatch && songMatch;
    });

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

    const artistId = await getArtistId(rawArtist);
    if (!artistId) {
      console.warn('[Fallback Failed: No artist ID found]');
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

