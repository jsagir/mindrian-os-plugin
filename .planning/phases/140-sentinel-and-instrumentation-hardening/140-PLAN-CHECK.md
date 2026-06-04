---
phase: 140-sentinel-and-instrumentation-hardening
checker: gsd-plan-checker
date: 2026-06-04
verdict: BLOCK
blockers: 2
warnings: 2
---

# Phase 140 Plan Check

**Verdict: BLOCK**
**Plans checked:** 140-01-PLAN.md, 140-02-PLAN.md, 140-03-PLAN.md
**Issues:** 2 blockers, 2 warnings

---

## Blockers (must fix before execution)

### BLOCKER 1 -- [Dimension 8, Nyquist Check 8e] 140-VALIDATION.md does not exist

The project standard requires a separate `<phase>-VALIDATION.md` artifact created during `/gsd:plan-phase --research`. Nyquist validation is explicitly enabled in RESEARCH.md (`workflow.nyquist_validation: true`) and the RESEARCH.md contains a complete `## Validation Architecture` section (lines 234-276). Every comparable phase in this repo ships with a VALIDATION.md (confirmed: 95.2, 115, 116, 122, 124, 125). Phase 140 has no `140-VALIDATION.md`.

Per the Nyquist Check 8e rule: if VALIDATION.md is absent, checks 8a-8d cannot run, the dimension fails, and plans must not proceed to execution.

**Fix:** Re-run `/gsd:plan-phase 140 --research` to regenerate and populate `140-VALIDATION.md` from the Validation Architecture section already in RESEARCH.md.

```yaml
issue:
  plan: null
  dimension: nyquist_compliance
  severity: blocker
  description: "140-VALIDATION.md does not exist; nyquist_validation is enabled and RESEARCH.md has Validation Architecture section"
  fix_hint: "Re-run /gsd:plan-phase 140 --research to generate 140-VALIDATION.md"
```

---

### BLOCKER 2 -- [Dimension 10, CLAUDE.md Compliance] No version bump task in any plan

CLAUDE.md states: "Every push that changes user-facing functionality MUST bump the version." RESEARCH.md Section "Project Constraints" line 33 repeats: "Release process: any user-facing fix bumps the version in lockstep (CHANGELOG + plugin.json + package.json + tag + marketplace)." The v1.13.1-EXECUTION-PLAN.md assigns Phase 140 to the `beta.6` band; current version is `1.13.1-beta.5`. Phase 95.2 (the nearest comparable bug-fix phase) included version bump as a dedicated final plan (95.2-02-PLAN.md).

None of the three Phase 140 plans contain a task for:
- CHANGELOG.md entry
- `.claude-plugin/plugin.json` version bump
- `package.json` version bump
- git tag
- marketplace ref-pin

The bug fixes ship code that changes user-visible sentinel behavior -- these are user-facing fixes per CLAUDE.md.

**Fix:** Add a Task 4 (or a 4th plan 140-04-PLAN.md) with the 5-gate version sync from `1.13.1-beta.5` to `1.13.1-beta.6`. Can be the final task in Plan 03 (lowest wave, last to execute) or a standalone plan.

```yaml
issue:
  plan: null
  dimension: claude_md_compliance
  severity: blocker
  description: "No version bump task in any plan; CLAUDE.md + RESEARCH.md both require 5-gate lockstep version sync for user-facing fixes; current version 1.13.1-beta.5 must become 1.13.1-beta.6 per execution plan beta band"
  fix_hint: "Add final task or plan: CHANGELOG entry + plugin.json bump + package.json bump + git tag v1.13.1-beta.6 + marketplace ref-pin"
```

---

## Warnings (fix recommended)

### WARNING 1 -- [Dimension 2, Task Completeness] Plan 01 Task 3 automated verify covers only half of D-03

D-03 (unmask scout errors) has two distinct acceptance criteria: (a) `2>/dev/null` removed, AND (b) no bare `|| true` that discards the exit status. The `<verify>` automated command only checks (a):

```bash
grep -n "hsi-to-graph" commands/scout.md | grep -c "2>/dev/null" | grep -qx 0 && echo "SWALLOW REMOVED"
```

Criterion (b) -- "no bare || true" -- is stated in acceptance criteria but has no corresponding grep in the automated verify. An executor could remove `2>/dev/null` but leave `|| true`, pass the automated check, and leave D-03 incompletely fixed.

**Fix:** Extend the Task 3 automated verify to also assert the `|| true` is gone or replaced:
```bash
grep -n "hsi-to-graph" commands/scout.md | grep -c "|| true" | grep -qx 0 && echo "TRUE-MASK REMOVED"
```
(or combine into a single pipeline).

```yaml
issue:
  plan: "140-01"
  dimension: task_completeness
  severity: warning
  task: 3
  description: "Automated verify checks 2>/dev/null removal but not || true removal; acceptance criteria requires both absent"
  fix_hint: "Add grep -c '|| true' check to Task 3 automated verify"
```

---

### WARNING 2 -- [Dimension 7, Context Compliance] CONTEXT.md line 66 has stale path for existing telemetry test

CONTEXT.md section "Reusable Assets" (line 66) lists the test to extend as:
```
tests/query-efficiency-telemetry.test.cjs
```
The actual file on disk is:
```
lib/memory/query-efficiency-telemetry.test.cjs
```
Plan 03 correctly uses `lib/memory/query-efficiency-telemetry.test.cjs` throughout (verified). The executor reads CONTEXT.md as context and could be confused by the wrong path there, potentially creating a parallel test at the wrong location. Plan 03 explicitly guards against this (`do NOT create a parallel tests/ copy`) but the stale path in CONTEXT.md is a contradiction in the context chain.

