---
phase: 267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp
plan: 10
subsystem: mcp-apps
tags: [mcp-apps, ext-apps-2, rca, containment, dependency-bump]
requires: [267-09]
provides:
  - "MCP Apps tools (room-dashboard, room-wiki, room-graph) publish real input schemas and receive room_path / section / layout"
  - "resolveAppRoomDir: room_path realpath-contained strictly inside the rooms home"
  - "@modelcontextprotocol/ext-apps 2.0.3 in lockstep"
affects: [267-11]
key-files:
  created:
    - tests/test-267-mcpv2-app-views.cjs
  modified:
    - lib/mcp/app-views.cjs
    - package.json
    - package-lock.json
    - npm-shrinkwrap.json
    - references/security/cve-db.json
    - tests/fixtures/267/zod4-accepted-deltas.json
    - .planning/debug/resolved/app-views-schema-key-drops-input-schemas.md
    - .planning/debug/knowledge-base.md
decisions:
  - "room_path refused when its realpath equals the rooms home itself (plan-checker W2), not only when outside it"
  - "npm-shrinkwrap.json and package-lock.json root version fields kept at their release-stamped values (npm had rewritten the shrinkwrap root to beta.56)"
metrics:
  tasks: 2
  files: 9
  completed: 2026-10-02
---

# Phase 267 Plan 10: MCP Apps schemas on ext-apps 2.x with contained room_path Summary

RCA 2 fixed test-first: `schema:` became `inputSchema:` at the three registerAppTool configs in the same commit that moves `@modelcontextprotocol/ext-apps` 1.5.0 to 2.0.3, and `room_path` (newly live) is honored only strictly inside the rooms home via the Phase 354-05 realpath helper plus a rooms-home-itself refusal.

PLAN_BASE=a290afda372541cc70d88b8c2aab77949859391c

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | 7e2eac5ef | RED `tests/test-267-mcpv2-app-views.cjs` |
| 2 | 8a4aeba43 | ext-apps 2.0.3 lockstep, inputSchema fix, room_path containment, fixture ledger, cve-db note |
| 2 | cb00379ee | RCA 2 resolved (moved to resolved/, knowledge-base block) |

## Package legitimacy check (re-run at execute time, 2026-10-02)

`npm view @modelcontextprotocol/ext-apps`: latest `2.0.3` (dist-tags latest and release-2.0); repository `git+https://github.com/modelcontextprotocol/ext-apps.git`; required peers `@modelcontextprotocol/core ^2.0.0`, `@modelcontextprotocol/client ^2.0.0`, `zod ^4.2.0`; optional peers `@modelcontextprotocol/server`, `react`, `react-dom`. Installed: core 2.1.0, client 2.1.0, server 2.1.0, zod 4.6.5, all satisfy. `scripts` has only dev-time `prepare`/`prepack` (not run on registry installs; install ran with `--ignore-scripts`). `npm ls react react-dom` shows neither installed. The `./server` entry is one minified file with zero imports (`registerAppTool` is a `registerTool` wrapper, `registerAppResource` a `registerResource` wrapper), and `require('@modelcontextprotocol/ext-apps/server')` works from CJS. Only new transitive dep: `@standard-schema/spec ^1.1.0` (MIT). Name was already VETTED in cve-db.json; the entry now carries a dated note (no duplicate).

## Verification output

RED (unchanged tree, commit 7e2eac5ef): `PASS=9 FAIL=13`. Examples: `FAIL: schema: room-dashboard publishes room_path -- {}`; `FAIL: containment: room-dashboard room_path OUTSIDE rooms home: isError true` (the boot room was served instead).

GREEN (8a4aeba43), all runs with fresh `HOME=$(mktemp -d) MINDRIAN_ROOMS_HOME=$(mktemp -d)`:

```
node tests/test-267-mcpv2-app-views.cjs      PASS=22 FAIL=0
  schema: room-dashboard / room-wiki / room-graph publish room_path, section, layout enum [cose, circle, grid, breadthfirst]
  args: room-wiki receives section + room_path; room-graph receives layout
  containment: OUTSIDE path (dashboard, wiki) -> isError true, APPVIEW-OUTSIDE-SENTINEL absent
  containment: in-home symlink pointing outside -> isError true, sentinel absent
  containment: rooms home itself (dashboard, graph) and via `..` -> isError true, distinct reason, rooms-home sentinel absent (W2)
  fallback: no room_path -> boot room-267
  happy path: room_path strictly inside the home honored
node tests/test-267-mcpv2-lockstep.cjs       RESULT: PASS=6 FAIL=0
node tests/test-267-mcpv2-registration-api.cjs   PASS=67 FAIL=1
  FAIL: live tools/list count (45) != wire-snapshot-zod4.json local.tools count (44)   (research_run snapshot gap, owned by 267-11; the app-views reason is gone)
node tests/test-267-mcpv2-zod4-contract.cjs  PASS=2 FAIL=2
  (b) extras=["tool:research_run:membership"] only (three app tools now pinned in app_views_schema_fix); (d) scripts/fork359-permission-probe.cjs (baseline)
node tests/test-267-mcpv2-cirs-gates.cjs     PASS=2 FAIL=1   (Check (c) 31 vs 32, baseline)
node tests/test-354-room-symlink-containment.cjs   PASS - 10 checks
node tests/test-341-shrinkwrap-no-dev.cjs    PASS=4 FAIL=0
node lib/core/mcp-dep-heal.test.cjs          9 passed, 0 failed
node scripts/check-release-payload-ceiling.cjs --check   OK (0 findings)
bash tests/run-all-199.sh                    Passed 3 Failed 2   (same two legs as 267-BASELINE: AS-01/06/07, AS-09)
bash tests/run-all-198.sh                    Passed 13 Failed 3  (same three as 267-BASELINE)
bash tests/run-all-267.sh                    PASS=23 FAIL=4 SKIP=6 (run 1); second run FAIL legs: CIRS gates (c), zod4 (b)(d), brain shim canary, registration API full mode, 354 concurrency (K4 under empty HOME)
```

`grep -c "^\s*schema:" lib/mcp/app-views.cjs` = 0; `grep -c "inputSchema:"` = 3; `isRealpathContained` present; `realHome`/`realResolved` rooms-home check present alongside it (`resolveAppRoomDir`). `npm ls react` shows none. `grep -c APPVIEW-OUTSIDE-SENTINEL tests/test-267-mcpv2-app-views.cjs` = 2.

## Deviations from Plan

**1. [Rule 3 - Blocking, minor] Lockfile root versions.** `npm install` rewrote the root `version` of `npm-shrinkwrap.json` from `2.0.0-beta.55` (release-stamped, lagging package.json beta.56 by design) to `beta.56`. I restored the two root version fields to `2.0.0-beta.55` so the diff carries only the ext-apps change, then synced `package-lock.json` `packages` from the shrinkwrap keeping its own root version (`beta.30`), as in 267-03 step 2. Lockstep test 6/6.

**2. Verification command variants.** `check-release-payload-ceiling.cjs` needs `--check`; the plan's bare invocation prints usage. `check-shape-declaration.cjs --strict` alone (suggested in the RCA follow-ups) is not a valid invocation (`--check --strict`); I ran `node scripts/build-connector-registry.cjs --check` (clean, no output) and left the shape check as is since this plan adds no connector.

**3. Registration-api full mode still has one red.** As the brief anticipated: only the 45 vs 44 `research_run` snapshot gap (267-11). The app-views reason, which 267-09 recorded, is closed here.

No other deviations. Task 2 also did not need `references/security/cve-db.json` beyond the dated note.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-267-03 and T-267-03b are mitigated and test-armed (outside path, in-home symlink, rooms home itself, via `..`); T-267-26 accepted (layout is a closed enum, section only echoed); T-267-SC mitigated by the re-run package check above.

## Peer-tree note

package.json, lockfiles, cve-db.json, app-views.cjs and the fixture were clean (no foreign diff) before I started. Commits used `--only` by explicit path; untracked peer `.planning/debug/*` files left alone.

## Self-Check: PASSED

7e2eac5ef, 8a4aeba43, cb00379ee resolve on main; `tests/test-267-mcpv2-app-views.cjs` and `.planning/debug/resolved/app-views-schema-key-drops-input-schemas.md` (`status: resolved`) exist; `node_modules/@modelcontextprotocol/ext-apps` is 2.0.3.
