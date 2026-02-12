-- ═══ FIX #1: page_views — Add missing columns ═══
-- page-tracking.js inserts these but they don't exist in the table
-- Error: "Could not find the 'action' column of 'page_views' in the schema cache"

ALTER TABLE page_views ADD COLUMN IF NOT EXISTS action text;
ALTER TABLE page_views ADD COLUMN IF NOT EXISTS user_id text;
ALTER TABLE page_views ADD COLUMN IF NOT EXISTS duration_ms integer;
ALTER TABLE page_views ADD COLUMN IF NOT EXISTS scroll_depth integer;
ALTER TABLE page_views ADD COLUMN IF NOT EXISTS metadata jsonb;
ALTER TABLE page_views ADD COLUMN IF NOT EXISTS ip_address text;

-- Index on action for analytics queries
CREATE INDEX IF NOT EXISTS idx_page_views_action ON page_views(action);
