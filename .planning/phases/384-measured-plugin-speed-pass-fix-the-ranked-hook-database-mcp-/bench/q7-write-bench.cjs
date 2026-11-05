#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 384 plan 11: the bench for Q7 (the cost of one PostToolUse Write event when the cascade really runs) and the
 * tables of Q8 (session frequency joined with the Write cost). It is built on the exports of t02-t05-bench.cjs (plan 384-10)
 * and on the library surface of tools/perf/perf-harness.cjs. Run it under the 384 lock:
 *   flock -w 7200 "$HOME/.cache/mos-perf-384.lock" node q7-write-bench.cjs ...
 *
 * Subcommands:
 *   q7 --mode time|count      the Write event on four targets (artifact, changed artifact, identity file, default layout)
 *   report --s1 f --s2 f --counts f --measurements dir      Markdown tables Q7-1 to Q7-7
 *   freq-tables --freq f [--s1 f --s2 f --counts f]          Markdown tables Q8-1 to Q8-3
 *
 * Result files use the schemas mos.perf-384/1 (timings) and mos.perf-384-counts/1 (counts). Canon Part 8: numbers, ids,
 * booleans, status words and script base names only. No path, no room name, no room text.
 * Test-only flags (need MOS_PERF_SELFTEST=1): --skip-gates, --allow-short. Test-only switch: MOS_Q7_TEST_GATE=fail.
 */
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const H = require(path.join(REPO, 'tools', 'perf', 'perf-harness.cjs'));
const T = require(path.join(__dirname, 't02-t05-bench.cjs'));
const { eligibleMd } = require(path.join(__dirname, 'process-census.cjs'));

const FLOOR_MS = 50; // owner decision 2 (OD-2): the smallest cost per event that matters
const WRITES = [1, 5, 20]; // ASSUMED numbers of Writes per session (20 is the ASSUMED value of 384-RANKING.md)
// Carried from the S2 row of 384-RANKING.md (fixture room), not re-measured here: CPU per event in ms and the ASSUMED events per session.
const CARRIED = [
  { name: 'Stop', cpu_ms: 1500, events: 30 },
  { name: 'UserPromptSubmit', cpu_ms: 240, events: 30 },
  { name: 'Read', cpu_ms: 40, events: 60 },
];
const RANKING_S2_TOTAL = 63100; // the S2 row: 1500 x 30 + 240 x 30 + 425 x 20 + 40 x 60
// The ASSUMED frequencies of plan 384-09 (events per development session).
const ASSUMED_FREQ = [
  { group: 'prompts', assumed: 30 },
  { group: 'write_edit', assumed: 20 },
  { group: 'read_grep_glob', assumed: 60 },
  { group: 'bash', assumed: 40 },
  { group: 'slash_command', assumed: 2 },
  { group: 'brain', assumed: 5 },
  { group: 'gate_answer', assumed: 1 },
];
const WRITE_DEF_ID = 'event:PostToolUse:Write';
const KEYS = ['rooms_artifact', 'rooms_artifact_changed', 'rooms_identity', 'default_artifact'];
const TIME_IDS = {
  A: 'q7:write:rooms:artifact',
  A2: 'q7:write:rooms:artifact-changed',
  I: 'q7:write:rooms:identity',
  D: 'q7:write:default:artifact',
};
const KEY_OF = { A: 'rooms_artifact', A2: 'rooms_artifact_changed', I: 'rooms_identity', D: 'default_artifact' };
const NAME_OF = {
  A: 'artifact, harness layout',
  A2: 'changed artifact, harness layout',
  I: 'identity file, harness layout',
  D: 'artifact, default layout',
};

const USAGE = {
  q7: 'usage: q7 --tree <dir> --out <file> --mode time|count [--runs N (default 15)] [--repeats N (default 3)] [--set s] [--label name] [--base-sha <40 hex>] [--scratch <dir>]',
  report: 'usage: report --counts <file> --measurements <dir> [--s1 <file> --s2 <file>] (the timing files are optional only when the counts file says premise_failed true)',
  'freq-tables': 'usage: freq-tables --freq <file> [--s1 <file> --s2 <file> --counts <file>]',
};
const FLAGS = {
  tree: 1, out: 1, mode: 1, runs: 1, repeats: 1, set: 1, label: 1, 'base-sha': 1, scratch: 1,
  s1: 1, s2: 1, counts: 1, measurements: 1, freq: 1,
  'skip-gates': 'bool', 'allow-short': 'bool',
};

function parseFlags(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) { o._.push(a); continue; }
    const key = a.slice(2);
    const s = FLAGS[key];
    if (s === undefined) throw new Error('unknown argument: ' + a);
    if (s === 'bool') { o[key] = true; continue; }
    i += 1;
    if (argv[i] === undefined) throw new Error('missing value for ' + a);
    o[key] = argv[i];
  }
  return o;
}

function log(msg) { process.stderr.write('[q7] ' + msg + '\n'); }
function r3(x) { return Math.round(x * 1000) / 1000; }

// ---------------------------------------------------------------------------
// pure rules (tested by the check file)
// ---------------------------------------------------------------------------

// R4: cost per session = W x cost per Write; noise = W x (spread percent / 100 x cost per Write).
function project(perWriteMs, writes, spreadPercent) {
  return { projected_ms: r3(writes * perWriteMs), noise_ms: r3(writes * ((spreadPercent / 100) * perWriteMs)) };
}

// OD-2: a cost above 50 ms meets the floor; 50 ms itself does not.
function meetsFloor(ms) { return typeof ms === 'number' && ms > FLOOR_MS; }

// R5: the lower bound class of a Write row of plan 384-04 or 384-05.
function classifyWriteRow(o) {
  if (o.independent === true) return 'NOT A LOWER BOUND';
  if (o.identityIsRoomMd === true && o.identitySkipped === true) return o.pairReading === 'PASS' ? 'LOWER BOUND' : 'NOT A LOWER BOUND';
  return 'UNVERIFIED';
}

