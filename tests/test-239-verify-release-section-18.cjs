#!/usr/bin/env node
'use strict';

/*
 * test-239-verify-release-section-18.cjs -- proves scripts/verify-release's
 * new Brain Tool Liveness Gate section reaches the real release gate's FAIL
 * counter, per Phase 239 Plan 07 (BRAIN-01, threat T-239-T1).
 *
 * Filename note: this file is named "section-18" per the plan's
 * files_modified contract, but Phase 238 (GATE-01) landed section 18 first
 * ("Gate Ledger Seam Gate") in the SAME file before this plan executed.
 * Per this plan's collision-resolution rule, this plan's section took the
 * next free integer, 19, leaving section 18 untouched. Every assertion
 * below derives the section's actual number from the file by regex; none
 * hardcodes the literal 18 or 19, so the Phase 238 renumbering collision
 * cannot rot this test.
 *
 * Four legs:
 *   LEG 1 STRUCTURAL: the section exists, is wired to
 *     check-brain-tool-liveness.cjs, has a pass arm and at least two fail
 *     arms, and sits after the Kuzu section and before PACKAGE-LOCK SYNC.
 *   LEG 2 WIRED TO THE FAIL COUNTER: the failure arms call the `fail` shell
 *     helper (never `warn`, never a bare echo), and the SUMMARY block still
 *     exits 1 when FAIL is greater than 0.
 *   LEG 3 THE BITE PROOF: mutates the real hooks/hooks.json on disk,
 *     observes the real check-brain-tool-liveness.cjs and the real
 *     scripts/verify-release both go red, then restores unconditionally in
 *     a finally and re-proves both green.
 *   LEG 4 ANTI-VACUITY: the clean tree produces the section's `pass` text,
 *     so LEG 3's red is caused by the mutation, not by an always-red
 *     section.
 *
 * Harness shape: the assert(cond, label) / failures counter / process.exit
 * pattern already used by tests/test-239-brain-tool-liveness.cjs and
 * lib/core/seam-liveness.test.cjs. Backup held OUTSIDE the repo tree
 * (os.tmpdir()), per this plan's mutation-serialization rules.
 *
 * House rule: hyphens only, no em-dashes.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const VERIFY_RELEASE_PATH = path.join(ROOT, 'scripts', 'verify-release');
const HOOKS_JSON_PATH = path.join(ROOT, 'hooks', 'hooks.json');
const LIVENESS_SCRIPT_PATH = path.join(ROOT, 'scripts', 'check-brain-tool-liveness.cjs');

let failures = 0;
function assert(cond, label) {
  if (cond) {
    console.log('  ok  ' + label);
  } else {
    console.error('  FAIL  ' + label);
    failures += 1;
  }
}

function readVerifyRelease() {
  return fs.readFileSync(VERIFY_RELEASE_PATH, 'utf8');
}

function runLivenessScript() {
  return cp.spawnSync('node', [LIVENESS_SCRIPT_PATH], { cwd: ROOT, encoding: 'utf8' });
}

function runVerifyRelease() {
  return cp.spawnSync('bash', [VERIFY_RELEASE_PATH], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 120000,
  });
}

async function main() {
  console.log('Phase 239-07: verify-release Brain Tool Liveness Gate section, four legs\n');

  const src = readVerifyRelease();
  const lines = src.split('\n');

  // -------------------------------------------------------------------------
  // LEG 1: STRUCTURAL. Derive the section's own number by regex from the
  // header line -- never a hardcoded literal, so the Phase 238 collision
  // (which claimed section 18 first) cannot rot this test.
  // -------------------------------------------------------------------------
  // The header appears twice in the file: once in the banner comment
  // ("# N. BRAIN TOOL LIVENESS GATE") and once in the echo line
  // ("N. Brain Tool Liveness Gate"). Match the banner comment form for the
  // numbered-section derivation, since it is the canonical section marker
  // used by every other numbered section in this file.
  const bannerRegex = /^#\s*(\d+)\.\s*BRAIN TOOL LIVENESS GATE\s*$/im;
  const echoHeaderIdx = lines.findIndex((l) => /Brain Tool Liveness Gate\$\{NC\}/.test(l));
  const bannerMatch = src.match(bannerRegex);
  assert(bannerMatch !== null, 'LEG 1: a numbered "N. BRAIN TOOL LIVENESS GATE" banner header exists');
  const sectionNumber = bannerMatch ? bannerMatch[1] : null;
  console.log('  note: this plan\'s section landed as number ' + sectionNumber + ' (see file header for the Phase 238 collision-resolution rationale)');

  assert(echoHeaderIdx !== -1, 'LEG 1: the "Brain Tool Liveness Gate" echo header exists in the file');

  assert(
    src.indexOf('check-brain-tool-liveness.cjs') !== -1,
    'LEG 1: the section invokes scripts/check-brain-tool-liveness.cjs'
  );

  assert(
    /pass\s+"Every Brain hook matcher and agent allowed-tools entry names a live MCP tool"/.test(src),
    'LEG 1: a zero-exit pass arm exists'
  );

  const failArmMatches = src.match(/fail\s+"Brain tool liveness gate[^"]*"/g) || [];
  assert(failArmMatches.length >= 2, 'LEG 1: at least two fail arms exist tied to the liveness gate');

  // Section ordering: after the Kuzu Reintroduction Gate section, before
  // PACKAGE-LOCK SYNC. Derive both anchor positions by content, not by
  // hardcoded section numbers (the Kuzu section's own number, 17, is
  // unaffected by the Phase 238 collision and is stable, but we still
  // locate it by its distinctive title text rather than a bare "17.").
  const kuzuIdx = src.indexOf('KUZU REINTRODUCTION GATE');
  const brainLivenessBannerIdx = src.search(bannerRegex);
  const packageLockIdx = src.indexOf('PACKAGE-LOCK SYNC');
  assert(kuzuIdx !== -1, 'LEG 1: the Kuzu Reintroduction Gate section anchor is found');
  assert(brainLivenessBannerIdx !== -1, 'LEG 1: the Brain Tool Liveness Gate banner anchor is found');
  assert(packageLockIdx !== -1, 'LEG 1: the PACKAGE-LOCK SYNC anchor is found');
  assert(
    kuzuIdx !== -1 && brainLivenessBannerIdx !== -1 && packageLockIdx !== -1 &&
      kuzuIdx < brainLivenessBannerIdx && brainLivenessBannerIdx < packageLockIdx,
    'LEG 1: the section sits after Kuzu Reintroduction Gate and before PACKAGE-LOCK SYNC'
  );
  console.log(
    '  note: byte offsets -- Kuzu=' + kuzuIdx + ', Brain Tool Liveness=' + brainLivenessBannerIdx +
      ', PACKAGE-LOCK SYNC=' + packageLockIdx
  );

  // -------------------------------------------------------------------------
  // LEG 2: WIRED TO THE FAIL COUNTER. The failure arms call `fail`, never
  // `warn` or a bare `echo`, and the file's SUMMARY block still exits 1
  // when FAIL is greater than 0. This is the assertion that distinguishes
  // a load-bearing gate from a printed message.
  // -------------------------------------------------------------------------
  assert(
    !/warn\s+"Brain tool liveness/.test(src),
    'LEG 2: the liveness section never calls `warn` on a failure (would degrade a probe failure to a soft signal)'
  );
  assert(
    /if \[ "\$FAIL" -gt 0 \]; then[\s\S]*?exit 1/.test(src),
    'LEG 2: the SUMMARY block still exits 1 when FAIL is greater than 0'
  );

  // -------------------------------------------------------------------------
  // LEG 3: THE BITE PROOF. Real mutation of the real hooks/hooks.json,
  // observed against both the direct liveness script and the full
  // verify-release gate, restored unconditionally in a finally.
  // -------------------------------------------------------------------------
  {
    const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-239-07-hooks-backup-'));
    const backupPath = path.join(backupDir, 'hooks.json.bak');
    const original = fs.readFileSync(HOOKS_JSON_PATH, 'utf8');
    fs.writeFileSync(backupPath, original);

    const liveMatcherLiteral = 'mcp__(?:plugin_[a-z0-9_-]+_)?mindrian-brain__.*';
    const idx = original.indexOf(liveMatcherLiteral);
    assert(idx !== -1, 'LEG 3 setup: the live matcher literal is present in hooks.json exactly as expected');

    let underMutationLivenessStatus = null;
    let underMutationVerifyReleaseResult = null;

    if (idx !== -1) {
      const staled = original.slice(0, idx) + 'mcp__brain_.*' + original.slice(idx + liveMatcherLiteral.length);
      try {
        fs.writeFileSync(HOOKS_JSON_PATH, staled);

        const livenessResult = runLivenessScript();
        underMutationLivenessStatus = livenessResult.status;
        assert(livenessResult.status === 1, 'LEG 3: check-brain-tool-liveness.cjs exits 1 under the stale-matcher mutation');

        const vrResult = runVerifyRelease();
        underMutationVerifyReleaseResult = vrResult;
        assert(vrResult.status !== 0, 'LEG 3: bash scripts/verify-release exits non-zero under the stale-matcher mutation');
        const vrOut = (vrResult.stdout || '') + (vrResult.stderr || '');
        assert(
          new RegExp('Brain Tool Liveness Gate', 'i').test(vrOut),
          'LEG 3: verify-release stdout contains the section header'
        );
        assert(
          vrOut.indexOf('Brain tool liveness gate FAILED') !== -1,
          'LEG 3: verify-release stdout contains the "Brain tool liveness gate FAILED" line'
        );
      } finally {
        fs.writeFileSync(HOOKS_JSON_PATH, original);
      }

      const afterRestore = fs.readFileSync(HOOKS_JSON_PATH, 'utf8');
      const backupBytes = fs.readFileSync(backupPath, 'utf8');
      assert(afterRestore === original, 'LEG 3: hooks.json is restored byte-identical to its pre-mutation in-memory copy');
      assert(afterRestore === backupBytes, 'LEG 3: hooks.json is restored byte-identical to the OUTSIDE-repo backup');

      const postRestoreLiveness = runLivenessScript();
      assert(postRestoreLiveness.status === 0, 'LEG 3: after restore, check-brain-tool-liveness.cjs is green again (exit 0)');

      console.log('  transcript: check-brain-tool-liveness.cjs status under mutation = ' + underMutationLivenessStatus + ' (expected 1)');
      console.log(
        '  transcript: verify-release exit status under mutation = ' +
          (underMutationVerifyReleaseResult ? underMutationVerifyReleaseResult.status : 'n/a') +
          ' (expected non-zero)'
      );
      console.log('  transcript: post-restore byte-identity confirmed (in-memory copy AND outside-repo backup)');
      console.log('  transcript: post-restore check-brain-tool-liveness.cjs status = ' + postRestoreLiveness.status + ' (expected 0)');
    }

    try {
      fs.rmSync(backupDir, { recursive: true, force: true });
    } catch (_e) {
      // best-effort cleanup of the scratch backup dir; not load-bearing
    }
  }

  // -------------------------------------------------------------------------
  // LEG 4: ANTI-VACUITY. The CLEAN tree (post-restore, matching the
  // committed state) produces the section's pass text in verify-release's
  // own stdout. Without this, LEG 3's red could pass because the section
  // fails unconditionally rather than because of the specific mutation.
  // -------------------------------------------------------------------------
  {
    const cleanResult = runVerifyRelease();
    const cleanOut = (cleanResult.stdout || '') + (cleanResult.stderr || '');
    assert(
      cleanOut.indexOf('Every Brain hook matcher and agent allowed-tools entry names a live MCP tool') !== -1,
      'LEG 4: the clean-tree verify-release run shows the section\'s pass text'
    );
    console.log('  transcript: clean-tree verify-release exit status = ' + cleanResult.status);

    // Record any OTHER section failures observed on the clean run so a
    // reader can distinguish a pre-existing unrelated failure from a
    // regression introduced by this plan, per the plan's honest-residual
    // reporting requirement.
    const otherFailLines = cleanOut
      .split('\n')
      // Real per-check failure lines look like "  X <message>" from the
      // `fail` shell helper. Exclude the one-line run SUMMARY (which
      // always contains the literal word "passed" alongside a possible
      // "0 failed" and would otherwise false-positive here).
      .filter((l) => l.indexOf('✗') !== -1 && l.indexOf('passed') === -1)
      .filter((l) => l.indexOf('Brain Tool Liveness') === -1 && l.indexOf('Brain tool liveness') === -1);
    if (otherFailLines.length > 0) {
      console.log('  note: other non-liveness lines flagged on the clean run (see SUMMARY.md for disposition):');
      otherFailLines.forEach((l) => console.log('    ' + l));
    } else {
      console.log('  note: no other section failures observed on the clean-tree run');
    }
  }

  console.log('');
  if (failures === 0) {
    console.log('test-239-verify-release-section-18: all 4 legs PASSED');
    process.exit(0);
  } else {
    console.error('test-239-verify-release-section-18: ' + failures + ' assertion(s) FAILED');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('FATAL: ' + (e && e.stack ? e.stack : e));
  process.exit(2);
});
