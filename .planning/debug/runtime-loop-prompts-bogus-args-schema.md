---
status: fixing
kind: rca
trigger: "runtime-loop-prompts-bogus-args-schema"
issue_id: ""
severity: high
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [11]
created: 2026-09-24T07:43:32Z
updated: 2026-09-24T07:43:32Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED. `lib/mcp/prompts.cjs:358,378,398` call the v1 variadic `server.prompt(name, argsSchema, cb)` overload, but pass a `{description, arguments}` METADATA object in the `argsSchema` slot. The SDK treats that second positional argument as a raw zod shape and builds an args validator from it; a plain object of strings/arrays is not a valid zod shape, so validation crashes on `prompts/get` for all three prompts.
test: Live stdio `prompts/list` then `prompts/get` for `bind-room`, `status`, `act` against the unchanged tree, hermetic env.
expecting: (met) `prompts/list` shows no `description` field and two bogus REQUIRED arguments literally named `description` and `arguments`; `prompts/get` on all three returns `-32603 keyValidator._parse is not a function`.
next_action: NONE for this plan (267-02 is RCA-filing only, no code change). Fix owned by 267-09 (rewrite to `server.registerPrompt`, the non-deprecated v1 form, mirroring the correct sibling pattern already used elsewhere in this same file).

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 2.0.0-beta.48
- Reported by: 267-02 plan execution (2026-09-24), found live during plan-time reproduction (per `267-02-PLAN.md`'s objective: "Planning found four more real defects on the same surfaces, each reproduced live at plan time (2026-09-23)")
- Date first observed: 2026-09-23 (plan-time reproduction, cited in `267-02-PLAN.md`'s objective); re-reproduced 2026-09-24 during this RCA-filing plan
- Related debug sessions: none

### Source-of-Truth Preamble

- **CODE claims read against:** `origin/main` HEAD @ `782ecc4662edab1b0901788250ba9ed0ff1992f4` (PLAN_BASE for 267-02)
- **WIRE claims probe against:** a hermetically-spawned local instance of `bin/mindrian-mcp-server.cjs` on this same tree, stdio transport, via `tests/helpers/mcp-wire-267.cjs`'s `rpcOverStdio`
- **Date of audit:** 2026-09-24
- **Re-verification rule:** any source-code claim below MUST be re-verified against `origin/main` HEAD before it lands as a finding; otherwise the finding is provisional and tagged `needs-source-reverify`.

## Problem Statement

The three "runtime-loop" prompts (`bind-room`, `status`, `act`) added 2026-08-19 to give Desktop's prompt menu one-click entries for the hookless-surface protocol are broken on every surface: `prompts/list` advertises no description and two bogus required arguments, and `prompts/get` crashes on all three with an internal SDK error.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: `prompts/list` shows each of `bind-room`, `status`, `act` with its intended human-readable `description` and (for `act` only) one optional `goal` argument; `prompts/get` on each returns the intended pre-written user-message prompt text.
actual: `prompts/list` shows all three with NO `description` field and `arguments: [{"name":"description","required":true},{"name":"arguments","required":true}]` (the literal config-object keys leaking through as bogus argument names). `prompts/get` on all three returns a JSON-RPC error `-32603: keyValidator._parse is not a function`.
errors: `{"jsonrpc":"2.0","id":N,"error":{"code":-32603,"message":"keyValidator._parse is not a function"}}` -- verbatim, reproduced on all three prompts (`bind-room`, `status`, `act with a goal argument`).
reproduction:
  1. Spawn `bin/mindrian-mcp-server.cjs` over stdio in a hermetic env.
  2. Send `initialize`, then `prompts/list` -- observe the description-less, bogus-argument entries for `bind-room`, `status`, `act`.
  3. Send `prompts/get` for each of the three (`bind-room` and `status` with `{}`, `act` with `{goal:'x'}`) -- observe the `-32603 keyValidator._parse is not a function` error on all three.
started: Since these three prompts were first added (2026-08-19, per the code's own comment "Runtime-loop prompts (2026-08-19)"); not introduced by Phase 267 or by any SDK-version change. These three prompts have never worked on any surface.

## Scope and Impact

- Affected surfaces: cli, desktop, cowork (prompts are a wire-level MCP capability available on every transport; Desktop's prompt menu is the intended primary consumer per the 2026-08-19 comment, but any client that calls `prompts/get` on these three names hits the same crash).
- Affected commands: the three runtime-loop prompts `bind-room`, `status`, `act`.
- Affected users: all installs -- these prompts are dead on every surface since their introduction, not a regression affecting a subset of users.
- Version range: present since 2026-08-19 (prompt addition); confirmed still present at the currently-shipped `2.0.0-beta.48`.
- Severity: high (100% failure rate on all three prompts, on every surface, since introduction -- a whole intended feature has never worked).
- Blast radius: isolated to these three `server.prompt(...)` call sites. The six sibling `server.registerPrompt(...)` calls in the same file (e.g. `file-meeting` at `:101-110`) use the correct, non-deprecated overload and are unaffected.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: This is a zod-3-vs-zod-4 breaking-change regression.
  evidence: 267-RESEARCH.md measured the real server booting under zod 4.6.5 and found `run-all-198.sh` gives identical per-leg outcomes under zod 3 and zod 4, with the same pre-existing failures in both cases. The three runtime-loop prompts are not zod-schema objects at all in this broken form -- the bug is that the SDK receives a plain `{description, arguments}` object where it expects a zod raw shape, which is equally broken under either zod major version. This is a call-site argument-order/shape defect, not a zod compatibility issue.
  timestamp: 2026-09-24T07:43:32Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-09-24T07:45:10Z
  checked: live `prompts/list` and `prompts/get` (bind-room `{}`, status `{}`, act `{goal:'x'}`) over stdio, hermetic env, unchanged tree
  found: |
    `LIST bind-room: {"name":"bind-room","arguments":[{"name":"description","required":true},{"name":"arguments","required":true}]}`
    `LIST status: {"name":"status","arguments":[{"name":"description","required":true},{"name":"arguments","required":true}]}`
    `LIST act: {"name":"act","arguments":[{"name":"description","required":true},{"name":"arguments","required":true}]}`
    `GET bind-room: {"jsonrpc":"2.0","id":3,"error":{"code":-32603,"message":"keyValidator._parse is not a function"}}`
    `GET status: {"jsonrpc":"2.0","id":4,"error":{"code":-32603,"message":"keyValidator._parse is not a function"}}`
    `GET act: {"jsonrpc":"2.0","id":5,"error":{"code":-32603,"message":"keyValidator._parse is not a function"}}`
  implication: Confirms the Symptoms exactly -- no `description` field, both bogus required arguments (literally the config object's own key names `description` and `arguments`), and the identical `-32603 keyValidator._parse is not a function` crash on all three prompts.

- timestamp: 2026-09-24T07:43:32Z
  checked: `lib/mcp/prompts.cjs:358-376` (`bind-room`), `:378-396` (`status`), `:398-418` (`act`), function `registerPrompts`
  found: |
    ```js
    server.prompt(
      'bind-room',
      {
        description: 'Session start: list rooms and bind this conversation to one (run before any room write).',
        arguments: [],
      },
      async () => ({ ... })
    );
    ```
    Same pattern for `status` (`:378-396`, `arguments: []`) and `act` (`:398-418`, `arguments: [{ name: 'goal', description: '...', required: false }]`). Each call passes exactly 3 positional arguments: `name`, a plain `{description, arguments}` object, and the callback.
  implication: This is the v1 SDK's variadic `server.prompt(name, argsSchema, cb)` overload, where the second positional argument is documented to be a raw zod shape (e.g. `{ goal: z.string().optional() }`), NOT a `{description, arguments}` metadata object. The metadata object is landing in the wrong argument slot.

- timestamp: 2026-09-24T07:43:32Z
  checked: `node_modules/@modelcontextprotocol/sdk/dist/cjs/server/mcp.d.ts:160-190` (v1 prompt registration overload signatures)
  found: `server.prompt` accepts an `argsSchema` (a raw `ZodRawShape`) in the position this file fills with `{description, arguments}`; `server.registerPrompt(name, config, cb)` is the SDK's own non-deprecated form, where `config` correctly holds `{title, description, argsSchema}`.
  implication: The three broken call sites are using the deprecated variadic overload AND putting the wrong kind of object in its second slot; the fix is not just "add argsSchema correctly" but "switch overloads entirely to match the six correct sibling calls already in this same file".

- timestamp: 2026-09-24T07:43:32Z
  checked: `lib/mcp/prompts.cjs:101-110` (`file-meeting`, one of six correct sibling `registerPrompt` calls already in this file)
  found: |
    ```js
    server.registerPrompt(
      'file-meeting',
      {
        title: 'File Meeting',
        description: 'File a meeting transcript into the Data Room. ...',
        argsSchema: {
          transcript: z.string().describe('The full meeting transcript text'),
          meetingDate: z.string().optional().describe('Meeting date (YYYY-MM-DD format)'),
        },
      },
      async (args) => { ... }
    );
    ```
  implication: This file already contains the correct pattern six times over; the three broken prompts are the outliers that never got migrated to it. The fix is a direct, in-file precedent copy, not a novel design.

## Technical Root Cause

- Site: `lib/mcp/prompts.cjs:358`, `:378`, `:398`, function `registerPrompts` (the `bind-room`, `status`, `act` call sites).
- Cause: these three calls use the v1 variadic `server.prompt(name, argsSchema, cb)` overload but pass prompt METADATA (`{description, arguments}`) in the slot the SDK treats as a raw zod shape for building an args validator. When `prompts/get` is called, the SDK tries to build a Zod object schema keyed by that shape's own top-level keys (`description`, `arguments`) and calls `.parse` on the resulting (non-Zod) validator object, which throws `keyValidator._parse is not a function` because plain strings/arrays are not Zod schema nodes.
- Why it surfaces now: the three prompts have been broken since their 2026-08-19 introduction; Phase 267's plan-time reproduction pass is the first session to actually call `prompts/get` on each of them (prior sessions apparently only verified `prompts/list` returned entries, not that `prompts/get` succeeded).

## Required Code Changes
<!-- Explicit, imperative, one block per change -->

- Change 1:
  - Location: `lib/mcp/prompts.cjs:358-376`, `:378-396`, `:398-418`, function `registerPrompts`
  - Current behavior: `server.prompt('bind-room', {description, arguments: []}, cb)`, `server.prompt('status', {description, arguments: []}, cb)`, `server.prompt('act', {description, arguments: [{name:'goal',...}]}, cb)` -- all three broken as described above.
  - Required behavior: rewrite all three to `server.registerPrompt(name, config, cb)`, matching the six correct sibling calls already in this file:
    - `server.registerPrompt('bind-room', { title: 'Bind Room', description: 'Session start: list rooms and bind this conversation to one (run before any room write).' }, cb)` -- no `argsSchema` (no arguments).
    - `server.registerPrompt('status', { title: 'Status', description: 'One-line status: room, stage, health, and suggested next move (the statusline, in prose).' }, cb)` -- no `argsSchema`.
    - `server.registerPrompt('act', { title: 'Act', description: "Run Larry's best-pick methodology for the current room state (resolve, gate, then chain_run the approved sequence).", argsSchema: { goal: z.string().optional().describe('Optional goal or focus to steer the pick') } }, cb)`.
  - Short-term patch: same as required behavior -- this is a mechanical overload-swap with an in-file correct precedent to copy; there is no smaller interim fix.
  - Long-term fix: none beyond the rewrite above.
- Owning plan: 267-09 (per `267-CONTEXT.md`'s objective and the RCA-to-plan artifact table in `267-02-PLAN.md`).

## Tests to Add or Update

- Test 1:
  - Type: integration
  - Location: `tests/test-267-mcpv2-prompts.cjs` (267-09 to create)
  - Given: the local server running hermetically, post-fix
  - When: `prompts/list` is called
  - Then: `bind-room`, `status`, `act` each report their intended `description`, and `act` reports exactly one optional `goal` argument (never the bogus `description`/`arguments` pair)
  - Runner registration: add to `tests/run-all-267.sh`'s pre-declared MCPV2 leg list
- Test 2:
  - Type: integration
  - Location: same file, added by 267-09
  - Given: the local server running hermetically, post-fix
  - When: `prompts/get` is called for `bind-room` (`{}`), `status` (`{}`), and `act` (`{goal:'x'}` and `{}`)
  - Then: each returns the intended pre-written user-message prompt text, never a `-32603` error
  - Runner registration: add to `tests/run-all-267.sh`'s pre-declared MCPV2 leg list

## Non-Code Follow-ups
<!-- The release and canon obligations a code fix alone does not satisfy -->

- CHANGELOG.md: add a Fixed entry under the version 267-09 ships in ("the three runtime-loop prompts -- bind-room, status, act -- now work; they have never worked since their 2026-08-19 introduction").
- Release lockstep: applies when 267-09 ships; see `.claude/includes/release-process.md` and `docs/RELEASE-CEREMONY-RULING-SYSTEM.md` RULE 5.
- Canon: touches Part 11 (CIRS) -- `prompts.cjs`'s three sites are among the 51 registration-rewrite sites; run `node scripts/build-connector-registry.cjs --check` and `node scripts/check-shape-declaration.cjs --strict` after the fix commit.
- knowledge-base.md: on resolve, add the summary block per `docs/RCA-TEMPLATE.md` section 1.
- Docs / monitoring / process notes: none beyond the above.
- **MindrianOS gate answers (docs/RCA-TEMPLATE.md section 5):**
  1. Canon Part 8 (Graph Boundary): no Brain wire involved. These prompts return canned user-message text (session-start binding, status, act instructions); zero `brain_*` calls.
  2. Tri-Polar: the fix is a pure registration-API rewrite with no surface-conditional logic; it is correct on cli, desktop, and cowork by construction (prompts are wire-level MCP capability, not surface-gated). Desktop's prompt menu (the named intended consumer) should be the one explicitly verified once 267-09 lands, since it is the UX this feature was built for.
  3. Cross-platform: no process spawning, no path/shell behavior; pure in-process registration change.
  4. Release lockstep: named above.
  5. No em-dashes: this file and the eventual fix's commit message, code comments, and CHANGELOG entry all use hyphens only.
  6. Reuse before build (Part 7): the fix reuses this same file's own six correct `registerPrompt` sibling calls as its direct pattern, rather than inventing a new prompt-registration idiom.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: CONFIRMED -- see Technical Root Cause above.
fix: PENDING - lands in 267-09
verification: PENDING
files_changed: []
commits: PENDING
