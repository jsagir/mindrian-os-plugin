#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick 261005-muy -- the real-room release rule (navigator ruling 2026-10-05:
 * "No cut without a real-room run read by a human").
 *
 * WHAT: births a small committed fixture room (tests/fixtures/release-room) through
 * the room-birth chokepoint into an isolated rooms home, then walks the four research
 * jobs the plugin sells through the research planner CLI: a quick run, a deep run,
 * Eureka and analogies. Since 369.2-32 it also reads the four other canvas perspectives
 * (Bottlenecks, HSI, Connections, Whitespace) and the room's readiness counts, and it
 * takes --seed more than once: every seed becomes its own room in one invocation and
 * ONE receipt. It prints ONE report a person can read in two minutes (what each job
 * tried, what came back, what it could not do) and, only when the person passes
 * --read-by "<name>", writes the receipt that release.sh Step 2.6 looks for.
 *
 * WHY: Phase 369 regressed silently because no cut was read by a human on a real room.
 * A green suite proves the code paths exist; this proves a person looked at what the
 * product does on a room and signed the result with a name.
 *
 * USAGE (argv switch-case router, no dependencies):
 *   node scripts/real-room-run.cjs [--read-by "<name>"] [--offline] [--json]
 *        [--rooms-home <dir>] [--seed <dir>]... [--receipt-dir <dir>]
 *   node scripts/real-room-run.cjs --desktop-verified mac|win [--receipt-dir <dir>]
 *   node scripts/real-room-run.cjs --negative-only [--json]
 *
 *   --read-by         the person who read the report. Writes the receipt for the HEAD sha.
 *                     Without it the web lines are NOT approved (dry) and no receipt is written.
 *   --offline         every egress line off: the quick and deep web lines are planned and shown,
 *                     never sent; Eureka and analogies (local, offline by design) still run. A
 *                     receipt made with --offline is recorded as offline and release.sh refuses it.
 *   --desktop-verified mac|win
 *                     records, on the existing receipt for HEAD, that the person ran the cut's
 *                     Desktop copy on that machine. Refuses no_receipt_for_head when absent.
 *   --negative-only   runs only the negative leg (369.25-23): quick, deep, Eureka and analogies must each REFUSE the
 *                     never-ready fixture with room.db missing and with room.db corrupted (room_not_ready, naming the
 *                     failed requirement). Exit 0 only when all eight refused. Writes no receipt.
 *   --json            prints the full result object (run ids included) instead of the report.
 *   --rooms-home      where the throwaway room is born (default <receipt-dir>/rooms).
 *   --seed            a seed room directory (ROOM.md, sections/, seed.json, optional question sets). Repeat the
 *                     flag to run several rooms in one invocation. The default seed keeps the slug
 *                     release-fixture-<sha8>; any other seed gets release-fixture-<sha8>-<seed dir name>, so two
 *                     rooms never overwrite each other. A seed with no question-set files skips quick and deep
 *                     (status "no question set") and still runs every perspective.
 *   --receipt-dir     default $MINDRIAN_REAL_ROOM_RECEIPT_DIR, else $HOME/.mindrian/release-real-room.
 *
 * Receipt <receipt-dir>/<full sha>.json:
 *   { schema, sha, version, room, reader, read_at, offline,
 *     perspectives: { quick|deep|eureka|analogies|bottlenecks|hsi|connections|whitespace: { status, counts: {numbers} } },
 *       (the FIRST seed's room; the release gate reads these top-level blocks)
 *     rooms: [{ seed, slug, perspectives }],   (one entry per seed, the first one repeats the top-level blocks)
 *     feyminto: { nests: [{ nest, asked, not_asked_reason, frameworks_named: <count>, commands_runnable_here: <count> }] },
 *     negative_leg: { fixture, rooms: [{ injection, jobs: { <job>: { refused, not_ready_reason } } }], all_refused },
 *     providers: { tavily, openalex }, desktop_verified: { mac, win } }
 *
 * Canon Part 8: the room is the fixture's invented text; what can leave it is the planner's
 * own grant-gated, audited search lines, shown in the report before approval. This script
 * adds no network reach of its own beyond one OpenAlex reachability probe (skipped offline).
 * The rooms home is never ~/MindrianRooms. The deep run's evidence rows are written by this
 * harness from the fetched record titles (a mechanical stand-in for the analyst lane): the
 * run checks the machinery, not research quality, and the report says so.
 *
 * Exit codes: 0 ok, 1 internal error, 2 refused (typed reason on stderr and in --json).
 * Hyphens only, no em-dash or en-dash anywhere.
 */

process.removeAllListeners('warning');

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PLANNER_CLI = path.join(ROOT, 'scripts', 'research-planner.cjs');
const DEFAULT_SEED = path.join(ROOT, 'tests', 'fixtures', 'release-room');
const SCHEMA = 'mos.real-room-receipt/1';
const MAX_DEEP_STEPS = 80;
const negativeLeg = require(path.join(ROOT, 'scripts', 'release-lib', 'real-room-negative-leg.cjs'));
const roomRead = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'room-read.cjs'));
const jobLines = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'job-lines.cjs'));

// -- small helpers -------------------------------------------------------------
function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function list(v) { return Array.isArray(v) ? v : []; }
function num(v) { return typeof v === 'number' && Number.isFinite(v) ? v : 0; }
function noDash(s) { return String(s).replace(/[\u2014\u2013]/g, '-'); }
function nowIso() { return new Date().toISOString(); }
function progress(msg) { process.stderr.write('[real-room-run] ' + msg + '\n'); }
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_e) { return fallback; }
}
function writeJsonAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp.' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
}
function refuse(reason, detail) {
  const e = new Error(reason);
  e.refusal = reason;
  e.detail = detail || null;
  return e;
}

// -- argv ----------------------------------------------------------------------
const VALUE_FLAGS = ['--rooms-home', '--seed', '--receipt-dir', '--read-by', '--desktop-verified'];
const BOOL_FLAGS = ['--offline', '--json', '--help', '--negative-only'];

function parseArgs(argv) {
  const opts = { offline: false, json: false, help: false, seeds: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const tok = argv[i];
    if (BOOL_FLAGS.indexOf(tok) !== -1) {
      if (tok === '--offline') opts.offline = true;
      else if (tok === '--json') opts.json = true;
      else if (tok === '--negative-only') opts.negativeOnly = true;
      else opts.help = true;
      continue;
    }
    if (VALUE_FLAGS.indexOf(tok) !== -1) {
      i += 1;
      const v = argv[i];
      if (typeof v !== 'string' || v.length === 0 || v.indexOf('--') === 0) throw refuse('missing_value', tok);
      if (tok === '--rooms-home') opts.roomsHome = v;
      else if (tok === '--seed') { opts.seeds.push(v); if (opts.seed === undefined) opts.seed = v; }
      else if (tok === '--receipt-dir') opts.receiptDir = v;
      else if (tok === '--read-by') opts.readBy = v.trim();
      else opts.desktopVerified = v;
      continue;
    }
    throw refuse('unknown_flag', tok);
  }
  if (opts.readBy !== undefined && opts.readBy.length === 0) throw refuse('missing_value', '--read-by');
  if (opts.desktopVerified !== undefined && opts.desktopVerified !== 'mac' && opts.desktopVerified !== 'win') {
    throw refuse('bad_desktop_leg', '--desktop-verified takes mac or win');
  }
  return opts;
}

// -- repo facts ----------------------------------------------------------------
function headSha() {
  const r = cp.spawnSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  const sha = String(r.stdout || '').trim();
  if (r.status !== 0 || !/^[0-9a-f]{40}$/.test(sha)) throw refuse('head_sha_unreadable');
  return sha;
}
function repoVersion() {
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'lib', 'core', 'repo-version.cjs')], { encoding: 'utf8' });
  const v = String(r.stdout || '').trim();
  if (r.status !== 0 || !v) throw refuse('version_unreadable');
  return v;
}

