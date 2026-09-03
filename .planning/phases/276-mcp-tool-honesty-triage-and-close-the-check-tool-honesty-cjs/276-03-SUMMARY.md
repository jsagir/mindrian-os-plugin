---
phase: 276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs
plan: 03
subsystem: testing
tags: [mcp-tool-honesty, tdd-red, mcp-stdio-harness, node-assert, orchestration, room-content]

# Dependency graph
requires:
  - phase: 276-01
    provides: "tests/run-all-276.sh glob-discovery aggregator that auto-registers any tests/test-276-* file"
provides:
  - "tests/test-276-orchestration-scout-honesty.cjs, the RED proof for TOOLHON-03 (F-1): orchestration's false 'ordinary reads and writes' write claim, the missing /mos:scout self-disclosure, the false 'Scout intelligence gathered' completion assertion, and the stale membership-rule comment reasoning that scout* needs no disclosure -- all measured over a real MCP server spawned over stdio, never grepped"
  - "tests/test-276-room-content-honesty.cjs, the RED proof for TOOLHON-04 (F-11..F-14): room_content's WRITE-surface enumeration wrongly naming new-project/setup/invoke-persona while omitting update-funding-stage, the missing NOT-EXECUTED banner on the new-project/setup/update echo group, and the absent banner-driving Set membership -- plus a detector-agreeing (checker's own resolveWritePrimitives/resolveReachability) proof that invoke-persona stays read-only and the four genuine writers still write, and RESEARCH assumption A6 resolved as a measured fact"
