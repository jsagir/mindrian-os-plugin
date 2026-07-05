'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 211-02 -- the tri-modal room index (SEED-049 architecture).
 *
 * room.db becomes tri-modal: STRUCTURAL (the existing graph, untouched here) +
 * LEXICAL (FTS5 + BM25 + porter -- the agno lesson, the half MindrianOS lacked)
 * + SEMANTIC (sqlite-vec primary, pure-CJS cosine fallback). This module builds
 * the LEXICAL and SEMANTIC legs as DERIVED projection tables over the nodes
 * table and exposes the two ranked-search primitives the RRF fuser consumes.
 *
 * --------------------------------------------------------------------------
 * CANON PART 9 (Memory Locality) BOUNDARY STATEMENT:
 * --------------------------------------------------------------------------
 * This module writes ONLY derived index tables (eureka_fts, and eureka_vec OR
 * eureka_vec_fallback) -- rebuildable projections of the nodes table. It writes
 * ZERO typed edges, ZERO memory_event rows, ZERO node mutations. The
 * navigation.cjs chokepoint is NOT bypassed, because nothing written here is
 * graph memory; graph write-back is explicitly Phase 212 / 201-03 territory.
 * The tables are idempotently rebuildable and carry no truth-claim status.
 *
 * CALLER-OWNED HANDLES (the navigation pattern): every function takes a db
 * handle the CALLER opened. This file NEVER opens room.db itself and NEVER
 * requires room-db.cjs, so the pre-commit navigation allow-list stays intact.
 * The optional sqlite-vec primary leg needs a handle constructed with
 * allowExtension:true (openRoomDb(roomDir, {allowExtension:true})); on any
 * plain handle the vector leg silently degrades to the CJS cosine fallback.
 *
 * CANON PART 8 (Graph Boundary): fully local. The only network touch is the
 * one-time model-weight download performed by embedding-spine (by model id
 * only); no room bytes egress. Vectors are computed and stored locally.
 * --------------------------------------------------------------------------
 *
 * Exports:
 *   openIndex(db)                 -> { vec_backend: 'sqlite-vec'|'cjs-fallback' }
 *   indexNodes(db, opts)          -> Promise<{ indexed, vec_backend, embedded }>
 *     // opts.encodeFn (offline test seam) is forwarded to embedTexts unchanged.
 *   lexicalSearch(db, query, k)   -> [{ node_id, rank }]   (bm25 asc = best first)
 *   vectorSearch(db, queryVec, k) -> [{ node_id, score }]  (cosine desc)
 *   nodeText(row)                 -> string   (pure core text, '' if none)
 *   _test                         -> internal helpers for offline assertions
 *
 * Env:
 *   (none of its own; the embedding model id is resolved inside embedding-spine)
 *
 * Pure CJS, node built-ins + embedding-spine + one OPTIONAL lazy dep
 * (sqlite-vec). Never throws across a boundary; every failure degrades.
 */

const { embedTexts, cosineSimilarity } = require('./embedding-spine.cjs');

const EMBED_DIM = 384;

// ---------- Minimal English stopword set ----------
//
// Used ONLY to null out a stopword-only lexical query (a query that carries no
// discriminating token). porter is a stemmer, not a stopword filter, so without
// this a query like "the of and" would still MATCH high-frequency rows. Kept
// deliberately small: the goal is "no signal -> [] " not aggressive filtering.

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'is', 'are', 'was', 'were',
  'be', 'on', 'for', 'with', 'as', 'at', 'by', 'it', 'this', 'that', 'from',
  'but', 'not', 'no', 'so', 'if', 'then', 'than', 'into', 'out', 'up', 'down',
]);

// ---------- nodeText ----------
//
// Parse the properties JSON defensively and return the PURE core text (no type
// prefix -- the type token is added by indexNodes when it builds the indexed
// string, so nodeText stays a clean text extractor). Priority mirrors the live
// schema: Section nodes carry .name, Artifact nodes carry .title; governing
// thoughts / memory artifacts carry .text or .governing_thought. Empty or
// unparseable props yield '' (the node is then skipped, never crashed on).

