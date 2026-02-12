// ═══ QUIZ GENERATOR KIDS — Teste AI educative via Smart Brain ═══
const { patchProcessEnv } = require('./get-secret');
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
    try {
        await patchProcessEnv();
        const body = JSON.parse(event.body || '{}');
        switch (body.action) {
            case 'generate': return respond(200, await generateQuiz(body));
            case 'grade': return respond(200, gradeQuiz(body));
            case 'subjects': return respond(200, getSubjects(body));
            default: return respond(400, { error: 'Actions: generate, grade, subjects' });
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
        body: JSON.stringify({ question: prompt, mode: 'quiz' })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Brain failed');
    return data.reply || data.answer;
}

async function generateQuiz({ subject = 'matematică', age = 6, num_questions = 5, language = 'ro', difficulty = 'auto' }) {
    const ageGroup = age <= 5 ? '3-5 ani' : age <= 8 ? '6-8 ani' : '9-12 ani';
    const diffNote = difficulty === 'auto' ? `adaptat pentru ${ageGroup}` : difficulty;

    const prompt = `Generează un quiz educativ pentru copii.
Materie: ${subject}
Vârsta: ${age} ani (grupa ${ageGroup})
Număr întrebări: ${num_questions}
Dificultate: ${diffNote}
Limba: ${language === 'ro' ? 'Română' : 'Engleză'}

Returnează DOAR JSON valid:
{
  "questions": [
    {"q": "Întrebarea cu emoji", "options": ["A", "B", "C", "D"], "answer": "Răspunsul corect", "emoji": "emoji relevant", "explanation": "Explicație scurtă"}
  ]
}

REGULI:
- Fiecare întrebare cu emoji relevant
- 4 opțiuni de răspuns, una corectă
- Vocabular adaptat la ${age} ani
- Întrebări variate și interesante
- Explicații scurte pt fiecare răspuns
- DOAR JSON valid, nimic altceva`;

    const reply = await callBrain(prompt);

    try {
        const jsonMatch = reply.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            return {
                subject, age, age_group: ageGroup,
                questions: data.questions || [],
                total: data.questions?.length || 0,
                encouragement: '🌟 Bravo! Fiecare întrebare rezolvată e un pas spre succes!',
                time_limit: age <= 5 ? 'Fără limită' : `${num_questions * 30} secunde`,
                ai_generated: true,
                engine: 'smart-brain'
            };
        }
    } catch (e) { /* fallback */ }

    return {
        subject, age, age_group: ageGroup,
        questions: [{ q: reply, options: [], answer: '', emoji: '📝' }],
        total: 1,
        ai_generated: true,
        note: 'AI response could not be parsed as quiz format'
    };
}

function gradeQuiz({ questions = [], answers = [], child_name = 'Campionule' }) {
    let correct = 0;
    const results = questions.map((q, i) => {
        const isCorrect = String(answers[i]) === String(q.answer);
        if (isCorrect) correct++;
        return {
            question: q.q,
            your_answer: answers[i],
            correct_answer: q.answer,
            explanation: q.explanation || '',
            result: isCorrect ? '✅' : '❌'
        };
    });

    const score = questions.length > 0 ? Math.round(correct / questions.length * 100) : 0;
    const grade = score >= 90 ? '⭐⭐⭐' : score >= 70 ? '⭐⭐' : score >= 50 ? '⭐' : '💪';

    return {
        child_name, score: `${score}%`, correct, total: questions.length,
        grade, results,
        message: score >= 90 ? `🎉 EXTRAORDINAR ${child_name}! Ești un geniu!`
            : score >= 70 ? `👏 Foarte bine ${child_name}! Super treabă!`
                : score >= 50 ? `😊 Bine ${child_name}! Mai exersăm și va fi perfect!`
                    : `💪 Nu renunța ${child_name}! Fiecare greșeală e o lecție!`,
        reward: score >= 70 ? '🏆 Badge: Super Deștept!' : '📚 Continuă să înveți!'
    };
}

function getSubjects({ age = 6 }) {
    return {
        subjects: [
            { id: 'matematică', emoji: '🧮', name: 'Matematică', topics: age <= 5 ? ['Numere 1-10', 'Adunări simple'] : ['Adunări', 'Scăderi', 'Înmulțiri'] },
            { id: 'română', emoji: '📝', name: 'Limba Română', topics: age <= 5 ? ['Litere', 'Culori', 'Animale'] : ['Gramatică', 'Vocabular', 'Ortografie'] },
            { id: 'natură', emoji: '🌿', name: 'Științe/Natură', topics: ['Animale', 'Plante', 'Anotimpuri', 'Corpul uman'] },
            { id: 'geografie', emoji: '🌍', name: 'Geografie', topics: ['Țări', 'Capitale', 'Continente'] },
            { id: 'logică', emoji: '🧩', name: 'Logică', topics: ['Serii', 'Puzzle-uri', 'Ghicitori'] },
            { id: 'engleză', emoji: '🇬🇧', name: 'Engleză', topics: ['Vocabular', 'Gramatică', 'Conversație'] },
            { id: 'istorie', emoji: '🏛️', name: 'Istorie', topics: ['Civilizații', 'Personalități', 'Evenimente'] }
        ]
    };
}
