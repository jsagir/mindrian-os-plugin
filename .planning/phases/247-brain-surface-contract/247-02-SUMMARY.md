---
phase: 247-brain-surface-contract
plan: 02
subsystem: api
tags: [brain, mcp, brain-client, contract, tier-gate, cjs, tdd]

# Dependency graph
requires:
  - phase: 247-brain-surface-contract-01
    provides: "brain repo reconciled (text2cypher withheld, brain_ask_anything landed IN READ_TOOLS pending 247-03 retirement decision), CONTRACT-03/04 landed locally (not pushed)"
provides:
  - "data/brain-surface-contract.json + docs/BRAIN-SURFACE-CONTRACT.md: the vendored v1 contract (6 loop tools, 2 retired_remote, error semantics, index dispositions)"
  - "lib/core/brain-client.cjs: callTool returns a typed { error:'tier_denied', tool, message } sentinel on HTTP 403, null reserved for genuine transport failure"
  - "5 new brain-client read wrappers: normalizeFrameworkName, loopSearch, discoverStructure, orchestrationReadiness, feedsIntoChains (brain_stats already had stats())"
  - "tests/test-247-brain-client-403.cjs + tests/test-247-contract-client.cjs: hermetic conformance legs 1/2, both with demonstrated red proofs"
  - "scripts/probe-brain-contract.cjs: the live drift probe (conformance leg 3), authored and live-executed once this session (read-only) to confirm it correctly detects real deploy drift"
affects: [247-brain-surface-contract-03, 249-enrichment]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "403-vs-null sentinel pattern extended: callTool now mirrors the existing invalid_key (401) precedent for 403 (tier_denied), never collapsing a tier denial into the transport-failure null signal"
    - "Thin loop-tool wrappers: every new wrapper is a bare callTool(name, args) passthrough with zero result reshaping, so sentinels propagate to callers unchanged by construction"
    - "Contract-JSON-derived hermetic fixture test: the client test iterates data/brain-surface-contract.json's loop_tools keys rather than a hardcoded tool list, with a documented single-exception hardcode (the snake_case->camelCase wrapper-name map)"

key-files:
  created:
    - data/brain-surface-contract.json
    - docs/BRAIN-SURFACE-CONTRACT.md
    - tests/test-247-brain-client-403.cjs
    - tests/test-247-contract-client.cjs
    - scripts/probe-brain-contract.cjs
    - tests/run-all-247.sh
  modified:
    - lib/core/brain-client.cjs

key-decisions:
  - "schema() audit fix (Rule 1, found during the Task 2 consumer audit): it was caching ANY non-null callTool result -- including a sentinel object -- as valid schema data for 30 minutes. Fixed to skip caching when the result carries .error. This also silently fixed the same latent bug for the pre-existing invalid_key sentinel, not just the new tier_denied one."
  - "askOp() and sendPacket's transport were audited and left AS-IS: both already have their own pre-existing graceful-degradation contracts (askOp collapses any non-{count,rows} shape to {degraded:true}; sendPacket's out-validation collapses any non-BrainResponse shape to {advice:null, reason:'response_schema_invalid'}). Both correctly absorb the new sentinel without crashing; neither promises tier-denial visibility, and sendPacket has zero production callers (PARKED, confirmed in 247-01's summary). Documented as explicit audit findings in Test 8, not silently left unchecked."
  - "The live probe (scripts/probe-brain-contract.cjs) was actually executed once against the deployed Render service this session (read-tier key only, per the orchestrator's explicit constraint permitting this). Results are reported below for visibility but nothing from the run was committed -- the script itself writes nothing to disk, and this run is not a substitute for 247-03's required live gate after the push+deploy."

requirements-completed: [CONTRACT-01]

# Metrics
duration: ~35min
completed: 2026-08-10
---

# Phase 247 Plan 02: Brain Surface Contract - Plugin Client Summary

