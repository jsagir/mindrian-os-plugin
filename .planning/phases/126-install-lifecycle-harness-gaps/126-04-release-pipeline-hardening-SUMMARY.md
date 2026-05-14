---
phase: 126-install-lifecycle-harness-gaps
plan: 04
subsystem: release-pipeline
tags: [release.sh, install-minisite, lockstep, tag-push, npx-publish, vercel, semver, doctor-acceptance]

# Dependency graph
requires:
  - phase: 126-03-acceptance-gate-self-coverage
    provides: Step 6.6b acceptance self-coverage aggregator; install-state v2 last_acceptance_run writer
  - phase: 126-05-release-flight-preflight-in-acceptance
    provides: 5 new doctor --acceptance preflight checks (Entry 4 expectedSteps array, patched by this plan)
  - phase: 126-07-install-state-schema-v2-migration
    provides: lib/core/install-state.cjs v2 schema substrate
  - phase: 123-install-lifecycle-harness
    provides: scripts/release.sh substrate (semver bump algebra, Step 9.5 npm publish, Step 6.6 + old 9.6 --acceptance gates)
provides:
  - "release.sh Step 5.5: tag-push verification (RELEASE_TAG_PUSH_RETRIES retries; SKIP_TAG_VERIFY=1 bypass)"
  - "release.sh Step 9.6: install-minisite HARD 7-place lockstep (MINISITE_DIR resolution + sed/grep/rollback + git push origin main + Vercel live-poll)"
  - "release.sh Step 9.7: npx-publish self-test (npx @mindrian_os/install@<v> against a fresh temp dir)"
  - "release.sh Step 9.8: renamed from old Step 9.6 (doctor --acceptance full; resolves the pre-existing numbering collision and closes acc.5)"
  - "release.sh --no-minisite flag (opt-out audit-logged to stderr, not silent)"
  - "2 new env vars: MINDRIAN_MINISITE_URL + MINDRIAN_MINISITE_POLL_TIMEOUT_S (plus MINDRIAN_MINISITE_POLL_INTERVAL_S; reuses MOS_CACHE_PRUNE_AGE_DAYS from Plan 06)"
  - "docs/install-cache-family-premortem.md (D4 deliverable; 6-case family history table + pattern + 5 predicted next failure modes + revisit cadence)"
  - "tests/test-release-bump-tag-and-publish-gates.cjs (13-case end-to-end fixture covering all 3 new gates)"
  - "scripts/doctor.cjs expectedSteps array patched for the Wave-3 14-step order"
  - "tests/test-doctor-acceptance.cjs acc.5 ordering check updated for 9.6 -> 9.8 rename (deferred-items.md entry RESOLVED)"
affects: [126-verify-work, v1.13.0-beta.15 release cut, future v1.14.0 NEXT_PUBLIC_MINDRIAN_VERSION build-time fetch retire of Step 9.6]

# Tech tracking
tech-stack:
  added: [no new runtime deps; reuses existing semver@^7.7.4 from Phase 123]
  patterns:
    - "HARD gate pattern -- pre-state snapshot (.bak files) -> mutation -> grep verify -> rollback on mismatch -> commit -> push -> live-poll"
    - "Two distinct failure modes -> two distinct recoveries (MINISITE_DIR-absent -> gh repo clone; origin-missing -> git remote add origin)"
    - "Audit-logged opt-out (NOT silent skip) for emergency-bypass flags"
    - "Env-var-driven retry policy (RELEASE_TAG_PUSH_RETRIES + RELEASE_TAG_PUSH_BACKOFF_S; SKIP_TAG_VERIFY=1 bypass)"
    - "Family pre-mortem doc as continuity surface across cases"

key-files:
  created:
    - tests/test-release-bump-tag-and-publish-gates.cjs (13-case end-to-end fixture)
    - docs/install-cache-family-premortem.md (D4 deliverable, 102 lines)
    - .planning/phases/126-install-lifecycle-harness-gaps/126-04-release-pipeline-hardening-SUMMARY.md (this file)
  modified:
    - scripts/release.sh (Step 5.5 + 9.6 HARD + 9.7 added; old Step 9.6 renamed to 9.8; --no-minisite flag; 2 new env vars)
    - scripts/doctor.cjs (expectedSteps array patched: Wave-3 14-step order including Step 5.5 / 9.7 / 9.8)
    - tests/test-doctor-acceptance.cjs (off96 -> off98 rename + literal "Step 9.6:" -> "Step 9.8:" + comment block updated)
    - tests/run-all-126.sh (Plan 04 test suite registered)
    - docs/CANON-PHASE-MAP.md (Part 6 row added for Phase 126 cross-linking pre-mortem doc)
    - .planning/phases/126-install-lifecycle-harness-gaps/deferred-items.md (acc.5 entry marked RESOLVED)

