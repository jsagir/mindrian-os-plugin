#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick task 20260702-help-coverage-gate -- the born-listed /mos:help coverage
 * gate contract test.
 *
 * /mos:help promises EVERY user-facing command appears in its selector menu, but
 * data/help-groups.json is hand-maintained and drifted (13 commands silently
 * absent) because scripts/check-help-coverage.cjs -- which enforces coverage --
 * shipped in 121.5-07 yet was never wired into scripts/install-pre-commit.sh.
 * This test locks the gate's born-listed contract so the drift can never return:
 *
 *   1. GREEN: the gate exits 0 against the live (now-backfilled) manifest.
 *   2. RED (missing): a user-facing command absent from the manifest is caught
 *      (missing_from_groups) -- the drift class that was silently RED.
 *   3. RED (ghost): a grouped name with no command file is caught
 *      (orphan_in_groups) -- a "true ghost".
 *   4. RED (unlisted deprecation): a deprecated:true command NOT listed in the
 *      deprecated_aliases exclusion registry is caught (unlisted_deprecated) --
 *      so a deprecation can never silently vanish from coverage (born-listed,
 *      not born-absent).
 *   5. EXCLUSION is in-shape: an admin (visibility:admin) and a listed
 *      deprecated command are both correctly excluded (gate stays green).
 *   6. WIRING: scripts/install-pre-commit.sh wires the gate (idempotency grep +
 *      a guard block gated on commands/*.md or data/help-groups.json).
 *
 * quick-260705-sd5 adds the family-JTBD coherence class (each family declares a
 * jtbd outcome list; every member's serves_jtbd must intersect it):
 *
 *   7. RED (jtbd_incoherent): a member whose serves_jtbd shares nothing with its
 *      family's declared jtbd is caught.
 *   8. RED (jtbd_incoherent): a member with NO serves_jtbd at all is caught (the
 *      Task 1 gap class, now unrepresentable).
 *   9. RED (jtbd_missing_declaration): a family with no jtbd list is caught.
 *  10. RED (jtbd_unknown_tag): a family jtbd tag outside the run-time disk
 *      vocabulary (never a frozen literal) is caught.
 *
 * The RED cases run the SAME shipped check() over an isolated fixture tree
 * (check({commandsDir, groupsPath})) -- one gate, exercised over fixtures, never
 * a fork (Canon Part 7). Mirrors the CJS pass/failTest counter pattern used by
 * tests/test-help-selector-lanes.cjs. Registered additively in
 * lib/memory/run-feynman-tests.cjs.
 *
 * Canon Part 8 (Graph Boundary): filesystem only -- zero network, zero Brain.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const CHECKER = path.join(REPO_ROOT, 'scripts', 'check-help-coverage.cjs');
const INSTALLER = path.join(REPO_ROOT, 'scripts', 'install-pre-commit.sh');
const { check } = require(CHECKER);

let passed = 0;
let failed = 0;
function pass(name) { passed += 1; console.log('PASS: ' + name); }
function failTest(name, err) { failed += 1; console.log('FAIL: ' + name + '\n    ' + ((err && err.message) || err)); }

// Build an isolated fixture tree: a commands/ dir of .md files + a groups json.
// cmds: { name: frontmatterObject }. groups: the help-groups.json shape.
function makeFixture(cmds, groups) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'help-cov-'));
  const cmdDir = path.join(root, 'commands');
  fs.mkdirSync(cmdDir);
  for (const [name, fm] of Object.entries(cmds)) {
    const lines = Object.entries(fm).map(([k, v]) => k + ': ' + v);
    fs.writeFileSync(
      path.join(cmdDir, name + '.md'),
      '---\n' + lines.join('\n') + '\n---\n# ' + name + '\n'
    );
  }
  const groupsPath = path.join(root, 'help-groups.json');
  fs.writeFileSync(groupsPath, JSON.stringify(groups, null, 2));
  return { root, commandsDir: cmdDir, groupsPath };
}
function cleanup(fx) { fs.rmSync(fx.root, { recursive: true, force: true }); }

// A minimal well-formed baseline fixture: one live command placed in one group,
// one admin command, one deprecated command listed in the exclusion registry.
function baseline() {
  const cmds = {
    alpha: { help_jtbd: '"Do alpha."', serves_jtbd: '["explore"]' },
    admin: { visibility: 'admin', help_jtbd: '"Admin only."' },
    oldcmd: { deprecated: 'true', help_jtbd: '"Old (deprecated)."' },
  };
  const groups = {
    groups: [
      { id: 'g1', label: 'G1', commands: ['alpha'], lane: 'start', jtbd: ['explore'] },
    ],
    deprecated_aliases: { _note: 'registry', oldcmd: 'alpha' },
  };
  return { cmds, groups };
}

// --- Test 1: GREEN against the live backfilled manifest -------------------
try {
  const r = check();
  assert.strictEqual(r.valid, true,
    'live gate is green; got ' + JSON.stringify({
      missing_from_groups: r.missing_from_groups,
      orphan_in_groups: r.orphan_in_groups,
      unlisted_deprecated: r.unlisted_deprecated,
      deprecated_in_groups: r.deprecated_in_groups,
      orphan_excluded: r.orphan_excluded,
    }));
  pass('Test 1 (gate green on the live backfilled manifest)');
} catch (err) { failTest('Test 1 (gate green on the live backfilled manifest)', err); }

// --- Test 2: baseline fixture is itself green (control) -------------------
try {
  const { cmds, groups } = baseline();
  const fx = makeFixture(cmds, groups);
  try {
    const r = check({ commandsDir: fx.commandsDir, groupsPath: fx.groupsPath });
    assert.strictEqual(r.valid, true, 'baseline fixture is green; got ' + JSON.stringify(r));
  } finally { cleanup(fx); }
  pass('Test 2 (baseline fixture: live + admin-excluded + listed-deprecated is green)');
} catch (err) { failTest('Test 2 (baseline fixture control)', err); }

// --- Test 3: RED (missing) -- a user-facing command absent from groups ----
try {
  const { cmds, groups } = baseline();
  cmds.beta = { help_jtbd: '"Do beta."' }; // live command, NOT in any group
  const fx = makeFixture(cmds, groups);
  try {
    const r = check({ commandsDir: fx.commandsDir, groupsPath: fx.groupsPath });
    assert.strictEqual(r.valid, false, 'gate fails when a user-facing command is unplaced');
    assert.ok(r.missing_from_groups.includes('beta'),
      'beta is reported missing_from_groups; got ' + JSON.stringify(r.missing_from_groups));
  } finally { cleanup(fx); }
  pass('Test 3 (RED: user-facing command absent from the manifest is caught)');
} catch (err) { failTest('Test 3 (RED missing command)', err); }

// --- Test 4: RED (ghost) -- a grouped name with no command file -----------
try {
  const { cmds, groups } = baseline();
  groups.groups[0].commands.push('phantom'); // in a group, but no phantom.md
  const fx = makeFixture(cmds, groups);
  try {
    const r = check({ commandsDir: fx.commandsDir, groupsPath: fx.groupsPath });
    assert.strictEqual(r.valid, false, 'gate fails on a ghost command');
    assert.ok(r.orphan_in_groups.includes('phantom'),
      'phantom is reported orphan_in_groups; got ' + JSON.stringify(r.orphan_in_groups));
  } finally { cleanup(fx); }
  pass('Test 4 (RED: grouped name with no command file -- a true ghost -- is caught)');
} catch (err) { failTest('Test 4 (RED ghost)', err); }

// --- Test 5: RED (unlisted deprecation) -- deprecated:true not registered --
try {
  const { cmds, groups } = baseline();
  cmds.stale = { deprecated: 'true', help_jtbd: '"Stale."' }; // deprecated, NOT in registry
  const fx = makeFixture(cmds, groups);
  try {
    const r = check({ commandsDir: fx.commandsDir, groupsPath: fx.groupsPath });
    assert.strictEqual(r.valid, false, 'gate fails when a deprecation is not born-listed');
    assert.ok(r.unlisted_deprecated.includes('stale'),
      'stale is reported unlisted_deprecated; got ' + JSON.stringify(r.unlisted_deprecated));
    // It must NOT be mislabelled as missing_from_groups (deprecated != unplaced).
    assert.ok(!r.missing_from_groups.includes('stale'),
      'a deprecated command is not reported as missing_from_groups');
  } finally { cleanup(fx); }
  pass('Test 5 (RED: deprecated:true not listed in deprecated_aliases is caught)');
} catch (err) { failTest('Test 5 (RED unlisted deprecation)', err); }

// --- Test 6: RED (deprecated leaked into a group) -------------------------
try {
  const { cmds, groups } = baseline();
  groups.groups[0].commands.push('oldcmd'); // deprecated command placed in a group
  const fx = makeFixture(cmds, groups);
  try {
    const r = check({ commandsDir: fx.commandsDir, groupsPath: fx.groupsPath });
    assert.strictEqual(r.valid, false, 'gate fails when a deprecated command leaks into a group');
    assert.ok(r.deprecated_in_groups.includes('oldcmd'),
      'oldcmd is reported deprecated_in_groups; got ' + JSON.stringify(r.deprecated_in_groups));
  } finally { cleanup(fx); }
  pass('Test 6 (RED: deprecated command leaked into a group is caught)');
} catch (err) { failTest('Test 6 (RED deprecated in group)', err); }

// --- Test 7: WIRING -- install-pre-commit.sh wires the gate ---------------
try {
  const sh = fs.readFileSync(INSTALLER, 'utf8');
  // Idempotency grep must include the gate so a re-run recognizes it as installed.
  assert.ok(/grep -q "check-help-coverage\.cjs"/.test(sh),
    'installer idempotency check greps for check-help-coverage.cjs');
  // A guard block must invoke the gate.
  assert.ok(/check-help-coverage\.cjs/.test(sh) && /scripts\/check-help-coverage\.cjs/.test(sh),
    'installer invokes scripts/check-help-coverage.cjs');
  // The trigger must be path-scoped to the surfaces that can drift coverage.
  assert.ok(/commands\/\.\*\\\.md\|data\/help-groups\\\.json/.test(sh),
    'installer gates the check on staged commands/*.md or data/help-groups.json');
  pass('Test 7 (install-pre-commit.sh wires the help-coverage gate)');
} catch (err) { failTest('Test 7 (pre-commit wiring)', err); }

// --- Test 8: RED (jtbd_incoherent) -- member shares no JTBD with its family
// quick-260705-sd5 coherence gate: a command placed in a family whose
// serves_jtbd intersects nothing in the family's declared jtbd is caught.
try {
  const { cmds, groups } = baseline();
  cmds.gamma = { help_jtbd: '"Do gamma."', serves_jtbd: '["build"]' };
  groups.groups[0].commands.push('gamma'); // g1.jtbd=[explore], gamma serves [build]
  const fx = makeFixture(cmds, groups);
  try {
    const r = check({ commandsDir: fx.commandsDir, groupsPath: fx.groupsPath });
    assert.strictEqual(r.valid, false, 'gate fails when a member shares no JTBD with its family');
    assert.ok(r.jtbd_incoherent.some((s) => s.startsWith('gamma ')),
      'gamma is reported jtbd_incoherent; got ' + JSON.stringify(r.jtbd_incoherent));
  } finally { cleanup(fx); }
  pass('Test 8 (RED: family member sharing no JTBD with its family is caught)');
} catch (err) { failTest('Test 8 (RED jtbd_incoherent)', err); }

// --- Test 9: RED (jtbd_incoherent) -- member with NO serves_jtbd at all -----
// This locks the Task 1 gap class (a command with zero serves_jtbd) as a hard
// fail inside a family, so it can never silently return.
try {
  const { cmds, groups } = baseline();
  cmds.delta = { help_jtbd: '"Do delta."' }; // no serves_jtbd frontmatter at all
  groups.groups[0].commands.push('delta');
  const fx = makeFixture(cmds, groups);
  try {
    const r = check({ commandsDir: fx.commandsDir, groupsPath: fx.groupsPath });
    assert.strictEqual(r.valid, false, 'gate fails when a member has no serves_jtbd');
    assert.ok(r.jtbd_incoherent.some((s) => s.startsWith('delta ')),
      'delta is reported jtbd_incoherent; got ' + JSON.stringify(r.jtbd_incoherent));
  } finally { cleanup(fx); }
  pass('Test 9 (RED: family member with no serves_jtbd is caught)');
} catch (err) { failTest('Test 9 (RED no serves_jtbd in a group)', err); }

// --- Test 10: RED (jtbd_missing_declaration) -- group with no jtbd list ------
try {
  const { cmds, groups } = baseline();
  delete groups.groups[0].jtbd; // strip the declaration
  const fx = makeFixture(cmds, groups);
  try {
    const r = check({ commandsDir: fx.commandsDir, groupsPath: fx.groupsPath });
    assert.strictEqual(r.valid, false, 'gate fails when a group declares no jtbd');
    assert.ok(r.jtbd_missing_declaration.includes('g1'),
      'g1 is reported jtbd_missing_declaration; got ' + JSON.stringify(r.jtbd_missing_declaration));
  } finally { cleanup(fx); }
  pass('Test 10 (RED: group missing its jtbd declaration is caught)');
} catch (err) { failTest('Test 10 (RED missing jtbd declaration)', err); }

// --- Test 11: RED (jtbd_unknown_tag) -- declared tag absent from disk vocab --
// The vocabulary is the run-time union of every non-admin command's serves_jtbd,
// never a frozen literal a drifted edit could silently satisfy (T-sd5-01).
try {
  const { cmds, groups } = baseline();
  groups.groups[0].jtbd = ['not-a-real-tag']; // outside the disk vocabulary
  const fx = makeFixture(cmds, groups);
  try {
    const r = check({ commandsDir: fx.commandsDir, groupsPath: fx.groupsPath });
    assert.strictEqual(r.valid, false, 'gate fails when a group jtbd tag is outside the vocabulary');
    assert.ok(r.jtbd_unknown_tag.some((s) => s.includes('not-a-real-tag')),
      'unknown tag is reported jtbd_unknown_tag; got ' + JSON.stringify(r.jtbd_unknown_tag));
  } finally { cleanup(fx); }
  pass('Test 11 (RED: group jtbd tag outside the disk vocabulary is caught)');
} catch (err) { failTest('Test 11 (RED unknown jtbd tag)', err); }

if (failed > 0) {
  console.log('\n' + failed + ' test(s) FAILED (' + passed + ' passed)');
  process.exit(1);
}
console.log('\nAll ' + passed + ' tests PASS');
process.exit(0);
