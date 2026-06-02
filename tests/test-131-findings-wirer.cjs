'use strict';
// Phase 131-04 -- findings-wirer + F.1 filing selector + teaching-graph resolver
// behavior suite (RED-first).
//
// Three modules under test (all absent at RED):
//   lib/lens-engine/correlation-resolver.cjs  -- resolveCorrelation(targetName, opts)
//     (the consumer-side teaching-graph resolver built from 130.7's REAL exports:
//      parseLabelIndex + computeCorrelationId; there is NO correlation.resolve).
//   lib/core/research-filing-selector.cjs     -- buildFilingSelector(finding, candidateSections, opts)
//     (the Stage 6 F.1 filing gate MIRRORING lib/hmi/selector-dispatcher.cjs;
//      NOT a bespoke selector -- the LOCKED Phase 136 forward contract).
//   lib/core/findings-wirer.cjs               -- wireAccept / wireReject / wireDefer
//     (the Stage 7 typed-node + cascade-edge writer through navigation.cjs;
//      LOCAL targets land on the LOCAL room.db node id; TEACHING-GRAPH targets
//      land on the REAL correlation_id from the consumer-side resolver).
//
// Canon Part 4: every choice is graph data (accept -> INFORMS; reject -> REJECTED_BECAUSE
//   carrying the captured reason; both enum-only scalars per Part 8).
// Canon Part 5: an EvidenceClaim carries a graded evidence_tier from the closed set.
// Canon Part 8: edge properties + event payloads are enum/scalar + provenance scalars only;
//   finding prose lives on the EvidenceClaim NODE, never on the edge.
// Canon Part 9 role 5: a wired EvidenceClaim lands review_status proposed (never confirmed).
// NO em-dashes in this file (CLAUDE.md HARD RULE).

const { ok, equal } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const correlation = require(path.join(REPO_ROOT, 'lib', 'core', 'correlation.cjs'));
const labelIndex = require(path.join(REPO_ROOT, 'lib', 'core', 'correlation-label-index.cjs'));

// The three modules under test (require lazily inside each test so a load-time
// throw on an absent module is captured as a clean FAIL, not a crash, at RED).
function loadResolver() {
  return require(path.join(REPO_ROOT, 'lib', 'lens-engine', 'correlation-resolver.cjs'));
}
function loadSelector() {
  return require(path.join(REPO_ROOT, 'lib', 'core', 'research-filing-selector.cjs'));
}
function loadWirer() {
  return require(path.join(REPO_ROOT, 'lib', 'core', 'findings-wirer.cjs'));
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// A REAL correlation_labels index body built via 130.7's serializeLabelIndex. It
// carries a single-label teaching-graph target (SWOT Analysis -> Framework deg 5)
// AND a cross-label-duplicate name (HEART Framework under :Framework deg 8 AND
// :Product deg 2) so the no-fork canonical pick is exercised against REAL data,
// NOT a stub.
const CORRELATION_LABELS_BODY = labelIndex.serializeLabelIndex([
  { canonical_name: 'SWOT Analysis', primary_label: 'Framework', edge_degree: 5 },
  { canonical_name: 'HEART Framework', primary_label: 'Framework', edge_degree: 8 },
  { canonical_name: 'HEART Framework', primary_label: 'Product', edge_degree: 2 },
]);

// A typical ranked finding (the Plan 03 driver output shape).
const SAMPLE_FINDING = Object.freeze({
  source: 'OpenAlex',
  url: 'https://openalex.org/W999',
  retrieved_at: '2026-06-02T00:00:00Z',
  evidence_tier: 'Academic',
  relevance: 0.82,
  summary: 'Autologous CAR-T per-dose COGS fell 38% across 2022-2025 trials',
  title: 'CAR-T cost curve 2025',
});

function makeRoom() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-131-wirer-'));
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  const db = openRoomDb(tmp);
  return { tmp, db };
}

