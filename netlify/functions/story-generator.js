// ═══ STORY GENERATOR — Povești AI via Smart Brain ═══
const { patchProcessEnv } = require('./get-secret');
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
    try {
        await patchProcessEnv();
        const body = JSON.parse(event.body || '{}');
        switch (body.action) {
            case 'generate': return respond(200, await generateStory(body));
            case 'continue': return respond(200, await continueStory(body));
            case 'themes': return respond(200, getThemes());
            default: return respond(400, { error: 'Actions: generate, continue, themes' });
        }
    } catch (err) { return respond(500, { error: err.message }); }
};

function respond(c, d) { return { statusCode: c, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ success: c === 200, ...d }) }; }

async function callBrain(prompt) {
    const fetch = (await import('node-fetch')).default;
    const baseUrl = process.env.URL || 'https://kelionai.app';
    const res = await fetch(`${baseUrl}/.netlify/functions/smart-brain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: prompt, mode: 'story' })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Brain failed');
    return data.reply || data.answer;
}

async function generateStory({ theme = 'aventură', age = 5, character_name = 'Luca', length = 'medium', moral, language = 'ro' }) {
    const lengthMap = { short: '3 paragrafe scurte', medium: '5-6 paragrafe', long: '8-10 paragrafe' };
    const prompt = `Generează o poveste interactivă pentru copii.
Tema: ${theme}
Vârsta copilului: ${age} ani
Personaj principal: ${character_name}
Lungime: ${lengthMap[length] || lengthMap.medium}
Morala dorită: ${moral || 'alege cea mai potrivită'}
Limba: ${language === 'ro' ? 'Română' : 'Engleză'}

Returnează JSON cu format:
{
  "title": "Titlul poveștii",
  "chapters": [{"chapter": 1, "title": "Titlu capitol", "text": "Text capitol cu emoji-uri"}],
  "moral": "Morala poveștii",
  "interactive_question": "O întrebare pentru copil despre poveste"
}

IMPORTANT: 
- Folosește emoji-uri colorate
- Adaptează vocabularul la vârsta ${age} ani
- Fă povestea captivantă și educativă
- Răspunde DOAR cu JSON valid, fără altceva`;

    const reply = await callBrain(prompt);

    try {
        const jsonMatch = reply.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const story = JSON.parse(jsonMatch[0]);
            return {
                ...story,
                age_group: age <= 3 ? '0-3 ani' : age <= 5 ? '3-5 ani' : age <= 8 ? '6-8 ani' : '9-12 ani',
                character: character_name,
                theme,
                reading_time: `${(story.chapters?.length || 3) * 2} minute`,
                ai_generated: true,
                engine: 'smart-brain'
            };
        }
    } catch (e) { /* JSON parse failed, return raw */ }

    return {
        title: `Povestea lui ${character_name}`,
        chapters: [{ chapter: 1, title: theme, text: reply }],
        moral: moral || 'Fiecare aventură aduce o lecție nouă.',
        character: character_name,
        theme,
        ai_generated: true
    };
}

async function continueStory({ story_title, last_chapter_text, character_name = 'Luca', choice = '' }) {
    const prompt = `Continuă povestea "${story_title || 'Povestea'}" pentru copii.
Personaj: ${character_name}
Ultimul capitol: ${last_chapter_text || 'Începutul aventurii'}
Alegerea copilului: ${choice || 'continuă aventura'}

Scrie următorul capitol (2-3 paragrafe) cu emoji-uri, apoi oferă 3 alegeri pentru continuare.
Returnează JSON: {"chapter": {"title": "...", "text": "..."}, "choices": ["Alegere 1", "Alegere 2", "Alegere 3"]}`;

    const reply = await callBrain(prompt);

    try {
        const jsonMatch = reply.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch (e) { /* fallback */ }

    return {
        chapter: { title: 'Continuarea aventurii', text: reply },
        choices: ['🦁 Mergi mai departe', '🌊 Explorează alt drum', '🏰 Întâlnești pe cineva']
    };
}

function getThemes() {
    return {
        themes: [
            { id: 'aventură', emoji: '⚔️', name: 'Aventuri', description: 'Expediții, comori, călătorii' },
            { id: 'spațiu', emoji: '🚀', name: 'Spațiu', description: 'Planete, stele, astronauți' },
            { id: 'animale', emoji: '🐾', name: 'Animale', description: 'Animale care vorbesc, prietenii' },
            { id: 'magie', emoji: '✨', name: 'Magie', description: 'Vrăjitori, poțiuni, lumi magice' },
            { id: 'ocean', emoji: '🌊', name: 'Ocean', description: 'Sirene, delfini, comori submarine' },
            { id: 'dinosauri', emoji: '🦕', name: 'Dinosauri', description: 'Aventuri preistorice' },
            { id: 'robot', emoji: '🤖', name: 'Roboți', description: 'Tehnologie, inventii' },
            { id: 'sport', emoji: '⚽', name: 'Sport', description: 'Competiții, echipă, campioni' }
        ]
    };
}
