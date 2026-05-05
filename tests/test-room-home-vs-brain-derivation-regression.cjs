'use strict';
// Phase 109-09 test: getRoomHomeView shape + composition-not-duplication invariant +
// Phase 90 deriveSection regression fence. NAV-109-08.

const { ok, equal } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));

const ROOM_ID = 'test';

function makeRoom(opts) {
  const o = opts || {};
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-109-room-home-'));
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  const db = openRoomDb(tmp);
  const nowMs = Date.now();
  const days = (n) => nowMs - n * 24 * 60 * 60 * 1000;
  // 10 columns / 9 placeholders (created_by hardcoded to 'user' to satisfy the
  // Phase 109-01 CHECK constraint on nodes.created_by).
  const insN = db.prepare(
    "INSERT OR IGNORE INTO nodes "
    + "(id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at, source_section) "
    + "VALUES (?, ?, ?, ?, 'user', ?, ?, ?, ?, ?)"
  );
  // Room root.
  insN.run('room:' + ROOM_ID, 'room', '{}', 'fixture', 1.0, 'confirmed', nowMs, nowMs, null);
  // Confirmed facts (validated).
  insN.run('claim:fact-1', 'claim', JSON.stringify({ summary: 'fact 1' }), 'fixture/f1.md', 0.8, 'validated', nowMs, nowMs, 'design');
  insN.run('claim:fact-2', 'claim', JSON.stringify({ summary: 'fact 2' }), 'fixture/f2.md', 0.8, 'validated', nowMs, nowMs, 'design');
  // Risky assumptions.
  insN.run('assumption:r1', 'assumption', JSON.stringify({ claim: 'risky 1' }), 'fixture/r1.md', 0.4, 'confirmed', nowMs, nowMs, 'design');
  insN.run('assumption:r2', 'assumption', JSON.stringify({ claim: 'risky 2' }), 'fixture/r2.md', 0.4, 'needs_evidence', nowMs, nowMs, 'design');
  // Evidence by tier.
  insN.run('evidence:e-acad', 'evidence', JSON.stringify({ tier: 'academic', summary: 'paper' }), 'fixture/ea.md', 0.9, 'confirmed', nowMs, nowMs, 'design');
  insN.run('evidence:e-op', 'evidence', JSON.stringify({ tier: 'operational', summary: 'experiment' }), 'fixture/eo.md', 0.7, 'confirmed', nowMs, nowMs, 'design');
  insN.run('evidence:e-pr', 'evidence', JSON.stringify({ tier: 'practitioner', summary: 'pattern' }), 'fixture/ep.md', 0.5, 'confirmed', nowMs, nowMs, 'design');
  insN.run('evidence:e-none', 'evidence', JSON.stringify({ tier: 'none', summary: 'opinion' }), 'fixture/en.md', 0.3, 'confirmed', nowMs, nowMs, 'design');
  // Open questions: orphan and answered.
  insN.run('open_question:o-orphan', 'open_question', JSON.stringify({ text: 'orphan?' }), 'fixture/oo.md', 0.5, 'proposed', days(15), days(15), 'design');
  insN.run('open_question:o-answered', 'open_question', JSON.stringify({ text: 'answered?' }), 'fixture/oa.md', 0.5, 'proposed', days(7), days(7), 'design');
  // Contradictions: 2 claims attached to room with CONTRADICTS.
  insN.run('claim:contra-a', 'claim', JSON.stringify({ summary: 'A' }), 'fixture/ca.md', 0.6, 'confirmed', nowMs, nowMs, 'design');
  insN.run('claim:contra-b', 'claim', JSON.stringify({ summary: 'B' }), 'fixture/cb.md', 0.6, 'confirmed', nowMs, nowMs, 'design');
  // Opportunities (ensure at least one is reachable from room root for distance ranking;
  // findRelevantOpportunities scores all opportunities room-wide per Canon Part 2 ambient).
  for (let i = 0; i < 8; i++) {
    insN.run('opportunity:o' + i, 'opportunity', JSON.stringify({ hsi_score: 90 - i * 10, tags: ['fintech'] }), 'fixture/op' + i + '.md', 0.6, 'confirmed', nowMs, nowMs, 'design');
  }
  // Memory events: 25 within 24h (test 20-cap). 9 placeholders so source_section
  // must be supplied (null acceptable; the column is nullable).
  for (let i = 0; i < 25; i++) {
    const evId = 'memory_event:test:' + i;
    insN.run(evId, 'memory_event', JSON.stringify({ event_type: 'node_created', target_node_id: 'claim:fact-1' }), 'session:test', null, 'confirmed', nowMs - i * 60 * 1000, nowMs - i * 60 * 1000, null);
  }

  const insE = db.prepare("INSERT OR IGNORE INTO edges (source, target, type, properties) VALUES (?, ?, ?, '{}')");
  // Wire opportunities to room root for distance ranking.
  for (let i = 0; i < 8; i++) insE.run('room:' + ROOM_ID, 'opportunity:o' + i, 'BANKED_BY');
  // Wire contradictions reachable from room root.
  insE.run('room:' + ROOM_ID, 'claim:contra-a', 'INFORMS');
  insE.run('room:' + ROOM_ID, 'claim:contra-b', 'INFORMS');
  insE.run('claim:contra-a', 'claim:contra-b', 'CONTRADICTS');
  // o-answered has SUPPORTS edge.
  insE.run('evidence:e-acad', 'open_question:o-answered', 'SUPPORTS');

  // identity.thesis if requested. The identity table requires updated_at NOT NULL
  // (Phase 84-02 memory-ops.cjs schema); supply ISO timestamp explicitly.
  if (o.thesis) {
    db.prepare(
      "INSERT OR REPLACE INTO identity (key, value, updated_at) VALUES ('thesis', ?, ?)"
    ).run(o.thesis, new Date().toISOString());
  }
  return { tmp, db };
}

