'use strict';

/*
 * MindrianOS Plugin -- the inter-hat DEBATE composition seam (Phase 164 Wave 5).
 *
 * THE KEYSTONE SEAM (164-RESEARCH A/H, D-164-S1/S2/S3/S5): runDebate takes the
 * collected PARALLEL cell array from Wave 4 (the parallel cell fan-out module)
 * and hands it into the SEQUENTIAL debate runChain (Phase 166
 * chain-executor.cjs) as the per-step previousOutput. The fan-out stays parallel;
 * the debate stays sequential (D-164-S2). The collected cells are NOT re-fetched
 * inside runChain -- runDebate NEVER re-runs the parallel fan-out (the seam is
 * one-way: cells in as data, never a nested fan-out dispatch).
 *
 * The debate is a runChain STEP SEQUENCE over a graph-proposed "what if"
 * hypothesis:
 *   1. a hypothesis-confirm step (material: the navigator confirms/edits the
 *      graph-proposed what-if at the Part 3 Decision Gate -- gate HALTS),
 *   2. one per-hat argument step per hat (autonomous_safe: the consolidator argues
 *      that hat's stance over ITS slice of the collected cells -- the cells ARE the
 *      previousOutput, never re-fetched),
 *   3. a ruling step (material: emits a ruling verb in
 *      {supported,rejected,refined,undecided} + a residual-tension record -- gate
 *      HALTS),
 *   4. a residual-tension filing step.
 * postureFn reads the SHIPPED recipe-maps manifest (postureForCommand); gateFn the
 * SHIPPED makeGateFn so it HALTS at the two material Part 3 Decision Gates;
 * onStep dispatches the consolidator -- a hat slot with a confirmed SyntheticExpert
 * (Wave 2 expertsByHat) makes THAT expert the onStep target, else a freshly
 * generated consolidator; provenanceFn stamps each step (pipeline-state idiom);
 * selfCritiqueFn rides material steps (fable-mode layer 2, the debate-side half).
 *
 * COMPOSE ON THE 169-SHIPPED SUBSTRATE (the HIGH reuse mandate, Canon Part 7).
 * 164-05 does NOT roll its own derivation loop and does NOT call the navigation
 * edge-writer directly (every edge flows through the two shipped substrates below):
 *   - the per-step DERIVED relationships (a per-hat CONVERGES / CONTRADICTS /
 *     REFINES / ROOT_CAUSES claim about the hypothesis) ride
 *     lib/core/graph-derivation.cjs::runDerivation (proposed truth-claim NODE +
 *     frozen CASCADE_SUBSET edge, fable-mode-critiqued, idempotent); runDerivation
 *     is passed {roomDir, runChain, selfCritiqueFn, deriveFn, artifactPairs}, so
 *     each derived relationship is a material runChain step AND each candidate is
 *     fable-mode-critiqued before it becomes a proposed node (fable-mode layer 2,
 *     the derivation-side half). The deriveFn adapts the debate pairs into
 *     candidate tuples via graph-derivation.candidateToFinding.
 *   - the confirmed RULING + each residual TENSION route through
 *     lib/core/findings-wirer.cjs::wireAccept (proposed EvidenceClaim NODE then
 *     INFORMS/CONTRADICTS/SUPERSEDES edge via the navigation chokepoint;
 *     review_status on the NODE, Part 9 role 5); a REJECT routes through wireReject
 *     carrying the reason as REJECTED_BECAUSE graph data (Part 4).
 * The ONLY net-new in this wave is the COMPOSITION (the step-sequence builder).
 * The derivation loop, the proposed-node-then-edge pattern, the frozen
 * CASCADE_SUBSET, the idempotence guard, and the fable-mode critique seam are
 * CONSUMED from the 169-shipped modules.
 *
 * Incremental filing (D-164-S5): each pipeline step journals via
 * lib/mcp/pipeline-state.cjs initChain/recordStep BEFORE the next runs, so a
 * crashed run resumes from the cursor without re-running completed steps -- the
 * checkPosition isNext HARD gate (pipeline-state.cjs:210-239) prevents the re-run.
 *
 * Canon Part 8: zero Brain egress. The composition opens NO Brain wire; the only
 * outward leg is the consolidator's onStep dispatch (generic handles only), and the
 * graph writes are LOCAL room.db through the navigation chokepoint.
 * Canon Part 9: every derived relationship + the ruling land as PROPOSED nodes;
 * the human confirms at the Decision Gate (the gate HALTS, never auto-confirms).
 *
 * Pure Node.js built-ins + the shipped runChain / graph-derivation / findings-wirer
 * / pipeline-state modules. Zero npm deps. No emoji. No em-dashes.
 */

