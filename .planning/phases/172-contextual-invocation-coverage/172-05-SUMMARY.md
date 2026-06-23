---
phase: 172-contextual-invocation-coverage
plan: 05
subsystem: connector-spine
tags: [cirs, connector-spine, hats, six-thinking-hats, navigation-engine, canon-part-11, reach-mapping, INV-02]

# Dependency graph
requires:
  - phase: 172-04
    provides: the rs-* family wired into context_block + the coverage ledger (66 wired / 0 excluded / 58 gap) this plan's four new connectors register against
  - phase: 143.3-connector-spine-and-intelligence-orchestrator
    provides: the connector: frontmatter contract + scripts/build-connector-registry.cjs generator + the --check tripwire + the validateConnectors tuple check
  - phase: 148-larryreach-selector-re-wire
    provides: the frozen 6th machine reach_id 'hats' (D-09); this plan fills its missing engine MAPPING
provides:
  - "causal + diagnostics WIRED into the context_block reach; hat-briefing + persona WIRED into the 'hats' reach (CIRS R1 WIRED state, Canon Part 11)"
  - "reachIdToSkillFamily now has a 'hats' case mapping the frozen 6th reach to the existing canonical verb 'Synthesize' -- a fired hats reach flips routing_source legacy->engine"
  - "The full originally-half-wired set (8 commands: rs-* from Plan 04 + these 4) is now WIRED; the half-wired bucket is empty"
  - "The coverage gap shrinks by exactly 4 (70 wired / 0 excluded / 54 gap, was 66/0/58)"
