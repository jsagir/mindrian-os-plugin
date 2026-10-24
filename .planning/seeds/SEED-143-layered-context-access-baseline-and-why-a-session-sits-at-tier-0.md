---
id: SEED-143
title: "Layered Context Access: the baseline, and why a session sits at tier_0"
status: open
priority: medium
filed: 2026-10-22
planted_during: "Phase 379.1.1 plan 04"
origin: "work item 9 of 379.1.1-CONTEXT.md"
trigger_when: "the next phase that touches the navigation engine, BRAIN.md derivation or room_search routing, or when SEED-094 is promoted"
scope: medium
surfaces: [MindrianOS-Plugin]
related: [SEED-094]
promotes_to: "a probe on a real room, then a design note for SEED-094"
---

# SEED-143: Layered Context Access, baseline and the tier_0 cause

Full evidence: `.planning/phases/379.1.1-post-beta-73-close-out-critical-icm-eval-refresh-via-jev-int/379.1.1-LCA-BASELINE.md`. Probe: `probes/lca-tier-baseline.cjs` in the same phase folder.

## Term note

No source defines "Layered Context Access". The working definition is ASSUMED: the three-layer read of room context by the navigation engine (mode_a, mode_b, tier_0). The navigator confirms or corrects the term before promotion.

## The baseline

From the probe JSON (PROVEN, deterministic, read-only):

| Measure | Value |
|---------|-------|
| Fixture sections (alpha-room 4, gamma-room 1) | 5 |
| Sections with BRAIN.md | 0 |
| tier_0 share, brainAvailable true | 1 (5 of 5) |
| tier_0 share, brainAvailable false | 1 (5 of 5) |
| brain-client is_available | true |

The fixtures predate the FeyMinto faces. They show the legacy case. They are not a typical live room.

## Why a session sits at tier_0

- The Brain flag is nearly always true, so it is not the cause. isAvailable() returns true when a URL is set (PROVEN, lib/core/brain-client.cjs line 244). It does not test that the Brain answers.
- The tier comes from the one section the session reads. A null quadruple or a section with no BRAIN.md gives tier_0 under either Brain state (PROVEN, 14-row truth table).
- A fresh BRAIN.md with the Brain unreachable also gives tier_0. Only `brain_offline` gives mode_b (PROVEN, truth table).
- New rooms get a BRAIN.md at birth (PROVEN, code read). Legacy rooms and later sections can lack one.
- No automatic path writes a BRAIN.md for a room that has none and has no pending MINTO change. The auto-fire entry point `ensureSectionDerived` has no caller outside tests (PROVEN, grep). UNVERIFIED for a path that grep did not reach.
- Whether the navigator's own live session sits at tier_0, and why, is UNVERIFIED. It was not measured.
- Name collision: the 2026-08-09 handoff on removing "Tier 0" means the keyless install mode, a different layer with the same name. UNVERIFIED as intent (the handoff names neither resolveTierMode nor BRAIN.md).

## Relationship to SEED-094

SEED-094 asks for a query router. The router must know which context layer a session can read before it picks a traversal. A session at tier_0 has no Brain-derived layer. The router would fall back to substring search for every question. The two seeds share one read path: the quadruple read, then resolveTierMode. If SEED-094 is promoted first, it should read the tier from this baseline, not assume a layer.

## Proposed next step

1. Measure on one real room, with the owner's consent. Run the probe logic over that room read-only and report the tier of each section.
2. Find why BRAIN.md is not written for the sections that lack one.
3. Decide whether a room with no BRAIN.md should trigger a derive, and who calls `ensureSectionDerived` if so.

## Tri-polar

| Surface | Status |
|---------|--------|
| Claude Code CLI | Covered in part. The probe follows the CLI session path (scripts/intent-classifier.cjs). Live session not measured. |
| Claude Desktop | UNVERIFIED. The probe did not run the MCP path. |
| Cowork | UNVERIFIED. The probe did not run a shared room. |

## Canon

Part 8 holds. The probe sends nothing. It reads fixture rooms and calls pure functions.