function cleanup(tmp) {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

// Seed a node so cascade edges (FK to nodes(id)) can reference it. Pre-empts the
// recurring FOREIGN KEY incident by seeding BOTH the local section/claim target
// nodes AND a teaching-graph correlation_id-keyed target node (mirrors 130-04).
function seedNode(db, id, type) {
  const nowMs = Date.now();
  db.prepare(
    "INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) "
    + "VALUES (?, ?, '{}', 'fixture', 'system', NULL, 'proposed', ?, ?)"
  ).run(id, type || 'claim', nowMs, nowMs);
}

function edgesOfType(db, type) {
  return db.prepare('SELECT source, target, type, properties FROM edges WHERE type = ?').all(type);
}

function eventsOfType(db, eventType) {
  return db.prepare(
    "SELECT properties FROM nodes WHERE type = 'memory_event' AND properties LIKE ?"
  ).all('%"event_type":"' + eventType + '"%');
}

// ---------------------------------------------------------------------------
// Selector tests (Task 2 surface)
// ---------------------------------------------------------------------------

function test1_buildFilingSelectorReturnsShapeF1Envelope() {
  const selector = loadSelector();
  const candidates = [
    { section: 'financial-model', match_pct: 0.82, target_id: 'section:financial-model', target_kind: 'local' },
    { section: 'market-analysis', match_pct: 0.41, target_id: 'section:market-analysis', target_kind: 'local' },
  ];
  const out = selector.buildFilingSelector(SAMPLE_FINDING, candidates, { mode: 'A' });
  ok(out && typeof out === 'object', 'buildFilingSelector returns an object');
  ok(out.envelope && typeof out.envelope === 'object', 'carries the dispatcher envelope');
  equal(out.envelope.shape, 'F.1', 'envelope shape is F.1 (mirrors selector-dispatcher)');
  // The five filing verbs map to the closed vocabulary; the primary carries the
  // highest match.
  const verbs = out.envelope.rendered && out.envelope.rendered.contract
    ? out.envelope.rendered.contract.verbs : [];
  ok(Array.isArray(verbs) && verbs.length > 0, 'the F.1 contract carries verbs');
  const verbBlob = verbs.join(' | ');
  ok(/File to primary/i.test(verbBlob), 'a File-to-primary verb is present');
  ok(/Defer/i.test(verbBlob), 'a Defer verb is present');
  ok(/Reject/i.test(verbBlob), 'a Reject verb is present');
  // The parsed options map the wirer consumes; primary carries the highest match.
  ok(out.options && typeof out.options === 'object', 'an options map is returned for the wirer');
  ok(out.options.primary && out.options.primary.target_id === 'section:financial-model',
    'the primary option points at the highest-match section');
}

function test2_filingSelectorRequiresDispatcher() {
  const src = fs.readFileSync(
    path.join(REPO_ROOT, 'lib', 'core', 'research-filing-selector.cjs'), 'utf8'
  );
  ok(/selector-dispatcher/.test(src),
    'research-filing-selector.cjs MUST require lib/hmi/selector-dispatcher.cjs (NOT a bespoke selector)');
  ok(!src.includes(String.fromCharCode(8212)), 'research-filing-selector.cjs must contain zero em-dashes');
}

function test3_filingSelectorDegradesOnEmptyCandidates() {
  const selector = loadSelector();
  const out = selector.buildFilingSelector(SAMPLE_FINDING, [], { mode: 'B' });
  ok(out && typeof out === 'object', 'empty candidateSections degrades, never throws');
  const verbs = out.envelope && out.envelope.rendered && out.envelope.rendered.contract
    ? out.envelope.rendered.contract.verbs : [];
  const verbBlob = verbs.join(' | ');
  ok(/Defer/i.test(verbBlob) && /Reject/i.test(verbBlob),
    'empty candidates degrade to a Defer/Reject-only selector');
}

// ---------------------------------------------------------------------------
// Teaching-graph resolver tests (Task 2 surface; the REAL resolver, not a stub)
// ---------------------------------------------------------------------------

function test4_resolveCorrelationPicksCanonicalNoFork() {
  const resolver = loadResolver();
  // Cross-label-duplicate name -- Framework-preferred (most-edged within the
  // preferred label). The resolver must compose 130.7's REAL exports.
  const r = resolver.resolveCorrelation('HEART Framework', { correlationLabelsSection: CORRELATION_LABELS_BODY });
  ok(r && typeof r === 'object', 'resolveCorrelation returns a tuple object');
  equal(r.primary_label, 'Framework', 'cross-label duplicate resolves to the methodology label (Framework)');
  equal(r.canonical_name, 'HEART Framework', 'canonical_name is the resolved name');
  // The id EQUALS computeCorrelationId(canonical, label) by construction, NOT the raw name.
  const expected = correlation.computeCorrelationId('HEART Framework', 'Framework');
  equal(r.correlation_id, expected, 'correlation_id equals computeCorrelationId(canonical, primary_label)');
  ok(r.correlation_id !== 'HEART Framework', 'correlation_id is NOT the raw name');
}

function test5_resolveCorrelationDefaultsFrameworkWhenAbsent() {
  const resolver = loadResolver();
  const r = resolver.resolveCorrelation('Totally Novel Concept', { correlationLabelsSection: CORRELATION_LABELS_BODY });
  ok(r && typeof r === 'object', 'a name absent from the index still resolves, never throws');
  equal(r.primary_label, 'Framework', 'an absent name defaults primary_label to Framework');
  const expected = correlation.computeCorrelationId('Totally Novel Concept', 'Framework');
  equal(r.correlation_id, expected, 'absent name resolves to computeCorrelationId(name, Framework)');
  // A null section degrades gracefully too.
  const r2 = resolver.resolveCorrelation('X', {});
  ok(r2 && typeof r2.correlation_id === 'string' && r2.correlation_id.length > 0,
    'a missing correlationLabelsSection degrades to the Framework-default tuple, never throws');
}

// ---------------------------------------------------------------------------
// Wirer tests (Task 3 surface)
// ---------------------------------------------------------------------------

function test6_wireAcceptLocalTargetWritesEvidenceClaimAndLocalInformsEdge() {
  const { tmp, db } = makeRoom();
  try {
    seedNode(db, 'section:financial-model', 'section');
    const wirer = loadWirer();
    const r = wirer.wireAccept(db, {
      finding: SAMPLE_FINDING,
      decision: { target_kind: 'local', target_section: 'financial-model' },
      roomDir: tmp,
      sessionId: 'sess-1',
      topic: 'CAR-T cost curve',
    });
    ok(r && r.ok, 'wireAccept (local) returns ok; got ' + JSON.stringify(r));
    // EvidenceClaim node exists and is PROPOSED (Canon Part 9 role 5).
    ok(typeof r.node_id === 'string' && r.node_id.length > 0, 'wireAccept returns the EvidenceClaim node_id');
    const node = db.prepare("SELECT type, review_status FROM nodes WHERE id = ?").get(r.node_id);
    ok(node, 'the EvidenceClaim node exists');
    equal(node.type, 'EvidenceClaim', 'node type is EvidenceClaim');
    equal(node.review_status, 'proposed', 'EvidenceClaim lands proposed (never auto-confirmed)');
    // INFORMS edge target is the LOCAL room.db node id, NOT a correlation_id.
    const informs = edgesOfType(db, 'INFORMS');
    equal(informs.length, 1, 'exactly one INFORMS edge written');
    equal(informs[0].source, r.node_id, 'INFORMS edge source is the EvidenceClaim node');
    equal(informs[0].target, 'section:financial-model',
      'INFORMS target is the LOCAL room.db node id (NOT a correlation_id)');
    // research_filed event carries provenance.
    const filed = eventsOfType(db, 'research_filed');
    ok(filed.length >= 1, 'a research_filed memory_event was emitted');
    const payload = JSON.parse(filed[0].properties);
    ok(/openalex\.org/.test(JSON.stringify(payload)), 'the research_filed event carries url provenance');
    ok(/Academic/.test(JSON.stringify(payload)), 'the research_filed event carries evidence_tier provenance');
  } finally {
    closeRoomDb(db); cleanup(tmp);
  }
}

function test7_wireAcceptTeachingGraphTargetWritesRealCorrelationId() {
  const { tmp, db } = makeRoom();
  try {
    const resolver = loadResolver();
    const expectedId = resolver.resolveCorrelation('SWOT Analysis', {
      correlationLabelsSection: CORRELATION_LABELS_BODY,
    }).correlation_id;
    seedNode(db, expectedId, 'correlation_target');
    const wirer = loadWirer();
    const r = wirer.wireAccept(db, {
      finding: SAMPLE_FINDING,
      decision: { target_kind: 'teaching-graph', target_section: 'SWOT Analysis' },
      roomDir: tmp,
      sessionId: 'sess-2',
      topic: 'CAR-T cost curve',
      correlationLabelsSection: CORRELATION_LABELS_BODY,
    });
    ok(r && r.ok, 'wireAccept (teaching-graph) returns ok; got ' + JSON.stringify(r));
    const informs = edgesOfType(db, 'INFORMS');
    equal(informs.length, 1, 'exactly one INFORMS edge written');
    equal(informs[0].target, expectedId,
      'INFORMS target is the REAL resolved correlation_id (not the raw name, not a stub)');
    ok(informs[0].target !== 'SWOT Analysis', 'the edge target is NOT the raw name');
  } finally {
    closeRoomDb(db); cleanup(tmp);
  }
}

function test8_wireAcceptWritesContradictsAndSupersedesOnFlags() {
  const { tmp, db } = makeRoom();
  try {
    seedNode(db, 'section:market-analysis', 'section');
    seedNode(db, 'claim:old-cost', 'claim');
    seedNode(db, 'EvidenceClaim:prior', 'EvidenceClaim');
    const wirer = loadWirer();
    const r = wirer.wireAccept(db, {
      finding: SAMPLE_FINDING,
      decision: {
        target_kind: 'local',
        target_section: 'market-analysis',
        kills_claim: 'claim:old-cost',
        better_tier_than: 'EvidenceClaim:prior',
      },
      roomDir: tmp,
      sessionId: 'sess-3',
      topic: 'cost',
    });
    ok(r && r.ok, 'wireAccept with flags returns ok; got ' + JSON.stringify(r));
    const contradicts = edgesOfType(db, 'CONTRADICTS');
    equal(contradicts.length, 1, 'a CONTRADICTS edge is written when decision flags kills_claim');
    equal(contradicts[0].target, 'claim:old-cost', 'CONTRADICTS targets the killed claim');
    const supersedes = edgesOfType(db, 'SUPERSEDES');
    equal(supersedes.length, 1, 'a SUPERSEDES edge is written when decision flags better_tier_than');
    equal(supersedes[0].target, 'EvidenceClaim:prior', 'SUPERSEDES targets the lower-tier prior claim');
  } finally {
    closeRoomDb(db); cleanup(tmp);
  }
}

function test9_wireRejectWritesExactlyOneRejectedBecauseAndEvent() {
  const { tmp, db } = makeRoom();
  try {
    seedNode(db, 'section:solution-design', 'section');
    const wirer = loadWirer();
    const r = wirer.wireReject(db, {
      finding: SAMPLE_FINDING,
      reason: 'off_topic',
      roomDir: tmp,
      sessionId: 'sess-4',
      decision: { target_kind: 'local', target_section: 'solution-design' },
    });
    ok(r && r.ok, 'wireReject returns ok; got ' + JSON.stringify(r));
    const rejected = edgesOfType(db, 'REJECTED_BECAUSE');
    equal(rejected.length, 1, 'exactly one REJECTED_BECAUSE edge is written');
    const props = JSON.parse(rejected[0].properties);
    equal(props.reason, 'off_topic', 'the REJECTED_BECAUSE edge carries the captured reason scalar');
    // Zero INFORMS edges for a rejected finding.
    equal(edgesOfType(db, 'INFORMS').length, 0, 'zero INFORMS edges for the rejected finding');
    const ev = eventsOfType(db, 'research_rejected');
    ok(ev.length >= 1, 'a research_rejected memory_event was emitted');
  } finally {
    closeRoomDb(db); cleanup(tmp);
  }
}

function test10_wireDeferWritesEventNoEdge() {
  const { tmp, db } = makeRoom();
  try {
    const wirer = loadWirer();
    const r = wirer.wireDefer(db, { finding: SAMPLE_FINDING, roomDir: tmp });
    ok(r && r.ok, 'wireDefer returns ok; got ' + JSON.stringify(r));
    const ev = eventsOfType(db, 'research_deferred');
    ok(ev.length >= 1, 'a research_deferred memory_event was emitted (queued to milestone audit)');
    // No cascade edge of any kind.
    const total = db.prepare("SELECT COUNT(*) AS n FROM edges").get();
    equal(total.n, 0, 'wireDefer writes NO cascade edge');
  } finally {
    closeRoomDb(db); cleanup(tmp);
  }
}

// ---------------------------------------------------------------------------
// Phantom-interface guard (T-131-04-05): the wirer + resolver compose the REAL
// 130.7 exports and never reference a nonexistent correlation.resolve.
// ---------------------------------------------------------------------------

function test11_noPhantomCorrelationResolve() {
  const wirerSrc = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'core', 'findings-wirer.cjs'), 'utf8');
  const resolverSrc = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'lens-engine', 'correlation-resolver.cjs'), 'utf8');
  ok(/correlation-resolver/.test(wirerSrc), 'findings-wirer requires correlation-resolver (the REAL resolver)');
  ok(/logMemoryEvent/.test(wirerSrc), 'findings-wirer logs events via navigation.logMemoryEvent (the re-export chokepoint)');
  ok(!/correlation\.resolve\b/.test(wirerSrc), 'findings-wirer never references the phantom correlation.resolve');
  ok(/computeCorrelationId/.test(resolverSrc), 'correlation-resolver composes computeCorrelationId (the REAL 130.7 export)');
  ok(/parseLabelIndex/.test(resolverSrc), 'correlation-resolver composes parseLabelIndex (the REAL 130.7 export)');
  ok(!/correlation\.resolve\b/.test(resolverSrc), 'correlation-resolver never references the phantom correlation.resolve');
  ok(!wirerSrc.includes(String.fromCharCode(8212)), 'findings-wirer must contain zero em-dashes');
  ok(!resolverSrc.includes(String.fromCharCode(8212)), 'correlation-resolver must contain zero em-dashes');
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const TESTS = [
  ['test1_buildFilingSelectorReturnsShapeF1Envelope', test1_buildFilingSelectorReturnsShapeF1Envelope],
  ['test2_filingSelectorRequiresDispatcher', test2_filingSelectorRequiresDispatcher],
  ['test3_filingSelectorDegradesOnEmptyCandidates', test3_filingSelectorDegradesOnEmptyCandidates],
  ['test4_resolveCorrelationPicksCanonicalNoFork', test4_resolveCorrelationPicksCanonicalNoFork],
  ['test5_resolveCorrelationDefaultsFrameworkWhenAbsent', test5_resolveCorrelationDefaultsFrameworkWhenAbsent],
  ['test6_wireAcceptLocalTargetWritesEvidenceClaimAndLocalInformsEdge', test6_wireAcceptLocalTargetWritesEvidenceClaimAndLocalInformsEdge],
  ['test7_wireAcceptTeachingGraphTargetWritesRealCorrelationId', test7_wireAcceptTeachingGraphTargetWritesRealCorrelationId],
  ['test8_wireAcceptWritesContradictsAndSupersedesOnFlags', test8_wireAcceptWritesContradictsAndSupersedesOnFlags],
  ['test9_wireRejectWritesExactlyOneRejectedBecauseAndEvent', test9_wireRejectWritesExactlyOneRejectedBecauseAndEvent],
  ['test10_wireDeferWritesEventNoEdge', test10_wireDeferWritesEventNoEdge],
  ['test11_noPhantomCorrelationResolve', test11_noPhantomCorrelationResolve],
];

let passed = 0;
let failed = 0;
for (const [name, fn] of TESTS) {
  try {
    fn();
    passed += 1;
    console.log('  PASS ' + name);
  } catch (err) {
    failed += 1;
    console.error('  FAIL ' + name + ': ' + (err && err.message ? err.message : err));
  }
}

console.log('');
console.log('Phase 131-04 findings-wirer + selector + resolver: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) {
  process.exit(1);
}
