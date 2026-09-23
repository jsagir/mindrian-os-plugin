---
phase: 361-dominant-design-research-mode-mos-dominant-designs-gains-a-r
plan: 05
subsystem: graph
tags: [theo, degrade, part8, reference, tri-polar, dominant-design]

# Dependency graph
requires:
  - phase: 361-01
    provides: DDR361 requirement family, pre-phase baseline fixture, tests/run-all-361.sh aggregator
provides:
  - lib/core/dominant-design/theo-structure.cjs (HANDLE, TOOLS, classifyCallResult, parseReferencePhases, readDominantDesignStructure)
  - tests/test-361-theo-structure.cjs (11-leg offline contract proof, injected fake brainClient, zero network)
  - "Research mode" bullet in references/methodology/dominant-designs.md Quick Pass vs Deep Dive section
affects: [361-06, 361-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One-wire-door Theo reader with local-fallback (mirrors lib/core/strategy/taxonomy-climb.cjs): lazy require of brain-client.cjs inside the async function only, so requiring the module opens nothing and makes no network call"
    - "Not-served detection by literal text (\"Tool X not found\"), never by the -32602 JSON-RPC code alone, since a shape refusal also carries -32602"
    - "Whitelist field mapping on every Theo response (steps -> {id, name}, techniques -> {name, description}, cases -> {title, summary, outcome}); unlisted fields never survive"

key-files:
  created:
    - lib/core/dominant-design/theo-structure.cjs
    - tests/test-361-theo-structure.cjs
  modified:
    - references/methodology/dominant-designs.md

key-decisions:
  - "reasons object always names all three tools; overall `reason` mirrors framework_step's own reason when source is 'reference' (null when source is 'theo'), with '+reference_unreadable' appended when the local file also cannot be read"
  - "case_story's served shape is unknown (A1/D-15, tool not built yet): accept either a Theo-style {rows:[...]} list or a flat object directly, then whitelist-map to {title, summary, outcome} either way"
  - "TDD workflow deviation: plan Task 1 explicitly instructed one combined commit for the RED test and GREEN implementation (not the generic RED-then-GREEN two-commit convention); followed the plan's explicit instruction, task history proves RED ran and failed (Cannot find module) before implementation was written"

requirements-completed: [DDR361-09, DDR361-04]

# Metrics
duration: 25min
completed: 2026-09-23
---

# Phase 361 Plan 05: Theo structure reader with honest degrade Summary

**`readDominantDesignStructure` reads the Dominant Design phase structure from Theo's `framework_step`/`framework_techniques`/`case_story` sending only `{framework: 'Dominant Design'}`, becomes the source only when Theo returns a runnable step, and otherwise degrades to the six phases parsed from `references/methodology/dominant-designs.md`, naming which of seven reasons applied.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-23T16:15:00Z (approx)
- **Completed:** 2026-09-23T16:40:43Z
- **Tasks:** 2 (both completed)
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- `lib/core/dominant-design/theo-structure.cjs` exports `HANDLE` (`'Dominant Design'`, the only value ever sent to Theo), the frozen `TOOLS` call-order array, `classifyCallResult(toolName, result)`, `parseReferencePhases(text)`, and `async readDominantDesignStructure(opts)`. Every call builds `{framework: HANDLE}` as a fresh literal; a caller-supplied `opts.domain` or any other extra key is never forwarded and never appears in the recorded calls or the result.
- Classification covers all seven reasons in the plan's spec (`brain_unavailable`, `egress_blocked`, `not_served`, `shape_refused`, `refused`, `call_threw`, `no_steps_in_canon`) plus `served`, with `not_served` detected only by the literal `Tool X not found` text and never by `-32602` alone (T-361-22) - the module does not reuse brain-client.cjs's own unknown-tool-error sniffer, which conflates the two.
- Theo becomes the structure source only when `framework_step` returns `rows[0].steps.length >= 1` (D-09); against today's live shape (`framework_step` served with `steps: []`, the other two `Tool X not found`), the reader correctly resolves `source: 'reference'`, `reason: 'no_steps_in_canon'`.
- Every Theo response field is whitelist-mapped: steps to `{id, name}` (name falls back to `title`), techniques to `{name, description}`, cases to `{title, summary, outcome}` - extra fields never ride through (T-361-23).
- Each `calls` entry carries `{tool, args, outcome, egress_disclosure: boolean}`, `egress_disclosure` true exactly when the raw Theo result carried that key, so the 361-08 live probe can prove 361-02's Part 8 arms took effect.
- The function never throws (verified against `null`, `undefined`, numbers, strings, arrays, and malformed `rows` shapes) and makes no network call - requiring the module alone never pulls `brain-client.cjs` into `require.cache`.
- `references/methodology/dominant-designs.md` gained one bullet in `## Quick Pass vs Deep Dive` explaining Research mode: query-gate approval before any search, source-or-dropped claims, room filing only on confirmation, and an honest Desktop/Cowork degrade statement (DDR361-04's Tri-Polar clause). The six `### Phase N:` headings are byte-unchanged (`theo-structure.cjs`'s `parseReferencePhases` still returns the same six phases against the live file).

## Task Commits

Each task was committed atomically:

1. **Task 1: Theo structure reader with honest degrade** - `4bec7e392` (feat)
2. **Task 2: Research mode note in the reference file (Tri-Polar)** - `98d5e6878` (docs)

_Base commit at plan start:_ `5579ace81`

## Files Created/Modified

- `lib/core/dominant-design/theo-structure.cjs` - one-wire-door Theo reader (`HANDLE`, `TOOLS`, `classifyCallResult`, `parseReferencePhases`, `readDominantDesignStructure`), lazy `brain-client.cjs` require, whitelist field mapping, never throws
- `tests/test-361-theo-structure.cjs` - 11-leg offline proof against an injected fake `brainClient`: generic-handle-only args + call order, brain-unavailable degrade, today's live Theo shape (D-16), shape-refused-vs-not-served (T-361-22), egress_blocked/call_threw/refused, theo-served field mapping, `calls` entry shape, `parseReferencePhases` (real file, no headings, unreadable degrade), never-throws/no-network, and lazy-require proof
- `references/methodology/dominant-designs.md` - one added bullet under `## Quick Pass vs Deep Dive` naming Research mode and the Desktop/Cowork degrade statement; no other line touched

## Decisions Made

- Followed the plan's explicit Task 1 instruction to make ONE commit covering both the RED test and the GREEN implementation, rather than the generic two-commit TDD convention (`test(...)` then `feat(...)`). RED was still run and confirmed failing (`Cannot find module '.../theo-structure.cjs'`, exit 1) before the implementation was written, satisfying the fail-fast RED gate in spirit even though it is not a separate commit.
- `case_story`'s served response shape is unspecified (Theo hasn't built the tool yet, A1/D-15). Implemented `_caseSource` to accept either a `{rows:[...]}` list (consistent with `framework_step`/`framework_techniques`) or a flat object directly, then whitelist-map either shape the same way. This is a forward-compatible guess, not a contract; Theo 20.1's real shape may require revisiting (already flagged in 361-CONTEXT.md D-15).
- Overall `reason` mirrors `framework_step`'s own classified reason when the source is `reference` (matching the plan's literal instruction), rather than some aggregate of all three tools' reasons - the per-tool detail lives in `reasons`.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' verify commands and acceptance criteria passed as specified (see the acceptance-criteria commands run below).

