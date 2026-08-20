# Phase 259: Plugin-Side Gate Trust (parallel-safe, early) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-08-20
**Phase:** 259-plugin-side-gate-trust-parallel-safe-early
**Areas discussed:** 429 retry policy specifics, VOID trigger scope

---

## 429 retry policy specifics

| Option | Description | Selected |
|--------|-------------|----------|
| 3 retries, honor Retry-After exactly | Standard rate-limit handling | ✓ |
| 1 retry only, minimal delay | Fastest fail-through | |

**User's choice:** 3 retries, honor Retry-After header exactly

| Option | Description | Selected |
|--------|-------------|----------|
| Exponential backoff starting at 500ms | Standard pattern, adaptive | ✓ |
| Fixed 1s between every retry | Simpler, less adaptive | |

**User's choice:** Exponential backoff starting at 500ms

| Option | Description | Selected |
|--------|-------------|----------|
| New sentinel: rate_limited | Distinguishes overloaded from actually down | ✓ |
| Fall through to BRAIN_UNREACHABLE | Simpler, loses distinction | |

**User's choice:** New sentinel: rate_limited

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse brain-capture-server.cjs, new test file | No duplicate mock infrastructure | ✓ |
| Standalone test with inline mock | Fully self-contained | |

**User's choice:** Reuse brain-capture-server.cjs, new test file

---

## VOID trigger scope

| Option | Description | Selected |
|--------|-------------|----------|
| All three: hard errors, timeouts, malformed data | Matches verify-never-predict discipline | ✓ |
| Hard errors only | Narrower trigger | |

**User's choice:** All three: hard errors, timeouts, malformed data

| Option | Description | Selected |
|--------|-------------|----------|
| Name every failed row + trigger type | Actionable re-run, matches honest-refusal doctrine | ✓ |
| Bare VOID status only | Simpler output | |

**User's choice:** Name every failed row + trigger type

| Option | Description | Selected |
|--------|-------------|----------|
| Hard non-zero exit on VOID | Prevents automation from treating VOID as success | ✓ |
| Soft exit 0 with VOID status printed | Caller responsible for parsing | |

**User's choice:** Hard non-zero exit on VOID

| Option | Description | Selected |
|--------|-------------|----------|
| Human explicitly re-runs | Avoids silently retrying past a real problem | ✓ |
| Auto-retry once, then VOID for real | Handles transient blips automatically | |

**User's choice:** Human explicitly re-runs

---

## Claude's Discretion

- Exact `rate_limited` sentinel shape/property names beyond "a new distinct sentinel."
- Exact VOID output format (JSON/plain text/table), consistent with
  check-flagship-floor.cjs's existing PASS/FAIL/MISS conventions.

## Deferred Ideas

None. 6 todo.match-phase candidates reviewed, none folded (generic keyword overlap only,
none genuinely about TRUST-01/TRUST-02's scope).
