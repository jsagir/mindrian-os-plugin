---
phase: 122
slug: workflow-layer
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-12
populated: 2026-05-12
---

# Phase 122 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Body populated from `122-RESEARCH.md` -> `## Validation Architecture` + `## Phase Requirements -> Test Map` during `/gsd:plan-phase 122`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `assert` / hand-rolled CJS test files registered in `lib/memory/run-feynman-tests.cjs` (no jest/mocha/vitest/zod in this repo -- see RESEARCH `## Standard Stack` + CLAUDE.md "What NOT to Use") |
| **Config file** | none -- the test list is the `TEST_FILES[]` array inside `lib/memory/run-feynman-tests.cjs`; the scoped 122 suite is `tests/run-all-122.sh` (mirrors `tests/run-all-956.sh` -- bash only, no emoji, no em-dashes) |
| **Quick run command** | `node lib/workflow/command-resolver.test.cjs && node lib/memory/command-registry.test.cjs` (per task -- the relevant suite) |
| **Full suite command** | `bash tests/run-all-122.sh` (the scoped 122 runner) and `node lib/memory/run-feynman-tests.cjs` (the de-facto whole-repo suite, with the new files registered) |
| **Estimated runtime** | scoped 122 suite < ~10s (all tests are deterministic local reads + one `--check` regenerate + one `proposeNextFramework` call; no network at test time -- the only Brain touch is `scripts/build-command-registry.cjs --refresh-names` at BUILD time, not test time) |

---

## Sampling Rate

- **After every task commit:** Run the relevant `lib/**/*.test.cjs` for that task (e.g. after the resolver task: `node lib/workflow/command-resolver.test.cjs`; after the generator task: `node scripts/build-command-registry.cjs --check && node lib/memory/command-registry.test.cjs`).
- **After every plan wave:** Run the scoped 122 suite (`bash tests/run-all-122.sh`) and `node lib/memory/run-feynman-tests.cjs` (full suite).
- **Before `/gsd:verify-work`:** Full 122 suite green; `node scripts/build-command-registry.cjs --check` exits 0; `node lib/memory/run-feynman-tests.cjs` runs to completion; the Canon Part 8 grep sweep (in `lib/memory/workflow-layer-e2e.test.cjs`) passes.
- **Max feedback latency:** ~10 seconds.

---

## Per-Task Verification Map

