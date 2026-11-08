#!/usr/bin/env node
'use strict';
// Phase 389 plan 07 -- the first-install reward on the Seed.
//
// scripts/first-install-router.cjs no longer reads a pending record and no longer
// starts a background process. At routing time it asks the sync heuristic classify of
// lib/core/mva-classifier.cjs one question about the first answer and stores two
// booleans (venture, hebrew) and no text. A later turn injects one fixed instruction:
// write the draft pyramid now, then offer the evidence step of /mos:structure-argument.
//
// Turn model (one spawnSync per hook turn, as in tests/test-267-2-pre-room-reward.cjs):
//   T1 armed -> routed (classify, store two booleans)
//   T2 outcome_observed (phase stays routed)
//   T3 fire: routed -> reward_pending (skip reason from the flag, no child)
//   T4 drain: reward_pending -> reward_delivered (the one fixed instruction)
//   T5 and later: the investment leg; the Seed instruction never repeats
//
// Every router run uses a scratch HOME, no Brain key, MINDRIAN_BRAIN_URL on a closed
// loopback port, and a preload (tests/helpers is not used; the preload text is written
// to the scratch folder) that logs every child process start and every socket connect.
// Hyphens only. Plain counters. Exit 1 on a failure.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const ROUTER = path.join(REPO, 'scripts', 'first-install-router.cjs');

let passed = 0;
let failed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('ok   ' + name);
  } catch (e) {
    failed += 1;
    console.log('FAIL ' + name + ' :: ' + String(e && e.message ? e.message : e).split('\n')[0]);
  }
}

const VENTURE = 'I want to start a new venture around clinical trial recruitment coordination.';
const VENTURE_B = 'We are launching a startup that sells reusable packaging to neighbourhood cafes.';
const NOT_VENTURE = 'what is the weather today in town please';
const HEBREW = '\u05D0\u05E0\u05D9 \u05E8\u05D5\u05E6\u05D4 \u05DC\u05D4\u05EA\u05D7\u05D9\u05DC \u05E2\u05E1\u05E7 \u05D7\u05D3\u05E9 \u05D1\u05EA\u05D7\u05D5\u05DD \u05D4\u05E8\u05DB\u05D1\u05D9\u05DD \u05D4\u05D7\u05E9\u05DE\u05DC\u05D9\u05D9\u05DD';

const PRELOAD_TEXT = [
  "'use strict';",
  "const fs = require('node:fs');",
  "const log = process.env.T389_LOG;",
  "function rec(kind, what) { try { fs.appendFileSync(log, kind + ' ' + what + '\\n'); } catch (_e) {} }",
  "const cp = require('node:child_process');",
  "for (const fn of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) {",
  "  const orig = cp[fn];",
  "  cp[fn] = function () { rec('child', fn + ' ' + String(arguments[0]) + ' ' + JSON.stringify(arguments[1] || null)); return orig.apply(this, arguments); };",
  "}",
  "const net = require('node:net');",
  "const origConnect = net.Socket.prototype.connect;",
  "net.Socket.prototype.connect = function () { rec('net', 'connect'); return origConnect.apply(this, arguments); };",
  "if (typeof globalThis.fetch === 'function') { const f = globalThis.fetch; globalThis.fetch = function () { rec('net', 'fetch'); return f.apply(this, arguments); }; }",
  "if (process.env.T389_CLASSIFIER_THROW === '1') {",
  "  const M = require('node:module');",
  "  const origLoad = M._load;",
  "  M._load = function (request) { if (String(request).indexOf('mva-classifier') !== -1) throw new Error('forced classifier failure'); return origLoad.apply(this, arguments); };",
  "}",
].join('\n');

function makeSandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p389-07-'));
  const home = path.join(dir, 'home');
  fs.mkdirSync(home, { recursive: true });
  const preload = path.join(dir, 'preload.cjs');
  fs.writeFileSync(preload, PRELOAD_TEXT, 'utf8');
  const log = path.join(dir, 'events.log');
  fs.writeFileSync(log, '', 'utf8');
  const env = Object.assign({}, process.env, {
    HOME: home,
    USERPROFILE: home,
    MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9',
    MINDRIAN_ROOMS_HOME: path.join(home, 'no-rooms-home'),
    T389_LOG: log,
    NODE_OPTIONS: '--require ' + preload,
  });
  for (const k of ['MINDRIAN_BRAIN_KEY', 'ANTHROPIC_API_KEY', 'TAVILY_API_KEY', 'VERCEL_TOKEN']) delete env[k];
  return { dir, home, env, log };
}

