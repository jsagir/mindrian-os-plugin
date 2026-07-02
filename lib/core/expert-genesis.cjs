'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 203-01 -- the expert GENESIS composer (Directive 1: the synthetic expert
 * is FAN-OUT-COMPOSED, not hand-authored).
 * ============================================================================
 * composeSyntheticExpert(db, spec, opts) fans out one research cell per
 * (framework x lens x subdomain), collects each cell's {stance, evidence,
 * confidence, source_signature}, synthesizes them into a single SyntheticExpert,
 * and writes that expert through the SHIPPED writeSyntheticExpertNode chokepoint
 * at review_status 'proposed'. It is the artifact Plan 04 surface A (construction
 * fidelity) judges.
 *
 * Why the per-lens source signatures matter: an expert built from ONE source
 * wearing many hats is a costume. The construction gate can only catch it if the
 * genesis actually fans out across DISTINCT sources and RECORDS the per-lens
 * source signatures. This module is where that provenance is earned.
 *
 * Canon Part 7 (Reuse Before Build) -- every seam is a call into a shipped module,
 * ZERO new runtime:
 *   - lib/core/bono/cell-fanout.cjs::runCellFanout        the parallel fan-out.
 *   - lib/core/dispatch-optimizer.cjs::planDispatch       the cost governor
 *     (invoked inside runCellFanout when a roomDir is supplied).
 *   - lib/core/futures/orchestrator.cjs::resolveFanoutCap the [1, FUTURES_FANOUT_CAP]
 *     clamp (applied here to the grid AND again inside runCellFanout).
 *   - lib/core/rs-expert-brain-projection.cjs::projectExpertHandles the GENERIC
 *     Brain read (degrades to [] on absence or leak, Part 8 fail-closed).
 *   - lib/core/navigation/synthetic-expert.cjs::writeSyntheticExpertNode the
 *     single Part-8-gated write door (Task 2).
 *
 * Canon Part 8: the composer makes ZERO raw Brain calls; every Brain read routes
 * through projectExpertHandles. Each cell's web leg carries only a GENERIC domain
 * handle; no venture bytes ride the fan-out or the node props.
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE). Pure CJS, node built-ins only.
 *
 * License: BSL 1.1.
 */

const { runCellFanout } = require('./bono/cell-fanout.cjs');
const { resolveFanoutCap } = require('./futures/orchestrator.cjs');
const { projectExpertHandles } = require('./rs-expert-brain-projection.cjs');

// The token separator that encodes a genesis cell (framework x subdomain x hat)
// into the single "subdomain" dimension runCellFanout crosses. Using one lens
// placeholder ('lens') for the hats dimension lets THIS module control the exact
// ordering of the grid (framework-interleaved) so the cost-cap clamp keeps
// distinct frameworks in the surviving slice.
const CELL_TOKEN_SEP = '::';
const LENS_PLACEHOLDER = 'lens';

/**
 * Sanitize a label into a bounded GENERIC token (Part 8): lowercase, word chars
 * only, collapsed whitespace, capped at 6 words so a long body cannot smuggle
 * itself through as a "handle". Mirrors the cell-fanout genericDomainHandle
 * discipline.
 *
 * @param {string} label
 * @returns {string}
 */
function genericToken(label) {
  const s = String(label == null ? '' : label).toLowerCase();
  const words = s.replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  return words.slice(0, 6).join(' ');
}

/**
 * planGenesisGrid(spec) -> cells[]
 *
 * Build the genesis grid: one cell per (subdomain x hat x framework). The grid is
 * ordered framework-INNERMOST (for each subdomain, for each hat, for each
 * framework) so that when resolveFanoutCap clamps the grid to the cost cap, the
 * surviving slice still spans DISTINCT frameworks (the diversity the construction
 * gate keys on). The grid length is passed through resolveFanoutCap so it can
 * NEVER exceed FUTURES_FANOUT_CAP (default 5).
 *
 * @param {Object} spec - { domain, subdomains[], hats[], frameworks[] }
 * @returns {Array<{ subdomain: string, hat: string, framework: string }>}
 */
