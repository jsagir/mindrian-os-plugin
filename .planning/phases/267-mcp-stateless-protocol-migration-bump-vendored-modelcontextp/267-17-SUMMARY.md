---
phase: 267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp
plan: 17
subsystem: dependency-removal
tags: [mcp, v2, v1-removal, shrinkwrap, dep-heal, part-8]

requires:
  - phase: 267-16
    provides: server, clients and the Phase 354 harness on v2
provides:
  - "@modelcontextprotocol/sdk (v1) absent from package.json, package-lock.json, npm-shrinkwrap.json and node_modules"
  - "four tests (248, 257, 265, 276) and the fork359 probe on the v2 packages"
  - "dep-heal FALLBACK ['@modelcontextprotocol/server', 'zod']"
affects: [267-18 (seed and close-out)]

key-files:
  modified:
    - package.json
    - package-lock.json
    - npm-shrinkwrap.json
    - lib/core/mcp-dep-heal.cjs
    - lib/core/mcp-dep-heal.test.cjs
    - lib/mcp/gate-render.cjs
    - lib/mcp/tree-watcher.cjs
    - scripts/build-brain-packet-schema.cjs
    - scripts/fork359-permission-probe.cjs
    - tests/test-248-surface-probes.cjs
    - tests/test-257-strict-input-shapes.cjs
    - tests/test-265-gate-render-elicit-schema.cjs
    - tests/test-276-claim-write-primitive.cjs
    - tests/test-267-mcpv2-sdk-era.cjs

key-decisions:
  - "Triage before editing: the only real (non-comment) v1 requires were the four planned tests plus scripts/fork359-permission-probe.cjs; every other hit (brain-client, gate-render, tree-watcher, bin shim, mcp-dep-heal, test-267-*) is a comment or a string/fixture mention"
  - "Z4a restated, not deleted; the v1-fixture dependency of the 'before' shim in test-257 is handled by an explicit fixture lookup plus loud SKIP, never a silent pass"

requirements-completed: [MCPV2-18, MCPV2-09, MCPV2-12, MCPV2-19, MCPV2-01]

completed: 2026-10-02
---

# Phase 267 Plan 17: Remove the v1 SDK Summary

**The v1 `@modelcontextprotocol/sdk` is gone from the manifest, both lockfiles and node_modules; ajv, express and zod were already direct dependencies, dep-heal probes the new set without reinstalling anything, and sdk-era Arm D now binds and passes.**

PLAN_BASE=1df4d8188a3b6a1c5f7c89f60f0a35c2e86a6612

## Commits

- 6e78c54f7 test-248 surface probes on the v2 client packages
- 9ac8d86c3 test-276 comment cites v2 McpServer arg validation
- 3e3f618f3 test-265 elicit-schema arm validates against @modelcontextprotocol/core
- 710740bae test-257 strict-input-shapes on v2 (Arm Z4a restated)
- 71004d9cb fork359 permission probe on the v2 server package (deviation, below)
- 4a5739537 remove @modelcontextprotocol/sdk from package.json and both lockfiles
- 047892e32 dep-heal fallback no longer names the removed v1 SDK
- cabd25771 comment-only v1 path citations updated (gate-render, tree-watcher, build-brain-packet-schema)
- a6bfa503b sdk-era Arm D no longer scans its own matcher source (deviation, below)

## Pre-removal census (triage: real require vs mention)

Non-comment `@modelcontextprotocol/sdk` hits in bin/ lib/ scripts/ tests/ hooks/ before this plan:

