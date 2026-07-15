'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 223-02 -- close-the-loop graph-write proof (Req 4).
 * ========================================================
 * SECTION A (Task 1, behaviors 1-4): the navigation additions.
 *   1. writeOpenQuestionNode lands a type='open_question' row, review_status
 *      'proposed', properties carrying the question; re-writing UPSERTs (no
 *      duplicate) and NEVER downgrades review_status on conflict.
 *   2. insights.findOpenQuestions (via navigation) returns that node -- writer
 *      and shipped reader agree on the 'open_question' type string.
 *   3. writeClaimNode's optional extraProps bag persists additive keys, filters
 *      protected-key overrides, and is byte-identical to today when absent.
 *   4. the byUser gate (Part 9): an agent/system-attributed confirm of a claim
 *      this plan writes is REJECTED; only a human byUser promotes.
 *
 * SECTION B (Task 2, behaviors 1-7): the close-loop-writer spine.
 *   1. full payload lands claims + conclusion + knowns/SUPPORTS + open_questions
 *      + opportunity + REJECTED_BECAUSE, ALL nodes proposed, ALL semantic edges
 *      proposed (D-02).
 *   2. D-01 dual write: bank .md carries the six reader fields + shared
 *      artifact_id; the room.db opportunity node carries the SAME artifact_id.
 *   3. crash ordering: an injected node-writer that throws AFTER the .md write
 *      leaves the .md on disk and NO opportunity node (partial-write disclosed).
 *   4. G-3 both stores: compute-opportunity-state surfaces the written-through
 *      opportunity in the bank rollup.
 *   5. an invalid conclusion is rejected by validateNarrative before any write.
 *   6. every claim carries the G-1 provenance pipeline marker.
 *   7. a relation with an out-of-allow-list edge type is rejected pre-writeEdge.
 *
 * FIXTURE CHOICE: this leg builds throwaway rooms with buildFixtureRoom224 (the
 * Wave-1 sibling Plan 01 fixture-223 helper is NOT a dependency of this plan --
 * the 224 base suffices for pure room.db legs, and Section B's bank legs create
 * the opportunity-bank dir on demand). Deterministic, hermetic, no network, no
 * model download.
 *
 * PASS line + non-zero exit on failure. NO em-dashes (CLAUDE.md HARD RULE).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const { buildFixtureRoom224 } = require(path.join(REPO_ROOT, 'tests', 'helpers', 'fixture-room-224.cjs'));
const closeLoop = require(path.join(REPO_ROOT, 'lib', 'core', 'close-loop-writer.cjs'));
const opportunityOps = require(path.join(REPO_ROOT, 'lib', 'core', 'opportunity-ops.cjs'));

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) { passed += 1; console.log('  ok - ' + name); } else { failed += 1; console.log('  NOT OK - ' + name); }
}

function mkTmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function selectNode(db, id) {
  return db.prepare('SELECT id, type, properties, review_status FROM nodes WHERE id = ?').get(id);
}

