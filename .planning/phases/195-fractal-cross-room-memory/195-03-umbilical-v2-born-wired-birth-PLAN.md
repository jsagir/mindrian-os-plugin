---
phase: 195-fractal-cross-room-memory
plan: 03
type: execute
wave: 2
depends_on: ["195-01"]
autonomous: true
requirements: [FCM-03, FCM-04, FCM-05, FCM-06]
files_modified:
  - lib/core/resolve-umbilical-target.cjs
  - lib/core/navigation/room-birth.cjs
  - tests/test-195-umbilical-v2.cjs
  - tests/test-195-inherit-seed.cjs
  - tests/test-195-born-wired-birth.cjs
  - tests/test-195-birth-gate.cjs
user_setup: []
must_haves:
  truths:
    - "parseUmbilicalInheritance reads a v2 `inherits:` block; a v1 marker (no block) defaults every kind to `local` (byte-compatible, no migration)."
    - "On sub-room seed, child USER/BRAIN derive from the parent (generic persona enums + framework handles only); STATE/MINTO/FEYNMAN stay locally owned."
    - "A born-wired sub-room birth wires all 5 SEED-001 side-effects atomically or fails CLOSED (compensating rollback leaves no orphan)."
    - "The NESTED_WITHIN child->parent edge is written INSIDE the STEP-2 ACID block via navigation.cjs."
    - "A human-approval gate fires BEFORE mkdir; on Reject no folder is created and the rejection is graph data."
    - "A freshly born sub-room holds the full 6-file complement synchronously (BRAIN.md stub seeded at birth)."
  artifacts:
    - path: "lib/core/resolve-umbilical-target.cjs"
      provides: "parseUmbilicalInheritance sibling reader (all-local default)"
      contains: "parseUmbilicalInheritance"
    - path: "lib/core/navigation/room-birth.cjs"
      provides: "parent sub-room birth path: pre-mkdir gate + NESTED_WITHIN in ACID block + fail-closed rollback + 6-file seed + parent-derived USER/BRAIN"
      contains: "NESTED_WITHIN"
  key_links:
    - from: "room-birth.cjs STEP 1 scaffold"
      to: "resolve-umbilical-target.cjs::parseUmbilicalInheritance"
      via: "read parent .umbilical map at seed; derive child USER/BRAIN for kinds marked `parent`"
      pattern: "parseUmbilicalInheritance"
    - from: "room-birth.cjs STEP 2 ACID block"
      to: "navigation.cjs writeEdge (NESTED_WITHIN)"
      via: "child->parent lineage edge inside BEGIN..COMMIT"
      pattern: "NESTED_WITHIN"
    - from: "room-birth.cjs pre-mkdir gate"
      to: "gateAnswers drained in STEP 2"
      via: "AskUserQuestion/F.8 Approve before fs.mkdirSync"
      pattern: "mkdirSync"
---

<rules>
## RULES (restated every plan - non-negotiable)

- **CJS only. NO em-dashes anywhere (hyphens only).** HARD RULE.
- **Part 8 (LOCAL -> BRAIN: NO):** the umbilical cord flows generic persona enums + framework handles ONLY; STATE/MINTO/FEYNMAN never flow (no user prose crosses the cord). Zero Brain wire.
- **Part 9:** the NESTED_WITHIN edge is written ONLY through navigation.cjs, inside the ACID block.
- **Part 11 R1/R2 born-WIRED:** the sub-room is born WIRED (registry + NESTED_WITHIN edge + 6-file complement + projection) or the birth fails CLOSED.
- **Frozen scalars UNTOUCHED.** No new threshold/constant.
- **ONE net-new memory kind (DRIFT, from Plan 02); NO new edge type here** (NESTED_WITHIN is an existing ALLOWED_EDGE_TYPE). NO new selector shape - the birth gate composes the shipped AskUserQuestion / F.8 primitive.
- **SEED-001's 5 side-effects PRESERVED VERBATIM (HARD RULE)** - quoted below in the task; do NOT paraphrase. Realize them on today's spine (room.db typed graph; NESTED_WITHIN via navigation.cjs).
- **Depends on Plan 01:** the SEED-004 fix MUST be landed - every one of the child's seeded 6-file writes hits the write-scope hook on a freshly created NESTED path. Un-fixed, birth false-blocks on its own seeding.
- **Resumable:** each task commits independently.
</rules>

