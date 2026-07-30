---
phase: 239-brain-access-surface
plan: 05
subsystem: security
tags: [canon-part-8, egress-guard, brain-client, cypher, sse-capture, mutation-testing]

# Dependency graph
requires:
  - phase: 239-01
    provides: "tests/helpers/brain-capture-server.cjs (shared SSE-shaped Brain capture server), tests/run-all-239.sh (SKIP-safe aggregator)"
provides:
  - "lib/core/brain-client.cjs: raw-field classify-first Part 8 egress guard in hatAwareRecommend() and suggestValidationSteps(), both fail-closed and disclosed"
  - "lib/core/brain-client.cjs: labelled query() backstop that blocks only on a proven CONTENT-SET verdict, explicitly documented as insufficient alone"
  - "tests/test-239-query-egress-canary.cjs: the SC2 proof (7 legs, live mutation transcribed)"
  - ".planning/phases/239-brain-access-surface/deferred-items.md: D-239-05-01, the deeper Part 8 design question this plan intentionally did not resolve"
affects: [239-04-hooks-json-fix, 239-06-sendpacket-park, 239-07-verify-release-section-18]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Raw-field classify-before-sanitize-before-interpolate: the guard runs on the caller's raw value, not the assembled Cypher string, cloning the shipped lib/core/bono/persona-research.cjs:208-233 control flow."
    - "Backstop-with-a-warning-label comment idiom: query()'s backstop comment states, with the reproduced measurement, exactly why it is insufficient alone, so a future maintainer cannot delete the real control on the theory that the backstop already covers it."
    - "options.db as an optional caller-supplied telemetry handle (mirrors sendPacket's opts.db), so a function that receives no db handle from its only production caller still has a wired-but-currently-silent disclosure path rather than a fabricated one."

key-files:
  created:
    - tests/test-239-query-egress-canary.cjs
    - .planning/phases/239-brain-access-surface/deferred-items.md
  modified:
    - lib/core/brain-client.cjs

key-decisions:
  - "PART8_FORCE_BRAIN_AVAILABLE (named in the plan's read_first/acceptance text) is a hook-script-only test seam (scripts/part8-egress-guard-hook.cjs) and is never read by lib/core/brain-client.cjs's isAvailable(). The plan's own acceptance criteria references it as the mechanism for the live fail-closed proof; the actual working mechanism in this codebase is a fresh-required brain-client with MINDRIAN_BRAIN_URL/MINDRIAN_BRAIN_KEY set before require (the same idiom tests/test-brain-client-params.cjs and tests/helpers/brain-capture-server.cjs already use). Used that mechanism for the live proof instead; behavior and result are identical, only the seam name differs from the plan text."
  - "hatAwareRecommend/suggestValidationSteps disclose the skip via _logEventBestEffort(options.db, ...), the same opts.db idiom sendPacket already uses, rather than opening room.db directly from roomDir. brain-client.cjs is NOT on scripts/check-substrate.cjs's ALLOWED_DIRECT_IMPORT allow-list, and this plan's files_modified fence excludes lib/core/navigation.cjs, so adding a roomDir-to-db opener inside brain-client.cjs would trip the pre-commit substrate guard (scripts/hooks/pre-commit runs check-substrate.cjs --diff) and would be an architectural addition outside this plan's declared scope. No production caller of either function passes options.db today, so the telemetry call is a structurally-wired, currently-silent no-op (_logEventBestEffort already documents 'skips silently if opts.db is absent') -- proven live: when a caller DOES supply a db handle (as the fail-closed proof script did), the brain_egress_blocked row is written with scalars only."
  - "query()'s backstop telemetry call passes db=undefined always, because query()'s signature is explicitly frozen by the plan (no options parameter, no __transport seam) and it has no path to a db handle. This is documented in-line and here rather than silently omitted."
  - "LEG 2's fixture uses problemType='framework selection' (real methodology vocabulary, clears the raw-field guard) so the Blue Hat methodology_notes entry carrying the canary is the field that specifically triggers the block, rather than the canary being caught incidentally by an already-ambiguous problemType. This makes the door-two proof rigorous rather than accidental."

