'use strict';
/*
 * lib/core/resolve-brain-key.cjs -- the POSIX permission gate for local
 * secret files, and nothing else.
 *
 * History: this module used to be the resolver for a Brain credential
 * (Phase 123 Plan-07). Theo needs no credential (quick 261005-l8g, SEED-119
 * ruling 2026-10-05; Phase 369.2 Phase 0 fixture J2), so the resolver, its
 * precedence ladder and its CLI are gone. What stays is the one helper a
 * sibling secret-file reader reuses: checkFilePermissions().
 *
 * SEC-02 permission gate. POSIX-only -- on Windows POSIX mode bits do not
 * translate to NTFS ACLs, so it returns ok unconditionally there.
 *
 *   mode & 0o077 !== 0   =>   any group or world bit set   =>   reject.
 *   0o600 / 0o400 pass; 0o644 / 0o664 / 0o666 fail.
 *
 * Canon Part 8: this reads LOCAL file metadata only. Zero network surface.
 */

const fs = require('node:fs');

/**
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

module.exports = { checkFilePermissions };
