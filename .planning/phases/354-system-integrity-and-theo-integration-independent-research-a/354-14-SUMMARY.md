---
phase: 354-system-integrity-and-theo-integration-independent-research-a
plan: 14
subsystem: mcp
tags: [mcp, registration, health, diagnostics, canon-part-11]

# Dependency graph
requires:
  - phase: 354-11
    provides: prior wave's MCP-first flag and write-path gate surface (unrelated file, same tool-router seam)
  - phase: 354-12
    provides: Theo contract fixes landed earlier in the same phase (no code dependency, wave ordering only)
provides:
  - "registerCoreTools() returns {complete, registered, failed, at} instead of nothing"
  - "One stderr diagnostic line per registration failure, naming module and phase, zero stdout"
  - "getRegistrationHealth() export exposing the last registration report as a structured clone"
  - "status_read segments.capability_floor.tool_registration {complete, failed: [{module, phase}]}"
affects: [mcp-registration-seam, status-read, sys-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level _lastReport singleton read lazily inside a handler (status_read) to avoid a load-order require cycle with register-core-tools.cjs"
    - "Failure phases as a closed vocabulary: require, register, contract_version, discover, no_register_export"

key-files:
  created:
    - tests/test-354-registration-diagnostics.cjs
  modified:
    - lib/mcp/register-core-tools.cjs
    - lib/mcp/tools/status.cjs

key-decisions:
  - "H1 assertions (getRegistrationHealth + status_read) run immediately after F1 and before F2, since register-core-tools.cjs's module-level _lastReport is a require()-cache singleton that F2's later registerCoreTools() call would otherwise overwrite before H1 could observe F1's state."
  - "getRegistrationHealth() returns a JSON structured clone of _lastReport (not the live object) so callers can never mutate shared module state."
  - "message truncated to 200 chars (String(err.message || err).slice(0,200)) per the plan's threat-model T-354-28b disposition, so a verbose error never leaks unbounded detail onto stderr or into status_read."

patterns-established:
  - "Lazy require-inside-handler for a sibling tools/*.cjs module's health/state, to avoid load-order cycles in the disjoint-file tool-module contract."

requirements-completed: [SYS-04]

# Metrics
duration: 35min
completed: 2026-09-23
---

# Phase 354 Plan 14: MCP Tool Registration Diagnostics Summary

**A partial MCP tool surface (a fault-injected graph.cjs dropping graph_query/graph_write/memory_event) now announces itself on stderr, in registerCoreTools()'s own return value, and through status_read's capability_floor.tool_registration -- while every healthy sibling module keeps registering exactly as before.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-09-23T15:04:00Z (approx, per prior STATE.md session marker)
- **Completed:** 2026-09-23T15:32:00Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Fault-injection regression (`tests/test-354-registration-diagnostics.cjs`) pins F1 (require fault), F2 (register fault), H1 (getRegistrationHealth + status_read health exposure) and H2 (clean-run health) at the real `registerCoreTools()` seam -- RED against the pre-fix loop (9 of 12 checks failed, returns `undefined`, zero stderr), GREEN after the fix (12/12).
- `lib/mcp/register-core-tools.cjs`'s per-module try/catch sibling isolation is unchanged (a broken module still never blocks its healthy siblings); it now also builds and returns a `{complete, registered, failed, at}` report, writes exactly one `[mindrian-os] tool registration failed: <module> (<phase>): <message>` line to stderr per failure (never stdout), and exports `getRegistrationHealth()` for out-of-band reads.
- `lib/mcp/tools/status.cjs`'s `status_read` handler lazily requires `register-core-tools.cjs` at call time and surfaces `segments.capability_floor.tool_registration = {complete, failed: [{module, phase}]}`, read live on every call so it always reflects the most recent registration run.

## Task Commits

Each task was committed atomically:

1. **Task 1: Failing fault-injection regression at the registration seam** - `0b246f9c3` (test)
2. **Task 2: Registration report, stderr diagnostics and status_read health exposure** - `73f42c23b` (feat)

**Plan metadata:** (this commit, see below)

## Files Created/Modified
- `tests/test-354-registration-diagnostics.cjs` - F1/F2/H1/H2 fault-injection regression at the real registration seam (require fault, register fault, health-surface mirror, clean-run health)
- `lib/mcp/register-core-tools.cjs` - report/stderr-diagnostics/getRegistrationHealth(), sibling isolation unchanged
- `lib/mcp/tools/status.cjs` - `capability_floor.tool_registration` from `getRegistrationHealth()`, one new description clause

## Decisions Made
- Ran H1's checks (getRegistrationHealth deep-equal + status_read health) immediately after F1 and before F2, rather than in the plan prose's literal F1/F2/H1/H2 paragraph order -- `register-core-tools.cjs`'s `_lastReport` is a require()-cache singleton shared across calls in the same process, so F2's own `registerCoreTools()` call would silently overwrite F1's state before H1 could observe it. This is the only ordering that lets H1 actually assert against F1's report as the plan intends ("after F1, ... getRegistrationHealth() ... deep-equals the F1 report").
- `getRegistrationHealth()` returns a JSON-clone (`JSON.parse(JSON.stringify(_lastReport))`), not the live report object, so a caller can never accidentally mutate the module's shared state through the returned value.

## Deviations from Plan

None - plan executed exactly as written. One informational note, not a deviation:

The plan's Task 2 acceptance criteria predicted `docs/reviews/phase-354-probes/registration.cjs`'s own `failureDiagnosticPresent` field would "stay false only because the probe itself swallows stderr." Measured behavior is the opposite: the probe overrides `process.stderr.write` at the JS level (not via shell `2>/dev/null`, which only affects the real fd and is bypassed entirely once the function itself is replaced), so it correctly captures the new diagnostic string and now reports `failureDiagnosticPresent: true`. The plan's own required verify command (`grep -q '"returnedFailure":true'`) only asserts `returnedFailure`, which passes; `failureDiagnosticPresent` reporting `true` is strictly more correct than the plan's prediction, not a regression. Full probe output: `{"healthyToolCount":27,"degradedToolCount":24,"missingTools":["graph_query","graph_write","memory_event"],"failureDiagnosticPresent":true,"returnedFailure":true}`.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Verification Evidence

- `node tests/test-354-registration-diagnostics.cjs` -> `PASS - 12 checks`, exit 0.
- `node docs/reviews/phase-354-probes/registration.cjs 2>/dev/null` -> `{"healthyToolCount":27,"degradedToolCount":24,"missingTools":["graph_query","graph_write","memory_event"],"failureDiagnosticPresent":true,"returnedFailure":true}`.
- `grep -c "process.stdout" lib/mcp/register-core-tools.cjs` -> `0`.
- `grep -n "getRegistrationHealth" lib/mcp/tools/status.cjs` -> two matches, both inside the `status_read` handler.
- `node scripts/build-connector-registry.cjs --check` -> `connector-registry: OK`, exit 0 (no connector drift from the one added description clause).
- `node scripts/build-orchestration-projection.cjs --check` -> `orchestration-projection: OK`, exit 0.
- `bash tests/run-all-354.sh` -> `PASSED=16 FAILED=0 SKIPPED=3` (3 skips are other not-yet-landed plans' own test files, e.g. 354-15's `test-354-extract-shallow-contract.cjs`, unrelated to this plan); `354: registration diagnostics (SYS-04)` line reads `PASSED`.

## Next Phase Readiness
SYS-04 closed. `status_read` now has a stable, honest `capability_floor.tool_registration` field any future plan can read to detect a partial tool surface without re-deriving it. No blockers for the remaining Phase 354 plans (354-15 SYS-05 is the next open requirement).

---
*Phase: 354-system-integrity-and-theo-integration-independent-research-a*
*Completed: 2026-09-23*

## Self-Check: PASSED

- FOUND: tests/test-354-registration-diagnostics.cjs
- FOUND: lib/mcp/register-core-tools.cjs
- FOUND: lib/mcp/tools/status.cjs
- FOUND: commit 0b246f9c3 (Task 1)
- FOUND: commit 73f42c23b (Task 2)
