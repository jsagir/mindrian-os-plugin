# Phase 364 Theo Notify: /mos:scientific-roadmap

Status: plugin side DONE on main, 2026-10-03. Not released yet.
Phase: 364 (Scientific Roadmapping command, SEED-098)
Contract this answers: Theo's `25-PLUGIN-CONTRACT.md` (Phase 25, scientific-roadmapping adoption), the "plugin owes" list and its handoff log.
Direction: plugin to Theo. This document is written from the plugin side only. Nothing was written under the Theo repository, and nothing here asks the plugin session to write there either.

Plain-English version: the plugin now has a command that walks a researcher through the seven Scientific Roadmapping steps and builds a research plan. The command refuses to run a step until Theo has authored it, so right now it is built and wired but honest about being empty. Three things have to happen on Theo's side before it lights up: one alias row, the seven step texts, and (after a release) the USES_FRAMEWORK edge.

---

## 1. What shipped, and when it becomes live

The command is on `main`. It is not live until a release carries it and users update (a `main` commit reaches nobody on its own).

| Piece | Commit | What it is |
|---|---|---|
| Canon snapshot refresh (364-02) | `8676aaa88` | `data/framework-names.json` now names Scientific Roadmapping. 410 to 414 names; the four added are Scientific Roadmapping, 80/20 Rule, Babson Model (Magical Thinking) and Systematic Inventive Thinking (SIT). Stamped by the live refresh, never by hand (`theo_stamp` plugin_version 2.0.0-beta.56, refreshed 2026-10-02). |
| Born-wired command surface (364-07) | `1d2526a99`, `50b9c4176` | `commands/scientific-roadmap.md`, its skill mirror, the registry rows, the connector rows, the curated chains. |
| MCP reach and ignite offer (364-08) | `31381c8dc`, `18bcdbe5e` | The `methodology` tool reaches the command on Desktop and Cowork; `/mos:ignite` offers it to Researcher and Door 3 arrivals. |
| Compose with Phases 355 and 355.1 (364-14) | `5df121329`, `c9ef39e7f` | A stamped eureka finding enters the command at step 6 (Constraint Interrogation) with its verification stamp shown verbatim, never upgraded, never with a score. The eureka handoff needed no code: the existing command resolver already maps Scientific Roadmapping to `/mos:scientific-roadmap` since 364-07 (pinned by tests H1-H4). |

The release id is left for the release session. This document does not name one. The release will tell Theo through the mechanism in section 5.

## 2. What Theo's sync will read

Theo reads three plugin files from a pinned clone: `data/command-registry.json`, `lib/core/recipe-maps.cjs`, `data/connector-registry.json`. Measured 2026-10-03:

- **Slug:** `/mos:scientific-roadmap`. Kind `methodology`, `autonomous_safe` false.
- **Frameworks, in `framework_index`:** Scientific Roadmapping is the primary framework, and the command is listed under it. It is also listed under Hypothesis-Driven Problem Solving, where `/mos:research` stays first and the new command comes after it.
- **Connector:** reach `context_block`, sub_mode `scientific-roadmap`, framework Scientific Roadmapping, posture `hold`, hierarchy_rank 6, `sensor_triggers` empty (the command is not triggered by a sensor; a person or Larry opens it). The skill mirror `skill:scientific-roadmap` carries the same connector row.
- **Two curated chains** (both `feeds_into`):
  - `command:/mos:scientific-roadmap` FEEDS_INTO `command:/mos:research`, confidence 0.7, transform `limiter-to-hypothesis`.
  - `command:/mos:scientific-roadmap` FEEDS_INTO `command:/mos:find-analogies`, confidence 0.5, transform `limiter-to-analogy`.
- **Recipes: no new recipe.** `NAMED_RECIPES` (1) plus `SENS10_CAUSE_RECIPES` (4) total 5, which is Theo's `EXPECTED_RECIPE_COUNT` (5). find-analogies is therefore a FEEDS_INTO, not a NEXT_IN_RECIPE.
- **MindrianCommand count:** 114 `commands/*.md` files measured now, against 113 without this command (the figure Theo canon held on 2026-10-02). Another phase may add commands before the release; Theo should read the count at the release, not from this line.

## 3. What Theo needs to add

One alias-table row in `.theo-graph/command-alias-table.yaml`, shaped like the existing Hypothesis-Driven Problem Solving row (framework, chapter, live_framework, evidence, note):

```yaml
  - framework: "Scientific Roadmapping"
    chapter: null
    live_framework: Scientific Roadmapping
    evidence: "<Theo to fill: the live :Framework read and its mapped_by>"
    note: "<Theo to fill>"
```

