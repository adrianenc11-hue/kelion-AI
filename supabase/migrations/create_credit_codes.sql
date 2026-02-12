-- ═══ CREDIT CODES TABLE ═══
-- Admin generates codes, users redeem them for account time
CREATE TABLE IF NOT EXISTS credit_codes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    validity TEXT NOT NULL CHECK (validity IN ('1w', '1m', '6m', '1y')),
    days INTEGER NOT NULL,
    created_by TEXT NOT NULL DEFAULT 'admin@kelionai.app',
    redeemed_by TEXT,
    redeemed_at TIMESTAMPTZ,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_codes_code ON credit_codes(code);
CREATE INDEX IF NOT EXISTS idx_credit_codes_used ON credit_codes(is_used);

ALTER TABLE credit_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_credit_codes" ON credit_codes FOR ALL USING (true) WITH CHECK (true);
