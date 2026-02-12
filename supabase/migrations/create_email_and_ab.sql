-- Email & A/B Testing Tables
-- Run in Supabase SQL Editor

-- ═══ RECEIVED EMAILS ═══
CREATE TABLE IF NOT EXISTS emails_received (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    from_email TEXT NOT NULL,
    to_email TEXT DEFAULT 'contact@kelionai.app',
    subject TEXT DEFAULT '(no subject)',
    body_text TEXT,
    body_html TEXT,
    source TEXT DEFAULT 'generic',
    message_id TEXT,
    status TEXT DEFAULT 'received',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emails_from ON emails_received(from_email);
CREATE INDEX IF NOT EXISTS idx_emails_created ON emails_received(created_at DESC);

-- ═══ A/B EXPERIMENTS ═══
CREATE TABLE IF NOT EXISTS ab_experiments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT DEFAULT '',
    variants JSONB NOT NULL DEFAULT '["control","variant_a"]',
    weights JSONB NOT NULL DEFAULT '[0.5, 0.5]',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══ A/B VARIANT ASSIGNMENTS ═══
CREATE TABLE IF NOT EXISTS ab_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    experiment_name TEXT NOT NULL,
    user_id TEXT NOT NULL,
    variant TEXT NOT NULL,
    assigned_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(experiment_name, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ab_assign_exp ON ab_assignments(experiment_name);

-- ═══ A/B CONVERSIONS ═══
CREATE TABLE IF NOT EXISTS ab_conversions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    experiment_name TEXT NOT NULL,
    user_id TEXT NOT NULL,
    variant TEXT NOT NULL,
    event_name TEXT DEFAULT 'conversion',
    value NUMERIC DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ab_conv_exp ON ab_conversions(experiment_name);

-- Enable RLS
ALTER TABLE emails_received ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_conversions ENABLE ROW LEVEL SECURITY;

-- Service role full access
DO $$ BEGIN CREATE POLICY "sr_emails" ON emails_received FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "sr_ab_exp" ON ab_experiments FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "sr_ab_assign" ON ab_assignments FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "sr_ab_conv" ON ab_conversions FOR ALL TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
