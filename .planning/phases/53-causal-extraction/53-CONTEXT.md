# Phase 53: Causal Extraction - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning
**Mode:** Auto-generated (smart discuss --auto)

<domain>
## Phase Boundary

Larry can extract structured causal claims (cause/mechanism/effect triples) from any room artifact, store them as CausalClaim nodes in KuzuDB with EXTRACTED_FROM provenance edges, and enforce Three Gaps quality (mechanism + falsifiable prediction required). Claims are proposed to the user for confirmation before committing to the graph.

</domain>

<decisions>
## Implementation Decisions

### Extraction Trigger
- **D-01:** Extraction is command-driven via `/mos:causal extract`, not automatic in post-write hook. User controls when extraction runs. (Post-write hook does lightweight candidate flagging only -- Phase 55.)

### Claim Quality Gates
- **D-02:** Three Gaps enforcement: every claim MUST have explicit mechanism and falsifiable prediction. Claims missing either are flagged as "incomplete" and not written to KuzuDB until completed.
- **D-03:** Max 5 claims per artifact to prevent graph pollution.
- **D-04:** Confidence scored by extraction method: observed=0.7, asserted=0.5, inferred=0.3.

### User Confirmation Flow
- **D-05:** Larry proposes claims in a table, user confirms/edits/rejects before writing to KuzuDB. No automated extraction without human review (per anti-feature decision from milestone init).
- **D-06:** Rejected claims are noted but not stored. Reason for rejection captured if provided (Decision 13: rejection is data).

### Output Format
- **D-07:** Extracted claims presented as inline table: cause | mechanism | effect | confidence | domain. User can accept all, accept individual claims, edit, or reject.

### Domain Classification
- **D-08:** 7 domains: materials, business, competitive, financial, team, legal, general. Larry classifies based on artifact section and content.

### CJS Bridge Pattern
- **D-09:** Follow existing Python-JSON-CJS pattern. Larry extracts claims as JSON, CJS bridge (causal-to-kuzu.cjs) writes confirmed claims to KuzuDB. CJS is sole KuzuDB writer.

### Claude's Discretion
- Exact extraction prompting strategy (how Larry identifies causal statements in text)
- How to handle ambiguous causation ("after X, Y happened" vs "X caused Y")
- Presentation formatting details within the table structure

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schema (from Phase 52)
- `lib/core/lazygraph-ops.cjs` -- CausalClaim node table (12 properties), EXTRACTED_FROM edge, initSchema pattern
- `docs/lazygraph-schema.md` -- Full CausalClaim documentation with property descriptions
- `.planning/phases/52-causal-schema-brain-enrichment/52-CONTEXT.md` -- D-01 (12 properties), D-04 (dynamic confidence)

### Brain Directives
- `references/brain/query-patterns.md` -- Patterns 11-13 for causal framework selection
- `references/brain/causal-enrichment.cypher` -- Brain enrichment reference (what's in Neo4j now)

### Research
- `.planning/research/PITFALLS-causal.md` -- Pitfall 2 (LLM hallucinated claims), Pitfall 6 (over-extracting)
- `.planning/research/FEATURES-causal.md` -- Table stakes: extraction + provenance + confidence scoring
- `.planning/research/ARCHITECTURE-causal.md` -- Data flow: Larry LLM extraction -> CausalClaim JSON -> CJS bridge -> KuzuDB

### Existing Patterns
- `scripts/hsi-to-kuzu.cjs` -- Reference CJS bridge pattern (read JSON, write to KuzuDB)
- `commands/root-cause.md` -- Existing /mos:root-cause command structure (5 sub-techniques)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lazygraph-ops.cjs` -- CausalClaim CRUD pattern: initSchema already creates the table. Need to add createCausalClaim(), createExtractedFromEdge() functions.
- `scripts/hsi-to-kuzu.cjs` -- Bridge pattern: reads .hsi-results.json, writes to KuzuDB via lazygraph-ops functions.
- `commands/root-cause.md` -- Command structure with subcommands pattern to follow for /mos:causal.

### Established Patterns
- CJS is sole KuzuDB writer -- Larry outputs JSON, CJS bridge writes to graph
- Commands use `allowed-tools` frontmatter to declare what tools they can access
- Brain directives are read-only references that guide Larry's reasoning

### Integration Points
- `lib/core/lazygraph-ops.cjs` -- Add createCausalClaim() and createExtractedFromEdge() CRUD functions
- `scripts/causal-to-kuzu.cjs` -- New CJS bridge reading .causal-extract.json and writing to KuzuDB
- `commands/causal.md` -- New /mos:causal command (extract subcommand in this phase)

</code_context>

<specifics>
## Specific Ideas

- Extraction should feel like Larry's natural reasoning, not a mechanical process
- The table presentation should be compact enough for CLI but clear enough for Desktop
- Brain Pattern 11 (causal_framework_select) should inform which type of causal reasoning Larry applies
- Reference MindrianV2 "Examples" button pattern for future ENGINE-09 (deferred to Phase 55)

</specifics>

<deferred>
## Deferred Ideas

- Automatic extraction in post-write hook (Phase 55 -- lightweight candidate flagging only)
- Batch extraction across all room artifacts (future -- /mos:causal extract --all)
- Cross-artifact causal claim merging (when same claim appears in multiple artifacts)

</deferred>

---

*Phase: 53-causal-extraction*
*Context gathered: 2026-04-05 via smart discuss --auto*
