# lib/core/semantic-index/

## What this folder is

The room's shared semantic index: the local machinery that turns room text into something searchable and comparable. That covers an embedding spine, a vector store and lexical full-text search over room.db, a hybrid retriever that fuses the two, entity extraction and classification, a pair-wise lexical overlap, the shipped-scaffold template index, and the research corpus filer that keeps all of it fed.

Until Phase 366-23 these modules lived in `lib/core/eureka/`, which made the folder look like one engine. It never was. The standalone Eureka runner was one consumer among many (RS, HSI, find-analogies, the F-selector, the extractor, the doctor, the research planner). With the runner retired (366-22), the folder is named for what it is (ADR-E12). What stays in `lib/core/eureka/` is Eureka-specific: enable, offer, reach-runner, the opportunity modules, the AHP weights, the report HTML, and the reasoning-mode and candidate-exclusion helpers.

Plain-English version: this is the room's search engine. Anything that has to ask "which parts of this room are about the same thing?" asks it here.

## File map

| File | What it does |
|------|--------------|
| `embedding-spine.cjs` | The one local encoder. It embeds text on this machine and degrades to `encoder_unavailable` when the model is not installed |
| `vector-store.cjs` | Owns the vector tables in room.db: sqlite-vec first, with a pure-CJS cosine fallback |
| `tri-modal-index.cjs` | Builds the lexical (FTS5/BM25) and semantic legs next to the room's structural graph |
| `fts-index-lifecycle.cjs` | Builds and refreshes `eureka_fts` and reports when it is stale |
| `hybrid-retrieve.cjs` | Fuses the lexical and semantic rankings (RRF) and reranks the result |
| `lexical-overlap.cjs` | Pair-wise vocabulary overlap (Jaccard), the no-Python lexical leg |
| `entity-extractor.cjs` | Tier-1 structural entity extraction, with no model |
| `entity-classifier.cjs` | Tier-2 WHAT / WHY / NOISE classification, the only module here that carries a model transport |
| `embedding-classifier.cjs` | Tier-2a local WHAT-vs-WHY classification by nearest neighbor |
| `scaffold-template-index.cjs` | Answers "is this file byte-identical to its shipped scaffold template?" |
| `analogy-fitness.cjs` | The measured two-leg fitness that find-analogies uses |
| `online-pattern-query.cjs` | Composes and audits the abstracted find-analogies web query. It never transmits |
| `research-filing.cjs` | Files research outputs as a corpus: the nested artifact, its memory_artifact node, and the index refresh |

## Boundaries

- Canon Part 8: nothing here sends room content to the Brain. The embedding model runs locally, and the only outbound strings are the abstracted pattern terms `online-pattern-query.cjs` audits before returning them.
- Canon Part 9: room.db writes go through `lib/core/navigation.cjs` or the vector and FTS tables these modules own (derived projections that can be rebuilt).
- The table names keep their `eureka_` prefix (`eureka_vec`, `eureka_fts`, `eureka_meta`). Renaming them would be a schema migration on every room, which is out of scope for a folder move.
- `scripts/check-require-integrity.cjs` proves that every static require and spawn path into this folder resolves.
