#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 366 plan 18 (D-05, EPV366-23): the spike harness. Dev-time only, never
 * required from lib/ or hooks/. The bar is pre-registered in
 * tests/fixtures/366-spike/bar.json (committed before this file existed): adopt
 * an arm only if its Wilson 95% lower bound exceeds 0.448 on each of 3 repeats.
 * The harness measures; it never adopts. The navigator rules at 366-20.
 *
 * WHAT THE 44.8% IS. The Phase 355 baseline (43 of 96) is the RS/HSI
 * engine-output rate: 47 HSI and 49 RS pairs from the embedding engines. Eureka
 * was substrate_unavailable on the bare fixtures. So every result here is read
 * against that rate, the RS slice and the HSI slice, and none of it is ever
 * phrased as Eureka improving from 44.8%.
 *
 * LAYOUT. Everything an arm produces lands inside the spike temp root W (the
 * directory that holds the manifest scripts/spike-366-prepare.cjs wrote):
 *   W/arms/<recall-arm>/recall.json        counts, tag, cost
 *   W/arms/<recall-arm>/items.json         the 355 items shape (blind-label input)
 *   W/arms/<recall-arm>/pairs.json         pair_id -> room, a, b (the join, never shown)
 *   W/arms/<recall-arm>/judge/<judge>-r<n>.json   what each judge repeat passed
 * `record` freezes those into tests/fixtures/366-spike/arms/ and writes
 * record.json from the frozen files plus the navigator's gold
 * (tests/fixtures/366-spike/gold/<recall-arm>.json, label-355-gold emit output).
 * `--check` recomputes record.json from the committed inputs only and exits 0
 * only on a byte-for-byte match (the measure-355 --check precedent).
 *
 * Usage (JSON on stdout, switch-case argv, no free text):
 *   node scripts/spike-366.cjs recall  --manifest <m> --arm <recall-arm> [--tag <t>]
 *   node scripts/spike-366.cjs items   --manifest <m> --arm <recall-arm>
 *   node scripts/spike-366.cjs judge   --manifest <m> --arm <judge-arm> --recall-arm <id> --repeat <1..3> [--verdicts <p>] [--replay]
 *   node scripts/spike-366.cjs record  --manifest <m> [--root <dir>]
 *   node scripts/spike-366.cjs --check [--root <dir>]
 * Exit codes: 0 ok, 1 failed, 2 refused (bad argv or a path outside its root),
 * 3 invalid input (a verdicts file that does not match the pairs), 77 ENV GAP
 * (no cached local model for the vector arm, no Jev key for the Jev arm).
 *
 * PATHS. Every path argument goes through guardSpikePath (scripts/spike-366-prepare.cjs):
 * realpath containment, no .. segment, never the 355 fixture tree. The Jev arm
 * only ever reads room copies inside W (Pitfall 13, T-366-75): it spawns
 * scripts/eureka-jev-judge.cjs over a derived run folder inside a contained copy,
 * and never reads, prints or forwards a key itself (the child resolves its own).
 * The Claude arm is a Claude Code subagent on the user's plan that writes a
 * verdicts file from tests/fixtures/366-spike/claude-judge-prompt.md; no
 * ANTHROPIC_API_KEY is read here (T-366-79).
 *
 * COST. Per arm: wall milliseconds, CPU milliseconds, peak RSS in KB, and tokens
 * and dollars only where a vendor reports them (null otherwise). Counts, no
 * prose (design section 9 Q5). The vector arm never downloads a model: with none
 * cached it exits 77.
 *
 * CJS, node built-ins plus repo modules. Hyphens only.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const FIXTURE_355 = path.join(REPO_ROOT, 'tests', 'fixtures', '355-rooms');
const SPIKE_FIXTURES = path.join(REPO_ROOT, 'tests', 'fixtures', '366-spike');
const FIXTURES_ROOT = path.join(REPO_ROOT, 'tests', 'fixtures');
const JEV_SCRIPT = path.join(REPO_ROOT, 'scripts', 'eureka-jev-judge.cjs');

// Wilson, the 355 excerpt builder, the 355 pair id and the 355 direction phrase are
// required, never re-derived (same number as the 355 record).
const m355 = require('./measure-355-hit-rate.cjs');
const wilson95 = m355.wilson95;
const buildExcerpt = m355.buildExcerpt;
const pairId = m355.pairId;
const directionPhraseFor = m355.directionPhraseFor;
const spikePrepare = require('./spike-366-prepare.cjs');
const guardSpikePath = spikePrepare.guardSpikePath;

const PERSP_DIR = path.join(REPO_ROOT, 'lib', 'core', 'research-planner', 'perspectives');
const perspectives = require(path.join(PERSP_DIR, 'index.cjs'));
const shared = require(path.join(PERSP_DIR, 'shared.cjs'));
const eurekaRecall = require(path.join(PERSP_DIR, 'eureka-recall.cjs'));
const eurekaJudge = require(path.join(PERSP_DIR, 'eureka-judge.cjs'));
const directionConvention = require(path.join(REPO_ROOT, 'lib', 'core', 'direction-convention.cjs'));

const SCHEMA = Object.freeze({
  substrate: 'mos.spike-366-substrate/1',
  recall: 'mos.spike-366-recall/1',
  items: 'mos.spike-366-items/1',
  pairs: 'mos.spike-366-pairs/1',
  judge: 'mos.spike-366-judge/1',
  record: 'mos.spike-366-record/1',
});

