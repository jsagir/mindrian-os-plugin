---
phase: 392-part-8-problem-shape-packet-measure-close-the-six-bypasses-s
plan: 02
subsystem: part8-egress
tags: [part8, vocabulary, closed-enum, drift-test, route-matrix, theo, shape-packet]

# Dependency graph
requires:
  - phase: 354 (plan 10)
    provides: the Theo-cased rung ids in rung-vocabulary.cjs and the guard TAXONOMY_RUNGS
  - phase: 212
    provides: data/eureka-critic-tags.json domain_tags (the 11 critic tags)
  - phase: Theo 48 (plan 48-01, Theo HEAD fbf1bf8a)
    provides: src/mcp/content/shape-packet.ts with the five enums as readonly tuples
provides:
  - data/brain-shape-vocabulary.json, the one closed vocabulary of the Part 8 problem shape (D-01, D-02)
  - tests/test-392-vocabulary-drift.cjs, pins every plugin list to the file and compares Theo's five enums
  - tests/test-392-theo-route-matrix.cjs plus the beta.81 fixture, pins the F6 bypass 5 matcher gap
affects: [392-06 matcher widening, 392-08 packet builder, 392-12 stage routing, Theo 48]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One vocabulary file, one drift test: every other list is pinned to the file or named retired through legacy_stage_map"
    - "Record-then-pin fixture: a --record flag writes the matrix from the live matchers; the plain run fails on any drift"
    - "Provider cross-check by source-text regex on a read-only Theo checkout, named SKIP when absent (test-354 precedent)"

key-files:
  created:
    - data/brain-shape-vocabulary.json
    - tests/test-392-vocabulary-drift.cjs
    - tests/test-392-theo-route-matrix.cjs
    - tests/fixtures/392-part8-replay/route-matrix.json
  modified: []

key-decisions:
  - "legacy_stage_map proposals for 392-12: pre_opportunity Phase1, thesis_build Phase2, validation Phase3, execution Phase5, unknown Phase0, discovery Phase2; retired: scale, ideation, problem-fit, growth, scaling"
  - "VALID_STAGES is read from the model-profiles.cjs source text, not exported; model-profiles.cjs is outside this plan's files"
  - "No domain_tag candidate from the rooms: no STATE.md carries a domain, industry or sector key; the list stays at the 11 critic tags"

patterns-established:
  - "Vocabulary drift test: compare as a set where the source is a Set, in order where the source is an array"
  - "Route matrix: anchored ^...$ regular expressions over the unanchored hooks.json matcher strings"

requirements-completed: [392-SC3, 392-SC2]

# Metrics
duration: 14min
completed: 2026-11-08
---

# Phase 392 Plan 02: Shape vocabulary and gap pins Summary

**One closed-enum vocabulary file (schema_version 1) pinned by a 89-check drift test that also matches Theo's five shape-packet.ts enums, plus a committed beta.81 route matrix that shows 9 unseen mcp__theo* tool names before plan 392-06 closes the gap.**

## Performance

- **Duration:** about 14 min
- **Started:** 2026-11-08T09:31Z (approximate, first read)
- **Completed:** 2026-11-08T09:45Z
- **Tasks:** 2 of 2
- **Files created:** 4
- **Files modified:** 0

## Accomplishments

- data/brain-shape-vocabulary.json holds problem_type, stage (Phase0..Phase5), stage_map (D-01), role, role_map, domain_tag (exactly the 11 critic tags), constraint_categories (the 9 D-02 members), problem_type_aliases and legacy_stage_map. 65 lines, 0 em dashes, no room, product or person name.
- The drift test pins every list of F10 to that file and cross-checks Theo. With the Theo checkout present: 89 checks, 0 failed, 0 skips. Without it (MINDRIAN_THEO_CHECKOUT pointed at a missing directory): 75 checks, 0 failed, 2 named SKIPs.
- A one-member mutation (drop the last domain_tag) fails the test on legs V5 and V7 and names the list; the file was restored and the committed file is unchanged.
- The route matrix fixture records 20 tool names with hook_sees, post_sees and shaped_sees from the three live matchers; the beta.81 gap is visible (state beta81_gap, guard_head 196a5a68b).

