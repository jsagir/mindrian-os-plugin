---
phase: 339-brain-to-theo-cutover-release-flip-brain-client-default-orig
plan: 06
subsystem: brain-boundary
tags: [refusal-messaging, honesty-rail, update-path, cjs, node]

# Dependency graph
requires:
  - phase: 339-01
    provides: origin single-source pattern (the D-08 sibling for the Brain origin string)
  - phase: 339-02
    provides: "tests/test-339-update-path-single-source.cjs (the RED drift test this plan turns GREEN) and tests/test-250-refusal-shapes.cjs Test 8 (the RED behavioral proof)"
  - phase: 339-03
    provides: refusal-shapes groundwork (test-250-refusal-shapes.cjs structure this plan's Test 8 extends)
provides:
  - "lib/core/update-path.cjs: the single frozen source for the two-command plugin update path (MARKETPLACE_UPDATE_COMMAND, PLUGIN_UPDATE_COMMAND, UPDATE_PATH_SENTENCE)"
  - "unreachable and no_key refusal copy both name the update path (D-08, FLIP-04)"
  - "NEXT_MOVES.unreachable gains an 'update' handle"
  - "scripts/self-update sources its bash-CLI update command from update-path.cjs instead of a third hardcoded copy"
affects: ["339-07 (origin single-source cleanup, same drift-prevention family)", "339-10 (CHANGELOG/tester-note carries this plan's honest-limit sentence and RENDER_COPY wording verbatim)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single frozen-constant CJS module (ralph-loop-gate.cjs shape) as the one home for a string three other surfaces would otherwise retype"
    - "Anti-drift test scans BOTH directions: doc-to-module byte-equality (Arm 2) and module-to-repo uniqueness (Arm 5)"

key-files:
  created:
    - lib/core/update-path.cjs
  modified:
    - lib/core/refusal-messaging.cjs
    - scripts/self-update

key-decisions:
  - "D-08/FLIP-04: both unreachable and no_key refusal copy gain the same UPDATE_PATH_SENTENCE line, because a suspended incumbent origin routes a FRESH stale install into no_key (_tryAutoRegister failure) and an already-registered session into unreachable -- both populations need the identical instruction."
  - "The update path lives in RENDER_COPY (uncapped multi-line array), never in REASONS (which feeds larryRefusalLine's 120-char single-line cap) -- the two commands alone are ~73 characters and cannot fit inside that cap with any framing."
  - "unreachable's second render line was rewritten from a bare retry promise to 'A retry may not help if the origin moved; we can keep going with your room context in the meantime.' -- Key Decision 8 and Canon Part 12 forbid copy that promises what it cannot keep against a suspended origin."
  - "Deviation (Rule 3, blocking): tests/test-339-update-path-single-source.cjs Arm 5's anti-drift scan surfaced a pre-existing third copy of the literal command string in scripts/self-update (predates this plan, shipped in v1.10.19). Fixed by having the deprecated stub fetch PLUGIN_UPDATE_COMMAND from update-path.cjs at runtime via a node subprocess, rather than embedding the literal a third time anywhere in the file (a hardcoded fallback string would itself still trip the same static scan)."

requirements-completed: [FLIP-04]

# Metrics
duration: 8min
completed: 2026-09-04
---

# Phase 339 Plan 06: Update-Path Single Source + Honest Refusal Copy Summary

**One frozen module (`lib/core/update-path.cjs`) now the sole source of the two-command plugin update path; both `unreachable` and `no_key` refusal copy name it, and `unreachable`'s old bare-retry promise is gone.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-09-04T04:44:00Z (approx, per STATE.md `last_updated` at wave start)
- **Completed:** 2026-09-04T04:52:41Z
- **Tasks:** 2 completed
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- `lib/core/update-path.cjs` created: three frozen exports (`MARKETPLACE_UPDATE_COMMAND`, `PLUGIN_UPDATE_COMMAND`, `UPDATE_PATH_SENTENCE`), byte-identical to `.claude/includes/release-process.md:23-26`, zero requires, header comment states both refusals (no runtime doc read, no URL/version baked in).
- `lib/core/refusal-messaging.cjs`'s `RENDER_COPY.unreachable` and `RENDER_COPY.no_key` both append `UPDATE_PATH_SENTENCE` (required, never retyped); `unreachable`'s second line rewritten to drop the broken retry promise; `NEXT_MOVES.unreachable` gains the `update` handle (`['retry', 'update', 'continue_without']`).
- The honest limit (this copy ships in bytes; an unupdated install still prints the old string) is recorded verbatim in a `RENDER_COPY` header comment, ready for plan 339-10's CHANGELOG and tester note.
- `REASONS`, `larryRefusalLine`, and the 120-character single-line cap are byte-identical to before -- verified via `git diff` hunk inspection (no touch to the `:241-300` `REASONS` range) and `tests/test-250-refusal-shapes.cjs` Test 6.
- Deviation fix: `scripts/self-update` (a deprecated no-op stub, unrelated to this plan's declared file list) carried a third hardcoded copy of the update-path literal, predating this plan. It now fetches `PLUGIN_UPDATE_COMMAND` from `update-path.cjs` at runtime via a `node -e` subprocess, closing the anti-drift scan's Arm 5 without ever embedding the literal a third time (including in any fallback string).

## Task Commits

1. **Task 1: Create lib/core/update-path.cjs, the single source for the two-command update path** - `0536d3a8` (feat)
2. **Task 2: Name the update path in the unreachable and no_key refusal copy (D-08)** - `8403d0d6` (feat)

_No RED/GREEN/REFACTOR sub-commits: both tasks are `tdd="true"` in the sense that pre-existing tests (`tests/test-339-update-path-single-source.cjs` from plan 339-02, `tests/test-250-refusal-shapes.cjs` Test 8 from plan 339-03) were already RED before this plan ran; this plan turned them GREEN, it did not author the RED tests itself._

## Files Created/Modified
- `lib/core/update-path.cjs` - new frozen-constant module, the single source of the two-command update path
- `lib/core/refusal-messaging.cjs` - `RENDER_COPY.unreachable`/`no_key` name the update path; `NEXT_MOVES.unreachable` gains `update`
- `scripts/self-update` - sources its bash-CLI update command from `update-path.cjs` at runtime instead of a third hardcoded literal (deviation fix)

## Rendered Copy (verbatim, for plan 339-10's CHANGELOG/tester note)

`renderRefusal('unreachable', { tool: 'brain_query' })`:
```
I can't reach the methodology graph right now, so I will not fake what it would say.
A retry may not help if the origin moved; we can keep going with your room context in the meantime.
Update with two commands: /plugin marketplace update, then claude plugin update mos@mindrian-marketplace.
```

`renderRefusal('no_key', { tool: 'brain_query' })`:
```
Methodology needs the Brain, and registration has not completed (offline, or the attempt failed). I will not improvise it from memory.
We can keep working with your room context, or you can set a key at ~/.mindrian.env (chmod 600) or MINDRIAN_BRAIN_KEY as an override, then restart.
Update with two commands: /plugin marketplace update, then claude plugin update mos@mindrian-marketplace.
```

`refusalResponse('unreachable', ...).next_moves`: `['retry', 'update', 'continue_without']`

## Decisions Made
- See `key-decisions` in frontmatter above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] scripts/self-update carried a pre-existing third copy of the update-path literal**
- **Found during:** Task 1, running `tests/test-339-update-path-single-source.cjs` for the first time after creating `update-path.cjs`
- **Issue:** Arm 5 (the anti-drift scan across `lib/` and `scripts/`) failed: `scripts/self-update:68` contained the literal `claude plugin update mos@mindrian-marketplace` inside a `cat >&2 <<'EOF'` heredoc, predating this plan (shipped in v1.10.19, per `git log`). The test's own comment explicitly names this as an expected, legitimate finding for this plan's work list, not a bug in the test.
- **Fix:** Changed the heredoc from quoted (`<<'EOF'`, no expansion) to unquoted (`<<EOF`), added a `node -e` subprocess call at the top of the script that requires `update-path.cjs` and reads `PLUGIN_UPDATE_COMMAND`, with a literal-free fallback string (`"the plugin-update command from .claude/includes/release-process.md"`) if node or the module is unavailable -- a fallback with the actual literal would itself still trip the static scan. Verified no `$`, backtick, or backslash characters existed in the heredoc body before switching quoting styles (which would otherwise change bash's expansion behavior).
- **Files modified:** `scripts/self-update`
- **Verification:** `bash scripts/self-update` still exits 1 (unchanged deprecation-stub contract) and prints the correct interpolated command; `tests/test-339-update-path-single-source.cjs` Arm 5 passes (exactly one hit, in `update-path.cjs` itself).
- **Committed in:** `0536d3a8` (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to satisfy this plan's own declared verification (`tests/test-339-update-path-single-source.cjs` passes, per the plan's `<verification>` section). No scope creep beyond closing the anti-drift gate the new module's own existence created.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `FLIP-04` requirement is green: `tests/test-339-update-path-single-source.cjs` (all 5 arms) and `tests/test-250-refusal-shapes.cjs` (all 8 tests) both pass.
- Confirmed unaffected: `tests/test-257-shim-honest-refusal.cjs`, `tests/test-265-mcp-description-hygiene.cjs`, `bash tests/run-all-250.sh` (8/8), `node scripts/check-shape-declaration.cjs --check` (pre-existing advisory WARNs only, exit 0, unrelated to this plan's files).
- `bash tests/run-all-339.sh` shows the update-path arm green (`test-339-update-path-single-source.cjs: PASSED`). The suite's other 3 failures (`test-339-origin-single-source.cjs`, `test-339-269-05-checklist.sh`, `test-339-cross-repo-note.sh`) and the `339 no-em-dash fence` failure (a `TEST_339_ALLOW_MISSING`-gated check for a file from a later plan) are pre-existing, explicitly documented RED states scoped to plans 339-07 and 339-09, not this plan.
- Plan 339-10 can carry the "Rendered Copy" block above and the honest-limit sentence verbatim into the CHANGELOG and tester note.

---
*Phase: 339-brain-to-theo-cutover-release-flip-brain-client-default-orig*
*Completed: 2026-09-04*

## Post-Commit Note (tooling side effect, disclosed)

The final metadata commit (`2a63eaac`) was made via `gsd-tools query commit --files ...`. Before
invoking it, `.planning/ROADMAP.md` had a pre-existing, unrelated, uncommitted edit in the shared
working tree (Phase 276's "Dev-Research Compositing" status line, STAGED to LANDED) that this
plan's shared-tree-discipline instructions required leaving untouched. That hunk was deliberately
kept unstaged (via a hand-built `git apply --cached` of only the two Phase-339-relevant hunks)
before calling the commit verb -- but the verb re-staged the whole file path it was given rather
than respecting the partial index, so the unrelated Phase 276 hunk landed inside `2a63eaac`
alongside this plan's own two ROADMAP.md hunks (plan-count and checkbox). The content itself is
accurate (it documents separately-completed work, not fabricated or secret), so no revert was
attempted -- rewriting a commit already on `main` in a shared working tree carries its own risk.
Flagged here for visibility rather than silently absorbed.

## Self-Check: PASSED

- FOUND: lib/core/update-path.cjs
- FOUND: lib/core/refusal-messaging.cjs
- FOUND: scripts/self-update
- FOUND: commit 0536d3a8
- FOUND: commit 8403d0d6