const RECALL_ARMS = Object.freeze(['eureka-graph-lexical', 'eureka-graph-lexical-vector', 'rs-graph', 'hsi-graph']);
const JUDGE_ARMS = Object.freeze(['stage-a', 'jev', 'claude', 'claude-then-jev']);
const PERSPECTIVE_OF = Object.freeze({
  'eureka-graph-lexical': 'eureka',
  'eureka-graph-lexical-vector': 'eureka',
  'rs-graph': 'rs',
  'hsi-graph': 'hsi',
});
// the slice of the Phase 355 baseline each graph arm is also read against
const SLICE_OF = Object.freeze({ 'rs-graph': 'rs', 'hsi-graph': 'hsi' });
const VERDICTS = Object.freeze(['useful', 'not_useful', 'already_known', 'none']);
const TAG_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

const STATEMENT = 'The 44.8% figure is the RS/HSI engine-output baseline (47 HSI, 49 RS pairs from the embedding engines). ' +
  'Eureka was substrate_unavailable on the bare fixtures, so no arm below is a change from 44.8%; each rate is read against the pool, the RS slice and the HSI slice.';
const NO_ADOPTION = 'This record never adopts an arm. The navigator rules at plan 366-20.';

// ---------------------------------------------------------------------------
// errors: each carries the exit code cliMain returns
// ---------------------------------------------------------------------------
class SpikeError extends Error {
  constructor(code, message) { super(message); this.exitCode = code; }
}
const refuse = function (msg) { return new SpikeError(2, 'refused -- ' + msg); };
const invalid = function (msg) { return new SpikeError(3, 'invalid -- ' + msg); };
const envGap = function (msg) { return new SpikeError(77, 'ENV GAP -- ' + msg); };
const failed = function (msg) { return new SpikeError(1, msg); };

// ---------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------
function sha256Of(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }
function sha256File(p) { return sha256Of(fs.readFileSync(p)); }
function r4(x) { return Math.round(x * 10000) / 10000; }
function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function isInside(child, parent) {
  const a = path.resolve(child); const b = path.resolve(parent);
  return a === b || a.indexOf(b + path.sep) === 0;
}

function guard(p, roots, what) {
  try {
    return guardSpikePath(p, roots);
  } catch (e) {
    throw refuse(what + ' ' + String(e && e.message || e).replace(/^guardSpikePath: refused -- /, ''));
  }
}

function writeJson(p, obj, work) {
  const real = guard(p, [work], 'output path');
  fs.mkdirSync(path.dirname(real), { recursive: true });
  const tmp = real + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n');
  fs.renameSync(tmp, real);
  return real;
}

function startCost() {
  return { t0: process.hrtime.bigint(), cpu: process.cpuUsage() };
}
// counts only: wall and CPU milliseconds, peak RSS in KB, tokens and dollars where a vendor reports them
function endCost(c, extra) {
  const wall = Number((process.hrtime.bigint() - c.t0) / 1000000n);
  const cpu = process.cpuUsage(c.cpu);
  const ex = extra || {};
  return {
    wall_ms: wall,
    cpu_user_ms: Math.round(cpu.user / 1000),
    cpu_system_ms: Math.round(cpu.system / 1000),
    max_rss_kb: process.resourceUsage().maxRSS,
    vendor_calls: typeof ex.calls === 'number' ? ex.calls : 0,
    input_tokens: typeof ex.input_tokens === 'number' ? ex.input_tokens : null,
    dollars: null,
  };
}

// ---------------------------------------------------------------------------
// bar, manifest
// ---------------------------------------------------------------------------
function loadBar(root) {
  const p = path.join(root || SPIKE_FIXTURES, 'bar.json');
  let bar;
  try { bar = readJson(p); } catch (_e) { throw failed('cannot read bar.json at ' + p); }
  if (!bar || bar.schema !== 'mos.spike-366-bar/1' || !bar.baseline || typeof bar.baseline.rate !== 'number') throw failed('bar.json is not mos.spike-366-bar/1');
  return { bar: bar, path: p, sha256: sha256File(p) };
}

function loadManifest(manifestPath) {
  if (typeof manifestPath !== 'string' || !manifestPath) throw refuse('--manifest is required');
  const real = guard(manifestPath, [os.tmpdir()], '--manifest');
  let m;
  try { m = readJson(real); } catch (_e) { throw refuse('--manifest is not readable JSON'); }
  if (!m || m.schema !== SCHEMA.substrate || !Array.isArray(m.rooms)) throw refuse('--manifest is not a ' + SCHEMA.substrate + ' file');
  const work = path.dirname(real);
  if (isInside(work, FIXTURE_355) || isInside(work, FIXTURES_ROOT) || isInside(work, REPO_ROOT)) throw refuse('the spike root may not sit inside the repository or the 355 fixture tree');
  const rooms = m.rooms.map(function (r) {
    if (!r || typeof r.name !== 'string' || !NAME_RE.test(r.name)) throw refuse('a manifest room has no safe name');
    const dir = guard(String(r.room_dir || ''), [work], 'room ' + r.name);
    if (dir === work) throw refuse('room ' + r.name + ' resolves to the spike root itself');
    if (isInside(dir, FIXTURE_355)) throw refuse('room ' + r.name + ' is inside the 355 fixture tree');
    return { name: r.name, dir: dir };
  });
  if (!rooms.length) throw refuse('the manifest names no rooms');
  return { path: real, work: work, rooms: rooms, manifest: m };
}

function armDir(mf, arm) { return path.join(mf.work, 'arms', arm); }

function checkArm(arm, list, what) {
  if (typeof arm !== 'string' || list.indexOf(arm) === -1) throw refuse(what + ' must be one of ' + list.join(', '));
  return arm;
}

