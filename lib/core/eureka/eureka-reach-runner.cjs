'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 213-02 -- the KEY's producer half: the eureka-reach runner.
 *
 * WHAT THIS IS
 *   The ASYNC side-channel PRODUCER that SENS-13 (lib/core/sensors/
 *   sensor-eureka.cjs) reads. It (1) probes the LIVE Phase-212 critic for guard
 *   availability, (2) resolves a candidate bridge pair, (3) measures the pair's
 *   differential via the shipped scoreMeasured (Phase 211), (4) runs the
 *   FLAGGED runtime guard gate (the 212 critic's Stage A -- deterministic, NO
 *   LLM), and (5) atomically writes the CLOSED-schema side-channel
 *   <roomDir>/.mindrian/last-eureka.json. It CONSUMES the 211 scorer and the
 *   212 critic contract; it never rebuilds either.
 *
 * NO GUARD = NO FIRE (the flagged honest degrade)
 *   Guard availability is PROBED on the live eureka-critic module (Pattern 3,
 *   the vec0 lesson), NEVER inferred from a file existing on disk. When the
 *   guard is unavailable the runner writes NOTHING and returns
 *   { fired:false, reason:'guard_unavailable' }. The degrade is
 *   no-guard -> no-fire, never no-guard -> unguarded-fire.
 *
 * THE FLAGGED RUNTIME GATE (navigator sign-off, RESEARCH Open Question 2)
 *   The RUNTIME gate is the 212 critic's Stage A (deterministic gates + the
 *   criticRule confidence band), NOT Stage B. Stage B's two rubric passes are
 *   session-run and eval-side (they need a live LLM judge), so they are OUT of
 *   this fire-and-forget runtime path. A candidate that Stage A cannot clear
 *   does NOT fire; a Stage-A-clearing candidate whose criticRule confidence is
 *   not 'unknown' is the runtime 'transferable' precondition the side-channel
 *   records. (If the navigator wants Stage B in the runtime path instead, that
 *   is a scope change -- flag at review, do not improvise.)
 *
 * CLOSED-KEY SCHEMA IS THE PART-8 FENCE (T-213-04)
 *   last-eureka.json carries EXACTLY: schema_version, scanned_at, guard
 *   { available, verdict, confidence, tags }, bridge { a_handle, b_handle,
 *   surprise_type, band, differential_quantized }, provenance { model, method }.
 *   Every value is an enum member, an opaque node-id HANDLE, or a quantized
 *   number -- zero user prose. The writer REJECTS any extra key or any value
 *   that is not one of those (returns fired:false, reason:'schema_violation').
 *   Handles are node ids, never text.
 *
 * CANON PART 9 (Memory Locality chokepoint) -- INTENTIONAL DESIGN NOTE
 *   This lib/core module does NOT open room.db itself (the navigation.cjs
 *   chokepoint is the single door; a lib/core file must not require room-db.cjs
 *   -- CLAUDE.md hard constraint / check-schema-aliases chokepoint guard). The
 *   candidate pair is therefore supplied via an injection seam: opts.pair (the
 *   explicit / test seam) or opts.deriveFn (a graph-derivation function a later
 *   wiring plan threads through the navigation chokepoint). With neither, the
 *   runner honestly returns { fired:false, reason:'substrate_unavailable' }. The
 *   211 tri-modal derivation therefore lands as an injected deriveFn, keeping
 *   this producer free of any room-db coupling.
 *
 * NEVER THROWS: every failure is a structured { fired:false, reason } over the
 * closed reason enum. Zero new env vars (reuses EUREKA_DIFF_FLOOR via the 211
 * scorer's resolveEurekaDiffFloor).
 *
 * House rule: hyphens only, no em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');

// Consume (never rebuild) the 211 measured differential + its floor resolver.
const rsScorer = require('../rs-differential-scorer.cjs');
const scoreMeasured = rsScorer.scoreMeasured;
const resolveEurekaDiffFloor = rsScorer._test.resolveEurekaDiffFloor;

// ---------- Closed constants ----------

const SIDE_CHANNEL_FILE = 'last-eureka.json';
const SIDE_CHANNEL_SCHEMA_VERSION = 1;

// The closed failure-reason enum (documented in the plan artifact table).
const REASONS = Object.freeze([
  'guard_unavailable',
  'substrate_unavailable',
  'below_floor',
  'guard_not_cleared',
  'schema_violation',
  'room_dir_missing',
]);

// The closed value enums the writer validates against (the Part-8 fence).
const VERDICTS = Object.freeze(['transferable', 'restatement', 'pseudoscience', 'general_shallow']);
const CONFIDENCES = Object.freeze(['high', 'medium', 'low', 'unknown']);
const FIRING_BANDS = Object.freeze(['opportunity', 'high', 'breakthrough']);
const SURPRISE_TYPES = Object.freeze(['structural_transfer', 'semantic_implementation']);

// The FLAGGED firing precondition: only a 'transferable' runtime verdict fires.
const FIRING_VERDICT = 'transferable';

// ---------- probeGuard ----------

/**
 * probeGuard({ criticProbeFn? }) -> Promise<{ available, reason, critic? }>
 *
 * PROBE THE LIVE MODULE, never fs.existsSync (Pattern 3, the vec0 lesson). The
 * default probe lazy-requires ../eureka-critic.cjs inside a try/catch and
 * asserts typeof criticRule === 'function' AND loadCriticTags().schema_version
 * === 1. criticProbeFn is the hermetic test seam: it returns the critic module
 * (or null) to probe, so a test never touches the real critic or a model.
 *
 * A null / malformed critic, a missing criticRule, or a tags schema mismatch
 * all degrade to { available:false, reason:'guard_unavailable' }. Never throws.
 */
async function probeGuard(opts) {
  const options = opts || {};
  try {
    let critic;
    if (typeof options.criticProbeFn === 'function') {
      critic = await options.criticProbeFn();
    } else {
      // eslint-disable-next-line global-require
      critic = require('../eureka-critic.cjs');
    }
    if (!critic || typeof critic !== 'object') {
      return { available: false, reason: 'guard_unavailable' };
    }
    if (typeof critic.criticRule !== 'function' || typeof critic.loadCriticTags !== 'function') {
      return { available: false, reason: 'guard_unavailable' };
    }
    if (typeof critic.stageA !== 'function' || typeof critic.assembleCriticPayload !== 'function') {
      return { available: false, reason: 'guard_unavailable' };
    }
    const tags = critic.loadCriticTags();
    if (!tags || tags.schema_version !== SIDE_CHANNEL_SCHEMA_VERSION) {
      return { available: false, reason: 'guard_unavailable' };
    }
    return { available: true, reason: 'ok', critic: critic };
  } catch (_e) {
    return { available: false, reason: 'guard_unavailable' };
  }
}

// ---------- pair-shape guard ----------

/**
 * A valid pair is [ { handle, text }, { handle, text } ] with string handles
 * and string texts. Anything else is not a pair.
 */
function isPairShape(pair) {
  if (!Array.isArray(pair) || pair.length !== 2) return false;
  for (let i = 0; i < 2; i += 1) {
    const p = pair[i];
    if (!p || typeof p !== 'object') return false;
    if (typeof p.handle !== 'string' || !p.handle) return false;
    if (typeof p.text !== 'string') return false;
  }
  return true;
}

// ---------- the flagged runtime guard gate (Stage A only) ----------

/**
 * runGuardGate(critic, candidate, opts) -> Promise<{ cleared, verdict,
 * confidence, tags }>. The FLAGGED runtime gate: the 212 critic's Stage A
 * (deterministic, NO LLM) plus the criticRule confidence band. Stage B's rubric
 * is NOT in this path.
 *
 *   - Stage A FAILS -> { cleared:false } carrying the gate route
 *     (pseudoscience / general_shallow / restatement) as verdict; no fire.
 *   - Stage A CLEARS -> the runtime 'transferable' precondition. Confidence is
 *     ruled by criticRule over the assembled payload (the rubric never ran at
 *     runtime -> the 'xxxxxx' sentinel -> a code-certain band). A criticRule
 *     confidence of 'unknown' (e.g. a bad domain tag threw) -> { cleared:false }.
 *
 * Never throws: any Stage A / payload / ruling fault degrades to not-cleared.
 */
async function runGuardGate(critic, candidate, opts) {
  const options = opts || {};
  let a;
  try {
    a = await critic.stageA(candidate, options);
  } catch (_e) {
    return { cleared: false, verdict: 'general_shallow', confidence: 'unknown', tags: ['calibration_unknown'] };
  }
  if (!a || a.pass !== true) {
    return {
      cleared: false,
      verdict: (a && typeof a.route === 'string') ? a.route : 'general_shallow',
      confidence: 'high',
      tags: [(a && typeof a.tag === 'string') ? a.tag : 'calibration_unknown'],
    };
  }

  // Stage A cleared. Rule the confidence via criticRule on the assembled payload.
  let confidence = 'unknown';
  let reasoningTag = 'passes_all_gates';
  try {
    const payload = critic.assembleCriticPayload({
      differential_score: candidate.differential_score,
      semantic_similarity: candidate.semantic_similarity,
      lsa_similarity: candidate.lsa_similarity,
      surprise_type: candidate.surprise_type,
      source_domain_tag: candidate.sourceDomainTag || 'unknown',
      target_domain_tag: candidate.targetDomainTag || 'unknown',
      rubric_pattern: 'xxxxxx',
    });
    const ruling = critic.criticRule(payload, options);
    confidence = (ruling && typeof ruling.confidence === 'string') ? ruling.confidence : 'unknown';
    if (ruling && typeof ruling.reasoning_tag === 'string') reasoningTag = ruling.reasoning_tag;
  } catch (_e) {
    confidence = 'unknown';
  }

  if (confidence === 'unknown') {
    return { cleared: false, verdict: 'general_shallow', confidence: 'unknown', tags: ['calibration_unknown'] };
  }

  // The deterministic gate certified the candidate: stamp the runtime verdict.
  return { cleared: true, verdict: FIRING_VERDICT, confidence: confidence, tags: [reasoningTag] };
}

// ---------- the closed-schema builder + validator (the Part-8 fence) ----------

function quantize2(x) {
  if (typeof x !== 'number' || !Number.isFinite(x)) return null;
  return Math.round(x * 100) / 100;
}

function isQuantized2(x) {
  if (typeof x !== 'number' || !Number.isFinite(x)) return false;
  return Math.abs(x * 100 - Math.round(x * 100)) < 1e-9;
}

function sortedKeysEqual(obj, keys) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const have = Object.keys(obj).slice().sort();
  const want = keys.slice().sort();
  if (have.length !== want.length) return false;
  for (let i = 0; i < have.length; i += 1) {
    if (have[i] !== want[i]) return false;
  }
  return true;
}

