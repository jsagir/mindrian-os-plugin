---
phase: 241-feynman-minto
plan: 05
subsystem: infra
tags: [node, bash, mcp, stop-hook, feynman-minto, guardian, tri-polar, testing]

# Dependency graph
requires:
  - phase: 241-01
    provides: "runOnStop's soft walk deadline, the captured/folded systemMessage on the CLI legacy Stop path, and the 3-second last-resort ceiling; this plan calls the same runOnStop entry point from a second call site"
  - phase: 241-02
    provides: "the retired stop-path vacuums (peek(), not drain()) at both scripts/on-stop and lib/mcp/stop-gate-handler.cjs's _closeOutMintoDrain, and the corrected RCA; this plan's new sibling function is placed after that call in the same closeOutRoom sequence"
  - phase: 241-03
    provides: "both F-2 severity constants raised to critical; this plan's fixtures rely on the missing-MINTO.md existence-check reaching critical to produce a guardian finding"
  - phase: 241-04
    provides: "runPreCommit's advisory/--strict demotion; unrelated to this plan's edit sites but confirmed non-colliding"
provides:
  - "lib/mcp/stop-gate-handler.cjs::_closeOutGuardianOnStop(roomDir), a new _closeOut* sibling that runs the same feynman-minto-guardian.cjs on-stop binary the CLI path runs, via execFileSync(process.execPath, ...), never throws, 3000ms timeout matching the CLI ceiling"
  - "closeOutRoom's return object gains guardian_sm (string|null); early-return and success-return key sets are identical (proven by direct comparison, not assumed)"
  - "scripts/on-stop's MINDRIAN_MCP_FIRST thin branch folds business.guardian_sm into its systemMessage with the same separator the legacy path uses"
  - "tests/test-241-guardian-tripolar-parity.cjs: 3 tests proving the shared path reports (with a substantiating invariant-report.json), that both Stop paths agree EXACTLY on the guardian finding for the same fixture, and a mutation proof that removing the shared-path call turns both claims red"
  - "tests/run-all-241.sh: one PASS/FAIL gate over every Phase 241 leg (glob-discovered tests/test-241-*, 6 explicit lib/memory/ legs, the whole-suite roll-up, and a permanent regression tripwire against all four retired defects)"
  - "Dev-Research Compositing filing at ~/MindrianRooms/rethinking-mindrianos/research/2026-07-28-feynman-minto-guardian-reachability/, mirrored to ~/MindrianRooms/mindrianOS/research/"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sibling _closeOut* helper added to an existing best-effort/never-throw helper family, mirroring _closeOutStateMd's execFileSync idiom exactly (Canon Part 7 reuse)"
    - "Cross-runtime mutation-proof harness: pin a tmp copy's PLUGIN_ROOT constant plus every relative require to absolute real-repo paths before applying a textual mutation, so the copy's require graph resolves correctly regardless of where it physically lives (241-01's bash-script pinning idiom, applied here to a CJS module's require graph)"
    - "Phase harness with a bounded timeout wrapper around a leg with a known, pre-existing, out-of-scope hang, so the harness itself always terminates, plus an EXPECTED-RED-LEG header note (run-all-234.sh precedent) rather than silently suppressing the FAIL"

key-files:
  created:
    - tests/test-241-guardian-tripolar-parity.cjs
    - tests/run-all-241.sh
    - .planning/phases/241-feynman-minto/deferred-items.md
  modified:
    - lib/mcp/stop-gate-handler.cjs
    - scripts/on-stop
    - .planning/debug/gsd-tools-state-resync-clobbers-stopped-at-frontmatter.md

