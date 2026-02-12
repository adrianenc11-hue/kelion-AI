// Netlify Function: User Authentication
// Simple token-based auth with localStorage subscription tracking

const { patchProcessEnv } = require('./get-secret');

const JWT_SECRET = process.env.JWT_SIGNING_KEY;
if (!JWT_SECRET) {
    console.error('⚠️ JWT_SIGNING_KEY not configured in environment!');
}
const crypto = require('crypto');

// Simple JWT-like token creation
function createToken(payload, expiresIn = '30d') {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const exp = Date.now() + (expiresIn === '30d' ? 30 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000);
    const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
    const signature = crypto.createHmac('sha256', JWT_SECRET)
        .update(`${header}.${body}`)
        .digest('base64url');
    return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
    try {
        const [header, body, signature] = token.split('.');
        const expectedSig = crypto.createHmac('sha256', JWT_SECRET)
            .update(`${header}.${body}`)
            .digest('base64url');

        if (signature !== expectedSig) return null;

        const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
        if (payload.exp < Date.now()) return null;

        return payload;
    } catch {
        return null;
    }
}

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': 'https://kelionai.app',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        await patchProcessEnv(); // Load vault secrets
        const body = event.body ? JSON.parse(event.body) : {};
        const { action, email, subscriptionId, token } = body;

        // Action: Register/Login with subscription
        if (action === 'login' || action === 'register') {
            if (!email || !subscriptionId) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({
                        error: 'Email and subscriptionId required',
                        message: 'Please complete PayPal subscription first'
                    })
                };
            }

            // Create user token
            const userToken = createToken({
                email,
                subscriptionId,
                createdAt: Date.now()
            });

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    token: userToken,
                    user: { email, subscriptionId }
                })
            };
        }

        // Action: Verify token
        if (action === 'verify') {
            if (!token) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Token required' })
                };
            }

            const payload = verifyToken(token);

            if (!payload) {
                return {
                    statusCode: 401,
                    headers,
                    body: JSON.stringify({ valid: false, error: 'Invalid or expired token' })
                };
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    valid: true,
                    user: {
                        email: payload.email,
                        subscriptionId: payload.subscriptionId
                    }
                })
            };
        }

        // Action: Check subscription status (combines auth + PayPal check)
        if (action === 'status') {
            const authHeader = event.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        authenticated: false,
                        subscribed: false,
                        freeTrialActive: true
                    })
                };
            }

            const userToken = authHeader.split(' ')[1];
            const payload = verifyToken(userToken);

            if (!payload) {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        authenticated: false,
                        subscribed: false,
                        freeTrialActive: true
                    })
                };
            }

            // User is authenticated with subscription
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    authenticated: true,
                    subscribed: true,
                    user: {
                        email: payload.email,
                        subscriptionId: payload.subscriptionId
                    },
                    freeTrialActive: false
                })
            };
        }

        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
                error: 'Invalid action',
                available: ['login', 'register', 'verify', 'status']
            })
        };

    } catch (error) {
        console.error('Auth Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
