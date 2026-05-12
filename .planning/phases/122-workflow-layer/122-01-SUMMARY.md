---
phase: 122-workflow-layer
plan: 01
subsystem: workflow
tags: [command-frontmatter, framework-registry, workflow-layer, feynman-runner, icm-layer-0]

# Dependency graph
requires:
  - phase: 104-jtbd-command-declarations
    provides: the serves_jtbd: frontmatter key and the Wave-0 stub pattern (canonical "Phase NNN Wave 0 stub - to be implemented by plan NNN-NN" line, registered-path-stays-fixed rule)
  - phase: 100-jtbd-inference-engine
    provides: the lib-level ROOM.md identity-file pattern (lib/hmi/ROOM.md as the analogue for lib/workflow/ROOM.md)
provides:
  - The /mos: command frontmatter contract extended with kind / frameworks[] / produces / inputs / autonomous_safe (single source of truth for the framework <-> command mapping)
  - docs/COMMAND-FRONTMATTER.md -- the documented contract (five keys, methodology|utility|meta enum, two YAML examples, the exact-Brain-name rule, the Canon Part 8 boundary, the cohort-first retrofit rule)
  - 44 retrofitted commands/*.md files (41 algorithmic-cohort kind: methodology + 3 meta-tail kind: meta)
  - The Wave-0 test scaffold for the whole 122 phase: 3 stub test files registered, tests/run-all-122.sh, lib/workflow/ROOM.md
affects: [122-02 command-registry-generator, 122-03 command-resolver, 122-04 navigation-hook-wiring, 122-05 skill-cleanup-docs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Command frontmatter as the SOLE source of truth for framework<->command mapping (reliability rule 1); a generated registry + CI tripwire is built FROM it, never hand-written"
    - "Wave-0 stub-then-fill: stub test files exit 0 with the canonical line, registered once, swapped in by the owning downstream plan without changing the registered path"
    - "Scoped phase bash runner (tests/run-all-NNN.sh) mirroring tests/run-all-956.sh -- bash only, no emoji, no em-dashes, per-suite PASS/FAIL, exit non-zero on any fail"

key-files:
  created:
    - lib/workflow/command-resolver.test.cjs
    - lib/memory/command-registry.test.cjs
    - tests/test-command-registry.cjs
    - tests/run-all-122.sh
    - lib/workflow/ROOM.md
    - docs/COMMAND-FRONTMATTER.md
    - .planning/phases/122-workflow-layer/deferred-items.md
  modified:
    - lib/memory/run-feynman-tests.cjs
    - "commands/*.md (44 files: analyze-needs, beautiful-question, explore-domains, explore-trends, macro-trends, think-hats, persona, hat-briefing, scenario-plan, research, whitespace, score-innovation, find-bottlenecks, rs-fetch, rs-experts, rs-thesis, rs-explain, find-connections, find-analogies, compare-ventures, diagnostics, diagnose, causal, mos-reason, root-cause, user-needs, validate, value-proposition, grade, deep-grade, mullins, systems-thinking, analyze-systems, analyze-timing, dominant-designs, explore-futures, structure-argument, build-thesis, build-knowledge, map-unknowns, lean-canvas, pipeline, act, suggest-next)"

key-decisions:
  - "Inserted the five new keys directly after the serves_jtbd: line in each command (before allowed-tools:), with a single # --- Phase 122 workflow-layer frontmatter --- comment marker; all pre-existing keys kept byte-identical, command bodies untouched"
  - "frameworks: uses the EXACT FEEDS_INTO-linked Brain name where confirmed live; for the long tail (SAPPhIRE / TRIZ / Mullins 7-Domains / Dominant Design / DIKW / PEST Analysis / Hypothesis-Driven Problem Solving / Problem Definition Transformation Framework) used the cleanest canonical guess -- the 122-02 --check mode + data/framework-names.json snapshot will fail the build on a wrong one, so wrong guesses are caught not committed"
  - "autonomous_safe: false for synthesis/decision steps (hat-briefing, rs-explain) and all meta orchestrators (pipeline, act, suggest-next); everything else autonomous_safe: true"
  - "value-proposition.md keeps name: validate-proposition -- the slug mismatch the spec flags is left as-is; the command was not renamed, only the frontmatter added"
  - "tests/run-all-122.sh CJS_SUITES starts with only test-command-registry.cjs; chain-recommender / navigation-hook-resolver / suggest-next-workflow / workflow-layer-e2e are appended by 122-03/04/05 when they land (noted in the runner header)"

patterns-established:
  - "lib/workflow/ as the home for the Workflow Layer (the framework<->command resolver); founding phase 122; ROOM.md identity per CLAUDE.md decision #15 (no MINTO.md at lib level -- .room-root cascade scope is room/)"
  - "docs/COMMAND-FRONTMATTER.md sits next to skills/ui-system/SKILL.md as the command-side analogue of the UI ruling system"

requirements-completed: [WORKFLOW-122-01, WORKFLOW-122-03, WORKFLOW-122-10]

# Metrics
duration: 5min
completed: 2026-05-12
---

# Phase 122 Plan 01: Workflow Layer -- Frontmatter Contract + Retrofit + Wave-0 Scaffold Summary

**The /mos: command frontmatter is now the single source of truth for the framework <-> command mapping: 44 command files carry the new kind / frameworks[] / produces / inputs / autonomous_safe keys, the contract is documented in docs/COMMAND-FRONTMATTER.md, and the Wave-0 test scaffold (3 registered stubs + a scoped 122 bash runner + lib/workflow/ROOM.md) gives every downstream 122 plan a place to write tests.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-12T05:37:49Z
- **Completed:** 2026-05-12T05:42:29Z
- **Tasks:** 3 completed
- **Files modified:** 51 (44 command files + lib/memory/run-feynman-tests.cjs + 6 new files)

## Accomplishments
- Extended the `/mos:` command frontmatter schema with `kind`, `frameworks[]`, `produces`, `inputs`, `autonomous_safe` -- the SOLE place the framework-to-command mapping is declared (reliability rule 1). This EXTENDS the existing command frontmatter; it does not introduce a new metadata store.
- Retrofitted the algorithmic command cohort FIRST (41 `kind: methodology` files anchored on exact Brain `:Framework` names: Jobs to Be Done (JTBD), HSI Semantic Surprise Analysis Assistant, Reverse Salient Analysis, PWS Triple Validation Compass, Six Thinking Hats, Scenario Planning, S-Curve Analysis, Root Cause Analysis, The Pyramid Principle + MECE, Domain Selection, Beautiful Question Framework, PWS Value Proposition, Systems Thinking, Lean Canvas, Knowns and Unknowns Matrix Framework, plus cleanest-canonical for the long tail), then the meta tail (`/mos:pipeline`, `/mos:act`, `/mos:suggest-next` -- `kind: meta`, `frameworks: []`, `produces: null`).
- Documented the contract in `docs/COMMAND-FRONTMATTER.md` (79 lines): the five keys, the `methodology|utility|meta` enum, both YAML examples (methodology = analyze-needs, meta = pipeline), the FEEDS_INTO-linked exact-Brain-name rule (near-duplicates fail the build), the Canon Part 8 boundary (commands never enter the Brain; the registry is plugin-local, validated AGAINST Brain names, never written back), and the cohort-first retrofit rule.
- Landed the Wave-0 test scaffold: 3 stub test files (`lib/workflow/command-resolver.test.cjs`, `lib/memory/command-registry.test.cjs`, `tests/test-command-registry.cjs`) each exiting 0 with the canonical `Phase 122 Wave 0 stub - to be implemented by plan 122-NN` line; the two `lib/` stubs registered in `lib/memory/run-feynman-tests.cjs` `TEST_FILES[]`; `tests/run-all-122.sh` mirroring `tests/run-all-956.sh`; `lib/workflow/ROOM.md` (ICM Layer 0 identity for the new dir).

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave-0 test scaffold -- 3 stubs registered + scoped 122 bash runner + lib/workflow/ROOM.md** - `87f1419` (test)
2. **Task 2: Document the frontmatter contract -- docs/COMMAND-FRONTMATTER.md** - `c21f3a3` (docs)
3. **Task 3: Retrofit the algorithmic cohort frontmatter first, then the meta tail (44 command files)** - `00a324d` (feat)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified

### Created
- `lib/workflow/command-resolver.test.cjs` - Wave-0 stub for the resolver test suite (filled by 122-03)
- `lib/memory/command-registry.test.cjs` - Wave-0 stub for the registry generator + drift-tripwire test suite (filled by 122-02)
- `tests/test-command-registry.cjs` - Wave-0 stub; the node entrypoint the scoped 122 bash runner targets (filled by 122-02)
- `tests/run-all-122.sh` - scoped 122 test runner mirroring `tests/run-all-956.sh` (bash only, per-suite PASS/FAIL, exit non-zero on any fail; CJS_SUITES grows as 122-03/04/05 land)
- `lib/workflow/ROOM.md` - ICM Layer 0 identity for the new dir; names Phase 122 as the founding phase and the resolver as the contained surface; restates the 5 reliability rules and the Canon Part 8 boundary
- `docs/COMMAND-FRONTMATTER.md` - the documented `/mos:` command frontmatter contract
- `.planning/phases/122-workflow-layer/deferred-items.md` - out-of-scope discoveries log

### Modified
- `lib/memory/run-feynman-tests.cjs` - appended the two `lib/` Wave-0 stubs to `TEST_FILES[]` with a one-block comment
- `commands/*.md` (44 files) - added the five new frontmatter keys after `serves_jtbd:` (before `allowed-tools:`); no body changed; no pre-existing key changed

## Deviations from Plan

### Auto-fixed Issues

None - plan executed as written. The plan objective says "43 retrofitted commands/*.md files" but `files_modified` lists 44 command files; followed `files_modified` (the authority) and retrofitted all 44. No code or behavior change.

### Out-of-scope discoveries logged (not fixed)

- **`commands/doctor.md` contains a U+2014 em-dash** - pre-existing; NOT in this plan's `files_modified`. Logged to `.planning/phases/122-workflow-layer/deferred-items.md` per the GSD SCOPE BOUNDARY rule. The no-em-dash project rule should be swept across all `commands/*.md` in a dedicated housekeeping pass, not as a side effect of this retrofit.

## Authentication Gates

None.

## Known Stubs

The three Wave-0 stub test files are intentional, time-boxed stubs documented in `122-VALIDATION.md` "## Wave 0 Requirements":
- `lib/workflow/command-resolver.test.cjs` - filled by plan 122-03
- `lib/memory/command-registry.test.cjs` - filled by plan 122-02
- `tests/test-command-registry.cjs` - filled by plan 122-02

Each exits 0 with the canonical stub line; the owning downstream plan swaps the implementation in without changing the registered path. This is the canon Wave-0 pattern (per `JTBDCONS-104-05`), not a gap in this plan's goal.

## Verification

- `node lib/workflow/command-resolver.test.cjs` -> exit 0, stdout `Phase 122 Wave 0 stub - to be implemented by plan 122-03`
- `node lib/memory/command-registry.test.cjs` -> exit 0, stdout `Phase 122 Wave 0 stub - to be implemented by plan 122-02`
- `node tests/test-command-registry.cjs` -> exit 0
- `bash tests/run-all-122.sh` -> exit 0 (1/1 passed)
- `grep -c "command-resolver.test.cjs" lib/memory/run-feynman-tests.cjs` -> 1; `grep -c "command-registry.test.cjs" lib/memory/run-feynman-tests.cjs` -> 1
- `node -c lib/memory/run-feynman-tests.cjs` -> syntax OK
- `test -f lib/workflow/ROOM.md` -> true
- `docs/COMMAND-FRONTMATTER.md` -> 79 lines; contains `kind`, `frameworks`, `produces`, `inputs`, `autonomous_safe`, `methodology | utility | meta`, `Canon Part 8`, `data/command-registry.json`, `data/framework-names.json`, a `kind: methodology` YAML block, a `kind: meta` YAML block
- For analyze-needs / beautiful-question / explore-domains / pipeline / act / suggest-next / score-innovation / whitespace / structure-argument / rs-fetch / value-proposition: `grep -q "^kind:"` AND `grep -q "^frameworks:"` AND `grep -q "^autonomous_safe:"` all succeed
- `grep -q 'kind: methodology' commands/analyze-needs.md` -> true; `grep -q 'kind: meta' commands/pipeline.md` -> true; `grep -q 'Jobs to Be Done (JTBD)' commands/analyze-needs.md` -> true; `grep -q 'frameworks: \[\]' commands/pipeline.md` -> true
- `grep -q "^name: analyze-needs" commands/analyze-needs.md` -> true (pre-existing key intact)
- `git diff --name-only` for the retrofit commit shows exactly the 44 command files (+ deferred-items.md); no other command file touched
- `grep -rlP "\x{2014}"` over `docs/COMMAND-FRONTMATTER.md`, `lib/workflow/`, `tests/run-all-122.sh`, and the 44 touched command files -> nothing (the only em-dash hit in `commands/` is the pre-existing `commands/doctor.md`, out of scope)

## Self-Check: PASSED

All created files exist on disk; all 3 task commits (`87f1419`, `c21f3a3`, `00a324d`) present in git history.