// R3 part P-a: the cascade call is skipped false on the artifact and skipped true on the identity file, in all repeats.
function cascadeGate(cs) {
  const reasons = [];
  const a = cs && cs.rooms_artifact;
  const i = cs && cs.rooms_identity;
  const okArtifact = !!a && a.skipped_true === 0 && (a.skipped_false === undefined || a.skipped_false === a.repeats);
  const okIdentity = !!i && i.skipped_true === i.repeats && i.repeats > 0;
  if (!okArtifact) reasons.push('artifact cascade call was not skipped false in every repeat');
  if (!okIdentity) reasons.push('identity cascade call was not skipped true in every repeat');
  return reasons;
}

// R3: both parts. P-b: the lowest node starts and the lowest module count of the artifact target are each above the highest of the identity target.
function premiseGate(counts) {
  const reasons = cascadeGate(counts && counts.cascade_skip);
  const ev = (counts && counts.events) || {};
  const a = ev.rooms_artifact;
  const i = ev.rooms_identity;
  const lo = (x) => Math.min.apply(null, x);
  const hi = (x) => Math.max.apply(null, x);
  const have = (e, k) => !!e && Array.isArray(e[k]) && e[k].length > 0;
  if (!have(a, 'node_starts') || !have(i, 'node_starts') || !(lo(a.node_starts) > hi(i.node_starts))) reasons.push('artifact node starts are not above identity node starts');
  if (!have(a, 'modules') || !have(i, 'modules') || !(lo(a.modules) > hi(i.modules))) reasons.push('artifact modules are not above identity modules');
  return { ok: reasons.length === 0, reasons };
}

function span(arr) {
  const a = (arr || []).filter((x) => typeof x === 'number');
  if (!a.length) return 'NOT MEASURED';
  const lo = Math.min.apply(null, a);
  const hi = Math.max.apply(null, a);
  return lo === hi ? String(lo) : lo + ' to ' + hi;
}

// ---------------------------------------------------------------------------
// targets and runs
// ---------------------------------------------------------------------------
function usageError(msg) { return Object.assign(new Error(msg), { exitCode: 2 }); }

// The four targets. A and A2 use two different artifact files of the same room, so that the content of the file of A does
// not change between rounds. A2 appends one text line to its file before every event (changed content).
function q7Targets(S) {
  const ctxR = S.ctxR;
  const art1 = ctxR.touchTarget;
  const art2 = eligibleMd(ctxR.roomDir).find((x) => x !== art1);
  const idf = S.origTouchR;
  if (!art1 || !art2) throw new Error('the harness room needs two artifact files');
  if (!idf) throw new Error('the harness room has no identity file target');
  let n = 0;
  const at = (ctx, file) => Object.assign({}, ctx, { touchTarget: file });
  return {
    A: { key: 'A', id: TIME_IDS.A, ctx: at(ctxR, art1), file: art1 },
    A2: { key: 'A2', id: TIME_IDS.A2, ctx: at(ctxR, art2), file: art2, beforeRun: () => { n += 1; fs.appendFileSync(art2, 'Measurement line ' + n + '.\n'); } },
    I: { key: 'I', id: TIME_IDS.I, ctx: at(ctxR, idf), file: idf },
    D: { key: 'D', id: TIME_IDS.D, ctx: at(S.ctxD, S.ctxD.touchTarget), file: S.ctxD.touchTarget },
  };
}

// The cascade call as scripts/post-write runs it, repeated. Only the booleans and the constant skip reason are kept.
function cascadeRepeats(S, ctx, repeats, forceSkipped) {
  const res = [];
  for (let k = 0; k < repeats; k += 1) {
    const spec = forceSkipped
      ? { argv: [process.execPath, '-e', 'console.log(JSON.stringify({ skipped: true, skipReason: "forced for the check" }))'] }
      : T.cascadeSpec(ctx, S.tree);
    res.push(T.cascadeSkipCheck(spec));
  }
  return {
    repeats,
    skipped_true: res.filter((x) => x.skipped === true).length,
    skipped_false: res.filter((x) => x.skipped === false).length,
    skip_reason: res[0].skipReason,
    repeats_agree: T.allEqual(res.map((x) => [x.skipped, x.skipReason])),
  };
}

function cascadeChecks(S, tg, repeats, force) {
  return {
    rooms_artifact: cascadeRepeats(S, tg.A.ctx, repeats, force),
    rooms_identity: cascadeRepeats(S, tg.I.ctx, repeats, false),
    default_artifact: cascadeRepeats(S, tg.D.ctx, repeats, false),
    rooms_artifact_changed: cascadeRepeats(S, tg.A2.ctx, repeats, false),
  };
}

function forceFail() { return process.env.MOS_PERF_SELFTEST === '1' && process.env.MOS_Q7_TEST_GATE === 'fail'; }

async function countedEvent(S, t, tag, k) {
  const def = H.targetDef(WRITE_DEF_ID);
  if (!S.skipGates) await H.gateBeforeTarget({ maxMs: 900000 });
  const cl = path.join(t.ctx.sandbox.tmp, 'q7-count-' + tag + '-' + k + '.log');
  fs.rmSync(cl, { force: true });
  const s = await H.runEventOnce(def, t.ctx, { extraEnv: T.countEnv(cl), settleMs: 120000, beforeRun: t.beforeRun });
  const lines = T.readLines(cl);
  return { starts: lines.length, modules: lines.reduce((a, l) => a + l.modules, 0), survivors: s.survivors_left || 0 };
}

