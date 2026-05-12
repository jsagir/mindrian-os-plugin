#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 122-04 -- /mos:pipeline CLI helper (--from-problem-type / --from-framework)
 * ===============================================================================
 * The script behind commands/pipeline.md's new args. Given --from-problem-type
 * <x> (or --from-framework <x>), it: Brain-derives the framework chain (the
 * chain recommender, lib/brain/chain-recommender.cjs recommendFrameworkChain --
 * FEEDS_INTO traversal over framework names + problem-type enums; Canon Part 8:
 * never a command string, never user content), composes that chain into a /mos:
 * command sequence via the resolver (lib/workflow/command-resolver.cjs
 * composeWorkflow -- the only door), and prints the run order. A step whose
 * framework has no /mos: command prints "no /mos: for <framework> -- run it
 * manually; continuing" and is skipped (degrade, do not fabricate).
 *
 * This helper PRINTS the resolved chain (which the /mos:pipeline command body
 * then runs via the existing pipeline-step machinery, one /mos: at a time).
 * Every command in the printed chain exists in data/command-registry.json --
 * the resolver only ever returns registered commands, so the acceptance
 * criterion "the chain is all real /mos: commands" holds by construction.
 *
 * Usage:
 *   node scripts/pipeline-command.cjs --from-problem-type ill-defined
 *   node scripts/pipeline-command.cjs --from-framework "Beautiful Question Framework"
 *   node scripts/pipeline-command.cjs --from-problem-type IDP --room /path/to/room
 *
 * Without --from-problem-type / --from-framework this helper does nothing (the
 * named-pipeline path stays the command body's job) -- it prints a usage line
 * and exits 0.
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

// ---------- argv parsing ----------

function parseArgs(argv) {
  const out = { fromProblemType: null, fromFramework: null, roomDir: null, pipelineName: null };
  const args = Array.isArray(argv) ? argv.slice(2) : [];
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--from-problem-type') { out.fromProblemType = args[i + 1] || null; i += 1; }
    else if (a === '--from-framework') { out.fromFramework = args[i + 1] || null; i += 1; }
    else if (a === '--room') { out.roomDir = args[i + 1] || null; i += 1; }
    else if (a.startsWith('--from-problem-type=')) { out.fromProblemType = a.slice('--from-problem-type='.length); }
    else if (a.startsWith('--from-framework=')) { out.fromFramework = a.slice('--from-framework='.length); }
    else if (a.startsWith('--room=')) { out.roomDir = a.slice('--room='.length); }
    else if (!a.startsWith('--') && out.pipelineName === null) { out.pipelineName = a; }
  }
  return out;
}

// ---------- light room reading (for the implicit ProblemType, if any) ----------

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

// ---------- render ----------

function renderRunPlan(seedLabel, frameworkChain, workflow) {
  const out = [];
  out.push('-- MindrianOS -- pipeline -- ' + seedLabel + ' --');
  out.push('');
  out.push('Brain-derived framework chain:');
  out.push('  ' + frameworkChain.join('  ->  '));
  out.push('');
  out.push('Run order (resolver-composed; each step runs as its own /mos: command):');
  for (const s of workflow) {
    const fw = s && typeof s.framework === 'string' ? s.framework : '(unknown)';
    if (s && typeof s.command === 'string' && s.command.length > 0) {
      out.push('  ' + String(s.step) + '. ' + s.command + '  (' + fw + ')');
    } else {
      out.push('  ' + String(s.step) + '. no /mos: for ' + fw + ' -- run it manually; continuing');
    }
  }
  const runnable = workflow.filter(function (s) { return s && typeof s.command === 'string' && s.command.length > 0; });
  out.push('');
  out.push(runnable.length + ' of ' + workflow.length + ' steps are /mos: commands; ' +
    (workflow.length - runnable.length) + ' need a manual run.');
  out.push('');
  out.push('---');
  if (runnable.length > 0) out.push('> ' + runnable[0].command + '  -- the pipeline starts here');
  out.push('> /mos:suggest-next  -- see the chain without running it');
  out.push('> /mos:status  -- room state');
  return out.join('\n') + '\n';
}

function usage() {
  return [
    '-- MindrianOS -- pipeline --',
    '',
    '/mos:pipeline --from-problem-type <x>   Brain-derive a chain from a ProblemType,',
    '                                        compose /mos: commands, run in sequence.',
    '/mos:pipeline --from-framework <x>      Brain-derive a chain starting from a framework.',
    '/mos:pipeline <name>                    run a named static pipeline (handled by the command body).',
    '',
    'Examples:',
    '  /mos:pipeline --from-problem-type ill-defined',
    '  /mos:pipeline --from-framework "Beautiful Question Framework"',
    '',
    '---',
    '> /mos:suggest-next  -- preview a Brain-derived chain',
    '> /mos:status  -- room state',
  ].join('\n') + '\n';
}

// ---------- main ----------

function main(argv) {
  const args = parseArgs(argv || process.argv);
  const roomDir = resolveRoomDir(args.roomDir);

  // Resolve the seed: --from-framework wins, then --from-problem-type, then the
  // room's ProblemType (so a bare `/mos:pipeline --from-problem-type` with no
  // value still works off the room). If none of those AND no named pipeline,
  // print usage.
  let opts = null;
  let seedLabel = null;
  if (args.fromFramework) {
    opts = { currentFramework: args.fromFramework };
    seedLabel = 'from-framework ' + args.fromFramework;
  } else if (args.fromProblemType) {
    opts = { problemType: args.fromProblemType };
    seedLabel = 'from-problem-type ' + args.fromProblemType;
  } else if (!args.pipelineName) {
    const pt = readProblemType(roomDir);
    if (pt) { opts = { problemType: pt }; seedLabel = 'from-problem-type ' + pt + ' (room ProblemType)'; }
  }

  if (!opts) {
    process.stdout.write(usage());
    process.exit(0);
  }

  const frameworkChain = recommender.recommendFrameworkChain(opts);
  const workflow = resolver.composeWorkflow(frameworkChain);
  process.stdout.write(renderRunPlan(seedLabel, frameworkChain, workflow));
  process.exit(0);
}

if (require.main === module) {
  try {
    main(process.argv);
  } catch (err) {
    process.stdout.write('pipeline chain could not be derived.\n');
    process.stdout.write('  Reason: ' + (err && err.message ? err.message : 'unknown') + '\n');
    process.stdout.write('> /mos:suggest-next  -- preview a Brain-derived chain\n');
    process.exit(0);
  }
}

module.exports = {
  parseArgs: parseArgs,
  resolveRoomDir: resolveRoomDir,
  readProblemType: readProblemType,
  renderRunPlan: renderRunPlan,
  main: main,
};
