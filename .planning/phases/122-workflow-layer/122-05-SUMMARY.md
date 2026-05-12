---
phase: 122-workflow-layer
plan: 05
subsystem: workflow
tags: [command-registry, command-resolver, framework-chain-composer, jtbd-taxonomy, canon-part-8, workflows-doc, e2e-test, changelog, feynman-runner]

# Dependency graph
requires:
  - phase: 122-workflow-layer (plan 01)
    provides: the /mos: command frontmatter contract (kind / frameworks[] / produces / inputs / autonomous_safe on 44 commands), docs/COMMAND-FRONTMATTER.md, the Wave-0 test scaffold (tests/run-all-122.sh, the lib/ stubs registered in run-feynman-tests)
  - phase: 122-workflow-layer (plan 02)
    provides: data/command-registry.json (85 commands, framework_index, autonomous_safe), data/framework-names.json, scripts/build-command-registry.cjs (generator + --check + --refresh-names), the pre-commit drift tripwire, lib/memory/command-registry.test.cjs
  - phase: 122-workflow-layer (plan 03)
    provides: lib/workflow/command-resolver.cjs (commandsForFramework / frameworksForCommand / composeWorkflow / validateChainAutonomy -- the only door, reads only data/command-registry.json, never the Brain), lib/brain/chain-recommender.cjs (recommendFrameworkChain via FEEDS_INTO; framework names + enums only)
  - phase: 122-workflow-layer (plan 04)
    provides: framework-chain-composer.proposeNextFramework routed through the resolver + composeWorkflow path; mapFrameworkToCommandSlug delegating to the resolver and exported; scripts/{suggest-next,pipeline,act}-command.cjs; pws-methodology + brain-connector skills repointed at the resolver (the dead Command-node prose in brain-connector left for this plan to delete)
  - phase: 91-navigation-engine
    provides: lib/core/framework-chain-composer.cjs (the residual FRAMEWORK_TO_COMMAND_SLUG / KNOWN_FRAMEWORKS this plan prunes), lib/core/problem-type-router.cjs
  - phase: 100-jtbd-inference-engine
    provides: lib/hmi/jtbd-taxonomy.json (methodology_hooks -- the third hand-maintained map this plan marks informational-only) + tests/test-jtbd-taxonomy.cjs (the schema test the prune must not break)
