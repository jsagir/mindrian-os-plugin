'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 219-05 -- explore-chain: the REQ-4 explored-stage analysis chain.
 *
 * An EXPLICIT [Explore] on a QUALIFIED opportunity runs deep research +
 * diffusion/timing + analogical reasoning + web validation, then files a
 * Minto-shaped explored artifact. The canon mandate this implements:
 * "opportunities are conceptual... they must be researched and explored to be
 * turned into well-defined problems." The output target is a WELL-DEFINED
 * problem statement, never a candidate one-liner.
 *
 * D-06 (locked): composition rides the SHIPPED chain machinery ONLY --
 *   command-resolver.composeWorkflow maps framework NAMES to registry
 *   commands (command:null + optional:true honest degrade, never fabricated),
 *   and chain-executor.runChain is the ONE shared gated loop (posture from
 *   recipe-maps via the loop's defaults; the autonomous_safe prefix runs;
 *   material steps HALT at the gate, Canon Part 3). ZERO hardcoded /mos:
 *   slugs live in this file -- the four leg FRAMEWORK NAMES below were
 *   resolved against data/command-registry.json framework_index at build
 *   time (2026-07-13) and stay names, never command strings:
 *     deep_research    -> "Hypothesis-Driven Problem Solving"
 *     diffusion_timing -> "Adoption-Capacity Theory"
 *     analogies        -> "Four Lenses of Innovation"  (the find-analogies
 *                         command in its CURRENT Track-1-unrewired form; the
 *                         chain contract does not change when Track 1 rewires
 *                         internals, D-07)
 *     web_validation   -> "Jobs to Be Done (JTBD)"
 *
 * D-07 (locked): the web legs ride the FROZEN deep_research reach with
 *   GENERIC handles only, through the framework-runner's existing egress
 *   chokepoint reached via the caller-supplied onStep -- NEVER a raw fetch in
 *   the chain (grep-gated: zero fetch(, zero node:https requires here).
 *
 * D-16 item 3 (offline degrade): web-leg unavailability (opts.forceOffline
 *   test seam / an unavailable reach signaled by the host) swaps the web
 *   legs' source to research-filing.queryRoomCorpus with the step provenance
 *   "web: absent (room-corpus degrade)" -- never a crash, never a silent
 *   skip. D-19: the run envelope carries research_mode + per-provider
 *   {status, reason, counts, freshness} composed on the source-lens-driver
 *   seam; forced-offline composes 'web_degraded_local_fallback'; a COLD
 *   corpus composes 'insufficient_evidence', never ok:true+empty.
 *
 * D-20 (engine-breaks manual rung): when a chain step's ENGINE is unavailable
 *   (probe-fail beyond the graceful rungs, crash, missing substrate; test
 *   seam MINDRIAN_FORCE_ENGINE_ABSENT=1), the chain HALTS at a gate OFFERING
 *   llm-manual execution (the model performs the analysis via the frozen
 *   deep_research reach + native web tools, same Part 8 handles). NEVER the
 *   default, NEVER a silent substitution (the corepower lesson). A manual run
 *   (opts.manualMode === true -- the navigator ACCEPTED the offer at the
 *   gate) stamps engine_mode 'llm_manual_baseline' through the run trace and
 *   every filed artifact's frontmatter; manual output is EXCLUDED from
 *   calibration sets by that marker.
 *
 * NEVER AUTO-FIRES (REQ-4, T-219-18, navigator cost control): this module is
 *   invoked ONLY from the explicit commands/explore-opportunity.md surface.
 *   qualify-opportunity.cjs carries zero wiring to this module (test-pinned
 *   by a comment-filtered source scan in tests/test-219-explore-chain.cjs).
 *
 * Part 3: filing is MATERIAL. The chain always halts at the file_explored
 *   gate; filing happens ONLY when the navigator's onHalt verb approves
 *   ('approve' | 'file'). Any other verb ends the run with nothing filed.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const { composeWorkflow } = require('../../workflow/command-resolver.cjs');
const { runChain, makeGateFn } = require('../chain-executor.cjs');
const { openRoomDb, closeRoomDb } = require('../room-db.cjs');
const researchFiling = require('./research-filing.cjs');
// Phase 265-18 (RADAR-26): the in-process Promise.all fan-out this plan uses
// for the concurrent tail mirrors lib/core/bono/cell-fanout.cjs's shipped
// idiom (the navigator-confirmed final design). resolveFanoutCap is the SAME
// clamp cell-fanout reuses from the futures orchestrator; requiring it here
// is a second reuse of the ONE clamp, not a new cap.
const { resolveFanoutCap } = require('../futures/orchestrator.cjs');

// The four analysis legs (framework NAMES -- resolved via the registry at run
// time through composeWorkflow; see the D-06 header note). web:true legs are
// the deep_research-reach riders the offline degrade swaps.
const FRAMEWORK_LEGS = Object.freeze([
  Object.freeze({ leg: 'deep_research', framework: 'Hypothesis-Driven Problem Solving', web: true }),
  Object.freeze({ leg: 'diffusion_timing', framework: 'Adoption-Capacity Theory', web: false }),
  Object.freeze({ leg: 'analogies', framework: 'Four Lenses of Innovation', web: false }),
  Object.freeze({ leg: 'web_validation', framework: 'Jobs to Be Done (JTBD)', web: true }),
]);

// The material filing step. Its command is DELIBERATELY unknown to the
// command registry, so the default posture authority (recipe-maps
// postureForCommand via the loop) returns the withhold-default and the
// DEFAULT makeGateFn halts it -- the Part 3 material gate with zero custom
// gate logic on the happy path.
const FILING_STEP = Object.freeze({
  leg: 'file_explored',
  command: 'file-explored-artifact',
  material: true,
  framework: null,
  web: false,
});

// D-20 vocabulary (mirrors qualify-opportunity.cjs OFFER semantics).
const OFFER_VERB = 'LLM manual run (high effort)';
const MANUAL_ENGINE_MODE = 'llm_manual_baseline';

// The navigator verbs that approve the material filing step at the gate.
const APPROVE_VERBS = Object.freeze(['approve', 'file']);

// ---------------------------------------------------------------------------
// Phase 265-18 (RADAR-26): the probe-first cost guard.
//
// chain-executor.cjs's quality_early_stop (lib/core/chain-executor.cjs line
// 164 declares LOW_QUALITY = 'low'; the halt test itself is `if (quality ===
// LOW_QUALITY)` at chain-executor.cjs line ~648 in the sync path and ~905 in
// the async _runChainResilient path -- both read the SAME normalized
// `quality` local, computed as `(typeof result.quality === 'string') ?
// result.quality : null`) gave the sequential chain a real cost property: a
// cold deep_research leg (quality:'low') ended the chain right there, so
// diffusion_timing, analogies and web_validation never ran and nothing was
// spent on them. Parallel dispatch removes the "early" there is to stop at
// -- once three legs fire together there is no mid-fan step left to
// short-circuit. Rather than dropping the property this guard MOVES it one
// step earlier: probe deep_research ALONE first, apply the EXACT SAME
// quality test the executor applies (see probeClears below), and fan the
// remaining three out concurrently ONLY when the probe clears. A cold corpus
// still costs exactly one leg, never four -- the identical cost outcome the
// sequential chain produced, reached one step earlier so the concurrent win
// is real. If chain-executor.cjs's quality_early_stop test ever changes,
// probeClears below must change with it -- it is a deliberate mirror, not an
// independent guard.
// ---------------------------------------------------------------------------
const PROBE_LEG = 'deep_research';
const COST_MODES = Object.freeze(['cost-conscious', 'all-legs']);

/**
 * resolveExploreCostPolicy(env, opts) -> { mode, parallel, probeLeg, fanLegs, reason }
 *
 * PURE: no fs, no network, no clock (opts and env are plain data in, a plain
 * object out). Resolution order, highest precedence first:
 *   1. opts.costMode, when it is a member of COST_MODES.
 *   2. env.EXPLORE_COST_MODE, when it is a member of COST_MODES.
 *   3. Default 'cost-conscious'.
 * An unrecognized EXPLORE_COST_MODE value falls back to 'cost-conscious' and
 * says so in `reason` -- a typo must never select the more expensive path.
 *
 * `parallel` resolves independently: opts.parallel, then
 * env.EXPLORE_PARALLEL !== '0', default true. EXPLORE_PARALLEL=0 is the
 * operator escape hatch that forces the pre-existing sequential runChain
 * path (the manual half of the fallback story).
 */
function resolveExploreCostPolicy(env, opts) {
  const e = isPlainObject(env) ? env : {};
  const o = isPlainObject(opts) ? opts : {};

  let mode = 'cost-conscious';
  let reason = 'default cost-conscious (no opts.costMode, no EXPLORE_COST_MODE set)';
  if (typeof o.costMode === 'string' && COST_MODES.indexOf(o.costMode) !== -1) {
    mode = o.costMode;
    reason = 'opts.costMode=' + o.costMode;
  } else if (typeof e.EXPLORE_COST_MODE === 'string' && COST_MODES.indexOf(e.EXPLORE_COST_MODE) !== -1) {
    mode = e.EXPLORE_COST_MODE;
    reason = 'env.EXPLORE_COST_MODE=' + e.EXPLORE_COST_MODE;
  } else if (typeof e.EXPLORE_COST_MODE === 'string' && e.EXPLORE_COST_MODE.length > 0) {
    reason = 'env.EXPLORE_COST_MODE=' + e.EXPLORE_COST_MODE
      + ' was not recognized, defaulted to cost-conscious';
  }

  let parallel = true;
  if (typeof o.parallel === 'boolean') {
    parallel = o.parallel;
  } else if (typeof e.EXPLORE_PARALLEL === 'string') {
    parallel = e.EXPLORE_PARALLEL !== '0';
  }

  const allLegs = FRAMEWORK_LEGS.map((f) => f.leg);
  const otherLegs = allLegs.filter((leg) => leg !== PROBE_LEG);

  return {
    mode: mode,
    parallel: parallel,
    probeLeg: mode === 'cost-conscious' ? PROBE_LEG : null,
    fanLegs: mode === 'cost-conscious' ? otherLegs : allLegs,
    reason: reason,
  };
}

/**
 * probeClears(stepResult) -> boolean
 *
 * Mirrors chain-executor.cjs's quality_early_stop test EXACTLY (see the
 * header comment above PROBE_LEG for the line numbers mirrored): normalize
 * `quality` the same way runChain does (`typeof result.quality === 'string'
 * ? result.quality : null`), then the probe clears unless that normalized
 * value is the LOW_QUALITY string 'low'. If chain-executor.cjs's test ever
 * changes, this helper must change with it.
 */
function probeClears(stepResult) {
  const r = isPlainObject(stepResult) ? stepResult : {};
  const quality = (typeof r.quality === 'string') ? r.quality : null;
  return quality !== 'low';
}

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// D-20 engine-availability seam: the forced test seam + an explicit host
// signal (the host knows the engine legs failed beyond the graceful rungs).
function engineAbsent(opts) {
  if (process.env.MINDRIAN_FORCE_ENGINE_ABSENT === '1') return true;
  return isPlainObject(opts) && opts.engineAbsent === true;
}

/**
 * composeExploreChain() -> { steps, workflow }
 *
 * D-06: framework names -> composeWorkflow -> ordered steps (honest
 * command:null + optional:true degrade preserved verbatim), plus the material
 * filing step appended. Pure; no db, no fs.
 */
function composeExploreChain() {
  const workflow = composeWorkflow(FRAMEWORK_LEGS.map((f) => f.framework));
  const steps = workflow.map((s, i) => ({
    step: s.step,
    framework: s.framework,
    command: s.command,
    optional: s.optional,
    leg: FRAMEWORK_LEGS[i].leg,
    web: FRAMEWORK_LEGS[i].web,
  }));
  steps.push(Object.assign({ step: steps.length + 1, optional: false }, FILING_STEP));
  return { steps: steps, workflow: workflow };
}

// Read an opportunity node's props (read-only; open/close per call).
function readOpportunity(roomDir, nodeId) {
  const db = openRoomDb(roomDir);
  try {
    const row = db.prepare('SELECT id, type, properties FROM nodes WHERE id = ?').get(nodeId);
    if (!row) return null;
    let props = {};
    try { props = JSON.parse(row.properties || '{}'); } catch (_e) { props = {}; }
    return { id: row.id, type: row.type, props: isPlainObject(props) ? props : {} };
  } catch (_e) {
    return null;
  } finally {
    closeRoomDb(db);
  }
}

// Evidence-id fallback chain: explicit opts -> the node's DERIVED_FROM edge
// targets -> the latest stage_history evidence_ids. Read-only.
function resolveEvidenceIds(roomDir, nodeId, props, explicit) {
  if (Array.isArray(explicit) && explicit.length > 0) return explicit.slice();
  const db = openRoomDb(roomDir);
  try {
    const rows = db.prepare("SELECT target FROM edges WHERE source = ? AND type = 'DERIVED_FROM'").all(nodeId);
    if (rows.length > 0) return rows.map((r) => r.target);
  } catch (_e) { /* fall through */ } finally {
    closeRoomDb(db);
  }
  const history = Array.isArray(props.stage_history) ? props.stage_history : [];
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const e = history[i];
    if (e && Array.isArray(e.evidence_ids) && e.evidence_ids.length > 0) return e.evidence_ids.slice();
  }
  return [];
}

