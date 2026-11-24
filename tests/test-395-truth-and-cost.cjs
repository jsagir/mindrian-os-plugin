#!/usr/bin/env node
'use strict';
// Phase 395-07: the selector says true things, and its cost has a ceiling. Plain Node script.
// Exit 0 when all checks pass, 1 when one fails. One line per check: "ok:" or "FAIL:".
//
// A. the why sentence: when the first command of Theo is not the primary, the sentence names the fact that decided
//    (cold check 395-04, MA1). Each form is reached by one composition and compared with the whole sentence.
// B. the limits 0.5 and 1.5 of the ledger fit levels are pinned (cold check 395-04, mi2).
// C. the brief carries the selector mark (order rule and ledger build); a brief written under another mark reads as
//    stale and is rewritten 1 time, not more (cold check 395-04, MA2).
// D. the gate does not take the job explore as a new goal job, and each sentence about the job is true when a goal
//    that does not rank is stored (cold check 395-04, MA4).
// E. the command-line surface does not load the MCP router (cold check 395-03, Major 1).
// F. two ceilings: research runs read, and bytes read of a nest file (cold check 395-03, Major 2).
// G. suggest_next with a goal job set sends a shorter how_to (cold check 395-05, MA3).
//
// Parts A and B read data/command-registry.json and data/section-command-ledger.json and pick command names at run
// time. Parts C to G use a real born fixture room under an isolated temporary home
// (tests/helpers/isolated-home-36925.cjs) and the real registered tool handlers with a fake session id. No network.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const H = require('./helpers/isolated-home-36925.cjs');

const JOB = 'validate-idea';
const JOB_B = 'understand-market';
const SEC = 'problem-definition';
const FREE = 'field-notes';
const GHOST = 'no-such-command-zz';
const SESSION = 'test-395-truth-' + Date.now() + '-' + Math.random().toString(36).slice(2);
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
const strip = (n) => String(n).replace(/^\/mos:/, '');
const REG = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'command-registry.json'), 'utf8')).commands
  .filter((c) => c && typeof c.command === 'string');
const LEDGER = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'section-command-ledger.json'), 'utf8'));
const servesOf = (name) => {
  const e = REG.find((c) => strip(c.command) === name);
  return e && Array.isArray(e.serves_jtbd) ? e.serves_jtbd : [];
};
const serves = (name, job) => servesOf(name).indexOf(job) !== -1;

const NM = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'next-move.cjs'));
const CAP = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'capability.cjs'));

// A stub capability: every name is runnable, except GHOST (not a command) and the names in `instructionOnly`.
const capabilityStub = (instructionOnly) => (n) => (n === GHOST
  ? { known: false }
  : { known: true, cli: 'runnable', mcp: (instructionOnly || []).indexOf(n) !== -1 ? 'instruction-only' : 'runnable', label: 'runnable (test)' });
const src = (contract, table) => ({ contract: { names: contract || [] }, navigator_table: { names: table || [] } });
const led = (names) => [{ source: 'section_ledger', items: names.map((n) => ({ id: n, confidence: null, source: 'ground-truth' })) }];
const face = (names) => ({ asked: true, commands: names.map((n) => ({ name: n, cli: 'runnable', mcp: 'runnable' })) });
function compose(extra) {
  return NM.composeNextMove(Object.assign({ surface: 'mcp', face: { asked: false, commands: [] }, ledgerCandidates: null, attempted: [], need: {}, capabilityFor: capabilityStub([]) }, extra));
}
// The part of the why sentence after "Theo ranked <name> first, but ", or null when the sentence has no such part.
function theoPart(why, top) {
  const head = '; Theo ranked ' + top + ' first, but ';
  const at = String(why).indexOf(head);
  if (at === -1) return null;
  assert.strictEqual(String(why).indexOf(head, at + 1), -1, 'the sentence names Theo 1 time: ' + why);
  return String(why).slice(at + head.length).replace(/; instruction-only on this surface$/, '');
}

