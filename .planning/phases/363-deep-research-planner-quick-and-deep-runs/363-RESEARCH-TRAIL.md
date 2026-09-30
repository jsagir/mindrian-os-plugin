# Phase 363 research trail: close-out draft and routing

Status: DRAFT. Nothing in this file has been written to any room. The navigator approves the routing
below first (nugget routing table rule, CLAUDE.md Dev-Research Compositing). On "approved" or "approved
with edits" the entry text (everything after the `ENTRY BEGINS` marker, not this header and not the
Routing table) is filed to the first destination and copied byte-identical to the second. On "hold"
nothing is filed.

## Routing

| # | Destination | What is filed there | Why |
|---|-------------|---------------------|-----|
| 1 | `~/MindrianRooms/rethinking-mindrianos/research/2026-10-01-deep-research-planner-363-close-out.md` | The close-out entry below: what Phase 363 built, what the D-06 review and the acceptance found, the measured numbers, what was learned, what stays open. Cross-linked to the phase files and to the discuss-trail entry. | The durable reasoning trail for a phase that touches MindrianOS's own architecture (the standing consultant room). The discuss-phase entry `2026-09-29-deep-research-planner-oss-learnings-and-pws-question-agents.md` already lives there; this is its other half, the result. |
| 2 | `~/MindrianRooms/mindrianOS/research/2026-10-01-deep-research-planner-363-close-out.md` (byte-identical mirror of row 1, checked with `cmp`) | The same entry, unchanged. | Source-of-record mirror, the same two-home rule the discuss entry followed (CLAUDE.md Dev-Research Compositing: same finding, two homes, cross-linked). |

Not routed (stays in the dev repo only): `363-FOLLOW-ONS.md`, `363-ACCEPTANCE.md`, `363-D06-REVIEW.md`, the
`REQUIREMENTS.md` Measured lines, the SEED-098 reuse contract. They are the executable decisions; the room gets
the reasoning. No room content from a user room is in the entry (the fixture rooms are synthetic and the
entry quotes none of their content). No individual is named: the navigator is "the navigator", and the source
paper's author and the reviewers appear only as roles.

Commit plan after approval: one commit in the home-directory repository, only those two paths
(`git -C /home/jsagi commit --only -- <the two paths>`), message "rethinking-mindrianos: file Phase 363
close-out research trail (mirrored to MindrianOS/research)".

<!-- ENTRY BEGINS -->
---
methodology: research
title: "Phase 363 close-out: the deep research planner is built, what the human check and the acceptance found, and what stays open"
created: 2026-10-01
status: active
room_section: research
informs: "dev/MindrianOS-Plugin Phase 363 (363-CONTEXT.md, 363-ACCEPTANCE.md, 363-D06-REVIEW.md, 363-FOLLOW-ONS.md); hands the engine to Phase 364 (SEED-098)"
related: 2026-09-29-deep-research-planner-oss-learnings-and-pws-question-agents.md
sources: "the 22 plan summaries of Phase 363; tests/run-all-363.sh final line; scripts/doctor.cjs --acceptance; 363-D06-REVIEW.md navigator verdict; offline OpenAlex replay measurements in 363-ACCEPTANCE.md"
---

# Phase 363 close-out (2026-10-01)

## Governing thought

The planner is finished and on `main`: a research run now starts with a plan the navigator can read and
approve, searches only with audited strings under a grant, and files only on a yes. What is not finished is
proof against the real internet. Every measurement below is offline, and the two gaps that matter most
(the live smoke never ran, and a real room never hands the ambient branch a search term) are exactly the
kind an offline test cannot see. We say so plainly, because a green board that hides them would be the
false success this project keeps watching for.

## What was built, in plain words

Before this phase a research command fetched what a model felt like asking. Now the commands that already
know how to ask good questions (unknowns, root cause, six hats, diffusion, whitespace) write a question set,
and one engine turns it into a plan shaped like a Minto pyramid: a governing question, a MECE set of
branches, and leaves that each carry a falsifier, the thing that would prove the leaf wrong. The plan shows
the questions the navigator did not ask, and the limiters the navigator did not name. If no limiter can be
named, it is a wish and does not run.

- **Two speeds.** A quick run is one pass: at most 3 audited searches, the top 5 rows, one answer line, and a
  verdict the code computes (settled, thin, contested, gap-confirmed, unresolved). A provider failure always
  wins the verdict, so a failed fetch can never read as "nothing exists". A thin or contested quick card
  offers one thing only: "run deep on this?". A deep run is a controller: lanes, a second round with halved
  breadth, a mandatory counterevidence pass, typed stop reasons, and an honest synthesis that names every
  branch it could not resolve.
- **Consent is explicit.** A standing grant (approved once, expiring in 30 days, first scope OpenAlex and the
  whitespace query family) and a per-run grant. Every executed query is checked against a grant before it is
  fetched, and every query is written to a room-local, append-only audit ledger. A grant lets the machine
  fetch; it never lets it file.
- **Filing is a basket.** On the navigator's yes: a run home under `research/`, open-question nodes, evidence
  claims landing as `proposed` (a human confirms), contradictions kept as CONTRADICTS edges, discarded paths
  with their reasons, the pyramid rolled up into REASONING.md, and opportunities written as proposed nodes.
- **The research perspective (D-18) is the new part.** The planner does what Scientific Roadmapping does:
  a tension, a quantified goal with a falsifier, a rung, a three-role forum written solo and kept polyvocal,
  MECE paths, every limiter sorted "physics" or "assumed", assumed limiters rewritten as research questions,
  and a catalytic ranking by downstream unlock chains. It is exported under a reuse contract, so Phase 364
  (SEED-098) reuses it and builds no second engine. The diffusion lens (D-19) is chosen by a local rule and
  never sent to Theo.
