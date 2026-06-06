---
phase: 143
phase_name: Insight Sensors (the 7-row trigger map)
gathered: 2026-06-06
status: Ready for planning
source: Synthesized from the 00c-TRIGGER-MAP executable spec + SEED-008 trigger list + live shipped-state grounding. No Q&A discuss round (navigator reviewed the research, chose synthesize-from-research).
canon_parts: [Part 2, Part 2 Engine 1, Part 3, Part 4, Part 8]
requirements: [SENS-01, SENS-02, SENS-03, SENS-04, SENS-05, SENS-06, SENS-07]
---

# Phase 143: Insight Sensors (the 7-row trigger map) - Context

**Gathered:** 2026-06-06
**Source:** Distilled from `docs/UI-UX-CONVERGENCE-2026-05-10/00c-TRIGGER-MAP.md` (the rigorous executable sensor spec), the SEED-008 trigger list, and a live shipped-state grounding pass (2026-06-06). This phase was split from the original Phase 143 on 2026-06-06; the dial-TUI (DIALTUI/MEMDIAL/FILEVAL-01) moved to Phase 143.1. Phase 143 is the SENS-01..07 detection layer ONLY.

<domain>
## Phase Boundary

Phase 143 builds the 7 event-driven INSIGHT SENSORS - the detection layer that decides WHEN to reach and WHICH reach to fire, on a conversational/state signal. The sensors are hat-scoped per Canon Part 2 and Part-8-constrained on any Brain/web path (generic handles only).

**IN SCOPE:** SENS-01..07 - the sensor detection functions + wiring each sensor to its (mostly shipped) underlying command/engine. The meta-classifier `/mos:diagnose` ({problem_type, complexity, stage}) is the input the sensors read.

**OUT OF SCOPE (hard fences - later phases):**
- The `routing_source: legacy -> engine` FLIP -> Phase 144 (NAV-01). Phase 143 builds the sensors and may surface candidate reaches, but MUST NOT flip `trace.routing_source` to `engine` and MUST NOT rewrite `decide()`'s file-presence routing into graph routing - that single change is Phase 144's whole job. Same fence discipline as Phase 142's CASC-02.
- The dial-TUI render surface that displays the reaches the sensors surface -> Phase 143.1 (DIALTUI-01..11). 143 produces the reach signal; 143.1 renders it.
- Scheduled sensors (the `/mos:scout` suite, whitespace/reverse-salient/opportunity/competitor cadence) -> Phase 145. Phase 143 is EVENT-DRIVEN sensors only.
- The deep-research escalation sensor (00c Section 3a) is DESIRABLE but explicitly NOT gate-blocking per 00c Section 9 item 2 - it can land post-gate. Treat as deferred unless a plan proves it is cheap to fold in.
</domain>

<critical_finding>
## Shipped-vs-gap classification (ground the planner - do NOT re-plan shipped sensors)

A live grounding pass (2026-06-06) found 3 of 7 sensors stand on already-shipped engines. Classify each requirement as VERIFY (shipped underlying capability; build the thin sensor + a loop-fires test), PARTIAL (some shipped, some gap), or BUILD (net-new detection). The shared net-new spine is a sensor module - there is NO dedicated sensor/trigger module today; `decide()`'s `fire_skill` is Brain-signal-based, not the 7-row map.