provides:
  - framework-chain-composer.FRAMEWORK_TO_COMMAND_SLUG pruned to Object.freeze({}) -- an empty back-compat export; the resolver (data/command-registry.json) is the ONLY framework-to-command door; KNOWN_FRAMEWORKS kept as a name-recognition bootstrap (NOT the command source); mapFrameworkToCommandSlug relies solely on the resolver then FALLBACK_COMMAND_SLUG
  - lib/hmi/jtbd-taxonomy.json:methodology_hooks_note added (informational-only; the resolver is authoritative) + /mos:value-proposition -> /mos:validate-proposition (the registry's slug); tests/test-jtbd-taxonomy.cjs assertHooksExist now resolves hooks against data/command-registry.json (the authoritative list), falling back to commands/<name>.md
  - references/methodology/index.md replaced -- the 26-row hand-maintained command-routing table is gone; the file is now a pointer to docs/COMMAND-FRONTMATTER.md / data/command-registry.json / docs/WORKFLOWS.md (the design-by-analogy reference-data table kept)
  - skills/brain-connector/SKILL.md -- the dead "Brain has Command nodes / brain_proactive_command / FOLLOWS_FRAMEWORK -> Command" prose deleted (latent Canon Part 8 breach); the resolver pointer survives; references/brain/command-triggers-schema.md (a whole dead "commands are Neo4j nodes" schema doc) replaced with a REMOVED tombstone pointing at the workflow layer
  - docs/WORKFLOWS.md -- the Brain <-> registry <-> Larry join + the Canon Part 8 boundary + the 5 reliability rules + the resolver/recommender surface (61 lines); docs/THE-BRAIN.md + docs/CANON-PHASE-MAP.md + docs/COMMAND-FRONTMATTER.md point at it; CANON-PHASE-MAP records Phase 122 under Part 7, Part 8, and the v1.13.0 milestone table
  - lib/memory/workflow-layer-e2e.test.cjs -- the end-to-end test: build-command-registry.cjs --check -> composeWorkflow(acceptance example) -> the command-less degrade -> validateChainAutonomy stop-point -> the Canon Part 8 zero-Brain-mutation grep sweep; registered in lib/memory/run-feynman-tests.cjs TEST_FILES[] + tests/run-all-122.sh CJS_SUITES
  - CHANGELOG.md [Unreleased] -- v1.13.0-beta.11 block finalized for Phase 122 (Added / Changed / Fixed) + a Maintainer Notes block flagging the tag / marketplace pin / npm publish @next steps as NOT done by this phase
affects: [v1.13.0 release (the maintainer cuts the tag / pins marketplace / npm publishes from here), future no-em-dash housekeeping pass (CHANGELOG.md + jtbd-taxonomy.json + commands/doctor.md), Phase-84/109 housekeeping (the test-84 hang that blocks the Feynman runner)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reliability rule 1 made total: NOTHING outside command frontmatter asserts the framework-to-command mapping -- the three hand-maintained maps (FRAMEWORK_TO_COMMAND_SLUG, jtbd-taxonomy.json:methodology_hooks, references/methodology/index.md) are pruned to empty / informational-only / a pointer; the resolver (data/command-registry.json, generated from frontmatter, CI-checked) is the only door"
    - "Canon Part 8 enforced by an e2e grep sweep: lib/memory/workflow-layer-e2e.test.cjs scans for a /mos: literal within ~80 chars of a brain/query/fetch/http token in lib/brain/ + lib/workflow/ non-test .cjs, that command-resolver.cjs requires no brain client, that build-command-registry.cjs has no write-Cypher, and that no Command-node assertion (Brain has Command / brain_proactive_command / FOLLOWS_FRAMEWORK->Command / :Command) survives anywhere in skills/ agents/ references/"
    - "Dead Part-8-violating prose is deleted, not annotated: the brain-connector SKILL.md Command-node block and the entire references/brain/command-triggers-schema.md schema doc were removed (the latter replaced with a REMOVED tombstone) -- dead text that asserts commands live in the Brain is the exact class Canon Part 8 forbids, and it breeds the breach"
    - "The schema test follows the source of truth: tests/test-jtbd-taxonomy.cjs now resolves methodology_hooks against data/command-registry.json (the generated authoritative list) first, with the commands/<name>.md filesystem check as a legacy fallback -- so a hook can point at /mos:validate-proposition (the registry slug) even though the file is commands/value-proposition.md"
    - "docs/WORKFLOWS.md as the closed-loop reference (next to docs/COMMAND-FRONTMATTER.md / docs/THE-BRAIN.md): the navigation engine routes -> the operator sets the mode -> the SQL spine says where you are -> the cleaned Brain says what is next -> the registry says which command -> Larry proposes an F-selector -> you confirm -> /mos:act runs it -> the artifact files -> the cascade fires -> the next nudge surfaces; the Workflow Layer is the registry+resolver link in that sentence"

key-files:
  created:
    - docs/WORKFLOWS.md
    - lib/memory/workflow-layer-e2e.test.cjs
  modified:
    - lib/core/framework-chain-composer.cjs
    - lib/hmi/jtbd-taxonomy.json
    - tests/test-jtbd-taxonomy.cjs
    - references/methodology/index.md
    - references/brain/command-triggers-schema.md
    - skills/brain-connector/SKILL.md
    - skills/pws-methodology/SKILL.md
    - docs/THE-BRAIN.md
    - docs/CANON-PHASE-MAP.md
    - docs/COMMAND-FRONTMATTER.md
    - lib/memory/run-feynman-tests.cjs
    - tests/run-all-122.sh
    - CHANGELOG.md
    - .planning/phases/122-workflow-layer/deferred-items.md

key-decisions:
  - "FRAMEWORK_TO_COMMAND_SLUG -> Object.freeze({}) (the empty-back-compat-export option, not deleting the const) so any caller that still imports it does not crash; KNOWN_FRAMEWORKS kept (detectCompletedFramework uses it for name recognition) with a comment that it is NOT the framework-to-command source; mapFrameworkToCommandSlug simplified to resolver-then-FALLBACK_COMMAND_SLUG (the legacy in-module table is gone)"
  - "jtbd-taxonomy.json: kept the methodology_hooks field and added a top-level methodology_hooks_note ('informational only; lib/workflow/command-resolver.cjs is authoritative') rather than regenerating from the registry -- regeneration would be a larger derivation and the note is the explicitly-sanctioned alternative. Fixed /mos:value-proposition -> /mos:validate-proposition (the registry's command slug; the command file is commands/value-proposition.md with name: validate-proposition)."
  - "tests/test-jtbd-taxonomy.cjs assertHooksExist updated to resolve hooks against data/command-registry.json commands[].command first, with commands/<name>.md as a legacy fallback -- because /mos:validate-proposition has no commands/validate-proposition.md (the file is commands/value-proposition.md). This is the correct alignment (the registry is the source of truth per Phase 122) and keeps all 13 assertions green. Deviation Rule 3 (the test would have broken otherwise)."
  - "references/methodology/index.md replaced with a pointer block (the option, not regenerating the table) -- kept the design-by-analogy reference-data table (it is descriptive data, not a framework map); skills/pws-methodology/SKILL.md updated so its index.md mention says 'now just a pointer', not 'a mirror'."
  - "references/brain/command-triggers-schema.md (226 lines of dead 'commands are first-class Neo4j nodes' Cypher + brain_proactive_command + FOLLOWS_FRAMEWORK->Command) was NOT in the plan's prune list but is the exact Canon Part 8 latent-breach class; nothing referenced it; replaced it with a REMOVED tombstone pointing at the workflow layer (Deviation Rule 2 -- a Part 8 breach is a bug). Without this the success-criterion grep sweep would have failed."
  - "CHANGELOG: the version on main is 1.13.0-beta.11 (renumbered from beta.10 on 2026-05-12 -- beta.10 was a token-validation npm build), and the existing [Unreleased] -- v1.13.0-beta.11 block already names the Workflow Layer as the capstone headline; so the Phase 122 Added/Changed/Fixed + the Maintainer Notes were finalized INTO that block (the plan's literal 'beta.10' references are stale; the objective said to read the CHANGELOG fresh). No version bump; no git tag; no npm publish; no marketplace.json edit (it is in ~/mindrian-marketplace, not this repo)."
  - "lib/memory/workflow-layer-e2e.test.cjs picks the command-less framework (Test 3) and the autonomous_safe:false framework (Test 4) DYNAMICALLY from data/framework-names.json + data/command-registry.json (Red Teaming / Six Thinking Hats->/mos:hat-briefing as the concrete instances), so a future retrofit that gives Red Teaming a command or makes /mos:hat-briefing autonomous does not silently break the test."

patterns-established:
  - "docs/WORKFLOWS.md is the canonical reference for the framework-to-command layer (the closed loop, the 5 reliability rules, the Brain<->registry<->Larry join, the Canon Part 8 boundary, the resolver/recommender surface); docs/COMMAND-FRONTMATTER.md (the frontmatter contract), docs/THE-BRAIN.md (the methodology graph), and docs/CANON-PHASE-MAP.md (Phase 122 under Part 7 / Part 8 / the v1.13.0 milestone table) all point at it"
  - "the workflow-layer-e2e grep sweep is the standing Canon Part 8 tripwire for this subsystem: it runs in lib/memory/run-feynman-tests.cjs and tests/run-all-122.sh and fails the build if a command string ever appears near a Brain-query token, if the resolver ever requires a brain client, if the generator ever gains write-Cypher, or if a Command-node assertion ever returns in skills/ agents/ references/"

requirements-completed: [WORKFLOW-122-09, WORKFLOW-122-10, WORKFLOW-122-11]

# Metrics
duration: 35min
completed: 2026-05-12
---

# Phase 122 Plan 05: Close the Loop -- Prune the Last Maps, Ship docs/WORKFLOWS.md, the e2e Test, Finalize the CHANGELOG Summary

**The three remaining hand-maintained framework-to-command maps are pruned so the resolver is the only door (`framework-chain-composer.FRAMEWORK_TO_COMMAND_SLUG` -> empty back-compat export; `lib/hmi/jtbd-taxonomy.json:methodology_hooks` -> marked informational-only + the `/mos:value-proposition` -> `/mos:validate-proposition` slug fixed; `references/methodology/index.md` -> a pointer to `docs/COMMAND-FRONTMATTER.md` / the registry / `docs/WORKFLOWS.md`); the dead Canon-Part-8-violating "Brain has Command nodes" prose is deleted from `skills/brain-connector/SKILL.md` and the entire dead `references/brain/command-triggers-schema.md` schema doc is replaced with a REMOVED tombstone; `docs/WORKFLOWS.md` ships (the Brain <-> registry <-> Larry join + the Canon Part 8 boundary + the 5 reliability rules + the resolver/recommender surface) and `docs/THE-BRAIN.md` / `docs/CANON-PHASE-MAP.md` / `docs/COMMAND-FRONTMATTER.md` point at it; `lib/memory/workflow-layer-e2e.test.cjs` walks frontmatter -> `build-command-registry --check` -> `composeWorkflow(the spec's acceptance example)` -> the command-less degrade -> the `validateChainAutonomy` stop-point -> the Canon Part 8 zero-Brain-mutation grep sweep (8 assertion groups, registered in the Feynman runner + the scoped 122 runner); and the CHANGELOG `[Unreleased] -- v1.13.0-beta.11` block is finalized for Phase 122 with the maintainer-gated tag / marketplace-pin / `npm publish @next` steps flagged as NOT performed here.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-05-12 (after the 122-04 metadata commit)
- **Completed:** 2026-05-12
- **Tasks:** 3 completed
- **Files modified:** 16 (2 created + 14 modified, excluding `.planning/`)

## Accomplishments
- **Reliability rule 1 made total (Task 1).** The last three hand-maintained framework-to-command maps are gone: `lib/core/framework-chain-composer.cjs` `FRAMEWORK_TO_COMMAND_SLUG` is now `Object.freeze({})` (an empty back-compat export with a "do NOT add entries here -- the resolver owns this" comment); `KNOWN_FRAMEWORKS` stays as a name-recognition bootstrap (with a comment that it is NOT the framework-to-command source); `mapFrameworkToCommandSlug()` is simplified to resolver-then-`FALLBACK_COMMAND_SLUG` (the legacy in-module table removed). `lib/hmi/jtbd-taxonomy.json` got a top-level `methodology_hooks_note` ("informational only; `lib/workflow/command-resolver.cjs` is authoritative ... Larry never names a `/mos:` from memory") and the `decide-pursue` entry's `/mos:value-proposition` was fixed to `/mos:validate-proposition` (the registry's command slug). `references/methodology/index.md` was rewritten from a 26-row hand-maintained command-routing table to a pointer block (source of truth = `frontmatter`; generated registry = `data/command-registry.json`; the only door = `lib/workflow/command-resolver.cjs`; the Brain side = `lib/brain/chain-recommender.cjs`; see `docs/COMMAND-FRONTMATTER.md` / `docs/WORKFLOWS.md`) -- the design-by-analogy reference-data table kept. `skills/brain-connector/SKILL.md` lost the dead "Brain has Command nodes linked to Frameworks ... `brain_proactive_command` ... `FOLLOWS_FRAMEWORK -> Command` ... Multi-hop: Room frameworks -> FOLLOWS_FRAMEWORK -> Command -> ..." block (and the dead `>` interim-note around it) -- the resolver pointer survives, plus a "see `docs/WORKFLOWS.md`" line. `skills/pws-methodology/SKILL.md` was updated so its `references/methodology/index.md` mention says "now just a pointer", not "a mirror". `tests/test-jtbd-taxonomy.cjs` `assertHooksExist` now resolves a `methodology_hooks` entry against `data/command-registry.json` `commands[].command` (the authoritative list) first, with the `commands/<name>.md` filesystem check as a legacy fallback -- all 13 assertions stay green.
- **docs/WORKFLOWS.md + cross-links (Task 2).** New `docs/WORKFLOWS.md` (61 lines): (1) the closed loop in one paragraph + "the Workflow Layer is the registry+resolver link in that sentence -- ~90% wiring of existing code"; (2) the five reliability rules verbatim (single source of truth / generated never hand-written + CI tripwire / the resolver is the only door / the trigger is the hook not the model / degrade do not fabricate); (3) the Brain <-> registry <-> Larry join (an ASCII diagram + prose: the Brain holds `Framework -[:FEEDS_INTO]-> Framework`; the plugin-local `data/command-registry.json` holds the framework-to-command mapping, generated from frontmatter, VALIDATED against Brain names at build time via a read-only query, NEVER written back; `lib/workflow/command-resolver.cjs` joins them with zero Brain calls) + the Canon Part 8 boundary ("commands NEVER enter the Brain -- no `Command` node, ever; a command string in a Brain-query payload is a canonical breach; the e2e grep sweep enforces it; Phase 122-05 deleted the last dead `Command`-node prose"); (4) the surfaces table (`/mos:suggest-next`, `/mos:pipeline --from-problem-type/--from-framework`, `/mos:act --chain` with the autonomy gate, the navigation hook, the `pws-methodology` + `brain-connector` skills); (5) the Canon 3/4/7/8/9/10 citations. `docs/THE-BRAIN.md` got a "See also: `docs/WORKFLOWS.md` ... commands NEVER enter the Brain -- no `Command` node, ever (Canon Part 8)" line (and its title em-dash fixed). `docs/CANON-PHASE-MAP.md` got Phase 122 rows under "### Part 7 - Reuse Before Build" (~90% wiring, deletes drift-class surface), "### Part 8 - The Graph Boundary" (registry plugin-local, validated against Brain names, never written back; the Command-node prose deleted; verified by the grep sweep), and a row in the "### v1.13.0 ... milestone phases" table (Phase 122 workflow-layer, Parts 3/4/7/8, beta.11, "the capstone -- the registry+resolver link"). `docs/COMMAND-FRONTMATTER.md` got a "See also: `docs/WORKFLOWS.md`" cross-link near the top.
- **The e2e test + the Canon Part 8 sweep + the CHANGELOG (Task 3).** New `lib/memory/workflow-layer-e2e.test.cjs` (CJS, `node:assert/strict` + `node:child_process` + `node:fs`, 8 assertion groups): Test 1 -- `spawnSync('node', ['scripts/build-command-registry.cjs', '--check'])` -> `status === 0`; Test 2 -- `composeWorkflow(["Beautiful Question Framework","Domain Selection","Jobs to Be Done (JTBD)"])` -> a 3-step array, each step 1-indexed + in order + `optional === false` + `command` a `/mos:` slug that exists in `data/command-registry.json` (shape + registered-ness, not hardcoded slugs); Test 3 -- a command-less framework picked dynamically from `data/framework-names.json` (Red Teaming as the concrete instance) -> `[{step:1, framework:<that>, command:null, optional:true}]`; Test 4 -- a framework whose first command is `autonomous_safe: false` picked dynamically (Six Thinking Hats -> `/mos:hat-briefing`) -> `validateChainAutonomy` -> `runnable === false` + a blocker at step 1, plus a sanity check that an all-`autonomous_safe` workflow is runnable; Test 5 (three groups) -- the Canon Part 8 grep sweep: no `/mos:` literal within ~80 chars of a `brain`/`query`/`fetch`/`http` token in `lib/brain/` + `lib/workflow/` non-test `.cjs`, `command-resolver.cjs` requires no brain client / no `fetch()` / no `node:http(s)`, `build-command-registry.cjs` has no write-Cypher, and no `Brain has Command|brain_proactive_command|FOLLOWS_FRAMEWORK.*Command|:Command` line survives anywhere under `skills/`, `agents/`, `references/`. Registered in `lib/memory/run-feynman-tests.cjs` `TEST_FILES[]` and `tests/run-all-122.sh` `CJS_SUITES` (`../lib/memory/workflow-layer-e2e.test.cjs`); `bash tests/run-all-122.sh` exits 0 (5/5). `CHANGELOG.md` `## [Unreleased] -- v1.13.0-beta.11` block expanded for Phase 122: `### Added` (the Workflow Layer bullet: `data/command-registry.json` + `data/framework-names.json` + `scripts/build-command-registry.cjs` + `lib/workflow/command-resolver.cjs` + `lib/brain/chain-recommender.cjs` + the 5 frontmatter keys + `/mos:pipeline --from-problem-type/--from-framework` + `/mos:act --chain` autonomy gating + `/mos:suggest-next` command sequence + the pre-commit registry-drift tripwire + `docs/COMMAND-FRONTMATTER.md` + `docs/WORKFLOWS.md` + `workflow-layer-e2e.test.cjs`); `### Changed` (`/mos:suggest-next` returns a command sequence; `framework-chain-composer` routes through the resolver; the `pws-methodology` + `brain-connector` skills point at the resolver; the 3 hand-maintained maps pruned); `### Fixed` (the hallucinated-command failure mode -- e.g. `/mos:jtbd` for the JTBD methodology vs `/mos:analyze-needs`; the latent Canon Part 8 breach in `brain-connector` SKILL.md + `command-triggers-schema.md` prose); `### Maintainer Notes` ("Release steps (maintainer-gated -- NOT performed in this phase): cut the `v1.13.0-beta.11` tag, pin `marketplace.json` `source.ref`, `npm publish @mindrian_os/install` with the `@next` dist-tag -- per the CLAUDE.md release process + the `feedback_release_lockstep_npm` rule"). No version bump; no `git tag`; no `npm publish`; no `marketplace.json` edit.

## Task Commits

Each task was committed atomically (with `--no-verify` per the parallel-execution note):

1. **Task 1: Prune the three hand-maintained maps + delete the brain-connector Command-node prose** - `a08a5db` (feat) -- includes `lib/core/framework-chain-composer.cjs`, `lib/hmi/jtbd-taxonomy.json`, `tests/test-jtbd-taxonomy.cjs`, `references/methodology/index.md`, `references/brain/command-triggers-schema.md`, `skills/brain-connector/SKILL.md`, `skills/pws-methodology/SKILL.md`
2. **Task 2: docs/WORKFLOWS.md + THE-BRAIN.md / CANON-PHASE-MAP.md / COMMAND-FRONTMATTER.md cross-links** - `4206274` (docs)
3. **Task 3: End-to-end test + Canon Part 8 grep sweep + CHANGELOG finalization** - `6d634ad` (feat) -- `lib/memory/workflow-layer-e2e.test.cjs`, `lib/memory/run-feynman-tests.cjs`, `tests/run-all-122.sh`, `CHANGELOG.md`

**Plan metadata:** (this commit) (docs: complete plan)

_Note: Task 3 is `tdd="true"` but the implementation it tests (build-command-registry.cjs, command-resolver.cjs, chain-recommender.cjs, the registry, the skills) was already built by plans 122-01..04 -- the e2e test is an integration-of-completed-code test, not a unit test of new code; it was written and committed once green (a pure RED-then-GREEN split has no meaning for an integration test of finished code). The Canon Part 8 grep sweep was already clean (Task 1 deleted the last dead prose), so the test passed on first run._

## Files Created/Modified

### Created
- `docs/WORKFLOWS.md` - the Brain <-> registry <-> Larry join + the Canon Part 8 boundary + the 5 reliability rules + the resolver/recommender surface + the Canon citations (61 lines)
- `lib/memory/workflow-layer-e2e.test.cjs` - the end-to-end test (8 assertion groups): build-command-registry --check -> composeWorkflow(acceptance example) -> the command-less degrade -> validateChainAutonomy stop-point -> the Canon Part 8 zero-Brain-mutation grep sweep; registered in the Feynman runner + tests/run-all-122.sh

### Modified
- `lib/core/framework-chain-composer.cjs` - `FRAMEWORK_TO_COMMAND_SLUG` -> `Object.freeze({})` (empty back-compat export); `KNOWN_FRAMEWORKS` annotated as a name-recognition bootstrap; `mapFrameworkToCommandSlug` simplified to resolver-then-`FALLBACK_COMMAND_SLUG`; header docs updated
- `lib/hmi/jtbd-taxonomy.json` - added `methodology_hooks_note` (informational-only; the resolver is authoritative); `/mos:value-proposition` -> `/mos:validate-proposition`
- `tests/test-jtbd-taxonomy.cjs` - `assertHooksExist` now resolves hooks against `data/command-registry.json` (the authoritative list), falling back to `commands/<name>.md`; all 13 assertions green
- `references/methodology/index.md` - replaced the 26-row hand-maintained command-routing table with a pointer to `docs/COMMAND-FRONTMATTER.md` / `data/command-registry.json` / `docs/WORKFLOWS.md` (the design-by-analogy reference-data table kept)
- `references/brain/command-triggers-schema.md` - replaced the dead "commands are first-class Neo4j nodes" schema doc with a REMOVED tombstone pointing at the workflow layer (latent Canon Part 8 breach in prose removed; nothing referenced it)
- `skills/brain-connector/SKILL.md` - deleted the dead "Brain has Command nodes / brain_proactive_command / FOLLOWS_FRAMEWORK -> Command" block; the resolver pointer survives; added a "see docs/WORKFLOWS.md" line
- `skills/pws-methodology/SKILL.md` - `references/methodology/index.md` is now "just a pointer", not "a mirror"; cites `docs/COMMAND-FRONTMATTER.md` + `docs/WORKFLOWS.md`
- `docs/THE-BRAIN.md` - "See also: `docs/WORKFLOWS.md` ... commands NEVER enter the Brain -- no `Command` node, ever (Canon Part 8)"; title em-dash fixed
- `docs/CANON-PHASE-MAP.md` - Phase 122 rows under Part 7, Part 8, and the v1.13.0 milestone table
- `docs/COMMAND-FRONTMATTER.md` - "See also: `docs/WORKFLOWS.md`" cross-link near the top
- `lib/memory/run-feynman-tests.cjs` - appended `workflow-layer-e2e.test.cjs` to `TEST_FILES[]`
- `tests/run-all-122.sh` - `CJS_SUITES` gained `../lib/memory/workflow-layer-e2e.test.cjs`; header updated (all 122 suites landed)
- `CHANGELOG.md` - `[Unreleased] -- v1.13.0-beta.11` block finalized for Phase 122 (Added / Changed / Fixed) + a Maintainer Notes block
- `.planning/phases/122-workflow-layer/deferred-items.md` - logged the CHANGELOG.md + jtbd-taxonomy.json pre-existing em-dashes; expanded the test-84-hang note to cover all Phase-122 suites

## Decisions Made
See `key-decisions` in the frontmatter. The load-bearing ones:
1. `FRAMEWORK_TO_COMMAND_SLUG` -> `Object.freeze({})` (the empty-back-compat-export option, not deleting the const) so importers do not crash; `mapFrameworkToCommandSlug` simplified to resolver-then-fallback.
2. `jtbd-taxonomy.json`: keep the field, add the `methodology_hooks_note` (the sanctioned alternative to regenerating it), and fix the `/mos:value-proposition` -> `/mos:validate-proposition` slug; `tests/test-jtbd-taxonomy.cjs` updated to resolve hooks against the registry (the source of truth) so the slug fix does not break the schema test.
3. `references/brain/command-triggers-schema.md` -- not in the plan's prune list, but the exact Canon Part 8 latent-breach class; replaced with a REMOVED tombstone (Deviation Rule 2). Without it the success-criterion grep sweep would have failed.
4. The CHANGELOG was finalized into the existing `[Unreleased] -- v1.13.0-beta.11` block (the version on `main` is beta.11, renumbered from beta.10; the block already names the Workflow Layer as the capstone headline); the plan's literal "beta.10" references are stale per the objective's "read the CHANGELOG fresh" note. No version bump; no tag; no publish; no marketplace edit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical / latent Part 8 breach] Deleted references/brain/command-triggers-schema.md (a dead "commands are Neo4j nodes" schema doc)**
- **Found during:** Task 1 (running `grep -rE "Brain has Command|brain_proactive_command|FOLLOWS_FRAMEWORK.*Command|:Command" skills/ agents/ references/` after editing `skills/brain-connector/SKILL.md`)
- **Issue:** Beyond the `brain-connector` SKILL.md block the plan named, `references/brain/command-triggers-schema.md` (226 lines) was a whole dead architecture doc: `CREATE (c:Command { ... })`, `brain_proactive_command (Pattern 10d)`, `(current:Framework)<-[:FOLLOWS_FRAMEWORK]-(cmd:Command)`, "Commands are first-class nodes in the Neo4j Brain". The live Brain has no `Command` label (verified in 122-RESEARCH); this is the exact class of text Canon Part 8 forbids (asserting commands live in the Brain), and the plan's success criterion is `grep -rE "...|:Command" skills/ agents/ references/` returning nothing. Nothing in the repo references this file.
- **Fix:** Replaced the file's contents with a `# Brain Command Trigger Schema -- REMOVED (Phase 122, v1.13.0-beta)` tombstone explaining the Part 8 breach and pointing at `docs/COMMAND-FRONTMATTER.md` / `data/command-registry.json` / `lib/workflow/command-resolver.cjs` / `lib/brain/chain-recommender.cjs` / `docs/WORKFLOWS.md`. The tombstone carries no `:Command` / `Brain has Command` / `brain_proactive_command` / `FOLLOWS_FRAMEWORK...Command` text.
- **Files modified:** references/brain/command-triggers-schema.md
- **Verification:** `grep -rE "Brain has Command|brain_proactive_command|FOLLOWS_FRAMEWORK.*Command|:Command" skills/ agents/ references/` returns nothing; `node lib/memory/workflow-layer-e2e.test.cjs` Test 5 (the "no Command-node assertion left" group) passes.
- **Committed in:** `a08a5db` (Task 1 commit)

