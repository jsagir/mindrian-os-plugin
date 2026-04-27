---
name: rs-fetch
description: Run the full Reverse Salient discovery pipeline for a topic
body_shape: E (Action Report)
ui_reference: skills/ui-system/SKILL.md
allowed-tools:
  - Bash
  - Read
  - Write
  - mcp__mindrian-brain__brain_query
  - mcp__neo4j-brain__read_neo4j_cypher
---

# /mos:rs-fetch

You are Larry. This command runs the v1.11.0 Reverse Salient discovery pipeline end-to-end for a single topic. The orchestrator at `scripts/rs-discovery-engine.cjs` (Phase 89.5-04) chains every RS phase: Domain Analysis (89.1) -> Query Matrix (89.1) -> Fetchers (89.2) -> Preprocessor (89.2) -> Differential Scorer (89.2) -> Innovation Classifier (89.2) -> Breakthrough Scorer (89.2) -> Thesis Generator (89.2) -> Commercial Assessor (89.5-01) -> Output Layer (89.3 Tier 0/1 dispatch + mind map) -> Chain Feeder (89.4). The CLI surface emits a Phase Gate-style transcript summarizing each phase plus the chain metadata block per discovery.

**Synopsis:**

    /mos:rs-fetch <topic>
    /mos:rs-fetch <topic> --json
    /mos:rs-fetch <topic> --problem-type IDP --stage opportunity_identified

## What it does

1. Validates the input topic against Canon Part 8 (input audit at SEAM A; throws `ExternalEgressViolation` BEFORE any module runs if forbidden bytes appear).
2. Runs Phase 0 chain-feeder upstream awareness via `lookupUpstream`. If Brain returns a pause-state with missing upstream frameworks, the orchestrator returns `{state: 'pause', missing_upstream, suggested_action}` verbatim and the CLI surfaces a Decision Gate prompt to run the missing methodology.
3. On `state: 'ready'`, runs Phases 1 through 4 plus Output Layer plus Chain Downstream and assembles the full RSDiscovery bundle: `{topic, domain_analysis, query_matrix, fetched_results, preprocessed, scored, classified, breakthroughs, theses, commercial, output, chain_metadata}`.
4. Emits a Phase Gate-style transcript (CLI text) OR structured JSON (`--json` flag for Desktop MCP / Cowork programmatic consumers).

## UI Format

- **Body Shape:** E (Action Report) -- per-phase summary rows + chain metadata block at the end
- **Reference:** `skills/ui-system/SKILL.md`
- **Zone 1:** Header Panel -- topic + tier (Tier 0 SQLite mirror or Tier 1 Aura)
- **Zone 2:** Content Body -- per-phase row table (Phase / Status / Key Output)
- **Zone 3:** Intelligence Strip -- breakthrough count, top thesis, recommended_verb, spawn_skill (Canon Part 3 verb)
- **Zone 4:** Action Footer -- next steps drawn from chain metadata

## Tier 0 / Tier 1 dispatch

The Output Layer infers tier from `opts.driver` (Aura session factory) OR `opts.aura_url` OR `process.env.NEO4J_URI`. On `AuraUnreachableError` during Tier 1 write, the orchestrator falls back to Tier 0 (SQLite mirror) with `written.fallback_reason: 'aura_unreachable'`. Other error classes (TypeError, ExternalEgressViolation) bubble up as programming errors / Canon violations.

## Mode A / Mode B graceful

When Brain is unreachable (`brainClient.isAvailable()` returns false) the chain-feeder returns `{state: 'ready'}` and the orchestrator continues without RECOMMENDED markers (confidence < 0.7 floor per Canon Part 3 line 359). Mode A surfaces the full chain metadata block; Mode B suppresses the RECOMMENDED marker but renders coherent NL.

## Three-surface notes

- **CLI:** Phase Gate-style transcript with per-phase rows + chain metadata block. Default mode when invoked via `claude /mos:rs-fetch`.
- **Desktop MCP:** structured JSON via the `--json` flag. The MCP wrapper consumes the bundle and renders Larry's narration in the conversation surface.
- **Cowork:** honors `MINDRIAN_ROOM` env var for active-room scope per existing folder-memory.cjs contract; multi-user rooms get the same bundle filed in their shared `00_Context/`.

## Canon References

- **Canon Part 7 (Reuse Before Build):** the orchestrator is composition NOT duplication. 17 phase modules consumed via require(); zero forks.
- **Canon Part 8 (Graph Boundary):** Brain queries route exclusively through `chain-feeder.lookupUpstream` (which wraps `brainClient.query` with the Canon Part 8 audit + Mode A/B graceful path). Zero direct `fetch(` and zero direct `brain-client` require in the orchestrator. The CLI command never touches Brain directly; only the library does.

## Examples

    /mos:rs-fetch "quantum brain imaging"
    /mos:rs-fetch "carbon capture economics" --problem-type IDP --stage market_analysis
    /mos:rs-fetch "fintech KYC" --json > /tmp/rs-fintech.json

## Error patterns

The CLI emits the 3-line error pattern on common failures:

    x No topic provided
      Why: rs-fetch requires a topic argument
      Fix: /mos:rs-fetch <topic>

    x Canon Part 8 audit failed
      Why: forbidden bytes in topic or opts (ExternalEgressViolation at SEAM A)
      Fix: rephrase the topic without user-content placeholders

    x Pause state from upstream
      Why: missing upstream framework <X>; the chain-feeder returned state=pause
      Fix: /mos:<missing-framework> first, then re-run /mos:rs-fetch

## Voice

Larry direct and pedagogical:

> "Three graphs queried. Top breakthrough: <thesis>. Confidence 0.85. Worth Bank Opportunity? Or Devil's Advocate first?"

> "Brain unreachable. Pipeline still ran on local + Aura. RECOMMENDED markers suppressed (confidence below 0.7 floor). Take the unmarked candidates with appropriate skepticism."
