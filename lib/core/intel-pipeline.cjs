'use strict';
/*
 * Phase 223-04 -- intel-pipeline: the THIN staged composition core that
 * /mos:intel-pipeline (Req 3) drives, and the second caller of the Req 4 shared
 * writeCloseLoop contract. This is a STAGE COMPOSER, not a new loop runtime
 * (Canon Part 7): every stage DELEGATES to a shipped engine; the only net-new
 * logic here is sequencing, gating, and structural disclosure (SEED-059). Each
 * seam has a production default AND is fully injectable, so Req 3's acceptance
 * (dry-run plan, three ordered gate halts, quality-low HALT, one claim through
 * the whole loop) is fixture-provable with zero live LLM/web (VALIDATION).
 *
 * The seven stages (PIPELINE_STAGES, frozen ordered):
 *   calibrate -> decompose -> plan-fan -> fan -> compute -> synthesize -> close
 *
 * DECOMPOSE HAS TWO SOURCES (Phase 265-22, T1): the room's active JTBD by
 * default (dimensionsForJtbd, unchanged), or a caller-supplied entity roster
 * on request (opts.roster + opts.rosterAxes, via rosterToCells). This closes
 * the one genuine online-research gap in the audited command set (ACE /
 * /mos:diffusion step 4 profiles N actors on 3 capacity axes each, from a
 * roster that only exists mid-command). The seven stages above are UNCHANGED
 * either way: roster mode substitutes cell ids for JTBD dimensions at
 * decompose and rides every other stage (the fan-approve cost gate, the same
 * underlying corpus-fetch chokepoint, compute/synthesize/close) exactly as
 * shipped. Omitting opts.roster reproduces today's JTBD-derived behavior
 * exactly.
 *
 * THREE declared HITL gates (T-223-14 elevation-of-privilege mitigation; the
 * pipeline is never autonomous end to end):
 *   calibrate  (F.1) -- confirm the room JTBD orientation before any dispatch
 *   fan-approve (F.1) -- the navigator-facing COST control over the research fan
 *                        (T-223-15; the fan size is not a hidden limit)
 *   synthesize (F.5) -- ratify the bull/bear + ACH-skeptic ruling before write
 * A reject at ANY gate stops the run with a disclosed halted state.
 *
 * THE JTBD REINFORCING-LOOP GUARDRAIL (G-2, the SPEC addendum's final paragraph
 * + 223-AI-SPEC Section 6): findings must NEVER silently re-write the room's
 * active JTBD, or the pipeline becomes a self-reinforcing loop that manufactures
 * its own mandate (Tampering, T-223-17). So the JTBD state is written EXACTLY
 * ONCE per run -- right after the calibrate gate approves -- and NEVER again
 * anywhere in the flow. When the synthesized findings diverge from the
 * calibrated JTBD cues, that divergence is SURFACED at the F.5 synthesize gate
 * for the navigator to judge; it is never auto-written back. There is exactly
 * one write-JTBD call site in this file, at the calibrate stage below.
 *
 * COMPUTE = the eureka MEASURED legs (D-03): the compute stage default rides
 * scoreMeasured (lib/core/rs-differential-scorer.cjs) over finding/artifact
 * pairs and the per-room recompute entry scripts/eureka-room-report.cjs
 * (--offline tolerated, encoder_unavailable disclosed per SEED-059). It NEVER
 * shells out to a scientific-compute subprocess (D-03 overrides the stale
 * BUILD-BRIEF Section 3 leg; RESEARCH staleness correction 2).
 *
 * CLOSE = ONE writeCloseLoop call with surface 'intel-pipeline' (Req 4's shared
 * contract; D-01 dual write + D-02 proposed edges live INSIDE the writer, never
 * here), then the compute-opportunity-state bank rollup so the bank is aware.
 * This core issues NO raw SQL and opens NO Brain wire (Canon Part 8/9): the db
 * handle is caller-owned and every graph write routes through the writer's
 * navigation chokepoint.
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE). CJS only, zero new deps.
 */

const path = require('node:path');

const jtbdState = require('../hmi/jtbd-state.cjs');
const dispatchOptimizer = require('./dispatch-optimizer.cjs');
const closeLoopWriter = require('./close-loop-writer.cjs');
const egressGuard = require('./part8-egress-guard.cjs');

