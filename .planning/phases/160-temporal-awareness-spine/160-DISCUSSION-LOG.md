# Phase 160: temporal-awareness-spine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-06-16
**Phase:** 160-temporal-awareness-spine
**Areas discussed:** Capturing "now", Gate across 3 surfaces, Recency math placement, Sensor firing model
**Mode:** discuss (Larry voice added per navigator request "add larry to the discussion")

---

## Capturing "now" (Wave 1)

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid: hook seeds, Larry corrects | SessionStart hook seeds Date.now() fallback; Larry corrects from injected currentDate when divergent | ✓ |
| Larry-writes-on-sight only | Pure doctrine; no hook seed; no reference if model never invoked | |
| Hook Date.now() + env timezone | Simplest; never closes the CC-knows-real-date gap | |

**User's choice:** Hybrid: hook seeds, Larry corrects
**Notes:** Larry reframe - the currentDate is injected into the MODEL context, not guaranteed in hook stdin, so only Larry is guaranteed to see the truth. Hybrid covers both the hook-can't-see-it trap and the model-never-runs case. Captured as D-01 + D-01a (options.now seam for tests).

---

## Gate across 3 surfaces (Wave 5)

| Option | Description | Selected |
|--------|-------------|----------|
| Shared lib/core filing chokepoint | One enforcement function CLI + MCP both call; surfaces render Shape F their own way | ✓ |
| Per-surface entry points | Enforce separately in each; two copies of the rule, drift risk | |
| Filing hook that blocks | Fragile, effectively CLI-only | |

**User's choice:** Shared lib/core filing chokepoint
**Notes:** Larry reframe - the gate is a CONTRACT ("no real-world artifact files without valid_at"), not a prompt. Enforcement in one place, rendering per surface. Tri-polar by construction. Captured as D-02.

---

## Recency math placement (Wave 3)

| Option | Description | Selected |
|--------|-------------|----------|
| App-side blend + golden-file guard | SELECT date cols, ORDER BY created_at DESC, blend 0.995^delta-h in JS; frozen-output fixture guards hot path | ✓ |
| SQL-side decay expression | Decay in ORDER BY; harder to freeze-test | |
| Hybrid (SQL order, app blend for reach) | More moving parts | |

**User's choice:** App-side blend + golden-file guard
**Notes:** Larry reframe - cortex nodes are a small bounded set, so SQL-vs-app speed is a rounding error; optimize for testability and a visible decay constant. Captured as D-03.

---

## Sensor firing model (Wave 5)

| Option | Description | Selected |
|--------|-------------|----------|
| Scheduled backstop + explicit flag | Sentinel sweeps on Phase 145 cadence; R11 gate catches at source; has_event_date set at write by type | ✓ |
| Per-turn insight sensor | Fires every turn; taxes every turn for a slow debt | |
| Per-turn with freshness throttle | Re-scan only when new undated nodes; more state | |

**User's choice:** Scheduled backstop + explicit flag
**Notes:** Larry reframe - temporal blindness is slow-accumulating debt, not an urgent signal; match cadence to phenomenon. Gate is the front line, sentinel is the backstop. has_event_date explicit (not inferred) keeps the gate deterministic. Captured as D-04.

---

## Claude's Discretion

- chrono-node integration shape (import surface, resolver module location) - constrained by D-01a + verified zero-dep posture.
- Bitemporal migration file naming/sequencing - follow phase-109 additive-idempotent-backfill pattern.
- recency-as-reach-signal: reuse reach_presented vs new EVENT_TYPE - researcher decides against frozen EVENT_TYPES contract (SPEC open question 2).

## Deferred Ideas

- Community summaries / Ebbinghaus auto-pruning / outcome-weighted importance.
- Cross-room unified temporal namespace.
- Legacy ISO timestamp table migration to epoch ms.
- Async/multi-LLM Graphiti-style graph build.
- Timezone configuration UI.
- Transcript per-turn timestamp ingestion.
