#!/usr/bin/env node
'use strict';
/*
 * Phase 369.25 plan 24 -- the stop condition: the FeyMinto design v2 practical test, scripted as a fixture test.
 *
 * The test (.planning/briefs/2026-10-05-prove-one-authority/FEYMINTO-DESIGN-v2.md): "A returning navigator should be able
 * to identify the job, explain the current argument, locate its weakest assumption and understand the proposed move. When
 * contradictory evidence arrives, the brief should reveal what needs reconsideration."
 *
 * Every assertion in P1-P5 reads the text of BRIEF.md alone (a returning navigator opens one file). The fixture is set up
 * the way a person and the shipped triggers would set it up: a born room, two filed artifacts, a claim and two assumptions
 * recorded through lib/core/navigation.cjs, the MINTO generator, the governing thought a person wrote, and scripts/on-stop
 * (which renders BRIEF.md).
 *
 * Arms:
 *   P1  job         THIS NEST SERVES names the nest's job id (from data/section-job-canon.json) and its statement
 *   P2  argument    WE CURRENTLY THINK carries the governing thought; BECAUSE carries a claim with a claim-state word and
 *                   that word's definition
 *   P3  weakest     with two assumptions recorded (one unvalidated, one a person confirmed), BUT opens with
 *                   'Weakest assumption:' naming the unvalidated one and does not name the confirmed one as weakest
 *   P4  move        PROPOSED NEXT MOVE names a primary command and why, and the four record lines (proposed, selected,
 *                   attempted, verified) stand apart
 *   P5  evidence    after a CONTRADICTS record is filed against the nest's claim and the generator and on-stop run again,
 *                   BUT lists the contradiction, THE QUESTION THAT MATTERS NOW names it, and record_basis_fingerprint
 *                   differs from before
 *   P5b             WHAT CHANGED mentions the new contradiction (a separate arm so the owner of a failure is plain)
 *   P6  MEASURED    (carry-over, labeled; never a pass or a fail of the product) a full session-start then on-stop cycle on a
 *                   born fixture room: is each brief fresh at the end, and if not, which input moved
 *   P7  KNOWN GAP   (carry-over from plan 21, labeled; not a pass) decide()'s offer against the brief's composed primary,
 *                   measured live over the fixture room's nests and printed with its counts
 *   P8  dash guard
 *
 * Isolation: every room lives under an isolated mkdtemp HOME and rooms home (tests/helpers/isolated-home-36925.cjs). No
 * Theo call is made (rooms are born with the Theo face not asked). Nothing is written under ~/MindrianRooms or ~/.mindrian.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const H = require('./helpers/isolated-home-36925.cjs');

const SEC = 'problem-definition';
const GEN = path.join(ROOT, 'scripts', 'vault-section-minto-generator.cjs');
const ON_STOP = path.join(ROOT, 'scripts', 'on-stop');
const SESSION_START = path.join(ROOT, 'scripts', 'session-start');
const SEED_SQL = path.join(ROOT, 'tests', 'fixtures', 'phase-109', 'sample-room', 'seed.sql');
const CLAIM_TEXT = 'Founders say onboarding takes three weeks';
const THOUGHT = 'Onboarding takes too long because nobody owns the first week';
const ASSUME_OPEN = 'The buyer is also the daily user';
const ASSUME_DONE = 'New hires can start without a laptop';
const CONTRA_TEXT = 'Interviewed teams pay to fix this problem today';
const TEN = [
  '## THIS NEST SERVES', '## WE CURRENTLY THINK', '## BECAUSE', '## BUT', '## WHAT CHANGED',
  '## THE QUESTION THAT MATTERS NOW', '## PROPOSED NEXT MOVE', "## THEO'S CONTRIBUTION", '## YOUR DECISION', '## RECORD BASIS',
];

const arms = [];
function arm(name, fn) { arms.push({ name, fn }); }
function check(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) {
  const x = JSON.stringify(a);
  const y = JSON.stringify(b);
  if (x !== y) throw new Error(msg + ' (expected ' + y + ', got ' + x + ')');
}
function has(text, needle, msg) { check(String(text).indexOf(needle) !== -1, (msg || 'missing') + ': ' + JSON.stringify(needle) + ' in\n' + String(text).slice(0, 1600)); }

function nav() { return require(path.join(ROOT, 'lib', 'core', 'navigation.cjs')); }
function insertNode() { return require(path.join(ROOT, 'lib', 'core', 'node-insert.cjs')).insertNode; }

// ---- fixtures ----------------------------------------------------------------------------------------------------

function born(tag) {
  const iso = H.mkIsolatedHome(tag);
  const slug = 'pr-' + tag;
  const b = H.birthFixtureRoom({ iso, slug, vname: 'Quokka Labs', ventureText: 'Quokka Labs onboarding platform' });
  if (!b || b.ok !== true) throw new Error('fixture birth failed for ' + slug + ': ' + JSON.stringify(b));
  const roomDir = fs.realpathSync(b.roomDir);
  return { iso, roomDir, slug, sectionPath: path.join(roomDir, SEC) };
}
function gen(room) {
  const r = spawnSync(process.execPath, [GEN, '--write', room.roomDir, '--section', SEC], { env: room.iso.env, encoding: 'utf8', timeout: 90000 });
  if (r.status !== 0) throw new Error('generator exit ' + r.status + '\n' + r.stderr + r.stdout);
}
function stop(room) {
  const r = spawnSync('bash', [ON_STOP], { cwd: room.roomDir, env: room.iso.env, input: '', encoding: 'utf8', timeout: 60000 });
  if (r.status !== 0) throw new Error('on-stop exit ' + r.status + '\n' + String(r.stderr).slice(-300));
  return r;
}
function sha(text) { return crypto.createHash('sha256').update(text).digest('hex'); }
// scripts/on-stop recompiles every ROOM.md under a 0.4 s timeout per nest, so on a loaded machine some recompiles land at the
// next stop (a race recorded by plan 19). ROOM.md is a brief input: stop until every ROOM.md reads the same as at the last stop.
function roomMdHashes(roomDir) {
  const o = {};
  fs.readdirSync(roomDir, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name[0] !== '.').forEach((d) => {
    try { o[d.name] = sha(fs.readFileSync(path.join(roomDir, d.name, 'ROOM.md'), 'utf8')); } catch (_e) { o[d.name] = null; }
  });
  return JSON.stringify(o);
}
function settle(room) {
  let prev = null;
  for (let i = 1; i <= 8; i += 1) {
    stop(room);
    const h = roomMdHashes(room.roomDir);
    if (h === prev) return i;
    prev = h;
  }
  throw new Error('ROOM.md recompiles did not settle in 8 stops');
}
function plantThought(room, text) {
  const mp = path.join(room.sectionPath, 'MINTO.md');
  const t = fs.readFileSync(mp, 'utf8').replace(/^governing_thought: ".*"$/m, 'governing_thought: "' + text + '"').replace(/^governing_thought_placeholder: true\n/m, '');
  fs.writeFileSync(mp, t, 'utf8');
}
function writeArtifacts(room) {
  fs.writeFileSync(path.join(room.sectionPath, 'interview-notes.md'),
    '---\ntitle: Zanzibar onboarding interview\nframework: 5 Whys Technique\n---\n# Zanzibar onboarding interview\n\nFounders say onboarding takes three weeks.\n', 'utf8');
  fs.writeFileSync(path.join(room.sectionPath, 'problem-statement.md'),
    '---\ntitle: Problem statement\nframeworks: [80/20 Rule]\n---\n# Problem statement\n\nNew hires wait too long to be useful.\n', 'utf8');
}
// One claim and two assumptions recorded on a handle opened through the navigation door (nodes through the node chokepoint);
// the claim depends on both assumptions.
function recordClaimAndAssumptions(room) {
  const db = nav().openRoomDbForCaller(room.roomDir);
  try {
    const opts = { source_path: 'test:36925-practical', created_by: 'user', epistemic_type: 'observation', review_status: 'proposed' };
    insertNode()(db, 'claim:pr-a', 'claim', JSON.stringify({ section: SEC, text: CLAIM_TEXT }), opts);
    const asm = Object.assign({}, opts, { epistemic_type: 'assumption' });
    insertNode()(db, 'assumption:pr-open', 'assumption', JSON.stringify({ section: SEC, text: ASSUME_OPEN }), asm);
    insertNode()(db, 'assumption:pr-done', 'assumption', JSON.stringify({ section: SEC, text: ASSUME_DONE }), Object.assign({}, asm, { review_status: 'confirmed' }));
    // writeEdge's closed vocabulary has no DEPENDS_ON (the navigation door only reads the cascade: findBlockingAssumptions), so
    // the edge is written the way the plan 15 and plan 18 fixtures write it, on the handle the door opened.
    ['assumption:pr-open', 'assumption:pr-done'].forEach((id) => {
      db.prepare("INSERT INTO edges (source, target, type, properties) VALUES (?, ?, 'DEPENDS_ON', '{}')").run('claim:pr-a', id);
    });
  } finally { nav().closeRoomDbForCaller(db); }
}
function fileContradiction(room) {
  const db = nav().openRoomDbForCaller(room.roomDir);
  try {
    const opts = { source_path: 'test:36925-practical-contra', created_by: 'user', epistemic_type: 'observation', review_status: 'proposed' };
    insertNode()(db, 'claim:pr-b', 'claim', JSON.stringify({ section: 'market-analysis', text: CONTRA_TEXT }), opts);
    const w = nav().writeEdge(db, { source_id: 'claim:pr-a', target_id: 'claim:pr-b', edge_type: 'CONTRADICTS' });
    check(w && w.ok === true, 'writeEdge CONTRADICTS: ' + JSON.stringify(w));
  } finally { nav().closeRoomDbForCaller(db); }
}

// ---- reading BRIEF.md (the only thing P1-P5 look at) --------------------------------------------------------------

function readBrief(room) { return fs.readFileSync(path.join(room.sectionPath, 'BRIEF.md'), 'utf8'); }
function bodyOf(text) { const m = text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/); return m ? m[1] : text; }
function fmOf(text) {
  const m = String(text).match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const out = {};
  if (!m) return out;
  m[1].split(/\r?\n/).forEach((ln) => { const k = ln.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/); if (k) out[k[1]] = k[2].replace(/^"(.*)"$/, '$1'); });
  return out;
}
function block(text, heading) {
  const b = bodyOf(text);
  const a = b.indexOf('\n' + heading + '\n');
  if (a === -1) return null;
  const rest = b.slice(a + heading.length + 2);
  const n = rest.search(/^## /m);
  return (n === -1 ? rest : rest.slice(0, n)).trim();
}
function h2s(text) { return bodyOf(text).match(/^## .+$/gm) || []; }
function vocab() { return JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'claim-state-vocabulary.json'), 'utf8')); }
function canonJob() { return JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'section-job-canon.json'), 'utf8')).sections[SEC].job_id; }

// The shared fixture: built once, used by P1-P5 (P5 mutates it last).
let SHARED = null;
function shared() {
  if (SHARED) return SHARED;
  const room = born('argue');
  writeArtifacts(room);
  recordClaimAndAssumptions(room);
  gen(room);
  plantThought(room, THOUGHT);
  settle(room);
  const text = readBrief(room);
  SHARED = { room, first: text };
  return SHARED;
}

// ---- P1 ---------------------------------------------------------------------------------------------------------

arm('P1 job: THIS NEST SERVES names the nest job from the canon and states it', () => {
  const { first } = shared();
  eq(h2s(first), TEN, 'BRIEF.md carries the ten blocks in order');
  const serves = block(first, '## THIS NEST SERVES');
  const job = canonJob();
  has(serves, 'Job: ' + job + '.', 'the job id from data/section-job-canon.json');
  const statement = serves.replace('Job: ' + job + '.', '').trim();
  check(statement.length >= 30, 'no job statement after the job id (' + statement.length + ' chars): ' + serves);
  check(!/not declared/.test(serves) && !/carries no statement/.test(serves), 'the job reads as undeclared: ' + serves);
  check(/\bstranger\b|\bproblem\b/i.test(statement), 'the statement does not read as a job for a problem nest: ' + statement);
});

// ---- P2 ---------------------------------------------------------------------------------------------------------

arm('P2 argument: WE CURRENTLY THINK carries the governing thought; BECAUSE carries a claim with its claim-state word and definition', () => {
  const { first } = shared();
  const think = block(first, '## WE CURRENTLY THINK');
  has(think, THOUGHT, 'the governing thought a person wrote');
  check(think.indexOf('No governing thought yet') === -1, 'a stated thought reads unresolved: ' + think);
  const because = block(first, '## BECAUSE');
  has(because, CLAIM_TEXT, 'the claim filed in the room');
  const V = vocab();
  const used = V.labels.filter((l) => because.indexOf('[' + l.label + ': ') !== -1);
  check(used.length >= 1, 'no claim-state word in BECAUSE: ' + because);
  used.forEach((l) => has(because, '[' + l.label + ': ' + l.definition + ';', 'the word ' + l.label + ' shown with its definition'));
  has(because, 'record: ', 'the record the word stands on');
});

// ---- P3 ---------------------------------------------------------------------------------------------------------

arm('P3 weakest assumption: BUT opens with the unvalidated assumption, not the one a person confirmed', () => {
  const { first } = shared();
  const but = block(first, '## BUT');
  const lines = but.split('\n').filter((l) => l.trim().length > 0);
  check(/^Weakest assumption: /.test(lines[0]), 'BUT does not open with Weakest assumption: ' + lines[0]);
  has(lines[0], ASSUME_OPEN, 'the unvalidated assumption is named first');
  has(lines[0], '(proposed)', 'its validity is shown');
  check(but.indexOf(ASSUME_DONE) === -1, 'the assumption a person confirmed is named in BUT as if open: ' + but);
});

// ---- P4 ---------------------------------------------------------------------------------------------------------

arm('P4 proposed move: a primary command and why; the four record lines stand apart', () => {
  const { first } = shared();
  const move = block(first, '## PROPOSED NEXT MOVE');
  const primary = move.match(/(?:^|\n)(?:Primary: |On the command line: )\/mos:([a-z0-9-]+)/);
  check(!!primary, 'no primary command named: ' + move);
  check(/\n?(?:Why|\. Why): .{10,}/.test(move), 'the primary has no stated reason: ' + move);
  const four = [/^Proposed: .*\/mos:[a-z0-9-]+.*\(a proposal; nothing has run\)$/m, /^Selected: /m, /^Attempted: /m, /^Verified: /m];
  four.forEach((re, i) => check(re.test(move), 'record line ' + ['Proposed', 'Selected', 'Attempted', 'Verified'][i] + ' missing or not on its own line: ' + move));
  check(/^Selected: none yet$/m.test(move) && /^Attempted: none yet$/m.test(move), 'a move nobody chose or ran must not read as selected or attempted: ' + move);
  check(!/^Verified: [^n]/m.test(move) || /none of them is a result of the move above/.test(move), 'a verified line claims a result of the move: ' + move);
  const question = block(first, '## THE QUESTION THAT MATTERS NOW');
  check(question.length > 0 && question !== 'Not yet stated.', 'the question that matters now is not stated: ' + question);
});

// ---- P5 ---------------------------------------------------------------------------------------------------------

arm('P5 contradictory evidence: BUT lists it, THE QUESTION names it, the record basis moved', () => {
  const { room, first } = shared();
  const before = fmOf(first);
  check(block(first, '## BUT').indexOf(CONTRA_TEXT) === -1, 'the contradiction is in the brief before it was filed');
  fileContradiction(room);
  gen(room);
  plantThought(room, THOUGHT);
  settle(room);
  const after = readBrief(room);
  SHARED.after = after;
  const f = fmOf(after);
  const but = block(after, '## BUT');
  has(but, 'Counterevidence:', 'BUT has a counterevidence list');
  has(but, CONTRA_TEXT, 'BUT lists the contradicting claim');
  has(but, CLAIM_TEXT.slice(0, 20), 'BUT says what it contradicts');
  const q = block(after, '## THE QUESTION THAT MATTERS NOW');
  has(q, CONTRA_TEXT, 'THE QUESTION THAT MATTERS NOW names the contradiction');
  check(f.record_basis_fingerprint !== before.record_basis_fingerprint, 'record_basis_fingerprint did not change: ' + f.record_basis_fingerprint);
  check(f.record_basis_full_fingerprint !== before.record_basis_full_fingerprint, 'record_basis_full_fingerprint did not change');
  const basis = block(after, '## RECORD BASIS');
  has(basis, 'Fingerprint: ' + f.record_basis_fingerprint, 'the basis block shows the new fingerprint');
  // the assumption is still named: the contradiction adds to what needs reconsidering, it does not replace it
  has(but, ASSUME_OPEN, 'the weakest assumption is still named');
});

arm('P5b contradictory evidence: WHAT CHANGED mentions the new contradiction (design v2: the brief reveals what needs reconsideration)', () => {
  const { after } = shared();
  check(typeof after === 'string', 'P5 did not run first (no brief after the contradiction)');
  const changed = block(after, '## WHAT CHANGED');
  check(changed.indexOf(CONTRA_TEXT) !== -1 || /counterevidence|contradict/i.test(changed),
    'WHAT CHANGED does not mention the new contradiction (owner: the FEYNMAN what-changed list written by updateFeynmanFace in scripts/vault-section-minto-generator.cjs, plan 369.25-15, which lists sources added or removed, a changed governing thought and decisions only): ' + changed);
});

// ---- P6 ---------------------------------------------------------------------------------------------------------

// The inputs a brief was rendered from, as it names them, against the files now on disk.
function movedInputs(briefText, sectionPath) {
  const moved = [];
  const basis = block(briefText, '## RECORD BASIS') || '';
  basis.split('\n').forEach((ln) => {
    const m = ln.match(/^- ([A-Z]+\.md) (sha256:[0-9a-f]{64}) modified /);
    if (!m) return;
    let now = null;
    try { now = 'sha256:' + sha(fs.readFileSync(path.join(sectionPath, m[1]))); } catch (_e) { now = null; }
    if (now !== m[2]) moved.push(m[1] + (now === null ? ' (gone)' : ''));
  });
  return moved;
}
function nestsWithBrief(roomDir) {
  return fs.readdirSync(roomDir, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name[0] !== '.' && fs.existsSync(path.join(roomDir, d.name, 'BRIEF.md'))).map((d) => d.name).sort();
}
function freshness(room, nests) {
  const F = require(path.join(ROOT, 'lib', 'memory', 'triple-context-formatter.cjs'));
  const out = {};
  nests.forEach((n) => {
    const head = F.assembleBriefHead({ roomDir: room.roomDir, section: n });
    const text = fs.readFileSync(path.join(room.roomDir, n, 'BRIEF.md'), 'utf8');
    out[n] = { state: head.state, moved: head.state === 'stale' ? movedInputs(text, path.join(room.roomDir, n)) : [] };
  });
  return out;
}
function recordBasisFingerprints(room, nests) {
  const B = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'brief.cjs'));
  return nests.map((n) => B.recordBasis(path.join(room.roomDir, n)).fingerprint).join('|');
}

// Wait for the background guardian the hook starts (scripts/feynman-minto-guardian.cjs) to finish for this room: no such process
// left for the room and every nest's input fingerprint equal across two samples 1.5 s apart (at most 90 s). Returns the facts.
function guardianRunning(roomDir) {
  const r = spawnSync('pgrep', ['-f', 'feynman-minto-guardian.cjs .*' + roomDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')], { encoding: 'utf8' });
  return r.status === 0 && String(r.stdout).trim().length > 0;
}
async function settleGuardian(room, nests) {
  let prev = recordBasisFingerprints(room, nests);
  let waited = 0;
  let sawGuardian = guardianRunning(room.roomDir);
  let moved = false;
  for (let i = 0; i < 60; i += 1) {
    await new Promise((r) => setTimeout(r, 1500));
    waited += 1.5;
    const running = guardianRunning(room.roomDir);
    sawGuardian = sawGuardian || running;
    const cur = recordBasisFingerprints(room, nests);
    if (cur !== prev) moved = true;
    if (cur === prev && !running) break;
    prev = cur;
  }
  return { waited, sawGuardian, moved };
}
function hookText(room, ss) {
  return String(ss.stdout || '').replace(/\\n/g, '\n');
}

arm('P6 MEASURED (carry-over, not a verdict): is a brief fresh after a full session-start then on-stop cycle on a born room', async () => {
  const room = born('cycle');
  const nestsAll = fs.readdirSync(room.roomDir, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name[0] !== '.').map((d) => d.name);
  const t0 = Date.now();
  const ss = spawnSync('bash', [SESSION_START], { cwd: room.roomDir, env: room.iso.env, encoding: 'utf8', timeout: 240000 });
  const ssMs = Date.now() - t0;
  check(ss.status === 0, 'session-start exit ' + ss.status + ' ' + String(ss.stderr || '').slice(-200));
  // The hook starts the Feynman-MINTO guardian in the background; it can regenerate FEYNMAN.md after the hook returned.
  const g1 = await settleGuardian(room, nestsAll);
  // The shipped on-stop writer (plan 19) renders every brief. One stop is the cycle; a second shows whether it is stable.
  const t1 = Date.now();
  stop(room);
  const stopMs = Date.now() - t1;
  const nests = nestsWithBrief(room.roomDir);
  check(nests.length > 0, 'no BRIEF.md after session-start then on-stop');
  const afterOne = freshness(room, nests);
  const staleOne = nests.filter((n) => afterOne[n].state !== 'fresh');
  stop(room);
  const afterTwo = freshness(room, nests);
  const staleTwo = nests.filter((n) => afterTwo[n].state !== 'fresh');
  // The next session: the hook starts again in the same room; what does the navigator read at its head, and does the
  // guardian it starts move any brief input after it returned?
  const feyBefore = {};
  nests.forEach((n) => { try { feyBefore[n] = fs.readFileSync(path.join(room.roomDir, n, 'FEYNMAN.md'), 'utf8'); } catch (_e) { feyBefore[n] = null; } });
  const t2 = Date.now();
  const ss2 = spawnSync('bash', [SESSION_START], { cwd: room.roomDir, env: room.iso.env, encoding: 'utf8', timeout: 240000 });
  const ss2Ms = Date.now() - t2;
  check(ss2.status === 0, 'second session-start exit ' + ss2.status);
  const printedStale = /stale: inputs changed since this brief was written/.test(hookText(room, ss2));
  const staleAtHook = (hookText(room, ss2).match(/stale: inputs changed since this brief was written[^\n]*/) || [''])[0];
  const g2 = await settleGuardian(room, nestsAll);
  const afterNext = freshness(room, nests);
  const staleNext = nests.filter((n) => afterNext[n].state !== 'fresh');
  // The same session ends: on-stop renders again.
  stop(room);
  const afterNextStop = freshness(room, nests);
  const staleNextStop = nests.filter((n) => afterNextStop[n].state !== 'fresh');
  const fmt = (st, list) => list.length === 0 ? 'all ' + nests.length + ' briefs fresh' : list.length + ' of ' + nests.length + ' stale: ' + list.map((n) => n + ' [' + st[n].moved.join(',') + ']').join('; ');
  // What exactly moved in FEYNMAN.md across the second session-start: the changed lines of every nest, counted by line.
  const lineCounts = {};
  let feyChanged = 0;
  nests.forEach((n) => {
    let now = null;
    try { now = fs.readFileSync(path.join(room.roomDir, n, 'FEYNMAN.md'), 'utf8'); } catch (_e) { now = null; }
    if (now === feyBefore[n]) return;
    feyChanged += 1;
    const a = String(feyBefore[n] || '').split('\n');
    const b = String(now || '').split('\n');
    const was = new Set(a);
    const nowSet = new Set(b);
    b.filter((l) => !was.has(l)).forEach((l) => { const k = '+ ' + l.slice(0, 90); lineCounts[k] = (lineCounts[k] || 0) + 1; });
    a.filter((l) => !nowSet.has(l)).forEach((l) => { const k = '- ' + l.slice(0, 90); lineCounts[k] = (lineCounts[k] || 0) + 1; });
  });
  console.log('    MEASURED P6: session-start ' + ssMs + ' ms; waited ' + g1.waited.toFixed(1) + ' s for the guardian (a guardian process seen: ' + g1.sawGuardian + ', an input moved while waiting: ' + g1.moved + '); on-stop ' + stopMs + ' ms');
  console.log('    MEASURED P6: after session-start, settle, one on-stop: ' + fmt(afterOne, staleOne));
  console.log('    MEASURED P6: after a second on-stop: ' + fmt(afterTwo, staleTwo));
  console.log('    MEASURED P6: a second session-start (' + ss2Ms + ' ms) printed a stale marker at the head: ' + printedStale + (printedStale ? ' (' + staleAtHook + ')' : ''));
  console.log('    MEASURED P6: after the second session-start and its guardian (waited ' + g2.waited.toFixed(1) + ' s, guardian seen: ' + g2.sawGuardian + ', input moved: ' + g2.moved + '): ' + fmt(afterNext, staleNext));
  console.log('    MEASURED P6: then the on-stop of that second session: ' + fmt(afterNextStop, staleNextStop));
  console.log('    MEASURED P6: across the second session-start FEYNMAN.md changed in ' + feyChanged + ' of ' + nests.length + ' nests; changed lines (count of nests): ' + (Object.keys(lineCounts).length === 0 ? 'none' : Object.keys(lineCounts).map((k) => JSON.stringify(k) + ' x' + lineCounts[k]).join(' | ')));
  if (staleOne.length > 0 || printedStale || staleNext.length > 0 || staleNextStop.length > 0) console.log('    KNOWN GAP P6 (not a pass): a brief can read stale; the input that moved is named above. Not fixed in plan 24.');
});

