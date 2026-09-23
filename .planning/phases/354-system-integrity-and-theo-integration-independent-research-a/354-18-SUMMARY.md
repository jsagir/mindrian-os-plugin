---
phase: 354-system-integrity-and-theo-integration-independent-research-a
plan: 18
subsystem: mcp
tags: [theo, mcp, egress, advisory, tier-5, doctor, canon-part-8]

# Dependency graph
requires:
  - phase: 354-06
    provides: "D-354-EGR / THEO-03: part8-egress-guard.cjs closed-vocabulary gate this plan's wording refers to as the chokepoint the raw theo server bypasses"
  - phase: 354-13
    provides: "doctor.cjs runBoundedChild + acceptance-runner restructuring this plan's scripts/doctor.cjs edit had to land on top of"
  - phase: 354-17
    provides: "an earlier same-file doctor.cjs edit this plan's edit serializes after"
provides:
  - "The routing rule (Brain-adjacent + plugin-user/venture-room content -> guarded mindrian-brain shim, never raw theo) stated in CLAUDE.md's and docs/GROUNDING-SOURCES.md's Theo grounding-source entries"
  - "scripts/check-theo-mcp-exposure.cjs: offline, zero-network, WARN-only scan naming a live theo+mindrian-brain co-registration"
  - "doctor.cjs --acceptance coverage-gate advisory registry entry: { id: 'theo-mcp-exposure', script: 'check-theo-mcp-exposure.cjs' }"
affects: [354-16, theo-integration, mcp-config]

# Tech tracking
tech-stack:
  added: []
  patterns: ["advisory-only doctor check with no --strict escalation (deliberately narrower than the check-shape-declaration.cjs sibling pattern, per navigator ruling)"]

key-files:
  created:
    - scripts/check-theo-mcp-exposure.cjs
    - tests/test-354-theo-mcp-exposure.cjs
  modified:
    - CLAUDE.md
    - docs/GROUNDING-SOURCES.md
    - scripts/doctor.cjs
    - tests/run-all-354.sh
    - .planning/REQUIREMENTS.md
    - .planning/phases/354-system-integrity-and-theo-integration-independent-research-a/deferred-items.md

key-decisions:
  - "No --strict mode for check-theo-mcp-exposure.cjs -- the navigator's 2026-09-23 decision was documentation + visibility, never enforcement; inventing a stricter mode would overstate the ruling"
  - "WARN output goes to stdout, not stderr (deviates from check-shape-declaration.cjs's stderr convention) -- the plan's own T1 test spec required stdout; doctor.cjs's gate only checks exit status, not stream content, so this has no effect on the acceptance roll-up"
  - "Deliberately re-opened tests/run-all-354.sh (against its own 'no later plan edits this' header note) to add a run_if leg for the new test, because 354-18-PLAN.md's own <verification> block requires that exact aggregator to show the test PASSED, and THEO-04 was minted after 354-01 authored the aggregator"

requirements-completed: [THEO-04]

# Metrics
duration: 5min (tool-time; commits span 18:34:31-18:38:04)
completed: 2026-09-23
---

# Phase 354 Plan 18: Theo MCP Exposure Documentation + Advisory Check Summary

**Closed THEO-04 exactly as the navigator ruled: a routing-rule sentence added to the two grounding-source docs a session actually reads, plus a new offline/zero-network/WARN-only doctor.cjs advisory check that names a live theo+mindrian-brain co-registration every acceptance run -- no code fix, no removal, no --strict mode.**

## Performance

- **Duration:** ~5 min of tool-time (commits span 18:34:31-18:38:04); file reading/context assembly time not separately tracked
- **Started:** 2026-09-23 (session start)
- **Completed:** 2026-09-23T18:38:04+03:00
- **Tasks:** 2/2
- **Files modified:** 6 (2 created, 4 modified in the two plan tasks) + 2 bookkeeping files (REQUIREMENTS.md, deferred-items.md) + 1 additional deliberate re-open (tests/run-all-354.sh)

## Accomplishments

- CLAUDE.md's and docs/GROUNDING-SOURCES.md's existing Theo grounding-source bullets now state, in words a future session will read before calling a Brain-adjacent tool: any Brain-adjacent question carrying plugin-user or venture-room content must go through the guarded `mindrian-brain` MCP shim, never `mcp__theo__*` directly. The 2026-09-02 standing-consult ruling text is unchanged.
- `scripts/check-theo-mcp-exposure.cjs` shipped: reads `~/.claude.json` (both its top-level `mcpServers` and one level of `projects[<dir>].mcpServers` nesting, mirroring `lib/core/integration-registry.cjs`'s `readScopedMcpServers()` shape) and this repo's own `.mcp.json`, classifies each entry by command/args path segments (`theo-shaped` vs `guarded-shim-shaped`), and prints a WARN naming THEO-04 and the exact config paths when both shapes are present. Exits 0 always.
- Wired into `doctor.cjs --acceptance`'s existing `coverage-gate` advisory registry array (the same array `check-shape-declaration.cjs` and `check-tool-honesty.cjs` already ride), as an additive sibling entry -- confirmed the coverage-gate's `ok` test (`r.status === 0`) is unaffected for this entry and the roll-up's exit-code contract is unchanged.
- `tests/test-354-theo-mcp-exposure.cjs` (T1-T4 + a `classifyEntry` unit leg) all pass, including T4's zero-network proof via a `--require` preload that makes `fetch`/`http.request`/`https.request` throw if invoked.
- Ran the real check against this machine's actual `~/.claude.json`: it correctly found and named the live exposure (theo-shaped in `~/.claude.json`, guarded-shim-shaped in this repo's `.mcp.json`) -- confirming the check works against the real THEO-04 condition, not just synthetic fixtures.

