'use strict';
// Phase 400.5 plan 02 Task 1 (the plan 13 contract, G3 and G10): the one UserPromptSubmit dispatcher gives the host
// the same view as the six separate hooks.
//
//   node tests/test-400.4-dispatch-parity.cjs
//
// P1  CHECKS lists the six ids in check order with the file names, argv and budgets of the old hooks.json entries.
// P2  E1 to E6: hostView of the dispatcher CLI (masked) equals mergeViews of the six separate CLI views (masked).
// P3  E4 (admin block): exit 2, the gate render on stderr byte for byte (masked), no stdout; the merged view blocks.
// P4  dispatch(input) in-process gives the same non-empty context strings, in order, as the separate runs.
// P5  hostView rules of the host (JSON, plain text, parse failure, empty, code 2, code 1, JSON block, trailing space).
// P6  env isolation: a change of process.env by one check is not seen by the next check and is undone after dispatch.
// P7  two 6,000-character contexts: the stderr note context_over_cap 12002, both strings unchanged in the output.
// P8  each script still runs alone: node tests/test-400.4-hook-run-exports.cjs (live mode) exits 0.
//
// Every run uses a fresh fixture copy under the OS temp dir (HOME, MINDRIAN_HOME and MINDRIAN_ROOMS_HOME point at it).
// Hyphens only, no dash characters.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const parity = require(path.join(ROOT, 'tests', 'helpers', 'userprompt-parity-400-4.cjs'));
const { CASES, SCRIPTS, buildCaseFixture, childEnv, maskOutput, runSeparate, runDispatcher } = parity;

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log('PASS ' + name);
  else { failures++; console.log('FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function brief(o) { return JSON.stringify(o).slice(0, 600); }

let d = null;
try { d = require(path.join(ROOT, 'scripts', 'userprompt-dispatch.cjs')); } catch (e) { d = null; check('P1 the dispatcher module loads', false, String(e && e.message || e)); }
if (!d) { console.log('FAILURES: ' + failures); process.exit(1); }

function maskView(v, root) {
  return {
    kind: v.kind,
    context: v.context === null ? null : maskOutput(v.context, root),
    systemMessage: v.systemMessage === null ? null : maskOutput(v.systemMessage, root),
    stop: v.stop,
    stopReason: v.stopReason,
    blockText: v.blockText === null ? null : maskOutput(v.blockText, root),
  };
}
// The host view of the merged separate run, rendered as one process result and read back with the same rules.
function mergedHostView(views) {
  const m = d.mergeViews(views);
  return { m, view: d.hostView({ code: m.code, stdout: m.stdout, stderr: m.block ? m.blockText : '' }) };
}

// ---------- P1 ----------
const WANT = [
  ['admin-command-gate', 'scripts/admin-command-gate.cjs', [], 300],
  ['intent-classifier', 'scripts/intent-classifier.cjs', [], 1800],
  ['first-install-router', 'scripts/first-install-router.cjs', [], 500],
  ['brain-derivation-drain', 'scripts/brain-derivation-drain.cjs', [], 1000],
  ['jtbd-update', 'scripts/jtbd-update.cjs', ['userprompt'], 400],
  ['auto-explore-drain', 'scripts/auto-explore-drain.cjs', [], 900],
];
check('P1 CHECKS ids, files, argv and budgets in check order',
  Array.isArray(d.CHECKS) && same(d.CHECKS.map((c) => [c.id, c.file, c.argv, c.budgetMs]), WANT), brief(d.CHECKS));
check('P1 every CHECKS entry has a load function', Array.isArray(d.CHECKS) && d.CHECKS.every((c) => typeof c.load === 'function'));
check('P1 the CHECKS argv equal the helper SCRIPTS argv (one case list)', same(d.CHECKS.map((c) => [c.id, c.argv]), SCRIPTS.map((s) => [s.id, s.argv])));
check('P1 constants', d.DEADLINE_MS === 2500 && d.OUTPUT_RESERVE_MS === 100 && d.CONTEXT_SEPARATOR === '\n\n' && d.CONTEXT_CAP_CHARS === 10000);

// ---------- P5 ----------
(function legP5() {
  const j = d.hostView({ code: 0, stdout: JSON.stringify({ continue: true, hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: 'ctx  \n' } }), stderr: '' });
  check('P5 one JSON object gives a JSON view (trailing space trimmed)', j.kind === 'json' && j.context === 'ctx', brief(j));
  const jt = d.hostView({ code: 0, stdout: '{"continue":true}\nplain tail\n', stderr: '' });
  check('P5 a JSON object plus a plain line gives the whole stdout as plain text', jt.kind === 'text' && jt.context === '{"continue":true}\nplain tail', brief(jt));
  const bad = d.hostView({ code: 0, stdout: '{bad}', stderr: '' });
  check('P5 {bad} gives nothing', bad.kind === 'none' && bad.context === null, brief(bad));
  const empty = d.hostView({ code: 0, stdout: '', stderr: 'x' });
  check('P5 empty stdout gives nothing', empty.kind === 'none' && empty.context === null);
  const b2 = d.hostView({ code: 2, stdout: 'ignored', stderr: 'blocked text\n' });
  check('P5 code 2 gives a block with the stderr text', b2.kind === 'block' && b2.blockText === 'blocked text\n', brief(b2));
  const c1 = d.hostView({ code: 1, stdout: 'some text', stderr: 'err' });
  check('P5 code 1 gives nothing', c1.kind === 'none' && c1.context === null && c1.blockText === null);
  const jb = d.hostView({ code: 0, stdout: JSON.stringify({ decision: 'block', reason: 'no' }), stderr: '' });
  check('P5 JSON decision block gives a block with the reason', jb.kind === 'block' && jb.blockText === 'no', brief(jb));
  const pt = d.hostView({ code: 0, stdout: 'plain\n\n', stderr: '' });
  check('P5 plain text gives a text view, trailing whitespace trimmed', pt.kind === 'text' && pt.context === 'plain', brief(pt));
  const sm = d.hostView({ code: 0, stdout: JSON.stringify({ continue: false, stopReason: 'r', systemMessage: 's' }), stderr: '' });
  check('P5 systemMessage and continue false are read', sm.systemMessage === 's' && sm.stop === true && sm.stopReason === 'r', brief(sm));
})();

// ---------- P6 and P7 (fake checks, in this process) ----------
function fake(id, runFn) {
  return { id, file: 'fake/' + id, argv: [], budgetMs: 500, load: () => ({ run: runFn }) };
}
async function legP6P7() {
  const before = Object.assign({}, process.env);
  let seen = 'unset-not-checked';
  const r = await d.dispatch('', {
    checks: [
      fake('fake-1', async () => { process.env.P4004_PROBE = 'set-by-1'; return { code: 0, stdout: 'one', stderr: '' }; }),
      fake('fake-2', async () => { seen = process.env.P4004_PROBE === undefined ? 'unset' : 'set'; return { code: 0, stdout: 'two', stderr: '' }; }),
    ],
  });
  check('P6 check 2 does not see the env change of check 1', seen === 'unset', seen);
  check('P6 process.env after dispatch equals process.env before', same(Object.assign({}, process.env), before));
  check('P6 the two outputs join in order', r.envelope && r.envelope.hookSpecificOutput && r.envelope.hookSpecificOutput.additionalContext === 'one\n\ntwo', brief(r.envelope));

  const big1 = 'a'.repeat(6000);
  const big2 = 'b'.repeat(6000);
  const r7 = await d.dispatch('', {
    checks: [
      fake('big-1', async () => ({ code: 0, stdout: big1, stderr: '' })),
      fake('big-2', async () => ({ code: 0, stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: big2 } }), stderr: '' })),
    ],
  });
  check('P7 stderr holds context_over_cap 12002', /context_over_cap 12002: big-1=6000, big-2=6000/.test(r7.stderr), r7.stderr.slice(0, 300));
  check('P7 both strings are in the output unchanged', r7.envelope && r7.envelope.hookSpecificOutput.additionalContext === big1 + '\n\n' + big2);
  check('P7 the over-cap note is in notes', Array.isArray(r7.notes) && r7.notes.some((n) => /^context_over_cap 12002/.test(n)), brief(r7.notes));
}