// ===========================================================================
// SECTION A -- navigation additions (Task 1).
// ===========================================================================
async function sectionA() {
  console.log('--- Section A: navigation additions (open_question writer + claim extraProps + byUser gate) ---');
  const tmp = mkTmp('c223a-');
  const fx = await buildFixtureRoom224(tmp, { artifactCount: 3 });
  const db = openRoomDb(fx.roomDir);
  try {
    // Behavior 1: writeOpenQuestionNode + UPSERT + no review_status downgrade.
    const q = 'How do we validate the retention assumption before scaling?';
    const w1 = navigation.writeOpenQuestionNode(db, { question: q, sessionId: 's1', source: 'bono' });
    check('1a writeOpenQuestionNode ok', w1.ok === true && typeof w1.node_id === 'string');
    const row1 = selectNode(db, w1.node_id);
    check('1b node type open_question', row1 && row1.type === 'open_question');
    check('1c review_status proposed', row1 && row1.review_status === 'proposed');
    check('1d properties carry the question', row1 && JSON.parse(row1.properties).question === q);

    const conf = navigation.confirmNode(db, w1.node_id, 'navigator');
    check('1e human confirm promotes', conf.ok === true);
    const w1again = navigation.writeOpenQuestionNode(db, { question: q, sessionId: 's1', source: 'bono', extraProps: { revisit: true } });
    check('1f re-write ok (same id)', w1again.ok === true && w1again.node_id === w1.node_id);
    const rowAfter = selectNode(db, w1.node_id);
    check('1g no downgrade on conflict (stays confirmed)', rowAfter.review_status === 'confirmed');
    check('1h properties updated on conflict (extraProps merged)', JSON.parse(rowAfter.properties).revisit === true);
    const dupCount = db.prepare("SELECT COUNT(*) AS c FROM nodes WHERE type = 'open_question'").get().c;
    check('1i exactly one open_question row (UPSERT)', dupCount === 1);

    // Behavior 2: the shipped reader agrees on the type string.
    const open = navigation.findOpenQuestions(db, 'fixture-224');
    check('2a findOpenQuestions returns the written node', open.some((o) => o.question && o.question.id === w1.node_id));

    // Behavior 3: writeClaimNode extraProps -- persist, protect, byte-identical.
    const c3 = navigation.writeClaimNode(db, {
      knowledge_type: 'fact', text: 'The pilot cohort renewed at 82 percent.', sessionId: 's1',
      sourceSegment: 'seg-3a', extraProps: { kind: 'conclusion', topic_hash: 'abc', pipeline: 'bono-v2' },
    });
    check('3a claim with extraProps ok', c3.ok === true);
    const p3 = JSON.parse(selectNode(db, c3.node_id).properties);
    check('3b extraProps kind persisted', p3.kind === 'conclusion');
    check('3c extraProps topic_hash persisted', p3.topic_hash === 'abc');
    check('3d extraProps pipeline persisted', p3.pipeline === 'bono-v2');

    const c3b = navigation.writeClaimNode(db, {
      knowledge_type: 'fact', text: 'Real claim text.', sessionId: 's1', sourceSegment: 'seg-3b',
      extraProps: { knowledge_type: 'assumption', text: 'HACKED', pipeline: 'ok-field' },
    });
    const p3b = JSON.parse(selectNode(db, c3b.node_id).properties);
    check('3e protected knowledge_type not overridden', p3b.knowledge_type === 'fact');
    check('3f protected text not overridden', p3b.text === 'Real claim text.');
    check('3g non-protected extraProps still merges', p3b.pipeline === 'ok-field');

    const cWith = navigation.writeClaimNode(db, { knowledge_type: 'heuristic', text: 'Ship weekly.', sessionId: 's1', sourceSegment: 'seg-3shared', extraProps: { pipeline: 'x' } });
    const cWithout = navigation.writeClaimNode(db, { knowledge_type: 'heuristic', text: 'Ship weekly.', sessionId: 's2', sourceSegment: 'seg-3shared' });
    const pWith = JSON.parse(selectNode(db, cWith.node_id).properties);
    const pWithout = JSON.parse(selectNode(db, cWithout.node_id).properties);
    delete pWith.pipeline;
    check('3h props byte-identical when extraProps absent', JSON.stringify(pWith) === JSON.stringify(pWithout));

    // Behavior 4: the byUser gate on a claim this plan writes (Part 9).
    const c4 = navigation.writeClaimNode(db, { knowledge_type: 'fact', text: 'A gate-test claim.', sessionId: 's1', sourceSegment: 'seg-4' });
    const badConfirm = navigation.confirmNode(db, c4.node_id, 'system');
    check('4a agent/system-attributed confirm rejected', badConfirm.ok === false && badConfirm.reason === 'agent_attribution_forbidden');
    const goodConfirm = navigation.confirmNode(db, c4.node_id, 'navigator');
    check('4b human byUser confirm promotes', goodConfirm.ok === true);
    check('4c node now confirmed', selectNode(db, c4.node_id).review_status === 'confirmed');
  } finally {
    closeRoomDb(db);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ===========================================================================
// SECTION B -- close-loop-writer spine (Task 2).
// ===========================================================================
function mkPayload(overrides) {
  const base = {
    surface: 'bono',
    run_id: 'run-A',
    conclusion: {
      governing_thought: 'The wedge is corporate wellness subsidies that lower CAC below the six-month margin.',
      key_claims: [
        'Corporate programs subsidize the first two months.',
        'Referral loops keep paid acquisition near zero.',
        'Menu personalization cuts the churn that kills meal-kit LTV.',
      ],
      topic: 'meal-kit-go-to-market',
    },
    claims: [
      { text: 'Urban professionals will pay a flat monthly fee for time saved.', knowledge_type: 'fact' },
      { text: 'Rigidity of a fixed weekly cadence is the top churn driver.', knowledge_type: 'causal' },
    ],
    knowns: [
      { text: 'CAC must stay below the six-month contribution margin.', knowledge_type: 'fact' },
    ],
    unknowns: [
      'What is the real week-8 retention curve for the wellness cohort?',
    ],
    killed: [
      { text: 'Paid social is the primary growth channel.', reason: 'cac_too_high' },
    ],
    relations: [],
    opportunities: [
      {
        name: 'Corporate Wellness Subsidy Pilot',
        problem: 'Employers want measurable wellness outcomes but lack a healthy-cooking benefit.',
        funder: 'Acme Wellness Fund',
        program: 'Employee Nutrition Pilot',
        deadline: '2026-12-01',
        relevance_score: 0.82,
      },
    ],
  };
  return Object.assign(base, overrides || {});
}

async function sectionB() {
  console.log('--- Section B: close-loop-writer spine (D-01 / D-02 / D-04 / G-1 / G-3) ---');

  // Behavior 1 + 2 + 6.
  {
    const tmp = mkTmp('c223b1-');
    const fx = await buildFixtureRoom224(tmp, { artifactCount: 3 });
    const db = openRoomDb(fx.roomDir);
    try {
      const res = closeLoop.writeCloseLoop(db, fx.roomDir, mkPayload(), { surface: 'bono', run_id: 'run-A' });
      check('B1a writeCloseLoop ok', res && res.ok === true);
      check('B1b conclusion node minted', typeof res.conclusion_id === 'string' && res.conclusion_id.length > 0);

      const proposedNodes = db.prepare("SELECT COUNT(*) AS c FROM nodes WHERE type IN ('claim','opportunity','open_question') AND review_status <> 'proposed'").get().c;
      check('B1c every claim/opportunity/open_question node is proposed', proposedNodes === 0);

      check('B1d conclusion carries kind marker', JSON.parse(selectNode(db, res.conclusion_id).properties).kind === 'conclusion');
      const oqCount = db.prepare("SELECT COUNT(*) AS c FROM nodes WHERE type = 'open_question'").get().c;
      check('B1e one open_question per unknown', oqCount === 1);
      const oppCount = db.prepare("SELECT COUNT(*) AS c FROM nodes WHERE type = 'opportunity'").get().c;
      check('B1f one opportunity node', oppCount === 1);

      const semantic = "type IN ('SUPPORTS','CONTRADICTS','CONVERGES','INFORMS','REJECTED_BECAUSE')";
      const edgesTotal = db.prepare('SELECT COUNT(*) AS c FROM edges WHERE ' + semantic).get().c;
      const edgesProposed = db.prepare('SELECT COUNT(*) AS c FROM edges WHERE ' + semantic + " AND review_status = 'proposed'").get().c;
      check('B1g at least one semantic edge written', edgesTotal >= 1);
      check('B1h every semantic edge is proposed (D-02)', edgesTotal === edgesProposed);
      const rej = db.prepare("SELECT COUNT(*) AS c FROM edges WHERE type = 'REJECTED_BECAUSE'").get().c;
      check('B1i one REJECTED_BECAUSE per killed claim', rej === 1);

      const claimRows = db.prepare("SELECT properties FROM nodes WHERE type = 'claim'").all();
      const allTagged = claimRows.every((r) => JSON.parse(r.properties).pipeline === 'bono');
      check('B6 every claim carries G-1 provenance pipeline marker', claimRows.length > 0 && allTagged);

      check('B2a summary lists opportunity md_path + artifact_id + node_id', Array.isArray(res.opportunity) && res.opportunity.length === 1
        && typeof res.opportunity[0].artifact_id === 'string' && typeof res.opportunity[0].md_path === 'string' && typeof res.opportunity[0].node_id === 'string');
      const mdBody = fs.readFileSync(res.opportunity[0].md_path, 'utf8');
      check('B2b bank .md carries the shared artifact_id', mdBody.indexOf(res.opportunity[0].artifact_id) !== -1);
      check('B2c bank .md carries the six reader fields', /funder:/.test(mdBody) && /program:/.test(mdBody) && /deadline:/.test(mdBody) && /relevance_score:/.test(mdBody) && /status:/.test(mdBody) && /created:/.test(mdBody));
      const oppProps = JSON.parse(db.prepare("SELECT properties FROM nodes WHERE type = 'opportunity'").get().properties);
      check('B2d room.db opportunity node carries the SAME artifact_id', oppProps.artifact_id === res.opportunity[0].artifact_id);
    } finally {
      closeRoomDb(db);
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }

  // Behavior 3: crash ordering.
  {
    const tmp = mkTmp('c223b3-');
    const fx = await buildFixtureRoom224(tmp, { artifactCount: 3 });
    const db = openRoomDb(fx.roomDir);
    try {
      const throwingOppWriter = () => { throw new Error('injected node-writer crash after md write'); };
      const res = closeLoop.writeCloseLoop(db, fx.roomDir, mkPayload({ conclusion: null, claims: [], knowns: [], unknowns: [], killed: [] }), {
        surface: 'bono', run_id: 'run-crash', nodeWriters: { opportunity: throwingOppWriter },
      });
      const oppNodeCount = db.prepare("SELECT COUNT(*) AS c FROM nodes WHERE type = 'opportunity'").get().c;
      check('B3a NO dangling opportunity node after crash', oppNodeCount === 0);
      const bankFiles = fs.readdirSync(path.join(fx.roomDir, 'opportunity-bank')).filter((f) => f.endsWith('.md') && f !== 'STATE.md');
      check('B3b bank .md is on disk (bank-visible artifact)', bankFiles.length === 1);
      check('B3c partial-write disclosed, never swallowed', Array.isArray(res.failures) && res.failures.some((f) => /opportunity/.test(f.section)));
    } finally {
      closeRoomDb(db);
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }

  // Behavior 4 (G-3, both stores).
  {
    const tmp = mkTmp('c223b4-');
    const fx = await buildFixtureRoom224(tmp, { artifactCount: 3 });
    let db = openRoomDb(fx.roomDir);
    try {
      const res = closeLoop.writeCloseLoop(db, fx.roomDir, mkPayload(), { surface: 'bono', run_id: 'run-g3' });
      check('B4a writeCloseLoop ok', res.ok === true);
      closeRoomDb(db);
      db = null;
      const out = execFileSync('bash', [path.join(REPO_ROOT, 'scripts', 'compute-opportunity-state'), fx.roomDir], { encoding: 'utf8' });
      check('B4b bank rollup surfaces the written-through opportunity', /Acme Wellness Fund/.test(out) || /Employee Nutrition Pilot/.test(out));
      const listed = opportunityOps.listOpportunities(fx.roomDir);
      check('B4c reader lists the banked opportunity', listed.count >= 1 && listed.opportunities.some((o) => o.funder === 'Acme Wellness Fund'));
    } finally {
      if (db) closeRoomDb(db);
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }

  // Behavior 5: invalid conclusion.
  {
    const tmp = mkTmp('c223b5-');
    const fx = await buildFixtureRoom224(tmp, { artifactCount: 3 });
    const db = openRoomDb(fx.roomDir);
    try {
      const bad = mkPayload({
        opportunities: [], claims: [], knowns: [], unknowns: [], killed: [],
        conclusion: { governing_thought: 'x'.repeat(300), key_claims: ['only one'], topic: 'bad' },
      });
      const res = closeLoop.writeCloseLoop(db, fx.roomDir, bad, { surface: 'bono', run_id: 'run-bad' });
      const conclusionRows = db.prepare("SELECT COUNT(*) AS c FROM nodes WHERE type = 'claim'").get().c;
      check('B5a zero conclusion rows land on invalid payload', conclusionRows === 0);
      check('B5b conclusion rejection disclosed', res.conclusion_id === null && Array.isArray(res.failures) && res.failures.some((f) => /conclusion/.test(f.section)));
    } finally {
      closeRoomDb(db);
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }

  // Behavior 7: out-of-allow-list relation.
  {
    const tmp = mkTmp('c223b7-');
    const fx = await buildFixtureRoom224(tmp, { artifactCount: 3 });
    const db = openRoomDb(fx.roomDir);
    try {
      const p = mkPayload({
        opportunities: [], knowns: [], unknowns: [], killed: [], conclusion: null,
        claims: [
          { text: 'Claim source node.', knowledge_type: 'fact' },
          { text: 'Claim target node.', knowledge_type: 'fact' },
        ],
        relations: [{ source_index: 0, target_index: 1, edge_type: 'SUPERSEDES', reason: 'not allowed here' }],
      });
      const res = closeLoop.writeCloseLoop(db, fx.roomDir, p, { surface: 'bono', run_id: 'run-badedge' });
      const superCount = db.prepare("SELECT COUNT(*) AS c FROM edges WHERE type = 'SUPERSEDES'").get().c;
      check('B7a out-of-allow-list relation not written', superCount === 0);
      check('B7b bad edge type disclosed', Array.isArray(res.failures) && res.failures.some((f) => /relation/.test(f.section)));
    } finally {
      closeRoomDb(db);
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
}

(async function main() {
  try {
    await sectionA();
    await sectionB();
  } catch (e) {
    console.error('FATAL', e && e.stack ? e.stack : e);
    process.exit(1);
  }
  console.log('');
  console.log('test-223-close-loop: passed=' + passed + ' failed=' + failed);
  if (failed > 0) { process.exit(1); }
  console.log('PASS');
}());
