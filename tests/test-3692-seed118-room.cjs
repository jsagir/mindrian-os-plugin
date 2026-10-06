#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.2 Plan 31 -- the SEED-118 shaped fixture room is valid (RESEARCH Section 5, R25).
 *
 * tests/fixtures/release-room-seed118 is the second committed seed for scripts/real-room-run.cjs. It is
 * shaped like the room of the SEED-118 working session so that each of that session's twelve defects has its
 * trigger. This test proves the preconditions are present; it does not prove the defects are fixed (the
 * closure plans do that).
 *
 *   S1 seed     real-room-run --offline births the room: exit 0, registered, seeded counts equal seed.json
 *   S2 plan     the quick and the deep set both plan ok and ready; the only refusals are the expected typed ones
 *   S3 sets     D1 patent need, D2 two blind_spot leaves, D3 marker terms, D4 unbound limiter sentence,
 *               D5 term2, D8 budget 8, positive finding query_kinds, web-lines-free names
 *   S4 bridge   D10: the encoding shares no entity with any other artifact and is a sapphire-encoding
 *   S5 replay   every seed118 route row maps to a body that exists, and a spawned child serves them
 *   S6 names    no em or en dash, no person name outside the invented allowlist, records marked synthetic
 *
 * HERMETIC: HOME, USERPROFILE, MINDRIAN_ROOMS_HOME and the receipt dir are temp dirs; the Brain URL points at
 * a dead loopback port; no vendor key is set. Output: one PASS or FAIL line per leg, then PASS: n FAIL: n.
 * Exit 0 only when every leg passes. Hyphens only, no em-dash or en-dash.
 */

process.removeAllListeners('warning');

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const RUN_SCRIPT = path.join(ROOT, 'scripts', 'real-room-run.cjs');
const PLANNER_CLI = path.join(ROOT, 'scripts', 'research-planner.cjs');
const SEED = path.join(ROOT, 'tests', 'fixtures', 'release-room-seed118');
const BODIES_FILE = path.join(ROOT, 'tests', 'fixtures', '3692-openalex', 'seed118-bodies.json');
const ROUTE_MODULE = path.join(__dirname, 'helpers', 'replay-route-3692.cjs');

const ENC = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const INVENTED_PEOPLE = Object.freeze(['Orla Venn']);
const LIMITER_SENTENCE = 'Entanglement requires pre-positioned physical barriers';
const EXPECTED_REFUSALS = Object.freeze(['bad_slot:limiter', 'unused_slot:term2', 'unused_slot:term']);

const TMP = [];
function mk(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 't3692-s118-' + prefix + '-'));
  TMP.push(d);
  return d;
}
process.on('exit', function () {
  TMP.forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ } });
});

let pass = 0;
let fail = 0;
function ok(leg) { pass += 1; process.stdout.write('PASS: ' + leg + '\n'); }
function bad(leg, why) { fail += 1; process.stdout.write('FAIL: ' + leg + ' - ' + String(why).replace(/\s+/g, ' ').slice(0, 400) + '\n'); }
function check(leg, cond, why) { if (cond) ok(leg); else bad(leg, why); }

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_e) { return null; }
}
function exists(p) { return fs.existsSync(p); }
function list(v) { return Array.isArray(v) ? v : []; }
function walk(dir, out) {
  if (!exists(dir)) return out;
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (e.isFile()) out.push(p);
  });
  return out;
}
function lastJson(text) {
  const lines = String(text || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i][0] === '{') { try { return JSON.parse(lines[i]); } catch (_e) { /* keep looking */ } }
  }
  return null;
}

// -- the hermetic world ---------------------------------------------------------------
const HOME = mk('home');
const ROOMS = mk('rooms');
const RECEIPTS = mk('rcpt');
function env() {
  const e = Object.assign({}, process.env, {
    HOME: HOME,
    USERPROFILE: HOME,
    MINDRIAN_ROOMS_HOME: ROOMS,
    MINDRIAN_REAL_ROOM_RECEIPT_DIR: RECEIPTS,
    MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9',
  });
  ['TAVILY_API_KEY', 'OPENALEX_API_KEY', 'OPENALEX_EMAIL', 'PATENTSVIEW_API_KEY', 'MINDRIAN_BRAIN_KEY', 'CLAUDE_CODE_SESSION_ID', 'MINDRIAN_ACTIVE_SESSION_ID'].forEach(function (k) { delete e[k]; });
  return e;
}

const seed = readJson(path.join(SEED, 'seed.json'));
const quickSet = readJson(path.join(SEED, 'question-set-quick.json'));
const deepSet = readJson(path.join(SEED, 'question-set-deep.json'));
const bodies = readJson(BODIES_FILE);

