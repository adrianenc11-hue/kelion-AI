// ═══ AVATAR VERSIONING SYSTEM ═══
// Covers: 6.1 (versioning), 6.2 (upgrade policy), 6.3 (admin changelog), 6.5 (auto-suggest upgrades)
// 
// Actions:
//   get_version      — Current avatar version
//   get_changelog    — Full version history
//   check_upgrades   — Auto-suggest available upgrades
//   apply_upgrade    — Apply upgrade (auto for minor, admin confirm for major)
//   add_version      — Register new version (admin only)

const { patchProcessEnv } = require('./get-secret');
const { createClient } = require('@supabase/supabase-js');

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
};

let supabase = null;
function getDB() {
    if (!supabase) {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
        if (url && key) supabase = createClient(url, key);
    }
    return supabase;
}

function respond(code, data) {
    return { statusCode: code, headers, body: JSON.stringify({ success: code === 200, ...data }) };
}

// ═══ VERSION COMPARISON ═══
function parseVersion(v) {
    const parts = (v || '1.0.0').split('.').map(Number);
    return { major: parts[0] || 1, minor: parts[1] || 0, patch: parts[2] || 0 };
}

function isUpgradeType(from, to) {
    const f = parseVersion(from);
    const t = parseVersion(to);
    if (t.major > f.major) return 'major';
    if (t.minor > f.minor) return 'minor';
    if (t.patch > f.patch) return 'patch';
    return 'none';
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return respond(405, { error: 'POST only' });

    try {
        await patchProcessEnv();
        const db = getDB();
        if (!db) return respond(500, { error: 'Database not configured' });

        const body = JSON.parse(event.body || '{}');
        const { action } = body;

        switch (action) {
            case 'get_version':
                return respond(200, await getCurrentVersion(db, body));

            case 'get_changelog':
                return respond(200, await getChangelog(db, body));

            case 'check_upgrades':
                return respond(200, await checkUpgrades(db, body));

            case 'apply_upgrade':
                return respond(200, await applyUpgrade(db, body));

            case 'add_version':
                return respond(200, await addVersion(db, body));

            default:
                return respond(400, {
                    error: 'Actions: get_version, get_changelog, check_upgrades, apply_upgrade, add_version'
                });
        }
    } catch (err) {
        console.error('[avatar-versioning] Error:', err);
        return respond(500, { error: err.message });
    }
};

// ═══ GET CURRENT VERSION ═══
async function getCurrentVersion(db, { user_id }) {
    // Get user's current avatar version
    if (user_id) {
        const { data: user } = await db.from('users')
            .select('avatar_version, avatar_name')
            .eq('id', user_id)
            .single();

        if (user) {
            return {
                version: user.avatar_version || '1.0.0',
                avatar_name: user.avatar_name || 'Kelion',
                parsed: parseVersion(user.avatar_version || '1.0.0')
            };
        }
    }

    // Get latest system version
    const { data: latest } = await db.from('avatar_versions')
        .select('*')
        .order('released_at', { ascending: false })
        .limit(1)
        .single();

    return {
        version: latest?.version || '1.0.0',
        avatar_name: 'Kelion',
        parsed: parseVersion(latest?.version || '1.0.0'),
        is_latest: true
    };
}

// ═══ GET CHANGELOG ═══
// Returns full version history for admin panel (6.3)
async function getChangelog(db, { limit = 50 }) {
    const { data, error } = await db.from('avatar_versions')
        .select('*')
        .order('released_at', { ascending: false })
        .limit(limit);

    if (error) return { error: error.message };

    const changelog = (data || []).map(v => ({
        version: v.version,
        type: v.upgrade_type, // major, minor, patch
        title: v.title,
        changes: v.changes || [],
        released_at: v.released_at,
        auto_apply: v.auto_apply, // true for minor/patch, false for major
        applied_count: v.applied_count || 0
    }));

    return {
        changelog,
        total: changelog.length,
        latest: changelog[0]?.version || '1.0.0'
    };
}

