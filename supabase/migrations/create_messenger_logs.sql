-- ═══ MESSENGER LOGS + USERS — Tables for K Pension Bot ═══
-- Stores conversations from Facebook, Instagram, TikTok

-- Messenger logs (all conversations)
CREATE TABLE IF NOT EXISTS messenger_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'messenger',
    user_message TEXT,
    bot_response TEXT,
    topic TEXT DEFAULT 'general',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messenger_logs_sender ON messenger_logs(sender_id);
CREATE INDEX IF NOT EXISTS idx_messenger_logs_platform ON messenger_logs(platform);
CREATE INDEX IF NOT EXISTS idx_messenger_logs_topic ON messenger_logs(topic);
CREATE INDEX IF NOT EXISTS idx_messenger_logs_created ON messenger_logs(created_at DESC);

-- Messenger users (country preferences)
CREATE TABLE IF NOT EXISTS messenger_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id TEXT UNIQUE NOT NULL,
    country TEXT DEFAULT 'ro',
    platform TEXT DEFAULT 'messenger',
    first_contact TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messenger_users_sender ON messenger_users(sender_id);

-- RLS policies
ALTER TABLE messenger_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE messenger_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access logs" ON messenger_logs
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access users" ON messenger_users
    FOR ALL USING (auth.role() = 'service_role');
