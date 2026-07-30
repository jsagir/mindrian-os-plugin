---
phase: 239-brain-access-surface
plan: 03
subsystem: security
tags: [canon-part-8, mcp-tool-liveness, hook-matcher, brain-boundary, release-gate, seam-liveness]

# Dependency graph
requires:
  - phase: 239-02
    provides: "lib/core/brain-response-sanitize.cjs BRAIN_TOOL_MATCHER authority, hooks/hooks.json re-pointed matchers"
provides:
  - "scripts/check-brain-tool-liveness.cjs: release-gate script that enumerates live Brain tool names by a real stdio tools/list handshake and asserts both hook matchers and agent allowed-tools claims are live"
  - "tests/test-239-brain-tool-liveness.cjs: the 7-leg SC1 proof (live handshake, end-to-end green, matcher-stale mutation, server-rename mutation, tool-rename mutation, anti-vacuity trap, agent-claim liveness)"
  - "agents/persona-analyst.md: allowed-tools now names live Brain tool names"
  - "lib/core/seam-liveness.cjs: corrected grounding comment (no longer cites the B-1 bug as evidence of the correct shape)"
affects: [239-04-hooks-json-fix, 239-06-sendpacket-park, 239-07-verify-release-section-18]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two claim sources, one gate: a wildcard hook matcher (insensitive to a single tool rename by design) plus exact agent-declared tool names (sensitive to a single tool rename) are both asserted, so neither failure mode goes unnoticed."
    - "Anti-vacuity-first evaluation: a matcher's live claim set is computed and asserted non-empty BEFORE ever consulting lib/core/seam-liveness.cjs's checkHookMatcherLiveness, because that helper's own contract treats a zero-claim seam as vacuously live -- exactly the trap that would have reported the B-1 bug as green."
    - "Two-tier enumeration with a labelled fallback: a real MCP stdio handshake first, a source-scan of the shim's server.tool( registrations only as a clearly-flagged FALLBACK, never silently."

key-files:
  created:
    - scripts/check-brain-tool-liveness.cjs
    - tests/test-239-brain-tool-liveness.cjs
  modified:
    - agents/persona-analyst.md
    - lib/core/seam-liveness.cjs

key-decisions:
  - "agents/persona-analyst.md's two dead entries were re-pointed to the project-scoped form (mcp__mindrian-brain__brain_search / mcp__mindrian-brain__brain_query) rather than the plugin-scoped form, matching the convention already used by every other Brain-capable agent in this repo (brain-query.md, grading.md, investor.md, research.md). The plan's own composeScopedNames function emits both forms; this is a consistency choice, not a correctness requirement (both forms are live)."
  - "Task 1's own <verify> step (node scripts/check-brain-tool-liveness.cjs) legitimately exits 1 immediately after Task 1 lands, before Task 2 fixes agents/persona-analyst.md -- the gate correctly finds the pre-existing dead agent claim and reports it, which is the gate working as designed, not a script bug. The plan text's Task 1 acceptance line ('exits 0 on the current tree') describes the state after the whole plan lands, not the mid-plan state between Task 1 and Task 2; documented here rather than silently glossed over, in the 239-01/239-05 precedent style of naming a plan-text/execution-order mismatch."
  - "A transient first-run npm self-heal fired once during manual verification of the script (this worktree's own mcp-dep-heal.cjs triggered a guarded npm install even though every production dependency was already present on disk), producing a stray package-lock.json diff and a .mindrian-npm-install.lock file. Both were reverted/removed before any task commit (git checkout -- package-lock.json; rm .mindrian-npm-install.lock) since neither is in this plan's files_modified and neither reflects an intentional change. Re-running the script immediately after showed the handshake tier succeeding cleanly and reproducibly (3 consecutive clean runs, zero FALLBACK lines)."

patterns-established:
  - "Any future phase needing to prove an MCP tool-name claim (hook matcher, allowed-tools entry, or otherwise) is live should follow this plan's two-claim-source shape (wildcard matcher + exact name) and its anti-vacuity-first evaluation order, rather than handing an empty claim set straight to checkHookMatcherLiveness."

requirements-completed: [BRAIN-01]

# Metrics
duration: 50min
completed: 2026-07-30
---

# Phase 239 Plan 03: Brain Tool Liveness Gate Summary

