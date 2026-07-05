# Quick Task 260705-jeq: Doctor diagnostic for Claude-Code commands-registration bug + /mos:help reshape - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning

<domain>
## Task Boundary

Two related deliverables closing today's commands-registration investigation:
1. A new doctor.cjs check/mode that detects "commands not registering despite a valid install" and assembles a ready-to-paste Anthropic bug report, since the root cause is confirmed to be a Claude Code core bug (not fixable from plugin code).
2. A rewrite of `commands/help.md`'s body to a proper multi-tab F-shape command map reflecting the real 11 command families (not the stale "4-lane" claim), using the actual AskUserQuestion contract (max 4 questions/tabs per call, max 4 options per question) rather than artificially merging families to fit one question.

</domain>

<decisions>
## Implementation Decisions

Given the exhaustive same-session investigation already run today (a full live cross-platform bisect, confirmed root cause, and a detailed 11-family command map already worked out with the navigator), the following gray areas are resolved here as informed defaults rather than re-opening another interactive round with an already-long session:

### Part 1 - doctor --report-registration-bug output
- Decision: print the assembled bug-report text to stdout (matching every other doctor.cjs mode's existing convention - JSON via --json, human text otherwise), not a file or clipboard. The navigator copies it from the terminal, consistent with how every other doctor recovery note already works.
- Decision: this is a NEW read-only reporting mode, not a --fix action (there is nothing to fix locally). It must never claim status "healthy" or "fixed" - it is diagnostic-only, explicitly labeled as escalate-to-Anthropic.

### Part 2 - "show all in this lane" escape hatch for families with more than 4 commands
- Decision: keep it simple - do NOT build a third card-of-cards mechanism. The escape hatch is a text line under each tab's 4 options at render time: "N more in this lane - type /mos:help <family-name> to see all", where `/mos:help <family-name>` is a plain argument-based path already compatible with this command's existing argument-hint pattern (no new shape needed for that path - it renders as a scrollable text list, matching how the CURRENT command already partially resembles help-groups.json's structure).

### Part 2 - underlying data schema (help-groups.json)
- Decision: extend `data/help-groups.json`'s existing group structure to the corrected 11 families (rename/re-group, do not invent a parallel schema) so `scripts/check-help-coverage.cjs` and the existing help-renderer machinery keep working against ONE source of truth, per Part 7 reuse. Do not hand-roll a second family list inside help.md's body prose that could drift from help-groups.json again (this is exactly the class of bug - a stale hardcoded copy - fixed elsewhere today for the "45" literal; do not reintroduce the same failure mode here).

### Part 2 - card count and grouping order
- Decision: 3 cards covering all 11 families (4+4+3 split), grouped by adjacency as already field-tested with the navigator today: Card 1 = Start Here / Rooms & Data Room / Frame the Problem / Run a Methodology. Card 2 = Explore Futures & Trends / Intelligence & Research / Opportunities Funding & Meetings / Present & Publish. Card 3 = Orchestrate & Automate / Memory State & Engine / System & Maintenance. Each card is its own AskUserQuestion call (not chained automatically) - the existing command's argument-hint (`[command-name | --list]`) gains a new implicit "next card" navigation, matching the existing lanes-as-tabs precedent this command already declares.

### Deprecated commands
- Decision: keep the 5 deprecated commands (heal, hmi-status, query, organize, visualize) exactly as already excluded from `deprecated_aliases` per existing convention - do not add them to any of the 3 new cards, consistent with the existing coverage gate's already-passing state (do not regress the 100/100 non-admin coverage number established in the 2026-07-02 help-coverage-gate quick task).

</decisions>

<specifics>
## Specific Ideas

The full 11-family -> command list, embedded here VERBATIM (not a pointer this time - the first version of this file only referenced "the dispatch prompt," which is not a persisted readable artifact, and correctly caused the planner to insert a blocking checkpoint rather than silently re-derive). This is the exact, locked, byte-for-byte source of truth for the `help-groups.json` re-group. The union of commands across all 11 families below MUST equal the union already covered by the current (stale-labeled) groups in `data/help-groups.json` - do not add or drop any command, only re-label/re-group.

1. **START HERE:** onboard, ignite, new-project, discover, mos, help, setup, splash, update
2. **ROOMS & DATA ROOM:** room, rooms, dashboard, wiki, status, show, snapshot, vault
3. **FRAME THE PROBLEM:** diagnose, beautiful-question, challenge-assumptions, map-unknowns, root-cause, structure-argument, grade, deep-grade
4. **RUN A METHODOLOGY:** lean-canvas, mullins, think-hats, persona, hat-briefing, build-knowledge, analyze-needs, user-needs, validate, value-proposition, score-innovation, find-analogies, systems-thinking, analyze-systems, leadership
5. **EXPLORE FUTURES & TRENDS:** explore-domains, explore-futures, explore-trends, scenario-plan, futures, trending-to-absurd, macro-trends, dominant-designs, analyze-timing, diffusion
6. **INTELLIGENCE & RESEARCH:** research, find-connections, build-thesis, compare-ventures, whitespace, causal, graph, find-bottlenecks, rs-experts, rs-explain, rs-fetch, rs-thesis, bono
7. **OPPORTUNITIES, FUNDING & MEETINGS:** opportunities, funding, scout, file-meeting, reanalyze, speakers
8. **PRESENT & PUBLISH:** export, present, publish, deck, radar
9. **ORCHESTRATE & AUTOMATE:** act, pipeline, suggest-next, scheduled-tasks
10. **MEMORY, STATE & ENGINE:** memory, memory-cortex-reach, jtbd, operator, stance, explain-decision, models, mva-brief, mva-option, mva-report, mos-reason, brain-derive, dial-memory-refresh, feynman-timeline-refresh, correct-reference-now
11. **SYSTEM & MAINTENANCE:** doctor, diagnostics, agentshield, admin, new-surface, skill, ingest-methodology, dogfood-flush, auto-explore

**DEPRECATED (5, quarantined, never on a card, already excluded via `deprecated_aliases`):** heal, hmi-status, query, organize, visualize

**Card grouping (locked, 4+4+3 split, one AskUserQuestion call per card):**
- Card 1: Start Here / Rooms & Data Room / Frame the Problem / Run a Methodology
- Card 2: Explore Futures & Trends / Intelligence & Research / Opportunities Funding & Meetings / Present & Publish
- Card 3: Orchestrate & Automate / Memory State & Engine / System & Maintenance

</specifics>

<canonical_refs>
## Canonical References

- `.planning/debug/beta13-curing-sequence-persona-and-commands-bisect.md` and `.planning/debug/windows-install-update-ux.md` (F8, F11) - prior related findings, same investigation family, cite for provenance but this task's root cause (Claude Code core registration bug) is DISTINCT and newly confirmed 2026-07-05, not the same bug as F11 (which was the legacy config.json pin drift, already fixed).
- `data/help-groups.json` + `scripts/help-renderer.cjs` + `scripts/check-help-coverage.cjs` - existing machinery to extend, not replace.
- The real `AskUserQuestion` tool contract (verified this session): max 4 questions per call, max 4 options per question - this is the hard constraint driving the 3-card design, not a stylistic choice.

</canonical_refs>
