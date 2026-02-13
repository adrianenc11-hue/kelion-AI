// ═══ MESSENGER WEBHOOK — K Pension Expert — Facebook, Instagram DM, Messenger ═══
// K = asistent AI expert pensii, tobă de carte pe legislație
// Primește mesaje → răspunde cu AI + legislație reală
// Footer: kelionai.app pe fiecare mesaj

const { patchProcessEnv } = require('./get-secret');
const { createClient } = require('@supabase/supabase-js');

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
};

const SITE_FOOTER = '\n\n🌐 kelionai.app';

const COUNTRIES = {
    'ro': { flag: '🇷🇴', name: 'România', lang: 'ro' },
    'uk': { flag: '🇬🇧', name: 'United Kingdom', lang: 'en' },
    'us': { flag: '🇺🇸', name: 'United States', lang: 'en' },
    'de': { flag: '🇩🇪', name: 'Deutschland', lang: 'de' },
    'fr': { flag: '🇫🇷', name: 'France', lang: 'fr' },
    'es': { flag: '🇪🇸', name: 'España', lang: 'es' },
    'it': { flag: '🇮🇹', name: 'Italia', lang: 'it' }
};

const PENSION_SYSTEM_PROMPT = `Ești K, expert AI pe pensii. Știi TOTUL despre legislația pensiilor.

STIL RĂSPUNS:
- SCURT și LA OBIECT — fără text în plus
- Prietenos dar profesionist
- Pe înțelesul oamenilor (audiență 55-80 ani)
- Max 300 caractere per răspuns
- Citează legea/articolul relevant (scurt)
- NU lungi, NU repeti, NU bagi paragrafe inutile

REGULI:
1. Prima interacțiune: spune că ești AI
2. DOAR întrebări despre pensii
3. Dacă nu ești sigur: "Consultați Casa de Pensii"
4. Disclaimer scurt la final când e cazul

CUNOȘTINȚE: Legea 127/2019, Legea 263/2010, Legea 223/2015 (militari), OUG 163/2020 (recalculare), HG 1284/2011 (grupe), OUG 6/2009 (indemnizație socială), State Pension Act 2014, Social Security Act, SGB VI, CNAV, INSS, INPS, Reg. UE 883/2004.

SUBIECTE: calcul pensie, vârstă, documente, drepturi, recalculare, contestare, pensie urmaș, pensii militare, transfer UE, Pilon II/III.`;

function getSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
}

