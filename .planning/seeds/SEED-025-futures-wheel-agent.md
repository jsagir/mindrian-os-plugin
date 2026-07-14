# SEED-025: Futures Wheel Agent (proactive foresight as an opportunity-location framework, assembled from ICM + HSI)

- **Planted:** 2026-06-14
- **Source:** Navigator (Jonathan) directive during the 150.10 session: "I DO WANT FUTURE WHEEL TO BE A FRAMEWORK FOR LOCATING OPPORTUNITIES." Deep-research provided + repo-grounded against ICM/HSI engines (verified real). Full research: .planning/research/futures-wheel-agent-20260614/futures-wheel-agent-research.md
- **When:** v1.14.0+ initiative. Pairs with SEED-024 (Brain orchestration graph - both need Brain-orchestrated chaining). Gated by SEED-004 for the fractal sub-room version.
- **Status:** mostly shipped (Phase 156, verified 2026-07-14: 3/4 plans COMPLETE 2026-06-14/15 -- 156-01, 156-02, 156-04; 156-03 shows "3 AUTO TASKS COMPLETE... AWAITING human-verify checkpoint before plan-complete," so not fully closed. This file previously said "dormant (research filed, build deferred)"; corrected to reflect the phase actually ran.)

## The intent

Turn the Futures Wheel (Glenn 1971) from a one-time brainstorm into a proactive, research-oriented foresight CONTEXT that locates opportunities: take any seed (technology, trend, regulation), map its first/second/third-order consequences as a living graph, and surface opportunity candidates. Larry's reframe: this is NAMING A LOOP MINDRIAN ALREADY RUNS (the proactive discovery loop) and pointing it forward in time.

## Why it is assemble-not-rebuild (verified 2026-06-14)

The engines are real and present:
- ICM (paper at .planning/research/ICM-2603.16021v2.pdf; SEED-022 fractal memory contract) = the structural backbone. Layer 0 = seed; Layer 4 = consequence nodes as artifacts.
- HSI (scripts/compute-hsi.py + hsi-to-graph.cjs + references/hsi/ + the whitespace suite + opportunity-ops.cjs) = the hidden-consequence-bridge engine. |BERT_sim - LSA_sim| finds the 2nd/3rd-order ripples nobody sees; already emits typed ENABLES/INFORMS/CONTRADICTS/CONVERGES edges.
- The proactive discovery loop in .claude/includes/architecture.md IS the Futures Wheel loop, unnamed.
- Existing commands: /mos:explore-futures, /mos:scenario-plan (futures-adjacent surfaces to build on).

## MVP vs grand vision (the load-bearing scoping)

- **MVP (buildable now):** a Futures Wheel context that takes a seed, files consequences as ICM Layer 4 artifacts (NO sub-rooms - SEED-004 gate), runs HSI to find hidden consequence bridges, tags PESTEL + temporal horizon, banks opportunity candidates via the existing loop + opportunity-ops.cjs.
- **Grand vision (research program, NOT a phase):** always-on, large-source horizon scanning, autonomous multi-agent (Scan/Consequence/Propagation/Evaluation/Synthesis/Reflection), continuous reflection/prediction-audit. Do not let this set the MVP scope.

## What to add (deltas)

1. Temporal `horizon: near|mid|long` + `confidence: 0.0-1.0` on artifact frontmatter.
2. PESTEL `domain:` tag on consequence nodes.
3. `/mos:futures:seed [concept]` command (creates the Layer 0 ICM room/context).
4. Fix SEED-004 (nested-room write-scope) before sub-room = N-th-order consequence nodes.
5. A reflection pass (scheduled scan comparing past consequence predictions vs new artifacts).

## Open challenges (carry into the spec)

Causal-extraction hallucination (use hybrid linguistic+LLM); signal-to-noise at scale; foresight evaluation rubrics; temporal-lag calibration; feedback-loop latency for long-horizon predictions.

## Next step

Run discuss/spec for the MVP context (NOT the grand agent). Sequence with SEED-024 (orchestration graph) since both want Brain-orchestrated chaining.
