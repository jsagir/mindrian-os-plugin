---
phase: 102
plan: 03
subsystem: lib/render + lib/hmi (selector-dispatcher seam)
tags:
  - context-aware-rendering
  - jtbd-aware
  - zone-4-action-footer
  - canon-part-3
  - canon-part-7
  - canon-part-8
canon_parts:
  - "3"
  - "7"
  - "8"
dependency-graph:
  requires:
    - phase-100-03-jtbd-state-io
    - phase-101-04-selector-dispatcher
    - phase-102-01-render-v2-skeleton
    - phase-102-00-jtbd-palettes-md
  provides:
    - render-102-03-jtbd-zone-4-wired
    - zone-4-closed-vocabulary-fence
    - dispatcher-graceful-fallback-on-error
  affects:
    - parallel-sibling-102-02-compaction
    - parallel-sibling-102-04-provenance
    - parallel-sibling-102-05-color-overlay
    - phase-104-call-site-migrations
tech-stack:
  added: []
  patterns:
    - selector-dispatcher-seam-from-render-layer
    - require-cache-surgery-for-error-injection
    - taxonomy-driven-test-fence
key-files:
  created:
    - .planning/phases/102-context-aware-rendering/102-03-SUMMARY.md
  modified:
    - lib/render/render-v2.cjs
    - tests/test-render-v2-jtbd-zone4.cjs
decisions:
  - "Step 2 of render-v2 algorithm fires for both jtbd-set AND jtbd-null+BUILD_ROOM (per CONTEXT D-04 fallback to F.1 canonical-10)"
  - "Footer envelope shape `{ verbs[], shape, rendered }` so composeZones short-paths the pre-formatted body and keeps verbs[] as defense-in-depth fallback (B6 contract)"
  - "Dispatcher errors caught and logged only under MINDRIAN_DEBUG=1; zones.footer stays undefined so callers can still supply a default (Canon Part 3 Rule 2 graceful fallback)"
  - "Algorithm step ordering preserved: step 2 enriches Zone 4; step 6 (operator gates) runs after and may strip footer when JUST_TALK / METHODOLOGY mid-session"
  - "Test fence reads find-bottleneck taxonomy verbs at runtime so a JTBD vocabulary update flips the assertion automatically"
  - "Closed-vocabulary fence: every numbered verb row in Zone 4 MUST be a member of the canonical 10-verb MindrianOS-native set (Canon Part 3)"
metrics:
  start: "2026-05-01T15:34:33Z"
  end: "2026-05-01T15:37:53Z"
  duration: "~3 minutes"
  completed: "2026-05-01"
  tasks: 2
  files_modified: 2
  commits: 2
requirements:
  - HMI-102-03
---

# Phase 102 Plan 03: JTBD-aware Zone 4 (closed 10-verb vocabulary) Summary

JTBD signal from Phase 100 + selector dispatcher from Phase 101 are now wired into render-v2's action footer. Every command output's Zone 4 is JTBD-aware automatically: F.6 verbs from the active job's `next_move_verbs[]` when JTBD is set, F.1 canonical-10 fallback when null, with operator gates (JUST_TALK / METHODOLOGY) and graceful dispatcher-error fallback all preserved.

## Context

Wave 1 of Phase 102 (102-01) shipped the render-v2 skeleton with numbered insertion-point comments (`// 1. Compaction`, `// 2. JTBD-aware Zone 4`, etc.) so Wave 2 plans (102-02..05) could land at the right spot without merge churn. This plan (102-03) is one of four Wave-2 siblings touching the same file in parallel; the insertion-point pattern keeps the merge surface clean.

Inputs:
- `lib/hmi/jtbd-state.cjs` (Phase 100-03) — per-room `getCurrent(roomDir).jtbd` reader.
- `lib/hmi/selector-dispatcher.cjs` (Phase 101-04) — `pickShape({ requestedShape: 'F', ... })` returns F.6 when jtbd is set, F.1 (canonical 10) when jtbd is null. Dispatcher already enforces `ensureFreeTextLast` and applies the Mode B Zone 1 prefix at the dispatcher layer.
- `lib/render/JTBD-PALETTES.md` (Phase 102-00) — canonical 10-verb MindrianOS-native vocabulary; the test fence anchors against this contract.