affects: ["276-08 (must flip both RED commands to exit 0 with the description rewrites, the reused NOT-EXECUTED/filed:false primitives, and the membership-set extension)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Persistent stdio JSON-RPC session helper (spawnMcpSession): fuses test-234-tool-description-floor.cjs's spawn/env shape (hermetic mkdtemp HOME, MINDRIAN_TRANSPORT=stdio, MINDRIAN_ROOM=scratch dir, MINDRIAN_BRAIN_KEY deleted) with test-257-brain-tool-egress-invariant.cjs's persistent request/notify/cleanup pattern, so one server spawn serves both a tools/list description read AND N subsequent tools/call invocations -- needed because this plan's Group A (description) and Group B (in-band disclosure) assertions both require ground truth over the wire against the SAME live process"
    - "Detector-agreeing reachability proof via Function.prototype.toString(): rather than depend on scripts/check-tool-honesty.cjs's own scanAll()/splitBranches() (which is independently proven buggy on switch(command) dispatch by 276-01's D-1 finding, and would misclassify every room_content branch identically today), Group D/E extract the REAL production function's source text directly off the live module (personaOps.invokePersona.toString(), opportunityOps.fileOpportunity.toString(), etc.) and call the checker's exported resolveWritePrimitives()+resolveReachability() APIs against that isolated text -- agreeing with the detector by construction while sidestepping the unrelated D-1 branch-splitting bug entirely"
    - "Banner-driving Set discovery via proximity, not a naive literal scan: Group C's membership check cannot naively search for ANY Set literal containing {new-project, setup, update} as members, because WRITE_TOOLS already quotes all three (it drives the unrelated fireCascade dispatch) and would pass the assertion vacuously today, defeating RED. The check instead locates only Set(s) whose declared-identifier.has( call site sits within an 800-char following window of the literal 'NOT EXECUTED', then tests membership on THOSE -- correctly isolating UNIMPLEMENTED_MUTATING_ORCHESTRATION as today's sole banner-driving set (which does not name new-project/setup/update), while ignoring WRITE_TOOLS entirely"

key-files:
  created:
    - tests/test-276-orchestration-scout-honesty.cjs
    - tests/test-276-room-content-honesty.cjs
  modified: []

key-decisions:
  - "Group C's membership check (room_content test) was redesigned mid-task from 'does any Set literal in the router source contain new-project/setup/update' to 'does the Set that actually GATES the NOT EXECUTED banner text contain those three'. Verified live: the naive version passes today because WRITE_TOOLS (lib/mcp/tool-router.cjs:355-360, drives the unrelated fireCascade dispatch) already quotes all three tokens for a completely different reason, which would make the assertion pass vacuously pre-fix -- exactly the false-success shape this phase exists to close. Fixed by tracing each declared `const IDENT = new Set([...])` to its `IDENT.has(` call sites and checking whether 'NOT EXECUTED' appears within an 800-character following window, isolating UNIMPLEMENTED_MUTATING_ORCHESTRATION (which genuinely gates the banner today, and genuinely does not name these three commands) as the only banner-driving set."
  - "Group D/E (room_content test) deliberately do NOT call scripts/check-tool-honesty.cjs's scanAll() against the live tool-router.cjs, even though the plan's read_first section frames this as 'agrees with the detector by construction'. Verified live via scanAll({files:[tool-router.cjs]}) that EVERY room_content command today (including read-only ones like list-opportunities and list-personas) reports verdict OK 'a write primitive is reachable' -- a direct, measured consequence of 276-01's own D-1 finding (splitBranches returns an empty branchMap for room_content's switch(command), so every branch's effectiveText collapses to the shared body, which does contain writes somewhere). Using scanAll() directly would make Group D (invoke-persona read-only) and Group E (four genuine writers) indistinguishable from each other today, defeating the plan's own acceptance criterion that D and E PASS in the RED run to prove the test discriminates. Instead, Group D/E extract each REAL function's own source via Function.prototype.toString() (bypassing tool-router.cjs's branch-splitting entirely) and call resolveWritePrimitives()+resolveReachability() directly against that isolated text -- still the checker's own exported API, still agreeing with the detector by construction, but targeting the underlying lib/core function rather than the currently-unsplittable switch branch."
  - "The A6 trace (RESEARCH assumption, Group F) is a genuine behavioral measurement, not a source read: lib/core/intelligence-cascade.cjs's runCascade() was called directly with the EXACT arguments tool-router.cjs:770's own call site passes (fireCascade(roomDir, command, section) omits the 4th `result` arg, so filePath collapses to ''). Measured result: runCascade short-circuits at its own filePath guard (intelligence-cascade.cjs:648-652, `if (!filePath) { skipped: true, skipReason: 'no filePath provided' }`) BEFORE reaching any of its downstream steps (classification, graphIndex, hsi, reverseSalients, presentation, gitCommit). This resolves A6 more precisely than 'unverified': for the new-project/setup/update echo group specifically, fireCascade never reaches ANY leaf write, regardless of what those downstream steps would otherwise do -- the disposition (the echo group's write claim is false) is unchanged either way, but the mechanism is now a measured fact with file:line citations rather than an assumption."

requirements-completed: [TOOLHON-03, TOOLHON-04]

# Metrics
duration: 27min
completed: 2026-09-03
---

# Phase 276 Plan 03: Layer 1 RED Tests (orchestration/scout + room_content Honesty) Summary

**Two RED tests proving, against a live MCP server driven over real stdio JSON-RPC, that `orchestration`'s scout family and `room_content`'s WRITE-surface claim both overclaim what their handlers actually do -- plus a detector-agreeing proof that room_content's four genuine writers still write and invoke-persona stays read-only, and a measured (not assumed) resolution of RESEARCH assumption A6.**

## Performance

- **Duration:** ~27 min
- **Started:** 2026-09-03T17:09:00Z (approx, first file read)
- **Completed:** 2026-09-03T17:36:00Z
- **Tasks:** 2 completed
- **Files modified:** 2 (both new)

## Accomplishments

- `tests/test-276-orchestration-scout-honesty.cjs`: 6 assertion groups (A_DESCRIPTION_OVER_WIRE, B_IN_BAND_DISCLOSURE, C_FALSE_COMPLETION_FORBIDDEN, D_MEMBERSHIP_RULE_CORRECTED, E_MEETING_REGRESSION_GUARD) against a real `bin/mindrian-mcp-server.cjs` spawned over stdio. Observed failing: exit 1, 6 passed / 6 failed. Groups A1, A2, C1, C2 and D1 fail exactly as the plan's acceptance criteria require; Group E (the shipped `meeting` fix) passes even in this RED run, proving the regression guard itself works.
- `tests/test-276-room-content-honesty.cjs`: 6 assertion groups (A_WRITE_SURFACE_ENUMERATION, B_NOT_EXECUTED_BANNER, C_MEMBERSHIP, D_INVOKE_PERSONA_READ_ONLY, E_GENUINE_WRITERS_STILL_WRITE, F_A6_FIRECASCADE_TRACE). Observed failing: exit 1, 18 passed / 8 failed. Groups A1 (3 of 4 forbidden tokens present), A2 (`update-funding-stage` missing from the description), B (all three of new-project/setup/update lack the NOT-EXECUTED banner), and C (no Set gates that banner for these three commands) all fail as required. Group D (invoke-persona resolves NO_WRITE) and Group E (all four genuine writers resolve WRITES) both PASS in the RED run, proving the test discriminates rather than failing wholesale.
- Both descriptions and both in-band responses are measured over a genuine `initialize -> notifications/initialized -> tools/list -> tools/call` JSON-RPC sequence against the real server, never a source grep -- matching `tests/test-234-tool-description-floor.cjs`'s own discipline (re-run and confirmed still green, unaffected: 168 passed / 0 failed).
- Neither test mints a third disclosure marker; both accept only the two shipped primitives (`**filed: false**` / `NOT EXECUTED.`), asserted as a subset check on every marker-shaped literal found in each response.
- RESEARCH assumption A6 resolved as a measured fact (see Decisions and the RED Test Output section below), with file:line citations to `lib/mcp/tool-router.cjs:770` and `lib/core/intelligence-cascade.cjs:648-652`.
- Zero production files touched. `grep -nP '\x{2014}'` returns no match on either file.

## Task Commits

Each task was committed atomically:

1. **Task 1 + Task 2: both RED test files** - `e69fc7bd` (test) -- per this plan's own Task 2 acceptance criteria ("Both test files committed in one commit"), `git diff --cached --name-only` immediately before the commit listed exactly the two test files and nothing else, verified before staging.

**Plan metadata:** committed alongside this SUMMARY, STATE.md, and ROADMAP.md updates (see below).

## Files Created/Modified

- `tests/test-276-orchestration-scout-honesty.cjs` (318 lines) - the F-1 RED proof. A self-contained `spawnMcpSession()` stdio helper (persistent JSON-RPC session), 6 assertion groups, a shell-out regression guard against `tests/test-kwl-meeting-mcp-honesty.cjs`.
- `tests/test-276-room-content-honesty.cjs` (440 lines) - the F-11..F-14 RED proof. Its own `spawnMcpSession()` helper (duplicated rather than shared, per the plan's `files_modified` declaring only the two test files), a proximity-based `findBannerDrivingSetsContainingAll()` source-text analyzer, detector-agreeing reachability checks via the checker's exported API, and the live A6 `runCascade()` trace.

## Decisions Made

See `key-decisions` in frontmatter. Summarized: two assertion designs were corrected mid-task after a live probe showed the plan's literal framing would pass vacuously pre-fix (Group C's naive Set scan collided with the unrelated `WRITE_TOOLS` set; Group D/E's initial instinct to route through `scanAll()` would have inherited 276-01's own D-1 bug and made every room_content command indistinguishable). The A6 trace was executed live rather than inferred from source reading, per the plan's explicit instruction not to carry an unverified assumption forward.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in plan's literal framing] Group C (room_content) naive Set-literal scan passes vacuously today**
- **Found during:** Task 2, while drafting the membership assertion
- **Issue:** A straightforward "does any `new Set([...])` literal in `lib/mcp/tool-router.cjs` contain `new-project`, `setup` AND `update`" check returns true today via `WRITE_TOOLS` (`:355-360`), which drives the completely unrelated `fireCascade` dispatch decision, not the NOT-EXECUTED banner. Live probe confirmed: `WRITE_TOOLS` and `UNIMPLEMENTED_MUTATING_ORCHESTRATION` are the only two `new Set([...])` literals in the file, and `WRITE_TOOLS` alone already satisfies a naive "contains all three" check, which would make this assertion PASS pre-fix -- the exact false-success shape this phase exists to close.
- **Fix:** Rewrote the check to `findBannerDrivingSetsContainingAll()`: locate every declared `const IDENT = new Set([...])`, find every `IDENT.has(` call site, and only consider a Set "banner-driving" if the literal `NOT EXECUTED` appears within an 800-character window following that call site. Live-verified this correctly isolates `UNIMPLEMENTED_MUTATING_ORCHESTRATION` (which does not name any of the three commands today) and correctly excludes `WRITE_TOOLS`.
- **Files modified:** `tests/test-276-room-content-honesty.cjs`
- **Verification:** `node tests/test-276-room-content-honesty.cjs` shows Group C1 as FAIL with `banner-driving sets found: ["UNIMPLEMENTED_MUTATING_ORCHESTRATION"]`.
- **Committed in:** `e69fc7bd`

