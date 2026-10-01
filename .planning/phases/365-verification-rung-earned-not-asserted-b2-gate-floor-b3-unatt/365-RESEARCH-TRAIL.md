# Phase 365 research trail: draft entry and routing

Status: DRAFT, drafted by plan 365-16. Nothing is filed to any room by this plan. Plan 365-17 files it only after the navigator approves the Routing table at the bottom (CLAUDE.md Dev-Research Compositing: the dev repo gets the executable decision in the phase CONTEXT, the room gets the evidence and reasoning behind it, same finding in two homes, cross-linked).

## Entry text (to be filed verbatim)

````markdown
---
methodology: research
title: "Phase 365 close-out: verification standing is earned from edges, not asserted by the filer; what shipped, what the baseline showed, and what waits for the ladder"
created: 2026-10-01
status: active
room_section: research
informs: "dev/MindrianOS-Plugin Phase 365 (365-CONTEXT.md, 365-RESEARCH.md, 365-BASELINE.md, 365-D20-AUDIT.md, 365-FOLLOW-ONS.md); hands the blocked remainder to Phase 365.1 (365.1-INPUT.md)"
related: 2026-10-01-deep-research-planner-363-close-out.md
sources: "the plan summaries and the repair summary of Phase 365; tests/run-all-365.sh final line; scripts/doctor.cjs --acceptance; 365-CLOSE-GATE.md; the navigator's D-20 ruling"
---

# Phase 365 close-out (2026-10-01)

## Governing thought

A room full of approved claims with provenance edges looks verified. If those claims were only checked by
asking a model, the room has quietly lent a model's agreement the standing of a source it never consulted,
and that is worse than a chat window, because it looks like rigor. The fix is not a score. It is a standing
the room earns from its own edges and states in plain words at the moment a person approves. That is built
and on `main`. The part that needs the exact rungs to be right (a rung derived from edges, a record of a
person with standing, the split of the "no support" scan, the migration of old records) waits for the paper
author to ratify the ladder, and is fenced so it cannot land early.

## Why the phase existed

The paper author's papers name one failure above all: checking a claim by asking a model feels like
verification and never leaves the loop. Before this phase the plugin let the person who filed a check declare
its rung, let any approve land a claim at confirmed, and let an unattended step (a chain, or a research run
the room starts by itself) do anything its posture tag allowed. The audit of 2026-10-01 measured that gap:
two claims with byte-identical text, one checked against a located primary source and one by asking a model,
read back as identical rows.

## What the research found (five findings that shaped the plan)

1. **Two claim-card doors, not one.** A claim approval card is minted by the gate tool and also by the
   meeting tool's file-meeting path. A why-line built in only one would never show on the meeting cards, which
   are the main live path. One composer now feeds both.
2. **The normalizer dropped unknown fields.** The card normalizer kept only the fields it knew, so a why-line
   attached to a card vanished on the way to the renderer. The card gained one new optional field and the three
   renderer rungs print it.
3. **Four existing suites pinned approve-to-confirmed.** Turning the floor on by default (so the existing rooms
   are covered, not only new ones) flipped four suites red. Each was updated with a written reason, never
   loosened.
4. **The gate ledger is per process, and the ambient research child is detached.** A room-started research run
   runs in a separate process, so it cannot mint a live gate. It queues a card; the next research touchpoint
   renders it as a gate through the normal ladder (ruling D-26).
5. **Fail-open versus fail-shut.** The irreversibility ledger that inspired the never-do check fails open on a
   missing or bad file. A never-do list that fails open is a list that silently stops working, so this one
   fails shut: a missing file is an empty list, but an unreadable file halts every unattended step.

## Two rulings

- **D-08 resolved as D-20 (needs_evidence to confirmed).** A held claim could only move to `validated`, which
  under the truth-state contract means evidence is attached. A claim released by lowering the floor has no such
  evidence. We proposed one additive transition `needs_evidence -> confirmed`, human-only through the existing
  guard. The pre-edit audit (`365-D20-AUDIT.md`) found no canon rule that requires an Appendix D entry and named
  the widened reach (the non-gate approve paths). The navigator ruled "proceed (Recommended)".
- **The side door.** Because the floor lives at the gate and not inside the shared confirm function (which
  other callers use and which had to stay unchanged), a few non-gate human approve paths can release a held
  claim without a floor check. It is recorded, not decided: route them through the same why-line, or accept
  the bypass in writing.

## What shipped, in plain words

- **The floor.** The approval card says what the claim was checked against before the click. Below the room's
  floor (default: a source document; one line in ROOM.md changes it) approving files the claim as "needs
  evidence", with no "confirm anyway" button. Every claim approve leaves a record of the floor in force, so a
  later hand edit that lowers it leaves a trace.
- **The never-do list.** A small fail-shut list in the room. The chain runner and the room-started research
  runner stop before any request when a step names something on it. It grows only when the navigator approves a
  "Reject and never do this" card, and every surface says it catches only what has been named.
