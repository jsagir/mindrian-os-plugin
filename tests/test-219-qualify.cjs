'use strict';
// Phase 219-04 -- REQ-3 qualification Decision Gate test suite.
//
// Task 1 (RED-first): the verb handlers -- qualifyCandidate (idempotent mint +
// human confirm + D-17 lifecycle advance + bank filing), skipCandidate
// (REJECTED_BECAUSE edge with the closed failed-check enum + outcome 'rejected'
// history entry, node stays proposed), formatRubricLines (the Q1..Q8 WHY
// lines), formatComponentLines (the D-18 machine-readiness WHY lines), and the
// D-20 engine-absent OFFER verb seam (MINDRIAN_FORCE_ENGINE_ABSENT=1).
//
// Task 2 extends this file with the F.1 render wiring assertions (trailer, the
// 5-verb set, rubric + component lines on the card, reached-gate side-channel).
// Task 3 maps one assertion per SPEC requirement-3 acceptance clause (the
// clause is named in the assertion message so a failure names the requirement).
//
// Canon Part 9: only the human Qualify verb confirms (proposed -> confirmed);
//   Skip leaves the node proposed. Rejection is data (Decision 13, SEED-009).
// Canon Part 8: zero network; LOCAL room.db + opportunity-bank/ only.
// SEED-021: the card fires as a real AskUserQuestion contract, never an
//   ASCII box (asserted via the trailer + zero box-drawing glyphs).
//
// NO em-dashes anywhere (CLAUDE.md HARD RULE). Uses the Plan 02 hub-skew
// fixture room (real migrated schema) so confirmNode's chokepoint UPDATE
// (last_modified_at et al.) and the memory_event audit write both round-trip.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'eureka', 'qualify-opportunity.cjs');

const {
  qualifyCandidate,
  skipCandidate,
  formatRubricLines,
  formatComponentLines,
  renderQualificationCard,
  rephraseCandidate,
  suggestNext,
  askBrain,
  SKIP_REASONS,
  OFFER_VERB,
  CARD_VERBS,
} = require(MODULE_PATH);

const { buildFixtureRoom } = require(path.join(REPO_ROOT, 'tests', 'helpers', 'fixture-room-219.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

let pass = 0;
let total = 0;
function check(label, fn) {
  total += 1;
  fn();
  pass += 1;
  console.log('  ok -', label);
}

// One fixture room per test group so bank-dir assertions never cross-talk.
function freshRoom(tag) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-219-qualify-' + tag + '-'));
  return buildFixtureRoom(tmp);
}

function bankFiles(roomDir) {
  const dir = path.join(roomDir, 'opportunity-bank');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'STATE.md');
}

function propsOf(db, nodeId) {
  const row = db.prepare('SELECT properties FROM nodes WHERE id = ?').get(nodeId);
  assert.ok(row, 'node ' + nodeId + ' must be queryable');
  return JSON.parse(row.properties);
}

// A schema-faithful Plan 03 side-channel candidate (219-03-PLAN.md interfaces,
// schema_version 1). `name` is the LOCALLY dereferenced display prose the card
// host resolves from room.db; the side-channel itself stays enum/handle-only.
function makeCandidate(ids, overrides) {
  return Object.assign({
    candidate_id: 'cand-bridge-0001',
    node_handle: null,
    source_event: 'bridge',
    lens: 'leveraging_resources',
    band: 'high',
    score: 0.87,
    connection_count: 2,
    evidence_handles: [ids.bridgeA, ids.bridgeB],
    rubric: { q1: 1, q2: 1, q3: 1, q4: 1, q5: 1, q6: 1, q7: 1, q8: 1 },
    components: {
      critic_gate: 'pass',
      compression_score: 0.62,
      portfolio_score: { strategic_fit: 0.5, validated_demand: 0.4, feasibility: 0.7 },
      tail_flag: false,
      evidence_readiness: 0.5,
      follow_through_readiness: 'unknown',
    },
    harvest_index: {
      version: 'HarvestIndex_v1',
      status: 'EXPERIMENTAL',
      value: 0.44,
      weights: { compression: 0.3, portfolio: 0.3, evidence: 0.2, follow_through: 0.2 },
    },
    engine_mode: 'engine',
    session_id: 'fixture-219',
    name: 'Vantorix x Cryogenic Pump Array bridge',
  }, overrides || {});
}

