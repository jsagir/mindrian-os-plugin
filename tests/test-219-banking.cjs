'use strict';
// Phase 219-01 -- REQ-1 eureka statement banking test suite.
//
// Task 1 (RED-first): the typed-opportunity writer, a SIBLING clone of
// typed-entity.cjs (D-03: typed `opportunity` node, review_status='proposed',
// lifecycle prop via navigation only; D-04: edge vocabulary reuse-first, the
// three-member DERIVED_FROM/SUPPORTS/INFORMS evidence subset, zero net-new edge
// types; D-17: stage-vs-outcome separation + APPEND-ONLY stage_history on every
// transition - state is never overwritten).
//
// Task 2 extends this file with the bankStatements hook-level assertions (the
// eureka-portfolio-report.cjs:44-46 deferred write, implemented).
//
// Canon Part 9 role 5: an opportunity node is a PURE TRUTH-CLAIM. It ALWAYS
//   lands review_status 'proposed' and is NEVER auto-confirmed by the writer;
//   only a human confirmNode promotes (the Plan 04 Qualify verb).
// Canon Part 8: zero network surface; pure LOCAL SQLite over a caller-owned
//   handle; a source-scan asserts no raw INSERT INTO nodes/edges and no
//   node:sqlite require inside typed-opportunity.cjs.
//
// NO em-dashes anywhere (CLAUDE.md HARD RULE). node:sqlite builds an in-memory
// migrated-nodes-schema db so there is no SKIP path.

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const REPO_ROOT = path.resolve(__dirname, '..');
const typedOppPath = path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'typed-opportunity.cjs');
const {
  writeOpportunityNode,
  advanceOpportunityStage,
  linkOpportunityEvidence,
  OPPORTUNITY_NODE_ID,
  OPPORTUNITY_LIFECYCLES,
  OPPORTUNITY_EVIDENCE_EDGE_SUBSET,
} = require(typedOppPath);
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));

let pass = 0;
let total = 0;
function check(label, fn) {
  total += 1;
  fn();
  pass += 1;
  console.log('  ok -', label);
}

// In-memory db with the Phase-109-migrated nodes schema (the wide NOT-NULL +
// CHECK shape) plus the edges table so writeEdge round-trips. No SKIP path.
// Mirrors tests/test-218-entity-writer.cjs freshDb verbatim.
function freshDb() {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec(
    'CREATE TABLE nodes (' +
    '  id TEXT PRIMARY KEY, ' +
    '  type TEXT NOT NULL, ' +
    "  properties TEXT DEFAULT '{}', " +
    '  source_path TEXT NOT NULL, ' +
    "  created_by TEXT NOT NULL CHECK(created_by IN ('user','larry','import','brain','system')), " +
    '  confidence REAL, ' +
    "  review_status TEXT NOT NULL DEFAULT 'proposed' " +
    "    CHECK(review_status IN ('proposed','confirmed','rejected','stale','superseded','needs_evidence','validated','invalidated')), " +
    '  created_at INTEGER NOT NULL, ' +
    '  last_seen_at INTEGER NOT NULL, ' +
    '  source_section TEXT, ' +
    '  confirmed_by TEXT, ' +
    '  confirmed_at INTEGER' +
    ')'
  );
  db.exec(
    'CREATE TABLE edges (source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, ' +
    "properties TEXT DEFAULT '{}', PRIMARY KEY(source, target, type));"
  );
  return db;
}

function propsOf(db, nodeId) {
  const row = db.prepare('SELECT properties FROM nodes WHERE id = ?').get(nodeId);
  assert.ok(row, 'node ' + nodeId + ' must be queryable');
  return JSON.parse(row.properties);
}

console.log('test-219-banking');

// ---------------------------------------------------------------------------
// Task 1 / Test 1: mint -- type 'opportunity', proposed, lifecycle candidate
// ---------------------------------------------------------------------------

