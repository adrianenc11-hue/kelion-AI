-- ═══════════════════════════════════════════════════════════════
-- Kelion AI — API Keys & Developer Access Tables
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- API Keys — stores developer keys (hashed)
CREATE TABLE IF NOT EXISTS api_keys (
    id BIGSERIAL PRIMARY KEY,
    key_hash TEXT UNIQUE NOT NULL,
    key_prefix TEXT NOT NULL,
    key_name TEXT DEFAULT 'My API Key',
    owner_email TEXT NOT NULL,
    credits_remaining INTEGER DEFAULT 0,
    credits_total INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    rate_limit INTEGER DEFAULT 60,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

-- API Key Usage — tracks every API call per key
CREATE TABLE IF NOT EXISTS api_key_usage (
    id BIGSERIAL PRIMARY KEY,
    key_prefix TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    credits_used INTEGER DEFAULT 1,
    cost_usd DECIMAL(12, 8) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_email ON api_keys(owner_email);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_prefix ON api_key_usage(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_created ON api_key_usage(created_at DESC);

-- RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service manages api_keys" ON api_keys
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service manages api_key_usage" ON api_key_usage
    FOR ALL USING (true) WITH CHECK (true);

-- Admin Notifications — real-time alerts for admin
CREATE TABLE IF NOT EXISTS admin_notifications (
    id BIGSERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    admin_email TEXT DEFAULT 'adrianenc11@gmail.com',
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_notifs_created ON admin_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notifs_unread ON admin_notifications(read) WHERE read = false;

ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service manages admin_notifications" ON admin_notifications
    FOR ALL USING (true) WITH CHECK (true);