- **One runner, three surfaces.** `/mos:research` is the only thing that runs plans. Claude Code runs quick
  and deep. Desktop and Cowork get quick runs, plans, grants and filing through the `research_run` tool, and
  say honestly that a deep run executes in Claude Code. Zero new dependencies.

## What the two checks found

**The human check (D-06) passed, with the limits disclosed.** The navigator ruled PASS on 2026-10-01 on the
`/mos:map-unknowns` plan, at plan level, with no per-leaf scores, so the written rubric's seven criteria are
not individually recorded. Disclosed before the verdict: the executor played both Larry and the navigator (no
live person), the question set came from a synthetic fixture room, the ranked-by line had printed
"[object Object]" at review time (fixed since), and one leaf (civil and defense crossing, for hospital water)
reads as a stretch.

**The offline acceptance passed in both modes.** The Whitespace plus OpenAlex slice ran through the real CLI,
the MCP door and the ambient branch on recorded replay fixtures: 14 whitespace checks, 7 diffusion checks and a
20-check Part 8 sweep. The sweep plants a marker and a fake key and finds neither in any argument list, log,
telemetry record, cache key, Theo call or ledger; a scratch mutation that put the marker in a search term
made five sweep legs fail, so the sweep can fail. The full phase gate ends `PASSED=43 FAILED=0 SKIPPED=1
KNOWN=10` (the one skip is the live smoke, the ten KNOWN are old reds outside this phase), and the acceptance
roll-up reads 22 of 22.

**The numbers, and what they do not mean.** Offline, with no network time: a quick CLI call took about 100 to
240 ms, a whole whitespace deep loop about 1.2 to 1.6 s. The engine is not the slow part. A whitespace deep
run used 3 of its 16 searches and stopped on saturation; a Scientific Roadmapping deep run used 15 of 16 and
stopped on the cap, so the cap of 16 binds for one and not the other. All 14 floor rows stay disclosed,
because an offline replay cannot justify moving a default. There is no live latency, no live result count and
no live budget, because the live smoke was not run.

## What we learned

1. **A green offline board is blind to the room's real shape.** The ambient branch passed its acceptance
   because the fixture room supplied a search term. Production `whitespace-results.json` has no such term, so
   on a real room the branch answers "context insufficient" and sends nothing. We pinned the real shape with a
   test (W9b) so it cannot go quiet, and wrote the sidecar design as the fix. The general rule: when a fixture
   adds a field production does not have, the test proves the fixture, not the product.
2. **A test fixture that is kinder than the producer hides bugs a person finds in one glance.** The plan card
   printed "[object Object]" because the ranking is a list of objects from the builder and a list of plain
   ids after a deep re-rank, while the test used plain ids. The same split broke `drop_path`. The fix was one
   accessor that reads both shapes. Only the human review saw it.
3. **Acceptance found a real bug the unit tests could not.** A researcher room gave a lite whitespace plan the
   Scientific Roadmapping engine with no limiters, so its deep run had no lanes. A leg written red first, then
   a one-condition fix.
4. **A guard that fires on one template is not a rule.** The "no limiter means a wish" gate runs only for the
   `scientific-roadmapping` template. A deep `/mos:map-unknowns` plan with no limiter and an empty ranking is
   `ready` today. Whether the gate should cover every template that carries a perspective is an open decision
   for the navigator, not something the close quietly changed.
5. **A warning that fires on most leaves stops being read.** The restatement check flagged 8 of 11 leaves in
   the review, because leaves about one domain share words with the question about that domain. Keep, tighten
   or drop is a design call.
6. **A caveat you write next to a verdict is worth more than a cleaner verdict.** The review sheet kept its
   scoring blank rather than invent scores the navigator did not give, and the requirement row for the live
   smoke was re-opened rather than left ticked on the strength of a test that exits 77.
7. **A second engine was avoided by exporting the first.** `describeEngine()` with an api version is the
   whole reuse contract. Phase 364 binds to that number, and a breaking change has to bump it.

## What stays open

Recorded with reasons in `363-FOLLOW-ONS.md` (Part A is what the close found, Part B what the plan named):
run the live smoke once when the navigator allows live spend and re-decide the floors from it; the `zone_term`
sidecar (a quick task); research cards sitting flat in `opportunity-bank/` with funder, program and deadline
null, which any consumer that scores every listed item would mistake for funding calls; the restatement
heuristic; the wish gate; the Theo 20.2 items (`not_scored` must read as `not_ready`, and the doctor stamp
should key on `recompute_run_id`); the traceability count (stated 418, row census 429, a gap of 11 equal to
the BIND360 family); migrating dominant-designs onto the engine; more commands; Desktop and Cowork deep
execution; journal-quality lists; Jev passage filtering. The work is on `main` and NOT live for any user
until a release is cut and users update.

## Cross-links

- Phase context and decisions: `dev/MindrianOS-Plugin/.planning/phases/363-deep-research-planner-quick-and-deep-runs/363-CONTEXT.md`
- Acceptance: `.../363-ACCEPTANCE.md`
- The human check: `.../363-D06-REVIEW.md` (rubric `363-D06-RUBRIC.md`)
- Carry-forwards: `.../363-FOLLOW-ONS.md`
- Reuse contract for the next phase: `.planning/seeds/SEED-098-scientific-roadmapping-command-through-theo.md`
- The discuss-phase half of this trail: `2026-09-29-deep-research-planner-oss-learnings-and-pws-question-agents.md`
