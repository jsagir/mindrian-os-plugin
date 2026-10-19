#!/usr/bin/env node
'use strict';

/*
 * tests/test-372-omitted.cjs -- Phase 372 plan 02 Task 2.
 *
 * Proves SPEC requirements 1 to 7 for _meta.omitted on getRoomContext and on
 * the context_assemble tool seam (the one seam all three surfaces use).
 *
 * Requirement to leg map:
 *   SPEC 1 (additive omitted list)        R1a R1b R1c R1d
 *   SPEC 2 (existing fields byte-stable)  R2a R2b R2c R2d
 *   SPEC 3 (thrown leg reported)          R3a to R3k, R7e
 *   SPEC 4 (type exclusion reported)      R4a R4b R4c R4d
 *   SPEC 5 (cap reasons honest)           R5a R5b R5c R5d R5e
 *   SPEC 6 (estimate mode reported)       R6a R6b R6c
 *   SPEC 7 (no content, no egress, cost)  R7a R7b R7c R7d R7e
 *
 * Canon Part 8: no Brain call and no network call. The file installs a network
 * guard first and R7c asserts the guard recorded nothing. Only the in-memory
 * fixture, a Proxy seam, a patch seam and one local on-disk room are used.
 *
 * Plain node:assert CJS script (the repo convention, no test framework).
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const dns = require('node:dns');

// ---------------------------------------------------------------------------
// Network guard. Installed before any repo module loads.
// ---------------------------------------------------------------------------
const GUARD_CALLS = [];
function trip(name) {
  return function guarded() {
    GUARD_CALLS.push(name);
    throw new Error('network guard tripped: ' + name);
  };
}
globalThis.fetch = trip('fetch');
http.request = trip('http.request');
http.get = trip('http.get');
https.request = trip('https.request');
https.get = trip('https.get');
net.connect = trip('net.connect');
net.createConnection = trip('net.createConnection');
dns.lookup = trip('dns.lookup');

const REPO_ROOT = path.resolve(__dirname, '..');
const helper = require(path.join(REPO_ROOT, 'tests', 'helpers', 'fixture-room-372.cjs'));
const {
  buildOmissionFixtureDb, GOLDEN_CALLS, NOW_PIN, runGoldenCalls, compareAgainstGolden,
  probeTieStability, RAW_COUNT_DEPTH2, RAW_COUNT_DEPTH1, CHAIN_IN_DEFAULT_TOPK,
  FOCUS_ID, CHAIN_FOCUS_ID, MARKER_PREFIX, GOLDEN_PATH,
  PRE_EXISTING_TOP_KEYS, PRE_EXISTING_META_KEYS,
} = helper;
const { getRoomContext, OMITTED_REASONS } =
  require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'room-context.cjs'));
const { getNeighborhood, NEIGHBORHOOD_SQL } =
  require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'neighborhood.cjs'));
const { CHAIN_STATE_NODE_TYPE } =
  require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'chain-state.cjs'));
const { buildFixtureDb } = require(path.join(REPO_ROOT, 'tests', 'fixtures', 'room-141-fixture.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const { insertNode } = require(path.join(REPO_ROOT, 'lib', 'core', 'node-insert.cjs'));
const contextTool = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'context.cjs'));
const roomMapMod = require(path.join(REPO_ROOT, 'lib', 'core', 'room-map.cjs'));

const ROOM_CONTEXT_PATH = path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'room-context.cjs');
const golden = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8'));
const TOP_K_CAP_ENABLED = golden.tie_probe.stable === true;

const LEGS = ['legA', 'legB', 'legC', 'legD', 'legE'];
const ENTRY_KEYS = ['leg', 'reason', 'count', 'detail'];
const FIXED_DETAILS = ['chain_state', 'top_k', 'fragment_window', 'fragment_char_cap', 'body', 'RoomMapUnreadable'];
const ERROR_CLASS_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,40}$/;
const WIDE_OPTS = { topK: 100, fragmentWindow: 50, fragmentCharCap: 4000, maxDepth: 2, now: NOW_PIN };
const SECRET_TEXTS = ['omit372-secret', 'boom', 'not-json'];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;
const pending = [];
function leg(id, title, fn) {
  pending.push({ id, title, fn });
}
async function runAll() {
  for (const t of pending) {
    try {
      await t.fn();
      passed += 1;
      console.log('ok - ' + t.id + ' ' + t.title);
    } catch (err) {
      failed += 1;
      console.log('FAIL - ' + t.id + ' ' + t.title + ' :: ' + (err && err.message ? err.message : String(err)));
    }
  }
}

// ---------------------------------------------------------------------------
// Shared helpers and the collector for every omitted list seen in this file
// ---------------------------------------------------------------------------
const ALL_OMITTED = []; // { label, list }
function collect(label, result) {
  const list = result && result._meta && result._meta.omitted;
  if (Array.isArray(list)) ALL_OMITTED.push({ label, list });
  return result;
}
async function ctxCall(label, db, opts) {
  return collect(label, await getRoomContext(db, 'room-372', opts));
}
function callOpts(name) {
  return Object.assign({}, GOLDEN_CALLS.find((c) => c.name === name).opts);
}
function findEntry(list, legId, reason) {
  return list.find((e) => e.leg === legId && e.reason === reason);
}
function stripTimings(result) {
  const clone = JSON.parse(JSON.stringify(result));
  if (clone && clone._meta) delete clone._meta.legTimingsMs;
  return clone;
}

// Proxy seam: forwards every property bound to the real db and throws on
// prepare(sql) when shouldThrow(sql) is true. The message holds a secret marker
// so the tests can prove that only the class name reaches the output.
function throwingDb(db, shouldThrow) {
  return new Proxy(db, {
    get(target, prop) {
      const v = target[prop];
      if (prop === 'prepare') {
        return function prepare(sql) {
          if (shouldThrow(String(sql))) throw new TypeError('boom OMIT372-SECRET');
          return target.prepare(sql);
        };
      }
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
}

// Patch seam for the room-map reads of Leg E. Restores in a finally block.
async function withRoomMapPatch(patch, fn) {
  const saved = {};
  for (const k of Object.keys(patch)) saved[k] = roomMapMod[k];
  try {
    for (const k of Object.keys(patch)) roomMapMod[k] = patch[k];
    return await fn();
  } finally {
    for (const k of Object.keys(saved)) roomMapMod[k] = saved[k];
  }
}
const OK_ROOM_MAP = () => ({ ok: true, map: { nodes: [{ path: '.' }] } });

function insertBadPropsNode(db, id) {
  db.prepare(
    'INSERT INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, ' +
    'created_at, last_seen_at, source_section) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, 'section', 'not-json OMIT372-SECRET', 'omit-372', 'system', null, 'proposed', NOW_PIN - 5000, NOW_PIN - 5000, 'omit-372');
}

// The single shared run of the golden call matrix, used by several legs.
let sharedRun = null;
async function getSharedRun() {
  if (!sharedRun) sharedRun = await runGoldenCalls();
  return sharedRun;
}

// One result for each golden call, over one shared omission db (as the helper does).
const G = {};
async function buildGoldenResults() {
  const omissionDb = buildOmissionFixtureDb();
  for (const c of GOLDEN_CALLS) {
    const db = c.build === 'room141' ? buildFixtureDb() : omissionDb;
    G[c.name] = await ctxCall('golden:' + c.name, db, Object.assign({}, c.opts));
  }
  return omissionDb;
}

// ---------------------------------------------------------------------------
// SPEC 1
// ---------------------------------------------------------------------------
leg('R1a', 'every golden call returns a well formed omitted list', async () => {
  for (const name of Object.keys(G)) {
    const list = G[name]._meta.omitted;
    assert.ok(Array.isArray(list), name + ': _meta.omitted must be an array');
    for (const e of list) {
      assert.deepStrictEqual(Object.keys(e), ENTRY_KEYS, name + ': entry keys and order');
      assert.ok(LEGS.indexOf(e.leg) !== -1, name + ': leg ' + e.leg);
      assert.ok(OMITTED_REASONS.indexOf(e.reason) !== -1, name + ': reason ' + e.reason);
      assert.ok(e.count === null || (Number.isInteger(e.count) && e.count > 0), name + ': count ' + e.count);
      assert.equal(typeof e.detail, 'string', name + ': detail is a string');
    }
  }
});

leg('R1b', 'the room141_default call has an empty omitted array (present, not missing)', async () => {
  assert.ok(Object.prototype.hasOwnProperty.call(G.room141_default._meta, 'omitted'));
  assert.deepStrictEqual(G.room141_default._meta.omitted, []);
});

leg('R1c', 'OMITTED_REASONS is the closed set, depth_cap never in it', async () => {
  const expected = ['leg_failed', 'type_excluded']
    .concat(TOP_K_CAP_ENABLED ? ['top_k_cap'] : [])
    .concat(['char_cap', 'window_cap', 'estimate_only']);
  assert.deepStrictEqual(Array.from(OMITTED_REASONS), expected);
  assert.equal(OMITTED_REASONS.indexOf('depth_cap'), -1);
  assert.equal(OMITTED_REASONS.indexOf('max_depth'), -1);
});

leg('R1d', 'the tool seam output carries _meta.omitted and the description names it', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-372-wire-'));
  const roomDir = path.join(tmpDir, 'room');
  fs.mkdirSync(roomDir, { recursive: true });
  try {
    const db = openRoomDb(roomDir);
    try {
      insertNode(db, 'claim:wire-372', 'claim', JSON.stringify({ text: 'a wire-level claim' }), {
        epistemic_type: 'observation',
      });
    } finally {
      closeRoomDb(db);
    }
    const stub = {
      tools: new Map(),
      registerTool(name, config, cb) {
        const cfg = config || {};
        this.tools.set(name, { description: cfg.description, cb });
      },
    };
    contextTool.register(stub, { fallbackRoomDir: roomDir, pluginRoot: REPO_ROOT, surface: 'cli' });
    const reg = stub.tools.get('context_assemble');
    assert.ok(reg, 'context_assemble must be registered');
    assert.ok(reg.description.includes('_meta.omitted'), 'description must name _meta.omitted');
    assert.ok(Buffer.byteLength(reg.description, 'utf8') < 2048, 'description under the 2048 byte ceiling');

    const body = JSON.parse((await reg.cb({}, { sessionId: 'sess-372-a' })).content[0].text);
    assert.equal(body.ok, true, 'the tool call must succeed');
    assert.ok(Array.isArray(body._meta.omitted), 'the tool output carries _meta.omitted');
    for (const e of body._meta.omitted) {
      assert.ok(OMITTED_REASONS.indexOf(e.reason) !== -1, 'reason in the closed set: ' + e.reason);
    }
    ALL_OMITTED.push({ label: 'tool:default', list: body._meta.omitted });

    const est = JSON.parse((await reg.cb({ estimate_only: true }, { sessionId: 'sess-372-b' })).content[0].text);
    const estOnly = est._meta.omitted.filter((e) => e.reason === 'estimate_only');
    assert.equal(estOnly.length, 4, 'estimate mode names four nulled bodies');
    ALL_OMITTED.push({ label: 'tool:estimate', list: est._meta.omitted });
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
});

// ---------------------------------------------------------------------------
// SPEC 2
// ---------------------------------------------------------------------------
leg('R2a', 'every pre-existing field equals the pre-change golden', async () => {
  const diffs = compareAgainstGolden(golden, await getSharedRun());
  assert.deepStrictEqual(diffs, []);
});

leg('R2b', 'top-level and _meta key order, omitted is the LAST _meta key', async () => {
  for (const name of Object.keys(G)) {
    assert.deepStrictEqual(Object.keys(G[name]), PRE_EXISTING_TOP_KEYS, name + ': top-level keys');
    assert.deepStrictEqual(
      Object.keys(G[name]._meta), PRE_EXISTING_META_KEYS.concat(['omitted']), name + ': _meta keys'
    );
  }
});

leg('R2c', 'the prepare count of every call equals the golden (no new query)', async () => {
  const run = await getSharedRun();
  for (const name of Object.keys(golden.calls)) {
    assert.equal(run.calls[name].prepare_count, golden.calls[name].prepare_count, name + ': prepare_count');
  }
});

leg('R2d', 'two runs of the default call are equal once timings are removed', async () => {
  const db = buildOmissionFixtureDb();
  const a = stripTimings(await ctxCall('R2d:a', db, callOpts('default')));
  const b = stripTimings(await ctxCall('R2d:b', db, callOpts('default')));
  assert.deepStrictEqual(a, b);
  assert.deepStrictEqual(a._meta.omitted, b._meta.omitted);
});

// ---------------------------------------------------------------------------
// SPEC 3: forced throw at all 7 report sites
// ---------------------------------------------------------------------------
const SITES = [
  {
    id: 'R3a', name: 'legA', leg: 'legA', errClass: 'TypeError',
    matcher: (sql) => sql.includes("review_status IN ('confirmed','validated')"),
    opts: () => Object.assign({}, WIDE_OPTS),
    affected: ['summary'],
    check: (r) => assert.equal(r.summary, null, 'summary is null when legA throws'),
  },
  {
    id: 'R3b', name: 'legB', leg: 'legB', errClass: 'TypeError',
    matcher: (sql) => sql.includes('FROM sessions'),
    opts: () => Object.assign({}, WIDE_OPTS),
    affected: ['recentMessages', 'relevantNodes'],
    entryLegs: ['legB', 'legC'], // no session means no seed, so legC has nothing to rank
    check: (r) => assert.deepStrictEqual(r.recentMessages, [], 'recentMessages is [] when legB throws'),
  },
  {
    id: 'R3c', name: 'the filter lookup', leg: 'legC', errClass: 'TypeError',
    matcher: (sql) => sql === 'SELECT type FROM nodes WHERE id = ?',
    opts: () => Object.assign({}, WIDE_OPTS),
    affected: [],
    check: (r) => assert.ok(r.relevantNodes.length > 0, 'relevantNodes stay filled when only the filter lookup throws'),
  },
  {
    id: 'R3d', name: 'legC', leg: 'legC', errClass: 'TypeError',
    matcher: (sql) => sql === NEIGHBORHOOD_SQL,
    opts: () => Object.assign({}, WIDE_OPTS),
    affected: ['relevantNodes'],
    check: (r) => assert.deepStrictEqual(r.relevantNodes, [], 'relevantNodes is [] when legC throws'),
  },
  {
    id: 'R3e', name: 'legD', leg: 'legD', errClass: 'TypeError',
    matcher: (sql) => sql.includes('review_status, source_section, created_at, last_seen_at'),
    opts: () => Object.assign({}, WIDE_OPTS),
    affected: ['cortexNodes'],
    check: (r) => assert.deepStrictEqual(r.cortexNodes, [], 'cortexNodes is [] when legD throws'),
  },
];

function nonFailedEntries(list) {
  return list.filter((e) => e.reason !== 'leg_failed');
}

for (const site of SITES) {
  leg(site.id, 'a throw in ' + site.name + ' yields one leg_failed with the class name only', async () => {
    const control = await ctxCall(site.id + ':control', buildOmissionFixtureDb(), site.opts());
    assert.equal(control._meta.omitted.filter((e) => e.reason === 'leg_failed').length, 0, 'control has no leg_failed');

    const forced = await ctxCall(site.id + ':forced', throwingDb(buildOmissionFixtureDb(), site.matcher), site.opts());
    const failed = forced._meta.omitted.filter((e) => e.reason === 'leg_failed');
    assert.deepStrictEqual(
      failed, [{ leg: site.leg, reason: 'leg_failed', count: null, detail: site.errClass }],
      site.name + ': exactly one leg_failed entry'
    );
    site.check(forced);
    // The other legs stay as in the control call.
    for (const field of ['summary', 'recentMessages', 'relevantNodes', 'cortexNodes']) {
      if (site.affected.indexOf(field) !== -1) continue;
      assert.deepStrictEqual(forced[field], control[field], site.name + ': field ' + field + ' unchanged');
    }
    const skipLegs = site.entryLegs || (site.id === 'R3c' ? [] : [site.leg]);
    assert.deepStrictEqual(
      nonFailedEntries(forced._meta.omitted).filter((e) => skipLegs.indexOf(e.leg) === -1),
      nonFailedEntries(control._meta.omitted).filter((e) => skipLegs.indexOf(e.leg) === -1),
      site.name + ': entries of the other legs unchanged'
    );
    const text = JSON.stringify(forced).toLowerCase();
    for (const secret of SECRET_TEXTS) assert.equal(text.indexOf(secret), -1, site.name + ': no ' + secret);
  });
}

leg('R3f', 'a throw in the Leg E outer read yields legE leg_failed TypeError and zero cost', async () => {
  const opts = Object.assign({}, WIDE_OPTS, { roomDir: os.tmpdir() });
  const control = await ctxCall('R3f:control', buildOmissionFixtureDb(), opts);
  assert.equal(control._meta.omitted.filter((e) => e.reason === 'leg_failed').length, 0, 'control has no leg_failed');
  const forced = await withRoomMapPatch(
    { readRoomMap() { throw new TypeError('boom OMIT372-SECRET'); } },
    () => ctxCall('R3f:forced', buildOmissionFixtureDb(), opts)
  );
  assert.deepStrictEqual(
    forced._meta.omitted.filter((e) => e.reason === 'leg_failed'),
    [{ leg: 'legE', reason: 'leg_failed', count: null, detail: 'TypeError' }]
  );
  assert.equal(forced._meta.legCostChars.legE, 0, 'legE cost reads 0 after the outer fault');
  for (const field of ['summary', 'recentMessages', 'relevantNodes', 'cortexNodes']) {
    assert.deepStrictEqual(forced[field], control[field], 'field ' + field + ' unchanged');
  }
  const text = JSON.stringify(forced).toLowerCase();
  for (const secret of SECRET_TEXTS) assert.equal(text.indexOf(secret), -1, 'no ' + secret);
});

leg('R3g', 'a throw in the Leg E inner parse yields legE leg_failed SyntaxError', async () => {
  const patch = { readRoomMap: OK_ROOM_MAP, renderSelfBlock: () => '' };
  const controlDb = buildOmissionFixtureDb();
  const controlOpts = Object.assign({}, WIDE_OPTS, { roomDir: os.tmpdir(), focusNodeId: FOCUS_ID });
  const control = await withRoomMapPatch(patch, () => ctxCall('R3g:control', controlDb, controlOpts));
  assert.equal(control._meta.omitted.filter((e) => e.reason === 'leg_failed').length, 0, 'control has no leg_failed');

  const db = buildOmissionFixtureDb();
  insertBadPropsNode(db, 'section:bad-372');
  const opts = Object.assign({}, WIDE_OPTS, { roomDir: os.tmpdir(), focusNodeId: 'section:bad-372' });
  const forced = await withRoomMapPatch(patch, () => ctxCall('R3g:forced', db, opts));
  assert.deepStrictEqual(
    forced._meta.omitted.filter((e) => e.reason === 'leg_failed'),
    [{ leg: 'legE', reason: 'leg_failed', count: null, detail: 'SyntaxError' }]
  );
  const text = JSON.stringify(forced).toLowerCase();
  for (const secret of SECRET_TEXTS) assert.equal(text.indexOf(secret), -1, 'no ' + secret);
});

leg('R3h', 'the no-throw control calls have no leg_failed entry at all', async () => {
  for (const name of Object.keys(G)) {
    assert.equal(G[name]._meta.omitted.filter((e) => e.reason === 'leg_failed').length, 0, name);
  }
});

leg('R3i', 'no forced throw leaks message text into the result', async () => {
  // Re-run every forced site and scan the whole serialized result.
  for (const site of SITES) {
    const forced = await ctxCall(site.id + ':leak', throwingDb(buildOmissionFixtureDb(), site.matcher), site.opts());
    const text = JSON.stringify(forced).toLowerCase();
    for (const secret of SECRET_TEXTS) assert.equal(text.indexOf(secret), -1, site.name + ': no ' + secret);
    for (const e of forced._meta.omitted) {
      if (e.reason === 'leg_failed') assert.match(e.detail, ERROR_CLASS_PATTERN, 'class name only');
    }
  }
});

leg('R3j', 'a truncated room-map.json yields one legE leg_failed RoomMapUnreadable; a missing file adds no entry', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-372-roommap-'));
  try {
    const roomDir = path.join(tmpDir, 'room');
    fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
    const opts = Object.assign({}, WIDE_OPTS, { roomDir });
    // Control: the file is missing. This is a normal state and stays silent.
    const control = await ctxCall('R3j:control', buildOmissionFixtureDb(), opts);
    assert.equal(control._meta.omitted.filter((e) => e.reason === 'leg_failed').length, 0, 'a missing map adds no entry');
    assert.equal(control._meta.omitted.filter((e) => e.leg === 'legE').length, 0, 'a missing map adds no legE entry');
    // Forced: the file is on disk but truncated, so the JSON parse fails.
    fs.writeFileSync(
      path.join(roomDir, '.mindrian', 'room-map.json'),
      '{"nodes":[{"path":".","room":"OMIT372-SECRET"',
      'utf8'
    );
    assert.equal(roomMapMod.readRoomMap(roomDir).ok, false, 'the truncated map does not read');
    const forced = await ctxCall('R3j:forced', buildOmissionFixtureDb(), opts);
    assert.deepStrictEqual(
      forced._meta.omitted.filter((e) => e.reason === 'leg_failed'),
      [{ leg: 'legE', reason: 'leg_failed', count: null, detail: 'RoomMapUnreadable' }]
    );
    assert.deepStrictEqual(
      forced._meta.omitted.filter((e) => e.leg !== 'legE'),
      control._meta.omitted.filter((e) => e.leg !== 'legE'),
      'entries of the other legs unchanged'
    );
    for (const field of ['summary', 'recentMessages', 'relevantNodes', 'cortexNodes']) {
      assert.deepStrictEqual(forced[field], control[field], 'field ' + field + ' unchanged');
    }
    const text = JSON.stringify(forced).toLowerCase();
    for (const secret of SECRET_TEXTS) assert.equal(text.indexOf(secret), -1, 'no ' + secret);
    assert.equal(text.indexOf(tmpDir.toLowerCase()), -1, 'no path in the result');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

leg('R3k', 'only built-in error class names enter detail; a custom name becomes Error', async () => {
  const opts = Object.assign({}, WIDE_OPTS, { roomDir: os.tmpdir() });
  const forceName = async (label, errObj) => {
    const forced = await withRoomMapPatch(
      { readRoomMap() { throw errObj; } },
      () => ctxCall(label, buildOmissionFixtureDb(), opts)
    );
    const failed = forced._meta.omitted.filter((e) => e.reason === 'leg_failed');
    assert.equal(failed.length, 1, label + ': one entry');
    return failed[0].detail;
  };
  const leaky = new Error('boom OMIT372-SECRET');
  leaky.name = 'LeakyRoomName123';
  assert.equal(await forceName('R3k:leaky', leaky), 'Error', 'a custom name becomes Error');
  const odd = new TypeError('boom');
  odd.name = 'Room141Name';
  assert.equal(await forceName('R3k:odd', odd), 'Error', 'a name set from room text becomes Error');
  for (const cls of ['Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError', 'EvalError', 'URIError']) {
    const e = new Error('boom');
    e.name = cls;
    assert.equal(await forceName('R3k:' + cls, e), cls, cls + ' passes as it is');
  }
});

// ---------------------------------------------------------------------------
// SPEC 4
// ---------------------------------------------------------------------------
leg('R4a', 'the default call reports the chain_state exclusion', async () => {
  assert.equal(CHAIN_IN_DEFAULT_TOPK, 3);
  assert.deepStrictEqual(
    findEntry(G.default._meta.omitted, 'legC', 'type_excluded'),
    { leg: 'legC', reason: 'type_excluded', count: 3, detail: 'chain_state' }
  );
});

leg('R4b', 'type_excluded count equals the chain_state rows among the first topK raw rows', async () => {
  const db = buildOmissionFixtureDb();
  for (let k = 1; k <= RAW_COUNT_DEPTH2 + 2; k++) {
    const raw = getNeighborhood(db, FOCUS_ID, { topK: k, maxDepth: 2 });
    const chainCount = raw.filter((r) => r.type === CHAIN_STATE_NODE_TYPE).length;
    const r = await ctxCall('R4b:' + k, db, { focusNodeId: FOCUS_ID, topK: k, maxDepth: 2, now: NOW_PIN });
    const entry = findEntry(r._meta.omitted, 'legC', 'type_excluded');
    if (chainCount === 0) {
      assert.equal(entry, undefined, 'topK ' + k + ': no type_excluded entry');
    } else {
      assert.ok(entry, 'topK ' + k + ': type_excluded entry present');
      assert.equal(entry.count, chainCount, 'topK ' + k + ': count');
      assert.equal(entry.detail, 'chain_state', 'topK ' + k + ': detail');
    }
  }
});

leg('R4c', 'room141_default and explicit_focus have no type_excluded entry', async () => {
  for (const name of ['room141_default', 'explicit_focus']) {
    assert.equal(findEntry(G[name]._meta.omitted, 'legC', 'type_excluded'), undefined, name);
  }
});

leg('R4d', 'a chain_state focus keeps the carve-out and reports no exclusion', async () => {
  assert.equal(findEntry(G.chain_focus._meta.omitted, 'legC', 'type_excluded'), undefined);
  const ids = G.chain_focus.relevantNodes.map((n) => n.id);
  assert.ok(ids.indexOf('chain:omit-372:1') !== -1, 'the chain_state neighbor stays in relevantNodes');
  assert.equal(G.chain_focus._meta.seedNodeId, CHAIN_FOCUS_ID);
});

// ---------------------------------------------------------------------------
// SPEC 5
// ---------------------------------------------------------------------------
leg('R5a', 'top_k_cap appears exactly when the cap cut the ranked set', async () => {
  const db = buildOmissionFixtureDb();
  if (TOP_K_CAP_ENABLED) {
    assert.equal(
      probeTieStability(db, FOCUS_ID, 2).stable, true,
      'D1 invariant broken on this runtime: switch to branch B'
    );
  }
  for (const [maxDepth, rawCount] of [[2, RAW_COUNT_DEPTH2], [1, RAW_COUNT_DEPTH1]]) {
    for (let k = 1; k <= rawCount + 2; k++) {
      const r = await ctxCall('R5a:' + maxDepth + ':' + k, db, { focusNodeId: FOCUS_ID, topK: k, maxDepth, now: NOW_PIN });
      const entry = findEntry(r._meta.omitted, 'legC', 'top_k_cap');
      if (!TOP_K_CAP_ENABLED) {
        assert.equal(entry, undefined, 'branch B: no top_k_cap at topK ' + k);
      } else if (k < rawCount) {
        assert.ok(entry, 'depth ' + maxDepth + ' topK ' + k + ': top_k_cap present');
        assert.strictEqual(entry.count, null, 'top_k_cap count is null, never 0');
        assert.equal(entry.detail, 'top_k');
      } else {
        assert.equal(entry, undefined, 'depth ' + maxDepth + ' topK ' + k + ': no top_k_cap');
      }
    }
  }
});

leg('R5b', 'no depth reason at any maxDepth', async () => {
  const db = buildOmissionFixtureDb();
  for (const maxDepth of [1, 2, 3, 5]) {
    const r = await ctxCall('R5b:' + maxDepth, db, { focusNodeId: FOCUS_ID, topK: 10, maxDepth, now: NOW_PIN });
    assert.equal(/depth/i.test(JSON.stringify(r._meta.omitted)), false, 'maxDepth ' + maxDepth);
    for (const e of r._meta.omitted) assert.ok(OMITTED_REASONS.indexOf(e.reason) !== -1, e.reason);
  }
});

leg('R5c', 'window_cap counts the dropped fragments in both lanes', async () => {
  assert.deepStrictEqual(
    findEntry(G.default._meta.omitted, 'legB', 'window_cap'),
    { leg: 'legB', reason: 'window_cap', count: 3, detail: 'fragment_window' }
  );
  const db = buildOmissionFixtureDb();
  const nine = await ctxCall('R5c:nine', db, Object.assign(callOpts('default'), { fragmentWindow: 9 }));
  assert.equal(findEntry(nine._meta.omitted, 'legB', 'window_cap'), undefined, 'window 9 covers 9 fragments');
  assert.equal(findEntry(G.wide._meta.omitted, 'legB', 'window_cap'), undefined, 'wide call');
  const seed = callOpts('seed_lane');
  const expected = seed.seedFragments.length - seed.fragmentWindow;
  assert.ok(expected > 0);
  assert.equal(findEntry(G.seed_lane._meta.omitted, 'legB', 'window_cap').count, expected);
});

leg('R5d', 'char_cap counts the delivered fragments that were cut in both lanes', async () => {
  assert.deepStrictEqual(
    findEntry(G.default._meta.omitted, 'legB', 'char_cap'),
    { leg: 'legB', reason: 'char_cap', count: 1, detail: 'fragment_char_cap' }
  );
  assert.equal(findEntry(G.wide._meta.omitted, 'legB', 'char_cap'), undefined, 'wide call');
  assert.equal(findEntry(G.caps_small._meta.omitted, 'legB', 'char_cap'), undefined, 'caps_small call');
  const seed = callOpts('seed_lane');
  const delivered = seed.seedFragments.slice(-seed.fragmentWindow);
  const expected = delivered.filter((f) => {
    const content = typeof f === 'string' ? f : (f && (f.content || f.text) || '');
    return content.length > seed.fragmentCharCap;
  }).length;
  assert.ok(expected > 0);
  assert.equal(findEntry(G.seed_lane._meta.omitted, 'legB', 'char_cap').count, expected);
});

leg('R5e', 'no entry anywhere has a count of 0', async () => {
  assert.ok(ALL_OMITTED.length > 0);
  for (const { label, list } of ALL_OMITTED) {
    for (const e of list) {
      assert.notStrictEqual(e.count, 0, label + ': count 0');
      assert.ok(e.count === null || (Number.isInteger(e.count) && e.count > 0), label + ': count ' + e.count);
    }
  }
});

// ---------------------------------------------------------------------------
// SPEC 6
// ---------------------------------------------------------------------------
leg('R6a', 'estimate mode names four nulled bodies', async () => {
  const r = G.estimate;
  const est = r._meta.omitted.filter((e) => e.reason === 'estimate_only');
  assert.deepStrictEqual(est, ['legA', 'legB', 'legC', 'legD'].map((l) => (
    { leg: l, reason: 'estimate_only', count: null, detail: 'body' }
  )));
  assert.equal(r.summary, null);
  assert.equal(r.recentMessages, null);
  assert.equal(r.relevantNodes, null);
  assert.equal(r.cortexNodes, null);
});

leg('R6b', 'the default call has no estimate_only entry', async () => {
  assert.equal(G.default._meta.omitted.filter((e) => e.reason === 'estimate_only').length, 0);
});

leg('R6c', 'estimate mode keeps the other entries equal to the default call', async () => {
  const strip = (list) => list.filter((e) => e.reason !== 'estimate_only');
  assert.deepStrictEqual(strip(G.estimate._meta.omitted), strip(G.default._meta.omitted));
});

// ---------------------------------------------------------------------------
// SPEC 7
// ---------------------------------------------------------------------------
function fixtureTexts() {
  const texts = [];
  const db = buildOmissionFixtureDb();
  for (const row of db.prepare('SELECT properties FROM nodes').all()) {
    try {
      const p = JSON.parse(row.properties);
      if (p && typeof p.text === 'string') texts.push(p.text);
    } catch (_e) { /* not json */ }
  }
  for (const row of db.prepare('SELECT content FROM fragments').all()) texts.push(String(row.content));
  for (const row of db.prepare('SELECT summary FROM sessions').all()) texts.push(String(row.summary));
  for (const f of callOpts('seed_lane').seedFragments) {
    texts.push(typeof f === 'string' ? f : String(f.content || f.text || ''));
  }
  return texts.filter((t) => t.length >= 6);
}

