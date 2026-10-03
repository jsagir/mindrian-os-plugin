# Phase 364 research trail: close-out draft, routing and cross-session messages

Status: DRAFT, awaiting the navigator. Nothing has been filed to any room and nothing has been sent. On "approved" or
"approved with edits" the entry text (everything after the `ENTRY BEGINS` marker, not this header, not the Routing
table, not the two messages) is filed to destination 1 and copied byte-identical to the chosen mirror. On "hold"
nothing is filed (nugget routing HITL, CLAUDE.md Dev-Research Compositing).

## Routing

| # | Destination | What is filed there | Why |
|---|-------------|---------------------|-----|
| 1 | `~/MindrianRooms/rethinking-mindrianos/research/2026-10-03-scientific-roadmap-364-close-out.md` | The close-out entry below: why Phase 364 existed, what shipped with its commits, the measured numbers, what we learned, what stays open. Cross-linked to the phase files, SEED-098, SEED-106 and the Theo notify doc. | The durable reasoning trail for a phase that touches MindrianOS's own architecture (the standing consultant room). It is the result half of the Phase 363 close-out entry `2026-10-01-deep-research-planner-363-close-out.md`, which handed the engine to this phase. |
| 2 | The mirror, byte-identical to row 1 (checked with `cmp`), the same file name. Navigator picks: **A** `~/MindrianOS/research/` (default; the 2026-10-02 precedent, the last four close-out entries went there) or **B** `~/MindrianRooms/mindrianOS/research/` (the Phase 363 precedent). | The same entry, unchanged. | Source-of-record mirror (CLAUDE.md Dev-Research Compositing: same finding, two homes, cross-linked). |

Not routed (stays in the dev repo only): `364-ACCEPTANCE.md`, `364-FOLLOW-ONS.md`, the `REQUIREMENTS.md` Measured lines,
the Theo notify doc. They are the executable decisions; the room gets the reasoning. No user room content is in the
entry (fixture rooms are synthetic and quoted nowhere). No individual is named: the navigator is "the navigator"; the
Theo side is "the Theo session".

Commit plan after approval: one commit in the home repository, only those two paths
(`git -C /home/jsagi commit --only <p1> <p2>`), message "rethinking-mindrianos: file Phase 364 Scientific Roadmapping
close-out trail (mirrored to <mirror>)". If mirror A is chosen, `<p2>` lives in `/home/jsagi/MindrianOS/research/`
(same home repo); if B, in `/home/jsagi/MindrianRooms/mindrianOS/research/`. Each path is checked for tracked status
before the commit and the commit sha is verified as an ancestor of that repo's HEAD.

<!-- ENTRY BEGINS -->
---
methodology: research
title: "Scientific Roadmapping command, Phase 364 close-out: the command is built and honest, and it waits on Theo to author the steps"
created: 2026-10-03
status: active
room_section: research
informs: "dev/MindrianOS-Plugin Phase 364 (364-CONTEXT.md, 364-ACCEPTANCE.md, 364-FOLLOW-ONS.md, docs/2026-10-03-PHASE-364-THEO-NOTIFY.md); SEED-098; SEED-106"
related: 2026-10-01-deep-research-planner-363-close-out.md
sources: "the 12 plan summaries of Phase 364 (01-11 and 14); tests/run-all-364.sh final line; scripts/doctor.cjs --acceptance; the live smoke of 2026-10-03; the Theo notify doc"
---

# Scientific Roadmapping command, Phase 364 close-out (2026-10-03)

## Governing thought

`/mos:scientific-roadmap` is finished on the plugin side and sits on `main`, and the first thing it tells a user today
is "Theo has not authored this step yet", because Theo still returns an empty label and an empty run-it for all seven
steps. That refusal is the product working as designed: a command that improvised the steps would be the
imitation the project forbids. The work now moves to Theo (one alias row, the seven step texts), and to a release.

## Why the phase existed

SEED-098 asked for a Scientific Roadmapping command that goes through Theo instead of copying the method into the
plugin. The navigator confirmed the direction on 2026-10-02 and ruled the order: the systems pass comes before the
bottleneck steps, Well-Defined is the primary problem type with Ill-Defined secondary, and when Theo has not written
the steps the command refuses rather than fill the gap. Phase 363 had already built the planning engine and
exported it under a reuse contract, so this phase built a door onto that engine, not a second engine.

## What was built, in plain words

A researcher can now open one command and be walked through seven steps of Scientific Roadmapping: name the tension,
set a goal that can be proved wrong, run a systems pass, sort limiters into physics versus assumed, turn assumed
limiters into questions, write hypotheses, and rank what unlocks the most. The command reads the step text from Theo,
asks Theo only for the framework name and the Well-Defined enum, keeps every word of the user's room local, and files
`research-plan/PLAN.md` only on an explicit yes.

