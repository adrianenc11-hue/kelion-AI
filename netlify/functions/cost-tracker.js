/**
 * API Cost Tracker — Tracks real API usage costs and subscription revenue
 * Actions: log_usage, get_summary, get_detailed, log_revenue
 * Stores in Supabase: api_usage_log table
 */

const { patchProcessEnv } = require('./get-secret');

const { createClient } = require('@supabase/supabase-js');

// ═══ REAL API PRICING — Verified from provider sites Feb 2026 ═══
// Sources: openai.com/api/pricing, deepseek.com, ai.google.dev/pricing,
//          moonshot.ai, deepgram.com/pricing
const API_COSTS = {
    'deepseek-chat': { input: 0.28, output: 0.42, unit: '1M tokens' },  // DeepSeek V3.2 (deepseek.com)
    'gemini-2.0-flash': { input: 0.10, output: 0.40, unit: '1M tokens' },  // Gemini Flash (ai.google.dev)
    'gpt-4o-mini': { input: 0.15, output: 0.60, unit: '1M tokens' },  // GPT-4o-mini (openai.com)

    'gpt-4o': { input: 2.50, output: 10.00, unit: '1M tokens' },  // GPT-4o (openai.com)
    'dall-e-3': { input: 0.04, output: 0, unit: 'per image' },  // DALL-E 3 1024x1024 (openai.com)
    'whisper-1': { input: 0.006, output: 0, unit: 'per minute' }, // Whisper (openai.com)
    'tts-1': { input: 0.015, output: 0, unit: 'per 1K chars' }, // OpenAI TTS (openai.com)
    'deepgram-aura': { input: 0.0035, output: 0, unit: 'per 1K chars' }, // Deepgram Aura TTS (deepgram.com)
};

function getSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
}

// Estimate cost from model + token counts
function estimateCost(model, inputTokens = 0, outputTokens = 0) {
    const pricing = API_COSTS[model];
    if (!pricing) return 0;

    if (pricing.unit === '1M tokens') {
        return ((inputTokens * pricing.input) + (outputTokens * pricing.output)) / 1000000;
    }
    // For per-unit pricing (images, minutes, chars)
    return pricing.input * inputTokens;
}

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    const supabase = getSupabase();
    if (!supabase) return { statusCode: 503, headers, body: JSON.stringify({ error: 'Database not configured' }) };

    try {
        await patchProcessEnv(); // Load vault secrets
        const body = JSON.parse(event.body || '{}');
        const { action } = body;

        switch (action) {

            // ═══ LOG API USAGE ═══
            case 'log_usage': {
                const { model, input_tokens, output_tokens, user_email, endpoint, user_type } = body;
                const cost = estimateCost(model, input_tokens || 0, output_tokens || 0);

                const { error } = await supabase
                    .from('api_usage_log')
                    .insert({
                        model,
                        input_tokens: input_tokens || 0,
                        output_tokens: output_tokens || 0,
                        cost_usd: cost,
                        user_email: user_email || 'anonymous',
                        user_type: user_type || 'free', // free, pro, family, business
                        endpoint: endpoint || 'unknown',
                        created_at: new Date().toISOString()
                    });

                if (error) console.error('Cost log error:', error.message);

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({ success: true, cost_usd: cost, model })
                };
            }

            // ═══ LOG SUBSCRIPTION REVENUE ═══
            case 'log_revenue': {
                const { amount, currency, plan, user_email, source, transaction_id } = body;

                const { error } = await supabase
                    .from('revenue_log')
                    .insert({
                        amount: amount || 0,
                        currency: currency || 'GBP',
                        plan: plan || 'unknown',
                        user_email: user_email || 'unknown',
                        source: source || 'manual', // stripe, paypal, manual
                        transaction_id: transaction_id || null,
                        created_at: new Date().toISOString()
                    });

                if (error) console.error('Revenue log error:', error.message);

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({ success: true, amount, plan })
                };
            }

            // ═══ GET COST SUMMARY ═══
            case 'get_summary': {
                const { period } = body; // 'today', '7d', '30d', 'all'

                let since = new Date();
                if (period === 'today') since.setHours(0, 0, 0, 0);
                else if (period === '7d') since.setDate(since.getDate() - 7);
                else if (period === '30d') since.setDate(since.getDate() - 30);
                else since = new Date('2020-01-01'); // all time

                // Get API costs
                const { data: costs } = await supabase
                    .from('api_usage_log')
                    .select('model, cost_usd, user_type, created_at')
                    .gte('created_at', since.toISOString());

                // Get revenue
                const { data: revenue } = await supabase
                    .from('revenue_log')
                    .select('amount, currency, plan, created_at')
                    .gte('created_at', since.toISOString());

                // Calculate totals
                const totalCosts = (costs || []).reduce((sum, c) => sum + (c.cost_usd || 0), 0);
                const freeCosts = (costs || []).filter(c => c.user_type === 'free').reduce((sum, c) => sum + (c.cost_usd || 0), 0);
                const paidCosts = (costs || []).filter(c => c.user_type !== 'free').reduce((sum, c) => sum + (c.cost_usd || 0), 0);
                const totalRevenue = (revenue || []).reduce((sum, r) => sum + (r.amount || 0), 0);
                const profit = totalRevenue - totalCosts;

                // Cost per model breakdown
                const byModel = {};
                (costs || []).forEach(c => {
                    if (!byModel[c.model]) byModel[c.model] = { calls: 0, cost: 0 };
                    byModel[c.model].calls++;
                    byModel[c.model].cost += c.cost_usd || 0;
                });

                // Revenue by plan
                const byPlan = {};
                (revenue || []).forEach(r => {
                    if (!byPlan[r.plan]) byPlan[r.plan] = { count: 0, total: 0 };
                    byPlan[r.plan].count++;
                    byPlan[r.plan].total += r.amount || 0;
                });

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({
                        success: true,
                        period: period || 'all',
                        costs: {
                            total: Math.round(totalCosts * 10000) / 10000,
                            free_users: Math.round(freeCosts * 10000) / 10000,
                            paid_users: Math.round(paidCosts * 10000) / 10000,
                            by_model: byModel,
                            total_calls: (costs || []).length
                        },
                        revenue: {
                            total: Math.round(totalRevenue * 100) / 100,
                            by_plan: byPlan,
                            total_transactions: (revenue || []).length
                        },
                        profit: Math.round(profit * 100) / 100,
                        margin_percent: totalRevenue > 0 ? Math.round((profit / totalRevenue) * 10000) / 100 : 0
                    })
                };
            }

            default:
                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({
                        success: true,
                        service: 'cost-tracker',
                        actions: ['log_usage', 'log_revenue', 'get_summary'],
                        pricing: API_COSTS
                    })
                };
        }
    } catch (error) {
        console.error('Cost tracker error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
