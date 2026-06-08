# Phase 152 Determination Research: Per-Command Visual + Intake + Intelligence Treatment

**Date:** 2026-06-08
**Author:** Larry (8-agent fan-out, one per command family)
**Status:** Research complete - DETERMINES Phase 152 (per-command visual rollout)
**Method:** 92 /mos: commands researched across 8 families against (a) initial intent (command frontmatter), (b) the best-understanding Brain framework (live `brain_search`, Part 8 generic handles only), (c) the implied Phase 152 treatment: `interaction_archetype` (A1-A7 from the keyboard-TUI research Section 12) + per-command `intake_spec` (Section 12b) + methodology-vs-infra classification.
**Feeds:** Phase 152 SPEC. Depends on Phase 144.1 (connector retrofit) + Phase 148 (selector) + Phase 149 (graph).

---

## 0. Executive determination - what Phase 152 must deliver

1. **An `interaction_archetype` field per command (A1-A7).** `body_shape: methodology` is NOT a reliable proxy for A1 - per-command overrides exist (e.g. `systems-thinking` declares `surface: F.2`, `causal`/`mos-reason` are A6, `jtbd` is A5). The archetype must be declared per command, not inferred.
2. **A per-command `intake_spec`** - the questions a command asks BEFORE it runs. This is the navigator's deck/Feynman point generalized. Highest value on the generative commands (`present` is the flagship) and the method-setup commands (scenario-plan, think-hats, build-knowledge).
3. **Fix ~6 framework-name DRIFTS** - several commands declare a `framework:` that does not match what they run or what the Brain knows. The selector ranks and the connector registry key off `framework`, so the drift degrades routing. This is the single highest-value finding of the sweep.
4. **A dependency on Phase 144.1 (connector retrofit)** - many high-value commands (hat-briefing, persona, the RS-pipeline, the generative/view set) are NOT in `data/connector-registry.json`, so the Phase 148 selector cannot route to them. Spine-wiring is the prerequisite for archetype-from-`connector.surface`.

---

## 1. Three cross-cutting findings (read these first)

### Finding A: most commands are NOT methodology-backed - the split is structural
The 92 commands split cleanly into **methodology-backed** (a real `framework`, a Brain match, a `connector` block, files evidence) vs **workflow/infra** (config, navigation, render, scheduler). Phase 152 must NOT push infra commands through the methodology-A1 intake path. Rough split per family: methodology commands cluster in the METHODOLOGY (12/15), PERSPECTIVES (all 6), EXPLORE-ANALYZE (8/10), INTELLIGENCE-ENGINES (most) families; infra/workflow dominates EXPLORE-WORKFLOW (only 3/15 methodology), VIEW-ADMIN (setup/update/doctor pure infra), and the generative VIEW-EXPORT set (mechanics, not methodology - except `present`).

