---
phase: 101-selector-library-jtbd-aware
plan: 04
subsystem: hmi/selector-library
tags: [hmi, dispatcher, selector, shape-f1, shape-f6, shape-g, shape-h, integration-point]
canon_parts: [Part 3]
requirements: [HMI-101-04, HMI-101-06]
dependency_graph:
  requires:
    - 101-01-SUMMARY.md (lib/hmi/shape-f6-renderer.cjs)
    - 101-02-SUMMARY.md (lib/hmi/shape-g-renderer.cjs)
    - 101-03-SUMMARY.md (lib/hmi/shape-h-renderer.cjs)
    - lib/hmi/jtbd-state.cjs (Phase 100-03)
    - lib/hmi/jtbd-taxonomy.json (Phase 100-01)
  provides:
    - lib/hmi/selector-dispatcher.cjs (the SOLE entry point for shape rendering)
    - lib/hmi/shape-f1-fallback.cjs (HMI-101-06 fallback when Phase 88.2 absent)
    - tests/test-selector-dispatcher.cjs (9-assertion harness)
  affects:
    - Phase 102 renderer (will call ONLY this dispatcher)
    - Phase 104 per-command code (will call ONLY this dispatcher)
    - Phase 88.2 (when it ships shape-f1-renderer.cjs, dispatcher prefers it)
tech_stack:
  added: []
  patterns:
    - "Single-entry-point integration (Phase 102 + 104 callers never hit individual shape modules)"
    - "Try/MODULE_NOT_FOUND fallback for forward-compat with Phase 88.2 module"
    - "Defense-in-depth Free-Text-last invariant (D-10) at dispatcher level"
    - "Try/catch wrapping the entire body (no-throw invariant)"
    - "Fallthrough discrimination on shape-renderer return shape"
key_files:
  created:
    - lib/hmi/selector-dispatcher.cjs (129 lines, < 150 cap)
    - lib/hmi/shape-f1-fallback.cjs (80 lines)
    - tests/test-selector-dispatcher.cjs (308 lines, 9 assertions)
  modified: []
decisions:
  - "Dispatcher reads JTBD state per D-07 (callers do not pass jtbd through payload)"
  - "F + null-jtbd loads Phase 88.2 module first, falls back to inline canonical-10 (HMI-101-06)"
  - "F.6 fallthrough (degenerate verb set / unknown jtbd) routes to F.1 path automatically"
  - "G fallthrough returns shape:'E' with passthrough:true (caller renders Action Report)"
  - "H error returns shape:'error' with the renderer's 3-line envelope intact"
  - "Free-Text defense in depth on F.6/F.1 outputs only (G/H/passthrough untouched)"
  - "ensureFreeTextLast appends a body row when injecting (keeps zones.body in sync)"
metrics:
  duration_minutes: 4
  completed_date: 2026-05-01
  task_count: 3
  file_count: 3
  assertion_count: 9
---

# Phase 101 Plan 04: Selector Dispatcher + F.1 Fallback Summary

Built the single integration point for HMI shape rendering plus the HMI-101-06 F.1 keyboard fallback so Phase 102 and Phase 104 can call one module instead of three.

## What shipped

### lib/hmi/selector-dispatcher.cjs (129 lines)

Single export `pickShape({ requestedShape, roomDir, operator, tier, payload })` returning one of:

- `{ shape: 'F.6' | 'F.1', rendered: { zones, contract } }` for F path
- `{ shape: 'G' | 'H', rendered: { zones, contract } }` for matrix/timeline
- `{ shape: 'E', passthrough: true, fallthroughFrom: 'G' }` when G degenerates
- `{ shape: 'A'|'B'|'C'|'D'|'E', passthrough: true }` for renderer-side shapes
- `{ shape: 'error', rendered: { error, detail } | { error: 3-line-envelope } }` on any failure

Routing rules (all from 101-04-PLAN must_haves):

| requestedShape | jtbd state    | dispatch                                                       |
|----------------|---------------|----------------------------------------------------------------|
| F              | non-null      | F.6; on fallthrough, recurse into F.1 path                     |
| F              | null          | F.1 (Phase 88.2 module preferred, HMI-101-06 fallback otherwise)|
| G              | (n/a)         | Shape G; degenerate matrix -> shape:'E' passthrough            |
| H              | (n/a)         | Shape H; invalid input -> shape:'error' with 3-line envelope   |
| A/B/C/D/E      | (n/a)         | passthrough (caller renders per skills/ui-system/SKILL.md)     |
| anything else  | (n/a)         | shape:'error' with 'unknown shape: X' detail                   |

### lib/hmi/shape-f1-fallback.cjs (80 lines)

HMI-101-06 implementation. 10-verb canonical vocabulary hardcoded:

```
Run Methodology, Reformulate, Spawn Sub-Agent, Navigate Graph,
Devil's Advocate, Scenario Plan, Synthesize, Bank Opportunity,
Defer, Free-Text
```