Output contract: render-v2's Zone 4 (the action footer) is now drawn from the closed 10-verb set, ordered by JTBD when a JTBD is active.

## What Shipped

### Task 1 — `lib/render/render-v2.cjs` step 2 wired (commit `aa07bb3`)

Replaced the placeholder block in render-v2's `render()` between defensive defaults and the operator gate (step 6) with the concrete dispatcher call. The wiring computes `shouldFireZone4` as:

```
zones.footer === undefined
  AND operator !== 'JUST_TALK'
  AND operator !== 'METHODOLOGY'
  AND (jtbd OR operator === 'BUILD_ROOM')
```

When the predicate holds, `selector-dispatcher.pickShape({ requestedShape: 'F', roomDir, operator, tier, payload: {} })` is invoked. The dispatcher returns `{ shape: 'F.6' | 'F.1', rendered: { zones, contract } }`; render-v2 lifts the verb array off `result.rendered.contract.verbs` and the pre-formatted body off `result.rendered.zones.body` into the local zones envelope as:

```js
zones.footer = {
  verbs: result.rendered.contract.verbs.slice(),
  shape: result.shape,
  rendered: result.rendered.zones.body,
};
```

The composeZones B6 contract already handles all three footer shapes (string, `{ rendered }`, `{ verbs[] }`) — short-pathing on `.rendered` and falling back to numbered `▷` lines on verbs[]. Algorithm step ordering is preserved: step 6 (operator gates) runs after this step, so `JUST_TALK` suppression and `METHODOLOGY` mid-session footer-strip override the enrichment correctly.

Dispatcher exceptions are caught and surfaced as `[render-v2] zone4 dispatcher error: <80-char-clip>` only when `MINDRIAN_DEBUG=1`; otherwise the catch is silent and `zones.footer` stays undefined, allowing the caller (or downstream default) to still supply a footer.

Smoke test from Plan §Task 1 verify passed first try:

```
zone4 wired OK
```

### Task 2 — `tests/test-render-v2-jtbd-zone4.cjs` regression fence (commit `eab8889`)

Replaced the Wave-0 `process.exit(0)` stub with a 6-IIFE harness covering every contract clause from the plan frontmatter `must_haves.truths`:

| # | Scenario | Frontmatter clause |
|---|----------|---------------------|
| 1 | `jtbd_verbs` — find-bottleneck + BUILD_ROOM emits taxonomy verbs + Free-Text last | "When jtbd non-null AND no caller-supplied footer, render-v2 calls Phase 101 selector-dispatcher pickShape requestedShape:'F'" + "Returned F.6 verbs become Zone 4" |
| 2 | `null_fallback` — jtbd=null + BUILD_ROOM emits F.1 canonical 10, Free-Text last | "When jtbd null, Zone 4 falls back to canonical 10 (existing F.1 behavior)" |
| 3 | `just_talk_suppress` — JUST_TALK returns suppressed:true regardless of jtbd | "Operator JUST_TALK suppresses Zone 4 entirely" |
| 4 | `methodology_suppress` — METHODOLOGY mid-session strips Zone 4 | "Operator METHODOLOGY mid-session suppresses Zone 4 entirely" |
| 5 | `caller_override` — caller-supplied zones.footer preserved verbatim | "Caller can override by supplying footer explicitly" |
| 6 | `dispatcher_error_graceful` — synthetic throw via require.cache surgery; render does not crash | Plan Task 2 §6 + Canon Part 3 Rule 2 |

Each scenario builds a fresh tmp room (`/tmp/zone4-*`), seeds JTBD state via the real `jtbd-state.cjs` API (no fixtures), and clears the require cache for render-v2 + dispatcher + jtbd-state so module state never leaks between tests. Scenario 6 plants a synthetic `pickShape` that throws via `require.cache[DISPATCHER_PATH] = fakeMod` — the real dispatcher cache is restored in a `finally` so subsequent runs are unaffected.

Closed-vocabulary fence: scenarios 1+2 walk every `▷ N. <verb>` and `▶ N. <verb>` line in the rendered output, matching against the canonical 10-verb set; any verb outside the set fails the test. Scenario 1 reads `lib/hmi/jtbd-taxonomy.json` at runtime so a Phase 100 vocabulary update flips the assertion automatically without a test edit.

Final result: `Phase 102-03 JTBD-aware Zone 4 regression: 6 passed, 0 failed`.