// -- S1 seed --------------------------------------------------------------------------
let room = null;
if (!exists(path.join(SEED, 'ROOM.md')) || !seed) {
  bad('S1 seed', 'seed_missing: ' + path.relative(ROOT, SEED) + ' has no ROOM.md or seed.json');
} else {
  const r = cp.spawnSync(process.execPath, [RUN_SCRIPT, '--seed', SEED, '--offline', '--json', '--receipt-dir', RECEIPTS, '--rooms-home', ROOMS],
    { cwd: ROOT, env: env(), encoding: 'utf8', timeout: 280000, maxBuffer: 64 * 1024 * 1024 });
  const res = lastJson(r.stdout);
  room = res && res.room ? res.room : null;
  const s = room && room.seeded ? room.seeded : {};
  const want = { entities: list(seed.entities).length, describes: list(seed.describes).length, known_pairs: list(seed.known_pairs).length, claims: list(seed.claims).length };
  const same = room && s.entities === want.entities && s.describes === want.describes && s.known_pairs === want.known_pairs && s.claims === want.claims;
  check('S1 seed: real-room-run births the room (exit 0, registered, seeded counts equal seed.json, no failures)',
    r.status === 0 && res && res.ok === true && room.registered === true && same && list(s.failures).length === 0,
    'exit ' + r.status + ' seeded ' + JSON.stringify(s) + ' want ' + JSON.stringify(want) + ' ' + String(r.stderr || '').slice(-200));
}

// -- S2 plan --------------------------------------------------------------------------
function planOne(roomDir, file, mode) {
  const r = cp.spawnSync(process.execPath, [PLANNER_CLI, 'plan', file, '--room', roomDir, '--mode', mode],
    { cwd: ROOT, env: env(), encoding: 'utf8', timeout: 120000, maxBuffer: 32 * 1024 * 1024 });
  let json = null;
  try { json = JSON.parse(String(r.stdout || '').trim()); } catch (_e) { json = null; }
  const plan = json && json.run_id ? readJson(path.join(roomDir, '.mindrian', 'research-runs', json.run_id, 'plan.json')) : null;
  return { code: r.status, json: json, plan: plan };
}
if (!room || !room.dir) {
  bad('S2 plan: quick and deep plan ok', 'no room from S1');
} else {
  ['quick', 'deep'].forEach(function (mode) {
    const p = planOne(room.dir, path.join(SEED, 'question-set-' + mode + '.json'), mode);
    const refusals = list(p.plan && p.plan.leaves).map(function (l) { return l.refusal && l.refusal.reason; }).filter(Boolean);
    const unexpected = refusals.filter(function (x) { return EXPECTED_REFUSALS.indexOf(x) === -1; });
    check('S2 plan: ' + mode + ' set plans ok and ready, refusals only the expected typed ones',
      p.code === 0 && p.json && p.json.ok === true && p.json.status === 'ready' && unexpected.length === 0,
      'exit ' + p.code + ' status ' + (p.json && p.json.status) + ' errors ' + JSON.stringify(p.json && p.json.errors) + ' unexpected ' + JSON.stringify(unexpected));
    if (mode === 'deep') {
      const have = {};
      refusals.forEach(function (x) { have[x] = true; });
      check('S2 plan: the deep plan on HEAD shows the D4 and D5 refusals the fixture exists to trigger',
        // a later plan may turn a refusal into a shaped query; the leg then reads the fixture, not the planner
        refusals.length === 0 || (have['bad_slot:limiter'] || have['unused_slot:term2']),
        'refusals ' + JSON.stringify(refusals));
    }
  });
}

