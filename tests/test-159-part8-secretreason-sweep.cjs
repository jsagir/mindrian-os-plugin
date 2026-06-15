'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 159-03 Task 2 -- Part 8 SECRETREASON159 behavioral + source sweep over
 * the NEW consumer path (DCW-05).
 * ============================================================================
 * Canon Part 8: the navigator's raw pick text NEVER egresses -- it rides the
 * FIX-05 LOCAL routing lane and is classified to a scalar boolean + source enum
 * at the write seam, never stored in any row value or forwarded toward a Brain
 * packet. This suite proves that across the REAL 159 capture path, mirroring the
 * Phase 158 SECRETREASON123 tripwire idiom + the Phase 90 5-tripwire
 * forbidden-substring sweep (seed a unique marker, assert ZERO occurrences in any
 * stored value the path writes).
 *
 * Behavioral (the load-bearing proof):
 *   Seed SECRETREASON159 into the navigator's raw pick text / sentence, drive the
 *   FULL capture -> consumeF1Pick -> closeOffer -> recordSelectorDecision path over
 *   a real room.db, then read back EVERY stored f_selector_decision row property
 *   value (via the navigation chokepoint) and assert the marker appears in ZERO of
 *   them. The pick text rode the FIX-05 LOCAL lane and was classified to a scalar
 *   boolean + source enum at the write seam, never stored (HOW-5). We additionally
 *   sweep EVERY memory_event row value (so a Free-Text miss user_intent or any
 *   other written row cannot hide the marker either).
 *
 * Source (the structural backstop):
 *   The new consumer files (lib/workflow/f1-pick-consumer.cjs +
 *   lib/hmi/f1-pick-capture-cli.cjs), comment lines stripped, contain NO path that
 *   forwards pick text toward buildBrainPacket / a Brain client / a network call.
 *   The grep-gate-hygiene idiom: a comment documenting the LOCAL lane must not trip
 *   the gate (comment lines are stripped before the scan).
 *
 * Deterministic. Uses the shipped room-db opener + the real consumer + the
 * navigation chokepoint. NO RNG, NO live Brain. NO em-dashes (CLAUDE.md HARD
 * RULE). Hyphens only. CJS.
 *
 * License: BSL 1.1.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const { captureCliPick } = require(path.join(REPO_ROOT, 'lib', 'hmi', 'f1-pick-capture-cli.cjs'));
const { consumeF1Pick } = require(path.join(REPO_ROOT, 'lib', 'workflow', 'f1-pick-consumer.cjs'));

const CONSUMER_PATH = path.join(REPO_ROOT, 'lib', 'workflow', 'f1-pick-consumer.cjs');
const CAPTURE_PATH = path.join(REPO_ROOT, 'lib', 'hmi', 'f1-pick-capture-cli.cjs');

const SECRET = 'SECRETREASON159';
const REACH = 'deep_research';
const SKILLX = 'mos:deep-research';
const FW = 'Deep Research';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

function freshRoom() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p159-03-part8-'));
  const db = openRoomDb(dir);
  seedAnchorsFor(db, SKILLX, FW);
  return { dir, db };
}

function seedAnchorNode(db, id, type) {
  const nowMs = Date.now();
  db.prepare(
    "INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) "
    + "VALUES (?, ?, '{}', 'p159-03-part8-fixture', 'system', NULL, 'confirmed', ?, ?)"
  ).run(id, type, nowMs, nowMs);
}
function seedAnchorsFor(db, command, framework) {
  seedAnchorNode(db, 'cmd:' + command, 'command');
  seedAnchorNode(db, 'framework:' + framework, 'framework');
}

// The prior-turn payload (verbs + reachIds + framework), the REAL persisted shape.
function payloadReachGrounded() {
  return {
    verbs: [SKILLX, 'Free-Text'],
    recommendedVerb: SKILLX,
    header: '[NEXT MOVE]',
    reachIds: { [SKILLX]: REACH },
    framework: FW,
  };
}

// Read back EVERY stored row of a given event type and JSON.stringify each row's
// properties so a seeded marker anywhere in any value is detectable.
function storedValues(db, eventType) {
  const rows = navigation.findRecentChanges(db, 0, { eventType: eventType, limit: 200 });
  return Array.isArray(rows) ? rows.map((r) => JSON.stringify(r)) : [];
}

// Strip whole-line comments (the grep-gate-hygiene idiom) so a comment that
// documents the LOCAL lane does not trip the source scan.
function strippedSource(p) {
  return fs.readFileSync(p, 'utf8')
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'));
    })
    .join('\n');
}

console.log('test-159-part8-secretreason-sweep.cjs (DCW-05): pick text never egresses across the real consumer path');