<objective>
Wave 2 - `.umbilical` v2 inheritance (FCM-03/04) + born-wired HITL sub-room birth (FCM-05/06). Grow the Phase-139 `.umbilical` marker into an inheritance nutrient channel and make sub-room birth atomic, fail-closed, human-gated, and born-wired.

Purpose: Sub-rooms are born orphaned today (no edge, best-effort steps). This closes the birth defect so the fractal self-propagates: the cord feeds the child's USER/BRAIN on seed, and birth wires all 5 SEED-001 side-effects or unwinds.
Output: parseUmbilicalInheritance reader (all-local default); a parent birth path in room-birth.cjs with the pre-mkdir gate, the NESTED_WITHIN edge inside the ACID block, a compensating fail-closed rollback, full 6-file seeding, and parent-derived child USER/BRAIN.
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
  <name>Task 1: .umbilical v2 inheritance-map parser (FCM-03)</name>
  <files>lib/core/resolve-umbilical-target.cjs, tests/test-195-umbilical-v2.cjs</files>
  <read_first>
    - lib/core/resolve-umbilical-target.cjs (PATTERNS.md clone-analog: parseUmbilicalRoom:95 the v1 line-parser reading only `room:`, tolerant/null-on-garble; resolveUmbilicalTarget needs NO change; env vars MINDRIAN_ROOMS_HOME/ROOT read at :163).
    - reconcile-memory-runner.cjs extractPersona:199 + extractBrainAnchors:364 (the generic persona enums + frozen KNOWN_FRAMEWORK_HINTS that bound what flows down - Part 8).
  </read_first>
  <action>Add a sibling `parseUmbilicalInheritance(markerPath)` beside `parseUmbilicalRoom` (resolve-umbilical-target.cjs:95) using the SAME line-oriented parse (do NOT pull a YAML dep - CJS built-ins only). It returns `{USER:'parent'|'local', BRAIN:..., STATE:..., MINTO:..., FEYNMAN:...}` with a SAFE DEFAULT of ALL `local` when the `inherits:` block is absent (v1 markers stay byte-compatible; no migration). The v2 marker shape: `room:`/`relation:`/`born:` as v1, plus an `inherits:` block with per-kind `parent`|`local`. FLOWS DOWN (`parent`): USER (persona - generic enums only), BRAIN (generic framework handles only, Part 8). LOCALLY OWNED (`local`): STATE, MINTO, FEYNMAN. One file declares inheritance; the map is read at seed time only (no silent propagation). `resolveUmbilicalTarget` itself is UNCHANGED. Author tests/test-195-umbilical-v2.cjs: a v2 marker parses to the declared map; a v1 marker (no `inherits:`) defaults all-local; a garbled block degrades to all-local without throwing. NO em-dashes.</action>
  <verify>
    <automated>node tests/test-195-umbilical-v2.cjs</automated>
  </verify>
  <acceptance_criteria>node tests/test-195-umbilical-v2.cjs passes: v2 map parsed; v1 defaults all-local; garble -> all-local, never throws.</acceptance_criteria>
  <done>The cord declares inheritance; the birth seeder (Task 3) can read it.</done>
</task>