| File | Class | Action |
|------|-------|--------|
| tests/test-248-surface-probes.cjs:69-71 | real require | migrated |
| tests/test-257-strict-input-shapes.cjs:325,341,352 (+ pin reporting :292-294) | real require | migrated |
| tests/test-265-gate-render-elicit-schema.cjs:143 | real require (relative dist path) | migrated |
| scripts/fork359-permission-probe.cjs:32-33 | real require (not in the plan list) | migrated |
| lib/core/mcp-dep-heal.cjs:371, mcp-dep-heal.test.cjs:39,85,166-214 | string literals (FALLBACK, fake fixture deps) | FALLBACK changed; fixture deps left (test passes) |
| tests/test-267-mcpv2-brain-shim.cjs, -clients.cjs, -sdk-era.cjs, test-257 :468 | assertion strings and comments that name the package | none needed |
| lib/core/brain-client.cjs, bin/mindrian-brain-mcp-client.cjs, gate-render, tree-watcher | comment only | gate-render/tree-watcher comments updated; brain-client and bin untouched |

Transitive census: the v1 SDK's 18 dependencies (@hono/node-server, ajv, ajv-formats, content-type, cors, cross-spawn, eventsource, eventsource-parser, express, express-rate-limit, hono, jose, json-schema-typed, pkce-challenge, raw-body, zod, zod-to-json-schema) grepped across bin/ lib/ scripts/ hooks/ tests/ skills/ commands/ .claude-plugin/. Only ajv, express and zod are required by repo code, and all three are declared direct dependencies. No STOP.

## Task 1: test migrations (verdicts equal baseline)

| Test | Before (hermetic) | After |
|------|-------------------|-------|
| test-248 | exit 0, 25/25 | exit 0, 25/25 |
| test-276 | exit 0, 44/44 | exit 0, 44/44 |
| test-265 elicit-schema | exit 0, 5 arms | exit 0, 5 arms (Titled schemas from `require('@modelcontextprotocol/core')`, no fallback used) |
| test-257 strict-input-shapes | exit 1: only Arm F (stale) failed | exit 1: Arm B (flaky boot race) and Arm F (stale) failed, both baseline; Z1-Z4c, A, C, D, E, E2, G all ok |

Arm Z4a, quoted.

Before (v1 positional overload):
```
Arm Z4a: positional tool() with a strictObject schema THROWS
  s.tool('probe', 'desc', z.strictObject({ question: z.string() }), cb)  -> assert threw, message matches
  /expected a Zod schema or ToolAnnotations, but received an unrecognized object/
```
After (v2, wire level over InMemoryTransport):
```
Arm Z4a: registerTool() with a strictObject inputSchema REJECTS an undeclared key on the wire and the handler never runs
  registerTool('probe', { description, inputSchema: z.strictObject({question}) }, cb)
  client.callTool({ name: 'probe', arguments: { question: 'x', roomSecret: 'LEAK' } })
  -> isError result "Invalid arguments for tool probe: Unrecognized key: \"roomSecret\""; handlerRan === false
```
The security claim (an undeclared key is rejected before the handler runs) is preserved; only the v1-only mechanism changed. Z4b and Z4c are unchanged apart from the require line.

## Task 2: removal and proof

