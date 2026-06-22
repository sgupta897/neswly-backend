const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Parser = require('rss-parser');
const NodeCache = require('node-cache');
const axios = require('axios');

const app = express();
app.use(helmet());
app.use(cors());

const { initAppwrite, sendNewsNotification } = require('./appwrite_messaging');

// Rate Limiting: Max 100 requests per 15 minutes per IP
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Cache for 10 minutes (600 seconds)
const cache = new NodeCache({ stdTTL: 600 });
const parser = new Parser({
    customFields: {
        item: [
            ['media:content', 'media:content'],
            ['media:thumbnail', 'media:thumbnail'],
        ]
    }
});

const PORT = process.env.PORT || 3000;

// Helper to extract image from RSS item
async function extractImage(item) {
    // Generate a unique but consistent placeholder for each article using its title
    const seed = encodeURIComponent(item.title ? item.title.substring(0, 20) : Math.random().toString());
    const defaultPlaceholder = `https://picsum.photos/seed/${seed}/400/300`;

    // 1. Prioritize HTML img src over everything else as it's usually the highest res
    const imgRegex = /<img[^>]+src=["']([^"']+)["']/i;
    let htmlImg = null;
    if (item['content:encoded']) htmlImg = item['content:encoded'].match(imgRegex);
    if (!htmlImg && item.content) htmlImg = item.content.match(imgRegex);
    if (!htmlImg && item.contentSnippet) htmlImg = item.contentSnippet.match(imgRegex);
    if (htmlImg && htmlImg[1]) return htmlImg[1];

    // 2. Next best is media:content
    if (item['media:content'] && item['media:content']['$'] && item['media:content']['$'].url) {
        return item['media:content']['$'].url;
    }
    
    // 3. Enclosures are usually good
    if (item.enclosure && item.enclosure.url) {
        return item.enclosure.url;
    }

    // 4. Fallback to tiny thumbnails only if absolutely nothing else exists
    if (item['media:thumbnail'] && item['media:thumbnail']['$'] && item['media:thumbnail']['$'].url) {
        return item['media:thumbnail']['$'].url;
    }

    // 5. Scrape og:image from the article URL if no image was found in the RSS feed
    if (item.link) {
        try {
            const res = await axios.get(item.link, { timeout: 3000 });
            let match = res.data.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
            if (!match) {
                match = res.data.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
            }
            if (match && match[1]) {
                return match[1];
            }
        } catch (e) {
            // Ignore error, fallback to placeholder
        }
    }

    return defaultPlaceholder;
}

