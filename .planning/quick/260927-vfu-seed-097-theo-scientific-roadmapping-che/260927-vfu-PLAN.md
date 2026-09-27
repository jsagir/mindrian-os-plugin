---
phase: quick/260927-vfu
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/seeds/SEED-097-deep-research-designer-breakthrough-opportunities.md
  - .planning/seeds/SEED-098-scientific-roadmapping-command-through-theo.md
autonomous: true
requirements: [R1, R2, R3, R4, R5, R6, R7, NR-1, NR-2, NR-3]

must_haves:
  truths:
    - "R1: SEED-097's Scientific Roadmapping section carries a dated '#### Live Theo check (2026-09-27)' subsection that records every verified fact below, attributed to its path (guarded mindrian-brain shim = production; raw local Theo tools = local build 4ae98432, built 2026-09-17, dirty:true, sync_drift not-measured), and lists discrepancies D1-D6. No fact outside the verified set is added"
    - "R2: SEED-097 no longer says 'eleven techniques'; it says twelve, citing the live check"
    - "R3: SEED-097 open decision 6 keeps its existing sentences and appends the check result (data present in production, typed seam not readable) and names D2 (FEEDS_INTO direction vs the detector-nominates reading) and D3 (WellDefined coverage vs the rung table) as decisions to resolve; one-clause pointers to D2 and D3 sit beside the 'a detector nominates a path' text and rung-table row 3"
    - "R4: SEED-097 carries a '#### Theo-side authoring requirement' subsection for the Theo companion phase (alongside Theo SEED-015): legacy-to-typed step mapping without content loss, SOURCED_FROM provenance to the article with the research-builder additions attributed to MindrianOS, explicit rulings on D2 (including the hypothesis re-entry question from NR-3) and D3, a real orchestrationStatus plus local-vs-production reconciliation, the USES_FRAMEWORK edge once SEED-098's command exists; acceptance = framework_step returns non-null label and runIt for all 7 steps on the hosted endpoint through the guarded shim; Theo repo work happens in the Theo session (~/Theo), this repo only records it"
    - "R5/NR-1: SEED-098 exists (id unused before this task), status dormant, priority high, planted 2026-09-27, and records as a LOCKED navigator ruling that the new command BINDS (composes) find-bottlenecks, dominant-designs and explore-futures as step inputs rather than duplicating or replacing them, and is a new command because it pushes the constraint-first way (assumed limiters become falsifiable questions)"
    - "NR-2: SEED-098 specifies mid-journey entry: how the entry step is picked from local room state read through navigation.cjs (fresh goal, quantified goal, dominant-design read, futures scenario, RS finding, hypothesis in flight, prior run with new evidence), how skipped steps are recorded honestly, and how it avoids colliding with /mos:explore-opportunity (never advances opportunity stage, never auto-fires it, distinct trigger, both offered at a gate when both apply)"
    - "NR-3: SEED-098 records that Theo has Scientific Roadmapping FEEDS_INTO and COMPLEMENTS Hypothesis-Driven Problem Solving, states how the mid-journey design is consistent with that edge, and routes the reverse (hypothesis re-entry) question to the Theo-side ruling"
    - "R6: SEED-098 is born WIRED on paper: proposed hitl_stages from the closed F.0-F.9 vocabulary, connector frontmatter fields, the Part 3 gate at ranking/filing with human ratification, proposed-only claims via navigation.cjs, Part 8 generic-handles-only egress through the guarded shim, tri-polar behavior for CLI/Desktop/Cowork, honest refusal while framework_step is unreadable; it depends on SEED-097's authoring requirement and feeds SEED-097's perspective, and SEED-097 carries a one-line breadcrumb back"
    - "R7: existing SEED-097 content is preserved (diff deletes at most 15 lines), neither file contains an em-dash, no new personal names are added, and exactly one commit lands containing exactly the two seed files"
  artifacts:
    - path: ".planning/seeds/SEED-097-deep-research-designer-breakthrough-opportunities.md"
      provides: "Live Theo check, D1 fix, updated open decision 6, Theo-side authoring requirement, SEED-098 breadcrumb"
      contains: "Live Theo check (2026-09-27)"
    - path: ".planning/seeds/SEED-098-scientific-roadmapping-command-through-theo.md"
      provides: "Seed for the /mos: Scientific Roadmapping command (binds three commands, mid-journey entry, born WIRED)"
      contains: "id: SEED-098"
  key_links:
    - from: "SEED-098 frontmatter trigger_when / depends_on"
      to: "SEED-097 '#### Theo-side authoring requirement'"
      via: "trigger = that requirement's acceptance check passing"
      pattern: "Theo-side authoring requirement"
    - from: "SEED-097 Breadcrumbs"
      to: ".planning/seeds/SEED-098-scientific-roadmapping-command-through-theo.md"
      via: "one-line breadcrumb"
      pattern: "SEED-098-scientific-roadmapping-command-through-theo"
---

<objective>
Record the 2026-09-27 live Theo check of Scientific Roadmapping in SEED-097, fix the
facts it contradicts, add the Theo-side authoring requirement for the Theo companion
phase, and plant SEED-098: a /mos: command that runs Scientific Roadmapping through
Theo, binds the three nearest existing commands, and can be entered mid-journey.