async function cmdCount(f) {
  const repeats = parseInt(f.repeats || '3', 10);
  const S = await T.t04Setup(f);
  try {
    const tg = q7Targets(S);
    const cs = cascadeChecks(S, tg, repeats, forceFail());
    await S.gate();
    const events = {};
    for (const k of ['A', 'A2', 'I', 'D']) {
      await countedEvent(S, tg[k], KEY_OF[k] + '-warm', 99); // one untimed run first
      const starts = []; const mods = []; const surv = [];
      for (let r = 0; r < repeats; r += 1) {
        const c = await countedEvent(S, tg[k], KEY_OF[k], r);
        starts.push(c.starts); mods.push(c.modules); surv.push(c.survivors);
      }
      events[KEY_OF[k]] = { node_starts: starts, modules: mods, survivors_left: surv, repeats_agree: T.allEqual(starts) && T.allEqual(mods) };
    }
    const layouts = {};
    for (const k of ['A', 'A2', 'I', 'D']) layouts[KEY_OF[k]] = T.layoutOf(tg[k].file);
    const body = {
      task: 'q7',
      identity_target_is_room_md: path.basename(S.origTouchR) === 'ROOM.md',
      cascade_skip: cs,
      events,
      layouts,
      repeats,
    };
    const gate = premiseGate(body);
    body.premise_failed = !gate.ok;
    body.premise_reasons = gate.reasons;
    T.writeOut(S, f.out, H.COUNTS_SCHEMA, body);
    log('q7 counts written, premise ' + (gate.ok ? 'passed' : 'failed'));
    return 0;
  } finally { S.cleanup(); }
}

function perHookRows(hookMap) {
  return [...hookMap.entries()].map(([id, v]) => ({ id, async: v.async, wall_ms: T.fineStats(v.wall).median, cpu_ms: T.fineStats(v.cpu).median }));
}

async function cmdTime(f) {
  const S = await T.t04Setup(f);
  try {
    const tg = q7Targets(S);
    // premise gate part P-a again: refuse to time when it fails
    const cs = { rooms_artifact: cascadeRepeats(S, tg.A.ctx, 3, forceFail()), rooms_identity: cascadeRepeats(S, tg.I.ctx, 3, false) };
    const reasons = cascadeGate(cs);
    if (reasons.length) throw new Error('premise failed: ' + reasons.join('; '));
    const def = H.targetDef(WRITE_DEF_ID);
    const runOne = (t) => H.runEventOnce(def, t.ctx, { settleMs: 120000, beforeRun: t.beforeRun });
    const order = ['A', 'A2', 'I', 'D'];
    for (const k of order) await runOne(tg[k]); // one untimed warm-up per target
    const gate = await S.gate();
    const accs = {};
    const hooks = {};
    for (const k of order) { accs[k] = T.newAcc(tg[k].id); hooks[k] = new Map(); }
    const diffs = { 'artifact-minus-identity': [], 'changed-minus-identity': [], 'changed-minus-artifact': [], 'rooms-minus-default': [] };
    for (let i = 0; i < S.runs; i += 1) {
      const got = {};
      for (const k of T.rotated(order, i)) {
        const s = await runOne(tg[k]);
        if (T.addSample(accs[k], s)) {
          got[k] = s.wall_ms;
          for (const h of s.hooks || []) {
            if (typeof h.cpu_ms !== 'number' || typeof h.wall_ms !== 'number') continue;
            if (!hooks[k].has(h.id)) hooks[k].set(h.id, { async: !!h.async, wall: [], cpu: [] });
            hooks[k].get(h.id).wall.push(h.wall_ms);
            hooks[k].get(h.id).cpu.push(h.cpu_ms);
          }
        }
      }
      const d = (x, y, name) => { if (got[x] !== undefined && got[y] !== undefined) diffs[name].push(got[x] - got[y]); };
      d('A', 'I', 'artifact-minus-identity');
      d('A2', 'I', 'changed-minus-identity');
      d('A2', 'A', 'changed-minus-artifact');
      d('A', 'D', 'rooms-minus-default');
    }
    const targets = [];
    for (const k of order) {
      accs[k].extra.per_hook = perHookRows(hooks[k]);
      accs[k].extra.rounds_ms = accs[k].wall.map(r3);
      targets.push(T.toTarget(accs[k], gate));
    }
    const how = {
      'artifact-minus-identity': 'per-round Write event on the artifact minus the Write event on the identity file (harness layout)',
      'changed-minus-identity': 'per-round Write event on the changed artifact minus the Write event on the identity file (harness layout)',
      'changed-minus-artifact': 'per-round Write event on the changed artifact minus the Write event on the artifact (harness layout)',
      'rooms-minus-default': 'per-round Write event on the artifact on the harness layout minus the Write event on the artifact on the default layout',
    };
    for (const name of Object.keys(diffs)) targets.push(T.derivedTarget('q7:d:' + name, diffs[name], gate, how[name]));
    const layouts = {};
    for (const k of order) layouts[KEY_OF[k]] = T.layoutOf(tg[k].file);
    T.writeOut(S, f.out, H.SCHEMA, { task: 'q7', identity_target_is_room_md: path.basename(S.origTouchR) === 'ROOM.md', layouts, targets });
    const med = (id) => targets.find((x) => x.id === id).wall_ms_fine.median;
    log('q7 artifact ' + med(TIME_IDS.A) + ' ms, changed ' + med(TIME_IDS.A2) + ' ms, identity ' + med(TIME_IDS.I) + ' ms, default ' + med(TIME_IDS.D) + ' ms');
    return 0;
  } finally { S.cleanup(); }
}

