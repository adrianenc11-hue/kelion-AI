/**
 * PayPal Admin — Manage subscription plans from admin panel
 * Actions: list_plans, create_plan, update_plan, list_products, create_product, list_subscriptions, sync_env
 */

async function getAccessToken() {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const secret = process.env.PAYPAL_SECRET;
    if (!clientId || !secret) return null;

    const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');
    const res = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
        method: 'POST',
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials'
    });
    const data = await res.json();
    return data.error ? null : data.access_token;
}

async function paypalAPI(token, endpoint, method = 'GET', body = null) {
    const opts = {
        method,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`https://api-m.paypal.com/v1/${endpoint}`, opts);
    if (res.status === 204) return { success: true };
    return res.json();
}

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    const token = await getAccessToken();
    if (!token) return { statusCode: 503, headers, body: JSON.stringify({ error: 'PayPal not configured. Set PAYPAL_CLIENT_ID and PAYPAL_SECRET.' }) };

    try {
        const body = JSON.parse(event.body || '{}');
        const { action } = body;

        switch (action) {

            // ═══ LIST ALL PLANS ═══
            case 'list_plans': {
                const data = await paypalAPI(token, 'billing/plans?page_size=20&total_required=true');
                const plans = (data.plans || []).map(p => ({
                    id: p.id,
                    name: p.name,
                    status: p.status,
                    description: p.description,
                    create_time: p.create_time
                }));

                // Get details for each plan (pricing info)
                for (let i = 0; i < plans.length; i++) {
                    const detail = await paypalAPI(token, `billing/plans/${plans[i].id}`);
                    if (detail.billing_cycles) {
                        const cycle = detail.billing_cycles[0];
                        plans[i].price = cycle?.pricing_scheme?.fixed_price?.value || '?';
                        plans[i].currency = cycle?.pricing_scheme?.fixed_price?.currency_code || 'GBP';
                        plans[i].interval = cycle?.frequency?.interval_unit || '?';
                        plans[i].product_id = detail.product_id;
                    }
                }

                return { statusCode: 200, headers, body: JSON.stringify({ success: true, plans, total: plans.length }) };
            }

            // ═══ CREATE PLAN ═══
            case 'create_plan': {
                const { product_id, name, description, price, currency, interval } = body;

                if (!product_id || !name || !price || !interval) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'product_id, name, price, interval required' }) };
                }

                const planData = {
                    product_id,
                    name,
                    description: description || `Kelion AI ${name}`,
                    billing_cycles: [{
                        frequency: { interval_unit: interval.toUpperCase(), interval_count: 1 },
                        tenure_type: 'REGULAR',
                        sequence: 1,
                        total_cycles: 0,
                        pricing_scheme: {
                            fixed_price: { value: price.toString(), currency_code: currency || 'GBP' }
                        }
                    }],
                    payment_preferences: {
                        auto_bill_outstanding: true,
                        setup_fee: { value: '0', currency_code: currency || 'GBP' },
                        setup_fee_failure_action: 'CONTINUE',
                        payment_failure_threshold: 3
                    }
                };

                const result = await paypalAPI(token, 'billing/plans', 'POST', planData);

                if (result.id) {
                    return { statusCode: 200, headers, body: JSON.stringify({ success: true, plan: { id: result.id, name: result.name, status: result.status } }) };
                }
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Failed to create plan', details: result }) };
            }

            // ═══ UPDATE PLAN PRICING ═══
            case 'update_plan': {
                const { plan_id, new_price, currency } = body;

                if (!plan_id || !new_price) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'plan_id and new_price required' }) };
                }

                const result = await paypalAPI(token, `billing/plans/${plan_id}/update-pricing-schemes`, 'POST', {
                    pricing_schemes: [{
                        billing_cycle_sequence: 1,
                        pricing_scheme: {
                            fixed_price: { value: new_price.toString(), currency_code: currency || 'GBP' }
                        }
                    }]
                });

                return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: `Plan ${plan_id} price updated to £${new_price}` }) };
            }

            // ═══ ACTIVATE/DEACTIVATE PLAN ═══
            case 'toggle_plan': {
                const { plan_id, activate } = body;
                if (!plan_id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'plan_id required' }) };

                const action_path = activate ? 'activate' : 'deactivate';
                await paypalAPI(token, `billing/plans/${plan_id}/${action_path}`, 'POST');

                return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: `Plan ${plan_id} ${activate ? 'activated' : 'deactivated'}` }) };
            }

            // ═══ LIST PRODUCTS ═══
            case 'list_products': {
                const data = await paypalAPI(token, 'catalogs/products?page_size=20&total_required=true');
                const products = (data.products || []).map(p => ({
                    id: p.id,
                    name: p.name,
                    description: p.description,
                    create_time: p.create_time
                }));
                return { statusCode: 200, headers, body: JSON.stringify({ success: true, products, total: products.length }) };
            }

            // ═══ CREATE PRODUCT ═══
            case 'create_product': {
                const { name, description } = body;
                if (!name) return { statusCode: 400, headers, body: JSON.stringify({ error: 'name required' }) };

                const result = await paypalAPI(token, 'catalogs/products', 'POST', {
                    name,
                    description: description || name,
                    type: 'SERVICE',
                    category: 'SOFTWARE'
                });

                return { statusCode: 200, headers, body: JSON.stringify({ success: true, product: { id: result.id, name: result.name } }) };
            }

            // ═══ LIST ACTIVE SUBSCRIPTIONS ═══
            case 'list_subscriptions': {
                const { plan_id } = body;
                if (!plan_id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'plan_id required' }) };

                // PayPal doesn't have a direct "list subscribers" endpoint
                // But we can search via transaction API
                return {
                    statusCode: 200, headers, body: JSON.stringify({
                        success: true,
                        message: 'Use PayPal Dashboard for subscriber details',
                        dashboard_url: `https://www.paypal.com/billing/plans/${plan_id}`
                    })
                };
            }

            // ═══ DASHBOARD SUMMARY ═══
            case 'dashboard':
            default: {
                const plans = await paypalAPI(token, 'billing/plans?page_size=20&total_required=true');
                const products = await paypalAPI(token, 'catalogs/products?page_size=20&total_required=true');

                const planList = [];
                for (const p of (plans.plans || [])) {
                    const detail = await paypalAPI(token, `billing/plans/${p.id}`);
                    const cycle = detail.billing_cycles?.[0];
                    planList.push({
                        id: p.id,
                        name: p.name,
                        status: p.status,
                        price: cycle?.pricing_scheme?.fixed_price?.value || '?',
                        currency: cycle?.pricing_scheme?.fixed_price?.currency_code || 'GBP',
                        interval: cycle?.frequency?.interval_unit || '?'
                    });
                }

                return {
                    statusCode: 200, headers, body: JSON.stringify({
                        success: true,
                        service: 'paypal-admin',
                        products_count: products.total_items || 0,
                        plans: planList,
                        plans_count: planList.length,
                        actions: ['list_plans', 'create_plan', 'update_plan', 'toggle_plan', 'list_products', 'create_product', 'list_subscriptions', 'dashboard']
                    })
                };
            }
        }
    } catch (error) {
        console.error('PayPal admin error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