**Acceptance criteria verified:**
- `node tests/test-361-theo-structure.cjs` exits 0, 10 `ok` lines (11 legs, one combined 1+2 line) - PASSED
- `grep -c "_looksLikeUnknownToolError" lib/core/dominant-design/theo-structure.cjs` prints `0` - PASSED
- `node -e "require('./lib/core/dominant-design/theo-structure.cjs');process.exit(...)"` (brain-client.cjs not in require.cache) exits 0 - PASSED
- `git diff -- references/methodology/dominant-designs.md` shows exactly one added line, zero removed - PASSED
- `grep -c '^### Phase [1-6]:'` prints `6` - PASSED
- em-dash count in both new/modified files is `0` - PASSED

## Issues Encountered

`bash tests/run-all-361.sh` (the phase-361 aggregator) reports `PASSED=23 FAILED=3 SKIPPED=3` after this plan's commits. All three failures are classified **pre-existing / peer-diff, not caused by this plan**:
- `lib/core/part8-egress-guard.test.cjs` (PB8-03 self-test) - matches the known pre-existing peer failure named in this session's operating instructions; file unrelated to this plan's changes.
- `tests/test-209-declared-implies-wired.cjs` - matches the known pre-existing peer failure named in this session's operating instructions.
- The aggregator's em-dash guard - fails on `.planning/phases/361-.../361-04-SUMMARY.md`, a file created by plan 361-04 (commit `8d8b26a7f`, a different session/plan), not touched by this plan.

This plan's own three artifacts (`lib/core/dominant-design/theo-structure.cjs`, `tests/test-361-theo-structure.cjs`, `references/methodology/dominant-designs.md`) each pass their own em-dash checks and every acceptance criterion cleanly (confirmed via `git log --oneline` that neither failing suite nor the offending SUMMARY file was touched by this plan's two commits). Per the shared-tree protocol, none of the three were edited or fixed here.

The 3 `SKIPPED` legs (`361-06` CLI/filing tests, `361-07` command-contract test) are correctly skipped: those test files do not exist yet because plans 361-06 and 361-07 have not executed.

## Known Stubs

None. This plan's artifacts are a pure-function reader module, its offline test suite, and one reference-doc bullet - no UI or data-flow stubs are in scope.

## Threat Flags

None. All four threat-register mitigations (T-361-20 args-purity, T-361-21 served-but-empty-not-authoritative, T-361-22 shape-refusal-vs-not-served, T-361-23 whitelist field mapping) were implemented and covered by test legs 1-2, 4, 5, and 7 respectively; T-361-24 (Theo down -> never throws) is covered by legs 3, 6b, and 10. No new network endpoints, auth paths, or schema changes were introduced - this module makes zero direct network calls (it only ever calls through an injected or lazily-required `brainClient.callTool`, the existing Part 8-gated wire door).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `lib/core/dominant-design/theo-structure.cjs` is ready for 361-06 to wire into the upgraded `/mos:dominant-designs` command body (the plan's own dependency note: 361-06, 361-08).
- 361-08's live Theo probe can now assert `egress_disclosure` behavior via this module's `calls[].egress_disclosure` field once 361-02's Part 8 arms are live.
- No blockers. The three pre-existing peer-diff failures in `tests/run-all-361.sh` remain open for their owning plans/sessions to resolve; they do not block 361-06/361-07/361-08.

---
*Phase: 361-dominant-design-research-mode-mos-dominant-designs-gains-a-r*
*Completed: 2026-09-23*

## Self-Check: PASSED

- FOUND: lib/core/dominant-design/theo-structure.cjs
- FOUND: tests/test-361-theo-structure.cjs
- FOUND: references/methodology/dominant-designs.md
- FOUND: commit 4bec7e392 (Task 1)
- FOUND: commit 98d5e6878 (Task 2)