check('Test 1 -- writeOpportunityNode mints a proposed opportunity node with lifecycle candidate', () => {
  const db = freshDb();
  const r = writeOpportunityNode(db, { name: 'thermal x cooling synergy', sessionId: 's1' });
  assert.equal(r.ok, true, `expected ok:true, got ${JSON.stringify(r)}`);
  assert.ok(typeof r.node_id === 'string' && r.node_id.length > 0, 'node_id present');
  const row = db.prepare('SELECT type, review_status, created_by FROM nodes WHERE id = ?').get(r.node_id);
  assert.ok(row, 'node must be queryable');
  assert.equal(row.type, 'opportunity', "type must be 'opportunity'");
  assert.equal(row.review_status, 'proposed', "opportunity node lands 'proposed'");
  assert.equal(row.created_by, 'system', "created_by is 'system'");
  const props = propsOf(db, r.node_id);
  assert.equal(props.lifecycle, 'candidate', 'lifecycle defaults to candidate');
  assert.equal(props.name, 'thermal x cooling synergy', 'name rides the props bag');
  db.close();
});

// ---------------------------------------------------------------------------
// Task 1 / Test 2: idempotent UPSERT + advanceOpportunityStage merge
// ---------------------------------------------------------------------------

check('Test 2 -- same (sessionId, name) is an UPSERT; advance to qualified keeps other props', () => {
  const db = freshDb();
  const first = writeOpportunityNode(db, {
    name: 'opp-A', sessionId: 's1', lens: 'Leveraging Resources', jtbd: 'triage', score: 0.42,
  });
  assert.equal(first.ok, true);
  const second = writeOpportunityNode(db, { name: 'opp-A', sessionId: 's1', score: 0.55 });
  assert.equal(second.ok, true);
  assert.equal(second.node_id, first.node_id, 'same (sessionId, name) resolves to the same node id');
  const count = db.prepare('SELECT COUNT(*) AS n FROM nodes').get().n;
  assert.equal(count, 1, 'UPSERT: node count unchanged');
  let props = propsOf(db, first.node_id);
  assert.equal(props.lens, 'Leveraging Resources', 'props merged: lens survives the re-write');
  assert.equal(props.score, 0.55, 'props merged: new scalar wins');

  const adv = advanceOpportunityStage(db, {
    node_id: first.node_id, axis: 'lifecycle', to: 'qualified',
    actor: 'navigator', reason: 'qualified via card', evidence_ids: ['e1'], formula_version: 'harvest-v1',
  });
  assert.equal(adv.ok, true, `expected ok:true, got ${JSON.stringify(adv)}`);
  props = propsOf(db, first.node_id);
  assert.equal(props.lifecycle, 'qualified', 'current-state lifecycle updated');
  assert.equal(props.lens, 'Leveraging Resources', 'other props not clobbered by the transition');
  assert.equal(props.name, 'opp-A', 'name not clobbered by the transition');
  db.close();
});

// ---------------------------------------------------------------------------
// Task 1 / Test 2b (D-17): append-only stage_history, prior entries immutable
// ---------------------------------------------------------------------------

check('Test 2b -- D-17: every transition APPENDS a stage_history entry; prior entries byte-unchanged', () => {
  const db = freshDb();
  const r = writeOpportunityNode(db, { name: 'opp-hist', sessionId: 's1' });
  assert.equal(r.ok, true);

  let props = propsOf(db, r.node_id);
  assert.ok(Array.isArray(props.stage_history), 'stage_history is an array');
  assert.equal(props.stage_history.length, 1, 'mint writes the initial history entry');
  const mintEntry = props.stage_history[0];
  assert.equal(mintEntry.from, null, 'mint entry from is null');
  assert.equal(mintEntry.to, 'candidate', 'mint entry to is the initial lifecycle');
  const expectedKeys = ['from', 'to', 'at', 'actor', 'reason', 'evidence_ids', 'formula_version'];
  assert.deepEqual(Object.keys(mintEntry).sort(), expectedKeys.slice().sort(),
    'entry shape is exactly {from,to,at,actor,reason,evidence_ids,formula_version}');
  const mintEntryBytes = JSON.stringify(mintEntry);

  const adv1 = advanceOpportunityStage(db, {
    node_id: r.node_id, axis: 'lifecycle', to: 'qualified',
    actor: 'navigator', reason: 'qualified', evidence_ids: [], formula_version: 'harvest-v1',
  });
  assert.equal(adv1.ok, true);
  props = propsOf(db, r.node_id);
  const entry1Bytes = JSON.stringify(props.stage_history[1]);

  const adv2 = advanceOpportunityStage(db, {
    node_id: r.node_id, axis: 'stage', to: 'explored',
    actor: 'system', reason: 'explore chain complete', evidence_ids: ['e9'], formula_version: 'harvest-v1',
  });
  assert.equal(adv2.ok, true);
  props = propsOf(db, r.node_id);

  assert.equal(props.stage_history.length, 3, 'mint + two transitions = exactly 3 entries');
  assert.equal(JSON.stringify(props.stage_history[0]), mintEntryBytes, 'entry 0 byte-unchanged (immutable)');
  assert.equal(JSON.stringify(props.stage_history[1]), entry1Bytes, 'entry 1 byte-unchanged (immutable)');
  assert.equal(props.stage_history[1].from, 'candidate', 'entry 1 records from=candidate');
  assert.equal(props.stage_history[1].to, 'qualified', 'entry 1 records to=qualified');
  assert.equal(props.stage_history[2].to, 'explored', 'entry 2 records to=explored');
  assert.equal(props.opportunity_stage, 'explored', 'stage axis current-state updated');
  assert.equal(props.lifecycle, 'qualified', 'lifecycle axis untouched by the stage transition');
  for (const e of props.stage_history) {
    assert.deepEqual(Object.keys(e).sort(), expectedKeys.slice().sort(), 'every entry keeps the D-17 shape');
  }
  db.close();
});

