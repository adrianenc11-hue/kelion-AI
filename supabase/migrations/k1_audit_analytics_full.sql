-- k1_audit_analytics_full.sql
-- ONE FILE. Safe-by-default + anti-spam + admin-only reads + guarded ai_trace fix.
--
-- DEFAULT BEHAVIOR:
-- - Client logs events via RPC functions (recommended).
-- - Direct INSERT from client can be blocked (enabled below).
-- - SELECT is admin-only (prevents leaking IP/UA/details).
-- - Backend with service_role bypasses RLS anyway.

BEGIN;

-- =========================================================
-- 0) Admin helper
-- =========================================================
-- Requires JWT claim: app_metadata.role = "admin"
-- In Supabase you usually set this from backend/admin tooling.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

-- =========================================================
-- 1) Tables: audit_log + page_views
-- =========================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  action text NOT NULL,
  resource text,
  user_id text,
  details jsonb DEFAULT '{}'::jsonb,
  ip text DEFAULT 'unknown',
  user_agent text DEFAULT '',
  success boolean DEFAULT true,
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action  ON public.audit_log (action);

CREATE TABLE IF NOT EXISTS public.page_views (
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

CREATE INDEX IF NOT EXISTS idx_page_views_created ON public.page_views (created_at DESC);

-- =========================================================
-- 2) Anti-spam / Rate limiting table
-- =========================================================
-- Stores counters per minute (bucket) per IP + event key.
-- Used ONLY by SECURITY DEFINER functions (RPC).
CREATE TABLE IF NOT EXISTS public.event_rate_limit (
  bucket_minute timestamptz NOT NULL,     -- date_trunc('minute', now())
  ip text NOT NULL,
  key text NOT NULL,                      -- e.g. "audit:login" or "pv:/app"
  cnt integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket_minute, ip, key)
);

CREATE INDEX IF NOT EXISTS idx_event_rate_limit_created ON public.event_rate_limit (created_at DESC);

-- =========================================================
-- 3) Enable RLS
-- =========================================================
ALTER TABLE public.audit_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_views       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rate_limit ENABLE ROW LEVEL SECURITY;

-- Drop policies if re-running safely
DROP POLICY IF EXISTS audit_log_select_admin  ON public.audit_log;
DROP POLICY IF EXISTS audit_log_insert_direct ON public.audit_log;

DROP POLICY IF EXISTS page_views_select_admin  ON public.page_views;
DROP POLICY IF EXISTS page_views_insert_direct ON public.page_views;

DROP POLICY IF EXISTS event_rate_limit_admin_only ON public.event_rate_limit;

-- =========================================================
-- 4) Policies (SAFE)
-- =========================================================
-- READ: admin only
CREATE POLICY audit_log_select_admin
ON public.audit_log
FOR SELECT
USING (public.is_admin());

CREATE POLICY page_views_select_admin
ON public.page_views
FOR SELECT
USING (public.is_admin());

-- For event_rate_limit: nobody reads/writes directly from client; only admin can read it.
CREATE POLICY event_rate_limit_admin_only
ON public.event_rate_limit
FOR SELECT
USING (public.is_admin());

-- IMPORTANT:
-- We DO NOT create UPDATE/DELETE policies => client cannot update/delete.
-- For INSERT we will rely on RPC functions below. (Direct inserts will be blocked by default.)
--
-- If you still want to allow direct INSERT from client (NOT recommended), uncomment:
-- CREATE POLICY audit_log_insert_direct ON public.audit_log FOR INSERT WITH CHECK (true);
-- CREATE POLICY page_views_insert_direct ON public.page_views FOR INSERT WITH CHECK (true);

