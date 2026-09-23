'use strict';
// Phase 357-07 (D-08a amended by R-F) -- the F1_DIAL_CHROME_TOKENS strip in
// lib/core/gate-relevance.cjs, extending the GATE_BOILERPLATE_TOKENS
// precedent (893cee043) to F.1 dial chrome. GATE357-05.
//
// Task 2 behaviors (see 357-07-PLAN.md):
//   A. a human turn whose ONLY shared token with an F.1 subject is 'gate'
//      (F.1 dial chrome) now reads irrelevant (was relevant before).
//   B. a human turn sharing one non-chrome content token ('briefing') with
//      the same subject still reads relevant.
//   C. the R-C shape (overlap on the chrome word 'prior' PLUS one 10-char
//      content token) still reads relevant -- its label is ruled at plan 08.
//   D. a subject made only of chrome words still reads relevant (empty
//      gateTokens -> conservative true, unchanged).
//   E. the F.8 GATE_BOILERPLATE_TOKENS behavior (chrome stripped, a real
//      candidate room name survives) is unaffected by this change.
//   F. the drift leg: every DIAL_STATIC_LITERALS entry appears verbatim in
//      lib/hmi/dial-presenter.cjs, and the tokens derived from those
//      literals (via the exported subjectTokens) minus GATE_BOILERPLATE_TOKENS
//      deep-equal F1_DIAL_CHROME_TOKENS exactly (no frequency-derived
//      extras).
//   G. renderDial exercised for mode_a / mode_b / tier_0: every token in the
//      rendered text, minus the context label and the supplied row label, is
//      a subset of F1_DIAL_CHROME_TOKENS union GATE_BOILERPLATE_TOKENS.
//   H. corpus legs on HEAD (post-fix): live-2026-09-23-02 reads OK; every
//      238 Half B (`:s2`/`:s3`) entry still blocks; 0 parity mismatches.
//
// Test hygiene: TYPESAFE_API_KEY is stripped before any spawn; every replay
// spawn runs under a fetch-thrower preload (D-13 backstop) and a redirected
// HOME; NET_ATTEMPTS is asserted 0 at the end. No em-dashes (hyphens only).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

delete process.env.TYPESAFE_API_KEY;

const REPO = path.join(__dirname, '..');
const gateRelevance = require(path.join(REPO, 'lib', 'core', 'gate-relevance.cjs'));
const dialPresenter = require(path.join(REPO, 'lib', 'hmi', 'dial-presenter.cjs'));
const corpusLoader = require(path.join(REPO, 'scripts', 'card-fire-replay-corpus.cjs'));
const REPLAY_SCRIPT = path.join(REPO, 'scripts', 'replay-card-fire.cjs');
const DIAL_PRESENTER_SRC = fs.readFileSync(path.join(REPO, 'lib', 'hmi', 'dial-presenter.cjs'), 'utf8');

console.log('test-357-f1-chrome');