// ═══ MAIN HANDLER ═══
exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    await patchProcessEnv();

    // ═══ WEBHOOK VERIFICATION (Meta GET) ═══
    if (event.httpMethod === 'GET') {
        const params = event.queryStringParameters || {};
        const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'kelionai_pension_verify_2025';
        if (params['hub.mode'] === 'subscribe' && params['hub.verify_token'] === VERIFY_TOKEN) {
            console.log('✅ Webhook verified');
            return { statusCode: 200, body: params['hub.challenge'] };
        }
        return { statusCode: 403, body: 'Verification failed' };
    }

    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'POST only' };

    try {
        const body = JSON.parse(event.body || '{}');

        // Meta webhook events (Instagram DM + Messenger)
        if (body.object === 'instagram' || body.object === 'page') {
            const entries = body.entry || [];
            for (const entry of entries) {
                const messaging = entry.messaging || [];
                for (const msg of messaging) {
                    // ═══ ANTI-LOOP: Skip echoes (messages sent BY the page) ═══
                    if (msg.message && msg.message.is_echo) {
                        console.log('⏭️ Skipping echo message (sent by page)');
                        continue;
                    }
                    // Skip if sender is the page itself
                    const pageId = process.env.META_PAGE_ID;
                    if (pageId && msg.sender.id === pageId) {
                        console.log('⏭️ Skipping message from page itself');
                        continue;
                    }
                    if (msg.message && msg.message.text) {
                        await handleMessage(msg.sender.id, msg.message.text, body.object);
                    } else if (msg.message && msg.message.attachments) {
                        // ═══ AUDIO MESSAGE SUPPORT ═══
                        const audioAttach = msg.message.attachments.find(a => a.type === 'audio');
                        if (audioAttach && audioAttach.payload && audioAttach.payload.url) {
                            await handleAudioMessage(msg.sender.id, audioAttach.payload.url, body.object);
                        }
                    }
                }
            }
            return { statusCode: 200, headers, body: JSON.stringify({ status: 'ok' }) };
        }

        // ═══ SUBSCRIBE PAGE TO WEBHOOK EVENTS ═══
        if (body.action === 'subscribe_page') {
            const PAGE_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
            const PAGE_ID = process.env.META_PAGE_ID;
            if (!PAGE_TOKEN || !PAGE_ID) {
                return { statusCode: 200, headers, body: JSON.stringify({ error: 'Missing PAGE_TOKEN or PAGE_ID' }) };
            }
            try {
                const subRes = await fetch(
                    `https://graph.facebook.com/v21.0/${PAGE_ID}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,message_deliveries,message_reads&access_token=${PAGE_TOKEN}`,
                    { method: 'POST' }
                );
                const subData = await subRes.json();
                console.log('📡 Page subscription result:', JSON.stringify(subData));
                return { statusCode: 200, headers, body: JSON.stringify({ action: 'subscribe_page', result: subData }) };
            } catch (e) {
                return { statusCode: 200, headers, body: JSON.stringify({ error: e.message }) };
            }
        }

        // ═══ DEBUG — test outbound connectivity ═══
        if (body.action === 'debug') {
            const results = {};
            // Test 1: Can K reach Meta? Use PAGE_ID endpoint (page tokens need fields param)
            try {
                const PAGE_TOKEN = process.env.META_PAGE_ACCESS_TOKEN || 'none';
                const PAGE_ID = process.env.META_PAGE_ID;
                const metaUrl = PAGE_ID
                    ? `https://graph.facebook.com/v21.0/${PAGE_ID}?fields=id,name&access_token=${PAGE_TOKEN}`
                    : `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${PAGE_TOKEN}`;
                const metaRes = await fetch(metaUrl);
                results.meta_api = { status: metaRes.status, data: await metaRes.json() };
            } catch (e) { results.meta_api = { error: e.message }; }
            // Test 2: Can K reach smart-brain?
            try {
                const baseUrl = process.env.URL || 'https://kelionai.app';
                const brainRes = await fetch(`${baseUrl}/.netlify/functions/smart-brain`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: 'test', system: 'Say OK', model: 'auto', max_tokens: 5 })
                });
                results.smart_brain = { status: brainRes.status };
            } catch (e) { results.smart_brain = { error: e.message }; }
            // Test 3: Env vars present?
            results.env = {
                PAGE_TOKEN: !!process.env.META_PAGE_ACCESS_TOKEN,
                PAGE_ID: !!process.env.META_PAGE_ID,
                VERIFY_TOKEN: !!process.env.META_VERIFY_TOKEN,
                SUPABASE_URL: !!process.env.SUPABASE_URL
            };
            return { statusCode: 200, headers, body: JSON.stringify({ debug: results }) };
        }

        // ═══ SEND TEST MESSAGE (outbound test) ═══
        if (body.action === 'send_test' && body.recipient_id) {
            const PAGE_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
            if (!PAGE_TOKEN) {
                return { statusCode: 200, headers, body: JSON.stringify({ error: 'No PAGE_TOKEN' }) };
            }
            const testMsg = body.text || 'Salut! Sunt K - asistentul AI Kelion pentru pensii. Acesta e un mesaj test. 🤖';
            try {
                const sendRes = await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${PAGE_TOKEN}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        recipient: { id: body.recipient_id },
                        messaging_type: 'UPDATE',
                        message: { text: testMsg }
                    })
                });
                const sendData = await sendRes.json();
                console.log('📤 Test message result:', JSON.stringify(sendData));
                return { statusCode: 200, headers, body: JSON.stringify({ action: 'send_test', result: sendData }) };
            } catch (e) {
                return { statusCode: 200, headers, body: JSON.stringify({ action: 'send_test', error: e.message }) };
            }
        }

        // Direct API call (testing)
        if (body.test_message) {
            const response = await generateAIResponse(body.test_message, body.sender_id || 'test_user', body.country || null);
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, response }) };
        }

        return { statusCode: 200, headers, body: JSON.stringify({ status: 'ok' }) };
    } catch (err) {
        console.error('Messenger webhook error:', err);
        return { statusCode: 200, headers, body: JSON.stringify({ status: 'error', message: err.message }) };
    }
};

// ═══ GET USER PROFILE FROM META API ═══
async function getUserProfile(senderId) {
    const PAGE_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
    if (!PAGE_TOKEN) return null;
    try {
        const res = await fetch(`https://graph.facebook.com/v21.0/${senderId}?fields=first_name,last_name,name,profile_pic,locale&access_token=${PAGE_TOKEN}`);
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        console.error('Profile fetch error:', e.message);
        return null;
    }
}