**2. [Rule 3 - Blocking] Updated tests/test-jtbd-taxonomy.cjs assertHooksExist to resolve hooks against the command registry**
- **Found during:** Task 1 (after fixing `/mos:value-proposition` -> `/mos:validate-proposition` in `lib/hmi/jtbd-taxonomy.json`)
- **Issue:** `tests/test-jtbd-taxonomy.cjs` `assertHooksExist` resolved each `methodology_hooks` entry to `commands/<name>.md` and required that file to exist. `/mos:validate-proposition` has no `commands/validate-proposition.md` -- the command file is `commands/value-proposition.md` with `name: validate-proposition` (which is why the registry's command is `/mos:validate-proposition`). The plan's acceptance criterion requires the slug fixed to `validate-proposition` AND `node tests/test-jtbd-taxonomy.cjs` to still exit 0; the unmodified test would have failed (or renaming the command file would have been a much larger, riskier change).
- **Fix:** `assertHooksExist` now resolves a hook against `data/command-registry.json` `commands[].command` (the generated authoritative list -- the right source of truth post-Phase-122) first, with the `commands/<name>.md` filesystem check as a legacy fallback for hooks the registry does not track yet. All 13 assertions stay green; this is not a schema break of the JSON.
- **Files modified:** tests/test-jtbd-taxonomy.cjs
- **Verification:** `node tests/test-jtbd-taxonomy.cjs` -> `[13/13 passed]`, exit 0.
- **Committed in:** `a08a5db` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 missing-critical / latent Part 8 breach, 1 blocking)
**Impact on plan:** Both were necessary to satisfy the plan's literal success criteria (the grep sweep returning nothing; the jtbd-taxonomy test still passing after the slug fix). Neither changed runtime command behavior -- the tombstone removes a dead doc, and the test change tracks the new source of truth. No scope creep -- both stay inside Task 1's boundary (pruning the maps + deleting the Part-8-violating prose). No `marketplace.json` change (it is not in this repo), no version bump, no `git tag`, no `npm publish`.

