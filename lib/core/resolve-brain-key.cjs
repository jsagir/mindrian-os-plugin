'use strict';
/*
 * lib/core/resolve-brain-key.cjs -- the ONE resolver for "where is the Brain
 * API key on this machine?" (Phase 123 Plan-07).
 *
 * Background: before this module, three different places guessed independently
 * how to discover the Brain key (brain-client.cjs::getApiKey, session-start's
 * shell test of MINDRIAN_BRAIN_KEY, brain-connector's skill detection). Three
 * guessers, three failure modes -- a standard install with the key in
 * ~/.mindrian.env was visible to brain-client but invisible to session-start,
 * so a working HTTP-path Brain still printed a Tier-0 MCP warning. This
 * collapses them into one source of truth. Mirrors active-plugin-root.cjs
 * (the resolver this one is patterned on).
 *
 * Precedence (first hit wins) per D-31:
 *   1. MINDRIAN_BRAIN_KEY env var     -- explicit operator intent, highest.
 *   2. <home>/.mindrian.env           -- global backup, persists across CWDs.
 *   3. <cwd>/.env                     -- project-local override.
 *   4. <home>/.mindrian-install.json  -- Phase 250-04 (HONEST-03, SEED-011
 *                                        Option A): the cached per-install
 *                                        silent-registration token, LOWEST
 *                                        precedence. Read-only here -- this
 *                                        resolver never mints or writes the
 *                                        cache file; minting lives in
 *                                        brain-client.cjs (the resolver
 *                                        stays a pure function of what is
 *                                        already on disk/in-env). A manual
 *                                        key at legs 1-3 ALWAYS wins: an
 *                                        existing keyed user's ladder
 *                                        resolves byte-identically to before
 *                                        this leg existed.
 *   5. not-found.
 *
 * IMPORTANT (FLAG-3 fix). The default for `home` is
 *   process.env.HOME || process.env.USERPROFILE || os.homedir()
 * -- NOT bare os.homedir(). On Linux/POSIX, os.homedir() reads /etc/passwd and
 * IGNORES process.env.HOME, which breaks hermetic tests that override HOME to
 * a scratch directory. The env-aware default matches the precedent in
 * scripts/doctor.cjs, scripts/session-start, and lib/core/active-plugin-root.cjs.
 *
 * Returns { key, source, available, reason }:
 *   - available=true:  key is the trimmed value, reason is null.
 *   - available=false: key is null, reason is the explicit cause string
 *                      (never a silent null -- SEC-02 rejections route here too).
 *
 * SEC-02 permission check (POSIX-only, no-op on Windows). When the resolved
 * source is a key file (~/.mindrian.env or CWD .env), stat the mode. If any
 * group or world bit is set (mode & 0o077), return available:false with the
 * explicit reason "permissions too open: <path> is mode 0NNN, must be 0600".
 *
 * Use as a module:
 *   const { resolveBrainKey } = require('<...>/lib/core/resolve-brain-key.cjs');
 *   const r = resolveBrainKey();           // r.key, r.source, r.available, r.reason
 *
 * Use as a CLI (so scripts/session-start can shell out without a JSON parser
 * in bash):
 *   node lib/core/resolve-brain-key.cjs          -> prints JSON, exits 0
 *
 * Canon Part 8: this reads LOCAL files and env only. Zero network surface.
 * The plan's verification grep against this file's source returns nothing
 * -- no network markers in this resolver, ever. The actual Brain call is
 * brain-client.cjs's job; this module only DISCOVERS whether a key exists.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

/**
 * SEC-02 permission gate. POSIX-only -- on Windows POSIX mode bits do not
 * translate to NTFS ACLs, so we return ok unconditionally there (a single
 * stderr note would couple this resolver to a side-effect; the calling layer
 * is the right place to surface that one-time note).
 *
 *   mode & 0o077 !== 0   =>   any group or world bit set   =>   reject.
 *   0o600 / 0o400 pass; 0o644 / 0o664 / 0o666 fail.
 *
 * On stat failure (file vanished between exists() and stat() -- rare but
 * possible) we treat it as not-ok with an explanatory reason rather than
 * pretending the file is fine.
 *
 * @param {string} p   the file path
 * @returns {{ok: boolean, reason: string|null}}
 */