// ═══ GET OR CREATE CONTACT IN DB ═══
async function getOrCreateContact(senderId, platform) {
    const db = getSupabase();
    if (!db) return { is_greeted: false, data_collected: false };
    try {
        const { data: existing } = await db.from('messenger_contacts')
            .select('*')
            .eq('platform', platform === 'page' ? 'facebook' : platform)
            .eq('sender_id', senderId)
            .single();

        if (existing) {
            // Update last_contact and message_count
            await db.from('messenger_contacts')
                .update({ last_contact: new Date().toISOString(), message_count: (existing.message_count || 0) + 1 })
                .eq('id', existing.id);
            return existing;
        }

        // New contact — fetch profile from Meta
        const profile = await getUserProfile(senderId);
        const newContact = {
            platform: platform === 'page' ? 'facebook' : platform,
            sender_id: senderId,
            first_name: profile?.first_name || null,
            last_name: profile?.last_name || null,
            full_name: profile?.name || null,
            profile_pic: profile?.profile_pic || null,
            locale: profile?.locale || null,
            is_greeted: false,
            data_collected: false,
            message_count: 1
        };

        const { data: created } = await db.from('messenger_contacts')
            .upsert(newContact, { onConflict: 'platform,sender_id' })
            .select().single();

        return created || { is_greeted: false, data_collected: false };
    } catch (e) {
        console.error('Contact DB error:', e.message);
        return { is_greeted: false, data_collected: false };
    }
}

// ═══ MARK CONTACT AS GREETED ═══
async function markGreeted(senderId, platform) {
    const db = getSupabase();
    if (!db) return;
    await db.from('messenger_contacts')
        .update({ is_greeted: true })
        .eq('sender_id', senderId)
        .eq('platform', platform === 'page' ? 'facebook' : platform);
}

// ═══ EXTRACT EMAIL/AGE FROM TEXT (data collection) ═══
async function extractAndSaveUserData(senderId, platform, text) {
    const db = getSupabase();
    if (!db) return;
    const updates = {};
    // Email detection
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) updates.email = emailMatch[0];
    // Age detection (e.g., "am 65 ani", "65 years", "varsta 65")
    const ageMatch = text.match(/(?:am|varsta|vârsta|age|ani|years?)\s*[:\s]?\s*(\d{2,3})/i) || text.match(/(\d{2,3})\s*(?:ani|years?|de ani)/i);
    if (ageMatch) {
        const age = parseInt(ageMatch[1]);
        if (age >= 14 && age <= 120) updates.age = age;
    }
    if (Object.keys(updates).length > 0) {
        updates.data_collected = true;
        await db.from('messenger_contacts')
            .update(updates)
            .eq('sender_id', senderId)
            .eq('platform', platform === 'page' ? 'facebook' : platform);
    }
}

// ═══ HANDLE INCOMING MESSAGE ═══
async function handleMessage(senderId, text, platform) {
    console.log(`📩 [${platform}] From ${senderId}: ${text}`);

    // Get or create contact + check greeting status
    const contact = await getOrCreateContact(senderId, platform);

    // First contact — send formal greeting
    if (!contact.is_greeted) {
        const firstName = contact.first_name || '';
        const greeting = firstName
            ? `Bună ziua, ${firstName}! 👋\n\nSunt K, asistentul AI al Kelion AI. Sunt expert pe legislația pensiilor și vă pot ajuta cu orice întrebare.\n\nCu ce vă pot fi de folos?${SITE_FOOTER}`
            : `Bună ziua! 👋\n\nSunt K, asistentul AI al Kelion AI. Sunt expert pe legislația pensiilor și vă pot ajuta cu orice întrebare.\n\nCu ce vă pot fi de folos?${SITE_FOOTER}`;
        await sendMessage(senderId, greeting, platform);
        await markGreeted(senderId, platform);
    }

    // Extract email/age if present in message
    await extractAndSaveUserData(senderId, platform, text);

    const response = await generateAIResponse(text, senderId, null);

    // Log to Supabase
    await logConversation(senderId, platform, text, response);

    // Split long messages (Meta limit: 2000 chars)
    const chunks = splitMessage(response, 1900);
    for (const chunk of chunks) {
        await sendMessage(senderId, chunk, platform);
    }
}

