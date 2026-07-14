const { GoogleGenAI } = require('@google/genai');

let cachedTrivia = null;
let lastFetchTime = 0;
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

async function generateTrivia() {
    const now = Date.now();
    if (cachedTrivia && (now - lastFetchTime < CACHE_DURATION_MS)) {
        console.log("Serving trivia from cache");
        return cachedTrivia;
    }

    if (!process.env.GEMINI_API_KEY) {
        console.error("GEMINI_API_KEY is not set in .env.");
        throw new Error("Missing GEMINI_API_KEY");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const prompt = `Generate exactly 10 unique, fascinating, and diverse geography challenges. Include a mix of the following categories:
1. Cultural & Historical: Where historical events happened, or the origin of specific cuisines/traditions.
2. Non-Traditional Geography: Locations of animal migration paths, specific mountain ranges, or river paths.
3. Classic Geo: Hidden gems, major landmarks, famous monuments, or natural wonders.
Vary the difficulty and locations wildly across the globe. Do not repeat the same regions often.

For each challenge, provide:
- "question" (string): The trivia challenge asking the user to locate it on a map, e.g. "Tap where the battle of Waterloo occurred" or "Where does the Monarch butterfly migrate to in winter?" or "Tap the source of the Amazon River."
- "targetLat" (number): The exact latitude of the location (or start point if it's a path).
- "targetLng" (number): The exact longitude of the location (or start point if it's a path).
- "pathEndLat" (number, optional): If the question is about a path (migration, river), the exact latitude of the end point. Omit if it is a single point.
- "pathEndLng" (number, optional): If the question is about a path (migration, river), the exact longitude of the end point. Omit if it is a single point.
- "targetCountry" (string): The country (or Ocean/Region/Path name).
- "explanation" (string): A short 1-sentence fun fact about this event/location.

Respond ONLY with a valid JSON array containing exactly 10 of these question objects.`;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt + "\nRandom generation seed: " + Math.random(),
            config: {
                responseMimeType: "application/json",
                temperature: 1.5,
            }
        });
        const text = response.text;
        const questions = JSON.parse(text);
        
        cachedTrivia = questions;
        lastFetchTime = Date.now();
        
        return questions;
    } catch (e) {
        console.error("Error generating trivia with AI:", e.message);
        throw e;
    }
}

module.exports = { generateTrivia };
