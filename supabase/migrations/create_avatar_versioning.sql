-- ═══ AVATAR VERSIONING TABLES ═══
-- Supports: 6.1 (versioning), 6.2 (upgrade policy), 6.3 (changelog), 6.5 (auto-suggest)

-- Version registry
CREATE TABLE IF NOT EXISTS avatar_versions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    version TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    changes JSONB DEFAULT '[]'::jsonb,
    upgrade_type TEXT CHECK (upgrade_type IN ('major', 'minor', 'patch')) DEFAULT 'minor',
    auto_apply BOOLEAN DEFAULT true,
    released_at TIMESTAMPTZ DEFAULT now(),
    applied_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Upgrade log per user
CREATE TABLE IF NOT EXISTS avatar_upgrade_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    from_version TEXT NOT NULL,
    to_version TEXT NOT NULL,
    upgrade_type TEXT CHECK (upgrade_type IN ('major', 'minor', 'patch')),
    admin_confirmed BOOLEAN DEFAULT false,
    applied_at TIMESTAMPTZ DEFAULT now()
);

-- Add avatar_version and avatar_updated_at columns to users table if not exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='avatar_version') THEN
        ALTER TABLE users ADD COLUMN avatar_version TEXT DEFAULT '1.0.0';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='avatar_updated_at') THEN
        ALTER TABLE users ADD COLUMN avatar_updated_at TIMESTAMPTZ;
    END IF;
END $$;

-- Seed initial version
INSERT INTO avatar_versions (version, title, changes, upgrade_type, auto_apply)
VALUES ('1.0.0', 'Initial Release', '["Base avatar system","Lip sync animation","Gender-matched TTS","Multi-language support"]'::jsonb, 'major', false)
ON CONFLICT (version) DO NOTHING;

-- Auto-recovery log table
CREATE TABLE IF NOT EXISTS recovery_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    check_time TIMESTAMPTZ DEFAULT now(),
    total_endpoints INTEGER,
    healthy INTEGER,
    failed INTEGER,
    failed_list JSONB DEFAULT '[]'::jsonb,
    recovery_attempted BOOLEAN DEFAULT false,
    recovery_results JSONB DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_avatar_versions_released ON avatar_versions(released_at DESC);
CREATE INDEX IF NOT EXISTS idx_upgrade_log_user ON avatar_upgrade_log(user_id, applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_recovery_log_time ON recovery_log(check_time DESC);
