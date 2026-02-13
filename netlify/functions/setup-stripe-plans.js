/**
 * Setup Stripe Plans — ONE-TIME USE
 * Creates 6 subscription prices in Stripe and saves Price IDs to Supabase vault.
 *
 * POST /.netlify/functions/setup-stripe-plans { "action": "create" }
 * POST /.netlify/functions/setup-stripe-plans { "action": "list" }
 */

const { patchProcessEnv, addSecret } = require('./get-secret');

const PLANS = [
    { key: 'STRIPE_PRICE_MONTHLY', name: 'Pro Monthly', amount: 1500, interval: 'month' },
    { key: 'STRIPE_PRICE_ANNUAL', name: 'Pro Annual', amount: 10000, interval: 'year' },
    { key: 'STRIPE_PRICE_FAMILY_MONTHLY', name: 'Family Monthly', amount: 2500, interval: 'month' },
    { key: 'STRIPE_PRICE_FAMILY_ANNUAL', name: 'Family Annual', amount: 18000, interval: 'year' },
    { key: 'STRIPE_PRICE_BUSINESS_MONTHLY', name: 'Business Monthly', amount: 9900, interval: 'month' },
    { key: 'STRIPE_PRICE_BUSINESS_ANNUAL', name: 'Business Annual', amount: 80000, interval: 'year' },
];

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        await patchProcessEnv();

        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (!stripeKey) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: 'STRIPE_SECRET_KEY not in vault' }) };
        }

        const stripe = require('stripe')(stripeKey);
        const { action } = JSON.parse(event.body || '{}');

        // LIST existing prices
        if (action === 'list') {
            const prices = await stripe.prices.list({ limit: 20, active: true });
            return {
                statusCode: 200, headers,
                body: JSON.stringify({
                    count: prices.data.length,
                    prices: prices.data.map(p => ({
                        id: p.id,
                        amount: p.unit_amount,
                        currency: p.currency,
                        interval: p.recurring?.interval,
                        product: p.product
                    }))
                })
            };
        }

        // CREATE plans + save to vault
        if (action === 'create') {
            // Create product first
            const product = await stripe.products.create({
                name: 'Kelion AI',
                description: 'AI Assistant Subscription'
            });

            const results = [];
            for (const plan of PLANS) {
                const price = await stripe.prices.create({
                    product: product.id,
                    unit_amount: plan.amount,
                    currency: 'gbp',
                    recurring: { interval: plan.interval }
                });

                // Save to Supabase vault
                await addSecret(plan.key, price.id, 'stripe', `Stripe ${plan.name} price ID`);
                results.push({ key: plan.key, priceId: price.id, name: plan.name });
            }

            return {
                statusCode: 200, headers,
                body: JSON.stringify({
                    success: true,
                    product_id: product.id,
                    plans_created: results.length,
                    plans: results
                })
            };
        }

        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Use action: create or list' }) };

    } catch (err) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
};