| Req | Sensor | Underlying capability (live 2026-06-06) | Classification |
|-----|--------|------------------------------------------|----------------|
| **SENS-01** | first-material -> explore-domains + whitespace + brain_framework_chain($problem_type) | Phase 117 auto-explore-domains SHIPPED (status passed; `scripts/auto-explore-fire.cjs` + hooks wiring). | **PARTIAL** - verify the first-material -> explore-domains path fires; ADD the whitespace + brain_framework_chain($problem_type) companions if not already firing. Part-8: brain_framework_chain carries only $problem_type enum. |
| **SENS-02** | lagging-component ("the bottleneck is...") -> find-bottlenecks / reverse-salient | The reverse-salient engine SHIPPED (Phase 89: rs-engine.py + `/mos:find-bottlenecks`). | **BUILD (thin)** - the sensor (conversation-pattern detection of the lagging-component shape) is net-new; it dispatches the shipped rs engine. |
| **SENS-03** | methodology-decision-point -> brain_framework_chain (CHAINS_TO next framework) | The `brain_framework_chain` / `brain_find_patterns` query patterns EXIST in `references/brain/query-patterns.md` but are NEVER auto-invoked. | **BUILD** - net-new sensor that detects a methodology-decision moment and auto-invokes the existing query pattern. Part-8: generic framework handles only. |
| **SENS-04** | external-fact reference -> WebSearch, hat-scoped (White=data/arxiv, Green=patents, Black=failure-cases) | `/mos:research` + WebSearch exist; hat-scoping rule is in Canon Part 2; the MCP-stack-ask rule applies (no silent WebSearch). | **BUILD** - net-new sensor + the hat-scoping dispatch table. Part-8 + the MCP-stack rule (surface a Decision Gate "Tavily/Firecrawl/Exa?" unless pre-configured per hat). This is in the cheap-first gate subset. |
| **SENS-05** | JTBD set/changed -> re-weight selector menus + Brain queries via ADDRESSES_PROBLEM_TYPE | The JTBD signal is CAPTURED (Phase 104, v1.12.3) but NOT consumed for re-weighting. | **PARTIAL** - the signal exists; build the consumer that re-weights on a JTBD set/change event. |
| **SENS-06** | artifact-filed -> cross-relationship cascade scan surface (realizes CASC-01 as a sensor) | CASC-01 SHIPPED in Phase 142 (post-write side-channel + room-proactive surfacing). | **VERIFY** - SENS-06 IS CASC-01 expressed as a sensor. Lock with a loop-fires test that the artifact-filed signal triggers the shipped cascade surface; do NOT re-implement the Phase 95/142 cascade. |
| **SENS-07** | gate/milestone approach -> breakthrough scan (Category G) + investor-objection surface | Phase 120 breakthrough-scan-category-g SHIPPED (status passed). The investor objection agent exists (agents/investor). | **PARTIAL** - the breakthrough scan + objection surface exist; build the gate-approach DETECTION sensor that auto-fires them. |

**Net effect:** the genuine net-new is (a) ONE sensor module (the 7-signal classifier + dispatch, keyed off the `/mos:diagnose` {problem_type, complexity, stage} tuple and the conversation-pattern signals) and (b) the 4 BUILD/PARTIAL detection paths (SENS-02/03/04/05) + SENS-07 detection. SENS-01 and SENS-06 are verify/thin over shipped code. Plan acceptance tests that PROVE each sensor FIRES (loop-fires discipline, seeding Phase 146), not that code exists.
</critical_finding>

<decisions>
## Implementation Decisions (LOCKED from research + grounding)

### The sensor module (the net-new spine)
- Build ONE sensor module (e.g. `lib/core/insight-sensors.cjs`) exposing pure, sync, LOCAL-first sensor functions: each takes the turn signal + the `/mos:diagnose` tuple + local graph/STATE context and returns a candidate reach (the command/engine to fire) or null. The module is the 7-row trigger map as code.
- `/mos:diagnose` is the META-SENSOR the others consume - its {problem_type, complexity, stage} tuple is the classification input. Reuse the shipped diagnose classifier; do not rebuild it.
- The sensors PRODUCE candidate reaches. They do NOT themselves flip routing_source or rewrite decide()'s routing (Phase 144 fence). If a sensor surfaces a reach, it surfaces via the existing Decision Gate / additionalContext path, not by mutating the legacy routing trace.

### Per-sensor (reuse-first, Canon Part 7)
- SENS-01: reuse Phase 117 auto-explore-fire; add the whitespace + brain_framework_chain companions only if they do not already fire.
- SENS-02: reuse the Phase 89 rs-engine + `/mos:find-bottlenecks`; build only the lagging-component conversation-pattern detector.
- SENS-03: reuse the `brain_framework_chain` pattern in `references/brain/query-patterns.md`; build the methodology-decision detector + auto-invoke.
- SENS-04: reuse `/mos:research`/WebSearch; build the external-fact detector + the hat-scoping table (White=data/arxiv, Green=patents+arxiv+deep-research, Black=failure-cases) + honor the MCP-stack-ask rule.
- SENS-05: reuse the Phase 104 JTBD signal; build the re-weighting consumer.
- SENS-06: reuse the Phase 142/95 cascade entirely; SENS-06 is a loop-fires lock, not a build.
- SENS-07: reuse the Phase 120 breakthrough scan + the investor objection agent; build the gate-approach detector.

### Canon Part 8 fence (HARD)
- SENS-01/SENS-03/SENS-04 are the Brain/web-touching sensors. They MUST carry only generic handles (framework names, problem-type enums, phase ids) to Brain/web - never artifact bodies, meeting content, or user identifiers. A Part-8 grep sweep (the Phase 90 5-tripwire pattern) over the sensor module is a plan gate. SENS-04 web queries are public SIGNAL (SIGNAL -> LOCAL: YES; SIGNAL -> Brain: NO).

