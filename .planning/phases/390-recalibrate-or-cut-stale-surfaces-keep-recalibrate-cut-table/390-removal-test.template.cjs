#!/usr/bin/env node
// Phase 390 removal-test template (plan 390-03).
//
// WHAT THIS FILE PROVES. After a removal, three facts hold:
//   1. Each path in PATHS is no longer tracked by git.
//   2. No tracked file names anything in NAMES, except the allowed set
//      (.planning/, CHANGELOG.md and this file itself).
//   3. Each path in SURVIVORS is still tracked, and each SURVIVOR_TEXT entry still holds its text.
// The shared check is tests/helpers/390-removal-check.cjs. It reports TRACKED, NAMED,
// SURVIVOR-MISSING, SURVIVOR-TEXT-MISSING, EMPTY-CHECK and TEMPLATE-NOT-FILLED.
//
// STEPS FOR A LATER WAVE.
//   1. Copy this file to tests/test-390-<group>-removed.cjs. The run-all-390.sh runner finds it by glob.
//   2. Fill GROUP, PATHS, NAMES, SURVIVORS (and SURVIVOR_TEXT when a survivor must keep a given text).
//      Unfilled, this file exits 1 and prints TEMPLATE-NOT-FILLED. That is by design.
//   3. Run the copy BEFORE the removal. It must fail (TRACKED or NAMED). Keep that RED output for the SUMMARY.
//   4. Do the removal. Run the copy again. It must pass.
//   5. A removal needs an answered card (390-DECISION.md) and a caller proof first. No card, no removal.
//
// NEEDLE RULE. Build each name by concatenation, for example 'alpha' + '-beta', so this file
// never names its own needle in one piece. The allowed set already skips this file, but the rule
// keeps a copy from showing up in a search for the removed thing.
//
// PROOF GATES a later wave runs after the removal:
//   - node scripts/build-connector-registry.cjs --check
//   - node scripts/build-orchestration-projection.cjs --check
//   - node scripts/check-render-coverage.cjs
//   - node tests/test-209-declared-implies-wired.cjs
//   Only for a router enum edit, also:
//   - node tests/test-384-s7-mcp-start.cjs
//   - node tests/test-270-tool-schema-budget.cjs
//   - node tests/test-387-eureka-installed-layout.cjs
//   Golden regeneration for a router enum edit, under the 384 lock:
//   SPEED384_WRITE_GOLDEN=1 node tests/test-384-s7-mcp-start.cjs parity
//
// COMMIT RULE. In ONE shell call joined with &&: git rm the removed paths, git add -f the new
// test, run a staged-set guard (git diff --cached --name-only lists only your paths), then
// git commit --only with the same explicit paths, as plan 385-15 did. Never git add -A. Never push.
'use strict';
const { spawnSync } = require('node:child_process');
const path = require('node:path');

// ---- Fill these constants. -------------------------------------------------
const GROUP = 'FILL-ME'; // short group name, the same as in tests/test-390-<group>-removed.cjs
const PATHS = ['FILL-ME']; // repo paths that must be gone, for example ['lib/core/old-module.cjs']
const NAMES = ['FILL-ME']; // needles built by concatenation, for example ['old' + '-module']
const SURVIVORS = ['FILL-ME']; // repo paths that must stay tracked
const SURVIVOR_TEXT = []; // for example [{ path: 'templates/page.html', text: 'claude-cli://' }]
const ALLOW_NAMING = undefined; // leave undefined for the default; widen only with a reason written here
// ----------------------------------------------------------------------------

const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: __dirname, encoding: 'utf8' });
if (top.status !== 0) {
  console.log('FAIL git-top: git rev-parse --show-toplevel failed: ' + (top.stderr || '').trim());
  process.exit(1);
}
const root = top.stdout.trim();
const { checkRemoval } = require(path.join(root, 'tests', 'helpers', '390-removal-check.cjs'));
const self = path.relative(root, __filename).split(path.sep).join('/');

const result = checkRemoval({
  root,
  paths: PATHS,
  names: NAMES,
  survivors: SURVIVORS,
  survivorText: SURVIVOR_TEXT,
  allowNaming: ALLOW_NAMING,
  self,
});
const failures = result.failures.slice();
if (GROUP === 'FILL-ME' && !failures.includes('TEMPLATE-NOT-FILLED')) failures.push('TEMPLATE-NOT-FILLED');

if (failures.length === 0) {
  console.log('ok   ' + GROUP + ' removal holds (paths=' + result.counts.paths + ' names=' + result.counts.names + ' survivors=' + result.counts.survivors + ' swept=' + result.counts.swept + ')');
  process.exit(0);
}
for (const f of failures) {
  console.log('FAIL ' + f.split(' ')[0] + ': ' + f);
}
process.exit(1);
