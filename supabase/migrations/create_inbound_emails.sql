-- ═══ INBOUND EMAILS — For admin monitoring of contact@kelionai.app ═══
-- Stores emails received via email-webhook function

CREATE TABLE IF NOT EXISTS inbound_emails (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    from_email TEXT NOT NULL,
    from_name TEXT,
    to_email TEXT DEFAULT 'contact@kelionai.app',
    subject TEXT NOT NULL DEFAULT '(no subject)',
    body_text TEXT,
    body_html TEXT,
    received_at TIMESTAMPTZ DEFAULT NOW(),
    attachments_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'archived')),
    notes TEXT,
    raw_payload TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_inbound_emails_status ON inbound_emails(status);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_received ON inbound_emails(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_from ON inbound_emails(from_email);

-- RLS (admin only)
ALTER TABLE inbound_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on inbound_emails"
    ON inbound_emails FOR ALL
    USING (true)
    WITH CHECK (true);