// ═══ HANDLE AUDIO MESSAGE — Mirror format: audio in → audio out ═══
async function handleAudioMessage(senderId, audioUrl, platform) {
    console.log(`🎙️ [${platform}] Audio from ${senderId}: ${audioUrl}`);
    const baseUrl = process.env.URL || 'https://kelionai.app';
    const PAGE_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;

    try {
        // 1. Download audio from Meta (needs auth)
        const audioRes = await fetch(audioUrl, {
            headers: PAGE_TOKEN ? { 'Authorization': `Bearer ${PAGE_TOKEN}` } : {}
        });
        if (!audioRes.ok) throw new Error(`Audio download failed: ${audioRes.status}`);
        const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
        const audioBase64 = audioBuffer.toString('base64');
        console.log(`📥 Audio downloaded: ${audioBuffer.length} bytes`);

        // 2. Transcribe with Whisper
        const whisperRes = await fetch(`${baseUrl}/.netlify/functions/whisper`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio: audioBase64 })
        });
        if (!whisperRes.ok) throw new Error(`Whisper failed: ${whisperRes.status}`);
        const whisperData = await whisperRes.json();
        const transcription = whisperData.text || '';
        console.log(`📝 Transcription: ${transcription}`);

        if (!transcription || transcription.length < 3) {
            await sendMessage(senderId, '❌ Nu am putut înțelege mesajul audio. Te rog scrie-mi textual! 💬', platform);
            return;
        }

        // 3. Generate AI response (same pipeline as text)
        const response = await generateAIResponse(transcription, senderId, null);

        // 4. Log to Supabase (mark as audio)
        await logConversation(senderId, platform, `[AUDIO] ${transcription}`, response);

        // 5. Convert response to audio with TTS
        try {
            const ttsRes = await fetch(`${baseUrl}/.netlify/functions/elevenlabs-tts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: response.replace(/🌐 kelionai\.app/g, 'kelionai.app'), voice_id: 'default' })
            });
            if (ttsRes.ok) {
                const ttsData = await ttsRes.json();
                if (ttsData.success && ttsData.audio) {
                    // 6. Send audio response via Meta API
                    await sendAudioMessage(senderId, ttsData.audio, platform);
                    console.log(`🔊 Audio response sent to ${senderId}`);
                    return;
                }
            }
        } catch (ttsErr) {
            console.error('TTS error (falling back to text):', ttsErr.message);
        }

        // Fallback: send as text if TTS fails
        const chunks = splitMessage(response, 1900);
        for (const chunk of chunks) {
            await sendMessage(senderId, chunk, platform);
        }
    } catch (err) {
        console.error('Audio message error:', err.message);
        await sendMessage(senderId, '⚠️ Am întâmpinat o eroare la procesarea mesajului audio. Scrie-mi textual! 💬', platform);
    }
}

// ═══ SEND AUDIO MESSAGE VIA META API ═══
async function sendAudioMessage(recipientId, audioBase64, platform) {
    const PAGE_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
    if (!PAGE_TOKEN) { console.error('❌ META_PAGE_ACCESS_TOKEN not set'); return; }

    const url = 'https://graph.facebook.com/v21.0/me/messages';
    try {
        // Meta requires audio as URL, so we use a data URI workaround
        // First try sending as attachment_url with base64
        const res = await fetch(`${url}?access_token=${PAGE_TOKEN}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipient: { id: recipientId },
                message: {
                    attachment: {
                        type: 'audio',
                        payload: {
                            url: `data:audio/mp3;base64,${audioBase64}`,
                            is_reusable: false
                        }
                    }
                },
                messaging_type: 'RESPONSE'
            })
        });
        const data = await res.json();
        if (data.error) {
            console.error('Meta audio send error:', data.error.message);
            // Fallback: just send the text version
            return false;
        }
        console.log(`🔊 Audio sent to ${recipientId}`);
        return true;
    } catch (err) {
        console.error('Send audio error:', err.message);
        return false;
    }
}