/**
 * Build the CLOSED-schema side-channel payload. Every value is an enum member,
 * an opaque node-id handle, or a quantized scalar. No user prose.
 */
function buildSideChannelPayload(score, guard, a, b, opts) {
  const options = opts || {};
  const nowMs = Number.isFinite(options.now) ? options.now : Date.now();
  const prov = (score && score.provenance) || {};
  return {
    schema_version: SIDE_CHANNEL_SCHEMA_VERSION,
    scanned_at: new Date(nowMs).toISOString(),
    guard: {
      available: true,
      verdict: guard.verdict,
      confidence: guard.confidence,
      tags: Array.isArray(guard.tags) ? guard.tags.filter(function (t) { return typeof t === 'string'; }) : [],
    },
    bridge: {
      a_handle: String(a.handle),
      b_handle: String(b.handle),
      surprise_type: score.direction,
      band: score.band,
      differential_quantized: quantize2(score.abs_diff),
    },
    provenance: {
      model: (typeof prov.semantic_model === 'string' && prov.semantic_model) ? prov.semantic_model : 'unknown',
      method: 'scoreMeasured+stageA',
    },
  };
}

/**
 * validateClosedSchema(payload) -> boolean. The closed-key discipline IS the
 * Part-8 fence for this file: EXACT top-level and nested key sets, every string
 * field inside its closed enum, handles are strings, the differential is a
 * quantized number. Any extra key or non-conforming value fails (the writer
 * then returns schema_violation and writes nothing).
 */
