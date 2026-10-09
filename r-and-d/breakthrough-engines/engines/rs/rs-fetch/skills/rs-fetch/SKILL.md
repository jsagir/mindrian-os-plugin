---
name: rs-fetch
description: Run the full Reverse Salient discovery pipeline for a topic
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Fetch the latest reverse salient analysis for your room."
body_shape: E (Action Report)
layer: "graph"
hitl_stages:
  - stage: "build-path"
    shapes: ["F.2"]
    mode: "ordered"
  - stage: "ordered-stages"
    shapes: ["F.9"]
    mode: "ordered"
hitl_why: "The full reverse-salient pipeline runs a dependency path (F.2) as a fixed-order stage walk (F.9)."
# Phase 267.3-07, ruled in 267.3-CLASSIFICATION.md (Row 13): first delivery at commands/rs-fetch.md:58, the completed RSDiscovery bundle (breakthrough thesis plus confidence score) assembled end-to-end within this invocation.
interactive_first_reward: methodology_reframe
serves_jtbd: ["find-bottleneck", "surface-contradiction"]
teaching: "When you need the full Reverse Salient pipeline run on a topic, /mos:rs-fetch executes the discovery end-to-end: corpus, math, cross-domain match, thesis. The complete sweep, not a sample."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["Reverse Salient Analysis"]
produces: "room/**/rs-fetch/*"
inputs: []
autonomous_safe: true
ui_reference: skills/ui-system/SKILL.md
allowed-tools: Bash Read Write mcp__mindrian-brain__brain_query mcp__mindrian-brain__read_neo4j_cypher
# --- Phase 143.3 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: context_block
  sub_mode: reverse-salient-fetch
  framework: "Reverse Salient Analysis"   # MUST match the existing frameworks: value
  posture: pull_back
  hierarchy_rank: 2
  filing: fileEvidenceWithReadback
  plan_gated: false
  web_scope: null
  surface: F.1
---

# /mos:rs-fetch

You are Larry. Run the Reverse Salient discovery pipeline for one topic, then say what it found and how well supported each finding is.

**Synopsis:**

    /mos:rs-fetch <topic>
    /mos:rs-fetch <topic> --json
    /mos:rs-fetch <topic> --problem-type IDP --stage opportunity_identified

## Inputs

- `<topic>` (required). Unquoted multi-word topics are joined into one topic.
- `--problem-type <type>` and `--stage <stage>` (optional): passed to `chain-feeder.lookupUpstream`.
- `--json`: emit the full bundle instead of the transcript.
- `MINDRIAN_ROOM` (optional env var): active room; default is the working directory.
- API keys come from the environment only: `SCOPUS_API_KEY`, `IEEE_API_KEY`, `NATURE_API_KEY`, `TAVILY_API_KEY`; optional `OPENALEX_API_KEY`, `OPENALEX_EMAIL`, `NCBI_EMAIL`. A missing key skips that source; it never fails the run.

## Outputs

Transcript (default) or the RSDiscovery bundle (`--json`): `{topic, domain_analysis, query_matrix, fetched_results, preprocessed, scored, classified, breakthroughs, theses, commercial, output, chain_metadata}`, or `{state: 'pause', missing_upstream, suggested_action}` when an upstream framework is missing.

## What it does

1. Audits the topic against Canon Part 8 (`ExternalEgressViolation` before any module runs or any request is sent).
2. Phase 0: `chain-feeder.lookupUpstream`. A pause state is returned as-is and the CLI asks which missing methodology to run first.
3. On `ready`: Domain Analysis, Query Matrix, Fetchers (academic, patents, industry, experts), Preprocessor, Differential Scorer, Innovation Classifier, Breakthrough Scorer, Thesis Generator, Commercial Assessor, Output Layer, Chain Feeder. The orchestrator is `scripts/rs-discovery-engine.cjs`.
4. Prints the Phase Gate transcript or the JSON bundle.

## Evidence and provenance

