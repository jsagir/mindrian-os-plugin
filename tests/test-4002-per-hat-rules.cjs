#!/usr/bin/env node
'use strict';
// Phase 400.2-07: the reading schema (S-6 with FS-4) and the per-hat rules (DESIGN 4.7 with FS-10, FS-11).
// Legs P1 to P10 (task 1: pure functions), P11 to P14 (task 2: check and the Blue ledger), P15 to P17 (plan 13: real research states).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const DOOR_PATH = path.join(ROOT, 'scripts', 'persona-hats.cjs');
const GOV_PATH = path.join(ROOT, 'lib', 'core', 'bono', 'hat-governance.cjs');
const ops = require(path.join(ROOT, 'lib', 'core', 'persona-ops.cjs'));

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

const HATS = ['white', 'red', 'black', 'yellow', 'green', 'blue'];
const RUN = '20261125-102030-abcd';
const SQ = ['sq-00000001', 'sq-00000002'];
const CTX = { runId: RUN, subQuestionIds: SQ };
const tmpRoots = [];
const NOW = new Date('2026-11-25T10:20:30.000Z');

function positions(hat, over) {
  const value = hat === 'green' ? 'alternative_offered' : 'favours';
  return SQ.map(id => Object.assign({ sub_question: id, value, line: 'A short line for ' + id + '.' }, over || {}));
}

function reading(hat, over) {
  const base = { schema: 'mos.persona-reading/1', run_id: RUN, hat };
  if (hat === 'blue') return Object.assign(base, { skipped: [], thin: ['The yellow hat found little.'], ask_next: ['Ask who pays first.'] }, over || {});
  base.positions = positions(hat);
  if (hat === 'white') Object.assign(base, { evidence: [{ source: 'EvidenceClaim:s1:aa', tier: 'T2', note: 'A fact.' }], missing_data: ['The price of rival plans.'], nothing_missing: false });
  if (hat === 'black') Object.assign(base, { evidence: [{ source: 'EvidenceClaim:s1:aa', tier: 'T2', disposition: 'disconfirming', note: 'A counter.' }, { source: 'EvidenceClaim:s1:bb', tier: 'T3', disposition: 'confirming' }], steelman: 'The best case for the retainer.' });
  if (hat === 'yellow') Object.assign(base, { evidence: [{ source: 'EvidenceClaim:s1:aa', tier: 'T2' }] });
  if (hat === 'green') Object.assign(base, { provocations: ['What if the client owns the hand-off?'], evidence: [{ source: 'EvidenceClaim:s1:aa', tier: 'T2' }] });
  return Object.assign(base, over || {});
}

// P1
check('P1. a valid reading of each of the six hats passes validateReading', () => {
  for (const h of HATS) {
    const r = door.validateReading(h, reading(h), CTX);
    assert.equal(r.ok, true, h + ': ' + JSON.stringify(r));
  }
  assert.deepEqual(door.READING_VALUES.positions.green, ['alternative_offered', 'no_position']);
  assert.ok(Object.isFrozen(door.READING_VALUES));
});

const FORBIDDEN = {
  white: ['justification', 'provocations', 'none_found', 'verdict', 'skipped', 'thin', 'ask_next'],
  red: ['evidence', 'justification', 'missing_data', 'provocations', 'none_found', 'verdict', 'self_search_strings', 'self_found_sources', 'skipped', 'thin', 'ask_next'],
  black: ['justification', 'provocations', 'none_found', 'verdict', 'missing_data', 'skipped', 'thin', 'ask_next'],
  yellow: ['justification', 'provocations', 'verdict', 'missing_data', 'skipped', 'thin', 'ask_next'],
  green: ['justification', 'verdict', 'none_found', 'missing_data', 'skipped', 'thin', 'ask_next'],
  blue: ['positions', 'evidence', 'justification', 'provocations', 'none_found', 'verdict', 'missing_data', 'self_search_strings', 'self_found_sources'],
};

