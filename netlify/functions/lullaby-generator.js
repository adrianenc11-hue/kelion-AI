// ═══ LULLABY GENERATOR — Cântece de leagăn personalizate ═══
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
    try {
        const body = JSON.parse(event.body || '{}');
        switch (body.action) {
            case 'generate': return respond(200, generateLullaby(body));
            case 'traditional': return respond(200, traditionalLullabies(body));
            case 'personalize': return respond(200, personalize(body));
            default: return respond(400, { error: 'Actions: generate, traditional, personalize' });
        }
    } catch (err) { return respond(500, { error: err.message }); }
};

function respond(c, d) { return { statusCode: c, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ success: c === 200, ...d }) }; }

function generateLullaby({ child_name = 'puiule', theme = 'stele', tempo = 'slow' }) {
    const lullabies = {
        stele: {
            title: `Cântecul Stelelor pentru ${child_name}`,
            verses: [
                `🌙 Nani, nani, ${child_name} drag,\nStelele pe cer s-au stins pe rând,\nLuna veghează blând,\nȘi-ți zâmbește noapte bună.`,
                `✨ Îngerașii te-nvăluie,\nCu aripi moi de somn și vis,\nOchii mici se-nchid ușor,\nNoaptea e un dar frumos.`,
                `🌟 Visele te poartă lin,\nPeste nori de catifea,\n${child_name}, dormi ușor și lin,\nMama/Tata-i lângă tine-ntotdeauna.`
            ],
            mood: '💤 Calm și liniștitor'
        },
        ocean: {
            title: `Valurile somnului pentru ${child_name}`,
            verses: [
                `🌊 Valurile cântă lin,\nPentru ${child_name} cel drag,\nMarea albastră te legăn,\nCa un pat de nori de spumă.`,
                `🐚 Scoicile șoptesc povești,\nDespre pești cu aripi de aur,\n${child_name} visează frumos,\nÎntr-o lume liniștită.`,
                `🐬 Delfinii dansează-n vis,\nStele-n apă se reflectă,\nDoarme ${child_name}, doarme lin,\nMarea-l leagănă încet.`
            ],
            mood: '🌊 Ca un val ce te legăn'
        },
        natură: {
            title: `Cântecul Pădurii pentru ${child_name}`,
            verses: [
                `🌿 Frunzele șoptesc ușor,\nVântul cântă printre flori,\n${child_name} drag, e timpul visului,\nPădurea te protejează.`,
                `🦉 Bufnița veghează noapte,\nGreierașii cântă lin,\nStelele sunt lanternuțe,\nPentru ${child_name} cel frumos.`,
                `🌸 Florile și-nchid petalele,\nCa și tu închizi ochișorii,\nNoapte bună, ${child_name} drag,\nDimineața vine iar.`
            ],
            mood: '🌿 Natural și liniștitor'
        }
    };

    const lullaby = lullabies[theme] || lullabies.stele;
    return {
        ...lullaby,
        child_name,
        tempo: tempo === 'slow' ? '♩ = 60 BPM (foarte lent)' : '♩ = 80 BPM (lent)',
        duration: '3-5 minute',
        tip: '🎵 Cântă cu voce joasă, monotonă. Repetarea ajută la adormire.',
        breathing: '💨 Inspiră pe 4, expiră pe 6 — relaxează și pe părinte!'
    };
}

function traditionalLullabies() {
    return {
        collection: [
            { title: 'Nani, nani, puișor', origin: 'Tradițional românesc', first_line: 'Nani, nani, puișor, / Că te-așteaptă un vis frumos...' },
            { title: 'Somn ușor', origin: 'Tradițional', first_line: 'Somn ușor, îngeri dulci, / Ochii mici se-nchid ușor...' },
            { title: 'Legănelul', origin: 'Folclor românesc', first_line: 'Legănel de catifea, / Mama te legăn ușor...' },
            { title: 'Steluța', origin: 'Modern românesc', first_line: 'Steluța mea, steluța mea, / Luminezi drumul viselor...' },
            { title: 'Twinkle Twinkle', origin: 'Internațional', first_line: 'Twinkle, twinkle, little star, / How I wonder what you are...' }
        ],
        tip: 'Cântecele tradiționale au un ritm natural de legănare care ajută la adormire.'
    };
}

function personalize({ child_name, favorite_animal, favorite_color, age }) {
    const animal_sounds = { pisică: 'miau-miau', câine: 'ham-ham', urs: 'mor-mor', iepure: 'țup-țup' };
    const sound = animal_sounds[(favorite_animal || '').toLowerCase()] || 'zumm-zumm';
    return {
        title: `Cântecul special al lui ${child_name || 'puiule'}`,
        verses: [
            `🌙 ${child_name || 'Puiule'} drag, e noapte bună,\n${favorite_animal || 'Ursulețul'} doarme și el,\nFace "${sound}" încetișor,\nȘi visează-un vis frumos.`,
            `${favorite_color ? `💎 În visul tău totul e ${favorite_color},` : '✨ În visul tău totul strălucește,'}\nFlori și stele peste tot,\n${child_name || 'Puiule'}, dormi liniștit,\nNoaptea-i caldă și frumoasă.`
        ],
        age_note: (age || 0) <= 2 ? '👶 Perfect pentru bebeluși — repetă versurile' : '👧 Poți adăuga numele copilului în cântec'
    };
}
