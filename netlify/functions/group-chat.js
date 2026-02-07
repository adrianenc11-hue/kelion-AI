/**
 * Group Chat — Messenger for Family & Business plans
 * Actions: send_message, get_messages, delete_message
 * Supports: text, audio, file messages
 */

const { createClient } = require('@supabase/supabase-js');

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

            // ═══ SEND MESSAGE ═══
            case 'send_message': {
                const { email, group_id, type, content, file_url, file_name } = body;

                if (!email || !content) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'email and content required' }) };
                }

                // Find group
                let gid = group_id;
                let senderName = email.split('@')[0];
                if (!gid) {
                    const { data: member } = await supabase
                        .from('group_members')
                        .select('group_id, name')
                        .eq('email', email)
                        .eq('status', 'active')
                        .single();
                    if (!member) {
                        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Not a group member' }) };
                    }
                    gid = member.group_id;
                    senderName = member.name || senderName;
                }

                const { data: msg, error: insertErr } = await supabase
                    .from('group_messages')
                    .insert({
                        group_id: gid,
                        sender_email: email,
                        sender_name: senderName,
                        type: type || 'text', // text, audio, file
                        content,
                        file_url: file_url || null,
                        file_name: file_name || null,
                        created_at: new Date().toISOString()
                    })
                    .select()
                    .single();

                if (insertErr) {
                    return { statusCode: 500, headers, body: JSON.stringify({ error: insertErr.message }) };
                }

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({ success: true, message: msg })
                };
            }

            // ═══ GET MESSAGES ═══
            case 'get_messages': {
                const { email, group_id, limit, before } = body;

                if (!email && !group_id) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'email or group_id required' }) };
                }

                // Find group
                let gid = group_id;
                if (!gid) {
                    const { data: member } = await supabase
                        .from('group_members')
                        .select('group_id')
                        .eq('email', email)
                        .eq('status', 'active')
                        .single();
                    if (!member) {
                        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Not a group member' }) };
                    }
                    gid = member.group_id;
                }

                let query = supabase
                    .from('group_messages')
                    .select('id, sender_email, sender_name, type, content, file_url, file_name, created_at')
                    .eq('group_id', gid)
                    .order('created_at', { ascending: false })
                    .limit(limit || 50);

                if (before) {
                    query = query.lt('created_at', before);
                }

                const { data: messages, error: fetchErr } = await query;

                if (fetchErr) {
                    return { statusCode: 500, headers, body: JSON.stringify({ error: fetchErr.message }) };
                }

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({
                        success: true,
                        messages: (messages || []).reverse(),
                        count: messages?.length || 0
                    })
                };
            }

            // ═══ DELETE MESSAGE ═══
            case 'delete_message': {
                const { email, message_id } = body;

                if (!email || !message_id) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'email and message_id required' }) };
                }

                // Only sender or group owner/manager can delete
                const { data: msg } = await supabase
                    .from('group_messages')
                    .select('id, sender_email, group_id')
                    .eq('id', message_id)
                    .single();

                if (!msg) {
                    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Message not found' }) };
                }

                if (msg.sender_email !== email) {
                    // Check if owner/manager
                    const { data: member } = await supabase
                        .from('group_members')
                        .select('role')
                        .eq('group_id', msg.group_id)
                        .eq('email', email)
                        .single();

                    if (!member || !['owner', 'manager'].includes(member.role)) {
                        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Only sender or admin can delete' }) };
                    }
                }

                await supabase.from('group_messages').delete().eq('id', message_id);

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({ success: true, message: 'Message deleted' })
                };
            }

            // ═══ UPLOAD FILE ═══
            // Accepts base64 file data, stores in Supabase Storage
            case 'upload_file': {
                const { email, file_data, file_name, file_type } = body;

                if (!email || !file_data || !file_name) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'email, file_data, file_name required' }) };
                }

                const buffer = Buffer.from(file_data, 'base64');
                const filePath = `chat/${Date.now()}_${file_name}`;

                const { data: uploadData, error: uploadErr } = await supabase
                    .storage
                    .from('group-files')
                    .upload(filePath, buffer, {
                        contentType: file_type || 'application/octet-stream',
                        upsert: false
                    });

                if (uploadErr) {
                    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Upload failed: ' + uploadErr.message }) };
                }

                const { data: publicUrl } = supabase
                    .storage
                    .from('group-files')
                    .getPublicUrl(filePath);

                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({
                        success: true,
                        file_url: publicUrl.publicUrl,
                        file_name,
                        file_path: filePath
                    })
                };
            }

            default:
                return {
                    statusCode: 200, headers,
                    body: JSON.stringify({
                        success: true,
                        service: 'group-chat',
                        actions: ['send_message', 'get_messages', 'delete_message', 'upload_file']
                    })
                };
        }
    } catch (error) {
        console.error('Group chat error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
