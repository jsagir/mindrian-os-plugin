---
phase: 196-part8-runtime-slm-guardrail
plan: 04
subsystem: infra
tags: [part8, egress-guard, pretooluse-hook, telemetry, navigation, brain-boundary, canon]

# Dependency graph
requires:
  - phase: 196-03
    provides: "lib/core/part8-egress-guard.cjs classify() (allow/block/ambiguous verdict contract)"
provides:
  - "PreToolUse hook that fires classify() on the mcp__brain_.* matcher and blocks CONTENT-SET with exit 2"
  - "scalars-only Part-8 egress telemetry ontology written through navigation.cjs"
  - "3 additive EVENT_TYPES: brain_egress_blocked/allowed/ambiguous"
  - "hooks.json PreToolUse registration on the Brain matcher (timeout 2000)"
affects: [196-05, part8-egress-gate, hmi-f1-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PreToolUse block-on-exit-2 hook (clone of write-scope-check.cjs stdin -> exit-code contract)"
    - "best-effort scalar-only telemetry through the navigation.cjs Part-9 chokepoint (clone of _logEventBestEffort)"
    - "additive frozen-Set EVENT_TYPES extension (mirror of the 110-02 3-string idiom)"

key-files:
  created:
    - lib/core/part8-egress-ontology.cjs
    - scripts/part8-egress-guard-hook.cjs
  modified:
    - lib/core/navigation/memory-events.cjs
    - hooks/hooks.json

key-decisions:
  - "record(db, info) whitelists forwarded scalars and NEVER spreads the caller info bag, so a hostile raw_payload field cannot leak (D-09)"
  - "hook fails OPEN (exit 0) on any internal error, fails CLOSED (exit 2) only on a real content hit (A3 accepted risk, matches write-scope-check)"
  - "F.1 gate module (196-05) required defensively via try/require so the ambiguous+Brain-available leg degrades to a minimal Part 8 stderr notice until Wave 3 lands"
  - "PreToolUse matcher mirrors the shipped mcp__brain_.* PostToolUse Brain hook string verbatim; in-hook isBrainTool recheck is the OQ-1 backstop"

patterns-established:
  - "Verdict -> EVENT_TYPES map: block/allow/ambiguous -> brain_egress_blocked/allowed/ambiguous"
  - "TAGGED_WITH edge from memory_event to a taxonomy=true category node, all via navigation.cjs (never room.db directly)"

requirements-completed: [PB8-04, PB8-05, PB8-06, PB8-08]

# Metrics
duration: 20min
completed: 2026-07-01
---

# Phase 196 Plan 04: Hook + Telemetry Summary

**The Brain-egress chokepoint is now runtime-enforceable: a PreToolUse hook fires the LOCAL classify() on the mcp__brain_.* matcher, blocks a CONTENT-SET packet with exit 2 before it leaves the machine, and journals every decision as scalars-only typed telemetry through navigation.cjs.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-01
- **Tasks:** 3 completed
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- **Task 1 (PB8-06):** `lib/core/part8-egress-ontology.cjs` -- `record(db, info)` writes a taxonomy category node (`writeDomainNode`, `taxonomy:true`), a `brain_egress_*` memory_event (`logMemoryEvent`), and one `TAGGED_WITH` edge (`writeEdge`), ALL routed through `navigation.cjs` (Part 9 chokepoint, never room.db directly). Scalar sanitizers (`_slug` / `_shortScalar` / `_count`) form the D-09 firewall; `record()` whitelists forwarded fields and never spreads the caller info bag. Best-effort: it never throws. Added the 3 additive EVENT_TYPES to `navigation/memory-events.cjs` mirroring the 110-02 idiom.
- **Task 2 (PB8-04/05/08):** `scripts/part8-egress-guard-hook.cjs` -- clones the write-scope-check stdin -> exit-code contract. Reads `{ tool_name, tool_input, session_id }`, re-checks `isBrainTool` (OQ-1 backstop), runs `classify()`, records best-effort, then branches: `block` -> Part 8 stderr + exit 2; `ambiguous` + Brain-available -> F.1 gate (defensive require) + exit 2, else minimal Part 8 notice + exit 2; `ambiguous` + Brain-less -> LOCAL-log + exit 0 (D-08a); `allow` -> exit 0. Fail-OPEN outer wrap + `uncaughtException` backstop (A3).
- **Task 3 (PB8-04):** `hooks/hooks.json` -- one PreToolUse entry on matcher `mcp__brain_.*` (the identical shipped Brain string), `timeout: 2000`, running the guard hook via `node "${CLAUDE_PLUGIN_ROOT}/scripts/part8-egress-guard-hook.cjs"`.

## Verification

- `node lib/core/part8-egress-ontology.test.cjs` -> PASS (PB8-06: scalars-only, navigation-routed, EVENT_TYPES accepted).
- `node tests/part8-egress-guard-hook.test.cjs` -> PARTIAL PASS (PB8-04/05 exit-code legs green; F.1 gate + degrade legs correctly SKIP until `lib/hmi/part8-egress-gate.cjs` lands in 196-05).
- `node -e "..."` hooks.json parse + `part8-egress-guard-hook` + `mcp__brain_` presence -> `hook registered`.
- `bash tests/run-all-196.sh` -> Passed: 4, Failed: 0, Skipped: 0 (hook + ontology legs now PASSING).
- D-09 grep: no `...info` / `Object.assign(...info)` spread in the ontology -> CLEAN.

## Deviations from Plan

None - plan executed exactly as written. The plan named the record signature two ways (`record({verdict...}, {toolName})` in prose vs `record(db, info)` in the Wave-0 test); the shipped test contract (`record(db, info)`) is authoritative and was followed.

## Tri-Polar Notes

The PreToolUse hook fires on the CLI harness; the identical `mcp__brain_.*` matcher covers the Desktop/Cowork MCP tool-call path, so the boundary holds surface-agnostically.

## Self-Check: PASSED

- FOUND: lib/core/part8-egress-ontology.cjs
- FOUND: scripts/part8-egress-guard-hook.cjs
- FOUND: lib/core/navigation/memory-events.cjs
- FOUND: hooks/hooks.json
- FOUND commit a6f7d136 (Task 1), a589ca41 (Task 2), 517b3366 (Task 3)
