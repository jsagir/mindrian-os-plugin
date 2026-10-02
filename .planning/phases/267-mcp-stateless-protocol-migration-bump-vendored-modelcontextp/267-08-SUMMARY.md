---
phase: 267-mcp-stateless-protocol-migration-bump-vendored-modelcontextp
plan: 08
subsystem: mcp
tags: [mcp, sdk-v2, registerTool, cirs, registration-rewrite, tool-honesty]

requires:
  - phase: 267-06
    provides: "registration rewrite rule, tests/test-267-mcpv2-registration-api.cjs (--file per-commit gate)"
  - phase: 267-07
    provides: "gate/chain/claim registrars on registerTool; fake-server fixture pattern"
provides:
  - "Every lib/mcp/tools/*.cjs registrar (context, dual-path, graph-reason, graph, identity, room, sensors, status, stop-gate, views, plus question) on server.registerTool: zero server.tool( sites remain under lib/mcp/"
  - "scripts/check-tool-honesty.cjs sees both registration forms (live sweep 42 tools / 136 branches / 0 high-risk, was blind to every migrated tool)"
  - "title on all 22 tools migrated here"
affects: [267-09, 267-10, 267-11]

tech-stack:
  added: []
  patterns:
    - "Mechanical registration rewrite via a one-off script (scratchpad, not committed) that re-indents the shape under inputSchema: z.object({ and derives the Title Case title; whitespace-insensitive diff (git diff -w) reviewed per file"
    - "A tool-honesty / enumeration scanner must be taught a new registration idiom in the same phase that migrates the sites, or the gate goes silently blind (toolCount fell 41 -> 22 -> 18 as files migrated)"

key-files:
  created: []
  modified:
    - lib/mcp/tools/context.cjs
    - lib/mcp/tools/dual-path.cjs
    - lib/mcp/tools/graph-reason.cjs
    - lib/mcp/tools/graph.cjs
    - lib/mcp/tools/identity.cjs
    - lib/mcp/tools/room.cjs
    - lib/mcp/tools/sensors.cjs
    - lib/mcp/tools/status.cjs
    - lib/mcp/tools/stop-gate.cjs
    - lib/mcp/tools/views.cjs
    - lib/mcp/tools/question.cjs
    - scripts/check-tool-honesty.cjs
    - tests/fixtures/tool-honesty/276-dispositions.json
    - tests/helpers/b2-358-child.cjs

key-decisions:
  - "question.cjs (question_read, question_set, Phase 358-09) was not in the plan's 20-site list but held the last 2 server.tool( sites under lib/mcp/; migrated as an eleventh file because the plan's own truth and acceptance grep demand zero remaining (Rule 3)."
  - "check-tool-honesty.cjs taught server.registerTool( (new exported normalizeToolCallArgs) in this plan rather than deferring again: 267-07's deferred-items entry assigned it to 'whichever later plan finishes the 51-site migration', which is this one, and finishing without it would leave the gate scanning zero tools."
  - "Honesty ledger re-frozen 41/135/123 -> 42/136/124: the extra row is research_run (Phase 363-17, verdict OK), a peer tool the old scanner could not see because it was natively registerTool."
  - "Fake-server fixtures taught a registerTool capture sibling (schema unwrapped via inputSchema.shape where the fixture reads per-key schema), the 267-06/07 pattern, rather than touching production code."

patterns-established:
  - "registerCoreTools() records a module whose register() throws as partial instead of failing: any fixture with a tool()-only stub silently loses the tools (surfaced as 'tool not registered' in test-358-b2-*). The live status_read tool_registration check and the live-vs-PLAN_BASE test diff are the backstops."

requirements-completed: [MCPV2-02, MCPV2-08]

duration: ~75min
completed: 2026-10-02
---

# Phase 267 Plan 08: Remaining Tool Registrar Rewrites Summary

