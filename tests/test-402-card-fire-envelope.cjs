'use strict';
// Quick 261127-k4f, Phase 402 K4 (design 402-DESIGN.md r3.1 section 7.1, rules
// K4-R1 to K4-R4 and K4-R6; binding addendum 402-K4F-PLAN-ADDENDUM.md change 9).
//
// The card-fire Stop block must let the host continue the turn: the block
// envelope has exactly decision, reason and systemMessage, and no continue key
// (the host ends the turn on continue false before it reads a block). A Stop
// with stop_hook_active true is a terminal pass that clears both counters and
// consumes the reached-gate records, so 1 gate record forces 1 block in 1
// chain of continued Stops.
//
// Rule: never run this against the live ~/.mindrian. Every spawn leg uses its
// own mkdtemp folder, its own session id, and MINDRIAN_HOME plus
// CARD_FIRE_SIDECHANNEL_PATH inside that folder. No network. Node built-ins.
//
// Output: 1 line per leg, "PASS <ID>: <text>" or "FAIL <ID>: <text>". The last
// line is "test-402-card-fire-envelope: <p> passed, <f> failed". Exit 1 when
// f is above 0. A leg that throws is a FAIL and the file continues.
//
// No em dash and no en dash in this file (hyphens only).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

delete process.env.TYPESAFE_API_KEY;
delete process.env.MINDRIAN_MCP_FIRST;

const REPO = path.join(__dirname, '..');
const HOOK = path.join(REPO, 'scripts', 'check-card-fire.cjs');
const SIDECHANNEL = path.join(REPO, 'lib', 'core', 'card-fire-sidechannel.cjs');
const ON_STOP = path.join(REPO, 'scripts', 'on-stop');
const FLAG = path.join(REPO, 'lib', 'mcp', 'mcp-first-flag.cjs');
const FIXTURE_DIR = path.join(REPO, 'tests', 'fixtures', '402-card-fire');

// The process environment of this test must not point at the live store.
const OWN_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'k4f-envelope-own-'));
process.env.MINDRIAN_HOME = OWN_HOME;
process.env.CARD_FIRE_SIDECHANNEL_PATH = path.join(OWN_HOME, 'card-fire-reached.json');

let m = {};
try { m = require(HOOK); } catch (e) { m = {}; }
let sc = {};
try { sc = require(SIDECHANNEL); } catch (e) { sc = {}; }

const PROMPT = 'what should I work on next for this venture pricing plan';
const REL = '- REACH - decision gate Choose next reach: Borrow a pricing wedge. Pull up the venture plan.';
const UNREL = '- REACH - decision gate Choose next reach: Harvest orchard apples. Paint the fence blue.';
const ESUBJ = '- REACH - decision gate Choose next reach: Selectable pricing wedge for the venture. Pull up the venture plan.';
const FEEDBACK_TEXT = 'Stop hook feedback:\nShow the open choice from this turn as a selectable card.';
const PROMPT2 = 'and what about the venture pricing plan after that';
const PROSE = 'I cannot name it yet.';
const DECL = 'Here are the paths I see.\nYour call: Ship it now | Hold one week | What if we open-source it';
const PASS_STDOUT = '{"continue":true,"suppressOutput":true}';
const SLUGS = [
  'reached-registry-gate-no-card',
  'ascii-box-backstop-no-card',
  'declared-fork-no-card',
  'bounded-escape',
  'session-intercept-ceiling',
];

let passed = 0;
let failed = 0;
const cleanup = [OWN_HOME];

function leg(id, text, fn) {
  try {
    fn();
    passed += 1;
    console.log('PASS ' + id + ': ' + text);
  } catch (e) {
    failed += 1;
    const msg = e && e.message ? e.message.split('\n')[0] : String(e);
    console.log('FAIL ' + id + ': ' + text + ' -- ' + msg);
  }
}

// ----- spawn helpers --------------------------------------------------------

