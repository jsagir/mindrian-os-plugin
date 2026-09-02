---
seed: enlarge-room-schema-layered-icm-structure-plus-notion-gap-close
canon_parts: [7, 9]
status: promoted
promoted_to_phase: 275
promoted: 2026-08-31
created: 2026-08-28
source: rethinking-mindrianos/research/2026-08-27-icm-semantic-substrate/ (addendum), SEED-075, SEED-076, PROJECT.md "Notion Template Gap Close"
gated_on: "gate 1 (taxonomy question this seed itself surfaces, see 'Open question' below) RESOLVED 2026-09-02, see '## ADDENDUM 2026-09-02' below; gate 2 (Phase 270's OQ-7, already surfaces item 4/6 independently) STILL OPEN, still blocking"
mandatory_consult: "langtalks-graph-expert, continuously, every stage of Phase 275's lifecycle (navigator ruling 2026-08-31) -- in addition to the standing icm-architect consult, not instead of it"
---

**PROMOTED to Phase 275** (`.planning/ROADMAP.md`, 2026-08-31). This seed file stays as the full-detail source; the ROADMAP.md phase entry is the numbered, discoverable pointer. Still gated (see `gated_on` above) - gate 1 (taxonomy question) cleared 2026-09-02, see `## ADDENDUM 2026-09-02` below; do not run `/gsd-plan-phase 275` until gate 2 (Phase 270's OQ-7) also clears.

# SEED-084 -- Enlarge the room schema itself: merge the parked Notion gap-close backlog with tonight's live ICM audit, organized by icm-architect's layered context hierarchy

## Where this came from

Chained same-session, navigator-driven: icm-architect skill installed + run live against
`launchpad-02` (SEED-076: per-section contract file missing repo-wide, `funding/` and
`opportunity-bank/` have no identity file, `team/` empty) -> Brain + Theo queried to ground
the Feynman-Minto layer's textual lineage and surfaced a stage-taxonomy discrepancy
(SEED-075 addendum) -> navigator asked whether the "PWS 22-task workbook" material could
shape the missing contract file -> in the course of answering, rediscovered a THIRD, older,
still-parked source: `PROJECT.md`'s **"Notion Template Gap Close (Captured 2026-04-14)"**
section, a diff against a third-party Notion "Problem Worth Solving" template the navigator
shared in April, six items, never promoted past PROJECT.md/ROADMAP OQ-7. Navigator's
instruction: seed the enlargement, using the layered folder structure both the template and
icm-architect's own audit point at, not just patch the one missing file SEED-076 found.

## The convergence, stated plainly

Three independent sources, four months apart, landed on overlapping structural gaps:

| Gap | Notion diff (2026-04-14) | icm-architect audit (2026-08-28) |
|---|---|---|
| `funding/` has no real identity | Item 4: "Funding Options as a room section" | Found live: `funding/` = bare `STATE.md`, `total_entries: 0`, no `ROOM.md` |
| Room unusable without Larry/CLI | Item 6: "Self-guiding room" | Walk test fails for a foreign host without MCP tools (`ROOM.md` carries zero routing content) |
| No single always-visible claim per section | Item 1: "Per-section one-liner STATEMENT" | Invariant 4 gap: no section states its own contract/purpose in one stable place |

Three occurrences of the same class of finding, from three different methods (a competitor
template diff, a live methodology audit, a graph-grounding pass), is exactly the "pattern,
not gripe" bar `forms.md`'s Context-map form sets for promoting a signal. This SEED is that
promotion -- from three parked/scattered findings to one coherent proposal.

## The proposal: enlarge by LAYER, not by flat item list

Patching the six Notion items onto the current 11 flat sections would just add more files at
the same layer. `MindrianRooms/CLAUDE.md` already claims a layered structure it does not
implement per-room (L0 identity / L1 routing / L2 contracts / L3 reference / L4 artifacts --
no room on disk has an L3 `references/` folder; see SEED-076's audit). Use the gap-close as
the occasion to actually build the claimed layers, not just add sections:

- **L0 (identity) -- unchanged.** `ROOM.md` already holds this well (10 lines, static).
- **L1 (routing/always-visible) -- Notion item 1 lands here.** A `STATEMENT` field
  (frontmatter or a tiny `STATEMENT.md`) per section: the one sentence that's always true and
  always visible, the same job the generated `STATE.md` already does for status, now done for
  content. Item 2 (Latest Deck slot) and item 6 (self-guiding room) are the same layer,
  applied to the room root instead of a section: a stable, always-current pointer a stranger
  reads first.
- **L2 (contract, the control point) -- SEED-076's core finding lands here.** The missing
  per-section `CONTEXT.md`: what this section reads, does, writes, and what a human checks.
  Populate the Human-check field with the Feynman-Minto dual-test SEED-075's Theo grounding
  found ("can a stranger restate the `governing_thought` in one sentence" + "does the apex
  claim sit on MECE-grouped, non-overlapping support"), not a generic placeholder. The PWS
  22-task workbook's per-task shape (`goal`/`why_it_matters`/`steps`/`deliverable_checklist`)
  is the concrete template to adapt, mapped many-to-one onto whichever section set is chosen
  (a section may correspond to several workbook tasks, not one).
- **L3 (reference/factory) -- genuinely new, not currently real anywhere in a room.** A real
  `references/` or `_shared/` folder per room: which taxonomy governs this venture (see open
  question below), brand/voice if any, the section schema itself. Today this layer is
  claimed at the fleet root (`MindrianRooms/CLAUDE.md`) and nowhere else.
- **L4 (artifacts) -- mostly already real,** just needs SEED-076's drift fixed (5 of 12
  `launchpad-02` sections currently inline real content into `ROOM.md` instead of dated
  entry files here).

**The section-set changes themselves (Notion items 3, 4, 5)** -- `marketing-sales/` split
from `market-analysis/`, `funding/` promoted to a real first-class section, `value-proposition/`
as its own top-level section -- are the L4/L0 consequence of doing the layering work
properly, not a separate ask. Do them as part of the same pass, not before or after it.

## Open question this seed surfaces, does not resolve

Which taxonomy governs the L3 reference layer's "what stage is this venture" fact? Found
live tonight, three vocabularies coexist for what is nominally the same progression:

1. Brain's `InnovationStage` nodes: Discovery / Focus / Proof / Creation / Launch Zone
2. The PWS 22-task workbook: Un-Defined / Ill-Defined / Wicked / Well-Defined / Combining Tools
3. `venture_stage` strings actually written into rooms today (`INDEX.md`): "Investment",
   "Pre-Opportunity", "Discovery", "Validation", "Design", "QA" -- a fourth, looser vocabulary

Building the L3 reference layer without resolving which of these is canonical (or whether
they're legitimately different axes -- problem-type ladder vs. venture-progress zone vs.
ad-hoc status word) bakes ambiguity into every future room. Scope this as the FIRST slice if
this seed is picked up, before any section-schema work, per this repo's own MVP-first
discipline (smallest thing that answers one real question first).

## What NOT to steal / re-propose (Canon Part 7, checked not assumed)

- `lib/core/room-skeleton-scaffold.cjs` and `lib/core/section-registry.cjs` already implement
  schema-driven section scaffolding. This seed EXTENDS their schema (more layers, more
  sections, a contract field), it does not propose replacing the mechanism.
- Item 6 ("self-guiding room") already has a real analog in `/mos:onboard` and session-start
  nudges for the CLI/Larry path; the gap is specifically the *foreign-host-without-tools*
  case (same class already named and partially fixed for skills this session via the
  `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?}}` fail-closed wrapper).
- Phase 270's OQ-7 already surfaced items 4 and the `team-execution`/Mentor-Profiles
  within-section gap independently -- this seed is the wider frame those two sit inside, not
  a duplicate of either.

## A pattern worth naming while filing this: seed-id collisions keep recurring

Filing this required checking for a free id first -- found `SEED-075` and `SEED-076` each
collided a second time TONIGHT (both already resolved in this session's own commits), and a
THIRD, previously undocumented collision at `SEED-020` (`regulation-layer-larry-as-connector.md`
vs. `shape-f-is-the-universal-mindrian-ui.md`, neither yet in the INDEX's "Collision
resolution" log). Two prior collisions (`SEED-003`, `SEED-054`) were already documented and
resolved by hand. Four occurrences of the same failure class, concentrated on nights with
concurrent sessions, is itself a pattern (see this repo's own already-resolved
`.planning/debug/resolved/registry-active-room-concurrent-session-collision.md` for the
analogous, already-fixed failure in the room registry -- same root cause shape, different
subsystem, worth reusing the fix pattern rather than re-deriving one). Not this seed's job to
fix; named here so a future session doesn't rediscover it as new. `SEED-020`'s collision is
UNRESOLVED as of this writing -- worth a INDEX.md entry independent of this seed.

## Cross-references

- SEED-076 (`room-walk-test-and-pattern-confirmation-threshold.md`) -- the live audit this
  seed's L2 contract-layer proposal answers.
- SEED-075 (`icm-semantic-substrate-provenance-dependency-graph.md`) -- the Feynman-Minto
  grounding this seed's L2 Human-check content reuses, and the stage-taxonomy discrepancy
  this seed's open question restates precisely.
- `PROJECT.md` "Notion Template Gap Close (Captured 2026-04-14)" -- the six-item source list.
- `ROADMAP.md` OQ-7 -- the two items (funding-as-section, team-execution schema thinness)
  already independently surfaced there; this seed does not duplicate, it frames.
- `TODO.md:173` -- the parked pointer that led back to PROJECT.md.
- `icm-architect` skill (`~/.claude/skills/icm-architect/references/core.md` five-layer
  hierarchy; `references/forms.md` Knowledge-bundle layered-loading pattern) -- the
  organizing principle this seed applies.
- `MindrianRooms/CLAUDE.md` -- the root file already claiming L0-L4 that this seed proposes
  actually implementing per-room.
- `.planning/debug/resolved/registry-active-room-concurrent-session-collision.md` -- the
  analogous, already-fixed concurrent-session failure class named above.

## ADDENDUM 2026-09-02 -- Taxonomy question RESOLVED (gate 1 of 2)

**The ruling.** These are three distinct axes, not three versions of one taxonomy. Each answers
a different question and owns a different ICM layer: the problem-type ladder (UDP/IDP/WDP +
Wicked escalation) answers "what KIND of problem is on the table" and is an L1 ROUTING concern,
canonical wherever routing already happens in shared plugin code (`problem-type-router.cjs`,
Shape F, Larry's silent classification) -- it does NOT belong in a room's L3 reference layer.
`venture_stage` (Pre-Opportunity/Discovery/Validation/Design/Investment/QA) answers "how far
along is THIS venture" and is an L0 IDENTITY concern -- the room's current value stays at L0
(`STATE.md`, unchanged), but the axis's SCHEMA (the allowed values, what each means, and the
`stage_relevance` mapping already hardcoded in `lib/core/room-skeleton-scaffold.cjs`) is the
one piece that belongs in L3, because a schema is a stable factory recipe even though a
per-room value is not. Brain `InnovationStage` answers "where in the Brain's own teaching
curriculum does a methodology sit" and has zero runtime consumers anywhere in this repo today
-- it is out of scope for Phase 275's room-side L3 file entirely, unless a later phase
deliberately wires Brain curriculum position into a room. Concretely: Phase 275's L3
`references/` file should contain the `venture_stage` axis SCHEMA (promoted out of the
hardcoded `SECTION_METADATA` object into a documented, room-visible file), not a copy of the
room's current stage value and not the problem-type ladder.

**The grounding.**

- *langtalks-graph-expert*: CONSULT UNAVAILABLE -- no `mcp__langtalks-graph-expert__*` tool was
  present in the execution session (not a "not in the corpus" result; the server itself was
  unreachable). Recorded honestly rather than fabricated; the two questions this consult would
  have asked are preserved in the trail for a future session to actually run.
- *icm-architect L3 doctrine* (`~/.claude/skills/icm-architect/references/core.md`): the L3 row
  answers "What rules apply?", role "factory (stable)"; "L3 = the recipe... L4 = the
  ingredients and the dish"; "reference material... kept structurally separate from working
  artifacts, because they ask different things of the model." A per-room stage VALUE is working
  state (L0), not a stable recipe (L3); the axis SCHEMA is the recipe.
- *File:line anchors*: problem-type ladder is wired into
  `lib/core/problem-type-router.cjs:14-16,48,88,115,145-289`,
  `lib/workflow/f-selector-ranker.cjs:51,418-451`, `lib/core/persona-taxonomy.cjs:120-133`,
  `lib/brain/chain-recommender.cjs:72,182-214`, `lib/mcp/larry-server-instructions.md:50-77`.
  `venture_stage` is wired into `templates/room-skeleton/STATE.md.tmpl:6`,
  `scripts/room-registry:9,160,264,303,432`, `scripts/analyze-room:59,63-64,115,581-631`,
  `scripts/update-icm-index:96`, and critically `lib/core/room-skeleton-scaffold.cjs:48-56,378`
  (`SECTION_METADATA`'s `stage_relevance` -- the exact mechanism Phase 275 would extend). Brain
  `InnovationStage` appears only in `data/brain-census.generated.json:2358`,
  `docs/BRAIN-GRAPH-CENSUS.generated.md:88` (5 nodes), and schema docs -- zero hits under
  `lib/` or `scripts/`. The disconfirming test (grep for any consumer that reads one vocabulary
  and derives/writes the other) found no cross-derivation anywhere; the hypothesis stands
  confirmed.

**The two discrepancies settled.** (a) SEED-084's ladder listing ("Un-Defined / Ill-Defined /
Wicked / Well-Defined / Combining Tools") does not match any artifact in this repo. The shipped
code is a closed three-value enum (UDP/IDP/WDP) with Wicked as a `wicked_score >= 8`
score-triggered escalation, not a co-equal fourth value; Larry's own prompt orders it Un-Defined
/ Ill-Defined / Well-Defined / Wicked (Wicked last, matching the escalation semantics). (b)
"Combining Tools" and "22-task" have zero hits anywhere in this repo -- that material is
external PWS/MindrianV2 workbook provenance, not a repo asset, and appears to have bled into
SEED-084's listing by conflation rather than reflecting a real fifth ladder value here.

**The Theo answer.** Analog found, not "no analog." `/home/jsagi/Theo/notes/knowledge-graph.md`
("Layer 2: Domain ontology") states problem types are cross-cutting vocabulary that neither the
Journey-Phase progression tree nor the Tool-Type tree owns -- an explicit "poly-hierarchy: two
real trees, not one tree with looser cross-links pretending to be a second dimension." Theo's
`graph-rulebook.md` goes further: it added a dedicated `ADDRESSES` edge
(`(:Phase)-[:ADDRESSES]->(:DomainConcept)`) specifically so problem-type and phase/stage never
collapse into one label, rejecting a merge onto the existing `INSTANCE_OF` edge on measurement
("a Phase is not an instance of a problem type"). Same question, different graph, same
structural answer: stage/progression and problem-type are separate axes, kept as separate
structure, never merged.

**What would overturn this ruling.** A real code path that reads `venture_stage` to set or
classify `problem_type` (or vice versa) -- searched for, not found, but Phase 275's own build
work could still surface one. A runtime consumer of Brain `InnovationStage` appearing in `lib/`
or `scripts/` (currently zero) -- if a future phase pipes Brain curriculum position into a room,
that axis needs its own placement decided. A live langtalks-graph-expert consult, once the MCP
server is reachable, returning content that contradicts the layered-versus-merged framing above
-- the one grounding leg this ruling could not obtain live.

**Research trail.** Full consults, census tables, and reasoning:
`rethinking-mindrianos/research/2026-09-02-venture-stage-taxonomy-axes-ruling-275/`, mirrored to
`mindrianOS/research/2026-09-02-venture-stage-taxonomy-axes-ruling-275/`.

**Follow-up, same day.** The langtalks-graph-expert gap above was closed later the same session
(the orchestrating session had the tool the quick task's own executor lacked). Live
`query_relationship` calls on all three preserved questions returned an honest `edges: []` on
each -- topically adjacent corpus material (two real agent-memory/context-engineering sources)
but zero formed relationships answering any of the three questions as posed. Per the tool's own
contract this is "not in the corpus yet," not a contradiction and not a corroboration; it does
not change the ruling above. Full detail appended to the research trail's own
"Update 2026-09-02 (follow-up)" section. With this leg run, the ruling is FULLY closed rather
than provisionally closed -- the "what would overturn this" list above still stands as the
standing re-open condition, minus the langtalks item, which is now discharged.
