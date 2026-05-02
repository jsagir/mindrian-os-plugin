---
phase: 105-hmi-compliance-polling
plan: "03"
subsystem: hmi-compliance-poll-hook
tags: [phase-105, hmi-compliance, stop-hook, hook-wrapper, bash-95-01-envelope, canon-part-6-dogfooding, canon-part-7-reuse, canon-part-8-boundary]
canon_parts: [3, 6, 7, 8]
requirements:
  - HMI-105-05
dependency_graph:
  requires:
    - "scripts/hmi-compliance-poll.cjs (Plan 105-01 pollOnce primitive)"
    - "scripts/operator-update.cjs (Phase 99-04 reference for hook entry pattern)"
    - "scripts/jtbd-update.cjs (Phase 100-05 reference)"
    - "hooks/hooks.json existing Stop sibling entries (Phase 99/100/103)"
  provides:
    - "scripts/hmi-compliance-poll.cjs --hook wrapper (BASH-95-01 compliant)"
    - "hooks/hooks.json Stop entry: hmi-compliance-poll.cjs --hook (4th sibling)"
    - "tests/test-hmi-poll-hook.cjs (9-class behavioral fence)"
  affects:
    - "Phase 105-04 e2e integration test (consumes the wired hook)"
    - "Phase 99/100/103 Stop hook chain (additive sibling, byte-identical)"
tech_stack:
  added: []
  patterns:
    - "BASH-95-01 envelope schema strict allowlist (mirror operator-update.cjs)"
    - "Defensive try/catch + always-exit-0 (mirror operator-update.cjs)"
    - "Silent envelope { continue:true, suppressOutput:true } default"
    - "Stdin-as-fd-0 read with empty/malformed survival (mirror operator-update.cjs)"
    - "Event-routed hook (only Stop fires work; other events no-op)"
    - "Sibling-entry registration in hooks.json (additive, never modifies existing)"
key_files:
  created:
    - "tests/test-hmi-poll-hook.cjs (282 lines)"
  modified:
    - "scripts/hmi-compliance-poll.cjs (+74 lines: hook wrapper section)"
    - "hooks/hooks.json (+9 lines: 4th Stop sibling entry)"
decisions:
  - "Hook wrapper lives inside scripts/hmi-compliance-poll.cjs gated by --hook flag instead of a separate scripts/hmi-poll-hook.cjs file. Matches the principle of co-locating the polling primitive with its hook entry point and avoids the duplicated 'safe-require + active-room resolve' boilerplate that a separate file would carry. Sister scripts (operator-update.cjs, jtbd-update.cjs) take the same single-file approach."
  - "Only Stop fires pollOnce(). Other events (SessionStart, PostToolUse, UserPromptSubmit) emit silent envelope without doing any work. This prevents accidental UI compliance scans from being triggered by unrelated tool calls and keeps the hook chain frame budget small."
  - "Stop hook entry is the 4th sibling in hooks.json Stop array, registered AFTER the existing Phase 99/100/103 entries. Sibling ordering is informational (Claude Code fires all entries in-order each Stop), but appending preserves the byte-identical guarantee the regression tests assert."
  - "HOOK_ALLOWED_KEYS exposed on _internal namespace so the test harness can assert the exact BASH-95-01 schema invariant without re-declaring the allowlist."
  - "hookMain() returns silentHookSuccess() in every code path including the success-after-poll path. The hook never adds additionalContext to the user's turn (per Phase 99-04 D-19 pattern: passive hooks never add context unless explicitly required, and 105-CONTEXT D-01 forbids blocking the user turn)."
metrics:
  duration: "~25 minutes"
  completed: "2026-05-01"
  tasks_completed: 3
  files_changed: 3
  files_created: 1
  files_modified: 2
  test_classes: 9
  test_pass_rate: "9/9 GREEN"
---

# Phase 105 Plan 03: HMI Compliance Poll Hook Wrapper Summary

