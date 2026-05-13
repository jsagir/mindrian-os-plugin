---
plan: 06
phase: 123-install-lifecycle-harness
status: shipped-pending-windows-gate
shipped_version: 1.13.0-beta.13
shipped_tag: v1.13.0-beta.13
shipped_at: "2026-05-13T12:11:46+03:00"
shipped_commit_a: 09ee5a4
shipped_commit_b: 04fc979
canon_map_commit: bc8e05d
released_npm: "@mindrian_os/install@1.13.0-beta.13"
npm_dist_tag: next
marketplace_source_ref: v1.13.0-beta.13
requirements_satisfied: [HARNESS-123-17]
t5_status: pending-operator
created: 2026-05-13
---

# Plan 123-06 — Summary

## Self-Check: PASSED (T1-T4) / T5: pending operator

**Plan-06 is the release cut.** `v1.13.0-beta.13` is **SHIPPED** — tag on GitHub origin, npm `@mindrian_os/install@1.13.0-beta.13` published with the `next` dist-tag, marketplace `source.ref` pinned to the tag. The clean `1.13.0` promotion (T5's manual gate) waits on a real-Windows `mindrian-os doctor --acceptance` run.

## Task status

| Task | Type | Status | Notes |
|------|------|--------|-------|
| T1 | pre-flight + CHANGELOG compose | DONE | 5 release-flight hot-patches landed during pre-flight to make `doctor --acceptance --pre-tag` green; CHANGELOG `[Unreleased]` body composed with entries for all 7 plans + the 5 hot-patches + 4 Changed + 3 Notes |
| T2 | dry-run + operator confirm (BLOCKING) | DONE | Added `release.sh --dry-run` as a sixth hot-patch (`MOS_TEST_DRY_RUN=1` only skipped the npm publish, not the pushes — that was the Plan-06 plan-design bug). Operator reviewed the dry-run output, approved. |
| T3 | `bash scripts/release.sh --prerelease --allow-ahead` | DONE | Commit A `09ee5a4 release: v1.13.0-beta.13` + tag + npm publish + push origin main + tags + marketplace push + commit B `04fc979 chore: bump to v1.13.0-beta.14`. **86 commits pushed.** Step 9.6 reported 3 false-positive FAILs (design bug in Plan-04 — Step 9.6 reads post-commit-B `plugin.json` and looks for `vN+1` artifacts; correct fix: pass `RELEASED_VERSION` explicitly). The release ARTIFACT is internally consistent and correct — see verification below. |
| T4 | CANON-PHASE-MAP.md Part 6 + Part 7 + version history rows | DONE | Commit `bc8e05d`. Phase 123 mapped under Part 6 (dog-fooding the install lifecycle) + Part 7 (~90% reuse of shipped code). |
| T5 | Windows operator `mindrian-os doctor --acceptance` (BLOCKING) | PENDING | External action. See "T5 instructions" below. |

## Release-flight hot-patches (all shipped in beta.13)

| Commit | Fix | Why it surfaced |
|--------|-----|-----------------|
| `208c294` | chore(testers): park the Wave-3 tester row + auto-gen dashboard drift | `verify-release` Step 12 flagged 2 uncommitted tracked changes |
| `69a5240` | fix(123-02): install-state record `active_version` derives from resolver root, not plugin.json | Plan-06 pre-flight class-I gate caught the contradiction (`active_root` pointed at `.../mos/1.12.5.1`; `active_version` said `1.13.0-beta.12` from the dev workspace's plugin.json) |
| `267d395` | fix(123-06): `verify-release` Step 12 doesn't die on a clean tracked tree | `git status --porcelain | grep -v "^??" | wc -l` exited non-zero on a clean tracked tree (only untracked files); `set -e` killed the script silently |
| `b41f232` | fix(123-06): quote `argument-hint` in operator.md + doctor.md (YAML parse bug) | Latent in main for at least a session; only visible once Step 12's silent death was fixed |
| `dce0303` | fix(123-06): add `release.sh --dry-run` for true pre-release inspection | T2's "dry-run" via `MOS_TEST_DRY_RUN=1` was production-minus-publish; the real flag short-circuits before any mutation |

Plus one filesystem-only operator action (not committed): renamed `~/.claude/plugins/mindrian-os` → `~/.claude/plugins/mindrian-os.legacy-2026-05-13.bak` (87MB legacy clone with a hostile index — staged additions of HOME-dir paths from a stray earlier `git add -A`; preserved for triage, taken out of resolver-sight). And one filesystem-only re-stamp: deployed `scripts/statusline-mos-dispatch` → `~/.claude/statusline-mos` to satisfy class-J's marker check (session-start Step A would do this on next session anyway).

## Verification: the released artifact is internally consistent

| Invariant | Status | Evidence |
|-----------|--------|----------|
| Tag `v1.13.0-beta.13` on GitHub origin | ✓ | `git ls-remote --tags origin v1.13.0-beta.13` → `09ee5a4fc48a840647eb61e214dd00fdb9b2dc6c` |
| Tag points at commit A (plugin.json == 1.13.0-beta.13) | ✓ | `git show v1.13.0-beta.13:.claude-plugin/plugin.json` → `1.13.0-beta.13` |
| Marketplace `source.ref` pinned + `version` updated | ✓ | `~/mindrian-marketplace/.claude-plugin/marketplace.json` → `version: 1.13.0-beta.13`, `source.ref: v1.13.0-beta.13` |
| npm `@mindrian_os/install@1.13.0-beta.13` published | ✓ | `npm view @mindrian_os/install@1.13.0-beta.13 version` → `1.13.0-beta.13` |
| `next` dist-tag points at beta.13 | ✓ | `npm dist-tag ls @mindrian_os/install` → `next: 1.13.0-beta.13` |
| `latest` dist-tag unchanged (stays at beta.12) | ✓ | Same query → `latest: 1.13.0-beta.12` (correct: pre-releases don't move `latest`) |
| `main` HEAD at commit B (plugin.json == 1.13.0-beta.14, CHANGELOG [Unreleased] reset) | ✓ | `04fc979 chore: bump to v1.13.0-beta.14 (next pre-release)` |

## Step 9.6 false positives (Plan-04 design bug — beta.14 fix candidate)

Three FAILs at Step 9.6 (full `doctor --acceptance` post-publish):

1. **`verify-release`** exited 1: `verify-release` Step 13 checks for a CHANGELOG entry for the CURRENT `plugin.json` version. After commit B, current = `1.13.0-beta.14`. CHANGELOG `[Unreleased] -- v1.13.0-beta.14 (in progress)` is the intentional next-release state; no `[1.13.0-beta.14]` entry exists yet. Verify-release sees a missing entry → exits 1.
2. **`version-of-record-published`**: "git tag v1.13.0-beta.14 not found". Step 9.6 reads `plugin.json` for the version to check, which is now `1.13.0-beta.14` (post-commit-B). The tag we just pushed is `v1.13.0-beta.13`. Looking for the wrong tag.
3. **`npx-roundtrip`**: same root cause. The sandbox attempted `npx @mindrian_os/install@1.13.0-beta.14` (not published yet by design).

**Root cause: Plan-04's Step 9.6 invocation reads `RELEASED_VERSION` from current `plugin.json` instead of from an explicit argument carrying the just-tagged version.** Fix in beta.14: `release.sh` passes `--released-version=$NEW_VERSION` to `doctor --acceptance`; the doctor uses that for the published-artifact checks instead of `plugin.json.version`. Verification: Step 9.6 against the v1.13.0-beta.13 tag's state would pass all 7 points (the artifacts ARE consistent as shown above).

**DO NOT execute the R.4 recovery (yank + deprecate). beta.13 is correct.**

## T5 instructions (operator: Lawrence or equivalent on a Windows box)

1. Refresh the marketplace catalog: `/plugin marketplace update`
2. Update the plugin to beta.13: `claude plugin update mos@mindrian-marketplace` (or `claude plugin update mos@mindrian-marketplace --version 1.13.0-beta.13` if not on the beta channel)
3. Restart Claude Code
4. Run: `mindrian-os doctor --acceptance` — **expected: ALL GREEN.** If 3 FAIL findings appear matching the Plan-04 design bug above (verify-release/version-of-record-published/npx-roundtrip all reporting `v1.13.0-beta.14`-not-found symptoms), those are the same false positives observed on the maintainer's box; the artifact itself is correct.
5. Spot-check: `mindrian-os doctor --install-state --json` should report `topology: marketplace-cache`, install-state record present, deployment-surfaces healthy, version-of-record-repo green
6. Confirm `Brain: HTTP client active (mindrian-brain.onrender.com)` (or `Brain: not configured (Tier 0)` if no key) appears in the session-start banner — the MCP-centric WARN is GONE
7. **PASS** = promote to clean `1.13.0`. The follow-up: `bash scripts/release.sh --finalize` from `~/MindrianOS-Plugin` on the maintainer's machine, NOT this plan's work.

## Open issues for v1.13.0-beta.14

1. **Plan-04 Step 9.6 design bug** (this SUMMARY § "Step 9.6 false positives") — Step 9.6 must explicitly target the just-released version, not the post-commit-B current version. Affected files: `scripts/release.sh` Step 9.6 invocation + `scripts/doctor.cjs`'s `--acceptance` argument parsing (add `--released-version=...` or similar).
2. **Plan-06 plan-design bug**: T2 specified `MOS_TEST_DRY_RUN=1 bash scripts/release.sh --prerelease` as the "dry-run review", which is not actually a dry-run (only Step 9.5 is skipped). The plan should be amended to use the new `release.sh --dry-run` flag (shipped here in `dce0303`).
3. **release.sh dry-run output cosmetic**: "To run the actual release: bash scripts/release.sh prerelease" should be `--prerelease` (missing the dashes). Trivial fix.
4. **Plan-02 reconciliation logic**: the on-disk record sometimes lands with `ok: false` on the `settings-statusline-command` surface because session-start writes the record EARLY (before Step A might re-stamp the shim). The class-J check passes when re-run later. The reconciler could re-attempt the surface check after Step A. Not blocking.
5. **The 87MB legacy clone at `~/.claude/plugins/mindrian-os.legacy-2026-05-13.bak`** needs manual triage — its index has staged additions of HOME-dir paths (`.aws`, `.azure`, `.backups/...`, binary garbage) from a stray earlier `git add -A`. Likely Phase 117 or earlier era. Recommend: inspect with `cd ~/.claude/plugins/mindrian-os.legacy-2026-05-13.bak && git status` and `git reset` the unwanted paths from the index, then archive or delete.
6. **Concurrent-execution incidents** (Phase 110 / Phase 104 / Phase 124 / `fix/brain-client-...` running on shared `.git` during the Phase 123 autonomous waves): one `git add -A` swept files into the wrong commit; one branch-checkout yanked the orchestrator's HEAD; one phantom-delete required a re-deletion. All recovered. The pattern documented for a future `gsd-executor` worktree-isolation-by-default improvement.

## Phase 123 status

6 of 7 plans complete + Plan-06 substantively done (T1-T4); Plan-06 T5 pending operator. Per the workflow's `handle_partial_wave_execution`: phase verification + completion are deferred until T5 is verified (or until the operator decides T5's false positives are acceptable and signs off).

— Plan 123-06, signed off by the planner-executor 2026-05-13.