**A release-gate script proves, from a real MCP `tools/list` handshake and never a hand-typed list, that every Brain hook matcher and every agent's Brain `allowed-tools` entry names a tool that actually exists -- and it cannot report the dead B-1 seam as green, because it asserts a matcher's live claim set is non-empty before ever trusting the shared helper's own "zero claims is vacuously live" contract.**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-07-30T14:45:00Z (approx, first file read)
- **Completed:** 2026-07-30T15:35:00Z
- **Tasks:** 3
- **Files modified:** 4 (2 new, 2 modified)

## Accomplishments

- `scripts/check-brain-tool-liveness.cjs` enumerates the 6 live Brain tool names via a real stdio `initialize` -> `notifications/initialized` -> `tools/list` handshake against `bin/mindrian-brain-mcp-client.cjs` (no hand-typed list, no hardcoded count), composes both the plugin-scoped and project-scoped live name forms from `.claude-plugin/plugin.json` and `.mcp.json` at run time, extracts both Brain `hooks/hooks.json` matchers and every agent's Brain `allowed-tools` claim from disk, and asserts both claim sources are live -- exiting 0/1/2 per the documented contract.
- `agents/persona-analyst.md`'s two dead `allowed-tools` entries (`mcp__brain_search`, `mcp__brain_query`) are re-pointed to the live project-scoped names, matching every other Brain-capable agent's existing convention.
- `tests/test-239-brain-tool-liveness.cjs` proves SC1 in 7 legs, all passing, with every fixture name derived from the live enumeration rather than hand-typed.
- `lib/core/seam-liveness.cjs`'s own grounding comment no longer cites this repo's `hooks/hooks.json` `mcp__brain_.*` matcher as evidence of the correct shape -- that citation was itself carrying the B-1 bug. The correction points at this plan's own gate as the thing that now proves the shape, and the genuinely-correct half of the original citation (the langtalks-graph-expert live-name example) survives unchanged.
- `bash tests/run-all-239.sh`'s "BRAIN-01 tool liveness handshake + mutations" leg flips from SKIPPED to PASSED; the aggregator's overall count moves from `Passed: 3 Failed: 1 Skipped: 5` (post-239-02 baseline) to `Passed: 5 Failed: 1 Skipped: 3`, the remaining `Failed`/`Skipped` legs owned by sibling plans 239-04/06/07.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author scripts/check-brain-tool-liveness.cjs, the live-enumeration gate** - `d9b33407` (feat)
2. **Task 2: Fix agents/persona-analyst.md and author tests/test-239-brain-tool-liveness.cjs** - `4b962322` (fix)
3. **Task 3: Correct the circular grounding comment in lib/core/seam-liveness.cjs** - `bf206c40` (docs)

_No TDD tasks in this plan; all three are `type="auto"` per the plan frontmatter._

## Files Created/Modified

- `scripts/check-brain-tool-liveness.cjs` - New, executable, 502 lines. Exports `enumerateLiveBrainTools`, `composeScopedNames`, `extractBrainHookMatchers`, `extractAgentBrainToolClaims`, `evaluateLiveness`, `resolvePluginName`, `resolveServerName`, plus `main()` guarded on `require.main === module`.
- `agents/persona-analyst.md` - Exactly 2 lines changed (the two dead `allowed-tools` entries), byte-identical otherwise.
- `tests/test-239-brain-tool-liveness.cjs` - New, 230 lines, 7 legs, all passing.
- `lib/core/seam-liveness.cjs` - Comment-only change to the `checkHookMatcherLiveness` docblock (lines ~93-115); zero behavioral change.

## Live Transcripts (acceptance evidence)

**Task 1, the full gate run (handshake tier, no FALLBACK):**

```
Live bare tool names (handshake tier, 6): brain_ask, brain_query, brain_schema, brain_search, brain_stats, brain_write
...
RESULT: OK. Every hook matcher matches at least one live name, and every exact agent-declared Brain tool name is live.
```

Reproduced clean on 2 additional consecutive runs after the transient npm self-heal (see Decisions Made) settled; zero `FALLBACK:` lines in any of the 3 runs; grep counts confirm no hand-typed tool-name list (`grep -c "brain_ask"` -> 0, `grep -cE "=== *6|length *=== *6"` -> 0, `grep -c "mos"` -> 0, `grep -c "'mindrian-brain'"` -> 0).

