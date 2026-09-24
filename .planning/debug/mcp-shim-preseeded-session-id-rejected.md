---
status: fixing
kind: rca
trigger: "mcp-shim-preseeded-session-id-rejected"
issue_id: ""
severity: medium
surfaces: [cli]
brain_mode: full-loop
canon_parts: [9]
created: 2026-09-24T07:43:32Z
updated: 2026-09-24T07:43:32Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED. With `MINDRIAN_MCP_FIRST` on (default OFF) and a hook-supplied `MINDRIAN_SESSION_ID` (the normal hook case), `bin/mindrian-mcp-shim.cjs:63-68` pre-seeds `clientOpts.sessionId` with that id, so the client sends `mcp-session-id: <hook id>` on its very first request. The daemon's flag-ON route (`bin/mindrian-mcp-server.cjs:338-352`) answers ANY header session id it did not mint itself (via its own `randomUUID()` `sessionIdGenerator`) with `400 Bad Request: No valid session ID provided`. The shim's own comment ("the daemon's session-registry accepts a caller-supplied id") describes a D-02 one-namespace binding the transport layer never actually implemented.
test: Live hermetic run of the shim with and without `MINDRIAN_SESSION_ID` set, each connecting through `ensureDaemon()` to a freshly-spawned daemon.
expecting: (met) WITH the hook session id: every POST gets 400, the shim never delivers a successful `initialize` response to its own stdout. WITHOUT it: the shim connects and delivers a successful `initialize` response (unbound session).
next_action: NONE for this plan (267-02 is RCA-filing only, no code change). Fix is PENDING a navigator decision (design (a) vs (b) below) -- out of Phase 267 scope by `267-CONTEXT.md`'s ruling that re-architecting room-binding identity is not this phase's work.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 2.0.0-beta.48
- Reported by: 267-RESEARCH.md's icm-architect consult (2026-09-23), re-reproduced live during 267-02 plan execution (2026-09-24)
- Date first observed: 2026-09-23 (267-RESEARCH.md, icm-architect consult section: "the shim's own comment ... describes a D-02 one-namespace binding the transport layer never implemented"); re-reproduced live 2026-09-24 during this RCA-filing plan
- Related debug sessions: none

### Source-of-Truth Preamble

- **CODE claims read against:** `origin/main` HEAD @ `782ecc4662edab1b0901788250ba9ed0ff1992f4` (PLAN_BASE for 267-02)
- **WIRE claims probe against:** a hermetic rooms home, `bin/mindrian-mcp-shim.cjs` spawned directly (which itself spawns the daemon, `bin/mindrian-mcp-server.cjs`, via `ensureDaemon()`), on this same tree
- **Date of audit:** 2026-09-24
- **Re-verification rule:** any source-code claim below MUST be re-verified against `origin/main` HEAD before it lands as a finding; otherwise the finding is provisional and tagged `needs-source-reverify`.

## Problem Statement