// Collect url-cited sources from the web legs' trace outputs.
function collectCitations(trace) {
  const seen = new Set();
  const citations = [];
  for (const entry of trace) {
    const out = entry && entry.chain_output;
    if (!isPlainObject(out) || !Array.isArray(out.findings)) continue;
    for (const f of out.findings) {
      if (!isPlainObject(f) || typeof f.url !== 'string' || f.url.length === 0) continue;
      if (seen.has(f.url)) continue;
      seen.add(f.url);
      citations.push({
        url: f.url,
        accessed: typeof f.accessed === 'string' && f.accessed.length >= 10
          ? f.accessed.slice(0, 10)
          : new Date().toISOString().slice(0, 10),
        title: typeof f.title === 'string' ? f.title : '',
      });
    }
  }
  return citations;
}

// Compose the research corpus body from the chain trace (leg summaries +
// finding titles -- real prose the post-filing extractor can mine).
function composeResearchBody(trace, provenanceLines) {
  const lines = [];
  for (const entry of trace) {
    const out = entry && entry.chain_output;
    if (!isPlainObject(out)) continue;
    const legName = (entry.step && entry.step.leg ? entry.step.leg : 'leg').replace(/_/g, ' ');
    lines.push('## ' + legName);
    lines.push('');
    if (typeof out.summary === 'string' && out.summary.length > 0) {
      lines.push(out.summary);
      lines.push('');
    }
    if (Array.isArray(out.findings)) {
      for (const f of out.findings) {
        if (!isPlainObject(f)) continue;
        const title = typeof f.title === 'string' ? f.title : '';
        const url = typeof f.url === 'string' ? f.url : '';
        const summary = typeof f.summary === 'string' ? f.summary : '';
        lines.push('- ' + [title, summary, url].filter((s) => s.length > 0).join(' :: '));
      }
      lines.push('');
    }
    if (Array.isArray(out.results) && out.results.length > 0) {
      for (const r of out.results) {
        if (!isPlainObject(r)) continue;
        lines.push('- room-corpus: ' + String(r.path || r.node_id || ''));
      }
      lines.push('');
    }
    if (typeof out.provenance === 'string' && out.provenance.length > 0) {
      lines.push('provenance: ' + out.provenance);
      lines.push('');
    }
  }
  for (const p of provenanceLines) {
    lines.push(p);
  }
  return lines.join('\n').trim();
}

