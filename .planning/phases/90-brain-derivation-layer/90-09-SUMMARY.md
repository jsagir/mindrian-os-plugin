---
phase: 90-brain-derivation-layer
plan: "09"
subsystem: brain-derivation-layer
tags:
  - interface-spec
  - phase-91-input
  - canon-part-3
  - canon-part-8
  - spec-document
  - phase-90
  - wave-4
dependency_graph:
  requires:
    - .planning/phases/90-brain-derivation-layer/90-00-SUMMARY.md (BRAIN.md schema v1: frontmatter fields + STALE_REASON enum + OPTIONAL_SECTION_HEADINGS)
    - .planning/phases/90-brain-derivation-layer/90-01-SUMMARY.md (deriveSection writer + Canon Part 8 chokepoint)
    - .planning/phases/90-brain-derivation-layer/90-02-SUMMARY.md (enqueue + queue drain transport)
    - .planning/phases/90-brain-derivation-layer/90-03-SUMMARY.md (staleness precedence + stale_reason vocabulary)
    - .planning/phases/90-brain-derivation-layer/90-04-SUMMARY.md (readQuadruple + isQuadrupleFresh sync/async parity)
    - .planning/phases/90-brain-derivation-layer/90-05-SUMMARY.md (brain-md-invariants validator)
    - .planning/phases/90-brain-derivation-layer/90-06-SUMMARY.md (cross-room aggregator + flagged_contradictions_xroom)
    - .planning/phases/90-brain-derivation-layer/90-07-SUMMARY.md (/mos:brain-derive manual command)
    - .planning/phases/90-brain-derivation-layer/90-08-SUMMARY.md (graceful degradation failure-mode proof)
    - docs/MINDRIAN-CANON.md (Parts 3, 6, 7, 8 + Appendix B, E)
    - .planning/phases/91-navigation-engine/91-CONTEXT.md (downstream consumer; cites this spec as authority_docs entry)
  provides:
    - .planning/research/navigation-engine-brain-interface.md (frozen v1 interface contract; 11 sections; 523 lines; Phase 91 input)
  affects:
    - .planning/phases/91-navigation-engine/91-CONTEXT.md (already cites this file in authority_docs)
    - Phase 91 Plan 91-00 (core engine plans decide() against Sections 3, 4, 5, 7)
    - Phase 91 Plan 91-02 (UserPromptSubmit integration plans against Section 2.4 read caching budget)
    - Phase 91 Plan 91-03 (skill activation routing plans against Section 5 tier modes)
    - Phase 91 Plan 91-04 (next-step offer plans against Section 6 RECOMMENDED gate)
    - Phase 91 Plan 91-05 (/mos:explain-decision plans against Section 8 trace fields)
    - Phase 91 Plan 91-06 (statusline dial plans against Section 5 tier mode mapping)
    - Phase 91 Plan 91-07 (problem-type routing plans against Section 3.2 problemtype_classification)
    - Phase 91 Plan 91-08 (framework chain composition plans against Section 3.2 framework_chain_predictions)
    - Plan 90-10 release gate (CANON-PHASE-MAP update will note this spec file as the Phase 90-91 interface)
tech-stack:
  added: []
  patterns:
    - "Spec-document-before-code: the contract is frozen at Phase 90 ship time so Phase 91 plans against a stable target without serial dependency"
    - "Forward-versioned interface: INTERFACE_VERSION=1 at top + Section 10 bump rules enforce future-change discipline (migration doc + backward-compat analysis + Phase 91 migration plan + Phase 90 writer update + test parity)"
    - "Evidence-based cross-references: every claim cites a shipped Phase 90 plan number or Phase 88 plan number; future amendments follow the same standard"
    - "Three-surface applicability baked into the contract (Section 1.3 + Section 2.3): CLI / Desktop MCP / Cowork behave identically; no surface-specific branching allowed"
    - "Canon Part 8 boundary treated as constitutional: Section 9 enumerates forbidden accesses (direct Brain queries, Cypher embedding of BRAIN.md body, peer-room BRAIN.md reads); re-derivations route through Plan 90-02 -> Plan 90-01"
    - "Weighted signal table (Section 3.2) sums to 1.0 on required sections; optional sections surface as caveats in decision_trace; zero weight does not delete signal from trace"
    - "Brain-offline exemption (Section 4.2) matches Plan 90-04 isQuadrupleFresh predicate: transient network != derivation staleness (multiplier 0.9, not 0.0)"
