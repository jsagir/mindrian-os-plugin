# Phase 340: Canon Currency Audit and Amendment - Context

**Gathered:** 2026-09-05
**Status:** Ready for planning

<domain>
## Phase Boundary

**Scope expanded during discussion (navigator override, 2026-09-05).** The phase was
registered around four confirmed drift fronts (Sourced Claims Doctrine, Theo blindness,
local-graph chokepoint currency, extended ICM schema). When asked to scope the first two
narrowly, the navigator twice declined the narrow framing and asked instead to "revisit full
Canon to fit what Mindrian is, what it needs to be, and its current stack and architecture and
JTBD, Larry" (verbatim, decoded from the original typing). The real boundary of this phase is
therefore: **a full part-by-part currency audit of `docs/MINDRIAN-CANON.md` (12 Parts, 4
Appendices, 37 Appendix D entries, v1.24) against MindrianOS's actual current state** -
current stack, current architecture, current JTBD, and Larry's actual behavior contract (the
shipped `agents/larry-extended.md` + `skills/larry-personality/SKILL.md`) - not a set of four
narrow patches bolted onto an otherwise-untouched document.

The four originally-found fronts are a CONFIRMED FLOOR, not a ceiling:
1. Sourced Claims Doctrine (Part 12) - no clause distinguishes hedged-opinion elevation from
   hedged-fabrication; traced to SEED-086 and the real Aronhime fabrication incident.
2. Theo blindness - zero mentions of Theo anywhere in the Canon; Appendix C Glossary still
   names the retired `pws-brain-mcp.onrender.com` origin despite Phase 339's shipped cutover.
3. Local-graph chokepoint currency (Part 9) - locked this discussion: goes DEEPER than a
   citation add. Part 9 gets a formal doctrinal split naming `lib/core/navigation.cjs` (navigate)
   and `lib/core/node-insert.cjs` (write) as two separately-named constitutional chokepoints,
   not one citation folded into the existing prose.
4. Extended ICM schema (Appendix B) - locked this discussion: Appendix B gains real code
   citations pointing at Phase 275's shipped L1-L3 mechanisms (the `STATEMENT` field, the
   per-section `CONTEXT.md` writer, the `references/` factory directory), matching how the rest
   of the Canon cites concrete files rather than staying pure concept-mapping.

**What "full" means, honestly stated rather than assumed:** this session verified fronts 1-4
directly (grep + Read against the live Canon, the live agent file, and the two most relevant
recent phase CONTEXT.md files). It did NOT verify currency for the other 8 Parts (1, 2, 2a, 3,
4, 6, 7, 10, 11) against current stack/architecture/JTBD - that is real, unstarted audit work,
not a claim this session can make. Per this phase's own subject matter (never assert a claim
without a real check behind it), the research step this phase needs next is a genuine
part-by-part sweep, not an assumption that the other 8 Parts are fine because nobody looked.

Out of scope, explicitly: the harness-as-code detector (a check-tool-honesty.cjs sibling for
prose-fabrication) - named as a phase-2 dependent on SEED-032/SEED-062 once that harness
exists, not buildable today.

</domain>

<decisions>
## Implementation Decisions

### Local-graph chokepoint doctrine (Part 9) - LOCKED
- **D-01:** Deeper doctrinal split, not a light citation. Part 9's "What this means
  architecturally" subsection (and/or a new subsection) must formally name TWO separate
  constitutional chokepoints where today it names one: `lib/core/navigation.cjs` (the read/
  navigate chokepoint, already cited) and `lib/core/node-insert.cjs` (the write chokepoint,
  shipped by Phase 276's TOOLHON work per this session's own audit of that phase - 16+18 write
  sites routed through it, fail-closed `epistemic_type` validation live). The two chokepoints
  are DIFFERENT constitutional properties (navigate vs. write) and should read as two named
  things, not one citation folded into existing prose about `navigation.cjs` alone.

### ICM schema currency (Appendix B) - LOCKED
- **D-02:** Add real code citations. Appendix B's Layer table (today pure concept-to-Part
  mapping, zero file citations - unusual for this Canon, which cites concrete files everywhere
  else) gets pointers to Phase 275's actually-shipped L1-L3 mechanisms: the L1 `STATEMENT`
  field, the L2 per-section `CONTEXT.md` writer, the L3 `references/`/`_shared/` factory
  directory. `lib/core/room-skeleton-scaffold.cjs` is the implementing file per Phase 275's own
  CONTEXT.md.

