---
phase: 156-futures-wheel-opportunity-location-mvp
plan: 03
subsystem: futures-wheel
tags: [futures-wheel, subsystem-render, decision-gate, confirm-node, opportunity-banking, provenance, FW-07, FW-08, FW-09, FW-10]
requires:
  - "lib/core/futures/orchestrator.cjs Wave 1+2 (caps, enums, generateRing, writeCascadeEdges, runHsiScan)"
  - "lib/render/render-v2.cjs render (ui-system De Stijl 4-zone formatter)"
  - "lib/core/navigation.cjs confirmNode + resolveByUser + writeEdge (Part 9 chokepoint + Part 4 typed edges)"
  - "lib/core/opportunity-ops.cjs bankOpportunity (dedup by problem_hash)"
  - "lib/core/room-db.cjs openRoomDb (Phase-109 provenance schema with review_status)"
provides:
  - "lib/core/futures/subsystem-render.cjs: renderSubsystemMap (D-03 default PESTEL map), renderRingView (on demand)"
  - "lib/core/futures/orchestrator.cjs: surfaceBridgesAtGate, confirmRingDecisions, bankCandidateWithProvenance, RING_GATE_VERBS, PROVENANCE_EDGE_TYPES"
  - "lib/core/opportunity-ops.cjs: additive provenance frontmatter pass-through in bankOpportunity"
  - "tests/test-futures-render.cjs, tests/test-futures-confirm.cjs, tests/test-futures-bank.cjs"
affects:
  - "The /mos:futures command surface consumes the gate + render + bank functions for the guided-by-ring loop"
tech-stack:
  added: []
  patterns:
    - "subsystem + ring renders compose through the SHARED ui-system render-v2 4-zone formatter; zero hand-rolled HTML (Dashboard Export Integrity)"
    - "proposed->confirmed routes ONLY through navigation.confirmNode (truth-claim CausalClaim nodes); resolveByUser coerces any agent USER.md identity to the navigator default"
    - "REJECT/DEFER capture as REJECTED_BECAUSE/DEFERRED typed edges with scalar reason-codes only (Part 4 + Part 8)"
    - "provenance is an additive frontmatter field on bankOpportunity, emitted only when supplied so existing callers stay byte-identical"
key-files:
  created:
    - lib/core/futures/subsystem-render.cjs
    - tests/test-futures-render.cjs
    - tests/test-futures-confirm.cjs
    - tests/test-futures-bank.cjs
  modified:
    - lib/core/futures/orchestrator.cjs
    - lib/core/opportunity-ops.cjs
decisions:
  - "Consequence gate nodes are truth-claim type (CausalClaim) so the Part 9 agent-attribution guard fires on confirm; the Wave-2 Artifact registration stays the HSI surface, the confirm surface is the truth-claim"
  - "bankOpportunity gained an ADDITIVE provenance pass-through because the shipped engine did NOT pass arbitrary frontmatter through (RESEARCH s5 assumption corrected, Rule 1 deviation mirroring the Wave-2 ENABLES finding)"
  - "surfaceBridgesAtGate returns a structured gate descriptor; the AskUserQuestion render is the command/Larry HITL layer (nested AskUserQuestion does not work in an executor)"
metrics:
  duration: "~30 min"
  completed: "2026-06-14"
  tasks: 3
  files: 6
---

# Phase 156 Plan 03: Subsystem render + Decision Gate + opportunity banking Summary

Wave 3 EXTENDED the Wave-1/2 orchestrator (it did NOT rewrite it) with the per-ring tri-context Decision Gate, the proposed->confirmed promotion via the `confirmNode` chokepoint, and the opportunity-banking-with-edge-provenance wiring; and added the net-new `subsystem-render.cjs` that renders the consequence graph as the PESTEL subsystem impact map (the D-03 default) plus the on-demand concentric ring view, both composed through the shared ui-system De Stijl 4-zone renderer with zero hand-rolled HTML. This is the HITL wave: the per-ring gate surfaces the invisible cross-domain ripples a human cannot see, and the navigator (never an agent) confirms truth.

## What shipped (per requirement)

