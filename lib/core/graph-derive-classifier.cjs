'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 224-01 (D-01) -- lib/core/graph-derive-classifier.cjs
 * ==========================================================
 * The THIN score-to-edge-type classification layer. It consumes
 * rs-differential-scorer.cjs::scoreMeasured() output AS-IS and maps a semantic
 * similarity band to a CASCADE edge type. It NEVER modifies the scorer.
 *
 * D-01 (the navigator ruling): score-based derivation claims CONVERGES and
 * INFORMS ONLY. High semantic band -> CONVERGES; moderate band -> INFORMS with
 * direction older-artifact-INFORMS-newer. CONTRADICTS / INVALIDATES / REFINES /
 * ROOT_CAUSES are STRUCTURALLY EXCLUDED here: similarity is symmetric, so an "X"
 * artifact and a "not-X" artifact look near-identical topically, and a false
 * stance edge is the noisiest possible proposal to a navigator. Those stance
 * types are reserved for a future LLM-critiqued pass (SEED-034 fable-mode), never
 * this score-only layer. Precision over recall, always: these edges land as
 * proposals a human ratifies, and a flood of wrong proposals kills trust.
 *
 * ---------------------------------------------------------------------------
 * CALIBRATION EVIDENCE (D-01 hard requirement: floors from the fixture, NOT from
 * intuition). Observed with the REAL local encoder (MongoDB/mdbr-leaf-ir, q8,
 * 384-dim) over the b2-journey fixture (tests/helpers/fixture-room-224.cjs),
 * measured 2026-07-15 via the --calibrate leg of tests/test-224-classifier.cjs:
 *
 *   | Pair class                         | n   | min     | mean   | max    |
 *   |------------------------------------|-----|---------|--------|--------|
 *   | RELATED pair (mealkit A vs B)      | 1   |  0.6095 | 0.6095 | 0.6095 |
 *   | related-vs-unrelated (topic noise) | 19  | -0.0466 | 0.0437 | 0.1351 |
 *   | unrelated-cross (domain noise)     | 171 | -0.0449 | 0.1023 | 0.3683 |
 *   | ALL non-related noise              | 190 | -0.0466 | 0.0965 | 0.3683 |
 *
 * The highest observed NON-related (noise) semantic is 0.3683 (a single
 * cross-science outlier; the noise mean is ~0.10). The one RELATED pair sits at
 * 0.6095. The derived floors, biased UPWARD (precision over recall) with a clear
 * margin above the highest observed noise:
 *
 *   DERIVE_CONVERGES_FLOOR = 0.55  (below the 0.6095 related pair so it fires
 *     CONVERGES; ~0.18 above the 0.3683 noise ceiling)
 *   DERIVE_INFORMS_FLOOR   = 0.45  (a moderate band strictly between the noise
 *     ceiling 0.3683 and the CONVERGES floor; ~0.08 margin above noise)
 *
 * On this fixture the related pair therefore classifies CONVERGES and every
 * unrelated pair classifies null (nothing) -- the designed-for precision.
 * Both floors are env-overridable (DERIVE_CONVERGES_FLOOR / DERIVE_INFORMS_FLOOR,
 * matching the RS_SEMANTIC_FLOOR naming convention), read at CALL time.
 * ---------------------------------------------------------------------------
 *
 * Canon Part 8: LOCAL only. This module reads artifact TEXT from the local fs
 * and scores it with the LOCAL scorer; ZERO network primitives (no fetch / http /
 * brain-client). It requires ONLY node built-ins + rs-differential-scorer.cjs --
 * NOT node:sqlite / DatabaseSync / navigation.cjs / graph-backfill.cjs (keeps the
 * Part 9 sweep clean and avoids a require cycle with graph-backfill).
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE). CJS only, zero new deps.
 */

const fs = require('node:fs');
const path = require('node:path');

// Default deriveFn scorer: the shipped pairwise measured scorer, consumed AS-IS.
const { scoreMeasured } = require('./rs-differential-scorer.cjs');

