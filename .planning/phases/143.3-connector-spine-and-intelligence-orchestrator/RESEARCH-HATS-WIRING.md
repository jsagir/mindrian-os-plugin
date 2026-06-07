---
phase: 143.2
type: research+hats wiring map (the errored parallel-session branch, re-run + file-anchored 2026-06-07)
managed_under: MindrianOS-Plugin / decisions
feeds: PUSH-05 (Six-Hats/BONO), PUSH-06 (hat-scoped deep-research), the intelligence-orchestrator deep_research sub-mode
---

# Research + Hats Wiring Map

## 1. The complete hat-scoping table (vs lib/core/sensors/hat-scoping-table.cjs:33-92)

| Hat | web_enabled | tools | focus | deep_research | searches for |
|-----|-------------|-------|-------|---------------|--------------|
| White | yes | Tavily, arxiv | data-and-research | NO | data, foundational research, primary sources |
| Green | yes | patents, arxiv, deep-research | innovation | YES | patent landscapes, cross-domain solutions, novel approaches |
| Black | yes | Tavily, arxiv | failure-and-risk-cases | NO | failure modes, risk scenarios, cautionary examples |
| Yellow | yes | Tavily, arxiv | success-and-benefit-cases | NO | success stories, benefits realized, positive outcomes |
| Red | NO | (empty) | intuition-only | NO | no external tools - internal reasoning / expert intuition |
| Blue | yes | synthesis | synthesis-across-hats | NO | meta-synthesis across hats, integration of contradictions |

Default (unknown hat) = White-like; never auto-enables deep_research. `hatScopeFor(hat)` (hat-scoping-table.cjs:92) returns the scope; `activeHat(turn, ctx)` selects the hat.

## 2. SENS-04 external-fact dispatch (lib/core/sensors/sensor-external-fact.cjs)
Fires on EXTERNAL_FACT_PATTERNS (state-of-the-art / competitor / market / benchmark / prior-art / "what others are doing"). Reads activeHat -> hatScopeFor; Red or web_enabled=false -> returns null (intuition path). Else: classifies WHICH category (generic topic handle, never user text - Part 8), selects reach_id (`deep_research` if scope.deep_research===true [Green], else `context_block`), checks preconfiguredTool (skip gate) else toolChoiceGate=true (Tavily/Firecrawl/Exa), returns makeReach with posture push_forward, dispatch 'mos:research (hat-scoped WebSearch)' (NOTE: this raw handle must be resolved to the framework "Hypothesis-Driven Problem Solving" -> resolver per WFL-01, not passed as a slug), evidence = topic handle + hat + focus + tool-choice flag. NO turn text, NO artifact body.

## 3. /mos:research pipeline (commands/research.md + Phase 131) - 7 stages
1. PRE-FLIGHT (research-context-extractor.cjs): read 8 inputs via navigation.cjs (active workflow, JTBD, operator, section, memory_event tail, evidence gaps, prior-research dedup via Pinecone, persona role_blend). 2. CONTEXT SUMMARY (one Shape-A paragraph BEFORE fetch). 3. LENS-SET (section gap -> scholarly/industry/patent; JTBD -> brain lens; persona -> weighted). 4. EXECUTION (source-lens-driver.cjs over the SHARED Phase 130.5 corpus; dedup; rank by evidence-tier + claim-graph relevance; top 5). 5. FINDINGS (5 with title + summary + source + URL + retrieved_at + evidence_tier + candidate-section % match). 6. F.1 FILING SELECTOR (primary / secondary / split / defer / reject). 7. WIRING (findings-wirer.cjs: ACCEPT -> EvidenceClaim node review_status=proposed + INFORMS edge + research_filed memory_event; REJECT -> REJECTED_BECAUSE; DEFER -> research_deferred). Called-BY mode returns only EvidenceClaim node IDs (Part 8). autonomous_safe=true; emits_evidence_claims=true; framework = "Hypothesis-Driven Problem Solving".

## 4. Appendix-E 5 handoff triggers (PUSH-05 BONO routing)
| Trigger | -> Hat | Decision-Gate line | framework |
|---------|--------|--------------------|-----------|
| Risk surface (Yellow finds risk) | Black | "Black Hat Devil's Advocate ready. Accept, reshape, or stay with Yellow?" | Red Teaming / Due Diligence |
| Evidence thin | White | "White Hat Researcher ready. Research <topic>, or proceed?" | Hypothesis-Driven Problem Solving (-> /mos:research) |
| Plan without owner | Blue | "Blue Hat Orchestrator ready. Map execution, or stay creative?" | (operationalization) |
| Navigator stuck / circular | Red | "Red Hat Mentor ready. Step back, or push forward?" | Adaptive Leadership / Beautiful Questions |
| Jargon density high | Green | "Green Hat Student ready. Reframe in human terms, or stay technical?" | Beautiful Questions |
Canon surface line: "[Incoming member] is ready. Accept, reshape, or stay where we are?" The navigator ALWAYS decides (offer, not auto-handoff).

## 5. The deep-research escalation (3 fire conditions, all plan-gated)
(a) cheap-layer-thin (local graph + Brain methodology + shallow web all exhausted - the ladder local->Brain->shallow-web->DEEP); (b) load-bearing claim Practitioner/None evidence AND venture_stage in {Well-Defined, Ready-to-Build} (Part 5); (c) active BONO hat affords it (Green/Blue). On fire: present the hat-scoped PLAN ("White searches arxiv, Green patents+deep-research, Black failure-cases - approve the angles?") -> ONLY on APPROVE does /mos:research fire. deep_research is the SANCTIONED one-reach-per-beat exception (Reach rule 6). MCP-stack-ask: surface Tavily/Firecrawl/Exa, no silent WebSearch.

## 6. The deep-research / orchestrator skill frontmatter (proposal)
```yaml
name: intelligence-orchestrator
description: The reach dispatcher. Consumes the SENS sensor spine, maps each candidate-reach to an intelligence sub-mode, applies posture + one-reach-per-beat gating, surfaces ONE as a Shape-F Decision Gate. Never auto-executes.
canon_parts: [Part 2, Part 3, Part 4, Part 8]
phase: 143.2
consumes: lib/core/insight-sensors.cjs::dispatchSensors
resolver: lib/workflow/command-resolver.cjs
reach_ids: [context_block, contradiction, cross_room, brain_consult, deep_research]   # frozen 5
posture_ids: [push_forward, hold, pull_back]                                          # frozen 3
filing: fileEvidenceWithReadback (fallback wireAccept)                                # decision 2
live_call: dispatchSensors, gated behind tier_mode (degrade to doctrine-sim at tier_0) # decision 1
allowed-tools: [Read, Bash, Agent, WebSearch, WebFetch, mcp__pinecone__search-docs, mcp__brain_*]
```
Composition: hats compose UNDER brain_consult (BONO hat-sequence is generic methodology); RS/HSI/whitespace/analogies compose under context_block/brain_consult as render labels; deep-research IS the deep_research reach. NO 6th reach-id.

## Consumer integration (sensor -> reach -> Decision-Gate -> file)
sensor fires -> reach candidate (one of 5) -> orchestrator gates to one (Intelligence Hierarchy) -> surfaces Shape-F Decision Gate -> on APPROVE: commandsForFramework(<exact name>) -> fire -> fileEvidenceWithReadback -> surfaceFileEvidenceResult (remind what landed) -> memory_event + cascade edge -> next cross-relationship scan reads it.
