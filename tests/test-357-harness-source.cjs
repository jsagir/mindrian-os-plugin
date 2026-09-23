'use strict';
// Phase 357-07 (D-07 amended by R-A) -- the 'harness' source class in
// lib/hmi/turn-text.cjs, consumed by scripts/check-card-fire.cjs's PRIMARY
// synthetic guard. GATE357-04.
//
// Task 1 behaviors (see 357-07-PLAN.md):
//   1. classifyPrecedingUserContentSource(content) 1-arg contract unchanged.
//   2. record-meta 2nd arg: isMeta + not-human-upstream -> 'harness';
//      isMeta + human-upstream -> the base class (the V3 carve-out).
//   3. originKind-gated leading-tag match ('<task-notification' etc.) -- a
//      human-origin record with the same leading text stays 'typed' (a
//      pasted tag is still a human turn).
//   4. the idle-notice leading tag, same origin-gating.
//   5/6. readTurnText end-to-end: harness classification and the carve-out,
//      both threading preceding_user_is_meta through.
//   7. classifyCardFire treats 'harness' like 'tool_result' on the PRIMARY
//      path.
//   8. corpus legs on HEAD (post-fix): the live anchor and the three debug
//      D-07 targets read OK; both V3 carve-out debug ids still block; 0
//      parity mismatches between the CLI and MCP surfaces.
//
// Test hygiene: TYPESAFE_API_KEY is stripped before any spawn (this suite
// makes zero egress calls of its own); every replay spawn runs under a
// fetch-thrower preload (D-13 backstop) and a redirected HOME; NET_ATTEMPTS
// is asserted 0 at the end. No em-dashes anywhere (hyphens only).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

delete process.env.TYPESAFE_API_KEY;

const REPO = path.join(__dirname, '..');
const turnText = require(path.join(REPO, 'lib', 'hmi', 'turn-text.cjs'));
const checkCardFire = require(path.join(REPO, 'scripts', 'check-card-fire.cjs'));
const REPLAY_SCRIPT = path.join(REPO, 'scripts', 'replay-card-fire.cjs');

console.log('test-357-harness-source');

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
const preloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness357-preload-'));
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
  const childHome = fs.mkdtempSync(path.join(os.tmpdir(), 'harness357-home-'));
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

function writeTranscript(records) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness357-transcript-'));
  const p = path.join(dir, 'transcript.jsonl');
  fs.writeFileSync(p, records.map(function (r) { return JSON.stringify(r); }).join('\n') + '\n');
  return p;
}

// =======================================================================
// Behavior 1: the 1-arg call contract stays byte-for-byte (test-209
// Behavior 14).
// =======================================================================
ok('Behavior 1: classifyPrecedingUserContentSource(content) 1-arg contract unchanged', function () {
  const classify = turnText.classifyPrecedingUserContentSource;
  assert.equal(classify('hi'), 'typed');
  assert.equal(classify([{ type: 'text', text: 'hello there' }]), 'typed');
  assert.equal(classify([{ type: 'tool_result', tool_use_id: 'x' }]), 'tool_result');
  assert.equal(classify([]), 'none');
  assert.equal(classify(null), 'none');
});

// =======================================================================
// Behavior 2: the record-meta second argument -- isMeta + human-upstream
// carve-out.
// =======================================================================
ok('Behavior 2: isMeta true + prevHumanUpstream false -> harness; isMeta true + prevHumanUpstream true -> base class', function () {
  const classify = turnText.classifyPrecedingUserContentSource;
  assert.equal(classify('a real meta text block', { isMeta: true, prevHumanUpstream: false }), 'harness');
  assert.equal(classify('a real meta text block', { isMeta: true, prevHumanUpstream: true }), 'typed');
});

// =======================================================================
// Behavior 3: origin-gated task-notification leading tag.
// =======================================================================
ok('Behavior 3: origin.kind task-notification + leading tag -> harness; origin.kind human + same text -> typed', function () {
  const classify = turnText.classifyPrecedingUserContentSource;
  const text = '<task-notification>Background sync finished.</task-notification>';
  assert.equal(classify(text, { originKind: 'task-notification' }), 'harness');
  assert.equal(classify(text, { originKind: 'human' }), 'typed', 'a pasted tag is still a human turn');
});

