const axios = require('axios');

async function getMatches() {
    try {
        const res = await axios.get('https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard');
        const events = res.data.events || [];
        return events.map(event => {
            const comp = event.competitions[0];
            const home = comp.competitors.find(c => c.homeAway === 'home');
            const away = comp.competitors.find(c => c.homeAway === 'away');
            
            return {
                fixture: {
                    id: parseInt(event.id) || Math.floor(Math.random() * 100000),
                    date: event.date,
                    status: { short: event.status.type.shortDetail || event.status.type.state }
                },
                teams: {
                    home: { name: home?.team?.name || 'Home', logo: home?.team?.logo || '' },
                    away: { name: away?.team?.name || 'Away', logo: away?.team?.logo || '' }
                },
                goals: {
                    home: home?.score ? parseInt(home.score) : null,
                    away: away?.score ? parseInt(away.score) : null
                }
            };
        });
    } catch (e) {
        console.error('ESPN Matches Error:', e.message);
        return [];
    }
}

async function getStandings() {
    // ESPN Standings endpoint requires complex mapping, returning mock for now to keep UI working
    return getMockData('standings');
}

async function getStats() {
    // ESPN Stats endpoint requires complex mapping, returning mock for now to keep UI working
    return getMockData('players/topscorers');
}

function getMockData(endpoint) {
    if (endpoint === 'standings') {
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