function nodeText(row) {
  if (!row) return '';
  let props = null;
  try {
    if (typeof row.properties === 'string') {
      props = JSON.parse(row.properties);
    } else if (row.properties && typeof row.properties === 'object') {
      props = row.properties;
    }
  } catch (_e) {
    return '';
  }
  if (!props || typeof props !== 'object') return '';
  const core = props.name || props.text || props.title || props.governing_thought || '';
  if (typeof core !== 'string' || core.trim() === '') return '';
  return core.trim();
}

// The string actually fed to both index legs: the node type as a leading token
// (so a type-scoped lexical query can hit) plus the pure core text.
function indexedText(row) {
  const core = nodeText(row);
  if (!core) return '';
  const typeTok = row && row.type ? String(row.type) + ' ' : '';
  return (typeTok + core).trim();
}

// ---------- tableExists ----------

function tableExists(db, name) {
  try {
    const r = db.prepare('SELECT name FROM sqlite_master WHERE name = ?').get(name);
    return !!r;
  } catch (_e) {
    return false;
  }
}

// ---------- openIndex ----------
//
// Idempotently creates the lexical (fts5) table, then TRIES the sqlite-vec
// primary vector leg (SEED-049 D1: production-safe well past room scale). The
// primary path needs BOTH a handle built with allowExtension:true AND the
// sqlite-vec npm package (installed in 211-01, gated by its legitimacy
// checkpoint). On ANY throw -- dep missing, handle lacks allowExtension,
// platform binary absent, vec_version() unavailable -- it falls back to a
// plain BLOB table + brute-force CJS cosine and reports which backend is live.
//
// T-211-03 mitigation: the extension is loaded ONLY from
// require('sqlite-vec').getLoadablePath() (the vetted package), NEVER from an
// env-supplied path.

function openIndex(db) {
  db.exec(
    "CREATE VIRTUAL TABLE IF NOT EXISTS eureka_fts USING fts5(node_id UNINDEXED, text, tokenize='porter')"
  );

  // Already resolved on a prior call in this process? Report from disk.
  if (tableExists(db, 'eureka_vec')) return { vec_backend: 'sqlite-vec' };

  try {
    // eslint-disable-next-line global-require
    const sqliteVec = require('sqlite-vec');
    if (typeof db.enableLoadExtension === 'function') {
      db.enableLoadExtension(true);
    }
    db.loadExtension(sqliteVec.getLoadablePath());
    const ver = db.prepare('SELECT vec_version() AS v').get();
    if (!ver || !ver.v) throw new Error('vec_version unavailable');
    db.exec(
      'CREATE VIRTUAL TABLE IF NOT EXISTS eureka_vec USING vec0(node_id TEXT, embedding float[' + EMBED_DIM + '])'
    );
    return { vec_backend: 'sqlite-vec' };
  } catch (_e) {
    db.exec(
      'CREATE TABLE IF NOT EXISTS eureka_vec_fallback(node_id TEXT PRIMARY KEY, dim INTEGER, vector BLOB)'
    );
    return { vec_backend: 'cjs-fallback' };
  }
}

// ---------- Float32 BLOB helpers (fallback leg) ----------

function vecToBlob(vec) {
  return Buffer.from(Float32Array.from(vec).buffer);
}

function blobToVec(blob) {
  const buf = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
  const f = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
  return Array.from(f);
}

// ---------- indexNodes ----------
//
// Full-corpus reindex over the nodes table, embedding all texts in ONE
// embedTexts batch (opts.encodeFn injectable for offline tests). Per-node
// DELETE-then-INSERT keeps it idempotent: running it twice yields the same row
// set, never duplicates. Nodes with empty text are skipped. Degrades to a
// lexical-only index (no vectors) when the encoder is unavailable, never throws.

