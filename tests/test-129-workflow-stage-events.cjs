'use strict';
// Phase 129-04 -- workflow_stage event emission suite (RED-first).
//
// Covers Task 1 (/mos:act --chain emits workflow_stage entered + completed with
// framework + autonomy scalars, FOLLOWS_FROM linking entered -> completed) and
// Task 2 (/mos:pipeline emits a workflow_stage entered/completed pair per stage,
// FOLLOWS_FROM chaining across stages). Hermetic via tmpdir per fixture; uses the
// canonical openRoomDb chokepoint so every memory_event lands in the Phase-109
// provenance schema. Both scripts reach room.db ONLY through navigation.cjs.
//
// Canon Part 8 / Part 9: all room.db access is through navigation surfaces.
// NO em-dashes in this file (CLAUDE.md HARD RULE).

const { ok, equal } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const memoryEvents = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'memory-events.cjs'));
const actCmd = require(path.join(REPO_ROOT, 'scripts', 'act-command.cjs'));
const pipelineCmd = require(path.join(REPO_ROOT, 'scripts', 'pipeline-command.cjs'));
const recommender = require(path.join(REPO_ROOT, 'lib', 'brain', 'chain-recommender.cjs'));
const resolver = require(path.join(REPO_ROOT, 'lib', 'workflow', 'command-resolver.cjs'));

// Resolve the same chain the scripts' main() resolves for a problemType seed,
// without triggering main()'s process.exit. Mirrors the scripts' seed logic.
function resolveActPlan(problemType) {
  const frameworkChain = recommender.recommendFrameworkChain({ problemType });
  const workflow = resolver.composeWorkflow(frameworkChain);
  const autonomyReport = resolver.validateChainAutonomy(workflow);
  const plan = actCmd.planChainRun(workflow, autonomyReport);
  return { workflow, autonomyReport, plan };
}
function resolvePipelineWorkflow(problemType) {
  const frameworkChain = recommender.recommendFrameworkChain({ problemType });
  return resolver.composeWorkflow(frameworkChain);
}

// Seed a temp room with a real .mindrian/room.db plus a STATE.md so resolveRoomDir
// accepts it. Returns { tmp } -- the room directory the scripts take via --room.
function makeRoom(problemType) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-129-04-'));
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  // open + close once so the schema is materialized on disk.
  const db = openRoomDb(tmp);
  closeRoomDb(db);
  const pt = (typeof problemType === 'string' && problemType.length > 0) ? problemType : 'ill-defined';
  fs.writeFileSync(path.join(tmp, 'STATE.md'), '---\nproblem_type: ' + pt + '\n---\n# room\n', 'utf8');
  return { tmp };
}

