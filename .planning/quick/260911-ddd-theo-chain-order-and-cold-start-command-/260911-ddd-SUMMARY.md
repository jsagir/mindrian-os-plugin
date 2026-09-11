---
phase: quick-260911-ddd
plan: 01
subsystem: brain-integration
tags: [theo, brain-client, mcp-shim, prewarm, brain-router, tdd]

requires:
  - phase: quick-260910-hni
    provides: "brainClient.ask() -> _composeTheoAsk Theo structured_rows composition (directive, next_gate, grounding)"

provides:
  - "Command-bearing-first stable partition, theo_rank, grounding.option_order in _composeTheoAsk (lib/core/brain-client.cjs)"
  - "Content-free theo_health pre-warm at MCP shim startup (lib/core/brain-prewarm.cjs), surface-neutral across CLI/Desktop/Cowork"
  - "Single-source Tier 3 race bound (lib/mcp/brain-route-bound.cjs), default 6000ms, env-overridable"

affects: [brain-router, brain-composition-census, mcp-shim-startup, session-start]

tech-stack:
  added: []
  patterns:
    - "Two-queue stable partition (forward pass, no comparator) for reordering without disturbing relative order within a group"
    - "Injectable-probe deps seam ({ probe, originHost, now, homeDir, timeoutMs }) mirroring class-m-brain-smoke.cjs's own theoHealthFn seam"
    - "Single-source-of-truth leaf module (brain-route-bound.cjs) read by both an implementation (brain-router.cjs) and a declaration (brain-composition-census.cjs)"

key-files:
  created:
    - lib/core/brain-prewarm.cjs
    - lib/mcp/brain-route-bound.cjs
    - tests/test-339-brain-prewarm-cold-start.cjs
  modified:
    - lib/core/brain-client.cjs
    - bin/mindrian-brain-mcp-client.cjs
    - scripts/session-start
    - lib/mcp/brain-router.cjs
    - lib/mcp/brain-composition-census.cjs
    - tests/test-339-theo-ask-compose.cjs
    - tests/test-339-theo-ask-e2e-live.cjs
    - tests/test-254-composition-census.cjs
    - tests/run-all-339.sh
    - docs/ENV-TUNING.md

key-decisions:
  - "D-01 (plan-pinned): Theo's ranking is never altered at the source; the command-bearing-first partition is plugin-side only, carried alongside theo_rank."
  - "D-02 (plan-pinned): the pre-warm probe sends theo_health with no arguments and persists only {at, ok, origin_host}, never a response body (Canon Part 8)."
  - "D-03 (plan-pinned): the MCP shim (alwaysLoad: true) is the surface-neutral pre-warm point; scripts/session-start's spawn is a CLI-only extra, never the only path."
  - "6000ms Tier 3 bound: measured 2.034s Render cold wake (first Theo call) plus two warm follow-on calls (~1s), roughly 2x headroom; accepted cost is a 6s (not 2s) worst case when Theo is down, but localRec is precomputed so /mos:act still resolves instantly on that loss."

requirements-completed: [DDD-01, DDD-02, DDD-03]

duration: 35min
completed: 2026-09-11
---

# Quick 260911-ddd: Theo Chain Order and Cold-Start Command Summary

**Command-bearing-first stable partition in `_composeTheoAsk` (Larry now leads IllDefined with Red Teaming, not the command-less Design Thinking), plus a content-free `theo_health` pre-warm at MCP shim startup and a single-source 6000ms Tier 3 bound replacing the too-tight 2000ms race.**

## Performance

- **Duration:** ~35 min (commits spread 09:56-10:08 local, plus baseline capture and verification)
- **Started:** 2026-09-11T06:56:00Z (approx, first baseline capture)
- **Completed:** 2026-09-11T07:11:00Z
- **Tasks:** 3
- **Files modified/created:** 13 (3 created, 10 modified)

## Accomplishments

