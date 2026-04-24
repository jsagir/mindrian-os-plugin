# Navigation Engine <-> BRAIN.md Interface Contract v1

**Status**: Frozen for Phase 91 consumption
**Interface Version**: 1
**Authored**: 2026-04-20 (session)
**Authors**: Jonathan Sagir + Claude-as-Larry
**Phase**: 90 (produces contract) / 91 (consumes contract)
**Schema**: lib/core/brain-md-schema.cjs v1 (Plan 90-00)
**Read Path**: lib/core/folder-memory.cjs readQuadruple v1 (Plan 90-04)
**Validator**: lib/memory/validators/brain-md-invariants.cjs (Plan 90-05)
**Derivation Writer**: lib/core/brain-derivation.cjs deriveSection (Plan 90-01)
**Canon**: Parts 3, 6, 7, 8

---

## Preamble

This document freezes the contract between Phase 90 (Brain Derivation Layer) and Phase 91 (Navigation Engine). It is a specification, not code. Phase 91 plans its consumption against this contract. Phase 90 ships the contract at release time so Phase 91 can start planning immediately with a stable target.

The contract exists to prevent 90-91 coupling. Phase 91 plans MUST NOT reach into Phase 90 internals; they plan against what is written here. Phase 90 changes that affect Phase 91 MUST bump INTERFACE_VERSION and ship a migration note per Section 10.

Every claim in this document is backed by a shipped Phase 90 artifact or a shipped Phase 88 artifact. Cross-references cite plan numbers and filenames. Future amendments follow the same evidence standard.

---

## Section 1. Scope

### 1.1 Covered

This contract covers how Phase 91 Navigation Engine CONSUMES BRAIN.md as one of five inputs to Decision Gate triangulation (Canon Part 3 + Canon Appendix B).

Specifically:

1. The read path Navigation Engine MUST use (Section 2).
2. The frontmatter fields Navigation Engine reads (Section 3).
3. The section bodies Navigation Engine reads and their weights (Section 3).
4. The staleness weighting scheme Navigation Engine applies (Section 4).
5. The tier-mode semantics (Mode A / Mode B / Tier 0) mapped to BRAIN.md state (Section 5).
6. The RECOMMENDED marker confidence gate (Section 6).
7. The signal triangulation function inputs and BRAIN.md's role within it (Section 7).
8. The decision_trace fields Navigation Engine MUST emit for every decision involving BRAIN.md (Section 8).
9. The Canon Part 8 boundary as it applies to Navigation Engine (Section 9).

### 1.2 Not covered

This contract does NOT cover:

- Brain MCP query construction. Navigation Engine NEVER calls Brain directly; any fresh derivation routes through Plan 90-01 deriveSection and inherits Plan 90-01's Canon Part 8 chokepoint.
- BRAIN.md writing. Navigation Engine is READ-ONLY against BRAIN.md. Writes are owned by Plan 90-01 deriveSection.
- Navigation Engine internals. Decision function shape, persona mapping, offer presentation, dial rendering, and explainability trace storage are all Phase 91 concerns documented in .planning/phases/91-navigation-engine/.
- The other four triangulation inputs (ICM scope, SQL relations, Feynman-MINTO reasoning, intent/persona). Each has its own contract referenced in Section 7.

### 1.3 Three-surface applicability

The contract applies identically across all three MindrianOS surfaces: Claude Code CLI, Claude Desktop MCP, and Cowork. Each surface calls readQuadruple through Phase 88-01's sync/async split (CLI uses lib/core/folder-memory.cjs sync; Desktop MCP and Cowork use lib/core/folder-memory-async.cjs async). The fields read, the weights applied, and the decision semantics are byte-identical across surfaces. Navigation Engine MUST NOT branch decision logic on the surface.

---

## Section 2. Read Path

### 2.1 The only read entry point

Navigation Engine MUST read BRAIN.md exclusively through:

```
lib/core/folder-memory.cjs readQuadruple(sectionPath) -> {room, state, reasoning, brain}
```

or its async twin:

```
lib/core/folder-memory-async.cjs readQuadruple(sectionPath) -> Promise<{room, state, reasoning, brain}>
```

readQuadruple composes:

1. readTriple (Phase 88-01 contract) for room, state, reasoning.
2. parseBrainMd (Plan 90-04 shared-module parser) for brain.
3. attachBrainToTriple (Plan 90-04) for clean assembly.

The full API is documented in .planning/phases/90-brain-derivation-layer/90-04-SUMMARY.md.