// ---------------------------------------------------------------------------
// Floors (fixture-calibrated; see the CALIBRATION EVIDENCE header block).
// ---------------------------------------------------------------------------
const DERIVE_CONVERGES_FLOOR_DEFAULT = 0.55;
const DERIVE_INFORMS_FLOOR_DEFAULT = 0.45;

function resolveFloor(envName, def) {
  const raw = process.env[envName];
  if (typeof raw === 'string' && raw.trim() !== '') {
    const v = Number(raw);
    // STRICTLY positive: a 0 floor makes EVERY non-negative pair a proposal --
    // exactly the false-proposal flood the calibrated floors exist to prevent
    // (the MINDRIAN_WHATWHY_MARGIN contract rejects 0 for the same reason).
    if (!Number.isNaN(v) && v > 0 && v <= 1) return v;
  }
  return def;
}

// Read at CALL time so a consumer (or test) can flip a floor between calls.
// GUARDED PAIR INVARIANT: converges >= informs. An env pair that inverts the
// bands (CONVERGES floor below the INFORMS floor) would erase the INFORMS band
// and classify low scores as CONVERGES; on violation BOTH floors fall back to
// the calibrated defaults (a half-honored malformed pair is not honest either).
function resolveFloors() {
  const converges = resolveFloor('DERIVE_CONVERGES_FLOOR', DERIVE_CONVERGES_FLOOR_DEFAULT);
  const informs = resolveFloor('DERIVE_INFORMS_FLOOR', DERIVE_INFORMS_FLOOR_DEFAULT);
  if (converges < informs) {
    return {
      converges: DERIVE_CONVERGES_FLOOR_DEFAULT,
      informs: DERIVE_INFORMS_FLOOR_DEFAULT,
    };
  }
  return { converges: converges, informs: informs };
}

/**
 * classifyScore(scoreResult, meta) -> { edge_type: 'CONVERGES' | 'INFORMS' } | null
 *
 * Pure function. Reads scoreResult.semantic (the topical cosine, per RESEARCH
 * note A1 -- NOT abs_diff). Returns the CONVERGES band at/above the converges
 * floor, the INFORMS band at/above the informs floor, else null. A null /
 * non-finite semantic (encoder unavailable) always returns null. It can NEVER
 * emit a stance-requiring edge type -- that exclusion is structural, not
 * accidental (D-01).
 */
function classifyScore(scoreResult, meta) {
  if (!scoreResult || typeof scoreResult !== 'object') return null;
  const sem = scoreResult.semantic;
  if (typeof sem !== 'number' || !Number.isFinite(sem)) return null;
  const floors = resolveFloors();
  if (sem >= floors.converges) return { edge_type: 'CONVERGES' };
  if (sem >= floors.informs) return { edge_type: 'INFORMS' };
  return null;
}

// The two reason scalars (short, enum-like; NEVER prose / venture bytes).
const REASON_CONVERGES = 'high semantic similarity';
const REASON_INFORMS = 'moderate semantic similarity';

/**
 * scoreBasedDeriveFn(step, injectOpts) -> Promise<Array<candidate>>
 *
 * Matches the runDerivation producer contract on its first arg
 * ({ roomDir, artifactPair, llm }). artifactPair is { a, b } where each member
 * carries { id, path, text, mtimeMs, vector? }.
 *
 * injectOpts is the test seam: { scoreFn?, scoreOpts?, onOutcome? }. scoreFn
 * defaults to the rs-differential-scorer scoreMeasured; scoreOpts is merged into
 * the scoreMeasured opts so tests inject encodeFn / _forceUnavailable
 * deterministically. onOutcome is an ADVISORY callback (never awaited, errors
 * swallowed) fired with { outcome: 'encoder_unavailable' } when a pair returns
 * [] because the encoder went silent -- the caller-side D-04 disclosure seam:
 * a probe that passed once does not prove the encoder survived the whole run,
 * and without this signal a mid-run encoder death is an undisclosed 0-edge
 * outcome reported as success.
 *
 * Returns:
 *   - [] on a missing / degenerate pair.
 *   - [] when the score result has semantic null OR warning encoder_unavailable
 *     (D-04 UPSTREAM SILENCE: the derive layer stays quiet here; the disclosure
 *     marker is the CALLER's job, per the plan).
 *   - one candidate tuple { source, target, edge_type, reason } otherwise.
 *
 * Direction: CONVERGES keeps pair order (source = a). INFORMS directs
 * source = OLDER artifact, target = NEWER artifact using mtimeMs, falling back to
 * the given pair order when mtimes are missing or equal (D-01 older-INFORMS-newer).
 * When both members carry a vector field, opts.vectors is passed to skip
 * re-embedding (RESEARCH Pitfall 4); absence must not break anything.
 */