key-files:
  created:
    - .planning/research/navigation-engine-brain-interface.md
  modified: []
decisions:
  - "Weight scheme anchored at (staleness, stale_reason) pair rather than a single scalar. fresh -> 1.0; age_exceeded -> 0.7 (degraded but valid); governing_thought_changed -> 0.3 (actively contradicted); brain_graph_version_mismatch -> 0.5 (possibly invalid); brain_offline -> 0.9 (transient, not stale); derivation_timeout -> 0.2 (nearly absent); parse_failed -> 0.0 (treat as absent); unavailable -> 0.0 (Tier 0 inside section)."
  - "RECOMMENDED marker is Mode A ONLY. Canon Part 3 invariant. Mode B (Brain offline) and Tier 0 (BRAIN.md absent) NEVER render the marker because ranking without Brain-authored confidence scores would be arbitrary. Navigator decides from unmarked options."
  - "Confidence gate is >= 0.7 per Canon Part 3. Below threshold, no option is marked even in Mode A. Threshold aligns with Phase 88.2 uiux-selector-block shape contract."
  - "Navigation Engine is READ-ONLY against BRAIN.md. Derivation is Plan 90-01 alone. Canon Part 2 attribution (author = brain) depends on this invariant. A future Phase 91 plan that writes to BRAIN.md would be a canon-level breach and must be rejected."
  - "Fresh derivations route through Plan 90-02 enqueue -> Plan 90-01 deriveSection chokepoint. Navigation Engine NEVER calls brain-client.query/search/smartSearch directly. Section 9.2 + 9.3 freeze this; Section 9.5 PR gate enforces at merge time."
  - "readQuadruple is the single read entry point. Direct fs.readFileSync on BRAIN.md paths is FORBIDDEN. Ensures graceful degradation (null on absent, parse_failed on malformed), schema parity with Plan 90-00, and format-change isolation behind Plan 90-04 parser."
  - "Section 3.2 weight table: 0.35 pattern_matches + 0.20 framework_chain_predictions + 0.15 cross_domain_analogies + 0.10 wicked_indicators + 0.10 unfilled_opportunity_matches + 0.05 assessment_thinking_chain_position + 0.05 problemtype_classification = 1.0. Cross-room + HSI optional (caveat surface only). Pattern matches weight highest because framework reuse is the most common Navigation decision."
  - "decision_trace REQUIRES eight BRAIN.md fields (Section 8.1) on every Mode A or Mode B decision: version, staleness, stale_reason, weight_applied, recommended_confidence, recommended_marker_rendered, tier_mode, sections_consumed. Zero-weight decisions still emit the trace so /mos:explain-decision can show 'BRAIN.md was present but weight zeroed because X.'"
  - "Three-surface parity: CLI / Desktop MCP / Cowork call readQuadruple through Phase 88-01 sync/async split; decision semantics are byte-identical; Navigation Engine MUST NOT branch on surface. Explicit note in Section 1.3 + 2.3 prevents future surface-specific drift."
  - "Canon Part 8 obligations for Phase 91 frozen in Section 9 as five PR-gate assertions: no fs.readFileSync outside readQuadruple; no brain-client.query/search/smartSearch; no string concat into Cypher templates; no network payload takes brain.sections.*.body; default answer when uncertain is block."
requirements:
  - BRAIN-NAV-INTERFACE-01
  - BRAIN-NAV-INTERFACE-02
canon_parts:
  - "Part 3 Tri-Context Decision Gate (Section 5 tier modes + Section 6 RECOMMENDED gate + Section 7 triangulation; BRAIN.md is the methodology signal at every Decision Gate)"
  - "Part 6 Product-as-Venture (interface spec at phase boundary is dog-fooding; this document prevents Phase 90-91 coupling exactly as Canon Part 6 mandates)"
  - "Part 7 Reuse Before Build (Section 2 reuses Phase 88-01 folder-memory contract; no new read primitive invented; Plan 90-04 readQuadruple is the stable composition point)"
  - "Part 8 Graph Boundary (Section 9 freezes Navigation Engine's Canon Part 8 obligations; re-derivations route through Plan 90-01 chokepoint; direct Brain queries FORBIDDEN; PR gate at Section 9.5)"