**All 22 remaining server.tool sites under lib/mcp/tools/ (the plan's 20 plus question.cjs's 2) moved to server.registerTool config objects, one green commit per file, with the tool-honesty scanner taught the new form so the migration did not blind it; zero server.tool( sites remain anywhere under lib/mcp/.**

`PLAN_BASE=15865e148af5838f8b0203ff82e573c3b19a9ce9`

## Accomplishments

- 11 registrar files rewritten by the 267-06 rule (verbatim description and shape inside `z.object(...)`, mechanical Title Case title, callbacks and every `extra && extra.sessionId` read untouched, no strictness change, no connectors / hitl_shape change).
- Live wire after the plan: `tools/list` returns 45 tools, 0 untitled; `status_read` over stdio reports `capability_floor.tool_registration = {"complete":true,"failed":[]}`.
- `check-tool-honesty` live sweep: `OK (42 tool(s), 136 branch(es) scanned, 0 high-risk)`.
- `bash tests/run-all-198.sh`: `Passed: 13 Failed: 3` with the identical three legs as 267-BASELINE.md (Part 8 local-only floor, SPEC-2 contract-version + per-tool schema validity, SPEC-5 hooks adapter-only budget).

## Task Commits

| Commit | File | Sites |
|---|---|---|
| `c2fac202e` | lib/mcp/tools/context.cjs (+ test-347-context-focus fixture) | 1 |
| `fcc7251c4` | lib/mcp/tools/dual-path.cjs | 2 |
| `0189070fb` | lib/mcp/tools/graph-reason.cjs | 1 |
| `471320b3a` | scripts/check-tool-honesty.cjs scanner fix (+ ledger, switch-branches test) | n/a |
| `42814fa60` | lib/mcp/tools/graph.cjs | 3 |
| `0d1187a0b` | lib/mcp/tools/identity.cjs (+ 2 identity fixtures) | 1 |
| `095613175` | lib/mcp/tools/room.cjs (+ test-270-resource-session-room fixture) | 3 |
| `dfb031adf` | lib/mcp/tools/sensors.cjs (+ 4 fixtures) | 5 |
| `1e9cb5063` | lib/mcp/tools/status.cjs | 1 |
| `73246744d` | lib/mcp/tools/stop-gate.cjs | 1 |
| `555303c44` | lib/mcp/tools/views.cjs | 2 |
| `e46e235c5` | lib/mcp/tools/question.cjs (+ b2-358 fixtures) | 2 |
| `f5e2ef62f` | tests/test-260906-gr1-brain-shaped-tool-gate.cjs enumeration regex | n/a |

`git log --oneline 15865e148..HEAD -- lib/mcp/tools/<file>.cjs | wc -l` prints 1 for each of the eleven files. `grep -c "server\.tool(" lib/mcp/tools/*.cjs` is 0 everywhere; `grep -rn "server\.tool(" lib/mcp/ | wc -l` prints 0. `git diff 15865e148 -- lib/mcp/tools | grep "^[-+]" | grep -c "connectors\s*=\|hitl_shape"` prints 0.

## Per-commit gate output

Per commit: `node tests/test-267-mcpv2-registration-api.cjs --file <file>` passed in every case (context 1/1, dual-path 2/2, graph-reason 1/1, graph 3/3, identity 1/1, room 3/3, sensors 5/5, status 1/1, stop-gate 1/1, views 2/2, question 2/2, all `v2-config`).

`node tests/test-267-mcpv2-cirs-gates.cjs` and `node tests/test-267-mcpv2-zod4-contract.cjs` printed the SAME result lines after every commit, and those lines are byte-identical to the output at PLAN_BASE (verified by running both at a `git archive` copy of PLAN_BASE):

```
cirs-gates:  PASS Check (a) build-connector-registry.cjs --check -- exit 0
             PASS Check (b) check-shape-declaration.cjs --check --strict drift vs baseline -- 53 current violation(s), all within the recorded baseline, zero under lib/mcp/
             FAIL Check (c) connector-descriptor count matches 267-BASELINE.md -- expected 31 ... got 32
             RESULT: PASS=2 FAIL=1
zod4:        PASS Check (a) (zero description diffs) -- every tool and prompt description byte-identical to the zod 3 snapshot
             FAIL Check (b) (observed zod-4 diff set equals pinned accepted set) -- extras=["tool:research_run:membership"]
             PASS Check (c) (6 brain tools advertise additionalProperties:false)
             FAIL Check (d) (zod importer set stays inside the CTX boundary) -- scripts/fork359-permission-probe.cjs
             RESULT: PASS=2 FAIL=2
```

These three FAILs pre-date this plan and are peer-phase drift, not regressions from the rewrite: descriptor 32 vs 31 and the `research_run` membership extra come from Phase 363-17's new tool (committed `12ca953a0`), and `scripts/fork359-permission-probe.cjs` is a Phase 359-05 zod importer. They need a baseline/pinned-set refresh by whoever owns those (see ENV findings below). Check (a) in both gates, the part this plan can affect (registry --check, shape drift, byte-identical descriptions), stays green after every commit.

## Verification

- `grep -rn "server\.tool(" lib/mcp/` empty (0 lines).
- Live-vs-PLAN_BASE comparison of the whole 78-file related test set (every test requiring register-core-tools or lib/mcp/tools, run at a PLAN_BASE `git archive` copy and at the live tree with isolated HOME): after the fixture fixes the only deltas are improvements (test-276-claim-write-primitive 1 -> 0, test-358-b1-surfaces 1 -> 0, test-3551-tri-polar 1 -> 0) and one HOME artifact (see below). Named tests: `test-354-room-symlink-containment` PASS (10 checks), `test-198-stop-gate-retry-ceiling` PASS (15 assertions), `test-354-registration-diagnostics` PASS, `test-248-room-bind-session-authoritative` / `-honest-return` / `-resolver-census` PASS, `test-354-extract-shallow-contract` PASS (13 checks), `test-347-context-focus` PASS (6), `test-270-identity-write` and `test-267-2-cr-01-identity-write-merge` PASS.
- `node tests/test-267-mcpv2-registration-api.cjs` full mode is still RED, as designed: it reports only prompts.cjs (v1 `server.prompt`), resources.cjs (v1 `server.resource`), app-views.cjs (inputSchema via the ext-apps helper) and `live tools/list count (45) != wire-snapshot-zod4.json (44)` (the +1 is `research_run`). No `lib/mcp/tools/*`, tool-router or contract-version line fails.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] question.cjs migrated though not in the plan's file list**
- **Found during:** pre-edit grep (`grep -c server.tool( lib/mcp/tools/*.cjs` showed 22, not 20)
- **Issue:** question_read / question_set (Phase 358-09, landed after the plan was written) were the last 2 variadic sites; the plan's truth ("zero server.tool( under lib/mcp/") and Task 2 verify could not pass otherwise.
- **Fix:** same rule, own commit `e46e235c5`.

