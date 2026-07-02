'use strict';
// Phase 209-06 (H3) -- PRIMARY side-channel writer/reader + consumer wire.
//
// Behaviors 1-4 (Task 1): the module round trip, degrade paths, TTL, and the
// three producer call sites (hermetic fixtures; never touches the real
// ~/.mindrian). Behaviors 5-7 (Task 2): the check-card-fire.cjs consumer
// wire, source-verified against the constitutional floor.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const sidechannel = require(path.join(REPO, 'lib', 'core', 'card-fire-sidechannel.cjs'));
const { recordReachedGate, readReachedGates } = sidechannel;

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-209-primary-sidechannel');

function tmpFile() {
  return path.join(os.tmpdir(), 'gsd-sidechannel-' + Date.now() + '-' + Math.floor(Math.random() * 1e6) + '.json');
}

// ---------------------------------------------------------------------------
// Task 1: writer/reader behaviors
// ---------------------------------------------------------------------------

ok('Behavior 1: round trip - recordReachedGate then readReachedGates returns the entry; a different sessionId returns []', function () {
  const f = tmpFile();
  recordReachedGate({ sessionId: 's1', surface: 'lib/hmi/selector-dispatcher.cjs', shape: 'F.1', filePath: f });
  const got = readReachedGates('s1', { filePath: f });
  assert.equal(Array.isArray(got), true);
  assert.equal(got.indexOf('lib/hmi/selector-dispatcher.cjs') !== -1, true);
  const other = readReachedGates('s2', { filePath: f });
  assert.deepStrictEqual(other, []);
  fs.unlinkSync(f);
});

ok('Behavior 2: degrade - corrupt file, missing file, and an oversized file all yield [] / a silent no-op, never throw', function () {
  const corrupt = tmpFile();
  fs.writeFileSync(corrupt, 'not valid json {{{');
  assert.doesNotThrow(function () {
    const got = readReachedGates('s1', { filePath: corrupt });
    assert.deepStrictEqual(got, []);
  });
  fs.unlinkSync(corrupt);

  const missing = tmpFile(); // never created
  assert.doesNotThrow(function () {
    const got = readReachedGates('s1', { filePath: missing });
    assert.deepStrictEqual(got, []);
  });

  const oversized = tmpFile();
  fs.writeFileSync(oversized, JSON.stringify({ s1: [{ entry: 'x'.repeat(sidechannel.SIZE_CAP_BYTES * 5), ts: Date.now() }] }));
  assert.doesNotThrow(function () {
    const got = readReachedGates('s1', { filePath: oversized });
    assert.deepStrictEqual(got, []);
  });
  fs.unlinkSync(oversized);

  // recordReachedGate never throws on a garbage opts / unwritable path either.
  assert.doesNotThrow(function () { recordReachedGate(null); });
  assert.doesNotThrow(function () { recordReachedGate({ surface: 's', filePath: '/nonexistent-dir-xyz/definitely/not/writable.json' }); });
});

ok('Behavior 3: TTL - entries older than TTL_MS are pruned on read', function () {
  const f = tmpFile();
  const staleTs = Date.now() - (sidechannel.TTL_MS + 60000);
  fs.writeFileSync(f, JSON.stringify({ s1: [{ entry: 'stale/surface.cjs', ts: staleTs }] }));
  const got = readReachedGates('s1', { filePath: f });
  assert.deepStrictEqual(got, []);
  fs.unlinkSync(f);
});

