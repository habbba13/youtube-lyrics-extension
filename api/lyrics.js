const fetch = require('node-fetch');
const Redis = require('@upstash/redis');

const redis = Redis.Redis.fromEnv();

function cleanTitle(title) {
  return title
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\s*\/\s*/g, ' ')
    // .replace(/[-_]+/g, ' ') // we keep dashes!
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Removes common suffixes from channel names like “Yeat Music”
function stripSuffixes(name) {
  const stopwords = ['music', 'tv', 'channel', 'media', 'records'];
  const words = name.toLowerCase().split(' ');
  const filtered = words.filter(word => !stopwords.includes(word));
  return filtered.join(' ').trim();
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
  if (id) await redis.set(key, id);
  return id;
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
  const parts = cleanedTitle.split('-').map(p => p.trim().toLowerCase());

  if (parts.length >= 2) {
    rawArtist = parts[0];
    rawSong = parts.slice(1).join(' ');
  } else {
    // Smarter fallback if no dash is present
    const words = cleanedTitle.toLowerCase().split(' ');
    if (words.length >= 3) {
      rawArtist = words.slice(0, 2).join(' ');
      rawSong = words.slice(2).join(' ');
    } else if (words.length === 2) {
      rawArtist = words[0];
      rawSong = words[1];
    } else {
      rawArtist = cleanedTitle.toLowerCase();
      rawSong = '';
    }
  }

  // ✅ Clean common suffixes in artist name
  rawArtist = rawArtist
    .replace(/\bmusic\b|\bofficial\b|\bvevo\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  console.log('[Cleaned]', { rawArtist, rawSong });

  try {
    const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(cleanedTitle)}`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const searchData = await searchRes.json();
    const hits = searchData?.response?.hits || [];

    const songHits = hits.filter(hit =>
      hit.type === "song" &&
      hit.index === "song" &&
      !/translations|traducciones|traducao|перевод|переклад/i.test(hit.result.primary_artist.name)
    );

    console.log('[Filtered Song Hits]');
    songHits.forEach((hit, i) => {
      const artist = hit.result.primary_artist.name;
      const songTitle = hit.result.title;
      console.log(`[${i}] ${artist} - ${songTitle}`);
    });

    const bestMatch = songHits.find(hit =>
      rawSong &&
      hit.result.primary_artist.name.toLowerCase().includes(rawArtist) &&
      hit.result.title.toLowerCase().includes(rawSong)
    ) || songHits[0];

    if (bestMatch) {
      const songId = bestMatch.result.id;
      const songUrl = bestMatch.result.url;
      console.log('[Resolved]', songUrl);
      return res.status(200).json({ lyricsUrl: songUrl });
    }

    console.warn('[Fallback Failed: No match]');
    return res.status(404).json({ error: 'Lyrics not found' });

  } catch (err) {
    console.error('Lyrics API error:', err);
    return res.status(500).json({ error: 'Lyrics lookup failed' });
  }
};