**2. [Rule 1 - Bug] check-tool-honesty.cjs only recognized `server.tool(`**
- **Found during:** Task 1 (graph.cjs): test-276-b6-parameter-describe went 0 -> 1, and the commit hook's `check-tool-honesty` line showed the tool count falling (21, 19, 18) as files migrated.
- **Issue:** every migrated tool silently dropped out of the honesty sweep; finishing the migration would have left it scanning nothing (a false-green gate). This was the finding 267-07 deferred "to whichever later plan finishes the migration".
- **Fix:** `findServerToolCalls` matches both forms; new `normalizeToolCallArgs` (exported) extracts the `description:` key and uses the config object as schema text; `tests/test-276-tool-honesty-switch-branches.cjs` `locateToolCallHandlerBody` reuses the checker's helpers; ledger `tests/fixtures/tool-honesty/276-dispositions.json` re-frozen 41/135/123 -> 42/136/124 (extra row `research_run`, verdict OK). Commit `471320b3a`. Resolves 267-07's deferred item (also clears `test-276-claim-write-primitive` 43/44 -> 44/44).

**3. [Rule 1 - Bug] 13 fixtures that only implemented `tool()` / enumerated `server.tool(`**
- **Fixtures given a `registerTool` capture sibling:** tests/test-347-context-focus.cjs, tests/test-270-identity-write.cjs, tests/test-267-2-cr-01-identity-write-merge.cjs, tests/test-270-resource-session-room.cjs, tests/test-c8j-suggest-next-offer.cjs, tests/test-222-reach-wired.cjs, tests/test-348-mcp-flag.cjs, tests/test-365-falsify-destination.cjs, tests/test-358-b2-surfaces.cjs, tests/helpers/b2-358-child.cjs (schema unwrapped through `inputSchema.shape` where the fixture reads per-key schema).
- **Regex updated:** tests/test-260906-gr1-brain-shaped-tool-gate.cjs GROUP 3 (found 0 local tool names, tripping its own >= 20 vacuous-pass floor).
- Each rode in the commit of the registrar that broke it, except the gr1 test (`f5e2ef62f`).

## Known Stubs

None.

## ENV / peer findings (not fixed, not mine)

- `test-267-mcpv2-cirs-gates` Check (c): expects 31 connector descriptors, tree has 32 (research_run, Phase 363-17). Baseline needs a refresh.
- `test-267-mcpv2-zod4-contract` Check (b) extras `tool:research_run:membership` and Check (d) `scripts/fork359-permission-probe.cjs` (Phase 359-05): pinned accepted-set / importer baseline need refresh. Both gates fail identically at PLAN_BASE.
- `test-267-mcpv2-registration-api` full mode: `wire-snapshot-zod4.json` local tool count is 44, live is 45 (research_run); will keep failing after 267-09 unless the snapshot is refreshed.
- Tests `test-354-concurrency-surfaces`, `test-354-poc-room-journey` exit non-zero with an empty `HOME` (PLAN_BASE copy exits 77, a skip) but pass (exit 0, both trees) with the real HOME; a fresh-HOME artifact of my comparison harness, not a regression.
- Orchestrator note received mid-run: my first broad test sweep (grep on `memory_event`/`graph_*`) ran `tests/test-section-nodes-birth-and-migration.cjs` against the real HOME, leaking temp rooms into the real `~/MindrianRooms/.rooms/registry.json` (already repaired by the orchestrator). All later sweeps used a fresh `HOME`/`MINDRIAN_ROOMS_HOME` per test and excluded that file.
- Untouched peer files at the end of the run (not mine, not committed by me): lib/core/navigation/room-birth.cjs, lib/core/research-planner/*, tests/test-366-theo-lateral-lane.cjs, tests/test-section-nodes-birth-and-migration.cjs, CHANGELOG.md, scripts/room-registry, plus untracked theo-lane.cjs and test-registry-tmp-leak-guard.cjs.

## Threat Flags

None. No new network endpoints, auth paths or schema changes; handler bodies, `extra.sessionId` reads, write scopes and CIRS exports are byte-untouched (T-267-20/21/22/24 mitigations hold: zod4 Check (a) byte-identical descriptions after every commit, room-bind / resolver-census / symlink-containment tests green).

## Self-Check: PASSED

- All 13 commit shas above resolve in `git log` on main.
- The 11 registrar files exist and contain 0 `server.tool(` and the expected `server.registerTool(` counts (1,2,1,3,1,3,5,1,1,2,2).
- Per-file commit counts since PLAN_BASE are 1 for each of the 11 files.