### Scope boundary (Sourced Claims + Theo) - EXPANDED, not narrowly scoped
- **D-03:** Navigator explicitly declined the narrow "one Part 12 clause" and "one factual-
  correction entry" framings this session proposed. The real instruction: revisit the FULL
  Canon against what MindrianOS currently is, what it needs to be, its current stack and
  architecture, its JTBD, and Larry's actual behavior contract. Sourced Claims Doctrine and the
  Theo cutover are IN this full-revisit scope, not separately narrow-scoped amendments landing
  on their own. Whether they end up as one Appendix D entry each or fold into a larger single
  wave is Claude's Discretion at planning time, informed by whatever the full part-by-part audit
  actually finds (a genuine research question, not decided here).

### Claude's Discretion
- Whether the eventual amendment lands as multiple Appendix D entries (mirroring the
  entries-32+33 paired-landing precedent) or fewer larger entries covering multiple Parts each -
  depends on what the research step actually finds part-by-part.
- Exact Appendix D entry prose, matching the established style (navigator-approval-before-any-
  byte, provenance paragraph, frozen-scalar unweakened assertions, floor test naming) - a
  planning/execution-time task, not decided in this discussion.
- Whether "current JTBD" and "current stack/architecture" currency requires reading beyond the
  four already-surfaced fronts (e.g., Part 11's declared-surface count, which the Canon itself
  already states is "NEVER a frozen scalar... enumerated from disk at run time" - worth
  re-verifying the live count against today's `scripts/build-connector-registry.cjs --check`
  output rather than assuming the last-cited number still holds).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The Canon itself and its bookkeeping