function cleanup(tmp) { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ } }
function defaultMocks() { return { jtbd: { getCurrent: () => ({ current: null }) }, operator: { getCurrent: () => ({ current: null }) } }; }

function test1_shape() {
  const { tmp, db } = makeRoom();
  try {
    const r = navigation.getRoomHomeView(db, ROOM_ID, { _mocks: defaultMocks() });
    for (const k of ['currentThesis', 'confirmedFacts', 'riskyAssumptions', 'evidence', 'contradictions', 'openQuestions', 'recentChanges', 'bankedOpportunities', 'nextMove']) {
      ok(k in r, 'home key present: ' + k);
    }
    db.close();
  } finally { cleanup(tmp); }
}

function test2_currentThesisDefault() {
  const { tmp, db } = makeRoom();
  try {
    const r = navigation.getRoomHomeView(db, ROOM_ID, { _mocks: defaultMocks() });
    equal(r.currentThesis, '', 'default empty string when identity.thesis absent');
    db.close();
  } finally { cleanup(tmp); }
}

function test3_currentThesisFromIdentity() {
  const { tmp, db } = makeRoom({ thesis: 'X is the play.' });
  try {
    const r = navigation.getRoomHomeView(db, ROOM_ID, { _mocks: defaultMocks() });
    equal(r.currentThesis, 'X is the play.');
    db.close();
  } finally { cleanup(tmp); }
}

function test4_evidenceByTier() {
  const { tmp, db } = makeRoom();
  try {
    const r = navigation.getRoomHomeView(db, ROOM_ID, { _mocks: defaultMocks() });
    for (const tier of ['academic', 'operational', 'practitioner', 'none']) {
      ok(Array.isArray(r.evidence[tier]), 'evidence.' + tier + ' is array');
    }
    // Each tier has the seeded entry.
    equal(r.evidence.academic.length, 1);
    equal(r.evidence.operational.length, 1);
    equal(r.evidence.practitioner.length, 1);
    equal(r.evidence.none.length, 1);
    db.close();
  } finally { cleanup(tmp); }
}