key-decisions:
  - "Step 9.6 numbering collision (existing release.sh had two Step-9.6 blocks coexisting -- the soft minisite block AND the doctor --acceptance block) resolved by renaming the SECOND one (doctor --acceptance full) to Step 9.8, inserting the new Step 9.7 npx-publish self-test between them, and replacing the FIRST one (soft minisite skip) with the HARD lockstep implementation."
  - "Two distinct minisite failure modes -> two distinct recoveries (WARN 2 invariant): MINISITE_DIR absent -> gh repo clone OR git clone (no working tree yet, no remote to add); origin remote missing -> git remote add origin <url> + git push -u origin main (working tree exists, just needs remote). Each error message emits ONLY the recovery that applies to its failure mode; crossing the two would mislead the operator."
  - "Sed pattern is line-anchored on CONTENT (MindrianOS v / · Install), NOT line numbers 149/30. A minisite refactor that moves the strings still matches; a refactor that REMOVES them fails the post-sed grep verify -- which is the correct failure mode (Open Question 9 settled in plan-phase)."
  - "Vercel auto-deploys on `git push origin main` -- NO vercel CLI dependency. The plugin release.sh stays vendor-neutral; the deployment pipeline is the minisite repo's responsibility."
  - "Live-poll uses curl against MINDRIAN_MINISITE_URL with 180s timeout default (10s interval) -- aligns with typical Vercel cold-start. Single-edge poll accepted for now; multi-edge poll deferred to Prediction D in the pre-mortem (future phase)."
  - "Step 9.7 npx-publish self-test is an EXPLICIT gate (not relying on Step 9.8's --acceptance npx-roundtrip point in passing). Surfaces failure mode with a clean stack trace rather than buried inside the --acceptance roster."

patterns-established:
  - "HARD-gate template: snapshot pre-state to .bak files -> mutate -> verify (grep) -> rollback on mismatch (mv .bak back) -> commit -> push -> live-poll"
  - "Recovery-message-per-failure-mode discipline: never emit the wrong recovery; each error message names the SINGLE next action that fixes the specific failure mode"
  - "Family pre-mortem as continuity doc: one defense per case, but the doc names the NEXT adjacent failure mode BEFORE the next case hits"

requirements-completed: []  # Plan 04 has no requirement-ID frontmatter; traces directly to CONTEXT.md Plan 04 + the 9-item Nyquist UAT acceptance criteria

# Metrics
duration: ~55 min
completed: 2026-05-14
---

# Phase 126 Plan 04: Release Pipeline Hardening Summary

**Three new release.sh gates (Step 5.5 tag-push verification + Step 9.6 install-minisite HARD lockstep + Step 9.7 npx-publish self-test) plus the Step 9.6 -> 9.8 rename that resolves the pre-existing numbering collision, plus the 1-page install-cache family pre-mortem doc.**

## Performance

- **Duration:** ~55 min (TDD RED + GREEN + doc deliverable, 3 commits)
- **Tasks:** 3
- **Files created:** 3 (test fixture + pre-mortem doc + this summary)
- **Files modified:** 6 (release.sh, doctor.cjs, test-doctor-acceptance.cjs, run-all-126.sh, CANON-PHASE-MAP.md, deferred-items.md)

## Accomplishments