function planGenesisGrid(spec) {
  const s = (spec && typeof spec === 'object') ? spec : {};
  const subdomains = Array.isArray(s.subdomains) ? s.subdomains.filter((x) => typeof x === 'string' && x.length > 0) : [];
  const hats = Array.isArray(s.hats) ? s.hats.filter((x) => typeof x === 'string' && x.length > 0) : [];
  const frameworks = Array.isArray(s.frameworks) ? s.frameworks.filter((x) => typeof x === 'string' && x.length > 0) : [];

  const grid = [];
  for (const subdomain of subdomains) {
    for (const hat of hats) {
      for (const framework of frameworks) {
        grid.push({ subdomain, hat, framework });
      }
    }
  }
  // Clamp the grid to the cost-governor cap (the FUTURES_FANOUT_CAP clamp idiom).
  // A grid of length 0 stays empty; resolveFanoutCap floors at 1 for a non-empty
  // request, so an empty grid is guarded explicitly.
  if (grid.length === 0) return [];
  const cap = resolveFanoutCap({ fanout: grid.length });
  return grid.slice(0, cap);
}

/**
 * The DEFAULT offline-safe genesis dispatch for a single cell. In production the
 * caller injects opts.dispatchCell to dispatch one agents/research.md instance per
 * (framework x lens x subdomain). The default carries ONLY a generic handle (Part
 * 8) and returns a conservative neutral-ish reading; a genesis with no injected
 * dispatch and no Brain degrades gracefully rather than fabricating evidence.
 *
 * @param {Object} cell - { framework, subdomain, hat, handle, genericHandles }
 * @returns {{ stance: string, evidence: Array, confidence: number, source_signature: string }}
 */
function defaultGenesisDispatch(cell) {
  const handles = Array.isArray(cell.genericHandles) ? cell.genericHandles : [];
  const evidence = handles.length > 0 ? handles.map((h) => ({ handle: h })) : [];
  return {
    stance: evidence.length > 0 ? 'supports' : 'neutral',
    evidence,
    confidence: evidence.length > 0 ? 0.5 : 0.4,
    // The default per-lens source signature is the framework itself (distinct
    // frameworks -> distinct signatures). A production dispatch returns the real
    // cited-source signature.
    source_signature: 'source' + CELL_TOKEN_SEP + genericToken(cell.framework),
  };
}

/**
 * Build the GENERIC lens node projectExpertHandles reads. It carries ONLY the
 * whitelisted generic-enum keys (framework / domain / methodology); a person or
 * venture byte cannot enter by construction because no such key is read.
 */
function buildLensNode(spec) {
  const s = (spec && typeof spec === 'object') ? spec : {};
  const framework = Array.isArray(s.frameworks) && s.frameworks.length > 0 ? s.frameworks[0] : '';
  return {
    framework: genericToken(framework),
    domain: genericToken(s.domain),
    methodology: 'reverse-salient discovery',
  };
}

/**
 * composeSyntheticExpert(db, spec, opts) -> Promise<result>
 *
 * The fan-out-then-synthesize composer. TASK 1 (this commit) implements the
 * fan-out half: plan the grid, dispatch every cell in PARALLEL through the shipped
 * runCellFanout (cost-governed by planDispatch, clamped by resolveFanoutCap),
 * collect each cell's {stance, evidence, confidence, source_signature}, read the
 * GENERIC Brain context via projectExpertHandles (Part 8 fail-closed), and record
 * the per-lens source signatures + the distinct-source count. TASK 2 adds the
 * synthesize + writeSyntheticExpertNode write door.
 *
 * opts:
 *   dispatchCell   (function)  per-cell dispatch (framework, subdomain, hat, handle,
 *                              genericHandles) => reading. Injected for offline tests.
 *   roomDir        (string)    forwarded to runCellFanout so planDispatch runs.
 *   cap            (number)    navigator cap override (clamped inside runCellFanout).
 *   selfCritique   (function)  fable-mode layer 1 override (default in cell-fanout).
 *   brainAvailable (boolean)   projectExpertHandles availability override (tests).
 *   classify / brainReader     projectExpertHandles seams (tests).
 *   write          (boolean)   Task 1: pass false for a fan-out-only run.
 *
 * @returns {Promise<{ cells, distinctSourceCount, genericHandles, grid, plan }>}
 */
