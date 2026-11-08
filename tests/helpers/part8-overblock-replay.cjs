#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Plan 392-01 (P0, measure first): the Part 8 over-block replay harness.
 *
 * It replays the 694 audit probe cases of tests/fixtures/386-audit-probes
 * (and, when given, a local real-call sample) through the guard of this
 * repository (lib/core/part8-egress-guard.cjs classify) and records a matrix
 * of COUNTS ONLY: by verdict, set, group, tool, class and token class, plus
 * extended_blocked and must_refuse_blocked.
 *
 * Part 7 (reuse): loadProbes, makeRooms, classifyAll and blockNetwork come
 * from tests/helpers/audit-probe-loader.cjs. This file copies none of them.
 *
 * Part 8 (absolute): the written matrix holds no question text, no room
 * word, no room file name, no credential shape and no Brain identifier.
 * assertMatrixHygiene refuses a string longer than 40 characters, a key in
 * FORBIDDEN_KEYS, and a string that matches a CREDENTIAL_SHAPES pattern
 * (lib/core/cross-room-aggregator.cjs). Real-call rows carry the tool name
 * and the class only; the input text is read, classified and dropped.
 *
 * Exports: replayFixtures, replayRealCalls, buildMatrix, assertMatrixHygiene,
 * assertDocumentHygiene, canonicalInputHash, FORBIDDEN_KEYS, MAX_STRING.
 *
 * Command line:
 *   node tests/helpers/part8-overblock-replay.cjs --record <out.json>
 *        [--real-calls <jsonl>] [--labels <json>] [--guard-head <sha>]
 *        [--note <text>] [--force]
 *   The output holds schema 1, recorded_at, guard_head, recorded_head,
 *   network_calls, note, sources (counts) and the matrix. Never rows.
 *   A committed baseline is never overwritten without --force.
 *
 * No em dash and no en dash anywhere.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const loader = require(path.join(__dirname, 'audit-probe-loader.cjs'));

const FORBIDDEN_KEYS = Object.freeze(['question', 'text', 'cypher', 'query', 'statement', 'payload', 'snippet']);
const MAX_STRING = 40;
const KEY_SHAPE = /^[A-Za-z0-9_:.-]{1,40}$/;
const VERDICTS = ['allow', 'ambiguous', 'block'];
const LABELS = ['legitimate', 'not', 'unknown'];
const DOC_KEYS = Object.freeze(['schema', 'recorded_at', 'guard_head', 'recorded_head', 'network_calls', 'note', 'sources', 'matrix']);

function credentialShapes() {
  return require(path.join(REPO_ROOT, 'lib', 'core', 'cross-room-aggregator.cjs')).CREDENTIAL_SHAPES;
}

// Stable JSON: object keys sorted at every depth.
function canonicalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(function (k) {
      return JSON.stringify(k) + ':' + canonicalJson(value[k]);
    }).join(',') + '}';
  }
  return JSON.stringify(value);
}

// The label key of a real-call input: sha256 of its canonical JSON.
function canonicalInputHash(input) {
  return crypto.createHash('sha256').update(canonicalJson(input === undefined ? null : input)).digest('hex');
}

// Isolate HOME and the room registry, block the network, require the guard
// lazily (the loader's --record does the same). Returns the context and a
// release function.
function isolate() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos392-replay-'));
  const home = path.join(tmp, 'home');
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(path.join(tmp, 'registry'), { recursive: true });
  const saved = {
    HOME: process.env.HOME,
    USERPROFILE: process.env.USERPROFILE,
    MINDRIAN_ROOMS_HOME: process.env.MINDRIAN_ROOMS_HOME,
    CLAUDE_ACTIVE_ROOM: process.env.CLAUDE_ACTIVE_ROOM,
    TAVILY_API_KEY: process.env.TAVILY_API_KEY,
    OPENALEX_API_KEY: process.env.OPENALEX_API_KEY,
  };
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  process.env.MINDRIAN_ROOMS_HOME = path.join(tmp, 'registry');
  delete process.env.CLAUDE_ACTIVE_ROOM;
  delete process.env.TAVILY_API_KEY;
  delete process.env.OPENALEX_API_KEY;
  const net = loader.blockNetwork();
  const guard = require(path.join(REPO_ROOT, 'lib', 'core', 'part8-egress-guard.cjs'));
  const lexMod = require(path.join(REPO_ROOT, 'lib', 'core', 'part8-room-lexicon.cjs'));
  return {
    tmp: tmp,
    net: net,
    guard: guard,
    lexMod: lexMod,
    release: function () {
      net.restore();
      Object.keys(saved).forEach(function (k) {
        if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
      });
      try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    },
  };
}

// key -> tool name, from the probes. P cases name their tool; the other sets
// are brain_ask (the loader classifies them so).
function toolByKey(probes) {
  const map = {};
  probes.p.forEach(function (c) { map[c.key] = c.toolName; });
  probes.adv.forEach(function (c) { map[c.key] = 'brain_ask'; });
  probes.corpora.forEach(function (c) { map[c.key] = 'brain_ask'; });
  return map;
}

