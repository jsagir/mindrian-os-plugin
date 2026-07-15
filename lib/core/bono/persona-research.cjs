'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 223-01 -- lib/core/bono/persona-research.cjs
 * ==================================================
 * Per-(subdomain x hat) cell world-of-knowledge, injected as runCellFanout's
 * dispatchCell seam (cell-fanout.cjs:237-256). For each cell the pipe is:
 *   extractContext -> runSourceLens -> wireAccept
 * giving each persona ITS OWN wired INFORMS set. A persona may not assert beyond
 * that set (validateCitations is the mechanical boundary check).
 *
 * Canon Part 8 (SIGNAL -> LOCAL only): the web leg INGESTS public content into
 * LOCAL EvidenceClaims -- the legal direction. It is DELEGATED to runSourceLens
 * (which owns the auditQueryString pre-egress chokepoint); this module never
 * hand-rolls a network call. Any Brain-bound payload (generic dimension hints)
 * MUST pass part8-egress-guard.classify first and proceed ONLY on verdict
 * 'allow'; a 'block'/'ambiguous' verdict skips the Brain leg with a disclosed
 * marker (fail-closed, SEED-059). The ONLY thing that ever crosses toward the
 * Brain is the GENERIC domain handle (cell.handle) -- never room content, never
 * an outbound query string built from local bytes.
 *
 * Canon Part 9: accepted findings land as PROPOSED EvidenceClaim nodes + INFORMS
 * edges through findings-wirer.wireAccept (the navigation chokepoint). Nothing is
 * auto-confirmed.
 *
 * Defensive: a missing db degrades to wire-skipped with a disclosed marker (never
 * a throw); cell-fanout's defensive stub is the outer net.
 *
 * Pure Node.js built-ins + the shipped extractor / lens-driver / wirer / guard.
 * Zero npm deps. No emoji. No em-dashes.
 *
 * License: BSL 1.1.
 */

const researchContextExtractor = require('../research-context-extractor.cjs');
const sourceLensDriver = require('../../lens-engine/source-lens-driver.cjs');
const findingsWirer = require('../findings-wirer.cjs');
const egressGuard = require('../part8-egress-guard.cjs');

// The closed stance vocabulary (mirrors cell-fanout.CELL_STANCES).
const STANCES = Object.freeze(['supports', 'challenges', 'refines', 'neutral']);

// A per-hat lens bias: which lens families a hat leans on when the extracted
// lens set offers a choice. This is what makes two cells over the SAME subdomain
// but DIFFERENT hats select different lens scopes. Bias is a soft reorder over
// the extracted set; it never invents a lens the extractor did not surface.
const HAT_LENS_BIAS = Object.freeze({
  white: ['scholarly', 'reference', 'official'],
  black: ['adversarial', 'contrarian', 'scholarly'],
  yellow: ['market', 'case-study', 'scholarly'],
  green: ['lateral', 'analogical', 'emerging'],
  red: ['intuitive', 'social'],
  blue: ['synthesis', 'scholarly'],
});

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function normalizeHat(hat) {
  return (typeof hat === 'string') ? hat.trim().toLowerCase() : '';
}

// Reorder the extracted lens set by the hat's bias so the web leg's scope is
// hat-driven. Lenses named in the bias float to the front (bias order); the rest
// keep their extracted order. Pure, never drops a lens.
function hatScopedLensSet(lensSet, hat) {
  const list = Array.isArray(lensSet) ? lensSet.filter((e) => isPlainObject(e) && typeof e.lens === 'string') : [];
  const bias = HAT_LENS_BIAS[normalizeHat(hat)] || [];
  if (bias.length === 0 || list.length === 0) return list.slice();
  const rank = (lens) => {
    const i = bias.indexOf(lens);
    return i === -1 ? bias.length : i;
  };
  return list.slice().sort((a, b) => rank(a.lens) - rank(b.lens));
}

function coerceStance(raw) {
  const s = (typeof raw === 'string') ? raw : 'neutral';
  return STANCES.includes(s) ? s : 'neutral';
}