async function scoreBasedDeriveFn(step, injectOpts) {
  const opts = (injectOpts && typeof injectOpts === 'object') ? injectOpts : {};
  const onOutcome = (typeof opts.onOutcome === 'function') ? opts.onOutcome : null;
  const reportOutcome = (outcome) => {
    if (onOutcome) {
      try { onOutcome({ outcome: outcome }); } catch (_e) { /* advisory only */ }
    }
  };
  const pair = step && typeof step === 'object' ? step.artifactPair : null;
  if (!pair || typeof pair !== 'object' || !pair.a || !pair.b) return [];

  const a = pair.a;
  const b = pair.b;
  const aId = (typeof a.id === 'string') ? a.id : '';
  const bId = (typeof b.id === 'string') ? b.id : '';
  if (!aId || !bId || aId === bId) return [];
  const aText = (typeof a.text === 'string') ? a.text : '';
  const bText = (typeof b.text === 'string') ? b.text : '';

  const scoreFn = (typeof opts.scoreFn === 'function') ? opts.scoreFn : scoreMeasured;
  const scoreOpts = (opts.scoreOpts && typeof opts.scoreOpts === 'object')
    ? Object.assign({}, opts.scoreOpts)
    : {};
  // RESEARCH Pitfall 4: reuse precomputed vectors when BOTH members carry one.
  if (Array.isArray(a.vector) && Array.isArray(b.vector) && scoreOpts.vectors === undefined) {
    scoreOpts.vectors = [a.vector, b.vector];
    // D-379.1-04: name the model behind the cached vectors so provenance is real.
    if (scoreOpts.vectorsProvenance === undefined
      && typeof a.vector_model === 'string' && a.vector_model.length > 0
      && a.vector_model === b.vector_model) {
      scoreOpts.vectorsProvenance = { model: a.vector_model, dtype: 'cached' };
    }
  }

  let scoreResult;
  try {
    scoreResult = await scoreFn(aText, bText, scoreOpts);
  } catch (_e) {
    return [];
  }
  if (!scoreResult || typeof scoreResult !== 'object') return [];
  // D-04 upstream silence: encoder unavailable -> derive nothing here, but SIGNAL
  // the caller (onOutcome) so the disclosure marker can still be written when the
  // encoder dies AFTER a passing probe (probe-then-score is a TOCTOU window).
  if (scoreResult.semantic === null || scoreResult.semantic === undefined) {
    reportOutcome('encoder_unavailable');
    return [];
  }
  if (scoreResult.warning === 'encoder_unavailable') {
    reportOutcome('encoder_unavailable');
    return [];
  }

  const cls = classifyScore(scoreResult);
  if (!cls) return [];

  if (cls.edge_type === 'CONVERGES') {
    return [{ source: aId, target: bId, edge_type: 'CONVERGES', reason: REASON_CONVERGES }];
  }

  // INFORMS: older -> newer using mtimeMs; fall back to given order when missing
  // or equal.
  let sourceId = aId;
  let targetId = bId;
  const aM = Number(a.mtimeMs);
  const bM = Number(b.mtimeMs);
  if (Number.isFinite(aM) && Number.isFinite(bM) && aM !== bM) {
    if (aM <= bM) { sourceId = aId; targetId = bId; } else { sourceId = bId; targetId = aId; }
  }
  return [{ source: sourceId, target: targetId, edge_type: 'INFORMS', reason: REASON_INFORMS }];
}