**Vendored the v1 Brain surface contract (6 loop tools, 2 retired_remote, error semantics, index dispositions), landed a typed `tier_denied` 403 sentinel in brain-client.cjs mirroring the existing `invalid_key` precedent, added 5 thin loop-tool read wrappers, and built both hermetic conformance legs (client fixture + 403 sentinel) plus the live drift probe script -- all TDD, all with demonstrated red proofs.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-10T14:45:00+03:00 (approx)
- **Completed:** 2026-08-10T14:58:00+03:00
- **Tasks:** 3/3 completed
- **Files modified/created:** 7 (6 created, 1 modified), all in `/home/jsagi/dev/MindrianOS-Plugin`

## Accomplishments
- Authored `data/brain-surface-contract.json` (machine half) and `docs/BRAIN-SURFACE-CONTRACT.md` (prose half): the vendored v1 cross-repo contract.
- Fixed the 403-vs-null conflation at the transport layer: `callTool` now returns `{ error: 'tier_denied', tool, message }` on HTTP 403, never null. `null` is now exclusively the transport-failure signal.
- Audited all 9 direct `callTool` consumers; found and fixed one real bug (`schema()` caching a sentinel as valid data) as a Rule 1 auto-fix; documented two consumers (`askOp`, `sendPacket`) that intentionally absorb the sentinel into their own pre-existing degradation contracts.
- Added 5 new brain-client exports (`normalizeFrameworkName`, `loopSearch`, `discoverStructure`, `orchestrationReadiness`, `feedsIntoChains`) giving Phase 249 a contracted client path to all 6 loop tools for the first time.
- Built both hermetic conformance legs with real red proofs (not just asserted -- demonstrated by running the suite against sabotaged/reverted code and watching it fail).
- Authored the live drift probe script and ran it once (read-only) against the deployed Brain -- it correctly caught real, expected deploy drift (see below).

## Task Commits

Each task was committed atomically; Task 2 followed the full TDD RED -> GREEN cycle:

1. **Task 1: Author the vendored contract** - `177b93c2` (feat)
2. **Task 2 RED: failing test for tier_denied sentinel + wrappers** - `711a60af` (test)
2. **Task 2 GREEN: tier_denied sentinel + 5 loop-tool wrappers** - `f0878a09` (feat)
3. **Task 3: conformance leg 2 fixture test + leg 3 live probe + runner** - `59f312cb` (feat)

_No plan-metadata-only commit yet -- this SUMMARY.md, STATE.md, ROADMAP.md, REQUIREMENTS.md land in the final commit below._

## TDD Gate Compliance

Task 2 (`tdd="true"`) followed the full RED -> GREEN sequence, verified in git log:
1. `711a60af` `test(247-02): add failing test for tier_denied sentinel + loop-tool wrappers` (RED gate)
2. `f0878a09` `feat(247-02): tier_denied 403 sentinel + 5 loop-tool read wrappers` (GREEN gate, immediately after)

**RED proof, live-verified twice:**
- Before writing any implementation: ran `node --test tests/test-247-brain-client-403.cjs` against the ORIGINAL (unmodified) `brain-client.cjs`. Result: 5 of 9 tests failed (Tests 1, 2, 6, 7, 8 -- exactly the behaviors this task adds). Confirmed the test can fail before it was allowed to pass.
- After implementing and committing GREEN: additionally sabotaged the committed sentinel-return line to `return null;`, reran the suite -- 4 of 9 tests went red (Tests 1, 2, 7, and the Test 8 audit). Restored via `git checkout --`, reran to confirm 9/9 green again. No sabotage artifact left in any commit.

Task 3's fixture test carries its own drift-detection red proof: the same conformance checker run against an in-memory contract with one tool renamed (`search` -> `search_v2_renamed`) correctly reports a mismatch naming the renamed tool -- proven by an assertion inside the test suite itself (`tests/test-247-contract-client.cjs`, the "drift-detection red proof" test), not just asserted in prose.

