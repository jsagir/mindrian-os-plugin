#!/usr/bin/env node
'use strict';

/*
 * tests/test-344-layer-gate.cjs
 *
 * Phase 344 Plan 02 (LAYER-04, LAYER-05): pins scripts/check-layer-declaration.cjs.
 *
 * Builds two synthetic trees under os.tmpdir(): a clean one (every surface
 * declares an in-vocabulary layer) and a violating one (an undeclared
 * command, an out-of-vocabulary agent, a `none` skill with no `layer_why`).
 * Spawns the gate against each with CHECK_LAYER_DECLARATION_ROOT, asserting
 * the exit codes and the message content the gate's own behavior contract
 * promises. Also exercises the missing-schema fatal via
 * LAYER_DECLARATION_SCHEMA_PATH, without ever touching the real repo's own
 * schema file.
 *
 * The clean tree's --json total is asserted against a denominator this test
 * computes itself with fs.readdirSync (never a literal), matching the four
 * markdown surface classes the gate walks. MCP tool descriptors are
 * deliberately excluded from that denominator: the gate itself only adds
 * them when CHECK_LAYER_DECLARATION_ROOT is unset (see the gate's own
 * docblock), since a synthetic tree has no lib/mcp/tools/ to discover.
 *
 * House rule: hyphens only, no em-dashes, no emoji.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const GATE_PATH = path.join(REPO_ROOT, 'scripts', 'check-layer-declaration.cjs');

let pass = 0;
let fail = 0;

function assert(cond, label) {
  if (cond) {
    pass += 1;
    console.log('PASS: ' + label);
  } else {
    fail += 1;
    console.log('FAIL: ' + label);
  }
}

function mkTmpRoot(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeFile(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf8');
}

function runGate(args, env) {
  const res = spawnSync(process.execPath, [GATE_PATH, ...args], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, env || {}),
  });
  return res;
}

// ---------------------------------------------------------------------------
// Build the clean tree: one command, one agent, one pipeline, one skill, each
// declaring a distinct in-vocabulary layer.
// ---------------------------------------------------------------------------
function buildCleanTree() {
  const root = mkTmpRoot('layer-gate-clean-');

  writeFile(
    path.join(root, 'commands', 'clean-command.md'),
    '---\nlayer: prompt\n---\n\nA clean command.\n'
  );
  writeFile(
    path.join(root, 'agents', 'clean-agent.md'),
    '---\nlayer: harness\n---\n\nA clean agent.\n'
  );
  writeFile(
    path.join(root, 'pipelines', 'clean-pipeline', 'CHAIN.md'),
    '---\nlayer: graph\n---\n\nA clean pipeline.\n'
  );
  writeFile(
    path.join(root, 'skills', 'clean-skill', 'SKILL.md'),
    '---\nlayer: none\nlayer_why: "a pure reference document, no engineering rung"\n---\n\nA clean skill.\n'
  );

  return root;
}

// ---------------------------------------------------------------------------
// Build the violating tree: an undeclared command, an out-of-vocabulary
// agent, a `none` skill with no layer_why.
// ---------------------------------------------------------------------------
function buildViolatingTree() {
  const root = mkTmpRoot('layer-gate-violating-');

  writeFile(
    path.join(root, 'commands', 'undeclared-command.md'),
    '---\nbody_shape: E\n---\n\nNo layer key at all.\n'
  );
  writeFile(
    path.join(root, 'agents', 'bad-vocab-agent.md'),
    '---\nlayer: nonsense-value\n---\n\nAn out-of-vocabulary layer.\n'
  );
  writeFile(
    path.join(root, 'skills', 'no-why-skill', 'SKILL.md'),
    '---\nlayer: none\n---\n\nDeclares none but gives no reason.\n'
  );

  return root;
}

// ---------------------------------------------------------------------------
// The real denominator for the clean tree, computed independently of the
// gate, via the same four-class walk, never a literal count.
// ---------------------------------------------------------------------------
function computeCleanDenominator(root) {
  let total = 0;

  const commandsDir = path.join(root, 'commands');
  if (fs.existsSync(commandsDir)) {
    total += fs.readdirSync(commandsDir).filter((f) => f.endsWith('.md')).length;
  }

  const agentsDir = path.join(root, 'agents');
  if (fs.existsSync(agentsDir)) {
    total += fs.readdirSync(agentsDir).filter((f) => f.endsWith('.md')).length;
  }

  const pipelinesDir = path.join(root, 'pipelines');
  if (fs.existsSync(pipelinesDir)) {
    total += fs
      .readdirSync(pipelinesDir)
      .filter((d) => fs.existsSync(path.join(pipelinesDir, d, 'CHAIN.md'))).length;
  }

  const skillsDir = path.join(root, 'skills');
  if (fs.existsSync(skillsDir)) {
    total += fs
      .readdirSync(skillsDir)
      .filter((d) => fs.existsSync(path.join(skillsDir, d, 'SKILL.md'))).length;
  }

  return total;
}

function main() {
  // --- The clean tree: exit 0, one OK line, --json total matches the
  //     independently-computed denominator. ------------------------------
  const cleanRoot = buildCleanTree();
  const expectedTotal = computeCleanDenominator(cleanRoot);

  const cleanDefault = runGate([], { CHECK_LAYER_DECLARATION_ROOT: cleanRoot });
  assert(cleanDefault.status === 0, 'clean tree: default invocation exits 0');
  assert(/^OK:/m.test(cleanDefault.stdout), 'clean tree: prints one OK line');
  assert(cleanDefault.stdout.indexOf(String(expectedTotal)) !== -1, 'clean tree: OK line names the enumerated denominator');

  const cleanJson = runGate(['--json'], { CHECK_LAYER_DECLARATION_ROOT: cleanRoot });
  assert(cleanJson.status === 0, 'clean tree: --json exits 0');
  let cleanParsed = null;
  try {
    cleanParsed = JSON.parse(cleanJson.stdout);
  } catch (_e) {
    cleanParsed = null;
  }
  assert(cleanParsed !== null, 'clean tree: --json prints valid JSON');
  assert(cleanParsed && cleanParsed.total === expectedTotal, 'clean tree: --json total equals the independently-computed denominator (' + expectedTotal + ')');
  assert(cleanParsed && typeof cleanParsed.by_layer === 'object', 'clean tree: --json carries by_layer');
  assert(cleanParsed && typeof cleanParsed.by_class === 'object', 'clean tree: --json carries by_class');
  assert(cleanParsed && cleanParsed.undeclared === 0, 'clean tree: --json undeclared is zero');

  // --- The violating tree: exit 1, one line per violation, naming the file
  //     and the failure kind. ---------------------------------------------
  const violatingRoot = buildViolatingTree();
  const violating = runGate([], { CHECK_LAYER_DECLARATION_ROOT: violatingRoot });
  assert(violating.status === 1, 'violating tree: default invocation exits 1');
  assert(
    violating.stdout.indexOf('commands/undeclared-command.md') !== -1,
    'violating tree: names the undeclared command by path'
  );
  assert(
    violating.stdout.indexOf('agents/bad-vocab-agent.md') !== -1 &&
      violating.stdout.indexOf('nonsense-value') !== -1,
    'violating tree: names the out-of-vocabulary agent and its offending value'
  );
  assert(
    violating.stdout.indexOf('skills/no-why-skill/SKILL.md') !== -1 &&
      violating.stdout.indexOf('layer_why') !== -1,
    'violating tree: names the none-without-layer_why skill and the missing key'
  );

  const violatingJson = runGate(['--json'], { CHECK_LAYER_DECLARATION_ROOT: violatingRoot });
  assert(violatingJson.status === 1, 'violating tree: --json also exits 1');

  // --- Missing schema: exit non-zero, names the file, never a silent pass.
  const missingSchemaRoot = mkTmpRoot('layer-gate-missing-schema-');
  const missingSchemaPath = path.join(missingSchemaRoot, 'does-not-exist.json');
  const missingSchema = runGate([], {
    CHECK_LAYER_DECLARATION_ROOT: cleanRoot,
    LAYER_DECLARATION_SCHEMA_PATH: missingSchemaPath,
  });
  assert(missingSchema.status !== 0, 'missing schema: exits non-zero');
  assert(
    missingSchema.stderr.indexOf('does-not-exist.json') !== -1,
    'missing schema: names the missing file'
  );

  // --- No frozen surface count anywhere in the gate's own source. ---------
  const gateSource = fs.readFileSync(GATE_PATH, 'utf8');
  assert(!/\b113\b/.test(gateSource), 'gate source contains no frozen 113 literal');

  console.log('');
  console.log('PASS=' + pass + ' FAIL=' + fail);
  process.exit(fail > 0 ? 1 : 0);
}

main();
