---
phase: 195-fractal-cross-room-memory
plan: 01
type: execute
wave: 0
depends_on: []
autonomous: true
requirements: [SEED-004]
files_modified:
  - scripts/write-scope-check.cjs
  - scripts/83-scope-injection.test.cjs
  - tests/run-all-195.sh
  - tests/test-195-canon-7-kind-floor.cjs
  - tests/test-195-umbilical-edge-floor.cjs
  - tests/fixtures/195-nested-room-tree/
user_setup: []
must_haves:
  truths:
    - "A write into a nested 2-segment active/bound room is ALLOWED (not false-blocked)."
    - "A write into a nested 4-segment registered room is ALLOWED."
    - "A write into a DIFFERENT nested room than the active/bound one is BLOCKED (no silent-allow over-correction)."
    - "bash tests/run-all-195.sh exits 0 with the frozen-scalar-membrane grep and the canon-7-kind FLOOR both green; module legs SKIP."
    - "A depth-3 nested-room fixture (root -> section -> sub-room -> sub-sub-room) exists for downstream recursion + idempotence tests."
  artifacts:
    - path: "scripts/write-scope-check.cjs"
      provides: "targetRoomUnderRoot resolves the REGISTERED nested slug via walk-up + registry reverse-match"
      contains: "targetRoomUnderRoot"
    - path: "tests/run-all-195.sh"
      provides: "SKIP-safe aggregator (run/run_if) cloned from run-all-188.sh"
      contains: "run_if"
    - path: "tests/test-195-canon-7-kind-floor.cjs"
      provides: "FCM-08 guard, green-as-guard before the amendment"
    - path: "tests/test-195-umbilical-edge-floor.cjs"
      provides: "FLOOR for the edge-type Set (membership, never .size)"
    - path: "tests/fixtures/195-nested-room-tree/"
      provides: "shared depth-3 nested-room fixture"
  key_links:
    - from: "scripts/write-scope-check.cjs::targetRoomUnderRoot"
      to: ".rooms/registry.json entry path fields"
      via: "walk-up to deepest .room-root + reverse-match path.relative(root, sentinelDir)"
      pattern: "\\.room-root"
---

<rules>
## RULES (restated every plan - non-negotiable)

- **CJS only. NO em-dashes anywhere (hyphens only).** HARD RULE, grep-enforced.
- **Part 8 (LOCAL -> BRAIN: NO):** DRIFT entries, umbilical edges, cross-room aggregation are LOCAL and NEVER egress. Aggregate-scalar-only across boundaries (Appendix D entry 23). The cross-room-aggregator 4-tripwire fence stays intact.
- **Part 9:** all typed edges + memory_event nodes written ONLY through navigation.cjs / edges.cjs `writeEdge` chokepoint.
- **Part 11:** born-wired birth (R1/R2) - born WIRED or fails CLOSED; depth-bounded rollup (R11).
- **Frozen scalars UNTOUCHED:** MAX_K=3, DIAL_REACH_K=6, 0.70/0.15. Reuse `PRE_CHECK_THRESHOLD=0.70` and coverage-rollup `DEPTH_CAP=3`. Mint NO new threshold or depth constant.
- **Exactly ONE net-new frozen-set member (UMBILICAL_TO edge type) + ONE net-new memory kind (DRIFT).** Reject any other net-new (new walker, new selector shape, new relevance scalar, second depth constant) - it is composition per Part 7.
- **SEED-001's 5 side-effects PRESERVED VERBATIM (HARD RULE)** - quoted in Plan 03; do not paraphrase.
- **The reconciler NEVER walks `.planning/`.** The memory-kind DRIFT.md is a room-tree section artifact; `.planning/DRIFT.md` is the Phase-150.9 audit baseline - never wire them.
- **edges.cjs 205-CONCURRENT CAUTION:** a parallel Phase-205 session is concurrently adding SHARES_JOB / ELEVATES_TO to the SAME `ALLOWED_EDGE_TYPES` Set. Any executor editing edges.cjs MUST re-read it immediately before editing and append additively without clobbering 205's entries. The FLOOR test asserts MEMBERSHIP, never `.size`.
- **Resumable:** each task commits independently; `run_if` legs in run-all-195.sh flip from SKIP to run as modules land.
</rules>

<objective>
Wave 0 - Foundation + precondition. Author the SKIP-safe test spine and the two Wave-0 FLOORs, build the shared depth-3 nested-room fixture, and fix the SEED-004 residual write-scope bug that GATES born-wired birth (Wave 2).