// ---- P7 ---------------------------------------------------------------------------------------------------------

arm('P7 KNOWN GAP (carry-over from plan 21, not a pass): decide() offer against the brief primary, measured live', () => {
  const room = born('gap');
  const { openRoomDb, closeRoomDb } = require(path.join(ROOT, 'lib', 'core', 'room-db.cjs'));
  const sdb = openRoomDb(room.roomDir);
  try { sdb.exec(fs.readFileSync(SEED_SQL, 'utf8')); } finally { closeRoomDb(sdb); }
  const NM = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'next-move.cjs'));
  const engine = require(path.join(ROOT, 'lib', 'core', 'navigation-engine.cjs'));
  const folderMemory = require(path.join(ROOT, 'lib', 'core', 'folder-memory.cjs'));
  const nests = fs.readdirSync(room.roomDir, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name[0] !== '.').map((d) => d.name).sort();
  const rows = [];
  nests.forEach((s) => {
    const sp = path.join(room.roomDir, s);
    const nm = NM.nextMoveForSection({ roomDir: room.roomDir, sectionDir: sp, surface: 'mcp' });
    if (!nm || !nm.primary) return;
    const db = nav().openRoomDbForCaller(room.roomDir);
    try {
      const ctx = {
        quadruple: folderMemory.readQuadruple(sp), brainAvailable: false,
        userPersona: { archetype: 'Founder', problem_type: 'IDP', venture_stage: 'discovery' },
        sectionPath: s, problemType: 'IDP', roomDir: room.roomDir, section: s,
        operator: 'DECISION_GATE', jtbd: 'size the addressable market', roomState: { db, roomDir: room.roomDir },
      };
      const d = engine.decide({ userText: null, sectionPath: s, sessionId: 's-p7' }, ctx);
      const offer = d && d.offer_next_step && d.offer_next_step.command;
      if (typeof offer !== 'string') return;
      const ids = (ctx.tierCandidates && ctx.tierCandidates[0] && ctx.tierCandidates[0].items || []).map((i) => i.id);
      rows.push({ section: s, primary: '/mos:' + nm.primary.command, offer, inSet: ids.indexOf(offer) !== -1, equal: offer === '/mos:' + nm.primary.command });
    } finally { nav().closeRoomDbForCaller(db); }
  });
  const inSet = rows.filter((r) => r.inSet).length;
  const equal = rows.filter((r) => r.equal).length;
  console.log('    KNOWN GAP P7 (not a pass): of ' + nests.length + ' nests, ' + rows.length + ' produced a decide() offer; the offer was inside the face\'s set for ' + inSet + ' of ' + rows.length + ' and equal to the brief\'s composed primary for ' + equal + ' of ' + rows.length + '.');
  rows.forEach((r) => console.log('      ' + r.section + ': brief primary ' + r.primary + ', decide() offer ' + r.offer + (r.equal ? ' (equal)' : r.inSet ? ' (inside the set, not the primary)' : ' (outside the set)')));
  console.log('    Cause (plan 21): registry order dominates in lib/workflow/f-selector-ranker.cjs _applyTierFusion, so the engine follows the face\'s set, not its order. The ranker is not edited here.');
  check(rows.length >= 0, 'measurement ran');
});

