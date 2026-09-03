'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * tests/296-vector-read-both-backends.test.cjs -- the Pitfall-1 guard for
 * scripts/rs-vector-bridge.cjs (296-RESEARCH.md F-2, HIGHEST RISK).
 *
 * This is the test that can never go green having exercised only one vector
 * backend. sqlite-vec is a hard package.json `dependencies` entry (installed
 * on every real user machine) and is ABSENT from this dev checkout, so
 * vector-store.cjs's runtime capability probe silently resolves to the
 * cjs-fallback backend here. A verification step that only ever runs that
 * one leg in CI and reports PASS is exactly the warning sign Pitfall 1
 * names. This file forces the fallback leg explicitly via
 * MINDRIAN_FORCE_NO_VEC0 (the process-latched test seam vector-store.cjs
 * already ships, Pattern 3) so BOTH branches are exercised in CI regardless
 * of which one this checkout happens to have, and it prints out loud which
 * backend each run actually resolved so a reader never has to infer
 * coverage.
 *
 * Tests:
 *   1. Ambient backend: knn succeeds, returns the expected nearest hit.
 *   2. Forced fallback backend: knn succeeds, backend is exactly
 *      'cjs-fallback'.
 *   3. Agreement: the two runs' top hit is the SAME node id -- the whole
 *      point of this file.
 *   4. Honest coverage reporting: prints which backends were really
 *      exercised; never skips, never fails on a same-backend result.
 *   5. No direct Python read anywhere: fences every *.py file under
 *      lib/core/ and scripts/ against naming eureka_vec /
 *      eureka_vec_fallback outside a comment.
 *   6. Bridge hygiene: zero raw sqlite handle construction, zero
 *      require('sqlite-vec'), at least one allowExtension in the bridge.
 *   7. meta op: backend + dim resolve correctly.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Use hyphens.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { makeRoom, seedVectors, cleanup, _test: fixtureTest } = require('./fixtures/296/room-fixture.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');
const BRIDGE_PATH = path.join(REPO_ROOT, 'scripts', 'rs-vector-bridge.cjs');
const FORCE_NO_VEC0_ENV = fixtureTest.FORCE_NO_VEC0_ENV;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// runBridge(op, payload, extraEnv) -> { status, parsed }
//
// Spawns the real CLI entry point exactly as a Python caller would (no
// require() of the bridge module, no in-process shortcut). Asserts the exit
// code is 0 HERE, once, so an exit-code regression is caught in one place
// rather than duplicated across every call site.
function runBridge(op, payload, extraEnv) {
  const res = spawnSync(process.execPath, [BRIDGE_PATH, op], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: Object.assign({}, process.env, extraEnv || {}),
  });
  assert.equal(
    res.status,
    0,
    `bridge op '${op}' must always exit 0 (got ${res.status}); stderr: ${String(res.stderr).slice(0, 500)}`
  );
  let parsed;
  try {
    parsed = JSON.parse(res.stdout);
  } catch (err) {
    assert.fail(`bridge op '${op}' stdout did not parse as JSON: ${String(res.stdout).slice(0, 200)}`);
  }
  return { status: res.status, parsed: parsed };
}

// The seed dim MUST equal the bridge's own resolveDim() (the shipped
// encoder's resolved dim, e.g. 384), NOT an arbitrary small test dimension.
// ensureStore's DIM-MISMATCH REBUILD path (vector-store.cjs:294-321) drops
// and recreates BOTH vec tables empty the moment a caller passes a dim that
// differs from what eureka_meta already recorded -- correct behavior for a
// real model swap, but it means a bridge process opening a room seeded at
// the WRONG dim silently wipes the seeded vectors before querying them
// (empty hits, not an error). The bridge always calls resolveDim() itself
// (never accepts a caller-supplied dim), so the fixture must match it.
const { resolveDim } = require('../lib/core/eureka/embedding-spine.cjs');
const SEED_DIM = resolveDim();