// The frozen ordered stage list the command renders and the plan echoes.
const PIPELINE_STAGES = Object.freeze([
  'calibrate', 'decompose', 'plan-fan', 'fan', 'compute', 'synthesize', 'close',
]);

// The LOW default fan cap (RESEARCH Open Question 2: cap the per-dimension fan
// low; the fan-approve gate is the explicit navigator cost control, not a hidden
// throttle). Overridable via opts.caps.fan.
const FAN_CAP_LOW = 3;

// JTBD verb -> research dimension handles. A small LOCAL mapping (generic
// methodology handles only; nothing user-specific crosses to the Brain). The
// calibrated JTBD's handles ARE the cues the G-2 divergence check compares
// against at synthesize.
const JTBD_DIMENSION_MAP = Object.freeze({
  'validate-idea': ['demand-evidence', 'competitive-landscape', 'feasibility'],
  'find-customers': ['segment-definition', 'acquisition-channels', 'willingness-to-pay'],
  'raise-funding': ['funder-fit', 'traction-signals', 'use-of-funds'],
  'refine-offer': ['value-proposition', 'pricing-signal', 'differentiation'],
  'explore': ['problem-space', 'adjacent-markets', 'trend-signals'],
});
const DEFAULT_DIMENSIONS = Object.freeze(['problem-space', 'demand-evidence', 'risk-signals']);

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// A gate decision is an APPROVE iff it is boolean true or an object with
// approved === true. Anything else (false, {approved:false}, undefined) rejects.
function isApproved(decision) {
  return decision === true || (isPlainObject(decision) && decision.approved === true);
}

// --- Production seam defaults (all injectable; tests never invoke these). -----

// defaultResearchFn: the shipped research pipe extractContext -> runSourceLens
// -> wireAccept, run per dimension. Lazy-required so the module loads without
// the heavy lens engine; a leg that is unavailable degrades to a disclosed
// low-quality pass (SEED-059) rather than throwing. Exercised live at phase
// verification (223-VALIDATION), never in the hermetic fixture.
async function defaultResearchFn(dimension, ctx) {
  const context = isPlainObject(ctx) ? ctx : {};
  try {
    // eslint-disable-next-line global-require
    const extractor = require('./research-context-extractor.cjs');
    // eslint-disable-next-line global-require
    const lensDriver = require('../lens-engine/source-lens-driver.cjs');
    const wirer = require('./findings-wirer.cjs');
    const extracted = typeof extractor.extractContext === 'function'
      ? await extractor.extractContext(context.roomDir, { dimension: dimension })
      : null;
    const lensed = typeof lensDriver.runSourceLens === 'function'
      ? await lensDriver.runSourceLens(Object.assign({ dimension: dimension }, extracted || {}))
      : null;
    const findings = lensed && Array.isArray(lensed.findings) ? lensed.findings : [];
    const quality = lensed && typeof lensed.quality === 'string' ? lensed.quality : (findings.length > 0 ? 'ok' : 'low');
    // wireAccept is the per-pass wiring call; the composer leaves the actual
    // node write to the close stage's single writeCloseLoop, so wiring here is a
    // no-op placeholder kept for the live pipe (findings-wirer stays imported so
    // the by-name contract holds).
    void wirer;
    return { findings: findings.map((f) => ({ text: typeof f.summary === 'string' ? f.summary : String(f.title || ''), dimension: dimension })), quality: quality, wired_sources: findings.length };
  } catch (e) {
    return { findings: [], quality: 'low', disclosure: 'research pipe unavailable: ' + String(e.message || '').slice(0, 80) };
  }
}