// ═══ GENERATE AI-POWERED RESPONSE ═══
async function generateAIResponse(userMessage, senderId, forcedCountry) {
    const msg = userMessage.toLowerCase().trim();

    // ═══ 1. CHECK IF COUNTRY IS SELECTED ═══
    const userCountry = forcedCountry || await getUserCountry(senderId);

    // Country selection response
    if (isCountrySelection(msg)) {
        const country = detectCountry(msg);
        if (country) {
            await saveUserCountry(senderId, country);
            const c = COUNTRIES[country];
            return `${c.flag} Perfect! Am selectat ${c.name}.\n\n` +
                `Sunt K, asistentul AI expert pe pensii. Îți pot oferi informații despre:\n\n` +
                `📋 Documente necesare pensionare\n` +
                `🧮 Calcul estimativ pensie\n` +
                `⚖️ Legislație pensii\n` +
                `📅 Calendar pensionare\n` +
                `🛡️ Drepturi pensionari\n` +
                `📊 Recalculare pensie\n` +
                `⚖️ Contestare decizie\n\n` +
                `Scrie-mi întrebarea ta! 💬` + SITE_FOOTER;
        }
    }

    // If no country selected yet, ask for it
    if (!userCountry) {
        return `👋 Salut! Sunt K, un asistent AI specializat pe pensii.\n\n` +
            `⚠️ Sunt o inteligență artificială. Informațiile sunt orientative.\n\n` +
            `Selectează țara ta pentru informații personalizate:\n\n` +
            `🇷🇴 România — scrie "RO"\n` +
            `🇬🇧 United Kingdom — scrie "UK"\n` +
            `🇺🇸 United States — scrie "US"\n` +
            `🇩🇪 Deutschland — scrie "DE"\n` +
            `🇫🇷 France — scrie "FR"\n` +
            `🇪🇸 España — scrie "ES"\n` +
            `🇮🇹 Italia — scrie "IT"\n\n` +
            `Sau scrie direct întrebarea ta! 😊` + SITE_FOOTER;
    }

    // ═══ 2. NON-PENSION TOPIC FILTER ═══
    if (isOffTopic(msg)) {
        return `Aici mă ocup doar de pensii. 😊 Pentru alte întrebări, te aștept pe kelionai.app — acolo pot face mult mai multe!` + SITE_FOOTER;
    }

    // ═══ 3. QUICK RESPONSES (no AI needed) ═══
    if (matchesAny(msg, ['salut', 'buna', 'hello', 'hey', 'servus', 'noroc', 'hi'])) {
        const c = COUNTRIES[userCountry];
        return `👋 Salut! Sunt K, expert pensii ${c.flag} ${c.name}.\n\n` +
            `Cum te pot ajuta? Scrie-mi întrebarea! 💬` + SITE_FOOTER;
    }

    // ═══ 4. AI-POWERED RESPONSE ═══
    try {
        // Get relevant legal context
        const legalContext = await fetchLegalContext(userMessage, userCountry);

        // Get conversation history
        const history = await getConversationHistory(senderId, 6);

        // Build prompt with context
        const contextPrompt = buildContextPrompt(userMessage, userCountry, legalContext, history);

        // Call smart-brain for AI response
        const baseUrl = process.env.URL || 'https://kelionai.app';
        const aiRes = await fetch(`${baseUrl}/.netlify/functions/smart-brain`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: contextPrompt,
                system: PENSION_SYSTEM_PROMPT,
                model: 'auto',
                max_tokens: 600
            })
        });

        if (aiRes.ok) {
            const aiData = await aiRes.json();
            const aiText = aiData.response || aiData.text || aiData.content || '';
            if (aiText && aiText.length > 20) {
                return aiText.trim() + SITE_FOOTER;
            }
        }
    } catch (aiErr) {
        console.error('AI response error:', aiErr.message);
    }

    // ═══ 5. FALLBACK — structured responses ═══
    return await generateFallbackResponse(msg, userCountry);
}

// ═══ CONTEXT BUILDER ═══
function buildContextPrompt(userMessage, country, legalContext, history) {
    const c = COUNTRIES[country] || COUNTRIES['ro'];
    let prompt = `Țara utilizatorului: ${c.name} (${country.toUpperCase()})\n`;

    if (history && history.length > 0) {
        prompt += `\nIstoricul conversației:\n`;
        history.forEach(h => {
            prompt += `- Utilizator: ${h.user_message}\n  K: ${h.bot_response?.slice(0, 100)}...\n`;
        });
    }

    if (legalContext) {
        prompt += `\nContext legislativ relevant:\n${legalContext}\n`;
    }

    prompt += `\nÎntrebarea curentă: ${userMessage}`;
    prompt += `\n\nRăspunde clar, pe înțeles (audiență 55-80 ani). Citează legea/articolul. Max 500 caractere.`;

    return prompt;
}

