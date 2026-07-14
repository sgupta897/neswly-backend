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
const { generateTrivia } = require('./trivia_api');

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
app.get('/api/trivia/trending', async (req, res) => {
    try {
        const questions = await generateTrivia();
        res.json(questions);
    } catch (error) {
        console.error('Trivia generation error:', error);
        res.status(500).json({ error: 'Failed to generate trivia.' });
    }
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