### 2.2 Direct fs.readFileSync is FORBIDDEN

Navigation Engine code MUST NOT call fs.readFileSync, fs.readFile, fs.promises.readFile, or any equivalent on BRAIN.md paths. This mirrors the Phase 88-01 folder-memory contract for MINTO.md: reads go through the composed entry point or they do not happen.

Rationale:

- readQuadruple enforces graceful degradation (null on absent, parse_failed:true on malformed; never throws).
- readQuadruple handles OPTIONAL_SECTION_HEADINGS parity with the schema module (Plan 90-00).
- readQuadruple isolates format changes behind a single shared parser. A v2 schema migration modifies parseBrainMd once; Navigation Engine plans do not break.
- Direct reads bypass the parser's narrow-dialect YAML tolerance, staleness detection, and unknown-heading forward-compat behavior.

### 2.3 Sync vs async selection

| Caller context | Entry | Rationale |
|---|---|---|
| UserPromptSubmit hook (scripts/intent-classifier) | `lib/core/folder-memory.cjs` sync | No event loop available to bash hook; blocking read is cheapest. |
| MCP tool handler | `lib/core/folder-memory-async.cjs` async | MCP runtime expects Promise return values. |
| Statusline / dial renderer | `lib/core/folder-memory.cjs` sync | Sub-millisecond rendering path; blocking read is negligible. |
| /mos:explain-decision command | either | Command is a one-shot read; pick whichever matches caller. |

Both entry points return deep-equal quadruple structs on the same fixture (Plan 90-04 Test 12 asserts this). Key-set parity is enforced by Phase 88-01 Test 15 extended in Plan 90-04 Test 13.

The three-surface rule from Section 1.3 holds: the sync/async choice reflects caller runtime, not surface identity. Every surface (CLI, Desktop MCP, Cowork) has both sync hook contexts and async handler contexts; selection is per call site, not per surface.

### 2.4 Read caching

Navigation Engine MAY cache a single readQuadruple result for the duration of a single user turn to stay within the UserPromptSubmit 2s budget. The cache MUST invalidate at turn end. Cross-turn caching is FORBIDDEN because BRAIN.md can change asynchronously (Plan 90-02 queue drain fires a fresh derivation on governing_thought change; Plan 90-03 session-start staleness scan fires on session open).

---

## Section 3. Consumed Fields

### 3.1 Frontmatter scalars (direct read)

Navigation Engine reads the following scalars from `quadruple.brain` when `brain !== null`:

| Field | Type | Role | Phase 90 source |
|---|---|---|---|
| `section` | string (slug) | Section identity check. Navigation Engine asserts this matches the section it was called for. | Plan 90-00 REQUIRED_FRONTMATTER_FIELDS |
| `brain_generated_at` | ISO-8601 string | Age calculation input for staleness weighting (Section 4). | Plan 90-00 schema |
| `brain_graph_version` | int | Drift detection input. Navigation Engine compares against live brain-client.schema().brain_graph_version when Brain is reachable. | Plan 90-00 schema |
| `governing_thought_hash` | string (`sha256:<hex>`) | Coherence input. Navigation Engine compares against sha256 of current triple.reasoning.governing_thought. Mismatch = derivation stale by Plan 90-03 precedence rule 3. | Plan 90-00 schema; writer Plan 90-01 |
| `staleness` | enum `fresh \| stale \| unavailable` | Primary weight input (Section 4). | Plan 90-00 STALENESS enum |
| `stale_reason` | enum (nullable) | Weight modifier (Section 4). | Plan 90-00 STALE_REASON enum |
| `author` | literal `"brain"` | Attribution check. Navigation Engine MUST assert `brain.author === "brain"`; non-brain authors indicate a Canon Part 2 attribution breach and MUST demote BRAIN.md weight to 0.0 with a decision_trace note. | Plan 90-00 frozen attribution |
| `confidence_baseline` | number 0..1 (optional) | Base confidence input when section-level confidence is unavailable. Defaults to 0.5 when absent. | Plan 90-00 schema |

Navigation Engine MUST NOT read any frontmatter field outside this list. Unknown frontmatter fields are handled by Plan 90-00 validateSchema (info severity, user-extensible); Navigation Engine ignores them.

### 3.2 Section bodies (read via sections map)

Navigation Engine reads the following section bodies from `quadruple.brain.sections` when present. Each section body is either `null` (heading absent in BRAIN.md) or `{body: string, tokens_estimate: number}` (heading present).

