#!/usr/bin/env node
'use strict';
// Phase 400.2-04: quick mode as a code path. quickLook, the two additive route fields and the MCP quick path.
// Legs Q1 to Q6 (task 1) and Q7, Q8 (task 2). Legs Q9 to Q16 (plan 16): the quick run record through merge.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const OPS_PATH = path.join(ROOT, 'lib', 'core', 'persona-ops.cjs');
const ROUTER_PATH = path.join(ROOT, 'lib', 'mcp', 'tool-router.cjs');
const ops = require(OPS_PATH);

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

const HATS = ['white', 'red', 'black', 'yellow', 'green', 'blue'];
const tmpRoots = [];

function put(room, rel, text) {
  const abs = path.join(room, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text, 'utf8');
}

function makeRoom() {
  const room = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-4002-quick-'));
  tmpRoots.push(room);
  put(room, 'STATE.md', '---\nventure: Harbor Light Studio\nstage: seed\n---\n\n# Harbor Light Studio\n\nA test venture.\n');
  put(room, 'problem-definition/core-problem.md', '# Core problem\nSmall studios lose clients at the hand-off.\n');
  put(room, 'market-analysis/size.md', '# Size\nAbout 4000 studios in the region.\n');
  return room;
}

function writeHatFile(room, name, fm, body) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(fm)) lines.push(k + ': ' + v);
  lines.push('---', '', body || '# Persona', '');
  put(room, path.join('personas', name), lines.join('\n'));
}

// Q1
check('Q1. quickLook starts with mode quick and QUICK_NOTICE', () => {
  const room = makeRoom();
  const out = ops.quickLook(room);
  const keys = Object.keys(out);
  assert.equal(keys[0], 'mode');
  assert.equal(keys[1], 'notice');
  assert.equal(out.mode, 'quick');
  assert.equal(out.notice, ops.QUICK_NOTICE);
  assert.ok(JSON.stringify(out).startsWith('{"mode":"quick","notice":'));
});

// Q2
check('Q2. no personas directory: six hats on the fixed discipline, no error key', () => {
  const room = makeRoom();
  assert.equal(fs.existsSync(path.join(room, 'personas')), false);
  const out = ops.quickLook(room);
  assert.deepEqual(Object.keys(out.hats), HATS);
  for (const h of HATS) {
    assert.equal(out.hats[h].source, 'fixed_discipline', h);
    assert.equal(out.hats[h].text, ops.HAT_DISCIPLINE[h], h);
  }
  assert.deepEqual(out.fixed_discipline_hats, HATS);
  assert.equal('error' in out, false);
  assert.equal(out.artifact, null);
});

// Q3
check('Q3. only a fresh persona is used; stale, unaccepted and preview-only are named as fixed discipline', () => {
  const room = makeRoom();
  const fp = ops.roomFingerprint(room);
  const old = 'a'.repeat(64);
  writeHatFile(room, 'black-harbor.md', { hat: 'black', built_by: 'persona-analyst', persona_status: 'accepted', room_fingerprint: '"' + fp + '"' }, '# Black persona\nFRESH-BLACK-MARK\n');
  writeHatFile(room, 'white-harbor.md', { hat: 'white', built_by: 'persona-analyst', persona_status: 'accepted', room_fingerprint: '"' + old + '"' }, '# White\nSTALE-WHITE-MARK\n');
  writeHatFile(room, 'yellow-harbor.md', { hat: 'yellow', built_by: 'persona-analyst', persona_status: 'proposed', room_fingerprint: '"' + fp + '"' }, '# Yellow\nUNACCEPTED-YELLOW-MARK\n');
  writeHatFile(room, 'green-harbor.md', { hat: 'green', domain: 'harbor', preview_notice: '"QUICK PREVIEW"' }, '# Green\nPREVIEW-GREEN-MARK\n');
  const out = ops.quickLook(room);
  assert.equal(out.hats.black.source, 'persona_file');
  assert.ok(out.hats.black.text.includes('FRESH-BLACK-MARK'));
  for (const h of ['white', 'red', 'yellow', 'green', 'blue']) {
    assert.equal(out.hats[h].source, 'fixed_discipline', h);
    assert.equal(out.hats[h].text, ops.HAT_DISCIPLINE[h], h);
  }
  assert.deepEqual(out.fixed_discipline_hats, ['white', 'red', 'yellow', 'green', 'blue']);
  const all = JSON.stringify(out);
  for (const mark of ['STALE-WHITE-MARK', 'UNACCEPTED-YELLOW-MARK', 'PREVIEW-GREEN-MARK']) {
    assert.equal(all.includes(mark), false, mark);
  }
});

