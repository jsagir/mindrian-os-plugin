---
phase: 365-verification-rung-earned-not-asserted-b2-gate-floor-b3-unatt
plan: 11
subsystem: verification-signals
tags: [signals, zone-3, snapshots, floor-ledger, room-proactive]
requires: [365-04]
provides:
  - lib/core/navigation/verification-signals.cjs (STALL_WEEKS, MIN_SNAPSHOTS, isoWeekKey, readDistribution, snapshotWeek, readSnapshots, readVerificationSignals)
  - navigation re-exports (snapshotVerificationWeek, readVerificationSnapshots, readVerificationSignals, readVerificationDistribution, verificationIsoWeekKey, VERIFICATION_STALL_WEEKS)
  - the two Zone 3 verification signals merged into persistIntelligence
  - floor-ledger row verification-signals.STALL_WEEKS = 4 (disclosed)
affects: [365-15, 365.1]
requirements: [V365-15]
key-files:
  created:
    - lib/core/navigation/verification-signals.cjs
    - tests/test-365-signals.cjs
  modified:
    - lib/core/navigation.cjs
    - lib/core/proactive-intelligence.cjs
    - data/floor-ledger.json
decisions:
  - "The Zone 3 strip renders only `type: message`, so each signal message ends with its fix (INV-SL-4); the separate `fix` field keeps the structured copy"
  - "A verification insight that no longer holds is pruned from .proactive-intelligence.json on the next persist, so the strip never says a decision rests on a model's answer after a source was added"
  - "The stall signal needs at least max(MIN_SNAPSHOTS, STALL_WEEKS) = 4 snapshots; MIN_SNAPSHOTS = 2 stays the declared absolute floor"
metrics:
  tasks: 2
  files: 5
  commits: 2
---

# Phase 365 Plan 11: Weekly Snapshots and Two Zone 3 Signals Summary

The room now writes one counts-only `verification_distribution_snapshot` per ISO week and raises exactly two unsolicited verification signals through the existing room-proactive source, each carrying its fix; the stall threshold (N = 4) is a disclosed floor-ledger row.

PLAN_BASE = `3cd6de8512bc03f396e8623f0e518c38d9545b15`. Pre-flight `bash tests/run-all-365.sh` was PASSED=53 FAILED=0 SKIPPED=1 KNOWN=8 before the first edit.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | `9d67ff6af` | feat(365-11): weekly verification snapshots and the two signal readers |
| 2 | `b5d75c1a4` | feat(365-11): two verification signals in Zone 3; stall threshold disclosed in the floor ledger |

Both used `git add <exact paths>` then `git commit --only -- <exact paths>`; both pass `git merge-base --is-ancestor <sha> HEAD`. STATE.md and ROADMAP.md untouched; no `state.*` writer, `roadmap.update-plan-progress` or `query commit` ran. The peer's `353-FLEET-REPORT.json` diff was left alone.

## Exact signal copy

Signal 1 (key `verification:decision_on_model_check:<claim_id>`, type `verification`, confidence `medium`, fix `/mos:research`). `<snippet>` is the claim text with whitespace collapsed, cut at 70 characters:

> A decision rests on "<snippet>", recorded as checked only by asking a model. It moves when it is checked against a source document outside the conversation. Next: /mos:research.

(When the claim text is empty the opening reads `A decision rests on a claim recorded as ...`.) The check that closes it comes from `STANDING_WORDS.model_only.moves_when` (365-04), the one words map.

Signal 2 (key `verification:stall`, type `verification`, confidence `medium`):

> Checks in the last 4 weeks moved no claim past asking a model. Pick one claim a decision rests on and check it against a source document (/mos:research).

The structured `fix` field holds the second sentence. Neither text matches `/score|percent|ratio|grade|coverage|%|fail/i` (test V7) and neither holds a U+2014 or U+2013.

## Behavior shipped

- `snapshotWeek(db, nowMs)`: checks for an existing snapshot event of the same ISO week (SELECT), then writes through `memory-events.cjs logEvent` (the navigation `logMemoryEvent` path) with `{now}` so injected weeks stamp correctly. Payload keys are exactly `week, located_source, source_edge, model_only, none, held, records_total, created_by` (plus the `event_type` logEvent merges in). Second call in the same week returns `{written:false}`.
- `readDistribution(db)`: claims by standing via `claimStanding`; `held` = claims at review_status `needs_evidence`; `records_total` = sum of claim records. Writes nothing.
- Signal 1: the most recently touched non-gate `decision` node (id not starting `decision:gate:`, review_status not rejected or superseded) with an outbound edge of a `PROVENANCE_EDGE_TYPES` member to a claim whose standing is `model_only`. At most one insight.
- Signal 2: the last `STALL_WEEKS` snapshots have identical standing counts and `records_total` strictly larger at the end than at the start AND the last snapshot has `model_only + none >= 1`. Fewer than 4 snapshots (and so fewer than `MIN_SNAPSHOTS` = 2) never fires; the all-sourced case never fires.
- `persistIntelligence`: after the graph-findings merge, opens the db through `navigation.openRoomDbForCaller` (closed in finally), writes this week's snapshot, reads snapshots and signals, and merges them into the same insight stream. Wrapped so any fault leaves the existing output intact. `insightKey` returns `insight.key` for type `verification`.
- Floor ledger row `verification-signals.STALL_WEEKS` (value 4, kind floor, status disclosed, dependent_outputs `["room_proactive"]`); `check-floor-ledger --check` passes (52 rows, 0 unresolved).