// ---------------------------------------------------------------------------
// Pair builders (Req 6). Pure LOCAL fs enumeration; md-only by design this phase.
// ---------------------------------------------------------------------------

// Structural scaffold basenames the enumerator SKIPS (precision over recall:
// scaffold-to-content edges are noise).
const SCAFFOLD_BASENAMES = Object.freeze(new Set([
  'ROOM.md', 'STATE.md', 'MINTO.md', 'FEYNMAN.md', 'BRAIN.md',
  // 369.25-19: the generated brief is a projection, not content to pair.
  'BRIEF.md',
]));

// The indexed-artifact node-id convention (mirrors lazygraph-ops.cjs
// getArtifactId: rel path from the room root, artifact extension stripped, slashes
// normalized). Replicated here so this module does NOT require lazygraph-ops
// (avoids a require cycle + keeps the Part 9 sweep clean). Fallback: the
// graph-backfill 'artifact:' + basename convention.
function artifactId(roomDir, absPath) {
  try {
    const rel = path.relative(path.resolve(roomDir), path.resolve(absPath));
    if (!rel || rel.startsWith('..')) {
      return 'artifact:' + path.basename(absPath);
    }
    return rel.replace(/\.(md|docx|html|htm)$/i, '').replace(/\\/g, '/');
  } catch (_e) {
    return 'artifact:' + path.basename(absPath);
  }
}

function makeArtifact(roomDir, absPath) {
  let text = '';
  try { text = fs.readFileSync(absPath, 'utf8'); } catch (_e) { text = ''; }
  let mtimeMs = 0;
  try { mtimeMs = fs.statSync(absPath).mtimeMs; } catch (_e) { mtimeMs = 0; }
  return { id: artifactId(roomDir, absPath), path: absPath, text: text, mtimeMs: mtimeMs };
}

// Recursive markdown walker. Skips dot-entries (dotfiles + dot-directories),
// skips any SUBdirectory carrying its own .room-root sentinel (sub-room sweep is
// deferred, SEED-034 pipe 2), skips the scaffold basenames, and is md-only
// (non-md readability deferred, pipe 3). The ROOM ROOT's own .room-root is a
// dotfile so it is skipped by the dot-entry rule; the root dir itself is walked.
// Phase 379.1 (CPU379-10): a directory the artifact scope excludes (a declared
// pattern or a marker file) is skipped too. The scope is loaded ONCE per call.
function loadScopeSafe(root) {
  try {
    // eslint-disable-next-line global-require
    return require('./artifact-scope.cjs').loadScope(root);
  } catch (_e) {
    return null;
  }
}

function walkMarkdown(root, scope) {
  const out = [];
  let isExcludedDir = null;
  if (scope) {
    try {
      // eslint-disable-next-line global-require
      isExcludedDir = require('./artifact-scope.cjs').isExcludedDir;
    } catch (_e) { isExcludedDir = null; }
  }
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_e) {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        // Skip a sub-room: a subdirectory carrying its OWN .room-root sentinel.
        if (fs.existsSync(path.join(abs, '.room-root'))) continue;
        // CPU379-10: skip a declared or marked generated directory.
        if (isExcludedDir) {
          let skip = false;
          try { skip = isExcludedDir(abs, root, scope) === true; } catch (_se) { skip = false; }
          if (skip) continue;
        }
        walk(abs);
      } else if (e.isFile()) {
        if (path.extname(e.name).toLowerCase() !== '.md') continue;
        if (SCAFFOLD_BASENAMES.has(e.name)) continue;
        out.push(abs);
      }
    }
  }
  walk(root);
  // Deterministic order.
  out.sort();
  return out;
}

