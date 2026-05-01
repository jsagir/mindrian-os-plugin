---
type: directory-identity
name: lib/conversation
purpose: Conversation operator state machine + NL classifier (Phase 99)
phase: 99
canon_parts: [3, 4, 7]
created: 2026-05-01
---

# lib/conversation/

The conversation layer. Owns the explicit operator state machine that makes Larry's per-turn behavior deterministic.

## Files

- `operator.cjs` - state primitive: `getCurrent / transition / validate`. Per-room JSON at `<roomDir>/.mindrian/conversation-operator.json`. Cold-start default: JUST_TALK. Atomic writes (mktemp + rename). Every transition emits an `OPERATOR_TRANSITION` typed edge to the local graph (Canon Part 4).
- `classifier.cjs` (Plan 99-02) - heuristic NL classifier. Detects operator transitions from user messages + tool invocations. No LLM round-trip (D-10). Confidence threshold 0.6 (D-12).
- `entity-signals.cjs` (DEFERRED to Phase 102.A) - shared lexicon for entity-introduction signals. Phase 99 ships an inline regex matcher inside classifier.cjs.

## The five operators

| Operator | Render contract |
|----------|-----------------|
| JUST_TALK | Prose only. No 4-zone. No Zone 4. No Intelligence Strip. |
| EXPLORE_CAPTURE | Prose during talk; Shape E only on crystallization with Shape F.4 confirmation gate. |
| BUILD_ROOM | Every response ends with 4-zone anatomy + Zone 4 footer. |
| METHODOLOGY | No shape mid-session. Shape E or F at gate points only. Banned: spontaneous Zone 4 footers. |
| DECISION_GATE | Shape F.x active. Keyboard input only. No prose. |

## Canon Part 8 boundary (LOCAL ONLY)

This directory writes only to `<roomDir>/.mindrian/conversation-operator.json` and `<roomDir>/.room-graph/room.db`. Never to Brain. Never queries Brain. Operator transitions are LOCAL data per Canon Part 8.

## Consumers

- Phase 100 `lib/hmi/jtbd-classifier.cjs` reads operator as classifier input (stratum 2).
- Phase 102 `lib/render/render-v2.cjs` consumes operator via `render(zones, mode, operator, tier)`.
- Phase 95.1 drift class F detector reads operator to suppress false-positives during legitimate METHODOLOGY-mode silence.
- Sprites Workspace v2.0 reads the state file directly to render the right UI mode.