`MINDRIAN_MCP_FIRST` is default OFF, so this affects only opted-in flag-ON installs. When it IS on, the stdio-to-daemon shim (`bin/mindrian-mcp-shim.cjs`) pre-seeds the hook-supplied `MINDRIAN_SESSION_ID` as its connection's session id, but the daemon's session-registry rejects any caller-supplied id it did not itself mint, so the documented "hook id binds the daemon connection" (D-02) never actually works -- only the unbound (no hook id) path connects.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: When a hook sets `MINDRIAN_SESSION_ID` and `MINDRIAN_MCP_FIRST` is on, the shim's daemon connection binds to that exact session id (D-02, "one namespace, never a second"), so the CLI session and its daemon connection resolve to ONE binding.
actual: The shim's very first POST (the `initialize` request, carrying `mcp-session-id: <hook id>` because the client pre-seeded it) is rejected by the daemon with HTTP 400 `Bad Request: No valid session ID provided`. The shim never completes a connection; its stdout never delivers any response to the calling stdio client. Without `MINDRIAN_SESSION_ID` set, the identical flow succeeds (the daemon mints its own `randomUUID()` session, unbound to any hook-supplied identity).
errors: `[mindrian-mcp-shim] upstream error: Streamable HTTP error: Error POSTing to endpoint: {"jsonrpc":"2.0","error":{"code":-32000,"message":"Bad Request: No valid session ID provided"},"id":null}` (verbatim, live-captured) on every POST when `MINDRIAN_SESSION_ID` is set.
reproduction:
  1. In a hermetic rooms home, spawn `bin/mindrian-mcp-shim.cjs` with `MINDRIAN_MCP_FIRST=cli` and `MINDRIAN_SESSION_ID=<test id>` set (the shim spawns the daemon itself via `ensureDaemon()`).
  2. Send a raw 2025-11-25 `initialize` request on the shim's stdin.
  3. Observe: the shim's stderr repeats the 400 `Bad Request` error; its stdout never delivers a response.
  4. Repeat without `MINDRIAN_SESSION_ID` set.
  5. Observe: the shim connects (`connected to daemon at 127.0.0.1:<port> (unbound)`) and its stdout delivers a full, successful `initialize` response.
  6. SIGKILL the daemon PID read from the hermetic pidfile after each case.
started: Present since the shim's pre-seeding logic (`clientOpts.sessionId = hookSessionId`) and the daemon's caller-supplied-id-rejection logic were both written; neither side was ever updated to match the other. Not introduced by Phase 267. Named as a finding by the icm-architect consult during Phase 267's research pass (2026-09-23), because the navigator specifically asked how room binding survives a protocol era with no `Mcp-Session-Id`.

## Scope and Impact

