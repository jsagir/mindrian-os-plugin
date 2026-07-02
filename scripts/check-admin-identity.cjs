#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick(admin-gate-hardening) -- the deterministic admin-identity checker.
 * ======================================================================
 * The admin-gated commands (visibility: admin -- commands/admin.md,
 * commands/dogfood-flush.md) were protected ONLY by prose asking Larry (the
 * LLM) to re-derive identity every manual invocation. This module is the
 * CODE backstop: a pure, LOCAL, network-free function that answers one
 * question deterministically -- is the current user an admin?
 *
 * Admin if ANY of these hold:
 *   1. env MOS_ADMIN=true (case-insensitive 'true')
 *   2. $USER or $USERNAME contains 'jsagi' or 'jonathan' (case-insensitive)
 *   3. $HOME === '/home/jsagi'
 *
 * PLUS an optional, extensible allowlist read from
 * ~/.mindrian/admin-identity.json (override path via
 * MINDRIAN_ADMIN_IDENTITY_PATH). The allowlist EXTENDS the hardcoded
 * conditions -- it never replaces them -- so future admins / deployments gain
 * access without a code change. When the file is absent, the three hardcoded
 * conditions are the whole gate.
 *
 * Allowlist schema (every field optional):
 *   {
 *     "usernames": ["alice", "bob"],   // substring match against $USER/$USERNAME
 *     "homes": ["/home/alice"],        // exact match against $HOME
 *     "env_flags": ["ALICE_ADMIN"]     // extra env vars that grant admin when 'true'
 *   }
 *
 * CLI:
 *   node scripts/check-admin-identity.cjs           -> exit 0 admin, exit 1 not
 *   node scripts/check-admin-identity.cjs --json     -> prints verdict JSON, same exit
 *
 * Canon Part 8: LOCAL only. This module opens no wire and makes no Brain call.
 * NO em-dashes anywhere (CLAUDE.md HARD RULE). Pure CJS, zero npm deps.
 *
 * License: BSL 1.1.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// The frozen hardcoded fallback. Kept as data (not inline literals) so the
// allowlist merge and the fallback speak the same vocabulary.
const HARDCODED_USERNAMES = ['jsagi', 'jonathan'];
const HARDCODED_HOMES = ['/home/jsagi'];
const HARDCODED_ENV_FLAGS = ['MOS_ADMIN'];

// resolveConfigPath -- the optional allowlist location. MINDRIAN_ADMIN_IDENTITY_PATH
// wins (test injection + non-default deployments); otherwise ~/.mindrian/admin-identity.json.
function resolveConfigPath(env) {
  const override = env.MINDRIAN_ADMIN_IDENTITY_PATH;
  if (typeof override === 'string' && override.length > 0) return override;
  const home = env.HOME || os.homedir() || '';
  if (!home) return null;
  return path.join(home, '.mindrian', 'admin-identity.json');
}

// loadAllowlist -- read + parse the optional config. NEVER throws: a missing or
// malformed file yields an empty allowlist (the hardcoded conditions remain the
// gate). Returns { usernames:[], homes:[], envFlags:[] }.
function loadAllowlist(configPath) {
  const empty = { usernames: [], homes: [], envFlags: [] };
  if (!configPath) return empty;
  let raw;
  try {
    raw = fs.readFileSync(configPath, 'utf8');
  } catch (_) {
    return empty; // absent file = hardcoded-only gate
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_) {
    return empty; // malformed = fail toward the hardcoded gate, never crash
  }
  if (!parsed || typeof parsed !== 'object') return empty;
  const asStrArray = (v) => (Array.isArray(v)
    ? v.filter((x) => typeof x === 'string' && x.length > 0)
    : []);
  return {
    usernames: asStrArray(parsed.usernames),
    homes: asStrArray(parsed.homes),
    envFlags: asStrArray(parsed.env_flags),
  };
}

