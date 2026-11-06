#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Plan 386-39 (E-PROBE): loader for the second audit's probe fixtures in
 * tests/fixtures/386-audit-probes/.
 *
 * The fixture files store no credential shape. A key-shaped string is stored
 * as {"join": [part, part, ...]} and joined here, at run time.
 *
 * Part 8: synthetic rooms only, a temporary HOME, no network. blockNetwork()
 * counts any network attempt.
 *
 * Exports: FIXTURE_DIR, loadProbes, resolveParts, payloadFor, blockNetwork,
 * makeRooms, classifyAll, countRows.
 *
 * Command line:
 *   node tests/helpers/audit-probe-loader.cjs --record <file>
 *        [--root <dir>] [--head <sha>] [--note <text>]
 *   --root points at a folder that holds lib/core and tests/helpers (a git
 *   archive export); the default is this repository. --head overrides the
 *   guard_head written in the header (an export has no .git).
 *
 * The guard and the synthetic room helper are required lazily, after the
 * caller has isolated HOME.
 *
 * No em dash and no en dash anywhere.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FIXTURE_DIR = path.join(__dirname, '..', 'fixtures', '386-audit-probes');

// Turn {join: [parts]} into the joined string, at any depth.
function resolveParts(value) {
  if (Array.isArray(value)) return value.map(resolveParts);
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0] === 'join' && Array.isArray(value.join)) {
      return value.join.map(function (p) { return String(resolveParts(p)); }).join('');
    }
    const out = {};
    keys.forEach(function (k) { out[k] = resolveParts(value[k]); });
    return out;
  }
  return value;
}

