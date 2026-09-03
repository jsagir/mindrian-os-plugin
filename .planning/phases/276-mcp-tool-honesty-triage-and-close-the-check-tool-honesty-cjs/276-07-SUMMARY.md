---
phase: 276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs
plan: 07
subsystem: testing
tags: [mcp-tool-honesty, check-tool-honesty, detector-fix, disposition-ledger, reachability, negation]

# Dependency graph
requires:
  - phase: 276-06
    provides: "The D-1 GREEN splitBranches fix, the KNOWN BOUNDARIES header block (B-1..B-6), and the frozen 24-entry disposition ledger this plan amends."
provides:
  - "isEnumeratedCommandName: a verb-shaped token that is also a member of the scanned tool's own command vocabulary, sitting in an enumeration context, no longer counts as a prose claim (F-2..F-8)"
  - "isFileNounUsage: demotes the bare 'file' STRONG_VERBS entry when followed by contents/path/paths/name/names/system, fixing context_assemble's negative-capability sentence (F-10 Bug A)"
  - "followReexportHop / locateDirectFunctionBody: a one-level barrel re-export hop through resolveRepoLocalPath's existing containment, closing F-10 Bug B (the Canon Part 9 chokepoint's UNKNOWN false positive)"
  - "splitBranches recognizes ARRAY.includes(command) as a dispatch guard (B-4 half closed); intelligence's recognized branch count moved 3/11 -> 6/11"
  - "The WEAK-tier sibling-writes ruling, decided and recorded at classifyBranch's own decision site: NOT extended to the WEAK tier"
  - "NEGATION_PATTERNS gained 'nothing is persisted', needed by plan 276-11's gate_render rewrite"
  - "The disposition ledger amended: 10 room_graph rows -> documented-no-action/MEDIUM, 7 export rows -> description-correction/276-08, 2 new intelligence rows added (documented-no-action/MEDIUM)"
  - "tests/test-276-allowed-unverified-contract.cjs's Group B UNKNOWN probe decoupled from the live tree via a new synthetic fixture pair (unresolvable.cjs + unresolvable-target.cjs)"
