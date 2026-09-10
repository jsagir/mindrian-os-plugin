---
phase: 341-install-and-update-overhaul-npm-source-plugin-artifact-heavy
plan: 05
subsystem: release-ceremony
tags: [release-sh, npm-source, marketplace-json, doctor-acceptance, harness-tripwire, shrinkwrap]

# Dependency graph
requires:
  - phase: 341-04
    provides: "the files cut, npm-shrinkwrap.json, the two harness policies (release-payload-ceiling blocking, registry-drift logged), scripts/check-release-payload-ceiling.cjs"
  - phase: 341-01
    provides: "tests/run-all-341.sh aggregator conventions (run/run_if/run_red_until) and the step-block tripwire scaffold reading STEP_BLOCK_COUNT from a not-yet-minted fixture"
provides:
  - "release.sh Step 4 writes marketplace source as {source:npm, package:@mindrian_os/cli, version:<exact>}, rebuilt fresh so ref/url are deleted, no registry key"
  - "scripts/release-lib/shrinkwrap-gate.sh: mos_generate_shrinkwrap, injectable via MOS_SHRINKWRAP_HOOK/MOS_PACK_PROBE_HOOK, replaces Step 6.7's vendoring"
  - "release.sh Step 9.5 delegates to check-release-payload-ceiling.cjs --check; node_modules/ ban and docs/+release.sh blacklist alternatives removed"
  - "Commit-B git rm -r --cached node_modules block deleted"
  - "doctor.cjs version-of-record-published leg (b) via exported evaluateMarketplaceSourcePin(source, ver), accepting npm shape or legacy git shape during the transition"
  - "tests/fixtures/310-release-step-block-hashes.txt rebaselined wholesale; tests/fixtures/341-release-step-block-hashes.txt minted with STEP_BLOCK_COUNT"
  - "tests/run-all-310.sh leg 3 simplified to a uniform per-block hash comparison (old Step 5.5/Step 1 special-casing retired)"