// ---------------------------------------------------------------------------
// artifacts for items: the markdown the 355 engines read (same id, path, title,
// text), else the room.db node text (a room whose things are not markdown files)
// ---------------------------------------------------------------------------
function loadArtifacts(roomDir) {
  const map = new Map();
  const rsEngine = require(path.join(REPO_ROOT, 'lib', 'core', 'rs-engine.cjs'));
  rsEngine.discoverArtifacts(roomDir).forEach(function (a) {
    map.set(a.id, { path: String(a.path).split(path.sep).join('/'), title: a.title, text: a.text, source: 'file' });
  });
  return map;
}

function artifactFromDb(db, id) {
  const row = db.prepare('SELECT id, properties FROM nodes WHERE id = ?').get(id);
  if (!row) return null;
  const p = shared.parseProps(row.properties);
  const text = shared.textOfProps(p, 4000);
  if (!text) return null;
  return { path: String(id) + '.md', title: shared.titleOfProps(p, id), text: text, source: 'db' };
}

function phraseFor(row) {
  const d = row && typeof row.direction === 'string' ? row.direction : null;
  if (d && Object.prototype.hasOwnProperty.call(directionConvention.GRAPH_PHRASES || {}, d)) return directionConvention.GRAPH_PHRASES[d];
  return directionPhraseFor(d);
}

// ---------------------------------------------------------------------------
// the vector lane (spike arm eureka-graph-lexical-vector)
// ---------------------------------------------------------------------------
async function buildVectorLane(roomDir, opts) {
  const o = opts || {};
  const spine = require(path.join(REPO_ROOT, 'lib', 'core', 'semantic-index', 'embedding-spine.cjs'));
  const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
  const topK = Number.isInteger(o.top_k) && o.top_k > 0 ? o.top_k : 5;
  if (typeof o.encodeFn !== 'function') {
    // never download: with no cached model the arm is an ENV GAP, not a fetch
    let cached = false;
    try { cached = await spine._test.isModelCached(spine._test.resolveModel(), spine._test.resolveCacheDir(), spine._test.resolveDtype()); } catch (_e) { cached = false; }
    if (!cached) throw envGap('no cached local embedding model; the vector arm never downloads one');
  }
  const db = navigation.openRoomDbReadOnlyForCaller(roomDir);
  let substrate;
  try { substrate = eurekaRecall.buildSubstrate(db, { roomDir: roomDir }); } finally { try { db.close(); } catch (_e) { /* read-only */ } }
  const things = substrate.things;
  const emb = await spine.embedTexts(things.map(function (t) { return t.text; }), { encodeFn: o.encodeFn });
  if (!emb || !emb.success || !Array.isArray(emb.vectors)) throw envGap('local encoder unavailable (' + String(emb && emb.error || 'no result') + ')');
  const proposals = [];
  things.forEach(function (t, i) {
    const scored = [];
    things.forEach(function (u, j) {
      if (i === j || u.section === t.section) return;
      scored.push([spine.cosineSimilarity(emb.vectors[i], emb.vectors[j]), u.id]);
    });
    scored.sort(function (x, y) { return y[0] - x[0] || (x[1] < y[1] ? -1 : 1); });
    scored.slice(0, topK).forEach(function (s) { proposals.push({ a: t.id, b: s[1], lane: 'vector', score: r4(s[0]) }); });
  });
  // a sync lane over precomputed proposals: recallCandidates is synchronous
  return function vectorLane() { return proposals; };
}

// ---------------------------------------------------------------------------
// recall
// ---------------------------------------------------------------------------
async function recallArm(manifestPath, arm, opts) {
  const o = opts || {};
  const mf = loadManifest(manifestPath);
  checkArm(arm, RECALL_ARMS, '--arm');
  const barInfo = loadBar();
  const mod = perspectives.getPerspective(PERSPECTIVE_OF[arm]);
  if (!mod) throw failed('perspective ' + PERSPECTIVE_OF[arm] + ' is not available');
  const tag = o.tag || ('spike-' + arm);
  if (!TAG_RE.test(tag)) throw refuse('--tag is not a plain tag');
  const cost = startCost();
  const rooms = {};
  let shown = 0;
  for (const room of mf.rooms) {
    const runOpts = { tag: tag, budgets: { max_candidates: barInfo.bar.per_room_cap } };
    if (arm === 'eureka-graph-lexical-vector') {
      runOpts.extraLanes = [await buildVectorLane(room.dir, { encodeFn: o.encodeFn, top_k: barInfo.bar.vector_lane && barInfo.bar.vector_lane.top_k })];
    }
    const res = mod.runRecall(room.dir, runOpts);
    if (!res || res.ok === false) throw failed('recall failed in ' + room.name + ' (' + String(res && res.reason || 'no result') + ')');
    rooms[room.name] = { shown: res.candidates.length, pairs_truncated: res.pairs_truncated, counts: res.counts };
    shown += res.candidates.length;
  }
  const doc = { schema: SCHEMA.recall, arm: arm, perspective: PERSPECTIVE_OF[arm], tag: tag, per_room_cap: barInfo.bar.per_room_cap, rooms: rooms, shown: shown, cost: endCost(cost) };
  writeJson(path.join(armDir(mf, arm), 'recall.json'), doc, mf.work);
  return { ok: true, arm: arm, tag: tag, shown: shown, rooms: Object.keys(rooms).length };
}

function readRecallDoc(mf, arm) {
  let doc;
  try { doc = readJson(path.join(armDir(mf, arm), 'recall.json')); } catch (_e) { throw failed('recall has not run for arm ' + arm); }
  if (!doc || doc.schema !== SCHEMA.recall || !TAG_RE.test(String(doc.tag))) throw failed('recall.json for ' + arm + ' is malformed');
  return doc;
}

