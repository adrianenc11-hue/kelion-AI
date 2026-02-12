// claude-audit.js — Background function for AI-powered code audit
// Uses Claude API to analyze all functions for code quality, security, bugs
// Timeout: 900s (background function)

const { patchProcessEnv } = require('./get-secret');

const { Anthropic } = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

exports.handler = async (event) => {
    await patchProcessEnv(); // Load vault secrets FIRST
    const CORS = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: CORS };
    }

    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
    if (!ANTHROPIC_KEY) {
        return {
            statusCode: 503,
            headers: CORS,
            body: JSON.stringify({
                ok: false,
                error_code: 'config_missing',
                message: 'ANTHROPIC_API_KEY not configured'
            })
        };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const targetFile = body.file; // Optional: audit specific file
        const auditType = body.type || 'security'; // security | quality | bugs | full

        // Discover functions to audit
        const functionsDir = path.join(__dirname);
        let files;

        if (targetFile) {
            const filePath = path.join(functionsDir, path.basename(targetFile));
            if (!fs.existsSync(filePath)) {
                return {
                    statusCode: 400,
                    headers: CORS,
                    body: JSON.stringify({ ok: false, error_code: 'file_not_found', message: `File not found: ${targetFile}` })
                };
            }
            files = [targetFile];
        } else {
            files = fs.readdirSync(functionsDir)
                .filter(f => f.endsWith('.js') && f !== 'claude-audit.js')
                .slice(0, 10); // Limit to 10 files per audit run
        }

        const client = new Anthropic({ apiKey: ANTHROPIC_KEY });
        const results = [];

        for (const file of files) {
            const code = fs.readFileSync(path.join(functionsDir, file), 'utf8');

            // Skip very large files
            if (code.length > 50000) {
                results.push({ file, status: 'skipped', reason: 'File too large (>50KB)' });
                continue;
            }

            const prompts = {
                security: 'Analyze this Node.js serverless function for security vulnerabilities. Check for: hardcoded secrets, injection risks, missing input validation, CORS issues, rate limiting gaps. Be specific with line numbers.',
                quality: 'Review this code for quality issues: dead code, error handling gaps, performance bottlenecks, code smells. Be specific.',
                bugs: 'Find bugs in this code: logic errors, edge cases, race conditions, unhandled errors. Be specific with examples.',
                full: 'Do a comprehensive audit: security + quality + bugs. Prioritize findings by severity (CRITICAL, HIGH, MEDIUM, LOW).'
            };

            const response = await client.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 2000,
                messages: [{
                    role: 'user',
                    content: `${prompts[auditType] || prompts.security}\n\nFile: ${file}\n\`\`\`javascript\n${code}\n\`\`\``
                }]
            });

            results.push({
                file,
                status: 'audited',
                audit_type: auditType,
                findings: response.content[0]?.text || 'No findings'
            });
        }

        return {
            statusCode: 200,
            headers: CORS,
            body: JSON.stringify({
                ok: true,
                audit_type: auditType,
                files_audited: results.length,
                timestamp: new Date().toISOString(),
                results
            })
        };

    } catch (err) {
        console.error('Claude audit error:', err);
        return {
            statusCode: 500,
            headers: CORS,
            body: JSON.stringify({
                ok: false,
                error_code: 'audit_error',
                message: err.message
            })
        };
    }
};