console.log('test-219-qualify');

// ---------------------------------------------------------------------------
// Test 1: qualifyCandidate -- mint + confirm + lifecycle advance + bank filing
// ---------------------------------------------------------------------------

check('Test 1 -- REQ-3 acceptance: Qualify files the candidate (status qualified) via navigation.cjs (mint + confirm + D-17 advance + bank entry)', () => {
  const room = freshRoom('qualify');
  const db = openRoomDb(room.roomDir, { allowExtension: true });
  try {
    const cand = makeCandidate(room.ids);
    const r = qualifyCandidate(db, room.roomDir, cand, 'navigator');
    assert.equal(r.ok, true, 'qualifyCandidate ok: ' + JSON.stringify(r));
    assert.ok(typeof r.node_id === 'string' && r.node_id.length > 0, 'node_id returned');

    const row = db.prepare('SELECT type, review_status FROM nodes WHERE id = ?').get(r.node_id);
    assert.ok(row, 'opportunity node exists');
    assert.equal(row.type, 'opportunity', 'typed opportunity node');
    assert.equal(row.review_status, 'confirmed', 'Qualify is the human promote: proposed -> confirmed');

    const props = propsOf(db, r.node_id);
    assert.equal(props.lifecycle, 'qualified', 'lifecycle advanced to qualified');
    assert.ok(Array.isArray(props.stage_history), 'stage_history present');
    assert.ok(props.stage_history.length >= 2, 'mint entry + qualify entry (prior entries preserved, D-17)');
    const mintEntry = props.stage_history[0];
    assert.equal(mintEntry.from, null, 'mint entry preserved (from null)');
    const last = props.stage_history[props.stage_history.length - 1];
    assert.equal(last.to, 'qualified', 'D-17 entry records to=qualified');
    assert.equal(last.actor, 'navigator', 'D-17 entry carries actor=byUser');
    assert.ok(typeof last.reason === 'string' && last.reason.length > 0, 'D-17 entry carries a reason');
    assert.deepEqual(last.evidence_ids, cand.evidence_handles, 'D-17 entry carries the candidate evidence_handles');
    assert.equal(last.formula_version, 'HarvestIndex_v1', 'D-17 entry carries formula_version HarvestIndex_v1');
    assert.equal(props.engine_mode, 'engine', 'engine_mode propagated into node props (D-20 visibility)');

    const files = bankFiles(room.roomDir);
    assert.equal(files.length, 1, 'exactly one bank entry filed by Qualify+file');
    const content = fs.readFileSync(path.join(room.roomDir, 'opportunity-bank', files[0]), 'utf8');
    assert.ok(content.indexOf(cand.name) !== -1, 'bank entry carries the candidate problem');
  } finally {
    closeRoomDb(db);
  }
});

// ---------------------------------------------------------------------------
// Test 1b: idempotent mint -- a second qualify on the same candidate does not
// duplicate the node (stable anchor per the logged planner decision).
// ---------------------------------------------------------------------------

check('Test 1b -- the mint is idempotent: re-qualifying the same candidate never duplicates the anchor node', () => {
  const room = freshRoom('idem');
  const db = openRoomDb(room.roomDir, { allowExtension: true });
  try {
    const cand = makeCandidate(room.ids);
    const first = qualifyCandidate(db, room.roomDir, cand, 'navigator');
    assert.equal(first.ok, true);
    const countBefore = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'opportunity'").get().n;
    const second = qualifyCandidate(db, room.roomDir, cand, 'navigator');
    assert.equal(second.node_id, first.node_id, 'same candidate resolves to the same anchor node');
    const countAfter = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'opportunity'").get().n;
    assert.equal(countAfter, countBefore, 'no duplicate opportunity node on re-qualify');
  } finally {
    closeRoomDb(db);
  }
});

