'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 249-01 Task 1 -- Enrichment queue (ENRICH-01)
 * ====================================================
 * A live reach that hits a 0-2/4 framework becomes a typed enrichment-queue
 * entry at <roomDir>/.mindrian/enrichment-queue.json. Pattern cloned
 * VERBATIM (atomic tmp+fsync+rename write, self-healing reader, idempotent
 * enqueue) from lib/core/brain-derivation-queue.cjs per Canon Part 7 (Reuse
 * Before Build) -- that module was itself cloned from minto-debouncer.cjs.
 *
 * Canon Part 8 invariant (load-bearing):
 *   Queue entries carry ONLY generic handles: canonical framework names,
 *   closed enums, integer scores, ISO timestamps. NEVER user prose, artifact
 *   bodies, meeting fragments, person names, or currency.
 *
 *   The Part-8 forbidden-substring audit (Test-12 pattern, see
 *   tests/test-249-enrichment-queue.cjs Test 5) proves no user prose passes
 *   the entry validator.
 *
 * Idempotency rule:
 *   `framework` (the canonical name) is the unique key. Re-enqueueing the
 *   same framework increments hit_count, refreshes last_seen and
 *   missing_dimensions, and keeps the queue at the same size. A different
 *   framework appends.
 *
 * Caps:
 *   SOFT_CAP = 500 -- enqueue returns warning='queue_soft_cap'
 *   HARD_CAP = 1000 -- enqueue rejected with error='queue_hard_cap'
 *
 * Hot-path fence (Pitfall 6, Phase 245 constraint): this module is required
 * ONLY from the async capture seams in lib/core/brain-client.cjs and
 * lib/brain/framework-chain-slice.cjs -- NEVER from lib/core/sensors/ or the
 * decide() path. tests/test-249-capture-seam.cjs grep-fences this.
 *
 * Pure CJS, node built-ins only, zero npm deps.
 */

const fs = require('node:fs');
const path = require('node:path');

const QUEUE_RELATIVE = path.join('.mindrian', 'enrichment-queue.json');
const SCHEMA_VERSION = 1;

const SOFT_CAP = 500;
const HARD_CAP = 1000;

// Frozen allow-list of entry keys (Canon Part 8 invariant). dimensions_inferred
// is OPTIONAL (only written when true) but still allowed on read.
const ALLOWED_ENTRY_KEYS = Object.freeze([
  'framework',
  'normalized',
  'readiness_score',
  'missing_dimensions',
  'context_class',
  'source',
  'hit_count',
  'first_seen',
  'last_seen',
  'probe_provenance',
  'dimensions_inferred',
]);

// Frozen source vocabulary. 'refusal' is RESERVED for Phase 250 (HONEST-01's
// visible refusal auto-queues through this exact API); validated now so 250
// wires without touching this module.
const ALLOWED_SOURCES = Object.freeze(['live_reach', 'refusal', 'census_seed']);

// Frozen missing-dimensions vocabulary (the four orchestration_readiness
// dimensions: pattern_type known, structure exists, techniques exist, flow
// via LEADS_TO -- research "The typed queue entry").
const ALLOWED_DIMENSIONS = Object.freeze(['pattern_type', 'structure', 'techniques', 'flow']);

// Phase 339 Plan 05 (FLIP-03), 2026-09-03: Theo's orchestration_readiness
// RESOLVED shape reports four booleans on `pr.inputs`, one-for-one with
// ALLOWED_DIMENSIONS, per Theo's own source
// (/home/jsagi/Theo/src/mcp/content/orchestration-readiness.ts:52-73):
// has_structure <- HAS_PHASE|HAS_STAGE|HAS_PROCESS_STEP, has_ordering <-
// LEADS_TO, has_technique <- HAS_TECHNIQUE, pattern_known <-
// orchestration_status. This mapping is exact, never a positional guess.
// Ordered to match ALLOWED_DIMENSIONS ('pattern_type', 'structure',
// 'techniques', 'flow') so a filtered missing_dimensions vector comes out
// in the same deterministic order the incumbent's own vectors already use.
const THEO_INPUT_DIMENSIONS = Object.freeze([
  Object.freeze({ input: 'pattern_known', dimension: 'pattern_type' }),
  Object.freeze({ input: 'has_structure', dimension: 'structure' }),
  Object.freeze({ input: 'has_technique', dimension: 'techniques' }),
  Object.freeze({ input: 'has_ordering', dimension: 'flow' }),
]);

