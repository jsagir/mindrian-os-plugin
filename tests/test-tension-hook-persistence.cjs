/*
 * Phase 116-01 Wave 1 -- pending-tension-store persistence tests.
 *
 * Real assertions (was Wave-0 stub) for D-07 / D-07a / D-07b:
 *   - JSONL location workspace-guard-clean (os.homedir-anchored)
 *   - Append-only writer + LWW replay
 *   - 8 module exports + 4 constants
 *   - Canon Part 8 user-content rejection
 *   - State machine transitions (markSurfaced / markResolved / markDropped / requeue)
 *
 * Each test uses a per-test temp roomSlug ('phase-116-test-' + Date.now() +
 * random suffix) so we never touch real user data and parallel test runs
 * never collide. Cleanup via fs.rmSync(jsonlPath, {force:true}) in a
 * try/finally that always runs.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const store = require('../lib/memory/pending-tension-store.cjs');

function freshSlug(label) {
  const rand = crypto.randomBytes(4).toString('hex');
  return 'phase-116-test-' + label + '-' + Date.now() + '-' + rand;
}

function cleanupSlug(slug) {
  try {
    const p = store.jsonlPath(slug);
    if (fs.existsSync(p)) fs.rmSync(p, { force: true });
  } catch (_e) { /* swallow cleanup errors */ }
}

function freshEntry(tension_id) {
  return {
    tension_id: tension_id,
    type: 'contradiction',
    source_edge_ids: ['edge_a'],
    source_node_ids: ['node_a', 'node_b'],
    created_at: 1715000000000,
    state: 'queued',
    surfacing_count: 0,
    last_surfaced_at: null,
    last_response: null,
    context_signature: {
      source_section: 'problem-definition',
      target_section: 'solution-design',
      tension_kind_label: 'contradiction',
    },
  };
}

test('116-01 persistence: computeTensionId is deterministic across runs', () => {
  const a = store.computeTensionId('node-a', 'node-b', 'contradiction');
  const b = store.computeTensionId('node-a', 'node-b', 'contradiction');
  assert.equal(a, b);
  assert.equal(a.length, 32);
  assert.match(a, /^[0-9a-f]{32}$/);
});

test('116-01 persistence: computeTensionId is order-sensitive (RESEARCH 4.3)', () => {
  const a = store.computeTensionId('node-a', 'node-b', 'contradiction');
  const b = store.computeTensionId('node-b', 'node-a', 'contradiction');
  assert.notEqual(a, b);
});

test('116-01 persistence: appendTension creates the JSONL file under os.homedir()', () => {
  const slug = freshSlug('append');
  try {
    const tid = store.computeTensionId('s', 't', 'contradiction');
    const r = store.appendTension(slug, freshEntry(tid));
    assert.equal(r.ok, true);
    assert.equal(fs.existsSync(r.path), true);
    // Workspace-guard-clean: path must start with os.homedir(), NOT with cwd.
    assert.equal(r.path.indexOf(os.homedir()), 0);
    // Must NOT be inside the plugin repo working directory.
    const cwd = process.cwd();
    assert.equal(r.path.indexOf(cwd + path.sep), -1);
  } finally {
    cleanupSlug(slug);
  }
});

test('116-01 persistence: readTensions LWW collapses 3 appends to size 1', () => {
  const slug = freshSlug('lww');
  try {
    const tid = store.computeTensionId('lww-s', 'lww-t', 'contradiction');
    const e = freshEntry(tid);
    store.appendTension(slug, e);
    store.appendTension(slug, Object.assign({}, e, { state: 'surfaced', surfacing_count: 1 }));
    store.appendTension(slug, Object.assign({}, e, { state: 'resolved', last_response: 'RESOLVE' }));
    const all = store.readTensions(slug);
    assert.equal(all.length, 1);
    assert.equal(all[0].state, 'resolved');
    assert.equal(all[0].last_response, 'RESOLVE');
  } finally {
    cleanupSlug(slug);
  }
});