// Q4
check('Q4. no tension map and no perspectives key; an artifact is carried as text', () => {
  const room = makeRoom();
  const art = path.join(room, 'problem-definition', 'core-problem.md');
  const out = ops.quickLook(room, art);
  assert.equal('tension_map' in out, false);
  assert.equal('perspectives' in out, false);
  assert.ok(out.artifact.includes('Small studios lose clients'));
  assert.equal(ops.quickLook(room, path.join(room, 'missing.md')).artifact, null);
});

// Q5 (NEGATIVE)
check('Q5. quick mode makes zero requests and requires no research module', () => {
  const room = makeRoom();
  let requests = 0;
  const savedFetch = globalThis.fetch;
  const saved = [];
  function wrap(mod, name) {
    const orig = mod[name];
    saved.push([mod, name, orig]);
    mod[name] = function () { requests += 1; throw new Error('network blocked in test'); };
  }
  globalThis.fetch = function () { requests += 1; throw new Error('fetch blocked in test'); };
  for (const m of [http, https]) { wrap(m, 'request'); wrap(m, 'get'); }
  try {
    const out = ops.quickLook(room);
    assert.equal(out.mode, 'quick');
  } finally {
    globalThis.fetch = savedFetch;
    for (const [mod, name, orig] of saved) mod[name] = orig;
  }
  assert.equal(requests, 0);
  const src = ops.quickLook.toString();
  assert.equal(/require\s*\(/.test(src), false, 'quickLook holds no require');
  assert.equal(/research|corpus|lens/i.test(src), false, 'quickLook names no research, corpus or lens module');
});

// Q6
check('Q6. the route answer keeps routed and route_to and gains surface_note and quick_available', () => {
  const room = makeRoom();
  const out = ops.generatePersonas(room);
  assert.equal(out.routed, true);
  assert.equal(out.route_to, '/mos:persona --parallel');
  assert.equal(out.surface_note, ops.DEEP_SURFACE_NOTE);
  assert.equal(out.quick_available, true);
  assert.equal(fs.existsSync(path.join(room, 'personas')), false);
  assert.equal(ops.DEEP_SURFACE_NOTE, 'Deep review needs separate agents and a local shell. It runs in Claude Code. Here I can give the fast look, which is one pass and not an independent review.');
});

// F11 (kept)
check('F11. invokePersona stays at line 550', () => {
  const lines = fs.readFileSync(OPS_PATH, 'utf8').split('\n');
  assert.ok(lines[549].startsWith('function invokePersona('), lines[549]);
});

// Q7
const routerSrc = fs.readFileSync(ROUTER_PATH, 'utf8');
function caseBody(name) {
  const start = routerSrc.indexOf("case '" + name + "': {");
  assert.ok(start >= 0, 'case ' + name + ' found');
  const end = routerSrc.indexOf('\n        case ', start + 10);
  const end2 = routerSrc.indexOf('\n        default:', start + 10);
  const stop = [end, end2].filter(n => n > 0).sort((a, b) => a - b)[0];
  return routerSrc.slice(start, stop);
}
check('Q7. the analyze-perspectives case calls quickLook and not analyzeAllPerspectives (method: source assertion, the handler needs a server)', () => {
  const body = caseBody('analyze-perspectives');
  assert.ok(body.includes('quickLook('), 'calls quickLook');
  assert.equal(body.includes('analyzeAllPerspectives'), false, 'no analyzeAllPerspectives call');
  assert.equal(/await\s+personaOps\.quickLook/.test(body), false, 'quickLook is synchronous');
  // The JSON the case returns is the quickLook JSON of a fixture room.
  const room = makeRoom();
  const text = JSON.stringify(ops.quickLook(room, null), null, 2);
  const parsed = JSON.parse(text);
  assert.deepEqual(Object.keys(parsed).slice(0, 2), ['mode', 'notice']);
  assert.equal(parsed.notice, ops.QUICK_NOTICE);
  console.log('  (Q7 method: source assertion plus the quickLook JSON of a fixture room)');
});

// Q8
check('Q8. persona --parallel is kept; the generate-personas suggested-next names the fast look', () => {
  assert.ok(routerSrc.includes('persona --parallel'));
  const body = caseBody('generate-personas');
  assert.ok(body.includes('fast look'));
  assert.ok(body.includes('not an independent review'));
  assert.ok(body.includes('Deep review runs in Claude Code as /mos:persona --parallel.'));
});

// ---------------------------------------------------------------------------
// Plan 16: the quick run record through merge (Q9 to Q16). The legs are async: they run after the sync legs.
// ---------------------------------------------------------------------------
const crypto = require('node:crypto');
const DOOR_PATH = path.join(ROOT, 'scripts', 'persona-hats.cjs');
const door = require(DOOR_PATH);
const NOW = new Date('2026-11-25T10:20:30.000Z');
const asyncLegs = [];
function checkAsync(label, fn) { asyncLegs.push({ label, fn }); }

function mkTmp(label) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-4002-quick-' + label + '-'));
  tmpRoots.push(d);
  return d;
}
function counterHex() {
  let n = 0;
  return (len) => crypto.createHash('sha256').update('quick-seam-' + (n += 1)).digest('hex').slice(0, len);
}
let stamp = 0;
function mkEnv(extra) {
  const env = { homeDir: mkTmp('home'), tmpDir: mkTmp('tmp') };
  env.opts = (more) => Object.assign({ homeDir: env.homeDir, tmpDir: env.tmpDir, now: new Date(NOW.getTime() + 1000 * (stamp += 1)), randomHex: counterHex() }, extra || {}, more || {});
  return env;
}
function briefFile(mode) {
  const p = path.join(mkTmp('brief'), 'brief.json');
  fs.writeFileSync(p, JSON.stringify({
    schema: 'mos.persona-brief/1', target: 'room',
    governing_question: 'Should the studio move to a fixed monthly retainer model for new clients?',
    sub_questions: ['Who pays first?', 'What breaks at the hand-off?'],
    reading_list: ['problem-definition/core-problem.md', 'market-analysis/size.md'],
    mode, triage: { recommended: mode, reason: 'A pricing change.' },
  }), 'utf8');
  return p;
}
function startRun(mode, room, env) {
  const res = door.cmdStart({ roomDir: room || makeRoom(), briefPath: briefFile(mode), mode }, env.opts());
  assert.equal(res.ok, true, JSON.stringify(res));
  const ledgerPath = path.join(res.review_dir, 'run.json');
  const run = { res, room: room, env, ledgerPath, ledger: () => JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) };
  run.ids = run.ledger().sub_questions.map(x => x.id);
  return run;
}
// pos: {hat: [value, value]}; a hat that is not in pos gets no_position on both sub-questions.
function quickResultOf(run, pos, over) {
  const hats = {};
  for (const hat of ['white', 'red', 'black', 'yellow', 'green']) {
    const vals = (pos && pos[hat]) || ['no_position', 'no_position'];
    hats[hat] = { positions: run.ids.map((id, i) => (vals[i] === 'no_position' ? { sub_question: id, value: 'no_position' } : { sub_question: id, value: vals[i], line: 'quick ' + hat + ' line ' + i })) };
  }
  hats.green.provocations = ['What if the client owns the hand-off?'];
  hats.blue = { skipped: ['No search was run, by design.'], thin: ['The red hat gave only short lines.'], ask_next: ['Ask who pays first.'] };
  return Object.assign({ schema: 'mos.persona-quick/1', run_id: run.res.run_id, hats }, over || {});
}
function writeQuick(run, obj) {
  const p = path.join(run.res.inbox_dir, 'quick-result.json');
  fs.writeFileSync(p, typeof obj === 'string' ? obj : JSON.stringify(obj), 'utf8');
  return p;
}
function mergeQuick(run, obj, extraOpts) {
  const quickResultPath = writeQuick(run, obj);
  const countsPath = path.join(run.res.inbox_dir, 'counts.json');
  fs.writeFileSync(countsPath, JSON.stringify({ agent_runs: 0, stops: 1, cards: 1 }), 'utf8');
  return door.cmdMerge({ roomDir: run.room, runId: run.res.run_id, quickResultPath, countsPath }, run.env.opts(extraOpts));
}
const artifactOf = (run) => fs.readFileSync(path.join(run.res.review_dir, path.basename(run.res.review_dir) + '.md'), 'utf8');
const ONE_TENSION = { yellow: ['favours', 'no_position'], black: ['opposes', 'no_position'] };