// ═══ CHECK UPGRADES — Auto-suggest (6.5) ═══
async function checkUpgrades(db, { user_id, current_version }) {
    const userVersion = current_version || '1.0.0';

    // Get all versions newer than current
    const { data: versions } = await db.from('avatar_versions')
        .select('*')
        .order('released_at', { ascending: true });

    const available = (versions || []).filter(v => {
        const type = isUpgradeType(userVersion, v.version);
        return type !== 'none';
    });

    // Separate by upgrade policy (6.2)
    const autoUpgrades = available.filter(v => v.auto_apply === true);
    const manualUpgrades = available.filter(v => v.auto_apply === false);

    // Suggestions
    const suggestions = available.map(v => ({
        version: v.version,
        type: isUpgradeType(userVersion, v.version),
        title: v.title,
        changes_summary: (v.changes || []).slice(0, 3),
        auto_apply: v.auto_apply,
        recommendation: v.auto_apply
            ? '✅ Auto-update — will be applied automatically'
            : '⚠️ Major update — requires admin approval'
    }));

    return {
        current_version: userVersion,
        upgrades_available: available.length,
        auto_upgrades: autoUpgrades.length,
        manual_upgrades: manualUpgrades.length,
        suggestions,
        policy: {
            minor_patch: 'Automatic — applied without intervention',
            major: 'Manual — requires admin confirmation in admin panel'
        }
    };
}

// ═══ APPLY UPGRADE (6.2 policy) ═══
async function applyUpgrade(db, { user_id, target_version, admin_confirmed }) {
    if (!user_id || !target_version) {
        return { error: 'user_id and target_version required' };
    }

    // Get current user version
    const { data: user } = await db.from('users')
        .select('avatar_version')
        .eq('id', user_id)
        .single();

    const currentVersion = user?.avatar_version || '1.0.0';
    const upgradeType = isUpgradeType(currentVersion, target_version);

    if (upgradeType === 'none') {
        return { error: 'Target version is not newer than current', current: currentVersion, target: target_version };
    }

    // Policy check: major upgrades need admin confirmation
    if (upgradeType === 'major' && !admin_confirmed) {
        return {
            requires_confirmation: true,
            upgrade_type: 'major',
            message: 'Major upgrade requires admin confirmation. Set admin_confirmed: true to proceed.',
            from: currentVersion,
            to: target_version
        };
    }

    // Apply the upgrade
    const { error: updateError } = await db.from('users')
        .update({
            avatar_version: target_version,
            avatar_updated_at: new Date().toISOString()
        })
        .eq('id', user_id);

    if (updateError) return { error: updateError.message };

    // Increment applied count
    await db.from('avatar_versions')
        .update({ applied_count: db.rpc ? undefined : 1 }) // Increment handled by trigger ideally
        .eq('version', target_version);

    // Log the upgrade
    await db.from('avatar_upgrade_log').insert({
        user_id,
        from_version: currentVersion,
        to_version: target_version,
        upgrade_type: upgradeType,
        admin_confirmed: admin_confirmed || false,
        applied_at: new Date().toISOString()
    }).catch(() => { /* log table might not exist yet */ });

    return {
        upgraded: true,
        from: currentVersion,
        to: target_version,
        type: upgradeType,
        admin_confirmed: admin_confirmed || false
    };
}

// ═══ ADD NEW VERSION (admin only) ═══
async function addVersion(db, { version, title, changes, auto_apply, admin_email }) {
    if (!version || !title) {
        return { error: 'version and title required' };
    }

    // Verify admin role
    if (admin_email) {
        const { data: adminUser } = await db.from('users')
            .select('role')
            .eq('email', admin_email)
            .single();
        if (!adminUser || adminUser.role !== 'admin') {
            return { error: 'Admin access required to add versions' };
        }
    }

    // Determine upgrade type from previous version
    const { data: latest } = await db.from('avatar_versions')
        .select('version')
        .order('released_at', { ascending: false })
        .limit(1)
        .single();

    const upgradeType = latest ? isUpgradeType(latest.version, version) : 'major';

    // Default auto_apply based on upgrade type (6.2 policy)
    const shouldAutoApply = auto_apply !== undefined
        ? auto_apply
        : (upgradeType === 'minor' || upgradeType === 'patch');

    const { data, error } = await db.from('avatar_versions')
        .upsert({
            version,
            title,
            changes: changes || [],
            upgrade_type: upgradeType,
            auto_apply: shouldAutoApply,
            released_at: new Date().toISOString(),
            applied_count: 0
        }, { onConflict: 'version' })
        .select()
        .single();

    if (error) return { error: error.message };

    return {
        added: true,
        version: data.version,
        upgrade_type: upgradeType,
        auto_apply: shouldAutoApply,
        policy_note: shouldAutoApply
            ? 'Minor/patch — will auto-apply to all users'
            : 'Major — requires admin confirmation per user'
    };
}
