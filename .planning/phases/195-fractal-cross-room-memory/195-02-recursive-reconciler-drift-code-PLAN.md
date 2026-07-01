---
phase: 195-fractal-cross-room-memory
plan: 02
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [FCM-01, FCM-02, FCM-07]
files_modified:
  - lib/core/memory/reconcile-memory-runner.cjs
  - lib/core/folder-memory.cjs
  - lib/core/folder-memory-async.cjs
  - tests/test-195-recursive-reconcile.cjs
  - tests/test-195-drift-kind.cjs
user_setup: []
must_haves:
  truths:
    - "reconcileMemoryArtifacts projects memory artifacts for ROOM.md-bearing sub-rooms recursively to depth 3."
    - "A depth-4 ROOM.md-bearing dir is discovered but NOT descended into and NOT projected."
    - "A second reconcile pass over an unchanged fractal returns {upserted:0} and a byte-identical node/edge count (idempotent)."
    - "classifyMemoryFile('DRIFT.md') === 'DRIFT'; DRIFT is a member of BASENAME_TO_KIND."
    - "readSextuple returns the five prior fields byte-unchanged plus a sixth `drift` field; the async twin matches (parity)."
    - "No memory_artifact node is ever sourced from a `.planning/...DRIFT.md` path."
  artifacts:
    - path: "lib/core/memory/reconcile-memory-runner.cjs"
      provides: "recursive discoverMemoryFiles to DEPTH_CAP + DRIFT registration + DRIFT projection branch"
      contains: "DRIFT"
    - path: "lib/core/folder-memory.cjs"
      provides: "readSextuple (6, +drift) additive read"
      contains: "readSextuple"
    - path: "lib/core/folder-memory-async.cjs"
      provides: "async readSextuple twin (parity)"
      contains: "readSextuple"
  key_links:
    - from: "reconcile-memory-runner.cjs::discoverMemoryFiles"
      to: "coverage-rollup.cjs DEPTH_CAP=3"
      via: "reuse the ONE frozen depth constant; recurse over ROOM.md-bearing subdirs to depth 3 inclusive"
      pattern: "DEPTH_CAP"
    - from: "reconcile-memory-runner.cjs::BASENAME_TO_KIND"
      to: "navigation.writeMemoryArtifactNode"
      via: "DRIFT classified generically then projected via the existing memory_artifact path"
      pattern: "DRIFT"
---

<rules>
## RULES (restated every plan - non-negotiable)

- **CJS only. NO em-dashes anywhere (hyphens only).** HARD RULE, grep-enforced.
- **Part 8 (LOCAL -> BRAIN: NO):** DRIFT entries never egress. Aggregate-scalar-only across boundaries (Appendix D entry 23).
- **Part 9:** memory_artifact nodes/edges written ONLY through navigation.cjs.
- **Part 11 R11:** depth-bounded rollup - reuse the ONE frozen `DEPTH_CAP=3`; a depth-4 node is NOT projected.
- **Frozen scalars UNTOUCHED.** Reuse coverage-rollup `DEPTH_CAP`. Mint NO second depth constant.
- **ONE net-new memory kind (DRIFT).** NO new walker (reuse `sectionRegistry.discoverSections` per level). This wave writes NO canon bytes (FCM-08 is Wave 5).
- **The reconciler NEVER walks `.planning/`.** The memory-kind DRIFT.md is a room-tree section artifact; `.planning/DRIFT.md` (Phase 150.9 `drift-baseline.cjs`) is a distinct audit baseline - never wire them (Pitfall 5). Assert no memory_artifact node is sourced from a `.planning/...DRIFT.md` path.
- **Entry-23 boundary (Pitfall 3):** where the recursion crosses a registered sub-room's own room.db, aggregate SCALARS only; read child SLUGS, NEVER read child NESTED_WITHIN edge rows across a room.db boundary.
- **Resumable:** each task commits independently.
</rules>

<objective>
Wave 1 - Recursive reconciler (FCM-01/02) + DRIFT.md CODE registration (FCM-07, code only). Grow the shipped 1-level memory walk to a depth-3 recursion over ROOM.md-bearing sub-rooms (identity-begets-memory), and register DRIFT as the 7th memory kind in code (BASENAME_TO_KIND + projection + additive read family) WITHOUT touching canon.

