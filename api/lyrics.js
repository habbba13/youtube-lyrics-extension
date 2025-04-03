const fetch = require('node-fetch'); // Ensure fetch is included

module.exports = async (req, res) => {
    try {
        console.log("API Request Received:", req.query);

        // CORS Headers
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
            return res.status(200).end();
        }

        // Validate query parameter
        const { title } = req.query;
        if (!title) {
            return res.status(400).json({ error: "Missing title parameter" });
        }

        const apiKey = "9pHpHyX2c4Bq-nBYSOIXM2Gzr9ANd0vcAOsCjfb7IQ5Wk3NjTcrUZOvHHAcDtH1d"; // Replace with your Genius API key
        const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(title)}`;

        console.log("Fetching lyrics from Genius API...");
        const response = await fetch(`https://api.genius.com/search?q=${encodeURIComponent(title)}`, {
            headers: { Authorization: `9pHpHyX2c4Bq-nBYSOIXM2Gzr9ANd0vcAOsCjfb7IQ5Wk3NjTcrUZOvHHAcDtH1d` }
        });

        console.log("Genius API Response Status:", response.status);
        if (!response.ok) {
            throw new Error(`Genius API Error: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("Genius API Data:", data);

        if (!data.response.hits.length) {
            return res.status(404).json({ error: "Lyrics not found" });
        }

        // Extract first song result URL
        const lyricsUrl = data.response.hits[0].result.url;
        return res.status(200).json({ lyricsUrl });

    } catch (error) {
        console.error("Server Error:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};
