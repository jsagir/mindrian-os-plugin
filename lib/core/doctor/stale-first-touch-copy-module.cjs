'use strict';
/*
 * lib/core/doctor/stale-first-touch-copy-module.cjs -- Phase 217 Plan 03
 * (D-01/D-02).
 *
 * The class-K "stale-first-touch-copy" doctor check, migrated out of the
 * doctor CLI inline main() block into a registry-driven cadence:always
 * runner. Check-only (fix_supported:false).
 *
 * WHAT IT DOES: wraps lib/core/stale-copy-scanner.cjs::scanForStaleCopy(), which
 * scans the first-touch greeting surfaces (data/first-touch-surfaces.json) for
 * two regression patterns -- a stale hardcoded version literal older than the
 * running plugin, and a U+2014 em-dash in a greeting surface. This runner adds
 * NO detection logic; it maps the scanner result into the doctor check envelope
 * and builds the action_lines[] the deleted hand-coded render branch used to
 * print (the generic renderer now prints one dim sub-line per action line).
 *
 * Contract: check(ctx) -> { status: 'ok'|'warn'|'error', detail: string,
 *   class:'K', violations, scanned_count, current_version, action_lines? }.
 *
 * Canon Part 8: the scanner is a pure LOCAL file scan -- zero network, zero
 * Brain. This runner never back-requires the doctor CLI (circular).
 */

const path = require('node:path');

// scanForStaleCopy lives at lib/core/stale-copy-scanner.cjs; this runner sits at
// lib/core/doctor/, so the relative hop is one '..' up.
const { scanForStaleCopy } = require('../stale-copy-scanner.cjs');

// Reproduce the two per-violation sub-line formats verbatim from the deleted
// class-K render branch.
function buildActionLines(violations, currentVersion) {
  const lines = [];
  if (!Array.isArray(violations)) return lines;
  for (const v of violations) {
    if (v.kind === 'stale_version_hardcode') {
      lines.push(v.surface + ' (' + v.file + '): stale version literal "' + v.found
        + '" (current ' + (v.current || currentVersion) + ')');
    } else if (v.kind === 'em_dash_violation') {
      lines.push(v.surface + ' (' + v.file + '): em-dash (U+2014) in greeting surface');
    }
  }
  return lines;
}

function check(ctx) {
  void ctx; // no ctx inputs: the scanner reads the shipped surfaces + plugin.json.
  let result;
  try {
    result = scanForStaleCopy();
  } catch (err) {
    return {
      class: 'K',
      status: 'error',
      detail: (err && err.message) || 'stale-copy-scanner threw',
      violations: [],
    };
  }

  const status = result.valid ? 'ok' : 'warn';
  const detail = result.valid
    ? 'all first-touch surfaces stamp the running version + pass em-dash check'
    : 'stale or em-dashed copy detected on ' + result.violations.length + ' surface(s)';

  const out = {
    class: 'K',
    status,
    detail,
    violations: result.violations,
    scanned_count: result.scanned_count,
    current_version: result.current_version,
  };
  const actionLines = buildActionLines(result.violations, result.current_version);
  if (actionLines.length > 0) out.action_lines = actionLines;
  return out;
}

module.exports = {
  check,
  // exported for hermetic unit tests:
  buildActionLines,
};