function checkFilePermissions(p) {
  if (process.platform === 'win32') {
    return { ok: true, reason: null };
  }
  let stat;
  try {
    stat = fs.statSync(p);
  } catch (e) {
    return { ok: false, reason: 'unable to stat ' + p + ': ' + (e && e.code || String(e)) };
  }
  const mode = stat.mode & 0o777;
  if ((mode & 0o077) !== 0) {
    const modeStr = mode.toString(8).padStart(3, '0');
    return {
      ok: false,
      reason: 'permissions too open: ' + p + ' is mode 0' + modeStr + ', must be 0600',
    };
  }
  return { ok: true, reason: null };
}

/**
 * Parse a single MINDRIAN_BRAIN_KEY=... line out of a (possibly multi-line)
 * env-file body. Returns the trimmed value, or null if the line is absent or
 * the value is empty. We deliberately do NOT use a full dotenv parser -- one
 * variable, one regex, no transitive dependency.
 *
 * @param {string} body
 * @returns {string|null}
 */
function _parseKey(body) {
  const m = body.match(/^MINDRIAN_BRAIN_KEY\s*=\s*(.+?)\s*$/m);
  if (!m) return null;
  const v = m[1].trim();
  return v.length > 0 ? v : null;
}

/**
 * Normalize a resolved key down to a bare token (quick task 260722-wom, per the
 * 2026-07-22 Memgraph migration brief). At least one live env stored the entire
 * wire auth header value ("Authorization: Bearer <uuid>") inside the var, while
 * the consumer re-wraps the resolved key with its own Bearer prefix. That double
 * prefix turned a valid key into a misleading 401. Normalizing at this single
 * chokepoint repairs every consumer at once: strip one leading "Authorization:"
 * label, then one leading "Bearer" scheme token (case-insensitive, anchored to
 * the START only), so a token that merely contains those letters mid-string is
 * never mangled (pinned by rbk.13). Returns null when nothing usable remains --
 * a bare scheme token with no value falls through the precedence chain (rbk.14).
 *
 * @param {*} v   the raw resolved value (env var or parsed file line)
 * @returns {string|null}  the bare token, or null if nothing usable remains
 */
function _normalizeKey(v) {
  if (typeof v !== 'string') return null;
  let s = v.trim();
  if (s.length === 0) return null;
  // Strip one leading "Authorization:" label (case-insensitive) plus its
  // following whitespace, anchored to the start of the value.
  s = s.replace(/^Authorization:\s*/i, '');
  // Strip one leading "Bearer" scheme token (case-insensitive) when it is
  // followed by whitespace OR the end of the value (so a bare "Bearer" with
  // nothing after it also strips, leaving nothing rather than the literal).
  s = s.replace(/^Bearer(?:\s+|$)/i, '');
  s = s.trim();
  return s.length > 0 ? s : null;
}

/**
 * Resolve the Brain API key from the standard precedence chain.
 *
 * The `home` and `cwd` parameters exist as test seams. Their defaults match
 * the precedent across the rest of the plugin (scripts/doctor.cjs, scripts/
 * session-start, lib/core/active-plugin-root.cjs): env-aware home resolution
 * so hermetic tests overriding process.env.HOME actually work on Linux/POSIX,
 * where os.homedir() reads /etc/passwd and ignores the env override.
 *
 * @param {{home?: string, cwd?: string}} [opts]
 * @returns {{key: string|null, source: 'env'|'mindrian-env-file'|'cwd-env-file'|'install-token'|'not-found', available: boolean, reason: string|null}}
 */
