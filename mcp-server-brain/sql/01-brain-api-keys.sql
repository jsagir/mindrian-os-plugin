-- Brain API Keys — run in Supabase SQL Editor
-- Creates tables and RPC for API key validation and access request tracking.

-- ============================================================
-- 1. brain_api_keys — stores issued API keys with plan tiers
-- ============================================================
CREATE TABLE IF NOT EXISTS brain_api_keys (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key       uuid        UNIQUE NOT NULL,
  email         text        NOT NULL,
  name          text        NOT NULL DEFAULT '',
  plan          text        NOT NULL DEFAULT 'free'
                            CHECK (plan IN ('free', 'pro', 'admin')),
  is_active     boolean     NOT NULL DEFAULT true,
  expires_at    timestamptz,          -- NULL = permanent (D-03)
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz,
  request_count integer     NOT NULL DEFAULT 0,
  created_by    text        NOT NULL DEFAULT 'jonathan'
);

-- ============================================================
-- 2. validate_brain_key RPC — called by auth.cjs on every request
--    Updates usage stats and returns {plan, email} for valid keys.
--    Returns empty result set for invalid / expired / deactivated keys.
-- ============================================================
CREATE OR REPLACE FUNCTION validate_brain_key(key uuid)
RETURNS TABLE(plan text, email text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Bump usage counters atomically
  UPDATE brain_api_keys b
  SET last_used_at = now(),
      request_count = b.request_count + 1
  WHERE b.api_key = key
    AND b.is_active = true
    AND (b.expires_at IS NULL OR b.expires_at > now());

  -- Return plan + email (empty set if key invalid)
  RETURN QUERY
  SELECT b.plan::text, b.email::text
  FROM brain_api_keys b
  WHERE b.api_key = key
    AND b.is_active = true
    AND (b.expires_at IS NULL OR b.expires_at > now());
END;
$$;

-- ============================================================
-- 3. brain_access_requests — tracks who wants Brain access
-- ============================================================
CREATE TABLE IF NOT EXISTS brain_access_requests (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text        NOT NULL,
  name        text        NOT NULL DEFAULT '',
  message     text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  reviewed    boolean     NOT NULL DEFAULT false
);

-- ============================================================
-- 4. Lawrence seed — permanent admin key (D-03)
-- ============================================================
INSERT INTO brain_api_keys (api_key, email, name, plan, is_active, expires_at)
VALUES (
  '4131ed5b-6001-483e-bb2c-2c4d7a3c8e05',
  'lawrence@mindrian.ai',
  'Lawrence Aronhime',
  'admin',
  true,
  NULL
)
ON CONFLICT (api_key) DO NOTHING;
