/**
 * Push Notifications — Manages web push subscriptions
 * Uses native fetch for Web Push (no external dependencies)
 * Stores subscriptions in Supabase
 */

const { patchProcessEnv } = require('./get-secret');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

function getDB() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
}

// ═══ VAPID JWT Generation (RFC 8292) ═══
function base64url(buffer) {
    return Buffer.from(buffer).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function generateVapidJWT(audience, subject, privateKeyBase64) {
    // Header
    const header = base64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));

    // Payload — 12h expiry
    const payload = base64url(JSON.stringify({
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + (12 * 60 * 60),
        sub: subject
    }));

    const token = `${header}.${payload}`;

    // Sign with ECDSA P-256
    const sign = crypto.createSign('SHA256');
    sign.update(token);
    const pem = `-----BEGIN EC PRIVATE KEY-----\n${privateKeyBase64}\n-----END EC PRIVATE KEY-----`;

    try {
        const sig = sign.sign({ key: pem, dsaEncoding: 'ieee-p1363' });
        return `${token}.${base64url(sig)}`;
    } catch (e) {
        console.error('[push] JWT signing failed:', e.message);
        return null;
    }
}

async function sendWebPush(subscription, payload, vapidPublic, vapidPrivate, vapidEmail) {
    const endpoint = new URL(subscription.endpoint);
    const audience = `${endpoint.protocol}//${endpoint.hostname}`;

    const jwt = generateVapidJWT(audience, vapidEmail, vapidPrivate);
    if (!jwt) return { success: false, error: 'JWT generation failed' };

    const res = await fetch(subscription.endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/octet-stream',
            'TTL': '86400',
            'Authorization': `vapid t=${jwt}, k=${vapidPublic}`
        },
        body: payload
    });

    return { success: res.status === 201, statusCode: res.status };
}

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

    try {
        await patchProcessEnv();

        const vapidPublic = process.env.VAPID_PUBLIC_KEY;
        const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
        const vapidEmail = process.env.VAPID_EMAIL || 'mailto:' + (process.env.ADMIN_EMAIL || '');

        const body = JSON.parse(event.body || '{}');
        const db = getDB();

        switch (body.action) {
            // ═══ GET VAPID PUBLIC KEY ═══
            case 'get_vapid_key': {
                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({ success: true, vapid_public_key: vapidPublic || null })
                };
            }

            // ═══ SUBSCRIBE ═══
            case 'subscribe': {
                const { subscription, user_email } = body;
                if (!subscription || !subscription.endpoint) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'subscription object required' }) };
                }

                if (db) {
                    await db.from('push_subscriptions').upsert({
                        endpoint: subscription.endpoint,
                        subscription_data: JSON.stringify(subscription),
                        user_email: user_email || 'anonymous',
                        created_at: new Date().toISOString(),
                        active: true
                    }, { onConflict: 'endpoint' });
                }

                return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Subscribed to push notifications' }) };
            }

            // ═══ UNSUBSCRIBE ═══
            case 'unsubscribe': {
                const { endpoint } = body;
                if (!endpoint) return { statusCode: 400, headers, body: JSON.stringify({ error: 'endpoint required' }) };

                if (db) {
                    await db.from('push_subscriptions').update({ active: false }).eq('endpoint', endpoint);
                }

                return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Unsubscribed' }) };
            }

            // ═══ SEND NOTIFICATION (admin only) ═══
            case 'send': {
                if (!vapidPublic || !vapidPrivate) {
                    return { statusCode: 503, headers, body: JSON.stringify({ error: 'VAPID keys not configured in vault' }) };
                }

                const { title, message, url, icon, target_email } = body;
                if (!title || !message) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'title and message required' }) };
                }

                const payload = JSON.stringify({
                    title,
                    body: message,
                    icon: icon || '/hologram-192.png',
                    badge: '/hologram-192.png',
                    url: url || 'https://kelionai.app',
                    timestamp: Date.now()
                });

                let sent = 0, failed = 0;

                if (db) {
                    let query = db.from('push_subscriptions').select('*').eq('active', true);
                    if (target_email) query = query.eq('user_email', target_email);
                    const { data: subs } = await query;

                    for (const sub of (subs || [])) {
                        try {
                            const subscription = JSON.parse(sub.subscription_data);
                            const result = await sendWebPush(subscription, payload, vapidPublic, vapidPrivate, vapidEmail);
                            if (result.success) sent++;
                            else {
                                failed++;
                                if (result.statusCode === 404 || result.statusCode === 410) {
                                    await db.from('push_subscriptions').update({ active: false }).eq('endpoint', sub.endpoint);
                                }
                            }
                        } catch (err) {
                            failed++;
                        }
                    }
                }

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({ success: true, sent, failed, total: sent + failed })
                };
            }

            // ═══ STATS ═══
            case 'stats': {
                if (!db) return { statusCode: 200, headers, body: JSON.stringify({ success: true, total: 0, active: 0 }) };

                const { count: total } = await db.from('push_subscriptions').select('*', { count: 'exact', head: true });
                const { count: active } = await db.from('push_subscriptions').select('*', { count: 'exact', head: true }).eq('active', true);

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({ success: true, total: total || 0, active: active || 0 })
                };
            }

            default:
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid action', available: ['get_vapid_key', 'subscribe', 'unsubscribe', 'send', 'stats'] }) };
        }
    } catch (error) {
        console.error('Push notification error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