// Frozen context_class member keys. Each member's VALUE is validated against
// its own closed enum (lazy-loaded below to avoid a require-time cost when
// this module is loaded but enqueue() is never called).
const ALLOWED_CONTEXT_CLASS_KEYS = Object.freeze(['reach_id', 'dispatch', 'problem_type', 'trigger_tier']);

// Source-priority for the "never let a seed overwrite a live signal" rule
// (research OQ3: "live_reach entries outrank seeds at equal usage
// downstream; a seed never pretends to be a live miss"). A re-miss with
// source=census_seed never downgrades an existing live_reach/refusal entry.
const _SOURCE_IS_LIVE = Object.freeze({ live_reach: true, refusal: true, census_seed: false });

// ---------------------------------------------------------------------------
// Closed-enum lookups (lazy, cached, defensive against a missing/renamed file).
// ---------------------------------------------------------------------------

let _reachIds = null;
let _triggerTiers = null;
function _loadSensorTypeEnums() {
  if (_reachIds && _triggerTiers) return;
  try {
    const st = require('./sensors/sensor-types.cjs');
    _reachIds = Array.isArray(st.REACH_IDS) ? st.REACH_IDS : [];
    _triggerTiers = Array.isArray(st.TRIGGER_TIERS) ? st.TRIGGER_TIERS : [];
  } catch (_e) {
    _reachIds = [];
    _triggerTiers = [];
  }
}

let _dispatchTokens = null;
function _loadDispatchTokens() {
  if (_dispatchTokens) return _dispatchTokens;
  try {
    const p = path.resolve(__dirname, '..', '..', 'data', 'dispatch-framework-map.json');
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    _dispatchTokens = Object.keys(raw).filter(function (k) { return k !== '_note'; });
  } catch (_e) {
    _dispatchTokens = [];
  }
  return _dispatchTokens;
}

let _problemTypeEnum = null;
function _loadProblemTypeEnum() {
  if (_problemTypeEnum) return _problemTypeEnum;
  try {
    // cross-room-aggregator.cjs's own header explicitly names this "the
    // frozen problem_type enum ('UDP'|'IDP'|'WDP')" -- the canonical source
    // per research "the frozen problem-type enum (grep the codebase for
    // where it is frozen)".
    const cra = require('./cross-room-aggregator.cjs');
    _problemTypeEnum = Array.isArray(cra.PROBLEM_TYPE_ENUM) ? cra.PROBLEM_TYPE_ENUM : [];
  } catch (_e) {
    _problemTypeEnum = [];
  }
  return _problemTypeEnum;
}