// -- providers -------------------------------------------------------------------
function tavilyPresent() {
  if (process.env.TAVILY_API_KEY && process.env.TAVILY_API_KEY.trim()) return true;
  let text = '';
  try { text = fs.readFileSync(path.join(os.homedir(), '.mindrian.env'), 'utf8'); } catch (_e) { return false; }
  return /^\s*(export\s+)?TAVILY_API_KEY\s*=\s*['"]?[^'"\s]+/m.test(text);
}
async function openalexReachable(offline) {
  if (offline) return 'not checked (offline)';
  try {
    const ctl = new AbortController();
    const timer = setTimeout(function () { ctl.abort(); }, 6000);
    try {
      const res = await fetch('https://api.openalex.org/works?per-page=1&select=id', { method: 'HEAD', signal: ctl.signal });
      return res && typeof res.status === 'number' ? 'reachable' : 'unreachable';
    } finally { clearTimeout(timer); }
  } catch (_e) { return 'unreachable'; }
}

// -- the planner CLI door -----------------------------------------------------------
let SCRATCH = null;
let scratchN = 0;
function scratchFile(name, obj) {
  scratchN += 1;
  const file = path.join(SCRATCH, String(scratchN) + '-' + name);
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8');
  return file;
}
function planner(args) {
  const r = cp.spawnSync(process.execPath, [PLANNER_CLI].concat(args), { encoding: 'utf8', env: process.env, timeout: 180000, maxBuffer: 32 * 1024 * 1024 });
  let json = null;
  try { json = JSON.parse(String(r.stdout || '').trim()); } catch (_e) { json = null; }
  return { code: r.status, json: json, stderr: String(r.stderr || '').trim().slice(0, 300) };
}
function ok(res) { return !!res && res.code === 0 && isObj(res.json) && res.json.ok !== false; }
function why(res) {
  if (!res) return 'no result';
  const j = res.json;
  return noDash((j && (j.reason || (list(j.errors)[0])) ? String(j.reason || list(j.errors)[0]) : 'exit ' + res.code) + (res.stderr ? ' (' + res.stderr + ')' : ''));
}

// -- the room -------------------------------------------------------------------------
function seedVenture(seedDir) {
  const text = fs.readFileSync(path.join(seedDir, 'ROOM.md'), 'utf8');
  const q = /^governing_question:\s*"?([^"\n]+?)"?\s*$/m.exec(text);
  const n = /^venture_name:\s*"?([^"\n]+?)"?\s*$/m.exec(text);
  return { question: q ? q[1] : 'A fixture venture', name: n ? n[1] : 'Release fixture' };
}

function copyTree(src, dst, out) {
  fs.mkdirSync(dst, { recursive: true });
  fs.readdirSync(src, { withFileTypes: true }).forEach(function (ent) {
    const s = path.join(src, ent.name);
    const d = path.join(dst, ent.name);
    if (ent.isDirectory()) copyTree(s, d, out);
    else if (ent.isFile()) { fs.copyFileSync(s, d); out.push(d); }
  });
}

function removePreviousRoom(roomsHome, roomDir) {
  // Only ever inside the rooms home, and only a directory this script's birth marked.
  const rel = path.relative(roomsHome, roomDir);
  if (!rel || rel.indexOf('..') === 0 || path.isAbsolute(rel)) throw refuse('room_outside_rooms_home');
  if (!fs.existsSync(roomDir)) return;
  if (!fs.existsSync(path.join(roomDir, '.room-root'))) throw refuse('previous_room_not_ours', 'no .room-root sentinel');
  fs.rmSync(roomDir, { recursive: true, force: true });
}

// 369.2-32 (R25): the default seed keeps release-fixture-<sha8>; any other seed adds its directory name, so two
// rooms born in one invocation never share a slug (the second would delete the first).
function seedDirName(seedDir) {
  return path.basename(seedDir).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'seed';
}
function roomSlug(sha, seedDir) {
  const base = 'release-fixture-' + sha.slice(0, 8);
  return path.resolve(seedDir) === DEFAULT_SEED ? base : base + '-' + seedDirName(seedDir);
}
function seedLabel(seedDir) {
  const rel = path.relative(ROOT, seedDir);
  return rel && rel.indexOf('..') !== 0 && !path.isAbsolute(rel) ? rel.split(path.sep).join('/') : path.basename(seedDir);
}

async function buildRoom(opts, sha, seedDir, roomsHome) {
  process.env.MINDRIAN_ROOMS_HOME = roomsHome;
  fs.mkdirSync(roomsHome, { recursive: true });
  const slug = roomSlug(sha, seedDir);
  const roomDir = path.join(roomsHome, slug);
  removePreviousRoom(roomsHome, roomDir);

  const venture = seedVenture(seedDir);
  const birth = require(path.join(ROOT, 'lib', 'core', 'navigation', 'room-birth.cjs')).birthRoom({
    slug: slug,
    roomDir: roomDir,
    sessionId: 'real-room-run',
    ventureText: venture.question,
    jtbd: '',
    approvedBy: 'real-room-run',
    canonicalRole: 'founder',
    vname: venture.name,
    vstage: 'Pre-Opportunity',
  });
  if (!birth || birth.ok !== true) throw refuse('room_birth_failed', birth && (birth.reason || birth.detail));
  if (!fs.existsSync(path.join(roomDir, '.mindrian', 'room.db'))) throw refuse('room_birth_failed', 'room.db missing after birth');

  // the section artifacts, then the graph rows the seed names
  const copied = [];
  copyTree(path.join(seedDir, 'sections'), roomDir, copied);
  const graphOps = require(path.join(ROOT, 'lib', 'core', 'graph-ops.cjs'));
  let indexed = 0;
  for (const file of copied.filter(function (f) { return /\.md$/i.test(f); })) {
    const r = await graphOps.indexArtifact(roomDir, file);
    if (r && r.success) indexed += 1;
  }
  const seeded = seedGraph(roomDir, readJson(path.join(seedDir, 'seed.json'), {}));
  return { slug: slug, roomDir: roomDir, indexed: indexed, seeded: seeded, registered: roomListed(roomsHome, slug), venture: venture.name };
}

function roomListed(roomsHome, slug) {
  const reg = readJson(path.join(roomsHome, '.rooms', 'registry.json'), null);
  return !!(reg && isObj(reg.rooms) && isObj(reg.rooms[slug]));
}

// seedGraph: entities, DESCRIBES links, known pairs and typed claims, all through the
// navigation write door (never raw SQL). Counts come back so the report can say what landed.
function seedGraph(roomDir, seed) {
  const navigation = require(path.join(ROOT, 'lib', 'core', 'navigation.cjs'));
  const out = { entities: 0, describes: 0, known_pairs: 0, claims: 0, failures: [] };
  const db = navigation.openRoomDbForCaller(roomDir);
  if (!db) throw refuse('room_db_unavailable');
  try {
    const ids = {};
    list(seed.entities).forEach(function (e) {
      const r = navigation.writeEntityNode(db, { entityType: e.type, name: e.name, sessionId: 'real-room-run' });
      if (r && r.ok) { ids[e.key] = r.node_id; out.entities += 1; } else out.failures.push('entity:' + e.key);
    });
    list(seed.describes).forEach(function (pair) {
      const eid = ids[pair[1]];
      if (!eid) { out.failures.push('describes:' + pair[1]); return; }
      const r = navigation.linkEntityRelations(db, { entityId: eid, relations: [{ targetId: pair[0], edge: 'DESCRIBES' }] });
      if (r && r.written === 1) out.describes += 1; else out.failures.push('describes:' + pair[0]);
    });
    list(seed.known_pairs).forEach(function (kp) {
      const r = navigation.writeEdge(db, { source_id: kp[0], target_id: kp[1], edge_type: kp[2], properties: { relation: String(kp[2]).toLowerCase() } });
      if (r && r.ok) out.known_pairs += 1; else out.failures.push('edge:' + kp[2]);
    });
    list(seed.claims).forEach(function (c, i) {
      const r = navigation.writeClaimNode(db, { knowledge_type: c.knowledge_type, text: c.text, sessionId: 'real-room-run', sourceSegment: 'seed:claim:' + i });
      if (!(r && r.ok)) { out.failures.push('claim:' + i); return; }
      out.claims += 1;
      if (c.source) navigation.writeEdge(db, { source_id: r.node_id, target_id: c.source, edge_type: 'SOURCED_FROM', properties: { relation: 'sourced_from' } });
    });
  } finally {
    try { navigation.closeRoomDbForCaller(db); } catch (_e) { /* ignore */ }
  }
  return out;
}