patterns-established:
  - "Any future brain-client.cjs function that interpolates a caller-supplied value into Cypher must classify the RAW value (not the assembled string) before sanitizeCypherInput and before interpolation, per the two measured failure modes (template laundering via 'Framework', sanitizer-strips-'@' disarming the PII pattern)."
  - "A backstop-only guard (one that cannot see the pre-sanitize/pre-interpolation signal) must carry an in-comment reproduction of the exact measurement proving it is insufficient alone, so it cannot later be mistaken for the primary control."

requirements-completed: [BRAIN-02]

# Metrics
duration: 55min
completed: 2026-07-30
---

# Phase 239 Plan 05: Query Egress Canary Guard Summary

**Raw-field Part 8 egress guard (classify-before-sanitize-before-interpolate) closes the live constitutional breach in `hatAwareRecommend()` and `suggestValidationSteps()`, plus a labelled `query()` backstop, proven with a 7-leg canary suite including a live mutation that put the canary back on the wire.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-07-30T11:10:00Z (approx, first file read)
- **Completed:** 2026-07-30T12:05:00Z
- **Tasks:** 3
- **Files modified:** 3 (1 modified, 2 created)

## Accomplishments

- `query()` made ZERO guard calls before this plan; two production paths (`hatAwareRecommend`'s Blue Hat notes, `suggestValidationSteps`'s opportunity domain) pushed user-typed content through it uninspected. Both doors now classify the RAW field before `sanitizeCypherInput` and before Cypher interpolation, fail-closed on any non-`allow` verdict.
- `query()` itself now carries a labelled backstop that blocks only on a proven `block` verdict, with an in-comment reproduction of the exact measurement (template word `Framework` laundering an embedded canary from `ambiguous` to `allow`) proving the backstop alone is insufficient -- so a future maintainer cannot delete the raw-field guards on the theory that `query()` already checks.
- `tests/test-239-query-egress-canary.cjs` proves SC2 end to end: both canary doors, zero canary bytes on the captured wire, two regression legs (template laundering, sanitize-ordering) that cannot silently return, an anti-vacuity leg proving the capture path is live, and a live mutation (performed by hand, restored) that puts the canary back on the wire when the guard is removed.
- `bash tests/run-all-239.sh`'s canary leg flips from SKIPPED to PASSED; Leg A (dead-matcher census, owned by 239-02) and Leg B (test-file completeness, owned by 239-07) remain FAILED as expected -- not this plan's scope.

## Task Commits

Each task was committed atomically:

1. **Task 1: Insert the raw-field classify-first guard at both user-content doors** - `fdec10f3` (feat)
2. **Task 2: Add the query() backstop, explicitly labelled insufficient on its own** - `0c0042a4` (feat)
3. **Task 3: Author tests/test-239-query-egress-canary.cjs, the SC2 proof** - `df89840d` (test)

_No TDD tasks in this plan; all three are `type="auto"` per the plan frontmatter._

## Files Created/Modified

- `lib/core/brain-client.cjs` - Added a raw-field classify-first guard block to `hatAwareRecommend()` (classifies raw `problemType` and each raw `blueNotes` entry separately) and to `suggestValidationSteps()` (classifies raw `opportunity.domain` and raw `opportunity.problem`), both fail-closed with scalars-only telemetry disclosure via `_logEventBestEffort(options.db, 'brain_egress_blocked', {...})`. Added a labelled backstop to `query()` that classifies the assembled `{ cypher }` string and blocks only on a proven `block` verdict. Zero changes to `sanitizeCypherInput`, any Cypher template string, or `sendPacket`. 101 + 36 lines inserted across the two commits, 0 deletions.
- `tests/test-239-query-egress-canary.cjs` - New 308-line SC2 proof: 7 legs (both canary doors, PII canary, template-laundering regression, sanitize-ordering regression + real source-order assertion, anti-vacuity, automated mutation companion). Reuses `tests/helpers/brain-capture-server.cjs` (239-01) rather than standing up a new mock transport.
- `.planning/phases/239-brain-access-surface/deferred-items.md` - New. Files D-239-05-01: whether `hatAwareRecommend`/`suggestValidationSteps` should send user domain text to a methodology graph at all is a deeper Part 8 design question this guard-insert plan intentionally did not resolve.