- **FW-07** -- `subsystem-render.cjs` exports `renderSubsystemMap(consequences)` (the D-03 DEFAULT view) grouping consequences by their PESTEL `domain` into one block per present domain, and `renderRingView(consequences)` (on demand) grouping by ring 1|2|3. Both compose through `lib/render/render-v2.cjs::render` (the SAME De Stijl 4-zone formatter every /mos: command uses; Canon Part 7 reuse). The output is text (Tri-Polar CLI/Desktop/Cowork), NOT web-only; the grep gate finds zero `<html>`/`<div>` literals. The footer offers both views (subsystem map default, ring view on demand).
- **FW-10** -- `surfaceBridgesAtGate(roomDir, bridges, ringConsequences, opts)` assembles the per-ring batch tri-context Decision Gate (D-02): the ring's proposed consequences + the top-N cross-domain HSI bridges whose endpoints span two different PESTEL domains AND that are NOT a direct ROOT_CAUSES ring parent->child link (the do-what-a-human-cannot ripple). The gate uses the Shape F.1 selector with the closed `APPROVE / REJECT / DEFER` verb set; the BRAIN panel carries only the generic `Futures Wheel` methodology handle (Part 8). `confirmRingDecisions(db, roomDir, decisions)` promotes each APPROVE proposed->confirmed via `navigation.confirmNode` resolving the navigator identity through `navigation.resolveByUser` (a poisoned `larry` USER.md is coerced to the `navigator` default -- never an agent-confirmed truth-claim, Part 9 role 5); each REJECT writes a `REJECTED_BECAUSE` edge carrying a scalar reason-code; each DEFER writes a `DEFERRED` edge (Part 4; no body text on edges, Part 8).
- **FW-08 / FW-09** -- `bankCandidateWithProvenance(roomDir, candidate)` builds the opportunity object (problem required, confidence, evidence) plus an ADDITIVE `provenance` field naming the source edge it traces to, then calls `opportunity-ops.bankOpportunity`. The shipped engine now passes the provenance scalar through to the banked frontmatter (additive; emitted only when supplied). A candidate with no traceable source edge -- or one naming an edge type outside {HSI_CONNECTION, REVERSE_SALIENT, ROOT_CAUSES} -- is REFUSED (nothing banked; threat T-156-01 mitigated). Dedup by `problem_hash` + confidence-update are preserved.

## Tasks and commits

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | PESTEL subsystem impact map render (default) + ring view (FW-07) | 48cb88cb | lib/core/futures/subsystem-render.cjs, tests/test-futures-render.cjs |
| 2 | Per-ring Decision Gate -- bridge surfacing + proposed->confirmed + REJECT reason edge (FW-10) | 941b4642 | lib/core/futures/orchestrator.cjs, tests/test-futures-confirm.cjs |
| 3 | Opportunity banking with edge provenance (FW-08/FW-09) | a72f4dce | lib/core/opportunity-ops.cjs, tests/test-futures-bank.cjs |

Note: `bankCandidateWithProvenance` was authored in the orchestrator.cjs write during Task 2 (single-file surface) and exercised end-to-end by the Task 3 bank test + the Task 3 opportunity-ops additive change.

## Verification

- `node tests/test-futures-render.cjs` -- PASS (FW-07: 4-domain PESTEL grouping default; ring 1|2|3 grouping on demand; ui-system render reuse; no hand-rolled HTML; footer offers both views)
- `node tests/test-futures-confirm.cjs` -- PASS (FW-10: fresh consequence proposed; APPROVE->confirmed with human byUser=jonathan and NOT an agent; poisoned larry USER.md coerced to navigator; REJECT->REJECTED_BECAUSE scalar reason edge; DEFER->DEFERRED; cross-domain non-ring bridge surfaced; source-grep: confirmNode used, no promoteNodeStatus, no raw UPDATE review_status)
- `node tests/test-futures-bank.cjs` -- PASS (FW-08/09: banked .md has provenance frontmatter naming the source edge; dedup + confidence-update; un-traceable refused; non-provenance edge type refused; missing problem refused; bankOpportunity used)
- Regression: all 5 prior-wave futures tests green (generator/edges/frontmatter/causal-cue/hsi-integration); opportunity-extractor.test.cjs 12/12 (additive provenance is byte-compatible)
- SOURCE gates on orchestrator.cjs: `confirmNode(` = 2, `INSERT INTO edges` = 0, `promoteNodeStatus(` = 0
- Em-dash sweep across the 6 wave-3 files: the only hit is a PRE-EXISTING comment at opportunity-ops.cjs:765 (NOT on any line I added; logged as DI-156-03-01); my added lines are em-dash clean

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] bankOpportunity did NOT pass arbitrary frontmatter through**
- **Found during:** Task 3 (bank test first run)
- **Issue:** 156-RESEARCH section 5 and the plan key_link both stated "bankOpportunity passes the provenance frontmatter through." The shipped `bankOpportunity` builds frontmatter from a FIXED field list (problem / mirror_solution / domain / evidence / source_framework / knight_position / confidence / created / status / problem_hash); an unknown `provenance` field was silently dropped. This mirrors the Wave-2 ENABLES discovery (a RESEARCH assumption that did not match shipped code).
- **Fix:** Added an ADDITIVE provenance pass-through to `bankOpportunity`: `if (opportunity.provenance) fmLines.push('provenance: "..."')`. Emitted ONLY when the caller supplies it, so every existing caller's output is byte-identical (proven by opportunity-extractor.test.cjs 12/12 staying green). No dedup/confidence behavior changed.
- **Files modified:** lib/core/opportunity-ops.cjs
- **Commit:** a72f4dce

