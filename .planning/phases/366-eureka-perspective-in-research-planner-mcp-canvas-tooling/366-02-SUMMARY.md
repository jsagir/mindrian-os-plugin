---
phase: 366-eureka-perspective-in-research-planner-mcp-canvas-tooling
plan: 02
subsystem: research-planner
tags: [eureka, pyramid, filing, verification-stamp, opportunity, perspective-pair]
requires:
  - 366-01 (tests/helpers/fixture-366.cjs buildPerspectiveRoom, tests/run-all-366.sh leg)
provides:
  - pyramid kind cross_domain_transfer and the closed leaf pair {a, b, perspective, run_tag} in the plan hash
  - one generic, template-driven pair branch in opportunityCandidates (pairLeafSupported predicate)
  - lib/core/research-planner/filing-stamped.cjs (fileStampedOpportunity, readPwsStage, sourcedFromTarget, stampForPair, pairKey)
  - filing.cjs files any pair candidate with the 355 stamp props and DERIVED_FROM to pair.a and pair.b
affects: [366-04 (rs/hsi/analogies/connections templates reuse the pair branch), 366-07 (switch ambient-run to filing-stamped), 366-15 (theo-lane.json seam read by stampForPair)]
tech-stack:
  added: []
  patterns:
    - one generic pair branch keyed on template opportunity_rules (no per-perspective pyramid branch)
    - stamp merge at filing, synchronous and tool-free (stampForPair)
key-files:
  created:
    - lib/core/research-planner/filing-stamped.cjs
    - tests/test-366-eureka-filing.cjs
  modified:
    - lib/core/research-planner/pyramid.cjs
    - lib/core/research-planner/perspectives/eureka-recall.cjs
    - lib/core/research-planner/filing.cjs
    - scripts/eureka-portfolio-report.cjs
    - tests/test-363-pyramid.cjs
decisions:
  - "The generic pair branch reads only pairLeafSupported (rolled status supported, no supported <prefix>:already_known leaf on the same pair or with no pair); dedicated literature_gap, constraint_attack and trend_break branches skip pair-carrying leaves"
  - "The final dedupe key is kind + leaf_ids + limiter_id + funder + program, so two limiters or two funders on one leaf are not collapsed"
  - "stampForPair with both handles resolved and no lane stamp returns unverified / not_called / handle_unresolved, because the Stamp schema admits not_called only with handle_unresolved (no invented reason)"
  - "stampForPair reads theo-lane.json from the planner run state dir (.mindrian/research-runs/<run_id>) and then the filed run home, each realpath-contained in the room"
  - "engine_mode at planner filing is 'ambient' for an ambient-triggered run, else 'navigator'"
  - "A filed pair carries props.evidence_ids [a, b] so the eureka exclusion set never recalls it again"
metrics:
  duration: ~50min
  completed: 2026-10-01
  tasks: 2
  files: 7
---

# Phase 366 Plan 02: Eureka filing wire and the one stamped filer Summary

A supported eureka pair now reaches the F.8 basket as a `cross_domain_transfer` item, through one generic pair branch that every perspective template reuses. Approving the item files one proposed candidate opportunity carrying the 355 stamp, with DERIVED_FROM edges to both things and the run home. The planner now owns the only stamped filer (`filing-stamped.cjs`), and the runner re-exports it.

## What was built

- **pyramid.cjs**
  - `cross_domain_transfer` is appended last to `OPPORTUNITY_KINDS`.
  - `normalizeLeaf` copies a closed `pair` through `closedPair`: four string fields of at most 200 chars each, and any extra key is dropped. Because the pair is on the leaf, it enters the plan hash.
  - `opportunityCandidates` has one generic pair branch. It iterates the template's (and the lens templates') `opportunity_rules` and emits `{kind, leaf_ids, row_ids, pair, reason}` for each researchable pair leaf on `rule.dimension` that passes `pairLeafSupported`.
  - The dedicated branches skip pair-carrying leaves. A limiter whose only leaves carry pairs is left to the generic branch.
  - A final dedupe runs before the existing sort.
- **eureka-recall.cjs**: leaves carry `pair: {a, b, perspective: 'eureka', run_tag}` and a separate `lanes` array. No `.candidate` reader existed under lib/, scripts/ or tests/. `runRecall` passes its tag into `questionSetFor`.
- **filing-stamped.cjs** (new): `fileStampedOpportunity`, `readPwsStage` and `sourcedFromTarget` were moved here with their behavior unchanged. Also new here:
  - `stampForPair(pair, ctx)` is synchronous, never throws and makes zero tool calls. It reads the carried fields from room.db (framework, methodology, title) and resolves them with `verificationStamp.resolveEndpoint`.
  - `pairKey` and the `THEO_LANE_*` constants.
- **scripts/eureka-portfolio-report.cjs**: the three functions are replaced by a re-export through `REPO_ROOT`. `bankStatements` and `lib/core/ambient-run.cjs` resolve the same function objects as before.
- **filing.cjs**: for any candidate carrying `pair`, filing now:
  - merges `toNodeProps(stampForPair(...))`, `pws_stage`, `engine_mode`, `pair_perspective` and `evidence_ids` into extraProps;
  - adds the pair ends to the stage-history evidence ids;
  - writes `DERIVED_FROM` to `cand.pair.a` and `cand.pair.b` next to the run home edge.

  There is no network call anywhere in this path.