// -- shared planner steps ----------------------------------------------------------------
function planRun(room, qsFile, mode) {
  const res = planner(['plan', qsFile, '--room', room, '--mode', mode]);
  if (!ok(res)) return { ok: false, reason: why(res) };
  const runId = res.json.run_id;
  const plan = readJson(path.join(room, '.mindrian', 'research-runs', runId, 'plan.json'), null);
  return { ok: true, run_id: runId, status: res.json.status, next: res.json.next, proposal: res.json.proposal || null, card: res.json.card || null, plan: plan };
}

// the exact round-one search strings a plan would send, deduplicated, in leaf order
function searchLines(plan) {
  const seen = {};
  const out = [];
  list(plan && plan.leaves).forEach(function (leaf) {
    list(leaf.queries).forEach(function (q) {
      if (q.round !== undefined && q.round !== 1) return;
      if (seen[q.q_hash]) return;
      seen[q.q_hash] = true;
      out.push(noDash(q.q));
    });
  });
  return out;
}

function laneClass(outcome) {
  if (outcome === 'ok' || outcome === 'cache_hit') return 'ran';
  if (outcome === 'empty_valid') return 'empty';
  return 'unavailable';
}

function tally(executed) {
  const lanes = {};
  list(executed).forEach(function (e) {
    const cur = lanes[e.lane] || { ran: 0, empty: 0, unavailable: 0, failure: null };
    const c = laneClass(e.outcome);
    cur[c] += 1;
    if (c === 'unavailable' && e.failure_class) cur.failure = e.failure_class;
    lanes[e.lane] = cur;
  });
  const out = { lanes: lanes, ran: 0, empty: 0, unavailable: 0 };
  Object.keys(lanes).forEach(function (l) {
    const t = lanes[l];
    if (t.ran > 0) out.ran += 1; else if (t.empty > 0) out.empty += 1; else out.unavailable += 1;
  });
  return out;
}

function laneState(t) {
  if (t.ran > 0) return 'ran';
  if (t.empty > 0) return 'empty';
  return 'provider absent' + (t.failure ? ' (' + t.failure + ')' : ' (the provider did not answer)');
}

// 369.2-16 (R07, R25): what the run itself recorded. run.json.completion is computed from the operation ledger
// (369.2-13/14), so the report counts executed versus planned operations and names the jobs left undone from it,
// never from a command return. null when the run left no completion (offline, dry, a loop that did not finish).
function completionCounts(comp) {
  const b = isObj(comp) && isObj(comp.by_state) ? comp.by_state : null;
  if (!b) return null;
  const c = {
    executed_with_results: num(b.executed_with_results), executed_empty: num(b.executed_empty),
    refused_before_fetch: num(b.refused_before_fetch), not_executed: num(b.not_executed),
  };
  c.operations_planned = c.executed_with_results + c.executed_empty + c.refused_before_fetch + c.not_executed + list(comp.open).length;
  c.complete = comp.complete === true ? 1 : 0;
  return c;
}
function applyCompletion(out, run, opts) {
  const comp = isObj(run) ? run.completion : null;
  const c = completionCounts(comp);
  if (!c) return;
  Object.assign(out, c);
  out.has_completion = true;
  out.searches_executed = c.executed_with_results + c.executed_empty;
  out.incomplete_lines = jobLines.incompleteLines(comp, { max: 3, operations: run.operations, skipFalsifiers: !!(opts && opts.skipFalsifiers) });
  out.counterevidence_status = isObj(comp.counterevidence) ? comp.counterevidence.status : null;
  out.counterevidence_line = isObj(comp.counterevidence) ? jobLines.counterevidenceLine(comp.counterevidence, {}) : '';
}
function emptyCounts() {
  return { operations_planned: 0, executed_with_results: 0, executed_empty: 0, refused_before_fetch: 0, not_executed: 0, complete: 0, has_completion: false, incomplete_lines: [], counterevidence_status: null, counterevidence_line: '' };
}

// 369.2-32: a seed with no question-set file (the Phase 355 rooms) has nothing to plan for quick or deep
function noQuestionSet(out, kind) {
  out.status = 'no question set';
  out.reason = 'this seed has no ' + kind + ' question set, so nothing was planned and nothing was sent';
  out.lane_lines.push('lane openalex: provider absent (no ' + kind + ' question set, nothing planned)');
  return out;
}

// -- job 1: quick -------------------------------------------------------------------------------
function jobQuick(ctx) {
  const out = { status: 'not run', reason: null, lines: [], lane_lines: [], rows: 0, searches_planned: 0, searches_executed: 0, lanes_ran: 0, lanes_empty: 0, lanes_unavailable: 0, verdict: null, answer_line: null, run_id: null };
  Object.assign(out, emptyCounts());
  if (!fs.existsSync(path.join(ctx.seedDir, 'question-set-quick.json'))) return noQuestionSet(out, 'quick');
  const planned = planRun(ctx.roomDir, path.join(ctx.seedDir, 'question-set-quick.json'), 'quick');
  if (!planned.ok) { out.status = 'plan failed'; out.reason = planned.reason; return out; }
  out.run_id = planned.run_id;
  out.lines = searchLines(planned.plan);
  out.searches_planned = out.lines.length;
  if (ctx.offline) {
    const r = planner(['run-quick', planned.run_id, '--room', ctx.roomDir, '--offline']);
    out.status = 'plan only';
    out.reason = 'offline (not fetched): ' + (ok(r) && r.json.answer_line ? noDash(r.json.answer_line) : 'nothing left the room');
    out.lane_lines.push('lane openalex: provider absent (offline, not fetched)');
    return out;
  }
  if (!ctx.readBy) {
    out.status = 'not approved (dry)';
    out.reason = 'no --read-by, so the grant was not approved and nothing was sent';
    out.lane_lines.push('lane openalex: provider absent (grant not approved, dry run)');
    return out;
  }
  if (!isObj(planned.proposal)) { out.status = 'no grant proposal'; out.reason = 'the plan offered no grant (next: ' + planned.next + ')'; return out; }
  const approved = planner(['grant', 'approve', scratchFile('quick-grant.json', planned.proposal), '--room', ctx.roomDir, '--approved-via', 'cli']);
  if (!ok(approved)) { out.status = 'grant refused'; out.reason = why(approved); return out; }
  const ran = planner(['run-quick', planned.run_id, '--room', ctx.roomDir]);
  if (!ok(ran) || ran.json.status !== 'done') { out.status = 'run refused'; out.reason = why(ran); return out; }
  out.status = 'ran';
  out.verdict = ran.json.verdict || null;
  out.answer_line = ran.json.answer_line ? noDash(ran.json.answer_line) : null;
  const run = readJson(path.join(ctx.roomDir, '.mindrian', 'research-runs', planned.run_id, 'run.json'), {});
  const rows = list(run.rows);
  out.rows = rows.length;
  const perLane = {};
  rows.forEach(function (r) { perLane[r.lane || 'openalex'] = true; });
  const lr = list(run.lane_results).length ? run.lane_results : list(run.lanes);
  out.lane_lines.push('lane openalex: ' + (rows.length > 0 ? 'ran (' + rows.length + ' evidence rows)' : (lr.length ? 'empty (searched, nothing matched)' : 'empty')));
  out.lanes_ran = rows.length > 0 ? 1 : 0;
  out.lanes_empty = rows.length > 0 ? 0 : 1;
  out.searches_executed = out.searches_planned;
  // 369.2-16: from here on the counts come from the run's own completion, not from the plan
  applyCompletion(out, run, { skipFalsifiers: false });
  return out;
}