function newCase(tag) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'k4f-envelope-' + tag + '-'));
  cleanup.push(dir);
  const home = path.join(dir, 'mindrian');
  fs.mkdirSync(home, { recursive: true });
  return {
    dir: dir,
    home: home,
    side: path.join(dir, 'card-fire-reached.json'),
    sid: 'k4f-' + tag + '-' + process.pid + '-' + Date.now(),
    transcript: path.join(dir, 'transcript.jsonl'),
  };
}

function seed(c, subjectText) {
  assert.equal(typeof sc.recordReachedGate, 'function', 'recordReachedGate export missing');
  sc.recordReachedGate({
    sessionId: c.sid,
    surface: 'scripts/intent-classifier.cjs',
    shape: 'F.1',
    subjectText: subjectText,
    filePath: c.side,
  });
}

function human(text, withOrigin) {
  const r = { type: 'user', message: { role: 'user', content: text } };
  if (withOrigin) r.origin = { kind: 'human' };
  return r;
}
function assistant(text) {
  return { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: text }] } };
}
function feedback() {
  return { type: 'user', isMeta: true, message: { role: 'user', content: FEEDBACK_TEXT } };
}

function writeTranscript(c, records) {
  fs.writeFileSync(c.transcript, records.map(function (r) { return JSON.stringify(r); }).join('\n') + '\n', 'utf8');
}

function stdinFor(c, key) {
  const o = { hook_event_name: 'Stop', session_id: c.sid, transcript_path: c.transcript };
  if (key === true || key === false) o.stop_hook_active = key;
  return o;
}

function spawnHook(c, stdinObj) {
  const env = Object.assign({}, process.env);
  delete env.TYPESAFE_API_KEY;
  delete env.MINDRIAN_MCP_FIRST;
  env.MINDRIAN_HOME = c.home;
  env.CARD_FIRE_SIDECHANNEL_PATH = c.side;
  const res = spawnSync(process.execPath, [HOOK], {
    cwd: REPO,
    env: env,
    input: JSON.stringify(stdinObj),
    encoding: 'utf8',
    timeout: 60000,
  });
  let parsed = null;
  try { parsed = JSON.parse(res.stdout); } catch (_e) { parsed = null; }
  return { status: res.status, stdout: res.stdout, stderr: res.stderr, env: parsed };
}

// Run fn with this process pointed at the case store (deriveTurnSignals and
// the retry accessors read the 2 variables at call time).
function withCaseEnv(c, fn) {
  const a = process.env.MINDRIAN_HOME;
  const b = process.env.CARD_FIRE_SIDECHANNEL_PATH;
  process.env.MINDRIAN_HOME = c.home;
  process.env.CARD_FIRE_SIDECHANNEL_PATH = c.side;
  try { return fn(); } finally {
    process.env.MINDRIAN_HOME = a;
    process.env.CARD_FIRE_SIDECHANNEL_PATH = b;
  }
}

function bucketSize(c) {
  try {
    const store = JSON.parse(fs.readFileSync(c.side, 'utf8'));
    return Array.isArray(store[c.sid]) ? store[c.sid].length : 0;
  } catch (_e) {
    return 0;
  }
}

function logLines(c) {
  try {
    return fs.readFileSync(path.join(c.home, 'card-fire-intercepts.log'), 'utf8')
      .split('\n').filter(function (l) { return l.trim().length > 0; });
  } catch (_e) {
    return [];
  }
}
function lastLog(c) {
  const lines = logLines(c);
  assert.ok(lines.length > 0, 'no intercept log record');
  return JSON.parse(lines[lines.length - 1]);
}

function seedCounters(c, stdinObj, perGate, session) {
  const hash = withCaseEnv(c, function () {
    return m.turnContextHash(m.deriveTurnSignals(stdinObj));
  });
  const fp = path.join(c.home, 'card-fire-retries.json');
  let store = {};
  try { store = JSON.parse(fs.readFileSync(fp, 'utf8')); } catch (_e) { store = {}; }
  const now = Date.now();
  if (perGate !== null) store[hash] = { count: perGate, ts: now };
  if (session !== null) store[m.SESSION_KEY_PREFIX + c.sid] = { count: session, ts: now };
  fs.writeFileSync(fp, JSON.stringify(store), 'utf8');
  return hash;
}

