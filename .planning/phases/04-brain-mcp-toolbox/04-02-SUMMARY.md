---
phase: 04-brain-mcp-toolbox
plan: 02
subsystem: brain-mcp
tags: [neo4j, pinecone, graphrag, tavily, agents, cypher, grading, research, investor]

requires:
  - phase: 04-brain-mcp-toolbox
    provides: Brain schema reference, 8 query pattern templates, brain-connector skill
provides:
  - Brain Agent for multi-hop GraphRAG queries with neutral analytical voice
  - Grading Agent for calibrated 5-component assessment with percentile ranking
  - Research Agent for Tavily web search + Brain cross-reference with provenance
  - Investor Agent for adversarial VC review with severity-rated structured concerns
affects: [04-03-commands, 04-04-upgrades]

tech-stack:
  added: [tavily-mcp]
  patterns: [agent-voice-separation, query-pattern-delegation, provenance-metadata]

key-files:
  created:
    - agents/brain-query.md
    - agents/grading.md
    - agents/research.md
    - agents/investor.md
  modified: []

key-decisions:
  - "Each agent has an explicitly distinct voice -- none use Larry's warmth, reframes, or teaching metaphors"
  - "All agents reference query-patterns.md on demand -- zero inline Cypher in agent files"
  - "Investor Agent is adversarial by design with signature VC phrases, not a softer version of Larry"
  - "Research Agent requires user confirmation before filing to room -- no silent writes"

patterns-established:
  - "Voice separation: each agent declares what it is NOT (explicitly NOT Larry) to prevent voice bleed"
  - "Query delegation: agents load references/brain/query-patterns.md and adapt named patterns, never write raw Cypher"
  - "Provenance metadata: Research Agent files include source URL, retrieval date, relevance, Brain connections"
  - "Severity-rated output: Investor Agent uses CRITICAL/SERIOUS/MINOR tiers for structured concern prioritization"

requirements-completed: [BRAN-04, BRAN-05, BRAN-06, BRAN-07]

duration: 2min
completed: 2026-03-22
---

# Phase 4 Plan 02: Brain Specialized Agents Summary

**4 specialized Brain agents with distinct voices: GraphRAG retriever, calibrated grading engine, Tavily+Brain research analyst, and adversarial investor reviewer**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-22T12:22:07Z
- **Completed:** 2026-03-22T12:24:26Z
- **Tasks:** 2
- **Files created:** 4

## Accomplishments

- Brain Agent with 3-hop max multi-hop protocol, pattern selection guide, and neutral analytical voice
- Grading Agent with 5-component weighted scoring (vision 20%, problem 25%, feasibility 20%, market 20%, completeness 15%), percentile ranking against 100+ real projects, structured output template
- Research Agent with Tavily search + extract pipeline, Brain cross-reference via semantic search, provenance metadata on every filing, user confirmation before writes
- Investor Agent with adversarial VC persona, severity-rated concern structure (Critical/Serious/Minor), risk matrix, signature skeptical phrases, explicit anti-Larry voice rules

## Task Commits

Each task was committed atomically:

1. **Task 1: Brain Agent and Grading Agent** - `6bcc0cb` (feat)
2. **Task 2: Research Agent and Investor Agent** - `99e10e7` (feat)

## Files Created/Modified

- `agents/brain-query.md` - Schema-aware GraphRAG retriever with multi-hop protocol and pattern selection guide
- `agents/grading.md` - Calibrated 5-component assessment engine with percentile ranking and structured output template
- `agents/research.md` - Tavily web search + Brain cross-reference with provenance filing protocol
- `agents/investor.md` - Adversarial investor reviewer with severity-rated concerns and risk matrix

## Decisions Made

- Each agent explicitly declares "NOT Larry" voice rules to prevent personality bleed across agent boundaries
- All Cypher stays in query-patterns.md -- agents adapt named patterns, never write raw queries
- Investor Agent designed as genuinely adversarial (not "constructive criticism") with VC-specific language
- Research Agent requires explicit user confirmation before filing to room -- no silent artifact creation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - agents work with Brain MCP configured via `/mindrian-os:setup brain`.

## Next Phase Readiness

- All 4 agents ready for Plan 03 commands to invoke
- brain-connector skill (Plan 01) already delegates to brain-query.md
- Grading Agent ready for assessment commands
- Research Agent ready for research pipeline commands
- Investor Agent ready for challenge/review commands

---
*Phase: 04-brain-mcp-toolbox*
*Completed: 2026-03-22*