function fakeServer(inner) {
  const registered = [];
  return {
    registered,
    server: {
      tool(name, _d, a, b) { registered.push({ name, handler: typeof b === 'function' ? b : a }); },
      registerTool(name, _c, handler) { registered.push({ name, handler }); },
      server: inner,
    },
  };
}
async function call(handler, args) {
  const res = await handler(args, { sessionId: SESSION });
  return JSON.parse(res.content[0].text);
}
function cardFromSentence(sentence) {
  const kind = String(sentence).match(/gate_render with kind ("[a-z_]+")/);
  const approving = String(sentence).match(/approving (\[[^\]]*\])/);
  const options = String(sentence).match(/and options (\[.*?\])\. To set the problem type/);
  assert.ok(kind && approving && options, 'the sentence holds kind, approving and options: ' + sentence);
  return { kind: JSON.parse(kind[1]), approving: JSON.parse(approving[1]), options: JSON.parse(options[1]) };
}
function jobCard(job) {
  return {
    header: 'Set the job to ' + job, kind: 'strategy_goal', approving: ['rewrite-jtbd'],
    options: [{ id: 'rewrite-jtbd', label: 'Set this job', preview: JSON.stringify({ jtbd: job }) }, { id: 'defer', label: 'Not now' }],
  };
}
function runId(i) {
  return 'rp-2026-' + String(1 + (i % 12)).padStart(2, '0') + '-' + String(1 + (i % 28)).padStart(2, '0') + '-' + i.toString(16).padStart(8, '0');
}
function addRun(roomDir, i, section) {
  const dir = path.join(roomDir, '.mindrian', 'research-runs', runId(i));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'plan.json'), JSON.stringify({ run_id: runId(i), return_target: { section: section } }), 'utf8');
  return runId(i);
}