leg('R7a', 'no detail and no omitted text carries room content', async () => {
  const texts = fixtureTexts().map((t) => t.toLowerCase());
  assert.ok(texts.length > 10, 'the fixture text list is not empty');
  for (const { label, list } of ALL_OMITTED) {
    for (const e of list) {
      assert.ok(
        FIXED_DETAILS.indexOf(e.detail) !== -1 || ERROR_CLASS_PATTERN.test(e.detail),
        label + ': detail "' + e.detail + '" is not a fixed label or an error class name'
      );
    }
    const text = JSON.stringify(list).toLowerCase();
    for (const needle of [MARKER_PREFIX.toLowerCase(), 'omit-372']) {
      assert.equal(text.indexOf(needle), -1, label + ': contains ' + needle);
    }
    for (const t of texts) assert.equal(text.indexOf(t), -1, label + ': contains fixture text');
  }
});

leg('R7b', 'room-context.cjs has no new require and no network text', async () => {
  const src = fs.readFileSync(ROOM_CONTEXT_PATH, 'utf8');
  const targets = [];
  const re = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(src)) !== null) targets.push(m[1]);
  assert.deepStrictEqual(Array.from(new Set(targets)).sort(), [
    './neighborhood.cjs', './room-home.cjs', '../memory-ops.cjs', './chain-state.cjs',
    '../temporal/recency-decay.cjs', '../temporal/reference-now.cjs', '../room-map.cjs',
  ].sort());
  assert.equal(src.indexOf('fetch('), -1, 'no fetch(');
  for (const banned of ['node:http', 'node:https', 'node:net', 'node:dns']) {
    assert.equal(src.indexOf(banned), -1, 'no ' + banned);
  }
});