## Issues Encountered

**Pre-existing: the full Feynman suite still cannot run to completion (out of scope -- logged by 122-02/03/04, expanded here).** `test/84-smart-notebook-copilot.test.cjs` (a Phase-84 file, NOT touched by Phase 122) HANGS when run standalone (`timeout 25 node test/84-smart-notebook-copilot.test.cjs` -> exit 124 -- a dangling SQLite handle after a `no such table: main.nodes` migration error). Because `lib/memory/run-feynman-tests.cjs` iterates with a blocking `spawnSync` and `stdio:'inherit'` and no per-test timeout, this hang prevents the runner from ever reaching the registered Phase-122 suites (`command-resolver.test.cjs`, `command-registry.test.cjs`, `chain-recommender.test.cjs`, `navigation-hook-resolver.test.cjs`, `suggest-next-workflow.test.cjs`, and the new `workflow-layer-e2e.test.cjs`). All six Phase-122 suites are verified GREEN directly (`node <suite>` -> exit 0) and via the scoped runner (`bash tests/run-all-122.sh` -> exit 0, 5/5); they ARE registered in the Feynman `TEST_FILES` array, so they WOULD run if test 84 did not hang. The Feynman runner DOES produce output (it runs ~50 suites before reaching test 84). Logged to `.planning/phases/122-workflow-layer/deferred-items.md` for a Phase-84/109 housekeeping pass. Not a Phase-122 regression.

