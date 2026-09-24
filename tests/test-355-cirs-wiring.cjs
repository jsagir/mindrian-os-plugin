#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355 (Hidden in Plain Sight: Jev-through-Theo cross-connection
 * engines) Plan 21 Task 1 (HIPS-04, HIPS-08, HIPS-09, D-17). Proves the
 * stamp's declared CIRS posture and its "born wired" status end to end:
 *
 *   - lib/core/verification-stamp.cjs's POSTURE is exactly
 *     { autonomous_safe: true, reversibility: 'n/a (read-only)',
 *       consequence: 'low', writes: 'none' }.
 *   - no reach id was added: the frozen REACH_IDS six-member bank carries no
 *     'stamp'/'verification'/'cross_connection' member, and sensor-eureka's
 *     own REACH_ID is still 'deep_research' (SENS-13 rides the existing
 *     reach; a stamp attaches to what an existing sensor already surfaces).
 *   - lib/core/chain-executor.cjs never references verification-stamp.cjs
 *     or stamp-connections.cjs on a non-comment line (a stamp is never a
 *     material chain step; coordinated with Phase 356's own Jev-seat
 *     policy so the two phases' autonomous-safe surfaces do not collide).
 *   - data/command-registry.json registers no command containing
 *     'stamp-connections' (it is a CLI stamp entry, not a registry command).
 *   - commands/find-connections.md keeps hitl_shape: F.8 (D-17's own "no new
 *     reach id" constraint -- the stamp rides the existing shape).
 *   - the three born-wired gates (connector registry, orchestration
 *     projection, shape declaration) exit 0.
 *   - the posture-grid todo carries the folded "Data point: Phase 355
 *     verification stamp" section (appended by this same task, before this
 *     test's first run).
 *
 * Test hygiene contract (every 355 test): scrub TYPESAFE_API_KEY and install
 * the net guard via tests/helpers/hygiene-355.cjs BEFORE requiring any repo
 * module; assert attempts() === 0 as the last check.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const hygiene = require('./helpers/hygiene-355.cjs');

const hadKey = hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

const REPO = path.join(__dirname, '..');
const checker = hygiene.makeChecker('test-355-cirs-wiring');
const { check } = checker;

const verificationStamp = require(path.join(REPO, 'lib', 'core', 'verification-stamp.cjs'));
const sensorTypes = require(path.join(REPO, 'lib', 'core', 'sensors', 'sensor-types.cjs'));
const sensorEureka = require(path.join(REPO, 'lib', 'core', 'sensors', 'sensor-eureka.cjs'));

// ---------------------------------------------------------------------------
// POSTURE (D-17).
// ---------------------------------------------------------------------------
function checkPosture() {
  console.log('--- POSTURE: read-only, no writes, autonomous-safe ---');
  const p = verificationStamp.POSTURE;
  check('POSTURE.autonomous_safe === true', p.autonomous_safe === true);
  check("POSTURE.reversibility === 'n/a (read-only)'", p.reversibility === 'n/a (read-only)');
  check("POSTURE.consequence === 'low'", p.consequence === 'low');
  check("POSTURE.writes === 'none'", p.writes === 'none');
}

// ---------------------------------------------------------------------------
// No reach id was added; SENS-13 still rides deep_research.
// ---------------------------------------------------------------------------
function checkNoNewReachId() {
  console.log('--- REACH_IDS: no new reach id, sensor-eureka still rides deep_research ---');
  const ids = sensorTypes.REACH_IDS;
  const forbidden = ['stamp', 'verification', 'cross_connection'];
  const anyHit = ids.some((id) => forbidden.some((f) => id.indexOf(f) !== -1));
  check('REACH_IDS carries no stamp/verification/cross_connection member', !anyHit, JSON.stringify(ids));
  check("sensor-eureka's own REACH_ID is 'deep_research' (unchanged)", sensorEureka.REACH_ID === 'deep_research');
}

// ---------------------------------------------------------------------------
// chain-executor.cjs never references the stamp module or stamp-connections.
// ---------------------------------------------------------------------------
function checkChainExecutorNeverReferencesStamp() {
  console.log('--- chain-executor.cjs never references verification-stamp or stamp-connections ---');
  const abs = path.join(REPO, 'lib', 'core', 'chain-executor.cjs');
  const lines = hygiene.nonCommentLines(abs);
  const hits = lines.filter((l) => l.indexOf('verification-stamp') !== -1 || l.indexOf('stamp-connections') !== -1);
  check('chain-executor.cjs: zero non-comment references to verification-stamp/stamp-connections', hits.length === 0, JSON.stringify(hits));
}

// ---------------------------------------------------------------------------
// stamp-connections is not a registry command.
// ---------------------------------------------------------------------------
function checkStampConnectionsNotARegistryCommand() {
  console.log('--- data/command-registry.json registers no stamp-connections command ---');
  const registry = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'command-registry.json'), 'utf8'));
  const commands = Array.isArray(registry.commands) ? registry.commands : [];
  const hit = commands.find((c) => typeof c.command === 'string' && c.command.indexOf('stamp-connections') !== -1);
  check('data/command-registry.json: no command entry contains "stamp-connections"', !hit, JSON.stringify(hit));
}

