---
status: fixing
kind: rca
trigger: "app-views-schema-key-drops-input-schemas"
issue_id: ""
severity: medium
surfaces: [desktop, cowork]
brain_mode: full-loop
canon_parts: [8]
created: 2026-09-24T07:43:32Z
updated: 2026-09-24T07:43:32Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED. `lib/mcp/app-views.cjs:242,267,296` pass a `schema:` config key to `registerAppTool`; `registerAppTool` forwards its config object to `server.registerTool`, which destructures `inputSchema` (not `schema`). The key is silently ignored, so all three MCP Apps tools (`room-dashboard`, `room-wiki`, `room-graph`) publish an empty input schema and their `room_path`/`section`/`layout` arguments can never arrive from a caller.
test: Live `tools/list` against the unchanged tree, hermetic stdio.
expecting: (met) all three tools report `{"type":"object","properties":{}}`.
next_action: NONE for this plan (267-02 is RCA-filing only, no code change). Fix owned by 267-10 (per `267-CONTEXT.md` "found while reading this code for the migration ... fix it in the same commit that touches app-views.cjs for the registration-API rewrite").

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 2.0.0-beta.48
- Reported by: Phase 267 research pass (2026-09-23) and 267-02 plan execution (2026-09-24), live-reproduced
- Date first observed: 2026-09-23 (267-RESEARCH.md Pitfall 3, "REPLACED"), pre-existing bug unrelated to any SDK version
- Related debug sessions: none

### Source-of-Truth Preamble

- **CODE claims read against:** `origin/main` HEAD @ `782ecc4662edab1b0901788250ba9ed0ff1992f4` (PLAN_BASE for 267-02)
- **WIRE claims probe against:** a hermetically-spawned local instance of `bin/mindrian-mcp-server.cjs` on this same tree, stdio transport, via `tests/helpers/mcp-wire-267.cjs`'s `rpcOverStdio`
- **Date of audit:** 2026-09-24
- **Re-verification rule:** any source-code claim below MUST be re-verified against `origin/main` HEAD before it lands as a finding; otherwise the finding is provisional and tagged `needs-source-reverify`.

## Problem Statement