// -- job 2: deep ----------------------------------------------------------------------------------
function recordRows(ctx, runId, lane, payload, label, tag) {
  const records = list(readJson(path.join(ctx.roomDir, payload.records_path), {}).records);
  if (records.length === 0) return 0;
  const rows = [];
  list(payload.leaves).forEach(function (leaf, i) {
    const rec = records[i % records.length];
    rows.push({ leaf_id: leaf.leaf_id, record_id: rec.record_id || rec.id, claim: 'Harness row for ' + leaf.leaf_id + ' from the record title', quote: rec.title, label: label });
  });
  if (rows.length === 0) return 0;
  const r = planner(['deep-record', runId, lane, scratchFile('rows-' + tag + '-' + lane + '.json', rows), '--room', ctx.roomDir]);
  return ok(r) ? num(r.json.kept !== undefined ? r.json.kept : r.json.rows_kept) : 0;
}

function jobDeep(ctx) {
  const out = { status: 'not run', reason: null, lines: [], lane_lines: [], rows: 0, searches_planned: 0, searches_executed: 0, lanes_planned: 0, lanes_ran: 0, lanes_empty: 0, lanes_unavailable: 0, counterevidence_planned: 0, counterevidence_executed: 0, synthesis: 'not run', stop_reason: null, answer_line: null, run_id: null, steps: [] };
  Object.assign(out, emptyCounts());
  if (!fs.existsSync(path.join(ctx.seedDir, 'question-set-deep.json'))) return noQuestionSet(out, 'deep');
  const planned = planRun(ctx.roomDir, path.join(ctx.seedDir, 'question-set-deep.json'), 'deep');
  if (!planned.ok) { out.status = 'plan failed'; out.reason = planned.reason; return out; }
  out.run_id = planned.run_id;
  out.lines = searchLines(planned.plan);
  out.searches_planned = out.lines.length;
  // a lens lane groups the researchable leaves that share a lens (deep.cjs laneSpecs)
  const planLanes = [];
  list(planned.plan && planned.plan.leaves).forEach(function (l) {
    if (l.researchable !== true || !l.lens) return;
    const name = String(l.lens).replace(/[^A-Za-z0-9_-]/g, '-');
    if (planLanes.indexOf(name) === -1) planLanes.push(name);
  });
  out.lanes_planned = planLanes.length;
  if (planned.status !== 'ready') { out.status = 'plan ' + planned.status; out.reason = 'the deep plan is ' + planned.status; return out; }
  if (ctx.offline) {
    out.status = 'plan only';
    out.reason = 'offline (not fetched): the plan was built and its searches are shown, none were sent';
    planLanes.forEach(function (l) { out.lane_lines.push('lane ' + l + ': provider absent (offline, not fetched)'); });
    return out;
  }
  if (!ctx.readBy) {
    out.status = 'not approved (dry)';
    out.reason = 'no --read-by, so the plan review was not approved and nothing was sent';
    planLanes.forEach(function (l) { out.lane_lines.push('lane ' + l + ': provider absent (plan review not approved, dry run)'); });
    return out;
  }
  const appr = planner(['review', 'approve', planned.run_id, '--room', ctx.roomDir, '--approved-via', 'cli']);
  if (!ok(appr)) { out.status = 'review refused'; out.reason = why(appr); return out; }
  let finished = false;
  for (let i = 0; i < MAX_DEEP_STEPS && !finished; i += 1) {
    const n = planner(['deep-next', planned.run_id, '--room', ctx.roomDir]);
    if (!ok(n)) { out.status = 'stopped'; out.reason = 'deep-next: ' + why(n); break; }
    const step = n.json.step;
    out.steps.push(step);
    if (step === 'fetch_round') {
      const f = planner(['deep-fetch', planned.run_id, '--room', ctx.roomDir]);
      if (!ok(f)) { out.status = 'stopped'; out.reason = 'deep-fetch: ' + why(f); break; }
    } else if (step === 'dispatch_lanes') {
      list(n.json.payload && n.json.payload.lanes).forEach(function (p) { out.rows += recordRows(ctx, planned.run_id, p.lane, p, 'supports', 'r' + i); });
    } else if (step === 'reflect') {
      const r = planner(['deep-followups', planned.run_id, scratchFile('followups.json', []), '--room', ctx.roomDir]);
      if (!ok(r)) { out.status = 'stopped'; out.reason = 'deep-followups: ' + why(r); break; }
    } else if (step === 'extend_card') {
      const r = planner(['deep-extend', planned.run_id, scratchFile('decision.json', { decision: 'stop' }), '--room', ctx.roomDir]);
      if (!ok(r)) { out.status = 'stopped'; out.reason = 'deep-extend: ' + why(r); break; }
    } else if (step === 'counterevidence') {
      out.counterevidence_planned = list(n.json.payload && n.json.payload.queries).length;
      const ce = planner(['deep-counterevidence', planned.run_id, '--room', ctx.roomDir]);
      if (!ok(ce)) { out.status = 'stopped'; out.reason = 'deep-counterevidence: ' + why(ce); break; }
      if (ce.json.lane_payload) out.rows += recordRows(ctx, planned.run_id, 'CE', ce.json.lane_payload, 'contradicts', 'ce');
    } else if (step === 'synthesize') {
      const s = planner(['deep-synthesize', planned.run_id, '--room', ctx.roomDir]);
      if (!ok(s)) { out.status = 'stopped'; out.reason = 'deep-synthesize: ' + why(s); break; }
      out.synthesis = 'done';
      out.stop_reason = s.json.stop_reason || null;
      out.answer_line = s.json.answer_line ? noDash(s.json.answer_line) : null;
      finished = true;
    } else if (step === 'done') {
      out.synthesis = 'done';
      finished = true;
    }
  }
  const state = readJson(path.join(ctx.roomDir, '.mindrian', 'research-runs', planned.run_id, 'state.json'), {});
  const executed = list(state.executed);
  out.searches_executed = executed.length;
  const t = tally(executed);
  out.lanes_ran = t.ran;
  out.lanes_empty = t.empty;
  out.lanes_unavailable = t.unavailable;
  out.lanes_planned = Math.max(out.lanes_planned, list(state.lane_order).length);
  Object.keys(t.lanes).forEach(function (l) { out.lane_lines.push('lane ' + l + ': ' + laneState(t.lanes[l])); });
  out.counterevidence_executed = executed.filter(function (e) { return e.lane === 'CE'; }).length;
  const ce = isObj(state.ce) ? state.ce : {};
  // 369.2-16: run.json.completion, when synthesis wrote one, replaces the plan-side counts
  const runDone = readJson(path.join(ctx.roomDir, '.mindrian', 'research-runs', planned.run_id, 'run.json'), null);
  applyCompletion(out, runDone, { skipFalsifiers: true });
  if (out.has_completion && isObj(runDone.counterevidence)) {
    out.counterevidence_planned = num(runDone.counterevidence.planned);
    out.counterevidence_executed = num(runDone.counterevidence.executed);
  }
  out.counterevidence_note = list(ce.gaps).length ? 'gaps: ' + list(ce.gaps).map(function (g) { return g.branch + ' (' + g.reason + ')'; }).join('; ') : (ce.skipped ? 'skipped: ' + ce.skipped_reason : null);
  if (out.status === 'not run') out.status = finished ? 'ran' : 'stopped';
  if (!finished && !out.reason) out.reason = 'the deep loop did not reach synthesis in ' + MAX_DEEP_STEPS + ' steps';
  return out;
}

