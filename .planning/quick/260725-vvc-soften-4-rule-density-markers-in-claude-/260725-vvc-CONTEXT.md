# Quick Task 260725-vvc: Soften 4 rule-density markers in CLAUDE.md toward trust-Claude's-judgment per the context-engineering-for-Claude-5-generation-models article - Context

**Gathered:** 2026-07-25
**Status:** Ready for planning

<domain>
## Task Boundary

Reword exactly 4 rule-density markers in `/home/jsagi/dev/MindrianOS-Plugin/CLAUDE.md` from
absolute enforcement language (MANDATORY/MUST/NEVER) to strong-default-plus-trusted-judgment
language, per the "give rules -> let Claude use judgment" shift described in the newly-ingested
Anthropic context-engineering article (`langtalks-graph-expert` source
`url-https-claude-com-blog-the-new-rules-of-c.md`). This is a targeted edit to ONE file
(`CLAUDE.md`), not a rewrite of `docs/MINDRIAN-CANON.md` or any other canon document, out of scope.

Explicitly OUT OF SCOPE, do not touch: the 5 genuine invariants identified this session (Brain IP
boundary / Part 8, workspace guard, version lockstep, human-confirm-truth-claim / Part 9,
corpus-gap honesty). These protect real legal/business/governance/epistemic invariants, not model
limitations, and softening them would be a real regression, not context engineering.

</domain>

<decisions>
## Implementation Decisions

### Which 4 markers to touch
All 4, confirmed:
1. Tri-Polar Design Rule "MUST be evaluated" (CLAUDE.md line ~29-31).
2. Part 6 Dog-Fooding Mandate + Part 7 Reuse Before Build (CLAUDE.md lines ~47-48, the two
   one-line Canon Part summaries referenced from this file, not the full canon doc).
3. Part 12 Pedagogy "never grade, never compliment" (CLAUDE.md line ~51).
4. QA/RCA "Classify, never just report" (CLAUDE.md line ~172).

### How to reword
Reword to guidance/strong-default language PLUS a short explanatory clause on the judgment being
trusted, mirroring the tone Part 11's own already-shipped advisory-lint language uses ("checked...
as an ADVISORY lint signal as of Phase 210 (WARN, never a block)"). Not a bare word-swap
(MUST->should) with no context, the reasoning should be legible in the text itself.

### Claude's Discretion
- Exact phrasing of each of the 4 reworded lines, as long as it: (a) keeps the same factual
  content/intent, (b) drops the absolute MANDATORY/MUST/NEVER framing, (c) adds a short why-clause,
  (d) stays within this repo's no-em-dash HARD RULE.
- Whether to add one short framing sentence near the top of the Canon Compliance Core section
  distinguishing "genuine invariant" Canon Parts from "strong default, trust judgment" ones, if it
  helps a future reader understand why some Parts still say MUST/NEVER and others don't. Optional,
  only if it fits cleanly without bloating the file.

</decisions>

<specifics>
## Specific Ideas

Precedent already in the file to mirror in tone: CLAUDE.md's own Part 11 description already shows
this exact shift happening once, "checked by scripts/check-shape-declaration.cjs at commit +
release + doctor --acceptance as an ADVISORY lint signal as of Phase 210 (WARN with every violation
enumerated, never a block; --strict restores hard-fail)". The 4 reworded markers should read in that
same register: still clearly stated, still clearly the intended default, just not framed as an
absolute the model has no room to reason about.

</specifics>

<canonical_refs>
## Canonical References

- `/home/jsagi/dev/MindrianOS-Plugin/CLAUDE.md` -- the file being edited, lines ~29-31, ~47-48,
  ~51, ~172 (verify exact current line numbers before editing, they may have shifted).
- `langtalks-graph-expert` source `sources/research/markdown/url-https-claude-com-blog-the-new-rules-of-c.md`
  -- the article this rewrite is grounded in (do not quote it verbatim in the commit or the file,
  paraphrase the principle only).
- This session's own grading of MindrianOS-Plugin against the article (6-dimension table, overall
  B-, "Rules vs. judgment" graded C-) is the direct trigger for this task.
- Repo-wide HARD RULE: no em-dashes anywhere, hyphens only.

</canonical_refs>
