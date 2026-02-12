-- AI Trace Events Table
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard → SQL Editor
CREATE TABLE IF NOT EXISTS ai_trace (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id text DEFAULT 'unknown',
    node text NOT NULL,
    direction text DEFAULT 'enter' CHECK (direction IN ('enter', 'exit', 'call')),
    label text DEFAULT '',
    trace_type text DEFAULT 'text' CHECK (trace_type IN ('text', 'voice', 'gemini')),
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);

-- Index for fast polling (last 30 seconds)
CREATE INDEX IF NOT EXISTS idx_ai_trace_created ON ai_trace(created_at DESC);

-- Enable RLS
ALTER TABLE ai_trace ENABLE ROW LEVEL SECURITY;

-- Allow inserts from service key (backend functions)
CREATE POLICY "Allow insert from backend" ON ai_trace
    FOR INSERT WITH CHECK (true);

-- Allow reads from service key (brain-map polling)
CREATE POLICY "Allow read for monitoring" ON ai_trace
    FOR SELECT USING (true);

-- Auto-cleanup: delete events older than 5 minutes (keeps table small)
-- Run periodically or via Supabase scheduled function
-- DELETE FROM ai_trace WHERE created_at < now() - interval '5 minutes';
