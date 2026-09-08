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
 *   Cases 7-11 Task 3: the three navigator-facing call sites wire isAdmin
 *              via checkAdminIdentity(), the scope boundary
 *              (lib/hmi/dial-reach-orchestrator.cjs untouched), and the
 *              anti-reimplementation grep across all five touched files.
 *
 * Three-surface compatible: pure CJS, node:assert, no db / no fs writes /
 * no Brain / no network beyond local file reads of this repo's own source.
 *
 * No em-dashes (CLAUDE.md HARD RULE).
 */
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

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

// ---------------------------------------------------------------------------
// Cases 7-11 (Task 3): call-site wiring + scope boundary
// ---------------------------------------------------------------------------

check('case 7: navigation-engine-offer.cjs computes and passes a boolean isAdmin into rankForSelector', () => {
  const rankerExportsPath = require.resolve(RANKER_PATH);
  delete require.cache[rankerExportsPath];
  const realRanker = require(RANKER_PATH);
  const realRankForSelector = realRanker.rankForSelector;
  let captured = null;
  require.cache[rankerExportsPath].exports = Object.assign({}, realRanker, {
    rankForSelector(args) {
      captured = args;
      return realRankForSelector(args);
    },
  });
  try {
    const offerPath = require.resolve('../lib/core/navigation-engine-offer.cjs');
    delete require.cache[offerPath];
    const offer = require(offerPath);
    offer.resolveOffer({ roomState: {} });
    assert(captured !== null, 'resolveOffer never called rankForSelector');
    assert(typeof captured.isAdmin === 'boolean', 'isAdmin was not a boolean in resolveOffer args: ' + typeof captured.isAdmin);
    delete require.cache[offerPath];
  } finally {
    delete require.cache[rankerExportsPath];
  }
});

check('case 8: unknowns/orchestrator.cjs computes and passes a boolean isAdmin into rankForSelector', () => {
  const rankerExportsPath = require.resolve(RANKER_PATH);
  delete require.cache[rankerExportsPath];
  const realRanker = require(RANKER_PATH);
  const realRankForSelector = realRanker.rankForSelector;
  let captured = null;
  require.cache[rankerExportsPath].exports = Object.assign({}, realRanker, {
    rankForSelector(args) {
      captured = args;
      return realRankForSelector(args);
    },
  });
  try {
    const orchestratorPath = require.resolve('../lib/core/unknowns/orchestrator.cjs');
    delete require.cache[orchestratorPath];
    const orchestrator = require(orchestratorPath);
    orchestrator.rankIntoSelector({
      scanResult: { findings: { nodes: [], edges: [] } },
      corpusSize: 0,
    });
    assert(captured !== null, 'rankIntoSelector never called rankForSelector');
    assert(typeof captured.isAdmin === 'boolean', 'isAdmin was not a boolean in rankIntoSelector args: ' + typeof captured.isAdmin);
    delete require.cache[orchestratorPath];
  } finally {
    delete require.cache[rankerExportsPath];
  }
});

check('case 9: scripts/suggest-next-command.cjs requires check-admin-identity.cjs and wires isAdmin into the rankForSelector call', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'suggest-next-command.cjs'), 'utf8');
  assert(src.includes('check-admin-identity'), 'suggest-next-command.cjs does not require check-admin-identity.cjs');
  const callStart = src.indexOf('ranker.rankForSelector({');
  assert(callStart !== -1, 'suggest-next-command.cjs has no ranker.rankForSelector({ call');
  const braceStart = src.indexOf('{', callStart);
  let depth = 0;
  let i = braceStart;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  const argLiteral = src.slice(braceStart, i + 1);
  assert(argLiteral.includes('isAdmin'), 'isAdmin token not found inside the ranker.rankForSelector({...}) argument literal');
});

check('case 10: no second admin-identity heuristic across all five touched source files', () => {
  const files = [
    'scripts/build-command-registry.cjs',
    'lib/workflow/f-selector-ranker.cjs',
    'lib/core/navigation-engine-offer.cjs',
    'lib/core/unknowns/orchestrator.cjs',
    'scripts/suggest-next-command.cjs',
  ];
  const needles = ['MOS_ADMIN', 'process.env.USER', 'process.env.USERNAME', 'process.env.HOME', 'jsagi', 'jonathan'];
  for (const f of files) {
    const abs = path.resolve(__dirname, '..', f);
    const src = fs.readFileSync(abs, 'utf8');
    for (const needle of needles) {
      assert(!src.includes(needle), f + ' contains reimplemented admin-identity token: ' + needle);
    }
  }
});

check('case 11: scope boundary held -- dial-reach-orchestrator.cjs and admin-command-gate.cjs are byte-identical to their pinned pre-phase hashes', () => {
  const pins = {
    'lib/hmi/dial-reach-orchestrator.cjs':
      '2efb5d605f6b85511acace85d28ead048a32c3bcc6979c46ae85cfeded6867cf',
    'scripts/admin-command-gate.cjs':
      '2407b7853e5e95fcdb39d7455448bcc2df8574b3ac6825dc1b13bf69aa79a670',
  };
  for (const [rel, expected] of Object.entries(pins)) {
    const abs = path.resolve(__dirname, '..', rel);
    const buf = fs.readFileSync(abs);
    const got = crypto.createHash('sha256').update(buf).digest('hex');
    assert.strictEqual(
      got,
      expected,
      'SCOPE BREACH: ' + rel + ' changed (expected ' + expected + ', got ' + got + '). ' +
        'Do NOT update this pin silently -- surface it, this phase must change neither file.'
    );
  }
});

if (failures > 0) {
  console.error('test-311-admin-visibility: ' + failures + ' assertion(s) FAILED');
  process.exit(1);
}
console.log('test-311-admin-visibility: GREEN (fail-closed isAdmin filter proven on fixture + real registry; 3 call sites wired; scope boundary held)');
process.exit(0);