key-decisions:
  - "Guardian call placed in closeOutRoom AFTER both _closeOutMintoDrain and _closeOutFolderMemorySnapshot (not merely after one), because the guardian's queue-health and snapshot-integrity validators read state those two steps produce; this mirrors scripts/on-stop's own ordering (guardian after the Phase 88-06 drain+snapshot)."
  - "3000ms timeout on the shared-path guardian call, matching the CLI path's own outer ceiling (241-01), so both surfaces truncate at the same point rather than two different unstated ones."
  - "No private helper exported from stop-gate-handler.cjs solely for testability -- closeOutRoom was already exported (Phase 198-09), so the parity test drives that real entry point directly."
  - "run-all-241.sh wires the whole-suite roll-up (lib/memory/run-feynman-tests.cjs) as the plan's action text requires, wrapped in a bounded `timeout 240` rather than omitted, and documents both known pre-existing FAILs by name in the header (the run-all-234.sh EXPECTED-RED-LEG precedent) rather than silently working around them or fabricating a clean run."
  - "Hit a confirmed, already-filed external gsd-tools.cjs defect (.planning/debug/gsd-tools-state-resync-clobbers-stopped-at-frontmatter.md) live during state.advance-plan: it regressed STATE.md's stopped_at/last_updated/last_activity to a STALE 241-02 snapshot and, a new symptom beyond what the RCA already documented, corrupted progress.percent to 11 (not derivable from the visible completed_plans/total_plans pair). Hand-restored per the RCA's own documented workaround, then appended fresh Evidence to that RCA rather than silently working around it without a trace."

requirements-completed: [MINTO-01, MINTO-02]

# Metrics
duration: ~120min
completed: 2026-07-28
---

# Phase 241 Plan 05: Tri-Polar Guardian Parity and the Phase-241 Harness Summary

**The shared mindrian-core Stop path (Desktop/Cowork/CLI-under-MINDRIAN_MCP_FIRST) now runs the Feynman-MINTO guardian's on-stop invariant check too, proven identical to the CLI legacy path on the same fixture with a real mutation proof, rolled up by a new one-command phase harness that honestly reports two pre-existing, out-of-scope FAILs rather than hiding them.**

## Performance

- **Duration:** ~120 min (file-reading/research consult through final commit and state cleanup)
- **Started:** 2026-07-28 (approx, file-reading phase)
- **Completed:** 2026-07-28
- **Tasks:** 3/3
- **Files modified:** 2 (`lib/mcp/stop-gate-handler.cjs`, `scripts/on-stop`) + 2 created (`tests/test-241-guardian-tripolar-parity.cjs`, `tests/run-all-241.sh`)

## Accomplishments

- Closed the Tri-Polar half of finding F-1 (MINTO-01). `lib/mcp/stop-gate-handler.cjs` gained `_closeOutGuardianOnStop(roomDir)`, a new sibling in the existing `_closeOut*` helper family (never-throw, `execFileSync` idiom matching `_closeOutStateMd`), called from `closeOutRoom` after the Minto-drain census and the folder-memory snapshot. `closeOutRoom`'s return object now carries `guardian_sm`; the early-return and success-return key sets are proven identical, not merely assumed (hand-verified with a scratch `node -e` comparison).
- `scripts/on-stop`'s `MINDRIAN_MCP_FIRST` thin branch (the CLI-under-flag configuration) now folds `business.guardian_sm` into its own systemMessage, using the same separator the legacy path uses. The `fire === true` branch was left untouched, per the plan's explicit instruction.
- Built `tests/test-241-guardian-tripolar-parity.cjs` (3 tests, 313 lines): the shared path reports and substantiates the claim with `invariant-report.json`; both Stop paths agree EXACTLY on the guardian portion of the message for the same fixture in two separate room copies; a mutation proof (pinned-and-mutated tmp copy of `stop-gate-handler.cjs`) confirms removing the shared-path call drops both the message and the report.
- Built `tests/run-all-241.sh`, the one-command Phase 241 gate: glob-discovers `tests/test-241-*`, wires the 6 explicit `lib/memory/` legs plus the whole-suite roll-up, and carries a permanent regression tripwire against all four retired defects (comment-stripped before matching).
- Filed the Dev-Research Compositing entry, leading with the RCA correction (the debounce consumer was never missing; an extension-scoped grep missed the real, extensionless `scripts/intent-classifier`), recording the guardian-reachability finding this plan closed, and the Tri-Polar R-01 decision with its `MINDRIAN_MCP_FIRST` early-exit evidence. Mirrored to `mindrianOS/research/`.
- Hit and hand-worked-around a confirmed, already-filed external `gsd-tools.cjs` defect during state bookkeeping (see Deviations), appending fresh evidence to the existing RCA rather than silently restoring STATE.md without a trace.

## Task Commits