test('116-01 persistence: markSurfaced increments surfacing_count and sets last_surfaced_at', () => {
  const slug = freshSlug('surfaced');
  try {
    const tid = store.computeTensionId('su-s', 'su-t', 'contradiction');
    store.appendTension(slug, freshEntry(tid));
    const before = Date.now();
    const r = store.markSurfaced(slug, tid);
    const after = Date.now();
    assert.equal(r.ok, true);
    assert.equal(r.surfacing_count, 1);
    const all = store.readTensions(slug);
    assert.equal(all.length, 1);
    assert.equal(all[0].state, 'surfaced');
    assert.equal(all[0].surfacing_count, 1);
    assert.equal(typeof all[0].last_surfaced_at, 'number');
    assert.ok(all[0].last_surfaced_at >= before - 1000);
    assert.ok(all[0].last_surfaced_at <= after + 1000);
  } finally {
    cleanupSlug(slug);
  }
});

test('116-01 persistence: markResolved sets state and last_response', () => {
  const slug = freshSlug('resolved');
  try {
    const tid = store.computeTensionId('rs-s', 'rs-t', 'contradiction');
    store.appendTension(slug, freshEntry(tid));
    const r = store.markResolved(slug, tid, 'RESOLVE');
    assert.equal(r.ok, true);
    const all = store.readTensions(slug);
    assert.equal(all[0].state, 'resolved');
    assert.equal(all[0].last_response, 'RESOLVE');
  } finally {
    cleanupSlug(slug);
  }
});

test('116-01 persistence: markResolved rejects invalid response', () => {
  const slug = freshSlug('invalid-response');
  try {
    const tid = store.computeTensionId('ir-s', 'ir-t', 'contradiction');
    store.appendTension(slug, freshEntry(tid));
    const r = store.markResolved(slug, tid, 'NOT_A_VERB');
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'invalid_response');
  } finally {
    cleanupSlug(slug);
  }
});

test('116-01 persistence: markDropped sets state=dropped and last_response=DROPPED', () => {
  const slug = freshSlug('dropped');
  try {
    const tid = store.computeTensionId('dr-s', 'dr-t', 'contradiction');
    store.appendTension(slug, freshEntry(tid));
    const r = store.markDropped(slug, tid);
    assert.equal(r.ok, true);
    const all = store.readTensions(slug);
    assert.equal(all[0].state, 'dropped');
    assert.equal(all[0].last_response, 'DROPPED');
  } finally {
    cleanupSlug(slug);
  }
});

test('116-01 persistence: requeue sets state=queued without decrementing surfacing_count', () => {
  const slug = freshSlug('requeue');
  try {
    const tid = store.computeTensionId('rq-s', 'rq-t', 'contradiction');
    store.appendTension(slug, freshEntry(tid));
    store.markSurfaced(slug, tid);
    store.markSurfaced(slug, tid);
    const r = store.requeue(slug, tid);
    assert.equal(r.ok, true);
    const all = store.readTensions(slug);
    assert.equal(all[0].state, 'queued');
    assert.equal(all[0].surfacing_count, 2); // NOT reset to 0
  } finally {
    cleanupSlug(slug);
  }
});

test('116-01 persistence: readTensions returns [] for unknown room', () => {
  const slug = freshSlug('unknown') + '-no-write';
  // Do not append; file should not exist.
  try {
    assert.equal(fs.existsSync(store.jsonlPath(slug)), false);
    const all = store.readTensions(slug);
    assert.deepEqual(all, []);
    // Reading should not have created the file.
    assert.equal(fs.existsSync(store.jsonlPath(slug)), false);
  } finally {
    cleanupSlug(slug);
  }
});

