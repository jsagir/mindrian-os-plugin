/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 272 -- CJS port of scripts/rs-engine.py's Mode A internal orchestration.
 *
 * Discovers room artifacts on disk, computes the structural leg (rs-math.cjs's
 * topic-keyword-membership LSA, Convention A), the semantic leg
 * (embedding-spine.cjs's local ONNX encoder), pairs the two via abs-diff
 * top-k, classifies direction, writes .rs-engine-results.json (Python-schema
 * field-for-field parity) and .rs-engine-cache.json, and writes
 * REVERSE_SALIENT edges into room.db (source='rs-engine') for the three
 * existing consumers that already depend on that side effect
 * (futures/orchestrator.cjs's runRSReverseSalient, leverage-scan.cjs's Level
 * 6-8 band, lib/agents/reverse-salient-agent.cjs's cascade-edge writes).
 *
 * SCOPE (D-10): Mode A internal only. Mode B/C (the external Pinecone
 * corpus path in lib/core/rs_cache.py) is explicitly out of scope for this
 * phase and is not ported here.
 *
 * D-01 / D-02 SEPARATE-EMBEDDING-SPACE INVARIANT (mirrors
 * scripts/rs-engine.py:1455-1465's design note verbatim, this is the
 * local/384-dim side of that invariant): this file consumes
 * embedding-spine.cjs's existing MongoDB/mdbr-leaf-ir (384-dim) encoder
 * UNCHANGED. It does NOT load Xenova/multilingual-e5-large locally, and it
 * does NOT introduce any cross-engine cosine comparison between the 384-dim
 * local space and the 1024-dim external Pinecone space -- there is none
 * today (RESEARCH.md Finding F-5) and none is created here. Mixing a
 * 1024-dim external vector with a 384-dim local vector in one cosine call
 * would be a silent dimensional bug; this module never does that.
 *
 * Consumes lib/core/rs-math.cjs (structural/LSA leg) and
 * lib/core/semantic-index/embedding-spine.cjs::embedTexts (semantic leg, the ONLY
 * local encoder call site in this file -- never instantiates a second ONNX
 * feature-extraction instance). Consumes lib/core/lazygraph-ops.cjs's
 * openGraph/closeGraph/upsertEdge and lib/core/node-insert.cjs's insertNode
 * (the existing NOT-NULL-safe node upsert, reused rather than hand-rolled --
 * see writeReverseSalientEdges below) per Canon Part 7 reuse-before-build.
 *
 * Error-envelope family: never throws across this module's boundary. The
 * top-level entry point (runModeInternal) always returns a valid
 * {metadata, pairs} object, degrading gracefully (empty pairs, an
 * 'encoder_unavailable' semantic-leg fallback to identity) rather than
 * crashing, matching PATTERNS.md convention 4.
 *
 * Pure CJS, node built-ins plus in-repo modules only, zero new runtime
 * dependencies.
 *
 * No em-dashes (CLAUDE.md HARD RULE).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const rsMath = require('./rs-math.cjs');
const embeddingSpine = require('./semantic-index/embedding-spine.cjs');
const { cosineSimilarity } = require('./rs-pinecone-bridge.cjs');
const lazygraphOps = require('./lazygraph-ops.cjs');
const { insertNode } = require('./node-insert.cjs');
const vectorCache = require('./semantic-index/vector-cache.cjs');
const artifactScope = require('./artifact-scope.cjs');

// ---------------------------------------------------------------------------
// Constants (values pinned from scripts/rs-engine.py, ported exactly)
// ---------------------------------------------------------------------------

const CACHE_FILENAME = '.rs-engine-cache.json';
const RESULTS_FILENAME = '.rs-engine-results.json';
const DEFAULT_TOPK = 100;
const DEFAULT_THRESHOLD = 0.3;
const ENGINE_VERSION = '1';

// Phase 379.1 Plan 05 (CPU379-06, D-379.1-14): the artifact cap that holds
// BEFORE buildLsaMatrix. 400 is rs_max_artifacts_default from
// tests/fixtures/379.1/probe-svd-parity.json: the cyclic Jacobi solve on a
// 400 x 400 Gram matrix measured jacobi_ms_n400 = 50663 ms (the incident room
// spent 31 minutes of CPU on 2000 x 2000 with no cap). The cap stays at this
// value even though the randomized solver now ships (Plan 03, GATE PASSED);
// raising it is a follow-up seed, not a change in this phase.
const DEFAULT_MAX_ARTIFACTS = 400;

// SKIP_DIRS / SKIP_FILES / MIN_BODY_CHARS: ported from the single Python
// source of truth, lib/core/rs_corpus_exclude.py (SEED-018 -- FOUR walkers
// drifted before that module existed; this is the CJS-side fifth walker, and
// it is a DOCUMENTED, not hidden, duplication since no shared CJS sibling of
// rs_corpus_exclude.py exists yet in this repo. A future plan could extract
// a lib/core/rs-corpus-exclude.cjs single source; out of scope here -- not
// named in 272-PATTERNS.md's file map or this plan's files_modified list).
const SKIP_DIRS = new Set([
  '.lazygraph',
  '.git',
  '.mindrian',
  'node_modules',
  '.obsidian',
  '.heal-backup',
  '.private',
  '.intelligence',
  // Fleet-level .room-graph/ is the live rooms registry database. Retained.
  // Room-level .room-graph/ is dead; real path is .mindrian/room.db (CONTEXT.md).
  '.room-graph',
  '.rs-engine-checkpoints',
  '.session-binding',
  '.cache',
  '.snapshots',
  'sub-rooms',
  '.context',
]);
const SKIP_FILES = new Set(['STATE.md', 'ROOM.md', 'MINTO.md']);
const MIN_BODY_CHARS = 50;

// ---------------------------------------------------------------------------
// Artifact discovery (ports discover_artifacts, extract_title, extract_body)
// ---------------------------------------------------------------------------

/*
 * extractTitle(content, filePath): ports scripts/rs-engine.py's extract_title
 * exactly, including the Python .title()-equivalent fallback (dash ->
 * space, then title-case each word) when no "# Heading" line is present.
 */
function extractTitle(content, filePath) {
  const match = content.match(/^# (.+)$/m);
  if (match) return match[1].trim();
  const stem = path.basename(filePath, path.extname(filePath));
  return stem
    .replace(/-/g, ' ')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

/*
 * extractBody(content): ports extract_body exactly -- strip a leading
 * frontmatter block (--- ... ---) if present, otherwise return content
 * unchanged.
 */
function extractBody(content) {
  const match = content.match(/^---\n[\s\S]*?\n---\n?/);
  if (match) return content.slice(match[0].length);
  return content;
}

/*
 * discoverArtifacts(roomDir): ports discover_artifacts exactly. Walks
 * roomDir recursively, skips SKIP_DIRS, skips room-root files (files
 * directly under roomDir are not part of any section), only .md files,
 * skips SKIP_FILES, skips bodies under MIN_BODY_CHARS, and builds
 * artifact_id = <section>/<filename-stem> with forward-slash normalization
 * (path.sep replaced with '/', so ids stay platform-consistent even on
 * Windows -- Python's own `.replace(os.sep, "/")`).
 */
function _walkDir(dir, roomPath, out, scope) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_e) {
    return;
  }
  // Phase 379.1 (CPU379-10, D-379.1-03): a directory the artifact scope
  // excludes (a generated engine-input marker, or a valid declared pattern)
  // is not descended. SKIP_DIRS stays the first test.
  const dirs = entries.filter(
    (e) => e.isDirectory()
      && !SKIP_DIRS.has(e.name)
      && !artifactScope.isExcludedDir(path.join(dir, e.name), roomPath, scope),
  );
  const files = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .sort();

  const relRoot = path.relative(roomPath, dir);
  if (relRoot !== '') {
    const section = relRoot.split(path.sep)[0];
    for (const fname of files) {
      if (!fname.endsWith('.md')) continue;
      if (SKIP_FILES.has(fname)) continue;
      const fpath = path.join(dir, fname);
      let content;
      try {
        content = fs.readFileSync(fpath, 'utf8');
      } catch (_e) {
        continue;
      }
      const body = extractBody(content).trim();
      if (body.length < MIN_BODY_CHARS) continue;
      const stem = path.basename(fname, '.md');
      const artifactId = `${relRoot}/${stem}`.split(path.sep).join('/');
      out.push({
        id: artifactId,
        section,
        title: extractTitle(content, fpath),
        path: path.relative(roomPath, fpath),
        text: body,
      });
    }
  }
  for (const d of dirs) {
    _walkDir(path.join(dir, d.name), roomPath, out, scope);
  }
}

/*
 * discoverArtifactsWithScope(roomDir) -> { artifacts, scope }
 * Loads the artifact scope once (lib/core/artifact-scope.cjs), walks with it,
 * and returns both so a caller can disclose what the scope removed
 * (T-379.1-01). discoverArtifacts keeps its signature and returns only the
 * artifacts.
 */
function discoverArtifactsWithScope(roomDir) {
  const roomPath = path.resolve(roomDir);
  const scope = artifactScope.loadScope(roomPath);
  const out = [];
  _walkDir(roomPath, roomPath, out, scope);
  return { artifacts: out, scope };
}

function discoverArtifacts(roomDir) {
  return discoverArtifactsWithScope(roomDir).artifacts;
}

/*
 * resolveMaxArtifacts() -> positive integer
 * MINDRIAN_RS_MAX_ARTIFACTS when it is a positive integer, else the default.
 */
function resolveMaxArtifacts() {
  const raw = process.env.MINDRIAN_RS_MAX_ARTIFACTS;
  if (typeof raw === 'string' && /^[0-9]+$/.test(raw.trim())) {
    const n = Number(raw.trim());
    if (Number.isSafeInteger(n) && n > 0) return n;
  }
  return DEFAULT_MAX_ARTIFACTS;
}

// ---------------------------------------------------------------------------
// Embedding cache (ports _content_hash, _load_embedding_cache,
// _save_embedding_cache exactly)
// ---------------------------------------------------------------------------

// Phase 379.1 Plan 05 (CPU379-01): the three cache functions keep their names
// and the .rs-engine-cache.json contract (version, updated_at, model,
// embeddings), and delegate to lib/core/semantic-index/vector-cache.cjs, the
// loader and saver the drain shares. A row whose model or vector width does not
// match the live encoder is a miss (T-379.1-04).
function _contentHash(text) {
  return vectorCache.contentHash(text);
}

function _loadEmbeddingCache(roomDir) {
  const cachePath = path.join(roomDir, CACHE_FILENAME);
  let model = null;
  let dim = 0;
  try {
    model = embeddingSpine.encoderProvenance().model;
    dim = embeddingSpine.resolveDim();
  } catch (_e) {
    return {};
  }
  return vectorCache.load(cachePath, { version: ENGINE_VERSION, model, dim }).cache;
}

// Atomic write (temp file then rename) lives in vector-cache.save.
function _saveEmbeddingCache(roomDir, cache, modelName) {
  const cachePath = path.join(roomDir, CACHE_FILENAME);
  const ok = vectorCache.save(cachePath, cache, modelName, ENGINE_VERSION);
  if (!ok) {
    process.stderr.write('rs-engine: cache write failed\n');
  }
}

// ---------------------------------------------------------------------------
// Semantic leg: local encoder via embedding-spine.cjs ONLY (the one call
// site -- never a second ONNX instance)
// ---------------------------------------------------------------------------

/*
 * computeEmbeddings(artifacts, roomDir): ports compute_embeddings's
 * cache-then-embed-only-misses optimization. Resolves cache hits/misses per
 * artifact (hash+model match), calls embedTexts (embedding-spine.cjs) ONLY
 * for the cache-miss subset, merges cached and freshly-computed vectors back
 * into artifact order, updates and saves the cache.
 *
 * The model used for cache validation is the ACTUAL resolved model from
 * embedding-spine.cjs's encoderProvenance() (not a hardcoded string) -- so
 * every existing .rs-engine-cache.json entry keyed to the OLD Python
 * all-MiniLM-L6-v2 model name becomes a self-healing cache MISS on first
 * CJS run (RESEARCH.md Runtime State Inventory finding); old entries are
 * never migrated.
 *
 * Returns { vectors: number[][] | null, modelUsed: string,
 * encoderUnavailable: boolean }. Never throws.
 */
async function computeEmbeddings(artifacts, roomDir) {
  const cache = _loadEmbeddingCache(roomDir);
  const provenance = embeddingSpine.encoderProvenance();
  const modelName = provenance.model;

  const vectors = new Array(artifacts.length).fill(null);
  const missingIndices = [];
  for (let i = 0; i < artifacts.length; i += 1) {
    const art = artifacts[i];
    const digest = _contentHash(art.text);
    const entry = cache[art.id];
    if (
      entry &&
      typeof entry === 'object' &&
      entry.hash === digest &&
      entry.model === modelName &&
      Array.isArray(entry.vector)
    ) {
      vectors[i] = entry.vector;
    } else {
      missingIndices.push(i);
    }
  }

  let modelUsed = modelName;

  if (missingIndices.length > 0) {
    const missingTexts = missingIndices.map((i) => artifacts[i].text);
    // The ONLY local encoder call site in this file. rs-engine.cjs never
    // instantiates its own ONNX feature-extraction instance -- it always
    // reuses embedding-spine.cjs's per-process singleton.
    const embedResult = await embeddingSpine.embedTexts(missingTexts, {});
    if (!embedResult || embedResult.success !== true) {
      return {
        vectors: null,
        modelUsed,
        encoderUnavailable: true,
      };
    }
    for (let k = 0; k < missingIndices.length; k += 1) {
      const idx = missingIndices[k];
      const vec = embedResult.vectors[k];
      vectors[idx] = vec;
      cache[artifacts[idx].id] = {
        hash: _contentHash(artifacts[idx].text),
        model: modelUsed,
        vector: vec,
      };
    }
    _saveEmbeddingCache(roomDir, cache, modelUsed);
  }

  return { vectors, modelUsed, encoderUnavailable: false };
}

function _clip01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

/*
 * semanticSimilarityMatrix(vectors): ports semantic_similarity_matrix --
 * pairwise cosine (rs-pinecone-bridge.cjs::cosineSimilarity, reused per
 * Canon Part 7, same discipline as hsi-lsa.cjs's cosine step), clipped to
 * [0, 1].
 */
function semanticSimilarityMatrix(vectors) {
  const n = vectors.length;
  const matrix = [];
  for (let i = 0; i < n; i += 1) matrix.push(new Array(n).fill(0));
  for (let i = 0; i < n; i += 1) {
    matrix[i][i] = _clip01(cosineSimilarity(vectors[i], vectors[i]));
    for (let j = i + 1; j < n; j += 1) {
      const sim = _clip01(cosineSimilarity(vectors[i], vectors[j]));
      matrix[i][j] = sim;
      matrix[j][i] = sim;
    }
  }
  return matrix;
}

function _identityMatrix(n) {
  const m = [];
  for (let i = 0; i < n; i += 1) {
    m.push(new Array(n).fill(0));
    m[i][i] = 1;
  }
  return m;
}

function _round4(x) {
  return Math.round(Number(x) * 10000) / 10000;
}

// ---------------------------------------------------------------------------
// REVERSE_SALIENT edge writer (ports write_reverse_salient_edges)
// ---------------------------------------------------------------------------

/*
 * writeReverseSalientEdges(roomDir, pairs): ports write_reverse_salient_edges
 * exactly. Opens the room graph via lazygraph-ops.cjs::openGraph (which
 * creates .mindrian/room.db and its edges/nodes tables if they do not yet
 * exist -- initSchema already covers the conditional-create the Python
 * original does inline, so no new table is created here).
 *
 * Idempotent full-replace semantics (T-272-20): DELETEs existing
 * rs-engine-sourced REVERSE_SALIENT edges FIRST, so a re-run whose pairing
 * changed never leaves stale edges behind. Non-rs-engine-sourced
 * REVERSE_SALIENT edges (e.g. a future hsi-to-graph.cjs write) are
 * preserved -- the json_extract predicate scopes the delete to exactly
 * source='rs-engine'.
 *
 * For each pair: upserts BOTH endpoint artifact nodes via
 * node-insert.cjs::insertNode (the existing NOT-NULL-safe upsert, reused
 * rather than a hand-rolled raw INSERT -- it already handles both the
 * legacy 3-column nodes schema and the Phase-109-migrated wide schema,
 * exactly the HARD-02 bug class scripts/rs-engine.py's own
 * _upsert_node/_nodes_table_is_migrated helpers were written to fix).
 * source_path is overridden to 'system:rs-engine' (distinct from
 * node-insert.cjs's default 'system:hsi-to-graph') so RS-written nodes
 * stay distinguishable from HSI-written ones, mirroring
 * scripts/rs-engine.py's RS_ENGINE_SOURCE_PATH.
 *
 * Then upserts the REVERSE_SALIENT edge itself via
 * lazygraph-ops.cjs::upsertEdge (T-272 read_first: confirmed safe, already
 * validates 'REVERSE_SALIENT' against its own EDGE_TYPES allowlist and
 * performs the identical INSERT...ON CONFLICT upsert pattern the Python raw
 * writer uses) with properties {source:'rs-engine', lsa_score,
 * semantic_score, signed_diff, abs_diff, direction, innovation_type}.
 * innovation_type deliberately DUPLICATES direction's value under a second
 * key -- ported verbatim, not "cleaned up" (an older consumer may still
 * read it; lib/agents/reverse-salient-agent.cjs's normalizePair reads
 * either key today).
 *
 * closeGraph runs in a finally block (T-272-21) so a mid-loop failure never
 * leaks an open db handle.
 *
 * Returns the number of edges actually written (feeds metadata.edges_written
 * in runModeInternal). Never throws.
 */
/*
 * writeReverseSalientEdges(roomDir, pairs, opts): opts.stampsByPairKey (Phase
 * 355-17, D-08, D-16) is an OPTIONAL caller-supplied Map, keyed
 * source_artifact_id + '\u0000' + target_artifact_id, whose values are
 * already-flattened stamp property objects (the shape
 * lib/core/verification-stamp.cjs's toNodeProps() produces). When present
 * for a pair, those properties are merged into the SAME upsertEdge call this
 * function already makes -- no second writer, no raw SQL. This module never
 * requires the stamp module itself (D-08): the caller (reverse-salient-
 * agent.cjs) builds the Map on top of verification-stamp.cjs and hands this
 * function only flat, already-computed property objects. Without
 * opts.stampsByPairKey this function's written edge properties are byte-
 * identical to before Phase 355.
 */
async function writeReverseSalientEdges(roomDir, pairs, opts) {
  const stampsByPairKey = opts && opts.stampsByPairKey instanceof Map ? opts.stampsByPairKey : null;
  const { db } = await lazygraphOps.openGraph(roomDir);
  try {
    db.prepare(
      "DELETE FROM edges WHERE type = 'REVERSE_SALIENT' AND json_extract(properties, '$.source') = 'rs-engine'"
    ).run();

    let written = 0;
    for (const pair of pairs) {
      const src = pair && pair.source_artifact_id;
      const tgt = pair && pair.target_artifact_id;
      if (!src || !tgt) continue;

      // R17-02: epistemic_type 'observation' (same system-bookkeeping bucket
      // as the lazygraph-ops.cjs Artifact writer).
      insertNode(
        db,
        src,
        'Artifact',
        JSON.stringify({ title: pair.source_title || '', section: pair.source_section || '' }),
        { source_path: 'system:rs-engine', created_by: 'system', epistemic_type: 'observation' }
      );
      insertNode(
        db,
        tgt,
        'Artifact',
        JSON.stringify({ title: pair.target_title || '', section: pair.target_section || '' }),
        { source_path: 'system:rs-engine', created_by: 'system', epistemic_type: 'observation' }
      );

      const properties = {
        source: 'rs-engine',
        lsa_score: pair.lsa_score,
        semantic_score: pair.semantic_score,
        signed_diff: pair.signed_diff,
        abs_diff: pair.abs_diff,
        direction: pair.direction,
        innovation_type: pair.direction,
      };
      // Phase 355-17 (D-16): a caller-supplied stamp rides this SAME edge
      // write when present, merged onto the same properties object this
      // function already builds -- see the header comment above.
      if (stampsByPairKey) {
        const stampProps = stampsByPairKey.get(src + '\u0000' + tgt);
        if (stampProps) Object.assign(properties, stampProps);
      }

      const edgeResult = lazygraphOps.upsertEdge(db, {
        type: 'REVERSE_SALIENT',
        source: src,
        target: tgt,
        properties,
      });
      if (edgeResult && edgeResult.ok) written += 1;
    }

    return written;
  } finally {
    await lazygraphOps.closeGraph(db);
  }
}

// ---------------------------------------------------------------------------
// Atomic results write (ports the same temp-then-rename pattern as
// _save_embedding_cache, PATTERNS.md convention 11)
// ---------------------------------------------------------------------------

function _writeResultsAtomic(roomDir, result) {
  const resultsPath = path.join(roomDir, RESULTS_FILENAME);
  const tmpPath = `${resultsPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(result, null, 2), 'utf8');
  fs.renameSync(tmpPath, resultsPath);
}

// ---------------------------------------------------------------------------
// Mode A runner (ports run_mode_internal)
// ---------------------------------------------------------------------------

function _scopeFields(scope) {
  const st = scope && scope.stats ? scope.stats : null;
  return {
    scope_excluded_dirs: st && Number.isInteger(st.excluded_dirs) ? st.excluded_dirs : 0,
    scope_excluded_artifacts: st && Number.isInteger(st.excluded_md) ? st.excluded_md : 0,
    scope_overbroad: !!(scope && scope.overbroad),
  };
}

/*
 * degradedEnvelope(resolvedRoomDir, reason, extra) -> { metadata, pairs }
 * The degraded result shape: empty pairs, no embedding model, no thesis,
 * edges_written 0, degraded set to reason. extra is merged into metadata.
 * Written through _writeResultsAtomic. Never throws.
 */
function degradedEnvelope(resolvedRoomDir, reason, extra) {
  const x = extra && typeof extra === 'object' ? extra : {};
  const result = {
    metadata: {
      mode: 'internal',
      room_dir: resolvedRoomDir,
      artifact_count: 0,
      topk_requested: DEFAULT_TOPK,
      threshold: DEFAULT_THRESHOLD,
      embedding_model: null,
      thesis_generated: false,
      no_thesis: false,
      edges_written: 0,
      timestamp: new Date().toISOString(),
      engine_version: ENGINE_VERSION,
      ...x,
      degraded: reason,
    },
    pairs: [],
  };
  _writeResultsAtomic(resolvedRoomDir, result);
  return result;
}

/*
 * runModeInternal(roomDir, opts): ports run_mode_internal exactly.
 *
 * opts: { topk = DEFAULT_TOPK(100), threshold = DEFAULT_THRESHOLD(0.30),
 * noThesis = false }.
 *
 * Returns { metadata, pairs } (see file header / tests/272-rs-engine-
 * contract.test.cjs for the exact field lists) and writes
 * <roomDir>/.rs-engine-results.json atomically. Never throws -- a failure
 * of the structural (empty vocabulary) or semantic (encoder unavailable)
 * leg degrades gracefully rather than crashing.
 */
async function runModeInternal(roomDir, opts) {
  const options = opts || {};
  const topk = Number.isFinite(options.topk) ? options.topk : DEFAULT_TOPK;
  const threshold = Number.isFinite(options.threshold) ? options.threshold : DEFAULT_THRESHOLD;
  const noThesis = !!options.noThesis;

  const resolvedRoomDir = path.resolve(roomDir);
  const discovered = discoverArtifactsWithScope(resolvedRoomDir);
  const artifacts = discovered.artifacts;
  // T-379.1-01: every result, the degraded ones included, says how much the
  // scope removed. Integers and a boolean only (Part 8: no path, no text).
  const scopeFields = _scopeFields(discovered.scope);

  if (artifacts.length < 2) {
    const result = {
      metadata: {
        mode: 'internal',
        room_dir: resolvedRoomDir,
        artifact_count: artifacts.length,
        timestamp: new Date().toISOString(),
        engine_version: ENGINE_VERSION,
        ...scopeFields,
      },
      pairs: [],
    };
    _writeResultsAtomic(resolvedRoomDir, result);
    return result;
  }

  // CPU379-06 floor (D-379.1-14): above the cap the LSA matrix is never built.
  const cap = resolveMaxArtifacts();
  if (artifacts.length > cap) {
    return degradedEnvelope(resolvedRoomDir, 'artifact_cap_exceeded', {
      artifact_count: artifacts.length,
      topk_requested: topk,
      threshold,
      no_thesis: noThesis,
      artifact_cap: cap,
      ...scopeFields,
    });
  }

  const texts = artifacts.map((a) => `${a.title}\n${a.text}`);

  // Structural signal: authoritative topic-keyword-membership LSA
  // (Convention A). Never a cosine-on-SVD substitute -- see rs-math.cjs's
  // own load-bearing warning.
  const lsaResult = rsMath.buildLsaMatrix(texts);
  if (!Array.isArray(lsaResult)) {
    // Degrade gracefully (empty vocabulary / empty corpus edge case) rather
    // than crash -- this module never throws across its boundary.
    return degradedEnvelope(
      resolvedRoomDir,
      (lsaResult && lsaResult.error) || 'lsa_build_failed',
      {
        artifact_count: artifacts.length,
        topk_requested: topk,
        threshold,
        no_thesis: noThesis,
        ...scopeFields,
      },
    );
  }
  const lsaMatrix = lsaResult;

  // Semantic signal: embedding cosine via embedding-spine.cjs ONLY.
  const { vectors, modelUsed, encoderUnavailable } = await computeEmbeddings(artifacts, resolvedRoomDir);

  let semMatrix;
  let embeddingModel;
  if (encoderUnavailable) {
    // Fallback: treat semantic as identity so abs_diff collapses to
    // 1 - lsa. Keeps the engine honest when no embedder is available,
    // matching scripts/rs-engine.py's own degradation path exactly.
    process.stderr.write('rs-engine: no embedder available; semantic matrix set to identity\n');
    semMatrix = _identityMatrix(artifacts.length);
    embeddingModel = modelUsed;
  } else {
    semMatrix = semanticSimilarityMatrix(vectors);
    embeddingModel = modelUsed;
  }

  const topPairsResult = rsMath.absDiffTopk(lsaMatrix, semMatrix, { k: topk });
  const topPairs = Array.isArray(topPairsResult) ? topPairsResult : [];

  const pairDicts = [];
  for (const p of topPairs) {
    if (p.absDiff < threshold) continue;
    const ai = artifacts[p.i];
    const aj = artifacts[p.j];
    pairDicts.push({
      source_artifact_id: ai.id,
      source_title: ai.title,
      source_section: ai.section,
      target_artifact_id: aj.id,
      target_title: aj.title,
      target_section: aj.section,
      lsa_score: _round4(lsaMatrix[p.i][p.j]),
      semantic_score: _round4(semMatrix[p.i][p.j]),
      signed_diff: _round4(p.signedDiff),
      abs_diff: _round4(p.absDiff),
      direction: rsMath.classifyDirection(p.signedDiff),
    });
  }

  // Phase 355-17 (D-08, D-16, HIPS-04, HIPS-05): opts.stampFn is an OPTIONAL
  // caller-supplied async function (pairDicts) -> Map<pairKey, flatProps>,
  // awaited HERE, before writeReverseSalientEdges opens the graph, so a
  // stamp rides the SAME edge write as the pair it verifies. This module
  // never requires the stamp module itself; the caller (reverse-salient-
  // agent.cjs) builds stampFn on lib/core/verification-stamp.cjs and hands
  // this module only the resulting Map of already-flattened properties.
  // Without opts.stampFn this module behaves byte-identically to before
  // Phase 355 (stampsByPairKey stays null, writeReverseSalientEdges's own
  // merge is a no-op).
  let stampsByPairKey = null;
  if (typeof options.stampFn === 'function' && pairDicts.length > 0) {
    stampsByPairKey = await options.stampFn(pairDicts);
  }

  const edgesWritten = await writeReverseSalientEdges(resolvedRoomDir, pairDicts, { stampsByPairKey });

  const result = {
    metadata: {
      mode: 'internal',
      room_dir: resolvedRoomDir,
      artifact_count: artifacts.length,
      topk_requested: topk,
      threshold,
      embedding_model: embeddingModel,
      thesis_generated: false,
      no_thesis: noThesis,
      edges_written: edgesWritten,
      timestamp: new Date().toISOString(),
      engine_version: ENGINE_VERSION,
      ...scopeFields,
    },
    pairs: pairDicts,
  };

  _writeResultsAtomic(resolvedRoomDir, result);
  return result;
}

module.exports = {
  runModeInternal,
  writeReverseSalientEdges,
  discoverArtifacts,
  discoverArtifactsWithScope,
  computeEmbeddings,
  extractTitle,
  extractBody,
  _test: {
    resolveMaxArtifacts,
    degradedEnvelope,
    discoverArtifactsWithScope,
    DEFAULT_MAX_ARTIFACTS,
  },
};
