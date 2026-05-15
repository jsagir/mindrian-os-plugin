/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 118-04 Plan 04 Task 1 -- resolve-vercel-key.
 *
 * The ONE resolver for "where is the Vercel deploy token on this machine?".
 * Mirrors lib/core/resolve-brain-key.cjs (Phase 95.6 / Phase 123 Plan-07).
 *
 * Precedence per LD2 (Locked Decision 2 in 118-CONTEXT.md):
 *   1. process.env.VERCEL_TOKEN      -- explicit operator intent, highest.
 *   2. <home>/.mindrian.env          -- global backup, persists across CWDs.
 *   3. <cwd>/.env                    -- project-local override.
 *   4. null                          -- triggers local-file fallback path.
 *
 * Quote-stripping: handles both `VERCEL_TOKEN="abc"` (double-quoted) and
 * `VERCEL_TOKEN=abc` (raw) per feedback_gmail_qp_env_var_corruption.md.
 *
 * Returns:
 *   resolveVercelKey({home?, cwd?}) -> string | null
 *
 * Constants:
 *   VERCEL_PROJECT_NAME = 'mindrianos-briefs'
 *
 * Canon Part 8: this module reads LOCAL files and env only. Zero network
 * surface. The Vercel API call is mva-vercel-deploy.cjs's job; this module
 * only DISCOVERS whether a token exists.
 *
 * No transitive runtime dependencies; node built-ins only.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

/** @type {string} The project name on Vercel where deck deploys live. */
const VERCEL_PROJECT_NAME = 'mindrianos-briefs';

/**
 * Parse a single VERCEL_TOKEN=... line out of a (possibly multi-line) env-file
 * body. Returns the trimmed value with surrounding double-quotes stripped, or
 * null if the line is absent or the value is empty.
 *
 * @param {string} body
 * @returns {string|null}
 */
function _parseKey(body) {
  const m = body.match(/^VERCEL_TOKEN\s*=\s*(.+?)\s*$/m);
  if (!m) return null;
  let v = m[1].trim();
  // Strip surrounding double-quotes if present
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
    v = v.slice(1, -1);
  }
  return v.length > 0 ? v : null;
}

/**
 * Resolve the Vercel deploy token from the standard precedence chain.
 *
 * The `home` and `cwd` parameters exist as test seams (mirrors
 * resolve-brain-key.cjs pattern). Env-aware home resolution so hermetic tests
 * overriding process.env.HOME work on Linux/POSIX, where os.homedir() reads
 * /etc/passwd and ignores the env override.
 *
 * @param {{home?: string, cwd?: string}} [opts]
 * @returns {string|null}
 */
function resolveVercelKey(opts) {
  const o = opts || {};
  const home = o.home || process.env.HOME || process.env.USERPROFILE || os.homedir();
  const cwd = o.cwd || process.cwd();

  // (1) Env var wins.
  if (process.env.VERCEL_TOKEN) {
    const v = String(process.env.VERCEL_TOKEN).trim();
    if (v.length > 0) return v;
  }

  // (2) <home>/.mindrian.env
  const mindrianEnvPath = path.join(home, '.mindrian.env');
  if (fs.existsSync(mindrianEnvPath)) {
    try {
      const body = fs.readFileSync(mindrianEnvPath, 'utf8');
      const v = _parseKey(body);
      if (v) return v;
    } catch (_e) { /* fall through */ }
  }

  // (3) <cwd>/.env
  const cwdEnvPath = path.join(cwd, '.env');
  if (fs.existsSync(cwdEnvPath)) {
    try {
      const body = fs.readFileSync(cwdEnvPath, 'utf8');
      const v = _parseKey(body);
      if (v) return v;
    } catch (_e) { /* fall through */ }
  }

  // (4) not-found
  return null;
}

module.exports = {
  resolveVercelKey,
  VERCEL_PROJECT_NAME,
};
