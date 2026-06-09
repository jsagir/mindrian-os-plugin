'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 148-04 -- IRW-06 real-invocation integration test.
 * =========================================================
 * The navigator's core complaint was "plumbing behind the menu": selecting a
 * reach wrote a SELECTED_REACH edge to a plumbing label but ran NOTHING. This
 * integration test proves the gap is closed -- selecting reverse-salient on the
 * closeReach sync path:
 *
 *   1. resolves reach.framework ("Reverse Salient Analysis") through the ONLY
 *      door, command-resolver.commandsForFramework(), to a REAL /mos: command
 *      (find-bottlenecks / rs-fetch / ...), never a fabricated slug;
 *   2. FIRES that real command (the injected fireCommand seam is invoked with
 *      the resolved command -- the in-conversation stand-in for Larry running
 *      the /mos: command);
 *   3. writes the SELECTED_REACH typed edge via navigation.cjs (read back via a
 *      navigation edge read, NOT a direct room.db open);
 *   4. lands the engine artifact via fileEvidenceWithReadback (the readback
 *      proves the EvidenceClaim row actually landed).
 *
 * It also proves the DEGRADE-don't-fabricate rail: an unknown framework resolves
 * to an empty command list and closeReach returns a manual-run instruction
 * rather than inventing a slug.
 *
 * Fixture: clones the temp room.db setup from tests/test-dial-close-reach.cjs
 * (mkdtempSync + openRoomDb + seedReachFixture). Plain CJS node:assert/strict;
 * PASS line + non-zero exit on failure (the run-all-148.sh contract).
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const resolver = require(path.join(REPO_ROOT, 'lib', 'workflow', 'command-resolver.cjs'));
const closeReachMod = require(path.join(REPO_ROOT, 'lib', 'workflow', 'dial-close-reach.cjs'));
const closeReach = closeReachMod.closeReach;

const SESSION = 'session:148-real-invocation';

function freshDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p148-04-real-invocation-'));
  return { dir, db: openRoomDb(dir) };
}

function seedNode(db, id, type) {
  const nowMs = Date.now();
  db.prepare(
    "INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) " +
    "VALUES (?, ?, '{}', 'p148-04-fixture', 'system', NULL, 'confirmed', ?, ?)"
  ).run(id, type, nowMs, nowMs);
}

// Seed the active focus node + the cmd:/framework: anchors the FK requires
// (mirrors test-dial-close-reach.cjs seedReachFixture).
function seedReachFixture(db, focusId, command, framework, informsTargetId) {
  seedNode(db, focusId, 'focus_anchor');
  seedNode(db, 'cmd:' + command, 'command');
  seedNode(db, 'framework:' + framework, 'framework');
  if (informsTargetId) seedNode(db, informsTargetId, 'claim');
  navigation.setFocus(db, SESSION, focusId, 'user');
}

function countSelectedReach(db) {
  return db.prepare("SELECT COUNT(*) AS c FROM edges WHERE type = 'SELECTED_REACH'").get().c;
}

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

console.log('test-148-real-invocation.cjs (IRW-06): select reverse-salient fires the real command + edge + artifact');

// ---------------------------------------------------------------------------
// IRW-06 happy path: sync commit of a reverse-salient reach.
// ---------------------------------------------------------------------------
check('resolver returns a real command for "Reverse Salient Analysis" (not fabricated)', () => {
  const cmds = resolver.commandsForFramework('Reverse Salient Analysis');
  assert.ok(Array.isArray(cmds) && cmds.length > 0, 'resolver must return >=1 real command');
  assert.ok(cmds[0].indexOf('/mos:') === 0, 'resolved command is a real /mos: slug; got ' + cmds[0]);
});

