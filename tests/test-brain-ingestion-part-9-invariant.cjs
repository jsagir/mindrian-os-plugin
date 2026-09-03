'use strict';
// Phase 109-08 test: Brain Result Ingestion + canonical Part 9 invariant. NAV-109-07.

const { ok, equal } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));

const PART_9_INVARIANT_SQL = "SELECT id, type, source_path, created_by, confirmed_by FROM nodes WHERE review_status = 'confirmed' AND (confirmed_by IS NULL OR confirmed_by != 'user')";

function makeRoom() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-109-ingestion-'));
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  const db = openRoomDb(tmp);
  // Seed two target nodes for edge proposals.
  const nowMs = Date.now();
  const insN = db.prepare("INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) VALUES (?, ?, '{}', ?, 'user', ?, 'proposed', ?, ?)");
  insN.run('claim:edge-source', 'claim', 'fixture/es.md', 0.6, nowMs, nowMs);
  insN.run('claim:edge-target', 'claim', 'fixture/et.md', 0.6, nowMs, nowMs);
  return { tmp, db };
}

function cleanup(tmp) { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ } }

function makePacket(jobId, count, opts) {
  const o = opts || {};
  const suggestions = [];
  for (let i = 0; i < count; i++) {
    const sug = {
      job_id: jobId,
      suggestion_index: i,
      summary: 'Suggestion ' + i,
      methodology: 'test-methodology',
      body: 'body text ' + i,
    };
    if (o.confidence !== undefined) sug.confidence = o.confidence;
    if (o.includeEdges && i === 0) {
      sug.graph_updates_proposed = [
        { source: 'claim:edge-source', target: 'claim:edge-target', type: 'INFORMS', confidence: 0.55 },
      ];
    }
    suggestions.push(sug);
  }
  return { job_id: jobId, job: 'test_job', suggestions };
}

function test1_emptyPacketRejection() {
  const { tmp, db } = makeRoom();
  try {
    const r1 = navigation.storeBrainSuggestions(db, null, 'sess-1');
    equal(r1.ok, false); equal(r1.reason, 'no_suggestions');
    const r2 = navigation.storeBrainSuggestions(db, { suggestions: [] }, 'sess-1');
    equal(r2.ok, false); equal(r2.reason, 'no_suggestions');
    const r3 = navigation.storeBrainSuggestions(db, { job_id: 'j1' }, 'sess-1');
    equal(r3.ok, false); equal(r3.reason, 'no_suggestions');
    // Zero brain_insight rows written.
    const cnt = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'brain_insight'").get().n;
    equal(cnt, 0);
    db.close();
  } finally { cleanup(tmp); }
}

function test2_singleSuggestionRoundtrip() {
  const { tmp, db } = makeRoom();
  try {
    const packet = makePacket('job-single', 1);
    const r = navigation.storeBrainSuggestions(db, packet, 'sess-2');
    ok(r.ok, JSON.stringify(r));
    equal(r.insightIds.length, 1);
    const row = db.prepare("SELECT id, type, properties, source_path, created_by, review_status, confirmed_by FROM nodes WHERE id = ?").get(r.insightIds[0]);
    ok(row);
    equal(row.type, 'brain_insight');
    equal(row.created_by, 'brain');
    equal(row.review_status, 'proposed');
    equal(row.confirmed_by, null);
    ok(/^brain:job:/.test(row.source_path), 'source_path starts with brain:job: (got ' + row.source_path + ')');
    db.close();
  } finally { cleanup(tmp); }
}

function test3_bulkHundredSuggestions() {
  const { tmp, db } = makeRoom();
  try {
    const packet = makePacket('job-bulk', 100);
    const r = navigation.storeBrainSuggestions(db, packet, 'sess-3');
    ok(r.ok);
    equal(r.insightIds.length, 100);
    const insightCount = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'brain_insight' AND source_path = 'brain:job:job-bulk'").get().n;
    equal(insightCount, 100);
    db.close();
  } finally { cleanup(tmp); }
}

function test4_part9Invariant() {
  const { tmp, db } = makeRoom();
  try {
    const packet = makePacket('job-invariant', 50);
    navigation.storeBrainSuggestions(db, packet, 'sess-4');
    // Run the canonical Part 9 invariant query.
    const violations = db.prepare(PART_9_INVARIANT_SQL).all();
    // brain_insight nodes are 'proposed', not 'confirmed', so they are exempt.
    // memory_event nodes are 'confirmed' but with created_by='system' which is allowed
    // because they record FACTS about state changes, not advisory opinions. The invariant
    // captures advisory-confirmed cases. Documented exception: created_by='system' on
    // memory_event rows. Asserting: every row returned by the invariant query is type='memory_event'.
    for (const v of violations) {
      ok(v.type === 'memory_event', 'invariant violation row is a memory_event (system fact, exempt): ' + JSON.stringify(v));
    }
    // Strictest check: no brain_insight rows in the violation set.
    const brainViolations = violations.filter((v) => v.type === 'brain_insight');
    equal(brainViolations.length, 0, 'no brain_insight in Part 9 invariant violation set');
    db.close();
  } finally { cleanup(tmp); }
}