1. **Task 1: Run the guardian on the shared mindrian-core Stop path and surface its finding** - `c7fb00db` (feat)
2. **Task 2: Prove parity between the two Stop paths, with a mutation proof** - `d8cb1735` (test)
3. **Task 3: Phase harness and the Dev-Research Compositing filing** - `d4f67b17` (feat)

_Plan metadata commit follows this summary._

## Files Created/Modified

- `lib/mcp/stop-gate-handler.cjs` - new `_closeOutGuardianOnStop(roomDir)`; `closeOutRoom` calls it after `_closeOutMintoDrain`/`_closeOutFolderMemorySnapshot` and returns `guardian_sm`; file-header contract note (item 5) updated
- `scripts/on-stop` - the `MINDRIAN_MCP_FIRST` thin branch's else-case folds `r.business.guardian_sm` into its systemMessage
- `tests/test-241-guardian-tripolar-parity.cjs` (new, 313 lines) - 3 tests: shared-path report + substantiation, cross-path parity (exact equality), mutation proof
- `tests/run-all-241.sh` (new, executable) - the Phase 241 one-command gate
- `.planning/phases/241-feynman-minto/deferred-items.md` (new) - the two pre-existing, out-of-scope failures this plan's harness surfaces, logged per the executor's scope boundary
- `.planning/debug/gsd-tools-state-resync-clobbers-stopped-at-frontmatter.md` - appended a third occurrence's Evidence entry (new symptom: `progress.percent` corruption, not previously documented)

## Decisions Made

See `key-decisions` in frontmatter. The two most load-bearing:

1. **Ordering the guardian call after BOTH prior close-out steps, not just one** - the guardian's own validators read state those steps produce; getting this wrong would have the guardian validate a pre-close-out snapshot, a correctness bug disguised as a placement detail.
2. **Honesty over a clean-looking gate** - `tests/run-all-241.sh` wires the whole-suite roll-up exactly as the plan's action text requires, rather than quietly dropping it or using `run_may_skip` to hide a real, already-documented, out-of-scope FAIL. `bash tests/run-all-241.sh` currently exits with `PASS=7 FAIL=2 SKIP=0`, not `FAIL=0` -- both FAILs are pre-existing, out-of-scope, and documented by name in both the harness's own header and `deferred-items.md`; see "Known Result: bash tests/run-all-241.sh does NOT exit 0" below.

## Grounding Consult (Mandatory)

`mcp__langtalks-graph-expert__*` tools are not present in this executor agent's toolset (only Read/Write/Edit/Bash were available), matching every prior 241-series plan. The phase's own `241-RESEARCH.md` already performed this consult at the phase level for the concepts this plan's design touches (self-repair/watchdog wiring across multiple host surfaces, dead-letter-queue-adjacent mechanics) and recorded an honest "not in corpus yet" for every mechanism-specific term queried: self-repair, self-correction, critic model, dead letter queue, background job queue, async worker, Minto pyramid, Feynman technique. "Reflection" and "guardrails" exist as loosely-connected entities related only via a shared episode co-mention, not a genuine documented architectural relationship. Per CLAUDE.md's own standing rule, "not in the corpus yet" is a valid, expected answer for this source; not re-attempted in this execution pass since the tool is unavailable to this agent, and no langtalks citation is fabricated anywhere in this plan's work.