// { artifacts, scope }: scope is the loadScope result (its stats feed the drain's
// disclosure) or null when the scope module could not load.
function enumerateArtifactsWithScope(roomDir) {
  const root = path.resolve(typeof roomDir === 'string' ? roomDir : '');
  const scope = loadScopeSafe(root);
  const artifacts = walkMarkdown(root, scope).map((abs) => makeArtifact(root, abs));
  return { artifacts: artifacts, scope: scope };
}

function enumerateArtifacts(roomDir) {
  return enumerateArtifactsWithScope(roomDir).artifacts;
}

/**
 * buildNewArtifactPairs(roomDir, newFilePath) -> [{ a: newArtifact, b: existing_i }]
 *
 * The Req 6 O(n) pair builder: pair the NEW artifact with every OTHER enumerated
 * artifact (never itself). On a room with N existing artifacts plus the new file,
 * returns exactly N pairs.
 */
function buildNewArtifactPairs(roomDir, newFilePath) {
  if (typeof roomDir !== 'string' || typeof newFilePath !== 'string') return [];
  const arts = enumerateArtifacts(roomDir);
  const newId = artifactId(roomDir, newFilePath);
  let newArt = arts.find((x) => x.id === newId);
  if (!newArt) {
    // The new file may not be enumerated yet (e.g. not on disk); build it directly.
    newArt = makeArtifact(roomDir, newFilePath);
  }
  const pairs = [];
  for (const ex of arts) {
    if (ex.id === newArt.id) continue;
    pairs.push({ a: newArt, b: ex });
  }
  return pairs;
}

/**
 * buildAllPairs(roomDir, opts) -> [{ a: older, b: newer }]
 *
 * The backfill full pairwise builder over the same enumeration: N-choose-2 unique
 * unordered pairs, each ordered by mtimeMs ascending (a = older) so the INFORMS
 * direction rule composes. opts.limit (379.1, additive): stop after limit pairs, so
 * a caller never materializes more pair objects than it will use. The one-argument
 * call is unchanged.
 */
function buildAllPairs(roomDir, opts) {
  const arts = enumerateArtifacts(roomDir);
  const limit = (opts && Number.isInteger(opts.limit) && opts.limit >= 0) ? opts.limit : Infinity;
  const pairs = [];
  for (let i = 0; i < arts.length; i += 1) {
    for (let j = i + 1; j < arts.length; j += 1) {
      if (pairs.length >= limit) return pairs;
      let a = arts[i];
      let b = arts[j];
      if (Number(a.mtimeMs) > Number(b.mtimeMs)) {
        const tmp = a; a = b; b = tmp;
      }
      pairs.push({ a: a, b: b });
    }
  }
  return pairs;
}

/**
 * countAllPairs(roomDir) -> n * (n - 1) / 2 over the scope-filtered enumeration.
 * Builds no pair objects (D-379.1-11).
 */
function countAllPairs(roomDir) {
  const n = enumerateArtifacts(roomDir).length;
  return (n * (n - 1)) / 2;
}

// ---------------------------------------------------------------------------
// Phase 379.1: embed once, prune by top-k cosine, bounded cursor input.
// ---------------------------------------------------------------------------

// The k of the top-k pruner (D-379.1-12). Read from tests/fixtures/379.1/probe-k.json
// (status ok, chosen_k 20, recall_shortfall false): k = 20 is the smallest probed k that
// keeps 0.95 recall of both edge types. Baseline (39 artifacts, 741 pairs): CONVERGES 1.0,
// INFORMS 1.0 at k = 20. Large sample (300 of 2158 artifacts, 44,850 pairs): CONVERGES 1.0,
// INFORMS 0.9925 at k = 20 (k = 10 loses INFORMS edges: 0.872 and 0.854). Env override
// MINDRIAN_DERIVE_PRUNE_K.
const DEFAULT_PRUNE_K = 20;

// Ceiling on the pairs one room-scope entry may ever score (D-379.1-01). An entry whose
// bound min(N * k, N * (N - 1) / 2) is above it clears with a disclosed skip. Lives here
// so lib/core/graph-backfill.cjs can require it without reaching into scripts/.
const DEFAULT_MAX_PAIRS_PER_ENTRY = 50000;