**Fix:** Correct CONTEXT.md line 66 to read `lib/memory/query-efficiency-telemetry.test.cjs`.

```yaml
issue:
  plan: "140-03"
  dimension: context_compliance
  severity: warning
  description: "CONTEXT.md line 66 lists test path as tests/query-efficiency-telemetry.test.cjs but actual file is lib/memory/query-efficiency-telemetry.test.cjs; Plan 03 correctly overrides this but the contradiction persists in context"
  fix_hint: "Update CONTEXT.md line 66 to lib/memory/query-efficiency-telemetry.test.cjs"
```

---

## What passes

**Requirement Coverage:** HARD-01 (Plan 02), HARD-02 (Plan 01), HARD-03 (Plan 02), HARD-04 (Plan 03), HARD-05 (Plan 03) -- all 5 requirements covered, one-to-one mapping, no requirement appears in multiple plans.

**Decision Compliance (D-01 through D-04):**
- D-01: Plan 03 Task 1 removes the `if (!command) return exitSilent()` gate -- all turns measured. Confirmed by accept criterion `grep -n "if (!command) return exitSilent" ... returns nothing`.
- D-01a: Plan 03 Task 2 adds `--mos-only` flag to aggregator and produces `140-57X-CLAIM-RECONCILIATION.md`. No silent redefinition of the 57x number.
- D-02: Plan 01 Task 2 creates `lib/core/node-insert.cjs` and routes all 4 insert sites through it. Accept criterion greps confirm all 4 sites.
- D-02a: Plan 01 Task 2 uses PRAGMA table_info(nodes) detection -- `grep -c "table_info" lib/core/node-insert.cjs >= 1` confirmed in accept criteria. Both schemas covered.
- D-03: Plan 01 Task 3 removes `2>/dev/null || true` swallow. Partial coverage concern raised in WARNING 1 above.
- D-04: Plan 02 Task 3 adds ONLY `.heal-backup` -- accept criteria explicitly greps that `.snapshots` and `.intelligence` are NOT added.

**5 Regression Tests:**
- HARD-01: `tests/test-sentinel-health-check.sh` -- Plan 02 Task 1 creates (Wave 0 RED), Task 2 turns GREEN.
- HARD-02: `lib/core/hsi-to-graph.test.cjs` -- Plan 01 Task 1 creates (Wave 0 RED), Task 2 turns GREEN.
- HARD-03: `tests/test-hsi-skip-heal-backup.sh` -- Plan 02 Task 1 creates (Wave 0 RED), Task 3 turns GREEN.
- HARD-04: `lib/memory/query-efficiency-telemetry.test.cjs` EXTENDED -- Plan 03 Task 1 (extends existing, not parallel fork). Canon Part 7 reuse honored.
- HARD-05: `tests/test-deadline-monitor-planning-state.sh` -- Plan 03 Task 3 creates RED then GREEN in same task (acceptable TDD-within-task).

**Task Structure:** All 9 tasks (3 per plan) have `<read_first>`, `<action>`, `<automated>` verify, `<acceptance_criteria>` with checkable greps, and `<done>`. No subjective language in acceptance criteria.

**Dependency Graph:** All 3 plans are Wave 1 with `depends_on: []`. No cycles, no file overlap across plans (zero shared files between plans -- confirmed).

**Scope:** 3 tasks per plan, within the 2-3 target and well below the 5-task warning threshold.

**Scope Reduction (Dimension 7b):** No "v1", "static for now", "simplified", "stub", or "will be wired later" language found in any plan action.

**Em-dash Rule:** Zero em-dashes across all 3 plans (confirmed by grep).

**Canon Part 8 (Graph Boundary):** All plans include `grep -rE "fetch|http|curl|brain.mindrian|tavily"` zero-result assertions. No Brain egress.

**Architectural Tier Compliance (Dimension 7c):** All fixes target the correct tier per RESEARCH.md Architectural Responsibility Map (bash sentinel, SQLite, Python CLI, PostToolUse hook -- all LOCAL script layer). No tier mismatches.

**Cross-Plan Data Contracts (Dimension 9):** Each plan touches entirely separate files. No shared data pipelines between plans. No transform conflicts.

**Research Resolution (Dimension 11):** RESEARCH.md has no `## Open Questions` section -- the 3 open questions listed in the Assumptions Log were resolved during plan construction (D-02a PRAGMA-detect strategy chosen, STATE.md field name confirmed at line 232-233, HARD-04 strategy chosen via discussion). PASS.

**Patterns (Dimension 12):** No PATTERNS.md exists for this phase. SKIPPED.

---

## Recommendation

Fix both blockers before execution:

1. Run `/gsd:plan-phase 140 --research` to generate `140-VALIDATION.md`.
2. Add a version bump task (CHANGELOG + plugin.json + package.json + git tag v1.13.1-beta.6 + marketplace ref-pin) to Plan 03 as a final task, or create a 4th plan `140-04-PLAN.md`.

Then optionally fix WARNING 1 (extend the D-03 automated verify to also check `|| true` removal) and WARNING 2 (correct the stale path in CONTEXT.md line 66).

The core bug-fix logic across all 5 HARD requirements is sound and will achieve the phase goal once these process gaps are closed.