function assertU2(env) {
  assert.ok(env && typeof env === 'object', 'envelope is not JSON');
  assert.deepEqual(Object.keys(env).sort(), ['decision', 'reason', 'systemMessage'], 'keys are ' + JSON.stringify(Object.keys(env)));
  assert.equal(env.decision, 'block');
  assert.ok(!('continue' in env), 'a block envelope has a continue key');
  assert.ok(!('stopReason' in env), 'a block envelope has a stopReason key');
  assert.equal(typeof m.CARD_FIRE_BLOCK_REASON, 'string', 'CARD_FIRE_BLOCK_REASON export missing');
  assert.equal(env.reason, m.CARD_FIRE_BLOCK_REASON);
  assert.equal(typeof m.CARD_FIRE_BLOCK_SYSTEM_MESSAGE, 'string', 'CARD_FIRE_BLOCK_SYSTEM_MESSAGE export missing');
  assert.equal(env.systemMessage, m.CARD_FIRE_BLOCK_SYSTEM_MESSAGE);
  assert.ok(!('hookSpecificOutput' in env));
}

function assertPass(r) {
  assert.equal(r.status, 0, 'exit ' + r.status);
  assert.equal(r.stdout, PASS_STDOUT, 'stdout ' + r.stdout);
}

// ----- unit legs ------------------------------------------------------------

leg('U1', 'CARD_FIRE_BLOCK_REASON is the fixed plain phrase of K4-R2', function () {
  const s = m.CARD_FIRE_BLOCK_REASON;
  assert.equal(typeof s, 'string', 'export missing');
  assert.equal(s, 'rendering your choices as a selectable card');
  assert.ok(s.length <= 80, 'longer than 80');
  assert.ok(s.indexOf('\n') === -1, 'line feed');
  assert.ok(s.indexOf('_') === -1, 'underscore');
  assert.ok(s.indexOf('/') === -1, 'slash');
  assert.ok(!/\b[A-Za-z0-9]+-[A-Za-z0-9]+-[A-Za-z0-9]+/.test(s), 'slug token');
  assert.ok(!/\b[A-Z]{2,}\b/.test(s), 'capitals-only word');
  assert.ok(!/AskUserQuestion|\bhook\b|\btool\b/i.test(s), 'tool or hook word');
  assert.ok(!/[\u2013\u2014]/.test(s), 'dash character');
  for (const slug of SLUGS) assert.ok(s.indexOf(slug) === -1, 'slug ' + slug);
});

leg('U2', 'the intercept envelope has exactly decision, reason, systemMessage and no continue key', function () {
  const env = m.buildEnforcementEnvelope({ intercept: true, reason: 'reached-registry-gate-no-card', degrade: false });
  assertU2(env);
  assert.equal(m.CARD_FIRE_BLOCK_SYSTEM_MESSAGE, 'Re-rendering your choices as a selectable card...');
});

leg('U3', 'the degrade envelope and the pass envelope are unchanged', function () {
  assert.deepEqual(m.buildEnforcementEnvelope({ intercept: false, degrade: true, reason: 'bounded-escape-released-after-3-retries' }),
    { continue: true, suppressOutput: true, reason: 'continuing this turn' });
  assert.deepEqual(m.buildEnforcementEnvelope({ intercept: false, degrade: false, reason: 'no-gate-signal' }),
    { continue: true, suppressOutput: true });
});

leg('U4', 'the lock constants are exported and fit 3,000 ms; no forced-record functions exist', function () {
  assert.ok(Number.isInteger(m.RETRY_LOCK_MAX_ATTEMPTS), 'RETRY_LOCK_MAX_ATTEMPTS export missing');
  assert.ok(Number.isInteger(m.RETRY_LOCK_SLEEP_MS), 'RETRY_LOCK_SLEEP_MS export missing');
  assert.ok(2 * m.RETRY_LOCK_MAX_ATTEMPTS * m.RETRY_LOCK_SLEEP_MS <= 3000,
    '2 x ' + m.RETRY_LOCK_MAX_ATTEMPTS + ' x ' + m.RETRY_LOCK_SLEEP_MS + ' is above 3000');
  assert.ok(!('markReachedGatesForced' in sc), 'markReachedGatesForced exists');
  assert.ok(!('dropForcedReachedGates' in sc), 'dropForcedReachedGates exists');
});

