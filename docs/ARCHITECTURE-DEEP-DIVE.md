# MindrinanOS Plugin — Architecture Deep Dive

Detailed architecture decisions from the research session.

## ICM Five-Layer Context Hierarchy

Source: Paper 2603.16021v2

| Layer | Purpose | MindrinanOS Name | Budget |
|-------|---------|------------------|--------|
| 0 | Identity | ROOM.md | ~300 tok |
| 1 | Routing | ROUTING.md | ~300 tok |
| 2 | Stage contract | Per-methodology CONTEXT.md | 200-500 tok |
| 3 | Factory (YOUR IP) | references/ + Brain MCP | 500-2K tok |
| 4 | Product (USER WORK) | room/ entries + STATE.md | varies |

Factory (Layer 3): references/methodology/, references/personality/, Brain MCP.
Product (Layer 4): room/, bank/, journal/, exports/.

## GSD Patterns Applied

| GSD | MindrinanOS |
|-----|-------------|
| STATE.md | ROOM-STATE.md (room health, methodology, mode) |
| PROJECT.md | VENTURE.md (domain, hypothesis, constraints) |
| ROADMAP.md | JOURNEY.md (PWS stage progression) |
| CONTEXT.md per phase | Per-methodology stage contracts |
| SUMMARY.md | Session journal entries |
| .continue-here.md | CONTINUE.md (session resume) |
| Fresh subagent contexts | Pipeline stages in isolated windows |
| Atomic commits | Atomic room filing with provenance |

## Neo4j Aura Agent as Brain MCP

No custom server needed. Configure Aura Agent in console (no code). Tools: Cypher Templates + Similarity Search + Text2Cypher. One-click deploy as MCP server (OAuth secured). Cost: $0.35/hr active. AuraDB Free: $0. Pro: $65/mo. Break-even: 5-17 subs at $19/mo.

Cypher templates: suggest_chain, enrich_context, get_chaining_rules, grade_room, find_connections, get_framework_phases, get_teaching_context.

## Pipeline Chaining Rules (Week 7)

| Source | Output | Target | Becomes |
|--------|--------|--------|---------|
| Domain Explorer | Sub-domains | Bono | Hats (per perspective) |
| Domain Explorer | Sub-domains | JTBD | Personas (per stakeholder) |
| Domain Explorer | Sub-domains | Scenario | Uncertainty axes |
| Bono | Hat insights | JTBD | Context per persona |
| Bono | Hat insights | Minto | Evidence for pyramid |
| JTBD | Unmet jobs | Minto | SCQA complication |
| JTBD | Unmet jobs | Devils Advocate | Assumptions to test |
| Minto | Thesis | Devils Advocate | Target for destruction |
| Minto | Thesis | Investment Thesis | Core thesis |
| Devils Advocate | Survivors | Investment Thesis | Validated evidence |
| HSI | Bridges | Domain Explorer | New domains |
| Reverse Salient | Bottlenecks | Minto | Complication framing |

Standard Chains:
- A (Problem-to-Thesis): Domain Explorer > Bono > JTBD > Minto > DA > Investment
- B (Discovery-to-Validation): HSI > Domain Explorer > Validation > Minto
- C (System Analysis): Domain Explorer > Reverse Salient > JTBD > Bono > Minto
- D (Full Venture): Domain Explorer > HSI > Bono > JTBD > Scenario > Minto > DA > Investment

## Room-Triggered Intelligence

Section triggers: problem-definition empty > /larry; >5 entries > /redteam; market-analysis empty > /research + /domain; competitive empty > auto web research; solution empty + problem strong > /pipeline cross-domain; business-model empty + solution exists > /pipeline investment-thesis; ALL >3 > /grading.

Stage triggers: Un-Defined > Domain Explorer, TTA, Scenario, S-Curve. Ill-Defined > JTBD, Ackoff, BQ, Knowns. Wicked > Bono, RS, Nested. Well-Defined > Minto, Validation, Investment, Grading.

Pipeline triggers: DE sub-domains > enable Bono (hats), JTBD (personas). Bono done > Minto. JTBD jobs > DA. Minto thesis > Investment. HSI bridges > new DE.

Session triggers: 2+ redirections > follow-mode. idle >5min > surface gap. turn >8 > saturation. returning > brief.

## Connector Awareness

Tier 0 (no MCPs): embedded references/ + files. Full functionality.
Tier 0.5 (user Neo4j): + LazyGraph structural detection.
Tier 1 (Brain): + graph enrichment, chain recs, grading, mode intelligence.
Never fail on missing MCP. Never tell user about degradation.

## LazyGraph Node Taxonomy

(:Project) > (:Room) > (:Section) > (:Entry). (:Concept) > [:MENTIONED_IN] > (:Entry). (:MethodologyRun) > [:PRODUCED] > (:Entry). Entry edges: SUPPORTS, CONTRADICTS, DERIVED_FROM, PROMOTED_TO, VALIDATED_BY, KILLED_BY. Pipeline edges: USED_AS_HAT, USED_AS_PERSONA, STRUCTURED, BUILT_ON. Cross-project: (:Bridge) explicit opt-in. All nodes carry project_id.

## Workspace Structure

ROOM.md, ROUTING.md, STATE.md (master). room/ (8 sections), rooms/ (recursive). references/ (Layer 3), pipelines/ (ICM stages). .planning/ (VENTURE.md, ROOM-STATE.md, JOURNEY.md, CONTINUE.md). bank/, journal/, exports/, 00_Context/, scripts/.

## Three Surfaces

CLI + Desktop: share CLAUDE.md, .mcp.json, hooks, skills. Cowork: 00_Context/ (auto-gen from STATE.md). Scheduled tasks: daily briefings, weekly graph health.

## Business Model

FREE ($0): All 25 methodologies, Data Room, pipelines, LazyGraph. BRAIN ($19/mo): + graph enrichment, chain recs, grading. WORKSHOP ($2,500+): Live, Brain for cohort. ENTERPRISE ($99-499/team/mo): Teams, custom frameworks, SSO.