## Verification

| Test | Status |
|------|--------|
| `node tests/test-render-v2-jtbd-zone4.cjs` | 6 passed, 0 failed (exit 0) |
| `node tests/test-render-v2-signature.cjs` (regression) | 5 passed, 0 failed (exit 0) |
| `node tests/test-render-v2-compaction.cjs` (regression — Wave-0 stub) | exit 0 |
| `node lib/render/render-v2.test.cjs` (sibling unit suite) | 12 passed, 0 failed (exit 0) |

All four success-criteria items from the plan satisfied:
- All 102-03-PLAN.md tasks executed (Task 1 + Task 2).
- JTBD-aware Zone 4 wired into render-v2 (closed 10-verb vocabulary per JTBD).
- `tests/test-render-v2-jtbd-zone4.cjs` replaces the stub with a real body, passing 6/6.
- No regression on prior tests (signature 5/5, compaction stub exit 0, render-v2 unit 12/12).

## Key Decisions

1. **Fallback semantics resolved against frontmatter, not Task 2 prose.** Plan Task 2 description for assertion #2 says "Zone 4 NOT auto-populated by dispatcher" for the null+BUILD_ROOM case, but the frontmatter `must_haves.truths` clause and CONTEXT D-04 both state "When jtbd null, Zone 4 falls back to canonical 10 (existing F.1 behavior)." The Task 1 action snippet is explicit: `(jtbd || operator === 'BUILD_ROOM')`. Implementation follows the contract source of truth (frontmatter + CONTEXT + Task 1 action), and the test fence asserts the F.1 fallback behavior. The Task 2 prose is treated as a descriptive miswording, not a contract divergence.

2. **Footer envelope shape `{ verbs, shape, rendered }`.** `result.rendered.zones.body` is the pre-formatted body string the dispatcher already composed (with mode-A `▶` markers and mode-B `▷` only); render-v2 emits this verbatim via composeZones' `.rendered` short-path. The verbs[] field is defense-in-depth so callers / future composers can re-render. `shape` carries the dispatcher's resolved shape (`'F.6'` or `'F.1'`) for downstream introspection.

3. **Dispatcher Mode B prefix stays on the dispatcher's Zone 1 header, never leaking to Zone 4.** The selector-dispatcher applies `applyModeBPrefix` to `result.rendered.zones.header`, but render-v2 only pulls `zones.body` and `contract.verbs` — so the "⚠ Brain unreachable…" line never lands in Zone 4. This is correct per Canon Part 3 (Mode B prefix is a Zone 1 concern; Zone 4 stays content-only).

4. **Require-cache surgery is the cleanest error-injection seam.** Scenario 6 needs to make `require('../hmi/selector-dispatcher.cjs')` return a throwing `pickShape`. Constructing a `new Module(filename, null)` with `loaded:true` and a fake `exports`, then planting it on `require.cache[DISPATCHER_PATH]`, lets render-v2's `require()` short-circuit to the fake without touching disk or proxying the loader. The `finally` block restores the real cache so the rest of the test run uses the genuine dispatcher.

## Deviations from Plan

None — plan executed exactly as written. Two implementation notes worth recording:

- **Plan §Task 1 action snippet had a typo** (`result.rendered.zones?.body || result.rendered.zones?.body` — the same expression on both sides of `||`). Implementation collapsed this to a single `result.rendered.zones.body` reference (with the `&& typeof === 'string'` defense). Not a behavior change; the second clause was unreachable.
- **Plan §Task 2 #2 prose vs frontmatter contract.** See Key Decision 1 above. The implementation honors the frontmatter `must_haves.truths` and CONTEXT D-04, both of which require F.1 canonical-10 fallback when jtbd=null + BUILD_ROOM. This is the behavior the Task 1 action snippet's `(jtbd || operator === 'BUILD_ROOM')` predicate implements.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `lib/render/render-v2.cjs` exists | FOUND |
| `tests/test-render-v2-jtbd-zone4.cjs` exists | FOUND |
| `.planning/phases/102-context-aware-rendering/102-03-SUMMARY.md` exists | FOUND |
| Commit `aa07bb3` (Task 1 — wire dispatcher) | FOUND |
| Commit `eab8889` (Task 2 — 6-assertion fence) | FOUND |
