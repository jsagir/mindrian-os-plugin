#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 364 Plan 09 Task 1 -- end to end through the CLI door and the MCP
 * handler: the honest refusal on the measured all-NULL Theo state, a full
 * authored walk to a filed PLAN.md, the hypothesis-in-flight path of Plan 14,
 * CLI and MCP parity (SRM364-07, SRM364-09, NV-2, NR-2, Tri-Polar). layer: harness
 *
 *   X1  empty room: start routes to define_what with zero Theo calls
 *   X2  stated_goal room, all-null: entry first (proposed step 2), then the exact refusal
 *   X3  X2 wrote nothing (file listing and room.db hash identical)
 *   X4  authored fixture: entry_gate with seven labels in list order; a stamped
 *       finding in flight shows its stamp lines and the score never appears
 *   X5  the authored walk, every stage, the systems pass gate, question set, plan,
 *       basket, file (usage error without a selection, refusal when not approved,
 *       PLAN.md only on an approved selection); a stamped finding in flight refuses
 *       step 6 until it is addressed
 *   X6  a --state path outside the run folder or with a wrong name exits 2
 *   X7  unknown subcommand, missing --room and an oversized --input exit 2
 *   X8  parity: the MCP handler gives the same refusal text and the same proposed step
 *   X9  the shapes in commands/scientific-roadmap.md equal the STAGE_GATES shapes plus F.1 and F.9
 *   X10 zero network attempts in the parent and in every child log
 *
 * Hermetic: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME at mkdtemp dirs before any
 * repo module loads; CLI children run with --require tests/helpers/fake-brain-364.cjs.
 * Exit 77 when node:sqlite is missing. House rule: hyphens only, no emoji.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-364-e2e-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-364-e2e-rooms-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;

try { require('node:sqlite'); } catch (_e) {
  console.log('SKIP: node:sqlite is not available (ENV GAP)');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(REPO_ROOT, 'tests/helpers/hygiene-355.cjs'));
hygiene.scrubVendorKey();
const net = hygiene.installNetGuard();
const C = hygiene.makeChecker('test-364-refusal-e2e');

const CLI = path.join(REPO_ROOT, 'scripts', 'scientific-roadmap.cjs');
const PRELOAD = path.join(REPO_ROOT, 'tests', 'helpers', 'fake-brain-364.cjs');
const FIX = path.join(REPO_ROOT, 'tests', 'fixtures', '364-theo');
const DASH = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']');
const REFUSAL = 'Theo has not authored this step yet';

const fixtureDoor = require(path.join(REPO_ROOT, 'tests/helpers/fixture-door-364.cjs'));
const { buildEntryRoom, MARKER } = require(path.join(REPO_ROOT, 'tests/helpers/fixture-room-364.cjs'));
const { buildStampedRoom, SCORE } = require(path.join(REPO_ROOT, 'tests/helpers/fixture-stamped-364.cjs'));

const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-364-e2e-'));
const ROOMS = path.join(SCRATCH, 'rooms');
fs.mkdirSync(ROOMS, { recursive: true });
const WORK = path.join(SCRATCH, 'work');
fs.mkdirSync(WORK, { recursive: true });

const childLogs = [];
let seq = 0;

function fixturePath(name) { return path.join(FIX, name + '.json'); }

// One CLI child: sandboxed env, the fake brain preload, a per-call log.
function cli(args, stepFixture) {
  seq += 1;
  const cfg = path.join(WORK, 'fake-' + seq + '.json');
  const log = path.join(WORK, 'log-' + seq + '.json');
  fs.writeFileSync(cfg, JSON.stringify({
    framework_step: fixturePath(stepFixture || 'framework-step-all-null'),
    recommend_chain: fixturePath('recommend-chain-thin'),
  }));
  const r = spawnSync(process.execPath, ['--require', PRELOAD, CLI].concat(args), {
    cwd: WORK,
    env: Object.assign({}, process.env, { MOS_364_FAKE_BRAIN: cfg, MOS_364_FAKE_BRAIN_LOG: log }),
    encoding: 'utf8',
    timeout: 60000,
  });
  let json = null;
  try { json = JSON.parse(r.stdout); } catch (_e) { json = null; }
  let logged = null;
  try { logged = JSON.parse(fs.readFileSync(log, 'utf8')); } catch (_e) { logged = null; }
  childLogs.push(logged);
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '', json: json, log: logged || { calls: [], net_attempts: -1 } };
}