**2. [Rule 3 - Blocking] confirm test needed the Phase-109 provenance schema, not the lazygraph schema**
- **Found during:** Task 2 (confirm test first run -- `no such column: review_status`)
- **Issue:** `lazygraph.openGraph` initializes the bare nodes/edges schema WITHOUT the Phase-109 `review_status` / `confirmed_by` provenance columns that `confirmNode` operates on. The Wave-2 edges/HSI tests use `openGraph` (they only need nodes+edges), but the confirm path needs the migrated schema.
- **Fix:** The confirm test opens room.db via `lib/core/room-db.cjs::openRoomDb` (which runs `runPhase109NodesProvenance`), exactly as the canonical Phase-129.5 confirm-node test does. No source change.
- **Files modified:** tests/test-futures-confirm.cjs
- **Commit:** 941b4642

### Design decision (not a deviation): consequence gate nodes are CausalClaim, not Artifact

The Wave-2 `registerConsequenceArtifacts` registers each consequence as a type=`Artifact` node (the HSI surface). `confirmNode`'s Part 9 agent-attribution guard fires ONLY for truth-claim node types {claim, CausalClaim, assumption, decision, opportunity}. To make FW-10's "REJECT an agent-attributed confirm" requirement real and testable, `confirmRingDecisions` operates on the consequence as a truth-claim (`CausalClaim`) node. The Artifact registration remains the HSI-pairing surface; the confirm surface is the truth-claim. The test seeds CausalClaim consequence nodes and proves both the human-confirm and the agent-coercion paths.

## ENABLES correction honored

Per the Wave-2 finding (and the plan's critical constraint), ENABLES is NOT in `ALLOWED_EDGE_TYPES`. This wave introduces ZERO ENABLES anywhere. Banking provenance traces to an HSI_CONNECTION / REVERSE_SALIENT / ROOT_CAUSES edge (all available); REJECT/DEFER use the frozen REJECTED_BECAUSE / DEFERRED types. `grep -c ENABLES` on the wave-3 source additions is 0 except the doc comment in writeCascadeEdges retained from Wave 2.

## Known Stubs

None new. `surfaceBridgesAtGate` deliberately returns a gate descriptor rather than rendering an AskUserQuestion (the HITL render is the command/Larry layer per the plan; nested AskUserQuestion does not work in an executor). This is the documented HITL boundary, not a stub: the human-verify checkpoint below is exactly where the navigator drives the real gate.

## Threat Flags

None. Zero network surface in this wave: no fetch, no Brain write/query-with-content. The gate's BRAIN panel carries only the generic `Futures Wheel` methodology handle (Part 8). REJECT/DEFER reasons ride as scalar reason-codes on typed edges, never the consequence body (asserted by the no-body-leak test). Banking is a LOCAL filesystem write. T-156-01 (false provenance) mitigated by the refuse-without-source-edge guard; T-156-02 (agent-confirmed truth) mitigated by the confirmNode + resolveByUser coercion (asserted); T-156-03 (info disclosure) mitigated by scalar-only edge properties + generic BRAIN handle; T-156-SC: zero new dependencies.

## Self-Check: PASSED

- Files: subsystem-render.cjs + 3 test files + the 2 modified source files + this SUMMARY confirmed present on disk.
- Commits: 48cb88cb, 941b4642, a72f4dce confirmed in git log.
- All three plan verifies green; all SOURCE grep gates correct; no hand-rolled HTML; em-dash clean on every added line.