// ---------------------------------------------------------------------------
// Test 2: skipCandidate -- rejection is data (Decision 13, SEED-009, D-05)
// ---------------------------------------------------------------------------

check('Test 2 -- REQ-3 acceptance: Skip produces a rejection edge in room.db (enum reason, node stays proposed, bank stays empty)', () => {
  const room = freshRoom('skip');
  const db = openRoomDb(room.roomDir, { allowExtension: true });
  try {
    const cand = makeCandidate(room.ids, { candidate_id: 'cand-skip-0001', name: 'Orthodox Rail x Maglev tension' });
    const r = skipCandidate(db, cand, 'q3_within_cluster', room.ids.bridgeA, 'navigator');
    assert.equal(r.ok, true, 'skipCandidate ok: ' + JSON.stringify(r));

    const edges = db.prepare("SELECT source, target, properties FROM edges WHERE type = 'REJECTED_BECAUSE'").all();
    assert.equal(edges.length, 1, 'exactly one REJECTED_BECAUSE edge after skip');
    assert.equal(edges[0].source, r.node_id, 'edge hangs on the minted anchor node');
    assert.equal(edges[0].target, room.ids.bridgeA, 'edge targets the named target node');
    const edgeProps = JSON.parse(edges[0].properties);
    assert.equal(edgeProps.reason, 'q3_within_cluster', 'properties.reason is the failed-check enum scalar');
    assert.ok(SKIP_REASONS.indexOf(edgeProps.reason) !== -1, 'reason is a member of the closed enum');

    const row = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(r.node_id);
    assert.equal(row.review_status, 'proposed', 'Skip NEVER confirms: node stays proposed');

    const props = propsOf(db, r.node_id);
    assert.equal(props.opportunity_outcome, 'rejected', 'D-17 outcome axis set to rejected');
    const last = props.stage_history[props.stage_history.length - 1];
    assert.equal(last.to, 'rejected', 'D-17 history entry records the rejection');
    assert.equal(last.reason, 'q3_within_cluster', 'D-17 history reason is the failed-check enum');
    assert.equal(last.actor, 'navigator', 'D-17 history actor carried');

    assert.equal(bankFiles(room.roomDir).length, 0, 'opportunity-bank/ stays EMPTY after skip');
  } finally {
    closeRoomDb(db);
  }
});

check('Test 2b -- an out-of-enum skip reason is rejected with { ok:false } and writes nothing', () => {
  const room = freshRoom('badreason');
  const db = openRoomDb(room.roomDir, { allowExtension: true });
  try {
    const cand = makeCandidate(room.ids, { candidate_id: 'cand-bad-0001', name: 'Bad reason candidate' });
    const r = skipCandidate(db, cand, 'not_a_real_reason', room.ids.bridgeA, 'navigator');
    assert.equal(r.ok, false, 'out-of-enum reason returns ok:false');
    const edges = db.prepare("SELECT COUNT(*) AS n FROM edges WHERE type = 'REJECTED_BECAUSE'").get().n;
    assert.equal(edges, 0, 'no rejection edge written for an invalid reason');
  } finally {
    closeRoomDb(db);
  }
});

// ---------------------------------------------------------------------------
// Test 3: nothing-files-without-Qualify (render + skip + rephrase paths)
// ---------------------------------------------------------------------------

check('Test 3 -- REQ-3 acceptance: nothing lands in opportunity-bank/ without an explicit Qualify (render + skip + rephrase paths)', () => {
  const room = freshRoom('nofile');
  const db = openRoomDb(room.roomDir, { allowExtension: true });
  try {
    const cand = makeCandidate(room.ids, { candidate_id: 'cand-nofile-0001', name: 'No-file candidate' });
    const gateFile = path.join(room.roomDir, '.mindrian', 'test-card-fire-reached.json');

    const rendered = renderQualificationCard(cand, null, { gateFilePath: gateFile });
    assert.equal(rendered.ok, true, 'render ok: ' + JSON.stringify(rendered && rendered.reason));
    const skipped = skipCandidate(db, cand, 'q4_stale_window', room.ids.bridgeB, 'navigator');
    assert.equal(skipped.ok, true);
    const rephrased = rephraseCandidate(cand);
    assert.equal(rephrased.ok, true, 'rephrase returns the candidate for re-title');
    assert.equal(rephrased.candidate.candidate_id, cand.candidate_id, 'rephrase hands back the same candidate');

    assert.equal(bankFiles(room.roomDir).length, 0, 'opportunity-bank/ contains ZERO entries after render + skip + rephrase');
  } finally {
    closeRoomDb(db);
  }
});