test('116-01 persistence: corrupt JSONL line is silently skipped', () => {
  const slug = freshSlug('corrupt');
  try {
    const tid = store.computeTensionId('co-s', 'co-t', 'contradiction');
    store.appendTension(slug, freshEntry(tid));
    fs.appendFileSync(store.jsonlPath(slug), 'this is not json\n');
    store.appendTension(slug, Object.assign({}, freshEntry(tid), { state: 'surfaced', surfacing_count: 1 }));
    const all = store.readTensions(slug);
    // Corrupt line skipped; LWW yields the surfaced entry.
    assert.equal(all.length, 1);
    assert.equal(all[0].state, 'surfaced');
  } finally {
    cleanupSlug(slug);
  }
});

test('116-01 persistence: jsonlPath is workspace-guard-clean (os.homedir + .mindrian)', () => {
  const slug = 'workspace-guard-' + Date.now();
  const p = store.jsonlPath(slug);
  assert.equal(p.indexOf(os.homedir()), 0);
  assert.notEqual(p.indexOf(path.join(os.homedir(), '.mindrian', 'pending-tensions')), -1);
  // The plugin repo cwd must NOT prefix the path.
  const cwd = process.cwd();
  // os.homedir() can be a prefix of cwd (homedir + repo) but NOT vice-versa
  // for a sane install. Defensive: assert that the plugin repo path component
  // is not embedded.
  assert.equal(p.indexOf(path.join(cwd, '.mindrian', 'pending-tensions')), -1);
});

test('116-01 persistence: appendTension rejects user-content fields (Canon Part 8)', () => {
  const slug = freshSlug('canon8');
  try {
    const tid = store.computeTensionId('c8-s', 'c8-t', 'contradiction');
    const bad = Object.assign({}, freshEntry(tid), { body_text: 'SECRET USER CONTENT' });
    const r = store.appendTension(slug, bad);
    assert.equal(r.ok, false);
    assert.match(r.reason, /^canon_part_8_violation/);
    // File must not exist (the rejection happened before any disk write).
    assert.equal(fs.existsSync(store.jsonlPath(slug)), false);
  } finally {
    cleanupSlug(slug);
  }
});

test('116-01 persistence: anti-pattern grep clean (no console / room-db / brain-client)', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '..', 'lib', 'memory', 'pending-tension-store.cjs'), 'utf8');
  // Strip block + line comments so the rule guards against CALLS to these
  // APIs, not a comment that documents the rule itself (the canonical
  // anti-pattern paragraph at the top of the file is load-bearing
  // documentation per RESEARCH Section 13.9).
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  // Anti-pattern: console.log / process.stdout.write CALL sites (RESEARCH 13.9).
  assert.equal(/\bconsole\s*\.\s*log\s*\(/.test(stripped), false, 'console.log must not be called in pending-tension-store.cjs');
  assert.equal(/process\s*\.\s*stdout\s*\.\s*write\s*\(/.test(stripped), false, 'process.stdout.write must not be called in pending-tension-store.cjs');
  // Phase 109 D-06 chokepoint: no direct room-db.cjs require.
  assert.equal(/require\(['"][^'"]*\broom-db\b[^'"]*['"]\)/.test(stripped), false, 'must not require room-db.cjs (Phase 109 D-06 chokepoint)');
  // Canon Part 8 boundary: no brain-client require.
  assert.equal(/require\(['"][^'"]*brain[-_]client[^'"]*['"]\)/.test(stripped), false, 'must not import brain-client (Canon Part 8 boundary)');
});

test('116-01 persistence: 8 functions + 4 constants exported', () => {
  const fns = ['computeTensionId', 'jsonlPath', 'appendTension', 'readTensions',
    'markSurfaced', 'markResolved', 'markDropped', 'requeue'];
  for (const fn of fns) {
    assert.equal(typeof store[fn], 'function', 'missing export: ' + fn);
  }
  assert.equal(typeof store.PENDING_TENSIONS_DIR, 'string');
  assert.equal(store.VALID_STATES instanceof Set, true);
  assert.equal(store.VALID_TYPES instanceof Set, true);
  assert.equal(store.VALID_RESPONSES instanceof Set, true);
});
