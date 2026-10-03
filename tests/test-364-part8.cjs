#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 364 Plan 09 Task 1 -- the Canon Part 8 sweep for Scientific
 * Roadmapping (SRM364-16, T-364-40). A marker is planted in the room (the WHAT,
 * a governing question, a claim, every stage output) and hunted on the wire
 * across a full CLI walk and the MCP handler. layer: harness
 *
 *   Q1  full authored CLI walk on a marker room: the marker is in no recorded call
 *   Q2  the in-process MCP handler on the same room: the marker is in no recorded call
 *   Q3  every recorded call is framework_step {framework} or recommend_chain
 *       {WellDefined, 6}, and the real guard classifies each known_tool_shape
 *   Q4  only sr-steps.cjs references brain-client among the sr modules and the CLI;
 *       none carries mcp__theo, theo-mcp, mindrian-brain-mcp-client, fetch( or http, https, net
 *   Q5  none carries the Theo repo path or a write call naming Theo
 *   Q6  sr-steps.cjs requires the guarded ../brain-client.cjs, never a raw MCP client
 *   Q7  zero network attempts in the parent and every child
 *   Q8  the filed PLAN.md carries the marker only as the navigator's own text and
 *       carries no Theo step text other than the labels the authored fixture served
 *
 * Hermetic: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME at mkdtemp dirs before any
 * repo module loads. Exit 77 when node:sqlite is missing. Hyphens only, no emoji.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-364-p8-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-364-p8-rooms-'));
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
const C = hygiene.makeChecker('test-364-part8');

const CLI = path.join(REPO_ROOT, 'scripts', 'scientific-roadmap.cjs');
const PRELOAD = path.join(REPO_ROOT, 'tests', 'helpers', 'fake-brain-364.cjs');
const FIX = path.join(REPO_ROOT, 'tests', 'fixtures', '364-theo');
const DASH = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']');

const fixtureDoor = require(path.join(REPO_ROOT, 'tests/helpers/fixture-door-364.cjs'));
const { buildEntryRoom, MARKER } = require(path.join(REPO_ROOT, 'tests/helpers/fixture-room-364.cjs'));

const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-364-p8-'));
const ROOMS = path.join(SCRATCH, 'rooms');
fs.mkdirSync(ROOMS, { recursive: true });
const WORK = path.join(SCRATCH, 'work');
fs.mkdirSync(WORK, { recursive: true });

const childLogs = [];
let seq = 0;

function fixturePath(name) { return path.join(FIX, name + '.json'); }

