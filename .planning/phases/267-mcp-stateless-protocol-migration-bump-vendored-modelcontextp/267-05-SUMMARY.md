---
phase: 267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp
plan: 05
subsystem: mcp
tags: [mcp, sdk-v2, serveStdio, brain-shim, canary, supply-chain, wave-1]

# Dependency graph
requires:
  - phase: 267-01
    provides: "tests/helpers/mcp-wire-267.cjs (hermeticEnv, BRAIN_SHIM, normalizeSchema), tests/run-all-267.sh aggregator, tests/test-267-mcpv2-sdk-era.cjs (EXPECT_V2 ledger), tests/test-267-mcpv2-lockstep.cjs, 267-BASELINE.md"
  - phase: 267-03
    provides: "zod bumped to 4.6.5 + sdk 1.30.1 on v1, tests/fixtures/267/wire-snapshot-zod4.json (the brain-tools comparison floor this plan's canary test diffs against)"
provides:
  - "@modelcontextprotocol/{server,core,client}@2.1.0 installed in lockstep (package.json, package-lock.json, npm-shrinkwrap.json), single deduped core instance, three dated VETTED allowlist entries"
  - "lib/core/mcp-dep-heal.cjs FALLBACK grown to ['@modelcontextprotocol/server', '@modelcontextprotocol/sdk', 'zod']"
  - "tests/test-267-mcpv2-brain-shim.cjs (MCPV2-11): the real-wire, dual-era canary proof against the brain shim, using the genuine v2 Client + StdioClientTransport"
  - "bin/mindrian-brain-mcp-client.cjs migrated to @modelcontextprotocol/server's McpServer + serveStdio; zero @modelcontextprotocol/sdk references remain; zero changes to the six registerTool calls/schemas or to brain-client.cjs"
  - "tests/test-267-mcpv2-sdk-era.cjs Arm B rewritten against the REAL v2.1.0 package's actual public surface (SUPPORTED_PROTOCOL_VERSIONS never carries '2026-07-28' by design -- measured, not assumed)"
  - "tests/test-257-strict-input-shapes.cjs Arm E updated (+ new Arm E2) to accept the one measured, documented v1->v2 registerTool arguments-normalization delta, with a live proof it is not a validation bypass"
affects: [267-06, 267-07, 267-08, 267-09, 267-10, 267-11, 267-12, 267-13, 267-14, 267-15, 267-16, 267-17, 267-18]

# Tech tracking
tech-stack:
  added:
    - "@modelcontextprotocol/server@2.1.0"
    - "@modelcontextprotocol/core@2.1.0"
    - "@modelcontextprotocol/client@2.1.0"
  patterns:
    - "Dual-era canary wire test: a real v2 Client (default mode = legacy 2025-11-25; versionNegotiation:{mode:'auto'} = 2026-07-28) driven over StdioClientTransport against the REAL spawned shim process, diffed against the pinned wire-snapshot-zod4.json fixture -- no mocking, ground truth per lib/mcp/no-instructions.test.cjs doctrine"
    - "serveStdio(() => server) replaces new StdioServerTransport() + server.connect(transport): one factory serves both protocol eras with zero per-era branching in application code"
    - "SDK falsification via package shape, not a frozen constant: when a vendor package deliberately keeps no public version-string export (measured on @modelcontextprotocol/server 2.1.0's SUPPORTED_PROTOCOL_VERSIONS), fall back to (a) v2-only export presence and (b) a grep for the compiled version literal in the package's own dist output, mirroring the existing v1-falsification grep style"
  key-decisions-inline: "see key-decisions below"

key-files:
  created:
    - tests/test-267-mcpv2-brain-shim.cjs
  modified:
    - package.json
    - package-lock.json
    - npm-shrinkwrap.json
    - references/security/cve-db.json
    - lib/core/mcp-dep-heal.cjs
    - lib/core/mcp-dep-heal.test.cjs
    - bin/mindrian-brain-mcp-client.cjs
    - tests/test-267-mcpv2-sdk-era.cjs
    - tests/test-257-strict-input-shapes.cjs