leg('R7d', 'the default and caps_small calls stay inside the 1200 ms NAV budget', async () => {
  const db = buildOmissionFixtureDb();
  await ctxCall('R7d:warm', db, callOpts('default'));
  for (const name of ['default', 'caps_small']) {
    const t0 = process.hrtime.bigint();
    await ctxCall('R7d:' + name, db, callOpts(name));
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    assert.ok(ms < 1200, name + ' took ' + ms.toFixed(1) + ' ms');
  }
});

leg('R7e', 'catch census: 10 catch sites, each accounted for in the audit', async () => {
  const src = fs.readFileSync(ROOM_CONTEXT_PATH, 'utf8');
  const lines = src.split('\n').filter((l) => !/^\s*\/\//.test(l));
  const count = lines.filter((l) => /\bcatch\s*[({]/.test(l)).length;
  assert.equal(count, 10, 'a new swallow needs a new audit row and a new forced-throw leg');
});

// R7c runs last, after every other leg has made its calls.
leg('R7c', 'the network guard recorded zero calls', async () => {
  assert.deepStrictEqual(GUARD_CALLS, []);
});

async function main() {
  console.log('test-372-omitted: branch ' + (TOP_K_CAP_ENABLED ? 'A (top_k_cap ships)' : 'B (top_k_cap dropped)'));
  await buildGoldenResults();
  await runAll();
  console.log(passed + ' legs passed' + (failed ? ', ' + failed + ' FAILED' : ''));
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('FAIL test-372-omitted: ' + (err && err.stack ? err.stack : String(err)));
  process.exit(1);
});