Stop hook wiring for the Phase 105-01 polling primitive. Extends `scripts/hmi-compliance-poll.cjs` with a `--hook` flag that reads the BASH-95-01 stdin envelope, fires `pollOnce()` on Stop, and emits a compliant silent envelope. Adds the 4th sibling Stop entry to `hooks/hooks.json` while preserving the Phase 99/100/103 entries byte-identically.

## What Shipped

### `scripts/hmi-compliance-poll.cjs` (+74 lines, additive)

Hook wrapper section appended after existing CLI mode handler. New exports on `_internal`:

- `HOOK_ALLOWED_KEYS` -- the strict BASH-95-01 top-level key allowlist as a frozen Set
- `emitHookEnvelope(obj)` -- filters input to allowed keys, defaults `continue:true`, writes JSON to stdout, exits 0
- `silentHookSuccess()` -- emits `{ continue:true, suppressOutput:true }`
- `readStdinJson()` -- reads fd 0, returns parsed JSON or `{}` on any failure (NEVER throws)
- `hookMain()` -- routes by `hook_event_name`. On `Stop`: fires `pollOnce({})` in defensive try/catch, then emits silent success. On any other event (or missing event): silent success without firing the poll.

CLI mode (`--once`, `--json`, `--scan-commands=`, `--scan-scripts=`) is preserved byte-identically. Selecting `--hook` routes to `hookMain()` instead of the legacy `pollOnce` shell.

### `hooks/hooks.json` (+9 lines, additive)

```json
{
  "hooks": [
    {
      "type": "command",
      "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/hmi-compliance-poll.cjs\" --hook",
      "timeout": 3000
    }
  ]
}
```

Appended as the 4th sibling in `hooks.Stop[]`, after:

| # | Entry | Phase |
| - | ----- | ----- |
| 0 | `run-hook.cmd on-stop` | 103 |
| 1 | `operator-update.cjs` | 99-04 |
| 2 | `jtbd-update.cjs stop` | 100-05 |
| 3 | `hmi-compliance-poll.cjs --hook` | 105-03 (NEW) |

The first three entries are byte-identical to their pre-105-03 form (asserted by `test-hmi-compliance-e2e.cjs class 11`).

### `tests/test-hmi-poll-hook.cjs` (282 lines, NEW)

9 assertion classes. All GREEN.

| # | Class | Assertion |
| - | ----- | --------- |
| 01 | module exports | `HOOK_ALLOWED_KEYS` Set + `hookMain` + `emitHookEnvelope` + `silentHookSuccess` + `readStdinJson` exposed on `_internal` |
| 02 | Stop + no-active-room | hook silent, no side-channel written |
| 03 | Stop + active room | side-channel written with full schema (`schema_version`, `status`, `polled_at`, `_provenance.phase='105-01'`) |
| 04 | non-Stop event | SessionStart silent no-op (does NOT fire pollOnce) |
| 05 | malformed stdin | survives -> silent envelope, exit 0 |
| 06 | empty stdin | survives -> silent envelope, exit 0 |
| 07 | envelope schema strict | every emitted envelope contains only BASH-95-01 keys (subset enumerated) |
| 08 | hooks.json registers Stop sibling | 105-03 entry present AND Phase 99/100/103 entries all preserved |
| 09 | latency budget | spawn-fork max < 5000ms (informational) |

## Why This Order Within Wave 2

Plan 105-03 lands the wiring half of Wave 2; 105-04 lands the e2e validation half. The plan was written so 105-03 can ship and run without 105-04 -- the 9 hook-wrapper tests fully fence the new code surface. 105-04 then exercises the wiring through a higher-level boundary (real spawn + real renderer) and adds the `hooks.json` byte-identity gate.

## Reuse Honored (Canon Part 7)

The hook wrapper does NOT re-implement BASH-95-01 envelope handling. It mirrors the exact pattern from `scripts/operator-update.cjs` (Phase 99-04):