// ---- P8 ---------------------------------------------------------------------------------------------------------

arm('P8 no em or en dash in the files this plan writes', () => {
  const files = [
    'tests/test-36925-practical.cjs', 'tests/test-muy-real-room-rule.cjs', 'scripts/release-lib/real-room-gate.sh',
    '.claude/includes/release-process.md',
  ].map((f) => path.join(ROOT, f));
  eq(H.dashGuard(files), [], 'no em or en dash');
  // the ruling doc carries older prose; the section this plan edits is RULE 10
  const rt = fs.readFileSync(path.join(ROOT, 'docs', 'RELEASE-CEREMONY-RULING-SYSTEM.md'), 'utf8');
  const at = rt.indexOf('## RULE 10');
  check(at !== -1, 'no RULE 10 section');
  const end = rt.indexOf('\n---', at);
  const sec = rt.slice(at, end === -1 ? rt.length : end);
  eq(H.dashGuard([]).concat(/[\u2013\u2014]/.test(sec) ? ['RULE 10'] : []), [], 'no em or en dash in RULE 10');
});

// ---- runner ------------------------------------------------------------------------------------------------------

(async () => {
  let passed = 0;
  let failed = 0;
  const failedNames = [];
  for (const a of arms) {
    try {
      await a.fn();
      passed += 1;
      console.log('PASS: ' + a.name);
    } catch (e) {
      failed += 1;
      failedNames.push(a.name);
      console.log('FAIL: ' + a.name + '\n    ' + String((e && e.message) || e).split('\n').join('\n    '));
    }
  }
  console.log('\ntest-36925-practical: ' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) console.log('FAILED ARMS: ' + failedNames.join(' | '));
  process.exit(failed === 0 ? 0 : 1);
})();