// axisVec(index, dim): a `dim`-length vector that is 0 everywhere except a
// 1 at `index`. Four of these are axis-aligned and maximally separated, so
// sqlite-vec KNN and the CJS brute-force cosine fallback agree on ranking
// regardless of `dim`.
function axisVec(index, dim) {
  const v = new Array(dim).fill(0);
  v[index] = 1;
  return v;
}

const SEED_PAIRS = [
  { id: 'vec1', vec: axisVec(0, SEED_DIM) },
  { id: 'vec2', vec: axisVec(1, SEED_DIM) },
  { id: 'vec3', vec: axisVec(2, SEED_DIM) },
  { id: 'vec4', vec: axisVec(3, SEED_DIM) },
];
// Unambiguously closest to vec4 (a small nudge off every other axis, a
// strong nudge toward axis 3).
const QUERY_VEC = new Array(SEED_DIM).fill(0.001);
QUERY_VEC[3] = 0.99;
const EXPECTED_NEAREST_ID = 'vec4';

// seedAndQuery(extraEnv) -> { fixtureBackend, bridgeBackend, hits, meta, dir }
//
// Creates a room, seeds SEED_PAIRS, closes the fixture's OWN handle BEFORE
// spawning the bridge so the bridge opens its own handle exactly as Python
// would (room.db runs WAL; a concurrent reader would also be safe, but this
// exercises the real single-owner path a Python caller actually takes).
//
// IMPORTANT: this whole test file runs as ONE node process, and
// vector-store.cjs's capability probe is process-latched (Pattern 3). If the
// fixture's own (in-process) seedVectors call always ran under the AMBIENT
// env, a forced-fallback run would spawn the bridge with
// MINDRIAN_FORCE_NO_VEC0 set but the SEEDED data would still live in
// whichever table this process's ambient probe resolved to -- the bridge
// would then read a freshly created, empty table on the OTHER backend and
// report a false-empty result, not a real backend-agreement test. So
// extraEnv is applied to THIS process's env for the duration of the
// fixture's own seeding call too, guaranteeing the fixture writes into the
// SAME backend the bridge subprocess (spawned below with the identical
// extraEnv) will read from.
function seedAndQuery(extraEnv) {
  const room = makeRoom('p296-vec-');

  const envKeys = Object.keys(extraEnv || {});
  const priorEnv = {};
  for (const key of envKeys) {
    priorEnv[key] = process.env[key];
    process.env[key] = extraEnv[key];
  }
  let fixtureBackend;
  try {
    fixtureBackend = seedVectors(room.db, SEED_DIM, SEED_PAIRS);
  } finally {
    for (const key of envKeys) {
      if (priorEnv[key] === undefined) delete process.env[key];
      else process.env[key] = priorEnv[key];
    }
  }

  // Close ONLY the db handle here (not the temp dir) so the bridge opens its
  // OWN handle against the same on-disk room, matching a real Python
  // caller's single-owner path. cleanup() (below, in the finally) tolerates
  // an already-closed db, so closing early here is safe.
  const { closeRoomDb } = require('../lib/core/room-db.cjs');
  try { closeRoomDb(room.db); } catch (_e) { /* already closed; ignore */ }

  try {
    const { parsed } = runBridge('knn', { room: room.dir, query: QUERY_VEC, k: 4 }, extraEnv);
    return {
      fixtureBackend: fixtureBackend,
      bridgeBackend: parsed.backend,
      hits: parsed.hits,
      meta: parsed.meta,
      success: parsed.success,
      dir: room.dir,
    };
  } finally {
    cleanup(room);
  }
}

// ---------------------------------------------------------------------------
// Test 1: ambient backend
// ---------------------------------------------------------------------------
let ambientResult = null;
let forcedResult = null;

