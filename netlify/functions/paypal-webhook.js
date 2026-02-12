// Netlify Function: PayPal Webhook Handler
// POST /.netlify/functions/paypal-webhook
// Receives PayPal subscription events and updates user subscription_status in Supabase

const { patchProcessEnv } = require('./get-secret');

const { createClient } = require('@supabase/supabase-js');

let supabase = null;

function getSupabase() {
    if (!supabase) {
        const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
        if (process.env.SUPABASE_URL && SB_KEY && SB_KEY.trim().length > 0) {
            supabase = createClient(process.env.SUPABASE_URL, SB_KEY);
        }
    }
    return supabase;
}

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
};

// PayPal config loaded after vault
function getPayPalWebhookConfig() {
    return {
        PAYPAL_WEBHOOK_ID: process.env.PAYPAL_WEBHOOK_ID,
        PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID,
        PAYPAL_SECRET: process.env.PAYPAL_SECRET
    };
}
const PAYPAL_API = process.env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

// Consolidated: use PAYPAL_PLANS JSON env var
const _plans = process.env.PAYPAL_PLANS
    ? JSON.parse(process.env.PAYPAL_PLANS)
    : { monthly: process.env.PAYPAL_PLAN_MONTHLY, annual: process.env.PAYPAL_PLAN_ANNUAL };
const PLAN_TYPE_MAP = {
    [_plans.monthly]: 'monthly',
    [_plans.annual]: 'annual'
};

// Plan prices in GBP for revenue logging
const PLAN_PRICES = {
    monthly: 15, annual: 100,
    family_monthly: 25, family_annual: 180,
    business_monthly: 99, business_annual: 800
};

