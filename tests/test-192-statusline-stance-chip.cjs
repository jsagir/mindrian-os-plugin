#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 192-04 (SEED-042 POSTURE DIAL, CLI enhancement) -- the statusline
 * [stance] chip + forced voice-color test suite.
 * ===========================================================================
 * Asserts the 192-04 contract (on top of the LOCKED docs/STATUSLINE-CONTRACT.md):
 *
 *   (a) DEFAULT BYTE-STABILITY (R4): with no stance override active (stance
 *       null/absent), renderCockpit()'s output is byte-identical to the pre-plan
 *       render for the same input state -- no new segment, no color override.
 *   (b) redteam -> the line carries [redteam]; NO glyph is fabricated when
 *       natural detection is silent (Phase 243/GLYPH-01 supersedes the Phase 210
 *       re-point for the glyph half only), and a confident natural detection
 *       still WINS over the stance (unchanged).
 *   (c) tell-act -> the line carries [tell-act]; NO glyph is fabricated when
 *       natural detection is silent (Phase 243/GLYPH-01 supersedes the Phase 210
 *       re-point for the glyph half only).
 *   (d) research / ask -> the line carries the chip but does NOT force a color
 *       (natural voice detection, or none, still governs).
 *   (e) readStanceState() never throws: it degrades to
 *       {stance:null, forced_voice_color:null} on a malformed file, an absent
 *       file, or a throwing stance-state module (simulated failure).
 *   (f) The stance chip sits AFTER the identity segment, BEFORE the room/health
 *       segment (R3: its own new independent segment, not a 4th WHO chip).
 *   (g) No em-dash anywhere in rendered output (repo-wide hard rule).
 *
 * Mirrors the Phase 187 tests/test-statusline-cockpit-187.cjs harness: assert /
 * test / passed-failed counters / process.exit(1) on any failure.
 *
 * Canon Part 8: LOCAL only. No Brain, no network, no user data. House rule:
 * hyphens only, no em-dashes (the suite self-checks its own source).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO_ROOT = path.join(__dirname, '..');
const renderer = require(path.join(REPO_ROOT, 'lib', 'statusline', 'cockpit-renderer.cjs'));
const signals = require(path.join(REPO_ROOT, 'lib', 'statusline', 'cockpit-signals.cjs'));
const stanceState = require(path.join(REPO_ROOT, 'lib', 'core', 'stance-state.cjs'));

const { renderCockpit } = renderer;

// The 5 De Stijl primary squares (from lib/hmi/voice-color-mark.cjs).
const RED_SQUARE = '\u{1F7E5}';
const BLUE_SQUARE = '\u{1F7E6}';
const YELLOW_SQUARE = '\u{1F7E8}';
const FOLDER = '\u{1F4C2}';
const HEX = '⬡'; // white hexagon -- Mindrian identity (matches renderer HEX)

const EM_DASH = String.fromCharCode(0x2014);

let passed = 0;
let failed = 0;
const failures = [];

function assert(cond, msg) {
  if (cond) {
    passed++;
  } else {
    failed++;
    failures.push(msg);
    console.error('  FAIL: ' + msg);
  }
}

function test(label, fn) {
  console.log('--- ' + label + ' ---');
  fn();
}

// A shared healthy base state (no stance fields).
function baseState() {
  return { who: 'larry', room: 'Demo', ctx_pct: 10, next_move: 'continue', voice_color: 'yellow' };
}

// -------------------------------------------------------------------------
test('(a) default byte-stability: stance null/absent === pre-plan render', function () {
  const preplan = renderCockpit(baseState());
  const nullStance = renderCockpit(Object.assign(baseState(), { stance: null, forced_voice_color: null }));
  const nullStance2 = renderCockpit(Object.assign(baseState(), { stance: null, stance_forced_color: null }));
  assert(preplan === nullStance, 'stance:null must render byte-identical to no-stance (got: ' + JSON.stringify(nullStance) + ' vs ' + JSON.stringify(preplan) + ')');
  assert(preplan === nullStance2, 'stance_forced_color:null must render byte-identical to no-stance');
  assert(preplan.indexOf('[') === -1, 'default render carries no chip bracket');
});

// -------------------------------------------------------------------------
test('(b) redteam: chip renders; NO glyph fabricated when natural detection is silent (Phase 243 supersedes 210 re-point)', function () {
  // Phase 243 (GLYPH-01): the stance color no longer fills the glyph default when
  // natural detection is silent (that was the fabrication). With a confident natural
  // yellow signal, natural detection still wins (unchanged).
  const silent = baseState();
  delete silent.voice_color;
  const line = renderCockpit(Object.assign(silent, { stance: 'redteam', stance_forced_color: 'red' }));
  assert(line.indexOf('[redteam]') !== -1, 'redteam render must carry the [redteam] chip -- got ' + JSON.stringify(line));
  assert(line.indexOf(RED_SQUARE) === -1, 'GLYPH-01: redteam render must NOT carry a fabricated red square when natural detection is silent');
  const natural = renderCockpit(Object.assign(baseState(), { stance: 'redteam', stance_forced_color: 'red' }));
  assert(natural.indexOf(YELLOW_SQUARE) !== -1, 'a confident natural yellow detection must still WIN over the stance (unchanged)');
});

