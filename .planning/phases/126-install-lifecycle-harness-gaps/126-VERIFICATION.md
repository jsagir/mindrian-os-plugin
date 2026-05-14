---
phase: 126-install-lifecycle-harness-gaps
verified: 2026-05-14T19:30:00Z
status: human_needed
score: 9/9 must-haves verified
verifier_model: claude-sonnet-4-6
human_verification:
  - test: "Cut a real beta.15 release via scripts/release.sh --prerelease"
    expected: "Step 9.6 fails first run (origin remote missing on /home/jsagi/mindrianos-install-site), emits 'git remote add origin' recovery; after one-time bootstrap, subsequent runs sail through Step 9.6 -> Vercel live-poll confirms new version"
    why_human: "Step 9.6 HARD lockstep requires a real git push origin main to a live Vercel-connected repo, a real curl live-poll against https://mindrianos-install-site.vercel.app/, and a real npm publish success for Step 9.7. The test fixture (Test 4-9 in test-release-bump-tag-and-publish-gates.cjs) covers structural checks and HTTP mocks but cannot substitute for the real release run."
  - test: "Upgrade a real beta.13 tester install (Lawrence or Gary) to beta.15"
    expected: "session-start emits '[session-start] install-state migrated v1 -> v2'; ~/.mindrian/install-state.json gains schema_version:2, topology_class:'healthy', last_acceptance_run:null, renderer_contract_version:'unknown'; no manual --fix required"
    why_human: "The migration smoke test was verified on the maintainer's own dev box, but cannot be run against a remote tester's machine programmatically. The upgrade path involves the tester pulling beta.15 and session-start firing on their machine."
  - test: "Verify mindrianos-install-site.vercel.app reflects the beta.15 version after release cut"
    expected: "https://mindrianos-install-site.vercel.app/ shows 'v1.13.0-beta.15' within 180s of git push origin main from ~/mindrianos-install-site/"
    why_human: "Vercel auto-deploy requires the minisite repo to have a live origin remote. Per Plan 04 SUMMARY 'User Setup Required', the first real release cut will fail at the origin-check because ~/mindrianos-install-site has NO origin remote configured. The operator must run 'git remote add origin <url> && git push -u origin main' once before the HARD lockstep can succeed end-to-end."
---

# Phase 126: Install-Lifecycle Harness Gaps Verification Report

**Phase Goal:** Close the install-lifecycle gaps that surfaced via the 2026-05-13 Windows dogfood session AFTER Phase 123 shipped its harness in v1.13.0-beta.13. Four concrete dogfood findings + acceptance-gate self-coverage + release.sh release-pipeline hardening (install-minisite Hard-tier lockstep promoted from Soft) + schema migration for ~/.mindrian/install-state.json v1->v2 + a 1-page pre-mortem for the next install-cache case. Ships as v1.13.0-beta.15.

