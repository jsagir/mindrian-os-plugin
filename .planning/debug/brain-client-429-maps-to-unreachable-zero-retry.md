---
status: investigating
kind: rca
trigger: "brain-client-429-maps-to-unreachable-zero-retry"
issue_id: ""
severity: medium
surfaces: [cli, desktop, cowork]
brain_mode: unreachable
canon_parts: [8]
created: 2026-08-11T07:05:00Z
updated: 2026-08-11T07:05:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** install cache `~/.claude/plugins/cache/mindrian-marketplace/mos/2.0.0-beta.5/` @ 2.0.0-beta.5 (matches the live release; re-verify against origin/main before fixing)
- **WIRE claims probe against:** deployed Brain server `pws-brain-mcp.onrender.com` @ 2026-08-11
- **Date of audit:** 2026-08-11
- **Re-verification rule:** the code-path claim below MUST be re-verified against origin/main HEAD before a fix lands; the wire-side trigger (actual HTTP status at failure time) was NOT captured and is tagged `needs-source-reverify`.

## Current Focus

hypothesis: In callTool (lib/core/brain-client.cjs, tools/call retry loop ~line 442-515), any non-OK status that is not 403 and not 5xx returns null with ZERO retries. A 429 from the read-key rate-limit window therefore surfaces as BRAIN_UNREACHABLE ("after the bounded retry budget" - factually wrong for this path, zero retries ran). isAvailable() stays true because it hits unauthenticated /health, so the session sees "healthy Brain, unreachable tools" - the exact shape Phase 250-01 (HONEST-01) existed to kill, on a leg it did not cover.
test: Reproduce by forcing a 429 (burn the read-key window with rapid probes, or mock the fetch seam) and observe the wrapper's refusal shape.
expecting: refusalResponse('unreachable') from a single attempt, no retry sleeps, while direct /health returns 200.
next_action: Add a 429 branch to callTool - either retry-with-backoff within budget (Retry-After aware) or a distinct `rate_limited` sentinel so refusal-messaging can say the true reason. Decision 8 (honest refusal) wants the real reason named, not "unreachable".

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 2.0.0-beta.5
- Reported by: admin-sitting session 2026-08-11 morning (fresh session after the enactment night)
- Date first observed: 2026-08-11 ~06:45 local
- Related debug sessions: none direct; context in docs/2026-08-11-HANDOFF-enactment-night-and-morning-runbook.md section 3 ("Rate limits burn fast in probe-heavy sessions... the read-key window both bit tonight")

## Problem Statement

A rate-limited Brain key renders as BRAIN_UNREACHABLE with a "bounded retry budget" message, while /health shows green - the operator cannot tell a burned rate window from an outage.

## Symptoms

expected: A 429 either retries within the bounded budget (honoring Retry-After) or surfaces a distinct rate-limited refusal naming the true cause.
actual: First two brain_query calls of the fresh session (approx 06:45) returned {"status":"BRAIN_UNREACHABLE","kind":"unreachable","reason":"...after the bounded retry budget..."} instantly, twice, while curl /health returned {"status":"ok","graph":true} HTTP 200 in 0.27s. Approximately 15 minutes later the identical wrapper call succeeded ({"records":[{"self_loop_count":41}]}) with no config change.
errors: {"status":"BRAIN_UNREACHABLE","kind":"unreachable","reason":"The methodology graph is unreachable right now for brain_query (after the bounded retry budget). Larry will not fake what it would say.","command_context":"brain_query","next_moves":["retry","continue_without"]}
reproduction:
  1. Burn the read-key rate window (probe-heavy overnight session did this organically)
  2. Start a fresh CLI session; call the mindrian-brain MCP brain_query tool
  3. Observe BRAIN_UNREACHABLE while curl https://pws-brain-mcp.onrender.com/health is 200 green
started: Latent since the AVAIL-02 bounded-retry design (Phase 250-01); first witnessed 2026-08-11 morning.

## Scope and Impact

- Affected surfaces: cli, desktop, cowork (all consume brain-client.cjs)
- Affected commands: every Brain tool routed through callTool when the key's rate window is burned
- Affected users: any key hitting its window; probe-heavy sessions most exposed
- Version range: at least 2.0.0-beta.5; likely since the 250-01 retry loop landed
- Severity: medium (self-heals when the window resets, but misdiagnoses as outage and wastes operator time - cost this sitting ~15 min of diagnosis)
- Blast radius: refusal-messaging.cjs honesty contract (Decision 8); any monitoring that keys off "unreachable" counts

## Eliminated

- hypothesis: Stale/wrong key resolution in the MCP server process (rung-3 cwd .env holds a different 37-char key from June)
  evidence: env var (rung 1) and ~/.mindrian.env (rung 2) hash-match (fecf75e8188b, len 40); rung order means the working key wins in every process; brain_stats through the same wrapper process succeeded during the failure window
  timestamp: 2026-08-11T07:00:00Z
- hypothesis: Part 8 egress guard blocking the runbook Cypher as room content (alias-collapse audit filed into rethinking-mindrianos room last night contains these exact statements)
  evidence: part8-egress-guard classify on the exact failing cypher returns {"verdict":"allow","class":"move_set"}; fresh-process query() succeeds from both cwds
  timestamp: 2026-08-11T07:02:00Z
- hypothesis: brain_query not registered on the HTTPS surface (the 2026-08-10 audit's finding)
  evidence: live tools/list shows brain_query registered (CONTRACT-05 landed it); direct HTTPS tools/call brain_query returned records during diagnosis
  timestamp: 2026-08-11T06:58:00Z

## Evidence

- timestamp: 2026-08-11T06:45:00Z
  checked: two wrapper brain_query calls at session start
  found: instant BRAIN_UNREACHABLE, both calls
  implication: failure present at session start
- timestamp: 2026-08-11T06:50:00Z
  checked: curl /health direct
  found: 200 {"status":"ok","graph":true} in 0.27s
  implication: server up; failure is client-path or auth/rate tier
- timestamp: 2026-08-11T06:55:00Z
  checked: brain_stats through the SAME long-running wrapper process
  found: full stats payload returned
  implication: wrapper transport + key valid mid-window for at least some calls; per-tool or per-moment failure, consistent with a rate window closing/reopening
- timestamp: 2026-08-11T07:03:00Z
  checked: identical wrapper brain_query call ~15 min after first failure
  found: success, {"records":[{"self_loop_count":41}]}
  implication: transient condition cleared with time - rate-window reset fits; no restart, no config change
- timestamp: 2026-08-11T07:04:00Z
  checked: callTool source, install cache 2.0.0-beta.5, lib/core/brain-client.cjs tools/call loop
  found: non-OK handling is exactly - 403 returns tier_denied sentinel; 5xx retries within budget; EVERY other status (429 included) drains body and returns null immediately, zero retries; wrapper maps null to refusalResponse('unreachable')
  implication: code-path claim stands independent of what this morning's actual status was; 429 mislabeling is real by inspection
