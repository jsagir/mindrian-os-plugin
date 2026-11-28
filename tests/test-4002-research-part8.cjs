#!/usr/bin/env node
'use strict';
// Phase 400.2-10: the Part 8 controls on a door search string (scripts/persona-hats.cjs checkHandle, composeString,
// roomIdentityScreen, IDENTITY_STOP_LIST; lib/core/persona-ops.cjs research tables). Legs E1 to E14.
// Phase 400.2-11 adds legs E15 to E27 (the planning branch of plan-research, the handles store, the edit path) and the
// pack-hash legs E28 to E32. Plan 12 adds legs E28r to E34r (run-research, the approval binding; the plan names them E28 to E34).
// No test sends a network request.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const DOOR_PATH = path.join(ROOT, 'scripts', 'persona-hats.cjs');

let failed = 0;
let passed = 0;
const queue = [];
function check(label, fn) {
  queue.push({ label, fn });
}

let door;
let ops;
try {
  door = require(DOOR_PATH);
  ops = require(path.join(ROOT, 'lib', 'core', 'persona-ops.cjs'));
} catch (e) {
  console.log('FAIL: a module is missing: ' + (e && e.message ? e.message : String(e)));
  process.exit(1);
}

const tmpRoots = [];
function mkTmp(label) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-4002-research-part8-' + label + '-'));
  tmpRoots.push(d);
  return d;
}
function put(room, rel, text) {
  const abs = path.join(room, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text, 'utf8');
}
/** Build a room in a directory with a chosen base name. */
function makeRoom(dirName, stateText, extra) {
  const parent = mkTmp('p');
  const room = path.join(parent, dirName);
  fs.mkdirSync(room, { recursive: true });
  if (stateText !== null) put(room, 'STATE.md', stateText);
  const files = extra || {};
  for (const rel of Object.keys(files)) put(room, rel, files[rel]);
  return room;
}

const ACME_STATE = '---\nventure: Acme Robotics\nstage: seed\n---\n\n# Acme Robotics\n\nA test venture.\n';
function acmeRoom() {
  return makeRoom('acme-room', ACME_STATE, {
    'team/dana-levi.md': '# Team member\nA person.\n',
    'notes/reading.md': '# Reading notes\nWe met Orbitex last week. Then we left.\n',
  });
}
function acmeScreen() {
  const room = acmeRoom();
  return door.roomIdentityScreen(room, ['notes/reading.md']);
}

const SPIKE_RECORD = path.join(__dirname, 'fixtures', '4002', 'spike-overlap-record.json');
// The tables are spike_checked only when the spike record exists with a pass decision (plan 400.2-15).
function expectedTablesStatus() {
  try {
    const rec = JSON.parse(fs.readFileSync(SPIKE_RECORD, 'utf8'));
    return rec && rec.decision === 'pass' ? 'spike_checked' : 'provisional';
  } catch (e) {
    return 'provisional';
  }
}

check('E1. the qualifier table, the lens table and the status', () => {
  const Q = ops.HAT_RESEARCH_QUALIFIER;
  const L = ops.HAT_RESEARCH_LENSES;
  const keys = ['white', 'black', 'yellow', 'green'];
  assert.deepEqual(Object.keys(Q).sort(), keys.slice().sort());
  assert.deepEqual(Object.keys(L).sort(), keys.slice().sort());
  const seen = new Set();
  for (const k of keys) {
    assert.match(Q[k], /^[a-z]+ [a-z]+$/);
    seen.add(Q[k]);
  }
  assert.equal(seen.size, 4);
  assert.deepEqual(Q, { white: 'data statistics', black: 'failure cases', yellow: 'success cases', green: 'analogous solutions' });
  // Plan 19 (owner third card): preprint (arXiv) for the four hats, datasets (Kaggle) for white, nature (AskNature) for green.
  assert.deepEqual(L.white, ['scholarly', 'preprint', 'industry', 'datasets']);
  assert.deepEqual(L.black, ['scholarly', 'preprint', 'industry']);
  assert.deepEqual(L.yellow, ['industry', 'scholarly', 'preprint']);
  assert.deepEqual(L.green, ['scholarly', 'preprint', 'patent', 'nature']);
  const map = require(path.join(ROOT, 'lib', 'lens-engine', 'source-lens-driver.cjs'))._internal.LENS_TO_SOURCE;
  for (const k of keys) {
    for (const lens of L[k]) {
      assert.notEqual(lens, 'brain');
      assert.ok(Object.prototype.hasOwnProperty.call(map, lens), lens);
    }
  }
  assert.ok(Object.isFrozen(Q) && Object.isFrozen(L));
  for (const k of keys) assert.ok(Object.isFrozen(L[k]));
  assert.equal(ops.HAT_RESEARCH_TABLES_STATUS, expectedTablesStatus());
});

check('E2. IDENTITY_STOP_LIST is frozen, lower case, without duplicates, and holds the context words', () => {
  const list = door.IDENTITY_STOP_LIST;
  assert.ok(Array.isArray(list) && Object.isFrozen(list));
  assert.equal(new Set(list).size, list.length);
  for (const w of list) assert.equal(w, w.toLowerCase());
  const need = ('room venture project company startup labs group systems solutions technologies global health energy data market platform ' +
    'network digital research design care food water power cloud mobile smart green blue open new test demo').split(' ');
  for (const w of need) assert.ok(list.includes(w), w);
});

check('E3. the screen of a room holds the venture, directory, team and proper-noun tokens', () => {
  const s = acmeScreen();
  assert.equal(s.ran, true);
  assert.equal(s.venture_name_found, true);
  for (const t of ['acme', 'robotics', 'dana', 'levi', 'orbitex']) assert.equal(s.has(t), true, t);
  assert.ok(s.tokens_checked >= 5);
});

check('E4. the first capital token of a sentence or of a heading is not screened', () => {
  const room = makeRoom('quillfeather', ACME_STATE, {
    'notes/reading.md': '# Headingword here\nSentenceword opens. Next Orbitex. Also lower start.\n- Bulletword begins here\n',
  });
  const s = door.roomIdentityScreen(room, ['notes/reading.md']);
  assert.equal(s.has('headingword'), false);
  assert.equal(s.has('sentenceword'), false);
  assert.equal(s.has('bulletword'), false);
  assert.equal(s.has('orbitex'), true);
  assert.equal(s.has('lower'), false);
});

check('E5. no venture name, or the default name, means the screen does not run', () => {
  const none = door.roomIdentityScreen(makeRoom('r1', 'just prose with no heading\n'), []);
  assert.equal(none.ran, false);
  assert.equal(none.venture_name_found, false);
  const unk = door.roomIdentityScreen(makeRoom('r2', '---\nventure: Unknown Venture\n---\n'), []);
  assert.equal(unk.ran, false);
  const missing = door.roomIdentityScreen(makeRoom('r3', null), []);
  assert.equal(missing.ran, false);
});

check('E6. the counts view of the screen holds no token', () => {
  const s = acmeScreen();
  const view = JSON.parse(JSON.stringify(s));
  assert.deepEqual(Object.keys(view).sort(), ['ran', 'tokens_checked', 'venture_name_found']);
  const text = JSON.stringify(s);
  for (const t of ['acme', 'robotics', 'dana', 'levi', 'orbitex']) assert.equal(text.includes(t), false, t);
  assert.deepEqual(Object.keys(s.counts()).sort(), ['ran', 'tokens_checked', 'venture_name_found']);
});

check('E7. NEGATIVE: the content fence runs first on the raw handle', () => {
  const s = acmeScreen();
  for (const h of ['mail me@example.com now', 'budget $5M plan', 'Tel Aviv logistics']) {
    const r = door.checkHandle(h, s);
    assert.equal(r.ok, false, h);
    assert.equal(r.reason, 'egress_violation', h);
  }
});

