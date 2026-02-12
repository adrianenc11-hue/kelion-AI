-- Newsletter Subscribers Table for Kelion AI
-- GDPR compliant email marketing collection
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  consent_given BOOLEAN DEFAULT true NOT NULL,
  consent_date TIMESTAMPTZ DEFAULT now() NOT NULL,
  source TEXT DEFAULT 'website',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced')),
  ip_hash TEXT,
  subscribed_at TIMESTAMPTZ DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ,
  reactivated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_status ON newsletter_subscribers(status);

-- Enable Row Level Security
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything (used by Netlify functions)
CREATE POLICY "Service role full access" ON newsletter_subscribers
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Verify
SELECT 'newsletter_subscribers table created successfully' AS result;