## Source-Order Assertions (Task 1 acceptance)

Line numbers from a live `node -e` scan of the post-edit file, transcribed:

| Function | `classify(` line | `sanitizeCypherInput(` line | Ordering holds |
|---|---|---|---|
| `hatAwareRecommend` | 694 | 724 | yes |
| `suggestValidationSteps` | 808 | 829 | yes |

## `part8-egress-guard` / `toolName: 'brain_ask'` Grep Counts (Task 1 acceptance)

- `grep -c "part8-egress-guard" lib/core/brain-client.cjs`: baseline `1` (the pre-existing `sendPacket` PB8-10 belt) -> after Task 1+2 `4` (increase of 3, satisfies "at least 2").
- `grep -n "toolName: 'brain_ask'" lib/core/brain-client.cjs`: 2 hits, one inside `hatAwareRecommend`, one inside `suggestValidationSteps`.

## Fail-Closed Proof (Task 1 acceptance, live, transcribed)

Built `opportunity = { problem: 'test problem', domain: 'jane@startup.com', knight_position: 'uncertainty' }`, fresh-required `brain-client` pointed at the SSE capture server with a fake `MINDRIAN_BRAIN_KEY` (the actual isAvailable()-forcing mechanism in this codebase -- see Decisions Made re: `PART8_FORCE_BRAIN_AVAILABLE`), opened a real room.db, called `suggestValidationSteps(opportunity, { db })`:

```
isAvailable(): true
result: null
captured.length (query() calls made): 0
```

## Disclosure Proof (Task 1 acceptance, live, transcribed)

Same run, reading the `memory_event` node back from room.db:

```
memory_event rows: [{"id":"memory_event:brain_egress_blocked:...","properties":"{\"egress_class\":\"content_set\",\"verdict\":\"block\",\"count\":1,\"created_by\":\"system\",\"source_path\":\"system:brain-validation-steps\",\"event_type\":\"brain_egress_blocked\"}"}]
```

Scalars only. Contains neither `jane@startup.com` nor `CANARY7F3A2B`.

## Production Caller Null-Handling (Task 1 acceptance)

`lib/core/opportunity-ops.cjs:1359` (`enrichOpportunity`):

```js
const result = await brain.suggestValidationSteps(opportunity);
if (!result || !result.steps || result.steps.length === 0) {
  return { enriched: false, steps: 0 };
}
```

Already treats `null` (and any result without `.steps`) as "not enriched, do nothing" -- confirmed BEFORE this plan made `null` more frequent, so the more-frequent-null consequence is safe for the one known production caller.

## `query()` Backstop Verification (Task 2 acceptance)

- `query()` contains exactly one `classify(` call, at line 393, strictly before the one `callTool(` call at line 416 (scanned live via `node -e` over the function body).
- `grep -n "async function query(cypher, params)" lib/core/brain-client.cjs` returns exactly 1 hit (line 375). No `opts`, no `__transport` added.
- `grep -c "BACKSTOP" lib/core/brain-client.cjs` returns 1 (both occurrences of the word land on the same comment line), inside `query()`.
- THE LAUNDERING MEASUREMENT, reproduced live and transcribed:

```
laundering reproduced: {"verdict":"ambiguous","class":"freeform_unmatched","reason":"no methodology vocabulary match"} {"verdict":"allow","class":"move_set","reason":"generic methodology vocabulary handle"}
```

Matches 239-RESEARCH.md Pitfall 1 exactly (bare cypher canary -> ambiguous, templated cypher canary -> allow).

## Task 3 Leg Transcripts

All 7 legs PASS on a clean run (`node tests/test-239-query-egress-canary.cjs`, exit 0):