function cleanup(sb) {
  try { fs.rmSync(sb.dir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
}

function turn(sb, prompt, extraEnv) {
  const before = fs.readFileSync(sb.log, 'utf8').split('\n').filter(Boolean).length;
  const r = spawnSync(process.execPath, [ROUTER], {
    input: JSON.stringify({ prompt: prompt }),
    env: Object.assign({}, sb.env, extraEnv || {}),
    encoding: 'utf8',
    timeout: 10000,
  });
  const lines = fs.readFileSync(sb.log, 'utf8').split('\n').filter(Boolean);
  let envelope = null;
  try { envelope = JSON.parse(r.stdout); } catch (_e) { envelope = null; }
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, envelope: envelope, events: lines.slice(before) };
}

function stateOf(sb) {
  return JSON.parse(fs.readFileSync(path.join(sb.home, '.mindrian', 'first-install', 'state.json'), 'utf8'));
}

function ctxOf(t) {
  return (t.envelope && t.envelope.hookSpecificOutput && t.envelope.hookSpecificOutput.additionalContext) || '';
}

function walk(dir) {
  const out = [];
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p)); else out.push(p);
  }
  return out;
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/^\s*\/\/.*$/, ''))
    .join('\n');
}

const SEED_PHRASES = ['draft pyramid', 'no outside lookup', 'evidence step', '/mos:structure-argument'];

console.log('test-389-first-install-seed');

// ---------------------------------------------------------------------------
// Control: the preload really sees a child start and a socket connect.
// ---------------------------------------------------------------------------
check('control: the preload logs a child start and a socket connect (the zero checks below are not vacuous)', () => {
  const sb = makeSandbox();
  try {
    const r = spawnSync(process.execPath, ['-e',
      "require('node:child_process').spawnSync('true');"
      + "const s=require('node:net').connect(9,'127.0.0.1');s.on('error',()=>{});s.on('close',()=>{});"], {
      env: sb.env, encoding: 'utf8', timeout: 5000,
    });
    assert.equal(r.status, 0, 'control process exit ' + r.status + ' ' + r.stderr);
    const log = fs.readFileSync(sb.log, 'utf8');
    assert.ok(/^child spawnSync true/m.test(log), 'no child line: ' + JSON.stringify(log));
    assert.ok(/^net connect/m.test(log), 'no net line: ' + JSON.stringify(log));
  } finally { cleanup(sb); }
});

// ---------------------------------------------------------------------------
// Test 1: the routing turn stores two booleans and no text.
// ---------------------------------------------------------------------------
check('Test 1: the routing turn of a venture sentence stores venture true, hebrew false, the hash, and no text', () => {
  const sb = makeSandbox();
  try {
    const t1 = turn(sb, VENTURE);
    assert.equal(t1.status, 0, 'exit ' + t1.status + ' ' + t1.stderr);
    assert.ok(t1.envelope && t1.envelope.continue === true, 'no continue envelope: ' + t1.stdout);
    const st = stateOf(sb);
    assert.equal(st.phase, 'routed');
    assert.strictEqual(st.venture, true, 'venture ' + JSON.stringify(st.venture));
    assert.strictEqual(st.hebrew, false, 'hebrew ' + JSON.stringify(st.hebrew));
    assert.equal(st.sentence_sha256, crypto.createHash('sha256').update(VENTURE, 'utf8').digest('hex'));
    const raw = JSON.stringify(st);
    assert.ok(raw.indexOf(VENTURE) === -1, 'the whole sentence is in the state');
    for (const word of VENTURE.match(/[A-Za-z]{8,}/g)) {
      assert.ok(raw.toLowerCase().indexOf(word.toLowerCase()) === -1, 'state holds the word ' + word);
    }
    for (const k of Object.keys(st)) {
      if (typeof st[k] === 'string') assert.ok(st[k].length <= 64, 'long string field ' + k);
    }
  } finally { cleanup(sb); }
});

