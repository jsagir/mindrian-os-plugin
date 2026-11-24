#!/usr/bin/env node
'use strict';
// Phase 399-08: the advisor ranks among the commands of a framework inside composeWorkflow,
// the one door from framework to command (I-07). Legs W1 to W6 plus the orchestrator guard legs
// (opt-in default byte-identical, tie at the top means no reorder, no raw number in visible text).
// Fixture tables only; the shipped table is not read. Node built-ins only, no network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const RES = path.join(ROOT, 'lib', 'workflow', 'command-resolver.cjs');
delete process.env.MINDRIAN_DECISION_ADVISOR;
delete process.env.MINDRIAN_DECISION_ADVISOR_TABLE;
const resolver = require(RES);
const REG = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'command-registry.json'), 'utf8'));

let failed = 0;
let passed = 0;
function check(label, fn) {
  try { fn(); passed += 1; console.log('ok: ' + label); }
  catch (e) { failed += 1; console.log('FAIL: ' + label + ' -- ' + (e && e.message ? e.message : String(e))); }
}
async function checkAsync(label, fn) {
  try { await fn(); passed += 1; console.log('ok: ' + label); }
  catch (e) { failed += 1; console.log('FAIL: ' + label + ' -- ' + (e && e.message ? e.message : String(e))); }
}

function withEnv(vars, fn) {
  const prev = {};
  for (const k of Object.keys(vars)) { prev[k] = process.env[k]; if (vars[k] === undefined) delete process.env[k]; else process.env[k] = vars[k]; }
  try { return fn(); } finally { for (const k of Object.keys(vars)) { if (prev[k] === undefined) delete process.env[k]; else process.env[k] = prev[k]; } }
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'test-399-08-'));
process.on('exit', () => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ } });

const JOB = 'decide-pursue';
// Four commands, registry order: bono, hat-briefing, persona, think-hats.
const FW = 'Six Thinking Hats';
const CMDS = resolver.commandsForFramework(FW);
function writeTable(name, rows) {
  const file = path.join(TMP, name + '.json');
  fs.writeFileSync(file, JSON.stringify({
    schema: 'fixture', table_version: '399-fixture-' + name, key_order: ['job', 'definition_level', 'last_command'],
    thresholds: { strong: 0.7, possible: 0.5 }, shortlist_k: 3, rows,
  }));
  return file;
}
const E = (command, calibrated) => ({ command, calibrated });
const T_PICK = writeTable('pick', { [JOB + '|*|*']: [E(CMDS[3], 0.9), E(CMDS[2], 0.6), E(CMDS[0], 0.2)] });
const T_TIE = writeTable('tie', { [JOB + '|*|*']: [E(CMDS[3], 1), E(CMDS[2], 1), E(CMDS[0], 0.2)] });
const T_FIRST_TOP = writeTable('first-top', { [JOB + '|*|*']: [E(CMDS[0], 0.9), E(CMDS[3], 0.8)] });
const T_ALL_WEAK = writeTable('all-weak', { [JOB + '|*|*']: [E('/mos:not-in-this-framework', 0.9), E(CMDS[3], 0.1), E(CMDS[0], 0.2)] });
const T_OTHER_JOB = writeTable('other-job', { ['find-problem|*|*']: [E(CMDS[3], 0.9)] });
const ON = (table) => ({ MINDRIAN_DECISION_ADVISOR: 'on', MINDRIAN_DECISION_ADVISOR_TABLE: table });

function indexOnlyProps(arr) { return Object.keys(arr).filter((k) => !/^\d+$/.test(k)); }

const CHAINS = [
  ['Jobs to Be Done (JTBD)', 'Systems Thinking'],
  [FW, 'S-Curve Analysis', 'No Such Framework 399'],
  ['Adoption-Capacity Theory'],
];

check('fixture: the framework has 4 commands in the expected order', () => {
  assert.equal(CMDS.length, 4);
  assert.equal(CMDS[3], '/mos:think-hats');
});

check('W1 no options, and undefined options, deep-equal the base output for 3 chains; no own non-index property', () => {
  for (const chain of CHAINS) {
    const a = resolver.composeWorkflow(chain);
    const b = resolver.composeWorkflow(chain, undefined);
    assert.deepStrictEqual(a, b);
    assert.deepEqual(indexOnlyProps(a), []);
    for (const s of a) {
      assert.deepEqual(Object.keys(s).sort(), ['command', 'framework', 'optional', 'step']);
    }
    // Even with the advisor on, options without a job id change nothing.
    withEnv(ON(T_PICK), () => {
      assert.deepStrictEqual(resolver.composeWorkflow(chain, {}), a);
      assert.deepStrictEqual(resolver.composeWorkflow(chain, { jobId: '' }), a);
    });
  }
});

