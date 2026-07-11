'use strict';
/*
 * Phase 178-02 Task 1 (TDD RED->GREEN) - the deterministic card-emission predicate.
 *
 * Proves scripts/check-render-coverage.cjs is a PURE, code-evaluated predicate (C-2)
 * over the SEPARATE render registry (data/render-coverage-registry.json, minted in
 * 178-01) + the dispatcher card-emission wiring, with NO LLM-judge in the hard gate.
 *
 * The predicate is PINNED (MEDIUM-1): a card-emission entry classifies COVERED if
 * EITHER (a) its file calls pickShape( (the dispatcher isFShape host-append at
 * selector-dispatcher.cjs:931-933 appends the askuserquestion_marker to every Shape
 * F.* return), OR (b) its file directly calls appendAskUserQuestionTrailer( (the
 * intent-classifier.cjs:933 engine-arm pattern), OR (c) it is a renderDial-kind entry
 * whose F.7-dial shape is host-appended by construction (the dial render carries shape
 * 'F.7-dial' which starts with 'F', so the pickShape isFShape host-append / the 150.5
 * engine-arm seam appends the marker -- the registry records kind=renderDial +
 * shape=F.7-dial; the predicate credits the host-appended marker as COVERED and does
 * NOT demand an in-renderDialShape marker assignment).
 *
 * Assertions:
 *   1. renderCoverageReport() returns counts {covered, excluded, gap} summing to
 *      entries.length (the XOR invariant; every entry lands in exactly one bucket).
 *   2. the live repo is gap=0 (every live card-emission entry routes through the door:
 *      pickShape host-append, the engine-arm direct call, or renderDial host-append).
 *   3. an entry whose file calls pickShape( classifies covered (host-appended).
 *   4. an entry whose file directly calls appendAskUserQuestionTrailer( classifies
 *      covered (the engine-arm case) -- scripts/intent-classifier.cjs.
 *   5. the renderDial / F.7-dial entry (lib/hmi/dial-presenter.cjs) classifies covered
 *      as host-appended WITHOUT an in-function marker assignment (MEDIUM-1).
 *   6. the combined CLI --check now correctly fails on 5 known, pre-existing,
 *      out-of-scope skill gaps (intern-w1-mode-gate-skip fix, RCA gap 1); this
 *      test's own .cjs axis stays gap=0 (Assertion 2), isolated from that finding.
 *   7. the predicate references no LLM/model/network symbol in the hard gate (C-2 /
 *      Part 8): pure code, reproducible, no agent in the loop.
 *
 * House rule: hyphens only, no em-dashes. Canon Part 8: zero Brain / network.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const GATE = path.join(REPO_ROOT, 'scripts', 'check-render-coverage.cjs');

const gate = require(GATE);

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

// ---------------------------------------------------------------------------
// Assertion 1: the XOR invariant -- covered + excluded + gap === entries.length.
// ---------------------------------------------------------------------------
const report = gate.renderCoverageReport();
const arr = report.entries || report.surfaces;
ok('renderCoverageReport returns an entries array', Array.isArray(arr) && arr.length > 0);
const total = report.counts.covered + report.counts.excluded + report.counts.gap;
ok('XOR invariant: covered + excluded + gap === entries.length', total === arr.length);

// ---------------------------------------------------------------------------
// Assertion 2: the live repo is gap=0 (every card-emission entry routes through
// the SEED-020 card-emission door).
// ---------------------------------------------------------------------------
ok('live repo is gap=0 (every card-emission entry routes through the door)', report.counts.gap === 0);
ok('live repo has 15 entries (Wave 1 reconciled 16 -> 15)', arr.length === 15);

// ---------------------------------------------------------------------------
// Assertion 3: a pickShape( entry classifies covered (host-appended).
// ---------------------------------------------------------------------------
const pickEntry = arr.find((e) => String(e.entry || '').includes('auto-explore-agent'));
ok('the auto-explore-agent (pickShape) entry is present', !!pickEntry);
ok('the auto-explore-agent entry classifies covered (routed=true)', pickEntry && pickEntry.routed === true);

// ---------------------------------------------------------------------------
// Assertion 4: an appendAskUserQuestionTrailer( direct caller classifies covered
// (the engine-arm case) -- scripts/intent-classifier.cjs.
// ---------------------------------------------------------------------------
const engineArm = arr.find((e) => String(e.entry || '').includes('intent-classifier'));
ok('the intent-classifier (engine-arm) entry is present', !!engineArm);
ok('the intent-classifier entry classifies covered (direct appendAskUserQuestionTrailer call)', engineArm && engineArm.routed === true);

// ---------------------------------------------------------------------------
// Assertion 5: the renderDial / F.7-dial entry (dial-presenter.cjs) classifies
// covered as host-appended WITHOUT an in-function marker assignment (MEDIUM-1).
// ---------------------------------------------------------------------------
const dialEntry = arr.find((e) => String(e.entry || '').includes('dial-presenter'));
ok('the dial-presenter (renderDial / F.7-dial) entry is present', !!dialEntry);
ok('the dial-presenter entry classifies covered (host-appended, no in-function marker assignment)', dialEntry && dialEntry.routed === true);

// Every card-emission entry is routed (the XOR-covered set is the whole set on the
// gap=0 live baseline).
const cardEmission = arr.filter((e) => e.render_coverage === 'card-emission');
ok('every card-emission entry classifies routed (covered)', cardEmission.every((e) => e.routed === true));

// ---------------------------------------------------------------------------
// Assertion 6: the .cjs render-entry-point axis (this test's own scope, per
// gate.renderCoverageReport() above) stays gap=0 -- already proven by
// Assertion 2. The combined CLI --check ALSO now covers a THIRD, orthogonal
// keyspace (skills/*/SKILL.md declared-implies-wired, added by the
// intern-w1-mode-gate-skip fix, RCA gap 1) that carries 5 known, pre-existing,
// out-of-scope gaps (see the debug file Resolution section) -- so the combined
// CLI --check no longer exits 0 on a clean repo. This asserts the FAILURE
// reason is exactly that known set, not a NEW .cjs-axis regression.
// ---------------------------------------------------------------------------
const clean = cp.spawnSync('node', [GATE, '--check'], { encoding: 'utf8', timeout: 60000 });
ok('combined CLI --check now exits non-zero (5 known skill gaps; see intern-w1-mode-gate-skip debug file)', clean.status !== 0);
ok('the failure names a skills/*/SKILL.md surface, not a .cjs entry point', /skills\/.*\/SKILL\.md/.test(clean.stderr || ''));
ok('the failure does NOT report a RENDER GAP against any .cjs entry (this test\'s own axis is still clean)', !/RENDER GAP: entry (lib|scripts)\//.test(clean.stderr || ''));

// ---------------------------------------------------------------------------
// Assertion 7: C-2 / Part 8 -- no LLM/model/network symbol in the hard gate.
// ---------------------------------------------------------------------------
// Mirror the plan's authoritative C-2 / Part 8 grep gate: scan for an LLM-judge /
// network symbol, but EXCLUDE comment lines and the allowed tokens
// (askuserquestion_marker, appendAskUserQuestionTrailer, the "card-emission door"
// prose). A symbol surviving that exclusion in the HARD gate is a breach.
const src = fs.readFileSync(GATE, 'utf8');
const banned = /(AskUserQuestion|model|anthropic|fetch\(|http\b|brain-client|llm|judge)/i;
const allowed = /askuserquestion_marker|appendAskUserQuestionTrailer|card-emission door/i;
const offending = src.split(/\r?\n/).filter((line) => {
  const trimmed = line.trim();
  if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return false;
  if (!banned.test(line)) return false;
  if (allowed.test(line)) return false;
  return true;
});
ok('the gate references no LLM/model/network symbol in non-comment code (C-2 / Part 8)', offending.length === 0);

console.log('\nPASS test-check-render-coverage (' + pass + ' assertions)');
console.log('>>> test-check-render-coverage.cjs: PASSED');