key-decisions:
  - "Re-verified every version fact live at execute time per 267-CONTEXT.md's mandate (the family moved 2.0.0 -> 2.1.0 inside the research session itself): npm view confirmed server/core/client all resolve to 2.1.0, server's and client's own dependencies pin core at 2.1.0 exactly, repository is github.com/modelcontextprotocol/typescript-sdk for all three, and npm view scripts carries no preinstall/install/postinstall for any of them -- no plan-time literal was trusted."
  - "tests/test-267-mcpv2-sdk-era.cjs Arm B's original premise (grep the v2 package's SUPPORTED_PROTOCOL_VERSIONS export for the literal '2026-07-28') does not survive contact with the real package: the SDK's own compiled source explicitly comments 'no public modern-version constant ships before era-aware list semantics exist' (G-D2-4), and SUPPORTED_PROTOCOL_VERSIONS is deliberately the LEGACY-only list. Rewrote the arm to check for v2-only exports (serveStdio, createMcpHandler, isLegacyRequest) plus a dist-file grep for the compiled '2026-07-28' literal in non-comment code, mirroring Arm A's own falsification style. The canary test (MCPV2-11) is the real dual-era proof; Arm B only falsifies 'this cannot possibly be v2'."
  - "tests/test-257-strict-input-shapes.cjs Arm E (a Phase 257-08 test, not in this plan's declared files_modified) needed a Rule-1 bug fix directly caused by this task's own change: it compares 'before' (still on v1 SDK) vs 'after' (now migrated to v2) shim behavior, and this is the first time those two ever ran on genuinely different major SDK versions. Measured: v2's registerTool normalizes an omitted `arguments` field to `{}` before validation (v1 passed `undefined` straight through, which every schema rejected outright as a top-level type mismatch, not required-field enforcement). Against zero-parameter schemas (brain_schema, brain_stats) this flips isError true -> false. Verified live this is NOT a validation bypass: a required-field tool (brain_ask) still correctly rejects arguments-absent (new Arm E2 proves it). Arm E now accepts only this one measured, documented direction; any other divergence still fails loudly."
  - "Kept the shim's serveStdio() return value in a module-level `stdioHandle` variable per the plan's explicit instruction ('for future shutdown use'), not wired to any signal handler in this plan -- matches the shim's pre-migration behavior (no explicit close-on-SIGTERM existed before this plan either), and RCA mcp-server-sigterm-no-exit.md (267-02) already owns the SIGTERM-hang fix, assigned to 267-13."

requirements-completed: [MCPV2-11, MCPV2-10, MCPV2-09, MCPV2-19, MCPV2-01, MCPV2-12]

# Metrics
duration: ~55min
completed: 2026-09-24
---

# Phase 267 Plan 05: Brain Stdio Shim Migration (Canary) Summary

**bin/mindrian-brain-mcp-client.cjs, the phase's designated canary, now serves both MCP protocol eras (2025-11-25 and 2026-07-28) from one `serveStdio(() => server)` factory backed by the freshly-installed `@modelcontextprotocol/server@2.1.0` family, proven on the real wire by a new dual-era `Client`-driven test that goes from PASS=4/FAIL=2 (RED, Task 1) to PASS=6/FAIL=0 (GREEN, Task 2), with zero changes to the six `registerTool` calls, their schemas, or `brain-client.cjs`.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-09-24T09:00:00Z (approx; PLAN_BASE `cfc0cf8a46f87d65973605818f57b0a3718fc3ca`)
- **Completed:** 2026-09-24T09:40:00Z
- **Tasks:** 2
- **Files modified:** 10 (1 created, 9 modified)