// -- jobs 3 and 4: the perspectives (local, offline by design) ---------------------------------------
function perspectiveRun(ctx, id, opts) {
  const rec = planner(['perspective-recall', '--room', ctx.roomDir, '--perspective', id, '--offline']);
  if (!ok(rec)) return { ok: false, reason: why(rec) };
  const j = rec.json;
  const out = { ok: true, run_tag: j.run_tag, counts: isObj(j.counts) ? j.counts : {}, top: list(j.top), plan_run_id: j.plan ? j.plan.run_id : null, pairs_truncated: num(j.pairs_truncated), judge: null, judge_state: null, judge_line: null };
  if (opts && opts.judge === false) return out;
  const jud = planner(['perspective-judge', '--room', ctx.roomDir, '--perspective', id, '--tag', j.run_tag, '--judge', 'none', '--offline']);
  out.judge = ok(jud) && isObj(jud.json.summary) ? jud.json.summary : null;
  // 369.2-27: the one sentence that says why no model judged the pairs, and the next move (never a key value)
  out.judge_state = ok(jud) && typeof jud.json.judge_state === 'string' ? jud.json.judge_state : null;
  out.judge_line = ok(jud) && typeof jud.json.line === 'string' ? noDash(jud.json.line) : null;
  return out;
}

// how many leaves of a perspective's own plan a web search could answer (researchable, corpus openalex)
function researchableLeaves(ctx, planRunId) {
  if (!planRunId) return 0;
  const plan = readJson(path.join(ctx.roomDir, '.mindrian', 'research-runs', planRunId, 'plan.json'), null);
  return list(plan && plan.leaves).filter(function (l) { return l && l.researchable === true && l.corpus === 'openalex'; }).length;
}

function pairLine(c) {
  const shared = list(c.shared_entities).map(function (s) { return typeof s === 'string' ? s : (s && (s.title || s.name)) || ''; }).filter(Boolean);
  return noDash('"' + (c.title_a || c.a) + '" with "' + (c.title_b || c.b) + '" (' + (c.section_a || '?') + ' and ' + (c.section_b || '?') + (shared.length ? '; shared: ' + shared.join(', ') : '') + ')');
}

function jobEureka(ctx) {
  const out = { status: 'not run', reason: null, candidates: 0, passed_stage_a: 0, judged: 0, excluded_known: 0, things: 0, lanes: {}, lane_lines: [], pairs: [], run_tag: null, judge_note: null, judge_state: null };
  const r = perspectiveRun(ctx, 'eureka');
  if (!r.ok) { out.status = 'failed'; out.reason = r.reason; return out; }
  const c = r.counts;
  out.run_tag = r.run_tag;
  out.candidates = num(c.candidates);
  out.things = num(c.things);
  out.excluded_known = num(c.excluded_known);
  out.lanes = { shared_entity: num(c.shared_entity), lexical: num(c.lexical), icm_declared: num(c.icm_declared) };
  Object.keys(out.lanes).forEach(function (l) { out.lane_lines.push('lane ' + l + ': ' + (out.lanes[l] > 0 ? 'ran (' + out.lanes[l] + ' pairs)' : 'empty')); });
  if (r.judge) {
    out.passed_stage_a = Math.max(0, out.candidates - num(r.judge.stage_a_failed));
    out.judged = num(r.judge.judged);
    out.judge_state = r.judge_state;
    out.judge_note = r.judge_line ? r.judge_line.replace(/\.\s*$/, '') : (r.judge.judge === 'none' ? 'No model judged these pairs' : 'judge: ' + r.judge.judge);
  }
  out.pairs = r.top.slice(0, 3).map(pairLine);
  out.status = out.candidates > 0 ? 'ran' : 'empty';
  return out;
}

function jobAnalogies(ctx) {
  const out = { status: 'not run', reason: null, pairs: 0, structural_pairs: 0, things: 0, lanes: {}, lane_lines: [], examples: [], run_tag: null, statement_note: 'the SAPPhIRE statement slots are filled by the host model at the statement stage, never by recall' };
  const r = perspectiveRun(ctx, 'analogies');
  if (!r.ok) { out.status = 'failed'; out.reason = r.reason; return out; }
  const c = r.counts;
  out.run_tag = r.run_tag;
  out.pairs = num(c.candidates);
  out.things = num(c.things);
  // analogies recall only ever emits pairs on the structural lane (it filters the eureka pool to
  // relational, low-word-overlap rows), so every candidate counts; `top` is capped at 10 by the door
  out.structural_pairs = out.pairs;
  out.lanes = { structural: out.structural_pairs, icm_declared: num(c.icm_declared) };
  out.lane_lines.push('lane structural: ' + (out.structural_pairs > 0 ? 'ran (' + out.structural_pairs + ' pairs)' : 'empty'));
  out.lane_lines.push('lane icm_declared: ' + (out.lanes.icm_declared > 0 ? 'ran (' + out.lanes.icm_declared + ' pairs)' : 'empty'));
  out.examples = r.top.slice(0, 3).map(pairLine);
  out.status = out.pairs > 0 ? 'ran' : 'empty';
  return out;
}

// -- jobs 5 to 8: the other four canvas perspectives (369.2-32, R25) ---------------------------------------------
// Each is local recall over the room's own graph (no model, no network); the planner door also builds the plan a
// web or Brain search would follow, so the block counts the leaves of that plan a web search could answer.
const BLOCK_SPECS = Object.freeze([
  Object.freeze({
    key: 'bottlenecks', id: 'rs', header: 'Bottlenecks',
    tried: 'to find the sections that lag the sections feeding them, and pair the things across that boundary, from the room\'s own graph and its declared feeds (local, no model, no network).',
    lanes: Object.freeze(['flow_boundary', 'icm_declared', 'support_gap']),
    cannot: 'judge which lagging section matters most, or search the web for them: it only plans the searches a person would approve.',
  }),
  Object.freeze({
    key: 'hsi', id: 'hsi', header: 'HSI',
    tried: 'to find pairs of things whose structure matches while their words do not, and pairs that share words (the control), from the room\'s own graph (local, no model, no network).',
    lanes: Object.freeze(['relational', 'lexical']),
    cannot: 'say whether a pair is a real match: a person reads the pairs and judges them.',
  }),
  Object.freeze({
    key: 'connections', id: 'connections', header: 'Connections',
    tried: 'to find things in different sections that carry different canon frameworks, or the same framework, and so may connect, from the room\'s own graph (local, no model, no network).',
    lanes: Object.freeze(['canon_pair', 'framework_walk']),
    cannot: 'check a lateral path between two frameworks: that check runs later, as a search under an approved line to the Brain.',
  }),
  Object.freeze({
    key: 'whitespace', id: 'whitespace', header: 'Whitespace',
    tried: 'to find empty ground: sections the room declares as related that nothing links, and things that border a marked zone, from the room\'s own graph (local, no model, no network).',
    lanes: Object.freeze(['zone_border', 'declared_unlinked']),
    cannot: 'prove the ground is empty: a zero from a search is not proof, so it only plans the checks.',
  }),
]);

