---
phase: 276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs
plan: 08
subsystem: mcp-tool-descriptions
tags: [mcp-tool-honesty, tool-router, description-correction, not-executed-banner, no-write-banner, negation-tuning]

# Dependency graph
requires:
  - phase: 276-03
    provides: "tests/test-276-orchestration-scout-honesty.cjs and tests/test-276-room-content-honesty.cjs, the two RED pins this plan flips to GREEN"
  - phase: 276-06
    provides: "the D-1 splitBranches GREEN fix and the corrected UNIMPLEMENTED_MUTATING_ORCHESTRATION banner mechanism this plan extends"
  - phase: 276-07
    provides: "the enumeration-guard and file-noun-usage detector fixes this plan's description rewrites had to write AROUND (isEnumeratedCommandName's comma/and-or adjacency requirement, isFileNounUsage's narrow demotion list) plus the amended 276-dispositions.json ledger (export's 7 rows re-owned to this plan)"
provides:
  - "orchestration's description no longer claims scout* performs \"ordinary reads and writes\"; names /mos:scout as the real executing surface; scout family (6 commands) joins UNIMPLEMENTED_MUTATING_ORCHESTRATION and now carries the shipped NOT EXECUTED banner"
  - "export's description states what the MCP handler actually returns (instructions plus room context, not a render) and names the matching /mos: CLI command per format; the export branch leads every response with noWriteBanner(); the three false completion assertions (\"[artifact] generated\" x2, and the fallback's completion claim) replaced with the honest template"
  - "room_content's WRITE-surface enumeration corrected to name only the four commands that reach a write primitive (file-opportunity, create-funding, update-funding-stage, generate-personas), derived from live checkTree() output; new-project/setup/update join UNIMPLEMENTED_MUTATING_ORCHESTRATION and now carry the NOT EXECUTED banner; invoke-persona's description-only fix states it reads and performs no write"
  - "the UNIMPLEMENTED_MUTATING_ORCHESTRATION membership rule's own comment rewritten to state the corrected test (does the DESCRIPTION claim a write, not does the handler mutate-and-lack-a-branch), and the set is now explicitly shared across the orchestration and room_content tools by command name"
  - "a genuine pre-existing bug fixed in room_content's echo-group branch: the missing-reference \"not found\" line was bound to `if (context) ... else ...` (fired whenever no context was supplied, regardless of whether the reference existed) instead of `if (ref) ... else ...`"
