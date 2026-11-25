#!/usr/bin/env node
'use strict';
/*
 * scripts/refresh-run-step-capabilities.cjs -- Phase 399 Plan 06 Task 1 (D-05).
 *
 * Writes data/run-step-capabilities.json: the commands that have run steps in
 * the PwS book toolbox inventory. This is the D-05 scope of the decision
 * advisor. The output holds command names, counts and a source hash only.
 * It holds no step text, no prompt, no rubric and no description.
 *
 * Usage:
 *   node scripts/refresh-run-step-capabilities.cjs --source <inventory.json> [--out <path>]
 *
 * There is no default source: the inventory lives in a private repo and no
 * path to it is stored here. Exit 2 without --source. Zero network.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const DEFAULT_OUT = path.join(ROOT, 'data', 'run-step-capabilities.json');
const REGISTRY_PATH = process.env.MINDRIAN_COMMAND_REGISTRY || path.join(ROOT, 'data', 'command-registry.json');

const NOTE =
  'Phase 399 D-05: the commands that have run steps in the PwS book toolbox inventory. ' +
  'Names and counts only, no step text. Refresh by hand when the book inventory changes: ' +
  'node scripts/refresh-run-step-capabilities.cjs --source <inventory.json>. ' +
  'The decision advisor table (data/decision-advisor-table.json) lists only these commands.';

function parseArgs(argv) {
  const out = { source: null, out: DEFAULT_OUT };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--source') out.source = argv[++i];
    else if (argv[i] === '--out') out.out = argv[++i];
    else return null;
  }
  return out;
}

function build(sourcePath) {
  const bytes = fs.readFileSync(sourcePath);
  const inv = JSON.parse(bytes.toString('utf8'));
  const items = Array.isArray(inv.items) ? inv.items : [];
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const registryNames = new Set(registry.commands.map((c) => c.command));

  const withSteps = items.filter((i) => Array.isArray(i.steps) && i.steps.length > 0);
  const named = new Set();
  let withCommand = 0;
  for (const item of withSteps) {
    const rid = item.command && typeof item.command.routine_id === 'string' ? item.command.routine_id : null;
    if (!rid) continue;
    withCommand += 1;
    const m = /^mos::(.+)$/.exec(rid);
    if (m) named.add('/mos:' + m[1]);
  }
  const all = Array.from(named).sort();
  const commands = all.filter((c) => registryNames.has(c));
  const notInRegistry = all.filter((c) => !registryNames.has(c));
  return {
    schema: 'mos.run-step-capabilities/1',
    _note: NOTE,
    source: 'PwS book toolbox inventory (bundle/toolbox/inventory.json)',
    source_sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    snapshot_date: new Date().toISOString().slice(0, 10),
    counts: {
      items_with_steps: withSteps.length,
      with_command: withCommand,
      in_registry: commands.length,
    },
    commands,
    not_in_registry: notInRegistry,
  };
}

function main(argv) {
  const args = parseArgs(argv);
  if (!args || !args.source) {
    process.stderr.write('usage: refresh-run-step-capabilities.cjs --source <inventory.json> [--out <path>]\n');
    return 2;
  }
  let result;
  try {
    result = build(args.source);
  } catch (e) {
    process.stderr.write('refresh-run-step-capabilities: ' + (e && e.message ? e.message : String(e)) + '\n');
    return 1;
  }
  fs.writeFileSync(args.out, JSON.stringify(result, null, 2) + '\n');
  process.stdout.write(
    'run-step-capabilities: ' + result.commands.length + ' commands, ' + result.not_in_registry.length + ' not in registry\n'
  );
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { build, main };
