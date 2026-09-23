---
phase: quick/260923-u8v
plan: 01
subsystem: methodology-sensors
tags: [dispatch-sensors, larry-personality, dominant-design, theo, sens-09, regex-classifier]

requires:
  - phase: 361-dominant-design-research-mode
    provides: "/mos:dominant-designs research mode, connector.web_scope, the D-03/D-12 quick-pass-first doctrine this plan's SKILL section restates"
provides:
  - "SENS-09 dominant-design keyword branch (classifyDominantDesign, DOMINANT_DESIGN_CUES, DOMINANT_DESIGN_STATES) in lib/core/sensors/sensor-diffusion-adoption.cjs"
  - "dispatch-framework-map.json 'dominant-design' -> 'Dominant Design' translation entry"
  - "commands/dominant-designs.md connector claim of SENS-09 (registries regenerated)"
  - "skills/larry-personality/SKILL.md doctrine subsection: When to reach for Dominant Design"
  - "honest SENS-09 counter-metric record naming both ACE and Dominant Design routes"
affects: [larry-personality, insight-sensors, connector-registry, brain-orchestration-projection]

tech-stack:
  added: []
  patterns: ["keyword-tier branch inserted between ACE context and ACE keyword in an existing sensor's mode ladder, reusing the frozen brain_consult reach"]

key-files:
  created:
    - tests/test-quick-260923-u8v-dominant-design-reach.cjs
  modified:
    - lib/core/sensors/sensor-diffusion-adoption.cjs
    - lib/core/sensors/sensor-priority.cjs
    - data/dispatch-framework-map.json
    - commands/dominant-designs.md
    - data/connector-registry.json
    - data/brain-orchestration-projection.json
    - data/harness-manifest.json
    - skills/larry-personality/SKILL.md

key-decisions:
  - "Dominant-design keyword branch sits between ACE context and ACE keyword in the mode ladder, so a ch04-shaped tell outranks a bare ACE lexicon hit but never outranks an explicit ACE signal or ACE problem-state context (B7 regression suite)."
  - "data/harness-manifest.json regenerated alongside connector-registry.json and brain-orchestration-projection.json (Rule 3): it digests both files and went stale as a direct, in-scope consequence of Task 2's registry regen, not a peer's pre-existing drift."

requirements-completed: [R1, R2, R3, R4, R5]

duration: single session
completed: 2026-09-23
---

# Quick Task 260923-u8v: Teach Larry When to Reach for Dominant Design Summary

**SENS-09 gained a Theo-ch04 keyword classifier (ferment/locked/convergence) that routes a dominant-design-shaped turn to /mos:dominant-designs through the existing dispatchSensors -> dispatch-map -> commandsForFramework path, and Larry's SKILL.md gained the matching doctrine section, both pinned by a 67-assertion RED-then-GREEN test.**

## Performance

- **Tasks:** 3/3 completed
- **Files modified:** 8 (1 test file created, 7 existing files modified)
- **Completed:** 2026-09-23

## Accomplishments

