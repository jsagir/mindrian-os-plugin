---
phase: 400-job-sentences-with-three-stored-slots-on-every-capability-a-
plan: 04
subsystem: job-sentences
tags: [job-sentence, mcp-tools, drift-test, mutation-control]

requires:
  - phase: 400-03
    provides: job sentences on all 113 commands, 12 standalone skills and 17 agents; legs S0 to S7
provides:
  - data/mcp-tool-job-sentences.json (63 provisional MCP tool sentences keyed by connector surface)
  - tests/test-400-job-sentences.cjs legs M1 to M4 and F1 to F3
  - tests/run-all-400.sh runs apply-job-sentences --check --require-all
affects: [400-15, 401]

tech-stack:
  added: []
  patterns:
    - "One per-file check function serves the real scan and the mutation control"
    - "A surface class without frontmatter keeps its sentences in one data file keyed by connector surface"

key-files:
  created:
    - data/mcp-tool-job-sentences.json
  modified:
    - tests/test-400-job-sentences.cjs
    - tests/run-all-400.sh

key-decisions:
  - "F1 exempts the ruled framework statements from the want-starts-with-to rule only; 5 of 184 ruled statements have a noun want, and data/framework-jobs.json is read, never written"
  - "MCP sentences use the same style rules as the frontmatter surfaces, plus no product name (eureka included) and no snake_case tool name"

requirements-completed: [JS-04, JS-06]

duration: about 12 min
completed: 2026-11-24
---

# Phase 400 Plan 04: MCP tool job sentences and the drift test over every surface Summary

**All 63 MCP tools have one provisional three-slot sentence in data/mcp-tool-job-sentences.json, and one drift test with a mutation control covers 20 vocabulary jobs, 113 commands, 12 standalone skills, 17 agents, 63 MCP tools and 184 framework statements.**

## Performance

- **Completed:** 2026-11-24T10:00Z
- **Tasks:** 2 of 2
- **Files modified:** 3

## Accomplishments

- Task 1: legs M1 to M4. M1 binds the sorted key set of `tools` to the 63 connector surfaces of data/mcp-tool-connectors.json (T-400-08). M2 checks {when, want, so, status: provisional}, slotErrors, at most 40 words, no product name, digit, quote or tool name. M3 checks that no MCP sentence equals a command sentence or another MCP sentence. M4 checks the file keys and the dash rule. RED at 2e75c21cb.
- The tool descriptions came from a throwaway fake-server script (the test-345 harness pattern) in the session scratchpad; it printed surface, description and hitl_why, and it was deleted after use. contract_version and room_bind register outside lib/mcp/tools; their hitl_why lines were the source.
- data/mcp-tool-job-sentences.json written with schema mos.mcp-tool-job-sentences/1 and the _note of the plan. Each sentence is written from the view of the person whose work the tool serves. GREEN at 7859e9bed.
- Task 2: legs F1 to F3. F1 enumerates each surface from disk or its data file and asserts the totals, slotErrors and the parseJob(renderJob(slots)) round trip. F2 runs the same functions (frontmatterFileErrors, mcpFileErrors) on a scratch command without job_want and a scratch MCP file whose first want ends in a period; both are reported, and the mkdtemp directory is removed. F3 runs `apply-job-sentences.cjs --check --require-all` against the real repo. tests/run-all-400.sh now runs `--check --require-all`. Commit 8cb2a6aef.

## Task Commits

1. **Task 1: legs M1 to M4** - 2e75c21cb (test, RED)
2. **Task 1: the 63 MCP tool sentences** - 7859e9bed (feat, GREEN)
3. **Task 2: legs F1 to F3 and the require-all runner check** - 8cb2a6aef (test)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] F1 slotErrors rule against ruled framework statements**
- **Found during:** Task 2
- **Issue:** 5 of the 184 ruled framework statements (for example Ansoff Matrix, MECE, Psychological Safety) have a want slot without a leading "to ". slotErrors reports them. frameworkSlots keeps that wording by design, and data/framework-jobs.json is read, never written.
- **Fix:** F1 drops only the error `want does not begin with "to "` for framework statements. Every other slot rule and the round trip hold for all 184.
- **Files modified:** tests/test-400-job-sentences.cjs
- **Commit:** 8cb2a6aef

**2. [Rule 1 - Bug] Literal dash characters in the M4 regex**
- **Found during:** Task 2 dash scan
- **Issue:** the RED commit 2e75c21cb wrote the M4 regex with literal en dash and em dash characters.
- **Fix:** the regex uses the backslash-u escapes for code points 2013 and 2014. No literal en dash or em dash is in any file of this plan.
- **Commit:** 8cb2a6aef

### TDD note

Task 2 legs F1 to F3 passed at their first run, because Task 1 and plans 02 and 03 had labelled every surface. The fail-fast check was done through F2: the same check functions report both planted mutants, so the legs bite.

## Regression checks

- test-222-zero-deps, test-341-eureka-no-brain-reach, test-267.3-surface-declarations, test-356-egress: exit 0 with the new data file.
- test-387-eureka-live-leak: SKIPPED (ENV GAP, owner-run only).
- test-369.26-palette-sync: 2 failures; the same exit 1 with the new data file moved away, so pre-existing and not caused by this plan.

## Deferred Issues

None new. The 65 stale `first delivery at commands/<name>.md:<line>` pointers and the `# ---` frontmatter end (F1) stay with Phase 401, as in deferred-items.md.

## Known Stubs

None.

## Threat Flags

None. T-400-08 holds: M1 and F1 bind the key set to the generated connector registry. T-400-09 accepted: generic capability text; no egress path reads the file.

## Gates (final, at 8cb2a6aef)

- node tests/test-400-job-sentences.cjs: 15 passed, 0 failed (S0 to S7, M1 to M4, F1 to F3).
- `node -e '...Object.keys(s.tools).length===63...'`: exit 0.
- `grep -c "require-all" tests/run-all-400.sh`: 1.
- bash tests/run-all-400.sh: exit 0; the require-all check line PASSED; last line ">>> 400: run-all-399: PASSED".
- bash tests/run-all-399.sh: exit 0.
- node scripts/build-skill-mirrors.cjs --check: OK (112 mirrors; skip-list verified: trending-to-absurd).
- build-connector-registry --check, build-harness-manifest --check, build-command-registry --check: OK. No registry was regenerated in this plan.

## Self-Check: PASSED

- Files found on disk: data/mcp-tool-job-sentences.json, tests/test-400-job-sentences.cjs, tests/run-all-400.sh, this SUMMARY.
- Commits found: 2e75c21cb, 7859e9bed, 8cb2a6aef.
