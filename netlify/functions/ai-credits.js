// AI Credits - Check REAL balances from all AI providers
// Queries live APIs for actual usage data

const { patchProcessEnv } = require('./get-secret');

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        await patchProcessEnv(); // Load vault secrets
        const credits = {};

        // ═══ OPENAI ═══
        if (process.env.OPENAI_API_KEY) {
            try {
                // Check OpenAI billing - subscription endpoint
                const subRes = await fetch('https://api.openai.com/v1/organization/usage/completions?start_time=' + Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000), {
                    headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }
                });

                if (subRes.ok) {
                    const data = await subRes.json();
                    credits.openai = { status: 'active', configured: true, provider: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'whisper', 'dall-e-3', 'tts-1'], usage_data: data };
                } else {
                    // API key works but billing endpoint unavailable - test with a minimal call
                    const testRes = await fetch('https://api.openai.com/v1/models', {
                        headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }
                    });
                    credits.openai = { status: testRes.ok ? 'active' : 'error', configured: true, provider: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'whisper', 'dall-e-3', 'tts-1'], note: 'Key valid, billing API restricted' };
                }
            } catch (e) {
                credits.openai = { status: 'error', configured: true, error: e.message, provider: 'OpenAI' };
            }
        } else {
            credits.openai = { status: 'missing', configured: false, provider: 'OpenAI' };
        }

        // ═══ GEMINI ═══
        if (process.env.GEMINI_API_KEY) {
            try {
                const testRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
                const data = await testRes.json();
                const modelCount = data.models?.length || 0;
                credits.gemini = { status: testRes.ok ? 'active' : 'error', configured: true, provider: 'Google Gemini', models: ['gemini-2.0-flash', 'gemini-2.0-flash-lite'], available_models: modelCount, note: 'Free tier: 15 RPM, 1M tokens/min' };
            } catch (e) {
                credits.gemini = { status: 'error', configured: true, error: e.message, provider: 'Google Gemini' };
            }
        } else {
            credits.gemini = { status: 'missing', configured: false, provider: 'Google Gemini' };
        }

        // ═══ DEEPSEEK ═══
        if (process.env.DEEPSEEK_API_KEY) {
            try {
                const testRes = await fetch('https://api.deepseek.com/v1/models', {
                    headers: { 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}` }
                });
                credits.deepseek = { status: testRes.ok ? 'active' : 'error', configured: true, provider: 'DeepSeek', models: ['deepseek-chat', 'deepseek-reasoner'], note: 'Pay-per-use: ~$0.14/M input tokens' };
            } catch (e) {
                credits.deepseek = { status: 'error', configured: true, error: e.message, provider: 'DeepSeek' };
            }
        } else {
            credits.deepseek = { status: 'missing', configured: false, provider: 'DeepSeek' };
        }



        // ═══ ELEVENLABS ═══
        if (process.env.ELEVENLABS_API_KEY) {
            try {
                const subRes = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
                    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY }
                });
                if (subRes.ok) {
                    const data = await subRes.json();
                    credits.elevenlabs = {
                        status: 'active', configured: true, provider: 'ElevenLabs',
                        remaining: data.character_limit - data.character_count,
                        used: data.character_count,
                        limit: data.character_limit,
                        tier: data.tier || 'free',
                        next_reset: data.next_character_count_reset_unix ? new Date(data.next_character_count_reset_unix * 1000).toISOString() : null
                    };
                } else {
                    credits.elevenlabs = { status: 'error', configured: true, provider: 'ElevenLabs', note: `API returned ${subRes.status}` };
                }
            } catch (e) {
                credits.elevenlabs = { status: 'error', configured: true, error: e.message, provider: 'ElevenLabs' };
            }
        } else {
            credits.elevenlabs = { status: 'missing', configured: false, provider: 'ElevenLabs' };
        }

        // ═══ REPLICATE ═══
        if (process.env.REPLICATE_API_TOKEN) {
            try {
                const testRes = await fetch('https://api.replicate.com/v1/account', {
                    headers: { 'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}` }
                });
                if (testRes.ok) {
                    const data = await testRes.json();
                    credits.replicate = { status: 'active', configured: true, provider: 'Replicate', username: data.username, type: data.type };
                } else {
                    credits.replicate = { status: 'error', configured: true, provider: 'Replicate', note: `API returned ${testRes.status}` };
                }
            } catch (e) {
                credits.replicate = { status: 'error', configured: true, error: e.message, provider: 'Replicate' };
            }
        } else {
            credits.replicate = { status: 'missing', configured: false, provider: 'Replicate' };
        }

        // ═══ SUPABASE ═══
        if (process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY)) {
            credits.supabase = { status: 'active', configured: true, provider: 'Supabase', url: process.env.SUPABASE_URL, note: 'Database + Auth + Storage' };
        } else {
            credits.supabase = { status: 'missing', configured: false, provider: 'Supabase' };
        }

        // Summary
        const total = Object.keys(credits).length;
        const active = Object.values(credits).filter(c => c.status === 'active').length;
        const configured = Object.values(credits).filter(c => c.configured).length;

        return {
            statusCode: 200, headers, body: JSON.stringify({
                success: true,
                summary: { total_providers: total, active, configured, missing: total - configured },
                credits,
                checked_at: new Date().toISOString()
            })
        };
    } catch (error) {
        console.error('AI credits error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