- `npm uninstall --ignore-scripts --no-audit --no-fund @modelcontextprotocol/sdk` removed 8 packages. npm rewrote the shrinkwrap root version beta.55 to beta.56 in two places; restored (267-10/12 precedent). package-lock.json is not touched by npm when a shrinkwrap exists, so `packages` was synced from the shrinkwrap by script with its own root version (beta.30) kept. Verified first that the old lock equalled the old shrinkwrap modulo root version and that the lock round-trips byte-for-byte through JSON.stringify.
- Net lock diff: sdk block plus the 7 packages only it needed (ajv-formats, cors, express-rate-limit, ip-address, json-schema-typed, object-assign, zod-to-json-schema); `hono` gained `"peer": true` (still installed, still needed by @modelcontextprotocol/node's HTTP adapter). package.json diff is the one dependency line.
- Dep-heal check: `productionDepNames(repo)` now returns the 17 declared production deps (no sdk); all present on disk; `ensureDepsPresent` returns `{healed:false, ok:true}`. The heal step does not reinstall the sdk and nothing reports the install broken. FALLBACK prints `[ '@modelcontextprotocol/server', 'zod' ]`.
- Comment-only gate: diff of gate-render.cjs, tree-watcher.cjs and build-brain-packet-schema.cjs vs PLAN_BASE has 0 non-comment changed lines. `git diff PLAN_BASE -- lib/core/brain-client.cjs mcp-server-brain | wc -l` is 0 (egress paths untouched; Canon Part 8 intact).

## Verification output

```
node tests/test-267-mcpv2-sdk-era.cjs
  SKIP: Arm A (v1 falsification) -- v1 SDK not installed under node_modules
  PASS: Arm B, Arm C (5 files v2-only)
  PASS: Arm D (v1 removed) -- zero remaining @modelcontextprotocol/sdk require()/requireWithHeal() references
  RESULT: PASS=7 FAIL=0 SKIP=1
node tests/test-267-mcpv2-lockstep.cjs        RESULT: PASS=6 FAIL=0
node lib/core/mcp-dep-heal.test.cjs           mcp-dep-heal: 9 passed, 0 failed
node scripts/check-release-payload-ceiling.cjs --check
  entryCount=1982 unpackedSize=32873598 size=10022739 -> OK (0 findings)
node tests/test-341-shrinkwrap-no-dev.cjs     RESULT: PASS=4 FAIL=0
node tests/test-341-payload-shrinkwrap-present.cjs   PASS=4 FAIL=0
node lib/memory/packet-schema-validation.test.cjs   exit 0 (ajv consumer)
node scripts/build-brain-packet-schema.cjs --check  brain-packet-schema: OK
node tests/test-359-forward-harness.cjs       Passed: 36 / 36 (fork359 probe round trip)
node tests/test-267-mcpv2-dual-era.cjs        RESULT: PASS=5 FAIL=0
```
(Arm A SKIP is by design: it falsifies against the v1 package, which is now absent.)

Suites, hermetic HOME and rooms home, against 267-BASELINE.md:

| Suite | Result | vs baseline |
|-------|--------|-------------|
| run-all-267 | PASS=29 FAIL=3 SKIP=1 (CIRS (c) 31 vs 32; zod4 (a)(b)(d); 354 concurrency K4) | known reds only, see note on zod4 (a) |
| run-all-266 | PASS=11 FAIL=0 | equal |
| run-all-199 | Passed 3 Failed 2 (AS-01/06/07, AS-09) | equal |
| run-all-198 | Passed 13 Failed 3 (Part 8 local-only, SPEC-2, SPEC-5; adapter-budget inside SPEC-5) | equal |
| run-all-234 | PASS=9 FAIL=2 (network-scan, plugin-root-migrated) | baseline had 3 fails; test-234-dist-bundle now green, nothing worse |
| run-all-127 | 4 fixture-gated fails | equal |
| run-all-354 | PASSED=14 FAILED=5 SKIPPED=1 | equal to 267-16 (K4, chat-inert-render, POC save origin, POC room journey, framework-command-ledger T2) |
| tests/test-257-*.cjs | egress-invariant exit 1 (Arm 2), shim-honest-refusal exit 1 (Arm 4), strict-input-shapes exit 1 (B flaky, F stale), envelope-passthrough 0, refusal-egress-kind 0 | equal |

zod4 (a) note: the (a) failure is `tool:orchestration` description vs the zod3 snapshot, and (b) extras are `tool:research_run:membership` plus the same description. These come from peer Phase 366 wording that landed before this plan (the 267-12 refresh touched only wire-snapshot-zod4.json, which dual-era reads, and dual-era is green); nothing here changed any tool description, so no snapshot line was refreshed. zod4 (d) flags scripts/fork359-permission-probe.cjs, which already required zod before this plan and was never in zod-importers-baseline.txt (baseline red per the task notes); this plan changed none of its zod usage.

## Deviations from Plan

**1. [Rule 3 - Blocking] scripts/fork359-permission-probe.cjs was a real v1 require, not in files_modified.** The plan's acceptance ("no non-comment require ... in scripts/") and sdk-era Arm D both demand it gone. It used the v1 positional `server.tool(...)` and `StdioServerTransport`. Migrated to `McpServer` from `@modelcontextprotocol/server`, `registerTool` with a `z.object` input schema (same fields, same permissiveness as the raw shape), and `serveStdio(() => createServer())` from `@modelcontextprotocol/server/stdio`. test-359-forward-harness (which spawns it and does a live JSON-RPC round trip) is 36/36. Commit 71004d9cb.

**2. [Rule 1 - Bug] sdk-era Arm D flagged its own source.** Its matcher spells `line.includes("require('@modelcontextprotocol/sdk")` as literals, and the sweep covers tests/, so it would always fail once it bound. Added `if (file === __filename) continue;` with a comment. Arm D then passes. Commit a6bfa503b. File not in the plan's list.

**3. [Rule 3 - Blocking] test-257's "before" scratch shim needs a real v1 SDK at runtime.** Arms E, F and G spawn the pre-migration shim (git show of 7093e79b), which requires `@modelcontextprotocol/sdk` through a symlinked node_modules. With the package gone from the repo that would break three arms with no assertion at fault. Fixture assembly changed, assertions did not: the scratch node_modules is now a real directory of symlinks into the repo's node_modules plus `@modelcontextprotocol/sdk` linked to `mcp-server-brain/node_modules/@modelcontextprotocol/sdk` (v1.27.1, on disk, ignored by git, dead service out of scope for removal). When no v1 copy exists (a fresh checkout without mcp-server-brain/node_modules) Arms E, F, G print an explicit `SKIP ... (no v1 SDK fixture)` line and a NOTE; they are never counted as passes. Outcome here equals baseline (E, E2, G ok; B and F the known reds). Open risk for 267-18: those three arms only run where that untracked copy exists; if the owner wants them always-on, vendor a v1 fixture or retire the before-vs-after legs.

**4. [Rule 2 - small] Z1 pin line** now prints the `@modelcontextprotocol/server` pin and version (read from disk because v2 packages do not export ./package.json), as the plan specified.

## For the 267-18 seed (recorded, not edited here)

- lib/core/brain-client.cjs:2358 still says ajv is "transitive via the sdk"; ajv is a declared direct dependency now. Out of scope per plan.
- references/security/cve-db.json notes (hono "already on disk via the VETTED @modelcontextprotocol/sdk", ajv "transitive dep of the VETTED sdk") are now historical; the VETTED sdk entry itself was deliberately kept.
- tests/fixtures/363-pre-phase.json (consumed by the run-all-363 "no new dependency" leg) still lists `@modelcontextprotocol/sdk@^1.30.1` and ext-apps `^1.5.0`; it was already stale vs package.json (ext-apps ^2.0.3), so that leg is a pre-existing red, now with one more difference.
- Historical rationale comments in lib/core/mcp-dep-heal.cjs (header and the "rejected alternative" block) still name the v1 package; left as prose.
- data/capability-ledger.json evidence strings cite v1 dist paths (evidence prose, not code).

## Auth gates

None.

## Known Stubs

None.

## Threat Flags

None. T-267-35 held (census, full-suite comparison); T-267-13 held (lockstep, shrinkwrap, payload gates green); T-267-34 held (only Z4a restated, security claim kept, the only 3 removed assertion lines in test-257 are the old Z4a throw checks); T-267-09 held (brain-client, part8-egress-guard and mcp-server-brain diff is 0); T-267-11 held (comment-only diff gate is 0).

## Self-Check: PASSED

- Commits 6e78c54f7, 9ac8d86c3, 3e3f618f3, 710740bae, 71004d9cb, 4a5739537, 047892e32, cabd25771, a6bfa503b present on main.
- `node_modules/@modelcontextprotocol/sdk` absent; lock and shrinkwrap contain no sdk entry (node check exits 0); no non-comment sdk require in bin/ lib/ scripts/ tests/.