let failures = 0;
let total = 0;
function ok(desc, fn) {
  total += 1;
  try {
    fn();
    console.log('  ok   ' + desc);
  } catch (e) {
    failures += 1;
    console.log('  FAIL ' + desc + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}

// ---------------------------------------------------------------------
// Network-attempt-detector preload (D-13 backstop), shared by every spawn.
// ---------------------------------------------------------------------
let netAttempts = 0;
const preloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f1chrome357-preload-'));
const preloadPath = path.join(preloadDir, 'network-attempt-detector.cjs');
fs.writeFileSync(
  preloadPath,
  "'use strict';\n" +
  'globalThis.fetch = function () {\n' +
  "  process.stderr.write('NETWORK_ATTEMPT_357\\n');\n" +
  "  throw new Error('NETWORK_ATTEMPT_357');\n" +
  '};\n'
);

function spawnReplay(args) {
  const childHome = fs.mkdtempSync(path.join(os.tmpdir(), 'f1chrome357-home-'));
  const env = Object.assign({}, process.env);
  delete env.TYPESAFE_API_KEY;
  env.HOME = childHome;
  env.NODE_OPTIONS = ((env.NODE_OPTIONS || '') + ' --require ' + preloadPath).trim();
  const res = spawnSync(process.execPath, [REPLAY_SCRIPT].concat(args || []), {
    cwd: REPO,
    env: env,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if ((res.stderr || '').indexOf('NETWORK_ATTEMPT_357') !== -1) netAttempts += 1;
  let json = null;
  try { json = JSON.parse(res.stdout); } catch (_e) { json = null; }
  return { status: res.status, json: json, stdout: res.stdout, stderr: res.stderr };
}

// =======================================================================
// Behavior A: chrome-only overlap ('gate') now reads irrelevant.
// =======================================================================
const F1_SUBJECT_TEXT = '■ dev room - REACH - decision gate\n' +
  '▼ LOCAL dev room (offline) / BRAIN (offline) / SIGNAL (none this turn)\n' +
  '→ Choose next reach:\n' +
  '▷ memory_artifact:research/quarterly-briefing-mirror ........ 42%\n' +
  'top-1 of 3';

ok("Behavior A: a human turn whose only shared token with an F.1 subject is 'gate' (chrome) is now irrelevant", function () {
  const userText = 'quick gate check on the open thread';
  assert.equal(gateRelevance.gateTopicallyRelevant(userText, F1_SUBJECT_TEXT), false);
});

ok("Behavior B: a human turn sharing a non-chrome content token ('briefing') with the same subject stays relevant", function () {
  const userText = 'can you check the briefing rollout status';
  assert.equal(gateRelevance.gateTopicallyRelevant(userText, F1_SUBJECT_TEXT), true);
});

// =======================================================================
// Behavior C: the R-C shape -- overlap on chrome ('prior') PLUS one 10-char
// content token still reads relevant.
// =======================================================================
ok('Behavior C (R-C shape): overlap on the chrome word prior plus a 10-char content token still reads relevant', function () {
  const gateText = 'Investigate a prior reach - a prior governance thread awaiting another review.';
  const userText = 'is the prior governance thread still moving forward';
  assert.equal(gateRelevance.gateTopicallyRelevant(userText, gateText), true);
});

// =======================================================================
// Behavior D: a subject made only of chrome words stays relevant (empty
// gateTokens -> conservative true, unchanged).
// =======================================================================
ok('Behavior D: a subject made only of chrome words stays relevant (empty gateTokens, conservative true)', function () {
  const gateText = 'Choose next reach: gate decision local brain signal none turn cold prior offline ranked';
  const userText = 'totally unrelated inquiry about something else entirely';
  assert.equal(gateRelevance.gateTopicallyRelevant(userText, gateText), true);
  assert.equal(gateRelevance.gateSubjectTokens(gateText).size, 0);
});

// =======================================================================
// Behavior E: the F.8 GATE_BOILERPLATE_TOKENS behavior is unaffected -- the
// chrome strip and a real candidate room name both survive as before.
// =======================================================================
ok('Behavior E: F.8 boilerplate strip unaffected -- chrome gone, a real candidate room name still matches', function () {
  const gateText = 'Bind this session to a room? rethinking-mindrianos - Just talk (no room) - Start a new room';
  const userText = 'lets go with rethinking-mindrianos for this';
  assert.equal(gateRelevance.gateTopicallyRelevant(userText, gateText), true);
  const stripped = gateRelevance.gateSubjectTokens(gateText);
  assert.equal(stripped.has('bind'), false);
  assert.equal(stripped.has('session'), false);
  assert.equal(stripped.has('room'), false);
  assert.equal(stripped.has('talk'), false);
  assert.equal(stripped.has('start'), false);
  assert.equal(stripped.has('rethinking'), true);
  assert.equal(stripped.has('mindrianos'), true);
});

// =======================================================================
// Behavior F: the drift leg -- every DIAL_STATIC_LITERALS entry appears
// verbatim in dial-presenter.cjs; the derived token set (via the exported
// subjectTokens) minus GATE_BOILERPLATE_TOKENS deep-equals
// F1_DIAL_CHROME_TOKENS exactly.
// =======================================================================
// Copied verbatim from lib/hmi/dial-presenter.cjs (PROMPT_LINE, FRAMING_MODE_B,
// FRAMING_TIER_0, the header suffix, the context-line literals, the localBit /
// brainBit ternary literals, and the plain gauge string). This is a SEPARATE,
// independently-authored list from gate-relevance.cjs's own F1_DIAL_CHROME_TOKENS
// -- the whole point of the leg is to catch DRIFT between the two.
const DIAL_STATIC_LITERALS = Object.freeze([
  'Choose next reach:',
  'No recommendation - offline. You pick.',
  'New room - nothing to rank yet. Start anywhere.',
  ' - REACH - decision gate',
  ' LOCAL ',
  ' / BRAIN ',
  ' / SIGNAL ',
  'ranked',
  'offline',
  'cold',
  'prior',
  '(offline)',
  '(none this turn)',
  'Investigate | Blend | Insight',
]);

ok('Behavior F.1: every DIAL_STATIC_LITERALS entry appears verbatim in lib/hmi/dial-presenter.cjs', function () {
  for (const literal of DIAL_STATIC_LITERALS) {
    assert.equal(
      DIAL_PRESENTER_SRC.indexOf(literal) !== -1,
      true,
      'missing verbatim in dial-presenter.cjs: ' + JSON.stringify(literal)
    );
  }
});

ok('Behavior F.2 (drift): derived tokens minus GATE_BOILERPLATE_TOKENS deep-equal F1_DIAL_CHROME_TOKENS', function () {
  assert.equal(typeof gateRelevance.subjectTokens, 'function', 'subjectTokens must be exported');
  const derived = new Set();
  for (const literal of DIAL_STATIC_LITERALS) {
    for (const tok of gateRelevance.subjectTokens(literal)) derived.add(tok);
  }
  for (const tok of gateRelevance.GATE_BOILERPLATE_TOKENS) derived.delete(tok);
  const derivedSorted = Array.from(derived).sort();
  const chromeSorted = Array.from(gateRelevance.F1_DIAL_CHROME_TOKENS).sort();
  assert.deepStrictEqual(derivedSorted, chromeSorted);
});

ok('Behavior F.3: F1_DIAL_CHROME_TOKENS is frozen, carries no frequency-derived extras, and includes gate', function () {
  const f = gateRelevance.F1_DIAL_CHROME_TOKENS;
  assert.equal(f instanceof Set, true);
  assert.equal(Object.isFrozen(f), true);
  for (const w of ['research', 'claim', 'back', 'bring', 'spin', 'worked']) {
    assert.equal(f.has(w), false, w + ' is frequency-derived, not a static literal, and must be absent');
  }
  assert.equal(f.has('gate'), true);
});

// =======================================================================
// Behavior G: renderDial exercised for mode_a / mode_b / tier_0. Every
// rendered token, minus the context label and the supplied row label, is a
// subset of F1_DIAL_CHROME_TOKENS union GATE_BOILERPLATE_TOKENS.
// =======================================================================
function tokensOf(text) {
  return gateRelevance.subjectTokens(text);
}

function assertRenderIsAllChrome(tierMode) {
  const reachList = {
    tier_mode: tierMode,
    total_count: 1,
    reaches: [{
      reach_id: 'test-reach',
      command_slug: 'widget-alpha',
      score: 0.8,
      recommended: true,
      evidence_count: 3,
    }],
  };
  const rendered = dialPresenter.renderDial(reachList, {
    slotContext: { header_room: 'test' },
  });
  const rendered_tokens = tokensOf(rendered.text);
  const excluded = new Set();
  for (const t of tokensOf('test')) excluded.add(t); // context label
  for (const t of tokensOf('widget-alpha')) excluded.add(t); // supplied row label
  const chromeUnion = new Set(gateRelevance.F1_DIAL_CHROME_TOKENS);
  for (const t of gateRelevance.GATE_BOILERPLATE_TOKENS) chromeUnion.add(t);
  const leftover = [];
  for (const t of rendered_tokens) {
    if (excluded.has(t)) continue;
    if (!chromeUnion.has(t)) leftover.push(t);
  }
  assert.deepStrictEqual(leftover, [], tierMode + ' rendered non-chrome, non-label tokens: ' + JSON.stringify(leftover));
}

ok('Behavior G.1: renderDial(mode_a) -- every token is chrome, the context label, or the supplied row label', function () {
  assertRenderIsAllChrome('mode_a');
});
ok('Behavior G.2: renderDial(mode_b) -- every token is chrome, the context label, or the supplied row label', function () {
  assertRenderIsAllChrome('mode_b');
});
ok('Behavior G.3: renderDial(tier_0) -- every token is chrome, the context label, or the supplied row label', function () {
  assertRenderIsAllChrome('tier_0');
});

// =======================================================================
// Behavior H: corpus legs on HEAD (post-fix) -- live-2026-09-23-02 OK, every
// 238 Half B (:s2/:s3) entry still blocks, 0 parity mismatches.
// =======================================================================
ok('Behavior H: corpus legs -- live-02 OK, every 238 Half B entry still blocks, 0 parity mismatches', function () {
  const loaded = corpusLoader.loadCorpus();
  const halfBIds = loaded.entries
    .filter(function (e) { return /^238:.*:s[23]$/.test(e.id); })
    .map(function (e) { return e.id; });
  assert.equal(halfBIds.length > 0, true, 'the 238 Half B legs must be present in the corpus');
  const ids = ['live-2026-09-23-02'].concat(halfBIds);
  const res = spawnReplay(['--surface', 'both', '--json', '--only', ids.join(',')]);
  assert.equal(res.json !== null, true, 'replay must emit parseable JSON: ' + res.stderr + res.stdout);
  assert.equal(res.json.counts.parity_mismatches, 0, 'CLI/MCP parity must hold');
  const byId = {};
  for (const e of res.json.entries) byId[e.id] = e;
  assert.equal(byId['live-2026-09-23-02'] && byId['live-2026-09-23-02'].outcome, 'OK', 'live-2026-09-23-02 must be OK on HEAD post-fix');
  for (const id of halfBIds) {
    assert.equal(byId[id] && byId[id].cli.class, 'block', id + ' must still block (238 Half B, untouched by D-08a)');
  }
});

console.log('\n' + (failures === 0 ? 'PASS' : 'FAIL') + ' test-357-f1-chrome (' + total + ' assertions, ' + failures + ' failed)');
assert.equal(netAttempts, 0, 'NET_ATTEMPTS must be 0 (no network egress from the replay harness)');
if (failures > 0) process.exit(1);