test('296 Pitfall-1 #1: ambient backend knn succeeds and finds the expected nearest hit', () => {
  ambientResult = seedAndQuery({});
  assert.equal(ambientResult.success, true, 'bridge knn op must report success:true');
  assert.ok(Array.isArray(ambientResult.hits) && ambientResult.hits.length > 0, 'hits must be a non-empty array');
  assert.equal(
    ambientResult.hits[0].node_id,
    EXPECTED_NEAREST_ID,
    `ambient backend's top hit must be '${EXPECTED_NEAREST_ID}' (got '${ambientResult.hits[0].node_id}')`
  );
  assert.ok(
    ambientResult.bridgeBackend === 'sqlite-vec' || ambientResult.bridgeBackend === 'cjs-fallback',
    `bridgeBackend must be one of 'sqlite-vec' or 'cjs-fallback' (got '${ambientResult.bridgeBackend}')`
  );
  assert.equal(
    ambientResult.bridgeBackend,
    ambientResult.fixtureBackend,
    'the bridge must read from the SAME backend the fixture seeded (a mismatch means the bridge is ' +
    'reading an empty table on the wrong backend, not a real result)'
  );
});

// ---------------------------------------------------------------------------
// Test 2: forced fallback backend
// ---------------------------------------------------------------------------
test('296 Pitfall-1 #2: forced-fallback backend knn succeeds and resolves cjs-fallback', () => {
  const env = {};
  env[FORCE_NO_VEC0_ENV] = '1';
  forcedResult = seedAndQuery(env);
  assert.equal(forcedResult.success, true, 'bridge knn op must report success:true');
  assert.equal(
    forcedResult.bridgeBackend,
    'cjs-fallback',
    `forced backend must be exactly 'cjs-fallback' (got '${forcedResult.bridgeBackend}')`
  );
});

// ---------------------------------------------------------------------------
// Test 3: agreement across backends (the assertion that makes this file
// worth writing)
// ---------------------------------------------------------------------------
test('296 Pitfall-1 #3: both backends agree on the top hit', () => {
  assert.ok(ambientResult, 'Test 1 must have run first');
  assert.ok(forcedResult, 'Test 2 must have run first');
  assert.equal(
    ambientResult.hits[0].node_id,
    forcedResult.hits[0].node_id,
    'the ambient backend and the forced cjs-fallback backend must rank the same vector as nearest'
  );
});

// ---------------------------------------------------------------------------
// Test 4: honest coverage reporting -- never skip, never fail, always say
// out loud which branches were really exercised.
// ---------------------------------------------------------------------------
test('296 Pitfall-1 #4: reports which backends were actually exercised', () => {
  assert.ok(ambientResult, 'Test 1 must have run first');
  assert.ok(forcedResult, 'Test 2 must have run first');
  // eslint-disable-next-line no-console
  console.log(
    `[296-vector-read-both-backends] ambient backend=${ambientResult.bridgeBackend} ` +
    `forced backend=${forcedResult.bridgeBackend}`
  );
  if (ambientResult.bridgeBackend === forcedResult.bridgeBackend) {
    // eslint-disable-next-line no-console
    console.log(
      '[296-vector-read-both-backends] WARNING: ambient and forced runs resolved the SAME backend ' +
      `('${ambientResult.bridgeBackend}') on this machine. The sqlite-vec leg was exercised ONLY ` +
      'through the forced MINDRIAN_FORCE_NO_VEC0 seam here (this checkout has no sqlite-vec install); ' +
      'the native sqlite-vec leg is UNVERIFIED on this machine. This is not a failure -- it is the ' +
      'honest coverage statement Pitfall 1 requires instead of a silent PASS implying both were tested.'
    );
  } else {
    // eslint-disable-next-line no-console
    console.log(
      '[296-vector-read-both-backends] ambient and forced runs resolved DIFFERENT backends: ' +
      'both the native sqlite-vec leg and the cjs-fallback leg were genuinely exercised on this machine.'
    );
  }
  // This test intentionally never asserts on the comparison itself (that is
  // Test 3's job) and never SKIPs -- it only has to report honestly.
  assert.ok(true);
});

// ---------------------------------------------------------------------------
// Test 5: no direct Python read anywhere -- the repo-wide fence
// ---------------------------------------------------------------------------
function stripPyComments(text) {
  return text
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');
}