- **release.sh Step 5.5 (NEW):** tag-push verification with retry loop. Honors `RELEASE_TAG_PUSH_RETRIES` (default 3) + `RELEASE_TAG_PUSH_BACKOFF_S` (default 5s); `SKIP_TAG_VERIFY=1` bypass exists (audit-logged). Closes the 2026-05-13 dogfood asymmetry where the local tag was assumed to be at origin.
- **release.sh Step 9.6 (HARD, was Soft):** install-minisite 7-place lockstep promoted from Soft to HARD per `feedback_install_minisite_lockstep.md`. Replaces the soft-skip block with: `MINISITE_DIR` resolution -> sed (line-anchored content match) -> grep verify with rollback -> commit -> `git push origin main` -> `curl` live-poll `MINDRIAN_MINISITE_URL` until `v$NEW_VERSION` appears OR timeout. Two distinct failure modes have two distinct recoveries (WARN 2 invariant): `MINISITE_DIR`-absent -> `gh repo clone`/`git clone`; origin-missing -> `git remote add origin <url>`.
- **release.sh Step 9.7 (NEW):** npx-publish self-test. Runs `npx --yes @mindrian_os/install@<version>` against a fresh `mktemp` dir; HARD ABORT if exit != 0 or scaffold dir is empty. Closes the 2026-05-13 dogfood "npx round-trip broken (null)" gap.
- **release.sh Step 9.8 (RENAMED from old Step 9.6):** doctor --acceptance full. The pre-existing two-Step-9.6 numbering collision is resolved.
- **release.sh `--no-minisite` flag:** opt-out audit-logged to stderr (NOT a silent skip).
- **2 new env vars:** `MINDRIAN_MINISITE_URL` (default `https://mindrianos-install-site.vercel.app/`) + `MINDRIAN_MINISITE_POLL_TIMEOUT_S` (default 180) + `MINDRIAN_MINISITE_POLL_INTERVAL_S` (default 10). Reuses `MOS_CACHE_PRUNE_AGE_DAYS` from Plan 06.
- **7-place lockstep contract fully enforced:** `CHANGELOG.md` heading + `plugin.json` + root `package.json` + `packages/npm-installer/package.json` + git tag + `marketplace.json` (version + source.ref) + install-minisite (lib/os.ts + app/page.tsx + Vercel live-deploy verified).
- **Cross-plan patch:** Plan 05's `expectedSteps` array in `scripts/doctor.cjs` patched to the final Wave-3 14-step order.
- **Test acc.5 RESOLVED:** the pre-existing failure in `tests/test-doctor-acceptance.cjs` (deferred-items.md 2026-05-14 entry) now PASSES because the doctor --acceptance ordering check tracks Step 9.8 (the renamed gate) instead of Step 9.6 (the new minisite gate).
- **Family pre-mortem doc (D4 deliverable):** `docs/install-cache-family-premortem.md` shipped. 4 sections: 6-case family history table + pattern across cases + 5 predicted next failure modes (A through E) + revisit cadence. Prediction E names the future fix (build-time `NEXT_PUBLIC_MINDRIAN_VERSION` env var OR `npm view @mindrian_os/install version` fetch) that retires the entire Plan 04 Step 9.6 surface and shrinks the 7-place lockstep back to 6.

## Task Commits

Each task was committed atomically:

1. **Task 1: TDD RED fixture** - `d9a0d6d` (test: 13-case fixture, currently 13/13 RED on existing release.sh)
2. **Task 2: release.sh hardening + rename + Plan 05 array patch** - `efee3a2` (feat: Step 5.5 + 9.6 HARD + 9.7 + rename 9.6->9.8 + test patches; 13/13 GREEN, acc.5 now PASSES)
3. **Task 3: family pre-mortem doc** - `db99d19` (docs: D4 deliverable, 102 lines, 4 sections, 5 predictions)

**Plan metadata commit:** (this SUMMARY + STATE + ROADMAP) - final commit below.

## Files Created/Modified

### Created
- `tests/test-release-bump-tag-and-publish-gates.cjs` - 13-case end-to-end fixture covering Step 5.5 / 9.6-HARD / 9.7. Sandboxed plugin + marketplace + minisite + HTTP mock + npx shim helpers. Test 5 + Test 6 separately assert the two distinct minisite failure modes (WARN 2 invariant).
- `docs/install-cache-family-premortem.md` - D4 deliverable. 102 lines. 4 sections per CONTEXT.md spec. Linked from `docs/CANON-PHASE-MAP.md` Part 6 row.

### Modified
- `scripts/release.sh` - Step 5.5 (tag-push verify, inserted after Step 9 push); Step 9.6 (install-minisite HARD lockstep, replacing the soft block at original lines 459-543); Step 9.7 (npx-publish self-test, inserted between minisite and acceptance); Step 9.8 (renamed from old Step 9.6 doctor --acceptance full; comment header + echo line updated + recovery R.4 reference updated). `--no-minisite` flag added to arg parser + `NO_MINISITE` tracker var. `--dry-run` output extended with 4 new step name lines. File-header docstring updated for the new numbering.
- `scripts/doctor.cjs` - expectedSteps array (line 2551) patched from the Wave-2 11-entry list to the Wave-3 14-entry list (adds Step 5.5, Step 9.7, Step 9.8). Maintainer NOTE comment updated to past-tense.
- `tests/test-doctor-acceptance.cjs` - acc.5 ordering check: `off96` variable renamed to `off98`; literal `'Step 9.6:'` -> `'Step 9.8:'`; assertion messages updated. Test header comment block updated to explain the rename. All 6/6 sub-tests including acc.5 now PASS.
- `tests/run-all-126.sh` - `test-release-bump-tag-and-publish-gates.cjs` registered in CJS_SUITES. Header comment updated.
- `docs/CANON-PHASE-MAP.md` - Part 6 row added (Phase 126 entry naming the pre-mortem doc + the 4 dogfood findings + Plan 04 step-rename).
- `.planning/phases/126-install-lifecycle-harness-gaps/deferred-items.md` - acc.5 entry marked RESOLVED with commit `efee3a2` reference + explanation of the rename.

## Decisions Made

See `key-decisions` frontmatter for the full 6 decisions. Key ones:

- **Numbering collision resolution:** The existing release.sh had two Step-9.6 blocks coexisting (the soft minisite block AND the doctor --acceptance full block) -- a pre-existing collision. Plan 04 RENAMES the second one (acceptance full) to Step 9.8 and REPLACES the first one (soft minisite) with the HARD lockstep, inserting Step 9.7 (npx-publish self-test) between them. This also closes the deferred-items.md acc.5 entry.
- **Two distinct minisite failure modes -> two distinct recoveries (WARN 2 invariant):** the absent-MINISITE_DIR path emits `gh repo clone`/`git clone` (no working tree yet); the origin-missing path emits `git remote add origin <url>` (working tree exists, just needs remote). Each error message names ONLY the recovery that applies to its failure mode.
- **Sed pattern is line-anchored on CONTENT not line numbers:** the regex matches `MindrianOS v[ver]` and `v[ver] · Install` literals, not lib/os.ts:149 / app/page.tsx:30. A minisite refactor that moves the strings still matches; a refactor that REMOVES them fails the post-sed grep verify -- which is the correct failure mode.
- **Vercel auto-deploys on `git push origin main` -- NO vercel CLI dependency:** release.sh stays vendor-neutral. Deployment is the minisite repo's responsibility.

## Deviations from Plan

None. Plan executed as written. The TDD red/green cycle, the rename, the Plan 05 array patch, and the D4 doc deliverable all landed per the plan's `<action>` blocks.

The only minor adjustments during Task 1 (test fixture authoring) were two test-side regex refinements:
- Test 5 (MINISITE_DIR-absent invariant): the initial regex inspected both comments AND runtime code; refined to strip comment lines and only inspect runtime echo statements. The WARN 2 invariant is about RUNTIME output, not comment prose.
- Tests 11/12 (Step 9.7 block extraction): the initial regex anchored on `Step 9\.7` matched the file-header docstring's mention of Step 9.7 first; refined to anchor on `# --- Step 9\.7` (the block header marker).

These were test-side polish issues during TDD, not plan deviations. The production code in Task 2 landed exactly per the plan skeleton.

**Total deviations:** 0 (zero production-code deviations; 2 test-side regex refinements during TDD did not change semantics).

## Issues Encountered

None during execution. The TDD cycle ran cleanly: 13/13 RED -> apply Task 2 production code -> 12/13 GREEN (Test 5 + Tests 11/12 needed test-side regex refinement) -> 13/13 GREEN. The pre-existing acc.5 failure flipped to PASS as a side-effect of the rename (intentional per the plan).

## User Setup Required

None during execution. The first real `release.sh --prerelease` invocation against the dev box's minisite at `/home/jsagi/mindrianos-install-site` will fail at the origin-check (the minisite currently has NO origin remote configured) and emit the actionable recovery command:

```bash
cd /home/jsagi/mindrianos-install-site && git remote add origin <url> && git push -u origin main
```

This is INTENTIONAL per Open Question 7 option (b). The operator runs this once (one-time bootstrap), then subsequent releases sail through. The exact origin URL is operator-supplied because the minisite repo is not yet on GitHub at a known canonical URL.

## Next Phase Readiness

Phase 126 is now 7/7 plans complete. The next gate is `/gsd:verify-work 126` (goal-backward verification across all 7 plans) followed by `gsd-tools phase complete 126` and then the v1.13.0-beta.15 release cut via `scripts/release.sh --prerelease`.

The first real release cut will exercise:
- Step 5.5 tag-push verification (expected: PASS in normal conditions; retries cover transient origin delays)
- Step 9.6 install-minisite HARD lockstep (expected: FAIL FIRST RUN on the dev box because `~/mindrianos-install-site` has no origin -- emits the recovery command; operator runs it once; second release run sails through)
- Step 9.7 npx-publish self-test (expected: PASS once npm publish lands; this is the post-publish round-trip check)
- Step 9.8 doctor --acceptance full (renamed from old 9.6; same behavior, new label)

Prediction E in the pre-mortem doc (`NEXT_PUBLIC_MINDRIAN_VERSION` env var OR build-time npm-registry fetch) is the v1.14.0+ fix that retires the entire Plan 04 Step 9.6 surface. Until then, Plan 04 is the HARD enforcement.

---

## Self-Check: PASSED

- `tests/test-release-bump-tag-and-publish-gates.cjs` - FOUND
- `docs/install-cache-family-premortem.md` - FOUND
- `.planning/phases/126-install-lifecycle-harness-gaps/126-04-release-pipeline-hardening-SUMMARY.md` - FOUND
- commit `d9a0d6d` (Task 1 TDD RED) - FOUND
- commit `efee3a2` (Task 2 TDD GREEN) - FOUND
- commit `db99d19` (Task 3 doc deliverable) - FOUND

---
*Phase: 126-install-lifecycle-harness-gaps*
*Plan: 04*
*Completed: 2026-05-14*
