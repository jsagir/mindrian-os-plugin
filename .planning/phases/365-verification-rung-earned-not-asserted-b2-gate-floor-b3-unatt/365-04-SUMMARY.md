---
phase: 365-verification-rung-earned-not-asserted-b2-gate-floor-b3-unatt
plan: 04
subsystem: verification-standing
tags: [b2, standing, floor, words-map, part-9]
requires: [365-01, 365-02, 365-03]
provides:
  - claimStanding(db, claimId), the ONE read-only standing reader (outbound provenance edges + records)
  - STANDING_IDS, STANDING_WORDS (provisional), PROVENANCE_EDGE_TYPES, FLOOR_IDS, FLOOR_ALIASES, DEFAULT_FLOOR_ID, FLOOR_WORDS, standingMeetsFloor
  - standing on every listClaimsForChecking row, plus a standing filter
  - lib/core/navigation/verification-floor.cjs (readVerificationFloor, composeFloorNotice)
  - verification_floor optional ROOM.md key; approval_floor_checked and verification_distribution_snapshot event types
  - navigation.cjs re-exports, plus an undefined-until-365-05 holdForEvidence slot
affects: [365-05, 365-08, 365-11, 365-15, 365.1]
requirements: [V365-02, V365-05, V365-07, V365-08, V365-16]
key-files:
  created:
    - lib/core/navigation/verification-floor.cjs
    - tests/test-365-standing.cjs
    - tests/test-365-floor-reader.cjs
  modified:
    - lib/core/navigation/verification.cjs
    - lib/core/frontmatter-schemas.cjs
    - lib/core/navigation/memory-events.cjs
    - lib/core/navigation.cjs
    - tests/fixtures/365-baseline-red.json
    - tests/test-365-baseline.cjs
decisions:
  - "D-03 narrowed (2026-10-01 ruling): the standing reader counts only OUTBOUND PROVENANCE edges (SOURCED_FROM, DEPENDS_ON, ASSUMES); CONTRADICTS, RELATED_TO, INFORMS and every other type never count"
  - "A locator counts when it is on the source node properties OR on the SOURCED_FROM edge properties (the 365-02 fixture rides it on the edge)"
  - "The floor reader treats any declared value outside FLOOR_IDS and FLOOR_ALIASES as invalid_fell_back (including an empty value), never as an absent key"
metrics:
  tasks: 2
  files: 9
  commits: 2
---

# Phase 365 Plan 04: Standing Reader, Words Map, Floor Reader Summary

One read-only seam now answers "what was this claim checked against, and does it meet this room's floor": `claimStanding` reads outbound provenance edges and records only, `STANDING_WORDS` is the single provisional words map, and `composeFloorNotice` builds the `Checked against:` why-line once for every approval surface. RED-365-BYTE is healed.

PLAN_BASE = `7cf7a56e7ed8c4fbcc2b18a23d7bd82d54e90e59`. No gate behavior changed in this plan; no node, edge or event is written by any new helper.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | `4e9da3504` | feat(365-04): one standing reader and the provisional words map; byte test green |
| 2 | `4a0f89830` | feat(365-04): floor reader, why-line composer, ROOM.md key and floor event types |

Each used `git add <exact paths>` then `git commit --only -- <exact paths>`; both pass `git merge-base --is-ancestor <sha> HEAD`. STATE.md and ROADMAP.md were not touched; no `state.*` writer, `roadmap.update-plan-progress` or `query commit` ran. Peer Phase 366 hunks were left alone.

## Exact provisional words shipped (STANDING_WORDS, marked `PROVISIONAL(365)` behind the unratified ladder)

