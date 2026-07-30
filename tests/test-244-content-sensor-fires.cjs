'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 244 Plan 05 Task 3 -- proves SENS-16 (the content-relevance sensor)
 * fires on real lexical relevance, stays silent on noise, distinguishes an
 * absent index from a genuine zero-hit, degrades honestly when the FTS5
 * capability is forced absent, survives punctuation, and carries only closed
 * scalars on its reach (Canon Part 8).
 *
 * FIRE / ANTI-FIRE share ONE built index in the SAME run (244-PATTERNS.md /
 * 244-RESEARCH.md Pitfall 3): asserting the anti-fire turns against an empty
 * index would pass vacuously. The corpus is deliberately CURATED (two dense
 * `claim`-shaped clusters plus a memory_artifact whose real markdown body on
 * disk is read via the roomDir fallback) and EXCLUDES `fragments` -- a live
 * assertion pins that exclusion, not just a comment.
 *
 * No em-dashes anywhere (CLAUDE.md HARD RULE).
 */

require('./eureka-offline-preload.cjs');

const ENV_MOS_NO_DETACHED_AT_START = process.env.MOS_NO_DETACHED_FTS_BUILD;
process.env.MOS_NO_DETACHED_FTS_BUILD = '1';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { buildFixtureRoom } = require('./helpers/fixture-room-219.cjs');
const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');
const navigation = require('../lib/core/navigation.cjs');
const memoryOps = require('../lib/core/memory-ops.cjs');
const tri = require('../lib/core/eureka/tri-modal-index.cjs');
const ftsLifecycle = require('../lib/core/eureka/fts-index-lifecycle.cjs');
const sensorTypes = require('../lib/core/sensors/sensor-types.cjs');
const insight = require('../lib/core/insight-sensors.cjs');
const engine = require('../lib/core/navigation-engine.cjs');

const CONTENT_SENSOR_PATH = require.resolve('../lib/core/sensors/sensor-content-relevance.cjs');

// ---------- Deterministic offline stub encoder (no model, no network) ----------

function stubEncode(texts) {
  return texts.map(function (t) {
    const v = new Array(16).fill(0);
    const s = String(t);
    for (let i = 0; i < s.length; i += 1) {
      v[s.charCodeAt(i) % 16] += 1;
    }
    let norm = Math.sqrt(v.reduce(function (a, x) { return a + x * x; }, 0));
    if (norm === 0) norm = 1;
    return v.map(function (x) { return x / norm; });
  });
}

// ---------- The FIRE / ANTI-FIRE turns ----------
//
// 244-RESEARCH.md Pitfall 3's own measured example turn ("the reverse salient
// in the graph derivation pipeline") is deliberately NOT reused here: it
// literally contains the phrase `/\breverse salient\b/i`, which is
// sensor-lagging-component.cjs's OWN keyword pattern (LAGGING_PATTERNS), and
// sensor-circularity.cjs REUSES that exact signal as its stuck_unlocated
// cause (sensor-circularity.cjs:56-58's documented reuse-before-build call).
// Live-verified: that phrase fires BOTH sensors even with the content ctx
// scalars zeroed, which would make the CONTROL leg below meaningless (it
// could no longer prove the fire is attributable to SENS-16 alone). The
// turns below are live-verified (dispatchSensors with content ctx zeroed)
// to produce ZERO reaches from every one of the other 17 sensors.
const FIRE_TURN = 'opportunity bank agentic reasoning environment';
const FIRE_TURN_PUNCTUATED = "what about the opportunity bank (agentic reasoning environment)? it's the framework!";
const SECOND_RELEVANT_TURN = 'wiki dashboard export snapshot templates for the data room';
const ANTI_FIRE_TURNS = [
  'what is the weather in paris today',
  'my cat needs a vet appointment tomorrow',
  'order pizza for dinner tonight',
];

// A word planted ONLY in a `fragments` row, never in any `nodes` row -- the
// corpus-scoping tripwire (Pitfall 3's live assertion, not just a comment).
const FRAGMENTS_ONLY_WORD = 'zylophantine';