The three MCP Apps tools (`room-dashboard`, `room-wiki`, `room-graph`) publish an empty JSON Schema (`{"type":"object","properties":{}}`) instead of their declared `room_path`/`section`/`layout` parameters, so no caller can ever pass those arguments and every call silently falls back to the server's boot-time default `roomDir`.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: `tools/list` reports each of the three MCP Apps tools with a populated `inputSchema` matching the `z.object({...})` shape declared in `lib/mcp/app-views.cjs` (e.g. `room-dashboard` should show an optional `room_path: string`; `room-wiki` should also show an optional `section: string`; `room-graph` should also show an optional `layout` enum).
actual: All three tools report `inputSchema: {"type":"object","properties":{}}` -- no properties at all, on both the v1 SDK (installed) and (per 267-RESEARCH.md's live check) the v2 SDK.
errors: none thrown -- this is a silent contract-drop, not a crash. The handler functions still run; they just never see `args.room_path`, `args.section`, or `args.layout`, because the host/client has nothing in the advertised schema to prompt for or validate against.
reproduction:
  1. Spawn `bin/mindrian-mcp-server.cjs` over stdio in a hermetic env.
  2. Send `initialize` then `tools/list`.
  3. Inspect the `inputSchema` field for `room-dashboard`, `room-wiki`, `room-graph`.
started: Pre-existing since these three tools were first registered (unrelated to the SDK version or to this migration) -- discovered while reading `app-views.cjs` for the Phase 267 registration-API rewrite.

## Scope and Impact

- Affected surfaces: desktop, cowork (the two surfaces `CAPABILITY_MAP` in `lib/mcp/surface-detect.cjs` marks `apps: true`; CLI has `apps: false` and never registers these tools).
- Affected commands: the three MCP Apps tools `room-dashboard`, `room-wiki`, `room-graph`.
- Affected users: all installs on desktop/cowork that invoke any of the three app tools with a non-default `room_path`, `section`, or `layout` argument -- those arguments are unreachable; every call resolves against the server's boot-time `roomDir` only.
- Version range: present in the currently-shipped `2.0.0-beta.48`; not introduced by Phase 267.
- Severity: medium (the tools still function against the default room; the bug removes optional targeting/filtering capability, it does not crash or corrupt data).
- Blast radius: isolated to these three registration sites; no other tool in the tree uses the `schema:` key name (grep-verified: `lib/mcp/app-views.cjs` is the only caller of `registerAppTool`, and it is the only file using `schema:` where `inputSchema:` is expected).

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: This is a v1-vs-v2 SDK regression, or specific to zod 3 vs zod 4.
  evidence: 267-RESEARCH.md confirms the empty-schema behavior is identical under both v1 (installed) and v2 SDKs, and independent of the zod version -- `registerAppTool` (in both `@modelcontextprotocol/ext-apps` 1.5.0 and 2.0.0) is a duck-typed wrapper that always calls `server.registerTool(...)`, which has always destructured `inputSchema`, never `schema`. This repo's own config object just never used the right key name.
  timestamp: 2026-09-24T07:43:32Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-09-24T07:44:40Z
  checked: live `tools/list` over stdio, hermetic env, unchanged tree
  found: |
    `room-dashboard inputSchema={"type":"object","properties":{}}`
    `room-wiki inputSchema={"type":"object","properties":{}}`
    `room-graph inputSchema={"type":"object","properties":{}}`
  implication: Confirms the Symptoms exactly on the currently-installed v1 SDK. All three MCP Apps tools have zero reachable arguments.

- timestamp: 2026-09-24T07:43:32Z
  checked: `lib/mcp/app-views.cjs:239-252,264-281,293-310` (the three `registerAppTool` call sites)
  found: |
    ```js
    registerAppTool(server, 'room-dashboard', {
      title: 'Data Room Dashboard',
      description: '...',
      schema: z.object({
        room_path: z.string().optional().describe('...')
      }),
      _meta: { ui: { resourceUri: dashboardUri } }
    }, async (args) => { ... });
    ```
    The config object key is `schema:`, not `inputSchema:`. Same pattern at `room-wiki` (`schema: z.object({ room_path, section })`, :267) and `room-graph` (`schema: z.object({ room_path, layout })`, :296).
  implication: `registerAppTool`'s config object never contains an `inputSchema` key, so whatever `registerTool` reads for schema construction sees `undefined` and falls back to the empty default.

- timestamp: 2026-09-24T07:43:32Z
  checked: `node_modules/@modelcontextprotocol/sdk/dist/cjs/server/mcp.js` (the installed v1 SDK's `registerTool`, the function `registerAppTool` ultimately calls per 267-RESEARCH.md's tarball diff of `@modelcontextprotocol/ext-apps`)
  found: `registerTool`'s config-object destructure reads `inputSchema` by name (confirmed via 267-RESEARCH.md's own citation, "`registerTool` destructures `inputSchema` (`sdk/dist/cjs/server/mcp.js:706`)"); there is no fallback read of a `schema` key.
  implication: The `schema:` key silently vanishes -- it is not a typo that throws, it is a config key the consuming function never looks at, so no error surfaces anywhere in the registration or call path.

## Technical Root Cause

- Site: `lib/mcp/app-views.cjs:242`, `:267`, `:296`, function `registerAppViews` (all three `registerAppTool` call sites).
- Cause: the config object passed to `registerAppTool` uses the key name `schema:` where the underlying `server.registerTool` (which `registerAppTool` forwards to, per its duck-typed wrapper implementation in `@modelcontextprotocol/ext-apps`) destructures `inputSchema:`. The mis-keyed value is simply never read; `registerTool` builds its published JSON Schema from `undefined`, yielding the empty-object default.
- Why it surfaces now: this bug predates Phase 267 and is independent of the SDK version -- it surfaced NOW because Phase 267's registration-rewrite pass is the first time anyone has read every registration call site in `lib/mcp/app-views.cjs` line-by-line against the SDK's actual destructure contract.

## Required Code Changes
<!-- Explicit, imperative, one block per change -->

