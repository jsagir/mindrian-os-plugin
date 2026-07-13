---
phase: 219-opportunity-follow-through-harvest-formula-explored-stage-de
plan: 06
subsystem: live-verification
tags: [d-12-live-checkpoint, ador-ip-test, gap-1, gap-2, navigator-sign-off, part8-sweep-false-positive]

# Dependency graph
requires:
  - phase: 219-01
    provides: typed-opportunity writer + banking hook (the substrate this plan proved live)
  - phase: 219-02
    provides: FTS5 bi-modal degrade + metadata slice (proved live, no crash on the Windows-class path)
  - phase: 219-03
    provides: SENS-14 harvest sensor (proved live post-GAP-2 fix)
  - phase: 219-04
    provides: qualification card (proved live - real Qualify+file on a real candidate)
  - phase: 219-05
    provides: explore chain + Minto artifact writer + D-16 corpus contract (proved live - the filed artifact)
provides:
  - "219-VERIFICATION.md: the complete live-evidence record (extraction, banking, harvest, qualify, explore) plus the recorded navigator sign-off (Section 3.4)"
  - "Two real structural gaps found, root-caused, and fixed (not routed around) - filed in .planning/debug/219-live-checkpoint-two-structural-gaps.md, both RESOLVED"
  - "One false-positive test fixed (Part 8 sweep, PART8-SAFE-HASH documented exception)"
affects: [219-07 release readiness, 220 (shares the fixed eureka/harvest substrate), 221 (D-11's spend_limit_exceeded is a sibling self-validated fixture to this plan's discipline)]

tech-stack:
  added: []
  patterns:
    - "The D-12 mandatory live checkpoint did exactly its job a third and fourth time: fixture-green passed while the live pipeline banked 0 and harvested 0, for two genuine structural reasons neither unit suite could see"
    - "Navigator sign-off recorded via a fired AskUserQuestion Decision Gate with the full artifact content read verbatim into the conversation - never summarized, never auto-approved"
---

## What this plan proved (live, on ador-ip-test, re-verified independently at every step)

The full REQ-1..REQ-4 chain, end to end, on real production code, on a real room:
extraction + metadata (955 nodes/1545 edges) -> eureka statement generation (414,505
pairs, 25 statements) -> critic resolution (25 genuinely resolved, not fabricated) ->
banking (25 opportunity nodes + 50 DERIVED_FROM edges) -> harvest (50 candidates, real
COMPETES_WITH/USES_COMPONENT/SUPPLIES_TO bridges) -> qualify (BioFire x Cepheid,
[Qualify+file] via navigation.cjs) -> [Explore] -> a real, cited, nested Minto artifact
in opportunity-bank/ -> navigator quality sign-off: **APPROVED**.

## The two gaps this plan found (the reason it exists)

1. **GAP-1** (eureka banking structurally unsatisfiable on any live run - the real
   Phase 212 critic's async stageA could never be awaited by the sync emitter).
   Root-caused, fixed with a bounded async resolution pass, live-verified (25
   genuinely resolved verdicts, 0 passing under the strict predicate - the critic
   correctly rejecting low-quality statements, not a defect).
2. **GAP-2** (the harvest bridge lane's edge vocabulary predated 218's extraction
   vocabulary - zero overlap with any live room). Fixed additively, live-verified
   (0 -> 25, then 0 -> 50 candidates after GAP-1 added more banked statements).

Both are filed, root-caused, and RESOLVED in `.planning/debug/219-live-checkpoint-two-structural-gaps.md`.

## The navigator checkpoint (Section 3.4 of 219-VERIFICATION.md)

The full explored artifact (`opportunity-bank/unknown/biofire-x-cepheid/biofire-x-cepheid.md`)
was read verbatim into the conversation - governing thought, SCQA, 5 real citations
(BioFire, Cepheid, WHO, bioMerieux), diffusion/timing read, analogies - alongside the
honest caveat that the underlying eureka statements the critic evaluated were weak,
and that this specific artifact came from the bridge lane (real entities, real edge),
not from those statements. A Decision Gate was fired (not a prose question, not an
auto-approval). **Verdict: Approved - real signal.**

## Third finding, fixed directly (not this plan's scope, but surfaced by it)

Truth 6 (the Part 8 five-tripwire sweep) went RED from a sibling 220-03 file
(`sensor-url-ingest.cjs`'s legitimate URL-handle sha256 hash) tripping an overly
blunt sweep regex. Fixed directly this session: a documented `PART8-SAFE-HASH`
marker exception, narrow and reviewed, verified green (commit `051221a0`).

## must_have scorecard: 8/8

All eight truths in 219-06-PLAN.md's frontmatter are now met, evidenced in
219-VERIFICATION.md Sections 1-3.4.

## Commits (this closing pass)

| Commit | Type | What |
| --- | --- | --- |
| `48d93665` | docs | 219-06 live-run evidence + honest BLOCKED trace (prior attempt, both gaps traced) |
| (GAP-2 fix, GAP-1 fix, 219-06 re-run commits - see the RCA doc for the full list) | | |
| `051221a0` | fix | Part 8 sweep PART8-SAFE-HASH documented exception |
| (this commit) | docs | 219-VERIFICATION.md Section 3.4 navigator sign-off + this SUMMARY |

## Self-Check: PASSED

219-VERIFICATION.md Section 3.4 recorded with the real Decision Gate verdict; the
explored artifact verified present on disk and matches what was shown to the
navigator; the Part 8 sweep fix verified green (`node tests/test-sensors-part8-sweep.cjs`
exit 0); `bash tests/run-all-219.sh` and `bash tests/run-all-220.sh` both green.
