
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { title } = req.query;
  if (!title) {
    return res.status(400).json({ error: 'Missing title parameter' });
  }

  const accessToken = process.env.GENIUS_ACCESS_TOKEN;

  // Clean raw input
  const cleanedTitle = title
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/\s*\/\s*/g, " ")
    .replace(/[-_]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(cleanedTitle)}`;
  const searchArtist = title.split("-")[0].toLowerCase().trim();
  const searchTitle = title.split("-")[1]?.toLowerCase().trim() || "";

  try {
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const searchData = await searchRes.json();
    const hits = (searchData?.response?.hits || []).filter(hit => hit.type === "song");

    console.log('[Cleaned Title]', cleanedTitle);
    console.log('[Filtered Genius Song Hits]', hits.map(h => h.result.full_title));

    if (!hits.length) {
      return res.status(404).json({ error: 'No valid song hits from Genius' });
    }

    // Fuzzy match artist + song title
    const strongMatch = hits.find(hit => {
      const titleText = hit.result.title_with_featured.toLowerCase();
      const artistText = hit.result.primary_artist.name.toLowerCase();
      return (
        titleText.includes(searchTitle) &&
        (artistText.includes(searchArtist) || titleText.includes(searchArtist))
      );
    });

    const finalResult = strongMatch || hits[0];
    const songId = finalResult.result.id;

    const songRes = await fetch(`https://api.genius.com/songs/${songId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const songData = await songRes.json();
    const canonicalUrl = songData?.response?.song?.url;

    if (!canonicalUrl) {
      return res.status(404).json({ error: 'No canonical URL found' });
    }

    console.log('[Resolved Canonical URL]', canonicalUrl);
    res.status(200).json({ lyricsUrl: canonicalUrl });
  } catch (err) {
    console.error("Lyrics fetch error:", err);
    res.status(500).json({ error: 'Server error fetching lyrics' });
  }
};