affects: ["276-11 (gate_render's own honest rewrite reuses the same four-move pattern and the 'nothing is persisted' negation entry)", "276-15 (re-freezes frozen_sweep.tools/branches to 37/131 and re-verifies the disposition ledger against this plan's now-fully-OK sweep; also inherits the two pre-existing out-of-scope findings named below unchanged by this plan)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dry-run a description rewrite against the live checker BEFORE editing the file: scripts/check-tool-honesty.cjs exports extractClaims(description, vocabulary), so a candidate description string can be tested in a throwaway `node -e` call against the real STRONG_VERBS/WEAK_VERBS/negation logic, catching a false-positive claim (a disclosure sentence accidentally tripping a STRONG_VERBS or WEAK_VERBS token) before it ever lands in tool-router.cjs. Used for every one of this plan's three description rewrites; caught three distinct false positives pre-commit (the 'write' verb attached to new-project/setup, the 'file' noun in 'persona file' attached to invoke-persona, the 'Create...room' CREATE_NOUNS trigger attached to 'update') and one post-commit regression (the 'snapshot' WEAK_VERBS token in scout's disclosure sentence bleeding onto rooms-open because both were named in the same sentence)."
    - "The shipped noWriteBanner()/NOT-EXECUTED-banner distinction is NOT symmetric in the detector: classifyBranch's hasBanner check (scripts/check-tool-honesty.cjs:1312-1313) only recognizes the literal noWriteBanner( call or the **filed: false** marker text -- it has no equivalent recognition of the 'NOT EXECUTED.' banner literal at all. A command wired into UNIMPLEMENTED_MUTATING_ORCHESTRATION (and therefore carrying the NOT EXECUTED banner in its live response) still needs its DESCRIPTION to carry zero STRONG/WEAK claim, or the checker will report it MEDIUM/HIGH_RISK regardless of the in-band banner. Discovered live via orchestration.scout still reading MEDIUM after the banner was wired; fixed by description wording alone (per the plan's own 'no detector edits' rule), not by touching the detector to recognize the second marker. Worth flagging as a real detector-coverage gap (a candidate future finding) for whichever plan next touches scripts/check-tool-honesty.cjs -- NOT fixed here."
    - "A description sentence's claim vocabulary attachment is SENTENCE-scoped, not clause-scoped: extractClaims splits the description on sentence terminators and attaches whichever STRONG/WEAK verb tier the WHOLE sentence trips to EVERY vocabulary member named anywhere in that same sentence. Two unrelated commands named in one sentence (e.g. 'rooms-open genuinely switches..., but scout...') share whatever claim tier the sentence trips, even when the trigger word only pertains to one of them. The fix is always to SPLIT into separate sentences per named command, not to try to scope the claim narrower within one sentence (the detector has no clause-level granularity)."

key-files:
  created: []
  modified:
    - lib/mcp/tool-router.cjs

key-decisions:
  - "The 'rooms-' sibling Suggested Next rationale ('Room operation complete - check status', still used by rooms-list/rooms-where after this task) was reviewed against the same F-1 standard per the plan's explicit instruction and left UNCHANGED: rooms-list/rooms-where's descriptions make no persistence claim (the honest 'capability gap, not a false claim' reasoning the membership-rule comment already states), and the fallback genuinely does complete the one operation it performs (returning the reference) -- unlike scout's old claim, which promised gathered intelligence a reference-echo cannot deliver. Documented in a code comment at the call site rather than silently left alone, per the plan's 'state the finding either way' instruction."
  - "UNIMPLEMENTED_MUTATING_ORCHESTRATION (not a new set) is reused for room_content's new-project/setup/update, per 276-PATTERNS.md's explicit guidance ('prefer extending the SAME set if its rule now reads the description claims it'). Verified safe: command names are unique across the whole ALL_TOOL_COMMANDS vocabulary (no orchestration command is named 'new-project'/'setup'/'update', and vice versa), so one Set correctly gates both tools' fallback branches without any cross-tool leakage."
  - "The dead `else if (command.startsWith('scout'))` Suggested Next branch (the literal 'Scout intelligence gathered - analyze room' string) was REMOVED rather than left as unreachable code, because scout* now hits the `unimplementedMutation` branch first unconditionally. Leaving a dead, misleading branch in place risks a future edit resurrecting it by accident; removing it and documenting why in a comment is safer than dead code."
  - "generate-personas' conditional STRONG write claim ('only writes for an explicit preview') was deliberately kept attached to generate-personas in the WRITE-surface sentence rather than hedged further -- it is already a genuine writer (Group E of the RED test independently confirms reachability=WRITES via the checker's own resolveReachability against the real persona-ops.cjs function), so the claim is TRUE, not a defect this plan needed to soften."
  - "A found-during-verification regression in this plan's OWN Task 1 commit (orchestration description) was fixed within Task 3 rather than by amending the Task 1 commit: sequential per-task commits are additive by design (per the executor's own no-amend rule), and the regression was only observable once Task 3's verify step re-ran checkTree() with room_content's own new banner wiring in place. Documented in full in Task 3's commit message rather than silently folded in."

requirements-completed: [TOOLHON-03, TOOLHON-04]

# Metrics
duration: ~55min
completed: 2026-09-03
---

# Phase 276 Plan 08: Orchestration, Export and room_content Honesty Propagation Summary

**Propagated the shipped `meeting` honesty-fix pattern (honest description + shipped in-band marker + honest Suggested Next) to `orchestration`'s scout family, `export`'s all seven commands, and `room_content`'s echo group, closing all four `check-tool-honesty.cjs` HIGH RISK findings and dropping the live sweep's global HIGH RISK count to zero.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-09-03T~22:10:00+03:00 (approx, first file read)
- **Completed:** 2026-09-03T23:00:28+03:00 (final task commit)
- **Tasks:** 3 completed
- **Files modified:** 1 (`lib/mcp/tool-router.cjs`, three separate commits)

## Accomplishments

- **Task 1 (F-1, orchestration/scout).** Removed the false "ordinary reads and writes" claim; named `/mos:scout` as the real executing surface. `scout`, `scout-health`, `scout-deadlines`, `scout-competitors`, `scout-hsi`, `scout-snapshot` all joined `UNIMPLEMENTED_MUTATING_ORCHESTRATION`, so every one now carries the shipped `NOT EXECUTED.` banner in its live response instead of silently claiming a write. Removed the now-dead-and-misleading `'Scout intelligence gathered - analyze room'` Suggested Next branch. Rewrote the membership-rule comment to state the corrected test (the description CLAIMS a write, not the handler mutates-and-lacks-a-branch). `git log -S "ordinary reads and writes"` confirmed the claim entered in `71f15a3c` (Phase 234-02), the same commit that introduced `meeting`'s now-fixed claim -- resolving RESEARCH open question 6.
- **Task 2 (F-2..F-8, export).** Rewrote export's description to state what the MCP handler actually returns (instructions plus room context, never a rendered artifact) and named the matching `/mos:` CLI command per format, keeping the genuinely useful audience-selection guidance. The export branch now leads every response with `noWriteBanner()`, verified live over stdio. Added the previously-missing explicit not-found line for a missing reference. Replaced the three false completion assertions ("Snapshot generated", "Dashboard generated", "Export complete") with the honest "Instructions returned - run [...], then verify" template, adapted per format.
- **Task 3 (F-11..F-14, room_content).** Corrected the WRITE-surface enumeration to name only the four commands that reach a write primitive (`file-opportunity`, `create-funding`, `update-funding-stage`, `generate-personas`), derived from live `checkTree()` output rather than copied from research text. `new-project`, `setup`, `update` joined the SAME `UNIMPLEMENTED_MUTATING_ORCHESTRATION` set Task 1 revised (command names never collide across tools) and now carry the NOT EXECUTED banner; `help` correctly stays out. `invoke-persona` got a description-only fix (states it reads a persona document and performs no write); its own case body (`:914-928`) is byte-identical, confirmed by diff. Fixed a genuine pre-existing bug found while touching the same branch: the "reference file not found" line was bound to `if (context) ... else ...` instead of `if (ref) ... else ...`, so it fired whenever no `context` argument was supplied regardless of whether the reference actually existed -- corrected to gate on the right variable.
- **Found and fixed during Task 3's own verification, a regression in Task 1's own commit:** the scout disclosure sentence's parenthetical "(a .snapshots/ state snapshot, ...)" put the WEAK_VERBS token "snapshot" in the same sentence as "rooms-open genuinely switches...", and `extractClaims`'s sentence-scoped (not clause-scoped) attachment attached that WEAK claim to BOTH named commands -- producing a brand-new, undispositioned `orchestration.rooms-open` MEDIUM finding. Fixed by splitting into two sentences and swapping "state snapshot" for "state capture"; this same fix also closed the pre-existing `orchestration.scout` MEDIUM the ledger already expected this plan to reach OK (the checker recognizes `noWriteBanner()` calls but has NO equivalent recognition of the `NOT EXECUTED.` banner literal -- a genuine detector-coverage gap, documented in tech-stack patterns above, not fixed here per the plan's "no detector edits" rule).
- **Global HIGH RISK count: 0** (verification.md's own bar), measured by `checkTree()` after all three tasks.

## Task Commits

Each task was committed atomically:

1. **Task 1: orchestration/scout honesty (F-1)** - `d66a8a68` (fix)
2. **Task 2: export honesty (F-2..F-8)** - `43e3308e` (fix)
3. **Task 3: room_content honesty (F-11..F-14), plus the Task-1-regression fix found during this task's own verification** - `15d65f47` (fix)

**Plan metadata:** committed alongside this SUMMARY, STATE.md, and ROADMAP.md updates (see below).

## Files Created/Modified

- `lib/mcp/tool-router.cjs` - three targeted diffs across the same file: `orchestration`'s description and membership set (Task 1), `export`'s description, banner, and three Suggested Next rationales (Task 2), `room_content`'s description, membership set, banner wiring, and the missing-reference bug fix (Task 3).

## Decisions Made

See `key-decisions` in frontmatter. Summarized: (1) `rooms-list`/`rooms-where`'s "Room operation complete" rationale was reviewed against the F-1 standard and deliberately left unchanged (no persistence claim exists to make it false), documented at the call site; (2) `UNIMPLEMENTED_MUTATING_ORCHESTRATION` is reused (not duplicated) across `orchestration` and `room_content` since command names never collide; (3) the dead scout Suggested Next branch was removed rather than left unreachable; (4) `generate-personas`' conditional write claim was kept as-is because it is true; (5) the Task 1 regression found during Task 3 was fixed forward in Task 3's own commit rather than amending Task 1, per the no-amend executor rule.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] room_content's missing-reference "not found" line bound to the wrong condition**
- **Found during:** Task 3, while implementing Move 3 (confirm the missing-reference arm emits an explicit not-found line)
- **Issue:** The pre-existing code read `if (ref) parts.push(...); if (context) parts.push(...); else parts.push('Reference file for "${command}" not found.');` -- the `else` bound to `if (context)`, not `if (ref)`, so the "not found" line fired whenever NO context argument was supplied, regardless of whether the reference file actually existed. This is the inverse of the intended behavior.
- **Fix:** Reordered to `if (ref) parts.push(...); else parts.push('...not found.'); if (context) parts.push(...);` -- gates the not-found line on `ref`, matching the shape at `:1400-1402` (the `meeting` fix's own not-found pattern) and the orchestration fallback's existing correct version.
- **Files modified:** `lib/mcp/tool-router.cjs`
- **Verification:** `node tests/test-276-room-content-honesty.cjs` Group B (NOT_EXECUTED_BANNER) passes; live stdio calls to `new-project`/`setup`/`update` confirmed correct Reference-section behavior.
- **Committed in:** `15d65f47` (Task 3 commit)

**2. [Rule 1 - Bug] Task 1's own scout disclosure sentence regressed orchestration.rooms-open**
- **Found during:** Task 3, while re-running the full checker verification suite after wiring room_content's own banner
- **Issue:** Task 1's committed description read "rooms-open genuinely switches the active room, but scout and its variants only return the scout reference plus current room context, not gathered intelligence; run /mos:scout on the CLI for the real scan (a .snapshots/ state snapshot, a competitor report, the HSI pipeline)." The WEAK_VERBS token "snapshot" inside the scout-only parenthetical was attached by `extractClaims`'s sentence-scoped matching to BOTH named commands in that one sentence -- `rooms-open` AND `scout` -- producing a brand-new, undispositioned `orchestration.rooms-open` MEDIUM finding (`test-276-tool-honesty-findings-closed.cjs` Group C flagged it as a live non-OK row with no ledger entry). Separately, `orchestration.scout` itself stayed MEDIUM even after gaining the NOT EXECUTED banner, because `classifyBranch`'s `hasBanner` check only recognizes `noWriteBanner()`/`**filed: false**`, never the `NOT EXECUTED.` banner literal -- a real detector-coverage gap.
- **Fix:** Split the sentence in two ("rooms-open genuinely switches the active room." as its own claim-free sentence, then a separate sentence for scout) and replaced "state snapshot" with "state capture" to remove scout's own WEAK_VERBS trigger, closing both `orchestration.rooms-open` (never a finding to begin with once split) and the pre-existing `orchestration.scout` MEDIUM the plan's own ledger expected this task to reach OK.
- **Files modified:** `lib/mcp/tool-router.cjs`
- **Verification:** `node -e "checkTree()..."` confirmed `orchestration.rooms-open` and `orchestration.scout` both absent from `highRisk`/`medium`/`low`/`unknown` (fully OK); `test-276-tool-honesty-findings-closed.cjs` no longer flags `orchestration.scout` as an unclosed expected-OK row.
- **Committed in:** `15d65f47` (Task 3 commit, documented in full in the commit message)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - bug fixes discovered while implementing the plan's own declared scope; neither introduced new scope beyond making the honesty fix actually correct)
**Impact on plan:** No scope creep. Both fixes were direct, necessary corrections to make this plan's own declared work actually land correctly; deviation 2 also closed a finding (`orchestration.scout`) the plan's own ledger expected this task to close, which a less careful pass could have left MEDIUM.

## Issues Encountered

- **A real detector-coverage gap, found and NOT fixed (out of this plan's scope per its own "no detector edits" rule).** `scripts/check-tool-honesty.cjs`'s `classifyBranch` (`:1312-1313`) recognizes the `noWriteBanner()` call / `**filed: false**` marker as an in-band disclosure that unconditionally resolves a branch to OK, but has NO equivalent recognition of the `NOT EXECUTED.` banner literal at all. Every command wired into `UNIMPLEMENTED_MUTATING_ORCHESTRATION` (rooms-new/close/archive from before this phase, plus scout* and new-project/setup/update added by this plan) relies entirely on its DESCRIPTION carrying zero STRONG/WEAK claim to read OK -- the in-band banner itself provides no detector credit. This worked out fine for every row this plan needed to close (all reachable via careful wording), but it is a real asymmetry between the two "shipped primitives" Canon Part 7 treats as equivalent, worth a `hasBanner` extension in a future detector-touching plan (candidate for 276-15 or a later finding).
- Extracted claims are sentence-scoped, not clause-scoped (see tech-stack patterns) -- every multi-command disclosure sentence in this plan's three rewrites was dry-run against the checker's own `extractClaims()` export before landing in the file, specifically to catch this class of cross-command claim bleed before it became a committed regression.

## RED-to-GREEN Flip (recorded verbatim per acceptance criteria)

### `node tests/test-276-orchestration-scout-honesty.cjs`

RED at end of 276-03: exit 1, 6 passed / 6 failed. GREEN after this plan: **exit 0, 12 passed / 0 failed** (groups: A_DESCRIPTION_OVER_WIRE, B_IN_BAND_DISCLOSURE, C_FALSE_COMPLETION_FORBIDDEN, D_MEMBERSHIP_RULE_CORRECTED, E_MEETING_REGRESSION_GUARD).

### `node tests/test-276-room-content-honesty.cjs`

RED at end of 276-03: exit 1, 18 passed / 8 failed. GREEN after this plan: **exit 0, 26 passed / 0 failed** (groups: A_WRITE_SURFACE_ENUMERATION, B_NOT_EXECUTED_BANNER, C_MEMBERSHIP, D_INVOKE_PERSONA_READ_ONLY, E_GENUINE_WRITERS_STILL_WRITE, F_A6_FIRECASCADE_TRACE).

### `orchestration` description byte length (Task 1 acceptance criterion)

Before: 539 bytes. After: 733 bytes (non-negative delta, +194 bytes). Well under the 2048-byte host cap; clears the 120-char floor.

### `export` description byte length

Before: 490 bytes. After: 725 bytes (non-negative delta, +235 bytes).

### `room_content` description byte length

Before: 595 bytes. After: 960 bytes (non-negative delta, +365 bytes).

### Checker (`checkTree()`) totals, before/after this plan (verbatim)

| | Before 276-08 (post-276-07) | After Task 1 | After Task 2 | After Task 3 (final) |
|---|---|---|---|---|
| Tools / branches | 37 / 131 | 37 / 131 | 37 / 131 | 37 / 131 |
| HIGH_RISK | 12 | 0 (orchestration) | 0 (orchestration + export) | **0 (global)** |
| room_content HIGH_RISK | 4 | 4 | 4 | **0** |
| orchestration HIGH_RISK | (part of 12) | 0 | 0 | 0 |
| export non-OK rows | 7 | 7 | **0** | 0 |

Global `checkTree().highRisk.length` after all three tasks: **0**, matching `verification.md`'s own bar.

### `git log -S "ordinary reads and writes"` (RESEARCH open question 6, answered)

```
71f15a3c feat(234-02): rewrite the 8 label-length MCP tool descriptions as instructions (GREEN)
```

Same commit that introduced `meeting`'s now-fixed false claim -- confirms Phase 234's rewrite pass systematically introduced CLI-behavior descriptions over MCP echo handlers across multiple tools, not a one-off.

### `room_content` WRITE-surface enumeration: derived vs. declared (T-276-20, side by side)

| Derived from live `checkTree()`/`resolveReachability()` (measured) | Named in the corrected description |
|---|---|
| file-opportunity | file-opportunity |
| create-funding | create-funding |
| update-funding-stage | update-funding-stage |
| generate-personas | generate-personas |

Exact match, both lists identical, both recorded here per T-276-20's mitigation requirement.

## Suite Results (recorded verbatim per plan verification block)

- `node tests/test-276-orchestration-scout-honesty.cjs` -- exit 0, 12/12.
- `node tests/test-276-room-content-honesty.cjs` -- exit 0, 26/26.
- `node tests/test-234-tool-description-floor.cjs` -- exit 0, 172/172 (40/40 tool coverage).
- `node tests/test-270-tool-schema-budget.cjs` -- exit 0, 5/5. Live measurement: 40 tools, 39,764 total bytes, ~9,941 approx tokens, within the 10% `DRIFT_TOLERANCE_PCT` against the `276-12` `AFTER` baseline (this plan's own byte addition across all three descriptions was +794 bytes total, well inside tolerance; the baseline was NOT moved, no deliberate re-baseline needed).
- `node tests/test-kwl-meeting-mcp-honesty.cjs` -- exit 0, 37/37. The `meeting` NEGATION_REGRESSION fixture is intact.
- `node tests/test-ljj-tool-honesty.cjs` -- exit 0, 16/16.
- `node tests/test-276-tool-honesty-switch-branches.cjs` -- exit 0, 17/17.
- `bash tests/run-all-266.sh` -- PASS=11 FAIL=0 SKIP=0.
- `node tests/test-276-tool-honesty-findings-closed.cjs` -- 146 passed / 3 failed. **All three failures are pre-existing and explicitly out of this plan's scope, unchanged by this plan:**
  - `gate_render.(default)` (expects eventual OK, still open) -- owned by plan **276-11**.
  - `ledger frozen_sweep.tools` mismatch (ledger declares 36, live measures 37) -- owned by plan **276-15** (the `claim_write` tool added by 276-12 after the 276-06 freeze; already named in `276-07-SUMMARY.md` before this plan started).
  - `ledger frozen_sweep.branches` mismatch (ledger declares 130, live measures 131) -- same cause and owner as above.
  - `orchestration.scout` (previously failing "expects eventual OK, absent from live non-OK set") is now **CLOSED** by this plan -- no longer in the failure list.
- `grep -P '\x{2014}' lib/mcp/tool-router.cjs` -- no match.
- `git diff --cached --name-only` before each of the three commits listed exactly `lib/mcp/tool-router.cjs`, verified before every stage.

## Known Stubs

None. Every description rewrite states real, verified handler behavior (confirmed live over stdio for the banner assertions); no placeholder text was introduced.

## Threat Flags

None. This plan's threat register (T-276-03, T-276-11, T-276-12, T-276-20, T-276-09) covers exactly the surface touched: every rewrite added a disclosure sentence with a non-negative byte delta (T-276-03, verified above); only the two shipped disclosure primitives were used, no third marker minted (T-276-11, verified by both RED tests' Group B subset checks); `test-234`/`test-270` stayed green with no baseline relaxation (T-276-12); the room_content enumeration was derived from live output and recorded side by side (T-276-20); every commit was preceded by an audited `git diff --cached --name-only` check (T-276-09). No new network endpoint, auth path, file-access pattern, or schema change at a trust boundary was introduced -- this plan is description strings and one banner-membership Set, nothing else.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **276-11** (gate_render's honest rewrite) can proceed directly: the four-move pattern this plan applied three more times is proven robust against the detector's real edge cases (sentence-scoped claim attachment, the `noWriteBanner()`-only banner recognition gap), and the `'nothing is persisted'` negation entry 276-07 added is already available.
- **276-15** inherits two clean, pre-named residuals, both unchanged by this plan and already flagged before this plan started: the `frozen_sweep.tools`/`frozen_sweep.branches` re-freeze (36->37, 130->131), and `gate_render`'s own still-open finding (owned by 276-11, not 276-15, but will show in 276-15's final sweep until 276-11 lands).
- **A genuine, separate detector-coverage gap was discovered and named but NOT fixed** (out of this plan's declared scope: description and banner edits only, no detector edits): `classifyBranch`'s `hasBanner` check has no recognition of the `NOT EXECUTED.` banner literal, unlike its recognition of `noWriteBanner()`/`**filed: false**`. Every command this plan and prior plans wired into `UNIMPLEMENTED_MUTATING_ORCHESTRATION` relies entirely on a claim-free description to read OK; the banner itself earns no detector credit. Worth a `hasBanner` extension in whichever future plan next touches `scripts/check-tool-honesty.cjs`.
- No blockers.

---
*Phase: 276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs*
*Completed: 2026-09-03*
