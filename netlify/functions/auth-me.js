// ============================================================================
// Netlify Function: Auth Me (Get/Update Profile)
// GET /auth/me - Get current user
// PATCH /auth/me - Update profile
// ============================================================================

const { patchProcessEnv } = require('./get-secret');

const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET;

function verifyToken(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.substring(7);

    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

exports.handler = async (event, _context) => {
    const headers = {
        'Access-Control-Allow-Origin': 'https://kelionai.app',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Verify JWT
    const decoded = verifyToken(event.headers.authorization);

    if (!decoded) {
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: 'Invalid or expired token' })
        };
    }

    const userId = decoded.sub;

    try {
        await patchProcessEnv(); // Load vault secrets
        // GET - Fetch user profile
        if (event.httpMethod === 'GET') {
            const { data: user, error: userError } = await supabase
                .from('users')
                .select('id, email, email_verified, status, role, subscription_status, subscription_expires_at, timezone, locale, created_at, last_login_at')
                .eq('id', userId)
                .single();

            if (!user || userError) {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ error: 'User not found' })
                };
            }

            const { data: profile } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('user_id', userId)
                .single();

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    user: {
                        id: user.id,
                        email: user.email,
                        emailVerified: user.email_verified,
                        status: user.status,
                        role: user.role,
                        subscription: user.subscription_status,
                        subscriptionExpires: user.subscription_expires_at,
                        timezone: user.timezone,
                        locale: user.locale,
                        createdAt: user.created_at,
                        lastLoginAt: user.last_login_at
                    },
                    profile: profile ? {
                        displayName: profile.display_name,
                        firstName: profile.first_name,
                        lastName: profile.last_name,
                        phone: profile.phone,
                        phoneVerified: profile.phone_verified,
                        country: profile.country,
                        city: profile.city,
                        company: profile.company,
                        jobTitle: profile.job_title,
                        avatarUrl: profile.avatar_url,
                        bio: profile.bio,
                        preferences: profile.preferences
                    } : null
                })
            };
        }

        // PATCH - Update profile
        if (event.httpMethod === 'PATCH') {
            const updates = JSON.parse(event.body);

            // Separate user updates from profile updates
            const userFields = ['timezone', 'locale'];
            const profileFields = ['displayName', 'firstName', 'lastName', 'phone', 'country', 'city', 'company', 'jobTitle', 'avatarUrl', 'bio', 'preferences'];

            const userUpdates = {};
            const profileUpdates = {};

            // Map updates to correct tables
            for (const [key, value] of Object.entries(updates)) {
                if (userFields.includes(key)) {
                    userUpdates[key === 'timezone' ? 'timezone' : 'locale'] = value;
                } else if (profileFields.includes(key)) {
                    // Convert camelCase to snake_case
                    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
                    profileUpdates[snakeKey] = value;
                }
            }

            // Update user table
            if (Object.keys(userUpdates).length > 0) {
                const { error: userUpdateError } = await supabase
                    .from('users')
                    .update(userUpdates)
                    .eq('id', userId);

                if (userUpdateError) {
                    console.error('User update error:', userUpdateError);
                }
            }

            // Update profile table
            if (Object.keys(profileUpdates).length > 0) {
                const { error: profileUpdateError } = await supabase
                    .from('user_profiles')
                    .update(profileUpdates)
                    .eq('user_id', userId);

                if (profileUpdateError) {
                    // Profile might not exist, try insert
                    await supabase
                        .from('user_profiles')
                        .upsert({
                            user_id: userId,
                            ...profileUpdates
                        });
                }
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Profile updated successfully'
                })
            };
        }

        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };

    } catch (error) {
        console.error('Auth me error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
