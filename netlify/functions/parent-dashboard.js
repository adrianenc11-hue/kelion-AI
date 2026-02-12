// ═══ PARENT DASHBOARD — Panou control parental ═══
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
    try {
        const body = JSON.parse(event.body || '{}');
        switch (body.action) {
            case 'overview': return respond(200, getOverview(body));
            case 'child_profile': return respond(200, childProfile(body));
            case 'activity_log': return respond(200, activityLog(body));
            case 'set_rules': return respond(200, setRules(body));
            default: return respond(400, { error: 'Actions: overview, child_profile, activity_log, set_rules' });
        }
    } catch (err) { return respond(500, { error: err.message }); }
};

function respond(c, d) { return { statusCode: c, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ success: c === 200, ...d }) }; }

function getOverview({ children = [] }) {
    return {
        title: '👨‍👩‍👧‍👦 Panou Control Parental',
        children: children.length > 0 ? children : [
            { name: 'Copilul 1', age: 5, status: '🟢 Online', current_activity: '📖 Citește o poveste', screen_time_today: '45 min', safe_mode: 'strict' }
        ],
        today_summary: {
            total_screen_time: '45 min',
            activities: ['3 povești citite', '1 quiz matematică (8/10)', '2 cântece de leagăn'],
            blocked_content: 0,
            rewards_earned: 2
        },
        alerts: [],
        quick_actions: ['⏸️ Pauză ecran', '🔒 Activare Safe Mode', '📊 Vezi raport', '🎯 Setează obiective']
    };
}

function childProfile({ name, age, interests = [], restrictions = [] }) {
    return {
        profile: {
            name: name || 'Copilul',
            age: age || 5,
            interests: interests.length > 0 ? interests : ['Povești', 'Animale', 'Matematică'],
            level: age <= 3 ? '👶 Bebeluș' : age <= 5 ? '🧒 Preșcolar' : age <= 8 ? '👧 Școlar mic' : '🧑 Școlar'
        },
        settings: {
            safe_mode: age <= 5 ? 'strict' : 'moderate',
            screen_time_limit: age <= 3 ? '30 min/zi' : age <= 5 ? '1h/zi' : '2h/zi',
            allowed_content: ['povești', 'quiz educativ', 'cântece', 'jocuri educative'],
            restricted: restrictions.length > 0 ? restrictions : ['Social media', 'YouTube nesupravegheat', 'Jocuri mature']
        },
        developmental: {
            current_skills: age <= 5 ? ['Numere 1-20', 'Litere A-Z', 'Culori'] : ['Citit', 'Matematică de bază', 'Logică'],
            next_goals: age <= 5 ? ['Scriere litere', 'Adunări simple'] : ['Înmulțiri', 'Citit fluent'],
            progress: '📈 Pe drumul cel bun!'
        }
    };
}

function activityLog({ period = '7d' }) {
    return {
        period,
        daily_log: [
            { day: 'Luni', screen_time: '55 min', activities: ['Quiz matematică (9/10) ⭐', 'Poveste: Aventura din Pădure'], rewards: 1 },
            { day: 'Marți', screen_time: '40 min', activities: ['Colorat digital', 'Cântec de leagăn'], rewards: 1 },
            { day: 'Miercuri', screen_time: '1h 10min', activities: ['Quiz natură (7/10)', 'Poveste interactivă', 'Joc cu numere'], rewards: 2 },
            { day: 'Joi', screen_time: '30 min', activities: ['Puzzle online', 'Ascultare muzică'], rewards: 1 },
            { day: 'Vineri', screen_time: '50 min', activities: ['Quiz română (10/10) ⭐⭐', 'Poveste: Astronautul Curajos'], rewards: 2 }
        ],
        weekly_summary: {
            avg_screen_time: '45 min/zi',
            total_quizzes: 3,
            avg_quiz_score: '8.7/10',
            stories_read: 3,
            total_rewards: 7,
            trend: '📈 Îmbunătățire constantă la quiz-uri!'
        }
    };
}

function setRules({ rules = {} }) {
    const defaults = {
        screen_time: { weekday: '1h', weekend: '1.5h', breaks: 'La fiecare 30 min' },
        content: { safe_mode: 'strict', allowed_apps: ['K Povești', 'K Quiz', 'K Colorat'], blocked: ['YouTube', 'Social Media', 'Games Store'] },
        schedule: { no_screen_before: '08:00', no_screen_after: '19:00', mandatory_break: '14:00-15:00' },
        notifications: { screen_time_warning: '10 min înainte de limită', daily_report: '20:00', weekly_report: 'Duminică' }
    };
    return { current_rules: { ...defaults, ...rules }, available_presets: ['👶 Bebeluș (0-2)', '🧒 Preșcolar (3-5)', '👧 Școlar (6-10)', '🧑 Pre-teen (11-14)'], tip: 'Regulile se pot ajusta individual pentru fiecare copil.' };
}