// ---------- P2, P3, P4 (real scripts, child processes) ----------
const P4_DRIVER = path.join(parity.TMP, 'mos400502-p4-driver-' + process.pid + '.cjs');
fs.writeFileSync(P4_DRIVER, `'use strict';
const fs = require('node:fs');
const d = require(process.argv[2]);
const input = fs.readFileSync(0, 'utf8');
d.dispatch(input, {}).then((r) => {
  fs.writeSync(1, JSON.stringify({ views: r.views.map((x) => ({ id: x.id, outcome: x.outcome, view: x.view, ms: x.ms })), code: r.code }) + '\\n');
  process.exit(0);
}, (e) => { fs.writeSync(1, JSON.stringify({ fatal: String(e && e.stack || e) }) + '\\n'); process.exit(0); });
`);
process.on('exit', () => { try { fs.rmSync(P4_DRIVER, { force: true }); } catch (_e) { /* best effort */ } });

let largestJoined = 0;
function legsReal() {
  for (const c of CASES) {
    const fxA = buildCaseFixture(c);
    const fxB = buildCaseFixture(c);
    const fxC = buildCaseFixture(c);
    try {
      const sep = runSeparate(fxA, c.input(fxA));
      const disp = runDispatcher(fxB, c.input(fxB));
      const sepViews = sep.map((r) => Object.assign({ id: r.id }, d.hostView(r)));
      const { m, view: mergedView } = mergedHostView(sepViews);
      if (!m.block) largestJoined = Math.max(largestJoined, m.joinedLength);
      const dispView = d.hostView(disp);
      const a = maskView(dispView, fxB.root);
      const b = maskView(mergedView, fxA.root);
      check('P2 ' + c.id + ': the dispatcher host view equals the merged separate views', same(a, b), 'dispatcher=' + brief(a) + ' separate=' + brief(b) + ' disp.stderr=' + brief(disp.stderr));
      console.log('TIME ' + c.id + ' dispatcher CLI ' + disp.ms + ' ms; separate ' + sep.map((r) => r.id + '=' + r.ms).join(' '));

      if (c.id === 'E4') {
        const gate = sep[0];
        check('P3 E4: the dispatcher exits 2 with no stdout', disp.code === 2 && disp.stdout === '', brief(disp));
        check('P3 E4: the dispatcher stderr is the gate render byte for byte (masked)', maskOutput(disp.stderr, fxB.root) === maskOutput(gate.stderr, fxA.root) && gate.code === 2,
          'disp=' + brief(disp.stderr) + ' gate=' + brief(gate.stderr));
        check('P3 E4: the merged separate view is a block with the same text', m.block === true && maskOutput(m.blockText, fxA.root) === maskOutput(disp.stderr, fxB.root));
      }

      // P4: dispatch() in-process (inside one child process with the fixture env).
      const res = spawnSync('node', [P4_DRIVER, path.join(ROOT, 'scripts', 'userprompt-dispatch.cjs')], {
        input: c.input(fxC), env: childEnv(fxC), cwd: fxC.cwd, encoding: 'utf8', timeout: 60000,
      });
      let out = null;
      try { out = JSON.parse((res.stdout || '').trim().split('\n').filter(Boolean).pop()); } catch (_e) { out = { fatal: 'no output; ' + (res.stderr || '').slice(0, 300) }; }
      const inProc = out && Array.isArray(out.views) ? out.views.map((x) => x.view).filter((v) => v.context).map((v) => maskOutput(v.context, fxC.root)) : null;
      // The separate list stops after a block, as the dispatcher does.
      const sepList = [];
      for (const v of sepViews) { if (v.kind === 'block') break; if (v.context) sepList.push(maskOutput(v.context, fxA.root)); }
      if (c.id === 'E5' && out && Array.isArray(out.views)) console.log('TIME E5 in-process per check ' + out.views.map((x) => x.id + '=' + x.ms).join(' '));
      check('P4 ' + c.id + ': dispatch() in-process gives the separate non-empty contexts in order', inProc !== null && same(inProc, sepList), 'inproc=' + brief(inProc || out) + ' separate=' + brief(sepList));
    } finally { fxA.cleanup(); fxB.cleanup(); fxC.cleanup(); }
  }
  console.log('LARGEST joined context length over E1 to E6: ' + largestJoined);
}

function legP8() {
  const res = spawnSync('node', [path.join(ROOT, 'tests', 'test-400.4-hook-run-exports.cjs')], { encoding: 'utf8', timeout: 600000 });
  const tail = (res.stdout || '').trim().split('\n').slice(-1)[0];
  check('P8 node tests/test-400.4-hook-run-exports.cjs (live mode) exits 0', res.status === 0, 'status=' + res.status + ' tail=' + tail);
}

(async () => {
  await legP6P7();
  legsReal();
  legP8();
  console.log(failures === 0 ? 'ALL PASS' : 'FAILURES: ' + failures);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.log('FAIL fatal ' + String(e && e.stack || e)); process.exit(1); });