// ═══ FETCH LEGAL CONTEXT ═══
async function fetchLegalContext(question, country) {
    try {
        const baseUrl = process.env.URL || 'https://kelionai.app';
        const res = await fetch(`${baseUrl}/.netlify/functions/legal-database-pension`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'search', query: question, country: country })
        });
        if (res.ok) {
            const data = await res.json();
            if (data.results && data.results.length > 0) {
                return data.results.slice(0, 2).map(r =>
                    `📑 ${r.title || r.name}: ${(r.summary || r.content || '').slice(0, 200)}`
                ).join('\n');
            }
        }
    } catch (e) {
        console.error('Legal context fetch error:', e.message);
    }
    return null;
}

// ═══ CONVERSATION HISTORY (Supabase) ═══
async function getConversationHistory(senderId, limit = 6) {
    const db = getSupabase();
    if (!db) return [];
    try {
        const { data } = await db.from('messenger_logs')
            .select('user_message, bot_response')
            .eq('sender_id', senderId)
            .order('created_at', { ascending: false })
            .limit(limit);
        return (data || []).reverse();
    } catch (e) { return []; }
}

// ═══ USER COUNTRY PERSISTENCE ═══
async function getUserCountry(senderId) {
    const db = getSupabase();
    if (!db) return null;
    try {
        const { data } = await db.from('messenger_users')
            .select('country')
            .eq('sender_id', senderId)
            .single();
        return data?.country || null;
    } catch (e) { return null; }
}

async function saveUserCountry(senderId, country) {
    const db = getSupabase();
    if (!db) return;
    try {
        await db.from('messenger_users').upsert({
            sender_id: senderId,
            country: country,
            updated_at: new Date().toISOString()
        }, { onConflict: 'sender_id' });
    } catch (e) { console.error('Save country error:', e.message); }
}

// ═══ LOG CONVERSATION ═══
async function logConversation(senderId, platform, userMessage, botResponse) {
    const db = getSupabase();
    if (!db) return;
    const now = new Date().toISOString();
    try {
        // Original log (keep for backward compatibility)
        await db.from('messenger_logs').insert({
            sender_id: senderId,
            platform: platform,
            user_message: userMessage.slice(0, 1000),
            bot_response: botResponse.slice(0, 2000),
            topic: classifyTopic(userMessage),
            created_at: now
        });

        // ═══ ENHANCED: Save for admin panel (messenger_conversations + messenger_messages) ═══
        // Find or create conversation
        const { data: existing } = await db.from('messenger_conversations')
            .select('id, message_count')
            .eq('sender_id', senderId)
            .eq('platform', platform)
            .order('last_message_at', { ascending: false })
            .limit(1).single();

        let convId;
        if (existing) {
            convId = existing.id;
            await db.from('messenger_conversations').update({
                last_message_at: now,
                message_count: (existing.message_count || 0) + 2,
                ai_model_used: 'smart-brain'
            }).eq('id', convId);
        } else {
            // Get sender name from Meta if possible
            let senderName = senderId;
            try {
                const PAGE_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
                if (PAGE_TOKEN) {
                    const nameRes = await fetch(`https://graph.facebook.com/v21.0/${senderId}?fields=first_name,last_name&access_token=${PAGE_TOKEN}`);
                    if (nameRes.ok) {
                        const nameData = await nameRes.json();
                        senderName = `${nameData.first_name || ''} ${nameData.last_name || ''}`.trim() || senderId;
                    }
                }
            } catch (e) { /* keep senderId */ }

            const { data: newConv } = await db.from('messenger_conversations').insert({
                platform, sender_id: senderId, sender_name: senderName,
                started_at: now, last_message_at: now,
                message_count: 2, ai_model_used: 'smart-brain'
            }).select().single();
            convId = newConv?.id;
        }

        // Save individual messages
        if (convId) {
            await db.from('messenger_messages').insert([
                { conversation_id: convId, sender_type: 'user', sender_name: senderId, message: userMessage.slice(0, 2000), created_at: now },
                { conversation_id: convId, sender_type: 'ai', sender_name: 'K AI', message: botResponse.slice(0, 2000), ai_response: botResponse.slice(0, 2000), ai_model: 'smart-brain', created_at: new Date(Date.now() + 500).toISOString() }
            ]);
        }

        // ═══ ALSO SAVE TO k_sessions — unified session panel ═══
        try {
            const topic = classifyTopic(userMessage);
            const platformLabel = platform === 'page' ? 'Facebook' : platform === 'instagram' ? 'Instagram' : 'Messenger';
            await db.from('k_sessions').insert({
                user_email: `messenger:${senderId}`,
                title: `💬 ${platformLabel}: ${userMessage.slice(0, 60)}`,
                category: 'general',
                subject: topic !== 'general' ? topic : 'Pensii',
                messages: JSON.stringify([
                    { role: 'user', content: userMessage.slice(0, 1000) },
                    { role: 'assistant', content: botResponse.slice(0, 2000) }
                ]),
                message_count: 2,
                status: 'completed'
            });
        } catch (ksErr) { console.log('[k_sessions] Messenger save skip:', ksErr.message); }
    } catch (e) { console.error('Log error:', e.message); }
}