<task type="auto">
  <name>Task 2: Born-wired birth - pre-mkdir gate + NESTED_WITHIN in ACID + fail-closed rollback + 6-file seed (FCM-05/06)</name>
  <files>lib/core/navigation/room-birth.cjs, tests/test-195-born-wired-birth.cjs, tests/test-195-birth-gate.cjs</files>
  <read_first>
    - lib/core/navigation/room-birth.cjs (PATTERNS.md: birthRoom:323 the 7-step keystone; approvedBy string-guard at :327 - a BYPASS guard, not an interactive gate; fs.mkdirSync at :369; STEP-2 ACID block BEGIN:459 / COMMIT:539 / ROLLBACK:541; opts.parent already threaded at :359/:375/:600; _pathSafetyReason path guard at :117).
    - lib/core/room-discard-cascade.cjs (PATTERNS.md compensating-rollback donor: discardPlaceholderRoom:61 reverse-order db->fs->registry teardown; header lines 11-24 close-db-before-file-removal ordering).
    - lib/core/navigation/edges.cjs (NESTED_WITHIN is a legal ALLOWED_EDGE_TYPE at :471; writeEdge chokepoint at :493).
    - lib/hmi/shape-f8-renderer.cjs / the AskUserQuestion primitive (the gate to compose - NO new shape).
    - .planning/seeds/retired/SEED-001-proactive-sub-room-suggestions-with-wired-creation.md (the verbatim 5 side-effects - quoted below).
  </read_first>
  <action>Add the born-wired parent sub-room birth path to `birthRoom` (room-birth.cjs:323). (1) HUMAN GATE BEFORE mkdir (FCM-06): before `fs.mkdirSync(roomDir, {recursive:true})` (:369), fire an AskUserQuestion / F.8-class prompt "Create sub-room &lt;slug&gt; under &lt;parent&gt;? [Approve / Reject]" (compose the shipped primitive - NO new selector shape). Only on Approve does mkdir run; the answer flows into `gateAnswers` (drained in STEP 2) so a Reject is graph data (Part 4, rejection-is-data). The existing `approvedBy` string-guard (:327) stays as the bypass hard-guard. (2) NESTED_WITHIN INSIDE THE ACID BLOCK (FCM-05): write the child->parent NESTED_WITHIN edge via navigation.cjs writeEdge INSIDE the STEP-2 `db.exec('BEGIN')`..`COMMIT` block (:459-539) so lineage is atomic with birth (today the edge is written by the 169 heal path, not birthRoom). (3) FULL 6-FILE SEED: scaffold writes 4 (ROOM/STATE/MINTO/USER) + FEYNMAN via seedSection; ADD a BRAIN.md stub at birth so the complement is 6/6 synchronously (Phase-90 derivation overwrites it later, STEP 7) - the recursive reconciler then sees a complete complement. (4) FAIL-CLOSED (SEED-001): wrap the 5 side-effects so ANY failure unwinds the whole birth via the room-discard-cascade reverse-order teardown (close room.db handle -> unlink scaffold dir -> remove registry key -> ROLLBACK db); no half-born orphan (Pitfall 7). Preserve the `_pathSafetyReason` guard (:117). Quote the SEED-001 five verbatim (below) in the SUMMARY. Author tests/test-195-born-wired-birth.cjs (all 5 side-effects present on success; an induced failure at any of the 5 leaves NO folder / NO registry key / NO db rows) and tests/test-195-birth-gate.cjs (gate fires BEFORE mkdir; Reject -> no folder + rejection recorded). NO em-dashes.

