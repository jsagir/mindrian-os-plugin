/**
 * MindrianOS Plugin -- BONO per-(subdomain x hat) cell fan-out (Phase 164 Wave 4).
 *
 * The genuinely net-new mechanic of the BONO Research/Debate Engine: a REAL
 * PARALLEL sub-agent fan-out (the shipped persona path is inline-serial, so a
 * parallel cell fan-out is net-new). It dispatches N = subdomains x hats
 * independent (subdomain x hat) cells, each returning a structured
 * {stance, evidence, confidence}, then applies fable-mode layer 1 (per-cell
 * self-critique BEFORE collection) so one bad cell reading cannot propagate into
 * the debate. The collected array FEEDS the sequential debate executor in Wave 5
 * -- this wave produces the collected cells; it does NOT force the parallel
 * fan-out through the sequential loop (D-164-S2).
 *
 * Reuse before build (Canon Part 7):
 *   - the parallel dispatch reuses lib/core/dispatch-optimizer.cjs::planDispatch
 *     (the SHIPPED cost-governor + swarm-scale planner; scaleSwarm / selectModel),
 *     not a new loop runtime.
 *   - the cost cap reuses the FUTURES_FANOUT_CAP clamp idiom from
 *     lib/core/futures/orchestrator.cjs (resolveFanoutCap).
 *   - the web leg reuses research-corpus.fetchCorpus + its 30-day cache + the
 *     auditQueryString chokepoint (Part 8 fail-closed pre-egress gate).
 *
 * The module MUST NOT require the sequential chain executor: the fan-out is
 * parallel; the sequential debate executor is the Wave-5 debate consumer
 * (D-164-S2 / 164-RESEARCH A: the chain executor is sequential-only, so the cell
 * fan-out CANNOT be a sequential chain sequence).
 *
 * Canon Part 8: each cell's web leg carries a GENERIC domain handle only (never
 * venture body); zero Brain egress here.
 *
 * Pure Node.js built-ins only (zero npm deps). No emoji. No em-dashes.
 */

'use strict';

const dispatchOptimizer = require('../dispatch-optimizer.cjs');
const { resolveFanoutCap, FUTURES_FANOUT_CAP } = require('../futures/orchestrator.cjs');
const researchCorpus = require('../research-corpus.cjs');

// The closed stance vocabulary (164-04-PLAN.md must_haves). A cell reading takes
// exactly one of these; an unknown stance coerces to 'neutral' defensively.
const CELL_STANCES = Object.freeze(['supports', 'challenges', 'refines', 'neutral']);

// The de Bono hat colors. Red is intuition-only (no web leg per the TOOL ACCESS
// contract); Blue is synthesis across the other hats (no fresh web leg). The web
// leg fires only for the data/evidence hats (White / Black / Green / Yellow).
const WEB_HATS = Object.freeze(new Set(['White', 'Black', 'Green', 'Yellow']));

// The default cost-governor cap mirrors the futures FUTURES_FANOUT_CAP clamp
// idiom. resolveFanoutCap clamps a navigator override to [1, FUTURES_FANOUT_CAP];
// the BONO cell fan-out reuses that exact clamp so an unbounded (subdomain x hat)
// grid can never balloon past the cost-governor cap (threat T-164-16). The
// shipped FUTURES_FANOUT_CAP default is 5.
const DEFAULT_CELL_CAP = FUTURES_FANOUT_CAP;

// The fable-mode layer 1 confidence floor: a reading below this is too thin to
// fold into the debate (the swarm-side half of two-layered fable-mode, D-164-S3).
const CONFIDENCE_FLOOR = 0.3;

// The default external corpus source for a cell's web leg. openalex is a public
// academic source (no API key) so the leg works out of the box, mirroring the
// futures SIGNAL leg default.
const DEFAULT_RESEARCH_SOURCE = 'openalex';
const DEFAULT_RESEARCH_LIMIT = 5;

/**
 * Derive a GENERIC domain handle from a subdomain label (Part 8). The handle
 * carries ONLY a domain/concept keyword phrase -- NEVER a venture body or any
 * room artifact text. Strip to word characters, collapse whitespace, cap at 6
 * words so a long body cannot smuggle itself through as a "handle" (mirrors the
 * futures orchestrator genericDomainHandle discipline).
 *
 * @param {string} subdomain
 * @returns {string} a bounded generic handle (or '' when nothing generic remains)
 */
function genericDomainHandle(subdomain) {
  const s = String(subdomain == null ? '' : subdomain).toLowerCase();
  const words = s.replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  return words.slice(0, 6).join(' ');
}

/**
 * Coerce a raw dispatch return into the frozen cell shape (defensive). An
 * unknown stance becomes 'neutral'; a non-array evidence becomes []; a
 * non-numeric or out-of-range confidence is clamped to [0, 1].
 */
