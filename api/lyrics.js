const fetch = require('node-fetch');
const { Redis } = require('@upstash/redis');

// Initialize Redis via REST for Vercel compatibility
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

function cleanTitle(title) {
  return title
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\s*\/\s*/g, ' ')
    .replace(/[_]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

async function getArtistId(artistName, accessToken) {
  const key = `artist:${artistName}`;
  const cachedId = await redis.get(key);
  if (cachedId) return cachedId;

  // Fallback hardcoded IDs
  const fallbackMap = {
    "lil tecca": 213210,
    "yeat": 2193783,
    "drake": 130,
    "kendrick lamar": 1421,
    "gunnr": 1309438
  };

  const fallbackId = fallbackMap[artistName];
  if (fallbackId) {
    await redis.set(key, fallbackId);
    return fallbackId;
  }

  // Dynamically search Genius API for artist ID
  const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(artistName)}`;
  const res = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const json = await res.json();

  const hit = json.response?.hits?.find(h => h.result.primary_artist?.name?.toLowerCase() === artistName);
  const artistId = hit?.result?.primary_artist?.id;

  if (artistId) {
    await redis.set(key, artistId);
    return artistId;
  }

  return null;
}

async function getLyricsUrlFromArtistSongs(artistId, rawSong, accessToken) {
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const res = await fetch(
      `https://api.genius.com/artists/${artistId}/songs?per_page=50&page=${page}&sort=title`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const json = await res.json();
    const songs = json.response?.songs || [];

    const match = songs.find(song =>
      song.title.toLowerCase().includes(rawSong)
    );
    if (match) return match.url;

    if (!json.response?.next_page) {
      hasMore = false;
    } else {
      page++;
    }
  }

  return null;
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === 'OPTIONS') return res.status(200).end();

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
    // Search Genius
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

    const artistId = await getArtistId(rawArtist, accessToken);
    if (!artistId) {
      console.warn('[Fallback Failed: No artist ID found]');
      return res.status(404).json({ error: 'Lyrics not found and no fallback available' });
    }

    const fallbackUrl = await getLyricsUrlFromArtistSongs(artistId, rawSong || '', accessToken);
    if (!fallbackUrl) {
      console.warn('[Fallback Failed: No title match]');
      return res.status(404).json({ error: 'Lyrics not found from artist fallback' });
    }

    console.log('[Resolved via Fallback]', fallbackUrl);
    return res.status(200).json({ lyricsUrl: fallbackUrl });

  } catch (err) {
    console.error("Lyrics API error:", err);
    return res.status(500).json({ error: 'Lyrics lookup failed' });
  }
};