- SENS-09 (`lib/core/sensors/sensor-diffusion-adoption.cjs`) now exports `classifyDominantDesign`, `DOMINANT_DESIGN_CUES`, and `DOMINANT_DESIGN_STATES`, classifying a turn as `ferment`, `locked`, or `convergence` against ten Theo ch04 tell families, with nine near-miss phrases proven to NOT fire (adjacency and word-boundary discipline: "predominant designation" never matches `dominant design`, "design team keeps cracking jokes" never matches the crack-word adjacency rule, "which one wins" never matches without a named architecture/design/standard/format/body noun).
- The branch reuses the sensor's own frozen `brain_consult` reach and the `dominant-design` dispatch handle, which the existing `data/dispatch-framework-map.json` now translates to the exact framework name `Dominant Design`, resolved by the existing (unmodified) `commandsForFramework` to `/mos:dominant-designs`. No new sensor, no new reach id, no second selection brain.
- Precedence proven live (B7): ACE signal and ACE problem-state context still win outright; the dominant-design branch outranks only the ACE keyword fallback (a directed-energy-weapons turn that would have routed to generic `adoption-capacity` now correctly routes to `dominant-design`); the existing BCH-S5 turn-stage gate suppresses it in turns 1-2 for free, since it reuses `brain_consult`.
- `commands/dominant-designs.md` now claims `sensor_triggers: [SENS-06, SENS-09]` (mirroring the `/mos:analyze-timing` precedent); `data/connector-registry.json` and `data/brain-orchestration-projection.json` regenerated to carry the SENS-09 wiring; the desensitized `skills/dominant-designs/SKILL.md` mirror stays byte-unchanged (`sensor_triggers: []`).
- `lib/core/sensors/sensor-priority.cjs`'s SENS-09 counter-metric record is now honest: `optimizes` and `watched_by` name both the ACE and Dominant Design routes instead of claiming everything routes to ACE.
- `skills/larry-personality/SKILL.md` gained `### When to reach for Dominant Design (/mos:dominant-designs)`, placed after Reach rule 7e and before "Operating the components", naming: the Theo ch04 source, the Un-Defined/Ill-Defined rung, the PEST -> S-Curve Analysis -> Dominant Design -> Reverse Salient Analysis sequence, the era-of-ferment and locked-design tell bullets, the S-curve payoff, the quick-pass-first / research-behind-the-query-gate / never-auto-run / unattended-quick-pass doctrine (361 D-03, D-12), the SENS-09/turn-stage/resolver surfacing mechanics, and the corrected Theo graph note (two missing FEEDS_INTO edges, Theo Phase 20.3, never claiming Dominant Design lacks any problem-type or FEEDS_INTO edge). jsagi-e0's reserved spans (Operating the Dial item 5, the Voice Signature paragraph) are untouched -- confirmed by a single-hunk, all-additions diff.
- `tests/test-quick-260923-u8v-dominant-design-reach.cjs`: 67 assertions across four groups, RED on the pre-change tree (13 Group A fails on the missing SKILL section, 45 Group B fails on the missing sensor branch/exports, 3 Group C fails on the missing connector wiring, 1 Group D fail on the dishonest counter-metric), GREEN after Task 2 (Groups B/C/D, Group A still RED as designed) and GREEN across all four groups after Task 3.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED test pinning the Dominant Design reach** - no commit (plan explicitly withholds the commit until the test file is staged alongside Task 3's SKILL.md change)
2. **Task 2: SENS-09 learns the Theo ch04 tells, dispatch map, connector claim, registries regenerated** - `8c6771ef5` (feat)
3. **Task 3: SKILL section teaching Larry when to reach for Dominant Design** - `5fffa21d6` (docs)

No separate plan-metadata commit: this is a `.planning/quick/` task, and per the shared-tree protocol the PLAN/SUMMARY docs are committed by the quick workflow (`git add -f`), not by these task commits.

## Task 1 RED Output (captured on the pre-change tree)

```
Group A: 0 pass, 13 fail
Group B: 4 pass, 45 fail
Group C: 1 pass, 3 fail
Group D: 0 pass, 1 fail

FAIL 62 of 67
```

Representative failures and the two proven-live negatives, exactly as the plan's acceptance criteria named them:

```
FAIL - A1 section heading exists with a body: section heading not found: ### When to reach for Dominant Design (/mos:dominant-designs)
FAIL - B2 resolver path: dominant-design -> Dominant Design -> allowlist -> commandsForFramework: dispatch-framework-map.json has no dominant-design -> Dominant Design entry yet
FAIL - C1 commands/dominant-designs.md claims SENS-06 and SENS-09: assertion returned false
FAIL - C2 connector-registry.json has SENS-09 wired to /mos:dominant-designs: connector.sensor_triggers is ["SENS-06"]
FAIL - C3 brain-orchestration-projection.json node carries SENS-09: node.sensor_triggers does not include SENS-09
FAIL - D1 SENS-09 counter-metric record names Dominant Design honestly: optimizes does not name Dominant Design: the count of diffusion-adoption reaches routed to ACE
ok - B3 unrelated turn (sourdough bread) surfaces no dominant-design or SENS-09 reach
ok - B7.1 ACE keyword still fires adoption-capacity (dual-use drone swarm, no dominant-design tell)
```

## Final GREEN Tally (after Task 3)

```
Group A: 13 pass, 0 fail
Group B: 49 pass, 0 fail
Group C: 4 pass, 0 fail
Group D: 1 pass, 0 fail

PASS 67 assertions
```

## Files Created/Modified

- `tests/test-quick-260923-u8v-dominant-design-reach.cjs` - RED-then-GREEN pin for the SKILL section, the SENS-09 branch, the resolver path, and the connector wiring (67 assertions, four groups)
- `lib/core/sensors/sensor-diffusion-adoption.cjs` - adds the DOMINANT DESIGN BRANCH: `classifyDominantDesign`, `DOMINANT_DESIGN_CUES`, `DOMINANT_DESIGN_STATES`, and the mode-ladder insertion between ACE context and ACE keyword
- `lib/core/sensors/sensor-priority.cjs` - SENS-09 counter-metric record and Group C header comment made honest about the dual route
- `data/dispatch-framework-map.json` - adds `"dominant-design": "Dominant Design"`
- `commands/dominant-designs.md` - `sensor_triggers` now claims `[SENS-06, SENS-09]`
- `data/connector-registry.json` - regenerated (SENS-09 wired to `/mos:dominant-designs`)
- `data/brain-orchestration-projection.json` - regenerated (SENS-09 in the node's `sensor_triggers` and `chain_provenance.firing_sensors`)
- `data/harness-manifest.json` - regenerated (digests connector-registry.json and brain-orchestration-projection.json; went stale as a direct consequence of the above two)
- `skills/larry-personality/SKILL.md` - new `### When to reach for Dominant Design (/mos:dominant-designs)` subsection

## Decisions Made

- The dominant-design keyword branch is inserted strictly between the ACE context tier and the ACE keyword tier in `sensorDiffusionAdoption`'s mode ladder (never before ACE signal/context, always before ACE keyword/marker). This is what makes B7's four-part precedence regression suite pass: ACE signal and ACE problem-state context still win outright over a ch04 tell, while a bare ACE lexicon hit (e.g. "weapon", "drone") no longer masks a genuine dominant-design read.
- `data/harness-manifest.json` was added to Task 2's commit even though it is not in the plan's `files_modified` list. It digests `data/connector-registry.json` and `data/brain-orchestration-projection.json`; regenerating those two (as Task 2 requires) makes the manifest's committed digests stale, and the repo's pre-commit hook hard-fails on that staleness. This is a Rule 3 auto-fix (a blocking issue caused directly by this task's own in-scope change, not a peer's pre-existing dirty state -- confirmed by diffing the freshly-built manifest against the committed one before regenerating: the only two lines that differed were the two digests this task's own registry regen changed).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Regenerated data/harness-manifest.json**
- **Found during:** Task 2, at the `git commit --only` step
- **Issue:** The pre-commit hook hard-failed with "STALE: data/harness-manifest.json diverges from the regenerated manifest" after `connector-registry.json` and `brain-orchestration-projection.json` were regenerated per the plan's Step 5.
- **Fix:** Verified the staleness was caused by this task's own change (built the manifest in-memory via `require('./scripts/build-harness-manifest.cjs').buildManifest()` and diffed it against the committed file before touching anything -- only the two digests for the connector-registry.json/brain-orchestration-projection.json map entries differed, both a direct consequence of Task 2's own regen, not a peer's dirty state), then ran `node scripts/build-harness-manifest.cjs` and staged the result.
- **Files modified:** data/harness-manifest.json
- **Verification:** `node scripts/build-harness-manifest.cjs --check` reports OK; the commit then succeeded.
- **Committed in:** `8c6771ef5` (Task 2 commit)

**2. [Rule 1 - Bug] Fixed a false-positive leaked-prose check in the quick test's own B8 assertion**
- **Found during:** Task 2, first post-implementation run of the quick test
- **Issue:** B8 (`JSON.stringify(reach)` must not contain "e-bike" or "frame") was written as a literal full-object JSON scan. The legitimate generic evidence key `"framework"` contains the substring "frame" (`framework` = f-r-a-m-e-w-o-r-k), so the check false-failed against correct, Part-8-compliant output.
- **Fix:** Rewrote the check to scan only the reach's string VALUES (`reach_id`, `posture`, `dispatch`, `signal`, and `Object.values(evidence)`), never the JSON keys, so the field name "framework" cannot self-trigger the leaked-prose scan.
- **Files modified:** tests/test-quick-260923-u8v-dominant-design-reach.cjs
- **Verification:** B8 now passes against the real implementation's evidence object, and would still correctly fail if the raw turn text ("e-bike", "frame design") ever leaked into a value.
- **Committed in:** `5fffa21d6` (Task 3 commit, since the test file's own commit was withheld until Task 3 per the plan)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug in the test harness itself)
**Impact on plan:** Both were necessary corrections with no scope creep: the manifest regen is a required gate the plan's own registry regen made stale, and the B8 fix corrects a test bug (not an implementation bug) discovered while verifying the implementation was actually correct.

## Pre-existing REDs (before and after, must stay identical)

| Test | Before | After |
|---|---|---|
| `tests/test-205-sens10-circularity.cjs` | FAIL ("SENS-10 is the LAST registry entry") | FAIL, identical |
| `tests/test-237-session-scope.cjs` | FAIL (Leg 4, "Cannot find module './sensors/sensor-content-relevance.cjs'") | FAIL, identical |
| `tests/test-connector-part8-boundary.cjs` | FAIL (CHECK 2, "connector mcp:artifact_file carries off-schema field 'layer'") | FAIL, identical |
| `scripts/check-first-touch-drift.cjs` | 1 hit (README.md:192, pattern 3) | 1 hit, identical |

## Findings for the Record (not fixed in this plan, by design)

- **Dormant `ctx.firingSensors` bonus:** `lib/core/reader/decide-projection-reader.cjs`'s `sensor_triggers` bonus (+10000) only applies when `ctx.firingSensors` is passed to the reader, and nothing in production threads that argument today. The live surfacing path this quick task actually wired is the dispatch handle -> `data/dispatch-framework-map.json` -> `commandsForFramework` (`skills/intelligence-orchestrator/SKILL.md` STEP 2 and STEP 5), proven live by B1/B2/B6 in the quick test. The connector claim (R3, Group C) is still correct and made for registry honesty and for the day that bonus is wired -- not fixed here, out of scope.
- **`lib/core/insight-sensors.cjs` SENS-09 comments still say "-> ACE"** (line 747: `Phase 170 detector (SENS-09 -- dual-use diffusion/adoption -> ACE)`). Left untouched on purpose: the plan scoped comment refreshes there as out of it (a shared hot file), naming `lib/core/sensors/sensor-diffusion-adoption.cjs`'s own docblock as the doc of record for the dominant-design branch, which now carries the correct, current explanation.
- **Theo's own ROADMAP for Phase 20.1 did not yet list the two missing FEEDS_INTO edges (S-Curve Analysis -> Dominant Design, Dominant Design -> Reverse Salient Analysis) at planning time.** The SKILL.md note names the fix as Theo Phase 20.3 per the orchestrator's correction applied to this plan; confirming that edge-add actually lands is Theo-side scope, not this quick task's.
- **Tri-Polar:** the sensor change runs in `lib/core`, so both the CLI hooks path and the MCP `suggest-next` path share the new dominant-design branch identically -- no surface-specific code was needed. Desktop and Cowork run `/mos:dominant-designs`'s deep dive without web research per the command's own existing Tri-Polar table (unchanged by this plan); the SKILL.md doctrine section applies to all three surfaces equally since Larry's personality skill is not surface-scoped.
- **Jev/TypeSafe dev-time scoring (NAV-3) is explicitly out of scope** for this quick task, named as a separate follow-up in the plan's own context section.
- **Not live yet:** this change ships to users only once the next MindrianOS release is cut (`scripts/release.sh`) and picked up (`claude plugin update`), per the repo's standing "not live until released AND picked up" rule. No release was cut as part of this quick task.

## Issues Encountered

None beyond the two auto-fixed deviations above.

## Next Phase Readiness

- SENS-09's dominant-design branch, the connector claim, and the SKILL doctrine are all committed and self-verified; no further work is required for this quick task's own scope.
- The dormant `ctx.firingSensors` bonus and the Theo-side FEEDS_INTO edge-add (Theo Phase 20.3) are named findings for whoever picks up that follow-up work next; neither blocks this task's completion.

## Self-Check: PASSED

- `tests/test-quick-260923-u8v-dominant-design-reach.cjs` -- FOUND (committed in `5fffa21d6`)
- `lib/core/sensors/sensor-diffusion-adoption.cjs` DOMINANT_DESIGN exports -- FOUND (`classifyDominantDesign`, `DOMINANT_DESIGN_CUES`, `DOMINANT_DESIGN_STATES` all present in `module.exports`)
- `data/dispatch-framework-map.json` `"dominant-design": "Dominant Design"` -- FOUND
- `commands/dominant-designs.md` `sensor_triggers: [SENS-06, SENS-09]` -- FOUND
- `skills/larry-personality/SKILL.md` `### When to reach for Dominant Design (/mos:dominant-designs)` -- FOUND
- Commit `8c6771ef5` -- FOUND in `git log --oneline`
- Commit `5fffa21d6` -- FOUND in `git log --oneline`
- `node tests/test-quick-260923-u8v-dominant-design-reach.cjs` -- PASS 67 assertions, exit 0
- `node tests/test-reach-ids-drift.cjs` (post-commit, reads HEAD) -- PASS
- All five gates (`build-connector-registry --check`, `build-orchestration-projection --check`, `build-command-registry --check`, `build-skill-mirrors --check`, `check-render-coverage`) -- OK
- All 26 named regression tests across Tasks 2 and 3 -- OK, no new failures
- Four pre-existing REDs -- identical before/after

---
*Quick task: 260923-u8v*
*Completed: 2026-09-23*
