# BRAIN.md Schema Reference

Version: 1 (SCHEMA_VERSION = 1)
Status: Active
Phase: 90-brain-derivation-layer, Plan 90-00 (shipped)
Validator: `lib/core/brain-md-schema.cjs`
Tests: `lib/memory/brain-md-schema.test.cjs` (18 fixtures, wired into Feynman suite)

---

## 1. What BRAIN.md Is

BRAIN.md is the Brain-authored derivation layer in the per-folder memory quadruple. The quadruple is:

| File | Author | Role | Trigger |
| --- | --- | --- | --- |
| ROOM.md | User + recompiler | Identity, references | Post-write (Phase 88 Wire 1) |
| STATE.md | compute-state | Quantitative state | On-stop |
| Feynman-MINTO.md | User + Feynman pipeline | Compressed logical flow | Post-write debouncer |
| **BRAIN.md** | **Brain derivation pipeline** | **Derived pattern layer on top of the above three** | **governing_thought change OR /mos:brain-derive** |

BRAIN.md is optional per section. Absence is valid:

- Brain unreachable means the file is not written. This is not an error.
- No Brain signal for a section means no derivation. This is not an error.
- A user can delete BRAIN.md and the system stays healthy.

Schema compliance is enforced at three checkpoints: derivation write time (Plan 90-01), registry validator pass (Plan 90-05), and Navigation Engine read time (Phase 91).

## 2. Frontmatter Field Reference

### Required fields (6)

| Field | Type | Example | Notes |
| --- | --- | --- | --- |
| `section` | string | `"market-analysis"` | Matches room section folder name. |
| `brain_generated_at` | ISO-8601 string | `"2026-04-20T14:22:00Z"` | Wall-clock at derivation emission. |
| `brain_graph_version` | integer | `21432` | Brain node count snapshot. Drives graph-version mismatch detection. |
| `governing_thought_hash` | sha256 hex string | `"sha256:0123...ef0123..."` | 64-hex of the MINTO governing_thought at derivation time. Drives invalidation. |
| `staleness` | enum string | `fresh` | One of `fresh`, `stale`, `unavailable`. |
| `author` | frozen string | `brain` | MUST equal `"brain"`. Any other value is an attribution breach (see Part 8). |

### Optional fields (4)

| Field | Type | Example | Notes |
| --- | --- | --- | --- |
| `stale_reason` | enum or null | `governing_thought_changed` | One of the five STALE_REASON values. Required when `staleness=stale`. |
| `confidence_baseline` | float [0, 1] | `0.7` | Brain's self-reported confidence baseline for this derivation. |
| `brain_query_count` | integer | `12` | Number of Brain queries run to produce this derivation. |
| `cost_tokens` | integer | `4500` | Token cost accounting for this derivation. |

### Minimum valid BRAIN.md

```yaml
---
section: "market-analysis"
brain_generated_at: "2026-04-20T14:22:00Z"
brain_graph_version: 21432
governing_thought_hash: "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
staleness: fresh
author: brain
---
```

### Maximum valid BRAIN.md (all fields plus all 9 optional section bodies)

```yaml
---
section: "market-analysis"
brain_generated_at: "2026-04-20T14:22:00Z"
brain_graph_version: 21432
governing_thought_hash: "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
staleness: fresh
author: brain
stale_reason: null
confidence_baseline: 0.7
brain_query_count: 12
cost_tokens: 4500
---

## Pattern Matches
Brain matched 3 similar framework chains in the teaching graph.

## Cross-Domain Analogies
SAPPhIRE maps to two adjacent problem types.

## Wicked Indicators
Three WickedIndicator signals present.

## Unfilled Opportunity Matches
Two Opportunity nodes matched this section pattern.

## Framework Chain Predictions
JTBD-Outcome-Driven feeds into Porter Five Forces at phase 3.

## Assessment Thinking Chain Position
Current rigor level 2. Brain suggests advancing to level 3.

## ProblemType Classification
UDP-Complex with confidence 0.68.

## Flagged Contradictions (cross-room)
None.

## HSI Signals
Cross-domain innovation score 0.41.
```

## 3. Section Headings Reference

All nine section headings are OPTIONAL. Brain populates only what applies. Absence of a section means "no signal", not "broken". Unknown (user-added) headings are permitted and surface as `schema/info` for audit, never as errors.