// ----- spawn legs -----------------------------------------------------------

leg('A1', 'a declared fork with no card blocks with the U2 envelope and logs declared-fork-no-card', function () {
  const c = newCase('a1');
  writeTranscript(c, [human(PROMPT), assistant(DECL)]);
  const r = spawnHook(c, stdinFor(c, false));
  assert.equal(r.status, 0);
  assertU2(r.env);
  for (const slug of SLUGS) assert.ok(r.stdout.indexOf(slug) === -1, 'slug on stdout');
  assert.equal(lastLog(c).reason, 'declared-fork-no-card');
});

leg('A2', 'a fresh related side-file gate with no card blocks with the U2 envelope and keeps the record', function () {
  const c = newCase('a2');
  seed(c, REL);
  writeTranscript(c, [human(PROMPT), assistant(PROSE)]);
  const r = spawnHook(c, stdinFor(c, false));
  assert.equal(r.status, 0);
  assertU2(r.env);
  assert.equal(bucketSize(c), 1);
});

leg('B1', 'an answered gate (card fired) passes, consumes the record and writes no log line', function () {
  const c = newCase('b1');
  seed(c, REL);
  writeTranscript(c, [
    human(PROMPT),
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_k4f_b1', name: 'AskUserQuestion', input: { questions: [] } }] } },
    { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_k4f_b1', content: 'Borrow a pricing wedge' }] } },
    assistant('Good, we go with the pricing wedge.'),
  ]);
  const r = spawnHook(c, stdinFor(c, false));
  assertPass(r);
  assert.equal(bucketSize(c), 0);
  assert.equal(logLines(c).length, 0);
});

leg('C1', 'an unrelated gate passes and consumes the record', function () {
  const c = newCase('c1');
  seed(c, UNREL);
  writeTranscript(c, [human(PROMPT), assistant(PROSE)]);
  const r = spawnHook(c, stdinFor(c, false));
  assertPass(r);
  assert.equal(bucketSize(c), 0);
});

leg('X1', 'present behaviour, pinned; open item of addendum section 2: a new prompt inside 2 min with the record still kept blocks again', function () {
  const c = newCase('x1');
  seed(c, REL);
  const t1 = [human(PROMPT), assistant(PROSE)];
  writeTranscript(c, t1);
  const r1 = spawnHook(c, stdinFor(c, false));
  assert.equal(r1.env && r1.env.decision, 'block', 'spawn 1 did not block');
  writeTranscript(c, t1.concat([feedback(), human(PROMPT2), assistant(PROSE)]));
  const r2 = spawnHook(c, stdinFor(c, false));
  assert.equal(r2.status, 0);
  assert.equal(r2.env && r2.env.decision, 'block', 'spawn 2 stdout ' + r2.stdout);
});

leg('E1', 'stop_hook_active true is a terminal pass: pass form, both counters 0, records consumed, log stop-hook-active-pass', function () {
  const c = newCase('e1');
  seed(c, ESUBJ);
  const t1 = [human(PROMPT, true), assistant(PROSE)];
  writeTranscript(c, t1);
  const r1 = spawnHook(c, stdinFor(c, false));
  assert.equal(r1.env && r1.env.decision, 'block', 'spawn 1 did not block: ' + r1.stdout);
  writeTranscript(c, t1.concat([feedback(), assistant('No choice is open.')]));
  const stdin2 = stdinFor(c, true);
  const hash = seedCounters(c, stdin2, 2, 5);
  assert.ok(bucketSize(c) >= 1, 'the gate record of spawn 1 is gone before spawn 2');
  const r2 = spawnHook(c, stdin2);
  assertPass(r2);
  withCaseEnv(c, function () {
    assert.equal(m.readRetryCount(hash), 0, 'per-gate count not cleared');
    assert.equal(m.readSessionCount(c.sid), 0, 'session count not cleared');
  });
  assert.equal(bucketSize(c), 0, 'records not consumed');
  const rec = lastLog(c);
  assert.equal(rec.reason, 'stop-hook-active-pass');
  assert.equal(rec.stop_hook_active, true);
});

leg('E2', 'stop_hook_active true on a declared fork with no card is the pass form (the pass comes before the predicate)', function () {
  const c = newCase('e2');
  writeTranscript(c, [human(PROMPT), assistant(DECL)]);
  const r = spawnHook(c, stdinFor(c, true));
  assertPass(r);
});

leg('F1', 'a Stop stdin with no stop_hook_active key keeps the old route (the X1 chain blocks)', function () {
  const c = newCase('f1');
  seed(c, REL);
  const t1 = [human(PROMPT), assistant(PROSE)];
  writeTranscript(c, t1);
  const r1 = spawnHook(c, stdinFor(c, false));
  assert.equal(r1.env && r1.env.decision, 'block', 'spawn 1 did not block');
  writeTranscript(c, t1.concat([feedback(), human(PROMPT2), assistant(PROSE)]));
  const r2 = spawnHook(c, stdinFor(c, undefined));
  assert.equal(r2.env && r2.env.decision, 'block', 'spawn 2 stdout ' + r2.stdout);
});

leg('G1', 'the log record carries stop_hook_active: false for a false key and null for no key', function () {
  const c = newCase('g1a');
  seed(c, REL);
  writeTranscript(c, [human(PROMPT), assistant(PROSE)]);
  const r = spawnHook(c, stdinFor(c, false));
  assert.equal(r.env && r.env.decision, 'block');
  const rec = lastLog(c);
  assert.ok('stop_hook_active' in rec, 'field missing');
  assert.equal(rec.stop_hook_active, false);
  const d = newCase('g1b');
  seed(d, REL);
  writeTranscript(d, [human(PROMPT), assistant(PROSE)]);
  const r2 = spawnHook(d, stdinFor(d, undefined));
  assert.equal(r2.env && r2.env.decision, 'block');
  const rec2 = lastLog(d);
  assert.ok('stop_hook_active' in rec2, 'field missing');
  assert.equal(rec2.stop_hook_active, null);
});

// ----- source legs ----------------------------------------------------------

function onStopBranch() {
  const src = fs.readFileSync(ON_STOP, 'utf8');
  const a = src.indexOf('# BEGIN-MCP-FIRST-STOP-THIN-ADAPTER');
  const b = src.indexOf('# END-MCP-FIRST-STOP-THIN-ADAPTER');
  assert.ok(a !== -1 && b > a, 'sentinels missing');
  return src.slice(a, b);
}

leg('T1', 'the flag-on route of scripts/on-stop has the same reason and no continue or stopReason key', function () {
  const branch = onStopBranch();
  const at = branch.indexOf("decision: 'block'");
  assert.ok(at !== -1, "no decision: 'block' literal");
  const open = branch.lastIndexOf('{', at);
  const close = branch.indexOf('}', at);
  const literal = branch.slice(open, close + 1);
  assert.ok(!/\bcontinue\s*:/.test(literal), 'continue key in ' + literal.replace(/\s+/g, ' '));
  assert.ok(!/\bstopReason\s*:/.test(literal), 'stopReason key');
  const mm = /\breason\s*:\s*'([^']*)'/.exec(literal);
  assert.ok(mm, 'no reason literal');
  assert.equal(mm[1], m.CARD_FIRE_BLOCK_REASON);
  assert.ok(branch.indexOf('stop-gate-relevant-unanswered') === -1, 'old slug still present');
});

