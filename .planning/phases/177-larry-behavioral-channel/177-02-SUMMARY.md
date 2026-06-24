---
phase: 177-larry-behavioral-channel
plan: 02
subsystem: hmi
tags: [behavioral-channel, dial, register-hud, control-path, bch-10, bch-16]
requires:
  - lib/core/sensors/sensor-types.cjs (POSTURE_IDS frozen 3)
  - lib/hmi/selector-dispatcher.cjs (F.7 branch precedent)
provides:
  - lib/hmi/dial-selector.cjs (pure 4-arrow HUD + keystroke reducer + synchronous register_override scratch)
  - "selector-dispatcher F.7-dial shape branch"
affects:
  - lib/hmi/selector-dispatcher.cjs
tech-stack:
  added: []
  patterns:
    - "pure CJS module (no I/O, no Brain wire) mirroring the F.7 renderer precedent"
    - "render-v2.cjs:199-205 TTY-gating idiom (glyph in both modes; ANSI SGR gated on tty)"
    - "additive F_SUBSHAPES extension preserving the 120-01 R1 byte-stability invariant"
key-files:
  created:
    - lib/hmi/dial-selector.cjs
  modified:
    - lib/hmi/selector-dispatcher.cjs
    - tests/test-bch-10-register-hud.cjs
    - tests/test-bch-16-keypress-latency.cjs
    - tests/test-selector-dispatcher-120-01.cjs
decisions:
  - "register_override scratch is GREENFIELD (no existing escape-hatch parse site per 177-RESEARCH Q3); this plan ESTABLISHES the synchronous pre-Pass-1 slot only -- the compose consumer is a later wave"
  - "posture rotation is CLAMPED, not wrapped (push_forward <-> hold <-> pull_back is a bounded dial, not a ring)"
  - "dispatched dial result is an OBJECT envelope (renderDialShape shim), not a bare string, so the dispatcher's strict-mode scalar-marker post-processing never sets a property on a string primitive"
metrics:
  duration_min: 6
  completed: 2026-06-24
---

# Phase 177 Plan 02: Larry Behavioral Channel -- Four-Arrow Register HUD + Synchronous CONTROL Path Summary

Greenfield four-arrow register HUD (lib/hmi/dial-selector.cjs) plus the synchronous pre-compose CONTROL path that writes a register_override scratch on a keypress, wired into the selector-dispatcher as a new F.7-dial shape branch.

## What shipped

- **lib/hmi/dial-selector.cjs** (new, pure CJS, zero deps):
  - `renderDialHud({ investment_level, posture, tty })` renders a four-arrow HUD (up/down for the investment_level Ask<->Tell axis, left/right for the posture axis). The arrow glyphs emit in BOTH TTY and degraded plain-text modes; only the ANSI SGR bytes are gated on `tty` (mirrors render-v2.cjs:199-205). On Desktop/Cowork (no TTY) the HUD degrades to a byte-clean read-only line -- three-surface honored.
  - `reduceKeystroke(register, key)` mutates investment_level ONLY on up/down (fixed 0.1 step, clamped [0,1]) and posture ONLY on left/right (rotated within the frozen POSTURE_IDS, clamped not wrapped). Imports POSTURE_IDS from lib/core/sensors/sensor-types.cjs so the posture axis can never leave the frozen 3. Mints no reach, no posture.
  - `applyControlKeypress(register, key)` / `writeRegisterOverride(scratch, key)` write a `register_override` scratch (`source:'keypress'`) SYNCHRONOUSLY -- the structural pre-Pass-1 slot the compose step reads at turn top, no async hop. No AUDIT row is written here (manual_override @1.0 is Wave 2).
- **lib/hmi/selector-dispatcher.cjs**: new `F.7-dial` branch in `dispatchShapeFSubShape` mirroring the F.7 branch (safeRequire of ./dial-selector.cjs, the inputArgs envelope, the `{ shape, rendered }` return, falling through to the existing no-subshape-renderer error envelope on a missing module). `F_SUBSHAPES` additively appended `'F.7-dial'` (9th entry); F.7 stays the 8th, the prior 7 stay byte-stable. No new shape vocabulary outside pickShape.