function normalizeReading(raw, subdomain, hat) {
  raw = (raw && typeof raw === 'object') ? raw : {};
  let stance = String(raw.stance || 'neutral');
  if (!CELL_STANCES.includes(stance)) stance = 'neutral';
  const evidence = Array.isArray(raw.evidence) ? raw.evidence : [];
  let confidence = typeof raw.confidence === 'number' && !Number.isNaN(raw.confidence) ? raw.confidence : 0;
  if (confidence < 0) confidence = 0;
  if (confidence > 1) confidence = 1;
  return { subdomain, hat, stance, evidence, confidence };
}

/**
 * The graceful defensive stub a cell collapses to when its dispatch throws. It
 * is neutral + low-confidence so it cannot tilt the debate, and it never crashes
 * the fan-out (164-04-PLAN.md Test 2 defensive contract).
 */
function defensiveStub(subdomain, hat, reason) {
  return {
    subdomain,
    hat,
    stance: 'neutral',
    evidence: [],
    confidence: 0,
    error: String(reason || 'cell_error').slice(0, 160),
  };
}

/**
 * The DEFAULT per-cell dispatch. Used when the caller injects no dispatchCell.
 * It runs the cell's hat-scoped web leg via research-corpus.fetchCorpus carrying
 * ONLY the generic subdomain handle (Part 8: auditQueryString is the fail-closed
 * pre-egress gate inside fetchCorpus), then returns a {stance, evidence,
 * confidence} reading. Red / Blue hats run no fresh web leg (intuition /
 * synthesis per the TOOL ACCESS contract).
 *
 * @param {Object} cell - { subdomain, hat, handle }
 * @param {Object} ctx  - { researchFn, source, limit }
 * @returns {Promise<Object>} a raw reading {stance, evidence, confidence}
 */
async function defaultDispatchCell(cell, ctx) {
  const evidence = [];
  if (WEB_HATS.has(cell.hat) && cell.handle) {
    // The web leg: a GENERIC handle ONLY crosses the boundary (never venture
    // body). fetchCorpus runs auditQueryString fail-closed before any dispatch.
    const results = await ctx.researchFn({
      source: ctx.source,
      query: cell.handle,
      limit: ctx.limit,
    });
    const list = Array.isArray(results) ? results : [];
    for (const r of list) evidence.push(r);
  }
  // A reading with cited evidence supports; an empty-evidence data hat is neutral
  // (it found nothing to stand on). This is a deliberately conservative default;
  // the production cell agent (persona-analyst) shapes a richer stance.
  const stance = evidence.length > 0 ? 'supports' : 'neutral';
  const confidence = evidence.length > 0 ? Math.min(0.5 + 0.1 * evidence.length, 0.9) : 0.2;
  return { stance, evidence, confidence };
}

/**
 * The DEFAULT fable-mode layer 1 self-critique (used when no selfCritique is
 * injected). Drops a reading whose confidence is below the floor, or that makes
 * a non-neutral claim with zero evidence. Returns { keep, reason, cell }.
 */
function defaultSelfCritique(cell) {
  if (cell.confidence < CONFIDENCE_FLOOR) {
    return { keep: false, reason: 'below_confidence_floor', cell };
  }
  if (cell.stance !== 'neutral' && (!cell.evidence || cell.evidence.length === 0)) {
    return { keep: false, reason: 'no_evidence', cell };
  }
  return { keep: true, cell };
}

/**
 * runCellFanout -- the parallel (subdomain x hat) cell fan-out.
 *
 * Builds the (subdomain x hat) grid, CLAMPS the grid length to the cost-governor
 * cap (the FUTURES_FANOUT_CAP clamp idiom via resolveFanoutCap), plans the
 * parallel dispatch via the SHIPPED dispatch-optimizer.planDispatch (the
 * cost-governor + swarm-scale planner), then dispatches ALL planned cells in
 * PARALLEL via Promise.all over dispatchCell (injected for testability; in
 * production it dispatches the upgraded persona-analyst cell agent). Each cell
 * returns {subdomain, hat, stance, evidence, confidence}; an erroring cell
 * collapses to a defensive neutral low-confidence stub (never crashes the
 * fan-out). Then fable-mode layer 1: each returned cell is self-critiqued BEFORE
 * collection; a low-quality verdict down-weights or drops the cell so it cannot
 * propagate (D-164-S3).
 *
 * The module does NOT require the sequential chain executor: the fan-out is
 * parallel; Wave 5 consumes the collected array into the sequential debate
 * executor (D-164-S2).
 *
 * @param {Object} opts
 * @param {string[]} opts.subdomains - the 163 subdomain labels (the cell rows)
 * @param {string[]} opts.hats       - the de Bono hats (the cell columns)
 * @param {Function} [opts.dispatchCell] - per-cell dispatch fn (cell) => Promise<reading>
 *   (injected for testability; default runs the hat-scoped web leg)
 * @param {Function} [opts.selfCritique]  - (cell) => { keep, reason?, cell } (fable-mode layer 1)
 * @param {Function} [opts.researchFn]    - the web leg (default research-corpus.fetchCorpus)
 * @param {number}   [opts.cap]           - navigator cap override (clamped to FUTURES_FANOUT_CAP)
 * @param {string}   [opts.roomDir]       - room dir for the planDispatch cost plan (optional)
 * @param {string}   [opts.source]        - corpus source for the default web leg
 * @param {number}   [opts.limit]         - result cap for the default web leg
 * @returns {Promise<{ cells: Object[], dropped: Object[],
 *   plan: { requested, dispatched, capped }, dispatchPlan: (Object|null) }>}
 */