## Task Commits

1. **Task 1: Document the routing rule where a session actually reads it** - `db68fe06a` (docs)
2. **Task 2: Offline advisory check, wired into doctor.cjs --acceptance** - `c1c948bf0` (feat)

**Additional commits (deliberate, outside the plan's stated files_modified, see Deviations):**
- `31c38fc76` (test): wired the new test into `tests/run-all-354.sh` (the plan's own `<verification>` block requires this)
- `c16ca1c3f` (docs): marked THEO-04 complete in `.planning/REQUIREMENTS.md`, logged the pre-existing `connector` coverage-gate staleness deviation in `deferred-items.md`

_No TDD tasks in this plan; each commit is a single feat/docs/test commit._

## Files Created/Modified

- `scripts/check-theo-mcp-exposure.cjs` - offline, zero-network, WARN-only THEO-04 scan; no --strict mode
- `tests/test-354-theo-mcp-exposure.cjs` - T1 (both shapes -> WARN with THEO-04 + both paths), T2 (shim-only -> "no exposure found"), T3a/T3b (missing/malformed config -> no throw), T4 (zero-network proof via `--require` preload), plus a `classifyEntry` unit leg
- `CLAUDE.md` - one sentence appended to the existing Theo grounding-source bullet; 2026-09-02 ruling text unchanged
- `docs/GROUNDING-SOURCES.md` - the same rule plus one mechanism sentence (verifies `theo-mcp.onrender.com` appears in exactly one file, `lib/core/brain-client.cjs`) appended to the existing Theo entry
- `scripts/doctor.cjs` - one additive entry in the `coverage-gate` advisory registry array: `{ id: 'theo-mcp-exposure', script: 'check-theo-mcp-exposure.cjs' }`
- `tests/run-all-354.sh` - one new `run_if` leg for the new test, plus two filenames added to the em-dash guard's `PHASE_354_SURFACES` array
- `.planning/REQUIREMENTS.md` - THEO-04 row flipped to `[x]`
- `.planning/phases/354-system-integrity-and-theo-integration-independent-research-a/deferred-items.md` - logged the pre-existing, unrelated `data/connector-registry.json` staleness found while spot-checking the coverage-gate

## Decisions Made

- **No --strict mode.** The navigator's THEO-04 ruling was "document + procedural discipline," never enforcement. `check-shape-declaration.cjs`'s sibling pattern has a `--strict` hard-fail opt-in; this check deliberately does not, because inventing one would misrepresent what was actually decided.
- **WARN output on stdout, not stderr.** `check-shape-declaration.cjs` prints its WARN lines via `console.error` (stderr), matching `doctor.cjs`'s `stderrTail` diagnostic convention. This plan's own test spec (`354-18-PLAN.md` Task 2, T1) explicitly requires `--check`'s output to appear on **stdout** ("assert ... its stdout names THEO-04"), so `check-theo-mcp-exposure.cjs` uses `console.log` throughout. `doctor.cjs`'s gate only inspects `r.status`, never stream content, so this has zero effect on the acceptance roll-up.
- **Deliberately re-opened `tests/run-all-354.sh`.** Its own header comment says "NO LATER PLAN in this phase edits it" unless there is "a signal to re-open this file deliberately." `354-18-PLAN.md`'s own `<verification>` block is exactly that signal: it requires `bash tests/run-all-354.sh` to show `test-354-theo-mcp-exposure` PASSED. THEO-04 did not exist as a finding when 354-01 authored the aggregator (it was minted post-planning, 2026-09-23), so no leg existed for it. Added one leg plus two filenames to the em-dash guard array; touched nothing else in the file.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed a grep-pattern mismatch between the plan's own acceptance criteria and its own action text**
- **Found during:** Task 1 verification
- **Issue:** The plan's action text specified the appended sentence with backticks around `` `mcp__theo__*` `` immediately followed by " directly" outside the backticks (e.g. `` never `mcp__theo__*` directly ``). The plan's own acceptance criteria required `grep -n "mcp__theo__\* directly" CLAUDE.md` to match -- but the backtick character sitting between the asterisk and the space breaks that exact substring match.
- **Fix:** Wrote the sentence without backticks around `mcp__theo__*` (plain text: `never mcp__theo__* directly`) in both CLAUDE.md and docs/GROUNDING-SOURCES.md, satisfying the literal grep the plan's own acceptance criteria specified while keeping the sentence's meaning and placement identical to the plan's instruction.
- **Files modified:** CLAUDE.md, docs/GROUNDING-SOURCES.md
- **Verification:** `grep -n "mcp__theo__\* directly" CLAUDE.md` now matches inside the Theo bullet; `grep -c THEO-04 CLAUDE.md` = 1; `grep -c part8-egress-guard docs/GROUNDING-SOURCES.md` = 1; 2026-09-02 ruling text confirmed byte-unchanged in both files.
- **Committed in:** `db68fe06a` (Task 1 commit)

**2. [Rule 3 - Blocking] Wired the new test into tests/run-all-354.sh, which the plan's declared files_modified list omitted**
- **Found during:** Task 2 verification
- **Issue:** `354-18-PLAN.md`'s `<verification>` block requires `bash tests/run-all-354.sh` to show `test-354-theo-mcp-exposure PASSED`, but the plan's frontmatter `files_modified` list does not include `tests/run-all-354.sh`, and the aggregator's own header comment forbids later plans from editing it except via a deliberate re-open.
- **Fix:** Added one `run_if` leg for the new test file (matching the existing pattern exactly) plus the new script/doc filenames to the em-dash guard array. Verified `bash tests/run-all-354.sh` reports `PASSED=18 FAILED=0 SKIPPED=2` with the new leg passing.
- **Files modified:** tests/run-all-354.sh
- **Verification:** `bash tests/run-all-354.sh` output includes `>>> 354: theo MCP exposure advisory (THEO-04): PASSED` and the em-dash guard still PASSES.
- **Committed in:** `31c38fc76` (separate commit, deliberately outside the two task commits)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking, both necessary to satisfy the plan's own stated verification/acceptance requirements).
**Impact on plan:** No scope creep -- both fixes exist solely to make the plan's own declared verification commands actually pass as written. No production code behavior changed by either fix.

## Issues Encountered

- **Pre-existing `data/connector-registry.json` / `data/mcp-tool-connectors.json` staleness** surfaced while spot-checking `doctor.cjs --acceptance`'s `coverage-gate` roll-up (the `connector` entry in that same array exits 1). Confirmed unrelated to this plan: none of this plan's files are `commands/*.md`/`agents/*.md`/`pipelines/*/CHAIN.md`/`skills/*/SKILL.md` surfaces `build-connector-registry.cjs` enumerates, and `git log -1 -- data/connector-registry.json` predates this plan's commits. This repo's working tree is shared by multiple concurrent Claude sessions right now (per this plan's own execution instructions); `git status --short` showed unrelated peer-session changes in flight throughout execution. Logged to `deferred-items.md`, not fixed. This plan's own `theo-mcp-exposure` gate entry always exits 0, so it cannot have introduced this or any other new failure into the roll-up.
- Ran `node scripts/doctor.cjs --acceptance` in full was avoided given the shared-tree, concurrent-session environment and SYS-07's known unresolved acceptance-runner-timeout issue (documented separately in 354-CONTEXT.md as UNRESOLVED, not this plan's concern); instead directly exercised the exact `gates` array `coverage-gate` spawns, confirming `theo-mcp-exposure` returns `ok: true` / `status: 0` alongside every other entry's own independent status, and that the pre-existing `connector` failure is present with or without this plan's addition.

## User Setup Required

None - no external service configuration required. This plan touches no environment variables, no keys, no network calls.

## Next Phase Readiness

- THEO-04's disposition in `.planning/REQUIREMENTS.md` is `[x]` complete (mitigated-documented).
- `docs/reviews/phase-354-disposition-ledger.md`'s THEO-04 row still reads "remediation pending Plan 354-18" -- per `354-01-SUMMARY.md`'s own note ("354-16's close-out plan should not mark it closed until 354-18 actually lands the CLAUDE.md rule and the doctor advisory check"), closing that ledger row is explicitly 354-16's job, not this plan's. This plan lands both prerequisites (the CLAUDE.md rule and the doctor advisory check) that 354-16 needs to close it.
- No blockers for 354-16 (phase close-out) or any other later plan. This plan does not touch `/home/jsagi/Theo` and does not unregister the global `theo` MCP entry, per the navigator's explicit decision.

---
*Phase: 354-system-integrity-and-theo-integration-independent-research-a*
*Completed: 2026-09-23*

## Self-Check: PASSED

- FOUND: scripts/check-theo-mcp-exposure.cjs
- FOUND: tests/test-354-theo-mcp-exposure.cjs
- Commit db68fe06a: FOUND (git log --oneline --all)
- Commit c1c948bf0: FOUND (git log --oneline --all)
- Commit 31c38fc76: FOUND (git log --oneline --all)
- Commit c16ca1c3f: FOUND (git log --oneline --all)
- `node scripts/check-theo-mcp-exposure.cjs --check` exits 0: CONFIRMED
- `node tests/test-354-theo-mcp-exposure.cjs` exits 0, 6/6 legs pass: CONFIRMED
- `bash tests/run-all-354.sh` reports PASSED=18 FAILED=0 SKIPPED=2, including the new leg: CONFIRMED
- `grep -q theo-mcp-exposure scripts/doctor.cjs`: CONFIRMED (same array as shape-declaration entry)