// ---------------------------------------------------------------------------
// Test 2 and Test 3: fire leg and drain leg.
// ---------------------------------------------------------------------------
check('Tests 2 and 3: fire moves to reward_pending with no child and no capture file; drain injects the Seed instruction once', () => {
  const sb = makeSandbox();
  try {
    const t1 = turn(sb, VENTURE);
    const t2 = turn(sb, 'second turn text');
    const t3 = turn(sb, 'third turn text');
    const st3 = stateOf(sb);
    assert.equal(st3.phase, 'reward_pending', 'phase ' + st3.phase);
    assert.strictEqual(st3.skip_reason, null, 'skip_reason ' + JSON.stringify(st3.skip_reason));
    assert.equal(t3.status, 0);
    assert.ok(t3.envelope && t3.envelope.continue === true, 'fire turn envelope ' + t3.stdout);
    assert.equal(ctxOf(t3), '', 'the fire turn must inject nothing');
    const firstInstall = walk(path.join(sb.home, '.mindrian', 'first-install'));
    assert.deepEqual(firstInstall.filter((p) => /brief-.*\.md$/.test(p)), [], 'a capture file exists');
    assert.ok(!st3.capture_path, 'capture_path ' + JSON.stringify(st3.capture_path));
    assert.ok(!st3.sha8, 'sha8 ' + JSON.stringify(st3.sha8));
    // No child at the fire turn, and no mva-run anywhere.
    assert.deepEqual(t3.events.filter((l) => l.startsWith('child')), [], 'fire turn started a child: ' + t3.events.join(' | '));
    const all = t1.events.concat(t2.events, t3.events);
    assert.deepEqual(all.filter((l) => /mva-run/.test(l)), [], 'mva-run was started');
    // Static: the router text names no mva-state require, no mva-run, no detached spawn.
    const src = stripComments(fs.readFileSync(ROUTER, 'utf8'));
    assert.ok(!/mva-state/.test(src), 'router still names mva-state');
    assert.ok(!/mva-run/.test(src), 'router still names mva-run');
    assert.ok(!/detached/.test(src), 'router still has a detached spawn');
    assert.ok(!/\bspawn\s*\(/.test(src), 'router still calls spawn(');

    const t4 = turn(sb, 'fourth turn text');
    assert.equal(t4.status, 0);
    const c4 = ctxOf(t4);
    for (const phrase of SEED_PHRASES) assert.ok(c4.indexOf(phrase) !== -1, 'drain context lacks "' + phrase + '"');
    assert.deepEqual(t4.events.filter((l) => l.startsWith('child')), [], 'drain turn started a child');
    const st4 = stateOf(sb);
    assert.equal(st4.phase, 'reward_delivered');
    assert.ok(!st4.skip_reason, 'skip_reason ' + JSON.stringify(st4.skip_reason));
    // The glyph rule is in the instruction, the sentence is not.
    assert.ok(/exactly one De Stijl glyph/.test(c4), 'glyph rule missing');
    assert.ok(c4.indexOf('clinical') === -1, 'the sentence reached the instruction');
    // Further turns never repeat it.
    const t5 = turn(sb, 'fifth turn text');
    const t6 = turn(sb, 'sixth turn text');
    const t7 = turn(sb, 'seventh turn text');
    for (const t of [t5, t6, t7]) {
      for (const phrase of ['draft pyramid', 'no outside lookup']) {
        assert.ok(ctxOf(t).indexOf(phrase) === -1, 'the Seed instruction repeated');
      }
    }
    // Telemetry carries the delivery event with zero brief bytes.
    const tel = fs.readFileSync(path.join(sb.home, '.mindrian', 'telemetry', 'v1.13', 'first-install-router.jsonl'), 'utf8')
      .split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const delivered = tel.filter((r) => r.event === 'reward_delivered');
    assert.equal(delivered.length, 1, 'reward_delivered events ' + delivered.length);
    assert.equal(delivered[0].brief_bytes, 0);
    assert.strictEqual(delivered[0].skip_reason, null);
  } finally { cleanup(sb); }
});

// ---------------------------------------------------------------------------
// Test 4: the skips.
// ---------------------------------------------------------------------------
function runToDrain(sb, first, firstExtraEnv) {
  const t1 = turn(sb, first, firstExtraEnv);
  turn(sb, 'second turn text');
  turn(sb, 'third turn text');
  const mid = stateOf(sb);
  const t4 = turn(sb, 'fourth turn text');
  return { t1: t1, mid: mid, t4: t4, end: stateOf(sb) };
}

check('Test 4a: a first answer that is not venture-shaped records not_venture_shaped and injects nothing', () => {
  const sb = makeSandbox();
  try {
    const r = runToDrain(sb, NOT_VENTURE);
    assert.strictEqual(r.mid.venture, false);
    assert.equal(r.mid.phase, 'reward_pending');
    assert.equal(r.mid.skip_reason, 'not_venture_shaped');
    assert.equal(ctxOf(r.t4), '', 'the drain injected: ' + ctxOf(r.t4).slice(0, 80));
    assert.equal(r.end.phase, 'reward_delivered');
    assert.equal(r.end.skip_reason, 'not_venture_shaped');
  } finally { cleanup(sb); }
});

check('Test 4b: a Hebrew first answer records hebrew_refusal and injects nothing', () => {
  const sb = makeSandbox();
  try {
    const r = runToDrain(sb, HEBREW);
    assert.strictEqual(r.mid.hebrew, true);
    assert.strictEqual(r.mid.venture, false);
    assert.equal(r.mid.skip_reason, 'hebrew_refusal');
    assert.equal(ctxOf(r.t4), '');
    assert.equal(r.end.phase, 'reward_delivered');
    assert.equal(r.end.skip_reason, 'hebrew_refusal');
    assert.ok(JSON.stringify(r.mid).indexOf(HEBREW.slice(0, 6)) === -1, 'Hebrew text in the state');
  } finally { cleanup(sb); }
});

check('Test 4c: a classifier throw degrades to the not_venture_shaped skip and the envelope still emits', () => {
  const sb = makeSandbox();
  try {
    const r = runToDrain(sb, VENTURE, { T389_CLASSIFIER_THROW: '1' });
    assert.equal(r.t1.status, 0, 'routing turn exit ' + r.t1.status);
    assert.ok(r.t1.envelope && r.t1.envelope.continue === true, 'routing envelope ' + r.t1.stdout);
    assert.strictEqual(r.mid.venture, false);
    assert.strictEqual(r.mid.hebrew, false);
    assert.equal(r.mid.skip_reason, 'not_venture_shaped');
  } finally { cleanup(sb); }
});

// ---------------------------------------------------------------------------
// Test 5: no cross-turn reads.
// ---------------------------------------------------------------------------
check('Test 5a: a venture-shaped turn between routing and firing does not turn a non-venture routing into a reward', () => {
  const sb = makeSandbox();
  try {
    turn(sb, NOT_VENTURE);
    turn(sb, VENTURE_B);
    const shaA = stateOf(sb).sentence_sha256;
    turn(sb, VENTURE);
    const st = stateOf(sb);
    assert.equal(st.phase, 'reward_pending');
    assert.equal(st.skip_reason, 'not_venture_shaped');
    assert.equal(st.sentence_sha256, shaA, 'the routing hash changed');
    const t4 = turn(sb, 'fourth turn text');
    assert.equal(ctxOf(t4), '');
  } finally { cleanup(sb); }
});

check('Test 5b: a non-venture turn between routing and firing does not cancel the reward of a venture routing', () => {
  const sb = makeSandbox();
  try {
    turn(sb, VENTURE);
    turn(sb, NOT_VENTURE);
    turn(sb, HEBREW);
    const st = stateOf(sb);
    assert.equal(st.phase, 'reward_pending');
    assert.strictEqual(st.skip_reason, null);
    const t4 = turn(sb, 'fourth turn text');
    for (const phrase of SEED_PHRASES) assert.ok(ctxOf(t4).indexOf(phrase) !== -1, 'drain lacks "' + phrase + '"');
  } finally { cleanup(sb); }
});

// ---------------------------------------------------------------------------
// Test 6: Part 8.
// ---------------------------------------------------------------------------
check('Test 6: the router calls classify and never classifyAsync; no socket in any turn; writes stay in its own folders', () => {
  const src = stripComments(fs.readFileSync(ROUTER, 'utf8'));
  assert.ok(/mva-classifier/.test(src), 'router does not name mva-classifier');
  assert.ok(/\.classify\(/.test(src), 'router does not call classify(');
  assert.ok(!/classifyAsync/.test(src), 'router names classifyAsync');
  const sb = makeSandbox();
  try {
    const turns = [turn(sb, VENTURE)];
    for (const w of ['two', 'three', 'four']) turns.push(turn(sb, w + ' turn text'));
    for (const t of turns) assert.equal(t.status, 0);
    const events = [].concat(...turns.map((t) => t.events));
    assert.deepEqual(events.filter((l) => l.startsWith('net')), [], 'network use: ' + events.join(' | '));
    const files = walk(sb.home).map((p) => path.relative(sb.home, p));
    for (const f of files) {
      assert.ok(
        f.startsWith(path.join('.mindrian', 'first-install') + path.sep)
          || f.startsWith(path.join('.mindrian', 'telemetry') + path.sep),
        'file outside the router folders: ' + f);
    }
    assert.ok(files.length > 0, 'the router wrote nothing, so the walk proves nothing');
  } finally { cleanup(sb); }
});

console.log('\ntest-389-first-install-seed: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