// P2
check('P2. NEGATIVE: forbidden keys, unknown keys and each schema fault are refused by name', () => {
  for (const h of HATS) {
    for (const k of FORBIDDEN[h]) {
      const r = door.validateReading(h, reading(h, { [k]: ['x'] }), CTX);
      assert.equal(r.ok, false, h + ' ' + k);
      assert.equal(r.reason, 'forbidden_key:' + k, h + ' ' + k);
      assert.equal(r.state, 'rejected:forbidden_key:' + k);
    }
    const u = door.validateReading(h, reading(h, { bogus_key: 1 }), CTX);
    assert.equal(u.reason, 'unknown_key:bogus_key', h);
    // The old design key does not exist any more (owner answer 1).
    assert.equal(door.validateReading(h, reading(h, { validation_requests: [] }), CTX).reason, 'unknown_key:validation_requests', h);
  }
  const bad = (over, rx) => {
    const r = door.validateReading('black', reading('black', over), CTX);
    assert.equal(r.ok, false);
    assert.match(r.reason, rx);
  };
  bad({ positions: positions('black').slice(0, 1) }, /^schema_invalid:positions/);
  bad({ positions: positions('black').concat([{ sub_question: 'sq-00000009', value: 'favours', line: 'x' }]) }, /^schema_invalid:positions/);
  bad({ positions: [positions('black')[0], positions('black')[0]] }, /^schema_invalid:positions/);
  bad({ positions: [{ sub_question: 'sq-00000009', value: 'favours', line: 'x' }, positions('black')[1]] }, /^schema_invalid:positions\[0\]/);
  bad({ positions: [Object.assign({}, positions('black')[0], { value: 'alternative_offered' }), positions('black')[1]] }, /^schema_invalid:positions\[0\]\.value/);
  bad({ positions: [Object.assign({}, positions('black')[0], { line: 'x'.repeat(301) }), positions('black')[1]] }, /^schema_invalid:positions\[0\]\.line/);
  bad({ positions: [{ sub_question: SQ[0], value: 'favours' }, positions('black')[1]] }, /^schema_invalid:positions\[0\]\.line/);
  bad({ schema: 'nope' }, /^schema_invalid:schema/);
  bad({ run_id: 'other' }, /^schema_invalid:run_id/);
  bad({ hat: 'white' }, /^schema_invalid:hat/);
  assert.equal(door.validateReading('black', 'text', CTX).reason, 'schema_invalid:reading');
  // A no_position value needs no line.
  const np = reading('red');
  np.positions = SQ.map(id => ({ sub_question: id, value: 'no_position' }));
  assert.equal(door.validateReading('red', np, CTX).ok, true);
  // A black item needs a disposition of its two values.
  const noDisp = reading('black');
  delete noDisp.evidence[0].disposition;
  assert.equal(door.validateReading('black', noDisp, CTX).reason, 'schema_invalid:evidence[0].disposition');
  // A refused key name that is not a plain identifier is not echoed.
  const odd = reading('red');
  odd['<script>alert(1)</script>'] = 1;
  assert.equal(door.validateReading('red', odd, CTX).reason, 'unknown_key:_');
});

// P3
check('P3. a blue reading with positions, a green reading with favours and a red reading with evidence are refused', () => {
  const blue = door.validateReading('blue', reading('blue', { positions: positions('white') }), CTX);
  assert.equal(blue.reason, 'forbidden_key:positions');
  const green = reading('green');
  green.positions = positions('white');
  assert.match(door.validateReading('green', green, CTX).reason, /^schema_invalid:positions\[0\]\.value/);
  const red = door.validateReading('red', reading('red', { evidence: [{ source: 'x', tier: 'T1' }] }), CTX);
  assert.equal(red.reason, 'forbidden_key:evidence');
  // A thin entry of blue names a hat.
  assert.equal(door.validateReading('blue', reading('blue', { thin: ['It was thin.'] }), CTX).reason, 'schema_invalid:thin[0]');
});

