---
kind: context
phase: 184
slug: reader-decide-projection-offer
milestone: v1.15.0
created: 2026-06-28
canon_parts: [2, 3, 8, 9, 11]
cirs_relationship:
  surfaces_added: []
  surfaces_modified: []
  surfaces_removed: []
  spine_consumed:
    - data/brain-orchestration-projection.json
    - data/connector-registry.json
  gate_impact: "none -- READER adds no CIRS gate check; it is a LOCAL-only consumer of the orchestration projection (the control-plane read-model, CIRS R7) at decide/rank time. It mints no surface, no reach, no edge, no node, opens no Brain wire."
  explanation: "READER CONSUMES the spine: it reads the Part-8 orchestration projection (the CIRS R5 control-plane read-model, methodology_tier-tagged generic machinery metadata) LOCAL-only at decide() rank time (R7: no live Brain call on the hot path), RANKS the projected capabilities for the current navigator context, and SURFACES them as Shape F Decision-Gate OPTION CONTENT. It does NOT add, modify, or remove any invocable surface, and it does NOT fire one (READER-04: it calls neither runChain nor any act-command), so it is a pure read-model consumer of the invocation graph, not a new invocation path."
depends_on: [183]
status: built
priority: P0
class: CODE
---

# Phase 184 - READER: the decide-time projection OFFER

## Navigator-authority override (recorded honestly, no euphemism)

Phase 184 was DEFERRED in the v1.15.0 milestone as EVIDENCE-BLOCKED. The Phase 183
METER first reading came back `subject_class=unknown` / `transfer_uninstrumented`
(no live navigator has reached the decide() gate), and the canon's
evidence-before-steel discipline (Part 5; the entry-31 self-binding clause) reads
building READER now as "building ahead of evidence."

The navigator (Jonathan Sagir, 2026-06-28) OVERRODE that deferral and directed Phase
184 be built into the v1.15.0-beta.9 cut. This mirrors the Appendix D entry-20
navigator-authority-override pattern (Part 10 ratified on navigator authority despite
an unmet empirical gate). Recorded truthfully:

- The CODE ships fully and green on tests.
- The **R1 live grounded-vs-ungrounded A/B remains a NAMED DEBT.** It cannot return a
  real result until a live navigator reaches the gate. The harness is built so it CAN
  run the A/B the instant a subject exists; today it records `subject_class=unknown` /
  `live_ab.state=uninstrumented` / `result=null` honestly, never a fabricated live
  pass (the Phase 183 METER `transfer_uninstrumented` third-state idiom).
- READER's LOCAL hygiene prerequisite (R2) was ALREADY MET before this phase
  (data/brain-orchestration-projection.json: 249/249 methodology_tier-tagged, 0 dups).
  READER was evidence-blocked, not hygiene-blocked.

## What 184 builds

`decide()` at `lib/core/navigation-engine.cjs` gains a READ it lacked: a THIRD READER
(beside the BRAIN.md reader and the navigated-neighborhood reader) that:

- **READER-01** imports the LOCAL orchestration projection
  (`data/brain-orchestration-projection.json`, 249 nodes) as a LOCAL derived
  machinery cache (a local file read; Part 8). The connector registry
  (`data/connector-registry.json`, 90) is the sibling spine asset the projection is
  generated from.
- **READER-02** RANKS the projected capabilities for the current navigator context
  (deterministic: context-match bonus, then hierarchy_rank, then id tie-break).
- **READER-03** SURFACES the ranked capabilities as Shape F Decision-Gate OPTION
  CONTENT (`trace.projection_offer`).
- **READER-04** is a READER, never a FIRER. It calls NEITHER `runChain` NOR any
  act-command. Proved STRUCTURALLY (a require allow-list + firing-token sweep), not by
  promise.

## The four acceptance rules

- **R1** mandatory A/B: grounded (projection-ranked) vs ungrounded (Tier-0 minimal
  verbs), measuring choice-shift + latency. The LOCAL measurement runs today; the LIVE
  navigator reading is the named debt (above), structured to run when a subject exists.
- **R2** a projection-correctness gate that runs on the 249 nodes BEFORE the read
  (validate tier tags, no dupes, shape) and FAILS CLOSED on a malformed projection.
  Passes today (hygiene already met); built anyway as the guard.
- **R3** an ambient-turn latency + context-weight budget that FAILS THE BUILD if the
  read is too slow / too heavy (`READER_BUDGET_MS`, `READER_MAX_OPTIONS`, asserted).
- **R4** a STRUCTURAL guard that makes `decide()` INCAPABLE of firing a capability; a
  test fails if a firing path is ever introduced.

## HARD constraints honored

- Frozen Part 3 contracts UNCHANGED: MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate, the
  6-reach bank, the dial glyphs, the render contract. READER surfaces capability
  OPTIONS as decision-gate CONTENT; `READER_MAX_OPTIONS` is a CONTENT cap, NOT a
  render-contract constant.
- Part 8 LOCAL only: the projection is a LOCAL derived cache; zero live Brain
  read/write, zero network in decide(). methodology_tier is the boundary-keeper (the
  R2 gate rejects any untagged node).
- Part 9: READER writes no memory; any memory write stays the caller's job through the
  `lib/core/navigation.cjs` chokepoint.
- No em-dashes. decide() never throws on a malformed/missing projection (the R2 gate
  catches it; the read is skipped; decide() still returns).

## REQ
- READER-01: import the LOCAL orchestration projection + connector registry.
- READER-02: rank capabilities for the current navigator context (deterministic).
- READER-03: surface ranked capabilities as Shape F OPTION CONTENT.
- READER-04: READER is a reader, never a firer (structural guard).

## Acceptance evidence
- `bash tests/run-all-184.sh` GREEN (test-reader-184.cjs + test-reader-r4-structural-184.cjs).
- `bash tests/run-all-144.sh` STILL GREEN (decide() is load-bearing; no regression).
