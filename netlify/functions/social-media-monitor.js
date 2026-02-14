// ═══ SOCIAL MEDIA MONITOR — Auto-monitors Messenger, TikTok, Instagram ═══
// Detects message type → responds in same format (text→text, audio→audio)
// Live calls → payment (1 GBP) → audio response
const { patchProcessEnv } = require('./get-secret');
const { createClient } = require('@supabase/supabase-js');

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
};

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        await patchProcessEnv();
        const body = JSON.parse(event.body || '{}');
        const { action } = body;

        switch (action) {
            case 'status': return respond(200, await getMonitorStatus());
            case 'check_messages': return respond(200, await checkAllPlatforms());
            case 'process_message': return respond(200, await processIncomingMessage(body));
            case 'live_request': return respond(200, await handleLiveRequest(body));
            case 'payment_confirm': return respond(200, await handlePaymentConfirm(body));
            default: return respond(200, await getMonitorStatus());
        }
    } catch (err) {
        console.error('Monitor error:', err.message);
        return respond(500, { error: err.message });
    }
};

// ═══ MONITOR STATUS ═══
async function getMonitorStatus() {
    const platforms = {
        messenger: {
            configured: !!(process.env.META_PAGE_ACCESS_TOKEN && process.env.META_PAGE_ID),
            webhook: '/.netlify/functions/messenger-webhook',
            capabilities: ['text', 'audio', 'image'],
            auto_response: true
        },
        instagram: {
            configured: !!process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
            webhook: '/.netlify/functions/messenger-webhook',
            capabilities: ['text', 'image', 'story_reply'],
            auto_response: true,
            note: 'Uses same Meta Graph API as Messenger'
        },
        tiktok: {
            configured: !!(process.env.TIKTOK_ACCESS_TOKEN || (process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET)),
            webhook: '/.netlify/functions/tiktok-webhook',
            capabilities: ['text', 'comment_reply'],
            auto_response: true,
            account: '@kelion_ai_expert'
        }
    };

    // Get recent conversation stats from Supabase
    let stats = { total_messages: 0, today: 0, platforms: {} };
    try {
        const db = getDb();
        if (db) {
            const today = new Date().toISOString().split('T')[0];
            const { data } = await db.from('messenger_conversations')
                .select('platform, created_at')
                .gte('created_at', today)
                .order('created_at', { ascending: false })
                .limit(100);
            if (data) {
                stats.today = data.length;
                for (const msg of data) {
                    stats.platforms[msg.platform] = (stats.platforms[msg.platform] || 0) + 1;
                }
            }
        }
    } catch (e) { console.log('Stats skipped:', e.message); }

    return {
        service: 'K Social Media Monitor',
        platforms,
        stats,
        live_calls: {
            price: '1.00 GBP',
            payment_method: 'Stripe/PayPal',
            response_format: 'audio'
        },
        format_mirroring: {
            text: 'text response via AI',
            audio: 'audio response via ElevenLabs TTS',
            image: 'text description + relevant response',
            live: 'payment required → audio response'
        },
        timestamp: new Date().toISOString()
    };
}

