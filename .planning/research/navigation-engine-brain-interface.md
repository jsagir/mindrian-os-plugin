---
status: interface-stub
phase_owner: 90-09 (files this), consumed by Phase 91
created: 2026-04-19
purpose: Interface contract between Phase 90 (Brain Derivation Layer producing BRAIN.md) and Phase 91 (Navigation Engine consuming BRAIN.md signals)
---

# Navigation Engine ↔ Brain Derivation Interface

## Why this document exists

Phase 91 Navigation Engine reads BRAIN.md signals produced by Phase 90 Brain Derivation Layer. Without a stable interface contract, Phase 91 can't plan against Phase 90 outputs until Phase 90 ships -- creating serial dependency with no design parallelism.

This document defines the interface so Phase 91 can design against a stable contract while Phase 90 executes.

## Contract

Phase 91 reads Phase 90 output via `lib/core/folder-memory.cjs readQuadruple(sectionPath)`. Brain field shape:

```javascript
{
  brain: {
    exists: boolean,             // false if BRAIN.md absent; engine falls back to triple-only
    staleness: "fresh" | "stale" | "unavailable",
    stale_reason: string | null,
    brain_generated_at: ISO timestamp,
    brain_graph_version: integer,
    governing_thought_hash: string,  // engine checks this matches MINTO; mismatch = stale
    confidence_baseline: number (0-1),

    // Primary decision-input fields (what Phase 91 rules consume)
    problem_type: {
      classification: "Undefined" | "Ill-Defined" | "Well-Defined" | "Wicked",
      confidence: number (0-1),
      evidence_flags: string[]
    } | null,

    wicked_indicators: {
      present: string[],        // which of the 8 indicators
      recommended_escalation: string[]  // methodologies Brain suggests
    } | null,

    framework_predictions: [{
      next_framework: string,
      confidence: number,
      reasoning: string
    }] | null,  // ordered by confidence

    unfilled_opportunity_matches: [{
      opportunity_id: string,
      title: string,
      value_potential: "transformative" | "high" | "medium",
      match_score: number (0-1),
      rationale: string
    }] | null,

    cross_room_contradictions: [{
      target_room: string,
      target_section: string,
      contradiction_type: string,
      evidence: string,
      confidence: number
    }] | null,

    // Secondary fields (useful but not primary rule inputs)
    pattern_matches: [...],
    cross_domain_analogies: [...],
    assessment_chain_position: {...},
    hsi_signals: {...}
  } | null  // null if BRAIN.md absent
}
```

## Fallback behavior

Phase 91 engine decision rules MUST tolerate all of:
- `brain: null` (BRAIN.md absent; Brain offline during derivation)
- `brain.exists: false`
- `brain.staleness: "stale"` (use with reduced confidence)
- Any primary field = null (use triple-only signals for that rule class)
- `brain.governing_thought_hash != current MINTO hash` (BRAIN.md stale, enqueue regen, use with warning)

When Brain layer is absent, engine falls back to triple-only rules (ICM + SQL + Feynman-MINTO + intent/persona). This must not crash.

## Freshness expectations

| State | Engine behavior |
|---|---|
| fresh | Use Brain signals at full confidence |
| stale (governing_thought_changed) | Use signals at reduced confidence; enqueue re-derivation; flag in trace |
| stale (7-day timeout) | Same as above |
| unavailable (Brain offline) | Skip Brain signals; use triple-only; flag in trace |
| missing (no BRAIN.md) | Skip Brain signals; use triple-only; do NOT enqueue (may be offline) |

## Engine rule subset that depends on Brain (from Phase 91 rule table)

Rules that require non-null Brain signal:
- `IF brain_patterns.problem_type == "Wicked" ...` (wicked escalation)
- `IF brain_patterns.unfilled_opportunity matches ...` (opportunity-aware offers)
- `IF brain_patterns.framework_predictions ...` (FEEDS_INTO composition)
- `IF brain_patterns.cross_room_contradictions ...` (cross-room flags)

Rules that DO NOT require Brain (triple-only):
- reasoning_health_score suppression
- contradiction / convergence / gap detection (from SQL)
- persona detection (from USER.md + intent)
- dial position (mostly)
- escape hatch ("just tell me")

## Versioning

Phase 91 engine must handle `brain_graph_version` mismatches gracefully:
- `brain_graph_version` bumped significantly (major change in Brain schema) → treat BRAIN.md as stale, enqueue regen
- `brain_graph_version` matches or slightly newer → use as-is

## Who writes this file

- Phase 90 plan 90-09 fills in the exact data shapes once Brain queries are specified (see `.planning/research/brain-query-shapes.md`)
- Phase 91 planner reads this document to design engine rules
- Updates after Phase 90 ships: final version replaces stub
