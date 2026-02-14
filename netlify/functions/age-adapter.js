// ═══ AGE ADAPTER — Adaptare conținut pe vârstă ═══
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
    try {
        const body = JSON.parse(event.body || '{}');
        switch (body.action) {
            case 'adapt': return respond(200, adaptContent(body));
            case 'milestones': return respond(200, getMilestones(body));
            case 'activities': return respond(200, getActivities(body));
            default: return respond(400, { error: 'Actions: adapt, milestones, activities' });
        }
    } catch (err) { return respond(500, { error: err.message }); }
};

function respond(c, d) { return { statusCode: c, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ success: c === 200, ...d }) }; }

function adaptContent({ content, age, _type = 'text' }) {
    const group = age <= 2 ? 'toddler' : age <= 5 ? 'preschool' : age <= 8 ? 'early_school' : 'school';
    const rules = {
        toddler: { max_words: 20, vocabulary: 'basic', emoji: true, images: true, font_size: '24px', colors: 'bright', interaction: 'tap/swipe' },
        preschool: { max_words: 50, vocabulary: 'simple', emoji: true, images: true, font_size: '20px', colors: 'colorful', interaction: 'simple choice' },
        early_school: { max_words: 150, vocabulary: 'moderate', emoji: true, images: true, font_size: '18px', colors: 'harmonious', interaction: 'quiz/game' },
        school: { max_words: 300, vocabulary: 'rich', emoji: false, images: true, font_size: '16px', colors: 'standard', interaction: 'reading/writing' }
    };
    return { age, group, rules: rules[group], adapted: true, original_length: (content || '').length, tip: `Conținut adaptat pentru ${age} ani` };
}

function getMilestones({ age_months }) {
    const m = age_months || 12;
    const milestones = {
        3: { motor: ['Ridică capul', 'Apucă obiecte'], social: ['Zâmbește', 'Face sunete'], cognitive: ['Urmărește vizual', 'Recunoaște fețe'] },
        6: { motor: ['Se întoarce', 'Stă cu sprijin', 'Apucă jucării'], social: ['Râde cu voce tare', 'Recunoaște persoane'], cognitive: ['Explorează obiecte oral', 'Caută obiecte ascunse'] },
        9: { motor: ['Stă singur', 'Se târăște', 'Folosește degetele'], social: ['Spune mama/tata', 'Arată cu degetul'], cognitive: ['Permanența obiectului', 'Imită gesturi'] },
        12: { motor: ['Primii pași', 'Stă în picioare singur'], social: ['2-3 cuvinte', 'Înțelege "nu"', 'Face pa-pa'], cognitive: ['Rezolvă puzzle simple', 'Folosește obiecte corect'] },
        18: { motor: ['Merge sigur', 'Urcă scări cu ajutor', 'Mâzgălește'], social: ['10-20 cuvinte', 'Joc paralel'], cognitive: ['Sortare forme', 'Construiește turnuri'] },
        24: { motor: ['Aleargă', 'Lovește mingea', 'Urcă/coboară scări'], social: ['Propoziții 2 cuvinte', 'Joc simbolic'], cognitive: ['Asociază culori', 'Numără până la 5'] },
        36: { motor: ['Pedalează tricicletă', 'Desenează cercuri'], social: ['Propoziții complete', 'Joc cooperativ'], cognitive: ['Numește culori', 'Înțelege mare/mic'] }
    };

    const closest = Object.keys(milestones).map(Number).reduce((prev, curr) => Math.abs(curr - m) < Math.abs(prev - m) ? curr : prev);
    return { age_months: m, closest_milestone: `${closest} luni`, milestones: milestones[closest], note: '⚠️ Fiecare copil e unic — variații de ±2 luni sunt normale. Consultă pediatrul dacă ai îngrijorări.' };
}

function getActivities({ age }) {
    const a = age || 3;
    const activities = {
        1: ['🎵 Cântece cu gesturi', '📦 Cutii senzoriale', '🧩 Puzzle 2 piese', '📖 Cărți carton cu texturi', '🎨 Pictură cu degetele'],
        3: ['🎨 Colorat/Desenat', '🧩 Puzzle 4-12 piese', '🏃 Alergat în parc', '📖 Citit povești', '🎭 Joc de rol (magazin, doctor)', '🌿 Grădinărit simplu'],
        5: ['✂️ Decupat/Lipit', '🔢 Jocuri cu numere', '🎭 Teatru de păpuși', '🚲 Bicicletă cu roți ajutătoare', '🎵 Instrumente muzicale simple', '🔬 Experimente simple (vulcan bicarbonat)'],
        7: ['📚 Citit independent', '🧮 Matematică distractivă', '🎨 Arte plastice', '⚽ Sport organizat', '🎮 Jocuri educative digitale (1h/zi)', '🔬 Experimente științifice'],
        10: ['📝 Jurnal/Scris creativ', '♟️ Șah/Jocuri de strategie', '🎸 Instrument muzical', '💻 Coding pentru copii (Scratch)', '📸 Fotografie', '🏊 Înot/Sport']
    };
    const closest = Object.keys(activities).map(Number).reduce((prev, curr) => Math.abs(curr - a) < Math.abs(prev - a) ? curr : prev);
    return { age: a, activities: activities[closest], screen_time: a <= 2 ? '❌ Evitați ecranele' : a <= 5 ? '📱 Max 1h/zi, conținut educativ' : '📱 Max 2h/zi, cu pauze', tip: 'Activități variate = dezvoltare armonioasă!' };
}