| Heading | What it carries |
| --- | --- |
| `## Pattern Matches` | Brain-found similar claims from teaching graph with confidence scores. |
| `## Cross-Domain Analogies` | SAPPhIRE / TRIZ / analogy matches to other domains. |
| `## Wicked Indicators` | WickedIndicator signals present, recommended methodology escalation. |
| `## Unfilled Opportunity Matches` | Opportunity nodes from Brain matching this section's pattern. |
| `## Framework Chain Predictions` | FEEDS_INTO predictions based on current applied framework. |
| `## Assessment Thinking Chain Position` | Current rigor level, Brain's suggestion for next rigor. |
| `## ProblemType Classification` | Undefined / Ill-Defined / Well-Defined / Wicked with confidence. |
| `## Flagged Contradictions (cross-room)` | Patterns this section contradicts in other rooms the user owns. |
| `## HSI Signals` | Cross-domain innovation score if applicable. |

Canonical spelling and punctuation are load-bearing. The validator matches headings exactly; minor typos render as `schema/info` (unknown heading) rather than failing validation.

## 4. Staleness Model

### Three states

| State | Meaning |
| --- | --- |
| `fresh` | Derivation reflects the current governing_thought and the current Brain graph version. Safe to consume. |
| `stale` | Derivation exists but one or more inputs have changed. Consume with care. A `stale_reason` MUST accompany this state. |
| `unavailable` | Brain could not produce a derivation on last attempt. File is a placeholder recording the attempt. |

### Five stale_reason values

| Value | Meaning |
| --- | --- |
| `null` | Only valid when `staleness=fresh`. The absence of a reason. |
| `governing_thought_changed` | The MINTO governing_thought hash no longer matches. Re-derivation needed. |
| `brain_offline` | Last derivation attempt could not reach the Brain. |
| `derivation_timeout` | Brain reached but derivation exceeded the timeout budget. |
| `brain_graph_version_mismatch` | Brain graph version in frontmatter differs from current. Patterns may reference retired nodes. |

### governing_thought_hash invalidation mechanic

Every BRAIN.md carries the SHA256 of the section's Feynman-MINTO governing_thought string at derivation time. When the governing_thought is rewritten (user edit, regeneration), the new hash no longer matches. Plan 90-02 enqueues re-derivation; Plan 90-03 session-start scan catches any BRAIN.md whose hash has drifted without a trigger hit.

This is the primary freshness signal. Clock-based freshness (for example "7 days old") is a fallback, not the primary contract.

## 5. Canon Part 8 Contract (CRITICAL)

This section is the schema-layer manifestation of Canon Part 8 (The Graph Boundary, `docs/MINDRIAN-CANON.md`). Violations here are constitutional breaches, not preference misses.

### ALLOWED in BRAIN.md frontmatter

BRAIN.md fields carry ONLY generic handles. Every example below is safe:

- Framework handles: `framework:jtbd-outcome-driven`, `framework:porter-five-forces`, `framework:swot`
- Phase identifiers: `phase:problem-definition`, `phase:ideation`, `phase:market-analysis`
- Problem type labels: `UDP-Complex`, `IDP-Wicked`, `WDP-Simple`
- Cryptographic hashes: sha256 hex strings (governing_thought_hash)
- Canonical enum values: `fresh`, `stale`, `unavailable`, `brain_offline`, `derivation_timeout`, `governing_thought_changed`, `brain_graph_version_mismatch`
- Boolean flags, integers, confidence floats in `[0, 1]`, ISO-8601 timestamps
- The literal string `brain` for the `author` field

### FORBIDDEN in BRAIN.md frontmatter

BRAIN.md frontmatter NEVER carries user-specific bytes. The following are constitutional breaches:

- User artifact bodies ("We plan to launch in Q3 2026")
- Meeting transcripts or fragments ("In the meeting with Dror we decided...")
- Personal identifiers (names as authors, email addresses, phone numbers, social security numbers)
- Proprietary revenue, valuation, or financial numbers ("$3M ARR", "$450K MRR")
- Quoted persons by name ("Lawrence said...", "Jonathan proposed...")
- Any string that would need redaction to ship a BRAIN.md file to a third party

### Schema-layer enforcement

The validator runs a conservative heuristic scan against a frozen regex set:

| Pattern | Matches |
| --- | --- |
| `/@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,}/` | Email-like substrings |
| `/\$[0-9][\d,.]*[KMB]?\b/` | Currency magnitudes |
| `/\b(Lawrence\|Jonathan\|Nimrod\|Oren\|Dror)\s+said\b/i` | Quoted-person attribution |
| `/\bmeeting with\b/i` | Meeting fragments |
| `/\b\d{3}-\d{2}-\d{4}\b/` | SSN-like patterns |

Matches emit a `canon_boundary` / `warning` violation with `action_hint = "canon_part8_review"`. Heuristics are deliberately over-inclusive: the cost of a false positive is a one-line review; the cost of a false negative is a constitutional breach.

Hard blocks live at the runtime layer. Plan 90-01 derivation writer rejects content that trips the Part 8 scan before the file is written. This schema validator is the read-time and ship-time audit surface.

## 5.1 Semantic Layer vs Context Layer

room.db (the local per-room graph, SQLite, `room/.room-graph/room.db`) is one
generic property graph: `nodes(id, type, properties)` and `edges(source,
target, type, properties)` (`lib/core/lazygraph-ops.cjs:160-183`), with no
separate table or column for "semantic" versus "context" data. The boundary
lives in an ownership allowlist keyed on the `type` string, not in the DDL.

| Layer | Node / edge types | Property | `rebuildGraph` behavior |
| --- | --- | --- | --- |
| SEMANTIC layer (schema and structure) | `Artifact`, `Section`, `BELONGS_TO` | Derivable from the filesystem | Safe to wipe and re-derive on every `rebuildGraph` |
| CONTEXT layer (institutional knowledge) | `memory_event`, human-confirmed truth-claim nodes, decisions, opportunity `stage_history`, and the other 22 of the 23 `EDGE_TYPES` | Irreplaceable; human-confirmed or session-accumulated | Must survive `rebuildGraph` |

**Enforcement.** `lib/core/lazygraph-ops.cjs:81` (`INDEXER_OWNED_NODE_TYPES`),
`:84` (`INDEXER_OWNED_EDGE_TYPES`), and the ownership-scoped DELETE at `:131`
are the single implementation both destructive reindex paths over room.db
share.

**The incident that proves it is load-bearing.** Phase 236 (GRAPHDB-01)
existed because the indexer treated context-layer rows as semantic-layer rows
and truncated them. The fix was DELETE SCOPE, not atomicity
(`.planning/REQUIREMENTS.md:21`).

**BRAIN.md's own version of the same split.** BRAIN.md sits on top of the same
room.db, and carries the identical distinction in its own frontmatter and
body:

| BRAIN.md content | Layer | Regeneration |
| --- | --- | --- |
| The nine optional analysis section headings (Pattern Matches, Cross-Domain Analogies, Wicked Indicators, Unfilled Opportunity Matches, Framework Chain Predictions, Assessment Thinking Chain Position, ProblemType Classification, Flagged Contradictions, HSI Signals) | SEMANTIC (derived) | Re-derivable on demand via `/mos:brain-derive`; safe to regenerate |
| `brain_graph_version`, `governing_thought_hash`, `staleness`, `author`, and any user-authored frontmatter or body content | CONTEXT (institutional) | Must not be silently regenerated; a version or hash mismatch surfaces as staleness, never a silent overwrite |

BRAIN.md is already ahead of `STATE.md` here: it carries `brain_graph_version`
in its required frontmatter (`lib/core/brain-md-schema.cjs:76-83`), a
graph-version stamp `STATE.md` lacked until CTXL-01.

**Canon linkage.** This is the operational expression of Canon Part 9 Memory
Locality: "only a human confirms a truth-claim node."

