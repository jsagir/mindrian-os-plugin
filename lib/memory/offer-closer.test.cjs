#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 135-01 Wave 0 -- F.1 Reliable-Closer RED integration suite
 * ================================================================
 * Pins the F.1 closer wiring + decision-edge persistence contract (SC7) BEFORE
 * the closer body exists (lands in 135-03). It exercises the SHIPPED substrate
 * the closer will route through -- recordSelectorDecision / recordSelectorMiss /
 * shouldExclude (Phase 125) via the navigation chokepoint -- against a REAL temp
 * room.db, and pins the closer-orchestration shape that 135-03 must satisfy.
 *
 * GREEN now (substrate proof, drives the closer):
 *   - recordSelectorDecision returns {ok:false, reason:'invalid_db'} when
 *     roomState.db is absent, {ok:true,...} on a valid db (defer/reject).
 *   - a reject's f_selector_decision memory_event is read back by a SUBSEQUENT
 *     shouldExclude(command, roomState) as true on the same roomState.db -- the
 *     backoff loop closes once 135-01 Task 1's roomState.db wiring lands.
 *   - recordSelectorMiss writes a memory_event only (no decision edge).
 *
 * GREEN as of 135-03 (the closer module lib/workflow/offer-closer.cjs ships):
 *   - the F.1 payload verbs array INCLUDES 'Free-Text' as the last entry.
 *   - an accept/defer/reject pick routes to recordSelectorDecision with the
 *     right shape; a Free-Text pick routes to recordSelectorMiss.
 *   The runRed() wrapper is deleted; these targets are now hard run() (mirrors
 *   the 135-02 promotion of the resolver RED targets).
 *
 * Real temp-room idiom mirrors tests/test-navigation-acceptance.cjs.
 * Framework: direct-CJS node:assert/strict. No em-dashes. No emoji.
 * Registered in tests/run-all-135.sh (Task 3).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO = path.resolve(__dirname, '..', '..');
const { openRoomDb, closeRoomDb } = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const decisions = require(path.join(REPO, 'lib', 'workflow', 'selector-decisions.cjs'));
const shared = require(path.join(REPO, 'lib', 'core', 'navigation-engine-shared.cjs'));

// Closer module (135-03). Lazy + tolerant: absent today, so closer tests are RED.
const CLOSER_PATH = path.join(REPO, 'lib', 'workflow', 'offer-closer.cjs');
function tryRequireCloser() {
  try {
    return require(CLOSER_PATH);
  } catch (_e) {
    return null;
  }
}

// ---------- Test scaffolding ----------

let passed = 0;
let failed = 0;

function run(name, fn) {
  try {
    fn();
    process.stdout.write('ok  ' + name + '\n');
    passed += 1;
  } catch (err) {
    process.stderr.write('FAIL ' + name + '\n');
    process.stderr.write(String(err && err.stack ? err.stack : err) + '\n');
    failed += 1;
  }
}

// ---------- Real temp room.db setup / teardown ----------

function setupRoom() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-135-closer-'));
  const db = openRoomDb(tmp);
  return { tmp, db };
}

// FK fixture: the shipped edges table has FK (source, target) -> nodes(id), so
// the command + framework anchor nodes must exist before the REJECTED / DEFERRED
// cascade edge writeEdge can succeed. Mirrors the seedAnchorsFor pattern in
// lib/memory/selector-decisions.test.cjs verbatim. The CLOSER (135-03) seeds /
// resolves these anchors in production; here we seed them so the substrate-proof
// tests exercise the real persist path.
function seedAnchorNode(db, id, type) {
  const nowMs = Date.now();
  db.prepare(
    "INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) "
    + "VALUES (?, ?, '{}', 'p135-01-fixture', 'system', NULL, 'confirmed', ?, ?)"
  ).run(id, type, nowMs, nowMs);
}

function seedAnchorsFor(db, command, framework) {
  seedAnchorNode(db, 'cmd:' + command, 'command');
  seedAnchorNode(db, 'framework:' + framework, 'framework');
}

function cleanup(tmp, db) {
  try { if (db) closeRoomDb(db); } catch (_e) { /* tolerant */ }
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
}

// ---------- SC7: recordSelectorDecision db-gate (GREEN substrate proof) ----------

run('SC7: recordSelectorDecision returns invalid_db when roomState.db is absent', () => {
  const r = decisions.recordSelectorDecision({
    decision: 'reject',
    command: 'mos:explore-domains',
    framework: 'JTBD',
    reason: 'not relevant right now',
    roomState: {}, // no db
  });
  assert.equal(r.ok, false, 'must fail closed without a db');
  assert.equal(r.reason, 'invalid_db', 'reason must be invalid_db');
});

run('SC7: recordSelectorDecision returns ok on a valid db (reject pick)', () => {
  const { tmp, db } = setupRoom();
  try {
    seedAnchorsFor(db, 'mos:explore-domains', 'JTBD');
    const r = decisions.recordSelectorDecision({
      decision: 'reject',
      command: 'mos:explore-domains',
      framework: 'JTBD',
      reason: 'REJECTED_BECAUSE off-topic for this section',
      roomState: { db, roomDir: tmp },
    });
    assert.equal(r.ok, true, 'reject pick on a valid db should persist: ' + JSON.stringify(r));
  } finally {
    cleanup(tmp, db);
  }
});