function rowOf(key, set, group, tool, v) {
  return {
    key: key,
    set: set,
    group: group,
    tool: tool,
    verdict: v.verdict,
    class: v.class,
    token_class: v.token_class === undefined ? null : v.token_class,
  };
}

// Replay the 694 fixture cases. Returns { rows, network_calls }.
// Each row: key, set, group, tool, verdict, class, token_class.
function replayFixtures(opts) {
  const o = opts || {};
  const ctx = isolate();
  try {
    const probes = loader.loadProbes(o.fixtureDir);
    const tools = toolByKey(probes);
    const rooms = loader.makeRooms(path.join(ctx.tmp, 'rooms'), REPO_ROOT);
    const raw = loader.classifyAll({
      classify: ctx.guard.classify,
      roomFor: rooms.roomFor,
      reset: ctx.lexMod._resetLexiconCache,
      probes: probes,
    });
    const rows = raw.map(function (r) {
      return rowOf(r.key, r.set, r.group || r.set, tools[r.key] || 'brain_ask', r);
    });
    return { rows: rows, network_calls: ctx.net.count() };
  } finally {
    ctx.release();
  }
}

// Read a labels map {sha256(canonical input): legitimate|not|unknown}.
function readLabels(labelsPath) {
  if (!labelsPath) return {};
  const parsed = JSON.parse(fs.readFileSync(labelsPath, 'utf8'));
  const out = {};
  Object.keys(parsed).forEach(function (k) {
    const v = String(parsed[k]);
    out[k] = LABELS.indexOf(v) >= 0 ? v : 'unknown';
  });
  return out;
}

// Replay a local real-call JSONL file (one {tool, input} per line). Rows
// enter set R with group real_<label>. The input text is never kept.
// Returns { rows, network_calls, blocks, unique_inputs, labels }.
function replayRealCalls(jsonlPath, labelsPath) {
  const labels = readLabels(labelsPath);
  const lines = fs.readFileSync(jsonlPath, 'utf8').split('\n').filter(function (l) { return l.trim().length > 0; });
  const ctx = isolate();
  try {
    const rows = [];
    const seen = {};
    const labelCount = { legitimate: 0, not: 0, unknown: 0 };
    lines.forEach(function (line, i) {
      const rec = JSON.parse(line);
      const tool = String(rec.tool || 'unknown').split('__').pop();
      const hash = canonicalInputHash(rec.input);
      seen[hash] = true;
      const label = labels[hash] || 'unknown';
      labelCount[label] += 1;
      const v = ctx.guard.classify(rec.input, { toolName: tool, roomDir: null });
      rows.push(rowOf('R:' + (i + 1), 'R', 'real_' + label, tool, v));
    });
    return {
      rows: rows,
      network_calls: ctx.net.count(),
      blocks: rows.length,
      unique_inputs: Object.keys(seen).length,
      labels: labelCount,
    };
  } finally {
    ctx.release();
  }
}

function tally(bucket, name, verdict) {
  bucket[name] = bucket[name] || { allow: 0, ambiguous: 0, block: 0 };
  bucket[name][verdict] += 1;
}

// Counts only. Key order follows the first appearance in rows.
function buildMatrix(rows) {
  const m = {
    total: 0,
    by_verdict: { allow: 0, ambiguous: 0, block: 0 },
    by_set: {},
    by_group: {},
    by_tool: {},
    by_class: {},
    by_token_class: {},
    extended_blocked: 0,
    must_refuse_blocked: 0,
  };
  rows.forEach(function (r) {
    if (VERDICTS.indexOf(r.verdict) < 0) throw new Error('unknown verdict ' + r.verdict);
    m.total += 1;
    m.by_verdict[r.verdict] += 1;
    tally(m.by_set, r.set, r.verdict);
    tally(m.by_group, r.group || r.set, r.verdict);
    tally(m.by_tool, r.tool, r.verdict);
    tally(m.by_class, r.class || 'none', r.verdict);
    tally(m.by_token_class, r.token_class === null || r.token_class === undefined ? 'none' : String(r.token_class), r.verdict);
    if (r.verdict === 'block' && r.group === 'extended') m.extended_blocked += 1;
    if (r.verdict === 'block' && r.group === 'must_refuse') m.must_refuse_blocked += 1;
  });
  return m;
}

function checkString(s, where, shapes) {
  if (s.length > MAX_STRING) throw new Error('matrix hygiene: string longer than ' + MAX_STRING + ' characters at ' + where);
  for (let i = 0; i < shapes.length; i += 1) {
    if (shapes[i].test(s)) throw new Error('matrix hygiene: credential shape at ' + where);
  }
}