| Section key | Role | Triangulation weight |
|---|---|---|
| `pattern_matches` | Brain-found similar claims from the teaching graph. Drives framework reuse recommendations. | 0.35 |
| `framework_chain_predictions` | FEEDS_INTO chains from current phase indicator. HIGH signal for Navigation routing. | 0.20 |
| `cross_domain_analogies` | SAPPhIRE / TRIZ / cross-domain similarity matches. Drives Engine 1 whitespace-adjacent routing (Canon Part 2 Act 1). | 0.15 |
| `wicked_indicators` | WickedIndicator signals present. Escalates team composition per Canon Appendix E rule R4. | 0.10 |
| `unfilled_opportunity_matches` | Opportunity nodes from Brain matching this section. Drives ADD-to-Bank suggestions. | 0.10 |
| `assessment_thinking_chain_position` | Current rigor level and Brain's suggested next rigor. Drives Canon Part 5 evidence-tier gating. | 0.05 |
| `problemtype_classification` | UDP / IDP / WDP with confidence. Drives Canon Part 3 option generation and Canon Appendix E team composition rules R1-R6. | 0.05 |
| `flagged_contradictions_xroom` | Cross-room contradictions surfaced by Plan 90-06 aggregator. Drives Devil's-Advocate hat escalation. | optional (caveat surface only) |
| `hsi_signals` | HSI recommendations when reverse salient present. Optional extension. | optional |

Weights on required sections sum to 1.0. Optional sections surface as caveats in decision_trace rather than adding to the weight total.

When a section is null (heading absent in BRAIN.md), Navigation Engine treats the weight as zero for that signal and surfaces a note in decision_trace ("Brain had no signal for <section>"). When a section is present but its body contains `(no signal)` (Plan 90-01 empty-results path), Navigation Engine treats the weight as zero identically.

The `tokens_estimate` field is a pre-computed size hint that Navigation Engine MAY use for budget management within the UserPromptSubmit 2s ceiling; it MUST NOT be used as a semantic signal.

### 3.3 Forbidden accesses

Navigation Engine MUST NOT:

1. Write back to BRAIN.md. Derivation is Plan 90-01's sole responsibility. Canon Part 2 attribution (author = brain) depends on this invariant.
2. Send BRAIN.md body content to Brain MCP as a query payload. Doing so is a Canon Part 8 breach. Any re-derivation Navigation Engine wants to force goes through Plan 90-02 enqueue which routes through Plan 90-01 deriveSection (the canonical Canon Part 8 chokepoint).
3. Construct Cypher queries embedding BRAIN.md body strings. See Section 9.
4. Read BRAIN.md from peer rooms. Cross-room contradictions arrive pre-aggregated via Plan 90-06 in the `flagged_contradictions_xroom` section; Navigation Engine consumes that aggregated output only.
5. Modify the `parse_failed` flag or other parser-internal fields. Those are Plan 90-04 internals.

---

## Section 4. Staleness Weighting Scheme

Navigation Engine multiplies BRAIN.md's triangulation contribution (sum of section weights per Section 3.2) by a staleness multiplier derived from `brain.staleness` and `brain.stale_reason`.

### 4.1 Multiplier table

| `brain` value | `staleness` | `stale_reason` | Multiplier | Notes |
|---|---|---|---|---|
| `null` | N/A | N/A | 0.0 | BRAIN.md absent. Tier 0 fallback (see Section 5). |
| non-null | `fresh` | `null` | 1.0 | Fully trusted signal. |
| non-null | `stale` | `age_exceeded` | 0.7 | Degraded but still valid. Brain age > 7 days (default STALE_AGE_DAYS from Plan 90-03). |
| non-null | `stale` | `governing_thought_changed` | 0.3 | Actively contradicted. The governing thought changed after derivation; pattern matches may no longer hold. |
| non-null | `stale` | `brain_graph_version_mismatch` | 0.5 | Possibly invalid. Brain graph evolved; derivation may reference retired node types. |
| non-null | `stale` | `brain_offline` | 0.9 | Transient condition. The derivation itself is current; only the network is unavailable. Canon Part 1 "Larry without Brain" honored. |
| non-null | `stale` | `derivation_timeout` | 0.2 | Write-time partial failure. Treat as nearly absent signal. |
| non-null | `stale` | `parse_failed` | 0.0 | BRAIN.md exists but could not be parsed. Treat as absent; log to decision_trace. |
| non-null | `unavailable` | any | 0.0 | Derivation explicitly unavailable. Tier 0 fallback inside the section. |