Why: Theo resolves a command's frameworks through its own alias table, and that table has a Hypothesis-Driven Problem Solving row and no Scientific Roadmapping row. Until the row exists, Theo's sync records a fail-closed `framework_unresolved` gap for Scientific Roadmapping while the Hypothesis-Driven Problem Solving edge resolves normally. Which means the `USES_FRAMEWORK` edge for Scientific Roadmapping needs that alias row Theo-side first, and it lands only after a release carries the registry row (the sync reads a pinned clone of a released plugin).

Whether `chapter` stays null or points at the `bottleneck` anchor is Theo's ruling; the plugin takes no position.

## 4. What waits on Theo Phase 25

- **The seven steps.** Live read 2026-10-02: `framework_step("Scientific Roadmapping")` returns seven steps `sr-v1-step-1` to `sr-v1-step-7`, and every one has `label` and `runIt` NULL. Theo still returns NULL label and runIt for all 7 steps. The command therefore refuses, honestly, with the exact text "Theo has not authored this step yet" on each step, and it improvises nothing. It lights up the moment `framework_step` returns a label and a runIt for the steps. Please send the commit or release id when that lands (that is Phase 25's handoff trigger in the contract).
  - Update 2026-10-04 (Theo Phase 25 write 1 `f05ac2c`, write 2 `43205a2`, as reported by the Theo session): the `sr-v1-step-N` ids are retired. `framework_step` now returns seven STEP steps `sciroad::scientific-roadmapping::p01` to `p07` (Tension Qualification to Catalytic Ranking) with label and runIt set on all seven. researchDirective is set on p01 and p06 and is null on the other five on purpose. Every step is draft. Technology Roadmapping, Roadmapping and Field Roadmapping no longer resolve, and Tech Tree Mapping resolves but returns no steps. The plugin fixtures and `tests/test-364-sr-steps.cjs` pin these ids (quick 261004-a6r). The plugin's live smoke has not been re-run yet: it waits for Theo's close message after the influence recompute.
- **NR-3 edge verification.** The edges the command's step order leans on (the Systems Thinking pass before the bottleneck steps, the FEEDS_INTO into Hypothesis-Driven Problem Solving) are Theo's to audit and keep or correct.
- **Problem-type edges.** Per the 2026-10-01 ruling: Well-Defined primary and Ill-Defined secondary, so `find_frameworks_for_problem_type` and `recommend_chain` surface Scientific Roadmapping. The command asks `recommend_chain` for membership only; it never sorts or invents an order.
- **Scientific-method content ingest.** Until it lands, the plugin carries a labelled plugin-side rubric for the limiter and hypothesis steps. The label says it is a plugin rubric, not Theo content.
- **The USES_FRAMEWORK edge** from `/mos:scientific-roadmap` (part 6 of Theo's Phase 25 list), after a release, once the alias row of section 3 exists.

## 5. How the release tells Theo

- `scripts/release-cut-listener.cjs` (release.sh Step 0.55, the Theo leg) calls Theo's release bridge with the version being cut and the HEAD sha, so Theo re-emits its command layer against the version about to ship.
- The old Step 5.6 `repository_dispatch` was retired 2026-10-02 (`docs/THEO-NOTIFY-CONTRACT.md` is marked superseded and keeps the history).
- The canon snapshot refreshed in 364-02 carries a `theo_stamp`. The release lockstep wants a fresh stamp after Theo re-emits (RULE 5 place 9 in `docs/RELEASE-CEREMONY-RULING-SYSTEM.md`), so the snapshot is stamped again at the cut.
- At the version bump the release session fact-checks the website command count against the new total.

## 6. What the plugin did not do

- No write under the Theo repository. Theo paths in this document are text citations only.
- No canon write and no Framework node minted.
- No recipe added (count stays 5).
- No change to brain-router `KNOWN_METHODOLOGIES`; recorded as a follow-on, not done here.

## 7. Boundary (Canon Part 8)

Only the framework name and the Well-Defined problem-type enum cross to Theo. Room content never does: the questions, the limiter tables, the hypotheses and the plan stay local. A stamped finding's text and score never cross either.

## 8. Handoff log entry for the Theo session

Append this one line to the "Handoff log" in `25-PLUGIN-CONTRACT.md`:

```
- 2026-10-03: the plugin built /mos:scientific-roadmap (plugin Phase 364) on main (commits 1d2526a99, 50b9c4176, 31381c8dc, 18bcdbe5e, 5df121329; canon snapshot 8676aaa88). Slug /mos:scientific-roadmap; frameworks Scientific Roadmapping (primary) and Hypothesis-Driven Problem Solving; curated chains FEEDS_INTO /mos:research 0.7 and /mos:find-analogies 0.5; no recipe added (5). Theo needs one alias-table row (framework Scientific Roadmapping, live_framework Scientific Roadmapping) or its sync records framework_unresolved for it. The command refuses with "Theo has not authored this step yet" until framework_step returns label and runIt for the seven steps (all NULL live 2026-10-02). Not live until released; release to follow, and the release bridge will carry the version.
```