checkAsync('Q9. NEGATIVE: a quick result with evidence, a self-search key, a blue position or another forbidden key is refused by name; nothing is written', async () => {
  const room = makeRoom();
  const env = mkEnv();
  const cases = [
    ['white', 'evidence', [{ source: 'x', tier: 't' }], 'forbidden_key:evidence'],
    ['black', 'self_found_sources', [], 'forbidden_key:self_found_sources'],
    ['yellow', 'self_search_strings', ['a string'], 'forbidden_key:self_search_strings'],
    ['red', 'none_found', true, 'forbidden_key:none_found'],
    ['white', 'missing_data', ['x'], 'forbidden_key:missing_data'],
    ['black', 'justification', 'x', 'forbidden_key:justification'],
    ['green', 'verdict', 'x', 'forbidden_key:verdict'],
    ['blue', 'positions', [], 'forbidden_key:positions'],
  ];
  for (const [hat, key, value, reason] of cases) {
    const run = startRun('quick', room, env);
    const obj = quickResultOf(run, ONE_TENSION);
    obj.hats[hat][key] = value;
    const bytes = fs.readFileSync(run.ledgerPath);
    const out = await mergeQuick(run, obj);
    assert.equal(out.ok, false, hat + ' ' + key);
    assert.equal(out.reason, reason, hat + ' ' + key);
    assert.deepEqual(fs.readFileSync(run.ledgerPath), bytes, 'ledger unchanged for ' + key);
    assert.equal(fs.existsSync(path.join(run.res.review_dir, path.basename(run.res.review_dir) + '.md')), false, 'no artifact for ' + key);
    assert.equal(fs.existsSync(door.runMapPath(env.homeDir, run.res.run_id)), true, 'run map kept for ' + key);
  }
});

