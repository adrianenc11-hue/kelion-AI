/**
 * A/B Testing — Simple feature flag and experiment management
 * Stores experiments in Supabase, tracks variant assignments
 * No external dependencies
 */

const { patchProcessEnv } = require('./get-secret');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

function getDB() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
}

// Deterministic assignment based on user_id + experiment_name
function assignVariant(userId, experimentName, variants, weights) {
    const hash = crypto.createHash('md5').update(`${userId}:${experimentName}`).digest('hex');
    const hashNum = parseInt(hash.substring(0, 8), 16);
    const normalized = hashNum / 0xFFFFFFFF; // 0-1 range

    let cumulative = 0;
    for (let i = 0; i < variants.length; i++) {
        cumulative += (weights[i] || 1 / variants.length);
        if (normalized <= cumulative) return variants[i];
    }
    return variants[0]; // fallback
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
        await patchProcessEnv();
        const db = getDB();
        const body = JSON.parse(event.body || '{}');

        switch (body.action) {
            // ═══ CREATE EXPERIMENT ═══
            case 'create': {
                const { name, description, variants, weights, status } = body;
                if (!name || !variants || variants.length < 2) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'name and at least 2 variants required' }) };
                }

                if (db) {
                    const { error } = await db.from('ab_experiments').upsert({
                        name,
                        description: description || '',
                        variants: JSON.stringify(variants),
                        weights: JSON.stringify(weights || variants.map(() => 1 / variants.length)),
                        status: status || 'active',
                        created_at: new Date().toISOString()
                    }, { onConflict: 'name' });

                    if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
                }

                return { statusCode: 200, headers, body: JSON.stringify({ success: true, experiment: name }) };
            }

            // ═══ GET VARIANT FOR USER ═══
            case 'get_variant': {
                const { experiment, user_id } = body;
                if (!experiment || !user_id) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'experiment and user_id required' }) };
                }

                let variants = ['control', 'variant_a'];
                let weights = [0.5, 0.5];

                if (db) {
                    const { data } = await db.from('ab_experiments').select('*').eq('name', experiment).single();
                    if (data && data.status === 'active') {
                        variants = JSON.parse(data.variants);
                        weights = JSON.parse(data.weights);
                    } else if (data && data.status !== 'active') {
                        return { statusCode: 200, headers, body: JSON.stringify({ success: true, variant: 'control', experiment_status: data.status }) };
                    }
                }

                const variant = assignVariant(user_id, experiment, variants, weights);

                // Log assignment
                if (db) {
                    await db.from('ab_assignments').upsert({
                        experiment_name: experiment,
                        user_id,
                        variant,
                        assigned_at: new Date().toISOString()
                    }, { onConflict: 'experiment_name,user_id' }).catch(() => { });
                }

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({ success: true, experiment, variant, user_id })
                };
            }

            // ═══ TRACK CONVERSION ═══
            case 'convert': {
                const { experiment, user_id, event_name, value } = body;
                if (!experiment || !user_id) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'experiment and user_id required' }) };
                }

                if (db) {
                    // Get user's variant
                    const { data: assignment } = await db.from('ab_assignments')
                        .select('variant')
                        .eq('experiment_name', experiment)
                        .eq('user_id', user_id)
                        .single();

                    await db.from('ab_conversions').insert({
                        experiment_name: experiment,
                        user_id,
                        variant: assignment?.variant || 'unknown',
                        event_name: event_name || 'conversion',
                        value: value || 1,
                        created_at: new Date().toISOString()
                    });
                }

                return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
            }

            // ═══ GET EXPERIMENT STATS ═══
            case 'stats': {
                const { experiment } = body;
                if (!experiment) return { statusCode: 400, headers, body: JSON.stringify({ error: 'experiment required' }) };
                if (!db) return { statusCode: 200, headers, body: JSON.stringify({ success: true, stats: {} }) };

                // Count assignments per variant
                const { data: assignments } = await db.from('ab_assignments')
                    .select('variant')
                    .eq('experiment_name', experiment);

                // Count conversions per variant
                const { data: conversions } = await db.from('ab_conversions')
                    .select('variant, value')
                    .eq('experiment_name', experiment);

                const stats = {};
                for (const a of (assignments || [])) {
                    if (!stats[a.variant]) stats[a.variant] = { assigned: 0, converted: 0, conversion_rate: 0 };
                    stats[a.variant].assigned++;
                }
                for (const c of (conversions || [])) {
                    if (!stats[c.variant]) stats[c.variant] = { assigned: 0, converted: 0, conversion_rate: 0 };
                    stats[c.variant].converted++;
                }
                for (const v in stats) {
                    stats[v].conversion_rate = stats[v].assigned > 0
                        ? (stats[v].converted / stats[v].assigned * 100).toFixed(1) + '%'
                        : '0%';
                }

                return { statusCode: 200, headers, body: JSON.stringify({ success: true, experiment, stats }) };
            }

            // ═══ LIST EXPERIMENTS ═══
            case 'list': {
                if (!db) return { statusCode: 200, headers, body: JSON.stringify({ success: true, experiments: [] }) };

                const { data } = await db.from('ab_experiments')
                    .select('*')
                    .order('created_at', { ascending: false });

                return { statusCode: 200, headers, body: JSON.stringify({ success: true, experiments: data || [] }) };
            }

            default:
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid action', available: ['create', 'get_variant', 'convert', 'stats', 'list'] }) };
        }
    } catch (error) {
        console.error('A/B testing error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