function _isValidReachId(v) {
  _loadSensorTypeEnums();
  return typeof v === 'string' && _reachIds.indexOf(v) !== -1;
}
function _isValidTriggerTier(v) {
  _loadSensorTypeEnums();
  return typeof v === 'string' && _triggerTiers.indexOf(v) !== -1;
}
function _isValidDispatch(v) {
  return typeof v === 'string' && _loadDispatchTokens().indexOf(v) !== -1;
}
function _isValidProblemType(v) {
  return typeof v === 'string' && _loadProblemTypeEnum().indexOf(v) !== -1;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function queuePath(roomDir) {
  return path.join(roomDir, QUEUE_RELATIVE);
}

function emptyQueue() {
  return { version: SCHEMA_VERSION, entries: [] };
}

function nowIso() {
  // Seconds precision keeps byte diffs clean in the queue file (mirrors
  // brain-derivation-queue.cjs's nowIso()).
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function isFrameworkNameValid(s) {
  return typeof s === 'string' && s.length >= 1 && s.length <= 120;
}

// Sanitize a context_class candidate down to only valid closed-enum members.
// Any unknown key OR any known key with an invalid value is DROPPED --
// never stored (behavior spec: "an invalid member is DROPPED from the entry,
// never stored").
function sanitizeContextClass(cc) {
  const out = {};
  if (!cc || typeof cc !== 'object' || Array.isArray(cc)) return out;
  for (const k of ALLOWED_CONTEXT_CLASS_KEYS) {
    if (!(k in cc)) continue;
    const v = cc[k];
    if (k === 'reach_id' && _isValidReachId(v)) out.reach_id = v;
    else if (k === 'dispatch' && _isValidDispatch(v)) out.dispatch = v;
    else if (k === 'problem_type' && _isValidProblemType(v)) out.problem_type = v;
    else if (k === 'trigger_tier' && _isValidTriggerTier(v)) out.trigger_tier = v;
  }
  return out;
}

function sanitizeMissingDimensions(md) {
  if (!Array.isArray(md)) return [];
  const seen = new Set();
  const out = [];
  for (const d of md) {
    if (typeof d === 'string' && ALLOWED_DIMENSIONS.indexOf(d) !== -1 && !seen.has(d)) {
      seen.add(d);
      out.push(d);
    }
  }
  return out;
}

function isValidReadinessScore(v) {
  return v === null || (Number.isInteger(v) && v >= 0 && v <= 4);
}

// Full shape validation used by BOTH readQueue's self-healing filter (drop
// unsalvageable entries from a tampered/corrupt file) and enqueue's own
// construction path (one code path, one truth -- no drift between the two).
// Returns null when the entry is unsalvageable (bad framework or bad
// source); otherwise a cleaned, allowlist-shaped entry object.
function cleanEntryForStorage(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (!isFrameworkNameValid(raw.framework)) return null;
  if (ALLOWED_SOURCES.indexOf(raw.source) === -1) return null;

  const readiness_score = isValidReadinessScore(raw.readiness_score) ? raw.readiness_score : null;
  const hit_count = (Number.isInteger(raw.hit_count) && raw.hit_count >= 0) ? raw.hit_count : 0;
  const first_seen = (typeof raw.first_seen === 'string' && raw.first_seen.length > 0) ? raw.first_seen : nowIso();
  const last_seen = (typeof raw.last_seen === 'string' && raw.last_seen.length > 0) ? raw.last_seen : first_seen;
  const probe_provenance = (typeof raw.probe_provenance === 'string') ? raw.probe_provenance : '';
  const normalized = raw.normalized !== false;

  const cleaned = {
    framework: raw.framework,
    normalized: normalized,
    readiness_score: readiness_score,
    missing_dimensions: sanitizeMissingDimensions(raw.missing_dimensions),
    context_class: sanitizeContextClass(raw.context_class),
    source: raw.source,
    hit_count: hit_count,
    first_seen: first_seen,
    last_seen: last_seen,
    probe_provenance: probe_provenance,
  };
  if (raw.dimensions_inferred === true) cleaned.dimensions_inferred = true;
  return cleaned;
}

// ---------------------------------------------------------------------------
// readQueue (self-healing; never throws)
// ---------------------------------------------------------------------------

function readQueue(roomDir) {
  const qp = queuePath(roomDir);
  if (!fs.existsSync(qp)) return emptyQueue();
  let raw;
  try {
    raw = fs.readFileSync(qp, 'utf-8');
  } catch (e) {
    process.stderr.write(
      '[enrichment-queue] warn: failed to read queue (' +
      (e && e.code || 'unknown') + '); resetting to empty\n'
    );
    return emptyQueue();
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_parseErr) {
    process.stderr.write(
      '[enrichment-queue] warn: corrupt queue JSON detected; healing to empty\n'
    );
    return emptyQueue();
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.entries)) {
    process.stderr.write(
      '[enrichment-queue] warn: queue file invalid shape; resetting\n'
    );
    return emptyQueue();
  }
  if (parsed.version !== SCHEMA_VERSION) {
    process.stderr.write(
      '[enrichment-queue] warn: unexpected version ' + parsed.version + '; resetting\n'
    );
    return emptyQueue();
  }
  // Filter entries to allow-list shape. Defense in depth against tampering.
  const clean = [];
  for (const e of parsed.entries) {
    const c = cleanEntryForStorage(e);
    if (c) clean.push(c);
  }
  return { version: SCHEMA_VERSION, entries: clean };
}

// ---------------------------------------------------------------------------
// writeQueueAtomic (tmp + fsync + rename) -- copied verbatim from
// brain-derivation-queue.cjs.
// ---------------------------------------------------------------------------

function writeQueueAtomic(roomDir, queueObj) {
  if (!queueObj || typeof queueObj !== 'object' || !Array.isArray(queueObj.entries)) {
    return false;
  }
  const qp = queuePath(roomDir);
  const dir = path.dirname(qp);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (_) { /* best effort */ }

  // Random suffix prevents tmpfile collisions across concurrent writers.
  const tmp = qp + '.tmp.' + process.pid + '.' + Math.random().toString(36).slice(2);
  let fd;
  try {
    fd = fs.openSync(tmp, 'w');
    const body = JSON.stringify(queueObj, null, 2);
    fs.writeSync(fd, body);
    try { fs.fsyncSync(fd); } catch (_) { /* fsync best-effort on some FS */ }
    fs.closeSync(fd);
    fd = null;
    fs.renameSync(tmp, qp);
    return true;
  } catch (_e) {
    try { if (fd != null) fs.closeSync(fd); } catch (_) {}
    try { fs.unlinkSync(tmp); } catch (_) {}
    return false;
  }
}

// ---------------------------------------------------------------------------
// enqueue
// ---------------------------------------------------------------------------

/**
 * enqueue(roomDir, entry) -> { queued, queue_size, error?, warning? }
 *
 * `entry.framework` is the unique key. Re-enqueueing the same framework
 * increments hit_count, refreshes last_seen + missing_dimensions (+
 * context_class/probe_provenance/dimensions_inferred), and keeps the queue
 * at the same size. A different framework appends. NEVER throws -- every
 * failure returns a result object with an `error` string.
 */
function enqueue(roomDir, entry) {
  try {
    if (typeof roomDir !== 'string' || roomDir.length === 0) {
      return { queued: false, queue_size: 0, error: 'invalid_room_dir' };
    }
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return { queued: false, queue_size: 0, error: 'invalid_entry' };
    }
    if (!isFrameworkNameValid(entry.framework)) {
      return { queued: false, queue_size: 0, error: 'invalid_framework' };
    }
    if (ALLOWED_SOURCES.indexOf(entry.source) === -1) {
      return { queued: false, queue_size: 0, error: 'invalid_source' };
    }

    const queue = readQueue(roomDir);
    const now = nowIso();

    const readiness_score = isValidReadinessScore(entry.readiness_score) ? entry.readiness_score : null;
    const missing_dimensions = sanitizeMissingDimensions(entry.missing_dimensions);
    const context_class = sanitizeContextClass(entry.context_class);
    const normalized = entry.normalized !== false;
    const probe_provenance = (typeof entry.probe_provenance === 'string') ? entry.probe_provenance : '';
    const dimensions_inferred = entry.dimensions_inferred === true;

    const existingIdx = queue.entries.findIndex(function (e) { return e.framework === entry.framework; });

    let nextEntries;
    if (existingIdx !== -1) {
      const existing = queue.entries[existingIdx];
      // Research OQ3 honesty rule: a census_seed re-miss never downgrades an
      // existing live_reach/refusal entry's provenance.
      const nextSource = (!_SOURCE_IS_LIVE[entry.source] && _SOURCE_IS_LIVE[existing.source])
        ? existing.source
        : entry.source;
      const updated = {
        framework: existing.framework,
        normalized: normalized,
        readiness_score: readiness_score,
        missing_dimensions: missing_dimensions,
        context_class: context_class,
        source: nextSource,
        hit_count: existing.hit_count + 1,
        first_seen: existing.first_seen,
        last_seen: now,
        probe_provenance: probe_provenance || existing.probe_provenance,
      };
      if (dimensions_inferred) updated.dimensions_inferred = true;
      nextEntries = queue.entries.slice();
      nextEntries[existingIdx] = updated;
    } else {
      if (queue.entries.length >= HARD_CAP) {
        return { queued: false, queue_size: queue.entries.length, error: 'queue_hard_cap' };
      }
      const newEntry = {
        framework: entry.framework,
        normalized: normalized,
        readiness_score: readiness_score,
        missing_dimensions: missing_dimensions,
        context_class: context_class,
        source: entry.source,
        hit_count: 0,
        first_seen: now,
        last_seen: now,
        probe_provenance: probe_provenance,
      };
      if (dimensions_inferred) newEntry.dimensions_inferred = true;
      nextEntries = queue.entries.concat([newEntry]);
    }

    const ok = writeQueueAtomic(roomDir, { version: SCHEMA_VERSION, entries: nextEntries });
    if (!ok) {
      return { queued: false, queue_size: queue.entries.length, error: 'write_failed' };
    }

    const result = { queued: true, queue_size: nextEntries.length };
    if (nextEntries.length > SOFT_CAP) {
      result.warning = 'queue_soft_cap';
    }
    return result;
  } catch (_e) {
    // enqueue NEVER throws into the caller (behavior spec).
    return { queued: false, queue_size: 0, error: 'unexpected_error' };
  }
}