// ---------- Test harness (PASS/FAIL/FAILURES, the test-219-fts5-degrade.cjs shape) ----------

let PASS = 0;
let FAIL = 0;
const FAILURES = [];

async function test(name, fn) {
  try {
    await fn();
    PASS += 1;
    console.log('  PASS: ' + name);
  } catch (err) {
    FAIL += 1;
    FAILURES.push({ name: name, err: err });
    console.log('  FAIL: ' + name + ' -- ' + (err && err.message));
  }
}

// ---------- makeReach evidence spy (proves the PRE-filter evidence bag is clean, not merely backstopped by makeReach's primitive filter) ----------
//
// MUTATION PROOF 2 (transcribed in 244-05-SUMMARY.md) found live that
// makeReach's primitive-only filter (sensor-types.cjs:256-267) SILENTLY DROPS
// a non-primitive evidence key, so a test that only inspects the FINAL
// reach.evidence stays green even when the pure sensor's own evidence
// literal carries an array. This spy intercepts the RAW opts.evidence object
// sensorContentRelevance passes to makeReach, before that filter runs, so
// the Part-8 leg below fences the discipline rather than merely
// backstopping it (the plan's own required finding-and-strengthen step).
function withRawEvidenceSpy(fn) {
  const realMakeReach = sensorTypes.makeReach;
  let capturedRawEvidence = null;
  sensorTypes.makeReach = function (opts) {
    if (opts && opts.reach_id === 'context_block' && opts.signal === 'content_relevance') {
      capturedRawEvidence = opts.evidence;
    }
    return realMakeReach(opts);
  };
  // Force sensor-content-relevance.cjs to re-bind `makeReach` off the
  // (already-cached, now-patched) sensor-types.cjs exports object.
  delete require.cache[CONTENT_SENSOR_PATH];
  try {
    const patchedSensor = require(CONTENT_SENSOR_PATH);
    const result = fn(patchedSensor);
    return { result: result, rawEvidence: capturedRawEvidence };
  } finally {
    sensorTypes.makeReach = realMakeReach;
    delete require.cache[CONTENT_SENSOR_PATH];
  }
}

function assertOnlyPrimitives(obj, label) {
  assert.ok(obj && typeof obj === 'object' && !Array.isArray(obj), label + ' must be a plain object');
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    const t = typeof v;
    assert.ok(t === 'string' || t === 'number' || t === 'boolean',
      label + '.' + k + ' must be a closed scalar (string/number/boolean), got ' + t);
  }
}

