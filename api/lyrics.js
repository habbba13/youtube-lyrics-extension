module.exports = async (req, res) => {
    try {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
            return res.status(200).end();
        }

        const { title } = req.query;
        if (!title) {
            return res.status(400).json({ error: "Missing title parameter" });
        }

        const fetch = require('node-fetch');  // Ensure fetch is required

        // Fetch lyrics from Genius (modify this part as needed)
        const response = await fetch(`https://api.genius.com/search?q=${encodeURIComponent(title)}`, {
            headers: { Authorization: `Bearer YOUR_GENIUS_ACCESS_TOKEN` }
        });

        if (!response.ok) {
            throw new Error(`Error fetching Genius API: ${response.statusText}`);
        }

        const data = await response.json();
        if (!data.response.hits.length) {
            return res.status(404).json({ error: "Lyrics not found" });
        }

        const lyricsUrl = data.response.hits[0].result.url;
        res.json({ lyricsUrl });

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};
    // Your existing API logic here
export default async function handler(req, res) {
    const { title } = req.query;  // Get song title from the request

    if (!title) {
        return res.status(400).json({ error: "Missing song title" });
    }

    const apiKey = "9pHpHyX2c4Bq-nBYSOIXM2Gzr9ANd0vcAOsCjfb7IQ5Wk3NjTcrUZOvHHAcDtH1d"; // Replace this with your Genius API key
    const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(title)}`;

    try {
        const response = await fetch(searchUrl, {
            headers: { Authorization: `Bearer ${apiKey}` }
        });
        const data = await response.json();

        if (!data.response.hits.length) {
            return res.status(404).json({ error: "Lyrics not found" });
        }

        // Get the first song result
        const songPath = data.response.hits[0].result.path;
        const lyricsPageUrl = `https://genius.com${songPath}`;

        return res.status(200).json({ lyricsUrl: lyricsPageUrl });
    } catch (error) {
        return res.status(500).json({ error: "Error fetching lyrics" });
    }
}
