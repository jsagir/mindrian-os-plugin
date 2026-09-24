---
phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi
plan: 25
subsystem: testing
tags: [hit-rate, stamping, as-shown, hub-inflation, verification-record, checkpoint]

# Dependency graph
requires:
  - phase: 355-24
    provides: "scripts/measure-355-hit-rate.cjs (guard, export, wilson95, joinJudgments, computeRates), tests/fixtures/355-rooms/pairings.items.json (96 unstamped shown pairings) and judgments.json (the navigator's blind sitting-1 gold, commit e4bdb4354)"
provides:
  - "tests/fixtures/355-rooms/stamps.json + pairings-stamped.items.json (Task 1, c06156693): one live Theo capture, every stamp replayed offline"
  - "tests/fixtures/355-rooms/judgments-stamped.json + labeling-session-pairings-stamped.json: the navigator's as-shown sitting-2 labels (96 items)"
  - "scripts/measure-355-hit-rate.cjs record + full --check (pure buildRecord, byte-exact recompute, 355-VERIFICATION.md section regenerated as a view of the record)"
  - "tests/fixtures/355-rooms/hit-rate-record.json: the machine source of every hit-rate number"
  - "355-VERIFICATION.md '## Hit-rate record (SPEC Req 7)' section"
affects: ["355-27 (Theo T-3 handoff reads the unverified rate, reason mix, hub share, provenance-routed count, per-tier rates and latency from hit-rate-record.json; HIPS-07 requirement row)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Record-as-source, section-as-view: buildRecord() is pure over parsed inputs (no Date, no network); --check requires byte equality with the stored record before it regenerates the markdown section between the heading and an end marker, keeping everything outside the section byte-for-byte"
    - "Absent-record contract tested by injection: checkRecord({recordPath}) proves the 77 exit on a temp absent path, so the real record's presence never turns the leg into a SKIP"

key-files:
  created:
    - tests/fixtures/355-rooms/judgments-stamped.json
    - .planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/labeling-session-pairings-stamped.json
    - tests/fixtures/355-rooms/hit-rate-record.json
    - .planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/355-VERIFICATION.md
  modified:
    - scripts/measure-355-hit-rate.cjs
    - tests/test-355-hit-rate-record.cjs
    - .planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/deferred-items.md
    - .planning/ROADMAP.md

key-decisions:
  - "False-friend count per tier follows the plan text literally: a planted false friend counts only when the navigator marked its named direction wrong (direction_ok false); false_friends_shown_by_tier is recorded beside it so the denominator is visible"
  - "Hub inflation uses the in-sample proxy (interior-node frequency across this record's strong paths, top decile, ties at the cut included, at least one node) and the record names that source; no governed Theo call returns degree"
  - "'Strong beats the baseline' is coded as the strong Wilson lower bound sitting above the baseline rate; it does not, so the section says the tier carries no measured information yet (AI-SPEC Section 6 wording)"
  - "Theo latency p50 / p95 are nearest-rank over every latency_ms value in the capture file (165 timings, 164 calls / responses), disclosed as such"
  - "The sitting-2 gold keys its entries under items, like sitting 1; the plan's Task 2 inline verify names j.judgments (stale key, same as 355-24's). Verified with items; the data was not renamed"

patterns-established:
  - "Machine record + regenerable markdown section with an append-only header comment and an end marker, verified in the test against a temp copy so the test never rewrites a tracked file"

requirements-completed: [HIPS-07, HIPS-04]

# Metrics
duration: ~45min (Tasks 2 close + 3; Task 1 in a prior session)
completed: 2026-09-24
---

# Phase 355 Plan 25: Stamped pairings, as-shown sitting and the first hit-rate record Summary

**The engine's first human-judged hit rate is on record: the navigator found 43 of 96 blind pairings useful (44.8%, 95% Wilson 35.2% to 54.7%); strong-stamped pairings 7 of 13 (53.8%, Wilson 29.1% to 76.8%) do not sit above that baseline, so the tier carries no measured information yet; seeing the stamps moved the pooled rate by -1.0 percentage points (42 of 96 as shown); 85.4% of stamps are unverified, mostly because 80.2% of pairings never carried a canon name for Theo to check.**

## Performance

- **Duration:** ~45 min for Task 2 close and Task 3 (Task 1 ran in an earlier session)
- **Completed:** 2026-09-24
- **Tasks:** 3 of 3
- **Files created/modified:** 9 (plus Task 1's 4)

## Accomplishments

- **Task 1 (earlier session, `c06156693`):** `stamp` subcommand; one live Theo capture of 17 distinct canon-name pairs; `stamps.json` (strong 13, indirect 1, unverified 82) and `pairings-stamped.items.json` replayed offline.
- **Task 2 (sitting 2, closed here):** recomputed the navigator's as-shown labels from the files rather than trusting the pre-check: sitting 2 useful 42, direction_ok 15, already_known 46 against sitting 1's 43 / 16 / 45; per-pairing agreement useful 93/96, direction 93/96, already known 95/96. `fixture_sha256` equals `pairings-stamped.items.json`'s own sha256 (`1b692d2a...`); the emitted gold matches the session file entry-for-entry; all 96 pair ids present once. Committed the gold and the session file (`git add -f`, gitignored under `.planning/`).
- **Task 3:** `record` and a full `--check` in `scripts/measure-355-hit-rate.cjs`; wrote `hit-rate-record.json` and the `355-VERIFICATION.md` section (Rooms and producers, Hit rate, Unstamped baseline, As-shown rate and stamp influence, Stamp mix and not_called share, Hub inflation / provenance routing / diversity, Direction fidelity, Verified versus already known, Theo latency, Portfolio ranking tension (D-47), Every shown pairing per room, Disclosed limitations, Open questions, and a closing "What this number is" paragraph). `node scripts/measure-355-hit-rate.cjs --check` and `node tests/test-355-hit-rate-record.cjs` exit 0 (93 PASS, 0 FAIL, no SKIP).

## Headline numbers (from hit-rate-record.json)

| Measure | Value |
|---|---|
| Pooled useful (blind) = unstamped baseline | 43/96, 44.8%, Wilson 35.2% to 54.7% |
| room-ill-defined | 21/32, 65.6%, Wilson 48.3% to 79.6% |
| room-extend | 15/26, 57.7%, Wilson 38.9% to 74.5% |
| room-control | 7/38, 18.4%, Wilson 9.2% to 33.4% |
| strong | 7/13, 53.8%, Wilson 29.1% to 76.8% |
| indirect | 0/1, 0.0%, Wilson 0.0% to 79.3% |
| unverified | 36/82, 43.9%, Wilson 33.7% to 54.7% |
| As-shown (sitting 2) | 42/96, 43.8%, Wilson 34.3% to 53.7% |
| Stamp-influence gap | -1.0 pp pooled; strong -7.7 pp, indirect 0, unverified 0; useful flips 1 no-to-yes, 2 yes-to-no |
| Unverified share / not_called share | 85.4% / 80.2% |
| Reason mix | handle_unresolved 77, no_path_within_3_hops 4, no_lateral_relation 1 |
| Hub-inflation share (in-sample proxy) | 4/13 strong (30.8%), top-decile node "PWS Value Proposition" (4) |
| Provenance-routed strong / diversity | 0 / 5 distinct interior nodes over 13 strong (0.385) |
| Direction marked right (blind) | 16/96 (16.7%); by phrase: meaning 9/75, shared-words 7/21 |
| False friends per tier (direction marked wrong / shown) | strong 0/0, indirect 0/0, unverified 1/3; meaning bridges shown 3 of 4 |
| Already known by tier | strong 7 of 13, indirect 0 of 1, unverified 38 of 82 |
| Per direction (D-47) | "same meaning in different words" 41/75 (54.7%); "same words with different meaning" 2/21 (9.5%); intervals do not overlap |
| Per producer | hsi 27/47 (57.4%), rs 16/49 (32.7%) |
| Theo find_connections latency | p50 1580 ms, p95 1761 ms (n 165, nearest rank) |

## Task Commits

1. **Task 1** - `c06156693` data(355-25): stamps for the judged fixture pairings via one live Theo capture (HIPS-04, HIPS-07) (earlier session)
2. **Task 2** - `0ded3bef1` docs(355-25): navigator as-shown sitting-2 judgments
3. **Task 3** - `4403ee3db` docs(355-25): first human-judged hit rate recorded (HIPS-07)

Git order proven in the test: judgments.json's adding commit is an ancestor of stamps.json's, which is an ancestor of judgments-stamped.json's.

## Deviations from Plan

### Sitting-2 conduct (recorded, not auto-fixed)

**1. Sitting 2 taken in the same session as sitting 1.** The plan asks for a later sitting; the navigator chose "now, same session" at 19:36 local. Disclosed in `355-VERIFICATION.md`; it bears on the stamp-influence gap only, never on the blind rates.

**2. 91 of 96 sitting-2 items were labeled in chat, not in the terminal CLI.** Items 1-5 were labeled in the CLI; the other 91 were labeled blind by the navigator in chat (session jsagi-7b, 2026-09-24/25). The orchestrator rendered the same whitelisted display fields (room, a_excerpt, b_excerpt, direction_phrase, stamp_lines) in the CLI's own seeded order (the session file's order_seed) and wrote the navigator's y/n answers into the session file keyed by pair id; those entries carry `via: "chat-sitting"` and `ms: null`. In the first chat batch of 10, two B excerpts were shortened to a back-reference to an identical earlier excerpt and a few excerpts were lightly condensed; all later batches were verbatim. No hidden field (boundary_tag, planted-case data) was ever shown. The record's `labelers.sitting_2` carries the counts (via_cli 5, via_chat_sitting 91, untimed 91), and the section's Disclosed limitations states all of this.

**3. Plan's Task 2 inline verify names `j.judgments`.** The emitted `judgments-stamped.json` keys its entries under `items` (the same shape as sitting 1 and the shape `joinJudgments` and `label-355-gold.cjs emit` use). Verified with `items` (exit 0); the data was not renamed. Same stale key as 355-24 recorded.

### Auto-fixed Issues

**4. [Rule 3 - Blocking] The record test's absent-record leg had to change.** `tests/test-355-hit-rate-record.cjs` asserted the record did not exist and `--check` returned 77, which the plan's own Task 3 turns false. The 77 contract is now proved against an injected absent path (`checkRecord({recordPath})`), and present-record legs were added (exact recompute, n and Wilson on every rate, >= 20 per room, section current against a temp copy, banned-claim and em-dash scans, git order). No acceptance criterion was loosened. Commit `4403ee3db`.

**5. [Rule 1 - Bug] False-friend count ignored the direction mark.** 355-24's `computeRates` counted every shown planted false friend; the plan defines the count as those whose `direction_ok` was false. Fixed, with `false_friends_shown_by_tier` added beside it and a test leg. Commit `4403ee3db`.

## Navigator remarks carried

- (a) The ~80 rejected direction labels (80 blind, 81 as shown) had no "neither category fits" option, so the cause of the mismatch (classifier, export, judging consistency or the two-phrase definition) is not established. Open question in `355-VERIFICATION.md`; new entry in `deferred-items.md` with the follow-up (review the rejected labels under a third option).
- (b) A fourth research-type fixture room with planted known transfers so recall can be measured (ruling pending). Already in `deferred-items.md` from 355-24; now also an open question in `355-VERIFICATION.md`.

## Known Stubs

None.

## Issues Encountered

- `tests/run-all-355.sh` does not list `tests/test-355-hit-rate-record.cjs`; left as is (not this plan's file). 355-27 may register it at close.

## Next Phase Readiness

- 355-27 can read every T-3 figure from `tests/fixtures/355-rooms/hit-rate-record.json` (counts and buckets only). Nothing here blocks 27.
- The D-47 per-direction evidence is lopsided on these rooms (shared-words pairs 2/21 useful against 41/75), for the next engine phase's discussion.

## Self-Check: PASSED

- FOUND: tests/fixtures/355-rooms/judgments-stamped.json, tests/fixtures/355-rooms/hit-rate-record.json, 355-VERIFICATION.md, labeling-session-pairings-stamped.json
- FOUND commits: c06156693, 0ded3bef1, 4403ee3db (all ancestors of HEAD)
- `node scripts/measure-355-hit-rate.cjs --check` exit 0; `node tests/test-355-hit-rate-record.cjs` 93/0, no SKIP; acceptance greps: heading count 1, banned-claim count 0, per-room n >= 20