function resolvePositiveIntEnv(envName, def) {
  const raw = process.env[envName];
  if (typeof raw === 'string' && raw.trim() !== '' && /^\d+$/.test(raw.trim())) {
    const v = Number(raw.trim());
    if (Number.isSafeInteger(v) && v > 0) return v;
  }
  return def;
}

function resolvePruneK() {
  return resolvePositiveIntEnv('MINDRIAN_DERIVE_PRUNE_K', DEFAULT_PRUNE_K);
}

function resolveMaxPairsPerEntry() {
  return resolvePositiveIntEnv('MINDRIAN_DERIVE_MAX_PAIRS_PER_ENTRY', DEFAULT_MAX_PAIRS_PER_ENTRY);
}

function _validVector(v) {
  if (!Array.isArray(v) || v.length === 0) return false;
  for (let i = 0; i < v.length; i += 1) {
    if (typeof v[i] !== 'number' || !Number.isFinite(v[i])) return false;
  }
  return true;
}

/**
 * attachVectors(roomDir, artifacts, opts) -> Promise<{ ready, embedded, hits,
 *   misses_left, encoderUnavailable, model, dim, saves }>
 *
 * Embeds each artifact at most once per content hash (CPU379-01). A cache hit
 * (same hash, same model, same dim) costs nothing; a miss is embedded in batches of
 * resolveBatchSize(). The cache file is saved after every SAVE_EVERY_BATCHES-th batch,
 * at the deadline, at an encoder failure and at the end, never per row and never per
 * batch. At least one batch runs per call so a tiny budget still makes progress.
 * opts = { cacheFile?, embedFn?, deadlineMs?, dim?, model? }. Never throws.
 */
async function attachVectors(roomDir, artifacts, opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  const list = Array.isArray(artifacts) ? artifacts : [];
  const res = {
    ready: 0, embedded: 0, hits: 0, misses_left: 0,
    encoderUnavailable: false, model: '', dim: 0, saves: 0,
  };
  try {
    // eslint-disable-next-line global-require
    const spine = require('./semantic-index/embedding-spine.cjs');
    // eslint-disable-next-line global-require
    const vectorCache = require('./semantic-index/vector-cache.cjs');
    const injected = typeof o.embedFn === 'function';
    const prov = spine.encoderProvenance();
    const model = (typeof o.model === 'string' && o.model.length > 0) ? o.model : prov.model;
    // An injected embedFn (test seam) produces vectors of its own width: do not pin the
    // length unless the caller says so. The real spine always produces resolveDim().
    const dim = Number.isInteger(o.dim) && o.dim > 0 ? o.dim : (injected ? 0 : spine.resolveDim());
    res.model = model;
    res.dim = dim;
    const cacheFile = (typeof o.cacheFile === 'string' && o.cacheFile.length > 0)
      ? o.cacheFile
      : path.join(path.resolve(roomDir), '.mindrian', 'graph-derive-vectors.json');
    const loaded = vectorCache.load(cacheFile, { version: '1', model: model, dim: dim });
    const cache = loaded.cache;

    const misses = [];
    for (const art of list) {
      if (!art || typeof art.id !== 'string') continue;
      const digest = vectorCache.contentHash(art.text);
      art.content_hash = digest;
      const row = cache[art.id];
      if (row && row.hash === digest) {
        art.vector = row.vector;
        art.vector_model = model;
        res.hits += 1;
      } else {
        misses.push(art);
      }
    }

    const embedBatch = injected ? o.embedFn : (texts) => spine.embedTexts(texts, {});
    const batchSize = spine._test.resolveBatchSize();
    const liveIds = new Set(list.filter((a) => a && typeof a.id === 'string').map((a) => a.id));
    let batches = 0;
    let unsaved = 0;
    const saveNow = () => {
      vectorCache.prune(cache, liveIds);
      if (vectorCache.save(cacheFile, cache, model, '1')) res.saves += 1;
      unsaved = 0;
    };

    let pos = 0;
    while (pos < misses.length) {
      // The deadline is checked between batches, after the first one (progress guarantee).
      if (batches > 0 && typeof o.deadlineMs === 'number' && Date.now() > o.deadlineMs) break;
      const batch = misses.slice(pos, pos + batchSize);
      let out = null;
      try {
        // eslint-disable-next-line no-await-in-loop
        out = await embedBatch(batch.map((a) => a.text));
      } catch (_e) {
        out = null;
      }
      const vecs = out && out.success === true && Array.isArray(out.vectors) ? out.vectors : null;
      let good = vecs !== null && vecs.length === batch.length;
      if (good) {
        for (const v of vecs) {
          if (!_validVector(v) || (dim > 0 && v.length !== dim)) { good = false; break; }
        }
      }
      if (!good) {
        res.encoderUnavailable = true;
        break;
      }
      for (let i = 0; i < batch.length; i += 1) {
        const art = batch[i];
        cache[art.id] = { hash: art.content_hash, model: model, vector: vecs[i] };
        art.vector = vecs[i];
        art.vector_model = model;
        res.embedded += 1;
      }
      pos += batch.length;
      batches += 1;
      unsaved += 1;
      if (batches % vectorCache.SAVE_EVERY_BATCHES === 0) saveNow();
    }
    // Save at the deadline, at an encoder failure and at the end: any batch since the last save.
    if (unsaved > 0) saveNow();
    res.misses_left = misses.length - pos;
    if (res.encoderUnavailable === false && res.misses_left === 0 && res.embedded === 0 && loaded.dropped > 0) {
      // A cache that dropped rows but needed no embedding: rewrite it without them.
      saveNow();
    }
  } catch (_e) {
    res.encoderUnavailable = true;
  }
  res.ready = list.filter((a) => a && _validVector(a.vector)).length;
  return res;
}

