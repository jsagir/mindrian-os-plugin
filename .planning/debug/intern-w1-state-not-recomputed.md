---
status: diagnosed
kind: rca
trigger: "intern-w1-state-not-recomputed"
issue_id: ""
severity: medium
surfaces: [cli]
brain_mode: tier-0
canon_parts: []
created: 2026-07-11T00:00:00Z
updated: 2026-07-11T00:10:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED (see Technical Root Cause / Resolution). An automatic PostToolUse hook (`scripts/post-write` -> `bin/mindrian-tools.cjs cascade` -> `lib/core/intelligence-cascade.cjs::_runCascadeSteps` Step 8) DOES exist and DOES fire on every Write/Edit/MultiEdit into a room section - the original "no automatic hook exists by design" hypothesis is ELIMINATED. The real defect: Step 8 calls `scripts/compute-state` (a stdout-only script, by design - it never writes STATE.md itself) via `execSync` and discards the stdout instead of redirecting it to `STATE.md`, while still reporting `computeState: { status: 'ok' }`. The exposed MCP fallback (`room_state` tool, `compute-state` command, `lib/mcp/tool-router.cjs` lines 463-465) has the identical defect - it returns the freshly computed text as a chat message but never writes it to disk either, despite its own suggested-next text claiming "State updated". So this is NOT a discipline/instruction gap: even if Larry HAD manually invoked the intended "re-run compute-state" fix via the MCP tool, it would not have persisted. Both empirically reproduced (see Evidence).
test: DONE - reproduced via direct `runCascade()` call against a fixture room and via direct `stateOps.computeState()` call; both show STATE.md untouched on disk while the returned/logged status claims success.
expecting: N/A - hypothesis confirmed, investigation complete for diagnose-only scope.
next_action: none - return ROOT CAUSE FOUND. (Fix would add `fs.writeFileSync(path.join(roomDir, 'STATE.md'), computedOutput)` at both call sites, mirroring the pattern already correct in `scripts/on-stop`, `scripts/on-task-complete`, `scripts/on-agent-complete`.)

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version observed: v1.15.3-beta.10
- Target version: v1.15.3-beta.13
- Reported by: Intern-4 (pseudonym), JHU intern QA program, via Larry's own Part B self-QA
- Date first observed: 2026-07-07
- Related debug sessions: `.planning/debug/intern-qa-week1-bug-sweep.md` (Row F), `.planning/debug/intern-w1-rooms-new-silent-fail.md` (same session, same class of "claimed progress without verifying")

## Problem Statement

After filing a new file into a room section, STATE.md was never recomputed, so Larry's claim that "your room moved forward" was not reflected in the room's own intelligence layer at the time it was made.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: after a room-section write, STATE.md reflects the new content before or immediately after Larry tells the user the room "moved forward."
actual: "I wrote market-analysis/research-pm-role-outlook.md into room/ but never re-ran compute-state, so STATE.md does not reflect it. Then I claimed 'your room moved forward.' The file is real, but the room's own intelligence does not know that yet."
errors: none - a missing step, not a crash.
reproduction:
  1. In an active room, file a new .md into any section directory directly (e.g. market-analysis/).
  2. Check STATE.md's entry count / last-updated field for that section.
  3. Observe whether it reflects the new file without an explicit separate compute-state invocation.
started: observed 2026-07-07, v1.15.3-beta.10.

## Scope and Impact

- Affected surfaces: cli (confirmed)
- Affected commands: any filing path that writes into a room section without also calling `scripts/compute-state`
- Affected users: all installs, any session where Larry files evidence/artifacts mid-conversation
- Version range: beta.10, unconfirmed upper bound; may be long-standing (this looks like a design gap, not a regression)
- Severity: medium - stale intelligence, not a false CLAIM about room existence (contrast the higher-severity `rooms-new` bug) - but still a "said X, X isn't true yet" pattern
- Blast radius: anything downstream that reads STATE.md as current (dashboard, wiki, room_state tool - possible overlap with `intern-w1-room-state-false-empty.md`, check for a shared resolver/staleness root cause)

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: "No automatic hook exists by design - STATE.md recompute is left as a manual step Larry must remember to run."
  evidence: `hooks/hooks.json` PostToolUse registers `scripts/post-write` for matcher `Write|Edit|MultiEdit`, unconditionally, on every plugin install. `scripts/post-write` (lines 225-268) walks up from the written file for a `STATE.md` sentinel and, when found, calls `bin/mindrian-tools.cjs cascade <roomDir> <filePath> --raw`, which delegates to `lib/core/intelligence-cascade.cjs::runCascade` -> `_runCascadeSteps`. Step 8 of that function (lines 436-445) explicitly invokes `bash scripts/compute-state <roomDir>` with the comment "recompute STATE.md". This is a real, wired, automatic mechanism - it is not absent. Empirically confirmed: `runCascade()` called directly against a fixture room returned `computeState: { status: 'ok' }`. The hypothesis that no such wiring exists is false.
  timestamp: 2026-07-11T00:05:00Z