- Same `ALLOWED` set of top-level keys
- Same `silentSuccess()` -> `{ continue:true, suppressOutput:true }` shape
- Same `readStdinJson()` resilience (never throws on empty/malformed)
- Same `try { main() } catch (e) { stderr + silentSuccess() }` outer net

Net-new logic is exclusively the routing decision (Stop -> pollOnce, other -> no-op) -- a 6-line `if (evt !== 'Stop') return silentHookSuccess();` plus a wrapped try/catch around `pollOnce({})`.

## Canon Part 8 Boundary

The hook wrapper inherits `pollOnce()`'s zero-Brain-query guarantee. The wrapper itself adds zero requires beyond what the primitive already imports. Source audit (test-hmi-poll-primitive.cjs class 12) confirms: zero forbidden tokens (`brain.mindrian.ai`, `brainQuery`, `pinecone`, `embedQuery`, `brain-client.cjs`, `brain-mcp`); zero non-builtin requires.

The hook never enriches the user's prompt with LOCAL bytes. The poll's only output is a LOCAL side-channel write at `<roomDir>/.mindrian/last-hmi-poll.json`, consumed exclusively by the LOCAL `/mos:hmi-status` renderer.

## Canon Part 6 (Dog-Fooding Mandate)

Phase 105 IS the UI Ruling System self-audit surface. The hook wrapper is what makes the audit run passively after every Larry turn. By shipping the wrapper as a sibling Stop hook (rather than a special-case mode that bypasses the standard hook chain), the polling primitive proves the UI Ruling System claim end-to-end: the room learns about its own UI compliance state through the same mechanism Larry uses to update operator and JTBD state.

## Deviations from Plan

None. The objective specified:
1. Hook wrapper extension to `scripts/hmi-compliance-poll.cjs` -- DONE
2. Stop hook entry in `hooks/hooks.json` -- DONE
3. BASH-95-01 envelope schema honored -- DONE (test 07)
4. Never blocks user turn -- DONE (test 05/06 + e2e test 08)

No CLAUDE.md-driven adjustments needed. No Rule 1-4 deviations applied.

## Commits

| Task | Commit | Files |
| ---- | ------ | ----- |
| 1+2+3 (atomic) | `7a6e543` | scripts/hmi-compliance-poll.cjs, hooks/hooks.json, tests/test-hmi-poll-hook.cjs |

The objective specified atomic commits with `--no-verify`; the script extension, hooks.json sibling entry, and behavioral test ship together because they form a single semantic unit (the hook only works when both the wrapper and the registration exist, and the test fences both surfaces simultaneously).

## Self-Check: PASSED

Files verified on disk:
- `scripts/hmi-compliance-poll.cjs` -- FOUND (modified, +74 lines)
- `hooks/hooks.json` -- FOUND (modified, +9 lines, 4 Stop entries)
- `tests/test-hmi-poll-hook.cjs` -- FOUND (282 lines)

Commits verified in `git log`:
- `7a6e543` feat(105-03): wire Stop hook + hmi-compliance-poll hook wrapper -- FOUND

Regression matrix (all 7 hook-related suites GREEN):
- test-hmi-poll-primitive.cjs       12/12 (Phase 105-01)
- test-hmi-status-command.cjs        9/9  (Phase 105-02)
- test-hmi-poll-hook.cjs             9/9  (Phase 105-03 NEW)
- test-hmi-compliance-e2e.cjs       11/11 (Phase 105-04 NEW)
- test-operator-hooks.cjs           12/12 (Phase 99-04 sibling)
- test-jtbd-hook-integration.cjs     9/9  (Phase 100-05 sibling)
- test-memory-hook-integration.cjs  10/10 (Phase 103-05 sibling)

Total: 62/62 assertions GREEN. Zero regressions in Phase 99/100/103 sister hook tests.
