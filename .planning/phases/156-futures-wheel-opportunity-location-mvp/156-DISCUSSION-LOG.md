# Phase 156: Futures Wheel opportunity-location MVP - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-14
**Phase:** 156-futures-wheel-opportunity-location-mvp
**Areas discussed:** Command interaction shape, Approval granularity, Default view, Chaining-web surfacing, Research/SIGNAL step

---

## Command interaction shape

| Option | Description | Selected |
|--------|-------------|----------|
| Guided by ring | Generate ring 1 -> approve/prune -> expand approved -> repeat to depth cap | ✓ |
| One-shot then review | Run all rings, present whole wheel, bulk approve | |
| Hybrid: auto to ring 1, then guided | Auto ring 1, guided rings 2-3 | |

**User's choice:** Guided by ring
**Notes:** Bounds the explosion at each step; makes "and then what?" the literal loop; HITL natural per ring.

---

## Approval granularity (HITL friction)

| Option | Description | Selected |
|--------|-------------|----------|
| Per-ring batch | Approve/reject/prune a whole ring at one Decision Gate before expanding | ✓ |
| Per-consequence | Each node gated individually | |
| Whole-wheel once | Generate everything, one bulk approval | |

**User's choice:** Per-ring batch
**Notes:** Balances control vs friction; pairs with guided-by-ring; pruned nodes don't expand.

---

## Default view

| Option | Description | Selected |
|--------|-------------|----------|
| Subsystem (PESTEL) map first, ring on demand | Instructor's more-usable mode default | ✓ |
| Ring view first | Classic concentric wheel default | |
| Both side by side | Render both together | |

**User's choice:** Subsystem map first, ring on demand
**Notes:** First answer to this question was actually the research-step catch (below); re-asked and resolved to subsystem-map-first.

---

## Chaining-web surfacing

| Option | Description | Selected |
|--------|-------------|----------|
| Trigger-relevant only | Offer a handoff only when its trigger fires | |
| Top-N ranked (mirror the dial) | Surface the 2-3 most relevant handoffs, ranked | ✓ |
| Always offer all 8 | Full menu every run | |

**User's choice:** Top-N ranked (mirror the dial)
**Notes:** Consistent with the shipped 150.x capability dial (top-3-of-N); resolves through the Phase 122 command resolver.

---

## Research / SIGNAL step (navigator-surfaced gap -> FW-13)

| Option | Description | Selected |
|--------|-------------|----------|
| Per-ring, on-demand | Research pass over a ring's consequences | |
| At seed time only | Research the seed once up front | |
| Both: seed grounding + per-ring on-demand | Up-front grounding AND per-ring passes | ✓ |

**User's choice:** Both: seed grounding + per-ring on-demand
**Notes:** Navigator caught that the SCAN/research leg was under-scoped in the SPEC. Added as FW-13. Reuses research-corpus + research-cache (30-day) + Phase 131 + /mos:research. Bounded + cached + Part 8-safe; NOT always-on (that stays deferred).

---

## Claude's Discretion

- Advisory causal-cue lexicon internals
- Artifact-node registration mechanics into room.db (the HSI precondition)
- HSI invocation wiring + navigation.cjs write calls
- Subsystem-map render implementation
- Command script-vs-markdown orchestration shape
- Constraint: reuse existing helpers; no new dependency.

## Deferred Ideas

- Sub-rooms as N-th-order nodes (SEED-004 gate)
- Reflection / prediction-audit scheduled pass
- Always-on / autonomous horizon scanning (bounded on-demand FW-13 is the MVP slice)
- Multi-agent specialization
- DEEP integration of the 8 chained foresight tools (MVP = handoff hooks only)
