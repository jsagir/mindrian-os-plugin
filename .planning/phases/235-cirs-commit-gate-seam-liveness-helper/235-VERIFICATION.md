---
phase: 235-cirs-commit-gate-seam-liveness-helper
verified: 2026-07-28T08:38:35Z
status: passed
score: 8/8 must-haves verified
overrides_applied: 0
---

# Phase 235: CIRS Commit Gate + Seam-Liveness Helper Verification Report

**Phase Goal:** The Part-11 invocation constitution enforces for real: the commit-time
born-wired gate fires on every commit in every worktree on this machine, and the repo owns
ONE reusable seam-liveness assertion helper that proves a mechanism is alive at both ends --
the primitive the whole milestone's recurring failure shape was missing.

**Verified:** 2026-07-28T08:38:35Z
**Status:** passed
**Re-verification:** No -- initial verification

All commands below were re-run independently in this session, in this working tree
(`/home/jsagi/dev/MindrianOS-Plugin`, confirmed via `pwd`/CLAUDE.md workspace guard), not
copied from any executor's or orchestrator's self-report.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria, all 4 restated as the roadmap contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A scratch commit introducing a born-unwired surface is rejected in the primary checkout AND a second worktree; after the C-1 rival-installer overwrite is reproduced, the same mutation is still rejected after self-heal -- proven by real git commits. | VERIFIED | `node tests/test-235-cirs-commit-gate-worktree.cjs` -> exit 0, all 6 legs pass: primary rejection, worktree rejection, rival-overwrite negative control (commit SUCCEEDS, proving the bypass is real), post-self-heal rejection restored. Re-run independently, fresh output confirmed identical to SUMMARY's claimed shape. |
| 2 | A reusable seam-liveness helper turns red on 3 seeded dead-seam fixtures (hook-matcher, enqueue-consumer, mint-ratifier) and green on live controls; ships repo-wide, not CIRS-only. | VERIFIED | `node lib/core/seam-liveness.test.cjs` -> exit 0, 10/10. `lib/core/seam-liveness.cjs` lives at `lib/core/` (not `scripts/build-connector-registry.cjs` or any CIRS-specific path), is a pure CJS module with zero CIRS imports, exports exactly `assertSeamLive`, `checkHookMatcherLiveness`, `checkEnqueueConsumerLiveness`, `checkMintRatifierLiveness`, `checkClaimedModuleLiveness`. Read the file: none of the five functions accept an options object that can force `ok:true`. |
| 3 | CIRS's own `--check` consumes the helper for CIRS's surfaces, and disabling the helper call turns `--check` red -- load-bearing, not decorative. | VERIFIED | `grep -n "checkClaimedModuleLiveness\|seam-liveness" scripts/build-connector-registry.cjs` shows the require at line 75 and the call at line 828 inside `coverageReport()`. `node tests/test-235-seam-liveness-mcp-coverage.cjs` group (2) is a self-updating census (`mcp_tool` surface count === `listMcpToolClaimedSources().length`, currently 10===10) that goes to 0 if the wiring is removed (SUMMARY documents a live mutate-and-revert that reproduced this red state; the automated census assertion is the permanent regression guard for the same claim and is green today). Group (3) is a textual wiring proof (`checkClaimedModuleLiveness` substring present in the source). Both re-run green independently. |
| 4 | With a seeded shape-declaration violation, `check-shape-declaration.cjs --strict` exits non-zero through `release.sh`'s actual invocation path; non-strict still warns-and-passes. | VERIFIED | `node tests/test-235-release-shape-gate.cjs` -> exit 0, 5/5, extracting the LIVE `SHAPE-GATE-BEGIN`/`SHAPE-GATE-END` block out of `scripts/release.sh` at run time (verified: `grep -n 'SHAPE-GATE-BEGIN\|SHAPE-GATE-END' scripts/release.sh` each return exactly 1 line) and executing it, proving strict+violation=abort, advisory+violation=warn-continue, strict+clean=pass. |

**Score:** 4/4 roadmap success criteria verified.

