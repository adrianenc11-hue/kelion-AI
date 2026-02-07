/**
 * Stripe Webhook - Handle subscription events
 * Creates user account and updates subscription status in Supabase
 */

let stripe, supabase;

function initClients() {
    if (!stripe && process.env.STRIPE_SECRET_KEY) {
        stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    }
    if (!supabase && process.env.SUPABASE_URL) {
        const { createClient } = require('@supabase/supabase-js');
        const SB_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
        if (SB_KEY) supabase = createClient(process.env.SUPABASE_URL, SB_KEY);
    }
}
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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
        body: JSON.stringify({ action: 'log_revenue', amount, currency: 'GBP', plan, user_email: email, source: 'stripe', transaction_id: transactionId })
    }).catch(e => console.warn('Revenue log failed:', e.message));
}

exports.handler = async (event) => {
    initClients();
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    if (!stripe) {
        return { statusCode: 503, headers, body: JSON.stringify({ error: 'Stripe not configured', config_missing: 'STRIPE_SECRET_KEY' }) };
    }

    const sig = event.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let stripeEvent;

    try {
        // Verify webhook signature if secret is configured
        if (endpointSecret && sig) {
            stripeEvent = stripe.webhooks.constructEvent(event.body, sig, endpointSecret);
        } else {
            // For testing without signature verification
            stripeEvent = JSON.parse(event.body);
            console.warn('⚠️ Webhook signature not verified - testing mode');
        }
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: `Webhook Error: ${err.message}` })
        };
    }

    console.log(`📩 Stripe webhook received: ${stripeEvent.type}`);

    try {
        switch (stripeEvent.type) {
            case 'checkout.session.completed': {
                const session = stripeEvent.data.object;
                await handleCheckoutComplete(session);
                break;
            }
            case 'customer.subscription.created':
            case 'customer.subscription.updated': {
                const subscription = stripeEvent.data.object;
                await handleSubscriptionUpdate(subscription);
                break;
            }
            case 'customer.subscription.deleted': {
                const subscription = stripeEvent.data.object;
                await handleSubscriptionCancelled(subscription);
                break;
            }
            default:
                console.log(`Unhandled event type: ${stripeEvent.type}`);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ received: true })
        };

    } catch (error) {
        console.error('Webhook processing error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Webhook processing failed' })
        };
    }
};

async function handleCheckoutComplete(session) {
    console.log('✅ Checkout completed:', session.id);

    const email = session.customer_email || session.metadata?.email;
    const password = session.metadata?.password;
    const planType = session.metadata?.planType || 'monthly';
    const stripeSubscriptionId = session.subscription;
    const stripeCustomerId = session.customer;

    if (!email) {
        console.error('No email found in session');
        return;
    }

    // Check if user exists
    const { data: existingUser } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', email)
        .single();

    if (existingUser) {
        // Update existing user
        console.log('📝 Updating existing user:', email);
        await supabase
            .from('users')
            .update({
                subscription_status: planType,
                stripe_subscription_id: stripeSubscriptionId,
                stripe_customer_id: stripeCustomerId,
                subscription_updated_at: new Date().toISOString()
            })
            .eq('email', email);
    } else {
        // Create new user
        console.log('👤 Creating new user:', email);

        // Hash password if provided
        const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

        await supabase
            .from('users')
            .insert({
                email: email,
                password_hash: hashedPassword,
                subscription_status: planType,
                stripe_subscription_id: stripeSubscriptionId,
                stripe_customer_id: stripeCustomerId,
                subscription_updated_at: new Date().toISOString(),
                created_at: new Date().toISOString()
            });
    }

    console.log(`✅ User ${email} subscription activated: ${planType}`);

    // Log revenue
    const amount = PLAN_PRICES[planType] || 15;
    logRevenue(amount, planType, email, session.id);
}

async function handleSubscriptionUpdate(subscription) {
    const status = subscription.status;
    const customerId = subscription.customer;

    console.log(`📊 Subscription ${subscription.id} status: ${status}`);

    // Get customer email
    const customer = await stripe.customers.retrieve(customerId);
    const email = customer.email;

    if (!email) {
        console.error('No email found for customer:', customerId);
        return;
    }

    // Determine plan type from price
    const priceId = subscription.items?.data?.[0]?.price?.id;
    let planType = 'monthly';
    if (priceId === process.env.STRIPE_PRICE_ANNUAL) {
        planType = 'annual';
    }

    // Update subscription status based on Stripe status
    let dbStatus = planType;
    if (status === 'canceled' || status === 'unpaid' || status === 'past_due') {
        dbStatus = 'free';
    }

    await supabase
        .from('users')
        .update({
            subscription_status: dbStatus,
            stripe_subscription_id: subscription.id,
            subscription_updated_at: new Date().toISOString()
        })
        .eq('email', email);

    console.log(`✅ Updated ${email} subscription to: ${dbStatus}`);
}

async function handleSubscriptionCancelled(subscription) {
    const customerId = subscription.customer;

    console.log(`❌ Subscription cancelled: ${subscription.id}`);

    // Get customer email
    const customer = await stripe.customers.retrieve(customerId);
    const email = customer.email;

    if (!email) {
        console.error('No email found for customer:', customerId);
        return;
    }

    await supabase
        .from('users')
        .update({
            subscription_status: 'free',
            subscription_updated_at: new Date().toISOString()
        })
        .eq('email', email);

    console.log(`✅ ${email} subscription set to free`);
}
