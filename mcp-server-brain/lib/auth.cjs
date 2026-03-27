'use strict';

/**
 * API key validation middleware for Brain MCP server.
 *
 * Two modes:
 *   1. Supabase mode (SUPABASE_URL + SUPABASE_SERVICE_KEY set): validates against brain_api_keys table
 *   2. Fallback mode (BRAIN_API_KEYS env var): comma-separated keys (original behavior)
 *
 * Supabase mode includes:
 *   - 5-minute key cache (avoids DB hit per request, reduced to 60s for grace/trial keys)
 *   - Full trial lifecycle: active → grace (24h) → expired
 *   - Grace period: X-Brain-Trial-Status header + warning in response
 *   - Usage tracking: total_requests, last_request_at on brain_api_keys
 *   - Request logging: brain_usage_log with key_id, tool_name, timestamp
 *   - Plan info attached to request
 */

const UPGRADE_URL = 'https://mindrianos.vercel.app/brain-access';

const keyCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes for stable keys
const GRACE_CACHE_TTL = 60 * 1000; // 1 minute for grace/trial keys (need fresher data)
const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000; // 24 hours

// ---------------------------------------------------------------------------
// Supabase helpers (using REST API with service role key)
// ---------------------------------------------------------------------------

function supabaseHeaders() {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  return {
    'Content-Type': 'application/json',
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Prefer': 'return=minimal',
  };
}

function supabaseUrl(path) {
  return `${process.env.SUPABASE_URL}/rest/v1/${path}`;
}

/**
 * Lookup key row directly from brain_api_keys table.
 * Returns the full row needed for lifecycle checks.
 */
async function lookupKeyRow(apiKey) {
  const url = supabaseUrl(
    `brain_api_keys?api_key=eq.${encodeURIComponent(apiKey)}&select=id,user_id,email,plan,status,expires_at,grace_ends_at,trial_expired_at,total_requests,last_request_at`
  );

  const response = await fetch(url, {
    method: 'GET',
    headers: supabaseHeaders(),
  });

  if (!response.ok) return null;

  const rows = await response.json();
  if (!rows || rows.length === 0) return null;

  return rows[0];
}

/**
 * Update fields on brain_api_keys by row id.
 */
async function updateKeyRow(id, fields) {
  const url = supabaseUrl(`brain_api_keys?id=eq.${encodeURIComponent(id)}`);
  await fetch(url, {
    method: 'PATCH',
    headers: supabaseHeaders(),
    body: JSON.stringify(fields),
  });
}

/**
 * Insert a row into brain_usage_log.
 */
async function logUsage(keyId, toolName) {
  const url = supabaseUrl('brain_usage_log');
  await fetch(url, {
    method: 'POST',
    headers: supabaseHeaders(),
    body: JSON.stringify({
      key_id: keyId,
      tool_name: toolName || 'unknown',
    }),
  });
}

// ---------------------------------------------------------------------------
// Trial lifecycle validation
// ---------------------------------------------------------------------------

/**
 * Validate key via Supabase with full trial lifecycle logic.
 *
 * Returns:
 *   { valid: true, plan, email, status, graceWarning?, hoursRemaining? }
 *   or { valid: false, status: number, body: object }
 *   or null (key not found)
 */
async function validateViaSupabase(key) {
  // Check cache first
  const cached = keyCache.get(key);
  if (cached && (Date.now() - cached.time) < cached.ttl) {
    return cached.result;
  }

  const keyRow = await lookupKeyRow(key);
  if (!keyRow) {
    keyCache.set(key, { time: Date.now(), ttl: CACHE_TTL, result: null });
    return null;
  }

  const now = new Date();

  // --- Revoked keys: hard block ---
  if (keyRow.status === 'revoked') {
    const result = {
      valid: false,
      status: 403,
      body: { error: 'Key revoked.', help: UPGRADE_URL },
    };
    keyCache.set(key, { time: Date.now(), ttl: CACHE_TTL, result });
    return result;
  }

  // --- Expired keys: hard block ---
  if (keyRow.status === 'expired') {
    const result = {
      valid: false,
      status: 403,
      body: {
        error: `Trial expired. Upgrade at ${UPGRADE_URL}`,
        upgrade_url: UPGRADE_URL,
      },
    };
    keyCache.set(key, { time: Date.now(), ttl: CACHE_TTL, result });
    return result;
  }

  // --- Active key past expiry: transition to grace ---
  if (keyRow.status === 'active' && keyRow.expires_at) {
    const expiresAt = new Date(keyRow.expires_at);
    if (now >= expiresAt) {
      // Trial just expired — start 24h grace period
      const graceEnd = new Date(now.getTime() + GRACE_PERIOD_MS);

      await updateKeyRow(keyRow.id, {
        status: 'grace',
        grace_ends_at: graceEnd.toISOString(),
        trial_expired_at: now.toISOString(),
      });

      // Update local row state for the rest of this check
      keyRow.status = 'grace';
      keyRow.grace_ends_at = graceEnd.toISOString();
      keyRow.trial_expired_at = now.toISOString();
    }
  }

  // --- Grace period: check if still within window ---
  if (keyRow.status === 'grace') {
    const graceEnd = new Date(keyRow.grace_ends_at);
    if (now >= graceEnd) {
      // Grace period over — expire the key
      await updateKeyRow(keyRow.id, { status: 'expired' });

      const result = {
        valid: false,
        status: 403,
        body: {
          error: `Trial expired. Upgrade at ${UPGRADE_URL}`,
          upgrade_url: UPGRADE_URL,
        },
      };
      keyCache.set(key, { time: Date.now(), ttl: CACHE_TTL, result });
      return result;
    }

    // Still in grace — allow with warning
    const hoursRemaining = Math.max(0, Math.round((graceEnd - now) / (1000 * 60 * 60)));
    const result = {
      valid: true,
      plan: keyRow.plan,
      email: keyRow.email,
      keyId: keyRow.id,
      status: 'grace',
      totalRequests: keyRow.total_requests || 0,
      graceWarning: `Your 30-day trial has ended. Grace period: ${hoursRemaining}h remaining.`,
      hoursRemaining,
    };
    // Use shorter cache TTL for grace keys (need to detect expiry promptly)
    keyCache.set(key, { time: Date.now(), ttl: GRACE_CACHE_TTL, result });
    return result;
  }

  // --- Active key within trial or paid tier: allow ---
  const result = {
    valid: true,
    plan: keyRow.plan,
    email: keyRow.email,
    keyId: keyRow.id,
    status: keyRow.status,
    totalRequests: keyRow.total_requests || 0,
  };

  // Use shorter cache for trial keys approaching expiry
  const ttl = (keyRow.plan === 'trial' && keyRow.expires_at)
    ? GRACE_CACHE_TTL
    : CACHE_TTL;

  keyCache.set(key, { time: Date.now(), ttl, result });
  return result;
}