check('Test 2c -- D-17: a re-write of the same (sessionId, name) never replaces or drops history', () => {
  const db = freshDb();
  const r = writeOpportunityNode(db, { name: 'opp-rewrite', sessionId: 's1' });
  advanceOpportunityStage(db, { node_id: r.node_id, axis: 'lifecycle', to: 'qualified', actor: 'navigator', reason: 'q' });
  const before = propsOf(db, r.node_id).stage_history;
  const again = writeOpportunityNode(db, { name: 'opp-rewrite', sessionId: 's1', score: 0.9 });
  assert.equal(again.ok, true);
  const after = propsOf(db, r.node_id);
  assert.equal(JSON.stringify(after.stage_history), JSON.stringify(before),
    'the props-merge UPSERT preserves stage_history verbatim (never replaces it)');
  assert.equal(after.lifecycle, 'qualified', 'state axes survive the re-write (transitions only via advanceOpportunityStage)');
  assert.equal(after.score, 0.9, 'non-state props still merge');
  db.close();
});

// ---------------------------------------------------------------------------
// Task 1 / Test 3: defensive rejection contract (never throws)
// ---------------------------------------------------------------------------

check('Test 3 -- invalid params return { ok:false } and never throw', () => {
  const db = freshDb();
  const noName = writeOpportunityNode(db, { sessionId: 's1' });
  assert.equal(noName.ok, false, 'missing name is rejected');
  const badLifecycle = writeOpportunityNode(db, { name: 'x', sessionId: 's1', lifecycle: 'zombie' });
  assert.equal(badLifecycle.ok, false, 'bad lifecycle enum is rejected');
  const nonObject = writeOpportunityNode(db, null);
  assert.equal(nonObject.ok, false, 'non-object params rejected');
  const count = db.prepare('SELECT COUNT(*) AS n FROM nodes').get().n;
  assert.equal(count, 0, 'no row written for any invalid input');

  const badAxis = advanceOpportunityStage(db, { node_id: 'nope', axis: 'mood', to: 'happy' });
  assert.equal(badAxis.ok, false, 'unknown axis rejected');
  const missing = advanceOpportunityStage(db, { node_id: 'opportunity:none', axis: 'lifecycle', to: 'qualified' });
  assert.equal(missing.ok, false, 'transition on a missing node rejected');
  db.close();
});

// ---------------------------------------------------------------------------
// Task 1 / Test 4: evidence edges -- three-member allow-list, gated
// ---------------------------------------------------------------------------