function walk(value, where, shapes) {
  if (typeof value === 'string') { checkString(value, where, shapes); return; }
  if (Array.isArray(value)) { value.forEach(function (v, i) { walk(v, where + '[' + i + ']', shapes); }); return; }
  if (value !== null && typeof value === 'object') {
    Object.keys(value).forEach(function (k) {
      if (FORBIDDEN_KEYS.indexOf(k.toLowerCase()) >= 0) throw new Error('matrix hygiene: forbidden key ' + k + ' at ' + where);
      if (!KEY_SHAPE.test(k)) throw new Error('matrix hygiene: key shape refused at ' + where + '.' + k.slice(0, 12));
      checkString(k, where + '.' + k, shapes);
      walk(value[k], where + '.' + k, shapes);
    });
  }
}

// Throws on a long string, a forbidden or odd key, or a credential shape.
function assertMatrixHygiene(matrix) {
  if (matrix === null || typeof matrix !== 'object' || Array.isArray(matrix)) throw new Error('matrix hygiene: matrix is not an object');
  walk(matrix, 'matrix', credentialShapes());
  return true;
}

// The whole record: a fixed key set, a bounded note, no rows, a clean matrix.
function assertDocumentHygiene(doc) {
  if (doc === null || typeof doc !== 'object') throw new Error('document hygiene: not an object');
  Object.keys(doc).forEach(function (k) {
    if (DOC_KEYS.indexOf(k) < 0) throw new Error('document hygiene: unexpected key ' + k);
  });
  if (doc.schema !== 1) throw new Error('document hygiene: schema must be 1');
  if (!/^[0-9a-f]{7,12}$/.test(String(doc.guard_head))) throw new Error('document hygiene: guard_head is not a short sha');
  if (typeof doc.network_calls !== 'number') throw new Error('document hygiene: network_calls missing');
  const note = String(doc.note || '');
  if (note.length > 160) throw new Error('document hygiene: note longer than 160 characters');
  const shapes = credentialShapes();
  shapes.forEach(function (re) { if (re.test(note)) throw new Error('document hygiene: credential shape in note'); });
  if (doc.sources) walk(doc.sources, 'sources', shapes);
  assertMatrixHygiene(doc.matrix);
  return true;
}

function argValue(args, flag) {
  const i = args.indexOf(flag);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
}

function headOfRepo() {
  const r = require('node:child_process').spawnSync('git', ['-C', REPO_ROOT, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : 'unknown';
}

function record(args) {
  const outFile = argValue(args, '--record');
  if (!outFile) {
    console.error('usage: part8-overblock-replay.cjs --record <out.json> [--real-calls <jsonl>] [--labels <json>] [--guard-head <sha>] [--note <text>] [--force]');
    process.exit(2);
  }
  if (fs.existsSync(outFile) && /^baseline-/.test(path.basename(outFile)) && args.indexOf('--force') < 0) {
    console.error('refused: ' + path.basename(outFile) + ' exists; a committed baseline is never overwritten (use a new name, or --force)');
    process.exit(2);
  }
  const recordedHead = headOfRepo();
  const fx = replayFixtures();
  let rows = fx.rows;
  let network = fx.network_calls;
  const sources = { fixtures: { cases: fx.rows.length } };
  const realPath = argValue(args, '--real-calls');
  if (realPath) {
    const rc = replayRealCalls(realPath, argValue(args, '--labels'));
    rows = rows.concat(rc.rows);
    network += rc.network_calls;
    sources.real_calls = { blocks: rc.blocks, unique_inputs: rc.unique_inputs, labels: rc.labels };
  }
  const doc = {
    schema: 1,
    recorded_at: new Date().toISOString(),
    guard_head: argValue(args, '--guard-head') || recordedHead,
    recorded_head: recordedHead,
    network_calls: network,
    note: argValue(args, '--note') || '',
    sources: sources,
    matrix: buildMatrix(rows),
  };
  assertDocumentHygiene(doc);
  fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  console.log('recorded ' + rows.length + ' rows (' + fx.rows.length + ' fixture' + (realPath ? ', ' + (rows.length - fx.rows.length) + ' real-call' : '') + '), guard_head ' + doc.guard_head + ', recorded_head ' + recordedHead + ', network_calls ' + network);
  console.log('extended_blocked ' + doc.matrix.extended_blocked + ' of 535, must_refuse_blocked ' + doc.matrix.must_refuse_blocked + ' of 10');
}

module.exports = {
  FORBIDDEN_KEYS: FORBIDDEN_KEYS,
  MAX_STRING: MAX_STRING,
  canonicalInputHash: canonicalInputHash,
  replayFixtures: replayFixtures,
  replayRealCalls: replayRealCalls,
  buildMatrix: buildMatrix,
  assertMatrixHygiene: assertMatrixHygiene,
  assertDocumentHygiene: assertDocumentHygiene,
};

if (require.main === module) {
  record(process.argv.slice(2));
}