// ---------------------------------------------------------------------------
// Test 4: qualify NEVER invokes the analysis chain (REQ-4 handoff to Plan 05)
// ---------------------------------------------------------------------------

check('Test 4 -- qualifyCandidate never auto-fires the analysis chain (behavioral + comment-filtered source scan)', () => {
  const room = freshRoom('nochain');
  const db = openRoomDb(room.roomDir, { allowExtension: true });
  try {
    const cand = makeCandidate(room.ids, { candidate_id: 'cand-nochain-0001', name: 'No-chain candidate' });
    const r = qualifyCandidate(db, room.roomDir, cand, 'navigator');
    assert.equal(r.ok, true);
    const props = propsOf(db, r.node_id);
    assert.notEqual(props.opportunity_stage, 'explored', 'no explored artifact/stage after qualify');
    assert.equal(props.lifecycle, 'qualified', 'lifecycle stops at qualified');

    // Comment-filtered source scan: no chain invocation on CODE lines.
    const src = fs.readFileSync(MODULE_PATH, 'utf8');
    const codeLines = src.split('\n').filter((l) => {
      const t = l.trim();
      return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'));
    });
    for (const l of codeLines) {
      assert.ok(!/runChain|composeWorkflow|explore/i.test(l),
        'no chain invocation in qualify-opportunity.cjs code line: ' + l.trim());
    }
  } finally {
    closeRoomDb(db);
  }
});

// ---------------------------------------------------------------------------
// Test 5: formatRubricLines -- the compressed Q1..Q8 WHY (Part 12 pedagogy)
// ---------------------------------------------------------------------------

check('Test 5 -- formatRubricLines compresses the q1..q8 verdict bag into <= 8 short lines naming passed/failed checks', () => {
  const mixed = { q1: 1, q2: 1, q3: 0, q4: 1, q5: 1, q6: 1, q7: 0, q8: 1 };
  const lines = formatRubricLines(mixed);
  assert.ok(Array.isArray(lines), 'returns an array of lines');
  assert.ok(lines.length >= 1 && lines.length <= 8, '<= 8 lines (got ' + lines.length + ')');
  const joined = lines.join('\n');
  assert.ok(/surprise/i.test(joined), 'names the failed Q3 surprise check');
  assert.ok(/newness/i.test(joined), 'names the failed Q7 newness check');
  assert.ok(/connection/i.test(joined), 'names the passed Q2 connection check');
  assert.ok(/fail/i.test(joined), 'verdict language present (fail)');
  assert.ok(/pass/i.test(joined), 'verdict language present (pass)');
  for (const l of lines) {
    assert.ok(l.length <= 120, 'line stays short: ' + l);
  }
  // All-pass bag still yields at least one verdict line.
  const allPass = formatRubricLines({ q1: 1, q2: 1, q3: 1, q4: 1, q5: 1, q6: 1, q7: 1, q8: 1 });
  assert.ok(allPass.length >= 1 && allPass.length <= 8, 'all-pass bag renders 1..8 lines');
  // Defensive: garbage in -> empty array, never a throw.
  assert.deepEqual(formatRubricLines(null), [], 'null rubric degrades to []');
});

// ---------------------------------------------------------------------------
// Test 6: formatComponentLines -- D-18 machine readiness, honest unknown
// ---------------------------------------------------------------------------

