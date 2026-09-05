# Phase 340: Canon Currency Audit and Amendment - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-09-05
**Phase:** 340-canon-currency-audit-and-amendment-v1-24-to-next-close-the-d
**Areas discussed:** Sourced Claims Doctrine scope, Theo naming + entry type, Local-graph chokepoint citation, ICM schema currency

---

## Sourced Claims Doctrine scope (Part 12)

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone Part 12 clause, narrow (Recommended) | Covers conversational/document prose numeric claims only; cross-references Part 5 as sibling doctrine, doesn't merge | |
| Also amend Part 5 to unify the doctrine | Extends Part 5's evidence-tier language to cover prose claims too, one doctrine for both graph and conversational claims | |
| You decide at plan time | Leave the exact split to whoever plans/executes | |
| **Other (free text)** | "Revisit full Canon" | ✓ |

**User's choice:** Neither narrow option - explicit override, full Canon revisit.
**Notes:** First of two consecutive turns where the navigator declined a narrowly-scoped framing in favor of a full-document audit. See CONTEXT.md `<domain>` for the full scope-expansion record.

---

## Theo naming + entry type

| Option | Description | Selected |
|--------|-------------|----------|
| Factual-correction entry, keep 'Brain' as role name (Recommended) | Mirrors entries 13/16 style; Theo named as current implementation per Phase 339's own D-09 | |
| Full doctrine amendment | Treat the Memgraph-to-Theo cutover as its own architectural doctrine section | |
| You decide at plan time | Leave the entry-type call to whoever plans this phase | |
| **Other (free text)** | "Revisit full Canon to fit what mindiran is wha it need sto be anf in its current stack and architecture and jtbd larry" (verbatim, typo-preserved; decoded in CONTEXT.md) | ✓ |

**User's choice:** Neither narrow option - explicit override, full Canon revisit against current stack/architecture/JTBD/Larry behavior contract.
**Notes:** Second consecutive scope-widening turn. This response is the clearest statement of the phase's real boundary and is quoted verbatim (both original and decoded) in CONTEXT.md `<specifics>`.

---

## Local-graph chokepoint citation (Part 9)

| Option | Description | Selected |
|--------|-------------|----------|
| Light citation addition (Recommended) | Name lib/core/node-insert.cjs alongside the existing navigation.cjs citation, no new doctrine | |
| Deeper doctrinal split | Formally distinguish "navigate via navigation.cjs" from "write via node-insert.cjs" as two separately named constitutional properties | ✓ |
| You decide at plan time | Leave the depth call to whoever plans this phase | |

**User's choice:** Deeper doctrinal split.
**Notes:** Locked as D-01 in CONTEXT.md. Consistent with the broader pattern this session - the navigator consistently chose the fuller, more substantive treatment over the lighter patch at every option across all four areas.

---

## ICM schema currency (Appendix B)

| Option | Description | Selected |
|--------|-------------|----------|
| Add code citations (Recommended) | Point Appendix B's Layer table at Phase 275's shipped mechanisms (STATEMENT field, per-section CONTEXT.md, references/ factory dir) | ✓ |
| Leave it abstract | Appendix B stays pure concept-to-Part mapping | |
| You decide at plan time | Leave the citation-depth call to whoever plans this phase | |

**User's choice:** Add code citations (the recommended option).
**Notes:** Locked as D-02 in CONTEXT.md. The one area where the recommended option was also the fuller-treatment option, so no conflict between "recommended" and "the pattern of choosing more, not less" seen in the other three areas.

---

## Claude's Discretion

- Whether the eventual amendment lands as multiple Appendix D entries or fewer larger entries covering multiple Parts each - depends on what the research step finds part-by-part.
- Exact Appendix D entry prose, matching the established 37-entry style.
- Whether currency-checking extends beyond the four already-surfaced fronts into the other 8 Canon Parts (1, 2, 2a, 3, 4, 6, 7, 10, 11) - the navigator's full-revisit instruction implies yes, but this session verified only the 4 fronts directly; a genuine research question, not assumed.

## Deferred Ideas

- Harness-as-code detector (check-tool-honesty.cjs sibling for prose-fabrication) - explicitly named as phase-2, dependent on SEED-032/SEED-062, not folded into this phase even under the widened scope.
- Reviewed-but-unrelated todos: registry-drift gate (F-shape), F7 rescope 212/213, ingest skill-description to Brain, deck generation slide count, never-git-stash-mid-merge - none substantively related to Canon currency, all noted and set aside.
