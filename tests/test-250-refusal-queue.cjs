#!/usr/bin/env node
'use strict';

/**
 * Phase 250 Plan 01, Task 2 (HONEST-01) -- CLI-path render helper +
 * refusal auto-queue seam.
 * ==========================================================================
 *   Test 1: refuseNotReady(roomDir, miss) lands ONE entry in
 *     roomDir/.mindrian/enrichment-queue.json with source 'refusal', and
 *     returns a refusalResponse whose kind is 'not_ready', status
 *     'GRAPH_NOT_READY', and reason naming the framework, the readiness
 *     N/4, the missing dimensions, and the queue disclosure.
 *   Test 2 (idempotent merge): a pre-seeded live_reach entry for the same
 *     framework merges with a refusal render into ONE entry, hit_count
 *     incremented, source stays live (never downgraded).
 *   Test 3 (never throws): an unwritable/absent roomDir still returns the
 *     refusalResponse and never throws.
 *   Test 4: renderRefusal(kind, ctx) returns a non-empty multi-line string
 *     for each of the four kinds; not_ready contains the queue disclosure;
 *     unreachable never contains the no-key reason string.
 *   Test 5 (binding scope guard): zero requires of refusal-messaging refusal
 *     symbols reachable from lib/core/sensors/ or the decide() path (the
 *     249 Pitfall-6 hot-path fence, extended to the refusal seam).
 *
 * node --test, CJS, node:assert/strict + temp room dirs (the
 * test-249-enrichment-queue.cjs precedent). No new deps. No em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const REPO_ROOT = path.resolve(__dirname, '..');
const CHOKEPOINT_PATH = path.join(REPO_ROOT, 'lib', 'core', 'refusal-messaging.cjs');
const QUEUE_RELATIVE = path.join('.mindrian', 'enrichment-queue.json');

function freshChokepoint() {
  delete require.cache[CHOKEPOINT_PATH];
  return require(CHOKEPOINT_PATH);
}

function freshRoom() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'test-250-refusal-queue-'));
}

function readQueueFile(roomDir) {
  const p = path.join(roomDir, QUEUE_RELATIVE);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// ---------------------------------------------------------------------------
// Test 1: refuseNotReady lands one entry, source 'refusal'.
// ---------------------------------------------------------------------------
test('Test 1: refuseNotReady lands ONE queue entry (source refusal) and returns the not_ready refusalResponse', () => {
  const mod = freshChokepoint();
  const roomDir = freshRoom();

  const result = mod.refuseNotReady(roomDir, {
    tool: 'orchestration_readiness',
    framework: 'Six Thinking Hats',
    readiness_score: 1,
    missing_dimensions: ['structure', 'flow'],
    context_class: { reach_id: 'r1', dispatch: 'chat', problem_type: 'unclear', trigger_tier: 'passive' },
    probe_provenance: 'orchestration_readiness@2026-08-10T00:00:00.000Z',
  });

  assert.equal(result.kind, 'not_ready');
  assert.equal(result.status, 'GRAPH_NOT_READY');
  assert.match(result.reason, /Six Thinking Hats/);
  assert.match(result.reason, /1\/4/);
  assert.match(result.reason, /structure/);
  assert.match(result.reason, /flow/);
  assert.match(result.reason, /[Qq]ueued for enrichment/);

  const q = readQueueFile(roomDir);
  assert.ok(q, 'a queue file must have been written');
  assert.equal(q.entries.length, 1);
  assert.equal(q.entries[0].framework, 'Six Thinking Hats');
  assert.equal(q.entries[0].source, 'refusal');
});

// ---------------------------------------------------------------------------
// Test 2: idempotent merge with an existing live_reach entry.
// ---------------------------------------------------------------------------
test('Test 2: a refusal merges idempotently with an existing live_reach entry, hit_count increments, source stays live', () => {
  const mod = freshChokepoint();
  const enrichmentQueue = require(path.join(REPO_ROOT, 'lib', 'core', 'enrichment-queue.cjs'));
  const roomDir = freshRoom();

  const seeded = enrichmentQueue.enqueue(roomDir, {
    framework: 'PEST Analysis',
    readiness_score: 1,
    missing_dimensions: ['structure'],
    context_class: null,
    source: 'live_reach',
    probe_provenance: 'orchestration_readiness@seed',
  });
  assert.equal(seeded.queued, true);

  mod.refuseNotReady(roomDir, {
    tool: 'orchestration_readiness',
    framework: 'PEST Analysis',
    readiness_score: 1,
    missing_dimensions: ['structure'],
  });

  const q = readQueueFile(roomDir);
  assert.equal(q.entries.length, 1, 'exactly one entry must remain -- the merge, not a second row');
  assert.equal(q.entries[0].hit_count, 1, 'hit_count must increment on the merge');
  assert.ok(['live_reach', 'refusal'].includes(q.entries[0].source), 'the merged entry must still report a live source (never downgraded to census_seed)');
});

// ---------------------------------------------------------------------------
// Test 3: never throws, even with an unwritable/absent roomDir.
// ---------------------------------------------------------------------------
test('Test 3: refuseNotReady never throws into the caller, even with an unwritable roomDir', () => {
  const mod = freshChokepoint();

  assert.doesNotThrow(() => {
    const result = mod.refuseNotReady('/nonexistent/definitely/not/writable/room-dir-250', {
      framework: 'Beautiful Question',
      readiness_score: 0,
      missing_dimensions: ['pattern_type'],
    });
    assert.equal(result.kind, 'not_ready', 'the refusalResponse must still be returned even when the enqueue fails');
  });

  assert.doesNotThrow(() => {
    const result = mod.refuseNotReady(null, { framework: 'Lean Canvas' });
    assert.equal(result.kind, 'not_ready');
  });
});

// ---------------------------------------------------------------------------
// Test 4: renderRefusal shapes per kind.
// ---------------------------------------------------------------------------
test('Test 4: renderRefusal returns a non-empty multi-line string for each kind; not_ready discloses the queue; unreachable never conflates', () => {
  const mod = freshChokepoint();

  for (const kind of mod.REFUSAL_KINDS) {
    const rendered = mod.renderRefusal(kind, { tool: 'brain_query', framework: 'SWOT Analysis', readiness_score: 2, missing_dimensions: ['flow'], message: 'MoatViolation: tool not allowed' });
    assert.equal(typeof rendered, 'string', 'renderRefusal must return a string for kind=' + kind);
    assert.ok(rendered.length > 0, 'must be non-empty for kind=' + kind);
    assert.ok(rendered.includes('\n'), 'must be multi-line for kind=' + kind);
  }

  const notReady = mod.renderRefusal('not_ready', { framework: 'SWOT Analysis', readiness_score: 1, missing_dimensions: ['structure'] });
  assert.match(notReady, /queued.*for enrichment/i);

  const unreachable = mod.renderRefusal('unreachable', { tool: 'brain_query' });
  assert.ok(!unreachable.includes('MINDRIAN_BRAIN_KEY not set'));
});

// ---------------------------------------------------------------------------
// Test 5: binding scope guard -- no refusal seam reachable from sensors/decide.
// ---------------------------------------------------------------------------
test('Test 5 (binding scope guard): zero refusal-messaging requires under lib/core/sensors/ or the decide() path', () => {
  const sensorsDir = path.join(REPO_ROOT, 'lib', 'core', 'sensors');
  const navigationEngine = path.join(REPO_ROOT, 'lib', 'core', 'navigation-engine.cjs');
  const requirePattern = /require\(\s*['"][^'"]*refusal-messaging\.cjs['"]\s*\)/;

  if (fs.existsSync(sensorsDir)) {
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!entry.name.endsWith('.cjs') || entry.name.endsWith('.test.cjs')) continue;
        const src = fs.readFileSync(full, 'utf8');
        assert.ok(!requirePattern.test(src), 'FORBIDDEN refusal-messaging require found in ' + full);
      }
    };
    walk(sensorsDir);
  }

  if (fs.existsSync(navigationEngine)) {
    const src = fs.readFileSync(navigationEngine, 'utf8');
    assert.ok(!requirePattern.test(src), 'FORBIDDEN refusal-messaging require found in lib/core/navigation-engine.cjs');
  }
});