## Test results

| Run | HEAD | Result |
|-----|------|--------|
| `node tests/test-365-signals.cjs` | `b5d75c1a4c33516ab5ab3bc8d714529920cff88f` | PASS (V1..V7, V5b, V6b, P1..P5, P2b, P3b, no-egress) |
| `node tests/test-navigation-memory-events.cjs` | `9d67ff6af` | 10/10 |
| `node scripts/check-floor-ledger.cjs --check` | `b5d75c1a4c33516ab5ab3bc8d714529920cff88f` | PASS |
| proactive-intelligence neighbors: test-276, test-cascade-surface-loop-fires, record-decision-dual-write, debouncer-drain-at-prompt, test-237 | `b5d75c1a4` | all exit 0 |
| `bash tests/run-all-365.sh` | `b5d75c1a4c33516ab5ab3bc8d714529920cff88f` | exit 0, `PASSED=54 FAILED=0 SKIPPED=1 KNOWN=8` (was 53/0/1/8: +1 new test) |

## Deviations from Plan

**1. [Rule 2 - Missing critical functionality] Fix carried in the message text.** The plan lists `fix` as a separate field, but `scripts/intent-classifier.cjs formatFinding` renders only `type: message`, so a separate field would leave the Zone 3 line without its fix (INV-SL-4). Each message therefore ends with its fix; the `fix` field is kept for structured readers. Plan wording of the stall message is preserved as the message's first sentence.

**2. [Rule 2] Stale-signal pruning.** `persistIntelligence` never removed insights, so a signal that stopped being true would keep showing until suppressed. When the verification block ran, verification insights whose key is no longer live are removed (test P2b). Other insight types are untouched.

**3. [Scope note] Edge types for signal 1.** Of SOURCED_FROM, DEPENDS_ON, ASSUMES only SOURCED_FROM is in `edges.cjs ALLOWED_EDGE_TYPES` at this base (same finding as 365-04); the signal reads the whole `PROVENANCE_EDGE_TYPES` set so DEPENDS_ON and ASSUMES start counting the moment a ruling admits them. Tests seed decisions through `writeReasoningNode`, whose provenance edge is SOURCED_FROM.

No auth gates. No checkpoints.

## Follow-on (not fixed here)

`proactive-intelligence.cjs readGraphFindings` still opens `node:sqlite DatabaseSync` directly (read-only) instead of going through navigation: a pre-existing Canon Part 9 bypass. This plan did not copy it (the new block uses `navigation.openRoomDbForCaller`) and did not fix it. A later quick task should move `readGraphFindings` onto `navigation.openRoomDbReadOnlyForCaller`.

## Known Stubs

None.

## Threat Flags

None new. T-365-06 (payload is a fixed list of counts plus a week key; test V3), T-365-21 (the merge is wrapped; test P4), T-365-22 (STALL_WEEKS is a disclosed ledger row validated by `check-floor-ledger --check`; test P5), T-365-11 (commit --only, ancestor checks) are mitigated as planned. Note: the Zone 3 message for signal 1 includes a 70-character snippet of the claim text; it lives only in the local `.proactive-intelligence.json` and never reaches a snapshot payload or the Brain.

## Hand-offs

- **365-15** can reuse `navigation.readVerificationSignals(db, snapshots)` if the claim_read render wants to echo the same two sentences; the stall sentence is built from `STALL_WEEKS`.
- **365.1** replaces only `claimStanding`'s body; both signals and the snapshot read it, so they follow automatically.
- The signals only fire for rooms where `persistIntelligence` runs (post-filing cascade, Step 10); a room with no filings in a week writes no snapshot that week, so the stall window counts snapshot weeks, not calendar weeks.
- `tests/test-353-filing-gate.cjs` still pins EVENT_TYPES size and stays a pre-existing red; this plan added no event type (the type landed in 365-04).

## Self-Check: PASSED

- FOUND: lib/core/navigation/verification-signals.cjs, tests/test-365-signals.cjs
- FOUND commits: 9d67ff6af, b5d75c1a4 (both ancestors of HEAD)
- `grep -nP '[\x{2013}\x{2014}]'` over every file this plan touched: no hits