- hypothesis: "This is a pure workflow-discipline/instruction gap - if Larry had just remembered to manually re-run compute-state, STATE.md would have been correct."
  evidence: The MCP-exposed manual path an agent would actually invoke - `room_state` tool, `command: 'compute-state'` (`lib/mcp/tool-router.cjs` lines 463-465) - calls `stateOps.computeState(roomDir)` (`lib/core/state-ops.cjs`), which returns `execSync`'s stdout as a string, and returns that text as a chat response with a `formatSuggestedNext(... 'State updated' ...)` suffix. It never calls `fs.writeFileSync` or any file-write against `STATE.md`. Empirically confirmed: calling `stateOps.computeState(roomDir)` directly against the fixture room returned freshly correct content (`total_entries: 6`) while `STATE.md`'s on-disk mtime was provably unchanged. Even a disciplined, correctly-invoked manual retry through the tool Larry has available would not have fixed the staleness. The "just needs a reminder to call it" framing is false; the tool itself is broken.
  timestamp: 2026-07-11T00:07:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-07-11T00:00:00Z
  checked: Intern-4's Part B self-QA document (verbatim)
  found: quote above.
  implication: Larry's own account frames this as a workflow-discipline miss ("never re-ran compute-state"), which may mean the fix is procedural (always call compute-state after a write) rather than a code defect - investigation should confirm whether ANY code path auto-triggers it before concluding this needs a persona/instruction fix instead of a code fix.

- timestamp: 2026-07-11T00:02:00Z
  checked: `hooks/hooks.json` PostToolUse block; `scripts/post-write`; `lib/core/intelligence-cascade.cjs`
  found: PostToolUse fires `scripts/post-write` unconditionally on `Write|Edit|MultiEdit`. `post-write` walks up from the written file for a `STATE.md` sentinel, and when found runs `bin/mindrian-tools.cjs cascade <roomDir> <filePath> --raw`, which calls `intelligence-cascade.cjs::runCascade` -> `_runCascadeSteps`. Step 8 (lines 436-445) runs `bash scripts/compute-state <roomDir>` via `execSync(..., { stdio: ['ignore','pipe','pipe'] })` - the return value is NEVER assigned to a variable and NEVER written anywhere. It unconditionally sets `stepsResult.computeState = { status: 'ok' }` on success (exit code 0), regardless of what happens to the output.
  implication: An automatic post-write hook DOES exist and IS wired to attempt STATE.md recomputation on every room-section write. The "no hook exists" branch of the original hypothesis is false. The defect is downstream: the hook calls compute-state correctly but throws the result away instead of persisting it.

- timestamp: 2026-07-11T00:03:00Z
  checked: `scripts/compute-state` (full script, lines 1-330) plus every call site (`grep` across scripts/lib/commands/skills)
  found: `scripts/compute-state` is a pure stdout-emitting script by design (header comment: "Scan room/ directory and output STATE.md content"; it internally shells out to `compute-team` and `compute-meetings-intelligence`, which DO write `TEAM-STATE.md`/`MEETINGS-INTELLIGENCE.md`, but `compute-state` itself never writes `STATE.md`). Every call site is responsible for redirecting stdout. Sites that redirect correctly: `scripts/on-stop` (line 128: `printf '%s\n' "$state_content" > "${ROOM_DIR}/STATE.md"`), `scripts/on-task-complete` (line 53, same pattern), `scripts/on-agent-complete` (line 133: `... > "${ROOM_DIR}/STATE.md"`), and the room-scaffolding command markdown files (`commands/new-project.md`, `commands/rooms.md`, `commands/act.md` + their `skills/*/SKILL.md` mirrors) which instruct explicit `bash scripts/compute-state ... > STATE.md`. Sites that do NOT redirect: `lib/core/intelligence-cascade.cjs` Step 8 (the automatic post-write path) and `lib/mcp/tool-router.cjs`'s `room_state` tool `compute-state` command (`lib/core/state-ops.cjs::computeState()` just returns the string).
  implication: STATE.md only ever gets persisted via three hook paths (on-stop / on-task-complete / on-agent-complete, all of which fire at TURN or SUBAGENT boundaries, not synchronously after the write) or via explicit scaffolding commands. The synchronous "right after this write" path (post-write cascade) and the manual "Larry re-runs it" path (room_state MCP tool) are both silently no-ops on the persistence side.

