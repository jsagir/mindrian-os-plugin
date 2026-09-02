#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 122-04 -- /mos:act --chain CLI helper (the autonomy gate)
 * ==============================================================
 * The script behind commands/act.md's --chain mode. It: picks the framework
 * chain for the room state via lib/workflow/chain-source.cjs::resolveChainSource
 * (Phase 254, WIRE-03, D-03 blend-never-replace) -- projection-first, the
 * shipped multi-hop projection recommender (lib/workflow/local-chain-recommender.cjs)
 * wins when it has an edge for the seed, falling through to today's registry-
 * composed answer (lib/brain/chain-recommender.cjs recommendFrameworkChain --
 * FEEDS_INTO traversal over framework names + problem-type enums; Canon Part
 * 8: never a command string, never user content) as a disclosed floor when it
 * does not -- the SAME seam /mos:suggest-next calls, so the two structurally
 * cannot disagree. Composes that chain into a /mos: command sequence via the resolver
 * (lib/workflow/command-resolver.cjs composeWorkflow -- the only door), calls
 * validateChainAutonomy(workflow) FIRST, then walks the steps in order: at the
 * FIRST step whose command is not autonomous_safe: true (or whose framework has
 * no /mos: command at all), it STOPS and renders a "needs you here" gate (a
 * Shape F.0 / E action report) instead of running it. autonomous_safe steps
 * before that point are listed as "would run" -- this helper does not itself
 * dispatch the framework-runner agent; the /mos:act command body does that for
 * the steps this helper greenlights, and stops where this helper says to stop.
 *
 * Larry NEVER names a /mos: command from memory: every command line here came
 * back from composeWorkflow / the generated data/command-registry.json, and
 * every autonomy decision came back from validateChainAutonomy /
 * data/command-registry.json's autonomous_safe field.
 *
 * Usage:
 *   node scripts/act-command.cjs --chain
 *   node scripts/act-command.cjs --chain --problem-type ill-defined
 *   node scripts/act-command.cjs --chain --from-framework "Six Thinking Hats"
 *   node scripts/act-command.cjs --chain --room /path/to/room
 *
 * Without --chain this helper prints a one-line note (single / swarm / dry-run
 * are the command body's job) and exits 0.
 *
 * Three-surface compatible: pure CJS, node built-ins only, zero network here
 * (the Brain query, if any, is the recommender's FEEDS_INTO traversal through
 * the existing brain-client chokepoint -- not this script's surface).
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const resolver = require(path.join(REPO_ROOT, 'lib', 'workflow', 'command-resolver.cjs'));
// Phase 254 / WIRE-03 / D-03: the ONE shared chain-source seam --
// projection-first with a disclosed registry floor. Both /mos:act --chain
// and /mos:suggest-next call this same function so they cannot disagree.
const chainSource = require(path.join(REPO_ROOT, 'lib', 'workflow', 'chain-source.cjs'));
// Phase 121.5-10 Sub-plan K (audit Section 5.3 second-highest leverage):
// promote /mos:act --chain [GATE] from BESPOKE bracket text to F.0 Mini
// Decision Gate via pickShape. The locked [■ BRAIN] chip lands on the
// gate header; the F.0 closed vocabulary (Approve / Reject / Defer)
// replaces the bespoke [continue] / [stop] brackets.
const dispatcher = require(path.join(REPO_ROOT, 'lib', 'hmi', 'selector-dispatcher.cjs'));

// Phase 166-04 (Wave 4 MIGRATE): act was the DONOR the runChain spine was
// extracted from (Wave 2). This wave repoints act ONTO the spine: the walk that
// used to live in this file's planChainRun loop now lives in
// lib/core/chain-executor.cjs runChain. act composes the chain (recommender +
// resolver, unchanged) then DELEGATES the walk to runChain, supplying act's
// callbacks only -- postureFn (recipe-maps.postureForCommand, the ONE posture
// authority, Wave 1), the default gateFn, an onStep recording the would-run step
// the way planChainRun did, an onHalt rendering the existing F.0 gate, and
// provenanceFn:null (act is not the pipeline). act owns no loop and
// re-implements no posture (D-166-04).
const chainExecutor = require(path.join(REPO_ROOT, 'lib', 'core', 'chain-executor.cjs'));
const recipeMaps = require(path.join(REPO_ROOT, 'lib', 'core', 'recipe-maps.cjs'));

// Phase 172-08 (CIRS R4 / INV-18): the REAL navigation-engine decide() is the ONE
// governed selection authority. act feeds it as runChain's decideFn so each chain
// step's next-reach derivation comes from the SAME spine the pipeline and the engine
// consume -- act runs NO second, ungoverned selection brain (the prior
// decideFn: () => null was that second brain; it is gone). Lazy-required with a
// graceful try/catch so a load failure degrades the per-step decision to a null
// handle (exactly the pre-172-08 no-op behavior) and never crashes the gate render.
// decide() reads LOCAL context only and opens no new Brain wire (Canon Part 11 R7 /
// Part 8: feeding decide() as decideFn opens no Brain egress).
let _navEngineDecide = null; // null=untried, false=absent, function=loaded
function loadRealDecide() {
  if (_navEngineDecide !== null) return _navEngineDecide;
  try {
    const mod = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation-engine.cjs'));
    _navEngineDecide = (mod && typeof mod.decide === 'function') ? mod.decide : false;
  } catch (_e) {
    _navEngineDecide = false;
  }
  return _navEngineDecide;
}

// Phase 129-04: navigation.cjs is the ONLY door to room.db for this script (it
// is NOT substrate-guard allow-listed). Lazy-required with a graceful try/catch
// so a navigation load failure degrades the workflow_stage emission to a no-op
// and never affects the rendered /mos:act --chain gate output.
let _navigation = null; // null=untried, false=absent, object=loaded
function tryLoadNavigation() {
  if (_navigation !== null) return _navigation;
  try {
    const mod = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
    _navigation = (mod && typeof mod.logWorkflowStage === 'function') ? mod : false;
  } catch (_) { _navigation = false; }
  return _navigation;
}

// ---------- argv parsing ----------

function parseArgs(argv) {
  const out = { chain: false, problemType: null, fromFramework: null, roomDir: null };
  const args = Array.isArray(argv) ? argv.slice(2) : [];
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--chain') { out.chain = true; }
    else if (a === '--problem-type' || a === '--from-problem-type') { out.problemType = args[i + 1] || null; i += 1; }
    else if (a === '--from-framework' || a === '--framework') { out.fromFramework = args[i + 1] || null; i += 1; }
    else if (a === '--room') { out.roomDir = args[i + 1] || null; i += 1; }
    else if (a.startsWith('--problem-type=')) { out.problemType = a.slice('--problem-type='.length); }
    else if (a.startsWith('--from-problem-type=')) { out.problemType = a.slice('--from-problem-type='.length); }
    else if (a.startsWith('--from-framework=')) { out.fromFramework = a.slice('--from-framework='.length); }
    else if (a.startsWith('--room=')) { out.roomDir = a.slice('--room='.length); }
  }
  return out;
}

// ---------- light room reading ----------

function isRoom(dir) {
  try { if (!fs.statSync(dir).isDirectory()) return false; } catch (_e) { return false; }
  return fs.existsSync(path.join(dir, 'STATE.md')) || fs.existsSync(path.join(dir, '.room-root'));
}
function resolveRoomDir(explicit) {
  if (explicit && typeof explicit === 'string') {
    const p = path.resolve(explicit);
    if (isRoom(p)) return p;
    const nested = path.join(p, 'room');
    if (isRoom(nested)) return nested;
    return null;
  }
  for (const c of [path.join(process.cwd(), 'room'), process.cwd()]) if (isRoom(c)) return c;
  return null;
}
function readProblemType(roomDir) {
  if (!roomDir) return null;
  let text = null;
  try { text = fs.readFileSync(path.join(roomDir, 'STATE.md'), 'utf8'); } catch (_e) { return null; }
  for (const raw of text.split(/\r?\n/)) {
    const m = /^[-*\s>|`]*problem[\s_-]*type\s*[:=]\s*(.+?)\s*$/i.exec(raw.trim());
    if (m) return String(m[1]).replace(/^["'\[\(]+/, '').replace(/["'\]\)]+$/, '').replace(/`/g, '').trim() || null;
  }
  return null;
}

// ---------- plan the chain run by DELEGATING the walk to runChain (Phase 166-04) ----------

/**
 * buildRunChainPlan(workflow, autonomyReport) -> { wouldRun, stopAt, stopReason }
 *
 * The Wave-4 migration seam: act stops owning a loop. Where this file used to
 * walk the steps itself (the old planChainRun loop, act-command.cjs:131-147),
 * it now DELEGATES the walk to lib/core/chain-executor.cjs runChain and DERIVES
 * the same { wouldRun, stopAt, stopReason } plan shape from runChain's
 * { trace, completed, haltedAt } return. The render (renderChainReport) and the
 * journaling (emitWorkflowStages) drive off this plan UNCHANGED, so the
 * user-visible behavior is byte/behavior-identical to the pre-migration donor
 * (VERIFIED against tests/fixtures/act-prebehavior-baseline.json).
 *
 * The callbacks act supplies to runChain:
 *   postureFn    = recipe-maps.postureForCommand (the ONE posture authority, Wave 1).
 *                  act re-implements no posture -- it names the authority and lets
 *                  the spine consult it.
 *   gateFn       = a chain-autonomy gate built from THIS chain's autonomyReport
 *                  (the blocker-set + command-less detection the donor encoded).
 *                  Because act's stop semantics are "the first non-autonomous_safe
 *                  (or command-less) step", the gate reads the precomputed
 *                  validateChainAutonomy report rather than re-deriving posture
 *                  per step -- the report IS recipe-maps' verdict for the chain.
 *   onStep       = records the greenlit step into wouldRun (the way planChainRun
 *                  pushed { step, command, framework }); returns a benign output
 *                  (act does NOT dispatch framework-runner here -- the /mos:act
 *                  command body does that for the greenlit prefix; this helper
 *                  only PLANS the walk).
 *   onHalt       = records the stop step + reason (the render's F.0 gate is built
 *                  later by renderChainReport from plan.stopAt). Returns 'defer'
 *                  so the loop halts here (act's stop = the first material step).
 *   provenanceFn = null (act is not the pipeline).
 *   decideFn     = the REAL navigation-engine decide() (Phase 172-08, CIRS R4):
 *                  act feeds the ONE governed selection authority so each step's
 *                  next-reach derivation comes from the SAME spine the pipeline and
 *                  the engine consume. act's STOP authority is still the chain
 *                  autonomy report (gateFn), but the next-reach DERIVATION is no
 *                  longer a no-op second brain -- the prior decideFn: () => null is
 *                  gone. The decision_trace decide() returns is recorded UNCHANGED
 *                  by runChain (B2); decide() reads LOCAL context only (Part 8).
 */
function buildRunChainPlan(workflow, autonomyReport) {
  const steps = Array.isArray(workflow) ? workflow : [];

  // The blocker set + command-less detection the donor encoded, surfaced to the
  // gate. This is validateChainAutonomy's verdict -- recipe-maps' posture
  // authority for the chain -- not a re-implementation.
  const blockerSteps = new Set();
  if (autonomyReport && Array.isArray(autonomyReport.blockers)) {
    for (const b of autonomyReport.blockers) if (b && typeof b.step === 'number') blockerSteps.add(b.step);
  }

  const wouldRun = [];
  let stopAt = null;
  let stopReason = null;

  // gateFn: 'run' for an autonomous_safe step, 'halt' at the first command-less
  // (no /mos:) step or the first blocker. The stop reason is captured here so
  // onHalt can record it. This is the donor's stop semantics, moved onto the
  // shared spine's gate seam.
  function gateFn(step) {
    if (!step || typeof step.command !== 'string' || step.command.length === 0) {
      stopReason = 'no /mos: command';
      return 'halt';
    }
    if (blockerSteps.has(step.step)) {
      stopReason = 'not autonomous_safe';
      return 'halt';
    }
    return 'run';
  }

  // onStep: record the greenlit step into wouldRun (the planning the donor did).
  // act does NOT dispatch the framework-runner here; the command body greenlights
  // the prefix. Returns a benign high-quality output so the spine's quality carry
  // never short-circuits the autonomous_safe prefix.
  function onStep(step) {
    wouldRun.push({ step: step.step, command: step.command, framework: step.framework });
    return { chain_output: { step: step.step }, quality: 'high' };
  }

  // onHalt: record the stop step (the render builds the F.0 gate from it). Return
  // 'defer' so runChain ends the walk here (act halts at the first material step).
  function onHalt(step) {
    stopAt = step;
    return 'defer';
  }

  chainExecutor.runChain(steps, {
    postureFn: recipeMaps.postureForCommand,
    gateFn: gateFn,
    onStep: onStep,
    onHalt: onHalt,
    provenanceFn: null,
    // CIRS R4: feed the REAL decide() (or the default the spine loads when the
    // engine is absent). Adapt runChain's ({step,index},{previousOutput}) call onto
    // decide(turn, context): the step index seeds a minimal LOCAL turn; context stays
    // the runChain-supplied previousOutput carry. decide() never throws (it returns a
    // safe emptyDecision on any internal fault), so a degraded engine yields a benign
    // decision handle rather than crashing the gate. ONE selection authority.
    decideFn: (function () {
      const realDecide = loadRealDecide();
      if (typeof realDecide !== 'function') {
        // Engine absent: degrade to a benign null-handle seam (never the loop's own
        // second selection path -- there is no second brain to fall back to). This is
        // NOT the removed ungoverned decideFn; it is the absent-engine degrade only.
        return function degradeNoDecision() { return null; };
      }
      return function (turn, context) {
        const idx = (turn && typeof turn.index === 'number') ? turn.index : 0;
        return realDecide(
          { userText: '', sectionPath: null, sessionId: 'act-chain-' + idx },
          context || {}
        );
      };
    })(),
    maxSteps: steps.length > 0 ? steps.length : 1,
  });

  return { wouldRun: wouldRun, stopAt: stopAt, stopReason: stopReason };
}

/**
 * planChainRun(workflow, autonomyReport) -> { wouldRun, stopAt, stopReason }
 *
 * Thin shim preserved for the existing call sites (renderChainReport,
 * emitWorkflowStages, main, and the snapshot/identity suites). The walk
 * OWNERSHIP now lives in runChain via buildRunChainPlan; this name stays as the
 * stable surface that returns the same plan shape it always did. The donor loop
 * that used to live here (the manual step walk) is gone -- act owns no loop.
 */
function planChainRun(workflow, autonomyReport) {
  return buildRunChainPlan(workflow, autonomyReport);
}

// ---------- render (Shape E / F.0 action report) ----------

function renderChainReport(seedLabel, frameworkChain, workflow, autonomyReport, plan, chainPick) {
  const out = [];
  out.push('-- MindrianOS -- act --chain -- ' + seedLabel + ' --');
  out.push('');
  out.push('Chain (recommender + resolver):');
  out.push('  ' + frameworkChain.join('  ->  '));
  out.push('  ' + chainSource.describeSource(chainPick));
  out.push('');
  out.push('Steps:');
  for (const s of workflow) {
    const fw = s && typeof s.framework === 'string' ? s.framework : '(unknown)';
    const cmd = (s && typeof s.command === 'string' && s.command.length > 0) ? s.command : '(no /mos: -- manual)';
    let mark = '';
    if (plan.stopAt && s.step === plan.stopAt.step) mark = '  <-- needs you here';
    else if (plan.wouldRun.some(function (w) { return w.step === s.step; })) mark = '  (autonomous_safe -- would run)';
    else mark = '  (after the gate)';
    out.push('  ' + String(s.step) + '. ' + cmd + '  (' + fw + ')' + mark);
  }
  out.push('');
  out.push('runnable: ' + (autonomyReport.runnable === true) +
    '  |  blockers: ' + (Array.isArray(autonomyReport.blockers) ? autonomyReport.blockers.length : 0));
  out.push('');
  if (plan.stopAt) {
    const fw = plan.stopAt.framework || '(unknown)';
    const cmd = (typeof plan.stopAt.command === 'string' && plan.stopAt.command.length > 0)
      ? plan.stopAt.command : 'run ' + fw + ' manually';
    // Phase 121.5-10 Sub-plan K (audit Section 5.3): replace bespoke
    // [continue] / [stop] bracket text with F.0 Mini Decision Gate via
    // pickShape. F.0 closed vocab (Approve = continue, Reject = stop with
    // REJECTED_BECAUSE edge, Defer = milestone-audit + halt chain) maps the
    // bespoke buttons onto the canon contract without losing the user's
    // existing two-button mental model. The [■ BRAIN] chip lands on the
    // gate header per the locked template (Section 5.2).
    const gateHeader = '[■ BRAIN] [GATE] Chain step ' + plan.stopAt.step + ': ' + cmd + ' for ' + fw;
    const gateBody = (plan.stopReason === 'no /mos: command')
      ? 'There is no /mos: for ' + fw + ' -- this one is manual; the chain cannot run it for you.'
      : 'This step is not autonomous_safe -- it needs your eyes.';
    let f0Rendered = null;
    try {
      const f0Result = dispatcher.pickShape({
        requestedShape: 'F.0',
        payload: {
          header: gateHeader,
          body: gateBody,
          parent_decision_id: 'act-chain:step-' + String(plan.stopAt.step),
        },
      });
      if (f0Result && f0Result.shape === 'F.0' && f0Result.rendered) {
        const zones = f0Result.rendered.zones || {};
        f0Rendered = (typeof zones.header === 'string' ? zones.header : '') + '\n' +
          (typeof zones.body === 'string' ? zones.body : '') + '\n' +
          (typeof zones.footer === 'string' ? zones.footer : '');
      }
    } catch (_e) { f0Rendered = null; }
    if (f0Rendered !== null) {
      out.push(f0Rendered);
    } else {
      // Graceful fallback: degraded environments without the F.0 renderer
      // still receive a recognizable gate (locked chip + reason prose). The
      // CI tripwire allowlists the F.0 pickShape call above; this fallback
      // is reachable only when the dispatcher is missing.
      out.push('[■ BRAIN] [GATE] Chain reached step ' + plan.stopAt.step + ': ' + cmd + ' for ' + fw + '.');
      out.push('       ' + gateBody);
    }
    out.push('');
    out.push('---');
    if (typeof plan.stopAt.command === 'string' && plan.stopAt.command.length > 0) out.push('> ' + plan.stopAt.command + '  -- the step that needs you');
    out.push('> /mos:status  -- room state');
  } else {
    out.push('Whole chain is autonomous_safe -- /mos:act --chain may run all ' + plan.wouldRun.length + ' steps with checkpoints between them.');
    out.push('');
    out.push('---');
    if (plan.wouldRun.length > 0) out.push('> ' + plan.wouldRun[0].command + '  -- the chain starts here');
    out.push('> /mos:status  -- room state');
  }
  return out.join('\n') + '\n';
}

// ---------- workflow_stage emission (Phase 129-04) ----------

/**
 * emitWorkflowStages(roomDir, workflow, plan, autonomyReport)
 *
 * Journals one workflow_stage (surface='act', phase='entered') on dispatch and
 * one (phase='completed') on return for every greenlit step in the plan, then a
 * single phase='entered' for the gated stop step (the "needs you here" gate)
 * with NO matching completed -- the stop is reflected by the absence of the
 * completed event. The entered event carries framework (the dispatched
 * methodology) + autonomy (the per-step autonomy enum from validateChainAutonomy)
 * scalars. completed FOLLOWS_FROM its own entered; each subsequent entered
 * FOLLOWS_FROM the prior completed (or prior entered for the gated step) so the
 * chain links temporally per Canon Part 4. Best-effort: routes through
 * navigation.logWorkflowStage (roomDir-only, never a db handle), wrapped in
 * try/catch, never load-bearing for the gate render. NO em-dashes.
 */
function emitWorkflowStages(roomDir, workflow, plan, autonomyReport) {
  try {
    const nav = tryLoadNavigation();
    if (!nav) return { ok: false, reason: 'no_room_db' };
    let dir = roomDir;
    if (!dir && typeof nav.detectActiveRoom === 'function') {
      const active = nav.detectActiveRoom();
      if (active && typeof active.roomDir === 'string') dir = active.roomDir;
    }
    if (!dir || typeof dir !== 'string') return { ok: false, reason: 'no_room_db' };

    const runnable = (autonomyReport && autonomyReport.runnable === true);
    const greenlit = (plan && Array.isArray(plan.wouldRun)) ? plan.wouldRun : [];
    const greenlitSteps = new Set(greenlit.map((w) => w.step));
    let priorEventId = null; // the spine event the NEXT entered FOLLOWS_FROM.

    function emitOne(phase, step, frameworkName, follows) {
      const payload = {
        surface: 'act',
        phase,
        stage: typeof step.command === 'string' && step.command.length > 0
          ? step.command : (frameworkName || 'manual'),
        stage_step: step.step,
        framework: frameworkName || null,
      };
      if (phase === 'entered') payload.autonomy = runnable ? 'autonomous_safe' : 'gated';
      if (typeof follows === 'string' && follows.length > 0) payload.follows_from = follows;
      const r = nav.logWorkflowStage(dir, payload);
      return (r && typeof r.eventId === 'string') ? r.eventId : null;
    }

    // Greenlit steps: entered + completed, threaded.
    for (const step of workflow) {
      if (!greenlitSteps.has(step.step)) continue;
      const fw = typeof step.framework === 'string' ? step.framework : null;
      const enteredId = emitOne('entered', step, fw, priorEventId);
      const completedId = emitOne('completed', step, fw, enteredId || priorEventId);
      priorEventId = completedId || enteredId || priorEventId;
    }

    // Gated stop step: entered only (NO completed). The stop is the gate.
    if (plan && plan.stopAt && typeof plan.stopAt.step === 'number') {
      const stop = plan.stopAt;
      const fw = typeof stop.framework === 'string' ? stop.framework : null;
      emitOne('entered', stop, fw, priorEventId);
    }
    return { ok: true };
  } catch (_e) {
    return { ok: false, reason: 'no_room_db' };
  }
}

function notChainNote() {
  return [
    '-- MindrianOS -- act --',
    '',
    '/mos:act --chain   pick a framework chain for the room state (recommender),',
    '                   compose /mos: commands (resolver), validateChainAutonomy first,',
    '                   stop at the first non-autonomous_safe (or command-less) step',
    '                   with a "needs you here" gate.',
    '',
    'Single / --swarm / --dry-run are handled by the /mos:act command body.',
    '',
    '---',
    '> /mos:act --chain  -- plan + autonomy-gate a chain',
    '> /mos:suggest-next  -- preview a Brain-derived chain',
  ].join('\n') + '\n';
}

// ---------- main ----------

function main(argv) {
  const args = parseArgs(argv || process.argv);
  if (!args.chain) {
    process.stdout.write(notChainNote());
    process.exit(0);
  }

  const roomDir = resolveRoomDir(args.roomDir);

  // Seed: --from-framework > --problem-type > room ProblemType > default.
  let opts;
  let seedLabel;
  if (args.fromFramework) { opts = { currentFramework: args.fromFramework }; seedLabel = 'from-framework ' + args.fromFramework; }
  else if (args.problemType) { opts = { problemType: args.problemType }; seedLabel = 'from-problem-type ' + args.problemType; }
  else {
    const pt = readProblemType(roomDir);
    if (pt) { opts = { problemType: pt }; seedLabel = 'room ProblemType ' + pt; }
    else { opts = {}; seedLabel = 'default seed (no ProblemType set)'; }
  }

  const chainPick = chainSource.resolveChainSource(opts);
  const frameworkChain = chainPick.frameworks;
  const workflow = resolver.composeWorkflow(frameworkChain);
  // Autonomy check FIRST.
  const autonomyReport = resolver.validateChainAutonomy(workflow);
  const plan = planChainRun(workflow, autonomyReport);
  process.stdout.write(renderChainReport(seedLabel, frameworkChain, workflow, autonomyReport, plan, chainPick));

  // Phase 129-04: journal the dispatch AFTER stdout so the gate render is never
  // delayed. Best-effort; never load-bearing for the user-visible output.
  try { emitWorkflowStages(roomDir, workflow, plan, autonomyReport); }
  catch (_e) { /* telemetry is best-effort; never crash /mos:act --chain */ }

  process.exit(0);
}

if (require.main === module) {
  try {
    main(process.argv);
  } catch (err) {
    process.stdout.write('act --chain could not be planned.\n');
    process.stdout.write('  Reason: ' + (err && err.message ? err.message : 'unknown') + '\n');
    process.stdout.write('> /mos:suggest-next  -- preview a Brain-derived chain\n');
    process.exit(0);
  }
}

module.exports = {
  parseArgs: parseArgs,
  resolveRoomDir: resolveRoomDir,
  readProblemType: readProblemType,
  buildRunChainPlan: buildRunChainPlan,
  planChainRun: planChainRun,
  renderChainReport: renderChainReport,
  emitWorkflowStages: emitWorkflowStages,
  main: main,
};
