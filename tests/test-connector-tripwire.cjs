#!/usr/bin/env node
'use strict';

/*
 * Phase 143.3-02 Task 3 -- the CONN-03 tripwire test.
 *
 * Proves the four connector validations + the clean-tree pass:
 *   (1) reach_id not in the frozen 5 (REACH_IDS) is flagged
 *   (2) framework that does not resolve via commandsForFramework (WFL-01) is
 *       flagged for a command-firing connector
 *   (3) posture not in the frozen 3 (POSTURE_IDS) is flagged
 *   (4) a duplicate (sensor, reach, sub_mode) tuple is flagged
 *   (5) the CLEAN tree (the real commands/) passes --check with exit 0
 *
 * The four bad cases are constructed in memory and run through the exported
 * validateConnectors() helper (no subprocess, no temp fixture dir needed). The
 * clean-tree pass spawns the real generator with --check so the test exercises
 * the SAME code path the pre-commit hook runs.
 *
 * House rule: hyphens only, no em-dashes. Pure-local, zero Brain/network.
 */

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const GENERATOR = path.join(REPO_ROOT, 'scripts', 'build-connector-registry.cjs');
const gen = require(GENERATOR);
const { validateConnectors, buildRegistry } = gen;

let failures = 0;
function assert(cond, label) {
  if (cond) {
    console.log('  ok  ' + label);
  } else {
    console.error('  FAIL  ' + label);
    failures += 1;
  }
}

// ---------------------------------------------------------------------------
// (1) bad reach_id -> "frozen 5"
// ---------------------------------------------------------------------------
{
  const reg = {
    connectors: [
      {
        surface: '/mos:bad-reach',
        reach_id: 'bogus_reach',
        posture: 'hold',
        framework: 'Reverse Salient Analysis',
        filing: 'fileEvidenceWithReadback',
        sensor_triggers: ['SENS-99'],
        sub_mode: 'bad-reach',
      },
    ],
  };
  const errs = validateConnectors(reg);
  assert(
    errs.some((e) => e.indexOf('frozen 5') !== -1),
    'bad reach_id (bogus_reach) is flagged as not in the frozen 5'
  );
}

// ---------------------------------------------------------------------------
// (2) unresolvable framework -> "commandsForFramework" (connector fires a
// command because it declares a filing).
// ---------------------------------------------------------------------------
{
  const reg = {
    connectors: [
      {
        surface: '/mos:bad-framework',
        reach_id: 'context_block',
        posture: 'hold',
        framework: 'Totally Fake Nonexistent Framework',
        filing: 'fileEvidenceWithReadback',
        decision_surface: 'F.1',
        sensor_triggers: ['SENS-98'],
        sub_mode: 'bad-framework',
      },
    ],
  };
  const errs = validateConnectors(reg);
  assert(
    errs.some((e) => e.indexOf('commandsForFramework') !== -1),
    'unresolvable framework is flagged by the WFL-01 resolver-resolution guard'
  );
}

// ---------------------------------------------------------------------------
// (3) bad posture -> "frozen 3"
// ---------------------------------------------------------------------------
{
  const reg = {
    connectors: [
      {
        surface: '/mos:bad-posture',
        reach_id: 'context_block',
        posture: 'bogus_posture',
        framework: 'Reverse Salient Analysis',
        filing: 'fileEvidenceWithReadback',
        sensor_triggers: ['SENS-97'],
        sub_mode: 'bad-posture',
      },
    ],
  };
  const errs = validateConnectors(reg);
  assert(
    errs.some((e) => e.indexOf('frozen 3') !== -1),
    'bad posture (bogus_posture) is flagged as not in the frozen 3'
  );
}

// ---------------------------------------------------------------------------
// (4) duplicate (sensor, reach, sub_mode) tuple -> "duplicate connector tuple"
// ---------------------------------------------------------------------------
{
  const reg = {
    connectors: [
      {
        surface: '/mos:dup-a',
        reach_id: 'context_block',
        posture: 'hold',
        framework: 'HSI Semantic Surprise Analysis Assistant',
        filing: 'fileEvidenceWithReadback',
        sensor_triggers: ['SENS-06'],
        sub_mode: 'hsi',
      },
      {
        surface: '/mos:dup-b',
        reach_id: 'context_block',
        posture: 'hold',
        framework: 'HSI Semantic Surprise Analysis Assistant',
        filing: 'fileEvidenceWithReadback',
        sensor_triggers: ['SENS-06'],
        sub_mode: 'hsi',
      },
    ],
  };
  const errs = validateConnectors(reg);
  assert(
    errs.some((e) => e.indexOf('duplicate connector tuple') !== -1),
    'a duplicate (sensor, reach, sub_mode) tuple is flagged'
  );
}

// ---------------------------------------------------------------------------
// negative control: the legal distinct-sub_mode pair (score-innovation hsi vs
// whitespace) does NOT collide on the shared SENS-06 + context_block.
// ---------------------------------------------------------------------------
{
  const reg = {
    connectors: [
      {
        surface: '/mos:score-innovation',
        reach_id: 'context_block',
        posture: 'hold',
        framework: 'HSI Semantic Surprise Analysis Assistant',
        filing: 'fileEvidenceWithReadback',
        sensor_triggers: ['SENS-06'],
        sub_mode: 'hsi',
      },
      {
        surface: '/mos:whitespace',
        reach_id: 'context_block',
        posture: 'hold',
        framework: 'HSI Semantic Surprise Analysis Assistant',
        filing: 'fileEvidenceWithReadback',
        sensor_triggers: ['SENS-06'],
        sub_mode: 'whitespace',
      },
    ],
  };
  const errs = validateConnectors(reg);
  assert(
    !errs.some((e) => e.indexOf('duplicate connector tuple') !== -1),
    'distinct sub_mode (hsi vs whitespace) on shared SENS-06 + context_block is NOT a collision'
  );
}

// ---------------------------------------------------------------------------
// (5) clean tree: the real built registry validates clean, AND the generator
// --check exits 0 (the SAME path the pre-commit hook runs).
// ---------------------------------------------------------------------------
{
  const cleanErrs = validateConnectors(buildRegistry());
  assert(
    cleanErrs.length === 0,
    'the real built registry passes all four validations (0 errors)'
  );

  const res = spawnSync(process.execPath, [GENERATOR, '--check'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  assert(
    res.status === 0,
    'node scripts/build-connector-registry.cjs --check exits 0 on the clean tree'
  );
}

if (failures > 0) {
  console.error('\ntest-connector-tripwire: ' + failures + ' FAILURE(S)');
  process.exit(1);
}
console.log('\ntest-connector-tripwire: PASS (4 bad cases flagged + clean tree exits 0)');
