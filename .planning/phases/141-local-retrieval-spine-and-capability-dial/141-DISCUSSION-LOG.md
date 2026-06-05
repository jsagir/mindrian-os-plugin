# Phase 141: Local Retrieval Spine + Capability Dial - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-06-05
**Phase:** 141-local-retrieval-spine-and-capability-dial
**Areas discussed:** DRSCH depth, FILEVAL-02 timing, RETR-02 wiring, structural defaults

---

## DRSCH depth (how far the deep-research reach goes in 141)

| Option | Description | Selected |
|--------|-------------|----------|
| Doctrine-only | Commit dial text + reach ids + drift test; defer executable plumbing | ✓ |
| Doctrine + executable plumbing | Also wire runnable framework-led research path (plan builder, plan-gated fetch, evidence filing) | |

**User's choice:** Doctrine-only.
**Notes:** Keeps 141 consistent with the other 4 prompt-layer reaches. DRSCH-01..04 satisfied at doctrine level; execution defers.

---

## FILEVAL-02 timing (when the typed-evidence-filing path gets built)

| Option | Description | Selected |
|--------|-------------|----------|
| Defer with DRSCH execution | No fetched conclusions yet; build the filing path when DRSCH executes | |
| Build the filing path in 141 | Stand up typed-evidence node + provenance + read-back validation now | ✓ |

**User's choice:** Build the filing path in 141 (overrode the recommended defer).
**Notes:** Front-loads the FILEVAL substrate so deferred DRSCH execution + Phase 143 FILEVAL-01 plug in without rework. CONSTRAINT captured in CONTEXT (D-02a): must be built test-first against a fixture evidence node because 141 has no live producer; "unused-consumer" is expected, not a smell.

---

## RETR-02 wiring (how aggressive the hot-path change is in 141)

| Option | Description | Selected |
|--------|-------------|----------|
| Land function + flip hot path | Build getRoomContext AND flip the live per-turn seed (un-null userText, LOCAL only) | ✓ |
| Land function now, flip in 142 | Ship getRoomContext as a tested callable; flip the hot path in Phase 142 | |

**User's choice:** Land function + flip hot path in 141.
**Notes:** Closes the conversation-to-retrieval loop now, guarded by the RETR-04 1200ms benchmark. Fence (D-03a): un-nulled userText stays on the LOCAL seed lane, never reaches the Brain (Part 8).

---

## Structural defaults (module location, FTS5 gate, canon_parts, BUG-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Accept all defaults | room-context.cjs via navigation.cjs; graph-ranking-first/FTS5-gated; canon_parts [2,3,8,9]; BUG-01 one-token fix + test | ✓ |
| Revisit some defaults | Change module location, FTS5 gate, canon_parts, or BUG-01 handling | |

**User's choice:** Accept all defaults.
**Notes:** Captured as D-04a..d in CONTEXT.

---

## Claude's Discretion

- Leg B window size N + Leg C topK/maxDepth (tune via RETR-04 benchmark).
- Whether getRoomContext logs a context_assembled memory_event (+ possible EVENT_TYPES bump); if logged, Part 9 audit-node carve-out.
- Exact typed evidence-node shape + provenance fields for the FILEVAL helper.
- The fragment-to-focus-node seed resolver strategy.

## Deferred Ideas

- DRSCH executable plumbing (plan builder, plan-gated fetch, hat-scoped web, real-conclusion filing) - later phase.
- Desktop/Cowork dual-path fix (buildContext -> navigation.cjs) - CLI-honored for v1.13.1.
- Code dispatcher auto-firing reaches - stays prompt-layer doctrine.
- MEMDIAL memory-MD projection (render-from-graph, FEYNMAN pattern) - Phase 143.
- Local semantic/vector leg - Part-8-fenced, forbidden locally.
- Bi-temporal edges Stage-2 PK migration (SLICE-D) - separate concern.
