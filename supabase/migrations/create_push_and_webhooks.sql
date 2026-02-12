-- Push Notifications & Webhook Monitor Tables
-- Run: supabase db push (or paste in Supabase SQL Editor)

-- ═══ PUSH SUBSCRIPTIONS ═══
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    endpoint TEXT UNIQUE NOT NULL,
    subscription_data JSONB NOT NULL,
    user_email TEXT DEFAULT 'anonymous',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_used TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_push_subs_active ON push_subscriptions(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_push_subs_email ON push_subscriptions(user_email);

-- ═══ WEBHOOK LOGS ═══
CREATE TABLE IF NOT EXISTS webhook_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    source TEXT NOT NULL,
    event_type TEXT DEFAULT 'unknown',
    direction TEXT DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound')),
    status TEXT DEFAULT 'received',
    payload_preview TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_source ON webhook_logs(source);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created ON webhook_logs(created_at DESC);

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "service_role_push" ON push_subscriptions FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_webhooks" ON webhook_logs FOR ALL TO service_role USING (true);

-- Auto-cleanup old webhook logs (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_webhook_logs() RETURNS void AS $$
BEGIN
    DELETE FROM webhook_logs WHERE created_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql;