**claude-api skill / claude-code-guide agent consult:** this plan's objective explicitly names "the shared mindrian-core Stop path across Desktop/Cowork/CLI," so this consult was taken seriously rather than assumed inapplicable by default. Conclusion: NOT APPLICABLE, for the same reason 241-01's and prior 198-series work already established for this exact file. `lib/mcp/stop-gate-handler.cjs::closeOutRoom` and `stop_gate_check`'s MCP tool registration (`lib/mcp/tools/stop-gate.cjs`) were BOTH already fully registered before this plan (Phase 198-09); this plan adds a new internal helper function and one new field to an already-registered handler's return object, a body-level change, not a new matcher, not a new MCP tool registration, not a subagent-registry change. Confirmed empirically, not merely asserted: `git diff --stat hooks/hooks.json` is empty across all three of this plan's commits (checked after Task 1, the task that could plausibly have needed a new matcher). Per RESEARCH.md's own Open Question 2 framing, this re-confirms the Part 11 body-level-change exemption for the Tri-Polar wiring choice, exactly as RESEARCH.md flagged it should be re-confirmed at plan time.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - literal acceptance-criterion count vs. this file's own established docstring idiom] `_closeOutGuardianOnStop` grep count is 4, not the plan's stated 2**
- **Found during:** Task 1 verification
- **Issue:** The plan's acceptance criteria state `grep -c '_closeOutGuardianOnStop' lib/mcp/stop-gate-handler.cjs` should be 2 (definition + call site). The actual count is 4, because the new function's docstring (matching every sibling `_closeOut*` helper's own self-referencing docstring style, e.g. `_closeOutMintoDrain`'s docstring opens with "`_closeOutMintoDrain` -- despite the name...", grep count 5) names itself in its header comment, and `closeOutRoom`'s own inline comment above the call site cross-references the docstring by name.
- **Fix:** Not changed -- matching this file's own established documentation convention (every sibling helper's docstring self-references) is the more correct choice than stripping the new function's docstring down to satisfy a literal grep count the planner likely wrote without accounting for that convention. The two REQUIRED occurrences (definition, call site) are both present and independently verified.
- **Files modified:** none (documentation-only observation)
- **Verification:** `grep -n '_closeOutGuardianOnStop' lib/mcp/stop-gate-handler.cjs` shows lines 155 (docstring), 187 (definition), 315 (inline comment), 317 (call site) -- definition and call site both present; compare `grep -c '_closeOutMintoDrain'` = 5 in the same file, the same shape on an existing, already-shipped sibling.
- **Committed in:** `c7fb00db` (Task 1 commit)