### 4.2 Brain-offline exemption

The `brain_offline` reason is a TRANSIENT network condition, not a derivation-staleness signal. Multiplier 0.9 (not 0.0) matches Plan 90-04 `isQuadrupleFresh` predicate semantics: a BRAIN.md whose only staleness reason is brain_offline is considered fresh-enough for downstream consumers. Navigation Engine MAY still issue a caveat ("Brain offline; derivation is local") in its decision_trace, but the signal weight is retained.

### 4.3 Weight floor

Navigation Engine MUST NOT apply a BRAIN.md signal weight below 0.0 or above 1.0. When multiple stale_reasons are theoretically applicable (e.g. age_exceeded AND brain_graph_version_mismatch), Plan 90-03 staleness precedence resolves to a single stale_reason; Navigation Engine applies only the resolved reason's multiplier.

### 4.4 Zero-weight semantics

Zero weight does NOT delete the signal from decision_trace. Navigation Engine MUST still record `brain_md_staleness`, `brain_md_stale_reason`, and the zero `brain_md_weight_applied` so /mos:explain-decision can surface "BRAIN.md was present but its weight was zeroed because <reason>."

---

## Section 5. Tier Mode Mapping

Canon Part 3 defines three option-generation tier modes. This section maps each to BRAIN.md state so Navigation Engine can select the correct option-generation path deterministically.

### 5.1 Mode A: Full Loop

**Conditions:** Brain is reachable (`brain-client.isAvailable() === true`) AND `quadruple.brain !== null` AND `brain.staleness !== 'unavailable'` AND `brain.parse_failed !== true`.

**Option generation:** Brain-ranked. Top-k candidates from `brain.sections.framework_chain_predictions` and `brain.sections.pattern_matches` become Canon Part 3 verb options. RECOMMENDED marker available per Section 6.

**BRAIN.md signal weight:** Per Section 4 multiplier table (typically 1.0 for fresh, 0.3-0.9 for various stale).

**Full triangulation:** All five signals contribute. BRAIN.md is the methodology signal. Signal triangulation function runs across the full five inputs.

### 5.2 Mode B: Local Only

**Conditions:** Brain is unreachable (`brain-client.isAvailable() === false`) AND `quadruple.brain !== null` AND `brain.stale_reason === 'brain_offline'` is acceptable.

**Option generation:** Local-history ranked. Navigation Engine reads STATE.md decision history, room.db edge counts, and BRAIN.md local cache to select plausible next verbs. NO RECOMMENDED marker (Canon Part 3 invariant; see Section 6).

**BRAIN.md signal weight:** 0.9 multiplier (brain_offline exemption per Section 4.2). The local BRAIN.md is still authoritative for methodology signal; only the network is down.

**Triangulation:** Four signals contribute (ICM, SQL, MINTO, BRAIN-local). Intent/persona contributes as always. Brain is not queried for fresh options.

### 5.3 Tier 0 Fallback

**Conditions:** `quadruple.brain === null` (BRAIN.md absent) OR `brain.staleness === 'unavailable'` OR `brain.parse_failed === true` AND the user has not yet run a successful derivation for this section.

**Option generation:** Hardcoded minimal set per Canon Part 3: Run Methodology / Reformulate / Free-Text. NO ranking, no confidence, no RECOMMENDED marker.

**BRAIN.md signal weight:** 0.0. Fall through to triple-only decisions (reasoning_health_score from MINTO + governing_thought presence check + STATE.md metrics).

**Triangulation:** Four signals contribute (ICM, SQL, MINTO, intent/persona). BRAIN.md contributes nothing. Decision_trace explicitly notes "Tier 0 fallback: BRAIN.md absent or unavailable."

### 5.4 Mode transitions

Navigation Engine MUST NOT cache a mode decision across turns. Every turn re-evaluates the tier mode because:

- Plan 90-02 queue drain can flip a Tier 0 section to Mode A within one UserPromptSubmit cycle.
- Plan 90-03 session-start staleness scan can re-derive and flip stale to fresh at session open.
- brain-client availability can change mid-session (network recovery, rate-limit recovery).

Mode transitions are logged to decision_trace with the prior mode and the current mode so /mos:explain-decision can show the history.

---

## Section 6. RECOMMENDED Marker Confidence Gate (Canon Part 3 invariant)

Canon Part 3 defines the RECOMMENDED marker on Decision Gate options. This section freezes when Navigation Engine is allowed to render the marker.

### 6.1 Gate conditions