- `docs/MINDRIAN-CANON.md` - the full document, v1.24, 867 lines, 12 Parts + 4 Appendices +
  37 Appendix D entries. Read in FULL before planning - this phase touches multiple Parts and a
  partial read risks missing cross-references (e.g. Part 8's Brain prose is cross-cited by
  Part 9's "enforcement architecture" line).
- `docs/CANON-PHASE-MAP.md` - version-history table; every prior amendment's row is the
  exact style precedent (entry description + floor-test names + lockstep manifest) this
  phase's own rows must match.
- `docs/HITL-SHAPE-DECLARATION-CONTRACT.md` - referenced by Part 11 R16; check currency if
  Part 11 enters the audit.
- `tests/test-canon-frozen-scalars-floor.cjs`, `tests/test-canon-entry-31-two-gauge-floor.cjs`,
  `tests/test-canon-entry-36-shape-declaration-floor.cjs`, `tests/test-canon-crossref-completeness.cjs`,
  `tests/test-canon-part-9-ratification.cjs` - the existing floor-test family; any Part 9 or
  Part 12 amendment likely needs a new sibling test in this family, following the existing
  naming and assertion style (byte-for-byte prior-entry preservation, frozen scalars unweakened).

### The four confirmed-floor fronts, source material
- `agents/larry-extended.md` (181 lines, the shipped Larry persona - grepped clean of any
  number-sourcing language this session) and `skills/larry-personality/SKILL.md` - Larry's
  actual behavior contract; the Sourced Claims doctrine must land here too, not just in the
  Canon text, per the earlier ruling this session already acted on (SEED-086, commit `3c2339fb`).
- `.planning/seeds/SEED-086-fabrication-hedge-laundering-prose-output-not-covered-by-tool-honesty-detector.md`
  - the filed finding this front traces to.
- `.planning/phases/339-brain-to-theo-cutover-release-flip-brain-client-default-orig/339-CONTEXT.md`
  - full Theo cutover decision trail (D-01 through D-15); `getBrainUrl()` at
  `lib/core/brain-client.cjs:1163` is the single origin resolver; the "Brain names a role, Theo
  is the current implementation" framing traces to this phase's own D-09.
- `.planning/phases/275-enlarge-room-schema-by-icm-layer-notion-gap-close-icm-archit/275-CONTEXT.md`
  - full ICM L1-L3 decision trail; `lib/core/room-skeleton-scaffold.cjs` and
  `lib/core/section-registry.cjs` are the implementing files.
- `.planning/phases/276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs/276-15-SUMMARY.md`
  - the node-insert.cjs chokepoint's actual shipped shape (site count, fail-closed validation),
  needed to cite it accurately in the D-01 doctrinal split above.

### CLAUDE.md and its includes (current stack/architecture/JTBD source of truth)
- `CLAUDE.md` - "Canon Compliance Core" section names which Parts bind which concern; check
  this list itself for currency against the audit's findings.
- `.claude/includes/architecture.md` - ICM Layers 0-4 conceptual definition, the sibling text
  to Appendix B; D-02's citations should stay consistent with this file's own framing.
- `.claude/includes/moat.md`, `.claude/includes/decisions.md`, `.claude/includes/release-process.md`
  - the other three lean includes; part of "current stack/architecture" currency if the audit
  reaches Parts 6/7/10.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The Appendix D entry-writing PATTERN itself (37 precedents) is the reusable asset: navigator-
  approval-before-any-byte, a provenance paragraph, explicit "mints no reach/edge/node, opens no
  Brain wire" framing when true, frozen-scalar unweakened assertions, and a named floor test.
  Every new entry this phase produces should read as a 38th, 39th, etc. in that same voice, not
  a new style.
- `scripts/check-canon-*.cjs`-family scripts (if any beyond the floor tests already listed) -
  verify at plan time whether a canon-lint script exists that should also gate this phase's work.

### Established Patterns
- "Corpus figures corrected" entries (13, 16) are the lightweight-factual-correction style;
  full doctrine-amendment entries (20, 29, 31, 34, 35, 36, 37 etc.) are heavier, with their own
  floor tests. The navigator's full-revisit instruction makes it likely several of this phase's
  entries land as amendments rather than light corrections - a call the research step should
  inform per front, not a blanket assumption.
- Every substantive amendment in Appendix D was navigator-APPROVED at a blocking checkpoint
  BEFORE any canon byte was written. This phase inherits that requirement without exception -
  confirmed explicitly earlier this session as the operating rule for this whole phase.

### Integration Points
- Canon version bump: current 1.24. Any amendment in this phase bumps it; multiple amendments
  in one wave bump it once per the "landed as ONE atomic lockstep wave" precedent, or per entry
  if they land separately - a planning-time call informed by the research step.
- `MINDRIAN-CANON.md` header/footer version line and `docs/CANON-PHASE-MAP.md`'s version-history
  table move together, always, per every prior entry's own stated lockstep manifest.

</code_context>

<specifics>
## Specific Ideas

- Navigator's own words on scope (typo-corrected, both turns quoted for the paper trail):
  "i want to review the canon. review larry behavior - we can [not] allow reciting wrong or
  uncalculated fabricated numbers" and "this is not for my mindrian [dev practice] - needs to
  be a GSD [phase] for any mindrian user, harness as code" and "the canon needs revisiting that
  fits the new form with extended ICM, the local graph, and Theo, with Larry behavior contract -
  this must be updated" and finally, when offered narrow framings for two of the four fronts:
  "Revisit full Canon" / "Revisit full Canon to fit what mindrian is what it needs to be and
  its current stack and architecture and JTBD Larry." Four consecutive turns, each widening the
  scope past what was proposed - the pattern itself is the specification: default to the fuller
  read, not the narrower one, when this phase's own research step finds ambiguity.

</specifics>

<deferred>
## Deferred Ideas

- Harness-as-code detector (check-tool-honesty.cjs sibling for prose-fabrication) - named
  explicitly as phase-2, dependent on SEED-032/SEED-062, not buildable until that harness
  exists. Do not fold into this phase even under the widened scope - it is a different KIND of
  work (new detector code) from a Canon currency audit (constitutional text + persona-file
  currency), and the navigator's own SEED-086 finding already named this split.

### Reviewed Todos (not folded)
- Registry-drift gate keyed to F-shape (2026-07-03): keyword-matched on "drift/gate/check", not
  substantively related to a Canon currency audit.
- F7 rescope Phases 212/213 against registerCapability (2026-07-08): unrelated.
- Ingest skill-description insight into Brain (2026-07-17): a Brain WRITE proposal, unrelated
  to Canon text currency.
- Deck generation ignores explicit slide count (2026-07-29): unrelated.
- Never git stash mid-merge-conflict (2026-07-12): operational rule, already honored, unrelated.

</deferred>

---

*Phase: 340-canon-currency-audit-and-amendment-v1-24-to-next-close-the-d*
*Context gathered: 2026-09-05*