metrics:
  duration_minutes: ~25
  completed: 2026-04-20
  tests_added: 0
  feynman_baseline: "62 (unchanged; no test file added -- this is a spec document)"
  feynman_suite_result: "N/A for this plan; documentation-only, no tests required"
  lines_created: 513
  runtime_deps_added: 0
  production_code_modified: 0
---

# Phase 90 Plan 09: Navigation Engine <-> BRAIN.md Interface Contract v1 Summary

One-liner: Freeze the 11-section interface contract between Phase 90 (Brain Derivation Layer) and Phase 91 (Navigation Engine) as a frozen v1 spec document so Phase 91 can plan its consumption against a stable target without coupling to Phase 90 internals -- the contract enumerates the read path (readQuadruple only), the consumed fields (8 frontmatter scalars + 9 weighted section bodies), the staleness multiplier table, the tier-mode mapping (Mode A / Mode B / Tier 0), the RECOMMENDED marker confidence gate (Mode A + >=0.7), the decision_trace emission requirements, the Canon Part 8 obligations, and the version-bump + migration rules.

## What shipped

Phase 90 Wave 4 Plan 10 of 11 (documentation-only; no code changes). This plan closes the Phase 90-91 interface question at ship time. Phase 91 (numbered after 90 because it consumes BRAIN.md) had a stub interface document from its own planning pass (2026-04-19); this plan replaces the stub with the frozen v1 contract.

One artifact:

1. `.planning/research/navigation-engine-brain-interface.md` (523 lines; 11 sections + Preamble + Appendix)

Zero code changes. Zero test changes. Zero runtime dependency changes.

## The 11 sections

| Section | Title | Role |
|---|---|---|
| Preamble | Why this doc exists | Phase 90-91 decoupling mandate + evidence standard for cross-references |
| 1 | Scope | What is / is not covered + three-surface applicability |
| 2 | Read Path | readQuadruple is the only entry; direct fs reads FORBIDDEN; sync/async selection table; turn-scoped caching allowed |
| 3 | Consumed Fields | 8 frontmatter scalars (direct read) + 9 section bodies (weighted) + forbidden accesses |
| 4 | Staleness Weighting Scheme | 9-row multiplier table; brain_offline exemption; weight floor; zero-weight trace semantics |
| 5 | Tier Mode Mapping | Mode A Full Loop / Mode B Local Only / Tier 0 Fallback; transition rules |
| 6 | RECOMMENDED Marker Gate | Canon Part 3 invariant: Mode A AND pattern_matches candidate confidence >= 0.7 |
| 7 | Signal Triangulation | Five inputs per Canon Appendix B; BRAIN.md is methodology signal; independence invariant |
| 8 | Trace Requirements | 8 required decision_trace fields; audit surface for /mos:explain-decision |
| 9 | Canon Part 8 Boundary | Navigation is pure local reader; fresh derivations route through Plan 90-01; PR gate |
| 10 | Version History + Migration | INTERFACE_VERSION=1; bump rules; migration obligations |
| 11 | Related Plans and Phases | Cross-refs to producer, consumers, Phase 90 artifacts, Phase 88 artifacts, Canon parts, forward pointers |

Plus an Appendix: Quick Reference mapping "need to do X?" to the relevant section.

## Core contract claims

1. **Read path.** `lib/core/folder-memory.cjs readQuadruple(sectionPath)` is the ONLY entry Phase 91 uses to read BRAIN.md. Sync for CLI hooks; async for MCP handlers. Direct `fs.readFileSync` is FORBIDDEN.

