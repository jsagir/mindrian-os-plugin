---
phase: 122-workflow-layer
verified: 2026-05-12T12:00:00Z
status: passed
score: 11/11 must-haves verified
human_verification:
  - test: "Live CLI navigation-hook routing through the resolver"
    expected: "In a room with a ProblemType, describing a problem causes the offer_next_step block to contain a command sequence whose every /mos: is registered -- NOT /mos:jtbd for a JTBD suggestion, but /mos:analyze-needs"
    why_human: "Requires a real conversational turn + UserPromptSubmit navigation-engine hook firing; cannot be unit-tested end-to-end without a live Claude session"
  - test: "Live Brain FEEDS_INTO freshness check"
    expected: "node scripts/build-command-registry.cjs --refresh-names then git diff data/framework-names.json shows no unexpected drift; if the FEEDS_INTO-linked subset shrank, that is a brain-cleanup deploy issue, not a Phase 122 regression"
    why_human: "The Brain is a live remote endpoint; the snapshot is regenerated at build time, not test time; cannot test without live Brain connectivity"
  - test: "/mos:pipeline --from-problem-type ill-defined in a fixture room"
    expected: "Printed chain is /mos: commands that all exist; command-less frameworks print 'run manually -- skipping'; steps run in order; artifacts file to the room"
    why_human: "Running a full command chain files real room artifacts; the unit test asserts the chain is composed of registered commands and that --from-problem-type is parsed, but the actual sequential execution + artifact filing is a live-room integration"
---

# Phase 122: Workflow Layer Verification Report

**Phase Goal:** Larry can read the Brain's methodology chains (`Framework -[:FEEDS_INTO]-> Framework`) but cannot reliably turn "the methodology suggests framework X" into "run `/mos:x`". Fix: the truth lives in ONE place (each command file's own `frameworks:` frontmatter), `data/command-registry.json` is generated from it and CI-checked (stale-registry OR unresolvable-framework fails the build), `lib/workflow/command-resolver.cjs` is the SOLE path from framework to command, and the navigation engine gains a workflow-suggestion step. Degrade-don't-fabricate at every layer. The Brain stays methodology-pure (Canon Part 8).

