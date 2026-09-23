---
phase: quick/260923-d9l
plan: 01
subsystem: gsd-config
tags: [gsd, model-routing, config]
dependency-graph:
  requires: []
  provides: ["model_overrides pinning for 18 planning/discuss/research agents"]
  affects: [".planning/config.json", "gsd-tools.cjs resolve-model", "gsd-sdk resolve-model"]
tech-stack:
  added: []
  patterns: ["model_overrides step-1 pin (verbatim string, bypasses tier/profile logic)"]
key-files:
  created: []
  modified: [".planning/config.json"]
decisions:
  - "Pin 18 planning/discuss/research agents to claude-opus-5-5 via model_overrides (step 1 of resolveModelInternal), not model_profile_overrides (step 3, unreachable under runtime=claude) or a models.<tier> alias (rejected fable, not a valid tier)."
metrics:
  duration: "~15 minutes"
  completed: "2026-09-23"
---

# Quick Task 260923-d9l: Fix Fable Model Drift in Planning Config Summary

Pinned the 18 GSD planning/discuss/research agents to `claude-opus-5-5` via a new `model_overrides` block in `.planning/config.json`, replacing the dead `"fable"` tier value that silently never took effect since 2026-08-10.

## What Happened

`models.planning/discuss/research` were set to `"fable"`, an alias `resolveModelInternal` does not recognize (valid tiers: `opus | sonnet | haiku | inherit`). The 2026-08-10 fable directive was therefore silently dropped every time, and those agents ran on the `quality`-profile default (`opus`) instead. This task retires that dead value per the 2026-09-23 navigator ruling: `model_overrides` (step 1, verbatim string, honored by both resolvers) now pins the 18 named agents to `claude-opus-5-5`; `models.planning/discuss/research` moved to the valid `opus` tier as a fallback for any planning/discuss/research agent added later; execution/verification/completion stay on `sonnet`.

## Commit

`6bce5f0884017ff1cd972a4a353a6004a16d4944` - `fix(gsd): pin planning/discuss/research agents to Opus 5.5 via model_overrides, retire dead fable routing`

