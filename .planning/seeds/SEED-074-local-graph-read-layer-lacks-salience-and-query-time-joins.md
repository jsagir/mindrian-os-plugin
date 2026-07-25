---
seed: local-graph-read-layer-lacks-salience-and-query-time-joins
canon_parts: [4, 9]
status: proposed
created: 2026-07-25
source: rethinking-mindrianos/research/2026-07-25-graph-query-time-collapse-sag-paper-sqlite-kg-crate/
gated_on: measured room.db density crossing a real threshold OR a reproduced relevance-degradation symptom in graph_query/whitespace_scan/contradiction_check output OR Brain cross-room pattern queries
---

# SEED-074 — The local graph read layer has no salience or clustering primitive, and no query-time-join fallback for when BFS degrades. Neither is needed yet, both are worth having designed before they are.

## Where this came from

Same-day chain, not a cold pitch: diagnosing MindrianOS's own `/mos:memory` architecture led
to root-causing a live bug in a sibling personal tool (`langtalks-graph-expert`,
`query_relationship` was structurally guaranteed to return zero relationship data at its
shipped default budget, fixed same day, GSD quick task `260725-9mp`, commits `af815f6` /
`14329cb` / `a64dc2b`). That bug turned out to be a named, peer-reviewed failure class (SAG,
arxiv.org/html/2606.15971v1: "systematic decoupling between offline structure and online
recall"), and a Rust crate surfaced alongside it (`sqlite-knowledge-graph`,
github.com/hiyenwong/sqlite-knowledge-graph) whose algorithm menu, not its code, is the
relevant part. Full evidence trail: the room entry cited in `source:` above.

## The gap (code-level, true today regardless of data volume)

`graph_query`, `whitespace_scan`, and `contradiction_check` (all routed through
`lib/core/navigation.cjs` / `lib/core/navigation/insights.cjs`, per Canon Part 9's
substrate guard, no direct `room.db` opens outside that chokepoint) do plain graph
traversal. No salience ranking (which claim in a room's local graph actually matters
most), no clustering (which claims naturally group into the same whitespace gap). This is
a real, present-tense gap in the code's capability, independent of whether any room's data
is currently large enough to expose it as a user-visible problem.

## Measured reality check (2026-07-25, not asserted, not invented)

Sampled two of this session's active rooms' local graph substrate directly:

```
rethinking-mindrianos/.mindrian/room.db -> 0 tables
iris2026/.mindrian/room.db              -> 0 tables
```

Both empty. `navigation.cjs` takes `(db, params)` over a caller-owned handle, so schema
population happens elsewhere on first real write, not in either sampled room yet. **There
is currently no evidence this gap bites in practice anywhere in this codebase.** Only two
rooms were sampled; this is a spot-check, not a census, do not extrapolate it to "MindrianOS
rooms are all empty."

## Third source, same direction, one new angle (2026-07-25 addendum)

`agentflare-ai/sqlite-graph` (`sqlite-utils-plugin` subdirectory, MIT, 278 stars/14 forks)
surfaced independently. Same verdict as `sqlite-knowledge-graph`, do not adopt: Python +
a native compiled extension (`libgraph.so`), not this repo's CJS-only stack, same
one-command-install breakage. langtalks-graph-expert's own corpus has nothing real on it
either (`get_entity("sqlite-graph")` returned one hit, a substring match inside an
unrelated repo's citation, not actual coverage, logged honestly rather than stretched).

Two things worth carrying forward though: it's a third independent source naming PageRank
as a standard primitive for exactly this shape of problem (graph salience over a SQL-backed
store), which raises confidence that's the right one to build, not just a plausible one. And
it names a real gap neither earlier source did: MindrianOS's local graph has no query
language at all today, `graph_query`/`whitespace_scan`/`contradiction_check` are hand-written
traversal, not `MATCH`-style pattern queries. Worth having in mind if this SEED is ever
scoped into a phase, whether the read layer wants a small pattern-match surface, not just
salience scoring, not worth a build decision now, still gated on the same trigger above.

## The target, when the gate below actually opens

Two independent, separable primitives, do not bundle them into one build:

1. **Salience + clustering.** PageRank-style scoring and Louvain-style community detection
   as small functions callable from the read side of the navigation chokepoint. Not a
   dependency, `sqlite-knowledge-graph` is Rust and this codebase is CJS-only by
   convention (see `CLAUDE.md` Conventions); steal the function menu, not the crate. Both
   algorithms are small and well-understood enough to hand-roll in JS against `room.db`,
   or via a lightweight existing JS graph library, evaluate at build time, not now.
2. **Query-time bounded joins, only if BFS degrades.** If a room's local graph, or Brain's
   cross-room pattern queries, ever show the same symptom root-caused in
   `langtalks-graph-expert` (a real graph, degraded answer, because the read path does
   unbounded-ish BFS instead of a query-scoped traversal), SAG's pattern (typed entity/event
   index + query-time SQL joins building one local hyperedge scoped to the actual question,
   not pre-built graph topology) is the fix to reach for. Not "raise a token budget" again,
   that patch has a ceiling and this codebase already proved it does on the exact same day
   this SEED was written.

## Why this is a SEED, not a phase

Building either primitive against an empty substrate is speculative infrastructure — the
Reuse-Before-Build discipline this repo already holds (`CLAUDE.md`, Canon Part 7) argues
against scoping a phase for a problem with zero measured instances in this codebase today.
Holding as a SEED, same posture `SEED-framework-coverage-live-population.md` takes for its
own admin-gated denominator: the direction is sound, the trigger to act on it is not
present yet.

## Hard guard on any downstream claim

Do NOT state or imply in any future artifact that MindrianOS's room graphs are "dense" or
"at risk" today. The only measurement taken (two rooms, 2026-07-25) found zero populated
local graphs. If this SEED is picked up later, the very first task must be re-measuring
current density across a real sample of active rooms, not assuming today's snapshot still
holds.

## Suggested first move, if anyone picks this up before the gate opens

Cheapest possible next action, not the two primitives themselves: add a density read to
`/mos:doctor` or `room_state --acceptance` output (node count, edge count per room.db) so
the trigger condition in `gated_on` above becomes something the system reports on its own,
instead of something a human has to remember to go check by hand like this SEED's own
measurement section had to.

## Cross-references

- `rethinking-mindrianos/research/2026-07-25-graph-query-time-collapse-sag-paper-sqlite-kg-crate/` (this room) — full evidence trail, all citations, the langtalks bug write-up in full
- `~/langtalks-graph-expert/.planning/quick/260725-9mp-fix-langtalks-graph-expert-query-relatio/` — the proven instance of the failure class this SEED generalizes from
- `lib/core/navigation.cjs`, `lib/core/navigation/insights.cjs` — where either primitive would land
- `.planning/seeds/SEED-framework-coverage-live-population.md` — precedent for "sound direction, ungated trigger, hold as SEED" posture
- Canon Part 4 (every choice is graph data), Part 9 (Memory Locality, `room.db` substrate guard), `docs/MINDRIAN-CANON.md`
- arxiv.org/html/2606.15971v1 (SAG); github.com/hiyenwong/sqlite-knowledge-graph (crate, reference only, not a dependency)
