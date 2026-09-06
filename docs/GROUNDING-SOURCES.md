# Grounding Sources for Dev Work

> Extracted from CLAUDE.md by claude-md-optimizer (progressive disclosure, verbatim extraction,
> zero information loss). CLAUDE.md's "Consult ALL Relevant Grounding Sources" section links
> here with a synopsis; this file carries the full per-source routing detail.

## Consult ALL Relevant Grounding Sources During Dev Work (MANDATORY)

"Grounding" means every source that is actually authoritative for the claim being made, not
langtalks-graph-expert alone. langtalks is one leg of this, not the whole stool -- picking it
by default for every question, including ones a different source answers more authoritatively,
is itself a research gap, not rigor.

- **langtalks-graph-expert** (`mcp__langtalks-graph-expert__*`): agent/LLM engineering CONCEPTS
  covered by its podcast-and-source corpus (memory, RAG, knowledge graphs, GraphRAG, context
  engineering, reranking, agent protocols, multi-agent dispatch/orchestration patterns).
  `relationship_path` for point-to-point relationship questions (typed edges, reliable);
  `query_relationship` only for open-ended breadth. "Not in the corpus yet" is a valid,
  expected answer for THIS source -- never paper over a gap with an ungrounded guess, and
  never treat a langtalks miss as proof no grounding exists anywhere.
- **Context7** (`mcp__*Context7__resolve-library-id` / `query-docs`): any claim about a named
  library, runtime, or API's actual behavior (e.g. `node:sqlite` transaction semantics, WAL
  visibility, version floors -- see the room.db/Moat Cross-Cutting Research Rule elsewhere in
  this file). This is more authoritative than a podcast transcript for a specific API contract;
  do not substitute langtalks for it.
- **claude-api skill + claude-code-guide agent**: any claim about Claude Code's own
  hooks/matchers, MCP tool registration, subagent-registry behavior, or Claude API mechanics.
  These are Claude-Code-internal questions a general podcast corpus was never built to answer.
- **WebSearch/WebFetch**: anything time-sensitive or outside all of the above (release notes,
  a specific GitHub issue, a vendor's current docs page) -- per the standing MCP-stack-awareness
  rule, check the stack and ask before firing search silently.
- **icm-architect skill** (`~/.claude/skills/icm-architect/`): any work touching room
  structure, ICM/MWP architecture, or the local graph (SQLite substrate, room schema, section
  scaffolding, walk-test/reference-integrity questions). Bind it to this class of work as a
  standing consult, not a one-off -- it is a community reference implementation of the same
  paper this repo's own `docs/MWP-SPECIFICATION.md` already cites (Van Clief & McDermott 2026,
  arXiv 2603.16021), and it has already independently validated real findings this repo's own
  tooling had not surfaced (see `rethinking-mindrianos/research/2026-08-28-icm-architect-
  room-structure/` and SEED-076). Use its ten invariants, six-forms taxonomy, and walk test as
  a checklist before shipping new room-scaffold, `room-db.cjs`/`navigation.cjs`, or
  section-metadata work -- not just when explicitly asked to "audit."
- **Theo** (`/home/jsagi/Theo`, esp. `notes/graph-rulebook.md`, `notes/knowledge-graph.md`, and
  `.planning/ROADMAP.md` Phase 9 "Brain-Contract Cutover"): standing consult (navigator ruling,
  2026-09-02) for ANY phase whose research touches the Brain graph, framework resolution,
  readiness scoring, or anything `check-flagship-floor.cjs`-adjacent. Theo is the pre-scoped
  successor that `pws-brain-mcp` cuts over to (Phase 9); it is not deployable yet (no remote
  hosting story, its own Phase 8.4 not started), so a phase should still plan and ship against
  the CURRENT Brain -- but its research must state explicitly whether the finding/fix has a
  Theo-side analog, and if so what it is, so cutover is a smaller diff instead of a rediscovery.
  Concrete precedent: Phase 262 found a hop-depth-1 `ALIAS_OF` defect in the current Brain's
  `NORMALIZE_NAME_CYPHER` (a fork silently returns 2 "canonical" matches); Theo's own
  `resolveFramework` (`src/mcp/content/normalize-framework-name.ts`) already treats the identical
  shape as `ALIAS_FORK` and refuses honestly instead of guessing -- worth knowing before writing a
  new guard for the old Brain that Theo's design already solved differently. Check Theo's own
  `{phase}-MOS-LEARNING.md` files (one per Theo phase, `## Schema and contract changes for the
  local room graph` section) before assuming a gap is unaddressed there.

Pick the source(s) that actually cover the claim; use more than one when a finding spans
domains (e.g. a hook-matcher bug is a Claude Code question AND may also have an agent-pipeline-
design analog worth checking in langtalks). Source of truth for the langtalks-specific leg:
`feedback_mindrianos_dev_consult_langtalks.md` in personal memory
(`~/.claude/projects/-home-jsagi/memory/`) -- a short pointer to that ONE leg, not the full rule.
