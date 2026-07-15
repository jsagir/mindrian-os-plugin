---
kind: seed
status: open
created: 2026-06-17
canon_parts: [2, 3, 7, 8]
severity: high
surfaces: [cli, desktop, cowork]
proving_case: ~/MindrianRooms/aion-eureka-synergy (RS pipelines manual-only all session; F7/F8)
evidence: dev repo 2026-06-17 - rs-* NOT-WIRED + ABSENT from data/connector-registry.json
related: Phase 144.1 (connector-retrofit-sweep, PLANNED), SEED-029 (embedding layer), SEED-013 (eliminate-python), Phase 89 (reverse-salient-engine)
phase: 161-embedding-layer-and-rs-reconciliation
source: dogfood (AION C08 demo build) + dev-repo wiring audit
staleness_note: "PARTIALLY STALE, corrected 2026-07-15. This seed's own evidence (dated
  2026-06-17) claimed all 4 rs-* commands had NO connector frontmatter and were ABSENT
  from data/connector-registry.json. Verified directly against the current tree:
  rs-fetch.md, rs-explain.md, rs-experts.md, and rs-thesis.md all carry
  connects_to_spine:true + reach_id:context_block + sensor_triggers:[SENS-02], and all
  four appear in data/connector-registry.json (both the /mos: surface and skill: entries).
  Required (acceptance) item 1, spine-wire the RS family, is DONE. Items 2 (repoint RS
  vectors at the local Embedding Layer, avoid Pinecone) and 3 (the R-expert Aura/
  Brain-Cypher decision) were NOT re-verified this session -- treat those as the genuinely
  open remainder, not the whole seed."
---

# SEED: RS pipeline spine-wiring + expert-graph reconciliation (the non-vector half of "RS local + reachable")

## The gap (evidence-confirmed, dev repo 2026-06-17)
1. **Orphaned from Larry-reaches.** The four `rs-*` commands - `rs-fetch`, `rs-explain`,
   `rs-experts`, `rs-thesis` - have NO `connector:` frontmatter and are ABSENT from
   `data/connector-registry.json`. The `find-*` / `whitespace` / `score-innovation` wrappers ARE
   wired. So the navigation engine never RANKS or REACHES for the RS pipelines; they are manual-only
   `/mos:` invocations. (This is the unfinished Phase 144.1 connector-retrofit-sweep scope.)
2. **Two remote couplings, not one.** RS depends on BOTH:
   - Pinecone vectors (`scripts/rs-engine.py` + `lib/core/rs_corpus.py`/`rs_cache.py`/`rs_hybrid.py`)
     -> addressed by the Embedding Layer (SEED-029 / Phase 161 R-RS-1).
   - Neo4j Aura / Brain Cypher (`rs-experts` resolves the expert network "via Brain Cypher MATCH";
     `rs-explain` runs graph queries) -> NOT addressed by embeddings. This is PEOPLE / teaching-graph
     data, genuinely Brain IP (Canon Part 8).

## Why it matters
"RS fully local" is impossible to deliver with the embedding layer alone, because RS is half a vector
problem and half a graph/expert problem. And even fully localized, RS is invisible to the navigator
until it is on the connector spine - Larry cannot proactively reach for a reverse-salient discovery
the user did not manually trigger. Both halves must land for RS to be a first-class, reachable engine.

## Required (acceptance)
1. **Spine-wire the RS family.** Add `connector:` frontmatter (reach_id, sensor_triggers, posture,
   hierarchy_rank, filing) to `rs-fetch`, `rs-explain`, `rs-experts`, `rs-thesis`; regenerate
   `data/connector-registry.json`; `--check` tripwire green. RS becomes rankable/reachable on the dial.
2. **Repoint RS vectors at the Embedding Layer** (Phase 161): rs-engine internal/cross-room/external/
   hybrid modes read local room.db vectors + on-demand signal, not Pinecone rs-external.
3. **R-expert decision (LOCKED-pending):** `rs-experts` Aura/expert-graph coupling.
   - Option A (recommend): KEEP remote-Brain Mode-A. The expert network is people + teaching-graph
     data = Brain IP; it is correct for it to be a remote enrichment, gracefully degrading offline.
   - Option B: descope `rs-experts` (drop the expert-network capability).
   Embeddings CANNOT localize this - do not pretend the embedding layer solves it.

## Tests
- Assert all four `rs-*` commands appear in `data/connector-registry.json` after the generator runs.
- Assert RS internal mode runs with zero Pinecone (reads the local Embedding Layer).
- Assert `rs-experts` degrades gracefully (clear "Brain unreachable" message) when Brain is offline,
  rather than crashing - whichever R-expert option is chosen.

## Reuse-before-build (Part 7)
This is mostly WIRING: the connector frontmatter schema + generator (Phase 143.3) already exist; this
applies them to 4 more commands (Phase 144.1 idiom). The vector repoint reuses SEED-029. Net-new is
near-zero; the value is closing the orphan gap and making the Aura decision explicit.
