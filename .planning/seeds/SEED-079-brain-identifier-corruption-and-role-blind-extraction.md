# SEED-079 - Brain identifier corruption and the role-blind extraction pass behind it

> Measured live, 2026-08-20, read-only against pws-brain-db: **327 nodes hold several whole
> paragraphs concatenated into `.name` via `<SEP>` separators. 325 nodes have names longer than
> 200 characters.** Alongside that, framework names are typed as `Person` and `Organization`.
> These are not three bugs. They are one extraction pass that types and names by surface form
> rather than by role.

**Registered:** 2026-08-20 (from the Gate 0 live diagnostic run during the v2.1.0 milestone)
**Class:** DATA QUALITY / Brain graph ingestion | **Status:** seed, UNOWNED
**Grounding:** `.planning/debug/brain-gate0-diagnostic-260820.md` (sections 4 and 8),
`.planning/phases/260-.../260-RESEARCH.md`, `.planning/phases/261-.../261-RESEARCH.md`,
`~/MindrianRooms/rethinking-mindrianos/research/2026-08-20-gate0-live-diagnostic/`

## Why this is a seed and not a phase task

The Gate 0 diagnostic re-pointed every one of its findings to a live phase in the 258-263 wave.
**This one had nowhere to go.** 258 owns write attribution, 260 owns the pipeline fixes for
aliasing and prop application, 261 owns the enrichment writes, 262 owns the floor. None of them
covers the state of the `name` field itself or the extraction pass that produced it.

Filing it as a seed rather than silently dropping it, per the standing rule that a finding which
reaches a verdict and never lands in a phase or seed counts as incomplete.

## The gap this closes

Three pathologies, one root:

**1. Identifier corruption.** 327 nodes have `<SEP>`-joined paragraphs in `.name`; 325 exceed 200
characters. A representative `.name` value reads as several merged descriptions of the same idea,
each written by a different extraction pass, concatenated rather than resolved. Example shape:

```
"A problem is an issue that requires definition and understanding, often needing
 disaggregation for clarity.<SEP>Problem in the context of innovation, representing
 issues that can be viewed through the Four Lenses of Innovation framework.<SEP>Problem
 is an important concept in innovation and problem-solving..."
```

That string is the node's IDENTIFIER, not its description.

**2. Extraction noise promoted to first-class nodes.** `"A Framework"`, `"A Model"`, `"A Theory"`,
`"A Deeper Analysis"`, `"A Targeted Analysis"`, `"A Multi-Dimensional Analysis"`,
`": [ Set_Theory_Validation"`, `"Absurd Scenarios o Scenario Analysis"`,
`"Academic_review_framework"`. These are article-plus-noun fragments lifted out of prose and
given node identity.

**3. Role-blind typing.** Framework names carrying the wrong label entirely:

- **Typed as `Person`:** every De Bono hat has a `[Archived, Person, Concept]` twin alongside its
  `[Framework]` copy (`black hat analysis`, `green hat analysis`, `white hat analysis`,
  `yellow hat analysis`). Also `minto pyramid`, `the golden circle`, `the braintrust`,
  `pws (problems worth solving)`.
- **Typed as `Organization`:** `Lean Startup`, `Lean Principles`, `Behavioral Economics`,
  `Hot Groups`, `Mission Innovation`, `The Three Box Solution`,
  `The Well-Defined Problem Framework`, `Jobs to Be Done (JTBD)`.

"Minto Pyramid is a Person" and "the name field holds three paragraphs" are the same failure at
different severities: the pipeline had no schema-level notion of what a Framework IS, so it typed
and named by whatever the surrounding text looked like.

## Why it matters beyond tidiness

1. **It defeats every lookup and every vector match.** A node whose identifier is three merged
   paragraphs will not match a framework lookup regardless of which label it wears. This is why
   relabelling alone cannot be expected to fix framework resolution.
2. **It makes any future merge or alias decision unsafe.** You cannot responsibly decide which of
   two nodes survives a merge when one of their names is a concatenated paragraph. This is a live
   constraint on Phase 260's dedup and alias work, not a hypothetical.
3. **It recurs.** Fixing labels without fixing the pass means re-fixing labels after the next
   ingest. Phase 261 will restore ~95 `:Framework` labels; nothing currently prevents the next
   enrichment wave from producing the same three pathologies again.

## Shape of the work (not a plan, a starting point)

- **Measure first, as always in this repo.** The counts above are the whole known surface; nobody
  has looked at WHICH pass produced the `<SEP>` values or whether they came from one ingestion or
  many. That question is answerable from the Brain repo history and is cheap.
- **Separate identifier from description.** The `<SEP>` content is not worthless; it is several
  real descriptions badly stored. The likely correct move is extracting them into a description or
  `aliases` property and reducing `.name` to a real identifier, not deleting them.
- **Decide the noise-node disposition.** `"A Framework"` and friends are probably straightforward
  deletes, but that is a ruling, not an assumption, and it needs the same propose-then-execute
  discipline as everything else touching this graph.
- **The typing fix belongs upstream.** Correcting `Person` and `Organization` labels on individual
  nodes is remediation; giving the extraction pass a schema-level notion of role is the fix.

## Explicit non-goals

- **Not a bulk mutation.** The 2026-02-05 relabel disaster is the standing precedent, and this
  seed is about a pass that ALREADY did something like that once.
- **Does not block 258-263.** Nothing here is a prerequisite for the current wave. It is the
  reason the current wave will need repeating if it is never done.
- **Not the same as Phase 260's alias work.** Aliasing resolves duplicate IDENTITY. This is about
  corrupt IDENTIFIERS, which is upstream of identity resolution and partly the reason it is hard.

## Boundary note

Everything measured here is generic methodology structure: label counts, name-field statistics,
framework names, node ids. No room content, no user data. Canon Part 8 clean in both directions.
