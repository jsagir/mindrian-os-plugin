---
status: gathering
kind: rca
trigger: "brain-stats-connector-misreports-unreachable-under-load"
issue_id: ""
severity: medium
surfaces: [desktop]
brain_mode: unreachable
canon_parts: []
created: 2026-08-26T08:36:49Z
updated: 2026-08-26T08:36:49Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** `origin/main` HEAD @ commit `919ccaa5` (this repo, as of the
  observation below; not re-verified against a fresher HEAD)
- **WIRE claims probe against:** deployed Brain server `pws-brain-mcp.onrender.com`, live,
  2026-08-26, observed via both the `claude.ai` Brain connector and direct HTTP in the same
  minute
- **Date of audit:** 2026-08-26
- **Re-verification rule:** the code-path lead below (Phase 259 / TRUST-01's 429 handling in
  `lib/core/brain-client.cjs`) has NOT been confirmed as the actual cause of this specific
  observation - it is a plausible, same-problem-class lead, not a confirmed root cause. Tag
  `needs-source-reverify` until a `/gsd:debug` session actually reproduces this against a
  captured request/response.

## Current Focus

hypothesis: `mcp__plugin_mos_mindrian-brain__brain_stats` (the MCP connector wrapper this
session called it through) surfaces a generic `BRAIN_UNREACHABLE` for a condition that is not
actually network unreachability - most likely a rate-limit (429) response, or a session/tier
gate response, that isn't being classified into one of the existing distinct sentinels
(`rate_limited`, `tier_denied`) before reaching the caller-facing message.
test: not yet reproduced with a captured request/response pair - only observed as a symptom
during an unrelated Theo Phase 6 session.
expecting: if the hypothesis holds, a live `brain_stats` call made during/near a 429 window on
the same key should reproduce the same misreport, and `lib/core/brain-client.cjs`'s handling
for whatever `brain_stats`'s specific call path is (may not be the same `callTool`/tools-call
path shown in Evidence below) will show it falling through the generic `return null` /
unreachable branch instead of the existing `rate_limited` sentinel path.
next_action: reproduce directly - call `brain_stats` repeatedly against the live key while a
separate process holds it under 429 pressure (the same key-level rate limiting Theo's own
Phase 6 parity harness measured this session: 120 req/60s per key, `Retry-After` honored),
and capture the exact HTTP status/body `brain_stats`'s own call path receives when the
BRAIN_UNREACHABLE message is produced.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 2.0.0-beta.12
- Reported by: Theo Phase 6 execution session (cross-repo finding, not this repo's own QA pass)
- Date first observed: 2026-08-26
- Related debug sessions: none found under `.planning/debug/` matching brain-unreachable/
  brain-stats keywords as of this filing

## Problem Statement

`mcp__plugin_mos_mindrian-brain__brain_stats` reported `BRAIN_UNREACHABLE` in a session where
the live production Brain (`pws-brain-mcp.onrender.com`) was demonstrably reachable and
answering through other paths in the same minute - a false-negative reachability report, not
an actual outage.

## Symptoms

expected: `brain_stats` returns real stats data, or (if genuinely rate-limited/tier-denied)
returns one of the existing distinct sentinels this repo already built for exactly this
purpose (`rate_limited`, `tier_denied`) - never the generic unreachable message when the
service is actually up.
actual: `brain_stats` (called via the `mcp__plugin_mos_mindrian-brain__` connector) returned
`BRAIN_UNREACHABLE`. In the same minute, a Theo Phase 6 executor session independently
observed `brain_stats` answering HTTP 200 while five separate graph-read tool calls against
the same key answered HTTP 429 - i.e. the service and at least the `brain_stats` surface were
demonstrably up, not unreachable, in that same time window.
errors: exact `BRAIN_UNREACHABLE` message text not captured verbatim - the observing session
(a Theo Phase 6 executor, different repo) reported the symptom in its own SUMMARY.md rather
than pasting the raw connector response. This RCA is filed from that secondhand but
specific report, not a fresh direct reproduction. Flagged as the first gap to close.
reproduction:
  1. Call `mcp__plugin_mos_mindrian-brain__brain_stats` while the shared Brain key is under
     or near its 429 window (per Theo's own measurement this session: 120 req/60s/key)
  2. Independently confirm the service is up (e.g. via direct HTTP, or Theo's own
     `lib/core/brain-client.cjs` read-tier call, as the observing session did)
  3. Compare the two results in the same time window
started: first observed 2026-08-26, during Theo Phase 6 (06-09) execution. Not confirmed
whether this is a new regression or a long-standing gap - no `first-bad version` known yet.

## Scope and Impact

- Affected surfaces: desktop (the `claude.ai` Brain connector path) - not yet checked against
  the CLI/stdio shim path or Cowork
- Affected commands: `brain_stats` confirmed; unknown whether other `mcp__plugin_mos_mindrian-
  brain__*` tools share the same misclassification
- Affected users: unknown - depends on whether the trigger is genuinely rate-limit pressure
  (would affect any user sharing a busy key) or something narrower
- Version range: observed at 2.0.0-beta.12; not yet bisected
- Severity: medium - a false "Brain unreachable" message actively misleads the honest-refusal
  design this repo's own Canon (Part 8's "honest refusal everywhere" decision) depends on: an
  honest refusal is supposed to mean the Brain genuinely can't help, not "we misclassified a
  429". Not blocker-severity because it degrades trust in the message rather than breaking
  functionality outright.
- Blast radius: if the root cause is the same class of bug Phase 259/TRUST-01 already fixed
  for the generic `tools/call` path (429 falling through to a bare `return null` instead of a
  distinct `rate_limited` sentinel - see Evidence below), the blast radius is "any code path
  that didn't get the same TRUST-01 fix", which needs enumerating, not assumed to be only
  `brain_stats`.

## Eliminated

(none yet - investigation not started)

## Evidence

- timestamp: 2026-08-26T08:36:49Z
  checked: `lib/core/brain-client.cjs` around the `429` handling block (read directly, lines
    ~617-650 as of `origin/main` @ 919ccaa5)
  found: there IS an existing, deliberate fix for exactly this failure shape, already shipped:
    a comment at line ~623-627 states "Phase 259 (TRUST-01): 429 previously fell through the
    generic non-OK ladder into the bare `return null` at the bottom of this block, which the
    MCP shim renders as BRAIN_UNREACHABLE with copy claiming a retry budget was spent -
    factually false, since zero retries ran on that leg." The fix (D-01/D-02/D-03 documented
    inline) honors `Retry-After`, retries up to a budget, then returns a distinct
    `rate_limited` sentinel - never the bare `null` that becomes `BRAIN_UNREACHABLE`.
  implication: this is the same problem CLASS, already diagnosed and fixed once in this exact
    file. Two live possibilities, not yet distinguished: (a) `brain_stats`'s specific call path
    doesn't route through this same `callTool`/`tools/call` branch and never got the TRUST-01
    fix, or (b) it does route through this code and the fix has a gap this session's specific
    trigger exposes. Either is a real, separate finding from "Phase 259 already solved this."

