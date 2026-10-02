---
created: 2026-10-01
title: "Theo-side request: an intent-led canon resolver (term + JTBD intent + context -> canon name)"
area: theo-interface
source: "Phase 366 D-13 (c), filed at close-out by plan 366-24 (2026-10-02); envelope shape from 366-11"
files:
  - lib/core/research-planner/canon-release.cjs
  - lib/core/part8-egress-guard.cjs
  - lib/hmi/jtbd-taxonomy.json
  - lib/core/research-planner/perspectives/index.cjs
owner: "Theo work (the Theo repo). The plugin side needs only a transport switch once Theo accepts the envelope."
status: pending
---

## The request

Theo should expose a resolver (a new tool, or a widened `normalize_framework_name`) that takes

```
{ raw, intent, section, perspective }
```

and resolves by intent and context to one canon framework name. It must never fall back to fuzzy
matching on the name alone: when the intent and the context do not lead to a canon name, it answers
a miss.

| Key | What it carries | Closed vocabulary |
|---|---|---|
| `raw` | the one room word the navigator released on the F.8 card | a short safe label (the guard checks it) |
| `intent` | the room's active JTBD handle, never the JTBD prose | `lib/hmi/jtbd-taxonomy.json` |
| `section` | the room section the word came from | a lowercase slug |
| `perspective` | the perspective that asked | `eureka`, `rs`, `hsi`, `whitespace`, `analogies`, `connections` (`PERSPECTIVE_IDS`) |

Every value is a generic handle. No room text, title, claim or file content is in the envelope
(Canon Part 8).

## Why, in plain words

A room word like "Bottleneck Hunt" means different canon frameworks in different jobs. Name lookup
alone either misses or guesses. The navigator's ruling (366 D-13, 2026-10-01): "the intent and
context must lead not just names". The plugin can send the intent and context; Theo is the side
that knows the canon, so Theo is the side that resolves.

## What the plugin already does (Phase 366, plan 366-11)

- It builds the full envelope `{ raw, intent, section, perspective }` for every released term.
- The Part 8 guard classifies that envelope and allows it only with the gate receipt:
  verdict `allow`, class and reason `navigator_released`
  (`_proveNavigatorRelease` in `lib/core/part8-egress-guard.cjs`). The extra keys are checked
  against the closed vocabularies above.
- The planner audit ledger records the call with the gate id; the envelope's intent, section and
  perspective are recorded locally (the row's `filters` and `origin_ref`).
- Today it sends only `{ raw }`. Theo's `normalize_framework_name` input schema is a
  `z.strictObject` with the single key `raw`, so any extra key is refused before the handler runs.
  The one live round trip (2026-10-02, navigator approved) sent `{ raw: "Bottleneck Hunt" }` and
  Theo answered a miss.

## What changes on the plugin side when Theo accepts the envelope

No guard change: the `navigator_released` arm already accepts exactly this shape under a receipt.
Only a transport switch in `lib/core/research-planner/canon-release.cjs` `releaseTerm`: the wire
payload goes from `{ raw: params.term }` to the built envelope (and the tool name, if Theo ships a
new tool rather than widening `normalize_framework_name`). The hit path (a proposed row in
`<room>/references/canon-translations.md` that the navigator ratifies) is unchanged.

## Done when

Theo ships the resolver; the plugin switches the transport; one approved live round trip records an
intent-led answer; `tests/test-366-gated-term-release.cjs` gains a replay leg for the envelope wire.
