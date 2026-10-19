---
phase: 371
plan: "02"
status: complete
requirements_completed: [STARTUI371-02, STARTUI371-03, STARTUI371-04, STARTUI371-05]
canon_parts: [3, 7, 8, 9, 11, 12]
---
# Plan 02 - recovery and workday handover

Retain the exact creation or next-move gate answer while its response is unknown.
Explicit recovery controls retry that payload and prevent a new preview or room
switch until resolved. A confirmed startup choice retains free-text intent across
a failed chat handover and retries the message without answering the gate again.
Definitive refusals show recovery copy rather than raw internal error codes.

Opening clears stale room UI and model context before binding. All returned room
identities are checked. Memory and briefing publish together in host context,
instead of replacing one another. Separate context/briefing retry controls handle
partial failure; direct startup entry labels memory as not loaded. Saved dates use
time datetime markup and a visible timezone. Current activity labels are presented
as human-readable events. Existing gate producers supply friendly reject/defer
labels while option IDs remain unchanged.

Verified with real startup and room-first client/browser suites. The new Phase
371 matrix also passed: 320/390/600/960px layouts and typography; fonts under a
representative CSP; lost creation/move replies with identical payload retries;
retained free-text handover; collisions; missing memory/briefing and retries;
wrong-room isolation; missing/unchanged/partial history; direct App entry;
keyboard, focus, forced colors, reduced motion and 200 percent text scaling.
The final matrix reruns under Plan 03 after visual polish.

Regression assertions changed only where the product intentionally replaces raw
codes with actionable text, or where an initial context invalidation now precedes
the successful room-opening context. The original real-tool checks are retained.
No birth/gate/memory-core authority was replaced and no Theo request was added.