function jobBlock(ctx, spec) {
  const out = { status: 'not run', reason: null, candidates: 0, things: 0, researchable_leaves: 0, excluded_known: 0, lanes: {}, lane_lines: [], pairs: [], run_tag: null };
  const r = perspectiveRun(ctx, spec.id, { judge: false });
  if (!r.ok) { out.status = 'failed'; out.reason = r.reason; spec.lanes.forEach(function (l) { out.lane_lines.push('lane ' + l + ': provider absent (the recall did not run)'); }); return out; }
  const c = r.counts;
  out.run_tag = r.run_tag;
  out.candidates = num(c.candidates);
  out.things = num(c.things);
  out.excluded_known = num(c.excluded_known);
  out.researchable_leaves = researchableLeaves(ctx, r.plan_run_id);
  spec.lanes.forEach(function (l) {
    out.lanes[l] = num(c[l]);
    out.lane_lines.push('lane ' + l + ': ' + (out.lanes[l] > 0 ? 'ran (' + out.lanes[l] + ' pairs)' : 'empty'));
  });
  out.pairs = r.top.slice(0, 2).map(pairLine);
  out.status = out.candidates > 0 ? 'ran' : 'empty';
  return out;
}

// the readiness counts of one room (369.2-27): claims apart from every other confirmed node type, read-only
function readReadiness(roomDir) {
  const navigation = require(path.join(ROOT, 'lib', 'core', 'navigation.cjs'));
  const out = { claims_total: 0, confirmed_claim_count: 0, confirmed_other_count: 0, confirmed_other_by_type: {}, read: false };
  let db = null;
  try { db = navigation.openRoomDbReadOnlyForCaller(roomDir); } catch (_e) { db = null; }
  if (!db) return out;
  try {
    Object.assign(out, navigation.readReadinessCounts(db), { read: true });
  } catch (_e) { /* a failed read leaves the zero counts and read false */ } finally {
    try { navigation.closeRoomDbForCaller(db); } catch (_e) { /* ignore */ }
  }
  return out;
}

// -- the report ----------------------------------------------------------------------------------------
function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

// the report words for a job's own completion (369.2-16): executed of planned operations, and the jobs left undone
function searchesGot(j) {
  if (!j.has_completion) return j.searches_executed + ' of ' + j.searches_planned + ' searches executed.';
  return j.searches_executed + ' of ' + j.operations_planned + ' planned searches ran (' + j.executed_with_results + ' with records, ' + j.executed_empty + ' came back empty).';
}
function ceGot(d) {
  const status = { complete: 'complete', partial: 'partial', not_run: 'not run', not_needed: 'not needed' }[d.counterevidence_status] || null;
  return d.counterevidence_executed + ' of ' + d.counterevidence_planned + ' searches executed' + (d.has_completion && status ? ' (' + status + ')' : '');
}
function couldNotJobs(j, extra) {
  if (!j.has_completion) return '';
  return (j.incomplete_lines.length > 0 ? j.incomplete_lines.join(' ') : 'nothing it promised was left undone.') + ' ' + (extra ? extra + ' ' : '') + 'Beyond that, it could not ';
}

// 369.2-27 (HARNESS-11): claims apart from every other confirmed node type, so the word confirmed never means
// confirmed whitespace zones
function readinessLine(rd) {
  const types = Object.keys(rd.confirmed_other_by_type || {}).sort().map(function (t) { return t + ': ' + rd.confirmed_other_by_type[t]; });
  return 'Confirmed claims: ' + rd.confirmed_claim_count + ' of ' + rd.claims_total + ' typed claims; other confirmed nodes: ' + rd.confirmed_other_count + ' (' + (types.length ? types.join(', ') : 'none') + ').';
}

function blockLines(spec, b) {
  const L = [];
  L.push('== ' + spec.header + ' ==');
  L.push('  It tried:  ' + spec.tried);
  L.push('  It got:    ' + b.status + (b.reason ? ' - ' + b.reason.replace(/\.\s*$/, '') : '') + '. ' + plural(b.candidates, 'candidate pair', 'candidate pairs') + ' from ' + plural(b.things, 'thing', 'things') + '; ' + b.excluded_known + ' already-known pairs excluded; ' + plural(b.researchable_leaves, 'web search leaf', 'web search leaves') + ' in its plan.');
  b.lane_lines.forEach(function (x) { L.push('  ' + x); });
  b.pairs.forEach(function (x) { L.push('  pair: ' + x); });
  L.push('  It could not: ' + spec.cannot);
  L.push('');
  return L;
}

function roomLines(room, i, n) {
  const L = [];
  const q = room.jobs.quick; const d = room.jobs.deep; const e = room.jobs.eureka; const a = room.jobs.analogies;
  L.push('ROOM ' + i + ' of ' + n + ': ' + room.venture + ' (' + room.seed + ')');
  L.push('  room:     ' + room.slug + ' (born through the room chokepoint; registered: ' + (room.registered ? 'yes' : 'NO') + ')');
  L.push('  seeded:   ' + room.indexed + ' artifacts indexed, ' + room.seeded.entities + ' entities, ' + room.seeded.claims + ' typed claims, ' + room.seeded.describes + ' entity links' + (room.seeded.failures.length ? ', FAILED: ' + room.seeded.failures.join(', ') : ''));
  L.push('  ' + readinessLine(room.readiness) + (room.readiness.read ? '' : ' (the room graph could not be read)'));
  L.push('');
  L.push('== Quick research ==');
  L.push('  It tried:  one grant-gated run of the room\'s question, with these searches, sent exactly as written:');
  q.lines.forEach(function (s) { L.push('               ' + s); });
  L.push('  It got:    ' + q.status + (q.reason ? ' - ' + q.reason.replace(/\.\s*$/, '') : '') + '. ' + plural(q.rows, 'evidence row', 'evidence rows') + '; ' + searchesGot(q) + (q.verdict ? ' Verdict: ' + noDash(typeof q.verdict === 'string' ? q.verdict : JSON.stringify(q.verdict)) + '.' : ''));
  if (q.answer_line) L.push('  It said:   ' + q.answer_line);
  q.lane_lines.forEach(function (s) { L.push('  ' + s); });
  L.push('  It could not: ' + couldNotJobs(q) + 'reach the web without the grant and the reader; check what the papers actually say (that is the reader\'s job).');
  L.push('');
  L.push('== Deep research ==');
  L.push('  It tried:  a plan review, then fetch rounds up to the planner\'s own cap, a counterevidence round and a synthesis, over ' + plural(d.searches_planned, 'planned search', 'planned searches') + ':');
  d.lines.forEach(function (s) { L.push('               ' + s); });
  L.push('  It got:    ' + d.status + (d.reason ? ' - ' + d.reason.replace(/\.\s*$/, '') : '') + '. Lanes planned ' + d.lanes_planned + ', ran ' + d.lanes_ran + ', empty ' + d.lanes_empty + ', unavailable ' + d.lanes_unavailable + '; ' + plural(d.rows, 'evidence row', 'evidence rows') + '; ' + (d.has_completion ? searchesGot(d).replace(/\.$/, '') + '; ' : '') + 'counterevidence ' + ceGot(d) + (d.counterevidence_note ? ' (' + d.counterevidence_note + ')' : '') + '; synthesis ' + d.synthesis + (d.stop_reason ? ' (stopped on ' + d.stop_reason + ')' : '') + '.');
  if (d.answer_line) L.push('  It said:   ' + d.answer_line);
  d.lane_lines.forEach(function (s) { L.push('  ' + s); });
  L.push('  It could not: ' + couldNotJobs(d, d.counterevidence_line && d.counterevidence_status !== 'complete' ? d.counterevidence_line : '') + 'judge the evidence. The rows here were written by this harness from the titles of what came back, a mechanical stand-in for the analyst lane, so this run checks the machinery, not the research.');
  L.push('');
  L.push('== Eureka ==');
  L.push('  It tried:  to find cross-section pairs the room does not already connect, from the room\'s own graph (local, no model, no network).');
  L.push('  It got:    ' + e.status + '. ' + plural(e.candidates, 'candidate pair', 'candidate pairs') + ' from ' + plural(e.things, 'thing', 'things') + '; ' + e.excluded_known + ' already-known pairs excluded; ' + e.passed_stage_a + ' passed the entity gate; ' + e.judged + ' judged by a model.');
  e.lane_lines.forEach(function (s) { L.push('  ' + s); });
  e.pairs.forEach(function (s) { L.push('  pair: ' + s); });
  L.push('  It could not: ' + (e.judge_note || 'judge the pairs') + '.');
  L.push('');
  L.push('== Analogies ==');
  L.push('  It tried:  to find pairs that share structure without sharing words (a shared entity and low word overlap), from the same graph.');
  L.push('  It got:    ' + a.status + '. ' + plural(a.pairs, 'pair', 'pairs') + ', of which ' + a.structural_pairs + ' carry a structural signal.');
  a.lane_lines.forEach(function (s) { L.push('  ' + s); });
  a.examples.forEach(function (s) { L.push('  pair: ' + s); });
  L.push('  It could not: fill the SAPPhIRE statement - ' + a.statement_note + '.');
  L.push('');
  BLOCK_SPECS.forEach(function (spec) { blockLines(spec, room.jobs[spec.key]).forEach(function (x) { L.push(x); }); });
  return L;
}