| id | label | checked_against (notice) | moves_when |
|----|-------|--------------------------|------------|
| located_source | checked against a located part of a source outside the conversation | a located part of a source outside the conversation | a person with standing checks it (the room cannot record that yet) |
| source_edge | checked against a source document outside the conversation (a link and a retrieval date) | a source document outside the conversation (rendered at notice time as host, optional locator, retrieval date) | the exact part of a primary source that decides it is recorded (a page, section, DOI or clause) |
| model_only | recorded as checked only by asking a model | a model's answer only, as recorded | it is checked against a source document outside the conversation |
| none | not checked yet | nothing outside the conversation yet | any check is recorded |

FLOOR_WORDS: unchecked "no check at all", recall "the navigator's own recall", model_internal "a model's answer", secondary_document "a source document", primary_source_located "the located part of a primary source", person "a person's check". No string matches /verified|score|percent|ratio|grade|coverage|%/i (test S9) and none holds a U+2014 or U+2013.

Notice shape (one line, at most 400 chars): `Checked against: <X>.` then one floor clause (`This room asks for at least a source document, so approving files it as needs evidence.`, `That meets this room's floor (a source document), so approving confirms it.`, `This room sets no floor, so approving confirms it.`, the person-floor clause, or `so it stays at needs evidence.` when already at needs_evidence), plus `(The room's verification_floor value was not recognized, so the default applies.)` for an invalid value. For a claim whose status is not proposed or needs_evidence, landing is `unchanged` and the floor clause is omitted. `approve_label` is `Approve, mark as needs evidence` exactly when the landing is needs_evidence.

## D-03 implementation note (2026-10-01 ruling)

D-03 says "at least one outbound edge"; the implementation narrows it to outbound PROVENANCE edges only (`PROVENANCE_EDGE_TYPES` = SOURCED_FROM, DEPENDS_ON, ASSUMES, a frozen Set). SOURCED_FROM is the evidence edge the research names (writeReasoningNode writes claim to evidence SOURCED_FROM). **Intersection with edges.cjs ALLOWED_EDGE_TYPES today: SOURCED_FROM only.** DEPENDS_ON and ASSUMES are not allowed edge types at this base, so they are inert until a ruling admits them. CONTRADICTS, RELATED_TO, INFORMS and every other non-provenance edge never satisfy the floor (test S6b), and an inbound edge never counts (S6). Adding any other type, for example DERIVED_FROM, is a deliberate widening that needs a ruling. The comment recording this sits directly above `PROVENANCE_EDGE_TYPES` in verification.cjs.

## Test results

| Run | HEAD | Result |
|-----|------|--------|
| `node tests/test-365-standing.cjs` | `4a0f89830` | PASS (S1..S11, S6b, extras) |
| `node tests/test-365-floor-reader.cjs` | `4a0f89830` | PASS (R1..R6, N1..N9, K1..K3) |
| `node tests/test-365-acceptance-byte.cjs` | `4e9da3504` | exit 0 (RED-365-BYTE healed) |
| 358 core, 358 portrait, test-b1-verification, ladder fence (F7 now checks 6 FLOOR_IDS), test-navigation-memory-events | `4a0f89830` | all exit 0 |
| `bash tests/run-all-365.sh` | `4a0f898307cb3b920fefc3b527706b9c448b7751` | exit 0, `PASSED=47 FAILED=0 SKIPPED=1 KNOWN=8` (was 44/0/1/9 at 7cf7a56e7: +2 new tests, +1 byte leg now passing, KNOWN 9 to 8) |
| `RUN_365_REGRESSIONS=1 bash tests/run-all-365.sh` | working tree identical to `4a0f89830` apart from the commit boundary (started after `4e9da3504`, task 2 files already on disk) | exit 0, `PASSED=52 FAILED=0 SKIPPED=0 KNOWN=8`; regression suites 354, 355, 356, 358, 363 all at their base failing-leg counts |

## test-353 EVENT_TYPES size observation

