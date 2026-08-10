# Phase 248: MCP-First Room Resolution - Research

**Researched:** 2026-08-10
**Domain:** MCP session-scoped room resolution (lib/mcp resolver collapse, room_bind honesty contract)
**Confidence:** HIGH (all findings verified by direct source read of local HEAD this session)

## Summary

Phase 248 closes the read-side half of a gap whose write half Phase 234-05 already closed. `room_bind` writes a session-scoped binding to `$MINDRIAN_ROOMS_HOME/.rooms/sessions/<sessionId>.json` (via `lib/core/session-binding.cjs::writeSessionBinding`), but every MCP read tool resolves its room through an independent copy of a gate-then-fallthrough ladder that only consults that binding when `isMcpFirst(surface)` is true - and `MINDRIAN_MCP_FIRST` is unset on every install today. Reads therefore fall through to the machine-wide `resolveActiveRoom()` registry pointer and then to a boot-time-frozen `fallbackRoomDir` closure, neither of which `room_bind` can influence, while `room_bind` still returns an unqualified `{ok:true, bound:true}`.

**Census correction (new finding, HIGH confidence):** the carried defect and ROADMAP both say "eight resolver copies." A fresh function-definition census this session finds **NINE** independent copies inside `lib/mcp/`: the seven `lib/mcp/tools/*.cjs` copies, `tool-router.cjs::resolveWriteTargetDir`, **plus `lib/mcp/stop-gate-handler.cjs:78-91`**, which the RCA's `fallbackRoomDir` grep missed because that variant floors to `null` instead of `ctx.fallbackRoomDir`. Note also that `lib/mcp/tools/stop-gate.cjs` (named in the eight-file list) has NO copy - it delegates to `stop-gate-handler.cjs`, which has the missed one. Plans must use this nine-copy census, and CTX-01's call-site census gate must count function definitions, not the `fallbackRoomDir` token.

The good news: the correct precedence already ships. `lib/core/resolve-active-room.cjs::resolveSessionRoom` (Leg A session.primary via `registryRoomPath`, Leg B demoted reg.active, never-throw) is exactly the ladder the read path needs, and the hook-side consumer (`scripts/intent-classifier.cjs:950`) already composes it correctly. The structural fix is therefore small: one shared `lib/mcp/` resolver module that calls `resolveSessionRoom` UNCONDITIONALLY (no `isMcpFirst` gate on the binding read - that gate IS the bug), floors to the boot-time fallback, and returns a structured `{dir, slug, source}` so `room_bind` can re-resolve after writing and report honestly whether the binding will actually apply.

**Primary recommendation:** create ONE shared resolver module in `lib/mcp/` (peer of `mcp-first-flag.cjs`, NOT under `tools/`), route all nine copies through it, make the session-binding read unconditional, have `room_bind` round-trip through the same resolver to compute an `effective` field, and add a rar.11-style source-grep tripwire test that turns red if a tenth copy ever appears.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CTX-01 | ONE shared room-resolution ladder replaces the independent gate-then-fallthrough resolver copies, following the resolve-active-room.cjs precedent and the isWritePathEnabled precedence ladder | Nine-copy census below with exact file/line/variant map; shared-resolver design (module location, signature, precedence); red-able census gate design mirroring rar.11 tripwires + seam-liveness discipline |
| CTX-02 | An explicit room_bind is authoritative for the rest of its session regardless of flag state, and returns an honest result about whether it will apply | Session-binding storage map; root-cause of read invisibility; minimal change (unconditional resolveSessionRoom); honest-return design incl. the room-not-on-disk edge the current code lies about |
| CTX-03 | The carried defect closes with a live before/after on all three surfaces (CLI, Desktop, Cowork) | Reconstructed RCA verification recipe extended per Tri-Polar, with per-surface transport/session-id mechanics and the release-liveness rule |
</phase_requirements>

## Project Constraints (from CLAUDE.md and navigator rulings)

