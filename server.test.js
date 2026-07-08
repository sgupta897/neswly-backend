const request = require('supertest');
const app = require('./server'); // Import the Express app

describe('News API Endpoints', () => {
    it('GET /api/news/trending should return 503 or 200 with an array of articles containing summaries', async () => {
        const res = await request(app).get('/api/news/trending');
        
        // Since cache is empty at startup, it might return 503 initially.
        // We will assert on either a successful fetch or the expected loading state.
        expect([200, 503]).toContain(res.statusCode);

        if (res.statusCode === 200) {
            expect(Array.isArray(res.body)).toBeTruthy();
            expect(res.body.length).toBeGreaterThan(0);
            
            // Check the structure of the first article
            const article = res.body[0];
            expect(article).toHaveProperty('title');
            expect(article).toHaveProperty('description');
            expect(article).toHaveProperty('summary');
            expect(article).toHaveProperty('url');
            
            // Validate the summary logic
            expect(typeof article.summary).toBe('string');
            expect(article.summary.split(' ').length).toBeLessThanOrEqual(55); // ~50 words + slight variance
        } else if (res.statusCode === 503) {
            expect(res.body).toHaveProperty('error');
            expect(res.body.error).toContain('still loading');
        }
    }, 30000); // 30 second timeout for fetching external RSS feeds
});