check('Test 6 -- formatComponentLines renders D-18 components + harvest_index; typed unknown renders verbatim, NEVER 0; index line carries version + EXPERIMENTAL', () => {
  const cand = makeCandidate({ bridgeA: 'a', bridgeB: 'b' }, {
    components: {
      critic_gate: 'pass',
      compression_score: 0.62,
      portfolio_score: { strategic_fit: 0.5, validated_demand: 0.4, feasibility: 0.7 },
      tail_flag: true,
      evidence_readiness: 'unknown',
      follow_through_readiness: 'unknown',
    },
  });
  const lines = formatComponentLines(cand.components, cand.harvest_index);
  assert.ok(Array.isArray(lines) && lines.length >= 1, 'returns lines');
  const joined = lines.join('\n');
  assert.ok(/critic/i.test(joined), 'critic_gate line present');
  assert.ok(joined.indexOf('0.62') !== -1, 'compression score rendered');
  assert.ok(/unknown/.test(joined), "typed 'unknown' renders verbatim");
  const evidenceLine = lines.find((l) => /evidence/i.test(l));
  assert.ok(evidenceLine, 'evidence_readiness line present');
  assert.ok(evidenceLine.indexOf('unknown') !== -1, "evidence_readiness 'unknown' renders as unknown");
  assert.ok(!/evidence[^\n]*:\s*0(\.0+)?\s*$/i.test(evidenceLine), "an unknown NEVER renders as 0");
  const followLine = lines.find((l) => /follow/i.test(l));
  assert.ok(followLine && followLine.indexOf('unknown') !== -1, "follow_through_readiness 'unknown' verbatim");
  const indexLine = lines.find((l) => l.indexOf('HarvestIndex_v1') !== -1);
  assert.ok(indexLine, 'index line names HarvestIndex_v1');
  assert.ok(indexLine.indexOf('EXPERIMENTAL') !== -1, 'index line carries EXPERIMENTAL status');
  // Defensive.
  assert.deepEqual(formatComponentLines(null, null), [], 'null components degrade to []');
});

// ---------------------------------------------------------------------------
// Test 7 (D-20): the OFFERED LLM-manual fallback -- never default, never silent
// ---------------------------------------------------------------------------

check('Test 7 -- D-20: [LLM manual scan (high effort)] is OFFERED only under MINDRIAN_FORCE_ENGINE_ABSENT=1; manual results carry engine_mode llm_manual_baseline end-to-end; nothing scores silently', () => {
  const room = freshRoom('d20');
  const db = openRoomDb(room.roomDir, { allowExtension: true });
  try {
    const cand = makeCandidate(room.ids, { candidate_id: 'cand-d20-0001', name: 'Manual baseline candidate' });
    const gateFile = path.join(room.roomDir, '.mindrian', 'test-card-fire-reached.json');

    // (a) Default path: NO offer verb.
    delete process.env.MINDRIAN_FORCE_ENGINE_ABSENT;
    const normal = renderQualificationCard(cand, null, { gateFilePath: gateFile });
    assert.equal(normal.ok, true);
    assert.ok(normal.rendered.contract.verbs.indexOf(OFFER_VERB) === -1,
      'offer verb NEVER appears on the default (engine) path');

    // (b) Forced engine-absent seam: the offer verb appears at the gate.
    process.env.MINDRIAN_FORCE_ENGINE_ABSENT = '1';
    let offered;
    try {
      offered = renderQualificationCard(cand, null, { gateFilePath: gateFile });
    } finally {
      delete process.env.MINDRIAN_FORCE_ENGINE_ABSENT;
    }
    assert.equal(offered.ok, true);
    assert.ok(offered.rendered.contract.verbs.indexOf(OFFER_VERB) !== -1,
      'offer verb OFFERED under MINDRIAN_FORCE_ENGINE_ABSENT=1');
    assert.ok(offered.rendered.zones.body.indexOf(OFFER_VERB) !== -1,
      'offer verb rendered as a card row');
    // The 5 chooser verbs all survive alongside the offer (secondary-row
    // convention, outside the cap, before Free-Text).
    for (const v of CARD_VERBS) {
      assert.ok(offered.rendered.contract.verbs.indexOf(v) !== -1,
        'chooser verb survives the offer append: ' + v);
    }
    const verbs = offered.rendered.contract.verbs;
    assert.equal(verbs[verbs.length - 1], 'Free-Text', 'Free-Text stays last (renderer invariant)');

    // (c) Nothing scored/minted/banked by the OFFER alone (never silent).
    const oppCount = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'opportunity'").get().n;
    assert.equal(oppCount, 0, 'rendering the offer mints nothing');
    assert.equal(bankFiles(room.roomDir).length, 0, 'rendering the offer banks nothing');

    // (d) A manual-mode candidate (offer ACCEPTED, model scored by the same
    // rubric) carries engine_mode llm_manual_baseline in node props AND bank
    // frontmatter (excluded from calibration sets downstream by this marker).
    const manual = makeCandidate(room.ids, {
      candidate_id: 'cand-d20-manual',
      name: 'Manual baseline candidate',
      engine_mode: 'llm_manual_baseline',
    });
    const q = qualifyCandidate(db, room.roomDir, manual, 'navigator');
    assert.equal(q.ok, true, 'manual-mode qualify ok: ' + JSON.stringify(q));
    const props = propsOf(db, q.node_id);
    assert.equal(props.engine_mode, 'llm_manual_baseline', 'node props carry engine_mode llm_manual_baseline');
    const files = bankFiles(room.roomDir);
    assert.equal(files.length, 1, 'manual qualify files one bank entry');
    const content = fs.readFileSync(path.join(room.roomDir, 'opportunity-bank', files[0]), 'utf8');
    assert.ok(content.indexOf('llm_manual_baseline') !== -1,
      'bank entry frontmatter carries engine_mode llm_manual_baseline');
  } finally {
    closeRoomDb(db);
  }
});