## Task Commits

1. **Task 1 RED: drift test** - `cd16498ff` (test)
2. **Task 1 GREEN: vocabulary file, VALID_STAGES source read** - `ac1a5074d` (feat)
3. **Task 2 RED: route matrix test** - `196a5a68b` (test)
4. **Task 2 GREEN: beta.81 fixture** - `fe0ab866f` (feat)

Plan metadata (this SUMMARY): see the final commit on the branch.

## RED lines (recorded)

Task 1, before the vocabulary file existed:

```
  FAIL [V0] data/brain-shape-vocabulary.json is missing at /home/jsagi/dev/MindrianOS-Plugin/data/brain-shape-vocabulary.json
FAIL: test-392-vocabulary-drift (vocabulary file missing)
exit=1
```

Task 2, before the fixture existed:

```
  FAIL [R0] fixture missing at tests/fixtures/392-part8-replay/route-matrix.json (run with --record --state <text> to create it)
FAIL: test-392-theo-route-matrix (fixture missing)
exit=1
```

## Drift test result per list

| Leg | List | Source | Result |
|-----|------|--------|--------|
| V1 | problem_type | lib/core/part8-egress-guard.cjs TAXONOMY_RUNGS (Set) | agrees (set) |
| V1 | problem_type | lib/core/brain-client.cjs THEO_RUNG_SET (Set) | agrees (set) |
| V1 | problem_type | lib/core/strategy/rung-vocabulary.cjs THEO_RUNGS, isTheoRung | agrees (set); every member accepted, 6 non-members rejected |
| V1 | problem_type | Theo src/mcp/content/vocabulary.ts PROBLEM_TYPE_IDS | agrees, order included |
| V2 | stage | D-01 (Phase0..Phase5) | pinned |
| V3 | stage_map | lib/core/model-profiles.cjs VALID_STAGES (5, source text) | keys agree as a set; every value a stage member; Phase0 not a target |
| V4 | role | lib/core/user-md-ops.cjs role_blend axes (7, source text) | agrees, order included |
| V4 | role_map | lib/core/persona-taxonomy.cjs ROLE_BLEND_AXES (7) | every axis has one entry; the 7 values cover role once each |
| V5 | domain_tag | data/eureka-critic-tags.json domain_tags (11) | agrees, order included |
| V6 | constraint_categories | D-02 (9 members) | pinned |
| V8 | problem_type_aliases | persona-taxonomy PROBLEM_TYPES (UDP, IDP, WDP, unknown) | UDP UnDefined, IDP IllDefined, WDP WellDefined; unknown has no alias; Wicked has no alias |
| V9 | legacy_stage_map | persona-taxonomy VENTURE_STAGES (6) | every member has an entry; retired: scale |
| V10 | legacy_stage_map | lib/mcp/brain-router.cjs venture_stage inference words (7) | the 7 words pinned; every word has an entry; retired: ideation, problem-fit, growth, scaling |
| V11 | the 5 enums | ^[A-Za-z][A-Za-z0-9_]*$, no duplicate | pass |

Retired legacy stages (printed by the test): scale, ideation, problem-fit, growth, scaling.

Live legacy stages routed through a Phase id (a proposal for plan 392-12, the owner may change it): pre_opportunity Phase1, thesis_build Phase2, validation Phase3, execution Phase5, unknown Phase0 (the cold-start sentinel equals a room with no venture_stage), discovery Phase2. Source for the Phase meaning: Theo .theo-graph/build_graph.py PHASES (Phase1 Un-Defined, Phase2 Ill-Defined, Phase3 Wicked, Phase4 Well-Defined, Phase5 Build the Innovation).

## Theo cross-check (compared, not skipped)

Theo checkout /home/jsagi/Theo, branch main, HEAD fbf1bf8a. src/mcp/content/shape-packet.ts exists (plan 48-01 landed). The plan's context line that the file is "absent until that plan runs" is stale; the test read the file and compared.