function validateClosedSchema(p) {
  if (!sortedKeysEqual(p, ['schema_version', 'scanned_at', 'guard', 'bridge', 'provenance'])) return false;
  if (p.schema_version !== SIDE_CHANNEL_SCHEMA_VERSION) return false;
  if (typeof p.scanned_at !== 'string' || !p.scanned_at) return false;

  const g = p.guard;
  if (!sortedKeysEqual(g, ['available', 'verdict', 'confidence', 'tags'])) return false;
  if (g.available !== true) return false;
  if (VERDICTS.indexOf(g.verdict) === -1) return false;
  if (CONFIDENCES.indexOf(g.confidence) === -1) return false;
  if (!Array.isArray(g.tags)) return false;
  for (let i = 0; i < g.tags.length; i += 1) {
    if (typeof g.tags[i] !== 'string') return false;
  }

  const b = p.bridge;
  if (!sortedKeysEqual(b, ['a_handle', 'b_handle', 'surprise_type', 'band', 'differential_quantized'])) return false;
  if (typeof b.a_handle !== 'string' || !b.a_handle) return false;
  if (typeof b.b_handle !== 'string' || !b.b_handle) return false;
  if (SURPRISE_TYPES.indexOf(b.surprise_type) === -1) return false;
  if (FIRING_BANDS.indexOf(b.band) === -1) return false;
  if (!isQuantized2(b.differential_quantized)) return false;

  const pr = p.provenance;
  if (!sortedKeysEqual(pr, ['model', 'method'])) return false;
  if (typeof pr.model !== 'string' || !pr.model) return false;
  if (typeof pr.method !== 'string' || !pr.method) return false;

  return true;
}

