---
kind: seed
status: open
severity: medium
created: 2026-07-19
canon_parts: [7, 8]
related: [SEED-034 (room.db never populated -- CRITICAL, still open), SEED-065 (mcp ceiling), SEED-070 (live eureka run + stale bytes), .planning/debug/python-requirements-orphan-deps-audit.md (HIGH severity python dep incident 2026-05-23), .planning/debug/handoff-eureka-entity-noise-2026-07-19.md]
proving_case: "Navigator asked whether MarkItDown and/or LangExtract should be adopted to fix eureka entity-extraction noise (rank 1 and 2 of a live portfolio report were the junk entities 'CSFs' and 'Windows'). Licensing cleared for both. The blocking constraints turned out to be architectural, not legal."
source: "Session 2026-07-19, raised while diagnosing tier-1 extractor noise. Produced on a NON-dev Windows machine; see provenance warning."
---

# SEED-071: MarkItDown and LangExtract, what the devs actually need to know

## Provenance warning

Produced on a Windows machine that is NOT the dev workspace. Web-sourced facts
(licences, providers, packaging) are verifiable from the cited links and stand
on their own. Repo-internal claims (file paths, line numbers) came from
`C:\Users\PC\Projects\mindrian-os-plugin-clone` and are PROVISIONAL. Companion
document: `.planning/debug/handoff-eureka-entity-noise-2026-07-19.md`.

## TL;DR for a dev with 60 seconds

Both are licence-clean. **Neither fixes the bug that prompted the question.**
Adopt MarkItDown eventually, via its MCP server, as an optional integration.
Do NOT adopt LangExtract yet: it has no Anthropic provider, which makes it a
new-vendor decision, not a library decision.

