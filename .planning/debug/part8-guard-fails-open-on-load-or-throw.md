---
status: investigating
kind: rca
trigger: "part8-guard-fails-open-on-load-or-throw"
issue_id: "E-FAIL"
severity: high
surfaces: [cli, cowork]
brain_mode: full-loop
canon_parts: [8]
created: 2026-11-06T08:06:00Z
updated: 2026-11-06T08:06:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** branch `main` @ fca1650e4 (working tree of /home/jsagi/dev/MindrianOS-Plugin-release, plugin 2.0.0-beta.80)
- **WIRE claims probe against:** none. No Brain call, no network. The wire is a stub: `globalThis.fetch` is replaced by a counter that records request bodies.
- **Date of audit:** 2026-11-06
- **Re-verification rule:** each claim carries PROVEN (run in this session), UNVERIFIED or ASSUMED. Source of the claim: auditor egress message, section F of AUDITOR-FINDINGS-source.md, as checked in EGRESS-CLAIMS-CHECK.md claims c and f.

## Current Focus

hypothesis: the Part 8 hook and the in-process belt (callTool, query) are written fail-open on purpose, so a guard that cannot load or that throws lets the payload through.
test: test doubles only. A node --require preload for the hook child process. A require.cache replacement and a require hook for in-process code. A fetch counter as the wire. No module on disk was edited or broken.
expecting: hook exit 0 and wire reached, in every failure mode, for a payload that the real guard blocks.
next_action: owner decision on the safe behavior (option-a, option-b or option-c). Plan 386-30 reads the Owner decision block.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin-release
- Plugin version: 2.0.0-beta.80
- Reported by: auditor egress message (hypothesis), checked in EGRESS-CLAIMS-CHECK.md claim c (CONFIRMED by code reading)
- Date first observed: 2026-11-05
- Related debug sessions: folder-memory-eager-timeline-runner-widens-guard-dependencies (plan 386-35, shortens the guard chain), part8-no-shape-test-for-sprouts-and-bodies (plan 386-37)

## Problem Statement

When the Part 8 guard cannot load, or its classify call throws, the hook exits 0 and the in-process belt sends the payload. The safeguard depends on the guard loading, and nothing tells the user when it does not.

## Symptoms

<!-- IMMUTABLE once the investigation starts -->

expected: when the guard cannot run, no payload that carries bytes leaves the machine, and the user sees why.
actual: hook exit 0 with empty stderr in all 3 failure modes. callTool and query() reach the stub wire with the payload bytes.
errors: none. The failure is silent by design.
reproduction:
  1. Scratch scripts (not committed): /tmp/claude-1000/-home-jsagi/7d57c6ef-4a06-4170-af16-564c4ba5e1a6/scratchpad/e29/preload.cjs, hook-probe.cjs, belt-probe.cjs.
  2. Hook: spawn scripts/part8-egress-guard-hook.cjs with `node --require preload.cjs`, env E29_MODE (guard-load-throws, classify-throws, sanitizer-load-throws), PART8_FORCE_BRAIN_AVAILABLE=1, temporary HOME. Stdin: a PreToolUse JSON for `mcp__plugin_mos_mindrian-brain__brain_ask` with a synthetic sprout, or a synthetic fake credential (`SK-` plus 40 characters).
  3. Belt: in a child process, replace the guard in require.cache (classify throws) or make the require of the guard throw, replace fetch with a counter, call `callTool('brain_ask', ...)` and `query(...)`.
started: Phase 239 (accepted risk A3 and threat T6) set the fail-open posture. Quick 260819-c8j added the belt with the same posture.

## Scope and Impact

- Affected surfaces: cli (the hook fires there), cowork (follows the hook path), desktop (no PreToolUse hook; the belt in callTool is the only guard there).
- Affected commands: every brain_* tool call that carries a payload.
- Affected users: all installs, only during a guard outage (load failure or throw).
- Version range: first bad is Phase 239; last checked beta.80.
- Severity: high (a constitutional safeguard vanishes silently), likelihood low (the guard has to break first).
- Blast radius: the same catch-and-continue posture appears in other guard calls of brain-client.cjs (the hat-aware recommend, suggest-validation, send-packet and advice paths; found by grep for the guard require, not probed). Those are out of scope for this RCA and not probed here (UNVERIFIED).

