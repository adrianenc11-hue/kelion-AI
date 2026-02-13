/**
 * Admin Notify — Email alerts for important events
 * Uses Supabase to log notifications + sends email via SMTP/API
 * Events: new_api_key, payment_received, low_credits, high_usage, daily_report
 */

const { patchProcessEnv } = require('./get-secret');

const { createClient } = require('@supabase/supabase-js');

// Admin email — receives all notifications (from env var)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

function getSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key);
}

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

    const supabase = getSupabase();

    try {
        await patchProcessEnv(); // Load vault secrets
        const { action, event_type, data } = JSON.parse(event.body || '{}');

        // ═══ LOG NOTIFICATION ═══
        if (action === 'notify' || event_type) {
            const notification = {
                event_type: event_type || action,
                data: data || {},
                admin_email: ADMIN_EMAIL,
                read: false,
                created_at: new Date().toISOString()
            };

            // Store in Supabase
            if (supabase) {
                await supabase.from('admin_notifications').insert(notification);
            }

            // Send email if RESEND_API_KEY is configured
            const resendKey = process.env.RESEND_API_KEY;
            if (resendKey) {
                try {
                    const subjects = {
                        new_api_key: '🔑 New API Key Generated',
                        payment_received: '💳 Payment Received',
                        low_credits: '⚠️ Low Credits Alert',
                        high_usage: '📈 High Usage Alert',
                        daily_report: '📊 Daily Report'
                    };
                    const subject = subjects[notification.event_type] || `📌 ${notification.event_type}`;
                    const details = Object.entries(notification.data || {}).map(([k, v]) => `<tr><td style="padding:6px 12px;color:#888;font-size:13px">${k}</td><td style="padding:6px 12px;color:#fff;font-size:13px;font-weight:500">${v}</td></tr>`).join('');

                    await fetch('https://api.resend.com/emails', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            from: 'Kelion AI <onboarding@resend.dev>',
                            to: [ADMIN_EMAIL],
                            subject: `[Kelion] ${subject}`,
                            html: `<div style="background:#0a0a1a;padding:30px;font-family:system-ui,sans-serif"><div style="max-width:480px;margin:0 auto;background:rgba(167,139,250,0.05);border:1px solid rgba(167,139,250,0.2);border-radius:16px;padding:24px"><h2 style="color:#a78bfa;margin:0 0 16px">${subject}</h2><table style="width:100%;border-collapse:collapse">${details}</table><div style="margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.05);font-size:11px;color:rgba(255,255,255,0.2)">Kelion AI · ${new Date().toLocaleString('en-GB')} · <a href="https://kelionai.app/admin.html" style="color:#a78bfa">Open Admin</a></div></div></div>`
                        })
                    });
                    console.log(`[EMAIL SENT] ${notification.event_type} → ${ADMIN_EMAIL}`);
                } catch (emailErr) {
                    console.error('[EMAIL ERROR]', emailErr.message);
                }
            }

            // Log for monitoring
            console.log('[ADMIN NOTIFY] %s:', notification.event_type, JSON.stringify(data));

            return {
                statusCode: 200, headers,
                body: JSON.stringify({ success: true, notification: notification.event_type, admin_email: ADMIN_EMAIL, email_sent: !!resendKey })
            };
        }

        // ═══ GET NOTIFICATIONS (for admin dashboard) ═══
        if (action === 'get_notifications') {
            if (!supabase) return { statusCode: 503, headers, body: JSON.stringify({ error: 'DB not configured' }) };

            const { data: notifs } = await supabase
                .from('admin_notifications')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

            return {
                statusCode: 200, headers,
                body: JSON.stringify({ success: true, notifications: notifs || [], unread: (notifs || []).filter(n => !n.read).length })
            };
        }

        // ═══ MARK READ ═══
        if (action === 'mark_read') {
            if (supabase) {
                await supabase.from('admin_notifications').update({ read: true }).eq('read', false);
            }
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        // ═══ FINANCIAL SUMMARY (real-time) ═══
        if (action === 'financial_summary') {
            if (!supabase) return { statusCode: 503, headers, body: JSON.stringify({ error: 'DB not configured' }) };

            const today = new Date().toISOString().split('T')[0];
            const monthStart = today.substring(0, 7) + '-01';

            // API costs today
            const { data: costsToday } = await supabase
                .from('api_usage_log')
                .select('estimated_cost')
                .gte('created_at', today + 'T00:00:00Z');

            // API costs this month
            const { data: costsMonth } = await supabase
                .from('api_usage_log')
                .select('estimated_cost')
                .gte('created_at', monthStart + 'T00:00:00Z');

            // Revenue this month
            const { data: revenueMonth } = await supabase
                .from('revenue_log')
                .select('amount')
                .gte('created_at', monthStart + 'T00:00:00Z');

            // Active API keys
            const { data: activeKeys, count: keyCount } = await supabase
                .from('api_keys')
                .select('credits_remaining, credits_total', { count: 'exact' })
                .eq('status', 'active');

            // API key usage today
            const { data: keyUsageToday } = await supabase
                .from('api_key_usage')
                .select('credits_used')
                .gte('created_at', today + 'T00:00:00Z');

            const totalCostToday = (costsToday || []).reduce((s, r) => s + (r.estimated_cost || 0), 0);
            const totalCostMonth = (costsMonth || []).reduce((s, r) => s + (r.estimated_cost || 0), 0);
            const totalRevenueMonth = (revenueMonth || []).reduce((s, r) => s + (r.amount || 0), 0);
            const totalCreditsRemaining = (activeKeys || []).reduce((s, r) => s + (r.credits_remaining || 0), 0);
            const totalCreditsTotal = (activeKeys || []).reduce((s, r) => s + (r.credits_total || 0), 0);
            const creditsUsedToday = (keyUsageToday || []).reduce((s, r) => s + (r.credits_used || 0), 0);

            return {
                statusCode: 200, headers,
                body: JSON.stringify({
                    success: true,
                    costs: {
                        today: Math.round(totalCostToday * 10000) / 10000,
                        month: Math.round(totalCostMonth * 10000) / 10000
                    },
                    revenue: {
                        month: Math.round(totalRevenueMonth * 100) / 100
                    },
                    profit: {
                        month: Math.round((totalRevenueMonth - totalCostMonth) * 100) / 100
                    },
                    api_keys: {
                        active: keyCount || 0,
                        credits_remaining: totalCreditsRemaining,
                        credits_total: totalCreditsTotal,
                        credits_used_today: creditsUsedToday
                    },
                    generated_at: new Date().toISOString()
                })
            };
        }

        return {
            statusCode: 200, headers,
            body: JSON.stringify({ service: 'admin-notify', actions: ['notify', 'get_notifications', 'mark_read', 'financial_summary'] })
        };

    } catch (error) {
        console.error('Admin notify error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