/**
 * buildCandidatePairs(artifacts, { k, floor, deadlineMs }) -> { pairs, total, pruned,
 *   allPairs, scopeHash, deadline_hit }
 *
 * The top-k cosine pruner (D-379.1-12, P-379.1-01). One dot product per unordered
 * pair over a packed Float32Array; a pair becomes a candidate when it is in either
 * member's top-k list and its cosine is at or above floor minus 0.0001. So the result
 * holds at most N * k pairs, sorted by (i, j) over the id-sorted list, and the
 * scoring cost is bounded by N * k instead of N * (N - 1) / 2. The deadline is checked
 * at the start of every row inside the synchronous loop (a timer cannot fire here).
 */
function buildCandidatePairs(artifacts, opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  // eslint-disable-next-line global-require
  const vectorCache = require('./semantic-index/vector-cache.cjs');
  const all = (Array.isArray(artifacts) ? artifacts : []).filter((a) => a && typeof a.id === 'string');
  const arts = all.slice().sort((x, y) => (x.id < y.id ? -1 : (x.id > y.id ? 1 : 0)));
  const n = arts.length;
  const allPairs = (n * (n - 1)) / 2;
  const entries = arts.map((a) => ({
    id: a.id,
    hash: (typeof a.content_hash === 'string') ? a.content_hash : vectorCache.contentHash(a.text),
  }));
  const scopeHash = vectorCache.scopeHash(entries);
  const empty = { pairs: [], total: 0, pruned: 0, allPairs: allPairs, scopeHash: scopeHash, deadline_hit: false };

  let dim = 0;
  for (const a of arts) {
    if (_validVector(a.vector)) { dim = a.vector.length; break; }
  }
  if (n < 2 || dim === 0) { empty.pruned = allPairs; return empty; }

  const k = (Number.isInteger(o.k) && o.k > 0) ? o.k : resolvePruneK();
  const floor = (typeof o.floor === 'number' && Number.isFinite(o.floor))
    ? o.floor : resolveFloors().informs;
  const cut = floor - 0.0001;

  // Pack and normalize (defensive; the spine already normalizes). A row without a
  // usable vector stays all zero, so its cosine is 0 and it joins no candidate pair.
  const mat = new Float32Array(n * dim);
  for (let i = 0; i < n; i += 1) {
    const v = arts[i].vector;
    if (!_validVector(v) || v.length !== dim) continue;
    let sq = 0;
    for (let d = 0; d < dim; d += 1) sq += v[d] * v[d];
    const norm = Math.sqrt(sq);
    if (!(norm > 0)) continue;
    const off = i * dim;
    for (let d = 0; d < dim; d += 1) mat[off + d] = v[d] / norm;
  }

  // lists[i] = sorted (descending) array of [score, j], at most k long.
  const lists = new Array(n);
  for (let i = 0; i < n; i += 1) lists[i] = [];
  const offer = (list, score, j) => {
    if (list.length >= k && score <= list[list.length - 1][0]) return;
    let p = list.length;
    while (p > 0 && list[p - 1][0] < score) p -= 1;
    list.splice(p, 0, [score, j]);
    if (list.length > k) list.pop();
  };

  const hasDeadline = typeof o.deadlineMs === 'number';
  for (let i = 0; i < n; i += 1) {
    if (hasDeadline && Date.now() > o.deadlineMs) {
      return { pairs: [], total: 0, pruned: 0, allPairs: allPairs, scopeHash: scopeHash, deadline_hit: true };
    }
    const oi = i * dim;
    for (let j = i + 1; j < n; j += 1) {
      const oj = j * dim;
      let dot = 0;
      for (let d = 0; d < dim; d += 1) dot += mat[oi + d] * mat[oj + d];
      if (dot >= cut) {
        offer(lists[i], dot, j);
        offer(lists[j], dot, i);
      }
    }
  }

  const keys = new Set();
  for (let i = 0; i < n; i += 1) {
    for (const item of lists[i]) {
      const j = item[1];
      const lo = i < j ? i : j;
      const hi = i < j ? j : i;
      keys.add(lo * n + hi);
    }
  }
  const sorted = Array.from(keys).sort((x, y) => x - y);
  const pairs = new Array(sorted.length);
  for (let p = 0; p < sorted.length; p += 1) {
    const lo = Math.floor(sorted[p] / n);
    const hi = sorted[p] - lo * n;
    let a = arts[lo];
    let b = arts[hi];
    if (Number(a.mtimeMs) > Number(b.mtimeMs)) {
      const tmp = a; a = b; b = tmp;
    }
    pairs[p] = { a: a, b: b };
  }
  return {
    pairs: pairs,
    total: pairs.length,
    pruned: allPairs - pairs.length,
    allPairs: allPairs,
    scopeHash: scopeHash,
    deadline_hit: false,
  };
}