Navigation Engine renders the RECOMMENDED marker on a Decision Gate option IF AND ONLY IF ALL of the following hold:

1. **Tier mode is Mode A (Full Loop).** See Section 5.1. Mode B and Tier 0 NEVER render the marker.
2. **BRAIN.md pattern_matches section is present AND non-null AND has at least one candidate.** The candidate MUST be parseable from the section body.
3. **The candidate's confidence score is >= 0.7.** The confidence score is read from the candidate entry within the pattern_matches body (Plan 90-01 emits `confidence: <float>` per candidate).
4. **The candidate matches the option.** The option verb and the candidate verb MUST be identical (Canon Part 3 10-verb vocabulary).

### 6.2 Gate rationale

The 0.7 threshold is the Canon Part 3 invariant. Below 0.7, no option is marked. This prevents Navigation Engine from elevating weak patterns to RECOMMENDED status. The threshold aligns with Phase 88.2 uiux-selector-block's shape contract.

The Mode A requirement is the load-bearing constraint: without Brain-ranked confidence scores, a "recommended" marker would be arbitrary. In Mode B and Tier 0, all options carry equal weight; the navigator decides.

### 6.3 Fallback behavior

When the gate fails, Navigation Engine still renders the Decision Gate. Options still show. The RECOMMENDED marker simply does not appear on any option. Canon Part 3 10-verb vocabulary and 5 F-sub-shapes are unaffected.

### 6.4 Trace requirement

Every decision that evaluated the RECOMMENDED gate MUST record in decision_trace:

- The mode at gate evaluation time (A / B / Tier 0).
- The highest candidate confidence found in pattern_matches (or null).
- Whether the gate passed (boolean).
- If passed, which option received the marker.

This trace is the audit surface for /mos:explain-decision ("Why did Larry suggest this option?").

---

## Section 7. Signal Triangulation (Canon Appendix B)

Canon Appendix B maps ICM Layers 0-4 to Canon Parts. This section freezes BRAIN.md's role within Navigation Engine's five-signal triangulation function.

### 7.1 The five inputs

| Layer | Signal | Source interface | Canon mapping |
|---|---|---|---|
| ICM Layer 0 (Identity) | ROOM.md | readQuadruple.room (Phase 88-01 contract) | Canon Part 1 Wicked Navigator |
| ICM Layer 3 (Quantitative) | room.db edge counts | Phase 84 + Phase 87 cascade contract | Canon Part 4 graph data |
| ICM Layer 2 (Reasoning) | Feynman-MINTO triple | readQuadruple.reasoning (Phase 88-01) | Canon Part 5 evidence tiers |
| ICM Layer 3 (Methodology) | BRAIN.md | readQuadruple.brain (this contract) | Canon Part 2 team around navigator |
| ICM Layer 1 (Routing) | Intent + persona | UserPromptSubmit + USER.md | Canon Parts 2, 2a, 3 |

### 7.2 BRAIN.md's specific role

BRAIN.md contributes the METHODOLOGY signal. Its outputs drive:

- Framework chain routing (Canon Appendix E rules R1-R6 team composition; framework_chain_predictions section).
- Problem-type classification (Canon Part 3 Mode A option generation; problemtype_classification section).
- Wicked-indicator escalation (Canon Appendix E rule R4; wicked_indicators section).
- Cross-domain analogy surfacing (Canon Part 2 Engine 1 Act 1; cross_domain_analogies section).
- Unfilled opportunity surfacing (Canon Part 2 Opportunity Bank affordance; unfilled_opportunity_matches section).
- Assessment rigor gating (Canon Part 5 evidence tiers; assessment_thinking_chain_position section).

The other four signals contribute their own specific roles via their own contracts. Navigation Engine triangulates across all five; no single signal dominates.

### 7.3 Triangulation function shape

The triangulation function is NOT specified here. Phase 91 Plan 91-00 defines the decision function shape. This contract specifies ONLY:

- BRAIN.md contributes per Section 3.2 weights multiplied by Section 4 staleness multiplier.
- BRAIN.md is independent of the other four signals (no cross-signal dependencies at the input layer).
- Navigation Engine MUST record every BRAIN.md contribution to decision_trace per Section 8.

Future INTERFACE_VERSION bumps MAY refine weights or add new sections; they MUST NOT alter the independence property or the decision_trace emission requirement.

---

## Section 8. Trace Requirements

Every Navigation Engine decision that involves BRAIN.md (every Mode A or Mode B decision, regardless of whether BRAIN.md ultimately influenced the outcome) MUST record the following fields in its decision_trace structure:

### 8.1 Required fields

| Field | Type | Value |
|---|---|---|
| `brain_md_version` | integer or null | `brain.brain_graph_version` value, OR null when brain is null. |
| `brain_md_staleness` | string | `brain.staleness` value ('fresh' / 'stale' / 'unavailable'), OR the literal string `'absent'` when brain is null. |
| `brain_md_stale_reason` | string or null | `brain.stale_reason` value, OR null when brain is null OR when staleness is 'fresh'. |
| `brain_md_weight_applied` | number 0..1 | The staleness multiplier from Section 4 that was applied. Zero when brain is null. |
| `brain_md_recommended_confidence` | number or null | Highest pattern_matches confidence encountered during gate evaluation, OR null when no pattern_matches candidates exist. |
| `brain_md_recommended_marker_rendered` | boolean | Whether the RECOMMENDED marker was rendered on any option. |
| `brain_md_tier_mode` | string | Resolved tier mode ('mode_a' / 'mode_b' / 'tier_0'). |
| `brain_md_sections_consumed` | array of strings | List of section keys that contributed non-null bodies to the decision. |

### 8.2 Where the trace lives

Phase 91 Plan 91-05 ships /mos:explain-decision. The trace is persisted per decision at `.mindrian/decision-traces/<session-id>.json` (auto-rotated after 50 traces per Phase 91 CONTEXT risk 6). This contract only constrains the SHAPE of the BRAIN.md portion of the trace; file location, rotation policy, and render format are Phase 91 concerns.

### 8.3 Why the trace matters

The trace is the user-visible explanation surface for "Why did Larry suggest this?" Without a complete BRAIN.md contribution record, users cannot:

- Distinguish Mode A decisions from Mode B fallbacks.
- Understand why the RECOMMENDED marker appeared or did not appear.
- Verify that BRAIN.md was not silently ignored when it should have contributed.
- Audit whether stale BRAIN.md degraded the decision (and if so, by how much).

The trace also enables future drift detection. If Phase 92 ships a drift detection engine that flags Navigation decisions diverging from Brain-ranked options, the trace fields in this section are the primary input surface.

---

## Section 9. Canon Part 8 Boundary

Canon Part 8 is the Graph Boundary constitutional contract. Phase 90 ships five independent Canon Part 8 tripwires (schema doc / prompt-builder allow-list / invariants body scan / cross-room sanitize / graceful-degradation failure-mode sweep). This section freezes how the boundary applies to Navigation Engine.

### 9.1 Navigation Engine is a PURE LOCAL READER

Navigation Engine reads BRAIN.md via readQuadruple. Every byte it touches is local. It makes decisions locally. It emits decision_trace locally. It never sends BRAIN.md content over any network boundary.

### 9.2 Fresh derivations route through Plan 90-01

When Navigation Engine determines that a BRAIN.md is stale and needs fresh derivation, it MUST route the request through Plan 90-02 `enqueue(roomDir, section, prev_hash, new_hash, reason)` with reason `'session_start_stale'`, `'governing_thought_changed'`, or `'manual_invocation'` as appropriate. The queue drain invokes Plan 90-01 `deriveSection` which carries the full Canon Part 8 chokepoint:

- `buildBrainQueryContext` reads user-specific triple fields once and outputs allow-list scalars only.
- `validateCtx` rejects any non-allow-list key at prompt-builder entry.
- Schema gate rejects writes whose violations include canon_boundary at ERROR severity.
- Cross-room aggregation applies the four Plan 90-06 layers.

Navigation Engine does NOT call deriveSection directly. It enqueues. The drain fires outside the user turn. The fresh BRAIN.md lands before the next session-start or before the next drain cycle, whichever comes first.

### 9.3 Direct Brain queries from Navigation Engine are FORBIDDEN

Navigation Engine code MUST NOT call `brain-client.query`, `brain-client.search`, `brain-client.smartSearch`, or any equivalent that sends a payload to brain.mindrian.ai. The only allowed brain-client touches are:

- `brain-client.isAvailable()` for Mode A vs Mode B selection. Returns boolean. No network when cached.
- `brain-client.schema()` for brain_graph_version comparison during staleness check. Returns scalar. No user content leaves the local process.

Any future Navigation Engine plan proposing a direct Brain query from decision logic MUST be rejected and re-routed through Plan 90-01 deriveSection with prompt-builder Canon Part 8 guards.