affects: [341-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Injectable shell library idiom (verify-tag-push.sh) reused for shrinkwrap-gate.sh: return-code contract (0/1), hooks resolved by name via command -v, safe to source twice, safe under set -u"
    - "Extract-and-execute test idiom: test-341-marketplace-npm-source.cjs pulls the real Step 4 node -e body out of release.sh at test time via a structural regex, substitutes $NEW_VERSION, and runs it against a sandbox -- proves production code, not a hand-duplicated copy"
    - "Fixture regeneration retires prior normalization hacks: once a step-block fixture is regenerated wholesale from the post-edit file, per-block special-casing written for an earlier phase's single-line delta becomes both redundant and actively wrong (it would diff a normalized computation against a now-literal baseline) -- retire it in the same commit as the regeneration"

key-files:
  created:
    - scripts/release-lib/shrinkwrap-gate.sh
    - tests/test-341-release-shrinkwrap-gate.cjs
    - tests/test-341-marketplace-npm-source.cjs
    - tests/test-341-version-of-record-source-version.cjs
    - tests/fixtures/341-release-step-block-hashes.txt
  modified:
    - scripts/release.sh
    - scripts/doctor.cjs
    - tests/run-all-310.sh
    - tests/fixtures/310-release-step-block-hashes.txt
    - tests/test-release-bump-tag-and-publish-gates.cjs
    - .claude/includes/release-process.md

key-decisions:
  - "doctor.cjs's version-of-record-published leg (b) accepts EITHER the npm shape (source.version, D-01/D-06) OR the legacy git shape (source.ref === 'v'+ver) during the transition, per the orchestrator's explicit project-rules directive (continuity requirement: the point must stay green on today's still-git-shape live marketplace AND go green on the npm shape after the next release cut). This is a deliberate, instructed supplement to the plan's own Task 3 acceptance-criteria text, which assumed npm-shape-only and asked for a literal 'grep -c source.ref == 0' -- that literal criterion is not met (7 remaining source.ref occurrences, all part of the legacy-shape branch, its own comments, and one untouched historical RCA note), documented here as an explicit, reasoned deviation rather than silently satisfied."
  - "tests/run-all-310.sh leg 3's Step 5.5/Step 1 per-block special-casing (normalize-then-compare) is retired, not extended. It existed only to bridge a stale pre-Phase-310 fixture against one authorized line; once the fixture is regenerated wholesale from the post-341-edit file (this plan's Task 2), every block -- including Step 5.5's Phase 310 rewrite and Step 1's dry-run preview text -- hash-matches directly. Extending the old special-casing to also cover Phase 341's edits would have been wrong: the fixture no longer predates any of them."
  - "tests/test-341-marketplace-npm-source.cjs drives release.sh's ACTUAL Step 4 node -e body (extracted verbatim from the real file at test time) against a sandboxed marketplace repo, rather than running the whole release.sh (Step 2/2.5 read and assert against the real repo's own clean-tree state, and PLUGIN_DIR is derived from $0's dirname, not env-overridable) or hand-duplicating the Step 4 logic (which could silently drift from production). Stated per the plan's own instruction to record which approach was used and why."
  - "Fixed a latent, pre-existing bug in tests/test-release-bump-tag-and-publish-gates.cjs's cases 10/11 discovered while fixing the retired package name: `\\Z` is not an end-of-string anchor in JavaScript regex (unlike Perl/PCRE) -- it matches the literal letter Z. The Step-9.7-block extraction regex was truncating the block at the first literal 'Z' character (inside a date-format string, '+%FT%TZ'), which happened to occur before Step 9.7's real `exit 1` statements, hiding them from Test 11's assertion. This was NOT the documented package-name-drift root cause for Test 11 -- it is a distinct bug, fixed in the same commit since it lives in the exact two lines being edited for the package-name fix."

requirements-completed: [D-01, D-04, D-06, D-08, D-13]

# Metrics
duration: 130min
completed: 2026-09-10
---

# Phase 341 Plan 05: Release Ceremony Surgery (npm-source Step 4/6.7/9.5) Summary

**Rewrote release.sh Steps 4/6.7/9.5 for npm-source delivery (exact-pin marketplace source, injectable shrinkwrap-gate.sh replacing node_modules vendoring, payload-ceiling delegation), moved doctor's version-of-record check to source.version with dual-shape transition support, and rebaselined both Phase-310 scope tripwires plus a new Phase-341 fixture in the same execution -- release train never knowingly red between commits.**

## Performance

- **Duration:** ~130 min
- **Started:** 2026-09-10
- **Completed:** 2026-09-10
- **Tasks:** 3 completed
- **Files modified:** 11 (5 new, 6 modified)

## Accomplishments

- **Step 4** rebuilds `marketplace.json`'s `plugins[0].source` object wholesale as `{source:'npm', package:'@mindrian_os/cli', version:'<exact>'}` -- no `v` prefix, no `registry` key, and `ref`/`url` are DELETED (never left beside the new `version`, closing the half-migrated failure mode 341-RESEARCH named).
- **Step 6.7** no longer vendors `node_modules`. Its slot now sources a new injectable library, `scripts/release-lib/shrinkwrap-gate.sh` (`mos_generate_shrinkwrap`), in the exact `verify-tag-push.sh` idiom: return-code contract (0 success, 1 fail-closed, no warn code), hooks `MOS_SHRINKWRAP_HOOK`/`MOS_PACK_PROBE_HOOK` resolved by name, safe to source twice, safe under `set -u`. Three assertions in order: a clean `npm shrinkwrap` run, zero `dev:true` entries, and the lockfile present in the `npm pack --dry-run --json` payload (the single highest-risk assertion in the phase -- a silent skip would take down both alwaysLoad MCP servers with no log entry). All 5 arms of `tests/test-341-release-shrinkwrap-gate.cjs` pass, zero network, zero real npm.
- The **Commit-B untrack block** (`git ls-files --error-unmatch node_modules` / `git rm -r --cached node_modules`) is deleted -- nothing to untrack any more. `MOS_SKIP_VENDOR`, `npm ci --omit=dev`, and the MCP-critical presence loop are gone from `scripts/release.sh` (0 occurrences each).
- **Step 9.5**'s payload gate drops the blanket `node_modules/` ban and the unanchored `release\.sh` + `docs/` blacklist alternatives (341-RESEARCH Blocker 1: under D-02's allowlist `scripts/release.sh` ships wholesale and would trip the old unanchored match), keeps `.planning/`, `mcp-server-brain/`, `tests/` in the blacklist, and delegates the ceiling/shrinkwrap-presence/lifecycle-script assertions to `scripts/check-release-payload-ceiling.cjs --check` (offline, zero added network).
- **`doctor.cjs`**'s `version-of-record-published` leg (b) now reads `source.version` (no `v` prefix) through a new exported pure helper, `evaluateMarketplaceSourcePin(source, ver)` (line ~719, exported at the bottom `module.exports`). It accepts EITHER the npm shape (rejecting a residual `ref`/`url` as a half-migrated state) OR the legacy git shape (`source.ref === 'v'+ver`) during the transition -- see key-decisions for why. Legs (a) and (c), including the sole `npm view` network call ("THIS IS THE ONE NETWORK CALL in this point", preserved verbatim), are unchanged.
- Both Phase 310 scope tripwires are rebaselined from the POST-edit `scripts/release.sh`, using the fixture's own documented generating command verbatim, in the same execution as the release.sh edit (Tasks 1 and 2 landed as adjacent commits). Measured counts: `^# --- Step` header count **28** (unchanged from research's 28 -- Step 6.7 was REPLACED, not deleted), non-comment `exit 1` count **49** (unchanged from research's pre-341 measurement of 50 minus 1: Step 6.7's 3 removed `exit 1`s were offset by new ones added across the rewritten Step 4/6.7/9.5 bodies -- net -1, landing exactly on the existing floor of 49 with zero headroom lost or gained).
- Minted `tests/fixtures/341-release-step-block-hashes.txt` with a `STEP_BLOCK_COUNT` data line (28) that `tests/run-all-341.sh`'s own step-block leg (written in Plan 01) reads instead of a hard-coded literal; that leg now runs as a real PASS instead of the SKIP it reported before this fixture existed.
- `bash tests/run-all-341.sh`: **PASS=22 FAIL=0 SKIP=6 EXPECTED-RED=0**.
- `bash tests/run-all-310.sh`: **PASS=10 FAIL=0 SKIP=1** (leg 9 SKIPs once the tree is committed, as designed).
- `node scripts/doctor.cjs --acceptance --pre-tag`: **17/17 points passed**.
- `node scripts/check-release-payload-ceiling.cjs --check`: OK, 0 findings (entryCount=1833, unpackedSize=29,126,083 bytes).
- `bash scripts/release.sh --dry-run --prerelease`: prints every expected step name (no Step 6.7 vendoring text; Step 4's preview shows the new npm-source shape; Step 6.7's preview shows shrinkwrap generation), makes zero commits/tags/pushes/publishes (`git status --porcelain` and `git tag --list | tail -3` unchanged before/after).
- `cd ~/mindrian-marketplace && git status --porcelain` prints nothing: no test in this plan touched the live catalog. Confirmed explicitly after every new test suite ran (`tests/test-341-marketplace-npm-source.cjs` Arm 3 asserts this programmatically).

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite release.sh Steps 4, 6.7 and 9.5, and extract the shrinkwrap gate into release-lib** - `4cfbe3f8` (feat)
2. **Task 2: Rebaseline the Phase 310 tripwires and mint the Phase 341 fixture, in the same commit** - `1110c9e7` (test)
3. **Task 3: Move doctor's version-of-record to source.version and extend the sandboxed release-gate suite** - `b7fd5dc3` (feat)