check('W2 with a job and a table where the last command is strong, the step runs that command, with basis and ranked list', () => {
  const wf = withEnv(ON(T_PICK), () => resolver.composeWorkflow([FW], { jobId: JOB }));
  assert.equal(wf.length, 1);
  assert.equal(wf[0].command, CMDS[3]);
  assert.equal(wf[0].optional, false);
  assert.equal(wf[0].command_basis, 'advisor');
  // Review WR-04: only the strong band promotes; CMDS[2] (possible, 0.6) keeps registry order with the rest.
  assert.deepEqual(wf[0].ranked_commands, [CMDS[3], CMDS[0], CMDS[1], CMDS[2]]);
  assert.deepEqual(indexOnlyProps(wf), []);
});

check('W2b WR-04 a possible command is never promoted: with no strong command the registry order stands', () => {
  const T_POSSIBLE = writeTable('possible-only', { [JOB + '|*|*']: [E(CMDS[3], 0.6), E(CMDS[2], 0.2)] });
  const wf = withEnv(ON(T_POSSIBLE), () => resolver.composeWorkflow([FW], { jobId: JOB }));
  assert.equal(wf[0].command, CMDS[0]);
  assert.equal(wf[0].command_basis, 'registry_order');
  assert.deepEqual(wf[0].ranked_commands, CMDS);
});

check('W2c WR-04 the command that just ran is not promoted, in any spelling of the command name', () => {
  const T_LAST = writeTable('last-top', { [JOB + '|*|*']: [E(CMDS[3], 1), E(CMDS[2], 0.75), E(CMDS[0], 0.2)] });
  for (const last of [CMDS[3], CMDS[3].replace('/mos:', 'mos:'), CMDS[3].replace('/mos:', '')]) {
    const wf = withEnv(ON(T_LAST), () => resolver.composeWorkflow([FW], { jobId: JOB, lastCommand: last }));
    assert.notEqual(wf[0].command, CMDS[3], 'chain step must not re-run ' + last);
    assert.ok(wf[0].ranked_commands.indexOf(CMDS[3]) > 0, last);
    assert.equal(wf[0].ranked_commands.length, CMDS.length);
  }
  // control: without lastCommand the same table promotes it
  const ctl = withEnv(ON(T_LAST), () => resolver.composeWorkflow([FW], { jobId: JOB }));
  assert.equal(ctl[0].command, CMDS[3]);
});

check('W3 no non-weak command, no row for the job, or a missing table: first command, registry_order, ranked equals the registry list', () => {
  const cases = [
    withEnv(ON(T_ALL_WEAK), () => resolver.composeWorkflow([FW], { jobId: JOB })),
    withEnv(ON(T_OTHER_JOB), () => resolver.composeWorkflow([FW], { jobId: JOB })),
    withEnv(ON(path.join(TMP, 'missing.json')), () => resolver.composeWorkflow([FW], { jobId: JOB })),
    withEnv(ON(T_PICK), () => resolver.composeWorkflow([FW], { jobId: 'not-a-job-399' })),
  ];
  for (const wf of cases) {
    assert.equal(wf[0].command, CMDS[0]);
    assert.equal(wf[0].command_basis, 'registry_order');
    assert.deepEqual(wf[0].ranked_commands, CMDS);
  }
});

check('W3b the first command stays when it already has the top non-weak value (no move without a strictly greater value)', () => {
  const wf = withEnv(ON(T_FIRST_TOP), () => resolver.composeWorkflow([FW], { jobId: JOB }));
  assert.equal(wf[0].command, CMDS[0]);
  assert.equal(wf[0].command_basis, 'registry_order');
  assert.equal(wf[0].ranked_commands[0], CMDS[0]);
  assert.equal(wf[0].ranked_commands[1], CMDS[3]);
});

check('W4 zero commands keeps command null and optional, with no basis; one command gets registry_order', () => {
  const one = Object.entries(REG.framework_index).find(([, v]) => v.length === 1);
  assert.ok(one, 'fixture: a framework with one command exists');
  const wf = withEnv(ON(T_PICK), () => resolver.composeWorkflow(['No Such Framework 399', one[0]], { jobId: JOB }));
  assert.equal(wf[0].command, null);
  assert.equal(wf[0].optional, true);
  assert.equal('command_basis' in wf[0], false);
  assert.equal('ranked_commands' in wf[0], false);
  assert.equal(wf[1].command, one[1][0]);
  assert.equal(wf[1].command_basis, 'registry_order');
  assert.deepEqual(wf[1].ranked_commands, one[1]);
});

