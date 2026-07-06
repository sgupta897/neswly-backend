const { GoogleGenAI } = require('@google/genai');

async function generateTrivia(articles) {
    if (!process.env.GEMINI_API_KEY) {
        console.warn("GEMINI_API_KEY is not set in .env. Returning mock trivia for now.");
        return getMockTrivia();
    }
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    // We want to give the AI enough variety, so pass the top 15 articles to pick from
    const selectedArticles = articles.slice(0, 15);
    const context = selectedArticles.map((a, i) => `Article ${i+1}:\nTitle: ${a.title}\nSummary: ${a.summary}\nURL: ${a.url}`).join('\n\n');
    
    const prompt = `You are a trivia generator. Based on the following news articles, generate exactly 50 multiple-choice questions. 
Respond ONLY with a valid JSON array of exactly 50 objects. 
Each object must have the following schema:
- "question": string (the question text. IMPORTANT: Do NOT include question numbers like '1.', 'Q2:', etc.)
- "options": array of 4 string choices
- "correctAnswer": integer (0 to 3) representing the index of the correct option
- "articleUrl": string (the URL of the article the question is based on)

Articles:
${context}
`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });
        const text = response.text;
        const data = JSON.parse(text);
        
        // Ensure we only return 50
        return data.slice(0, 50);
    } catch (e) {
        console.error("Error generating trivia with AI:", e.message);
        return getMockTrivia();
    }
}

function getMockTrivia() {
    return Array.from({ length: 50 }, (_, i) => ({
        question: `What is the capital of France? (Mock data - Add GEMINI_API_KEY for real AI questions)`,
        options: ["London", "Berlin", "Paris", "Madrid"],
        correctAnswer: 2,
        articleUrl: "https://example.com"
    }));
}

module.exports = { generateTrivia };
