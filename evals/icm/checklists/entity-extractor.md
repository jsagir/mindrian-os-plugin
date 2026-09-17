# Entity extractor checklist

Writer graded: the only entity-normalization code shipped at HEAD,
`lib/core/cross-room-aggregator.cjs::safeSlug`/`entityHandle` (the `shared_entity` relevance
signal's slug/hash producer). Honesty note, stated plainly rather than inventing a module that
does not exist: this repo carries no separate NLP entity-extraction writer as of Phase 353;
`safeSlug`/`entityHandle` is the nearest shipped contract that turns a raw string into a
normalized "entity" handle, and this checklist grades that contract's output shape.

## Item 1: no template words appear in the extracted entity

- kind: code
- contract: `cross-room-aggregator.cjs::safeSlug` (`raw.toLowerCase().replace(/[^a-z0-9_-]/g,
  '-').slice(0, 64)`, falling back to `'unknown'` on a shape mismatch).
- check: the normalized slug is not the literal fallback `'unknown'` and does not contain a
  template/placeholder word (`placeholder`, `tbd`, `todo`, `fixme`, `lorem`, `sample`).
- crosses the wire: nothing. Local string normalization, zero network.

## Item 2: the entity names a concept rather than a sentence fragment

- kind: jev
- what crosses the wire (one line, exhaustive): the normalized entity slug ONLY (already
  structural per Item 1, never the raw sentence it was extracted from) -- room content never
  crosses; the raw source text stays local.
- check: a Jev Score question asks whether the slug reads as a single concept/noun-phrase handle
  (for example `market-size`) rather than a truncated sentence fragment (for example
  `we-do-not-actually-know-who`).