leg('R1', 'release dependency: the flag-on Stop route is off by default, or it has a stop_hook_active guard', function () {
  const branch = onStopBranch();
  const hasGuard = branch.indexOf('stop_hook_active') !== -1;
  const env = Object.assign({}, process.env);
  delete env.MINDRIAN_MCP_FIRST;
  const res = spawnSync(process.execPath, ['-e',
    'const f=require(' + JSON.stringify(FLAG) + ');process.stdout.write(String(f.isMcpFirst("cli")))'],
  { env: env, encoding: 'utf8' });
  const onByDefault = res.stdout.trim() === 'true';
  const msg = 'MINDRIAN_MCP_FIRST is on by default for cli, and the flag-on Stop route has no stop_hook_active guard (402 design 7.1, Codex M3)';
  assert.ok(res.stdout.trim() === 'true' || res.stdout.trim() === 'false', 'flag reader did not run: ' + res.stderr);
  assert.ok(!onByDefault || hasGuard, msg);
  const hookDir = path.join(REPO, 'hooks');
  let assigned = false;
  for (const name of fs.readdirSync(hookDir)) {
    const p = path.join(hookDir, name);
    if (!fs.statSync(p).isFile()) continue;
    const t = fs.readFileSync(p, 'utf8');
    if (/MINDRIAN_MCP_FIRST\s*=|"MINDRIAN_MCP_FIRST"\s*:/.test(t)) assigned = true;
  }
  assert.ok(!assigned || hasGuard, msg);
});

