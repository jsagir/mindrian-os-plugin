# F.1 Pick-Capture Adapter Seam (Tri-Polar)

**Phase:** 159 (dial-closer-consumer-wire), Wave 3 (DCW-07)
**Status:** CLI live + tested. Desktop/Cowork seam documented; LIVE capture DEFERRED.
**Canon:** Part 7 (reuse: shared-core consumer, per-surface capture), Part 8 (pick
text never egresses), Part 9 (room.db via the navigation chokepoint only).

---

## Why this seam exists

The dial decision loop records a navigator's F.1 pick (accept / defer / reject /
Free-Text) to `room.db` so Canon Decision 13 ("rejection is data") is true at the
dial and Phase 158's `computeReachPenalties` reads a REAL signal. The pick is
captured DIFFERENTLY on each of the three surfaces (CLI / Desktop / Cowork), but
the recording logic is IDENTICAL. So the architecture is split (HOW-3):

- **Shared core (one implementation, all surfaces):**
  `lib/workflow/f1-pick-consumer.cjs::consumeF1Pick({ priorPayload, pick, roomState })`
  validates the prior payload, matches the pick to a verb deterministically,
  resolves the two channels (outcome + reach_id), and delegates ALL persistence to
  `lib/workflow/offer-closer.cjs::closeOffer` over a caller-owned `roomState.db`.
- **Per-surface capture adapter (one per surface):** a thin function that turns the
  surface's turn input into the `{ pick }` shape `consumeF1Pick` accepts. CLI is
  live (`lib/hmi/f1-pick-capture-cli.cjs::captureCliPick`); Desktop/Cowork are
  documented seam contracts only (this doc), LIVE capture deferred (DI-159-01).

The seam is the boundary between "how a surface heard the pick" and "how the system
records it." A new surface attaches by implementing ONE capture adapter against the
contract below; the shared-core consumer is never touched.

---

## The capture-adapter contract

Every surface adapter implements this signature (mirrored in the exported,
frozen `CAPTURE_ADAPTER_CONTRACT` constant in `lib/hmi/f1-pick-capture-cli.cjs`,
which is the single source of truth -- this doc tracks it):

```
captureSurfacePick(surfaceAnswer, priorPayload)
  -> { pick: { verb, outcome }, sentence? }
```

### Inputs

| Param          | Shape | Notes |
|----------------|-------|-------|
| `surfaceAnswer`| `{ selectedOption: <verb label>, outcome?: accept\|defer\|reject\|Free-Text, text?: <raw navigator text> }` | The surface's turn input. `selectedOption` is the option label the navigator chose from the rendered F.1 card. `outcome` is the chosen decision keyword. `text` is the raw navigator text (LOCAL lane only -- see Part 8 below). |
| `priorPayload` | `{ verbs: [...], reachIds?: { verb: reach_id }, sentence?, framework? }` | The PRIOR turn's persisted `decision_trace.f1_closer_payload`. `verbs` is the closed set of rendered-card option labels; the matched verb MUST be a member. |

### Output

```
{
  pick: {
    verb:    <a member of priorPayload.verbs | null>,   // deterministic enum match
    outcome: accept | defer | reject | Free-Text | null  // the decision keyword
  },
  sentence?: <raw navigator text, LOCAL lane only>
}
```

- `pick.verb` is the result of a DETERMINISTIC membership match of
  `surfaceAnswer.selectedOption` against `priorPayload.verbs` -- NOT fuzzy NLP. The
  AskUserQuestion / card answer is a known enum from the rendered card. An unmatched
  selection yields `verb: null`, so the shared-core consumer no-ops cleanly (DCW-04).
- `pick.outcome` is the normalized decision keyword. The `Free-Text` escape is its
  own outcome and routes to `recordSelectorMiss` (a memory_event, no edge).
- `sentence` is OPTIONAL and carries the raw navigator text ONLY. It rides the
  FIX-05 LOCAL routing lane (see Part 8).

### Expected pick shape consumed downstream