// Fire-and-forget: log revenue to cost-tracker
function logRevenue(amount, plan, email, transactionId) {
    fetch(`https://${process.env.URL || 'kelionai.app'}/.netlify/functions/cost-tracker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'log_revenue', amount, currency: 'GBP', plan, user_email: email, source: 'paypal', transaction_id: transactionId })
    }).catch(e => console.warn('Revenue log failed:', e.message));
}

async function getAccessToken() {
    const { PAYPAL_CLIENT_ID, PAYPAL_SECRET } = getPayPalWebhookConfig();
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64');
    const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    });
    const data = await response.json();
    return data.access_token;
}

async function verifyWebhookSignature(headers, body) {
    // Verify webhook signature via PayPal API
    const { PAYPAL_WEBHOOK_ID } = getPayPalWebhookConfig();
    if (!PAYPAL_WEBHOOK_ID) {
        console.warn('PAYPAL_WEBHOOK_ID not set - skipping signature verification');
        return true;
    }

    const accessToken = await getAccessToken();

    const verifyResponse = await fetch(`${PAYPAL_API}/v1/notifications/verify-webhook-signature`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            auth_algo: headers['paypal-auth-algo'],
            cert_url: headers['paypal-cert-url'],
            transmission_id: headers['paypal-transmission-id'],
            transmission_sig: headers['paypal-transmission-sig'],
            transmission_time: headers['paypal-transmission-time'],
            webhook_id: PAYPAL_WEBHOOK_ID,
            webhook_event: JSON.parse(body)
        })
    });

    const result = await verifyResponse.json();
    return result.verification_status === 'SUCCESS';
}

async function updateUserSubscription(email, subscriptionType, subscriptionId, status, customId = null) {
    const bcrypt = require('bcryptjs');
    const db = getSupabase();
    if (!db) { console.error('Supabase not available'); return false; }

    // Find user by email
    const { data: user } = await db
        .from('users')
        .select('id, email, subscription_status')
        .eq('email', email.toLowerCase())
        .single();

    if (!user) {
        // User doesn't exist - create them (new unified flow)
        console.log('Creating new user:', email);

        let passwordHash = null;
        let planType = subscriptionType;

        // Extract password from custom_id if provided
        if (customId) {
            try {
                const customData = JSON.parse(customId);
                if (customData.password) {
                    passwordHash = await bcrypt.hash(customData.password, 10);
                }
                if (customData.planType) {
                    planType = customData.planType;
                }
            } catch (e) {
                console.warn('Could not parse custom_id:', e);
            }
        }

        const { error: insertError } = await db
            .from('users')
            .insert({
                email: email.toLowerCase(),
                password_hash: passwordHash,
                subscription_status: status === 'ACTIVE' ? planType : 'free',
                paypal_subscription_id: subscriptionId,
                subscription_updated_at: new Date().toISOString(),
                created_at: new Date().toISOString()
            });

        if (insertError) {
            console.error('Error creating user:', insertError);
            return false;
        }

        console.log(`Created new user ${email} with subscription: ${planType}`);
        return true;
    }

    // Update existing user subscription status
    const { error: updateError } = await db
        .from('users')
        .update({
            subscription_status: status === 'ACTIVE' ? subscriptionType : 'free',
            paypal_subscription_id: subscriptionId,
            subscription_updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

    if (updateError) {
        console.error('Error updating user subscription:', updateError);
        return false;
    }

    console.log(`Updated subscription for ${email}: ${subscriptionType} (${status})`);
    return true;
}

exports.handler = async (event) => {
    // Handle CORS preflight BEFORE any initialization
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

    // PayPal sends POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        await patchProcessEnv(); // Load vault secrets
        const headers = {};
        // Normalize header names to lowercase
        Object.keys(event.headers).forEach(key => {
            headers[key.toLowerCase()] = event.headers[key];
        });

        // Verify webhook signature when PAYPAL_WEBHOOK_ID is configured
        const { PAYPAL_WEBHOOK_ID } = getPayPalWebhookConfig();
        if (PAYPAL_WEBHOOK_ID) {
            const isValid = await verifyWebhookSignature(headers, event.body);
            if (!isValid) {
                console.error('Invalid webhook signature');
                return { statusCode: 401, body: 'Invalid signature' };
            }
        }

        const webhookEvent = JSON.parse(event.body);
        const eventType = webhookEvent.event_type;
        const resource = webhookEvent.resource;

        console.log('PayPal Webhook Event:', eventType);
        console.log('Resource:', JSON.stringify(resource, null, 2));

        // Handle different event types
        switch (eventType) {
            case 'BILLING.SUBSCRIPTION.ACTIVATED':
            case 'BILLING.SUBSCRIPTION.RENEWED': {
                // Subscription is now active
                const email = resource.subscriber?.email_address;
                const subscriptionId = resource.id;
                const planId = resource.plan_id;
                const customId = resource.custom_id; // Contains password for user creation
                const subscriptionType = PLAN_TYPE_MAP[planId] || 'monthly';

                if (email) {
                    await updateUserSubscription(email, subscriptionType, subscriptionId, 'ACTIVE', customId);
                    // Log revenue
                    const amount = PLAN_PRICES[subscriptionType] || 15;
                    logRevenue(amount, subscriptionType, email, subscriptionId);
                }
                break;
            }

            case 'BILLING.SUBSCRIPTION.CANCELLED':
            case 'BILLING.SUBSCRIPTION.EXPIRED':
            case 'BILLING.SUBSCRIPTION.SUSPENDED': {
                // Subscription ended
                const email = resource.subscriber?.email_address;
                const subscriptionId = resource.id;

                if (email) {
                    await updateUserSubscription(email, 'free', subscriptionId, 'CANCELLED');
                }
                break;
            }

            case 'PAYMENT.SALE.COMPLETED': {
                // Payment received - subscription continues
                console.log('Payment completed for subscription');
                break;
            }

            case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED': {
                // Payment failed
                const email = resource.subscriber?.email_address;
                console.warn('Payment failed for:', email);
                // Could send notification to user here
                break;
            }

            default:
                console.log('Unhandled event type:', eventType);
        }

        // Always return 200 to acknowledge receipt
        return {
            statusCode: 200,
            body: JSON.stringify({ received: true, event_type: eventType })
        };

    } catch (error) {
        console.error('Webhook Error:', error);
        // Return 200 anyway to prevent PayPal from retrying
        return {
            statusCode: 200,
            body: JSON.stringify({ received: true, error: error.message })
        };
    }
};
