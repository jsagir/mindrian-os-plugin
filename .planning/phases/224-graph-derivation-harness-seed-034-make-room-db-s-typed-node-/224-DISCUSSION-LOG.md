# Phase 224: Graph-derivation harness (SEED-034) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-07-15
**Phase:** 224-graph-derivation-harness-seed-034
**Areas discussed:** Edge-type mapping, Derivation wiring point, Backfill surface, Encoder-unavailable behavior

---

## Edge-type mapping

| Option | Description | Selected |
|--------|-------------|----------|
| CONVERGES + INFORMS only (Recommended) | High-semantic band -> CONVERGES; moderate band -> INFORMS (older informs newer). Stance-requiring types (CONTRADICTS/INVALIDATES/REFINES) excluded from score-only derivation, reserved for a future LLM-critiqued pass. Precision over recall. | Y |
| Add CONTRADICTS via heuristics | Also claim CONTRADICTS on high-similarity + negation-cue heuristics. Higher recall, false-positive risk on the noisiest alert-driving edge type. | |

**User's choice:** CONVERGES + INFORMS only
**Notes:** Grounding: similarity is symmetric - "X" and "not-X" artifacts look near-identical
topically, so CONTRADICTS cannot be honestly inferred from scoreMeasured() output alone. A false
CONTRADICTS drives the "you said X here and not-X there" navigator alert - the worst place for
noise.

---

## Derivation wiring point

| Option | Description | Selected |
|--------|-------------|----------|
| intelligence-cascade.cjs step (Recommended) | New derivation step in the shared cascade module after the existing graph-index step - CLI, MCP, Cowork identical (tri-polar). Debounced via minto-debouncer pattern, backgrounded per latency constraint. | Y |
| Standalone post-write step | Separate script wired only into the bash hook. CLI-only - MCP writes would silently skip derivation, violating tri-polar. | |

**User's choice:** intelligence-cascade.cjs step
**Notes:** The cascade module's own header documents this exact purpose ("keeps CLI hooks and MCP
tools using identical intelligence logic").

---

## Backfill surface

| Option | Description | Selected |
|--------|-------------|----------|
| /mos:graph --derive (Recommended) | Graph derivation is a graph operation - belongs on the graph command. No new connector tuple (flag on existing wired surface). | Y |
| Extend reanalyze | Reuses the "run intelligence over the room" verb, but reanalyze's shipped contract is meeting-scoped - backfilling ALL artifacts stretches it. | |

**User's choice:** /mos:graph --derive
**Notes:** SEED-034 named both candidates as viable; the SPEC deliberately left this to
discuss-phase.

---

## Encoder-unavailable behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Skip + disclose (Recommended) | Skip derivation entirely, write a structural test-pinned disclosure marker (SEED-059 convention, quick-260715-cu8 precedent). Soft-fail/advisory per Phase 210 caution. No lexical-only fallback. | Y |
| Degrade to lexical-only | Derive from lsa_similarity alone with low-confidence labels. Duplicates Phase 226's lower-confidence-path design problem; lexical signal cannot honestly distinguish edge types. | |

**User's choice:** Skip + disclose
**Notes:** The labeled lower-confidence path is Phase 226's design problem (its Grounding Guard
chicken-and-egg finding, verified this session) - this phase deliberately does not half-build it.

---

## Claude's Discretion

- Exact threshold values / band boundaries for the edge-type mapping layer (derive from fixture,
  not intuition)
- Disclosure marker field name/location (follow SEED-059 worked-example shape)
- Internal module naming and file placement for the threshold/classification layer
- Backfill O(n^2) batching strategy (chunking, progress reporting)

## Deferred Ideas

- Sub-room sweep / parent rollup (SEED-034 pipe #2) - fast-follow phase
- Non-.md (.docx/.html) readability (pipe #3) - fast-follow phase
- Stop/SessionEnd sweep as second trigger - only if per-write proves insufficient
- LLM-critiqued (fable-mode) derivation for stance-requiring edge types - natural next layer
- SEED-013 Python-elimination coordination - only if 228 is picked back up