/**
 * exploreOpportunity(roomDir, opportunityNodeId, opts) -> Promise<envelope>
 *
 * The ONE explore entry point, invoked ONLY from the explicit
 * commands/explore-opportunity.md surface (never auto-fired on Qualify).
 *
 * opts:
 *   onStep(step, prev)  REQUIRED host leg executor: dispatches each analysis
 *                       leg's command through the framework-runner's existing
 *                       egress chokepoint (D-07); returns
 *                       { chain_output, quality }.
 *   onHalt(step, ctx)   the Tri-Context gate verb collector. At the material
 *                       file_explored gate, 'approve' | 'file' proceeds to
 *                       filing; anything else ends the run with nothing filed.
 *                       Under the D-20 engine-absent halt, ctx.offer carries
 *                       the llm-manual OFFER.
 *   forceOffline        D-16 item 3 test seam: swap the web legs to
 *                       queryRoomCorpus (provenance "web: absent
 *                       (room-corpus degrade)").
 *   manualMode          D-20: the navigator ACCEPTED the llm-manual offer;
 *                       legs execute via onStep (the model's own work) and
 *                       every output is stamped engine_mode
 *                       'llm_manual_baseline'. Never a default.
 *   engineAbsent        host signal mirroring MINDRIAN_FORCE_ENGINE_ABSENT.
 *   topicHandles        generic research handles (default: derived from the
 *                       node's name + lens).
 *   evidenceIds         graph evidence node ids for the >=2 typed evidence
 *                       edges (fallback: DERIVED_FROM targets, then the
 *                       latest stage_history evidence_ids).
 *   sessionId, actor, minto, maxSteps, retries, journal, sleep
 *
 * Returns { ok, trace, completed, haltedAt, research_mode, providers,
 *           engine_mode, filed } -- never throws.
 */