function reportText(res) {
  const L = [];
  L.push('REAL-ROOM RELEASE RUN');
  L.push('  commit:   ' + res.sha + '  (version ' + res.version + ')');
  L.push('  rooms:    ' + res.rooms.length + ' (' + res.rooms.map(function (r) { return r.seed; }).join(', ') + ')');
  L.push('  mode:     ' + (res.offline ? 'OFFLINE: every egress line off, the web lines are planned and shown, never sent' : (res.read_by ? 'live, web lines approved by the reader' : 'dry: web lines NOT approved, nothing sent')));
  L.push('  tavily:   ' + res.providers.tavily + (res.providers.tavily === 'absent' ? '  (no TAVILY_API_KEY in the environment or ~/.mindrian.env; the research planner\'s own search lines go to OpenAlex, so this run does not depend on it)' : ''));
  L.push('  openalex: ' + res.providers.openalex);
  L.push('');
  res.rooms.forEach(function (room, i) { roomLines(room, i + 1, res.rooms.length).forEach(function (x) { L.push(x); }); });
  L.push(roomRead.formatFeyMintoBlock(res.jobs.feyminto));
  L.push('');
  L.push(negativeLeg.formatNegativeBlock(res.negative_leg));
  L.push('');
  if (res.receipt && res.receipt.written) {
    L.push('RECEIPT: written for ' + res.sha.slice(0, 12) + ' read by ' + res.read_by + ' at ' + res.receipt.read_at + (res.offline ? ' (recorded as OFFLINE; release.sh refuses an offline receipt)' : '') + '.');
    L.push('  next: if this cut ships a Desktop copy, run it on a Mac and a PC, then: node scripts/real-room-run.cjs --desktop-verified mac|win');
  } else {
    L.push('NO RECEIPT written (no --read-by). Read the report, then run: node scripts/real-room-run.cjs --read-by "<your name>"');
  }
  return noDash(L.join('\n')) + '\n';
}

// -- receipt -----------------------------------------------------------------------------------------------
function receiptPath(receiptDir, sha) { return path.join(receiptDir, sha + '.json'); }

// 369.25-23: the receipt keeps each job's outcome (refused and why), not the run's scratch paths or requirement prose.
function negativeSummary(leg) {
  return {
    fixture: leg.fixture,
    rooms: leg.rooms.map(function (r) {
      const jobs = {};
      Object.keys(r.jobs).forEach(function (k) { jobs[k] = { refused: r.jobs[k].refused === true, not_ready_reason: r.jobs[k].not_ready_reason }; });
      return { injection: r.injection, jobs: jobs };
    }),
    all_refused: leg.all_refused === true,
  };
}

// 369.2-16: the six completion numbers a receipt carries per research job (numbers only; the gate reads them)
function completionNumbers(j) {
  return {
    operations_planned: num(j.operations_planned), executed_with_results: num(j.executed_with_results), executed_empty: num(j.executed_empty),
    refused_before_fetch: num(j.refused_before_fetch), not_executed: num(j.not_executed), complete: j.complete === 1 ? 1 : 0,
  };
}

// the eight perspective blocks of one room: the four the gate reads (quick, deep, eureka, analogies) and the four
// canvas perspectives added by 369.2-32 (numbers only)
function perspectivesOf(jobs) {
  const q = jobs.quick; const d = jobs.deep; const e = jobs.eureka; const a = jobs.analogies;
  const out = {
    quick: { status: q.status, counts: Object.assign({ searches_planned: q.searches_planned, searches_executed: q.searches_executed, rows: q.rows, lanes_ran: q.lanes_ran, lanes_empty: q.lanes_empty, lanes_unavailable: q.lanes_unavailable }, completionNumbers(q)) },
    deep: { status: d.status, counts: Object.assign({ searches_planned: d.searches_planned, searches_executed: d.searches_executed, lanes_planned: d.lanes_planned, lanes_ran: d.lanes_ran, lanes_empty: d.lanes_empty, lanes_unavailable: d.lanes_unavailable, rows: d.rows, counterevidence_planned: d.counterevidence_planned, counterevidence_executed: d.counterevidence_executed }, completionNumbers(d)) },
    eureka: { status: e.status, counts: { candidates: e.candidates, things: e.things, excluded_known: e.excluded_known, passed_stage_a: e.passed_stage_a, judged: e.judged } },
    analogies: { status: a.status, counts: { pairs: a.pairs, structural_pairs: a.structural_pairs, things: a.things } },
  };
  BLOCK_SPECS.forEach(function (spec) {
    const b = jobs[spec.key];
    out[spec.key] = { status: b.status, counts: { candidates: b.candidates, researchable_leaves: b.researchable_leaves, things: b.things } };
  });
  return out;
}

function buildReceipt(res) {
  const first = perspectivesOf(res.jobs);
  return {
    schema: SCHEMA,
    sha: res.sha,
    version: res.version,
    room: res.room.slug,
    reader: res.read_by,
    read_at: res.receipt.read_at,
    offline: res.offline === true,
    perspectives: first,
    rooms: res.rooms.map(function (r) { return { seed: r.seed, slug: r.slug, perspectives: perspectivesOf(r.jobs) }; }),
    providers: { tavily: res.providers.tavily, openalex: res.providers.openalex },
    feyminto: { nests: res.jobs.feyminto.map(function (n) { return { nest: n.nest, asked: n.asked, not_asked_reason: n.not_asked_reason, frameworks_named: n.frameworks_named.length, commands_runnable_here: n.commands_runnable_here.length }; }) },
    negative_leg: negativeSummary(res.negative_leg),
    desktop_verified: { mac: null, win: null },
  };
}

// -- main ---------------------------------------------------------------------------------------------------
async function runDesktopVerified(opts, receiptDir) {
  const sha = headSha();
  const file = receiptPath(receiptDir, sha);
  const rec = readJson(file, null);
  if (!isObj(rec) || rec.sha !== sha) throw refuse('no_receipt_for_head', 'no receipt for ' + sha.slice(0, 12) + ' in ' + receiptDir);
  const dv = isObj(rec.desktop_verified) ? rec.desktop_verified : { mac: null, win: null };
  dv[opts.desktopVerified] = nowIso();
  rec.desktop_verified = dv;
  writeJsonAtomic(file, rec);
  return { ok: true, sha: sha, desktop_verified: dv, file: file };
}