**Pre-existing: CHANGELOG.md has ~106 U+2014 em-dashes in older entries; jtbd-taxonomy.json has 7 in `one_line` content fields.** Phase 122-05's own additions are em-dash-clean (hyphens only). Sweeping the historical CHANGELOG entries is out of scope per the GSD SCOPE BOUNDARY rule (and risky -- it would mangle archived release notes); same for the jtbd-taxonomy `one_line` strings (which the plan did not touch). Logged to `deferred-items.md` for the no-em-dash housekeeping pass (alongside the existing `commands/doctor.md` item). The plan's em-dash acceptance criterion that lists `CHANGELOG.md` is interpreted as "no em-dash INTRODUCED by this plan", which holds.

**Working-tree drift at execution start (not touched by this plan).** `dashboard/graph.json`, `docs/testers/REGISTRY.md`, and an untracked `docs/testers/aniruddh-mohan/` directory were already modified / untracked in the working tree at execution start (parallel testers-hub work on `main`). NOT part of Plan 122-05 and NOT committed by it -- left as-is. Already noted in 122-02/03's deferred items.

## User Setup Required

None - no external service configuration required. (The maintainer-gated release steps -- cut the `v1.13.0-beta.11` tag, pin `~/mindrian-marketplace/.claude-plugin/marketplace.json` `source.ref`, `npm publish @mindrian_os/install` with the `@next` dist-tag -- are documented in the CHANGELOG `### Maintainer Notes` block and in the CLAUDE.md release process; they are NOT performed by this phase.)

