/**
 * Buy Credits — PayPal one-time payment for API credit packages
 * Uses PayPal Orders API (not subscriptions) for one-time purchases
 * After payment approval, credits are added to the user's API key
 */

const { patchProcessEnv } = require('./get-secret');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Credit packages — prices in USD (PayPal converts automatically)
const PACKAGES = {
    starter: { credits: 1000, price: '5.00', name: 'Starter — 1,000 credits' },
    developer: { credits: 10000, price: '40.00', name: 'Developer — 10,000 credits' },
    business: { credits: 100000, price: '300.00', name: 'Business — 100,000 credits' }
};

function getSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
}

async function getPayPalToken() {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const secret = process.env.PAYPAL_SECRET;
    const api = process.env.PAYPAL_MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
    const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');
    const res = await fetch(`${api}/v1/oauth2/token`, {
        method: 'POST',
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials'
    });
    const data = await res.json();
    return data.access_token;
}

function getPayPalAPI() {
    return process.env.PAYPAL_MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
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
        await patchProcessEnv(); // Load vault secrets from Supabase

        if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_SECRET) {
            return { statusCode: 503, headers, body: JSON.stringify({ error: 'PayPal not configured' }) };
        }

        const PAYPAL_API = getPayPalAPI();
        const { action, package: pkg, email, order_id } = JSON.parse(event.body || '{}');

        // ═══ CREATE ORDER ═══
        if (action === 'create_order') {
            if (!pkg || !PACKAGES[pkg]) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid package', available: Object.keys(PACKAGES) }) };
            if (!email) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email required' }) };

            const pack = PACKAGES[pkg];
            const token = await getPayPalToken();

            const res = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    intent: 'CAPTURE',
                    purchase_units: [{
                        amount: { currency_code: 'USD', value: pack.price },
                        description: `Kelion AI API Credits: ${pack.name}`,
                        custom_id: JSON.stringify({ email, package: pkg, credits: pack.credits })
                    }],
                    application_context: {
                        brand_name: 'Kelion AI',
                        landing_page: 'NO_PREFERENCE',
                        shipping_preference: 'NO_SHIPPING',
                        user_action: 'PAY_NOW',
                        return_url: `https://kelionai.app/developers.html?payment=success&order_id={order_id}&pkg=${pkg}`,
                        cancel_url: 'https://kelionai.app/developers.html?payment=canceled'
                    }
                })
            });

            const order = await res.json();
            const approveUrl = order.links?.find(l => l.rel === 'approve')?.href;

            return {
                statusCode: 200, headers,
                body: JSON.stringify({
                    success: true,
                    order_id: order.id,
                    approve_url: approveUrl,
                    package: pkg,
                    credits: pack.credits,
                    price: pack.price
                })
            };
        }

        // ═══ CAPTURE ORDER (after PayPal approval) ═══
        if (action === 'capture_order') {
            if (!order_id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'order_id required' }) };

            const token = await getPayPalToken();

            const res = await fetch(`${PAYPAL_API}/v2/checkout/orders/${order_id}/capture`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
            });

            const capture = await res.json();

            if (capture.status !== 'COMPLETED') {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Payment not completed', status: capture.status }) };
            }

            // Extract custom data
            const customId = capture.purchase_units?.[0]?.payments?.captures?.[0]?.custom_id || '{}';
            let customData;
            try { customData = JSON.parse(customId); } catch { customData = {}; }

            const creditEmail = customData.email || email;
            const creditsToAdd = customData.credits || 0;
            const packageName = customData.package || 'unknown';

            // Add credits to user's API key(s)
            const supabase = getSupabase();
            if (supabase && creditEmail && creditsToAdd > 0) {
                // Find active keys for this email
                const { data: keys } = await supabase
                    .from('api_keys')
                    .select('id, key_prefix, credits_remaining, credits_total')
                    .eq('owner_email', creditEmail)
                    .eq('status', 'active')
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (keys && keys.length > 0) {
                    // Add credits to most recent active key
                    const key = keys[0];
                    await supabase.from('api_keys').update({
                        credits_remaining: key.credits_remaining + creditsToAdd,
                        credits_total: key.credits_total + creditsToAdd
                    }).eq('id', key.id);
                } else {
                    // Auto-generate a key if none exists
                    const newKey = `klion_${crypto.randomBytes(24).toString('base64url')}`;
                    const keyHash = crypto.createHash('sha256').update(newKey).digest('hex');
                    await supabase.from('api_keys').insert({
                        key_hash: keyHash,
                        key_prefix: newKey.substring(0, 14),
                        owner_email: creditEmail,
                        key_name: 'Auto-generated',
                        credits_remaining: creditsToAdd,
                        credits_total: creditsToAdd,
                        status: 'active',
                        rate_limit: 60,
                        created_at: new Date().toISOString()
                    });
                }

                // Log revenue
                try {
                    await fetch(`https://${process.env.URL || 'kelionai.app'}/.netlify/functions/cost-tracker`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'log_revenue',
                            amount: parseFloat(PACKAGES[packageName]?.price || 0),
                            currency: 'USD',
                            plan: `api_credits_${packageName}`,
                            user_email: creditEmail,
                            source: 'paypal',
                            transaction_id: order_id
                        })
                    });
                } catch (e) { console.error('Revenue log error:', e); }
            }

            return {
                statusCode: 200, headers,
                body: JSON.stringify({
                    success: true,
                    credits_added: creditsToAdd,
                    package: packageName,
                    email: creditEmail,
                    transaction_id: order_id
                })
            };
        }

        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid action', available: ['create_order', 'capture_order'] }) };

    } catch (error) {
        console.error('Buy credits error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