// ---------------------------------------------------------------------------
// Missing-dimensions inference (lossy fallback per research: "infer
// structure/flow from discover_structure + score arithmetic and mark the
// entry dimensions_inferred: true"). Deterministic, order-stable.
// ---------------------------------------------------------------------------

function inferMissingDimensionsFromScore(readinessScore, structureKnownPresent) {
  const score = Number.isInteger(readinessScore) ? Math.max(0, Math.min(4, readinessScore)) : 0;
  const missingCount = Math.max(0, 4 - score);
  const candidates = ALLOWED_DIMENSIONS.filter(function (d) {
    return !(d === 'structure' && structureKnownPresent === true);
  });
  return candidates.slice(0, missingCount);
}

// ---------------------------------------------------------------------------
// captureReadinessMiss -- the convenience the capture seams call.
// ---------------------------------------------------------------------------

/**
 * captureReadinessMiss(roomDir, frameworkName, probeResult, contextClass)
 *
 * Builds a typed entry and enqueues it. Best-effort: NEVER throws, always
 * returns a result object. Not a genuine miss returns
 * { captured: false, reason: 'not_a_miss' } without ever touching the
 * filesystem. Recognizes FOUR probe shapes, incumbent and Theo:
 *   - Incumbent RESOLVED discover_structure: { grounded, ... }. Not a miss
 *     when grounded !== false.
 *   - Incumbent RESOLVED orchestration_readiness: { readiness_score,
 *     dimensions? }. Not a miss when readiness_score > 2.
 *   - Theo RESOLVED orchestration_readiness (Phase 339, 2026-09-03):
 *     { score, inputs, unsynced_inputs, ... }. Not a miss when score > 2.
 *   - Theo REFUSAL orchestration_readiness (Phase 339, 2026-09-03):
 *     { coverage: { matched, total }, refusal: { code, detail }, ... },
 *     with score/inputs/evidence/framework OMITTED ENTIRELY. Not a miss
 *     when coverage.matched > 0; returns reason: 'layer_empty' (also not
 *     captured) when coverage.total === 0, because that means the canon
 *     layer itself is empty, not that this framework is missing from it.
 */
