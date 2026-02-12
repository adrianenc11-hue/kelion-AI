// Netlify Function: PayPal Subscription Handler
// Creates and verifies PayPal subscriptions

const { patchProcessEnv } = require('./get-secret');

// PayPal config loaded AFTER patchProcessEnv() inside handler
function getPayPalConfig() {
    const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
    const PAYPAL_SECRET = process.env.PAYPAL_SECRET;
    const PAYPAL_API = process.env.PAYPAL_MODE === 'live'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';
    const PLANS = process.env.PAYPAL_PLANS
        ? JSON.parse(process.env.PAYPAL_PLANS)
        : {
            monthly: process.env.PAYPAL_PLAN_MONTHLY,
            annual: process.env.PAYPAL_PLAN_ANNUAL,
            family_monthly: process.env.PAYPAL_PLAN_FAMILY_MONTHLY,
            family_annual: process.env.PAYPAL_PLAN_FAMILY_ANNUAL,
            business_monthly: process.env.PAYPAL_PLAN_BUSINESS_MONTHLY,
            business_annual: process.env.PAYPAL_PLAN_BUSINESS_ANNUAL
        };
    return { PAYPAL_CLIENT_ID, PAYPAL_SECRET, PAYPAL_API, PLANS };
}

async function getAccessToken(config) {
    const auth = Buffer.from(`${config.PAYPAL_CLIENT_ID}:${config.PAYPAL_SECRET}`).toString('base64');

    const response = await fetch(`${config.PAYPAL_API}/v1/oauth2/token`, {
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

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': 'https://kelionai.app',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        await patchProcessEnv(); // Load vault secrets from Supabase
        const config = getPayPalConfig();
        const { action, subscriptionId, planType, email, password } = JSON.parse(event.body);

        // Check if PayPal is configured
        if (!config.PAYPAL_CLIENT_ID || !config.PAYPAL_SECRET) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    error: 'PayPal not configured',
                    message: 'Set PAYPAL_CLIENT_ID and PAYPAL_SECRET in Netlify'
                })
            };
        }

        const accessToken = await getAccessToken(config);

        // Action: Create subscription
        if (action === 'create') {
            const planId = config.PLANS[planType];
            if (!planId) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Invalid plan type', available: ['monthly', 'annual'] })
                };
            }

            const response = await fetch(`${config.PAYPAL_API}/v1/billing/subscriptions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    plan_id: planId,
                    custom_id: JSON.stringify({ password, planType }), // Pass password for user creation
                    subscriber: {
                        email_address: email
                    },
                    application_context: {
                        brand_name: 'Kelion AI',
                        locale: 'en-GB',
                        shipping_preference: 'NO_SHIPPING',
                        user_action: 'SUBSCRIBE_NOW',
                        return_url: 'https://kelionai.app/subscribe.html?success=true',
                        cancel_url: 'https://kelionai.app/subscribe.html?canceled=true'
                    }
                })
            });

            const subscription = await response.json();

            // Log for debugging
            console.log('PayPal API Response:', JSON.stringify(subscription));

            // Check for PayPal errors
            if (subscription.error || subscription.name === 'INVALID_REQUEST') {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({
                        success: false,
                        error: subscription.message || subscription.error_description || 'PayPal API error',
                        details: subscription.details || subscription
                    })
                };
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    subscriptionId: subscription.id,
                    approvalUrl: subscription.links?.find(l => l.rel === 'approve')?.href,
                    status: subscription.status
                })
            };
        }

        // Action: Verify subscription status
        if (action === 'verify') {
            if (!subscriptionId) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'subscriptionId required' })
                };
            }

            const response = await fetch(`${config.PAYPAL_API}/v1/billing/subscriptions/${subscriptionId}`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            const subscription = await response.json();

            const isActive = subscription.status === 'ACTIVE';

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    valid: isActive,
                    status: subscription.status,
                    planId: subscription.plan_id,
                    subscriber: subscription.subscriber?.email_address,
                    nextBilling: subscription.billing_info?.next_billing_time
                })
            };
        }

        // Action: Cancel subscription
        if (action === 'cancel') {
            const { provider } = JSON.parse(event.body);

            // === STRIPE CANCEL ===
            if (provider === 'stripe') {
                const stripeSubscriptionId = subscriptionId;
                if (!stripeSubscriptionId) {
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({ error: 'subscriptionId required' })
                    };
                }

                let stripe;
                try {
                    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
                } catch (e) {
                    return {
                        statusCode: 503,
                        headers,
                        body: JSON.stringify({ error: 'Stripe not configured' })
                    };
                }

                // Get subscription to determine plan type
                const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
                const priceId = sub.items?.data?.[0]?.price?.id;
                const _sp = process.env.STRIPE_PRICES ? JSON.parse(process.env.STRIPE_PRICES) : {};
                const annualPriceIds = [
                    _sp.annual || process.env.STRIPE_PRICE_ANNUAL,
                    _sp.family_annual || process.env.STRIPE_PRICE_FAMILY_ANNUAL,
                    _sp.business_annual || process.env.STRIPE_PRICE_BUSINESS_ANNUAL
                ].filter(Boolean);
                const isAnnual = annualPriceIds.includes(priceId);

                if (isAnnual) {
                    // Annual: cancel immediately → webhook handles pro-rata refund
                    await stripe.subscriptions.cancel(stripeSubscriptionId);
                    return {
                        statusCode: 200,
                        headers,
                        body: JSON.stringify({
                            success: true,
                            message: 'Annual subscription cancelled. Pro-rata refund will be processed.',
                            refund: true
                        })
                    };
                } else {
                    // Monthly: cancel at period end → no refund, access continues
                    await stripe.subscriptions.update(stripeSubscriptionId, {
                        cancel_at_period_end: true
                    });
                    const periodEnd = new Date(sub.current_period_end * 1000).toISOString();
                    return {
                        statusCode: 200,
                        headers,
                        body: JSON.stringify({
                            success: true,
                            message: `Subscription will end on ${periodEnd.split('T')[0]}. No refund for monthly plans.`,
                            accessUntil: periodEnd,
                            refund: false
                        })
                    };
                }
            }

            // === PAYPAL CANCEL ===
            if (!subscriptionId) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'subscriptionId required' })
                };
            }

            const response = await fetch(`${config.PAYPAL_API}/v1/billing/subscriptions/${subscriptionId}/cancel`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    reason: 'Customer requested cancellation'
                })
            });

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: response.status === 204,
                    message: 'Subscription cancelled'
                })
            };
        }

        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid action', available: ['create', 'verify', 'cancel'] })
        };

    } catch (error) {
        console.error('Subscription Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
