---
type: trigger-map
created: 2026-05-10
brain_mode: mode-a (Neo4j Aura live; the framework metadata -- TYPICAL_AT stages, ADDRESSES_PROBLEM_TYPE, FEEDS_INTO/PREREQUISITE chains, HAS_PROCESS_STEP, the "insight sensors" Question node -- was queried directly via the my-neo4j MCP per the brain-offline -> neo4j-as-brain fallback rule)
is: the rigorous version of SEED-008's "## The Trigger List" prose; the executable spec for what the activation layer (the Navigation Engine, Phase 91) must DO
status: working draft -- in-scope for v1.13.0 (maintainer directive 2026-05-10)
relates_to: SEED-008, docs/UI-UX-CONVERGENCE-2026-05-10/09-CRITICAL-FINDING-ACTIVATION-GAP.md, .planning/phases/91-navigation-engine/91-CONTEXT.md, .planning/milestones/v1.13.0-CLOSED-LOOP-ROADMAP.md
---

# The Trigger Map -- what auto-fires, on what signal, against what graph/memory state

> **Phase 91 (Navigation Engine) already shipped** (v1.11.0, 2026-05-01: `lib/core/navigation-engine.cjs` `decide()` core, the UserPromptSubmit integration that emits the `## NAVIGATION DECISION` block, the 8-field trace contract, the tier modes). What did NOT ship: the engine *wired to the graph and the Brain*. It runs in `routing_source: legacy` / `tier_mode: tier_0` -- `decide()` returns `fire_skill: null`, `offer_next_step: null` because it is reading file-presence, not the graph + BRAIN.md. **This document is the spec the shipped engine must be wired to.** Closing the loop for v1.13.0 = wire `decide()` to consume {graph state + BRAIN.md memory + this map} and populate `fire_skill` / `offer_next_step`; plus the cascade-surfacing fix (Phase 95) and the BRAIN.md derivation (so `tier_mode` rises above `tier_0`).

## 1. The signal taxonomy (6 kinds)

1. **Stage-transition** -- the venture moves Pre-Opportunity -> Opportunity Identified -> Problem Validation -> Well-Defined Problem -> Ready to Build (from STATE.md `venture_stage` + section fill levels).
2. **Problem-type shift** -- `/mos:diagnose` re-classifies (Undefined -> Ill-Defined -> Well-Defined; a Wicked dimension surfaces).
3. **Content event** -- artifact filed, meeting pasted, first material, JTBD set, external fact referenced.
4. **Conversation pattern** -- "stuck/circular", "X is the bottleneck", a stated contradiction, jargon-density spike, a decision point reached.
5. **Schedule** -- session start, weekly, daily (cron-when-available; until then `/mos:scout` is the manual stand-in -- the command says so itself).
6. **User intent** -- explicit "show me X" (the view/navigation commands; these stay user-driven).

**The meta-sensor everything else consumes: `/mos:diagnose`.** It re-runs on every content event, emits `{problem_type, complexity, stage}`, and that tuple selects which other commands fire. In the proactive design `diagnose` is not a command the user runs -- it is the classifier the engine runs continuously.

## 2. Trigger map by venture stage (the Brain's `TYPICAL_AT` axis)

| Stage | Entry signal | Commands the engine fires (Brain frameworks behind them) | Problem-type gate |
|---|---|---|---|
| **Pre-Opportunity** | New room / first material / `venture_stage: Pre-Opportunity` / domain mentioned but unbounded | `/mos:explore-domains` (Domain Selection, HSI Semantic Surprise) - `/mos:beautiful-question` (Beautiful Question Fwk) - `/mos:diagnose` (Cynefin) - `/mos:map-unknowns` (Knowns/Unknowns Matrix -> Cynefin) - `/mos:whitespace` + `/mos:score-innovation` (HSI) - `/mos:analyze-systems` (MAP THE HIERARCHY -> Hierarchy Mapping -> Systems Thinking) - `/mos:find-bottlenecks`/`find-connections`/`find-analogies` (Reverse Salient Analysis) - `/mos:explore-trends`/`explore-futures`/`macro-trends`/`scenario-plan` (Scenario Analysis, Oracle Foresight) - `/mos:opportunities` (Opportunity Recognition as Pattern Recognition) | Undefined Problem |
| **Opportunity Identified** | `explore-domains` produced a bounded domain / `problem-definition` starts filling / `venture_stage` advances | `/mos:analyze-needs` (Design Thinking -> JTBD -> Process Mapping for Innovation) - `/mos:user-needs` (ODI / importance-satisfaction) - `/mos:think-hats`/`persona`/`hat-briefing` (Six Thinking Hats / BONO-Innovation) - `/mos:dominant-designs` (Sustaining vs Disruptive) - `/mos:root-cause` (Root Cause Analysis) - `/mos:systems-thinking` (Causal Loop, Stock-and-Flow) - rs-fetch (Algorithmic Reverse Salient) - `/mos:reanalyze` (the cascade scan) | Ill-Defined Problem |
| **Problem Validation** | `market-analysis`/`competitive-analysis` filling / a thesis being drafted / `/mos:diagnose` says "Well-Defined wearing an Ill-Defined disguise" | `/mos:structure-argument` (MECE -> Pyramid Principle) - `/mos:challenge-assumptions` (Red Teaming, Opposite Plan; PREREQUISITE: Six Thinking Hats) - `/mos:grade`/`deep-grade` - `/mos:validate` | Well-Defined Problem |
| **Well-Defined Problem** | `problem-definition` MINTO has a crisp governing thought / moving toward a commit decision | `/mos:value-proposition`/`mullins`/`build-thesis` (PWS Triple Validation Compass -> Mullins, Financial DD) - `/mos:lean-canvas` - Problem Definition Transformation Framework - Hypothesis-Driven Problem Solving - Hedgehog Concept | Well-Defined Problem |
| **Ready to Build** | Funding/hiring/launch decision near / team section fills | `/mos:leadership` (Adaptive/Servant/Situational/Distributed Leadership, First Who Then What, Five Practices) - `/mos:build-thesis` DD frameworks (Financial/Legal/IP/ESG) - High-Performing Teams - Strategic Decision Making | Well-Defined; or a Delegation Gap / Team Conflict / Scaling Leadership subtype |