function captureReadinessMiss(roomDir, frameworkName, probeResult, contextClass) {
  try {
    if (typeof roomDir !== 'string' || roomDir.length === 0) {
      return { captured: false, reason: 'invalid_room_dir' };
    }
    if (!isFrameworkNameValid(frameworkName)) {
      return { captured: false, reason: 'invalid_framework' };
    }
    const pr = (probeResult && typeof probeResult === 'object') ? probeResult : {};
    const nowTs = nowIso();

    let readiness_score = null;
    let missing_dimensions = [];
    let dimensions_inferred = false;
    let probe_provenance;

    // DELIBERATE BOOLEAN CONTRACT (RUN 3, 2026-08-11): the deployed brain
    // refusal shape on pws-brain-mcp.onrender.com is { grounded: false,
    // anchor: null, note: '...could not ground...' }. This seam keys ONLY
    // on grounded === false, never on the note text, so server-side note
    // rewording can never break capture. Verified live against production
    // during the RUN 3 negative-control retest; 'could not ground' appears
    // nowhere in lib/ or scripts/ by design.
    if (typeof pr.grounded === 'boolean') {
      // discover_structure-shaped payload.
      if (pr.grounded !== false) return { captured: false, reason: 'not_a_miss' };
      readiness_score = null;
      missing_dimensions = ['structure'];
      dimensions_inferred = true;
      probe_provenance = 'discover_structure@' + nowTs;
    } else if (typeof pr.readiness_score === 'number' && Number.isFinite(pr.readiness_score)) {
      if (pr.readiness_score > 2) return { captured: false, reason: 'not_a_miss' };
      readiness_score = Math.round(pr.readiness_score);
      if (pr.dimensions && typeof pr.dimensions === 'object') {
        // Precise server-side dimensions vector (249-02 field): 0 = missing.
        missing_dimensions = ALLOWED_DIMENSIONS.filter(function (d) {
          return pr.dimensions[d] === 0;
        });
        dimensions_inferred = false;
      } else {
        missing_dimensions = inferMissingDimensionsFromScore(readiness_score, false);
        dimensions_inferred = true;
      }
      probe_provenance = 'orchestration_readiness@' + nowTs;
    } else if (typeof pr.score === 'number' && Number.isFinite(pr.score)
               && pr.inputs && typeof pr.inputs === 'object') {
      // Phase 339 Plan 05 (FLIP-03), 2026-09-03: Theo orchestration_readiness,
      // RESOLVED shape (/home/jsagi/Theo/src/mcp/content/
      // orchestration-readiness.ts:492-503). Guarded on the PAIR (score,
      // inputs) rather than on `score` alone: Theo omits `score` entirely on
      // its refusal branch (the next arm), so a lone `typeof pr.score` check
      // would be a key-presence test in disguise.
      //
      // FACT 1 (do not "fix" this threshold): Theo's practical score
      // ceiling is 3, not 4. `pattern_known` is
      // `orchestration_status === PROMOTED_ORCHESTRATION_STATUS` and Theo's
      // own header (:44-46) says that answer is false for virtually every
      // Framework. The existing `> 2` threshold below is therefore ALREADY
      // CORRECT for Theo and must not be rescaled.
      // FACT 3 (unsynced_inputs filter): a dimension whose Theo input name
      // appears in `pr.unsynced_inputs` is FILTERED OUT of
      // missing_dimensions below. Theo declares that input answered by its
      // own local proxy rather than by the contract's source, so reporting
      // the dimension as missing on its strength would queue enrichment for
      // a gap that may not exist.
      if (pr.score > 2) return { captured: false, reason: 'not_a_miss' };
      readiness_score = Math.round(pr.score);
      const unsynced = Array.isArray(pr.unsynced_inputs) ? pr.unsynced_inputs : [];
      missing_dimensions = THEO_INPUT_DIMENSIONS
        .filter(function (m) { return pr.inputs[m.input] === false && unsynced.indexOf(m.input) === -1; })
        .map(function (m) { return m.dimension; });
      dimensions_inferred = false; // exact vector from Theo's inputs, never inferred
      probe_provenance = 'orchestration_readiness_theo@' + nowTs;
    } else if (pr.refusal && typeof pr.refusal === 'object'
               && pr.coverage && typeof pr.coverage === 'object'
               && typeof pr.coverage.matched === 'number'
               && typeof pr.coverage.total === 'number') {
      // Phase 339 Plan 05 (FLIP-03), 2026-09-03: Theo orchestration_readiness,
      // REFUSAL shape (/home/jsagi/Theo/src/mcp/content/
      // orchestration-readiness.ts:446-449, :479-486). score/inputs/evidence
      // /framework are OMITTED ENTIRELY on this branch (Theo's own header,
      // :92-101: "an absent key says nothing, which is the only honest thing
      // to say" -- score: 0 would be a CLAIM about a Framework that does not
      // exist). This seam embeds ONLY `pr.refusal.code`, a closed vocabulary
      // (FRAMEWORK_NOT_FOUND, ALIAS_CYCLE, ALIAS_FORK, and two more from
      // resolveFramework, :106-113). The sibling free-form string on that
      // same refusal object is NEVER read or embedded here: it is
      // server-authored prose and Canon Part 8 requires key NAMES only,
      // never VALUES, same rule _unrecognizedQueryShape already states.
      //
      // FACT 2 (the two zeros are DIFFERENT ANSWERS, never collapsed):
      //   { matched: 0, total: N > 0 } means canon has N frameworks and none
      //     is this one -- a real miss about THIS framework.
      //   { matched: 0, total: 0 } means the layer itself is empty -- not a
      //     miss about this framework, and queueing it would blame the
      //     framework for an empty graph. Returns reason: 'layer_empty'
      //     instead, and does NOT capture.
      if (pr.coverage.matched > 0) return { captured: false, reason: 'not_a_miss' };
      if (pr.coverage.total === 0) return { captured: false, reason: 'layer_empty' };
      readiness_score = null;
      missing_dimensions = ['structure'];
      dimensions_inferred = true;
      probe_provenance = 'orchestration_readiness_theo_refusal@'
        + (typeof pr.refusal.code === 'string' ? pr.refusal.code : 'unknown') + '@' + nowTs;
    } else {
      return { captured: false, reason: 'invalid_probe_result' };
    }

    // Operational expectation (Phase 339 Plan 05, 2026-09-03), so the soak
    // observer is not surprised: post-flip, nearly every orchestration_readiness
    // call will score 0 or 1 and therefore capture, because Theo's own header
    // reports 148 of 149 Frameworks with zero technique linkage and roughly 3
    // of 149 carrying structure at all. The queue is bounded (SOFT_CAP warns
    // at 500, HARD_CAP rejects at 1000) and enqueue() dedupes by framework
    // name with a hit_count bump, so the blast radius is one entry per
    // distinct framework. That is canon thinness correctly measured, not a
    // leak.

    const entry = {
      framework: frameworkName,
      normalized: pr.normalized !== false,
      readiness_score: readiness_score,
      missing_dimensions: missing_dimensions,
      context_class: contextClass,
      source: 'live_reach',
      probe_provenance: probe_provenance,
      dimensions_inferred: dimensions_inferred,
    };
    return enqueue(roomDir, entry);
  } catch (_e) {
    // captureReadinessMiss NEVER throws into the caller (behavior spec).
    return { captured: false, reason: 'unexpected_error' };
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  enqueue: enqueue,
  captureReadinessMiss: captureReadinessMiss,
  readQueue: readQueue,
  writeQueueAtomic: writeQueueAtomic,
  SOFT_CAP: SOFT_CAP,
  HARD_CAP: HARD_CAP,
  ALLOWED_ENTRY_KEYS: ALLOWED_ENTRY_KEYS,
  ALLOWED_SOURCES: ALLOWED_SOURCES,
  ALLOWED_DIMENSIONS: ALLOWED_DIMENSIONS,
  ALLOWED_CONTEXT_CLASS_KEYS: ALLOWED_CONTEXT_CLASS_KEYS,
  SCHEMA_VERSION: SCHEMA_VERSION,
  inferMissingDimensionsFromScore: inferMissingDimensionsFromScore,
  sanitizeContextClass: sanitizeContextClass,
  // Test surface (not part of public API):
  _test: Object.freeze({
    isFrameworkNameValid: isFrameworkNameValid,
    isValidReadinessScore: isValidReadinessScore,
    sanitizeMissingDimensions: sanitizeMissingDimensions,
    cleanEntryForStorage: cleanEntryForStorage,
    queuePath: queuePath,
  }),
};