**Task 1, the anti-vacuity proof, run live:**

```
evaluateLiveness({ matchers: ['mcp__brain_.*'], exactClaims: [], liveToolNames: ['mcp__plugin_mos_mindrian-brain__brain_ask'] })
  -> {"ok":false,"failures":[{"type":"matcher_zero_matches","matcher":"mcp__brain_.*", ...}],"perMatcher":[{"matcher":"mcp__brain_.*","matched":[]}], "exact":{"ok":true,"claimedCount":0,"liveCount":0,"dead":[]}}

checkHookMatcherLiveness([], ['mcp__plugin_mos_mindrian-brain__brain_ask'])
  -> {"name":"hook-matcher-names-a-live-tool","ok":true,"claimedCount":0,"liveCount":0,"dead":[]}
```

This is the evidence: the shipped helper alone (`checkHookMatcherLiveness`, given zero claims) reports `ok:true` -- the shared helper's own documented "zero claims is vacuously live" contract would have reported the B-1 dead-matcher shape as GREEN. `evaluateLiveness` catches it because it asserts non-emptiness first.

**Task 2, hooks/hooks.json diff:** untouched by this plan (`git diff --stat hooks/hooks.json` empty at every checkpoint; 239-02 already fixed it).

**Task 2, `agents/persona-analyst.md` diff (exactly 2 lines):**

```diff
-  - mcp__brain_search
-  - mcp__brain_query
+  - mcp__mindrian-brain__brain_search
+  - mcp__mindrian-brain__brain_query
```

**Task 2, `tests/test-239-brain-tool-liveness.cjs`, all 7 legs on a clean run:**

```
  ok  LEG 1: enumerateLiveBrainTools returns a non-empty set of bare tool names
  ok  LEG 1: every enumerated name matches the brain_<word> shape
  ok  LEG 2: the gate exits 0 on the current tree
  ok  LEG 3 setup: the live matcher literal is present in hooks.json exactly as expected
  ok  LEG 3: staling one hooks.json matcher turns the gate red (exit 1)
  ok  LEG 3: the gate output names the staled matcher literal
  ok  LEG 3: hooks.json is restored byte-identical to its pre-mutation state
  ok  LEG 3: after restore, the gate is green again (exit 0)
  ok  LEG 4 setup: at least one real Brain hook matcher exists on the current tree
  ok  LEG 4: a renamed server turns evaluateLiveness red for the real matchers
  ok  LEG 5 setup: at least one real agent-declared Brain claim exists
  ok  LEG 5: renaming one live tool turns the exact-claim source red
  ok  LEG 5: the specific renamed claim (mcp__mindrian-brain__brain_ask) is named dead
  ok  LEG 5: the wildcard matcher(s) stay green under a single-tool rename (deliberate, not a gap)
  ok  LEG 6: evaluateLiveness reports the zero-match matcher as a FAILURE, not a pass
  ok  LEG 6: the bare shared helper alone reports the same zero-claim input as vacuously live (the trap)
  ok  LEG 7: extractAgentBrainToolClaims finds at least one real agent Brain claim
  ok  LEG 7: every agent-declared Brain claim on the real tree names a live tool

test-239-brain-tool-liveness: all 7 legs PASSED
```

LEG 3's mutation was a real write-run-restore against `hooks/hooks.json` (backup held in memory, restored in a `finally`, byte-identity re-verified, and the gate re-proven green after restore); `git diff --stat hooks/hooks.json` is empty after the full test run. No hand-typed `brain_*` fixture literal exists in the file: `grep -nE "'brain_[a-z]+'|\"brain_[a-z]+\""` on it returns zero hits.

**Task 3, `lib/core/seam-liveness.cjs` diff -- comment lines only** (every added/removed line is prefixed with ` * `, verified with a script filtering for non-comment diff lines: zero hits):

```diff
- * underscore between server and tool, confirmed from direct repo evidence
- * rather than assumed -- this repo's own hooks/hooks.json already matches on
- * "mcp__brain_.*" in its PreToolUse/PostToolUse entries, and the same shape is
- * visible in live registered tool names (mcp__langtalks-graph-expert__query_
- * relationship). The reason this wrapper has to exist at all: ...
+ * underscore between server and tool. The official Claude Code hooks
+ * reference states MCP tools follow the naming pattern mcp__<server>__<tool>;
+ * the plugins reference adds that a plugin-bundled server's scoped name is
+ * mcp__plugin_<plugin-name>_<server-name>__<tool>, and that a matcher written
+ * against the bare server key never fires.
+ *
+ * CORRECTION (Phase 239): this docblock used to cite this repo's own
+ * hooks/hooks.json as corroborating evidence for the correct shape. That
+ * citation was itself carrying the exact B-1 bug this module exists to
+ * catch ...
```

