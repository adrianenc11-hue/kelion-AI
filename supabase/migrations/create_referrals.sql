-- ═══ REFERRALS TABLE ═══
CREATE TABLE IF NOT EXISTS referrals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    referrer_email TEXT NOT NULL,
    referral_code TEXT NOT NULL UNIQUE,
    uses INTEGER DEFAULT 0,
    reward_months INTEGER DEFAULT 0,
    last_used TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_email ON referrals(referrer_email);

-- ═══ REFERRAL EVENTS TABLE ═══
CREATE TABLE IF NOT EXISTS referral_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    referral_code TEXT NOT NULL,
    referrer_email TEXT NOT NULL,
    referred_email TEXT NOT NULL,
    reward_type TEXT DEFAULT 'free_month',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_events_code ON referral_events(referral_code);

-- RLS
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_events ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY IF NOT EXISTS "service_referrals" ON referrals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "service_referral_events" ON referral_events FOR ALL USING (true) WITH CHECK (true);
