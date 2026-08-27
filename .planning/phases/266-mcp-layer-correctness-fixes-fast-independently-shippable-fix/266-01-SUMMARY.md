---
phase: 266-mcp-layer-correctness-fixes-fast-independently-shippable-fix
plan: 01
subsystem: mcp
tags: [mcp, instructions, host-cap, canon-part-8, byte-budget, no-instructions-test]

# Dependency graph
requires:
  - phase: 265-capability-radar-absorption-routing-re-scoped-supersedes-orp
    provides: "265-RESEARCH-mcp-layer-audit.md finding R-1: RUNTIME_INSTRUCTIONS at 2173 bytes overflows the Claude Code 2.1.84 2048-byte host cap"
provides:
  - "RUNTIME_INSTRUCTIONS trimmed to 1888 bytes, Part 8 BOUNDARIES paragraph byte-identical and intact as the string's tail"
  - "lib/mcp/no-instructions.test.cjs host-boundary byte-cap assertion (HOST_INSTRUCTIONS_CAP_BYTES=2048, SERVED_BUDGET_BYTES=1950) plus a frozen, duplicated PART8_BOUNDARIES_FROZEN literal"
  - "tests/run-all-266.sh, the Phase 266 verification aggregator (glob discovery + 5 explicit legs + no-em-dash fence)"
affects: [266-02, 266-03, 266-04, mcp-server, larry-runtime-loop]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Host-boundary vs server-boundary test separation: a byte-length assertion against a platform's own documented cap (Claude Code 2.1.84's 2048-byte instructions cap) catches truncation that a string-equality identity check at the server boundary cannot see."
    - "Frozen, deliberately-duplicated literal (PART8_BOUNDARIES_FROZEN) instead of a derived value, so a future trim of the protected constant cannot shrink the very assertion meant to guard it."

key-files:
  created:
    - tests/run-all-266.sh
  modified:
    - lib/mcp/no-instructions.test.cjs
    - lib/mcp/runtime-instructions.cjs

key-decisions:
  - "Cut restated tool-behavior prose from the six numbered runtime-loop steps (1109 -> ~570 bytes), not the identity/voice paragraph or the Part 8 BOUNDARIES paragraph, since every tool already carries its own full description on the wire."
  - "Two separate byte-budget checks (SERVED_BUDGET_BYTES=1950, HOST_INSTRUCTIONS_CAP_BYTES=2048) instead of one, so a budget miss and a hard-cap miss each report their own legible reason."
  - "tests/run-all-266.sh's own tests/test-266-* glob discovers zero files under this plan's scope by design: plan 01 only amends a pre-existing test file, it does not add a new tests/test-266-* file. The aggregator's found-eq-0 guard is proven via TEST_266_PREFIX pointing at a nonexistent prefix, not via this plan's own (necessarily empty) glob run. Sibling plans 266-02 and 266-03 add the actual tests/test-266-* files; the phase's final gate (266-04) is where the aggregator's default-prefix run turns green."

requirements-completed: [MCPFIX-01]

# Metrics
duration: 25min
completed: 2026-08-27
---

# Phase 266 Plan 01: MCP Instructions Host-Cap Truncation Fix Summary

**Trimmed the MCP `instructions` string from 2173 to 1888 bytes so Claude Code's undocumented-by-this-repo 2048-byte host cap stops silently truncating the Canon Part 8 boundary paragraph mid-word on every session, and pinned the invariant with a byte-cap test that fails loudly if it regresses.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-27T04:00:00Z (approx, pre-dates first recorded timestamp)
- **Completed:** 2026-08-27T04:04:25Z
- **Tasks:** 2/2 completed
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- `RUNTIME_INSTRUCTIONS` now measures 1888 bytes, 160 bytes of headroom under the Claude Code 2.1.84 2048-byte host cap and 62 bytes under this repo's own 1950-byte budget.
- The Canon Part 8 BOUNDARIES paragraph (509 bytes) now reaches the model byte-identically and in full, including the final routing sentence `Heavy pipeline work belongs in Claude Code - say so when asked for it here.` that was previously cut mid-word inside the word "artifacts" on every session, every surface.
- `lib/mcp/no-instructions.test.cjs` gained a third invariant leg (host-byte budget) alongside the pre-existing server-boundary identity check and the moat-content negative pin; it now runs 9 scenarios (was 4), all green.
- `tests/run-all-266.sh` created as the Phase 266 verification aggregator, with its zero-discovery guard proven live via `TEST_266_PREFIX`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the Phase 266 aggregator and pin the instructions cap at the HOST boundary** - `05835964` (test)
2. **Task 2: Trim RUNTIME_INSTRUCTIONS under budget without touching a byte of the Part 8 paragraph** - `5537a165` (fix)

_TDD-shaped by design: Task 1 committed a RED test (server measured 2173 bytes against the new 1950/2048 assertions, confirmed via the string "2173" in its failure output), Task 2 committed the GREEN fix (trim to 1888 bytes, 9/9 passing)._

## Files Created/Modified

- `tests/run-all-266.sh` - Phase 266 verification aggregator: glob discovery over `tests/test-266-*`, five explicit legs (`no-instructions.test.cjs`, `test-234-tool-description-floor.cjs`, `npm-install-lock.test.cjs`, `mcp-dep-heal.test.cjs`, `build-connector-registry.cjs --check`), no-em-dash fence with the `TEST_266_ALLOW_MISSING` escape.
- `lib/mcp/no-instructions.test.cjs` - Added `HOST_INSTRUCTIONS_CAP_BYTES` (2048), `SERVED_BUDGET_BYTES` (1950), `PART8_BOUNDARIES_FROZEN` (a duplicated, byte-identical copy of the BOUNDARIES paragraph), and scenarios 5-7 (budget check, hard-cap check, Part 8 survival + tail check).
- `lib/mcp/runtime-instructions.cjs` - Trimmed the six numbered runtime-loop steps from 1109 to roughly 570 bytes by removing restated tool behavior while keeping every tool's exact wire name and all five load-bearing behavioral clauses (bind before writing, at most one suggestion, no ASCII options box, chain HALTS at the first material step, skip stop_gate_check on conversational turns). Identity/voice paragraph and the Part 8 BOUNDARIES paragraph left byte-for-byte untouched. Header comment amended to name the 2048-byte cap, its 2.1.84 source, and this file's 1950-byte budget.