- Change 1:
  - Location: `lib/mcp/app-views.cjs:242` (`room-dashboard`), `:267` (`room-wiki`), `:296` (`room-graph`), function `registerAppViews`
  - Current behavior: config objects use `schema:` as the key holding the `z.object({...})` shape; the key is ignored, all three tools publish `{"type":"object","properties":{}}`.
  - Required behavior: rename `schema:` to `inputSchema:` at all three sites, so the declared `room_path`/`section`/`layout` shapes actually publish and actually arrive in `args`.
  - Short-term patch: same as the required behavior -- this is a one-word key rename, there is no smaller interim step.
  - Long-term fix: because this fix turns a previously-dark input live for the first time, the `room_path` argument must also be constrained: add `isRealpathContained(home, resolved)` from `lib/core/room-path-containment.cjs`, checked against the rooms home returned by `listRoomRoots()` in `lib/core/icm-forest.cjs` (Canon Part 7 reuse -- the Phase 354-05 helper), refusing any `room_path` argument that resolves outside a known room root. Without this guard, the rename alone would newly expose an arbitrary-path-read surface that did not previously exist (the argument was unreachable before the fix).
- Owning plan: 267-10 (per `267-CONTEXT.md`, folded into the same commit that rewrites `app-views.cjs` for the registration-API migration).

## Tests to Add or Update

- Test 1:
  - Type: integration
  - Location: `tests/helpers/mcp-wire-267.cjs`-based test, added by 267-10 (e.g. `tests/test-267-mcpv2-app-views-schema.cjs`)
  - Given: the local server running hermetically, post-fix
  - When: `tools/list` is called
  - Then: `room-dashboard`, `room-wiki`, `room-graph` each report a non-empty `inputSchema` with the expected property names (`room_path`; `room_path`+`section`; `room_path`+`layout` respectively)
  - Runner registration: add to `tests/run-all-267.sh`'s pre-declared MCPV2 leg list
- Test 2:
  - Type: integration
  - Location: same file, added by 267-10
  - Given: the local server running hermetically, post-fix, with the room-path containment guard in place
  - When: `room-dashboard` is called with a `room_path` argument that resolves OUTSIDE any known room root (e.g. `/etc/passwd` or `../../outside`)
  - Then: the call is refused (not a raw filesystem read of the out-of-bounds path)
  - Runner registration: add to `tests/run-all-267.sh`'s pre-declared MCPV2 leg list

## Non-Code Follow-ups
<!-- The release and canon obligations a code fix alone does not satisfy -->

- CHANGELOG.md: add a Fixed entry under the version 267-10 ships in ("MCP Apps tools now accept their declared `room_path`/`section`/`layout` arguments").
- Release lockstep: applies when 267-10 ships; see `.claude/includes/release-process.md` and `docs/RELEASE-CEREMONY-RULING-SYSTEM.md` RULE 5.
- Canon: touches Part 11 (CIRS) -- `app-views.cjs`'s registration rewrite is one of the 51 sites; run `node scripts/build-connector-registry.cjs --check` and `node scripts/check-shape-declaration.cjs --strict` after the fix commit, per 267-RESEARCH.md Pitfall 4.
- knowledge-base.md: on resolve, add the summary block per `docs/RCA-TEMPLATE.md` section 1.
- Docs / monitoring / process notes: none beyond the above.
- **MindrianOS gate answers (docs/RCA-TEMPLATE.md section 5):**
  1. Canon Part 8 (Graph Boundary): app views read LOCAL room files (via `scanRoomData`) and return them to the LOCAL host only. No Brain wire is involved in this tool family at all -- zero `brain_*` calls anywhere in `lib/mcp/app-views.cjs`.
  2. Tri-Polar: affects desktop and cowork (the two surfaces with `apps: true`). CLI never registers these tools (`apps: false`), so it is unaffected by construction. Both desktop and cowork must be verified once 267-10 lands; Desktop's actual behavior is still A2-unverified per 267-RESEARCH.md, so this fix should be checked against Desktop specifically when that verification happens.
  3. Cross-platform: the fix is a pure key-rename plus a path-containment check; no process spawning, no shell, no platform-specific path handling beyond what `room-path-containment.cjs` already does (already cross-platform per its own contract).
  4. Release lockstep: named above.
  5. No em-dashes: this file and the eventual fix's commit message, code comments, and CHANGELOG entry all use hyphens only.
  6. Reuse before build (Part 7): the containment guard reuses `lib/core/room-path-containment.cjs` (`isRealpathContained`) and `lib/core/icm-forest.cjs` (`listRoomRoots`) rather than hand-rolling a new path-safety check.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: CONFIRMED -- see Technical Root Cause above.
fix: PENDING - lands in 267-10
verification: PENDING
files_changed: []
commits: PENDING