- **Workspace guard:** all work in `/home/jsagi/dev/MindrianOS-Plugin/`, never the plugin install cache.
- **GSD workflow enforcement:** edits go through GSD commands; this phase is planned work under `/gsd-execute-phase`.
- **No em-dashes anywhere.** CJS only, no TypeScript. Bash scripts stay authoritative; CJS wraps them.
- **Canon Part 7 (reuse before build):** the ladder already exists in `resolveSessionRoom`/`resolveWriteRoom`; do not mint a new precedence. Canon Part 8: resolution reads LOCAL files + env only, zero Brain/network egress (rar.11 tripwire enforces). Canon Part 9: resolver never opens room.db (rar.12 tripwire). Canon Part 11 (CIRS): any response-shape change to `room_bind` must stay consistent with its born-wired connector + F.8 HITL declaration at `tool-router.cjs:1840-1848`.
- **Tri-Polar rule:** CTX-03 explicitly demands all three surfaces; a skipped surface is a stated call, not an oversight.
- **Release liveness (HARD RULE, personal memory):** a `main` commit is NOT live until a release ships AND is picked up; a running session never hot-reloads. CTX-03's "after" leg must fire against a freshly started server from the fixed code (dev repo direct or a cut v2.0.0-beta), never against a long-lived session assumed to have picked it up.
- **Release train:** v2.0.0 work releases as `v2.0.0-beta.N` only after Gate 0 (v1.15.x finalize) and Gate 1 (v1.16.0 disposition). Phase 248 code can merge before that; its release-dependent verification leg waits on the train.
- **Navigator rulings (locked scope):** the v1.17.0 "MCP-First" slot is absorbed into Phase 248 (2026-08-10 ruling); the resolver collapse follows the `resolve-active-room.cjs` precedent and the `isWritePathEnabled` precedence ladder shape; Phase 237 already took ONLY the session-scoping acceptance test - the structural work is entirely here.
- **Dev-research compositing:** findings mirror to `~/MindrianRooms/rethinking-mindrianos/research/` (the 2026-07-28 room-bind entry already exists there and predates the split routing; update it when this phase lands).
- **Model rule:** planning/research on fable, execution on sonnet (config.json `_models_note`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Session binding storage (write + read) | lib/core (session-binding.cjs) | - | Already the ONE binding store; atomic tmp+fsync+rename; do not touch |
| Room precedence ladder (session.primary -> reg.active -> miss) | lib/core (resolve-active-room.cjs) | - | Already the ONE chokepoint (resolveSessionRoom / resolveWriteRoom); Phase 248 adds no new precedence here |
| MCP-flag + host-tier gating | lib/mcp (mcp-first-flag.cjs, surface-detect.cjs) | - | isMcpFirst / isWritePathEnabled / detectHostTier live here; core must never depend on mcp |
| **The shared MCP resolver (NEW)** | **lib/mcp (new peer module)** | consumed by tools/*, tool-router, stop-gate-handler | Needs both core ladder AND mcp flag/fallback context; tools/ modules may require lib/mcp parent-level modules (precedent: every copy already requires `../mcp-first-flag.cjs`) but never each other |
| room_bind handler + honest return | lib/mcp/tool-router.cjs:1643-1700 | session-binding.cjs (write), shared resolver (round-trip read) | The binding front door; F.8 connector descriptor must stay consistent |
| Census gate (no tenth copy) | tests/ (source-grep tripwire) | scripts (optional doctor check) | Mirrors tests/test-resolve-active-room-canonical.cjs rar.11/rar.12 discipline |

## Standard Stack

### Core

No new dependencies. This phase is pure refactor + contract work inside the existing stack.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-ins (fs, path, os, assert) | Node >= 22.16.0 (repo floor) | Resolver, tests | Existing repo convention [VERIFIED: package.json engines via CLAUDE.md] |
| @modelcontextprotocol/sdk | ^1.29.0 (already vendored) | MCP server, `extra.sessionId` | Already shipped; untouched by this phase [CITED: CLAUDE.md tech stack] |
| zod | ^3.25.76 (already vendored) | room_bind schema (unchanged shape, new response fields only) | Already shipped [CITED: CLAUDE.md tech stack] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `lib/mcp/session-room.cjs` module | Extend `mcp-first-flag.cjs` | Flag module's header declares itself "the ONE flag reader" - stuffing a resolver in muddies that contract; a peer module keeps both single-purpose |
| New `lib/mcp/session-room.cjs` module | New export on `lib/core/resolve-active-room.cjs` | Would force core to import `isMcpFirst`/fallback semantics from lib/mcp - layering inversion; core stays MCP-agnostic |
| Structural collapse | RCA's short-term patch (room_bind write-through to global registry `active`) | Write-through reintroduces the machine-wide race the concurrent-session-collision RCA fought; rejected - see Pitfall 6 |

**Installation:** none.

## Package Legitimacy Audit

Not applicable - this phase installs zero external packages. All work is refactoring of existing first-party CJS modules. (slopcheck not run; nothing to check.)

## CTX-01: The Nine-Copy Census (verified 2026-08-10, local HEAD)

Every copy runs the identical fallthrough order: **(1)** `if (isMcpFirst(surface))` try `resolveWriteRoom({sessionId, home: MINDRIAN_ROOMS_HOME})`, return `abs_path` on hit; **(2)** `resolveActiveRoom()` global registry pointer, return `abs_path` on hit; **(3)** floor. Variants differ only in the floor and side effects:

| # | File | Lines | Function | Floor | Variant delta |
|---|------|-------|----------|-------|---------------|
| 1 | lib/mcp/tools/room.cjs | 47-60 | resolveSessionRoomDir | `ctx.fallbackRoomDir \|\| process.cwd()` | none (canonical shape) |
| 2 | lib/mcp/tools/gate.cjs | 56-69 | resolveSessionRoomDir | same | none |
| 3 | lib/mcp/tools/sensors.cjs | 58-71 | resolveSessionRoomDir | same | none (the RCA's original cited site) |
| 4 | lib/mcp/tools/status.cjs | 71-84 | resolveSessionRoomDir | same | none |
| 5 | lib/mcp/tools/graph.cjs | 112-125 | resolveSessionRoomDir | same | none |
| 6 | lib/mcp/tools/views.cjs | 102-115 | resolveSessionRoomDir | same | none |
| 7 | lib/mcp/tools/chain.cjs | 126-139 | resolveSessionRoomDir | same | none |
| 8 | lib/mcp/tool-router.cjs | 116-136 | **resolveWriteTargetDir** | `fallbackRoomDir` param | Signature `(sessionId, fallbackRoomDir, surface)`; on flag-ON + `source === 'reg.active'` writes the `MCP_FIRST_DEPRECATED_ACTIVE_WRITE` stderr token (grepped verbatim by 198-02 acceptance - preserve it); serves BOTH writes (room_content) AND reads (room_state's 5 branches, via line 693) |
| 9 | lib/mcp/stop-gate-handler.cjs | 78-91 | resolveSessionRoomDir | **`null`** (no fallback) | Defaults `surface` to `'cli'` when ctx omits it; **missed by the RCA's `fallbackRoomDir` grep - this is why "eight" is stale** |

**Not copies (do not touch as part of the collapse):**
- `lib/mcp/tools/stop-gate.cjs` - named in the eight-file list but has NO resolver; delegates to stop-gate-handler.cjs (which has copy #9).
- `scripts/intent-classifier.cjs:950` - same function name, but it already composes the core chokepoint (`resolveSessionRoom`) with the `requireOwnership` option. It is the GOOD pattern, hook-side, out of scope. The census gate must whitelist it or scope to `lib/mcp/`.
- `room_state_bound` (`lib/mcp/tools/room.cjs:239-258`) - the RCA's "ninth site" is a CALL site of copy #1, not a tenth function. Confirmed live-reproduced against it 2026-07-29 (two binds, read stuck on the first bind's remnant).

**Call-site counts (what re-routes):** room.cjs x2 (245, 271), sensors.cjs x5 (197, 225, 248, 281, 315), graph.cjs x3 (216, 250, 285), gate.cjs x1 (232), status.cjs x1 (165), views.cjs x2 (236, 260), chain.cjs x1 (452), stop-gate-handler.cjs x1 (452), tool-router.cjs resolveWriteTargetDir x5 (line 693 room_state reads; 801, 823, 840 room_content writes; plus any later additions - re-grep at plan time). Several modules export the copy via `_internal`/`module.exports` for tests (room, sensors, gate, status, graph, views, stop-gate-handler) - those test seams must be re-pointed, not deleted.

### The ONE Shared Resolver - Recommended Design

**Location:** new `lib/mcp/session-room.cjs` (peer of mcp-first-flag.cjs). The disjoint-file contract in `register-core-tools.cjs` forbids tools/ modules requiring EACH OTHER; requiring a lib/mcp parent-level module is the established pattern (every copy already requires `../mcp-first-flag.cjs`; views.cjs and room.cjs even require `../tool-router.cjs`'s `_test` export). [VERIFIED: source read]

**Signature (structured return is load-bearing for CTX-02's honesty):**

```js
// lib/mcp/session-room.cjs (new)
// resolveSessionRoom({ sessionId, ctx, forWrite }) ->
//   { dir: string|null, slug: string|null, source: string }
// source: 'session.primary' | 'room-root' (forWrite only) | 'reg.active'
//         | 'boot-fallback' | 'cwd'
// Never throws. dir is null ONLY when ctx.fallbackRoomDir is absent AND
// cwd flooring is disabled (the stop-gate-handler null-floor compat option).
function resolveMcpSessionRoom(opts) { /* ... */ }

