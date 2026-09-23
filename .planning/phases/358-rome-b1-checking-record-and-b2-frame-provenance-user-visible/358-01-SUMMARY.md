---
phase: 358-rome-b1-checking-record-and-b2-frame-provenance-user-visible
plan: 01
subsystem: local-graph
tags: [b1, checking-record, rung, portrait, rome, tdd, node-sqlite]

# Dependency graph
requires:
  - phase: 276
    provides: writeClaimNode truth-claim writer (review_status proposed), insertNode chokepoint that never touches review_status
provides:
  - VERIFICATION_RUNGS (ONE frozen ordered rung constant, TODO(358) marker)
  - recordClaimVerification extended with rung, checked_by_id, resolves_dispute, BEGIN IMMEDIATE transaction ownership
  - deriveCheckStatus (sticky disputed rule)
  - readClaimVerification (claim view: confirmation + checking_record side by side)
  - listClaimsForChecking (text-search claim list)
  - readVerificationPortrait extended with records_by_rung, status re-derived from records
  - renderPortraitLines, renderClaimViewLines, renderClaimListLines
  - navigation.cjs additive re-exports of all of the above
affects: [358-02, 358-03, 358-04, 358-05, 358-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "BEGIN IMMEDIATE transaction ownership idiom (db.isTransaction !== true) reused from ranker-weights.cjs for the read-append-write in recordClaimVerification"
    - "Status is always re-derived from the stored records array (deriveCheckStatus), never trusted from a persisted status field, so legacy latest-wins data self-heals under the sticky-disputed rule"

key-files:
  created:
    - tests/test-358-b1-core.cjs
    - tests/test-358-b1-portrait.cjs
    - tests/test-358-b1-separation.cjs
  modified:
    - lib/core/navigation/verification.cjs
    - lib/core/navigation.cjs
    - tests/test-b1-verification.cjs

key-decisions:
  - "VERIFICATION_RUNGS is the ONE exported frozen ordered array (rung 1 lowest); the provisional five-rung list from what-ai-cannot-know.vercel.app Part V practice 3 carries the exact TODO(358) marker so swapping the paper author's final list is a one-constant edit"
  - "Disputed sticks: any contradicts record after the last user-resolved record disputes the claim; a plain (non-resolving) supports never clears a dispute, only a record with resolves_dispute:true and checked_by:'user' does, and it is refused (invalid_resolution) if its own result is contradicts or (resolution_requires_person) if checked_by is not user"
  - "checked_by_id is optional, local-only, length 1-128; stored on the record but never validated against an identity system (Who checked ruling)"
  - "recordClaimVerification wraps the read-append-write in a BEGIN IMMEDIATE it owns only when the caller has not already begun a transaction, so a caller-threaded handle mid-transaction is never double-committed or rolled back out from under it"

patterns-established:
  - "readVerificationPortrait and readClaimVerification both call deriveCheckStatus on the stored records rather than trusting a persisted status field, which is what makes the sticky-disputed rule apply retroactively to legacy latest-wins data with no migration"

requirements-completed: [B1-01, B1-04, B1-05, B1-06]

# Metrics
duration: 45min
completed: 2026-09-23
---

# Phase 358 Plan 01: B1 Checking-Record Core Library Summary

**Core library contract for B1 (rung constant, sticky-disputed status, checked_by_id, claim view, room portrait by rung, render helpers) built TDD (RED then GREEN) with zero writes outside the existing insertNode chokepoint and zero changes to review_status or confidence.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-09-23 (session start, after context/research/validation load)
- **Completed:** 2026-09-23T17:29:42+03:00
- **Tasks:** 2/2 completed
- **Files modified:** 3 (2 created new, 1 pre-existing extended; plus 3 new test files)

## Accomplishments

- Built the ONE ordered `VERIFICATION_RUNGS` constant with the exact `TODO(358)` marker, verified to be the single place any rung label string appears across `lib/`, `scripts/`, `commands/`.
- Extended `recordClaimVerification` with `rung`, `checked_by_id`, `resolves_dispute`, each validated before any db write, and wrapped the read-append-write in the `BEGIN IMMEDIATE` transaction-ownership idiom (never nests a caller's transaction, never leaves one open on a refusal).
- Implemented the sticky-disputed rule (`deriveCheckStatus`) per the navigator ruling: a plain `supports` after a `contradicts` never clears the dispute; only a person-resolved (`resolves_dispute: true`, `checked_by: 'user'`, non-contradicts result) record clears it, and a later `contradicts` re-disputes.
- Added `readClaimVerification` (claim view: `confirmation` and `checking_record` side by side, the word "verified" never appears) and `listClaimsForChecking` (text-search claim list, newest first, limit clamped 1-100).
- Extended `readVerificationPortrait` with `records_by_rung` and made status always re-derived from the stored records (not a persisted status field), so a legacy latest-wins record with an earlier `contradicts` is now correctly counted as `disputed` with no migration.
- Added `renderPortraitLines`, `renderClaimViewLines`, `renderClaimListLines` as the one place these render strings are written.
- All 8 new interface names re-exported additively through `lib/core/navigation.cjs`, verified against `git diff` to contain zero removed lines.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED - core, portrait and separation tests for the checking record** - `64c260d46` (test)
2. **Task 2: GREEN - rung constant, record fields, sticky disputed, readers, portrait by rung, render helpers, re-exports** - `26e54adaf` (feat)

_TDD plan: RED then GREEN, no separate REFACTOR commit needed (no cleanup pass required after GREEN)._

## Files Created/Modified

- `tests/test-358-b1-core.cjs` - RED-first, 18 checks: rung constant shape, rungInfo, single-source label walk, rung storage/validation, checked_by_id, sticky-disputed + resolution rules, deriveCheckStatus edge cases, readClaimVerification, renderClaimViewLines, listClaimsForChecking, transaction hygiene
- `tests/test-358-b1-portrait.cjs` - RED-first, 6 checks: empty room, mixed room by state/result/rung, all-checked room still renders unchecked 0, no-score deep-walk guard, legacy latest-wins re-derivation
- `tests/test-358-b1-separation.cjs` - RED-first, 4 checks: review_status/confidence byte-identical across every result (including a refused resolution and a sticky dispute) for proposed and confirmed claims, record survives confirmNode, static no-promote/no-Brain guard
- `lib/core/navigation/verification.cjs` - VERIFICATION_RUNGS, rungInfo, normalizeRecords, deriveCheckStatus, STATUS_NOTES/CONFIRMATION_NOTES, extended recordClaimVerification (rung/checked_by_id/resolves_dispute/transaction), readClaimVerification, listClaimsForChecking, extended readVerificationPortrait (records_by_rung, re-derived status), renderPortraitLines, renderClaimViewLines, renderClaimListLines
- `lib/core/navigation.cjs` - additive re-export block only (verified zero removed lines vs plan-base commit)
- `tests/test-b1-verification.cjs` - portrait deepEqual extended with `records_by_rung` built from `navigation.VERIFICATION_RUNGS.length`

## Decisions Made

- Placed the row read (`claim_not_found` check) inside the `BEGIN IMMEDIATE` transaction rather than before it, per the plan's exact ordering, so the read is part of the same atomic snapshot as the append-write.
- `listClaimsForChecking`'s `records_total` reports the raw stored-records array length per claim (not the `normalizeRecords`-filtered count), since the plan's shape only requires the key's presence and this keeps the count consistent with what `readClaimVerification` would later show for the same claim.

## Deviations from Plan

**1. [Fail-fast rule, RED discipline] Strengthened `tests/test-358-b1-separation.cjs` before it could be committed as RED**

- **Found during:** Task 1, immediately after writing the first draft of the separation test file and running it.
- **Issue:** The plan's separation behaviors (review_status/confidence stay byte-identical; a record survives `confirmNode`; the static no-promote/no-Brain guard) all already held true against the SHIPPED (pre-358) `verification.cjs`, because `insertNode`'s `DO UPDATE` clause already excluded `review_status`/`confidence` and the shipped file already never called `confirmNode`/`promoteNodeStatus`/`brain*`. A first draft of the separation test using only supports/contradicts/inconclusive/resolves_dispute calls passed 4/4 against the old code (exit 0), violating the plan's own RED gate (`for t in core portrait separation; do ...; done | grep -c "exit=0" | grep -qx 0`).
- **Fix:** Per the fail-fast rule ("if a test passes unexpectedly during RED, investigate and fix the test before proceeding"), added explicit assertions inside the same separation checks that exercise the genuinely NEW behavior this plan introduces (a `no_dispute_to_resolve` refusal on a non-disputed claim, and a sticky-disputed status check after a plain `inconclusive` following a `contradicts`) while keeping the byte-identical review_status/confidence assertion as the outer wrapper. This ties the separation guarantee to the new validation surface instead of only re-proving an already-true invariant, and correctly fails against the old code (`true !== false` on the refusal check) while still testing exactly what B1-06 requires.
- **Files modified:** `tests/test-358-b1-separation.cjs` (Task 1, before its RED commit; no separate commit needed since the fix landed before the file was first committed).
- **Verification:** Re-ran all three test files; confirmed `separation` now exits 1 (RED) before Task 2, then exits 0 (GREEN) after Task 2.
- **Commit:** part of `64c260d46` (the fix was applied before that commit, not as a follow-up).

**2. [Rule 3 - Blocking issue] Corrected the TODO marker string literal's quoting so the plan's grep acceptance criterion actually matches**

- **Found during:** Task 1, running the plan's own acceptance-criteria grep (`grep -c "TODO(358): ... paper author's ..." tests/test-358-b1-core.cjs`).
- **Issue:** The marker string was first written inside a single-quoted JS string with an escaped apostrophe (`'...author\'s...'`), which put a literal backslash character in the source right before the apostrophe. The plan's acceptance grep searches for the marker with a plain, non-escaped apostrophe, so it returned 0 matches even though the string was semantically correct and `.includes(...)` matched at runtime.
- **Fix:** Switched that one string literal to double quotes (`"...author's..."`) so the exact marker text appears byte-for-byte in the file with no backslash, satisfying the plan's grep verbatim.
- **Files modified:** `tests/test-358-b1-core.cjs`.
- **Verification:** `grep -c "TODO(358): replace with the paper author's verification hierarchy from The Orientation Problem" tests/test-358-b1-core.cjs` now returns 1.
- **Commit:** part of `64c260d46`.

No other deviations. The GREEN implementation (Task 2) matches the plan's `<action>` steps 1-9 as written, including the transaction-ownership idiom, the note maps, and the additive-only `navigation.cjs` re-export block.

## Issues Encountered

None blocking. No auth gates (no MCP/CLI surfaces touched in this plan; those are 358-03/358-04).

## Verification Evidence

All commands from the plan's `<verify>` blocks and the phase's `358-VALIDATION.md` Per-Task map (358-01-01 RED, 358-01-02 GREEN) were run and are green as of the final commit:

```
node tests/test-358-b1-core.cjs        -> 18 passed, 0 failed (exit 0)
node tests/test-358-b1-portrait.cjs    -> 6 passed, 0 failed (exit 0)
node tests/test-358-b1-separation.cjs  -> 4 passed, 0 failed (exit 0)
node tests/test-b1-verification.cjs    -> PASS (exit 0)
node tests/test-276-claim-write-primitive.cjs -> exit 0 (no regression)
node tests/test-348-validity-window.cjs       -> exit 0 (no regression)
node tests/test-353-filing-gate.cjs           -> PASS=24 FAIL=0 (run only, not edited)
```

Acceptance-criteria greps (all satisfied):
- `TODO(358): replace with the paper author's verification hierarchy from The Orientation Problem` appears exactly once in both `tests/test-358-b1-core.cjs` and `lib/core/navigation/verification.cjs`.
- `grep -rl "A counter-argument generated by the model" lib scripts commands` prints exactly `lib/core/navigation/verification.cjs`.
- `grep -v '^\s*//' lib/core/navigation/verification.cjs | grep -cE "confirmNode|promoteNodeStatus|brain"` is 0.
- `grep -v '^\s*//' lib/core/navigation/verification.cjs | grep -c "BEGIN IMMEDIATE"` is 1.
- `grep -v '^\s*//' lib/core/navigation/verification.cjs | grep -ci "verified"` is 0.
- `git diff <plan-base> -- lib/core/navigation.cjs | grep -c '^-[^-]'` is 0 (additive only).
- No em-dashes in any of the six files touched by this plan.

## Threat Model Coverage

All six threats in the plan's STRIDE register (T-358-01 through T-358-06) are mitigated exactly as declared:

- T-358-01 (Tampering, params): closed-enum checks plus `invalid_rung`/`invalid_checked_by_id`/`invalid_resolves_dispute` all run before `BEGIN IMMEDIATE`, so a refusal writes nothing.
- T-358-02 (Elevation of privilege): proven by `test-358-b1-separation.cjs` (review_status/confidence byte-identical) and the static guard (no `confirmNode(`/`promoteNodeStatus(` in `verification.cjs`).
- T-358-03 (Repudiation): `deriveCheckStatus` keeps `disputed` sticky; proven by both core and portrait tests.
- T-358-04 (Tampering, lost update): `BEGIN IMMEDIATE` ownership idiom, proven by the transaction-hygiene check in `test-358-b1-core.cjs`.
- T-358-05 (Information disclosure): no Brain import in `verification.cjs`, proven by the static guard; `checked_by_id` is local-only.
- T-358-06 (Spoofing, accepted risk): `resolves_dispute` refuses `checked_by: 'system'` (`resolution_requires_person`), matching the plan's accepted-risk disposition.

No new trust boundaries or surfaces were introduced beyond what the plan's threat register already covers (no MCP tool, no CLI, no new command in this plan). No `## Threat Flags` section is needed.

## Known Stubs

None. Every exported function has a real, tested implementation; nothing renders a placeholder or hardcoded empty value.

## Next Steps

- 358-02 carries the `verification` key forward on claim re-file (`typed-claim.cjs` + `PROTECTED_CLAIM_KEYS`) and adds the Claude Desktop tier0 host recognition.
- 358-03 (CLI) and 358-04 (MCP) build against the exact interface names re-exported here (`readClaimVerification`, `listClaimsForChecking`, `renderVerificationPortraitLines`, `renderClaimViewLines`, `renderClaimListLines`, `VERIFICATION_RUNGS`).

## Self-Check: PASSED

- FOUND: `tests/test-358-b1-core.cjs`
- FOUND: `tests/test-358-b1-portrait.cjs`
- FOUND: `tests/test-358-b1-separation.cjs`
- FOUND: `lib/core/navigation/verification.cjs`
- FOUND: `.planning/phases/358-rome-b1-checking-record-and-b2-frame-provenance-user-visible/358-01-SUMMARY.md`
- FOUND commit `64c260d46` (test: RED)
- FOUND commit `26e54adaf` (feat: GREEN)