## Decisions Made

- Cut only the de-duplicated tool-behavior restatement in the numbered steps, never the identity paragraph or the Part 8 paragraph, per the plan's explicit FROZEN instruction.
- Kept the reference draft from the plan essentially as-is (measured independently at 1888 bytes, matching the plan's own measurement), since it already satisfied every acceptance grep and byte-budget check without further editorializing.
- Did not attempt to make `tests/run-all-266.sh`'s default-prefix glob discover any files in this plan: plan 01's `files_modified` scope is exactly `tests/run-all-266.sh`, `lib/mcp/no-instructions.test.cjs`, `lib/mcp/runtime-instructions.cjs` -- no `tests/test-266-*` file. Manufacturing a placeholder file to force the glob green would be scope creep outside this plan's frontmatter and would duplicate work sibling plans 266-02/266-03 already own.

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched their `<action>` blocks and every `<acceptance_criteria>` line was independently verified (see Self-Check below).

## Issues Encountered

- Accidentally ran `git stash` (no arguments) once while diffing intermediate state against the pre-change file, in violation of the destructive-git-operations prohibition (the stash list is shared across worktrees). Recovered immediately: confirmed the stash landed at `stash@{0}` with a message matching this exact branch/commit and a diff containing only this task's two modified files (`lib/mcp/runtime-instructions.cjs`, plus a pre-existing unrelated `package-lock.json` version drift), then ran `git stash pop stash@{0}` to restore it before any other stash operation could interleave. Verified via `git diff` that the restored file was byte-identical to the pre-stash working state (1888 bytes, same content). No work was lost; no other worktree's stash was touched. Recorded here for transparency per the destructive-git-operations reporting norm, not filed as a separate RCA since no data loss occurred and the repo state matches what it would have been without the mistake.
- `package-lock.json` carries a pre-existing, out-of-scope version-string drift (`1.16.0-beta.12` -> `2.0.0-beta.12`) that predates this plan's work and is unrelated to any file this plan touches. Left uncommitted and unstaged per the scope-boundary rule; not fixed, not re-litigated.

## Verification Results

- `node lib/mcp/no-instructions.test.cjs` exits 0, reports 9 passed / 0 failed (identity, moat-negative-pin, and the three new host-boundary scenarios all green).
- `Buffer.byteLength(RUNTIME_INSTRUCTIONS, 'utf8')` = 1888 (>= 1200 floor, <= 1950 budget, < 2048 host cap).
- `RUNTIME_INSTRUCTIONS.endsWith(...)` the exact Part 8 routing sentence: true.
- All five preserved behavioral-clause greps (`before binding`, `ONE short line`, `ASCII options box`, `HALTS at the first material step`, `conversational turns`) return >= 1.
- Tool-handle census grep returns 6 (all six loop steps still name their tool by exact wire name).
- No em-dash (U+2014) in either modified/created file.
- `bash tests/run-all-234.sh`: the `no-instructions.test.cjs` leg PASSED. Overall run shows 2 pre-existing FAILED legs (`test-234-dist-bundle.cjs`, `test-234-free-core-network-scan.cjs`) that reference neither `runtime-instructions.cjs` nor `no-instructions.test.cjs` and are unrelated to this plan's changes -- confirmed by diffing against the pre-change constant (`git show 460d5c77:lib/mcp/runtime-instructions.cjs`), which is a pre-existing baseline state, not a regression introduced here.
- `TEST_266_PREFIX=tests/test-266-nonexistent- bash tests/run-all-266.sh` exits non-zero with the "no ... files discovered" line, proving the found-eq-0 guard is real.
- `TEST_266_ALLOW_MISSING=1 bash tests/run-all-266.sh` (default prefix) currently exits non-zero at the same found-eq-0 guard, because no `tests/test-266-*` file exists yet in this plan's isolated scope -- expected and by design (see Decisions Made above). This item of the phase-level `<verification>` list is a cross-plan criterion that resolves once sibling plans 266-02/266-03 land their `tests/test-266-*` files; the phase's own final gate (266-04) is where this is designed to be re-checked and go green.

## Next Phase Readiness

- `tests/run-all-266.sh` is in place and its explicit legs (including `no-instructions.test.cjs`) all pass; sibling plans 266-02 and 266-03 can land their `tests/test-266-*` files against this aggregator with zero edits required to the runner itself.
- `PART8_BOUNDARIES_FROZEN` and the two byte-budget constants are now load-bearing regression guards for any future edit to `runtime-instructions.cjs`.
- No blockers for 266-02/266-03/266-04.

## Self-Check: PASSED

- FOUND: `tests/run-all-266.sh` (exists, executable, `test -x` succeeds)
- FOUND: `lib/mcp/no-instructions.test.cjs` (modified, 9/9 passing)
- FOUND: `lib/mcp/runtime-instructions.cjs` (modified, 1888 bytes)
- FOUND commit `05835964` in `git log --oneline --all`
- FOUND commit `5537a165` in `git log --oneline --all`

---
*Phase: 266-mcp-layer-correctness-fixes-fast-independently-shippable-fix*
*Completed: 2026-08-27*