**Verified:** 2026-05-14T19:30:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `/mos:doctor --fix` emits BOTH `recovered to <version>` AND `backup <path>` lines (M1.1) | VERIFIED | `tests/test-doctor-fix-renderer.cjs` 7/7 GREEN; `scripts/doctor.cjs` lines 2656-2673 confirm the `classARecovered` branch emits both lines; contract-as-source pattern loads `commands/doctor.md` as fixture |
| 2 | Marketplace cache picks beta.13 over beta.9 (semver correct) (M1.2) | VERIFIED | `tests/test-marketplace-cache-prerelease-pick.cjs` 5/5 GREEN; `scripts/doctor.cjs` line 223 uses `semver.compare(a.raw, b.raw)` replacing the prior `localeCompare` bug |
| 3 | Install-minisite stays in sync with plugin version cuts via release.sh Step 9.6 HARD (M1.3) | VERIFIED (automated); HUMAN NEEDED (live end-to-end) | `scripts/release.sh` line 477-622 contains the full HARD lockstep; `tests/test-release-bump-tag-and-publish-gates.cjs` 13/13 GREEN; WARN 2 invariant confirmed (MINISITE_DIR-absent emits `gh repo clone`, origin-missing emits `git remote add origin`, no cross-contamination); live Vercel poll requires human |
| 4 | Stale `mindrian-os.stale-*` backup dirs older than 30 days are pruned (M1.4) | VERIFIED | `tests/test-cache-prune-extended.cjs` 7/7 GREEN; `lib/core/cache-prune.cjs` line 266 has `pruneStaleBackups` with `MOS_CACHE_PRUNE_AGE_DAYS` env override; period-literal pattern `/^mindrian-os\.stale-/` guards live install |
| 5 | `test-doctor-acceptance-self-coverage.cjs` ships 5 scaffolded-broken-state fixtures wired into release.sh Step 6.6b (M2) | VERIFIED | 6/6 GREEN; `scripts/release.sh` lines 381-397 have Step 6.6b HARD ABORT block; `--dry-run` output shows Step 6.6b |
| 6 | release.sh Step 5.5 tag-push verify exists with retry + bypass (M3.1) | VERIFIED | `scripts/release.sh` line 756-793 contains Step 5.5; `RELEASE_TAG_PUSH_RETRIES` env var supported; `SKIP_TAG_VERIFY=1` bypass logged |
| 7 | release.sh Step 9.6 install-minisite HARD lockstep + Step 9.7 npx-publish self-test + Step 9.8 renamed (M3.2/M3.3/M3.4) | VERIFIED (structure); HUMAN NEEDED (live run) | All three steps present in `scripts/release.sh`; `--no-minisite` flag parsed at line 98; 13/13 test cases GREEN |
| 8 | `lib/core/install-state.cjs` ships v1->v2 additive migration + future-version-warn-not-downgrade + session-start integration (M4) | VERIFIED | `lib/core/install-state.cjs` exists (9325 bytes, 242 lines); `SCHEMA_VERSION=2`; `migrateIfNeeded` has 4-path matrix; `scripts/session-start` line 107 places migration BEFORE Phase 123 writer (line 142); `tests/test-install-state-migration.cjs` 6/6 GREEN |
| 9 | 5 Phase 123 cut hot-patches now run as `doctor --acceptance` checklist entries (M5) | VERIFIED | `tests/test-doctor-acceptance-preflight-checks.cjs` 7/7 GREEN; `scripts/doctor.cjs` has 5 new entries appended to `buildAcceptanceChecklist` after the existing 7 |
| 10 | `docs/install-cache-family-premortem.md` exists with all 4 required sections (M6) | VERIFIED | File exists (102 lines); Sections 1-4 confirmed; linked from `docs/CANON-PHASE-MAP.md` Part 6 row (line 103) |
| 11 | acc.5 in `tests/test-doctor-acceptance.cjs` now PASSES (M8) | VERIFIED | 6/6 GREEN including acc.5; `off96` -> `off98` rename + `Step 9.6:` -> `Step 9.8:` in test; `deferred-items.md` marked RESOLVED at commit `efee3a2` |
| 12 | Zero regression: Phase 123 baselines all GREEN (M9) | VERIFIED | `test-doctor-acceptance.cjs` 6/6; `test-doctor-class-i.cjs` 11/11; `test-cache-prune.cjs` 6/6; `run-all-126.sh` 7/7 in 12s |