| Plan / Task | Wave | Requirement(s) | Test Type | Automated Command | New file (Wave 0?) | Status |
|-------------|------|----------------|-----------|-------------------|--------------------|--------|
| 122-01 / T1 (Wave-0 scaffold) | 1 | WORKFLOW-122-03, -10 | infra | `node lib/workflow/command-resolver.test.cjs && node lib/memory/command-registry.test.cjs && node tests/test-command-registry.cjs && bash tests/run-all-122.sh` | YES -- 3 stubs + `tests/run-all-122.sh` + `lib/workflow/ROOM.md` | pending |
| 122-01 / T2 (frontmatter contract doc) | 1 | WORKFLOW-122-01 | doc | `test -f docs/COMMAND-FRONTMATTER.md && grep -q "autonomous_safe" docs/COMMAND-FRONTMATTER.md` | -- | pending |
| 122-01 / T3 (retrofit 43 commands) | 1 | WORKFLOW-122-01 | integration | `for f in commands/analyze-needs.md commands/pipeline.md commands/score-innovation.md commands/structure-argument.md; do grep -q "^kind:" "$f" && grep -q "^frameworks:" "$f"; done && grep -q "kind: methodology" commands/analyze-needs.md && grep -q "frameworks: \[\]" commands/pipeline.md` | -- | pending |
| 122-02 / T1 (generator + --check + --refresh-names) | 2 | WORKFLOW-122-02, -03, -10 | integration | `node scripts/build-command-registry.cjs && node scripts/build-command-registry.cjs --check && test -f data/command-registry.json && test -f data/framework-names.json && grep -q '"ontology_ref"' data/command-registry.json` | YES -- `scripts/build-command-registry.cjs`, `data/command-registry.json`, `data/framework-names.json`, `data/ROOM.md` | pending |
| 122-02 / T2 (pre-commit guard + real registry test) | 2 | WORKFLOW-122-03, -10 | integration | `node lib/memory/command-registry.test.cjs && grep -q "build-command-registry.cjs --check" .git/hooks/pre-commit && grep -q "build-command-registry.cjs --check" scripts/hooks/pre-commit && bash tests/run-all-122.sh` | fills `lib/memory/command-registry.test.cjs` + `tests/test-command-registry.cjs` | pending |
| 122-03 / T1 (command-resolver.cjs) | 3 | WORKFLOW-122-04, -08, -10 | unit | `node lib/workflow/command-resolver.test.cjs && node -e "const r=require('./lib/workflow/command-resolver.cjs'); const w=r.composeWorkflow(['Beautiful Question Framework','Domain Selection','Jobs to Be Done (JTBD)']); process.exit(w.length===3 && w[0].step===1 ? 0 : 1)" && ! grep -q "brain-client" lib/workflow/command-resolver.cjs` | YES -- `lib/workflow/command-resolver.cjs`; fills `lib/workflow/command-resolver.test.cjs` | pending |
| 122-03 / T2 (chain-recommender.cjs) | 3 | WORKFLOW-122-05, -08, -10 | unit/integration | `node lib/memory/chain-recommender.test.cjs && node -e "const c=require('./lib/brain/chain-recommender.cjs'); const ch=c.recommendFrameworkChain({problemType:'ill-defined'}); process.exit(Array.isArray(ch) && ch.length>=1 ? 0 : 1)" && ! grep -q "/mos:" lib/brain/chain-recommender.cjs` | YES -- `lib/brain/chain-recommender.cjs`, `lib/memory/chain-recommender.test.cjs`, `lib/brain/ROOM.md` | pending |
| 122-04 / T1 (navigation-hook surgical edit) | 4 | WORKFLOW-122-06, -08, -10 | integration | `node lib/memory/navigation-hook-resolver.test.cjs && grep -q "command-resolver" lib/core/framework-chain-composer.cjs && grep -q "composeWorkflow" lib/core/framework-chain-composer.cjs` | YES -- `lib/memory/navigation-hook-resolver.test.cjs` | pending |
| 122-04 / T2 (wire suggest-next / pipeline / act) | 4 | WORKFLOW-122-07, -08 | integration | `grep -q "command-resolver" scripts/suggest-next-command.cjs && grep -q "chain-recommender" scripts/pipeline-command.cjs && grep -q "validateChainAutonomy" scripts/act-command.cjs && grep -q "from-problem-type" commands/pipeline.md && node -c scripts/suggest-next-command.cjs && node -c scripts/pipeline-command.cjs && node -c scripts/act-command.cjs` | -- | pending |
| 122-04 / T3 (skill prose + suggest-next e2e test) | 4 | WORKFLOW-122-07, -10 | integration | `node lib/memory/suggest-next-workflow.test.cjs && grep -q "command-resolver" skills/pws-methodology/SKILL.md && grep -q "command-resolver" skills/brain-connector/SKILL.md && bash tests/run-all-122.sh` | YES -- `lib/memory/suggest-next-workflow.test.cjs` | pending |
| 122-05 / T1 (prune the 3 maps + delete brain-connector prose) | 5 | WORKFLOW-122-09, -10 | integration | `node tests/test-jtbd-taxonomy.cjs && node -e "const c=require('./lib/core/framework-chain-composer.cjs'); process.exit(Object.keys(c.FRAMEWORK_TO_COMMAND_SLUG||{}).length===0 ? 0 : 1)" && ! grep -rE "Brain has Command|brain_proactive_command|FOLLOWS_FRAMEWORK.*Command|:Command" skills/ agents/ references/` | -- | pending |
| 122-05 / T2 (docs/WORKFLOWS.md + cross-links) | 5 | WORKFLOW-122-09 | doc | `test -f docs/WORKFLOWS.md && grep -q "Canon Part 8" docs/WORKFLOWS.md && grep -q "WORKFLOWS.md" docs/THE-BRAIN.md && grep -q "Phase 122" docs/CANON-PHASE-MAP.md` | YES -- `docs/WORKFLOWS.md` | pending |
| 122-05 / T3 (e2e test + Canon Part 8 sweep + CHANGELOG) | 5 | WORKFLOW-122-10, -11 | integration | `node lib/memory/workflow-layer-e2e.test.cjs && grep -q "workflow-layer-e2e.test.cjs" lib/memory/run-feynman-tests.cjs && bash tests/run-all-122.sh && grep -q "command-registry" CHANGELOG.md` | YES -- `lib/memory/workflow-layer-e2e.test.cjs` | pending |

*Status: pending / green / red / flaky. Maps to RESEARCH `## Validation Architecture -> Phase Requirements -> Test Map`.*

---

## Wave 0 Requirements (the test scaffold -- all in plan 122-01 Task 1, then filled by downstream plans)

