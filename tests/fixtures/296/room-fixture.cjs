'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * tests/fixtures/296/room-fixture.cjs -- the shared both-backends room helper
 * for Phase 296 (SEED-030). Lives under tests/fixtures/296/, NOT under
 * tests/, so tests/run-all-296.sh's tests/296-*.test.cjs glob can never pick
 * this file up and try to execute it as a test.
 *
 * This composes two already-shipped modules; it owns no logic of its own:
 *   lib/core/room-db.cjs::openRoomDb   - WAL + synchronous + timeout:5000 +
 *     the full migration chain, the single door to room.db
 *   lib/core/eureka/vector-store.cjs::ensureStore/insertVector - backend
 *     selection (sqlite-vec vs cjs-fallback) via a process-latched probe
 *
 * Never open a native sqlite handle directly and never pull in the native
 * vector extension package by name here. Both are owned exactly once, by
 * the two modules above (296-RESEARCH.md Findings F-1/F-2/Pattern 1 --
 * caller-owned db handle, never a second door).
 *
 * Pitfall 1 (296-RESEARCH.md, HIGHEST RISK): sqlite-vec is a hard
 * package.json `dependencies` entry on every real user install but is
 * ABSENT from this dev checkout, so `ensureStore` silently resolves to the
 * `cjs-fallback` backend here while resolving to `sqlite-vec` on a real
 * install. seedVectors() returns the resolved backend string precisely so a
 * caller can assert WHICH backend it actually exercised instead of assuming
 * -- a test that only ever runs the fallback leg in CI and reports "both
 * backends covered" is exactly this pitfall.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Use hyphens.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { openRoomDb, closeRoomDb } = require('../../../lib/core/room-db.cjs');
const { ensureStore, insertVector } = require('../../../lib/core/eureka/vector-store.cjs');

// makeRoom(prefix) -> { dir, db }
//
// allowExtension: true is REQUIRED, not optional: on a plain handle (the
// zero-arg openRoomDb(dir) call every other caller in this repo uses),
// vector-store.cjs's ensureVecLoaded silently degrades to the cjs-fallback
// backend even when the native vector extension is installed, because
// extension loading is disabled at construction time on a plain handle. A
// both-backends test built on a plain handle would silently only ever
// exercise one backend -- see the Pitfall 1 note above.
function makeRoom(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const db = openRoomDb(dir, { allowExtension: true });
  return { dir, db };
}

// seedVectors(db, dim, pairs) -> backend ('sqlite-vec' | 'cjs-fallback')
//
// pairs: [{ id, vec }]. Resolves the store at `dim`, inserts every pair, and
// returns the ACTUAL resolved backend so a caller asserts rather than
// assumes which leg it exercised.
function seedVectors(db, dim, pairs) {
  const { backend } = ensureStore(db, dim);
  for (const pair of pairs) {
    insertVector(db, pair.id, pair.vec);
  }
  return backend;
}

// cleanup(handle) -- never throws. Closes the db handle (try/catch, mirrors
// closeRoomDb's own already-closed tolerance) then removes the temp dir this
// SAME makeRoom() call created. Takes no caller-supplied path and never a
// relative path, so it can only ever remove a directory it minted itself
// (T-296-08).
function cleanup(handle) {
  try {
    closeRoomDb(handle.db);
  } catch (_e) {
    // already closed; ignore, mirrors closeRoomDb's own tolerance
  }
  try {
    fs.rmSync(handle.dir, { recursive: true, force: true });
  } catch (_e) {
    // best-effort; never throw from cleanup
  }
}

// _test: named seams a consuming test can reference instead of hard-coding
// the raw string in three places.
const _test = Object.freeze({
  FORCE_NO_VEC0_ENV: 'MINDRIAN_FORCE_NO_VEC0',
});

module.exports = { makeRoom, seedVectors, cleanup, _test };