check('Test 4 -- linkOpportunityEvidence writes DERIVED_FROM; off-subset edge_type rejected', () => {
  const db = freshDb();
  const opp = writeOpportunityNode(db, { name: 'opp-edge', sessionId: 's1' });
  assert.equal(opp.ok, true);
  const good = linkOpportunityEvidence(db, {
    opportunity_id: opp.node_id, target_id: 'entity:s1:abc', edge_type: 'DERIVED_FROM',
  });
  assert.equal(good.ok, true, `expected ok:true, got ${JSON.stringify(good)}`);
  const row = db.prepare('SELECT source, target, type FROM edges WHERE type = ?').get('DERIVED_FROM');
  assert.ok(row, 'DERIVED_FROM edge visible in the edges table');
  assert.equal(row.source, opp.node_id, 'edge source is the opportunity node');
  assert.equal(row.target, 'entity:s1:abc', 'edge target is the evidence node');

  const supports = linkOpportunityEvidence(db, {
    opportunity_id: opp.node_id, target_id: 'artifact:x', edge_type: 'SUPPORTS',
  });
  assert.equal(supports.ok, true, 'SUPPORTS accepted');
  const informs = linkOpportunityEvidence(db, {
    opportunity_id: opp.node_id, target_id: 'claim:y', edge_type: 'INFORMS',
  });
  assert.equal(informs.ok, true, 'INFORMS accepted');

  const bad = linkOpportunityEvidence(db, {
    opportunity_id: opp.node_id, target_id: 'entity:s1:abc', edge_type: 'DESCRIBES',
  });
  assert.equal(bad.ok, false, 'an edge_type outside DERIVED_FROM/SUPPORTS/INFORMS is rejected');
  const rejected = linkOpportunityEvidence(db, {
    opportunity_id: opp.node_id, target_id: 'entity:s1:abc', edge_type: 'REJECTED_BECAUSE',
  });
  assert.equal(rejected.ok, false, 'REJECTED_BECAUSE is Plan 04 territory via writeEdge, not this helper');
  db.close();
});

// ---------------------------------------------------------------------------
// Task 1 / Test 5: no confirm path -- proposed after EVERY writer call
// ---------------------------------------------------------------------------

check('Test 5 -- review_status stays proposed after mint, re-mint, and every transition', () => {
  const db = freshDb();
  const r = writeOpportunityNode(db, { name: 'opp-p9', sessionId: 's1' });
  const status = () => db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(r.node_id).review_status;
  assert.equal(status(), 'proposed', 'proposed at mint');
  writeOpportunityNode(db, { name: 'opp-p9', sessionId: 's1', score: 0.7 });
  assert.equal(status(), 'proposed', 'proposed after re-mint');
  advanceOpportunityStage(db, { node_id: r.node_id, axis: 'lifecycle', to: 'qualified', actor: 'navigator', reason: 'q' });
  assert.equal(status(), 'proposed', 'proposed after lifecycle transition');
  advanceOpportunityStage(db, { node_id: r.node_id, axis: 'outcome', to: 'deferred', actor: 'navigator', reason: 'later' });
  assert.equal(status(), 'proposed', 'proposed after outcome transition (only a human confirmNode promotes, Part 9 role 5)');
  db.close();
});

// ---------------------------------------------------------------------------
// Frozen-set sanity + navigation re-export + substrate-bypass guard
// ---------------------------------------------------------------------------

check('OPPORTUNITY_LIFECYCLES is a frozen Set of the six D-03 members', () => {
  assert.equal(OPPORTUNITY_LIFECYCLES instanceof Set, true);
  assert.equal(Object.isFrozen(OPPORTUNITY_LIFECYCLES), true);
  for (const m of ['candidate', 'qualified', 'explored', 'promoted', 'parked', 'retired']) {
    assert.equal(OPPORTUNITY_LIFECYCLES.has(m), true, m + ' is a member');
  }
  assert.equal(OPPORTUNITY_LIFECYCLES.has('zombie'), false);
});

check('OPPORTUNITY_EVIDENCE_EDGE_SUBSET is exactly {DERIVED_FROM, SUPPORTS, INFORMS} (D-04)', () => {
  assert.equal(OPPORTUNITY_EVIDENCE_EDGE_SUBSET instanceof Set, true);
  assert.equal(Object.isFrozen(OPPORTUNITY_EVIDENCE_EDGE_SUBSET), true);
  assert.equal(OPPORTUNITY_EVIDENCE_EDGE_SUBSET.size, 3, 'zero net-new edge types this phase');
  assert.equal(OPPORTUNITY_EVIDENCE_EDGE_SUBSET.has('DERIVED_FROM'), true);
  assert.equal(OPPORTUNITY_EVIDENCE_EDGE_SUBSET.has('SUPPORTS'), true);
  assert.equal(OPPORTUNITY_EVIDENCE_EDGE_SUBSET.has('INFORMS'), true);
});