- Larry leads a live IllDefined chain with **Red Teaming** (has `/mos:challenge-assumptions`) instead of the top-degree but command-less **Design Thinking** -- proven both by an offline fixture arm and by the live e2e smoke against real Theo.
- Every option now carries `theo_rank`, Theo's own rank, so the reorder never loses information; `grounding.option_order` names the applied ordering on every composed envelope (success path and degraded catch path alike).
- A content-free `theo_health` probe now fires once at MCP shim startup on all three surfaces (CLI, Desktop, Cowork -- surface-neutral via `.mcp.json`'s `alwaysLoad: true`), never awaited, never blocking a tool handler; the on-disk marker holds exactly `{at, ok, origin_host}`.
- The Tier 3 race bound moved from a frozen `2000` literal to a single-source constant (`lib/mcp/brain-route-bound.cjs`, default `6000`, env-overridable via `MINDRIAN_BRAIN_ROUTE_TIMEOUT_MS`), read by both `brain-router.cjs` and `brain-composition-census.cjs` so the two can never drift apart.

## Task Commits

Each task was committed atomically:

1. **Task 1: Command-bearing-first stable partition, theo_rank and option_order in `_composeTheoAsk` (DDD-01)** - `82fe040d` (feat, tdd)
2. **Task 2: Shim-startup Brain pre-warm and a single-source Tier 3 bound (DDD-02)** - `be7b6c79` (feat)
3. **Task 3: RED-first cold-start arms, harness registration, and the full verification run (DDD-03)** - `e832136f` (test)

_Task 1 was a single TDD-tagged task (RED arms written and confirmed failing, then implementation landed to GREEN, in one commit per this plan's atomic-per-task discipline -- see TDD Gate Evidence below for the RED/GREEN split within that task's own history)._

## Files Created/Modified

- `lib/core/brain-client.cjs` - `_composeTheoAsk`: two-queue stable partition (command-bearing first), `theo_rank` on every option, `grounding.option_order` on both the success and catch paths.
- `tests/test-339-theo-ask-compose.cjs` - Updated the shipped Arm 1 order-pinned assertions to the new post-sort order; added 4 new arms (DDD-1 through DDD-4) covering the live IllDefined shape, all-command/no-command Theo-order preservation, the step-absent `theo_rank` fallback, and the catch-path `option_order`.
- `tests/test-339-theo-ask-e2e-live.cjs` - Added three live checks (command-bearing-first at `options[0]`, `theo_rank` finite, `grounding.option_order`), SKIP contract untouched.
- `lib/core/brain-prewarm.cjs` (new) - `prewarm(deps)` / `markerPath(homeDir)`; injectable probe seam; writes only `{at, ok, origin_host}`; never throws, never writes stdout.
- `lib/mcp/brain-route-bound.cjs` (new) - `BRAIN_ROUTE_TIMEOUT_MS = 6000`, `resolveBrainRouteTimeoutMs(env)`; pure-data leaf, requires nothing, opens no wire.
- `bin/mindrian-brain-mcp-client.cjs` - Calls `prewarm()` (voided, un-awaited) after `server.connect`.
- `scripts/session-start` - Detached CLI-only spawn of the same probe near the Brain-status block, outside the room guard.
- `lib/mcp/brain-router.cjs` - Requires the bound leaf; Tier 3 race reads `resolveBrainRouteTimeoutMs()` at call time; stale "2s"/"2000" prose corrected in 3 places; re-exports the bound symbols; carries the `brain-composition-census` provenance string.
- `lib/mcp/brain-composition-census.cjs` - `bound_ms` reads the leaf constant; header claim corrected to name the one dependency it now has.
- `tests/test-254-composition-census.cjs` - New Arm 9 pins the census `bound_ms` to the leaf constant and greps for the dead `2000` literal.
- `tests/run-all-339.sh` - Registered the 4 new production targets in `EMDASH_TARGETS`.
- `tests/test-339-brain-prewarm-cold-start.cjs` (new) - 5 arms: marker shape + Part 8 tripwire, reject/timeout degrade, non-blocking ordering, bound constant + env override, shim source-shape scan.
- `docs/ENV-TUNING.md` - Documented `MINDRIAN_BRAIN_ROUTE_TIMEOUT_MS` (default 6000) and `MINDRIAN_BRAIN_PREWARM_TIMEOUT_MS` (default 15000).

## TDD Gate Evidence (Task 1)

**RED** (before implementing, `node tests/test-339-theo-ask-compose.cjs`): 7 pass / **5 fail** -- the updated Arm 1 (order-pinned assertions no longer matched the unsorted output) plus the 4 new DDD arms (DDD-1 mixed/no-command-top, DDD-2 all/no-command Theo-order, DDD-3 `theo_rank` fallback, DDD-4 catch-path `option_order`), all failing for the expected reason: the sort/`theo_rank`/`option_order` behavior did not exist yet.

**GREEN** (after implementing `_composeTheoAsk`): `node tests/test-339-theo-ask-compose.cjs` -> **12/12 pass**.

**Live e2e** (`node tests/test-339-theo-ask-e2e-live.cjs`), extended with 3 new checks, PASSED (not SKIP):
```
  ok  when any option carries a command, options[0].commands.length > 0 (command-bearing-first partition)
  ok  options[0].theo_rank is a finite number
  ok  grounding.option_order === 'command_bearing_first'
  directive.guided.framework: "Red Teaming"
  directive.guided.stage: "IllDefined"
  next_gate.options.length: 4
  Phase 339 (quick/260910-hni) live e2e smoke: PASS
```

## The Live IllDefined Post-Sort Order and Confidence Proof

Fixture chain (Arm DDD-1, mirroring the live shape): Design Thinking (step 1, degree 291, no command), Disruptive Innovation (step 2, degree 255, no command), Red Teaming (step 3, degree 239, `/mos:challenge-assumptions`), Creative Destruction (step 4, degree 189, no command).

**Post-sort order:** Red Teaming, Design Thinking, Disruptive Innovation, Creative Destruction. `directive.guided.framework === 'Red Teaming'`. `options[0].theo_rank === 3`.

**Confidence is byte-identical per framework, proving the sort never touches a value** (computed from the unchanged `top`/degree formula, independently verified against the shipped Arm 1 fixture): Design Thinking 0.9, Disruptive Innovation 0.85, Red Teaming 0.83, Creative Destruction 0.76. The confidence *series* is no longer globally non-increasing after the reorder (0.9, 0.83, 0.85, 0.76 on the shipped Arm 1 fixture, where the top step already has a command) -- that is expected: the sort groups by command-bearing-ness, not by confidence, and each partition is independently non-increasing.

**theo_rank survives the reorder:** Design Thinking=1, Disruptive Innovation=2, Red Teaming=3, Creative Destruction=4 -- unaffected by which position each framework lands in after sorting.

**Live confirmation:** the same live IllDefined shape reproduced against real Theo (`test-339-theo-ask-e2e-live.cjs`): `directive.guided.framework: "Red Teaming"`, `chain_status: "ok"`, all 3 new checks `ok`.

## The brain-router `topConf` Consequence (Stated, Not Compensated)

`lib/mcp/brain-router.cjs:398` (unmoved by this plan) derives `topConf` from `options[0].confidence`. On a chain whose top-ranked framework has no command, the routed confidence now reads the first command-bearing option's confidence -- **0.83 instead of 0.9** on the live IllDefined shape. This is stated in both the `_composeTheoAsk` code comment and here per the plan's explicit instruction: it is the intended meaning of the change (confidence now describes the option actually surfaced to the user), not a regression. `brain-router.cjs` was deliberately NOT touched to compensate for this with a `max()` or similar -- doing so would defeat the purpose of the reorder.

## The 6000ms Bound Justification

`lib/mcp/brain-route-bound.cjs`'s `BRAIN_ROUTE_TIMEOUT_MS = 6000`:

- `brainClient.ask()` (the raced call) makes **three sequential Theo calls** since quick 260910-hni (`brain_ask`, then `recommend_chain`, then `brain_query`).
- A Render instance waking from spin-down was **measured at 2.034s on the first call alone**; Theo redeploys on every push to its main, opening a fresh cold window each time.
- The old `2000` bound could not cover even a **warm** three-call composition on a slow link, let alone a cold one -- every cold window silently degraded `/mos:act` to the local Tier 2 heuristic with no disclosure of why.
- `6000` = the measured `2.034`s cold wake + two warm follow-on calls (~1s), with roughly 2x headroom on top of that sum.
- **Accepted cost** (threat register T-ddd-04, disposition `accept`): when Theo is genuinely down, the race now rejects at 6s instead of 2s. `localRec` (`lib/mcp/brain-router.cjs`) is already computed BEFORE the race starts, so the Tier 2 answer is instant once the race loses -- `/mos:act` still resolves either way. The trade is a rarer 6s worst case against a silently degraded recommendation on every cold window.

## Full Verification Results

| Command | Result |
|---|---|
| `node tests/test-339-theo-ask-compose.cjs` | 12/12 PASS |
| `node tests/test-339-brain-prewarm-cold-start.cjs` | 6/6 PASS (Arms 1-5, Arm 2 split into 2a/2b) |
| Task 2 exact verify one-liner (census + no-2000-literal grep + bound-leaf assertions) | PASS (`bound ok` printed, exit 0) |
| `bash tests/run-all-339.sh` | PASS=13 FAIL=2 SKIP=0 (both failures pre-existing, see Baseline Comparison) |
| `bash tests/run-all-252.sh` | PASS=2 FAIL=0 SKIP=0 |
| `bash tests/run-all-254.sh` | PASS=10 FAIL=0 SKIP=0 (includes new Arm 9) |
| `node scripts/doctor.cjs --acceptance` | **20/20** (on the clean, committed tree) |
| `node tests/test-339-theo-ask-e2e-live.cjs` | **PASS** (not SKIP) against live Theo -- `directive.guided.framework: "Red Teaming"`, all 3 new checks `ok` |

## Baseline-Reds.txt Comparison (Task 1, captured at HEAD 5ce0dd3a)

Captured to `.planning/quick/260911-ddd-theo-chain-order-and-cold-start-command-/baseline-reds.txt` before any edit, via `node`/`bash` runs, no `git stash` (D-05):

| Leg | Baseline result | Post-plan result | Verdict |
|---|---|---|---|
| `node tests/test-339-update-path-single-source.cjs` | exit 1 (red) | still red (unchanged, out of this plan's scope) | pre-existing, matches baseline |
| `bash tests/run-all-127.sh` | 3 failures: `127.1-embedding-integrity.test.cjs`, `127.1-index-config.test.cjs`, `127.1-graphrag-overlap.test.cjs`; plus `test-127-03-acceptance-gates.sh` FAILED | not re-run in Task 3 (not in the Task 3 full-run list); no files this plan touches overlap with these fixtures | pre-existing, out of scope |
| `bash tests/run-all-257.sh` | `Plan 08 (LOCUS-07) strict input shapes: FAILED` | not re-run in Task 3; no overlap with files this plan touches | pre-existing, out of scope |
| `node tests/test-262-unrecognized-shape-voids.cjs` | 4 failures: B3, B4, B5, Layer B | not re-run in Task 3; no overlap with files this plan touches | pre-existing, out of scope |

`bash tests/run-all-339.sh`'s own two live failures at plan-end:

1. `test-339-update-path-single-source.cjs` -- present verbatim in `baseline-reds.txt` above. Not this plan's regression.
2. `dist bundle staleness (build-dist-bundles.cjs --check-stale)` -- NOT one of the four named baseline legs (that capture was scoped to specific test files, not this aggregator's generated-artifact gate). **Independently confirmed pre-existing** by spinning up a throwaway worktree at this plan's own baseline commit (5ce0dd3a, no `git stash`, per D-05) and re-running the identical check there: same failure, same versions (`bundle was generated from 2.0.0-beta.32, the live plugin is 2.0.0-beta.34`). This plan's `files_modified` list never touches `dist/` or `.claude-plugin/plugin.json`. Logged in `deferred-items.md` in this phase directory, not fixed (Scope Boundary rule -- out-of-scope, pre-existing, unrelated file).

## Decisions Made

- Followed all 5 plan-pinned decisions (D-01 through D-05) verbatim: Theo's ranking untouched at source, content-free pre-warm with the 3-key marker, shim as the surface-neutral pre-warm point, the 4 forbidden-file exclusions honored, no `git stash` anywhere (a throwaway worktree was used instead for the baseline pre-existing-check).
- Used the two-queue forward-pass partition (not `Array.prototype.sort` with a comparator) per the plan's explicit instruction, so stability holds by construction rather than by engine sort-stability semantics.

## Deviations from Plan

**None that required Rule 4 (architectural) escalation.** One Rule-2-adjacent scope note, not a fix:

**1. [Scope Boundary, not an auto-fix] Logged (did not fix) a pre-existing dist-bundle-staleness failure in `run-all-339.sh`**
- **Found during:** Task 3's full verification run
- **Issue:** `build-dist-bundles.cjs --check-stale` fails because `dist/BUNDLE-VERSION.json` still names `2.0.0-beta.32` while the live plugin is `2.0.0-beta.34`.
- **Action:** Verified pre-existing at the plan's own baseline commit (5ce0dd3a) via a throwaway worktree (not a fix; confirmation only). Logged to `deferred-items.md`, not touched -- `dist/` and `plugin.json` are outside this plan's `files_modified` and outside its scope (Scope Boundary rule: only auto-fix issues directly caused by this task's own changes).
- **Files modified:** none (deferred-items.md is a phase-local note under the gitignored `.planning/` tree, not a repo file)
- **Verification:** `cd /tmp/ddd-baseline-check && node scripts/build-dist-bundles.cjs --check-stale` at commit 5ce0dd3a reproduces the identical failure.

---

**Total deviations:** 0 auto-fixed; 1 out-of-scope finding logged (not fixed).
**Impact on plan:** None -- the dist-bundle staleness is unrelated to any file this plan touches and does not affect the `doctor --acceptance` 20/20 result (a separate, narrower gate than `run-all-339.sh`'s own generated-artifact check).

## Issues Encountered

None beyond the dist-bundle staleness noted above (confirmed pre-existing, not an issue introduced by this work).

## Known Stubs

None. No hardcoded empty values, placeholder text, or unwired data sources were introduced by this plan.

## Threat Flags

None. All new surface (the pre-warm marker write, the `theo_health` probe call, the Tier 3 bound leaf) is already covered by the plan's own `<threat_model>` (T-ddd-01 through T-ddd-06), and no additional network endpoint, auth path, file-access pattern, or schema change at a trust boundary was introduced beyond what that register already names.

## User Setup Required

None -- no external service configuration required. The two new env vars (`MINDRIAN_BRAIN_ROUTE_TIMEOUT_MS`, `MINDRIAN_BRAIN_PREWARM_TIMEOUT_MS`) are optional tuning knobs with safe, documented defaults.

## Next Phase Readiness

- The command-bearing-first partition and the pre-warm/bound work are both independently shippable; no follow-up plan is blocking on this one.
- `deferred-items.md` names the one open, out-of-scope item (dist bundle regeneration) for whoever next runs a release/version-bump ceremony.
- The doctor acceptance gate (20/20) and all three named regression suites (339, 252, 254) are green on the final committed tree.

---
*Quick task: 260911-ddd-theo-chain-order-and-cold-start-command-*
*Completed: 2026-09-11*

## Self-Check: PASSED

All 13 created/modified production and test files confirmed present on disk; all 3 task commits (`82fe040d`, `be7b6c79`, `e832136f`) confirmed present in `git log --oneline --all`.