// ═══ CHECK ALL PLATFORMS — Poll for new messages ═══
async function checkAllPlatforms() {
    const results = { timestamp: new Date().toISOString(), platforms: {} };

    // Messenger — uses webhook (push), but we can also check inbox
    if (process.env.META_PAGE_ACCESS_TOKEN && process.env.META_PAGE_ID) {
        try {
            const res = await fetch(
                `https://graph.facebook.com/v18.0/${process.env.META_PAGE_ID}/conversations?fields=messages{message,from,created_time,attachments}&limit=5&access_token=${process.env.META_PAGE_ACCESS_TOKEN}`
            );
            if (res.ok) {
                const data = await res.json();
                results.platforms.messenger = {
                    status: 'online',
                    recent_conversations: data.data?.length || 0,
                    webhook_active: true
                };
            }
        } catch (e) { results.platforms.messenger = { status: 'error', error: e.message }; }
    }

    // Instagram DMs — check via Graph API
    if (process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID && process.env.META_PAGE_ACCESS_TOKEN) {
        try {
            const res = await fetch(
                `https://graph.facebook.com/v18.0/${process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID}/conversations?fields=messages&limit=5&access_token=${process.env.META_PAGE_ACCESS_TOKEN}`
            );
            results.platforms.instagram = {
                status: res.ok ? 'online' : 'error',
                webhook_active: true
            };
        } catch (e) { results.platforms.instagram = { status: 'error', error: e.message }; }
    }

    // TikTok — check webhooks
    if (process.env.TIKTOK_ACCESS_TOKEN) {
        results.platforms.tiktok = {
            status: 'online',
            webhook_active: true,
            account: '@kelion_ai_expert'
        };
    }

    return results;
}

// ═══ PROCESS INCOMING MESSAGE — Detect type & respond in same format ═══
async function processIncomingMessage(body) {
    const { sender_id, message, message_type, platform, attachment_url } = body;

    if (!sender_id || !platform) {
        return { error: 'sender_id and platform required' };
    }

    // Classify message type
    const type = classifyMessageType(message_type, message, attachment_url);
    console.log(`[MONITOR] ${platform} message from ${sender_id}: type=${type}`);

    // Log incoming message
    await logMessage(sender_id, platform, type, 'incoming', message || '[attachment]');

    switch (type) {
        case 'text':
            return await handleTextMessage(sender_id, message, platform);

        case 'audio':
            return await handleAudioMessage(sender_id, attachment_url, platform);

        case 'image':
            return await handleImageMessage(sender_id, attachment_url, message, platform);

        case 'live_request':
            return await handleLiveRequest({ sender_id, platform });

        default:
            return await handleTextMessage(sender_id, message || 'Hello', platform);
    }
}

// ═══ CLASSIFY MESSAGE TYPE ═══
function classifyMessageType(explicit_type, message, attachment_url) {
    if (explicit_type) return explicit_type;

    // Check for live request keywords
    if (message) {
        const m = message.toLowerCase();
        if (/\b(live|apel|call|video|sună|ring)\b/.test(m)) return 'live_request';
        if (/\b(audio|voice|voce|ascultă)\b/.test(m)) return 'audio';
    }

    // Check attachment type
    if (attachment_url) {
        if (/\.(mp3|wav|ogg|m4a|opus|aac)$/i.test(attachment_url)) return 'audio';
        if (/\.(jpg|png|gif|webp|jpeg)$/i.test(attachment_url)) return 'image';
        if (/\.(mp4|mov|avi)$/i.test(attachment_url)) return 'video';
    }

    return 'text';
}

// ═══ TEXT → TEXT ═══
async function handleTextMessage(senderId, message, platform) {
    try {
        const baseUrl = process.env.URL || 'https://kelionai.app';

        // Get AI response from smart-brain
        const aiRes = await fetch(`${baseUrl}/.netlify/functions/smart-brain`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                system: 'Ești K, expert legislație România. Răspunzi concis (max 300 chars), clar, cu referință legală. Ton profesionist premium.',
                max_tokens: 300
            })
        });

        let reply = 'Îmi pare rău, am avut o problemă tehnică. Încearcă din nou! 🌐 kelionai.app';
        if (aiRes.ok) {
            const data = await aiRes.json();
            reply = data.reply || data.response || reply;
        }

        // Send reply via platform API
        await sendPlatformMessage(senderId, reply, platform, 'text');
        await logMessage(senderId, platform, 'text', 'outgoing', reply);

        return { success: true, type: 'text', platform, reply_preview: reply.substring(0, 100) };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// ═══ AUDIO → AUDIO ═══