### PLAN Frontmatter Must-Haves (235-01 + 235-02, merged, superset of roadmap SCs)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 5 | 235-01: `scripts/release.sh --strict-shape` genuinely changes `check-shape-declaration.cjs`'s exit behavior (on = abort, off = warn). | VERIFIED | Same as roadmap truth 4 above. |
| 6 | 235-02: CIRS's `--check` fails when a `lib/mcp/tools/*.cjs` file exists but produces zero live connectors (require throws or `exports.connectors` missing/empty). | VERIFIED | `node tests/test-235-seam-liveness-mcp-coverage.cjs` group (1): synthetic `healthy.cjs`/`dead.cjs`/`throws.cjs` fixtures classify correctly via `listMcpToolFileHealth()` -- `dead.cjs` (no `connectors` export) -> `live:false`; `throws.cjs` (require() failure) -> `live:false` with the real load error, not swallowed. |
| 7 | 235-02: Disabling the seam-liveness call inside `coverageReport()` is proven load-bearing via a regression test on the MCP-tool-file surface count. | VERIFIED | Group (2)'s self-updating census assertion (see truth 3 above); SUMMARY documents the manual mutate-and-revert that reproduced the red state, no mutation left in the final diff (`git diff --stat scripts/build-connector-registry.cjs` verified clean at time of this verification -- see Anti-Patterns section). |

**Score:** 8/8 total must-haves verified (4 roadmap SCs + 4 plan-declared truths, deduplicated for overlap on the shape-gate claim).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/hooks/pre-commit` | Single canonical hook body, all 11 guard blocks | VERIFIED | 216 non-comment lines; `grep -v '^#'` confirms >=1 hit each for `check-shape-declaration.cjs" --check`, `build-connector-registry.cjs" --check`, `check-substrate.cjs" --diff`, `command-registration-check.cjs` (2 hits). |
| `scripts/hooks/pre-commit-room-minto-guard.sh` | Byte-identical to `scripts/hooks/pre-commit` | VERIFIED | `cmp scripts/hooks/pre-commit scripts/hooks/pre-commit-room-minto-guard.sh` -> no output, exit 0 (identical). |
| `scripts/install-pre-commit.sh` | Simplified cmp-then-copy installer, no hand-authored content | VERIFIED | `grep -n 'cmp -s.*pre-commit-room-minto-guard\.sh'` matches at line 99; `bash -n` syntax-valid. |
| `scripts/release.sh` | `--strict-shape` flag, sentinel-wrapped Step 2.4 | VERIFIED | Flag parsed at line 103, `STRICT_SHAPE` default 0 at line 88, sentinels at lines 324/336, `USAGE_BLOCK` documents the flag. |
| `tests/test-235-release-shape-gate.cjs` | Extraction-based test, never hand-copied | VERIFIED | Reads live `scripts/release.sh` text at run time; re-run: 5/5 pass. |
| `tests/test-235-cirs-commit-gate-worktree.cjs` | Mutation-proof isolated-repo test | VERIFIED | Re-run: 6/6 pass, real `fs.mkdtempSync` fixture, real second `git worktree`, real `git commit` calls. |
| `tests/run-all-235.sh` | Phase aggregator, glob-discovers `tests/test-235-*` | VERIFIED | Re-run: `Phase 235: PASS=6 FAIL=0 SKIP=0`, exit 0. |
| `lib/core/seam-liveness.cjs` | Generic 5-export helper module | VERIFIED | 5 exports confirmed by test 1-10; zero-dependency CJS, no options-object override path (read source). |
| `lib/core/seam-liveness.test.cjs` | 10 behavior cases | VERIFIED | Re-run: 10/10 pass. |
| `scripts/build-connector-registry.cjs` | `listMcpToolClaimedSources()`/`listMcpToolFileHealth()`, `coverageReport()` walks MCP tools via the helper | VERIFIED | Functions present; `--check` exits 0 on the real tree; `coverageReport().surfaces` includes 10 `mcp_tool` surfaces. |
| `data/connector-coverage-ledger.json` | Regenerated with `mcp_tool` surfaces | VERIFIED | `test-cirs-four-class-floor.cjs` confirms every ledger surface class is a SURFACE_CLASS_ENUM member (23/23 assertions); coverage counts match. |
| `tests/test-235-seam-liveness-mcp-coverage.cjs` | Mutation-proof integration test, 14 assertions | VERIFIED | Re-run: 14/14 pass across 3 groups (fixtures, census, wiring). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `scripts/setup-hooks.sh` | `scripts/hooks/pre-commit-room-minto-guard.sh` | `GUARD_SRC=...` cmp+cp | WIRED | Line 75, pattern matches. |
| `scripts/install-pre-commit.sh` | `scripts/hooks/pre-commit-room-minto-guard.sh` | `cmp -s...` | WIRED | Line 99, pattern matches. |
| `scripts/release.sh` Step 2.4 | `scripts/check-shape-declaration.cjs --check --strict` | `STRICT_SHAPE` branch | WIRED | Line 326, pattern matches. |
| `scripts/build-connector-registry.cjs coverageReport()` | `lib/core/seam-liveness.cjs checkClaimedModuleLiveness()` | require + direct call | WIRED | require at line 75, call at line 828, inside `coverageReport()`. Also confirmed behaviorally (self-updating census) and textually (grep-based wiring test), both green. |
| `scripts/build-connector-registry.cjs listMcpToolFileHealth()` | `lib/mcp/tools/*.cjs` (+ router/contract-version) | require + export check | WIRED | Function present, exercised by real `--check` run against the live tree (0 gaps) and synthetic fixtures (dead/throws correctly flagged). |
| Commit-time gate | `.git/hooks/pre-commit` -> `build-connector-registry.cjs --check` | shell invocation | WIRED | `scripts/hooks/pre-commit:190` invokes it unconditionally; proven live by the worktree test's real `git commit` legs. |
| Release-time gate | `scripts/release.sh` Step 2.4 -> `build-connector-registry.cjs --check` | direct invocation, HARD ABORT | WIRED | `scripts/release.sh:282` (`if ! node ... --check; then ... exit 1; fi`), confirmed by direct read, not test-only inference. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CIRS-01 | 235-01 | Commit-time born-wired gate runs on every commit, every worktree, survives rival-installer overwrite (C-1). | SATISFIED | Truth 1 above; `test-235-cirs-commit-gate-worktree.cjs` 6/6, including the negative control leg proving the pre-fix bypass was real. |
| CIRS-02 | 235-02 | Reusable seam-liveness helper exists, repo-wide (not CIRS-only), and CIRS's own `--check` uses it. | SATISFIED | Truths 2-3, 6-7 above; `lib/core/seam-liveness.cjs` + `test-235-seam-liveness-mcp-coverage.cjs`. |
| CIRS-03 | 235-01 | `release.sh --strict` actually changes `check-shape-declaration.cjs`'s exit behavior instead of `|| true` swallow. | SATISFIED | Truth 4/5 above; `test-235-release-shape-gate.cjs` 5/5. |