`consumeF1Pick({ priorPayload, pick, roomState })` accepts:
- `pick` = the adapter's `{ verb, outcome }` (or a bare string -- a verb OR an
  outcome keyword -- for the simplest adapters).
- `roomState` = the caller-owned room state. `roomState.db` MUST be populated by
  the caller (the consumer NEVER opens `room.db`; Part 9). An optional
  `roomState.offer = { framework, confidence?, reason? }` completes the matched
  verb's offer scaffold; `framework` is REQUIRED for the write because the decision
  edge `target_id` is `framework:<framework>` (the producer persists a generic
  `framework` handle onto the payload for exactly this -- Phase 159-02).

It returns `{ ok: true, recorded: true, outcome, reach_id? }` on a recorded pick,
or a structured no-op `{ ok: false, reason }` on any cold / unmatched / absent-db
/ faulted turn. It NEVER throws.

---

## Part 8: the pick text never egresses

The raw navigator text (`surfaceAnswer.text` -> the adapter's optional `sentence`)
rides the FIX-05 LOCAL routing lane ONLY. It is forwarded to
`closeOffer({ sentence })`, where it is classified to a scalar boolean + a source
enum at the write seam, and is NEVER:

- stored in any `f_selector_decision` / memory_event row body,
- written onto any typed edge,
- forwarded toward `buildBrainPacket` / a Brain client / any network call.

The consumer forwards only `{ verb enum, outcome enum, reach_id enum }`. The Part 8
behavioral + source proof is `tests/test-159-part8-secretreason-sweep.cjs`
(SECRETREASON159 tripwire) -- a seeded marker in the pick text lands in ZERO stored
row values, and neither consumer file forwards pick text toward the Brain.

Every surface adapter MUST keep raw navigator text confined to the `sentence`
field. An adapter that places raw text into `pick.verb`, `pick.outcome`, or any
other returned position would breach Part 8.

---

## Part 9: room.db only through the navigation chokepoint

The capture adapter does NO persistence (it produces the `{ pick }` the shared-core
consumer routes). The shared-core consumer NEVER opens `room.db`; the caller owns
the handle via `navigation.openRoomDbForCaller` / `closeRoomDbForCaller` (opened +
closed in a `finally`, no leak), and `closeOffer` routes every write through the
navigation chokepoint. No adapter or consumer code touches `better-sqlite3` /
`node:sqlite` / a direct `fs` read of room data.

---

## Surface status

| Surface | Adapter | Status | Reference |
|---------|---------|--------|-----------|
| Claude Code CLI | `lib/hmi/f1-pick-capture-cli.cjs::captureCliPick` | LIVE + tested | `tests/test-159-cli-capture-adapter.cjs`; the turn-start wiring `scripts/intent-classifier.cjs::consumePriorF1Pick` drives it (Phase 159-02) |
| Claude Desktop | (seam only) | DEFERRED -- implement `captureSurfacePick` against this contract; feed the SAME `consumeF1Pick` | DI-159-01 in `.planning/phases/159-dial-closer-consumer-wire/deferred-items.md` |
| Cowork | (seam only) | DEFERRED -- as Desktop | DI-159-01 |

The deferral of LIVE Desktop/Cowork conversational capture is recorded in
`.planning/phases/159-dial-closer-consumer-wire/deferred-items.md` (DI-159-01). A
future phase attaches a surface by implementing ONE adapter matching the contract
above; the shared-core consumer and the closers are reused unchanged (Part 7).

---

## Source of truth

- Contract constant: `lib/hmi/f1-pick-capture-cli.cjs` -> `CAPTURE_ADAPTER_CONTRACT`
- Shared-core consumer: `lib/workflow/f1-pick-consumer.cjs` -> `consumeF1Pick`
- CLI adapter: `lib/hmi/f1-pick-capture-cli.cjs` -> `captureCliPick`
- Turn-start wiring (CLI): `scripts/intent-classifier.cjs` -> `consumePriorF1Pick`
- Closer: `lib/workflow/offer-closer.cjs` -> `closeOffer`