**2. [Rule 1 - Bug in plan's literal framing] Group D/E (room_content) via `scanAll()` would inherit the unrelated D-1 bug and fail to discriminate**
- **Found during:** Task 2, while drafting the invoke-persona-read-only and genuine-writers assertions
- **Issue:** The plan's read_first text frames Group D as using "the checker's own `resolveWritePrimitives` plus `resolveReachability` exports ... so the assertion agrees with the detector by construction," which reads most naturally as calling `scanAll()` against the live `tool-router.cjs`. Live probe: `scanAll({files:[{absPath: 'lib/mcp/tool-router.cjs', ...}]})` reports **every** `room_content` command today, including read-only ones (`list-opportunities`, `list-personas`, `detect-integrations`, `help`), as verdict `OK` with reason `"a write primitive is reachable"` -- a direct, measured consequence of 276-01's own D-1 finding (`splitBranches` returns an empty `branchMap` for `room_content`'s `switch (command)`, so every branch's `effectiveText` collapses to the undivided shared body, which does contain writes somewhere). Routing Group D/E through `scanAll()` would make `invoke-persona` and the four genuine writers indistinguishable from each other today, which would violate the plan's own acceptance criterion that "Group D and Group E PASS in the RED run ... proving the test discriminates rather than failing wholesale."
- **Fix:** Extract each REAL production function's own source directly (`personaOps.invokePersona.toString()`, `opportunityOps.fileOpportunity.toString()`, etc., i.e. bypassing `tool-router.cjs`'s currently-unsplittable switch entirely) and call the checker's exported `resolveWritePrimitives()` + `resolveReachability()` against that isolated text. This is still the checker's own exported API used exactly as designed (still "agrees with the detector by construction"), but targets the underlying `lib/core` function body rather than the branch-splitting machinery that D-1 (a different, already-pinned defect from plan 276-01) has independently broken.
- **Files modified:** `tests/test-276-room-content-honesty.cjs`
- **Verification:** Live probe confirmed `reachabilityOf(personaOps.invokePersona, ...)` returns `NO_WRITE` and all four genuine writers return `WRITES`; the full test run shows Group D1 and all four Group E1 checks as `ok` even in this RED run.
- **Committed in:** `e69fc7bd`