// ---------------------------------------------------------------------------
// items: candidates -> the Phase 355 items shape (label-355-gold pairings-unstamped)
// ---------------------------------------------------------------------------
function itemsFor(manifestPath, arm) {
  const mf = loadManifest(manifestPath);
  checkArm(arm, RECALL_ARMS, '--arm');
  const doc = readRecallDoc(mf, arm);
  const mod = perspectives.getPerspective(PERSPECTIVE_OF[arm]);
  if (!mod) throw failed('perspective ' + PERSPECTIVE_OF[arm] + ' is not available');
  const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
  const items = [];
  const pairs = [];
  let unmapped = 0;
  for (const room of mf.rooms) {
    const read = mod.readCandidates(room.dir, doc.tag);
    if (!read) throw failed('no candidates for room ' + room.name + ' under tag ' + doc.tag);
    const artifacts = loadArtifacts(room.dir);
    const db = navigation.openRoomDbReadOnlyForCaller(room.dir);
    try {
      const find = function (id) { return artifacts.get(id) || artifactFromDb(db, id); };
      read.candidates.forEach(function (c) {
        const A = find(c.a); const B = find(c.b);
        if (!A || !B) { unmapped += 1; return; }
        const id = pairId(room.name, A.path, B.path);
        if (pairs.some(function (p) { return p.pair_id === id; })) return;
        items.push({ pair_id: id, room: room.name, producer: arm, a_excerpt: buildExcerpt(A), b_excerpt: buildExcerpt(B), direction_phrase: phraseFor(c), a_path: A.path, b_path: B.path });
        pairs.push({ pair_id: id, room: room.name, a: c.a, b: c.b });
      });
    } finally { try { db.close(); } catch (_e) { /* read-only */ } }
  }
  const dir = armDir(mf, arm);
  writeJson(path.join(dir, 'items.json'), { schema: SCHEMA.items, arm: arm, items: items }, mf.work);
  writeJson(path.join(dir, 'pairs.json'), { schema: SCHEMA.pairs, arm: arm, pairs: pairs }, mf.work);
  return { ok: true, arm: arm, items: items.length, unmapped: unmapped, items_file: path.join(dir, 'items.json') };
}

function readPairs(mf, arm) {
  let doc;
  try { doc = readJson(path.join(armDir(mf, arm), 'pairs.json')); } catch (_e) { throw failed('items have not been built for arm ' + arm); }
  if (!doc || doc.schema !== SCHEMA.pairs || !Array.isArray(doc.pairs)) throw failed('pairs.json for ' + arm + ' is malformed');
  return doc.pairs;
}

// ---------------------------------------------------------------------------
// judge arms
// ---------------------------------------------------------------------------
// The Claude arm's verdicts file: JSONL, one row per pair, inside the spike root.
function importClaudeVerdicts(verdictsPath, pairs, work) {
  if (typeof verdictsPath !== 'string' || !verdictsPath) throw refuse('--verdicts is required for the claude arms');
  const real = guard(verdictsPath, [work], '--verdicts');
  let raw;
  try { raw = fs.readFileSync(real, 'utf8'); } catch (_e) { throw invalid('verdicts file is not readable'); }
  const known = new Set(pairs.map(function (p) { return p.pair_id; }));
  const out = new Map();
  raw.split('\n').filter(function (l) { return l.trim() !== ''; }).forEach(function (line, i) {
    let row;
    try { row = JSON.parse(line); } catch (_e) { throw invalid('verdicts line ' + (i + 1) + ' is not JSON'); }
    if (!row || typeof row.pair_id !== 'string' || !known.has(row.pair_id)) throw invalid('verdicts line ' + (i + 1) + ' names a pair that is not in the items');
    if (VERDICTS.indexOf(row.verdict) === -1) throw invalid('verdicts line ' + (i + 1) + ' has a verdict outside ' + VERDICTS.join('|'));
    if (out.has(row.pair_id)) throw invalid('verdicts line ' + (i + 1) + ' repeats a pair');
    out.set(row.pair_id, row.verdict);
  });
  const missing = pairs.filter(function (p) { return !out.has(p.pair_id); }).length;
  if (missing) throw invalid(missing + ' pair(s) have no verdict');
  return out;
}