// P4
check('P4. white rule lines', () => {
  const ok = (r) => door.perHatRules('white', r, { researchState: 'ran' });
  assert.deepEqual(ok(reading('white', { missing_data: [], nothing_missing: true })).lines, []);
  assert.deepEqual(ok(reading('white', { evidence: [] })).lines, ['white_no_evidence']);
  const untiered = reading('white');
  delete untiered.evidence[0].tier;
  assert.deepEqual(ok(untiered).lines, ['white_uncited_or_untiered_evidence']);
  assert.deepEqual(ok(reading('white', { missing_data: [], nothing_missing: false })).lines, ['white_missing_data_absent']);
  const bare = reading('white');
  delete bare.missing_data;
  delete bare.nothing_missing;
  assert.deepEqual(ok(bare).lines, ['white_missing_data_absent']);
  assert.deepEqual(ok(reading('white')).lines, []);
});

// P5
check('P5. red line of 26 words is a rule line; 25 words is not', () => {
  const words = (n) => Array.from({ length: n }, (_, i) => 'w' + i).join(' ');
  const r26 = reading('red');
  r26.positions[0].line = words(26);
  assert.deepEqual(door.perHatRules('red', r26, {}).lines, ['red_line_too_long']);
  const r25 = reading('red');
  r25.positions[0].line = words(25);
  assert.deepEqual(door.perHatRules('red', r25, {}).lines, []);
});

// P6
check('P6. black rule lines', () => {
  const item = (d) => ({ source: 'EvidenceClaim:s1:aa', tier: 'T2', disposition: d });
  const rules = (ev) => door.perHatRules('black', reading('black', { evidence: ev }), {}).lines;
  assert.deepEqual(rules([item('confirming')]), ['black_no_disconfirming_evidence']);
  assert.deepEqual(rules([item('confirming'), item('disconfirming')]), ['black_confirming_before_disconfirming']);
  assert.deepEqual(rules([item('disconfirming'), item('confirming')]), []);
  assert.deepEqual(rules([]), ['black_no_disconfirming_evidence']);
});

// P7
check('P7. yellow rule lines and the two bases of none_found (FS-10)', () => {
  const y = (over, state) => door.perHatRules('yellow', reading('yellow', over), { researchState: state });
  const empty = { evidence: [], none_found: true };
  let r = y(empty, 'ran_empty');
  assert.deepEqual(r.lines, []);
  assert.equal(r.none_found_basis, 'door_search_empty');
  for (const state of ['failed', 'declined', 'not_planned:no_valid_handle']) {
    r = y(empty, state);
    assert.deepEqual(r.lines.filter(l => l === 'none_found_without_search'), ['none_found_without_search'], state);
    assert.equal(r.none_found_basis, null);
    r = y(Object.assign({ self_search_strings: ['pricing models for small studios'] }, empty), state);
    assert.deepEqual(r.lines, [], state);
    assert.equal(r.none_found_basis, 'self_reported_search');
  }
  r = y({ evidence: [{ source: 'EvidenceClaim:s1:aa', tier: 'T2' }], none_found: true }, 'ran');
  assert.deepEqual(r.lines, ['none_found_with_evidence']);
  r = y({ evidence: [] }, 'ran');
  assert.deepEqual(r.lines, ['yellow_value_not_evidence_backed']);
  assert.deepEqual(y({}, 'ran').lines, []);
});

// P8
check('P8. green rule lines', () => {
  assert.deepEqual(door.perHatRules('green', reading('green', { provocations: [] }), {}).lines, ['green_no_provocation_marker']);
  const withDisp = reading('green');
  withDisp.evidence[0].disposition = 'confirming';
  assert.deepEqual(door.perHatRules('green', withDisp, {}).lines, ['green_evidence_disposition']);
  assert.deepEqual(door.perHatRules('green', reading('green'), {}).lines, []);
});

// P9
check('P9. perHatRules for blue calls no governance function', () => {
  const gov = require(GOV_PATH);
  const original = gov.enforceGovernance;
  let calls = 0;
  gov.enforceGovernance = function spy() { calls += 1; return original.apply(this, arguments); };
  try {
    const out = door.perHatRules('blue', reading('blue'), {});
    assert.deepEqual(out.lines, []);
    assert.equal(calls, 0);
    door.perHatRules('white', reading('white'), {});
    assert.equal(calls, 1);
  } finally {
    gov.enforceGovernance = original;
  }
});

