#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 211-05 -- the vertical-slice eureka-room-report runner.
 *
 * ONE command turns a real room.db into a ranked, provenance-stamped, honestly
 * caveated eureka-candidate report. It runs the whole MEASURED Phase 211
 * pipeline against a live room.db:
 *   (1) open the room via the single door (openRoomDb, allowExtension so the
 *       optional sqlite-vec primary leg can load),
 *   (2) build the tri-modal index (openIndex + indexNodes) -- embed EACH node
 *       ONCE into the derived eureka_* projection tables,
 *   (3) read every node's vector back ONCE into memory (embed once, score many),
 *   (4) enumerate CROSS-BOUNDARY pairs only (nodes that differ in top-level
 *       domain ancestor OR differ in node type -- never same-domain same-type;
 *       the differential is a CROSS-domain signal),
 *   (5) score each pair with scoreMeasured(textA, textB, {vectors:[vA, vB]}) --
 *       the 211-03 full-matrix reuse path (no re-embedding),
 *   (6) sort by |signed_diff| descending, keep --top,
 *   (7) write a markdown report: provenance header + FIRE-RATE table (0.1 / 0.3
 *       / 0.4 / 0.5 bands) + top-N candidate table (RS-001..) + a mandatory
 *       caveat block.
 *
 * --------------------------------------------------------------------------
 * CANON PART 8 (Graph Boundary): ZERO network calls of any kind. The offline
 * stub encoder is deterministic and local; the live path uses the local
 * embedding spine whose only possible network touch is the one-time model
 * weight download BY MODEL ID (no room bytes egress). This script contains no
 * URL and opens no socket. Real-room content is verified by the HUMAN
 * spot-check, never by a network judge (that egress rule lives in the
 * judge-gate test, on synthetic gold-card text only).
 *
 * CANON PART 9 (Memory Locality): writes ONLY the derived eureka_* projection
 * tables (via indexNodes) and the report FILE. ZERO writes to nodes, edges, or
 * memory_event. The room handle is opened in a try/finally so it always closes.
 * --------------------------------------------------------------------------
 *
 * Usage:
 *   node scripts/eureka-room-report.cjs [--db <roomDir>] [--offline] \
 *                                       [--top <n>] [--out <path>]
 *   --db      room directory (default: room)          -> <db>/.mindrian/room.db
 *   --offline deterministic stub encoder (no model)   (default: live encoder)
 *   --top     keep the top N candidates               (default: 50)
 *   --out     report path (default: evals/eureka/211-room-report.md)
 *   --seed S        (2026) seed for pair sampling when the room is larger than --max-pairs
 *   --max-pairs N   (2026) cap on scored pairs (default 5000000). Above it, pairs are sampled
 *                   deterministically (seeded) and the report says so. Memory is bounded: only
 *                   the top N rows and one float per scored pair are kept, never one object per pair.
 *
 * Pure CJS, node built-ins + the shipped Phase 211 lib modules. No Commander.
 */

const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const REPO_ROOT = path.resolve(__dirname, '..');

const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib/core/room-db.cjs'));
const triModal = require(path.join(REPO_ROOT, 'lib/core/semantic-index/tri-modal-index.cjs'));
const { scoreMeasured } = require(path.join(REPO_ROOT, 'lib/core/rs-differential-scorer.cjs'));
const spine = require(path.join(REPO_ROOT, 'lib/core/semantic-index/embedding-spine.cjs'));

const EMBED_DIM = 384;
const FIRE_BANDS = [0.1, 0.3, 0.4, 0.5];

// ---------------------------------------------------------------------------
// argv -- switch/case router (the gsd-tools idiom), no dependency.
// ---------------------------------------------------------------------------