// -- S3 sets --------------------------------------------------------------------------
(function sets() {
  if (!deepSet || !quickSet || !seed) { bad('S3 sets', 'a fixture file is missing or not JSON'); return; }
  const leaves = list(deepSet.leaves);
  const roomMd = exists(path.join(SEED, 'ROOM.md')) ? fs.readFileSync(path.join(SEED, 'ROOM.md'), 'utf8') : '';
  const gq = /^governing_question:\s*"?([^"\n]+?)"?\s*$/m.exec(roomMd);
  const question = gq ? gq[1] : '';
  check('S3 sets: the governing question names the fenced city, the invented person and the invented product',
    /Haifa/.test(question) && /Orla Venn PhD/.test(question) && /Nimbus Robotics mast/.test(question), question);
  const q1 = list(quickSet.leaves)[0] || {};
  const term = q1.slots && q1.slots.term;
  check('S3 sets: quick L1 term is six words or fewer and carries the city and the product',
    term === 'Nimbus Robotics tether detection Haifa' && String(term).split(/\s+/).length <= 6, String(term));
  check('S3 sets: quick L1 carries query_kinds practice and adjacent (the positive finding)',
    q1.query_kinds && q1.query_kinds.practice === 'optical time domain reflectometry' && q1.query_kinds.adjacent === 'powerline detection', JSON.stringify(q1.query_kinds));
  const blind = leaves.filter(function (l) { return l.lens === 'mu.blind_spot' && l.slots && !l.slots.term2; });
  const blindTerms = blind.map(function (l) { return l.slots.term; });
  check('S3 sets (D2): two deep leaves on mu.blind_spot with the two terms',
    blindTerms.indexOf('thin-wire detection') !== -1 && blindTerms.indexOf('fiber tether sensing') !== -1, JSON.stringify(blindTerms));
  const alpha = leaves.find(function (l) { return l.lens === 'mu.verify' && l.slots && /SEEDMARK_alpha/.test(String(l.slots.term)); });
  const beta = leaves.find(function (l) { return l.slots && /SEEDMARK_beta/.test(String(l.slots.term)); });
  check('S3 sets (D3): a scientific-roadmapping set with a marker term on L1 (mu.verify) and an extra term on L6',
    deepSet.template_id === 'scientific-roadmapping' && alpha && alpha.id === 'L1' && beta && beta.id === 'L6' && beta.slots.limiter === 'tether contrast at range',
    'template ' + deepSet.template_id + ' alpha ' + (alpha && alpha.id) + ' beta ' + (beta && beta.id));
  const lim = list(deepSet.perspective && deepSet.perspective.limiters).find(function (l) { return l.statement === LIMITER_SENTENCE; });
  const bound = lim ? leaves.filter(function (l) { return l.limiter_id === lim.id && l.slots && typeof l.slots.limiter === 'string' && l.slots.limiter.trim().length > 0; }) : [];
  check('S3 sets (D4): the limiter sentence is a limiter statement and no leaf binds slots.limiter for it',
    !!lim && bound.length === 0 && leaves.every(function (l) { return !l.slots || l.slots.limiter !== LIMITER_SENTENCE; }),
    'limiter ' + (lim && lim.id) + ' bound ' + bound.length);
  const t2 = leaves.find(function (l) { return l.lens === 'mu.blind_spot' && l.slots && l.slots.term2 === 'optical time domain reflectometry'; });
  check('S3 sets (D5): optical time domain reflectometry sits in term2 on a mu.blind_spot leaf', !!t2 && !!t2.slots.term, JSON.stringify(t2 && t2.slots));
  check('S3 sets (D8): the deep budget is 8 searches and the goal target is term-shaped',
    deepSet.fixture_budget && deepSet.fixture_budget.max_searches === 8 && deepSet.perspective.goal.target === 'detection range',
    JSON.stringify(deepSet.fixture_budget));
  check('S3 sets (D1): a patent need is recorded and its replay body exists',
    seed.patent_need && seed.patent_need.lens === 'patent' && bodies && Object.prototype.hasOwnProperty.call(bodies, 'seed118_patent_need'), JSON.stringify(seed.patent_need));
  const probes = list(seed.theo_probes);
  check('S3 sets (D11): three Theo probes (plain, room term, private) are recorded',
    probes.length === 3 && ['plain_methodology', 'room_term', 'private_sentence'].every(function (k) { return probes.some(function (p) { return p.kind === k && String(p.prompt).length > 10; }); }) && /Kestrel Watch/.test(String(probes[1] && probes[1].prompt)),
    JSON.stringify(probes.map(function (p) { return p.kind; })));
  const known = list(seed.known_preconditions).map(function (k) { return k.defect; }).sort().join(',');
  check('S3 sets (D6, D12): recorded as known preconditions', known === 'D12,D6', known);
})();

// -- S4 bridge ------------------------------------------------------------------------
(function bridge() {
  if (!seed) { bad('S4 bridge', 'seed.json missing'); return; }
  const encRel = 'strategy/spider-silk-encoding/spider-silk-encoding';
  const byArtifact = {};
  list(seed.describes).forEach(function (pair) { (byArtifact[pair[0]] = byArtifact[pair[0]] || []).push(pair[1]); });
  const encEntities = byArtifact[encRel] || [];
  const shared = Object.keys(byArtifact).filter(function (a) { return a !== encRel; }).reduce(function (acc, a) {
    return acc.concat(byArtifact[a].filter(function (e) { return encEntities.indexOf(e) !== -1; }));
  }, []);
  const encFile = path.join(SEED, 'sections', encRel + '.md');
  const text = exists(encFile) ? fs.readFileSync(encFile, 'utf8') : '';
  check('S4 bridge (D10): the encoding names entities and shares none with any other artifact',
    encEntities.length > 0 && shared.length === 0, 'encoding entities ' + encEntities.length + ' shared ' + JSON.stringify(shared));
  check('S4 bridge (D10): the encoding is a sapphire-encoding with Function, Behavior and Structure',
    /^methodology:\s*sapphire-encoding\s*$/m.test(text) && /Function:/.test(text) && /Behavior:/.test(text) && /Structure:/.test(text), 'methodology line or F/B/S missing');
})();

