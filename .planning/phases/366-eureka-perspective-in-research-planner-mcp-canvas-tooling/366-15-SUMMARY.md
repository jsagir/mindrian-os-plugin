---
phase: 366-eureka-perspective-in-research-planner-mcp-canvas-tooling
plan: 15
subsystem: research-planner
tags: [connections, theo, lateral-path, grants, audit, corpus-theo, d-09, d-11, canon-part-8]
requires:
  - 366-02 (stampForPair reads <run home>/theo-lane.json keyed by pairKey)
  - 366-04 (CONNECTIONS template, cn.lateral and cn.known lenses)
  - 366-08 (perspective registry, shared.makeCandidateStore, eight-key substrate)
provides:
  - perspectives/connections-recall.cjs (lanes canon_pair, framework_walk; theo leaves; offline)
  - theo-lane.cjs (runTheoLane, theoLeavesOf)
  - grants.validateTheoCall, theoPairQ, theoPairHash, theoLeafSlots, THEO_PROVIDER, THEO_MAX_CALLS
  - corpus 'theo' accepted at every corpus site
  - truthful F.0 card for a run grant that names Theo
affects:
  - 366-16.. (the /mos:find-connections door and ambient offer can now build a runnable connections plan)
tech-stack:
  added: []
  patterns:
    - one consent check shared by the facade and the run (checkTheoLeaf in quick.cjs)
    - lane stamps recorded for the one filer, never merged at filing time
key-files:
  created:
    - lib/core/research-planner/perspectives/connections-recall.cjs
    - lib/core/research-planner/theo-lane.cjs
    - tests/test-366-recall-connections.cjs
    - tests/test-366-theo-lateral-lane.cjs
    - tests/fixtures/366-theo-lane/golden.json
  modified:
    - lib/core/research-planner/grants.cjs
    - lib/core/research-planner/quick.cjs
    - lib/core/research-planner/planner.cjs
    - lib/core/research-planner/plan.cjs
    - lib/core/research-planner/question-templates.cjs
decisions:
  - "A theo-only run grant names provider theo alone (not openalex): the plan has no OpenAlex search to approve, so the card and the grant do not claim OpenAlex"
  - "A plan with theo leaves is always approved as a run grant: reaskCard builds the run proposal even when no grant or a standing grant is active, because a standing grant can never reach Theo (this also keeps the SEED-104 loop guard from ever firing on a Theo plan)"
  - "The Theo F.0 card keeps card.title 'Research grant'; the heading line in body_md carries the Theo wording, and the options are approve_run and not_now only (a standing approval cannot cover Theo)"
  - "caps.max_theo_calls (min of theo leaf count and 8) is counted apart from OpenAlex max_searches"
  - "A theo-only plan's quick verdict comes from the lateral checks alone (settled / thin / unresolved) with its own answer line, and it offers no deep run"
  - "Row provider is skipped when a theo-only run fetched nothing"
metrics:
  tasks: 2
  files: 10
  completed: 2026-10-02
---

# Phase 366 Plan 15: Connections perspective and the Theo lateral-path lane Summary

Connections recalls offline over canon handles and local framework walks. The Theo lateral-path check is no longer an engine call: it is an audited planner lane that runs only under a run grant naming provider theo and the approved pair hash, sends canon framework names only, and records its stamps where the one filer reads them. A theo-only connections plan is now a runnable plan.

## Commits

| Step | Commit | Subject |
|------|--------|---------|
| Task 1 RED | 146e0eb34 | test(366-15): add failing connections recall legs X1-X6 |
| Task 1 GREEN | 11ac93770 | feat(366-15): connections recall over canon handles and framework walks, with theo leaves |
| Task 2 RED | c17fc92ee | test(366-15): add failing Theo lateral lane legs Y1-Y10 and the pre-edit grant golden |
| Task 2 GREEN | 69e5adb35 | feat(366-15): Theo lateral-path lane under a run grant, with the theo corpus at every site |

## What was built

