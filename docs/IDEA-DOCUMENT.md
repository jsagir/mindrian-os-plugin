# MindrianOS Plugin — Complete Idea Document for GSD Ceremony

> This document captures the FULL evolution of the MindrianOS Plugin idea,
> from initial concept through architecture decisions, moat analysis, and
> technical design. Feed this to /gsd:new-project --auto for the ceremony.

---

## 1. The Origin Idea

"What if Mindrian was a set of skills, MCPs, and subagents that work in
Claude Code and utilizes Claude abilities but in the Mindrian way?"

Mindrian V2 is a full-stack web app (Next.js + FastAPI + LangGraph + CopilotKit)
with 25 specialized AI bots for PWS methodology. The insight: Mindrian's value
isn't the UI -- it's the 25 methodology prompts, the routing intelligence, and
the structured output discipline. All of that translates directly to a Claude
Code plugin.

## 2. Why a Plugin (Not an App)

- Zero infrastructure: no FastAPI, no Next.js, no CopilotKit, no Railway
- Claude Opus is smarter than Gemini at this
- Existing MCPs cover 80% of tooling (Neo4j, Tavily, ArXiv, Pinecone, Notion, Supabase)
- Skills are markdown files -- 10x easier to iterate than full-stack
- Subagents run methodology steps in parallel
- Memory system gives cross-session persistence for free
- Same plugin works in Claude Code CLI + Desktop + Cowork
- Distribution via Anthropic marketplace -- anyone with Claude can install

## 3. The Data Room IS the OS

V2 was an app with a Data Room feature. V4 IS the Data Room.

The Room is both PASSIVE (auto-captures every insight, classifies, files to
the right section) and PROACTIVE (detects gaps, contradictions, convergence,
suggests next methodology, alerts when ready for output).

8 sections: problem-definition, market-analysis, solution-design, business-model,
competitive-analysis, team-execution, legal-ip, financial-model.

## 4. Architecture: ICM + GSD + Plugin

### ICM (Interpretable Context Methodology -- paper 2603.16021v2)
- Folder structure IS the orchestration. No framework code.
- 5-layer context hierarchy: Layer 0 (identity/ROOM.md), Layer 1 (routing/ROUTING.md),
  Layer 2 (stage contracts per methodology), Layer 3 (reference/factory -- YOUR IP),
  Layer 4 (working artifacts/product -- USER'S WORK)
- "Configure the factory, not the product"
- Every output is an edit surface. Plain text as universal interface.

### GSD (Get Shit Done -- context management)
- STATE.md manages nested room hierarchy and session continuity
- Fresh subagent contexts prevent context rot
- Atomic filing with provenance. Progress tracking across phases.

### Plugin Structure
- commands/ -- 25 methodology bots + utility commands
- skills/ -- room-passive, room-proactive, connector-awareness, context-engine, pws-methodology, larry-personality
- agents/ -- larry-extended, research-pipeline, room-analyst, swarm-coordinator
- hooks/hooks.json -- SessionStart, PostToolUse, Stop
- pipelines/ -- ICM stage contracts for multi-step workflows
- .mcp.json -- Brain MCP + user Neo4j + research tools
- settings.json -- default agent = Larry

## 5. Room Hierarchy (Recursive, with STATE.md per room)

Master STATE.md aggregates full tree. Each room has own STATE.md.
Sub-rooms created when user discovers distinct opportunity spaces.
State flows bottom-up. Context flows top-down.

## 6. LazyGraph (User's Neo4j Aura Free)

Optional, /usr/bin/bash. 50K nodes. Grows lazily as user works.
Entry filed -> node created. Concept mentioned -> linked. Pattern detected -> edges.
Projects isolated by project_id. Cross-project bridging explicit only.

## 7. The Brain (Moat -- brain.mindrian.ai)

Neo4j Aura Agent deployed as MCP server. 5 layers:
1. Framework Graph (21K nodes, 65K rels, chaining rules, TRANSFORMS_OUTPUT_TO)
2. Semantic Embeddings (1,427 Pinecone vectors)
3. Grading Engine (100+ calibrated projects, 5-component rubric)
4. Mode Intelligence (30+ years teaching patterns)
5. Chain Recommender (contextual framework sequencing)

Users get intelligence, never see the graph. Break-even: 5-17 subs at 9/mo.

## 8. Pipelines Chain Through the Room (Week 7)

Domain Explorer sub-domains -> Bono hat perspectives -> JTBD personas ->
Minto evidence -> Devil's Advocate assumptions -> Investment Thesis.

16 Claude Desktop project specs exist with full methodology definitions.
Each pipeline: numbered ICM stages, subagent execution, inspectable artifacts.

## 9. Methodology Extensibility

Level A: conversation bot (one .md, 5 min). Level B: full pipeline (folder, 30 min).
Level C: Brain graph integration (Neo4j nodes). Users can create custom methodologies.

## 10. Room-Triggered Intelligence

Room state drives routing: empty sections -> suggest methodology, contradictions -> alert,
pipeline outputs -> enable chaining, concept patterns -> convergence signals.

## 11. Three Surfaces (CLI + Desktop + Cowork)

Same plugin, same workspace, same CLAUDE.md, same .mcp.json. Cowork gets 00_Context/.

## 12. Tiers

FREE (/usr/bin/bash): All 25 methodologies, Data Room, pipelines. FULL functionality.
BRAIN (9/mo): + Graph enrichment, chain recs, grading, mode intelligence.
WORKSHOP (,500+): Live workshop, Brain for cohort, group rooms.
ENTERPRISE (9-499/team/mo): Team rooms, custom frameworks, SSO.

## 13. Install: One Command

claude plugin install mindrian-os -- Larry talks immediately. Zero config.

## 14. Existing Assets to Port

MindrianV2: 25 prompts, larry_skill/ (8 files), mode engine, router, 18 skills.
MindrianOS: 16 Claude Desktop projects, 5 design docs, grading rubrics, 59 tools, 59 books.
MindrianOS-Plugin: manifest, CLAUDE.md, THE-BRAIN.md, empty structure ready.

## 15. Key Decisions

1. ICM-native 2. GSD state 3. Three surfaces 4. Brain as Aura Agent MCP
5. LazyGraph optional 6. Pipelines chain (Week 7) 7. Tier 0 fully works
8. One-command install 9. Larry default agent 10. Factory/Product separation
