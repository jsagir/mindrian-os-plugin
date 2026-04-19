# Phase 90: Brain Derivation Layer -- Discussion Log

> Audit trail only. Not input to planning, research, or execution agents.

**Date:** 2026-04-19
**Phase:** 90-brain-derivation-layer

## Origin

Jonathan, 2026-04-19: "the brain need to be able to excevate and produce real layer on top. these must be a foundation for the brain to excell!"

This triggered the decision to turn the per-folder memory triple (Phase 88) into a quadruple with a Brain-authored layer on top (BRAIN.md per section).

## Decisions

### D-01: BRAIN.md as fourth per-folder file
The per-folder memory becomes a quadruple: ROOM.md + STATE.md + Feynman-MINTO.md + BRAIN.md. BRAIN.md is Brain-authored, not user-authored. Lives on disk. Git-trackable.

### D-02: governing_thought_hash for invalidation
BRAIN.md frontmatter carries a hash of the Feynman-MINTO governing_thought at derivation time. When governing_thought changes, hash mismatch triggers re-derivation automatically.

### D-03: Optional and offline-tolerant
BRAIN.md is OPTIONAL per section. Brain offline = BRAIN.md absent, not broken. System continues to function with triple-only read via Phase 88 folder-memory.cjs. readQuadruple returns brain:null.

### D-04: Scope respect
Cross-room Brain aggregation respects GUARDRAIL.md and `.rooms/registry.json`. Sealed rooms excluded. Cross-user learning out of scope for this phase.

### D-05: Brain-authored, distinct attribution
BRAIN.md is clearly attributed to Brain (not user, not Larry). Frontmatter `author: brain`, UI attribution in renders, visual treatment distinct from user-authored content.

### D-06: Phase sequencing
Phase 90 ships AFTER Phase 88 (foundation) and BEFORE Phase 91 (Navigation Engine consumes it). Phase 89 reverse-salient-engine unchanged.

### D-07: Version bump v1.10.14 (patch)
Feature addition, not breaking change. BRAIN.md is additive. Backward-compatible with Phase 88 folder-memory read contract.

### D-08: Interface contract for Phase 91
90-09 files `.planning/research/navigation-engine-brain-interface.md` so Phase 91 Navigation Engine can plan against stable interface. Prevents coupling between 90 and 91 implementation.

## Claude's Discretion
- Exact structure of BRAIN.md sections (schema defined; content heuristics left to derivation prompts)
- Cost budgeting for Brain queries per derivation (within brain-client rate limits)
- Rotation policy for decision-archive files (monthly default, reasonable)

## Deferred
- Cross-user Brain learning (v1.11+ or v2.x)
- Automatic LaTeX export of BRAIN.md
- BRAIN.md merge conflicts in Collaborative Mode (Phase 92)
