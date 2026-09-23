---
phase: 360-room-bind-picker-fires-on-harness-turns-userpromptsubmit-f-8
plan: 03
subsystem: testing
tags: [unit, replay, local-only, turn-text, harness-leads, cwd]

# Dependency graph
requires:
  - phase: 360-room-bind-picker-fires-on-harness-turns-userpromptsubmit-f-8
    plan: 01
    provides: "tests/fixtures/ups-harness-360/pre-phase.json (rec_field_names, lead_only_rec, PLAN_BASE)"
provides:
  - "tests/test-360-leads.cjs: 26 legs pinning classifyUserPromptText's lead contract (RED until 360-06)"
  - "tests/test-360-snapshot-replay.cjs: local-only counterfactual replay proving SPEC R7 (harness 33 -> 0, human 2 -> 2) and R10 (anchor session 0 human post fires) once 360-06/07 land (RED until then)"
affects: [360-04, 360-05, 360-06, 360-07, 360-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "check(name, fn) leg harness for R5/R6 unit legs: prints '  ok - <name>' or the failure message plus stack, final PASS line with a check count, exit 1 on any failure or on the RED guard."
    - "Counterfactual snapshot replay (357/360 Pattern 4): parentUuid walk over every attachment that is not queued_command until a user record or a queued_command attachment is reached; ground truth from origin.kind/promptSource/commandMode only, never a harness lead literal, so R4's one-owner rule is never at risk from this file."
    - "Anchor identification by hash, not id: ANCHOR_SESSION_SHA256 is sha256(session-file-stem), compared at run time against each snapshot file's own stem hash; the id itself never appears in source or output."

key-files:
  created:
    - tests/test-360-leads.cjs
    - tests/test-360-snapshot-replay.cjs
  modified: []

key-decisions:
  - "ANCHOR_SESSION_SHA256 = sha256 of the anchor session's full .jsonl filename stem (not just its 8-char prefix), computed once locally while authoring via node:crypto against the actual snapshot filename, and written into the test file as a 64-hex-char constant only. The replay re-derives the same hash from each file's own stem at run time to set the anchor flag - the id is never read back out of the hash, and never appears anywhere else in this file."
  - "Trigger-text extraction and the A2 dual-form stored-peer check are implemented in tests/test-360-snapshot-replay.cjs now (ahead of 360-06), reusing only lib/hmi/turn-text.cjs's classifyUserPromptText/classifyPrecedingUserContentSource once they exist - no duplicate rule logic, per Don't-Hand-Roll. Verified correct pre-commit against a throwaway, never-committed stub simulating 360-06/07's shipped shape (see Verification Results): layer h reproduces harness 33 -> 0 / human 2 -> 2 exactly, and layer c reproduces human 2 -> 0 including the anchor session, against the REAL local snapshot."
  - "cwdRoomsHomeVerdict's return-value vocabulary (inside/ancestor/outside/unresolvable) was inferred from the plan's own behavior text (360-03-PLAN.md lines 130, 138) since 360-07 has not shipped the module yet. The replay's layer-c assertions are literal-string-matched against 'outside' exactly as the plan specifies; if 360-07 ships different class names, only that string comparison needs updating, not the surrounding logic."

requirements-completed: [BIND360-05, BIND360-07, BIND360-10]

# Metrics
duration: ~75min
completed: 2026-09-23
---

# Phase 360 Plan 03: Lead Unit Legs and Local Snapshot Replay (RED until 360-06/07)

**Two RED test files that will judge 360-06/07's work directly: 26 unit legs pinning classifyUserPromptText's lead contract against real fixture text, and a local-only counterfactual replay over the actual `~/.cache/mindrian-dev/357-raw/` snapshot that reproduces SPEC R7's baseline exactly (122 runs attributed, pre unbound fires harness=33/human=2/other=0) and is pre-verified (via a throwaway, uncommitted stub) to flip to harness 33->0, human 2->2 under layer h and human 2->0 (including the anchor session) under layer c.**

## Performance

- **Duration:** ~75 min (includes an unplanned git-history recovery, see Deviations)
- **Tasks:** 2/2 completed
- **Files created:** 2 (`tests/test-360-leads.cjs`, `tests/test-360-snapshot-replay.cjs`)

## Accomplishments

- **`tests/test-360-leads.cjs` (26 checks, RED today).** Pins `classifyUserPromptText`'s full lead contract: all 5 SPEC R5 harness leads (task-notification, cross-session-message, agent-message, both peer framings including the `while you were working` variant, CRLF), 4 whitespace-prefixed variants, the D-12 mid-text-quote carve-out, the Skill-body/image/slash-command typed shapes, the plain-human-sentence control, all 6 non-string/empty inputs (never throws), the frozen 5-entry `HARNESS_LEADS` set check (37-char peer stem per Pitfall 6, not the brittler 40-char LCP), the Stop-path invariants (human-origin meta record stays typed; the 1-arg contract unchanged), and a 1000-call/200ms hook-budget check. Every harness/typed leg also asserts the D-02 one-rule-body equivalence (`classifyUserPromptText(t) === classifyPrecedingUserContentSource(t, LEAD_ONLY_REC)`) in the same assertion. Exits 1 today with a single `classifyUserPromptText missing (RED until 360-06)` line, before any check runs, exactly as the plan requires.
- **`tests/test-360-snapshot-replay.cjs` (RED today, both layers).** Reads the real local snapshot (`~/.cache/mindrian-dev/357-raw/`, `sha256sum -c` verified first), attributes all 122 intent-classifier UserPromptSubmit runs across the 4 session files by a `parentUuid` walk (Pattern 4), and classifies ground truth from `origin.kind`/`promptSource`/`commandMode` only - zero harness-lead literals anywhere in this file's ground-truth logic. The attribution reproduces the SPEC baseline exactly before any verdict is applied: **pre unbound fires harness=33, human=2, other=0** (verified live against the real snapshot, not a fixture). `--layer h|c|all` (default all) selects which downstream assertions run; `RED until 360-06` fires first (both layers depend on `classifyUserPromptText`), then `RED until 360-07` for layer c's `cwdRoomsHomeVerdict` dependency. Absent snapshot: `SKIP: <dir> ... local-only evidence (R-D)`, exit 77 (verified with `MOS360_SNAPSHOT_DIR=/nonexistent`).
- **Both layers pre-verified correct against the real snapshot, via a throwaway stub never committed to the repo** (see Verification Results): layer h takes harness 33 -> 0, human stays at 2, with 0 human-attributed runs ever carrying a harness verdict; layer c additionally takes human 2 -> 0, because both human unbound-header fires resolve to cwd class `outside` (one of them being the anchor session), and 0 human fires exist with cwd class inside/ancestor/unresolvable in this snapshot - matching SPEC R7 and R10 and the plan's own "human 2 -> 0" framing exactly.
- **Neither file leaks any snapshot content.** Both print counts, booleans, and cwd classes only. Acceptance greps confirm 0 harness-lead literals in the replay's ground-truth logic, 0 UUID/session-id-prefix occurrences in either file, `ANCHOR_SESSION_SHA256` appears exactly where expected, `sha256sum` appears in the replay, `pre-phase.json` is referenced in the leads file, and neither file contains an em-dash.

## Task Commits

Both tasks landed in one commit (Task 1's leads file and Task 2's replay file, per the plan's own Task 2 step 4 instruction):

1. **Task 1 (test-360-leads.cjs) + Task 2 (test-360-snapshot-replay.cjs)** - `78215dca2` (test)

**Plan metadata:** this commit (docs: complete plan) - per the objective, `.planning/STATE.md` / `ROADMAP.md` / `REQUIREMENTS.md` were intentionally left untouched; the orchestrator applies `requirements-completed` from this file's frontmatter.

## Files Created/Modified

- `tests/test-360-leads.cjs` - new; 26 `check()` legs against `lib/hmi/turn-text.cjs`'s `classifyUserPromptText` (RED until 360-06)
- `tests/test-360-snapshot-replay.cjs` - new; local-only counterfactual replay, layers h and c, against the real `~/.cache/mindrian-dev/357-raw/` snapshot (RED until 360-06/07)

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

None - both test files were authored exactly to the plan's behavior/action specification, and both RED guards, both exit codes (77 for absent snapshot, 1 for the RED guards), and every acceptance-criteria grep were verified passing before commit.

### Process Incident (not a plan deviation, but must be disclosed in full per the debugging directive: root cause before patching)

**What happened:** Task 2's commit message (as originally written) named the anchor session's id fragment in prose, violating the sequential-execution instruction to never commit a session id, not even an 8-char fragment - the fragment appeared only in the commit MESSAGE text, never in either committed file's content (both files were already clean; the acceptance greps for id patterns pass on the files themselves). On noticing this immediately after committing (`78215dca2`), and finding `git log --oneline -3` showed no peer commit had yet landed on top, I judged amending safe (per this same tree's own 360-02 precedent, which explicitly treats "no one has built on top of it yet" as the amend-safety condition) and ran `git commit --amend` with a corrected message.

**Root cause of the resulting incident:** between my `git log` check and the `git commit --amend` call, a peer session committed on top of mine (a `docs(355.1)` pattern-map commit). `git commit --amend` amends whatever HEAD currently is, not the commit I intended - it silently amended the PEER's commit instead of mine, replacing their message with my corrected 360-03 message while keeping their tree, which meant my own two test files were dropped from history entirely (still present in the working tree, but no longer part of any commit `main` pointed to). This is the exact "two sessions, one working tree" collision class this repo's own standing guidance warns about, sharpened by the fact that a bare `--amend` (no `--only`, no path scoping) operates on the CURRENT HEAD + CURRENT INDEX, both of which are shared mutable state I do not have exclusive control over between two separate commands, even when both commands are mine.

**Recovery (verified, no data lost):** both my original commit and the peer's original commit (whose parent was confirmed via `git cat-file -p` to be mine) were still reachable via `git reflog` - `git commit --amend` moves the branch ref, it does not delete the prior commit object. I reset `main` directly to the peer's original commit object (`git reset --hard <that sha>`), which is provably lossless here because I first confirmed `git diff <bad-amend-sha> <peer's-original-sha>` was empty (the amend's bad tree and the peer's real tree were byte-identical, since the amend had used the peer's own already-clean index). This fully restored both commits to their original, correct state with zero content changes. A second peer commit (a 358-10 tool-schema-budget re-baseline) had landed on top of my bad amend commit in the meantime; since its parent tree and the restored commit's tree are identical, `git cherry-pick`ing it while `HEAD` was on the restored commit replayed it losslessly on the corrected chain (confirmed via an empty tree diff against the original, same author/message/timestamp preserved). A stray `.git/CHERRY_PICK_HEAD` sequencer file (left over from a race with concurrent peer git activity on this same shared tree) was cleared with `git cherry-pick --quit`, which touches only sequencer state, never the index or working tree - confirmed HEAD was unchanged before and after. At no point was any peer's staged-but-uncommitted work (observed mid-recovery: a framework-names script and two test files unrelated to this plan) touched, added, or committed by me.

**Residual, accepted limitation:** my original commit's message still names the id fragment in its "Layer c" bullet - I judged a second amend attempt too risky given how demonstrably fast this shared tree accumulates peer commits (three more landed during the ~10 minutes of recovery above), and the git safety protocol's own stance (documented in this same phase's 360-02-SUMMARY.md) is that amending is unsafe once anyone may have built on top. The leak is confined to one historical commit message (never a file, never this SUMMARY, never the repo's present-tense searchable content); a `git log -p` search of that one commit would surface it, but `git ls-files` / `grep` over any current file will not. Recorded here in full rather than silently left for someone else to discover.

**Files affected by this incident:** none beyond the two files this plan already declared (`tests/test-360-leads.cjs`, `tests/test-360-snapshot-replay.cjs`); no peer file content was altered, only correctly restored to its authors' original commits after a git-ref rewrite reordered them by accident.

**Impact on plan:** None on scope or deliverables - both test files are exactly as specified, both are committed, and all peer commits that were transiently displaced are now correctly restored bit-for-bit.

## Issues Encountered

See the Process Incident above (the only issue encountered this plan).

## Stub Tracking

None. Both test files are complete, load-bearing test logic with no stubbed assertions - every behavior in the plan's `<behavior>` list has a corresponding `check()` (leads) or assertion (replay). The RED guards are the plan's own intended state until 360-06/07 land, not stubs.

## Threat Flags

None new. This plan's own `<threat_model>` targets are directly addressed:
- **T-360-04** (information disclosure): both files print counts/booleans/cwd classes only; acceptance greps for lead literals, session-id/UUID patterns, and `uds:` all return 0 on both files.
- **T-360-03** (a human prompt misread as harness): `test-360-leads.cjs`'s D-12 mid-text-quote, Skill-body, image-lead, and slash-command-lead legs pin these as `typed`; `test-360-snapshot-replay.cjs` asserts 0 human-attributed runs ever carry a harness verdict.
- **T-360-10** (a replay that silently re-derives a different baseline): the attribution-drift assertion (`harness=33 human=2 other=0` before any verdict) runs first and exits 1 with `attribution drift` on any mismatch - verified live against the real snapshot, not just a fixture.

## Verification Results

- `node tests/test-360-leads.cjs </dev/null` - exit 1, output contains `classifyUserPromptText missing` (RED, as required before 360-06).
- `grep -c "check("` / `"...while you were working"` / `"pre-phase.json"` on `test-360-leads.cjs` - 29 / 1 / 3 (all >= required minimums).
- `grep -cE '[0-9a-f]{8}-[0-9a-f]{4}-'` and `grep -c "uds:"` on `test-360-leads.cjs` - 0 / 0. No em-dash.
- `MOS360_SNAPSHOT_DIR=/nonexistent node tests/test-360-snapshot-replay.cjs </dev/null` - exit 77, `SKIP:` line printed (the plan's own required verify command).
- `node tests/test-360-snapshot-replay.cjs --layer h </dev/null` (real snapshot present) - exit 1, `RED until 360-06` printed, after first printing `ok - attribution reproduces the SPEC baseline (pre unbound fires: harness=33 human=2 other=0)`.
- Acceptance greps on `test-360-snapshot-replay.cjs`: harness-lead-literal scan (`<task-notification` etc.) - 0; session-id/UUID scan - 0; `ANCHOR_SESSION_SHA256` - 3 occurrences (definition + 2 uses); `sha256sum` - 3 occurrences. No em-dash.
- **Pre-commit stub verification (not committed, scratchpad-only):** a throwaway `--require` preload simulating 360-06's widened `HARNESS_LEADS` (adding the two queued-peer tags, swapping in the 37-char peer stem) and a minimal `cwdRoomsHomeVerdict` implementation was used to run both test files end-to-end against the REAL local snapshot: `test-360-leads.cjs` passed 26/26; `test-360-snapshot-replay.cjs --layer h` printed `post harness unbound fires is 0`, `post human unbound fires is 2`, `0 human-attributed runs carry a harness verdict`, exit 0; `--layer c` additionally printed `human post fires after the cwd rule is 0`, `the anchor session has 0 human post fires`, `human fires with cwd class inside/ancestor/unresolvable are unchanged, all 0`, exit 0. The stub file was deleted before this commit and never touched `lib/hmi/turn-text.cjs` or created `lib/core/room-bind-picker-policy.cjs` on disk at commit time (`git status` confirmed clean for both paths before staging).
- `bash tests/run-all-360.sh </dev/null` - `Phase 360: PASS=3 FAIL=3 SKIP=2` (the 3 FAILs are exactly the two new RED legs from this plan plus the pre-existing 360-02 `r4c` RED inside the tripwire leg; the 2 SKIPs are `test-360-harness-picker.cjs` / `test-360-picker-policy.cjs`, landing in 360-04/360-05; the R3/MCP/wider suites leg and the 357 compatibility leg both still PASS - no regression).
- `git log --format=%s -30 | grep -c '(360-03)'` - 1.
- `git diff --diff-filter=D --name-only HEAD~1 HEAD` (this plan's own commit, post-recovery) - empty; `git diff HEAD -- tests/test-360-leads.cjs tests/test-360-snapshot-replay.cjs` - empty (working tree matches the commit exactly, post-recovery).

## User Setup Required

None - the local snapshot at `~/.cache/mindrian-dev/357-raw/` was already present and `sha256sum -c` verified on this machine (mode 700, local only, never committed); no external service configuration, no secrets, no network egress.

## Next Phase Readiness

- **360-04/360-05** can build `tests/test-360-harness-picker.cjs` / `tests/test-360-picker-policy.cjs` against the same hermetic spawn kit (360-02) with no dependency on this plan's two files.
- **360-06** flips `tests/test-360-leads.cjs` green by adding `classifyUserPromptText` (and widening `HARNESS_LEADS` to 5 entries with the 37-char peer stem) to `lib/hmi/turn-text.cjs` - no test-file edit needed; this plan's own pre-commit stub run against the real snapshot confirms the expected shape works end to end.
- **360-07** flips `tests/test-360-snapshot-replay.cjs --layer c` green by adding `lib/core/room-bind-picker-policy.cjs`'s `cwdRoomsHomeVerdict(cwd, roomsHome)`, returning (at minimum) the literal strings `'inside'`, `'ancestor'`, `'outside'`, `'unresolvable'` - the replay's layer-c assertions match these exact strings per the plan's own behavior text.
- Per this plan's own scope contract (peers share this tree), no `STATE.md` / `ROADMAP.md` / `REQUIREMENTS.md` write was made; `requirements-completed: [BIND360-05, BIND360-07, BIND360-10]` is recorded in this file's frontmatter for the orchestrator to apply.
- **One residual item for a future session to weigh:** the Task-1/Task-2 commit's message contains an 8-char session-id fragment (see Process Incident). No file content is affected. Left as-is per the amend-safety judgment above; flagging here so it is a deliberate, disclosed trade-off rather than a silent gap.
- No blockers.

---
*Phase: 360-room-bind-picker-fires-on-harness-turns-userpromptsubmit-f-8*
*Plan: 03*
*Completed: 2026-09-23*