No orphaned requirements: REQUIREMENTS.md maps exactly CIRS-01/02/03 to Phase 235 and all three appear in plan frontmatter `requirements:` fields (235-01: `[CIRS-01, CIRS-03]`; 235-02: `[CIRS-02]`).

### Anti-Patterns Found

None blocking. Scanned every file in both plans' `files_modified` lists for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/stub patterns: zero hits in any phase-235-authored or phase-235-modified content. One pre-existing `TODO(future): de-dup verify-release calls` at `scripts/release.sh:59` predates this phase (introduced in commit `c54c6af8`, Phase 123-04) and is unrelated to the CIRS-03 edit region (lines 88-336); not a phase-235 debt marker.

`git status` confirms no uncommitted changes remain in any of the two plans' `files_modified` paths (the repo's current uncommitted changes are unrelated Phase 236 work-in-progress).

### Unplanned Deviation Check: `tests/test-connector-coverage-ledger.cjs`

Confirmed as a **legitimate strengthening**, independently verified:

- **Before:** Test 1 asserted a single identity, `report.surfaces.length === listSourceFiles().length` (command+skill+agent files only).
- **After (commit `a6d89c8c`):** split into two assertions -- (a) the command+skill+agent SLICE must still cover every such file exactly (`fileSourced.length === total`, verified `246 === 246`), AND (b) the FULL census must equal that total plus the newly-added claimed MCP tool sources (`report.surfaces.length === total + mcpClaimed`, verified `256 === 246 + 10`).
- Nothing can now fall outside either slice -- the invariant is strictly a superset of the old one, not a relaxation. Re-run independently: `node tests/test-connector-coverage-ledger.cjs` -> exit 0, all assertions pass including the split Test 1.
- **Wiring into the release chain -- precise finding, not taken at face value:** `tests/test-connector-coverage-ledger.cjs` is wired into `tests/run-all-172.sh` (`grep -n "test-connector-coverage-ledger" tests/run-all-172.sh` -> line 31), and `bash tests/run-all-172.sh` re-run independently: 20/20 passed. However, `tests/run-all-172.sh` itself is **not** directly invoked by `scripts/release.sh`, `scripts/verify-release`, or `scripts/doctor.cjs` (`grep -rln "run-all-172" scripts/ .github/` returns nothing outside `tests/`; `tests/run-all-146.sh`, the closest thing to a top-level aggregator, only composes `run-all-144/1441/145`, not 172). The SUMMARY's phrase "wired into the release-verification chain" is imprecise on this specific point -- `run-all-172.sh` is a developer-run verification suite, not an automated CI/release gate.
- **This does not weaken the phase's actual delivery**, because the production code the widened test exercises (`coverageReport()` inside `scripts/build-connector-registry.cjs`) is independently, directly wired into both the commit-time gate (`scripts/hooks/pre-commit:190`) and the release-time gate (`scripts/release.sh:282`, HARD ABORT). Those are the enforcement mechanisms Part 11/CIRS-01 requires, and both are confirmed live by direct read and by the worktree test's real git commits. `run-all-172.sh`'s gate status (wired or not into an automated pipeline) is pre-existing infrastructure this phase did not create or change, and is not itself a phase-235 must-have.
- **Verdict:** the deviation is sound engineering (invariant strictly strengthened, not weakened) and correctly scoped (only the one test file the plan's `files_modified` did not anticipate, per Rule 3 of the execution methodology). The one imprecise sentence in the SUMMARY narrative does not affect goal achievement and is noted here for the record, not as a gap.

### Human Verification Required

None. This phase is entirely infra/tooling (git hooks, a release script flag, a library module) with no UI, no visual surface, no external service dependency, and every claimed behavior is provable by direct command execution -- which was done.

### Independent Re-Run Summary (this session, not copied from any prior report)

| Command | Result |
|---------|--------|
| `node lib/core/seam-liveness.test.cjs` | 10/10 PASS |
| `node scripts/build-connector-registry.cjs --check` | exit 0 |
| `node tests/test-cirs-four-class-floor.cjs` | 23/23 PASS |
| `node tests/test-235-seam-liveness-mcp-coverage.cjs` | 14/14 PASS |
| `node tests/test-235-release-shape-gate.cjs` | 5/5 PASS |
| `node tests/test-235-cirs-commit-gate-worktree.cjs` | 6/6 PASS |
| `node lib/memory/room-minto-hook.test.cjs` | 7/7 PASS |
| `bash tests/run-all-235.sh` | PASS=6 FAIL=0 SKIP=0 |
| `bash tests/run-all-172.sh` | 20/20 PASS |
| `node tests/test-connector-coverage-ledger.cjs` | PASS (split Test 1 verified) |
| `cmp scripts/hooks/pre-commit scripts/hooks/pre-commit-room-minto-guard.sh` | byte-identical |

No flakes observed in this session's runs.

### Gaps Summary

None. All 4 ROADMAP success criteria and all 4 plan-declared must-have truths are independently verified against live command output, not SUMMARY narrative. All artifacts exist, are substantive, and are wired both textually and behaviorally. The one unplanned deviation (splitting the coverage-ledger parity test) is a genuine strengthening, correctly scoped, and its one imprecise SUMMARY claim ("wired into the release-verification chain" for `run-all-172.sh` specifically) does not affect the phase's actual delivery since the underlying production gate is independently and directly wired into both the commit-time and release-time enforcement paths.

---

*Verified: 2026-07-28T08:38:35Z*
*Verifier: Claude (gsd-verifier)*
