---
phase: 211-eureka-generator-mvp
plan: 02
subsystem: eureka-engine
tags: [tri-modal, fts5, bm25, sqlite-vec, rrf, flashrank, hybrid-retrieval, canon-part-9, graceful-degradation, tdd]
requires:
  - lib/core/eureka/embedding-spine.cjs (embedTexts, cosineSimilarity - 211-01)
  - lib/core/room-db.cjs (openRoomDb - the single door, extended additively)
  - sqlite-vec dependency (optional primary vector leg, installed 211-01)
provides:
  - lib/core/eureka/tri-modal-index.cjs (openIndex / indexNodes / lexicalSearch / vectorSearch / nodeText / _test)
  - lib/core/eureka/hybrid-retrieve.cjs (rrfFuse / hybridRetrieve / rerank / RRF_K / _test)
  - "openRoomDb(roomDir, opts) additive allowExtension passthrough (zero-arg callers untouched)"
  - "derived index tables: eureka_fts (fts5 porter+bm25), eureka_vec (vec0) OR eureka_vec_fallback (Float32 BLOB)"
  - "env vars: EUREKA_RRF_K (default 25), MINDRIAN_RERANK_MODEL (default Xenova/ms-marco-TinyBERT-L-2-v2)"
affects:
  - 211-03 (scoreMeasured + lexicalOverlap can consume the lexical leg)
  - 211-05 (eureka-room-report.cjs + run-all-211.sh consume both modules)
tech-stack:
  added:
    - "no new dependency - rerank rides the already-installed @huggingface/transformers; sqlite-vec (211-01) is the optional primary vector leg"
  patterns:
    - "caller-owned db handles (navigation pattern); this module never opens room.db nor requires room-db.cjs"
    - "try-primary-then-fallback vector backend with backend reporting ({vec_backend})"
    - "rank-only RRF fusion (1/(k+rank), 1-based) at room-scale k=25"
    - "env-string -> validated -> default resolution (RS_SEMANTIC_FLOOR precedent) for EUREKA_RRF_K"
    - "lazy OPTIONAL dep require inside function body (Tier-0 graceful degradation, Decision #8)"
    - "every degradation is a {warning} field, never a throw"
key-files:
  created:
    - lib/core/eureka/tri-modal-index.cjs
    - lib/core/eureka/hybrid-retrieve.cjs
    - tests/test-211-tri-modal.cjs
  modified:
    - lib/core/room-db.cjs
decisions:
  - "nodeText returns PURE core text (no type prefix) to satisfy Test 4's exact-equality contract; the type token is added by indexNodes when it builds the indexed string, so both the behavior spec and the action's 'type as a prefix token' are honored"
  - "FTS5 MATCH built from alnum tokens only, stopwords dropped, each token double-quote-wrapped, joined with OR (any-token recall, bm25 ranks) - punctuation can never inject fts5 syntax (T-211-05) and a stopword-only query yields '' -> [] without a db hit"
  - "vector backend chosen at openIndex time: sqlite-vec primary when the handle carries allowExtension AND the dep + platform binary resolve, else pure-CJS cosine over a Float32 BLOB table; both expose the same higher-is-better score contract"
  - "RRF k defaults to 25 (room-scale per 2026-07-04 validation), not the textbook 60 - small corpora want less top-rank dampening"
metrics:
  duration: ~25m
  tasks_completed: 2
  files_created: 3
  files_modified: 1
  completed: 2026-07-05
---

# Phase 211 Plan 02: Tri-Modal Room Index + Hybrid Retrieve Summary

room.db is now tri-modal on ONE SQLite file with zero infra: the existing STRUCTURAL graph, plus a LEXICAL leg (FTS5 + BM25 + porter - the half MindrianOS lacked, the agno lesson of SEED-049) and a SEMANTIC leg (sqlite-vec primary, pure-CJS cosine fallback), fused by RRF at room-scale k=25 with an optional FlashRank-model cross-encoder rerank delivered through the already-installed transformers.js runtime. Every leg is caller-owned, every degradation is a warning not a throw, and not one typed edge or memory_event row is written.

## What Was Built