- **connections-recall.cjs.** Reads the eight-key substrate through the eureka reader (consumed, not edited). Lane `canon_pair`: cross-section pairs of things that both carry a canon handle with different canon names, farthest sections first, with one per-thing cap counted over both endpoints. Lane `framework_walk`: thing to framework to thing over the USES_FRAMEWORK rows of `substrate.edges` whose target is a `framework_nodes` id. Every pair goes through `shared.makeCandidateStore`, so known and opportunity-evidence pairs are excluded and counted. Rows carry `canon_a`, `canon_b` (and `via_framework` for walks). `questionSetFor` emits `cn:lateral_path` leaves with `corpus: 'theo'`, slots `{term: canon_a, term2: canon_b}` (canon names, each passed through `composableTerm`) and the closed pair, plus one `cn-known` room leaf. No tool-call code: the grep gate reads 0.
- **Corpus sites.** `validateQuestionSet`, plan `CORPORA` (validator, normalizer, edit path), and `anySearchable` accept theo, so a connections plan assesses as `ready`, not `local_only`. `dim()` gains an optional `corpus` key set only on `cn:lateral_path`; every other dimension record is unchanged and the research-shape ledger `--check` stays green without a rebuild. The limiter target stays openalex-only.
- **Grants.** `buildRunGrant` adds provider theo, the `qHash(canonA|canonB)` of each theo leaf and `caps.max_theo_calls`, only when the plan has theo leaves (an openalex-only plan is deep-equal to a golden captured before the edit). `writeGrant` accepts an empty `families` list only for a run grant naming theo with approved hashes. `STANDING_SCOPE` is untouched. `validateTheoCall` checks no_grant, room_mismatch, grant_revoked, grant_expired, grant_reversioned, provider_not_in_policy, hash_not_approved, cap_exceeded (then term_not_composed). `grantCard` has a Theo branch (heading, canon-names-only line, pair count, honest caps, no "nothing else leaves the room", no empty shapes line); non-theo cards are byte-identical to the golden.
- **theo-lane.cjs.** `runTheoLane` skips and counts any slot not in the canon snapshot, checks `validateTheoCall` per leaf (first failure stops the lane), calls `verificationStamp.stampFinding({ fromHandle: term, toHandle: term2 }, { callTool })`, appends one 23-key audit row (provider theo, q `canonA|canonB`, family concept-evidence/v1), and writes `<run home>/theo-lane.json` atomically (`mos.theo-lane/1`, keyed by `pairKey`), merging with any earlier stamps and containing the run id. A stamp with a lateral path settles its leaf.
- **quick.cjs.** `coverFor` and `runQuick` refuse `no_fetch_queries` only with no OpenAlex entries and no theo leaves; both decide Theo cover through one helper (`checkTheoLeaf`), so the facade and the run cannot disagree. The lane runs after the OpenAlex searches under the same grant. Lane verdicts merge into `verdictByLeaf` before `rollUp`, so a verified pair yields one `cross_domain_transfer` candidate. A theo-only run gets a lane-derived verdict and answer line and no deep offer; the evidence card gains a "Lateral-path checks with Theo" section (canon names only). `reaskCard` always builds the run proposal for a plan with theo leaves and passes `theoPairs`.

## Verification

- `node tests/test-366-recall-connections.cjs`: PASS 13, FAIL 0
- `node tests/test-366-theo-lateral-lane.cjs`: PASS 23, FAIL 0 (Y1-Y10, Y3b; zero network attempts)
- `node tests/test-seed104-grant-family-loop.cjs`: PASS 19, FAIL 0
- `node tests/test-363-grants.cjs` 13/0, `test-365-never-do-ambient.cjs` 18/0, `test-363-run-quick.cjs` 19/0, `test-363-pyramid.cjs` 21/0, `test-366-templates.cjs` 6/0, `test-366-eureka-filing.cjs` 20/0, `test-366-perspective-interface.cjs` 17/0, `test-seed103-eureka-perspective.cjs` 39/0
- `node scripts/build-research-shape-ledger.cjs --check`: OK (no rebuild needed; no ledger byte changed)
- `bash tests/run-all-363.sh` (temp HOME and MINDRIAN_ROOMS_HOME): PASSED=44 FAILED=1 SKIPPED=1 KNOWN=8. See deviation 2.
- `bash tests/run-all-366.sh` (temp HOME and MINDRIAN_ROOMS_HOME): PASSED=55 FAILED=0 SKIPPED=13 KNOWN=1 (the known red is the pinned 355 direction-agreement leg); both new tests ran inside it and passed, and the phase em-dash guard passed
- Acceptance greps: `fromHandle: term` 1, `stampFinding({ a:` 0, `theoPairs` grants 2 and quick 3, `runTheoLane` in quick 1, `validateTheoCall` in quick 2 (the helper plus its comment; both coverFor and runQuick call the helper), `'theo'` planner 1, plan 2, templates 3, `function validateTheoCall` 1, standing-scope line 1, em-dash grep 0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] reaskCard builds a run proposal for any plan with theo leaves**
- **Found during:** Task 2
- **Issue:** With no grant or a standing grant, `reaskCard` built a standing OpenAlex proposal. A navigator would approve a standing grant that can never cover Theo and then loop on provider_not_in_policy.
- **Fix:** A plan with theo leaves always gets the run-grant proposal and the Theo card (options approve_run and not_now). A run proposal is never "stuck" under the SEED-104 guard, so the loop guard and its test are unaffected.
- **Files modified:** lib/core/research-planner/quick.cjs
- **Commit:** 69e5adb35

