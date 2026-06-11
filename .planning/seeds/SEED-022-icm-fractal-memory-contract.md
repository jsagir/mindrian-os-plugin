# SEED-022: ICM Fractal Memory Contract (identity-begets-memory, umbilical v2, born-wired birth, DRIFT.md)

- **Planted:** 2026-06-11
- **Source:** v1.13.1 drift audit session (Fable 5 full review of GSD phase artifacts, phases 88-150) + ICM fractal research digest. Approved by Jonathan via HITL gate (all 4 pieces, filed to seed + auto-memory).
- **When:** v1.14.0 -- compose with SEED-001 (sub-room wiring), SEED-004 (URGENT precondition), Phase 136 fractal navigator, Phase 112 room budding.
- **Status:** dormant

## The problem (intent vs actual)

ICM (Interpretable Context Methodology) declares a 5-layer fractal: "folder structure IS the code" and Decision #15: "if it's a directory, it gets ROOM.md." Reality: the fractal is 2 levels deep.

- `reconcile-memory-runner.cjs` + `section-registry.cjs` walk exactly one level (room root + immediate sections). A sub-room's ROOM.md is treated as an artifact, not an identity.
- Sub-rooms are born orphaned: no graph edge, no registry entry, no wikilink wiring (SEED-001 dormant; SEED-004 nested-room write-scope bug blocks it, marked URGENT).
- `.umbilical` (Phase 139, shipped) only answers "which room am I in" -- it carries no inheritance semantics.
- The gap is not architectural; it is a birth defect. Fix birth and the fractal self-propagates.

## The contract (4 pieces, all approved 2026-06-11)

### 1. Identity-begets-memory invariant
Any directory carrying ROOM.md is owed the full 6-file memory complement (ROOM/STATE/MINTO/BRAIN/FEYNMAN/USER) and a graph projection through the navigation.cjs chokepoint. Reconciler goes recursive, bounded at depth 3 (promote Phase 136's design note from suggestion to enforced invariant; ZOOM re-roots beyond depth 3).

### 2. Umbilical cord v2: marker -> nutrient channel
`.umbilical` grows an inheritance map declaring what flows down vs what is locally owned:
- **Flows down (the cord feeds the child):** USER.md persona, BRAIN.md anchors (generic framework handles only, Part 8).
- **Locally owned (the child grows its own organs):** STATE.md, MINTO.md, FEYNMAN.md.
One file declares inheritance; no guessing, no silent propagation.

### 3. Born-wired birth gate (HITL)
Sub-room creation = SEED-001's 5 side-effects + 6-file memory seeding, atomic, fail-closed, AND gated by explicit human approval (AskUserQuestion-class prompt) before the folder exists. No silent promotion of a section to a sub-room, ever. **Precondition: fix SEED-004 first.**

### 4. DRIFT.md -- the 7th memory kind (optional, opinionated)
Per-folder intent-vs-actual ledger. Drift audits (TUI slippage, Hooked slippage, doc drift, verification theater) file findings where the drift lives instead of evaporating in reports. Canon impact: extends the 6-file complement to 7; reconciler + readQuintuple would need an additive readSextuple extension; Part 8 rules apply (drift entries are LOCAL, never egress).

## Acceptance sketch

- [ ] SEED-004 fixed and regression-fenced (precondition)
- [ ] reconcileMemoryArtifacts walks ROOM.md-bearing dirs recursively to depth 3; idempotent; second pass changes no node/edge count
- [ ] `.umbilical` v2 schema shipped + resolve-umbilical-target.cjs reads inheritance map; child USER/BRAIN derive from parent on seed
- [ ] /mos:create-nested (or BUD) fails closed unless 5 side-effects + 6-file seeding all land; human approval gate fires before mkdir
- [ ] DRIFT.md kind registered in MEMORY_BASENAMES, reconciler classification, and memory-artifact projection (decision: ship with or defer behind a flag)
- [ ] Claim-harness arm: nested fixture room at depth 3 projects N nodes; depth 4 dir is NOT projected (cap honored)

## Verification echo (why this seed exists)

The 2026-06-11 drift audit found the engagement loop "certified closed months before it actually was" (5/8 sensors structurally dead in prod while gates were green). The fractal memory gap has the same shape: canon says fractal, code says 2 levels. This seed closes the gap the same way 150.5 closed the sensor gap -- by making the invariant enforceable, not aspirational.
