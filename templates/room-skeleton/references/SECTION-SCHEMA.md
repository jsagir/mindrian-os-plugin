# Section Schema

This is the stable schema behind every section in this room: ICM Layer 3, the factory layer.
Read every run, edited rarely, never a destination for work product. It holds no value
belonging to this particular venture - no room name, no current stage, no chosen methodology.
This room's own current stage lives in `STATE.md` at the room root; this file only says which
values are legal and what each one means.

## 1. Three stage vocabularies, three separate axes

Three vocabularies that sound alike coexist in this system. Conflating them bakes ambiguity
into every room, so this is stated plainly, as a ruling (2026-09-02): these are three distinct
axes, not three versions of one taxonomy. Each answers a different question and owns a
different ICM layer.

| Axis | Answers | Values | ICM layer | Where it lives |
|---|---|---|---|---|
| Problem type | What KIND of problem is on the table | Un-Defined, Ill-Defined, Well-Defined, with Wicked as a score-triggered escalation rather than a co-equal fourth value | L1 routing | Shared plugin routing code, not a room file |
| Venture stage | How far along is THIS venture | the five values below | L0 identity, with its schema at L3 | The room's `STATE.md`; this file holds only the schema |
| Brain innovation stage | Where in the teaching curriculum a methodology sits | Discovery, Focus, Proof, Creation, Launch Zone | Not a room concept | The Brain's own graph; zero runtime consumers in a room today, deliberately out of scope |

The disconfirming test actually run: a search for any code path that reads one vocabulary and
derives or writes another found nothing. What would overturn this ruling: a real code path that
reads `venture_stage` to set `problem_type` or the reverse, or a runtime consumer of Brain
innovation stage appearing inside a room.

## 2. The venture_stage axis schema

The five legal values, in order, from `lib/core/model-profiles.cjs`'s `VALID_STAGES`:

| Value | What it means for the venture |
|---|---|
| Pre-Opportunity | No problem has been committed to yet. The venture is exploring a domain or interest, not yet defending a specific claim. |
| Discovery | A candidate problem is named and the venture is establishing whether it is real and who has it. |
| Validation | The problem is established; the venture is testing whether a solution and a market actually fit it. |
| Design | The solution, business model, and team are being built out in detail. |
| Investment | The venture is preparing to raise, seeking funding, or otherwise seeking external commitment on the strength of what has been built. |

