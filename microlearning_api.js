const { GoogleGenAI } = require('@google/genai');
const axios = require('axios');

async function getPexelsVideo(query) {
    if (!process.env.PEXELS_API_KEY) {
        console.warn('PEXELS_API_KEY not found in .env. Using fallback video.');
        return {
            videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
            thumbnailUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg'
        };
    }
    try {
        const res = await axios.get(`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&size=medium&per_page=1`, {
            headers: { Authorization: process.env.PEXELS_API_KEY }
        });
        if (res.data.videos && res.data.videos.length > 0) {
            const videoData = res.data.videos[0];
            const videoFiles = videoData.video_files;
            if (videoFiles && videoFiles.length > 0) {
                // sort to get a decent mobile resolution
                videoFiles.sort((a, b) => b.height - a.height);
                return {
                    videoUrl: videoFiles[0].link,
                    thumbnailUrl: videoData.image
                };
            }
        }
    } catch(e) {
        console.error('Pexels API error:', e.message);
    }
    return {
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        thumbnailUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg'
    };
}

async function generateDailyFeed() {
    if (!process.env.GEMINI_API_KEY) {
        console.error("GEMINI_API_KEY is not set in .env.");
        throw new Error("Missing GEMINI_API_KEY");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const prompt = `Generate 4 micro-lessons for a daily learning app. The subjects are Personal Finance, Art, AI, and Logic.
For each lesson, provide:
- "id": a unique string ID (e.g., "art-renaissance-1")
- "subject": exactly one of "Personal Finance", "Art", "AI", "Logic"
- "title": A catchy title
- "script": An engaging, fascinating 50-70 word script suitable for a TikTok/Reels style video voiceover. Keep it fast-paced and interesting.
- "videoSearchTerm": A 1-2 word search term that would return a relevant aesthetic background video on a stock site (e.g. "money", "painting", "robot", "chess").
- "quiz": exactly 3 multiple-choice trivia questions based strictly on the script. Each question must have:
    - "question" (string)
    - "options" (array of 4 strings)
    - "correctAnswer" (integer 0-3)
    - "explanation" (string)

Respond ONLY with a valid JSON array of these 4 lesson objects.`;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });
        const text = response.text;
        const lessons = JSON.parse(text);
        
        // Enhance with Pexels videos
        for (const lesson of lessons) {
            const media = await getPexelsVideo(lesson.videoSearchTerm);
            lesson.videoUrl = media.videoUrl;
            lesson.thumbnailUrl = media.thumbnailUrl;
        }
        
        return lessons;
    } catch (e) {
        console.error("Error generating daily feed with AI:", e.message);
        throw e;
    }
}

module.exports = { generateDailyFeed };
