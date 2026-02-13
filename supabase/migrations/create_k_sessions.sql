-- K Sessions — Structured session storage for teaching, work, research
-- Supports multi-session courses with lesson plans

CREATE TABLE IF NOT EXISTS k_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL DEFAULT 'anonymous',
  fingerprint TEXT,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  subject TEXT,
  plan JSONB,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  monitor_html TEXT,
  session_number INTEGER DEFAULT 1,
  total_sessions INTEGER DEFAULT 1,
  duration_ms INTEGER,
  message_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  parent_plan_id UUID REFERENCES k_sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON k_sessions(user_email);
CREATE INDEX IF NOT EXISTS idx_sessions_category ON k_sessions(category);
CREATE INDEX IF NOT EXISTS idx_sessions_subject ON k_sessions(subject);
CREATE INDEX IF NOT EXISTS idx_sessions_parent ON k_sessions(parent_plan_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON k_sessions(status);