## Eliminated

- hypothesis: the host stops the call when the hook cannot run, because hooks.json sets `onFailure: block`.
  evidence: the hook never fails from the host point of view. It catches its own errors and exits 0 (see Evidence rows 1 to 3). The host applies `onFailure` only when the hook exits with a code other than 0 or 2, cannot start, times out or prints invalid JSON. PROVEN by code reading and by the official hooks documentation (see the host contract below).
  timestamp: 2026-11-06T08:06:00Z
- hypothesis: the guard is a large dependency chain, so a load failure is likely.
  evidence: plan 386-35 cut the guard from 172 to 10 repo modules in a fresh process (RCA folder-memory-eager-timeline-runner-widens-guard-dependencies, lines modules_guard_before: 172 and modules_guard_after: 10). I recounted the guard alone in a fresh process: 10 repo modules (PROVEN). The hook process still loads 173 (modules_hook_after: 173, from the same RCA; not recounted here), because the hook requires lib/core/navigation.cjs itself at run time for telemetry.
  timestamp: 2026-11-06T08:06:00Z

## Evidence

- timestamp: 2026-11-06T08:07:00Z
  checked: hook, baseline with the real guard, via hook-probe.cjs. Tool `mcp__plugin_mos_mindrian-brain__brain_ask`.
  found: sprout `{question:"explain dominant design"}` gives exit 0, stderr empty. Fake credential payload gives exit 2, stderr "Canon Part 8: outbound Theo payload carries room content (room_content, identifier). Blocked." (PROVEN)
  implication: the baseline works. The guard blocks a credential shape and lets a sprout pass.
- timestamp: 2026-11-06T08:07:10Z
  checked: hook, preload makes the require of lib/core/part8-egress-guard.cjs throw (mode guard-load-throws).
  found: sprout exit 0. Fake credential payload exit 0. stderr length 0 in both. (PROVEN)
  implication: a guard that cannot load lets a payload through. Site: the `catch (_)` after `require(GUARD_PATH)` in `main()` returns `allow()`.
- timestamp: 2026-11-06T08:07:20Z
  checked: hook, preload replaces `classify` with a function that throws (mode classify-throws).
  found: sprout exit 0. Fake credential payload exit 0. stderr length 0. (PROVEN)
  implication: same site. A throwing classify is also allowed.
- timestamp: 2026-11-06T08:07:30Z
  checked: hook, preload makes the require of lib/core/brain-response-sanitize.cjs throw (mode sanitizer-load-throws).
  found: sprout exit 0. Fake credential payload exit 0. stderr length 0. (PROVEN)
  implication: site: the `catch (_)` after `require(SANITIZER_PATH)` in `main()` returns `allow()`, so the guard is never reached.
- timestamp: 2026-11-06T08:08:00Z
  checked: callTool and query() through belt-probe.cjs, real guard, fetch counter as the wire.
  found: sprout reaches the wire (fetch calls 2: session init plus tools/call; 1 tools/call body). Fake credential: fetch calls 0, result error `egress_blocked`, for both callTool and query. (PROVEN)
  implication: baseline works at the belt.
- timestamp: 2026-11-06T08:08:10Z
  checked: callTool and query(), guard in require.cache replaced by a double whose classify throws.
  found: fake credential payload: fetch calls 2, 1 tools/call body, credential bytes in the body (credential_on_wire=true), no error in the result. Same for callTool and query. (PROVEN)
  implication: both belts send when classify throws. Sites: `catch (_e)` in `callTool` (comment "Belt-internal error ... degrade to existing behavior") and in `query()` (same comment).