function test5_bankedOpportunitiesTopK() {
  const { tmp, db } = makeRoom();
  try {
    const r = navigation.getRoomHomeView(db, ROOM_ID, { _mocks: defaultMocks() });
    ok(r.bankedOpportunities.length <= 5, 'topK=5 enforced (got ' + r.bankedOpportunities.length + ')');
    db.close();
  } finally { cleanup(tmp); }
}

function test6_recentChangesCap() {
  const { tmp, db } = makeRoom();
  try {
    const r = navigation.getRoomHomeView(db, ROOM_ID, { _mocks: defaultMocks() });
    ok(r.recentChanges.length <= 20, '20-cap enforced (got ' + r.recentChanges.length + ')');
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const ev of r.recentChanges) ok(ev.createdAt >= cutoff, 'event within 24h window: ' + ev.createdAt + ' vs cutoff ' + cutoff);
    db.close();
  } finally { cleanup(tmp); }
}

function test7_compositionNotDuplication() {
  const { tmp, db } = makeRoom();
  try {
    const r = navigation.getRoomHomeView(db, ROOM_ID, { _mocks: defaultMocks() });
    const factIds = new Set(r.confirmedFacts.map((x) => x.id));
    const riskyIds = new Set(r.riskyAssumptions.map((x) => x.id));
    for (const id of factIds) ok(!riskyIds.has(id), 'id ' + id + ' appears in BOTH confirmedFacts and riskyAssumptions');
    db.close();
  } finally { cleanup(tmp); }
}

function test8_phase90RegressionFence() {
  // Read brain-derivation.cjs source; extract BRAIN.md section headings; assert each
  // has an equivalent key in getRoomHomeView output.
  const brainDerivPath = path.join(REPO_ROOT, 'lib', 'core', 'brain-derivation.cjs');
  const src = fs.readFileSync(brainDerivPath, 'utf8');
  // Extract heading-like text from template literals: lines containing '## ' or '### '.
  const headings = new Set();
  const headingRx = /(?:^|\\n|\n)\s*##+\s+([A-Z][A-Za-z0-9 \-]+?)(?:\\n|\n|`|"|')/g;
  let m;
  while ((m = headingRx.exec(src)) !== null) {
    headings.add(m[1].trim());
  }
  // Documented mapping (per RESEARCH section 6.3 - explicit so audits are reviewable):
  const HEADING_TO_HOME_KEY = {
    'Pattern Matches': 'bankedOpportunities',
    'Cross-Domain Analogies': 'bankedOpportunities',
    'Wicked Indicators': 'riskyAssumptions',
    'Unfilled Opportunity Matches': 'bankedOpportunities',
    'Framework Chain Predictions': 'nextMove',
    'Assessment Thinking-Chain Position': 'currentThesis',
    'Problem-Type Classification': 'currentThesis',
    'Cross-Room Contradiction Flags': 'contradictions',
  };
  const { tmp, db } = makeRoom();
  try {
    const r = navigation.getRoomHomeView(db, ROOM_ID, { _mocks: defaultMocks() });
    for (const heading of headings) {
      const expected = HEADING_TO_HOME_KEY[heading];
      if (!expected) continue;  // Headings not in the map are not regression-fenced (documentation gap; flag in summary).
      ok(expected in r, 'BRAIN.md heading "' + heading + '" has equivalent home key "' + expected + '" in getRoomHomeView');
    }
    db.close();
  } finally { cleanup(tmp); }
}

function run() {
  const tests = [test1_shape, test2_currentThesisDefault, test3_currentThesisFromIdentity, test4_evidenceByTier, test5_bankedOpportunitiesTopK, test6_recentChangesCap, test7_compositionNotDuplication, test8_phase90RegressionFence];
  let pass = 0; let fail = 0;
  for (const t of tests) {
    try { t(); pass++; process.stdout.write('PASS ' + t.name + '\n'); }
    catch (err) { fail++; process.stderr.write('FAIL ' + t.name + ': ' + err.message + '\n' + err.stack + '\n'); }
  }
  process.stdout.write('test-room-home-vs-brain-derivation-regression: ' + pass + '/' + tests.length + ' passed\n');
  process.exit(fail === 0 ? 0 : 1);
}

run();
