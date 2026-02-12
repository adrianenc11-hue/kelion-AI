-- ═══ AUDIT LOG + PAGE VIEWS + AI TRACE FIX ═══
-- Run in Supabase SQL Editor

-- 1. Audit Log table (missing — causes 500 on audit-log endpoint)
CREATE TABLE IF NOT EXISTS audit_log (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    action text NOT NULL,
    resource text,
    user_id text,
    details jsonb DEFAULT '{}',
    ip text DEFAULT 'unknown',
    user_agent text DEFAULT '',
    success boolean DEFAULT true,
    error_message text,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow insert from backend" ON audit_log
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow read from backend" ON audit_log
    FOR SELECT USING (true);

-- 2. Page Views table (missing — causes analytics-dashboard to fail)
CREATE TABLE IF NOT EXISTS page_views (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    page text NOT NULL,
    visitor_id text,
    session_id text,
    referrer text,
    user_agent text,
    ip text,
    country text,
    device text,
    browser text,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_page ON page_views(page);

ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow insert from backend" ON page_views
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow read from backend" ON page_views
    FOR SELECT USING (true);

-- 3. Fix ai_trace direction constraint — allow more values
-- Drop the old constraint and add expanded one
ALTER TABLE ai_trace DROP CONSTRAINT IF EXISTS ai_trace_direction_check;
ALTER TABLE ai_trace ADD CONSTRAINT ai_trace_direction_check
    CHECK (direction IN ('enter', 'exit', 'call', 'in', 'out', 'result', 'error'));

-- Auto-cleanup old audit logs (keep 90 days)
-- DELETE FROM audit_log WHERE created_at < now() - interval '90 days';