### 9.4 Cypher embedding of BRAIN.md body is FORBIDDEN

If Navigation Engine ever constructs a Cypher query (e.g. for a future direct graph enrichment), it MUST NOT embed any string from BRAIN.md body text in the query. Allowed inputs to any Navigation-constructed Cypher are: section slugs, frozen enum values (UDP/IDP/WDP, Simple/Complex/Wicked, phase indicators), sha256 hashes, and bounded integers. This mirrors Plan 90-01 `buildBrainQueryContext` discipline.

In practice, v1 of this interface expects Navigation Engine to construct ZERO Cypher queries directly. All graph queries route through Plan 90-01. If a future INTERFACE_VERSION introduces direct Cypher, this section MUST be amended with the specific allow-list for that use case.

### 9.5 PR gate alignment

Every Phase 91 PR that touches Navigation Engine code MUST pass the Canon Part 8 PR gate (same contract Phase 90 follows). Reviewers assert:

1. No fs.readFileSync on BRAIN.md outside readQuadruple.
2. No brain-client.query / search / smartSearch calls.
3. No string concatenation that embeds BRAIN.md body into a Cypher template.
4. No network payload constructor takes `brain.sections.*.body` as input.

A PR that fails any of these is blocked pending architectural review. The default answer when uncertain is block; Canon Part 8 is not negotiable.

---

## Section 10. Version History and Migration

### 10.1 Version history

| INTERFACE_VERSION | Date | Plan | Changes |
|---|---|---|---|
| 1 | 2026-04-20 | 90-09 | Initial contract. All 11 sections. |

### 10.2 Bump rules

Any of the following changes REQUIRE an INTERFACE_VERSION bump:

- Adding a new frontmatter field to Section 3.1.
- Adding or removing a section key in Section 3.2.
- Changing any weight in Section 3.2.
- Changing any multiplier in Section 4.1.
- Changing the 0.7 RECOMMENDED marker threshold in Section 6.
- Adding a required field to Section 8.1.
- Loosening any forbidden access in Section 3.3 or Section 9.

### 10.3 Migration obligations

A bump from vN to vN+1 MUST ship with:

1. **Diff document.** What changed between vN and vN+1. Filed at `.planning/research/navigation-engine-brain-interface-v<N+1>-migration.md`.
2. **Backward-compat analysis.** How existing BRAIN.md files behave under vN+1 Navigation Engine logic. If some fields are no longer read, note the demotion.
3. **Phase 91 migration plan.** A Phase 91 plan that updates Navigation Engine code to consume vN+1. The plan lands in the same release as the contract bump OR in a dedicated sub-milestone.
4. **Phase 90 derivation update.** If the bump requires new fields in BRAIN.md, Plan 90-01 `deriveSection` ships the writer update AND Plan 90-00 schema accepts the new shape.
5. **Test parity.** Both Phase 90 and Phase 91 test suites ship assertions against the new contract in the bump commit.

### 10.4 Non-breaking changes

The following are NOT bumps:

- Clarifying wording within an existing section.
- Adding examples that do not change behavior.
- Correcting cross-references to shipped plans.
- Adding notes about edge cases already implicit in the contract.

Non-breaking changes ship as amendments to this file with a dated note at the bottom; no INTERFACE_VERSION change required.

---

## Section 11. Related Plans and Phases

### 11.1 Produces this contract

| Plan | Role |
|---|---|
| 90-09 | This plan. Files the contract at release time so Phase 91 can plan against it. |

### 11.2 Consumes this contract

| Plan | Role |
|---|---|
| 91-CONTEXT | Phase 91 Navigation Engine context declares this file as an authority_docs entry. |
| 91-00 | Navigation Engine core module plans its decide() logic against Sections 3, 4, 5, 7. |
| 91-02 | UserPromptSubmit hook integration plans against the 2s budget implied by Section 2.4 read caching. |
| 91-03 | Skill activation routing plans against Section 5 tier modes. |
| 91-04 | Next-step offer presentation plans against Section 6 RECOMMENDED marker gate. |
| 91-05 | /mos:explain-decision plans against Section 8 trace requirements. |
| 91-06 | Statusline dial plans against Section 5 tier mode mapping. |
| 91-07 | Problem-type routing plans against Section 3.2 problemtype_classification section. |
| 91-08 | Framework chain composition plans against Section 3.2 framework_chain_predictions section. |
| 91-09 | Release gate verifies this contract is honored by shipped Phase 91 code. |

### 11.3 Phase 90 references