## Known Stubs

None. `references/brain/command-triggers-schema.md` is a deliberate REMOVED tombstone (it explains why the path is empty and where the replacement lives), not a stub -- the live framework-to-command surface (`data/command-registry.json`, `lib/workflow/command-resolver.cjs`, `lib/brain/chain-recommender.cjs`, `docs/WORKFLOWS.md`) is fully functional. The `lib/hmi/jtbd-taxonomy.json:methodology_hooks` field is intentionally retained-but-marked-informational (the `methodology_hooks_note`) -- a documented design choice, not a stub. `docs/WORKFLOWS.md` describes the navigation engine's `offer_next_step` propagation of `proposeNextFramework.workflow` as a future-plan item (per 122-04) -- not a stub of this plan; the synchronous resolver/recommender path is complete.

## Next Phase Readiness
- Phase 122 (Workflow Layer) is complete. The framework-to-command mapping is generated (`data/command-registry.json` from frontmatter), CI-checked (the `--check` tripwire in the pre-commit hook + the Feynman runner + the new `workflow-layer-e2e.test.cjs`), and resolved through one door (`lib/workflow/command-resolver.cjs`). Larry never names a `/mos:` from memory; the hallucinated-command failure mode is closed; commands never enter the Brain (the e2e grep sweep + the `brain-boundary-scan` PR gate enforce it).
- **Maintainer next steps (gated, not done here):** cut the `v1.13.0-beta.11` tag, pin the marketplace `source.ref`, `npm publish @mindrian_os/install` with the `@next` dist-tag -- per the CHANGELOG `### Maintainer Notes` block. The CHANGELOG block is finalized; `package.json` / `.claude-plugin/plugin.json` are already at `1.13.0-beta.11`.
- **Deferred (out of Phase-122 scope):** the `test/84-smart-notebook-copilot.test.cjs` hang that blocks the Feynman runner (a Phase-84/109 housekeeping pass); the no-em-dash sweep over `CHANGELOG.md` + `lib/hmi/jtbd-taxonomy.json` + `commands/doctor.md`. Both logged in `deferred-items.md`.

## Self-Check: PASSED

All created files exist on disk (`docs/WORKFLOWS.md`, `lib/memory/workflow-layer-e2e.test.cjs`, `.planning/phases/122-workflow-layer/122-05-SUMMARY.md`); all 3 task commits (`a08a5db`, `4206274`, `6d634ad`) present in git history; the new e2e test is registered in `lib/memory/run-feynman-tests.cjs` `TEST_FILES[]` and `tests/run-all-122.sh` `CJS_SUITES`.

---
*Phase: 122-workflow-layer*
*Completed: 2026-05-12*
