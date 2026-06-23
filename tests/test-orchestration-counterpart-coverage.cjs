#!/usr/bin/env node
'use strict';

/*
 * Phase 172-03 - the mindrian-operation counterpart-coverage test fence
 * (INV-04/05/06; Canon Part 11 R1/R5/R8).
 *
 * Proves the command-grained coverage substrate the projection gate gained in
 * Plan 172-03:
 *   Test 1 - every command node in the LIVE projection is classified
 *            ranked | excluded | gap (full coverage; no command unclassified).
 *   Test 2 - a SYNTHESIZED bare command (no reach_id, not in the ledger) is
 *            flagged as a command_gap by validateProjection (the INVERSION of the
 *            old :824 early-continue: a bare command no longer silently ships).
 *   Test 3 - a SYNTHESIZED excluded command (in EXCLUDED_COMMANDS with a reason)
 *            is NOT a command_gap (a first-class conformant terminal state, R1).
 *   Test 4 - the command-ledger XOR invariant:
 *            counts.ranked + counts.excluded + counts.gap === command-node count.
 *   Test 5 - the R8 PROMOTION-PATH documentation exists in
 *            docs/ORCHESTRATION-PROJECTION-CONTRACT.md (the dark -> counterpart ->
 *            pws frontier path + the mints-no-new-node-type constraint).
 *   Test 6 - Part 8 boundary (T-172-05): no ledger/excluded VALUE matches a
 *            room/ path or an at-sign email heuristic (generic machinery only).
 *
 * Reads LOCAL files only; ZERO Brain, ZERO network (Part 8). No emoji, no
 * em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const PROJECTION_PATH = path.join(REPO_ROOT, 'data', 'brain-orchestration-projection.json');
const CONTRACT_PATH = path.join(REPO_ROOT, 'docs', 'ORCHESTRATION-PROJECTION-CONTRACT.md');

const g = require(path.join(REPO_ROOT, 'scripts', 'build-orchestration-projection.cjs'));

let pass = 0;
let fail = 0;
const failures = [];

function ok(cond, label) {
  if (cond) {
    pass += 1;
    console.log('  PASS: ' + label);
  } else {
    fail += 1;
    failures.push(label);
    console.log('  FAIL: ' + label);
  }
}

const projection = JSON.parse(fs.readFileSync(PROJECTION_PATH, 'utf8'));
const commandNodes = projection.nodes.filter((n) => n && n.kind === 'command');

// ---------------------------------------------------------------------------
// Test 1: full coverage - every command node classifies ranked|excluded|gap.
// ---------------------------------------------------------------------------
console.log('Test 1: every command node is classified ranked|excluded|gap');
{
  const STATES = new Set(['ranked', 'excluded', 'gap']);
  let allClassified = true;
  for (const n of commandNodes) {
    const state = g.classifyCommandNode(n);
    if (!STATES.has(state)) {
      allClassified = false;
      break;
    }
  }
  ok(commandNodes.length > 0, 'projection has command nodes (' + commandNodes.length + ')');
  ok(allClassified, 'every command node classifies to exactly one of ranked|excluded|gap');
}

// ---------------------------------------------------------------------------
// Test 2: a synthesized bare command is flagged as a command_gap.
// ---------------------------------------------------------------------------
console.log('Test 2: a synthesized bare command (no reach_id, not excluded) is a command_gap');
{
  const synthetic = JSON.parse(JSON.stringify(projection));
  // A net-new bare command not in EXCLUDED_COMMANDS and with no reach_id.
  synthetic.nodes.push({
    id: 'command:/mos:synthetic-dark-172-03',
    kind: 'command',
    methodology_tier: 'mindrian-operation',
    name: '/mos:synthetic-dark-172-03',
  });
  const v = g.validateProjection(synthetic);
  ok(Array.isArray(v.command_gaps), 'validateProjection returns a command_gaps array');
  const flagged = v.command_gaps.some((s) => s.includes('/mos:synthetic-dark-172-03'));
  ok(flagged, 'the synthesized bare command appears in command_gaps (early-continue inverted)');
}

// ---------------------------------------------------------------------------
// Test 3: a synthesized excluded command is NOT a command_gap.
// ---------------------------------------------------------------------------
console.log('Test 3: a synthesized excluded command (in the ledger with a reason) is NOT a gap');
{
  // Pick a real EXCLUDED_COMMANDS slug; synthesize a bare node for it. Because
  // it is excluded-with-reason, it must NOT be a gap.
  const excludedSlugs = Object.keys(g.EXCLUDED_COMMANDS);
  ok(excludedSlugs.length > 0, 'EXCLUDED_COMMANDS is non-empty');
  const slug = excludedSlugs[0];
  ok(
    typeof g.EXCLUDED_COMMANDS[slug] === 'string' && g.EXCLUDED_COMMANDS[slug].length > 0,
    'the excluded command "' + slug + '" carries a non-empty reason (T-172-06)'
  );
  const node = { id: 'command:' + slug, kind: 'command', methodology_tier: 'mindrian-operation', name: slug };
  ok(g.classifyCommandNode(node) === 'excluded', 'classifyCommandNode("' + slug + '") === excluded');
  const synthetic = JSON.parse(JSON.stringify(projection));
  // Remove any existing node for the slug, then add the bare excluded node.
  synthetic.nodes = synthetic.nodes.filter((n) => !(n.kind === 'command' && n.name === slug));
  synthetic.nodes.push(node);
  const v = g.validateProjection(synthetic);
  const flagged = v.command_gaps.some((s) => s.includes(slug));
  ok(!flagged, 'the excluded command "' + slug + '" is NOT in command_gaps');
}

// ---------------------------------------------------------------------------
// Test 4: the command-ledger XOR invariant.
// ---------------------------------------------------------------------------
console.log('Test 4: command-ledger XOR invariant (ranked + excluded + gap === command-node count)');
{
  const report = g.commandCoverageReport(projection);
  const { ranked, excluded, gap, total } = report.counts;
  ok(total === commandNodes.length, 'counts.total (' + total + ') === command-node count (' + commandNodes.length + ')');
  ok(ranked + excluded + gap === total, 'ranked + excluded + gap (' + (ranked + excluded + gap) + ') === total (' + total + ')');
  // And the on-disk ledger matches the regenerated ledger byte-for-byte.
  const ledgerOnDisk = fs.readFileSync(
    path.join(REPO_ROOT, 'data', 'orchestration-command-ledger.json'),
    'utf8'
  );
  ok(g.serializeCommandLedger(projection) === ledgerOnDisk, 'committed ledger is byte-identical to the regenerated ledger');
}

// ---------------------------------------------------------------------------
// Test 5: the R8 promotion-path documentation exists.
// ---------------------------------------------------------------------------
console.log('Test 5: docs/ORCHESTRATION-PROJECTION-CONTRACT.md documents the R8 promotion path');
{
  const contract = fs.readFileSync(CONTRACT_PATH, 'utf8');
  ok(/promotion path/i.test(contract), 'contract mentions the "promotion path"');
  ok(/mindrian-operation/.test(contract) && /counterpart/i.test(contract), 'contract documents the mindrian-operation counterpart node');
  ok(/frontier/i.test(contract), 'contract names the pws frontier framework destination');
  ok(/no new node type/i.test(contract) || /mints? no new node type/i.test(contract), 'contract states promotion mints no new node type (Part 11 constraint)');
}

// ---------------------------------------------------------------------------
// Test 6: Part 8 boundary - no user-content heuristic in any ledger value.
// ---------------------------------------------------------------------------
console.log('Test 6: Part 8 boundary - ledger + excluded reasons carry only generic machinery');
{
  const report = g.commandCoverageReport(projection);
  const blob = JSON.stringify(report.commands) + JSON.stringify(g.EXCLUDED_COMMANDS);
  ok(!/(^|[^a-z])room\//.test(blob), 'no room/ path segment in any ledger value');
  ok(!/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(blob), 'no email pattern in any ledger value');
}

console.log('');
console.log('========================================');
console.log('  counterpart-coverage: ' + pass + ' passed, ' + fail + ' failed');
console.log('========================================');
if (fail > 0) {
  console.error('Failures:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
process.exit(0);