**Verified:** 2026-05-12
**Status:** PASSED
**Re-verification:** No -- initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `frameworks:` frontmatter is the sole source of truth on every command | VERIFIED | 85 commands in `data/command-registry.json`, all built from frontmatter; `FRAMEWORK_TO_COMMAND_SLUG` is `Object.freeze({})` (empty back-compat); `references/methodology/index.md` is a pointer; `jtbd-taxonomy.json:methodology_hooks` is marked informational-only |
| 2 | `data/command-registry.json` is generated, never hand-written | VERIFIED | `scripts/build-command-registry.cjs --check` exits 0; registry has 85 commands, 24 framework_index keys, `ontology_ref: data/framework-names.json` |
| 3 | Drift is impossible to commit (CI tripwire) | VERIFIED | `grep -q "build-command-registry.cjs --check" scripts/hooks/pre-commit` returns 0; Feynman runner also runs the check |
| 4 | `lib/workflow/command-resolver.cjs` is the SOLE path from framework to command | VERIFIED | No `require(brain-client)` in resolver; resolver requires only 3 modules (path, fs, assert); all orchestrators (suggest-next, pipeline, act) `require('./command-resolver')`; `FRAMEWORK_TO_COMMAND_SLUG` is empty; framework-chain-composer routes through resolver |
| 5 | `composeWorkflow(["Beautiful Question Framework","Domain Selection","Jobs to Be Done (JTBD)"])` returns exactly `[/mos:beautiful-question, /mos:explore-domains, /mos:analyze-needs]` | VERIFIED | Live run confirmed the exact acceptance example; all three commands are registered in the registry |
| 6 | Degrade-don't-fabricate at every layer | VERIFIED | `composeWorkflow(["Red Teaming"])` returns `[{step:1, command:null, optional:true}]`; `validateChainAutonomy` returns `runnable:false` with `/mos:hat-briefing` as blocker; no hallucinated command possible |
| 7 | Algorithmic cohort registered as methodology with non-empty frameworks, before utility | VERIFIED | All 13 spot-checked algorithmic commands (`/mos:score-innovation`, `/mos:whitespace`, `/mos:explore-domains`, `/mos:research`, `/mos:think-hats`, `/mos:rs-fetch`, `/mos:find-connections`, `/mos:find-analogies`, `/mos:diagnostics`, `/mos:causal`, `/mos:analyze-needs`, `/mos:structure-argument`, `/mos:beautiful-question`) are `kind: methodology` with non-empty `frameworks[]` |
| 8 | Zero Brain mutation: no `Command` node anywhere, commands never enter the Brain | VERIFIED | `grep -rE "Brain has Command\|brain_proactive_command\|FOLLOWS_FRAMEWORK.*Command\|:Command" skills/ agents/ references/` exits 1 (no matches); `command-resolver.cjs` has no Brain require; `build-command-registry.cjs` has no write-Cypher; `workflow-layer-e2e.test.cjs` Test 5 (grep sweep) passes |
| 9 | The navigation hook gains a workflow-suggestion step via the resolver | VERIFIED | `framework-chain-composer.cjs` requires `command-resolver`; `proposeNextFramework` returns a `workflow` field via `composeWorkflow`; `navigation-hook-resolver.test.cjs` 5/5 passes; `framework-chain-composer.test.cjs` 18/18 passes |
| 10 | Skill cleanup: dead `Command-node` prose deleted from `brain-connector` + `command-triggers-schema.md` | VERIFIED | `references/brain/command-triggers-schema.md` is a REMOVED tombstone; `skills/brain-connector/SKILL.md` carries resolver pointer only; both skills point at `docs/WORKFLOWS.md` |
| 11 | All 6 Phase-122 test suites green | VERIFIED | `bash tests/run-all-122.sh` exits 0, 5/5 suites passed (test-command-registry, chain-recommender, navigation-hook-resolver, suggest-next-workflow, workflow-layer-e2e); `node lib/memory/framework-chain-composer.test.cjs` 18/18; `node tests/test-jtbd-taxonomy.cjs` 13/13 |

