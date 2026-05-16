#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * lib/core/stale-copy-scanner.cjs
 * -------------------------------
 * Phase 121.5-05 Sub-plan F Task 2 (SEED-007 absorption).
 *
 * Pure CJS module that scans the first-touch surfaces declared in
 * data/first-touch-surfaces.json for two regression patterns:
 *
 *   - stale_version_hardcode  a literal `vX.Y.Z` (or `X.Y.Z`) in greeting
 *                             copy that is OLDER than the running plugin
 *                             version (semver compare). Source finding
 *                             (SEED-007, 2026-05-09): a v1.12.0 greeting
 *                             was rendering on a stale Windows install that
 *                             had been bumped to v1.13.0.
 *   - em_dash_violation       any U+2014 EM DASH in a surface that has
 *                             em_dash_check: true. Enforces the
 *                             feedback_no_emdashes hard rule.
 *
 * Per-surface invariants come from data/first-touch-surfaces.json:
 *   - version_stamp_required: false  ->  skip stale_version_hardcode
 *   - em_dash_check: false           ->  skip em_dash_violation
 *   - allowed_hardcoded_versions[]    ->  whitelist of strings exempt from
 *                                        stale_version_hardcode (template
 *                                        tokens, doc examples)
 *
 * Wired into scripts/doctor.cjs as class K (stale-first-touch-copy).
 *
 * Canon Part 7 (Reuse Before Build): consolidates the SEED-007 detection
 * responsibility previously scattered across scripts/check-first-touch-drift.cjs
 * (which exists but is partial / not exposed in /mos:doctor) and the manual
 * audit pattern. ZERO new commands; class K extends the existing class A-J
 * doctor pattern.
 *
 * Canon Part 8: local-only; no fetch, no Brain, no telemetry egress.
 *
 * Note: this plan was scoped against class H in 121.5-05-PLAN.md, but class
 * H was already taken (install-incomplete: missing statusLine block + halted
 * .install-receipt.json) at the time of execution. Renamed to class K (next
 * available after I + J) per deviation Rule 3 (auto-fix blocking issue:
 * naming collision). The behavior contract from the plan is preserved
 * byte-identical; only the class letter changed.
 *
 * No emoji. No em-dashes. ASCII-clean source.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const {
  readSurfaces,
  resolveCurrentVersion,
  hasEmDash,
} = require('./first-touch-version-stamper.cjs');

const REPO_ROOT = path.join(__dirname, '..', '..');

// vX.Y.Z or X.Y.Z (optional -<prerelease> tail). Captures the X.Y.Z core in
// group 1 (without the leading v) for semver compare. Matches:
//   v1.13.0           -> 1.13.0
//   1.13.0            -> 1.13.0
//   v1.13.0-beta.15   -> 1.13.0-beta.15
const VERSION_LITERAL_RE = /\bv?(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?)\b/g;

// compareSemver(a, b) returns negative if a < b, positive if a > b, 0 if
// equal. Loose splitter (numeric-aware for X.Y.Z core; lexical for the
// prerelease tail). Sufficient for the SEED-007 detection pattern (older
// X.Y.Z than current); does not aim to match the full semver 2.0 spec.
function compareSemver(a, b) {
  const parseLoose = (s) => String(s)
    .replace(/^v/, '')
    .split(/[.-]/)
    .map((p) => (/^\d+$/.test(p) ? parseInt(p, 10) : p));
  const A = parseLoose(a);
  const B = parseLoose(b);
  const len = Math.max(A.length, B.length);
  for (let i = 0; i < len; i++) {
    const x = A[i];
    const y = B[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (typeof x === 'number' && typeof y === 'number') {
      if (x !== y) return x - y;
      continue;
    }
    // Mixed-type or string compare: stringwise.
    const sx = String(x);
    const sy = String(y);
    if (sx !== sy) return sx < sy ? -1 : 1;
  }
  return 0;
}

// scanSurface(surface, currentVersion, opts?) -> violations[]
// opts.repoRoot can override the file root for tests / fixtures.
function scanSurface(surface, currentVersion, opts) {
  const violations = [];
  const repoRoot = (opts && opts.repoRoot) || REPO_ROOT;
  const filePath = path.isAbsolute(surface.file)
    ? surface.file
    : path.join(repoRoot, surface.file);
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (_e) {
    // Missing surface file is NOT a violation (per scripts/check-first-touch-
    // drift.cjs convention -- missing is warn-only, not hard fail). Tests
    // explicitly cover the present-but-stale + present-but-em-dashed paths.
    return violations;
  }
  if (surface.em_dash_check && hasEmDash(content)) {
    violations.push({
      surface: surface.id,
      file: surface.file,
      kind: 'em_dash_violation',
    });
  }
  if (surface.version_stamp_required !== false) {
    const allowed = new Set(surface.allowed_hardcoded_versions || []);
    VERSION_LITERAL_RE.lastIndex = 0;
    let m;
    while ((m = VERSION_LITERAL_RE.exec(content)) !== null) {
      const found = m[1];
      // Allowlist check: exact match against the captured X.Y.Z(-prerelease)
      // core OR against the original literal token (with optional 'v' prefix).
      if (allowed.has(found) || allowed.has('v' + found) || allowed.has(m[0])) continue;
      // Anything OLDER than the running plugin version is stale -- that is
      // the SEED-007 trigger. Equal or newer is fine.
      if (compareSemver(found, currentVersion) < 0) {
        violations.push({
          surface: surface.id,
          file: surface.file,
          kind: 'stale_version_hardcode',
          found,
          current: currentVersion,
        });
      }
    }
  }
  return violations;
}

// scanForStaleCopy(opts?) -> {valid, violations, scanned_count, current_version}
// opts.surfaces overrides the default surfaces[] from data/first-touch-surfaces.json.
// opts.currentVersion overrides the auto-resolved plugin.json version.
// opts.repoRoot routes relative paths against an override (for tests).
function scanForStaleCopy(opts) {
  opts = opts || {};
  const surfaces = opts.surfaces ? opts.surfaces : readSurfaces().surfaces;
  const currentVersion = opts.currentVersion || resolveCurrentVersion();
  const violations = [];
  for (const s of surfaces) {
    violations.push(...scanSurface(s, currentVersion, { repoRoot: opts.repoRoot }));
  }
  return {
    valid: violations.length === 0,
    violations,
    scanned_count: surfaces.length,
    current_version: currentVersion,
  };
}

module.exports = {
  scanForStaleCopy,
  scanSurface,
  compareSemver,
  VERSION_LITERAL_RE,
};

// CLI invocation: `node lib/core/stale-copy-scanner.cjs` runs the scanner
// against the live repo and prints a summary. Exit 0 clean / Exit 1 violations.
if (require.main === module) {
  const result = scanForStaleCopy();
  if (result.valid) {
    process.stdout.write('stale-copy-scanner: clean (' + result.scanned_count + ' surfaces scanned, current v' + result.current_version + ')\n');
    process.exit(0);
  }
  process.stdout.write('stale-copy-scanner: ' + result.violations.length + ' violation(s) (current v' + result.current_version + ')\n');
  for (const v of result.violations) {
    if (v.kind === 'stale_version_hardcode') {
      process.stdout.write('  ' + v.surface + ' (' + v.file + ') -- stale version literal "' + v.found + '" (current ' + v.current + ')\n');
    } else if (v.kind === 'em_dash_violation') {
      process.stdout.write('  ' + v.surface + ' (' + v.file + ') -- em-dash (U+2014) in greeting surface\n');
    }
  }
  process.exit(1);
}