checkAsync('Q10. two different quick results give different tension lists: one tension, then none with one same-position entry', async () => {
  const room = makeRoom();
  const env = mkEnv();
  const a = startRun('quick', room, env);
  const outA = await mergeQuick(a, quickResultOf(a, ONE_TENSION));
  assert.equal(outA.ok, true, JSON.stringify(outA));
  assert.equal(outA.tensions.length, 1);
  assert.deepEqual(outA.tensions[0].pair, ['black', 'yellow']);
  assert.equal(outA.tensions[0].state, 'open');
  assert.deepEqual(outA.same_position, []);
  const b = startRun('quick', room, env);
  const outB = await mergeQuick(b, quickResultOf(b, { yellow: ['favours', 'no_position'], black: ['favours', 'no_position'] }));
  assert.equal(outB.ok, true, JSON.stringify(outB));
  assert.deepEqual(outB.tensions, []);
  assert.equal(outB.same_position.length, 1);
  assert.deepEqual(outB.same_position[0].hats, ['black', 'yellow']);
  assert.equal(outB.same_position[0].value, 'favours');
});

checkAsync('Q11. the quick artifact starts with QUICK_NOTICE and the fixed quick label; the record has mode quick, the deep position fields and check skipped', async () => {
  const room = makeRoom();
  const env = mkEnv();
  const run = startRun('quick', room, env);
  const out = await mergeQuick(run, quickResultOf(run, ONE_TENSION));
  assert.equal(out.ok, true, JSON.stringify(out));
  const lines = artifactOf(run).split('\n');
  assert.equal(lines[0], ops.QUICK_NOTICE);
  assert.equal(lines[1], 'Quick mode: one context, no research. Checks that need evidence were not run.');
  assert.deepEqual(out.notice_lines.slice(0, 2), lines.slice(0, 2));
  assert.equal(Object.keys(out)[1], 'notice_lines');
  assert.equal(lines.some(l => l === ops.DEEP_NOTICE), false);
  const rec = run.ledger();
  assert.equal(rec.mode, 'quick');
  assert.equal(rec.steps.check.state, 'skipped');
  assert.equal(rec.steps.merge.state, 'done');
  assert.equal(typeof rec.timestamps.merged_at, 'string');
  for (const id of run.ids) {
    for (const hat of ['white', 'red', 'black', 'yellow', 'green']) {
      assert.deepEqual(Object.keys(rec.positions[id][hat] || { value: 0, line: 0 }).sort(), ['line', 'value']);
    }
  }
  assert.equal(rec.positions[run.ids[0]].black.value, 'opposes');
  assert.equal(rec.positions[run.ids[0]].black.line, 'quick black line 0');
  for (const hat of ['white', 'red', 'black', 'yellow', 'green', 'blue']) {
    assert.equal(rec.hats[hat].reading, 'ran', hat);
    assert.equal(rec.hats[hat].evidence_items || 0, 0);
    assert.ok(['fresh', 'fixed_discipline'].includes(rec.hats[hat].persona), hat);
  }
  for (const hat of ['red', 'blue']) assert.equal(rec.hats[hat].research, 'never_searches', hat);
  for (const hat of ['white', 'black', 'yellow', 'green']) assert.equal(rec.hats[hat].research, 'not_applicable', hat);
  assert.deepEqual(rec.audit, { edited_strings: [], cards: 1, stops: 1, agent_runs: 0, reported_by: 'command' });
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') for (const k of Object.keys(v)) { assert.equal(/score|rank|winner|average|consensus|confidence/i.test(k), false, k); walk(v[k]); }
  };
  walk(rec);
  assert.equal(JSON.stringify(rec).includes(env.tmpDir), false, 'no scratch path');
  assert.equal(fs.existsSync(door.runMapPath(env.homeDir, run.res.run_id)), false, 'run map deleted');
});