const chainExecutor = require('../chain-executor.cjs');
const graphDerivation = require('../graph-derivation.cjs');
const findingsWirer = require('../findings-wirer.cjs');
const pipelineState = require('../../mcp/pipeline-state.cjs');

// The closed ruling-verb vocabulary the ruling step emits (164-CONTEXT D-164-S1).
const RULING_VERBS = Object.freeze(['supported', 'rejected', 'refined', 'undecided']);

// The two MATERIAL Part 3 Decision Gate step kinds (the gateFn HALTS at these).
// Every other step kind (the per-hat arguments, the tension-filing) is
// autonomous_safe and auto-runs between the gates.
const HYPOTHESIS_STEP = 'bono-hypothesis-confirm';
const RULING_STEP = 'bono-ruling';

// The per-hat argument step command prefix + the residual-tension filing step.
const ARGUMENT_STEP_PREFIX = 'bono-argument-';
const TENSION_STEP = 'bono-residual-tension';

// The chain name the journal + provenanceFn stamp under.
const DEBATE_CHAIN_NAME = 'bono-debate';

/**
 * Build the ordered debate STEP SEQUENCE for runChain. Each step carries:
 *   { step, command, hat?, material?, irreversible:false }
 * The two material steps (hypothesis-confirm + ruling) carry material:true so the
 * SHIPPED makeGateFn HALTS at them (the per-hat arguments + tension-filing carry
 * material:false / absent so they auto-run when their posture is push_forward).
 *
 * @param {string[]} hats - the de Bono hats (one argument step per hat)
 * @returns {Object[]} the ordered step list
 */
function buildSteps(hats) {
  const list = Array.isArray(hats) ? hats.filter((h) => typeof h === 'string') : [];
  const steps = [];
  let n = 0;

  // 1. hypothesis-confirm (MATERIAL: the navigator confirms/edits the what-if).
  steps.push({ step: n, command: HYPOTHESIS_STEP, material: true, irreversible: false });
  n += 1;

  // 2. one per-hat argument step (autonomous_safe: argues over ITS cell slice).
  for (const hat of list) {
    steps.push({
      step: n,
      command: ARGUMENT_STEP_PREFIX + hat.toLowerCase(),
      hat: hat,
      material: false,
      irreversible: false,
    });
    n += 1;
  }

  // 3. ruling (MATERIAL: emits the ruling verb + the residual-tension record).
  steps.push({ step: n, command: RULING_STEP, material: true, irreversible: false });
  n += 1;

  // 4. residual-tension filing (autonomous_safe).
  steps.push({ step: n, command: TENSION_STEP, material: false, irreversible: false });

  return steps;
}

// Resolve the consolidator for a hat slot. A hat with a confirmed SyntheticExpert
// (Wave 2 expertsByHat) makes THAT expert the consolidator; otherwise a freshly
// generated consolidator handle. This is the onStep dispatch target (D-164-S1).
function consolidatorForHat(hat, expertsByHat) {
  const map = (expertsByHat && typeof expertsByHat === 'object') ? expertsByHat : {};
  const expert = map[hat];
  if (expert && typeof expert === 'object') {
    return { source: 'synthetic-expert', hat: hat, expert: expert };
  }
  return { source: 'generated', hat: hat, expert: null };
}

// Slice the collected cells for a hat (the per-hat argument step argues over ITS
// slice of the collected cells; the cells are the previousOutput, never re-fetched).
function cellsForHat(cells, hat) {
  const list = Array.isArray(cells) ? cells : [];
  return list.filter((c) => c && c.hat === hat);
}

/**
 * The DEFAULT onStep consolidator dispatch. For a per-hat argument step it returns
 * a structured argument over the hat's cell slice; for the hypothesis / ruling /
 * tension steps it returns the step's structured output. Injected dispatchers (a
 * confirmed SyntheticExpert) override per-hat via expertsByHat; the dispatch never
 * crosses to Brain (Part 8: generic stance metadata only).
 *
 * Returns { chain_output, quality } per the runChain onStep contract.
 */