check('W5 validateChainAutonomy judges the command the advisor chose', () => {
  const byCmd = new Map(REG.commands.map((c) => [c.command, c]));
  const safe = (c) => byCmd.get(c) && byCmd.get(c).autonomous_safe === true;
  let found = null;
  for (const [fw, cmds] of Object.entries(REG.framework_index)) {
    if (cmds.length >= 2 && safe(cmds[0]) && cmds.slice(1).some((c) => byCmd.get(c) && !safe(c))) { found = [fw, cmds]; break; }
  }
  assert.ok(found, 'fixture: a framework whose first command is safe and a later one is not');
  const [fw, cmds] = found;
  const material = cmds.slice(1).find((c) => byCmd.get(c) && !safe(c));
  const table = writeTable('w5', { [JOB + '|*|*']: [E(material, 0.95)] });
  const base = resolver.composeWorkflow([fw]);
  assert.equal(resolver.validateChainAutonomy(base).runnable, true);
  const wf = withEnv(ON(table), () => resolver.composeWorkflow([fw], { jobId: JOB }));
  assert.equal(wf[0].command, material);
  const verdict = resolver.validateChainAutonomy(wf);
  assert.equal(verdict.runnable, false);
  assert.equal(verdict.blockers[0].command, material);
});

check('G1 default (advisor unset or off) is byte-identical to base, even with a job and a table', () => {
  for (const chain of CHAINS) {
    const base = JSON.stringify(resolver.composeWorkflow(chain));
    const unset = withEnv({ MINDRIAN_DECISION_ADVISOR: undefined, MINDRIAN_DECISION_ADVISOR_TABLE: T_PICK },
      () => JSON.stringify(resolver.composeWorkflow(chain, { jobId: JOB })));
    const off = withEnv({ MINDRIAN_DECISION_ADVISOR: 'off', MINDRIAN_DECISION_ADVISOR_TABLE: T_PICK },
      () => JSON.stringify(resolver.composeWorkflow(chain, { jobId: JOB })));
    const other = withEnv({ MINDRIAN_DECISION_ADVISOR: 'yes', MINDRIAN_DECISION_ADVISOR_TABLE: T_PICK },
      () => JSON.stringify(resolver.composeWorkflow(chain, { jobId: JOB })));
    assert.equal(unset, base);
    assert.equal(off, base);
    assert.equal(other, base);
  }
  const wf = withEnv({ MINDRIAN_DECISION_ADVISOR: undefined, MINDRIAN_DECISION_ADVISOR_TABLE: T_PICK }, () => resolver.composeWorkflow([FW], { jobId: JOB }));
  assert.equal(wf[0].command, CMDS[0]);
  assert.equal('command_basis' in wf[0], false);
});

check('G2 a tie at the top of the table row means no reorder', () => {
  const wf = withEnv(ON(T_TIE), () => resolver.composeWorkflow([FW], { jobId: JOB }));
  assert.equal(wf[0].command, CMDS[0]);
  assert.equal(wf[0].command_basis, 'registry_order');
  assert.deepEqual(wf[0].ranked_commands, CMDS);
});

check('G3 no raw number in any visible text of a step (basis, ranked list, command)', () => {
  const wf = withEnv(ON(T_PICK), () => resolver.composeWorkflow([FW], { jobId: JOB }));
  const s = wf[0];
  assert.match(s.command_basis, /^[a-z_]+$/);
  assert.equal(/\d+\.\d+|\d+\s*%/.test(JSON.stringify([s.command_basis, s.ranked_commands])), false);
  for (const k of ['calibrated', 'p', 'probability', 'confidence', 'score', 'value']) assert.equal(k in s, false);
});

check('G4 the resolver source keeps the no-Brain rule on non-comment lines', () => {
  const src = fs.readFileSync(RES, 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert.equal(/brain-client|fetch\(|node:https?/.test(src), false);
});

// ---- W6: callers ----
const SENSORS_SRC = fs.readFileSync(path.join(ROOT, 'lib', 'mcp', 'tools', 'sensors.cjs'), 'utf8');
const ACT_SRC = fs.readFileSync(path.join(ROOT, 'scripts', 'act-command.cjs'), 'utf8');

check('W6 source: both callers pass { jobId, definitionLevel } when a job is known, and one argument otherwise', () => {
  for (const src of [SENSORS_SRC, ACT_SRC]) {
    assert.match(src, /resolveSelectionJob\(/);
    assert.match(src, /readRoomAxes\(/);
    assert.ok(/advisorOpts = \{ jobId: [^}]*definitionLevel:/.test(src), 'builds { jobId, definitionLevel }');
    assert.ok(/composeWorkflow\(\w+,\s*advisorOpts\)/.test(src), 'passes the options when a job is known');
    assert.ok(/:\s*(resolver\.)?composeWorkflow\(\w+\);/.test(src), 'one-argument call with no job');
  }
});

function makeRoom(name) {
  const roomDir = path.join(TMP, name);
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  fs.writeFileSync(path.join(roomDir, 'STATE.md'), '# State\n');
  return roomDir;
}
const JT = require(path.join(ROOT, 'lib', 'hmi', 'jtbd-state.cjs'));

function runAct(roomDir, env) {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'act-command.cjs'), '--chain', '--from-framework', FW, '--room', roomDir], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, { MINDRIAN_DECISION_ADVISOR: undefined, MINDRIAN_DECISION_ADVISOR_TABLE: undefined }, env),
    timeout: 60000,
  });
  return r.stdout || '';
}

