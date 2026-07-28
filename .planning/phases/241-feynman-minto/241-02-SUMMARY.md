---
phase: 241-feynman-minto
plan: 02
subsystem: infra
tags: [bash, node, minto-debouncer, stop-hook, feynman-minto, dead-letter-queue, rca]

# Dependency graph
requires:
  - phase: 241-feynman-minto
    provides: "241-01's GUARDIAN_SM capture/fold in scripts/on-stop and the ONSTOP_WALK_BUDGET_MS soft deadline (this plan edits different lines of the same file, read the current file on disk, not stale line numbers)"
provides:
  - "Neither stop-path site (scripts/on-stop, lib/mcp/stop-gate-handler.cjs) empties the minto-debounce queue; both peek() and report an honest pending count"
  - "A production call-site census (lib/memory/minto-debounce-consumer-census.test.cjs) proving scripts/intent-classifier (extensionless bash wrapper) both drains and acts on the drained array"
  - "A corrected, resolved RCA at .planning/debug/resolved/minto-debounce-consumer-dead-end.md documenting the extension-scoped-grep methodology error and what actually survived"
affects: [241-03, 241-04, 241-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read-only peek(roomDir) census idiom replacing an unconditional drain(roomDir, {olderThanMs:0}) vacuum at a Stop-hook close-out site"
    - "Directory-walk production census (not extension-glob) as the standing pattern for proving a call site is genuinely wired, per this exact RCA's own methodology-error lesson"
    - "Mutated-copy mutation-proof harness pins SCRIPT_DIR/PLUGIN_ROOT to the real repo path (241-01's own harness-bug lesson, reused verbatim)"

key-files:
  created:
    - lib/memory/minto-debounce-consumer-census.test.cjs
  modified:
    - scripts/on-stop
    - lib/mcp/stop-gate-handler.cjs
    - lib/memory/run-feynman-tests.cjs
    - .planning/debug/knowledge-base.md
  renamed:
    - ".planning/debug/minto-debounce-consumer-dead-end.md -> .planning/debug/resolved/minto-debounce-consumer-dead-end.md"

key-decisions:
  - "Did NOT wire a second consumer into scripts/intent-classifier.cjs. The RCA's own headline evidence (a grep against scripts/intent-classifier.cjs returning zero hits) was checked against the wrong file. The real UserPromptSubmit hook is scripts/intent-classifier, an extensionless bash wrapper, which has carried a live Phase 88-05 drain-and-act block since Phase 88, already covered by 7 tests. Building a second consumer would have duplicated a shipped mechanism and created two drains racing for the same queue."
  - "Replaced drain() with peek() at both stop-path sites rather than raising olderThanMs to a nonzero floor. peek() is read-only by construction; a TTL-based drain would have reintroduced a silent discard under a different name."
  - "Kept the _closeOutMintoDrain function name in lib/mcp/stop-gate-handler.cjs unchanged (only its body), preserving call-site/registry position stability per the plan's own read_first guidance."
  - "Marked the RCA's superseded Evidence entry SUPERSEDED in place rather than deleting it -- the wrong reading is itself the lesson the new census test's directory-walk design exists to prevent repeating."

patterns-established:
  - "Stop-path queue census by peek, not drain: any future Stop-hook close-out that touches a debounce/dead-letter queue should read, never unconditionally empty, unless it is itself the designated consumer."
  - "Production call-site census walks directories, never globs by extension, when proving a hook is genuinely wired -- this repo's hook entry points are deliberately extensionless (run-hook.cmd dispatch shape)."

requirements-completed: [MINTO-01]

# Metrics
duration: ~55min
completed: 2026-07-28
---

# Phase 241 Plan 02: Retire the Stop-Path Vacuum, Prove the Real Consumer, Resolve the RCA Summary

**Both Stop-path drains became read-only peek() censuses (scripts/on-stop, lib/mcp/stop-gate-handler.cjs), a 5-test production census proves scripts/intent-classifier (the extensionless bash wrapper) genuinely drains-and-acts, and the minto-debounce-consumer-dead-end RCA is corrected (the consumer was never missing, an extension-scoped grep just missed it) and resolved.**

## Performance

- **Duration:** ~55 min (first commit 12:53, last commit 13:12, plus extensive pre-task reading and post-commit mutation-proof verification)
- **Started:** 2026-07-28T09:20Z (approx, file-reading phase)
- **Completed:** 2026-07-28T10:14Z
- **Tasks:** 3/3
- **Files modified:** 4 (scripts/on-stop, lib/mcp/stop-gate-handler.cjs, lib/memory/run-feynman-tests.cjs, .planning/debug/knowledge-base.md) + 1 created (lib/memory/minto-debounce-consumer-census.test.cjs) + 1 renamed/resolved (.planning/debug/minto-debounce-consumer-dead-end.md -> .planning/debug/resolved/)

## Accomplishments

- **Closed finding F-0's real defect.** Both `scripts/on-stop` and `lib/mcp/stop-gate-handler.cjs`'s `_closeOutMintoDrain` used to run an unconditional `olderThanMs: 0` vacuum on every session stop, discarding every pending regen intent before the live consumer ever got a turn. Both now call the debouncer's existing read-only `peek(roomDir)` accessor and report a real pending count (`MINTO_QUEUE_PENDING` in bash, `minto_pending` in the returned object) instead.
- **Corrected the RCA's central claim, per the plan's mandatory instruction.** The filed RCA concluded the promised debounce consumer "was never wired," resting on a grep against `scripts/intent-classifier.cjs` returning zero hits. That grep was checked against the wrong file. The real UserPromptSubmit hook is `scripts/intent-classifier`, an extensionless bash wrapper (dispatched via `hooks/run-hook.cmd intent-classifier`), which has carried a live Phase 88-05 drain-and-act block since Phase 88 -- already covered by 7 tests in `lib/memory/debouncer-drain-at-prompt.test.cjs`. No second consumer was built; that would have duplicated a shipped mechanism (Canon Part 7).
- **Fixed the false-success summary text.** `scripts/on-stop`'s "N sections drained" claim (a section count, not a drained-entry count) is corrected to "sections scanned" at both the `STOP_SUMMARY_LINE` assignment and the `MINDRIAN_MCP_FIRST` thin-adapter branch, with a real pending-regen figure appended.
- **Built the census the RCA's own Test 1 spec demanded, and it works.** `lib/memory/minto-debounce-consumer-census.test.cjs` (5 tests) walks directories rather than globbing extensions -- specifically so it cannot repeat the RCA's own methodology error -- and correctly discovers and classifies `scripts/intent-classifier` as drain-and-act.
- **Resolved the RCA.** Added a CORRECTION block, marked the superseded Evidence entry SUPERSEDED in place, filled the Resolution block, moved the file to `.planning/debug/resolved/`, and appended a summary block to `knowledge-base.md` leading with the correction.

## Task Commits

1. **Task 1: Replace both unconditional stop-path vacuums with an honest read-only census** - `0d02e112` (fix)
2. **Task 2: Production call-site census and full enqueue-to-regen cycle test, per the RCA's own Test 1 and Test 2 spec** - `f228fa9e` (test)
3. **Task 3: Correct and resolve the minto-debounce-consumer-dead-end RCA** - `4ca7c5be` (docs)

_Plan metadata commit follows this summary._

## Files Created/Modified

- `scripts/on-stop` - drain call at the Phase 88-06 site replaced with a `MINTO_QUEUE_PENDING` peek census (initialized before the guard block so `set -u` cannot trip); `STOP_SUMMARY_LINE` and the `MINDRIAN_MCP_FIRST` thin-branch message corrected from "sections drained" to "sections scanned" plus a real pending count; header docstring corrected
- `lib/mcp/stop-gate-handler.cjs` - `_closeOutMintoDrain`'s body switched from `drain(roomDir, {olderThanMs:0})` (discarded return) to `peek(roomDir)` (returns the real pending count, never throws); `closeOutRoom` surfaces it as `minto_pending`
- `lib/memory/minto-debounce-consumer-census.test.cjs` (new) - 5 tests: production census (directory-walk), vacuum ban, hook-reachability, full enqueue-to-drain-to-act cycle, that cycle's mutation proof
- `lib/memory/run-feynman-tests.cjs` - registered the new test file immediately after `debouncer-drain-at-prompt.test.cjs`
- `.planning/debug/resolved/minto-debounce-consumer-dead-end.md` (moved from `.planning/debug/`) - CORRECTION block, superseded Evidence entry, filled Resolution block, `status: resolved`
- `.planning/debug/knowledge-base.md` - summary block appended, leading with the correction

## Decisions Made

See `key-decisions` in frontmatter. The two most load-bearing:

1. **No second consumer built.** The RCA's own recommendation (Option B) named `scripts/intent-classifier.cjs` as the wiring target, but that recommendation was itself downstream of the same wrong-file error this plan corrects. The actual live consumer already exists in `scripts/intent-classifier` (the bash wrapper). Building a second one would have raced two drains against the same queue in the same hook invocation.
2. **peek(), not a raised TTL.** Both stop-path sites switched to a genuinely read-only accessor rather than a nonzero `olderThanMs` floor, so no new silent-discard surface was introduced under a different tunable name.

## Grounding Consult (Mandatory)

`mcp__langtalks-graph-expert__*` tools are not present in this executor agent's toolset (only Read/Write/Edit/Bash were available). The phase's own `241-RESEARCH.md` already performed this exact consult at the phase level for the concepts this plan's design touches (dead-letter-queue consumer patterns, background job queue draining, debounce) and recorded an honest "not in corpus yet" for every mechanism-specific term queried: self-repair, self-correction, critic model, dead letter queue, background job queue, async worker, Minto pyramid, Feynman technique. "Reflection" and "guardrails" exist as loosely-connected entities related only via a shared episode co-mention, not a genuine documented architectural relationship. Per CLAUDE.md's own standing rule, "not in the corpus yet" is a valid, expected answer for this source; it was not re-attempted in this execution pass since the tool is unavailable to this agent, and no langtalks citation is fabricated anywhere in this plan's work.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test-quality bug, own test code] Census classification regex initially produced false positives from prose comments**
- **Found during:** Task 2, first run of `minto-debounce-consumer-census.test.cjs`
- **Issue:** The first cut of the CLI-shape classification regexes (`debouncer[\s\S]{0,80}\bdrain\b` / `\benqueue\b`) used an 80-character cross-line proximity window. This misclassified `scripts/feynman-minto-guardian.cjs` (a pure enqueue-producer) as "drain-only" because of an unrelated doc comment ("after the debouncer drain (88-06), aggregate"), and misclassified `lib/memory/run-feynman-tests.cjs` (a test registry file with zero call sites) as "drain-and-act" because its own registration comments for OTHER test files happened to mention "drain", "debouncer", "vault-section-minto-generator", and "pending-tier1-regen" within the same loose window.
- **Fix:** Narrowed the CLI-shape regexes to same-line-only (`[^\n]{0,20}`) and anchored on a real identifier/path token (`DEBOUNCER_SCRIPT`, `debouncer.cjs`, `minto-debouncer`) immediately adjacent to the subcommand word, rather than free-form 80-character prose proximity. Re-ran the census; both files now classify correctly (`scripts/feynman-minto-guardian.cjs` -> enqueue-producer, `lib/memory/run-feynman-tests.cjs` -> reference-only).
- **Files modified:** `lib/memory/minto-debounce-consumer-census.test.cjs`
- **Verification:** Re-ran the test file after the fix; all 5 tests green, and the printed census output for all 12 discovered production files hand-checked against `grep -n` on each file to confirm every classification is accurate (recorded below under "Final Census Output").
- **Committed in:** `f228fa9e` (Task 2 commit; the false-positive version was never committed)

---

**Total deviations:** 1 auto-fixed (Rule 1, confined to this plan's own new test file, zero production-code impact)
**Impact on plan:** The fix was necessary for the census to prove what it claims. A loose proximity regex would have shipped a test whose "drain-and-act" assertion could pass even against files that neither drain nor act -- the exact vacuous-gate shape this whole milestone is named after. Caught by hand-inspecting the printed census output before committing, not by an automated check.

## Mutation Proof Evidence

Per standing_rules, all three named mutation proofs were hand-inverted and the observed RED/GREEN output is recorded here (not merely asserted). Each mutation was applied to the real working-copy file, verified to turn the relevant test RED, then reverted via `git checkout -- <file>` (confirmed clean via `git status --short` before proceeding).

### Mutation 1 - restoring `--older-than=0` in `scripts/on-stop`

Mutated the working copy to reintroduce `node "${SCRIPT_DIR}/minto-debouncer.cjs" drain "${ROOM_DIR}" --timeout=1500 --older-than=0 >/dev/null 2>&1 || true` in place of the peek census block.

```
FAIL Test 2: zero production sites drain with a zero age floor (mutation-provable gate for Task 1)
AssertionError [ERR_ASSERTION]: no production site vacuums the debounce queue with a zero age floor.
  Offenders: ["scripts/on-stop"]
minto-debounce-consumer-census.test.cjs: 3/5 passed
```

Correctly RED (Test 5 also cascaded red, as expected, since its own harness-marker lookup no longer matched the mutated text). Reverted with `git checkout -- scripts/on-stop`; re-ran, 5/5 GREEN.

### Mutation 2 - restoring `olderThanMs: 0` in `lib/mcp/stop-gate-handler.cjs`

Mutated `_closeOutMintoDrain`'s body to call `debouncer.drain(roomDir, { timeoutMs: 1500, olderThanMs: 0 })` in place of `peek()`.

```
FAIL Test 2: zero production sites drain with a zero age floor (mutation-provable gate for Task 1)
AssertionError [ERR_ASSERTION]: no production site vacuums the debounce queue with a zero age floor.
  Offenders: ["lib/mcp/stop-gate-handler.cjs"]
minto-debounce-consumer-census.test.cjs: 4/5 passed
```

Correctly RED. Reverted with `git checkout -- lib/mcp/stop-gate-handler.cjs`; `node -e "require('./lib/mcp/stop-gate-handler.cjs')"` confirmed the module still loads cleanly; re-ran the census test, 5/5 GREEN.

### Mutation 3 - neutering the Phase 88-05 drain block in `scripts/intent-classifier`

Mutated the working copy, replacing `drained = debouncer.drain(roomDir, { timeoutMs: 500, olderThanMs: 30000 });` with an early `return;`.

```
FAIL Test 4: full cycle (RCA Test 2) -- guardian enqueues, entry survives to the next prompt, the real consumer drains and acts
AssertionError [ERR_ASSERTION]: pending-tier1-regen.json created by the real consumer within 2s
FAIL Test 5: mutation proof -- restoring the retired vacuum breaks the full cycle; the real fix lets it complete
AssertionError [ERR_ASSERTION]: with the real fix, the entry survives on-stop and the consumer picks it up at the next prompt
minto-debounce-consumer-census.test.cjs: 3/5 passed
```

Correctly RED (Test 5's real arm cascaded red too, as expected: with the consumer neutered, its own "real fix completes the cycle" assertion cannot hold). Reverted with `git checkout -- scripts/intent-classifier`; `bash -n scripts/intent-classifier` confirmed clean syntax; re-ran the census test, 5/5 GREEN.

## Behavioral Proof (Task 1 acceptance criterion)

Seeded a scratch `MindrianRooms` fixture, enqueued one entry (`node scripts/minto-debouncer.cjs enqueue <room> market-analysis test-behavioral-proof`), confirmed it present via `peek`, ran `MINDRIAN_ROOMS_HOME=<fixture> bash scripts/on-stop < /dev/null`, then `peek` again:

```
--- before on-stop ---
{"version": 1, "entries": [{"section": "market-analysis", "enqueued_at": "...", "reason": "test-behavioral-proof", "attempts": 0}]}
--- run on-stop ---
{"continue":true,"systemMessage":"session snapshot saved, 1 sections scanned, 1 regen pending, health low | ... | guardian: error in section market-analysis (existence, glyph low); 2 violations across 2 sections"}
--- after on-stop ---
{"version": 1, "entries": [{"section": "market-analysis", "enqueued_at": "...", "reason": "test-behavioral-proof", "attempts": 0}]}
```

The entry survives the stop (before this fix, the same sequence emptied it). The Stop-hook's own JSON output shows "1 regen pending" (the real `MINTO_QUEUE_PENDING` figure) instead of the old "sections drained" claim.

## Final Census Output (Task 2, hand-verified against each file)

```
hooks/hooks.json -> reference-only
lib/core/brain-derivation-queue.cjs -> reference-only
lib/mcp/stop-gate-handler.cjs -> reference-only
lib/mcp/tools/stop-gate.cjs -> reference-only
lib/memory/run-feynman-tests.cjs -> reference-only
lib/memory/validators/queue-health.cjs -> reference-only
scripts/feynman-minto-guardian.cjs -> enqueue-producer
scripts/intent-classifier -> drain-and-act
scripts/minto-debouncer.cjs -> drain-only (no downstream action found)
scripts/on-stop -> reference-only
scripts/post-write -> enqueue-producer
scripts/recompile-room-references.cjs -> reference-only
```

`scripts/minto-debouncer.cjs`'s "drain-only" classification is the module's own docstring usage example (`node scripts/minto-debouncer.cjs drain <roomDir>`) plus its CLI dispatch, correctly distinguished from an "act" site since the module itself never decides to act on what it drains -- callers do.

## Verification Commands Run

- `bash -n scripts/on-stop` -> exit 0
- `grep -c 'older-than=0' scripts/on-stop` -> 0; `grep -c 'olderThanMs: 0' lib/mcp/stop-gate-handler.cjs` -> 0
- `grep -c 'sections drained' scripts/on-stop` -> 0
- `grep -c 'MINTO_QUEUE_PENDING' scripts/on-stop` -> 3; `grep -n 'MINTO_QUEUE_PENDING=0' scripts/on-stop` at line 344, strictly before its first use
- `grep -c '_closeOutMintoDrain' lib/mcp/stop-gate-handler.cjs` -> 3 (definition, JSDoc mention, call site -- function not renamed); `grep -c 'minto_pending' lib/mcp/stop-gate-handler.cjs` -> 3
- `node -e "require('./lib/mcp/stop-gate-handler.cjs')"` -> loads cleanly
- `node lib/memory/on-stop-snapshot.test.cjs` -> **8/8 passed**
- `node lib/memory/minto-debouncer.test.cjs` -> **12/12 passed**
- `node lib/memory/minto-debounce-consumer-census.test.cjs` -> **5/5 passed**
- `node lib/memory/debouncer-drain-at-prompt.test.cjs` -> **7/7 passed** (pre-existing consumer's own suite, unaffected)
- `grep -c 'minto-debounce-consumer-census.test.cjs' lib/memory/run-feynman-tests.cjs` -> 1
- `node lib/memory/run-feynman-tests.cjs` (full suite, run in background to completion): the log shows `PASS lib/memory/debouncer-drain-at-prompt.test.cjs` at line 499 immediately followed by this plan's own census output and `PASS lib/memory/minto-debounce-consumer-census.test.cjs` (5/5 passed) at lines 500-520, confirming both the pre-existing consumer's suite and the new census file run and pass inside the full registered suite, in the expected registration order. Per 241-01-SUMMARY's own precedent, the full suite carries a set of pre-existing unrelated failures (Brain-connectivity-dependent tests, and a `node:sqlite` `'prepare' of undefined` issue in `test/84-smart-notebook-copilot.test.cjs` observed during this run) -- none of the failing files touch anything this plan modified.
- `test -f .planning/debug/resolved/minto-debounce-consumer-dead-end.md && ! test -f .planning/debug/minto-debounce-consumer-dead-end.md && grep -q 'root_cause: ' ... && grep -qi 'correction' ... && grep -q 'minto-debounce-consumer-dead-end' .planning/debug/knowledge-base.md` -> all passed
- `grep -cP '\x{2014}' .planning/debug/resolved/minto-debounce-consumer-dead-end.md` -> 0 (no em-dash in this plan's own added prose; the 4 em-dashes present elsewhere in `knowledge-base.md` are pre-existing entries from prior sessions, outside this plan's scope boundary)
- Behavioral proof and all three mutation proofs: see dedicated sections above.

## Issues Encountered

None beyond the one auto-fixed census-regex deviation documented above.

## User Setup Required

None - no external service configuration required. `MINTO_QUEUE_PENDING` (bash) and `minto_pending` (returned object field) are new observable outputs, not new tunables; no env var needs to be set for default behavior.

## Next Phase Readiness

- `scripts/on-stop` and `lib/mcp/stop-gate-handler.cjs` are both touched by this plan and by later 241-series plans (241-03 touches `validateSection`'s severity and `lib/core/feynman-minto-invariants.cjs`; 241-04 touches `runPreCommit`). This plan deliberately did not touch either of those, so those plans have a clean surface to land on.
- The `MINDRIAN_MCP_FIRST` thin-adapter branch in `scripts/on-stop` (lines ~53-124) had its one text-label correction applied but was NOT otherwise restructured; its guardian gap remains plan 241-05's scope, per the plan's own explicit boundary.
- `lib/mcp/stop-gate-handler.cjs`'s `closeOutRoom` now returns `minto_pending` as an additive field; no caller (grepped: `lib/mcp/stop-gate-handler.cjs:395`, the only production call site) needed updating, since the return object is read as a whole and the new field is purely additive.

## Self-Check: PASSED

- FOUND: scripts/on-stop
- FOUND: lib/mcp/stop-gate-handler.cjs
- FOUND: lib/memory/minto-debounce-consumer-census.test.cjs
- FOUND: lib/memory/run-feynman-tests.cjs
- FOUND: .planning/debug/resolved/minto-debounce-consumer-dead-end.md
- MISSING (expected, moved): .planning/debug/minto-debounce-consumer-dead-end.md
- FOUND: .planning/debug/knowledge-base.md
- FOUND: .planning/phases/241-feynman-minto/241-02-SUMMARY.md
- FOUND commit: 0d02e112 (Task 1)
- FOUND commit: f228fa9e (Task 2)
- FOUND commit: 4ca7c5be (Task 3)

---
*Phase: 241-feynman-minto*
*Completed: 2026-07-28*