**External corroboration.** MotherDuck measured a +72 percentage point
accuracy improvement and about 55 percent lower cost per run on the DABStep
agentic analytics benchmark when context is kept in a separate curated layer
rather than discovered ad hoc
(https://motherduck.com/blog/context-belongs-in-the-warehouse, 2026-07-29). A
second MotherDuck A/B result is the stronger, falsifiable version of the same
finding: baking domain knowledge directly into the warehouse capped accuracy
at 93 percent, while moving the identical knowledge into a separate curated
layer reached 100 percent
(https://motherduck.com/blog/oops-maybe-we-do-need-semantic-layers). Both are
MotherDuck's own measurements, cited here with their source, never restated as
MindrianOS findings.

This section does not modify Section 5's Canon Part 8 ALLOWED/FORBIDDEN
contract above; it only names the layer the contract already protects.

## 6. Version History

| Version | Date | Changes |
| --- | --- | --- |
| 1 | 2026-04-20 | Initial schema. 6 required fields, 4 optional fields, 9 canonical section headings, 5 violation categories, Canon Part 8 leak heuristics. |

Any change to required fields, enum values, or section heading names requires:

1. Incrementing `SCHEMA_VERSION` in `lib/core/brain-md-schema.cjs`.
2. A migration plan that handles BRAIN.md files written under older versions (forward-compatible read + schema-version-aware write).
3. Updating Plan 90-01 derivation writer, Plan 90-04 `readQuadruple`, Plan 90-05 invariants validator, and Phase 91 Navigation Engine in the same milestone.

Schema drift without a version bump is a regression. The test suite enforces shape parity with the frozen enum exports.

## 7. Downstream Consumers

The schema is the load-bearing contract every Plan 90-* and Phase 91 reads against:

| Consumer | How it uses the schema |
| --- | --- |
| Plan 90-01 derivation core | Writes BRAIN.md that `validateSchema(path)` returns valid for. Pre-write Part 8 guard uses the same leak heuristics. |
| Plan 90-02 governing_thought change trigger | Reads `governing_thought_hash` field, compares against current MINTO hash, enqueues re-derivation on mismatch. |
| Plan 90-03 session-start staleness scan | Reads `staleness` and `brain_generated_at` to classify each BRAIN.md; annotates QUADRUPLE_CONTEXT. |
| Plan 90-04 `readQuadruple` | Parses BRAIN.md into the fourth slot of the memory quadruple; degrades gracefully on absence or invariant violation. |
| Plan 90-05 invariants validator | Wraps `validateSchema` in a registry-discoverable validator parallel to `feynman-minto-invariants`; integrated into Phase 88 guardian. |
| Plan 90-06 cross-room aggregation | Populates `## Flagged Contradictions (cross-room)` section while respecting registry + GUARDRAIL scope. |
| Plan 90-07 `/mos:brain-derive` command | Emits BRAIN.md through the same writer path; relies on the schema to confirm success. |
| Plan 90-08 graceful degradation suite | Asserts BRAIN.md is never half-written, never malformed, never crashes consumers when absent. |
| Plan 90-09 Navigation Engine interface spec | Cites this schema as the stable contract Phase 91 plans against. |
| Phase 91 Navigation Engine | Reads BRAIN.md as structured signal for routing decisions. Freshness gates whether a signal counts; absent BRAIN.md means "no signal" not "broken". |

---

## Appendix A: Violation Categories Summary

| Category | Severity ceiling | What triggers it |
| --- | --- | --- |
| `existence` | critical | File missing, non-regular, or zero-byte. |
| `schema` | error | Missing required field, bad YAML, bad frontmatter delimiters; unknown section heading downgraded to info. |
| `staleness` | warning | Bad `staleness` enum, bad `stale_reason` enum, or `staleness=stale` with null `stale_reason`. |
| `attribution` | error | Missing `author` field or `author != "brain"`. |
| `canon_boundary` | warning | Canon Part 8 leak heuristic matched in any frontmatter scalar. Carries `action_hint="canon_part8_review"`. |

## Appendix B: Cross-Reference

- Canon Part 2 (Team Around the Navigator): BRAIN.md is the Brain-authored artifact the team reads.
- Canon Part 3 (Tri-Context Decision Gate): BRAIN.md populates the BRAIN context at every gate.
- Canon Part 8 (Graph Boundary): this document is the schema-layer enforcement of the Part 8 boundary.
- Phase 88 (Feynman-MINTO Memory Layer): BRAIN.md extends the triple (ROOM.md + STATE.md + Feynman-MINTO.md) to a quadruple.
- Phase 88-00-B (Feynman-MINTO Invariants): the reference implementation this validator mirrors.
- Phase 91 (Navigation Engine): the consumer that converts BRAIN.md into Decision Gate options in Mode B (Local Only).

---

_BRAIN.md Schema Reference v1 - MindrianOS Plugin, Phase 90-00._