function parseArgv(argv) {
  const opts = { db: 'room', offline: false, top: 50, out: 'evals/eureka/211-room-report.md', seed: 'eureka-room-report', maxPairs: 5000000 };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    switch (a) {
      case '--offline': opts.offline = true; break;
      // 2026: a flag given without a value used to leave undefined and crash path.isAbsolute(undefined).
      case '--db': { const v = argv[i + 1]; if (typeof v === 'string' && v.indexOf('--') !== 0) { opts.db = v; i += 1; } break; }
      case '--top': opts.top = parseInt(argv[i += 1], 10); break;
      case '--out': { const v = argv[i + 1]; if (typeof v === 'string' && v.indexOf('--') !== 0) { opts.out = v; i += 1; } break; }
      case '--seed': { const v = argv[i + 1]; if (typeof v === 'string' && v.indexOf('--') !== 0) { opts.seed = v; i += 1; } break; }
      case '--max-pairs': opts.maxPairs = parseInt(argv[i += 1], 10); break;
      case '-h':
      case '--help': opts.help = true; break;
      default: break;
    }
  }
  if (!Number.isFinite(opts.top) || opts.top <= 0) opts.top = 50;
  if (!Number.isFinite(opts.maxPairs) || opts.maxPairs <= 0) opts.maxPairs = 5000000;
  return opts;
}

// ---------------------------------------------------------------------------
// Deterministic OFFLINE stub encoder (no model, no network). A hashed
// bag-of-tokens projected into EMBED_DIM and L2-normalized: shared vocabulary
// yields higher cosine, so the pipeline exercises end-to-end without weights.
// The stub semantic score TRACKS lexical overlap by construction, so it is NOT
// the MiniLM embedding-quality evidence -- the report says so explicitly.
// ---------------------------------------------------------------------------

function stubEncode(texts) {
  return texts.map(function (t) {
    const vec = new Array(EMBED_DIM).fill(0);
    const tokens = String(t || '').toLowerCase().match(/[a-z0-9]+/g) || [];
    for (let i = 0; i < tokens.length; i += 1) {
      const h = crypto.createHash('sha1').update(tokens[i]).digest();
      const idx = h.readUInt16BE(0) % EMBED_DIM;
      const sign = (h[2] & 1) ? 1 : -1;
      vec[idx] += sign;
    }
    let norm = 0;
    for (let i = 0; i < EMBED_DIM; i += 1) norm += vec[i] * vec[i];
    norm = Math.sqrt(norm);
    if (norm === 0) { vec[0] = 1; norm = 1; }
    for (let i = 0; i < EMBED_DIM; i += 1) vec[i] /= norm;
    return vec;
  });
}

// ---------------------------------------------------------------------------
// Root-domain ancestor: walk properties.parentId up to the top-level domain.
// Two nodes form a CROSS-BOUNDARY pair when they differ in root-domain ancestor
// OR differ in node type. Same-domain same-type pairs are excluded.
// ---------------------------------------------------------------------------

function parsePropsParent(row) {
  try {
    const p = typeof row.properties === 'string' ? JSON.parse(row.properties) : row.properties;
    return (p && typeof p.parentId === 'string') ? p.parentId : '';
  } catch (_e) {
    return '';
  }
}

function buildRootDomainMap(rows) {
  const parentOf = new Map();
  for (let i = 0; i < rows.length; i += 1) parentOf.set(rows[i].id, parsePropsParent(rows[i]));
  const rootCache = new Map();
  function rootOf(id) {
    if (rootCache.has(id)) return rootCache.get(id);
    const seen = new Set();
    let cur = id;
    while (cur && parentOf.has(cur) && parentOf.get(cur) && !seen.has(cur)) {
      seen.add(cur);
      cur = parentOf.get(cur);
    }
    rootCache.set(id, cur || id);
    return cur || id;
  }
  return rootOf;
}