function defaultConsolidate(step, previousOutput, ctx) {
  const cmd = step && step.command;
  if (cmd === HYPOTHESIS_STEP) {
    return {
      chain_output: { kind: 'hypothesis', hypothesis: ctx.hypothesis, cells: ctx.cells },
      quality: 'high',
    };
  }
  if (cmd === RULING_STEP) {
    // The ruling step collapses the per-hat arguments into a ruling verb + a
    // residual-tension record. The default is a conservative 'undecided' unless a
    // caller-supplied rulingFn shapes a verb; the consolidator IS the onStep target.
    const verb = (typeof ctx.rulingVerb === 'string' && RULING_VERBS.includes(ctx.rulingVerb))
      ? ctx.rulingVerb
      : 'undecided';
    return {
      chain_output: { kind: 'ruling', verb: verb, residual_tension: ctx.residualTension || null },
      quality: 'high',
    };
  }
  if (cmd === TENSION_STEP) {
    return { chain_output: { kind: 'tension', filed: true }, quality: 'high' };
  }
  // A per-hat argument step: the consolidator argues that hat's stance over ITS
  // slice of the collected cells (the previousOutput carries the prior step).
  const hat = step && step.hat;
  const slice = cellsForHat(ctx.cells, hat);
  const consolidator = consolidatorForHat(hat, ctx.expertsByHat);
  return {
    chain_output: {
      kind: 'argument',
      hat: hat,
      consolidator: consolidator,
      cell_count: slice.length,
    },
    quality: 'high',
  };
}

/**
 * Build the debate artifactPairs runDerivation drives the deriveFn over. Each pair
 * is the hypothesis paired with one per-hat argument so runDerivation can produce a
 * per-hat CONVERGES / CONTRADICTS / REFINES / ROOT_CAUSES claim ABOUT the
 * hypothesis. The pairs carry only generic node-id handles (Part 8: never the
 * venture body) -- the hypothesis id + the per-hat argument id.
 */
function buildArtifactPairs(hypothesisId, hats) {
  const list = Array.isArray(hats) ? hats.filter((h) => typeof h === 'string') : [];
  return list.map((hat) => ({
    a: hypothesisId,
    b: 'argument:' + String(hat).toLowerCase(),
    hat: hat,
  }));
}

/**
 * runDebate(opts) -> the debate result.
 *
 * opts:
 *   cells          the Wave-4 collected cell array (the previousOutput seed) -- NOT re-fetched
 *   hypothesis     the graph-proposed "what if" hypothesis (string / object)
 *   hypothesisId   the hypothesis node id (the runDerivation pair anchor; default 'claim:hypothesis')
 *   hats           the de Bono hats (one argument step per hat)
 *   roomDir        the room for the journal + the graph writes
 *   expertsByHat   { hat: confirmedSyntheticExpert } (Wave 2) -- a slotted expert IS the onStep consolidator
 *   db             the caller-owned room.db handle (the wireAccept / wireReject target)
 *   sessionId      the session id stamped on the proposed nodes + journal
 *   rulingVerb     optional explicit ruling verb (default 'undecided')
 *   ruling         the ruling finding/decision the wirer files (wireAccept) on APPROVE
 *   residualTension the residual-tension finding/decision (wireAccept / wireReject)
 *   rulingApproved true => wireAccept the ruling; false => wireReject (REJECTED_BECAUSE)
 *
 *   --- injectable seams (production defaults require the shipped modules) ---
 *   runChainFn       default chain-executor.runChain
 *   runDerivationFn  default graph-derivation.runDerivation
 *   wireAcceptFn     default findings-wirer.wireAccept
 *   wireRejectFn     default findings-wirer.wireReject
 *   deriveFn         the runDerivation producer (default a candidateToFinding adapter)
 *   selfCritiqueFn   fable-mode layer 2 (rides material steps AND runDerivation)
 *   onStep           the consolidator dispatch (default defaultConsolidate)
 *   gateFn / postureFn / onHalt   the runChain gate seams (default the shipped makeGateFn idiom)
 *   journalFns       { initChain, recordStep, checkPosition } (default pipeline-state)
 *
 * Returns:
 *   { synthesis, ruling, residualTension, gateDecision, chain, derivation, wired, steps }
 *   The terminal synthesis is RETURNED (not filed to solution-design/ here -- the
 *   command files it on navigator APPROVE, Task 2).
 */