Purpose: The fractal was certified "closed" while the reconciler walked only 2 levels (the 150.5 sensor-gap shape). This makes depth-3 the enforced invariant. DRIFT code lands autonomously now so the Wave-5 canon amendment ratifies an already-wired basename.
Output: recursive reconcile with depth-qualified node ids + free idempotence; DRIFT classified + projected + readable via readSextuple (sync + async).
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/phases/195-fractal-cross-room-memory/195-CONTEXT.md
@.planning/phases/195-fractal-cross-room-memory/195-RESEARCH.md
@.planning/phases/195-fractal-cross-room-memory/195-PATTERNS.md
@.planning/phases/195-fractal-cross-room-memory/195-VALIDATION.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Recurse discoverMemoryFiles to depth 3 (FCM-01/02) with depth-qualified node ids</name>
  <files>lib/core/memory/reconcile-memory-runner.cjs, tests/test-195-recursive-reconcile.cjs</files>
  <read_first>
    - lib/core/memory/reconcile-memory-runner.cjs (PATTERNS.md: discoverMemoryFiles:134 the 1-level walk; scanDirForMemoryFiles:113 reused per level unchanged; reconcileMemoryArtifacts:414 loop body unchanged; MEMORY_ARTIFACT_NODE_ID(section,kind) at :444/:448/:494).
    - lib/core/coverage-rollup.cjs (PATTERNS.md recursion-idiom donor: frozen DEPTH_CAP=3 at :41; the read-slugs-never-edges discipline `SELECT source FROM edges WHERE type='NESTED_WITHIN'` at :96).
    - lib/core/section-registry.cjs::discoverSections (:49 - reuse per level; skips hidden + structural dirs, qualifies a dir with STATE.md/any .md).
    - tests/fixtures/195-nested-room-tree/ (the shared depth-3 fixture from Plan 01).
  </read_first>
  <action>Extend `discoverMemoryFiles` (reconcile-memory-runner.cjs:134): after scanning a section folder, detect whether that folder or any descendant carries its OWN ROOM.md (the identity marker, Decision #15). A ROOM.md-bearing descendant is a SUB-ROOM - recurse into it running the same root+sections scan, reusing `sectionRegistry.discoverSections` per level (do NOT hand-roll a walker). Bound the descent with coverage-rollup's frozen `DEPTH_CAP=3` (root = depth 0; walk children to depth 3 inclusive and STOP); a depth-4 ROOM.md-bearing dir is discovered but NOT descended into and its memory files are NOT projected. `scanDirForMemoryFiles` (:113) and the `reconcileMemoryArtifacts` (:414) loop body stay UNCHANGED - feeding the loop a deeper flat file list is sufficient (this is why idempotence is free). Depth-qualify the section key with the sub-room relative path (or a path hash) so `MEMORY_ARTIFACT_NODE_ID(section, kind)` stays unique across depths (Pitfall 2 - two sub-rooms sharing a section slug must not collide). Where the recursion reaches a registered sub-room with its OWN room.db, aggregate SCALARS only; read child SLUGS via the coverage-rollup idiom, NEVER read child NESTED_WITHIN edge rows across the boundary (Appendix D entry 23, Pitfall 3). Leave a code comment naming ZOOM re-rooting beyond depth 3 as a deferred design note. Author tests/test-195-recursive-reconcile.cjs against the shared fixture: pass-1 projects N nodes / E edges across depths 1-3; a depth-4 dir is NOT projected; pass-2 returns {upserted:0} and a byte-identical node/edge COUNT; distinct-file count === node count (no collision). NO em-dashes.</action>
  <verify>
    <automated>node tests/test-195-recursive-reconcile.cjs</automated>
  </verify>
  <acceptance_criteria>node tests/test-195-recursive-reconcile.cjs passes: depth-3 recursion projects sub-room complements; depth-4 NOT projected; pass-2 idempotent ({upserted:0}, identical count); depth-qualified ids unique; no cross-room NESTED_WITHIN edge aggregation.</acceptance_criteria>
  <done>The fractal memory invariant is enforced to depth 3, idempotently, within the entry-23 boundary.</done>
</task>

<task type="auto">
  <name>Task 2: Register DRIFT as the 7th memory kind in code (FCM-07) - BASENAME_TO_KIND + projection + readSextuple</name>
  <files>lib/core/memory/reconcile-memory-runner.cjs, lib/core/folder-memory.cjs, lib/core/folder-memory-async.cjs, tests/test-195-drift-kind.cjs</files>
  <read_first>
    - lib/core/memory/reconcile-memory-runner.cjs (PATTERNS.md FCM-07 data-only: BASENAME_TO_KIND:67 add one line; classifyMemoryFile:80 needs NO change - reads the map generically; per-kind projection block ~:497-561 add a DRIFT branch).
    - lib/core/folder-memory.cjs (PATTERNS.md Path A: readTriple:91 -> readQuadruple:210 -> readQuintuple:306; the shipped ceiling is readQuintuple (5); spread-prior + add-one idiom).
    - lib/core/folder-memory-async.cjs (async twins: readQuadruple:182, readQuintuple:242; the quadruple test asserts sync/async parity, folder-memory-quadruple.test.cjs:380).
    - lib/core/drift-baseline.cjs header (DISAMBIGUATION only: this writes `.planning/DRIFT.md` - the audit baseline, NOT the memory kind; never wire the two).
  </read_first>
  <action>Add `'DRIFT.md': 'DRIFT'` to `BASENAME_TO_KIND` (reconcile-memory-runner.cjs:67) with a comment noting the code lands autonomously while the canon 6->7 amendment is GATED (FCM-08, Wave 5). Leave `classifyMemoryFile` (:80) UNCHANGED - it reads the map generically so DRIFT.md classifies automatically. Add a `DRIFT` branch to the per-kind projection block (~:497-561) that projects a MINIMAL `memory_artifact` node via the existing generic `writeMemoryArtifactNode` path (richer drift-ledger node is deferred - keep scope tight, RESEARCH A5). Extend the read family via Path A (RESEARCH Item 5, recommended): add `readSextuple(sectionPath)` (6, +drift) to folder-memory.cjs mirroring the exact readQuintuple idiom - spread the prior five fields BYTE-UNCHANGED, add one `drift` key read from DRIFT.md; every existing caller of readTriple/Quadruple/Quintuple is byte-unaffected. Grow the matching async `readSextuple` AsyncFunction in folder-memory-async.cjs (parity contract). The USER read-back gap (readQuintuple stops at feynman) is a PRE-EXISTING item left as a named follow-on, OUT of 195 scope. Author tests/test-195-drift-kind.cjs: assert `classifyMemoryFile('DRIFT.md')==='DRIFT'`, DRIFT in BASENAME_TO_KIND, a DRIFT.md in a section folder projects a memory_artifact node, readSextuple returns the 5 prior fields byte-identical + a `drift` field, sync/async parity, and NO node is sourced from a `.planning/...DRIFT.md` path. NO em-dashes.</action>
  <verify>
    <automated>node tests/test-195-drift-kind.cjs</automated>
  </verify>
  <acceptance_criteria>node tests/test-195-drift-kind.cjs passes: DRIFT classified + projected; readSextuple additive + async-parity; no `.planning/` DRIFT.md sourced. This wave writes NO canon bytes.</acceptance_criteria>
  <done>DRIFT is a fully wired memory kind in code; the Wave-5 canon amendment will ratify an already-registered basename.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| filesystem MD -> room.db projection | The reconciler reads room-tree MD and writes typed nodes; a boundary cross could aggregate cross-room edges (entry-23 breach). |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-195-03 | Tampering (constitutional) | cross-room NESTED_WITHIN edge aggregation in the recursion | mitigate | read child SLUGS + LOCAL scalars only (coverage-rollup idiom); never read child edge rows across a room.db boundary (entry 23) |
| T-195-04 | Information Disclosure | DRIFT entry egress to Brain | mitigate | DRIFT projects a LOCAL memory_artifact node only; zero Brain wire (Part 8) |
| T-195-05 | Integrity | node-id collision across fractal depths overwrites a sibling | mitigate | depth-qualify the section key with sub-room relative path/hash; the idempotence test asserts distinct-file === node count |
| T-195-SC | Tampering | npm/pip/cargo installs | accept | ZERO external installs this phase; supply-chain N/A |
</threat_model>

<verification>
- node tests/test-195-recursive-reconcile.cjs green (depth-3, depth-4-not-projected, idempotent).
- node tests/test-195-drift-kind.cjs green (DRIFT code registration + readSextuple parity).
- bash tests/run-all-195.sh: the two new legs flip from SKIP to PASS; canon-7-kind floor STILL green-as-guard (asserts 6, unchanged this wave).
- No em-dashes in the modified files.
</verification>

<success_criteria>
- Recursive reconcile enforces the depth-3 fractal invariant idempotently, within entry-23.
- DRIFT is registered + projected + readable in code, with no canon change.
</success_criteria>

<artifacts_produced>
## Artifacts this phase produces (Plan 02)
- lib/core/memory/reconcile-memory-runner.cjs (recursive walk + DRIFT registration + projection)
- lib/core/folder-memory.cjs (readSextuple)
- lib/core/folder-memory-async.cjs (async readSextuple)
- tests/test-195-recursive-reconcile.cjs
- tests/test-195-drift-kind.cjs
</artifacts_produced>

<output>
Create `.planning/phases/195-fractal-cross-room-memory/195-02-SUMMARY.md` when done
</output>