## Accomplishments
- Re-checked `@modelcontextprotocol/{server,core,client}` live via `npm view` at execute time (all three at `2.1.0`, `core` pinned exactly by both `server` and `client`, official `github.com/modelcontextprotocol/typescript-sdk` repository, zero install-lifecycle scripts on any of them) before installing anything, per the plan's explicit "do not trust a plan-time literal" mandate.
- Installed the three packages with `--ignore-scripts --no-audit --no-fund`, brought `package.json`/`package-lock.json`/`npm-shrinkwrap.json` into lockstep (all 6 `tests/test-267-mcpv2-lockstep.cjs` checks pass, including exactly one deduped `@modelcontextprotocol/core` instance across `server` and `client`), and added three dated VETTED entries to `references/security/cve-db.json`'s supply-chain allowlist in the `ajv` entry's format.
- Taught `lib/core/mcp-dep-heal.cjs`'s `productionDepNames()` fallback about the new package (`FALLBACK` grew from 2 to 3 entries), and fixed the one regression test whose "narrow pre-fix probe" simulation had been silently reading the now-3-entry `FALLBACK` constant instead of the historical 2-entry literal it was meant to represent.
- Wrote `tests/test-267-mcpv2-brain-shim.cjs` (MCPV2-11): a real v2 `Client` + `StdioClientTransport` driven against the real spawned shim, in default mode (2025-11-25) and `versionNegotiation:{mode:'auto'}` (2026-07-28), comparing all 6 brain tools' name/description/normalized-inputSchema against the pinned `wire-snapshot-zod4.json` fixture, asserting `additionalProperties:false`, proving the keyless `brain_stats` tier-0 refusal in both eras with zero network reached, asserting the shim's own source requires `@modelcontextprotocol/server` and never `@modelcontextprotocol/sdk`, and verifying zero leaked child processes (including the auto-mode client's own disposable `server/discover` probe sibling) via both per-PID liveness checks and a repo-path-anchored `pgrep` sweep. Measured RED before migration (PASS=4 FAIL=2: the 2026 arm and the source arm), committed RED, then GREEN after Task 2 (PASS=6 FAIL=0).
- Migrated `bin/mindrian-brain-mcp-client.cjs`: `McpServer` now comes from `@modelcontextprotocol/server`, serving flips from `new StdioServerTransport()` + `server.connect()` to `serveStdio(() => server)` from `@modelcontextprotocol/server/stdio`. The six `registerTool` calls, their descriptions, their `z.strictObject` schemas, `tier0Response`, `honestRefusal`, and every `require` of `lib/core/*` are byte-unchanged; `brain-client.cjs` and `part8-egress-guard.cjs` show a zero-line diff against PLAN_BASE.
- Discovered and fixed a real, migration-caused wire-behavior delta in a Phase 257 regression test (`tests/test-257-strict-input-shapes.cjs` Arm E) that is not in this plan's declared file list but was directly caused by this task's own change (Rule 1). Measured and documented the v1->v2 `registerTool` `arguments`-normalization difference, verified it is a spec-compliance improvement rather than a validation bypass (new Arm E2, live-proven against `brain_ask`'s required field), and narrowed Arm E's assertion to accept only that one measured direction.
- Ran the full verification battery from the plan's `<verify>` blocks: `tests/test-267-mcpv2-lockstep.cjs` (6/6), `lib/core/mcp-dep-heal.test.cjs` (9/9), `scripts/check-release-payload-ceiling.cjs --check` (0 findings), `bash tests/run-all-199.sh` (3 pass / 2 fail -- both pre-existing, matching `267-BASELINE.md` exactly), every `test-257-*.cjs` file (only the two pre-existing baseline reds remain: Arm B flaky, Arm F stale description), `bash tests/run-all-127.sh` (12 pass / 4 fail, all pre-existing fixture-gated), `test-266-connect-path-process-budget.cjs`, `test-266-dep-heal-connect-budget.cjs`, `test-354-egress-typed-question.cjs`, `test-354-theo-mcp-exposure.cjs`, `test-339-brain-prewarm-cold-start.cjs`, `test-252-guard-census.cjs`, `test-250-refusal-shapes.cjs`, `test-265-mcp-surface-organ.cjs`, `test-267-mcpv2-zod4-contract.cjs`, `test-267-mcpv2-tee.cjs` (all green), `bash tests/run-all-267.sh` (`PASS=23 FAIL=0 SKIP=10`), and `node scripts/doctor.cjs --acceptance` (21/22, sole fail `verify-release-clean-tree` caused by the pre-existing peer-session working-tree state, not this plan).

## Task Commits

Each task was committed atomically (Task 1 split into three commits per its own instructions):

1. **Task 1a: Install and vet the v2 family in lockstep** - `367b06bd1` (chore)
2. **Task 1b: Teach mcp-dep-heal about the new package** - `8c34bee46` (fix)
3. **Task 1c: MCPV2-11 canary wire test, RED before migration** - `4a44ea48f` (test)
4. **Task 2: Migrate the shim to serveStdio, both eras green** - `900632c50` (feat)

_This SUMMARY.md, STATE.md's additive note, and ROADMAP.md's 267-05 line land in this session's own metadata commit._

## Files Created/Modified
- `tests/test-267-mcpv2-brain-shim.cjs` - MCPV2-11 canary wire test (new)
- `bin/mindrian-brain-mcp-client.cjs` - migrated to `@modelcontextprotocol/server`'s `McpServer` + `serveStdio`
- `package.json`, `package-lock.json`, `npm-shrinkwrap.json` - `@modelcontextprotocol/{server,core,client}` at `^2.1.0`, in lockstep
- `references/security/cve-db.json` - three dated VETTED allowlist entries
- `lib/core/mcp-dep-heal.cjs` - FALLBACK grew to include `@modelcontextprotocol/server`
- `lib/core/mcp-dep-heal.test.cjs` - historical narrow-probe simulation decoupled from the now-3-entry FALLBACK constant
- `tests/test-267-mcpv2-sdk-era.cjs` - EXPECT_V2 ledger gained the shim; Arm B rewritten against the real v2.1.0 package shape
- `tests/test-257-strict-input-shapes.cjs` - Arm E updated for the measured v1->v2 arguments-normalization delta; new Arm E2 proves it is not a validation bypass

## Decisions Made
See `key-decisions` in the frontmatter above (version re-verification discipline, the Arm B rewrite rationale, the Arm E/E2 fix rationale, and the `stdioHandle` module variable decision).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `tests/test-267-mcpv2-sdk-era.cjs` Arm B's premise did not survive contact with the real installed package**
- **Found during:** Task 2, step 5 (running `node tests/test-267-mcpv2-sdk-era.cjs` as part of the required verification battery)
- **Issue:** Arm B (written in 267-01, before this repo had ever installed a real v2 package) asserted `mod.SUPPORTED_PROTOCOL_VERSIONS.includes('2026-07-28')`. The real `@modelcontextprotocol/server@2.1.0` deliberately never exports a public modern-version constant (its own compiled source comments "G-D2-4: no public modern-version constant ships before era-aware list semantics exist"); `SUPPORTED_PROTOCOL_VERSIONS` is the legacy-`initialize`-only list and can never contain `2026-07-28`.
- **Fix:** Rewrote Arm B to assert the presence of three v2-only exports (`serveStdio`, `createMcpHandler`, `isLegacyRequest` -- none exist in v1) plus a grep across the package's own compiled dist output for the `2026-07-28` literal appearing in non-comment code, mirroring Arm A's existing v1-falsification grep style. The genuine dual-era proof lives in the canary test (MCPV2-11); this arm only falsifies "the installed package cannot possibly be v2".
- **Files modified:** `tests/test-267-mcpv2-sdk-era.cjs`
- **Verification:** `node tests/test-267-mcpv2-sdk-era.cjs` -- Arm A PASS, Arm B PASS, Arm C PASS, Arm D SKIP (sdk not yet removed, expected until 267-17).
- **Commit:** `900632c50`

**2. [Rule 1 - Bug] `tests/test-257-strict-input-shapes.cjs` Arm E newly failed, directly caused by this task's shim migration**
- **Found during:** Task 2, step 5 (running every `tests/test-257-*.cjs` file as the plan's own verification battery requires)
- **Issue:** Arm E compares the shim's behavior "before" (a fixed pre-registration-rewrite commit, still requiring `@modelcontextprotocol/sdk` v1) against "after" (current HEAD). This task made "after" the first version of this file to ever run on a genuinely different MAJOR SDK line than "before", which Arm E's original design (a Phase-257-internal registration-FORM comparison) never anticipated. Measured: v2's `registerTool` normalizes an omitted `arguments` field to `{}` before zod validation runs (v1 passed `undefined` straight through, which any object schema rejected outright as a top-level type mismatch). Against the zero-parameter tools (`brain_schema`, `brain_stats`) this flips `isError` `true -> false` for the "arguments absent" call shape only.
- **Fix:** Verified live that this is NOT a validation bypass -- a tool with a required field (`brain_ask`) still correctly rejects an arguments-absent call on the migrated shim (new Arm E2). Narrowed Arm E's assertion to accept only the one measured, documented direction (v1 errors, v2 normalizes-and-succeeds); the `arguments:{}` call shape, which was never touched by the migration, still requires byte-identical before/after behavior, and any other divergence in the "arguments absent" shape still fails loudly.
- **Files modified:** `tests/test-257-strict-input-shapes.cjs` (not in this plan's declared `files_modified`, but the fix is directly and only caused by this plan's own Task 2 change, so it falls within the scope-boundary rule)
- **Verification:** `node tests/test-257-strict-input-shapes.cjs` -- FAIL (2 failures: Arm B flaky, Arm F stale description, both pre-existing per `267-BASELINE.md`); Arm E and the new Arm E2 both pass.
- **Commit:** `900632c50`

---

**Total deviations:** 2 auto-fixed (both Rule 1 -- bugs in existing tests whose assumptions did not survive contact with the real, freshly-installed v2 SDK; neither touched production/security logic).
**Impact on plan:** Both fixes were required to satisfy the plan's own acceptance criteria ("every test-257 file's per-arm outcome matches 267-BASELINE.md; any other arm newly failing is a failure" and "Arm B PASS" for the era test). No scope creep: both fixes are test-only, and both root causes are now documented for 267-06 onward to recognize instead of rediscovering.

## Issues Encountered
- `npm install` updated `npm-shrinkwrap.json` but left `package-lock.json` stale (npm treats the shrinkwrap file as authoritative when both are present); synced `package-lock.json` from `npm-shrinkwrap.json` via a scripted deep-copy that explicitly preserves `package-lock.json`'s own pre-existing root `version` fields, matching the exact relationship `267-BASELINE.md` and `267-03-SUMMARY.md` already documented between the two lockfiles. Not a plan deviation -- the plan's own action text anticipated bringing the lockfiles into agreement "exactly as 267-03 Task 2 step 2 did."
- `evals/plurai/211-baseline.json` (peer-session modification) and `docs/FRAME-PROVENANCE-PRODUCT-WORKUP.md` / `docs/reviews/mindrian-system-atlas.html` (peer-session untracked files) remained present and untouched throughout this plan's execution, consistent with the documented multi-session shared-tree reality. `git status --short` was checked immediately before every commit and only this plan's own explicit paths were ever staged via `git commit --only -- <paths>`.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The migration pattern is now proven end to end on the smallest surface, exactly as the phase's own locked sequencing required: subpath `requireWithHeal` on the connect path, `serveStdio` wiring, `z.strictObject` schemas surviving unchanged under v2, `mcp-dep-heal` FALLBACK growth, and lockfile lockstep all worked on the first attempt except for the two documented test-assumption bugs above -- both now fixed and both patterns (a package with no public modern-version constant; a registerTool `arguments`-normalization change) are named here so 267-06 through 267-11 (the local server's own migration, at 51 registration sites) can recognize them immediately instead of re-discovering them.
- `tests/test-267-mcpv2-sdk-era.cjs`'s `EXPECT_V2` ledger now has one real entry (`bin/mindrian-brain-mcp-client.cjs`); every later migrating plan appends its own file paths to the same array.
- `@modelcontextprotocol/sdk` stays installed and required by `bin/mindrian-mcp-server.cjs`, `bin/mindrian-mcp-shim.cjs`, and `lib/mcp/adapter-client.cjs` until later Phase 267 waves migrate them; it is removed last, in 267-17.
- No blockers for 267-06. Zero changes to any of the 51 local-server registration sites, `lib/core/brain-client.cjs`, `mcp-server-brain/`, or `/home/jsagi/Theo` (all verified zero-diff against PLAN_BASE).

---
*Phase: 267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp*
*Completed: 2026-09-24*

## Self-Check: PASSED

All created/modified files verified present on disk (`tests/test-267-mcpv2-brain-shim.cjs`,
`bin/mindrian-brain-mcp-client.cjs`, this SUMMARY.md, and the rest of the modified-files list
above). All four task commits (`367b06bd1`, `8c34bee46`, `4a44ea48f`, `900632c50`) verified
present in `git log --oneline --all`. No missing items.