affects: ["276-08 (description fixes now own: orchestration.scout, room_content's 4 rows, export's 7 rows including the real sentence-1 'filed' claim this plan surfaced)", "276-11 (gate_render description correction consumes the new 'nothing is persisted' pattern)", "276-15 (re-freezes frozen_sweep.tools/branches to 37/131 after claim_write's addition by 276-12; NOT touched here per this plan's explicit instruction)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Every claim added a comment naming the rejected alternative at the decision site (classifyBranch's WEAK-TIER SIBLING-WRITES RULING block), not just the chosen path -- matches 276-06's own discipline for the D-1 fix comment."
    - "Re-measure, never trust a research doc's characterization: 276-RESEARCH.md called room_graph's WEAK claim 'tool-scoped'; live extractClaims measurement showed it is actually per-command. The ruling and every ledger reason cite the measured reality, not the doc."
    - "A test whose precondition depends on the live tree staying broken is fragile by construction in a phase whose goal is closing findings -- test-276-allowed-unverified-contract.cjs's UNKNOWN probe was moved onto a dedicated synthetic fixture, matching the POSITIVE_SYNTHETIC/NEGATED_SYNTHETIC precedent already used elsewhere in the suite."

key-files:
  created:
    - tests/fixtures/tool-honesty/reexport-outside-root.cjs
    - tests/fixtures/tool-honesty/unresolvable.cjs
    - tests/fixtures/tool-honesty/unresolvable-target.cjs
  modified:
    - scripts/check-tool-honesty.cjs
    - tests/fixtures/tool-honesty/276-dispositions.json
    - tests/test-276-allowed-unverified-contract.cjs

key-decisions:
  - "WEAK-tier sibling-writes discount NOT extended. room_graph's ten rows, re-measured live, are per-command claims (not tool-scoped as 276-RESEARCH.md characterized them), and two of the ten (graph-index, graph-rebuild) genuinely DO write via a depth-2 dotted call this detector cannot see (lib/core/graph-ops.cjs -> lib/core/lazygraph-ops.cjs's real conn.prepare(...).run(...) INSERTs). A blanket discount would have silently hidden that real, undetected write behind 'a sibling writes' reasoning -- exactly the invisible false negative D-276-2 warns against. Ruled NOT to extend; recorded as a paragraph in classifyBranch's own comment block naming the rejected alternative."
  - "Task 1's enumeration-guard fix surfaced export's REAL underlying claim (sentence 1's 'filed', a STRONG tool-scoped claim) once the false MEDIUM attribution to sentence 2's command-list was removed. Per Task 1's own acceptance criteria this is EXPECTED, not a regression -- the 7 export rows now show HIGH_RISK, and the ledger's owner_plan was corrected from 276-07 to 276-08 (the plan that will actually close them via a description/behavior fix), disposition changed detector-fix -> description-correction."
  - "Task 2's own B-4 includes()-dispatch fix (isolating eureka-run/status/report's branch body out of sharedBodyText) removed a previously-hidden false WRITES leak into every OTHER intelligence command's effectiveText, correctly surfacing intelligence.research and intelligence.grade's pre-existing WEAK claim as MEDIUM for the first time. Two new ledger entries added (documented-no-action/MEDIUM, owner 276-07), citing the same WEAK-tier ruling."
  - "The file-noun demotion (isFileNounUsage) was chosen over widening isLocallyNegated's adjacency window for F-10 Bug A, because it is narrower in effect: it fixes the exact 'file contents/path/system' noun-phrase shape without loosening the negation check for every other sentence on this surface. No other known finding depended on a widened window, so widening now would have been an untested surface increase with no proven case behind it."

requirements-completed: [TOOLHON-02, TOOLHON-05]

# Metrics
duration: ~2h
completed: 2026-09-03
---

# Phase 276 Plan 07: Four Detector Fixes, the WEAK-Tier Ruling, and the Amended Ledger Summary

**Closed F-2..F-8 (command-name-in-enumeration), F-10 Bugs A and B (negative-capability misread, barrel re-export UNKNOWN), and B-4's includes() half as detector fixes; ruled once (NOT extend) on the WEAK-tier sibling-writes discount after re-measurement showed room_graph's rows are per-command and two of the ten hide a real, separately-undetected write.**

## Performance

- **Duration:** ~2h
- **Started:** 2026-09-03T~22:05Z (first file read)
- **Completed:** 2026-09-03T~22:40Z
- **Tasks:** 3 completed
- **Files modified:** 6 (3 modified, 3 new)

## Accomplishments

- `isEnumeratedCommandName` (Task 1): a STRONG/WEAK verb token that is also a literal member of the scanned tool's own resolved command vocabulary, sitting in an enumeration context (touches a list separator or a parenthetical AND the sentence names >=2 other vocabulary members), no longer counts as a prose claim. Fixes `export`'s "publish"/"snapshot" command-list false attribution.
- `isFileNounUsage` (Task 1): demotes the bare `'file'` STRONG_VERBS entry when immediately followed by `contents/path/paths/name/names/system`, so `context_assemble`'s "Never returns raw file contents." stops reading as a positive persistence claim.
- `followReexportHop` + `locateDirectFunctionBody` (Task 2): a one-level barrel re-export hop. `locateFunctionBody` now tries a direct definition first, then, only with a real module file path, follows an object-literal `NAME: IDENT.NAME` re-export to the module `IDENT` was `require()`d from, routed through the existing `resolveRepoLocalPath` containment. Proven live against `lib/core/navigation.cjs`'s `getRoomContext` re-export (resolves to a 5522-char body) and against a negative fixture whose `require()` names an absolute path outside the repo root (`/etc/hostname` -- resolves to `null`, never reads the file).
- `splitBranches` (Task 2) recognizes `ARRAY.includes(command)` as a dispatch guard when `ARRAY` is a locally-resolvable string-literal array, reusing `extractCommandVocabulary`'s own `resolveIdentifierArray`. `intelligence`'s recognized branch count measured 3/11 before, 6/11 after (live-measured both times, not assumed).
- The WEAK-tier sibling-writes ruling (Task 3), decided once and recorded as a paragraph in `classifyBranch`'s own comment block, naming the rejected alternative: **NOT extended**. `NEGATION_PATTERNS` gained `nothing is persisted` (one line, `minted` was NOT added to `STRONG_VERBS`, confirmed by reading the array).
- The disposition ledger amended: all 10 `room_graph` rows -> `documented-no-action`/`MEDIUM`; all 7 `export` rows -> `description-correction`/owner `276-08` (the detector-fix half is done; the real "filed" claim needs a description/behavior fix); 2 new rows added for `intelligence.research`/`intelligence.grade`, surfaced by Task 2's own fix.

## Task Commits

Each task was committed atomically:

1. **Task 1: F-2's enumeration guard and F-10 Bug A's negation window** - `02287c30` (fix)
2. **Task 2: F-10 Bug B, the one-level barrel re-export hop, with repo-root containment preserved** - `48fe8a61` (fix)
3. **Task 3: the WEAK-tier sibling-writes ruling, the nothing-is-persisted negation pattern, and the ledger amendment** - `c4e05426` (fix)

## Files Created/Modified

- `scripts/check-tool-honesty.cjs` (all three tasks) - `isEnumeratedCommandName`, `isFileNounUsage`, `locateDirectFunctionBody`/`followReexportHop`/`readReexportModule`, `splitBranches`'s `includes()` recognition, `classifyBranch`'s WEAK-tier ruling comment, `NEGATION_PATTERNS`'s new entry, three new exports (`locateFunctionBody`, `followReexportHop`, `resolveRepoLocalPath`) for test access.
- `tests/fixtures/tool-honesty/reexport-outside-root.cjs` (Task 2, new) - the negative containment fixture; `require('/etc/hostname')` resolves to `null` via `resolveRepoLocalPath`, never read.
- `tests/fixtures/tool-honesty/276-dispositions.json` (Task 3) - 10 `room_graph` rows amended, 7 `export` rows amended, 2 `intelligence` rows added. `frozen_at_commit`/`frozen_sweep` left untouched (owned by 276-15).
- `tests/fixtures/tool-honesty/unresolvable.cjs` + `unresolvable-target.cjs` (Task 3, new) - the synthetic UNKNOWN fixture pair that decouples `test-276-allowed-unverified-contract.cjs`'s Group B from the live tree's UNKNOWN count.
- `tests/test-276-allowed-unverified-contract.cjs` (Task 3) - Group B's `unknownRow` now sourced from the dedicated fixture scan instead of `checker.scanAll().rows.find(...)` against the live (now UNKNOWN-free) tree.

## Decisions Made

See `key-decisions` in frontmatter. Summarized: (1) the WEAK-tier sibling-writes discount is NOT extended, decided after re-measuring room_graph's rows live and finding they are per-command (not tool-scoped as 276-RESEARCH.md said) with two rows hiding a real undetected write; (2) export's 7 ledger rows were re-owned to 276-08 because Task 1's own acceptance criteria required the real "filed" claim to keep surfacing, not be silenced; (3) two new intelligence ledger rows were added because Task 2's own fix surfaced them; (4) the file-noun demotion was chosen over widening the negation window because it is narrower in effect; (5) the allowed-unverified-contract test's live-tree dependency on an UNKNOWN row was replaced with a dedicated synthetic fixture.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected `export`'s stale ledger prediction (owner_plan, disposition)**
- **Found during:** Task 3 (cross-checking Task 1's fix against the pre-existing 276-06 ledger entries)
- **Issue:** The 276-06 ledger predicted `export`'s 7 rows would resolve to `OK` once the WEAK_VERBS false-attribution was fixed, with `owner_plan: 276-07`. Task 1's own acceptance criteria explicitly required the opposite outcome for this plan (the real "filed" claim must keep surfacing, not be silenced) -- so after Task 1 landed, these 7 rows show `HIGH_RISK` live while the ledger still claimed `expected_final_verdict: OK` / `owner_plan: 276-07`, a stale, now-incorrect entry.
- **Fix:** Amended all 7 `export` ledger entries: `owner_plan` 276-07 -> 276-08, `disposition` `detector-fix` -> `description-correction`, `reason` rewritten to state the detector-fix half is complete and cite the real sentence-1 "filed" claim now visible.
- **Files modified:** tests/fixtures/tool-honesty/276-dispositions.json
- **Verification:** `node tests/test-276-tool-honesty-findings-closed.cjs` Group B (structural contract) passes for all 7 rows; Group C correctly reports them as still-open, owned by 276-08 (not 276-07).
- **Committed in:** c4e05426 (Task 3 commit)

**2. [Rule 1 - Bug] Added ledger entries for two new findings surfaced by Task 2's own fix**
- **Found during:** Task 3 (re-running `test-276-tool-honesty-findings-closed.cjs` after Task 2 landed)
- **Issue:** Task 2's `includes()` dispatch fix isolated `eureka-run`/`eureka-status`/`eureka-report`'s branch body out of `sharedBodyText`. Before the fix, that body's write-primitive text leaked into EVERY other `intelligence` command's `effectiveText` (via `sharedBodyText` concatenation), falsely making `research` and `grade` resolve `WRITES`. After the fix, they correctly resolve `NO_WRITE`, surfacing a pre-existing WEAK per-command claim as `MEDIUM` for the first time -- two brand-new non-OK rows with no ledger entry, which `test-276-tool-honesty-findings-closed.cjs` Group A correctly flagged as undispositioned.
- **Fix:** Added two new ledger entries (`intelligence.research`, `intelligence.grade`), `disposition: documented-no-action`, `expected_final_verdict: MEDIUM`, `owner_plan: 276-07`, citing the same WEAK-tier ruling and the Task 2 mechanism that surfaced them.
- **Files modified:** tests/fixtures/tool-honesty/276-dispositions.json
- **Verification:** `node tests/test-276-tool-honesty-findings-closed.cjs` Group A/B pass for both rows.
- **Committed in:** c4e05426 (Task 3 commit)

**3. [Rule 1 - Bug] Replaced a live-tree-dependent test precondition with a synthetic fixture**
- **Found during:** Task 3 (running the plan's own required `test-276-allowed-unverified-contract.cjs` verification after Tasks 1+2 landed)
- **Issue:** `test-276-allowed-unverified-contract.cjs` Group B required a live UNKNOWN row to exist in the current tree to prove D-276-2's never-suppressible guard. Task 1's negation-demotion fix (independently of Task 2's barrel hop) already eliminated the tree's only UNKNOWN row (`context_assemble.(default)`), so this test started failing immediately after Task 1's commit -- a test whose precondition the phase's own success criteria structurally eliminates.
- **Fix:** Added a dedicated synthetic fixture pair (`tests/fixtures/tool-honesty/unresolvable.cjs` + `unresolvable-target.cjs`) reproducing a genuinely unresolvable dotted call, and rewired Group B's `unknownRow` sourcing (both the initial probe and the post-mutation re-scan) onto a scoped `scanAll({ files: [...] })` call against that fixture, matching the `POSITIVE_SYNTHETIC`/`NEGATED_SYNTHETIC` pattern `test-ljj-tool-honesty.cjs` already uses. `mediumRow`/`highRiskRow` remain sourced from the live tree, unchanged.
- **Files modified:** tests/test-276-allowed-unverified-contract.cjs, tests/fixtures/tool-honesty/unresolvable.cjs (new), tests/fixtures/tool-honesty/unresolvable-target.cjs (new)
- **Verification:** `node tests/test-276-allowed-unverified-contract.cjs` exits 0, 11 passed / 0 failed (was 9 passed / 1 failed before this fix).
- **Committed in:** c4e05426 (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 - bug fixes to ledger/test artifacts made stale or newly-undispositioned by this plan's own detector fixes)
**Impact on plan:** All three were direct, foreseeable consequences of the plan's own required detector changes surfacing more accurate results. No scope creep; no production code touched beyond the plan's own four defects.

## Issues Encountered

- `276-RESEARCH.md` characterized `room_graph`'s WEAK claim as "tool-scoped." Live re-measurement via `extractClaims` showed it is actually per-command (the description's single sentence names all 13 commands, so `sentenceNamesCommand` attaches the claim per-command rather than tool-scoped). This did not block the task -- the plan's own instruction ("Base the decision on reading the ten room_graph rows... Re-measure; do not trust the list") anticipated exactly this kind of drift between the research doc and the live code. The ruling and every ledger reason cite the measured reality.
- Two of the ten `room_graph` rows (`graph-index`, `graph-rebuild`) were found to genuinely write, via a depth-2 dotted call chain (`lib/core/graph-ops.cjs` -> `lib/core/lazygraph-ops.cjs`) this detector's one-hop `resolveReachability` cannot see. This is a real, separate reachability-depth boundary, distinct from B-1 through B-6 and from this plan's four enumerated defects. Not fixed here (out of this task's declared scope); named explicitly in the ledger's `graph-index`/`graph-rebuild` reasons and in this SUMMARY as a candidate finding for a future plan.

## Measured Effect (recorded verbatim per plan requirement)

### `node scripts/check-tool-honesty.cjs` bucket split (via `checkTree()`)

| | Before this plan (post-276-06) | After Task 1 | After Task 2 | After Task 3 |
|---|---|---|---|---|
| Tools / branches | 36 / 130 | 36 / 130 | 36 / 130 | 37 / 131 (claim_write, added by 276-12, unrelated to this plan) |
| HIGH_RISK | 5 | 12 | 12 | 12 |
| MEDIUM | 18 | 11 | 11 | 13 |
| LOW | 0 | 0 | 0 | 0 |
| UNKNOWN | 1 | 0 | 0 | 0 |
| OK | 107 | 108 | 108 | 106 |
| **Total non-OK** | **24** | **23** | **23** | **25** |

**Row-level moves, one line each:**
- `context_assemble.(default)`: UNKNOWN -> OK (Task 1, `isFileNounUsage` demotion removed the false claim entirely).
- `export.export/.radar/.dashboard/.wiki/.present/.publish/.snapshot` (7 rows): MEDIUM -> HIGH_RISK (Task 1, `isEnumeratedCommandName` removed the false command-list attribution; the real sentence-1 "filed" claim surfaced -- expected and correct per Task 1's own acceptance criteria, not a regression).
- `intelligence.research`, `intelligence.grade` (2 rows): OK -> MEDIUM (Task 2, `includes()` dispatch fix stopped a false-WRITES leak from `sharedBodyText`; both newly ledgered in Task 3).
- `room_graph.*` (10 rows): bucket unchanged (MEDIUM), disposition/expected_final_verdict amended in the ledger (Task 3 ruling: NOT extend the WEAK-tier discount).

### `node tests/test-ljj-tool-honesty.cjs`

Exit 0, 16 passed / 0 failed (9 assertion groups), unchanged across all three tasks. No regression.

### `node tests/test-276-tool-honesty-switch-branches.cjs`

Exit 0, 17 passed / 0 failed, unchanged across all three tasks.

### `node tests/test-276-allowed-unverified-contract.cjs`

Before Task 3: exit 1, 9 passed / 1 failed (the live-tree UNKNOWN precondition, broken by Task 1's own fix). After Task 3: exit 0, 11 passed / 0 failed.

### `node tests/test-276-tool-honesty-findings-closed.cjs`

Exit 1 both before and after this plan (unchanged exit code; failure set narrowed). After Task 3: 146 passed, 15 failed. **All 15 failures are expected and out of this plan's scope:**
- 12 are Group C "still open" entries owned by plans that have not yet run: `orchestration.scout`, `room_content.new-project/setup/update/invoke-persona` (4), `export.*` (7, now correctly re-owned to 276-08 in Task 3), `gate_render.(default)` (276-11).
- 2 are Group F `frozen_sweep.tools`/`frozen_sweep.branches` mismatches (ledger declares 36/130, live measures 37/131) caused by plan 276-12's addition of the `claim_write` tool after the 276-06 freeze -- unrelated to this plan's work, explicitly named in this plan's own read-first context as owned by 276-15's re-freeze, and explicitly NOT touched here per instruction.

Every entry owned by 276-07 (the 10 `room_graph` rows, the 2 new `intelligence` rows, `context_assemble`) is fully resolved: Groups A, B, D, E are 100% green with zero 276-07-owned failures.

### `node tests/test-234-tool-description-floor.cjs` / `node tests/test-270-tool-schema-budget.cjs`

Both exit 0 (172 passed / 0 failed; 5 passed / 0 failed), confirming this plan touched no tool description and moved no description byte.

### `node tests/test-kwl-meeting-mcp-honesty.cjs`

Exit 0, 37 passed / 0 failed. The `meeting` negation-regression fixture is intact.

### Containment negative case

`c.locateFunctionBody(src, 'getOutsideWidget', new Map(), fixturePath)` against `tests/fixtures/tool-honesty/reexport-outside-root.cjs` (whose `require('/etc/hostname')` names an absolute path outside the repo root) returns `null`. `resolveRepoLocalPath`'s containment check is exercised, not assumed.

### `grep -rP '\x{2014}'` sweep

`scripts/check-tool-honesty.cjs`, `tests/fixtures/tool-honesty/276-dispositions.json`, `tests/test-276-allowed-unverified-contract.cjs`, `tests/fixtures/tool-honesty/unresolvable.cjs`, `tests/fixtures/tool-honesty/unresolvable-target.cjs` -- no match on all five touched files.

### `STRONG_VERBS` members (recorded per acceptance criteria)

`file, files, filed, filing, write, writes, writing, wrote, persist, save, saves, saving, store, stores, storing, insert, mint, mints, archive, archives, commit` -- unchanged from before this plan; `minted` is not and was not a member.

## Known Stubs

None. Every function added (`isEnumeratedCommandName`, `isFileNounUsage`, `followReexportHop`, `locateDirectFunctionBody`, `readReexportModule`, the `includes()` recognition in `splitBranches`) is a complete, live-verified implementation; no placeholder logic or hardcoded empty return was introduced.

## Threat Flags

None. This plan's threat register (T-276-08, T-276-02, T-276-13, T-276-19, T-276-09) covers exactly the surface these files introduce: the re-export hop's containment (T-276-08, proven by the negative fixture), the enumeration guard's two-signal breadth requirement (T-276-02, proven by export's sentence-1 claim surviving), the WEAK-tier ruling's refusal to bulk-absorb a real defect (T-276-13, proven by the graph-index/graph-rebuild reasoning), and the unchanged `STRONG_VERBS` vocabulary (T-276-19, recorded above). No new network endpoint, auth path, file-access pattern, or schema change at a trust boundary was introduced. `tests/fixtures/tool-honesty/reexport-outside-root.cjs` and `unresolvable.cjs`/`unresolvable-target.cjs` are inert fixtures never executed as code by the scanner (read as TEXT only) or by anything else.

## User Setup Required

None. No external service configuration required.

## Next Phase Readiness

- Plan 276-08 has an unambiguous, now-more-precise starting point: `orchestration.scout`'s false write claim, `room_content`'s 4 rows, `export`'s description (sentence 1's real "filed" STRONG tool-scoped claim, now cleanly isolated from the detector noise this plan removed -- either wire a real write, apply the honest no-write banner, or rewrite the description; also fix the three false `Suggested Next` completion assertions at `tool-router.cjs:1476-1480`).
- Plan 276-11 has its needed detector primitive ready: `NEGATION_PATTERNS` now includes `nothing is persisted`, so `gate_render`'s honest rewrite (D-276-3, an in-memory gate-ledger mint is not persistence) will correctly globally-cancel once the description is corrected.
- Plan 276-15 has a precise, isolated re-freeze target: `frozen_sweep.tools: 36 -> 37`, `frozen_sweep.branches: 130 -> 131` (the `claim_write` tool added by 276-12), plus re-verifying the ledger's 26 entries (24 original + 2 new `intelligence` rows added by this plan) against the then-current live sweep.
- A genuine, separate detector boundary was discovered and named but NOT fixed (out of this task's scope): `resolveReachability`'s dotted-call resolution is one hop deep, so a real write two dotted hops away (`graph-ops.indexArtifact` -> `lazygraph.indexArtifact`'s real SQL INSERT) is invisible. Worth a future plan's own boundary entry (a candidate B-7) if this pattern recurs elsewhere in the tree.
- No blockers.

---
*Phase: 276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs*
*Completed: 2026-09-03*
