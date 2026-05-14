# F-Selector Consumer Guide (Phase 125)

> How to consume the F-selector ranker from Phase 116 (tension hook), Phase 117
> (auto-explore), `/mos:suggest-next`, `/mos:act`, or any other surface that
> shows the user a top-K of next-move commands.

Version: 1.0 (Phase 125-08, 2026-05-14)
Status: Active
Canon parts: Part 3 (F-shape selector contract), Part 4 (every choice is graph
data), Part 7 (reuse before build), Part 8 (graph boundary), Part 9 (SQL
navigates).

---

## The three surfaces

Phase 125 exposes three call surfaces:

1. **`rankForSelector`** -- pure synchronous function. Call any time. Returns
   top-K ranked commands. Zero side effects.
2. **`recordSelectorDecision`** -- writes user's F.0 accept / F.1 defer / F.2
   reject decision to the graph. memory_event + typed cascade edge.
3. **`recordSelectorMiss`** -- writes the "none fit" tuning signal. memory_event
   only (no edge). Consumer routes to `/mos:do` with the user_intent.

Rendering helpers (also exposed):
- `renderInvestmentBadge(investment_level) -> string`
- `renderSliceBadge(slice_scope, slice_rationale) -> string`
- `renderNoneFitAffordance() -> string`  // returns "None fit -- tell me what you need"

Filter helper (Plan 06):
- `shouldExclude(command_id, roomState) -> boolean`

---

## Wiring contract (READ BEFORE TYPICAL WIRING)

Two preconditions consumers MUST satisfy before calling rankForSelector + decisions:

1. **`packetOptional` MUST be an already-resolved packet** -- the result of
   `await buildBrainPacket(...)`, NOT a raw Promise. rankForSelector is
   synchronous; passing a Promise will silently degrade to the no-packet path
   because a Promise has no `local_graph_summary` field. Always await your
   packet build BEFORE invoking the ranker.

2. **Populate `roomState.db` BEFORE calling rankForSelector,
   recordSelectorDecision, or recordSelectorMiss.** The db handle is read from
   `roomState.db` per the CONTEXT.md locked signatures (D7 + D8 honor the
   locked shape; db is not a separate top-level param). If `roomState.db` is
   absent:
   - `applyDecayWeight` silently returns the base_score unchanged (decay is a
     no-op). Acceptable for tests, mocks, and Tier-0 sessions.
   - `recordSelectorDecision` and `recordSelectorMiss` BOTH return
     `{ ok: false, reason: 'invalid_db' }`. These are the user-action writers;
     they MUST have roomState.db.

## Typical wiring (pseudocode)

```javascript
const ranker = require('../workflow/f-selector-ranker.cjs');
const decisions = require('../workflow/selector-decisions.cjs');

// 0. PRECONDITION: roomState.db must carry the SQLite handle.
//    PRECONDITION: maybePacket must already be resolved (await buildBrainPacket).

// 1. Compute the top-K. Pure sync. Pass packetOptional if you already have a
//    built Brain packet for richer scoring.
const items = ranker.rankForSelector({
  jtbd: roomState.activeJtbd,
  problemType: roomState.problemType,
  focusNodeId: roomState.activeFocus,
  roomState,                     // MUST carry roomState.db for decay-weight to apply
  packetOptional: maybePacket,   // optional; null is fine; MUST NOT be a Promise
  k: 3,
  _applyDecayWeight: decisions.applyDecayWeight,  // wires Plan 06 decay
});

// 2. Render the F-shape (F.1 Next Move family). Each item carries `command`,
//    `jtbd_label`, `why`, `score`, `investment_level`. Place the badges:
const investmentBadge = ranker.renderInvestmentBadge(items[0].investment_level);
const sliceBadge = ranker.renderSliceBadge(
  packet?.local_graph_summary?.framework_chain_hint?.slice_scope ?? 3,
  packet?.local_graph_summary?.framework_chain_hint?.slice_rationale ?? ''
);
const noneFit = ranker.renderNoneFitAffordance();
// Show items + investmentBadge + sliceBadge + noneFit affordance to user.

// 3a. User picks F.0 accept -> run the chosen command (consumer responsibility).
// 3b. User picks F.1 defer or F.2 reject:
//     NOTE: db is NOT passed -- it is resolved via roomState.db per locked signature.
decisions.recordSelectorDecision({
  decision: 'defer',    // or 'reject'
  command: items[chosenIndex].command,
  framework: items[chosenIndex].framework,
  reason: userTypedReason,           // optional; null is fine
  score_at_decision: items[chosenIndex].score,
  roomState,                         // MUST carry roomState.db (preconditions section)
});
// Both memory_event + typed cascade edge are written through navigation.cjs.

// 3c. User picks "none fit" and types free-text intent:
//     NOTE: db is NOT passed -- it is resolved via roomState.db per locked signature.
const miss = decisions.recordSelectorMiss({
  top_k_offered: items.map(i => ({ command: i.command, score: i.score })),
  user_intent: userTypedIntent,
  roomState,                         // MUST carry roomState.db (preconditions section)
});
// Consumer now routes to /mos:do with user_intent (Phase 125 does NOT route).
```

---

## What each consumer surface owns

| Consumer | Responsibility |
|---|---|
| Phase 116 (tension hook) | Calls rankForSelector for PULL mode when a tension is detected. Renders the top-K in the tension-resolution menu. |
| Phase 117 (auto-explore) | Calls rankForSelector for PUSH mode at decision gates. Owns the trigger policy: which gates, after which commands, with what frequency. |
| /mos:suggest-next | Calls rankForSelector once per invocation. Renders the F.1 Next Move shape. |
| /mos:act | Same as suggest-next but routes the chosen command itself (not Phase 117). |

## Filter helper: shouldExclude

If you want to drop freshly-rejected commands from top-K entirely (rather than
showing them bottom-ranked), call `decisions.shouldExclude(command_id, roomState)`
before adding to the user-facing list. The threshold is 0.1 (configurable in v2).

At invocation 0 (factor=0) the command is excluded by shouldExclude; at
invocation 1 (factor~=0.181) it's included with decayed weight. Freshly-decided
commands disappear from the very next selector but resurface at the
second-to-next, ramping up toward full weight over the 5-invocation window.

## Canon Part 8 invariants

- `rankForSelector` issues ZERO Brain calls. It consumes packetOptional but
  never queries Brain itself.
- `recordSelectorDecision` writes through `navigation.logMemoryEvent` +
  `navigation.writeEdge` ONLY. No direct room-db access.
- `recordSelectorMiss` writes the user's free-text `user_intent` LOCALLY only.
  Never serialize `user_intent` into a Brain packet. If you need to query Brain
  about a missed pattern, send only generic framework handles + phase identifiers,
  never the user's typed text.

## D11 fallback (graceful degradation)

If `jtbd_summary` or `teaching` is missing for a command, `rankForSelector`
EXCLUDES that command from the top-K. This is the documented fail-closed path
per CONTEXT.md D6 + D11. Phase 104.1 ships the content for all commands;
post-104.1, this path should never trigger for shipped commands.

## See also

- `lib/workflow/f-selector-ranker.cjs` -- the ranker source
- `lib/workflow/selector-decisions.cjs` -- the decision + miss writers
- `.planning/phases/125-f-selector-ranker/125-CONTEXT.md` -- the design lock
- Canon Part 3 (F-shape selector contract) + Part 4 (every choice is graph data)
- Canon Part 8 (the graph boundary -- LOCAL never to BRAIN)
- Canon Part 9 (memory locality and interpretation)