function classifyTopic(msg) {
    const m = msg.toLowerCase();
    if (/documente|acte|dosar/.test(m)) return 'documente';
    if (/calcul|cat primesc|punctaj/.test(m)) return 'calcul_pensie';
    if (/drepturi|beneficii|transport|gratuit/.test(m)) return 'drepturi';
    if (/lege|legislatie|articol|oug/.test(m)) return 'legislatie';
    if (/recalculare|majorare|indexare/.test(m)) return 'recalculare';
    if (/contest|nemultumit|tribunal/.test(m)) return 'contestatie';
    if (/varsta|cand ma pensionez/.test(m)) return 'varsta';
    if (/cerere|model|formular/.test(m)) return 'cereri_modele';
    if (/militar|armata|politie/.test(m)) return 'pensii_speciale';
    if (/urmas|deces|mostenire/.test(m)) return 'pensie_urmas';
    if (/pilon|privat|fond/.test(m)) return 'pilon_2_3';
    return 'general';
}

// ═══ COUNTRY DETECTION ═══
function isCountrySelection(msg) {
    return /^(ro|uk|us|de|fr|es|it|romania|anglia|america|germania|franta|spania|italia)$/i.test(msg.trim());
}

function detectCountry(msg) {
    const m = msg.trim().toLowerCase();
    const map = {
        'ro': 'ro', 'romania': 'ro',
        'uk': 'uk', 'anglia': 'uk', 'marea britanie': 'uk',
        'us': 'us', 'usa': 'us', 'america': 'us',
        'de': 'de', 'germania': 'de', 'deutschland': 'de',
        'fr': 'fr', 'franta': 'fr', 'france': 'fr',
        'es': 'es', 'spania': 'es',
        'it': 'it', 'italia': 'it'
    };
    return map[m] || null;
}

// ═══ OFF-TOPIC CHECK ═══
function isOffTopic(msg) {
    const offTopicWords = ['bitcoin', 'crypto', 'forex', 'sport', 'fotbal', 'reteta', 'film', 'muzica', 'joc', 'dating'];
    return offTopicWords.some(w => msg.includes(w));
}