// P10
check('P10. self_found_sources (FS-4): valid for four hats, schema faults refused', () => {
  const found = (over) => Object.assign({ url: 'https://example.org/a', title: 'A page', search_string: 'retainer pricing', summary: 'A summary.' }, over || {});
  const base = { self_search_strings: ['retainer pricing'], self_found_sources: [found()] };
  for (const h of ['white', 'black', 'yellow', 'green']) {
    assert.equal(door.validateReading(h, reading(h, base), CTX).ok, true, h);
  }
  const bad = (src, strings) => door.validateReading('black', reading('black', { self_search_strings: strings || ['retainer pricing'], self_found_sources: src }), CTX);
  assert.match(bad([found({ search_string: 'other' })]).reason, /^schema_invalid:self_found_sources\[0\]\.search_string/);
  assert.match(bad([found({ url: 'ftp://example.org/a' })]).reason, /^schema_invalid:self_found_sources\[0\]\.url/);
  assert.match(bad([found({ url: 'javascript:alert(1)' })]).reason, /^schema_invalid:self_found_sources\[0\]\.url/);
  assert.match(bad(Array.from({ length: 31 }, () => found())).reason, /^schema_invalid:self_found_sources/);
  assert.match(bad([found({ summary: 'x'.repeat(301) })]).reason, /^schema_invalid:self_found_sources\[0\]\.summary/);
  assert.match(bad([found({ title: '' })]).reason, /^schema_invalid:self_found_sources\[0\]\.title/);
  assert.match(bad([found({ extra: 1 })]).reason, /^schema_invalid:self_found_sources\[0\]\.extra/);
  assert.match(bad([found()], Array.from({ length: 51 }, (_, i) => 's' + i)).reason, /^schema_invalid:self_search_strings/);
  assert.equal(bad([found()], ['retainer pricing']).ok, true);
});


// ---------------------------------------------------------------------------
// Task 2 legs: the check step and the Blue ledger
// ---------------------------------------------------------------------------
// ---- shared fixture of plan 07: a deep run up to the closed research step ----
const READ_HATS = ['white', 'red', 'black', 'yellow', 'green'];

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

function runReading(hat, run, over) {
  const base = { schema: 'mos.persona-reading/1', run_id: run.res.run_id, hat };
  const value = hat === 'green' ? 'alternative_offered' : 'favours';
  base.positions = run.ids.map(id => ({ sub_question: id, value, line: 'A short line.' }));
  if (hat === 'white') Object.assign(base, { evidence: [], missing_data: ['The price of rival plans.'] });
  if (hat === 'black') Object.assign(base, { evidence: [], steelman: 'The best case.' });
  if (hat === 'yellow') Object.assign(base, { evidence: [], none_found: false });
  if (hat === 'green') Object.assign(base, { provocations: ['What if the client owns the hand-off?'], evidence: [] });
  return Object.assign(base, over || {});
}

function writeRun(run, hat, obj) {
  fs.writeFileSync(path.join(run.res.hats[hat].dir, 'reading.json'), typeof obj === 'string' ? obj : JSON.stringify(obj), 'utf8');
}

function doCheck(run) {
  return door.cmdCheck({ roomDir: run.room, runId: run.res.run_id }, run.env.opts());
}

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

