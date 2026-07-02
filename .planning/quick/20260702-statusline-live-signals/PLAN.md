---
kind: quick
slug: 20260702-statusline-live-signals
branch: feat/v1.15-shape-brain-phases
canon_parts: [7, 8]
---

# Quick Task: Statusline LIVE signals (close the two 192-04 NAMED DEBTS)

## Problem

The navigator statusline "feels dead": every field is static except the context
meter. Phase 192-04 made the STANCE chip live but left two NAMED DEBTS in
`lib/statusline/cockpit-signals.cjs`:

1. **next-move** -- `deriveNextMove()` returns `jtbd || governing-thought || 'continue'`.
   There is NO wire to the real routed next step, so it shows "continue" forever.
2. **room-health** -- the reader `readHealthStatus()` reads `~/.mindrian/room-health.json`
   `{status:'sound'|'drift'|'broken'}`, but NOTHING writes that file (doctor writes
   `doctor-applied.json`), so health is always absent -> static green.

## Scope (LOCAL only, hot-path cheap -- Part 8)

1. **LIVE NEXT-MOVE.** New `lib/statusline/next-move-cache.cjs` (read+persist a
   `~/.mindrian/next-move.json` side-channel, mirroring the room-health / stance
   side-channel idiom). `persistNextMove(offer)` is called from the SHIPPED router
   chokepoint `navigation-engine-offer.suggestNext()` (reuse, not fork) whenever a
   real offer resolves; it clears on abstention. `deriveNextMove()` reads the cached
   routed step FIRST, then falls back to `jtbd`, then `governing-thought`, then
   `'continue'`. The hot path (context-monitor) does one cheap file read, no router
   call, no Brain, no network.

2. **LIVE HEALTH.** New `lib/statusline/room-health-cache.cjs` (`persistRoomHealth`
   + `statusFromBindReport`). Wire the WRITE into `scripts/doctor.cjs --bind-check`
   (the existing LOCAL room-health job): map its `report.healthy` to
   `sound|drift|broken` and write the cache the already-shipped reader consumes.

3. **PLURAI EVAL.** `evals/plurai/12-statusline-liveness-fidelity.csv` (SYNTHETIC /
   dogfood only, Part 8) + deterministic local parity gate
   `lib/core/statusline-liveness-gate.cjs` (options-ignored, pattern of
   `rs-corpus-quality-gate.cjs`) judging live vs stale/placeholder. README row +
   judge model fable.

4. **TESTS.** `tests/test-statusline-live-signals.cjs` (deriveNextMove reflects a
   changed routed step; health signal changes when room-health.json changes;
   byte-stable defaults when both sources absent). `tests/test-statusline-liveness-gate.cjs`
   (CSV parity).

## Invariants

- No em-dashes. LOCAL only, zero Brain, zero network on the hot path.
- Byte-stable degrade: absent sources -> today's safe defaults ('continue' + sound).
- Reuse before build (Part 7): read the shipped router + the shipped bind-check.
- Pre-commit gates green without `--no-verify`.
- 187 cockpit regression stays green.

## Verify

- `node tests/test-statusline-live-signals.cjs`
- `node tests/test-statusline-liveness-gate.cjs`
- `node tests/test-statusline-cockpit-187.cjs` (regression, still 124 pass)