function cleanup(tmp) {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

// Read all workflow_stage events for a surface, oldest-first.
function readStages(tmp, surface) {
  const db = openRoomDb(tmp);
  try {
    const recent = memoryEvents.findRecentChanges(db, 0, { eventType: 'workflow_stage' });
    const rows = (recent || []).map((r) => ({
      id: r.id || r.eventId || null,
      props: r.properties || {},
      createdAt: r.createdAt,
    })).filter((r) => (r.props.surface === surface));
    // findRecentChanges returns most-recent-first; reverse to chronological.
    return rows.slice().reverse();
  } finally {
    closeRoomDb(db);
  }
}

// Count FOLLOWS_FROM edges in the room graph.
function followsFromEdges(tmp) {
  const db = openRoomDb(tmp);
  try {
    return db.prepare("SELECT source, target FROM edges WHERE type = 'FOLLOWS_FROM'").all();
  } finally {
    closeRoomDb(db);
  }
}

const results = [];
function test(name, fn) {
  try { fn(); results.push({ name, ok: true }); }
  catch (e) { results.push({ name, ok: false, err: e && e.message ? e.message : String(e) }); }
}

// ---------------------------------------------------------------------------
// Task 1 -- /mos:act --chain workflow_stage entered + completed.
// ---------------------------------------------------------------------------

test('act: emitWorkflowStages is exported', () => {
  ok(typeof actCmd.emitWorkflowStages === 'function', 'act-command must export emitWorkflowStages');
});

test('act --chain emits an entered + completed workflow_stage with framework + autonomy', () => {
  const { tmp } = makeRoom('ill-defined');
  try {
    const { workflow, autonomyReport, plan } = resolveActPlan('ill-defined');
    actCmd.emitWorkflowStages(tmp, workflow, plan, autonomyReport);
    const stages = readStages(tmp, 'act');
    const entered = stages.filter((s) => s.props.phase === 'entered');
    const completed = stages.filter((s) => s.props.phase === 'completed');
    ok(entered.length >= 1, 'at least one entered event: got ' + entered.length);
    ok(completed.length >= 1, 'at least one completed event: got ' + completed.length);
    // The entered event carries framework + autonomy scalars.
    const e0 = entered[0];
    ok(typeof e0.props.framework === 'string' && e0.props.framework.length > 0, 'entered carries framework');
    ok('autonomy' in e0.props, 'entered carries autonomy scalar');
  } finally { cleanup(tmp); }
});

test('act --chain links entered -> completed with a FOLLOWS_FROM edge', () => {
  const { tmp } = makeRoom('ill-defined');
  try {
    const { workflow, autonomyReport, plan } = resolveActPlan('ill-defined');
    actCmd.emitWorkflowStages(tmp, workflow, plan, autonomyReport);
    const edges = followsFromEdges(tmp);
    ok(edges.length >= 1, 'at least one FOLLOWS_FROM edge landed: got ' + edges.length);
  } finally { cleanup(tmp); }
});

test('act emitWorkflowStages: gated step gets entered but NOT completed', () => {
  const { tmp } = makeRoom('ill-defined');
  try {
    // Synthetic 2-step workflow where step 2 is gated (not autonomous_safe).
    const workflow = [
      { step: 1, command: '/mos:beautiful-question', framework: 'Beautiful Question Framework' },
      { step: 2, command: '/mos:hat-briefing', framework: 'Six Thinking Hats' },
    ];
    const autonomyReport = { runnable: false, blockers: [{ step: 2 }] };
    const plan = actCmd.planChainRun(workflow, autonomyReport);
    actCmd.emitWorkflowStages(tmp, workflow, plan, autonomyReport);
    const stages = readStages(tmp, 'act');
    // Step 1 (greenlit) gets entered + completed; step 2 (gated) gets entered, no completed.
    const step1Completed = stages.filter((s) => s.props.phase === 'completed' && s.props.stage_step === 1);
    const step2Completed = stages.filter((s) => s.props.phase === 'completed' && s.props.stage_step === 2);
    ok(step1Completed.length >= 1, 'greenlit step 1 has a completed event');
    equal(step2Completed.length, 0, 'gated step 2 has NO completed event');
  } finally { cleanup(tmp); }
});

test('act --chain: no room.db means no throw and the gate still renders', () => {
  // A directory with STATE.md but NO .mindrian/room.db -- emission degrades to no-op.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-129-04-nodb-'));
  try {
    fs.writeFileSync(path.join(tmp, 'STATE.md'), '---\nproblem_type: ill-defined\n---\n', 'utf8');
    // resolveRoomDir accepts STATE.md dirs; emission must no-op without room.db.
    let threw = false;
    try { actCmd.emitWorkflowStages(tmp, [{ step: 1, command: '/mos:beautiful-question', framework: 'X' }], { wouldRun: [{ step: 1 }], stopAt: null }, { runnable: true, blockers: [] }); }
    catch (_e) { threw = true; }
    ok(!threw, 'emitWorkflowStages never throws without room.db');
  } finally { cleanup(tmp); }
});

// ---------------------------------------------------------------------------
// Task 2 -- /mos:pipeline workflow_stage per stage + cross-stage FOLLOWS_FROM.
// ---------------------------------------------------------------------------

test('pipeline: emitWorkflowStages is exported', () => {
  ok(typeof pipelineCmd.emitWorkflowStages === 'function', 'pipeline-command must export emitWorkflowStages');
});

test('pipeline --from-problem-type emits an entered + completed per stage', () => {
  const { tmp } = makeRoom('ill-defined');
  try {
    const workflow = resolvePipelineWorkflow('ill-defined');
    pipelineCmd.emitWorkflowStages(tmp, workflow);
    const stages = readStages(tmp, 'pipeline');
    const entered = stages.filter((s) => s.props.phase === 'entered');
    const completed = stages.filter((s) => s.props.phase === 'completed');
    ok(entered.length >= 1, 'at least one entered event');
    ok(completed.length >= 1, 'at least one completed event');
    ok(typeof entered[0].props.stage === 'string' && entered[0].props.stage.length > 0, 'entered names its stage');
  } finally { cleanup(tmp); }
});

test('pipeline emitWorkflowStages: stage N+1 entered FOLLOWS_FROM stage N completed', () => {
  const { tmp } = makeRoom('ill-defined');
  try {
    // Synthetic 3-stage workflow so the cross-stage chain is exercised.
    const workflow = [
      { step: 1, command: '/mos:beautiful-question', framework: 'Beautiful Question Framework' },
      { step: 2, command: '/mos:think-hats', framework: 'Six Thinking Hats' },
      { step: 3, command: '/mos:compare-ventures', framework: 'Venture Comparison' },
    ];
    pipelineCmd.emitWorkflowStages(tmp, workflow);
    const stages = readStages(tmp, 'pipeline');
    const entered = stages.filter((s) => s.props.phase === 'entered');
    const completed = stages.filter((s) => s.props.phase === 'completed');
    equal(entered.length, 3, '3 entered events');
    equal(completed.length, 3, '3 completed events');
    // Each stage: entered FOLLOWS_FROM its own... no, completed FOLLOWS_FROM its entered,
    // and stage N+1 entered FOLLOWS_FROM stage N completed. 3 stages => at least
    // 3 within-stage + 2 cross-stage = 5 FOLLOWS_FROM edges.
    const edges = followsFromEdges(tmp);
    ok(edges.length >= 5, 'at least 5 FOLLOWS_FROM edges (within + cross stage): got ' + edges.length);
  } finally { cleanup(tmp); }
});

test('pipeline emitWorkflowStages: a command-less stage does not throw', () => {
  const { tmp } = makeRoom('ill-defined');
  try {
    const workflow = [
      { step: 1, command: '/mos:beautiful-question', framework: 'Beautiful Question Framework' },
      { step: 2, command: null, framework: 'SWOT' },
      { step: 3, command: '/mos:compare-ventures', framework: 'Venture Comparison' },
    ];
    let threw = false;
    try { pipelineCmd.emitWorkflowStages(tmp, workflow); } catch (_e) { threw = true; }
    ok(!threw, 'command-less stage tolerated, no throw');
    // The two real stages still emit an entered/completed pair each.
    const stages = readStages(tmp, 'pipeline');
    const completed = stages.filter((s) => s.props.phase === 'completed');
    ok(completed.length >= 2, 'the 2 commandful stages emit completed: got ' + completed.length);
  } finally { cleanup(tmp); }
});

// ---------------------------------------------------------------------------
// Substrate guard -- both scripts route through navigation.cjs only.
// ---------------------------------------------------------------------------

test('substrate: act-command + pipeline-command scanFiles returns []', () => {
  const guard = require(path.join(REPO_ROOT, 'scripts', 'check-substrate.cjs'));
  const v = guard.scanFiles(
    ['scripts/act-command.cjs', 'scripts/pipeline-command.cjs'],
    (p) => fs.readFileSync(path.join(REPO_ROOT, p), 'utf8'),
  );
  equal(v.length, 0, 'no substrate violations: ' + JSON.stringify(v));
});

// ---------------------------------------------------------------------------
// Report.
// ---------------------------------------------------------------------------

let failed = 0;
for (const r of results) {
  if (r.ok) { console.log('  ok   ' + r.name); }
  else { failed += 1; console.log('  FAIL ' + r.name + '  --  ' + r.err); }
}
console.log('\n' + (results.length - failed) + '/' + results.length + ' passing');
if (failed > 0) process.exit(1);
