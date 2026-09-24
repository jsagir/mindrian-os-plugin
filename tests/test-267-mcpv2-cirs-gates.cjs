#!/usr/bin/env node
'use strict';

/**
 * Phase 267 Plan 01 (MCPV2-08) -- the per-commit CIRS gate.
 * ==========================================================================
 * One command every registration-rewrite commit in 267-06..267-11 runs
 * before it lands. Three checks:
 *   (a) `node scripts/build-connector-registry.cjs --check` exits 0.
 *   (b) `node scripts/check-shape-declaration.cjs --check --strict`'s
 *       violation surface set is a subset of the recorded baseline
 *       (tests/fixtures/267/shape-violations-baseline.txt), and contains
 *       zero surfaces under lib/mcp/. A baseline surface that disappeared is
 *       an improvement (INFO), never a failure.
 *   (c) `listMcpToolConnectorDescriptors().length` equals the
 *       `CONNECTOR_DESCRIPTORS=<n>` line recorded in 267-BASELINE.md. This
 *       guards against the silent-skip trap: a connector module that throws
 *       on require() is dropped from the count with no error, so the count
 *       itself is the tripwire (267-RESEARCH.md, build-connector-registry.cjs
 *       read_first note).
 *
 * No em-dashes anywhere (hyphens only). CJS, Node built-ins only.
 */

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const BASELINE_PATH = path.join(
  REPO_ROOT,
  '.planning',
  'phases',
  '267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp',
  '267-BASELINE.md'
);
const SHAPE_BASELINE_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', '267', 'shape-violations-baseline.txt');

let passCount = 0;
let failCount = 0;

function pass(label, detail) {
  passCount += 1;
  console.log(`PASS: ${label}${detail ? ' -- ' + detail : ''}`);
}

function fail(label, detail) {
  failCount += 1;
  console.log(`FAIL: ${label}${detail ? ' -- ' + detail : ''}`);
}

function info(label, detail) {
  console.log(`INFO: ${label}${detail ? ' -- ' + detail : ''}`);
}

// -----------------------------------------------------------------------
// (a) connector registry check
// -----------------------------------------------------------------------
function checkA() {
  const label = 'Check (a) build-connector-registry.cjs --check';
  const result = cp.spawnSync('node', [path.join(REPO_ROOT, 'scripts', 'build-connector-registry.cjs'), '--check'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    fail(label, `exit ${result.status}: ${(result.stdout || '') + (result.stderr || '')}`.slice(0, 500));
    return;
  }
  pass(label, 'exit 0');
}

// -----------------------------------------------------------------------
// (b) shape-declaration drift check against the recorded baseline
// -----------------------------------------------------------------------
function checkB() {
  const label = 'Check (b) check-shape-declaration.cjs --check --strict drift vs baseline';

  if (!fs.existsSync(SHAPE_BASELINE_PATH)) {
    fail(label, `baseline file missing: ${SHAPE_BASELINE_PATH}`);
    return;
  }
  const baselineSet = new Set(
    fs
      .readFileSync(SHAPE_BASELINE_PATH, 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
  );

  const result = cp.spawnSync(
    'node',
    [path.join(REPO_ROOT, 'scripts', 'check-shape-declaration.cjs'), '--check', '--strict'],
    { cwd: REPO_ROOT, encoding: 'utf8' }
  );
  const combined = (result.stdout || '') + (result.stderr || '');
  const currentSet = new Set(
    combined
      .split('\n')
      .filter((l) => l.startsWith('  - surface '))
      .map((l) => l.replace(/^  - surface ([^:]+):.*/, '$1'))
  );

  // result.status is 0 when there are zero violations (a clean tree); 1 when
  // --strict is finding violations. Either way, currentSet is the ground
  // truth to compare -- do not gate on the exit code itself.

  const newSurfaces = [...currentSet].filter((s) => !baselineSet.has(s));
  const underLibMcp = [...currentSet].filter((s) => s.startsWith('lib/mcp/'));
  const disappeared = [...baselineSet].filter((s) => !currentSet.has(s));

  if (disappeared.length > 0) {
    info(label, `${disappeared.length} baseline surface(s) no longer violating (improvement): ${disappeared.slice(0, 10).join(', ')}`);
  }

  if (newSurfaces.length > 0) {
    fail(label, `new shape-declaration violation(s) not in baseline: ${newSurfaces.join(', ')}`);
    return;
  }
  if (underLibMcp.length > 0) {
    fail(label, `violation(s) under lib/mcp/: ${underLibMcp.join(', ')}`);
    return;
  }
  pass(label, `${currentSet.size} current violation(s), all within the recorded baseline, zero under lib/mcp/`);
}

// -----------------------------------------------------------------------
// (c) connector-descriptor count vs recorded baseline
// -----------------------------------------------------------------------
function checkC() {
  const label = 'Check (c) connector-descriptor count matches 267-BASELINE.md';

  if (!fs.existsSync(BASELINE_PATH)) {
    fail(label, `267-BASELINE.md missing: ${BASELINE_PATH}`);
    return;
  }
  const baselineSource = fs.readFileSync(BASELINE_PATH, 'utf8');
  const match = baselineSource.match(/^CONNECTOR_DESCRIPTORS=(\d+)$/m);
  if (!match) {
    fail(label, '267-BASELINE.md has no CONNECTOR_DESCRIPTORS=<n> line');
    return;
  }
  const expected = Number(match[1]);

  let gen;
  try {
    gen = require(path.join(REPO_ROOT, 'scripts', 'build-connector-registry.cjs'));
  } catch (e) {
    fail(label, `require() of build-connector-registry.cjs threw: ${e.message}`);
    return;
  }
  if (typeof gen.listMcpToolConnectorDescriptors !== 'function') {
    fail(label, 'listMcpToolConnectorDescriptors is not exported');
    return;
  }
  const actual = gen.listMcpToolConnectorDescriptors().length;
  if (actual !== expected) {
    fail(label, `expected ${expected} connector descriptors (from baseline), got ${actual}`);
    return;
  }
  pass(label, `${actual} connector descriptors, matches baseline`);
}

checkA();
checkB();
checkC();

console.log('');
console.log(`RESULT: PASS=${passCount} FAIL=${failCount}`);
process.exit(failCount > 0 ? 1 : 0);
