#!/usr/bin/env node
'use strict';
// Phase 395-07b: the fix commit for the cold check of commit e1f2faff2 (plan 395-07). Plain Node script.
// Exit 0 when all checks pass, 1 when one fails. One line per check: "ok:" or "FAIL:".
//
// T1, T2  MA1: when a ceiling cut a nest file, the blocks of the brief read the whole file, so no block says
//         "none recorded" or "no what-changed entry" for a part after the cut; the next move is still chosen from the
//         part the per-turn selector reads.
// T3, T4  mi1: a ledger row under the confidence floor is named as a rating that is not sure enough to count, never
//         as "no rating". T3 uses a ledger document of its own (no plugin data). T4 reads the plugin ledger.
// T5      mi2: the gate does not take explore as a goal job on change-rung either.
// T6      mi3: over the run ceiling, the brief says that its run count is of the runs read, and how "newest" is ordered.
// T7      mi4: a brief that is stale only because the order mark moved says that no nest file changed.
// T8      mi6: no alternative carries the sentence about the first command of Theo.
// T9      mi6: the order mark is the same in 2 child processes (a mark that changes per process rewrites every brief).
// T10     mi6: the fit levels and the unsure rows from a ledger document of its own, so the rule does not depend on the
//         plugin ledger (check B2 of tests/test-395-truth-and-cost.cjs reads the plugin ledger).
// T11     the order mark moved from 395-07, so a brief written under 395-07 is rewritten 1 time.
// T12     no em dash or en dash in the files of this plan.
//
// Every room is a born fixture room under an isolated temporary home (tests/helpers/isolated-home-36925.cjs). The test
// stops before any room work when the room is not under that home. No network.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const H = require('./helpers/isolated-home-36925.cjs');

const SEC = 'problem-definition';
const OTHER = 'market-analysis';
const A = 'zz-alpha-395';
const Z = 'zz-beta-395';
const JOB = 'validate-idea';
const NOW = () => '2026-01-01T00:00:00Z';

let failed = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log('ok: ' + name);
  } catch (e) {
    failed += 1;
    console.log('FAIL: ' + name + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}

const NM = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'next-move.cjs'));

// Every name is a known runnable command. A and Z are in no registry, so no job key and no MINTO key reaches them.
const capabilityStub = (instructionOnly) => (n) => ({ known: true, cli: 'runnable', mcp: (instructionOnly || []).indexOf(n) !== -1 ? 'instruction-only' : 'runnable', label: 'runnable (test)' });
const face = (names) => ({ asked: true, commands: names.map((n) => ({ name: n, cli: 'runnable', mcp: 'runnable' })) });
const src = (contract, table) => ({ contract: { names: contract || [] }, navigator_table: { names: table || [] } });
const led = (names) => [{ source: 'section_ledger', items: names.map((n) => ({ id: n, confidence: null, source: 'ground-truth' })) }];
function compose(extra) {
  return NM.composeNextMove(Object.assign({ surface: 'mcp', face: { asked: false, commands: [] }, ledgerCandidates: null, attempted: [], need: {}, capabilityFor: capabilityStub([]) }, extra));
}
function theoPart(why, top) {
  const head = '; Theo ranked ' + top + ' first, but ';
  const at = String(why).indexOf(head);
  if (at === -1) return null;
  return String(why).slice(at + head.length).replace(/; instruction-only on this surface$/, '');
}
function ledgerOf(job, rows) {
  return { confidence_floor: 0.3, built_at: '2020-01-01T00:00:00.000Z', rows: { [job + '|*|*']: rows } };
}
function block(text, heading) {
  const lines = String(text).split('\n');
  const i = lines.indexOf(heading);
  if (i === -1) return null;
  const out = [];
  for (let k = i + 1; k < lines.length && !/^## /.test(lines[k]); k++) out.push(lines[k]);
  return out.join('\n').trim();
}
function runId(i) {
  return 'rp-2026-' + String(1 + (i % 12)).padStart(2, '0') + '-' + String(1 + (i % 28)).padStart(2, '0') + '-' + i.toString(16).padStart(8, '0');
}
function addRun(roomDir, i, section) {
  const dir = path.join(roomDir, '.mindrian', 'research-runs', runId(i));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'plan.json'), JSON.stringify({ run_id: runId(i), return_target: { section: section } }), 'utf8');
}
// A filler line that is not a heading and not a bullet, to push a nest file over the byte ceiling.
function filler(bytes) {
  const line = 'Filler line of a long note, not a heading and not a bullet.\n';
  return line.repeat(Math.ceil(bytes / line.length));
}