module.exports = {
  classifyScore,
  scoreBasedDeriveFn,
  buildNewArtifactPairs,
  buildAllPairs,
  countAllPairs,
  enumerateArtifactsWithScope,
  attachVectors,
  buildCandidatePairs,
  resolvePruneK,
  resolveMaxPairsPerEntry,
  DEFAULT_PRUNE_K,
  DEFAULT_MAX_PAIRS_PER_ENTRY,
  // White-box surface for tests (resolved floors + the enumerator).
  _test: {
    resolveFloors: resolveFloors,
    enumerateArtifacts: enumerateArtifacts,
    artifactId: artifactId,
    resolvePruneK: resolvePruneK,
    resolveMaxPairsPerEntry: resolveMaxPairsPerEntry,
    DEFAULT_PRUNE_K: DEFAULT_PRUNE_K,
    DEFAULT_MAX_PAIRS_PER_ENTRY: DEFAULT_MAX_PAIRS_PER_ENTRY,
    DERIVE_CONVERGES_FLOOR_DEFAULT: DERIVE_CONVERGES_FLOOR_DEFAULT,
    DERIVE_INFORMS_FLOOR_DEFAULT: DERIVE_INFORMS_FLOOR_DEFAULT,
    REASON_CONVERGES: REASON_CONVERGES,
    REASON_INFORMS: REASON_INFORMS,
  },
};