Purpose: SEED-004 is OPEN (RESEARCH Item 1, VERIFIED). Phase 194 rewrote only the write-scope COMPARISON layer (set-membership) but left `targetRoomUnderRoot` as the original flat first-segment split, so every born-wired sub-room seeding write into a nested path will false-block. Fix it here before any birth work. The floors + aggregator exist before the modules so guards precede changes.
Output: run-all-195.sh (green with SKIPs), two FLOOR tests (green-as-guard), the SEED-004 fix + 3 fixtures, the shared nested-room fixture.
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
  <name>Task 1: SKIP-safe test spine + two Wave-0 FLOORs + shared depth-3 fixture</name>
  <files>tests/run-all-195.sh, tests/test-195-canon-7-kind-floor.cjs, tests/test-195-umbilical-edge-floor.cjs, tests/fixtures/195-nested-room-tree/</files>
  <read_first>
    - tests/run-all-188.sh (PATTERNS.md "SKIP-safe test aggregator", run-all-188.sh:30-48 run/run_if + PASS/FAIL/SKIP counters; membrane grep at 55-58) - CLONE VERBATIM.
    - lib/core/navigation/edges.cjs (PATTERNS.md edges.cjs analog; ALLOWED_EDGE_TYPES declared line 32, NESTED_WITHIN line 471, closed ~516) - the FLOOR test reads current membership.
    - docs/MINDRIAN-CANON.md Part 9 six-file list (line 338) + CLAUDE.md:46 frozen-scalar membrane substring - the canon FLOOR reads current 6-kind state.
  </read_first>
  <action>Clone tests/run-all-188.sh verbatim to tests/run-all-195.sh: keep the `run` (hard) and `run_if` (SKIP-safe until a module lands) helpers plus PASS/FAIL/SKIP counters. Register every Phase-195 module leg as `run_if` (recursive-reconcile, drift-kind, umbilical-v2, inherit-seed, born-wired-birth, birth-gate, xroom-relevance, f8-umbilical, umbilical-edge-floor, triggers, canon-7-kind-floor) so Wave 0 exits clean with SKIPs that flip to runs as waves land. Two legs MUST be green in Wave 0: (a) the frozen-scalar membrane grep `grep -qF "MAX_K=3, DIAL_REACH_K=6, 0.70/0.15 frozen" CLAUDE.md` (clone run-all-188.sh:55-58), (b) `run` (hard) test-195-canon-7-kind-floor.cjs. Author test-195-canon-7-kind-floor.cjs as a GREEN-AS-GUARD floor: assert the CURRENT canon Part-9 six-file complement (ROOM/STATE/MINTO/BRAIN/FEYNMAN/USER) is present AND the frozen-scalar membrane substring is intact in CLAUDE.md - it passes now and Wave 5 flips it to assert 7 (+DRIFT). Author test-195-umbilical-edge-floor.cjs as a FLOOR that asserts named MEMBERSHIP of every CURRENT ALLOWED_EDGE_TYPE (including NESTED_WITHIN, SHARES_JOB, ELEVATES_TO) preserved, NEVER an exact `.size`/count; in Wave 0 it does NOT yet assert UMBILICAL_TO (register it as `run_if` so it SKIPs until Wave 3 extends it). Build tests/fixtures/195-nested-room-tree/: root room (with .room-root + ROOM.md) -> a section folder -> a sub-room (ROOM.md + .room-root) -> a sub-sub-room (ROOM.md + .room-root), each level carrying the 6 memory basenames, for downstream recursion + idempotence tests. NO em-dashes in any file.</action>
  <verify>
    <automated>bash tests/run-all-195.sh; test $? -eq 0</automated>
  </verify>
  <acceptance_criteria>bash tests/run-all-195.sh exits 0; the membrane grep leg and test-195-canon-7-kind-floor.cjs both PASS; all module legs report SKIP; tests/fixtures/195-nested-room-tree/ contains a 3-deep ROOM.md-bearing tree.</acceptance_criteria>
  <done>run-all-195.sh green with SKIPs; both Wave-0 FLOORs green-as-guard; shared depth-3 fixture on disk.</done>
</task>