| | MarkItDown | LangExtract |
|---|---|---|
| Layer | Ingestion (file -> md) | Extraction (prose -> entities) |
| Licence | [MIT](https://github.com/microsoft/markitdown/blob/main/LICENSE) | [Apache 2.0](https://github.com/google/langextract/blob/main/LICENSE) + patent grant |
| Vendor | Microsoft | Google, but "not an officially supported Google product" |
| Needs a model? | No for most formats (optional LLM for image alt-text) | **Yes, always** |
| Clean adoption path | [markitdown-mcp](https://github.com/microsoft/markitdown/tree/main/packages/markitdown-mcp), optional MCP server | None yet |
| Verdict | Defer, then adopt as optional MCP | Do not adopt yet |

## Constraint 1: LangExtract has no Anthropic provider (the blocker)

Per [the official provider docs](https://mintlify.wiki/google/langextract/guides/model-providers), built-in providers are:

- Google Gemini (default)
- OpenAI (`pip install langextract[openai]`)
- Ollama (local)
- Vertex AI

**Anthropic is not among them.** A Claude provider would have to be written as a
third-party plugin package.

This matters because of how carefully `lib/core/eureka/entity-classifier.cjs`
already argues its own boundary. Its header (lines 20-36) states that Part 8
governs LOCAL -> BRAIN, and that LOCAL -> the Anthropic transport is the
established plugin pattern, citing `lib/core/mva-classifier.cjs` and
`lib/core/llm-name-suggester.cjs` as precedent. That argument was made
deliberately, about ONE vendor, with a named rationale.

Adopting LangExtract on its default path means user room content flows to
**Google**. That may be defensible, but it is a fresh constitutional argument
that must be written down the same way the Anthropic one was. It cannot be
silently inherited from the existing precedent. Treat it as a Part 8-adjacent
decision requiring the same explicit reasoning, not a dependency bump.

The zero-egress option is Ollama: [no API key, runs entirely locally](https://mintlify.wiki/google/langextract/guides/model-providers),
serving on `localhost:11434`. Constitutionally clean. But it means the user
installs Ollama and pulls a multi-GB model before extraction works, which is a
far harder violation of **Decision 8 (Tier 0 fully functional, no dependencies)**
than an API key is.

Net: three paths, all with a cost. New vendor (Gemini/OpenAI), heavy local
install (Ollama), or write and maintain an Anthropic provider plugin.

## Constraint 2: Python dependencies have already burned this repo twice

Both tools are Python. The repo already ships `requirements-hsi.txt` and
`requirements-whitespace.txt`, and already has a HIGH-severity audit on file:
`.planning/debug/python-requirements-orphan-deps-audit.md` (2026-05-23).

The failure it documents is exact and worth quoting the shape of:
`lib/core/rs_corpus.py` imported `requests`, its own in-source error message
told the user to run `pip install -r requirements-hsi.txt`, and that file did
not declare `requests`. **A user who followed the documented setup correctly
still hit silent failure.** The audit notes this was the same failure-mode as
the earlier 127.2-02 fix (compute-hsi.py + ml_deps) and slipped past that sweep.

Same class, twice. `markitdown[all]` and `langextract` would both add to that
surface. Any adoption plan must say how it avoids becoming the third instance.

## Constraint 3: markitdown-mcp is the pattern that already fits

MarkItDown ships an official MCP server at
[packages/markitdown-mcp](https://github.com/microsoft/markitdown/tree/main/packages/markitdown-mcp):

- One tool: `convert_to_markdown(uri)` accepting `http:`, `https:`, `file:`, `data:`
- Transports: STDIO (default), Streamable HTTP, SSE
- Binds localhost by default, documented as "meant for local use, with local trusted agents"
- Depends on `markitdown[all]`; requires Python 3.10+

This maps onto machinery MindrianOS already has. `.mcp.json` currently declares
two servers (`mindrian-os`, `mindrian-brain`). A third, declared OPTIONAL,
follows **Decision 5** (Brain as remote MCP, capability without bundling) and
**Decision 6** (LazyGraph optional, enhances, never required).

The architectural win: the Python lives inside the MCP server's own
environment, not in the plugin's execution path. Absence degrades to "server
not configured", which is a legible failure, rather than to a silent wrong
answer. That is materially better than the `requirements-*.txt` pattern above.

Open question before this ships: **does an optional MCP server satisfy the
Tri-Polar rule?** CLI yes, Desktop yes (user-configured). Cowork is UNVERIFIED
and is the gate. Also check SEED-065 (`mcp-ceiling-persona-and-proactivity-cannot-ship-over-mcp`)
for limits already established about what can and cannot ride over MCP.

## Constraint 4: sequence, or you make it worse

MarkItDown is genuinely wanted. The `nv-diamond-meg` room is NV-center
magnetometry, a field that lives in arXiv preprints, PRL papers, instrument
spec sheets, and competitor decks. Today the room can only eat `.md`.

But a PDF converted to Markdown carries page headers, footers, page numbers,
figure captions, author affiliations, DOI strings, and reference lists. Feed
that to the current tier-1 extractor and the greedy Title-Case regex
(`entity-extractor.cjs:143 PROPER_RUN`) yields "Phys", "Rev", "Lett", and every
co-author surname, all typed `entityType: 'company'` by default.

**Ingestion before the extraction gate is fixed is a bigger firehose into the
same broken filter.** Fix the gate first. The gate fix is described in the
companion handoff and is a `_coerceLabels()` change plus a provenance split, not
a new dependency.

## Constraint 5: on nested ICM specifically

The question was raised as "can LangExtract-style extraction follow the nested
ICM structure". Two things to separate:

LangExtract handles **attribute nesting inside an extraction**, via few-shot
`extraction_classes` and controlled generation. That is real and it works.

But ICM Layers 0-4 are **the on-disk corpus organisation**, not a structure
living inside the prose. Layer 0 is ROOM.md, Layer 4 is the artifacts. You
would never extract the ICM hierarchy from text; you would extract
*differently per layer*, using the layer you are reading as the schema
selector.

That is dispatch design. It is buildable around ANY extractor, including the
regex currently shipping. It is not a reason to adopt a library, and adopting
the library does not give it to you for free.

Also note the distinction the two tools do not span: "LangExtract-style code"
could mean vendoring the library, or writing our own extractor in the same
shape (schema-first, few-shot, source-grounded offsets). The second has no
licence question at all, since approaches are not copyrightable, and no Python
boundary. If the appeal is the design rather than the package, that option is
open and currently unexamined.

## The thing that outranks all of the above

`SEED-070` records `graph_nodes 0` on a live run, and `SEED-034` (room.db never
populated) is flagged CRITICAL and still open.

**Better extraction feeding a graph that is never populated is worth nothing.**
Neither MarkItDown nor LangExtract touches that. Any sequencing that puts tool
adoption ahead of SEED-034 is spending on the wrong layer.

Suggested order:
1. SEED-034 (room.db population) - nothing downstream works without it
2. The extraction gate fix (`_coerceLabels` + provenance split, per the handoff)
3. Measure: does noise persist with a real model pass? (`classifier_source` in `status.json`)
4. Only if step 3 says yes, revisit LangExtract as an extractor question
5. MarkItDown via optional MCP, independently, once step 2 has landed

## Gates any adoption plan must clear

Per CLAUDE.md: Canon Part 8 Brain-boundary, Part 7 reuse-before-build (does an
existing surface already do this?), Tri-Polar three-surface (CLI + Desktop +
**Cowork**), cross-platform (the Windows Python incident above), release
lockstep, no em-dashes, and Part 11 CIRS (any new invocable surface is born
WIRED or EXCLUDED with a declared HITL shape).