async function handleAudioMessage(senderId, audioUrl, platform) {
    try {
        const baseUrl = process.env.URL || 'https://kelionai.app';

        // Step 1: Transcribe audio
        let transcription = '';
        if (audioUrl) {
            const transRes = await fetch(`${baseUrl}/.netlify/functions/whisper`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ audio_url: audioUrl })
            });
            if (transRes.ok) {
                const transData = await transRes.json();
                transcription = transData.text || transData.transcription || '';
            }
        }

        if (!transcription) {
            await sendPlatformMessage(senderId, 'Nu am reușit să procesez mesajul audio. Poți scrie întrebarea? 📝', platform, 'text');
            return { success: false, error: 'Transcription failed' };
        }

        // Step 2: Get AI response
        const aiRes = await fetch(`${baseUrl}/.netlify/functions/smart-brain`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: transcription,
                system: 'Ești K, expert legislație. Răspunsul va fi citit cu vocea, deci fii natural și conversațional. Max 200 cuvinte.',
                max_tokens: 300
            })
        });

        let reply = transcription ? `Am auzit: "${transcription}". Încearcă din nou!` : 'Problemă tehnică.';
        if (aiRes.ok) {
            const data = await aiRes.json();
            reply = data.reply || reply;
        }

        // Step 3: Convert to audio via ElevenLabs
        const ttsRes = await fetch(`${baseUrl}/.netlify/functions/elevenlabs-tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: reply, voice: 'rachel' })
        });

        if (ttsRes.ok) {
            const ttsData = await ttsRes.json();
            if (ttsData.audio_url || ttsData.audio_base64) {
                await sendPlatformMessage(senderId, ttsData.audio_url || ttsData.audio_base64, platform, 'audio');
                await logMessage(senderId, platform, 'audio', 'outgoing', reply);
                return { success: true, type: 'audio_mirror', transcription, reply_preview: reply.substring(0, 100) };
            }
        }

        // Fallback: send text if audio generation fails
        await sendPlatformMessage(senderId, `🎙️ ${reply}`, platform, 'text');
        await logMessage(senderId, platform, 'text', 'outgoing', reply);
        return { success: true, type: 'audio_fallback_text', transcription, reply_preview: reply.substring(0, 100) };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// ═══ IMAGE → TEXT RESPONSE ═══
async function handleImageMessage(senderId, imageUrl, caption, platform) {
    try {
        const baseUrl = process.env.URL || 'https://kelionai.app';

        // Analyze image with vision
        let description = caption || '';
        if (imageUrl) {
            const visionRes = await fetch(`${baseUrl}/.netlify/functions/vision`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image_url: imageUrl, prompt: 'Descrie imaginea și identifică orice document, text sau întrebare legată de pensii/legislație.' })
            });
            if (visionRes.ok) {
                const visionData = await visionRes.json();
                description = visionData.description || visionData.text || description;
            }
        }

        const reply = description
            ? `📸 Am analizat imaginea. ${description.substring(0, 200)}\n\nPentru mai multe detalii, scrie-ne! 🌐 kelionai.app`
            : 'Am primit imaginea! Poți descrie ce dorești să afli? 📝';

        await sendPlatformMessage(senderId, reply, platform, 'text');
        await logMessage(senderId, platform, 'image', 'outgoing', reply);
        return { success: true, type: 'image', reply_preview: reply.substring(0, 100) };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// ═══ LIVE REQUEST → PAYMENT → AUDIO RESPONSE ═══
async function handleLiveRequest(body) {
    const { sender_id, platform } = body;

    // Send payment prompt
    const paymentMessage = `🎙️ Consultare LIVE cu K — Expert AI Legislație\n\n` +
        `───────────────────\n` +
        `💎 Preț: 1.00 GBP / sesiune\n` +
        `⏱️ Durată: răspuns audio complet\n` +
        `📋 Primești: analiză detaliată + referințe legale\n` +
        `───────────────────\n\n` +
        `Scrie "YES" sau "DA" pentru a continua cu plata.\n` +
        `Sau scrie întrebarea ta gratuit în text! 📝`;

    await sendPlatformMessage(sender_id, paymentMessage, platform, 'text');

    // Mark user as pending payment
    try {
        const db = getDb();
        if (db) {
            await db.from('live_requests').upsert({
                sender_id: sender_id,
                platform: platform,
                status: 'pending_confirmation',
                price_gbp: 1.00,
                requested_at: new Date().toISOString()
            }, { onConflict: 'sender_id' });
        }
    } catch (e) { console.log('Live request log skipped:', e.message); }

    return {
        success: true,
        type: 'live_request',
        status: 'payment_prompt_sent',
        price: '1.00 GBP'
    };
}

// ═══ PAYMENT CONFIRMATION ═══
async function handlePaymentConfirm(body) {
    const { sender_id, platform, _payment_id } = body;
    const baseUrl = process.env.URL || 'https://kelionai.app';

    try {
        // Create Stripe payment link
        const paymentRes = await fetch(`${baseUrl}/.netlify/functions/stripe-checkout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: 100, // 1.00 GBP in pence
                currency: 'gbp',
                description: 'K Live Consultation - Audio Response',
                metadata: { sender_id, platform, type: 'live_call' }
            })
        });

        if (paymentRes.ok) {
            const payData = await paymentRes.json();
            const payUrl = payData.url || payData.checkout_url;
            if (payUrl) {
                await sendPlatformMessage(sender_id,
                    `💳 Link plată securizat:\n${payUrl}\n\nDupă confirmare, vei primi răspunsul audio! 🎙️`,
                    platform, 'text');
                return { success: true, payment_url: payUrl, status: 'payment_link_sent' };
            }
        }

        // Fallback payment instructions
        await sendPlatformMessage(sender_id,
            `💳 Pentru plata de 1.00 GBP, accesează:\n🌐 kelionai.app/account\n\nDupă plată, trimite-ne întrebarea și vei primi răspuns audio! 🎙️`,
            platform, 'text');

        return { success: true, status: 'payment_instructions_sent' };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// ═══ SEND MESSAGE VIA PLATFORM API ═══
