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

### RESOLUTION (2026-05-20) -- Option A selected

**Decision:** Option A. The corpus is the full live `core` namespace. The
foundational invariant moves from `EXPECTED_VECTOR_COUNT = 1427` to
`EXPECTED_VECTOR_COUNT = 8543`. "Byte-identical" Lock 1 now applies over the
actual live `core` corpus, not the historical methodology-only subset.

**Decided by:** Jonathan (canon custodian), via the /gsd:progress Decision Gate
(Canon Part 3, tri-context).

**Required edits before Plan 127.1-01 can re-run GREEN:**

1. `tests/127.1-embedding-integrity.test.cjs` -- `EXPECTED_VECTOR_COUNT`
   1427 -> 8543; the `manifest.vector_count === 1427` assertion -> 8543.
2. `127.1-CONTEXT.md` -- the EXPECTED_VECTOR_COUNT invariant + the matching
   acceptance criterion restated to 8543 in namespace `core`.
3. Plans `127.1-01` / `127.1-03` / `127.1-04` -- every `must_haves` / `truths`
   line that names "1,427" re-stated to "8,543". The export script, the Neo4j
   loader, and the 0.80 top-5 overlap cutover gate all run against the
   8,543-record `core` corpus.
4. Locks 1 (byte-identical, no re-embedding) and 2 (e5-large, 1024 dim,
   namespace `core`) are UNCHANGED -- both hold over the larger corpus.

**Follow-up (NOT blocking 127.1 -- Option A, not D, was chosen):**
`docs/MINDRIAN-CANON.md` Part 7 and `.claude/includes/moat.md` still read
"1,427 embeddings". Option A resets the count without re-canonizing; the
canon doc line is now stale and should be corrected as a separate doc task
(the Part 6 dog-fooding mandate would otherwise flag it as a CONTRADICTS edge).

**Status:** RESOLVED. Plan 127.1-01 is unblocked once the open plans
(01, 03, 04) and CONTEXT.md are re-planned against 8,543.

---

## DI-127.1-02 (2026-05-20) -- Neo4j already has a native HNSW vector substrate; phase premise invalid

**Discovered during:** /gsd:plan-phase 127.1 re-plan. Jonathan asked for a
live Neo4j schema read (`my-neo4j` MCP) to ground the canon in real numbers
before re-planning. The read invalidated the phase premise itself.

**Empirical state of the live Brain Neo4j graph (2026-05-20):**

| Metric | Canon / Plan claim | Live Neo4j reality |
|--------|--------------------|--------------------|
| Total nodes | "21K+" | **15,298** |
| Total relationships | "65K+" | **19,713** |
| Vector substrate | "migrate Pinecone embeddings into a NEW Neo4j HNSW index" | **7 native HNSW vector indexes already exist and are populated** |
| Embedded nodes | n/a | **6,007** nodes carry an `embedding` property |
| Embedding dims | "1024 (multilingual-e5-large)" -- Lock 2 | **384**, uniform across all 6,007 |
| HNSW params | D-01 open question (default m=16 / ef=100?) | already m=16, ef_construction=100, COSINE, quantization on |

**7 live vector indexes:** concept_embeddings, creativework_embeddings,
entity_embeddings, framework_embeddings, person_embeddings, product_embeddings,
`vector` (Chunk). All 384-dim COSINE HNSW (indexProvider vector-3.0; Chunk on
vector-2.0).

**Why this invalidates Phase 127.1 as planned:**

1. The phase premise -- "collapse the dual substrate by migrating Pinecone
   embeddings into a NEW Neo4j HNSW index" -- is false. Neo4j is not
   vector-empty. The native HNSW substrate already exists and is populated.
2. Lock 1 ("byte-identical, no re-embedding") is IMPOSSIBLE. Pinecone vectors
   are 1024-dim (e5-large). Neo4j vector indexes are defined at 384-dim. A
   1024-dim float array cannot be loaded byte-identically into a 384-dim
   index. The two are different embedding spaces from different models.
3. Lock 2 ("multilingual-e5-large, 1024 dims") is false against the live
   graph. The Neo4j embeddings are 384-dim -- 384 rules out e5-large;
   consistent with all-MiniLM-L6-v2 or e5-small. Model not labeled in-graph.
4. DI-127.1-01's "1,427 vs 8,543" count question is moot for the Neo4j side --
   the Neo4j vector corpus is 6,007 nodes, neither figure. (8,543 is the live
   Pinecone `core` count; the two stores are independent.)

**Instance identity -- RESOLVED (2026-05-20):** confirmed by owner attestation
(Jonathan, canon custodian + infra owner, stated the config-file MCP creds are
the production creds) plus corroborating evidence: (a) the `my-neo4j` graph is
the unmistakable Brain teaching graph (methodology labels + 7 vector indexes);
(b) the `pinecone` MCP independently reached `pws-brain` -- the exact index the
`mindrian-brain` render.yaml names via `PINECONE_INDEX=pws-brain` -- and
returned 12,401 vectors / 1024-dim / e5-large / cosine, matching DI-127.1-01.
The config-file creds reach the same production substrates the Render service
uses. Render's MCP structurally cannot expose the `sync:false` secret
`NEO4J_URI` for an automated string-match; owner attestation is the Canon
Part 9 confirmation path ("the human confirms truth"). The canon number
correction is UNBLOCKED.

**Canon surfaces carrying stale numbers (correct ONLY after instance identity
is confirmed -- editing canon off a non-production graph is itself drift):**
- `docs/MINDRIAN-CANON.md` Part 2 Engine 1 -- "Pinecone 1,427 embeddings",
  "1,427 methodology nodes"
- `.claude/includes/moat.md` -- "21K+ nodes, 65K+ relationships",
  "1,427 embeddings"
- `CLAUDE.md` -- "Neo4j 21K nodes + Pinecone 1.4K embeddings",
  "21K+ nodes / 65K+ relationships", "Pinecone | 1,427 embeddings"

**Status:** BLOCKING. Phase 127.1 cannot be re-planned around the existing
plan contract -- the contract describes a migration that has no valid target.
The phase needs re-scoping with the navigator before plan-phase can proceed.
`/gsd:plan-phase 127.1` halted at the planner-spawn gate on 2026-05-20.

**Owner:** Jonathan (canon custodian + navigator).


---

## DI-127.1-03 (2026-05-20) -- ROADMAP.md prose carries the stale "1,427 vectors" figure

**Discovered during:** Plan 127.1-02 corrective re-execution (state-update step).

`.planning/ROADMAP.md` (Phase 127.1 section, requirement list) still reads
`127.1-10 (1,427 vectors loaded round-trip verified)`. The re-scope corrected
the count to 12,401 everywhere in code; the ROADMAP prose was not swept.
`.planning/` is gitignored, and ROADMAP.md is outside Plan 127.1-02's
`files_modified` scope, so it was not edited in this plan. This is a cosmetic
doc-staleness item; the code substrate is correct (12,401 loaded, verified).

Also: `.planning/REQUIREMENTS.md` carries no `GRAPHRAG-COLLAPSE-127.1-*`
checkbox entries -- the requirement IDs live only in ROADMAP.md prose, so
`gsd-tools requirements mark-complete` had nothing to check off.

**Fix (not blocking 127.1):** sweep the ROADMAP.md Phase 127.1 requirement
list 1,427 -> 12,401, and optionally add the GRAPHRAG-COLLAPSE-127.1 IDs as
proper REQUIREMENTS.md checkboxes so completion is trackable.

**Status:** Open, cosmetic. Owner: Jonathan (canon custodian).