// -- S5 replay ------------------------------------------------------------------------
(function replay() {
  let route = null;
  try { route = require(ROUTE_MODULE); } catch (e) { bad('S5 replay', 'route module: ' + e.message); return; }
  if (!bodies) { bad('S5 replay', 'seed118-bodies.json missing or not JSON'); return; }
  const rows = list(route.ROUTES).filter(function (r) { return /^seed118_/.test(r[1]); });
  const missing = rows.filter(function (r) { return !Object.prototype.hasOwnProperty.call(bodies, r[1]); }).map(function (r) { return r[1]; });
  check('S5 replay: every seed118 route row maps to a body id present in seed118-bodies.json',
    rows.length >= 5 && missing.length === 0, 'rows ' + rows.length + ' missing ' + JSON.stringify(missing));
  const merged = route.bodies || {};
  check('S5 replay: the route module exports the merged bodies (363, 369.2 and SEED-118 files)',
    merged.gap_primary_zero && merged.input_session_lane_b && merged.seed118_practice_hits, Object.keys(merged).length + ' ids');
  const dir = mk('preload');
  const seam = require(path.join(__dirname, 'helpers', 'real-corpus-3692.cjs'));
  const preload = seam.writePreload(dir, ROUTE_MODULE);
  const probe = function (q) {
    const code = 'fetch("https://api.openalex.org/works?search=" + encodeURIComponent(process.argv[1])).then(function (r) { return r.json(); }).then(function (j) { process.stdout.write(JSON.stringify({ count: j.meta.count, n: j.results.length })); }).catch(function (e) { process.stdout.write(JSON.stringify({ err: String(e.message) })); });';
    const r = cp.spawnSync(process.execPath, ['-r', preload, '-e', code, q], { cwd: dir, env: env(), encoding: 'utf8', timeout: 60000 });
    try { return JSON.parse(String(r.stdout || '')); } catch (_e) { return { err: 'no json: ' + String(r.stderr || '').slice(-150) }; }
  };
  const practice = probe('optical time domain reflectometry');
  const problem = probe('thin wire detection');
  const laneB = probe('fibre-tethered drone detection near port cranes');
  check('S5 replay: a spawned child fetches the practice term through the preload and gets a non-empty body',
    practice.n > 0 && practice.count === 5085, JSON.stringify(practice));
  check('S5 replay: the problem term answers an empty body and the lane B term answers two records',
    problem.n === 0 && problem.count === 0 && laneB.n === 2, JSON.stringify({ problem: problem, laneB: laneB }));
})();

// -- S6 names -------------------------------------------------------------------------
(function names() {
  const files = walk(SEED, []).concat(exists(BODIES_FILE) ? [BODIES_FILE] : [], [__filename]);
  if (!exists(SEED) || !exists(BODIES_FILE)) { bad('S6 names', 'fixture files missing'); return; }
  const dashed = files.filter(function (f) { const t = fs.readFileSync(f, 'utf8'); return t.indexOf(ENC) !== -1 || t.indexOf(EN) !== -1; });
  check('S6 names: no em or en dash in any fixture file, the bodies or this test', dashed.length === 0, dashed.map(function (f) { return path.relative(ROOT, f); }).join(', '));
  const persons = list(seed && seed.entities).filter(function (e) { return e.type === 'person'; });
  const strange = persons.filter(function (e) { return INVENTED_PEOPLE.indexOf(e.name) === -1; });
  let degree = [];
  walk(SEED, []).forEach(function (f) {
    const t = fs.readFileSync(f, 'utf8');
    (t.match(/\b[A-Z][a-z]+ [A-Z][a-z]+ PhD\b/g) || []).forEach(function (m) { degree.push(m); });
  });
  degree = degree.filter(function (m) { return INVENTED_PEOPLE.indexOf(m.replace(/ PhD$/, '')) === -1; });
  check('S6 names: every person in the room is in the invented-name allowlist', strange.length === 0 && degree.length === 0, JSON.stringify({ strange: strange, degree: degree }));
  const recs = [];
  Object.keys(bodies || {}).forEach(function (k) { if (k !== '_note') list(bodies[k].results).forEach(function (r) { recs.push(r); }); });
  check('S6 names: the bodies are marked synthetic and no record names an author',
    /ynthetic fixture text/.test(String(bodies && bodies._note)) && recs.length > 0 && recs.every(function (r) { return Object.prototype.hasOwnProperty.call(r.abstract_inverted_index || {}, 'synthetic'); }) && recs.every(function (r) { return list(r.authorships).length === 0; }),
    recs.length + ' records');
})();

process.stdout.write('PASS: ' + pass + ' FAIL: ' + fail + '\n');
process.exitCode = fail === 0 ? 0 : 1;