function resolveBrainKey(opts) {
  const o = opts || {};
  const home = o.home || process.env.HOME || process.env.USERPROFILE || os.homedir();
  const cwd = o.cwd || process.cwd();

  // (1) Env var wins. A null normalization (empty, or a bare scheme token with
  // nothing after it) falls through to the file chain as if the var were unset.
  if (process.env.MINDRIAN_BRAIN_KEY) {
    const v = _normalizeKey(process.env.MINDRIAN_BRAIN_KEY);
    if (v) {
      return { key: v, source: 'env', available: true, reason: null };
    }
  }

  // (2) <home>/.mindrian.env
  const mindrianEnvPath = path.join(home, '.mindrian.env');
  if (fs.existsSync(mindrianEnvPath)) {
    const perms = checkFilePermissions(mindrianEnvPath);
    if (!perms.ok) {
      return { key: null, source: 'mindrian-env-file', available: false, reason: perms.reason };
    }
    try {
      const body = fs.readFileSync(mindrianEnvPath, 'utf8');
      const v = _normalizeKey(_parseKey(body));
      if (v) {
        return { key: v, source: 'mindrian-env-file', available: true, reason: null };
      }
    } catch (e) {
      return {
        key: null,
        source: 'mindrian-env-file',
        available: false,
        reason: 'unable to read ' + mindrianEnvPath + ': ' + (e && e.code || String(e)),
      };
    }
  }

  // (3) <cwd>/.env
  const cwdEnvPath = path.join(cwd, '.env');
  if (fs.existsSync(cwdEnvPath)) {
    const perms = checkFilePermissions(cwdEnvPath);
    if (!perms.ok) {
      return { key: null, source: 'cwd-env-file', available: false, reason: perms.reason };
    }
    try {
      const body = fs.readFileSync(cwdEnvPath, 'utf8');
      const v = _normalizeKey(_parseKey(body));
      if (v) {
        return { key: v, source: 'cwd-env-file', available: true, reason: null };
      }
    } catch (e) {
      return {
        key: null,
        source: 'cwd-env-file',
        available: false,
        reason: 'unable to read ' + cwdEnvPath + ': ' + (e && e.code || String(e)),
      };
    }
  }

  // (4) <home>/.mindrian-install.json -- Phase 250-04 install-token cache,
  // LOWEST precedence. Read-only: this leg never mints or writes the file
  // (see the module header). SEC-02 applies identically to the key files
  // above (mode 0600 required; any group/world bit set -> reject explicitly,
  // never a silent fall-through to not-found).
  const installTokenPath = path.join(home, '.mindrian-install.json');
  if (fs.existsSync(installTokenPath)) {
    const perms = checkFilePermissions(installTokenPath);
    if (!perms.ok) {
      return { key: null, source: 'install-token', available: false, reason: perms.reason };
    }
    try {
      const body = fs.readFileSync(installTokenPath, 'utf8');
      const parsed = JSON.parse(body);
      const v = _normalizeKey(parsed && parsed.token);
      if (v) {
        return { key: v, source: 'install-token', available: true, reason: null };
      }
    } catch (e) {
      return {
        key: null,
        source: 'install-token',
        available: false,
        reason: 'unable to read ' + installTokenPath + ': ' + (e && e.code || e && e.message || String(e)),
      };
    }
  }

  // (5) not-found.
  return {
    key: null,
    source: 'not-found',
    available: false,
    reason: 'MINDRIAN_BRAIN_KEY not set (env), and neither ' + mindrianEnvPath
      + ' nor ' + cwdEnvPath + ' nor ' + installTokenPath + ' contains a usable key',
  };
}

module.exports = { resolveBrainKey, checkFilePermissions };

// CLI entry point. session-start shells out via:
//   node lib/core/resolve-brain-key.cjs
// and parses the JSON. Exit 0 always (the consumer reads the JSON to learn
// available/reason); a non-zero exit here would surface as "resolver failed"
// rather than the clearer not-found / permissions-too-open branches.
if (require.main === module) {
  const r = resolveBrainKey();
  process.stdout.write(JSON.stringify(r) + '\n');
  process.exit(0);
}