function runDebate(opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};

  const cells = Array.isArray(o.cells) ? o.cells : [];
  const hypothesis = (o.hypothesis !== undefined) ? o.hypothesis : null;
  const hypothesisId = (typeof o.hypothesisId === 'string' && o.hypothesisId.length > 0)
    ? o.hypothesisId
    : 'claim:hypothesis';
  const hats = Array.isArray(o.hats) ? o.hats.filter((h) => typeof h === 'string') : [];
  const roomDir = (typeof o.roomDir === 'string') ? o.roomDir : '';
  const expertsByHat = (o.expertsByHat && typeof o.expertsByHat === 'object') ? o.expertsByHat : {};
  const db = o.db || null;
  const sessionId = (typeof o.sessionId === 'string' && o.sessionId.length > 0) ? o.sessionId : 'bono-debate';

  // Injectable seams (production defaults are the SHIPPED 169 substrate modules).
  const runChainFn = (typeof o.runChainFn === 'function') ? o.runChainFn : chainExecutor.runChain;
  const runDerivationFn = (typeof o.runDerivationFn === 'function') ? o.runDerivationFn : graphDerivation.runDerivation;
  const wireAcceptFn = (typeof o.wireAcceptFn === 'function') ? o.wireAcceptFn : findingsWirer.wireAccept;
  const wireRejectFn = (typeof o.wireRejectFn === 'function') ? o.wireRejectFn : findingsWirer.wireReject;
  const selfCritiqueFn = (typeof o.selfCritiqueFn === 'function') ? o.selfCritiqueFn : null;
  const onStepInjected = (typeof o.onStep === 'function') ? o.onStep : null;
  const gateFnInjected = (typeof o.gateFn === 'function') ? o.gateFn : null;
  const postureFn = (typeof o.postureFn === 'function') ? o.postureFn : null;
  const onHalt = (typeof o.onHalt === 'function') ? o.onHalt : null;
  const journalFns = (o.journalFns && typeof o.journalFns === 'object') ? o.journalFns : pipelineState;

  // The runDerivation producer (deriveFn). It adapts the debate hypothesis/argument
  // pairs into candidate tuples that ride graph-derivation.candidateToFinding, then
  // runDerivation drives THIS producer over the pairs as material steps (fable-mode
  // layer 2, the derivation-side half) and writes the survivors as proposed NODES +
  // frozen CASCADE_SUBSET edges. The caller may inject a deriveFn; the default emits
  // a per-hat CONVERGES claim about the hypothesis (the conservative debate default).
  const deriveFn = (typeof o.deriveFn === 'function')
    ? o.deriveFn
    : function defaultDeriveFn(args) {
        const pair = (args && args.artifactPair) ? args.artifactPair : null;
        if (!pair) return [];
        // A per-hat derived relationship ABOUT the hypothesis. The default verb is
        // CONVERGES (the argument converges on the hypothesis); a richer producer
        // shapes CONTRADICTS / REFINES / ROOT_CAUSES. The reason is a short scalar.
        return [{
          source: pair.b,
          target: pair.a,
          edge_type: 'CONVERGES',
          reason: 'hat ' + String(pair.hat || '') + ' argument bears on the hypothesis',
        }];
      };

  // ---- THE STEP SEQUENCE ----
  const steps = buildSteps(hats);

  // ---- INCREMENTAL FILING: journal the chain BEFORE the first step (D-164-S5) ----
  // initChain seeds the SOLE chain-state truth (pipeline-state.json) with the
  // ordered step commands so checkPosition's isNext HARD gate can prevent a re-run
  // on resume. A missing roomDir / journalFns degrades to a journalless run.
  const stepCommands = steps.map((s) => s.command);
  let journaled = false;
  if (roomDir && journalFns && typeof journalFns.initChain === 'function') {
    try {
      journalFns.initChain(roomDir, stepCommands, 'bono-debate');
      journaled = true;
    } catch (_e) { journaled = false; }
  }

  // ---- THE onStep CONSOLIDATOR DISPATCH ----
  // For a hat slot with a confirmed SyntheticExpert, THAT expert IS the onStep
  // target (consolidatorForHat resolves it). The default consolidate shapes the
  // step output; the journal records each COMPLETED step BEFORE the next runs.
  const consolidateCtx = {
    cells: cells,
    hypothesis: hypothesis,
    expertsByHat: expertsByHat,
    rulingVerb: o.rulingVerb,
    residualTension: o.residualTension,
  };
  function onStep(step, previousOutput) {
    let result;
    if (onStepInjected) {
      result = onStepInjected(step, previousOutput, consolidateCtx);
    } else {
      result = defaultConsolidate(step, previousOutput, consolidateCtx);
    }
    // Journal this step BEFORE the next runs (incremental filing, crash-resilient).
    if (journaled && roomDir && journalFns && typeof journalFns.recordStep === 'function') {
      try {
        journalFns.recordStep(roomDir, step.command, 'chain-output:' + step.command);
      } catch (_e) { /* journal is best-effort; the chain output is the truth */ }
    }
    return result;
  }

  // ---- THE gateFn: HALT at the two material Part 3 Decision Gates ----
  // The SHIPPED makeGateFn already halts a material step (its posture is not
  // push_forward). We supply a postureFn that maps the per-hat argument + tension
  // steps to push_forward (autonomous_safe) and the two material steps to halt, so
  // the gate auto-runs the arguments and HALTS at hypothesis-confirm + ruling.
  function defaultPostureFn(command) {
    if (command === HYPOTHESIS_STEP || command === RULING_STEP) {
      return { command: command, autonomous_safe: false, posture: 'halt' };
    }
    return { command: command, autonomous_safe: true, posture: 'run' };
  }
  const resolvedPostureFn = postureFn || defaultPostureFn;
  const gateFn = gateFnInjected || chainExecutor.makeGateFn({ postureFn: resolvedPostureFn });

  // provenanceFn stamps each step (the pipeline-state idiom). makeProvenanceFn
  // returns a (step, result) -> { pipeline, pipeline_stage } stamp.
  const provenanceFn = (journalFns && typeof journalFns.makeProvenanceFn === 'function')
    ? journalFns.makeProvenanceFn(DEBATE_CHAIN_NAME)
    : null;

  // The onHalt verb at the two material gates. The default DEFERS (the navigator
  // confirms/edits at the real Decision Gate; the command surface renders it). A
  // caller-injected onHalt drives the test seam.
  const resolvedOnHalt = onHalt || function () { return 'defer'; };

  // ---- RUN THE SEQUENTIAL DEBATE (the seam: cells in as previousOutput) ----
  // The collected cells are the seed previousOutput; the fan-out is NOT re-run
  // inside runChain (runDebate NEVER re-runs the parallel fan-out -- D-164-S2). The chain
  // halts at the first material gate (hypothesis-confirm) per Canon Part 3.
  const chain = runChainFn(steps, {
    postureFn: resolvedPostureFn,
    gateFn: gateFn,
    onStep: onStep,
    provenanceFn: provenanceFn,
    onHalt: resolvedOnHalt,
    selfCritiqueFn: selfCritiqueFn,
    seedPreviousOutput: { kind: 'cells', cells: cells },
  });

  // ---- THE DERIVED RELATIONSHIPS RIDE runDerivation (NOT a hand-rolled loop) ----
  // Each per-hat argument that bears on the hypothesis becomes a material runDerivation
  // step; runDerivation fable-mode-critiques each candidate (layer 2, the
  // derivation-side half) and writes the survivors as PROPOSED truth-claim NODES +
  // frozen CASCADE_SUBSET edges via the navigation chokepoint. We pass runChain so
  // each derived relationship is itself a material runChain step (the injected
  // composer), and the SAME selfCritiqueFn so the critique compounds.
  const artifactPairs = buildArtifactPairs(hypothesisId, hats);
  let derivation = { proposedNodes: [], edges: [], trace: [] };
  try {
    derivation = runDerivationFn({
      roomDir: roomDir,
      runChain: runChainFn,
      selfCritiqueFn: selfCritiqueFn,
      deriveFn: deriveFn,
      artifactPairs: artifactPairs,
      sessionId: sessionId,
    }) || derivation;
  } catch (_e) {
    derivation = { proposedNodes: [], edges: [], trace: [] };
  }

  // ---- THE RULING + RESIDUAL TENSION RIDE wireAccept / wireReject ----
  // The composition NEVER calls the navigation edge-writer directly: the confirmed ruling
  // (and each residual tension) routes through findings-wirer.wireAccept (proposed
  // EvidenceClaim NODE then INFORMS/CONTRADICTS/SUPERSEDES edge via the chokepoint).
  // A REJECT routes through wireReject carrying the reason as REJECTED_BECAUSE
  // graph data (Part 4). The wirer takes the caller-owned db handle.
  const wired = { ruling: null, tension: null };
  const rulingApproved = (o.rulingApproved !== false); // default APPROVE the ruling.
  if (db) {
    const rulingFinding = (o.ruling && typeof o.ruling === 'object') ? o.ruling : null;
    if (rulingFinding) {
      try {
        if (rulingApproved) {
          wired.ruling = wireAcceptFn(db, {
            finding: rulingFinding.finding || rulingFinding,
            decision: rulingFinding.decision || { target_section: 'solution-design' },
            roomDir: roomDir,
            sessionId: sessionId,
            topic: rulingFinding.topic,
          });
        } else {
          wired.ruling = wireRejectFn(db, {
            finding: rulingFinding.finding || rulingFinding,
            reason: rulingFinding.reason || 'ruling_rejected',
            decision: rulingFinding.decision || { target_section: 'solution-design' },
            roomDir: roomDir,
            sessionId: sessionId,
            topic: rulingFinding.topic,
          });
        }
      } catch (_e) { wired.ruling = { ok: false, reason: 'wire_threw' }; }
    }

    const tensionFinding = (o.residualTension && typeof o.residualTension === 'object') ? o.residualTension : null;
    if (tensionFinding) {
      try {
        // A residual tension that CONTRADICTS the ruling is a REJECT-with-reason
        // (REJECTED_BECAUSE); an accepted tension files as an INFORMS finding.
        if (tensionFinding.rejected === true) {
          wired.tension = wireRejectFn(db, {
            finding: tensionFinding.finding || tensionFinding,
            reason: tensionFinding.reason || 'residual_tension',
            decision: tensionFinding.decision || { target_section: 'solution-design' },
            roomDir: roomDir,
            sessionId: sessionId,
            topic: tensionFinding.topic,
          });
        } else {
          wired.tension = wireAcceptFn(db, {
            finding: tensionFinding.finding || tensionFinding,
            decision: tensionFinding.decision || { target_section: 'solution-design' },
            roomDir: roomDir,
            sessionId: sessionId,
            topic: tensionFinding.topic,
          });
        }
      } catch (_e) { wired.tension = { ok: false, reason: 'wire_threw' }; }
    }
  }

  // The terminal synthesis is RETURNED (not filed to solution-design/ here -- the
  // command files it on navigator APPROVE, Task 2). It carries the gate decision so
  // the command knows whether the navigator confirmed the hypothesis + the ruling.
  const synthesis = {
    hypothesis: hypothesis,
    hats: hats,
    cell_count: cells.length,
    ruling_verb: (typeof o.rulingVerb === 'string' && RULING_VERBS.includes(o.rulingVerb)) ? o.rulingVerb : 'undecided',
    derived_count: Array.isArray(derivation.proposedNodes) ? derivation.proposedNodes.length : 0,
  };

  return {
    synthesis: synthesis,
    ruling: wired.ruling,
    residualTension: wired.tension,
    gateDecision: chain && chain.haltedAt ? chain.haltedAt : null,
    chain: chain,
    derivation: derivation,
    wired: wired,
    steps: steps,
    journaled: journaled,
  };
}

module.exports = {
  runDebate: runDebate,
  buildSteps: buildSteps,
  buildArtifactPairs: buildArtifactPairs,
  consolidatorForHat: consolidatorForHat,
  cellsForHat: cellsForHat,
  defaultConsolidate: defaultConsolidate,
  RULING_VERBS: RULING_VERBS,
  HYPOTHESIS_STEP: HYPOTHESIS_STEP,
  RULING_STEP: RULING_STEP,
  ARGUMENT_STEP_PREFIX: ARGUMENT_STEP_PREFIX,
  TENSION_STEP: TENSION_STEP,
};