ok('Behavior 4: the pickShape door writes ONLY when payload.emitTelemetry===true (fs_scope proof); the engine arm and emitBindingGate paths write their own records', function () {
  const f = tmpFile();
  const dispatcher = require(path.join(REPO, 'lib', 'hmi', 'selector-dispatcher.cjs'));

  const origEnv = process.env.CARD_FIRE_SIDECHANNEL_PATH;
  process.env.CARD_FIRE_SIDECHANNEL_PATH = f;
  try {
    // Without emitTelemetry: no write at all (file never created).
    dispatcher.pickShape({
      requestedShape: 'F.1',
      roomDir: null,
      operator: null,
      payload: { verbs: ['A', 'B'], header: 'h' },
    });
    assert.equal(fs.existsSync(f), false, 'no telemetry flag must mean zero FS side-effects');

    // With emitTelemetry: a record is written.
    dispatcher.pickShape({
      requestedShape: 'F.1',
      roomDir: null,
      operator: null,
      payload: { verbs: ['A', 'B'], header: 'h', emitTelemetry: true },
    });
    assert.equal(fs.existsSync(f), true, 'emitTelemetry:true must produce a side-channel record');
    const got = readReachedGates('no-session', { filePath: f });
    assert.equal(got.indexOf('lib/hmi/selector-dispatcher.cjs') !== -1, true);
  } finally {
    if (origEnv === undefined) delete process.env.CARD_FIRE_SIDECHANNEL_PATH;
    else process.env.CARD_FIRE_SIDECHANNEL_PATH = origEnv;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
});

ok('Source proof: recordReachedGate sits inside the emitTelemetry guard in selector-dispatcher.cjs; both intent-classifier.cjs sites are present', function () {
  const dispatcherSrc = fs.readFileSync(path.join(REPO, 'lib', 'hmi', 'selector-dispatcher.cjs'), 'utf8');
  const guardIdx = dispatcherSrc.indexOf('payloadObj.emitTelemetry === true');
  const producerIdx = dispatcherSrc.indexOf('recordReachedGate');
  assert.equal(guardIdx !== -1 && producerIdx !== -1 && producerIdx > guardIdx, true);

  const icSrc = fs.readFileSync(path.join(REPO, 'scripts', 'intent-classifier.cjs'), 'utf8');
  const count = (icSrc.match(/recordReachedGate/g) || []).length;
  assert.equal(count, 2, 'expected exactly 2 recordReachedGate call sites in intent-classifier.cjs');
});

// ---------------------------------------------------------------------------
// Task 2: the PRIMARY consumer wire in check-card-fire.cjs
// ---------------------------------------------------------------------------

const checkCardFire = require(path.join(REPO, 'scripts', 'check-card-fire.cjs'));

ok('Behavior 5: a session with side-channel records and no fired card classifies reached-gate-no-card even with plain-prose output text', function () {
  const f = tmpFile();
  const origEnv = process.env.CARD_FIRE_SIDECHANNEL_PATH;
  process.env.CARD_FIRE_SIDECHANNEL_PATH = f;
  try {
    recordReachedGate({ sessionId: 'sess-incident', surface: 'lib/hmi/selector-dispatcher.cjs', shape: 'F.1', filePath: f });

    const env = {
      session_id: 'sess-incident',
      output_text: 'Sounds good, want me to continue with that room?',
      askuserquestion_fired: false,
    };
    const turn = checkCardFire.deriveTurnSignals(env);
    assert.equal(turn.ran_entries.indexOf('lib/hmi/selector-dispatcher.cjs') !== -1, true, 'ran_entries must be populated from the side file');

    const registry = checkCardFire.loadRegistry();
    const verdict = checkCardFire.classifyCardFire(turn, registry);
    assert.equal(verdict.intercept, true);
    assert.equal(verdict.reason, 'reached-registry-gate-no-card');
  } finally {
    if (origEnv === undefined) delete process.env.CARD_FIRE_SIDECHANNEL_PATH;
    else process.env.CARD_FIRE_SIDECHANNEL_PATH = origEnv;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
});

ok('Behavior 5b: the SAME turn WITH a fired card classifies pass', function () {
  const f = tmpFile();
  const origEnv = process.env.CARD_FIRE_SIDECHANNEL_PATH;
  process.env.CARD_FIRE_SIDECHANNEL_PATH = f;
  try {
    recordReachedGate({ sessionId: 'sess-incident-2', surface: 'lib/hmi/selector-dispatcher.cjs', shape: 'F.1', filePath: f });
    const env = {
      session_id: 'sess-incident-2',
      output_text: 'Sounds good, want me to continue with that room?',
      askuserquestion_fired: true,
    };
    const turn = checkCardFire.deriveTurnSignals(env);
    const registry = checkCardFire.loadRegistry();
    const verdict = checkCardFire.classifyCardFire(turn, registry);
    assert.equal(verdict.intercept, false);
    assert.equal(verdict.reason, 'card-fired');
  } finally {
    if (origEnv === undefined) delete process.env.CARD_FIRE_SIDECHANNEL_PATH;
    else process.env.CARD_FIRE_SIDECHANNEL_PATH = origEnv;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
});

ok('Behavior 6: direct-field envelopes (the unit-test shape) keep precedence over the side file', function () {
  const f = tmpFile();
  const origEnv = process.env.CARD_FIRE_SIDECHANNEL_PATH;
  process.env.CARD_FIRE_SIDECHANNEL_PATH = f;
  try {
    recordReachedGate({ sessionId: 'sess-direct', surface: 'some/other-surface.cjs', shape: 'F.1', filePath: f });
    const env = {
      session_id: 'sess-direct',
      ran_entries: ['already-carried-entry.cjs'],
      output_text: 'plain text',
      askuserquestion_fired: false,
    };
    const turn = checkCardFire.deriveTurnSignals(env);
    assert.deepStrictEqual(turn.ran_entries, ['already-carried-entry.cjs'], 'an envelope that already carries ran_entries must not be overwritten by the side file');
  } finally {
    if (origEnv === undefined) delete process.env.CARD_FIRE_SIDECHANNEL_PATH;
    else process.env.CARD_FIRE_SIDECHANNEL_PATH = origEnv;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
});

ok('Behavior 7: an empty/missing side file leaves behavior byte-identical to today', function () {
  const f = tmpFile(); // never created -> readReachedGates degrades to []
  const origEnv = process.env.CARD_FIRE_SIDECHANNEL_PATH;
  process.env.CARD_FIRE_SIDECHANNEL_PATH = f;
  try {
    const env = { session_id: 'sess-empty', output_text: 'ordinary turn', askuserquestion_fired: false };
    const turn = checkCardFire.deriveTurnSignals(env);
    assert.deepStrictEqual(turn.ran_entries, []);
    const registry = checkCardFire.loadRegistry();
    const verdict = checkCardFire.classifyCardFire(turn, registry);
    assert.equal(verdict.intercept, false);
    assert.equal(verdict.reason, 'no-gate-signal');
  } finally {
    if (origEnv === undefined) delete process.env.CARD_FIRE_SIDECHANNEL_PATH;
    else process.env.CARD_FIRE_SIDECHANNEL_PATH = origEnv;
  }
});

ok('Constitutional floor is byte-untouched: MAX_FORCE_RETRIES=3, MAX_SESSION_INTERCEPTS=12', function () {
  assert.equal(checkCardFire.MAX_FORCE_RETRIES, 3);
  assert.equal(checkCardFire.MAX_SESSION_INTERCEPTS, 12);
  const src = fs.readFileSync(path.join(REPO, 'scripts', 'check-card-fire.cjs'), 'utf8');
  assert.equal(/const MAX_FORCE_RETRIES = 3;/.test(src), true);
  assert.equal(/const MAX_SESSION_INTERCEPTS = 12;/.test(src), true);
  assert.equal(src.indexOf('readReachedGates') !== -1, true, 'the consumer must call readReachedGates');
});

console.log('\nPASS test-209-primary-sidechannel (' + n + ' assertions)');