// Jev over a derived run folder inside a contained room copy. Returns { choices: Map(a|b -> choice|null), usage }.
function runJevOver(mf, room, rows, tag, replay, perRoomCap) {
  const choices = new Map();
  const usage = { calls: 0, input_tokens: 0 };
  if (!rows.length) return { choices: choices, usage: usage };
  // T-366-75 / T-366-76: only a contained copy inside the spike root, never the source fixtures
  const dir = guard(room.dir, [mf.work], 'jev room');
  if (isInside(dir, FIXTURE_355)) throw refuse('the jev arm never reads the 355 fixture tree');
  const file = path.join(eurekaRecall.runDirFor(dir, tag), '02_recall', 'output', 'candidates.jsonl');
  guard(file, [mf.work], 'jev run folder');
  shared.writeJsonl(file, [{ header: true, derived: true, counts: { candidates: rows.length } }].concat(rows));
  const env = Object.assign({}, process.env);
  delete env.ANTHROPIC_API_KEY; delete env.OPENAI_API_KEY;
  const args = [JEV_SCRIPT, '--room', dir, '--tag', tag, '--max', String(perRoomCap)];
  if (replay) args.push('--check');
  const res = spawnSync(process.execPath, args, { cwd: REPO_ROOT, encoding: 'utf8', env: env, timeout: 15 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
  const lines = String(res.stdout || '').split('\n').filter(Boolean);
  let out = null;
  try { out = JSON.parse(lines[lines.length - 1]); } catch (_e) { out = null; }
  if (!out || out.ok !== true) {
    const reason = out && out.reason ? String(out.reason) : ('exit ' + res.status);
    if (reason === 'no_key') throw envGap('no Jev key available to the dev-time script');
    throw invalid('jev run failed in ' + room.name + ' (' + reason + ')');
  }
  if (out.usage && typeof out.usage.calls === 'number') { usage.calls += out.usage.calls; usage.input_tokens += (out.usage.input_tokens || 0); }
  const verdicts = eurekaJudge.readVerdicts(dir, tag) || [];
  verdicts.forEach(function (v) { choices.set(v.a + '\u0000' + v.b, v.choice === undefined ? null : v.choice); });
  return { choices: choices, usage: usage };
}

async function judgeArm(manifestPath, opts) {
  const o = opts || {};
  const mf = loadManifest(manifestPath);
  const arm = checkArm(o.arm, JUDGE_ARMS, '--arm');
  const recallArmId = checkArm(o.recallArm, RECALL_ARMS, '--recall-arm');
  const barInfo = loadBar();
  const repeat = Number(o.repeat);
  if (!Number.isInteger(repeat) || repeat < 1 || repeat > barInfo.bar.repeats) throw refuse('--repeat must be an integer from 1 to ' + barInfo.bar.repeats);
  const doc = readRecallDoc(mf, recallArmId);
  const mod = perspectives.getPerspective(PERSPECTIVE_OF[recallArmId]);
  if (!mod) throw failed('perspective ' + PERSPECTIVE_OF[recallArmId] + ' is not available');
  const pairs = readPairs(mf, recallArmId);
  const idOf = new Map(pairs.map(function (p) { return [p.room + '\u0000' + p.a + '\u0000' + p.b, p.pair_id]; }));
  const cost = startCost();
  const verdictOf = new Map(); // pair_id -> verdict string
  const passes = new Set();
  let jevUsage = { calls: 0, input_tokens: 0 };
  let candidates = 0;
  const claude = (arm === 'claude' || arm === 'claude-then-jev') ? importClaudeVerdicts(o.verdictsPath, pairs, mf.work) : null;

  for (const room of mf.rooms) {
    const read = mod.readCandidates(room.dir, doc.tag);
    if (!read) throw failed('no candidates for room ' + room.name + ' under tag ' + doc.tag);
    const rows = read.candidates.filter(function (c) { return idOf.has(room.name + '\u0000' + c.a + '\u0000' + c.b); });
    candidates += rows.length;
    const pid = function (c) { return idOf.get(room.name + '\u0000' + c.a + '\u0000' + c.b); };
    if (arm === 'stage-a') {
      const res = await eurekaJudge.judgeCandidates(rows, { module: mod });
      eurekaJudge.writeVerdicts(room.dir, 'spike-judge-stage-a-' + recallArmId + '-r' + repeat, res.rows, { module: mod });
      res.rows.forEach(function (r) {
        const id = idOf.get(room.name + '\u0000' + r.a + '\u0000' + r.b);
        if (!id) return;
        verdictOf.set(id, r.stage_a && r.stage_a.pass ? 'pass' : 'fail:' + (r.stage_a && r.stage_a.tag || 'unknown'));
        if (r.stage_a && r.stage_a.pass) passes.add(id);
      });
    } else if (arm === 'claude') {
      rows.forEach(function (c) { const v = claude.get(pid(c)); verdictOf.set(pid(c), v); if (v === 'useful') passes.add(pid(c)); });
    } else {
      // jev (every pair) or claude-then-jev (Jev sees only Claude's useful subset)
      let subset = rows;
      if (arm === 'claude-then-jev') {
        rows.forEach(function (c) { verdictOf.set(pid(c), 'claude:' + claude.get(pid(c))); });
        subset = rows.filter(function (c) { return claude.get(pid(c)) === 'useful'; });
      }
      const tagPrefix = arm === 'jev' ? 'spike-jev-' : 'spike-cj-';
      const run = runJevOver(mf, room, subset, tagPrefix + recallArmId + '-r' + repeat, o.replay === true, barInfo.bar.per_room_cap);
      jevUsage.calls += run.usage.calls; jevUsage.input_tokens += run.usage.input_tokens;
      subset.forEach(function (c) {
        const ch = run.choices.has(c.a + '\u0000' + c.b) ? run.choices.get(c.a + '\u0000' + c.b) : null;
        verdictOf.set(pid(c), ch === null ? 'jev:unjudged' : 'jev:' + ch);
        if (ch === 'useful') passes.add(pid(c));
      });
    }
  }
  const verdicts = pairs.filter(function (p) { return verdictOf.has(p.pair_id); }).map(function (p) { return { pair_id: p.pair_id, verdict: verdictOf.get(p.pair_id) }; });
  const out = {
    schema: SCHEMA.judge, recall_arm: recallArmId, judge_arm: arm, repeat: repeat, replayed: o.replay === true,
    candidates: candidates, passes: Array.from(passes).sort(), verdicts: verdicts,
    cost: endCost(cost, jevUsage.calls ? jevUsage : null),
  };
  writeJson(path.join(armDir(mf, recallArmId), 'judge', arm + '-r' + repeat + '.json'), out, mf.work);
  return { ok: true, recall_arm: recallArmId, judge_arm: arm, repeat: repeat, candidates: candidates, passed: out.passes.length };
}

// ---------------------------------------------------------------------------
// the record: computed from the frozen inputs under <root> only
// ---------------------------------------------------------------------------
function baselineFrom355() {
  const itemsPath = path.join(FIXTURE_355, 'pairings.items.json');
  const judgPath = path.join(FIXTURE_355, 'judgments.json');
  const items = readJson(itemsPath).items;
  const useful = new Map();
  readJson(judgPath).items.forEach(function (j) { useful.set(j.pair_id, j.useful === true); });
  const slices = {};
  let k = 0;
  items.forEach(function (it) {
    const s = slices[it.producer] || (slices[it.producer] = { shown: 0, useful: 0 });
    s.shown += 1;
    if (useful.get(it.pair_id)) { s.useful += 1; k += 1; }
  });
  const sliceOut = {};
  Object.keys(slices).sort().forEach(function (p) {
    const s = slices[p];
    sliceOut[p] = { shown: s.shown, useful: s.useful, rate: r4(s.useful / s.shown), wilson95: wilson95(s.useful, s.shown).map(r4) };
  });
  return { pool: { shown: items.length, useful: k }, slices: sliceOut, inputs: { pairings_items_sha256: sha256File(itemsPath), judgments_sha256: sha256File(judgPath) } };
}

function minUsefulToClear(n, threshold) {
  for (let k = 0; k <= n; k += 1) if (wilson95(k, n)[0] > threshold) return k;
  return null;
}

function rateBlock(k, n, threshold, baselineN) {
  const w = wilson95(k, n);
  return {
    shown: n, useful: k,
    rate: n > 0 ? r4(k / n) : null,
    wilson95: w.map(r4),
    clears_bar: n > 0 && w[0] > threshold,
    n_below_baseline_n: n < baselineN,
  };
}

// Direction agreement for an arm (366-20, D-08): the navigator's direction_ok,
// counted only over items that showed a direction phrase. An item showing the
// NONE_MEANING sentinel carries no direction claim, so its direction_ok is not
// a judgment and is never counted.
function directionAgreement(itemsRaw, gold) {
  const parsed = JSON.parse(itemsRaw);
  const items = Array.isArray(parsed) ? parsed : (parsed.items || []);
  const okOf = new Map();
  (gold.items || []).forEach(function (g) { if (typeof g.direction_ok === 'boolean') okOf.set(g.pair_id, g.direction_ok); });
  const byPhrase = {};
  let shown = 0;
  let ok = 0;
  items.forEach(function (it) {
    const phrase = it.direction_phrase;
    if (typeof phrase !== 'string' || !phrase || phrase === directionConvention.NONE_MEANING) return;
    shown += 1;
    const b = byPhrase[phrase] || (byPhrase[phrase] = { shown: 0, direction_ok: 0 });
    b.shown += 1;
    if (okOf.get(it.pair_id) === true) { ok += 1; b.direction_ok += 1; }
  });
  const sorted = {};
  Object.keys(byPhrase).sort().forEach(function (k) { sorted[k] = byPhrase[k]; });
  return { phrase_shown: shown, direction_ok: ok, phrase_absent: items.length - shown, by_phrase: sorted };
}

// Label consistency (366-20): a pair that appears in more than one arm's items
// file is labeled once per appearance, blind; count how often the useful
// labels agree. Counts only, pair ids listed for the disagreements.
function labelConsistency(usefulByArm) {
  const seen = new Map();
  Object.keys(usefulByArm).sort().forEach(function (arm) {
    usefulByArm[arm].forEach(function (u, id) { (seen.get(id) || seen.set(id, []).get(id)).push(u); });
  });
  let multi = 0;
  let agree = 0;
  const disagree = [];
  Array.from(seen.keys()).sort().forEach(function (id) {
    const v = seen.get(id);
    if (v.length < 2) return;
    multi += 1;
    if (v.every(function (x) { return x === v[0]; })) agree += 1; else disagree.push(id);
  });
  return { arms: Object.keys(usefulByArm).sort(), pairs_labeled_more_than_once: multi, useful_agree: agree, useful_disagree: disagree };
}

function computeRecord(root) {
  const rootDir = root || SPIKE_FIXTURES;
  const barInfo = loadBar(rootDir);
  const bar = barInfo.bar;
  const threshold = bar.baseline.rate;
  const base = baselineFrom355();
  if (base.pool.shown !== bar.baseline.shown || base.pool.useful !== bar.baseline.useful) throw failed('the 355 baseline files no longer match bar.json (' + base.pool.useful + ' of ' + base.pool.shown + ')');

  const recallOut = {};
  const judgeOut = {};
  const awaiting = [];
  const usefulByArm = {};
  RECALL_ARMS.forEach(function (arm) {
    const dir = path.join(rootDir, 'arms', arm);
    if (!fs.existsSync(path.join(dir, 'recall.json'))) return;
    const recall = readJson(path.join(dir, 'recall.json'));
    const itemsRaw = fs.readFileSync(path.join(dir, 'items.json'));
    const pairs = readJson(path.join(dir, 'pairs.json')).pairs;
    const goldPath = path.join(rootDir, 'gold', arm + '.json');
    if (!fs.existsSync(goldPath)) { awaiting.push(arm); return; }
    const gold = readJson(goldPath);
    if (gold.fixture_sha256 !== sha256Of(itemsRaw)) throw failed('gold for ' + arm + ' was labeled against a different items file (fixture_sha256 mismatch)');
    const usefulOf = new Map();
    (gold.items || []).forEach(function (g) { if (typeof g.useful === 'boolean') usefulOf.set(g.pair_id, g.useful); });
    const unlabeled = pairs.filter(function (p) { return !usefulOf.has(p.pair_id); }).length;
    if (unlabeled) throw failed('gold for ' + arm + ' leaves ' + unlabeled + ' pair(s) unlabeled');
    const k = pairs.filter(function (p) { return usefulOf.get(p.pair_id); }).length;
    const block = rateBlock(k, pairs.length, threshold, bar.baseline.shown);
    const perRoom = {};
    pairs.forEach(function (p) {
      const r = perRoom[p.room] || (perRoom[p.room] = { shown: 0, useful: 0 });
      r.shown += 1; if (usefulOf.get(p.pair_id)) r.useful += 1;
    });
    const repeats = [];
    for (let i = 1; i <= bar.repeats; i += 1) repeats.push(Object.assign({ repeat: i }, rateBlock(k, pairs.length, threshold, bar.baseline.shown)));
    const entry = {
      perspective: recall.perspective, tag: recall.tag, per_room_cap: recall.per_room_cap,
      items_sha256: sha256Of(itemsRaw), gold_sha256: sha256File(goldPath),
      shown: block.shown, useful: block.useful, rate: block.rate, wilson95: block.wilson95,
      clears_bar: block.clears_bar, n_below_baseline_n: block.n_below_baseline_n,
      needs_useful_to_clear_at_this_n: minUsefulToClear(pairs.length, threshold),
      repeats: repeats, clears_bar_all_repeats: repeats.every(function (r) { return r.clears_bar; }),
      per_room: perRoom, recall_counts: recall.rooms, cost: recall.cost,
    };
    entry.direction = directionAgreement(itemsRaw, gold);
    usefulByArm[arm] = usefulOf;
    if (SLICE_OF[arm]) {
      const sl = base.slices[SLICE_OF[arm]];
      const lo = wilson95(k, pairs.length)[0];
      entry.vs_slice = {
        slice: SLICE_OF[arm], baseline_useful: sl.useful, baseline_shown: sl.shown, baseline_rate: sl.rate,
        arm_rate: block.rate, arm_wilson95: block.wilson95,
        lower_bound_above_slice_rate: pairs.length > 0 && lo > sl.rate,
        lower_bound_above_pool_rate: block.clears_bar,
      };
    }
    recallOut[arm] = entry;

    // judge arms over this arm's candidates
    const jdir = path.join(dir, 'judge');
    const files = fs.existsSync(jdir) ? fs.readdirSync(jdir).filter(function (f) { return /\.json$/.test(f); }).sort() : [];
    const byJudge = {};
    files.forEach(function (f) {
      const j = readJson(path.join(jdir, f));
      if (JUDGE_ARMS.indexOf(j.judge_arm) === -1) return;
      const passed = j.passes.filter(function (id) { return usefulOf.has(id); });
      if (passed.length !== j.passes.length) throw failed(f + ' passes a pair that the gold does not know');
      const kk = passed.filter(function (id) { return usefulOf.get(id); }).length;
      (byJudge[j.judge_arm] || (byJudge[j.judge_arm] = [])).push(Object.assign({ repeat: j.repeat, candidates: j.candidates, passed: passed.length, replayed: j.replayed === true, cost: j.cost }, rateBlock(kk, passed.length, threshold, bar.baseline.shown)));
    });
    const judges = {};
    JUDGE_ARMS.forEach(function (ja) {
      if (!byJudge[ja]) return;
      const reps = byJudge[ja].sort(function (x, y) { return x.repeat - y.repeat; });
      judges[ja] = {
        repeats_recorded: reps.length, repeats_required: bar.repeats,
        repeats: reps,
        clears_bar_all_repeats: reps.length === bar.repeats && reps.every(function (r) { return r.clears_bar; }),
      };
    });
    if (Object.keys(judges).length) judgeOut[arm] = judges;
  });

  return {
    schema: SCHEMA.record,
    statement: STATEMENT,
    adoption: { decision: null, note: NO_ADOPTION },
    bar: { rule: bar.rule, threshold: threshold, repeats: bar.repeats, per_room_cap: bar.per_room_cap, sha256: barInfo.sha256 },
    baseline: {
      note: bar.baseline.note, source: bar.baseline.source,
      pool: { shown: base.pool.shown, useful: base.pool.useful, rate: r4(base.pool.useful / base.pool.shown), wilson95: wilson95(base.pool.useful, base.pool.shown).map(r4) },
      slices: base.slices, inputs: base.inputs,
    },
    recall_arms: recallOut,
    judge_arms: judgeOut,
    label_consistency: labelConsistency(usefulByArm),
    awaiting_gold: awaiting,
  };
}

function serializeRecord(rec) { return JSON.stringify(rec, null, 2) + '\n'; }

function rootAllowed(root) {
  return guard(root, [SPIKE_FIXTURES, os.tmpdir()], '--root');
}

// record: freeze the arm outputs from the spike temp root into <root>, then write record.json
function recordSpike(manifestPath, opts) {
  const o = opts || {};
  const root = rootAllowed(o.root || SPIKE_FIXTURES);
  const mf = loadManifest(manifestPath);
  const frozen = [];
  RECALL_ARMS.forEach(function (arm) {
    const src = armDir(mf, arm);
    if (!fs.existsSync(path.join(src, 'recall.json'))) return;
    ['recall.json', 'items.json', 'pairs.json'].forEach(function (f) {
      if (!fs.existsSync(path.join(src, f))) throw failed('arm ' + arm + ' is missing ' + f + '; run items first');
    });
    const dst = path.join(root, 'arms', arm);
    fs.mkdirSync(path.join(dst, 'judge'), { recursive: true });
    ['recall.json', 'items.json', 'pairs.json'].forEach(function (f) { fs.copyFileSync(path.join(src, f), path.join(dst, f)); frozen.push(arm + '/' + f); });
    const jsrc = path.join(src, 'judge');
    if (fs.existsSync(jsrc)) {
      fs.readdirSync(jsrc).filter(function (f) { return /\.json$/.test(f); }).forEach(function (f) { fs.copyFileSync(path.join(jsrc, f), path.join(dst, 'judge', f)); frozen.push(arm + '/judge/' + f); });
    }
  });
  // the substrate, trimmed to what a reader needs (no temp paths)
  const sub = {
    schema: 'mos.spike-366-substrate-frozen/1', source: mf.manifest.source,
    rooms: (mf.manifest.rooms || []).map(function (r) {
      return { name: r.name, fixture_sha256: r.fixture_sha256, node_count: r.node_count, edge_counts: r.edge_counts, describes_edges: r.describes_edges, entity_extract: r.entity_extract && { tiers_ran: r.entity_extract.tiers_ran, blocked_network_attempts: r.entity_extract.blocked_network_attempts, tier2_escalated: r.entity_extract.tier2_escalated, local_model: r.entity_extract.local_model } };
    }),
  };
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'substrate.json'), JSON.stringify(sub, null, 2) + '\n');
  const rec = computeRecord(root);
  fs.writeFileSync(path.join(root, 'record.json'), serializeRecord(rec));
  return { ok: true, record: path.join(root, 'record.json'), frozen: frozen.length, arms: Object.keys(rec.recall_arms), awaiting_gold: rec.awaiting_gold };
}