// ═══ FALLBACK RESPONSES ═══
async function generateFallbackResponse(msg, country) {
    // Documente
    if (matchesAny(msg, ['documente', 'acte', 'dosar', 'ce trebuie'])) {
        try {
            const baseUrl = process.env.URL || 'https://kelionai.app';
            const type = msg.includes('invalid') ? 'invaliditate' : msg.includes('antic') ? 'anticipata' : msg.includes('urmas') ? 'urmas' : 'limita_varsta';
            const res = await fetch(`${baseUrl}/.netlify/functions/document-checker`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_checklist', pension_type: type, country })
            });
            if (res.ok) {
                const data = await res.json();
                return formatDocumentResponse(data) + SITE_FOOTER;
            }
        } catch (e) { /* fallback below */ }
    }

    // Calcul
    if (matchesAny(msg, ['calcul', 'cat primesc', 'pensia mea', 'estimare', 'punctaj'])) {
        return '🧮 Pentru calcul pensie am nevoie de:\n\n' +
            '1️⃣ Vârsta ta\n2️⃣ Ani de muncă (stagiu cotizare)\n' +
            '3️⃣ Salariul mediu brut\n4️⃣ Gen (M/F)\n\n' +
            'Exemplu: "Am 63 ani, bărbat, 35 ani muncă, salariu mediu 4000 lei"' + SITE_FOOTER;
    }

    // Vârstă
    if (matchesAny(msg, ['varsta', 'cand ma pensionez', 'la ce varsta'])) {
        return '📅 Vârsta standard pensionare:\n\n' +
            '👨 Bărbați: 65 ani\n👩 Femei: 63 ani (crește la 65)\n\n' +
            '⬇️ Reduceri: Grupa I (-8 ani), Grupa II (-4 ani), Handicap (-10/15 ani)\n\n' +
            'Spune-mi grupa de muncă și îți calculez exact.' + SITE_FOOTER;
    }

    // Drepturi
    if (matchesAny(msg, ['drepturi', 'beneficii', 'transport', 'gratuit'])) {
        return '🛡️ Drepturi pensionari:\n\n' +
            '🚌 6 călătorii tren gratuite/an\n' +
            '🏥 Medicamente compensate 90-100%\n' +
            '💰 Scutire impozit pe pensie sub 2.000 RON\n' +
            '🏠 Ajutor încălzire\n\n' +
            'Întreabă-mă detalii! 👇' + SITE_FOOTER;
    }

    // Legislație
    if (matchesAny(msg, ['lege', 'legislatie', 'articol', 'oug'])) {
        try {
            const baseUrl = process.env.URL || 'https://kelionai.app';
            const res = await fetch(`${baseUrl}/.netlify/functions/legal-database-pension`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'search', query: msg, country })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.results?.length) {
                    let response = '⚖️ Legislație:\n\n';
                    data.results.slice(0, 3).forEach(r => {
                        response += `📑 ${r.title || r.name}\n${(r.summary || '').slice(0, 150)}\n\n`;
                    });
                    return response + SITE_FOOTER;
                }
            }
        } catch (e) { /* fallback */ }
    }

    // Recalculare
    if (matchesAny(msg, ['recalculare', 'recalcul', 'majorare', 'indexare'])) {
        return '📊 Recalculare pensie:\n\n' +
            '✅ Se aplică automat (OUG 163/2020)\n' +
            '✅ Formula: Punctaj × Valoare punct\n' +
            '✅ Dacă recalcularea dă mai puțin, rămâi cu pensia mai mare\n\n' +
            'Nu a crescut? Depune cerere recalculare + contestă la CTP.' + SITE_FOOTER;
    }

    // Contestație
    if (matchesAny(msg, ['contest', 'nemultumit', 'gresit', 'tribunal'])) {
        return '⚖️ Contestare decizie pensie:\n\n' +
            '1. Contestație la CTP — 45 zile\n2. Tribunal — 45 zile după CTP\n' +
            '3. Scutit taxă judiciară\n4. Drept la expertiză contabilă\n\n' +
            'Vrei model contestație? Scrie "model contestatie".' + SITE_FOOTER;
    }

    // Default
    return '🤖 Sunt K, expert pensii.\n\n' +
        'Pot răspunde la:\n' +
        '• Ce documente trebuie la pensie?\n• Cum îmi calculez pensia?\n' +
        '• Ce drepturi am ca pensionar?\n• Cum contest decizia?\n' +
        '• La ce vârstă mă pensionez?\n\n' +
        'Scrie-mi întrebarea! 💬' + SITE_FOOTER;
}

function formatDocumentResponse(data) {
    if (data.obligatorii) {
        let msg = `📋 ${data.title || 'Documente necesare'}\n\n`;
        data.obligatorii.forEach((d, i) => { msg += `${i + 1}. ${d.name}\n   ${d.details}\n\n`; });
        if (data.tip_important) msg += data.tip_important;
        return msg;
    }
    return '📋 Contactează Casa de Pensii pentru lista actualizată de documente.';
}

// ═══ SEND MESSAGE VIA META API ═══
async function sendMessage(recipientId, text, platform) {
    const PAGE_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
    if (!PAGE_TOKEN) { console.error('❌ META_PAGE_ACCESS_TOKEN not set'); return; }

    const url = 'https://graph.facebook.com/v21.0/me/messages';
    try {
        const res = await fetch(`${url}?access_token=${PAGE_TOKEN}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipient: { id: recipientId },
                message: { text },
                messaging_type: 'RESPONSE'
            })
        });
        const data = await res.json();
        if (data.error) console.error('Meta API error:', data.error);
        else console.log(`✅ Message sent to ${recipientId}`);
    } catch (err) { console.error('Send message error:', err.message); }
}

// ═══ HELPERS ═══
function matchesAny(text, keywords) { return keywords.some(k => text.includes(k)); }

function splitMessage(text, maxLen) {
    if (text.length <= maxLen) return [text];
    const chunks = [];
    let current = '';
    const lines = text.split('\n');
    for (const line of lines) {
        if ((current + '\n' + line).length > maxLen) {
            if (current) chunks.push(current.trim());
            current = line;
        } else { current += '\n' + line; }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks;
}