async function main() {
  // ---- the fixture room ----
  const iso = H.mkIsolatedHome('395fix');
  const born = H.birthFixtureRoom({ iso, slug: 'truthfix', vname: 'Quokka Labs', ventureText: 'Quokka Labs onboarding platform' });
  if (!born || born.ok !== true) throw new Error('fixture birth failed: ' + JSON.stringify(born));
  const roomDir = fs.realpathSync(born.roomDir);
  if (roomDir.indexOf(fs.realpathSync(iso.home) + path.sep) !== 0) throw new Error('the room is not under the isolated home: ' + roomDir);
  const sectionPath = path.join(roomDir, SEC);
  const B = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'brief.cjs'));
  const F = require(path.join(ROOT, 'lib', 'memory', 'triple-context-formatter.cjs'));
  const goalGate = require(path.join(ROOT, 'lib', 'core', 'strategy', 'goal-gate.cjs'));
  const jtbdState = require(path.join(ROOT, 'lib', 'hmi', 'jtbd-state.cjs'));
  const generator = require(path.join(ROOT, 'scripts', 'vault-section-minto-generator.cjs'));
  const max = NM.MAX_NEST_FILE_BYTES;

  // ---- T1, T2. MA1 ----
  await check('T1. MINTO.md over the ceiling, with an assumption and counterevidence after the cut: the BUT block shows both', () => {
    const minto = path.join(sectionPath, 'MINTO.md');
    assert.strictEqual(fs.existsSync(minto), false, 'precondition: a born nest has no MINTO.md');
    const head = '---\ngoverning_thought: "Teams lose a week to onboarding."\n---\n# problem-definition\n\n## Notes\n\n';
    const tail = '\n## Assumptions\n\n- Buyers pay for speed (validity: unknown)\n\n## Counterevidence\n\n- A pilot showed no lift in onboarding speed\n';
    fs.writeFileSync(minto, head + filler(max) + tail, 'utf8');
    try {
      assert.ok(fs.statSync(minto).size > max + tail.length, 'the assumption and the counterevidence are after the cut');
      const cutNest = NM.gatherNest({ roomDir, sectionDir: sectionPath });
      assert.deepStrictEqual(cutNest.cut, ['MINTO.md'], 'the per-turn read is still cut');
      assert.deepStrictEqual(cutNest.need, { counterevidence: 0, assumptions: 0 }, 'the per-turn read does not see the tail');
      const wholeNest = NM.gatherNest({ roomDir, sectionDir: sectionPath, wholeFiles: true });
      assert.deepStrictEqual(wholeNest.cut, [], 'the whole read cuts nothing');
      assert.deepStrictEqual(wholeNest.need, { counterevidence: 1, assumptions: 1 });
      const text = B.renderBrief({ sectionPath, roomDir, now: NOW });
      const but = block(text, '## BUT');
      assert.ok(but.indexOf('Weakest assumption: Buyers pay for speed (unknown)') === 0, but);
      assert.ok(but.indexOf('- A pilot showed no lift in onboarding speed') !== -1, but);
      assert.ok(but.indexOf('none recorded') === -1, but);
      assert.ok(text.indexOf('; to choose the next move, these files were read only in part (first ' + max + ' bytes): MINTO.md; the blocks of this brief read them whole') !== -1, 'RECORD BASIS says what the next move was chosen from');
      // The next move of the brief is the move of the per-turn selector, which reads the cut file.
      const pair = { cli: NM.nextMoveForSection({ roomDir, sectionDir: sectionPath, surface: 'cli' }), mcp: NM.nextMoveForSection({ roomDir, sectionDir: sectionPath, surface: 'mcp' }) };
      const given = B.renderBrief({ sectionPath, roomDir, now: NOW, nextMove: pair });
      assert.strictEqual(block(text, '## PROPOSED NEXT MOVE'), block(given, '## PROPOSED NEXT MOVE'), 'the brief move equals the per-turn move');
      const realNext = NM.nextMoveForSection;
      const seen = [];
      NM.nextMoveForSection = function (a) { seen.push(a && a.nest ? { cut: a.nest.cut, need: a.nest.need } : null); return realNext.apply(this, arguments); };
      try { B.renderBrief({ sectionPath, roomDir, now: NOW }); } finally { NM.nextMoveForSection = realNext; }
      assert.deepStrictEqual(seen, [0, 1].map(() => ({ cut: ['MINTO.md'], need: { counterevidence: 0, assumptions: 0 } })), 'the brief gives the selector the nest as the per-turn read sees it, on both surfaces');
    } finally {
      fs.unlinkSync(minto);
    }
  });

  await check('T2. FEYNMAN.md over the ceiling, with a what-changed entry after the cut: the WHAT CHANGED block shows it', () => {
    const feynman = path.join(sectionPath, 'FEYNMAN.md');
    const original = fs.readFileSync(feynman, 'utf8');
    const marker = 'Seeded at birth';
    assert.ok(original.indexOf(marker) !== -1, 'precondition: the born FEYNMAN.md has its seed line');
    const changed = original.replace(marker, filler(max) + marker).replace('- Nothing yet: this nest was just created.', '- MINTO.md gained an assumption about buyers');
    fs.writeFileSync(feynman, changed, 'utf8');
    try {
      assert.deepStrictEqual(NM.gatherNest({ roomDir, sectionDir: sectionPath }).cut, ['FEYNMAN.md']);
      const text = B.renderBrief({ sectionPath, roomDir, now: NOW });
      const what = block(text, '## WHAT CHANGED');
      assert.strictEqual(what, '- MINTO.md gained an assumption about buyers', what);
      assert.ok(text.indexOf('read only in part (first ' + max + ' bytes): FEYNMAN.md') !== -1, 'the note of check F2 of tests/test-395-truth-and-cost.cjs is kept');
    } finally {
      fs.writeFileSync(feynman, original, 'utf8');
    }
    const text = B.renderBrief({ sectionPath, roomDir, now: NOW });
    assert.ok(text.indexOf('read only in part') === -1, 'a nest under the ceiling has no note');
  });

  // ---- T3, T4. mi1 ----
  await check('T3. a row under the confidence floor is "not sure enough to count"; a command with no row has "no rating"', () => {
    const strongVsUnsure = compose({ jobId: JOB, ledgerDoc: ledgerOf(JOB, [{ command: '/mos:' + A, score: 1.9, confidence: 0.9 }, { command: '/mos:' + Z, score: 1.42, confidence: 0.22 }]), face: face([Z]), sources: src([A, Z], []) });
    assert.strictEqual(strongVsUnsure.primary.command, A);
    assert.strictEqual(theoPart(strongVsUnsure.why, Z), 'the ledger rates this command higher for the job (a strong first move; the ledger rating for ' + Z + ' is not sure enough to count)');
    const strongVsNone = compose({ jobId: JOB, ledgerDoc: ledgerOf(JOB, [{ command: '/mos:' + A, score: 1.9, confidence: 0.9 }]), face: face([Z]), sources: src([A, Z], []) });
    assert.strictEqual(theoPart(strongVsNone.why, Z), 'the ledger rates this command higher for the job (a strong first move; the ledger has no rating for ' + Z + ')');
    const poorVsUnsure = compose({ jobId: JOB, ledgerDoc: ledgerOf(JOB, [{ command: '/mos:' + Z, score: 0.21, confidence: 0.68 }, { command: '/mos:' + A, score: 1.46, confidence: 0.2 }]), face: face([Z]), sources: src([Z, A], []) });
    assert.strictEqual(poorVsUnsure.primary.command, A);
    assert.strictEqual(theoPart(poorVsUnsure.why, Z), 'the ledger rates ' + Z + ' as a poor first move for the job, and its rating for this command is not sure enough to count');
    const poorVsNone = compose({ jobId: JOB, ledgerDoc: ledgerOf(JOB, [{ command: '/mos:' + Z, score: 0.21, confidence: 0.68 }]), face: face([Z]), sources: src([Z, A], []) });
    assert.strictEqual(theoPart(poorVsNone.why, Z), 'the ledger rates ' + Z + ' as a poor first move for the job, and has no rating for this command');
    const noConfidence = compose({ jobId: JOB, ledgerDoc: ledgerOf(JOB, [{ command: '/mos:' + Z, score: 0.21, confidence: 0.68 }, { command: '/mos:' + A, score: 1.46, source: 'framework-matched' }]), face: face([Z]), sources: src([Z, A], []) });
    assert.strictEqual(theoPart(noConfidence.why, Z), 'the ledger rates ' + Z + ' as a poor first move for the job, and its rating for this command is not sure enough to count', 'a row with no confidence that is not ground truth does not count');
  });

  await check('T4. the 2 cases of the cold check, read from the plugin ledger and the real registry', () => {
    const L = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'section-command-ledger.json'), 'utf8'));
    const row = (job, cmd) => (L.rows[job + '|*|*'] || []).find((r) => r.command === '/mos:' + cmd) || null;
    const floor = L.confidence_floor;
    const st = row('find-bottleneck', 'systems-thinking');
    const fb = row('find-bottleneck', 'find-bottlenecks');
    const sc = row('understand-market', 'scout');
    const at = row('understand-market', 'analyze-timing');
    const same = st && fb && sc && at && st.confidence < floor && fb.confidence >= floor && fb.score >= 1.5 && sc.confidence >= floor && sc.score < 0.5 && at.confidence < floor;
    if (!same) { console.log('note: T4 found the plugin ledger rebuilt; check T3 holds the rule with a ledger of its own'); return; }
    const one = NM.composeNextMove({ surface: 'cli', jobId: 'find-bottleneck', face: face(['systems-thinking', 'find-bottlenecks']), sources: null, ledgerCandidates: null, attempted: [], need: {} });
    assert.strictEqual(one.primary.command, 'find-bottlenecks');
    assert.strictEqual(theoPart(one.why, 'systems-thinking'), 'the ledger rates this command higher for the job (a strong first move; the ledger rating for systems-thinking is not sure enough to count)');
    const two = NM.composeNextMove({ surface: 'cli', jobId: 'understand-market', face: face(['scout', 'analyze-timing']), sources: null, ledgerCandidates: null, attempted: [], need: {} });
    assert.strictEqual(two.primary.command, 'analyze-timing');
    assert.strictEqual(theoPart(two.why, 'scout'), 'the ledger rates scout as a poor first move for the job, and its rating for this command is not sure enough to count');
  });

  // ---- T5. mi2 ----
  await check('T5. change-rung to the job explore is refused like rewrite-jtbd; change-rung with a ranking job still writes', () => {
    const dir = fs.mkdtempSync(path.join(iso.home, 'rung-'));
    assert.ok(jtbdState.setGoal(dir, { jtbd: JOB, rung: 'WellDefined' }));
    const card = (jtbd) => ({ kind: 'strategy_goal', options: [{ id: 'keep', label: 'Keep' }, { id: 'change-rung', label: 'Change the problem type', preview: JSON.stringify({ jtbd: jtbd, rung: 'IllDefined' }) }, { id: 'defer', label: 'Not now' }] });
    const refused = goalGate.ratifyGoalProposal(null, dir, { card: card('explore'), chosen: ['change-rung'], verdict: 'approve' });
    assert.strictEqual(refused.ok, true, JSON.stringify(refused));
    assert.strictEqual(refused.goal_written, false, JSON.stringify(refused));
    assert.strictEqual(refused.reason, 'goal_job_does_not_rank');
    assert.strictEqual(jtbdState.getGoal(dir).jtbd, JOB, 'the stored goal stays');
    assert.strictEqual(jtbdState.getGoal(dir).rung, 'WellDefined', 'the stored rung stays');
    const taken = goalGate.ratifyGoalProposal(null, dir, { card: card(JOB), chosen: ['change-rung'], verdict: 'approve' });
    assert.strictEqual(taken.goal_written, true, JSON.stringify(taken));
    assert.strictEqual(jtbdState.getGoal(dir).rung, 'IllDefined');
  });

  // ---- T6. mi3 ----
  await check('T6. over the run ceiling the run line says that its count is of the runs read, and how newest is ordered', () => {
    const say = 'that count is of the runs that were read, and newest goes by the date in the run name (runs of the same day go by name, not by time)';
    for (let i = 0; i < NM.MAX_RUNS_READ; i++) addRun(roomDir, i, i % 2 === 0 ? SEC : OTHER);
    let text = B.renderBrief({ sectionPath, roomDir, now: NOW });
    assert.ok(text.indexOf(say) === -1, 'no note at the ceiling');
    for (let i = NM.MAX_RUNS_READ; i < NM.MAX_RUNS_READ + 30; i++) addRun(roomDir, i, i % 2 === 0 ? SEC : OTHER);
    const nest = NM.gatherNest({ roomDir, sectionDir: sectionPath });
    text = B.renderBrief({ sectionPath, roomDir, now: NOW });
    assert.ok(text.indexOf(nest.runs.length + ' research runs for this nest; only the newest ' + NM.MAX_RUNS_READ + ' runs of the room were read, 30 older runs were not; ' + say) !== -1, text.split('\n').filter((l) => l.indexOf('run records') !== -1).join(' '));
    assert.ok(nest.runs.length < 40, 'the nest has 40 runs, and fewer are read: ' + nest.runs.length);
    fs.rmSync(path.join(roomDir, '.mindrian', 'research-runs'), { recursive: true, force: true });
  });

  // ---- T7. mi4 ----
  await check('T7. a brief stale only by the order mark says that no nest file changed; a changed file does not get that sentence', () => {
    const note = 'No file of this nest changed: only the rules or the ratings that put the next move in order changed, so the proposed next move can differ';
    const realMark = NM.selectorMark;
    NM.selectorMark = () => 'order 395-04, ledger built 2020-01-01T00:00:00.000Z';
    try { generator.renderBriefForSection(roomDir, sectionPath); } finally { NM.selectorMark = realMark; }
    const markOnly = F.assembleBriefHead({ roomDir, section: SEC });
    assert.strictEqual(markOnly.state, 'stale');
    assert.strictEqual(markOnly.reason, 'the selector order or the ledger changed');
    assert.ok(markOnly.head.indexOf('stale: inputs changed since this brief was written (the selector order or the ledger changed). ' + note) !== -1, markOnly.head);
    const room = path.join(sectionPath, 'ROOM.md');
    const original = fs.readFileSync(room, 'utf8');
    fs.writeFileSync(room, original + '\nA new line.\n', 'utf8');
    try {
      const both = F.assembleBriefHead({ roomDir, section: SEC });
      assert.strictEqual(both.state, 'stale');
      assert.ok(both.head.indexOf('ROOM.md') !== -1, both.head);
      assert.ok(both.head.indexOf(note) === -1, 'a changed nest file does not get the sentence: ' + both.head);
    } finally {
      fs.writeFileSync(room, original, 'utf8');
    }
    generator.renderBriefForSection(roomDir, sectionPath);
    const fresh = F.assembleBriefHead({ roomDir, section: SEC });
    assert.strictEqual(fresh.state, 'fresh', JSON.stringify(fresh.reason));
    assert.ok(String(fresh.head).indexOf(note) === -1);
  });

  // ---- T8. mi6, mutation M27 of the cold check ----
  await check('T8. no alternative carries the sentence about the first command of Theo, on a grid of compositions', () => {
    let alternatives = 0;
    const names = [A, Z, 'zz-gamma-395'];
    [null, JOB].forEach((jobId) => [[A], [Z], ['zz-gamma-395']].forEach((f) => [[], [A], [Z, A], names].forEach((contract) => [[], [A], [Z, A]].forEach((ledger) => [[], [A], [Z]].forEach((instr) => {
      const m = compose({ jobId, ledgerDoc: ledgerOf(JOB, []), face: face(f), sources: src(contract, []), ledgerCandidates: ledger.length > 0 ? led(ledger) : null, capabilityFor: capabilityStub(instr) });
      m.alternatives.forEach((alt) => { alternatives += 1; assert.strictEqual(alt.why.indexOf('Theo ranked '), -1, JSON.stringify({ jobId, f, contract, ledger, instr }) + ' ' + alt.why); });
    })))));
    assert.ok(alternatives >= 100, 'the grid reaches alternatives: ' + alternatives);
  });

  // ---- T9. mi6, mutation M36 of the cold check ----
  await check('T9. the order mark is the same in 2 child processes and in this process', () => {
    const script = 'process.stdout.write(require(process.argv[1]).selectorMark());';
    const file = path.join(ROOT, 'lib', 'core', 'feyminto', 'next-move.cjs');
    const marks = [0, 1].map(() => {
      const r = spawnSync(process.execPath, ['-e', script, file], { env: iso.env, encoding: 'utf8', timeout: 20000 });
      assert.strictEqual(r.status, 0, r.stderr);
      return r.stdout;
    });
    assert.strictEqual(marks[0], marks[1]);
    assert.strictEqual(marks[0], NM.selectorMark());
  });

  // ---- T10. mi6, the fit rule with a ledger of its own ----
  await check('T10. levels and unsure rows from a ledger document of its own: limits 0.5 and 1.5, floor 0.3', () => {
    const doc = ledgerOf(JOB, [
      { command: '/mos:a', score: 0.49, confidence: 0.3 },
      { command: '/mos:b', score: 0.5, confidence: 0.9 },
      { command: '/mos:c', score: 1.49, confidence: 0.9 },
      { command: '/mos:d', score: 1.5, confidence: 0.9 },
      { command: '/mos:e', score: 1.9, confidence: 0.29 },
      { command: '/mos:f', score: 1.9, source: 'ground-truth' },
      { command: '/mos:g', score: 0.1, source: 'framework-matched' },
      { command: '/mos:h', confidence: 0.9 },
    ]);
    const r = NM.ledgerRating(JOB, doc);
    assert.deepStrictEqual(Object.fromEntries(r.fit), { a: 0, b: 1, c: 1, d: 2, f: 2 });
    assert.deepStrictEqual(Array.from(r.unsure).sort(), ['e', 'g']);
    assert.deepStrictEqual(Object.fromEntries(NM.jobFitFor(JOB, doc)), { a: 0, b: 1, c: 1, d: 2, f: 2 }, 'jobFitFor gives the same levels');
    assert.strictEqual(NM.ledgerRating('other-job', doc).fit.size, 0, 'another job has no rows');
    const both = NM.ledgerRating(JOB, ledgerOf(JOB, [{ command: '/mos:k', score: 1.9, confidence: 0.1 }, { command: '/mos:k', score: 1.9, confidence: 0.9 }]));
    assert.deepStrictEqual([Object.fromEntries(both.fit), Array.from(both.unsure)], [{ k: 2 }, []], 'a counted row wins over a row that does not count');
  });

  // ---- T11. the order mark ----
  await check('T11. the order mark is not 395-07, so the why sentences of this plan reach every brief 1 time', () => {
    assert.strictEqual(typeof NM.SELECTOR_ORDER, 'string');
    assert.notStrictEqual(NM.SELECTOR_ORDER, '395-07');
    assert.ok(NM.selectorMark().indexOf('order ' + NM.SELECTOR_ORDER + ', ') === 0, NM.selectorMark());
  });

  // ---- T12. dash guard ----
  await check('T12. no em dash or en dash in the files of this plan', () => {
    const files = ['lib/core/feyminto/next-move.cjs', 'lib/core/feyminto/brief.cjs', 'lib/core/strategy/goal-gate.cjs',
      'lib/memory/triple-context-formatter.cjs', 'tests/test-395-truth-fixes.cjs', 'tests/run-all-395.sh'].map((f) => path.join(ROOT, f));
    assert.deepStrictEqual(H.dashGuard(files), []);
  });
}

main().catch((e) => {
  failed += 1;
  console.log('FAIL: the test did not run to its end -- ' + (e && e.stack ? e.stack : String(e)));
}).then(() => {
  if (failed > 0) {
    console.log('FAILED: ' + failed + ' check(s)');
    process.exit(1);
  }
  console.log('PASSED: all checks');
  process.exit(0);
});