// P11
check('P11. check records the SHA-256, rule lines, self-search strings and the count of self-found sources', () => {
  const run = runToResearchClosed();
  const found = (url) => ({ url, title: 'A page', search_string: 'retainer pricing', summary: 'A summary.' });
  writeRun(run, 'white', runReading('white', run));
  writeRun(run, 'red', runReading('red', run));
  writeRun(run, 'black', runReading('black', run, {
    evidence: [{ source: 'https://example.org/a', tier: 'self_found', disposition: 'disconfirming' }],
    self_search_strings: ['retainer pricing'],
    self_found_sources: [found('https://example.org/a'), found('https://example.org/b')],
  }));
  writeRun(run, 'yellow', runReading('yellow', run, { none_found: true, self_search_strings: ['retainer success cases'] }));
  writeRun(run, 'green', runReading('green', run));
  const out = doCheck(run);
  assert.equal(out.ok, true, JSON.stringify(out));
  const ledger = run.ledger();
  const file = (h) => path.join(run.res.hats[h].dir, 'reading.json');
  for (const h of READ_HATS) {
    assert.equal(ledger.hats[h].reading, 'ran', h);
    assert.equal(ledger.hats[h].reading_sha256, sha256File(file(h)), h);
  }
  assert.deepEqual(ledger.hats.black.rule_lines, []);
  assert.deepEqual(ledger.hats.black.self_search_strings, ['retainer pricing']);
  assert.equal(ledger.hats.black.self_found_sources, 2);
  assert.equal(ledger.hats.black.evidence_items, 1);
  assert.equal(ledger.hats.black.positions_taken, 2);
  // White has no evidence in this run: a rule line, not a rejection.
  assert.deepEqual(ledger.hats.white.rule_lines, ['white_no_evidence']);
  assert.equal(ledger.hats.white.self_found_sources, 0);
  // Yellow: none_found on a self-reported search (the door research was not planned).
  assert.deepEqual(ledger.hats.yellow.rule_lines, []);
  assert.equal(ledger.hats.yellow.none_found_basis, 'self_reported_search');
  assert.equal(out.hats.yellow.none_found_basis, 'self_reported_search');
  assert.deepEqual(ledger.hats.red.self_search_strings, []);
  // The ledger holds no numeric field across hats and no winner.
  assert.equal(JSON.stringify(ledger).includes('"score"'), false);
});

// P12
check('P12. the Blue ledger holds integers and state names only', () => {
  const run = runToResearchClosed();
  const urlA = 'https://example.org/secret-title-path';
  writeRun(run, 'white', runReading('white', run));
  writeRun(run, 'red', runReading('red', run));
  writeRun(run, 'black', runReading('black', run, {
    evidence: [{ source: urlA, tier: 'self_found', disposition: 'disconfirming', note: 'A private note.' }],
    self_search_strings: ['a search string that must not travel'],
    self_found_sources: [{ url: urlA, title: 'A secret title', search_string: 'a search string that must not travel', summary: 'A secret summary.' }],
  }));
  writeRun(run, 'yellow', runReading('yellow', run));
  writeRun(run, 'green', runReading('green', run));
  const out = doCheck(run);
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(out.blue_ledger, path.join(run.res.hats.blue.dir, 'ledger.json'));
  const text = fs.readFileSync(out.blue_ledger, 'utf8');
  const blue = JSON.parse(text);
  assert.equal(blue.schema, 'mos.persona-blue-ledger/1');
  assert.equal(blue.run_id, run.res.run_id);
  assert.deepEqual(Object.keys(blue), ['schema', 'run_id', 'hats', 'sub_questions', 'strings_approved', 'strings_refused']);
  assert.equal(blue.sub_questions, 2);
  assert.deepEqual(Object.keys(blue.hats), HATS);
  const BANNED = ['title', 'url', 'line', 'handle', 'text', 'summary'];
  (function walk(v, key) {
    if (BANNED.includes(key)) assert.fail('banned key ' + key);
    if (typeof v === 'string') {
      assert.ok(v.length <= 60, 'long string at ' + key + ': ' + v.length);
      assert.equal(v.includes('http'), false, 'http at ' + key);
    } else if (typeof v === 'number') {
      assert.ok(Number.isInteger(v) && v >= 0, 'not a count at ' + key);
    } else if (v && typeof v === 'object') {
      for (const k of Object.keys(v)) walk(v[k], k);
    } else {
      assert.fail('unexpected value at ' + key);
    }
  })(blue, 'root');
  for (const t of ['secret', 'must not travel', 'private note']) assert.equal(text.includes(t), false, t);
  const bh = blue.hats.black;
  assert.deepEqual(Object.keys(bh), ['persona', 'research', 'reading', 'evidence_items', 'positions_taken', 'rule_lines', 'self_found_sources', 'self_search_strings']);
  assert.equal(bh.evidence_items, 1);
  assert.equal(bh.self_found_sources, 1);
  assert.equal(bh.self_search_strings, 1);
  assert.equal(bh.research, 'not_planned:no_valid_handle');
  assert.equal(blue.hats.red.research, 'never_searches');
  assert.equal(blue.hats.blue.reading, 'pending');
  assert.equal(blue.hats.blue.rule_lines, 0);
});

