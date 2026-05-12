---
phase: 122-workflow-layer
plan: 04
subsystem: workflow
tags: [command-resolver, chain-recommender, framework-chain-composer, navigation-engine, suggest-next, pipeline, act, autonomy-gate, canon-part-8, ui-system]

# Dependency graph
requires:
  - phase: 122-workflow-layer (plan 01)
    provides: the /mos: command frontmatter contract (kind / frameworks[] / produces / inputs / autonomous_safe on 44 commands), the Wave-0 test scaffold (tests/run-all-122.sh, the lib/ stubs registered in run-feynman-tests)
  - phase: 122-workflow-layer (plan 02)
    provides: data/command-registry.json (85 commands, framework_index, autonomous_safe), data/framework-names.json, the --check drift tripwire + pre-commit guard, lib/memory/command-registry.test.cjs (whose Canon Part 8 grep guard covers lib/workflow/ + lib/brain/)
  - phase: 122-workflow-layer (plan 03)
    provides: lib/workflow/command-resolver.cjs (commandsForFramework / frameworksForCommand / composeWorkflow / validateChainAutonomy -- the only door, reads only data/command-registry.json, never the Brain), lib/brain/chain-recommender.cjs (recommendFrameworkChain via FEEDS_INTO; framework names + enums only; FEEDS_INTO_CYPHER constant)
  - phase: 91-navigation-engine (plans 91-04, 91-08)
    provides: lib/core/framework-chain-composer.cjs (parseFrameworkChainSection / proposeNextFramework / detectCompletedFramework), lib/core/navigation-engine.cjs decide() -> offer_next_step, lib/core/offer-presenter.cjs (the "Offer: ..." line; treats a null/empty command as not-an-offer)
provides:
  - lib/core/framework-chain-composer.cjs proposeNextFramework() routed through the resolver -- the next framework's /mos: command is resolver.commandsForFramework(next)[0] (the only door), degrading to command:null when the registry has none (degrade, not fabricate); a new workflow field carries resolver.composeWorkflow([completed, next, ...up-to-3-FEEDS_INTO-successors]) as data on the proposal (engine propagation is a future plan); a new collectForwardChain() helper walks the highest-confidence FEEDS_INTO chain; mapFrameworkToCommandSlug() delegates to the resolver first, falls back to the legacy FRAMEWORK_TO_COMMAND_SLUG table, and is now exported (122-05 prunes the table). navigation-engine / offer-presenter / hooks / intent-classifier / skill-activation-router untouched.
  - scripts/suggest-next-command.cjs -- the CLI helper behind /mos:suggest-next: reads room ProblemType / active JTBD from STATE.md, recommendFrameworkChain -> composeWorkflow -> prints a step-numbered /mos: command SEQUENCE (Shape B) plus the framework chain; command-less frameworks render "(no /mos: for this -- run it manually)"; degrades to framework-only advice (still through the resolver)
  - scripts/pipeline-command.cjs -- the CLI helper behind /mos:pipeline --from-problem-type <x> / --from-framework <x>: recommendFrameworkChain -> composeWorkflow -> prints the /mos: run order; command-less steps print "no /mos: for <fw> -- run manually; continuing"; every printed command exists in the registry by construction
  - scripts/act-command.cjs -- the CLI helper behind /mos:act --chain: recommendFrameworkChain -> composeWorkflow -> validateChainAutonomy FIRST -> walks the steps and STOPS at the first non-autonomous_safe (or command-less) step with a "needs you here" F.0/E gate
  - commands/suggest-next.md / commands/pipeline.md / commands/act.md bodies updated to invoke the helpers and to state Larry never names a /mos: from memory; commands/pipeline.md argument-hint extended with --from-problem-type / --from-framework
  - skills/pws-methodology/SKILL.md ("The Resolver Is the Only Door") and skills/brain-connector/SKILL.md ("Brain-Powered Command Suggestions" -- resolver pointer + Canon Part 8 boundary) repointed at lib/workflow/command-resolver.cjs; brain-connector keeps the dead Command-node prose (122-05 deletes it) with a note that the resolver pointer supersedes it
  - lib/memory/navigation-hook-resolver.test.cjs (5 groups) + lib/memory/suggest-next-workflow.test.cjs (5 groups); both registered in lib/memory/run-feynman-tests.cjs TEST_FILES[] and tests/run-all-122.sh CJS_SUITES; lib/memory/framework-chain-composer.test.cjs Tests 12/16/18 updated for the command:null contract