| Theo export | Members | Equal to the vocabulary list, order included |
|-------------|---------|----------------------------------------------|
| PROBLEM_TYPE_IDS (vocabulary.ts, imported by shape-packet.ts) | 4 | yes |
| STAGE_IDS | 6 | yes |
| ROLE_IDS | 7 | yes |
| DOMAIN_TAG_IDS | 11 | yes |
| CONSTRAINT_CATEGORY_IDS | 9 | yes |
| SHAPE_SCHEMA_VERSION | 1 | equals schema_version |

## domain_tag candidates from the rooms (SUMMARY only, not applied)

Read locally only: the frontmatter of 34 ~/MindrianRooms/*/STATE.md files (40 room directories) and $HOME/.mindrian/scout-cadence. No STATE.md frontmatter carries a domain, industry or sector key (keys present: venture_stage, total_entries, computed, gsd_state_version, current_room, status). The scout-cadence directory holds only last-run timestamp files (25 bytes each), no scout records.

Result: no candidate passes the filter. The candidate list is empty. domain_tag stays at the 11 critic tags. A later owner-approved addition bumps schema_version in both repos.

Side fact (counts only): venture_stage values across the 34 files are Investment 19, Pre-Opportunity 11, Design 3, Validation 1; all are VALID_STAGES members and all map through stage_map.

## Route matrix (beta.81, state beta81_gap)

All three matchers are the same string on beta.81:
`mcp__(?:(?:plugin_[a-z0-9_-]+_)?(?:mindrian-brain|pws-brain-mcp)__.*|[a-z0-9_-]+__brain_[a-z0-9_]+)`

| Tool name | hook_sees | post_sees | shaped_sees |
|-----------|-----------|-----------|-------------|
| mcp__plugin_mos_mindrian-brain__brain_ask | true | true | true |
| mcp__mindrian-brain__brain_search | true | true | true |
| mcp__theo__brain_ask | true | true | true |
| mcp__theo__search | false | false | false |
| mcp__theo__search_theo_chunks_fulltext | false | false | false |
| mcp__theo__text2cypher | false | false | false |
| mcp__theo__recommend_chain | false | false | false |
| mcp__theo__classify_problem_type | false | false | false |
| mcp__theo__case_story | false | false | false |
| mcp__theo__room_bind | false | false | false |
| mcp__theo-context__canon_search | false | false | false |
| mcp__theo-context__normalize_framework_name | false | false | false |
| mcp__claude_ai_Theo-Claude__canon_search | false | false | false |
| mcp__claude_ai_Theo-Claude__framework_route | false | false | false |
| mcp__claude_ai_theo-claude__canon_search (lowercase) | false | false | false |
| mcp__claude_ai_PWS_Brain__brain_ask | false | false | false |
| mcp__claude_ai_PWS_brain__brain_ask (lowercase) | false | false | false |
| mcp__pws-brain-mcp__brain_ask | true | true | true |
| mcp__pws-brain-mcp__search | true | true | true |
| mcp__notion__search (control) | false | false | false |

Gap rows: 9 mcp__theo* names unseen (7 mcp__theo__ non-brain_* plus 2 mcp__theo-context__); 5 claude_ai names unseen (the uppercase connector key falls outside the lowercase class, and the lowercase variants fail too because `theo-claude` does not end in `__brain_*`, and `PWS_brain` still carries uppercase). mcp__pws-brain-mcp__* is still seen (plan 392-06 retires it). Plan verify one-liner printed `gap rows 7`.

## Decisions Made

- legacy_stage_map values (see above) are proposals; plan 392-12 routes or removes them. The test accepts any Phase id or "retired", so a later change is one edit in the file.
- The drift test compares Sets as sets and arrays in order, so a reorder of a Set-backed source does not fail, while a reorder of Theo's tuples or the critic tags does.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] VALID_STAGES is not exported by lib/core/model-profiles.cjs**
- **Found during:** Task 1 (first GREEN run: `TypeError: Cannot read properties of undefined (reading 'length')`)
- **Issue:** the plan says the test imports VALID_STAGES; beta.81 model-profiles.cjs exports MODEL_PROFILES, VALID_PROFILES, STAGE_HINTS, CASCADE_MODELS and 5 functions, not VALID_STAGES.
- **Fix:** the test reads the `const VALID_STAGES = [...]` literal from the source text (the same technique the plan prescribes for user-md-ops.cjs) and asserts 5 members. model-profiles.cjs is outside this plan's files_modified and was not edited.
- **Files modified:** tests/test-392-vocabulary-drift.cjs
- **Verification:** V3 passes; a mutation of the file fails V3.
- **Committed in:** ac1a5074d

**2. [Plan context stale] shape-packet.ts exists on Theo main**
- The plan's context line said the file is absent until Theo plan 48-01 runs. It exists at Theo HEAD fbf1bf8a. The test compared it (no SKIP). No code change; recorded here.

**Total deviations:** 1 auto-fixed (Rule 3), 1 stale-context note.
**Impact on plan:** none on scope; the test asserts the same facts through the source text.

## Issues Encountered

None beyond the deviation above.

## Verification

- `node tests/test-392-vocabulary-drift.cjs`: exit 0, Checks 89, Failed 0, Skips 0 (PROVEN).
- `MINDRIAN_THEO_CHECKOUT=/nonexistent-theo node tests/test-392-vocabulary-drift.cjs`: exit 0, Checks 75, Skips 2, both SKIP lines name the path (PROVEN).
- Mutation (last domain_tag removed, then restored): exit 1, Failed legs V5, V7 (PROVEN).
- `node tests/test-392-theo-route-matrix.cjs`: exit 0, Checks 25, Failed 0 (PROVEN).
- Plan verify one-liner: `gap rows 7`, exit 0 (PROVEN).
- `bash tests/run-all-386.sh`: PASS=37 FAIL=0 SKIP=0 (PROVEN).
- `node tests/test-354-taxonomy-ladder-casing.cjs`: Checks 15, Failed 0 (PROVEN).
- `grep -c "" data/brain-shape-vocabulary.json` = 65 (below 120); em dash count 0 in all 4 files (PROVEN).
- Room-slug scan: 0 hits of any ~/MindrianRooms directory name in the 4 committed files (PROVEN).
- `bash tests/run-all-392.sh` (peer 392-01 runner, glob tests/test-392-*): discovered 4 files; test-392-vocabulary-drift PASSED, test-392-theo-route-matrix PASSED, test-392-replay-harness PASSED (392-01), test-392-eureka-deadline FAILED (392-07, in its RED stage while this plan ran; not this plan's file) (PROVEN at 2026-11-08T09:47Z).

## Self-Check: PASSED

- FOUND: data/brain-shape-vocabulary.json
- FOUND: tests/test-392-vocabulary-drift.cjs
- FOUND: tests/test-392-theo-route-matrix.cjs
- FOUND: tests/fixtures/392-part8-replay/route-matrix.json
- FOUND: commits cd16498ff, ac1a5074d, 196a5a68b, fe0ab866f on work/part8-shape-packet
- SUMMARY em dash count 0; SUMMARY is under `.planning/*` (gitignore line 97), added with `git add -f`.

## Known Stubs

None. The vocabulary file carries no placeholder; legacy_stage_map "retired" is a declared state, not a stub.

## Threat Flags

None. No new network endpoint, auth path or schema at a trust boundary. Theo files were read with fs.readFileSync only.

## Next Phase Readiness

- Plan 392-08 builds the packet from data/brain-shape-vocabulary.json (stage_map, role_map, problem_type_aliases).
- Plan 392-06 widens the three matchers and rewrites tests/fixtures/392-part8-replay/route-matrix.json with `--record --state closed`; this test turns RED until the matchers change.
- Plan 392-12 routes the live legacy stages through stage_map and removes the retired ones; the drift test pins the list until then.
- STATE.md, ROADMAP.md and REQUIREMENTS.md were not edited (the orchestrator updates them per wave; plans 392-01 and 392-07 run in parallel on this branch).