**2. [Rule 3 - blocking issue, external tool defect] `state.advance-plan` regressed STATE.md's frontmatter to a stale snapshot and corrupted `progress.percent`**
- **Found during:** post-Task-3 state bookkeeping
- **Issue:** Running `gsd-tools.cjs query state.advance-plan` regressed `stopped_at`/`last_updated`/`last_activity` from the correct `Completed 241-04-PLAN.md` snapshot back to a stale `Completed 241-02-PLAN.md` one, and separately corrupted `progress.percent` from `40` to `11` -- a value not derivable from the unchanged `completed_plans: 6` / `total_plans: 15` pair sitting right next to it. This is a THIRD occurrence of an already-filed external defect (`.planning/debug/gsd-tools-state-resync-clobbers-stopped-at-frontmatter.md`, status: investigating, root cause external to this repo in `~/.claude/gsd-core`), extending its known blast radius (the RCA's Scope-and-Impact section previously claimed only narrative fields were affected; `percent` corruption is new).
- **Fix:** Hand-restored the 4 frontmatter fields to their correct pre-write values via `Edit`, per the RCA's own documented workaround pattern. Appended a new, timestamped Evidence entry to the existing RCA (not a new file -- the RCA already exists and is APPEND-only for Evidence) documenting the third occurrence and the new `percent`-corruption symptom, so a future session hitting this again has the full pattern rather than re-investigating from scratch.
- **Files modified:** `.planning/STATE.md` (frontmatter hand-restored), `.planning/debug/gsd-tools-state-resync-clobbers-stopped-at-frontmatter.md` (Evidence appended)
- **Verification:** `git diff .planning/STATE.md` re-checked immediately after the hand-restoration confirmed only the 4 intended fields changed back to their correct values; no other frontmatter or body content touched.
- **Committed in:** the final metadata commit for this plan (STATE.md is gitignored except `.planning/debug/`, so the RCA edit lands in the code-visible commit; STATE.md itself follows the standard `commit_docs` path)

---

**Total deviations:** 2 (1 documentation-convention note, no code change; 1 Rule 3 external-tool workaround with evidence filed). Neither touches this plan's own `files_modified` list beyond the state-bookkeeping files the workflow itself requires.

## Behavioral Proof (Task 1)

Scratch room seeded with one section (`market-analysis`, `ROOM.md` present, `MINTO.md` absent). Calling `closeOutRoom(roomDir, 'sess-2')` directly:
```
guardian_sm value: guardian: critical in section market-analysis (existence, glyph low); 2 violations across 2 sections
report exists: true
```
Both the message and the substantiating `.mindrian/invariant-report.json` are produced by the shared path, not just the CLI legacy path.

Key-set proof:
```
early-return keys: [ 'guardian_sm', 'minto_pending', 'room_dir', 'sections', 'stale' ]
success-return keys: [ 'guardian_sm', 'minto_pending', 'room_dir', 'sections', 'stale' ]
equal: true
```

## Mutation Proof Evidence

Per standing_rules, hand-inverted against the REAL committed file (not only the test's own internal tmp-copy mutation), observed RED, then restored and confirmed GREEN.

**Real-file mutation** (`const guardianSm = _closeOutGuardianOnStop(roomDir);` -> `const guardianSm = null;`), `node tests/test-241-guardian-tripolar-parity.cjs`:
```
FAIL shared handler closeOutRoom() returns a guardian message backed by invariant-report.json
AssertionError [ERR_ASSERTION]: closeOutRoom() must return a guardian_sm string containing "guardian:"; got: {"room_dir":"...","sections":1,"stale":1,"minto_pending":0,"guardian_sm":null}
FAIL shared handler and CLI legacy on-stop agree on the guardian finding for the same fixture
AssertionError [ERR_ASSERTION]: shared path must produce a guardian portion to compare; got guardian_sm=null

test-241-guardian-tripolar-parity.cjs: 0/3 passed
```
(Test 3's own mutation-target-string assertion also failed here, as expected -- its own `assert.ok` looks for the unmutated needle in the source it reads, which the real-file mutation had already replaced; this is the harness correctly detecting drift, not a bug.)

**Restored** (`git diff --stat lib/mcp/stop-gate-handler.cjs` confirmed empty):
```
PASS shared handler closeOutRoom() returns a guardian message backed by invariant-report.json
PASS shared handler and CLI legacy on-stop agree on the guardian finding for the same fixture
PASS mutation proof: removing the guardian call from the shared handler drops both the message and the report

test-241-guardian-tripolar-parity.cjs: 3/3 passed
```

**Task 3's tripwire, hand-verified against 3 separately mutated tmp copies of `scripts/on-stop`** (never mutating the real file), using the real file's exact `strip_comments | grep` pipeline:
```
$ grep -v '^[[:space:]]*#' <mutated-vacuum-copy> | grep -vE '^[[:space:]]*(//|\*|/\*)' | grep -nE "olderThanMs:[[:space:]]*0\b|--older-than=0"
252:      const snap = dbnc.drain(process.env.ROOM_DIR_ENV, { timeoutMs: 1500, "older-than=0": true, olderThanMs: 0 });
$ grep -v '^[[:space:]]*#' <mutated-timeout1-copy> | grep -vE '^[[:space:]]*(//|\*|/\*)' | grep -n 'timeout 1 node'
350:  GUARDIAN_OUT=$(timeout 1 node "${PLUGIN_ROOT}/scripts/feynman-minto-guardian.cjs" on-stop "${ROOM_DIR}" 2>/dev/null || true)
$ grep -v '^[[:space:]]*#' <mutated-discard-copy> | grep -vE '^[[:space:]]*(//|\*|/\*)' | grep -nF 'on-stop "${ROOM_DIR}" >/dev/null 2>&1'
350:  GUARDIAN_OUT=$(timeout "${GUARDIAN_TIMEOUT_S}" node "${PLUGIN_ROOT}/scripts/feynman-minto-guardian.cjs" on-stop "${ROOM_DIR}" >/dev/null 2>&1 || true)
```
All three bite. The real, unmutated `scripts/on-stop` produces zero hits for all three patterns (confirmed separately).

**Zero-glob-discovery mutation proof** (Task 3 acceptance criterion): `tests/test-241-guardian-tripolar-parity.cjs` moved aside, `bash tests/run-all-241.sh` run:
```
======================================
Phase 241: Feynman-MINTO verification
======================================

!!! no tests/test-241-* files discovered
EXIT=1
```
File restored (`ls tests/test-241-guardian-tripolar-parity.cjs` confirmed present again).

## Known Result: `bash tests/run-all-241.sh` does NOT exit 0

**Actual observed run** (full log captured; PASS/FAIL summary):
```
--- test-241-guardian-tripolar-parity.cjs ---
>>> test-241-guardian-tripolar-parity.cjs: PASSED
--- guardian-onstop-reaches-user.test.cjs (241-01, SC1) ---
>>> guardian-onstop-reaches-user.test.cjs (241-01, SC1): FAILED
--- minto-debounce-consumer-census.test.cjs (241-02, F-0) ---
>>> minto-debounce-consumer-census.test.cjs (241-02, F-0): PASSED
--- precommit-real-commit.test.cjs (241-04, SC3) ---
>>> precommit-real-commit.test.cjs (241-04, SC3): PASSED
--- feynman-minto-guardian.test.cjs (core suite) ---
>>> feynman-minto-guardian.test.cjs (core suite): PASSED
--- feynman-minto-invariants.test.cjs (core suite, F-2) ---
>>> feynman-minto-invariants.test.cjs (core suite, F-2): PASSED
--- debouncer-drain-at-prompt.test.cjs (the real F-0 consumer) ---
>>> debouncer-drain-at-prompt.test.cjs (the real F-0 consumer): PASSED
--- run-feynman-tests.cjs (whole-suite roll-up, 396 files) ---
>>> run-feynman-tests.cjs (whole-suite roll-up, 396 files): FAILED
--- regression tripwire: the four retired defects stay retired ---
>>> regression tripwire: PASSED
Phase 241: PASS=7 FAIL=2 SKIP=0
```

Both FAILs are pre-existing, already-documented, out-of-scope for this plan (full detail in `.planning/phases/241-feynman-minto/deferred-items.md`):

1. **`guardian-onstop-reaches-user.test.cjs` LEG B** (241-01's own file, not touched by this plan): its timing margin was already documented as tight (~2874-2927ms against a 3000ms budget). During this plan's execution, `ps aux` confirmed at least 3 separate concurrent Claude Code sessions running on this machine (matching this session's own critical-scope-boundary warning about a separate, uncoordinated Phase 236 session), pushing the observed elapsed time to ~3300ms, over the test's own hard-coded budget. `git diff --stat scripts/on-stop`, checked at the moment of this failure, showed ONLY this plan's `MINDRIAN_MCP_FIRST` thin-branch fold-in -- the legacy default path's own timing-critical code was never touched.
2. **`run-feynman-tests.cjs` mega-suite**: hangs indefinitely inside `test/84-smart-notebook-copilot.test.cjs`, a pre-existing SQLite handle defect in `lib/core/lazygraph-ops.cjs` -- the same hang 241-01-SUMMARY.md, 241-03-SUMMARY.md, and 241-04-SUMMARY.md each independently reproduced and documented. `lib/core/lazygraph-ops.cjs` is explicitly OFF LIMITS to this session (owned by the concurrent Phase 236 session per this executor's own scope boundary). The harness wraps this leg in `timeout 240` so it cannot hang the harness forever; it is expected to time out for this one already-documented reason.

Per the plan's own verification item 3 ("`node lib/memory/run-feynman-tests.cjs` exits 0") and the success criterion ("`bash tests/run-all-241.sh` exits 0 and prints `PASS=n FAIL=0 SKIP=0`"), this is a genuine gap between the plan's literal text and observed ground truth. Both underlying defects are pre-existing, external to this plan's own edit surface, and explicitly out of this session's scope to fix (one is a documented timing-margin issue in a sibling plan's test file; the other touches a file owned by a concurrent, off-limits phase). Reporting `FAIL=0` here would have been a fabrication; the honest result is recorded instead, matching the standing_rules mandate and the repo's own `tests/run-all-234.sh` "EXPECTED RED LEG WHILE THE PHASE IS IN FLIGHT" precedent.

## Verification Commands Run

- `grep -c '_closeOutGuardianOnStop' lib/mcp/stop-gate-handler.cjs` -> 4 (see Deviation 1)
- `grep -c 'feynman-minto-guardian' lib/mcp/stop-gate-handler.cjs` -> 3 (>= 1 required)
- `grep -c 'guardian_sm' lib/mcp/stop-gate-handler.cjs` -> 3 (>= 2 required)
- `grep -c 'guardian_sm' scripts/on-stop` -> 1 (>= 1 required)
- `bash -n scripts/on-stop` -> exit 0; `node -e "require('./lib/mcp/stop-gate-handler.cjs')"` -> loads cleanly
- `node lib/memory/on-stop-snapshot.test.cjs` -> 8/8 passed
- `git diff --stat hooks/hooks.json` -> empty across all 3 task commits (Part 11 body-level-change exemption re-confirmed)
- `node tests/test-241-guardian-tripolar-parity.cjs` -> 3/3 passed, re-run 3 additional times for stability, all green
- `git diff --stat lib/mcp/stop-gate-handler.cjs scripts/on-stop` -> empty after all mutation-proof restorations
- `grep -c "grep -v '\^\[\[:space:\]\]\*#'" tests/run-all-241.sh` -> 2 (>= 1 required)
- `chmod +x tests/run-all-241.sh; ls -la tests/run-all-241.sh` -> `-rwxr-xr-x`; `bash -n tests/run-all-241.sh` -> exit 0
- `bash tests/run-all-241.sh` (full run, captured in background) -> `PASS=7 FAIL=2 SKIP=0`, exit 1 (see "Known Result" section above)
- Zero-glob-discovery mutation proof -> confirmed fails with `!!! no tests/test-241-* files discovered`, exit 1; file restored
- All 3 tripwire mutations (vacuum, timeout1, discard) hand-verified to bite via the real file's exact grep pipeline; real file confirmed clean
- `grep -nP '\x{2014}|\x{2013}'` across all 4 files this plan created/modified (`lib/mcp/stop-gate-handler.cjs`, `scripts/on-stop`, `tests/test-241-guardian-tripolar-parity.cjs`, `tests/run-all-241.sh`) -> no em-dash characters found

## Issues Encountered

1. The known, pre-existing `run-feynman-tests.cjs` mega-suite hang (see "Known Result" above and `deferred-items.md`).
2. The known, pre-existing timing-margin flakiness in `guardian-onstop-reaches-user.test.cjs` LEG B under concurrent-session CPU load (see "Known Result" above and `deferred-items.md`).
3. A confirmed, already-filed external `gsd-tools.cjs` state-resync defect hit live during this plan's own state bookkeeping (see Deviation 2); worked around per the RCA's own documented pattern, with fresh evidence appended.

None of the three are caused by this plan's own edits; all three are logged with evidence rather than silently absorbed.

## User Setup Required

None. No new environment variable, service, or configuration is introduced by this plan. The shared-path guardian timeout (3000ms) is hardcoded to match the CLI path's own default, not exposed as a new tunable.

## Next Phase Readiness

This is the LAST plan in Phase 241. Per this session's critical scope boundary, phase-level completion (marking Phase 241 done in ROADMAP.md's progress table, advancing STATE.md's Current Position past Phase 241) is explicitly the orchestrator's own step and is NOT run here. `gsd-tools.cjs query phase.complete` was NOT run, per the same scope boundary (confirmed bug risk of cross-phase corruption, `.planning/debug/gsd-phase-complete-cross-phase-corruption.md`).

- `roadmap.update-plan-progress 241 241-05 done` was run for this plan's own checkbox only (see State Updates below).
- `lib/mcp/stop-gate-handler.cjs` and `scripts/on-stop` are both now stable surfaces for this phase; no further 241-series plan is scheduled to touch either.
- `.planning/phases/241-feynman-minto/deferred-items.md` carries forward the two pre-existing, out-of-scope test issues for whoever next touches `lib/memory/guardian-onstop-reaches-user.test.cjs` or the concurrent Phase 236's `lib/core/lazygraph-ops.cjs`.

## Self-Check: PASSED

- FOUND: lib/mcp/stop-gate-handler.cjs
- FOUND: scripts/on-stop
- FOUND: tests/test-241-guardian-tripolar-parity.cjs
- FOUND: tests/run-all-241.sh
- FOUND: .planning/phases/241-feynman-minto/deferred-items.md
- FOUND: .planning/phases/241-feynman-minto/241-05-SUMMARY.md
- FOUND: /home/jsagi/MindrianRooms/rethinking-mindrianos/research/2026-07-28-feynman-minto-guardian-reachability/2026-07-28-feynman-minto-guardian-reachability.md
- FOUND: /home/jsagi/MindrianRooms/mindrianOS/research/2026-07-28-feynman-minto-guardian-reachability.md
- FOUND commit: c7fb00db (Task 1)
- FOUND commit: d8cb1735 (Task 2)
- FOUND commit: d4f67b17 (Task 3)

---
*Phase: 241-feynman-minto*
*Completed: 2026-07-28*