---

**Total deviations:** 2 auto-fixed (both Rule 1, both corrected via a live probe before finalizing, neither reached a commit in a vacuously-passing state).
**Impact on plan:** No scope creep. Both fixes kept the tests genuinely discriminating (never vacuously green pre-fix, never wholesale-failing on correct current behavior) and stayed within the plan's own two-file scope. Neither touched a production file.

## Issues Encountered

None beyond the two auto-fixed items above.

## RED Test Output (recorded verbatim per acceptance criteria)

### `node tests/test-276-orchestration-scout-honesty.cjs` -- exits **1**, `6 passed, 6 failed`

```
- A1: description does NOT contain the false write assertion "ordinary reads and writes" :: FAIL (present)
- A2: description names the executing surface explicitly (`/mos:scout`) :: FAIL (absent)
- A3 (floor/cap): ok / ok
- B1: response discloses reference-only status via a shipped primitive :: FAIL (neither present)
- B2: no third disclosure marker :: ok (vacuous -- none present at all today)
- C1: response does NOT contain "Scout intelligence gathered" :: FAIL (present)
- C2: Suggested Next rationale matches "Instructions returned" :: FAIL (actual: "Scout intelligence gathered - analyze room")
- D1: stale membership-rule reasoning ("scout* ... capability gap, not a false claim") is gone :: FAIL (still present)
- E1: tests/test-kwl-meeting-mcp-honesty.cjs still exits 0 :: ok
```

### `node tests/test-276-room-content-honesty.cjs` -- exits **1**, `18 passed, 8 failed`

```
- A1 (new-project token forbidden) :: FAIL (present)
- A1 (setup token forbidden) :: FAIL (present)
- A1 (update token forbidden) :: ok (correctly absent from the WRITE-surface sentence today)
- A1 (invoke-persona token forbidden) :: FAIL (present)
- A2 (file-opportunity present) :: ok
- A2 (create-funding present) :: ok
- A2 (update-funding-stage present) :: FAIL (absent from description entirely)
- A2 (generate-personas present) :: ok
- A3 (contrast clause, floor, cap) :: ok / ok / ok
- B1 (new-project carries NOT EXECUTED) :: FAIL
- B1 (setup carries NOT EXECUTED) :: FAIL
- B1 (update carries NOT EXECUTED) :: FAIL
- B2 (no third marker, all three commands) :: ok / ok / ok (vacuous -- neither marker present)
- C1 (banner-driving Set names new-project/setup/update) :: FAIL (only UNIMPLEMENTED_MUTATING_ORCHESTRATION gates the banner, and it names none of the three)
- D1 (invoke-persona resolves NO_WRITE via checker API) :: ok
- E1 (file-opportunity resolves WRITES) :: ok
- E1 (create-funding resolves WRITES) :: ok
- E1 (update-funding-stage resolves WRITES) :: ok
- E1 (generate-personas resolves WRITES) :: ok
- F1 (A6 trace) :: ok (see resolution below)
```