async function runCeremony(opts, receiptDir) {
  const seedDirs = (opts.seeds && opts.seeds.length ? opts.seeds : [DEFAULT_SEED]).map(function (d) { return path.resolve(d); });
  const roomsHome = path.resolve(opts.roomsHome || path.join(receiptDir, 'rooms'));
  const realRooms = path.join(os.homedir(), 'MindrianRooms');
  if (roomsHome === realRooms || roomsHome.indexOf(realRooms + path.sep) === 0) throw refuse('rooms_home_is_real_rooms', 'the release run never writes under ~/MindrianRooms');
  seedDirs.forEach(function (seedDir) {
    if (!fs.existsSync(path.join(seedDir, 'ROOM.md')) || !fs.existsSync(path.join(seedDir, 'sections'))) throw refuse('seed_missing', seedDir);
  });
  // two seeds that share a slug would delete each other's room
  const slugs = seedDirs.map(function (d) { return roomSlug('0'.repeat(40), d); });
  if (slugs.some(function (sl, i) { return slugs.indexOf(sl) !== i; })) throw refuse('duplicate_seed', 'two --seed values name the same room');

  const sha = headSha();
  const version = repoVersion();
  SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-real-room-run-'));
  try {
    progress('providers');
    const providers = { tavily: tavilyPresent() ? 'present' : 'absent', openalex: await openalexReachable(opts.offline) };
    const rooms = [];
    for (let i = 0; i < seedDirs.length; i += 1) {
      const seedDir = seedDirs[i];
      const tag = seedDirs.length > 1 ? ' (room ' + (i + 1) + ' of ' + seedDirs.length + ')' : '';
      progress('birthing the fixture room' + tag);
      const room = await buildRoom(opts, sha, seedDir, roomsHome);
      const ctx = { roomDir: room.roomDir, seedDir: seedDir, offline: opts.offline, readBy: opts.readBy || null };
      progress('quick' + tag);
      const quick = jobQuick(ctx);
      progress('deep' + tag);
      const deep = jobDeep(ctx);
      progress('eureka' + tag);
      const eureka = jobEureka(ctx);
      progress('analogies' + tag);
      const analogies = jobAnalogies(ctx);
      const jobs = { quick: quick, deep: deep, eureka: eureka, analogies: analogies };
      BLOCK_SPECS.forEach(function (spec) { progress(spec.header.toLowerCase() + tag); jobs[spec.key] = jobBlock(ctx, spec); });
      rooms.push({ seed: seedLabel(seedDir), seedDir: seedDir, slug: room.slug, dir: room.roomDir, venture: room.venture, indexed: room.indexed, seeded: room.seeded, registered: room.registered, jobs: jobs, readiness: readReadiness(room.roomDir) });
    }
    const first = rooms[0];
    progress('feyminto');
    const feyminto = await roomRead.feymintoLeg(first.dir, { offline: opts.offline });
    progress('negative leg');
    // the negative leg plans quick and deep from a question set: the first seed that has one
    const negSeed = seedDirs.filter(function (d) { return fs.existsSync(path.join(d, 'question-set-quick.json')) && fs.existsSync(path.join(d, 'question-set-deep.json')); })[0] || DEFAULT_SEED;
    const negative = negativeLeg.runNegativeLeg({ roomsHome: roomsHome, sha: sha, plannerCli: PLANNER_CLI, seedDir: negSeed, scratch: SCRATCH });
    const res = {
      ok: true,
      sha: sha, version: version, offline: opts.offline, read_by: opts.readBy || null,
      providers: providers,
      room: { slug: first.slug, dir: first.dir, indexed: first.indexed, seeded: first.seeded, registered: first.registered },
      jobs: Object.assign({}, first.jobs, { feyminto: feyminto }),
      rooms: rooms.map(function (r) { return { seed: r.seed, slug: r.slug, dir: r.dir, venture: r.venture, indexed: r.indexed, seeded: r.seeded, registered: r.registered, jobs: r.jobs, readiness: r.readiness }; }),
      negative_leg: negative,
      receipt: { written: false, file: null, read_at: null },
    };
    if (opts.readBy) {
      res.receipt.read_at = nowIso();
      const file = receiptPath(receiptDir, sha);
      writeJsonAtomic(file, buildReceipt(res));
      res.receipt.written = true;
      res.receipt.file = file;
    }
    return res;
  } finally {
    try { fs.rmSync(SCRATCH, { recursive: true, force: true }); } catch (_e) { /* tmp */ }
  }
}

// 369.25-23: only the negative leg (quick, deep, Eureka and analogies must refuse a room with no usable room.db).
// Writes no receipt and births no fixture room; exit 0 only when every job refused, else 1.
function runNegativeOnly(opts) {
  const seedDir = path.resolve(opts.seed || DEFAULT_SEED);
  const sha = headSha();
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-real-room-negative-'));
  try {
    return negativeLeg.runNegativeLeg({ roomsHome: null, sha: sha, plannerCli: PLANNER_CLI, seedDir: seedDir, scratch: scratch });
  } finally {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (_e) { /* tmp */ }
  }
}

const HELP = 'Usage: node scripts/real-room-run.cjs [--read-by "<name>"] [--offline] [--json] [--rooms-home <dir>] [--seed <dir>]... [--receipt-dir <dir>]\n'
  + '       (--seed may repeat: every seed is born as its own room and all of them go into ONE receipt)\n'
  + '       node scripts/real-room-run.cjs --negative-only [--json]   (only the negative leg; writes no receipt)\n'
  + '       node scripts/real-room-run.cjs --desktop-verified mac|win [--receipt-dir <dir>]\n';

async function main(argv) {
  let opts;
  try { opts = parseArgs(argv); } catch (e) {
    process.stderr.write((e.refusal || 'bad_args') + (e.detail ? ': ' + e.detail : '') + '\n' + HELP);
    return 2;
  }
  if (opts.help) { process.stdout.write(HELP); return 0; }
  const receiptDir = path.resolve(opts.receiptDir || process.env.MINDRIAN_REAL_ROOM_RECEIPT_DIR || path.join(os.homedir(), '.mindrian', 'release-real-room'));
  try {
    if (opts.desktopVerified) {
      const r = await runDesktopVerified(opts, receiptDir);
      process.stdout.write(opts.json ? JSON.stringify(r) + '\n' : 'Desktop leg recorded: ' + opts.desktopVerified + ' verified at ' + r.desktop_verified[opts.desktopVerified] + ' on the receipt for ' + r.sha.slice(0, 12) + '\n');
      return 0;
    }
    if (opts.negativeOnly) {
      const leg = runNegativeOnly(opts);
      process.stdout.write(opts.json ? JSON.stringify({ ok: leg.all_refused, negative_leg: leg }) + '\n' : negativeLeg.formatNegativeBlock(leg) + '\n');
      return leg.all_refused ? 0 : 1;
    }
    const res = await runCeremony(opts, receiptDir);
    process.stdout.write(opts.json ? JSON.stringify(res) + '\n' : reportText(res));
    return 0;
  } catch (e) {
    if (e && e.refusal) {
      if (opts.json) process.stdout.write(JSON.stringify({ ok: false, reason: e.refusal, detail: e.detail }) + '\n');
      process.stderr.write(e.refusal + (e.detail ? ': ' + noDash(String(e.detail)) : '') + '\n');
      return 2;
    }
    process.stderr.write('internal_error: ' + noDash(String((e && e.message) || e).slice(0, 300)) + '\n');
    return 1;
  }
}

main(process.argv.slice(2)).then(function (code) { process.exitCode = code; });