affects: [172-06 (exhaustive residual classification), 172-13 (RETRO-07 hard-FAIL flip reads this ledger)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "connector: block per command file -- the R1 WIRED state declared as additive frontmatter, generator-read never hand-edited"
    - "distinct sub_mode per surface under one reach family (hat-briefing / persona under reach 'hats', distinct from think-hats' six-hats) to satisfy the validateConnectors (sensor,reach,sub_mode) no-collision check"
    - "engine MAPPING fill: a frozen reach minted in a prior phase (148) gets its missing reachIdToSkillFamily case here, mapped to an EXISTING canonical verb -- no new reach, no new verb"
    - "regenerated-artifact lockstep: connector-registry + coverage-ledger + harness-manifest move together (the harness manifest digests the registry)"

key-files:
  created:
    - tests/test-172-hats-reach-case.cjs
  modified:
    - commands/causal.md
    - commands/diagnostics.md
    - commands/hat-briefing.md
    - commands/persona.md
    - lib/core/navigation-engine.cjs
    - data/connector-registry.json
    - data/connector-coverage-ledger.json
    - data/harness-manifest.json

key-decisions:
  - "hats maps to the EXISTING canonical verb 'Synthesize' (verbToSkillFamily resolves Synthesize -> the 'blue-hat' skill -- the Blue Hat that wraps a Six Thinking Hats pass); 'Synthesize' is a frozen CANONICAL_VERBS member so no new verb is minted"
  - "ENGINE-side mapping only: this plan adds the reachIdToSkillFamily case so a FIRED hats reach routes; it does NOT mint a sensor that FIRES hats at runtime (out of scope, deferred by the projection contract)"
  - "resolveFireSkill exported (additive) so the engine-flip contract test can exercise the sensor-reach -> canonical-verb resolution directly (resolveFireSkill step 2)"
  - "sub_modes: hat-briefing uses 'hat-briefing', persona uses 'persona' -- both distinct from each other AND from think-hats' 'six-hats', so no (SENS, hats, sub_mode) tuple collides"
  - "causal posture pull_back (causal trace per D-172-c); diagnostics/hat-briefing/persona posture hold; distinct hierarchy_rank (causal 6, diagnostics 7 under context_block; hat-briefing 2, persona 3 under hats) so no rank collision in the rs-occupied context_block family"

patterns-established:
  - "Filling a frozen-but-unmapped reach: when a prior phase mints a reach in the connector spine but leaves the engine reachIdToSkillFamily switch without a case (so a fired reach cannot flip routing_source), the fix is an additive switch case to an EXISTING canonical verb -- never a new verb, never a new reach"

requirements-completed: [INV-02]

# Metrics
duration: ~15min
completed: 2026-06-23
---

# Phase 172 Plan 05: Complete the Half-Wired Set + Repair the hats Engine Gap Summary

**Wires the last four half-wired thinking surfaces (causal + diagnostics into context_block, hat-briefing + persona into the frozen 6th reach 'hats') AND fills the missing reachIdToSkillFamily 'hats' case in navigation-engine.cjs (mapped to the existing canonical verb 'Synthesize'), so a fired hats reach can finally flip routing_source legacy->engine -- emptying the half-wired bucket (8 of 8 wired) and shrinking the coverage gap 58 -> 54.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-23
- **Completed:** 2026-06-23
- **Tasks:** 3 of 3
- **Files modified:** 4 command files + 1 engine module + 1 new test + 3 generated data artifacts

## Accomplishments

- **Task 1 (commit a6d06a5b):** Added a `# --- Phase 143.3 connector frontmatter ---` delimited `connector:` block to all four command files. causal -> reach_id context_block, sub_mode causal-trace, framework "Root Cause Analysis", posture pull_back, SENS-02; diagnostics -> reach_id context_block, sub_mode wave1-fingerprint, framework "HSI Semantic Surprise Analysis Assistant", posture hold, SENS-01; hat-briefing -> reach_id hats, sub_mode hat-briefing, framework "Six Thinking Hats", posture hold, SENS-07; persona -> reach_id hats, sub_mode persona, framework "Six Thinking Hats", posture hold, SENS-05. Each carries `connects_to_spine: true`, a framework EXACT-matching its existing `frameworks:` value (the WFL-01 resolver key), `filing: fileEvidenceWithReadback`, `surface: F.1`, and a distinct `hierarchy_rank`. No 7th reach minted (context_block + hats are both frozen).
- **Task 2 (RED commit 44a52f91, GREEN commit 50eac2d5):** TDD. Wrote `tests/test-172-hats-reach-case.cjs` asserting the four behaviors (hats -> non-null verb; verb in CANONICAL_VERBS; resolveFireSkill fires on a top hats reach in ANY tier; the five pre-existing cases unchanged); confirmed RED (reachIdToSkillFamily('hats') returned the default null). Then added `case 'hats': return 'Synthesize'` to reachIdToSkillFamily and exported resolveFireSkill; the test went GREEN (5/5 assertions) and run-all-144.sh stayed 5/5.
- **Task 3 (commit 9d0db21f):** Ran `node scripts/build-connector-registry.cjs` to regenerate `data/connector-registry.json` (70 connectors, was 66) AND `data/connector-coverage-ledger.json` (70 wired / 0 excluded / 54 gap, was 66/0/58 -- exactly -4 on the gap count). `--check` exits 0. The harness-manifest STALE tripwire fired (the manifest digests the registry) so the manifest was regenerated via `node scripts/build-harness-manifest.cjs` and committed in the same lockstep (Deviation Rule 3, the sanctioned lockstep plan 172-04 also hit).

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire causal/diagnostics/hat-briefing/persona** - `a6d06a5b` (feat)
2. **Task 2 (TDD RED): failing test for the hats engine mapping** - `44a52f91` (test)
3. **Task 2 (TDD GREEN): add the hats case to reachIdToSkillFamily** - `50eac2d5` (feat)
4. **Task 3: Regenerate connector registry + coverage ledger + harness manifest** - `9d0db21f` (feat)

## Files Created/Modified

- `commands/causal.md` - connector block: context_block / causal-trace / pull_back / SENS-02
- `commands/diagnostics.md` - connector block: context_block / wave1-fingerprint / hold / SENS-01
- `commands/hat-briefing.md` - connector block: hats / hat-briefing / hold / SENS-07
- `commands/persona.md` - connector block: hats / persona / hold / SENS-05
- `lib/core/navigation-engine.cjs` - `case 'hats': return 'Synthesize'` added to reachIdToSkillFamily; resolveFireSkill exported for the contract test
- `tests/test-172-hats-reach-case.cjs` - new: the falsifiable 4-behavior contract for the hats engine mapping
- `data/connector-registry.json` - regenerated (70 connectors)
- `data/connector-coverage-ledger.json` - regenerated (70 wired / 0 excluded / 54 gap)
- `data/harness-manifest.json` - regenerated in lockstep (digests the registry)

## Verification

| Check | Result |
|-------|--------|
| Task 1: causal/diagnostics carry reach_id context_block; hat-briefing/persona carry reach_id hats | OK |
| Task 2 verify: `case 'hats'` present in navigation-engine.cjs | OK |
| Task 2 test: tests/test-172-hats-reach-case.cjs | 5/5 assertions PASS |
| run-all-144.sh (engine flip suite, the 5 existing cases unchanged) | 5/5 PASS |
| test-148-engine-reaches / test-148-hats-sixth-reach / test-reach-ids-drift | all PASS |
| Task 3: `node scripts/build-connector-registry.cjs --check` exit | 0 (`connector-registry: OK`; gap WARN warn-only) |
| causal/diagnostics/hat-briefing/persona wired in ledger | 4 of 4 |
| All eight originally-half-wired (rs-* + these 4) wired | ALL_EIGHT_WIRED: true |
| Coverage counts | wired 70 (+4), excluded 0, gap 54 (-4) |
| Idempotent regenerate leaves tree clean | OK (no diff on re-run) |

## Decisions Made

- **hats -> 'Synthesize'.** A hats reach runs a Six Thinking Hats / Blue-Hat synthesis pass; `verbToSkillFamily` already resolves `Synthesize -> 'blue-hat'` (the Blue Hat that wraps a hats pass). `Synthesize` is a frozen `CANONICAL_VERBS` member, so the mapping mints NO new verb.
- **Engine MAPPING only.** This plan adds the engine-side case so a FIRED hats reach routes; it deliberately does NOT add a runtime sensor that fires `hats` (out of scope, deferred by the projection contract).
- **Exported resolveFireSkill** (additive, mirrors the existing "exposed for testing" comment) so the engine-flip contract test can exercise resolveFireSkill step 2 directly without driving dispatchSensors end-to-end.
- **Distinct sub_modes** (hat-briefing, persona) vs think-hats' six-hats, and distinct hierarchy_rank, to pass the validateConnectors check-4 tuple no-collision rule.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Regenerated the downstream harness manifest in lockstep**
- **Found during:** Task 3 (the Task 3 commit was blocked by a pre-commit hook)
- **Issue:** The pre-commit `harness-manifest` STALE tripwire failed the Task 3 commit because `data/harness-manifest.json` digests `data/connector-registry.json`; regenerating the registry (source_count 66 -> 70) changed the digest without the manifest being regenerated.
- **Fix:** Ran `node scripts/build-harness-manifest.cjs` (the regeneration command the tripwire itself names) and staged the regenerated manifest into the same Task 3 commit, keeping the generated-artifact set atomic. This is the sanctioned lockstep plan 172-04 documented.
- **Files modified:** data/harness-manifest.json
- **Verification:** Commit succeeded; pre-commit emitted `harness-manifest: OK`.
- **Committed in:** 9d0db21f (Task 3 commit)

**2. [Rule 3 - Blocking] Exported resolveFireSkill for the contract test**
- **Found during:** Task 2 (writing the RED test)
- **Issue:** Plan Task 2 behavior 3 requires asserting that resolveFireSkill resolves a non-null fireSkill for a top hats reach, but resolveFireSkill was not exported from navigation-engine.cjs.
- **Fix:** Added `resolveFireSkill: resolveFireSkill` to the module exports (additive, alongside the existing reachIdToSkillFamily testing export). No behavior change to the function itself.
- **Files modified:** lib/core/navigation-engine.cjs
- **Verification:** The contract test exercises resolveFireSkill(null, 0.0, 'tier_0', [{reach_id:'hats'}]) -> non-null; 5/5 PASS.
- **Committed in:** 50eac2d5 (Task 2 GREEN commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 blocking).
**Impact on plan:** Both were necessary to complete the planned tasks (the manifest lockstep was anticipated by the plan's environment note; the export was the minimal additive surface needed to make the planned Task 2 behavior 3 testable). No scope creep -- no new reach, no new verb, no new edge/node type, no new Brain wire.

## Issues Encountered

- Bash surfaced a permission prompt on two compound commands (`cd ...; for` loop; a `${PIPESTATUS[0]}` + `grep -v` pipeline). Per the environment note, retried each as a simpler single command / via the Read tool, which cleared it. No blocker.

## Frozen-Invariant Compliance (Canon Part 11 R1/R2/R3)

- No 7th reach minted: causal/diagnostics use the frozen `context_block`; hat-briefing/persona use the frozen `hats` (the 6th reach minted by Phase 148 D-09). The engine case maps `hats` to the EXISTING canonical verb `Synthesize`.
- No new canonical verb: `Synthesize` is a frozen CANONICAL_VERBS member.
- MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate, the F.1 keyboard contract: untouched (not in scope). The 6 reaches / 3 postures bank unchanged.
- No new edge type, no new node type, no new Brain wire opened. decide() reads LOCAL context only; the hats mapping adds no Brain wire (Part 11 R7).
- Triggers key on LOCAL problem-state (shipped SENS ids). Generated JSON regenerated by the generator, never hand-edited (CONN-02 discipline).

## Known Stubs

None. The four surfaces are fully wired and the hats reach is engine-mapped. The remaining 54 gap surfaces are the honest measured dark-surface count that later 172 waves (Plan 06) exist to shrink, surfaced WARN-only by the ledger.

## Threat Flags

None. Per the plan threat model: T-172-09 (tampering, hats engine mapping) is mitigated -- the hats case returns an EXISTING canonical verb and a test asserts CANONICAL_VERBS membership so no new verb/reach is minted. T-172-10 (info disclosure, hat-briefing/persona connectors) is accepted -- frozen enums + a published-framework name + a render label, no user-content path. No new network endpoint, auth path, file-access pattern, or schema change at a trust boundary.

## Next Phase Readiness

- The half-wired bucket is empty (8 of 8 wired). The 6th reach `hats` is engine-mapped and can flip routing_source.
- Ready for Plan 06 (exhaustive residual classification of the remaining 54 gap surfaces) and Plan 172-13 (the RETRO-07 hard-FAIL coverage gate, which reads this ledger).

---
*Phase: 172-contextual-invocation-coverage*
*Completed: 2026-06-23*

## Self-Check: PASSED

- FOUND: tests/test-172-hats-reach-case.cjs (git-tracked)
- FOUND: .planning/phases/172-contextual-invocation-coverage/172-05-SUMMARY.md (on disk; .planning is gitignored)
- FOUND commit a6d06a5b (Task 1) / 44a52f91 (Task 2 RED) / 50eac2d5 (Task 2 GREEN) / 9d0db21f (Task 3)
