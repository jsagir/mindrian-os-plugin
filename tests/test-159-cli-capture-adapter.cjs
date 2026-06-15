'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 159-01 Task 3 -- CLI capture adapter + Part 8 pick-text-stays-LOCAL suite
 * (DCW-05 / DCW-07).
 * ==============================================================================
 * Proves captureCliPick turns an AskUserQuestion F.1 answer into the {pick} shape
 * consumeF1Pick accepts, that the end-to-end CLI path writes the expected keyed
 * reject row, that a seeded SECRETREASON159 marker in the navigator's pick text
 * NEVER lands in any stored row value (Part 8 LOCAL lane), and that the
 * Desktop/Cowork capture-adapter seam contract is exported (DCW-07).
 *
 * Four behaviors (159-01-PLAN Task 3 <behavior>):
 *   Test 1 (adapter shape): captureCliPick(answer, priorPayload) -> {pick}
 *           consumeF1Pick accepts; the pick is the selected option/verb (a
 *           deterministic enum), not free prose.
 *   Test 2 (end-to-end CLI path): a captured CLI pick fed through consumeF1Pick
 *           over a real roomState.db writes the expected keyed reject row.
 *   Test 3 (Part 8 SECRETREASON tripwire): a seeded SECRETREASON159 marker in the
 *           pick text appears in ZERO stored row property values.
 *   Test 4 (seam doc presence): the module exports the documented
 *           capture-adapter seam signature (CAPTURE_ADAPTER_CONTRACT) for
 *           Desktop/Cowork.
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only. CJS.
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
const { consumeF1Pick } = require(path.join(REPO_ROOT, 'lib', 'workflow', 'f1-pick-consumer.cjs'));
const captureMod = require(path.join(REPO_ROOT, 'lib', 'hmi', 'f1-pick-capture-cli.cjs'));
const { captureCliPick } = captureMod;

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

function freshDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p159-01-cli-capture-'));
  return { db: openRoomDb(dir), dir };
}

function seedAnchorNode(db, id, type) {
  const nowMs = Date.now();
  db.prepare(
    "INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) "
    + "VALUES (?, ?, '{}', 'p159-01-fixture', 'system', NULL, 'confirmed', ?, ?)"
  ).run(id, type, nowMs, nowMs);
}
function seedAnchorsFor(db, command, framework) {
  seedAnchorNode(db, 'cmd:' + command, 'command');
  seedAnchorNode(db, 'framework:' + framework, 'framework');
}

const SKILLX = 'mos:deep-research';
const FW = 'Deep Research';

function priorPayload(extra) {
  const base = {
    verbs: [SKILLX, 'Free-Text'],
    recommendedVerb: SKILLX,
    header: '[NEXT MOVE]',
    reachIds: { [SKILLX]: 'deep_research' },
  };
  return Object.assign(base, extra || {});
}

console.log('test-159-cli-capture-adapter.cjs (DCW-05 / DCW-07): CLI capture adapter + Part 8 LOCAL lane');

// ---------------------------------------------------------------------------
// Test 1 (adapter shape): captureCliPick -> {pick} consumeF1Pick accepts.
// ---------------------------------------------------------------------------
check('captureCliPick maps an AskUserQuestion answer to the {pick} shape (deterministic enum, not prose)', () => {
  // The CLI AskUserQuestion answer: the navigator selected the SKILLX option and
  // chose the reject outcome on the F.1 card.
  const answer = { selectedOption: SKILLX, outcome: 'reject', text: 'I do not want deep research now' };
  const captured = captureCliPick(answer, priorPayload());
  assert.ok(captured && typeof captured === 'object', 'returns an object');
  assert.ok(captured.pick && typeof captured.pick === 'object', 'carries a pick object');
  // The pick verb is the deterministic enum from the rendered card, NOT prose.
  assert.strictEqual(captured.pick.verb, SKILLX, 'pick.verb is the matched option/verb');
  assert.strictEqual(captured.pick.outcome, 'reject', 'pick.outcome is the chosen decision keyword');
  // The raw answer text rides ONLY the optional sentence field (FIX-05 LOCAL lane).
  assert.strictEqual(typeof captured.sentence, 'string', 'raw answer text carried as the optional sentence');
});

