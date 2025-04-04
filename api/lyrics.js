
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const artistMapFile = path.resolve(__dirname, 'artistMap.json');
let artistMap = {
  "lil tecca": 213210,
  "yeat": 2193783,
  "drake": 130,
  "kendrick lamar": 1421,
  "gunnr": 1309438
};

// Load dynamic artist map from JSON
try {
  if (fs.existsSync(artistMapFile)) {
    const data = fs.readFileSync(artistMapFile, 'utf-8');
    const parsed = JSON.parse(data);
    artistMap = { ...artistMap, ...parsed };
  }
} catch (err) {
  console.warn('Failed to load artistMap.json:', err.message);
}

function cleanTitle(title) {
  return title
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\s*\/\s*/g, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function saveNewArtist(name, id) {
  const current = fs.existsSync(artistMapFile) ? JSON.parse(fs.readFileSync(artistMapFile)) : {};
  if (!current[name]) {
    current[name] = id;
    fs.writeFileSync(artistMapFile, JSON.stringify(current, null, 2));
    console.log('[ArtistMap Updated]', name, id);
  }
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  const { title } = req.query;
  if (!title) return res.status(400).json({ error: 'Missing title parameter' });

  const accessToken = process.env.GENIUS_ACCESS_TOKEN;

  let rawArtist = '', rawSong = '';
  if (title.includes('-')) {
    [rawArtist, rawSong] = title.split('-').map(p => cleanTitle(p.toLowerCase()));
  } else {
    rawArtist = cleanTitle(title.toLowerCase());
  }

  console.log('[Cleaned]', { rawArtist, rawSong });

  try {
    const cleanedSearch = cleanTitle(title);
    const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(cleanedSearch)}&t=${Date.now()}`;
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

    const firstArtist = songHitsOnly[0]?.result?.primary_artist;
    if (firstArtist && !artistMap[rawArtist]) {
      saveNewArtist(rawArtist, firstArtist.id);
    }

    let songHit = songHitsOnly.find(hit =>
      rawSong &&
      hit.result.primary_artist.name.toLowerCase().includes(rawArtist) &&
      hit.result.title.toLowerCase().includes(rawSong)
    );

    if (!songHit && songHitsOnly.length > 0 && !rawSong) {
      songHit = songHitsOnly[0];
      console.log('[Fallback to Top Hit]', songHit.result.full_title);
    }

    if (songHit) {
      const songId = songHit.result.id;
      const songRes = await fetch(`https://api.genius.com/songs/${songId}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const songData = await songRes.json();
      const songUrl = songData?.response?.song?.url;
      console.log('[Resolved]', songUrl);
      return res.status(200).json({ lyricsUrl: songUrl });
    }

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