function readFixture(dir, name) {
  return resolveParts(JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')));
}

// Returns { p, adv, corpora }, every string resolved, a key on each case.
function loadProbes(dir) {
  const d = dir || FIXTURE_DIR;
  const p = readFixture(d, 'p-cases.json').map(function (c) {
    return Object.assign({}, c, { key: 'P:' + c.id, set: 'P' });
  });
  const adv = readFixture(d, 'adversarial-cases.json').map(function (c) {
    return Object.assign({}, c, { key: 'ADV:' + c.id, set: 'ADV' });
  });
  const corpora = readFixture(d, 'corpora-cases.json').map(function (c) {
    return Object.assign({}, c, { key: 'C:' + c.id, set: 'C' });
  });
  return { p: p, adv: adv, corpora: corpora };
}

function payloadFor(toolName, text) {
  if (toolName === 'brain_search') return { query: text };
  if (toolName === 'brain_query') return { cypher: text };
  return { question: text };
}

// Replace fetch and net.Socket.prototype.connect with throwers that count.
function blockNetwork() {
  const net = require('node:net');
  let calls = 0;
  const savedFetch = globalThis.fetch;
  const savedConnect = net.Socket.prototype.connect;
  globalThis.fetch = function blockedFetch() {
    calls += 1;
    throw new Error('audit probe loader: network is not allowed');
  };
  net.Socket.prototype.connect = function blockedConnect() {
    calls += 1;
    throw new Error('audit probe loader: network is not allowed');
  };
  return {
    count: function () { return calls; },
    restore: function () {
      globalThis.fetch = savedFetch;
      net.Socket.prototype.connect = savedConnect;
    },
  };
}

// roomFor(name) builds a synthetic room on first use. null for no room.
function makeRooms(tempDir, opts) {
  const root = (opts && opts.root) || REPO_ROOT;
  const built = {};
  let helper = null;
  return {
    roomFor: function (name) {
      if (!name) return null;
      if (built[name]) return built[name];
      if (!helper) helper = require(path.join(root, 'tests', 'helpers', 'synthetic-room-db.cjs'));
      const dir = path.join(tempDir, name);
      helper.buildRoom(dir, name);
      built[name] = dir;
      return dir;
    },
  };
}

function rowFor(c, v, room) {
  return {
    key: c.key,
    set: c.set,
    id: c.id,
    group: c.group || null,
    room: room || null,
    verdict: v.verdict,
    class: v.class,
    token_class: v.token_class === undefined ? null : v.token_class,
  };
}

// Classify every case. Optional input: probes (from loadProbes), reset
// (clears the lexicon cache before a case that names a room).
function classifyAll(input) {
  const classify = input.classify;
  const roomFor = input.roomFor;
  const reset = input.reset;
  const probes = input.probes || loadProbes();
  const rows = [];
  probes.p.forEach(function (c) {
    const v = classify(c.payload, { toolName: c.toolName, roomDir: null });
    rows.push(rowFor(c, v, null));
  });
  probes.adv.forEach(function (c) {
    const v = classify({ question: c.text }, { toolName: 'brain_ask', roomDir: null });
    rows.push(rowFor(c, v, null));
  });
  probes.corpora.forEach(function (c) {
    if (c.room && typeof reset === 'function') reset();
    const dir = c.room ? roomFor(c.room) : null;
    const v = classify({ question: c.q }, { toolName: 'brain_ask', roomDir: dir });
    rows.push(rowFor(c, v, c.room));
  });
  return rows;
}

// Tallies in a fixed shape. Key order follows the first appearance in rows.
function countRows(rows) {
  const t = { total: 0, by_verdict: { allow: 0, ambiguous: 0, block: 0 }, by_set: {}, by_group: {} };
  rows.forEach(function (r) {
    t.total += 1;
    t.by_verdict[r.verdict] += 1;
    t.by_set[r.set] = t.by_set[r.set] || { allow: 0, ambiguous: 0, block: 0 };
    t.by_set[r.set][r.verdict] += 1;
    const g = r.group || r.set;
    t.by_group[g] = t.by_group[g] || { allow: 0, ambiguous: 0, block: 0 };
    t.by_group[g][r.verdict] += 1;
  });
  return t;
}

function argValue(args, flag) {
  const i = args.indexOf(flag);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
}

function record(args) {
  const outFile = argValue(args, '--record');
  if (!outFile) {
    console.error('usage: audit-probe-loader.cjs --record <file> [--root <dir>] [--head <sha>] [--note <text>]');
    process.exit(2);
  }
  const root = path.resolve(argValue(args, '--root') || REPO_ROOT);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos386-39-rec-'));
  const home = path.join(tmp, 'home');
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(path.join(tmp, 'registry'), { recursive: true });
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  process.env.MINDRIAN_ROOMS_HOME = path.join(tmp, 'registry');
  delete process.env.CLAUDE_ACTIVE_ROOM;
  delete process.env.TAVILY_API_KEY;
  delete process.env.OPENALEX_API_KEY;
  const net = blockNetwork();
  let head = argValue(args, '--head');
  if (!head) {
    const r = require('node:child_process').spawnSync('git', ['-C', root, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' });
    head = r.status === 0 ? r.stdout.trim() : 'unknown';
  }
  try {
    const guard = require(path.join(root, 'lib', 'core', 'part8-egress-guard.cjs'));
    const lexMod = require(path.join(root, 'lib', 'core', 'part8-room-lexicon.cjs'));
    const rooms = makeRooms(path.join(tmp, 'rooms'), { root: root });
    const rows = classifyAll({ classify: guard.classify, roomFor: rooms.roomFor, reset: lexMod._resetLexiconCache });
    const doc = {
      schema: 1,
      recorded_at: new Date().toISOString(),
      guard_head: head,
      network_calls: net.count(),
      note: argValue(args, '--note') || '',
      counts: countRows(rows),
      rows: rows,
    };
    fs.writeFileSync(outFile, JSON.stringify(doc, null, 2) + '\n', 'utf8');
    console.log('recorded ' + rows.length + ' rows, guard_head ' + head + ', network_calls ' + net.count());
  } finally {
    net.restore();
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
}

module.exports = {
  FIXTURE_DIR: FIXTURE_DIR,
  loadProbes: loadProbes,
  resolveParts: resolveParts,
  payloadFor: payloadFor,
  blockNetwork: blockNetwork,
  makeRooms: makeRooms,
  classifyAll: classifyAll,
  countRows: countRows,
};

if (require.main === module) {
  record(process.argv.slice(2));
}