`grep -c 'mcp__brain_\.\*'` -> 0 (the dead literal is fully removed, not just relabelled). `grep -c "langtalks-graph-expert"` -> 2, unchanged from before the edit (the correct half survived verbatim). `grep -c "check-brain-tool-liveness"` -> 1 (the new pointer). `node lib/core/seam-liveness.test.cjs` -> 10/10. `node scripts/build-connector-registry.cjs --check` -> `connector-registry: OK`.

## Overall Plan Verification (all 8 items from the plan's `<verification>` block)

1. `node scripts/check-brain-tool-liveness.cjs` exits 0, no `FALLBACK:` line -- confirmed (3 clean runs).
2. `node tests/test-239-brain-tool-liveness.cjs` exits 0, 7 legs -- confirmed.
3. `node lib/core/seam-liveness.test.cjs` exits 0, 10/10 -- confirmed.
4. `node scripts/build-connector-registry.cjs --check` exits 0 -- confirmed (`connector-registry: OK`).
5. `bash tests/run-all-239.sh` shows the tool-liveness leg flipped SKIPPED -> PASSED -- confirmed; aggregate `Passed: 5 Failed: 1 Skipped: 3` (the remaining Failed/Skipped legs are 239-04/06/07's scope, not this plan's).
6. `git diff --stat hooks/hooks.json` empty -- confirmed at every checkpoint.
7. `git diff lib/core/seam-liveness.cjs` is comment-only -- confirmed by line-prefix filtering.
8. `grep -rlP '\x{2014}'` across all 4 touched files returns nothing -- confirmed.

## Decisions Made

See frontmatter `key-decisions`. Two are load-bearing enough to restate:

1. **Project-scoped form chosen for `agents/persona-analyst.md`.** `composeScopedNames` produces both `mcp__plugin_mos_mindrian-brain__brain_*` and `mcp__mindrian-brain__brain_*`; every other Brain-capable agent in this repo (`brain-query.md`, `grading.md`, `investor.md`, `research.md`) already uses the project-scoped form, so `persona-analyst.md` was aligned to that existing convention rather than introducing a third, inconsistent style. Both forms are live; this is a consistency call, not a correctness fix.
2. **Task 1's mid-plan verify result is an expected red, not a bug.** Running `node scripts/check-brain-tool-liveness.cjs` immediately after Task 1 (before Task 2 fixes `agents/persona-analyst.md`) legitimately exits 1, because the gate correctly finds the pre-existing dead agent claim on disk at that point in the plan's own sequencing. This is the gate doing exactly its job -- the plan's Task 1 acceptance text ("exits 0 on the current tree") describes the state once the whole plan has landed. Documented here in the 239-01/239-05 precedent style of naming a plan-text/execution-order mismatch rather than silently smoothing over it.

## Deviations from Plan

### Auto-fixed Issues

None that touched production or test code beyond what each task's own `files_modified` already claimed.

### Verification-mechanics notes (not code deviations)

**1. Transient npm self-heal during manual verification (not a task commit).** The very first manual run of `node scripts/check-brain-tool-liveness.cjs` in this worktree triggered `lib/core/mcp-dep-heal.cjs`'s guarded `npm install` self-heal inside the spawned Brain MCP shim, even though every production dependency listed in `package.json` was already present on disk in this worktree's `node_modules`. The install ran past this gate's 20-second handshake timeout, the gate's `SIGKILL` fired, and the shim process was killed before its own `finally { releaseInstallLock(dir) }` could run, leaving a stray `.mindrian-npm-install.lock` file and a cosmetic `package-lock.json` diff (a version-stamp catch-up, `1.15.3-beta.11` -> `1.15.3-beta.51`, and the `engines.node` floor already fixed by Phase 236). Neither file is in this plan's `files_modified`; both were reverted (`git checkout -- package-lock.json`; `rm .mindrian-npm-install.lock`) before any task's `git add`. Re-running the script immediately after showed the handshake tier succeeding cleanly and reproducibly. No orphaned `npm install` process was left running (checked via `pgrep`).