async function main() {
  console.log('Phase 244 Plan 05 -- SENS-16 content-relevance sensor (offline, deterministic)');

  const tmp1 = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-244-content-'));
  const fixture = buildFixtureRoom(tmp1);
  const roomDir = fixture.roomDir;
  let db = null;

  // Transcribed for the SUMMARY (observed hit counts for all four turns).
  const observed = {};

  try {
    db = openRoomDb(roomDir, { allowExtension: true });

    // ---- Build the curated corpus: two dense `claim` clusters ----
    const clusterA = [
      'Opportunity bank agentic reasoning environment lets Larry propose candidate reaches drawn from the opportunity bank.',
      'The agentic reasoning environment behind the opportunity bank scores each candidate through the Q2 connection gate.',
    ];
    const clusterB = [
      'Wiki dashboard export snapshot templates render the De Stijl grid for every data room page.',
      'The De Stijl grid template renders every wiki dashboard export snapshot page consistently.',
    ];
    let seg = 0;
    for (const text of clusterA.concat(clusterB)) {
      seg += 1;
      const w = navigation.writeClaimNode(db, {
        knowledge_type: 'fact',
        text: text,
        sessionId: 'test-244-content',
        sourceSegment: 'seg-' + seg,
      });
      assert.ok(w && w.ok === true, 'writeClaimNode must succeed: ' + JSON.stringify(w));
    }

    // ---- Plant a `fragments` row carrying a word that exists NOWHERE in
    // `nodes` -- the corpus-scoping tripwire (Pitfall 3 as a live assertion). ----
    const session = await memoryOps.startSession(db);
    await memoryOps.addFragment(db, {
      session_id: session.id,
      role: 'user',
      content: 'a completely unrelated fragment mentioning ' + FRAGMENTS_ONLY_WORD + ' exactly once',
    });

    // ---- Index the corpus (offline stub encoder; roomDir threads the
    // Artifact/memory_artifact path-body fallback the fixture's hub/satellite
    // nodes exercise). ----
    const idxResult = await tri.indexNodes(db, { encodeFn: stubEncode, roomDir: roomDir });
    assert.ok(idxResult && idxResult.fts_backend === 'fts5', 'fts5 must be live for this offline run: ' + JSON.stringify(idxResult));

    const { sensorContentRelevance, detectContentRelevance } = require(CONTENT_SENSOR_PATH);

    // ---- Assert the fixture HAS a `fragments` table with rows (the
    // scoping assertion needs a real row to exclude, not an empty table). ----
    await test('corpus scoping: fragments table exists with rows', function () {
      const fragCount = db.prepare('SELECT count(*) AS c FROM fragments').get().c;
      assert.ok(fragCount >= 1, 'fragments table must carry at least one row');
    });

    // ---- Assert a query matching ONLY fragments content returns ZERO
    // content candidates (the live Pitfall-3 anti-regression). ----
    await test('corpus scoping: a fragments-only word yields zero content candidates', function () {
      const sig = detectContentRelevance(db, { turnText: FRAGMENTS_ONLY_WORD, roomDir: roomDir });
      assert.strictEqual(sig.state, 'ok', 'index is built and live');
      assert.strictEqual(sig.hits, 0, 'fragments content must never surface as a content candidate');
    });

    // ---- FIRE: real lexical relevance, no structural signal, no keyword hit. ----
    let fireCtx = null;
    await test('FIRE: real lexical relevance produces exactly one context_block reach with trigger_tier content', function () {
      const sig = detectContentRelevance(db, { turnText: FIRE_TURN, roomDir: roomDir });
      observed.fire = { hits: sig.hits, coverage: sig.coverage, state: sig.state };
      assert.strictEqual(sig.state, 'ok');
      assert.ok(sig.hits > 0, 'the fire turn must score at least one hit in this run');

      fireCtx = { contentHitCount: sig.hits, contentCoverage: sig.coverage, contentIndexState: sig.state };
      const turn = { text: FIRE_TURN };
      const tuple = {};
      const reaches = insight.dispatchSensors(turn, tuple, fireCtx);
      const contentReaches = reaches.filter(function (r) { return r.evidence && r.evidence.trigger_tier === 'content'; });
      assert.strictEqual(contentReaches.length, 1, 'exactly one content-tier reach must fire');
      assert.strictEqual(contentReaches[0].reach_id, 'context_block');
      assert.strictEqual(contentReaches[0].posture, 'hold');
    });

    // ---- INTEGRATION: the FULL navigation-engine.cjs decide() pipeline
    // (ctx-assembly producer -> dispatchSensors -> context_assembly), not
    // just the sensor layer called directly. This is the leg MUTATION
    // PROOFS 3 and 4 (Task 2) are re-confirmed against: removing the
    // detectContentRelevance call from the producer block, or narrowing the
    // turn-text read to t.userText only, must turn THIS assertion red. ----
    await test('INTEGRATION (decide()): the full navigation-engine pipeline threads content evidence end to end', function () {
      const out = engine.decide({ text: FIRE_TURN }, { roomDb: db, roomDir: roomDir });
      assert.ok(out && out.decision_trace && out.decision_trace.context_assembly, 'decide() must return a context_assembly');
      const facts = out.decision_trace.context_assembly.facts;
      assert.ok(Array.isArray(facts), 'context_assembly.facts must be an array');
      const contentFact = facts.find(function (f) {
        return f && f.evidence && f.evidence.trigger_tier === 'content';
      });
      assert.ok(contentFact, 'decide() must thread the content-relevance reach into context_assembly.facts: ' + JSON.stringify(facts));
      assert.strictEqual(contentFact.reach_id, 'context_block');
      assert.strictEqual(contentFact.posture, 'hold');
      assert.ok(contentFact.evidence.hit_count > 0);
    });

    // ---- CONTROL: the same turn with the content ctx scalars zeroed
    // produces NO reach from ANY sensor (proves the fire is attributable to
    // SENS-16 alone, not some other sensor's own keyword list). ----
    await test('CONTROL: the fire turn with content ctx zeroed fires no reach at all', function () {
      const zeroedCtx = { contentHitCount: 0, contentCoverage: 0, contentIndexState: 'ok' };
      const reaches = insight.dispatchSensors({ text: FIRE_TURN }, {}, zeroedCtx);
      assert.strictEqual(reaches.length, 0, 'the fire turn must not be attributable to any other sensor: ' + JSON.stringify(reaches));
    });

    // ---- The second dense cluster's own turn also fires (extra data point). ----
    await test('FIRE (second cluster): opportunity-bank turn also produces a content hit', function () {
      const sig = detectContentRelevance(db, { turnText: SECOND_RELEVANT_TURN, roomDir: roomDir });
      observed.second = { hits: sig.hits, coverage: sig.coverage, state: sig.state };
      assert.strictEqual(sig.state, 'ok');
      assert.ok(sig.hits > 0, 'the second relevant turn must also score at least one hit');
    });

    // ---- ANTI-FIRE: the three measured irrelevant turns, against the SAME
    // built index, in the SAME run. ----
    observed.antiFire = {};
    for (const turnText of ANTI_FIRE_TURNS) {
      await test('ANTI-FIRE: "' + turnText + '" produces zero content candidates against the built index', function () {
        const sig = detectContentRelevance(db, { turnText: turnText, roomDir: roomDir });
        observed.antiFire[turnText] = { hits: sig.hits, coverage: sig.coverage, state: sig.state };
        assert.strictEqual(sig.state, 'ok', 'the index stays live for the anti-fire legs too');
        assert.strictEqual(sig.hits, 0, 'an irrelevant turn must produce zero hits: ' + turnText);
        const ctx = { contentHitCount: sig.hits, contentCoverage: sig.coverage, contentIndexState: sig.state };
        const reach = sensorContentRelevance({ text: turnText }, {}, ctx);
        assert.strictEqual(reach, null, 'an irrelevant turn must never fire the sensor: ' + turnText);
      });
    }

    // ---- PUNCTUATION: apostrophes, a question mark, parentheses -- fires
    // exactly as the unpunctuated equivalent, nothing throws. ----
    await test('PUNCTUATION: apostrophes/question-mark/parens turn fires exactly as its unpunctuated equivalent', function () {
      let sig;
      assert.doesNotThrow(function () {
        sig = detectContentRelevance(db, { turnText: FIRE_TURN_PUNCTUATED, roomDir: roomDir });
      }, 'punctuated turn text must never throw');
      observed.punctuated = { hits: sig.hits, coverage: sig.coverage, state: sig.state };
      assert.strictEqual(sig.state, 'ok');
      assert.ok(sig.hits > 0, 'the punctuated turn must still score at least one hit');
      const ctx = { contentHitCount: sig.hits, contentCoverage: sig.coverage, contentIndexState: sig.state };
      const reach = sensorContentRelevance({ text: FIRE_TURN_PUNCTUATED }, {}, ctx);
      assert.ok(reach, 'the punctuated turn must fire exactly as the unpunctuated equivalent does');
    });

    // ---- PART 8 (with the raw-evidence spy, per MUTATION PROOF 2's finding): ----
    await test('PART 8: the fired reach carries closed scalars only (pre- AND post-makeReach), no matched text, no node id', function () {
      const { rawEvidence, result: reach } = withRawEvidenceSpy(function (patchedSensor) {
        return patchedSensor.sensorContentRelevance({ text: FIRE_TURN }, {}, fireCtx);
      });
      assert.ok(reach, 'the sensor must fire under the spy exactly as it does unpatched');
      // Iterate PROGRAMMATICALLY (not a hardcoded key list) so a future added
      // key is caught by construction, not by memory.
      assertOnlyPrimitives(reach.evidence, 'reach.evidence');
      assert.ok(rawEvidence, 'the raw pre-makeReach evidence object must have been captured');
      assertOnlyPrimitives(rawEvidence, 'raw pre-makeReach evidence');

      const allNodeIds = fixture.ids.sections.reduce(function (acc, s) {
        acc.push(fixture.ids.hubs[s]);
        fixture.ids.satellites[s].forEach(function (id) { acc.push(id); });
        return acc;
      }, []).concat(Object.keys(fixture.ids.entities).map(function (n) { return fixture.ids.entities[n]; }));

      for (const bag of [reach.evidence, rawEvidence]) {
        for (const k of Object.keys(bag)) {
          const v = bag[k];
          if (typeof v === 'string') {
            assert.strictEqual(v.indexOf(FIRE_TURN), -1, 'evidence.' + k + ' must not contain turn-text substring');
            assert.ok(allNodeIds.indexOf(v) === -1, 'evidence.' + k + ' must not equal a fixture node id');
          }
        }
      }
    });

    // ---- INDEX ABSENT: a fresh room whose eureka_fts was NEVER created. ----
    let tmp2 = null;
    let db2 = null;
    await test('INDEX ABSENT: an unbuilt index is distinguishable from a genuine zero-hit and enqueues its own repair', function () {
      tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-244-absent-'));
      const fixture2 = buildFixtureRoom(tmp2);
      db2 = openRoomDb(fixture2.roomDir, { allowExtension: true });
      assert.strictEqual(tri.tableExists(db2, 'eureka_fts'), false, 'eureka_fts must not exist before any index build');

      const sig = detectContentRelevance(db2, { turnText: FIRE_TURN, roomDir: fixture2.roomDir });
      assert.strictEqual(sig.state, 'index_absent', 'an unbuilt index must report index_absent, never ok');
      assert.strictEqual(sig.hits, 0);

      const reach = sensorContentRelevance({ text: FIRE_TURN }, {}, {
        contentHitCount: 99, contentCoverage: 1, contentIndexState: sig.state,
      });
      assert.strictEqual(reach, null, 'index_absent must never fire, even with a fabricated hit count');

      // The miss enqueues its own repair: a build request lands in the
      // room's queue file (lib/core/eureka/fts-index-lifecycle.cjs).
      const q = ftsLifecycle.readQueue(fixture2.roomDir);
      assert.ok(Array.isArray(q.entries) && q.entries.length >= 1, 'a build request must be queued');
      const entry = q.entries.find(function (e) { return path.resolve(e.roomDir) === path.resolve(fixture2.roomDir); });
      assert.ok(entry, 'the queued entry must reference this room');
      assert.strictEqual(entry.reason, 'index_absent');
      assert.ok(fs.existsSync(ftsLifecycle.queuePath(fixture2.roomDir)), 'the queue file must exist on disk');
    });
    if (db2) { try { closeRoomDb(db2); } catch (_e) { /* ignore */ } }
    if (tmp2) { try { fs.rmSync(tmp2, { recursive: true, force: true }); } catch (_e) { /* ignore */ } }

    // ---- FTS FORCED ABSENT: capability forced off on a room whose index
    // WAS built earlier -- the exact silent-swallow bug Pitfall 1 documents. ----
    await test('FTS FORCED ABSENT: a forced-absent capability on an already-built index reports a non-ok state, never a false zero-hit', function () {
      process.env.MINDRIAN_FORCE_FTS_ABSENT = '1';
      tri._test.resetFtsProbe();
      try {
        let sig;
        assert.doesNotThrow(function () {
          sig = detectContentRelevance(db, { turnText: FIRE_TURN, roomDir: roomDir });
        }, 'a forced-absent capability must never throw');
        assert.notStrictEqual(sig.state, 'ok', 'a forced-absent capability must never present as a legitimate zero-hit');
        assert.strictEqual(sig.hits, 0);

        const reach = sensorContentRelevance({ text: FIRE_TURN }, {}, {
          contentHitCount: 99, contentCoverage: 1, contentIndexState: sig.state,
        });
        assert.strictEqual(reach, null, 'a non-ok state must never fire, even with a fabricated hit count');
      } finally {
        delete process.env.MINDRIAN_FORCE_FTS_ABSENT;
        tri._test.resetFtsProbe();
      }
    });

    // ---- CTX-OVERRIDE SEAM: the sensor fires purely off caller-threaded ctx
    // scalars, with NO db and NO fixture at all. ----
    await test('CTX-OVERRIDE SEAM: sensorContentRelevance fires from caller-threaded ctx alone, no db, no fixture', function () {
      const reach = sensorContentRelevance({ text: 'anything' }, {}, {
        contentHitCount: 5, contentCoverage: 0.9, contentIndexState: 'ok',
      });
      assert.ok(reach, 'the seam must let a unit test fire the sensor with zero I/O');
      assert.strictEqual(reach.evidence.trigger_tier, 'content');
    });

    // ---- PURITY: calling sensorContentRelevance with a ctx whose roomDb is
    // a throwing proxy performs no filesystem or db access (the pure sensor
    // never even LOOKS at ctx.roomDb -- it only reads content* scalars). ----
    await test('PURITY: a hostile ctx.roomDb (a proxy that throws on any property access) is never touched', function () {
      const hostileRoomDb = new Proxy({}, {
        get: function () { throw new Error('sensorContentRelevance must never touch ctx.roomDb'); },
      });
      const ctx = { contentHitCount: 5, contentCoverage: 0.9, contentIndexState: 'ok', roomDb: hostileRoomDb };
      let reach;
      assert.doesNotThrow(function () {
        reach = sensorContentRelevance({ text: 'anything' }, {}, ctx);
      }, 'the pure sensor must never dereference a hostile ctx.roomDb');
      assert.ok(reach, 'the sensor must still fire off the content* scalars alone');
    });

    // ---- Never throws on hostile / malformed input of every documented shape. ----
    await test('NEVER THROWS: null / undefined / string / hostile-key object inputs', function () {
      assert.doesNotThrow(function () { sensorContentRelevance(null, null, null); });
      assert.doesNotThrow(function () { sensorContentRelevance(undefined, undefined, undefined); });
      assert.doesNotThrow(function () { sensorContentRelevance('a string', 'a string', 'a string'); });
      assert.doesNotThrow(function () {
        sensorContentRelevance({}, {}, { toString: function () { throw new Error('hostile'); }, contentIndexState: 'ok' });
      });
    });

    console.log('\nObserved hit counts (transcribed for 244-05-SUMMARY.md):');
    console.log(JSON.stringify(observed, null, 2));
  } finally {
    if (db) { try { closeRoomDb(db); } catch (_e) { /* ignore */ } }
    try { fs.rmSync(tmp1, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
    if (typeof ENV_MOS_NO_DETACHED_AT_START === 'string') {
      process.env.MOS_NO_DETACHED_FTS_BUILD = ENV_MOS_NO_DETACHED_AT_START;
    } else {
      delete process.env.MOS_NO_DETACHED_FTS_BUILD;
    }
  }

  console.log('\ntest-244-content-sensor-fires: PASS=' + PASS + ' FAIL=' + FAIL);
  if (FAIL > 0) {
    FAILURES.forEach(function (f) { console.log('  - ' + f.name + ': ' + (f.err && f.err.stack)); });
    process.exit(1);
  }

  // Interpreter-anchored orphan-process check: no detached fts-index-drain
  // worker must survive this run (MOS_NO_DETACHED_FTS_BUILD suppresses the
  // spawn entirely, so this must always find nothing).
  try {
    const { execSync } = require('node:child_process');
    const out = execSync('pgrep -af "^[^ ]*node .*fts-index-drain" || true').toString().trim();
    if (out) {
      console.log('ORPHAN PROCESS DETECTED:\n' + out);
      process.exit(1);
    }
  } catch (_e) {
    // pgrep absent on this platform -- not a failure of this test.
  }

  process.exit(0);
}

main();