- timestamp: 2026-11-06T08:08:20Z
  checked: callTool and query(), the require of the guard throws (a require hook, no file edited).
  found: same result as the previous row: credential on the wire, no error in the result. (PROVEN)
  implication: a guard that cannot load is also fail-open in both belts.
- timestamp: 2026-11-06T08:09:00Z
  checked: hooks/hooks.json, PreToolUse entry for the guard.
  found: matcher `mcp__(?:(?:plugin_[a-z0-9_-]+_)?(?:mindrian-brain|pws-brain-mcp)__.*|[a-z0-9_-]+__brain_[a-z0-9_]+)`, timeout 5 (seconds), `onFailure: block`. (PROVEN by reading)
  implication: only Brain-shaped tool names reach the hook. A failure in the hook is a failure on a Brain tool call. Raw `mcp__theo__*` names that are not `brain_*` verbs do not match.
- timestamp: 2026-11-06T08:09:30Z
  checked: official Claude Code hooks documentation, https://code.claude.com/docs/en/hooks.md, fetched 2026-11-06 (section "Block the action when a hook fails"; the installed Claude Code is 2.1.319; the field needs 2.1.295 or later).
  found: `onFailure` is a valid field on command hooks, values "continue" (default) or "block". With "block", these count as a failure: cannot start, exit code other than 0 or 2, timeout, invalid JSON output. A failure then does what exit 2 does on that event (a PreToolUse failure blocks the tool call). Without it, a PreToolUse timeout and a non-blocking error let the call go on. Exit 0 is success. (PROVEN from the fetched text; whether the running host build honours the field was not tested end to end, UNVERIFIED)
  implication: `onFailure: block` covers a hook that dies from outside (node missing, timeout, crash that exits non-zero). It does nothing for the 3 exits above, because the hook converts its own failures into exit 0. The `uncaughtException` handler and the outer `try/catch` also call `process.exit(0)`.
- timestamp: 2026-11-06T08:10:00Z
  checked: Part 8 shape helper (plan 386-37) lib/core/part8-sprout-shape.cjs.
  found: the file requires only node:fs and node:path. No guard code calls it yet (plan 386-37 summary: "no guard code calls it"). Plans 386-32 and 386-33 are to wire the shape test into the guard verdicts. (PROVEN by reading)
  implication: once wired, the sprout or body verdict is produced inside the guard chain. A guard that cannot run produces no shape verdict, so it cannot tell a sprout from a body. That is the tension in the owner decision.

Module counts behind the claim (from the plan 386-35 RCA, which recorded no skip): modules_guard_before: 172, modules_guard_after: 10, modules_hook_before: 175, modules_hook_after: 173.

## Technical Root Cause

- Site 1: scripts/part8-egress-guard-hook.cjs, function `main`: the `catch` after `require(SANITIZER_PATH)`, the `catch` after `require(GUARD_PATH)` and `classify`, the line `if (!verdictObj || typeof verdictObj !== 'object') return allow()`, the `process.on('uncaughtException', ...)` handler and the outer `try/catch`. All return exit 0.
- Site 2: lib/core/brain-client.cjs, function `callTool`: the `catch (_e)` around the guard call. After it the code goes on to `_ensureSession` and `fetch`.
- Site 3: lib/core/brain-client.cjs, function `query`: the `catch (_e)` around the guard call. After it the code calls `callTool`, which has its own belt with the same catch.
- Cause: every failure path was written fail-open on purpose (accepted risk A3 and threat T6 of Phase 239, restated in the hook header). The in-process belt follows the same posture. The comment reason was "a false block is worse than a false allow for a safety hook". The result is that the Part 8 safeguard depends on the guard loading, with no signal to the user.
- Why `onFailure: block` does not help: the hook turns each internal failure into exit 0, so the host sees success.
- Why it surfaces now: the audit (claim c, claim f) read the exits. The owner principle of 2026-11-06 (sprouts go out, bodies stay) makes the cost of fail-closed visible: a broken guard cannot tell a sprout from a body.

## Required Code Changes

<!-- Only after the owner decision. None in this plan. -->

