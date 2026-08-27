---
seed: icm-semantic-substrate-provenance-dependency-graph
canon_parts: [3, 7, 8, 9]
status: proposed
created: 2026-08-27
source: rethinking-mindrianos/research/2026-08-27-icm-semantic-substrate/
gated_on: Phase 273 (SQLite Graph Chokepoint Hardening) landing first -- a provenance/dependency graph built on an unreliable write chokepoint would inherit that unreliability invisibly, worse than no graph at all
---

# SEED-075 -- ICM's own founding paper names the missing piece (traceability, not observability); a disposable SQLite provenance/dependency sidecar under the canonical filesystem is the proposed shape, sequenced strictly after Phase 273

## Where this came from

Same-day chain, navigator-driven: a review of Phase 273's SQLite chokepoint findings led to
the navigator independently proposing an "ICM Semantic Substrate" -- SQLite as a disposable,
rebuildable dependency/provenance/versioning index sitting under ICM's canonical,
human-editable filesystem, never replacing it -- then extending it into a three-layer
"ICM / local SQLite / remote Neo4j" product architecture. Both were independently verified
before being treated as grounded (arXiv 2603.16021 fetched and read in full via `pypdf`
after `pdftoppm`/`pdftotext` proved unavailable; the existing `packet.cjs`/decisions.md
mechanisms the second proposal partially restates were checked against the live code). Full
evidence trail: `rethinking-mindrianos/research/2026-08-27-icm-semantic-substrate/`.

## The paper this seed is literally an extension of

MindrianOS's own `docs/MWP-SPECIFICATION.md` (already shipped, lines 15/25/532) cites
Van Clief & McDermott's "Interpretable Context Methodology: Folder Structure as Agentic
Architecture" (arXiv 2603.16021, 2026) as one of MWP's six foundational pillars. That paper's
own Section 6 ("6.1 ICM as Multi-Pass Incremental Compilation", "6.2 Toward Semantic
Debugging", "6.3 Source Integrity and the Edit-Source Principle") names exactly the gap this
SEED proposes filling, in the paper's own words: "ICM currently provides observability but
not traceability... The question is what a debugger for semantic content would look like."
This SEED is a candidate concrete answer to that paper's own open question, not a speculative
add-on unrelated to ICM's stated lineage.

## The gap (two related but distinct proposals, both gated here together)

1. **Provenance/dependency substrate.** No mechanism today answers "which instruction,
   source file, or previous-stage output caused this artifact" (the paper's own framing:
   compiler debug symbols / source maps). `lib/core/lazygraph-ops.cjs` and
   `lib/core/navigation.cjs` are read-mostly, current-state stores -- they do not track
   dependency edges between artifacts, do not version artifacts across human edits, and do
   not record which run produced or consumed which span of which file.
2. **Structured local/remote privacy boundary.** `lib/core/navigation/packet.cjs`'s
   `privacy_mode` enum already implements the PRINCIPLE (abstract before crossing the Brain
   boundary), but not the navigator's proposed concrete shape (a structured problem-signature
   object: domain / stage / buyer_structure / adoption_pattern / evidence_state /
   strategic_problem[]) that a remote methodology query would build from instead of the
   current, less structured packet shape.

## Explicitly NOT this seed's job (already real, do not silently re-propose)

Checked against the live codebase before filing, not assumed:
- The approve/reject/defer loop terminating locally and never writing trusted memory
  remotely: Canon Part 3 (Tri-Context Decision Gate) + Key Decisions #1/#8, already true by
  construction.
- "Rejection is data": Key Decision #13, already decided, word-for-word matching the
  navigator's own framing. Only the CONCRETE graph shape (a `proposal` node with
  `rejected_by`/`reason`/`timestamp`) is new; the principle is not.
- The filesystem staying canonical / SQLite being rebuildable and disposable: already the
  informal discipline `lib/core/room-db.cjs`'s migrations follow (`IF NOT EXISTS`,
  sentinel-idempotent); this seed's contribution is stating it as an explicit invariant for
  a NEW capability layer, not inventing the discipline.

## Hard sequencing gate

**Do not start on this before Phase 273 lands.** Phase 273 found 5 Critical bugs in the
EXISTING write chokepoint (`writeEdge` silently discarding writes under a confirmed-row
guard, a schema mismatch against `lazygraph-ops.openGraph` handles, an unenforced
Brain-edge-type allowlist, propagation gaps in busy-timeout and nested-transaction handling).
A provenance/dependency graph built on top of a chokepoint that silently drops some fraction
of writes would inherit that unreliability invisibly -- a debugger that lies about what
actually ran is worse than no debugger. Harden first, then build traceability on a chokepoint
proven reliable.

## Prior art worth reusing, not reinventing (Canon Part 7)