| Piece | Commits | What it is |
|-------|---------|-----------|
| Requirements floor and aggregator (364-01) | `a9c075851`, `509ddb38d` | 21 SRM364 rows and `tests/run-all-364.sh` |
| Canon snapshot refresh (364-02) | `365a3d01a`, `8676aaa88` | `data/framework-names.json` now names Scientific Roadmapping with a `theo_stamp`; 410 to 414 names; navigator reviewed the diff |
| Theo step reader, honest refusal, coverage read (364-03) | `4c5477841`, `ae936bf00`, `3c3414bc1`, `a934f84cd` | `sr-steps.cjs`; the singular `refusal` key is read before the shared classifier |
| Entry check and resolver (364-04) | `21bbfa2a1`, `c7a1345e2` | Read-only; room.db and file tree identical before and after |
| The door (364-05) | `4d17523bf`, `b0b5f9d89`, `61e51e95b` | Stage machine with the systems pass before paths and limiters; question set; hypotheses |
| Plan filing (364-06) | `1f4f15803`, `c3e64b7c8`, `354b17606` | `research-plan/PLAN.md` only on an approved selection, through the existing basket |
| Born-wired command surface (364-07) | `890a43a05`, `1d2526a99`, `50b9c4176` | `commands/scientific-roadmap.md`, skill mirror, registries, two curated chains, no recipe |
| MCP reach and ignite offer (364-08) | `31381c8dc`, `18bcdbe5e` | Desktop and Cowork reach through the `methodology` tool; `/mos:ignite` offers it |
| CLI door and end-to-end proof (364-09) | `ee72d9bd4`, `5914238cb`, `d4dfae482`, `f6df816d3`, `e4188996f` | The CLI walk, a Part 8 sweep with a planted marker, an opt-in live smoke |
| Theo notify (364-10) | `3431dfbdf`, `16979d979` | `docs/2026-10-03-PHASE-364-THEO-NOTIFY.md` and the OPEN-HANDOFFS row |
| Phase gate and live smoke (364-11) | `02a230d48`, `f53f346eb`, `11353f59c`, `81bcc920f` | Measured acceptance; the 355 record re-recorded; canon-map rows |
| Compose with 355 and 355.1 (364-14) | `b662ea9f0`, `5df121329`, `3a1c9b660`, `de66c4454`, `c9ef39e7f` | A stamped eureka finding enters at step 6 with its stamp shown verbatim, never upgraded, never scored |

## What was measured

- Own gate: `bash tests/run-all-364.sh` ended `PASSED=61 FAILED=0 SKIPPED=1 KNOWN=3`, exit 0. The one skip is the opt-in
  live smoke (run by hand, see below); the three known reds are old, matched by literal signature, and none is 364's.
- Generators: every `--check` exited 0 (command, connector, harness, orchestration, render coverage, skill mirrors,
  help coverage, framework names, new-surface, CIRS declaration over 14 plans); the shape-declaration advisory lists
  zero lines naming the command.