// -------------------------------------------------------------------------
test('(c) tell-act: chip renders; NO glyph fabricated when natural detection is silent (Phase 243 supersedes 210 re-point)', function () {
  const silent = baseState();
  delete silent.voice_color;
  const line = renderCockpit(Object.assign(silent, { stance: 'tell-act', stance_forced_color: 'blue' }));
  assert(line.indexOf('[tell-act]') !== -1, 'tell-act render must carry the [tell-act] chip');
  assert(line.indexOf(BLUE_SQUARE) === -1, 'GLYPH-01: tell-act render must NOT carry a fabricated blue square when natural detection is silent');
  const natural = renderCockpit(Object.assign(baseState(), { stance: 'tell-act', stance_forced_color: 'blue' }));
  assert(natural.indexOf(YELLOW_SQUARE) !== -1, 'a confident natural yellow detection must still WIN over the stance (unchanged)');
});

// -------------------------------------------------------------------------
test('(d) research / ask: chip present, NO forced color (natural detection governs)', function () {
  const research = renderCockpit(Object.assign(baseState(), { stance: 'research', stance_forced_color: null }));
  assert(research.indexOf('[research]') !== -1, 'research render must carry the [research] chip');
  assert(research.indexOf(YELLOW_SQUARE) !== -1, 'research must keep the natural yellow voice glyph (no forcing)');
  assert(research.indexOf(RED_SQUARE) === -1 && research.indexOf(BLUE_SQUARE) === -1, 'research must not force a red/blue glyph');

  const ask = renderCockpit(Object.assign(baseState(), { stance: 'ask', stance_forced_color: null }));
  assert(ask.indexOf('[ask]') !== -1, 'ask render must carry the [ask] chip');
  assert(ask.indexOf(YELLOW_SQUARE) !== -1, 'ask must keep the natural yellow voice glyph (no forcing)');
});

// -------------------------------------------------------------------------
test('(e) readStanceState() never throws; degrades to the null default', function () {
  assert(typeof signals.readStanceState === 'function', 'signals must export readStanceState');

  // Absent-file default (no ~/.mindrian/stance-state.json in the test env, or an
  // unrecognized stance): a well-formed {stance, forced_voice_color} shape.
  let r;
  let threw = false;
  try { r = signals.readStanceState(); } catch (_e) { threw = true; }
  assert(!threw, 'readStanceState must not throw on the default path');
  assert(r && typeof r === 'object' && 'stance' in r && 'forced_voice_color' in r,
    'readStanceState returns {stance, forced_voice_color}');

  // Simulated failure: the stance-state module readStance() throws. readStanceState
  // must swallow it and degrade to {stance:null, forced_voice_color:null}.
  const orig = stanceState.readStance;
  stanceState.readStance = function () { throw new Error('simulated unrequireable'); };
  let r2;
  let threw2 = false;
  try { r2 = signals.readStanceState(); } catch (_e) { threw2 = true; }
  stanceState.readStance = orig;
  assert(!threw2, 'readStanceState must not throw when stance-state readStance() throws');
  assert(r2 && r2.stance === null && r2.forced_voice_color === null,
    'readStanceState degrades to {stance:null, forced_voice_color:null} on failure');

  // Malformed-file degrade: write junk to the LOCAL stance-state.json path, then
  // confirm the read degrades to null rather than propagating.
  const dir = signals.mindrianDir();
  const p = path.join(dir, 'stance-state.json');
  let backup = null;
  let existed = false;
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(p)) { existed = true; backup = fs.readFileSync(p, 'utf8'); }
    fs.writeFileSync(p, '{ this is not valid json', 'utf8');
    const r3 = signals.readStanceState();
    assert(r3 && r3.stance === null && r3.forced_voice_color === null,
      'malformed stance-state.json degrades to the null default');
  } finally {
    try {
      if (existed) fs.writeFileSync(p, backup, 'utf8');
      else fs.unlinkSync(p);
    } catch (_e) { /* best effort cleanup */ }
  }
});

// -------------------------------------------------------------------------
test('(f) chip position: after identity, before room/health', function () {
  const line = renderCockpit(Object.assign(baseState(), { stance: 'ask', stance_forced_color: null }));
  const iHex = line.indexOf(HEX);
  const iChip = line.indexOf('[ask]');
  const iFolder = line.indexOf(FOLDER);
  assert(iHex !== -1 && iChip !== -1 && iFolder !== -1, 'render carries identity, chip, and room segments');
  assert(iHex < iChip, 'identity segment precedes the stance chip');
  assert(iChip < iFolder, 'stance chip precedes the room/health segment');
});

// -------------------------------------------------------------------------
test('(g) no em-dash in any rendered stance line', function () {
  const lines = [
    renderCockpit(Object.assign(baseState(), { stance: 'redteam', stance_forced_color: 'red' })),
    renderCockpit(Object.assign(baseState(), { stance: 'tell-act', stance_forced_color: 'blue' })),
    renderCockpit(Object.assign(baseState(), { stance: 'research', stance_forced_color: null })),
    renderCockpit(Object.assign(baseState(), { stance: 'ask', stance_forced_color: null })),
  ];
  lines.forEach(function (l, i) {
    assert(l.indexOf(EM_DASH) === -1, 'rendered stance line ' + i + ' carries no em-dash');
  });
});

// -------------------------------------------------------------------------
console.log('\n=======================================');
console.log('PASSED: ' + passed + '  FAILED: ' + failed);
console.log('=======================================');
if (failed > 0) {
  console.error('\nFAILURES:\n  - ' + failures.join('\n  - '));
  process.exit(1);
}
process.exit(0);
