#!/usr/bin/env node
'use strict';

/*
 * Phase 271-01 - fixture tests for the bare-plugin-path anchoring gate.
 *
 * WHY THESE ARE FIXTURE-DRIVEN, NOT TREE-PINNED. Plans 271-03 and 271-04 anchor
 * the live markdown surfaces, so every live violation count in this repo drops to
 * zero over the course of the phase. A test that asserted "the gate finds 139
 * violations" would go red mid-phase for exactly the wrong reason: the fix
 * landing, not the gate breaking. So every arm below drives scanSurface() against
 * synthetic markdown written into an os.tmpdir() scratch directory. The gate's
 * VERDICT LOGIC is what is pinned here; the tree's current state is not.
 *
 * Six arms, one per behavior in 271-01 Task 2:
 *   1. a bare backticked citation is exactly 1 violation
 *   2. the ${CLAUDE_PLUGIN_ROOT}/ short anchor is 0 violations
 *   3. the fail-closed ${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?...}}/ long
 *      anchor is 0 violations
 *   4. an injected allowlist entry matching file+pattern is 0 violations
 *   5. an allowlist entry with an empty reason is REJECTED, never passed silently
 *   6. an allowed-tools permission matcher contributes 0 to the advisory tier,
 *      while a real invocation on the next line still counts
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
const { scanSurface, scanScriptInvocations, validateAllowlist } = gate;

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

// A scratch root the gate scans instead of the live tree.
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-271-'));

function fixture(name, body) {
  fs.writeFileSync(path.join(ROOT, name), body, 'utf8');
  return name;
}

function violationsOf(name, allowlist) {
  const r = scanSurface('fixtures', [name], { root: ROOT, allowlist: allowlist || [] });
  return r.violations;
}

// ---------------------------------------------------------------------------
// Arm 1: a bare backticked citation is a violation.
// ---------------------------------------------------------------------------
console.log('\nArm 1: bare backticked citation is detected');
const bare = fixture(
  'bare.md',
  ['# Fixture', '', '1. Read `references/personality/voice-dna.md` for Larry\'s voice', ''].join('\n')
);
const v1 = violationsOf(bare);
ok(v1.length === 1, `bare citation yields exactly 1 violation (got ${v1.length})`);
ok(v1.length === 1 && v1[0].line === 3, `violation is reported at line 3 (got ${v1.length === 1 ? v1[0].line : 'n/a'})`);
ok(
  v1.length === 1 && v1[0].token === 'references/personality/voice-dna.md',
  'violation carries the matched token verbatim'
);

// ---------------------------------------------------------------------------
// Arm 2: the short anchor clears the violation.
// ---------------------------------------------------------------------------
console.log('\nArm 2: ${CLAUDE_PLUGIN_ROOT}/ anchored citation is clean');
const short = fixture(
  'short-anchor.md',
  [
    '# Fixture',
    '',
    '1. Read `${CLAUDE_PLUGIN_ROOT}/references/personality/voice-dna.md` for Larry\'s voice',
    '',
  ].join('\n')
);
const r2 = scanSurface('fixtures', [short], { root: ROOT, allowlist: [] });
ok(r2.violations.length === 0, `short-anchored citation yields 0 violations (got ${r2.violations.length})`);
ok(r2.anchored.length === 1, `short-anchored citation is still COUNTED as a site (got ${r2.anchored.length})`);

// ---------------------------------------------------------------------------
// Arm 3: the fail-closed long anchor clears the violation.
// ---------------------------------------------------------------------------
console.log('\nArm 3: fail-closed long anchor is clean');
const long = fixture(
  'long-anchor.md',
  [
    '# Fixture',
    '',
    'Read `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS root unresolved}}/references/personality/voice-dna.md`',
    '',
  ].join('\n')
);
const r3 = scanSurface('fixtures', [long], { root: ROOT, allowlist: [] });
ok(r3.violations.length === 0, `long-anchored citation yields 0 violations (got ${r3.violations.length})`);
ok(r3.anchored.length === 1, `long-anchored citation is still COUNTED as a site (got ${r3.anchored.length})`);

// ---------------------------------------------------------------------------
// Arm 4: an injected allowlist entry suppresses the violation.
// ---------------------------------------------------------------------------
console.log('\nArm 4: a reasoned allowlist entry suppresses the violation');
const allow = fixture(
  'allowed.md',
  ['# Fixture', '', 'Only then write the summary into `references/capability-radar/changelog-cache.md`.', ''].join('\n')
);
const before4 = violationsOf(allow);
ok(before4.length === 1, `without an allowlist the site is a violation (got ${before4.length})`);
const r4 = scanSurface('fixtures', [allow], {
  root: ROOT,
  allowlist: [
    {
      file: allow,
      pattern: 'references/capability-radar/',
      reason: 'fixture-only exception, exercised by arm 4 of this suite',
    },
  ],
});
ok(r4.violations.length === 0, `with a matching allowlist entry the site is suppressed (got ${r4.violations.length})`);
ok(r4.allowlisted.length === 1, 'the suppressed site is reported under allowlisted, never dropped from the scan');

// A non-matching pattern must NOT suppress: an allowlist is a scalpel, not a mute.
const r4b = scanSurface('fixtures', [allow], {
  root: ROOT,
  allowlist: [{ file: allow, pattern: 'references/methodology/', reason: 'deliberately non-matching pattern' }],
});
ok(r4b.violations.length === 1, `a non-matching allowlist pattern does NOT suppress (got ${r4b.violations.length})`);

// ---------------------------------------------------------------------------
// Arm 5: an unreasoned allowlist entry is rejected, never silently accepted.
// ---------------------------------------------------------------------------
console.log('\nArm 5: an allowlist entry with no written reason is rejected');
let threwEmpty = false;
try {
  validateAllowlist([{ file: 'x.md', pattern: 'references/', reason: '' }]);
} catch {
  threwEmpty = true;
}
ok(threwEmpty, 'reason: "" throws');

let threwWhitespace = false;
try {
  validateAllowlist([{ file: 'x.md', pattern: 'references/', reason: '   ' }]);
} catch {
  threwWhitespace = true;
}
ok(threwWhitespace, 'a whitespace-only reason throws (an empty reason cannot be laundered through a space)');

let threwMissing = false;
try {
  validateAllowlist([{ file: 'x.md', pattern: 'references/' }]);
} catch {
  threwMissing = true;
}
ok(threwMissing, 'a missing reason key throws');

let acceptedGood = true;
try {
  validateAllowlist([{ file: 'x.md', pattern: 'references/', reason: 'a real written reason' }]);
} catch {
  acceptedGood = false;
}
ok(acceptedGood, 'a properly reasoned entry is accepted (the validator is not a blanket reject)');

// ---------------------------------------------------------------------------
// Arm 6: allowed-tools permission matchers are excluded from the advisory tier.
// ---------------------------------------------------------------------------
console.log('\nArm 6: a permission matcher contributes 0 to the advisory scripts tier');
const matcherOnly = fixture(
  'matcher-only.md',
  ['---', 'name: status', 'allowed-tools:', '  - Bash(node scripts/mos-status.cjs:*)', '---', '', 'Body text.', ''].join(
    '\n'
  )
);
const a6 = scanScriptInvocations('fixtures', [matcherOnly], ROOT);
ok(a6.sites.length === 0, `a permission matcher yields 0 advisory sites (got ${a6.sites.length})`);
ok(a6.excluded === 1, `the exclusion is COUNTED and therefore visible (got ${a6.excluded})`);

const matcherPlusReal = fixture(
  'matcher-plus-real.md',
  [
    '---',
    'name: status',
    'allowed-tools:',
    '  - Bash(node scripts/mos-status.cjs:*)',
    '---',
    '',
    'Then run: node scripts/mos-status.cjs --json',
    '',
  ].join('\n')
);
const a6b = scanScriptInvocations('fixtures', [matcherPlusReal], ROOT);
ok(a6b.sites.length === 1, `a real invocation alongside a matcher still counts (got ${a6b.sites.length})`);
ok(a6b.excluded === 1, `the matcher on line 4 is still excluded (got ${a6b.excluded})`);

// ---------------------------------------------------------------------------
console.log(`\n${pass} passed, ${fail} failed`);
try {
  fs.rmSync(ROOT, { recursive: true, force: true });
} catch {
  /* scratch cleanup is best-effort */
}
process.exit(fail === 0 ? 0 : 1);
