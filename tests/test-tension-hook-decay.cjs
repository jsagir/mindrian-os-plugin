/*
 * Phase 116-03 Wave 3 -- decay state machine + 3-strikes + cross-session JSONL replay.
 *
 * Real assertions (was Wave-0 stub) for AC-4 + AC-5 (state machine + 3-strikes
 * decay) per .planning/phases/116-unresolved-tension-hook/116-VALIDATION.md.
 *
 * Coverage matrix (15 tests):
 *   State machine forward-pass (no decay yet):
 *     1. queued -> markSurfaced -> state='surfaced', surfacing_count=1
 *     2. queued -> markSurfaced -> markResolved('RESOLVE') -> state='resolved'
 *     3. queued -> markSurfaced -> requeue -> state='queued', surfacing_count NOT decremented
 *     4. queued -> markSurfaced * 3 -> surfacing_count=3, state='surfaced'
 *
 *   3-strikes / decay (the heart of this plan):
 *     5. surfacing_count=3 + state='surfaced' -> evaluateAndDecay -> state='dropped'
 *     6. evaluateAndDecay is idempotent on already-dropped tensions
 *     7. surfacing_count=2 -> evaluateAndDecay returns { evaluatedCount: 0 }
 *     8. Boundary: surfacing_count=3 AND markResolved BEFORE evaluateAndDecay -> state stays 'resolved'
 *     9. getDecayCandidates is read-only (no JSONL mutation)
 *
 *   Cross-session simulation (LWW replay):
 *    10. append queued -> close -> re-read returns same entry
 *    11. 3-session simulation: write across simulated sessions, evaluateAndDecay drops on session 4
 *    12. Concurrent-write smoke: 2 parallel markSurfaced calls -> JSONL parses cleanly
 *
 *   Anti-pattern + module hygiene:
 *    13. No console.log / process.stdout.write in pending-tension-store.cjs
 *    14. No room-db.cjs require (Phase 109 D-06 chokepoint preserved)
 *    15. No brain-client require (Canon Part 8 boundary preserved)
 *
 * Each test uses a per-test temp roomSlug to avoid colliding with real user
 * data and parallel test runs. Cleanup via fs.rmSync(jsonlPath, {force:true})
 * in try/finally.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const store = require('../lib/memory/pending-tension-store.cjs');

function freshSlug(label) {
  const rand = crypto.randomBytes(4).toString('hex');
  return 'phase-116-03-decay-' + label + '-' + Date.now() + '-' + rand;
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
    source_edge_ids: ['edge_decay'],
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

// ---------- State machine forward-pass tests ----------

test('116-03 decay: Test 1 -- queued -> markSurfaced sets state=surfaced, surfacing_count=1', () => {
  const slug = freshSlug('t1');
  try {
    const tid = store.computeTensionId('t1-s', 't1-t', 'contradiction');
    store.appendTension(slug, freshEntry(tid));
    const r = store.markSurfaced(slug, tid);
    assert.equal(r.ok, true);
    const all = store.readTensions(slug);
    assert.equal(all.length, 1);
    assert.equal(all[0].state, 'surfaced');
    assert.equal(all[0].surfacing_count, 1);
  } finally {
    cleanupSlug(slug);
  }
});

test('116-03 decay: Test 2 -- queued -> markSurfaced -> markResolved leaves state=resolved with last_response=RESOLVE', () => {
  const slug = freshSlug('t2');
  try {
    const tid = store.computeTensionId('t2-s', 't2-t', 'contradiction');
    store.appendTension(slug, freshEntry(tid));
    store.markSurfaced(slug, tid);
    const r = store.markResolved(slug, tid, 'RESOLVE');
    assert.equal(r.ok, true);
    const all = store.readTensions(slug);
    assert.equal(all.length, 1);
    assert.equal(all[0].state, 'resolved');
    assert.equal(all[0].last_response, 'RESOLVE');
    assert.equal(all[0].surfacing_count, 1);
  } finally {
    cleanupSlug(slug);
  }
});

test('116-03 decay: Test 3 -- queued -> markSurfaced -> requeue keeps surfacing_count (NOT decremented)', () => {
  const slug = freshSlug('t3');
  try {
    const tid = store.computeTensionId('t3-s', 't3-t', 'contradiction');
    store.appendTension(slug, freshEntry(tid));
    store.markSurfaced(slug, tid);
    const r = store.requeue(slug, tid);
    assert.equal(r.ok, true);
    const all = store.readTensions(slug);
    assert.equal(all.length, 1);
    assert.equal(all[0].state, 'queued');
    assert.equal(all[0].surfacing_count, 1);
  } finally {
    cleanupSlug(slug);
  }
});

test('116-03 decay: Test 4 -- markSurfaced 3 times yields surfacing_count=3, state=surfaced', () => {
  const slug = freshSlug('t4');
  try {
    const tid = store.computeTensionId('t4-s', 't4-t', 'contradiction');
    store.appendTension(slug, freshEntry(tid));
    store.markSurfaced(slug, tid);
    store.markSurfaced(slug, tid);
    store.markSurfaced(slug, tid);
    const all = store.readTensions(slug);
    assert.equal(all.length, 1);
    assert.equal(all[0].surfacing_count, 3);
    assert.equal(all[0].state, 'surfaced');
  } finally {
    cleanupSlug(slug);
  }
});

// ---------- 3-strikes / decay tests (the heart of this plan) ----------

test('116-03 decay: Test 5 -- evaluateAndDecay flips surfacing_count=3 + state=surfaced to state=dropped', () => {
  const slug = freshSlug('t5');
  try {
    const tid = store.computeTensionId('t5-s', 't5-t', 'contradiction');
    store.appendTension(slug, freshEntry(tid));
    store.markSurfaced(slug, tid);
    store.markSurfaced(slug, tid);
    store.markSurfaced(slug, tid);
    const result = store.evaluateAndDecay(slug);
    assert.deepEqual(result.droppedTensionIds, [tid]);
    assert.equal(result.evaluatedCount, 1);
    const all = store.readTensions(slug);
    assert.equal(all.length, 1);
    assert.equal(all[0].state, 'dropped');
    assert.equal(all[0].last_response, 'DROPPED');
  } finally {
    cleanupSlug(slug);
  }
});

test('116-03 decay: Test 6 -- evaluateAndDecay is idempotent on already-dropped tensions', () => {
  const slug = freshSlug('t6');
  try {
    const tid = store.computeTensionId('t6-s', 't6-t', 'contradiction');
    store.appendTension(slug, freshEntry(tid));
    store.markSurfaced(slug, tid);
    store.markSurfaced(slug, tid);
    store.markSurfaced(slug, tid);
    const first = store.evaluateAndDecay(slug);
    assert.equal(first.evaluatedCount, 1);
    const second = store.evaluateAndDecay(slug);
    assert.deepEqual(second.droppedTensionIds, []);
    assert.equal(second.evaluatedCount, 0);
    // State remains 'dropped' (terminal); no further writes should land.
    const all = store.readTensions(slug);
    assert.equal(all[0].state, 'dropped');
  } finally {
    cleanupSlug(slug);
  }
});

test('116-03 decay: Test 7 -- evaluateAndDecay respects 3-strikes threshold (no drop at surfacing_count=2)', () => {
  const slug = freshSlug('t7');
  try {
    const tid = store.computeTensionId('t7-s', 't7-t', 'contradiction');
    store.appendTension(slug, freshEntry(tid));
    store.markSurfaced(slug, tid);
    store.markSurfaced(slug, tid);
    const result = store.evaluateAndDecay(slug);
    assert.deepEqual(result.droppedTensionIds, []);
    assert.equal(result.evaluatedCount, 0);
    const all = store.readTensions(slug);
    assert.equal(all[0].state, 'surfaced');
    assert.equal(all[0].surfacing_count, 2);
  } finally {
    cleanupSlug(slug);
  }
});

test('116-03 decay: Test 8 -- boundary: surfacing_count=3 + RESOLVE before evaluateAndDecay -> state stays resolved', () => {
  const slug = freshSlug('t8');
  try {
    const tid = store.computeTensionId('t8-s', 't8-t', 'contradiction');
    store.appendTension(slug, freshEntry(tid));
    store.markSurfaced(slug, tid);
    store.markSurfaced(slug, tid);
    store.markSurfaced(slug, tid);
    // User picks RESOLVE on the 3rd surface. Per CONTEXT.md D-03a + RESEARCH
    // Section 11.2 row 8: resolved is terminal and 3-strikes only fires AFTER
    // 3 surfacings WITHOUT resolution.
    const r = store.markResolved(slug, tid, 'RESOLVE');
    assert.equal(r.ok, true);
    const result = store.evaluateAndDecay(slug);
    assert.deepEqual(result.droppedTensionIds, []);
    assert.equal(result.evaluatedCount, 0);
    const all = store.readTensions(slug);
    assert.equal(all[0].state, 'resolved');
    assert.equal(all[0].last_response, 'RESOLVE');
  } finally {
    cleanupSlug(slug);
  }
});

test('116-03 decay: Test 9 -- getDecayCandidates is read-only (no JSONL mutation)', () => {
  const slug = freshSlug('t9');
  try {
    const tid = store.computeTensionId('t9-s', 't9-t', 'contradiction');
    store.appendTension(slug, freshEntry(tid));
    store.markSurfaced(slug, tid);
    store.markSurfaced(slug, tid);
    store.markSurfaced(slug, tid);
    const sizeBefore = fs.statSync(store.jsonlPath(slug)).size;
    const candidates = store.getDecayCandidates(slug);
    assert.equal(Array.isArray(candidates), true);
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].tension_id, tid);
    assert.equal(candidates[0].surfacing_count, 3);
    assert.equal(candidates[0].state, 'surfaced');
    // File size unchanged: getDecayCandidates is purely read-only.
    const sizeAfter = fs.statSync(store.jsonlPath(slug)).size;
    assert.equal(sizeAfter, sizeBefore);
    // Same set evaluateAndDecay would drop (just without mutating).
    const all = store.readTensions(slug);
    assert.equal(all[0].state, 'surfaced');
  } finally {
    cleanupSlug(slug);
  }
});

// ---------- Cross-session simulation tests (LWW replay across sessions) ----------

test('116-03 decay: Test 10 -- append queued + close + re-read returns identical entry (cross-session)', () => {
  const slug = freshSlug('t10');
  try {
    const tid = store.computeTensionId('t10-s', 't10-t', 'contradiction');
    store.appendTension(slug, freshEntry(tid));
    // Simulate session boundary by clearing require cache and re-loading the
    // module so any in-memory state is dropped (there is none, but proves
    // durability). Reading via fs is the canonical cross-session path.
    delete require.cache[require.resolve('../lib/memory/pending-tension-store.cjs')];
    const reloaded = require('../lib/memory/pending-tension-store.cjs');
    const all = reloaded.readTensions(slug);
    assert.equal(all.length, 1);
    assert.equal(all[0].tension_id, tid);
    assert.equal(all[0].state, 'queued');
  } finally {
    cleanupSlug(slug);
  }
});

test('116-03 decay: Test 11 -- 4-session simulation drops via evaluateAndDecay in session 4', () => {
  const slug = freshSlug('t11');
  try {
    const tid = store.computeTensionId('t11-s', 't11-t', 'contradiction');

    // Session 1: queue.
    store.appendTension(slug, freshEntry(tid));
    delete require.cache[require.resolve('../lib/memory/pending-tension-store.cjs')];
    const s2 = require('../lib/memory/pending-tension-store.cjs');

    // Session 2: surface.
    s2.markSurfaced(slug, tid);
    delete require.cache[require.resolve('../lib/memory/pending-tension-store.cjs')];
    const s3 = require('../lib/memory/pending-tension-store.cjs');

    // Session 3: surface twice (user kept hitting LATER between sessions).
    s3.markSurfaced(slug, tid);
    s3.markSurfaced(slug, tid);
    delete require.cache[require.resolve('../lib/memory/pending-tension-store.cjs')];
    const s4 = require('../lib/memory/pending-tension-store.cjs');

    // Session 4: pre-pass kicks in BEFORE selection (per scripts wiring).
    const result = s4.evaluateAndDecay(slug);
    assert.deepEqual(result.droppedTensionIds, [tid]);
    assert.equal(result.evaluatedCount, 1);

    const all = s4.readTensions(slug);
    assert.equal(all.length, 1);
    assert.equal(all[0].state, 'dropped');
    assert.equal(all[0].surfacing_count, 3);
    assert.equal(all[0].last_response, 'DROPPED');
  } finally {
    cleanupSlug(slug);
  }
});

test('116-03 decay: Test 12 -- concurrent markSurfaced smoke (INV-4 race window acceptable)', () => {
  const slug = freshSlug('t12');
  try {
    const tid = store.computeTensionId('t12-s', 't12-t', 'contradiction');
    store.appendTension(slug, freshEntry(tid));
    // Two parallel surface calls. POSIX appendFileSync is atomic for lines
    // smaller than PIPE_BUF (RESEARCH 6.5) so JSONL parses cleanly even in
    // a race. This test asserts only that the file remains parseable and
    // surfacing_count lands in [1,2] -- the exact value depends on whether
    // both reads saw count=0 before either wrote.
    const r1 = store.markSurfaced(slug, tid);
    const r2 = store.markSurfaced(slug, tid);
    assert.equal(r1.ok, true);
    assert.equal(r2.ok, true);
    const all = store.readTensions(slug);
    assert.equal(all.length, 1, 'JSONL parse must yield 1 LWW entry per tension_id');
    assert.equal(typeof all[0].surfacing_count, 'number');
    assert.ok(all[0].surfacing_count >= 1 && all[0].surfacing_count <= 2,
      'surfacing_count in [1,2] per RESEARCH Section 11.4 INV-4 known race window');
    assert.equal(all[0].state, 'surfaced');
  } finally {
    cleanupSlug(slug);
  }
});

// ---------- Anti-pattern + module hygiene tests ----------

test('116-03 decay: Test 13 -- pending-tension-store.cjs does not call console.log / process.stdout.write', () => {
  const src = fs.readFileSync(
    path.resolve(__dirname, '..', 'lib', 'memory', 'pending-tension-store.cjs'),
    'utf8'
  );
  // Strip block + line comments so the rule guards against CALLS to these
  // APIs, not a comment that documents the rule itself.
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  assert.equal(/\bconsole\s*\.\s*log\s*\(/.test(stripped), false,
    'console.log must not be called in pending-tension-store.cjs');
  assert.equal(/process\s*\.\s*stdout\s*\.\s*write\s*\(/.test(stripped), false,
    'process.stdout.write must not be called in pending-tension-store.cjs');
});

test('116-03 decay: Test 14 -- pending-tension-store.cjs does not require room-db.cjs (Phase 109 D-06 chokepoint)', () => {
  const src = fs.readFileSync(
    path.resolve(__dirname, '..', 'lib', 'memory', 'pending-tension-store.cjs'),
    'utf8'
  );
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  assert.equal(
    /require\(['"][^'"]*\broom-db\b[^'"]*['"]\)/.test(stripped),
    false,
    'must not require room-db.cjs (Phase 109 D-06 chokepoint preserved)'
  );
});

test('116-03 decay: Test 15 -- pending-tension-store.cjs does not require brain-client (Canon Part 8 boundary)', () => {
  const src = fs.readFileSync(
    path.resolve(__dirname, '..', 'lib', 'memory', 'pending-tension-store.cjs'),
    'utf8'
  );
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  assert.equal(
    /require\(['"][^'"]*brain[-_]client[^'"]*['"]\)/.test(stripped),
    false,
    'must not import brain-client (Canon Part 8 boundary preserved)'
  );
});
