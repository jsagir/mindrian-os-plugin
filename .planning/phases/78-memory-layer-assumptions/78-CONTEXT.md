# Phase 78: Memory Layer + Assumptions - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase -- discuss skipped)

<domain>
## Phase Boundary

Add memory layer tables (L0-L3) and assumption tracking to the SQLite room.db created in Phase 77. Users get persistent memory across sessions (Larry remembers identity, facts, session history) and first-class assumption tracking with validity lifecycle.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion -- infrastructure phase. Key constraints from research and conversation:

- Add tables to EXISTING room.db (Phase 77 foundation) -- same better-sqlite3 database, same WAL mode
- Schema from milestone design conversation:
  - `identity` table (L0): key-value for venture_name, founder, stage, one_liner (~50 tokens always loaded)
  - `facts` table (L1): subject, predicate, object, confidence, source_artifact, source_meeting, valid_from, invalidated_at, invalidated_by
  - `sessions` table (L2): started_at, ended_at, summary, key_decisions (JSON), open_questions (JSON), methodology_used, artifacts_filed (JSON)
  - `fragments` table (L3): session_id FK, role, content, timestamp, section_context
  - `assumptions` table: id, claim, section, validity (untested/supported/contradicted/stale), evidence_for (JSON), evidence_against (JSON), created_at, last_tested, invalidated_at
- Add indexes on: facts.subject, facts.invalidated_at, fragments.session_id, assumptions.section, assumptions.validity
- Create new module: lib/core/memory-ops.cjs (parallels lazygraph-ops.cjs pattern)
- Functions needed: getIdentity, setIdentity, addFact, invalidateFact, getValidFacts, startSession, endSession, addFragment, getSessionHistory, createAssumption, updateAssumptionValidity, getAssumptions
- Schema migration: initSchema in lazygraph-ops.cjs should also create memory tables (or memory-ops.cjs calls its own initSchema on same db)
- MemPalace pattern validated: temporal fact tracking with valid_from/invalidated_at is SOTA (96.6% recall)
- The local graph finds relationships INSIDE the room (CONTRADICTS, CONVERGES, INVALIDATES). Memory layer tracks WHAT the user said and believed.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- lib/core/lazygraph-ops.cjs -- Phase 77 SQLite rewrite, openGraph/closeGraph pattern, room/.mindrian/room.db
- lib/core/graph-ops.cjs -- write queue pattern with acquireLock/releaseLock
- tests/test-sqlite-ops.cjs -- 52 tests, test patterns to replicate

### Established Patterns
- better-sqlite3 synchronous API with async wrappers
- Prepared statements with ? parameters (no string escaping)
- INSERT ON CONFLICT DO UPDATE for upserts
- JSON columns for flexible properties
- Open-use-close pattern for database access

### Integration Points
- intelligence-cascade.cjs -- after filing, should extract facts and check assumptions
- session-start hook -- should load L0 identity + L1 valid facts
- context-engine skill -- should read from memory tables instead of/alongside USER.md
- room-proactive skill -- assumption validity changes should surface as proactive intelligence

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

- Session conversation auto-capture into fragments via hooks (future -- needs hook wiring)
- Brain-to-local sync of framework chains (discussed, decided: local graph is for INTERNAL relationships, not Brain cache)
- Fact extraction from filed artifacts (Phase 79+ -- needs NLP or LLM extraction)
- Cross-room fact sharing (future milestone)

</deferred>
