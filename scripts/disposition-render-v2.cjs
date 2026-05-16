#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121.5-04 (Sub-plan E) -- render-v2 disposition audit script.
 *
 * Resolves the long-open question logged in 121.5-CONTEXT.md item 5:
 *
 *   "lib/render/render-v2.cjs is built, tested, and almost unused. Only
 *    selector-dispatcher.cjs and the agentic surfaces route through it;
 *    ordinary Larry prose still follows SKILL.md by instruction. Decide
 *    explicitly: wire it into the real prose path, or document it as
 *    agent-surface-only and let SKILL.md remain the canonical prose
 *    contract."
 *
 * VERDICT (locked at plan-phase, 2026-05-16 dual-graph review):
 *
 *   render-v2 stays as an AGENT-SURFACE-ONLY renderer by design.
 *   SKILL.md remains the canonical prose contract for Larry's main
 *   conversation path. The v2 destructured render() entry is reserved
 *   for /mos:* command surfaces that route through selector-dispatcher
 *   (Shape F gates, Shape E action reports, etc.). This is the FINAL
 *   disposition for v1.13.0; the door stays open for future lens-aware
 *   variants once the dual-graph proposal lands (Canon Part 7 language
 *   discipline: "current" disposition, not "closed forever").
 *
 * What this script does:
 *
 *   1. Scans the worktree for production consumers of render-v2.cjs.
 *      (lib/, scripts/, commands/, bin/, hooks/ -- everything outside
 *      tests/ and node_modules/.)
 *   2. Classifies each consumer as either (a) the v1 shim itself
 *      (lib/render/render.cjs, allowed -- reuses the v2 muscle for the
 *      legacy 4-arg signature), or (b) a non-prose-path agent surface
 *      (selector-dispatcher.cjs, /mos:* command runners, hooks).
 *   3. Flags ANY direct require of lib/render/render-v2.cjs from a
 *      prose-path code module -- those would contradict the disposition.
 *   4. Emits a structured JSON report on stdout (--json mode) plus a
 *      human-readable summary on stderr.
 *
 * Why this exists as a script and not just a test:
 *
 *   Tests gate the disposition at CI time; this script gives operators
 *   (and the verifier agent) a single-line answer to "is render-v2 still
 *   agent-surface-only?" at any moment, useful when reviewing a new PR
 *   that might silently start importing render-v2 from a prose-side
 *   module. Pair with lib/memory/render-v2-disposition.test.cjs (the
 *   CI gate) -- script is the operator-facing surface, test is the wall.
 *
 * Constraints (Phase 87 invariant):
 *   - Zero new runtime dependencies.
 *   - CJS only.
 *   - Node built-ins only (fs, path).
 *   - No Brain calls, no network IO -- pure read-only filesystem scan.
 *
 * Canon parts: 7 (Reuse Before Build -- one renderer, two entry points;
 *   v2 is the muscle, v1 shim wraps it for the legacy signature); 3
 *   (the v2 destructured entry is reserved for the Shape F decision
 *   gate surfaces -- the agentic gate output side).
 *
 * Usage:
 *   node scripts/disposition-render-v2.cjs            # human summary
 *   node scripts/disposition-render-v2.cjs --json     # machine-readable
 *
 * Exit codes:
 *   0  disposition holds (render-v2 stays agent-surface-only).
 *   1  disposition violated (a prose-path module now imports render-v2).
 */

const fs = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------------------
// Configuration.
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, '..');

// Directories to walk. Tests + node_modules are explicitly out of scope --
// tests are allowed to import the renderer; CI dependencies are not our
// concern. The .planning and .git trees are also skipped.
const SCAN_DIRS = ['lib', 'scripts', 'commands', 'bin', 'hooks'];

// Files we already know are allowed to import render-v2 by design.
// Adding a name here is a deliberate disposition decision -- the test
// (lib/memory/render-v2-disposition.test.cjs) and this script both
// honor the allowlist.
const ALLOWED_CONSUMERS = Object.freeze([
  // The v1 legacy-signature shim -- by design, reuses v2 muscle.
  path.join('lib', 'render', 'render.cjs'),
  // The agentic Shape F dispatcher -- agent-surface entry point per
  // Canon Part 3 (the tri-context gate output side).
  path.join('lib', 'hmi', 'selector-dispatcher.cjs'),
]);

