---
status: gathering            # gathering | investigating | fixing | resolved
kind: rca                    # rca | debug-session | qa-sweep
trigger: "part8-egress-guard-blocks-pws-brain-mcp-unconditionally"
issue_id: ""
severity: high                # this blocks ALL pws-brain-mcp reads, not an edge case
surfaces: [cli]                # observed on cli; desktop/cowork not tested
brain_mode: full-loop          # not actually the Brain's own refusal mode -- blocked before reaching it
canon_parts: [8]                # Part 8, Graph Boundary -- the guard this hook is supposed to enforce
created: 2026-08-27T00:00:00Z
updated: 2026-08-27T00:00:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: `part8-egress-guard-hook.cjs` (a PreToolUse hook) is blocking every
  `pws-brain-mcp` tool call in this session/room unconditionally, independent of
  the actual argument content -- i.e. it is firing as a session-level or
  room-level block rather than doing real content inspection per call.
test: not yet run -- seeded as a todo, not investigated this session.
expecting: if true, reading the hook's own source will show either (a) a
  condition that is trivially always-true for this session/room (a stale flag,
  a misread room-binding state, a config value defaulting to "block" rather
  than "evaluate"), or (b) the content-inspection logic itself is broken and
  always classifies input as "may leak unknown" regardless of what it actually
  contains.
next_action: open via `/gsd:debug` in MindrianOS-Plugin. Read
  `part8-egress-guard-hook.cjs` directly, reproduce with the exact three calls
  below in a fresh session bound to the same room, and determine whether the
  block is genuinely unconditional or narrowly scoped to something these three
  calls all happen to share (e.g. all three touch `operate_framework`/
  `normalize_framework_name` specifically -- check whether OTHER `pws-brain-mcp`
  tools in the same session are also blocked, or only these).

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin (the hook lives here; the block was
  OBSERVED from a session bound to the `noga-mventures` room, a real venture
  room, not a fresh/unbound session)
- Reported by: a peer Claude Code session (`jsagi-0f`), relayed via
  cross-session message at the request of Jonathan Sagir, who was live-testing
  Theo's newly user-scoped MCP server against `pws-brain-mcp` side by side
- Date first observed: 2026-08-27
- Room: `noga-mventures` (`~/MindrianRooms/noga-mventures`), an existing,
  previously-active venture room (last real content update 2026-08-26), not a
  fresh or ambiguous room
- Related: this was found as a side effect of a deliberate Theo/Brain
  comparison test, not a dedicated audit -- the actual bug is orthogonal to
  what was being tested for

## Problem Statement

`part8-egress-guard-hook.cjs`, a `PreToolUse` hook, blocked every one of three
`pws-brain-mcp` tool calls made in one session, each with the identical
"this may leak unknown" F.1 card (Reformulate / Cancel / Free-Text), even
though the calls used two different framework-name argument strings and one
was a different tool entirely. The block fired before any of the calls
executed, so `pws-brain-mcp` returned zero actual data across the whole test.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: `part8-egress-guard-hook.cjs` inspects each tool call's actual
  argument content and blocks only calls that genuinely risk carrying
  user-specific/room-specific bytes across the Brain boundary (Canon Part 8).
  A generic framework-name lookup like `normalize_framework_name("Six Thinking
  Hats")` -- a well-known public methodology name, not room content -- should
  not trip a leak guard.

actual: all three calls were blocked with the identical card:
  1. `normalize_framework_name("Six Thinking Hats")` -- blocked.
  2. `operate_framework("Six Thinking Hats", step 1)` -- blocked.
  3. `operate_framework("Bono", step 1)` -- blocked (different argument string
     than call 2, same block).
  Reformulating the query text between attempts did not change the outcome --
  the reporting session explicitly noted this and read it as evidence of a
  session-level block rather than a content-sensitivity flag.

errors: no exception/crash. The hook fired its own designed refusal card
  (F.1, Reformulate/Cancel/Free-Text) each time -- this is the hook working
  AS DESIGNED for a call it believes is risky, the open question is WHY it
  believes all three of these specific, low-risk calls are risky.

