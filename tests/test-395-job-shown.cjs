#!/usr/bin/env node
'use strict';
// Phase 395-02: the job is shown truthfully and can be set. Plain Node script.
// Exit 0 when all checks pass, 1 when one fails. One line per check: "ok:" or "FAIL:".
//
// The room is a real born fixture room under an isolated temporary home
// (tests/helpers/isolated-home-36925.cjs: mkIsolatedHome, birthFixtureRoom), the way
// tests/test-36925-next-move.cjs builds its room in born(). No network. Every tool
// handler call carries an explicit fake session id.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert');

const ROOT = path.resolve(__dirname, '..');
const H = require('./helpers/isolated-home-36925.cjs');

const SEC = 'problem-definition';
const FREE = 'field-notes';
const GOAL_JOB = 'validate-idea';
const SESSION = 'test-395-job-shown-' + Date.now() + '-' + Math.random().toString(36).slice(2);
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

function sha256(buf) { return 'sha256:' + crypto.createHash('sha256').update(buf).digest('hex'); }

// The text of one "## heading" block of a brief (heading line left out).
function block(text, heading) {
  const lines = String(text).split(/\r?\n/);
  const at = lines.findIndex((l) => l.trim() === heading);
  if (at === -1) return '';
  const out = [];
  for (let k = at + 1; k < lines.length; k++) {
    if (/^## /.test(lines[k])) break;
    out.push(lines[k]);
  }
  return out.join('\n').trim();
}

function fakeServer() {
  const registered = [];
  return {
    registered,
    server: {
      tool(name, _d, a, b) { registered.push({ name, handler: typeof b === 'function' ? b : a }); },
      registerTool(name, _c, handler) { registered.push({ name, handler }); },
      server: { getClientCapabilities() { return {}; } },
    },
  };
}

async function call(handler, args) {
  const res = await handler(args, { sessionId: SESSION });
  return JSON.parse(res.content[0].text);
}

async function main() {
  // ---- the fixture room: born, no goal ----
  const iso = H.mkIsolatedHome('395shown');
  const born = H.birthFixtureRoom({ iso, slug: 'job-shown', vname: 'Quokka Labs', ventureText: 'Quokka Labs onboarding platform' });
  if (!born || born.ok !== true) throw new Error('fixture birth failed: ' + JSON.stringify(born));
  const roomDir = fs.realpathSync(born.roomDir);
  const sectionPath = path.join(roomDir, SEC);
  // Bind the fake session to the room, the way tests/test-369-gate-hardening.cjs does in bindSession(): gate_answer
  // writes only into a room the session is bound to.
  const bind = require(path.join(ROOT, 'lib', 'core', 'session-binding.cjs'))
    .writeSessionBinding(SESSION, { bound: ['job-shown'], primary: 'job-shown', sticky: false }, { home: iso.roomsHome });
  if (!bind || bind.ok !== true) throw new Error('session binding failed: ' + JSON.stringify(bind));

  const NM = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'next-move.cjs'));
  const B = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'brief.cjs'));
  const jtbdState = require(path.join(ROOT, 'lib', 'hmi', 'jtbd-state.cjs'));
  const goalGate = require(path.join(ROOT, 'lib', 'core', 'strategy', 'goal-gate.cjs'));
  const registry = require(path.join(ROOT, 'lib', 'core', 'section-registry.cjs'));
  const generator = require(path.join(ROOT, 'scripts', 'vault-section-minto-generator.cjs'));
  const REG = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'command-registry.json'), 'utf8')).commands;
  const servesOf = (name) => {
    const e = REG.find((c) => c && String(c.command).replace(/^\/mos:/, '') === name);
    return e && Array.isArray(e.serves_jtbd) ? e.serves_jtbd : [];
  };

  // A nest with no job of its own and a Theo face that names three commands: the selector has candidates and no job.
  const freeDir = path.join(roomDir, FREE);
  fs.mkdirSync(freeDir);
  fs.writeFileSync(path.join(freeDir, 'ROOM.md'), '---\nstatement: "Notes from the field."\n---\n# Field notes\n', 'utf8');
  fs.writeFileSync(path.join(freeDir, 'BRAIN.md'), '---\nface: feyminto-theo\nasked: true\nsuggested_commands: "root-cause:runnable:runnable,validate:runnable:runnable,explore-domains:runnable:runnable"\n---\n# Theo face\n', 'utf8');

  const sensors = require(path.join(ROOT, 'lib', 'mcp', 'tools', 'sensors.cjs'));
  const sFake = fakeServer();
  sensors.register(sFake.server, { fallbackRoomDir: roomDir });
  const suggestNext = sFake.registered.find((r) => r.name === 'suggest_next').handler;

  const gate = require(path.join(ROOT, 'lib', 'mcp', 'tools', 'gate.cjs'));
  const gFake = fakeServer();
  gate.register(gFake.server, { fallbackRoomDir: roomDir });
  const gateRender = gFake.registered.find((r) => r.name === 'gate_render').handler;
  const gateAnswer = gFake.registered.find((r) => r.name === 'gate_answer').handler;

  const sectionJob = NM.gatherNest({ roomDir, sectionDir: sectionPath }).job;
  let fingerprintNoGoal = null;
  let howToSet = null;

  // ---- A. no goal: the selector, the brief and the basis are as before ----
  await check('A1. no goal: nextMoveForSection uses the section job and the old labels', () => {
    assert.ok(sectionJob.id, 'the fixture nest has a section job');
    const nm = NM.nextMoveForSection({ roomDir, sectionDir: sectionPath, surface: 'mcp' });
    assert.deepStrictEqual(nm.job, { id: sectionJob.id, origin: 'section' });
    assert.strictEqual(nm.state, 'ok');
    assert.deepStrictEqual(nm.job_offers, []);
    assert.ok(nm.primary, 'a primary exists');
    assert.ok(nm.primary.sources.indexOf('the nest job') !== -1, 'sources: ' + JSON.stringify(nm.primary.sources));
    assert.ok(!nm.primary.sources.some((s) => /^your goal job/.test(s)), 'no goal label without a goal');
    assert.ok(/serves the nest job/.test(nm.primary.why), 'why: ' + nm.primary.why);
    assert.ok(servesOf(nm.primary.command).indexOf(sectionJob.id) !== -1, 'the primary serves the section job');
  });

  await check('A2. no goal: the brief prints the section job line and the old source labels', () => {
    const nm = NM.nextMoveForSection({ roomDir, sectionDir: sectionPath, surface: 'mcp' });
    const text = B.renderBrief({ sectionPath, roomDir, now: NOW });
    const serves = block(text, '## THIS NEST SERVES');
    assert.strictEqual(serves, 'Job: ' + sectionJob.id + '. ' + (sectionJob.statement ? sectionJob.statement : 'This nest\'s ROOM.md carries no statement.'));
    assert.ok(text.indexOf('Sources: ' + nm.primary.sources.join(', ')) !== -1, 'the Sources line is the selector labels');
    assert.ok(text.indexOf('your goal job') === -1, 'no goal wording without a goal');
    assert.ok(text.indexOf('selection job') === -1, 'no selection line in RECORD BASIS without a goal');
    assert.ok(block(text, "## THEO'S CONTRIBUTION").indexOf('The move above comes from the contract, the ledger and the nest itself.') !== -1, 'the Theo block keeps its origin sentence');
  });

  await check('A3. no goal: the basis fingerprint is the hash of the input files only', () => {
    const basis = B.recordBasis(sectionPath);
    assert.ok(!Object.prototype.hasOwnProperty.call(basis, 'selection'), 'no selection key without a goal');
    const lines = ['MINTO.md', 'FEYNMAN.md', 'BRAIN.md', 'CONTEXT.md', 'ROOM.md'].map((f) => {
      const p = path.join(sectionPath, f);
      if (!fs.existsSync(p)) return f + ' absent';
      const buf = fs.readFileSync(p);
      return f + ' ' + sha256(f === 'FEYNMAN.md' ? Buffer.from(B.maskGeneratedFeynmanLines(buf.toString('utf8')), 'utf8') : buf);
    });
    assert.strictEqual(basis.fingerprint, sha256(lines.join('\n')));
    fingerprintNoGoal = basis.fingerprint;
  });

  await check('A4. no goal: BRIEF.md is written once, then skipped while the basis is the same', () => {
    generator.renderBriefForSection(roomDir, sectionPath);
    const again = generator.renderBriefForSection(roomDir, sectionPath);
    assert.strictEqual(again.skipped, true, JSON.stringify(again));
    assert.strictEqual(again.reason, 'record_basis_unchanged');
  });

  // ---- B. no goal: suggest_next (resolveNextMove) ----
  await check('B1. suggest_next, a nest with a section job: the job travels, no how_to_set_job', async () => {
    const r = await call(suggestNext, { section: SEC });
    assert.strictEqual(r.next_move_source, 'feyminto_face');
    assert.deepStrictEqual(r.next_move.job, { id: sectionJob.id, origin: 'section' });
    assert.strictEqual(r.next_move.job_state, 'ok');
    assert.deepStrictEqual(r.next_move.job_offers, []);
    assert.ok(!Object.prototype.hasOwnProperty.call(r.next_move, 'how_to_set_job'));
  });

  await check('B2. suggest_next, a nest with no job and candidates: offers and how_to_set_job', async () => {
    const r = await call(suggestNext, { section: FREE });
    assert.strictEqual(r.next_move.job, null);
    assert.strictEqual(r.next_move.job_state, 'job_unknown');
    assert.ok(r.next_move.job_offers.length > 0 && r.next_move.job_offers.length <= 3, JSON.stringify(r.next_move.job_offers));
    assert.ok(r.next_move.job_offers.some((o) => o.id === GOAL_JOB), 'the offers include ' + GOAL_JOB);
    r.next_move.job_offers.forEach((o) => assert.ok(registry.isDeclaredJob(o.id), o.id + ' is in the job vocabulary'));
    assert.strictEqual(typeof r.next_move.how_to_set_job, 'string');
    ['gate_render', '"strategy_goal"', 'rewrite-jtbd', 'gate_answer', 'goal_written'].forEach((w) => {
      assert.ok(r.next_move.how_to_set_job.indexOf(w) !== -1, 'how_to_set_job names ' + w);
    });
    howToSet = r.next_move.how_to_set_job;
  });

  await check('B3. suggest_next, a nest with no job and no candidates: no how_to_set_job', async () => {
    const r = await call(suggestNext, { section: 'team' });
    assert.strictEqual(r.next_move.job_state, 'job_unknown');
    assert.deepStrictEqual(r.next_move.job_offers, []);
    assert.ok(!Object.prototype.hasOwnProperty.call(r.next_move, 'how_to_set_job'));
  });

  // ---- C. jobOffersFor, through composeNextMove with known candidates ----
  await check('C1. job_offers: counted per job, explore left out, most served first, at most three', () => {
    const exploreCmd = REG.map((c) => String(c.command).replace(/^\/mos:/, '')).find((n) => servesOf(n).indexOf('explore') !== -1);
    assert.ok(exploreCmd, 'the registry has a command that serves explore');
    const names = ['root-cause', 'validate', 'map-unknowns', 'explore-domains', 'score-innovation', 'diagnose', exploreCmd]
      .filter((n, i, a) => a.indexOf(n) === i);
    const capabilityFor = () => ({ known: true, cli: 'runnable', mcp: 'runnable', label: 'runnable (test)' });
    const input = {
      surface: 'mcp', face: { asked: false, commands: [] }, ledgerCandidates: null, attempted: [], need: {}, capabilityFor,
      sources: { contract: { names: names }, navigator_table: { names: [] } },
    };
    const count = new Map();
    names.forEach((n) => servesOf(n).forEach((j) => { if (j && j !== 'explore') count.set(j, (count.get(j) || 0) + 1); }));
    const expected = Array.from(count.entries())
      .sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : 1)).slice(0, 3).map(([id, served]) => ({ id: id, served_by: served }));
    const m = NM.composeNextMove(Object.assign({ jobId: null }, input));
    assert.strictEqual(m.state, 'job_unknown');
    assert.ok(expected.length > 0, 'the chosen commands serve at least one job');
    assert.ok(count.size > 3, 'the chosen commands serve more than three jobs, so the limit of three is tested');
    assert.deepStrictEqual(m.job_offers, expected);
    assert.ok(!m.job_offers.some((o) => o.id === 'explore'), 'explore is never offered');
    const withJob = NM.composeNextMove(Object.assign({ jobId: GOAL_JOB, jobOrigin: 'goal' }, input));
    assert.deepStrictEqual(withJob.job_offers, []);
    assert.ok(withJob.primary && withJob.primary.sources.indexOf('your goal job (' + GOAL_JOB + ')') !== -1, 'goal label on the primary: ' + JSON.stringify(withJob.primary && withJob.primary.sources));
    assert.ok(/serves your goal job/.test(withJob.primary.why), 'why: ' + withJob.primary.why);
    const sectionOrigin = NM.composeNextMove(Object.assign({ jobId: GOAL_JOB }, input));
    assert.ok(sectionOrigin.primary.sources.indexOf('the nest job') !== -1, 'section origin keeps the old label');
    assert.ok(/serves the nest job/.test(sectionOrigin.primary.why), 'why: ' + sectionOrigin.primary.why);
  });

  // ---- D. a first goal job is set with gate_render and gate_answer, the way how_to_set_job says ----
  await check('D1. a job outside the vocabulary is refused and nothing is written', async () => {
    const rendered = await call(gateRender, {
      header: 'Set the job', kind: 'strategy_goal', approving: ['rewrite-jtbd'],
      options: [{ id: 'rewrite-jtbd', label: 'Set this job', preview: JSON.stringify({ jtbd: 'a sentence that is not a job id' }) }, { id: 'defer', label: 'Not now' }],
    });
    assert.strictEqual(rendered.ok, true, JSON.stringify(rendered));
    const answered = await call(gateAnswer, { gate_id: rendered.gate_id, chosen: ['rewrite-jtbd'], verdict: 'approve' });
    assert.strictEqual(answered.ok, true, JSON.stringify(answered));
    assert.strictEqual(answered.strategy_ratification.goal_written, false);
    assert.strictEqual(answered.strategy_ratification.reason, 'goal_job_not_in_vocabulary');
    assert.strictEqual(jtbdState.getGoal(roomDir), null);
  });

  await check('D2. the card that how_to_set_job describes sets the goal in a room with no goal', async () => {
    assert.ok(howToSet, 'check B2 gave the sentence');
    const m = howToSet.match(/and options (\[.*\])\. To set the problem type/);
    assert.ok(m, 'the sentence holds the options as JSON');
    const options = JSON.parse(m[1]);
    assert.strictEqual(options[0].id, 'rewrite-jtbd');
    assert.deepStrictEqual(JSON.parse(options[0].preview), { jtbd: '<job id>' });
    options[0].preview = JSON.stringify({ jtbd: GOAL_JOB, rung: 'IllDefined' });
    assert.strictEqual(jtbdState.getGoal(roomDir), null);
    const rendered = await call(gateRender, { header: 'Set the job to ' + GOAL_JOB, kind: 'strategy_goal', approving: ['rewrite-jtbd'], options: options });
    assert.strictEqual(rendered.ok, true, JSON.stringify(rendered));
    const answered = await call(gateAnswer, { gate_id: rendered.gate_id, chosen: ['rewrite-jtbd'], verdict: 'approve' });
    assert.strictEqual(answered.ok, true, JSON.stringify(answered));
    assert.strictEqual(answered.strategy_ratification.goal_written, true, JSON.stringify(answered.strategy_ratification));
    const goal = jtbdState.getGoal(roomDir);
    assert.strictEqual(goal.jtbd, GOAL_JOB);
    assert.strictEqual(goal.rung, 'IllDefined');
    assert.strictEqual(goal.goal_version, 1);
  });

  // ---- E. with the goal: the selector, suggest_next and the brief name the goal job ----
  await check('E1. goal set: nextMoveForSection ranks by the goal job and names it', () => {
    const nm = NM.nextMoveForSection({ roomDir, sectionDir: sectionPath, surface: 'mcp' });
    assert.deepStrictEqual(nm.job, { id: GOAL_JOB, origin: 'goal' });
    assert.strictEqual(nm.state, 'ok');
    assert.ok(nm.primary, 'a primary exists');
    assert.ok(servesOf(nm.primary.command).indexOf(GOAL_JOB) !== -1, 'the primary ' + nm.primary.command + ' serves the goal job');
    assert.ok(nm.primary.sources.indexOf('your goal job (' + GOAL_JOB + ')') !== -1, 'sources: ' + JSON.stringify(nm.primary.sources));
    assert.ok(nm.primary.sources.indexOf('the nest job') === -1, 'the old label is gone');
    assert.ok(/serves your goal job/.test(nm.primary.why), 'why: ' + nm.primary.why);
    const cli = NM.nextMoveForSection({ roomDir, sectionDir: sectionPath, surface: 'cli' });
    assert.deepStrictEqual(cli.job, { id: GOAL_JOB, origin: 'goal' });
  });

  await check('E2. goal set: suggest_next carries the goal job, on a nest with a section job and on one with none', async () => {
    const want = NM.nextMoveForSection({ roomDir, sectionDir: sectionPath, surface: 'mcp' });
    const r = await call(suggestNext, { section: SEC });
    assert.deepStrictEqual(r.next_move.job, { id: GOAL_JOB, origin: 'goal' });
    assert.strictEqual(r.next_move.job_state, 'ok');
    assert.strictEqual(r.next_move.primary.command, want.primary.command);
    assert.deepStrictEqual(r.next_move.primary.sources, want.primary.sources);
    assert.ok(!Object.prototype.hasOwnProperty.call(r.next_move, 'how_to_set_job'));
    const free = await call(suggestNext, { section: FREE });
    assert.deepStrictEqual(free.next_move.job, { id: GOAL_JOB, origin: 'goal' });
    assert.deepStrictEqual(free.next_move.job_offers, []);
    assert.ok(!Object.prototype.hasOwnProperty.call(free.next_move, 'how_to_set_job'));
  });

  await check('E3. goal set: BRIEF.md is written again and names the goal job', () => {
    const nm = NM.nextMoveForSection({ roomDir, sectionDir: sectionPath, surface: 'mcp' });
    const res = generator.renderBriefForSection(roomDir, sectionPath);
    assert.strictEqual(res.written, true, JSON.stringify(res));
    assert.strictEqual(res.reason, 'record_basis_changed');
    const text = fs.readFileSync(path.join(sectionPath, 'BRIEF.md'), 'utf8');
    const serves = block(text, '## THIS NEST SERVES');
    assert.ok(serves.indexOf('Job: ' + GOAL_JOB + ' (your goal job; it ranks the move below). This nest\'s own job: ' + sectionJob.id + '.') === 0, 'Job line: ' + serves);
    assert.ok(text.indexOf('Proposed: /mos:' + nm.primary.command + ' ') !== -1, 'the brief proposes the selector primary');
    assert.ok(text.indexOf('Sources: ' + nm.primary.sources.join(', ')) !== -1, 'the Sources line is the selector labels');
    const sourcesLine = text.split(/\r?\n/).find((l) => /^Sources: /.test(l)) || '';
    assert.ok(sourcesLine.indexOf('your goal job (' + GOAL_JOB + ')') !== -1, sourcesLine);
    assert.ok(sourcesLine.indexOf('the nest job') === -1, sourcesLine);
    assert.ok(block(text, "## THEO'S CONTRIBUTION").indexOf('the nest itself and your goal job (' + GOAL_JOB + ')') !== -1, 'the Theo block names the goal job');
    assert.ok(block(text, '## RECORD BASIS').indexOf('- selection job: ' + GOAL_JOB + ' (your goal job), problem type IllDefined') !== -1, 'RECORD BASIS names the selection job');
    const basis = B.recordBasis(sectionPath);
    assert.deepStrictEqual(basis.selection, { id: GOAL_JOB, origin: 'goal', rung: 'IllDefined' });
    assert.notStrictEqual(basis.fingerprint, fingerprintNoGoal);
    assert.ok(text.indexOf('record_basis_fingerprint: ' + basis.fingerprint) !== -1, 'the frontmatter fingerprint is the basis fingerprint');
    const again = generator.renderBriefForSection(roomDir, sectionPath);
    assert.strictEqual(again.skipped, true, JSON.stringify(again));
  });

  await check('E4. a nest with no job of its own says so on the Job line', () => {
    const text = B.renderBrief({ sectionPath: freeDir, roomDir, now: NOW });
    const serves = block(text, '## THIS NEST SERVES');
    assert.ok(serves.indexOf('Job: ' + GOAL_JOB + ' (your goal job; it ranks the move below). This nest declares no job of its own.') === 0, 'Job line: ' + serves);
  });

  await check('E5. a goal change writes BRIEF.md again; the problem type is kept', () => {
    const out = goalGate.applyGoalFile(roomDir, { jtbd: 'understand-market' });
    assert.strictEqual(out.goal_file, 'ok', JSON.stringify(out));
    assert.strictEqual(jtbdState.getGoal(roomDir).rung, 'IllDefined');
    const res = generator.renderBriefForSection(roomDir, sectionPath);
    assert.strictEqual(res.written, true, JSON.stringify(res));
    const text = fs.readFileSync(path.join(sectionPath, 'BRIEF.md'), 'utf8');
    assert.ok(block(text, '## THIS NEST SERVES').indexOf('Job: understand-market (your goal job') === 0);
  });

  // ---- F. the stored problem type is copied only when it is one of the four ids ----
  await check('F1. a stored problem type outside the four ids does not stop a job change', () => {
    const dir = fs.mkdtempSync(path.join(iso.home, 'rung-'));
    jtbdState.setGoal(dir, { jtbd: GOAL_JOB, rung: 'Wicked' });
    const file = path.join(dir, '.mindrian', 'jtbd-state.json');
    const state = JSON.parse(fs.readFileSync(file, 'utf8'));
    state.goal.rung = 'ill-defined';
    fs.writeFileSync(file, JSON.stringify(state, null, 2), 'utf8');
    const out = goalGate.applyGoalFile(dir, { jtbd: 'understand-market' });
    assert.strictEqual(out.goal_file, 'ok', JSON.stringify(out));
    const goal = jtbdState.getGoal(dir);
    assert.strictEqual(goal.jtbd, 'understand-market');
    assert.strictEqual(goal.rung, null);
  });

  await check('F2. ratifyGoalProposal refuses a new job outside the vocabulary, also with the file write deferred', () => {
    const dir = fs.mkdtempSync(path.join(iso.home, 'vocab-'));
    const card = { kind: 'strategy_goal', options: [{ id: 'rewrite-jtbd', label: 'Set this job', preview: JSON.stringify({ jtbd: 'not a job id' }) }] };
    const direct = goalGate.ratifyGoalProposal(null, dir, { card: card, chosen: ['rewrite-jtbd'], verdict: 'approve' });
    assert.deepStrictEqual(direct, { ok: true, goal_written: false, anchor_confirmed: false, reason: 'goal_job_not_in_vocabulary' });
    const deferred = goalGate.ratifyGoalProposal(null, dir, { card: card, chosen: ['rewrite-jtbd'], verdict: 'approve', deferGoalFile: true });
    assert.ok(!Object.prototype.hasOwnProperty.call(deferred, 'pending_goal'), 'no pending goal for a refused job');
    assert.strictEqual(jtbdState.getGoal(dir), null);
  });

  // ---- G. dash guard ----
  await check('G1. no em dash or en dash in the files of this plan', () => {
    const files = ['lib/core/strategy/goal-gate.cjs', 'lib/core/feyminto/next-move.cjs', 'lib/core/feyminto/brief.cjs', 'lib/mcp/tools/sensors.cjs', 'tests/test-395-job-shown.cjs', 'tests/run-all-395.sh']
      .map((f) => path.join(ROOT, f));
    assert.deepStrictEqual(H.dashGuard(files), []);
  });
}

main().then(() => {
  if (failed > 0) {
    console.log('FAILED: ' + failed + ' check(s)');
    process.exit(1);
  }
  console.log('PASSED: all checks');
  process.exit(0);
}).catch((e) => {
  console.log('FAIL: the test did not run to its end -- ' + (e && e.stack ? e.stack : String(e)));
  process.exit(1);
});