leg('M1', 'main() has exactly 3 consume call sites and the 2 ceilings are 3 and 12', function () {
  const src = fs.readFileSync(HOOK, 'utf8');
  const a = src.indexOf('function main()');
  const b = src.indexOf('module.exports');
  assert.ok(a !== -1 && b > a, 'main or exports not found');
  const body = src.slice(a, b);
  const n = body.split('consumeReachedGatesForVerdict(turn, verdict)').length - 1;
  assert.equal(n, 3, 'call sites in main: ' + n);
  assert.equal(m.MAX_FORCE_RETRIES, 3);
  assert.equal(m.MAX_SESSION_INTERCEPTS, 12);
});

// ----- replay fixture legs (K4-R6) ------------------------------------------

let fixtures = [];
try {
  fixtures = fs.readdirSync(FIXTURE_DIR).filter(function (f) { return /\.json$/.test(f); }).sort();
} catch (_e) {
  fixtures = [];
}
leg('P0', 'the replay fixture folder holds 3 to 12 fixtures', function () {
  assert.ok(fixtures.length >= 3 && fixtures.length <= 12, 'count ' + fixtures.length);
});

fixtures.forEach(function (file, idx) {
  const n = String(idx + 1);
  let fx = null;
  let c = null;
  let stdinA = null;
  leg('P' + n + 'a', file + ': the written verdict without the key (' + 'see the fixture' + ')', function () {
    fx = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, file), 'utf8'));
    c = newCase('p' + n);
    seed(c, REL);
    writeTranscript(c, [human(PROMPT), assistant(fx.synthetic_text)]);
    stdinA = stdinFor(c, undefined);
    const exp = fx.expected_without_key;
    if (exp.class === 'degrade') seedCounters(c, stdinA, m.MAX_FORCE_RETRIES, null);
    const r = spawnHook(c, stdinA);
    assert.equal(r.status, 0);
    if (exp.class === 'block') {
      assertU2(r.env);
    } else {
      assert.deepEqual(r.env, exp.envelope);
    }
    assert.equal(lastLog(c).reason, exp.log_reason);
  });
  leg('P' + n + 'b', file + ': stop_hook_active true gives the pass form, counters 0, records consumed', function () {
    assert.ok(fx && c, 'leg a did not set up the case');
    const exp = fx.expected_with_stop_hook_active_true;
    writeTranscript(c, [human(PROMPT), assistant(fx.synthetic_text), feedback(), assistant('No choice is open.')]);
    seed(c, REL);
    const stdinB = stdinFor(c, true);
    const r = spawnHook(c, stdinB);
    assert.equal(r.status, 0);
    assert.deepEqual(r.env, exp.envelope);
    const hash = withCaseEnv(c, function () { return m.turnContextHash(m.deriveTurnSignals(stdinB)); });
    withCaseEnv(c, function () {
      assert.equal(m.readRetryCount(hash), 0);
      assert.equal(m.readSessionCount(c.sid), 0);
    });
    assert.equal(bucketSize(c), 0, 'records not consumed');
    assert.equal(lastLog(c).reason, exp.log_reason);
  });
});

for (const d of cleanup) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
}

console.log('test-402-card-fire-envelope: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