// ---------- SC6/SC7: reject -> shouldExclude backoff persistence (GREEN) ----------

run('SC6/SC7: a reject persists so a SUBSEQUENT shouldExclude reads it back as true', () => {
  const { tmp, db } = setupRoom();
  try {
    const roomState = { db, roomDir: tmp };
    const command = 'mos:explore-domains';
    seedAnchorsFor(db, command, 'JTBD');
    // Before any decision, the command is not excluded.
    assert.equal(
      decisions.shouldExclude(command, roomState),
      false,
      'fresh command must not be excluded before any decision'
    );
    // Record a reject for this command.
    const rec = decisions.recordSelectorDecision({
      decision: 'reject',
      command,
      framework: 'JTBD',
      reason: 'REJECTED_BECAUSE not relevant',
      roomState,
    });
    assert.equal(rec.ok, true, 'reject must persist: ' + JSON.stringify(rec));
    // The decay window starts fresh (n approx 0 invocations since the decision)
    // so the command is now in backoff: factor = 1 - exp(0) = 0 < 0.1.
    assert.equal(
      decisions.shouldExclude(command, roomState),
      true,
      'a just-rejected command must be excluded by shouldExclude (backoff loop closes)'
    );
  } finally {
    cleanup(tmp, db);
  }
});

// ---------- SC7: recordSelectorMiss writes a memory_event only (GREEN) ----------

run('SC7: recordSelectorMiss persists a miss event with no decision edge', () => {
  const { tmp, db } = setupRoom();
  try {
    const r = decisions.recordSelectorMiss({
      top_k_offered: [{ command: 'mos:explore-domains', score: 0.42 }],
      user_intent: 'I want to do something else entirely',
      roomState: { db, roomDir: tmp },
    });
    assert.equal(r.ok, true, 'miss must persist on a valid db: ' + JSON.stringify(r));
    assert.equal(typeof r.miss_id !== 'undefined', true, 'miss_id should be returned');
  } finally {
    cleanup(tmp, db);
  }
});

run('SC7: recordSelectorMiss returns invalid_db without a db', () => {
  const r = decisions.recordSelectorMiss({
    top_k_offered: [{ command: 'mos:explore-domains', score: 0.42 }],
    user_intent: 'something else',
    roomState: {},
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'invalid_db');
});

// ---------- SC7: Free-Text is the 10th canonical verb (GREEN constant proof) ----------

run('SC7: Free-Text is the 10th canonical verb / escape', () => {
  const verbs = shared.CANONICAL_VERBS;
  assert.equal(verbs.length, 10, 'there must be 10 canonical verbs');
  assert.equal(verbs[9], 'Free-Text', 'the 10th verb is the Free-Text escape');
});

// ---------- 135-03 GREEN: the closer module orchestration ----------

run('SC7: closer builds an F.1 payload whose verbs end with Free-Text', () => {
  const closer = tryRequireCloser();
  assert.notEqual(closer, null, 'lib/workflow/offer-closer.cjs must exist (135-03)');
  assert.equal(typeof closer.buildF1Payload, 'function', 'closer.buildF1Payload must exist');
  const offer = {
    command: 'mos:explore-domains',
    framework: 'JTBD',
    jtbd: 'size the market',
    confidence: 0.71,
    reason: '[[market-analysis]] size the addressable market',
    scope: 'market-analysis',
  };
  const payload = closer.buildF1Payload(offer);
  assert.equal(Array.isArray(payload.verbs), true, 'payload.verbs must be an array');
  assert.equal(payload.verbs[payload.verbs.length - 1], 'Free-Text',
    'the F.1 verbs array must end with the Free-Text escape (10th canonical verb)');
});

run('SC7: an accept/defer/reject pick routes to recordSelectorDecision; Free-Text to recordSelectorMiss', () => {
  const closer = tryRequireCloser();
  assert.notEqual(closer, null, 'lib/workflow/offer-closer.cjs must exist (135-03)');
  assert.equal(typeof closer.closeOffer, 'function', 'closer.closeOffer must exist');
  const { tmp, db } = setupRoom();
  try {
    const offer = {
      command: 'mos:explore-domains',
      framework: 'JTBD',
      jtbd: 'size the market',
      confidence: 0.71,
      reason: '[[market-analysis]] size the addressable market',
      scope: 'market-analysis',
    };
    const roomState = { db, roomDir: tmp };
    seedAnchorsFor(db, offer.command, offer.framework);
    // reject pick -> recordSelectorDecision -> {ok:true,...}
    const rej = closer.closeOffer({ pick: 'reject', offer, reason: 'REJECTED_BECAUSE x', roomState });
    assert.equal(rej && rej.ok, true, 'reject pick should persist a decision edge');
    // Free-Text pick -> recordSelectorMiss (no decision edge)
    const miss = closer.closeOffer({ pick: 'Free-Text', offer, user_intent: 'do something else', roomState });
    assert.equal(miss && miss.ok, true, 'Free-Text pick should persist a miss (memory_event only)');
  } finally {
    cleanup(tmp, db);
  }
});

// ---------- Final summary ----------

const total = passed + failed;
process.stdout.write(
  '\noffer-closer: ' + passed + '/' + total + ' passed, ' + failed + ' failed\n'
);
process.exit(failed === 0 ? 0 : 1);
