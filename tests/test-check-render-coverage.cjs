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
 *   6. --check exits 0 on the gap=0 live baseline and prints the OK line.
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
// Assertion 6: --check exits 0 on the gap=0 live baseline + prints the OK line.
// ---------------------------------------------------------------------------
const clean = cp.spawnSync('node', [GATE, '--check'], { encoding: 'utf8', timeout: 60000 });
ok('--check exits 0 on the gap=0 live baseline', clean.status === 0);
ok('--check prints the OK line', /render-coverage: OK/.test(clean.stdout || ''));

// ---------------------------------------------------------------------------
// Assertion 7: C-2 / Part 8 -- no LLM/model/network symbol in the hard gate.
// ---------------------------------------------------------------------------
const src = fs.readFileSync(GATE, 'utf8');
const banned = /\b(anthropic|brain-client|llm)\b|fetch\s*\(|require\s*\(\s*['"]node:https?['"]/i;
ok('the gate references no LLM/model/network symbol (C-2 / Part 8)', !banned.test(src));

console.log('\nPASS test-check-render-coverage (' + pass + ' assertions)');
console.log('>>> test-check-render-coverage.cjs: PASSED');
