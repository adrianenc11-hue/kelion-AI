/**
 * Group Management — Family & Business plans
 * Actions: create_group, invite_member, accept_invite, list_members, remove_member, group_info
 * 
 * Family: up to 5 members, owner = parent
 * Business: up to 50 members, owner = admin, company name required
 */

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const MAX_MEMBERS = { family: 5, business: 50 };
const JWT_SECRET = process.env.JWT_SECRET || 'kelionai_jwt_secret_2026';

function getSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
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
        const body = JSON.parse(event.body || '{}');
        const { action } = body;

        switch (action) {

            // ═══ CREATE GROUP ═══
            // Owner creates a family or business group after subscribing
            case 'create_group': {
                const { owner_email, group_type, group_name, company_name } = body;

                if (!owner_email || !group_type) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'owner_email and group_type required' }) };
                }
                if (!['family', 'business'].includes(group_type)) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'group_type must be family or business' }) };
                }
                if (group_type === 'business' && !company_name) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'company_name required for business groups' }) };
                }

                // Check owner exists and has correct plan
                const { data: owner } = await supabase
                    .from('users')
                    .select('id, email, subscription_status')
                    .eq('email', owner_email)
                    .single();

                if (!owner) {
                    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Owner account not found. Subscribe first.' }) };
                }

                // Check if owner already has a group
                const { data: existingGroup } = await supabase
                    .from('groups')
                    .select('id')
                    .eq('owner_email', owner_email)
                    .single();

                if (existingGroup) {
                    return { statusCode: 409, headers, body: JSON.stringify({ error: 'You already have a group', group_id: existingGroup.id }) };
                }

                // Create group
                const groupCode = `${group_type.charAt(0).toUpperCase()}${Date.now().toString(36).toUpperCase()}`;
                const { data: newGroup, error: insertErr } = await supabase
                    .from('groups')
                    .insert({
                        owner_email,
                        group_type,
                        group_name: group_name || (group_type === 'family' ? `${owner_email.split('@')[0]}'s Family` : company_name),
                        company_name: company_name || null,
                        group_code: groupCode,
                        max_members: MAX_MEMBERS[group_type],
                        created_at: new Date().toISOString()
                    })
                    .select()
                    .single();

                if (insertErr) {
                    return { statusCode: 500, headers, body: JSON.stringify({ error: insertErr.message }) };
                }

                // Add owner as first member
                const ownerRole = group_type === 'business' ? 'manager' : 'owner';
                await supabase.from('group_members').insert({
                    group_id: newGroup.id,
                    email: owner_email,
                    role: ownerRole,
                    status: 'active',
                    joined_at: new Date().toISOString()
                });

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({
                        success: true,
                        group: newGroup,
                        message: `${group_type} group created! Share code ${groupCode} to invite members.`,
                        invite_link: `https://kelionai.app/subscribe.html?join=${groupCode}`
                    })
                };
            }

            // ═══ INVITE MEMBER ═══
            // Owner sends invite to a member by email
            case 'invite_member': {
                const { owner_email, member_email, group_id } = body;

                if (!owner_email || !member_email) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'owner_email and member_email required' }) };
                }

                // Get group
                const { data: group } = await supabase
                    .from('groups')
                    .select('*')
                    .eq(group_id ? 'id' : 'owner_email', group_id || owner_email)
                    .single();

                if (!group || group.owner_email !== owner_email) {
                    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Not authorized or group not found' }) };
                }

                // Check member count
                const { data: members } = await supabase
                    .from('group_members')
                    .select('id')
                    .eq('group_id', group.id);

                if (members && members.length >= group.max_members) {
                    return {
                        statusCode: 400, headers, body: JSON.stringify({
                            error: `Maximum ${group.max_members} members reached for ${group.group_type} plan`
                        })
                    };
                }

                // Check if already a member
                const { data: existing } = await supabase
                    .from('group_members')
                    .select('id, status')
                    .eq('group_id', group.id)
                    .eq('email', member_email)
                    .single();

                if (existing) {
                    return { statusCode: 409, headers, body: JSON.stringify({ error: 'Member already in group', status: existing.status }) };
                }

                // Add as pending
                await supabase.from('group_members').insert({
                    group_id: group.id,
                    email: member_email,
                    role: 'member',
                    status: 'invited',
                    invited_at: new Date().toISOString()
                });

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({
                        success: true,
                        message: `Invitation sent to ${member_email}`,
                        join_link: `https://kelionai.app/subscribe.html?join=${group.group_code}&email=${encodeURIComponent(member_email)}`
                    })
                };
            }

            // ═══ ACCEPT INVITE & CREATE MEMBER ACCOUNT ═══
            // Member joins group by providing invite code + creates their login
            case 'accept_invite': {
                const { group_code, email, password, name } = body;

                if (!group_code || !email || !password) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'group_code, email, password required' }) };
                }

                // Find group by code
                const { data: group } = await supabase
                    .from('groups')
                    .select('*')
                    .eq('group_code', group_code)
                    .single();

                if (!group) {
                    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Invalid group code' }) };
                }

                // Check member count
                const { data: allMembers } = await supabase
                    .from('group_members')
                    .select('id')
                    .eq('group_id', group.id)
                    .in('status', ['active', 'invited']);

                if (allMembers && allMembers.length >= group.max_members) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Group is full' }) };
                }

                // Create user account (or update existing)
                const hashedPassword = await bcrypt.hash(password, 10);

                const { data: existingUser } = await supabase
                    .from('users')
                    .select('id')
                    .eq('email', email)
                    .single();

                if (existingUser) {
                    // Update existing user's subscription
                    await supabase.from('users').update({
                        subscription_status: `${group.group_type}_member`,
                        group_id: group.id,
                        subscription_updated_at: new Date().toISOString()
                    }).eq('email', email);
                } else {
                    // Create new user
                    await supabase.from('users').insert({
                        email,
                        password_hash: hashedPassword,
                        name: name || email.split('@')[0],
                        subscription_status: `${group.group_type}_member`,
                        group_id: group.id,
                        created_at: new Date().toISOString()
                    });
                }

                // Update group membership
                const { data: memberRecord } = await supabase
                    .from('group_members')
                    .select('id')
                    .eq('group_id', group.id)
                    .eq('email', email)
                    .single();

                if (memberRecord) {
                    await supabase.from('group_members').update({
                        status: 'active',
                        name: name || email.split('@')[0],
                        joined_at: new Date().toISOString()
                    }).eq('id', memberRecord.id);
                } else {
                    await supabase.from('group_members').insert({
                        group_id: group.id,
                        email,
                        name: name || email.split('@')[0],
                        role: 'member',
                        status: 'active',
                        joined_at: new Date().toISOString()
                    });
                }

                // Generate JWT for auto-login
                const token = jwt.sign({ email, group_id: group.id, role: 'member' }, JWT_SECRET, { expiresIn: '30d' });

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({
                        success: true,
                        message: `Welcome to ${group.group_name}!`,
                        user: {
                            email,
                            name: name || email.split('@')[0],
                            subscription_status: `${group.group_type}_member`,
                            group_name: group.group_name,
                            group_type: group.group_type
                        },
                        accessToken: token
                    })
                };
            }

            // ═══ LIST MEMBERS ═══
            case 'list_members': {
                const { owner_email, group_id } = body;

                const { data: group } = await supabase
                    .from('groups')
                    .select('*')
                    .eq(group_id ? 'id' : 'owner_email', group_id || owner_email)
                    .single();

                if (!group) {
                    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Group not found' }) };
                }

                const { data: members } = await supabase
                    .from('group_members')
                    .select('email, name, role, status, joined_at, invited_at')
                    .eq('group_id', group.id)
                    .order('joined_at', { ascending: true });

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({
                        success: true,
                        group: {
                            id: group.id,
                            name: group.group_name,
                            type: group.group_type,
                            company: group.company_name,
                            code: group.group_code,
                            max_members: group.max_members
                        },
                        members: members || [],
                        count: members?.length || 0,
                        remaining: group.max_members - (members?.length || 0)
                    })
                };
            }

            // ═══ REMOVE MEMBER ═══
            case 'remove_member': {
                const { owner_email, member_email } = body;

                if (!owner_email || !member_email) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'owner_email and member_email required' }) };
                }

                const { data: group } = await supabase
                    .from('groups')
                    .select('*')
                    .eq('owner_email', owner_email)
                    .single();

                if (!group) {
                    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Not authorized' }) };
                }

                if (member_email === owner_email) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Cannot remove the owner' }) };
                }

                await supabase.from('group_members')
                    .delete()
                    .eq('group_id', group.id)
                    .eq('email', member_email);

                // Downgrade member's account
                await supabase.from('users')
                    .update({ subscription_status: 'free', group_id: null })
                    .eq('email', member_email);

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({ success: true, message: `${member_email} removed from group` })
                };
            }

            // ═══ GROUP INFO — public, for join page ═══
            case 'group_info': {
                const { group_code } = body;
                if (!group_code) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'group_code required' }) };
                }

                const { data: group } = await supabase
                    .from('groups')
                    .select('group_name, group_type, company_name, max_members')
                    .eq('group_code', group_code)
                    .single();

                if (!group) {
                    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Group not found' }) };
                }

                const { data: members } = await supabase
                    .from('group_members')
                    .select('id')
                    .eq('group_id', group_code);

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({
                        success: true,
                        group_name: group.group_name,
                        group_type: group.group_type,
                        company_name: group.company_name,
                        spots_remaining: group.max_members - (members?.length || 0)
                    })
                };
            }

            default:
                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({
                        success: true,
                        actions: ['create_group', 'invite_member', 'accept_invite', 'list_members', 'remove_member', 'group_info'],
                        plans: {
                            family: { max_members: 5, price_monthly: 25, price_annual: 180 },
                            business: { max_members: 50, price_monthly: 99, price_annual: 800 }
                        }
                    })
                };
        }
    } catch (error) {
        console.error('Group management error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