**Across all stages:** `/mos:think-hats` + `/mos:persona` (Engine 2 / BONO) fire whenever a *team perspective* is warranted (the BONO classifier picks the hat sequence from `{problem_type, complexity}`). `/mos:beautiful-question` re-fires on the "stuck/circular" pattern regardless of stage (Reformulate). `/mos:challenge-assumptions` re-fires on any "None-tier claim near a commit stage" or stated contradiction. `PWS Value Proposition` is the one framework the Brain tags `TYPICAL_AT` *every* stage -- it is the spine, not a phase.

## 3. Event-driven sensors (cross-stage)

| Signal | Fires | Reads | Writes |
|---|---|---|---|
| **Artifact filed** | the cross-relationship cascade scan -> `/mos:reanalyze` / room-proactive surfacing | the new artifact body + the section's existing claims + the assumption registry | new INFORMS/CONTRADICTS/CONVERGES/INVALIDATES/ENABLES edges; a `RAN {framework}` edge from the navigator; (Phase 95 fixes the side-channel so the findings reach Larry mid-session) |
| **Meeting transcript pasted** | `/mos:file-meeting` | the transcript | meeting node + speaker nodes + segment artifacts + edges into the relevant sections |
| **JTBD set / changed** | re-weight selector menus + re-weight Brain queries via `ADDRESSES_PROBLEM_TYPE` | the JTBD signal + the room's framework-chain cache | `serves_jtbd` re-weighting on the next-move menu (Phase 104) |
| **External-fact reference** (competitor / market / state-of-the-art) | `/mos:research` / WebSearch, **hat-scoped** (White=data/arxiv, Green=patents, Black=failure-cases) | the conversation + the room's competitive-analysis claims | a sourced artifact with provenance; a CONTRADICTS edge if the web finding conflicts with a room claim |
| **"Lagging component" pattern** | `/mos:find-bottlenecks` / rs-fetch | the artifact corpus (similarity) + the section fill levels | REVERSE_SALIENT edges; candidate Opportunity Bank ADDs (HSI-scored) |
| **Contradiction stated / None-tier claim near commit** | `/mos:challenge-assumptions` (Red Teaming) or the Devil's-Advocate hat | the claim + its evidence tier + the stage | a stress-tested resolution; a DEFER or REJECT-with-reason edge |
| **Decision point reached** | `/mos:diagnose` (re-classify) -> route to the stage-appropriate command; surface via the Decision Gate (Shape F) | STATE.md + the local graph + the methodology cache | the routing decision; a `CHOSE {verb}` edge after the navigator picks |
| **Milestone / gate approach** | `/mos:deep-grade` + breakthrough scan (Category G) + investor-objection surface | the whole room + the calibration corpus | a grade artifact; breakthrough candidates; objection list |
| **Funding/grant domain match** | `/mos:opportunities` / `/mos:funding` scan | the room's domain keywords + cached grant data | new opportunity-bank entries (HSI-scored) |
| **DEEP-RESEARCH ESCALATION (added 2026-05-10)** | `/mos:research` deep mode / rs-fetch `external` / the `gsd-phase-researcher`-style multi-source dive | the cheap-layer result (local graph, Brain methodology lookup, shallow web) + the claim's evidence tier + the stage + the active hat | a sourced artifact with full provenance (Canon Part 8: SIGNAL -> LOCAL: YES; SIGNAL -> Brain: NO); a tier-lift on the claim if a higher-tier source is found | see Section 3a |