- Change 1 (option A, plan 386-30), described in prose only:
  - Hook: when the sanitizer or the guard fails to load, or classify throws, or the verdict is not an object, exit 2 with a plain message that names the cause `guard_unavailable` and says nothing was sent. The `uncaughtException` handler and the outer catch exit 2 for a Brain-shaped tool. Garbage stdin and a tool name that is not Brain-shaped keep exit 0.
  - callTool and query(): on a guard failure return `{ error: 'egress_guard_unavailable', tool }` and make no network call (no session init).
  - Empty payload: a provably empty payload (brain_stats, brain_schema with `{}`) still proceeds, because zero bytes cannot leak. The check for empty must not depend on the guard.
  - Short-term patch: none.
  - Long-term fix: the typed reason `egress_guard_unavailable` is rendered by the shim as an honest refusal (no silent local substitute).
- Change 2 (option B): the same as Change 1 for callTool and query() only. The hook stays fail-open.
- Change 3 (option C): none. Record the accepted risk.

## Tests to Add or Update

- Test 1:
  - Type: integration
  - Location: a new tests/test-386-guard-fail-closed.cjs (plan 386-30), using the preload and require.cache doubles from this RCA
  - Given: guard load throws, classify throws, sanitizer load throws
  - When: the hook runs on a sprout, on a fake credential and on an empty payload; callTool and query() run with a fetch counter
  - Then (option A): hook exit 2 for the first two and exit 0 for the empty payload; fetch calls 0 for the first two; the result error is `egress_guard_unavailable`
  - Runner registration: tests/run-all-386.sh

## Non-Code Follow-ups

- CHANGELOG.md: plan 386-21 owns it.
- Release lockstep: applies only if a fix ships.
- Canon: Part 8. Fixture and synthetic strings only in tests. No room content in this file.
- Tri-Polar: Desktop has no PreToolUse hook, so on Desktop only the belt (Changes 1 and 2) protects. Cowork follows the CLI hook path.
- Host: the `onFailure` field needs Claude Code 2.1.295 or later (documentation). Older builds ignore it (UNVERIFIED).
- Fixture note: scratch files lived under the session scratchpad. No repo product file was edited.

## Resolution

root_cause: the hook and the belts convert every guard failure into allow (accepted risk A3 and T6 of Phase 239). `onFailure: block` never engages because the hook exits 0 on its own failures.
fix: none applied. Awaiting the owner decision.
verification: see Evidence (all rows PROVEN with test doubles; the host honouring `onFailure` end to end is UNVERIFIED).
files_changed: none
commits: see git log of this file

## Owner decision

decision: option-a
outage-count: yes

- Date: 2026-11-06
- Choice: fail closed in the hook, callTool and query() with the typed reason `guard_unavailable` (hook) and `egress_guard_unavailable` (belts). A provably empty payload still proceeds. Add a count-only local line for each outage: a timestamp, the tool name class and the failure mode. The line carries no content, no payload bytes and no tool arguments.
- Reason: no silent allow is worth a short block during a rare outage, and the count line makes the real failure rate visible because no rate is measured today.
- Hand-off to plan 386-30: implement option A and the outage count line (a small local file or event, count only). Add a test that the line carries no payload content (use a fake credential and a sprout as the payload and assert neither appears in the line).

Probability evidence (the owner asked how likely a failure is; no rate is measured today):

- Known causes: (1) a bad install or a half-finished update leaves a guard file missing or mismatched; (2) the guard load runs past the 5 s hook limit on a slow or loaded machine (the hook process loads 173 repo modules; the guard alone loads 10); (3) a future edit to the guard or its dependency chain introduces a load or classify bug.
- None observed in the plan 386-29 session. Every failure here was produced with a test double.
- One unexplained transient `room_check_unavailable` was seen in a hook test. The cause is not known and it is not shown to be a guard load failure (UNVERIFIED).
- The unreadable owner room.db is a different path (a room check, not a guard load or classify failure). Plan 386-33 handles it.