**Score:** 12/12 truths verified (3 with supplemental human confirmation needed for the live release-run surface)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tests/test-doctor-fix-renderer.cjs` | Plan 01 renderer contract test, 7 sub-tests | VERIFIED | 411 lines; 7/7 GREEN; contract-as-source pattern |
| `tests/test-marketplace-cache-prerelease-pick.cjs` | Plan 02 semver-pick, 5 cases | VERIFIED | 182 lines; 5/5 GREEN |
| `tests/test-doctor-acceptance-self-coverage.cjs` | Plan 03 acceptance-gate self-coverage, 6 sub-tests | VERIFIED | 489 lines; 6/6 GREEN |
| `tests/test-release-bump-tag-and-publish-gates.cjs` | Plan 04 release gates, 13 cases | VERIFIED | 13/13 GREEN |
| `tests/test-doctor-acceptance-preflight-checks.cjs` | Plan 05 preflight checks, 7 sub-tests | VERIFIED | 342 lines; 7/7 GREEN |
| `tests/test-cache-prune-extended.cjs` | Plan 06 cache prune extended, 7 scenarios | VERIFIED | 415 lines; 7/7 GREEN |
| `tests/test-install-state-migration.cjs` | Plan 07 schema v2 migration, 6 sub-tests | VERIFIED | 327 lines; 6/6 GREEN |
| `tests/run-all-126.sh` | Phase 126 aggregator, all 7 suites registered | VERIFIED | All 7 CJS_SUITES entries present; 7/7 PASS in 12s |
| `lib/core/install-state.cjs` | NEW: v2 schema module with migration | VERIFIED | 242 lines; 5 exports + SCHEMA_VERSION=2; atomic write; future-version detection |
| `lib/core/cache-prune.cjs` | Extended: stale-backup prune | VERIFIED | `MOS_CACHE_PRUNE_AGE_DAYS` env var; `pruneStaleBackups` function; period-literal pattern |
| `scripts/doctor.cjs` | Extended: renderer fix + semver + 5 new acceptance entries + expectedSteps 14-entry | VERIFIED | `classARecovered` branch at line 2656; `semver.compare` at line 223; 5 new checklist entries; expectedSteps array has 14 entries (Step 5.5, 9.7, 9.8 confirmed) |
| `scripts/release.sh` | Extended: Step 5.5 + Step 9.6 HARD + Step 9.7 + Step 9.8 renamed + --no-minisite | VERIFIED | All steps present; MINISITE_DIR resolution; WARN 2 invariant confirmed |
| `scripts/session-start` | Extended: migration block before Phase 123 writer | VERIFIED | Line 107 migration block; line 142 Phase 123 writer; correct ordering confirmed |
| `docs/install-cache-family-premortem.md` | NEW: 4 sections, ~50-100 lines | VERIFIED | 102 lines; 4 sections; linked from CANON-PHASE-MAP |
| `.planning/phases/126-install-lifecycle-harness-gaps/126-STEP-0-MANUAL-RECOVERY.md` | Step 0 doc deliverable | VERIFIED | Exists; workspace guard present; git tag verification confirmed; npm publish as optional action |
| `docs/CANON-PHASE-MAP.md` | Part 6 row references Phase 126 with pre-mortem doc link | VERIFIED | Line 103: "shipped | Phase 126 install-lifecycle-harness-gaps" with pre-mortem reference |
| `.planning/phases/126-install-lifecycle-harness-gaps/deferred-items.md` | acc.5 marked RESOLVED | VERIFIED | "RESOLVED 2026-05-14" with commit `efee3a2` reference |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `scripts/doctor.cjs` `cmpVersion` | `semver` library | `semver.compare(a.raw, b.raw)` | WIRED | Line 37: `require('semver')`; line 223: `return semver.compare(a.raw, b.raw)` in prerelease branch |
| `scripts/doctor.cjs` renderer | `classARecovered` branch | `if (report.classARecovered)` at line 2656 | WIRED | Emits `recovered to` + conditional `backup` line; `computeSummary` classifies as healthy |
| `scripts/release.sh` Step 9.6 | install-minisite files | `sed` content-anchored pattern + `git push origin main` + `curl` live-poll | WIRED (structurally); HUMAN NEEDED (live) | MINISITE_DIR resolution at line 503; two distinct failure paths with distinct recoveries at lines 508-538 |
| `scripts/release.sh` Step 5.5 | git tag at origin | `git ls-remote --tags origin` verification with retry | WIRED | Line 756-793; `RELEASE_TAG_PUSH_RETRIES` default 3; `SKIP_TAG_VERIFY=1` bypass |
| `scripts/release.sh` Step 9.7 | npx round-trip | `npx --yes @mindrian_os/install@<version>` against fresh tmpdir | WIRED (structurally) | Line 623-660; exit-0 + non-empty scaffold required |
| `scripts/release.sh` Step 6.6b | acceptance self-coverage | `node tests/test-doctor-acceptance-self-coverage.cjs` | WIRED | Line 381-397; HARD ABORT with identical rollback to Step 6.6 |
| `lib/core/install-state.cjs` | `scripts/session-start` | `migrateIfNeeded({home})` at line 107, BEFORE Phase 123 writer at line 142 | WIRED | Belt-and-suspenders: migrator at line 107; schema-aware writer merge at line 259 |
| `lib/core/cache-prune.cjs` `pruneStaleBackups` | `scripts/doctor.cjs` | `pruneMarketplaceCache` return includes `removedBackups + ageDays` | WIRED | Lines 237-241 call `pruneStaleBackups`; return shape extended additively |
| `tests/test-doctor-acceptance.cjs` acc.5 | `scripts/release.sh` Step 9.8 | `off98` variable + `Step 9.8:` literal | WIRED | Plan 04 commit `efee3a2` renamed the tracking variable and literal |

---

### Data-Flow Trace (Level 4)

Phase 126 is an infra-hardening phase. All artifacts are test fixtures, CLI scripts, or migration modules -- none are React/Vue components or API routes rendering dynamic data from a database. Level 4 data-flow trace is not applicable.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Plan 01 renderer contract | `node tests/test-doctor-fix-renderer.cjs` | 7/7 PASS | PASS |
| Plan 02 semver prerelease pick | `node tests/test-marketplace-cache-prerelease-pick.cjs` | 5/5 PASS | PASS |
| Plan 03 acceptance self-coverage | `node tests/test-doctor-acceptance-self-coverage.cjs` | 6/6 PASS | PASS |
| Plan 04 release gates | `node tests/test-release-bump-tag-and-publish-gates.cjs` | 13/13 PASS | PASS |
| Plan 05 preflight checks | `node tests/test-doctor-acceptance-preflight-checks.cjs` | 7/7 PASS | PASS |
| Plan 06 cache prune extended | `node tests/test-cache-prune-extended.cjs` | 7/7 PASS | PASS |
| Plan 07 schema v2 migration | `node tests/test-install-state-migration.cjs` | 6/6 PASS | PASS |
| Phase 126 full aggregator | `bash tests/run-all-126.sh` | 7/7 PASS, 12s | PASS |
| Phase 123 acceptance baseline (including acc.5) | `node tests/test-doctor-acceptance.cjs` | 6/6 PASS | PASS |
| Phase 123 class-i regression | `node tests/test-doctor-class-i.cjs` | 11/11 PASS | PASS |
| Phase 123 cache-prune regression | `node tests/test-cache-prune.cjs` | 6/6 PASS | PASS |
| doctor.cjs syntax check | `node -c scripts/doctor.cjs` | exits 0 | PASS |
| release.sh syntax check | `bash -n scripts/release.sh` | exits 0 | PASS |
| Vercel live-deploy of minisite | real release.sh run required | not run | SKIP (human needed) |
| Beta.13 -> beta.15 tester upgrade | requires remote tester machine | not run | SKIP (human needed) |

---

### Requirements Coverage

Phase 126 has no explicit requirement IDs (`phase_req_ids: null` per CONTEXT.md). Coverage traced directly against CONTEXT.md "Scope IN" and "Acceptance Criteria (Nyquist UAT)" sections.

| Deliverable | CONTEXT.md Nyquist UAT | Status | Evidence |
|-------------|------------------------|--------|----------|
| Step 0 (manual unblock) | `git ls-remote` tag verified; `126-STEP-0-MANUAL-RECOVERY.md` exists | SATISFIED | Tag at origin confirmed 2026-05-13; doc exists |
| Plan 01 (renderer contract) | `test-doctor-fix-renderer.cjs` passes; both lines emitted; summary aligns; contract doc is source | SATISFIED | 7/7 GREEN |
| Plan 02 (semver prerelease) | 5-case fixture passes; all 5 ordering rules correct; semver devDep reused | SATISFIED | 5/5 GREEN; `semver@^7.7.4` reused from Phase 123 |
| Plan 03 (acceptance self-coverage) | fixture passes; 5 scenarios covered; wired into Step 6.6b; live --acceptance continues to pass | SATISFIED | 6/6 GREEN; Step 6.6b WIRED |
| Plan 04 (tag-push + install-minisite + npx self-test) | Step 5.5 refuses on tag-push fail; Step 9.6 rewrites both minisite files; Step 9.6 commits + pushes + polls; --no-minisite works; Step 9.7 refuses on fail; dry-run shows all 3 new gates | SATISFIED (structure); HUMAN NEEDED (live run) | 13/13 GREEN; structural verified |
| Plan 05 (release-flight in --acceptance) | 5 hot-patches have class letters; --acceptance includes all 5; failing state fails correct check | SATISFIED | 7/7 GREEN |
| Plan 06 (cache prune extended) | stale backup dirs older than 30d pruned; recent dirs retained; configurable via env var | SATISFIED | 7/7 GREEN |
| Plan 07 (schema v2 + migration) | 4-path migration passes; additive only; write-back with schema_version:2; future-version defers; session-start integration pre-Phase-123-writer | SATISFIED | 6/6 GREEN |
| Pre-mortem doc | `docs/install-cache-family-premortem.md` exists; 4 sections; linked from CANON-PHASE-MAP Part 6 | SATISFIED | 4 sections; 102 lines; linked |

---

### Anti-Patterns Found

No blockers or warnings found. Specific checks run:

- `grep -rn "TODO|FIXME|placeholder" lib/core/install-state.cjs scripts/doctor.cjs scripts/release.sh scripts/session-start` -- 0 hits in Phase 126 additions (confirmed by Plan 05 and 07 SUMMARYs)
- `grep -n "return null\|return \[\]\|return {}" lib/core/install-state.cjs` -- no stub returns; `readInstallState` returns null for absent files by design (documented behavior, not a stub)
- `grep -rn "Step 9.6" scripts/ tests/ | grep -v "minisite\|lockstep\|HARD"` -- The only remaining references to "Step 9.6" in production code are the minisite HARD lockstep block itself. Old `--acceptance` references have been renamed to Step 9.8. WARN 1 check: no stale `--acceptance-context` references to the old Step 9.6 position found.
- WARN 2 cross-contamination check: MINISITE_DIR-absent path (lines 508-525) emits `gh repo clone`/`git clone` only. Origin-missing path (lines 530-540) emits `git remote add origin` only. Comments at lines 511 and 534 explicitly state the exclusive ownership. Test 5 and Test 6 in `test-release-bump-tag-and-publish-gates.cjs` each assert the other recovery message does NOT appear. Clean.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | - | - | - | No anti-patterns found |

---

### Human Verification Required

#### 1. First real beta.15 release.sh run - Step 9.6 HARD lockstep end-to-end

**Test:** Run `bash scripts/release.sh --prerelease` from `/home/jsagi/MindrianOS-Plugin/` to cut v1.13.0-beta.15.

**Expected:** Step 9.6 fails on first run because `/home/jsagi/mindrianos-install-site` has no `origin` remote. The error message emits:

```
Recovery: cd /home/jsagi/mindrianos-install-site && git remote add origin <git-url> && git push -u origin main
```

After the one-time bootstrap (`git remote add origin <url> && git push -u origin main`), the second release run proceeds through Step 9.6: sed rewrites `lib/os.ts` + `app/page.tsx`, grep-verifies, commits, pushes, and the curl live-poll confirms `https://mindrianos-install-site.vercel.app/` shows `v1.13.0-beta.15` within 180s.

