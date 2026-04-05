# Phase 16: Reasoning Engine - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning
**Source:** Discussion with Jonathan + GSD pattern research

<domain>
## Phase Boundary

Phase 16 adds three interconnected capabilities that make MindrianOS self-reasoning:
1. **Per-section REASONING.md** — Minto/MECE structured critical thinking captured per room section
2. **Autonomous methodology orchestration** — Larry chains tools in sequences like GSD's research → plan → verify → execute
3. **Persistent chain-of-thought** — reasoning is SAVED as artifacts, not just displayed

This is the intelligence layer that makes the room self-documenting. Future sessions read reasoning artifacts to understand WHY a section looks the way it does.

</domain>

<decisions>
## Implementation Decisions

### Per-Section REASONING.md (learned from GSD)
- Each room section gets a REASONING.md with Minto/MECE structure
- YAML frontmatter with requires/provides/affects dependency graph (GSD SUMMARY.md pattern)
- Captures: WHY this section matters, key claims/assumptions, cross-section logic, what Larry would challenge
- Goal-backward verification: "What must be TRUE for this section to be complete?"
- Brain-informed: methodology connections from Neo4j graph (when connected)
- Feeds LazyGraph: reasoning edges become graph connections
- Template at references/reasoning/reasoning-template.md

### Autonomous Methodology Orchestration (learned from GSD workflows + Context7)
- Larry autonomously chains: diagnose → select-framework → apply → file → cross-reference → update-graph
- Each step is a tool call with structured output feeding the next
- The sequence is captured as a "methodology run" artifact in room/.reasoning/runs/
- Brain enriches at each step (if connected)
- The room folder structure IS the orchestration (ICM principle)
- Command: /mos:reason — triggers autonomous reasoning on a section or the whole room

### Persistent Chain-of-Thought
- Chain of thought is SAVED as .reasoning/ artifacts, not just displayed
- room/.reasoning/ directory per project (like room/.lazygraph/)
- Contains: per-section REASONING.md files, methodology run logs, thinking traces
- Future sessions read .reasoning/ to understand section state without re-analyzing
- CLI: blockquote traces (already built in v0.6.0 thinking traces)
- Desktop/Cowork: same traces embedded in MCP prompt responses
- Bash-based COT for CLI, markdown-based for non-CLI platforms

### Frontmatter Schema (from GSD research)
```yaml
---
section: problem-definition
generated: 2026-03-25
methodology_run: run-2026-03-25-001
requires:
  - section: market-analysis
    provides: "Customer validation data"
provides:
  - "Problem type classification"
  - "Wicked problem characteristics"
affects: ["solution-design", "competitive-analysis"]
confidence:
  high: ["Problem is wicked (8/10)", "TAM estimate 2-5B"]
  medium: ["Regulatory headwinds in EU"]
  low: ["China market timing"]
verification:
  must_be_true:
    - "Problem definition cites at least 2 customer data points"
    - "Wicked characteristics identified and scored"
  status: pending
brain_enriched: true
room_hash: abc123
---
```

### mindrian-tools.cjs Frontmatter Operations (from GSD gsd-tools.cjs pattern)
- `reasoning get <section>` — read REASONING.md for a section
- `reasoning generate <section>` — generate/regenerate REASONING.md
- `reasoning verify <section>` — check verification criteria
- `reasoning run <section>` — execute full methodology run
- `reasoning list` — show all sections with reasoning status
- Programmatic frontmatter read/write (like gsd-tools frontmatter get/set)

### Dual Delivery
- All operations as CLI commands (/mos:reason) and MCP tools
- Reasoning files readable as MCP Resources (reasoning:// URI scheme)

### This Is The Moat (Jonathan's directive)
- The reasoning engine with full .cjs capabilities is the POWER BACKEND of MindrianOS
- It's the computational service layer that connects Larry → Graph → Brain → Room → Methodology
- Anyone can copy prompts. Nobody can copy the reasoning engine that orchestrates them programmatically.
- mindrian-tools.cjs reasoning subcommands must be as capable as gsd-tools.cjs — full state management, frontmatter operations, dependency resolution, verification
- This is what makes MindrianOS a PLATFORM, not a prompt collection

### Claude's Discretion
- Exact Minto/MECE section structure within REASONING.md body
- Methodology run artifact format
- How reasoning integrates with existing analyze-room output
- Cache invalidation strategy (when does reasoning become stale)
- How many sections can be reasoned about in one session

</decisions>

<specifics>
## Specific Ideas

- GSD's CONTEXT.md pattern (locked decisions) maps to REASONING.md (locked reasoning about a section)
- GSD's VERIFICATION.md pattern (goal-backward) maps to reasoning verification criteria
- GSD's SUMMARY.md frontmatter (requires/provides/affects) maps to reasoning dependency graph
- The thinking trace format from v0.6.0 (larry-personality SKILL.md) becomes the persistent format
- LazyGraph gets REASONING_INFORMS edges between sections based on reasoning dependency graph
- The methodology run log is similar to GSD's agent-history.json

</specifics>

<deferred>
## Deferred Ideas

- Automatic reasoning staleness detection (reasoning invalidated when section content changes significantly)
- Cross-venture reasoning patterns (anonymized insights from multiple users)
- Reasoning quality scoring (meta-assessment of reasoning strength)
- Real-time reasoning updates during conversation (vs post-session persistence)
- Reasoning diff view (how reasoning evolved over time)

</deferred>

---

*Phase: 16-reasoning-engine*
*Context gathered: 2026-03-25 via discussion + GSD pattern research*