async function runCellFanout(opts) {
  opts = opts || {};
  const subdomains = Array.isArray(opts.subdomains) ? opts.subdomains.filter((s) => typeof s === 'string') : [];
  const hats = Array.isArray(opts.hats) ? opts.hats.filter((h) => typeof h === 'string') : [];

  // Build the full (subdomain x hat) grid.
  const grid = [];
  for (const subdomain of subdomains) {
    for (const hat of hats) {
      grid.push({ subdomain, hat, handle: genericDomainHandle(subdomain) });
    }
  }
  const requested = grid.length;

  // CLAMP the grid length to the cost-governor cap. resolveFanoutCap mirrors the
  // FUTURES_FANOUT_CAP clamp idiom: a navigator may shrink the cap, never exceed
  // FUTURES_FANOUT_CAP (threat T-164-16: unbounded fan-out denial of service).
  const requestedCap = Number.isFinite(opts.cap) ? opts.cap : DEFAULT_CELL_CAP;
  const cap = resolveFanoutCap({ fanout: requestedCap });
  const planned = grid.slice(0, cap);
  const dispatched = planned.length;
  const capped = requested > dispatched;

  // Plan the parallel dispatch via the SHIPPED cost-governor + swarm-scale
  // planner (dispatch-optimizer.planDispatch). This is the reuse pointer: we do
  // NOT roll a new loop runtime. The plan is advisory budget metadata over the
  // dispatched cell count; a missing roomDir degrades to a planless run (the
  // fan-out still executes -- the plan is a cost annotation, not a gate).
  let dispatchPlan = null;
  if (typeof opts.roomDir === 'string' && opts.roomDir.length > 0) {
    try {
      dispatchPlan = dispatchOptimizer.planDispatch(opts.roomDir, {
        remainingContext: opts.remainingContext,
        preferredModel: opts.preferredModel,
      });
    } catch (_e) {
      dispatchPlan = null;
    }
  }

  // The per-cell dispatch fn. Injected for testability; the default runs the
  // hat-scoped web leg through research-corpus.fetchCorpus (Part 8 generic handle).
  const dispatchCell = typeof opts.dispatchCell === 'function' ? opts.dispatchCell : null;
  const researchFn = typeof opts.researchFn === 'function'
    ? opts.researchFn
    : researchCorpus.fetchCorpus;
  const ctx = {
    researchFn,
    source: typeof opts.source === 'string' ? opts.source : DEFAULT_RESEARCH_SOURCE,
    limit: Number.isFinite(opts.limit) ? opts.limit : DEFAULT_RESEARCH_LIMIT,
  };

  // Dispatch ALL planned cells in PARALLEL (Promise.all), NOT a sequential
  // await-loop and NOT a sequential chain sequence (D-164-S2). A cell error collapses to
  // a defensive stub inside the per-cell promise, so a single rejection never
  // rejects the whole fan-out.
  const readings = await Promise.all(planned.map(async (cell) => {
    try {
      const raw = dispatchCell
        ? await dispatchCell(cell, ctx)
        : await defaultDispatchCell(cell, ctx);
      return normalizeReading(raw, cell.subdomain, cell.hat);
    } catch (e) {
      return defensiveStub(cell.subdomain, cell.hat, e && e.message);
    }
  }));

  // Fable-mode layer 1: self-critique each reading BEFORE collection. A
  // low-quality verdict drops the cell so it cannot fold into the debate; a
  // clean cell passes through unchanged. The drop records a reason (graph data).
  const selfCritique = typeof opts.selfCritique === 'function' ? opts.selfCritique : defaultSelfCritique;
  const cells = [];
  const dropped = [];
  for (const reading of readings) {
    let verdict;
    try {
      verdict = selfCritique(reading);
    } catch (_e) {
      // A critique that throws is treated as a drop (fail closed, never crash).
      verdict = { keep: false, reason: 'critique_error', cell: reading };
    }
    if (verdict && verdict.keep) {
      cells.push(verdict.cell || reading);
    } else {
      dropped.push({
        subdomain: reading.subdomain,
        hat: reading.hat,
        reason: (verdict && verdict.reason) || 'dropped',
      });
    }
  }

  return {
    cells,
    dropped,
    plan: { requested, dispatched, capped },
    dispatchPlan,
  };
}

module.exports = {
  runCellFanout,
  genericDomainHandle,
  defaultDispatchCell,
  defaultSelfCritique,
  normalizeReading,
  CELL_STANCES,
  WEB_HATS,
  CONFIDENCE_FLOOR,
  DEFAULT_CELL_CAP,
};