- **LEG 1** (opportunity.domain canary): `captured` = `[]` after `suggestValidationSteps` returns `null`. Zero occurrences of `CANARY7F3A2B`.
- **LEG 2** (Blue Hat note canary, problemType set to `'framework selection'` so the guard reaches the note specifically): `captured` = `[]` after `hatAwareRecommend` returns `null`. Zero occurrences of `CANARY7F3A2B`.
- **LEG 3** (PII canary): `captured` = `[]` after `suggestValidationSteps` returns `null`. Zero occurrences of BOTH `jane@startup.com` and `janestartup.com`.
- **LEG 4** (template-laundering regression): bare-cypher `ambiguous`/`freeform_unmatched`; templated-cypher `allow`/`move_set`; raw-field form `ambiguous`/`freeform_unmatched` (not `allow`).
- **LEG 5** (sanitize-ordering regression): `sanitizeCypherInput('jane@startup.com')` = `'janestartup.com'`; raw verdict `block`; sanitized verdict `ambiguous` (not `block`); source-order `classify(` at char 1137 strictly before `sanitizeCypherInput(` at char 1888 inside `suggestValidationSteps`.
- **LEG 6** (anti-vacuity): a should-pass payload (`domain: 'framework'`, `problem: 'framework chain analysis'`) produced `captured.length=2`, tool names `["brain_query","brain_query"]` -- the capture path is live, so LEGs 1-3 are not vacuously green.
- **LEG 7** (automated companion): `classify(` present in both `hatAwareRecommend` and `suggestValidationSteps` source bodies.

## LEG 7 Live Mutation Proof (performed by hand, transcribed, restored)

1. Wrapped the `suggestValidationSteps` guard loop in `if (false) { ... }` (guard disabled, syntax intact).
2. Ran `node tests/test-239-query-egress-canary.cjs`: **exit code 1**, 2 failures.
3. LEG 1 failed with the canary literally present on the captured wire:

```
FAIL LEG 1: opportunity.domain canary caught before the wire
    LEG 1 FAILED: canary crossed the wire: [{"name":"brain_query","arguments":{"cypher":"\n    MATCH (f:Framework)-[:ADDRESSES_PROBLEM_TYPE]->(pt:ProblemType)\n    WHERE pt.name CONTAINS \"CANARY7F3A2B\"\n ..."}}, ...]
```

4. LEG 3 failed with the SANITIZED PII on the captured wire (`janestartup.com` inside the Cypher `CONTAINS` clause) -- proving the domain field reaches the wire once the pre-sanitize guard is removed, even though `sanitizeCypherInput` still ran downstream.
5. LEG 2 (hatAwareRecommend, unaffected by this specific mutation) and LEGs 4-7 stayed green, as expected -- the mutation targeted only `suggestValidationSteps`.
6. Restored the file byte-for-byte. `git diff --stat lib/core/brain-client.cjs` -> **empty** (confirmed before staging/committing).
7. Re-ran the suite: **exit code 0**, all 7 legs PASS again.

## Diff Discipline (Task 1+2 acceptance, verification item 5)

`git diff 0e5c1c34ded1684d3a41b0765619fb87ee58a3bf..HEAD -- lib/core/brain-client.cjs` searched for any changed line matching `function sanitizeCypherInput`, `function sendPacket`, or the two production Cypher `MATCH (f:Framework)-[:...]->` template strings: **zero matches**. `git diff --stat 0e5c1c34ded1684d3a41b0765619fb87ee58a3bf..HEAD` shows `2 files changed, 409 insertions(+)`, 0 deletions -- purely additive.

## Decisions Made

See frontmatter `key-decisions`. Two are load-bearing enough to restate:

1. **`PART8_FORCE_BRAIN_AVAILABLE` is a hook-script seam, not a `brain-client.cjs` seam.** The plan's Task 1 acceptance criteria and Task 3 read_first both name `PART8_FORCE_BRAIN_AVAILABLE` as the mechanism to force `isAvailable()` true for the live fail-closed proof. Grepped the full tree: it is read only by `scripts/part8-egress-guard-hook.cjs` (the PreToolUse hook), never by `lib/core/brain-client.cjs`'s `isAvailable()`/`getApiKey()`. The actual working mechanism in this codebase -- already used by `tests/test-brain-client-params.cjs` and `tests/helpers/brain-capture-server.cjs` -- is a fresh `require()` of `brain-client.cjs` after setting `MINDRIAN_BRAIN_URL` + `MINDRIAN_BRAIN_KEY`. Used that for both the Task 1 live proof and the entire Task 3 test file. Result and behavior are identical to what the plan intended; only the named seam differs.
2. **No new `options.db` production caller exists; the telemetry call is wired but currently silent.** `hatAwareRecommend` and `suggestValidationSteps` both accept `options.db` for disclosure, mirroring `sendPacket`'s `opts.db`. Every current production call site (`skills/hat-briefing/SKILL.md`'s `brain.hatAwareRecommend(roomDir, 'general')`, `lib/core/opportunity-ops.cjs:1359`'s `brain.suggestValidationSteps(opportunity)`) passes no `db`, so `_logEventBestEffort` silently no-ops there today (its own documented contract: "Skips silently if opts.db is absent"). This is NOT a new telemetry path (Canon Part 7) and NOT an architectural change (`lib/core/navigation.cjs` is untouched, `brain-client.cjs` never became an `ALLOWED_DIRECT_IMPORT` entry for `room-db.cjs`) -- it is the same shape `sendPacket` already ships. Proven live: when a caller DOES supply `{ db }` (as the fail-closed proof script did), the `brain_egress_blocked` row is written correctly with scalars only.

## Deviations from Plan

### Auto-fixed Issues

None that required Rule 1/2/3 fixes to pre-existing code -- `sanitizeCypherInput`, `sendPacket`, and the Cypher templates were all already correct for their own purposes and were deliberately left untouched per the plan's explicit prohibition.

### Plan-text corrections (not code bugs, documentation gaps in the plan itself)