async function indexNodes(db, opts) {
  const options = opts || {};
  const { vec_backend } = openIndex(db);

  const rows = db.prepare('SELECT id, type, properties FROM nodes').all();
  const items = [];
  for (let i = 0; i < rows.length; i += 1) {
    const text = indexedText(rows[i]);
    if (!text) continue; // empty / unparseable props -> skip
    items.push({ node_id: rows[i].id, text: text });
  }

  // Lexical leg: per-node delete then insert (idempotent).
  const delFts = db.prepare('DELETE FROM eureka_fts WHERE node_id = ?');
  const insFts = db.prepare('INSERT INTO eureka_fts(node_id, text) VALUES (?, ?)');
  for (let i = 0; i < items.length; i += 1) {
    delFts.run(items[i].node_id);
    insFts.run(items[i].node_id, items[i].text);
  }

  // Semantic leg: one batch embed, then per-node delete-then-insert.
  let embedded = false;
  const emb = await embedTexts(items.map(function (it) { return it.text; }), { encodeFn: options.encodeFn });
  if (emb.success && Array.isArray(emb.vectors) && emb.vectors.length === items.length) {
    embedded = true;
    if (vec_backend === 'sqlite-vec') {
      const delV = db.prepare('DELETE FROM eureka_vec WHERE node_id = ?');
      const insV = db.prepare('INSERT INTO eureka_vec(node_id, embedding) VALUES (?, ?)');
      for (let i = 0; i < items.length; i += 1) {
        delV.run(items[i].node_id);
        insV.run(items[i].node_id, vecToBlob(emb.vectors[i]));
      }
    } else {
      const delV = db.prepare('DELETE FROM eureka_vec_fallback WHERE node_id = ?');
      const insV = db.prepare('INSERT INTO eureka_vec_fallback(node_id, dim, vector) VALUES (?, ?, ?)');
      for (let i = 0; i < items.length; i += 1) {
        const vec = emb.vectors[i];
        delV.run(items[i].node_id);
        insV.run(items[i].node_id, vec.length, vecToBlob(vec));
      }
    }
  }

  return { indexed: items.length, vec_backend: vec_backend, embedded: embedded };
}

// ---------- FTS5 MATCH escaping ----------
//
// T-211-05 mitigation: strip to alnum tokens, drop stopwords, wrap each token
// in double quotes, join with OR (any-token recall; bm25 does the ranking).
// Raw punctuation therefore can NEVER inject fts5 syntax and a stopword-only
// query yields '' -> the caller returns [] without ever touching the db.

function toFtsMatch(query) {
  if (typeof query !== 'string') return '';
  const tokens = query.toLowerCase().match(/[a-z0-9]+/g) || [];
  const kept = tokens.filter(function (t) { return t.length > 0 && !STOPWORDS.has(t); });
  if (kept.length === 0) return '';
  return kept.map(function (t) { return '"' + t + '"'; }).join(' OR ');
}

// ---------- lexicalSearch ----------
//
// bm25(eureka_fts) is negative-more-is-better; ORDER BY rank ASC puts the best
// match first. Returns [{ node_id, rank }]. Empty / stopword-only / punctuation
// queries return [] without throwing.

function lexicalSearch(db, query, k) {
  const limit = Number.isFinite(k) && k > 0 ? k : 10;
  const matchExpr = toFtsMatch(query);
  if (!matchExpr) return [];
  try {
    const rows = db.prepare(
      'SELECT node_id, bm25(eureka_fts) AS rank FROM eureka_fts WHERE eureka_fts MATCH ? ORDER BY rank LIMIT ?'
    ).all(matchExpr, limit);
    return rows.map(function (r) { return { node_id: r.node_id, rank: r.rank }; });
  } catch (_e) {
    return [];
  }
}

// ---------- vectorSearch ----------
//
// sqlite-vec KNN when the primary leg is live; otherwise a brute-force CJS
// cosine scan over the fallback table (sub-ms at room scale per SEED-049).
// Returns [{ node_id, score }] with score DESCENDING (higher = closer). The
// primary distance is converted to a similarity-oriented score so both backends
// share the same "higher is better" contract the fuser expects.

function vectorSearch(db, queryVec, k) {
  const limit = Number.isFinite(k) && k > 0 ? k : 10;
  const q = Array.isArray(queryVec) ? queryVec : [];
  if (q.length === 0) return [];

  if (tableExists(db, 'eureka_vec')) {
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
  openIndex: openIndex,
  indexNodes: indexNodes,
  lexicalSearch: lexicalSearch,
  vectorSearch: vectorSearch,
  nodeText: nodeText,
  _test: {
    EMBED_DIM: EMBED_DIM,
    STOPWORDS: STOPWORDS,
    indexedText: indexedText,
    toFtsMatch: toFtsMatch,
    vecToBlob: vecToBlob,
    blobToVec: blobToVec,
    tableExists: tableExists,
  },
};
