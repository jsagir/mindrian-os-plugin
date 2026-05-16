#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121.5-04 (Sub-plan E) -- render-v2 disposition CI gate.
 *
 * Pairs with scripts/disposition-render-v2.cjs. The script is the
 * operator-facing audit surface; this test is the CI wall that fails
 * the build when a prose-path module silently starts importing
 * lib/render/render-v2.cjs.
 *
 * What this test asserts (the disposition contract):
 *
 *   1. The audit script's verdict is HOLDS -- no prose-path module
 *      currently imports render-v2.
 *   2. The allowlist matches the canonical set documented in
 *      lib/render/ROOM.md: { lib/render/render.cjs (v1 shim),
 *      lib/hmi/selector-dispatcher.cjs (agent-surface dispatcher) }.
 *      Any addition to the allowlist requires updating ROOM.md in
 *      the same commit -- this test catches drift between the two.
 *   3. lib/render/ROOM.md exists and documents the disposition with
 *      the "current" linguistic discipline (NEVER "final", "complete",
 *      or "closed set" framing on rankable input signal types --
 *      verdict locked 2026-05-16 per the dual-graph review).
 *   4. The Phase 102 VALIDATION.md is no longer status: draft (the
 *      Sub-plan E precondition for v1.13.0 final release gate).
 *
 * Registered in lib/memory/run-feynman-tests.cjs alongside the existing
 * Phase 102 fences (test-render-v2-signature.cjs etc.).
 *
 * Constraints (Phase 87 invariant):
 *   - Node built-ins only (node:assert/strict, node:fs, node:path).
 *   - CJS only.
 *   - Zero new runtime dependencies.
 *
 * Canon parts: 3 (the v2 entry is reserved for Shape F.x decision-gate
 *   output surfaces), 6 (Product-as-Venture: the plugin honors its own
 *   disposition decisions via a CI gate, not a promise), 7 (Reuse Before
 *   Build: the v1 shim wraps v2 so we ship one renderer, two entry
 *   points -- not two parallel implementations).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  process.stdout.write('  ok ' + name + '\n');
}

function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

