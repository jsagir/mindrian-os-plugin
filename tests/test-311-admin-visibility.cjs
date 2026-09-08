'use strict';
/*
 * Phase 311 (SEED-052 smallest slice) -- test-311-admin-visibility.
 *
 * Closes a live, measured leak: before this phase,
 * `rankForSelector({ roomState: {}, k: 3 })` returned
 * ['/mos:act', '/mos:admin', '/mos:agentshield'] -- `/mos:admin` was the
 * number 2 recommendation for every navigator, admin or not (measured
 * 2026-09-08, this exact tree, before any Phase 311 change landed).
 *
 * Covers:
 *   Cases 1-6  Task 2: fail-closed opts.isAdmin filter on lib/workflow/
 *              f-selector-ranker.cjs, proven against a fixture registry and
 *              (case 6) against the real, regenerated registry.
 *   Cases 7-11 land in Task 3, appended to this same file: the three
 *              navigator-facing call sites wiring isAdmin via
 *              checkAdminIdentity(), the scope boundary
 *              (lib/hmi/dial-reach-orchestrator.cjs untouched), and the
 *              anti-reimplementation grep across all five touched files.
 *
 * Three-surface compatible: pure CJS, node:assert, no db / no fs writes /
 * no Brain / no network beyond local file reads of this repo's own source.
 *
 * No em-dashes (CLAUDE.md HARD RULE).
 */
const assert = require('node:assert');
const path = require('node:path');

const RANKER_PATH = path.resolve(__dirname, '..', 'lib', 'workflow', 'f-selector-ranker.cjs');

function loadRanker() {
  delete require.cache[require.resolve(RANKER_PATH)];
  return require(RANKER_PATH);
}

// Fixture: 3 commands, all with non-empty jtbd_summary + teaching (so D6 and
// D11's existing fail-closed guards do not filter them before the new guard
// is even reached). Exactly one carries visibility: 'admin'.
const FIXTURE_REGISTRY = {
  commands: [
    {
      command: '/mos:fixture-normal',
      kind: 'methodology',
      frameworks: ['Fixture Framework A'],
      serves_jtbd: ['fixture-jtbd'],
      jtbd_label: 'Fixture Normal',
      jtbd_summary: 'A normal, non-admin fixture command.',
      teaching: 'Use this fixture command when testing the normal, unfiltered path.',
      autonomous_safe: true,
    },
    {
      command: '/mos:fixture-public',
      kind: 'methodology',
      frameworks: ['Fixture Framework B'],
      serves_jtbd: ['fixture-jtbd'],
      jtbd_label: 'Fixture Public',
      jtbd_summary: 'A fixture command with an explicit non-admin visibility value.',
      teaching: 'Use this fixture command to prove the filter is admin-specific, not a general gate.',
      autonomous_safe: true,
      visibility: 'public',
    },
    {
      command: '/mos:fixture-admin',
      kind: 'utility',
      frameworks: ['Fixture Framework C'],
      serves_jtbd: ['fixture-jtbd'],
      jtbd_label: 'Fixture Admin',
      jtbd_summary: 'A fixture command that is admin-visibility only.',
      teaching: 'Use this fixture command to prove the fail-closed admin filter.',
      autonomous_safe: true,
      visibility: 'admin',
    },
  ],
};

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log('  ok - ' + name);
  } catch (e) {
    failures++;
    console.error('  FAIL - ' + name + ': ' + e.message);
  }
}

function commandsOf(items) {
  return items.map((i) => i.command);
}

// ---------------------------------------------------------------------------
// Cases 1-6 (Task 2): fail-closed opts.isAdmin filter
// ---------------------------------------------------------------------------

check('case 1: isAdmin omitted -- admin-visibility candidate ABSENT (fail-closed default)', () => {
  const ranker = loadRanker();
  ranker._test._resetCaches();
  ranker._test._setRegistry(FIXTURE_REGISTRY);
  const items = ranker.rankForSelector({ roomState: {}, k: 3 });
  ranker._test._resetCaches();
  assert(!commandsOf(items).includes('/mos:fixture-admin'), 'admin fixture leaked with isAdmin omitted');
});

check('case 2: isAdmin: false -- admin-visibility candidate ABSENT', () => {
  const ranker = loadRanker();
  ranker._test._resetCaches();
  ranker._test._setRegistry(FIXTURE_REGISTRY);
  const items = ranker.rankForSelector({ roomState: {}, k: 3, isAdmin: false });
  ranker._test._resetCaches();
  assert(!commandsOf(items).includes('/mos:fixture-admin'), 'admin fixture leaked with isAdmin: false');
});

check('case 3: isAdmin: true -- admin-visibility candidate IS present', () => {
  const ranker = loadRanker();
  ranker._test._resetCaches();
  ranker._test._setRegistry(FIXTURE_REGISTRY);
  const items = ranker.rankForSelector({ roomState: {}, k: 3, isAdmin: true });
  ranker._test._resetCaches();
  assert(commandsOf(items).includes('/mos:fixture-admin'), 'admin fixture missing with isAdmin: true');
});

check('case 4: isAdmin: "true" (string) -- admin-visibility candidate ABSENT (strict === true read)', () => {
  const ranker = loadRanker();
  ranker._test._resetCaches();
  ranker._test._setRegistry(FIXTURE_REGISTRY);
  const items = ranker.rankForSelector({ roomState: {}, k: 3, isAdmin: 'true' });
  ranker._test._resetCaches();
  assert(!commandsOf(items).includes('/mos:fixture-admin'), 'admin fixture leaked with isAdmin as the string "true"');
});

check('case 5: non-admin visibility values unaffected under isAdmin: false', () => {
  const ranker = loadRanker();
  ranker._test._resetCaches();
  ranker._test._setRegistry(FIXTURE_REGISTRY);
  const items = ranker.rankForSelector({ roomState: {}, k: 3, isAdmin: false });
  ranker._test._resetCaches();
  const cmds = commandsOf(items);
  assert(cmds.includes('/mos:fixture-public'), 'public-visibility fixture wrongly filtered');
  assert(cmds.includes('/mos:fixture-normal'), 'no-visibility fixture wrongly filtered');
});

check('case 6: live-registry regression anchor -- non-admin top-3 excludes /mos:admin and /mos:dogfood-flush', () => {
  const ranker = loadRanker();
  ranker._test._resetCaches();
  const items = ranker.rankForSelector({ roomState: {}, k: 3 });
  const cmds = commandsOf(items);
  assert(!cmds.includes('/mos:admin'), 'LEAK: /mos:admin present in non-admin top-3: ' + cmds.join(', '));
  assert(!cmds.includes('/mos:dogfood-flush'), 'LEAK: /mos:dogfood-flush present in non-admin top-3: ' + cmds.join(', '));
});

if (failures > 0) {
  console.error('test-311-admin-visibility: ' + failures + ' assertion(s) FAILED');
  process.exit(1);
}
console.log('test-311-admin-visibility: GREEN (fail-closed isAdmin filter proven on fixture + real registry)');
process.exit(0);
