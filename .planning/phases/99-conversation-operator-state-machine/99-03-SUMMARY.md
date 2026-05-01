---
phase: 99-conversation-operator-state-machine
plan: 03
subsystem: lib/render
tags: [renderer, contract, stub, operator, phase-99, canon-part-3, canon-part-4, canon-part-7]
canon_parts: [3, 4, 7]
dependency_graph:
  requires:
    - "Phase 99-01 (operator state primitive; pre-baked decision in CONTEXT.md D-03 + D-16)"
    - "Phase 99-02 (NL classifier; pre-baked decision in CONTEXT.md D-10 + D-11)"
    - "CLAUDE.md Decision #15 (ROOM.md per directory)"
    - "Phase 87 invariants (zero new runtime deps; CJS only)"
  provides:
    - "lib/render/render-v2.cjs render(zones, mode, operator, tier) import surface"
    - "OPERATORS frozen array (5 canonical names)"
    - "Phase 99-04 hooks unblocked (can require renderer today)"
    - "Phase 99-05 /mos:operator command unblocked (can require renderer today)"
    - "Phase 102 byte-stable import surface (replace internals without changing callers)"
  affects:
    - "lib/render/ (NEW directory)"
    - "lib/memory/run-feynman-tests.cjs (TEST_FILES array +1)"
tech-stack:
  added: []
  patterns:
    - "Contract-only stub pattern (ship the seam, not the muscle; Canon Part 7)"
    - "Frozen vocabulary export (Object.freeze on canonical operator array)"
    - "Provenance tag in stub envelope (_stub: 'phase-99-03' for caller detection)"
    - "rendered:false sentinel for Phase 102 swap detection"
key-files:
  created:
    - "lib/render/render-v2.cjs (93 lines, contract surface + no-op stub)"
    - "lib/render/render-v2.test.cjs (8 IIFE scenarios, 12 assertions)"
    - "lib/render/ROOM.md (ICM Layer 0 identity)"
    - ".planning/phases/99-conversation-operator-state-machine/99-03-PLAN.md (this plan)"
  modified:
    - "lib/memory/run-feynman-tests.cjs (registered render-v2.test.cjs in TEST_FILES)"
    - ".planning/phases/99-conversation-operator-state-machine/99-CONTEXT.md (restored from main)"
    - ".planning/phases/99-conversation-operator-state-machine/99-DISCUSSION-LOG.md (restored from main)"
decisions:
  - "Contract-only ship: Phase 99-03 ships the seam (import surface) and Phase 102 ships the muscle (rendering logic). Canon Part 7 applied at the phase-contract level."
  - "5 canonical operators frozen at module load via Object.freeze. Validation rejects non-canonical operators and the error message names BOTH the bad value AND each of the 5 canonical names so callers (and Phase 102) inherit the same fence."
  - "JUST_TALK as null/undefined default per Phase 99 CONTEXT.md D-04 (filing is opt-in)."
  - "Stub does NOT validate mode or tier -- Phase 102 owns those. Avoids over-fencing pre-renderer state."
  - "rendered:false + _stub:'phase-99-03' provenance pair lets any caller deterministically detect pre-Phase-102 environment without parsing import metadata."
metrics:
  duration: "~12 minutes"
  completed_date: "2026-05-01"
  tasks: 3
  files_created: 3
  files_modified: 3
  test_assertions: 12
  test_scenarios: 8
  test_status: "GREEN (12/12 passing)"
---

# Phase 99 Plan 03: Renderer Integration Contract Summary

JWT-style import-surface seam shipped: `lib/render/render-v2.cjs` exposes the canonical `render(zones, mode, operator, tier)` signature today as a no-op pass-through stub so Phase 99-04 hooks and Phase 99-05 `/mos:operator` command can wire against it immediately, while Phase 102 retains full freedom to replace the internals without touching any caller.

## What Shipped

Three files plus one runner registration land the renderer integration contract:

- **`lib/render/render-v2.cjs`** -- 93-line contract surface. Exports `{ render, OPERATORS }`. `render()` validates the operator against the 5-element frozen array (JUST_TALK / EXPLORE_CAPTURE / BUILD_ROOM / METHODOLOGY / DECISION_GATE), defaults to JUST_TALK when null/undefined per Phase 99 CONTEXT.md D-04, throws on invalid values with a message naming the bad value AND each canonical name, and returns the envelope `{ zones, mode, operator, tier, rendered: false, _stub: 'phase-99-03' }`. The `rendered: false` field is the Phase 102 sentinel; the `_stub` provenance tag lets callers detect pre-renderer state.

- **`lib/render/render-v2.test.cjs`** -- 8 IIFE scenarios with 12 total assertions. 5-operator round-trip per canonical operator; JUST_TALK default for both undefined and null; throw-on-invalid (with substring assertions on bad-value AND each of the 5 canonical names); envelope shape stable (exactly 6 keys); mode passthrough across cli / desktop / cowork / arbitrary string; tier passthrough across tier-0 / mode-a / mode-b / arbitrary string; OPERATORS export frozen and equals the 5 canonical names. Test runs against the IIFE harness pattern from `tests/test-cascade-side-channel.cjs`.