<task type="auto">
  <name>Task 2: SEED-004 residual fix - targetRoomUnderRoot walk-up + registry reverse-match</name>
  <files>scripts/write-scope-check.cjs, scripts/83-scope-injection.test.cjs</files>
  <read_first>
    - scripts/write-scope-check.cjs (PATTERNS.md clone-analog: the bug at write-scope-check.cjs:138-146 flat first-segment split; readActiveRoom already reads the registry at :90; the 194 set-membership check isRoomInWriteScope at :289 feeds the wrongly-resolved targetRoom).
    - lib/core/room-root.cjs::resolveRoomRoot (PATTERNS.md clone donor: the shipped `.room-root` walk-up idiom, room-root.cjs:79-89 - loop up to MAX_DEPTH, deepest sentinel wins, tolerate unreadable dirs, break at filesystem root).
    - scripts/83-scope-injection.test.cjs (existing scope-injection fixtures - extend, do not rewrite).
  </read_first>
  <action>Rewrite `targetRoomUnderRoot(root, target)` (write-scope-check.cjs:138-146) so it no longer returns `segments[0]` (the flat first-segment split that returns "mindrian" for `mindrian/mindrianOS`). Clone the room-root.cjs:79-89 walk-up idiom to walk UP from `target` to the DEEPEST `.room-root` sentinel dir, then reverse-match `path.relative(root, sentinelDir)` against `.rooms/registry.json` entry `path` fields to resolve the REGISTERED SLUG (make target resolution symmetric with `readActiveRoom` at :90, which already reads the registry). Keep the existing null-guards (rel empty / `..` / absolute -> null). This is ~15 lines and touches ONLY target resolution - the 194 set-membership comparison layer (`isRoomInWriteScope`, :289) is UNCHANGED and now receives a correctly-resolved slug. Do NOT over-correct to silent-allow: a write into a DIFFERENT nested room than the active/bound one must still BLOCK (the 95.1 drift-class-C hazard). Extend scripts/83-scope-injection.test.cjs with the 3 SEED-004 fixtures: (a) nested 2-segment room active, write inside -> ALLOW (`mindrian/mindrianOS`); (b) nested 4-segment room active, write inside -> ALLOW (`mindrian/mindrianOS/sub-rooms/venture/opportunities`, registered `mindrian-opportunities`); (c) nested room active, write into a DIFFERENT nested room -> BLOCK. NO em-dashes.</action>
  <verify>
    <automated>node scripts/83-scope-injection.test.cjs</automated>
  </verify>
  <acceptance_criteria>node scripts/83-scope-injection.test.cjs passes including the 3 new fixtures: 2 nested-write ALLOW, 1 cross-nested-write BLOCK. A nested-room write to a bound/active room no longer returns a blocked-write-to-parent error.</acceptance_criteria>
  <done>targetRoomUnderRoot resolves the registered nested slug; born-wired birth (Wave 2) will not false-block on its own seeding writes; the BLOCK fixture guards against silent-allow.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| write tool -> write-scope-check hook | Untrusted target path crosses here; a mis-resolution over-allows or false-blocks a room write. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-195-01 | Tampering | write into wrong/sealed room via nested-path confusion | mitigate | targetRoomUnderRoot registry reverse-match + the BLOCK fixture (no silent-allow over-correction); GUARDRAIL.md sealed-room skip preserved |
| T-195-02 | Elevation | over-correction silently allows a cross-nested write | mitigate | fixture (c) asserts BLOCK for a write into a different nested room than the bound one |
| T-195-SC | Tampering | npm/pip/cargo installs | accept | ZERO external installs this phase (RESEARCH Standard Stack: 100% in-repo CJS on Node built-ins); supply-chain N/A |
</threat_model>

<verification>
- bash tests/run-all-195.sh exits 0 (membrane grep + canon-7-kind floor green; module legs SKIP).
- node scripts/83-scope-injection.test.cjs green with the 3 SEED-004 fixtures.
- No em-dashes in the created/modified files (the aggregator carries a hyphen-only grep-guard, cloned from run-all-188.sh:55-58).
</verification>

<success_criteria>
- SEED-004 CLOSED: nested-room writes ALLOW, cross-nested writes BLOCK.
- The two Wave-0 FLOORs and the SKIP-safe aggregator exist and are green-as-guard.
- The shared depth-3 nested-room fixture exists for Wave 1.
</success_criteria>

<artifacts_produced>
## Artifacts this phase produces (Plan 01)
- tests/run-all-195.sh (SKIP-safe aggregator)
- tests/test-195-canon-7-kind-floor.cjs (FCM-08 guard, green-as-guard)
- tests/test-195-umbilical-edge-floor.cjs (edge-type FLOOR, membership-only)
- tests/fixtures/195-nested-room-tree/ (shared depth-3 fixture)
- scripts/write-scope-check.cjs (SEED-004 fix)
- scripts/83-scope-injection.test.cjs (+3 fixtures)
</artifacts_produced>

<output>
Create `.planning/phases/195-fractal-cross-room-memory/195-01-SUMMARY.md` when done
</output>