// envFlagTrue -- an env flag grants admin when set to the string 'true'
// (case-insensitive, trimmed).
function envFlagTrue(env, name) {
  const v = env[name];
  return typeof v === 'string' && v.trim().toLowerCase() === 'true';
}

// usernameMatches -- true if $USER or $USERNAME contains any needle (case-insensitive).
function usernameMatches(env, needles) {
  const candidates = [env.USER, env.USERNAME]
    .filter((x) => typeof x === 'string' && x.length > 0)
    .map((x) => x.toLowerCase());
  if (candidates.length === 0) return null;
  for (const needle of needles) {
    const n = String(needle).toLowerCase();
    for (const c of candidates) {
      if (c.includes(n)) return needle;
    }
  }
  return null;
}

/**
 * checkAdminIdentity -- the pure verdict. Deterministic over the supplied env +
 * config path. Returns { admin, reason, matched } where matched names the
 * winning condition (env|username|home|allowlist-env|allowlist-username|
 * allowlist-home) or null.
 *
 * @param {object} [opts]
 * @param {object} [opts.env]        env map (defaults to process.env)
 * @param {string} [opts.configPath] allowlist path (defaults to resolveConfigPath)
 * @returns {{admin: boolean, reason: string, matched: string|null}}
 */
function checkAdminIdentity(opts) {
  const options = opts || {};
  const env = options.env || process.env;
  const configPath = Object.prototype.hasOwnProperty.call(options, 'configPath')
    ? options.configPath
    : resolveConfigPath(env);

  const allow = loadAllowlist(configPath);

  // Merge hardcoded + allowlist. Allowlist EXTENDS, never replaces.
  const envFlags = HARDCODED_ENV_FLAGS.concat(allow.envFlags);
  const usernames = HARDCODED_USERNAMES.concat(allow.usernames);
  const homes = HARDCODED_HOMES.concat(allow.homes);

  // 1. env flags (MOS_ADMIN + any allowlisted flag).
  for (const flag of envFlags) {
    if (envFlagTrue(env, flag)) {
      const isHardcoded = HARDCODED_ENV_FLAGS.includes(flag);
      return {
        admin: true,
        reason: (isHardcoded ? 'env ' : 'allowlist env ') + flag + '=true',
        matched: isHardcoded ? 'env' : 'allowlist-env',
      };
    }
  }

  // 2. username substring.
  const uHit = usernameMatches(env, usernames);
  if (uHit) {
    const isHardcoded = HARDCODED_USERNAMES.includes(uHit);
    return {
      admin: true,
      reason: (isHardcoded ? 'username matches ' : 'allowlist username matches ') + uHit,
      matched: isHardcoded ? 'username' : 'allowlist-username',
    };
  }

  // 3. home exact match.
  const home = typeof env.HOME === 'string' ? env.HOME : '';
  if (home) {
    for (const h of homes) {
      if (home === h) {
        const isHardcoded = HARDCODED_HOMES.includes(h);
        return {
          admin: true,
          reason: (isHardcoded ? 'home is ' : 'allowlist home is ') + h,
          matched: isHardcoded ? 'home' : 'allowlist-home',
        };
      }
    }
  }

  return { admin: false, reason: 'no admin condition met', matched: null };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main() {
  const wantJson = process.argv.includes('--json');
  let verdict;
  try {
    verdict = checkAdminIdentity();
  } catch (_) {
    // Defensive: an unexpected throw is treated as NOT admin (fail-closed for the
    // CLI answer), but never crashes.
    verdict = { admin: false, reason: 'internal error', matched: null };
  }
  if (wantJson) {
    process.stdout.write(JSON.stringify(verdict) + '\n');
  }
  process.exit(verdict.admin ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = {
  checkAdminIdentity,
  loadAllowlist,
  resolveConfigPath,
  HARDCODED_USERNAMES,
  HARDCODED_HOMES,
  HARDCODED_ENV_FLAGS,
};