### 3a. The deep-research escalation sensor (strictest gate on the map)

Deep research is expensive (latency, API cost, tokens). It is NOT a default sensor -- it is an *escalation* trigger. Fire it when **ANY** of:
- **(a) Cheap layer thin** -- the local graph has no relevant artifacts, the Brain methodology lookup did not help, a shallow web search was inconclusive. (Escalation ladder: `local graph -> Brain methodology -> shallow web -> DEEP RESEARCH`.)
- **(b) Load-bearing claim, low evidence, near commit** -- a claim that is in the thesis or near a commit decision has evidence-tier Practitioner-or-None and the venture is at "Well-Defined Problem" or "Ready to Build" (Canon Part 5: the bar rises near a commit; deep research fires to try to lift the claim's tier to Academic/Operational).
- **(c) Hat affordance includes it** -- the BONO hat -> tool mapping: White Hat -> data/arxiv; **Green Hat -> patents + arxiv + deep-research** (the innovation lane); Black Hat -> failure-case/risk searches.

**Scoped by** the hat (above) **and the section**: `competitive-analysis` near commit -> deep research on the competitor / market segment; `legal-ip` -> the patent landscape; `financial-model` -> comparables/unit economics; a new domain at Pre-Opportunity with no internal corpus -> deep research to *seed* the room before the team spawns (extends Engine 1's Act-1 surface when the Pinecone embedding coverage is thin).

**Tool choice** (per the maintainer's MCP-stack rule): when the deep-research trigger fires, the engine surfaces a quick Decision Gate -- "this needs a deep dive -- Tavily / Firecrawl / Exa?" -- UNLESS pre-configured per hat (recommended: White Hat always uses arxiv-via-X, etc., so the Gate fires only on ambiguity -- otherwise the "ask which tool" friction undoes the "acts without being asked" win). No-ask exceptions: Context7 for library docs, Pinecone over the user's own indexes.

## 4. Scheduled sensors

| Cadence | Fires | Notes |
|---|---|---|
| **Session start** | the opportunity scan (CLAUDE.md: "session-start IS the trigger") - BRAIN.md staleness scan + brain-derivation-queue drain - post-compact re-injection - the navigation-engine per-turn routing - `/mos:onboard`/`new-project` if no room exists | Most of these do not actually fire today -- that is the activation gap |
| **Weekly / session-start-throttled** | `/mos:scout` -- the full sentinel suite: snapshot + health-check + deadline-monitor + competitor-watch + HSI-recompute + opportunity-scan + efficiency-telemetry. Sub-sensors: whitespace recompute, reverse-salient detection, opportunity-bank scan, competitor watch | The command's own doc: "CronCreate deferred; until then `/mos:scout` is the manual trigger." It must be on the auto list. Prereq: the 5 scout bugs (SEED-008 "Hard prerequisite"). |
| **Daily** (cron-when-available) | deadline monitor (expanded to scan `.planning/STATE.md` phase deadlines, not just `funding/`) | scout bug #5 |

## 5. Meta / orchestrator commands (workflow-state or user-intent triggered, not content-triggered)

- **`/mos:diagnose`** -- the router / meta-sensor. Runs implicitly on every content event; its `{problem_type, complexity, stage}` output is the input to all the stage/event sensors above.
- **`/mos:suggest-next`** -- *is* the trigger-list-as-a-command. In the proactive design it becomes implicit (the Navigation Engine surfaces the next move via the Decision Gate without being asked); the command stays as a fallback.
- **`/mos:act`** -- the engine taking the next step *itself* (with a Decision Gate confirmation), not just suggesting it.
- **`/mos:pipeline`** -- the engine builds a multi-step run from the `FEEDS_INTO` chain (e.g. Design Thinking -> JTBD -> Process Mapping -> Reverse Salient -> PWS VP).
- **View/navigation commands** (`/mos:status`, `room`, `rooms`, `wiki`, `dashboard`, `visualize`, `present`, `graph`, `query`, `organize`) -- stay **user-intent triggered**. The engine may *suggest* "want to see the graph?" when a finding warrants it, but does not auto-open them.
- **`/mos:reason`** (Feynman-MINTO) -- fires on a **memory-event**: a section's governing thought changes (post-regen hook) -> re-derive MINTO -> enqueue brain-derivation. Today it is manual (which is how we hit FEYNMINTO-01 on a 46-artifact section).

## 6. The local-graph contract (what every trigger touches)

**Reads:** the section's MINTO governing thought - the typed edges (INFORMS/CONTRADICTS/CONVERGES/INVALIDATES/ENABLES) - the decision history (`CHOSE`/`RAN` edges) - the assumption registry (validity status per claim) - the artifact corpus (similarity/whitespace) - the persona-blend (role weights x journey stage) - the `venture_stage` - the cross-room registry.
**Writes:** every methodology run -> an artifact node + the cascade edges + a `RAN {framework}` edge - every Decision Gate choice -> a `CHOSE {verb}` edge carrying the three contexts + reason + timestamp - every rejection -> a `REJECTED {reason}` node (rejection is data) - HSI/reverse-salient runs -> `REVERSE_SALIENT` edges - `/mos:diagnose` -> the `{problem_type, complexity, stage}` tuple on the room node.
**The engine reads STATE.md + the graph + the methodology cache -> emits the routing decision.** Today it emits `routing_source: legacy` because it is NOT reading the graph -- it is reading file-presence. Wiring it to read the graph is the load-bearing fix (the shipped Phase 91 `decide()` + the Phase 109 SQL spine + the trigger map above).

## 7. The memory-context contract (the 3 layers)

| Layer | Read by a trigger | Written by a trigger |
|---|---|---|
| **Within-session** | Claude's context; the `## NAVIGATION DECISION` block; `additionalContext` injections | the conversation; the cascade-finding injection (Phase 95 side-channel) |
| **Across-session** | the Feynman-MINTO triple (MINTO.md per section) + the **BRAIN.md quadruple** (Pattern Matches, Cross-Domain Analogies, Wicked Indicators, Unfilled-Opportunity Matches, Framework-Chain Predictions, Assessment Thinking-Chain Position, Problem-Type Classification, Cross-Room Contradiction Flags) -- *this is what lifts the engine above `tier_0`* | a methodology run that changes a governing thought -> re-derive MINTO -> enqueue brain-derivation -> (drain ->) BRAIN.md updated |
| **Cross-room** | the cross-room contradiction aggregator (reads `.rooms/registry.json`, walks sibling rooms) | a cross-room CONTRADICTS flag surfaced into the room |

## 8. The closed-loop cycle

`content event -> /mos:diagnose re-classifies {problem_type, complexity, stage} -> engine reads {graph state + BRAIN.md memory + this map} -> fires the stage/event-appropriate command(s) -> command produces an artifact -> filing writes {artifact node + cascade edges + RAN edge} -> cascade scan surfaces findings to Larry -> Decision Gate: navigator APPROVE/REJECT/DEFER -> writes {CHOSE/REJECTED edge} -> memory update: re-derive MINTO + enqueue brain-derivation -> next content event reads a richer graph + a fresher BRAIN.md ->` ...

Today the loop is broken at 4 of 5 links: *content event -> diagnose* (the classifier runs but the engine does not consume it -- `routing_source: legacy`); *cascade scan -> Larry* (Phase 88.1-03, never delivered); *re-derive -> BRAIN.md* (the queue does not drain); *BRAIN.md -> engine* (often absent -> `tier_0`). "Files" is the only intact link. (Canon Part 9, exactly.)

## 9. What this means for v1.13.0 (maintainer directive 2026-05-10)

The trigger map is **in-scope for v1.13.0**. Concretely, the v1.13.0 work that makes it real:
1. **Wire the shipped Phase 91 engine to the graph + Brain + this map** -- `decide()` populates `fire_skill` / `offer_next_step` from `{graph state + BRAIN.md + the trigger map}` instead of returning `null` in `legacy`/`tier_0` mode. Candidate vehicle: a new phase (e.g. "Phase 91.6 navigation-engine-graph-wiring", ~2-3 days) OR fold into Phase 95 (which already touches the hook envelopes) + Phase 109 (the SQL spine). This is the single change that flips `routing_source: legacy` -> `engine`.
2. **The cheap-first sensor subset for the gate** -- not the whole map at once. The "loop fires" gate (SEED-008) needs: first-material -> `explore-domains` + `whitespace` + `brain_framework_chain` (Phase 117); the cascade-surface fix (Phase 95); BRAIN.md derivation drained (so `tier_mode` rises); WebSearch fires hat-scoped on an external-fact reference. The deep-research escalation sensor (Section 3a) is desirable but NOT gate-blocking -- it can land post-gate.
3. **The sentinel/scheduled sensors** -- `/mos:scout` on the auto-trigger list requires the 5 scout bugs fixed first (SEED-008 "Hard prerequisite"; candidate Phase 95.7).
4. **The gate test** stays as SEED-008's 5-check dogfood: `routing_source: engine` not `legacy` / WebSearch fires / auto-explore on first material / cascade surfaced / BRAIN.md derived. The trigger map is the *spec*; the 5-check test is the *acceptance*.

This document + SEED-008 + `09` together are the activation-layer's full spec for v1.13.0. Phase 91 built the shell; v1.13.0 wires it.
