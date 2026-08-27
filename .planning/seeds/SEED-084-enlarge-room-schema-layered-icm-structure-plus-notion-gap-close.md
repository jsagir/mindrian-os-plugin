---
seed: enlarge-room-schema-layered-icm-structure-plus-notion-gap-close
canon_parts: [7, 9]
status: proposed
created: 2026-08-28
source: rethinking-mindrianos/research/2026-08-27-icm-semantic-substrate/ (addendum), SEED-075, SEED-076, PROJECT.md "Notion Template Gap Close"
gated_on: none required to design; building is gated on resolving the taxonomy question this seed itself surfaces (see "Open question" below) and on Phase 270's OQ-7 (already surfaces item 4/6 independently)
---

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