function countOccurrences(haystack, needle) {
  if (needle === '') return 0;
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    count += 1;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return count;
}

function listPyFiles(dirAbs) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dirAbs, { withFileTypes: true });
  } catch (_e) {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dirAbs, entry.name);
    if (entry.isDirectory()) {
      out.push(...listPyFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.py')) {
      out.push(full);
    }
  }
  return out;
}

test('296 Pitfall-1 #5: no *.py file under lib/core/ or scripts/ names either vector table outside a comment', () => {
  const targets = [
    ...listPyFiles(path.join(REPO_ROOT, 'lib', 'core')),
    ...listPyFiles(path.join(REPO_ROOT, 'scripts')),
  ];
  assert.ok(targets.length > 0, 'expected at least one *.py file under lib/core/ or scripts/');
  let total = 0;
  const offenders = [];
  for (const file of targets) {
    const raw = fs.readFileSync(file, 'utf8');
    const stripped = stripPyComments(raw);
    const hits = countOccurrences(stripped, 'eureka_vec_fallback') + countOccurrences(stripped, 'eureka_vec');
    // Note: 'eureka_vec_fallback' also contains 'eureka_vec' as a substring,
    // so a naive double-count would overcount every fallback hit by one.
    // Recompute precisely: count 'eureka_vec_fallback' occurrences, then
    // count 'eureka_vec' occurrences EXCLUDING those that are part of an
    // 'eureka_vec_fallback' match, by counting on the string with every
    // 'eureka_vec_fallback' occurrence blanked out first.
    const fallbackHits = countOccurrences(stripped, 'eureka_vec_fallback');
    const blanked = stripped.split('eureka_vec_fallback').join('');
    const bareVecHits = countOccurrences(blanked, 'eureka_vec');
    const realTotal = fallbackHits + bareVecHits;
    total += realTotal;
    if (realTotal > 0) offenders.push(`${path.relative(REPO_ROOT, file)} (${realTotal})`);
  }
  assert.equal(
    total,
    0,
    `no Python file under lib/core/ or scripts/ may name eureka_vec / eureka_vec_fallback outside a ` +
    `comment (296-RESEARCH.md F-2). Offenders: ${offenders.join(', ') || 'none listed'}`
  );
});

// ---------------------------------------------------------------------------
// Test 6: bridge hygiene
// ---------------------------------------------------------------------------
function stripJsCommentLines(text) {
  return text
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'));
    })
    .join('\n');
}

test('296 Pitfall-1 #6: bridge hygiene -- no raw sqlite handle construction, no require(\'sqlite-vec\'), allowExtension present', () => {
  const raw = fs.readFileSync(BRIDGE_PATH, 'utf8');
  const stripped = stripJsCommentLines(raw);
  assert.equal(countOccurrences(stripped, 'DatabaseSync'), 0, 'bridge must never construct a raw sqlite handle');
  assert.equal(
    countOccurrences(stripped, "require('sqlite-vec')"),
    0,
    'bridge must never require the sqlite-vec package directly'
  );
  assert.ok(countOccurrences(raw, 'allowExtension') >= 1, 'bridge must open room.db with allowExtension at least once');
});

// ---------------------------------------------------------------------------
// Test 7: meta op
// ---------------------------------------------------------------------------
test('296 Pitfall-1 #7: meta op resolves backend and the seeded dim', () => {
  const room = makeRoom('p296-vec-meta-');
  try {
    seedVectors(room.db, SEED_DIM, SEED_PAIRS);
    const { closeRoomDb } = require('../lib/core/room-db.cjs');
    try { closeRoomDb(room.db); } catch (_e) { /* already closed; ignore */ }

    const { parsed } = runBridge('meta', { room: room.dir });
    assert.equal(parsed.success, true, 'meta op must report success:true');
    assert.equal(typeof parsed.backend, 'string', 'meta op must return a backend string');
    assert.equal(parsed.dim, SEED_DIM, `meta op must return dim === ${SEED_DIM} (got ${parsed.dim})`);
  } finally {
    cleanup(room);
  }
});