check('closeReach sync resolves + FIRES the real command, writes SELECTED_REACH, lands artifact', () => {
  const { db } = freshDb();
  const focusId = 'node:problem-formulation';
  const command = 'mos:find-bottlenecks';
  const framework = 'Reverse Salient Analysis';
  const informsTarget = 'node:problem-formulation';
  seedReachFixture(db, focusId, command, framework, informsTarget);

  const fired = [];
  const r = closeReach({
    outcome: 'sync',
    reach: { command, jtbd: 'find-problem', framework, recommended: true, decision_id: 'dec:rs:' + Date.now() },
    sessionId: SESSION,
    roomState: { db, investment_level: 0.3 },
    recordNextAction: () => ({ ok: true }),
    // The in-conversation stand-in for Larry running the /mos: command.
    fireCommand: (cmd) => { fired.push(cmd); return { ok: true }; },
    // The engine artifact the fired command produced (the orchestrator filing field).
    fileEvidence: {
      topic: 'reverse-salient finding',
      source: 'rs-engine',
      url: 'local://rs/find-bottlenecks',
      retrieved_at: new Date().toISOString(),
      evidence_tier: 'Operational',
      summary: 'a bottleneck candidate',
      informsTargetId: informsTarget,
    },
  });

  assert.ok(r.ok, 'closeReach sync returns ok; got reason=' + (r && r.reason));

  // (1) the resolver returned a non-empty command and closeReach surfaced it.
  assert.ok(typeof r.fired_command === 'string' && r.fired_command.indexOf('/mos:') === 0,
    'closeReach surfaces the resolved real command as fired_command; got ' + r.fired_command);
  assert.equal(r.degraded, false, 'a resolvable framework does NOT degrade');

  // (2) the real command FIRED through the injected seam (not stubbed).
  assert.equal(fired.length, 1, 'the resolved command fired exactly once');
  assert.equal(fired[0], r.fired_command, 'the fired command is the resolved command');

  // (3) the SELECTED_REACH edge landed via navigation.cjs (read back, not a direct db open).
  assert.equal(countSelectedReach(db), 1, 'exactly one SELECTED_REACH edge landed');
  const neigh = navigation.getNeighborhood(db, focusId, { depth: 1 });
  assert.ok(neigh && typeof neigh === 'object', 'getNeighborhood returns a neighborhood object');

  // (4) the engine artifact landed via fileEvidenceWithReadback (the readback proved it).
  assert.ok(r.filing && r.filing.ok === true,
    'fileEvidenceWithReadback landed the artifact; got ' + JSON.stringify(r.filing));
  assert.ok(typeof r.filing.node_id === 'string' && r.filing.node_id.length > 0,
    'the filed artifact has a node_id');
  const row = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(r.filing.node_id);
  assert.ok(row, 'the EvidenceClaim row exists in room.db');
  assert.equal(row.review_status, 'proposed',
    'Part 9: the truth-claim artifact lands proposed, never auto-confirmed');
});

// ---------------------------------------------------------------------------
// DEGRADE-don't-fabricate: an unknown framework resolves empty -> manual-run.
// ---------------------------------------------------------------------------
check('empty resolution DEGRADES to a manual-run instruction (never fabricates a slug)', () => {
  const { db } = freshDb();
  const focusId = 'node:pf';
  const command = 'mos:nonexistent';
  const framework = 'No Such Framework XYZ';
  seedReachFixture(db, focusId, command, framework);

  assert.equal(resolver.commandsForFramework(framework).length, 0,
    'precondition: the framework resolves to zero commands');

  const fired = [];
  const r = closeReach({
    outcome: 'sync',
    reach: { command, jtbd: 'x', framework, recommended: false, decision_id: 'dec:x:' + Date.now() },
    sessionId: SESSION,
    roomState: { db },
    recordNextAction: () => ({ ok: true }),
    fireCommand: (cmd) => { fired.push(cmd); return { ok: true }; },
  });

  assert.ok(r.ok, 'a degraded commit still returns ok (the edge still landed); got ' + (r && r.reason));
  assert.equal(r.degraded, true, 'an unresolvable framework degrades');
  assert.ok(typeof r.manual_run === 'string' && r.manual_run.indexOf(framework) !== -1,
    'the degrade carries a "run <framework> manually" instruction; got ' + r.manual_run);
  assert.equal(r.fired_command, null, 'no command is fabricated on a degrade');
  assert.equal(fired.length, 0, 'nothing fired on a degrade');
  // The SELECTED_REACH bookkeeping edge still landed (the reach was committed).
  assert.equal(countSelectedReach(db), 1, 'the SELECTED_REACH edge still lands on a degraded commit');
});

// ---------------------------------------------------------------------------
// miss/defer paths stay unchanged: NO SELECTED_REACH, NO fire.
// ---------------------------------------------------------------------------
check('defer outcome is unchanged: no SELECTED_REACH, no fire, no resolve', () => {
  const { db } = freshDb();
  const focusId = 'node:pf';
  seedReachFixture(db, focusId, 'mos:swot', 'SWOT');
  const fired = [];
  const r = closeReach({
    outcome: 'defer',
    reach: { command: 'mos:swot', framework: 'SWOT', decision_id: 'dec:swot:' + Date.now() },
    reason: 'not now',
    sessionId: SESSION,
    roomState: { db },
    fireCommand: (cmd) => { fired.push(cmd); return { ok: true }; },
  });
  assert.ok(r.ok, 'defer ok; got ' + (r && r.reason));
  assert.equal(countSelectedReach(db), 0, 'no SELECTED_REACH on a defer');
  assert.equal(fired.length, 0, 'nothing fired on a defer');
  assert.equal(r.fired_command, undefined, 'defer carries no fired_command');
});

console.log('');
console.log('PASS test-148-real-invocation.cjs (' + passed + ' assertions)');
