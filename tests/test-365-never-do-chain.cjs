#!/usr/bin/env node
'use strict';

/*
 * Phase 365-09 -- chain_run honors the room's never-do list.
 *
 * Task 1 (E1..E9): the add-only check inside makeGateFn and the halt reasons
 * on both runChain loop paths.
 * Task 2 (K1..K6): the Shape F halt card shows why, and every other halt
 * carries a pre-filled proposal (appended below by the second task).
 *
 * Exit: 0 PASS, 1 FAIL. No em-dashes (dash characters are spelled as escapes).
 */

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
const net = hygiene.installNetGuard();

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const exec = require(path.join(REPO_ROOT, 'lib', 'core', 'chain-executor.cjs'));
const rc = require(path.join(REPO_ROOT, 'lib', 'core', 'room-constraints.cjs'));

let hardFail = 0;
function check(label, cond, detail) {
  try {
    assert.ok(cond, label);
    process.stdout.write('  ok - ' + label + '\n');
  } catch (_e) {
    hardFail += 1;
    process.stdout.write('  FAIL - ' + label + (detail ? ' :: ' + detail : '') + '\n');
  }
}

const VIA = { surface: 'cli', decision_node_id: 'decision-365-test' };
function entry(kind, value, why) {
  return { kind, value, why: why === undefined ? 'a plain reason' : why, approved_via: VIA, approved_at: '2026-10-01T00:00:00.000Z' };
}
const rooms = [];
function room() {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), 'nd365-chain-'));
  rooms.push(r);
  return r;
}
function putFile(r, entries, raw) {
  fs.mkdirSync(path.join(r, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(r, '.mindrian', 'never-do.json'),
    raw !== undefined ? raw : JSON.stringify({ schema: 'mos.room-constraints/1', entries }), 'utf8');
}
function tripLines(r) {
  const p = path.join(r, '.mindrian', 'constraint-trips.jsonl');
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

const registry = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'data', 'command-registry.json'), 'utf8'));
const safeCmds = registry.commands.filter((c) => c && c.autonomous_safe === true && typeof c.command === 'string').map((c) => c.command);
const materialCmd = registry.commands.filter((c) => c && c.autonomous_safe !== true && typeof c.command === 'string')
  .map((c) => c.command).find((c) => !exec.isIrreversibleStep({ command: c }));
assert.ok(safeCmds.length >= 2 && materialCmd, 'FIXTURE: registry has safe and material commands');

const SAFE_POSTURE = () => ({ autonomous_safe: true, posture: 'run' });
const executedLog = [];
async function stubOnStep(step) {
  executedLog.push(step.command);
  return { chain_output: { ran: step.command }, quality: 'high' };
}
function mkSteps(cmds) {
  return cmds.map((c, i) => ({ step: i + 1, framework: 'fixture-' + (i + 1), command: c, optional: false }));
}