Purpose: SEED-097 currently asserts an unverified Theo seam ("eleven techniques",
"a detector nominates a path") while the live graph says otherwise, and no plugin
surface runs Scientific Roadmapping at all. The seeds must carry the measured truth
and the work needed on both sides before discuss-phase picks them up.

Output: one edited seed (SEED-097), one new seed (SEED-098), one commit of exactly
those two files. Doc-only: no code, no Theo calls, no Theo writes, no room writes.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@.planning/seeds/SEED-097-deep-research-designer-breakthrough-opportunities.md
@.planning/seeds/SEED-096-theo-framework-content-backfill-descriptions-jtbd-definitions.md
@commands/find-bottlenecks.md
@commands/dominant-designs.md
@commands/explore-futures.md
@commands/explore-opportunity.md
@docs/HITL-SHAPE-DECLARATION-CONTRACT.md

## Verified facts (the ONLY facts Tasks 1 and 2 may state as measured)

Measured 2026-09-27 by the orchestrating session. Write them as measured facts with
their path attribution. Do not re-run Theo, do not add facts, do not copy any step
description / key_question / gates / outputs TEXT (only names, counts and property
names; the repo is public and the Brain is IP).

**Path A: guarded mindrian-brain shim (production, brain_query Cypher)**
- Framework node "Scientific Roadmapping" exists. Edge counts: PART_OF 1 (Chapter);
  HAS_PROCESS_STEP 7; USES_TECHNIQUE 12; COMPLEMENTS 4; PREREQUISITE 1; FEEDS_INTO 4
  outgoing; ADDRESSES_PROBLEM_TYPE 3.
- 7 ProcessSteps with properties step_name, order, description, key_question, gates,
  outputs (plus id, name, namespace, batch_id, parent_process, source_label_set).
  Order: 1 TENSION, 2 QUANTIFY, 3 RUNG, 4 FORUM, 5 ENUMERATE, 6 INTERROGATE, 7 RANK.
  LEADS_TO chain 1->2->...->7 and 7->1 (the re-survey loop is real). description,
  key_question, gates and outputs are non-null on every step.
- Properties orchestrationStatus and stepId do NOT exist in production
  (UnknownPropertyKeyWarning).
- FEEDS_INTO outgoing: Reverse Salient Analysis, Hypothesis-Driven Problem Solving,
  PWS Value Proposition, Three-Horizon Framework. FEEDS_INTO incoming from: Problem
  Typology Framework / The Taxonomy of Problems, S-Curve Analysis, Problem Taxonomy
  (Search Gradient), The Innovation Landscape. COMPLEMENTS: Problem Typology Framework
  / The Taxonomy of Problems, Reverse Salient Analysis, Hypothesis-Driven Problem
  Solving, Scenario Planning for High Uncertainty. PREREQUISITE: Problem Taxonomy
  (Search Gradient).

**Path B: raw Theo tools (local stdio server; build 4ae98432, built 2026-09-17, dirty:true; sync_drift not-measured)**
- normalize_framework_name: exact canonical; aliases Roadmapping, Field Roadmapping,
  Technology Roadmapping, Tech Tree Mapping.
- framework_neighborhood: orchestrationStatus "draft", frameworkType field_survey,
  patternType cyclical, applicableStages [discovery, problem_definition,
  opportunity-identification, decision], chapter "Bottlenecks and Decision Speed"
  (id bottleneck), brainRecords [] (no SOURCED_FROM provenance), commands [] (no /mos:
  command USES_FRAMEWORK it).
- framework_step: returns 7 steps sr-v1-step-1..7 with label, runIt,
  researchDirective, artifactRubric, thinkingMode, stepKind ALL null. Theo's typed step
  contract cannot read the step content, which is stored under legacy property names.
- framework_techniques: 12 techniques: [withheld technique], [withheld technique], Domino
  Counting, [withheld technique], [withheld technique], [withheld technique],
  [withheld technique], [withheld technique], [withheld technique], Rung
  Placement, [withheld technique], [withheld technique]. problem_types:
  IllDefined, UnDefined, Wicked (NOT WellDefined).
- The local server reports orchestrationStatus while production lacks the property:
  the two paths may not read the same graph state. Unresolved; must be checked, not
  assumed.

**Discrepancies vs SEED-097 text**
- D1: "eleven techniques" (SEED-097 line ~584) -> Theo serves 12.
- D2: direction. SEED-097 says a detector (RS) nominates a path for Roadmapping; the
  graph says Scientific Roadmapping FEEDS_INTO Reverse Salient Analysis. Record both
  readings; do not pick one (discuss-phase decision or a Theo edge fix).
- D3: the rung table routes well-defined problems to a Technical Roadmap; Theo
  addresses only UnDefined / IllDefined / Wicked.
- D4: typed seam. Content exists; framework_step cannot read it.
- D5: no command anchor (commands []) and no provenance anchor (brainRecords []).
- D6: local vs production graph drift (orchestrationStatus present locally, absent in
  production).

**Planner-verified repo facts (2026-09-27)**
- SEED-098 is unused: no file under .planning/seeds or .planning/seeds/retired, and no
  reference in .planning/ or docs/.