async function composeSyntheticExpert(db, spec, opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};

  // 1. Plan the genesis grid (clamped, framework-interleaved).
  const grid = planGenesisGrid(spec);

  // 2. Read the GENERIC Brain context (Part 8: projectExpertHandles is the ONLY
  //    Brain door; it degrades to [] with Brain absent or on any leak).
  const lensNode = buildLensNode(spec);
  let genericHandles = [];
  try {
    genericHandles = await projectExpertHandles(lensNode, {
      brainAvailable: o.brainAvailable,
      classify: o.classify,
      brainReader: o.brainReader,
      roomDir: o.roomDir,
    });
  } catch (_e) {
    genericHandles = [];
  }
  if (!Array.isArray(genericHandles)) genericHandles = [];

  // 3. Encode each genesis cell into the single "subdomain" dimension runCellFanout
  //    crosses (framework::subdomain::hat), with one lens placeholder for the hats
  //    dimension so THIS module owns the grid ordering. A side-channel sigMap
  //    records the per-lens source signature (runCellFanout's normalizeReading does
  //    not carry it through, so we re-associate by the cell key after the fan-out).
  const tokens = grid.map((c) => c.framework + CELL_TOKEN_SEP + c.subdomain + CELL_TOKEN_SEP + c.hat);
  const sigMap = new Map();
  const userDispatch = typeof o.dispatchCell === 'function' ? o.dispatchCell : defaultGenesisDispatch;

  async function wrappedDispatch(cell, ctx) {
    const parts = String(cell.subdomain).split(CELL_TOKEN_SEP);
    const framework = parts[0] || '';
    const subdomain = parts[1] || '';
    const hat = parts[2] || '';
    let reading;
    try {
      reading = await userDispatch({ framework, subdomain, hat, handle: cell.handle, genericHandles }, ctx);
    } catch (_e) {
      reading = { stance: 'neutral', evidence: [], confidence: 0 };
    }
    const r = (reading && typeof reading === 'object') ? reading : {};
    const sig = (typeof r.source_signature === 'string' && r.source_signature.length > 0)
      ? r.source_signature
      : ('source' + CELL_TOKEN_SEP + genericToken(framework));
    sigMap.set(cell.subdomain + '||' + cell.hat, { sig, framework, subdomain, hat });
    // Return ONLY the {stance, evidence, confidence} the shipped fan-out normalizes.
    return { stance: r.stance, evidence: r.evidence, confidence: r.confidence };
  }

  // 4. Fan out through the SHIPPED runCellFanout (parallel, cost-governed by
  //    planDispatch when roomDir is present, clamped by resolveFanoutCap). We pass
  //    the tokens as the rows and a single lens placeholder as the column.
  const fan = await runCellFanout({
    subdomains: tokens,
    hats: [LENS_PLACEHOLDER],
    dispatchCell: wrappedDispatch,
    roomDir: o.roomDir,
    cap: o.cap,
    selfCritique: o.selfCritique,
  });

  // 5. Re-associate each surviving reading with its recorded per-lens metadata.
  const cells = (Array.isArray(fan.cells) ? fan.cells : []).map((c) => {
    const meta = sigMap.get(c.subdomain + '||' + c.hat) || {};
    return {
      framework: meta.framework || '',
      subdomain: meta.subdomain || '',
      hat: meta.hat || '',
      stance: c.stance,
      evidence: c.evidence,
      confidence: c.confidence,
      source_signature: meta.sig || '',
    };
  });
  const distinctSourceCount = new Set(cells.map((c) => c.source_signature)).size;

  const fanResult = {
    cells,
    distinctSourceCount,
    genericHandles,
    grid,
    plan: fan.plan || { requested: tokens.length, dispatched: cells.length, capped: false },
  };

  // TASK 1: a fan-out-only run returns here (write:false). The synthesize + write
  // door lands in Task 2.
  return fanResult;
}

module.exports = {
  planGenesisGrid,
  composeSyntheticExpert,
  genericToken,
  buildLensNode,
  defaultGenesisDispatch,
};
