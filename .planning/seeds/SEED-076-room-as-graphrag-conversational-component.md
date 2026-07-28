# SEED-076 - Room-as-GraphRAG conversational component (BYOAPI, Larry-voiced, provenance-aware)

> **Renamed from SEED-054** (2026-07-28, Critical Pathway id-collision resolution): this file and
> `SEED-054-beautiful-question-seed-harvest-feynman-pipeline.md` were independently filed under
> the same id on 2026-07-06 (both "Registered: 2026-07-06", zero downstream references either
> way). Per the INDEX's chronological + downstream-weight collision rule, filesystem mtime was
> the only remaining tiebreaker: the Beautiful-Question pipeline file was created first
> (~32 minutes earlier), so it keeps SEED-054. This seed moves to SEED-076, the next free slot.
> See `.planning/seeds/INDEX.md` "Collision resolution" section for the precedent this follows.

> Framing (navigator, 2026-07-06): publish a ROOM as a GraphRAG with a Larry personality as a
> component, so a tenant (e.g. Oliver / JHTV) can "talk" to their room in a way that knows
> everything filed into it, WHY it is there, and HOW it connects. Gemini 2.5 (available as an env
> key) drives the conversion/generation. The reframe: this is mostly ASSEMBLY of parts that shipped
> in v1.15.3-beta.12, not new invention.

**Registered:** 2026-07-06 (navigator-directed, live conversation; recon-grounded)
**Class:** ARCH + PRODUCT | **Status:** seed
**Grounding:** the room graph (`lib/core/navigation.cjs` + `room.db`), Phase 211 tri-modal retrieval
(`lib/core/eureka/{tri-modal-index,hybrid-retrieve,vector-store,embedding-spine,lexical-overlap}.cjs`,
shipped beta.12), the Larry personality (larry-extended agent + larry-personality skill), the
dashboard/export system (`scripts/generate-standalone`, SnapshotHub), and a Gemini 2.5 env key
already present in the environment.

## The gap SEED-054 closes

"Build a GraphRAG from the room" reads like net-new work. It is not. The pieces exist:

- **The graph:** the room IS a typed graph already (`room.db` via the `navigation.cjs` chokepoint):
  artifacts (WHAT), `FILED_AS_DECISION` / `REJECTED_BECAUSE` / rejection-reason / cascade edges
  (WHY), and the cross-ref / `FEEDS_INTO` / provenance edges (HOW).
- **The retrieval (the RAG half):** Phase 211's tri-modal retrieval (FTS5 lexical + sqlite-vec
  vector + RRF fusion, `mdbr-leaf-ir` local embedder) shipped in beta.12 and runs at production
  scale (2117-node room proven). That IS the GraphRAG retrieval layer over the room.
- **The generation:** Larry (personality + reach machinery) is the voiced answer surface.
- **The publish surface:** the export system already turns a room into a standalone HTML
  (`generate-standalone`, the De Stijl dashboard). The missing piece is the CONVERSATIONAL variant.

So a "room-GraphRAG you can talk to" is: room graph + 211 retrieval + a BYOAPI generation driver +
a conversational publish surface. Three of four already ship.

## The three genuinely-new pieces

1. **A BYOAPI generation driver (Gemini 2.5).** The tenant's own LLM answers over their own room's
   retrieved subgraph. An env-keyed seam (`GEMINI_API_KEY` or similar) selects the driver; Larry's
   voice/reach rules shape the prompt; the 211 retrieval supplies the grounded context.
2. **The conversational publish surface ("talk to your room").** A shareable component (hosted or
   standalone) where the tenant converses with their room. This is the BYOAPI-chat gap the Synteris
   SnapshotHub template already flagged as missing (see MEMORY: project_snapshot_hub_standard).
3. **Provenance-in-answers (the WHY/HOW made first-class).** Because the room's edges already encode
   why each artifact is filed and how it connects, answers cite provenance ("this is here because
   you rejected X for reason Y; it feeds into Z"), not just content. This is the differentiator
   over a generic doc-RAG.

## Part 8 / privacy (load-bearing, stated plainly)

- Using Gemini to process the room is the TENANT's own LLM on the TENANT's own data - their choice,
  exactly like Larry running on Claude. It is NOT a Canon Part 8 breach: Part 8 guards the MINDRIAN
  BRAIN (LOCAL -> Brain: NO). The Brain never sees room content in this design; it stays untouched.
- BUT it DOES egress tenant content to a third party (Google). That requires explicit TENANT
  consent (Oliver opts in to "answer with Gemini over my room"). Design an opt-in gate; default off.
  Local-only generation (a local model, or Claude-in-session) is the zero-egress alternative tier.
- The GENERIC capability stays clean: no tenant data in the product; the component is instantiated
  per-room in the tenant's space (Room layer), like SEED's three-layer model requires.

## The full pipeline this completes (with the csv-to-room gap)

The JHTV cleanup flagged a missing generic `scripts/csv-to-room.cjs` (CSV -> room.db ingest). With
that, the end-to-end product story is: **CSV -> room (ingest) -> GraphRAG (211 retrieval over the
room graph) -> conversational component (BYOAPI + Larry, provenance-aware).** "Turn any dataset into
a room you can have a conversation with." csv-to-room is the ingest head; SEED-054 is the talk-to-it
tail; Phase 211 is the retrieval spine already shipped.

## Reuse map (Canon Part 7 - assemble, do not reinvent)

| Need | Reuse | Notes |
|------|-------|-------|
| The graph (what/why/how) | `lib/core/navigation.cjs` + `room.db` typed edges | provenance edges already encode why/how |
| Retrieval | Phase 211 `hybrid-retrieve` / `tri-modal-index` | shipped beta.12; the RAG half |
| Generation voice | Larry (larry-extended + larry-personality) | reach rules shape the prompt |
| Publish surface | `scripts/generate-standalone` / SnapshotHub | add the conversational variant |
| Ingest head | `scripts/csv-to-room.cjs` (SEED gap) | the CSV -> room step |
| BYOAPI driver | Gemini 2.5 env key | plus a zero-egress local tier |

## Open questions for research / plan

1. Hosted component vs standalone-file vs local server for the "talk to your room" surface?
2. Which Gemini tier (2.5 flash for cost, 2.5 pro for depth) - and the local zero-egress fallback?
3. Consent UX for tenant-data-to-Google (opt-in gate, default off, per-room).
4. Does provenance-in-answers need a new retrieval mode (edge-aware) on top of 211's node retrieval,
   or does 211 already surface the edges? (Verify against `tri-modal-index` at plan time.)
5. Relationship to the Brain: the Brain is generic-methodology; this is tenant-room-specific, so it
   is a LOCAL/tenant capability, NOT a Brain feature. Keep it out of the Brain boundary.

## Cross-references

- Phase 211 (`lib/core/eureka/*`, shipped v1.15.3-beta.12) - the retrieval spine
- SEED-049/050 (the Eureka generator/critic that also reads this room graph)
- SEED-053 (methodology-chain MCP tool - the sibling "expose a capability" seam)
- The csv-to-room.cjs gap (flagged by the JHTV relocation, commit 57bad7ed) - the ingest head
- MEMORY project_snapshot_hub_standard (the SnapshotHub with "BYOAPI chat missing" - the surface this fills)
- `lib/core/navigation.cjs` (the typed-edge graph that encodes why/how), Canon Part 8 (Brain boundary, untouched here)