// ---------------------------------------------------------------------------
// Verb stubs: rephrase / suggestNext / askBrain (no writes, never throw)
// ---------------------------------------------------------------------------

check('Stubs -- suggestNext returns the next-ranked candidate handle; askBrain degrades gracefully with generic handles only (Part 8)', () => {
  const a = makeCandidate({ bridgeA: 'x', bridgeB: 'y' }, { candidate_id: 'c-a', score: 0.9 });
  const b = makeCandidate({ bridgeA: 'x', bridgeB: 'y' }, { candidate_id: 'c-b', score: 0.7 });
  const c = makeCandidate({ bridgeA: 'x', bridgeB: 'y' }, { candidate_id: 'c-c', score: 0.5 });
  const next = suggestNext([c, a, b], 'c-a');
  assert.equal(next.ok, true);
  assert.equal(next.next_candidate_id, 'c-b', 'next-ranked candidate handle after the current one');
  const tail = suggestNext([a, b], 'c-b');
  assert.equal(tail.ok, true);
  assert.equal(tail.next_candidate_id, null, 'no next candidate degrades to null, never throws');

  const brain = askBrain(a);
  assert.equal(brain.ok, true, 'askBrain never throws');
  const bag = JSON.stringify(brain.handles || {});
  assert.ok(bag.indexOf('Vantorix') === -1 && bag.indexOf(a.name) === -1,
    'Part 8: no candidate prose in the Brain handle bag');
  assert.ok(typeof brain.note === 'string' && brain.note.length > 0,
    'graceful degrade note present when Brain is absent (recommend, never trigger)');
});

// ---------------------------------------------------------------------------
// Task 2: F.1 render wiring assertions (SEED-021, D-09, reached-gate audit)
// ---------------------------------------------------------------------------