function test5_edgeProposalsIngested() {
  const { tmp, db } = makeRoom();
  try {
    const packet = makePacket('job-edges', 1, { includeEdges: true });
    const r = navigation.storeBrainSuggestions(db, packet, 'sess-5');
    ok(r.ok);
    const edge = db.prepare("SELECT source, target, type, properties FROM edges WHERE source = 'claim:edge-source' AND target = 'claim:edge-target'").get();
    ok(edge, 'edge inserted');
    equal(edge.type, 'INFORMS');
    const props = JSON.parse(edge.properties);
    equal(props.review_status, 'proposed');
    equal(props.created_by, 'brain');
    ok(Math.abs(props.confidence - 0.55) < 1e-6);
    db.close();
  } finally { cleanup(tmp); }
}

function test6_singleEventPerCall() {
  const { tmp, db } = makeRoom();
  try {
    const eventsBefore = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'memory_event' AND json_extract(properties, '$.event_type') = 'brain_suggestion_received'").get().n;
    navigation.storeBrainSuggestions(db, makePacket('job-event-1', 10), 'sess-6');
    navigation.storeBrainSuggestions(db, makePacket('job-event-2', 10), 'sess-6');
    const eventsAfter = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'memory_event' AND json_extract(properties, '$.event_type') = 'brain_suggestion_received'").get().n;
    equal(eventsAfter - eventsBefore, 2, '2 calls produced exactly 2 brain_suggestion_received events (NOT 20)');
    db.close();
  } finally { cleanup(tmp); }
}

function test7_duplicateIdWithinBatchUpserts() {
  // R17-01 (260903-gdm, navigator-confirmed Task 4, Confirm 1): storeBrainSuggestions
  // now routes its node write through lib/core/node-insert.cjs::insertNode, whose
  // default ON CONFLICT(id) DO UPDATE means a PK collision (same job_id +
  // suggestion_index within one batch) is a silent upsert, not a throw that rolls
  // back the whole batch. This test used to assert the OPPOSITE (rollback on PK
  // collision, r.ok === false); that assumption is no longer true by design, so the
  // test is rewritten to assert the new, approved behavior: the batch succeeds and
  // the duplicate id lands as exactly one row (last write wins), never two.
  const { tmp, db } = makeRoom();
  try {
    const packet = {
      job_id: 'job-rollback',
      job: 'test',
      suggestions: [
        { job_id: 'job-rollback', suggestion_index: 0, summary: 's0', body: 'b0' },
        { job_id: 'job-rollback', suggestion_index: 0, summary: 's0-dup', body: 'b0-dup' },
      ],
    };
    const cntBefore = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'brain_insight'").get().n;
    const r = navigation.storeBrainSuggestions(db, packet, 'sess-7');
    equal(r.ok, true, 'a same-batch duplicate id no longer fails the whole ingestion call');
    const cntAfter = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'brain_insight'").get().n;
    equal(cntAfter, cntBefore + 1, 'the duplicate id upserts to exactly one row, not two, not zero');
    const row = db.prepare("SELECT properties FROM nodes WHERE id = 'brain_insight:job-rollback:0'").get();
    ok(row, 'the upserted row exists at the deterministic id');
    ok(/s0-dup/.test(row.properties), 'the second (later) suggestion body wins the upsert');
    db.close();
  } finally { cleanup(tmp); }
}

function test8_confidenceDefault() {
  const { tmp, db } = makeRoom();
  try {
    const packet = makePacket('job-conf-default', 1);
    const r = navigation.storeBrainSuggestions(db, packet, 'sess-8');
    ok(r.ok);
    const row = db.prepare("SELECT confidence FROM nodes WHERE id = ?").get(r.insightIds[0]);
    equal(row.confidence, 0.5);
    // With explicit confidence:
    const packet2 = makePacket('job-conf-explicit', 1, { confidence: 0.85 });
    const r2 = navigation.storeBrainSuggestions(db, packet2, 'sess-8');
    ok(r2.ok);
    const row2 = db.prepare("SELECT confidence FROM nodes WHERE id = ?").get(r2.insightIds[0]);
    ok(Math.abs(row2.confidence - 0.85) < 1e-6);
    db.close();
  } finally { cleanup(tmp); }
}

function test9_sourcePathProvenance() {
  const { tmp, db } = makeRoom();
  try {
    const packet = makePacket('job-prov', 5);
    const r = navigation.storeBrainSuggestions(db, packet, 'sess-9');
    ok(r.ok);
    const rows = db.prepare("SELECT source_path FROM nodes WHERE id LIKE 'brain_insight:job-prov:%'").all();
    equal(rows.length, 5);
    for (const row of rows) {
      ok(/^brain:job:job-prov$/.test(row.source_path), 'source_path matches brain:job:job-prov: ' + row.source_path);
    }
    db.close();
  } finally { cleanup(tmp); }
}

function run() {
  const tests = [test1_emptyPacketRejection, test2_singleSuggestionRoundtrip, test3_bulkHundredSuggestions, test4_part9Invariant, test5_edgeProposalsIngested, test6_singleEventPerCall, test7_duplicateIdWithinBatchUpserts, test8_confidenceDefault, test9_sourcePathProvenance];
  let pass = 0; let fail = 0;
  for (const t of tests) {
    try { t(); pass++; process.stdout.write('PASS ' + t.name + '\n'); }
    catch (err) { fail++; process.stderr.write('FAIL ' + t.name + ': ' + err.message + '\n' + err.stack + '\n'); }
  }
  process.stdout.write('test-brain-ingestion-part-9-invariant: ' + pass + '/' + tests.length + ' passed\n');
  process.exit(fail === 0 ? 0 : 1);
}

run();
