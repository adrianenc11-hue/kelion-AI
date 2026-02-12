// K Terminal - Secure command execution via Netlify API
// Uses Netlify API for serverless-safe operations instead of local execSync

const { patchProcessEnv } = require('./get-secret');

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

    try {
        await patchProcessEnv(); // Load vault secrets
        const { command, action } = JSON.parse(event.body || '{}');
        if (!command && !action) return { statusCode: 400, headers, body: JSON.stringify({ error: 'command or action required' }) };

        // Safe virtual commands that work in serverless
        const safeCommands = {
            'node -v': { output: `Node.js ${process.version}`, success: true },
            'node --version': { output: `Node.js ${process.version}`, success: true },
            'npm -v': { output: 'Available via build system', success: true },
            'env': { output: Object.keys(process.env).filter(k => !k.includes('KEY') && !k.includes('SECRET') && !k.includes('TOKEN')).sort().join('\n'), success: true },
            'whoami': { output: 'kelionai-serverless', success: true },
            'date': { output: new Date().toISOString(), success: true },
            'uptime': { output: `Process uptime: ${Math.floor(process.uptime())}s`, success: true },
            'pwd': { output: '/var/task/netlify/functions', success: true },
            'df': { output: `Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB / ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`, success: true },
        };

        const cmd = (command || action).trim().toLowerCase();

        // Block dangerous patterns
        const blocked = ['rm ', 'del ', 'format', 'shutdown', 'reboot', 'kill', 'pkill', 'curl ', 'wget ', '&&', '||', '|', ';', '`', '$(', 'sudo', 'chmod', 'chown'];
        if (blocked.some(b => cmd.includes(b))) {
            return { statusCode: 403, headers, body: JSON.stringify({ error: 'Command blocked for security', blocked_pattern: true }) };
        }

        // Check safe commands
        if (safeCommands[cmd]) {
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, command: cmd, ...safeCommands[cmd], environment: 'serverless' }) };
        }

        // System info commands
        if (cmd === 'sysinfo' || cmd === 'system') {
            return {
                statusCode: 200, headers, body: JSON.stringify({
                    success: true,
                    command: cmd,
                    output: {
                        node_version: process.version,
                        platform: process.platform,
                        arch: process.arch,
                        memory: process.memoryUsage(),
                        uptime_seconds: Math.floor(process.uptime()),
                        env_vars_count: Object.keys(process.env).length
                    },
                    environment: 'serverless'
                })
            };
        }

        // Netlify API commands
        if (cmd.startsWith('netlify ') || cmd === 'deploy-status') {
            const netlifyToken = process.env.NETLIFY_AUTH_TOKEN;
            const siteId = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;

            if (!netlifyToken || !siteId) {
                return { statusCode: 200, headers, body: JSON.stringify({ success: true, command: cmd, output: 'Netlify API tokens not configured. Set NETLIFY_AUTH_TOKEN and SITE_ID.', environment: 'serverless' }) };
            }

            const netlifyRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys?per_page=5`, {
                headers: { 'Authorization': `Bearer ${netlifyToken}` }
            });
            const deploys = await netlifyRes.json();

            return {
                statusCode: 200, headers, body: JSON.stringify({
                    success: true,
                    command: cmd,
                    output: Array.isArray(deploys) ? deploys.map(d => ({
                        id: d.id?.substring(0, 8),
                        state: d.state,
                        created: d.created_at,
                        context: d.context,
                        branch: d.branch
                    })) : deploys,
                    environment: 'serverless'
                })
            };
        }

        return {
            statusCode: 200, headers, body: JSON.stringify({
                success: true,
                command: cmd,
                output: `Command '${cmd}' not available in serverless. Available: node -v, date, uptime, env, sysinfo, whoami, pwd, df, netlify status, deploy-status`,
                environment: 'serverless'
            })
        };
    } catch (error) {
        console.error('Terminal error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