function firstCandidate(roomDir) {
  const j = cli(['entry', '--room', roomDir]).json;
  const c = j && j.entry && j.entry.what && Array.isArray(j.entry.what.candidates) ? j.entry.what.candidates[0] : null;
  return c ? c.id : null;
}

function writeJson(name, obj) {
  const f = path.join(WORK, name);
  fs.writeFileSync(f, typeof obj === 'string' ? obj : JSON.stringify(obj));
  return f;
}

function listing(dir) {
  const out = {};
  (function walk(d) {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (_e) { return; }
    entries.forEach(function (e) {
      const abs = path.join(d, e.name);
      // -shm and -wal are SQLite sidecars of a read-only open of a WAL database, not room content (the 364-08 M7 rule)
      if (e.isDirectory()) walk(abs); else if (!/room\.db-(shm|wal)$/.test(e.name)) out[path.relative(dir, abs)] = fs.statSync(abs).size;
    });
  })(dir);
  return out;
}
function dbSha(roomDir) {
  const f = path.join(roomDir, '.mindrian', 'room.db');
  return fs.existsSync(f) ? crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex') : null;
}
function sha(file) { return file && fs.existsSync(file) ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null; }

// The authored walk, one stage at a time, through the CLI.
function stageFile(stage, outcome) {
  return writeJson('outcome-' + (++seq) + '.json', Object.assign({ stage: stage }, outcome));
}