`tests/test-353-filing-gate.cjs` pins `EVENT_TYPES.size is 102 (untouched)`. The size was 104 at HEAD before this plan (already failing that one line), and is 106 after adding two types; the failing line is the same line before and after (`FAIL: EVENT_TYPES.size is 102 (untouched)`, `PASS=23 FAIL=1`). Note: suite 353 is NOT in tests/fixtures/365-regression-base.json (its suites are 354, 355, 356, 358, 363), so the plan's "confirm it is in the regression base" cannot be met literally; the failure is pre-existing and unrelated, and I did not fix it (out of scope).

## Deviations from Plan

**1. [Rule 3 - Blocking] tests/test-365-baseline.cjs leg 5 hard-pinned six red signatures.** After dropping the byte leg from the red list (as the plan and 365-02's hand-off require), leg 5 failed on `sigCount === 6`, which contradicts the hand-off line "the list may shrink". Changed the check to `sigCount <= 6` (still requires every listed signature to be observed at base with a valid healer; the 'unlisted observed' converse is unchanged). File was outside the plan's files list; committed with Task 1. Later healing plans no longer need to touch it.

**2. [Scope note] Locator placement.** The plan says a non-empty locator on the target node marks located_source; the 365-02 fixture (and its recorded decision) puts the locator on the SOURCED_FROM edge properties. claimStanding accepts either (node or edge, both outbound and the claim's own). Test S5 covers both. 365.1 may move the locator's home; only `claimStanding`'s body changes (D-24).

**3. [Scope note] Floor value parsing is a superset of the plan's regex.** The plan's pattern `[a-z_0-9]+` would silently treat a value like `Primary Source` (spaces or capitals) as an absent key. The reader captures the whole value, strips quotes, and reports anything unknown as `invalid_fell_back` so it is shown, never silently defaulted (T-365-13). Behavior for every plan leg (R1..R6) is as specified.

No auth gates. No checkpoints.

## Known Stubs

`holdForEvidence: confirmNodeMod.holdForEvidence` in navigation.cjs is `undefined` until 365-05 adds the function to confirm-node.cjs; this is the plan's explicit design (test K3 only checks the key exists). Nothing renders it.

## Threat Flags

None new. The reader opens only the room-root ROOM.md for reading (4 KB, frontmatter only) and never writes it; event payload contracts (ids, enums, counts) are recorded in the memory-events.cjs comments. T-365-01 (claimStanding reads only the claim's own outbound edges), T-365-13 (invalid floor falls back visibly) and T-365-06 are mitigated as planned.

## Hand-offs

- **365-05** adds `holdForEvidence` to confirm-node.cjs; navigation.cjs already re-exports the slot (do not re-edit navigation.cjs for it).
- **365-08** emits `approval_floor_checked` from `_promoteCardSubject` with the contract in the memory-events.cjs comment, and calls `composeFloorNotice(db, roomDir, subjectId)` for every rung and the meeting card. The notice already contains `Checked against:`, `needs evidence`, the host of the accepted source and the exact approve label `Approve, mark as needs evidence`; `approve_label` is null when an approve confirms. No "confirm anyway" wording exists.
- **365-11** emits `verification_distribution_snapshot` (counts only) one per ISO week.
- **365-15** can read `navigation.STANDING_WORDS.model_only.label` (`recorded as checked only by asking a model`) for the claim_read render; the red leg RED-365-ONEWEEK-STANDING stays listed (not healed here).
- **365.1** replaces only the body of `claimStanding`; `deriveRung` is deliberately NOT exported (D-25 fence; byte-derived leg stays KNOWN red). `tests/fixtures/365-baseline-red.json` now lists three legs (byte-derived, one-week, floor); `observed_at_base` in 365-pre-phase.json is untouched.

## Self-Check: PASSED

- FOUND: lib/core/navigation/verification-floor.cjs, tests/test-365-standing.cjs, tests/test-365-floor-reader.cjs
- FOUND commits: 4e9da3504, 4a0f89830 (both ancestors of HEAD)
- `grep -nP '[\x{2013}\x{2014}]'` over every file this plan touched: no hits