- **The pulled portrait.** One request shows the room as counts in words, each row naming what would move it.
  No score, no percent, no color. Two unsolicited signals only: a decision resting on a model-only claim, and
  checks that stalled for four weeks.
- **The standing words everywhere.** Room home, the graph export and its node panel, the unsupported-claim
  findings and the research preflight gaps all say what a claim was checked against, from one shared words map.

## What the baseline and the measurements showed

- The acceptance tests were written first and failed with six stable signatures at the base. By the close five
  were healed (the byte test at 365-04, the floor and the one-week status at 365-08, the one-week standing at
  365-15). One stays red on purpose, the derived-rung half of the byte test, held by the ladder fence.
- The falsification tests: the missing-five test (gap scans map the record, not the world) and the
  contradiction-without-shared-wording test were FALSIFIED as predicted, both measured with a positive control
  so a zero could not be a dead writer. The remove-the-destination test could not be answered because the next
  move carries no numeric confidence; the active JTBD alone moves the top suggestion. The two-navigators test is
  a written protocol, not run.
- The close gate: the full aggregator ends `PASSED=66 FAILED=0 SKIPPED=0 KNOWN=6`; the five prior-phase suites
  are no redder than the base; the acceptance roll-up fails the same one point as the base (a peer's
  uncommitted file).

## What we learned

1. **The convenient test hides regressions.** The plain aggregator skips the prior-phase suites. Three plans
   shipped regressions only the opt-in block caught, and one needed a repair plan. A phase gate that can be
   green while the regression block is skipped is not a gate; the full run is now the rule for this phase and
   the recommendation is to make it the default.
2. **Putting the rule at the door, not in the shared function, cost a bypass.** The shared confirm function had
   to stay unchanged for its other callers, so the floor sits at the gate. That is honest about where the human
   decision is made and it leaves side doors that have to be named, not hidden.
3. **A provisional word map is the right shape to wait in.** All the wording sits in one place behind a fence,
   so the paper author's ratification is a one-place edit and the tests follow it.
4. **Say what a check proves.** The structural predicate proves a provenance edge exists, not that the source
   was read. We said so in the follow-ons instead of letting a green test imply more.
5. **Fixtures kinder than production hide bugs.** The same lesson as the planner phase: a test seeded with a
   field production does not have proves the fixture. The never-do tests keep control rooms that must fetch, so
   a zero cannot be a dead path.

## What waits on the ratification

Phase 365.1 (blocked on the paper author's ratification of the ladder): the rung derived from edges, a person
record for rung 5 (a canon amendment, Appendix D entry 24 precedent), the split of the unsupported scan by kind
of silence, and the migration of the earlier checking records. The ask is drafted in
`365-LADDER-RATIFICATION-ASK.md`. The discipline-control experiment (Mindrian against a disciplined person with a
chat window and a notebook) needs the derived rung. The work is on `main` and NOT live for any user until a
release is cut and users update; the Theo side mirrors one changed description only after that release.

## Cross-links

- Phase context and decisions: `dev/MindrianOS-Plugin/.planning/phases/365-verification-rung-earned-not-asserted-b2-gate-floor-b3-unatt/365-CONTEXT.md`
- Research: `.../365-RESEARCH.md`
- Baseline and falsification protocol: `.../365-BASELINE.md`
- The D-20 audit: `.../365-D20-AUDIT.md`
- The gate run: `.../365-CLOSE-GATE.md`
- Carry-forwards: `.../365-FOLLOW-ONS.md`
- The blocked remainder: `.planning/phases/365.1-edge-derived-rung-after-ladder-ratification/365.1-INPUT.md`
````

## Routing

For the navigator's approval in 365-17. Nothing is filed until the navigator answers. The entry is a nugget with two homes; the second home has two precedents, so one is picked at the checkpoint.

| # | Destination | What goes there | Why | Precedent |
|---|-------------|-----------------|-----|-----------|
| 1 | `~/MindrianRooms/rethinking-mindrianos/research/2026-10-01-verification-rung-365-close-out.md` | the entry text above, verbatim | the durable reasoning trail for the dev room (the standing MindrianOS-dev consultant room) | the Phase 363 close-out entry in the same folder (commit `a829390aa` filed it) |
| 2a | `~/MindrianRooms/mindrianOS/research/2026-10-01-verification-rung-365-close-out.md` | the same file, mirrored | source-of-record mirror, the Phase 363 precedent | `a829390aa` mirrored to `~/MindrianRooms/mindrianOS/research/` |
| 2b | `~/MindrianOS/research/2026-10-01-verification-rung-365-close-out.md` | the same file, mirrored | source-of-record mirror, the path the later 2026-10-01 Eureka entry used | `a0d194e8e` mirrored to `~/MindrianOS/research/` instead |

Row 2a and row 2b are alternatives: the navigator picks one at the checkpoint. Row 1 is filed in either case. The cross-link back to the phase is already inside the entry (the Cross-links section); the phase side (`365-CONTEXT.md` and the follow-ons) already carries the executable decision, so no change to the dev repo is needed beyond recording the filed paths in the 365-17 summary.