**1. `PART8_FORCE_BRAIN_AVAILABLE` does not apply to `brain-client.cjs`.**
- **Found during:** Task 1 (writing the live fail-closed proof)
- **Issue:** The plan's acceptance criteria and Task 3 read_first both instruct using `PART8_FORCE_BRAIN_AVAILABLE` to force `isAvailable()` true. That env var is read only inside `scripts/part8-egress-guard-hook.cjs`; `brain-client.cjs`'s own `isAvailable()` has no such seam.
- **Fix:** Used the codebase's actual working mechanism (fresh-require + `MINDRIAN_BRAIN_URL`/`MINDRIAN_BRAIN_KEY`, the same idiom `tests/test-brain-client-params.cjs` already uses) for both the Task 1 live proof and the Task 3 test suite. No code change; a verification-mechanics substitution, documented above and in the frontmatter `key-decisions`.
- **Files affected:** none (verification-only; the substitution is in this SUMMARY and in `tests/test-239-query-egress-canary.cjs`'s existing env-setup pattern, not a new deviation in production code).

---

**Total deviations:** 0 code deviations. 1 verification-mechanics substitution (documented above), consistent with the 239-01 precedent (scratch-probe path substitution) of naming a plan-text/environment mismatch rather than silently working around it.
**Impact on plan:** None on scope or acceptance. Every acceptance criterion in the plan was met using the codebase's real mechanism instead of the misnamed one in the plan text.

## Issues Encountered

- **`brain-client.cjs` is not on `scripts/check-substrate.cjs`'s `ALLOWED_DIRECT_IMPORT` allow-list**, and `scripts/hooks/pre-commit` runs `check-substrate.cjs --diff` on every commit. This ruled out the plan's literal suggestion of opening `room.db` from `roomDir` inside `hatAwareRecommend` to obtain a telemetry db handle. Resolved by using the `options.db` opt-in idiom (see Decisions Made #2) instead -- keeps both functions inside their declared `files_modified` fence (`lib/core/brain-client.cjs` only; `lib/core/navigation.cjs` untouched) and passes every pre-commit hook run during this plan's three commits.
- No other issues. All three tasks' acceptance criteria were met on first implementation; no fix-attempt-limit was approached.

## User Setup Required

None - no external service configuration required. This plan touches only `lib/core/brain-client.cjs` and adds one test file; it calls no live network (the capture server is a loopback `node:http` listener), installs zero packages, and requires no new environment variable in production (the `options.db` telemetry path activates only if a FUTURE caller chooses to pass one).

## Known Stubs

None. No hardcoded empty values, placeholder text, or unwired data sources were introduced. The `options.db` telemetry path is a real, tested code path (proven live in the Fail-Closed / Disclosure Proof above) that is simply unexercised by today's zero production callers -- documented as a decision, not left silent.

## Threat Flags

None. This plan's own `<threat_model>` (T-239-T2, T-239-T4, T-239-T5, T-239-T6, T-239-05-A, T-239-T7) is fully addressed by the delivered artifacts, each with a specific test leg or acceptance-criteria transcription above. No new network endpoints, auth paths, file-access patterns, or schema changes were introduced -- the guard reads existing in-memory function arguments and writes through the pre-existing `_logEventBestEffort` -> `navigation.cjs::logMemoryEvent` chokepoint, which already had `brain_egress_blocked` in its closed `EVENT_TYPES` vocabulary (via `sendPacket`'s pre-existing PB8-10 belt).

## Mutation Serialization Fence Compliance

Per the plan's mandatory mutation-serialization rules (this repo runs Wave 2 with `workflow.use_worktrees: false` in shared-tree mode elsewhere, but THIS execution ran in an isolated git worktree per the orchestrator's `isolation="worktree"` assignment, so the cross-plan collision hazard the plan describes for 239-02's sibling mutations on `brain-response-sanitize.cjs`/`hooks.json` did not apply to this worktree's file set): `git status --porcelain` was checked before mutating (clean) and the mutation was held for the shortest possible window (mutate -> single test run -> restore -> `git diff --stat` empty verification), per the plan's Rules 1-3. `bash tests/run-all-196.sh` and `bash tests/run-all-239.sh` were run as the LAST verification steps after the mutation was fully restored, per Rule 4.

## Next Phase Readiness

- `hooks/hooks.json` and `lib/core/brain-response-sanitize.cjs` (239-02's scope) remain untouched by this plan; `tests/run-all-239.sh`'s Leg A (dead-matcher census) correctly still reports FAILED, confirming this plan did not accidentally encroach on 239-02's fence.
- `tests/test-239-brain-tool-liveness.cjs`, `tests/test-239-pii-sanitizer-liveness.cjs`, `tests/test-239-sendpacket-parked.cjs`, `tests/test-239-verify-release-section-18.cjs` remain unauthored (239-03/239-04/239-06/239-07's scope respectively); `tests/run-all-239.sh`'s Leg B (test-file completeness) correctly still lists them as missing.
- `.planning/phases/239-brain-access-surface/deferred-items.md` D-239-05-01 is available for a future phase or RCA session to pick up once usage data on the new (higher) Brain-skip rate is available.
- No blockers. This plan's cross-phase scope fence held: zero files claimed by Phase 237 or Phase 238 were touched, and the only file this plan shares with a sibling 239 plan (`lib/core/brain-client.cjs`) was modified only inside the two functions and the one function (`hatAwareRecommend`, `suggestValidationSteps`, `query`) this plan's own `files_modified` names.

---
*Phase: 239-brain-access-surface*
*Completed: 2026-07-30*

## Self-Check: PASSED

- FOUND: lib/core/brain-client.cjs
- FOUND: tests/test-239-query-egress-canary.cjs
- FOUND: .planning/phases/239-brain-access-surface/deferred-items.md
- FOUND: .planning/phases/239-brain-access-surface/239-05-SUMMARY.md
- FOUND: commit fdec10f3 (Task 1)
- FOUND: commit 0c0042a4 (Task 2)
- FOUND: commit df89840d (Task 3)