- No plugin surface names Scientific Roadmapping (case-insensitive grep over commands/,
  agents/, skills/, pipelines/, lib/, data/ returned zero hits). No command file name
  contains roadmap or constraint.
- New files under .planning/ are gitignored (`.gitignore:97:.planning/*`); seeds are
  force-tracked, so new seed files need `git add -f`.
- The repo remote (jsagir/mindrian-os-plugin) is PUBLIC.
- Closest surfaces: find-bottlenecks (Reverse Salient Analysis, hitl_shape F.8,
  sub_mode reverse-salient, produces room/**/reverse-salients/*, filing
  fileEvidenceWithReadback); dominant-designs (Dominant Design, hitl_shape F.1,
  sub_mode dominant-design, research mode from Phase 361: approved-query gate card,
  then one dominant-design-researcher per approved evidence lane via Task);
  explore-futures (Scenario Planning, hitl_stages build-path F.2 ordered then
  ordered-projection F.9 ordered, sub_mode futures-scenario, produces room/**/futures/*);
  explore-opportunity (hitl_shape F.1, runs only on a QUALIFIED opportunity, refuses
  others with not_qualified, never auto-fires on qualify, deep_research leg uses
  Hypothesis-Driven Problem Solving, advances the opportunity stage to explored through
  advanceOpportunityStage with append-only stage_history, entry
  lib/core/eureka/explore-chain.cjs::exploreOpportunity).

## Navigator ruling (2026-09-27), LOCKED for SEED-098 - implement exactly

- NR-1: The command BINDS find-bottlenecks, dominant-designs and explore-futures. It
  composes them (reuses their surfaces as steps/inputs where they fit the 7 Theo steps:
  dominant-designs and explore-futures feed ENUMERATE / QUANTIFY; find-bottlenecks
  feeds INTERROGATE) rather than duplicating or replacing them. It is still a NEW
  command because it pushes a new way: constraint-first, assumed limiters become
  falsifiable questions. "New command vs extension" is therefore NOT an open decision.
- NR-2: A hypothesis-driven innovation starting point already exists
  (commands/explore-opportunity.md, skills/explore-opportunity/SKILL.md, referenced from
  commands/research.md). SEED-098 must make Scientific Roadmapping usable MID-journey,
  not only as a start: enterable from existing room state (an existing bottleneck/RS
  finding, a dominant-design read, a futures scenario, a hypothesis already in flight)
  picking up at the right step (e.g. INTERROGATE with an existing limiter, or re-entry
  via the 7->1 re-survey loop), as well as from a fresh goal. Specify how the entry
  step is picked (room state via navigation.cjs, local only) and how it avoids
  colliding with the explore-opportunity start.
- NR-3: Theo already has Scientific Roadmapping FEEDS_INTO Hypothesis-Driven Problem
  Solving and COMPLEMENTS it; the mid-journey design must be consistent with that edge
  or explicitly rule on it.
</context>

<tasks>

<task type="auto">
  <name>Task 1: SEED-097 - live Theo check, D1 fix, open decision 6, Theo-side authoring requirement, SEED-098 breadcrumb</name>
  <files>.planning/seeds/SEED-097-deep-research-designer-breakthrough-opportunities.md</files>
  <read_first>.planning/seeds/SEED-097-deep-research-designer-breakthrough-opportunities.md (read in full once; anchors below are by quoted text, line numbers are approximate)</read_first>
  <action>
Pre-flight (collision guard, per the two-sessions-one-tree rule): run git log -1 --format=%h on the SEED-097 path and git status --short on .planning/seeds. Expected: last commit a651012f5 and no uncommitted change to SEED-097. If SEED-097 has an uncommitted diff you did not make, or its last commit is not a651012f5, STOP and report; never revert or overwrite a peer's change. Edit with the Edit tool only (targeted replacements); never rewrite the file wholesale. Keep every existing sentence unless an item below says to change a specific phrase. No em-dashes (use hyphens). Add no personal names; refer to the article's author as "the article's author" (the pre-existing name on the attribution line stays as is).

Edits, in file order:

(a) Brief, "First slice" paragraph (~line 36), the phrase "the unverified Scientific Roadmapping Theo seam": append a short parenthetical "(checked 2026-09-27: the content is in the graph, the typed seam cannot read it; see Live Theo check)".

(b) Open decision 6 (~lines 340-343): keep its three existing sentences verbatim and append: "**Checked 2026-09-27 (see Live Theo check under Scientific Roadmapping through Theo):** the data is present in production (7 ProcessSteps with content, 12 techniques, the 7-to-1 LEADS_TO loop) but the typed seam is not: framework_step returns null label/runIt/researchDirective/artifactRubric/thinkingMode/stepKind for all seven steps. Closing it is the Theo-side authoring requirement. Two sub-decisions to resolve here:" followed by two indented bullets: D2 (direction: SEED-097's reading that a detector such as RS nominates a path for Roadmapping versus the graph's Scientific Roadmapping FEEDS_INTO Reverse Salient Analysis; both readings are recorded, neither is picked; resolve at discuss-phase or by a Theo edge ruling) and D3 (well-defined coverage: the rung table sends well-defined problems to a Technical Roadmap while Theo addresses only UnDefined / IllDefined / Wicked; decide whether Theo gains WellDefined coverage or the plugin reroutes well-defined goals).

(c) Scientific Roadmapping through Theo section (~line 584), replace "eleven techniques" with "twelve techniques (live Theo check, 2026-09-27; an earlier count of eleven is superseded)". The final file must not contain the exact string "eleven techniques" anywhere.

(d) Same section (~line 592), after the sentence ending "catalytic ranking names downstream unlocks.", insert one sentence: "Direction is unresolved (D2): the live graph has Scientific Roadmapping FEEDS_INTO Reverse Salient Analysis, the opposite of a detector nominating a path; both readings stand until open decision 6 is ruled."

(e) Seven-operations table row 3 (Rung Placement and Type Selection), append to the right-hand cell: "Unresolved (D3): Theo currently addresses only UnDefined / IllDefined / Wicked problem types, so the well-defined route has no Theo coverage yet."

(f) At the END of the Scientific Roadmapping through Theo section, immediately before the heading "### Open-source and public-data incorporation review", insert two new subsections:

"#### Live Theo check (2026-09-27)": one lead sentence saying what was checked and that these are measured facts on two paths (Path A guarded mindrian-brain shim, production, brain_query Cypher; Path B raw local Theo stdio tools, build 4ae98432 built 2026-09-17, dirty:true, sync_drift not-measured, which describe the local build and are not proven equal to hosted production). Then a markdown table with columns Path | Check | Measured result, one row per bullet in the context block's Path A and Path B lists (framework node and edge counts; ProcessStep properties, order names, LEADS_TO chain incl. 7-to-1, non-null content; orchestrationStatus and stepId absent in production; FEEDS_INTO out/in, COMPLEMENTS, PREREQUISITE neighbors; normalize_framework_name and aliases; framework_neighborhood fields; framework_step ids sr-v1-step-1..7 with all six typed fields null; the 12 technique names verbatim and the three problem types, noting WellDefined absent). Then a "Discrepancies" list D1-D6 exactly as in the context block, each with where it is resolved (D1 fixed in this section; D2 and D3 open decision 6; D4, D5, D6 the Theo-side authoring requirement). End with one sentence: the local and production paths may not read the same graph state; this is unresolved and must be checked, not assumed.

"#### Theo-side authoring requirement (Theo companion phase, alongside Theo SEED-015)": open with the scope sentence: this work happens in the Theo session (repo ~/Theo, its own GSD), never from this repo; this seed only records the requirement, and no Theo write is made from the plugin. Then a numbered list:
1. Re-author Scientific Roadmapping so it reads through Theo's own typed framework_step contract without losing content. Include a small proposed mapping table (Legacy property | Typed field | Note), explicitly labeled "proposed, to confirm against the framework_step contract in the Theo session": id (sr-v1-step-N, already surfaced by framework_step; production has no stepId property) -> stepId; step_name -> label; description -> runIt; key_question -> researchDirective; gates + outputs -> artifactRubric (gates as pass conditions, outputs as required artifacts); no legacy source -> thinkingMode and stepKind (author per step, never default silently). order and the LEADS_TO chain including 7-to-1 are preserved; legacy properties are retained, or migrated only with a per-step parity check, so no step loses description, key_question, gates or outputs.
2. Add SOURCED_FROM provenance to the source article https://www.essentialtechnology.blog/p/scientific-roadmapping (brainRecords is empty today). Keep the navigator's research-builder additions (serial solo roles, the versioned ratchet on discarded paths, the constraint-to-falsifiable-question reading) attributed as MindrianOS application, not to the article's author.
3. Rule explicitly on the Reverse Salient FEEDS_INTO direction (D2), and in the same ruling state whether re-entry from a hypothesis in flight needs a Hypothesis-Driven Problem Solving to Scientific Roadmapping edge or is covered by the existing COMPLEMENTS edge (Theo already has Scientific Roadmapping FEEDS_INTO and COMPLEMENTS Hypothesis-Driven Problem Solving; see SEED-098 mid-journey entry).
4. Rule explicitly on WellDefined coverage (D3).
5. Set a real orchestrationStatus in production and reconcile the local build with production (D6), with sync_drift measured rather than not-measured.
6. Add the USES_FRAMEWORK edge from the SEED-098 command once that command exists (D5, commands [] today).
Close with "**Acceptance:** framework_step returns non-null label and runIt for all 7 steps on the hosted endpoint, read through the guarded mindrian-brain shim (not raw Theo tools)." and a second line naming the supporting checks: brainRecords non-empty with SOURCED_FROM to the article; orchestrationStatus present and equal on local and hosted; D2 and D3 rulings recorded in SEED-097 open decision 6.

(g) Breadcrumbs list (## Breadcrumbs), append one line: "- `.planning/seeds/SEED-098-scientific-roadmapping-command-through-theo.md` (the /mos: command that runs this perspective through Theo, enterable mid-journey; triggered by the Theo-side authoring requirement above)".

(h) "Opportunity portfolio to test" paragraph (~line 657), after "once its live Theo interface is verified", insert "(checked 2026-09-27: data present, typed seam not readable; see Live Theo check)". Acceptance gates last bullet (~line 726-728): append one sentence "The 2026-09-27 live check found the production data present but the typed step seam unreadable; the Theo-side authoring requirement's acceptance check is the gate."

Do not touch the frontmatter.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && F=.planning/seeds/SEED-097-deep-research-designer-breakthrough-opportunities.md && grep -q '^#### Live Theo check (2026-09-27)' "$F" && grep -q '^#### Theo-side authoring requirement' "$F" && ! grep -q 'eleven techniques' "$F" && grep -q 'twelve techniques' "$F" && for t in '[withheld technique]' '[withheld technique]' '[withheld technique]' '[withheld technique]' '[withheld technique]' '[withheld technique]' '[withheld technique]' '[withheld technique]' '[withheld technique]' 'Rung Placement' '[withheld technique]' '[withheld technique]' 'sr-v1-step-1' '4ae98432' 'Tech Tree Mapping' 'UnknownPropertyKeyWarning' 'essentialtechnology.blog/p/scientific-roadmapping' 'SOURCED_FROM' 'USES_FRAMEWORK' '~/Theo' 'SEED-098-scientific-roadmapping-command-through-theo.md' 'Hypothesis-Driven Problem Solving'; do grep -qF "$t" "$F" || { echo "MISSING: $t"; exit 1; }; done && sed -n '/^## Open decisions/,/^## Shared layer/p' "$F" | grep -q 'D2' && sed -n '/^## Open decisions/,/^## Shared layer/p' "$F" | grep -q 'D3' && [ "$(grep -cP '\x{2014}' "$F")" -eq 0 ] && [ "$(git diff --numstat -- "$F" | awk '{print $2}')" -le 15 ] && head -13 "$F" | grep -q '^id: SEED-097$' && echo TASK1-OK</automated>
  </verify>
  <done>SEED-097 prints TASK1-OK: both new subsections present with all 12 technique names and path-attributed facts, "eleven techniques" gone, open decision 6 names D2 and D3, SEED-098 breadcrumb present, zero em-dashes, at most 15 deleted lines, frontmatter untouched.</done>
</task>

<task type="auto">
  <name>Task 2: Plant SEED-098 (binding, mid-journey, born WIRED), verify both seeds, single scoped commit</name>
  <files>.planning/seeds/SEED-098-scientific-roadmapping-command-through-theo.md</files>
  <read_first>.planning/seeds/SEED-096-theo-framework-content-backfill-descriptions-jtbd-definitions.md (frontmatter and section order convention); commands/find-bottlenecks.md, commands/dominant-designs.md, commands/explore-futures.md, commands/explore-opportunity.md (frontmatter only, to name the connector fields accurately); docs/HITL-SHAPE-DECLARATION-CONTRACT.md lines 26-73 (Form A / Form B and the closed F.0-F.9 vocabulary)</read_first>
  <action>
Re-confirm the id is free: ls .planning/seeds .planning/seeds/retired | grep -c 'SEED-098' must print 0 before writing; if not 0, STOP and report. Create the file with the Write tool. No em-dashes; no personal names (say "navigator", "the article's author"; do not name scholars behind methods).

Frontmatter (SEED-096 / SEED-097 convention): id: SEED-098; status: dormant; priority: high; planted: 2026-09-27; updated: 2026-09-27; planted_during: "quick task 260927-vfu (live Theo check of Scientific Roadmapping), after the Phase 355.1 close-out"; trigger_when: "when SEED-097's Theo-side authoring requirement passes its acceptance check (framework_step returns non-null label and runIt for all 7 steps on the hosted endpoint through the guarded shim), or when SEED-097's discuss-phase schedules the Scientific Roadmapping perspective fixture, whichever comes first"; scope: "medium (one new methodology command binding three existing ones, its connector and HITL declarations, a mid-journey entry resolver over navigation.cjs reads, fixtures; no new engine, no parallel roadmap implementation)"; depends_on: [SEED-097 Theo-side authoring requirement]; feeds: [SEED-097 Scientific Roadmapping perspective]; canon_parts: [3, 7, 8, 9, 11, 12]; navigator_ruling: one-line summary of NR-1 to NR-3 dated 2026-09-27.

Title: "# SEED-098: /mos: Scientific Roadmapping through Theo - a constraint-first command that binds find-bottlenecks, dominant-designs and explore-futures and can be entered mid-journey".

Sections, in this order:

1. "## Why This Matters": Scientific Roadmapping lives in Theo (cite SEED-097 Live Theo check: 7 steps, 12 techniques, 7-to-1 loop) but no /mos: command USES_FRAMEWORK it (commands []), and no plugin surface names it (planner grep, 2026-09-27). The navigator's research-builder reading needs a governed way to turn a valuable-but-disputed goal into falsifiable constraint questions. Without the command the perspective is reachable only as ad-hoc conversation.

2. "## The flow (constraint-first)": goal -> rung -> paths -> limiter ledger -> assumed constraints become falsifiable questions -> catalytic ranking, mapped onto Theo steps 1 TENSION, 2 QUANTIFY, 3 RUNG, 4 FORUM, 5 ENUMERATE, 6 INTERROGATE, 7 RANK and the 7-to-1 re-survey loop. Reuse SEED-097's seven-operations artifact table by reference, do not copy it. Keep SEED-097's rules: preserve unresolved when no derivation or decisive test exists; never infer an assumption is false because it has not been proved fundamental; preserve rejected routes and reasons; step content comes from Theo's typed framework_step, never from model memory.

3. "## Locked navigator ruling (2026-09-27)": state NR-1, NR-2, NR-3 as locked. Then "### Binding, not duplicating (NR-1, Canon Part 7 reuse before build)": a table Existing surface | What it already does (from its frontmatter) | Which Theo step it feeds | What it lacks that this command adds. Rows: find-bottlenecks (Reverse Salient Analysis, F.8, reverse-salients artifacts) -> INTERROGATE (a reverse-salient limiter enters the ledger as a claimed bound to classify fundamental / assumed / unresolved) -> lacks quantified goal, path enumeration, limiter classification, discriminating test, catalytic ranking; dominant-designs (Dominant Design, F.1, Phase 361 approved-query research mode) -> ENUMERATE (competing variants as candidate routes) and QUANTIFY (current design performance as baseline); its approved-query gate card plus researcher fan-out is the template for any research pass in INTERROGATE -> lacks constraint ledger and falsifiable questions; explore-futures (Scenario Planning, hitl_stages F.2 then F.9) -> QUANTIFY (time horizon, S-curve position) and ENUMERATE (scenarios as uncovered regions) -> lacks limiter interrogation and unlock ranking. State that binding means reading their already-filed artifacts through navigation.cjs, or offering to run the existing command at its own gate, never re-implementing their logic; the exact per-step binding contract (read filed artifact vs invoke at gate) is settled at discuss-phase. State why it is still a new command: its question, output and falsifier differ (SEED-097 V1), and extending find-bottlenecks would merge the RS and Scientific Roadmapping perspectives that SEED-097 keeps independent.

4. "## Mid-journey entry (NR-2)": an entry resolver reads LOCAL room state only, through lib/core/navigation.cjs (graph neighborhoods, opportunity nodes and their stage_history, filed reverse-salients / dominant-designs / futures artifacts, prior Scientific Roadmapping runs under research/), and proposes an entry step. Table Room state found | Proposed entry step | Why: fresh goal with no room state -> 1 TENSION; stated goal without baseline/unit/horizon -> 2 QUANTIFY; quantified goal present -> 3 RUNG; dominant-design read or futures scenario present -> 5 ENUMERATE (after QUANTIFY is satisfied from them where possible); an existing RS / bottleneck finding -> 6 INTERROGATE with that limiter as the first ledger row; a hypothesis already in flight (an explored opportunity or Hypothesis-Driven Problem Solving output) -> 6 INTERROGATE on the limiter the hypothesis depends on; a prior run plus new evidence or a solved bottleneck -> 7-to-1 re-survey (step 1 with the prior ledger; rejected routes reopen only on changed evidence). Rules: the proposal is shown at an entry gate (F.1) and the navigator may override to step 1; skipped steps are recorded as not_run with the room artifact that stands in for them as provenance, never fabricated; missing upstream artifacts are disclosed as context_insufficient and unlock claims at RANK stay provisional until QUANTIFY exists; nothing read here crosses to Theo (only the framework name and step ids are requested).
Then "### No collision with /mos:explore-opportunity": explore-opportunity is the existing hypothesis-driven start and owns the qualified-to-explored transition (advanceOpportunityStage, append-only stage_history; refuses not_qualified; never auto-fires). This command never advances an opportunity's stage, never auto-runs explore-opportunity, and files its run under research/ linked to the opportunity by typed evidence edges. Distinct triggers: this command's fresh start requires a valuable goal with disputed feasibility (TENSION qualification); a qualified opportunity awaiting exploration stays with explore-opportunity. When both apply (a qualified opportunity whose feasibility is disputed), the gate offers both and the navigator picks; neither fires automatically.
Then "### Consistency with the Hypothesis-Driven Problem Solving edge (NR-3)": Theo has Scientific Roadmapping FEEDS_INTO and COMPLEMENTS Hypothesis-Driven Problem Solving (SEED-097 Live Theo check). Consistent direction: this command's falsifiable project questions are offered to explore-opportunity (whose deep_research leg is Hypothesis-Driven Problem Solving) at its own gate. Reverse direction (re-entry from a hypothesis in flight) is treated as the COMPLEMENTS relation plus the 7-to-1 loop, not a FEEDS_INTO reversal; whether Theo needs an explicit Hypothesis-Driven Problem Solving to Scientific Roadmapping edge is ruled in SEED-097's Theo-side authoring requirement item 3, together with D2.

5. "## Born WIRED (Canon Part 11 / CIRS)": the command ships only born wired or it does not ship. Cover, as bullets: (a) HITL declaration: a proposed hitl_stages block in a fenced yaml snippet using only the closed vocabulary and the parallel | ordered | gate modes from data/hitl-stages-schema.json: entry-step [F.1] gate; goal-and-rung [F.2] ordered (steps 1-3, each needs the last); path-enumeration [F.4] ordered (harvest scope, 10X resurvey); constraint-interrogation [F.8] parallel (limiters are independent); catalytic-ranking-and-filing [F.7, F.0] gate; plus a single hitl_why sentence; labeled proposed, checked by scripts/check-shape-declaration.cjs. (b) Connector frontmatter naming the fields the three bound commands use (connects_to_spine, sensor_triggers, reach_id, sub_mode, framework: "Scientific Roadmapping" matching frameworks:, posture, hierarchy_rank, filing: fileEvidenceWithReadback, plan_gated, web_scope, surface), values set at plan time; data/connector-registry.json rebuilt by scripts/build-connector-registry.cjs and green under --check, plus scripts/build-orchestration-projection.cjs --check and scripts/check-render-coverage.cjs. (c) The gate at ranking/filing is a Canon Part 3 Tri-Context Decision Gate (APPROVE / REJECT with reason / DEFER): the human ratifies the catalytic ranking and every limiter classification before anything is promoted; any external research pass uses the approved-query gate card before a fetch (SEED-097 open decision 1 governs standing-policy vs per-query approval). (d) Proposed-only claims: every ledger row, question and opportunity is written through lib/core/navigation.cjs (writeOpportunityNode and typed edges) as proposed; only a human confirms a truth claim (Part 9); discarded routes become REJECTED_BECAUSE data. (e) Part 8: only generic handles cross to Theo (framework name, step ids, technique names, problem-type enum) through the guarded mindrian-brain shim (bin/mindrian-brain-mcp-client.cjs, lib/core/part8-egress-guard.cjs), never raw theo tools; the room goal, metric, cohort, path map and limiter ledger stay local. (f) Tri-polar: CLI (/mos: command, AskUserQuestion gate cards), Desktop (Larry recognizes the natural-language "what is really blocking this ambition" ask and runs the gates via gate_render / gate_answer), Cowork (shared room state, research/ filing visible to all members, multi-member FORUM when present, serial solo perspectives marked provisional otherwise); any skip is stated, not silent. (g) Honest refusal: while framework_step returns null (today), the command refuses with the measured reason and never improvises steps from model memory. (h) Output: a MOS-CANVAS local envelope with a roadmap/path/constraint result_kind per SEED-097, filed per SEED-097's ICM filing section (research/ holds the run; opportunity-bank/ gets a concise proposed opportunity; linked, not copied).

6. "## Dependencies and cross-links": depends on SEED-097's "Theo-side authoring requirement" (typed steps, provenance, D2/D3 rulings, orchestrationStatus, local/production reconcile); feeds SEED-097's Scientific Roadmapping perspective (this command is that perspective's CLI invocation and its standalone fixture's entry point); once shipped, Theo adds the USES_FRAMEWORK edge (authoring requirement item 6). Theo SEED-015 is relevant only if limiter classification uses a Jev policy, which then needs held-out evaluation per SEED-097.

7. "## Open decisions for discuss-phase" (NR-1 removes new-vs-extend from this list): command name (recommend /mos:scientific-roadmap; no existing command file collides); the per-step binding contract (read filed artifact vs invoke at gate); D2 inherited (does a limiter hand off to /mos:find-bottlenecks, does an RS finding enter at INTERROGATE, or both); D3 inherited (well-defined goals: route to a Technical Roadmap once Theo covers WellDefined, or reroute); FORUM on a solo surface; whether INTERROGATE opens an approved external research child run through the SEED-097 research designer; whether limiter classification uses a Jev policy.

8. "## When to Surface" and "## Scope Estimate" (short, consistent with frontmatter), then "## Breadcrumbs": SEED-097 (sections: Scientific Roadmapping through Theo, Live Theo check, Theo-side authoring requirement, ICM filing and research-run memory); commands/find-bottlenecks.md; commands/dominant-designs.md and agents/dominant-design-researcher.md; commands/explore-futures.md; commands/explore-opportunity.md, skills/explore-opportunity/SKILL.md, lib/core/eureka/explore-chain.cjs; commands/research.md; docs/HITL-SHAPE-DECLARATION-CONTRACT.md and data/hitl-stages-schema.json; scripts/check-shape-declaration.cjs; scripts/build-connector-registry.cjs; lib/core/navigation.cjs; bin/mindrian-brain-mcp-client.cjs; lib/core/part8-egress-guard.cjs; ~/MindrianRooms/mindrianOS/methodology/2026-09-27-mos-canvas-scientific-roadmapping-handoff.md; the article URL; ~/Theo/.planning/seeds/SEED-015-judgment-kind-on-the-analytics-seam-theo-as-jev-keyholder.md. Add a "## Notes" line: the rethinking-mindrianos room trail entry is filed when this seed is activated at discuss-phase (no room write in this quick task).

Then verify both files with the verify command below. Only when it prints TASK2-OK, commit (collision-safe, per the tracked-planning-files and two-sessions rules): git add -f on exactly the two seed paths; then git commit --only on exactly the two seed paths with subject "docs: SEED-097 live Theo roadmapping check + Theo authoring requirement; plant SEED-098 roadmapping command" and the standard Co-Authored-By trailer from the session attribution. Never use gsd-tools query commit --files (it sweeps the index), never git add -A, never stage other files. After committing, confirm the new sha is an ancestor of HEAD (git merge-base --is-ancestor) and run the post-commit check below.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && G=.planning/seeds/SEED-098-scientific-roadmapping-command-through-theo.md && F=.planning/seeds/SEED-097-deep-research-designer-breakthrough-opportunities.md && [ "$(ls .planning/seeds | grep -c '^SEED-098')" -eq 1 ] && H=$(sed -n '1,/^---$/{p}' "$G" | head -25) && echo "$H" | grep -q '^id: SEED-098$' && echo "$H" | grep -q '^status: dormant' && echo "$H" | grep -q '^priority: high' && echo "$H" | grep -q '^planted: 2026-09-27' && echo "$H" | grep -q '^trigger_when:' && echo "$H" | grep -q '^scope:' && for t in 'find-bottlenecks' 'dominant-designs' 'explore-futures' 'explore-opportunity' 'advanceOpportunityStage' 'Hypothesis-Driven Problem Solving' 'COMPLEMENTS' 'INTERROGATE' 'ENUMERATE' 'QUANTIFY' 'hitl_stages' 'check-shape-declaration.cjs' 'build-connector-registry.cjs' 'navigation.cjs' 'Part 8' 'Part 3' 'mindrian-brain' 'Cowork' 'Desktop' 'Theo-side authoring requirement' 'SEED-097' 'context_insufficient' '2026-09-27-mos-canvas-scientific-roadmapping-handoff.md'; do grep -qF "$t" "$G" || { echo "MISSING: $t"; exit 1; }; done && grep -qi 'mid-journey' "$G" && [ "$(grep -cP '\x{2014}' "$G")" -eq 0 ] && [ "$(grep -cP '\x{2014}' "$F")" -eq 0 ] && grep -q 'SEED-098-scientific-roadmapping-command-through-theo.md' "$F" && echo TASK2-OK</automated>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && [ "$(git log -1 --format=%s)" = "docs: SEED-097 live Theo roadmapping check + Theo authoring requirement; plant SEED-098 roadmapping command" ] && [ "$(git show --name-only --format= HEAD | sed '/^$/d' | sort | tr '\n' ' ')" = ".planning/seeds/SEED-097-deep-research-designer-breakthrough-opportunities.md .planning/seeds/SEED-098-scientific-roadmapping-command-through-theo.md " ] && [ -z "$(git status --short -- .planning/seeds/SEED-097-deep-research-designer-breakthrough-opportunities.md .planning/seeds/SEED-098-scientific-roadmapping-command-through-theo.md)" ] && echo COMMIT-OK</automated>
  </verify>
  <done>TASK2-OK then COMMIT-OK: SEED-098 exists with the convention frontmatter, locked NR-1..NR-3 content (binding table, mid-journey entry table and rules, explore-opportunity non-collision, Hypothesis-Driven Problem Solving consistency), born-WIRED contract, open decisions and breadcrumbs; both seeds em-dash free; HEAD is one commit with exactly the two seed files and the required subject; working tree clean for both paths.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| local session -> public GitHub repo | force-tracked seed files are pushed to a PUBLIC remote (jsagir/mindrian-os-plugin) |
| shared working tree -> commit | a peer session may have staged or uncommitted changes in the same tree |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-vfu-01 | Information disclosure | SEED-097 Live Theo check, SEED-098 | mitigate | Record only names, counts, property names and tool names (already present in tracked files such as SEED-097 and Phase 361 plans); never copy step description / key_question / gates / outputs text from the Brain. Technique names are method labels of a public article's method; flagged to the orchestrator for navigator awareness |
| T-vfu-02 | Information disclosure | both seeds | mitigate | No new personal names (no-real-names rule); "navigator" and "the article's author" only |
| T-vfu-03 | Tampering | git commit | mitigate | git add -f and git commit --only on exactly the two paths; pre-flight check that SEED-097's last commit is a651012f5 and has no unowned diff; post-commit check that HEAD contains exactly the two files; never gsd-tools query commit --files |
| T-vfu-04 | Repudiation / integrity | Live Theo check facts | mitigate | Facts are copied only from the plan's verified-facts block with path attribution and build id; no Theo re-run; D6 recorded as unresolved rather than assumed |
</threat_model>

<verification>
Both automated verify blocks print TASK1-OK, TASK2-OK and COMMIT-OK. Spot read: SEED-097 open decision 6 still contains its original sentence "The authored payload is evidence of method shape, not a live seam test."; the Live Theo check table attributes every row to Path A or Path B; SEED-098 lists "new command vs extension" nowhere as an open decision (NR-1 locked it).
</verification>

<success_criteria>
- SEED-097 carries the measured 2026-09-27 state of Scientific Roadmapping in Theo, the D1 fix, D2/D3 as decisions, and a Theo-side authoring requirement with a single hosted acceptance check, while every pre-existing section survives.
- SEED-098 is a dormant, high-priority seed for a new constraint-first command that binds the three existing commands, enters mid-journey from local room state without colliding with explore-opportunity, is consistent with Theo's Hypothesis-Driven Problem Solving edges, and is specified born WIRED.
- One commit, two files, required subject; no code, no Theo writes, no room writes.
</success_criteria>

<output>
Create `.planning/quick/260927-vfu-seed-097-theo-scientific-roadmapping-che/260927-vfu-SUMMARY.md` when done (do not include it in the seed commit).
</output>
