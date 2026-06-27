---
kind: meter-reading
phase: 183
milestone: v1.15.0
created: 2026-06-27
subject_class: unknown
transfer_state: uninstrumented
clears_self_bind: false
---

# METER first reading (the surface point)

The keystone instrument is live and 8/8 green. This is the first reading taken at the
surface point, recorded straight per the navigator's final-review deal.

## Raw reading (cold-start path and fixture room.db, identical)

```json
{
  "gauge1": { "gate_reaches": 0, "reach_presentations": 0,
              "framework_invocations": 0, "density": 0,
              "denominator_unit": "gate_reached" },
  "gauge2": null,
  "density": 0,
  "transfer": null,
  "transfer_state": "uninstrumented",
  "subject_class": "unknown",
  "volume_direction": "flat",
  "quality_direction": "uninstrumented",
  "verdict": "transfer_uninstrumented"
}
```

Environment: `MINDRIAN_DOGFOOD_ROOM_DIR` unset, no maintainer fingerprint configured.

## Reading it straight

- `subject_class: "unknown"` - not navigator, not even maintainer. Correction A working:
  the reading cannot positively identify a live navigator, so it does NOT clear the
  entry-31 self-binding clause. The clause precondition is UNMET.
- `transfer_state: "uninstrumented"`, `transfer: null` (not 0) - Correction B working:
  the empty f_selector_decision substrate reports as unmeasured, never as flat. The
  verdict is `transfer_uninstrumented`, NOT a Hooked Dealer regression alarm.
- `density: 0` - honest. No live engine-arm turn has fired `gate_reached` on this box
  since the build. The gauge is newborn; no traffic has passed it yet.

## What this licenses / does not

- LICENSES: METER acceptance. The instrument fires, returns the welded triple, both
  guards demonstrably live (refuses to fabricate transfer; refuses to claim a subject).
- DOES NOT LICENSE: clearing the self-bind, Appendix D entry 32, the ProblemType freeze,
  or any "a navigator arrived" claim. `subject_class=unknown` is one enum-value short of
  `navigator`; that gap is the entire difference between honest and entry-20-again.

## Honest done

"Instrument live, awaiting a navigator." The READER (184) precondition (a confirmed gate
subject) is UNMET. The `density: 0` here is no-observation-window (the gauge is newborn),
NOT measured-absence (we watched and navigators never arrive). READER stays CLOSED on this
reading; the reason is no-window, not refutation.

## Self-bind status

This artifact records a reading with `subject_class: unknown` and `clears_self_bind: false`.
A future navigator-class reading artifact (`subject_class: navigator`) produced on a real
navigator's machine is what the entry-31 self-binding clause waits on. No Appendix D entry
32 lands until that artifact exists. This reading does not provide it.