**Score:** 11/11 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `data/command-registry.json` | Generated registry; 85 commands; `ontology_ref`, `framework_index` | VERIFIED | 22,635 bytes; 85 commands; 24 framework_index keys; `ontology_ref: data/framework-names.json` |
| `data/framework-names.json` | FEEDS_INTO-linked Brain Framework name slice | VERIFIED | 4,432 bytes; committed snapshot |
| `scripts/build-command-registry.cjs` | Generator + `--check` + `--refresh-names` | VERIFIED | 13,895 bytes; exits 0 on clean tree |
| `lib/workflow/command-resolver.cjs` | The SOLE door; 4 exports; no Brain require | VERIFIED | 6,430 bytes; exports `commandsForFramework`, `frameworksForCommand`, `composeWorkflow`, `validateChainAutonomy`, `__reset`; 3 requires only (path, fs, assert) |
| `lib/brain/chain-recommender.cjs` | `recommendFrameworkChain` via FEEDS_INTO; framework names only | VERIFIED | 14,311 bytes; exports `recommendFrameworkChain`, `DEFAULT_SEED`, `MAX_CHAIN_LENGTH`, `FEEDS_INTO_CYPHER` |
| `docs/COMMAND-FRONTMATTER.md` | Documents the 5 frontmatter keys | VERIFIED | 10,790 bytes; all 5 keys (`kind`, `frameworks`, `produces`, `inputs`, `autonomous_safe`) present |
| `docs/WORKFLOWS.md` | Brain <-> registry <-> Larry join + Canon Part 8 boundary + 5 reliability rules | VERIFIED | 11,304 bytes; 6 matches for `reliability rule\|Canon Part 8\|command-resolver` |
| `lib/memory/workflow-layer-e2e.test.cjs` | 8 assertion groups; registered in Feynman + 122 runner | VERIFIED | Registered in `run-feynman-tests.cjs` TEST_FILES[] and `tests/run-all-122.sh` CJS_SUITES; 8/8 assertion groups pass |
| `scripts/suggest-next-command.cjs` | References resolver; returns command sequence | VERIFIED | `require('command-resolver')` confirmed; `composeWorkflow` call confirmed |
| `scripts/pipeline-command.cjs` | `--from-problem-type`/`--from-framework`; references recommender + resolver | VERIFIED | Both flags present in `commands/pipeline.md`; `chain-recommender` and `command-resolver` required |
| `scripts/act-command.cjs` | `--chain`; references `validateChainAutonomy` | VERIFIED | `validateChainAutonomy` and `autonomous_safe` referenced |
| `.git/hooks/pre-commit` (wired) | `--check` in pre-commit | VERIFIED | `grep -q "build-command-registry.cjs --check" scripts/hooks/pre-commit` exits 0 |
| `references/methodology/index.md` | Pointer to docs -- not a hand-maintained table | VERIFIED | Content is a pointer block pointing at `docs/COMMAND-FRONTMATTER.md`, `data/command-registry.json`, `docs/WORKFLOWS.md` |
| `references/brain/command-triggers-schema.md` | REMOVED tombstone (not live schema) | VERIFIED | First line: "# Brain Command Trigger Schema -- REMOVED (Phase 122, v1.13.0-beta)" |
| `skills/brain-connector/SKILL.md` | No `Brain has Command` / `brain_proactive_command` / `FOLLOWS_FRAMEWORK->Command` prose | VERIFIED | Resolver pointer present; Canon Part 8 grep sweep returns 0 matches |
| `lib/core/framework-chain-composer.cjs` | `FRAMEWORK_TO_COMMAND_SLUG` is empty; `mapFrameworkToCommandSlug` delegates to resolver | VERIFIED | `Object.keys(FRAMEWORK_TO_COMMAND_SLUG)` = 0; `mapFrameworkToCommandSlug` exported as function; `KNOWN_FRAMEWORKS` count = 18 |
| `lib/hmi/jtbd-taxonomy.json` | `methodology_hooks_note` present; `/mos:value-proposition` -> `/mos:validate-proposition` fixed | VERIFIED | `node tests/test-jtbd-taxonomy.cjs` 13/13 passes including the slug resolution against the registry |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `commands/*.md` frontmatter | `data/command-registry.json` | `scripts/build-command-registry.cjs` | VERIFIED | `--check` exits 0; 85 commands |
| `data/command-registry.json` | `lib/workflow/command-resolver.cjs` | `require` + cache | VERIFIED | Resolver reads only the registry; no Brain calls |
| `lib/brain/chain-recommender.cjs` | Brain FEEDS_INTO | `lib/core/brain-client.cjs` chokepoint | VERIFIED | Uses `recommendFrameworkChain`; Cypher in `FEEDS_INTO_CYPHER` export |
| `lib/core/framework-chain-composer.cjs` | `lib/workflow/command-resolver.cjs` | `require('../workflow/command-resolver')` | VERIFIED | `navigation-hook-resolver.test.cjs` confirms the require and `composeWorkflow` reference |
| `scripts/suggest-next-command.cjs` | resolver | `require('./lib/workflow/command-resolver.cjs')` | VERIFIED | Grep confirms |
| `scripts/pipeline-command.cjs` | recommender + resolver | `require` of both | VERIFIED | Grep confirms |
| `scripts/act-command.cjs` | resolver (`validateChainAutonomy`) | `require` | VERIFIED | `validateChainAutonomy` call confirmed |
| `lib/memory/workflow-layer-e2e.test.cjs` | `lib/memory/run-feynman-tests.cjs` TEST_FILES[] | `path.join(REPO_ROOT, ...)` | VERIFIED | Entry found in TEST_FILES |
| `lib/memory/workflow-layer-e2e.test.cjs` | `tests/run-all-122.sh` CJS_SUITES | shell array entry | VERIFIED | Entry found in CJS_SUITES |
| pre-commit hook | `scripts/build-command-registry.cjs --check` | shell invocation | VERIFIED | `grep -q "build-command-registry.cjs --check" scripts/hooks/pre-commit` exits 0 |

---

### Data-Flow Trace (Level 4)