// ---------------------------------------------------------------------------
// Test 2 (end-to-end CLI path): captured pick -> consumeF1Pick -> keyed reject.
// ---------------------------------------------------------------------------
check('end-to-end CLI path writes the expected keyed reject row (DCW-07 live CLI)', () => {
  const { db } = freshDb();
  seedAnchorsFor(db, SKILLX, FW);
  const answer = { selectedOption: SKILLX, outcome: 'reject', text: 'not now' };
  const captured = captureCliPick(answer, priorPayload());
  const res = consumeF1Pick({
    priorPayload: priorPayload({ sentence: captured.sentence }),
    pick: captured.pick,
    roomState: { db, offer: { framework: FW } },
  });
  assert.ok(res && res.ok, 'consume ok; got reason=' + (res && res.reason));
  const rows = navigation.findRecentChanges(db, 0, { eventType: 'f_selector_decision', limit: 50 });
  assert.strictEqual(rows.length, 1, 'exactly one decision row');
  assert.strictEqual(rows[0].properties.decision, 'reject', 'decision is reject');
  assert.strictEqual(rows[0].properties.reach_id, 'deep_research', 'row is keyed');
  closeRoomDb(db);
});

// ---------------------------------------------------------------------------
// Test 3 (Part 8 SECRETREASON tripwire): a seeded marker in the pick text NEVER
// lands in any stored row property value (the pick text rides the LOCAL lane).
// ---------------------------------------------------------------------------
check('SECRETREASON159 seeded in the pick text appears in ZERO stored row values (Part 8 DCW-05)', () => {
  const { db } = freshDb();
  seedAnchorsFor(db, SKILLX, FW);
  const SECRET = 'SECRETREASON159';
  const answer = { selectedOption: SKILLX, outcome: 'reject', text: 'reject because ' + SECRET + ' is confidential' };
  const captured = captureCliPick(answer, priorPayload());
  // The secret rides the sentence (LOCAL lane) only.
  assert.ok(captured.sentence.indexOf(SECRET) !== -1, 'the secret is present in the captured sentence (the LOCAL lane)');
  const res = consumeF1Pick({
    priorPayload: priorPayload({ sentence: captured.sentence }),
    pick: captured.pick,
    roomState: { db, offer: { framework: FW } },
  });
  assert.ok(res && res.ok, 'consume ok; got ' + (res && res.reason));

  // Sweep EVERY stored memory_event row value for the marker. Read across the
  // event types the consumer path can touch (decision + miss). The marker must
  // appear in ZERO stored property values.
  const allRows = []
    .concat(navigation.findRecentChanges(db, 0, { eventType: 'f_selector_decision', limit: 50 }))
    .concat(navigation.findRecentChanges(db, 0, { eventType: 'f_selector_miss', limit: 50 }));
  assert.ok(allRows.length > 0, 'at least one row was written');
  for (const row of allRows) {
    const serialized = JSON.stringify(row.properties || {});
    assert.ok(serialized.indexOf(SECRET) === -1,
      'SECRETREASON159 must NOT appear in any stored row value; found in ' + serialized);
  }
  closeRoomDb(db);
});

// ---------------------------------------------------------------------------
// Test 4 (seam doc presence): the Desktop/Cowork capture-adapter contract export.
// ---------------------------------------------------------------------------
check('the module exports the documented Desktop/Cowork capture-adapter seam contract (DCW-07)', () => {
  assert.strictEqual(typeof captureCliPick, 'function', 'captureCliPick is exported');
  assert.ok(captureMod.CAPTURE_ADAPTER_CONTRACT && typeof captureMod.CAPTURE_ADAPTER_CONTRACT === 'object',
    'CAPTURE_ADAPTER_CONTRACT is exported as an object');
  const c = captureMod.CAPTURE_ADAPTER_CONTRACT;
  // The contract names the function signature + expected shape Desktop/Cowork
  // adapters implement so Wave-3 can reference it for the seam doc.
  assert.ok(typeof c.signature === 'string' && c.signature.length > 0, 'contract names the signature');
  assert.ok(typeof c.returns === 'string' && c.returns.length > 0, 'contract names the return shape');
});

console.log('');
console.log('PASS test-159-cli-capture-adapter.cjs (' + passed + ' checks)');
process.exit(0);
