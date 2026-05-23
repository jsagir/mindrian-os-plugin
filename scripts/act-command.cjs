#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 122-04 -- /mos:act --chain CLI helper (the autonomy gate)
 * ==============================================================
 * The script behind commands/act.md's --chain mode. It: picks the framework
 * chain for the room state via the chain recommender (lib/brain/chain-recommender.cjs
 * recommendFrameworkChain -- FEEDS_INTO traversal over framework names +
 * problem-type enums; Canon Part 8: never a command string, never user content),
 * composes that chain into a /mos: command sequence via the resolver
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
const recommender = require(path.join(REPO_ROOT, 'lib', 'brain', 'chain-recommender.cjs'));
const resolver = require(path.join(REPO_ROOT, 'lib', 'workflow', 'command-resolver.cjs'));
// Phase 121.5-10 Sub-plan K (audit Section 5.3 second-highest leverage):
// promote /mos:act --chain [GATE] from BESPOKE bracket text to F.0 Mini
// Decision Gate via pickShape. The locked [■ BRAIN] chip lands on the
// gate header; the F.0 closed vocabulary (Approve / Reject / Defer)
// replaces the bespoke [continue] / [stop] brackets.
const dispatcher = require(path.join(REPO_ROOT, 'lib', 'hmi', 'selector-dispatcher.cjs'));

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

// ---------- plan the chain run, stopping at the first non-autonomous step ----------

/**
 * planChainRun(workflow, autonomyReport) -> { wouldRun, stopAt, stopReason }
 *   wouldRun:    [{step, command, framework}] the autonomous_safe prefix the
 *                command body may run unattended.
 *   stopAt:      the first step that needs the user (or null if the whole chain
 *                is autonomous_safe).
 *   stopReason:  'not autonomous_safe' | 'no /mos: command' | null
 *
 * The first blocker per validateChainAutonomy is "not autonomous_safe". A
 * command:null step is ALSO a stop point (it cannot run unattended -- it needs
 * a manual run), per the spec's "stop at the first non-autonomous_safe (or
 * command-less) step".
 */
function planChainRun(workflow, autonomyReport) {
  const blockerSteps = new Set();
  if (autonomyReport && Array.isArray(autonomyReport.blockers)) {
    for (const b of autonomyReport.blockers) if (b && typeof b.step === 'number') blockerSteps.add(b.step);
  }
  const wouldRun = [];
  for (const s of workflow) {
    if (!s || typeof s.command !== 'string' || s.command.length === 0) {
      return { wouldRun: wouldRun, stopAt: s, stopReason: 'no /mos: command' };
    }
    if (blockerSteps.has(s.step)) {
      return { wouldRun: wouldRun, stopAt: s, stopReason: 'not autonomous_safe' };
    }
    wouldRun.push({ step: s.step, command: s.command, framework: s.framework });
  }
  return { wouldRun: wouldRun, stopAt: null, stopReason: null };
}

// ---------- render (Shape E / F.0 action report) ----------

function renderChainReport(seedLabel, frameworkChain, workflow, autonomyReport, plan) {
  const out = [];
  out.push('-- MindrianOS -- act --chain -- ' + seedLabel + ' --');
  out.push('');
  out.push('Chain (recommender + resolver):');
  out.push('  ' + frameworkChain.join('  ->  '));
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

  const frameworkChain = recommender.recommendFrameworkChain(opts);
  const workflow = resolver.composeWorkflow(frameworkChain);
  // Autonomy check FIRST.
  const autonomyReport = resolver.validateChainAutonomy(workflow);
  const plan = planChainRun(workflow, autonomyReport);
  process.stdout.write(renderChainReport(seedLabel, frameworkChain, workflow, autonomyReport, plan));
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
  planChainRun: planChainRun,
  renderChainReport: renderChainReport,
  main: main,
};