- [ ] `lib/workflow/command-resolver.test.cjs` -- stub in 122-01; filled in 122-03 (covers `commandsForFramework`, `frameworksForCommand`, `composeWorkflow` incl. null/optional, `validateChainAutonomy`, empty-registry degrade path, no-Brain assertion)
- [ ] `lib/memory/command-registry.test.cjs` -- stub in 122-01; filled in 122-02 (`--check` exit code, stale detection, unresolvable-framework detection, inverse-map round-trip, algorithmic-cohort assertion, Canon Part 8 grep guard)
- [ ] `tests/test-command-registry.cjs` -- stub in 122-01; filled in 122-02 (the bash-runner node entrypoint; re-execs / re-requires `lib/memory/command-registry.test.cjs`)
- [ ] `tests/run-all-122.sh` -- created in 122-01 (mirrors `tests/run-all-956.sh`); CJS_SUITES grows as 122-03 (`chain-recommender.test.cjs`), 122-04 (`navigation-hook-resolver.test.cjs`, `suggest-next-workflow.test.cjs`), 122-05 (`workflow-layer-e2e.test.cjs`) land
- [ ] both `lib/` stubs registered in `lib/memory/run-feynman-tests.cjs` `TEST_FILES[]` in 122-01; `chain-recommender.test.cjs` + `navigation-hook-resolver.test.cjs` + `suggest-next-workflow.test.cjs` + `workflow-layer-e2e.test.cjs` registered as they land (122-03/04/05)
- [ ] `lib/workflow/ROOM.md`, `lib/brain/ROOM.md`, `data/ROOM.md` -- ICM Layer 0 identity files for the new dirs (CLAUDE.md decision #15; MINTO.md not required at lib/data level -- the .room-root cascade scope is room/, not lib/data/)
- No new test framework needed -- node `assert` + `child_process` is the framework (matches `lib/memory/run-feynman-tests.cjs` + every existing `*.test.cjs`).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Larry actually routing a methodology suggestion through the resolver to a real `/mos:` in a live CLI session | WORKFLOW-122-06, -07 | Requires a real conversational turn + the `UserPromptSubmit` navigation-engine hook firing; cannot be unit-tested end-to-end (the unit tests cover `proposeNextFramework` + the resolver + the scripts; the live wiring is the integration the test cannot exercise without a Claude session) | In a fresh `claude` session in a room with `.room-root` + a `ProblemType` set: describe a problem; confirm the `## NAVIGATION DECISION` `offer_next_step` contains a command sequence whose every `/mos:` resolves (no hallucinated/wrong command -- in particular, NOT `/mos:jtbd` for a JTBD suggestion); pick it; confirm it runs the right command. |
| The Brain `FEEDS_INTO` graph being current / the `data/framework-names.json` snapshot being fresh | WORKFLOW-122-02 | The Brain is a live remote endpoint; the snapshot is regenerated at BUILD time (`--refresh-names`), not at test time -- the test asserts against the committed snapshot, not the live graph | Occasionally: `node scripts/build-command-registry.cjs --refresh-names` then `git diff data/framework-names.json` to see if the FEEDS_INTO-linked subset drifted; if it shrank unexpectedly, that is a brain-cleanup deploy issue surfaced here, not a Phase 122 regression. |
| `/mos:pipeline --from-problem-type ill-defined` actually running a Brain-derived chain end-to-end (commands invoked in sequence, artifacts filed) | WORKFLOW-122-07 | Running a full command chain files real room artifacts -- the unit test asserts the chain is COMPOSED of registered commands and that `--from-problem-type` is parsed; the actual sequential execution + artifact filing is a live-room integration | In a fixture room: `/mos:pipeline --from-problem-type ill-defined`; confirm the printed chain is `/mos:` commands that all exist, that command-less frameworks print "run manually -- skipping", and that the steps run in order. |

---

## Validation Sign-Off

- [x] All tasks have an `<automated>` verify or a Wave 0 dependency (the 3 Wave-0 stubs in 122-01 cover every later task's test file; the e2e + Canon-Part-8 sweep cover the cross-cutting assertions)
- [x] Sampling continuity: no 3 consecutive tasks without an automated verify (every task in every plan has an `<automated>` block; per-task and per-wave runs are defined above)
- [x] Wave 0 covers all MISSING references (the 3 new test files are registered in `lib/memory/run-feynman-tests.cjs` + `tests/run-all-122.sh` in plan 122-01; later plans fill bodies without changing paths; 122-03/04/05 register their additional new test files as they land)
- [x] No watch-mode flags (all commands are one-shot `node ...` / `bash ...`)
- [x] Feedback latency < ~10s (deterministic local tests; the only Brain touch is build-time `--refresh-names`, never at test time)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (planner) 2026-05-12
