---
phase: 363-deep-research-planner-quick-and-deep-runs
plan: 22
subsystem: phase-close
tags: [phase-close, requirements, canon-phase-map, open-handoffs, seed-098, research-trail, dev-research-compositing, live-smoke]

requires:
  - phase: 363-20
    provides: acceptance slice, Part 8 sweep, the opt-in live smoke
  - phase: 363-21
    provides: D-06 navigator verdict PASS
provides:
  - all 20 DRP363 rows ticked with Measured proof
  - Phase 363 rows in CANON-PHASE-MAP (Parts 3, 6, 7, 8, 9, 11, 12) and the OPEN-HANDOFFS close entry
  - SEED-098 promoted to Phase 364 with the D-18 reuse contract
  - 363-FOLLOW-ONS.md, 363-RESEARCH-TRAIL.md, the live smoke result in 363-ACCEPTANCE.md
  - the research trail filed in two homes, byte-identical
affects: [364]

key-files:
  created:
    - .planning/phases/363-deep-research-planner-quick-and-deep-runs/363-FOLLOW-ONS.md
    - .planning/phases/363-deep-research-planner-quick-and-deep-runs/363-RESEARCH-TRAIL.md
    - ~/MindrianRooms/rethinking-mindrianos/research/2026-10-01-deep-research-planner-363-close-out.md
    - ~/MindrianRooms/mindrianOS/research/2026-10-01-deep-research-planner-363-close-out.md
  modified:
    - .planning/REQUIREMENTS.md
    - docs/CANON-PHASE-MAP.md
    - docs/OPEN-HANDOFFS.md
    - .planning/seeds/SEED-098-scientific-roadmapping-command-through-theo.md
    - .planning/phases/363-deep-research-planner-quick-and-deep-runs/363-ACCEPTANCE.md
    - .planning/STATE.md
    - .planning/ROADMAP.md

key-decisions:
  - "No floor moved after the live run: one run of generic phrases is too thin, all 14 rows stay disclosed; GAP_COUNT_FLOOR is flagged for a labelled sample because the floor of 3 decided the live verdict (exact 0, synonym cover 5, so thin; a floor of 5 would read gap-confirmed)."
  - "Navigator ruling, recorded not implemented: the wish gate applies to every deep plan (no nameable limiter means a wish, regardless of template_id); a /gsd-quick with a RED leg first."
  - "Research trail filed as approved (routing approved with no edits); the entry text was updated for two facts that changed after the draft (live smoke ran and passed; wish-gate ruling) before filing."

requirements-completed: [DRP363-01, DRP363-02, DRP363-03, DRP363-04, DRP363-05, DRP363-06, DRP363-07, DRP363-08, DRP363-09, DRP363-10, DRP363-11, DRP363-12, DRP363-13, DRP363-14, DRP363-15, DRP363-16, DRP363-17, DRP363-18, DRP363-19, DRP363-20]

completed: 2026-10-01
---

# Phase 363 Plan 22: Phase close Summary

**Phase 363 is closed with all 20 DRP363 rows ticked on measured proof (phase gate PASSED=43 FAILED=0, doctor 22/22, live OpenAlex smoke passed once), the carry-forwards and the SEED-098 reuse contract recorded, and the research trail filed byte-identical in both homes after the navigator approved its routing.**

PLAN_BASE: `ae358c931b0f22642c4824f9c458af5c77a30551`

## Commits (each confirmed an ancestor of HEAD)

| Step | Commit | Paths |
|------|--------|-------|
| DRP363 rows closed | 777c1eb87 | .planning/REQUIREMENTS.md |
| Canon map rows, close handoff, SEED-098 reuse contract | 6d7da83e6 | docs/CANON-PHASE-MAP.md, docs/OPEN-HANDOFFS.md, SEED-098 |
| Follow-ons and trail draft | 70e87e6f7 | 363-FOLLOW-ONS.md, 363-RESEARCH-TRAIL.md |
| STATE hand-edit at the checkpoint | 53c0314cd | .planning/STATE.md |
| Live smoke result, floors kept, DRP363-16 re-ticked | 2c0096c7b | REQUIREMENTS.md, 363-ACCEPTANCE.md |
| Live smoke and wish-gate ruling in follow-ons, handoff, trail | c39cb60ff | OPEN-HANDOFFS.md, 363-FOLLOW-ONS.md, 363-RESEARCH-TRAIL.md |
| Research trail filed in both homes (home repo) | a829390aa | the two room entries |

The close-out commit for this SUMMARY, ROADMAP and STATE follows this file.