- **`lib/core/eureka/tri-modal-index.cjs`** (308 lines) exporting `openIndex`, `indexNodes`, `lexicalSearch`, `vectorSearch`, `nodeText`, `_test`:
  - `openIndex(db)` creates the fts5 porter table and TRIES the sqlite-vec `vec0` primary leg (loading the extension ONLY from `require('sqlite-vec').getLoadablePath()` - T-211-03 mitigation); on ANY throw it falls back to a Float32-BLOB table + brute-force CJS cosine and returns which backend is live (`{vec_backend}`).
  - `indexNodes(db, opts)` full-corpus reindex, ONE `embedTexts` batch (`opts.encodeFn` injectable), per-node DELETE-then-INSERT so a re-run never duplicates rows.
  - `nodeText(row)` defensive JSON parse -> `name || text || title || governing_thought`; empty/unparseable props yield `''` (skipped, never crashed on).
  - `lexicalSearch` orders by `bm25(eureka_fts)`; `vectorSearch` does vec0 KNN when live else a cosine scan over the fallback table.
  - Caller-owned handles everywhere; the file never opens room.db and never requires room-db.cjs (navigation allow-list intact).
- **`lib/core/eureka/hybrid-retrieve.cjs`** (246 lines) exporting `rrfFuse`, `hybridRetrieve`, `rerank`, `RRF_K`, `_test`:
  - `rrfFuse` pure rank-only fusion, `score(d) = sum 1/(k+rank)` (1-based), room-scale `EUREKA_RRF_K` default 25 (clamps invalid env to 25), records contributing source names.
  - `hybridRetrieve` runs both legs over a caller-owned handle, fuses, slices to k; degrades to lexical-only with `warning:'vector_leg_unavailable'` when the encoder is down.
  - `rerank` lazy-loads a transformers.js text-classification cross-encoder (FlashRank's `ms-marco-TinyBERT-L-2-v2` default, `ms-marco-MiniLM-L-6-v2` runtime fallback); `opts.rerankFn` is the offline seam; any failure returns input order with `warning:'rerank_unavailable'`.
- **`lib/core/room-db.cjs`** - additive `openRoomDb(roomDir, opts)`: when `opts.allowExtension === true` the handle is built with `{ allowExtension: true }`, otherwise byte-for-byte as before. All existing zero-arg callers are untouched.
- **`tests/test-211-tri-modal.cjs`** (262 lines) - 8 offline, deterministic, network-free tests on a tmp fixture db (8 nodes, 2 domains, 1 unparseable-props node) with a deterministic stub encoder. Never touches any real room.db.

## TDD Gate Compliance

Both tasks followed RED -> GREEN with distinct gate commits:

| Task | RED (test) | GREEN (feat) |
|------|-----------|--------------|
| 1: tri-modal index + door | `3cb2eaa3` | `3f61d085` |
| 2: hybrid retrieve + rerank | `62041e06` | `46b71239` |

Each RED was confirmed failing (MODULE_NOT_FOUND for the not-yet-created module) before implementing.

## FlashRank Model Resolution

The shipped default is `Xenova/ms-marco-TinyBERT-L-2-v2` (FlashRank's own default model, its ONNX port), runtime fallback `Xenova/ms-marco-MiniLM-L-6-v2`. **Neither resolved at runtime in this execution** because `@huggingface/transformers` is not installed in this worktree's node_modules (deps were recorded in package.json by 211-01 but node_modules is gitignored and not carried into the worktree). The rerank real-model path therefore exercised only its graceful-degradation branch (`rerank_unavailable`) here; the offline `rerankFn` seam proves the reorder logic. No Python, no flashrank pip package - verified absent from package.json.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Shared test file imported the Task 2 module at top level**
- **Found during:** Task 1 RED authoring.
- **Root cause:** the shared `tests/test-211-tri-modal.cjs` initially `require`d `hybrid-retrieve.cjs` at the top, which would have made Task 1 GREEN impossible (that module lands in Task 2), turning a green suite red on a missing module.
- **Fix:** deferred the hybrid require into the `hybridTests()` function (a no-op placeholder during Task 1, filled with real Tests 6-8 in Task 2), so each task's suite runs against only the modules that exist at that gate.
- **Files modified:** tests/test-211-tri-modal.cjs
- **Commit:** folded into `3cb2eaa3` (RED) before commit.

### Contract reconciliation (documented, not a deviation)

- Test 4 asserts `nodeText(...) === 'cmd:grade'` (pure text, no prefix) while the action prose says "plus the node type as a prefix token". In TDD the test is the contract: `nodeText` returns pure core text and the type token is added by `indexNodes` when building the indexed string. Both the exact-equality test and the "type token in the index" intent are satisfied. Recorded as a decision above.

## Verification

- `node tests/test-211-tri-modal.cjs` -> **PASS=8 FAIL=0**, exit 0 (offline, no model, no network).
- `bash tests/run-all-200.sh` -> **PASS=6 FAIL=0 SKIP=0** (the room-db door change is additive, no regression).
- `node scripts/build-connector-registry.cjs --check` -> **OK** (lib modules only, no new invocable surface minted).
- Acceptance greps: caller-owned (0 room-db requires), `allowExtension` present (3), `fts5` present, `EUREKA_RRF_K` present (3), `ms-marco-TinyBERT` present (4), `flashrank` absent from package.json, no em-dash in any touched file.

## Canon Compliance

- **Part 9 (Memory Locality):** both modules write/read ONLY derived, rebuildable projection tables (`eureka_fts`, `eureka_vec`/`eureka_vec_fallback`). ZERO typed edges, ZERO memory_event rows, ZERO node mutations. The navigation.cjs chokepoint is not bypassed; graph write-back stays Phase 212 / 201-03 territory. Boundary statement carried in both module headers.
- **Part 8 (Graph Boundary):** fully local; the only possible network touch is embedding-spine's one-time model-weight download by model id. No room bytes egress.
- **Part 7 (Reuse Before Build):** `cosineSimilarity` and `embedTexts` are consumed from 211-01's embedding-spine, not reimplemented.
- **Decision #8 (Tier-0 graceful degradation):** sqlite-vec and transformers.js are both OPTIONAL lazy requires inside function bodies; missing deps degrade (cjs-fallback backend / warning envelopes), the modules always load.

## Threat Model Compliance

- **T-211-03** (extension elevation) - mitigated: extension path is `require('sqlite-vec').getLoadablePath()` only, never env-supplied; `allowExtension` is opt-in per handle.
- **T-211-05** (fts5 MATCH injection / DoS on raw text) - mitigated: query reduced to alnum tokens, each double-quote-wrapped; raw punctuation cannot reach fts5 syntax (Test 2 asserts a `"; DROP TABLE nodes; --` query returns an array without throwing).
- **T-211-04 / T-211-SC** - accepted / covered by 211-01's legitimacy gate.

## Known Stubs

None. The `encodeFn` / `rerankFn` parameters are offline test-injection seams (documented contract seams), not shipped stubs - the real sqlite-vec and transformers.js paths are implemented and degrade gracefully where the optional dep is absent.

## Threat Flags

None. No new network endpoint, auth path, or trust-boundary schema change beyond the sqlite-vec extension load already registered as T-211-03.

## Notes for Downstream Plans

- **211-03** can read the lexical leg via `lexicalSearch` for `lexicalOverlap`, and reuse the same `embedTexts` measured semantic leg.
- **211-05** (`eureka-room-report.cjs`, `run-all-211.sh`) consumes `openRoomDb(roomDir, {allowExtension:true})` -> `indexNodes` -> `hybridRetrieve` -> optional `rerank`. To exercise the sqlite-vec primary leg and the real rerank model, run `npm install` first (deps are in package.json from 211-01 but node_modules is not carried across worktrees).
- Env tunables: `EUREKA_RRF_K` (default 25), `MINDRIAN_RERANK_MODEL` (default `Xenova/ms-marco-TinyBERT-L-2-v2`).

## Self-Check: PASSED

- Files exist: `lib/core/eureka/tri-modal-index.cjs`, `lib/core/eureka/hybrid-retrieve.cjs`, `tests/test-211-tri-modal.cjs`, `lib/core/room-db.cjs` (modified), `211-02-SUMMARY.md` - all FOUND.
- Commits exist: `3cb2eaa3` (RED task1), `3f61d085` (GREEN task1), `62041e06` (RED task2), `46b71239` (GREEN task2) - all FOUND in git log.
- Offline suite 8/8 PASS; Phase 200 regression PASS=6 FAIL=0; connector-registry OK.
