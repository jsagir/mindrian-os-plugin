# Phase 259: Plugin-Side Gate Trust (parallel-safe, early) - Research

**Researched:** 2026-08-20
**Domain:** HTTP transport error taxonomy (429 / Retry-After) in `lib/core/brain-client.cjs`, and gate-verdict honesty in `scripts/check-flagship-floor.cjs`
**Confidence:** HIGH (this is a code-archaeology phase; every load-bearing claim below was read out of this repo or the Brain repo this session, not recalled)
**Scope note:** Lean, implementation-grounded pass. The 8 policy decisions D-01..D-08 are LOCKED and are not re-litigated anywhere below.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### 429 retry policy (TRUST-01)
- **D-01:** 3 bounded retries. When a 429 response carries a `Retry-After` header, honor
  it exactly for the wait between attempts.
- **D-02:** When `Retry-After` is absent, fall back to exponential backoff starting at
  500ms (500ms, 1s, 2s across the 3 attempts).
- **D-03:** After all 3 retries exhaust and the request still 429s, `brain-client.cjs`
  reports a NEW distinct sentinel: `rate_limited`. Never falls through to the generic
  `BRAIN_UNREACHABLE` -- TRUST-01's own wording names `rate_limited` as the target state,
  and distinguishing "temporarily overloaded" from "actually down" changes both the
  honest-refusal message shown and the operator's response.
- **D-04:** The forced-429 test reuses `tests/helpers/brain-capture-server.cjs` (the
  existing mock-server helper that already mocks the Brain HTTP surface for
  `tests/test-239-query-egress-canary.cjs`), as a new dedicated test file. Do not stand up
  a second mock-server helper.

#### VOID trigger scope (TRUST-02)
- **D-05:** VOID covers all three failure modes on a probe row, not just hard errors:
  hard errors (429, 5xx, connection refused), timeouts, AND malformed/unparseable
  response data. FLOOR-03 elsewhere in REQUIREMENTS.md says "verify, never predict" --
  any probe that didn't cleanly succeed should VOID the run, not just outright failures.
- **D-06:** VOID output names every failed row plus which of the 3 trigger types caused
  it (hard-error / timeout / malformed) -- never a bare "VOID" with no detail. Matches this
  milestone's honest-refusal doctrine: the operator needs an actionable re-run, not a
  status to go digging through logs for.
- **D-07:** VOID is a hard non-zero exit code, not a soft exit-0-with-status-text. Matches
  FLOOR-01's own language ("exits 0 on a window-fresh run") -- non-zero is the implied
  failure/void signal, and this prevents any automation from silently treating a VOID run
  as a completed floor check.
- **D-08:** VOID always requires a human to explicitly re-run the floor check -- no
  auto-retry. A VOID likely signals something genuinely wrong (Brain overloaded, network
  issue); auto-retrying a floor-ratification script risks silently retrying past a real
  problem, which contradicts the "verify, never predict" discipline this whole milestone
  runs on.

### Claude's Discretion
- Exact `rate_limited` sentinel's shape/property names beyond "a new distinct sentinel" --
  planner's call, consistent with how `BRAIN_UNREACHABLE` and other existing sentinels are
  already shaped in `brain-client.cjs`.
