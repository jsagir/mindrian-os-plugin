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
function enumerateArtifacts(roomDir) {
  const root = path.resolve(typeof roomDir === 'string' ? roomDir : '');
  const out = [];
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
  return out.map((abs) => makeArtifact(root, abs));
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
 * buildAllPairs(roomDir) -> [{ a: older, b: newer }]
 *
 * The backfill full pairwise builder over the same enumeration: N-choose-2 unique
 * unordered pairs, each ordered by mtimeMs ascending (a = older) so the INFORMS
 * direction rule composes.
 */
function buildAllPairs(roomDir) {
  const arts = enumerateArtifacts(roomDir);
  const pairs = [];
  for (let i = 0; i < arts.length; i += 1) {
    for (let j = i + 1; j < arts.length; j += 1) {
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

module.exports = {
  classifyScore,
  scoreBasedDeriveFn,
  buildNewArtifactPairs,
  buildAllPairs,
  // White-box surface for tests (resolved floors + the enumerator).
  _test: {
    resolveFloors: resolveFloors,
    enumerateArtifacts: enumerateArtifacts,
    artifactId: artifactId,
    DERIVE_CONVERGES_FLOOR_DEFAULT: DERIVE_CONVERGES_FLOOR_DEFAULT,
    DERIVE_INFORMS_FLOOR_DEFAULT: DERIVE_INFORMS_FLOOR_DEFAULT,
    REASON_CONVERGES: REASON_CONVERGES,
    REASON_INFORMS: REASON_INFORMS,
  },
};