## Issues Encountered

None blocking. The npm self-heal race above was investigated, resolved, and confirmed non-reproducing on 3 subsequent clean runs before any commit.

## User Setup Required

None. No external service configuration required. This plan touches only tracked source and test files already in the repo; the live handshake is fully offline (registration happens at module load, before any network call, exactly as 239-RESEARCH.md's Pattern 3 measured).

## Known Stubs

None. No hardcoded empty values, placeholder text, or unwired data sources were introduced.

## Threat Flags

None. This plan's `<threat_model>` in `239-03-PLAN.md` is fully addressed by the delivered artifacts:
- T-239-T1 (silent matcher death after a future rename): mitigated by the two-claim-source gate; LEG 3 (stale matcher) and LEG 4 (server rename) both observed RED live.
- T-239-T1-VAC (zero claims read as vacuously live): mitigated by the anti-vacuity-first evaluation order; LEG 6 transcribes both verdicts side by side.
- T-239-T7 (vacuous test coverage): mitigated by deriving every test fixture from the live enumeration; no hand-typed `brain_*` literal exists in the test file.
- T-239-A4 (handshake denial of service): mitigated by the 20-second timeout, unconditional child kill in a `finally`, and the labelled fallback tier (never silent, never a false 0).
- T-239-T3 (agent-claim spoofing): mitigated by pasting the composed names from `composeScopedNames`'s own output rather than hand-typing them.

No new network endpoints, auth paths, or schema changes were introduced. `scripts/check-brain-tool-liveness.cjs` reads existing repo files (`hooks/hooks.json`, `.mcp.json`, `.claude-plugin/plugin.json`, `agents/*.md`) and spawns the already-shipped local stdio Brain shim; it makes zero outbound network calls of its own.

## Next Phase Readiness

- `scripts/check-brain-tool-liveness.cjs`'s exported functions (`enumerateLiveBrainTools`, `composeScopedNames`, `extractBrainHookMatchers`, `extractAgentBrainToolClaims`, `evaluateLiveness`) are ready for `239-07`'s `verify-release` section 18 to call directly, exactly as `239-PATTERNS.md`'s section-17 template expects (delegate to a `scripts/check-*.cjs`, capture stdout, branch on exit code).
- `tests/run-all-239.sh`'s remaining `Failed`/`Skipped` legs (`239 test-file completeness`, PII sanitizer liveness, `sendPacket` parked census, `verify-release` section 18 wiring) are owned by sibling plans 239-04, 239-06, and 239-07 respectively -- untouched by this plan.
- No blockers. This plan's cross-phase scope fence held: zero files claimed by Phase 237 or Phase 238 were touched (confirmed via `git diff --stat` across all three commits: `scripts/check-brain-tool-liveness.cjs`, `agents/persona-analyst.md`, `tests/test-239-brain-tool-liveness.cjs`, `lib/core/seam-liveness.cjs` only). Its cross-plan scope fence also held: zero files claimed by sibling 239 plans' `files_modified` were touched.

## Release Liveness (standing hard rule, restated per plan instruction)

`scripts/check-brain-tool-liveness.cjs` and `tests/test-239-brain-tool-liveness.cjs` are new dev-time/CI artifacts; they carry no user-facing runtime behavior change on their own. `agents/persona-analyst.md`'s fix is NOT live for any installed user until it lands on `main`, a release ships, AND the user runs the two-command update (`/plugin marketplace update` then `claude plugin update mos@mindrian-marketplace`). This is stated here per the standing memory rule (`feedback_dev_repo_fix_not_live_until_released.md`), matching 239-02's own restatement.

---
*Phase: 239-brain-access-surface*
*Completed: 2026-07-30*

## Self-Check: PASSED

- FOUND: scripts/check-brain-tool-liveness.cjs
- FOUND: tests/test-239-brain-tool-liveness.cjs
- FOUND: agents/persona-analyst.md
- FOUND: lib/core/seam-liveness.cjs
- FOUND: .planning/phases/239-brain-access-surface/239-03-SUMMARY.md
- FOUND: commit d9b33407 (Task 1)
- FOUND: commit 4b962322 (Task 2)
- FOUND: commit bf206c40 (Task 3)