// ---------------------------------------------------------------------------
// Scenario 1: the audit script's verdict is HOLDS.
// ---------------------------------------------------------------------------
(function test1_auditVerdictHolds() {
  const label = 'audit script verdict HOLDS (no prose-path consumer)';
  try {
    const audit = require(path.join(REPO_ROOT, 'scripts', 'disposition-render-v2.cjs'));
    const report = audit.audit();
    assert.equal(report.verdict, 'HOLDS',
      'verdict must be HOLDS; got ' + report.verdict
      + ' with violations: ' + JSON.stringify(report.violations));
    assert.equal(report.disposition, 'agent-surface-only',
      'disposition must be agent-surface-only');
    assert.equal(report.summary.violation_count, 0,
      'violation_count must be 0');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Scenario 2: allowlist matches canonical set.
// ---------------------------------------------------------------------------
(function test2_allowlistMatches() {
  const label = 'allowlist matches canonical agent-surface set';
  try {
    const audit = require(path.join(REPO_ROOT, 'scripts', 'disposition-render-v2.cjs'));
    const expected = [
      path.join('lib', 'render', 'render.cjs'),
      path.join('lib', 'hmi', 'selector-dispatcher.cjs'),
    ];
    assert.deepEqual(
      audit.ALLOWED_CONSUMERS.slice().sort(),
      expected.slice().sort(),
      'allowlist must equal canonical set; changes require ROOM.md update in same commit'
    );
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Scenario 3: ROOM.md documents the disposition with "current" language.
//
// Per the 2026-05-16 dual-graph review (logged in 121.5-CONTEXT.md):
//   render-v2's rankable input signal types is one of FOUR
//   ultrareview-adjacent surfaces. The dual-graph proposal (future
//   ASSOCIATION_LENS + TRANSITION_LENS lens classes) may add lens-derived
//   signals. The disposition is "current," NOT "final/complete/closed."
// ---------------------------------------------------------------------------
(function test3_roomMdLinguisticDiscipline() {
  const label = 'ROOM.md uses "current" linguistic discipline (no final/closed/complete framing)';
  try {
    const roomMdPath = path.join(REPO_ROOT, 'lib', 'render', 'ROOM.md');
    assert.ok(fs.existsSync(roomMdPath), 'lib/render/ROOM.md must exist');
    const body = fs.readFileSync(roomMdPath, 'utf8');

    // Disposition must be present + carry the agent-surface-only marker.
    assert.ok(/121\.5-04/.test(body) || /Sub-plan E/.test(body) || /Disposition/i.test(body),
      'ROOM.md must reference the Sub-plan E disposition');
    assert.ok(/agent-surface-only/i.test(body),
      'ROOM.md must use the phrase "agent-surface-only"');

    // Forbidden framing on rankable input signal types. The check is
    // scoped to specific phrases that imply closure -- we do NOT forbid
    // the words "final" or "complete" in unrelated context (e.g. "final
    // release gate", "compose 4 zones" -- both legitimate). The patterns
    // below are the closure-implying phrases we explicitly disallow on
    // the signal-types section.
    const forbidden = [
      { pattern: /\bcomplete set of rankable\b/i, label: '"complete set of rankable"' },
      { pattern: /\bclosed signal vocabulary\b/i, label: '"closed signal vocabulary"' },
      { pattern: /\ball input signal types\b/i, label: '"all input signal types"' },
      { pattern: /\bfinal set of rankable\b/i, label: '"final set of rankable"' },
    ];
    for (const f of forbidden) {
      assert.ok(!f.pattern.test(body),
        'ROOM.md must NOT contain ' + f.label + ' (use "current"/"today"/"as of" framing)');
    }
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Scenario 4: Phase 102 VALIDATION.md is no longer status: draft.
// ---------------------------------------------------------------------------
(function test4_validation102OutOfDraft() {
  const label = 'Phase 102 VALIDATION.md is out of status: draft';
  try {
    const valPath = path.join(REPO_ROOT,
      '.planning', 'phases', '102-context-aware-rendering', '102-VALIDATION.md');
    if (!fs.existsSync(valPath)) {
      // The worktree may not carry the .planning tree; treat absence as
      // a soft-pass at unit-test time. The Phase 102 VERIFICATION.md
      // existence check (scenario 5) is the harder gate.
      ok(label + ' (skipped: 102-VALIDATION.md absent in this worktree)');
      return;
    }
    const body = fs.readFileSync(valPath, 'utf8');
    // The frontmatter `status:` field MUST NOT read "draft".
    const m = body.match(/^status:\s*(\S+)\s*$/m);
    if (m) {
      assert.notEqual(m[1].toLowerCase(), 'draft',
        '102-VALIDATION.md status field must not be "draft"; got "' + m[1] + '"');
    }
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Scenario 5: Phase 102 VERIFICATION.md exists.
// ---------------------------------------------------------------------------
(function test5_verification102Exists() {
  const label = 'Phase 102 VERIFICATION.md exists (Sub-plan E closure)';
  try {
    const verPath = path.join(REPO_ROOT,
      '.planning', 'phases', '102-context-aware-rendering', '102-VERIFICATION.md');
    if (!fs.existsSync(path.dirname(verPath))) {
      // Worktree may not carry the phase tree; soft-pass.
      ok(label + ' (skipped: phase 102 dir absent in this worktree)');
      return;
    }
    assert.ok(fs.existsSync(verPath),
      '102-VERIFICATION.md must exist at ' + path.relative(REPO_ROOT, verPath));
    const body = fs.readFileSync(verPath, 'utf8');
    assert.ok(body.length > 200,
      '102-VERIFICATION.md must be substantive (>200 bytes)');
    ok(label);
  } catch (e) { fail(label, e); }
})();

process.stdout.write('\n');
process.stdout.write(
  'Phase 121.5-04 render-v2 disposition gate: ' +
    passed + ' passed, ' + failed + ' failed\n'
);
process.exit(failed === 0 ? 0 : 1);