reproduction: not yet independently reproduced by this RCA (relayed secondhand
  from the peer session's own live test, not verified by re-running it here).
  Steps as reported:
  1. In a session bound to the `noga-mventures` room, call
     `mcp__pws-brain-mcp__normalize_framework_name` with argument
     `"Six Thinking Hats"`.
  2. Call `mcp__pws-brain-mcp__operate_framework` with `"Six Thinking Hats"`,
     step 1.
  3. Call `mcp__pws-brain-mcp__operate_framework` with `"Bono"`, step 1.
  Observed: all three blocked by `part8-egress-guard-hook.cjs`'s F.1 card,
  identical wording each time. Untested: whether a DIFFERENT `pws-brain-mcp`
  tool (e.g. `brain_search`, `find_frameworks_for_problem_type`) is also
  blocked in the same session, which would confirm "unconditional for this
  session" versus "specific to `operate_framework`/`normalize_framework_name`".

started: first noticed 2026-08-27, this session. Unknown whether pre-existing
  or a recent regression -- no prior debug session in this repo's
  `.planning/debug/` references `part8-egress-guard-hook.cjs` by name (not
  independently verified by grep in this seed; check when investigating).

## Scope and Impact

- Affected surfaces: cli (only surface observed; desktop/cowork not tested)
- Affected commands: any Larry interaction that calls
  `normalize_framework_name` or `operate_framework` on `pws-brain-mcp`, at
  minimum; possibly all `pws-brain-mcp` tools in an affected session
- Affected users: unknown scope -- one venture room (`noga-mventures`),
  one session, three calls. Not yet known whether this is room-specific,
  session-specific, or a broader regression affecting all `pws-brain-mcp`
  traffic
- Version range: not captured in this seed -- get the plugin version from the
  reporting session's own `claude mcp get` or startup banner when
  investigating
- Severity: high if confirmed broad -- a guard that blocks 100% of
  `pws-brain-mcp` reads regardless of content makes the Brain effectively
  unusable in the affected session/room, which is a much larger functional
  regression than a false positive on one genuinely ambiguous query
- Blast radius: unknown until scoped; could be this room only, this session
  only, or a real regression in the Part 8 guard's classification logic
  affecting every room

## Eliminated
<!-- APPEND only - prevents re-investigating -->

(none yet -- not investigated)

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-08-27T00:00:00Z
  checked: peer session `jsagi-0f`'s own live test, relayed via cross-session
    message (not independently re-run by this RCA)
  found: three `pws-brain-mcp` calls, two distinct argument strings, one
    different tool, all blocked identically by `part8-egress-guard-hook.cjs`'s
    F.1 card; reformulating the query text did not change the outcome
  implication: consistent with an unconditional or near-unconditional block
    for this session, inconsistent with the guard performing real per-call
    content classification -- but not yet confirmed against the hook's actual
    source or reproduced independently

- timestamp: 2026-08-27T00:00:00Z
  checked: the SAME session's equivalent Theo calls
    (`search_theo_chunks_fulltext`, `theo_neighborhood`) for the same
    underlying question
  found: both succeeded with no block and returned real structured content
  implication: rules out a session-wide MCP-call block of any kind -- the
    block is specific to `pws-brain-mcp` (or specific to this hook), not a
    general tool-call failure in that session

## Technical Root Cause

PENDING. Not yet investigated -- this file is a seed for a future
`/gsd:debug` session, not a completed diagnosis.

## Required Code Changes

PENDING -- depends on root cause. Candidate starting points for the
investigator, not prescriptions:
- Read `part8-egress-guard-hook.cjs` directly and find the actual condition
  that decides "may leak unknown" versus "safe to pass through" for a
  `pws-brain-mcp` call.
- Check whether the guard's classification depends on room-binding state that
  might be stale, absent, or misread for an established room like
  `noga-mventures` -- e.g. does it require some per-room allowlist or context
  flag that this room genuinely lacks, versus a bug in reading a flag it
  should have.
- Test whether other `pws-brain-mcp` tools in the same room/session are also
  blocked, to determine if this is scoped to `operate_framework`/
  `normalize_framework_name` specifically or is a true unconditional block.

## Tests to Add or Update

PENDING -- depends on root cause. At minimum, once diagnosed: a test that a
generic, non-room-specific framework-name lookup (e.g.
`normalize_framework_name` on a well-known public framework name) does NOT
trip the Part 8 egress guard in a normal, established room.

## Non-Code Follow-ups

- CHANGELOG.md: add a Fixed entry under the target version, once fixed.
- knowledge-base.md: on resolve, add the summary block.
- Canon: this touches Part 8 directly (canon_parts: [8] above) -- if the fix
  changes classification logic, update `docs/CANON-PHASE-MAP.md` in the same
  commit per this repo's own standing rule.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: PENDING
fix: ""
verification: ""
files_changed: []
commits: []