## Tests

- `tests/test-bch-10-register-hud.cjs`: 12 real asserts (four arrows in TTY + degraded; degraded string ANSI-clean; up/down move investment_level only; left/right move posture only within the frozen 3; clamp at extremes; posture clamp-no-wrap; reducer purity). Replaces the scaffold stub. GREEN.
- `tests/test-bch-16-keypress-latency.cjs`: 8 real asserts (synchronous return / not a Promise; Up raises investment_level in the override; source:'keypress'; single-axis mutation; writeRegisterOverride writes the scratch in-place; NO audit row / manual_override @1.0; dispatcher F.7-dial returns `{ shape, rendered }` not error). Honest per the plan-checker WARNING 2: it proves the synchronous WRITE and the pure mapping, NOT a phantom compose consumer. Replaces the scaffold stub. GREEN.

## run-all-177 delta

Before (after 177-01): 4 pass / 10 fail. After 177-02: **6 pass / 8 fail**. The two suites this plan owns flipped GREEN:
- `bch-10 register-hud (W1)`: FAILED -> PASSED
- `bch-16 keypress-latency (W1)`: FAILED -> PASSED

The frozen-set drift fences stayed GREEN, confirming no reach minted (frozen 6) and no posture minted (frozen 3):
- `reach-ids-drift (frozen 6)`: PASSED
- `posture-ids-drift (frozen 3)`: PASSED

The remaining 8 RED suites belong to later waves (bch-18/01/04/12/15/07/08/09) and are out of this plan's scope.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] test-selector-dispatcher-120-01.cjs T1 length assertion**
- **Found during:** Task 2 (dispatcher wiring)
- **Issue:** The existing 120-01 regression test hardcodes `F_SUBSHAPES.length === 8`. Appending `'F.7-dial'` made it 9, failing T1 directly because of my change (in-scope regression).
- **Fix:** Updated T1 to assert length 9, F.7 stays at index 7, and `'F.7-dial'` is the 9th entry. The prior-7 byte-stability assertion (the actual R1 invariant T1 protects) is unchanged and still passes.
- **Files modified:** tests/test-selector-dispatcher-120-01.cjs
- **Commit:** 4d42d565

**2. [Rule 1 - Bug] strict-mode property-set on a string primitive**
- **Found during:** Task 2 (dispatcher wiring)
- **Issue:** The dispatcher's post-processing (`appendAskUserQuestionTrailer`) sets scalar markers on `result.rendered`. If the dial renderer returned a bare HUD string, that set would throw a TypeError under `'use strict'`.
- **Fix:** Added a `renderDialShape` object-envelope shim (`{ shape, hud, zones:{header} }`) and pointed the dispatcher branch at it, so post-processing always mutates a well-formed object. The other post-processors (`applyModeBPrefix`, `applyArchetypeRouting`) already guard on object/zones, so they no-op safely.
- **Files modified:** lib/hmi/dial-selector.cjs, lib/hmi/selector-dispatcher.cjs
- **Commit:** 4d42d565

## Known Stubs

None. The register_override scratch is intentionally a structurally-ready slot with no compose consumer in Wave 1 (locked decision; the consumer lands in a later wave per the plan-checker WARNING 2). This is documented, not a stub that blocks the plan goal.

## Threat Flags

None. The two axes are MOVED (investment_level, posture over the frozen 3); no reach minted, no posture minted, no Brain wire opened, no AUDIT write. Register state stays LOCAL (Part 8). The drift fences confirm by construction.

## Self-Check: PASSED

- lib/hmi/dial-selector.cjs: FOUND
- commit eff224ae (Task 1): FOUND
- commit 4d42d565 (Task 2): FOUND
- node tests/test-bch-10-register-hud.cjs exits 0: confirmed
- node tests/test-bch-16-keypress-latency.cjs exits 0: confirmed
