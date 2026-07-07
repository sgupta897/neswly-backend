require('dotenv').config();
const { generateTrivia } = require('./trivia_api');

async function run() {
    const articles = [
        { title: 'Tech Stocks Rise', summary: 'Apple and Google saw a 5% increase today.', url: 'http://example.com/1' },
        { title: 'New Planet Discovered', summary: 'Scientists found an Earth-like planet.', url: 'http://example.com/2' }
    ];
    console.log("Testing generateTrivia with local .env...");
    const result = await generateTrivia(articles);
    console.log(result[0]); // Print first question
}

run();