| Plan | Artifact | Role in this contract |
|---|---|---|
| 90-00 | `lib/core/brain-md-schema.cjs` | Freezes the frontmatter fields + OPTIONAL_SECTION_HEADINGS + STALE_REASON enum that Section 3 cites. |
| 90-01 | `lib/core/brain-derivation.cjs deriveSection` | The writer. Section 9.2 Canon Part 8 chokepoint lives here. Navigation Engine routes all fresh derivations through this. |
| 90-02 | `lib/core/brain-derivation-queue.cjs enqueue` | The queue. Section 9.2 re-derivation requests go through this. |
| 90-03 | `lib/core/brain-md-staleness.cjs computeBrainStaleness` | The staleness computation. Section 4 multiplier inputs (staleness + stale_reason) come from this module. |
| 90-04 | `lib/core/folder-memory.cjs readQuadruple` | The read path. Section 2.1 names this as the only allowed entry. |
| 90-05 | `lib/memory/validators/brain-md-invariants.cjs` | Registry-compatible validator. Author mismatch, hash mismatch, version drift, canon leak surface through this at guardian boundaries. |
| 90-06 | `lib/core/cross-room-aggregator.cjs` | Populates `flagged_contradictions_xroom`. Section 3.2 treats this as optional caveat surface. |
| 90-07 | `scripts/brain-derive-command.cjs` | Manual /mos:brain-derive command. Navigation Engine MAY suggest this command as a verb option when a section's BRAIN.md is absent or deeply stale. |
| 90-08 | `lib/memory/brain-derivation-graceful-degradation.test.cjs` | Proves the stack survives every realistic failure mode. Section 4 multipliers rely on these failure modes being recoverable. |

### 11.4 Phase 88 references

| Plan | Artifact | Role in this contract |
|---|---|---|
| 88-01 | `lib/core/folder-memory.cjs readTriple` | readQuadruple composes readTriple; back-compat invariant ensures Phase 88 consumers are unaffected by Phase 90 additions. |
| 88-13 | `scripts/feynman-minto-guardian.cjs` | Runs brain-md-invariants validator (Plan 90-05) at session-start, on-stop, pre-commit. Navigation Engine MAY subscribe to the invariant-report to pre-warn on stale BRAIN.md before the next turn. |

### 11.5 Canon references

| Canon | Section | Role |
|---|---|---|
| Part 3 | Tri-Context Decision Gate | Section 5 tier modes, Section 6 RECOMMENDED gate, Section 7 triangulation. |
| Part 6 | Product-as-Venture | This document dog-foods the canon: interface specs at phase boundaries prevent 90-91 coupling. |
| Part 7 | Reuse Before Build | Section 2 read path reuses Phase 88-01 folder-memory contract; no new read primitive invented. |
| Part 8 | Graph Boundary | Section 9 freezes Navigation Engine's Canon Part 8 obligations. |
| Appendix B | ICM Layer to Canon mapping | Section 7 triangulation maps each signal to its ICM layer. |
| Appendix E | Beautiful Questions + Team Composition + Handoff Triggers | Section 7 BRAIN.md role drives the rules R1-R6 and the handoff triggers. |

### 11.6 Forward pointers

| Future plan | Expected relationship |
|---|---|
| Phase 92 (drift detection, proposed) | MAY consume decision_trace (Section 8) to detect Navigation decisions diverging from Brain-ranked options. |
| Phase 93+ (Discord/Zulip multi-surface) | MUST honor the three-surface applicability note (Section 1.3). |
| Cross-user intelligence (v1.11+ or v2.x) | OUT OF SCOPE for this contract. A separate interface contract will be written if and when cross-user aggregation is built. Canon Part 8 forbids any current Phase 91 work from assuming cross-user data availability. |

---

## Appendix: Quick Reference

### Fastest path from a Phase 91 plan to this contract

1. Need to read BRAIN.md? -> Section 2. Use readQuadruple.
2. Need to know what fields are available? -> Section 3.
3. Need to weigh BRAIN.md against freshness? -> Section 4.
4. Need to pick an option-generation strategy? -> Section 5.
5. Need to render RECOMMENDED? -> Section 6.
6. Need to explain a decision? -> Section 8.
7. Worried about Canon Part 8? -> Section 9. When in doubt, route through Plan 90-01.
8. Changing the contract? -> Section 10. Bump INTERFACE_VERSION and ship migration.

---

_Navigation Engine <-> BRAIN.md Interface Contract v1 - MindrianOS Plugin, 2026-04-20._