`bash tests/run-all-276.sh` picks up both new files automatically via glob discovery (no runner edit required); it remains RED overall per Wave 0's own design (276-01/276-02's arms are also still RED, all correctly awaiting their respective GREEN plans).

## RESEARCH Assumption A6 Resolution (measured fact, required by this plan)

**`fireCascade` does NOT reach a leaf write for the `new-project`/`setup`/`update` echo group, measured directly against the real `lib/core/intelligence-cascade.cjs::runCascade`, not assumed.**

`lib/mcp/tool-router.cjs:770` calls `await fireCascade(roomDir, command, section);` -- three arguments, omitting the 4th (`result`). `fireCascade` (`lib/mcp/tool-router.cjs:580-588`) then computes `const filePath = (result && result.filePath) || '';`, which collapses to the empty string since `result` is `undefined` at this call site. It then calls `runCascade(roomDir, { trigger: 'mcp-tool', filePath: '', section: section || '' })`.

Called live with these exact arguments against a scratch room:
```json
{"trigger":"mcp-tool","roomDir":"<scratch>","filePath":null,"skipped":true,"classification":null,"graphIndex":null,"hsi":null,"reverseSalients":null,"hsiBridge":null,"presentation":null,"binaryAsset":null,"gitCommit":null,"skipReason":"no filePath provided"}
```

`runCascade`'s own guard (`lib/core/intelligence-cascade.cjs:648-652`, `if (!filePath) { results.skipped = true; results.skipReason = 'no filePath provided'; return results; }`) fires immediately, BEFORE any of the downstream steps (classification, graph index, HSI, reverse salients, presentation, git commit) ever run. **This resolves A6 more precisely than "unverified": for this specific echo group's call shape, `fireCascade` never reaches ANY leaf write, regardless of what those downstream steps would otherwise do.** The disposition this plan's Group F assertion states plainly (from the original plan text) is unchanged either way -- the cascade, even if it did write something, would be downstream bookkeeping and not the project/section creation the description promises -- but the mechanism is now a measured fact with file:line citations, not an assumption carried forward.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 276-08 has two executable, unambiguous targets:
  - `node tests/test-276-orchestration-scout-honesty.cjs` must flip A1/A2/B/C1/C2/D1 from FAIL to PASS: rewrite `orchestration`'s description to drop "ordinary reads and writes" and name `/mos:scout` explicitly, add an in-band disclosure (`**filed: false**` or `NOT EXECUTED.`) to the scout branch, drop the false "Scout intelligence gathered" `Suggested Next` rationale in favor of the honest "Instructions returned" template, and rewrite the stale `scout*`-needs-no-disclosure membership comment -- all without breaking Group E (the `meeting` regression guard) or `test-234`'s floor/cap.
  - `node tests/test-276-room-content-honesty.cjs` must flip A1/A2/B/C from FAIL to PASS: rewrite `room_content`'s WRITE-surface enumeration to drop `new-project`/`setup`/`invoke-persona` and add `update-funding-stage`, extend (or mint a room_content-scoped variant of) the banner-driving membership set to include `new-project`/`setup`/`update`, and wire the NOT-EXECUTED banner into that echo group's response -- all without breaking Group D (`invoke-persona` must stay `NO_WRITE`) or Group E (the four genuine writers must stay `WRITES`).
- No blockers. This plan wrote no production code and touched nothing under `scripts/`, `lib/`, or `bin/`, matching the plan's own success criteria and threat-model disposition (`mitigate`, satisfied).

---
*Phase: 276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs*
*Completed: 2026-09-03*

## Self-Check: PASSED

Both created test files verified present on disk (`tests/test-276-orchestration-scout-honesty.cjs`, `tests/test-276-room-content-honesty.cjs`), this SUMMARY.md verified present on disk, and the task commit (`e69fc7bd`) verified present in `git log --oneline --all`.