## Gate results

- `bash tests/run-all-363.sh` (background, final line read): `PASSED=43 FAILED=0 SKIPPED=1 KNOWN=10`, exit 0. The one SKIPPED leg is the opt-in live smoke inside the aggregator (run by hand, see below). The 10 KNOWN are the pre-existing reds with their signatures matched. The em-dash guard passed. The aggregator already wired every 363 test, so it was not edited.
- `node scripts/doctor.cjs --acceptance`: 22/22 (before and after the close commits), the same as 363-01's recorded best and 363-20's last reading.
- `node scripts/check-cirs-declaration.cjs --check` over the 22 plans: OK.
- Live smoke: `MOS_363_LIVE=1 node tests/test-363-live-smoke.cjs` run once at close by the orchestrator after the navigator approved live spend: exit 0, PASS 11, FAIL 0, keyless. Quick run 3 searches, verdict thin, 3.2 s; deep run 3 searches, stop saturation, 2 unresolved branches, 1.0 s; per-query latency 278 to 1586 ms; 6 searches at $0.001; lowest remaining budget $0.094. LIVE_METRICS is verbatim in 363-ACCEPTANCE.md.

## DRP363 rows: 20 of 20 ticked

All 20 carry a `**Measured:**` line naming the tests or artifacts that prove them. DRP363-05 (audit ledger) was delivered by 363-09 and left unticked; it was verified by re-running `test-363-audit-ledger` (A1-A5) and sweep S6, then ticked. DRP363-16 was first reopened (the live smoke had not run), then re-ticked after the live run with a Measured line citing it. No other family's text changed. The traceability mismatch is recorded, not fixed: stated 418, row census 429, a gap of 11 equal to the BIND360 family.

## Doctor comparison

363-01 recorded a run that failed only `verify-release-clean-tree` (uncommitted peer work in the shared tree). At close the run is 22/22 with no failing point, so there is no new failing point.

## Floors after the live run

No change, all 14 rows stay `disclosed`. The two time budgets were used at about 5 and 0.1 percent by the live run, which says they are generous for a whitespace run, not that they should shrink. `GAP_COUNT_FLOOR` (3) is the one to revisit with a labelled sample.

## Navigator rulings at the close

1. Routing: approved, no edits. Filed and mirrored as planned.
2. Live smoke: approved live spend; run and recorded.
3. Wish gate: "Apply it to every deep plan." Recorded in 363-FOLLOW-ONS.md A5 as a navigator-ruled follow-on, to be built through `/gsd-quick` with a RED leg first. Not implemented in this plan.

## Filing outcome

Both room entries written from the approved draft and compared with `cmp`: identical (CMP_IDENTICAL). One home-repo commit `a829390aa`, `--only` on exactly the two paths, an ancestor of HEAD in `/home/jsagi`. The home repo's other dirty files were not staged. Paths:
`~/MindrianRooms/rethinking-mindrianos/research/2026-10-01-deep-research-planner-363-close-out.md` and `~/MindrianRooms/mindrianOS/research/2026-10-01-deep-research-planner-363-close-out.md`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Research-trail entry text was stale before filing**
- **Found during:** Task 3, after the coordinator relayed the live-smoke result and the wish-gate ruling.
- **Issue:** the approved draft said the live smoke had never run and called the wish gate an open decision; filing it unchanged would have put two false statements in the durable record.
- **Fix:** edited the entry text in 363-RESEARCH-TRAIL.md for those two facts only (governing thought, numbers paragraph, learned point 4 and 6, what stays open), committed it (c39cb60ff), then filed. The routing table and destinations were not changed. The navigator approved the routing without edits; the content change is a factual update, flagged here.
- **Commit:** c39cb60ff

**2. [Interpretation] STATE.md and ROADMAP.md edited**
- The plan says never to write STATE.md or ROADMAP.md; the coordinator explicitly asked for hand-edits to both at the close (no gsd-tools state writer was run).

No auth gates.

## Known Stubs

None. Documentation and records only.

## Threat Flags

None. No network surface added. The only egress at close was the approved live smoke, run by the orchestrator, which sends generic fixture phrases keyless.

## Self-Check: PASSED

Verified present: the two room entries (identical), 363-FOLLOW-ONS.md, 363-RESEARCH-TRAIL.md, this file. Commits 777c1eb87, 6d7da83e6, 70e87e6f7, 53c0314cd, 2c0096c7b, c39cb60ff and home-repo a829390aa are ancestors of HEAD in their repositories. No em-dash or en-dash in any file written.
