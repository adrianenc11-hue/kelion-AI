// Netlify Function: PayPal Subscription Handler
// Creates and verifies PayPal subscriptions

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET;
const PAYPAL_API = process.env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

// Plan IDs - create these in PayPal Dashboard
const PLANS = {
    monthly: process.env.PAYPAL_PLAN_MONTHLY, // £15/month
    annual: process.env.PAYPAL_PLAN_ANNUAL,    // £100/year
    family_monthly: process.env.PAYPAL_PLAN_FAMILY_MONTHLY, // £25/month
    family_annual: process.env.PAYPAL_PLAN_FAMILY_ANNUAL,   // £180/year
    business_monthly: process.env.PAYPAL_PLAN_BUSINESS_MONTHLY, // £99/month
    business_annual: process.env.PAYPAL_PLAN_BUSINESS_ANNUAL    // £800/year
};

async function getAccessToken() {
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
        const { action, subscriptionId, planType, email, password } = JSON.parse(event.body);

        // Check if PayPal is configured
        if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    error: 'PayPal not configured',
                    message: 'Set PAYPAL_CLIENT_ID and PAYPAL_SECRET in Netlify'
                })
            };
        }

        const accessToken = await getAccessToken();

        // Action: Create subscription
        if (action === 'create') {
            const planId = PLANS[planType];
            if (!planId) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Invalid plan type', available: ['monthly', 'annual'] })
                };
            }

            const response = await fetch(`${PAYPAL_API}/v1/billing/subscriptions`, {
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

            const response = await fetch(`${PAYPAL_API}/v1/billing/subscriptions/${subscriptionId}`, {
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
            if (!subscriptionId) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'subscriptionId required' })
                };
            }

            const response = await fetch(`${PAYPAL_API}/v1/billing/subscriptions/${subscriptionId}/cancel`, {
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