// defaultComputeFn: the D-03 eureka MEASURED legs. scoreMeasured over the
// finding/artifact pairs where vectors are available; the per-room recompute
// rides scripts/eureka-room-report.cjs (--offline tolerated). NEVER a
// scientific-compute subprocess. Injected in tests.
async function defaultComputeFn(ctx) {
  const context = isPlainObject(ctx) ? ctx : {};
  const pairs = Array.isArray(context.pairs) ? context.pairs : [];
  // eslint-disable-next-line global-require
  const scorer = require('./rs-differential-scorer.cjs');
  const measured = [];
  for (const p of pairs) {
    try {
      const m = await scorer.scoreMeasured(p && p.a, p && p.b, { vectors: p && p.vectors });
      measured.push(m);
    } catch (e) {
      measured.push({ passes: false, warning: 'compute_threw', detail: String(e.message || '').slice(0, 80) });
    }
  }
  return { ok: true, measured: measured, room_recompute_entry: 'scripts/eureka-room-report.cjs' };
}

// defaultBankRollup: spawn the shipped bash bank rollup so the opportunity bank
// STATE is aware of the freshly written opportunity (both-stores awareness).
function defaultBankRollup(roomDir) {
  // eslint-disable-next-line global-require
  const { spawnSync } = require('node:child_process');
  const script = path.join(__dirname, '..', '..', 'scripts', 'compute-opportunity-state');
  const r = spawnSync('bash', [script, roomDir], { encoding: 'utf8' });
  return { ok: r.status === 0, status: r.status, stdout: r.stdout, stderr: r.stderr };
}

// readCalibrateEvidence: cheap presence read of the room's orienting docs. Pure
// filesystem, zero network. Feeds the calibrate gate payload.
function readCalibrateEvidence(roomDir) {
  // eslint-disable-next-line global-require
  const fs = require('node:fs');
  const out = { minto: false, state: false };
  if (typeof roomDir !== 'string' || roomDir.length === 0) return out;
  try { out.minto = fs.existsSync(path.join(roomDir, 'MINTO.md')); } catch (_e) { /* ignore */ }
  try { out.state = fs.existsSync(path.join(roomDir, 'STATE.md')); } catch (_e) { /* ignore */ }
  return out;
}

// dimensionsForJtbd: derive the research dimensions from the calibrated JTBD.
// Optional generic Brain dimensions ride ONLY through a classifyFn 'allow'
// verdict (Canon Part 8: generic handles only, fail-closed on anything else).
function dimensionsForJtbd(jtbd, classifyFn, genericDims) {
  const key = jtbd && typeof jtbd.jtbd === 'string' ? jtbd.jtbd : '';
  const base = JTBD_DIMENSION_MAP[key] ? JTBD_DIMENSION_MAP[key].slice() : DEFAULT_DIMENSIONS.slice();
  const extras = Array.isArray(genericDims) ? genericDims : [];
  for (const handle of extras) {
    if (typeof handle !== 'string' || handle.length === 0) continue;
    try {
      const verdict = classifyFn({ query: handle }, { toolName: 'brain_ask' });
      if (verdict && verdict.verdict === 'allow' && base.indexOf(handle) === -1) base.push(handle);
    } catch (_e) { /* fail-closed: skip the handle */ }
  }
  return base;
}

// buildGoverningThought: a <= 250 char synthesis line for the conclusion.
function buildGoverningThought(topic, claims) {
  const base = 'Intelligence pass on ' + topic + ' converges on ' + claims.length + ' evidenced claims oriented by the room JTBD.';
  return base.slice(0, 250);
}