check('OPPORTUNITY_NODE_ID is idempotent and session-scoped', () => {
  assert.equal(OPPORTUNITY_NODE_ID('s1', 'a'), OPPORTUNITY_NODE_ID('s1', 'a'), 'same inputs, same id');
  assert.notEqual(OPPORTUNITY_NODE_ID('s1', 'a'), OPPORTUNITY_NODE_ID('s2', 'a'), 'session-scoped');
  assert.notEqual(OPPORTUNITY_NODE_ID('s1', 'a'), OPPORTUNITY_NODE_ID('s1', 'b'), 'name-scoped');
});

check('navigation.cjs re-exports the opportunity writer surface (the writeEntityNode idiom)', () => {
  assert.equal(typeof navigation.writeOpportunityNode, 'function', 'writeOpportunityNode re-exported');
  assert.equal(typeof navigation.linkOpportunityEvidence, 'function', 'linkOpportunityEvidence re-exported');
  assert.equal(typeof navigation.advanceOpportunityStage, 'function', 'advanceOpportunityStage re-exported');
  assert.equal(typeof navigation.OPPORTUNITY_NODE_ID, 'function', 'OPPORTUNITY_NODE_ID re-exported');
});

check('typed-opportunity.cjs carries no forbidden substrate require, no raw INSERT, no indexOpportunity call', () => {
  const src = fs.readFileSync(typedOppPath, 'utf8');
  assert.equal(/require\(['"][^'"]*room-db\.cjs['"]\)/.test(src), false, 'no room-db.cjs require');
  assert.equal(/require\(['"][^'"]*lazygraph-ops\.cjs['"]\)/.test(src), false, 'no lazygraph-ops.cjs require');
  assert.equal(/require\(['"]node:sqlite['"]\)/.test(src), false, 'no node:sqlite require');
  assert.equal(/INSERT\s+INTO\s+(nodes|edges)/i.test(src), false, 'no raw INSERT INTO nodes/edges');
  // graph-ops.cjs indexOpportunity is the legacy raw-insert bypass (Part 9
  // violation for governed writes). The module header carries a do-not-use
  // pointer comment; there must be NO call and NO require of graph-ops.
  assert.equal(/require\(['"][^'"]*graph-ops\.cjs['"]\)/.test(src), false, 'no graph-ops.cjs require');
  assert.equal(/indexOpportunity\s*\(/.test(src), false, 'no indexOpportunity call');
});

// ---------------------------------------------------------------------------
// Task 2: bankStatements -- the eureka-portfolio-report.cjs deferred write,
// implemented. Driven hermetically via the named export (no eureka run).
// ---------------------------------------------------------------------------

const reportPath = path.join(REPO_ROOT, 'scripts', 'eureka-portfolio-report.cjs');
const { bankStatements, resolveBankPredicate, deriveBankSection } = require(reportPath);

// Build one in-memory statements-loop entry { pair, statement, tailFlag }.
function mkEntry(o) {
  return {
    pair: {
      idA: o.idA || 'node:a', idB: o.idB || 'node:b',
      rank: o.rank || 1, score: (typeof o.score === 'number') ? o.score : 0.5,
      techA: { title: o.titleA || 'Tech A', section: o.sectionA },
      techB: { title: o.titleB || 'Tech B', section: o.sectionB },
    },
    statement: {
      text: o.text || 'opportunity statement text',
      banked: o.banked === true,
      critic: o.critic || (o.banked === true ? 'pass' : 'pending'),
      fields: { audience: 'portfolio operators', potential_tier: o.tier || 'T2' },
    },
    tailFlag: o.tailFlag === true,
  };
}

check('Hook 1 -- N banked statements yield exactly N proposed nodes, each with >=1 DERIVED_FROM edge', () => {
  const db = freshDb();
  const entries = [
    mkEntry({ banked: true, titleA: 'Alpha', titleB: 'Beta', idA: 'n:1', idB: 'n:2', sectionA: 'business-model' }),
    mkEntry({ banked: true, titleA: 'Gamma', titleB: 'Delta', idA: 'n:3', idB: 'n:4', sectionA: 'go-to-market' }),
    mkEntry({ banked: false, titleA: 'Omega', titleB: 'Sigma', idA: 'n:5', idB: 'n:6' }),
  ];
  const r = bankStatements(db, 'test-session', entries);
  assert.equal(r.ok, true, `expected ok:true, got ${JSON.stringify(r)}`);
  assert.equal(r.banked, 2, 'exactly N=2 banked');
  assert.equal(r.skipped, 1, 'the unbanked statement is skipped');
  assert.equal(r.predicate, 'critic', 'default predicate is critic');
  const nodes = db.prepare("SELECT id, review_status FROM nodes WHERE type = 'opportunity'").all();
  assert.equal(nodes.length, 2, 'exactly N=2 proposed opportunity nodes minted');
  for (const n of nodes) {
    assert.equal(n.review_status, 'proposed', 'every banked node lands proposed');
    const cnt = db.prepare("SELECT COUNT(*) AS c FROM edges WHERE source = ? AND type = 'DERIVED_FROM'").get(n.id).c;
    assert.ok(cnt >= 1, 'every banked node carries >=1 DERIVED_FROM evidence edge (got ' + cnt + ')');
  }
  db.close();
});

check('Hook 2 -- a banked=false statement yields ZERO nodes under the default predicate; never AHP rank', () => {
  const db = freshDb();
  // rank 1 (best AHP rank) but critic verdict not passed: must NOT bank.
  const r = bankStatements(db, 'test-session', [mkEntry({ banked: false, rank: 1, score: 0.99 })]);
  assert.equal(r.ok, true);
  assert.equal(r.banked, 0, 'banking is gated on the critic verdict, never on AHP rank');
  const count = db.prepare("SELECT COUNT(*) AS c FROM nodes WHERE type = 'opportunity'").get().c;
  assert.equal(count, 0, 'zero opportunity nodes');
  db.close();
});

check('Hook 3 -- a mid-batch failure rolls back the WHOLE batch (all-or-nothing)', () => {
  const db = freshDb();
  // Empty titles + empty ids resolve to an empty name: writeOpportunityNode
  // rejects invalid_name, the batch throws, everything rolls back. Built
  // explicitly (mkEntry defaults would paper over the empties).
  const bad = mkEntry({ banked: true });
  bad.pair.techA.title = '';
  bad.pair.techB.title = '';
  bad.pair.idA = '';
  bad.pair.idB = '';
  const entries = [
    mkEntry({ banked: true, titleA: 'Good', titleB: 'Pair', idA: 'n:1', idB: 'n:2' }),
    bad,
  ];
  const r = bankStatements(db, 'test-session', entries);
  assert.equal(r.ok, false, 'the batch reports failure');
  assert.equal(r.reason, 'banking_batch_failed');
  const nodes = db.prepare("SELECT COUNT(*) AS c FROM nodes WHERE type = 'opportunity'").get().c;
  const edges = db.prepare('SELECT COUNT(*) AS c FROM edges').get().c;
  assert.equal(nodes, 0, 'the good statement rolled back too (all-or-nothing)');
  assert.equal(edges, 0, 'no partial edges survive the rollback');
  db.close();
});

check('Hook 4 -- 216 field contract: props.section is a real domain slug or unknown, never an ICM type', () => {
  const db = freshDb();
  // Evidence node whose props carry a REAL section slug + a source_path slug.
  const { insertNode } = require(path.join(REPO_ROOT, 'lib', 'core', 'node-insert.cjs'));
  insertNode(db, 'art:1', 'Artifact', JSON.stringify({ section: 'business-model' }), {
    source_path: 'business-model/2026-05-26-investor-prep.md', created_by: 'system',
  });
  const entries = [
    // sectionA/sectionB leak the ICM type column ('Artifact'/'memory_event'):
    // the deny-list must refuse them and fall through to the evidence node.
    mkEntry({ banked: true, titleA: 'A1', titleB: 'B1', idA: 'art:1', idB: 'n:x', sectionA: 'Artifact', sectionB: 'memory_event' }),
    // Nothing real anywhere: the honest 'unknown'.
    mkEntry({ banked: true, titleA: 'A2', titleB: 'B2', idA: 'n:y', idB: 'n:z', sectionA: 'Section' }),
  ];
  const r = bankStatements(db, 'test-session', entries);
  assert.equal(r.ok, true, `expected ok:true, got ${JSON.stringify(r)}`);
  const rows = db.prepare("SELECT properties FROM nodes WHERE type = 'opportunity'").all();
  assert.equal(rows.length, 2);
  const sections = rows.map((row) => JSON.parse(row.properties).section).sort();
  assert.deepEqual(sections, ['business-model', 'unknown'],
    'sections are the real slug (from the evidence node) + the honest unknown - never Artifact/Section/memory_event');
  db.close();
});

check('Hook 5 -- predicate seam: critic+tail banks tail-flagged candidates; all banks every resolved verdict', () => {
  const db1 = freshDb();
  const tailEntry = mkEntry({ banked: false, critic: 'pending', tailFlag: true, titleA: 'Tail', titleB: 'Gem' });
  const r1 = bankStatements(db1, 'test-session', [tailEntry], { predicate: 'critic+tail' });
  assert.equal(r1.ok, true);
  assert.equal(r1.banked, 1, 'critic+tail banks the tail-flagged weak-signal candidate');
  db1.close();

  const db2 = freshDb();
  const entries = [
    mkEntry({ banked: false, critic: 'fail', titleA: 'Resolved', titleB: 'Fail' }),
    mkEntry({ banked: false, critic: 'pending', titleA: 'Still', titleB: 'Pending' }),
  ];
  const r2 = bankStatements(db2, 'test-session', entries, { predicate: 'all' });
  assert.equal(r2.ok, true);
  assert.equal(r2.banked, 1, "'all' banks every RESOLVED verdict (pending stays out)");
  db2.close();

  // Env seam: the documented MINDRIAN_OPPORTUNITY_BANK_PREDICATE variable.
  const db3 = freshDb();
  const prev = process.env.MINDRIAN_OPPORTUNITY_BANK_PREDICATE;
  process.env.MINDRIAN_OPPORTUNITY_BANK_PREDICATE = 'critic+tail';
  try {
    const r3 = bankStatements(db3, 'test-session', [tailEntry]);
    assert.equal(r3.predicate, 'critic+tail', 'env var drives the predicate');
    assert.equal(r3.banked, 1);
  } finally {
    if (prev === undefined) delete process.env.MINDRIAN_OPPORTUNITY_BANK_PREDICATE;
    else process.env.MINDRIAN_OPPORTUNITY_BANK_PREDICATE = prev;
  }
  db3.close();

  assert.equal(resolveBankPredicate('nonsense'), 'critic', 'unrecognized value falls back to critic');
});

check('Hook 6 -- re-running the banking pass is idempotent (UPSERT, no duplicates)', () => {
  const db = freshDb();
  const entries = [mkEntry({ banked: true, titleA: 'Same', titleB: 'Pair', idA: 'n:1', idB: 'n:2' })];
  const r1 = bankStatements(db, 'test-session', entries);
  const r2 = bankStatements(db, 'test-session', entries);
  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);
  const nodes = db.prepare("SELECT COUNT(*) AS c FROM nodes WHERE type = 'opportunity'").get().c;
  assert.equal(nodes, 1, 're-run UPSERTs the same (sessionId, name) node, never duplicates');
  const hist = JSON.parse(db.prepare("SELECT properties FROM nodes WHERE type = 'opportunity'").get().properties).stage_history;
  assert.equal(hist.length, 1, 'the merge UPSERT never appends a second mint entry (D-17)');
  db.close();
});

check('Hook 7 -- banking pass source hygiene: env seam documented, no graph-ops for banking', () => {
  const src = fs.readFileSync(reportPath, 'utf8');
  assert.ok(/MINDRIAN_OPPORTUNITY_BANK_PREDICATE/.test(src), 'the env seam is present + documented');
  assert.equal(/require\(['"][^'"]*graph-ops\.cjs['"]\)/.test(src) || /require\([^)]*graph-ops/.test(src), false,
    'no graph-ops require introduced for banking (indexOpportunity bypass stays out)');
  assert.equal(/indexOpportunity\s*\(/.test(src), false, 'indexOpportunity is never called');
  const codeLines = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l));
  assert.equal(codeLines.some((l) => /INSERT\s+INTO\s+(nodes|edges)/i.test(l)), false,
    'no raw INSERT INTO nodes/edges (all banking writes route through navigation)');
});

console.log(`\nPASS (${pass}/${total})`);