// =======================================================================
// Behavior 4: the idle-notice leading tag, same origin-gating; a human
// slash-command / image turn stays typed.
// =======================================================================
ok('Behavior 4: non-human idle-notice lead -> harness; human command-message / image lead -> typed', function () {
  const classify = turnText.classifyPrecedingUserContentSource;
  assert.equal(
    classify('[Cross-session idle notice] The workspace has been idle.', {}),
    'harness'
  );
  assert.equal(
    classify('<command-message>run the check</command-message>', { originKind: 'human' }),
    'typed'
  );
  assert.equal(classify('[Image #1]', { originKind: 'human' }), 'typed');
});

// =======================================================================
// Behavior 5: readTurnText end-to-end -- a peer hand-back right after a
// tool_result classifies as harness, with preceding_user_is_meta true.
// =======================================================================
ok('Behavior 5: readTurnText -- peer isMeta record after a tool_result classifies harness, preceding_user_is_meta true', function () {
  const p = writeTranscript([
    { type: 'user', message: { role: 'user', content: 'kick off the review' }, origin: { kind: 'human' } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Checking now.' }, { type: 'tool_use', name: 'RunCheck', id: 't1', input: {} }] } },
    { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'done' }] } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Reviewing.' }] } },
    { type: 'user', message: { role: 'user', content: 'Handoff complete: returning control now.' }, isMeta: true, origin: { kind: 'peer' } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Done.' }] } },
  ]);
  const turn = turnText.readTurnText(p);
  assert.equal(turn.preceding_user_text_source, 'harness');
  assert.equal(turn.preceding_user_is_meta, true);
});

// =======================================================================
// Behavior 6: the V3 carve-out -- a Skill-body / image isMeta record right
// after a human prompt stays typed, with preceding_user_is_meta true.
// =======================================================================
ok('Behavior 6: readTurnText -- Skill-body isMeta after a human prompt stays typed, preceding_user_is_meta true', function () {
  const p = writeTranscript([
    { type: 'user', message: { role: 'user', content: 'run the skill now' }, origin: { kind: 'human' } },
    { type: 'user', message: { role: 'user', content: 'Base directory for this skill: /workspace, reference only.' }, isMeta: true },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Loaded.' }] } },
  ]);
  const turn = turnText.readTurnText(p);
  assert.equal(turn.preceding_user_text_source, 'typed');
  assert.equal(turn.preceding_user_is_meta, true);
});

ok('Behavior 6b: readTurnText -- image-placeholder isMeta after a human prompt stays typed, preceding_user_is_meta true', function () {
  const p = writeTranscript([
    { type: 'user', message: { role: 'user', content: 'take a look at this' }, origin: { kind: 'human' } },
    { type: 'user', message: { role: 'user', content: '[Image #1]' }, isMeta: true },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Got it.' }] } },
  ]);
  const turn = turnText.readTurnText(p);
  assert.equal(turn.preceding_user_text_source, 'typed');
  assert.equal(turn.preceding_user_is_meta, true);
});

// =======================================================================
// Behavior 7: classifyCardFire treats 'harness' exactly like 'tool_result'
// on the PRIMARY path.
// =======================================================================
ok("Behavior 7: classifyCardFire -- PRIMARY hit + fresh relevant subject: 'harness' passes synthetic, 'typed' still force-fires", function () {
  const registry = checkCardFire.loadRegistry();
  const baseTurn = {
    ran_entries: ['scripts/intent-classifier.cjs'],
    output_text: 'Continuing the review, nothing further to add right now.',
    gate_subject_text: 'Investigate a prior widget migration worth another pass.',
    preceding_user_text: 'that widget context sounds fine to me',
    gate_is_fresh: true,
  };
  const harnessVerdict = checkCardFire.classifyCardFire(
    Object.assign({}, baseTurn, { preceding_user_text_source: 'harness' }),
    registry
  );
  assert.deepStrictEqual(
    { intercept: harnessVerdict.intercept, reason: harnessVerdict.reason },
    { intercept: false, reason: 'preceding-turn-synthetic-no-user-engagement' }
  );
  const typedVerdict = checkCardFire.classifyCardFire(
    Object.assign({}, baseTurn, { preceding_user_text_source: 'typed' }),
    registry
  );
  assert.deepStrictEqual(
    { intercept: typedVerdict.intercept, reason: typedVerdict.reason },
    { intercept: true, reason: 'reached-registry-gate-no-card' }
  );
});

