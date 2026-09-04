---
seed: enlarge-room-schema-layered-icm-structure-plus-notion-gap-close
canon_parts: [7, 9]
status: promoted
promoted_to_phase: 275
promoted: 2026-08-31
created: 2026-08-28
source: rethinking-mindrianos/research/2026-08-27-icm-semantic-substrate/ (addendum), SEED-075, SEED-076, PROJECT.md "Notion Template Gap Close"
gated_on: "gate 1 (taxonomy question this seed itself surfaces, see 'Open question' below) RESOLVED 2026-09-02, see '## ADDENDUM 2026-09-02' below; gate 2 (Phase 270's OQ-7) FULLY RESOLVED 2026-09-04, see '## RULING 2026-09-04' below. BOTH GATES CLEAR -- /gsd-plan-phase 275 is unblocked."
mandatory_consult: "langtalks-graph-expert, continuously, every stage of Phase 275's lifecycle (navigator ruling 2026-08-31) -- in addition to the standing icm-architect consult, not instead of it"
---

**PROMOTED to Phase 275** (`.planning/ROADMAP.md`, 2026-08-31). This seed file stays as the full-detail source; the ROADMAP.md phase entry is the numbered, discoverable pointer. **Both gates now clear** (see `gated_on` above) - gate 1 (taxonomy question) cleared 2026-09-02, `## ADDENDUM 2026-09-02`; gate 2 (Phase 270's OQ-7) cleared 2026-09-04, `## RULING 2026-09-04`. `/gsd-plan-phase 275` can run.

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

## ADDENDUM 2026-09-04 -- Gate 2 (Phase 270's OQ-7) partially resolved: the schema half is
## CLOSED, the section-adoption half is a recommendation pending navigator sign-off

**Trigger.** Navigator, mid-conversation on the roadmap-by-job artifact, raised a concrete point
about the L3 design this seed proposes: different room sections/sub-folders need different
applicable frameworks than others, not one shared global list. Checked against the standing
`icm-architect` consult (mandatory for this seed) and this repo's own live code -- the point is
correct, and better than that: it is not a new proposal, it is an EXISTING mechanism that this
seed's own L3 layer already implies promoting but never named by name.

**The finding.** `SECTION_METADATA` (`lib/core/room-skeleton-scaffold.cjs:47-55`) already carries
a `default_methodologies` array per section, structurally identical in kind to the
`stage_relevance` array the 2026-09-02 addendum above already ruled belongs in L3 as a promoted
SCHEMA:

```
'problem-definition': { purpose: ..., stage_relevance: [...], default_methodologies: ['domain-explorer', 'beautiful-question', 'trending-to-absurd'] },
'market-analysis':    { purpose: ..., stage_relevance: [...], default_methodologies: ['domain-explorer', 'scenario-analysis'] },
... (8 sections total, matching `SECTION_NAMES` 1:1 -- no drift between the two tables)
```

By the IDENTICAL reasoning the 2026-09-02 ruling already applied to `stage_relevance` (icm-architect
L3 doctrine: "L3 = the recipe... kept structurally separate from working artifacts, because they
ask different things of the model" -- a schema is a stable factory recipe even though a per-room
value is not), `default_methodologies` is the SAME kind of L3 fact and should be promoted in the
SAME pass, into the SAME `references/` file, not as a second separate effort.

**A second layer of the same schema, at a coarser grain.** `data/room-blueprints.json` (8 persona
blueprint families -- exploration / solution-first / problem-first / business-first / portfolio /
venture / program / case-study) carries its OWN `default_methodologies` array per FAMILY, checked
for shape (non-empty array) by `scripts/check-room-blueprints.cjs:176-178` and consumed at room
birth by `resolveBlueprintFamily` (`room-skeleton-scaffold.cjs:255-257`, `defaultMethodologies:
family.default_methodologies`). Phase 275's L3 file needs to model BOTH grains explicitly --
family-level defaults (picked once, at birth) and section-level defaults (static per section
name) -- and state which wins when they name different methodologies for the same section,
which today is undocumented (the family value is written to `ROOM.md` frontmatter at scaffold
time per `room-skeleton-scaffold.cjs:367-372`; the section-level value from `SECTION_METADATA`
is a separate, colliding source of truth for the same fact, and nothing today reconciles them).

**A real defect, found by doing this grounding, not invented for it.** Cross-checked all 10
distinct `default_methodologies` slugs across `SECTION_METADATA` against the live command
registry (`data/command-registry.json`'s `commands[].command` field, the same registry
`lib/workflow/command-resolver.cjs` reads and `chain_resolve`/`chain_run` index against). 8 of
10 are live, correctly wired `/mos:` commands with real `frameworks` arrays (`beautiful-question`
-> Beautiful Question Framework; `think-hats` -> Six Thinking Hats; `structure-argument` -> The
Pyramid Principle / MECE; `challenge-assumptions` -> Red Teaming; `find-bottlenecks` -> Reverse
Salient Analysis; `analyze-needs` -> Jobs to Be Done; `build-thesis` -> PWS Value Proposition;
`trending-to-absurd` -> S-Curve Analysis). **Two are dead: `domain-explorer` (cited by
`problem-definition` and `market-analysis`) and `scenario-analysis` (cited by `market-analysis`
and `business-model`) match ZERO command in the live registry** -- no `/mos:domain-explorer` or
`/mos:scenario-analysis` command exists (the closest live analogs are `/mos:explore-domains` and
`/mos:scenario-plan`, differently named). This is the exact propagation-gap shape Phase 273's
reviewer named and Phase 276 consolidated: a rename happened somewhere upstream and the
hardcoded `SECTION_METADATA` literal was never carried forward. Promoting this table to a
visible L3 file is the forcing function that catches this -- it cannot ship a stale reference a
human can read and immediately falsify. Fixing the 2 dead slugs is now IN SCOPE for Phase 275's
L3 work, not a separate follow-up (same-phase fix, per this seed's own "do the layering work
properly, not before or after it" framing for the section-set changes above).

**langtalks-graph-expert consult (mandatory, per this seed's own frontmatter, run this session).**
Server reachable (`graph_stats`: 9,260 nodes / 21,492 edges, last modified 2026-08-27). Asked
directly: "should different sections/task-types route to different tool/framework subsets rather
than one shared global toolset, and is there a pattern for declaring that mapping as stable
schema data separate from working state." Result: **honest `edges: []`** -- a BFS traversal
surfaced 531 topically-adjacent nodes (heavily from the ingested `icm-architect` methodology notes
themselves -- `Task`, `Sections`, `reference`, `schema`, `stable`, `Framework`, `_shared`,
`configuration`, `System map`, `Context map`) but zero FORMED, typed relationship edges connecting
any of them to answer either half of the question. Per the tool's own contract this is "not in
the corpus yet," not a contradiction of the ruling above and not corroboration either -- recorded
honestly, exactly as the 2026-09-02 addendum recorded its own unreachable leg, rather than
papered over. The corpus's own strongest signal here is indirect: it already ingested
`icm-architect`'s own five-layer doctrine as source material, which is the SAME doctrine already
grounding this ruling directly -- a second read of the same primary source, not independent
corroboration.

**What this addendum RESOLVES vs. what it still leaves open.**

- RESOLVED: the SCHEMA half of OQ-7's within-section gap. Both `stage_relevance` (2026-09-02) and
  `default_methodologies` (today), at both the section grain (`SECTION_METADATA`) and the family
  grain (`room-blueprints.json`), are L3 facts, promote together, and the 2 dead-slug citations
  get fixed in the same pass. This part is settled and does not need further navigator sign-off
  to plan against -- it is a direct application of an already-ruled principle plus a verified bug.
- STILL OPEN, navigator sign-off needed before `/gsd-plan-phase 275`: OQ-7's OTHER sub-point --
  which candidate sections actually get adopted into `SECTION_NAMES` (today frozen at exactly 8:
  `problem-definition`, `market-analysis`, `solution-design`, `business-model`,
  `competitive-analysis`, `team-execution`, `legal-ip`, `financial-model` -- confirmed identical
  to `SECTION_METADATA`'s 8 keys, no drift there), and the `team-execution` Mentor-Profiles
  schema thickening. This changes what every future room gets scaffolded with -- a
  Tri-Context-Gate-weight decision (Canon Part 3), not a technical grounding question this
  addendum can settle unilaterally.

## ADDENDUM 2026-09-04b -- cross-source verdict on section adoption (Brain + Theo + code),
## navigator flagged a SIXTH candidate not in the original Notion-diff list

**The sixth candidate: `opportunity-bank`.** Not one of SEED-084's original 5 Notion-diff items
(that diff predates the feature). Grounded across all three sources this seed's frontmatter
mandates consulting:

- **Code (highest-confidence leg, direct citation):** `opportunity-bank` is NOT in the frozen
  `SECTION_NAMES` table (`room-skeleton-scaffold.cjs:36-44`) and is explicitly special-cased with
  `// (e.g. "opportunity-bank" is not a scaffold section; skip it silently)` at line 240 --
  a KNOWN, DELIBERATE exclusion, not an oversight. Yet it is used as a real section in 5 of 8
  blueprint families in `data/room-blueprints.json` (lines 9, 42, 72, 110, 142), carries its own
  registered identity (`lib/core/section-registry.cjs:31`, label `OPPORTUNITY BANK`, color
  `#8B6914`), and is referenced by 9 separate commands (`opportunities.md`, `funding.md`,
  `scout.md`, `whitespace.md`, `explore-opportunity.md`, `new-project.md`, `ignite.md`,
  `trending-to-absurd.md`, `mos-reason.md`). This is more heavily load-bearing in the actual
  product surface than any of the original 5 candidates.
- **Brain/Larry:** not asked directly this round (the cross-source check ran through Theo next
  once the code grounding made the candidate obvious).
- **Theo (`mcp__theo__search`, query "opportunity bank"):** top hit, score 2.38 (highest of any
  query run this session), book chapter `growth`, section CONCEPT, VERBATIM: *"Go back to the
  ladder from Week 1: Un-Defined, explore for opportunities... Ill-Defined, **build a bank of
  opportunities**... Well-Defined, solve it..."* -- the book's own canon names "build a bank of
  opportunities" as the DEFINING ACTION of the Ill-Defined rung of the core PWS taxonomy ladder
  itself, not a downstream business topic. This is the single strongest piece of grounding found
  for ANY candidate section, original-5 or otherwise.
- **A gap Theo surfaced in the same breath:** `mcp__theo__command_neighborhood` on
  `/mos:opportunities` returns `frameworks: []` -- the command carrying all of the above weight
  has ZERO resolved framework in Theo's graph. Worth a named follow-up independent of Phase 275
  (a Theo-side framework-resolution gap, out of this repo's scope per the R20 two-engine
  boundary already ruled in `CLAUDE.md`), not something this phase fixes.

**The two original candidates re-checked against Theo, one weakens:**

- **`value-proposition` -- DOWNGRADE from the earlier draft recommendation.** Theo's book has no
  standalone "value proposition" chapter; `mcp__theo__search "value proposition"` returns results
  dominated by chapter `bmd` (business model design -- Lean Canvas, Mullins' Seven Domains, the
  Business Model Canvas -- framed as "four tools" answering one business-model question
  together, `bmd`/FRAMEWORK, score 4.04), not a distinct value-proposition chapter.
  `mcp__theo__command_neighborhood("/mos:value-proposition")` returns ZERO ROWS -- not a command
  Theo's synced registry carries at all. The earlier Brain/Larry hit (PWS Value Proposition
  Parts 1-3, teaching-transcript corpus) is real but reads as older teaching material not yet
  reconciled with the book's own chapter structure -- a discrepancy worth naming, not resolving
  here. Revised call: treat as sub-structure inside `business-model`, matching the CURRENT
  scheme, not a new top-level section.
- **`funding` -- weaker under Theo too, but for a different reason.** `mcp__theo__search
  "funding investment"` surfaces `growth` (Three Horizons / Now-New-Next), not a distinct
  funding chapter. No book-canon hit. Its case rests entirely on the code/audit leg (a confirmed
  empty `funding/` shell in `launchpad-02` today, three independent sources per the original
  seed) -- real, but a product-audit case, not a "the book says so" case the way opportunity-bank
  now has both.

**Revised recommendation (supersedes the 2026-09-04 draft above):** promote `opportunity-bank`
into `SECTION_NAMES` first -- it now clears every lens (code usage, product surface, AND book
canon) at the highest confidence level of anything checked this session. `funding` stays a
secondary, evidence-backed candidate on the code/audit leg alone. `value-proposition` moves OFF
the "add as new section" list, onto "keep as sub-structure inside business-model, revisit only
if a future session reconciles the teaching-transcript/book-canon discrepancy above."
`marketing-sales`, `meetings`, `research-documents` remain unstudied by this pass (no source
consulted them yet) -- still open, not rejected, just not yet looked at with this rigor.

Actual adoption is still the navigator's Decision Gate, not this addendum's to settle
unilaterally -- this section updates the EVIDENCE the gate is decided against, not the decision
itself.

## ADDENDUM 2026-09-04c -- the remaining 3 candidates checked with the same rigor
## (navigator asked for all 6, not a partial pass)

`meetings`, `marketing-sales`, and `research-documents` -- the three of the original Notion-diff
five not yet checked against Theo -- run now, same two searches each (code grounding first,
then `mcp__theo__search`), same honesty standard (a generic/tangential top hit is reported as
such, not stretched into support).

- **`meetings` -- NOT A GAP. Already resolved, just resolved differently than the diff assumed.**
  `lib/core/section-registry.cjs:39`: `const STRUCTURAL_DIRS = ['meetings', 'team'];`, and line 83
  actively EXCLUDES it from section discovery: `if (STRUCTURAL_DIRS.includes(name)) continue;`.
  This is a deliberate, already-made architectural call, not an oversight -- `meetings/` is a
  real, heavily-used top-level directory (12 commands reference it: `file-meeting.md`,
  `speakers.md`, `graph.md`, `reanalyze.md`, `vault.md`, `mos-reason.md`, `onboard.md`,
  `new-project.md`, `export.md`, `snapshot.md`, `setup.md`, `help.md`), it is simply modeled as
  STRUCTURAL (a source that feeds insight into sections) rather than a scored SECTION (a
  destination that accumulates methodology content) -- consistent with this repo's own Key
  Decision #11 ("Meetings are primary knowledge... institutional knowledge lives in
  conversations, not documents," `.claude/includes/decisions.md`). `mcp__theo__search
  "meetings institutional knowledge conversations"` returned no on-topic hit (top result:
  `diffusion`/CASE, a 1920s hybrid-seed-corn adoption story -- generic semantic proximity, not
  canon backing). Net: the Notion diff's FRAMING (meetings as a section) doesn't match what was
  actually built (meetings as a structural dir), but that mismatch is not itself a defect to fix
  -- someone already made this call. No action item beyond naming it.
- **`marketing-sales` -- no evidence, either direction.** Zero hits anywhere in
  `data/room-blueprints.json`, `section-registry.cjs`, or `commands/` (grep across all three
  returned nothing). `mcp__theo__search "marketing sales"` top hit: `diffusion`/HOOK ("who's able
  to say yes to it, and what would saying yes cost them") -- topically adjacent at best, not a
  marketing-and-sales canon chapter. Weakest case of all six candidates: genuinely unbuilt, no
  product usage, no book backing.
- **`research-documents` -- no evidence, either direction.** Same zero-hit result across all
  three code sources. `mcp__theo__search "research documents citations sources"` top hit:
  `ch01`/FRAMEWORK (the five-tools-are-one-sequence framing) -- not on-topic. Weakest case,
  tied with `marketing-sales`.

**Complete cross-source verdict, all 6 candidates, ranked:**

| Candidate | Code/product signal | Theo (book canon) | Verdict |
|---|---|---|---|
| `opportunity-bank` | 5/8 blueprint families, 9 commands, own color/label, deliberately excluded from schema | Verbatim hit -- defines the Ill-Defined taxonomy rung | **Promote** -- strongest case of all six |
| `funding` | Confirmed empty shell in `launchpad-02`, 3 independent sources | No distinct chapter | Secondary -- audit case only |
| `value-proposition` | No command in Theo's registry | No standalone chapter; folded into `bmd` | Downgrade -- sub-structure of `business-model` |
| `meetings` | Already built, deliberately structural (12 commands), not a scored section | No canon hit | Not a gap -- already resolved differently than the diff assumed |
| `marketing-sales` | Zero hits anywhere | No canon hit | No evidence either way -- weakest |
| `research-documents` | Zero hits anywhere | No canon hit | No evidence either way -- weakest |

This is the full picture the navigator's Decision Gate on section adoption is decided against.
Still not this addendum's call to make unilaterally.

## RULING 2026-09-04 -- OQ-7 fully resolved, Phase 275 cleared to plan

**Navigator decision:** adopt `opportunity-bank` AND `funding` into `SECTION_NAMES`.
`value-proposition` stays sub-structure inside `business-model`. `meetings` needs no change
(already correctly modeled as structural, not a section). `marketing-sales` and
`research-documents` are deferred -- no evidence either direction, revisit if a future session
surfaces a real signal for either.

**Both gates of Phase 270's OQ-7 are now closed:**
1. Schema half (2026-09-04, `## ADDENDUM 2026-09-04`): `default_methodologies` promotes to L3
   alongside `stage_relevance`, at both the section and family grain; the 2 dead-slug citations
   (`domain-explorer`, `scenario-analysis`) get fixed in the same pass.
2. Section-adoption half (2026-09-04c, this ruling): `opportunity-bank` + `funding` join
   `SECTION_NAMES`.

**What this ruling does NOT do:** it does not edit `SECTION_NAMES` / `SECTION_METADATA` /
`data/room-blueprints.json` / `section-registry.cjs` directly. Those tables carry their own
explicit `// FROZEN TABLE CONTRACT: SECTION_NAMES + SECTION_METADATA are never modified` comment
(`room-skeleton-scaffold.cjs:351`) for good reason -- changing them touches the scaffold, the
blueprint-family resolver, `check-room-blueprints.cjs` validation, `test-blueprint-scaffold.cjs`,
every `ROOM.md` template, and needs a migration story for rooms already using `opportunity-bank`
as a non-frozen slug today. That is Phase 275's actual planned execution work, not a drive-by
edit from a ruling session. This ruling clears the BLOCKER (OQ-7); it does not substitute for
the phase.

**Next step:** `/gsd-plan-phase 275` is now unblocked and can run.

## ADDENDUM 2026-09-04d -- navigator's per-section value-proposition idea: real insight,
## wrong name (Larry challenge, run against the Brain)

**The idea, as raised:** instead of a `value-proposition` SECTION (rejected above) or folding it
silently into `business-model` (the prior default), give EVERY section its own one-line value
proposition -- what value does THIS section's content deliver -- as part of that section's L1
`STATEMENT`.

**Larry challenge run against the Brain** (`brain_ask`, devil's-advocate framing: real insight or
category error?). Five grounded chunks came back, and every one of them, without exception,
treats "Value Proposition" as the SAME thing: the third leg of PWS's own **Triple Validation**
sequence -- *Is it Real? / Can We Win? / Is it Worth It?* -- a VENTURE-level financial and
positioning judgment, not a per-artifact organizational habit:

- PWS Lexicon: "Triple Validation (Is it Real? Can we Win? Is it Worth It?)"
- Larry Workflow's own quality checklist runs the identical three-question sequence once, per
  venture, not once per section.
- PWS Investment mode, Larry's own signature lines: *"That's a feature, not a moat. What happens
  when someone copies it?"* / *"I like the vision. Now show me the math."*
- Larry's own words, direct transcript quote (Slide 6, "Value Proposition in a Small Market"):
  *"You don't buy something because the value proposition isn't powerful enough to get you to
  part with what you have -- your time, money... think in a small market for whom this is a
  really powerful idea."* -- about venture positioning and focus, not section-level content.

**The reframe.** The underlying instinct is real and good -- every section SHOULD have to justify
why it matters, in one visible sentence. That is not a new idea this addendum needs to invent:
it is EXACTLY SEED-084's own already-proposed L1 `STATEMENT` field (see "The proposal" section
above), just described from a different angle. But naming that field "value proposition" would
be Larry's own move against himself: *"that's not a problem -- that's a category [error]."*
"Value Proposition" is a specific, loaded PWS term already owning one specific job (the Triple
Validation's third gate, venture-level, financial/positioning). Reusing it for a different job
(section-level rationale) is the SAME class of collision this seed already caught and fixed once
this session (`venture_stage` vs. the problem-type ladder, `## ADDENDUM 2026-09-02`) and the
same class SEED-084's own "seed-id collisions keep recurring" section already names as a
standing pattern in this repo. Checked `lib/core/frontmatter-schemas.cjs`: no `value_proposition`
field exists yet, so nothing has actually collided -- this is a preventive catch, not a
retroactive fix.

**Ruling:** keep the per-section idea, drop the name. The L1 `STATEMENT` field (already planned)
IS where "why does this section matter" lives; do not additionally introduce a per-section
`value_proposition` field carrying the same job under the reserved PWS term. Reserve "Value
Proposition" for the one venture-level Triple-Validation gate `business-model` already owns.
This is a naming/scope clarification to Phase 275's existing L1 design, not a new task.

## ADDENDUM 2026-09-04e -- full 113-command sweep, tiered by section relevancy (L3 reference
## material), and a correction to ADDENDUM 2026-09-04's dead-slug count

**Method.** Not eyeballed. Parsed `data/command-registry.json` (113 commands) programmatically:
bucketed every command by its `produces` field (`room/<section>/...` = exact-section ground
truth; `room/**/...` or `room/*/...` = cross-section wildcard; no `room/` prefix = infrastructure,
no section affinity), then cross-checked every `SECTION_METADATA.default_methodologies` entry
against the command it actually names, to see whether the claimed command (a) exists, (b) writes
to the section that claims it.

**Correction to `## ADDENDUM 2026-09-04`: the dead-slug count was itself incomplete.** Re-run
precisely, the real picture is worse by two findings, not the two dead slugs originally reported:

| Section | Claims | Actual |
|---|---|---|
| `problem-definition` | `domain-explorer` | DEAD (no such command) |
| `problem-definition` | `trending-to-absurd` | **LIVE but MISFILED** -- actually produces to `room/opportunity-bank/trending-to-absurd/*`, not `problem-definition` |
| `market-analysis` | `domain-explorer` | DEAD (2nd citation) |
| `market-analysis` | `scenario-analysis` | DEAD |
| `business-model` | `scenario-analysis` | DEAD (2nd citation) |
| `financial-model` | `scenario-analysis` | DEAD (3rd citation -- the original addendum missed this one entirely) |
| `team-execution` | `analyze-needs` | **LIVE but MISFILED** -- actually produces to `room/market-analysis/jtbd-analysis/*`, not `team-execution` |

So: 2 unique dead slugs across 5 citations (not 2 citations), spanning 4 sections, PLUS 2
additional live-command citations pointing at the wrong section entirely -- a class of error the
original sweep's methodology (checking existence against the registry) could not catch, only a
produces-path cross-check could. The live replacement for dead `scenario-analysis` is
`/mos:scenario-plan` (same framework, Scenario Planning, renamed at some point without the
`SECTION_METADATA` literal following). All 7 rows are in scope for the same L3 promotion pass
Phase 275 already owns -- fix the citations, not just delete the dead ones.

**The full tiering, all 113 commands, 10 sections (8 canonical + `opportunity-bank` +
`funding`):**

**Tier 1 -- ground truth (the command's own `produces` path names this section, or
`SECTION_METADATA` already claims it correctly):**

| Section | Tier 1 commands |
|---|---|
| `problem-definition` | `/mos:beautiful-question`, `/mos:diagnose`, `/mos:explore-domains` |
| `market-analysis` | `/mos:analyze-needs`, `/mos:user-needs` |
| `solution-design` | `/mos:bono` |
| `business-model` | `/mos:lean-canvas`, `/mos:validate-proposition` |
| `competitive-analysis` | `/mos:compare-ventures` |
| `team-execution` | `/mos:leadership` |
| `legal-ip` | *(none -- a real, separate gap: zero commands produce directly here today)* |
| `financial-model` | *(none direct -- relies entirely on the wildcard `/mos:build-thesis`)* |
| `opportunity-bank` | `/mos:futures`, `/mos:score-innovation`, `/mos:trending-to-absurd`, `/mos:whitespace` |
| `funding` | *(none -- confirms the empty-shell finding from the icm-architect audit at the command level too, not just the room-instance level)* |

**Tier 2 -- framework-matched, not ground truth (a wildcard command whose named framework
squarely fits the section's job; judgment call, flagged as such, not equal certainty to Tier 1):**

| Section | Tier 2 commands (framework) |
|---|---|
| `problem-definition` | `/mos:root-cause` (Root Cause Analysis), `/mos:causal` (Root Cause Analysis), `/mos:map-unknowns` (Knowns/Unknowns Matrix), `/mos:build-knowledge` (Ackoff Pyramid), `/mos:validate` (JTBD), `/mos:research` (Hypothesis-Driven Problem Solving) |
| `market-analysis` | `/mos:macro-trends` (PEST), `/mos:analyze-timing` + `/mos:diffusion` (Adoption-Capacity Theory), `/mos:explore-trends` (S-Curve), `/mos:dominant-designs` (Dominant Design), `/mos:mullins` (Mullins Model), `/mos:scenario-plan` (Scenario Planning -- the live replacement named above) |
| `solution-design` | `/mos:find-analogies` (Four Lenses of Innovation), `/mos:find-connections` (Usher's Cumulative Synthesis), `/mos:analyze-systems` + `/mos:systems-thinking` (Systems Thinking), `/mos:hat-briefing` (Six Thinking Hats), `/mos:rs-experts` / `/mos:rs-explain` / `/mos:rs-fetch` (Reverse Salient Analysis -- the moat/defensibility family named in `## ADDENDUM 2026-09-04f` below) |
| `business-model` | `/mos:explore-futures` (Scenario Planning), `/mos:mullins` (Mullins Model), `/mos:analyze-systems` (Systems Thinking) |
| `competitive-analysis` | `/mos:rs-experts` / `/mos:rs-explain` / `/mos:rs-fetch` / `/mos:rs-thesis` (Reverse Salient Analysis family) |
| `team-execution` | `/mos:hat-briefing` (Six Thinking Hats) |
| `legal-ip` | `/mos:challenge-assumptions` (Red Teaming -- risk-surfacing fits legal/IP exposure review) |
| `financial-model` | `/mos:deep-grade` / `/mos:grade` (PWS Triple Validation Compass -- the "Is It Worth It" gate) |
| `opportunity-bank` | `/mos:explore-futures` (Scenario Planning -- exploring future opportunity space) |
| `funding` | `/mos:mullins` (business case), `/mos:deep-grade` / `/mos:grade` (Triple Validation) -- the ONLY two indirect touches this section gets from anything, Tier 1 or 2 |

**Tier 3 -- universal / infrastructure, no section affinity (same pool for every section, not
worth repeating 10 times): the 63 commands with no `room/` produces path at all** (`/mos:room`,
`/mos:status`, `/mos:export`, `/mos:onboard`, `/mos:new-project`, `/mos:rooms`, `/mos:dashboard`,
`/mos:act`, `/mos:doctor`, `/mos:help`, `/mos:wiki`, `/mos:graph`, `/mos:visualize`,
`/mos:present`, `/mos:query`, `/mos:radar`, `/mos:opportunities` (the utility scan/list/file
surface, distinct from the Tier-1 methodology commands that write INTO opportunity-bank),
`/mos:funding` (same distinction), and 51 others) -- these operate ON the room as a whole
(navigation, export, admin, meta-orchestration) rather than producing section content, so they
correctly have no section-specific tier.

**One more naming mismatch, found in passing, not previously named anywhere:** `/mos:persona`
produces to `room/team/*` -- `team`, not `team-execution`. A different section slug entirely,
undocumented anywhere else this session touched. Worth a line in Phase 275's own execution
notes; not re-litigated here since it's the same propagation-gap shape already named twice this
session (D-1 in `276-16-COMPOSITING-TRAIL-STAGED.md`, and the `default_methodologies` dead
slugs above) -- a fourth instance, not a new class of finding.

**Two structural gaps this sweep surfaces on its own, beyond the tiering:** `legal-ip` and
`funding` have ZERO Tier-1 commands -- no methodology writes directly into either section today.
`financial-model` has zero DIRECT Tier-1 commands either, relying entirely on the wildcard
`/mos:build-thesis`. Worth flagging to whoever plans Phase 275: promoting `funding` to a
first-class section (this session's own ruling, `## RULING 2026-09-04`) inherits an empty
command surface, same as the room-instance emptiness the icm-architect audit already found --
the schema gap and the command-coverage gap are the same underlying absence, seen from two
angles.

## ADDENDUM 2026-09-04f -- navigator's tech-stack/moat point: a real, repeated Larry heuristic
## with no home in any section's contract today

**The point, as raised:** the tech stack matters to innovation not on its own, but through the
FEATURES it enables -- and whether those features create a moat (a defensible advantage that
survives a competitor copying the surface idea) is the real question, not "what's the
architecture."

**Checked against Theo (book canon) first, since that is the higher bar.** `mcp__theo__search
"moat"` alone: 2 weak, generic hits (Edison/reverse-salient, Rogers/diffusion-curve) -- no
dedicated "moat" chapter or framework exists in the book. `list_frameworks` (420 total,
alphabetical) has no `Moat`-named entry in what was surfaced. Conclusion: unlike
`opportunity-bank` (a verbatim book-canon hit) or Value Proposition (a real Triple-Validation
gate), "moat" is NOT a first-class chapter in Theo's canon -- it does not get the same evidence
tier.

**But it is a real, repeated Larry HEURISTIC, grounded across three separate, already-shipped
touchpoints, none of which name it explicitly as their own framework:**
1. Larry's own investment-mode voice (Brain retrieval, `pws_investment.py`): *"That's a feature,
   not a moat. What happens when someone copies it?"* -- a standing challenge question, not a
   framework with its own chapter.
2. `/mos:lean-canvas` (`commands/lean-canvas.md`, produces `room/business-model/lean-canvas/*`):
   the Lean Canvas's own "Unfair Advantage" box is the moat question in a different vocabulary --
   already shipped, already writes to `business-model`.
3. `/mos:build-thesis` (`commands/build-thesis.md`, produces `room/**/thesis/*`): the
   Ten-Questions investment gate's own `teaching` line calls its output *"a defensible go / no-go
   with reasons"* -- defensibility is already part of what this command tests, just not named
   "moat" or tied to the tech-stack decision specifically.
4. Theo's own `Sustaining vs Disruptive Innovation` framework (`framework_edges` check) feeds
   into `Changing Terms of Competition` -- competitive-dynamics language, structurally adjacent
   to the moat question, again without using the word.

**The actual gap.** None of the 8 sections' `default_methodologies`
(`lib/core/room-skeleton-scaffold.cjs:47-55`) wire a moat/defensibility check into the ONE
section that actually owns the tech-stack decision: `solution-design`
(`default_methodologies: ['structure-argument', 'think-hats']`). `competitive-analysis`
(`['challenge-assumptions', 'find-bottlenecks']`) owns differentiation but never gets asked
"does the SOLUTION's technical choices feed this." The causal chain the navigator named --
tech stack -> enabled features -> defensibility -- has no explicit cross-link between the two
sections that separately own its two halves today.

**Ruling: this is a Human-check / cross-link addition to solution-design's planned L2
`CONTEXT.md` contract, not a new section and not a new methodology.** When Phase 275 writes
`solution-design`'s L2 contract (per SEED-084's own "The proposal" -- "what this section reads,
does, writes, and what a human checks"), the Human-check field should explicitly include Larry's
own question in this repo's own MOAT-MANDATE-adjacent language: *does this technical choice
enable a feature that is hard to copy, or does it just solve the immediate problem* -- and
cross-link to `competitive-analysis` (the section that tests whether that claimed defensibility
actually holds against real competitors). This resonates with -- and should cite --
`.claude/includes/moat.md`'s own standing doctrine for THIS plugin's product itself ("Prompts
can be copied. The graph that knows WHEN to use WHICH prompt... is the moat") -- the identical
causal shape (a copyable surface + an uncopyable underlying capability) applied one level down,
to every venture a room scaffolds rather than just to this plugin.

## ADDENDUM 2026-09-04g -- a SEVENTH candidate, raised AFTER `## RULING 2026-09-04` closed:
## `strategy`, housing Scenario Planning + Reverse Salient Analysis

**This postdates the ruling above and reopens the section-adoption question by one candidate.**
The ruling stands for `opportunity-bank` + `funding`; this addendum adds a new candidate checked
with the same rigor, not folded backward into the closed ruling text.

**The proposal.** A new `strategy` section, home to the frameworks that don't map cleanly onto
any of today's 8: Scenario Planning and Reverse Salient Analysis specifically named.

**Code first, same as every other candidate: zero existing usage.** `grep` across
`section-registry.cjs`, `room-skeleton-scaffold.cjs`, and `data/room-blueprints.json` for
`strategy` returns nothing; no command produces to a `room/strategy/*` path today. Unlike
`opportunity-bank`, this is a genuinely fresh candidate, not something already de-facto built
and waiting for the schema to catch up.

**Theo, and it's a different EVIDENCE SHAPE than any candidate checked so far --
two real, separately-grounded chapters, explicitly linked to each other, neither claimed by
an existing section:**

- `Scenario Planning` -- its own chapter (`ch02b`), founding case Royal Dutch Shell's 1960s
  Group Planning department (`mcp__theo__search`, top strategy-adjacent hit, score 5.77 region).
  `framework_edges`: `ADDRESSES_PROBLEM_TYPE` -> `UnDefined`, `IllDefined`, AND `Wicked` (three
  of four problem types -- a broadly-applicable tool, not narrow to one section's job).
- `Reverse Salient Analysis` -- its own chapter (`bottleneck`/`ch07`), founding case Thomas
  Hughes' historical bottleneck theory. `framework_edges`: `ADDRESSES_PROBLEM_TYPE` ->
  `IllDefined` AND `WellDefined`; `FEEDS_INTO` -> `Adoption-Capacity Theory`,
  `Causal Loop Diagrams`, `Jobs to Be Done (JTBD)`, `PWS Value Proposition` -- a hub framework,
  richly connected downstream.
- **The graph-asserted link that makes grouping them defensible, not arbitrary:**
  `Reverse Salient Analysis --FEEDS_INTO(confidence 0.65, transform "bottleneck-to-scenario")-->
  Scenario Planning`. This is not two unrelated tools filed under a label of convenience -- the
  book's own graph already asserts one feeds the other.

**Different from `opportunity-bank`'s evidence shape, said plainly.** `opportunity-bank` was a
single verbatim hit inside ONE canon chapter defining ONE taxonomy rung -- the strongest possible
shape. `strategy` is TWO strong, separately-chaptered frameworks the book never calls "Strategy"
as a category -- the organizing label is an engineering/room-design choice (grouping two
causally-linked tools that don't fit elsewhere), not a book-canon name. Both are real; neither
should be mistaken for the other's evidence tier.

**This directly resolves two things the command sweep (`## ADDENDUM 2026-09-04e`) found
structurally homeless, more cleanly than "fix the citation" would have:**
- The dead `scenario-analysis` slug, duct-taped onto THREE sections (`market-analysis`,
  `business-model`, `financial-model`) that don't obviously own it -- `/mos:scenario-plan`
  (the live replacement) gets an actual proper home instead of a patched citation.
- The Reverse Salient family (`/mos:find-bottlenecks`, `/mos:rs-experts`, `/mos:rs-explain`,
  `/mos:rs-fetch`, `/mos:rs-thesis`) -- currently Tier 2 (judgment-call, framework-matched) for
  `competitive-analysis` and `solution-design`, never Tier 1 anywhere -- becomes Tier 1 for
  `strategy`.

**Recommendation:** promote `strategy` alongside `opportunity-bank` and `funding`. Evidence tier
is different in shape from `opportunity-bank` (two linked chapters vs. one verbatim rung) but not
weaker in kind -- both frameworks are real, canon-grounded, and currently homeless. Still the
navigator's call, not this addendum's to finalize unilaterally -- pending sign-off, same as the
original six.

**DECIDED 2026-09-04: adopted.** `strategy` joins `opportunity-bank` and `funding` as the three
sections Phase 275 adds. `SECTION_NAMES` grows from 8 to 11. Tier 1 for `strategy`:
`/mos:scenario-plan`, `/mos:find-bottlenecks`, `/mos:rs-experts`, `/mos:rs-explain`,
`/mos:rs-fetch`, `/mos:rs-thesis` -- the dead `scenario-analysis` citations (`market-analysis`,
`business-model`, `financial-model`) and the Reverse Salient Tier-2 entries (`competitive-analysis`,
`solution-design`) all retarget here in the same L3 promotion pass.

## ADDENDUM 2026-09-04i -- `funding` is NOT independent of `opportunity-bank`: it is the
## next stage of the same pipeline, and it already has real nested structure (stage + outcome)

**The pipeline relationship, confirmed verbatim in the command's own docs, not inferred.**
`commands/funding.md`'s own one-line description: *"Promote discoveries **from
opportunity-bank**, advance through stages, and monitor your funding pipeline."* `funding
create [slug]` explicitly *"Promote[s] an opportunity from opportunity-bank to the funding
pipeline"*, writes a `[[opportunity-bank/{source}]]` wikilink creating a real graph edge back to
the discovery. This is sequential pipeline structure, not two independent sections that happen
to be topically related -- `opportunity-bank` is the DISCOVERY stage, `funding` is the
ADVANCE-AND-TRACK stage of one flow. Consequence for the command tiering
(`## ADDENDUM 2026-09-04e`): `/mos:opportunities` (Tier 1 for `opportunity-bank`) should also be
recorded as `funding`'s feeder command, and each section's future L2 `CONTEXT.md` should
cross-reference the other by name (`opportunity-bank`'s contract notes it feeds `funding` via
`/mos:funding create`; `funding`'s contract notes it reads from `opportunity-bank`) -- not left
as an implicit fact only the command source carries.

**The nested structure, already real, two orthogonal dimensions:**
1. **Stage** (lifecycle position, sequential, enforced): `Discovered -> Researched -> Applying ->
   Submitted`. `funding advance` enforces the order -- "No skipping stages. No going backward."
2. **Outcome** (result, NOT a stage -- the command's own Design Note is explicit about this
   separation): `awarded` / `rejected` / `withdrawn`, settable only once a real result exists
   (`awarded`/`rejected` gated to the `Submitted` stage; `withdrawn` valid at any stage).

This is `funding`'s own sub-schema, structurally the same KIND of L3 fact as `opportunity-bank`'s
own sub-schema (Knight position -- risk/uncertainty/mixed -- plus confidence score, both already
named in `commands/opportunities.md`). Phase 275's L3 reference file should document both
sections' internal typing explicitly, the same promotion logic already ruled for
`default_methodologies` and `stage_relevance` above -- these are stable schemas currently living
only inside command prose, not a documented, room-visible reference.

**A real scope gap, found while grounding this, not invented for it: `funding` is 100%
grant-centric today.** `grep`ed `commands/funding.md` for `equity`, `venture capital`, `VC`,
`loan`, `crowdfund`, `angel` -- zero hits. Every example in the file is a grant
(`nsf-sbir-phase1`), the discovery source is Grants.gov/Simpler Grants
(`opportunities.md`'s own `scan` subcommand), and the Knight-position schema hardcodes
`risk` for grant-sourced opportunities specifically. But SEED-084's own genesis names this
candidate "**Funding Options**" (the original Notion diff's wording, `PROJECT.md`), a broader
frame than grants alone -- a for-profit venture room would reasonably expect equity/VC tracking
under a section literally named `funding`, and nothing in the current command surface provides
it. Not this addendum's call to resolve (a scope decision, not a grounding fact) -- named so
Phase 275 decides explicitly whether `funding` ships grant-scoped as-is, or the L2 contract
gets written broader than what `/mos:funding` currently implements (a documented gap between
contract and code, which the whole point of writing L2 contracts is meant to catch and prevent
next time, not repeat here on day one).

## ADDENDUM 2026-09-04j -- the actual primary source, seen directly (not re-derived from
## `PROJECT.md`'s summary of it): the 2026-04-14 Notion template, screenshotted in full

**Navigator supplied the live template** (`app.notion.com/.../Data-Room-...`), the actual
document `PROJECT.md`'s "Notion Template Gap Close" section has been summarizing at one remove
this whole time. Full nested structure, transcribed directly from the screenshots:

| Top-level section | Nested items |
|---|---|
| Problem | Problem Statement, Problem Validation, Problem Stakeholders |
| Solution and Product | Solution Statement, KPI's - Success Criteria, Feature Planning, Product Description, **Technology Stack** |
| Value Proposition | "How Do We make money" statement (identical icon and wording to Business Model's own statement, immediately below it) |
| Business Model | "How Do We make money" statement, Customer Segments, Revenue Model, Business Model Validation, Potential User Persona, Potential Payer |
| Market Analysis | Market Statement, Competitive Analysis, Market Validation, Market Research |
| Marketing & Sales | Marketing Strategies, Sales Strategies & Pipelines |
| Legal Docs | Regulatory Compliance, Incorporation docs, Contracts & Agreements, Intellectual Property |
| Financial Information | Financials, Projections, Statements, History |
| Funding Options | "...ing Options" statement, **Dilutive Funding**, **Non-Dilutive** |
| Research Documents | Documents |

**Three rulings this settles or sharpens, in order of how much it changes:**

1. **`funding`'s scope gap (`## ADDENDUM 2026-09-04i`) is now answered, not just named.** The
   template's own nested structure under Funding Options is exactly two types: **Dilutive
   Funding** (equity/VC -- gives up ownership) and **Non-Dilutive** (grants, the ONLY half
   `/mos:funding` currently implements -- 100% Grants.gov/Simpler-Grants-sourced, zero equity/VC
   support, per the grep in `## ADDENDUM 2026-09-04i`). This is not this addendum inventing a
   broader scope -- it's the primary source the whole gap-close traces back to, stating the
   scope directly. Phase 275's L2 contract for `funding` should carry BOTH types explicitly;
   the current command surface only builds one of them, a real, now-precisely-named build gap
   for whoever executes the phase (add dilutive/equity tracking, or explicitly scope Phase 275
   to non-dilutive-only and defer dilutive -- a decision, not a discovery, now that the target
   shape is known).
2. **The value-proposition ruling (`## ADDENDUM 2026-09-04d`, keep as business-model
   sub-structure, not its own section) is CORROBORATED by the primary source itself, not just by
   Theo's book structure.** In the actual template, Value Proposition's statement is word-for-
   word identical to Business Model's own statement ("How Do We make money"), and the two
   sections sit immediately adjacent with the same icon -- the template's own authors treated
   them as the same underlying question, not two independent sections. Two independent sources
   (Theo's chapter structure, and now the primary template itself) land on the same answer.
3. **The moat/tech-stack finding (`## ADDENDUM 2026-09-04f`) is corroborated too.** The template
   nests **Technology Stack** directly under "Solution and Product," as a sibling of "Feature
   Planning" -- the template's own authors already put these two right next to each other. The
   Human-check ruling (does this technical choice enable a feature that's hard to copy) sits
   exactly where the template already groups the two ideas.

**One upgrade, one downgrade, from "no evidence" to "real, just unbuilt":**
- `marketing-sales` moves off the weakest tier. The 6-candidate sweep (`## ADDENDUM 2026-09-04c`)
  found zero code and no Theo hit and called it the weakest case. The primary source shows it
  has real, specific intended content -- Marketing Strategies AND Sales Strategies & Pipelines,
  two distinct sub-areas, not a vague placeholder. Still zero code/Theo grounding today, but "no
  evidence anyone ever wanted this" is no longer accurate -- the template wanted it clearly, it
  just was never built. Worth re-raising at the actual Phase 275 planning session rather than
  leaving deferred.
- `research-documents` stays weak, now for a clearer reason: the template's own nested content
  under it is just "Documents" -- one generic file library, not a distinct methodology. Thin by
  design in the source, not under-evidenced by this session's search.

**Not changed by this:** `opportunity-bank` and `strategy` don't appear anywhere in this
template at all (both post-date it, or were never part of the original Notion gap-close scope)
-- their evidence stays exactly what `## ADDENDUM 2026-09-04g` and the code/Theo sweep already
established, independent of this primary source.
