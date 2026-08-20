---
status: resolved
kind: rca
trigger: "brain-client-429-maps-to-unreachable-zero-retry"
issue_id: ""
severity: medium
surfaces: [cli, desktop, cowork]
brain_mode: unreachable
canon_parts: [8]
created: 2026-08-11T07:05:00Z
updated: 2026-08-20T00:00:00Z
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

## Resolution

**Shipped fix, per requirement:**

- **TRUST-01, transport leg** -- `lib/core/brain-client.cjs::callTool()` gained a 429 branch
  (Phase 259 Plan 01). It reads `Retry-After` fresh per attempt, retries up to 3 times (4
  attempts total, D-01), falls back to 500/1000/2000ms exponential backoff when the header is
  absent or unparseable (D-02), and on exhaustion returns a distinct sentinel
  `{ error: 'rate_limited', tool, retry_after_s, attempts, message }` -- never `null`, never
  `BRAIN_UNREACHABLE` (D-03). The budget is a SEPARATE counter and env-var pair
  (`MINDRIAN_BRAIN_RATELIMIT_RETRY_MAX`/`_BASE_MS`/`_MAX_WAIT_MS`) from AVAIL-02's transport
  retry budget, so an operator who disables one does not silently disable the other.
- **TRUST-01, refusal-rail leg** -- `lib/core/refusal-messaging.cjs` gained a fifth
  `REFUSAL_KINDS` member, `rate_limited` -> status `BRAIN_RATE_LIMITED` (Phase 259 Plan 02,
  F-09 Option B). This is exactly what this RCA's own `next_action` line asked for: "so
  refusal-messaging can say the true reason." A rate limit is now named honestly instead of
  coerced into the `unreachable` kind.
- **TRUST-02, floor-script leg** -- `scripts/check-flagship-floor.cjs`'s `evaluateFloor` gained
  a third verdict, `VOID` (Phase 259 Plan 03), triggered by any hard error, timeout, or
  malformed response on either probe of a row (D-05), outranking both PASS and MISS so a probe
  that did not cleanly succeed is never silently scored as a floor miss. Exit code 3, never
  soft (D-07). Not part of this RCA's original scope, but the same root defect class (a
  catch-all that silently absorbs an unhandled status) motivated closing it in the same phase.

**WIRE claim `needs-source-reverify` tag: DISCHARGED.** The original filing could not capture
the actual wire-side trigger (the Brain's 429 behavior at failure time). Read against the dev
checkout of `jsagir/ProblemsWorthSolving-Brain` (`src/http/rate-limit.mjs` lines 112-131,
`perKeyRateLimit`, mounted on `/mcp` per `src/http/app.mjs` lines 7 and 23):

- A fixed-window counter keyed per API key (`BRAIN_HTTP_RATE_WINDOW_MS`, default
  `DEFAULT_WINDOW_MS = 60_000`; `BRAIN_HTTP_RATE_MAX`, default `DEFAULT_MAX = 120`) tracks
  requests per key per window in an in-process `Map`.
- Past the budget it always sets a `Retry-After` header (`Math.max(1, Math.ceil((b.resetAt -
  now) / 1000))` -- integer delay-seconds, floored at 1, bounded by the window) and responds
  `res.status(429).json({ error: { code: -32005, message: 'Rate limit exceeded' } })` -- a
  plain JSON body, NOT Server-Sent Events.
- This confirms the hypothesis's shape exactly: a burned per-key window produces a bare 429
  with a `Retry-After` header and a JSON-RPC-style error body, the precise input the 259-01
  branch above now retries against and eventually reports honestly.

**CODE claim re-verification rule: DISCHARGED.** The original citation ("~line 442-515", read
against the install cache at 2.0.0-beta.5) is superseded by a read of the dev checkout at
`origin/main`/HEAD, where the same status ladder now sits (post-259-01 fix, current line
numbers) at `lib/core/brain-client.cjs`:
- `:595` -- `if (!toolRes.ok)`, the ladder entry point.
- `:604` -- `toolRes.status === 403`, the pre-existing zero-retry sentinel branch this fix's
  429 branch copied the shape of.
- `:635`-`:657` -- the NEW 429 branch (the fix): retries within the rate-limit budget, mints
  `rate_limited` on exhaustion.
- `:672` -- the pre-existing 5xx retry-within-budget branch, unmodified.
- `:676` -- `return null`, the bug site this RCA originally flagged, still present and still
  correct for the statuses that remain genuinely unhandled (anything that is not 403, not 429,
  and not a 5xx in-budget retry). The 429 hole this RCA reported is closed; the catch-all
  itself is intentional per the standing do-not-widen fence (247-02) and is not a defect.

**Verification named:** `bash tests/run-all-259.sh` green (4 suites, 41 assertions, no-em-dash
fence clean); `node --test tests/test-250-transport-retry.cjs` green (regression, null contract
unchanged: 5xx-exhausted still `null`, 403 still `tier_denied` in one attempt); `node --test
tests/test-249-floor-gate.cjs` green (regression, all pre-existing `evaluateFloor`/
`parseOverrideFile` assertions unchanged). The live-run checkpoint result (Phase 259 Plan 04
Task 3) is recorded in `259-04-SUMMARY.md`.

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
