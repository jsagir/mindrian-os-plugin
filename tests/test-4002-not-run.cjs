#!/usr/bin/env node
'use strict';
// Phase 400.2-07: the not-run states of the check step. Legs N1 to N4 (plan 08 adds the merge legs).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const DOOR_PATH = path.join(ROOT, 'scripts', 'persona-hats.cjs');

let failed = 0;
let passed = 0;
function check(label, fn) {
  try {
    fn();
    passed += 1;
    console.log('ok: ' + label);
  } catch (e) {
    failed += 1;
    console.log('FAIL: ' + label + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}

let door;
try {
  door = require(DOOR_PATH);
} catch (e) {
  console.log('FAIL: the door is missing: ' + (e && e.message ? e.message : String(e)));
  process.exit(1);
}

// ---- shared fixture of plan 07: a deep run up to the closed research step ----
const HATS = ['white', 'red', 'black', 'yellow', 'green', 'blue'];
const READ_HATS = ['white', 'red', 'black', 'yellow', 'green'];
const NOW = new Date('2026-11-25T10:20:30.000Z');
const tmpRoots = [];

function mkTmp(label) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-4002-' + label + '-'));
  tmpRoots.push(d);
  return d;
}

function put(room, rel, text) {
  const abs = path.join(room, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text, 'utf8');
}

function makeRoom() {
  const room = mkTmp('room');
  put(room, 'STATE.md', '---\nventure: Harbor Light Studio\nstage: seed\n---\n\n# Harbor Light Studio\n\nA test venture.\n');
  put(room, 'problem-definition/core-problem.md', '# Core problem\nSmall studios lose clients at the hand-off.\n');
  put(room, 'market-analysis/size.md', '# Size\nAbout 4000 studios in the region.\n');
  return room;
}

function counterHex() {
  let n = 0;
  return (len) => {
    n += 1;
    return crypto.createHash('sha256').update('seam-' + n).digest('hex').slice(0, len);
  };
}

function makeEnv() {
  const e = { homeDir: mkTmp('home'), tmpDir: mkTmp('tmp') };
  e.opts = () => ({ homeDir: e.homeDir, tmpDir: e.tmpDir, now: NOW, randomHex: counterHex() });
  return e;
}

function validSpec(hat) {
  return { schema: 'mos.persona-spec/1', hat, focus: 'Look at the ' + hat + ' side.', hat_questions: ['What does the room show?', 'What is missing?', 'What would change the view?'], must_not_judge: ['The price level.'], room_sources: ['problem-definition/core-problem.md'] };
}

// Start deep, build the six personas (hats named in noSpec get no spec file), answer the card
// (hats named in refuse are refused), and close plan_research with the no-plan branch.
function runToResearchClosed(over) {
  const o = over || {};
  const room = makeRoom();
  const env = makeEnv();
  const bp = path.join(mkTmp('brief'), 'brief.json');
  fs.writeFileSync(bp, JSON.stringify({
    schema: 'mos.persona-brief/1', target: 'room',
    governing_question: 'Should the studio move to a fixed monthly retainer model for new clients?',
    sub_questions: ['Who pays first?', 'What breaks at the hand-off?'],
    reading_list: ['problem-definition/core-problem.md', 'market-analysis/size.md'],
    mode: 'deep', triage: { recommended: 'deep', reason: 'A pricing change.' },
  }), 'utf8');
  const res = door.cmdStart({ roomDir: room, briefPath: bp, mode: 'deep' }, env.opts());
  assert.equal(res.ok, true, JSON.stringify(res));
  for (const h of HATS) {
    if ((o.noSpec || []).includes(h)) continue;
    fs.writeFileSync(path.join(res.hats[h].dir, 'persona.json'), JSON.stringify(validSpec(h)), 'utf8');
  }
  assert.equal(door.cmdWritePersona({ roomDir: room, runId: res.run_id }, env.opts()).ok, true);
  const answer = {};
  for (const h of HATS) {
    if ((o.noSpec || []).includes(h)) continue;
    answer[h] = { decision: (o.refuse || []).includes(h) ? 'refuse' : 'accept' };
  }
  const ap = path.join(mkTmp('answer'), 'answer.json');
  fs.writeFileSync(ap, JSON.stringify({ schema: 'mos.persona-accept/1', run_id: res.run_id, hats: answer }), 'utf8');
  const a = door.cmdAcceptPersona({ roomDir: room, runId: res.run_id, answerPath: ap }, env.opts());
  assert.equal(a.ok && a.accept_done, true, JSON.stringify(a));
  const p = door.cmdPlanResearch({ roomDir: room, runId: res.run_id }, env.opts());
  assert.equal(p.ok, true, JSON.stringify(p));
  const ledger = () => JSON.parse(fs.readFileSync(path.join(res.review_dir, 'run.json'), 'utf8'));
  const ids = ledger().sub_questions.map(s => s.id);
  return { room, env, res, ids, ledger };
}

function validReading(hat, run, over) {
  const base = { schema: 'mos.persona-reading/1', run_id: run.res.run_id, hat };
  const value = hat === 'green' ? 'alternative_offered' : 'favours';
  base.positions = run.ids.map(id => ({ sub_question: id, value, line: 'A short line.' }));
  if (hat === 'white') Object.assign(base, { evidence: [], missing_data: ['The price of rival plans.'] });
  if (hat === 'black') Object.assign(base, { evidence: [], steelman: 'The best case.' });
  if (hat === 'yellow') Object.assign(base, { evidence: [], none_found: false });
  if (hat === 'green') Object.assign(base, { provocations: ['What if the client owns the hand-off?'], evidence: [] });
  return Object.assign(base, over || {});
}

function writeReading(run, hat, obj) {
  fs.writeFileSync(path.join(run.res.hats[hat].dir, 'reading.json'), typeof obj === 'string' ? obj : JSON.stringify(obj), 'utf8');
}

function doCheck(run) {
  return door.cmdCheck({ roomDir: run.room, runId: run.res.run_id }, run.env.opts());
}

// N1
check('N1. NEGATIVE: a hat with no reading.json is not_run:no_reading_file in the ledger and the output', () => {
  const run = runToResearchClosed();
  for (const h of READ_HATS) if (h !== 'white') writeReading(run, h, validReading(h, run));
  const out = doCheck(run);
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(out.hats.white.reading, 'not_run:no_reading_file');
  assert.deepEqual(out.not_run, [{ hat: 'white', reason: 'no_reading_file', state: 'not_run:no_reading_file' }]);
  const ledger = run.ledger();
  assert.equal(ledger.hats.white.reading, 'not_run:no_reading_file');
  assert.equal(ledger.hats.white.reading_sha256, undefined);
  assert.equal(ledger.hats.red.reading, 'ran');
  assert.equal(ledger.steps.check.state, 'done');
  assert.ok(ledger.steps.check.seq > ledger.steps.run_research.seq);
  const blue = JSON.parse(fs.readFileSync(out.blue_ledger, 'utf8'));
  assert.equal(blue.hats.white.reading, 'not_run:no_reading_file');
});

// N2
check('N2. a refused persona and a failed build are not run; check does not look for their files', () => {
  const run = runToResearchClosed({ refuse: ['red'], noSpec: ['yellow'] });
  const ledger0 = run.ledger();
  assert.equal(ledger0.hats.red.persona, 'refused');
  assert.equal(ledger0.hats.yellow.persona, 'build_failed');
  // A valid reading file is present for both hats; a check that looked at it would say "ran".
  writeReading(run, 'red', validReading('red', run));
  writeReading(run, 'yellow', validReading('yellow', run));
  for (const h of ['white', 'black', 'green']) writeReading(run, h, validReading(h, run));
  const out = doCheck(run);
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(out.hats.red.reading, 'not_run:persona_refused');
  assert.equal(out.hats.yellow.reading, 'not_run:persona_build_failed');
  assert.equal(out.hats.white.reading, 'ran');
  assert.deepEqual(out.not_run.map(n => n.hat).sort(), ['red', 'yellow']);
  const ledger = run.ledger();
  assert.equal(ledger.hats.red.reading_sha256, undefined);
  assert.equal(ledger.hats.yellow.reading_sha256, undefined);
});

// N3
check('N3. a schema fault and a citation fault are rejected with a reason and reported as not run', () => {
  const run = runToResearchClosed();
  writeReading(run, 'white', validReading('white', run));
  writeReading(run, 'red', validReading('red', run, { evidence: [{ source: 'x', tier: 'T1' }] }));
  writeReading(run, 'black', validReading('black', run, { evidence: [{ source: 'https://elsewhere.example.org/a', tier: 'self_found', disposition: 'disconfirming' }] }));
  writeReading(run, 'yellow', '{ not json');
  writeReading(run, 'green', validReading('green', run, { provocations: ['See EvidenceClaim:s9:abc for it.'] }));
  const out = doCheck(run);
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(out.hats.red.reading, 'rejected:forbidden_key:evidence');
  assert.equal(out.hats.black.reading, 'rejected:citation_outside_sources');
  assert.equal(out.hats.yellow.reading, 'rejected:schema_invalid:json');
  assert.equal(out.hats.green.reading, 'rejected:citation_outside_sources');
  assert.deepEqual(out.not_run.map(n => n.hat).sort(), ['black', 'green', 'red', 'yellow']);
  assert.deepEqual(out.not_run.find(n => n.hat === 'black'), { hat: 'black', reason: 'citation_outside_sources', state: 'rejected:citation_outside_sources' });
  const ledger = run.ledger();
  assert.equal(ledger.hats.red.reading, 'rejected:forbidden_key:evidence');
  // A rejected reading carries no counts into the ledger.
  assert.equal(ledger.hats.black.evidence_items, 0);
  assert.equal(ledger.hats.black.positions_taken, 0);
  // The refused text is not echoed.
  assert.equal(JSON.stringify(out).includes('elsewhere.example.org'), false);
  assert.equal(JSON.stringify(out).includes('EvidenceClaim:s9'), false);
});

// N4
check('N4. the router runs plan-research and check as subcommands and prints one JSON object', () => {
  const run = runToResearchClosed();
  const room = run.room;
  const env = run.env;
  const env2 = Object.assign({}, process.env, { MINDRIAN_HOME: env.homeDir });
  // The step plan_research is closed already by the fixture; the CLI call must refuse a second one by name.
  const again = spawnSync(process.execPath, [DOOR_PATH, 'plan-research', '--room', room, '--run', run.res.run_id], { env: env2, encoding: 'utf8' });
  assert.equal(again.status, 0, again.stderr);
  assert.equal(JSON.parse(again.stdout).reason, 'step_already_done:run_research');
  for (const h of READ_HATS) writeReading(run, h, validReading(h, run));
  const out = spawnSync(process.execPath, [DOOR_PATH, 'check', '--room', room, '--run', run.res.run_id], { env: env2, encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr);
  const parsed = JSON.parse(out.stdout);
  assert.equal(parsed.ok, true, out.stdout);
  assert.equal(parsed.hats.white.reading, 'ran');
  const usage = spawnSync(process.execPath, [DOOR_PATH, 'check', '--room', room], { env: env2, encoding: 'utf8' });
  assert.equal(usage.status, 2);
});

for (const d of tmpRoots) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}
console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
