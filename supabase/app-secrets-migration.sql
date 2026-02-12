-- ═══ APP SECRETS VAULT ═══
-- Stores API keys and secrets in Supabase instead of Netlify env vars
-- Solves AWS Lambda 4KB env var limit permanently

CREATE TABLE IF NOT EXISTS app_secrets (
    key_name TEXT PRIMARY KEY,
    key_value TEXT NOT NULL,
    category TEXT DEFAULT 'api_key',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only service_role can access secrets (not anon key)
ALTER TABLE app_secrets ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if any (idempotent)
DROP POLICY IF EXISTS "service_role_only" ON app_secrets;

CREATE POLICY "service_role_only" ON app_secrets
    FOR ALL
    USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- Index for fast category lookups
CREATE INDEX IF NOT EXISTS idx_app_secrets_category ON app_secrets(category);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_app_secrets_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_app_secrets_updated ON app_secrets;
CREATE TRIGGER trigger_app_secrets_updated
    BEFORE UPDATE ON app_secrets
    FOR EACH ROW
    EXECUTE FUNCTION update_app_secrets_timestamp();