- Doctor `--acceptance` under a sandboxed HOME: 16 of 22 points passed; all six reds are environment (no install
  state in the sandbox, or a peer's uncommitted files in the shared tree); no failing point names a 364 file.
- Regression: run-all-366 clean; run-all-363 showed one real new failure, caused by this phase (see "What we learned"),
  fixed on the navigator's ruling; the rest were peer-owned or stale signatures.
- Live smoke, one run on 2026-10-03 after the navigator said go: two read-only calls through the guarded brain
  client, `framework_step` for Scientific Roadmapping (3224 ms) and `recommend_chain` for Well-Defined (1731 ms). Result:
  `step_ok:false`, `step_reason:"step_unauthored"`, `step_count:0`, `coverage_status:"uncovered"`. Both handles were
  classified `known_tool_shape` by the real guard. Theo's real answer today is the honest refusal. No room content
  crossed.
- The plugin now holds 114 command files (113 without this one).

## What we learned

1. **A reviewed canon refresh was the price of admission.** The canon snapshot did not know the name Scientific
   Roadmapping, so the Part 8 guard could not allow the read. The fix is the live refresh, never a hand edit, with
   the navigator reading the name diff first. It also added three other names the live graph already carried.
2. **A snapshot refresh has readers nobody listed.** The refresh moved a hash that the Phase 355 hit-rate record
   stores, so that test went red and no 364 leg covered it. The 364-02 reader baseline listed 18 readers and missed
   this one; acceptance found it by comparing against a baseline checkout. The record was re-recorded (only the
   snapshot date and hash moved, no rate). Rule: a plan that refreshes a shared snapshot lists every test that hashes it.
3. **The firing-block stamp keys on `hitl_shape` only.** A command that declares `hitl_stages` is never stamped by
   `stamp-firing-block.cjs`, and the render-coverage gate counts a surface wired when its body names AskUserQuestion
   and its allowed tools grant it. So the command body names AskUserQuestion at every gate. A declared shape and a
   wired gate are two different checks.
4. **Theo's alias table needs a Scientific Roadmapping row.** It has a Hypothesis-Driven Problem Solving row and
   none for this framework, so Theo's sync would record a fail-closed `framework_unresolved` for it. The plugin
   cannot write that row; it hands over the skeleton.
5. **The release now tells Theo, and that is the only channel.** The old repository-dispatch step was retired; the
   release-cut listener (release.sh Step 0.55) calls Theo's release bridge with the version and the sha. The notify
   doc says so, so the Theo session does not wait on a dispatch that never comes.
6. **The command must refuse honestly while the steps are NULL, and prove it.** The refusal text is exact ("Theo
   has not authored this step yet"), the live smoke shows it is what Theo returns today, and the shared
   classifier needed a one-line precedence fix so a singular `refusal` is not mislabelled "no steps in canon".
7. **Composing with the eureka work needed almost no code.** A stamped finding becomes a hypothesis in flight at
   step 6 because the existing resolver already mapped the framework to the command; the new code only carries the
   stamp through, copies named fields (so a score cannot leak), and refuses to move on until each in-flight
   finding is a limiter row or dismissed with a reason.

## What stays open

Recorded with owners and triggers in `364-FOLLOW-ONS.md` (A1 to A17). The load-bearing ones: the Brain router's
`KNOWN_METHODOLOGIES` does not list the command (A1, do it with the next ledger rebuild); the research shape ledger
disagrees with the problem-type ruling (A2); no MCP door files a roadmap plan on Desktop or Cowork (A4, the Tri-Polar
gap); when Theo authors the steps, re-run the live smoke and record an authored payload (A6); and at the release
the listener re-syncs Theo, the canon snapshot needs a fresh stamp, and the website command count moves 113 to 114 (A7).
The command is on `main` and NOT live for any user until a release is cut and users update.

## Cross-links

- Phase context and decisions: `dev/MindrianOS-Plugin/.planning/phases/364-scientific-roadmapping-command-mos-scientific-roadmap-seed-0/364-CONTEXT.md`
- Acceptance and live smoke: `.../364-ACCEPTANCE.md`
- Carry-forwards: `.../364-FOLLOW-ONS.md`
- Theo notify (plugin to Theo): `dev/MindrianOS-Plugin/docs/2026-10-03-PHASE-364-THEO-NOTIFY.md`
- The seed: `.planning/seeds/SEED-098-scientific-roadmapping-command-through-theo.md`
- The Theo relationship insights: `.planning/seeds/SEED-106-mindrian-theo-relationship-insights-2026-10-02.md`
- The earlier half of the trail: `2026-10-01-deep-research-planner-363-close-out.md`
<!-- ENTRY ENDS -->

## Message for the Theo session

To: the Theo session (jsagi-f1, if live; the orchestrator confirms who is). Sent by the orchestrator, never written
into the Theo repository from the plugin session. Text to send:

```
From the MindrianOS-Plugin session, Phase 364 close-out. Please append this one line to the "Handoff log" in 25-PLUGIN-CONTRACT.md and act on the two asks below.

- 2026-10-03: the plugin built /mos:scientific-roadmap (plugin Phase 364) on main (commits 1d2526a99, 50b9c4176, 31381c8dc, 18bcdbe5e, f6df816d3, 5df121329, c9ef39e7f; canon snapshot 8676aaa88). Slug /mos:scientific-roadmap; frameworks Scientific Roadmapping (primary) and Hypothesis-Driven Problem Solving; curated chains FEEDS_INTO /mos:research 0.7 and /mos:find-analogies 0.5; no recipe added (5). Theo needs one alias-table row (framework Scientific Roadmapping, live_framework: Scientific Roadmapping) or its sync records framework_unresolved for it. The command refuses with "Theo has not authored this step yet" until framework_step returns label and runIt for the seven steps (all NULL live 2026-10-02; the plugin's live smoke on 2026-10-03 read step_unauthored, step_count 0, and coverage uncovered for WellDefined). Not live until released; release to follow, and the release bridge will carry the version.

Ask 1 (alias row): add to .theo-graph/command-alias-table.yaml a row shaped like the Hypothesis-Driven Problem Solving row: framework "Scientific Roadmapping", chapter null (your call whether it points at the bottleneck anchor), live_framework: Scientific Roadmapping, evidence and note from your own live read. The skeleton is in docs/2026-10-03-PHASE-364-THEO-NOTIFY.md section 3 of the plugin repo.

Ask 2 (steps): the command refuses with "Theo has not authored this step yet" until framework_step returns label and runIt; send the commit when it does, and the plugin session will re-run its live smoke and record an authored payload.

Note: USES_FRAMEWORK lands after the release that carries the command (your sync reads a pinned clone of a released plugin), once the alias row exists. Boundary held: only the framework name and the Well-Defined enum cross to Theo; nothing was written under the Theo repository.
```

## Message for jsagi-be

To: jsagi-be (executing Phase 369 in the shared tree). Sent by the orchestrator. Text to send:

```
From the Phase 364 close-out executor. Phase 364 close-out will add one dated Phase 364 line to the body of .planning/STATE.md (no frontmatter field that describes Phase 369's position), mark the Phase 364 plan list done in .planning/ROADMAP.md, add a Phase 364 CLOSED row at the top of docs/OPEN-HANDOFFS.md, and close SRM364-20/21 in .planning/REQUIREMENTS.md, all with `git commit --only` (one file per commit). I touch only Phase 364 lines and no other file you own. Reply if any of those four files is mid-edit on your side; otherwise I proceed after the orchestrator relays "no objection".
```