## Files Created/Modified
- `data/brain-surface-contract.json` - the vendored v1 machine contract
- `docs/BRAIN-SURFACE-CONTRACT.md` - the prose half: why the surface is small, the three conformance legs, the non-contract 15, Part 8 note
- `lib/core/brain-client.cjs` - `callTool` 403 sentinel, `schema()` cache fix, 5 new wrapper exports
- `tests/test-247-brain-client-403.cjs` - 9 hermetic tests (7 required behaviors + retired_remote regression + the audit test) against a real loopback mock server
- `tests/test-247-contract-client.cjs` - 4 hermetic tests, contract-JSON-derived, including the drift red proof
- `scripts/probe-brain-contract.cjs` - the live drift probe, 5 legs, never returns null on non-OK (status-honest, mirrors `build-brain-census.cjs`)
- `tests/run-all-247.sh` - glob-discovery runner, found-eq-0 guard, em-dash fence

## What the vendored contract declares

`data/brain-surface-contract.json` (v1):
- **6 loop tools**, all read-tier: `normalize_framework_name`, `search`, `discover_structure`, `orchestration_readiness`, `feeds_into_chains`, `brain_stats` -- each with its required arg names/types (names + tier only; schema-hash pinning deferred to v2 per the research's open question 3).
- **`retired_remote`: `text2cypher`, `brain_ask_anything`** -- the target state; `text2cypher` is already withheld on the reconciled-but-unpushed brain checkout, `brain_ask_anything`'s retirement is explicitly deferred to 247-03 (per 247-01's summary).
- **`error_semantics`**: `tier_denied` = HTTP 403 + MoatViolation body; `invalid_key` = HTTP 401.
- **`indexes`**: `keep` (1: `mindrian_methodology_vec`), `keep_retired` (1: `mindrian_methodology_vec_openai`), `dropped` (7: the foreign-space 384-dim entity indexes).
- **`non_contract_note`**: the other 15 registered read tools are neither promised nor removed by this document.

## Wrapper list (the 5 new loop-tool wrappers)

| Wrapper | Brain tool | Args emitted |
|---|---|---|
| `normalizeFrameworkName(raw)` | `normalize_framework_name` | `{ raw }` |
| `loopSearch(queryText, topK)` | `search` | `{ query, topK }` |
| `discoverStructure(frameworkName)` | `discover_structure` | `{ framework_name }` |
| `orchestrationReadiness(frameworkName)` | `orchestration_readiness` | `{ framework_name }` |
| `feedsIntoChains(seeds, maxHops)` | `feeds_into_chains` | `{ seeds, max_hops }` |

(`brain_stats` already had `stats()`.) `loopSearch` is deliberately renamed (not `search`) to avoid colliding with the pre-existing `search()` export, which wraps the different `brain_search` tool.

## Probe-script legs and their live results

`scripts/probe-brain-contract.cjs` was executed once this session (read-tier key from `~/.mindrian.env`, no admin key, nothing written to any tracked file or logged in full) to confirm it correctly detects real drift. **This was a validation run of the probe script, not the 247-03 release gate** -- the plan explicitly defers the actual live gate to 247-03 Task 3, after the reconciled brain commits are pushed and Render redeploys.

| Leg | Result | Evidence |
|---|---|---|
| a. `tools/list` -- every loop_tools name present | **PASS** | 23 tools listed, 0 missing loop tools |
| b. `text2cypher` refuses 403 MoatViolation | **FAIL (expected)** | HTTP 200 -- the deny-by-default READ_TOOLS allowlist is reconciled locally in the brain repo (247-01) but not yet pushed/deployed |
| b. `brain_ask_anything` refuses 403 MoatViolation | **FAIL (expected)** | HTTP 200 -- same cause; retirement itself is also explicitly deferred to 247-03 |
| c. `brain_query` refuses 403 MoatViolation (tier_denied live proof) | **PASS** | HTTP 403, `MoatViolation: tool "brain_query" requires the admin tier` -- this gate is pre-existing (WRITE_TOOLS denylist), independent of the unpushed work |
| d. `search(...)` no local-path leak | **PASS** | clean |
| d. `brain_search(...)` no local-path leak | **FAIL (expected)** | leaked `/mnt/c/Users/jsagi/Downloads/.../Slide by Slide.md` in `hits[0].fields.source_file` -- the CONTRACT-03 seam fix is reconciled locally (247-01) but not yet pushed/deployed |
| e. `brain_stats` index dispositions match contract | **FAIL (expected)** | all 7 `dropped` indexes still present on Render -- index drops are a live-graph admin operation, explicitly deferred to 247-03 |