## Technical Root Cause

Not yet confirmed - `status: gathering`. The lead in Evidence above is a strong same-class
match but is explicitly NOT verified against a captured reproduction of this specific
`brain_stats` observation. Do not treat the Phase 259 fix as having already covered this case
until `next_action` above is actually run.

## Required Code Changes

Not yet known - pending root cause confirmation.

## Tests to Add or Update

Not yet known - pending root cause confirmation. If the root cause matches Evidence's lead
(a code path that bypassed the TRUST-01 429-to-`rate_limited` fix), the test to add is an
integration test that drives `brain_stats`'s specific call path through a mocked/live 429 and
asserts it returns `rate_limited`, not `BRAIN_UNREACHABLE` / null - mirroring whatever test
already covers the `callTool` path's TRUST-01 fix (find and reference it directly once
located, rather than writing a parallel test that could drift).

## Non-Code Follow-ups

- knowledge-base.md: not applicable yet - only add on resolve, per the template.
- Cross-repo note: this finding originated in a Theo Phase 6 execution session (a separate
  repo, `/home/jsagi/Theo`), which independently measured the Brain's real rate-limit
  behavior (120 req/60s/key, `Retry-After` always set) while building its own parity harness.
  That measurement may be useful corroboration for whoever picks this session up - it's not
  filed here as a duplicate, just noted as related cross-repo context.

## Resolution

root_cause: (pending)
fix: (pending)
verification: (pending)
files_changed: (pending)
commits: (pending)