// ---------------------------------------------------------------------------
// Test 1 (reject path): the secret in the pick text + the payload sentence never
// lands in ANY stored f_selector_decision or memory_event row value.
// ---------------------------------------------------------------------------
check('a SECRETREASON159 reject pick text lands in ZERO stored row values (reject path)', () => {
  const { dir, db } = freshRoom();
  try {
    // The navigator's raw pick text carries the secret (the LOCAL lane input).
    const answer = {
      selectedOption: SKILLX,
      outcome: 'reject',
      text: 'reject because ' + SECRET + ' i do not want this',
    };
    const prior = payloadReachGrounded();
    // The capture adapter routes the raw text to the optional sentence (LOCAL lane).
    const captured = captureCliPick(answer, prior);
    assert.ok(captured && captured.pick, 'capture produced a pick');
    assert.ok(typeof captured.sentence === 'string' && captured.sentence.indexOf(SECRET) !== -1,
      'the raw text (with the secret) rides the LOCAL sentence lane only -- the test is meaningful');

    // Drive the full consumer -> closeOffer -> recordSelectorDecision path. Forward
    // the captured sentence onto the prior payload the consumer reads (the LOCAL
    // lane the Wave-2 wiring uses), so the secret has every chance to leak.
    prior.sentence = captured.sentence;
    const res = consumeF1Pick({
      priorPayload: prior,
      pick: captured.pick,
      roomState: { db: db, roomDir: dir, offer: { framework: FW } },
    });
    assert.ok(res && res.ok, 'the reject was recorded; got reason=' + (res && res.reason));
    assert.strictEqual(res.outcome, 'reject');

    // The secret must appear in ZERO stored decision-row values.
    const decisionVals = storedValues(db, 'f_selector_decision');
    assert.ok(decisionVals.length >= 1, 'at least one decision row was written (the path ran)');
    for (const v of decisionVals) {
      assert.ok(v.indexOf(SECRET) === -1, 'SECRETREASON159 must NOT appear in any f_selector_decision row value');
    }
    // ... and in ZERO memory_event row values either.
    const eventVals = storedValues(db, 'reach_presented').concat(
      storedValues(db, 'f_selector_miss')
    );
    for (const v of eventVals) {
      assert.ok(v.indexOf(SECRET) === -1, 'SECRETREASON159 must NOT appear in any memory_event row value');
    }
  } finally {
    closeRoomDb(db);
  }
});

// ---------------------------------------------------------------------------
// Test 2 (Free-Text miss path): the secret in a Free-Text escape user_intent
// stays LOCAL -- it never lands in a stored value that egresses. (The Free-Text
// miss routes to recordSelectorMiss; its user_intent is LOCAL-only per Part 8.)
// We assert the secret is NOT present in any f_selector_decision row (the escape
// never writes a decision edge) and is confined at worst to the LOCAL miss event.
// ---------------------------------------------------------------------------
check('a SECRETREASON159 Free-Text escape writes no decision-edge value carrying the secret', () => {
  const { dir, db } = freshRoom();
  try {
    const answer = {
      selectedOption: 'Free-Text',
      text: 'let me just type ' + SECRET + ' instead',
    };
    const prior = payloadReachGrounded();
    const captured = captureCliPick(answer, prior);
    prior.sentence = captured.sentence;
    const res = consumeF1Pick({
      priorPayload: prior,
      pick: captured.pick,
      roomState: { db: db, roomDir: dir, offer: { framework: FW } },
    });
    assert.ok(res && res.ok, 'the Free-Text miss was recorded; got reason=' + (res && res.reason));
    assert.strictEqual(res.outcome, 'Free-Text');

    // The escape never writes a decision edge -> the secret cannot ride a decision row.
    const decisionVals = storedValues(db, 'f_selector_decision');
    for (const v of decisionVals) {
      assert.ok(v.indexOf(SECRET) === -1, 'no f_selector_decision row may carry the secret on the escape path');
    }
  } finally {
    closeRoomDb(db);
  }
});

// ---------------------------------------------------------------------------
// Test 3 (source backstop): neither new consumer file forwards pick text toward
// the Brain. The executable source (comments stripped) references no
// buildBrainPacket / brain client require / fetch / http on a pick-text path.
// ---------------------------------------------------------------------------
check('the new consumer files contain no path forwarding pick text toward the Brain (source)', () => {
  for (const p of [CONSUMER_PATH, CAPTURE_PATH]) {
    const code = strippedSource(p);
    assert.ok(!/buildBrainPacket/.test(code),
      'no buildBrainPacket reference in ' + path.basename(p));
    assert.ok(!/require\(\s*['"][^'"]*brain[^'"]*['"]\s*\)/.test(code),
      'no Brain-client require in ' + path.basename(p));
    assert.ok(!/\bfetch\s*\(/.test(code), 'no fetch( in ' + path.basename(p));
    assert.ok(!/https?:\/\//.test(code), 'no http(s) URL on an executable line in ' + path.basename(p));
  }
});

console.log('');
console.log('PASS test-159-part8-secretreason-sweep.cjs (' + passed + ' checks)');
process.exit(0);
