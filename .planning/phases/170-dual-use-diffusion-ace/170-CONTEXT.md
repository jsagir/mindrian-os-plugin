---
kind: context
phase: 170
slug: dual-use-diffusion-ace
milestone: v1.14.0
created: 2026-06-22
canon_parts: [2, 3, 4, 6, 7, 8, 9]
spec_loaded: true
status: executed
severity: NORMAL
sequence: "additive to the v1.14.0-beta train (after 169); navigator-directed 2026-06-22. NOT a frozen-set move -> no canon-text amendment."
---

# Phase 170 Context: Dual-Use Diffusion + Adoption-Capacity Engine (ACE)

<domain>
Canonize Horowitz adoption-capacity theory (the Adoption-Capacity Engine, ACE v2) as a
first-class Brain methodology framework, and wire a dual-use diffusion TRIGGER so MindrianOS
surfaces it when the navigator works on any dual-use technology. ACE forecasts whether an
innovation diffuses, who adopts first, first-mover-advantage durability, and the adoption path
-- the timing-layer pivot between "what is the innovation" and "what is the market/validation".
</domain>

<what_shipped>

### 1. Brain canonization (remote graph -- generic methodology only, Part 8)
Written LIVE to the production Neo4j Brain via the my-neo4j MCP (idempotent MERGE):
- `Framework {name:'Adoption-Capacity Theory'}` (canonical_name "Adoption-Capacity Engine (ACE v2)",
  mos_command `/mos:analyze-timing`, methodology_tier implied pws, domain_scope dual-use general,
  trigger_lexicon + trigger_signal 'diffusion_detected').
- AUTHORED_BY Michael C. Horowitz; INTRODUCES from the 2010 book; PART_OF Innovation Diffusion.
- 5 variables (FI, OC + 3 OC sub-vector, Conceptual Capacity / Adamsky, Demonstration Point, S-Curve),
  4 canonical cases (carriers / nukes / dreadnought / suicide-terror), the 2x2 typology (4 quadrants),
  the 7-step pipeline (LEADS_TO chain), the 5-path actor response, 4 critiques, 4 extensions.
- Cross-links: COMPLEMENTS Hooked Model; EXTENDS Rogers / Technology Adoption Lifecycle.

### 2. Companion frameworks (same session)
- Hooked Model upgraded from a stub to full depth (4 TARI steps looped, Fogg B=MAP, 3 reward types,
  Manipulation Matrix).
- Self-Selling Loop minted as a MindrianOS-original framework (methodology_tier mindrian-operation):
  reliable-rails / variable-payload; INCORPORATES Hooked; RELATED_TO ACE.

### 3. Chaining (FEEDS_INTO)
- INTO ACE: S-Curve Analysis, Reverse Salient Analysis, PEST, Macro Trends, Sustaining vs Disruptive.
- ACE INTO: Scenario Planning, John Mullins Framework, PWS Triple Validation Compass, Ansoff Matrix,
  Now/New/Next, Self-Selling Loop. (ACE diagnoses the OC adoption barrier; SSL/Hooked dissolve it.)

### 4. The trigger (SENS-09 -- dual-use diffusion)
- `lib/core/sensors/sensor-diffusion-adoption.cjs`: fires on ANY of (a) explicit 'diffusion_detected'
  signal, (b) KEYWORD scan of the LOCAL turn text against a dual-use lexicon (defence, army, navy,
  dual-use, drone, autonomous, diffusion, first-mover, ...), (c) a fresh
  `<roomDir>/.mindrian/diffusion-scan-*.json` marker. Returns the FROZEN `brain_consult` reach
  (push_forward), dispatch `adoption-capacity`. Both keyword + marker modes per navigator 2026-06-22.
- Registered in `lib/core/insight-sensors.cjs` SENSOR_REGISTRY (now 10) + exports.
- Dispatch resolution: `data/dispatch-framework-map.json` adoption-capacity -> "Adoption-Capacity Theory";
  `data/framework-names.json` curated_extras += ACE + Self-Selling Loop; `commands/analyze-timing.md`
  frameworks += "Adoption-Capacity Theory"; `data/command-registry.json` regenerated (framework_index).
- Test: `tests/test-diffusion-adoption-sensor.cjs` (20 assertions, green).

</what_shipped>

<constitutional_check>
NOT a frozen-set move. No new reach_id (reuses brain_consult, 6-reach bank unchanged). No new
edge type. No new node type. So NO MINDRIAN-CANON.md amendment is required -- only phase registration
+ a CANON-PHASE-MAP row. Part 8 honored: the Brain holds generic methodology only; the sensor reads
LOCAL bytes to decide firing and egresses ONLY generic handles (dispatch + brain_framework_chain
companion) with a scalar/enum evidence bag.
</constitutional_check>

<verification>
- New sensor test: 20/20 PASS.
- Regression fences PASS: test-sensors-part8-sweep, test-sensors-routing-fence,
  test-sensor-spine-dispatch (6-reach frozen invariant intact), test-decide-sensor-fire,
  test-150-5-sensor-firability (the "exactly two side-channel fuels" contract untouched).
- dispatch-framework-map drift PASS (15 handles incl. adoption-capacity).
- command-registry rebuilt; ACE present in framework_index -> /mos:analyze-timing.
</verification>

<gsd_sequence>
Additive to the v1.14.0-beta train after Phase 169. Future v1.14.0-beta phases inherit ACE
automatically: it is in the Brain (queryable), in framework-names.json (allowlisted), in the
sensor spine (fires on dual-use turns), and in the FEEDS_INTO chain (offer_next_step). The Phase 166
gated-chain-executor will run ACE chains like any other framework.
</gsd_sequence>

<followups>
- ACE FEEDS_INTO weights are uniform v1 (0.8 upstream / 0.75 downstream); tune from real usage.
- Operational ACE (Innovation/Actor/Forecast instances + fit/adoption_probability compute) is
  ROOM-LOCAL, deferred -- the Brain holds only the generic theory (Part 8).
- Pinecone upsert of ACE/Hooked/SSL into pws-brain ns=tools for semantic retrieval: pending.
</followups>