- **`lib/render/ROOM.md`** -- ICM Layer 0 identity per CLAUDE.md Decision #15. Names the files, the contract signature, the phase-status delta (99-03 stub now / 102 muscle later), the canon parts (3, 4, 7), and the downstream consumers (99-04 hooks, 99-05 command, 102 real renderer).

- **`lib/memory/run-feynman-tests.cjs`** registration -- `path.join(REPO_ROOT, 'lib', 'render', 'render-v2.test.cjs')` appended to TEST_FILES with a Phase 99-03 marker comment so the existing CI runner picks up the contract regression fence on every run.

## Why It Matters

Phase 99 is the dependency layer below v1.12.3. Phase 99-04 (hooks) and Phase 99-05 (`/mos:operator` command) plan to import the renderer surface. Phase 102 owns the actual renderer. Without 99-03 the downstream plans would either (a) wait on Phase 102 (sequencing kink) or (b) inline the stub and create version-skew when Phase 102 lands.

99-03 short-circuits the kink by shipping the seam now. The import surface is byte-stable: Phase 102 can rewrite the entire body of `render()` without changing any caller's `require()` line.

The throw-on-invalid pattern with the 5-canonical-name message is intentional: it propagates the validation fence to Phase 102. Whatever Phase 102 ships, it MUST honor the same vocabulary or these tests fail. The OPERATORS export is `Object.freeze`-d to make 6th-operator additions an explicit code change, which CONTEXT.md D-03 designates as Gate 1 review territory.

## Tasks Executed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | RED test skeleton (8 IIFE scenarios) | f1500ad | lib/render/render-v2.test.cjs, lib/memory/run-feynman-tests.cjs |
| 2 | GREEN stub implementation | 5d8a2e2 | lib/render/render-v2.cjs |
| 3 | ROOM.md ICM Layer 0 | 9850312 | lib/render/ROOM.md |

Plus the scaffolding commit at `6c77980` (CONTEXT + DISCUSSION-LOG restored from main + 99-03-PLAN.md authored).

## Verification

All 12 assertions across 8 IIFE scenarios pass GREEN:

```
Phase 99-03 renderer contract stub: 12 passed, 0 failed
```

Smoke checks executed inline:

- `node -e "require('./lib/render/render-v2.cjs').render({a:1}, 'cli', 'BUILD_ROOM', 'mode-a')"` -> `{ zones: { a: 1 }, mode: 'cli', operator: 'BUILD_ROOM', tier: 'mode-a', rendered: false, _stub: 'phase-99-03' }`. Confirms passthrough.
- `node -e "require('./lib/render/render-v2.cjs').render({}, 'cli', 'NOPE', 'mode-a')"` throws: `Phase 99-03 render: invalid operator "NOPE". Canonical values: JUST_TALK, EXPLORE_CAPTURE, BUILD_ROOM, METHODOLOGY, DECISION_GATE.`. Confirms validation fence + fence-message contract.

## Deviations from Plan

None -- plan executed exactly as written.

The plan was authored against Phase 99 CONTEXT.md D-16 (renderer signature) + D-17 (graceful degradation) + D-03 (operator vocabulary) + D-04 (JUST_TALK cold-start default). Each task landed against its acceptance criteria with no auto-fixes triggered.

## Self-Check: PASSED

- `lib/render/render-v2.cjs` exists -> FOUND
- `lib/render/render-v2.test.cjs` exists -> FOUND
- `lib/render/ROOM.md` exists -> FOUND
- `lib/memory/run-feynman-tests.cjs` includes Phase 99-03 marker -> FOUND
- Commit `f1500ad` (RED test) -> FOUND
- Commit `5d8a2e2` (GREEN stub) -> FOUND
- Commit `9850312` (ROOM.md) -> FOUND
- Commit `6c77980` (plan scaffold) -> FOUND
- Test runs GREEN -> 12/12 passing

## Downstream

- **Phase 99-04 (hooks):** can `require('lib/render/render-v2.cjs').render` today; SessionStart restore + PostToolUse PR rendering paths unblock.
- **Phase 99-05 (`/mos:operator` command):** can `require('lib/render/render-v2.cjs').render` today; Shape E inspection output unblocks.
- **Phase 102 (real renderer):** byte-stable import surface contract. Replace the body of `render()` with the per-operator switch from CONTEXT.md D-16. The 12-assertion contract test will continue to pass as a regression fence (existing tests assume `rendered: false`; Phase 102 will need to update those assertions to `rendered: true` when it lands -- a one-line test edit).

No new runtime dependencies. No file imports outside the new `lib/render/` directory. Phase 87 invariants honored.
