'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * quick(260706-13z) -- the D1 vector-store adapter seam (SEED-049 D1).
 *
 * The ONE file that owns eureka's vector persistence end to end: table
 * creation at the RESOLVED dim, per-node insert/delete, knn query, and the
 * eureka_meta bookkeeping (embedding_model + embedding_dim per room). Phase
 * 211-02's tri-modal-index.cjs is now a delegating CONSUMER of this module; its
 * public API (openIndex / indexNodes / lexicalSearch / vectorSearch / nodeText)
 * is byte-compatible for its two consumers (hybrid-retrieve.cjs,
 * eureka-room-report.cjs), so a backend swap is a change to THIS FILE ONLY.
 *
 * --------------------------------------------------------------------------
 * SEED-049 D1 (keep sqlite-vec, add guardrails) -- the verbatim requirements:
 * --------------------------------------------------------------------------
 *  - sqlite-vec is pinned ">=0.1.9" in package.json (the 0.1.9 DELETE-corruption
 *    fix matters for a continuously-updating store: eureka re-indexes on every
 *    room change, so DELETE correctness is not optional).
 *  - CONTINGENCY FORK: if upstream sqlite-vec goes quiet again (the 2025
 *    maintenance scare, issue #226, single-maintainer risk), the drop-in
 *    replacement is vlasky/sqlite-vec. The mitigation is THIS SEAM, not hope:
 *    adopting the fork is a one-line require change here, nothing else moves.
 *  - WATCH: sqlite-vec v0.1.10 lands an IVF/DiskANN ANN path. Adopting it (for
 *    corpora past brute-force scale) is likewise a change to THIS FILE ONLY.
 *    No new code for either contingency ships now; the seam is the insurance.
 *
 * T-211-03 mitigation (preserved from tri-modal-index.cjs): the extension is
 * loaded ONLY from require('sqlite-vec').getLoadablePath() (the vetted package),
 * NEVER from an env-supplied path.
 *
 * --------------------------------------------------------------------------
 * CANON PART 9 (Memory Locality) BOUNDARY: this module writes ONLY the derived
 * vec tables (eureka_vec OR eureka_vec_fallback) plus the eureka_meta key/value
 * bookkeeping table -- all rebuildable projections of the nodes table. It
 * writes ZERO typed edges, ZERO memory_event rows, ZERO node mutations. A model
 * migration is a re-embed job (drop + rebuild the projections at the new dim),
 * exactly the SEED-049 D3 recommendation.
 *
 * CALLER-OWNED HANDLES: every function takes a db handle the CALLER opened. This
 * file NEVER opens room.db and NEVER requires room-db.cjs, so the pre-commit
 * navigation allow-list stays intact. The sqlite-vec primary leg needs a handle
 * built with allowExtension:true; on any plain handle it silently degrades to
 * the CJS cosine fallback.
 * --------------------------------------------------------------------------
 *
 * Exports:
 *   ensureStore(db, dim)            -> { backend:'sqlite-vec'|'cjs-fallback', dim }
 *   readMeta(db)                    -> { embedding_model, embedding_dim } | {}
 *   writeMeta(db, { embedding_model, embedding_dim })
 *   insertVector(db, nodeId, vec)   (delete-then-insert; backend-agnostic)
 *   deleteVector(db, nodeId)
 *   knnQuery(db, queryVec, k)       -> [{ node_id, score }] (higher is better)
 *   _test                           -> Float32 BLOB helpers + table probes
 *
 * Pure CJS, node built-ins + one OPTIONAL lazy dep (sqlite-vec). Never throws
 * across a boundary; every failure degrades.
 */

const { cosineSimilarity } = require('../rs-pinecone-bridge.cjs');

// ---------- table probes ----------

function tableExists(db, name) {
  try {
    const r = db.prepare('SELECT name FROM sqlite_master WHERE name = ?').get(name);
    return !!r;
  } catch (_e) {
    return false;
  }
}

// ---------- vec0 capability probe (Blocker 2 fix, quick 260706-5b7) ----------
//
// Backend selection is PROBE-BASED, never table-existence-based. The old
// createVecTable short-circuited on `tableExists(db, 'eureka_vec')` and returned
// 'sqlite-vec' BEFORE loading the extension in this process; a stale eureka_vec
// virtual table persisted by a prior capable run then poisoned the next process,
// whose first prepared statement naming eureka_vec threw 'no such module: vec0'.
//
// The honest contract: probe whether vec0 actually works on THIS process's
// handle (require sqlite-vec + enableLoadExtension + loadExtension from the
// vetted getLoadablePath ONLY, per T-211-03, + SELECT vec_version()); select the
// sqlite-vec leg only on a passing probe; register the handle so every
// eureka_vec touch is gated on that registration; a stale vec0 table is never
// queried again and can never poison the cjs-fallback path.
//
// The verdict is computed AT MOST ONCE per process (the _pipelineCache idiom):
// _vecProbeComputations counts null->verdict transitions and is the once-per-
// process proof the tests assert. A real probe failure emits exactly ONE quiet
// stderr line; the forced test seam (_forceVec0Unavailable opt or the
// MINDRIAN_FORCE_NO_VEC0 env) emits none.

let _vecVerdict = null;          // null | { ok: boolean, detail: string }
let _vecProbeComputations = 0;   // increments on each null->verdict assignment
const _vecLoadedHandles = new WeakSet(); // db handles with vec0 registered here

// ensureVecLoaded: the capability probe. Returns { ok, detail? }. Never throws.
function ensureVecLoaded(db, opts) {
  const options = opts || {};

  // (a) Forced seam: opt or non-empty env var. Silent (mirrors embedding-spine's
  // _forceUnavailable short-circuit). Latches the process verdict once.
  const forcedEnv = process.env.MINDRIAN_FORCE_NO_VEC0;
  if (options._forceVec0Unavailable || (typeof forcedEnv === 'string' && forcedEnv !== '')) {
    if (_vecVerdict === null) {
      _vecVerdict = { ok: false, detail: 'forced_unavailable' };
      _vecProbeComputations += 1;
    }
    return { ok: false, detail: 'forced_unavailable' };
  }

  // (b) Registry hit: never re-load on a handle already registered this process.
  if (_vecLoadedHandles.has(db)) return { ok: true };

  // (c) Cached fail: a prior real probe failed; do not re-attempt, no second line.
  if (_vecVerdict && _vecVerdict.ok === false) return _vecVerdict;

  // (d) Attempt the canonical load, once, inside one try/catch.
  try {
    // eslint-disable-next-line global-require
    const sqliteVec = require('sqlite-vec');
    if (typeof db.enableLoadExtension === 'function') {
      db.enableLoadExtension(true);
    }
    // T-211-03: the load path comes ONLY from getLoadablePath(), NEVER an env.
    db.loadExtension(sqliteVec.getLoadablePath());
    const ver = db.prepare('SELECT vec_version() AS v').get();
    if (!ver || !ver.v) throw new Error('vec_version unavailable');
    _vecLoadedHandles.add(db);
    if (_vecVerdict === null) {
      _vecVerdict = { ok: true, detail: 'vec_version=' + ver.v };
      _vecProbeComputations += 1;
    }
    return { ok: true };
  } catch (err) {
    const message = String((err && err.message) || err);
    // (e) The extension is known-good this process but THIS handle failed (a
    // plain handle with loading disabled at creation): a per-handle fail that
    // preserves the documented silent plain-handle degrade. Do NOT flip the
    // process verdict, do NOT emit stderr.
    if (_vecVerdict && _vecVerdict.ok === true) {
      return { ok: false, detail: message };
    }
    // First-ever attempt failed: latch the process fail verdict and emit ONE
    // quiet line, wrapped in its own try/catch exactly like maybeEmitDownloadNotice.
    if (_vecVerdict === null) {
      _vecVerdict = { ok: false, detail: message };
      _vecProbeComputations += 1;
      try {
        process.stderr.write(
          'MindrianOS: sqlite-vec unavailable (' + message
          + '); eureka semantic search uses the CJS cosine fallback.\n'
        );
      } catch (_e) { /* never let a logging failure break selection */ }
    }
    return _vecVerdict;
  }
}

// vecProbe / resetVecProbe: test-only introspection of the process verdict.
function vecProbe() {
  return { verdict: _vecVerdict, computations: _vecProbeComputations };
}

function resetVecProbe() {
  _vecVerdict = null;
  _vecProbeComputations = 0;
  // The WeakSet needs no reset: tests use fresh handles per case.
}

// ---------- Float32 BLOB helpers (moved from tri-modal-index.cjs) ----------

function vecToBlob(vec) {
  return Buffer.from(Float32Array.from(vec).buffer);
}

function blobToVec(blob) {
  const buf = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
  const f = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
  return Array.from(f);
}

// ---------- eureka_meta (key/value per-room bookkeeping) ----------

function ensureMetaTable(db) {
  db.exec('CREATE TABLE IF NOT EXISTS eureka_meta(key TEXT PRIMARY KEY, value TEXT)');
}

function readMetaValue(db, key) {
  try {
    const r = db.prepare('SELECT value FROM eureka_meta WHERE key = ?').get(key);
    return r ? r.value : null;
  } catch (_e) {
    return null;
  }
}

function writeMetaValue(db, key, value) {
  db.prepare(
    'INSERT INTO eureka_meta(key, value) VALUES (?, ?) '
    + 'ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, String(value));
}

// readMeta: the public read. Returns embedding_model + embedding_dim (dim as a
// number when present). Missing keys are simply absent from the object.
function readMeta(db) {
  ensureMetaTable(db);
  const out = {};
  const model = readMetaValue(db, 'embedding_model');
  if (model != null) out.embedding_model = model;
  const dimRaw = readMetaValue(db, 'embedding_dim');
  if (dimRaw != null) {
    const n = Number(dimRaw);
    if (Number.isInteger(n) && n > 0) out.embedding_dim = n;
  }
  return out;
}

// writeMeta: the public write, called by indexNodes after a successful embed so
// the room records exactly which model + dim produced its stored vectors.
function writeMeta(db, meta) {
  ensureMetaTable(db);
  const m = meta || {};
  if (m.embedding_model != null) writeMetaValue(db, 'embedding_model', m.embedding_model);
  if (Number.isInteger(m.embedding_dim) && m.embedding_dim > 0) {
    writeMetaValue(db, 'embedding_dim', m.embedding_dim);
  }
}

// ---------- dim resolution helper ----------

function resolveWidth(dim) {
  if (Number.isInteger(dim) && dim > 0) return dim;
  // Fall back to the spine's resolved dim rather than reintroduce a hardcode.
  try {
    // eslint-disable-next-line global-require
    return require('./embedding-spine.cjs').resolveDim();
  } catch (_e) {
    return 384; // last-resort so table creation never crashes
  }
}

// ---------- vec-table lifecycle ----------

function dropVecTables(db) {
  try { db.exec('DROP TABLE IF EXISTS eureka_vec'); } catch (_e) { /* ignore */ }
  try { db.exec('DROP TABLE IF EXISTS eureka_vec_fallback'); } catch (_e) { /* ignore */ }
}

// createVecTable: backend selection driven by the vec0 capability probe, NOT by
// table existence. TRIES the sqlite-vec primary leg at the PASSED width only
// after ensureVecLoaded(db, opts) confirms vec0 is registered on THIS handle;
// otherwise falls back to a plain BLOB table + brute-force CJS cosine. Returns
// the live backend name. The vec0 DDL uses `width`, never a literal -- that is
// the whole point of the schema-driven dim.
function createVecTable(db, width, opts) {
  // Fallback stickiness: a previously degraded room stays on cjs-fallback.
  // Upgrading it mid-life would leave an empty vec0 table serving zero results
  // until the next full reindex, so honor the existing degrade.
  if (tableExists(db, 'eureka_vec_fallback')) return 'cjs-fallback';

  const loaded = ensureVecLoaded(db, opts);
  if (loaded.ok) {
    try {
      // The module is NOW registered on this handle (the whole fix): adopting an
      // existing eureka_vec table works instead of throwing, because the old
      // line-160 early return skipped this registration.
      if (tableExists(db, 'eureka_vec')) return 'sqlite-vec';
      db.exec(
        'CREATE VIRTUAL TABLE IF NOT EXISTS eureka_vec USING vec0(node_id TEXT, embedding float[' + width + '])'
      );
      return 'sqlite-vec';
    } catch (_e) {
      // fall through to the cjs-fallback branch on any DDL throw
    }
  }

  // Probe failed (or vec0 DDL threw): create the fallback table and degrade.
  // Never attempt to DROP a stale eureka_vec here -- DROP throws
  // 'no such module: vec0' on an unregistered handle; the stale table is simply
  // never queried again (selection no longer trusts it).
  db.exec(
    'CREATE TABLE IF NOT EXISTS eureka_vec_fallback(node_id TEXT PRIMARY KEY, dim INTEGER, vector BLOB)'
  );
  return 'cjs-fallback';
}

// ensureStore: the single entry point tri-modal-index calls. Guarantees the
// eureka_meta table exists, that a vec table exists at the requested dim, and
// that the meta records the current dim.
//
// DIM-MISMATCH REBUILD (the model-swap path): if eureka_meta already records a
// DIFFERENT dim than requested, the stored vectors were produced by a different
// model and are unusable at the new width. Both derived vec tables are DROPPED
// and recreated empty at the new dim, and meta is updated. They are rebuildable
// projections, so this is a re-embed, never data loss of real memory.
//
// LEGACY no-meta case: a room.db indexed before quick(260706-13z) has a vec
// table but no eureka_meta.embedding_dim. It is treated as current-dim (no
// rebuild) and simply adopted; the next indexNodes run writes meta and, if the
// model changed, triggers the rebuild above.
function ensureStore(db, dim, opts) {
  const width = resolveWidth(dim);
  ensureMetaTable(db);

  const storedDim = readMeta(db).embedding_dim; // number | undefined
  if (Number.isInteger(storedDim) && storedDim !== width) {
    // Probe BEFORE the DROP so a vec0 table can actually be dropped on capable
    // handles (today the DROP silently fails when the module was never
    // registered). When the probe fails the DROP still throws and is swallowed,
    // and the stale table is harmless because selection no longer trusts it.
    ensureVecLoaded(db, opts);
    dropVecTables(db);
  }

  const backend = createVecTable(db, width, opts);
  writeMetaValue(db, 'embedding_dim', width);
  return { backend: backend, dim: width };
}

// ---------- insertVector / deleteVector ----------

// currentBackend: honest and READ-ONLY. It must NEVER trigger a load attempt
// (insertVector/deleteVector call it on every row). 'sqlite-vec' only when the
// handle is in the registry AND eureka_vec exists; a caller that skipped
// ensureStore on a poisoned db thus gets a defensive no-op instead of an
// escaped 'no such module: vec0' throw.
function currentBackend(db) {
  if (_vecLoadedHandles.has(db) && tableExists(db, 'eureka_vec')) return 'sqlite-vec';
  if (tableExists(db, 'eureka_vec_fallback')) return 'cjs-fallback';
  return null;
}

// insertVector: delete-then-insert (idempotent), backend-agnostic. A no-op if
// ensureStore has not created a table yet (defensive; caller always calls
// ensureStore first).
function insertVector(db, nodeId, vec) {
  const backend = currentBackend(db);
  if (backend === 'sqlite-vec') {
    db.prepare('DELETE FROM eureka_vec WHERE node_id = ?').run(nodeId);
    db.prepare('INSERT INTO eureka_vec(node_id, embedding) VALUES (?, ?)').run(nodeId, vecToBlob(vec));
  } else if (backend === 'cjs-fallback') {
    db.prepare('DELETE FROM eureka_vec_fallback WHERE node_id = ?').run(nodeId);
    db.prepare('INSERT INTO eureka_vec_fallback(node_id, dim, vector) VALUES (?, ?, ?)')
      .run(nodeId, vec.length, vecToBlob(vec));
  }
}

function deleteVector(db, nodeId) {
  const backend = currentBackend(db);
  if (backend === 'sqlite-vec') {
    db.prepare('DELETE FROM eureka_vec WHERE node_id = ?').run(nodeId);
  } else if (backend === 'cjs-fallback') {
    db.prepare('DELETE FROM eureka_vec_fallback WHERE node_id = ?').run(nodeId);
  }
}

// ---------- knnQuery ----------
//
// sqlite-vec KNN when the primary leg is live; otherwise a brute-force CJS
// cosine scan over the fallback table. Returns [{ node_id, score }] with score
// DESCENDING (higher = closer): the primary distance is negated so both
// backends share the "higher is better" contract the RRF fuser expects.
function knnQuery(db, queryVec, k) {
  const limit = Number.isFinite(k) && k > 0 ? k : 10;
  const q = Array.isArray(queryVec) ? queryVec : [];
  if (q.length === 0) return [];

  // Gate the eureka_vec branch on the handle registry so the fallback path never
  // prepares SQL naming eureka_vec (which would throw 'no such module: vec0' on
  // an unregistered handle carrying a stale vec table).
  if (_vecLoadedHandles.has(db) && tableExists(db, 'eureka_vec')) {
    try {
      const rows = db.prepare(
        'SELECT node_id, distance FROM eureka_vec WHERE embedding MATCH ? ORDER BY distance LIMIT ?'
      ).all(vecToBlob(q), limit);
      return rows.map(function (r) { return { node_id: r.node_id, score: -r.distance }; });
    } catch (_e) {
      // fall through to the fallback scan
    }
  }

  if (!tableExists(db, 'eureka_vec_fallback')) return [];
  const rows = db.prepare('SELECT node_id, vector FROM eureka_vec_fallback').all();
  const scored = rows.map(function (r) {
    return { node_id: r.node_id, score: cosineSimilarity(blobToVec(r.vector), q) };
  });
  scored.sort(function (a, b) { return b.score - a.score; });
  return scored.slice(0, limit);
}

// ---------- Exports ----------

module.exports = {
  ensureStore: ensureStore,
  readMeta: readMeta,
  writeMeta: writeMeta,
  insertVector: insertVector,
  deleteVector: deleteVector,
  knnQuery: knnQuery,
  _test: {
    tableExists: tableExists,
    vecToBlob: vecToBlob,
    blobToVec: blobToVec,
    currentBackend: currentBackend,
    dropVecTables: dropVecTables,
    createVecTable: createVecTable,
    ensureVecLoaded: ensureVecLoaded,
    vecProbe: vecProbe,
    resetVecProbe: resetVecProbe,
  },
};