/**
 * Atomic write: write to <path>.tmp.<pid> then rename. Mirrors the
 * auto-explore-fire atomicWriteJson idiom. Returns true on success, false on
 * any failure; never throws.
 */
function atomicWriteJson(filePath, data) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmpPath = filePath + '.tmp.' + process.pid;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, filePath);
    return true;
  } catch (_e) {
    return false;
  }
}

// ---------- runEurekaScan ----------

/**
 * runEurekaScan(opts) -> Promise<{ fired, reason, sideChannelPath? }>
 *
 *   opts.roomDir        (string, required)   the room whose side-channel we write
 *   opts.pair           ([{handle,text},{handle,text}])   explicit / test seam
 *   opts.deriveFn       (roomDir, opts) -> Promise<pair>  graph-derivation seam
 *   opts.encodeFn       injectable semantic leg for scoreMeasured (tests)
 *   opts.vectors        precomputed [vecA, vecB] for scoreMeasured
 *   opts.scoreFn        injectable scorer (defaults to scoreMeasured)
 *   opts.criticProbeFn  the guard-probe test seam (returns the critic module|null)
 *   opts.sourceDomainTag / opts.targetDomainTag   generic domain tags (default 'unknown')
 *   opts.now            (ms epoch) deterministic scanned_at for tests
 *
 * Steps: (1) guard probe -- unavailable writes NOTHING; (2) resolve the pair;
 * (3) scoreMeasured (self-audits Part 8, self-degrades); (4) the flagged Stage-A
 * guard gate; (5) closed-schema atomic write. Every failure is a structured
 * { fired:false, reason } over the closed REASONS enum. Never throws.
 */