// Back-compat string wrapper, drop-in for the nine copies:
function resolveSessionRoomDir(sessionId, ctx) {
  const r = resolveMcpSessionRoom({ sessionId, ctx });
  return r.dir; // floored exactly as today
}
```

**Precedence (the CTX-02 fix is rung 1 being unconditional):**

1. **Explicit session binding always wins, flag-independent.** Call core `resolveSessionRoom({sessionId, home: process.env.MINDRIAN_ROOMS_HOME})` (lib/core/resolve-active-room.cjs:481) UNCONDITIONALLY. Its Leg A reads session.primary and resolves through `registryRoomPath` (sub-room-safe, exists-on-disk gated); its Leg B is the demoted reg.active. This one call replaces both the flag-gated branch AND the global fallthrough of every copy, because Leg B IS `resolveActiveRoom()`. For a binding-less session the result is byte-identical to today's flag-off behavior (Leg A misses, Leg B hits reg.active) - the delta is ONLY that a bound session is finally honored.
2. **forWrite: leg 1 room-root.** `resolveWriteTargetDir`'s replacement passes `forWrite: true`, which routes through core `resolveWriteRoom` instead (adds the `.room-root` cwd walk-up as leg 1, which must NOT leak into pure reads - the exact reason core resolveSessionRoom exists, per its own header). Preserve the `MCP_FIRST_DEPRECATED_ACTIVE_WRITE` stderr log when source is `reg.active` (keep the token byte-identical; a rename breaks the 198-02 acceptance grep).
3. **Floor:** `ctx.fallbackRoomDir || process.cwd()` (source `'boot-fallback'`/`'cwd'`), or `null` when the caller opts out of flooring (stop-gate-handler compat).
4. **Staleness guards already inside the core ladder:** `registryRoomPath`/`resolveActiveRoom` gate on `fs.existsSync` (a registry pointing at a deleted dir returns null) and honor sealed/archived marks. The foreign-live ownership decline (`resolveActiveOwnership`, `requireOwnership: true`) stays OPT-IN OFF for this phase - see Open Question 1.

**Where isMcpFirst survives:** nowhere on the room-resolution path. After the collapse the flag's remaining consumers are daemon lifecycle / registration surfaces (bin/mindrian-mcp-server.cjs, stop_gate registration) - that is the "roomResolutionMode helper both halves share" question the RCA raised, resolved by making the read path flag-free rather than adding a third gate. `isWritePathEnabled` (write PERMISSION) is untouched and orthogonal: it answers "may this call write", not "which room". The ladder-shape precedent from `isWritePathEnabled` that DOES carry over: explicit signal wins (here: the session binding), confident detection next (here: reg.active with its existing liveness/staleness guards), floor to a safe default, never throw, a gate-reader failure never flips capability.

**The red-able census gate (Success Criterion 1's "reintroducing a copy turns a gate red"):**
- A source-grep tripwire test (precedent: `tests/test-resolve-active-room-canonical.cjs` rar.11/rar.12) that greps `lib/mcp/` recursively (excluding `tests/`) for `function resolveSessionRoomDir` and asserts it appears ONLY in `lib/mcp/session-room.cjs`, and that no file under `lib/mcp/` except session-room.cjs contains the `isMcpFirst(` + `resolveWriteRoom(`/`resolveActiveRoom(` gate-then-fallthrough pair on executable lines (use the comment-stripping helper pattern from `tests/test-224-resolver-fallback.cjs`).
- Optionally register the census as a `seam-liveness.cjs` claim set (Phase 235-02 helper, `lib/core/seam-liveness.cjs`): claims = the nine former call-site files, isLive = "requires session-room.cjs". The helper's discipline (no override parameter, a throwing probe counts as dead) fits; the plain source-grep is simpler and sufficient - use seam-liveness only if the planner wants the doctor/--acceptance roll-up integration `scripts/check-brain-tool-liveness.cjs` demonstrates.

## CTX-02: Session Binding State and the Honest room_bind

**Where the binding lives [VERIFIED: source read]:**
- Store: `$MINDRIAN_ROOMS_HOME/.rooms/sessions/<sessionId>.json`, schema `{bound: [], primary, sticky, updated}`, written atomically (tmp + fsync + rename), by `lib/core/session-binding.cjs::writeSessionBinding` (lines 143-206).
- Writer: `room_bind` handler at `lib/mcp/tool-router.cjs:1643-1700`. Session id via `resolveEffectiveSessionId(explicit, extra)` = explicit param > SDK `extra.sessionId` (http transports) > `process.env.CLAUDE_CODE_SESSION_ID` (stdio/CLI) > null (session-binding.cjs:139-141; the 0bec81b9 fix that made the write leg reachable on stdio).
- Reader that works: core `resolveSessionRoom` Leg A (`readSessionBinding` -> primary -> `registryRoomPath`).

**Why reads cannot see it today:** every MCP read tool's copy only reaches `resolveWriteRoom` (the sole path into `readSessionBinding`) inside `if (isMcpFirst(ctx.surface))`, and `MINDRIAN_MCP_FIRST` unset returns false for every surface by design (D-07 byte-identical-legacy, mcp-first-flag.cjs:41-52). The binding write succeeds and is simply never read. Confirmed live twice (2026-07-28 sensors path, 2026-07-29 room_state_bound two-bind repro). [CITED: .planning/debug/room-bind-mcp-first-off-falls-back-to-stale-global-active-room.md]

**Minimal change making the bind authoritative:** rung 1 above - the shared resolver calls core `resolveSessionRoom` unconditionally. No change to the binding store, the writer, or core precedence. Session isolation across concurrent sessions is free: the binding file is keyed by sessionId, and Leg A outranks Leg B per session.

**The honest room_bind return.** Current handler returns `{ok:true, bound:true, primary, source:'explicit'|'cwd'}` unconditionally after `writeSessionBinding` (which is itself fire-and-forget and can silently no-op on an unsafe slug or fs failure). Honest design: after writing, **round-trip through the shared resolver with the same sessionId** and report what a subsequent read will actually see:

```js
// after writeSessionBinding(effectiveSessionId, {primary: room, bound: [room]}):
const check = resolveMcpSessionRoom({ sessionId: effectiveSessionId, ctx });
const effective = check.source === 'session.primary' && check.slug === room;
return { ok: true, bound: true, primary: room, source: 'explicit',
         effective,                    // will reads this session actually hit it?
         resolved_dir: check.dir,      // the dir reads will use
         resolved_source: check.source,
         reason: effective ? undefined
           : (/* e.g. */ 'room_not_on_disk') };
```

Edge the current code lies about even post-collapse: binding to a slug with no directory on disk. `writeSessionBinding` accepts any traversal-safe slug; `registryRoomPath`'s existsSync gate then fails Leg A and the read falls to reg.active - so today's `{ok:true, bound:true}` for a nonexistent room stays false without the round-trip. `effective:false, reason:'room_not_on_disk'` closes it. Success Criterion 2's bar ("the unqualified ok:true about an inert effect cannot be reproduced") is met exactly by this round-trip, and it doubles as the in-process seam-liveness proof (write end and read end verified against each other per call). Keep the `needs_binding_card` ambiguity branch and the F.8 connector descriptor (tool-router.cjs:1840-1848) unchanged - the new fields are additive, so the CIRS declaration needs no shape change, but verify with `node scripts/build-connector-registry.cjs --check`.

## CTX-03: Live Before/After Verification Recipe (all three surfaces)

Reconstructed from the RCA's own live probes (Evidence 03:40-03:55 + the 2026-07-29 two-bind repro), extended per Tri-Polar.

**Fixture (all surfaces):** `MINDRIAN_MCP_FIRST` unset; global registry `active` empty or pointed at a DIFFERENT real room than the bind target (`bash scripts/room-registry set-active <other>`); two real rooms on disk.

**The five-step probe sequence (identical on every surface):**
1. `room_bind({room: X})` - expect `ok:true`; AFTER: also `effective:true, resolved_dir` = X's path.
2. Read tool in the SAME session (`room_state_bound` is the cheapest; `suggest_next`/`reach_candidates` prove the sensor spine leg) - inspect `room_dir`.
3. BEFORE (defect): `room_dir` = stale global/boot fallback, not X. AFTER: `room_dir` = X's real path.
4. Re-bind: `room_bind({room: Y})`, then `room_state_bound` - AFTER must show Y (the 2026-07-29 first-bind-remnant repro is the regression case).
5. Unbound-session control: a FRESH session with no bind still resolves reg.active (byte-identical legacy for the never-bound user).

**Per-surface mechanics:**

| Surface | Transport | Session id source | How to drive it live |
|---------|-----------|-------------------|----------------------|
| CLI (project scope) | stdio | `CLAUDE_CODE_SESSION_ID` env (SDK never populates `extra.sessionId` on stdio - RCA-confirmed) | Real Claude Code CLI session against the dev-repo server (`.mcp.json` pointed at `bin/mindrian-mcp-server.cjs`), or scripted: spawn the server on stdio with `CLAUDE_CODE_SESSION_ID` set and drive raw JSON-RPC (precedent: tests/test-room-bind-stdio-session-fallback.cjs) |
| Desktop (plugin scope) | stdio (non-TTY child) | same stdio limitation -> env var; surface detected via `CLAUDE_SURFACE=desktop` or non-TTY+minimal-argv (surface-detect.cjs rung 4) | Real Claude Desktop against a released beta per the release-liveness rule; scripted equivalent: `CLAUDE_SURFACE=desktop` + non-TTY stdio spawn, same JSON-RPC sequence |
| Cowork / headless | Streamable HTTP (`MINDRIAN_TRANSPORT=http`) | SDK `extra.sessionId` per connection | Start the daemon http-side, open TWO concurrent sessions, bind each to a different room, prove each session's reads resolve its OWN binding (this leg also proves session isolation, which stdio single-session probes cannot) |

**Release-liveness discipline:** each "after" probe must run against a server process demonstrably started from the fixed code (fresh spawn from the dev repo, or a cut v2.0.0-beta verified installed) - never a pre-existing long-lived session. The RCA's own Source-of-Truth Preamble (code-vs-wire split) is the template for recording this in the close-out. On close: move the debug file to `.planning/debug/resolved/`, add the knowledge-base.md block, CHANGELOG Fixed entry, Canon Parts 9 + 11 note in docs/CANON-PHASE-MAP.md, and update the rethinking-mindrianos room-side entry (it still says Phase 237 owns the fix).

**Out-of-scope flag from the RCA (do NOT absorb):** the STATE.md null-bytes wrinkle (suspect: `state-ops.cjs:44` non-atomic `computeState` write racing the MINTO-regen pipeline) is UNCONFIRMED and earns its own debug file if it recurs. Phase 248 must not silently fold it in; at most note it if the CTX-03 probes trip it again.

## Existing Tests: What Holds, What Breaks, What's New

**Hold (core ladder untouched):** tests/test-resolve-write-room.test.cjs, test-cross-session-room-bleed.cjs, test-active-session-ownership.cjs, tests/test-resolve-active-room-canonical.cjs (rar.* tripwires), test-resolve-effective-session-id.cjs, test-226-session-binding-key-alignment.cjs, test-write-scope-sub-room-ancestor.cjs, the 237 session-scope suite (test-237-session-scope*.cjs - hook-side markers, different mechanism).

**Break BY DESIGN (re-point, never delete):**
- `tests/test-198-flag-off-parity.test.cjs` - asserts flag-off `resolveWriteTargetDir` "ignores sessionId entirely, byte-identical to pre-198." That contract is exactly what this phase repeals for BOUND sessions. Re-point: flag-off + UNBOUND stays byte-identical legacy; flag-off + bound now resolves the binding. This is the D-07/SPEC-7 doctrine amendment in miniature - the plan must state it explicitly, not slip it in.
- `tests/test-room-bind-stdio-session-fallback.cjs`, `test-room-bind-health-signal.cjs` - response-shape assertions gain the new `effective`/`resolved_dir` fields (additive, but exact-match asserts will trip).
- `tests/test-tool-router-active-room-misroute.cjs`, `test-room-state-active-room-misroute.cjs`, `test-room-state-no-registry-regression.cjs` - exercise `resolveWriteTargetDir` via `toolRouter._test`; keep the `_test` export delegating to the shared module so these keep running, then extend with a bound-session case.
- Per-module `_internal.resolveSessionRoomDir` test seams (room, sensors, gate, status, graph, views, stop-gate-handler) - keep the exports as thin delegates so existing consumers stay green, or re-point consumers to the shared module.

**New tests this phase owes (the RCA's Tests-to-Add + gates):**
1. `tests/test-248-room-bind-session-authoritative.cjs` - the RCA's Test 1: flag unset, registry stale/empty, bind X then read in-session -> room_dir is X (per copy family: one grouped-router read via `_test.resolveWriteTargetDir`, one tools/ read via `_internal`, plus a real two-call MCP sequence).
2. `tests/test-248-resolver-census.cjs` - the source-grep tripwire (red on a tenth copy).
3. `tests/test-248-room-bind-honest-return.cjs` - `effective:false, reason:'room_not_on_disk'` for a bind to a nonexistent room; `effective:true` for a real one; two-bind sequence shows the second bind.
4. Two-session isolation (http transport or direct module calls with two sessionIds) - each session reads its own binding.
5. `tests/run-all-248.sh` per repo convention.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Room precedence | A new ladder in the shared module | core `resolveSessionRoom` / `resolveWriteRoom` | SEED-034 four-guessers lesson; sub-room path derivation (`registryRoomPath`), exists-gates, sealed/archived handling already correct |
| Session id from MCP extra | Inline `extra.sessionId \|\|` chains | `resolveEffectiveSessionId` (session-binding.cjs:139) | Already the ONE copy for 20+ call sites |
| Binding persistence | Any new write path | `writeSessionBinding` as-is | Atomic, traversal-guarded (isSafeSlug, Security V5) |
| Stale-owner detection | pid/timestamp probes | `resolveActiveOwnership` (opt-in, already shipped) | Fail-open doctrine already argued and tested |
| Copy-reintroduction gate | Ad-hoc lint | rar.11-style source-grep test (+ optionally seam-liveness.cjs) | Established repo discipline; comment-stripping helper exists in test-224 |
| Host-tier detection | New client sniffing | `detectHostTier` (surface-detect.cjs) | 234-05 shipped it; read path likely needs none of it (see design), but if a rung wants it, it exists |

**Key insight:** every primitive this phase needs already ships and is tested; the phase's entire job is deleting eight of nine duplicates and un-gating one read.

## Common Pitfalls

1. **Counting eight when there are nine.** The `fallbackRoomDir` grep misses stop-gate-handler.cjs (floors to null). Success Criterion 1's census must count function definitions in `lib/mcp/` and whitelist `scripts/intent-classifier.cjs`. Warning sign: a plan whose task list touches exactly 8 files.
2. **Leaking resolveWriteRoom's leg 1 into reads.** `.room-root` cwd walk-up must stay write-only; a read resolver inheriting cwd silently outranks the explicit binding (the exact reason core resolveSessionRoom excludes it - its header says so).
3. **Breaking the byte-identical-legacy tests silently.** test-198-flag-off-parity WILL fail; the plan must name the doctrine change (bound sessions escape legacy parity; unbound sessions keep it) and re-point the test in the same commit.
4. **Losing the `MCP_FIRST_DEPRECATED_ACTIVE_WRITE` stderr token or the F.8 connector consistency.** Both are grepped by prior acceptance gates (198-02; build-connector-registry --check).
5. **tools/tools requires.** The shared module must live at lib/mcp parent level; a tools/ sibling import violates register-core-tools' disjoint-file seam. Also: register-core-tools' ctx carries NO sessionId by design (boot-time closure) - sessionId stays per-call via `extra`.
6. **The registry write-through temptation.** The RCA's short-term patch (room_bind also sets global `active`) would make one session's bind clobber every concurrent session's Leg B - reintroducing the collision class fixed by 0bec81b9/PSB. The structural fix makes it unnecessary; do not ship both.
7. **"Fixed" before released.** Four independent occurrences prove a main commit is inert in running sessions; CTX-03's after-leg needs a fresh server from fixed code and the close-out must record code-vs-wire per the RCA preamble.
8. **CLAUDE_ACTIVE_ROOM env override.** It outranks everything inside resolveActiveRoom (Leg B) but NOT the session binding (Leg A wins first). Hermetic tests must clear it (the flag-off parity test already demonstrates the leak).
9. **room_state reads ride resolveWriteTargetDir today** (tool-router.cjs:693). When splitting read/write paths, those 5 read branches should move to the read resolver (no leg 1) - and remember the 2026-07-11 positional-args regression on that exact call site (sessionId passed where fallback belonged); keep the options-object signature to make it unrepeatable.

## Architecture Patterns

### Data Flow (after collapse)

```
MCP tool call (any of 9 former sites)
  |            sessionId = resolveEffectiveSessionId(param, extra)   [unchanged]
  v
lib/mcp/session-room.cjs  resolveMcpSessionRoom({sessionId, ctx, forWrite})
  |
  |-- forWrite? --yes--> core resolveWriteRoom
  |                        leg1 .room-root walk-up -> leg2 session.primary -> leg3 reg.active
  |                        (+ MCP_FIRST_DEPRECATED_ACTIVE_WRITE log on reg.active)
  |-- no (reads) -------> core resolveSessionRoom
  |                        legA session.primary (readSessionBinding -> registryRoomPath,
  |                             exists-on-disk gated, sub-room safe)   <-- UNCONDITIONAL (the fix)
  |                        legB reg.active (resolveActiveRoom: env override, sealed/exists gates)
  v
  miss -> floor: ctx.fallbackRoomDir || process.cwd()   (or null, stop-gate-handler compat)
  return { dir, slug, source }

room_bind handler: writeSessionBinding(...) THEN resolveMcpSessionRoom(same sessionId)
  -> { ok, bound, primary, effective, resolved_dir, resolved_source, reason? }
```

### Anti-Patterns to Avoid
- **Gate-then-fallthrough copies** (the retired pattern): any `if (isMcpFirst(...)) {...} resolveActiveRoom()` pair outside session-room.cjs is a census-gate failure.
- **A second selection brain:** one resolver, structured source reporting, callers never re-derive precedence.

## State of the Art (repo-internal)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Four hook-side room guessers | core resolveActiveRoom chokepoint | Phase 127.3 | The precedent CTX-01 mirrors |
| reg.active as write authority | resolveWriteRoom 3-leg session precedence, reg.active demoted | Phase 194/198-02 (PSB-15) | The ladder rung 1 reuses |
| Registration-gated write tools (flag-off = invisible) | isWritePathEnabled: explicit flag > confident tier0 host > false; always-registered, handler-gated | Phase 234-05 | The precedence-ladder SHAPE this phase mirrors for reads |
| room_bind unreachable on stdio (no_session_id) | resolveEffectiveSessionId 3-tier fallback | commit 0bec81b9 | Why the write half works and only the read half is broken |
| Flag-gated session reads (9 copies) | **This phase: unconditional binding reads via one shared resolver** | Phase 248 | Deliberate repeal of flag-off read parity for bound sessions |

## Runtime State Inventory (refactor-phase check)

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Session binding files `.rooms/sessions/*.json` - schema unchanged; stale files from dead sessions are inert (keyed by sessionId) | none |
| Live service config | Long-lived MCP daemon processes hold the OLD code until restarted; marketplace install cache holds old release | CTX-03 fresh-spawn rule; release + user update path |
| OS-registered state | none found | none |
| Secrets/env vars | `MINDRIAN_MCP_FIRST` semantics narrow (read path no longer consults it); `CLAUDE_ACTIVE_ROOM`, `CLAUDE_CODE_SESSION_ID`, `MINDRIAN_ROOMS_HOME` unchanged | Document flag-meaning change in ENV-TUNING.md / CHANGELOG |
| Build artifacts | none (no build step; CJS ships as source) | none |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Desktop's stdio transport also leaves `extra.sessionId` unpopulated (proven only for CLI stdio; tool-router comment implies desktop may be non-stdio in some paths) | CTX-03 table | Desktop probe needs a different session-id leg; verify during CTX-03 live-fire, low design impact since resolveEffectiveSessionId covers both |
| A2 | No consumer outside lib/mcp depends on the exact `{ok:true,bound:true}` room_bind response shape (additive fields assumed safe) | CTX-02 | Grep consumers at plan time; F.8 card renderer and tests are the known readers |
| A3 | `isMcpFirst` retains non-resolution consumers (daemon lifecycle/registration) and must not be deleted outright | CTX-01 design | If none remain live, the flag itself may deserve deprecation notes; census at plan time |

## Open Questions (RESOLVED)

All four resolved at plan time (2026-08-10): OQ1 RESOLVED - requireOwnership stays OFF, cited in 248-01 Task 2. OQ2 RESOLVED - read path ignores the flag; ENV-TUNING.md + D-07 wording amended via 248-02 Task 2. OQ3 RESOLVED - scripted surface-equivalents are the merge gate; real-host confirmation recorded at release pickup (248-02). OQ4 RESOLVED - langtalks unavailable to researcher AND planner; recorded in both plans' notes with an executor MAY-attempt clause.

1. **Engage `requireOwnership` (foreign-live reg.active decline) in the shared resolver's Leg B?** Known: it ships opt-in OFF for the 9 MCP modules explicitly for zero blast radius; only the F.1 reach-card consumer opts in. Recommendation: keep OFF in Phase 248 (bound sessions never reach Leg B anyway, and the unbound tier-0 restart case depends on inheriting); note for a later phase.
2. **What does `MINDRIAN_MCP_FIRST` mean after the collapse?** Recommendation: read path ignores it entirely; document remaining consumers (grep at plan time) and amend D-07 wording in the phase's doc updates - a flag whose documented meaning silently changed is this repo's known bug class.
3. **Desktop/Cowork live-fire logistics for CTX-03** - real-host runs need a cut beta (release-train Gates 0/1 pending); scripted surface-equivalents (env-forced surface + transport) are the fallback. The planner should decide whether scripted equivalents satisfy "live before/after on all three surfaces" or whether the phase gate waits on the release train (recommend: scripted for merge, real-host confirmation recorded at release pickup, per the RCA preamble's code-vs-wire discipline).
4. **Langtalks grounding not run:** the `mcp__langtalks-graph-expert__*` tools are not available in this research agent's toolset, so the mandated `relationship_path` query (session-state/context-binding analogs in agent harnesses) could not be fired. Not skipped by judgment - tool unavailable. Run it in discuss/plan (query e.g. `relationship_path` from "session state" / "context binding" to "multi-agent orchestration"); "not in corpus yet" is a valid outcome and would leave this phase grounded on first-party RCA evidence alone, which is strong here.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js >= 22.16.0 | repo floor (node:sqlite timeout) | assumed (repo runs today) | verify `node --version` at execute | none needed |
| bash + scripts/room-registry | CTX-03 fixture | yes (repo scripts) | - | - |
| Claude Desktop / Cowork hosts | CTX-03 real-host legs | operator-dependent | - | scripted surface-equivalents (Open Question 3) |

No external services, no network, no new installs. Phase is fully local.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bespoke Node CJS tests, `node:assert/strict`, no runner dependency (repo convention) |
| Config file | none (per-phase `tests/run-all-<phase>.sh`) |
| Quick run command | `node tests/test-248-room-bind-session-authoritative.cjs` |
| Full suite command | `bash tests/run-all-248.sh` plus re-pointed suites: `node tests/test-198-flag-off-parity.test.cjs`, `bash tests/run-all-194.sh`, `node tests/test-tool-router-active-room-misroute.cjs`, `node scripts/build-connector-registry.cjs --check`, `node scripts/doctor.cjs --acceptance` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CTX-01 | Nine copies route through one module; tenth copy turns red | source-grep tripwire | `node tests/test-248-resolver-census.cjs` | Wave 0 |
| CTX-01 | Read resolution: bound session wins flag-off; unbound = legacy | unit/integration | `node tests/test-248-room-bind-session-authoritative.cjs` | Wave 0 |
| CTX-02 | Honest return: effective flag, room-not-on-disk reason, re-bind takes effect | unit | `node tests/test-248-room-bind-honest-return.cjs` | Wave 0 |
| CTX-02 | Two concurrent sessions isolate | integration | folded into test-248 suite (two sessionIds) | Wave 0 |
| CTX-03 | Live before/after, three surfaces | manual-only + scripted probes | scripted JSON-RPC probe script per surface table; real-host legs are checkpoint:human-verify (release-liveness rule makes them un-automatable pre-release) | Wave 0 (script), human gate |

### Sampling Rate
- **Per task commit:** the quick run command above
- **Per wave merge:** `bash tests/run-all-248.sh` + the re-pointed legacy suites
- **Phase gate:** full suite green + `doctor.cjs --acceptance` + connector registry check before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/test-248-room-bind-session-authoritative.cjs`
- [ ] `tests/test-248-resolver-census.cjs`
- [ ] `tests/test-248-room-bind-honest-return.cjs`
- [ ] `tests/run-all-248.sh`
- [ ] Re-point `tests/test-198-flag-off-parity.test.cjs` (doctrine change named in-commit)

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | yes | `isWritePathEnabled` untouched (write PERMISSION stays gated); resolver decides WHICH room, never WHETHER a write is allowed |
| V5 Input Validation | yes | `isSafeSlug` traversal guard (session-binding.cjs) already gates every slug entering bound/primary and the binding filename; SECTION_RE/safeResolveSection unchanged. The shared resolver must not open a bypass around registryRoomPath's containment |
| V6 Cryptography | no | - |

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via bound slug | Tampering | isSafeSlug on write AND read (already shipped, keep) |
| Cross-session room bleed (info disclosure into wrong room) | Information disclosure | Session-keyed binding files + Leg A precedence; two-session isolation test |
| Spoofed session id on stdio | Spoofing | Out of scope: CLAUDE_CODE_SESSION_ID is env-trusted by design (local trust boundary, same as CLI stdout) |

## Sources

### Primary (HIGH confidence - direct source reads this session, local HEAD)
- `.planning/debug/room-bind-mcp-first-off-falls-back-to-stale-global-active-room.md` - the diagnosed defect, live-fired evidence, Required Code Changes
- `lib/mcp/tool-router.cjs` (resolveWriteTargetDir 116-136; room_state reads 692-693; room_bind 1643-1700; connectors 1840-1848; _test exports 1854-1866)
- `lib/mcp/mcp-first-flag.cjs` (isMcpFirst 41-52; isWritePathEnabled 114-128)
- `lib/core/resolve-active-room.cjs` (resolveActiveRoom 322-381; resolveWriteRoom 416-435; resolveSessionRoom 481-520; registryRoomPath 123-156; resolveActiveOwnership 239-304)
- `lib/core/session-binding.cjs` (full read)
- All nine resolver copies (exact lines pinned via function-boundary grep)
- `lib/mcp/register-core-tools.cjs`, `lib/mcp/surface-detect.cjs`, `lib/core/seam-liveness.cjs`, `scripts/intent-classifier.cjs:930-985`
- `.planning/ROADMAP.md` (Phase 248), `.planning/REQUIREMENTS.md` (CTX-01..03), `.planning/milestones/v1.16.0-ROADMAP.md` (registered v1.17.0 slot, lines 304-312)
- `tests/test-198-flag-off-parity.test.cjs`, `tests/test-224-resolver-fallback.cjs` (headers read)

### Secondary (MEDIUM)
- Personal memory: feedback_dev_repo_fix_not_live_until_released (release-liveness rule)

### Tertiary / not obtained
- langtalks-graph-expert grounding query - tools unavailable this session (Open Question 4)

## Metadata

**Confidence breakdown:**
- Census + fallthrough mapping: HIGH - every copy read at source with pinned line ranges
- Shared-resolver design: HIGH for precedence correctness (reuses shipped, tested core ladder); MEDIUM on the exact module/API naming (planner's discretion)
- Test impact: HIGH for the named breakages (asserts read directly); MEDIUM on completeness (re-grep `_internal` consumers at plan time)
- CTX-03 surface mechanics: HIGH for CLI, MEDIUM for Desktop/Cowork (A1)

**Research date:** 2026-08-10
**Valid until:** ~30 days for the design; the copy census and call-site counts must be RE-RUN at plan time (this repo moves fast; the eight-to-nine drift happened in under two weeks)