### Phase 144 fence (HARD)
- No plan in 143 may set `trace.routing_source = 'engine'` or replace decide()'s file-presence routing. Assert via grep that no new routing_source='engine' assignment is added. The sensors are consumed BY 144's flip, they do not perform it.

### Verification posture (loop-fires)
- Every sensor gets an executable acceptance test asserting the sensor FIRES on its signal (not merely that code exists). Mirror tests/run-all-142.sh as tests/run-all-143.sh so Phase 146 can compose them.
- The cheap-first gate subset (00c Section 9 item 2): SENS-01 (first material) + SENS-04 (WebSearch hat-scoped) are the gate-relevant sensors; SENS-06 ties to the already-gated cascade. Prioritize these for the Phase 146 acceptance posture.
</decisions>

<canonical_refs>
## Canonical References (downstream agents MUST read before planning/implementing)

### Phase-143 sensor spec (do NOT re-discover)
- `docs/UI-UX-CONVERGENCE-2026-05-10/00c-TRIGGER-MAP.md` - PRIMARY: the executable sensor spec (signal taxonomy, the by-stage trigger table, the event-driven sensor table Section 3, the deep-research escalation Section 3a, the closed-loop cycle Section 8, the v1.13.0 scope Section 9).
- `.planning/seeds/SEED-008-intelligence-layer-activation-gap-close-the-loop.md` - the trigger list + the Acceptance Contract.
- `.planning/research/v1.13.1-larryreach-fanout/SLICE-PHASE-MAP.md` - the Phase 143 evidence row.
- `.planning/research/v1.13.1-larryreach-fanout/raw-slices/SLICE-G.md` (the dial doctrine the sensors surface) and `raw-slices/SLICE-C.md` (the Brain query path, Part-8 fenced).

### Shipped substrate to reuse (Part 7)
- `scripts/auto-explore-fire.cjs` + Phase 117 (SENS-01 first-material auto-explore - shipped).
- `scripts/rs-engine.py` + `commands/find-bottlenecks.md` + Phase 89 (SENS-02 reverse-salient - shipped).
- `references/brain/query-patterns.md` (SENS-03 brain_framework_chain pattern - exists, never auto-invoked).
- `commands/research.md` + the WebSearch path (SENS-04) + Canon Part 2 hat-scoping.
- Phase 104 JTBD signal capture (SENS-05).
- `scripts/post-write` + `skills/room-proactive/SKILL.md` (SENS-06 = the shipped CASC-01 cascade).
- Phase 120 breakthrough-scan-category-g + `agents/investor` (SENS-07).
- `commands/diagnose.md` + `scripts/diagnostics-command.cjs` (the /mos:diagnose meta-classifier).
- `lib/core/navigation-engine.cjs` (decide() - the consumer the sensors feed; the Phase 144 fence target - do NOT flip routing_source).

### Canon + test pattern
- `docs/MINDRIAN-CANON.md` Part 2 (hat-scoped web affordances), Part 2 Engine 1 (Act-1 reaches), Part 3 (Decision Gate surfacing), Part 4 (sensor findings -> graph edges), Part 8 (generic handles only).
- `tests/run-all-142.sh` - the aggregator pattern to mirror as `tests/run-all-143.sh`.
</canonical_refs>

<specifics>
## Specific Ideas
- The highest-value, gate-relevant sensors are SENS-01 (mostly shipped - verify + companions) and SENS-04 (net-new, hat-scoped web). SENS-06 is a loop-fires lock over the 142 cascade.
- Keep the sensor module pure/sync/LOCAL-first; Brain/web egress only through the Part-8-audited handles on SENS-01/03/04.
- These acceptance tests are building blocks for the Phase 146 loop-fires gate - name/structure them so 146 composes them.
- The deep-research escalation sensor (00c 3a) is the strictest gate on the map and is NOT gate-blocking - default to deferring it unless a plan shows it is a cheap fold-in over the shipped /mos:research.
</specifics>

<deferred>
## Deferred Ideas
- The routing_source legacy->engine flip -> Phase 144 (NAV-01).
- The dial-TUI render surface (DIALTUI-01..11 + MEMDIAL + FILEVAL-01) -> Phase 143.1.
- Scheduled sensors (scout suite, whitespace/rs/opportunity/competitor cadence) -> Phase 145.
- The deep-research escalation sensor (00c 3a) -> post-gate unless cheap to fold in.
</deferred>

---

*Phase: 143-insight-sensors-the-7-row-trigger-map*
*Context synthesized 2026-06-06 from the 00c trigger map + SEED-008 + live shipped-state grounding*