SEED-001 five non-negotiable side-effects (VERBATIM - preserve exactly, realize on today's spine):
> 1. Parent room's `STATE.md` gets a `[[<sub-slug>]]` entry under a `## Sub-rooms` section (created if missing).
> 2. Sub-room's `STATE.md` gets `parent: [[<parent-slug>]]` in frontmatter and a `## Parent Room` link section in body.
> 3. SQLite local graph (`room/.room-graph/graph.sqlite` - NOT Kuzu): `INSERT room` node for the sub-room + `INSERT edge (parent -> child, type=contains, depth=N)`.
> 4. `.rooms/registry.json` gets a new entry with `parent`, `depth`, `path`, AND parent's `children: [..., <new-slug>]` updated.
> 5. Wikilink resolver cache (`lib/vault/wikilink-builder.cjs`) for the parent room must invalidate so the next render picks up the next link.

(Substrate mapping: side-effect 3's graph edge is realized as the ALLOWED `NESTED_WITHIN` type via navigation.cjs inside the STEP-2 ACID block over the shipped room.db; the five-item CONTRACT is preserved verbatim, the substrate is the current spine.)</action>
  <verify>
    <automated>node tests/test-195-born-wired-birth.cjs &amp;&amp; node tests/test-195-birth-gate.cjs</automated>
  </verify>
  <acceptance_criteria>Both tests pass: 5 side-effects atomic on success; induced failure -> full rollback (no orphan); NESTED_WITHIN written inside the ACID block; gate fires BEFORE mkdir; Reject -> no folder + rejection is graph data; 6/6 complement synchronously.</acceptance_criteria>
  <done>Born-wired birth is atomic, fail-closed, human-gated (R1/R2).</done>
</task>

<task type="auto">
  <name>Task 3: Child USER/BRAIN derive from parent on seed (FCM-04)</name>
  <files>lib/core/navigation/room-birth.cjs, tests/test-195-inherit-seed.cjs</files>
  <read_first>
    - lib/core/navigation/room-birth.cjs STEP 1 scaffold (:362 - where the child USER.md is written; the seed-time hook point).
    - lib/core/resolve-umbilical-target.cjs::parseUmbilicalInheritance (Task 1 - the map reader this task consumes).
    - reconcile-memory-runner.cjs extractPersona:199 (generic persona enums: canonical_role / role_blend / journey_stage) + extractBrainAnchors:364 (frozen KNOWN_FRAMEWORK_HINTS handles).
  </read_first>
  <action>In born-wired birth STEP 1 (room-birth.cjs, after scaffold writes the child's baseline USER.md), read the parent's `.umbilical` inheritance map via `parseUmbilicalInheritance` (Task 1). For each kind marked `parent`: seed the child's file by deriving from the parent's file - USER derives the persona (the generic enums `extractPersona` already extracts: canonical_role / role_blend / journey_stage); BRAIN derives the generic framework anchors only (`extractBrainAnchors` restricts to the frozen KNOWN_FRAMEWORK_HINTS). This is a seed-time ONE-SHOT, not a live link (consistent with "no silent propagation"). Kinds marked `local` (STATE/MINTO/FEYNMAN) are NOT derived - the child grows its own. Part 8: only generic enums/handles cross the cord; no user prose. Author tests/test-195-inherit-seed.cjs: a child born under a parent whose `.umbilical` marks USER/BRAIN `parent` gets the parent's persona enums + framework handles at seed; a child whose map marks them `local` (or a v1 marker) gets the baseline scaffold only; STATE/MINTO/FEYNMAN are never derived; no prose bytes appear in the derived files. NO em-dashes.</action>
  <verify>
    <automated>node tests/test-195-inherit-seed.cjs</automated>
  </verify>
  <acceptance_criteria>node tests/test-195-inherit-seed.cjs passes: parent-marked USER/BRAIN derive generic enums/handles at seed; local-marked kinds do not; v1 marker -> baseline only; no prose egress across the cord.</acceptance_criteria>
  <done>The cord feeds the child's USER/BRAIN on seed, generic-only, one-shot.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| parent room -> child room (the cord) | Inheritance derivation could carry user prose across the cord (Part 8 breach) if not restricted to generic enums/handles. |
| birth request -> filesystem/registry/db | A half-completed birth leaves a dangling active pointer / orphan; a silent promotion bypasses the human gate. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-195-06 | Elevation | silent sub-room promotion (gate bypass) | mitigate | AskUserQuestion/F.8 human gate BEFORE mkdir; approvedBy hard-guard; born-wired fail-closed |
| T-195-07 | DoS / integrity | half-born orphan leaves dangling active pointer | mitigate | scaffold-before-registry order (shipped) + compensating rollback on ANY of the 5 side-effects failing |
| T-195-08 | Information Disclosure | user prose crosses the cord on inheritance seed | mitigate | derive generic persona enums + frozen framework handles only (extractPersona/extractBrainAnchors); STATE/MINTO/FEYNMAN never flow |
| T-195-09 | Elevation | path traversal via crafted roomDir/slug into execSync | mitigate | _pathSafetyReason reject `..` + JSON.stringify-quoted shell args (room-birth.cjs:117) |
| T-195-SC | Tampering | npm/pip/cargo installs | accept | ZERO external installs this phase; supply-chain N/A |
</threat_model>

<verification>
- node tests/test-195-umbilical-v2.cjs, test-195-born-wired-birth.cjs, test-195-birth-gate.cjs, test-195-inherit-seed.cjs all green.
- bash tests/run-all-195.sh: the four legs flip SKIP -> PASS.
- SEED-001 five side-effects quoted verbatim in the SUMMARY.
- No em-dashes in the modified files.
</verification>

<success_criteria>
- `.umbilical` v2 parses; v1 stays byte-compatible.
- Born-wired birth: 5 side-effects atomic or fail-closed; NESTED_WITHIN inside the ACID block; human-gated before mkdir; 6/6 complement synchronously.
- Child USER/BRAIN derive generic-only from the parent on seed.
</success_criteria>

<artifacts_produced>
## Artifacts this phase produces (Plan 03)
- lib/core/resolve-umbilical-target.cjs (parseUmbilicalInheritance)
- lib/core/navigation/room-birth.cjs (born-wired parent birth path)
- tests/test-195-umbilical-v2.cjs, test-195-inherit-seed.cjs, test-195-born-wired-birth.cjs, test-195-birth-gate.cjs
</artifacts_produced>

<output>
Create `.planning/phases/195-fractal-cross-room-memory/195-03-SUMMARY.md` when done
</output>
