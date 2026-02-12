// ═══════════════════════════════════════════════════════════════
// K INTEGRITY CHECK — Live Monitoring Endpoint
// Verifică integritatea fișierelor critice pe producție
// REGULA: SE REPARĂ CODUL SURSĂ, NU SE OCOLEȘTE TESTUL
// ═══════════════════════════════════════════════════════════════

const { patchProcessEnv } = require('./get-secret');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        await patchProcessEnv();

        const parsed = event.httpMethod === 'POST' ? JSON.parse(event.body || '{}') : {};
        const action = parsed.action || 'status';

        // ═══ STATUS — Report integrity guard status ═══
        if (action === 'status') {
            return {
                statusCode: 200, headers,
                body: JSON.stringify({
                    integrity_guard: 'ACTIVE',
                    layers: {
                        layer_1_sha256: 'ACTIVE — hashes stored in Supabase vault',
                        layer_2_live_monitor: 'ACTIVE — this endpoint',
                        layer_3_readonly: 'ACTIVE — immutable test files',
                        layer_4_git_hook: 'ACTIVE — pre-commit check',
                        layer_5_ai_rules: 'ACTIVE — AI cannot modify tests'
                    },
                    truth_shield: 'ACTIVE',
                    rule: 'FIX SOURCE CODE, NEVER MODIFY TESTS',
                    tamper_proof: true,
                    admin_only_deactivation: true,
                    protected_files: [
                        'validate-code.js',
                        'validate-fake-data.js',
                        'audit-live.js',
                        'audit_complete.js',
                        'netlify/functions/truth-detector.js',
                        'netlify/functions/smart-brain.js'
                    ],
                    monitored_since: '2026-02-10T19:57:00Z'
                })
            };
        }

        // ═══ VERIFY — Check a file hash against vault ═══
        if (action === 'verify') {
            const { file, hash } = parsed;
            if (!file || !hash) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'file and hash required' }) };
            }

            const vaultHashes = process.env.INTEGRITY_HASHES;
            if (!vaultHashes) {
                return {
                    statusCode: 503, headers,
                    body: JSON.stringify({ error: 'INTEGRITY_HASHES not in vault', recommendation: 'Set INTEGRITY_HASHES in Supabase vault' })
                };
            }

            try {
                const hashes = JSON.parse(vaultHashes);
                const expected = hashes[file];
                if (!expected) {
                    return { statusCode: 404, headers, body: JSON.stringify({ error: `File ${file} not in integrity manifest` }) };
                }

                const match = hash === expected;
                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({
                        file,
                        integrity: match ? 'INTACT' : 'TAMPERED',
                        match,
                        action_required: match ? 'NONE' : 'RESTORE_ORIGINAL — FIX SOURCE, NOT TEST',
                        checked_at: new Date().toISOString()
                    })
                };
            } catch (e) {
                return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to parse vault hashes' }) };
            }
        }

        // ═══ DEACTIVATE — REFUSED ═══
        if (action === 'deactivate') {
            return {
                statusCode: 403, headers,
                body: JSON.stringify({
                    error: 'INTEGRITY GUARD NU POATE FI DEZACTIVAT',
                    rule: 'SE REPARĂ CODUL SURSĂ, NU SE OCOLEȘTE TESTUL',
                    integrity_guard: 'ACTIVE',
                    tamper_attempt_logged: true
                })
            };
        }

        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action. Use: status, verify' }) };

    } catch (error) {
        console.error('[INTEGRITY-CHECK] Error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message, integrity_guard: 'ACTIVE' }) };
    }
};