- timestamp: 2026-07-11T00:05:00Z
  checked: Empirical reproduction - built a fixture room at `<scratchpad>/repro-room/room/` with a stale `STATE.md` (`total_entries: 0`, `computed: 2020-01-01T00:00:00Z`) and an empty `market-analysis/` section, wrote a new file `market-analysis/research-pm-role-outlook.md`, then called `require('./lib/core/intelligence-cascade.cjs').runCascade(roomDir, { trigger: 'test', filePath })` directly (the exact function `bin/mindrian-tools.cjs cascade` invokes from `scripts/post-write`).
  found: Returned `"computeState": { "status": "ok" }` (a false-success signal). `STATE.md` on disk was read immediately after and was byte-identical to the pre-write stale fixture (`computed: 2020-01-01T00:00:00Z`, `total_entries: 0`, "Data Room State (STALE FIXTURE)" header) - completely unchanged despite the new artifact.
  implication: Direct proof that the live, wired, automatic PostToolUse cascade path reports success while leaving STATE.md stale. This reproduces Intern-4's exact symptom via the exact code path the hypothesis originally doubted existed.

- timestamp: 2026-07-11T00:07:00Z
  checked: Empirical reproduction - against the same fixture room (still holding the stale STATE.md from the prior check), called `require('./lib/core/state-ops.cjs').computeState(roomDir)` directly (the exact function `lib/mcp/tool-router.cjs`'s `room_state` tool `compute-state` command calls) and compared `STATE.md`'s mtime before/after.
  found: `computeState()` returned freshly correct content (`total_entries: 6`, reflecting the filed artifact plus proactive-intelligence-extracted opportunities from the prior cascade run). `STATE.md`'s on-disk mtime was provably unchanged before vs. after the call (`changed: false`).
  implication: Direct proof that the MCP-exposed "manual re-run" surface an agent would actually reach for is equally broken - it computes the right answer and simply never writes it. This eliminates "Larry just needed to remember to call compute-state" as a sufficient fix; the callable tool itself does not persist.

## Technical Root Cause

**This is a CODE DEFECT, not an instruction/discipline gap, and not a case of "no automatic hook exists by design."**

`scripts/compute-state` is, by design, a pure computation script: it scans a room directory and prints a fully-formed `STATE.md` body to **stdout only**. It never writes `STATE.md` itself (it does write `TEAM-STATE.md` and `MEETINGS-INTELLIGENCE.md` as side effects via `compute-team`/`compute-meetings-intelligence`, but not `STATE.md` - the caller owns that). Every caller is therefore responsible for capturing stdout and persisting it.

Three callers get this right (`scripts/on-stop` line 128, `scripts/on-task-complete` line 53, `scripts/on-agent-complete` line 133 - each does `... > "${ROOM_DIR}/STATE.md"`), plus the room-scaffolding slash commands (`new-project`, `rooms`, `act`) which explicitly instruct the redirect.

Two callers get it wrong, and both are load-bearing for the "room-section write -> STATE.md freshness" contract the intern expected:

1. `lib/core/intelligence-cascade.cjs::_runCascadeSteps` Step 8 (lines 436-445) - the function the automatic PostToolUse hook chain (`hooks/hooks.json` -> `scripts/post-write` -> `bin/mindrian-tools.cjs cascade`) invokes on every `Write`/`Edit`/`MultiEdit` into a room section. It runs `compute-state` via `execSync` with the output routed to an ignored pipe, never captured, never written - yet unconditionally reports `computeState: { status: 'ok' }` on process exit 0. This IS an automatic, wired, firing-on-every-write hook (eliminating the "no hook by design" hypothesis) - it just silently drops the one output that matters.

2. `lib/mcp/tool-router.cjs`'s `room_state` tool, `compute-state` command (lines 463-465) - the MCP-exposed surface an agent would invoke to manually force a refresh. It calls `state-ops.cjs::computeState(roomDir)`, which returns `execSync`'s stdout as a plain string, and returns that text as the chat response with a `formatSuggestedNext(..., 'State updated - ...')` suffix that actively asserts persistence occurred. It never calls a file-write. This eliminates the "workflow-discipline miss" framing: even a correctly-disciplined manual retry through the tool Larry has available does not fix the staleness.

Both defects were empirically reproduced against a fixture room (see Evidence 2026-07-11T00:05 and T00:07): both compute the CORRECT fresh state and both leave the on-disk `STATE.md` byte-for-byte unchanged, while returning/implying success.

**Net effect:** `STATE.md` is only ever actually refreshed at three points - Stop-hook turn boundary, Task-tool subagent completion, or SubagentStop - never synchronously after the write itself, and never via the one tool an agent would reach for to force a synchronous refresh. Intern-4's report ("I wrote the file... but never re-ran compute-state... Larry then claimed 'your room moved forward'") is the direct observable consequence: at the moment the claim was made (same turn as the write, before any Stop-hook boundary), STATE.md was necessarily stale, and even a deliberate attempt to fix that mid-turn via the exposed tool would have failed silently.

## Required Code Changes
<!-- Explicit, imperative, one block per change -->

CONFIRMED: this is a Required Code Change, NOT a Non-Code Follow-up. Diagnose-only scope stops here (no edits made in this session); the fix direction for a follow-up `find_and_fix` session is:

1. In `lib/core/intelligence-cascade.cjs::_runCascadeSteps` Step 8 (around lines 436-445): capture `execSync`'s return value (add `encoding: 'utf8'` and drop `stdio: ['ignore', ...]` in favor of capturing stdout) and write it to `path.join(roomDir, 'STATE.md')` via `fs.writeFileSync` before setting `stepsResult.computeState = { status: 'ok' }`. Mirror the pattern already correct in `scripts/on-stop`/`scripts/on-task-complete`/`scripts/on-agent-complete`.
2. In `lib/mcp/tool-router.cjs`'s `room_state` tool, `compute-state` case (lines 463-465): after computing via `stateOps.computeState(roomDir)`, write the result to `STATE.md` (e.g., extend `state-ops.cjs::computeState()` with an optional persist step, or add a sibling `persistState(roomDir, computed)` helper) before returning the response that already claims "State updated".
3. Consider whether `state-ops.cjs::computeState()` should persist by default (single chokepoint, matching the on-stop/on-task-complete/on-agent-complete pattern) rather than leaving persistence to be re-implemented at each of the 5 call sites - this would remove the "5 places, 2 miss it" failure class outright, consistent with the KB's recurring "N-independent guessers/callers" pattern (Canon Part 7 reuse-before-build).

## Tests to Add or Update

Candidate for the follow-up fix session: an integration test that (a) seeds a fixture room with a stale `STATE.md`, (b) calls `intelligence-cascade.cjs::runCascade()` directly with a new artifact `filePath` (as this session did manually), and (c) asserts `STATE.md`'s `total_entries`/`computed` frontmatter actually changed on disk - not just that `computeState.status === 'ok'` in the returned object. A second test should do the same against `lib/mcp/tool-router.cjs`'s `room_state` `compute-state` command via the MCP handler directly.

## Non-Code Follow-ups
<!-- The release and canon obligations a code fix alone does not satisfy -->

- CHANGELOG.md: Fixed entry under v1.15.3-beta.13 once the code fix (see Required Code Changes) ships.
- knowledge-base.md: summary block on resolve, cross-referencing this as a "computed-but-not-persisted" defect class (sibling to, but distinct from, the "N-independent active-room guessers" class already documented for `intern-w1-room-state-false-empty.md` / the beta.12 `tool-router.cjs` fix).
- Row F of `intern-qa-week1-bug-sweep.md` should be marked confirmed NEW FAILURE (code defect, not ENV GAP/instruction gap) referencing this file.
- Consider whether `lib/core/intelligence-cascade.cjs`'s `formatSuggestedNext` / cascade status object should distinguish "the underlying script ran and exited 0" from "the intended file-write side effect actually occurred" more generally - `computeState: { status: 'ok' }` is a symptom of a broader pattern where a wrapped script's exit code is conflated with fulfilling its caller's intent.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: Two call sites (`lib/core/intelligence-cascade.cjs` Step 8, the automatic PostToolUse cascade step; and `lib/mcp/tool-router.cjs`'s `room_state` `compute-state` MCP command, the manual re-run surface) invoke `scripts/compute-state` - a script that, by design, only prints the computed STATE.md body to stdout and never writes the file itself - but discard/never-capture that stdout instead of persisting it to `STATE.md`, while both report/imply success. Three sibling call sites (`scripts/on-stop`, `scripts/on-task-complete`, `scripts/on-agent-complete`) correctly redirect the same script's stdout to `STATE.md`, proving the correct pattern already exists in the codebase and was simply not applied at these two sites. This is a genuine code defect, not "no automatic hook exists by design" (a hook exists and fires on every write) and not a workflow-discipline/instruction gap (the manual tool an agent would use is equally broken). Empirically reproduced twice (see Evidence).
fix: NOT APPLIED (diagnose-only session, goal: find_root_cause_only). Fix direction documented in Required Code Changes for a follow-up find_and_fix session.
verification: N/A - no fix applied in this session.
files_changed: []
commits: []