- **tests/test-366-eureka-filing.cjs**: legs F1-F9, all on the planted 366 fixture, plus checks for zero network attempts and zero Theo calls. Theo calls are counted by a spy on `brain-client.callTool`.
  - F7-F9 drive the real planner path: recall, `buildPlan`, a replayed `settled` verdict through `rollUp` and `opportunityCandidates`, `run.json`, `basketFor`, and then `fileFromState` with an approved selection.
  - F8 also shows that a filed pair is excluded from the next recall.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 (RED) | bb5265d2f | test(366-02): add failing eureka filing legs F1-F3 for the pair branch |
| 1 (GREEN) | 80015acd9 | feat(366-02): add cross_domain_transfer kind and the generic pair branch |
| 2 | 81320ec34 | feat(366-02): one stamped filer in the planner; filing writes pair edges and stamp |

## Verification

- `node tests/test-366-eureka-filing.cjs`: PASS 20, FAIL 0 (F1-F9, zero network attempts, zero Theo calls)
- `node tests/test-363-pyramid.cjs`: 21/0. `node tests/test-363-filing.cjs`: 51/0. `node tests/test-355-filing.cjs`: 43/0. `node tests/test-seed103-eureka-perspective.cjs`: 39/0. `node tests/test-3551-ambient-run.cjs`: PASS (18 checks)
- `bash tests/run-all-363.sh`: PASSED=43 FAILED=0 SKIPPED=1 KNOWN=10
- `node scripts/check-substrate.cjs --diff`: exit 0
- `LC_ALL=C bash tests/run-all-366.sh`: PASSED=37 FAILED=0 SKIPPED=28 KNOWN=1

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Dedupe on kind + leaf_ids alone would collapse funding signals and limiters**
- **Found during:** Task 1
- **Issue:** Two funding signals with different funders on the same leaf, or two limiters sharing a leaf, have the same kind + leaf_ids. The plan's guard would drop one of them.
- **Fix:** The dedupe key also includes `limiter_id`, `funder` and `program`.
- **Commit:** 80015acd9

**2. [Rule 1 - Bug] A limiter whose leaves all carry a pair would emit an empty constraint_attack**
- **Found during:** Task 1
- **Issue:** Adding `!l.pair` to the limiter leaf filter left a limiter with `leaf_ids: []` that would still emit.
- **Fix:** Such a limiter is skipped, and the generic branch owns its leaves. Limiters whose matched leaves carry no pair behave exactly as before.
- **Commit:** 80015acd9

**3. [Rule 2 - Missing critical] A filed pair would be recalled again as new**
- **Found during:** Task 2
- **Issue:** The eureka exclusion set (ADR-E14) reads `props.evidence_ids` of opportunity nodes. `writeOpportunityNode` keeps `evidence_ids` only in stage_history, so a filed pair would come back in the next recall.
- **Fix:** Pair candidates carry `extraProps.evidence_ids = [a, b]`. Leg F8 shows the pair is excluded after filing.
- **Commit:** 81320ec34

**4. [Rule 2 - Missing critical] trend_break branch also skips pair leaves**
- **Found during:** Task 1
- **Issue:** The plan named only the literature_gap and constraint_attack branches. The trend_break branch is also a dedicated leaf branch and could double-emit for a pair leaf on `df:timing`.
- **Fix:** It now filters out pair-carrying leaves too.
- **Commit:** 80015acd9

### Interpretations

- **The stamp when both handles resolve but no lane stamp exists.** The plan says to use the matrix's not-called literal. The Stamp schema (verification-stamp.cjs) allows backend `not_called` only with reason `handle_unresolved`, so that is the stamp returned. It is built through `Stamp.parse`. This is the one place the reason text is imprecise (both handles did resolve). Plan 366-15's lane replaces it with a real stamp.
- **Where "run home" points.** Theo lane results are written during the run, before the research/ run home exists. `stampForPair` therefore looks first in `.mindrian/research-runs/<run_id>/` and then in the filed run home. Each path is realpath-contained in the room, and a malformed file or a file outside the room is skipped (F6). Plan 366-15 should write `theo-lane.json` into the run state dir.
- **engine_mode.** The runner has no value for a navigator run (it defaults to 'unknown'; ambient passes 'ambient'). Planner filing writes `run.trigger === 'ambient' ? 'ambient' : 'navigator'`.

## TDD Gate Compliance

Task 1 followed RED (bb5265d2f, 10 of 13 checks failing, with the goldens confirmed on the pre-edit code) and then GREEN (80015acd9). For Task 2, legs F4-F9 were written after `filing-stamped.cjs` and committed together with the implementation in 81320ec34, so Task 2 has no separate RED commit.

## Known Stubs

None.

## Threat Flags

None. The `theo-lane.json` read (T-366-08) is in the threat model and is mitigated by realpath containment plus a fallback to the degraded stamp. No new network surface was added.

## Self-Check: PASSED

- FOUND: lib/core/research-planner/filing-stamped.cjs, tests/test-366-eureka-filing.cjs
- FOUND commits: bb5265d2f, 80015acd9, 81320ec34
