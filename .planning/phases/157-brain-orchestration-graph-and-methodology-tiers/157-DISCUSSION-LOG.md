# Phase 157: Brain orchestration graph - Discussion Log

> Audit trail only. Decisions are captured in 157-CONTEXT.md; this preserves the alternatives + the fan-out.

**Date:** 2026-06-15
**Phase:** 157-brain-orchestration-graph-and-methodology-tiers
**Areas discussed:** Skills/agents projection, CROSS_DOMAIN_ANALOGUE edge source, Canon amendment placement, Projection shape + --check failure taxonomy, PLUS a systems-thinking fan-out investigation

---

## Skills/agents projection (the connector-coverage gap)
| Option | Selected |
|--------|----------|
| Name-only mindrian-operation nodes, exempt from reach-wiring | ✓ |
| Add lightweight connector frontmatter to all 13 skills first | |
| Skip skills entirely | |
**Note:** skills carry NO connector frontmatter (0/13); agents 7/9. Skills are behavior-as-context, not reach-dispatched -> name-only nodes, exempt from BOG-06 wiring gate.

## CROSS_DOMAIN_ANALOGUE edge source
| Option | Selected |
|--------|----------|
| Hand-authored data/cross-domain-analogues.json seed list | ✓ |
| Carry from connector frontmatter | |
| Derive (HSI/embedding) | |
**Note:** mirrors command-registry curated_chains idiom; seeded with the 150.10 pairs; --check'd.

## Canon amendment placement (BOG-01)
| Option | Selected |
|--------|----------|
| Part 8 extension + Appendix D entry + version bump | ✓ |
| New Canon Part | |
**Note:** matches the established amendment idiom (entries 14/15/18); Part 8 is where the boundary lives. Navigator-gated, lands FIRST before generator code.

## Projection shape + --check failure taxonomy
| Option | Selected |
|--------|----------|
| One file + 3 named failure modes (STALE/UN-WIRED/UN-RANKED) | ✓ |
| Per-tier files | |
| One file + single STALE failure | |

## Systems-thinking fan-out (navigator-directed, filed as 157-RESEARCH.md)
5 parallel Explore investigators (M1 boundary / M2 feedback loops / M4 leverage points / reverse-salient / HITL-UX+157-fit) + 1 synthesizer (workflow wf_47620b9a-763). Key findings folded into CONTEXT D-05:
- THE REVERSE SALIENT = the hardcoded ensemble weights (f-selector-ranker.cjs:287-290) + static sensor order; "most-unfrozen parameter, most-frozen in practice."
- THE MISSING LOOP = REJECTED edges file but nothing reads them back (canon Decision 13 violated in spirit).
- Phase 157 CONFIRMED for BOG-06 (wiring) + BOG-07 (legibility, elevated to load-bearing); the #1 leverage fix (rejection->weight loop) is LOCAL-only, OUT of 157, handed to a SEED-009-minimal follow-on.

## Claude's Discretion
- Projection JSON schema, generator internals, walk traversal, OPERATES derivation, --check messages, cache-contract doc.

## Deferred Ideas
- Live Brain write, continuous sync (Phase 137), nav-engine consumption, supersede-122, per-capability grain, skill connector-frontmatter migration, AND the rejection->weight learning loop (LOCAL follow-on, SEED-009 minimal form).
