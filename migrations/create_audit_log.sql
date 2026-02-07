-- ============================================
-- Kelion AI: Audit Log Table
-- Logs ALL system actions for monitoring
-- ============================================

CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(50) NOT NULL,
    resource VARCHAR(100),
    user_id UUID REFERENCES users(id),
    details JSONB,
    ip VARCHAR(50),
    user_agent TEXT,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

GRANT ALL ON audit_log TO service_role;

SELECT 'audit_log table created!' as status;