- Exact VOID output format (JSON, plain text, table) -- planner's call, should be
  consistent with `check-flagship-floor.cjs`'s existing PASS/FAIL/MISS output conventions.

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (verbatim, `.planning/REQUIREMENTS.md`) | Research Support |
|----|------------------------------------------------------|------------------|
| TRUST-01 | brain-client.cjs handles 429 honestly: a rate_limited sentinel or bounded Retry-After-aware retry - never BRAIN_UNREACHABLE with zero retries; proven by a forced-429 test. | F-01 (exact bug site, line 551), F-02 (existing retry machinery), F-03 (sentinel precedent + zero downstream coercion), F-04 (VERIFIED live wire shape of the Brain's own 429), F-08 (mock-server extension path), Pattern 1, Pattern 2 |
| TRUST-02 | check-flagship-floor.cjs voids on probe failure: a run containing probe-failure rows reports VOID (re-run), never a false MISS/RED. | F-05 (the false-MISS site), F-06 (`brainCall` failure shapes + the discarded error kind), F-07 (exit-code space), F-11 (test-suite contract), Pattern 3, Pattern 4 |

Related, not owned by this phase but constrained by it: FLOOR-01 ("exits 0 on a
window-fresh run (no probe failures, per TRUST-02)"), FLOOR-03 ("verify, never predict"),
and Phase 258's RECON-04 (see F-12).
</phase_requirements>

## Summary

Two independent one-file fixes on two code paths that never touch each other. TRUST-01
lives in `lib/core/brain-client.cjs::callTool()`, whose non-OK-status ladder handles 403
(sentinel) and 5xx (retry) and then drops every other status -- 429 included -- into a bare
`return null` at line 551, which the shim renders as `BRAIN_UNREACHABLE`. TRUST-02 lives in
`scripts/check-flagship-floor.cjs::evaluateFloor()`, which converts any probe row lacking a
clean result into `verdict: 'MISS'`, so a rate-limited or timed-out probe is indistinguishable
from a framework that genuinely misses the floor. `check-flagship-floor.cjs` does NOT use
`brain-client.cjs` at all -- it uses `brainCall` imported from `scripts/build-brain-census.cjs`
(line 53). Fixing one does not fix the other, and neither is downstream of the other.

The single highest-value discovery this session is that the 429 wire shape is not a guess.
The Brain's own limiter (`src/http/rate-limit.mjs` in `jsagir/ProblemsWorthSolving-Brain`,
read this session) answers 429 on `/mcp` past 120 requests per 60s per key, and it ALWAYS
sets `Retry-After` as an integer delay-seconds string equal to the remaining window, floored
at 1 and bounded above by the window length (60s at defaults). The body is JSON
(`{"error":{"code":-32005,"message":"Rate limit exceeded"}}`), not SSE. So D-01's
"honor Retry-After exactly" is a live path, not a defensive branch, and D-02's fallback is
the branch that fires only if the limiter is ever fronted by a different edge (Cloudflare,
Render) that omits the header. The floor run itself issues 56 requests (28 ratified
frameworks x 2 probes -- confirmed by running the local enumerator), which sits under the
120/60s budget on a fresh window but not if any other Brain traffic already burned it. That
is exactly why FLOOR-01 says "window-fresh run".

The one genuine scope judgement for the planner is whether TRUST-01 stops at the
`brain-client.cjs` sentinel (minimal, zero blast radius, satisfies the requirement's literal
text) or also lands a 5th refusal kind in `lib/core/refusal-messaging.cjs` (satisfies D-03's
own stated rationale, "changes the honest-refusal message shown", at the cost of amending a
byte-locked 4-member frozen enum and its pinned test). Both options are costed in F-09.

**Primary recommendation:** Add a dedicated 429 branch at `brain-client.cjs:539` (immediately
after the 403 block, before the generic drain-and-null), with its OWN retry constants and env
names -- never reuse AVAIL-02's `MINDRIAN_BRAIN_RETRY_*` -- and extract the wait computation
into a pure exported helper so the exact 500/1000/2000 schedule and the `Retry-After` parse
are unit-tested with zero sleeps. In parallel, add an `errorKind` field to
`build-brain-census.cjs::brainCall()`'s failure returns, carry it through `probeFramework`,
and give `evaluateFloor` a `VOID` verdict with its own `voidCount` and exit code 3.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| 429 detection, Retry-After parsing, bounded backoff | Plugin HTTP transport (`lib/core/brain-client.cjs::callTool`) | -- | The tools/call POST is the single HTTP seam every Brain tool flows through after session establishment; AVAIL-02 already placed the transport retry budget here by ruling. A retry anywhere higher (shim, refusal renderer, command) would fire per-caller and multiply. |
| `rate_limited` sentinel construction | Plugin HTTP transport | -- | Sentinel objects are minted where the status is observed (`tier_denied` at :537, `invalid_key` in `_ensureSession`), never re-derived by callers. |
| Human-facing rate-limited refusal copy | Refusal chokepoint (`lib/core/refusal-messaging.cjs`) | MCP shim (`bin/mindrian-brain-mcp-client.cjs`) | Phase 250-01 made this module the single source of refusal wire shapes and Larry prose. In scope only under Option B (F-09). |
| Probe execution + HTTP failure classification | Census HTTP client (`scripts/build-brain-census.cjs::brainCall`) | Floor script wrapper (`probeFramework`) | `brainCall` is the only place the thrown error object and the HTTP status are both in hand. Classification cannot be reconstructed downstream from `bodyText` without string-sniffing. |
| VOID verdict, counting, exit code | Pure gate logic (`check-flagship-floor.cjs::evaluateFloor`) | CLI renderer (`main()`) | `evaluateFloor` is already the pure, exported, fixture-injected decision function; keeping the verdict there is what makes the VOID path hermetically testable at all. |
| Deciding whether to re-run a VOID floor check | Human operator | -- | D-08, locked. No code tier owns this. |

## Project Constraints (from CLAUDE.md)

Directives extracted this session that bind this phase's plan. Treat with the same authority
as the locked decisions above.

| Directive | Applies here as |
|-----------|-----------------|
| **No em-dashes anywhere** (hyphens only) | Every new file and every edited file. Both `tests/run-all-249.sh` and `tests/run-all-250.sh` carry a `grep -P '\x{2014}'` fence over an explicit target list; a `tests/run-all-259.sh` must carry the same fence over this phase's own target list. |
| **Canon Part 8 (LOCAL -> BRAIN: no user data)** | This phase touches Brain HTTP transport but adds zero new outbound payload. The 429 branch reads a response header and returns a sentinel; the VOID branch reads a response body and prints a truncated excerpt LOCALLY. **Nothing recommended below crosses the Part 8 boundary.** One live hazard is noted in Security Domain: `bodyText` excerpts printed into VOID output are Brain-authored, not user-authored, so they are safe to print but must still be length-capped. |
| **Canon Part 7 (reuse before build)** | The spine of D-04. Also applies to the `errorKind` classifier: reuse `brainCall`'s existing return shape, add a field; do not mint a second HTTP client in the floor script (its header already promises it mints none). |
| **Tri-polar design rule (CLI / Desktop / Cowork)** | `brain-client.cjs` is shared by all three surfaces, so TRUST-01 lands on all three at once with no surface-specific code. `check-flagship-floor.cjs` is a maintainer script, CLI-only by nature -- state that as a deliberate call, not an oversight. |
| **CJS only, no TypeScript; Node built-ins only; no Commander/yargs** | No new dependency is needed or recommended for this phase (see Standard Stack). |
| **GSD workflow enforcement** | All edits go through `/gsd-execute-phase`; no direct edits. |
| **QA/RCA reporting** | `.planning/debug/brain-client-429-maps-to-unreachable-zero-retry.md` is the OPEN RCA this phase closes. On resolve it moves to `.planning/debug/resolved/` and gets a summary block in `.planning/debug/knowledge-base.md`. Make this an explicit plan task -- it is a repo rule, not an optional courtesy. |
| **Dev-research compositing (rethinking-mindrianos)** | This phase touches MindrianOS's own architecture, so its reasoning trail is also due in `~/MindrianRooms/rethinking-mindrianos/research/` and mirrored to `mindrianOS/research/`, cross-linked back to this phase. |
| **Verification** | `bash tests/run-all-259.sh` after edits; the phase-numbered aggregator is the convention (250, 251, 252 all have one). |

**Project skills:** `.claude/skills/agentshield` is the only skill on disk (a read-only,
zero-network plugin self-scan over MCP tool descriptions, hooks, skills, CLAUDE.md
permissions, and package.json deps). It does not scan `lib/core/*.cjs`, so this phase does
not trip it and does not need to extend it. (CLAUDE.md's Project Skills table still lists
`docu-optimizer`, which is not on disk -- a pre-existing doc drift, out of scope here.)

## Verified Code Map

Every finding below was read from disk this session at the cited line numbers.

### F-01 (VERIFIED, code read) -- the exact TRUST-01 bug site

`lib/core/brain-client.cjs::callTool()`, non-OK ladder inside the retry loop:

| Line | Behavior |
|------|----------|
| 482 | `for (let attempt = 0; ; attempt += 1) {` -- the AVAIL-02 retry loop |
| 500-508 | thrown fetch error -> retry within budget, else `return null` |
| 511 | `if (!toolRes.ok) {` |
| 520-538 | `status === 403` -> `return { error: 'tier_denied', tool: toolName, message: message }`, zero retries |
| ~542 | drain body via `await toolRes.arrayBuffer()` (undici keep-alive socket release; load-bearing on Windows) |
| 547-550 | `status >= 500 && < 600 && attempt < retryMax` -> `_sleep(baseMs * 3^attempt)`, continue |
| **551** | **`return null;` -- every other non-OK status, 429 included. This is the bug.** |

`null` is then rendered as `refusalResponse('unreachable')` by
`bin/mindrian-brain-mcp-client.cjs` (lines 123, 135, 151, 163, 175 and the brain_ask branch
at 96-104), whose copy says "after the bounded retry budget" -- factually false on this leg,
since zero retries ran. That exact string is quoted in the RCA's captured error payload.

**Recommended insertion point: line 539**, immediately after the 403 block closes and BEFORE
the shared drain at ~542. Reason: the new branch needs `toolRes.headers.get('retry-after')`
and then must drain its own body, exactly as the 403 branch consumes its own body via
`toolRes.text()`. Placing it after the drain would work too (headers survive body
consumption) but splits the branch's cleanup across two sites.

### F-02 (VERIFIED, code read) -- existing retry machinery, and why NOT to reuse it

`brain-client.cjs` lines 43-63:

```
const RETRY_MAX_DEFAULT = 2;        // 2 retries = 3 attempts total
const RETRY_BASE_MS_DEFAULT = 300;  // 300ms, then 900ms (base * 3^attempt)
_envNonNegativeInt(name, def)       // invalid override falls back to default, never throws
_retryMax()      -> env MINDRIAN_BRAIN_RETRY_MAX
_retryBaseMs()   -> env MINDRIAN_BRAIN_RETRY_BASE_MS
_sleep(ms)       -> setTimeout promise
```

D-01/D-02's policy (3 retries; 500/1000/2000) is deliberately different from AVAIL-02's
(2 retries; 300 * 3^n). **Recommendation: a separate constant pair and a separate env pair**,
e.g. `RATE_LIMIT_RETRY_MAX_DEFAULT = 3`, `RATE_LIMIT_BASE_MS_DEFAULT = 500`, read through the
EXISTING `_envNonNegativeInt` helper (reuse the helper, not the constants) under new names
such as `MINDRIAN_BRAIN_RATELIMIT_RETRY_MAX` / `MINDRIAN_BRAIN_RATELIMIT_BASE_MS`.

Rationale, stated for the planner so it survives review: `MINDRIAN_BRAIN_RETRY_*` is an
operator-facing tuning knob documented for transport blips. If the 429 path read the same
vars, an operator who set `MINDRIAN_BRAIN_RETRY_MAX=0` to make outages fail fast would
silently also disable Retry-After honoring, and a rate-limited call would regress to the
exact behavior this phase exists to kill. Reuse `_sleep` and `_envNonNegativeInt` (Part 7);
do not reuse the values.

Backoff arithmetic note: AVAIL-02 uses `base * 3^attempt`. D-02's schedule is `base * 2^attempt`
(500, 1000, 2000). Different multiplier -- another reason the two schedules cannot share a
helper without a parameter.

### F-03 (VERIFIED, code read) -- sentinel shape precedent and zero downstream coercion

Existing sentinel objects returned through the promise, never thrown:

| Sentinel | Shape | Site |
|----------|-------|------|
| `tier_denied` | `{ error: 'tier_denied', tool: toolName, message: <string, already sliced to 300 chars> }` | brain-client.cjs:537 |
| `invalid_key` | `{ error: 'invalid_key', message: 'Brain API key is invalid.' }` | brain-client.cjs:387 |
| `egress_blocked` | `{ error: 'egress_blocked', tool: toolName, egress_class: <string> }` | brain-client.cjs:454 |

Recommended `rate_limited` shape, consistent with the above:
`{ error: 'rate_limited', tool: toolName, retry_after_s: <number|null>, attempts: <number>, message: <string> }`.
`retry_after_s` and `attempts` are the operator-actionable facts and cost nothing to carry.

**Downstream coercion check (the question that decides whether wrappers need edits): none
found.** `query()` at brain-client.cjs:664-669 reads:

```
if (result == null) return null;                              // unreachable / no API key
if (Array.isArray(result)) return { records: result };
if (result && Array.isArray(result.records)) return result;
if (result && (result.error || result.text)) return result;   // error / message passthrough
return { records: [] };
```

Any object carrying `.error` passes through byte-unchanged. `lib/brain/chain-recommender.cjs:551`
returns `result.error` as an open string union (`'tier_denied' | 'invalid_key' | ...`).
`brain-client.cjs:737-738` already refuses to cache anything carrying `.error`.
**Conclusion: TRUST-01 needs no edit to any public wrapper in `brain-client.cjs`.** The only
open question is the refusal renderer (F-09).

### F-04 (VERIFIED, source read in `jsagir/ProblemsWorthSolving-Brain`) -- the real 429 wire shape

`src/http/rate-limit.mjs`, `perKeyRateLimit` (lines 112-131), mounted on `/mcp` per
`src/http/app.mjs:7,23`:

- Fixed-window counter, bucket key = sha256 of the raw Authorization header (falls back to
  `req.authInfo.token`, then a hashed client address).
- Defaults: `BRAIN_HTTP_RATE_WINDOW_MS = 60_000`, `BRAIN_HTTP_RATE_MAX = 120`.
- Past budget: `res.setHeader('Retry-After', String(retryAfter))` where
  `retryAfter = Math.max(1, Math.ceil((b.resetAt - now) / 1000))`, then
  `res.status(429).json({ error: { code: -32005, message: 'Rate limit exceeded' } })`.

What this pins down, and it matters for the plan:

1. **`Retry-After` is always present on the Brain's own 429.** D-01's honor-exactly path is
   the primary path, not the edge case.
2. **It is delay-seconds (an integer string), never an HTTP-date.** The parser therefore
   needs the integer form for the live path; supporting HTTP-date is defensive-only (see
   Pitfall 3 for why to still handle it, cheaply).
3. **The value is bounded by the window: 1..60 inclusive at defaults.** Worst-case honoring
   3 waits is ~180s, but because the window is fixed, the first honored wait lands past
   `resetAt` and attempt 2 normally succeeds. Realistic worst case is one wait of <= 60s.
4. **The 429 body is JSON, not SSE.** Anything that assumes an SSE `data: ` line on a
   non-OK response will mis-parse. Both clients already read non-OK bodies as raw text, so
   this is a non-issue -- but it is why `_looksSessionRequired` (census, line 262-264) does
   NOT fire on a 429 body: the regex needs `/session/i`, and `"Rate limit exceeded"` has no
   such token. A 429 therefore returns cleanly as `{ ok:false, httpStatus:429, bodyText }`.
5. A separate, tighter limiter (`registerRateLimit`, max 5/window) guards `/register` only.
   Not on this phase's path, but worth knowing: silent registration can 429 too.

**Arithmetic that explains the whole phase:** the floor run issues 2 probes per framework
across 28 ratified frameworks = **56 requests** (verified by running
`scanMethodologyCommands()` locally: 50 methodology commands, 28 distinct frameworks; and
`data/flagship-floor-set.json` exists and ratifies exactly those 28, ratified_by navigator
2026-08-11). 56 < 120, so a fresh window survives the run. Any prior Brain traffic in the
same 60s window can push it over. That is precisely FLOOR-01's "window-fresh run" wording.

### F-05 (VERIFIED, code read) -- the exact TRUST-02 false-MISS site

`scripts/check-flagship-floor.cjs::evaluateFloor()` lines 87-104:

```
const p = (probeResultsByName && probeResultsByName[fw.name]) || null;
const matches = p ? p.normalizeMatches : null;
const score   = p ? p.readinessScore : null;
const matchesOk = matches === 1;
const scoreOk = typeof score === 'number' && score >= 3;
const verdict = matchesOk && scoreOk ? 'PASS' : 'MISS';
```

`probeFramework` (lines 109-122) sets `normalizeMatches`/`readinessScore` to `null` whenever
`res.ok` is false, and separately carries `normalizeOk`, `readinessOk`, `normalizeBody`,
`readinessBody`. **Those four fields never reach the verdict.** `main()` (line 178) prints
them only as a cosmetic ` (HTTP: normalize_ok=false readiness_ok=false)` suffix on a row
already stamped `[MISS]`. Exit code (line 102) is `misses.length > 0 ? 1 : 0`, so a
rate-limited run and a genuine floor miss are byte-identical to any automation. That is the
false MISS/RED TRUST-02 names.

`check-flagship-floor.cjs` imports `{ scanMethodologyCommands, brainCall, BRAIN_URL }` from
`./build-brain-census.cjs` at **line 53**. It requires `lib/core/brain-client.cjs` **nowhere**
(only `lib/core/resolve-brain-key.cjs`, at line 125). **TRUST-01 and TRUST-02 are two
independent fixes on two unrelated code paths.** Neither is downstream of the other; they
can be executed as two parallel plans.

### F-06 (VERIFIED, code read + live Node probe) -- `brainCall` failure shapes and the discarded error kind

`scripts/build-brain-census.cjs::brainCall()` (lines 294-380) returns, on failure:

| Situation | Current return | D-05 trigger type |
|-----------|----------------|-------------------|
| `fetch` throws (connection refused, DNS, abort/timeout) | `{ ok:false, httpStatus:0, bodyText:'fetch failed: ' + e.message }` (line 316) | hard_error OR timeout -- **currently indistinguishable** |
| Non-OK HTTP response (429, 5xx, 403, 401) | `{ ok:false, httpStatus:<n>, bodyText:<text> }` (lines 347, 349) | hard_error |
| Session-required retry path throws | `{ ok:false, httpStatus:0, bodyText:'retry fetch failed: ' + e.message }` (line 333) | hard_error OR timeout |
| Body read throws | `{ ok:false, httpStatus:<n>, bodyText:'body read failed: ' + e.message }` | malformed |
| No `data: ` line in the SSE response | `{ ok:false, httpStatus:<n>, bodyText:'no SSE data line in response: ' + text.slice(0,500) }` | malformed |
| `JSON.parse` of the SSE payload throws | `{ ok:false, httpStatus:<n>, bodyText:'unparsable SSE payload: ' + text.slice(0,500) }` | malformed |
| JSON-RPC error object in the payload | `{ ok:false, httpStatus:<n>, bodyText:JSON.stringify(parsed.error) }` | hard_error (see OQ-3) |

**The catch block at line 313-317 discards `e.name` and `e.code`, keeping only `e.message`.**
Confirmed live on this machine (Node **v22.23.1**, real loopback server, this session):

- `AbortSignal.timeout()` firing -> `e.name === 'TimeoutError'`, `e.code === 23`,
  `e.message === 'The operation was aborted due to timeout'`.
- Connection failure -> `TypeError`, `e.name === 'TypeError'`, `e.code === undefined`,
  `e.message === 'fetch failed'`.

So after `brainCall` returns, both collapse into `bodyText: 'fetch failed: ...'` with no
reliable timeout signal (the timeout case yields `'fetch failed: The operation was aborted
due to timeout'`, which is only recoverable by string-sniffing an
English-language message that Node is free to reword).

**Recommendation: add ONE field, `errorKind`, to every failure return of `brainCall`**, set
at the site where the error object is still in hand:

```
errorKind: (e && e.name === 'TimeoutError') ? 'timeout' : 'hard_error'   // catch blocks
errorKind: 'hard_error'                                                   // non-OK HTTP
errorKind: 'malformed'                                                    // parse/body failures
```

This is additive: every existing consumer reads `ok`, `httpStatus`, `bodyText`, `result` and
is unaffected. Do NOT string-sniff `bodyText` in the caller -- that reintroduces exactly the
fragility this field removes.

`build-brain-census.cjs` has other callers of `brainCall`; adding a field breaks none of
them (additive-only). The planner should still grep once before editing.

### F-07 (VERIFIED, repo-wide grep) -- exit-code space for VOID is free

`check-flagship-floor.cjs` currently uses: **0** = floor holds, **1** = at least one miss
(also the catch-all in the `require.main` handler at line 195, and the no-key bail at line
130), **2** = `data/flagship-floor-set.json` exists but is malformed (lines 144, 150).

Repo-wide grep for invocations of `check-flagship-floor` found **no automation at all** --
only the script's own header, `tests/test-249-floor-gate.cjs`'s comments (which import the
pure function, never spawn the CLI), and two prose mentions in
`docs/AMENDMENT-2026-08-DECISIONS-1-AND-8.md:168` and
`docs/2026-08-11-HANDOFF-enactment-night-and-morning-runbook.md:47`. No `run-all-*.sh`, no
CI file, no `scripts/verify-release` reference hardcodes an expectation.

**Recommendation: exit code 3 for VOID.** It is unclaimed, distinct from 1 (real MISS) and
2 (malformed override), and satisfies D-07. Document it in the script header's existing
"Exit codes:" line (line 40-42) in the same commit -- that header is the only contract
surface a future reader will consult.

### F-08 (VERIFIED, code read) -- the D-04 mock-server tension, and its resolution

Four mock-server implementations exist today:

| File | Non-200 capable? | Notes |
|------|------------------|-------|
| `tests/helpers/brain-capture-server.cjs` | **No.** Always 200 on `tools/call` (line 80) and on `initialize` (line 59). No status or body override of any kind. | The shared helper D-04 names. Consumers: `test-239-query-egress-canary.cjs`, `test-c8j-brain-wire.cjs`, `test-247-contract-client.cjs`, `test-brain-client-params.cjs`. |
| `tests/test-247-brain-client-403.cjs` | Yes -- own inline server with mutable `state.toolMode` ('ok' / '403-json' / '403-raw' / '500'). | The pattern D-04 says not to repeat. |
| `tests/test-250-transport-retry.cjs` | Yes -- own inline server with `state.toolScript` (an ordered array of modes, last entry repeating) plus `state.toolCallCount`. | **The closest existing precedent to what a forced-429 test needs.** Also a fourth copy of the same server. |
| `tests/test-249-capture-seam.cjs` | (method-dispatch pattern, cited by 250's header) | -- |

**Resolution (recommended):** extend `tests/helpers/brain-capture-server.cjs` with an opt-in
scripted-response mechanism ported from `test-250-transport-retry.cjs`'s already-proven
`toolScript` design, defaulting to today's always-200 behavior so all four existing consumers
are byte-unaffected. This honors D-04 literally (reuse the named helper, stand up no second
helper) and Canon Part 7 (the extension is a port of shipped, proven code, not an invention).

Minimal API sketch, additive-only:

```
// new, optional. Default null == today's behavior, byte-identical.
setToolScript([{ status: 429, headers: { 'Retry-After': '1' }, body: '{"error":{"code":-32005,"message":"Rate limit exceeded"}}' },
               { status: 200 }])      // entries consumed in order; LAST entry repeats
getToolCallCount()                    // attempt counter for exact-count assertions
resetToolScript()
```

Object entries (not bare status strings) are required because the 429 test must assert
`Retry-After` honoring, and only an object carries headers.

**Do NOT refactor `test-247-brain-client-403.cjs` or `test-250-transport-retry.cjs` onto the
extended helper in this phase.** They are green, pinned, and out of scope; consolidating them
is a legitimate follow-on but it multiplies this phase's blast radius for zero requirement
coverage.

**Ordering contract (load-bearing, from the helper's own header lines 16-23):** callers MUST
set `process.env.MINDRIAN_BRAIN_URL` and `MINDRIAN_BRAIN_KEY` and MUST
`delete require.cache[<resolved brain-client path>]` BEFORE requiring `brain-client.cjs`,
because `BRAIN_URL` is captured at module load (line 24). `test-250-transport-retry.cjs`'s
`freshBrainClient(url, envOverrides)` helper (lines 124-141) is the working implementation of
this dance -- copy that function's shape into the new test file.

### F-09 (VERIFIED, code read) -- the refusal-renderer scope decision

`lib/core/refusal-messaging.cjs`:

```
line 163: const REFUSAL_KINDS = Object.freeze(['no_key', 'unreachable', 'tier_denied', 'not_ready']);
line 170-173: KIND_STATUS = { no_key: DIRECTOR_NOT_AVAILABLE, unreachable: 'BRAIN_UNREACHABLE',
                              tier_denied: 'BRAIN_TIER_DENIED', not_ready: 'GRAPH_NOT_READY' }
line 246 / 316 / 334: const k = REFUSAL_KINDS.indexOf(kind) !== -1 ? kind : 'unreachable';
```

**Any unknown kind silently coerces to `unreachable`.** So if a future caller ever maps the
new sentinel through `refusalResponse('rate_limited', ...)` without a matching enum member,
the operator sees `BRAIN_UNREACHABLE` again -- the bug, relocated one layer up.

Today no caller would do that: the shim's pattern is `r == null ? refusalResponse('unreachable') : asContent(r)`
(`bin/mindrian-brain-mcp-client.cjs` lines 123, 135, 151, 163, 175), and a sentinel object is
not `null`, so it passes through raw as JSON content -- exactly what `tier_denied` does today.

| | Option A (minimal) | Option B (full honesty rail) |
|---|---|---|
| Change | `callTool` only. Sentinel passes through raw, `tier_denied` precedent. | Option A + a 5th refusal kind `rate_limited` -> status `BRAIN_RATE_LIMITED`, own reason + `next_moves`. |
| Satisfies | TRUST-01's literal text and D-03's literal text ("brain-client.cjs reports a NEW distinct sentinel"). | Also D-03's stated rationale ("changes the honest-refusal message shown") and Decision 8 (honest refusal everywhere). |
| Blast radius | Zero outside `brain-client.cjs` + its new test. | `refusal-messaging.cjs` (enum, KIND_STATUS, REASON, NEXT_MOVES, larryRefusalLine switch at 334-339); **`tests/test-250-refusal-shapes.cjs:55` hard-asserts `deepStrictEqual(REFUSAL_KINDS, ['no_key','unreachable','tier_denied','not_ready'])` and its Tests at 132 / `test-250-refusal-queue.cjs:143` iterate the enum**; `lib/core/doctor/class-m-brain-smoke.cjs:96-101` freezes a 4-member `STRUCTURED_REFUSAL_STATUSES`; the module header calls itself a "phase-amendment boundary". |
| Cost | None. | One deliberate, documented amendment of a byte-locked contract, plus 3 test/consumer edits. |

**Recommendation: Option B, executed as its own plan/task with the amendment written into the
`refusal-messaging.cjs` header the way Phase 250-01 and 252-01 wrote theirs.** D-03's own
justification names the message shown, and shipping only Option A leaves the milestone with a
sentinel no surface can render. But this is the single scope call worth the planner confirming
with the navigator, because it edits a contract three prior phases deliberately froze. If the
navigator prefers minimal, Option A still satisfies both requirement texts -- record the gap.

### F-10 (VERIFIED, code read) -- `rate_limited` is already this repo's word

`lib/core/rs-fetcher-academic.cjs` (and `-industry`, `-patents`) implement the Phase 88.6-03
per-source degradation pattern: `429 / 503 -> recordTelemetry(status: 'rate_limited') + return
empty for that source + continue` (header lines 28-36; implementation at lines 556-565).
`lib/memory/brain-derivation-graceful-degradation.test.cjs:490` also uses the literal
`'429 rate_limited too many requests'`.

So D-03's chosen name is consistent with existing repo vocabulary, not a new coinage. Note the
fetchers do NOT retry -- they degrade and continue -- so they are a naming precedent, not a
retry-schedule precedent. The only retry-schedule precedent is AVAIL-02 (F-02).

### F-11 (VERIFIED, code read) -- the existing floor-gate test contract

`tests/test-249-floor-gate.cjs` (160 lines, `node:test`, zero network) imports
`{ evaluateFloor, parseOverrideFile, CANON_PROSE_COMMAND_COUNT }` and drives them with two
fixture builders:

```
function fw(name, uses) { return { name, uses }; }
function probe(matches, score) { return { normalizeMatches: matches, readinessScore: score,
                                          normalizeOk: true, readinessOk: true }; }
```

Nine tests, including two explicit RED PROOFs and this one at line 86:

> `evaluateFloor: a framework with no probe result at all (never probed) is a MISS, not silently dropped`

**That assertion constrains the VOID design.** See OQ-2 for the recommended reading. Note the
`probe()` helper already sets `normalizeOk/readinessOk: true`, so every existing fixture is a
clean-success fixture -- meaning **an additive VOID path keyed off a new failure field leaves
all nine existing tests green with zero edits.** That is a strong argument for keying VOID off
an explicit `failures` array on the probe object rather than off the absence of a result.

**File placement recommendation: a NEW `tests/test-259-floor-void.cjs`, not an extension of
`test-249-floor-gate.cjs`.** Reasons: (1) repo convention is one test-file prefix per phase
(`test-240-*` through `test-252-*`, each discovered by that phase's own glob runner); (2)
`tests/run-all-249.sh` globs `tests/test-249-*` and would then run this phase's tests under
Phase 249's banner, muddying attribution; (3) the 249 file's own header states its scope
("hermetic floor-gate logic + sabotage red proof ... Also proves the override-file parser"),
which a VOID suite extends conceptually but not by that header's own terms. Import the same
two fixture builders' shapes (they are 3 lines each; duplicating two trivial local builders
across test files is the existing repo norm, not a Part 7 violation).

### F-12 (VERIFIED, cross-read) -- dependency direction is correct, no action needed

`.planning/ROADMAP.md:191-205` -- Phase 259 "**Depends on:** Phase 252 (parallel-safe with
Phase 258, both early tracks)". No dependency on 258.
`.planning/phases/258-.../258-RESEARCH.md` Validation Architecture -- RECON-04's row reads
"Yes (honesty depends on Phase 259 TRUST-02)".

So: **258 depends on 259; 259 depends on neither 258 nor anything 258 produces.** Both depend
only on Phase 252. The direction in both documents already agrees. Nothing to fix; recorded so
the planner does not invent a sequencing constraint.

### F-13 (VERIFIED, file read) -- the open RCA this phase closes

`.planning/debug/brain-client-429-maps-to-unreachable-zero-retry.md`, `status: investigating`,
filed 2026-08-11 by the admin-sitting session, severity medium, surfaces [cli, desktop, cowork].

It contains the reproduction, the elimination of three competing hypotheses (stale key, Part 8
egress guard, brain_query not registered), and the code-path claim at exactly the ladder F-01
describes. Two things in it matter for the plan:

1. Its `next_action` line already prescribes this phase's fix: "Add a 429 branch to callTool -
   either retry-with-backoff within budget (Retry-After aware) or a distinct `rate_limited`
   sentinel so refusal-messaging can say the true reason. Decision 8 (honest refusal) wants the
   real reason named." Note it explicitly names `refusal-messaging` -- independent support for
   Option B in F-09.
2. Its preamble tags the WIRE claim `needs-source-reverify`: "the wire-side trigger (actual HTTP
   status at failure time) was NOT captured". **F-04 discharges that re-verification** by source
   -reading the deployed Brain's limiter. The plan should record that discharge in the RCA when
   it moves the file to `.planning/debug/resolved/`. Its CODE claim was read against the install
   cache at 2.0.0-beta.5 and required re-verification against `origin/main` -- F-01 discharges
   that too (same ladder, line 551, read from the dev checkout this session).

## Standard Stack

### Core

**No new dependency is needed, recommended, or permitted for this phase.** Everything the
plan requires is a Node built-in already in use in both target files.

| Capability | What to use | Already used at |
|-----------|-------------|-----------------|
| HTTP request | global `fetch` (Node >= 18, repo floor is >= 22.16.0) | brain-client.cjs:485, build-brain-census.cjs:296 |
| Per-request timeout | `AbortSignal.timeout(ms)` | brain-client.cjs:487, build-brain-census.cjs:298 |
| Response header read | `res.headers.get('retry-after')` (Fetch `Headers`, case-insensitive) | new |
| Sleep | existing `_sleep(ms)` | brain-client.cjs:61-63 |
| Env parsing | existing `_envNonNegativeInt(name, def)` | brain-client.cjs:46-51 |
| Test runner | `node:test` + `node:assert/strict` | test-250-transport-retry.cjs, test-249-floor-gate.cjs |
| Mock HTTP server | `node:http` | tests/helpers/brain-capture-server.cjs:29 |

### Alternatives Considered

| Instead of | Could Use | Why not here |
|------------|-----------|--------------|
| Hand-rolled 429 branch | `undici`'s `RetryHandler` (supports Retry-After inference natively; type surface visible at `lib/wiki/editor-src/node_modules/undici-types/retry-handler.d.ts:89`) | Requires dropping to the undici dispatcher API instead of global `fetch`, adds an explicit dep to a repo that vendors almost nothing, and cannot express D-01's exact 3-retry / D-02's exact 500-1000-2000 schedule without configuration anyway. The Brain repo made the same call for its own limiter ("chosen over express-rate-limit ... the repo vendors little"). |
| `errorKind` field on `brainCall` | String-sniffing `bodyText` in `check-flagship-floor.cjs` | Couples the caller to an English `e.message` Node is free to reword; F-06 measured the exact collapse. |
| Extending `brain-capture-server.cjs` | A fifth inline mock server in the new test file | Directly forbidden by D-04. |

**Installation:** none. `npm install` is not part of this phase.

## Package Legitimacy Audit

**Not applicable.** This phase installs zero external packages -- every capability is a Node
built-in already imported by the target files (see Standard Stack). No registry lookup,
slopcheck run, or postinstall audit is warranted, and none was performed.

## Architecture Patterns

### System Architecture Diagram

```
TRUST-01 path (all three surfaces)
==================================

/mos: command | Larry turn | MCP tool call
        |
        v
  brain-client.cjs public wrapper  (query / search / ask / stats / write / callTool)
        |   passes {error:...} through unchanged (:664-669) -- NO EDIT NEEDED
        v
  callTool()  --> _ensureSession() --> [401] --> {error:'invalid_key'}   (zero retry)
        |
        v
  tools/call POST  ---- fetch throws ----> [AVAIL-02 retry budget] --> null
        |
        v
   response status ladder (:511)
        |-- 403 ------------------> {error:'tier_denied'}               (zero retry)
        |-- 5xx ------------------> [AVAIL-02 retry budget] --> null
        |-- 429 ==NEW==> read Retry-After header
        |                  |
        |                  +--> wait (Retry-After s, else 500/1000/2000ms)
        |                  |     attempts 2, 3, 4
        |                  +--> still 429 after attempt 4
        |                          |
        |                          v
        |                   {error:'rate_limited', tool, retry_after_s, attempts}
        |                          |
        |                          v
        |                   (Option B) refusal-messaging -> BRAIN_RATE_LIMITED
        |
        +-- any other non-OK ----> null   (:551, unchanged -- 82 degradation tests key on it)


TRUST-02 path (maintainer CLI only)
===================================

node scripts/check-flagship-floor.cjs
        |
        v
 resolve-brain-key.cjs (read tier)          data/flagship-floor-set.json (28 ratified)
        |                                            |
        +---------------> scanMethodologyCommands() -+--> 28 frameworks
                                     |
                                     v
                for each framework:  probeFramework(name, key)
                        |                         |
                        v                         v
             brainCall('normalize_...')  brainCall('orchestration_readiness')
                        |                         |
                        +----------+--------------+
                                   v
                       {ok, httpStatus, bodyText, errorKind}   <== NEW FIELD
                                   |
                                   v
              probe row: { normalizeMatches, readinessScore, failures:[{probe,kind,detail}] }
                                   |
                                   v
                            evaluateFloor()
                                   |
              +--------------------+--------------------+
              v                    v                    v
           PASS                  MISS                 VOID  <== NEW VERDICT
        (1 match AND        (clean probe,        (any failure on either
         score >= 3)         floor not met)       probe of the row)
              |                    |                    |
              +--------------------+--------------------+
                                   v
                    exit 0        exit 1        exit 3  <== NEW CODE
                  (FLOOR-01)   (real RED)   (VOID, human re-runs -- D-08)
```

### Pattern 1: The exact 429 attempt/wait sequence (D-01 + D-02 disambiguated)

D-01 says "3 bounded retries". D-02 says "500ms, 1s, 2s across the 3 attempts". Read together,
**exactly one reading is consistent with both**: a retry is by definition an attempt that
follows the initial one, and D-02 enumerates exactly three waits -- one before each retry.

| Step | Action | Wait before it (Retry-After present) | Wait before it (Retry-After absent) |
|------|--------|--------------------------------------|-------------------------------------|
| Attempt 1 | initial POST | -- | -- |
| Attempt 2 (retry 1) | POST | `Retry-After` seconds from attempt 1's response | 500ms |
| Attempt 3 (retry 2) | POST | `Retry-After` seconds from attempt 2's response | 1000ms |
| Attempt 4 (retry 3) | POST | `Retry-After` seconds from attempt 3's response | 2000ms |
| After attempt 4 still 429 | return `{ error: 'rate_limited', ... }` | -- | -- |

**Totals: 4 POSTs, 3 waits, 3500ms of fallback backoff.** The competing reading (3 attempts
total = 1 initial + 2 retries) contradicts D-01's "3 retries"; the reading that treats "the 3
attempts" as the 3 retries is the only one leaving D-02's three enumerated values with three
places to go. Write these numbers into the plan verbatim so the executor does not re-interpret
prose.

Honor Retry-After **per response**, not once: a fixed-window limiter's remaining-window shrinks
between attempts, so attempt 3's header is smaller than attempt 1's. Reading it fresh each time
is both simpler and more accurate.

### Pattern 2: Pure delay helper, so the schedule is tested with zero sleeps

The repo's own move (`evaluateFloor` extracted pure so tests inject fixtures with zero network)
applied to time instead of network. Export a pure function from `brain-client.cjs`:

```js
// Pure. No I/O, no clock. Returns the milliseconds to wait before the next attempt.
// attemptIndex is 0-based over the RETRIES (0 -> first retry, 1 -> second, 2 -> third).
function _rateLimitWaitMs(attemptIndex, retryAfterHeader, baseMs) {
  const parsed = _parseRetryAfterMs(retryAfterHeader);   // null when absent/unparseable
  if (parsed !== null) return parsed;
  return baseMs * Math.pow(2, attemptIndex);             // 500, 1000, 2000 at baseMs=500
}
```

`_parseRetryAfterMs` handles both RFC 9110 forms and refuses everything else (see Pitfall 3).
The unit test then asserts `[500, 1000, 2000]` and every Retry-After parse case in
microseconds, and the mock-server test only has to assert attempt COUNTS and the returned
sentinel -- which it can do with a tiny `baseMs` env override, exactly as
`test-250-transport-retry.cjs:132` sets `MINDRIAN_BRAIN_RETRY_BASE_MS = '5'`.

**Timer strategy (D-04's open question): use real-but-tiny waits, no fake timers.** No test in
this repo mocks timers or `setTimeout` (verified: zero hits for `mock.timers` / `useFakeTimers`
/ `sinon` across `tests/`), and `node:test`'s `mock.timers` would have to be introduced as a
new pattern for no gain. With the pure helper carrying the schedule assertions, the
mock-server legs run at `baseMs=5` and finish in ~35ms. **One** leg should run at the shipped
defaults to prove they are wired (3.5s wall clock, acceptable in a `node --test` file with no
per-test timeout configured); alternatively assert the default constants directly and keep the
whole suite sub-second. Prefer the latter unless the planner wants belt-and-suspenders.

### Pattern 3: Additive failure classification (TRUST-02 data contract)

Keep `evaluateFloor` pure and keep every existing fixture valid by making VOID key off a NEW
optional field rather than off the absence of an old one:

```js
// probeFramework returns, additively:
{
  normalizeMatches, readinessScore,
  normalizeOk, readinessOk, normalizeBody, readinessBody,   // unchanged
  failures: [                                               // NEW, [] on a clean row
    { probe: 'normalize'|'readiness', kind: 'hard_error'|'timeout'|'malformed',
      httpStatus: <n>, detail: <bodyText excerpt, length-capped> }
  ]
}

// evaluateFloor row precedence:
//   1. failures.length > 0            -> 'VOID'   (D-05: any of the 3 trigger types)
//   2. matches === 1 && score >= 3    -> 'PASS'
//   3. otherwise                      -> 'MISS'
// returns { rows, passCount, missCount, voidCount, exitCode }
// exitCode: voidCount > 0 ? 3 : (missCount > 0 ? 1 : 0)
```

VOID outranks MISS: a row whose probe failed has no trustworthy `matches`/`score` to judge, so
judging it at all is the prediction FLOOR-03 forbids.

VOID is row-level but the exit code is run-level: D-07 says a run containing any VOID row is a
VOID run. A run can legitimately contain both VOID rows and MISS rows; report both counts, and
let VOID drive the exit code, because the MISS count in such a run is a lower bound, not a
measurement. Say exactly that in the summary line.

### Pattern 4: VOID output shape (D-06)

Consistent with the existing `[PASS] / [MISS] Name -- uses=N matches=N score=N/4` line format
(line 179-181):

```
[VOID] Scenario Planning -- uses=4 matches=n/a score=n/a (VOID: readiness hard-error HTTP 429, "Rate limit exceeded")
...
Frameworks passing (exactly-1 match AND readiness>=3): 21/28
Frameworks MISSING the floor: 4/28  (lower bound -- 3 rows VOID, not measured)
Frameworks VOIDED (probe did not cleanly succeed): 3/28
  - Scenario Planning       readiness  hard-error  HTTP 429  Rate limit exceeded
  - Beautiful Question ...  normalize  timeout     --        The operation was aborted due to timeout
  - PEST Analysis           readiness  malformed   HTTP 200  no SSE data line in response: ...
=== FLOOR RUN VOID (probe failures present -- re-run required, this is NOT a floor verdict) ===
```

Two things the copy must do, both straight from D-06 and the milestone's honest-refusal
doctrine: (1) never print a bare "VOID" without the per-row trigger type; (2) never let the
final banner read like a RED, because "VOID" that looks like failure is how a false MISS gets
re-invented in the operator's head. The 429 case should also say the re-run window out loud
when a `Retry-After` was seen (F-04 makes that number available).

### Anti-Patterns to Avoid

- **Widening the `return null` at :551 into a general "retry anything non-OK".** The comment
  at 549-551 is explicit: "Every OTHER non-OK, non-retried status still returns null -- that
  remains the sole transport-failure signal (research Pitfall 4: 82 degradation tests key on
  it; do not widen this branch)." Add a 429 branch ABOVE it; change nothing about it.
- **Reusing `MINDRIAN_BRAIN_RETRY_MAX` / `_RETRY_BASE_MS` for the 429 path.** F-02.
- **Auto-re-running the floor check on VOID.** D-08. Note the distinction the plan should
  state explicitly: a bounded transport retry INSIDE `brainCall` is not "auto-retrying the
  floor check" -- it is one HTTP request being retried before it is ever reported as a probe
  result. D-08 governs the run, not the request. (See OQ-1.)
- **Sniffing `bodyText` strings to classify errors.** F-06.
- **Standing up a fifth mock server.** D-04, F-08.
- **Silently capping or ignoring a large `Retry-After`.** D-01 says honor exactly. If the
  planner wants a ceiling, it must be an explicit, ratified, logged decision -- never a quiet
  `Math.min`. (OQ-4.)

## Don't Hand-Roll

| Problem | Do not build | Use instead | Why |
|---------|--------------|-------------|-----|
| Sleeping between attempts | a new promise-timeout helper | existing `_sleep` (brain-client.cjs:61) | Already there; a second one drifts. |
| Reading a numeric env override safely | a new `parseInt` + guard | existing `_envNonNegativeInt` (brain-client.cjs:46) | Encodes the repo-wide "invalid override falls back to the default, never throws, never silently disables" convention. |
| Mocking the Brain HTTP surface | a new inline server | extended `tests/helpers/brain-capture-server.cjs` (F-08) | D-04 + Part 7. |
| Loading the client against a mock URL | ad-hoc env juggling | the `freshBrainClient()` shape from test-250-transport-retry.cjs:124-141 | `BRAIN_URL` is module-load-time captured; getting the require-cache dance wrong produces a test that silently hits the real Brain. |
| Enumerating the floor set | a new frontmatter parser | `scanMethodologyCommands()` from build-brain-census.cjs | The floor script's own header promises it mints no second parser. |
| Rate-limit backoff generally | an npm retry library | the branch specified in Pattern 1 | CJS-only, no-new-deps convention; the policy is 8 lines and fully specified by D-01/D-02. |

**Key insight:** every primitive this phase needs already exists in the two target files. The
work is classification and honesty, not machinery. The failure mode to guard against is a plan
that builds new machinery next to the machinery already there.

## Common Pitfalls

### Pitfall 1: Reading `Retry-After` after the body is drained-and-discarded

**What goes wrong:** the existing ladder drains the body at ~542 with
`await toolRes.arrayBuffer()` and immediately returns. Code inserted after that point still
has valid headers (Fetch `Headers` survive body consumption), but a plan that reorganizes the
drain can easily end up returning before the header is read.
**How to avoid:** put the 429 branch at line 539, before the shared drain, and have it consume
its own body exactly as the 403 branch does. A test asserting `retry_after_s` on the returned
sentinel catches any regression.
**Warning sign:** the sentinel comes back with `retry_after_s: null` in a test where the mock
definitely set the header.

### Pitfall 2: The mock server's `initialize` leg silently consuming an attempt

**What goes wrong:** `callTool` does `initialize` first (via `_ensureSession`, 5-minute cached)
and then `tools/call`. A scripted mock that counts ALL requests rather than dispatching on
`parsed.method` will attribute the handshake to the retry budget and produce off-by-one
attempt assertions.
**How to avoid:** dispatch on `parsed.method === 'initialize'` vs `'tools/call'` and count only
the latter -- exactly what `test-250-transport-retry.cjs:72-109` does and what
`brain-capture-server.cjs:58,74` already does. Keep that dispatch when extending the helper.
**Warning sign:** attempt count is consistently 1 higher than expected in the first test leg
and correct thereafter (the session cache means only the FIRST call handshakes).

### Pitfall 3: `Retry-After` is two formats, and a hostile/odd value can hang a turn

**What goes wrong:** RFC 9110 defines `Retry-After` as either `delay-seconds` (a
non-negative integer) or an `HTTP-date`. The Brain sends the integer form (F-04, verified),
but a future edge proxy (Cloudflare, Render) could send either, or something non-conforming.
`Number('Wed, 20 Aug 2026 12:00:00 GMT')` is `NaN`, and `_sleep(NaN)` resolves on the next
tick -- a silent zero-wait that hammers the limiter.
**How to avoid:** a defensive pure parser that returns `null` (meaning "fall back to D-02's
exponential schedule") for anything it cannot turn into a finite, non-negative millisecond
count. Handle the integer form first (the live path), then attempt `Date.parse` for the
HTTP-date form, then give up. Never let `NaN`, a negative, or `Infinity` reach `_sleep`.
**Warning sign:** an exhaustion test completes far faster than the schedule predicts.

### Pitfall 4: The 20s per-request timeout does not bound the Retry-After wait

**What goes wrong:** `BRAIN_REQUEST_TIMEOUT_MS` (default 20000, brain-client.cjs:31) is an
`AbortSignal.timeout` on each individual fetch. The backoff sleeps sit BETWEEN fetches and are
not covered by it. A 60s `Retry-After` honored three times is ~180s of a hung-looking CLI turn
with no timeout to catch it.
**How to avoid:** know the number and decide it deliberately. F-04's fixed-window analysis says
the realistic worst case is one wait of <= 60s, because the first honored wait lands past
`resetAt`. If the planner wants a hard ceiling, that is OQ-4, a navigator call, never a silent
`Math.min`.
**Warning sign:** operator reports "Larry froze for a minute" -- which is, notably, still
strictly better than today's instant lie.

### Pitfall 5: VOID rendering that reads like RED

**What goes wrong:** re-using the existing `=== FLOOR DOES NOT HOLD (SWEEP-02 gate RED) ===`
banner for a VOID run, or printing a MISS count next to VOID rows without qualifying it. The
operator then treats a rate-limited run as evidence about the graph -- which is the exact
false-MISS the requirement forbids, moved from the exit code into the human's head.
**How to avoid:** distinct banner, distinct exit code (3), and a MISS count explicitly labelled
a lower bound in any run with VOID rows. Pattern 4.
**Warning sign:** the phrase "24 misses" appearing in a session log from a run that also had
VOID rows.

### Pitfall 6: The floor run tripping the limiter it is now honest about

**What goes wrong:** 56 requests against a 120/60s per-key budget (F-04). A fresh window is
fine; a window already partly burned by an interactive session is not. Post-fix, that produces
a VOID run that D-08 says a human must re-run -- and if they re-run immediately, inside the
same window, it VOIDs again.
**How to avoid:** the VOID output should surface the `Retry-After` seconds it saw so the
operator knows how long to wait (Pattern 4). Optionally, `brainCall` gains the same bounded
429 handling (OQ-1). And FLOOR-01's "window-fresh run" wording should be honored literally in
the runbook.
**Warning sign:** two consecutive VOID runs with 429 as the trigger.

### Pitfall 7: The RCA's WIRE claim being carried forward as still-unverified

**What goes wrong:** F-13's RCA carries `needs-source-reverify` on the wire claim. A plan that
closes the RCA without recording that F-04 discharged it leaves the next reader unsure whether
the 429 hypothesis was ever confirmed.
**How to avoid:** the RCA-resolution task explicitly cites `src/http/rate-limit.mjs` lines
112-131 as the discharge, and cites brain-client.cjs:551 (read from the dev checkout, not the
install cache) as the discharge of the CODE claim's re-verification rule.

## Code Examples

### The 429 branch (insert at brain-client.cjs:539, after the 403 block)

```js
// Phase 259 (TRUST-01): HTTP 429 means the Brain's per-key rate window is
// burned, NOT that the Brain is unreachable. Verified against the deployed
// limiter (ProblemsWorthSolving-Brain src/http/rate-limit.mjs perKeyRateLimit,
// 120 req / 60s per key by default): it ALWAYS sets Retry-After as integer
// delay-seconds, floored at 1 and bounded by the window. Zero-retry-then-null
// was the pre-259 behavior and rendered as BRAIN_UNREACHABLE with a message
// claiming a retry budget had been spent -- factually false on this leg.
// Its own retry constants, NOT AVAIL-02's: those are an operator knob for
// transport blips, and sharing them would let a MINDRIAN_BRAIN_RETRY_MAX=0
// tuning silently reinstate the bug.
if (toolRes.status === 429) {
  const retryAfterRaw = toolRes.headers.get('retry-after');
  try { await toolRes.arrayBuffer(); } catch (_) { /* body already gone */ }
  if (rlAttempt < _rateLimitRetryMax()) {
    await _sleep(_rateLimitWaitMs(rlAttempt, retryAfterRaw, _rateLimitBaseMs()));
    rlAttempt += 1;
    continue;
  }
  return {
    error: 'rate_limited',
    tool: toolName,
    retry_after_s: _parseRetryAfterMs(retryAfterRaw) === null
      ? null
      : Math.ceil(_parseRetryAfterMs(retryAfterRaw) / 1000),
    attempts: rlAttempt + 1,
    message: 'Brain rate limit reached for this key (429) after ' +
             (rlAttempt + 1) + ' attempts.',
  };
}
```

Note `rlAttempt` is a SEPARATE counter from the loop's `attempt`. The existing `attempt`
drives AVAIL-02's network/5xx budget; sharing it would let a 5xx blip earlier in the same call
eat the 429 budget. Declare `let rlAttempt = 0;` next to `const retryMax = _retryMax();` at
line 480.

### The pure Retry-After parser (both RFC 9110 forms, defensive)

```js
// Pure, no clock beyond Date.now() for the HTTP-date form. Returns milliseconds
// to wait, or null meaning "no usable header -- use the D-02 exponential schedule".
// RFC 9110 s10.2.3: Retry-After = HTTP-date / delay-seconds.
function _parseRetryAfterMs(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  if (/^\d+$/.test(trimmed)) {                 // delay-seconds (the Brain's live form)
    const secs = Number(trimmed);
    return Number.isFinite(secs) && secs >= 0 ? secs * 1000 : null;
  }
  const at = Date.parse(trimmed);              // HTTP-date (defensive: proxies/edges)
  if (!Number.isFinite(at)) return null;
  const delta = at - Date.now();
  return delta > 0 ? delta : 0;                // a past date means "retry now"
}
```

### `brainCall` classification (build-brain-census.cjs, additive)

```js
// Phase 259 (TRUST-02): preserve enough of the caught error for the caller to
// tell a timeout from a hard error. Verified on Node v22.23.1:
// AbortSignal.timeout -> e.name 'TimeoutError' (e.code 23); a connection
// failure -> TypeError with message 'fetch failed' and no distinguishing name.
// e.message alone collapses both, so classify HERE, where the error object
// still exists. Additive field: every existing consumer reads ok/httpStatus/
// bodyText/result and is unaffected.
function _classifyThrown(e) {
  return (e && e.name === 'TimeoutError') ? 'timeout' : 'hard_error';
}
```

### The VOID verdict (check-flagship-floor.cjs::evaluateFloor)

```js
const rows = frameworks.map((fw) => {
  const p = (probeResultsByName && probeResultsByName[fw.name]) || null;
  const failures = (p && Array.isArray(p.failures)) ? p.failures : [];
  const matches = p ? p.normalizeMatches : null;
  const score = p ? p.readinessScore : null;
  // Phase 259 (TRUST-02, D-05): a probe that did not cleanly succeed carries no
  // trustworthy matches/score, so scoring it at all is the prediction FLOOR-03
  // forbids. VOID outranks MISS. A framework with no entry at all stays MISS --
  // the live main() always writes an entry per framework, so that branch is
  // unreachable in practice and its 249 assertion stands (see OQ-2).
  if (failures.length > 0) {
    return { name: fw.name, uses: fw.uses, matches, score, verdict: 'VOID', failures };
  }
  const matchesOk = matches === 1;
  const scoreOk = typeof score === 'number' && score >= 3;
  return { name: fw.name, uses: fw.uses, matches, score,
           verdict: (matchesOk && scoreOk) ? 'PASS' : 'MISS', failures: [] };
});
const voids  = rows.filter((r) => r.verdict === 'VOID');
const misses = rows.filter((r) => r.verdict === 'MISS');
return {
  rows,
  passCount: rows.filter((r) => r.verdict === 'PASS').length,
  missCount: misses.length,
  voidCount: voids.length,
  // 3 = VOID (unclaimed; 1 = real miss, 2 = malformed override file). D-07.
  exitCode: voids.length > 0 ? 3 : (misses.length > 0 ? 1 : 0),
};
```

Note `passCount` must change from `rows.length - misses.length` to an explicit PASS filter --
the old arithmetic silently counts VOID rows as passes. This is a small edit that is easy to
miss and would produce a wrong-in-the-flattering-direction number, which is the worst kind.

## Runtime State Inventory

Not applicable -- this is not a rename, refactor, or migration phase. No stored data, live
service config, OS registration, secret name, or build artifact carries a string this phase
changes. The two new env var names (F-02) are additive and unset by default, so no existing
`.env`, SOPS key, or pm2 config is affected.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node built-in `node:test` + `node:assert/strict` (no external test dep, no fake-timer dep) |
| Config file | none -- per-phase bash aggregators (`tests/run-all-<phase>.sh`) glob `tests/test-<phase>-*` |
| Runner invocation | `node --test <file>` for `.cjs` (the 250 runner's form; the 249 runner uses bare `node <file>`) -- **use `node --test`, matching `tests/run-all-250.sh`, since these are `node:test` suites** |
| Quick run command | `node --test tests/test-259-brain-client-429.cjs` (zero network, loopback mock) |
| Quick run command (floor leg) | `node --test tests/test-259-floor-void.cjs` (zero network, pure fixtures) |
| Full suite command | `bash tests/run-all-259.sh` (does not exist yet -- Wave 0) |
| Regression suites that must stay green | `node --test tests/test-250-transport-retry.cjs`, `node tests/test-249-floor-gate.cjs`, `node --test tests/test-250-refusal-shapes.cjs` (the last one only if F-09 Option B is taken -- it will need a deliberate edit) |
| Release gate | `scripts/verify-release`, `node scripts/doctor.cjs --acceptance` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| TRUST-01 | A single 429 followed by a 200 recovers: `callTool` returns the payload, never null, with exactly 2 tools/call attempts | unit (loopback mock, zero network egress) | `node --test tests/test-259-brain-client-429.cjs` | No -- Wave 0 |
| TRUST-01 | 429 on all 4 attempts returns `{ error: 'rate_limited', ... }`, never `null`, with exactly 4 tools/call attempts (1 initial + 3 retries, D-01) | unit | `node --test tests/test-259-brain-client-429.cjs` | No -- Wave 0 |
| TRUST-01 | **RED PROOF:** the same fixture against the pre-fix ladder returns `null` (assert the sentinel is not `null` and not `undefined`, and that its `.error` is exactly `'rate_limited'`) | unit | `node --test tests/test-259-brain-client-429.cjs` | No -- Wave 0 |
| TRUST-01 | `Retry-After: 1` is honored: measured elapsed time between attempts >= 1000ms and the returned `retry_after_s === 1` (D-01) | unit (one real ~1s wait, tolerant lower-bound assertion only) | `node --test tests/test-259-brain-client-429.cjs` | No -- Wave 0 |
| TRUST-01 | With no `Retry-After` header, waits follow 500/1000/2000 (D-02) | unit, **zero sleeps** -- pure `_rateLimitWaitMs(0..2, null, 500)` | `node --test tests/test-259-brain-client-429.cjs` | No -- Wave 0 |
| TRUST-01 | `_parseRetryAfterMs` returns null for absent / empty / `NaN` / negative / garbage, seconds*1000 for the integer form, a positive delta for a future HTTP-date, and 0 for a past one (Pitfall 3) | unit, zero I/O | `node --test tests/test-259-brain-client-429.cjs` | No -- Wave 0 |
| TRUST-01 | 429 handling does NOT consume AVAIL-02's budget and does not respond to `MINDRIAN_BRAIN_RETRY_MAX` (F-02): set `MINDRIAN_BRAIN_RETRY_MAX=0` and prove the 429 path still retries 3 times | unit | `node --test tests/test-259-brain-client-429.cjs` | No -- Wave 0 |
| TRUST-01 | The null contract is unchanged: 5xx-exhausted still returns `null`; 403 still returns `tier_denied` in one attempt; 401 still returns `invalid_key` | regression | `node --test tests/test-250-transport-retry.cjs` | **Yes** |
| TRUST-01 | Part 8: the 429 branch adds zero outbound payload (the new test's captured requests carry only the tool name and args the caller passed) | unit (capture-server assertion) | `node --test tests/test-259-brain-client-429.cjs` | No -- Wave 0 |
| TRUST-01 (Option B only) | `REFUSAL_KINDS` gains `rate_limited` -> `BRAIN_RATE_LIMITED` with its own reason and next_moves; no kind coerces to `unreachable` | unit | `node --test tests/test-250-refusal-shapes.cjs` (deliberate amendment) | Yes -- needs edit |
| TRUST-02 | A row with a `hard_error` failure (HTTP 429) is `VOID`, not `MISS` | unit, pure fixtures, zero network | `node --test tests/test-259-floor-void.cjs` | No -- Wave 0 |
| TRUST-02 | A row with a `timeout` failure is `VOID` (D-05) | unit | `node --test tests/test-259-floor-void.cjs` | No -- Wave 0 |
| TRUST-02 | A row with a `malformed` failure (no SSE data line) is `VOID` (D-05) | unit | `node --test tests/test-259-floor-void.cjs` | No -- Wave 0 |
| TRUST-02 | **RED PROOF:** an all-green fixture with ONE row's probe sabotaged to a failure flips the run from exit 0 to exit 3, and `missCount` does NOT increase (the false-MISS proof) | unit | `node --test tests/test-259-floor-void.cjs` | No -- Wave 0 |
| TRUST-02 | A run with both VOID and MISS rows exits 3, not 1 (VOID outranks) | unit | `node --test tests/test-259-floor-void.cjs` | No -- Wave 0 |
| TRUST-02 | `passCount` never counts a VOID row (the flattering-arithmetic guard) | unit | `node --test tests/test-259-floor-void.cjs` | No -- Wave 0 |
| TRUST-02 | Exit codes stay distinct: 0 clean, 1 real MISS, 2 malformed override, 3 VOID | unit + the existing `parseOverrideFile` tests | `node --test tests/test-259-floor-void.cjs` + `node tests/test-249-floor-gate.cjs` | Partial (2-leg exists) |
| TRUST-02 | `brainCall` sets `errorKind: 'timeout'` on an `AbortSignal.timeout` abort and `'hard_error'` on a connection failure | unit (loopback server that never responds + a closed port) | `node --test tests/test-259-floor-void.cjs` or a sibling | No -- Wave 0 |
| TRUST-02 | D-06: VOID output names every failed row and its trigger type | unit on a pure renderer, or a spawned-CLI smoke against the mock | `node --test tests/test-259-floor-void.cjs` | No -- Wave 0 |
| TRUST-02 | All nine existing `evaluateFloor` / `parseOverrideFile` assertions stay green unchanged | regression | `node tests/test-249-floor-gate.cjs` | **Yes** |
| Both | No em-dash in any file this phase touches | fence | `bash tests/run-all-259.sh` (fence section) | No -- Wave 0 |
| Both (manual) | A live floor run against the real Brain produces an honest verdict | manual-only | `node scripts/check-flagship-floor.cjs` -- justified: cannot be automated without either burning the real rate window on purpose or asserting against live graph state this phase does not control | n/a |

### Sampling Rate

- **Per task commit:** `node --test tests/test-259-brain-client-429.cjs` (sub-second at
  `baseMs=5`) or `node --test tests/test-259-floor-void.cjs` (pure, sub-second), whichever the
  task touched.
- **Per wave merge:** `bash tests/run-all-259.sh` PLUS the two regression suites
  (`node --test tests/test-250-transport-retry.cjs`, `node tests/test-249-floor-gate.cjs`) --
  these are the contracts most at risk from this phase's edits.
- **Phase gate:** `bash tests/run-all-259.sh` green, both regression suites green, and
  `node scripts/doctor.cjs --acceptance` green before `/gsd-verify-work`. The live
  `node scripts/check-flagship-floor.cjs` run is a checkpoint observation, not a gate --
  its verdict depends on graph state Phases 260-262 own.

### Wave 0 Gaps

- [ ] `tests/test-259-brain-client-429.cjs` -- covers TRUST-01 (all legs above)
- [ ] `tests/test-259-floor-void.cjs` -- covers TRUST-02 (all legs above)
- [ ] Scripted-response extension to `tests/helpers/brain-capture-server.cjs`
      (`setToolScript` / `getToolCallCount` / `resetToolScript`, default-off) -- prerequisite
      for the TRUST-01 file, per D-04 and F-08
- [ ] `tests/run-all-259.sh` -- glob runner with the load-bearing `found -eq 0` guard, the
      `TEST_259_PREFIX` override hook, and the `grep -P '\x{2014}'` no-em-dash fence over this
      phase's target list (copy `tests/run-all-250.sh`, which already uses `node --test`)
- [ ] Framework install: **none needed** -- `node:test` is built in, Node v22.23.1 is live

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js (>= 22.16.0 repo floor) | everything | Yes | v22.23.1 (verified this session) | -- |
| `node:test` / `node:assert` | both test files | Yes | built in | -- |
| `node:http` loopback bind | mock server | Yes (verified: bound and served a scripted 429 with `Retry-After` this session) | -- | -- |
| global `fetch` + `AbortSignal.timeout` | both code paths | Yes (verified live) | -- | -- |
| Read-tier Brain key (`~/.mindrian.env` or `MINDRIAN_BRAIN_KEY`) | live floor run only | Not verified this session (deliberately not read) | -- | Every automated test is hermetic; the live run is a manual checkpoint |
| `jsagir/ProblemsWorthSolving-Brain` checkout | F-04 verification only | Yes -- `/home/jsagi/dev/ProblemsWorthSolving-Brain` | -- | -- |
| Network access to `pws-brain-mcp.onrender.com` | live floor run only | Not exercised | -- | Hermetic tests cover every requirement leg |
| `.planning/graphs/graph.json` (GSD knowledge graph) | optional research aid | Present but **STALE**: last built 2026-07-23, 673h old, 846 commits behind | -- | Not queried -- a graph 846 commits behind this phase's target files would have produced misleading relationships. All findings came from direct file reads instead. |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** live Brain access (hermetic tests cover all
requirement legs; the live run is a manual checkpoint by design).

## Security Domain

`security_enforcement` is not set in `.planning/config.json`, so it is treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no (adjacent) | This phase must not change 401/403 handling. `invalid_key` and `tier_denied` stay zero-retry (AVAIL-02's stated taxonomy: retrying an auth failure hammers auth). A 429 branch inserted above the generic null must not shadow them -- 403 is checked first at :520, so ordering is already correct. |
| V3 Session Management | no | The 5-minute session cache is untouched. |
| V4 Access Control | no | No tier or scope logic changes. Read-tier key only; no admin key anywhere in this phase. |
| V5 Input Validation | **yes** | `Retry-After` is a server-controlled string reaching a sleep primitive. Parse defensively; reject `NaN`, negative, non-finite (Pitfall 3). `bodyText` excerpts reaching VOID output must stay length-capped -- `brainCall` already caps SSE-parse excerpts at 500 chars, and `tier_denied` caps its message at 300; match that convention. |
| V6 Cryptography | no | None involved. Never hand-roll; none is being hand-rolled. |
| V7 Error handling / logging | **yes -- the phase's central control** | Both requirements ARE error-taxonomy controls. The negative control matters as much as the positive one: no new code path may print or log a key value. `refusalResponse`'s existing V5 rule (interpolate only a closed-enum kind, a coerced tool name, and an already-sliced server message) is the pattern to follow if F-09 Option B is taken. |
| V8 Data protection / Canon Part 8 | **yes** | Verified: nothing recommended here adds an outbound field, a new endpoint, or any user-derived byte on the wire. The 429 branch reads a response header. The VOID branch reads a response body and prints locally. `check-flagship-floor.cjs` sends only framework NAMES (generic methodology handles), which is exactly what Part 8 permits. |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation | Status here |
|---------|--------|---------------------|-------------|
| Server-controlled `Retry-After` used as an unbounded sleep (a slow-loris in reverse) | Denial of Service | Defensive parse + a known, decided worst case (F-04: bounded by the limiter's window) | Pitfall 4 / OQ-4 -- decide explicitly, never cap silently |
| Retry amplification against a rate limiter | Denial of Service (self-inflicted) | Bounded budget (D-01: exactly 3), and honoring `Retry-After` rather than a fixed short backoff | Designed in |
| A 429 branch accidentally widened to retry 401/403 | Elevation of Privilege (auth hammering) | Keep the 403 check first; keep 401 in `_ensureSession`; assert one-attempt behavior in the regression suite | `test-250-transport-retry.cjs` Test C already guards this |
| Key material leaking into a refusal message or VOID output | Information Disclosure | Existing convention: never print a key value; print path names only. Truncate all server-supplied text. | Must hold for the new `message` and VOID `detail` fields |
| A VOID run silently consumed as a completed floor check | Repudiation / Tampering-by-omission | Distinct non-zero exit code (D-07), distinct banner (Pattern 4) | The phase's own deliverable |
| Log injection via a Brain-supplied `bodyText` newline into VOID output | Tampering | Length-cap and, ideally, collapse newlines in the printed `detail` | Cheap; recommend it |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `orchestration_readiness` returns a readiness object (score-based) for an unknown framework name rather than raising a JSON-RPC error. Read from the Brain's `src/server.mjs:604-614`, which awaits `orchestrationReadiness()` and stringifies the result with no error branch; the live baseline of 24 clean MISSes with `score=n/a` is consistent. The underlying `orchestrationReadiness()` implementation was NOT read. | Pattern 3, OQ-3 | If it errors on unknown names, every genuinely-absent framework becomes VOID instead of MISS and the floor can never turn green during the enrichment phases. Cheap to discharge: one live probe of a known-absent name. |
| A2 | Adding an `errorKind` field to `brainCall`'s returns breaks no other consumer inside `build-brain-census.cjs`. Based on the additive nature of the change; the file's other `brainCall` call sites were not each individually read. | F-06 | Low. A one-command grep before editing discharges it. |
| A3 | `node:test` applies no per-test timeout by default in this repo's invocation, so a ~3.5s default-schedule leg would not be killed. | Pattern 2 | Low, and avoidable: the recommended design asserts the schedule via the pure helper with zero sleeps. |
| A4 | Retry-After's HTTP-date form will never be seen on this path in practice (the Brain sends integers; a future Cloudflare/Render edge is the only source). Handling it is defensive. | Pitfall 3, code example | None -- the defensive parser covers both either way. |
| A5 | The `Retry-After` header name lookup via Fetch `Headers.get()` is case-insensitive per the Fetch spec, so `'retry-after'` matches the Brain's `'Retry-After'`. Verified empirically this session (a live loopback server sending `Retry-After: 2` was read back with `res.headers.get('retry-after') === '2'`). | Code example | None -- verified. |

## Open Questions

### OQ-1: Should `brainCall` (the census/floor client) ALSO get bounded 429 handling?

- **What we know:** the floor run issues 56 requests against a 120/60s budget (F-04). D-08
  forbids auto-retrying the FLOOR CHECK. A bounded transport retry inside a single HTTP
  request is a different layer -- `brain-client.cjs` already retries 5xx without anyone calling
  that an auto-retry of a command.
- **What's unclear:** whether the navigator reads D-08 as governing the run (my reading) or
  every request within it.
- **Recommendation:** treat D-08 as governing the RUN, and keep `brainCall` unchanged for this
  phase. TRUST-02's requirement text is satisfied by VOID alone, and adding retry logic to a
  second HTTP client doubles this phase's surface for no requirement coverage. Instead, make
  the VOID output print the `Retry-After` seconds it observed (Pattern 4) so the human re-run
  D-08 mandates lands after the window, not inside it. Record a follow-on seed if the floor
  run VOIDs repeatedly in practice.

### OQ-2: Is a framework with NO probe entry at all a MISS or a VOID?

- **What we know:** `tests/test-249-floor-gate.cjs:86` pins it as MISS ("not silently
  dropped"). D-05 names three trigger types, none of which is "never probed". The live
  `main()` writes an entry for every enumerated framework (line 171-173), so the branch is
  unreachable in production.
- **What's unclear:** whether "verify, never predict" should extend to this defensive branch.
- **Recommendation:** keep it MISS. It preserves a pinned test at zero real-world cost, and the
  branch cannot fire in the live path. Document the reasoning in the code comment (the example
  in Code Examples does). If a reviewer objects on honesty grounds, the change is one line plus
  one 249-test edit -- but it buys nothing measurable.

### OQ-3: Does a JSON-RPC error payload count as `hard_error` or `malformed`?

- **What we know:** `brainCall` returns `{ ok:false, bodyText: JSON.stringify(parsed.error) }`
  for a protocol-level error inside an HTTP 200. It is well-formed data reporting a failure --
  neither obviously "hard error" nor "malformed".
- **What's unclear:** whether the Brain ever returns one on these two read tools, and for what
  (A1).
- **Recommendation:** classify it `hard_error` and VOID the row, because under D-05 anything
  that did not cleanly succeed VOIDs regardless of which bucket it lands in -- so the label is
  cosmetic for the verdict and only affects the D-06 detail line. But discharge A1 first with a
  single live probe of a known-absent name (`PEST Analysis` is the natural candidate: it is a
  documented absent node, CER-04 is the requirement to ingest it). If unknown names DO produce
  protocol errors, this becomes load-bearing and must be classified as a MISS input, not a VOID
  trigger.

### OQ-4: Should a large `Retry-After` be capped?

- **What we know:** D-01 says honor exactly. F-04 bounds the live value at the window length
  (60s at defaults), and the fixed-window design means the first honored wait normally clears
  the limit, so realistic worst case is one ~60s wait; theoretical worst case across 3 retries
  is ~180s. `BRAIN_REQUEST_TIMEOUT_MS` does not cover the sleeps (Pitfall 4).
- **What's unclear:** whether a 60s freeze in an interactive Larry turn is acceptable UX.
- **Recommendation:** ship D-01 literally (no cap) and record the number in the plan and in the
  code comment. If the navigator wants a ceiling, it must be an explicit ratified constant with
  its own env override and a message that says the wait was truncated -- never a silent
  `Math.min` that reintroduces a quiet lie. Note that even a 60s honest wait is strictly better
  than today's instant-and-wrong `BRAIN_UNREACHABLE`.

### OQ-5: Option A or Option B for the refusal renderer? (F-09)

- **What we know:** Option A satisfies both requirement texts with zero blast radius. Option B
  satisfies D-03's stated rationale and the RCA's own `next_action`, at the cost of amending a
  4-member frozen enum plus 3 consumer/test sites.
- **Recommendation:** Option B, as its own plan with the amendment documented in the module
  header the way 250-01 and 252-01 documented theirs. Flag it for the navigator at plan time --
  it is the only decision in this phase that edits a contract prior phases deliberately froze.

## State of the Art

| Old approach | Current approach | When changed | Impact here |
|--------------|------------------|--------------|-------------|
| Silent graceful degradation on a Brain failure | Typed refusal rail: 4 kinds, honest per-kind reasons | Phase 250-01 (HONEST-01) | The rail exists; 429 is the leg it never covered. This phase closes it. |
| Zero retries anywhere at the tools/call seam | Bounded transport retry on network errors and 5xx | Phase 250-01 (AVAIL-02) | The machinery to copy (F-02) -- and the machinery whose constants must NOT be shared. |
| `lib/core/tier0-messaging.cjs` | `lib/core/refusal-messaging.cjs` (git mv, zero export renames) | Phase 252-01 (SWEEP-01) | Use the current path; older docs still say tier0. |
| Floor denominator OPEN (28 scan vs 25 canon prose) | RATIFIED at 28 (`data/flagship-floor-set.json`, navigator, 2026-08-11) | Phase 249-03 | The floor run is 28 frameworks / 56 probes, not a moving target. |
| Pinecone / Neo4j Aura backend | Memgraph + local e5 vectors | 2026-07-22 cutover | Only relevant so nobody re-reads stale tool descriptions while working here. |

**Deprecated / outdated in this area:** the RCA's code citation ("~line 442-515", install cache
at 2.0.0-beta.5) is superseded by F-01's line numbers read from the dev checkout at
`origin/main`'s current tree. Use F-01's.

## Sources

### Primary (HIGH confidence -- read directly this session)
- `/home/jsagi/dev/MindrianOS-Plugin/lib/core/brain-client.cjs` -- lines 24, 31, 43-63, 387,
  422-575, 664-669, 737-738
- `/home/jsagi/dev/MindrianOS-Plugin/scripts/check-flagship-floor.cjs` -- entire file (197 lines)
- `/home/jsagi/dev/MindrianOS-Plugin/scripts/build-brain-census.cjs` -- lines 262-380
- `/home/jsagi/dev/MindrianOS-Plugin/tests/helpers/brain-capture-server.cjs` -- entire file
- `/home/jsagi/dev/MindrianOS-Plugin/tests/test-250-transport-retry.cjs` -- entire file
- `/home/jsagi/dev/MindrianOS-Plugin/tests/test-249-floor-gate.cjs` -- entire file
- `/home/jsagi/dev/MindrianOS-Plugin/lib/core/refusal-messaging.cjs` -- header + lines 159-340
- `/home/jsagi/dev/MindrianOS-Plugin/bin/mindrian-brain-mcp-client.cjs` -- lines 80-175
- `/home/jsagi/dev/MindrianOS-Plugin/lib/core/doctor/class-m-brain-smoke.cjs` -- lines 80-110
- `/home/jsagi/dev/MindrianOS-Plugin/lib/core/rs-fetcher-academic.cjs` -- lines 25-46, 479-565
- `/home/jsagi/dev/MindrianOS-Plugin/tests/run-all-249.sh`, `tests/run-all-250.sh` -- entire files
- `/home/jsagi/dev/MindrianOS-Plugin/.planning/debug/brain-client-429-maps-to-unreachable-zero-retry.md`
- `/home/jsagi/dev/MindrianOS-Plugin/.planning/REQUIREMENTS.md` -- lines 35-125
- `/home/jsagi/dev/MindrianOS-Plugin/.planning/ROADMAP.md` -- lines 179-215
- `/home/jsagi/dev/MindrianOS-Plugin/.planning/phases/258-.../258-RESEARCH.md` -- Validation
  Architecture section (format precedent + the RECON-04 dependency line)
- `/home/jsagi/dev/MindrianOS-Plugin/CLAUDE.md` + `.claude/includes/*.md`
- `/home/jsagi/dev/MindrianOS-Plugin/.claude/skills/agentshield/SKILL.md`
- `/home/jsagi/dev/ProblemsWorthSolving-Brain/src/http/rate-limit.mjs` -- entire file (the
  single most load-bearing external read: the real 429 + Retry-After contract)
- `/home/jsagi/dev/ProblemsWorthSolving-Brain/src/http/app.mjs` -- lines 7, 23
- `/home/jsagi/dev/ProblemsWorthSolving-Brain/src/server.mjs` -- lines 604-614

### Primary (HIGH confidence -- executed this session)
- `node --version` -> v22.23.1
- Live loopback probe: a scripted `429` + `Retry-After: 2` response read back via
  `res.headers.get('retry-after')`; `AbortSignal.timeout` abort -> `TimeoutError` / code 23;
  connection failure -> `TypeError` / `'fetch failed'`
- `node -e "...scanMethodologyCommands()"` -> 50 methodology commands, 28 distinct frameworks
- `data/flagship-floor-set.json` -> 28 frameworks, ratified_by navigator, 2026-08-11
- Repo-wide grep for `check-flagship-floor` invocations -> zero automation call sites
- Repo-wide grep for fake timers (`mock.timers` / `useFakeTimers` / `sinon`) -> zero hits

### Secondary (MEDIUM confidence)
- RFC 9110 s10.2.3 `Retry-After = HTTP-date / delay-seconds` -- training knowledge, corroborated
  by the Brain's own integer-seconds implementation and by `undici-types/retry-handler.d.ts:89`
  ("infer timeout between retries based on the `Retry-After` header") present in this repo's
  vendored types. Treated as `[ASSUMED]` for the HTTP-date branch only (A4); the integer branch
  is `[VERIFIED]` by source read.

### Not used
- Context7 / langtalks-graph-expert / WebSearch: no external library, API, or agent-engineering
  concept is in question here. Every claim resolved against first-party source in the two
  repos, which is strictly more authoritative for this phase's questions. Per CLAUDE.md's
  grounding rule, picking a source that does not cover the claim would itself be the gap.
- The GSD knowledge graph (`.planning/graphs/graph.json`): present but 673h old and 846 commits
  behind, so its edges predate the very code this phase edits. Deliberately not queried.

## Metadata

**Confidence breakdown:**
- Bug sites and edit points (F-01, F-05): **HIGH** -- read at exact line numbers from the dev
  checkout, not the install cache, not memory.
- 429 wire contract incl. Retry-After presence/format/bounds (F-04): **HIGH** -- source-read
  from the deployed Brain's own limiter. This discharges the RCA's `needs-source-reverify` tag.
- Sentinel shape + zero downstream coercion (F-03): **HIGH** -- the passthrough branch was read
  verbatim.
- Test infrastructure and the D-04 resolution (F-08, F-11): **HIGH** -- all four mock servers
  and both existing suites read in full.
- Exit-code space (F-07): **HIGH** -- exhaustive repo grep, zero automation call sites found.
- Error classification (F-06): **HIGH** on the code shapes and the Node error shapes (both read
  and executed); **MEDIUM** on the JSON-RPC-error bucket (OQ-3, A1).
- Refusal-renderer blast radius (F-09): **HIGH** on the enumerated sites; the A/B scope call
  itself is a judgement for the navigator, not a fact.
- `orchestration_readiness` behavior on unknown names (A1): **MEDIUM** -- the registration
  wrapper was read; the implementation was not. One live probe discharges it.

**Research date:** 2026-08-20
**Valid until:** 2026-09-19 (30 days). Two things would invalidate it early: a change to the
Brain's `src/http/rate-limit.mjs` (window, max, or header behavior), or a Phase 260-262 edit
that touches `build-brain-census.cjs`'s `brainCall`.