// P13
check('P13. check reads no file of the Blue directory and writes nothing into another hat directory', () => {
  const run = runToResearchClosed();
  for (const h of READ_HATS) writeRun(run, h, runReading(h, run));
  const blueDir = run.res.hats.blue.dir;
  fs.writeFileSync(path.join(blueDir, 'reading.json'), 'must not be read', 'utf8');
  const listing = () => {
    const o = {};
    for (const h of HATS) o[h] = fs.readdirSync(run.res.hats[h].dir).sort().join(',');
    return o;
  };
  const before = listing();
  const touched = [];
  const names = ['readFileSync', 'readdirSync', 'statSync', 'lstatSync', 'openSync', 'existsSync', 'accessSync', 'realpathSync'];
  const originals = {};
  for (const n of names) {
    originals[n] = fs[n];
    fs[n] = function spy(p) {
      if (typeof p === 'string' && (p === blueDir || p.startsWith(blueDir + path.sep))) touched.push(n + ' ' + p);
      return originals[n].apply(this, arguments);
    };
  }
  let out;
  try {
    out = doCheck(run);
  } finally {
    for (const n of names) fs[n] = originals[n];
  }
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.deepEqual(touched, [], touched.join('; '));
  const after = listing();
  for (const h of HATS) {
    if (h === 'blue') assert.equal(after.blue, before.blue.split(',').concat(['ledger.json']).sort().join(','));
    else assert.equal(after[h], before[h], h + ' directory changed');
  }
  assert.equal(fs.readFileSync(path.join(blueDir, 'reading.json'), 'utf8'), 'must not be read');
});

// P14
check('P14. a White reading with zero evidence and research not planned has white_no_evidence and is not rejected (FS-11)', () => {
  const run = runToResearchClosed();
  for (const h of READ_HATS) writeRun(run, h, runReading(h, run));
  const out = doCheck(run);
  assert.equal(out.ok, true);
  assert.equal(out.hats.white.reading, 'ran');
  assert.deepEqual(out.hats.white.rule_lines, ['white_no_evidence']);
  assert.deepEqual(out.not_run, []);
  // Black and Yellow and Green carry their own lines, none of them a rejection.
  assert.deepEqual(out.hats.black.rule_lines, ['black_no_disconfirming_evidence']);
  assert.deepEqual(out.hats.yellow.rule_lines, ['yellow_value_not_evidence_backed']);
});

// ---------------------------------------------------------------------------
// Plan 13: rule lines against real research states (a real run-research, then check)
// ---------------------------------------------------------------------------

const fx = require(path.join(__dirname, 'fixtures', 'persona-run-4002.cjs'));
const asyncLegs = [];
function acheck(label, fn) {
  asyncLegs.push({ label, fn });
}

/** Write the five readings (over[hat] overrides) and the Blue reading, then check. */
function readAndCheck(ctx, over) {
  const o = over || {};
  for (const h of fx.READ_HATS) fx.writeReading(ctx, h, fx.readingOf(ctx, h, o[h]));
  fx.writeReading(ctx, 'blue', fx.blueReadingOf(ctx));
  const out = fx.doCheck(ctx);
  assert.equal(out.ok, true, JSON.stringify(out));
  return out;
}