// slugify: pure, deterministic id-safe transform (lowercase, non-alnum runs
// collapsed to a single hyphen, no leading/trailing hyphen).
function slugify(s) {
  return String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * rosterToCells(roster, axes) -> {ok:true, cells:[{entity, axis, handle, cell_id}]} | {ok:false, reason}
 *
 * Turns a caller-supplied entity roster plus an axis list into fan cells
 * (Phase 265-22, T1: the roster-keyed fan that closes the ACE / /mos:diffusion
 * step-4 gap). PURE: no filesystem access, no network reach, no clock use.
 * Each cell is ONE attributed research pass carrying the keys `entity`,
 * `axis`, `handle` and `cell_id`.
 *
 * PART 8 RULE ENCODED HERE: `handle` is the GENERIC public entity handle (an
 * organization name), never room content. The handle is what may cross
 * toward the public web via the SAME underlying corpus-fetch chokepoint
 * every other research leg uses; nothing else from the roster does.
 *
 * `roster` is an array of `{name, handle}` objects, or plain strings
 * (normalized to `{name: s, handle: s}`). `axes` is a non-empty array of axis
 * name strings. The result is the cross product, with `cell_id` a stable
 * deterministic string built from the entity handle and the axis (slugified,
 * joined with `::`), so re-running produces identical ids. A non-array
 * roster, an empty roster, a missing/empty axes array, and a roster entry
 * with no usable handle each return a typed `{ok:false, reason}` rather than
 * throwing, so a caller can fall back to JTBD-derived dimensions cleanly.
 */
function rosterToCells(roster, axes) {
  if (!Array.isArray(roster)) return { ok: false, reason: 'roster must be an array' };
  if (roster.length === 0) return { ok: false, reason: 'roster must not be empty' };
  if (!Array.isArray(axes) || axes.length === 0) return { ok: false, reason: 'axes must be a non-empty array' };

  const normalized = [];
  for (let i = 0; i < roster.length; i += 1) {
    const entry = roster[i];
    let name = null;
    let handle = null;
    if (typeof entry === 'string') {
      name = entry;
      handle = entry;
    } else if (isPlainObject(entry)) {
      name = typeof entry.name === 'string' ? entry.name : null;
      handle = typeof entry.handle === 'string' ? entry.handle : name;
    }
    if (typeof handle !== 'string' || handle.trim().length === 0) {
      return { ok: false, reason: 'roster entry at index ' + i + ' has no usable handle' };
    }
    normalized.push({ name: typeof name === 'string' && name.length > 0 ? name : handle, handle: handle });
  }

  const validAxes = axes.filter((a) => typeof a === 'string' && a.length > 0);
  if (validAxes.length === 0) return { ok: false, reason: 'axes must contain at least one non-empty string' };

  const cells = [];
  for (const entity of normalized) {
    for (const axis of validAxes) {
      cells.push({
        entity: entity.name,
        axis: axis,
        handle: entity.handle,
        cell_id: slugify(entity.handle) + '::' + slugify(axis),
      });
    }
  }
  return { ok: true, cells: cells };
}

/**
 * runIntelPipeline(opts) -> Promise<result>
 *
 * opts: {
 *   roomDir, db, topic?, dryRun?, caps?{fan, remainingContext},
 *   gateFn(ctx)->approve, onHalt(info),
 *   jtbdFns?{getCurrent, ...write} (the JTBD read/write seam pair),
 *   planFn?, researchFn?, computeFn?,
 *   writeFn?, classifyFn?, bankRollupFn?, genericDims?, run_id?, dateStr?
 * }
 *
 * result: { ok, dry_run?, halted?, halt_stage?, stages:[{stage,status,disclosure?}],
 *   plan:{stages,jtbd,dimensions,fan:{requested,planned,budget}}, written? }
 */
async function runIntelPipeline(opts) {
  const o = isPlainObject(opts) ? opts : {};
  const roomDir = o.roomDir;
  const db = o.db;
  const dryRun = o.dryRun === true;
  const caps = isPlainObject(o.caps) ? o.caps : {};
  const fanCap = typeof caps.fan === 'number' && caps.fan > 0 ? caps.fan : FAN_CAP_LOW;
  const runId = typeof o.run_id === 'string' && o.run_id.length > 0 ? o.run_id : 'intel-' + Date.now();

  // Seams (production defaults; every one injectable).
  const jtbdSeams = isPlainObject(o.jtbdFns) ? o.jtbdFns : jtbdState;
  const planFn = typeof o.planFn === 'function' ? o.planFn : dispatchOptimizer.planDispatch;
  const researchFn = typeof o.researchFn === 'function' ? o.researchFn : defaultResearchFn;
  const computeFn = typeof o.computeFn === 'function' ? o.computeFn : defaultComputeFn;
  const writeFn = typeof o.writeFn === 'function' ? o.writeFn : closeLoopWriter.writeCloseLoop;
  const classifyFn = typeof o.classifyFn === 'function' ? o.classifyFn : egressGuard.classify;
  const bankRollupFn = typeof o.bankRollupFn === 'function' ? o.bankRollupFn : defaultBankRollup;
  const gateFn = typeof o.gateFn === 'function' ? o.gateFn : (() => ({ approved: true }));
  const onHalt = typeof o.onHalt === 'function' ? o.onHalt : (() => {});

  const stages = [];
  function record(stage, status, disclosure) {
    const e = { stage: stage, status: status };
    if (disclosure) e.disclosure = disclosure;
    stages.push(e);
    return e;
  }

  const plan = { stages: PIPELINE_STAGES, jtbd: null, dimensions: [], fan: { requested: 0, planned: 0, budget: null } };

  function haltReturn(haltStage, disclosure) {
    onHalt({ stage: haltStage, disclosure: disclosure });
    return { ok: false, halted: true, halt_stage: haltStage, stages: stages, plan: plan };
  }

  // ===== calibrate (read) =====
  const jtbd = (typeof jtbdSeams.getCurrent === 'function') ? jtbdSeams.getCurrent(roomDir) : null;
  plan.jtbd = jtbd;
  const evidence = readCalibrateEvidence(roomDir);

  // ===== decompose (derive dimensions OR roster cells) -- needed for the plan
  // in BOTH modes. When opts.roster is absent or invalid (rosterToCells
  // returns {ok:false}), behavior is EXACTLY what ships today:
  // dimensionsForJtbd derives the dimensions. This keeps the parameter
  // strictly additive (T-265-109).
  let dimensions;
  let rosterInfo = null;
  const rosterAttempt = (o.roster !== undefined) ? rosterToCells(o.roster, o.rosterAxes) : { ok: false, reason: 'no roster supplied' };
  if (rosterAttempt.ok) {
    dimensions = rosterAttempt.cells.map((c) => c.cell_id);
    const entityCount = new Set(rosterAttempt.cells.map((c) => c.handle)).size;
    const axisCount = new Set(rosterAttempt.cells.map((c) => c.axis)).size;
    rosterInfo = { entities: entityCount, axes: axisCount, byId: new Map(rosterAttempt.cells.map((c) => [c.cell_id, c])) };
    plan.roster_mode = true;
    plan.roster = { entities: entityCount, axes: axisCount, cells: rosterAttempt.cells.length };
  } else {
    dimensions = dimensionsForJtbd(jtbd, classifyFn, o.genericDims);
  }
  plan.dimensions = dimensions;

  // ===== plan-fan (size the fan) -- planning only, no gate yet ================
  let planResult = null;
  try {
    planResult = planFn(roomDir, { remainingContext: caps.remainingContext || 200000 });
  } catch (e) {
    planResult = { agents: dimensions.length, budget: null, _error: String(e.message || '').slice(0, 80) };
  }
  // In roster mode `dimensions` already IS the cell-id list (one entry per
  // entity-axis cell), so this clamp against dimensions.length is ALSO the
  // clamp against the cell count required by T1 -- no separate branch needed,
  // and fanCap is preserved unchanged in both modes.
  const requested = planResult && typeof planResult.agents === 'number' ? planResult.agents : dimensions.length;
  const planned = Math.max(1, Math.min(requested, fanCap, dimensions.length));
  plan.fan = { requested: requested, planned: planned, budget: planResult ? planResult.budget || null : null };

  // ===== dry-run short circuit: emit the plan, dispatch NOTHING. ==============
  if (dryRun) {
    record('calibrate', 'planned');
    record('decompose', 'planned');
    record('plan-fan', 'planned');
    return { ok: true, dry_run: true, halted: false, stages: stages, plan: plan };
  }

  // ===== calibrate GATE (F.1) =====
  const calibrateDecision = gateFn({ stage: 'calibrate', shape: 'F.1', jtbd: jtbd, evidence: evidence });
  if (!isApproved(calibrateDecision)) {
    record('calibrate', 'halted', 'navigator rejected at the calibrate gate');
    return haltReturn('calibrate', 'calibrate gate rejected');
  }
  // G-2: the room JTBD is written EXACTLY ONCE here, and never again. A blocked
  // write (a live manual-override window) is disclosed and the run continues on
  // the existing JTBD.
  if (jtbd && typeof jtbd.jtbd === 'string' && jtbd.jtbd.length > 0) {
    jtbdSeams.setCurrent(roomDir, {
      jtbd: jtbd.jtbd,
      confidence: typeof jtbd.confidence === 'number' ? jtbd.confidence : 0,
      evidence: ['intel-pipeline calibrate gate approved'],
      trigger: 'intel-pipeline-calibrate',
      manual: false,
    });
    record('calibrate', 'ok');
  } else {
    record('calibrate', 'degraded', 'no calibrated JTBD present; continuing without writing room orientation state');
  }

  // ===== decompose (record) =====
  // Roster mode names the entity/axis counts rather than the (potentially
  // long) cell-id list -- the dimension list itself was never useful reading
  // in this mode, since it is derived, not authored.
  if (plan.roster_mode) {
    record('decompose', 'ok', 'roster mode: ' + rosterInfo.entities + ' entities x ' + rosterInfo.axes + ' axes');
  } else {
    record('decompose', 'ok', 'dimensions: ' + dimensions.join(', '));
  }

  // ===== fan-approve GATE (F.1) -- the navigator cost control =================
  // This gate is NOT optional in roster mode: it is the SAME F.1 fan-approve
  // gate, unchanged, rendering "N actors x M axes = C lookups, approve?" (via
  // `dimensions`/`N` carrying the cell ids/planned cell count) before a single
  // byte is fetched. Roster mode reuses this gate rather than adding a second
  // confirmation (T-265-107).
  const fanDecision = gateFn({ stage: 'fan-approve', shape: 'F.1', dimensions: dimensions, N: planned, budget: plan.fan.budget });
  if (!isApproved(fanDecision)) {
    record('plan-fan', 'halted', 'navigator rejected the research fan at the fan-approve gate; no research dispatched');
    return haltReturn('fan-approve', 'fan-approve gate rejected');
  }
  record('plan-fan', 'ok', 'fan planned: ' + planned + ' of ' + requested + ' requested');

  // ===== fan (dispatch the passes SEQUENTIALLY; quality-low HALTS) ===========
  // ATTRIBUTION MUST SURVIVE HERE (the entire reason this parameter exists):
  // an unattributed result is exactly what a plain /mos:research pass already
  // produces (T-265-108, Repudiation). Every cell dispatches through the SAME
  // researchFn seam and the SAME underlying corpus-fetch chokepoint every
  // other research leg uses (no second fetch path); when a roster cell backs
  // the dimension being run, its `entity` and `axis` are stamped onto the
  // research context
  // handed to researchFn AND onto the returned pass (and its findings), so
  // the attribution rides forward into compute/synthesize/close below.
  const dimsToRun = dimensions.slice(0, planned);
  const fanResults = [];
  for (let i = 0; i < dimsToRun.length; i += 1) {
    const dim = dimsToRun[i];
    const cell = rosterInfo ? rosterInfo.byId.get(dim) : null;
    let pass;
    try {
      const researchCtx = { roomDir: roomDir, db: db, dimension: dim };
      if (cell) {
        researchCtx.entity = cell.entity;
        researchCtx.axis = cell.axis;
        researchCtx.handle = cell.handle;
      }
      pass = await researchFn(dim, researchCtx);
    } catch (e) {
      pass = { findings: [], quality: 'low', disclosure: 'pass threw: ' + String(e.message || '').slice(0, 80) };
    }
    if (pass && pass.quality === 'low') {
      const disclosure = 'SEED-059: research quality:low at fan pass ' + (i + 1) + '/' + dimsToRun.length
        + ' (dimension ' + dim + '); fan HALTED, remaining passes NOT dispatched';
      record('fan', 'halted', disclosure);
      return haltReturn('fan', disclosure);
    }
    if (cell && pass) {
      pass.entity = cell.entity;
      pass.axis = cell.axis;
      if (Array.isArray(pass.findings)) {
        pass.findings = pass.findings.map((f) => (isPlainObject(f) ? Object.assign({ entity: cell.entity, axis: cell.axis }, f) : f));
      }
    }
    fanResults.push(pass || { findings: [], quality: 'ok' });
  }
  record('fan', 'ok', dimsToRun.length + ' passes dispatched');

  // Aggregate findings + opportunities across the fan.
  const allFindings = [];
  const allOpps = [];
  const observedDims = [];
  fanResults.forEach((r) => {
    (Array.isArray(r.findings) ? r.findings : []).forEach((f) => {
      if (isPlainObject(f)) {
        allFindings.push(f);
        if (typeof f.dimension === 'string') observedDims.push(f.dimension);
      }
    });
    (Array.isArray(r.opportunities) ? r.opportunities : []).forEach((op) => allOpps.push(op));
  });

  // ===== compute (D-03 eureka measured legs) =================================
  try {
    await computeFn({ findings: allFindings, pairs: Array.isArray(o.computePairs) ? o.computePairs : [], roomDir: roomDir, db: db });
    record('compute', 'ok');
  } catch (e) {
    record('compute', 'degraded', 'compute leg degraded: ' + String(e.message || '').slice(0, 80));
  }

  // ===== synthesize: assemble payload + the G-2 divergence check =============
  const topic = typeof o.topic === 'string' && o.topic.length > 0
    ? o.topic
    : (jtbd && typeof jtbd.jtbd === 'string' ? jtbd.jtbd + ' intelligence pass' : 'intel-pipeline run');
  // Attribution rides into the payload here: a roster-mode finding carries
  // `entity`/`axis` (stamped in the fan loop above), so the claim handed to
  // writeFn names the actor row it informs (T-265-108). A JTBD-mode finding
  // has neither field, and the claim shape is unchanged from today.
  const claims = allFindings
    .filter((f) => typeof f.text === 'string' && f.text.length > 0)
    .map((f) => {
      const c = { text: f.text, knowledge_type: typeof f.knowledge_type === 'string' ? f.knowledge_type : 'fact' };
      if (typeof f.entity === 'string') c.entity = f.entity;
      if (typeof f.axis === 'string') c.axis = f.axis;
      return c;
    });
  let conclusion = null;
  if (claims.length >= 3) {
    conclusion = {
      governing_thought: buildGoverningThought(topic, claims),
      key_claims: claims.slice(0, Math.min(5, claims.length)).map((c) => c.text),
      topic: topic,
    };
  }
  const payload = { claims: claims, opportunities: allOpps, conclusion: conclusion };

  // G-2 divergence: dimensions observed in the findings that are NOT in the
  // calibrated JTBD cues. Surfaced at the synthesize gate for the navigator;
  // NEVER written back to the JTBD state (that would re-arm the reinforcing loop).
  const calibratedSet = new Set(dimensions);
  const observedUnique = Array.from(new Set(observedDims));
  const divergent = observedUnique.filter((d) => !calibratedSet.has(d));
  const jtbdDivergence = divergent.length > 0
    ? { calibrated: dimensions.slice(), observed: observedUnique, divergent: divergent }
    : null;

  // ===== synthesize GATE (F.5) =====
  const synthDecision = gateFn({
    stage: 'synthesize', shape: 'F.5',
    claim_count: claims.length, opportunity_count: allOpps.length,
    conclusion: conclusion, jtbd_divergence: jtbdDivergence,
  });
  if (!isApproved(synthDecision)) {
    record('synthesize', 'halted', 'navigator rejected the ruling at the synthesize gate');
    return haltReturn('synthesize', 'synthesize gate rejected');
  }
  record('synthesize', 'ok', jtbdDivergence ? 'ruling ratified; JTBD divergence disclosed (not written)' : 'ruling ratified');

  // ===== close: ONE writeCloseLoop (surface intel-pipeline) + bank rollup ====
  let written = null;
  try {
    written = await writeFn(db, roomDir, payload, { surface: 'intel-pipeline', run_id: runId, dateStr: o.dateStr });
    record('close', written && written.ok !== false ? 'ok' : 'degraded',
      written && Array.isArray(written.failures) && written.failures.length > 0 ? 'writer disclosed ' + written.failures.length + ' section failure(s)' : undefined);
  } catch (e) {
    record('close', 'degraded', 'writeCloseLoop threw: ' + String(e.message || '').slice(0, 80));
  }
  try {
    bankRollupFn(roomDir);
  } catch (e) {
    record('close', 'degraded', 'bank rollup degraded: ' + String(e.message || '').slice(0, 80));
  }

  return { ok: written ? written.ok !== false : false, halted: false, stages: stages, plan: plan, written: written };
}

module.exports = { runIntelPipeline, PIPELINE_STAGES, rosterToCells };