checkAsync('Q12. NEGATIVE: a quick result file on a deep run, and no quick result file on a quick run, are mode_mismatch', async () => {
  const room = makeRoom();
  const env = mkEnv();
  const deep = startRun('deep', room, env);
  const p = path.join(mkTmp('qr'), 'q.json');
  fs.writeFileSync(p, JSON.stringify({ schema: 'mos.persona-quick/1', run_id: deep.res.run_id, hats: {} }), 'utf8');
  const a = await door.cmdMerge({ roomDir: room, runId: deep.res.run_id, quickResultPath: p }, env.opts());
  assert.deepEqual(a, { ok: false, reason: 'mode_mismatch' });
  const quick = startRun('quick', room, env);
  const b = await door.cmdMerge({ roomDir: room, runId: quick.res.run_id }, env.opts());
  assert.deepEqual(b, { ok: false, reason: 'mode_mismatch' });
  assert.equal(quick.ledger().steps.merge, undefined);
  // A second merge of a finished quick run is refused like a deep one.
  const ok = await mergeQuick(quick, quickResultOf(quick, ONE_TENSION));
  assert.equal(ok.ok, true, JSON.stringify(ok));
  const again = await door.cmdMerge({ roomDir: room, runId: quick.res.run_id, quickResultPath: p }, env.opts());
  assert.equal(again.ok, false);
});

checkAsync('Q13. a quick run writes no hat session log, calls the persistence function 0 times and makes 0 seam calls and 0 requests', async () => {
  const room = makeRoom();
  const roomDbMod = require(path.join(ROOT, 'lib', 'core', 'room-db.cjs'));
  roomDbMod.closeRoomDb(roomDbMod.openRoomDb(room));
  const env = mkEnv();
  const run = startRun('quick', room, env);
  let seam = 0;
  let persist = 0;
  let requests = 0;
  const origPersist = ops.persistPersonaFindings;
  const savedFetch = globalThis.fetch;
  const savedHttp = [http.request, https.request];
  ops.persistPersonaFindings = function () { persist += 1; return origPersist.apply(this, arguments); };
  globalThis.fetch = function () { requests += 1; throw new Error('fetch blocked in test'); };
  http.request = function () { requests += 1; throw new Error('blocked'); };
  https.request = function () { requests += 1; throw new Error('blocked'); };
  let out;
  try {
    out = await mergeQuick(run, quickResultOf(run, ONE_TENSION), { _fetchCorpusEnvelope: async () => { seam += 1; throw new Error('no fetch in quick'); } });
  } finally {
    ops.persistPersonaFindings = origPersist;
    globalThis.fetch = savedFetch;
    http.request = savedHttp[0];
    https.request = savedHttp[1];
  }
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(persist, 0);
  assert.equal(seam, 0);
  assert.equal(requests, 0);
  assert.deepEqual(out.session_log, {});
  assert.equal(fs.existsSync(path.join(room, '.mindrian', 'hats')), false, 'no hat state folder');
  const navigation = require(path.join(ROOT, 'lib', 'core', 'navigation.cjs'));
  const db = navigation.openRoomDbForCaller(room);
  try {
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'HatState'").get().n, 0);
  } finally {
    navigation.closeRoomDbForCaller(db);
  }
});

