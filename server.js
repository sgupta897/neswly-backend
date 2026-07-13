require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');

const app = express();
app.use(helmet());
app.use(cors());

const { initAppwrite, sendNewsNotification } = require('./appwrite_messaging');
const { generateDailyFeed } = require('./microlearning_api');

// Rate Limiting: Max 100 requests per 15 minutes per IP
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Cache for microlearning data
const cache = new NodeCache({ stdTTL: 0 });

const PORT = process.env.PORT || 3000;

// Root Health Check Route
app.get('/', (req, res) => {
    res.send('Microlearning API Backend is running successfully!');
});

// Privacy Policy Route
app.get('/privacy', (req, res) => {
    res.sendFile(path.join(__dirname, 'privacy.html'));
});

// Trivia API Route (Geography Map Quiz)
app.get('/api/trivia/trending', (req, res) => {
    const geographyQuestions = [
        { question: "Where is Japan?", targetLat: 36.2048, targetLng: 138.2529, targetCountry: "Japan", explanation: "Japan is an island country in East Asia." },
        { question: "Where is Brazil?", targetLat: -14.2350, targetLng: -51.9253, targetCountry: "Brazil", explanation: "Brazil is the largest country in South America." },
        { question: "Where is the Eiffel Tower (France)?", targetLat: 48.8584, targetLng: 2.2945, targetCountry: "France", explanation: "The Eiffel Tower is in Paris, France." },
        { question: "Where is Australia?", targetLat: -25.2744, targetLng: 133.7751, targetCountry: "Australia", explanation: "Australia is the largest country in Oceania." },
        { question: "Where is Egypt?", targetLat: 26.8206, targetLng: 30.8025, targetCountry: "Egypt", explanation: "Egypt is home to the Great Pyramids of Giza." },
        { question: "Where is the United States?", targetLat: 37.0902, targetLng: -95.7129, targetCountry: "United States", explanation: "The USA spans across North America." },
        { question: "Where is India?", targetLat: 20.5937, targetLng: 78.9629, targetCountry: "India", explanation: "India is located in South Asia." }
    ];
    res.json(geographyQuestions);
});

// Microlearning API Route
app.get('/api/microlearning/daily-feed', async (req, res) => {
    let data = cache.get('dailyFeed');
    if (data) {
        return res.json(data);
    }
    
    try {
        console.log('Cache miss for daily feed, generating on-demand...');
        data = await generateDailyFeed();
        cache.set('dailyFeed', data);
        return res.json(data);
    } catch (err) {
        console.error('Failed to generate daily feed on-demand:', err.message);
        res.status(500).json({ error: 'Failed to generate microlearning feed.' });
    }
});

// Background refresh task
async function refreshCache() {
    console.log('--- Starting Background Cache Refresh for Microlearning ---');
    try {
        const feed = await generateDailyFeed();
        cache.set('dailyFeed', feed);
        console.log('--- Successfully cached new daily microlearning feed ---');
    } catch (e) {
        console.error('Background cache refresh failed:', e.message);
    }
}

// Start Server
if (require.main === module) {
    app.listen(PORT, async () => {
        console.log(`Microlearning API backend is running on http://localhost:${PORT}`);
        initAppwrite();
        await refreshCache();
        setInterval(refreshCache, 24 * 60 * 60 * 1000); // Refresh once a day
    });
}
module.exports = app;
