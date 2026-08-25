---
id: SEED-082
status: dormant
planted: 2026-08-25
planted_during: Theo Phase 6 (Command Sync & Parallel-Run Rollout) - planning, cross-repo (this repo is the source-of-truth side of Theo's SYNC-01 registry sync)
trigger_when: "when a phase proposes automating either sync direction (Theo content ingestion -> a /mos: command being authored here, or a release here changing data/command-registry.json / lib/core/recipe-maps.cjs -> a Theo sync payload), or when Theo's own SEED-001 framework-ingestion work is scoped and its output needs a way to reach a developer here, or if the two graphs are ever found stale relative to each other in production."
scope: small
---

# SEED-082: Bidirectional command<->framework sync has no drift-detection mechanism, in either direction

## Why This Matters

Filed as the paired half of Theo's `.planning/seeds/SEED-005-bidirectional-command-framework-sync-drift-detection.md`, in response to a navigator question asked mid Theo Phase 6 planning (2026-08-25): "what happens when a new ingestion of framework work [happens] - will mindrianOS trigger command creation and vice versa?"

The honest answer, confirmed by reading both repos' actual mechanisms: **no,
neither direction triggers today, and that is deliberate, not an oversight**
- but the gap between "deliberately manual" and "silently stale" is real and
currently unaddressed on both sides.

**Direction 1: Theo ingests a new framework -> does this repo find out?**
No. A `/mos:` command is a hand-authored file (`commands/*.md` with
frontmatter, in this repo). `data/command-registry.json` is *generated*
FROM those files (`scripts/build-command-registry.cjs`, with a `--check`
drift tripwire already wired into `.git/hooks/pre-commit` - but that check
only catches this repo's own registry drifting from its own `commands/*.md`,
it says nothing about Theo). Theo's SEED-001 future ingestion work will grow
its chapter/concept layer from 33 chapters toward a ~1,400-node curated
spine, sourced from the real PWS Brain. None of that growth puts a signal in
front of any developer here saying "framework X now has real content in
Theo, consider authoring `/mos:x`."

**Direction 2: this repo ships a new command -> does Theo find out?**
No, and this one is already named as doctrine on Theo's side, just not
automated. Theo's own `CLAUDE.md` ("When MindrianOS ships a new command
(the sync contract)" section) already states the trigger condition in
words: "whenever `data/command-registry.json` or `recipe-maps.cjs` changes
in a MindrianOS-Plugin release, Theo's `MindrianCommand` layer needs a
corresponding sync payload - a GSD phase, not an ad hoc edit." But nothing
here currently *flags* that condition for whoever maintains Theo when a
release ships.

## Why NOT auto-execute (the constraint this seed must respect)

Both directions are intentionally NOT automatic, and any resolution of this
seed must keep it that way:

- This repo's own standing hard rule: GSD-only, no direct edits, no
  exceptions - a write that bypasses the reviewed GSD phase cycle is exactly
  the failure class this repo already guards against (see the pre-commit
  registry-drift tripwire itself, which flags rather than auto-fixes).
- Theo's own architecture doctrine, rule 5: "Recommends and executes only
  what it's told, never decides... never initiates, never chooses between
  options on its own, never acts without an explicit typed call."

An auto-trigger that *creates* a `commands/*.md` file here, or *executes* a
Cypher sync payload on Theo's side, on its own would violate both. What's
missing is strictly **detection and surfacing**, not automation of the
actual authoring/ingestion work.

## Proposed shape (not yet designed - this is the seed, not the plan)

A scheduled or pre-release check that diffs:
- `data/command-registry.json`'s `framework_index` array (this repo, source
  of truth for what commands claim to teach)
- Theo's live `Framework`/`Chapter`/`DomainConcept` node set (via a Theo
  content tool or direct query)

Surfaces two lists: frameworks named in `framework_index` with no matching
Theo content, and Theo frameworks/chapters with no matching command. Writes
the result somewhere a human actually looks - a normal GSD todo, a CI
annotation, or (on Theo's side) a `-MOS-LEARNING.md`-style doc - never an
auto-authored `commands/*.md` file, never an auto-executed Cypher write on
either side.

## When to Surface

**Trigger:** when a phase proposes automating either sync direction, when
Theo's SEED-001 is scoped, or when the two graphs are found stale relative
to each other in practice.

## Scope Estimate

**Small** - a detection/surfacing mechanism (a diff + a flagged list), not a
build of the actual ingestion or command-authoring pipeline. Likely a single
quick task or small phase once triggered.

## Breadcrumbs

- Theo's `.planning/seeds/SEED-005-bidirectional-command-framework-sync-drift-detection.md`
  - the paired seed, planted same session
- `scripts/build-command-registry.cjs` - confirms `data/command-registry.json`
  is generated from `commands/*.md`, not the reverse; the existing pre-commit
  `--check` tripwire this repo already has for the WITHIN-repo half of this
  problem
- `data/command-registry.json` - `framework_index` (28 entries as of
  2026-08-25) and `curated_chains` (18 `feeds_into` entries) - the fields a
  diff check would read from this side
- `lib/core/recipe-maps.cjs` - `NAMED_RECIPES`, the other authorized source
  Theo's own Phase 6 SYNC-01 already reads from
- Per this repo's own "Dev-Research Compositing" rule, also filed as a
  research entry in the `rethinking-mindrianos` Data Room
  (`~/MindrianRooms/rethinking-mindrianos/research/`), cross-linked back
  here

## Notes

Navigator-directed: "ok seed it in both sides mindrianos and in theo !"
Cross-repo pair with Theo's SEED-005.