Single-file commit, `.planning/config.json` only, 24 insertions / 4 deletions. Peer-owned `.planning/STATE.md` diff (another session's in-flight work) was left untouched and unstaged throughout; `.planning/ROADMAP.md` had no uncommitted diff at execution time.

## Resolver Table (all 33 gsd-* agents, post-change)

### The 18 pinned agents (planning/discuss/research, model_overrides applies)

| Agent | gsd-tools | gsd-sdk |
|---|---|---|
| gsd-advisor-researcher | claude-opus-5-5 | claude-opus-5-5 |
| gsd-ai-researcher | claude-opus-5-5 | claude-opus-5-5 |
| gsd-assumptions-analyzer | claude-opus-5-5 | claude-opus-5-5 |
| gsd-codebase-mapper | claude-opus-5-5 | claude-opus-5-5 |
| gsd-doc-classifier | claude-opus-5-5 | claude-opus-5-5 |
| gsd-doc-synthesizer | claude-opus-5-5 | claude-opus-5-5 |
| gsd-domain-researcher | claude-opus-5-5 | claude-opus-5-5 |
| gsd-eval-planner | claude-opus-5-5 | claude-opus-5-5 |
| gsd-framework-selector | claude-opus-5-5 | claude-opus-5-5 |
| gsd-intel-updater | claude-opus-5-5 | claude-opus-5-5 |
| gsd-pattern-mapper | claude-opus-5-5 | claude-opus-5-5 |
| gsd-phase-researcher | claude-opus-5-5 | claude-opus-5-5 |
| gsd-planner | claude-opus-5-5 | claude-opus-5-5 |
| gsd-project-researcher | claude-opus-5-5 | claude-opus-5-5 |
| gsd-research-synthesizer | claude-opus-5-5 | claude-opus-5-5 |
| gsd-roadmapper | claude-opus-5-5 | claude-opus-5-5 |
| gsd-ui-researcher | claude-opus-5-5 | claude-opus-5-5 |
| gsd-user-profiler | claude-opus-5-5 | claude-opus-5-5 |

All 18 agree, both resolvers, exactly as the navigator ruling requires.

### Controls (execution-side, no override, both resolvers checked)

| Agent | gsd-tools | gsd-sdk (recorded, not asserted) |
|---|---|---|
| gsd-executor | sonnet | opus |
| gsd-verifier | sonnet | sonnet |

gsd-tools matches the plan's required assertion (`sonnet` for both) exactly. gsd-sdk's values match the planning-time simulation prediction exactly (`opus` for gsd-executor, `sonnet` for gsd-verifier) -- gsd-sdk ignores the `models` block entirely, so it falls through to its own default for gsd-executor.

### Remaining 13 gsd-* agents (not planning/discuss/research, no override; not asserted by the plan gate, recorded for completeness)

| Agent | gsd-tools | gsd-sdk |
|---|---|---|
| gsd-code-fixer | sonnet | opus |
| gsd-code-reviewer | sonnet | opus |
| gsd-debug-session-manager | sonnet | opus |
| gsd-debugger | sonnet | opus |
| gsd-doc-verifier | sonnet | sonnet |
| gsd-doc-writer | sonnet | opus |
| gsd-eval-auditor | sonnet | opus |
| gsd-integration-checker | sonnet | sonnet |
| gsd-nyquist-auditor | sonnet | sonnet |
| gsd-plan-checker | sonnet | sonnet |
| gsd-security-auditor | sonnet | opus |
| gsd-ui-auditor | sonnet | sonnet |
| gsd-ui-checker | sonnet | sonnet |

This confirms follow-up F2 below: several execution/completion-side agents that gsd-tools routes to `sonnet` resolve to `opus` under gsd-sdk, because gsd-sdk does not read the `models` tier block at all.

## Verification

- Task 1 gate: `OK`, `NO_EMDASH`, `NUMSTAT_OK` -- live agent enumeration matched the approved 18-name list exactly (no drift); `models` tiers correct; `model_overrides` has exactly the 18 keys, sorted, all `claude-opus-5-5`, positioned immediately after `_models_note`; `model_profile_overrides` and every other untouched key byte-identical to HEAD; top-level key order preserved; `_models_note` carries the ruling and root cause; zero em-dashes; diff exactly 24/4.
- Task 2 gate: all 18 pinned agents printed `tools=claude-opus-5-5 sdk=claude-opus-5-5`; both controls printed `tools=sonnet` (sdk recorded); `COMMIT_OK` (single-file HEAD commit, 24/4 numstat, no em-dash in commit message).
- Final overall check: `git show HEAD:.planning/config.json` has no `fable` value in `models` and no `claude.opus` key under `model_profile_overrides.claude` -- exits 0 (`FINAL_VERIFY_OK`).
- `git status --short .planning/ROADMAP.md .planning/STATE.md` unchanged from before this plan started (STATE.md still ` M`, peer-owned, never staged; ROADMAP.md clean).

## Follow-ups (reported, not fixed, per coordinator scope lock)

- **F1**: `model_profile_overrides.claude.sonnet` and `.claude.haiku` are dead config. `core.cjs` only reads `model_profile_overrides` in step 3, gated on `runtime` being set and not `claude`; this repo has no `runtime` key, so `gsd-executor` gets bare `sonnet`, never `claude-sonnet-5`. Left in place per coordinator instruction.
- **F2**: The two resolvers disagree. `gsd-sdk query resolve-model` ignores the `models` block entirely, so execution/completion-side agents that `gsd-tools` sends to `sonnet` (confirmed against the recorded table above: gsd-executor, gsd-code-fixer, gsd-code-reviewer, gsd-debug-session-manager, gsd-debugger, gsd-doc-writer, gsd-eval-auditor, gsd-security-auditor) resolve to `opus` under `gsd-sdk`. Which binary the orchestrator's `gsd_run` actually calls decides the real model for those agents. (gsd-doc-verifier, gsd-integration-checker, gsd-nyquist-auditor, gsd-plan-checker, gsd-ui-auditor, gsd-ui-checker, and gsd-verifier agree at `sonnet` under both resolvers -- the disagreement is not universal across the non-pinned set.)
- **F3**: `model_overrides` upkeep. A future GSD update that adds a planning/discuss/research agent will not be in the 18-entry list and will fall back to the bare `opus` alias, not the exact `claude-opus-5-5` id.
- **F4**: `gsd-tools` warns on every run that `_models_note` is an unknown config key.

## Deviations from Plan

None. Plan executed exactly as written; both gates passed on the first pass with no retries needed.

## Self-Check: PASSED

- `.planning/config.json` modified as specified: FOUND (verified via `git show HEAD:.planning/config.json` content checks above).
- Commit `6bce5f0884017ff1cd972a4a353a6004a16d4944`: FOUND (`git log -1 --format=%H` matches).
- `git show --name-only --format= HEAD` = `.planning/config.json` only: confirmed.
- No em-dash in file or commit message: confirmed by both gates.