// P15
acheck('P15. FS-10: yellow none_found has basis door_search_empty after a ran_empty search; after a failed search the same reading has none_found_without_search', async () => {
  await fx.withEnvAsync(fx.NO_KEYS, async () => {
    const emptied = await fx.researched({ behave: (a) => fx.emptyEnv(a.source) });
    assert.equal(emptied.out.hats.yellow, 'ran_empty');
    const outEmpty = readAndCheck(emptied.ctx, { yellow: { none_found: true } });
    assert.equal(outEmpty.hats.yellow.reading, 'ran', JSON.stringify(outEmpty.hats.yellow));
    assert.equal(outEmpty.hats.yellow.none_found_basis, 'door_search_empty');
    assert.equal(outEmpty.hats.yellow.rule_lines.includes('none_found_without_search'), false);
    assert.equal(fx.ledgerOf(emptied.ctx).hats.yellow.none_found_basis, 'door_search_empty');

    const failed = await fx.researched({ behave: (a) => fx.failEnv(a.source, 'http_error') });
    assert.equal(failed.out.hats.yellow, 'failed');
    const outFailed = readAndCheck(failed.ctx, { yellow: { none_found: true } });
    assert.equal(outFailed.hats.yellow.reading, 'ran', JSON.stringify(outFailed.hats.yellow));
    assert.ok(outFailed.hats.yellow.rule_lines.includes('none_found_without_search'), JSON.stringify(outFailed.hats.yellow.rule_lines));
    assert.equal(outFailed.hats.yellow.none_found_basis, undefined);
    // A failed door search does not become "found nothing": with its own reported search the basis is the hat's own report.
    const outOwn = readAndCheck(failed.ctx, { yellow: { none_found: true, self_search_strings: ['subscription pricing studies'] } });
    assert.equal(outOwn.hats.yellow.none_found_basis, 'self_reported_search');
    assert.equal(outOwn.hats.yellow.rule_lines.includes('none_found_without_search'), false);
  });
});

// P16
acheck('P16. FS-11: with White declined, white_no_evidence appears only when the white reading has zero evidence entries', async () => {
  await fx.withEnvAsync(fx.NO_KEYS, async () => {
    const declineWhite = (plan) => Object.assign(fx.approveAll(plan, ['white']), { white: { decision: 'refuse', q_hashes: [], providers: [] } });
    const run = await fx.researched({ hats: declineWhite });
    assert.equal(run.out.hats.white, 'declined');
    assert.equal(fx.packOf(run.ctx, 'white').items.length, 0);
    for (const h of fx.READ_HATS) assert.equal(fx.packOf(run.ctx, h, 'shared-white.json').items.length, 0, h);
    const url = 'https://self-found.example.net/white-page';
    const withEvidence = readAndCheck(run.ctx, { white: { evidence: [{ source: url, tier: 'self_found', note: 'Found by the hat.' }], self_search_strings: ['grid storage costs'], self_found_sources: [{ url, title: 'A page', search_string: 'grid storage costs', summary: 'A summary.' }] } });
    assert.equal(withEvidence.hats.white.reading, 'ran', JSON.stringify(withEvidence.hats.white));
    assert.equal(withEvidence.hats.white.rule_lines.includes('white_no_evidence'), false, JSON.stringify(withEvidence.hats.white.rule_lines));
    const without = readAndCheck(run.ctx, { white: { evidence: [] } });
    assert.equal(without.hats.white.reading, 'ran');
    assert.ok(without.hats.white.rule_lines.includes('white_no_evidence'), JSON.stringify(without.hats.white.rule_lines));
  });
});