Free-Text always last (Canon Part 3 + D-10). Mode A (tier >= 2) sets `▶` on a matching `recommendedVerb`; Mode B (tier < 2) renders `▷` on every row (no marker).

Used ONLY by `selector-dispatcher.cjs` and ONLY when `require('./shape-f1-renderer.cjs')` throws `MODULE_NOT_FOUND` (Phase 88.2 not yet shipped). Once Phase 88.2 lands its real F.1 renderer, the dispatcher silently switches without any code change here.

### tests/test-selector-dispatcher.cjs (308 lines, 9 assertions)

| # | Assertion                  | What it proves                                              |
|---|----------------------------|-------------------------------------------------------------|
| 1 | null_jtbd_to_f1            | F + empty room -> shape 'F.1' with 10 canonical verbs       |
| 2 | jtbd_to_f6                 | F + jtbd 'find-bottleneck' -> shape 'F.6' with taxonomy verbs|
| 3 | g_pass_through             | G with 3 options + 2 criteria -> shape 'G', non-empty body  |
| 4 | g_degenerate_fallthrough   | G with 2 options -> shape 'E' passthrough, fallthroughFrom 'G'|
| 5 | h_pass_through             | H with 2 milestones -> shape 'H', non-empty body            |
| 6 | h_empty_error              | H with empty milestones -> shape 'error' + 3-line envelope  |
| 7 | other_pass_through         | A/B/C/D/E -> { passthrough: true }                          |
| 8 | dispatch_no_throw          | 7 malformed inputs (undefined, null, bad types) -> no throws|
| 9 | free_text_defense          | F.6 result always has Free-Text last, exactly once          |

All 9 GREEN. The 21 wave-1 assertions (F.6 + G + H, 7+7+7) remain GREEN.

## Decisions Made

1. **Dispatcher owns JTBD read.** D-07 invariant: callers pass `roomDir`, dispatcher reads `lib/hmi/jtbd-state.cjs`. This keeps F.6 / F.1 renderers stateless and lets the dispatcher graceful-fallback on read errors (returns null jtbd -> F.1 path).
2. **Fallthrough recursion not chained calls.** When F.6 returns `{ fallthrough: true }` (degenerate verb set / unknown jtbd), `dispatchF` calls `dispatchF1` directly instead of returning the fallthrough up to the caller. The caller never sees fallthrough markers — they get a normal `{ shape: 'F.1', rendered }`.
3. **G degenerate -> E passthrough, not F.1.** G's spec says "degenerate matrix falls through to E"; the dispatcher honors this and signals it with `fallthroughFrom: 'G'` so callers know it's a downgrade vs. an explicit E request.
4. **H error preserved as 3-line envelope.** Shape H emits Canon Part 3 Rule 2 envelopes natively; dispatcher passes them through unchanged under shape:'error' so the caller renders the same string the H renderer would have rendered standalone.
5. **Free-Text invariant runs only on F.6/F.1.** G has its own footer-verb scheme (`/mos:scenario-plan` etc.); H has its own verb footer (`/mos:act` etc.). Defense-in-depth would corrupt those, so `ensureFreeTextLast` only mutates outputs whose `contract.verbs` is an array.
6. **129-line dispatcher beats 150-line cap.** Original 170-line draft trimmed by collapsing the API docstring; logic unchanged.

## Self-Check: PASSED

Verified files exist:
- FOUND: lib/hmi/selector-dispatcher.cjs
- FOUND: lib/hmi/shape-f1-fallback.cjs
- FOUND: tests/test-selector-dispatcher.cjs

Verified commits exist:
- FOUND: d81792d feat(101-04): add shape-f1-fallback.cjs (HMI-101-06)
- FOUND: 99f60f6 feat(101-04): add selector-dispatcher.cjs (single integration point)
- FOUND: a298ce3 test(101-04): add 9-assertion test harness for selector-dispatcher

Verified tests:
- tests/test-shape-f6.cjs: 7/7 GREEN
- tests/test-shape-g.cjs: 7/7 GREEN
- tests/test-shape-h.cjs: 7/7 GREEN
- tests/test-selector-dispatcher.cjs: 9/9 GREEN
- Total: 30/30 assertions GREEN

Verified dispatcher line count: 129 < 150 cap.

## Wave-2 coordination note

Plan 101-05 (Mode A/B integration) runs in parallel and will modify this same `selector-dispatcher.cjs` to layer Mode A (Brain reachable, RECOMMENDED at >= 0.7 confidence) and Mode B (Brain unreachable, no marker) onto the existing routing skeleton. The dispatcher exposes `tier` on its API surface (passed straight through to F.6 / F.1 renderers) which is the integration seam Plan 101-05 will leverage. Plan 101-04 ships only the structural skeleton.