- Affected surfaces: cli (`MINDRIAN_MCP_FIRST` is a per-surface flag; this RCA's reproduction used `cli`, the flag-ON daemon path's primary named use case per `267-CONTEXT.md`'s "Flag-ON daemon path stays sessionful" ruling).
- Affected commands: every tool call routed through the shim while `MINDRIAN_MCP_FIRST` is on for the caller's surface AND a hook has set `MINDRIAN_SESSION_ID` -- which is the shim's documented NORMAL case, not an edge case (see Impact line below).
- Affected users: only installs that have explicitly turned `MINDRIAN_MCP_FIRST` on (default OFF, so zero installs are affected today without an explicit opt-in).
- Version range: present since the shim and the daemon's session-id-rejection logic were both written (Phase 198-family); not introduced by Phase 267.
- Severity: medium (the flag is default OFF, so the affected population is currently zero; the defect is that the ONE scenario this flag exists to serve -- hook-bound daemon sessions -- does not work, while the scenario it was not primarily built for -- unbound daemon connections -- does).
- Blast radius: isolated to `bin/mindrian-mcp-shim.cjs`'s session-id pre-seeding and `bin/mindrian-mcp-server.cjs`'s flag-ON `/mcp` route's caller-supplied-id rejection. No other file participates in this specific binding negotiation.

**Impact:** with MINDRIAN_MCP_FIRST on (default OFF), the NORMAL hook-driven path is the one that is broken: any hook that sets MINDRIAN_SESSION_ID (the expected, documented case) gets 400 on every request and never connects to the daemon. Only the UNBOUND case (no MINDRIAN_SESSION_ID) works today. This is not an edge case within the flag-ON path -- it is the main case. The flag being off by default is why this phase can defer the fix without shipping a fully broken feature, but a navigator who later turns the flag on for hook use should know the documented one-namespace binding does not exist yet.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: This is a v1-vs-v2 SDK protocol-era difference (the daemon rejects caller-supplied ids only under one era).
  evidence: The daemon's rejection logic (`bin/mindrian-mcp-server.cjs:341-352`) is this repo's own routing rule, unconditional on protocol era -- it checks `if (!sessionTransport) { if (headerSessionId) { ...400... } ... }` regardless of which `initialize` protocolVersion the request carries. This reproduction used a 2025-11-25 `initialize` (the shim's own default, matching what a real hook-driven CLI session sends today) and observed the rejection; the rejection is present on the currently-installed v1 SDK and is not an SDK-version-dependent code path.
  timestamp: 2026-09-24T07:43:32Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-09-24T07:50:00Z
  checked: live run, `bin/mindrian-mcp-shim.cjs` spawned in a hermetic rooms home, `MINDRIAN_MCP_FIRST=cli`, `MINDRIAN_SESSION_ID=test-hook-session-rca7` set, a raw 2025-11-25 `initialize` sent on stdin
  found: |
    stdout: EMPTY (`""`) -- no response ever delivered to the calling client.
    stderr:
    `[mindrian-mcp-shim] connected to daemon at 127.0.0.1:3847 (session test-hook-session-rca7)`
    `[mindrian-mcp-shim] upstream error: Streamable HTTP error: Error POSTing to endpoint: {"jsonrpc":"2.0","error":{"code":-32000,"message":"Bad Request: No valid session ID provided"},"id":null}`
    `[mindrian-mcp-shim] upstream send failed: Streamable HTTP error: Error POSTing to endpoint: {"jsonrpc":"2.0","error":{"code":-32000,"message":"Bad Request: No valid session ID provided"},"id":null}`
  implication: Confirms the Symptoms exactly for the WITH-`MINDRIAN_SESSION_ID` case -- the daemon rejects the pre-seeded hook id on the very first POST, and the shim's stdio client (a real Claude Code session, in production) receives nothing back at all.

- timestamp: 2026-09-24T07:51:00Z
  checked: live run, identical setup, `MINDRIAN_SESSION_ID` deliberately unset (a fresh daemon spawned after killing the case-A daemon by its recorded pidfile pid)
  found: |
    stdout: a complete, successful JSON-RPC `initialize` response (`{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-11-25","capabilities":{...},"serverInfo":{"name":"mindrian-os","version":"2.0.0-beta.48"},"instructions":"..."}}`).
    stderr: `[mindrian-mcp-shim] connected to daemon at 127.0.0.1:3847 (unbound)`
  implication: Confirms the Symptoms exactly for the WITHOUT-`MINDRIAN_SESSION_ID` case -- the identical shim-to-daemon flow succeeds when no hook id is pre-seeded, because the daemon then mints its OWN `sessionIdGenerator: () => randomUUID()` session rather than being asked to recognize a caller-supplied one.

- timestamp: 2026-09-24T07:43:32Z
  checked: `bin/mindrian-mcp-shim.cjs:41-68`, function `main`
  found: |
    ```js
    const hookSessionId = process.env.MINDRIAN_SESSION_ID;
    ...
    const clientOpts = {};
    if (typeof hookSessionId === 'string' && hookSessionId.length > 0) {
      // Pass the hook-derived sessionId through verbatim as the connection key
      // (D-02): the daemon's session-registry accepts a caller-supplied id at
      // this same string, so the CLI session and its daemon connection resolve
      // to ONE binding, never a second namespace.
      clientOpts.sessionId = hookSessionId;
    }
    const upstream = new StreamableHTTPClientTransport(url, clientOpts);
    ```
  implication: The shim's own comment ASSERTS the daemon's session-registry accepts a caller-supplied id at this string. The next Evidence entry shows the daemon does the opposite.

- timestamp: 2026-09-24T07:43:32Z
  checked: `bin/mindrian-mcp-server.cjs:338-363`, the flag-ON `/mcp` route
  found: |
    ```js
    const headerSessionId = req.headers['mcp-session-id'];
    let sessionTransport = headerSessionId ? sessionTransports.get(headerSessionId) : undefined;

    if (!sessionTransport) {
      if (headerSessionId) {
        // A session id was supplied but this daemon does not recognize it
        // (stale id, or the daemon restarted) -- report it rather than
        // silently minting a new session under the caller's requested id.
        res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
          id: null,
        });
        return;
      }
      sessionTransport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        ...
      });
      ...
    }
    ```
  implication: The daemon's `sessionTransports` map is keyed ONLY by ids it minted itself via `randomUUID()` inside `onsessioninitialized`. A caller-supplied id (the shim's pre-seeded `mcp-session-id` header) can never already be a key in that map on the FIRST request of a new connection -- `sessionTransports.get(headerSessionId)` is always a miss, so the `if (headerSessionId)` branch always fires and always returns 400. There is no code path anywhere in this file that adopts a caller-supplied id as a new session's key. The claimed D-02 one-namespace binding was never implemented at the transport layer -- only asserted in the shim's own comment.

## Technical Root Cause

- Site: `bin/mindrian-mcp-shim.cjs:63-68` (pre-seeding) paired with `bin/mindrian-mcp-server.cjs:341-352` (rejection), function `main` in the shim and the anonymous `/mcp` route handler in the server.
- Cause: the shim sends a caller-chosen `mcp-session-id` header on its first request (before any session exists), intending it to become that connection's session id. The daemon's session-registry (`sessionTransports`, a `Map` keyed by ids the daemon itself mints via `randomUUID()` inside `sessionIdGenerator`) has no code path that adopts an unrecognized caller-supplied id as a NEW session key -- it only ever recognizes ids it minted itself and returns 400 for anything else, treating an unrecognized header id as "stale, or the daemon restarted" (a reasonable assumption for a RETURNING session, but the shim's usage sends the hook id on a BRAND NEW connection, where it can never already be a valid key).
- Why it surfaces now: the mismatch between the shim's stated intent (a comment asserting one-namespace binding) and the daemon's actual transport-layer behavior (never implemented) was surfaced by the icm-architect consult during Phase 267's research pass, specifically because the navigator asked how room binding should work under a protocol era with no `Mcp-Session-Id`, which required actually reading both sides of this handshake together for the first time.

## Required Code Changes
<!-- Explicit, imperative, one block per change -->

- Change 1 (two candidate designs, stated neutrally for the navigator -- neither is chosen by this RCA):
  - Location: (a) `bin/mindrian-mcp-server.cjs:341-363`, the flag-ON `/mcp` route's `sessionIdGenerator` and the `if (headerSessionId)` rejection branch; OR (b) `bin/mindrian-mcp-shim.cjs:41-68`, the pre-seeding logic itself.
  - Current behavior: the daemon rejects any caller-supplied session id it did not mint; the shim unconditionally pre-seeds the hook id as that connection's `sessionId`.
  - Required behavior, design (a): the daemon ADOPTS a validated caller-supplied id as the session id of a NEW session -- `sessionIdGenerator` returns the header value when it passes `lib/core/session-binding.cjs`'s `isSafeSlug` validation (or an equivalent format check), instead of always minting a fresh `randomUUID()`. This is the smaller, transport-only change.
  - Required behavior, design (b): the shim STOPS pre-seeding `clientOpts.sessionId` and instead carries the hook id per request as an explicit handle (the icm-architect's ICM-native direction from 267-RESEARCH.md: a reverse-DNS custom `_meta` key such as `io.mindrian/sessionId`, or the existing explicit `room`/`sessionId` tool args, resolved against the same session file at `$MINDRIAN_ROOMS_HOME/.rooms/sessions/<sessionId>.json`). This is the larger, room-binding-identity-model change that `267-CONTEXT.md` explicitly rules out of Phase 267's scope.
  - Short-term patch: not applicable -- both candidate designs are themselves the fix; there is no smaller interim patch that does not commit to one of the two identity models.
  - Long-term fix: whichever design the navigator approves; design (b) is the ICM-native direction per the icm-architect consult, but design (a) is flagged as a smaller fast-follow candidate the navigator MAY want to approve on its own, separately from any broader identity-model work (see Resolution.fix below).
- Owning plan: PENDING a navigator decision (out of Phase 267 scope by `267-CONTEXT.md`'s ruling: "do not re-architect room binding in this phase"); pinned by 267-15 (`tests/test-267-mcpv2-clients.cjs`); seeded by 267-18 as a follow-up for the navigator to pick up.

## Tests to Add or Update

- Test 1:
  - Type: integration
  - Location: `tests/test-267-mcpv2-clients.cjs` (267-15 to create; this RCA is pinned there per the artifact table)
  - Given: a hermetic rooms home, `MINDRIAN_MCP_FIRST=cli`, `MINDRIAN_SESSION_ID` set
  - When: the shim connects to the daemon
  - Then: (PENDING the navigator's design choice) the connection succeeds and the daemon's session-registry key matches the hook-supplied id -- this test currently documents the BROKEN behavior (a 400 on every POST) until a design is approved and 267-15 implements it
  - Runner registration: add to `tests/run-all-267.sh`'s pre-declared MCPV2 leg list

## Non-Code Follow-ups
<!-- The release and canon obligations a code fix alone does not satisfy -->

- CHANGELOG.md: no entry yet -- this RCA stays open pending a navigator decision; a CHANGELOG entry is written only once a design is approved and implemented.
- Release lockstep: not applicable until a fix ships; see `.claude/includes/release-process.md` and `docs/RELEASE-CEREMONY-RULING-SYSTEM.md` RULE 5 for when it does.
- Canon: any eventual fix that changes the room-binding identity model (design (b)) touches Part 9 (Memory Locality, the session file's role as the local state machine) and would need a `docs/CANON-PHASE-MAP.md` update at that time. Design (a) is transport-only and would not need one.
- knowledge-base.md: on resolve (whenever the navigator's chosen design ships), add the summary block per `docs/RCA-TEMPLATE.md` section 1.
- Docs / monitoring / process notes: 267-18 seeds this as a fast-follow candidate for the navigator; whoever picks it up should re-read this RCA's live Evidence (both cases) before choosing between design (a) and (b), since the evidence here is what makes design (a)'s smaller footprint concrete.
- **MindrianOS gate answers (docs/RCA-TEMPLATE.md section 5):**
  1. Canon Part 8 (Graph Boundary): no Brain wire involved. This is a local daemon-to-shim session-binding negotiation entirely within `$MINDRIAN_ROOMS_HOME`; zero `brain_*` calls, zero Brain egress.
  2. Tri-Polar: affects cli only today (the flag-ON daemon path's primary named surface). `MINDRIAN_MCP_FIRST` is a per-surface flag, so `desktop`/`cowork` could independently opt in, but this RCA's reproduction and the flag's default-OFF status mean no surface is affected without an explicit opt-in.
  3. Cross-platform: the pre-seeding/rejection logic is pure in-process JS/HTTP header handling; no process-spawning or path/shell surface. Correct on Windows/Mac/Linux by construction, independent of which design is eventually chosen.
  4. Release lockstep: not applicable until a fix ships (see above).
  5. No em-dashes: this file uses hyphens only throughout.
  6. Reuse before build (Part 7): design (a) reuses `lib/core/session-binding.cjs`'s existing `isSafeSlug`-style validation rather than inventing a new id-format check; design (b) reuses the EXISTING session-file store and the EXISTING explicit `room`/`sessionId` tool args rather than inventing a new persistence or handle mechanism. Neither candidate design proposes new infrastructure.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: CONFIRMED -- see Technical Root Cause above.
fix: PENDING - navigator decision (out of Phase 267 scope by CTX ruling; pinned by 267-15 tests/test-267-mcpv2-clients.cjs; seeded by 267-18; design (a) -- daemon adopts a validated caller-supplied id -- is the smaller, transport-only change and is flagged in 267-18's seed as a fast-follow candidate the navigator may want to approve on its own, separately from any broader identity-model work)
verification: PENDING
files_changed: []
commits: PENDING
