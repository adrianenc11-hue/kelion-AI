-- K AGENT SUPABASE SCHEMA
-- Execute this in your Supabase SQL Editor

-- 1. FILES TABLE
CREATE TABLE IF NOT EXISTS k_files (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    filepath TEXT NOT NULL,
    content TEXT,
    file_type TEXT DEFAULT 'text',
    size_bytes INTEGER,
    version INTEGER DEFAULT 1,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, filepath, version)
);

-- 2. TASKS TABLE
CREATE TABLE IF NOT EXISTS k_tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    task_request TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    iterations INTEGER DEFAULT 0,
    tools_used JSONB,
    result JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 3. EXECUTIONS TABLE
CREATE TABLE IF NOT EXISTS k_executions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    language TEXT NOT NULL,
    code TEXT NOT NULL,
    stdout TEXT,
    stderr TEXT,
    exit_code INTEGER,
    execution_time INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. MEMORY TABLE
CREATE TABLE IF NOT EXISTS k_memory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    memory_key TEXT,
    memory_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. SESSIONS TABLE
CREATE TABLE IF NOT EXISTS k_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_end TIMESTAMP WITH TIME ZONE,
    interactions INTEGER DEFAULT 0,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_k_files_user ON k_files(user_id);
CREATE INDEX IF NOT EXISTS idx_k_files_path ON k_files(filepath);
CREATE INDEX IF NOT EXISTS idx_k_tasks_user ON k_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_k_executions_user ON k_executions(user_id);

-- RLS POLICIES (Row Level Security)
ALTER TABLE k_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE k_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE k_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE k_memory ENABLE ROW LEVEL SECURITY;

-- Allow users to access only their own data
CREATE POLICY "Users can manage their files" ON k_files
    FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can manage their tasks" ON k_tasks
    FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can view their executions" ON k_executions
    FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can manage their memory" ON k_memory
    FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- STORAGE BUCKET (run separately in Supabase Storage UI or via API)
-- Name: k-workspace
-- Public: false
-- File size limit: 50MB
-- Allowed mime types: text/*, application/json, application/javascript, text/html
