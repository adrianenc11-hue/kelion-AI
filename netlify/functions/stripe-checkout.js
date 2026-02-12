/**
 * Stripe Checkout - Create subscription checkout session
 * Handles both monthly and annual plans with user registration
 */

const { patchProcessEnv } = require('./get-secret');

let stripe;
try {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
} catch (e) {
    console.error('Failed to load Stripe:', e.message);
}

// Consolidated: one JSON env var instead of 6 separate ones
const PRICES = process.env.STRIPE_PRICES
    ? JSON.parse(process.env.STRIPE_PRICES)
    : {
        monthly: process.env.STRIPE_PRICE_MONTHLY,
        annual: process.env.STRIPE_PRICE_ANNUAL,
        family_monthly: process.env.STRIPE_PRICE_FAMILY_MONTHLY,
        family_annual: process.env.STRIPE_PRICE_FAMILY_ANNUAL,
        business_monthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY,
        business_annual: process.env.STRIPE_PRICE_BUSINESS_ANNUAL
    };

exports.handler = async (event) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        await patchProcessEnv(); // Load vault secrets
        // Check if Stripe is available
        if (!stripe) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    error: 'Stripe not configured',
                    message: 'Stripe module failed to load. Check STRIPE_SECRET_KEY.'
                })
            };
        }

        const { action, planType, email, password } = JSON.parse(event.body || '{}');

        if (action === 'create') {
            // Validate inputs
            if (!planType || !PRICES[planType]) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Invalid plan type' })
                };
            }

            if (!email) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Email is required' })
                };
            }

            // Create Stripe Checkout Session
            const session = await stripe.checkout.sessions.create({
                mode: 'subscription',
                payment_method_types: ['card'],
                line_items: [{
                    price: PRICES[planType],
                    quantity: 1
                }],
                customer_email: email,
                metadata: {
                    email: email,
                    password: password, // Will be hashed by webhook
                    planType: planType
                },
                success_url: `${process.env.URL || 'https://kelionai.app'}/subscribe.html?success=true&session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.URL || 'https://kelionai.app'}/subscribe.html?canceled=true`
            });

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    sessionId: session.id,
                    checkoutUrl: session.url
                })
            };
        }

        if (action === 'verify') {
            // Verify a completed session
            const { sessionId } = JSON.parse(event.body);

            const session = await stripe.checkout.sessions.retrieve(sessionId);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    status: session.status,
                    paymentStatus: session.payment_status,
                    customerEmail: session.customer_email,
                    subscriptionId: session.subscription
                })
            };
        }

        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid action' })
        };

    } catch (error) {
        console.error('Stripe checkout error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Checkout failed',
                message: error.message
            })
        };
    }
};
