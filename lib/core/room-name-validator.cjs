'use strict';
/*
 * Phase 119-01 -- Room name validator (four rejection classes).
 *
 * Per CONTEXT.md Architectural Decision item 5: when the user picks
 * [type your own name] in the F.1 selector, this validator runs.
 * Four rejection classes: collision, fs-unsafe chars, reserved untitled-
 * prefix, empty / whitespace. On any failure, the F.1 selector re-prompts
 * inline with the rejection reason; it MUST NOT fall back to a different
 * F.1 option silently.
 *
 * Defense-in-depth: a fifth class (Windows-reserved device names) is also
 * surfaced because rooms may sync across CLI / Desktop / Cowork surfaces per
 * CLAUDE.md tri-polar HARD RULE; a Linux/macOS-named room that collides with
 * a Windows reserved device name (CON, PRN, LPT1...) breaks the user's room
 * the moment it syncs to a Windows machine.
 *
 * Canon Part 8 invariant: pure-local; no Brain MCP, no fetch, no telemetry.
 * Em-dash discipline: uses `--` never the U+2014 character per HARD RULE.
 */

const fs = require('node:fs');
const path = require('node:path');

// Canonical slug pattern: lowercase letters, digits, hyphens.
// Minimum 3 chars to avoid single-letter directory names that clash with
// common filesystem temp patterns. Maximum 64 chars per /mos:rooms list
// rendering budget (the registry render uses fixed-column alignment).
const FS_SAFE_SLUG_RE = Object.freeze(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/);

// Reserved-prefix namespaces that the user MUST NOT manually claim.
// 'untitled-' is reserved by the Phase 119-00 placeholder pattern.
const RESERVED_PREFIXES = Object.freeze(['untitled-']);

// Windows reserved device names (the validator surfaces these even on Linux/
// macOS because rooms may sync across surfaces per CLAUDE.md tri-polar rule).
const WINDOWS_RESERVED = Object.freeze(new Set([
  'con', 'prn', 'aux', 'nul',
  'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9',
  'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9',
]));

/**
 * validateRoomName(candidate, opts) -> {ok, normalized_slug, reasons}
 *
 * @param {string} candidate    user input (free-text, untrusted)
 * @param {object} opts
 * @param {string} [opts.roomsHome]  absolute path to $ROOMS_HOME for collision check
 * @returns {{ok: boolean, normalized_slug: string, reasons: string[]}}
 */
function validateRoomName(candidate, opts) {
  const options = opts || {};
  const reasons = [];

  // Rejection class 4: empty / whitespace.
  if (typeof candidate !== 'string') {
    return { ok: false, normalized_slug: '', reasons: ['empty'] };
  }
  const trimmed = candidate.trim();
  if (trimmed.length === 0) {
    return { ok: false, normalized_slug: '', reasons: ['empty'] };
  }

  // Normalize: lowercase + trim. We do NOT silently substitute unsafe chars;
  // unsafe input surfaces the fs_unsafe_chars rejection so the user can fix it.
  const normalized = trimmed.toLowerCase();

  // Rejection class 3: reserved prefix. Match the canonical hyphenated form
  // (RESERVED_PREFIXES e.g. 'untitled-') AND the broader 'untitled' family
  // head (bare 'untitled' OR 'untitled' followed by any non-alphanumeric
  // separator). This closes the "untitled/with-slash" / "untitled.foo"
  // namespace-escape vectors while still allowing names like 'untitledly'
  // to pass the reserved-prefix gate (they will still hit fs_unsafe_chars
  // if non-canonical).
  for (const prefix of RESERVED_PREFIXES) {
    if (normalized.indexOf(prefix) === 0) {
      reasons.push('reserved_prefix:' + prefix);
      break;
    }
  }
  // Bare 'untitled' OR 'untitled' followed by a non-alphanumeric separator
  // (slash, dot, space, etc.) is also reserved.
  if (reasons.indexOf('reserved_prefix:untitled-') === -1) {
    if (normalized === 'untitled' || /^untitled[^a-z0-9]/.test(normalized)) {
      reasons.push('reserved_prefix:untitled-');
    }
  }

  // Rejection class 2: fs-unsafe characters / shape.
  if (!FS_SAFE_SLUG_RE.test(normalized)) {
    reasons.push('fs_unsafe_chars');
  }
  // Defense-in-depth: Windows reserved device names (regardless of platform).
  if (WINDOWS_RESERVED.has(normalized)) {
    reasons.push('windows_reserved');
  }

  // Rejection class 1: collision check (registry + on-disk).
  if (options.roomsHome && typeof options.roomsHome === 'string') {
    const registryPath = path.join(options.roomsHome, '.rooms', 'registry.json');
    try {
      if (fs.existsSync(registryPath)) {
        const raw = fs.readFileSync(registryPath, 'utf8');
        const reg = JSON.parse(raw);
        const rooms = (reg && typeof reg.rooms === 'object') ? reg.rooms : {};
        if (Object.prototype.hasOwnProperty.call(rooms, normalized)) {
          reasons.push('collision');
        }
        // Defense-in-depth: registry may be out of sync with disk.
        const candidateDir = path.join(options.roomsHome, normalized);
        if (fs.existsSync(candidateDir) && reasons.indexOf('collision') === -1) {
          reasons.push('collision');
        }
      }
    } catch (_e) {
      // Registry unreadable -- skip collision check; degrade open.
    }
  }

  return {
    ok: reasons.length === 0,
    normalized_slug: normalized,
    reasons: reasons,
  };
}

module.exports = {
  validateRoomName: validateRoomName,
  FS_SAFE_SLUG_RE: FS_SAFE_SLUG_RE,
  RESERVED_PREFIXES: RESERVED_PREFIXES,
  WINDOWS_RESERVED: WINDOWS_RESERVED,
};