function checkRecord(opts) {
  const root = rootAllowed((opts && opts.root) || SPIKE_FIXTURES);
  const file = path.join(root, 'record.json');
  let have;
  try { have = fs.readFileSync(file, 'utf8'); } catch (_e) { throw failed('record.json is missing at ' + file); }
  const want = serializeRecord(computeRecord(root));
  if (have !== want) {
    let i = 0;
    while (i < have.length && i < want.length && have[i] === want[i]) i += 1;
    throw failed('record.json differs from the recomputed record at byte ' + i);
  }
  return { ok: true, check: 'record.json matches the recomputed record byte for byte', bytes: have.length };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const USAGE = [
  'usage:',
  '  node scripts/spike-366.cjs recall  --manifest <m> --arm <' + RECALL_ARMS.join('|') + '> [--tag <t>]',
  '  node scripts/spike-366.cjs items   --manifest <m> --arm <recall-arm>',
  '  node scripts/spike-366.cjs judge   --manifest <m> --arm <' + JUDGE_ARMS.join('|') + '> --recall-arm <recall-arm> --repeat <1..3> [--verdicts <p>] [--replay]',
  '  node scripts/spike-366.cjs record  --manifest <m> [--root <dir>]',
  '  node scripts/spike-366.cjs --check [--root <dir>]',
].join('\n');

function parseArgv(argv) {
  const out = { sub: null, flags: {}, check: false, replay: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    switch (a) {
      case 'recall': case 'items': case 'judge': case 'record':
        if (out.sub) throw refuse('subcommand given twice');
        out.sub = a; break;
      case '--check': out.check = true; break;
      case '--replay': out.replay = true; break;
      case '--manifest': case '--arm': case '--recall-arm': case '--repeat': case '--verdicts': case '--tag': case '--root': {
        if (Object.prototype.hasOwnProperty.call(out.flags, a)) throw refuse(a + ' given twice');
        const v = argv[i + 1];
        if (typeof v !== 'string' || !v || v.indexOf('--') === 0) throw refuse(a + ' needs a value');
        out.flags[a] = v; i += 1; break;
      }
      default:
        throw refuse('unexpected argument (no free text on argv)');
    }
  }
  return out;
}

async function cliMain(argv) {
  try {
    const a = parseArgv(Array.isArray(argv) ? argv : []);
    let res;
    if (a.check) {
      if (a.sub) throw refuse('--check takes no subcommand');
      res = checkRecord({ root: a.flags['--root'] });
    } else {
      switch (a.sub) {
        case 'recall': res = await recallArm(a.flags['--manifest'], a.flags['--arm'], { tag: a.flags['--tag'] }); break;
        case 'items': res = itemsFor(a.flags['--manifest'], a.flags['--arm']); break;
        case 'judge': res = await judgeArm(a.flags['--manifest'], { arm: a.flags['--arm'], recallArm: a.flags['--recall-arm'], repeat: a.flags['--repeat'], verdictsPath: a.flags['--verdicts'], replay: a.replay }); break;
        case 'record': res = recordSpike(a.flags['--manifest'], { root: a.flags['--root'] }); break;
        default: throw refuse('missing subcommand');
      }
    }
    process.stdout.write(JSON.stringify(res) + '\n');
    return 0;
  } catch (e) {
    const code = e && typeof e.exitCode === 'number' ? e.exitCode : 1;
    process.stderr.write('spike-366: ' + String(e && e.message || e).split('\n')[0] + '\n');
    if (code === 2) process.stderr.write(USAGE + '\n');
    return code;
  }
}

if (require.main === module) {
  cliMain(process.argv.slice(2)).then(function (code) { process.exitCode = code; }, function (e) {
    process.stderr.write('spike-366: ' + String(e && e.message || e).split('\n')[0] + '\n');
    process.exitCode = 1;
  });
}

module.exports = {
  SCHEMA, RECALL_ARMS, JUDGE_ARMS, VERDICTS, SPIKE_FIXTURES,
  loadBar, loadManifest, buildVectorLane, recallArm, itemsFor, judgeArm,
  computeRecord, serializeRecord, recordSpike, checkRecord, baselineFrom355, minUsefulToClear,
  directionAgreement, labelConsistency,
  cliMain,
};