2. **Consumed fields.** 8 frontmatter scalars are read directly: `section`, `brain_generated_at`, `brain_graph_version`, `governing_thought_hash`, `staleness`, `stale_reason`, `author`, `confidence_baseline`. 9 section bodies are read via `brain.sections.*`: pattern_matches (0.35), framework_chain_predictions (0.20), cross_domain_analogies (0.15), wicked_indicators (0.10), unfilled_opportunity_matches (0.10), assessment_thinking_chain_position (0.05), problemtype_classification (0.05), flagged_contradictions_xroom (optional caveat), hsi_signals (optional caveat).

3. **Staleness weighting.** Multiplier table: fresh -> 1.0; age_exceeded -> 0.7; governing_thought_changed -> 0.3; brain_graph_version_mismatch -> 0.5; brain_offline -> 0.9 (transient exemption); derivation_timeout -> 0.2; parse_failed -> 0.0; unavailable -> 0.0; null -> 0.0.

4. **Tier modes.** Mode A Full Loop when Brain reachable AND BRAIN.md present AND parseable; Mode B Local Only when Brain unreachable AND BRAIN.md present; Tier 0 Fallback when BRAIN.md absent or unparseable. Mode transitions are per-turn; no cross-turn caching.

5. **RECOMMENDED marker gate.** Mode A AND pattern_matches candidate with confidence >= 0.7 AND candidate verb matches option verb. Canon Part 3 invariant.

6. **Signal triangulation.** BRAIN.md is ONE of FIVE inputs (ICM scope, SQL relations, MINTO reasoning, BRAIN methodology, intent/persona) per Canon Appendix B. Independence invariant: BRAIN.md's contribution does not depend on the other four signals at the input layer.

7. **Canon Part 8 holds under Navigation Engine consumption.** Navigation Engine is a pure LOCAL reader. Fresh derivations route through Plan 90-02 enqueue -> Plan 90-01 deriveSection chokepoint. Direct `brain-client.query/search/smartSearch` FORBIDDEN. Cypher embedding of BRAIN.md body FORBIDDEN. PR gate enforces at merge time.

8. **Versioning.** INTERFACE_VERSION = 1 at top. Bumps REQUIRED for: new frontmatter field, new section key, weight change, multiplier change, threshold change, trace field addition, access loosening. Bumps MUST ship with diff doc + backward-compat analysis + Phase 91 migration plan + Phase 90 writer update + test parity.

## Three-surface parity

Section 1.3 and Section 2.3 together freeze the three-surface rule: CLI / Desktop MCP / Cowork behave byte-identically under this contract. Each surface has both sync hook contexts and async handler contexts; the sync/async choice is per call site, not per surface. Navigation Engine MUST NOT branch decision logic on surface identity. Future INTERFACE_VERSION bumps MUST preserve this property.

## Cross-reference coverage

Every claim cites a shipped Phase 90 artifact or Phase 88 artifact:

- Plan 90-00 (schema + STALE_REASON enum + OPTIONAL_SECTION_HEADINGS): cited 13 times
- Plan 90-01 (deriveSection + Canon Part 8 chokepoint): cited 16 times
- Plan 90-02 (enqueue + drain): cited 5 times
- Plan 90-03 (staleness precedence): cited in Sections 3, 4
- Plan 90-04 (readQuadruple + isQuadrupleFresh): cited 7 times (load-bearing for Section 2)
- Plan 90-05 (invariants validator): cited 3 times (PR gate alignment)
- Plan 90-06 (cross-room aggregator): cited in Section 3.2 + 3.3 + 11.3
- Plan 90-07 (/mos:brain-derive): cited in Section 11.3 (Navigation Engine may suggest this command)
- Plan 90-08 (graceful degradation): cited in Section 11.3 (multipliers rely on failure modes being recoverable)
- Phase 88-01 (readTriple): cited 8 times (readQuadruple composes this; back-compat invariant)
- Phase 88-13 (guardian): cited once (invariant-report subscription as optional Phase 91 pre-warn surface)
- Canon Parts 3, 6, 7, 8, Appendix B, Appendix E: cited throughout with section-level role

## Verification

Plan verify block requirements (all met):

