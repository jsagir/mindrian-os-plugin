---
phase: 266-mcp-layer-correctness-fixes-fast-independently-shippable-fix
reviewed: 2026-08-27T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - tests/run-all-266.sh
  - lib/mcp/no-instructions.test.cjs
  - lib/mcp/runtime-instructions.cjs
  - tests/test-266-room-state-description.cjs
  - lib/mcp/tool-router.cjs
  - lib/mcp/larry-context.cjs
  - tests/test-266-dep-heal-connect-budget.cjs
  - lib/core/mcp-dep-heal.cjs
  - lib/core/npm-install-lock.cjs
  - lib/core/npm-install-lock.test.cjs
  - bin/mindrian-mcp-server.cjs
  - bin/mindrian-brain-mcp-client.cjs
  - tests/test-234-tool-description-floor.cjs
findings:
  critical: 1
  warning: 4
  info: 0
  total: 5
status: issues_found
---

# Phase 266: Code Review Report

**Reviewed:** 2026-08-27
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Reviewed the Phase 266 MCP-layer fixes: the `RUNTIME_INSTRUCTIONS` host-boundary
byte-cap fix (MCPFIX-01), the `room_state` description splice fix (266-02), the
tool-description prose-coverage rewrite (234/266-04), and the MCP connect-path
dependency self-heal budget (MCPFIX-03, `mcp-dep-heal.cjs` /
`npm-install-lock.cjs` / both `bin/*.cjs` entry points).

`bash tests/run-all-266.sh` was executed and every leg passes (8/8 groups,
including the 156-assertion tool-description sweep and the 9-assertion
connect-budget suite). The instructions-truncation fix, the room_state
description fix, and the lock/heal unit contracts are all correct and are
byte-verified against the live wire, not just source-grepped.

The one finding that changes the ship/no-ship call is the connect-path budget
fix itself (MCPFIX-03): its own stated goal is to bound how long an MCP entry
point can block before answering `initialize`, but the budget is enforced
per-call, not per-process, so on exactly the cold-cache/slow-disk scenario the
fix was built for, the two entry points can still block several times longer
than the host's connect timeout. See CR-01.

## Critical Issues

### CR-01: CONNECT_PATH_BUDGET_MS is enforced per-call, so the two MCP entry points can still block 2-4x past the host's ~30s connect timeout on exactly the slow-install case MCPFIX-03 targets

**File:** `bin/mindrian-mcp-server.cjs:56-153`, `bin/mindrian-brain-mcp-client.cjs:41-45`, `lib/core/mcp-dep-heal.cjs:207-231,291-331`

**Issue:**
MCPFIX-03's whole premise (stated at length in `lib/core/mcp-dep-heal.cjs:50-99`)
is that a cold `npm install` can run 30s+, while Claude Code's own MCP connect
timeout is ~30000ms (CHANGELOG 2.1.242) -- so the connect path must never block
longer than a bounded budget (`CONNECT_PATH_BUDGET_MS = 15000`) before the
server can answer `initialize`.

The fix wires that budget into `ensureDepsPresent()` and into `requireWithHeal()`
independently, and both entry points call it multiple times in sequence at
module scope before the transport connects:

- `bin/mindrian-mcp-server.cjs`: `ensureDepsPresent()` (line 56), then
  `requireWithHeal('@modelcontextprotocol/sdk/server/mcp.js')` (line 58), then
  `requireWithHeal('@modelcontextprotocol/sdk/server/stdio.js')` (line 59),
  then (inside `createServer()`, called at line 199)
  `requireWithHeal('zod')` (line 153) -- **4 independent heal call sites**.
- `bin/mindrian-brain-mcp-client.cjs`: `ensureDepsPresent()` (line 41), then
  `requireWithHeal('.../server/mcp.js')`, `requireWithHeal('.../server/stdio.js')`,
  `requireWithHeal('zod')` (lines 43-45) -- **4 independent heal call sites**.

Each of these calls, on failure, independently runs `runGuardedInstall(dir, {
timeoutMs: CONNECT_PATH_BUDGET_MS })` (`mcp-dep-heal.cjs:207-231` and
`:291-331`) -- there is no shared deadline or "budget already spent this
process" flag threaded between them. `ensureDepsPresent`'s return value is
never even inspected by either entry point, so a failed (`ok:false`) first
heal attempt does not short-circuit the later `requireWithHeal` calls; it just
lets each one independently retry the exact same guarded install from
scratch (or re-enter `waitForUnlock` for the same peer) with its own fresh
15000ms budget.

