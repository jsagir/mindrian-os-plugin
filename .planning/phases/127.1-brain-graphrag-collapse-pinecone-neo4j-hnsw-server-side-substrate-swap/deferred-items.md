# Phase 127.1 -- Deferred Items

## DI-127.1-01 (2026-05-19) -- Live Pinecone count drift (1,427 vs 8,543)

**Discovered during:** Plan 127.1-01 Task 2 (live export of pws-brain/core).

**Empirical state of pws-brain index (live, 2026-05-19):**

| Namespace | Live record count |
|-----------|-------------------|
| core      | 8,543             |
| materials | 1,775             |
| reference | 1,690             |
| tools     | 242               |
| graphrag  | 144               |
| books     | 7                 |
| **Total** | **12,401**        |

Index dim: 1024 (Lock 2 holds). No namespace is close to 1,427.

**Plan invariant (CONTEXT.md + 127.1-00 harness):** `EXPECTED_VECTOR_COUNT = 1427` in
namespace `core`. The Surface 1 harness (`tests/127.1-embedding-integrity.test.cjs`)
hardcodes `EXPECTED_VECTOR_COUNT = 1427` and asserts
`manifest.vector_count === 1427`.

**Root cause hypothesis:** The 1,427 figure is the historical "methodology-only"
count quoted across `docs/MINDRIAN-CANON.md` Part 7 ("1,427 embeddings") and
`.claude/includes/moat.md`. The live `core` namespace has accumulated
~8,543 records since that figure was canonized -- mix of methodology chunks +
slide decks + book chapters + transcripts (per metadata sample: `_source_namespace`,
`content_type`, `tier`, `total_chunks`).

**Records sample (metadata fields observed):** `_source_namespace=t1-core`,
`chunk_index`, `content_type` (default|slidedeck), `framework`, `source_file`
(local WSL paths), `tier=T3`, `title`, `total_chunks`. Records carry full
content snippets in `text` and `content` fields.

**Decision needed (Rule 4 architectural -- STOPS plan execution):**

The plan's 4-Lock contract cannot be honored as written because the foundational
"1,427 vectors" invariant is empirically stale. Four candidate paths forward:

- **Option A: Reset the count to 8,543** -- treat the full `core` namespace as
  the corpus, regenerate the Surface 1 harness `EXPECTED_VECTOR_COUNT=8543`,
  update CONTEXT.md acceptance criterion, re-run all Wave 0/1/2 plans against
  the new number. Most material change; preserves "byte-identical" Lock 1 over
  the actual live corpus.
- **Option B: Filter `core` to a "methodology-only" subset of ~1,427** -- find
  a metadata filter (e.g. `framework != ""` or specific `content_type` /
  `tier`) that yields exactly the historical 1,427 the canon names. If such a
  filter exists, the plan can proceed unchanged with the filter as an extra
  step. Requires investigation to find the filter; not guaranteed to exist.
- **Option C: Migrate a different namespace** -- pick the namespace whose
  count + content most aligns with "methodology" (e.g. `materials` at 1,775,
  `reference` at 1,690, or `tools` at 242). Update the plan and harness.
- **Option D: Re-canonize 1,427** -- decide the live `core` count is the truth,
  archive the historical 1,427 figure in docs/MINDRIAN-CANON.md Part 7 +
  `.claude/includes/moat.md` as "1,427 historical; ~12K production-live as of
  2026-05-19", proceed with Option A.

**Note on Canon Part 8:** Records carry full user content (book text, slide
deck snippets, local-machine source-file paths). Dumping to local NDJSON is
fine per Canon Part 8 (the dump stays in `~/.mindrian/127.1/`, gitignored).
The manifest fixture is still checksums-only and safe to commit. The
substrate swap to Neo4j HNSW is purely server-side; no new egress surface.

**Status:** Blocking Plan 127.1-01 Task 2 + Plan 127.1-02 Task ? (loader will
hit the same drift) + Plan 127.1-03 cutover gate (overlap harness contract
depends on the corpus size).

**Owner:** Jonathan (canon custodian).