// Helper to generate a local 50-word summary from raw RSS content
function generateLocalSummary(item) {
    let rawText = item['content:encoded'] || item.content || item.contentSnippet || '';
    
    // Strip HTML tags and normalize whitespace
    let cleanText = rawText.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
    
    // Fallback if publisher provided no text
    if (!cleanText || cleanText.length < 10) {
        return "Summary not provided by the publisher. Tap 'Read Full Article' to view the content on their website.";
    }

    // Decode common HTML entities
    cleanText = cleanText
        .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#8217;/g, "'")
        .replace(/&#8216;/g, "'").replace(/&#8220;/g, '"').replace(/&#8221;/g, '"')
        .replace(/&nbsp;/g, ' ');

    // Split into words
    const words = cleanText.split(' ');
    if (words.length <= 50) return cleanText;

    // Truncate cleanly around 50 words
    let summary = words.slice(0, 50).join(' ');
    
    // Try to end on a complete sentence if there's punctuation in the latter half
    const lastPunctuation = Math.max(summary.lastIndexOf('.'), summary.lastIndexOf('!'), summary.lastIndexOf('?'));
    if (lastPunctuation > 100) { // arbitrary length to ensure it doesn't cut off too early
        summary = summary.substring(0, lastPunctuation + 1);
    } else {
        summary += '...';
    }
    return summary;
}

// Helper to parse dates robustly
function parseDate(item) {
    if (item.isoDate) return item.isoDate;
    if (item.pubDate) {
        // Try parsing directly
        let d = new Date(item.pubDate);
        if (!isNaN(d.getTime())) return d.toISOString();
        
        // Handle common RSS timezone strings that Node.js struggles with
        let cleaned = item.pubDate
            .replace('BST', '+0100')
            .replace('EDT', '-0400')
            .replace('EST', '-0500')
            .replace('PDT', '-0700')
            .replace('PST', '-0800')
            .replace('IST', '+0530');
            
        d = new Date(cleaned);
        if (!isNaN(d.getTime())) return d.toISOString();
    }
    return new Date().toISOString();
}

// Helper to clean up long SEO-filled RSS feed titles
function cleanSourceName(rawName) {
    if (!rawName) return 'RSS Feed';
    let clean = rawName;
    clean = clean.split(' | ')[0]; // e.g. "NDTV | Latest"
    clean = clean.split(' - ')[0]; // e.g. "The Hindu - India"
    clean = clean.split(':')[0];   // e.g. "The Hindu: Latest News"
    clean = clean.replace(/ Latest News.*/i, '');
    clean = clean.replace(/ Top Stories.*/i, '');
    clean = clean.replace(/ News.*/i, '');
    return clean.trim() || 'RSS Feed';
}

// Fetch and format a list of RSS URLs
async function fetchFeeds(urls) {
    const fetchPromises = urls.map(async (url) => {
        try {
            console.log(`Fetching: ${url}`);
            const feed = await parser.parseURL(url);
            const articlesPromises = feed.items.map(async item => ({
                title: item.title || 'No Title',
                description: (item.contentSnippet || item.content || '').replace(/<[^>]*>?/gm, ' ').substring(0, 200).trim() + '...',
                summary: generateLocalSummary(item),
                url: item.link || '',
                urlToImage: await extractImage(item),
                publishedAt: parseDate(item),
                source: { name: cleanSourceName(feed.title) }
            }));
            return Promise.all(articlesPromises);
        } catch (error) {
            console.error(`Error fetching ${url}:`, error.message);
            return [];
        }
    });

    const results = await Promise.all(fetchPromises);
    
    // 1. Sort each individual feed's articles from newest to oldest
    results.forEach(feedArticles => {
        feedArticles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    });

    // 2. Round-Robin Shuffle: Take the 1st newest from everyone, then 2nd newest, etc.
    // This perfectly mixes publishers without bringing old articles to the top!
    let combined = [];
    let hasMore = true;
    let index = 0;

    while (hasMore) {
        hasMore = false;
        for (let i = 0; i < results.length; i++) {
            if (index < results[i].length) {
                combined.push(results[i][index]);
                hasMore = true;
            }
        }
        index++;
    }
    
    return combined;
}

// The categories and their feeds
const FEEDS = {
    trending: [
        'http://feeds.bbci.co.uk/news/rss.xml',
        'http://feeds.bbci.co.uk/news/world/rss.xml',
        'https://timesofindia.indiatimes.com/rssfeedstopstories.cms',
        'https://www.thehindu.com/feeder/default.rss'
    ],
    india: [
        'https://timesofindia.indiatimes.com/rssfeedstopstories.cms',
        'https://www.thehindu.com/feeder/default.rss',
        'https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml',
        'https://economictimes.indiatimes.com/rssfeedsdefault.cms',
        'https://indianexpress.com/feed/'
    ],
    world: [
        'http://feeds.bbci.co.uk/news/world/rss.xml',
        'https://www.aljazeera.com/xml/rss/all.xml',
        'https://rss.nytimes.com/services/xml/rss/nyt/World.xml'
    ],
    tech: [
        'https://feeds.feedburner.com/ndtvgadgets-latest',
        'https://techcrunch.com/feed/',
        'https://www.wired.com/feed/rss',
        'https://www.theverge.com/rss/index.xml'
    ],
    sports: [
        'https://www.skysports.com/rss/12040',
        'https://timesofindia.indiatimes.com/rssfeeds/4719148.cms'
    ],
    entertainment: [
        'https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml',
        'https://variety.com/feed/',
        'https://www.cinemablend.com/rss.xml',
        'https://feeds.ign.com/ign/news',
        'https://timesofindia.indiatimes.com/rssfeeds/1081479906.cms',
        'https://www.hindustantimes.com/feeds/rss/entertainment/rssfeed.xml',
        'https://indianexpress.com/section/entertainment/feed/'
    ],
    economy: [
        'https://economictimes.indiatimes.com/news/economy/rssfeeds/1373380680.cms',
        'https://www.thehindubusinessline.com/economy/feeder/default.rss',
        'https://www.livemint.com/rss/markets'
    ],
    fifa2026: [
        'https://www.espn.com/espn/rss/soccer/news',
        'https://rss.nytimes.com/services/xml/rss/nyt/Soccer.xml',
        'http://feeds.bbci.co.uk/sport/football/rss.xml'
    ]
};

// Background refresh task
let lastSeenTrendingArticleUrl = null;

async function refreshCache() {
    console.log('--- Starting Background Cache Refresh ---');
    for (const [category, urls] of Object.entries(FEEDS)) {
        console.log(`Refreshing category: ${category}`);
        const articles = await fetchFeeds(urls);
        
        if (category === 'trending' && articles.length > 0) {
            const newestArticle = articles[0];
            if (lastSeenTrendingArticleUrl && lastSeenTrendingArticleUrl !== newestArticle.url) {
                console.log('New trending article detected:', newestArticle.title);
                sendNewsNotification('Breaking News: ' + newestArticle.source.name, newestArticle.title);
            }
            lastSeenTrendingArticleUrl = newestArticle.url;
        }
        
        cache.set(category, articles);
    }
    console.log('--- Cache Refresh Complete ---');
}

// API Routes
app.get('/api/news/search', (req, res) => {
    const query = req.query.q?.toLowerCase();
    if (!query) {
        return res.status(400).json({ error: 'Search query is required' });
    }
    
    let allArticles = [];
    const keys = cache.keys();
    keys.forEach(key => {
        const categoryData = cache.get(key);
        if (Array.isArray(categoryData)) {
            allArticles = allArticles.concat(categoryData);
        }
    });

    const uniqueArticlesMap = new Map();
    allArticles.forEach(article => {
        if (!uniqueArticlesMap.has(article.url)) {
            uniqueArticlesMap.set(article.url, article);
        }
    });
    
    const uniqueArticles = Array.from(uniqueArticlesMap.values());
    const results = uniqueArticles.filter(article => 
        (article.title && article.title.toLowerCase().includes(query)) || 
        (article.summary && article.summary.toLowerCase().includes(query))
    );

    res.json(results);
});

app.get('/api/news/:category', (req, res) => {
    const category = req.params.category;
    
    // Input Validation
    if (!FEEDS[category]) {
        return res.status(400).json({ error: 'Invalid news category requested.' });
    }

    const data = cache.get(category);
    if (data) {
        return res.json(data);
    }
    // Fallback if not cached yet
    res.status(503).json({ error: 'News is still loading into cache, please try again in a few seconds.' });
});

const { getMatches, getStandings, getStats } = require('./fifa_api');

app.get('/api/fifa/matches', async (req, res) => {
    try {
        const matches = await getMatches();
        res.json(matches);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch FIFA matches' });
    }
});

app.get('/api/fifa/standings', async (req, res) => {
    try {
        const standings = await getStandings();
        res.json(standings);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch FIFA standings' });
    }
});

app.get('/api/fifa/stats', async (req, res) => {
    try {
        const stats = await getStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch FIFA stats' });
    }
});

// Start Server
if (require.main === module) {
    app.listen(PORT, async () => {
        console.log(`News API backend is running on http://localhost:${PORT}`);
        initAppwrite();
        await refreshCache();
        setInterval(refreshCache, 10 * 60 * 1000);
    });
}
module.exports = app;
