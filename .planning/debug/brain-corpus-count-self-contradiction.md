---
slug: brain-corpus-count-self-contradiction
kind: rca
status: open
created: 2026-06-25
canon_parts: [4, 5, 8]
source: docs/CANON-RECALIBRATION-PROPOSAL.md (Pillar 3)
classification: NEW FAILURE (corpus-integrity, not code-crash)
gated_on: admin-Cypher-access (for the authoritative denominators)
---

# RCA — The Brain corpus returns mutually-inconsistent corpus counts from one query

## Symptom (brain_search-confirmed — NOT admin-gated; strongest reachable evidence)

A single `brain_search("total number of dictionary terms and frameworks")` returns
THREE mutually-inconsistent count-sets across chunks of the SAME response:

| Source chunk | Frameworks | Terms | Books |
|---|---|---|---|
| `lawrence.py` (`...d6dde544959755ea`) | 275 | 309 | 157 |
| `neo4j-schema-navigator` schema (`...63d754f8f7637341`) | 761 | 313 | 69 |
| Pinecone-patterns (`...0774d423208b7bf9`) | 1,427 vectors | 124 | 325 |

The Brain returns **309 AND 313 terms, 275 AND 761 frameworks, 157 AND 69 books —
from one query.** `brain_ask` returns an empty GUIDED DirectiveEnvelope (no counts),
confirming counts are only retrievable as inconsistent corpus chunks, never as one
authoritative figure. The disease is INSIDE the Brain's own **unversioned** ingested
corpus.

## The plugin-side amplifier (projection-/canon-verified)

Prose surfaces hand-type ≥ five framework counts and two term counts with no
canonical source:
- `skills/pws-methodology/SKILL.md:31` — "275+ frameworks" (sourced "live Brain read 2026-06-07")
- `docs/THE-BRAIN.md:21` — "Framework (748)"; `:72` — "~275 curated subset of … 748"
- `CLAUDE.md` — "25 methodology"; `docs/BUSINESS-MODEL-AND-MOAT.md:25` — "26 frameworks"
- `data/framework-names.json` — 105 + 7 = 112; `data/connector-registry.json` framework_index — 27
- `references/personality/pws-lexicon-full.md:3,499` — "313 dictionary terms"
- Books quadruple-inconsistent across repo + corpus: **7 / 59 / 69 / 157**

`data/brain-corpus-stats.json` does **not** exist; the generator does not emit it.

## Scope and impact

Larry quotes whichever stale Brain chunk wins the vector-similarity lottery at
runtime, so the conversational surface states inconsistent corpus counts to users.
Self-defeating for a product whose moat IS the graph. Part 8-safe to fix (generic
methodology metadata only; no user data).

## Required changes (two halves — the local half is necessary but NOT sufficient)

### Code/docs half (ship now, with guards)
1. Extend `scripts/build-command-registry.cjs --refresh-names` to also emit
   `data/brain-corpus-stats.json` = `{ framework_total, framework_feeds_into_linked,
   dictionary_terms, techniques, books, pinecone_vectors, read_date, source_chunk,
   admin_unverified: true }`.
2. Repoint `SKILL.md:31`, `pws-lexicon-full.md:3+499`, `CLAUDE.md`, `docs/THE-BRAIN.md`
   to read from (or be regenerated from) that file — stop hand-typing.
3. **THREE mandatory guards or it does net harm:**
   - stamp `read_date + source_chunk + admin_unverified` — present as a dated
     snapshot, NEVER ground truth.
   - reject the source-critique's 176 / 264 / 171 comparator framing — those are
     **unverifiable-without-admin** (books found as 7/59/69/157, never 176; terms
     313 confirmed, 264 never found).
   - do NOT freeze one similarity-lottery chunk as canonical — that launders the
     contradiction into an authoritative-looking file.

### Corpus half (the real cure — partly admin-gated)
4. Reconcile the **ingested Brain source docs** to one dated read:
   `MindrianV2/prompts/lawrence.py` (309 terms / 157 books) and
   `neo4j-schema-navigator/*` (313 / 761 / 69). Until these agree, the runtime
   surface stays inconsistent regardless of the local file.

## Tests
- Generator emits `brain-corpus-stats.json` with all guard fields present.
- A grep guard fails CI if a tracked prose surface hand-types a framework/term/book
  count that is not sourced from the stats file.

## Non-code follow-ups
- Admin-Cypher census to settle the authoritative denominators (748 vs 761 frameworks,
  309 vs 313 terms, 69 vs 157 vs 7 vs 59 books). **This is the gating dependency.**

## One sub-claim from the source critique FAILS (record for honesty)
"No curated confidences in a THE-BRAIN.md R6 row" is wrong: THE-BRAIN.md has ZERO R6
rows; R6 lives in `MINDRIAN-CANON.md:463` and says the OPPOSITE (curated confidence
is mandatory). Mislocated and inverted — do not carry it forward.