check('Render -- REQ-3 acceptance: the card fires as a real F.1 AskUserQuestion contract (trailer + 5 verbs + WHY lines), no ASCII box (SEED-021); reached-gate recorded', () => {
  const room = freshRoom('render');
  const gateFile = path.join(room.roomDir, '.mindrian', 'test-card-fire-reached.json');
  const cand = makeCandidate(room.ids, {
    candidate_id: 'cand-render-0001',
    name: 'Vantorix x Cryogenic Pump Array bridge',
    rubric: { q1: 1, q2: 1, q3: 1, q4: 0, q5: 1, q6: 1, q7: 1, q8: 1 },
  });
  const deref = (handle) => (handle ? 'Deref: ' + handle : null);
  const r = renderQualificationCard(cand, deref, { gateFilePath: gateFile, sessionId: 'test-render' });
  assert.equal(r.ok, true, 'render ok: ' + JSON.stringify(r && r.reason));
  const rendered = r.rendered;

  // The AskUserQuestion trailer (the SEED-021 single render door).
  assert.ok(typeof rendered.askuserquestion_marker === 'string'
    && rendered.askuserquestion_marker.indexOf('shape=F.1') !== -1,
    'byte-frozen AskUserQuestion marker present with shape=F.1');
  assert.ok(typeof rendered.askuserquestion_binding === 'string'
    && rendered.askuserquestion_binding.indexOf('FIRE-IF-FORK') !== -1,
    'self-decoding FIRE-IF-FORK imperative present');
  assert.ok(rendered.zones.footer.indexOf('[AskUserQuestion contract:') !== -1,
    'footer carries the trailer');

  // The 5-verb set (D-09, the Brain answer) + Free-Text last.
  for (const v of CARD_VERBS) {
    assert.ok(rendered.contract.verbs.indexOf(v) !== -1, 'verb present: ' + v);
    assert.ok(rendered.zones.body.indexOf(v) !== -1, 'verb rendered as a row: ' + v);
  }
  assert.equal(rendered.contract.verbs[rendered.contract.verbs.length - 1], 'Free-Text', 'Free-Text last');
  assert.equal(rendered.contract.shape, 'F.1', 'contract shape F.1');
  assert.equal(rendered.contract.keyboard, 'askuserquestion', 'canonical primitive');

  // WHY lines: at least one rubric verdict line + one D-18 component line.
  assert.ok(/timing/i.test(rendered.zones.body), 'rubric verdict line on the card (failed Q4 timing named)');
  assert.ok(rendered.zones.body.indexOf('HarvestIndex_v1') !== -1, 'D-18 component/index line on the card');

  // SEED-021: no box-drawing glyphs anywhere in the rendered card.
  assert.ok(!/[┌-╿]/.test(rendered.zones.header + rendered.zones.body + rendered.zones.footer),
    'no ASCII/Unicode box characters in the rendered card');

  // The reached-gate side-channel records the F.1 fire (T-219-16 audit trail).
  const store = JSON.parse(fs.readFileSync(gateFile, 'utf8'));
  const records = [].concat(...Object.values(store));
  const hit = records.find((rec) => rec.entry === 'commands/qualify-opportunity.md' && rec.shape === 'F.1');
  assert.ok(hit, 'recordReachedGate recorded the F.1 fire against the registry surface path');
});

check('Render -- the born-wired command surface declares hitl_shape F.1 + hitl_why (D-10, Part 11 CIRS)', () => {
  const cmdPath = path.join(REPO_ROOT, 'commands', 'qualify-opportunity.md');
  assert.ok(fs.existsSync(cmdPath), 'commands/qualify-opportunity.md exists');
  const content = fs.readFileSync(cmdPath, 'utf8');
  assert.ok(/hitl_shape:\s*"F\.1"/.test(content), 'hitl_shape "F.1" declared');
  assert.ok(/hitl_why:\s*"/.test(content), 'hitl_why declared');
  assert.ok(content.indexOf('<!-- mos:firing-block v2 -->') !== -1, 'firing-block stamped (wired)');
  assert.ok(content.indexOf('AskUserQuestion') !== -1, 'AskUserQuestion granted/mentioned');
  assert.ok(/sensor_triggers:\s*\[SENS-14\]/.test(content), 'SENS-14 dispatch wiring declared');
  assert.ok(/sub_mode:\s*qualify-opportunity/.test(content), 'dispatch slug qualify-opportunity resolves (Plan 03 reachability proof)');
});

// ---------------------------------------------------------------------------

console.log('');
console.log(pass + '/' + total + ' passed');
if (pass !== total) process.exit(1);
