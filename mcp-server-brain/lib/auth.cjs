'use strict';

/**
 * API key validation middleware for Brain MCP server.
 *
 * Two modes:
 *   1. Supabase mode (SUPABASE_URL + SUPABASE_SERVICE_KEY set): validates against brain_api_keys table
 *   2. Fallback mode (BRAIN_API_KEYS env var): comma-separated keys (original behavior)
 *
 * Supabase mode includes:
 *   - 5-minute key cache (avoids DB hit per request)
 *   - Automatic usage tracking (last_used_at, request_count)
 *   - Expiry checking
 *   - Plan info attached to request
 */

const keyCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Validate key against Supabase brain_api_keys table.
 * Uses the validate_brain_key() function which also updates usage stats.
 */
async function validateViaSupabase(key) {
  // Check cache first
  const cached = keyCache.get(key);
  if (cached && (Date.now() - cached.time) < CACHE_TTL) {
    return cached.result;
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  const response = await fetch(`${url}/rest/v1/rpc/validate_brain_key`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ key }),
  });

  if (!response.ok) {
    return null;
  }

  const rows = await response.json();
  if (!rows || rows.length === 0) {
    keyCache.set(key, { time: Date.now(), result: null });
    return null;
  }

  const result = { valid: true, plan: rows[0].plan, email: rows[0].email };
  keyCache.set(key, { time: Date.now(), result });
  return result;
}

/**
 * Validate key against BRAIN_API_KEYS env var (fallback).
 */
function validateViaEnvVar(key) {
  const validKeys = (process.env.BRAIN_API_KEYS || '').split(',').filter(Boolean);
  if (validKeys.includes(key)) {
    return { valid: true, plan: 'env', email: 'unknown' };
  }
  return null;
}

/**
 * Express middleware — validates API key via Supabase or env var fallback.
 */
async function validateApiKey(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Missing API key. Set Authorization: Bearer <your-key>',
      help: 'Request access at https://mindrianos-jsagirs-projects.vercel.app/brain-access'
    });
  }

  const key = authHeader.slice(7);

  try {
    let result = null;

    // Try Supabase first (if configured)
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
      result = await validateViaSupabase(key);
    }

    // Fallback to env var
    if (!result) {
      result = validateViaEnvVar(key);
    }

    if (!result) {
      return res.status(401).json({
        error: 'Invalid Brain API key.',
        help: 'Request access at https://mindrianos-jsagirs-projects.vercel.app/brain-access'
      });
    }

    // Attach plan info to request for downstream use
    req.brainPlan = result.plan;
    req.brainEmail = result.email;
    next();
  } catch (err) {
    // If Supabase is down, fall back to env var
    const result = validateViaEnvVar(key);
    if (result) {
      req.brainPlan = result.plan;
      return next();
    }
    return res.status(500).json({
      error: 'Auth service unavailable. Try again shortly.'
    });
  }
}

module.exports = { validateApiKey };