check('E8. NEGATIVE: a handle that is not of the generic shape is refused and never normalised', () => {
  const s = acmeScreen();
  for (const h of ['Battery recycling', 'battery, recycling', 'one two three four five', 'battery  recycling', ' battery', '', 'a-b']) {
    const r = door.checkHandle(h, s);
    assert.equal(r.ok, false, JSON.stringify(h));
    assert.equal(r.reason, 'handle_not_generic_shape', JSON.stringify(h));
    assert.equal(Object.prototype.hasOwnProperty.call(r, 'handle'), false);
  }
  assert.equal(door.checkHandle(42, s).reason, 'handle_not_generic_shape');
});

check('E9. NEGATIVE: a handle with a digit is refused', () => {
  const s = acmeScreen();
  for (const h of ['battery 2030', 'covid19 supply', 'top 10 lists']) {
    const r = door.checkHandle(h, s);
    assert.equal(r.ok, false, h);
    assert.equal(r.reason, 'handle_has_digit', h);
  }
});

check('E10. NEGATIVE: a handle with a room name is refused', () => {
  const s = acmeScreen();
  for (const h of ['acme battery', 'robotics battery', 'levi supply', 'orbitex supply chain', 'supply dana']) {
    const r = door.checkHandle(h, s);
    assert.equal(r.ok, false, h);
    assert.equal(r.reason, 'room_identity_word', h);
  }
  // the room directory token
  const room = makeRoom('quillfeather', ACME_STATE, {});
  const s2 = door.roomIdentityScreen(room, []);
  assert.equal(door.checkHandle('quillfeather pricing', s2).reason, 'room_identity_word');
  assert.equal(door.checkHandle('battery recycling', s).ok, true);
});

check('E11. the stop-list and the full-name rule', () => {
  const s = door.roomIdentityScreen(makeRoom('room', '---\nventure: Zenith Bakery\n---\n'), []);
  assert.equal(s.ran, true);
  assert.equal(door.checkHandle('clean room design', s).ok, true);
  const gobio = door.roomIdentityScreen(makeRoom('r4', '---\nventure: Go Bio\n---\n'), []);
  assert.equal(door.checkHandle('go bio sensors', gobio).reason, 'room_identity_word');
  assert.equal(door.checkHandle('bio sensors', gobio).ok, true);
});

check('E12. NEGATIVE: a screen that did not run refuses every handle', () => {
  const none = door.roomIdentityScreen(makeRoom('r5', 'no name here\n'), []);
  assert.equal(none.ran, false);
  assert.equal(door.checkHandle('battery recycling', none).reason, 'identity_screen_unavailable');
  assert.equal(door.checkHandle('battery recycling', null).reason, 'identity_screen_unavailable');
  assert.equal(door.checkHandle('battery recycling', undefined).reason, 'identity_screen_unavailable');
  // an earlier check still wins on its own reason
  assert.equal(door.checkHandle('battery 2030', none).reason, 'handle_has_digit');
});

check('E13. composeString joins the handle and the fixed qualifier', () => {
  const r = door.composeString('black', 'battery recycling');
  assert.equal(r.ok, true);
  assert.equal(r.text, 'battery recycling failure cases');
  assert.equal(r.handle, 'battery recycling');
  assert.equal(r.qualifier, 'failure cases');
  assert.match(r.q_hash, /^sha256:[0-9a-f]{64}$/);
  assert.ok(r.text.split(' ').length <= 6);
  const gdh = require(path.join(ROOT, 'lib', 'core', 'bono', 'cell-fanout.cjs')).genericDomainHandle;
  assert.equal(gdh(r.text), r.text);
  const fam = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'families.cjs'));
  assert.equal(r.q_hash, fam.qHash(r.text));
  assert.equal(door.composeString('green', 'grid storage').text, 'grid storage analogous solutions');
  assert.equal(door.composeString('red', 'grid storage').reason, 'hat_never_searches');
  assert.equal(door.composeString('blue', 'grid storage').reason, 'hat_never_searches');
  assert.equal(door.composeString('purple', 'grid storage').reason, 'hat_never_searches');
});

check('E14. NEGATIVE: a refusal object holds ok false and reason only, never the text', () => {
  const s = acmeScreen();
  const probes = ['mail secretprobe@example.com', 'Secretprobe Words', 'secretprobe 2031', 'acme secretprobe'];
  for (const h of probes) {
    const r = door.checkHandle(h, s);
    assert.equal(r.ok, false);
    assert.deepEqual(Object.keys(r).sort(), ['ok', 'reason']);
    assert.equal(JSON.stringify(r).toLowerCase().includes('secretprobe'), false, h);
  }
  const c = door.composeString('red', 'secretprobe words');
  assert.deepEqual(Object.keys(c).sort(), ['ok', 'reason']);
  assert.equal(JSON.stringify(c).includes('secretprobe'), false);
  const long = door.composeString('white', 'one two three four five six');
  assert.equal(long.ok, false);
  assert.deepEqual(Object.keys(long).sort(), ['ok', 'reason']);
});

// ---------------------------------------------------------------------------
// Plan 11: the planning branch of plan-research, the handles store, the edit path, the pack hashes
// ---------------------------------------------------------------------------

const HATS = ['white', 'red', 'black', 'yellow', 'green', 'blue'];
const RESEARCH = ['white', 'black', 'yellow', 'green'];
const READ_HATS = ['white', 'red', 'black', 'yellow', 'green'];
const NOW = new Date('2026-11-25T10:20:30.000Z');
const HARBOR_STATE = '---\nventure: Harbor Light Studio\nstage: seed\n---\n\n# Harbor Light Studio\n\nA test venture.\n';
const fam = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'families.cjs'));
const GOOD = {
  white: ['battery recycling', 'grid storage'],
  black: ['supply chains', 'retainer pricing'],
  yellow: ['subscription models', 'hand off'],
  green: ['coral reefs', 'swarm logistics'],
};

