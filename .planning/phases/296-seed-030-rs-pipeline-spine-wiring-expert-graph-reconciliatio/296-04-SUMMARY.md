---
phase: 296-seed-030-rs-pipeline-spine-wiring-expert-graph-reconciliatio
plan: 04
subsystem: rs-pipeline
tags: [reverse-salient, rs_cache, pinecone-retirement, local-embedding, sidecar-cache, node-test, canon-part-8, canon-part-9]

# Dependency graph
requires:
  - phase: 296-03
    provides: "scripts/rs-vector-bridge.cjs -- the D-02 CJS-to-Python vector bridge (embed op used here for text-to-vector)"
provides:
  - "lib/core/rs_cache.py rewritten onto a per-room local sidecar (<room>/research/<slug>/.rs-signal-cache/vectors.jsonl + manifest.json), zero Pinecone SDK imports, zero network calls"
  - "tests/fixtures/296/stub-embed-bridge.cjs -- deterministic, ONNX-free embed-op stub protocol-matching scripts/rs-vector-bridge.cjs"
  - "tests/296-signal-corpus-local.test.cjs -- 8-proof test: zero-Pinecone, per-room isolation (closes SEED-029 F8), round-trip shape, TTL, model-invalidation, no-partial-write-on-failure, atomicity residue"
  - "tests/296-dim-invariant.sh now asserts and PASSES (no longer SKIPs)"
