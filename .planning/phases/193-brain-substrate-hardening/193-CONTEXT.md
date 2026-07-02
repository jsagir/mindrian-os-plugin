# Phase 193 - Brain Substrate Hardening - CONTEXT

**Registered:** 2026-07-01 (split out of Phase 191, navigator decision - keep 191 pure-LOCAL/Part-8-safe)
**Milestone:** v1.15.0 GA "Cure Under-Invocation"

## Why this is its own phase
Phase 191 is the LOCAL consumption wire (reads the projection cache, never the live Brain). The substrate-QUALITY work touches the Brain WRITE-side (admin Cypher), so it splits out to keep 191 constitutionally clean.

## Scope
1. **Framework-coverage live-population** (SEED-framework-coverage-live-population): drive the coverage-gate denominator from the live `:Framework` population (~177 deduped via ALIAS_OF) so frameworks no command references stop being invisible to the gate + advisor. Hard guard: measure live, do NOT restate "43% of 176 dark" as fact.
2. **Canonicalize-at-ingest pass:** entity-resolution at ingest so dedup stops re-running. Root cause: per-document ingestion with no entity-resolution pass (dense core + sparse alias tail).
3. **Orphan disposition:** `correct-reference-now` (1 true orphan) - wire or accept as a one-shot utility; clear/document the 4 near-orphans (hmi-status, organize, dogfood-flush, memory-cortex-reach).

## Key files
- `scripts/build-orchestration-projection.cjs` + `scripts/build-connector-registry.cjs` (coverage gates / denominators).
- The Brain ingest path (admin Cypher) for the canonicalize pass.
- `.planning/research/command-map/INDEX.md` (orphan ledger, 52/103 coverage).

## Guardrails
Brain write-side: every Cypher write generic-framework-only, zero user content (Part 8); admin-key-gated. Frozen Part 3 scalars unchanged; no em-dashes.

## Sequence
After Phase 191 ships (the consumer that benefits). NEXT: `/gsd-discuss-phase 193`.