async function main() {
  const all = REG.map((c) => strip(c.command));
  const serving = all.filter((n) => serves(n, JOB));
  const notServing = all.filter((n) => !serves(n, JOB));
  if (serving.length < 2 || notServing.length < 2) throw new Error('the registry needs 2 commands that serve ' + JOB + ' and 2 that do not');
  const S1 = serving[0];
  const S2 = serving[1];
  const N1 = notServing[0];
  const N2 = notServing[1];
  console.log('names: S1=' + S1 + ' S2=' + S2 + ' (serve ' + JOB + '); N1=' + N1 + ' N2=' + N2 + ' (do not)');

  // ---- A. the why sentence ----
  await check('A1. primary with no ledger rating, Theo first counted poor: the sentence says who is rated poor (MA1)', () => {
    const m = compose({ jobId: JOB, jobFit: { [S1]: 0 }, face: face([S1]), sources: src([S1, S2], [S1]) });
    assert.strictEqual(m.primary.command, S2);
    assert.strictEqual(theoPart(m.why, S1), 'the ledger rates ' + S1 + ' as a poor first move for the job, and has no rating for this command');
    assert.ok(m.why.indexOf('rates this command higher') === -1, m.why);
  });

  await check('A2. the same case read from the ledger file: a counted poor command against a command with no row', () => {
    const floor = typeof LEDGER.confidence_floor === 'number' ? LEDGER.confidence_floor : null;
    let found = null;
    Object.keys(LEDGER.rows).forEach((key) => {
      if (found || !/\|\*\|\*$/.test(key)) return;
      const job = key.split('|')[0];
      const row = LEDGER.rows[key];
      const poor = row.find((r) => typeof r.confidence === 'number' && (floor === null || r.confidence >= floor) && r.score < 0.5 && all.indexOf(strip(r.command)) !== -1);
      if (!poor) return;
      const p = strip(poor.command);
      const u = all.find((n) => n !== p && serves(n, job) === serves(p, job) && !row.some((r) => strip(r.command) === n));
      if (u) found = { job, p, u };
    });
    assert.ok(found, 'the ledger holds no row with a counted poor command and a registry command with no rating');
    const m = compose({ jobId: found.job, face: face([found.p]), sources: src([found.p, found.u], [found.p]) });
    assert.strictEqual(m.primary.command, found.u, 'job ' + found.job);
    assert.strictEqual(theoPart(m.why, found.p), 'the ledger rates ' + found.p + ' as a poor first move for the job, and has no rating for this command');
  });

  await check('A3. primary rated strong, Theo first with no rating: the sentence says that Theo first has no rating', () => {
    const m = compose({ jobId: JOB, jobFit: { [S2]: 2 }, face: face([S1]), sources: src([S1, S2], [S1]) });
    assert.strictEqual(m.primary.command, S2);
    assert.strictEqual(theoPart(m.why, S1), 'the ledger rates this command higher for the job (a strong first move; the ledger has no rating for ' + S1 + ')');
  });

  await check('A4. both rated: the sentence is the plain comparison', () => {
    const m = compose({ jobId: JOB, jobFit: { [S2]: 2, [S1]: 1 }, face: face([S1]), sources: src([S1, S2], [S1]) });
    assert.strictEqual(m.primary.command, S2);
    assert.strictEqual(theoPart(m.why, S1), 'the ledger rates this command higher for the job');
  });

  await check('A5. the job key decided: the job sentence', () => {
    const m = compose({ jobId: JOB, jobFit: {}, face: face([N1]), sources: src([N1, S1], [N1]) });
    assert.strictEqual(m.primary.command, S1);
    assert.strictEqual(theoPart(m.why, N1), 'a command that serves the job is ordered first');
  });

  await check('A6. more sources decided: the agreement sentence, with a job and with no job', () => {
    const withJob = compose({ jobId: JOB, jobFit: {}, face: face([S2]), sources: src([S1], [S1]) });
    assert.strictEqual(withJob.primary.command, S1);
    assert.strictEqual(theoPart(withJob.why, S2), 'agreement across sources outranks one source\'s order');
    const noJob = compose({ jobId: null, face: face([N2]), sources: src([N1], [N1]) });
    assert.strictEqual(noJob.primary.command, N1);
    assert.strictEqual(theoPart(noJob.why, N2), 'agreement across sources outranks one source\'s order');
  });

  await check('A7. equal count of sources: the tie sentence names what broke the tie, never "agreement"', () => {
    const ledgerNamed = compose({ jobId: null, face: face([N2]), ledgerCandidates: led([N1]) });
    assert.strictEqual(ledgerNamed.primary.command, N1);
    assert.strictEqual(theoPart(ledgerNamed.why, N2), 'the two are level, and the tie goes to the command that the ledger names');
    const ledgerOrder = compose({ jobId: null, face: face([N2]), ledgerCandidates: led([N1, N2]), sources: src([], [N1]) });
    assert.strictEqual(ledgerOrder.primary.command, N1);
    assert.strictEqual(theoPart(ledgerOrder.why, N2), 'the two are level, and the tie goes to the ledger\'s own order');
    const contractNamed = compose({ jobId: null, face: face([N2]), sources: src([N1], []) });
    assert.strictEqual(contractNamed.primary.command, N1);
    assert.strictEqual(theoPart(contractNamed.why, N2), 'the two are level, and the tie goes to the command that the section contract names');
    const contractOrder = compose({ jobId: null, face: face([N2]), sources: src([N1, N2], [N1]) });
    assert.strictEqual(contractOrder.primary.command, N1);
    assert.strictEqual(theoPart(contractOrder.why, N2), 'the two are level, and the tie goes to the section contract\'s order');
    [ledgerNamed, ledgerOrder, contractNamed, contractOrder].forEach((m) => assert.ok(m.why.indexOf('agreement across sources') === -1, m.why));
  });

  await check('A8. Theo first is not offered: not a command on this install, or it ran to a verified result', () => {
    const ghost = compose({ jobId: null, face: face([GHOST]), sources: src([N1, N2], [N1]) });
    assert.strictEqual(ghost.primary.command, N1);
    assert.strictEqual(theoPart(ghost.why, GHOST), GHOST + ' is not a command on this install');
    const ran = compose({ jobId: null, face: face([N2]), sources: src([N1], [N1]), attempted: [{ command: N2, status: 'terminal', verified: true }] });
    assert.strictEqual(ran.primary.command, N1);
    assert.strictEqual(theoPart(ran.why, N2), N2 + ' already ran to a verified result in this nest');
  });

  await check('A9. Theo first is ordered before the primary and is instruction-only here: the sentence says so', () => {
    const m = compose({ jobId: null, face: face([N2]), sources: src([N2, N1], [N2]), capabilityFor: capabilityStub([N2]) });
    assert.strictEqual(m.primary.command, N1, 'the primary is the first runnable command');
    assert.strictEqual(theoPart(m.why, N2), N2 + ' is instruction-only on this surface');
    assert.strictEqual(m.alternatives[0].command, N2);
    assert.strictEqual(m.alternatives[0].instruction_only, true);
  });

  await check('A10. every result where Theo first is not the primary has 1 Theo sentence; a primary that is Theo first has none', () => {
    let other = 0;
    let same = 0;
    const lists = [[], [S1], [N1], [S1, S2], [N1, S1], [N2, N1, S2]];
    [null, JOB].forEach((jobId) => [[S1], [N1], [N2], [GHOST]].forEach((f) => lists.forEach((contract) => [[], [S1], [N1, S1]].forEach((ledger) => {
      [{}, { [S1]: 0 }, { [S2]: 2 }, { [N1]: 2 }].forEach((fit) => [[], [N1], [S1]].forEach((instr) => {
        const m = compose({ jobId, jobFit: fit, face: face(f), sources: src(contract, []), ledgerCandidates: ledger.length > 0 ? led(ledger) : null, capabilityFor: capabilityStub(instr) });
        if (!m.primary) return;
        const count = m.why.split('; Theo ranked ' + f[0] + ' first, but ').length - 1;
        if (m.primary.command === f[0]) { same += 1; assert.strictEqual(count, 0, m.why); } else { other += 1; assert.strictEqual(count, 1, JSON.stringify({ jobId, f, contract, ledger, fit, instr }) + ' ' + m.why); }
      }));
    }))));
    assert.ok(other >= 200 && same >= 50, 'the set reaches both cases: ' + other + ' and ' + same);
  });

  // ---- B. the limits of the fit levels ----
  await check('B1. the limits are 0.5 (poor under it) and 1.5 (strong from it)', () => {
    assert.strictEqual(NM.JOB_FIT_POOR, 0.5);
    assert.strictEqual(NM.JOB_FIT_STRONG, 1.5);
  });

  await check('B2. the level of every counted ledger row is the level these limits give, and each level is in the ledger', () => {
    const floor = typeof LEDGER.confidence_floor === 'number' ? LEDGER.confidence_floor : null;
    const seen = [0, 0, 0];
    let jobs = 0;
    Object.keys(LEDGER.rows).forEach((key) => {
      if (!/\|\*\|\*$/.test(key)) return;
      const job = key.split('|')[0];
      const want = {};
      LEDGER.rows[key].forEach((r) => {
        if (!r || typeof r.command !== 'string' || typeof r.score !== 'number') return;
        const counted = typeof r.confidence === 'number' ? (floor === null || r.confidence >= floor) : r.source === 'ground-truth';
        if (!counted) return;
        const level = r.score >= 1.5 ? 2 : (r.score < 0.5 ? 0 : 1);
        want[strip(r.command)] = level;
        seen[level] += 1;
      });
      const got = {};
      NM.jobFitFor(job).forEach((v, k) => { got[k] = v; });
      assert.deepStrictEqual(got, want, 'job ' + job);
      jobs += 1;
    });
    assert.ok(jobs >= 10, 'the ledger has job rows: ' + jobs);
    assert.ok(seen[0] > 0 && seen[1] > 0 && seen[2] > 0, 'each level is in the ledger: ' + seen.join(', '));
    const scores = [];
    Object.keys(LEDGER.rows).forEach((key) => LEDGER.rows[key].forEach((r) => { if (r && typeof r.score === 'number') scores.push(r.score); }));
    assert.ok(scores.some((s) => s >= 0.4 && s < 0.5) && scores.some((s) => s >= 1.5 && s < 1.6), 'the ledger has scores next to both limits, so a moved limit changes a level');
  });

  // ---- the fixture room: born, no goal ----
  const iso = H.mkIsolatedHome('395truth');
  const born = H.birthFixtureRoom({ iso, slug: 'truth', vname: 'Quokka Labs', ventureText: 'Quokka Labs onboarding platform' });
  if (!born || born.ok !== true) throw new Error('fixture birth failed: ' + JSON.stringify(born));
  const roomDir = fs.realpathSync(born.roomDir);
  const sectionPath = path.join(roomDir, SEC);
  const bind = require(path.join(ROOT, 'lib', 'core', 'session-binding.cjs'))
    .writeSessionBinding(SESSION, { bound: ['truth'], primary: 'truth', sticky: false }, { home: iso.roomsHome });
  if (!bind || bind.ok !== true) throw new Error('session binding failed: ' + JSON.stringify(bind));

  const B = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'brief.cjs'));
  const F = require(path.join(ROOT, 'lib', 'memory', 'triple-context-formatter.cjs'));
  const jtbdState = require(path.join(ROOT, 'lib', 'hmi', 'jtbd-state.cjs'));
  const generator = require(path.join(ROOT, 'scripts', 'vault-section-minto-generator.cjs'));

  const freeDir = path.join(roomDir, FREE);
  fs.mkdirSync(freeDir);
  fs.writeFileSync(path.join(freeDir, 'ROOM.md'), '---\nstatement: "Notes from the field."\n---\n# Field notes\n', 'utf8');
  fs.writeFileSync(path.join(freeDir, 'BRAIN.md'), '---\nface: feyminto-theo\nasked: true\nsuggested_commands: "root-cause:runnable:runnable,validate:runnable:runnable,explore-domains:runnable:runnable"\n---\n# Theo face\n', 'utf8');
  const nests = fs.readdirSync(roomDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name[0] !== '.' && fs.existsSync(path.join(roomDir, d.name, 'ROOM.md'))).map((d) => d.name).sort();
  const walk = () => {
    const count = {};
    nests.forEach((n) => { const r = generator.renderBriefForSection(roomDir, path.join(roomDir, n)); count[r.reason] = (count[r.reason] || 0) + 1; });
    return count;
  };

  // ---- C. the selector mark in the brief ----
  const realMark = NM.selectorMark;
  await check('C1. the mark names the order rule and the ledger build; it is in the full fingerprint only', () => {
    const mark = NM.selectorMark();
    assert.strictEqual(typeof LEDGER.built_at, 'string', 'the ledger file has built_at');
    // Phase 399 plan 07: the mark names the advisor table build.
    assert.strictEqual(mark, 'order ' + NM.SELECTOR_ORDER + ', ledger built ' + LEDGER.built_at + ', advisor table ' + (function () { const A = require(path.join(ROOT, 'lib', 'core', 'decision-advisor', 'shortlist.cjs')); return A.advisorEnabled() ? A.tableMeta().version : 'off'; })()); // advisor is opt-in
    const basis = B.recordBasis(sectionPath, null, []);
    assert.strictEqual(basis.selector, mark);
    const lines = ['MINTO.md', 'FEYNMAN.md', 'BRAIN.md', 'CONTEXT.md', 'ROOM.md'].map((f) => {
      const p = path.join(sectionPath, f);
      if (!fs.existsSync(p)) return f + ' absent';
      const buf = fs.readFileSync(p);
      return f + ' ' + sha256(f === 'FEYNMAN.md' ? Buffer.from(B.maskGeneratedFeynmanLines(buf.toString('utf8')), 'utf8') : buf);
    });
    assert.strictEqual(basis.fingerprint, sha256(lines.join('\n')), 'the input fingerprint is the hash of the input files, with no goal');
    assert.strictEqual(basis.full_fingerprint, sha256(basis.fingerprint + '\n' + '\nselector ' + mark), 'the full fingerprint holds the mark');
    const text = B.renderBrief({ sectionPath, roomDir, now: NOW });
    assert.ok(text.indexOf('\n- selector: ' + mark + '\n') !== -1, 'RECORD BASIS prints the mark');
  });

  await check('C2. briefs written under another mark read as stale, are rewritten 1 time each, and then no more', () => {
    assert.ok(nests.length >= 12, 'the room has its nests: ' + nests.length);
    NM.selectorMark = () => 'order 395-04, ledger built 2020-01-01T00:00:00.000Z';
    let first;
    try { first = walk(); } finally { NM.selectorMark = realMark; }
    assert.deepStrictEqual(first, { created: nests.length }, 'every nest gets a brief under the old mark');
    const before = F.assembleBriefHead({ roomDir: roomDir, section: SEC });
    assert.strictEqual(before.state, 'stale');
    assert.strictEqual(before.reason, 'the selector order or the ledger changed');
    assert.ok(before.head.indexOf('stale: inputs changed since this brief was written (the selector order or the ledger changed)') !== -1, before.head);
    assert.deepStrictEqual(walk(), { record_basis_changed: nests.length }, 'the first walk under the new mark writes every brief again');
    assert.deepStrictEqual(walk(), { record_basis_unchanged: nests.length }, 'the second walk writes nothing');
    assert.deepStrictEqual(walk(), { record_basis_unchanged: nests.length }, 'the third walk writes nothing');
    const after = F.assembleBriefHead({ roomDir: roomDir, section: SEC });
    assert.strictEqual(after.state, 'fresh', JSON.stringify(after.reason));
  });

  await check('C3. a brief with no mark line reads as stale, and the reason names the selector', () => {
    const briefPath = path.join(sectionPath, 'BRIEF.md');
    const text = fs.readFileSync(briefPath, 'utf8');
    const without = text.split('\n').filter((l) => l.indexOf('- selector: ') !== 0).join('\n');
    assert.notStrictEqual(without, text, 'the brief had a mark line');
    fs.writeFileSync(briefPath, without, 'utf8');
    const head = F.assembleBriefHead({ roomDir: roomDir, section: SEC });
    fs.writeFileSync(briefPath, text, 'utf8');
    assert.strictEqual(head.state, 'stale');
    assert.strictEqual(head.reason, 'the selector order or the ledger changed');
    assert.strictEqual(F.assembleBriefHead({ roomDir: roomDir, section: SEC }).state, 'fresh');
  });

  await check('C4. the mark costs no file read after the first: 200 basis reads, the ledger file is read 0 times more', () => {
    NM.selectorMark();
    const real = fs.readFileSync;
    let ledgerReads = 0;
    fs.readFileSync = function (p) {
      if (typeof p === 'string' && /section-command-ledger\.json$/.test(p)) ledgerReads += 1;
      return real.apply(fs, arguments);
    };
    try {
      for (let k = 0; k < 200; k++) B.recordBasis(sectionPath, null, []);
    } finally {
      fs.readFileSync = real;
    }
    assert.strictEqual(ledgerReads, 0);
  });

  // ---- the tool handlers ----
  const sensors = require(path.join(ROOT, 'lib', 'mcp', 'tools', 'sensors.cjs'));
  const sFake = fakeServer({ getClientCapabilities() { return {}; } });
  sensors.register(sFake.server, { fallbackRoomDir: roomDir });
  const suggestNext = sFake.registered.find((r) => r.name === 'suggest_next').handler;
  const gate = require(path.join(ROOT, 'lib', 'mcp', 'tools', 'gate.cjs'));
  const gText = fakeServer({ getClientCapabilities() { return {}; } });
  gate.register(gText.server, { fallbackRoomDir: roomDir });
  const textRender = gText.registered.find((r) => r.name === 'gate_render').handler;
  const textAnswer = gText.registered.find((r) => r.name === 'gate_answer').handler;

  // ---- D. the goal job explore ----
  let notSetLength = 0;
  await check('D1. no goal stored: the sentences say that no job ranks, and name no stored goal', async () => {
    assert.strictEqual(jtbdState.getGoal(roomDir), null, 'precondition: no goal is stored');
    const r = await call(suggestNext, { section: FREE });
    assert.strictEqual(r.next_move.job_state, 'job_unknown');
    assert.strictEqual(r.next_move.how_to_set_job.indexOf('No job ranks the next move in this nest.'), 0, r.next_move.how_to_set_job.slice(0, 80));
    assert.ok(r.next_move.how_to_set_job.indexOf('No job is set') === -1, 'the old first words are gone');
    assert.strictEqual(r.goal_job.state, 'not_set');
    assert.ok(r.goal_job.how_to.indexOf('A goal is stored') === -1, 'no stored goal is named when none is stored');
    notSetLength = r.goal_job.how_to.length;
  });

  await check('D2. the gate does not take explore as a new goal job: goal_written false, reason goal_job_does_not_rank', async () => {
    const rendered = await call(textRender, jobCard('explore'));
    assert.strictEqual(rendered.ok, true, JSON.stringify(rendered));
    const answered = await call(textAnswer, { gate_id: rendered.gate_id, chosen: ['rewrite-jtbd'], verdict: 'approve' });
    assert.strictEqual(answered.ok, true, JSON.stringify(answered));
    assert.strictEqual(answered.strategy_ratification.goal_written, false, JSON.stringify(answered.strategy_ratification));
    assert.strictEqual(answered.strategy_ratification.reason, 'goal_job_does_not_rank');
    assert.strictEqual(jtbdState.getGoal(roomDir), null, 'no goal was written');
  });

  await check('D3. a stored goal explore (written before this rule): each sentence is true, and the stored goal is named', async () => {
    assert.ok(jtbdState.setGoal(roomDir, { jtbd: 'explore' }), 'the goal explore is stored by the writer, as an older version did');
    const r = await call(suggestNext, { section: FREE });
    assert.strictEqual(r.next_move.job, null);
    assert.strictEqual(r.next_move.job_state, 'job_unknown');
    assert.ok(r.next_move.how_to_set_job.indexOf('No job is set') === -1, 'the reply does not say that no job is set: a goal is stored');
    assert.strictEqual(r.next_move.how_to_set_job.indexOf('No job ranks the next move in this nest.'), 0);
    assert.strictEqual(r.goal_job.state, 'not_set');
    assert.strictEqual(r.goal_job.id, null);
    assert.strictEqual(r.goal_job.how_to.indexOf('No goal job ranks the next move.'), 0);
    assert.ok(r.goal_job.how_to.indexOf('A goal is stored for this room, but it does not rank') !== -1, r.goal_job.how_to.slice(0, 400));
    assert.ok(r.goal_job.how_to.indexOf('goal_job_does_not_rank') !== -1, 'the reply names the reason the gate gives for explore');
    assert.deepStrictEqual(cardFromSentence(r.goal_job.how_to).approving, ['rewrite-jtbd']);
    const withJob = await call(suggestNext, { section: SEC });
    assert.strictEqual(withJob.next_move.job.origin, 'section', 'a nest with a job is ranked by its own job');
  });

  // ---- G. the reply with a goal job set ----
  await check('G1. another job is still taken by the gate, and the reply with a goal set is the short one', async () => {
    const rendered = await call(textRender, jobCard(JOB_B));
    const answered = await call(textAnswer, { gate_id: rendered.gate_id, chosen: ['rewrite-jtbd'], verdict: 'approve' });
    assert.strictEqual(answered.strategy_ratification.goal_written, true, JSON.stringify(answered.strategy_ratification));
    assert.strictEqual(jtbdState.getGoal(roomDir).jtbd, JOB_B);
    const r = await call(suggestNext, { section: SEC });
    assert.strictEqual(r.goal_job.state, 'set');
    assert.strictEqual(r.goal_job.id, JOB_B);
    const how = r.goal_job.how_to;
    assert.strictEqual(how.indexOf('The goal job of this room ranks the next move in every nest: ' + JOB_B + '. To change it:'), 0, how.slice(0, 120));
    const card = cardFromSentence(how);
    assert.strictEqual(card.kind, 'strategy_goal');
    assert.deepStrictEqual(card.approving, ['rewrite-jtbd']);
    assert.deepStrictEqual(card.options.map((o) => o.id), ['rewrite-jtbd', 'defer']);
    ['gate_answer', 'strategy_ratification.goal_written true', 'unknown_gate', 'card_pending'].forEach((w) => assert.ok(how.indexOf(w) !== -1, 'how_to names: ' + w));
    assert.ok(how.indexOf('On a host that takes the answer in a dialog of its own') === -1, 'the long step sentences are not sent');
    assert.ok(how.indexOf('A goal is stored') === -1, 'a goal that ranks is not named as a goal that does not rank');
    assert.ok(notSetLength > 0, 'check D1 measured the long form');
    assert.ok(how.length <= notSetLength - 300, 'the short form is 300 characters or more under the long form: ' + how.length + ' against ' + notSetLength);
  });

  // ---- E. the command-line surface does not load the MCP router ----
  await check('E1. one selector call on the cli surface loads no MCP router and no zod file; a read of the mcp marker loads it', () => {
    const script = [
      'const path = require("node:path");',
      'const NM = require(path.join(process.argv[1], "lib", "core", "feyminto", "next-move.cjs"));',
      'const loaded = () => { const m = Object.keys(require.cache); return { router: m.some((f) => /tool-router\\.cjs$/.test(f)), zod: m.filter((f) => /node_modules[\\\\/]zod[\\\\/]/.test(f)).length }; };',
      'const r = NM.nextMoveForSection({ roomDir: process.argv[2], sectionDir: path.join(process.argv[2], process.argv[3]), surface: "cli" });',
      'const tier = NM.toTierCandidates(r);',
      'const before = loaded();',
      'const mcp = r.primary.capability.mcp;',
      'console.log(JSON.stringify({ primary: r.primary.command, ids: tier[0].items.map((i) => i.id), before: before, mcp: mcp, after: loaded() }));',
    ].join('\n');
    const res = spawnSync(process.execPath, ['-e', script, ROOT, roomDir, SEC], { env: iso.env, encoding: 'utf8', timeout: 20000 });
    assert.strictEqual(res.status, 0, res.stderr);
    const out = JSON.parse(res.stdout.trim().split('\n').pop());
    assert.ok(typeof out.primary === 'string' && out.ids.length > 0 && out.ids[0] === out.primary, 'the selector gave a primary: ' + res.stdout);
    assert.deepStrictEqual(out.before, { router: false, zod: 0 }, 'after the call and the tier list');
    assert.ok(out.mcp === 'runnable' || out.mcp === 'instruction-only', 'the marker has a value: ' + out.mcp);
    assert.strictEqual(out.after.router, true, 'the router is loaded when the mcp marker is read');
  });

  await check('E2. the markers are the same values as before: every registry command against the router lists', () => {
    const router = require(path.join(ROOT, 'lib', 'mcp', 'tool-router.cjs'));
    const allTools = new Set(router.ALL_TOOL_COMMANDS);
    const unimplemented = new Set(router.UNIMPLEMENTED_MUTATING_ORCHESTRATION || []);
    let runnableBoth = 0;
    let cliOnly = 0;
    all.forEach((name) => {
      const c = CAP.capabilityFor(name, { kind: 'command' });
      assert.deepStrictEqual(Object.keys(c), ['known', 'kind', 'name', 'cli', 'mcp', 'version', 'label', 'reason'], name);
      const wantMcp = c.cli === 'runnable' && allTools.has(name) && !unimplemented.has(name) ? 'runnable' : 'instruction-only';
      assert.strictEqual(c.mcp, wantMcp, name);
      const wantLabel = c.cli === 'runnable' && wantMcp === 'runnable' ? 'runnable here (CLI and Desktop)'
        : (c.cli === 'runnable' ? 'runnable on CLI; instruction-only on Desktop and Cowork' : 'instruction-only');
      assert.strictEqual(c.label, wantLabel, name);
      assert.deepStrictEqual(JSON.parse(JSON.stringify(c)), { known: true, kind: 'command', name: name, cli: c.cli, mcp: wantMcp, version: c.version, label: wantLabel, reason: c.reason }, name);
      if (wantMcp === 'runnable') runnableBoth += 1; else if (c.cli === 'runnable') cliOnly += 1;
    });
    assert.ok(runnableBoth > 0 && cliOnly > 0, 'both kinds are in the registry: ' + runnableBoth + ' and ' + cliOnly);
    ['cli', 'mcp'].forEach((surface) => {
      const r = NM.nextMoveForSection({ roomDir: roomDir, sectionDir: sectionPath, surface: surface });
      [r.primary].concat(r.alternatives).forEach((m) => {
        const c = CAP.capabilityFor(m.command, { kind: 'command' });
        assert.deepStrictEqual(JSON.parse(JSON.stringify(m.capability)), { cli: c.cli, mcp: c.mcp, label: c.label }, surface + ' ' + m.command);
        assert.deepStrictEqual(Object.keys(m.capability), ['cli', 'mcp', 'label']);
      });
    });
  });

  // ---- F. the two ceilings ----
  await check('F1. research runs: up to the ceiling every run is read; over it the newest by id are read and the rest are counted', () => {
    const max = NM.MAX_RUNS_READ;
    assert.strictEqual(max, 50);
    const ids = [];
    for (let i = 0; i < max; i++) ids.push(addRun(roomDir, i, SEC));
    let nest = NM.gatherNest({ roomDir: roomDir, sectionDir: sectionPath });
    assert.strictEqual(nest.runs.length, max, 'a room with ' + max + ' runs: all are read');
    assert.strictEqual(nest.runs_not_read, 0);
    assert.ok(B.renderBrief({ sectionPath, roomDir, now: NOW }).indexOf('older runs were not') === -1, 'no ceiling note at the ceiling');
    for (let i = max; i < max + 10; i++) ids.push(addRun(roomDir, i, SEC));
    nest = NM.gatherNest({ roomDir: roomDir, sectionDir: sectionPath });
    assert.strictEqual(nest.runs.length, max, 'a room with ' + (max + 10) + ' runs: ' + max + ' are read');
    assert.strictEqual(nest.runs_not_read, 10);
    const newest = ids.slice().sort().reverse().slice(0, max).sort();
    assert.deepStrictEqual(nest.runs.map((r) => r.run_id).sort(), newest, 'the runs read are the newest by run id');
    const info = { not_read: 0 };
    assert.strictEqual(NM.readRuns(roomDir, SEC, info).length, max);
    assert.strictEqual(info.not_read, 10);
    const real = fs.readFileSync;
    let planReads = 0;
    fs.readFileSync = function (p) { if (typeof p === 'string' && /plan\.json$/.test(p)) planReads += 1; return real.apply(fs, arguments); };
    try { NM.nextMoveForSection({ roomDir: roomDir, sectionDir: sectionPath, surface: 'cli' }); } finally { fs.readFileSync = real; }
    assert.strictEqual(planReads, max, 'one selector call reads ' + max + ' plan files, not ' + (max + 10));
    const text = B.renderBrief({ sectionPath, roomDir, now: NOW });
    assert.ok(text.indexOf(max + ' research runs for this nest; only the newest ' + max + ' runs of the room were read, 10 older runs were not') !== -1, 'the brief says what was not read');
  });

  await check('F2. a nest file over the ceiling is read in part and named; a file at the ceiling is read whole', () => {
    const max = NM.MAX_NEST_FILE_BYTES;
    assert.strictEqual(max, 262144);
    const feynman = path.join(sectionPath, 'FEYNMAN.md');
    const original = fs.readFileSync(feynman, 'utf8');
    const whole = NM.gatherNest({ roomDir: roomDir, sectionDir: sectionPath });
    assert.deepStrictEqual(whole.cut, [], 'a born nest is read whole');
    const line = '- filler line, not a heading\n';
    let atLimit = original;
    while (Buffer.byteLength(atLimit, 'utf8') + line.length <= max) atLimit += line;
    atLimit += 'x'.repeat(max - Buffer.byteLength(atLimit, 'utf8'));
    fs.writeFileSync(feynman, atLimit, 'utf8');
    assert.strictEqual(fs.statSync(feynman).size, max);
    assert.deepStrictEqual(NM.gatherNest({ roomDir: roomDir, sectionDir: sectionPath }).cut, [], 'a file of exactly the ceiling is read whole');
    fs.writeFileSync(feynman, atLimit + '\nTAIL-MARK-395\n', 'utf8');
    const real = fs.readFileSync;
    let wholeReads = 0;
    fs.readFileSync = function (p) { if (p === feynman) wholeReads += 1; return real.apply(fs, arguments); };
    let cutNest;
    try { cutNest = NM.gatherNest({ roomDir: roomDir, sectionDir: sectionPath }); } finally { fs.readFileSync = real; }
    assert.deepStrictEqual(cutNest.cut, ['FEYNMAN.md']);
    assert.strictEqual(wholeReads, 0, 'the large file is not read whole');
    assert.deepStrictEqual(cutNest.feynman.what_changed, whole.feynman.what_changed, 'the part before the cut is read as before');
    const text = B.renderBrief({ sectionPath, roomDir, now: NOW });
    assert.ok(text.indexOf('read only in part (first ' + max + ' bytes): FEYNMAN.md') !== -1, 'the brief names the file that was cut');
    fs.writeFileSync(feynman, original, 'utf8');
    assert.deepStrictEqual(NM.gatherNest({ roomDir: roomDir, sectionDir: sectionPath }).cut, []);
  });

  // ---- H. dash guard ----
  await check('H1. no em dash or en dash in the files of this plan', () => {
    const files = ['lib/core/feyminto/next-move.cjs', 'lib/core/feyminto/capability.cjs', 'lib/core/feyminto/brief.cjs', 'lib/core/strategy/goal-gate.cjs',
      'lib/mcp/tools/sensors.cjs', 'lib/memory/triple-context-formatter.cjs', 'tests/test-395-truth-and-cost.cjs', 'tests/run-all-395.sh']
      .map((f) => path.join(ROOT, f));
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