`dpapathanasiou/simple-graph` (github.com/dpapathanasiou/simple-graph, MIT, 1,527 stars,
verified live this session via `gh api`) offers two directly relevant, already-working SQL
patterns: a `GENERATED ALWAYS` id column deriving `nodes.id` from the JSON body (structurally
prevents the id/body drift Phase 273's M12 names), and a `traverse.template` recursive CTE
handling inbound/outbound edges as explicit separate branches (a worked example of correct
bidirectional traversal, directly relevant to fixing Phase 273's U-2). Its FK constraints
must NOT be ported -- MindrianOS's own `edges` table deliberately carries no FK, per its
Phase 169 D-169-11 fix, because a `NESTED_WITHIN` edge's endpoint can live in a different
room's database. Full detail: Phase 273's own ROADMAP.md cross-link.

## What "gated" means here, concretely

This SEED does not spec an implementation. Its own first concrete action, if picked up after
Phase 273 closes: scope a MINIMAL first slice (likely: dependency edges + a "which stages/
artifacts does this file affect" query, the paper's own Section 6.1 dependency-tracking
future-work item) rather than the full nine-table schema sketched in the research note --
build the smallest thing that answers one real traceability question, per this repo's own
MVP-first / reuse-before-build discipline, not the whole architecture at once.

**MindrianOS already has a partial answer to Section 6.2's "what would a debugger for
semantic content look like" question, worth scoping against rather than ignoring: the
Feynman-Minto reasoning layer** (`/mos:mos-reason`, `lib/core/brain-derivation.cjs`,
`lib/core/brain-md-schema.cjs`). Per-section, it already streams Feynman stages 1/2/4/5
(essence, plain language, mental model, sweet spot) into a `governing_thought` -- a real,
shipped "why does this section say what it says" explanation layer, regenerated on a
staleness trigger. It is NOT the paper's source-map/provenance mechanism (it explains a
section's CURRENT content, not which specific instruction or prior artifact produced a
specific sentence) -- the two are complementary, not duplicates. Any SEED-075 implementation
should read `brain-derivation.cjs` first and either compose with the governing-thought layer
or explicitly justify not doing so, rather than build a second, disconnected explanation
mechanism.

**A second adjacent piece, checked for fit rather than assumed (2026-08-28): the
`common-ground`/`reasoning-graph` skill's decision-tree Mermaid output is a candidate FEEDER
for this substrate, not a competing mechanism.** That skill produces `COMMON-GROUND.md` +
a Mermaid `flowchart` per session -- decision nodes (yellow), chosen paths (green), rejected
alternatives (gray), uncertain branches (orange), concrete implementations (blue), each edge
weighted and source-tagged (`[stated]`/`[inferred]`/`[assumed]`/`[uncertain]`). Structurally
this is the same shape SEED-075 already proposed for the semantic-substrate's edges (a
deterministic/inferred split, confidence-scored, PROPOSED-vs-CONFIRMED). The gap: it is
purely EPHEMERAL, one file per session, never persisted anywhere queryable -- a real decision
trail that evaporates when the session ends. If SEED-075 is ever built, `COMMON-GROUND.md`'s
decision graph is a natural INPUT (each session's rejected-alternative/chosen-path/uncertain
nodes writing into the substrate as real provenance, closing exactly the "session reasoning
gets lost" gap this seed exists to address) rather than a second, parallel reasoning-capture
mechanism to reconcile against. Not scoped further here -- named so it isn't rediscovered
independently later.

## Cross-references

- `rethinking-mindrianos/research/2026-08-27-icm-semantic-substrate/` -- full evidence trail,
  both proposals, what's new vs. already-shipped.
- `~/MindrianOS/research/2026-08-27-icm-semantic-substrate/` -- source-of-record mirror.
- Phase 273 (`.planning/ROADMAP.md`) -- the hard prerequisite; also carries the
  `simple-graph` prior-art cross-link this seed reuses.
- SEED-074 (`local-graph-read-layer-lacks-salience-and-query-time-joins.md`) -- the
  narrower, already-gated algorithm-menu (PageRank/Louvain) subset of this larger vision.
  Kept as a separate SEED so its own trigger condition stays legible; this SEED supersedes
  neither its scope nor its gate.
- `docs/MWP-SPECIFICATION.md:15,25,532` -- the already-shipped citation of the founding
  paper this SEED extends.
- `lib/core/navigation/packet.cjs:28,44,363-367` (`privacy_mode`), `.claude/includes/
  decisions.md` (#1, #3, #8, #13) -- the already-real mechanisms the "three-layer"
  follow-up proposal partially restates.
- arXiv 2603.16021 (Van Clief & McDermott, 2026) -- the paper itself, Sections 6.1-6.3.