// P17
acheck('P17. FS-9: a reported string with a venture token or an email address adds one rule line; clean strings add none; no reading is rejected', async () => {
  await fx.withEnvAsync(fx.NO_KEYS, async () => {
    const run = await fx.researched();
    const out = readAndCheck(run.ctx, {
      white: { self_search_strings: ['grid storage costs', 'battery recycling rates'] },
      black: { self_search_strings: ['retainer pricing at harbor studios', 'supply chain failures'] },
      green: { self_search_strings: ['mail jane@example.com now'] },
    });
    for (const h of fx.READ_HATS) assert.equal(out.hats[h].reading, 'ran', h + ' ' + JSON.stringify(out.hats[h]));
    assert.deepEqual(out.hats.black.rule_lines.filter(l => l.startsWith('self_search_room_detail_suspected')), ['self_search_room_detail_suspected:1']);
    assert.deepEqual(out.hats.green.rule_lines.filter(l => l.startsWith('self_search_room_detail_suspected')), ['self_search_room_detail_suspected:1']);
    assert.deepEqual(out.hats.white.rule_lines.filter(l => l.startsWith('self_search')), []);
    assert.deepEqual(out.hats.yellow.rule_lines.filter(l => l.startsWith('self_search')), []);
    assert.deepEqual(out.hats.red.rule_lines.filter(l => l.startsWith('self_search')), []);
    // The screen ran (the room has a venture name): no partial line.
    for (const h of fx.READ_HATS) assert.equal(out.hats[h].rule_lines.includes('self_search_screen_partial'), false, h);
    // The strings stay in the run record, whatever the screen said.
    const ledger = fx.ledgerOf(run.ctx);
    assert.deepEqual(ledger.hats.black.self_search_strings, ['retainer pricing at harbor studios', 'supply chain failures']);
    assert.deepEqual(ledger.hats.green.self_search_strings, ['mail jane@example.com now']);
    // A suspected string is not sent to the Blue hat: the Blue ledger holds the count of strings, not the text.
    const blueText = fs.readFileSync(path.join(run.ctx.res.hats.blue.dir, 'ledger.json'), 'utf8');
    assert.equal(blueText.includes('harbor'), false);
    assert.equal(blueText.includes('jane@'), false);
    // The pure function.
    const screen = door.roomIdentityScreen(run.ctx.room, []);
    assert.equal(screen.ran, true);
    assert.deepEqual(door.screenReportedStrings(['grid storage costs', 'harbor pricing', 'mail jane@example.com now'], screen), { checked: 3, suspected: 2, screen_partial: false });
    assert.deepEqual(door.screenReportedStrings([], screen), { checked: 0, suspected: 0, screen_partial: false });
    assert.deepEqual(JSON.stringify(door.screenReportedStrings(['harbor pricing'], screen)).includes('harbor'), false);
  });
});

// P17b
acheck('P17b. FS-9: in a room with no venture name the identity screen cannot run; the fence still runs and self_search_screen_partial is added once', async () => {
  await fx.withEnvAsync(fx.NO_KEYS, async () => {
    const room = fx.harborRoom();
    fs.writeFileSync(path.join(room, 'STATE.md'), '---\nstage: seed\n---\n\nNo name here.\n', 'utf8');
    const env = fx.envOf();
    const res = fx.runToAccepted(room, env);
    const plan = door.cmdPlanResearch({ roomDir: room, runId: res.run_id }, fx.opts(env));
    assert.equal(plan.ok, true, JSON.stringify(plan));
    const ctx = { room, env, res, ids: fx.ledgerOf({ res }).sub_questions.map(s => s.id) };
    const out = readAndCheck(ctx, {
      black: { self_search_strings: ['retainer pricing', 'mail jane@example.com now'] },
      white: { self_search_strings: ['grid storage costs'] },
    });
    for (const h of fx.READ_HATS) assert.equal(out.hats[h].reading, 'ran', h);
    assert.equal(out.hats.black.rule_lines.filter(l => l === 'self_search_screen_partial').length, 1);
    assert.deepEqual(out.hats.black.rule_lines.filter(l => l.startsWith('self_search_room_detail_suspected')), ['self_search_room_detail_suspected:1']);
    assert.equal(out.hats.white.rule_lines.filter(l => l === 'self_search_screen_partial').length, 1);
    assert.equal(out.hats.red.rule_lines.includes('self_search_screen_partial'), false);
    assert.equal(out.hats.green.rule_lines.includes('self_search_screen_partial'), false, 'a hat with no reported string has no partial line');
  });
});

(async () => {
  for (const t of asyncLegs) {
    try {
      await t.fn();
      passed += 1;
      console.log('ok: ' + t.label);
    } catch (e) {
      failed += 1;
      console.log('FAIL: ' + t.label + ' -- ' + (e && e.message ? e.message : String(e)));
    }
  }
  fx.cleanup();
  for (const d of tmpRoots) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* ignore */ }
  }
  console.log(passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