/**
 * Validate key against BRAIN_API_KEYS env var (fallback).
 */
function validateViaEnvVar(key) {
  const validKeys = (process.env.BRAIN_API_KEYS || '').split(',').filter(Boolean);
  if (validKeys.includes(key)) {
    return { valid: true, plan: 'env', email: 'unknown', status: 'active' };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Extract tool name from MCP request body
// ---------------------------------------------------------------------------

/**
 * Extract the tool name from an MCP JSON-RPC request body.
 * MCP tool calls use method "tools/call" with params.name.
 */
function extractToolName(body) {
  if (!body) return 'unknown';
  // MCP protocol: { method: "tools/call", params: { name: "enrich_context", ... } }
  if (body.method === 'tools/call' && body.params && body.params.name) {
    return body.params.name;
  }
  // Fallback: use the method name itself
  return body.method || 'unknown';
}

// ---------------------------------------------------------------------------
// Express middleware
// ---------------------------------------------------------------------------

/**
 * Express middleware — validates API key with full trial lifecycle.
 *
 * Sets on request:
 *   req.brainPlan    — plan name ('trial', 'pro', 'env', etc.)
 *   req.brainEmail   — user email
 *   req.brainKeyId   — key UUID (for usage logging)
 *   req.brainStatus  — key status ('active', 'grace')
 *
 * Sets on response (for grace period):
 *   X-Brain-Trial-Status header
 *   _brain_warning field appended to response body (via res.locals)
 */
async function validateApiKey(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Missing API key. Set Authorization: Bearer <your-key>',
      help: `Request access at ${UPGRADE_URL}`,
    });
  }

  const key = authHeader.slice(7);

  try {
    let result = null;

    // Try Supabase first (if configured)
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
      result = await validateViaSupabase(key);
    }

    // Handle explicit rejection (revoked/expired)
    if (result && result.valid === false) {
      return res.status(result.status).json(result.body);
    }

    // Fallback to env var if Supabase returned nothing
    if (!result) {
      result = validateViaEnvVar(key);
    }

    if (!result) {
      return res.status(401).json({
        error: 'Invalid Brain API key.',
        help: `Request access at ${UPGRADE_URL}`,
      });
    }

    // Attach auth info to request for downstream use
    req.brainPlan = result.plan;
    req.brainEmail = result.email;
    req.brainKeyId = result.keyId;
    req.brainStatus = result.status;

    // Grace period: set response header and store warning for response body
    if (result.status === 'grace') {
      res.set('X-Brain-Trial-Status', 'grace');
      res.set('X-Brain-Grace-Hours-Remaining', String(result.hoursRemaining));
      res.locals.brainWarning = result.graceWarning;
    }

    // Track usage asynchronously (don't block request)
    if (result.keyId && process.env.SUPABASE_URL) {
      const toolName = extractToolName(req.body);
      const totalRequests = (result.totalRequests || 0) + 1;

      // Fire-and-forget: update key stats + log usage
      Promise.all([
        updateKeyRow(result.keyId, {
          total_requests: totalRequests,
          last_request_at: new Date().toISOString(),
        }),
        logUsage(result.keyId, toolName),
      ]).catch((err) => {
        // Usage tracking failure should never block the request
        console.error('[brain-auth] Usage tracking error:', err.message);
      });
    }

    next();
  } catch (err) {
    // If Supabase is down, fall back to env var
    const result = validateViaEnvVar(key);
    if (result) {
      req.brainPlan = result.plan;
      return next();
    }
    return res.status(500).json({
      error: 'Auth service unavailable. Try again shortly.',
    });
  }
}

module.exports = { validateApiKey };
