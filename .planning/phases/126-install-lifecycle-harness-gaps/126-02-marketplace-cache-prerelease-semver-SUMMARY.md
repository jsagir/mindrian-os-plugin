---
phase: 126-install-lifecycle-harness-gaps
plan: 02
subsystem: install-lifecycle / doctor / marketplace-cache-pick / semver-prerelease-ordering
tags: [doctor, install-cache, semver, prerelease-ordering, dogfood, hotfix-discipline, windows]

# Dependency graph
requires:
  - phase: 95.1
    provides: scripts/doctor.cjs class-A install-cache surface; parseVersion + cmpVersion helpers (lines ~180-210); the cache-pick consumer at line ~2692 (`cmpVersion(installResult.parsed, cacheResult.latestParsed)`)
  - phase: 123
    provides: semver runtime dep already present in package.json at ^7.7.4 (added for release.sh prerelease algebra); reused here without bump
provides:
  - npm-semver spec section 11.4.4 prerelease ordering inside cmpVersion (numeric-aware: beta.9 < beta.10 < beta.13; rc.1 > beta.99; stable > any prerelease at same core)
  - 5-case fixture covering the four prerelease ordering rules + the case-5 subtlety (newer minor's prerelease beats older stable)
affects:
  - Plan 126-03 acceptance-gate self-coverage (the marketplace-cache-stale-topology fixture in Plan 03 will exercise cmpVersion via doctor --acceptance against scaffolded beta.N directories)
  - Future install-cache cases on platforms with two-digit beta numbers (the lexicographic bug would have re-surfaced at every minor with N >= 10 betas; the semver fix is durable)
  - Phase 95.2 atomic-swap recovery (recovery targets the cache-pick winner; correct winner = correct recovery; finding 3b is now closed at the source)

# Tech tracking
tech-stack:
  added: []  # zero new runtime dependencies (Canon Part 7 hotfix discipline). semver was already a Phase 123 dep.
  patterns:
    - "Reuse-before-build: the bug fix consumed an existing runtime dep (semver@^7.7.4) rather than adding a new comparator library or rolling a custom prerelease parser. require('semver').compare(a.raw, b.raw) replaces the prior lexicographic localeCompare branch. Per Canon Part 7."
    - "Failure-mode-as-test pattern: each of the 5 test cases is a real scenario that can show up on a real user's machine. Case 1 is the literal Windows dogfood scenario (beta.9 vs beta.13). Cases 2-5 generalize the bug class to every prerelease ordering rule in the npm-semver spec, so the fix is durable beyond the specific finding."
    - "Single-branch surgical fix: the change touches only the `a.prerelease && b.prerelease` branch inside cmpVersion. Major/minor/patch comparisons and the stable-vs-prerelease branches are unchanged. parseVersion gates inputs upstream, so semver.compare receives only validated v-strings."

key-files:
  created:
    - tests/test-marketplace-cache-prerelease-pick.cjs (182 lines; 5 hermetic sub-tests covering the four npm-semver prerelease rules + the subtle case-5)
  modified:
    - scripts/doctor.cjs (cmpVersion at line ~201-229; +1 require('semver') at line ~37; prior `localeCompare` branch replaced with `semver.compare(a.raw, b.raw)`; ~15 lines of inline comment block documenting the bug + the fix + the safety rationale)
    - tests/run-all-126.sh (CJS_SUITES entry registered for the Phase 126 scoped runner)

key-decisions:
  - "semver library (not CLI) chosen over alternative comparators. Decision logged in CONTEXT.md Open Question 2: semver runtime dep was already at ^7.7.4 from Phase 123, so the cost is zero. Bumper CLIs (npm version, @rstacruz/bump-cli, bump2version, bumpver) were considered and rejected as wrong-category -- they transform one version into another; the cache-pick problem is comparing two existing versions. semver.compare is the exact-fit primitive."
  - "Inline comment block kept verbose. Future maintainers reading cmpVersion need to understand WHY this branch uses a library while the rest uses raw arithmetic. The comment names the bug source (2026-05-13 Windows dogfood, beta.9 vs beta.13), the cost (silent regression to stale install), the spec reference (npm-semver section 11.4.4), and the safety rationale (parseVersion regex pre-validates inputs upstream). Per Canon Part 6 dog-fooding -- the autopsy lives next to the fix."
  - "Cmp orientation preserved: semver.compare returns -1/0/+1 matching the prior cmpVersion contract (sort by ascending order); the consumer at line ~2692 expects the same sign convention. Zero ripple changes to call sites."

# Verification (Nyquist)
verification:
  tests:
    - file: tests/test-marketplace-cache-prerelease-pick.cjs
      cases: 5
      passed: 5
      failed: 0
      coverage:
        - "Case 1 (beta.9 vs beta.13 → beta.13 wins): the literal 2026-05-13 Windows dogfood scenario; the regression that motivated this plan"
        - "Case 2 (beta.13 vs beta.14 → beta.14 wins): adjacent prerelease ordering; confirms numeric-component comparison is generalized"
        - "Case 3 (beta.13 vs rc.1 → rc.1 wins): cross-label prerelease ordering (npm-semver spec rule 3); rc beats beta regardless of numeric suffix"
        - "Case 4 (beta.13 vs 1.13.0 stable → 1.13.0 wins): stable beats prerelease at the same core (npm-semver rule 2); cmpVersion's stable-vs-prerelease branch verified intact"
        - "Case 5 (1.13.0 stable vs 1.14.0-beta.1 → 1.14.0-beta.1 wins): newer minor's prerelease beats older stable (npm-semver rule 1); the subtle case where major.minor.patch comparison takes precedence over the prerelease tag"

  regression-guards:
    - "tests/test-doctor-fix-renderer.cjs (sibling Plan 126-01): 7/7 GREEN -- no regression on the renderer surface from the cmpVersion edit"
    - "tests/test-cache-prune-extended.cjs (sibling Plan 126-06): 7/7 GREEN -- no regression on the cache-prune surface from the cmpVersion edit"
    - "tests/run-all-126.sh aggregator: 3/3 PASSED (all Phase 126 Wave 1 tests GREEN)"
    - "Phase 123 acceptance harness: pre-existing failure on tests/test-doctor-acceptance.cjs case acc.5 (release.sh Step 9.6 ordering) was already present before this plan ran; verified pre-existing via stash test in Plan 01. Plan 04 territory."

# Acceptance criteria (from CONTEXT.md per-plan)
acceptance:
  - "[x] tests/test-marketplace-cache-prerelease-pick.cjs passes all 5 cases"
  - "[x] beta.9 vs beta.13: beta.13 wins"
  - "[x] beta.13 vs beta.14: beta.14 wins"
  - "[x] beta.13 vs rc.1: rc.1 wins"
  - "[x] beta.13 vs 1.13.0 stable: 1.13.0 wins"
  - "[x] 1.13.0 vs 1.14.0-beta.1: 1.14.0-beta.1 wins"
  - "[x] semver package is reused from existing runtime dep (not newly added)"
  - "[x] tests/run-all-126.sh registers the new test"

# Deviations (the parallel-wave staging race)
deviations:
  - "GIT-ATTRIBUTION RACE: the agent assigned to this plan did NOT author its own commits. Sibling Plan 126-01's executor (running in parallel in the same working tree) staged scripts/doctor.cjs and tests/test-marketplace-cache-prerelease-pick.cjs as part of its own RED + GREEN commits. As a result:
      - The Plan 02 test file landed inside commit d6c891e (titled 'test(126-01): add RED renderer contract test for /mos:doctor --fix'); commit message does NOT reference Plan 02 even though the test file is Plan 02's deliverable.
      - The Plan 02 cmpVersion fix landed inside commit 14fbd45 (titled 'fix(126-01): doctor --fix renderer emits recovered+backup lines (GREEN)'); commit message does NOT reference Plan 02 even though the cmpVersion edit is Plan 02's deliverable.
      Verified via `git log -S 'semver.compare(a.raw' -- scripts/doctor.cjs`: the line was first added in 14fbd45.
    Impact: the code is correct, the tests pass, the regression guards pass. Audit trail is mis-attributed by commit-message but accurate by content.
    Root cause: parallel agents in the same git working tree. The workflow's `<parallel_execution>` block uses --no-verify shared-tree commits to avoid hook contention, which by design lets one agent stage another agent's untracked files. Plan 06 (separate file, lib/core/cache-prune.cjs) was unaffected by the race.
    Mitigation: this SUMMARY documents the attribution explicitly so future audits can trace Plan 02's actual work to commits 14fbd45 + d6c891e + this SUMMARY commit. The post-wave hook validation (workflow step 4) passes, so the substantive Canon Part 8 + lockstep checks remain enforced."
  - "AGENT TERMINATED VIA AUTH ERROR: the agent assigned to this plan ran for ~3 hours after the staging race and accumulated 114 tool uses before dying with `API Error: 401 Invalid authentication credentials`. The wall clock duration is misleading -- substantive work was complete within the first ~10 minutes (verified by the cmpVersion fix landing in 14fbd45 at 2026-05-14T10:39:25Z). The remaining hours were the agent attempting to author the SUMMARY + STATE updates without realizing its work had already been committed by the sibling. The auth failure was the final cause of termination but not the cause of the missing SUMMARY -- the SUMMARY had no place to land (the agent had no commits of its own to point at). Orchestrator authored this SUMMARY post-hoc to close the audit trail."

# Outcomes
outcomes:
  - "2026-05-13 Windows dogfood finding 3b is closed at the source. Future Windows installs with two-digit beta numbers in the marketplace cache will pick the highest-numbered beta, not the alphabetically-first."
  - "The bug class (lexicographic ordering of version strings) is durably fixed across all 5 npm-semver prerelease rules. No silent regression will surface at the next minor with N >= 10 betas."
  - "Canon Part 7 (reuse-before-build) honored: semver runtime dep reused, no new comparator added. Canon Part 8 (graph boundary) unaffected: cmpVersion is pure-local arithmetic, zero network surface."

# Cross-plan handoffs
handoffs:
  - to: Plan 126-03 (acceptance-gate self-coverage)
    via: tests/test-doctor-acceptance-self-coverage.cjs will include a 'marketplace-cache with stale topology' fixture that calls doctor --acceptance with scaffolded beta.N directories and asserts the recovered version matches the semver-correct winner. This plan ships the cmpVersion fix; Plan 03 ships the acceptance-level fixture that exercises it.
  - to: Plan 126-04 (release.sh tag-push + minisite + npx)
    via: release.sh Step 5.5 (tag-push verification) will not be affected by the cmpVersion fix (release.sh uses git tag operations, not the doctor cache-pick). However, the family pre-mortem doc in Plan 04 Task 3 should reference this plan's fix as one of the closed cases in the install-cache family history table.
---

# 126-02 marketplace-cache-prerelease-semver -- SUMMARY

## What shipped

The `cmpVersion` helper inside `scripts/doctor.cjs` (line ~201) now compares prerelease version strings using `semver.compare` from the existing `semver@^7.7.4` runtime dependency. The prior implementation used `String.prototype.localeCompare`, which sorts strings lexicographically -- and lexicographic ordering produces wrong results for version numbers containing multi-digit numeric components (`beta.10` sorted BEFORE `beta.9` because the ASCII character `1` comes before `9`).

The fix is a single new branch inside the existing `a.prerelease && b.prerelease` block. Major / minor / patch comparisons and the stable-vs-prerelease branch are untouched. `parseVersion` gates inputs upstream, so `semver.compare` only receives validated version strings -- the regex at line ~181 ensures both inputs conform to `M.m.p(?:-PR)?` shape before reaching cmpVersion.

## Why this matters in practice

On 2026-05-13, a Windows tester ran `/mos:doctor --fix` against an install whose marketplace cache contained both `1.13.0-beta.9/` and `1.13.0-beta.13/` directories. The doctor "recovered" the install to `beta.9`, four releases stale. Silent regression. The tester thought they got fixed; they got pinned in the past.

The bug was a single-character-comparison artifact. `'beta.10'.localeCompare('beta.9')` returns `-1` (meaning `'beta.10'` sorts BEFORE `'beta.9'`) because the comparator walks character by character and at position 5 finds `'1' < '9'` in ASCII. For sorting words in a phonebook this rule is fine. For sorting versions where numeric components are meaningful, this rule is wrong.

`semver.compare` parses each version, isolates the numeric prerelease component, and compares it as a number. `beta.9 < beta.10 < beta.13`, correctly.

## Verification

5 hermetic test cases in `tests/test-marketplace-cache-prerelease-pick.cjs`, all GREEN. The cases cover the four npm-semver prerelease ordering rules + the subtle case where a newer minor's prerelease beats an older stable (`1.14.0-beta.1 > 1.13.0`).

Sibling plans 126-01 and 126-06 both ran in parallel and their regression guards are GREEN: `test-doctor-fix-renderer.cjs` 7/7, `test-cache-prune-extended.cjs` 7/7. Phase 126 scoped aggregator (`tests/run-all-126.sh`) reports 3/3 PASSED.

## Audit trail (the parallel-wave staging race)

The plan-02 agent did not author its own commits. Sibling plan 126-01's executor staged this plan's work as part of its own RED + GREEN commits because both agents were editing `scripts/doctor.cjs` in the same working tree. The test file landed in `d6c891e`; the cmpVersion fix landed in `14fbd45`. Verified by `git log -S 'semver.compare(a.raw'` returning `14fbd45` as the first commit to contain the line. See the `deviations` block above for the full account.

This SUMMARY closes the audit trail. STATE.md and ROADMAP.md are updated in the same commit.

## Closes

- 2026-05-13 Windows dogfood finding 3b (marketplace cache picks alphabetically-first beta instead of semver-highest)
- CONTEXT.md Acceptance Criteria (Nyquist UAT) block for Plan 02 (all 5 sub-criteria GREEN; semver reuse confirmed; run-all-126.sh wiring confirmed)
- CONTEXT.md Open Question 2 (semver runtime vs devDep): settled as runtime reuse, no new dep

## Does NOT close (downstream)

- Plan 04 release.sh tag-push + Step 9.6 install-minisite lockstep + Step 9.7 npx self-test (Wave 3; depends on Plans 03 + 05)
- Plan 03 acceptance-gate self-coverage (Wave 2; will exercise this fix via the marketplace-cache-stale-topology fixture)
- Plan 05 release-flight preflight in --acceptance (Wave 2; absorbs Phase 123 cut hot-patches; independent of this fix)
- Plan 07 install-state.json schema v2 + migration (Wave 2; Plan 03 depends on it)

Three remaining waves. Wave 2 fires next (sequential 07 → 03 → 05). Wave 3 fires Plan 04 (the largest plan in Phase 126).