## Files Created/Modified

- `scripts/release.sh` - Step 4 rewritten (npm source, exact pin, ref/url deletion, no registry key); Step 6.7 replaced (shrinkwrap generation via the new library, MOS_SKIP_VENDOR removed); Commit-B untrack block deleted; Step 9.5 blacklist trimmed + delegates to the ceiling runner; Step 1 dry-run preview text and several header/RCA comments updated to match. `bash -n` exits 0.
- `scripts/release-lib/shrinkwrap-gate.sh` - new. `mos_generate_shrinkwrap <plugin_dir>`, return codes 0/1, hooks `MOS_SHRINKWRAP_HOOK`/`MOS_PACK_PROBE_HOOK`. `bash -n` exits 0.
- `scripts/doctor.cjs` - `version-of-record-published` leg (b) rewritten via new exported `evaluateMarketplaceSourcePin(source, ver)` (defined immediately above `buildAcceptanceChecklist`, ~line 719; called at ~line 937; exported in the bottom `module.exports` line ~4325). Label updated to name `source.version`. Legs (a)/(c) untouched.
- `tests/run-all-310.sh` - leg 3 simplified to a uniform per-block hash comparison against the freshly regenerated fixture; the old Step 5.5/Step 1 special-casing removed with an explanatory comment naming the Phase 341 authorized regions.
- `tests/fixtures/310-release-step-block-hashes.txt` - regenerated wholesale from the post-Task-1 `release.sh` using its own documented command; `PREAMBLE(1-79)` and `EXIT1_NONCOMMENT_COUNT` re-measured (49, unchanged); re-verified by an independent re-run of the generating command with an empty diff against the data lines.
- `tests/fixtures/341-release-step-block-hashes.txt` - new. Same generating command, `STEP_BLOCK_COUNT: 28` data line, comment-only mentions of `PREAMBLE(1-79)`/`EXIT1_NONCOMMENT_COUNT` (deliberately NOT bare data lines here -- `tests/run-all-341.sh`'s parser only special-cases the step-count label, so a second unlabeled pinned line would be misread as a phantom `# --- Step` header).
- `tests/test-341-release-shrinkwrap-gate.cjs` - new. 5 arms against `mos_generate_shrinkwrap` via fake bash hooks, zero network.
- `tests/test-341-marketplace-npm-source.cjs` - new. Extracts Step 4's real `node -e` body from `release.sh` and drives it against a sandboxed marketplace repo (2 arms) plus a live-marketplace-untouched assertion (1 arm).
- `tests/test-341-version-of-record-source-version.cjs` - new. 8 arms against the exported `evaluateMarketplaceSourcePin` helper plus a `doctor --acceptance --pre-tag` regression check.
- `tests/test-release-bump-tag-and-publish-gates.cjs` - cases 10/11 fixed (retired `@mindrian_os/install` regex -> `@mindrian_os/cli`; the `\Z`-is-not-end-of-string regex bug fixed in both extraction sites); added cases 14 (Step 6.7 delegation, behavioral round-trip under fake hooks) and 15 (Step 9.5 blacklist + real ceiling-runner pass). All 15 cases pass.
- `.claude/includes/release-process.md` - record 5 of the 5-way version consistency rule updated to name `source.version` (npm source) instead of `source.ref`.

## Decisions Made

See `key-decisions` in the frontmatter above:
1. Dual-shape acceptance in `doctor.cjs`'s version-of-record leg (npm shape or legacy git shape during the transition), per an explicit orchestrator project-rules directive that supplements (and in one literal grep-count criterion, supersedes) the plan's own Task 3 acceptance text.
2. Retiring rather than extending `run-all-310.sh` leg 3's Step 5.5/Step 1 special-casing, since a wholesale fixture regeneration makes it both redundant and actively incorrect.
3. The extract-and-execute test idiom for `test-341-marketplace-npm-source.cjs` (proving Step 4's real code, not a hand-duplicated copy) instead of driving the full `release.sh`.
4. Fixing the latent `\Z` regex bug in `test-release-bump-tag-and-publish-gates.cjs` in the same commit as the package-name fix, since both live in the same two lines.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a latent `\Z`-is-not-end-of-string regex bug in tests/test-release-bump-tag-and-publish-gates.cjs (cases 10/11)**
- **Found during:** Task 3, while fixing the retired `@mindrian_os/install` package name in cases 10/11.
- **Issue:** `/# --- Step 9\.7[\s\S]*?(?=# --- Step|\Z)/` -- in JavaScript regex (unlike Perl/PCRE), `\Z` is not a recognized end-of-string anchor; it is treated as the literal character `Z`. The lookahead therefore stopped at the FIRST literal `Z` inside the Step 9.7 block's own body (inside a date-format string, `+%FT%TZ`), truncating the extracted block to 2,624 of its real 6,609 characters and hiding Step 9.7's actual `exit 1` statements from Test 11's assertion. This is a DIFFERENT root cause from the documented package-name-drift issue `deferred-items.md` and `run-all-310.sh` leg 8a attributed to both Test 10 and Test 11 -- Test 10 genuinely was package-name-drift; Test 11 was this regex bug, which happened to co-occur and produce an identical-looking failure message shape.
- **Fix:** Replaced `\Z` with `$` (the correct JS end-of-string anchor in a non-multiline regex) in both occurrences (Test 11 and Test 12 share the same extraction regex).
- **Files modified:** `tests/test-release-bump-tag-and-publish-gates.cjs`
- **Verification:** All 15 cases in the file now pass (previously 11/13 with two attributed-but-partially-misdiagnosed failures); `run-all-310.sh` leg 8a's "known pre-existing Test 10/11" branch no longer fires because the suite now exits 0 cleanly.
- **Committed in:** `b7fd5dc3` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1, a genuine bug found and fixed while doing the assigned Task 3 edit to the exact same lines) plus 1 instructed adjustment (the dual-shape doctor logic, an explicit orchestrator directive documented under key-decisions rather than as a Rule 1-4 deviation, since it was not discovered mid-execution but specified up front in this session's project rules).
**Impact on plan:** No scope creep. The regex fix lives in the two lines already being edited for the assigned package-name correction. The dual-shape doctor logic satisfies a stricter, more complete correctness requirement (continuity across the git-to-npm transition) than the plan's own narrower acceptance text asked for.

## Issues Encountered

- **`grep -c "source.ref" scripts/doctor.cjs` does not return 0** (plan Task 3's literal acceptance criterion). It returns 7: all seven are either (a) inside the new `evaluateMarketplaceSourcePin` helper's legacy-git-shape branch (required by the dual-shape continuity directive above), (b) comments describing that branch, or (c) one untouched historical RCA comment at line ~880 describing a 2026-04-13-era bug unrelated to this plan's scope. None are the OLD, now-removed `mp.plugins[0].source.ref` direct-property-access code path that the plan's criterion was written to detect the absence of. Documented here per the plan's own instruction ("record the line numbers... in the SUMMARY").
- `.claude/worktrees/agent-*/scripts/release.sh` (multiple sibling parallel-agent worktree checkouts) still contain `MOS_SKIP_VENDOR` references. These are gitignored (`.claude/worktrees/` per `.gitignore:100`), untracked, and belong to OTHER concurrent agents' checkouts -- not part of this repo's tracked tree and out of this task's scope per the destructive-git-prohibition and incident-context rules governing this session. Left untouched, noted here only as an observation.
- `.planning/*.md` files (`341-CONTEXT.md`, `341-RESEARCH.md`, historical `341-01-PLAN.md` through `341-10-PLAN.md`, `341-VALIDATION.md`) still mention `MOS_SKIP_VENDOR` and `release.sh Step 6.7` in a forward-looking or historical-record sense (planning docs, not live code). The acceptance criterion's grep scope was explicitly `scripts/ tests/ docs/ .claude/`, which does not include `.planning/`; left untouched.
- `tests/test-release-bump-algebra.cjs` (Phase 123-01, unrelated to this plan) has 3 pre-existing failing tests (F, H, I) confirmed failing BEFORE any edit in this plan touched anything (measured on the pre-Task-1 tree): F references the retired `@mindrian_os/install` package name, H asserts a marketplace-version-bump behavior that Commit B never performed even before this plan (a stale test, not a regression), and I references a legacy install path. This file is not referenced by `tests/run-all-341.sh`, `tests/run-all-310.sh`, or `scripts/doctor.cjs`'s harness-policies point, so it is genuinely out of this plan's scope per the scope-boundary rule; left untouched and unfixed.
- Mid-plan, a concurrent planner agent was actively editing `.planning/phases/341-.../341-08-PLAN.md` and (observed once) `341-VALIDATION.md`. Per the sequential-execution instructions governing this session, both files were left untouched throughout (never staged, never committed) and are noted here only as an observation.

## User Setup Required

None - no external service configuration required. Zero real `git push`, `npm publish`, `npm view`, or registry call anywhere in this plan's own tests or verification; every new test drives either a pure function, an injected-hook bash library, or `check-release-payload-ceiling.cjs --check` (offline by construction). `bash scripts/release.sh --dry-run` was run for verification only, with no mutation.

## Next Phase Readiness

- **OPERATOR HANDOFF for the first post-341 release:** the marketplace `source` flip from git-shape to npm-shape is a DATA migration that happens ONLY when `release.sh` (Step 4) actually runs against `~/mindrian-marketplace`. Nothing in this repo change touches the live catalog -- confirmed unmodified (`git -C ~/mindrian-marketplace status --short` empty) throughout and after this plan. Before that first real run: re-verify Claude Code's loader constants (the 60,000 ms dependency-install timeout, the lockfile table order, the entry/byte ceiling constants) against whatever binary version is installed at that time if it has moved past 2.1.266, per 341-RESEARCH's "Valid until" note.
- The tree is ready for the first post-341 beta cut: `doctor --acceptance --pre-tag` is 17/17, `check-release-payload-ceiling.cjs --check` passes against the real tree, `bash scripts/release.sh --dry-run` shows the correct new step sequence with no vendoring text, and both `run-all-341.sh`/`run-all-310.sh` report `FAIL=0`. Per D-13, this closes step 1 of the migration order (per 341-04's summary) at the release-ceremony layer; plan 341-06 (the cold-install proof) is next.
- Doctor's `version-of-record-published` point (`full`-tier only, so it does not gate `--pre-tag`) is ready to validate either the CURRENT live git-shape marketplace or the FUTURE npm-shape marketplace without a doctor.cjs edit in between -- the dual-shape helper absorbs the transition. A future plan (post-first-npm-release) may choose to drop the legacy-shape branch once the live catalog has genuinely flipped; that is a deliberate follow-up, not a gap.
- No blockers.

## Self-Check: PASSED

- `scripts/release-lib/shrinkwrap-gate.sh` exists, `bash -n` exits 0 - FOUND
- `tests/test-341-release-shrinkwrap-gate.cjs` exists, `node --check` exits 0, 5/5 arms pass - CONFIRMED
- `tests/test-341-marketplace-npm-source.cjs` exists, `node --check` exits 0, 3/3 arms pass - CONFIRMED
- `tests/test-341-version-of-record-source-version.cjs` exists, `node --check` exits 0, 8/8 arms pass - CONFIRMED
- `tests/fixtures/341-release-step-block-hashes.txt` exists, carries all 5 required header elements - CONFIRMED
- Commit `4cfbe3f8` (feat, Task 1) - FOUND in `git log --oneline`
- Commit `1110c9e7` (test, Task 2) - FOUND in `git log --oneline`
- Commit `b7fd5dc3` (feat, Task 3) - FOUND in `git log --oneline`
- `bash tests/run-all-341.sh`: PASS=22 FAIL=0 SKIP=6 EXPECTED-RED=0 - CONFIRMED
- `bash tests/run-all-310.sh`: PASS=10 FAIL=0 SKIP=1 - CONFIRMED
- `node scripts/doctor.cjs --acceptance --pre-tag`: 17/17 points passed - CONFIRMED
- `node scripts/check-release-payload-ceiling.cjs --check`: OK, 0 findings - CONFIRMED
- `bash scripts/release.sh --dry-run --prerelease`: correct step sequence, zero mutation - CONFIRMED
- `cd ~/mindrian-marketplace && git status --porcelain` empty - CONFIRMED
- `git status --short` clean except the concurrent planner's own `341-08-PLAN.md`/`341-VALIDATION.md` (untouched by this plan) - CONFIRMED

---
*Phase: 341-install-and-update-overhaul-npm-source-plugin-artifact-heavy*
*Completed: 2026-09-10*