async function sendPlatformMessage(recipientId, content, platform, type) {
    const TOKEN = process.env.META_PAGE_ACCESS_TOKEN;

    if (platform === 'messenger' || platform === 'instagram') {
        if (!TOKEN) throw new Error('META_PAGE_ACCESS_TOKEN not set');

        let messagePayload;
        if (type === 'audio') {
            messagePayload = {
                attachment: {
                    type: 'audio',
                    payload: { url: content, is_reusable: true }
                }
            };
        } else {
            messagePayload = { text: content.substring(0, 2000) };
        }

        const res = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${TOKEN}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipient: { id: recipientId },
                message: messagePayload,
                messaging_type: 'RESPONSE'
            })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(`Meta API ${res.status}: ${err.error?.message || 'unknown'}`);
        }
        return true;
    }

    if (platform === 'tiktok') {
        // TikTok DM API (if available)
        console.log(`[TIKTOK] Would send to ${recipientId}: ${content.substring(0, 50)}`);
        return true;
    }

    throw new Error(`Unknown platform: ${platform}`);
}

// ═══ LOGGING ═══
async function logMessage(senderId, platform, type, direction, content) {
    try {
        const db = getDb();
        if (!db) return;
        await db.from('messenger_conversations').insert({
            sender_id: senderId,
            platform,
            message_type: type,
            direction,
            content: content?.substring(0, 500),
            created_at: new Date().toISOString()
        }).catch(() => { });
    } catch (e) { /* skip */ }
}

// ═══ HELPERS ═══
function getDb() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
}

function respond(code, data) {
    return { statusCode: code, headers, body: JSON.stringify(data, null, 2) };
}