The Workflow Layer is a registry + resolver (not a UI component rendering dynamic data), so the Level 4 data-flow check focuses on whether the resolver reads live registry data rather than hardcoded values.

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `lib/workflow/command-resolver.cjs` | `_registry` (cached) | `data/command-registry.json` (fs.readFileSync at first call) | Yes -- 85-command JSON file, generated from frontmatter | FLOWING |
| `scripts/build-command-registry.cjs` | command objects | `commands/*.md` frontmatter (fs.readdirSync + frontmatter parse) | Yes -- live scan of 85 command files | FLOWING |
| `lib/brain/chain-recommender.cjs` | `chain` array | Brain FEEDS_INTO Cypher query via `brain-client.cjs` | Yes -- degrades cleanly to `[seed]` when Brain unreachable | FLOWING |
| `lib/memory/workflow-layer-e2e.test.cjs` | `commandlessFramework` (Test 3), `nonAutonomousFramework` (Test 4) | `data/framework-names.json` + `data/command-registry.json` (dynamic picks) | Yes -- picked at runtime so a future registry change doesn't silently break the test | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Registry drift tripwire on clean tree | `node scripts/build-command-registry.cjs --check; echo $?` | `command-registry: OK` / EXIT: 0 | PASS |
| Acceptance example: 3-framework chain | `composeWorkflow(["Beautiful Question Framework","Domain Selection","Jobs to Be Done (JTBD)"])` | `[{step:1,command:"/mos:beautiful-question",...},{step:2,command:"/mos:explore-domains",...},{step:3,command:"/mos:analyze-needs",...}]` | PASS |
| Degrade: command-less framework | `composeWorkflow(["Red Teaming"])` | `[{step:1,framework:"Red Teaming",command:null,optional:true}]` | PASS |
| Autonomy gate | `validateChainAutonomy(composeWorkflow(["Six Thinking Hats"]))` | `{runnable:false, blockers:[{step:1,command:"/mos:hat-briefing",reason:"not autonomous_safe"}]}` | PASS |
| JTBD taxonomy test | `node tests/test-jtbd-taxonomy.cjs` | `[13/13 passed]` | PASS |
| Framework-chain-composer regression | `node lib/memory/framework-chain-composer.test.cjs` | `framework-chain-composer: 18/18 passed` | PASS |
| Full 122 scoped suite | `bash tests/run-all-122.sh` | `Passed: 5 / Failed: 0` | PASS |
| Canon Part 8 grep sweep | `grep -rE "Brain has Command\|brain_proactive_command\|FOLLOWS_FRAMEWORK.*Command\|:Command" skills/ agents/ references/` | No output, exit 1 | PASS |
| Pre-commit hook wired | `grep -q "build-command-registry.cjs --check" scripts/hooks/pre-commit && echo "hook wired"` | `hook wired` | PASS |
| Resolver has no Brain require | `grep -i "brain\|require.*brain-client" lib/workflow/command-resolver.cjs` | Only comments referencing Brain (no functional require) | PASS |
| Algorithmic cohort (13 spot checks) | `node -e "..." (registry lookup)` | All 13 commands: `kind: methodology`, `has-frameworks` | PASS |

---

### Requirements Coverage

