#!/usr/bin/env node
'use strict';

/*
 * Phase 274-01 - fixture tests for the widened script-tier classifier
 * (anchored / allowlisted / target), the sibling of test-271's citation-tier
 * suite for the bare `scripts/` invocation defect class (ANCHOR-01, ANCHOR-07).
 *
 * WHY THESE ARE FIXTURE-DRIVEN, NOT TREE-PINNED. Plans 274-02..04 anchor the
 * live 34+ sites this instrument measures, so any live count pinned here
 * would go red mid-phase for the fix landing, not the gate breaking -- the
 * same rationale test-271 documents for the citation tier. Every arm below
 * drives scanScriptInvocations() against synthetic markdown written into an
 * os.tmpdir() scratch directory, never the live repo tree.
 *
 * WHY THIS FILE IS EXPECTED TO FAIL RIGHT NOW (RED-first, matching this
 * session's own Phase 272/273 convention). It is written BEFORE Task 2
 * extends scanScriptInvocations() with the anchored/allowlisted/target shape
 * and adds SCRIPT_ALLOWLIST. Every arm below is wrapped so a missing field
 * or a not-yet-exported SCRIPT_ALLOWLIST reports as a diagnostic FAIL line,
 * never an uncaught exception -- the suite must run to completion in both
 * the RED state (before Task 2) and the GREEN state (after it).
 *
 * Eight arms (test-271's six-arm shape plus two new script-tier concerns):
 *   1. a bare `node scripts/foo.cjs` line yields exactly 1 site, anchored:false
 *   2. the widened verb set (python3, sh, npx) is matched, not just bash/node
 *   3. the ${CLAUDE_PLUGIN_ROOT}/ short anchor yields anchored:true, 0 violations
 *   4. the fail-closed long anchor yields anchored:true, 0 violations
 *   5. a ./scripts/foo.cjs cwd-relative fallback is detected, anchored:false
 *   6. a SCRIPT_ALLOWLIST entry suppresses a matching bare site; an entry
 *      with an empty reason is rejected by validateAllowlist()
 *   7. target-existence tagging: OK vs MISSING-TARGET
 *   8. allowed-tools permission-matcher exclusion still holds after widening
 *
 * Pure, deterministic, LOCAL-only: node:fs + node:os + node:path + the gate
 * module. Zero Brain, zero network.
 *
 * House rule: hyphens only, no em-dashes, no emoji.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const gate = require('../scripts/check-plugin-path-anchoring.cjs');
const { scanScriptInvocations, validateAllowlist } = gate;

let pass = 0;
let fail = 0;

function ok(cond, msg) {
  if (cond) {
    pass += 1;
    console.log(`  PASS: ${msg}`);
  } else {
    fail += 1;
    console.error(`  FAIL: ${msg}`);
  }
}

// Every scan is wrapped: before Task 2 lands, scanScriptInvocations() returns
// the OLD unclassified shape (no .anchored/.target/.violations), so a direct
// property access would throw and abort the whole suite instead of reporting
// a diagnostic RED. That would hide the RED baseline this file exists to
// prove, so every call site below goes through this guard instead.
function safeScan(label, fn) {
  try {
    return fn();
  } catch (e) {
    fail += 1;
    console.error(`  FAIL: ${label} (threw: ${e.message})`);
    return {};
  }
}

function arr(x) {
  return Array.isArray(x) ? x : [];
}

// A scratch root the gate scans instead of the live tree.
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-274-'));
fs.mkdirSync(path.join(ROOT, 'scripts'), { recursive: true });

function fixture(name, body) {
  fs.writeFileSync(path.join(ROOT, name), body, 'utf8');
  return name;
}

function realScript(name) {
  fs.writeFileSync(path.join(ROOT, 'scripts', name), '#!/usr/bin/env node\n// fixture stub\n', 'utf8');
}

// ---------------------------------------------------------------------------
// Arm 1: a bare `node scripts/foo.cjs` line yields exactly 1 site, unanchored.
// ---------------------------------------------------------------------------
console.log('\nArm 1: bare node invocation is detected, anchored:false');
realScript('foo.cjs');
const bare = fixture('bare.md', ['# Fixture', '', 'Run: node scripts/foo.cjs --room room/', ''].join('\n'));
const r1 = safeScan('arm1 scan', () => scanScriptInvocations('fixtures', [bare], ROOT));
ok(arr(r1.sites).length === 1, `bare invocation yields exactly 1 site (got ${arr(r1.sites).length})`);
ok(
  arr(r1.sites).length === 1 && r1.sites[0].anchored === false,
  `the bare site classifies anchored:false (got ${arr(r1.sites).length === 1 ? r1.sites[0].anchored : 'n/a'})`
);
ok(
  arr(r1.sites).length === 1 && r1.sites[0].line === 3,
  `the site is reported at line 3 (got ${arr(r1.sites).length === 1 ? r1.sites[0].line : 'n/a'})`
);

// ---------------------------------------------------------------------------
// Arm 2: the widened verb set (python3, sh, npx) is matched -- the pass-five
// blind spot named in 274-RESEARCH.md Pitfall 2.
// ---------------------------------------------------------------------------
console.log('\nArm 2: widened verb set (python3, sh, npx) is matched, not just bash/node');
realScript('render-pdf');
realScript('resolve-room');
realScript('doit.sh');
const widened = fixture(
  'widened.md',
  [
    '# Fixture',
    '',
    'python3 scripts/render-pdf {type} --room room/',
    'sh scripts/doit.sh',
    'npx scripts/resolve-room --check',
    '',
  ].join('\n')
);
const r2 = safeScan('arm2 scan', () => scanScriptInvocations('fixtures', [widened], ROOT));
ok(arr(r2.sites).length === 3, `python3/sh/npx all register as sites (got ${arr(r2.sites).length}, expected 3)`);
ok(
  arr(r2.sites).some((s) => s.token === 'scripts/render-pdf'),
  'the python3 site captures the script name without the {type} placeholder argument'
);
ok(
  arr(r2.sites).length > 0 && arr(r2.sites).every((s) => s.anchored === false),
  'all three widened-verb sites classify anchored:false (none are prefixed)'
);

// ---------------------------------------------------------------------------
// Arm 3: the ${CLAUDE_PLUGIN_ROOT}/ short anchor clears the violation.
// ---------------------------------------------------------------------------
console.log('\nArm 3: ${CLAUDE_PLUGIN_ROOT}/ anchored invocation is clean');
const short = fixture(
  'short-anchor.md',
  ['# Fixture', '', 'node "${CLAUDE_PLUGIN_ROOT}/scripts/foo.cjs" --room room/', ''].join('\n')
);
const r3 = safeScan('arm3 scan', () => scanScriptInvocations('fixtures', [short], ROOT));
ok(arr(r3.violations).length === 0, `short-anchored invocation yields 0 violations (got ${arr(r3.violations).length})`);
ok(
  arr(r3.anchored).length === 1,
  `short-anchored invocation is still COUNTED as a site (got ${arr(r3.anchored).length})`
);

// ---------------------------------------------------------------------------
// Arm 4: the fail-closed long anchor clears the violation.
// ---------------------------------------------------------------------------
console.log('\nArm 4: fail-closed long anchor is clean');
const long = fixture(
  'long-anchor.md',
  [
    '# Fixture',
    '',
    'node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found.}}/scripts/foo.cjs" --room room/',
    '',
  ].join('\n')
);
const r4 = safeScan('arm4 scan', () => scanScriptInvocations('fixtures', [long], ROOT));
ok(arr(r4.violations).length === 0, `long-anchored invocation yields 0 violations (got ${arr(r4.violations).length})`);
ok(
  arr(r4.anchored).length === 1,
  `long-anchored invocation is still COUNTED as a site (got ${arr(r4.anchored).length})`
);

// ---------------------------------------------------------------------------
// Arm 5: a ./scripts/foo.cjs cwd-relative fallback is DETECTED, not silently
// missed -- 274-RESEARCH.md Pitfall 3's "declared exception, not an accident
// of regex scope" framing.
// ---------------------------------------------------------------------------
console.log('\nArm 5: ./scripts/ cwd-relative fallback is detected, anchored:false');
const dotSlash = fixture(
  'dot-slash.md',
  ['# Fixture', '', 'Fall back to `node ./scripts/foo.cjs` if CLAUDE_PLUGIN_ROOT is unset.', ''].join('\n')
);
const r5 = safeScan('arm5 scan', () => scanScriptInvocations('fixtures', [dotSlash], ROOT));
ok(arr(r5.sites).length === 1, `./scripts/ line is detected as a site (got ${arr(r5.sites).length})`);
ok(
  arr(r5.sites).length === 1 && r5.sites[0].anchored === false,
  'the ./scripts/ site classifies anchored:false (a dot-slash prefix is not a plugin-root anchor)'
);

// ---------------------------------------------------------------------------
// Arm 6: SCRIPT_ALLOWLIST suppression + empty-reason rejection (reuses
// validateAllowlist() unmodified, per Canon Part 7).
// ---------------------------------------------------------------------------
console.log('\nArm 6: a reasoned SCRIPT_ALLOWLIST entry suppresses the violation');
const allowFile = fixture(
  'allowed.md',
  ['# Fixture', '', 'node scripts/foo.cjs --room room/  # deliberate fallback, see followup', ''].join('\n')
);
const before6 = safeScan('arm6 pre-check', () => scanScriptInvocations('fixtures', [allowFile], ROOT));
ok(
  arr(before6.violations).length === 1,
  `without an allowlist entry the site is a violation (got ${arr(before6.violations).length})`
);

if (Array.isArray(gate.SCRIPT_ALLOWLIST)) {
  const entry = {
    file: allowFile,
    pattern: 'scripts/foo.cjs',
    reason: 'fixture-only exception, exercised by arm 6 of this suite',
  };
  gate.SCRIPT_ALLOWLIST.push(entry);
  const r6 = safeScan('arm6 post-check', () => scanScriptInvocations('fixtures', [allowFile], ROOT));
  ok(
    arr(r6.violations).length === 0,
    `with a matching SCRIPT_ALLOWLIST entry the site is suppressed (got ${arr(r6.violations).length})`
  );
  ok(
    arr(r6.allowlisted).length === 1,
    'the suppressed site is reported under allowlisted, never dropped from the scan'
  );
  const idx = gate.SCRIPT_ALLOWLIST.indexOf(entry);
  if (idx !== -1) gate.SCRIPT_ALLOWLIST.splice(idx, 1);
} else {
  ok(false, 'gate.SCRIPT_ALLOWLIST is exported as an array (Task 2 not yet landed)');
  ok(false, 'SCRIPT_ALLOWLIST suppression is exercised (skipped: SCRIPT_ALLOWLIST not yet exported)');
}

let threwEmpty = false;
try {
  validateAllowlist([{ file: 'x.cjs', pattern: 'scripts/', reason: '' }]);
} catch {
  threwEmpty = true;
}
ok(threwEmpty, 'an allowlist entry with reason: "" throws (validateAllowlist reused unmodified)');

// ---------------------------------------------------------------------------
// Arm 7: target-existence tagging (OK vs MISSING-TARGET).
// ---------------------------------------------------------------------------
console.log('\nArm 7: target-existence tagging (OK vs MISSING-TARGET)');
realScript('exists.cjs');
const targetFixture = fixture(
  'targets.md',
  ['# Fixture', '', 'node scripts/exists.cjs --room room/', 'node scripts/does-not-exist.cjs --room room/', ''].join(
    '\n'
  )
);
const r7 = safeScan('arm7 scan', () => scanScriptInvocations('fixtures', [targetFixture], ROOT));
const okSite = arr(r7.sites).find((s) => s.token === 'scripts/exists.cjs');
const missingSite = arr(r7.sites).find((s) => s.token === 'scripts/does-not-exist.cjs');
ok(!!okSite && okSite.target === 'OK', `an existing script classifies target:OK (got ${okSite ? okSite.target : 'no site found'})`);
ok(
  !!missingSite && missingSite.target === 'MISSING-TARGET',
  `a dangling script classifies target:MISSING-TARGET (got ${missingSite ? missingSite.target : 'no site found'})`
);

// ---------------------------------------------------------------------------
// Arm 8: allowed-tools permission-matcher exclusion still holds after the
// verb widening (carried forward from test-271 Arm 6, against python3).
// ---------------------------------------------------------------------------
console.log('\nArm 8: permission-matcher exclusion holds for the widened verb set');
const matcherFile = fixture(
  'matcher.md',
  [
    '---',
    'name: export',
    'allowed-tools:',
    '  - Bash(python3 scripts/render-pdf:*)',
    '---',
    '',
    'Then run: python3 scripts/render-pdf {type} --room room/',
    '',
  ].join('\n')
);
const r8 = safeScan('arm8 scan', () => scanScriptInvocations('fixtures', [matcherFile], ROOT));
ok(
  arr(r8.sites).length === 1,
  `the matcher line is excluded, the real invocation on line 7 still counts (got ${arr(r8.sites).length} site)`
);
ok(r8.excluded === 1, `the permission-matcher exclusion is counted (got ${r8.excluded})`);

// ---------------------------------------------------------------------------
console.log(`\n${pass} passed, ${fail} failed`);
try {
  fs.rmSync(ROOT, { recursive: true, force: true });
} catch {
  /* scratch cleanup is best-effort */
}
process.exit(fail === 0 ? 0 : 1);
