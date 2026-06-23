---
name: trending-to-absurd
description: >
  The Visionary Innovation Companion. Activates when the navigator wants to push trends to their
  absurd extreme to surface disruptive innovation opportunities. Seeds itself from the room's
  connective taxonomy (graph-native, not user-typed strings), extrapolates each selected trend
  across the 3-10 / 11-30 / 50yr horizons, files only under opportunity-bank/, and surfaces two
  Shape F Decision Gates at the judgment points (trend selection, opportunity pick).
canon_parts: [Part 2, Part 3, Part 4, Part 7, Part 8, Part 9, Part 10]
phase: 163
command: /mos:trending-to-absurd
orchestrator: lib/core/trending-to-absurd/orchestrator.cjs
chains_to: /mos:futures            # at the Stage 5-6 boundary, via the Phase 122 command-resolver
extends: /mos:explore-trends       # the 6-stage absurd-trend reference (zero change to it)
seed_reader: lib/core/navigation/get-domains-for-trends.cjs::getDomainsForTrendExtrapolation
reach_id: context_block            # one of the frozen 6 - NEVER a 7th
framework: "S-Curve Analysis"      # the generic Brain handle (Part 8); equals the command frameworks:
filing: fileEvidenceWithReadback
allowed-tools: [Read, Write, Bash, Glob]
# --- Phase 143.3 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: context_block
  sub_mode: trending-to-absurd
  framework: "S-Curve Analysis"
  posture: push_forward
  hierarchy_rank: 11
  filing: fileEvidenceWithReadback
  plan_gated: false
  web_scope: null
  surface: F.1
---

# Trending-to-the-Absurd -- The Visionary Innovation Companion

This skill is the WAVE 4 SURFACE of Phase 163. It is roughly 80-85% reuse (Canon Part 7): the
5-act harness is CLONED from `lib/core/futures/orchestrator.cjs` and EXTENDED, never rewritten. It
builds no new engine -- it re-exports the futures harness functions verbatim and adds the
graph-native seed, the absurd-horizon stamping, the exclusive-ownership filing wrapper, and the
trend-selection Shape F gate.

## When this activates

- The navigator wants to push trends to their absurd extreme to surface disruptive opportunities.
- A trend sensor (SENS-04) fires in a room that has domain taxonomy to seed from.
- The navigator asks "what is the absurd extreme of this trend?" or "what disruptive opportunity is hiding past the edge?"

## How it works (the 5 acts)

1. **Seed from the graph (autonomous_safe).** `seedFromDomains` reads the connective taxonomy via
   `getDomainsForTrendExtrapolation` (Tier 2 graph walk; Tier 0 cold-start fallback). The agent is
   graph-native from its first run (D-163-04) -- seeds come from the local graph, not typed strings.
2. **Trend-selection gate (HITL judgment point 1).** `surfaceTrendSelectionGate` renders a Shape
   F.1 tri-context Decision Gate; the navigator picks which trends to push (D-163-05 hybrid).
3. **Extrapolate to the absurd (autonomous_safe).** `generateAbsurdRings` maps the three spec
   horizons (3-10 / 11-30 / 50yr) onto the frozen HORIZON_ENUM and clamps to the reused caps.
4. **File + cascade (autonomous_safe).** `registerTrendArtifacts` files ONLY under
   `opportunity-bank/trending-to-absurd-<seed>/` (exclusive ownership); `writeCascadeEdges` routes
   ROOT_CAUSES links through the `navigation.writeEdge` chokepoint.
5. **Opportunity-pick gate + handoffs (HITL judgment point 2).** `confirmRingDecisions` promotes
   APPROVE through `navigation.confirmNode` (human byUser); `surfaceChainingHandoffs` CHAINS to
   `/mos:futures` and the foresight web via the Phase 122 resolver.

## Chain and extend posture (Part 7)

- **CHAINS to `/mos:futures`** at the Stage 5-6 boundary. The far-horizon (50yr) extreme can open
  AS a Futures Wheel; every handoff resolves through the command-resolver, never a hardcoded string.
- **EXTENDS `/mos:explore-trends`** -- it references `references/methodology/explore-trends.md` as
  the absurd-trend reference with ZERO change to that methodology (EXTEND posture, not replace).

## Canon boundaries

- **Part 8 (Graph Boundary):** zero Brain egress. The only external leg is the inherited
  `runSignalResearch` generic-handle path (a domain keyword only). The connector `framework` is a
  generic S-Curve Analysis handle.
- **Part 9 (Memory Locality):** every write routes through `navigation.writeEdge` / `confirmNode`.
  A consequence is `proposed` until a human APPROVE at the opportunity-pick gate promotes it.
- **UI (skills/ui-system):** the two gates render as Shape F selectors only -- the 12 glyphs, no
  emoji, no em-dashes.
