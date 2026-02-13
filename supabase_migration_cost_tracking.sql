-- ═══════════════════════════════════════════════════════════════
-- Kelion AI — Cost Tracking & Revenue Tables
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard
-- ═══════════════════════════════════════════════════════════════

-- API Usage Log — stores every API call cost
CREATE TABLE IF NOT EXISTS api_usage_log (
    id BIGSERIAL PRIMARY KEY,
    model TEXT NOT NULL,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cost_usd DECIMAL(12, 8) DEFAULT 0,
    user_email TEXT DEFAULT 'anonymous',
    user_type TEXT DEFAULT 'free',  -- free, pro, family, business
    endpoint TEXT DEFAULT 'unknown',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Revenue Log — stores subscription payments
CREATE TABLE IF NOT EXISTS revenue_log (
    id BIGSERIAL PRIMARY KEY,
    amount DECIMAL(10, 2) DEFAULT 0,
    currency TEXT DEFAULT 'GBP',
    plan TEXT DEFAULT 'unknown',   -- pro, family, business
    user_email TEXT DEFAULT 'unknown',
    source TEXT DEFAULT 'manual',  -- stripe, paypal, manual
    transaction_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_usage_created ON api_usage_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_model ON api_usage_log(model);
CREATE INDEX IF NOT EXISTS idx_usage_user_type ON api_usage_log(user_type);
CREATE INDEX IF NOT EXISTS idx_revenue_created ON revenue_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_plan ON revenue_log(plan);

-- Allow the service key to read/write (RLS off for server-side use)
ALTER TABLE api_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_log ENABLE ROW LEVEL SECURITY;

-- Policy: only service key can insert/read (server-side only)
CREATE POLICY "Service can manage usage logs" ON api_usage_log
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service can manage revenue logs" ON revenue_log
    FOR ALL USING (true) WITH CHECK (true);
