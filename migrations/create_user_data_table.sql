-- ============================================
-- Kelion AI: Extensible User Data Table
-- Run this in Supabase SQL Editor
-- ============================================

-- Create user_data table for storing any user-specific data
CREATE TABLE IF NOT EXISTS user_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data_key VARCHAR(100) NOT NULL,
    data_value JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, data_key)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_data_user ON user_data(user_id);
CREATE INDEX IF NOT EXISTS idx_user_data_key ON user_data(data_key);

-- Enable Row Level Security
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own data
CREATE POLICY "Users can access own data" ON user_data
    FOR ALL USING (auth.uid() = user_id);

-- Grant access
GRANT ALL ON user_data TO authenticated;
GRANT ALL ON user_data TO service_role;

-- Done!
SELECT 'user_data table created successfully!' as status;
