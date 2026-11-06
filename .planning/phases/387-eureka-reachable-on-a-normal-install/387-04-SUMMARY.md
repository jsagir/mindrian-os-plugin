---
phase: 387-eureka-reachable-on-a-normal-install
plan: "04"
subsystem: eureka-command-text
tags: [command, skill-mirror, hitl, tdd]
requires: ["387-09"]
provides:
  - "/mos:eureka enable engine subcommand text (3 states, 3 setup parts, route-level answers, grant-gated sync, F.0 stage)"
affects: [387-11]
key-files:
  modified:
    - commands/eureka.md
    - skills/eureka/SKILL.md
  created:
    - tests/test-387-eureka-command-wiring.cjs
metrics:
  completed: 2026-11-06
---

# Phase 387 Plan 04: Command text for /mos:eureka enable engine Summary

The existing /mos:eureka command now documents `enable engine` (check, save, forget, data, grant-gated sync, deep check), the 3 engine states, the 3 setup parts and the route-level answers, with a new hitl stage F.0 "engine setup grant". No new command file.

## What was done (TDD)

- Decision gate: the six record lines matched option A.
- RED (5301209cc): arms W1 to W11; 10 of 11 failed (W9 passed trivially before the edit).
- GREEN (1e49c5ac0): `commands/eureka.md` edited, mirror regenerated, W1 to W11 pass.

## Baseline and after (exit code, last line)

Before and after, all exit 0 with the same last line: command-registry OK; build-skill-mirrors OK (112 mirrors); connector-registry OK; orchestration-projection OK; render-coverage OK; registry-drift OK (0 findings). `check-shape-declaration.cjs --check` exits 0 with advisory WARN lines (pre-existing; none for eureka). The registries, projection and ledger needed no regeneration: no data file changed.

## Deviations from Plan

**1. [Rule 3 - Blocking] Tasks 2 and 3 share one commit.** The pre-commit hook refuses a commit when the skill mirror drifts. The command edit therefore could not be committed alone. The command and the regenerated mirror are in one commit (1e49c5ac0). The plan's separate chore commit for registries is not needed because the generators report no drift and no data file changed.

## Known Stubs

None.

## Threat Flags

None. The text names a folder path and package hosts only; the sync runs only after the F.0 card (W3, W5 pin it).

## Self-Check: PASSED

- tests/test-387-eureka-command-wiring.cjs: PASS=11 FAIL=0.
- Commits 5301209cc (RED) and 1e49c5ac0 exist.
