'use strict';
// Phase 210-01 (Wave 0, item 210-A) -- the advisory-exit-code test stub for
// scripts/check-shape-declaration.cjs (the born-declared-shape gate, Phase 190
// base check + the three Phase 209-03 predicates, ALL going advisory per the
// CONTEXT.md open-questions addendum decision 1).
//
// Directions encoded:
//   Leg 1 (SOFTENED direction contract): `--check` is advisory by default -- it
//     exits 0 (warn, never block). Green today only because the live tree is
//     conformant; once plan 210-02 lands, exit 0 holds EVEN on a violating tree.
//   Leg 2 (PRESERVE FLOOR, green now and after): the pure predicates stay intact.
//     A synthetic surface missing hitl_shape is still DETECTED and its violation
//     ENUMERATED in the report -- the lint signal survives the softening.
//   Leg 3 (PRESERVE FLOOR, green now and after): checkTree() still scans the live
//     tree and enumerates from disk (no hardcoded surface counts, RETRO-07c).
//   Leg 4 (SOFTENED direction, EXPECTED RED until plan 210-02): `--check --strict`
//     is a recognized opt-in mode that restores the hard-fail contract (exit 1 on
//     a violating tree). Today '--strict' is not yet recognized, so the strict
//     acknowledgment is absent and this leg fails RED -- which is correct.
//
// House rule: hyphens only, no em-dashes. CJS, node built-ins only.

const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.join(__dirname, '..');
const SCRIPT = path.join(REPO, 'scripts', 'check-shape-declaration.cjs');
const mod = require(SCRIPT);

console.log('test-shape-declaration-advisory (Phase 210 Wave 0)');

let pass = 0;
let fail = 0;
function leg(desc, fn) {
  try {
    fn();
    pass += 1;
    console.log('  ok   (' + desc + ')');
  } catch (e) {
    fail += 1;
    if (e && (e.code === 'ERR_ASSERTION' || e.name === 'AssertionError')) {
      console.error('  RED  (' + desc + '): ' + e.message);
    } else {
      console.error('  ERROR(' + desc + '): harness error, NOT an assertion failure: ' + (e && e.stack ? e.stack : e));
    }
  }
}

// ---------------------------------------------------------------------------
// Leg 1 -- SOFTENED direction contract: --check exits 0 (advisory default).
// ---------------------------------------------------------------------------
leg('leg 1 SOFTENED contract: --check exits 0 (advisory default; warn, never block)', function () {
  const r = spawnSync(process.execPath, [SCRIPT, '--check'], { cwd: REPO, encoding: 'utf8' });
  assert.equal(r.status, 0,
    'advisory default: --check must exit 0 (plan 210-02 makes this hold even on a violating tree)');
});

// ---------------------------------------------------------------------------
// Leg 2 -- PRESERVE FLOOR: the pure predicates still DETECT and ENUMERATE a
// violation (a fixture surface declaring neither hitl_shape/hitl_stages nor a
// connector exclusion). The lint signal survives; only the exit code softens.
// ---------------------------------------------------------------------------
leg('leg 2 PRESERVE FLOOR: check() still detects and enumerates a missing-declaration violation', function () {
  const r = mod.check({ surface: 'commands/synthetic-210-missing-shape.md' });
  assert.equal(r.valid, false,
    'a surface missing every declaration form is still INVALID (predicates intact)');
  assert.equal(r.violations.length >= 1, true,
    'the violation is ENUMERATED, not swallowed');
  assert.equal(
    r.violations.some(function (v) { return v.indexOf('synthetic-210-missing-shape') !== -1; }),
    true,
    'the enumerated violation names the offending surface'
  );
});

// ---------------------------------------------------------------------------
// Leg 3 -- PRESERVE FLOOR: checkTree() still scans the live tree from disk.
// No hardcoded surface counts (RETRO-07c): assert shape, not a frozen literal.
// ---------------------------------------------------------------------------
leg('leg 3 PRESERVE FLOOR: checkTree() still scans the live tree and reports from disk', function () {
  const report = mod.checkTree();
  assert.equal(typeof report.ok, 'boolean', 'checkTree returns an ok verdict');
  assert.equal(Array.isArray(report.violations), true, 'checkTree returns an enumerable violations array');
  assert.equal(report.declared > 0, true,
    'the live tree has declared surfaces (enumerated from disk, never a frozen count)');
});

// ---------------------------------------------------------------------------
// Leg 4 -- SOFTENED direction (EXPECTED RED until plan 210-02): --strict is a
// recognized opt-in mode restoring the hard-fail contract. Recognition is
// observable: strict mode names itself in the run output, and on a violating
// tree it exits 1 (the pre-210 behavior, now opt-in). Today the flag is not yet
// recognized, so no strict acknowledgment appears -> RED, correctly.
// ---------------------------------------------------------------------------
leg('leg 4 SOFTENED: --check --strict is a recognized hard-fail opt-in mode (RED until plan 210-02)', function () {
  const r = spawnSync(process.execPath, [SCRIPT, '--check', '--strict'], { cwd: REPO, encoding: 'utf8' });
  const out = String(r.stdout || '') + String(r.stderr || '');
  assert.equal(r.status === 0 || r.status === 1, true,
    'strict mode runs the tree check (exit 0 clean / exit 1 violating), never a usage error');
  assert.equal(/strict/i.test(out), true,
    'SOFTENED direction: --strict must be RECOGNIZED (the run output names strict mode; on a violating tree it exits 1)');
});

console.log('\ntest-shape-declaration-advisory: ' + pass + ' passed, ' + fail + ' failed'
  + (fail > 0 ? ' (softened-direction RED legs are EXPECTED until plan 210-02 lands)' : ''));
process.exit(fail > 0 ? 1 : 0);