/**
 * personaDispatchCell(cell, ctx) -> Promise<reading>
 *
 * The runCellFanout dispatchCell-contract function (async; cell-fanout awaits it).
 *   cell = { subdomain, hat, handle }
 *   ctx  = {
 *     extractContextFn?  default research-context-extractor.extractContext
 *     runSourceLensFn?   default source-lens-driver.runSourceLens
 *     wireAcceptFn?      default findings-wirer.wireAccept
 *     classifyFn?        default part8-egress-guard.classify
 *     brainFn?           optional generic-dimension-hint Brain leg (gated by classify)
 *     db, roomDir, topic, sessionId   forwarded to the wirer + extractor
 *   }
 *
 * Returns the normalized reading:
 *   { subdomain, hat, stance, evidence, confidence, wired_sources, degraded,
 *     degraded_reasons, brain_skipped? }
 * where wired_sources is EXACTLY the node_ids wireAccept returned (the persona's
 * own INFORMS set) and every evidence item cites a source inside that set.
 */
async function personaDispatchCell(cell, ctx) {
  const c = isPlainObject(cell) ? cell : {};
  const context = isPlainObject(ctx) ? ctx : {};
  const subdomain = typeof c.subdomain === 'string' ? c.subdomain : '';
  const hat = typeof c.hat === 'string' ? c.hat : '';
  // GENERIC handle ONLY ever crosses outbound (Part 8). Never room content.
  const handle = typeof c.handle === 'string' ? c.handle : '';

  const extractContextFn = (typeof context.extractContextFn === 'function')
    ? context.extractContextFn : researchContextExtractor.extractContext;
  const runSourceLensFn = (typeof context.runSourceLensFn === 'function')
    ? context.runSourceLensFn : sourceLensDriver.runSourceLens;
  const wireAcceptFn = (typeof context.wireAcceptFn === 'function')
    ? context.wireAcceptFn : findingsWirer.wireAccept;
  const classifyFn = (typeof context.classifyFn === 'function')
    ? context.classifyFn : egressGuard.classify;
  const brainFn = (typeof context.brainFn === 'function') ? context.brainFn : null;

  const db = context.db || null;
  const roomDir = typeof context.roomDir === 'string' ? context.roomDir : '';
  const topic = typeof context.topic === 'string' ? context.topic : handle;
  const sessionId = typeof context.sessionId === 'string' ? context.sessionId : 'bono-persona';

  const degraded_reasons = [];

  // (a) extractContext scoped to the subdomain + hat-driven lens selection. The
  // hat is threaded so two cells over the same subdomain but different hats pick
  // different lens scopes.
  let extracted;
  try {
    extracted = extractContextFn({ roomDir, sessionId, topic, db, subdomain, hat });
  } catch (_e) {
    extracted = null;
  }
  const baseLensSet = (extracted && Array.isArray(extracted.lens_set)) ? extracted.lens_set : [];
  const lensSet = hatScopedLensSet(baseLensSet, hat);

  // (b) web leg via runSourceLens with the GENERIC handle ONLY. runSourceLens
  // owns the pre-egress audit; we pass no room content in the query string.
  let lensResult = null;
  try {
    lensResult = await runSourceLensFn({
      roomDir,
      topic: handle, // GENERIC handle only -- never room content (Part 8)
      lensSet,
      preflight: (extracted && isPlainObject(extracted.preflight)) ? extracted.preflight : {},
      db,
      sessionId,
    });
  } catch (_e) {
    lensResult = null;
  }
  const findings = (lensResult && Array.isArray(lensResult.findings)) ? lensResult.findings : [];

  // (c) wire each accepted finding as a PROPOSED EvidenceClaim + INFORMS, and
  // collect the returned node_ids into the persona's wired source set.
  const wired_sources = [];
  const evidence = [];
  if (!db) {
    degraded_reasons.push('db_absent_wire_skipped');
  }
  for (const finding of findings) {
    if (!isPlainObject(finding)) continue;
    if (!db) continue; // wire-skipped: no db to write into (disclosed above)
    let res = null;
    try {
      res = wireAcceptFn(db, {
        finding: {
          title: finding.title,
          source: finding.source,
          url: finding.url,
          retrieved_at: finding.retrieved_at,
          evidence_tier: finding.evidence_tier,
          summary: finding.summary,
        },
        decision: { target_section: subdomain || 'research', target_kind: 'local' },
        roomDir,
        sessionId,
        topic: handle,
      });
    } catch (_e) {
      res = null;
    }
    if (res && res.ok && typeof res.node_id === 'string') {
      wired_sources.push(res.node_id);
      // The evidence item cites the WIRED node id -- a persona may only assert
      // from within its own INFORMS set (validateCitations enforces it).
      evidence.push({
        source: res.node_id,
        title: typeof finding.title === 'string' ? finding.title : '',
        tier: typeof finding.evidence_tier === 'string' ? finding.evidence_tier : '',
        url: typeof finding.url === 'string' ? finding.url : '',
        disposition: 'confirming',
      });
    }
  }

  // The thin-world state is STRUCTURAL, never silent (SEED-059).
  const degraded = wired_sources.length === 0;
  if (degraded && degraded_reasons.indexOf('db_absent_wire_skipped') === -1) {
    degraded_reasons.push('no_wired_sources');
  }

  // (d optional) the Brain leg: generic dimension hints. EVERY Brain-bound
  // payload passes classify FIRST and proceeds ONLY on verdict 'allow'. The
  // payload carries the GENERIC handle only -- never room content.
  let brain_skipped = false;
  let brain_hints = null;
  if (brainFn) {
    const brainPayload = { ask: handle, question: handle };
    let verdict = null;
    try {
      verdict = classifyFn(brainPayload, { toolName: 'brain_ask' });
    } catch (_e) {
      verdict = null;
    }
    if (verdict && verdict.verdict === 'allow') {
      try {
        brain_hints = await brainFn(brainPayload);
      } catch (_e) {
        brain_hints = null;
        brain_skipped = true;
        degraded_reasons.push('brain_call_threw');
      }
    } else {
      brain_skipped = true;
      degraded_reasons.push('brain_egress_' + (verdict && verdict.verdict ? verdict.verdict : 'unverified'));
    }
  }

  const stance = coerceStance(evidence.length > 0 ? 'supports' : 'neutral');
  const confidence = evidence.length > 0 ? Math.min(0.5 + 0.1 * evidence.length, 0.9) : 0.2;

  const reading = {
    subdomain,
    hat,
    stance,
    evidence,
    confidence,
    wired_sources,
    degraded,
    degraded_reasons,
  };
  if (brainFn) {
    reading.brain_skipped = brain_skipped;
    reading.brain_hints = brain_hints;
  }
  return reading;
}

/**
 * validateCitations(reading) -> { ok, violations:[] }
 *
 * The citation-boundary check: every evidence citation's source id MUST be inside
 * reading.wired_sources. Exported separately so hat-governance's selfCritiqueFn
 * (Plan 03 wiring) and tests can call it directly. Violations are scalar strings.
 */
function validateCitations(reading) {
  const r = isPlainObject(reading) ? reading : {};
  const evidence = Array.isArray(r.evidence) ? r.evidence : [];
  const wired = Array.isArray(r.wired_sources) ? r.wired_sources : [];
  const wiredSet = new Set(wired);
  const violations = [];
  for (const item of evidence) {
    const src = item && typeof item.source === 'string' ? item.source : null;
    if (!src) {
      violations.push('citation_missing_source');
      continue;
    }
    if (!wiredSet.has(src)) {
      violations.push('citation_outside_wired_set');
    }
  }
  return { ok: violations.length === 0, violations };
}

module.exports = {
  personaDispatchCell,
  validateCitations,
  // exposed for tests + Plan 03 wiring
  hatScopedLensSet,
  HAT_LENS_BIAS,
  STANCES,
};