**This is exactly the failure mode the probe exists to catch and exactly the state the research and 247-01's summary predicted**: the reconciled fixes are real, committed, and local (6 commits in the brain repo, unpushed), but Render still serves the pre-reconciliation surface. The probe correctly distinguishes "fixed in git" from "fixed in production" -- which is the whole point of conformance leg 3. 247-03 owns pushing those commits, redeploying, and re-running this exact script until every leg is PASS.

## Decisions Made

See `key-decisions` in the frontmatter above (schema() cache fix; askOp/sendPacket left as-is with documented reasoning; the one live probe-script validation run).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, found during the Task 2 consumer audit] `schema()` cached a sentinel as valid schema data**
- **Found during:** Task 2, auditing every direct `callTool` consumer per the plan's instruction ("confirm each public wrapper either passes the sentinel through or handles it explicitly")
- **Issue:** `schema()`'s cache guard was `if (result != null) { cache it }` -- true for a sentinel object too (both the new `tier_denied` and the pre-existing `invalid_key`). A single 403/401 would have poisoned the 30-minute schema cache with a denial, served to every caller for up to half an hour even after the Brain recovered or the key was fixed.
- **Fix:** Changed the guard to `if (result != null && !(typeof result === 'object' && result.error))`.
- **Files modified:** `lib/core/brain-client.cjs`
- **Verification:** Test 8 in `tests/test-247-brain-client-403.cjs` asserts a fresh call after the sentinel re-fetches real data rather than serving the cached sentinel.
- **Committed in:** `f0878a09` (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 1, bug)
**Impact on plan:** In-scope of the plan's own explicit audit instruction; fixes a real correctness bug (including a latent pre-existing one for `invalid_key`) that the plan's own consumer-audit step was designed to surface. No architectural change, no scope creep.

## Issues Encountered

None blocking. One informational note: while committing, `git log` showed several other GSD plans (248-01, 251, 247-01's own metadata commit) landing on `main` concurrently from other sessions in this same non-worktree checkout. `git pull --rebase origin main` before the final push confirmed no divergence and no conflicts -- this plan's files (`data/`, `docs/BRAIN-SURFACE-CONTRACT.md`, `lib/core/brain-client.cjs`, the 3 new `tests/test-247-*` files, `scripts/probe-brain-contract.cjs`, `tests/run-all-247.sh`) had zero overlap with any concurrently-landed commit.

## User Setup Required

None - no external service configuration required. The live probe script needs a read-tier Brain key (already present in `~/.mindrian.env` on this machine); no admin key is used or required by this plan.

## Next Phase Readiness

- **247-03** can now: (1) push the 6 reconciled brain-repo commits from 247-01, (2) execute the operator checkpoint (framework-field coverage measurement, `brain_ask_anything` retirement decision, the 7 index drops with a snapshot), (3) redeploy Render, and (4) re-run `scripts/probe-brain-contract.cjs` from this repo until every leg is PASS -- the exact 3 legs that failed in this session's validation run (b x2, d x1, e x1) are the ones 247-03's push+deploy should turn green.
- **Phase 249 (enrichment)** now has a contracted, sentinel-honest client path to all 6 loop tools via the 5 new wrappers plus `stats()`.
- **Phase 250 (HONEST-01)** can build the user-visible refusal on top of the `tier_denied` sentinel landed here -- this plan deliberately added no user-facing messaging, per the plan's explicit scope fence.
- No blockers for 247-03 or 249 to proceed against this plan's commits.

---
*Phase: 247-brain-surface-contract*
*Completed: 2026-08-10*

## Self-Check: PASSED

All 7 files created/modified confirmed present on disk. All 4 commit hashes
(`177b93c2`, `711a60af`, `f0878a09`, `59f312cb`) confirmed present in
`git log --oneline --all`. This SUMMARY.md confirmed present on disk.