let runCounter = 0;
function hexSeam() {
  let n = 0;
  return (len) => crypto.createHash('sha256').update('seam-' + (n += 1)).digest('hex').slice(0, len);
}
function envOf() {
  return { homeDir: mkTmp('home'), tmpDir: mkTmp('tmp') };
}
function opts(env, extra) {
  runCounter += 1;
  return Object.assign({ homeDir: env.homeDir, tmpDir: env.tmpDir, now: new Date(NOW.getTime() + runCounter * 7000), randomHex: hexSeam() }, extra || {});
}
function harborRoom(stateText) {
  return makeRoom('harbor-room', stateText === undefined ? HARBOR_STATE : stateText, {
    'problem-definition/core-problem.md': '# Core problem\nSmall studios lose clients at the hand-off.\n',
    'market-analysis/size.md': '# Size\nAbout many studios in the region.\n',
  });
}
function briefOf(over) {
  return Object.assign({
    schema: 'mos.persona-brief/1',
    target: 'room',
    governing_question: 'Should the studio move to a fixed monthly retainer model for new clients?',
    sub_questions: ['Who pays first?', 'What breaks at the hand-off?', 'What does the retainer replace?'],
    reading_list: ['problem-definition/core-problem.md', 'market-analysis/size.md'],
    mode: 'deep',
    triage: { recommended: 'deep', reason: 'A pricing change with money at stake.' },
  }, over || {});
}
function writeJsonTmp(label, name, obj) {
  const d = mkTmp(label);
  const p = path.join(d, name);
  fs.writeFileSync(p, JSON.stringify(obj), 'utf8');
  return p;
}
function startDeep(room, env) {
  const res = door.cmdStart({ roomDir: room, briefPath: writeJsonTmp('brief', 'brief.json', briefOf()), mode: 'deep' }, opts(env));
  assert.equal(res.ok, true, JSON.stringify(res));
  return res;
}
function specOf(hat) {
  return {
    schema: 'mos.persona-spec/1',
    hat,
    focus: 'Look at the ' + hat + ' side of the retainer question.',
    hat_questions: ['What does the room show?', 'What is missing?', 'What would change the view?'],
    must_not_judge: ['The price level.'],
    room_sources: ['problem-definition/core-problem.md'],
  };
}
/** Start a deep run and bring every persona to accepted (hats in refuse are refused). Returns {res, accept}. */
function runToAccepted(room, env, refuse) {
  const res = startDeep(room, env);
  const todo = res.to_build.concat(res.to_accept);
  if (todo.length > 0) {
    for (const h of res.to_build) fs.writeFileSync(path.join(res.hats[h].dir, 'persona.json'), JSON.stringify(specOf(h)), 'utf8');
    const w = door.cmdWritePersona({ roomDir: room, runId: res.run_id }, opts(env));
    assert.equal(w.ok, true, JSON.stringify(w));
    const answer = {};
    for (const h of todo) answer[h] = { decision: (refuse || []).includes(h) ? 'refuse' : 'accept' };
    const ap = writeJsonTmp('answer', 'answer.json', { schema: 'mos.persona-accept/1', run_id: res.run_id, hats: answer });
    const a = door.cmdAcceptPersona({ roomDir: room, runId: res.run_id, answerPath: ap }, opts(env));
    assert.equal(a.ok && a.accept_done, true, JSON.stringify(a));
    return { res, accept: a };
  }
  return { res, accept: null };
}
function writeHandles(res, hat, handles, over) {
  fs.writeFileSync(path.join(res.hats[hat].dir, 'handles.json'), JSON.stringify(Object.assign({
    schema: 'mos.persona-handles/1',
    hat,
    handles: handles.map(h => ({ handle: h, why: 'It names the field of the problem.' })),
  }, over || {})), 'utf8');
}
function writeAllHandles(res, only) {
  for (const h of RESEARCH) if (!only || only.includes(h)) writeHandles(res, h, GOOD[h]);
}
function ledgerOf(res) {
  return JSON.parse(fs.readFileSync(path.join(res.review_dir, 'run.json'), 'utf8'));
}
function plan(room, env, res, extra) {
  return door.cmdPlanResearch(Object.assign({ roomDir: room, runId: res.run_id }, extra || {}), opts(env));
}
function mapOf(env, res, room) {
  return door.readRunMap(env.homeDir, res.run_id, room);
}
function allFiles(dir) {
  const out = [];
  (function walk(d) {
    let ents = [];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of ents) {
      const abs = path.join(d, e.name);
      if (e.isDirectory()) walk(abs);
      else if (e.isFile()) out.push(abs);
    }
  })(dir);
  return out;
}
function filesHolding(dirs, needle) {
  const hits = [];
  for (const d of dirs) for (const f of allFiles(d)) {
    try { if (fs.readFileSync(f, 'utf8').includes(needle)) hits.push(f); } catch (e) { /* ignore */ }
  }
  return hits;
}
function sha(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function withEnv(patch, fn) {
  const saved = {};
  for (const k of Object.keys(patch)) saved[k] = process.env[k];
  for (const k of Object.keys(patch)) { if (patch[k] === null) delete process.env[k]; else process.env[k] = patch[k]; }
  try { return fn(); } finally {
    for (const k of Object.keys(saved)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
}
const NO_KEYS = { TAVILY_API_KEY: null, PATENTSVIEW_API_KEY: null };

check('E15. with handles for the four hats the plan holds checked strings, the identity counts and plan_seq 1', () => {
  withEnv(NO_KEYS, () => {
    const room = harborRoom();
    const env = envOf();
    const { res } = runToAccepted(room, env);
    writeAllHandles(res);
    const out = plan(room, env, res);
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.deepEqual(out.planned, RESEARCH);
    const p = out.plan;
    assert.equal(p.schema, 'mos.persona-plan/1');
    assert.equal(p.run_id, res.run_id);
    assert.equal(p.brief_hash, ledgerOf(res).brief_hash);
    assert.equal(p.plan_seq, 1);
    assert.equal(Object.prototype.hasOwnProperty.call(p, 'round'), false);
    assert.deepEqual(Object.keys(p.identity_screen).sort(), ['ran', 'tokens_checked', 'venture_name_found']);
    assert.equal(p.identity_screen.ran, true);
    assert.ok(p.identity_screen.tokens_checked >= 3);
    assert.deepEqual(Object.keys(p.hats), RESEARCH);
    for (const hat of RESEARCH) {
      const h = p.hats[hat];
      assert.equal(h.state, 'planned');
      assert.equal(h.strings.length, 2);
      assert.deepEqual(h.refused, []);
      for (let i = 0; i < 2; i += 1) {
        const s = h.strings[i];
        assert.deepEqual(Object.keys(s).sort(), ['edited', 'handle', 'q_hash', 'qualifier', 'text']);
        assert.equal(s.handle, GOOD[hat][i]);
        assert.equal(s.qualifier, ops.HAT_RESEARCH_QUALIFIER[hat]);
        assert.equal(s.text, s.handle + ' ' + s.qualifier);
        assert.equal(s.q_hash, fam.qHash(s.text));
        assert.equal(s.edited, false);
      }
      assert.ok(h.providers.includes('openalex'));
      assert.ok(Array.isArray(h.lens_set) && h.lens_set.length >= 1);
    }
    assert.deepEqual(out.hats.red, 'never_searches');
    const onDisk = JSON.parse(fs.readFileSync(path.join(mapOf(env, res, room).scratch_root, 'plan.json'), 'utf8'));
    assert.deepEqual(onDisk, p);
    assert.deepEqual(out.refused_shown, []);
  });
});

check('E16. a hat whose handles are all refused is not planned; the plan holds the reasons, the screen list holds the text', () => {
  withEnv(NO_KEYS, () => {
    const room = harborRoom();
    const env = envOf();
    const { res } = runToAccepted(room, env);
    writeAllHandles(res, ['white', 'yellow', 'green']);
    writeHandles(res, 'black', ['harbor pricing', 'pricing 2030']);
    const out = plan(room, env, res);
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.equal(out.hats.black, 'not_planned:no_valid_handle');
    assert.deepEqual(out.planned, ['white', 'yellow', 'green']);
    assert.deepEqual(out.refused_shown, [
      { hat: 'black', text: 'harbor pricing', reason: 'room_identity_word', guidance: door.REFUSAL_GUIDANCE.room_identity_word },
      { hat: 'black', text: 'pricing 2030', reason: 'handle_has_digit', guidance: door.REFUSAL_GUIDANCE.handle_has_digit },
    ]);
    const b = out.plan.hats.black;
    assert.deepEqual(b.refused, [{ reason: 'room_identity_word' }, { reason: 'handle_has_digit' }]);
    assert.deepEqual(b.strings, []);
    assert.deepEqual(b.providers, []);
    assert.equal(ledgerOf(res).research.strings_refused, 2);
    assert.equal(ledgerOf(res).research.strings_approved, 6);
  });
});

check('E17. NEGATIVE: no file holds a refused handle after plan-research', () => {
  withEnv(NO_KEYS, () => {
    const room = harborRoom();
    const env = envOf();
    const { res } = runToAccepted(room, env);
    writeAllHandles(res, ['white', 'yellow', 'green']);
    writeHandles(res, 'black', ['harbor zzsecretword', 'zzsecretword 2030']);
    const out = plan(room, env, res);
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.equal(JSON.stringify(out.plan).includes('zzsecretword'), false);
    assert.equal(JSON.stringify(out.refused_shown).includes('zzsecretword'), true);
    assert.deepEqual(filesHolding([room, env.tmpDir, env.homeDir], 'zzsecretword'), []);
  });
});

check('E18. NEGATIVE: a room with no venture name gives no card and closes the research step', () => {
  withEnv(NO_KEYS, () => {
    const room = harborRoom('no name here\n');
    const env = envOf();
    const { res } = runToAccepted(room, env);
    writeAllHandles(res);
    const out = plan(room, env, res);
    assert.equal(out.ok, true, JSON.stringify(out));
    for (const hat of RESEARCH) {
      assert.equal(out.hats[hat], 'not_planned:identity_screen_unavailable', hat);
      assert.deepEqual(out.plan.hats[hat].strings, []);
    }
    assert.deepEqual(out.planned, []);
    assert.equal(out.plan.identity_screen.ran, false);
    const l = ledgerOf(res);
    assert.equal(l.steps.plan_research.state, 'done');
    assert.equal(l.steps.run_research.state, 'skipped');
    assert.equal(fs.existsSync(path.join(mapOf(env, res, room).scratch_root, 'plan.json')), false);
  });
});

check('E19. the providers come from preflightLenses and the unavailable line from the driver', () => {
  const run = (keys) => withEnv(keys, () => {
    const room = harborRoom();
    const env = envOf();
    const { res } = runToAccepted(room, env);
    writeAllHandles(res);
    return plan(room, env, res).plan;
  });
  const bare = run(NO_KEYS);
  // Plan 19: with no Tavily key a web lens is not refused: it is a host-web search (the command runs it), so the
  // "not searched" line is empty for the hats whose only missing lens is a web lens. Patents still need their key.
  assert.deepEqual(bare.hats.white.providers, ['openalex', 'arxiv', 'host-web']);
  assert.equal(bare.hats.white.unavailable_line, '');
  assert.deepEqual(bare.hats.white.host_lenses, ['industry', 'datasets']);
  assert.deepEqual(bare.hats.green.providers, ['openalex', 'arxiv', 'host-web']);
  assert.ok(bare.hats.green.unavailable_line.length > 0);
  assert.match(bare.hats.green.unavailable_line, /Patent/i);
  assert.deepEqual(bare.hats.white.lens_set.map(e => e.lens), ['scholarly', 'preprint']);
  const full = run({ TAVILY_API_KEY: 'dummy-value', PATENTSVIEW_API_KEY: 'dummy-value' });
  assert.deepEqual(full.hats.white.providers, ['openalex', 'arxiv', 'tavily', 'kaggle']);
  assert.deepEqual(full.hats.white.lens_set.map(e => e.lens), ['scholarly', 'preprint', 'industry', 'datasets']);
  assert.deepEqual(full.hats.yellow.providers, ['tavily', 'openalex', 'arxiv']);
  assert.deepEqual(full.hats.green.providers, ['openalex', 'arxiv', 'patents', 'asknature']);
  assert.equal(full.hats.white.unavailable_line, '');
  for (const e of full.hats.black.lens_set) assert.equal(typeof e.weight, 'number');
  assert.equal(process.env.TAVILY_API_KEY === 'dummy-value', false);
});

check('E20. NEGATIVE: a third handle is schema_invalid for that hat only', () => {
  withEnv(NO_KEYS, () => {
    const room = harborRoom();
    const env = envOf();
    const { res } = runToAccepted(room, env);
    writeAllHandles(res, ['black', 'yellow', 'green']);
    writeHandles(res, 'white', ['battery recycling', 'grid storage', 'supply chains']);
    const out = plan(room, env, res);
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.equal(out.hats.white, 'not_planned:no_valid_handle');
    assert.ok(out.plan.hats.white.refused[0].reason.startsWith('schema_invalid'));
    assert.deepEqual(out.planned, ['black', 'yellow', 'green']);
    assert.equal(JSON.stringify(out.plan).includes('battery'), false);
  });
});

check('E21. NEGATIVE: plan-research makes no fetch', () => {
  withEnv(NO_KEYS, () => {
    const room = harborRoom();
    const env = envOf();
    const { res } = runToAccepted(room, env);
    writeAllHandles(res);
    let calls = 0;
    const out = door.cmdPlanResearch({ roomDir: room, runId: res.run_id }, opts(env, { _fetchCorpusEnvelope: () => { calls += 1; return {}; } }));
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.equal(calls, 0);
  });
});

check('E22. the handles store is keyed by brief and persona hash and spares the second run its handle agents', () => {
  withEnv(NO_KEYS, () => {
    const room = harborRoom();
    const env = envOf();
    const first = runToAccepted(room, env);
    const res = first.res;
    const fpBefore = ops.roomFingerprint(room);
    writeAllHandles(res, ['white', 'yellow', 'green']);
    writeHandles(res, 'black', ['supply chains', 'harbor pricing']);
    const out = plan(room, env, res);
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.equal(ops.roomFingerprint(room), fpBefore);
    const storeDir = path.join(room, '.mindrian', 'hats', 'handles');
    const files = fs.readdirSync(storeDir);
    assert.deepEqual(files, [ledgerOf(res).brief_hash.slice(0, 16) + '.json']);
    const store = JSON.parse(fs.readFileSync(path.join(storeDir, files[0]), 'utf8'));
    const fresh = ops.personaFreshness(room);
    for (const hat of RESEARCH) {
      assert.equal(store.hats[hat].persona_sha256, sha(path.join(room, 'personas', fresh.hats[hat].file)), hat);
      assert.equal(store.hats[hat].brief_hash, ledgerOf(res).brief_hash);
    }
    assert.deepEqual(store.hats.black.handles, ['supply chains']);
    assert.deepEqual(store.hats.white.handles, GOOD.white);
    assert.equal(fs.existsSync(path.join(res.hats.white.dir, 'handles.json')), false);
    assert.deepEqual(filesHolding([room], 'harbor pricing'), []);
    // second run, same brief, same persona files: nothing to ask, planned from the store
    const res2 = startDeep(room, env);
    assert.deepEqual(res2.handles_needed, []);
    const out2 = plan(room, env, res2);
    assert.equal(out2.ok, true, JSON.stringify(out2));
    assert.deepEqual(out2.planned, RESEARCH);
    assert.deepEqual(out2.plan.hats.white.strings.map(s => s.handle), GOOD.white);
    assert.deepEqual(out2.plan.hats.black.strings.map(s => s.handle), ['supply chains']);
    assert.equal(out2.plan.hats.black.strings.length, 1);
    // a changed persona file puts that hat back on the list; the rest stay served
    const wf = path.join(room, 'personas', fresh.hats.white.file);
    fs.appendFileSync(wf, '\nOne more line.\n');
    const res3 = startDeep(room, env);
    assert.deepEqual(res3.handles_needed, ['white']);
  });
});

check('E23. handles_needed is in the output of start and of accept-persona, and never names red or blue', () => {
  withEnv(NO_KEYS, () => {
    const room = harborRoom();
    const env = envOf();
    const { res, accept } = runToAccepted(room, env, ['black']);
    assert.deepEqual(res.handles_needed, []);
    assert.deepEqual(accept.handles_needed, ['white', 'yellow', 'green']);
    const room2 = harborRoom();
    const env2 = envOf();
    runToAccepted(room2, env2);
    const next = startDeep(room2, env2);
    assert.deepEqual(next.to_build, []);
    assert.deepEqual(next.handles_needed, RESEARCH);
    const q = door.cmdStart({ roomDir: room2, briefPath: writeJsonTmp('brief', 'brief.json', briefOf({ mode: 'quick' })), mode: 'quick' }, opts(env2));
    assert.equal(q.ok, true, JSON.stringify(q));
    assert.equal(Object.prototype.hasOwnProperty.call(q, 'handles_needed'), false);
  });
});

function editedFile(res, edits, over) {
  return writeJsonTmp('edited', 'edited.json', Object.assign({ schema: 'mos.persona-edited/1', run_id: res.run_id, edits }, over || {}));
}
function planWithHandles(refuse) {
  const room = harborRoom();
  const env = envOf();
  const { res } = runToAccepted(room, env, refuse);
  writeAllHandles(res);
  const out = plan(room, env, res);
  assert.equal(out.ok, true, JSON.stringify(out));
  return { room, env, res, out };
}
function edit(ctx, edits, over) {
  return door.cmdPlanResearch({ roomDir: ctx.room, runId: ctx.res.run_id, editedPath: editedFile(ctx.res, edits, over) }, opts(ctx.env));
}

check('E24. an edit with its qualifier replaces the string, raises plan_seq and is in the audit', () => {
  withEnv(NO_KEYS, () => {
    const ctx = planWithHandles();
    const old = ctx.out.plan.hats.black.strings[0];
    const out = edit(ctx, [{ hat: 'black', q_hash_replaced: old.q_hash, text: 'lithium recycling failure cases' }]);
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.equal(out.plan.plan_seq, 2);
    const s = out.plan.hats.black.strings[0];
    assert.deepEqual(s, { text: 'lithium recycling failure cases', q_hash: fam.qHash('lithium recycling failure cases'), handle: 'lithium recycling', qualifier: 'failure cases', edited: true });
    assert.notEqual(s.q_hash, old.q_hash);
    assert.equal(out.plan.hats.black.strings[1].edited, false);
    assert.deepEqual(ledgerOf(ctx.res).audit.edited_strings, [{ hat: 'black', q_hash: s.q_hash, plan_seq: 2 }]);
    const onDisk = JSON.parse(fs.readFileSync(path.join(mapOf(ctx.env, ctx.res, ctx.room).scratch_root, 'plan.json'), 'utf8'));
    assert.deepEqual(onDisk, out.plan);
    assert.deepEqual(out.refused_shown, []);
    assert.equal(ledgerOf(ctx.res).steps.run_research, undefined);
  });
});

check('E25. NEGATIVE: a refused edit keeps the plan, names its reason and is in no file', () => {
  withEnv(NO_KEYS, () => {
    const ctx = planWithHandles();
    const old = ctx.out.plan.hats.black.strings[0].q_hash;
    const planFile = path.join(mapOf(ctx.env, ctx.res, ctx.room).scratch_root, 'plan.json');
    const before = sha(planFile);
    const cases = [
      ['lithium recycling', 'qualifier_removed'],
      ['lithium recycling success cases', 'qualifier_removed'],
      ['harbor pricing failure cases', 'room_identity_word'],
      ['zzprobe 2030 failure cases', 'handle_has_digit'],
      ['Zzprobe pricing failure cases', 'handle_not_generic_shape'],
      ['zzprobe me@example.com failure cases', 'egress_violation'],
      ['zzprobe\nrecycling failure cases', 'bad_query'],
      ['zz '.repeat(90) + 'failure cases', 'too_long'],
      ['failure cases', 'handle_not_generic_shape'],
    ];
    const out = edit(ctx, cases.map(c => ({ hat: 'black', q_hash_replaced: old, text: c[0] })));
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.deepEqual(out.refused_shown.map(r => r.reason), cases.map(c => c[1]));
    for (let i = 0; i < cases.length; i += 1) {
      assert.equal(out.refused_shown[i].hat, 'black');
      assert.equal(out.refused_shown[i].text, cases[i][0].slice(0, 300));
    }
    assert.equal(out.plan.plan_seq, 1);
    assert.equal(sha(planFile), before);
    assert.equal(out.plan.hats.black.strings[0].q_hash, old);
    assert.equal(ledgerOf(ctx.res).audit, undefined);
    assert.equal(JSON.stringify(out.plan).includes('zzprobe'), false);
    assert.deepEqual(filesHolding([ctx.room, ctx.env.tmpDir, ctx.env.homeDir], 'zzprobe'), []);
    assert.equal(ledgerOf(ctx.res).research.strings_refused, cases.length);
  });
});

check('E26. NEGATIVE: red and blue never search, and a hash that the plan does not hold is refused', () => {
  withEnv(NO_KEYS, () => {
    const ctx = planWithHandles();
    const old = ctx.out.plan.hats.black.strings[0].q_hash;
    const out = edit(ctx, [
      { hat: 'red', q_hash_replaced: old, text: 'lithium recycling failure cases' },
      { hat: 'blue', q_hash_replaced: old, text: 'lithium recycling failure cases' },
      { hat: 'black', q_hash_replaced: 'sha256:' + 'f'.repeat(64), text: 'lithium recycling failure cases' },
      { hat: 'white', q_hash_replaced: old, text: 'lithium recycling data statistics' },
      { hat: 'purple', q_hash_replaced: old, text: 'lithium recycling failure cases' },
    ]);
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.deepEqual(out.refused_shown.map(r => r.reason), ['hat_never_searches', 'hat_never_searches', 'string_not_in_plan', 'string_not_in_plan', 'hat_never_searches']);
    assert.equal(out.plan.plan_seq, 1);
  });
});

check('E27. two accepted edit rounds give plan_seq 3, each plan is complete', () => {
  withEnv(NO_KEYS, () => {
    const ctx = planWithHandles();
    const b0 = ctx.out.plan.hats.black.strings[0];
    const r1 = edit(ctx, [{ hat: 'black', q_hash_replaced: b0.q_hash, text: 'lithium recycling failure cases' }]);
    assert.equal(r1.plan.plan_seq, 2);
    const w0 = r1.plan.hats.white.strings[1];
    const r2 = edit(ctx, [{ hat: 'white', q_hash_replaced: w0.q_hash, text: 'cell chemistry data statistics' }]);
    assert.equal(r2.ok, true, JSON.stringify(r2));
    assert.equal(r2.plan.plan_seq, 3);
    assert.deepEqual(Object.keys(r2.plan.hats), RESEARCH);
    for (const hat of RESEARCH) assert.equal(r2.plan.hats[hat].strings.length, 2);
    assert.equal(r2.plan.hats.black.strings[0].text, 'lithium recycling failure cases');
    assert.equal(r2.plan.hats.black.strings[0].edited, true);
    assert.equal(r2.plan.hats.white.strings[1].text, 'cell chemistry data statistics');
    assert.deepEqual(ledgerOf(ctx.res).audit.edited_strings.map(e => [e.hat, e.plan_seq]), [['black', 2], ['white', 3]]);
    // an edit file of another run, an unknown key or a missing plan step is refused by name
    const bad1 = door.cmdPlanResearch({ roomDir: ctx.room, runId: ctx.res.run_id, editedPath: editedFile(ctx.res, [], { extra: 1 }) }, opts(ctx.env));
    assert.ok(String(bad1.reason).startsWith('schema_invalid') || String(bad1.reason).startsWith('unknown_key'), JSON.stringify(bad1));
    const bad2 = door.cmdPlanResearch({ roomDir: ctx.room, runId: ctx.res.run_id, editedPath: editedFile(ctx.res, [{ hat: 'black', q_hash_replaced: 'x', text: 'y' }], { run_id: '20200101-000000-abcd' }) }, opts(ctx.env));
    assert.ok(String(bad2.reason).startsWith('schema_invalid'), JSON.stringify(bad2));
    // an edit that changes nothing, and one that repeats another string of the hat
    const cur = r2.plan.hats.white.strings;
    const same = edit(ctx, [{ hat: 'white', q_hash_replaced: cur[0].q_hash, text: cur[0].text }]);
    assert.equal(same.refused_shown[0].reason, 'string_unchanged');
    const dup = edit(ctx, [{ hat: 'white', q_hash_replaced: cur[0].q_hash, text: cur[1].text }]);
    assert.equal(dup.refused_shown[0].reason, 'duplicate_string');
    assert.equal(dup.plan.plan_seq, 3);
  });
});

check('E27b. the edit path needs a plan, and a plain second call is refused', () => {
  withEnv(NO_KEYS, () => {
    const room = harborRoom();
    const env = envOf();
    const { res } = runToAccepted(room, env);
    const early = door.cmdPlanResearch({ roomDir: room, runId: res.run_id, editedPath: editedFile(res, []) }, opts(env));
    assert.deepEqual(early, { ok: false, reason: 'step_out_of_order:plan_research' });
    writeAllHandles(res);
    assert.equal(plan(room, env, res).ok, true);
    assert.deepEqual(plan(room, env, res), { ok: false, reason: 'step_already_done:plan_research' });
  });
});

check('E27c. a hat with no available provider is not planned (preflight seam)', () => {
  withEnv(NO_KEYS, () => {
    const room = harborRoom();
    const env = envOf();
    const { res } = runToAccepted(room, env);
    writeAllHandles(res);
    const seam = (set) => (set.includes('patent') ? { available: [], unavailable: [{ lens: 'scholarly', provider: 'openalex', reason: 'no_key', needs: 'x' }] } : { available: set.slice(), unavailable: [] });
    const out = door.cmdPlanResearch({ roomDir: room, runId: res.run_id }, opts(env, { preflightLenses: seam }));
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.equal(out.hats.green, 'not_planned:no_available_provider');
    assert.deepEqual(out.plan.hats.green.strings, []);
    assert.deepEqual(out.planned, ['white', 'black', 'yellow']);
  });
});

check('E27d. the router takes --edited and prints one JSON object', () => {
  withEnv(NO_KEYS, () => {
    const room = harborRoom();
    const env = envOf();
    const { res } = runToAccepted(room, env);
    writeAllHandles(res);
    const env2 = Object.assign({}, process.env, { MINDRIAN_HOME: env.homeDir });
    const run = (extra) => spawnSync(process.execPath, [DOOR_PATH, 'plan-research', '--room', room, '--run', res.run_id].concat(extra || []), { env: env2, encoding: 'utf8' });
    const first = run();
    assert.equal(first.status, 0, first.stderr);
    const p1 = JSON.parse(first.stdout);
    assert.equal(p1.ok, true, first.stdout);
    const old = p1.plan.hats.green.strings[0].q_hash;
    const second = run(['--edited', editedFile(res, [{ hat: 'green', q_hash_replaced: old, text: 'tidal turbines analogous solutions' }])]);
    assert.equal(second.status, 0, second.stderr);
    const p2 = JSON.parse(second.stdout);
    assert.equal(p2.plan.plan_seq, 2, second.stdout);
    assert.equal(p2.plan.hats.green.strings[0].edited, true);
  });
});

// ---- the pack hashes (open risk of plan 07) ----

function readingOf(res, hat, over) {
  const ids = ledgerOf(res).sub_questions.map(s => s.id);
  const base = { schema: 'mos.persona-reading/1', run_id: res.run_id, hat };
  if (hat === 'blue') return Object.assign(base, { skipped: [], thin: [], ask_next: [] }, over || {});
  base.positions = ids.map(id => ({ sub_question: id, value: 'no_position' }));
  if (hat === 'white') Object.assign(base, { evidence: [], missing_data: ['The price of rival plans.'] });
  if (hat === 'black') Object.assign(base, { evidence: [] });
  if (hat === 'yellow') Object.assign(base, { evidence: [], none_found: false });
  if (hat === 'green') Object.assign(base, { provocations: ['What if the client owns the hand-off?'], evidence: [] });
  return Object.assign(base, over || {});
}
function writeReading(res, hat, obj) {
  fs.writeFileSync(path.join(res.hats[hat].dir, 'reading.json'), JSON.stringify(obj), 'utf8');
}
const FORGED = { id: 'EvidenceClaim:s1:forged', title: 'ForgedTitle', url: 'https://forged.example.org/x', tier: 'T2', provider: 'openalex', summary: 'Forged.', retrieved_at: '2026-11-25T10:00:00Z', q_hash: 'forged' };
function forgePack(res, hat, file) {
  const f = path.join(res.hats[hat].dir, file);
  const pack = JSON.parse(fs.readFileSync(f, 'utf8'));
  pack.items.push(FORGED);
  fs.writeFileSync(f, JSON.stringify(pack), 'utf8');
}
function closedRun() {
  const room = harborRoom();
  const env = envOf();
  const { res } = runToAccepted(room, env);
  const out = plan(room, env, res);
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(ledgerOf(res).steps.run_research.state, 'skipped');
  return { room, env, res };
}

check('E28. the closing branch seals the packs: hashes of the files are in the ledger', () => {
  const { res } = closedRun();
  const l = ledgerOf(res);
  assert.ok(l.packs && typeof l.packs === 'object');
  const white = sha(path.join(res.hats.white.dir, 'shared-white.json'));
  assert.equal(l.packs.shared_white, white);
  for (const h of READ_HATS) assert.equal(sha(path.join(res.hats[h].dir, 'shared-white.json')), white, h);
  assert.deepEqual(Object.keys(l.packs.evidence).sort(), RESEARCH.slice().sort());
  for (const h of RESEARCH) assert.equal(l.packs.evidence[h], sha(path.join(res.hats[h].dir, 'evidence.json')), h);
  assert.equal(fs.existsSync(path.join(res.hats.red.dir, 'evidence.json')), false);
});

check('E29. NEGATIVE: a hat that rewrites its own pack, or its copy of the White package, is rejected by check', () => {
  const { room, env, res } = closedRun();
  for (const h of HATS) writeReading(res, h, readingOf(res, h));
  forgePack(res, 'white', 'evidence.json');
  writeReading(res, 'white', readingOf(res, 'white', { evidence: [{ source: FORGED.id, tier: 'T2', note: 'A forged fact.' }] }));
  forgePack(res, 'black', 'shared-white.json');
  writeReading(res, 'black', readingOf(res, 'black', { evidence: [{ source: FORGED.url, tier: 'T2', disposition: 'disconfirming', note: 'A forged counter.' }] }));
  fs.rmSync(path.join(res.hats.yellow.dir, 'evidence.json'));
  const out = door.cmdCheck({ roomDir: room, runId: res.run_id }, opts(env));
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(out.hats.white.reading, 'rejected:pack_changed_after_research');
  assert.equal(out.hats.black.reading, 'rejected:pack_changed_after_research');
  assert.equal(out.hats.yellow.reading, 'rejected:pack_changed_after_research');
  assert.equal(out.hats.green.reading, 'ran');
  assert.equal(out.hats.red.reading, 'ran');
  assert.equal(JSON.stringify(out).includes('forged'), false);
});

check('E30. NEGATIVE: a pack rewritten after check is rejected by merge and is not shown in the artifact', async () => {
  const { room, env, res } = closedRun();
  for (const h of HATS) writeReading(res, h, readingOf(res, h));
  const c = door.cmdCheck({ roomDir: room, runId: res.run_id }, opts(env));
  assert.equal(c.ok, true, JSON.stringify(c));
  assert.equal(c.hats.white.reading, 'ran');
  forgePack(res, 'white', 'evidence.json');
  forgePack(res, 'green', 'shared-white.json');
  const out = await door.cmdMerge({ roomDir: room, runId: res.run_id }, opts(env));
  assert.equal(out.ok, true, JSON.stringify(out));
  const l = ledgerOf(res);
  assert.equal(l.hats.white.reading, 'rejected:pack_changed_after_research');
  assert.equal(l.hats.green.reading, 'rejected:pack_changed_after_research');
  assert.equal(l.hats.black.reading, 'ran');
  assert.equal(fs.readFileSync(out.artifact, 'utf8').includes('ForgedTitle'), false);
});

check('E31. NEGATIVE: a run map with no sealed packs rejects every reading (the seal lives in the private run map, WR-03)', () => {
  const { room, env, res } = closedRun();
  for (const h of HATS) writeReading(res, h, readingOf(res, h));
  const mapFile = path.join(env.homeDir, 'persona-hats', 'runs', res.run_id + '.json');
  const m = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
  delete m.packs;
  fs.writeFileSync(mapFile, JSON.stringify(m), { encoding: 'utf8', mode: 0o600 });
  const out = door.cmdCheck({ roomDir: room, runId: res.run_id }, opts(env));
  assert.equal(out.ok, true, JSON.stringify(out));
  for (const h of READ_HATS) assert.equal(out.hats[h].reading, 'rejected:packs_not_sealed', h);
});

check('E31b. WR-03 NEGATIVE: a hat that forges its pack AND rewrites the seal in run.json inside the room is still rejected', () => {
  const { room, env, res } = closedRun();
  const mapFile = path.join(env.homeDir, 'persona-hats', 'runs', res.run_id + '.json');
  const m = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
  assert.ok(m.packs && typeof m.packs.shared_white === 'string', 'the seal is in the private run map');
  if (process.platform !== 'win32') assert.equal(fs.statSync(mapFile).mode & 0o777, 0o600, 'the run map stays private');
  for (const h of HATS) writeReading(res, h, readingOf(res, h));
  forgePack(res, 'white', 'evidence.json');
  writeReading(res, 'white', readingOf(res, 'white', { evidence: [{ source: FORGED.id, tier: 'T2', note: 'A forged fact.' }] }));
  const l = ledgerOf(res);
  l.packs.evidence.white = sha(path.join(res.hats.white.dir, 'evidence.json'));
  fs.writeFileSync(path.join(res.review_dir, 'run.json'), JSON.stringify(l), 'utf8');
  const out = door.cmdCheck({ roomDir: room, runId: res.run_id }, opts(env));
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(out.hats.white.reading, 'rejected:pack_changed_after_research');
  assert.equal(out.hats.black.reading, 'ran');
});

check('E32. sealRunPacks is the one door function that a research step calls after it writes the packs', () => {
  const { room, env, res } = closedRun();
  for (const h of HATS) writeReading(res, h, readingOf(res, h));
  forgePack(res, 'white', 'evidence.json');
  writeReading(res, 'white', readingOf(res, 'white', { evidence: [{ source: FORGED.id, tier: 'T2', note: 'A fact.' }] }));
  const sealed = door.sealRunPacks({ roomDir: room, runId: res.run_id }, opts(env));
  assert.equal(sealed.ok, true, JSON.stringify(sealed));
  const out = door.cmdCheck({ roomDir: room, runId: res.run_id }, opts(env));
  assert.equal(out.hats.white.reading, 'ran', JSON.stringify(out.hats.white));
  // copies of the White package that differ cannot be sealed
  forgePack(res, 'red', 'shared-white.json');
  assert.deepEqual(door.sealRunPacks({ roomDir: room, runId: res.run_id }, opts(env)), { ok: false, reason: 'shared_white_copies_differ' });
});

// ---------------------------------------------------------------------------
// Plan 12: run-research, the approval binding (legs E28r to E34r; the plan names them E28 to E34, and E28 to E32 are taken)
// ---------------------------------------------------------------------------

const seEnv = require(path.join(ROOT, 'lib', 'core', 'recovery', 'stage-envelope.cjs'));
const roomDbMod = require(path.join(ROOT, 'lib', 'core', 'room-db.cjs'));
const FULL_KEYS = { TAVILY_API_KEY: 'dummy-value', PATENTSVIEW_API_KEY: 'dummy-value' };

async function withEnvAsync(patch, fn) {
  const saved = {};
  for (const k of Object.keys(patch)) saved[k] = process.env[k];
  for (const k of Object.keys(patch)) { if (patch[k] === null) delete process.env[k]; else process.env[k] = patch[k]; }
  try { return await fn(); } finally {
    for (const k of Object.keys(saved)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
}
function okEnv(source, items) {
  return seEnv.makeStageEnvelope({ stage: 'retrieval', engine: source, status: 'ok', payload: { results: items }, output: items });
}
/** A recording stand-in for the fetch of the corpus. Default: 2 items for each call, URLs that differ by source and query. */
function makeSeam(perCall) {
  const calls = [];
  const fn = async (args) => {
    calls.push({ source: args.source, query: args.query });
    const n = perCall || 2;
    const items = [];
    for (let i = 1; i <= n; i += 1) {
      items.push({ title: 'Title ' + i + ' of ' + args.source, url: 'https://example.org/' + args.source + '/' + i + '/' + fam.qHash(args.query).slice(7, 15), abstract: 'About ' + args.query + ', item ' + i + '.' });
    }
    return okEnv(args.source, items);
  };
  return { fn, calls };
}
function makeDb(room) {
  roomDbMod.closeRoomDb(roomDbMod.openRoomDb(room));
}
function approvedFile(res, hats, over) {
  return writeJsonTmp('approved', 'approved.json', Object.assign({ schema: 'mos.persona-approved/1', run_id: res.run_id, plan_seq: 1, hats }, over || {}));
}
function approveHat(plan, hat, hashes) {
  const p = plan.hats[hat];
  return { decision: 'approve', q_hashes: hashes || p.strings.map(s => s.q_hash), providers: p.providers.slice() };
}
function approveAll(plan, skip) {
  const hats = {};
  for (const hat of RESEARCH) if (!(skip || []).includes(hat)) hats[hat] = approveHat(plan, hat);
  return hats;
}
function researchRun(ctx, approvedPath, seam, extra) {
  return door.cmdRunResearch({ roomDir: ctx.room, runId: ctx.res.run_id, approvedPath }, opts(ctx.env, Object.assign({ _fetchCorpusEnvelope: seam.fn, _sleep: async () => {} }, extra || {})));
}
function textsOf(plan, hat) {
  return plan.hats[hat].strings.map(s => s.text);
}

check('E28r. NEGATIVE: run-research with no plan is refused and fetches nothing', async () => {
  await withEnvAsync(NO_KEYS, async () => {
    const room = harborRoom();
    const env = envOf();
    const { res } = runToAccepted(room, env);
    const seam = makeSeam();
    const out = await door.cmdRunResearch({ roomDir: room, runId: res.run_id, approvedPath: approvedFile(res, {}) }, opts(env, { _fetchCorpusEnvelope: seam.fn }));
    assert.deepEqual(out, { ok: false, reason: 'step_out_of_order:plan_research' });
    assert.equal(seam.calls.length, 0);
    assert.equal(ledgerOf(res).steps.run_research, undefined);
  });
});

check('E29r. NEGATIVE: an approved file that does not match the plan is refused as a whole and nothing is fetched', async () => {
  await withEnvAsync(FULL_KEYS, async () => {
    const ctx = planWithHandles();
    const p = ctx.out.plan;
    const w = p.hats.white;
    const bogus = 'sha256:' + 'f'.repeat(64);
    const good = (hat) => approveHat(p, hat);
    const cases = [
      ['string_not_in_plan', { white: { decision: 'approve', q_hashes: [bogus], providers: w.providers } }, {}],
      ['too_many_strings', { white: { decision: 'approve', q_hashes: [w.strings[0].q_hash, w.strings[1].q_hash, bogus], providers: w.providers } }, {}],
      ['provider_list_mismatch', { white: { decision: 'approve', q_hashes: [w.strings[0].q_hash], providers: w.providers.concat(['patents']) } }, {}],
      ['provider_list_mismatch', { white: { decision: 'approve', q_hashes: [w.strings[0].q_hash], providers: w.providers.slice(0, 1) } }, {}],
      ['provider_list_mismatch', { white: { decision: 'approve', q_hashes: [w.strings[0].q_hash], providers: w.providers.slice().reverse() } }, {}],
      ['hat_never_searches', { white: good('white'), red: { decision: 'approve', q_hashes: [], providers: [] } }, {}],
      ['hat_never_searches', { white: good('white'), blue: { decision: 'refuse', q_hashes: [], providers: [] } }, {}],
      ['unknown_key:extra', { white: good('white') }, { extra: 1 }],
      ['unknown_key:extra', { white: Object.assign({ extra: 1 }, good('white')) }, {}],
      ['schema_invalid:run_id', { white: good('white') }, { run_id: '20200101-000000-abcd' }],
      ['schema_invalid:schema', { white: good('white') }, { schema: 'mos.persona-approved/2' }],
      ['schema_invalid:decision', { white: Object.assign({}, good('white'), { decision: 'maybe' }) }, {}],
    ];
    for (const c of cases) {
      const seam = makeSeam();
      const out = await researchRun(ctx, approvedFile(ctx.res, c[1], c[2]), seam);
      assert.deepEqual(out, { ok: false, reason: c[0] }, JSON.stringify(c));
      assert.equal(seam.calls.length, 0, c[0]);
    }
    assert.equal(ledgerOf(ctx.res).steps.run_research, undefined);
    assert.equal(fs.existsSync(path.join(ctx.res.hats.white.dir, 'evidence.json')), false);
  });
});

check('E29r2. NEGATIVE: an approved file of an older plan is refused as plan_seq_stale', async () => {
  await withEnvAsync(NO_KEYS, async () => {
    const ctx = planWithHandles();
    const old = ctx.out.plan.hats.black.strings[0];
    const edited = edit(ctx, [{ hat: 'black', q_hash_replaced: old.q_hash, text: 'lithium recycling failure cases' }]);
    assert.equal(edited.plan.plan_seq, 2);
    const seam = makeSeam();
    const stale = await researchRun(ctx, approvedFile(ctx.res, approveAll(ctx.out.plan), { plan_seq: 1 }), seam);
    assert.deepEqual(stale, { ok: false, reason: 'plan_seq_stale' });
    // the replaced hash of the old plan is also not in the new plan
    const stale2 = await researchRun(ctx, approvedFile(ctx.res, approveAll(ctx.out.plan), { plan_seq: 2 }), seam);
    assert.deepEqual(stale2, { ok: false, reason: 'string_not_in_plan' });
    assert.equal(seam.calls.length, 0);
  });
});

check('E30r. a refused or deferred hat is declined and not fetched; the others are fetched', async () => {
  await withEnvAsync(NO_KEYS, async () => {
    const ctx = planWithHandles();
    makeDb(ctx.room);
    const p = ctx.out.plan;
    const hats = approveAll(p, ['black', 'yellow']);
    hats.black = { decision: 'refuse', q_hashes: [], providers: [] };
    hats.yellow = { decision: 'defer', q_hashes: [], providers: [] };
    const seam = makeSeam();
    const out = await researchRun(ctx, approvedFile(ctx.res, hats), seam);
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.equal(out.hats.black, 'declined');
    assert.equal(out.hats.yellow, 'declined');
    assert.equal(out.reasons.black, null);
    assert.equal(out.reasons.yellow, 'deferred');
    assert.equal(out.hats.white, 'ran_with_results');
    assert.equal(out.hats.green, 'ran_with_results');
    const queries = seam.calls.map(c => c.query);
    for (const hat of ['black', 'yellow']) for (const t of textsOf(p, hat)) assert.equal(queries.includes(t), false, t);
    for (const hat of ['white', 'green']) for (const t of textsOf(p, hat)) assert.equal(queries.includes(t), true, t);
    for (const hat of ['black', 'yellow']) {
      const pack = JSON.parse(fs.readFileSync(path.join(ctx.res.hats[hat].dir, 'evidence.json'), 'utf8'));
      assert.equal(pack.research_state, 'declined');
      assert.deepEqual(pack.items, []);
      assert.deepEqual(pack.strings, []);
    }
    const l = ledgerOf(ctx.res);
    assert.equal(l.hats.black.research, 'declined');
    assert.equal(l.hats.yellow.research, 'declined');
    assert.equal(l.hats.yellow.research_reason, 'deferred');
    assert.equal(l.steps.run_research.state, 'done');
  });
});

check('E31r. a planned hat that the approved file does not name is declined with reason no_answer', async () => {
  await withEnvAsync(NO_KEYS, async () => {
    const ctx = planWithHandles();
    makeDb(ctx.room);
    const p = ctx.out.plan;
    const seam = makeSeam();
    const out = await researchRun(ctx, approvedFile(ctx.res, approveAll(p, ['green'])), seam);
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.equal(out.hats.green, 'declined');
    assert.equal(out.reasons.green, 'no_answer');
    for (const t of textsOf(p, 'green')) assert.equal(seam.calls.some(c => c.query === t), false);
    assert.equal(ledgerOf(ctx.res).hats.green.research_reason, 'no_answer');
  });
});

check('E32r. a provider set that changed since the plan fails that hat with provider_set_changed and fetches nothing for it', async () => {
  await withEnvAsync(FULL_KEYS, async () => {
    const ctx = planWithHandles();
    makeDb(ctx.room);
    const p = ctx.out.plan;
    assert.deepEqual(p.hats.yellow.providers, ['tavily', 'openalex', 'arxiv']);
    // At run time the industry lens (tavily) is gone for the hat whose table starts with it.
    const seamPre = (set) => (set[0] === 'industry'
      ? { available: set.slice(1), unavailable: [{ lens: 'industry', provider: 'tavily', reason: 'no_key', needs: 'TAVILY_API_KEY' }] }
      : { available: set.slice(), unavailable: [] });
    const seam = makeSeam();
    const out = await researchRun(ctx, approvedFile(ctx.res, approveAll(p)), seam, { preflightLenses: seamPre });
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.equal(out.hats.yellow, 'failed');
    assert.equal(out.reasons.yellow, 'provider_set_changed');
    for (const t of textsOf(p, 'yellow')) assert.equal(seam.calls.some(c => c.query === t), false, t);
    for (const hat of ['white', 'black', 'green']) {
      assert.equal(out.hats[hat], 'ran_with_results', hat);
      for (const t of textsOf(p, hat)) assert.equal(seam.calls.some(c => c.query === t), true, t);
    }
    assert.equal(ledgerOf(ctx.res).hats.yellow.research, 'failed');
    assert.equal(ledgerOf(ctx.res).hats.yellow.research_reason, 'provider_set_changed');
  });
});

check('E33r. the approved subset is honoured: one of two planned strings reaches the fetch', async () => {
  await withEnvAsync(NO_KEYS, async () => {
    const ctx = planWithHandles();
    makeDb(ctx.room);
    const p = ctx.out.plan;
    const seam = makeSeam();
    const hats = { white: approveHat(p, 'white', [p.hats.white.strings[0].q_hash]) };
    const out = await researchRun(ctx, approvedFile(ctx.res, hats), seam);
    assert.equal(out.ok, true, JSON.stringify(out));
    // Two door providers (openalex and arxiv) are asked the one approved string.
    assert.deepEqual(Array.from(new Set(seam.calls.map(c => c.query))), [p.hats.white.strings[0].text]);
    assert.equal(out.hats.white, 'ran_with_results');
    const pack = JSON.parse(fs.readFileSync(path.join(ctx.res.hats.white.dir, 'evidence.json'), 'utf8'));
    assert.deepEqual(pack.strings.map(s => s.q_hash), [p.hats.white.strings[0].q_hash]);
    // the other string of white and the other hats count as refused strings
    const l = ledgerOf(ctx.res);
    assert.equal(l.research.strings_approved, 1);
    assert.equal(l.research.strings_refused, 7);
  });
});

check('E34r. two approved strings give two rounds for the hat and at most 10 items', async () => {
  await withEnvAsync(NO_KEYS, async () => {
    const ctx = planWithHandles();
    makeDb(ctx.room);
    const p = ctx.out.plan;
    const seam = makeSeam(8);
    const out = await researchRun(ctx, approvedFile(ctx.res, { white: approveHat(p, 'white') }), seam);
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.deepEqual(Array.from(new Set(seam.calls.map(c => c.query))).sort(), textsOf(p, 'white').slice().sort());
    const pack = JSON.parse(fs.readFileSync(path.join(ctx.res.hats.white.dir, 'evidence.json'), 'utf8'));
    assert.equal(pack.strings.length, 2);
    assert.equal(pack.items.length, 10);
    assert.ok(pack.items.length <= 10);
  });
});

check('F11. invokePersona stays at line 550 of persona-ops.cjs', () => {
  const lines = fs.readFileSync(path.join(ROOT, 'lib', 'core', 'persona-ops.cjs'), 'utf8').split('\n');
  assert.ok(lines[549].startsWith('function invokePersona('), lines[549]);
});

(async () => {
  for (const t of queue) {
    try {
      await t.fn();
      passed += 1;
      console.log('ok: ' + t.label);
    } catch (e) {
      failed += 1;
      console.log('FAIL: ' + t.label + ' -- ' + (e && e.message ? e.message : String(e)));
    }
  }
  for (const d of tmpRoots) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* ignore */ }
  }
  console.log(passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