function cli(args, stepFixture) {
  seq += 1;
  const cfg = path.join(WORK, 'fake-' + seq + '.json');
  const log = path.join(WORK, 'log-' + seq + '.json');
  fs.writeFileSync(cfg, JSON.stringify({
    framework_step: fixturePath(stepFixture || 'framework-step-authored'),
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
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '', json: json };
}

function writeJson(name, obj) {
  const f = path.join(WORK, seq + '-' + name);
  fs.writeFileSync(f, JSON.stringify(obj));
  return f;
}

// Put the marker into the navigator-side descriptive text of a stage output.
const TEXT_KEYS = ['statement', 'target', 'falsifier', 'label', 'question', 'claim', 'note', 'disputed_feasibility'];
function plant(v) {
  if (Array.isArray(v)) return v.map(plant);
  if (v !== null && typeof v === 'object') {
    const o = {};
    Object.keys(v).forEach(function (k) {
      o[k] = typeof v[k] === 'string' && TEXT_KEYS.indexOf(k) !== -1 ? v[k] + ' ' + MARKER : plant(v[k]);
    });
    return o;
  }
  return v;
}

// A marker room: the ratified goal plus a governing question plus a claim, all carrying the marker.
function markerRoom() {
  const built = buildEntryRoom(ROOMS, 'stated_goal', { name: 'marker_room' });
  const roomDb = require(path.join(REPO_ROOT, 'lib/core/room-db.cjs'));
  const navigation = require(path.join(REPO_ROOT, 'lib/core/navigation.cjs'));
  const fp = require(path.join(REPO_ROOT, 'lib/core/frame-provenance.cjs'));
  const db = roomDb.openRoomDb(built.roomDir);
  try {
    const gq = fp.setGoverningQuestion(db, built.roomDir, { text: 'Which coating halves fouling in seawater intakes? ' + MARKER, origin: 'tasking' });
    if (!gq || gq.ok !== true) throw new Error('setGoverningQuestion refused ' + JSON.stringify(gq));
    const cl = navigation.writeClaimNode(db, { knowledge_type: 'assumption', text: 'Zwitterionic coatings cut biofilm attachment by half ' + MARKER, sessionId: 'p8-364' });
    if (!cl || cl.ok !== true) throw new Error('writeClaimNode refused ' + JSON.stringify(cl));
  } finally { roomDb.closeRoomDb(db); }
  return built;
}

async function main() {
  const authored = 'framework-step-authored';
  const room = markerRoom();
  const entry = cli(['start', '--room', room.roomDir], authored);
  const cand = entry.json && entry.json.entry ? entry.json.entry.what.candidates : [];
  const whatId = (cand.filter(function (c) { return c.kind === 'goal'; })[0] || cand[0] || {}).id;

  // The walk, every stage output carrying the marker.
  const outcomes = fixtureDoor.stageOutputsFrom363();
  const planted = {};
  Object.keys(outcomes).forEach(function (k) { planted[k] = { decision: 'approve', output: plant(outcomes[k].output) }; });
  const conf = (cli(['stage', '--room', room.roomDir, '--input', writeJson('confirm.json', { confirm: { what_id: whatId, chosen_step: 1 } })], authored).json) || {};
  const sp = conf.state_path;
  let walked = conf.ok === true;
  function step(stage, outcome) {
    const r = cli(['stage', '--room', room.roomDir, '--state', sp, '--input', writeJson(stage.replace(':', '-') + '.json', Object.assign({ stage: stage }, outcome))], authored);
    walked = walked && !!r.json && r.json.ok === true;
  }
  ['sr:1', 'sr:2', 'sr:3', 'sr:4'].forEach(function (s) { step(s, planted[s]); });
  step('systems_pass', { decision: 'approve', status: 'declined', reason: 'No systems artifact for ' + MARKER });
  ['sr:5', 'sr:6', 'sr:7'].forEach(function (s) { step(s, planted[s]); });
  const qs = cli(['question-set', '--room', room.roomDir, '--state', sp], authored);
  const plan = cli(['plan', '--room', room.roomDir, '--state', sp], authored);
  const basket = cli(['basket', '--room', room.roomDir, '--state', sp], authored);
  const items = basket.json && Array.isArray(basket.json.items) ? basket.json.items.map(function (i) { return i.id; }) : [];
  const filed = cli(['file', '--room', room.roomDir, '--state', sp, '--selection', writeJson('sel.json', { approved: true, items: items })], authored);
  const refusedStart = cli(['start', '--room', room.roomDir], 'framework-step-all-null');

  const stateText = sp && fs.existsSync(sp) ? fs.readFileSync(sp, 'utf8') : '';
  const planFile = path.join(room.roomDir, 'research-plan', 'PLAN.md');
  const planText = fs.existsSync(planFile) ? fs.readFileSync(planFile, 'utf8') : '';

  const cliCalls = [];
  childLogs.forEach(function (l) { if (l && Array.isArray(l.calls)) l.calls.forEach(function (c) { cliCalls.push(c); }); });

  // ---------------------------------------------------------------- Q1
  C.check('Q1 the walk really ran end to end on the marker room (non-vacuous)',
    walked && qs.json && qs.json.ok === true && plan.json && plan.json.ok === true && filed.json && filed.json.ok === true
    && String(entry.stdout).indexOf(MARKER) !== -1 && stateText.indexOf(MARKER) !== -1 && planText.indexOf(MARKER) !== -1,
    'walked=' + walked + ' plan=' + plan.stdout.slice(0, 200) + ' filed=' + filed.stdout.slice(0, 200));
  C.check('Q1 the marker appears in no call the CLI children recorded', cliCalls.length > 0 && JSON.stringify(cliCalls).indexOf(MARKER) === -1,
    'calls=' + cliCalls.length);

  // ---------------------------------------------------------------- Q2
  const { installFakeBrain } = require(path.join(REPO_ROOT, 'tests/helpers/fake-brain-364.cjs'));
  const fake = installFakeBrain({
    framework_step: JSON.parse(fs.readFileSync(fixturePath(authored), 'utf8')),
    recommend_chain: JSON.parse(fs.readFileSync(fixturePath('recommend-chain-thin'), 'utf8')),
  });
  let mcpText = '';
  let mcpCalls = [];
  try {
    const toolRouter = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tool-router.cjs'));
    const handlers = {};
    toolRouter.registerRouterTools({ registerTool: function (n, _c, fn) { handlers[n] = fn; }, tool: function () {} }, room.roomDir, REPO_ROOT, { compact: '' }, 'desktop');
    const resp = await handlers.methodology({ command: 'scientific-roadmap' });
    mcpText = resp && resp.content && resp.content[0] ? String(resp.content[0].text) : '';
    mcpCalls = fake.calls.slice();
  } finally { fake.restore(); }
  C.check('Q2 the MCP handler ran on the marker room and shows it to the navigator (non-vacuous)', mcpCalls.length > 0 && mcpText.indexOf(MARKER) !== -1, 'calls=' + mcpCalls.length);
  C.check('Q2 the marker appears in no call the MCP handler made', JSON.stringify(mcpCalls).indexOf(MARKER) === -1);

  // ---------------------------------------------------------------- Q3
  const guard = require(path.join(REPO_ROOT, 'lib/core/part8-egress-guard.cjs'));
  const all = cliCalls.concat(mcpCalls);
  const shapeOk = all.length > 0 && all.every(function (c) {
    if (c.tool === 'framework_step') return JSON.stringify(c.args) === JSON.stringify({ framework: 'Scientific Roadmapping' });
    if (c.tool === 'recommend_chain') return JSON.stringify(c.args) === JSON.stringify({ problem_type: 'WellDefined', max_steps: 6 });
    return false;
  });
  C.check('Q3 every recorded call is the SR handle or the WellDefined enum', shapeOk, JSON.stringify(all).slice(0, 300));
  const classes = all.map(function (c) { return guard.classify(c.args, { toolName: c.tool }); });
  C.check('Q3 the real guard classifies every recorded call as known_tool_shape',
    classes.length > 0 && classes.every(function (k) { return k && k.verdict === 'allow' && k.class === 'known_tool_shape'; }), JSON.stringify(classes.filter(function (k) { return !k || k.class !== 'known_tool_shape'; }).slice(0, 3)));

  // ---------------------------------------------------------------- Q4 to Q6
  const srDir = path.join(REPO_ROOT, 'lib', 'core', 'research-planner');
  const files = fs.readdirSync(srDir).filter(function (n) { return /^sr-.*\.cjs$/.test(n); }).map(function (n) { return path.join(srDir, n); }).concat([CLI]);
  const code = {};
  files.forEach(function (f) { code[f] = fs.existsSync(f) ? hygiene.nonCommentLines(f).join('\n') : ''; });
  const present = files.filter(function (f) { return fs.existsSync(f); });
  const withClient = present.filter(function (f) { return /brain-client/.test(code[f]); }).map(function (f) { return path.basename(f); });
  C.check('Q4 the CLI and all sr modules exist and only sr-steps.cjs references brain-client',
    present.length === files.length && JSON.stringify(withClient) === JSON.stringify(['sr-steps.cjs']), JSON.stringify(withClient) + ' present=' + present.length + '/' + files.length);
  const FORBIDDEN = [/mcp__theo/, /theo-mcp/, /mindrian-brain-mcp-client/, /\bfetch\(/, /require\(\s*['"](node:)?(http|https|net)['"]\s*\)/];
  const hits = [];
  present.forEach(function (f) { FORBIDDEN.forEach(function (re) { if (re.test(code[f])) hits.push(path.basename(f) + ' ' + re); }); });
  C.check('Q4 none carries a raw Theo reach, fetch( or a network module', present.length === files.length && hits.length === 0, JSON.stringify(hits));
  const theoPath = [];
  const WRITE = /(writeFileSync|appendFileSync|renameSync|mkdirSync|copyFileSync|atomicWrite|rmSync)\(/;
  present.forEach(function (f) {
    if (/\/home\/jsagi\/Theo/.test(code[f])) theoPath.push(path.basename(f) + ' path');
    code[f].split('\n').forEach(function (line) { if (WRITE.test(line) && /theo/i.test(line)) theoPath.push(path.basename(f) + ' write'); });
  });
  C.check('Q5 none carries the Theo repo path or a write call naming Theo', present.length === files.length && theoPath.length === 0, JSON.stringify(theoPath));
  const stepsSrc = fs.readFileSync(path.join(srDir, 'sr-steps.cjs'), 'utf8');
  C.check('Q6 sr-steps.cjs requires the guarded ../brain-client.cjs and no raw MCP client',
    /require\(\s*['"]\.\.\/brain-client\.cjs['"]\s*\)/.test(stepsSrc) && !/mindrian-brain-mcp-client|@modelcontextprotocol/.test(stepsSrc));

  // ---------------------------------------------------------------- Q7
  C.check('Q7 zero network attempts in the parent', net.attempts() === 0, 'attempts=' + net.attempts());
  C.check('Q7 every child wrote a log with net_attempts 0', childLogs.length > 10 && childLogs.every(function (l) { return !!l && l.net_attempts === 0; }),
    'logs=' + childLogs.length + ' bad=' + childLogs.filter(function (l) { return !l || l.net_attempts !== 0; }).length);

  // ---------------------------------------------------------------- Q8
  const fixLabels = fixtureDoor.runnableRows(authored).map(function (s) { return s.label; });
  const fmLabels = (planText.split('\n---\n')[0].match(/theo_label:\s*"?([^"\n]*)"?/g) || []).map(function (m) { return m.replace(/theo_label:\s*"?/, '').replace(/"$/, ''); });
  const runIts = fixtureDoor.runnableRows(authored).map(function (s) { return s.runIt; });
  C.check('Q8 every theo_label in the plan is one the authored fixture served',
    fmLabels.length === 7 && fmLabels.every(function (l) { return fixLabels.indexOf(l) !== -1; }), JSON.stringify(fmLabels));
  C.check('Q8 the plan carries no Theo runIt text and no refusal text',
    planText.length > 0 && runIts.every(function (t) { return planText.indexOf(t) === -1; }) && planText.indexOf('Theo has not authored this step yet') === -1);
  const fmEnd = planText.indexOf('\n---\n', 4);
  const frontmatter = fmEnd === -1 ? planText : planText.slice(0, fmEnd);
  const bodyLines = fmEnd === -1 ? [] : planText.slice(fmEnd + 5).split('\n');
  const markerLines = bodyLines.filter(function (l) { return l.indexOf(MARKER) !== -1; });
  C.check('Q8 the marker lands only in body text the navigator wrote (never frontmatter, a heading or the rubric)',
    frontmatter.indexOf(MARKER) === -1 && markerLines.length > 0 && markerLines.every(function (l) { return !/^#/.test(l) && !/plugin-side rubric/.test(l); }),
    JSON.stringify(markerLines.slice(0, 3)));
  C.check('Q8 a refused read after the walk still carries no marker on the wire', refusedStart.json && refusedStart.json.next === 'refused'
    && JSON.stringify(childLogs[childLogs.length - 1].calls).indexOf(MARKER) === -1);
  C.check('Q8 no em-dash or en-dash in this test', !DASH.test(fs.readFileSync(__filename, 'utf8')));
}

main().then(function () {
  const code = C.summary();
  try { fs.rmSync(SCRATCH, { recursive: true, force: true }); } catch (_e) { /* tmp */ }
  process.exit(code);
}).catch(function (e) {
  console.log('FAIL: unexpected error ' + (e && e.stack || e));
  process.exit(1);
});