(async () => {
  // ---- E1 first statement still pinned; irreversible reports forced_material ---
  {
    const text = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'core', 'chain-executor.cjs'), 'utf8');
    const lines = text.split('\n');
    const mk = lines.findIndex((l) => l.startsWith('function makeGateFn('));
    const g = lines.findIndex((l, i) => i > mk && /return function gateFn\(/.test(l));
    let first = null;
    for (let i = g + 1; i < lines.length; i += 1) {
      const t = lines[i].trim();
      if (t === '' || t.startsWith('//')) continue;
      first = t;
      break;
    }
    check('E1 gateFn first statement is still the irreversible check', first === "if (isIrreversibleStep(step)) return 'halt';", String(first));

    const r = room();
    putFile(r, [entry('command', safeCmds[0])]);
    const out = await exec.runChain([{ step: 1, framework: 'irr', command: safeCmds[0], irreversible: true }], {
      onStep: stubOnStep, roomDir: r, postureFn: SAFE_POSTURE,
    });
    check('E1 an irreversible step that is also named reports forced_material',
      out.haltedAt && out.haltedAt.reason === 'forced_material' && !out.haltedAt.constraint, JSON.stringify(out.haltedAt && out.haltedAt.reason));
    check('E1 an irreversible step records no constraint trip', tripLines(r).length === 0);
  }

  // ---- E2 resilient path: a named autonomous_safe step halts -------------------
  {
    const r = room();
    putFile(r, [entry('command', safeCmds[1], 'No unattended runs of this one.')]);
    executedLog.length = 0;
    const out = await exec.runChain(mkSteps([safeCmds[0], safeCmds[1]]), {
      onStep: stubOnStep, roomDir: r, postureFn: SAFE_POSTURE,
    });
    check('E2 the chain halts at the named step', out.completed === false && out.haltedAt && out.haltedAt.step.command === safeCmds[1]);
    check('E2 the step before it ran, the named step did not', executedLog.length === 1 && executedLog[0] === safeCmds[0]);
    check('E2 haltedAt.reason is constraint_named', out.haltedAt.reason === 'constraint_named');
    check('E2 haltedAt.constraint carries kind, value, why',
      out.haltedAt.constraint && out.haltedAt.constraint.kind === 'command'
      && out.haltedAt.constraint.value === safeCmds[1] && out.haltedAt.constraint.why === 'No unattended runs of this one.');
  }

  // ---- E3 sync path: gateFn built with roomDir ---------------------------------
  {
    const r = room();
    putFile(r, [entry('command', safeCmds[0])]);
    const gateFn = exec.makeGateFn({ roomDir: r, postureFn: SAFE_POSTURE });
    const out = exec.runChain(mkSteps([safeCmds[0]]), { onStep: stubOnStep, gateFn, onHalt: () => 'defer' });
    check('E3 the sync path stays synchronous (no roomDir in runChain opts)', out && typeof out.then !== 'function');
    check('E3 the sync path reports constraint_named',
      out.haltedAt && out.haltedAt.reason === 'constraint_named' && out.haltedAt.constraint.value === safeCmds[0]);
  }

  // ---- E4 malformed file: every step halts ------------------------------------
  {
    const r = room();
    putFile(r, null, '{ not json');
    executedLog.length = 0;
    const out = await exec.runChain(mkSteps([safeCmds[0]]), { onStep: stubOnStep, roomDir: r, postureFn: SAFE_POSTURE });
    check('E4 a malformed list halts a step that would otherwise run',
      out.completed === false && executedLog.length === 0 && out.haltedAt.reason === 'constraints_malformed');
    check('E4 a malformed halt carries no constraint entry', !out.haltedAt.constraint);
  }

  // ---- E5 no file / no roomDir: identical to the base gate ---------------------
  {
    const r = room();
    const base = exec.makeGateFn({ postureFn: SAFE_POSTURE });
    const withRoom = exec.makeGateFn({ roomDir: r, postureFn: SAFE_POSTURE });
    const steps = [
      { command: safeCmds[0] },
      { command: materialCmd },
      { command: safeCmds[0], irreversible: true },
    ];
    const same = steps.every((s) => base(s, null, null) === withRoom(s, null, null)
      && base(s, null, { quality: 'low' }) === withRoom(s, null, { quality: 'low' }));
    check('E5 no never-do file: the gate returns what the base gate returns', same);
    check('E5 an autonomous_safe step still runs with no file', withRoom({ command: safeCmds[0] }, null, null) === 'run');
    putFile(r, [entry('command', safeCmds[0])]);
    const noRoomDir = exec.makeGateFn({ postureFn: SAFE_POSTURE });
    check('E5 a list on disk is ignored when no roomDir is given', noRoomDir({ command: safeCmds[0] }, null, null) === 'run');
    const defaultPosture = exec.makeGateFn({ roomDir: r });
    check('E5 an absent-file room gate matches the base gate under the default posture',
      exec.makeGateFn({})({ command: materialCmd }, null, null) === exec.makeGateFn({ roomDir: room() })({ command: materialCmd }, null, null)
      && defaultPosture({ command: safeCmds[1] }, null, null) === exec.makeGateFn({})({ command: safeCmds[1] }, null, null));
    check('E5 no trip line for a pass', tripLines(r).length === 0);
  }

  // ---- E6 add-only -------------------------------------------------------------
  {
    const r = room();
    putFile(r, [entry('command', '/mos:something-else-entirely')]);
    const gate = exec.makeGateFn({ roomDir: r });
    check('E6 a posture-halted step the list does not name still halts', gate({ command: materialCmd }, null, null) === 'halt');
    const out = await exec.runChain(mkSteps([materialCmd]), { onStep: stubOnStep, roomDir: r });
    check('E6 that halt keeps the reason gate_halt and no constraint',
      out.haltedAt && out.haltedAt.reason === 'gate_halt' && !out.haltedAt.constraint, JSON.stringify(out.haltedAt && out.haltedAt.reason));
    // Exhaustive: for every posture/list combination, the gate with a list never returns 'run'
    // when the gate without a list returns 'halt'.
    const postures = [null, { autonomous_safe: false, posture: 'halt' }, { autonomous_safe: true, posture: 'run' }];
    const lists = [[], [entry('command', safeCmds[0])], [entry('section', 'x')]];
    const rs = lists.map((l) => { const d = room(); putFile(d, l); return d; });
    let bad = 0;
    rs.forEach((d) => {
      [safeCmds[0], materialCmd].forEach((cmd) => postures.forEach((p) => {
        const without = exec.makeGateFn({ postureFn: SAFE_POSTURE })({ command: cmd }, p, null);
        const withList = exec.makeGateFn({ roomDir: d, postureFn: SAFE_POSTURE })({ command: cmd }, p, null);
        if (without === 'halt' && withList === 'run') bad += 1;
      }));
    });
    check('E6 no input turns a base halt into a run', bad === 0);
  }

  // ---- E7 fresh read between two runs -----------------------------------------
  {
    const r = room();
    putFile(r, []);
    executedLog.length = 0;
    const a = await exec.runChain(mkSteps([safeCmds[0]]), { onStep: stubOnStep, roomDir: r, postureFn: SAFE_POSTURE });
    putFile(r, [entry('command', safeCmds[0])]);
    const b = await exec.runChain(mkSteps([safeCmds[0]]), { onStep: stubOnStep, roomDir: r, postureFn: SAFE_POSTURE });
    check('E7 the first run (empty list) completes, the second (edited list) halts',
      a.completed === true && b.completed === false && b.haltedAt.reason === 'constraint_named');
    putFile(r, []);
    const c = await exec.runChain(mkSteps([safeCmds[0]]), { onStep: stubOnStep, roomDir: r, postureFn: SAFE_POSTURE });
    check('E7 emptying the list is seen too (no stale verdict on a reused step object)', c.completed === true);
    const reused = { step: 1, framework: 'reuse', command: safeCmds[0] };
    const g = exec.makeGateFn({ roomDir: r, postureFn: SAFE_POSTURE });
    putFile(r, [entry('command', safeCmds[0])]);
    g(reused, null, null);
    putFile(r, []);
    g(reused, null, null);
    const o2 = await exec.runChain([reused], { onStep: stubOnStep, gateFn: () => 'halt', onHalt: () => 'defer' });
    check('E7 a passed check clears the recorded verdict (the halt falls back to gate_halt)',
      o2.haltedAt.reason === 'gate_halt' && !o2.haltedAt.constraint);
  }

  // ---- E8 trips ----------------------------------------------------------------
  {
    const r = room();
    putFile(r, [entry('command', safeCmds[0], 'private reason text')]);
    await exec.runChain(mkSteps([safeCmds[0]]), { onStep: stubOnStep, roomDir: r, postureFn: SAFE_POSTURE, runId: 'run-365-e8' });
    const t = tripLines(r);
    check('E8 one trip line per constraint halt', t.length === 1);
    check('E8 the trip carries surface, reason, kind, value, step_command, run_id',
      t[0] && t[0].surface === 'chain_run' && t[0].reason === 'constraint_named' && t[0].kind === 'command'
      && t[0].value === safeCmds[0] && t[0].step_command === safeCmds[0] && t[0].run_id === 'run-365-e8', JSON.stringify(t[0]));
    check('E8 the why is never in the trip', !/private reason text/.test(JSON.stringify(t)));
    const r2 = room();
    putFile(r2, null, 'nope');
    await exec.runChain(mkSteps([safeCmds[0]]), { onStep: stubOnStep, roomDir: r2, postureFn: SAFE_POSTURE });
    check('E8 a malformed halt is recorded too', tripLines(r2).length === 1 && tripLines(r2)[0].reason === 'constraints_malformed');
  }

  // ---- E9 a path entry matches the registry produces ---------------------------
  // Today the only registry command that declares a produced path is irreversible
  // (halts first, for its own reason), so the registry join is stubbed on the
  // dispatcher for one fixture command; room-constraints reads it through the
  // module property, the same call it makes in production.
  {
    const dispatcher = require(path.join(REPO_ROOT, 'lib', 'core', 'chain-step-dispatcher.cjs'));
    const realResolve = dispatcher.resolveExecutable;
    dispatcher.resolveExecutable = function (cmd) {
      if (cmd === '/mos:fixture-producer') return { produces: 'exports/fixture/out.md' };
      return realResolve.apply(this, arguments);
    };
    try {
      const real = rc.declaredFieldsOfChainStep({ command: '/mos:snapshot' }, {});
      check('E9 FIXTURE: the real registry declares a produced path for /mos:snapshot', real.path === 'exports/hub.html', String(real.path));
      const r = room();
      putFile(r, [entry('path', 'exports')]);
      const step = { step: 1, framework: 'fx', command: '/mos:fixture-producer' };
      const gate = exec.makeGateFn({ roomDir: r, postureFn: SAFE_POSTURE });
      check('E9 a path entry halts a step whose produces sits under it', gate(step, null, null) === 'halt');
      const out = await exec.runChain([step], { onStep: stubOnStep, roomDir: r, postureFn: SAFE_POSTURE });
      check('E9 the halt names constraint_named with kind path',
        out.haltedAt.reason === 'constraint_named' && out.haltedAt.constraint.kind === 'path' && out.haltedAt.constraint.value === 'exports');
      const d = room();
      putFile(d, [entry('path', 'export')]);
      check('E9 a sibling path (export vs exports) does not match',
        exec.makeGateFn({ roomDir: d, postureFn: SAFE_POSTURE })(step, null, null) === 'run');
    } finally {
      dispatcher.resolveExecutable = realResolve;
    }
  }

  // <!-- task-2-tests -->

  check('the run made no network attempt', net.attempts() === 0);
  rooms.forEach((r) => { try { fs.rmSync(r, { recursive: true, force: true }); } catch (_e) { /* best effort */ } });
  net.restore();

  if (hardFail > 0) {
    process.stdout.write('FAIL: ' + hardFail + ' check(s) failed\n');
    process.exit(1);
  }
  process.stdout.write('PASS: test-365-never-do-chain\n');
  process.exit(0);
})().catch((e) => {
  process.stdout.write('FAIL: test-365-never-do-chain -- ' + (e && e.stack || e) + '\n');
  process.exit(1);
});