### Finding B: framework-name DRIFTS (highest-value, fix in the 152 sweep)
| command | declares framework | actually runs / Brain says | fix |
|---|---|---|---|
| **build-thesis** | "PWS Value Proposition" (3-question ARINC) | a **Ten-Questions** investment thesis gate | mint a distinct "Investment Thesis / Ten Questions" handle, or document the VP-superset relationship |
| **find-analogies** | "Four Lenses of Innovation" (zero Brain presence) | SAPPhIRE + TRIZ Design-by-Analogy | re-point to the SAPPhIRE/TRIZ cross-domain anchor |
| **whitespace** | "HSI Semantic Surprise Analysis Assistant" | **White Space Mapping** (Utterback/Christensen - a real distinct Brain anchor) | re-point to "White Space Mapping" |
| **score-innovation** | "HSI..." (promises compute) | qualitative Socratic assessment (runs NO HSI math) | wire it to the HSI scripts OR rename to reflect the qualitative reality |
| **diagnostics** | "HSI..." | 4 Wave-1 algorithms (CD/blindspot/novelty/surprise) | rename to "Wave-1 Fingerprint"; coordinate with the v1.14.0 rename to /mos:fingerprint |
| **explore-trends** | "S-Curve Analysis" | "Trending to the Absurd" (broader than S-Curve) | note the handle under-describes the verb |
Plus a `hierarchy_rank: 3` COLLISION (whitespace + score-innovation) and stale `help_jtbd` strings on `models` ("Browse 25 methodology models" - it's model-routing config) and `radar` ("where your room is strong/weak" - it tracks Claude capabilities).

### Finding C: two intake archetypes + the "one load-bearing question" rule
- **Method-setup intake** (think-hats, scenario-plan, build-knowledge, leadership, the analyze-* set): the questions ARE the framework's own opening steps (which problem + which hat sequence; which horizon + which two axes + axis poles; climb up or down). The single load-bearing question per command is the framework's pivot - skip it and you get a generic lecture (the §12b anti-pattern). Flag exactly one "do-not-fire-without-it" question per command in its `intake_spec`.
- **Self-description / generative intake** (compare-ventures, present, the export set): describe-your-thing + options; the engine/Brain does the rest. NOTE: compare-ventures must NOT ask "against which ventures?" - the Brain selects the cohort by semantic similarity (the navigator's instinct here was wrong against the shipped mechanic).

---

## 2. Master per-command matrix (condensed, by family)

Legend: archetype A1 single-pick / A2 multi-select capture / A3 compose-chain / A4 confirm-destructive / A5 browse-navigate / A6 long-running-spinner / A7 generate-artifact. M=methodology-backed, I=infra/workflow.

### START (7)
| cmd | arch | M/I | Brain framework | key intake |
|---|---|---|---|---|
| new-project | A7 | M (spine, framework:null router) | "Un-Defined to Well-Defined" arc | formalize the 7 venture questions (Step 3) into intake_spec |
| onboard | A7+A5 | M (not spine-wired) | none (teaching wrapper -> hands to a framework) | mode Select + A/B/C capture method |
| splash | A7 | I | none (decorative) | none - the De Stijl identity reference card |
| help | A5->Group-MultiSelect | I | none (help-groups.json) | the 4 lanes ARE the selector; per-lane recommended marker |
| rooms | A5 (+A4 on archive/close) | I | "Portfolio Approach to Innovation" (thematic) | confirm on destructive sub-paths |
| room | A5 | I (view over room.db) | none (it's the Map detail panel) | linkify -> A4 confirm |
| mos | A5 | I (router; GSD /gsd:progress analog) | none | zero-intake by design |

### METHODOLOGY (15)
beautiful-question A1/M (Beautiful Question, MATCH) | root-cause A1/M (RCA, MATCH; note connector surface F.2) | user-needs A1/M (JTBD) | analyze-needs A1/M (JTBD; GATING intake on segment) | map-unknowns A1/M (Knowns-Unknowns Matrix) | challenge-assumptions A1/M (Red Teaming; reach=contradiction; multi-select over assumption nodes) | **jtbd A5/I** (state command, NOT methodology - mis-grouped) | structure-argument A1/M (Pyramid+MECE dual-framework) | lean-canvas A1/M (thin Brain coverage) | value-proposition A1/M (PWS VP 3-gate; preserve file/name split) | mullins A1/M (Seven Domains, strong) | **build-thesis A1/M - DRIFT** (declares PWS VP, runs Ten-Questions) | mva-brief A3/M (pipeline, framework:null, hook-fed) | mva-option A3/A4 (router) | mos-reason A6/M (section-walking MINTO generator).

### PERSPECTIVES (6) - the intake-design exemplars
think-hats A1/M (Six Hats MATCH; load-bearing intake = hat sequence via BONO 4-pattern) | hat-briefing A2/M (reader; NOT spine-wired; intake = occasion) | persona A2/M (parallel hats; NOT spine-wired; subcommand fork IS the intake; constitutionally research-FREE) | scenario-plan A1/M (Scenario Planning, strongest grounding; load-bearing intake = the two axes) | compare-ventures A5/A6/M (Brain-REQUIRED; self-description intake, Brain selects cohort) | leadership A1/M (Adaptive Leadership; detect-over-ask; ONE opening question, NOT a form).

### INTELLIGENCE-ENGINES (13)
brain-derive A6/I-meta | **find-analogies A1/A6 - DRIFT** | find-bottlenecks A6/M (Reverse Salient MATCH; the canonical A6) | find-connections A1/M (Usher; Brain-gated; under-wired 2nd-domain step) | rs-fetch A6/M (RS, flagship A6; NOT spine-wired) | rs-thesis A5/M (lookup; needs a discovery_id PICKER, NOT spine-wired) | rs-experts A5/M (NOT spine-wired) | rs-explain A1-Text/M (NL interface; autonomous_safe:false; NOT spine-wired) | **diagnostics A6 - DRIFT** (4 Wave-1 algos, ->/mos:fingerprint) | **score-innovation A1 - DRIFT** (qualitative, runs no HSI) | **whitespace A6 - DRIFT** (really White Space Mapping; 7-subcommand intake) | dominant-designs A1/M (Utterback-Abernathy, clean MATCH, lowest-cost retrofit) | auto-explore A7/A6 (Desktop hook-fallback; file-path intake).

### EXPLORE-ANALYZE (10)
explore-domains A1/M (5-lens, spine SENS-01) | **explore-trends A1/M - drift** (S-Curve vs Trending-to-Absurd) | explore-futures A1/M (Scenario; two-axis intake; sensor_triggers:[]) | macro-trends A1/M (PEST; PEST-axis multiSelect - cleanest intake case) | systems-thinking A1/M (**declares surface F.2 - the override the naive map gets wrong**) | analyze-systems A1/M (Nested Hierarchy; 3-level cap intake) | analyze-timing A1/M (S-Curve; "demand specificity" = intake validation) | causal A6/I (graph-write; hand-rolled accept/reject intake; NOT spine-wired) | **models A5/I** (model-routing config; stale help_jtbd) | **memory A5/I** (memory-layer inspector, Part 9 infra).

### EXPLORE-WORKFLOW (15) - mostly infra (only 3 methodology)
act A3/I-meta-runner | file-meeting A2/I-meeting (rich intake = the reference impl; paragraph_preview first-reward) | pipeline A3/I-meta | **research A6/M** (Hypothesis-Driven Problem Solving - confirmed Brain node; the exemplar intake_spec: topic+lens+filing) | **validate A1/M** (JTBD importance-satisfaction; thin body, needs real intake) | operator A5/I | feynman-timeline-refresh A5/I-utility | dial-memory-refresh A5/I (RS connector label but renders a memory section) | graph A5/I (NL->SQL; free-text intake) | suggest-next A5/I-meta (Navigation Engine made visible) | explain-decision A5/I (audit trace) | scout A6/I-intelligence (5 sentinel scans) | speakers A5/I-meeting | opportunities A6+A5/I (Opportunity Bank; scan=A6, list=A5) | funding A5+A4/I (grant lifecycle).

### VIEW-ASSESS + ADMIN (10) - three tiers
Brain-calibrated assessors: **grade A6/M** (Triple Validation Compass; Brain-optional, Tier-0 fallback; calibration-distribution first-reward) | **deep-grade A6/M** (Triple Validation Compass; Brain-REQUIRED, hard refusal path, 3+ section gate) | **build-knowledge A6/M** (Ackoff DIKW; up/down direction = first intake question) | **diagnose A5/M-light** (Problem Taxonomy; Text problem-description intake -> ranked command Select). LOCAL re-compute: status A5/I (LOCAL pane) | reanalyze A4/I (cascade re-compute confirm). Pure infra: setup A4/I | update A4/I | doctor A4/I (richest infra: diagnostic-class multiSelect; resist methodology treatment). Odd-one-out: radar A5/I (SIGNAL/capability tracking, NOT Brain).

### VIEW-EXPORT + PUBLISH + VISUALIZE (9) - the generative family (none spine-wired)
**present A7/M** (Feynman+Minto; THE flagship intake; visual-Feynman-per-slide NATIVE; PDF gap) | export A7+A4 (the ONLY PDF-native command; 7-type Select) | vault A4+A7 (mode/path/in-place confirm) | snapshot A7 (door-selection multiSelect) | publish A4 (live deploy confirm; sections multiSelect) | dashboard A5 (viewer; absorbs visualize --mermaid) | wiki A5 (document view) | scheduled-tasks A4/I (Cowork scheduler; exclude from visual sweep) | visualize DEPRECATED (soft-alias -> dashboard; skip).

---

## 3. The intake layer design (the §12b deliverable)

### The generative class (present is the flagship)
`present` needs the full intake, and it is the navigator's exact example:
- **topic** ("what is the deck about") -> Text
- **audience** ("who is it for") -> Select over the **Canon Part 8 9-role taxonomy** {Investor / Customer / Internal / Academic / Founder / Researcher / Operator / Mentor / Domain-Expert / Student} - the missing semantic input across the WHOLE family today; costs only a Select, reuses the team taxonomy
- **which views** -> multiSelect {Dashboard, Wiki, Deck, Insights, Diagrams, Graph}
- **theme** -> Select {dark De Stijl / light PWS} - already plumbed in `generate-presentation.cjs --theme`, just not asked; the lowest-cost highest-signal toggle across all generators
- **visual options** -> multiSelect {SVG, CSS, animation, **PDF download**, **visual-Feynman-per-slide**}
- **lead-analogy** -> Select (MOSDeckEngine Stage 4 gate)

**PDF asymmetry (reuse, Part 7):** `export` is the ONLY PDF-native command (`scripts/render-pdf`). Wire `present`'s "PDF download" toggle to call the `export` PDF path on the rendered deck - one PDF engine, not two. This closes the single biggest capability gap the intake exposes.

**visual-Feynman-per-slide is NATIVE** to MOSDeckEngine (diagrams-over-bullets, mental-model-as-visual) - it is a first-class multiSelect toggle, not new work.

### The method-setup class
One load-bearing question per command (the framework pivot): scenario-plan = the two axes; think-hats = the hat sequence (pull BONO 4-pattern, don't ask cold); build-knowledge = climb up/down; analyze-timing = the "demand specificity" technology guard (intake validation); persona = the subcommand fork; compare-ventures = your current frameworks (the co-occurrence query key).

### The infra/confirm class
setup/update/doctor/vault/publish/reanalyze = A4 confirm cards, NOT intake question sequences. doctor's diagnostic-class multiSelect is the one infra command that LOOKS like a 12b intake - resist; it has no framework.

---

## 4. Connector-spine gaps (Phase 144.1 dependency, blocks 152 archetype resolution)

NOT in `data/connector-registry.json` (cannot be routed by the Phase 148 selector): onboard, hat-briefing, persona, rs-fetch, rs-thesis, rs-experts, rs-explain, brain-derive, causal, act, pipeline, suggest-next, graph, speakers, file-meeting, feynman-timeline-refresh, explain-decision, AND all 9 of the generative VIEW-EXPORT set. The RS-pipeline absence is the precise "exists but not surfaced - reachable only by magic words" gap the keyboard-TUI research flagged. Phase 152's `intake_spec` rollout MUST be paired with (or follow) Phase 144.1 adding connector frontmatter to these, especially the 5 unwired RS-pipeline commands.

---

## 5. Phase 152 determination (the spec this research produces)

**Phase 152 delivers:**
1. An `interaction_archetype: A1..A7` frontmatter field on all ~92 commands (declared, not inferred; honor per-command `connector.surface` overrides like systems-thinking F.2).
2. An `intake_spec` per command (fields -> components), with the generative class getting the full topic/audience/views/theme/visual-toggles intake and the method-setup class getting its one load-bearing question.
3. A renderer that runs the intake (AskUserQuestion sequence) BEFORE invoking the command, degrading to a printed De Stijl card on non-TTY.
4. The ~6 framework-name drift fixes + the rank-3 collision + the 2 stale help_jtbd strings.
5. An `archetype-map.json` + a `--check` tripwire (the Phase 122 registry pattern) so the renderer picks the component automatically and a new command can't ship without an archetype.

**Dependencies:** Phase 144.1 (connector retrofit - spine-wire the unwired commands), Phase 148 (the selector that consumes the archetypes), Phase 149 (the graph the intake results file into). **Reuse:** the AskUserQuestion primitive, the 9-role taxonomy (audience), the `export` PDF engine, the MOSDeckEngine visual-Feynman, `generate-presentation.cjs --theme`, the Phase 122 registry+`--check` pattern.

**Out of scope (stays later/other):** the Path A keyboard cockpit (154); the research-grounded-persona heavy track (154; NOT bolted onto the room-grounded `persona` command); De Stijl color-block painting (151/152 boundary TBD); deprecated `visualize`.

---

## 6. Sources
Per-command frontmatter (`commands/*.md`), `data/connector-registry.json`, `data/help-groups.json`, live `mcp__plugin_mos_mindrian-brain__brain_search` (Part 8 generic handles only), and the keyboard-TUI research doc Sections 12 + 12b (the archetype + intake vocabulary). 8-agent fan-out, 2026-06-08; ~1.4M subagent tokens.