// Pattern that catches require() of render-v2 in any form we have seen
// in the codebase (relative, absolute, with or without .cjs suffix).
const REQUIRE_PATTERN = /require\s*\(\s*['"]([^'"]*render-v2(?:\.cjs)?)['"]\s*\)/g;

// ---------------------------------------------------------------------------
// Filesystem walk.
// ---------------------------------------------------------------------------

function walk(dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (e) { return; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip nested node_modules + dot-dirs.
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      walk(full, out);
    } else if (entry.isFile()) {
      // Only scan source files; the .cjs filter is intentional -- the
      // codebase is CJS-first per Phase 87 invariant.
      if (entry.name.endsWith('.cjs') || entry.name.endsWith('.js')) {
        out.push(full);
      }
    }
  }
}

function isTestFile(relPath) {
  // Tests are allowed to import render-v2 freely. We classify by name
  // suffix (the codebase uses `.test.cjs` + `test-*.cjs` consistently).
  const base = path.basename(relPath);
  return base.endsWith('.test.cjs')
    || base.endsWith('.test.js')
    || base.startsWith('test-');
}

function scanFile(file) {
  let src;
  try { src = fs.readFileSync(file, 'utf8'); }
  catch (e) { return null; }
  REQUIRE_PATTERN.lastIndex = 0;
  const matches = [];
  let m;
  while ((m = REQUIRE_PATTERN.exec(src)) !== null) {
    matches.push(m[1]);
  }
  return matches.length > 0 ? matches : null;
}

// ---------------------------------------------------------------------------
// Main audit.
// ---------------------------------------------------------------------------

function audit() {
  const files = [];
  for (const dir of SCAN_DIRS) {
    walk(path.join(REPO_ROOT, dir), files);
  }

  const consumers = []; // { file, requires, classification }
  for (const file of files) {
    const rel = path.relative(REPO_ROOT, file);
    if (isTestFile(rel)) continue;
    // The renderer itself is not a consumer of itself.
    if (rel === path.join('lib', 'render', 'render-v2.cjs')) continue;
    const matches = scanFile(file);
    if (!matches) continue;
    consumers.push({
      file: rel,
      requires: matches,
      classification: ALLOWED_CONSUMERS.indexOf(rel) >= 0 ? 'allowed' : 'violation',
    });
  }

  const allowed = consumers.filter(function (c) { return c.classification === 'allowed'; });
  const violations = consumers.filter(function (c) { return c.classification === 'violation'; });

  return {
    disposition: 'agent-surface-only',
    canon_parts: ['3', '7'],
    verdict: violations.length === 0 ? 'HOLDS' : 'VIOLATED',
    allowed_consumers: ALLOWED_CONSUMERS.slice(),
    consumers_found: consumers,
    violations: violations,
    summary: {
      total_consumers: consumers.length,
      allowed_count: allowed.length,
      violation_count: violations.length,
    },
  };
}

// ---------------------------------------------------------------------------
// CLI entrypoint.
// ---------------------------------------------------------------------------

function main() {
  const argv = process.argv.slice(2);
  const jsonMode = argv.indexOf('--json') !== -1;

  const report = audit();

  if (jsonMode) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    process.stderr.write('render-v2 disposition audit\n');
    process.stderr.write('  disposition : ' + report.disposition + '\n');
    process.stderr.write('  verdict     : ' + report.verdict + '\n');
    process.stderr.write('  consumers   : ' + report.summary.total_consumers
      + ' (' + report.summary.allowed_count + ' allowed, '
      + report.summary.violation_count + ' violation)\n');
    if (report.consumers_found.length) {
      process.stderr.write('  found:\n');
      for (const c of report.consumers_found) {
        process.stderr.write('    [' + c.classification + '] ' + c.file + '\n');
      }
    }
    if (report.violations.length) {
      process.stderr.write('\n  VIOLATION: render-v2 must remain agent-surface-only\n');
      process.stderr.write('  (see lib/render/ROOM.md for the canonical disposition)\n');
    }
  }

  process.exit(report.verdict === 'HOLDS' ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = { audit, ALLOWED_CONSUMERS };