**Why human:** Step 9.6 requires a live Vercel-connected minisite repo with a real origin remote. The 13/13 test cases use HTTP mocks and structural grep checks. The Vercel auto-deploy response, the curl poll returning the correct version string, and the two sed-rewritten file paths at their canonical content-anchored positions all require the real release run.

#### 2. Tester upgrade path - beta.13 install transparently migrates to v2

**Test:** On Lawrence's or Gary's machine (beta.13 install), pull beta.15, start a new Claude Code session.

**Expected:** `~/.mindrian/install-state.json` gains `schema_version: 2`, `topology_class: 'healthy'`, `last_acceptance_run: null`, `renderer_contract_version: 'unknown'`. Session-start emits `[session-start] install-state migrated v1 -> v2` to stderr. No manual `/mos:doctor --fix` required.

**Why human:** The smoke test (Plan 07 Task 3) ran on the maintainer's dev box. The remote tester's machine has a real v1 install-state.json written by beta.13's session-start. The migration path requires that machine to actually pull beta.15 and fire session-start against its own `~/.mindrian/install-state.json`.

#### 3. Vercel live-deploy confirmed at https://mindrianos-install-site.vercel.app/

**Test:** After the beta.15 release.sh run succeeds (including the one-time minisite origin bootstrap), visit `https://mindrianos-install-site.vercel.app/` in a browser.