-- =========================================================
-- 5) RPC: rate limiter function
-- =========================================================
-- Returns TRUE if allowed, FALSE if rate limit exceeded.
CREATE OR REPLACE FUNCTION public.rate_limit_hit(
  p_ip text,
  p_key text,
  p_limit_per_minute integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bucket timestamptz := date_trunc('minute', now());
  v_new_cnt integer;
BEGIN
  IF p_ip IS NULL OR length(p_ip) = 0 THEN
    p_ip := 'unknown';
  END IF;

  IF p_key IS NULL OR length(p_key) = 0 THEN
    p_key := 'unknown';
  END IF;

  INSERT INTO public.event_rate_limit(bucket_minute, ip, key, cnt)
  VALUES (v_bucket, p_ip, p_key, 1)
  ON CONFLICT (bucket_minute, ip, key)
  DO UPDATE SET cnt = public.event_rate_limit.cnt + 1
  RETURNING cnt INTO v_new_cnt;

  RETURN (v_new_cnt <= p_limit_per_minute);
END;
$$;

-- Optional: lock down execution (recommended)
REVOKE ALL ON FUNCTION public.rate_limit_hit(text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(text, text, integer) TO service_role;

-- =========================================================
-- 6) RPC: audit logger (recommended way to write audit_log)
-- =========================================================
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action text,
  p_resource text DEFAULT NULL,
  p_details jsonb DEFAULT '{}'::jsonb,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_success boolean DEFAULT true,
  p_error_message text DEFAULT NULL,
  p_limit_per_minute integer DEFAULT 60
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed boolean;
  v_id bigint;
  v_user_id text;
  v_key text;
BEGIN
  IF p_action IS NULL OR length(trim(p_action)) = 0 THEN
    RAISE EXCEPTION 'p_action is required';
  END IF;

  v_user_id := COALESCE(auth.uid()::text, NULL);
  v_key := 'audit:' || left(p_action, 80);

  v_allowed := public.rate_limit_hit(COALESCE(p_ip, 'unknown'), v_key, p_limit_per_minute);
  IF NOT v_allowed THEN
    -- silently refuse or raise; choose one. Here: refuse clearly.
    RAISE EXCEPTION 'rate limit exceeded for %', v_key;
  END IF;

  INSERT INTO public.audit_log(action, resource, user_id, details, ip, user_agent, success, error_message)
  VALUES (
    p_action,
    p_resource,
    v_user_id,
    COALESCE(p_details, '{}'::jsonb),
    COALESCE(p_ip, 'unknown'),
    COALESCE(p_user_agent, ''),
    COALESCE(p_success, true),
    p_error_message
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Allow app roles to call it (choose what you want):
REVOKE ALL ON FUNCTION public.log_audit_event(text, text, jsonb, text, text, boolean, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, jsonb, text, text, boolean, text, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, jsonb, text, text, boolean, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, jsonb, text, text, boolean, text, integer) TO service_role;

-- =========================================================
-- 7) RPC: page view logger (recommended way to write page_views)
-- =========================================================
CREATE OR REPLACE FUNCTION public.log_page_view(
  p_page text,
  p_visitor_id text DEFAULT NULL,
  p_session_id text DEFAULT NULL,
  p_referrer text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_ip text DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_device text DEFAULT NULL,
  p_browser text DEFAULT NULL,
  p_limit_per_minute integer DEFAULT 120
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed boolean;
  v_id bigint;
  v_key text;
BEGIN
  IF p_page IS NULL OR length(trim(p_page)) = 0 THEN
    RAISE EXCEPTION 'p_page is required';
  END IF;

  v_key := 'pv:' || left(p_page, 100);

  v_allowed := public.rate_limit_hit(COALESCE(p_ip, 'unknown'), v_key, p_limit_per_minute);
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'rate limit exceeded for %', v_key;
  END IF;

  INSERT INTO public.page_views(page, visitor_id, session_id, referrer, user_agent, ip, country, device, browser)
  VALUES (
    p_page,
    p_visitor_id,
    p_session_id,
    p_referrer,
    p_user_agent,
    p_ip,
    p_country,
    p_device,
    p_browser
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_page_view(text, text, text, text, text, text, text, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_page_view(text, text, text, text, text, text, text, text, text, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.log_page_view(text, text, text, text, text, text, text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_page_view(text, text, text, text, text, text, text, text, text, integer) TO service_role;

-- =========================================================
-- 8) OPTIONAL: Block direct inserts from client (recommended)
-- =========================================================
-- If you expose tables via Supabase API, this prevents clients from inserting directly,
-- forcing them to go through the RPC functions (rate-limited).
REVOKE INSERT, UPDATE, DELETE ON public.audit_log FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.page_views FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.event_rate_limit FROM anon, authenticated;

-- Admin read rights (optional; service_role reads anyway)
GRANT SELECT ON public.audit_log  TO authenticated;
GRANT SELECT ON public.page_views TO authenticated;
-- NOTE: RLS still applies; only admins will actually see rows.

-- =========================================================
-- 9) Guarded ai_trace direction CHECK fix (won't fail if table missing)
-- =========================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_trace'
  ) THEN
    EXECUTE 'ALTER TABLE public.ai_trace DROP CONSTRAINT IF EXISTS ai_trace_direction_check';
    EXECUTE $$ALTER TABLE public.ai_trace
             ADD CONSTRAINT ai_trace_direction_check
             CHECK (direction IN ('enter','exit','call','in','out','result','error'))$$;
  END IF;
END$$;

COMMIT;

-- =========================================================
-- QUICK NOTES:
-- - If you want "only authenticated can log", change GRANT EXECUTE:
--     remove anon grants for log_* functions
-- - If you want different rate limits:
--     adjust defaults p_limit_per_minute in log_audit_event/log_page_view
-- - If you want users to read their own logs: add another SELECT policy:
--     USING (public.is_admin() OR user_id = auth.uid()::text)
--   (and ensure user_id is always auth.uid() on insert)