- `test -f .planning/research/navigation-engine-brain-interface.md` -> YES
- `grep -c "readQuadruple"` -> 17 (plan required >= 2)
- `grep -cE "Canon Part 8|Part 8"` -> 13 (plan required >= 3)
- `grep -c "staleness"` -> 19 (plan required >= 5)
- `grep -c "RECOMMENDED"` -> 16 (plan required >= 1)
- `grep -cE "INTERFACE_VERSION|Interface Version"` -> 8 (plan required >= 1)
- `grep -cP '[\x{2013}\x{2014}]'` -> 0 (plan hard rule; project-wide rule)
- Line count: 523 (plan required >= 180)
- 11 `## Section <N>.` headings present
- Three-surface applicability note: 4 references

Plan done-criteria cross-check:

- [x] Spec document at `.planning/research/navigation-engine-brain-interface.md`
- [x] 11 sections: Scope / Read Path / Consumed Fields / Staleness Weighting / Tier Modes / RECOMMENDED Gate / Triangulation / Trace / Canon Part 8 Boundary / Version History / Related Plans
- [x] INTERFACE_VERSION=1 at top
- [x] Zero em-dashes (project hard rule)
- [x] Three-surface applicability noted (Sections 1.3 and 2.3)
- [x] Cross-references accurate to shipped Plans 90-00, 90-04, 90-05, 90-01, 90-02, 90-06, 90-07, 90-08 and Phase 88-01, 88-13
- [x] canon_parts frontmatter declared (Parts 3, 6, 7, 8 per Phase 88.2 reference pattern)
- [x] INTERFACE_VERSION bump rules + migration obligations specified (Section 10)

## Deviations from Plan

### Auto-fixed Issues

None. Plan executed exactly as written. The only adjustment was treating the existing stub file (`.planning/research/navigation-engine-brain-interface.md` from the 2026-04-19 Phase 91 planning session) as a replacement target rather than a new file; the stub's content was superseded entirely by the v1 contract. The plan's `files_modified:` frontmatter already declared this file, so this was the expected path.

### Authentication gates

None. This is a filesystem write of a documentation artifact.

### Deferred items (out of scope)

None for this plan. The stub's original Phase 91-sourced content (brain field shape at lines 20-72) overlapped substantively with what the v1 contract formalizes; no information was lost -- the v1 contract is strictly more precise (weights, multipliers, tier modes, RECOMMENDED gate, trace fields, Canon Part 8 obligations, migration rules were all absent from the stub).

## Authentication gates

None.

## Commits

- `414e66f` docs(90-09): file Navigation Engine <-> BRAIN.md interface contract v1

## Next plan

Plan 90-10 release gate -- five-gate v1.10.14 release (CHANGELOG + plugin.json + package.json + git tag v1.10.14 + marketplace.json ref pin). The release gate will:

1. Update CANON-PHASE-MAP.md Part 3 row to move "Option generation tier-awareness (Mode A/B/Tier 0)" and related rows from "planned" to "shipped" where Phase 90 has shipped them (and leave the Phase 91-owned parts as "planned").
2. Note `.planning/research/navigation-engine-brain-interface.md` v1 as the shipped Phase 90-91 interface contract.
3. Confirm the Feynman suite status at baseline + 7 (Plans 90-00, 90-01, 90-02, 90-03 (x2), 90-04, 90-05, 90-06, 90-07, 90-08 registered test files; Plan 90-09 adds none).
4. Ship v1.10.14 with Phase 90 as the headline feature.

---

_Phase 90 Plan 09 - MindrianOS Plugin, 2026-04-20._

---

## Self-Check: PASSED

- `.planning/research/navigation-engine-brain-interface.md` FOUND (verified)
- `.planning/phases/90-brain-derivation-layer/90-09-SUMMARY.md` FOUND (this file)
- Commit `414e66f` (spec document) FOUND in git log
- 11 sections + preamble + appendix structure verified via grep
- INTERFACE_VERSION=1 frozen at top; bump rules at Section 10
- Zero em-dashes verified (project hard rule)
- All cross-references to Plans 90-00 through 90-08 present and accurate
- Phase 88-01 + 88-13 back-references present
- Three-surface applicability note in Sections 1.3 and 2.3
- Canon Part 8 boundary enumerated as five PR-gate assertions in Section 9.5
- Phase 91 CONTEXT.md already lists this file as authority_docs entry (no edit needed)