async function exploreOpportunity(roomDir, opportunityNodeId, opts) {
  const options = isPlainObject(opts) ? opts : {};
  try {
    if (typeof roomDir !== 'string' || roomDir.length === 0
      || typeof opportunityNodeId !== 'string' || opportunityNodeId.length === 0) {
      return { ok: false, reason: 'invalid_params' };
    }
    if (typeof options.onStep !== 'function') {
      return { ok: false, reason: 'no_onStep_callback' };
    }

    const node = readOpportunity(roomDir, opportunityNodeId);
    if (!node) return { ok: false, reason: 'opportunity_not_found', node_id: opportunityNodeId };
    const lifecycle = typeof node.props.lifecycle === 'string' ? node.props.lifecycle : null;
    // The chain consumes a QUALIFIED opportunity (re-exploring an explored one
    // updates in place via the problem_hash dedup). A candidate NEVER explores
    // implicitly -- qualification is the human gate that precedes this surface.
    if (lifecycle !== 'qualified' && lifecycle !== 'explored') {
      return { ok: false, reason: 'not_qualified', lifecycle: lifecycle, node_id: opportunityNodeId };
    }

    const name = typeof node.props.name === 'string' && node.props.name.length > 0
      ? node.props.name : opportunityNodeId;
    const topicHandles = (Array.isArray(options.topicHandles) && options.topicHandles.length > 0)
      ? options.topicHandles.filter((t) => typeof t === 'string' && t.length > 0)
      : [name].concat(typeof node.props.lens === 'string' ? [node.props.lens] : []);
    const sessionId = (typeof options.sessionId === 'string' && options.sessionId.length > 0)
      ? options.sessionId : 'explore-chain';
    const actor = (typeof options.actor === 'string' && options.actor.length > 0)
      ? options.actor : 'navigator';

    const absent = engineAbsent(options);
    const manual = options.manualMode === true;
    const forceOffline = options.forceOffline === true;
    // D-20: manual mode is honored ONLY via the explicit opt (the navigator's
    // acceptance of the OFFER at the gate) -- never inferred, never a default.
    const runEngineMode = manual ? MANUAL_ENGINE_MODE : 'engine';

    const { steps } = composeExploreChain();

    // ---- the D-19 envelope accumulators ----
    let webResearchMode = null; // set by the offline degrade / host envelope
    let providers = [];

    // ---- the wrapped onStep: offline degrade + engine_mode stamping ----
    const hostOnStep = options.onStep;
    function wrappedOnStep(step, prev) {
      if (step.web && forceOffline) {
        // D-16 item 3: the web leg's SOURCE swaps to the room's own research
        // corpus. Honest provenance; a cold corpus stays typed and EMPTY.
        const corpus = researchFiling.queryRoomCorpus(roomDir, topicHandles);
        if (step.leg === 'deep_research') {
          webResearchMode = corpus.research_mode;
          providers = providers.concat(Array.isArray(corpus.providers) ? corpus.providers : []);
        }
        return {
          chain_output: {
            leg: step.leg,
            source: 'room-corpus',
            provenance: corpus.provenance,
            research_mode: corpus.research_mode,
            providers: corpus.providers,
            results: corpus.results,
            engine_mode: runEngineMode,
          },
          // A cold corpus is LOW quality: the loop's quality_early_stop ends
          // the chain honestly instead of composing analysis from nothing.
          quality: corpus.results.length > 0 ? 'medium' : 'low',
        };
      }
      const out = hostOnStep(step, prev) || {};
      const co = isPlainObject(out.chain_output) ? out.chain_output : null;
      if (co) {
        co.engine_mode = runEngineMode;
        if (step.leg === 'deep_research') {
          if (typeof co.research_mode === 'string') webResearchMode = co.research_mode;
          if (Array.isArray(co.providers)) providers = providers.concat(co.providers);
        }
      }
      return out;
    }

    // ---- the gate: default makeGateFn semantics + the D-20 engine-absent
    // halt. The material filing step halts via the DEFAULT posture
    // withhold-default (its command is unknown to the registry); the
    // engine-absent branch halts the FIRST engine-backed step so the OFFER is
    // presented BEFORE anything executes silently. ----
    const baseGate = makeGateFn({});
    function gateFn(step, posture, prior) {
      if (absent && !manual && step.leg !== 'file_explored') return 'halt';
      return baseGate(step, posture, prior);
    }

    // ---- the halt handler: decorate with the D-20 OFFER when relevant ----
    const hostOnHalt = typeof options.onHalt === 'function' ? options.onHalt : null;
    const offer = (absent && !manual)
      ? {
        verb: OFFER_VERB,
        engine_mode: MANUAL_ENGINE_MODE,
        note: 'Engine unavailable for this step. OFFER: the model performs the analysis '
          + 'manually via the frozen deep_research reach + native web tools (same Part 8 '
          + 'handles). Output is labeled engine_mode ' + MANUAL_ENGINE_MODE
          + ' and EXCLUDED from calibration sets. Never the default, never silent.',
      }
      : null;
    function onHalt(step, contexts) {
      const ctx = Object.assign({}, contexts || {});
      if (offer && step.leg !== 'file_explored') ctx.offer = offer;
      if (!hostOnHalt) return 'defer';
      try { return hostOnHalt(step, ctx); } catch (_e) { return 'defer'; }
    }

    // ---- run the ONE shared gated loop (resilient path: roomDir engages the
    // journal-capable async runner; posture defaults to recipe-maps). ----
    const run = await runChain(steps, {
      onStep: wrappedOnStep,
      onHalt: onHalt,
      gateFn: gateFn,
      roomDir: roomDir,
      journal: options.journal === true,
      retries: typeof options.retries === 'number' ? options.retries : 0,
      sleep: typeof options.sleep === 'function' ? options.sleep : undefined,
      maxSteps: typeof options.maxSteps === 'number' ? options.maxSteps : undefined,
    });

    // Decorate the halt with the OFFER so the surface renders it at the gate.
    if (run.haltedAt && offer && run.haltedAt.step && run.haltedAt.step.leg !== 'file_explored') {
      run.haltedAt.offer = offer;
    }

    // ---- compose the run-level D-19 envelope ----
    let researchMode = webResearchMode;
    if (!researchMode) {
      const deepLeg = run.trace.find((t) => t.step && t.step.leg === 'deep_research' && t.chain_output);
      const hasFindings = !!(deepLeg && Array.isArray(deepLeg.chain_output.findings)
        && deepLeg.chain_output.findings.length > 0);
      researchMode = deepLeg ? (hasFindings ? 'normal' : 'insufficient_evidence') : null;
    }

    // ---- the material filing: ONLY on the navigator's approve verb at the
    // file_explored gate (Part 3; D-17; D-16 items 1+2; D-21 nesting). ----
    let filed = null;
    const haltedAtFiling = !!(run.haltedAt && run.haltedAt.step && run.haltedAt.step.leg === 'file_explored');
    const approved = haltedAtFiling && APPROVE_VERBS.indexOf(String(run.haltedAt.verb || '').toLowerCase()) !== -1;
    if (approved) {
      const citations = collectCitations(run.trace);
      const provenanceLines = [];
      if (forceOffline) provenanceLines.push('', researchFiling.OFFLINE_PROVENANCE);
      const body = 'Opportunity: ' + name + '\n\n'
        + composeResearchBody(run.trace, provenanceLines);

      // (1) D-16 item 1: the research corpus artifact.
      const research = researchFiling.fileResearchArtifact(roomDir, {
        topicHandles: topicHandles,
        body: body,
        sources: citations.map((c) => ({ url: c.url, accessed: c.accessed })),
        engineMode: runEngineMode === MANUAL_ENGINE_MODE ? MANUAL_ENGINE_MODE : undefined,
        researchMode: researchMode && researchMode !== 'normal' ? researchMode : undefined,
      });
      if (!research.ok) {
        return Object.assign(run, {
          ok: false, reason: 'research_filing_failed', detail: research.reason,
          research_mode: researchMode, providers: providers, engine_mode: runEngineMode, filed: null,
        });
      }

      // (2) the Minto explored artifact (Task 4 writer): nested filing +
      // evidence edges + the D-17 explored transition. Its own extraction is
      // deferred to the ONE combined scoped pass below.
      const evidenceIds = resolveEvidenceIds(roomDir, opportunityNodeId, node.props, options.evidenceIds);
      // eslint-disable-next-line global-require
      const exploredArtifact = require('./explored-artifact.cjs');
      const db = openRoomDb(roomDir);
      let explored;
      try {
        explored = await exploredArtifact.composeExploredArtifact({
          roomDir: roomDir,
          db: db,
          opportunityNodeId: opportunityNodeId,
          chainTrace: run.trace,
          citations: citations,
          sessionId: sessionId,
          actor: actor,
          engineMode: runEngineMode,
          evidenceIds: evidenceIds,
          researchArtifactNodeId: research.node_id,
          minto: isPlainObject(options.minto) ? options.minto : null,
          postFilingExtraction: false, // ONE combined scoped pass below (D-05)
        });
      } finally {
        closeRoomDb(db);
      }
      if (!explored || explored.ok !== true) {
        return Object.assign(run, {
          ok: false,
          reason: 'explored_filing_failed',
          detail: explored && (explored.reason || 'invariant_violations'),
          violations: explored && explored.violations,
          research_mode: researchMode, providers: providers, engine_mode: runEngineMode,
          filed: { research: research, explored: null },
        });
      }

      // (3) D-16 item 2: ONE scoped post-filing extraction over BOTH new
      // artifacts (never a full-room re-extract), after the write handle
      // closed (218 D-05 single-writer discipline).
      const extraction = await researchFiling.runPostFilingExtraction(
        roomDir, sessionId, [research.relPath, explored.relPath]
      );

      filed = { research: research, explored: explored, extraction: extraction };
    }

    const envelope = {
      ok: true,
      trace: run.trace,
      completed: run.completed,
      haltedAt: run.haltedAt,
      partial: run.partial === true,
      research_mode: researchMode,
      providers: providers,
      engine_mode: runEngineMode,
      filed: filed,
    };
    // Phase 221-04 (D-02 seam alignment, ADDITIVE): the full typed
    // stage-envelope view + the annex-6 disclosure ride alongside every
    // landed 219-05 field (nothing renamed, nothing removed). Lazy require +
    // degrade-to-landed-shape (the driverSeam defensive idiom).
    try {
      // eslint-disable-next-line global-require
      const rs = require('../recovery/result-semantics.cjs');
      envelope.stage_envelopes = rs.envelopesFromProviders(providers);
      envelope.disclosure = rs.composeRecoveryResult({
        envelopes: envelope.stage_envelopes,
        dispatch: null,
        recovery: null,
        ctx: { requestedScope: topicHandles, base_research_mode: researchMode },
      }).disclosure;
    } catch (_e) { /* additive only */ }
    return envelope;
  } catch (e) {
    return { ok: false, reason: 'explore_threw', detail: String(e && e.message || '').slice(0, 120) };
  }
}

module.exports = {
  exploreOpportunity,
  composeExploreChain,
  FRAMEWORK_LEGS,
  OFFER_VERB,
  MANUAL_ENGINE_MODE,
  APPROVE_VERBS,
  // Phase 265-18 (RADAR-26): the probe-first cost guard.
  resolveExploreCostPolicy,
  probeClears,
  PROBE_LEG,
  COST_MODES,
};