On a genuinely cold cache with a slow disk or network -- the exact scenario
this phase's own header calls out as "the reason this budget exists" -- the
first `ensureDepsPresent()` call can easily fail to finish the full production
`npm install` inside 15s and return `ok:false`. `node_modules` is then still
incomplete, so the very next `require()` inside `requireWithHeal` throws
`MODULE_NOT_FOUND` again, triggers *another* full `runGuardedInstall` with
*another* 15000ms budget, and this repeats up to 4 times per process. Total
possible blocking time before a single `initialize` response is therefore up
to ~60000ms, roughly double the host's own ~30000ms connect timeout that this
whole subsystem was built to respect -- the host will have already declared
the server dead and moved on, which is precisely the failure mode MCPFIX-03
set out to close.

This is not caught by `tests/test-266-dep-heal-connect-budget.cjs`: that
suite's checks 5/6 exercise exactly one `waitForUnlock` / `ensureDepsPresent`
call in isolation, never the full module-scope sequence of calls the real
entry point files make.

**Fix:** thread a single shared, monotonically-shrinking deadline through the
whole connect-path sequence instead of a fixed per-call constant, e.g.:

```js
// bin/mindrian-mcp-server.cjs
const connectDeadline = Date.now() + CONNECT_PATH_BUDGET_MS; // computed ONCE
const budgetFor = () => Math.max(0, connectDeadline - Date.now());

ensureDepsPresent({ log: healLog, connectPath: true, timeoutMs: budgetFor() });
const { McpServer } = requireWithHeal('@modelcontextprotocol/sdk/server/mcp.js',
  { log: healLog, connectPath: true, timeoutMs: budgetFor() });
// ...and so on for every subsequent requireWithHeal call.
```

`runGuardedInstall`/`requireWithHeal` already accept an explicit `timeoutMs`
override (`mcp-dep-heal.cjs:155-159`), so the plumbing exists; what is missing
is passing a *shrinking* remaining-budget value instead of the same constant
at every call site, and/or having `requireWithHeal` skip re-attempting the
install entirely (propagate the error immediately) once `ensureDepsPresent`
has already spent the connect-path budget and reported `ok:false`.

## Warnings

### WR-01: The Phase 266 no-em-dash fence never scans the two entry-point files it modifies, or the lock test file that declares the same hard rule

**File:** `tests/run-all-266.sh:170-179`

