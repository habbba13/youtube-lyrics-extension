const fetch = require('node-fetch');
const { URLSearchParams } = require('url');

// Helper: Fallback artist ID map
const artistMap = {
  "lil tecca": 213210,
  "yeat": 2193783,
  "drake": 130,
  "kendrick lamar": 1421,
  "gunnr": 1309438,
  "ken carson": 637082
};

// Clean and normalize a title
function cleanTitle(title) {
  return title
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\s*\/\s*/g, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Generate alternate search variations
function generateVariants(artist, song) {
  const variants = [];
  if (song) {
    variants.push(`${artist} - ${song}`);
    variants.push(`${artist} ${song}`);
    variants.push(`${song} ${artist}`);
    variants.push(`${artist} ${song.split(' ')[0]}`);
  }
  return variants;
}

// Genius search query
async function searchGenius(query, accessToken) {
  const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(query)}`;
  const res = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.json();
}

// Fetch Genius song details by ID
async function getSongDetails(songId, accessToken) {
  const res = await fetch(`https://api.genius.com/songs/${songId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  return data?.response?.song?.url;
}

// Fallback: Scan artist songs pages
async function searchArtistSongs(rawArtist, rawSong, accessToken) {
  const artistId = artistMap[rawArtist];
  if (!artistId) return null;

  for (let page = 1; page <= 3; page++) {
    const url = `https://api.genius.com/artists/${artistId}/songs?per_page=50&sort=title&page=${page}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    const songs = data?.response?.songs || [];

    const match = songs.find(song =>
      song.title.toLowerCase().includes(rawSong)
    );
    if (match) return match.url;
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
  const cleaned = cleanTitle(title);

  let rawArtist = '', rawSong = '';
  if (cleaned.includes('-')) {
    [rawArtist, rawSong] = cleaned.split('-').map(p => p.trim().toLowerCase());
  } else {
    rawArtist = cleaned.toLowerCase();
  }

  console.log('[Cleaned]', { rawArtist, rawSong });

  try {
    const queries = generateVariants(rawArtist, rawSong || '');
    for (const q of queries) {
      const data = await searchGenius(q, accessToken);
      const hits = data?.response?.hits || [];
      const songHits = hits.filter(hit =>
        hit.type === "song" &&
        hit.index === "song" &&
        !/translations|traducciones|перевод|переклад/i.test(hit.result.primary_artist.name)
      );

      const match = songHits.find(hit =>
        hit.result.primary_artist.name.toLowerCase().includes(rawArtist) &&
        hit.result.title.toLowerCase().includes(rawSong)
      );

      if (match) {
        const songUrl = await getSongDetails(match.result.id, accessToken);
        if (songUrl) {
          console.log('[Resolved via Variant Search]', songUrl);
          return res.status(200).json({ lyricsUrl: songUrl });
        }
      }
    }

    // Fallback: scan artist pages
    const fallbackUrl = await searchArtistSongs(rawArtist, rawSong, accessToken);
    if (fallbackUrl) {
      console.log('[Resolved via Fallback]', fallbackUrl);
      return res.status(200).json({ lyricsUrl: fallbackUrl });
    }

    console.warn('[Failed to resolve any match]');
    return res.status(404).json({ error: 'Lyrics not found from all methods' });
  } catch (err) {
    console.error('Lyrics API error:', err);
    return res.status(500).json({ error: 'Lyrics lookup failed' });
  }
};
