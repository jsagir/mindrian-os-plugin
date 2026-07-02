---
kind: quick
slug: 20260702-statusline-live-signals
branch: feat/v1.15-shape-brain-phases
date: 2026-07-02
status: complete
---

# Summary: Statusline LIVE signals (closed the two 192-04 NAMED DEBTS)

The navigator statusline "felt dead" because two fields were static placeholders.
Both are now LIVE, wired to real local state on the hot path, with a Plurai eval +
deterministic parity gate that guards the contract.

## What shipped

### 1. LIVE next-move (the routed step now drives "Next:")

- `lib/statusline/next-move-cache.cjs` (new, 126 lines) - a LOCAL side-channel at
  ~/.mindrian/next-move.json. persistNextMove(offer) is the WRITE (formats the routed
  command into a short cue, atomic tmp+rename, CLEARS on abstention); readNextMove()
  is the hot-path-cheap READ (one small file read, defensive).
- lib/core/navigation-engine-offer.cjs (suggestNext, +12 lines) - the SHIPPED router
  chokepoint now persists its resolved offer (reuse, not fork). Clears on abstention.
- lib/statusline/cockpit-signals.cjs (deriveNextMove, +37 lines) - reads the routed
  cue FIRST via the cache, then jtbd, then governing-thought, then 'continue'. The hot
  path does NOT call the router - it reads the cheap cache.

  CONFIRM: "Next:" now reads the real routed step. suggestNext writes the offer's
  command as the cue; deriveNextMove surfaces it; it CHANGES as the routed command
  changes and reverts to the jtbd proxy on abstention (proven by test).

### 2. LIVE health (the glyph now reflects a written cache)

- lib/statusline/room-health-cache.cjs (new, 90 lines) - statusFromBindReport maps the
  doctor bind-check report to sound|drift|broken; persistRoomHealth writes the cache
  the already-shipped cockpit-signals.readHealthStatus reader consumes.
- scripts/doctor.cjs (bind-check block, +11 lines) - the --bind-check LOCAL room-health
  job now WRITES ~/.mindrian/room-health.json. The read path shipped in 187; this closes
  the missing WRITE.

  CONFIRM: health now reflects a written cache. doctor --bind-check maps healthy->sound
  / advisory->drift / bind-check-error->broken and writes it; the statusline reader
  lights up the instant the file changes (proven by test).

### 3. Plurai eval + local parity gate

- evals/plurai/12-statusline-liveness-fidelity.csv (14 rows, SYNTHETIC/dogfood only per
  Canon Part 8 - no real room content).
- lib/core/statusline-liveness-gate.cjs (new, 101 lines) - deterministic live/stale
  verdict, options-IGNORED (pattern of rs-corpus-quality-gate.cjs).
- evals/plurai/README.md - added the row; judge model fable.

### 4. Tests

- tests/test-statusline-live-signals.cjs (10 checks).
- tests/test-statusline-liveness-gate.cjs (5 checks).

## Verification

- test-statusline-live-signals: 10/10 pass.
- test-statusline-liveness-gate: 5/5 pass (CSV parity on all 14 rows).
- test-statusline-cockpit-187: 124/124 pass (cockpit regression GREEN).
- Pre-commit gates: check-shape-declaration --check OK (128 declared), connector-registry
  OK, render-coverage OK. No --no-verify used.
- Em-dash sweep on new/changed files clean (only pre-existing README title em-dash).
- Byte-stable on absent: both sources missing -> next_move 'continue' + health 'sound'.

## Commits

| SHA | Description |
|-----|-------------|
| 41d2fcdf | wire deriveNextMove to the real routed next step |
| 88f5b94d | write room-health cache so the health glyph goes live |
| f093a40a | Plurai statusline-liveness eval + local parity gate |
| 99eb4a7d | tests for live next-move, live health, and the parity gate |

## Deviations / out of scope

- None material. Plan/summary force-added (.planning/ gitignored but tracked by repo
  convention via git add -f).
- The pre-existing em-dash in evals/plurai/README.md title is left untouched.