// ---------------------------------------------------------------------------
// find-connections keeps hitl_shape F.8 (the stamp rides the existing shape,
// no new reach id, no new HITL shape).
// ---------------------------------------------------------------------------
function checkFindConnectionsKeepsHitlShapeF8() {
  console.log('--- commands/find-connections.md keeps hitl_shape F.8 ---');
  const raw = fs.readFileSync(path.join(REPO, 'commands', 'find-connections.md'), 'utf8');
  const m = raw.match(/^hitl_shape:\s*"?([^"\n]+)"?\s*$/m);
  check('commands/find-connections.md: hitl_shape frontmatter key is present', !!m);
  check('commands/find-connections.md: hitl_shape === F.8', !!m && m[1].trim() === 'F.8', m && m[1]);
}

// ---------------------------------------------------------------------------
// The three born-wired gates exit 0.
// ---------------------------------------------------------------------------
function runGate(label, scriptRel) {
  const abs = path.join(REPO, scriptRel);
  const result = spawnSync(process.execPath, [abs, '--check'], { cwd: REPO, encoding: 'utf8' });
  check(label + ' exits 0', result.status === 0, 'status=' + result.status + ' stderr=' + String(result.stderr || '').slice(0, 500));
}

function checkBornWiredGates() {
  console.log('--- the three born-wired gates exit 0 ---');
  runGate('build-connector-registry.cjs --check', 'scripts/build-connector-registry.cjs');
  runGate('build-orchestration-projection.cjs --check', 'scripts/build-orchestration-projection.cjs');
  runGate('check-shape-declaration.cjs --check (advisory-WARN, no --strict)', 'scripts/check-shape-declaration.cjs');
}

// ---------------------------------------------------------------------------
// The posture-grid todo carries the folded data point.
// ---------------------------------------------------------------------------
function checkTodoDataPoint() {
  console.log('--- the posture-grid todo carries the folded Phase 355 data point ---');
  const todoPath = path.join(REPO, '.planning', 'todos', 'pending', '2026-09-08-autonomous-safe-posture-reversibility-audit.md');
  check('the posture-grid todo file exists', fs.existsSync(todoPath));
  const raw = fs.readFileSync(todoPath, 'utf8');
  check('the todo contains "## Data point: Phase 355 verification stamp"', raw.indexOf('## Data point: Phase 355 verification stamp') !== -1);
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

(async () => {
  try {
    checkPosture();
    checkNoNewReachId();
    checkChainExecutorNeverReferencesStamp();
    checkStampConnectionsNotARegistryCommand();
    checkFindConnectionsKeepsHitlShapeF8();
    checkBornWiredGates();
    checkTodoDataPoint();
  } finally {
    check('installNetGuard: zero fetch attempts', netGuard.attempts() === 0);
    netGuard.restore();
    console.log('scrubVendorKey found a pre-set TYPESAFE_API_KEY: ' + hadKey);
    process.exit(checker.summary());
  }
})();