async function runEurekaScan(opts) {
  const options = opts || {};
  const roomDir = (typeof options.roomDir === 'string' && options.roomDir) ? options.roomDir : '';
  if (!roomDir) return { fired: false, reason: 'room_dir_missing' };

  // (1) Guard probe -- no guard = no fire, write NOTHING (the flagged lock).
  const probe = await probeGuard({ criticProbeFn: options.criticProbeFn });
  if (!probe.available) return { fired: false, reason: 'guard_unavailable' };
  const critic = probe.critic;

  // (2) Resolve the candidate pair (injection-seam only; Canon Part 9 -- this
  // module never opens room.db, see the header note).
  let pair = null;
  if (isPairShape(options.pair)) {
    pair = options.pair;
  } else if (typeof options.deriveFn === 'function') {
    try {
      pair = await options.deriveFn(roomDir, options);
    } catch (_e) {
      pair = null;
    }
  }
  if (!isPairShape(pair)) return { fired: false, reason: 'substrate_unavailable' };
  const a = pair[0];
  const b = pair[1];

  // (3) Measured differential. scoreMeasured self-audits Part 8 and self-degrades;
  // a below-floor gap or a low/moderate band does not fire.
  let score;
  try {
    const scoreFn = (typeof options.scoreFn === 'function') ? options.scoreFn : scoreMeasured;
    score = await scoreFn(a.text, b.text, { encodeFn: options.encodeFn, vectors: options.vectors });
  } catch (_e) {
    return { fired: false, reason: 'below_floor' };
  }
  if (!score || score.passes !== true ||
      typeof score.abs_diff !== 'number' ||
      score.abs_diff <= resolveEurekaDiffFloor() ||
      FIRING_BANDS.indexOf(score.band) === -1 ||
      SURPRISE_TYPES.indexOf(score.direction) === -1) {
    return { fired: false, reason: 'below_floor' };
  }

  // (4) The flagged Stage-A guard gate. Build the critic feature payload from
  // the measured legs + generic domain tags (default 'unknown'); a candidate
  // Stage A cannot clear, or whose criticRule confidence is 'unknown', does not
  // fire (guard_not_cleared writes nothing).
  const candidate = {
    text: a.text + '\n' + b.text,
    mechanismText: a.text + ' ' + b.text,
    sourceDomainTag: options.sourceDomainTag || 'unknown',
    targetDomainTag: options.targetDomainTag || 'unknown',
    differential: score.abs_diff,
    differential_score: score.abs_diff,
    semantic_similarity: score.semantic,
    lsa_similarity: score.lexical,
    surprise_type: score.direction,
  };
  const guard = await runGuardGate(critic, candidate, options);
  if (!guard.cleared || guard.verdict !== FIRING_VERDICT || guard.confidence === 'unknown') {
    return { fired: false, reason: 'guard_not_cleared' };
  }

  // (5) Closed-schema atomic write. The validator IS the Part-8 fence: any extra
  // key / non-enum / non-handle / non-quantized value -> schema_violation, no write.
  const payload = buildSideChannelPayload(score, guard, a, b, options);
  if (!validateClosedSchema(payload)) return { fired: false, reason: 'schema_violation' };

  const sideChannelPath = path.join(roomDir, '.mindrian', SIDE_CHANNEL_FILE);
  const wrote = atomicWriteJson(sideChannelPath, payload);
  if (!wrote) return { fired: false, reason: 'schema_violation' };

  return { fired: true, reason: 'fired', sideChannelPath: sideChannelPath };
}

module.exports = {
  runEurekaScan: runEurekaScan,
  probeGuard: probeGuard,
  SIDE_CHANNEL_FILE: SIDE_CHANNEL_FILE,
  SIDE_CHANNEL_SCHEMA_VERSION: SIDE_CHANNEL_SCHEMA_VERSION,
  REASONS: REASONS,
  // Exposed for the Task-3 suite + plan 03 (never new env vars).
  isPairShape: isPairShape,
  runGuardGate: runGuardGate,
  buildSideChannelPayload: buildSideChannelPayload,
  validateClosedSchema: validateClosedSchema,
};