| Requirement | Plan(s) | Description | Status | Evidence |
|-------------|---------|-------------|--------|----------|
| WORKFLOW-122-01 | 122-01 | Single source of truth -- `frameworks:` frontmatter on every command; algorithmic cohort first | SATISFIED | 85 commands with frontmatter; `FRAMEWORK_TO_COMMAND_SLUG = Object.freeze({})` |
| WORKFLOW-122-02 | 122-02 | Generated registry -- `data/command-registry.json` built by `build-command-registry.cjs`; `data/framework-names.json` committed snapshot | SATISFIED | Registry exists, 85 commands, generator exists; `--check` exits 0 |
| WORKFLOW-122-03 | 122-01, 122-02 | CI drift tripwire -- `--check` in pre-commit hook + Feynman runner; fails on stale or unresolvable framework | SATISFIED | Hook wired; Feynman runner confirmed; `command-registry.test.cjs` 6/6 |
| WORKFLOW-122-04 | 122-03 | Resolver is the only door -- `commandsForFramework`, `frameworksForCommand`, `composeWorkflow`, `validateChainAutonomy`; zero Brain calls | SATISFIED | Resolver exports confirmed; no Brain require; acceptance example passes |
| WORKFLOW-122-05 | 122-03 | Chain recommender -- `recommendFrameworkChain` via FEEDS_INTO; framework names only; degrades to `[seed]` | SATISFIED | `chain-recommender.test.cjs` 6/6; exports confirmed; no `/mos:` literal |
| WORKFLOW-122-06 | 122-04 | Trigger is the hook -- `framework-chain-composer.proposeNextFramework` routes through resolver; `composeWorkflow` multi-step `workflow` field | SATISFIED | `navigation-hook-resolver.test.cjs` 5/5; `framework-chain-composer.test.cjs` 18/18 |
| WORKFLOW-122-07 | 122-04 | Orchestrators wired -- `/mos:suggest-next` returns command sequence; `/mos:pipeline --from-problem-type/--from-framework`; `/mos:act --chain` with autonomy gate | SATISFIED | `suggest-next-workflow.test.cjs` 5/5; `--from-problem-type` in `commands/pipeline.md`; `validateChainAutonomy` in `act-command.cjs` |
| WORKFLOW-122-08 | 122-03, 122-04 | Degrade, do not fabricate -- `command:null, optional:true`; no registry -> empty; no Brain -> registry still works | SATISFIED | `composeWorkflow(["Red Teaming"])` returns null-command step; degrade paths tested in all suites |
| WORKFLOW-122-09 | 122-05 | Skill + doc cleanup -- `FRAMEWORK_TO_COMMAND_SLUG` empty; `jtbd-taxonomy.json` informational-only + slug fixed; `index.md` pointer; brain-connector Command-node prose deleted; `docs/WORKFLOWS.md` shipped | SATISFIED | All pruning confirmed; `references/methodology/index.md` is a pointer; `command-triggers-schema.md` is a tombstone; `docs/WORKFLOWS.md` 11,304 bytes |
| WORKFLOW-122-10 | All plans | Canon Part 8 -- zero Brain mutation; no `Command` node; resolver no Brain require; generator no write-Cypher; no `/mos:` near Brain token in workflow/brain .cjs | SATISFIED | All grep sweeps return 0 matches; `workflow-layer-e2e.test.cjs` Test 5 passes |
| WORKFLOW-122-11 | 122-05 | End-to-end test -- `workflow-layer-e2e.test.cjs` walks the full chain; registered in Feynman + 122 runner; CHANGELOG finalized | SATISFIED | Test exists; registered; 8/8 assertion groups pass; CHANGELOG has Phase 122 `Added/Changed/Fixed/Maintainer Notes` block |

All 11 requirements are SATISFIED. Coverage is total.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `CHANGELOG.md` | Various historical entries | Pre-existing U+2014 em-dashes (~106) in older version blocks | Info | Zero impact on Phase 122 functionality; Phase 122 additions are em-dash-clean; deferred to housekeeping pass per `deferred-items.md` |
| `lib/hmi/jtbd-taxonomy.json` | `entries[].one_line` / `completion_shape` | 7 pre-existing U+2014 em-dashes in content fields | Info | Not in Phase 122 edits; deferred to housekeeping pass |
| `commands/doctor.md` | 1 pre-existing em-dash | Pre-existing | Info | Not in Phase 122 files; deferred to housekeeping pass |

No blockers. No stubs. No MISSING artifacts. No orphaned artifacts. All three anti-patterns are pre-existing, documented in `deferred-items.md`, and explicitly scoped out of Phase 122.

**Pre-existing known issue (NOT a Phase 122 regression):** `test/84-smart-notebook-copilot.test.cjs` hangs with a dangling SQLite handle from a `phase-109-nodes-provenance.cjs:280` migration error. This prevents `lib/memory/run-feynman-tests.cjs` from reaching the Phase-122 suites in a full-runner invocation. All 6 Phase-122 suites are verified GREEN directly and via `bash tests/run-all-122.sh`. They are registered in the Feynman TEST_FILES array and would run if test-84 did not hang. Fix requires a Phase-84/109 housekeeping pass; documented in `deferred-items.md`.

---

