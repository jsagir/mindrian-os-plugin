---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "29"
subsystem: egress-guard
tags: [part8, fail-open, rca, owner-decision, e-fail]
requires: ["386-01", "386-35"]
provides:
  - RCA proving the fail-open exits of the hook, callTool and query() with test doubles
  - Owner decision block with the anchored line decision: option-a and outage-count: yes
affects: [386-30]
key-files:
  created:
    - .planning/debug/part8-guard-fails-open-on-load-or-throw.md
  modified: []
key-decisions:
  - "Owner decision 2026-11-06: option A (fail closed with a typed reason; empty payloads pass) plus a count-only local line for each outage (timestamp, tool name class, failure mode; no content)."
requirements-completed: [E-FAIL]
duration: 45min
completed: 2026-11-06
---

# Phase 386 Plan 29: Guard failure RCA and decision Summary

The RCA proves that the Part 8 hook exits 0, and callTool and query() send the payload, when the guard cannot load or throws. The owner chose option A plus a count-only outage line.

## Proven (test doubles, no network, synthetic strings only)

- Hook: guard load throws, classify throws, sanitizer load throws. All exit 0 with empty stderr, for a sprout and for a fake credential. The real guard exits 2 on the credential.
- callTool and query(): classify throws, or the guard require throws. The fake credential reaches the stub wire. The real guard sends 0 fetch calls for it.
- `onFailure: block` never engages: the hook converts its own failures into exit 0. The host acts on it only for exit codes other than 0 or 2, cannot-start, timeout and invalid output (official hooks documentation; end-to-end honouring is UNVERIFIED).
- Guard module count: 172 before plan 386-35, 10 after.

## Decision

decision: option-a, outage-count: yes. See the Owner decision block in the RCA.

## Hand-off to plan 386-30

- Implement option A in the hook, callTool and query(). An empty payload still proceeds, and the empty check must not depend on the guard.
- Add the outage count line: a small local file or event, count only: timestamp, tool name class, failure mode. No payload bytes, no tool arguments.
- Add a test that the line carries no payload content (fake credential and sprout in the payload; assert neither appears in the line).

## Deviations from Plan

None. The plan ended at the decision checkpoint and the Owner decision block was written after the owner answered. No product file changed.

## Self-Check: PASSED