// =======================================================================
// Behavior 8: corpus legs on HEAD (post-fix) via the real replay harness --
// the live anchor and the three debug D-07 targets read OK; both V3
// carve-out debug ids still block; 0 parity mismatches.
// =======================================================================
ok('Behavior 8: corpus legs -- live-01 + 3 debug D-07 targets OK, carve-out ids still block, 0 parity mismatches', function () {
  const ids = [
    'live-2026-09-23-01',
    'debug-room-bind-task-notification',
    'debug-harness-peer-after-tool-result',
    'debug-harness-idle-notice',
    'debug-carveout-skill-meta-after-human',
    'debug-carveout-image-meta-after-human',
  ];
  const res = spawnReplay(['--surface', 'both', '--json', '--only', ids.join(',')]);
  assert.equal(res.json !== null, true, 'replay must emit parseable JSON: ' + res.stderr + res.stdout);
  assert.equal(res.json.counts.parity_mismatches, 0, 'CLI/MCP parity must hold');
  const byId = {};
  for (const e of res.json.entries) byId[e.id] = e;
  for (const id of ['live-2026-09-23-01', 'debug-room-bind-task-notification', 'debug-harness-peer-after-tool-result', 'debug-harness-idle-notice']) {
    assert.equal(byId[id] && byId[id].outcome, 'OK', id + ' must be OK on HEAD post-fix (was: ' + JSON.stringify(byId[id]) + ')');
  }
  for (const id of ['debug-carveout-skill-meta-after-human', 'debug-carveout-image-meta-after-human']) {
    assert.equal(byId[id] && byId[id].cli.class, 'block', id + ' must still block (V3 carve-out)');
  }
});

// =======================================================================
// Behavior 9 (CR-01, REVIEW.md): rule 1 must require the base classification
// to be 'typed' before promoting to 'harness'. An isMeta:true record with
// empty/absent content has base 'none' and must stay 'none' (the documented
// conservative floor), never get promoted to 'harness' by isMeta alone.
// =======================================================================
ok("Behavior 9 (CR-01): isMeta true + empty/absent content ('', null, []) stays 'none', never 'harness'", function () {
  const classify = turnText.classifyPrecedingUserContentSource;
  assert.equal(classify('', { isMeta: true, prevHumanUpstream: false }), 'none');
  assert.equal(classify(null, { isMeta: true, prevHumanUpstream: false }), 'none');
  assert.equal(classify([], { isMeta: true, prevHumanUpstream: false }), 'none');
});

// =======================================================================
// Structural-only guard: the R-A dropped tags never appear as a live match
// target, and HARNESS_LEADS is frozen and exported.
// =======================================================================
ok('Structural guard: HARNESS_LEADS is a frozen exported array', function () {
  assert.equal(Array.isArray(turnText.HARNESS_LEADS), true);
  assert.equal(Object.isFrozen(turnText.HARNESS_LEADS), true);
  assert.equal(turnText.HARNESS_LEADS.indexOf('<task-notification') !== -1, true);
  assert.equal(turnText.HARNESS_LEADS.indexOf('[Cross-session idle notice]') !== -1, true);
});

console.log('\n' + (failures === 0 ? 'PASS' : 'FAIL') + ' test-357-harness-source (' + total + ' assertions, ' + failures + ' failed)');
assert.equal(netAttempts, 0, 'NET_ATTEMPTS must be 0 (no network egress from the replay harness)');
if (failures > 0) process.exit(1);