**Expected:** The page shows `v1.13.0-beta.15` (or the final beta.15 version string) in both the terminal-display area (from `lib/os.ts`) and the eyebrow area (from `app/page.tsx`).

**Why human:** Vercel deploy status is not programmatically observable from the plugin repo. The curl live-poll is part of release.sh Step 9.6, but confirming the human-visible page renders correctly requires a browser check. This closes the memory rule `feedback_install_minisite_lockstep.md` Hard enforcement loop.

---

### Gaps Summary

No gaps. All 9 must-haves (M1 through M9) are verified against the actual codebase:

- M1 (4 dogfood findings): all closed with test coverage
- M2 (acceptance gate self-coverage): 6-fixture aggregator + Step 6.6b wired
- M3 (release-pipeline hardening): Steps 5.5 + 9.6 HARD + 9.7 + 9.8 rename, all present and structurally verified
- M4 (schema migration): lib/core/install-state.cjs fully wired with 4-path migration + session-start integration
- M5 (release-flight preflight absorbed): 5 new --acceptance entries, all GREEN
- M6 (family pre-mortem doc): 4 sections, 102 lines, linked
- M7 (Canon discipline): Part 6 dog-fooding confirmed (Plan 05 caught its own first drift); Part 7 reuse confirmed (semver reused, Phase 123 substrate extended not forked)
- M8 (acc.5 resolution): 6/6 GREEN including acc.5
- M9 (zero regression): Phase 123 / Phase 95.2 / Phase 95.1 suites all GREEN

The 3 human-verification items are not gaps -- they are live-environment behaviors that pass all automated structural checks but require an actual release run and real tester machine access to confirm end-to-end. Status is `human_needed` rather than `passed` specifically because Step 9.6's Vercel live-deploy path (the centerpiece of the install-minisite Hard-tier enforcement from memory rule `feedback_install_minisite_lockstep.md`) cannot be mechanically verified without running the release pipeline against a live minisite repo with an established origin remote.

**Phase 126 is ready to proceed to release cut once the minisite origin remote is bootstrapped.**

---

_Verified: 2026-05-14T19:30:00Z_
_Verifier: Claude (gsd-verifier), claude-sonnet-4-6_
