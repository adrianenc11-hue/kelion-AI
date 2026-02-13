/**
 * PayPal Plan Setup Script
 * Run this ONCE to create all 6 subscription plans in PayPal
 * 
 * Usage:
 *   1. Set PAYPAL_CLIENT_ID and PAYPAL_SECRET env vars (or edit below)
 *   2. Run: node setup-paypal-plans.js
 *   3. Copy the output Plan IDs to Netlify env vars
 * 
 * Plans created:
 *   - Pro Monthly (£15/mo)
 *   - Pro Annual (£100/yr)
 *   - Family Monthly (£25/mo)
 *   - Family Annual (£180/yr)
 *   - Business Monthly (£99/mo)
 *   - Business Annual (£800/yr)
 */

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || 'YOUR_CLIENT_ID_HERE';
const PAYPAL_SECRET = process.env.PAYPAL_SECRET || 'YOUR_SECRET_HERE';

// LIVE production
const PAYPAL_BASE = 'https://api-m.paypal.com';

async function getAccessToken() {
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64');
    const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    });
    const data = await res.json();
    if (data.error) throw new Error(`Auth failed: ${data.error_description}`);
    return data.access_token;
}

async function createProduct(token, name, description) {
    const res = await fetch(`${PAYPAL_BASE}/v1/catalogs/products`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name,
            description,
            type: 'SERVICE',
            category: 'SOFTWARE'
        })
    });
    const data = await res.json();
    console.log(`  ✅ Product created: ${data.id} — ${name}`);
    return data.id;
}

async function createPlan(token, productId, planName, price, interval, intervalCount = 1) {
    const res = await fetch(`${PAYPAL_BASE}/v1/billing/plans`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            product_id: productId,
            name: planName,
            description: `Kelion AI ${planName}`,
            billing_cycles: [{
                frequency: {
                    interval_unit: interval,
                    interval_count: intervalCount
                },
                tenure_type: 'REGULAR',
                sequence: 1,
                total_cycles: 0,
                pricing_scheme: {
                    fixed_price: {
                        value: price.toString(),
                        currency_code: 'GBP'
                    }
                }
            }],
            payment_preferences: {
                auto_bill_outstanding: true,
                setup_fee: { value: '0', currency_code: 'GBP' },
                setup_fee_failure_action: 'CONTINUE',
                payment_failure_threshold: 3
            }
        })
    });
    const data = await res.json();
    console.log(`  ✅ Plan created: ${data.id} — ${planName} (£${price}/${interval})`);
    return data.id;
}

async function main() {
    console.log('🔐 Getting PayPal access token...\n');

    if (PAYPAL_CLIENT_ID === 'YOUR_CLIENT_ID_HERE') {
        console.error('❌ ERROR: Set PAYPAL_CLIENT_ID and PAYPAL_SECRET first!');
        console.log('\nOption 1: Set env vars:');
        console.log('  $env:PAYPAL_CLIENT_ID="your_id"');
        console.log('  $env:PAYPAL_SECRET="your_secret"');
        console.log('  node setup-paypal-plans.js\n');
        console.log('Option 2: Edit the script directly (lines 20-21)\n');
        console.log('Get credentials from: https://developer.paypal.com/dashboard/applications');
        process.exit(1);
    }

    const token = await getAccessToken();
    console.log('✅ Authenticated!\n');

    // Create products
    console.log('📦 Creating Products...');
    const proProductId = await createProduct(token, 'Kelion AI Pro', 'AI assistant — Pro plan (1 user)');
    const familyProductId = await createProduct(token, 'Kelion AI Family', 'AI assistant — Family plan (up to 5 members)');
    const businessProductId = await createProduct(token, 'Kelion AI Business', 'AI assistant — Business plan (25-50 members)');

    // Create plans
    console.log('\n📋 Creating Plans...');
    const plans = {};
    plans.PAYPAL_PLAN_MONTHLY = await createPlan(token, proProductId, 'Pro Monthly', 15, 'MONTH');
    plans.PAYPAL_PLAN_ANNUAL = await createPlan(token, proProductId, 'Pro Annual', 100, 'YEAR');
    plans.PAYPAL_PLAN_FAMILY_MONTHLY = await createPlan(token, familyProductId, 'Family Monthly', 25, 'MONTH');
    plans.PAYPAL_PLAN_FAMILY_ANNUAL = await createPlan(token, familyProductId, 'Family Annual', 180, 'YEAR');
    plans.PAYPAL_PLAN_BUSINESS_MONTHLY = await createPlan(token, businessProductId, 'Business Monthly', 99, 'MONTH');
    plans.PAYPAL_PLAN_BUSINESS_ANNUAL = await createPlan(token, businessProductId, 'Business Annual', 800, 'YEAR');

    // Output
    console.log('\n\n═══════════════════════════════════════════');
    console.log('  📋 PLAN IDs — Copy these to Netlify ENV');
    console.log('═══════════════════════════════════════════\n');

    for (const [key, value] of Object.entries(plans)) {
        console.log(`${key}=${value}`);
    }

    console.log('\n═══════════════════════════════════════════');
    console.log('\n💡 To set in Netlify, run:');
    for (const [key, value] of Object.entries(plans)) {
        console.log(`netlify env:set ${key} ${value}`);
    }
    console.log('\n✅ Done! All 6 PayPal plans created.');
}

main().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
