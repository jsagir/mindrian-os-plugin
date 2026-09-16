'use strict';
/*
 * tests/test-349-release-wiring.cjs -- Phase 349 Plan 04 (NOTIFY-02/04/05).
 *
 * STATIC assertions over scripts/release.sh's wiring of the Theo notify
 * gate (Step 5.6): the source guard, the --no-theo-notify flag, the
 * call-site position relative to Step 5.5's closing fi and Step 9.8, the
 * argument order, and the absence of any disk version read at or after the
 * call site. This test reads release.sh as TEXT and asserts structure by
 * byte offset and by pattern -- it never executes the release script
 * (tests/test-349-dry-run-never-sends.cjs owns the live shelled proof).
 * This keeps it fast and safe to run on any tree.
 *
 * Bare node script: assert, an ok(label) counter, no framework, non-zero
 * exit on any assertion failure (uncaught throw), self-contained.
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const RELEASE_SH = path.join(REPO, 'scripts', 'release.sh');

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

console.log('test-349-release-wiring:');

const src = fs.readFileSync(RELEASE_SH, 'utf8');

// ---------------------------------------------------------------------------
// bash -n scripts/release.sh exits 0
// ---------------------------------------------------------------------------
{
  const cp = require('node:child_process');
  const r = cp.spawnSync('bash', ['-n', RELEASE_SH], { encoding: 'utf8' });
  assert.equal(r.status, 0, 'bash -n scripts/release.sh must exit 0: ' + (r.stderr || ''));
  ok('bash -n scripts/release.sh exits 0');
}

// ---------------------------------------------------------------------------
// The source guard (E1). Missing-file refusal + a `.` source of
// theo-notify-gate.sh, mirroring theo-stamp-gate.sh's own guard. The
// refusal's byte offset must be LESS than the source's, so the guard
// cannot be bypassed by a reordering.
// ---------------------------------------------------------------------------
{
  const refusalIdx = src.indexOf('theo-notify-gate.sh" ]');
  assert.ok(refusalIdx !== -1, 'missing-file refusal for theo-notify-gate.sh must exist');
  ok('source guard: missing-file refusal for theo-notify-gate.sh present');

  const sourceIdx = src.indexOf('. "$RELEASE_LIB_DIR/theo-notify-gate.sh"');
  assert.ok(sourceIdx !== -1, 'a `.` source of theo-notify-gate.sh must exist');
  ok('source guard: `.` source of theo-notify-gate.sh present');

  assert.ok(refusalIdx < sourceIdx, 'the refusal must appear BEFORE the source (cannot be bypassed by reordering)');
  ok('source guard: refusal offset < source offset');
}

// ---------------------------------------------------------------------------
// The flag (E2, E3). NO_THEO_NOTIFY=0 initialized, --no-theo-notify in the
// arg-loop case, and in USAGE_BLOCK. --no-theo-check must still appear in
// all three, unchanged.
// ---------------------------------------------------------------------------
{
  assert.ok(/NO_THEO_NOTIFY=0/.test(src), 'NO_THEO_NOTIFY=0 must be initialized');
  ok('flag: NO_THEO_NOTIFY=0 initialized');

  assert.ok(/--no-theo-notify\)\s*NO_THEO_NOTIFY=1\s*;;/.test(src), '--no-theo-notify case arm must set NO_THEO_NOTIFY=1');
  ok('flag: --no-theo-notify) NO_THEO_NOTIFY=1 ;; present in arg loop');

  assert.ok(/USAGE_BLOCK="[^"]*--no-theo-notify\]/.test(src), '--no-theo-notify must appear in USAGE_BLOCK');
  ok('flag: --no-theo-notify present in USAGE_BLOCK');

  assert.ok(/NO_THEO_CHECK=0/.test(src), '--no-theo-check sibling NO_THEO_CHECK=0 must still be present');
  assert.ok(/--no-theo-check\)\s*NO_THEO_CHECK=1\s*;;/.test(src), '--no-theo-check case arm must still be present, unchanged');
  assert.ok(/USAGE_BLOCK="[^"]*--no-theo-check\]/.test(src), '--no-theo-check must still appear in USAGE_BLOCK');
  ok('flag: --no-theo-check sibling unchanged in all three locations');
}

// ---------------------------------------------------------------------------
// The call-site position (E5). mos_theo_notify_gate's byte offset must be
// strictly GREATER than 'Step 5.5: Verify tag' and strictly LESS than
// 'Step 9.8: doctor'. Assert by offset, not line number.
// ---------------------------------------------------------------------------
let step55Idx, callIdx, step98Idx;
{
  step55Idx = src.indexOf('Step 5.5: Verify tag');
  callIdx = src.indexOf('mos_theo_notify_gate');
  step98Idx = src.indexOf('Step 9.8: doctor');

  assert.ok(step55Idx > 0, "'Step 5.5: Verify tag' echo must exist");
  assert.ok(callIdx > step55Idx, 'mos_theo_notify_gate call must be AFTER the Step 5.5 echo');
  assert.ok(step98Idx > callIdx, "'Step 9.8: doctor' comment must be AFTER the mos_theo_notify_gate call");
  ok('call-site position: Step 5.5 < mos_theo_notify_gate < Step 9.8, by byte offset');
}

// ---------------------------------------------------------------------------
// The argument order (E5). Five arguments in the ratified order: plugin
// dir, release sha, $NEW_VERSION, $DRY_RUN, $NO_THEO_NOTIFY. Assert by
// matching the call line against a pattern pinning "$NEW_VERSION" in the
// THIRD position specifically.
// ---------------------------------------------------------------------------
{
  const callLineMatch = src.match(/mos_theo_notify_gate\s+"\$PLUGIN_DIR"\s+"\$RELEASE_SHA"\s+"\$NEW_VERSION"\s+"\$DRY_RUN"\s+"\$NO_THEO_NOTIFY"/);
  assert.ok(callLineMatch, 'the call must pass "$PLUGIN_DIR" "$RELEASE_SHA" "$NEW_VERSION" "$DRY_RUN" "$NO_THEO_NOTIFY" in that exact order');
  ok('argument order: $NEW_VERSION pinned in the third position, matching the ratified signature');
}

// ---------------------------------------------------------------------------
// No disk version read at or after the call site. Slice release.sh's
// source from the Step 5.5 offset to end of file, strip comment-only
// lines, and assert zero repo-version.cjs / plugin.json references.
// ---------------------------------------------------------------------------
{
  const tail = src.slice(step55Idx)
    .split('\n')
    .filter(function (line) { return !/^\s*#/.test(line); })
    .join('\n');
  assert.ok(tail.indexOf('repo-version.cjs') === -1, 'no repo-version.cjs read at or after Step 5.5');
  assert.ok(!/plugin\.json/.test(tail), 'no plugin.json read at or after Step 5.5');
  ok('no disk version read (repo-version.cjs / plugin.json) at or after the Step 5.5 offset');
}

// ---------------------------------------------------------------------------
// The sha comes from the tag, not HEAD. The call site's sha expression
// references v$NEW_VERSION and does not use a bare `git rev-parse HEAD`.
// ---------------------------------------------------------------------------
{
  const step56Idx = src.indexOf('Step 5.6: Notify Theo');
  assert.ok(step56Idx > step55Idx, "'Step 5.6: Notify Theo' header must exist after Step 5.5");

  const shaSlice = src.slice(step56Idx, callIdx);
  assert.ok(/git rev-parse "v\$NEW_VERSION\^\{commit\}"/.test(shaSlice), 'RELEASE_SHA must be re-derived from the tag v$NEW_VERSION');
  ok('sha source: references v$NEW_VERSION');

  assert.ok(!/git rev-parse HEAD\b/.test(shaSlice), 'must NOT use a bare `git rev-parse HEAD` in the Step 5.6-to-call-site slice');
  ok('sha source: no bare `git rev-parse HEAD` between the Step 5.6 header and the call site');
}

// ---------------------------------------------------------------------------
// The dry-run preview line (E4). 'Step 5.6' appears inside the dry-run
// block, between the 'Step 5.5' preview line's offset and the 'Step 9.6a'
// preview line's offset.
// ---------------------------------------------------------------------------
{
  const previewStep55Idx = src.indexOf('Step 5.5  :');
  const previewStep96aIdx = src.indexOf('Step 9.6a :');
  assert.ok(previewStep55Idx > 0, 'the Step 5.5 dry-run preview line must exist');
  assert.ok(previewStep96aIdx > previewStep55Idx, 'the Step 9.6a dry-run preview line must exist after Step 5.5');

  const previewSlice = src.slice(previewStep55Idx, previewStep96aIdx);
  assert.ok(previewSlice.indexOf('Step 5.6') !== -1, "'Step 5.6' must appear in the dry-run preview block between Step 5.5 and Step 9.6a");
  ok('dry-run preview: Step 5.6 line present between Step 5.5 and Step 9.6a preview lines');
}

// ---------------------------------------------------------------------------
// Failure mode is a hard abort. The call is wrapped in the same
// `if ! ...; then exit 1; fi` shape Step 0.6 uses.
// ---------------------------------------------------------------------------
{
  const guardMatch = src.match(/if\s+!\s+mos_theo_notify_gate\s+"\$PLUGIN_DIR"\s+"\$RELEASE_SHA"\s+"\$NEW_VERSION"\s+"\$DRY_RUN"\s+"\$NO_THEO_NOTIFY";\s*then\s*\n\s*exit 1\s*\n\s*fi/);
  assert.ok(guardMatch, 'the call must be wrapped in `if ! mos_theo_notify_gate ...; then exit 1; fi`, matching Step 0.6\'s guard shape');
  ok('failure mode: call is wrapped in a hard-abort if-then-exit-fi guard, not bare');
}

// ---------------------------------------------------------------------------
// Nothing else moved. Every pre-existing step header must still be
// present.
// ---------------------------------------------------------------------------
{
  const requiredHeaders = ['Step 0.6', 'Step 2.5', 'Step 6.6', 'Step 7.5', 'Step 8', 'Step 9', 'Step 5.5', 'Step 9.8', 'Step 10', 'Step 11'];
  for (const header of requiredHeaders) {
    assert.ok(src.indexOf(header) !== -1, 'pre-existing step header must survive: ' + header);
  }
  ok('all pre-existing step headers survive: ' + requiredHeaders.join(', '));
}

// ---------------------------------------------------------------------------
// Zero em-dashes in this file and in release.sh (house rule).
// ---------------------------------------------------------------------------
{
  const emDash = String.fromCharCode(8212);
  assert.ok(src.indexOf(emDash) === -1, 'scripts/release.sh must contain zero em-dashes');
  const selfSrc = fs.readFileSync(__filename, 'utf8');
  assert.ok(selfSrc.indexOf(emDash) === -1, 'this test file must contain zero em-dashes');
  ok('zero em-dashes in scripts/release.sh and this test file');
}

console.log(checks + ' checks passed.');
process.exit(0);