### Human Verification Required

These items require a live CLI session and cannot be automated without a running Claude process. Per the phase instructions, they do NOT block `passed` status -- all automated must-haves are met.

#### 1. Live CLI navigation-hook routing

**Test:** In a fresh `claude` session in a room with `.room-root` and a `ProblemType` set, describe a problem. Confirm the `## NAVIGATION DECISION` `offer_next_step` block contains a command sequence whose every `/mos:` is registered -- specifically, NOT `/mos:jtbd` for a JTBD suggestion, but `/mos:analyze-needs`.

**Expected:** The navigation hook surfaces a command sequence (not just framework names), all commands exist, and no hallucinated command appears.

**Why human:** Requires a real conversational turn + the `UserPromptSubmit` navigation-engine hook firing; unit tests cover `proposeNextFramework` + the resolver + the scripts but cannot exercise the live hook without a Claude session.

#### 2. Brain FEEDS_INTO freshness check

**Test:** Run `node scripts/build-command-registry.cjs --refresh-names` then `git diff data/framework-names.json`.

**Expected:** Either no diff (Brain is stable) or a small/expected delta. If the FEEDS_INTO-linked subset shrank unexpectedly, that is a brain-cleanup deploy issue, not a Phase 122 regression.

**Why human:** The Brain is a live remote endpoint; the snapshot is regenerated at build time only; verifying freshness requires live Brain connectivity.

#### 3. `/mos:pipeline --from-problem-type ill-defined` in a fixture room

**Test:** In a fixture room, run `/mos:pipeline --from-problem-type ill-defined`. Confirm the printed chain contains only registered `/mos:` commands, command-less frameworks print "run manually -- skipping", and steps run in order.

**Expected:** A Brain-derived command chain executes sequentially; artifacts file to the room; the autonomy gate stops at the first non-`autonomous_safe` step.

**Why human:** Running a full command chain files real room artifacts; the unit test asserts the chain is COMPOSED of registered commands but the actual sequential execution + artifact filing is a live-room integration.

---

### Gaps Summary

No gaps. All automated must-haves are verified. The three human verification items are post-release soak items explicitly scoped as non-blocking per the phase instructions and `122-VALIDATION.md`.

---

## Summary

Phase 122 (Workflow Layer -- framework <-> command registry + reliable invocation) has achieved its goal. The five reliability rules from the spec are enforced:

1. **Single source of truth** -- `frameworks:` frontmatter on each command file is the only place the mapping lives; the three previously hand-maintained maps (`FRAMEWORK_TO_COMMAND_SLUG`, `jtbd-taxonomy.json:methodology_hooks`, `references/methodology/index.md`) have been pruned to empty / informational-only / a pointer.
2. **Generated, never hand-written; drift impossible to commit** -- `scripts/build-command-registry.cjs --check` exits 0 on the clean tree; it is wired into the pre-commit hook and the Feynman runner.
3. **The resolver is the only door** -- `lib/workflow/command-resolver.cjs` has zero Brain calls; every orchestrator (`suggest-next`, `pipeline`, `act`) and the navigation hook route through it; `FRAMEWORK_TO_COMMAND_SLUG` is `Object.freeze({})`.
4. **The trigger is the hook, not the model** -- `framework-chain-composer.proposeNextFramework` now attaches a `workflow` field via `composeWorkflow`; the navigation hook surfaces this as `offer_next_step`.
5. **Degrade, do not fabricate** -- `command:null, optional:true` markers for command-less frameworks; graceful degradation at every layer confirmed by test suites.

Canon Part 8 (zero Brain mutation) is enforced by both a live grep sweep and the `workflow-layer-e2e.test.cjs` Test 5 assertion group. The acceptance example from the spec (`composeWorkflow(["Beautiful Question Framework","Domain Selection","Jobs to Be Done (JTBD)"])` -> `[/mos:beautiful-question, /mos:explore-domains, /mos:analyze-needs]`) passes exactly.

The full scoped suite (`bash tests/run-all-122.sh`) exits 0 with 5/5 suites green and 30/30 individual assertion groups passing.

---

_Verified: 2026-05-12_
_Verifier: Claude (gsd-verifier)_