affects: [122-05 skill-cleanup-docs (prunes FRAMEWORK_TO_COMMAND_SLUG to a pass-through; deletes the dead brain-connector Command-node prose; docs/WORKFLOWS.md), 91-navigation-engine (a future plan may propagate proposal.workflow into offer_next_step / shape-f1-renderer)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The resolver is the only door, end to end: framework-chain-composer.proposeNextFramework (the navigation hook), /mos:suggest-next, /mos:pipeline --from-problem-type/--from-framework, /mos:act --chain, and the pws-methodology + brain-connector skills all turn a framework into a /mos: command via lib/workflow/command-resolver.cjs (commandsForFramework / composeWorkflow); Larry never names a /mos: from memory, and the registry only ever returns registered commands so a hallucinated command (e.g. /mos:jtbd) cannot be emitted"
    - "Degrade, do not fabricate: proposeNextFramework returns command:null when the registry has no command for the next framework (the offer presenter already treats null/empty as not-an-offer); composeWorkflow yields { command:null, optional:true } steps; /mos:suggest-next prints 'run it manually'; /mos:pipeline prints 'no /mos: for <fw> -- run manually; continuing'; /mos:act --chain stops at a command-less step with the same gate as a non-autonomous_safe one"
    - "The autonomy gate made literal: /mos:act --chain calls validateChainAutonomy(workflow) before walking the steps; it runs the autonomous_safe prefix unattended and STOPS at the first step whose command is not autonomous_safe: true (or command-less) with a Shape F.0/E 'needs you here' report (the Canon Part 3 'human confirms' clause)"
    - "The surgical edit is composer-only: only lib/core/framework-chain-composer.cjs gained the require('../workflow/command-resolver.cjs'); navigation-engine.cjs / offer-presenter.cjs / hooks.json / intent-classifier.cjs / skill-activation-router.cjs are byte-identical; the workflow field on proposeNextFramework's return is data-only in this plan (the engine does not propagate it yet)"
    - "CLI helpers behind Larry-driven commands: scripts/{suggest-next,pipeline,act}-command.cjs are thin process.argv switches (mindrian-tools style) that read the room's ProblemType from STATE.md, call the recommender + resolver, and print a Shape B / Shape E render per skills/ui-system/SKILL.md; never throw to the user (always exit 0); zero network surface (the Brain query, if any, is the recommender's FEEDS_INTO traversal through the existing brain-client chokepoint, not the helper's surface)"
    - "Test-fixture frameworks must be resolver-registered to yield a non-null command: framework-chain-composer.test.cjs Tests 16/18 switched their fixture chain from SWOT Analysis -> Porter Five Forces (unregistered -> command:null) to Business Model Canvas -> Lean Canvas (registered -> /mos:lean-canvas) so the engine's offer_next_step.command stays a real /mos: string"

key-files:
  created:
    - scripts/suggest-next-command.cjs
    - scripts/pipeline-command.cjs
    - scripts/act-command.cjs
    - lib/memory/navigation-hook-resolver.test.cjs
    - lib/memory/suggest-next-workflow.test.cjs
  modified:
    - lib/core/framework-chain-composer.cjs
    - lib/memory/framework-chain-composer.test.cjs
    - lib/memory/run-feynman-tests.cjs
    - tests/run-all-122.sh
    - commands/suggest-next.md
    - commands/pipeline.md
    - commands/act.md
    - skills/pws-methodology/SKILL.md
    - skills/brain-connector/SKILL.md

key-decisions:
  - "proposeNextFramework returns command:null when the resolver has no command for the next framework (per the plan's exact swap `const command = cmds.length ? cmds[0] : null;`). The offer presenter already treats a null/empty command as not-an-offer, so the chain offer just does not surface for an unregistered framework -- a true statement, not a fabricated /mos:beautiful-question. mapFrameworkToCommandSlug() keeps a non-null fallback (resolver -> legacy table -> 'beautiful-question') for back-compat with callers that expect a slug string."
  - "Added a workflow field to proposeNextFramework's return (resolver.composeWorkflow([completed, next, ...successors via collectForwardChain up to 3 hops]) -- alongside the existing command for back-compat) and a new exported collectForwardChain() helper. The navigation engine does NOT propagate `workflow` into offer_next_step in this plan (the acceptance criterion `git diff lib/core/navigation-engine.cjs` is empty wins over the aspirational 'surfaces as offer_next_step.workflow' must-have); the data is there for a future plan / shape-f1-renderer."
  - "mapFrameworkToCommandSlug() was not exported by the original framework-chain-composer.cjs; the plan's acceptance criterion requires it exported. Added it to module.exports (alongside FRAMEWORK_TO_COMMAND_SLUG and KNOWN_FRAMEWORKS, which stay exported -- 122-05 prunes the table)."
  - "scripts/suggest-next-command.cjs / scripts/pipeline-command.cjs / scripts/act-command.cjs did not exist (the /mos: commands are Larry-driven markdown with no backing script). Created them as thin CLI helpers (deviation Rule 3: missing referenced file) -- the command .md bodies now invoke them as 'the script behind the command'. Renders via the declared body_shape per ui-system; no bespoke format. They print the resolver-composed plan; the command body runs the printed /mos: commands."
  - "framework-chain-composer.test.cjs Tests 12, 16, 18 updated for the command:null contract (Test 12: command equals commandsForFramework(next)[0] or null; unregistered -> null; asserts the workflow array; Tests 16/18: fixture chain switched to a resolver-registered pair Business Model Canvas -> Lean Canvas so the engine's offer_next_step.command stays a /mos: string; Test 18 override command switched to /mos:mullins). All 18 still pass."
  - "commands/pipeline.md: only the argument-hint frontmatter line was changed (not frameworks/kind/produces/inputs/autonomous_safe), so data/command-registry.json did not need regeneration; node scripts/build-command-registry.cjs --check stays green."

patterns-established:
  - "lib/workflow/command-resolver.cjs is the SOLE framework -> command path, now consumed by the navigation hook (framework-chain-composer), the three meta orchestrators (/mos:suggest-next, /mos:pipeline, /mos:act), and the pws-methodology + brain-connector skills; 122-05 prunes the last legacy maps and deletes the dead Command-node prose"
  - "scripts/{command}-command.cjs as the CLI-helper convention for a Larry-driven /mos: command that needs a deterministic computation (here: the resolver-composed chain) -- thin process.argv switch, reads STATE.md, calls lib/* modules, prints a ui-system body_shape, never throws, exit 0"

requirements-completed: [WORKFLOW-122-06, WORKFLOW-122-07, WORKFLOW-122-08, WORKFLOW-122-10]

# Metrics
duration: 30min
completed: 2026-05-12
---

# Phase 122 Plan 04: Route Everything Through the Resolver Summary

**The navigation hook (`framework-chain-composer.proposeNextFramework`), `/mos:suggest-next`, `/mos:pipeline --from-problem-type/--from-framework`, `/mos:act --chain`, and the `pws-methodology` + `brain-connector` skills now turn a framework into a `/mos:` command exclusively via `lib/workflow/command-resolver.cjs` (the only door) -- the composer's `proposeNextFramework` swaps `mapFrameworkToCommandSlug` for `commandsForFramework` (degrading to `command:null`, never a fabricated `/mos:`) and gains a `composeWorkflow` `workflow` field; three new CLI helpers (`scripts/{suggest-next,pipeline,act}-command.cjs`) recommend -> compose -> render (and `/mos:act --chain` `validateChainAutonomy` first, stopping at the first non-`autonomous_safe` step with a "needs you here" gate); the engine / presenter / hooks are byte-identical; two new tests (`navigation-hook-resolver.test.cjs`, `suggest-next-workflow.test.cjs`, 5 groups each) are registered and `bash tests/run-all-122.sh` exits 0.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-05-12T10:21Z (approx -- after the 122-03 metadata commit)
- **Completed:** 2026-05-12T10:35Z
- **Tasks:** 3 completed
- **Files modified:** 14 (5 created + 9 modified)

## Accomplishments
- **The surgical edit (Task 1).** `lib/core/framework-chain-composer.cjs` `proposeNextFramework()` now resolves the next framework's `/mos:` command via `require('../workflow/command-resolver.cjs').commandsForFramework(top.to)` -- the SOLE deterministic framework -> command path, reading only the generated `data/command-registry.json`, never the Brain. When the registry has no command for that framework, `command` degrades to `null` ("no /mos: for [framework] yet" -- degrade, not fabricate; the offer presenter already treats a null/empty command as not-an-offer). The return struct gains a `workflow` field -- `resolver.composeWorkflow([completedFramework, next, ...up-to-3-FEEDS_INTO-successors])` (a new exported `collectForwardChain()` helper walks the highest-confidence chain) -- alongside the existing `command` for back-compat; the navigation engine does not propagate `workflow` into `offer_next_step` in this plan (the data is there for a future plan / `shape-f1-renderer`). `mapFrameworkToCommandSlug()` delegates to the resolver first, falls back to the legacy `FRAMEWORK_TO_COMMAND_SLUG` table for names the registry does not know yet, and is now exported (122-05 prunes the table). `navigation-engine.cjs` / `offer-presenter.cjs` / `hooks/hooks.json` / `intent-classifier.cjs` / `skill-activation-router.cjs` are byte-identical. New `lib/memory/navigation-hook-resolver.test.cjs` (5 assertion groups) asserts the require is in place, `command === commandsForFramework(next)[0]` (or `null`), the `workflow` array shape (1-indexed, in order, multi-hop), the `mapFrameworkToCommandSlug` delegation + the preserved exports, and that the engine source did NOT gain the require.
- **The orchestrators wired (Task 2).** Three new CLI helpers (the scripts the Larry-driven `/mos:` commands invoke): `scripts/suggest-next-command.cjs` reads the room's ProblemType / active JTBD from `STATE.md`, calls `recommendFrameworkChain` (a FEEDS_INTO traversal -- framework names + problem-type enums only) -> `composeWorkflow` (the resolver) -> prints a step-numbered `/mos:` command SEQUENCE plus the framework chain (Shape B per ui-system); command-less frameworks render "(no /mos: for this -- run it manually)"; with no ProblemType it degrades to framework-only advice (still through the resolver). `scripts/pipeline-command.cjs` parses `--from-problem-type <x>` / `--from-framework <x>` (and falls back to the room's ProblemType), recommend -> compose -> prints the `/mos:` run order (command-less steps print "no /mos: for <fw> -- run manually; continuing"); every printed command exists in the registry by construction (the resolver only returns registered commands). `scripts/act-command.cjs` `--chain` mode: recommend -> compose -> `validateChainAutonomy(workflow)` FIRST -> walks the steps and STOPS at the first step whose command is not `autonomous_safe: true` (or is command-less) with a Shape F.0/E "needs you here" gate (`[continue]` / `[stop]`); the `autonomous_safe` prefix is listed as "would run". `commands/suggest-next.md` / `commands/pipeline.md` (+ `argument-hint`) / `commands/act.md` bodies now invoke the helpers and state Larry never names a `/mos:` from memory.
- **The skills repointed + the integration test (Task 3).** `skills/pws-methodology/SKILL.md` "The Resolver Is the Only Door" -- framework -> command routing goes through `lib/workflow/command-resolver.cjs` (the generated `data/command-registry.json`, validated against the Brain's framework names); Larry never names a `/mos:` from memory; degrade-not-fabricate; `references/methodology/index.md` is a human-readable mirror, not the source. `skills/brain-connector/SKILL.md` "Brain-Powered Command Suggestions" -- now leads with `command-resolver.commandsForFramework` / `composeWorkflow` + the Canon Part 8 boundary ("Commands NEVER live in the Brain ... `recommendFrameworkChain` carries framework names + problem-type enums only, never a command string, never user content"); the dead "Brain has Command nodes / FOLLOWS_FRAMEWORK -> Command" prose is kept (122-05 deletes it) with an explicit note that the resolver pointer supersedes it. New `lib/memory/suggest-next-workflow.test.cjs` (5 assertion groups): a hermetic fixture room (a tmp dir + `STATE.md` with `Problem Type: ill-defined`) -> `scripts/suggest-next-command.cjs --room <fixture>` prints a step-numbered command sequence and every emitted `/mos:` is in `data/command-registry.json` (no hallucinated command -- in particular not `/mos:jtbd`); `composeWorkflow(recommendFrameworkChain(...))` only ever yields registered commands; a chain through `/mos:hat-briefing` -> `validateChainAutonomy` flags it as a blocker (step 2); `/mos:pipeline --from-problem-type ill-defined` prints a run order of registered commands; `/mos:act --chain --from-framework "Six Thinking Hats"` renders the `[GATE]` and stops at `/mos:hat-briefing`. Both new tests registered in `lib/memory/run-feynman-tests.cjs` `TEST_FILES[]` and `tests/run-all-122.sh` `CJS_SUITES`; `bash tests/run-all-122.sh` exits 0 (4/4).

## Task Commits

Each task was committed atomically (with `--no-verify` per the parallel-execution note):

1. **Task 1: The surgical edit -- route framework-chain-composer.proposeNextFramework through the resolver + add the composeWorkflow path** - `91660cd` (feat) -- includes `lib/core/framework-chain-composer.cjs`, the new `lib/memory/navigation-hook-resolver.test.cjs`, the `framework-chain-composer.test.cjs` Tests 12/16/18 updates, the `run-feynman-tests.cjs` + `run-all-122.sh` registrations
2. **Task 2: Wire /mos:suggest-next, /mos:pipeline --from-problem-type/--from-framework, /mos:act --chain through the resolver/recommender** - `c1dc0f4` (feat) -- the three new `scripts/*-command.cjs` helpers + the `commands/*.md` body updates
3. **Task 3: Skill prose -- point pws-methodology and brain-connector at the resolver + the suggest-next integration test** - `8c1b29a` (feat) -- the two `skills/*/SKILL.md` updates + the new `lib/memory/suggest-next-workflow.test.cjs`

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified

### Created
- `scripts/suggest-next-command.cjs` - the CLI helper behind `/mos:suggest-next`: reads room ProblemType / active JTBD, recommendFrameworkChain -> composeWorkflow -> renders a resolver-composed `/mos:` command SEQUENCE (Shape B); command-less frameworks render "run it manually"; degrades to framework-only advice through the resolver; never throws (exit 0)
- `scripts/pipeline-command.cjs` - the CLI helper behind `/mos:pipeline --from-problem-type <x>` / `--from-framework <x>`: recommendFrameworkChain -> composeWorkflow -> prints the `/mos:` run order (command-less steps print "no /mos: for <fw> -- run manually; continuing"); every printed command is registered
- `scripts/act-command.cjs` - the CLI helper behind `/mos:act --chain`: recommendFrameworkChain -> composeWorkflow -> `validateChainAutonomy` FIRST -> walks the steps and STOPS at the first non-`autonomous_safe` (or command-less) step with a Shape F.0/E "needs you here" gate
- `lib/memory/navigation-hook-resolver.test.cjs` - 5-assertion-group suite: the surgical edit is in place; `proposeNextFramework.command === commandsForFramework(next)[0]` (or null); the `workflow` array shape (1-indexed, in order, multi-hop); `mapFrameworkToCommandSlug` delegation + preserved exports; the engine source did NOT gain the require
- `lib/memory/suggest-next-workflow.test.cjs` - 5-assertion-group integration suite: fixture room with a ProblemType -> command sequence with every `/mos:` registered (no hallucination); `composeWorkflow(recommendFrameworkChain(...))` -> registered commands only; a chain through `/mos:hat-briefing` -> `validateChainAutonomy` flags it; `/mos:pipeline --from-problem-type` and `/mos:act --chain` exercised end to end

### Modified
- `lib/core/framework-chain-composer.cjs` - `proposeNextFramework()` routed through the resolver (command:null degrade) + `workflow` field + `collectForwardChain()` helper; `mapFrameworkToCommandSlug()` delegates to the resolver and is now exported; header docs updated; `navigation-engine.cjs` / `offer-presenter.cjs` / hooks untouched
- `lib/memory/framework-chain-composer.test.cjs` - Tests 12 (command from the resolver, or null; workflow array shape; unregistered -> null), 16 + 18 (fixture chain switched to a resolver-registered pair Business Model Canvas -> Lean Canvas; Test 18 override command -> `/mos:mullins`); all 18 still pass
- `lib/memory/run-feynman-tests.cjs` - appended `navigation-hook-resolver.test.cjs` and `suggest-next-workflow.test.cjs` to `TEST_FILES[]` (one comment block)
- `tests/run-all-122.sh` - `CJS_SUITES` gained `../lib/memory/navigation-hook-resolver.test.cjs` and `../lib/memory/suggest-next-workflow.test.cjs`; header updated
- `commands/suggest-next.md` - body now invokes `scripts/suggest-next-command.cjs`; "The resolver is the only door" section; Larry never names a `/mos:` from memory; render in Shape B
- `commands/pipeline.md` - `argument-hint` extended with `--from-problem-type <x>` / `--from-framework <x>`; new "Brain-Derived Chains" section invoking `scripts/pipeline-command.cjs`; Chain Selection updated; only the `argument-hint` frontmatter line changed (registry not regenerated; `--check` green)
- `commands/act.md` - `--chain` mode body now invokes `scripts/act-command.cjs`; the autonomy gate (`validateChainAutonomy` first, stop at the first non-`autonomous_safe` / command-less step with a "needs you here" gate) documented
- `skills/pws-methodology/SKILL.md` - "The Resolver Is the Only Door" -- framework -> command routing through `lib/workflow/command-resolver.cjs` / the generated registry; Larry never names a `/mos:` from memory; degrade-not-fabricate; index.md is a mirror
- `skills/brain-connector/SKILL.md` - "Brain-Powered Command Suggestions" -- `command-resolver.commandsForFramework` / `composeWorkflow` + the Canon Part 8 boundary; the dead Command-node prose kept (122-05 deletes it) with a supersession note

## Decisions Made
See `key-decisions` in the frontmatter. The load-bearing ones:
1. `proposeNextFramework` returns `command:null` for an unregistered next framework (per the plan's exact swap) -- the presenter treats it as not-an-offer; `mapFrameworkToCommandSlug` keeps a non-null fallback for back-compat.
2. The `workflow` field on `proposeNextFramework`'s return is data-only in this plan -- the navigation engine is not touched (the `git diff` acceptance criterion wins over the aspirational "surfaces as offer_next_step.workflow" must-have); a future plan / `shape-f1-renderer` consumes it.
3. The three `scripts/*-command.cjs` helpers did not exist; created as thin CLI helpers (deviation Rule 3) -- the command `.md` bodies now invoke them.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created scripts/suggest-next-command.cjs / scripts/pipeline-command.cjs / scripts/act-command.cjs (the plan references them as existing "the script behind the command" but they did not exist)**
- **Found during:** Task 2 (wiring the orchestrators)
- **Issue:** The plan's `files_modified` lists `scripts/suggest-next-command.cjs`, `scripts/pipeline-command.cjs`, `scripts/act-command.cjs` as "modified" and the interfaces section calls `scripts/suggest-next-command.cjs` "the script behind `commands/suggest-next.md`" -- but no such scripts existed; the `/mos:suggest-next` / `/mos:pipeline` / `/mos:act` commands are Larry-driven markdown with no backing CJS script. The plan's acceptance criteria (`grep -q "command-resolver" scripts/suggest-next-command.cjs`, `node -c scripts/suggest-next-command.cjs`, etc.) require those files to exist.
- **Fix:** Created the three scripts as thin CLI helpers (pure CJS, node builtins only, process.argv switch in the mindrian-tools style): each reads the room's ProblemType / active JTBD from `STATE.md` (or takes explicit `--problem-type` / `--from-framework` flags), calls `lib/brain/chain-recommender.cjs recommendFrameworkChain` -> `lib/workflow/command-resolver.cjs composeWorkflow` (and `validateChainAutonomy` for `act --chain`), and prints a `ui-system` `body_shape` render (Shape B for suggest-next, Shape E / F.0 for act --chain). They never throw to the user (always exit 0) and have zero network surface. The `commands/*.md` bodies now invoke them as "the script behind the command"; the command body runs the printed `/mos:` commands.
- **Files modified:** scripts/suggest-next-command.cjs (new), scripts/pipeline-command.cjs (new), scripts/act-command.cjs (new), commands/suggest-next.md, commands/pipeline.md, commands/act.md
- **Verification:** `node -c` clean on all three; `grep -q "command-resolver" scripts/suggest-next-command.cjs`, `grep -q "chain-recommender" scripts/suggest-next-command.cjs`, `grep -q "from-problem-type" scripts/pipeline-command.cjs`, `grep -q "chain-recommender" scripts/pipeline-command.cjs`, `grep -q "validateChainAutonomy" scripts/act-command.cjs`, `grep -q "from-problem-type" commands/pipeline.md` all succeed; `lib/memory/suggest-next-workflow.test.cjs` exercises all three end to end and passes; `bash tests/run-all-122.sh` exits 0.
- **Committed in:** `c1dc0f4` (Task 2 commit)

**2. [Rule 3 - Blocking] Updated lib/memory/framework-chain-composer.test.cjs Tests 12, 16, 18 for the new command:null contract**
- **Found during:** Task 1 (running the existing composer test after the surgical edit)
- **Issue:** Tests 12, 16, 18 asserted that `proposeNextFramework(...).command` (and the engine's `offer_next_step.command`) is always a string starting with `/mos:`. The plan's exact swap makes `command` degrade to `null` when the registry has no command for the next framework -- and the test fixtures use `Porter Five Forces` / `A Wholly Imaginary Framework`, which are not resolver-registered, so they now yield `command:null`. Test 12's `unknown.command.indexOf('/mos:')` threw on null; Tests 16/18 (the engine integration) failed because `offer_next_step.command` was null.
- **Fix:** Test 12 -- rewrote to assert `command === commandsForFramework(next)[0]` (or `null`), that `Lean Canvas` (registered) yields a `/mos:` string, that the `workflow` array is composeWorkflow-shaped, and that an unregistered framework yields `command:null` and an all-null `workflow` (degrade, not fabricate). Tests 16/18 -- switched the fixture chain from `SWOT Analysis FEEDS_INTO Porter Five Forces` (unregistered next) to `Business Model Canvas FEEDS_INTO Lean Canvas` (`Business Model Canvas` is in `KNOWN_FRAMEWORKS` so it is detectable from a governing thought; `Lean Canvas` resolves to `/mos:lean-canvas`), updated the governing-thought strings, and switched Test 18's override command from `/mos:lean-canvas` (which would have been the chain offer) to `/mos:mullins` (genuinely different). All 18 tests pass.
- **Files modified:** lib/memory/framework-chain-composer.test.cjs
- **Verification:** `node lib/memory/framework-chain-composer.test.cjs` -> 18/18 passed.
- **Committed in:** `91660cd` (Task 1 commit)

**3. [Rule 2 - Missing critical] Exported mapFrameworkToCommandSlug from framework-chain-composer.cjs (it was not in module.exports)**
- **Found during:** Task 1 (the plan's acceptance criterion `typeof c.mapFrameworkToCommandSlug==='function'` failed)
- **Issue:** The original `framework-chain-composer.cjs` defined `mapFrameworkToCommandSlug` but did not export it; the plan's interfaces section says it should "stay EXPORTED for back-compat" and the acceptance criterion requires `typeof c.mapFrameworkToCommandSlug==='function'`.
- **Fix:** Added `mapFrameworkToCommandSlug` (and the new `collectForwardChain`) to `module.exports` alongside the already-exported `FRAMEWORK_TO_COMMAND_SLUG` and `KNOWN_FRAMEWORKS` (122-05 prunes the table).
- **Files modified:** lib/core/framework-chain-composer.cjs
- **Verification:** `node -e "const c=require('./lib/core/framework-chain-composer.cjs'); process.exit(typeof c.proposeNextFramework==='function' && typeof c.mapFrameworkToCommandSlug==='function' && c.FRAMEWORK_TO_COMMAND_SLUG ? 0 : 1)"` -> exit 0.
- **Committed in:** `91660cd` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 missing critical)
**Impact on plan:** All three were necessary to satisfy the plan's literal acceptance criteria and keep the existing tests green; none changed runtime behavior beyond what the plan deliberately specified (the `command:null` contract) and none added scope -- the CLI helpers are exactly what the plan's interfaces section describes ("the script behind the command"), the test updates track the contract the plan changes, and the export was required by the plan. No `navigation-engine.cjs` / `offer-presenter.cjs` / `hooks.json` / `intent-classifier.cjs` change (verified `git diff` empty).

## Issues Encountered

**Pre-existing: the full Feynman suite still cannot run to completion (out of scope -- already logged by 122-02/122-03).** `test/84-smart-notebook-copilot.test.cjs` (TEST_FILES line ~59 in `lib/memory/run-feynman-tests.cjs`, a Phase-84 file NOT touched by Phase 122) hangs when run standalone, which (because `run-feynman-tests.cjs` iterates with a blocking `spawnSync` and no per-test timeout) prevents the runner from ever reaching the registered Phase-122 suites. All five Phase-122-04-relevant suites are verified GREEN directly (`node lib/memory/navigation-hook-resolver.test.cjs`, `node lib/memory/suggest-next-workflow.test.cjs`, `node lib/memory/framework-chain-composer.test.cjs`, `node lib/workflow/command-resolver.test.cjs`, `node lib/memory/chain-recommender.test.cjs` -> all exit 0) and via the scoped runner (`bash tests/run-all-122.sh` -> exit 0, 4/4); they ARE registered in the Feynman `TEST_FILES` array, so they WOULD run if test 84 did not hang. Already logged to `.planning/phases/122-workflow-layer/deferred-items.md` (Phase-84/109 housekeeping pass). Not a Phase-122 regression.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 122-05 (the last in the phase): prune `FRAMEWORK_TO_COMMAND_SLUG` to a pass-through in `lib/core/framework-chain-composer.cjs` (the resolver delegation is already in place; the table is now only a fallback for not-yet-registered names); delete the dead "Brain has Command nodes / FOLLOWS_FRAMEWORK -> Command" prose in `skills/brain-connector/SKILL.md` (the resolver pointer + Canon Part 8 boundary are already alongside it); write `docs/WORKFLOWS.md` (the Brain <-> registry <-> Larry join + the Canon Part 8 boundary) and cross-link from `docs/THE-BRAIN.md` / `docs/CANON-PHASE-MAP.md`; the e2e test + Canon Part 8 sweep.
- A future Phase 91-family plan may propagate `proposeNextFramework`'s `workflow` field into `offer_next_step` so `shape-f1-renderer` can render the multi-step chain as an F-selector -- the data is there now; the engine wiring is the missing piece.

## Self-Check: PASSED

All created files exist on disk (`scripts/suggest-next-command.cjs`, `scripts/pipeline-command.cjs`, `scripts/act-command.cjs`, `lib/memory/navigation-hook-resolver.test.cjs`, `lib/memory/suggest-next-workflow.test.cjs`); all 3 task commits (`91660cd`, `c1dc0f4`, `8c1b29a`) present in git history.

---
*Phase: 122-workflow-layer*
*Completed: 2026-05-12*