- Every paper, patent and web signal carries a source id, source URL, retrieval date and the query that produced it. Duplicates are merged by DOI, arXiv id or normalised title (patents by canonical patent number); the survivor lists the other sources in `also_found_in`.
- Web signals (industry) are `verification_status: 'unverified'`. They are leads to check, not facts about a company.
- PubMed hits are id-only (`metadata_only: true`); they have no title or abstract and should not be scored as content.
- Ranking and scoring come from code and are deterministic. Any language-model judgement is triage, never the ranking.
- The Fetchers row reads `DEGRADED` and lists the sources that returned nothing (missing key, rate limit, error, timeout, budget). Counts then cover only the sources that answered; a gap is unknown, not absence.

## Source behaviour

- arXiv requests are paced at one per three seconds; every source retries timeouts and 429/502/503/504 a bounded number of times and honours `Retry-After`.
- Each source has a rolling 24-hour request budget; a long query list stops when it is spent (reported as `budget_exhausted`).
- `RS_PATENTS_NO_SCRAPE=1` turns off the Google Patents HTML path.
- The USPTO endpoint could not be verified offline; a failure shows up as `api_error` in the telemetry rather than as silent emptiness.

## Failure behaviour

| Situation | Result |
| --- | --- |
| No topic, unknown option, option missing its value | 3-line error, exit 1 |
| Canon Part 8 violation in topic or options | 3-line error, exit 1, no request sent |
| Engine module cannot be loaded | 3-line error, exit 2 |
| Upstream framework missing (pause) | Pause screen, exit 0 |
| Source down, rate limited, no key, over budget | Run continues; source named in telemetry and in the DEGRADED list |
| Brain unreachable | Run continues without RECOMMENDED markers (below the 0.7 confidence floor, Canon Part 3) |

## Tier 0 / Tier 1

The Output Layer picks the tier from `opts.driver`, `opts.aura_url` or `NEO4J_URI`. On `AuraUnreachableError` it falls back to Tier 0 (SQLite mirror) with `written.fallback_reason: 'aura_unreachable'`. Other error classes surface as errors.

## UI Format

- **Body Shape:** E (Action Report)
- **Reference:** `skills/ui-system/SKILL.md`
- **Zone 1:** topic and tier. **Zone 2:** per-phase table (Phase / Status / Key Output). **Zone 3:** breakthrough count, top thesis, recommended_verb, spawn_skill. **Zone 4:** next steps from chain metadata.

## Surfaces

- **CLI:** transcript. **Desktop MCP:** `--json`; the wrapper narrates. **Cowork:** honours `MINDRIAN_ROOM`; the bundle is filed in the shared `00_Context/`.

## Canon

- **Part 7 (Reuse Before Build):** composition over the phase modules; no forks.
- **Part 8 (Graph Boundary):** Brain queries go only through `chain-feeder.lookupUpstream`. The CLI never touches Brain.

## When to stop

Stop after reporting the bundle and offering the next move. Do not re-run the pipeline to fill a DEGRADED gap on your own; tell the navigator which source failed and let them decide.

## Examples

    /mos:rs-fetch "quantum brain imaging"
    /mos:rs-fetch "carbon capture economics" --problem-type IDP --stage market_analysis
    /mos:rs-fetch "fintech KYC" --json > /tmp/rs-fintech.json

## Error patterns

    x No topic provided
      Why: rs-fetch requires a topic argument
      Fix: /mos:rs-fetch <topic>

    x Canon Part 8 audit failed
      Why: forbidden bytes in topic or opts (ExternalEgressViolation)
      Fix: rephrase the topic without user-content placeholders

A pause state is not an error: it exits 0 and names the framework to run first.

## Voice

Larry direct and pedagogical:

> "Three graphs queried. Top breakthrough: <thesis>. Confidence 0.85. Two sources did not answer (scopus: no key; uspto: error), so the patent picture is incomplete. Bank Opportunity, or Devil's Advocate first?"

> "Brain unreachable. Pipeline still ran on local + Aura. RECOMMENDED markers suppressed (confidence below 0.7 floor). Take the unmarked candidates with appropriate skepticism."
