---
phase: 209-shape-f-native-fire
plan: 02
subsystem: infra
tags: [hitl-shape, ask-user-question, command-plane, idempotent-stamp, frontmatter, canon-part-11]

# Dependency graph
requires:
  - phase: 190-hitl-shape-backfill
    provides: "the frontmatter-only hitl_shape declarations on 99 commands (the declared-but-unwired state B1 closes)"
  - phase: 209-shape-f-native-fire (plan 01)
    provides: "Wave 1 E1 imperative trailer + engine-arm seam this command plane fires through"
provides:
  - "scripts/stamp-firing-block.cjs: idempotent two-part stamp (canonical firing block + allowed-tools grant)"
  - "STAMP_MARKER '<!-- mos:firing-block v1 -->' on 80 command bodies (plan 03's B3 wired predicate token)"
  - "AskUserQuestion granted in 93 declaring commands' allowed-tools lists"
  - "tests/test-209-stamp-firing-block.cjs: 15-assertion idempotency + skip-list + grant-semantics proof"
affects: [209-03, 209-06, render-coverage, check-shape-declaration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Non-destructive idempotent patcher (strip-then-reinsert on a sentinel) modeled on backfill-hitl-shape.cjs"
    - "Two-part frontmatter+body delta in a single pass with --check dry-run vs apply"

key-files:
  created:
    - scripts/stamp-firing-block.cjs
    - tests/test-209-stamp-firing-block.cjs
  modified:
    - "commands/*.md (95 declaring command files: 80 body-stamped, 93 tool-granted)"

key-decisions:
  - "grantTool NEVER creates an absent allowed-tools key (absent = unrestricted; creating a list would restrict a command - T-209-08)"
  - "Body-stamp skip keys on the actual 'AskUserQuestion' substring in the stripped body, not on a hardcoded pre-wired list, so the stamp self-corrects against live drift"
  - "STAMP_MARKER doubles as plan 03's B3 wired predicate (designed together per CONTEXT)"
  - "Inline scalar allowed-tools (e.g. Bash(node *)) gets a comma-append grant, not an array rewrite - the smallest conservative diff"

patterns-established:
  - "Idempotent two-part stamp: fixed INJECT_BLOCK + a reversing STRIP_RE guarantee byte-stable re-runs"
  - "runStamp gates the grant on declaresShape() so non-declaring and hitl_shape:none commands are never touched"

requirements-completed: [B1]

# Metrics
duration: 28min
completed: 2026-07-02
---

# Phase 209 Plan 02: Shape-F Firing-Block Stamp (B1) Summary

**Idempotent two-part stamp that wired 95 declared-but-unwired commands - 80 bodies got the canonical AskUserQuestion firing block + machine-detectable marker, 93 allowed-tools lists gained the grant - flipping the command plane to wired so plan 03's B3 gate lands green.**

## Performance

- **Duration:** ~28 min
- **Started:** 2026-07-02T16:20:00Z
- **Completed:** 2026-07-02T16:47:00Z
- **Tasks:** 2
- **Files modified:** 97 (2 new scripts/tests + 95 command files)

## Accomplishments
- Wrote `scripts/stamp-firing-block.cjs`: a strip-then-reinsert idempotent patcher (Canon Part 7 reuse of the backfill-hitl-shape.cjs pattern) with `stampBody`, `grantTool`, `runStamp`, and a `--check` dry-run vs apply main.
- Stamped the live command plane in one apply pass: **80 bodies body-stamped**, **93 allowed-tools lists tool-granted**, **95 files changed total**, re-run `--check` is a verified no-op.
- The `<!-- mos:firing-block v1 -->` marker is now in place as plan 03's B3 wired predicate token.
- 15-assertion test proves idempotency, the pre-wired skip list, grant semantics across all 4 live YAML dialects, frontmatter safety, and `--check` behavior.

## Exact Counts (recorded per plan output spec)

| Metric | Count | Note |
|--------|-------|------|
| Commands with a `hitl_shape:` line | 99 | grep floor |
| ...genuinely declaring (non-`none`) | 97 | `agentshield.md` + `mva-report.md` are `hitl_shape:"none"`, excluded |
| Bodies body-stamped (carry the marker) | 80 | 97 declaring minus 17 pre-wired body-mentions |
| Bodies skipped as pre-wired (mention AskUserQuestion) | 17 | live count; PATTERNS said 18 (drift, see below) |
| allowed-tools lists tool-granted | 93 | multi-line list / flow-array / scalar dialects |
| Total command files changed | 95 | 78 body+grant, 2 body-only, 15 grant-only |
| Declaring commands with NO allowed-tools key | 1 | `memory-cortex-reach.md` left absent (correct - never create) |

## Task Commits

1. **Task 1 (RED): failing test** - `068e46f2` (test)
2. **Task 1 (GREEN): implement stamp-firing-block** - `00f758ee` (feat)
3. **Task 2: stamp across 95 commands** - `b21eafa0` (feat)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified
- `scripts/stamp-firing-block.cjs` - the idempotent two-part stamp generator
- `tests/test-209-stamp-firing-block.cjs` - 15-assertion behavior proof
- `commands/*.md` (95 files) - canonical firing block inserted after frontmatter and/or AskUserQuestion added to allowed-tools

## Decisions Made
- **Absent allowed-tools stays absent.** `grantTool` only appends to an EXISTING list; it never creates the key (an absent list means unrestricted, so creating one would restrict the command - threat T-209-08). `memory-cortex-reach.md` is the one declaring command with no list; it was left untouched on the grant half (body still stamped).
- **Skip keys on live content, not a hardcoded list.** The 18-vs-17 drift (below) is a non-issue precisely because the skip decision reads the actual stripped body for `AskUserQuestion`.
- **Scalar grant = comma-append.** `allowed-tools: Bash(node *)` becomes `allowed-tools: Bash(node *), AskUserQuestion` (a valid comma-separated form) rather than being rewritten into a flow array - the minimal diff.

## Deviations from Plan

None - plan executed exactly as written. Two ground-truth reconciliations were made (not code deviations, just recording the live numbers the plan asked for):

1. **Body-mention count is 17, not 18.** PATTERNS/CONTEXT stated 18 pre-wired bodies (and listed `futures.md`/`diagnose.md` as examples). Live count is 17; `futures.md` body does NOT mention AskUserQuestion (it was body-stamped), and there is no `diagnose.md` (it is `diagnostics.md`). Because the stamp keys on actual body content, this drift required no change - the exact stamped count is 80.
2. **futures.md already grants AskUserQuestion** (frontmatter line 22), contradicting PATTERNS' "0 grant" figure. The stamp correctly detected the existing grant and skipped it (futures.md is body-only). Its `hitl_shape:"F.2"` frontmatter line is byte-unchanged - the F.2/F.1 body drift is left for plan 03 (B2) as specified.

## Issues Encountered
- **Leftover script from a prior aborted attempt.** An untracked `scripts/stamp-firing-block.cjs` (346 lines) existed with a mismatched `runStamp` contract (array return, `rootDir` option). Root cause: a previous interrupted run left it on the working tree. Replaced it wholesale with the implementation matching the committed RED test's contract (`commandsDir` option, `{files, pendingCount, changedCount}` return).
- **check-shape-declaration.cjs needs a flag.** The plan's verify line `node scripts/check-shape-declaration.cjs` exits 2 with a usage message (it requires `--check`). Ran `node scripts/check-shape-declaration.cjs --check` -> exit 0 (128 declared, 5 skill-exempt, 133 scanned). The stamp did not break the validator.

## Verification Results
- `node tests/test-209-stamp-firing-block.cjs` -> 15/15 assertions, exit 0
- `node scripts/stamp-firing-block.cjs --check` -> exit 0 (0 pending, idempotent on live tree)
- `node scripts/check-shape-declaration.cjs --check` -> exit 0
- `node scripts/check-render-coverage.cjs` -> exit 0 (.cjs keyspace untouched)
- `grep -rl "mos:firing-block v1" commands/ | wc -l` -> 80
- `grep -c "AskUserQuestion" commands/think-hats.md` -> 4 (grant landed on the confirmed anti-exemplar)
- No em-dashes: `grep -P '\x{2014}'` finds none in the script or any command body
- No file deletions in any commit

## Next Phase Readiness
- The command plane is wired: 80 markers in place as the B3 predicate token, 93 grants applied. Plan 03 (B2+B3) can now turn the declared-implies-wired gate ON green rather than red-flooding CI (LOCKED sequencing satisfied).
- futures.md F.2/F.1 body drift deliberately left for plan 03's B2 reconcile.

## Self-Check: PASSED

- Created files verified on disk: `scripts/stamp-firing-block.cjs`, `tests/test-209-stamp-firing-block.cjs`, `.planning/phases/209-shape-f-native-fire/209-02-SUMMARY.md`
- Task commits verified in git: `068e46f2` (RED test), `00f758ee` (GREEN impl), `b21eafa0` (stamp)

---
*Phase: 209-shape-f-native-fire*
*Completed: 2026-07-02*