async function main() {
  const authored = 'framework-step-authored';
  const labels = fixtureDoor.runnableRows(authored).map(function (s) { return s.label; });

  // ---------------------------------------------------------------- X1
  const em = buildEntryRoom(ROOMS, 'empty');
  const x1 = cli(['start', '--room', em.roomDir], 'framework-step-all-null');
  C.check('X1 an empty room routes to define_what, exit 0',
    x1.status === 0 && x1.json && x1.json.ok === true && x1.json.next === 'define_what', x1.stdout.slice(0, 200) + x1.stderr.slice(0, 200));
  C.check('X1 the offers include /mos:analyze-needs',
    !!x1.json && Array.isArray(x1.json.entry && x1.json.entry.offers) && x1.json.entry.offers.indexOf('/mos:analyze-needs') !== -1
    && String(x1.json.card).indexOf('/mos:analyze-needs') !== -1);
  C.check('X1 zero Theo calls in the child log', x1.log.calls.length === 0, JSON.stringify(x1.log.calls));

  // ---------------------------------------------------------------- X2 and X3
  const sg = buildEntryRoom(ROOMS, 'stated_goal');
  const beforeList = JSON.stringify(listing(sg.roomDir));
  const beforeSha = dbSha(sg.roomDir);
  const x2 = cli(['start', '--room', sg.roomDir], 'framework-step-all-null');
  const j2 = x2.json || {};
  C.check('X2 the all-null state refuses after the entry check, exit 0',
    x2.status === 0 && j2.ok === true && j2.next === 'refused', x2.stdout.slice(0, 300) + x2.stderr.slice(0, 200));
  C.check('X2 the entry ran first (proposed step 2)', !!j2.entry && j2.entry.proposed_step === 2, JSON.stringify(j2.entry && j2.entry.proposed_step));
  C.check('X2 theo reason step_unauthored with the exact message',
    !!j2.theo && j2.theo.reason === 'step_unauthored' && j2.theo.message === REFUSAL, JSON.stringify(j2.theo));
  C.check('X2 the offer is /mos:research and the status block carries the refusal',
    j2.offer === '/mos:research' && String(j2.status).indexOf(REFUSAL) !== -1 && !!j2.coverage && j2.coverage.status === 'uncovered');
  C.check('X2 Theo was asked exactly twice (steps and coverage)', x2.log.calls.length === 2, JSON.stringify(x2.log.calls));
  C.check('X3 start wrote nothing: file listing and room.db hash identical',
    JSON.stringify(listing(sg.roomDir)) === beforeList && dbSha(sg.roomDir) === beforeSha);
  const entryOnly = cli(['entry', '--room', sg.roomDir], 'framework-step-all-null');
  C.check('X3 entry prints entry and card, writes nothing, calls no network or Theo',
    entryOnly.status === 0 && !!entryOnly.json && entryOnly.json.ok === true && !!entryOnly.json.entry && typeof entryOnly.json.card === 'string'
    && entryOnly.log.calls.length === 0 && JSON.stringify(listing(sg.roomDir)) === beforeList && dbSha(sg.roomDir) === beforeSha);

  // ---------------------------------------------------------------- X4
  const x4 = cli(['start', '--room', sg.roomDir], authored);
  const j4 = x4.json || {};
  const got4 = j4.theo && Array.isArray(j4.theo.steps) ? j4.theo.steps.map(function (s) { return s.label; }) : [];
  C.check('X4 the authored fixture gives entry_gate and seven labels in list order',
    x4.status === 0 && j4.next === 'entry_gate' && got4.length === 7 && JSON.stringify(got4) === JSON.stringify(labels), JSON.stringify(got4));
  C.check('X4 the status block lists the labels and no refusal', String(j4.status).indexOf(labels[0]) !== -1 && String(j4.status).indexOf(REFUSAL) === -1);

  const st = await buildStampedRoom(ROOMS, 'stamped_strong_ambient', { name: 'stamped_a' });
  const x4s = cli(['start', '--room', st.roomDir], authored);
  const j4s = x4s.json || {};
  const flight = j4s.entry && Array.isArray(j4s.entry.in_flight) ? j4s.entry.in_flight : [];
  C.check('X4 a stamped finding in flight proposes step 6 and lists the row with its stamp lines',
    x4s.status === 0 && j4s.next === 'entry_gate' && !!j4s.entry && j4s.entry.proposed_step === 6 && flight.length === 1
    && flight[0].opportunity_id === st.ids.opportunity && Array.isArray(flight[0].stamp_lines) && flight[0].stamp_lines.length > 0
    && flight[0].stamp_lines.every(function (l) { return String(j4s.card).indexOf(l) !== -1; }), JSON.stringify(flight).slice(0, 300));
  C.check('X4 the finding score never reaches the card or the entry', x4s.status === 0 && String(j4s.card).indexOf(String(SCORE)) === -1 && JSON.stringify(j4s.entry || {}).indexOf(String(SCORE)) === -1);

  // ---------------------------------------------------------------- X5 the authored walk
  const walkRoom = buildEntryRoom(ROOMS, 'stated_goal', { name: 'walk_room' });
  const whatId = firstCandidate(walkRoom.roomDir);
  const outcomes = fixtureDoor.stageOutputsFrom363();
  const confirm = cli(['stage', '--room', walkRoom.roomDir, '--input', writeJson('confirm.json', { confirm: { what_id: whatId, chosen_step: 1 } })], authored);
  const cj = confirm.json || {};
  const runDir = path.join(walkRoom.roomDir, '.mindrian', 'scientific-roadmap');
  C.check('X5 confirm creates the run state under the run folder with a run-tag name',
    confirm.status === 0 && cj.ok === true && typeof cj.state_path === 'string' && path.dirname(cj.state_path) === runDir
    && /^sr-\d{8}-[0-9a-f]{8}\.json$/.test(path.basename(cj.state_path)) && /^sr-\d{8}-[0-9a-f]{8}$/.test(String(cj.run_tag)) && fs.existsSync(cj.state_path),
    confirm.stdout.slice(0, 300) + confirm.stderr.slice(0, 200));
  C.check('X5 the first stage is sr:1 with its gate and Theo step text as served',
    cj.next_stage === 'sr:1' && cj.gate === 'F.0' && !!cj.step && cj.step.label === labels[0] && /FIXTURE runIt/.test(String(cj.step.runIt)), JSON.stringify(cj.step));
  const statePath = cj.state_path;

  const order = ['sr:1', 'sr:2', 'sr:3', 'sr:4'];
  let walkOk = true;
  let lastNext = cj.next_stage;
  order.forEach(function (stage) {
    const r = cli(['stage', '--room', walkRoom.roomDir, '--state', statePath, '--input', stageFile(stage, outcomes[stage])], authored);
    if (!(r.status === 0 && r.json && r.json.ok === true)) walkOk = false;
    lastNext = r.json && r.json.next_stage;
  });
  C.check('X5 sr:1 to sr:4 record in order and the next stage is the systems pass (F.1)', walkOk && lastNext === 'systems_pass', String(lastNext));

  const beforeS5 = sha(statePath);
  const early = cli(['stage', '--room', walkRoom.roomDir, '--state', statePath, '--input', stageFile('sr:5', outcomes['sr:5'])], authored);
  C.check('X5 sr:5 before the systems pass refuses with exit 0 and leaves the state unchanged',
    early.status === 0 && !!early.json && early.json.ok === false && early.json.reason === 'systems_pass_required' && sha(statePath) === beforeS5, early.stdout.slice(0, 200));
  const earlyLimit = cli(['stage', '--room', walkRoom.roomDir, '--state', statePath, '--input', stageFile('sr:6', outcomes['sr:6'])], authored);
  C.check('X5 sr:6 before the systems pass refuses too',
    earlyLimit.status === 0 && !!earlyLimit.json && earlyLimit.json.ok === false && earlyLimit.json.reason === 'systems_pass_required' && sha(statePath) === beforeS5);

  const sysR = cli(['stage', '--room', walkRoom.roomDir, '--state', statePath, '--input', stageFile('systems_pass', { decision: 'approve', status: 'declined', reason: 'No systems artifact exists yet.' })], authored);
  C.check('X5 the systems pass declined with a reason opens sr:5', sysR.status === 0 && !!sysR.json && sysR.json.ok === true && sysR.json.next_stage === 'sr:5' && sysR.json.gate === 'F.4', sysR.stdout.slice(0, 200));

  let tailOk = true;
  let tailNext = null;
  ['sr:5', 'sr:6', 'sr:7'].forEach(function (stage) {
    const r = cli(['stage', '--room', walkRoom.roomDir, '--state', statePath, '--input', stageFile(stage, outcomes[stage])], authored);
    if (!(r.status === 0 && r.json && r.json.ok === true)) tailOk = false;
    tailNext = r.json && r.json.next_stage;
  });
  C.check('X5 sr:5 to sr:7 record and the walk reaches stage_b', tailOk && tailNext === 'stage_b', String(tailNext));

  const qs = cli(['question-set', '--room', walkRoom.roomDir, '--state', statePath], authored);
  C.check('X5 question-set is ok and carries the scientific-roadmapping template',
    qs.status === 0 && !!qs.json && qs.json.ok === true && !!qs.json.question_set && qs.json.question_set.template_id === 'scientific-roadmapping', qs.stdout.slice(0, 200));

  const plan = cli(['plan', '--room', walkRoom.roomDir, '--state', statePath], authored);
  const pj = plan.json || {};
  C.check('X5 plan returns plan_ref, the card and the rubric labelled as plugin-side',
    plan.status === 0 && pj.ok === true && !!pj.plan_ref && typeof pj.plan_ref.run_id === 'string' && typeof pj.card === 'string' && pj.card.length > 0
    && String(pj.rubric).indexOf('plugin-side rubric, not Theo content') !== -1 && pj.handoff === '/mos:research' && Array.isArray(pj.leaves) && pj.leaves.length > 0,
    plan.stdout.slice(0, 300) + plan.stderr.slice(0, 300));

  const basket = cli(['basket', '--room', walkRoom.roomDir, '--state', statePath], authored);
  const bj = basket.json || {};
  C.check('X5 basket returns items led by research_plan and a card',
    basket.status === 0 && bj.ok === true && Array.isArray(bj.items) && bj.items.length > 1 && bj.items[0].id === 'research_plan' && !!bj.card && String(bj.card.body_md).indexOf('## File this research plan?') === 0);

  const noSel = cli(['file', '--room', walkRoom.roomDir, '--state', statePath], authored);
  C.check('X5 file without a selection file is a usage error (exit 2)', noSel.status === 2, 'status=' + noSel.status);
  const notApproved = cli(['file', '--room', walkRoom.roomDir, '--state', statePath, '--selection', writeJson('sel-no.json', { approved: false, items: ['research_plan'] })], authored);
  C.check('X5 file with approved false refuses and writes nothing',
    notApproved.status === 0 && !!notApproved.json && notApproved.json.ok === false && !fs.existsSync(path.join(walkRoom.roomDir, 'research-plan', 'PLAN.md')), notApproved.stdout.slice(0, 200));
  const filed = cli(['file', '--room', walkRoom.roomDir, '--state', statePath, '--selection', writeJson('sel-yes.json', { approved: true, items: (bj.items || []).map(function (i) { return i.id; }) })], authored);
  const planFile = path.join(walkRoom.roomDir, 'research-plan', 'PLAN.md');
  C.check('X5 an approved selection files research-plan/PLAN.md and marks filing done',
    filed.status === 0 && !!filed.json && filed.json.ok === true && fs.existsSync(planFile) && JSON.parse(fs.readFileSync(statePath, 'utf8')).stages.filing.status === 'done',
    filed.stdout.slice(0, 300) + filed.stderr.slice(0, 200));
  const planText = fs.existsSync(planFile) ? fs.readFileSync(planFile, 'utf8') : '';
  C.check('X5 the filed plan names the Theo labels and the wired Settled section reads the state', labels.every(function (l, i) { return i >= 7 || planText.indexOf(l) !== -1; }) && planText.indexOf('## Settled, not re-argued') !== -1);

  const planRefLine = (planText.split('\n---\n')[0].match(/^plan_ref: (.*)$/m) || [])[1];
  C.check('X5 the filed plan names the plan run it came from (plan_ref is the run id, not null)',
    !!pj.plan_ref && planRefLine === JSON.stringify(pj.plan_ref.run_id), String(planRefLine) + ' vs ' + JSON.stringify(pj.plan_ref));

  // X5 (Plan 14): a stamped finding in flight, step 6 refuses until it is addressed
  const st2 = await buildStampedRoom(ROOMS, 'stamped_strong_ambient', { name: 'stamped_walk' });
  const oppId = st2.ids.opportunity;
  const c2 = cli(['stage', '--room', st2.roomDir, '--input', writeJson('confirm2.json', { confirm: { what_id: st2.ids.goal, chosen_step: 6 } })], authored);
  const c2j = c2.json || {};
  C.check('X5 a stamped-finding entry at step 6 creates a run whose first open stage is the systems pass', c2.status === 0 && c2j.ok === true && c2j.next_stage === 'systems_pass', c2.stdout.slice(0, 300) + c2.stderr.slice(0, 200));
  const sp2 = c2j.state_path;
  const sysB = cli(['stage', '--room', st2.roomDir, '--state', sp2, '--input', stageFile('systems_pass', { decision: 'approve', status: 'declined', reason: 'No systems artifact exists yet.' })], authored);
  C.check('X5 the next stage is sr:6 and its bound input lists the in-flight row',
    !!sysB.json && sysB.json.next_stage === 'sr:6' && !!sysB.json.bound && Array.isArray(sysB.json.bound.in_flight) && sysB.json.bound.in_flight.length === 1
    && sysB.json.bound.first_rows.indexOf(oppId) !== -1, sysB.stdout.slice(0, 300));
  const before6 = sha(sp2);
  const sr6bare = cli(['stage', '--room', st2.roomDir, '--state', sp2, '--input', stageFile('sr:6', { decision: 'approve', output: { limiters: [{ id: 'LX1', column: 'assumed', label: 'An unrelated limiter', question: 'Is it fixed?' }] } })], authored);
  C.check('X5 sr:6 refuses bound_input_unaddressed until the in-flight row is a limiter or dismissed',
    sr6bare.status === 0 && !!sr6bare.json && sr6bare.json.ok === false && String(sr6bare.json.reason) === 'bound_input_unaddressed:' + oppId && sha(sp2) === before6, sr6bare.stdout.slice(0, 200));
  const sr6ok = cli(['stage', '--room', st2.roomDir, '--state', sp2, '--input', stageFile('sr:6', { decision: 'approve', output: { limiters: [{ id: 'LX1', column: 'assumed', label: 'The link the finding depends on', question: 'Is it fixed?', source_node_id: oppId }] } })], authored);
  C.check('X5 sr:6 records once the in-flight row is a limiter row', sr6ok.status === 0 && !!sr6ok.json && sr6ok.json.ok === true && sr6ok.json.next_stage === 'sr:7', sr6ok.stdout.slice(0, 200));

  // X5 (Plan 06 stub wired by Plan 09): the ratchet output reaches the filed Settled section
  {
    const persp = require(path.join(REPO_ROOT, 'lib/core/research-planner/perspective.cjs'));
    const pr = buildEntryRoom(ROOMS, 'stated_goal', { name: 'settled_room' });
    const runRef = '2026-09-30-sr-prior-0000abcd';
    fs.mkdirSync(path.join(pr.roomDir, 'research', runRef), { recursive: true });
    fs.writeFileSync(path.join(pr.roomDir, 'research', runRef, 'plan.json'), JSON.stringify({
      perspective: { ratchet: { settled: [{ limiter_key: persp.limiterKey('Interface resistance at the anode'), column: 'assumed', evidence: ['evidence:old-364'], run_ref: runRef }] } },
    }));
    const wid = firstCandidate(pr.roomDir);
    const cf = cli(['stage', '--room', pr.roomDir, '--input', writeJson('confirm3.json', { confirm: { what_id: wid, chosen_step: 1 } })], authored).json || {};
    let ok = cf.ok === true;
    ['sr:1', 'sr:2', 'sr:3', 'sr:4'].forEach(function (stage) {
      const r = cli(['stage', '--room', pr.roomDir, '--state', cf.state_path, '--input', stageFile(stage, outcomes[stage])], authored);
      ok = ok && !!r.json && r.json.ok === true;
    });
    ok = ok && (cli(['stage', '--room', pr.roomDir, '--state', cf.state_path, '--input', stageFile('systems_pass', { decision: 'approve', status: 'declined', reason: 'No systems artifact exists yet.' })], authored).json || {}).ok === true;
    ['sr:5', 'sr:6', 'sr:7'].forEach(function (stage) {
      const r = cli(['stage', '--room', pr.roomDir, '--state', cf.state_path, '--input', stageFile(stage, outcomes[stage])], authored);
      ok = ok && !!r.json && r.json.ok === true;
    });
    const pl = (cli(['plan', '--room', pr.roomDir, '--state', cf.state_path], authored).json) || {};
    C.check('X5 plan reports the limiter an earlier run settled as excluded and keeps it in the state',
      ok && pl.ok === true && Array.isArray(pl.settled_excluded) && pl.settled_excluded.length === 1 && pl.settled_excluded[0].limiter_id === 'LM2'
      && Array.isArray(JSON.parse(fs.readFileSync(cf.state_path, 'utf8')).settled_excluded), JSON.stringify(pl.settled_excluded));
    const bk = (cli(['basket', '--room', pr.roomDir, '--state', cf.state_path], authored).json) || { items: [] };
    cli(['file', '--room', pr.roomDir, '--state', cf.state_path, '--selection', writeJson('sel-settled.json', { approved: true, items: ['research_plan'] })], authored);
    const pf = path.join(pr.roomDir, 'research-plan', 'PLAN.md');
    const pt = fs.existsSync(pf) ? fs.readFileSync(pf, 'utf8') : '';
    const sec = pt.split('## Settled, not re-argued')[1] || '';
    C.check('X5 the filed Settled section lists the excluded limiter instead of the empty line',
      bk.ok === true && sec.split('## ')[0].indexOf('Interface resistance at the anode') !== -1 && pt.indexOf('Nothing from an earlier run is carried here.') === -1, sec.slice(0, 200));
  }

  // ---------------------------------------------------------------- X6
  const goodName = 'sr-20261003-deadbeef.json';
  const outside = path.join(SCRATCH, 'elsewhere');
  fs.mkdirSync(outside, { recursive: true });
  const anyInput = writeJson('any.json', { stage: 'sr:1', decision: 'approve', output: { tension: { statement: 'x' } } });
  const x6a = cli(['stage', '--room', walkRoom.roomDir, '--state', path.join(outside, goodName), '--input', anyInput], authored);
  const x6b = cli(['stage', '--room', walkRoom.roomDir, '--state', path.join(runDir, 'notes.json'), '--input', anyInput], authored);
  const x6c = cli(['stage', '--room', walkRoom.roomDir, '--state', path.join(runDir, '..', '..', goodName), '--input', anyInput], authored);
  const x6d = cli(['basket', '--room', walkRoom.roomDir, '--state', path.join(runDir, '..', 'sr-x.json')], authored);
  C.check('X6 a state path outside the run folder exits 2 with state_path_invalid', x6a.status === 2 && (x6a.stdout + x6a.stderr).indexOf('state_path_invalid') !== -1);
  C.check('X6 a name that is not a run tag exits 2 with state_path_invalid', x6b.status === 2 && (x6b.stdout + x6b.stderr).indexOf('state_path_invalid') !== -1);
  C.check('X6 a dot-dot escape exits 2 with state_path_invalid', x6c.status === 2 && (x6c.stdout + x6c.stderr).indexOf('state_path_invalid') !== -1);
  C.check('X6 the check also guards basket', x6d.status === 2 && (x6d.stdout + x6d.stderr).indexOf('state_path_invalid') !== -1);

  // ---------------------------------------------------------------- X7
  const x7a = cli(['nope'], authored);
  const x7b = cli(['start'], authored);
  const big = writeJson('big.json', JSON.stringify({ stage: 'sr:1', decision: 'approve', output: { tension: { statement: 'y'.repeat(262200) } } }));
  const x7c = cli(['stage', '--room', walkRoom.roomDir, '--state', statePath, '--input', big], authored);
  const x7d = cli(['start', '--room', path.join(SCRATCH, 'no-such-room')], authored);
  const x7e = cli(['stage', '--room', walkRoom.roomDir, '--state', statePath, '--input', writeJson('arr.json', '[1,2]')], authored);
  C.check('X7 an unknown subcommand exits 2', x7a.status === 2);
  C.check('X7 a missing --room exits 2', x7b.status === 2);
  C.check('X7 an --input file over 262144 bytes exits 2', x7c.status === 2, 'status=' + x7c.status);
  C.check('X7 a --room that is not a directory exits 2', x7d.status === 2);
  C.check('X7 an --input that is not a plain object exits 2', x7e.status === 2);

  // ---------------------------------------------------------------- X8 parity with the MCP handler
  const { installFakeBrain } = require(path.join(REPO_ROOT, 'tests/helpers/fake-brain-364.cjs'));
  const fake = installFakeBrain({
    framework_step: JSON.parse(fs.readFileSync(fixturePath('framework-step-all-null'), 'utf8')),
    recommend_chain: JSON.parse(fs.readFileSync(fixturePath('recommend-chain-thin'), 'utf8')),
  });
  let mcpText = '';
  try {
    const toolRouter = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tool-router.cjs'));
    const handlers = {};
    toolRouter.registerRouterTools({ registerTool: function (n, _c, fn) { handlers[n] = fn; }, tool: function () {} }, sg.roomDir, REPO_ROOT, { compact: '' }, 'cli');
    const resp = await handlers.methodology({ command: 'scientific-roadmap' });
    mcpText = resp && resp.content && resp.content[0] ? String(resp.content[0].text) : '';
  } finally { fake.restore(); }
  C.check('X8 the MCP handler carries the same refusal text as the CLI', !!j2.theo && mcpText.indexOf(j2.theo.message) !== -1 && mcpText.indexOf(REFUSAL) !== -1);
  C.check('X8 the MCP handler proposes the same step as the CLI entry', mcpText.indexOf('Proposed entry: step 2 of 7') !== -1
    && String(j2.card).indexOf('Proposed entry: step 2 of 7') !== -1);
  C.check('X8 both offer /mos:research on the refusal', mcpText.indexOf('/mos:research') !== -1 && j2.offer === '/mos:research');

  // ---------------------------------------------------------------- X9
  const door = require(path.join(REPO_ROOT, 'lib/core/research-planner/sr-door.cjs'));
  const md = fs.readFileSync(path.join(REPO_ROOT, 'commands', 'scientific-roadmap.md'), 'utf8');
  const fm = md.split('\n---\n')[0];
  const declared = new Set();
  (fm.match(/shapes:\s*\[[^\]]*\]/g) || []).forEach(function (m) {
    (m.match(/F\.\d+/g) || []).forEach(function (s) { declared.add(s); });
  });
  const expected = new Set(Object.keys(door.STAGE_GATES).map(function (k) { return door.STAGE_GATES[k]; }));
  expected.add('F.1');
  expected.add('F.9');
  C.check('X9 the hitl_stages shapes equal the STAGE_GATES shapes plus F.1 and F.9',
    declared.size > 0 && JSON.stringify(Array.from(declared).sort()) === JSON.stringify(Array.from(expected).sort()), JSON.stringify([Array.from(declared).sort(), Array.from(expected).sort()]));

  // ---------------------------------------------------------------- X10
  C.check('X10 zero network attempts in the parent', net.attempts() === 0, 'attempts=' + net.attempts());
  C.check('X10 every child wrote a log with net_attempts 0',
    childLogs.length > 20 && childLogs.every(function (l) { return !!l && l.net_attempts === 0; }), 'logs=' + childLogs.length + ' bad=' + childLogs.filter(function (l) { return !l || l.net_attempts !== 0; }).length);
  C.check('X10 no em-dash or en-dash in this test', !DASH.test(fs.readFileSync(__filename, 'utf8')));
  C.check('X10 the marker was never needed on the wire in this test', childLogs.every(function (l) { return !l || JSON.stringify(l.calls).indexOf(MARKER) === -1; }));
}

main().then(function () {
  const code = C.summary();
  try { fs.rmSync(SCRATCH, { recursive: true, force: true }); } catch (_e) { /* tmp */ }
  process.exit(code);
}).catch(function (e) {
  console.log('FAIL: unexpected error ' + (e && e.stack || e));
  process.exit(1);
});