**Issue:** `EMDASH_TARGETS` lists 8 fixed paths plus every glob-discovered
`tests/test-266-*` file, but omits `bin/mindrian-mcp-server.cjs`,
`bin/mindrian-brain-mcp-client.cjs`, `lib/core/npm-install-lock.test.cjs`, and
`lib/core/mcp-dep-heal.test.cjs` -- all four are explicitly touched/created by
this phase's own MCPFIX-03 work (confirmed by `tests/test-266-dep-heal-
connect-budget.cjs`'s own checks 7/8, which source-grep those exact two `bin/`
files), and two of them (`bin/mindrian-brain-mcp-client.cjs:23` and
`lib/core/npm-install-lock.test.cjs:41`) carry their own in-file "HARD RULE: no
em-dashes anywhere in this file" comment. That claim is never machine-checked
by this harness. Today all four files happen to be clean (verified with
`grep -P '\x{2014}'`), but the fence exists specifically so that stops being a
matter of luck.

**Fix:** add the four missing paths to `EMDASH_TARGETS` (or, better, glob every
file this phase's git diff actually touches instead of hand-maintaining the
list, mirroring the reasoning already applied to the `tests/test-266-*` glob
half of the array).

### WR-02: `larryContext` is a fully dead parameter in `registerRouterTools`, but is still loaded from disk and threaded through on every boot

**File:** `lib/mcp/tool-router.cjs:635,640`, `lib/mcp/larry-context.cjs:20-40`, `bin/mindrian-mcp-server.cjs:98-99,143`

**Issue:** Phase 266-02 removed the `compact` field from `loadLarryContext()`'s
return value (the field the old, buggy `room_state` description spliced from).
`registerRouterTools`'s `larryContext` parameter was only ever read via
`larryContext.compact` (`const compact = (larryContext && larryContext.compact)
|| '';`, now deleted). Grepping the current file confirms `larryContext` is no
longer referenced anywhere inside `registerRouterTools`'s body -- it is dead
weight in the signature. `bin/mindrian-mcp-server.cjs` still unconditionally
calls `loadLarryContext(pluginRoot)` at module scope (3 synchronous file reads:
voice-dna.md, lexicon.md, assessment-philosophy.md) purely to produce a value
that is passed in and never used by the router. (`lib/mcp/prompts.cjs`
separately calls `loadLarryContext` again for its own, legitimate use -- that
call is unaffected and correct.)

**Fix:** drop the `larryContext` parameter from `registerRouterTools` (and the
now-pointless `loadLarryContext(pluginRoot)` call plus its threading through
`bin/mindrian-mcp-server.cjs:99,143`), or leave a one-line comment explaining
why it is intentionally kept for a near-term future consumer -- as written it
reads like an oversight from the 266-02 edit, not a deliberate choice.

### WR-03: The connect-path budget's own `spawnSync` kill-on-timeout can leave `node_modules` partially populated, which `ensureDepsPresent`'s directory-existence probe cannot detect

**File:** `lib/core/mcp-dep-heal.cjs:171-188,291-331`

**Issue:** `runGuardedInstall` bounds the install with `spawnSync(..., { timeout:
timeoutMs, ... })`. On the connect path (`timeoutMs = 15000`), a cold install
of the full production dependency set is exactly the case documented as
"30s+" -- meaning the connect path will routinely kill `npm install` mid-write.
`npm` typically creates a package's directory before it finishes writing all
of that package's files, so `ensureDepsPresent`'s probe
(`fs.existsSync(path.join(nm, ...dep.split('/')))`, line ~307) can report a
dependency as "present" when only its directory exists and its contents are
incomplete or truncated. A subsequent boot then sees `missing = false`, skips
the heal entirely, and the later bare `require()` inside `lib/mcp/*` fails with
some other error (a syntax error in a truncated file, a missing sub-file,
etc.) rather than `MODULE_NOT_FOUND` -- which `requireWithHeal` explicitly does
NOT retry on (`if (!err || err.code !== 'MODULE_NOT_FOUND') throw err;`,
`mcp-dep-heal.cjs:213`), so the server crashes with no self-heal path at all
until something else (the SessionStart hook, or a manual `npm install`)
repairs the tree.

**Fix:** either have the connect-path install target check completion more
robustly than directory existence (e.g. verify each probed package's own
`package.json` is present and parseable, not just its directory), or have
`ensureDepsPresent`/`runGuardedInstall` record "install did not finish inside
budget" state (e.g. a marker file) that forces a full reinstall attempt on the
very next boot regardless of what the directory-existence probe reports.

### WR-04: `brain_query` / `brain_write` accept arbitrary, unvalidated Cypher with no code-level Canon Part 8 enforcement

**File:** `bin/mindrian-brain-mcp-client.cjs:116-128,171-180`

**Issue:** Both tools pass the model-supplied `cypher` string straight to
`brainClient.query(cypher, params)` / `brainClient.write(cypher)` with zero
validation, allow-listing, or complexity/size bound. The tool descriptions ask
the calling model to use "generic framework handles only" and "generic
methodology framework writes only," but nothing in this file (or, from what is
in scope here, in `brain-client.cjs`) enforces that boundary in code -- Canon
Part 8 compliance rests entirely on the model honoring the description text.
A compromised or careless caller (or a future host that surfaces this tool
without carrying the description text into its own system prompt, exactly the
gap Phase 234's tool-description-floor work exists to close for other tools)
could send arbitrary Cypher, including room-specific content, straight to the
remote Brain, or (`brain_write`) mutate the shared graph with an
admin-tier key. This is flagged as pre-existing and already tracked
elsewhere in this repo's own docs (`docs/brain-audit-2026-08-10/...`: "text2cypher
is one env var from executing model-authored raw Cypher uncapped"), so it is
not a regression introduced by this phase, but it remains live in a file this
phase's own diff range touches and ships unmitigated.

**Fix:** out of this phase's stated scope (MCPFIX-01/02/03), but worth a
follow-up: at minimum, reject `cypher` strings containing string literals that
look like free-text room content (long natural-language substrings), or move
enforcement server-side (the Brain's own admission gate) rather than relying
solely on prose in the tool description.

---

_Reviewed: 2026-08-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
