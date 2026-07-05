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
 * This module writes ONLY the lexical (eureka_fts) projection directly; the
 * vector tables (eureka_vec OR eureka_vec_fallback) and the eureka_meta
 * key/value bookkeeping are written through the D1 adapter (vector-store.cjs).
 * All are rebuildable projections of the nodes table. It writes ZERO typed
 * edges, ZERO memory_event rows, ZERO node mutations. The navigation.cjs
 * chokepoint is NOT bypassed, because nothing written here is graph memory;
 * graph write-back is explicitly Phase 212 / 201-03 territory. The tables are
 * idempotently rebuildable and carry no truth-claim status.
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
 *     // opts.roomDir (optional) threads into the Artifact path-body fallback.
 *   lexicalSearch(db, query, k)   -> [{ node_id, rank }]   (bm25 asc = best first)
 *   vectorSearch(db, queryVec, k) -> [{ node_id, score }]  (cosine desc)
 *   nodeText(row, opts?)          -> string   (pure core text, '' if none;
 *                                    opts.roomDir opts INTO the Artifact/
 *                                    memory_artifact path-body fallback)
 *   _test                         -> internal helpers for offline assertions
 *
 * Env:
 *   (none of its own; the embedding model id is resolved inside embedding-spine)
 *
 * Pure CJS, node built-ins + embedding-spine + room-scanner (fs+path only, for
 * the Artifact path-body frontmatter strip -- no new npm dep) + one OPTIONAL
 * lazy dep (sqlite-vec). Never throws across a boundary; every failure degrades.
 */

const fs = require('node:fs');
const path = require('node:path');
const { embedTexts, resolveDim } = require('./embedding-spine.cjs');
const vec = require('./vector-store.cjs');
// room-scanner is fs+path only (zero npm deps); we reuse its stripFrontmatterBody
// idiom so there is exactly ONE frontmatter parser (Canon Part 7 reuse-before-build).
const roomScanner = require('../../vault/room-scanner.cjs');

// The Artifact/memory_artifact path-body fallback caps the read markdown body so
// the FTS/embedding blob stays bounded (embedding models truncate around 512
// tokens anyway). Phase 202 APO can tune this if it ever matters.
const BODY_CAP = 2000;

// The vec tables, their dim, insert/knn/delete, and the eureka_meta bookkeeping
// are owned by the D1 adapter (vector-store.cjs). This module is now a
// delegating consumer: it owns ONLY the lexical (fts5) leg and the node-text
// extraction, and forwards every vector operation to the adapter. There is no
// hardcoded dim here any more (quick(260706-13z) D3: dim is schema-driven, read
// from eureka_meta or resolved from the spine).

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

// ---------- readArtifactBody ----------
//
// Best-effort, NON-THROWING read of an Artifact's room-relative markdown body.
// Resolves props.path under roomDir, REFUSES any resolved path that escapes
// roomDir (traversal guard), reads the file, and strips frontmatter via the
// single room-scanner idiom. Any failure (missing file, non-file, read error,
// traversal attempt) returns '' so the caller degrades to title-only.

function readArtifactBody(roomDir, relPath) {
  try {
    const base = path.resolve(roomDir);
    const resolved = path.resolve(base, relPath);
    // Traversal guard: the resolved path must be roomDir itself or strictly
    // under it. A '../..' escape is refused and the file is NEVER read.
    if (resolved !== base && !resolved.startsWith(base + path.sep)) return '';
    const st = fs.statSync(resolved);
    if (!st.isFile()) return '';
    const content = fs.readFileSync(resolved, 'utf-8');
    const body = roomScanner.stripFrontmatterBody(content);
    return typeof body === 'string' ? body.trim() : '';
  } catch (_e) {
    return '';
  }
}

// ---------- nodeText ----------
//
// Parse the properties JSON defensively and return the PURE core text (no type
// prefix -- the type token is added by indexNodes when it builds the indexed
// string, so nodeText stays a clean text extractor). Priority mirrors the live
// schema: Section nodes carry .name, Artifact nodes carry .title; claim /
// governing thoughts / memory artifacts carry .text or .governing_thought;
// WhitespaceZone nodes carry .hypothesis. Empty or unparseable props yield ''
// (the node is then skipped, never crashed on).
//
// opts.roomDir (OPTIONAL): when supplied AND the node is an Artifact/
// memory_artifact carrying a room-relative props.path, the real markdown BODY is
// read (frontmatter stripped) and returned as `title + ' ' + body` capped at
// BODY_CAP. A single-argument call is byte-identical to the pre-fallback
// behavior (title / core text only). Any read/traversal failure degrades to the
// title-only return, never throws.