A room is born at Pre-Opportunity. Progression is bidirectional: a venture can regress, and the
history is preserved rather than overwritten (this repo's Key Decision 14) - moving backward is
not an error, it is the venture correcting course with the record intact.

**Honesty note.** A sixth value, `QA`, has been observed written into room index files. It is
NOT in the code's own valid-stage list (`VALID_STAGES` above), so treat it as drift rather than
as a legal value. Do not add it to a room's `venture_stage` field on the strength of having seen
it elsewhere.

## 3. stage_relevance, per section

This says when a section is most likely to matter, not when it is forbidden. A room owner
working out of order is not making an error.

| Section | stage_relevance |
|---|---|
| problem-definition | Pre-Opportunity, Discovery |
| market-analysis | Discovery, Validation |
| solution-design | Validation, Design |
| business-model | Design, Investment |
| competitive-analysis | Discovery, Design |
| team-execution | Validation, Design |
| legal-ip | Design, Investment |
| financial-model | Design, Investment |
| opportunity-bank | Pre-Opportunity, Discovery |
| funding | Validation, Investment |
| strategy | Discovery, Design |

## 4. default_methodologies at two grains, and which one wins

This is the part that was undocumented before Phase 275, and the two grains below were a
colliding source of truth for the same fact, with nothing reconciling them. Documenting the
reconciliation rule here IS the reconciliation.

### Section grain

Static, the same for every room, transcribed from `SECTION_METADATA` in
`lib/core/room-skeleton-scaffold.cjs`:

| Section | default_methodologies (section grain) |
|---|---|
| problem-definition | explore-domains, beautiful-question, diagnose |
| market-analysis | analyze-needs, user-needs |
| solution-design | bono, structure-argument, think-hats |
| business-model | lean-canvas, validate-proposition, structure-argument |
| competitive-analysis | compare-ventures, challenge-assumptions |
| team-execution | leadership, think-hats |
| legal-ip | structure-argument, challenge-assumptions |
| financial-model | build-thesis, grade |
| opportunity-bank | trending-to-absurd, whitespace, futures |
| funding | mullins, grade |
| strategy | scenario-plan, find-bottlenecks |

### Family grain

Chosen once, at room birth, from the navigator's arrival shape, transcribed from
`data/room-blueprints.json`. All 9 blueprint families:

| Family | default_methodologies (family grain) |
|---|---|
| exploration | explore-domains, beautiful-question, map-unknowns |
| solution-first | find-analogies, user-needs, validate |
| problem-first | validate, mullins, explore-domains |
| business-first | lean-canvas, challenge-assumptions, diagnose |
| portfolio | find-connections, whitespace, explore-domains |
| venture | mva-brief, diagnose, lean-canvas |
| program | explore-domains, mullins, validate |
| case-study | diagnose, lean-canvas, find-analogies |
| hypothesis | structure-argument, challenge-assumptions, validate, research |

### The precedence rule, stated as what the code actually does

When a blueprint family is active AND its `default_methodologies` array is non-empty, the
FAMILY value is written into every section's `ROOM.md` frontmatter at scaffold time, and the
section-grain value is not used. When no family is active, or the family's array is empty, the
section-grain value from `SECTION_METADATA` is used instead.

Grounded in `lib/core/room-skeleton-scaffold.cjs`, the `familyActive && defaultMethodologies.length > 0`
ternary in the section write loop: family wins when it is both active and non-empty; the
section-grain table above is the fallback, not a second, competing source of truth.

## 5. Which commands write into which section

Three tiers, and the confidence of each is labelled honestly, because they are not equal.
Re-verified live against `data/command-registry.json` at authoring time, not transcribed from
prior notes without checking - a stale reference here is worse than no document.

### Ground truth (the command's own produces path names the section)

| Section | Ground-truth commands |
|---|---|
| problem-definition | `/mos:beautiful-question`, `/mos:diagnose`, `/mos:explore-domains` |
| market-analysis | `/mos:analyze-needs`, `/mos:user-needs` |
| solution-design | `/mos:bono` |
| business-model | `/mos:lean-canvas`, `/mos:validate-proposition` |
| competitive-analysis | `/mos:compare-ventures` |
| team-execution | `/mos:leadership` |
| legal-ip | none today - zero commands produce directly into this section |
| financial-model | none directly - relies entirely on the wildcard `/mos:build-thesis` (see Framework-matched, below) |
| opportunity-bank | `/mos:futures`, `/mos:score-innovation`, `/mos:trending-to-absurd`, `/mos:whitespace` |
| funding | none today - zero commands produce directly into this section |
| strategy | `/mos:scenario-plan`, `/mos:find-bottlenecks`, `/mos:rs-experts`, `/mos:rs-explain`, `/mos:rs-fetch`, `/mos:rs-thesis` |

`strategy`'s six commands are a deliberate, decided exception worth naming honestly: their own
`produces` field is a cross-section wildcard path (`room/**/...`), not a path that literally
names `strategy`. They are promoted to ground-truth status here by an explicit Phase 275 ruling
(SEED-084 ADDENDUM 2026-09-04g, DECIDED), because `strategy` was created specifically to be
their one proper home - Scenario Planning and Reverse Salient Analysis were previously
judgment-call matches scattered across `market-analysis`, `business-model`, `financial-model`,
`competitive-analysis`, and `solution-design`, and all of those scattered citations retarget
here in this same pass. This is a documented, deliberate promotion, not an oversight in the
ground-truth definition.

### Framework-matched (a wildcard command whose named framework fits the section's job)

A judgment call, flagged as such, not equal certainty to ground truth.

| Section | Framework-matched commands (framework) |
|---|---|
| problem-definition | `/mos:root-cause`, `/mos:causal` (Root Cause Analysis), `/mos:map-unknowns` (Knowns/Unknowns Matrix), `/mos:build-knowledge` (Ackoff Pyramid), `/mos:validate` (JTBD), `/mos:research` (Hypothesis-Driven Problem Solving) |
| market-analysis | `/mos:macro-trends` (PEST), `/mos:analyze-timing`, `/mos:diffusion` (Adoption-Capacity Theory), `/mos:explore-trends` (S-Curve), `/mos:dominant-designs` (Dominant Design), `/mos:mullins` (Mullins Model) |
| solution-design | `/mos:find-analogies` (Four Lenses of Innovation), `/mos:find-connections` (Usher's Cumulative Synthesis), `/mos:analyze-systems`, `/mos:systems-thinking` (Systems Thinking), `/mos:hat-briefing` (Six Thinking Hats) |
| business-model | `/mos:explore-futures` (Scenario Planning), `/mos:mullins` (Mullins Model), `/mos:analyze-systems` (Systems Thinking) |
| competitive-analysis | none currently - the Reverse Salient family that judgment-matched here before Phase 275 moved to `strategy` (its proper Tier-1 home) in this same pass |
| team-execution | `/mos:hat-briefing`, `/mos:think-hats` (Six Thinking Hats) |
| legal-ip | `/mos:challenge-assumptions` (Red Teaming - risk-surfacing fits legal/IP exposure review) |
| financial-model | `/mos:build-thesis`, `/mos:deep-grade`, `/mos:grade` (PWS Triple Validation Compass) |
| opportunity-bank | `/mos:explore-futures` (Scenario Planning - exploring future opportunity space) |
| funding | `/mos:mullins` (business case), `/mos:deep-grade`, `/mos:grade` (Triple Validation) - the only two indirect touches this section gets |
| strategy | none additional - this section is the definitive Tier-1 home for its two frameworks, not a secondary match for anything else |

### Room-wide infrastructure (no `room/` produces path at all)

Roughly sixty commands (62 measured live against `data/command-registry.json` at authoring
time) with no section affinity: they operate on the room as a whole (navigation, export, admin,
meta-orchestration) rather than producing section content. Same pool for every section, not
worth enumerating in full here. A handful of examples: `/mos:room`, `/mos:status`,
`/mos:export`, `/mos:onboard`, `/mos:new-project`, `/mos:rooms`, `/mos:dashboard`, `/mos:act`,
`/mos:doctor`, `/mos:help`, `/mos:wiki`, `/mos:graph`.

Two utility surfaces belong here specifically, distinguished from the methodology commands
above even though they name their sections in their own titles: `/mos:opportunities` (the
scan/list/file pipeline-management surface for `opportunity-bank`) and `/mos:funding` (the
list/create/advance/status/outcome pipeline-management surface for `funding`) are both
registered `kind: utility` with no `produces` path - they manage the pipeline, they do not
produce section content the way a methodology command does.

## 6. What changed in Phase 275, and what did not

The section set grew from 8 to 11: `opportunity-bank`, `funding`, `strategy` joined the frozen
`SECTION_NAMES` table. Five dead or misfiled command citations were corrected in this pass,
named here by their defect rather than by the dead slug's own literal name (a dead slug spelled
out in a live reference document risks a future reader copy-pasting it as if it still resolved):
a formerly-cited domain-exploration command, referenced twice (under `problem-definition` and
under `market-analysis`), turned out not to exist at all and was simply removed; a
formerly-cited scenario command (the old slug paired the Scenario Planning framework name with
the general word for a written breakdown), referenced three times (under `market-analysis`,
`business-model`, and `financial-model`), also turned out not to exist, and its live
replacement, `/mos:scenario-plan`, is retargeted to the new `strategy` section rather than
patched back into the three original sites. `trending-to-absurd` (live, but misfiled under
`problem-definition` when it actually produces to `opportunity-bank` - refiled) and
`analyze-needs` (live, but misfiled under `team-execution` when it actually produces to
`market-analysis` - refiled) account for the two misfiled-citation corrections.

`value-proposition` is sub-structure inside `business-model`, not a section of its own -
"Value Proposition" stays reserved for the venture-level Triple Validation gate. `meetings` is a
structural directory that feeds sections, not a section itself, and needed no schema change.
`marketing-sales` and `research-documents` are deliberately deferred rather than rejected: the
2026-04-14 primary source shows real intended content for `marketing-sales` (Marketing
Strategies, Sales Strategies and Pipelines) that was simply never built.

One more naming mismatch, found in passing while grounding this document, named here rather
than silently absorbed: `/mos:persona` produces to `room/team/*`, a fourth section-slug spelling
distinct from `team-execution`. Not a defect this plan is scoped to fix, named so a future
reader does not rediscover it as new.