**2. [Rule 1 - Plan expectation] A theo-only run grant names theo alone**
- **Issue:** The plan says buildRunGrant "adds provider theo". Copying openalex onto a theo-only plan would make the card and the grant claim OpenAlex access the plan does not use.
- **Fix:** openalex stays in providers whenever the plan has OpenAlex search hashes; with none, providers is `['theo']`. Openalex-only output is unchanged (golden).
- **Commit:** 69e5adb35

**3. [Rule 2 - Missing critical] Lane-derived verdict, answer line and card section for theo-only runs**
- **Issue:** With no OpenAlex search, `computeQuickVerdict` returns unresolved / "a search failed", and a thin verdict would offer a deep run that cannot run Theo leaves.
- **Fix:** `theoVerdict` in quick.cjs; no deep offer for a theo-only plan; evidence card lists each canon pair's lateral-check result.
- **Commit:** 69e5adb35

**4. [Rule 2 - Missing critical] validateTheoCall also refuses a non-composable slot term (term_not_composed), last in order**
- Keeps the SEED-104 rule that every outbound term passes `composableTerm`, at the grant check as well as in the lane.

### Interpretations

- The plan's "title" of the F.0 card is the heading line in `body_md`; `card.title` stays "Research grant" so nothing that matches the title string breaks.
- The aggregate `bash tests/run-all-363.sh` ends FAILED=1, not FAILED=0. The one failing leg is the recorded-signature leg for the nested `run-all-3551.sh` (expected "PASS=63 FAIL=5", now "PASS=62 FAIL=6"). I ran `run-all-3551.sh` on its own (temp HOME): the new reds are `dependency-diff` (package.json or package-lock.json drifted since BASE_3551, owned by the peer session editing package files) and `doctor --acceptance` regressions on install-state, deployment-surfaces, version-of-record-published, session-start-active-version and activation-reached-the-wire (version and install-state drift from the release work). None touches a file this plan edits, and every 363 test leg that exercises this plan (grants, run-quick, pyramid, filing, never-do-ambient, seed104) is green. This is environment drift outside the plan, not a regression from it. It is recorded here and not re-baselined.

## Limits (recorded, no code change)

- **Theo leaves are quick-only in this phase.** The deep-mode corpus filters (deep.cjs 193 and 892, and plan.cjs 529 for the limiter target) still treat only `'openalex'` as researchable, so a deep run never reaches the Theo lane. This plan makes no code change there. `escalateToDeep` copies theo leaves with empty queries; a deep plan therefore carries them as inert.
- A navigator `toggle_source` to `theo` on a leaf without two canon slot terms makes an inert leaf (never sent, `unresolved`).

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. The only new egress is the grant-gated Theo lane, mitigated as T-366-61 to T-366-65b: canon snapshot guard (Y7), run grant naming theo plus pair hash and no standing reach (Y3, Y6), one audit row per call (Y5), atomic lane file with a contained run id, no network code in recall (grep gate), and the empty-families exception limited to run grants naming theo with approved hashes (Y3a3).

## Self-Check: PASSED

Files exist: connections-recall.cjs, theo-lane.cjs, both tests, golden.json. Commits 146e0eb34, 11ac93770, c17fc92ee, 69e5adb35 are in `git log`.
