const axios = require('axios');

const API_KEY = process.env.API_FOOTBALL_KEY || 'bf68f9d75cc5441d06dbd42fb779b6fb';
// Using the direct API-Sports endpoint instead of RapidAPI to save complexity
const API_HOST = 'v3.football.api-sports.io';
const WORLD_CUP_LEAGUE_ID = 15;
const SEASON = 2026;

// Helper to make API requests with caching
const cache = new Map();

async function fetchFromApi(endpoint, params = {}) {
    if (!API_KEY) {
        console.warn('API_FOOTBALL_KEY is missing. Returning mock data.');
        return getMockData(endpoint);
    }
    
    const cacheKey = endpoint + JSON.stringify(params);
    if (cache.has(cacheKey)) {
        const cached = cache.get(cacheKey);
        // Cache for 5 minutes
        if (Date.now() - cached.timestamp < 5 * 60 * 1000) {
            return cached.data;
        }
    }

    try {
        const response = await axios.get(`https://${API_HOST}/${endpoint}`, {
            headers: {
                'x-apisports-key': API_KEY
            },
            params: { ...params }
        });
        
        if (response.data.errors && Object.keys(response.data.errors).length > 0) {
             console.error('API-Sports Error:', response.data.errors);
             return getMockData(endpoint); // Fallback to mock on error
        }

        const data = response.data.response;
        cache.set(cacheKey, { timestamp: Date.now(), data });
        return data;
    } catch (error) {
        console.error('Error fetching from API-Football:', error.message);
        return getMockData(endpoint); // Fallback to mock on error
    }
}

async function getMatches() {
    return fetchFromApi('fixtures', { league: WORLD_CUP_LEAGUE_ID, season: SEASON });
}

async function getStandings() {
    return fetchFromApi('standings', { league: WORLD_CUP_LEAGUE_ID, season: SEASON });
}

async function getStats() {
    return fetchFromApi('players/topscorers', { league: WORLD_CUP_LEAGUE_ID, season: SEASON });
}

// Mock Data Function (Used for development before API key is provided)
function getMockData(endpoint) {
    if (endpoint === 'fixtures') {
        return [
            {
                fixture: { id: 1, date: new Date().toISOString(), status: { short: 'NS' } },
                teams: { home: { name: 'Brazil', logo: 'https://media.api-sports.io/football/teams/6.png' }, away: { name: 'France', logo: 'https://media.api-sports.io/football/teams/17.png' } },
                goals: { home: null, away: null }
            },
            {
                fixture: { id: 2, date: new Date(Date.now() - 3600000).toISOString(), status: { short: 'FT' } },
                teams: { home: { name: 'USA', logo: 'https://media.api-sports.io/football/teams/24.png' }, away: { name: 'England', logo: 'https://media.api-sports.io/football/teams/10.png' } },
                goals: { home: 2, away: 1 }
            },
            {
                fixture: { id: 3, date: new Date(Date.now() + 86400000).toISOString(), status: { short: 'NS' } },
                teams: { home: { name: 'Argentina', logo: 'https://media.api-sports.io/football/teams/26.png' }, away: { name: 'Spain', logo: 'https://media.api-sports.io/football/teams/9.png' } },
                goals: { home: null, away: null }
            }
        ];
    } else if (endpoint === 'standings') {
        return [{
            league: {
                standings: [
                    [
                        { rank: 1, team: { name: 'USA', logo: 'https://media.api-sports.io/football/teams/24.png' }, points: 3, all: { played: 1, win: 1, draw: 0, lose: 0, goals: { for: 2, against: 1 } } },
                        { rank: 2, team: { name: 'England', logo: 'https://media.api-sports.io/football/teams/10.png' }, points: 0, all: { played: 1, win: 0, draw: 0, lose: 1, goals: { for: 1, against: 2 } } }
                    ],
                    [
                        { rank: 1, team: { name: 'Brazil', logo: 'https://media.api-sports.io/football/teams/6.png' }, points: 0, all: { played: 0, win: 0, draw: 0, lose: 0, goals: { for: 0, against: 0 } } },
                        { rank: 2, team: { name: 'France', logo: 'https://media.api-sports.io/football/teams/17.png' }, points: 0, all: { played: 0, win: 0, draw: 0, lose: 0, goals: { for: 0, against: 0 } } }
                    ]
                ]
            }
        }];
    } else if (endpoint === 'players/topscorers') {
        return [
            { player: { name: 'Kylian Mbappe', photo: 'https://media.api-sports.io/football/players/278.png' }, statistics: [{ goals: { total: 5 } }] },
            { player: { name: 'Christian Pulisic', photo: 'https://media.api-sports.io/football/players/184.png' }, statistics: [{ goals: { total: 3 } }] },
            { player: { name: 'Lionel Messi', photo: 'https://media.api-sports.io/football/players/154.png' }, statistics: [{ goals: { total: 2 } }] }
        ];
    }
    return [];
}

module.exports = { getMatches, getStandings, getStats };