checkAsync('Q14. record-ruling accepts a ruling for a tension of a merged quick run; the quick artifact keeps its first line', async () => {
  const room = makeRoom();
  const env = mkEnv();
  const run = startRun('quick', room, env);
  const out = await mergeQuick(run, quickResultOf(run, ONE_TENSION));
  assert.equal(out.ok, true, JSON.stringify(out));
  const ap = path.join(mkTmp('ruling'), 'ruling.json');
  fs.writeFileSync(ap, JSON.stringify({ schema: 'mos.persona-ruling-answer/1', run_id: run.res.run_id, rulings: [{ tension_id: out.tensions[0].id, ruling: 'side_a' }] }), 'utf8');
  const r = door.cmdRecordRuling({ roomDir: room, runId: run.res.run_id, answerPath: ap }, env.opts());
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.recorded.length, 1);
  assert.equal(r.recorded[0].side_hat, 'black');
  assert.deepEqual(r.artifact, { state: 'updated' });
  const lines = artifactOf(run).split('\n');
  assert.equal(lines[0], ops.QUICK_NOTICE);
  assert.ok(lines.includes('## Rulings'));
  assert.equal(run.ledger().tensions[0].state, 'settled');
  assert.equal(run.ledger().steps.record_ruling.state, 'done');
  // A record-ruling call before merge is still out of order for a quick run.
  const early = startRun('quick', room, env);
  const e = door.cmdRecordRuling({ roomDir: room, runId: early.res.run_id, answerPath: ap }, env.opts());
  assert.equal(e.ok, false);
  assert.equal(e.reason, 'step_out_of_order:merge');
});

checkAsync('Q15. NEGATIVE: a URL or an evidence claim id in a quick line is citation_outside_sources; quick has no source to cite', async () => {
  const room = makeRoom();
  const env = mkEnv();
  for (const text of ['see https://example.org/page for the numbers', 'per EvidenceClaim:persona-white-0123456789ab:xyz']) {
    const run = startRun('quick', room, env);
    const obj = quickResultOf(run, ONE_TENSION);
    obj.hats.black.positions[0].line = text;
    const out = await mergeQuick(run, obj);
    assert.equal(out.ok, false);
    assert.equal(out.reason, 'citation_outside_sources');
    assert.equal(run.ledger().steps.merge, undefined);
  }
});

checkAsync('Q16. NEGATIVE: a wrong run id, an unknown hat, an unknown key and a missing position are refused; a hat left out is listed as not run', async () => {
  const room = makeRoom();
  const env = mkEnv();
  const bad = [
    [(o) => { o.run_id = '20260101-000000-abcd'; }, 'schema_invalid:run_id'],
    [(o) => { o.hats.purple = { positions: [] }; }, 'schema_invalid:hat'],
    [(o) => { o.extra = 1; }, 'unknown_key:extra'],
    [(o) => { o.hats.white.positions.pop(); }, 'schema_invalid:positions'],
    [(o) => { o.hats.white.positions[0].value = 'alternative_offered'; }, 'schema_invalid:positions[0].value'],
    [(o) => { o.hats.white.note = 'x'; }, 'unknown_key:note'],
  ];
  for (const [mutate, reason] of bad) {
    const run = startRun('quick', room, env);
    const obj = quickResultOf(run, ONE_TENSION);
    mutate(obj);
    const out = await mergeQuick(run, obj);
    assert.equal(out.ok, false);
    assert.equal(out.reason, reason);
  }
  const run = startRun('quick', room, env);
  const obj = quickResultOf(run, ONE_TENSION);
  delete obj.hats.white;
  const out = await mergeQuick(run, obj);
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.deepEqual(out.not_run.map(x => x.hat), ['white']);
  assert.ok(artifactOf(run).split('\n').includes('Not run: white.'));
  assert.ok(artifactOf(run).split('\n').includes('white: not_run:not_in_quick_result'));
  assert.equal(door.validateQuickResult === undefined, false, 'validateQuickResult is exported');
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
  for (const r of tmpRoots) fs.rmSync(r, { recursive: true, force: true });
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed === 0 ? 0 : 1);
})();