check('W6 behavior (act-command, spawned on a scratch room): the advisor pick shows with a goal job; default and no-job runs are identical', () => {
  const withGoal = makeRoom('act-goal');
  assert.ok(JT.setGoal(withGoal, { jtbd: JOB }), 'fixture: goal written');
  const noGoal = makeRoom('act-nogoal');
  const clean = (s) => s.replace(/\s+/g, ' ');
  const baseOut = runAct(noGoal, {});
  assert.ok(baseOut.includes(CMDS[0]), 'fixture: base run names the first command');
  assert.equal(baseOut.includes(CMDS[3]), false);
  const defOut = runAct(withGoal, { MINDRIAN_DECISION_ADVISOR_TABLE: T_PICK });
  assert.equal(clean(defOut), clean(baseOut), 'advisor unset: byte-identical to a room with no job');
  const advOut = runAct(withGoal, ON(T_PICK));
  assert.ok(advOut.includes(CMDS[3]), 'advisor on with a goal job: the picked command shows');
  assert.equal(/\b\d+\.\d+\b/.test(advOut.replace(/v?\d+\.\d+\.\d+/g, '')) && /0\.9|0\.6/.test(advOut), false, 'no table number in the output');
  const noJobAdv = runAct(noGoal, ON(T_PICK));
  assert.equal(clean(noJobAdv), clean(baseOut), 'advisor on but no job: no change');
});

(async () => {
  await checkAsync('W6 behavior (framework_run handler): job and level reach composeWorkflow; no job gives the base plan', async () => {
    const sensors = require(path.join(ROOT, 'lib', 'mcp', 'tools', 'sensors.cjs'));
    const registered = [];
    const goalRoom = makeRoom('fr-goal');
    JT.setGoal(goalRoom, { jtbd: JOB });
    const bareRoom = makeRoom('fr-bare');
    const prevRoom = process.env.CLAUDE_ACTIVE_ROOM;
    const prevSession = process.env.CLAUDE_CODE_SESSION_ID;
    delete process.env.CLAUDE_CODE_SESSION_ID;
    const run = async (room, env) => {
      process.env.CLAUDE_ACTIVE_ROOM = room;
      const ctx = { fallbackRoomDir: room, surface: 'cli' };
      const srv = { registerTool(name, config, handler) { registered.push({ name, handler }); }, tool() {}, server: { getClientCapabilities() { return {}; } } };
      registered.length = 0;
      sensors.register(srv, ctx);
      const h = registered.find((r) => r.name === 'framework_run').handler;
      return withEnv(env, async () => {
        const res = await h({ chain: [FW] }, {});
        return JSON.parse(res.content[0].text);
      });
    };
    try {
      const base = await run(bareRoom, {});
      assert.equal(base.workflow[0].command, CMDS[0]);
      const def = await run(goalRoom, { MINDRIAN_DECISION_ADVISOR_TABLE: T_PICK });
      assert.deepStrictEqual(def.workflow, base.workflow, 'advisor unset: workflow identical to base');
      const adv = await run(goalRoom, ON(T_PICK));
      assert.equal(adv.workflow[0].command, CMDS[3]);
      assert.equal(adv.workflow[0].command_basis, 'advisor');
      const noJob = await run(bareRoom, ON(T_PICK));
      assert.deepStrictEqual(noJob.workflow, base.workflow, 'advisor on, no job: workflow identical to base');
    } finally {
      if (prevRoom === undefined) delete process.env.CLAUDE_ACTIVE_ROOM; else process.env.CLAUDE_ACTIVE_ROOM = prevRoom;
      if (prevSession !== undefined) process.env.CLAUDE_CODE_SESSION_ID = prevSession;
    }
  });

  console.log(passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