// ---------------------------------------------------------------------------
// Read every indexed node's vector back ONCE from the derived index table.
// Backend-aware: eureka_vec (sqlite-vec primary) or eureka_vec_fallback (cjs).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 2026 helpers: seeded PRNG, bounded top-N, empirical percentile.
// ---------------------------------------------------------------------------
function hashSeed(str) {
  let h = 2166136261;
  const s = String(str);
  for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a) {
  let t = a >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
// better(x, y): x ranks ahead of y. Larger abs_diff first; ties keep generation order (i, then j),
// which is exactly what the original stable sort over an i<j loop produced.
function better(x, y) {
  if (x.absd !== y.absd) return x.absd > y.absd;
  if (x.i !== y.i) return x.i < y.i;
  return x.j < y.j;
}
// insertTopK: keep `arr` sorted best-first with at most k entries.
function insertTopK(arr, entry, k) {
  if (arr.length >= k && !better(entry, arr[arr.length - 1])) return false;
  let lo = 0; let hi = arr.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (better(arr[mid], entry)) lo = mid + 1; else hi = mid; }
  arr.splice(lo, 0, entry);
  if (arr.length > k) arr.pop();
  return true;
}
// percentileOfSorted: share of values <= x in an ascending Float64Array (null when empty).
function percentileOfSorted(sorted, x) {
  const n = sorted.length;
  if (n === 0) return null;
  let lo = 0; let hi = n;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (sorted[mid] <= x) lo = mid + 1; else hi = mid; }
  return lo / n;
}
function quantileOfSorted(sorted, q) {
  if (sorted.length === 0) return null;
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

// loadIndexVectors(db, backend, errOut): errOut (optional object) receives { message } if the read
// failed. The original swallowed the error and the report then looked like an empty room.
function loadIndexVectors(db, backend, errOut) {
  const map = new Map();
  try {
    if (backend === 'sqlite-vec') {
      const r = db.prepare('SELECT node_id, embedding FROM eureka_vec').all();
      for (let i = 0; i < r.length; i += 1) map.set(r[i].node_id, triModal._test.blobToVec(r[i].embedding));
    } else {
      const r = db.prepare('SELECT node_id, vector FROM eureka_vec_fallback').all();
      for (let i = 0; i < r.length; i += 1) map.set(r[i].node_id, triModal._test.blobToVec(r[i].vector));
    }
  } catch (e) {
    // empty map -> encoder was unavailable or the table is missing; reported honestly (2026: with the reason)
    if (errOut && typeof errOut === 'object') errOut.message = String(e && e.message ? e.message : e).slice(0, 160);
  }
  return map;
}

function truncate(s, n) {
  const one = String(s || '').replace(/\s+/g, ' ').trim();
  return one.length > n ? one.slice(0, n - 1) + '…' : one;
}

// ---------------------------------------------------------------------------
// Report rendering.
// ---------------------------------------------------------------------------

function renderReport(ctx) {
  const L = [];
  const prov = ctx.provenance;
  L.push('# Phase 211 Eureka Room Report');
  L.push('');
  L.push('> First MEASURED eureka candidates from a real MindrianOS room. High differential is');
  L.push('> NECESSARY not SUFFICIENT: the top of this list may be restatements. The Grounding');
  L.push('> Guard (Phase 212) is the filter, and the bands below are UNCALIBRATED (202-APO tunes them).');
  L.push('');
  L.push('## Provenance');
  L.push('');
  L.push('| Field | Value |');
  L.push('| ----- | ----- |');
  L.push('| Run mode | ' + (ctx.offline ? 'OFFLINE (deterministic stub encoder)' : 'LIVE (local embedding spine)') + ' |');
  L.push('| Room dir | `' + ctx.roomDir + '` |');
  L.push('| Encoder model | ' + prov.model + ' |');
  L.push('| Encoder dtype | ' + prov.dtype + ' |');
  L.push('| Embedding dim | ' + ctx.dim + ' |');
  L.push('| Lexical method | ' + prov.lexical_method + ' |');
  L.push('| Vector backend | ' + ctx.vecBackend + ' |');
  L.push('| EUREKA_DIFF_FLOOR | ' + ctx.diffFloor + ' |');
  L.push('| EUREKA_RRF_K | ' + ctx.rrfK + ' |');
  L.push('| Nodes in room | ' + ctx.nodeCount + ' |');
  L.push('| Nodes indexed (non-empty text) | ' + ctx.indexedCount + ' |');
  L.push('| Cross-boundary pairs scored | ' + ctx.pairCount + ' |');
  L.push('| Pairs skipped (Part 8 figure-guard) | ' + (ctx.part8Skipped || 0) + ' |');
  L.push('| Pairs failed to score (other errors) | ' + (ctx.scoreErrors || 0) + (ctx.firstScoreError ? ' (first: ' + String(ctx.firstScoreError).replace(/[|`\n]/g, ' ') + ')' : '') + ' |');
  L.push('| Pair sampling | ' + (ctx.sampledFraction !== undefined && ctx.sampledFraction < 1
    ? ('SAMPLED: seed `' + ctx.seed + '`, fraction ' + ctx.sampledFraction.toFixed(4) + ' of ' + ctx.eligiblePairs + ' eligible pairs (max-pairs ' + ctx.maxPairs + ')')
    : ('none (all ' + (ctx.eligiblePairs === undefined ? ctx.pairCount : ctx.eligiblePairs) + ' eligible pairs scored)')) + ' |');
  if (ctx.vectorLoadError) L.push('| Vector load error | ' + String(ctx.vectorLoadError).replace(/[|`\n]/g, ' ') + ' |');
  L.push('| Run date | ' + ctx.runDate + ' |');
  if (ctx.runTimestamp) L.push('| Run timestamp (UTC) | ' + ctx.runTimestamp + ' |');
  L.push('| Node | ' + (ctx.nodeVersion || process.version) + ' |');
  L.push('');

  if (ctx.encoderUnavailable) {
    L.push('## Encoder unavailable');
    L.push('');
    L.push('The live embedding spine returned `encoder_unavailable` (the `@huggingface/transformers`');
    L.push('dependency is not installed in this environment, or the model could not load). No semantic');
    L.push('scores were produced, so the fire-rate table and candidate list below are empty. This is a');
    L.push('graceful degradation, not a failure of the pipeline. To produce the live report, install the');
    L.push('deps (`npm install`) and re-run without `--offline`. See the navigator checklist at the end.');
    L.push('');
  }

  L.push('## Fire-rate (the calibration evidence 202-APO needs)');
  L.push('');
  L.push('Pairs whose `|signed_diff|` (semantic - lexical) clears each candidate floor. The s11 finding');
  L.push('measured real bridges at 0.16-0.25, so watch whether 0.3 fires at all (too cold = silent) or');
  L.push('fires on everything (too hot = noise fountain).');
  L.push('');
  L.push('| Floor | Pairs passing | % of scored |');
  L.push('| ----- | ------------- | ----------- |');
  for (let i = 0; i < FIRE_BANDS.length; i += 1) {
    const b = FIRE_BANDS[i];
    const c = ctx.fireCounts[b] || 0;
    const pct = ctx.pairCount > 0 ? ((c / ctx.pairCount) * 100).toFixed(1) : '0.0';
    L.push('| ' + b.toFixed(1) + ' | ' + c + ' | ' + pct + '% |');
  }
  L.push('');

  if (ctx.percentiles) {
    L.push('## Corpus-relative cut-offs (empirical percentiles of |signed_diff|)');
    L.push('');
    L.push('The fixed floors above are UNCALIBRATED. Ranking by the corpus percentile says how unusual a');
    L.push('gap is relative to every other pair in THIS room, which transfers across encoders and rooms');
    L.push('better than a fixed number. Candidates below carry their percentile (`pct`) and z-score.');
    L.push('');
    L.push('| Percentile | |signed_diff| at cut |');
    L.push('| ---------- | ------------------- |');
    ctx.percentiles.forEach(function (x) { L.push('| p' + x.p + ' | ' + (x.value === null ? 'n/a' : x.value.toFixed(3)) + ' |'); });
    L.push('');
    L.push('Mean ' + (ctx.absMean === null ? 'n/a' : ctx.absMean.toFixed(3)) + ', std ' + (ctx.absStd === null ? 'n/a' : ctx.absStd.toFixed(3))
      + ' over ' + ctx.pairCount + ' scored pairs.');
    L.push('');
  }

  if (ctx.offline && !ctx.encoderUnavailable) {
    L.push('> OFFLINE CAVEAT: the stub encoder scores semantic overlap as a hashed bag-of-tokens, so the');
    L.push('> semantic column TRACKS lexical overlap by construction. This fire-rate is a STRUCTURAL smoke');
    L.push('> signal only -- it is NOT the MiniLM embedding-quality evidence. The embedding-quality and');
    L.push('> fire-rate de-risk answer requires the LIVE run (see the navigator checklist below).');
    L.push('');
  }

  L.push('## Top ' + ctx.top + ' candidates');
  L.push('');
  L.push('Ranked by `|signed_diff|` descending. `direction` = `semantic_implementation` (semantic > lexical,');
  L.push('a same-idea restatement risk) or `structural_transfer` (lexical > semantic, a cross-domain bridge');
  L.push('candidate). `band` is UNCALIBRATED.');
  L.push('');
  if (ctx.candidates.length === 0) {
    L.push('_No candidates (see the encoder-unavailable note above)._');
    L.push('');
  } else {
    L.push('| # | Node A (type) | Node B (type) | semantic | lexical | signed_diff | pct | z | direction | band | passes |');
    L.push('| - | ------------- | ------------- | -------- | ------- | ----------- | --- | - | --------- | ---- | ------ |');
    for (let i = 0; i < ctx.candidates.length; i += 1) {
      const c = ctx.candidates[i];
      const id = 'RS-' + String(i + 1).padStart(3, '0');
      L.push('| ' + id
        + ' | ' + truncate(c.textA, 42) + ' _(' + c.typeA + ')_'
        + ' | ' + truncate(c.textB, 42) + ' _(' + c.typeB + ')_'
        + ' | ' + c.semantic.toFixed(3)
        + ' | ' + c.lexical.toFixed(3)
        + ' | ' + c.signed_diff.toFixed(3)
        + ' | ' + (typeof c.pct === 'number' ? c.pct.toFixed(4) : 'n/a')
        + ' | ' + (typeof c.z === 'number' ? c.z.toFixed(2) : 'n/a')
        + ' | ' + c.direction
        + ' | ' + c.band
        + ' | ' + (c.passes ? 'yes' : 'no')
        + ' |');
    }
    L.push('');
    // 2026 source trail: every candidate row traces back to its two room nodes.
    L.push('## Source trail');
    L.push('');
    L.push('Each row: candidate id, the two room.db node ids, node types, the extracted text (first 160');
    L.push('characters of the text that was embedded), and the retrieval date. Room paths stay local.');
    L.push('');
    L.push('| # | Node A id | Node B id | Text A | Text B | Retrieved |');
    L.push('| - | --------- | --------- | ------ | ------ | --------- |');
    for (let i = 0; i < ctx.candidates.length; i += 1) {
      const c = ctx.candidates[i];
      L.push('| RS-' + String(i + 1).padStart(3, '0') + ' | `' + String(c.idA).replace(/[|`]/g, ' ') + '` | `' + String(c.idB).replace(/[|`]/g, ' ')
        + '` | ' + truncate(c.textA, 160).replace(/\|/g, '/') + ' | ' + truncate(c.textB, 160).replace(/\|/g, '/') + ' | ' + ctx.runDate + ' |');
    }
    L.push('');
    L.push('Verification status for every row: second signal = none beyond the semantic-vs-lexical');
    L.push('differential itself; novelty check = NOT RUN (the Phase 212 Grounding Guard owns it). Treat every');
    L.push('row as unverified until the Guard and the human spot-check have seen it.');
    L.push('');
  }

  L.push('## Caveat (necessary not sufficient)');
  L.push('');
  L.push('- A high differential is NECESSARY, not SUFFICIENT. The top of this list may be restatements');
  L.push('  (`semantic_implementation` with near-1.0 semantic and near-0 lexical is the classic paraphrase');
  L.push('  trap). The Grounding Guard (Phase 212) is the filter that separates a real bridge from a');
  L.push('  restatement; this runner only surfaces candidates.');
  L.push('- The bands (breakthrough / high / opportunity / moderate / low) are UNCALIBRATED defaults.');
  L.push('  Phase 202 (APO) calibrates `EUREKA_DIFF_FLOOR` and the bands against this fire-rate evidence.');
  L.push('- Real-room content NEVER reaches a network judge. This report is verified by the human');
  L.push('  spot-check appended below, not by Plurai.');
  L.push('');

  return L.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main(argv) {
  const opts = parseArgv(argv);
  if (opts.help) {
    process.stdout.write('Usage: node scripts/eureka-room-report.cjs [--db <roomDir>] [--offline] [--top <n>] [--out <path>]\n');
    return 0;
  }

  const roomDir = path.isAbsolute(opts.db) ? opts.db : path.join(REPO_ROOT, opts.db);
  const outPath = path.isAbsolute(opts.out) ? opts.out : path.join(REPO_ROOT, opts.out);

  let db = null;
  try {
    db = openRoomDb(roomDir, { allowExtension: true });

    // (2) Build the tri-modal index: embed EACH node ONCE into the derived tables.
    // roomDir threads into the Artifact/memory_artifact path-body fallback so the
    // lexical + semantic legs index the real markdown body, not just the title.
    const encodeFn = opts.offline ? stubEncode : undefined;
    const idx = await triModal.indexNodes(db, { encodeFn: encodeFn, roomDir: roomDir });

    // (3) Load node rows + their text; read vectors back ONCE (embed once, score
    // many). CRITICAL: only trust vectors this run FRESHLY embedded (idx.embedded).
    // The derived eureka_vec tables persist in room.db across runs, so an earlier
    // offline (stub) run leaves stub vectors behind; if the live encoder then
    // fails to embed (embedded === false), reading those stale rows would score a
    // report labeled LIVE using STUB vectors. Gate on idx.embedded to refuse that.
    const rows = db.prepare('SELECT id, type, properties FROM nodes').all();
    const rootOf = buildRootDomainMap(rows);
    const vecErr = {};
    const vectors = idx.embedded === true ? loadIndexVectors(db, idx.vec_backend, vecErr) : new Map();

    const nodes = [];
    if (idx.embedded === true) {
      for (let i = 0; i < rows.length; i += 1) {
        // Thread roomDir so the pair-text scored by the lexical leg is the SAME
        // body text the vectors embedded (title-only would desync the two legs).
        const text = triModal.nodeText(rows[i], { roomDir: roomDir });
        if (!text) continue;
        const vec = vectors.get(rows[i].id);
        if (!vec) continue; // no vector for this node -> cannot score
        nodes.push({ id: rows[i].id, type: rows[i].type || 'unknown', text: text, root: rootOf(rows[i].id), vec: vec });
      }
    }

    const prov = spine.encoderProvenance();
    const provOut = {
      model: opts.offline ? 'stub (deterministic hashed bag-of-tokens)' : prov.model,
      dtype: opts.offline ? 'stub' : prov.dtype,
      lexical_method: 'jaccard-v1',
    };
    const diffFloor = process.env.EUREKA_DIFF_FLOOR || '0.3 (default)';
    const rrfK = process.env.EUREKA_RRF_K || '25 (default)';
    const runDate = new Date().toISOString().slice(0, 10);

    // (4) + (5): enumerate CROSS-BOUNDARY pairs and score with reused vectors.
    // 2026: memory is bounded. The original pushed one object (with both full texts) per scored
    // pair, so a 5000-node room held ~12.5M objects before sorting. Now: a bounded top-N list, one
    // float per scored pair for the percentile table, and (above --max-pairs) seeded pair sampling.
    let part8Skipped = 0;
    let scoreErrors = 0;
    let firstScoreError = '';
    const fireCounts = {};
    for (let i = 0; i < FIRE_BANDS.length; i += 1) fireCounts[FIRE_BANDS[i]] = 0;
    const nN = nodes.length;
    const totalPairs = nN * (nN - 1) / 2;
    const sampleP = totalPairs > opts.maxPairs ? opts.maxPairs / totalPairs : 1;
    const rnd = mulberry32(hashSeed(opts.seed));
    const capacity = Math.max(16, Math.min(Math.ceil(totalPairs), Math.ceil(opts.maxPairs * 1.05) + 1024));
    let absBuf = new Float64Array(Math.min(capacity, 1 << 16));
    let scoredCount = 0;
    let eligible = 0;
    let sum = 0;
    let sumSq = 0;
    const topK = [];

    for (let i = 0; i < nN; i += 1) {
      for (let j = i + 1; j < nN; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        const crossDomain = a.root !== b.root;
        const crossType = a.type !== b.type;
        if (!crossDomain && !crossType) continue; // same-domain same-type excluded
        eligible += 1;
        if (sampleP < 1 && rnd() >= sampleP) continue;
        if (scoredCount >= capacity) continue;
        // scoreMeasured runs the Canon Part 8 defense-in-depth audit on its
        // inputs and THROWS ExternalEgressViolation on a forbidden pattern (e.g.
        // a K/M/B figure). This runner is LOCAL-only (it never egresses), so a
        // single tripping node must not abort the whole report: skip + count it.
        let r;
        try {
          // eslint-disable-next-line no-await-in-loop
          r = await scoreMeasured(a.text, b.text, { vectors: [a.vec, b.vec] });
        } catch (e) {
          // 2026: only an egress-audit refusal is a "Part 8 skip"; any other failure is a scoring
          // error and is counted and surfaced separately instead of hiding inside that number.
          if (/egress/i.test(String((e && e.name) || '') + ' ' + String((e && e.message) || ''))) part8Skipped += 1;
          else { scoreErrors += 1; if (!firstScoreError) firstScoreError = String(e && e.message ? e.message : e).slice(0, 120); }
          continue;
        }
        if (r.warning === 'encoder_unavailable' || r.signed_diff === null) continue;
        const absd = r.abs_diff;
        if (!Number.isFinite(absd)) continue;
        for (let k = 0; k < FIRE_BANDS.length; k += 1) {
          if (absd > FIRE_BANDS[k]) fireCounts[FIRE_BANDS[k]] += 1;
        }
        if (scoredCount >= absBuf.length) {
          const bigger = new Float64Array(Math.min(capacity, absBuf.length * 2));
          bigger.set(absBuf);
          absBuf = bigger;
        }
        absBuf[scoredCount] = absd;
        scoredCount += 1;
        sum += absd; sumSq += absd * absd;
        insertTopK(topK, {
          i: i, j: j, absd: absd,
          semantic: r.semantic, lexical: r.lexical, signed_diff: r.signed_diff,
          direction: r.direction, band: r.band, passes: r.passes,
        }, opts.top);
      }
    }

    const sortedAbs = absBuf.slice(0, scoredCount).sort();
    const mean = scoredCount ? sum / scoredCount : null;
    const variance = scoredCount ? Math.max(0, sumSq / scoredCount - mean * mean) : null;
    const std = variance === null ? null : Math.sqrt(variance);
    const candidates = topK.map(function (e) {
      return {
        idA: nodes[e.i].id, idB: nodes[e.j].id,
        textA: nodes[e.i].text, typeA: nodes[e.i].type, textB: nodes[e.j].text, typeB: nodes[e.j].type,
        semantic: e.semantic, lexical: e.lexical, signed_diff: e.signed_diff,
        abs_diff: e.absd, direction: e.direction, band: e.band, passes: e.passes,
        pct: percentileOfSorted(sortedAbs, e.absd),
        z: (std && std > 0) ? (e.absd - mean) / std : null,
      };
    });
    const percentiles = [50, 90, 95, 99].map(function (pp) { return { p: pp, value: quantileOfSorted(sortedAbs, pp / 100) }; });

    const encoderUnavailable = idx.embedded !== true;

    const report = renderReport({
      offline: opts.offline,
      roomDir: opts.db,
      provenance: provOut,
      dim: nodes.length ? nodes[0].vec.length : EMBED_DIM,
      vecBackend: idx.vec_backend,
      diffFloor: diffFloor,
      rrfK: rrfK,
      nodeCount: rows.length,
      indexedCount: idx.indexed,
      pairCount: scoredCount,
      part8Skipped: part8Skipped,
      scoreErrors: scoreErrors,
      firstScoreError: firstScoreError,
      seed: opts.seed,
      maxPairs: opts.maxPairs,
      eligiblePairs: eligible,
      sampledFraction: sampleP,
      percentiles: percentiles,
      absMean: mean,
      absStd: std,
      vectorLoadError: vecErr.message || '',
      runTimestamp: new Date().toISOString(),
      nodeVersion: process.version,
      runDate: runDate,
      fireCounts: fireCounts,
      top: opts.top,
      candidates: candidates,
      encoderUnavailable: encoderUnavailable,
    });

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath + '.tmp', report, 'utf8');
    fs.renameSync(outPath + '.tmp', outPath);
    process.stdout.write('eureka-room-report: wrote ' + outPath + ' ('
      + scoredCount + ' pairs scored, ' + candidates.length + ' candidates, backend '
      + idx.vec_backend + ', mode ' + (opts.offline ? 'offline' : 'live') + ')\n');
    return 0;
  } catch (err) {
    process.stderr.write('eureka-room-report FAILED: ' + String(err && err.message ? err.message : err) + '\n');
    return 1;
  } finally {
    if (db) closeRoomDb(db);
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then(function (code) { process.exit(code); }, function (err) {
    process.stderr.write('eureka-room-report FAILED: ' + String(err && err.message ? err.message : err) + '\n');
    process.exit(1);
  });
}

module.exports = { parseArgv: parseArgv, stubEncode: stubEncode, buildRootDomainMap: buildRootDomainMap, loadIndexVectors: loadIndexVectors, truncate: truncate, main: main, insertTopK: insertTopK, percentileOfSorted: percentileOfSorted };
