---
id: SEED-135
status: dormant
planted: 2026-10-21
planted_during: v2.1.0 / Phase 379.1 planning (branch feat/eureka-adapter-rebased)
trigger_when: Phase 379.1 shipped (vector cache keyed by hash+model_id+dim exists) AND a UI phase touches the M:OS panel or the room dashboard
scope: medium
---

# SEED-135: Browser-side embedding for the M:OS panel with BYO-key chat over a full room

## Why This Matters

The 2026-10-21 runaway showed the cost of embedding inside the plugin's node workers: an encoder with an uncapped thread pool starves every prompt hook. The navigator's idea: let the panel (the walled ui/ packages, which already pin rxdb 17.5.0 as a read copy and could run transformers.js) embed the room in the browser.

- The encoder leaves the hook path for good: a browser tab computes in its own process with its own budget and can never starve a hook.
- WebGPU on a capable machine may beat the node worker. The RxDB "Local Vector Database with RxDB and transformers.js" article reports its own numbers for its own model (10k documents in up to an hour in batches of 10; 5 minutes with 32 workers); measure before trusting any of it for MindrianOS.
- BYO key is the consent line, not the embedding line: embeddings stay local, so Canon Part 8 holds. Only content the user chooses goes to the user's own model, through an explicit consent gate, with the same honest refusal when no key exists. Methodology still comes from the Brain, so the moat is untouched.

## The one hinge

A second encoder is only an asset if it is the SAME model. Node embeds with MongoDB/mdbr-leaf-ir (384-dim). transformers.js runs the same ONNX model in the browser. One model id across node and browser makes the vectors interchangeable with the Phase 379.1 vector cache (key: content_hash, model_id, dim). Two models would give the room two truths.

## When to Surface

**Trigger:** Phase 379.1 shipped AND a UI phase opens on the panel or dashboard.

## Scope Estimate

**Medium**: a phase. Needs (1) a governed write path for browser-computed vectors into the shared cache (today there is none; vectors are not claims, so a new chokepoint beside the node writer), (2) the artifact-scope exclusion of generated engine-input directories (CPU379-10) applied in the panel, (3) one model id enforced across node and browser with a dimension assertion, (4) the BYO-key consent gate reusing the existing egress-guard and honest-refusal seams, (5) a measured WebGPU vs node worker comparison on the real-room fixture.

## Breadcrumbs

- .planning/phases/379.1-graph-derive-drain-and-scout-runaway-cpu-embed-once-bound-th/379.1-BREAKTHROUGH-RESEARCH.md (RxDB javascript-vector-database article, mdbr-leaf-ir model card, MRL truncation probe)
- .planning/phases/379.1-graph-derive-drain-and-scout-runaway-cpu-embed-once-bound-th/379.1-CONTEXT.md (D-379.1-06 cache key, D-379.1-16 RxDB not in core, D-379.1-17 MRL seed)
- lib/core/semantic-index/embedding-spine.cjs (the one pipeline() call; the model id)
- ui/shared/package.json, ui/shell/package.json (rxdb 17.5.0 pinned, read copy)
- Related seed: Phase 380 (ship the M:OS face panel mod inside the plugin)
- Related research in flight: .planning/research/2026-10-21-rxdb-as-room-store.md (Canon Part 9 question, separate decision)

## Notes

Not part of the Phase 379.1 CPU fix. Captured 2026-10-21 from the navigator's thought during the 379.1 planning session.
