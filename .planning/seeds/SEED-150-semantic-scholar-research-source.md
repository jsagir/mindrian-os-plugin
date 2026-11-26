---
id: SEED-150
status: planted
planted: 2026-11-25
planted_during: work/400.2-persona-hats-research (owner remark while preparing the hat overlap spike)
trigger_when: the next phase that touches the research sources of lib/core/research-corpus.cjs or the hat research lenses of Phase 400.2
scope: small
---

# SEED-150: Semantic Scholar as a research source

Owner, 2026-11-25: "Semantic Scholar is the better fit" (compared with Google Scholar).

## Why

- Google Scholar has no official API and blocks automated queries; the only route is a paid scraping service. Not used. (General knowledge, not checked in this repo.)
- Semantic Scholar has a free official API, covers most fields, and carries citation links. It would be a third scholarly source beside OpenAlex and arXiv for the four researching hats of /mos:persona deep mode (Phase 400.2).

## What it needs

- A new fetcher in lib/core/rs-fetcher-academic.cjs (or beside it) and a source entry in lib/core/research-corpus.cjs. Unlike arXiv, no fetcher exists today.
- A lens in LENS_TO_SOURCE of lib/lens-engine/source-lens-driver.cjs and a place in HAT_RESEARCH_LENSES (lib/core/persona-ops.cjs).
- Evidence tier Academic. Optional API key for higher rate limits.
- Results matched on the paper (DOI or arXiv id), not the link, against OpenAlex and arXiv, so the hat overlap measure is not inflated by the same paper under two links.
- Part 8: the approved string only; the card names the provider.
- Check the API terms and rate limits before building (not checked yet).