// ---------------------------------------------------------------------------
// report helpers
// ---------------------------------------------------------------------------
function readJsonFile(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function readJsonOrNull(file) { try { return file && fs.existsSync(file) ? readJsonFile(file) : null; } catch (_e) { return null; } }

const PAIRS_Q7 = [
  { key: 'q7-a', label: 'Q7-a: artifact above identity file (harness layout)', x: TIME_IDS.A, y: TIME_IDS.I, d: 'q7:d:artifact-minus-identity' },
  { key: 'q7-b', label: 'Q7-b: changed artifact above identity file (harness layout)', x: TIME_IDS.A2, y: TIME_IDS.I, d: 'q7:d:changed-minus-identity' },
  { key: 'q7-c', label: 'Q7-c: changed artifact above unchanged artifact (no direction fixed, harness layout)', x: TIME_IDS.A2, y: TIME_IDS.A, d: 'q7:d:changed-minus-artifact' },
  { key: 'q7-d', label: 'Q7-d: artifact on the harness layout above artifact on the default layout', x: TIME_IDS.A, y: TIME_IDS.D, d: 'q7:d:rooms-minus-default' },
];

function wallMedian(file, id) { const w = file ? T.wallOf(T.tgt(file, id)) : null; return w && typeof w.median === 'number' ? w.median : null; }
function cpuStats(file, id) { const t = file ? T.tgt(file, id) : null; return t && t.cpu_ms && typeof t.cpu_ms.median === 'number' ? t.cpu_ms : null; }
function mean2(a, b) { return typeof a === 'number' && typeof b === 'number' ? (a + b) / 2 : null; }
function yesNo(ms) { return meetsFloor(ms) ? 'yes' : 'no'; }

// median cost per Write (mean of the two set medians) and the spread of the two set medians, for wall or CPU
function perWrite(s1, s2, id, kind) {
  const m1 = kind === 'cpu' ? (cpuStats(s1, id) || {}).median : wallMedian(s1, id);
  const m2 = kind === 'cpu' ? (cpuStats(s2, id) || {}).median : wallMedian(s2, id);
  if (typeof m1 !== 'number' || typeof m2 !== 'number') return null;
  return { median: mean2(m1, m2), spread: T.spreadOf(m1, m2), m1, m2 };
}

function q7Premise(counts) {
  const lines = [];
  const cs = counts.cascade_skip || {};
  const ev = counts.events || {};
  lines.push('', 'Table Q7-1: premise gates and counts (3 repeats, harness layout unless the row says default layout)', '', T.row(['Quantity', 'value', 'Basis']), T.row(['---', '---', '---']));
  const casc = (label, o, expect) => {
    if (!o) { lines.push(T.row([label, 'NOT MEASURED', 'NOT MEASURED (no count on file)'])); return; }
    lines.push(T.row([label + ': skipped true in ' + o.skipped_true + ' of ' + o.repeats + ' repeats (claim ' + expect + '), reason ' + o.skip_reason, String(o.repeats_agree), 'DIRECT']));
  };
  casc('P-a cascade call on the artifact', cs.rooms_artifact, '0');
  casc('P-a cascade call on the identity file', cs.rooms_identity, 'all');
  casc('cascade call on the artifact, default layout (information)', cs.default_artifact, 'all');
  casc('cascade call on the second artifact used by the changed target (information)', cs.rooms_artifact_changed, '0');
  lines.push(T.row(['the file that findTouchTarget returns for the harness room is the identity file ROOM.md', String(counts.identity_target_is_room_md), 'DIRECT']));
  for (const k of ['A', 'A2', 'I', 'D']) {
    const e = ev[KEY_OF[k]];
    if (!e) { lines.push(T.row(['P-b Write event, ' + NAME_OF[k], 'NOT MEASURED', 'NOT MEASURED (no count on file)'])); continue; }
    lines.push(T.row(['P-b Write event, ' + NAME_OF[k] + ': node starts, modules, survivors left, repeats agree', span(e.node_starts) + ' starts, ' + span(e.modules) + ' modules, ' + span(e.survivors_left) + ' survivors, ' + String(e.repeats_agree), 'DIRECT']));
  }
  const lay = counts.layouts || {};
  for (const k of ['A', 'D']) {
    const l = lay[KEY_OF[k]];
    if (l) lines.push(T.row(['path of the file, ' + NAME_OF[k] + ': holds /room/ and holds /rooms/', String(l.has_room_segment) + ' and ' + String(l.has_rooms_segment), 'DIRECT']));
  }
  const g = premiseGate(counts);
  lines.push(T.row(['premise failed (flag in the counts file)', String(counts.premise_failed === true), 'DIRECT']));
  lines.push(T.row(['premise gate by R3 (P-a and P-b)', g.ok ? 'PASSED' : 'PREMISE FAILED: ' + g.reasons.join('; '), 'DERIVED']));
  return lines;
}

function q7Tables(s1, s2) {
  const lines = [];
  lines.push(...T.targetTable(s1, s2, 'Table Q7-2: every target (n per set, wall median, p95, two sets, spread)'));
  lines.push('', 'Table Q7-2b: summed hook CPU per Write target (ms)', '', T.row(['Target', 'n per set', 'set 1 median ms', 'set 1 p95 ms', 'set 2 median ms', 'set 2 p95 ms', 'spread percent', 'Basis']), T.row(['---', '---', '---', '---', '---', '---', '---', '---']));
  for (const k of ['A', 'A2', 'I', 'D']) {
    const id = TIME_IDS[k];
    const c1 = cpuStats(s1, id);
    const c2 = cpuStats(s2, id);
    const t1 = T.tgt(s1, id);
    const t2 = T.tgt(s2, id);
    lines.push(T.row([id, t1 && t2 ? t1.n + ' and ' + t2.n : 'NOT MEASURED', c1 ? T.fmt(c1.median) : 'NOT MEASURED', c1 ? T.fmt(c1.p95) : 'NOT MEASURED', c2 ? T.fmt(c2.median) : 'NOT MEASURED', c2 ? T.fmt(c2.p95) : 'NOT MEASURED', c1 && c2 ? T.fmt(T.spreadOf(c1.median, c2.median)) : 'NOT MEASURED', c1 && c2 ? 'DIRECT' : 'NOT MEASURED (no CPU on file)']));
  }
  lines.push('', 'Table Q7-2c: per hook medians of the artifact target and the identity target (set 1, wall ms and CPU ms of each hook)', '', T.row(['Target', 'hook id', 'wall median ms', 'CPU median ms', 'Basis']), T.row(['---', '---', '---', '---', '---']));
  for (const k of ['A', 'I']) {
    const t = T.tgt(s1, TIME_IDS[k]);
    const ph = t && Array.isArray(t.per_hook) ? t.per_hook : [];
    if (!ph.length) lines.push(T.row([TIME_IDS[k], 'NOT MEASURED', 'NOT MEASURED', 'NOT MEASURED', 'NOT MEASURED (no per_hook on file)']));
    for (const h of ph) lines.push(T.row([TIME_IDS[k], String(h.id), T.fmt(h.wall_ms), T.fmt(h.cpu_ms), 'DIRECT']));
  }
  // Table Q7-3: the pair readings by R2
  const pr = T.pairReadings(s1, s2, PAIRS_Q7);
  lines.push('', 'Table Q7-3: pair readings by R2 (harness layout unless the row says default layout)', '', T.row(['Pair', 'd(1) ms', 'd(2) ms', 'noise ms', '2 x noise ms', 'reading', 'meets floor', 'Basis']), T.row(['---', '---', '---', '---', '---', '---', '---', '---']));
  for (const r of pr) {
    const mf = r.d1 === null ? 'NOT MEASURED' : (meetsFloor(r.d1) && meetsFloor(r.d2) ? 'yes' : 'no');
    lines.push(T.row([r.label, T.fmt(r.d1), T.fmt(r.d2), T.fmt(r.noise), r.noise === null ? 'NOT MEASURED' : T.fmt(2 * r.noise), r.reading, mf, r.d1 === null ? 'NOT MEASURED (no timing on file)' : 'DERIVED']));
  }
  lines.push('', 'Table Q7-3b: summed hook CPU medians and the CPU difference of set medians (no rule)', '', T.row(['Quantity', 'set 1 ms', 'set 2 ms', 'Basis']), T.row(['---', '---', '---', '---']));
  const cm = (s, k) => { const c = cpuStats(s, TIME_IDS[k]); return c ? c.median : null; };
  for (const k of ['A', 'A2', 'I', 'D']) lines.push(T.row(['CPU median, ' + NAME_OF[k], T.fmt(cm(s1, k)), T.fmt(cm(s2, k)), cm(s1, k) === null || cm(s2, k) === null ? 'NOT MEASURED (no CPU on file)' : 'DIRECT']));
  const dd = (s, x, y) => (cm(s, x) === null || cm(s, y) === null ? null : cm(s, x) - cm(s, y));
  lines.push(T.row(['CPU difference of set medians, artifact minus identity file', T.fmt(dd(s1, 'A', 'I')), T.fmt(dd(s2, 'A', 'I')), dd(s1, 'A', 'I') === null ? 'NOT MEASURED (no CPU on file)' : 'DERIVED']));
  lines.push(T.row(['CPU difference of set medians, artifact on the harness layout minus artifact on the default layout', T.fmt(dd(s1, 'A', 'D')), T.fmt(dd(s2, 'A', 'D')), dd(s1, 'A', 'D') === null ? 'NOT MEASURED (no CPU on file)' : 'DERIVED']));
  // Table Q7-4: projection per session
  lines.push('', 'Table Q7-4: cost per session at W Writes (W is ASSUMED; cost per Write is the mean of the two set medians; noise is W x spread; meets floor is the OD-2 floor of ' + FLOOR_MS + ' ms per Write)', '',
    T.row(['Target', 'W (ASSUMED)', 'wall per Write ms', 'wall per session ms', 'wall noise ms', 'wall meets floor', 'CPU per Write ms', 'CPU per session ms', 'CPU noise ms', 'CPU meets floor', 'Basis']),
    T.row(['---', '---', '---', '---', '---', '---', '---', '---', '---', '---', '---']));
  for (const k of ['A', 'A2', 'I', 'D']) {
    const w = perWrite(s1, s2, TIME_IDS[k], 'wall');
    const c = perWrite(s1, s2, TIME_IDS[k], 'cpu');
    for (const W of WRITES) {
      const pw = w ? project(w.median, W, w.spread) : null;
      const pc = c ? project(c.median, W, c.spread) : null;
      lines.push(T.row([TIME_IDS[k], String(W), w ? T.fmt(w.median) : 'NOT MEASURED', pw ? T.fmt(pw.projected_ms) : 'NOT MEASURED', pw ? T.fmt(pw.noise_ms) : 'NOT MEASURED', w ? yesNo(w.median) : 'NOT MEASURED', c ? T.fmt(c.median) : 'NOT MEASURED', pc ? T.fmt(pc.projected_ms) : 'NOT MEASURED', pc ? T.fmt(pc.noise_ms) : 'NOT MEASURED', c ? yesNo(c.median) : 'NOT MEASURED', w && c ? 'DERIVED (W ASSUMED)' : 'NOT MEASURED (no timing on file)']));
    }
  }
  // Table Q7-5: the S2 sum
  const carried = CARRIED.reduce((a, c) => a + c.cpu_ms * c.events, 0);
  lines.push('', 'Table Q7-5: S2 sum of the four events per session (R4; carried CPU per event is Stop 1500 ms x 30, UserPromptSubmit 240 ms x 30, Read 40 ms x 60, ASSUMED events, not re-measured here)', '',
    T.row(['Layout', 'W (ASSUMED)', 'carried CPU ms', 'Write CPU per Write ms', 'Write term ms', 'S2 sum ms', 'Write term noise ms', 'Basis']), T.row(['---', '---', '---', '---', '---', '---', '---', '---']));
  for (const [k, label] of [['A', 'harness layout, artifact (A)'], ['D', 'default layout, artifact (D)']]) {
    const c = perWrite(s1, s2, TIME_IDS[k], 'cpu');
    for (const W of WRITES) {
      const p = c ? project(c.median, W, c.spread) : null;
      lines.push(T.row([label, String(W), T.fmt(carried), c ? T.fmt(c.median) : 'NOT MEASURED', p ? T.fmt(p.projected_ms) : 'NOT MEASURED', p ? T.fmt(r3(carried + p.projected_ms)) : 'NOT MEASURED', p ? T.fmt(p.noise_ms) : 'NOT MEASURED', p ? 'DERIVED (W ASSUMED)' : 'NOT MEASURED (no CPU on file)']));
    }
  }
  lines.push(T.row(['S2 row of 384-RANKING.md (fixture, Write CPU 425 ms, W = 20)', '20', T.fmt(carried), '425', '8500', String(RANKING_S2_TOTAL), 'not carried', 'DIRECT (copied from 384-RANKING.md)']));
  return lines;
}

// ---------------------------------------------------------------------------
// Q7-6: the Write rows of plans 384-04 and 384-05 by name
// ---------------------------------------------------------------------------
const SCAN_PREFIX = /^(census-|s5-|s6-|s9-|subagent-files)/;
function planOfFile(name) { return /^(s5-|s6-|s9-)/.test(name) ? '05' : '04'; }

function valueOnFile(node) {
  if (node && node.wall_ms && typeof node.wall_ms.median === 'number') return 'median wall ' + node.wall_ms.median + ' ms' + (typeof node.n === 'number' ? ', n ' + node.n : '');
  if (node && node.exec_total && typeof node.exec_total.median === 'number') return 'exec median ' + node.exec_total.median;
  if (node && typeof node.median_set1 === 'number') return 'set medians ' + node.median_set1 + ' and ' + node.median_set2 + ' ms';
  if (node && typeof node.count === 'number') return 'count ' + node.count;
  if (node && typeof node.wall_ms === 'number') return 'wall ' + node.wall_ms + ' ms';
  return 'listed';
}

function scanWriteRows(dir) {
  const rows = [];
  const seen = new Set();
  const files = fs.readdirSync(dir).filter((n) => /\.json$/.test(n) && SCAN_PREFIX.test(n)).sort();
  for (const name of files) {
    let j = null;
    try { j = readJsonFile(path.join(dir, name)); } catch (_e) { continue; }
    const walk = (node, ctx) => {
      if (Array.isArray(node)) { node.forEach((x) => walk(x, ctx)); return; }
      if (!node || typeof node !== 'object') return;
      const own = ['id', 'key', 'script'].filter((k) => typeof node[k] === 'string' && /write|post-write/i.test(node[k]));
      const touch = Object.prototype.hasOwnProperty.call(node, 'touch_applied') ? node.touch_applied !== null && node.touch_applied !== undefined : ctx.touch;
      for (const k of own) {
        const label = (k === 'script' ? 'script ' : '') + node[k];
        const dedupe = [name, ctx.label, label].join('|');
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        rows.push({ label, parent: ctx.label, file: name, plan: planOfFile(name), value: valueOnFile(node), touch: touch === true, independent: !/PostToolUse:Write/i.test(ctx.label + ' ' + node[k]) });
      }
      const label = typeof node.id === 'string' ? node.id : (typeof node.key === 'string' ? node.key : ctx.label);
      for (const k of Object.keys(node)) walk(node[k], { label, touch });
    };
    walk(j, { label: '', touch: false });
    if (name.startsWith('s6-')) {
      for (const t of j.targets || []) {
        if (typeof t.id === 'string' && t.id.indexOf('script:ledger:') === 0) rows.push({ label: t.id, parent: 'S6 ledger', file: name, plan: '05', value: valueOnFile(t), touch: false, independent: true, ledger: true });
      }
    }
  }
  const tableFile = path.join(dir, 'census-table.md');
  if (fs.existsSync(tableFile)) {
    for (const l of fs.readFileSync(tableFile, 'utf8').split('\n')) {
      if (!l.startsWith('| PostToolUse:Write')) continue;
      const cells = l.split('|').map((c) => c.trim());
      rows.push({ label: 'PostToolUse:Write (table row)', parent: 'census table', file: 'census-table.md', plan: '04', value: [cells[2], cells[3]].filter(Boolean).join(' ; '), touch: false, independent: false });
    }
  }
  return rows;
}

function q7WriteRows(dir, counts, s1, s2) {
  const lines = [];
  const pr = s1 && s2 ? T.pairReadings(s1, s2, [PAIRS_Q7[0]])[0] : null;
  const reading = pr ? pr.reading : 'NOT MEASURED';
  const identitySkipped = !!(counts.cascade_skip && counts.cascade_skip.rooms_identity && counts.cascade_skip.rooms_identity.skipped_true === counts.cascade_skip.rooms_identity.repeats);
  const base = { identityIsRoomMd: counts.identity_target_is_room_md === true, identitySkipped, pairReading: reading };
  lines.push('', 'Table Q7-6: Write rows of plans 384-04 and 384-05 by name and class (R5: reading of artifact above identity is ' + reading + '; identity file is ROOM.md: ' + String(base.identityIsRoomMd) + '; identity cascade skipped: ' + String(identitySkipped) + ')', '',
    T.row(['Row', 'file', 'plan', 'value on file', 'file records the touched file', 'independent of the Write file', 'class', 'Basis']), T.row(['---', '---', '---', '---', '---', '---', '---', '---']));
  const rows = scanWriteRows(dir);
  for (const r of rows) {
    const cls = classifyWriteRow(Object.assign({ independent: r.independent }, base));
    lines.push(T.row([r.label + (r.parent ? ' (in ' + r.parent + ')' : ''), r.file, r.plan, r.value, r.touch ? 'yes' : 'no', String(r.independent), cls, 'DIRECT']));
  }
  for (const [label, value] of [['Felt path row PostToolUse:Write of 384-RANKING.md (stands on the plan 384-04 Write row)', 'set medians 200.0 and 210.0 ms'], ['S2 Write CPU of 384-RANKING.md (stands on the plan 384-04 Write row)', '425 ms CPU per Write']]) {
    lines.push(T.row([label, '384-RANKING.md', '04', value, 'no', 'false', classifyWriteRow(Object.assign({ independent: false }, base)), 'DIRECT']));
  }
  const has05Name = rows.some((r) => r.plan === '05' && !r.ledger);
  lines.push('');
  if (!has05Name) lines.push('Plan 384-05 holds no row named Write or post-write. Its S6 ledger rows (script:ledger) are listed above as the rows that the PRD ties to each Write or Edit; they use a synthetic ledger, so independent is true.');
  lines.push('The result files of plan 384-04 do not record the touched file (touch_applied is null or absent), so a LOWER BOUND class rests on the code path and on the count of this plan. The plan 384-08 copy Write row is not classed (see the Not measured section).');
  return lines;
}

// ---------------------------------------------------------------------------
// Q7-7: reproduction
// ---------------------------------------------------------------------------
function findById(node, id) {
  if (Array.isArray(node)) { for (const x of node) { const r = findById(x, id); if (r) return r; } return null; }
  if (!node || typeof node !== 'object') return null;
  if (node.id === id && typeof node.median_set1 === 'number') return node;
  for (const k of Object.keys(node)) { const r = findById(node[k], id); if (r) return r; }
  return null;
}

function q7Reproduction(s1, s2, dir) {
  const lines = [];
  lines.push('', 'Table Q7-7: reproduction against plan 384-10 (ratio of the target to its t04 median, per set) and against the plan 384-04 Write row (no rule)', '',
    T.row(['Quantity', 'set 1', 'set 2', 'Basis']), T.row(['---', '---', '---', '---']));
  const p1 = readJsonOrNull(path.join(dir, 't04-cascade-skip-s1.json'));
  const p2 = readJsonOrNull(path.join(dir, 't04-cascade-skip-s2.json'));
  const ratio = (num, den) => (typeof num === 'number' && typeof den === 'number' && den !== 0 ? r3(num / den) : null);
  const item = (label, a, b, ok) => lines.push(T.row([label, T.fmt(a), T.fmt(b), a === null || b === null ? 'NOT MEASURED (value missing)' : (ok || 'DERIVED')]));
  item('plan 384-10 t04:write:rooms median ms (harness layout, artifact)', wallMedian(p1, 't04:write:rooms'), wallMedian(p2, 't04:write:rooms'), 'DIRECT');
  item('this plan, artifact on the harness layout (A) median ms', wallMedian(s1, TIME_IDS.A), wallMedian(s2, TIME_IDS.A), 'DIRECT');
  item('ratio of A to plan 384-10 t04:write:rooms', ratio(wallMedian(s1, TIME_IDS.A), wallMedian(p1, 't04:write:rooms')), ratio(wallMedian(s2, TIME_IDS.A), wallMedian(p2, 't04:write:rooms')));
  item('plan 384-10 t04:write:default median ms (default layout, artifact)', wallMedian(p1, 't04:write:default'), wallMedian(p2, 't04:write:default'), 'DIRECT');
  item('this plan, artifact on the default layout (D) median ms', wallMedian(s1, TIME_IDS.D), wallMedian(s2, TIME_IDS.D), 'DIRECT');
  item('ratio of D to plan 384-10 t04:write:default', ratio(wallMedian(s1, TIME_IDS.D), wallMedian(p1, 't04:write:default')), ratio(wallMedian(s2, TIME_IDS.D), wallMedian(p2, 't04:write:default')));
  const sp = readJsonOrNull(path.join(dir, 'census-spread.json'));
  const row04 = sp ? findById(sp, WRITE_DEF_ID) : null;
  item('plan 384-04 Write row median ms (n of 15 per set)', row04 ? row04.median_set1 : null, row04 ? row04.median_set2 : null, 'DIRECT');
  item('this plan, identity file (I) median ms', wallMedian(s1, TIME_IDS.I), wallMedian(s2, TIME_IDS.I), 'DIRECT');
  item('ratio of I to the plan 384-04 Write row of the same set', ratio(wallMedian(s1, TIME_IDS.I), row04 ? row04.median_set1 : null), ratio(wallMedian(s2, TIME_IDS.I), row04 ? row04.median_set2 : null));
  return lines;
}

function cmdReport(f) {
  if (!f.counts || !f.measurements) { process.stderr.write(USAGE.report + '\n'); return 2; }
  const counts = readJsonFile(f.counts);
  const failed = counts.premise_failed === true;
  if (!failed && (!f.s1 || !f.s2)) { process.stderr.write(USAGE.report + '\n'); return 2; }
  const s1 = failed ? null : readJsonFile(f.s1);
  const s2 = failed ? null : readJsonFile(f.s2);
  const lines = [];
  lines.push(...q7Premise(counts));
  if (failed) {
    lines.push('', 'PREMISE FAILED: ' + (Array.isArray(counts.premise_reasons) ? counts.premise_reasons.join('; ') : 'see the counts file') + '. Nothing was timed.');
    lines.push(...q7WriteRows(f.measurements, counts, null, null));
  } else {
    lines.push(...q7Tables(s1, s2));
    lines.push(...q7WriteRows(f.measurements, counts, s1, s2));
    lines.push(...q7Reproduction(s1, s2, f.measurements));
  }
  process.stdout.write(lines.join('\n') + '\n');
  return 0;
}

// ---------------------------------------------------------------------------
// freq-tables: Q8-1 to Q8-3
// ---------------------------------------------------------------------------
function measuredOf(ps, group) {
  if (!ps) return null;
  if (group === 'prompts') return ps.prompts || null;
  return (ps.tool_use && ps.tool_use[group]) || null;
}

function cmdFreqTables(f) {
  if (!f.freq) { process.stderr.write(USAGE['freq-tables'] + '\n'); return 2; }
  const fq = readJsonFile(f.freq);
  const s1 = readJsonOrNull(f.s1);
  const s2 = readJsonOrNull(f.s2);
  const counts = readJsonOrNull(f.counts);
  const ps = fq.per_session || null;
  const lines = [];
  const label = 'development sessions: Claude Code sessions in all project folders on this host, mostly code work, direct session files only (subagent files are not counted)';
  lines.push('', 'Table Q8-1: counts and dates (' + label + ')', '', T.row(['Quantity', 'value', 'Basis']), T.row(['---', '---', '---']));
  const q = (name, v) => lines.push(T.row([name, v === undefined || v === null ? 'NOT MEASURED' : String(v), v === undefined || v === null ? 'NOT MEASURED (not in the frequency file)' : 'DIRECT']));
  q('label', fq.label);
  q('scope', fq.scope);
  q('development sessions counted', fq.sessions);
  q('project folders with at least one session file', fq.project_folders);
  q('unreadable session files (not counted)', fq.unreadable_files);
  const d = fq.dates || {};
  q('first date', d.first);
  q('last date', d.last);
  q('active days', d.active_days);
  q('sessions without a date', d.sessions_without_date);
  for (const m of Object.keys(d.sessions_per_month || {}).sort()) q('development sessions in ' + m, d.sessions_per_month[m]);
  if (fq.totals) {
    q('prompts in all development sessions', fq.totals.prompts);
    for (const g of Object.keys(fq.totals.tool_use || {})) q('tool calls in group ' + g + ' in all development sessions', fq.totals.tool_use[g]);
  }
  for (const a of ASSUMED_FREQ.concat([{ group: 'task' }, { group: 'other' }])) {
    const m = measuredOf(ps, a.group);
    lines.push(T.row([a.group + ' per development session: median and p95', m ? m.median + ' and ' + m.p95 : 'NOT MEASURED', m ? 'DIRECT' : 'NOT MEASURED (no per-session statistics in the frequency file)']));
  }
  const pm = measuredOf(ps, 'prompts');
  lines.push(T.row(['Stop per development session: median (one Stop per prompt, so equal to the prompts median)', pm ? String(pm.median) : 'NOT MEASURED', pm ? 'DERIVED' : 'NOT MEASURED (no per-session statistics)']));

  lines.push('', 'Table Q8-2: measured median per development session against the ASSUMED value of plan 384-09 (R7; a ratio below 0.5 or above 2 is flagged; no pass or fail)', '', T.row(['Group', 'measured median', 'ASSUMED value', 'ratio', 'flag', 'Basis']), T.row(['---', '---', '---', '---', '---', '---']));
  for (const a of ASSUMED_FREQ) {
    const m = measuredOf(ps, a.group);
    if (!m) { lines.push(T.row([a.group, 'NOT MEASURED', String(a.assumed), 'NOT MEASURED', 'NOT MEASURED', 'NOT MEASURED (no per-session statistics)'])); continue; }
    const ratio = r3(m.median / a.assumed);
    const flag = ratio < 0.5 || ratio > 2 ? 'flag' : 'no flag';
    lines.push(T.row([a.group, String(m.median), String(a.assumed), String(ratio), flag, 'DERIVED']));
  }

  const failedPremise = counts && counts.premise_failed === true;
  const writeCpu = (k) => {
    if (failedPremise) return { why: 'the premise gate of Q7 failed, so no Write was timed' };
    if (!s1 || !s2) return { why: 'no timing file of Q7 on file' };
    const c = perWrite(s1, s2, TIME_IDS[k], 'cpu');
    return c ? { cpu: c.median } : { why: 'no CPU on file for the Write target' };
  };
  lines.push('', 'Table Q8-3: S2 CPU per development session at the measured median and p95 of each group (an upper bound for a heavy session, not the p95 of the sum; the write_edit count is an upper bound for Writes inside a room whose path holds /room/ or /rooms/ because it holds every Write, Edit, MultiEdit and NotebookEdit call in any project, R8)', '',
    T.row(['Statistic', 'Layout', 'Stop term ms (1500 x prompts)', 'UserPromptSubmit term ms (240 x prompts)', 'Read term ms (40 x read_grep_glob)', 'Sum of these three ms', 'Write term ms (Write CPU x write_edit)', 'S2 sum ms', 'Basis']),
    T.row(['---', '---', '---', '---', '---', '---', '---', '---', '---']));
  for (const stat of ['median', 'p95']) {
    const pr = measuredOf(ps, 'prompts');
    const rd = measuredOf(ps, 'read_grep_glob');
    const we = measuredOf(ps, 'write_edit');
    for (const [k, layout] of [['A', 'harness layout (A)'], ['D', 'default layout (D)']]) {
      if (!pr || !rd || !we) { lines.push(T.row([stat, layout, 'NOT MEASURED', 'NOT MEASURED', 'NOT MEASURED', 'NOT MEASURED', 'NOT MEASURED', 'NOT MEASURED', 'NOT MEASURED (no per-session statistics)'])); continue; }
      const stop = 1500 * pr[stat];
      const ups = 240 * pr[stat];
      const read = 40 * rd[stat];
      const sum3 = stop + ups + read;
      const w = writeCpu(k);
      if (w.cpu === undefined) {
        lines.push(T.row([stat, layout, T.fmt(stop), T.fmt(ups), T.fmt(read), T.fmt(sum3), 'NOT MEASURED', 'NOT MEASURED', 'DERIVED (Write term NOT MEASURED: ' + w.why + ')']));
      } else {
        const wt = w.cpu * we[stat];
        lines.push(T.row([stat, layout, T.fmt(stop), T.fmt(ups), T.fmt(read), T.fmt(sum3), T.fmt(r3(wt)), T.fmt(r3(sum3 + wt)), 'DERIVED']));
      }
    }
  }
  process.stdout.write(lines.join('\n') + '\n');
  return 0;
}

// ---------------------------------------------------------------------------
async function main(argv) {
  const sub = argv[0];
  if (!sub || !USAGE[sub]) {
    process.stderr.write('usage: q7-write-bench.cjs <q7|report|freq-tables> [...]\n');
    return 2;
  }
  let f;
  try { f = parseFlags(argv.slice(1)); } catch (e) { process.stderr.write(e.message + '\n' + USAGE[sub] + '\n'); return 2; }
  if (sub === 'report') return cmdReport(f);
  if (sub === 'freq-tables') return cmdFreqTables(f);
  if (!f.tree || !f.out) { process.stderr.write(USAGE.q7 + '\n'); return 2; }
  if ((f['skip-gates'] || f['allow-short']) && process.env.MOS_PERF_SELFTEST !== '1') { process.stderr.write('--skip-gates and --allow-short are test-only flags and need MOS_PERF_SELFTEST=1\n'); return 2; }
  if (f.mode !== undefined && f.mode !== 'time' && f.mode !== 'count') { process.stderr.write('--mode accepts time or count only\n'); return 2; }
  if (f.runs === undefined) f.runs = '15';
  try {
    return await (f.mode === 'count' ? cmdCount(f) : cmdTime(f));
  } catch (e) {
    process.stderr.write(String(e && e.message ? e.message : e).replace(/\/[^\s]*/g, '<path>') + '\n');
    return e && Number.isInteger(e.exitCode) ? e.exitCode : 1;
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code), () => { process.stderr.write('q7-write-bench failed\n'); process.exit(1); });
}

module.exports = { main, project, meetsFloor, classifyWriteRow, premiseGate, cascadeGate, scanWriteRows, PAIRS_Q7 };