affects: [296-05, 296-06, 296-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-room sidecar cache instead of a remote per-topic index: <room>/research/<slug>/.rs-signal-cache/{vectors.jsonl,manifest.json}, atomic .tmp+os.replace writes on both files, mirroring the room-scoped provenance rs-engine.py already writes beside it"
    - "Read/write asymmetry on missing room scope: read functions (get_namespace_freshness, fetch_all_from_namespace) degrade to None/[] with one stderr line; upsert_corpus raises ValueError, because writing into a guessed room is worse than failing loudly"
    - "Model-identity cache invalidation: manifest.json carries embedding_model + embedding_dim; get_namespace_freshness compares against _bridge_provenance() (probed once per process, cached) and returns None on any mismatch, so a model swap self-heals via cold refetch rather than mixing embedding spaces in one cosine"
    - "Namespace-to-sidecar-path recovery: read functions locate the cache from the namespace string alone via _slug_from_namespace (namespace_slug and rs_corpus.topic_slug apply the identical normalization, so the slug half of 'external:{slug}' is exactly what topic_slug(topic) would produce) -- no topic string needed at read time"
    - "Deterministic ONNX-free test double: tests/fixtures/296/stub-embed-bridge.cjs protocol-matches the real bridge's embed op exactly (same request/response envelope) so lib/core/rs_cache.py cannot tell it apart from the wire, keeping the 8-test suite under 2.5s instead of paying a real model load"

key-files:
  created:
    - tests/fixtures/296/stub-embed-bridge.cjs
    - tests/296-signal-corpus-local.test.cjs
  modified:
    - lib/core/rs_cache.py

key-decisions:
  - "Followed the plan's planner_decision verbatim: sidecar at <room>/research/<topic-slug>/.rs-signal-cache/ rather than a new room.db table. No override -- the five stated reasons (provenance already lives beside it, sidesteps the Canon Part 9 icm-architect-consult gate a room.db table would require, keeps room.db lean, avoids F-5's id-space collision, closes SEED-029 F8 by construction) held up under implementation with no friction."
  - "metadata construction simplified from the plan's literal wording ('minus _id and minus abstract duplicated into a metadata[\"abstract\"] key') to a single dict comprehension excluding only _id -- since _build_records already carries abstract as a normal field, dropping _id alone naturally leaves abstract (and doi/title/year/source/fetched_at) in metadata with no duplication step needed. Verified by Test 4's exact-key assertion."
  - "get_namespace_freshness and fetch_all_from_namespace recover the topic slug directly from the namespace string (_slug_from_namespace, splitting on the 'external:' prefix) rather than requiring a topic argument neither function's existing signature carries -- namespace_slug and rs_corpus.topic_slug apply byte-identical normalization, so this is exact, not an approximation. Matches the plan's own docstring instruction: 'the room plus topic slug is what actually locates the cache.'"
  - "Wrote the docstring's retirement/Pinecone-history prose without ever spelling out the literal forbidden substrings (import pinecone / from pinecone / PINECONE_API_KEY / create_index_for_model / upsert_records / describe_index / api.pinecone.io / 1024 / multilingual-e5-large / not per-room) since the plan's own Task 1 acceptance criteria run a raw grep on the whole file, comment-lines-only stripped -- NOT docstring-stripped. Verified every one of those greps returns 0 before committing."

requirements-completed: [RSLOCAL-01, RSLOCAL-03, RSLOCAL-04]

# Metrics
duration: ~35min
completed: 2026-09-03
---

# Phase 296 Plan 04: RS Signal-Cache Pinecone Retirement Summary

**Rewrote `lib/core/rs_cache.py` off the last live Pinecone surface in the reverse-salient pipeline onto a per-room local sidecar (`<room>/research/<slug>/.rs-signal-cache/`), embedding through the CJS vector bridge's single shipped local encoder instead of a remote 1024-dim integrated-embedding index -- closing SEED-029's F8 cross-room bleed by construction and the 384-vs-1024-dim mixing hazard by removing the second embedding space entirely.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-09-03T21:35:36+03:00
- **Tasks:** 2/2 completed
- **Files modified:** 1 rewritten, 2 created

## Accomplishments
- `lib/core/rs_cache.py` (635 lines, up from 479): every public name and return shape a caller already uses (`namespace_slug`, `get_namespace_freshness`, `upsert_corpus`, `fetch_all_from_namespace`, `is_fresh`, `TTL_DAYS`, `MAX_NAMESPACE_VECTORS`, `INDEX_NAME`) is unchanged; only an optional `room_dir` keyword was added. Deleted `ensure_index`, `query_namespace`, `_pc`, `_namespace_vector_count`, the guarded Pinecone client import, and the four Pinecone-only constants. Verified importing the deleted names now raises `ImportError`. Zero network calls remain in this file; the one surviving egress on this whole path (`lib/core/rs_corpus.py`'s OpenAlex/arXiv/Tavily fetch) is untouched.
- New sidecar storage: `cache_dir(room_dir, topic)` -> `<room>/research/<topic-slug>/.rs-signal-cache/{vectors.jsonl,manifest.json}`, both written atomically (`.tmp` sibling + `os.replace`). `_embed_via_bridge` spawns `scripts/rs-vector-bridge.cjs`'s `embed` op in batches of `EMBED_BATCH=64`, asserts vector-count and per-vector-length consistency, and returns `([], None)` on any shape mismatch rather than writing a partially embedded corpus.
- Ran a full live round-trip against the REAL bridge (no stub) during Task 1 verification: `upsert_corpus` -> `fetch_all_from_namespace` on a temp room produced 2 records at the genuine local encoder's 384-dim, `get_namespace_freshness` correctly read them as fresh, and no `.tmp` file survived. This is a stronger proof than the plan strictly required for Task 1 and gave high confidence before Task 2's stub-based suite was written.
- `tests/fixtures/296/stub-embed-bridge.cjs`: deterministic (first-4-char-codes-normalized) embed stub, protocol-identical to the real bridge, plus a `STUB_296_FAIL` failure seam.
- `tests/296-signal-corpus-local.test.cjs`: 8/8 tests pass in ~2.4s (budget was 15s, no ONNX model load). Proves zero-Pinecone (comment/docstring-stripped source), clean import with `PINECONE_API_KEY` unset, per-room isolation (room B reads 0 records for a topic cached only in room A -- the direct SEED-029 F8 regression fence), round-trip shape stability (`id`/`values`/`metadata`, all metadata fields including `abstract` intact), TTL aging (31-day-old manifest reads stale, 1-day-old reads fresh), model-change invalidation (a manifest naming a different model reads `None`), no partial write on embed failure, and no leftover `.tmp` residue.
- `bash tests/296-dim-invariant.sh` now runs its real assertions (previously `SKIP:`-tolerant, waiting for this exact plan) and exits 0/`PASS`.
- `bash tests/run-all-296.sh`: PASS=7 FAIL=0 SKIP=0, 5 test files discovered (up from 296-03's PASS=5/SKIP=1). `bash tests/run-all-272.sh`: PASS=15 FAIL=0 SKIP=0, unchanged from the 296-03 baseline -- confirms this plan touched nothing in Phase 272's scope.
- D-06 fence held: `node tests/272-pinecone-inference.test.cjs` still PASSes and `python3 scripts/compute-hsi.py --help` still exits 0, so `PINECONE_API_KEY` and the `pinecone` package remain load-bearing for `lib/core/pinecone-inference.cjs` and `compute-hsi.py` Tier 2, untouched by this plan's scope-narrow removal (only `rs_cache.py`'s SDK calls were retired).

## Task Commits

Each task was committed atomically:

1. **Task 1: rewrite lib/core/rs_cache.py onto a per-room local sidecar** - `867be63d` (feat)
2. **Task 2: the deterministic embed stub and the five-proof local-corpus test** - `4494e339` (test)

**Plan metadata:** pending (this SUMMARY + STATE/ROADMAP update commit)

## Files Created/Modified
- `lib/core/rs_cache.py` - rewritten from a Pinecone `rs-external` index client to a per-room local sidecar cache; every public API name and shape preserved
- `tests/fixtures/296/stub-embed-bridge.cjs` - deterministic, protocol-matching embed-op stub used only by this plan's test file
- `tests/296-signal-corpus-local.test.cjs` - 8-test proof suite for the rewritten `rs_cache.py`

## Decisions Made
See `key-decisions` in frontmatter: (1) sidecar location followed the plan's `planner_decision` verbatim, no override taken; (2) simplified the metadata-construction wording to a single dict comprehension with an equivalent result; (3) recovered the topic slug from the namespace string rather than requiring an unavailable topic argument in the read functions; (4) wrote all retirement prose in the docstring around the plan's own raw (non-docstring-stripped) forbidden-token greps, verified clean before committing.

## Deviations from Plan

None - plan executed exactly as written. No Rule 1/2/3/4 auto-fixes were needed; every acceptance criterion in the plan (Task 1 and Task 2) passed on first verification run.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. This plan installs zero packages, adds zero dependencies, and does not touch `PINECONE_API_KEY` or the `pinecone` package (both remain load-bearing for out-of-scope surfaces per D-06).

## Known Temporary State (per the plan's own NOTE, not a defect)

`scripts/rs-engine.py` and `lib/core/rs_hybrid.py` still call `get_namespace_freshness` / `upsert_corpus` / `fetch_all_from_namespace` without a `room_dir` argument. Because `room_dir` defaults to `None` and `_resolve_room` falls back to `MINDRIAN_RS_ROOM` then `MINDRIAN_ROOM`, those callers currently degrade to an empty external corpus (verified live: `fetch_all_from_namespace('external:x')` prints one stderr line and returns `[]`; `get_namespace_freshness` returns `None`) rather than crashing. This is the KNOWN, TEMPORARY state the plan explicitly calls out as closed by plan 296-05, which threads `room_dir` through those call sites. Do not read a Mode B/C run producing an empty external side right now as a regression -- it is exactly the state the plan predicted.

`lib/core/rs-pinecone-bridge.cjs` (Phase 89.2, distinct from 296-03's `rs-vector-bridge.cjs`) still shells `python3` to call `rs_cache.fetch_all_from_namespace(namespace, limit)` without a `room_dir` argument either -- same degrade, same "closed in 296-05" status. Confirmed this file names no deleted symbol (`ensure_index`/`query_namespace`), so it still imports cleanly; it just currently reads empty until 296-05 lands.

## Next Phase Readiness
- `lib/core/rs_cache.py`'s public surface is stable and ready for plan 296-05 to thread `room_dir` through `scripts/rs-engine.py`, `lib/core/rs_hybrid.py`, and `lib/core/rs-pinecone-bridge.cjs`'s call sites -- no rename, no shape change required on this end.
- `tests/296-dim-invariant.sh` is now a live (non-skipping) regression fence for the 384-vs-1024-dim non-mixing invariant; any future reintroduction of a 1024-dim or `multilingual-e5-large` reference in `rs_cache.py` will fail it immediately.
- `tests/run-all-296.sh`'s Part 8 source sweep still lists `lib/core/rs_cache.py` under its documented EXEMPT-by-name entry (the sweep exempts this file regardless of state, per its own header comment) -- no edit was needed there, and none is recommended until the exemption itself is retired in a later plan.
- The sidecar's on-disk shape (`{id, values, metadata}` per line, `metadata['abstract']` present) is exactly what `scripts/rs-engine.py::_records_to_artifacts` already expects, so 296-05's consumer-side edits should only need a `room_dir` threading pass, not a shape translation.

---
*Phase: 296-seed-030-rs-pipeline-spine-wiring-expert-graph-reconciliatio*
*Completed: 2026-09-03*

## Self-Check: PASSED

- FOUND: lib/core/rs_cache.py
- FOUND: tests/296-signal-corpus-local.test.cjs
- FOUND: tests/fixtures/296/stub-embed-bridge.cjs
- FOUND: .planning/phases/296-seed-030-rs-pipeline-spine-wiring-expert-graph-reconciliatio/296-04-SUMMARY.md
- FOUND commit: 867be63d (Task 1)
- FOUND commit: 4494e339 (Task 2)