function nodeText(row, opts) {
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
  const core = props.name || props.text || props.title || props.governing_thought || props.hypothesis || '';
  const baseTitle = (typeof core === 'string') ? core.trim() : '';

  // Artifact/memory_artifact path-body fallback (opt-in via opts.roomDir).
  const roomDir = opts && typeof opts.roomDir === 'string' ? opts.roomDir : '';
  const isArtifact = row.type === 'Artifact' || row.type === 'memory_artifact';
  if (roomDir && isArtifact && typeof props.path === 'string' && props.path.length > 0) {
    const body = readArtifactBody(roomDir, props.path);
    if (body) {
      const combined = (baseTitle ? baseTitle + ' ' : '') + body;
      return combined.slice(0, BODY_CAP).trim();
    }
  }

  if (baseTitle === '') return '';
  return baseTitle;
}

// The string actually fed to both index legs: the node type as a leading token
// (so a type-scoped lexical query can hit) plus the pure core text. opts.roomDir
// threads through to nodeText unchanged (single-arg behavior when absent).
function indexedText(row, opts) {
  const core = nodeText(row, opts);
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
// Idempotently creates the lexical (fts5) table, then delegates the vector leg
// to the D1 adapter's ensureStore at the room's dim (eureka_meta.embedding_dim
// if a prior index wrote it, else the spine's resolved dim). The adapter owns
// the sqlite-vec-primary / cjs-fallback choice and the T-211-03 loader
// mitigation; this function just reports which backend engaged (byte-compatible
// { vec_backend } return the two consumers already read).

function openIndex(db) {
  db.exec(
    "CREATE VIRTUAL TABLE IF NOT EXISTS eureka_fts USING fts5(node_id UNINDEXED, text, tokenize='porter')"
  );
  const meta = vec.readMeta(db);
  const dim = (Number.isInteger(meta.embedding_dim) && meta.embedding_dim > 0)
    ? meta.embedding_dim
    : resolveDim();
  const store = vec.ensureStore(db, dim);
  return { vec_backend: store.backend };
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
    // opts.roomDir threads into the Artifact/memory_artifact path-body fallback;
    // absent -> title-only behavior, byte-identical to the pre-fallback index.
    const text = indexedText(rows[i], { roomDir: options.roomDir });
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

  // Semantic leg: one batch embed, then delegate persistence to the adapter.
  // The embedded vectors' TRUE dim (emb.vectors[0].length) is the source of
  // truth: ensureStore(db, actualDim) rebuilds the vec tables if the room was
  // previously indexed at a different dim (the model-swap re-embed path), and
  // writeMeta records which model + dim produced these vectors.
  let backend = vec_backend;
  let embedded = false;
  const emb = await embedTexts(items.map(function (it) { return it.text; }), { encodeFn: options.encodeFn });
  if (emb.success && Array.isArray(emb.vectors) && emb.vectors.length === items.length && items.length > 0) {
    embedded = true;
    const actualDim = emb.vectors[0].length;
    const store = vec.ensureStore(db, actualDim);
    backend = store.backend;
    vec.writeMeta(db, {
      embedding_model: (emb.provenance && emb.provenance.model) || 'unknown',
      embedding_dim: actualDim,
    });
    for (let i = 0; i < items.length; i += 1) {
      vec.insertVector(db, items[i].node_id, emb.vectors[i]);
    }
  }

  return { indexed: items.length, vec_backend: backend, embedded: embedded };
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
// Delegates to the D1 adapter's knnQuery: sqlite-vec KNN when the primary leg is
// live, otherwise a brute-force CJS cosine scan over the fallback table. Returns
// [{ node_id, score }] with score DESCENDING (higher = closer), the same
// "higher is better" contract the fuser expects. Kept as a thin passthrough so
// hybrid-retrieve.cjs and eureka-room-report.cjs need zero edits.

function vectorSearch(db, queryVec, k) {
  return vec.knnQuery(db, queryVec, k);
}

// ---------- Exports ----------

module.exports = {
  openIndex: openIndex,
  indexNodes: indexNodes,
  lexicalSearch: lexicalSearch,
  vectorSearch: vectorSearch,
  nodeText: nodeText,
  _test: {
    STOPWORDS: STOPWORDS,
    indexedText: indexedText,
    toFtsMatch: toFtsMatch,
    // BLOB helpers moved to the D1 adapter (vector-store.cjs); re-exported here
    // so any offline caller that reached them through tri-modal keeps working.
    vecToBlob: vec._test.vecToBlob,
    blobToVec: vec._test.blobToVec,
    tableExists: tableExists,
  },
};
