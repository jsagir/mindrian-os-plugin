# Phase 374: Adapter surface completion - Research

**Researched:** 2026-11-08
**Domain:** MindrianOS MCP adapter for the local Eureka engine (Node CJS plugin side; Python engine read only)
**Confidence:** HIGH for plugin-side facts (read in the tree, several probes run); MEDIUM for engine behavior (read in source, not run); LOW for the lingering-child behavior after a host kill (not tested)

Provenance tags: PROVEN = read in a file or run in this session. CITED = taken from the Eureka run contract. ASSUMED = not verified. Plugin tree: `/home/jsagi/dev/MindrianOS-Plugin-release`, HEAD `62e2a4ec9`. Engine tree (read only, no git, nothing run there): `/home/jsagi/dev/mindrian-eureka`.

<user_constraints>
## User Constraints (from CONTEXT.md)

No `374-CONTEXT.md` exists. The phase dir did not exist; this run created `.planning/phases/374-adapter-surface-completion-remaining-eureka-graph-tools-capa` (the `expected_phase_dir` of `gsd-tools query init.phase-op 374`).

### Locked Decisions
None recorded. The binding text is the ROADMAP entry for Phase 374 (ROADMAP.md lines 3708-3718), copied here:
- Goal: complete the Eureka adapter surface beyond the Phase 373 services, with the tool-budget decision made and job state surviving a host restart.
- Gates: beta.73 cut; plugin node_modules restored; Eureka job-store lock and budget status landed (external, Eureka repo); owner call on the 25-tool surface.
- Standing rules from project CLAUDE.md: Canon Part 8 (no room bytes to Brain), Part 7 (reuse before build), Part 11 (born wired, HITL shape declared), no em-dashes, all dev work through GSD, TypeScript allowed but hooks and MCP server stay `.cjs`.

### Claude's Discretion
All design choices below are open to the planner, except the items in "Open Owner Decisions".

### Deferred Ideas (OUT OF SCOPE)
Phases 375 to 378 (evidence gate, bounded focus, outer ring, review surface) and Phase 379 (RS split-out). The provenance gap marks (HOST-02) are a host-owned room write and are not part of 374.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ADAPT374-01 | Tool-budget decision with the token figure | Section "Tool-Budget Decision": live 75 tools, 83,800 bytes, about 20,950 approx tokens; 26 Eureka-family tools = 25,977 bytes |
| ADAPT374-02 | Job sessions bound to MCP session and room, request size cap, recovery of a lost job by asking Eureka | Section "Job State Across a Host Restart"; Eureka job-store hazards |
| ADAPT374-03 | Projection handle or paging above 256 KiB | `TEXT_WARNING_BYTES` is only a warning today (`eureka-tool-contract.cjs:238`); result size for pair screen is ASSUMED about 0.5 MB |
| ADAPT374-04 | Generic path refuses results without scope and snapshot ids | `jobResult` checks scope only when the session bound it (`eureka-capability-jobs.cjs:188-189`) |
| ADAPT374-05 | Catalog cached per process | Every call spawns a child and calls `scout_capabilities` (`eureka-capability-run.cjs:221`, `eureka-capability-jobs.cjs:53`) |
| ADAPT374-06 | Live tests (bridge, job cancel, capability run) pass on an idle host | Existing live tests listed under "Validation Architecture" |
</phase_requirements>

## Summary

Four findings change the plan. First, the roadmap item "remaining dedicated graph tools" is already done. All 14 `graph.*` catalog entries have a dedicated plugin tool (9 tool files plus the 5 services in `eureka-graph-discovery-signals.cjs`). Nothing is left to add there. PROVEN by comparing the catalog list with the `CAPABILITY_ID` constants and the five spec ids. The real new work is the pair-screen capability (`opportunity.run_pair_screen`), the job-state work, and the stale test pins.

Second, the Eureka session's plugin list is incomplete. Raising the plugin caps to 3,000 nodes does nothing alone, because the bundle for 3,000 artifacts cannot be built. `graph.prepare_artifact_bundle` is capped at 2,500 inside the engine (`graph_relations/runner.py:26`, input schema `maximum: 2500`, output schema `maxItems: 2500`). The plugin projection core also caps at 2,500 (`lib/core/navigation/engine-projection.cjs:10`) and at 12 MiB of output (`:13`). The generic `eureka_capability_start` takes a free-form `request` record, so it has no node cap at all. Recommendation: keep 2,500 in 374, add only `top_k` 200, and treat 3,000 as an owner decision (see D3).

Third, the Eureka job store is not safe for the plugin's one-child-per-job design today. Every new `eureka-mcp` process marks all `running` rows as `failed / server_restarted` at start (`opportunity_pairs/jobs.py:101-109`). The plugin starts a new child for every job start and every graph workflow call. So a graph call during a pair-screen run fails that run's row. This is the "owner lock and terminal-state guard" prerequisite in the ROADMAP gate. It is still not landed in the engine tree I read. Cross-process cancel is also a no-op: `cancel_requested` is written to the database and never read by a worker (grep, `jobs.py:192,197` only).

Fourth, the tool budget has no hard cap. Adding the pair screen needs 0 new tools if the plan step folds into `eureka_capability_start`. The recommended design adds 0 tools and at most 1 (a forget/delete tool).

**Primary recommendation:** Wire `opportunity.run_pair_screen` through the existing `eureka_capability_start` and job tools (two-phase: plan call mints a `material_step` gate; `gate_answer` approve runs the start). Keep the tool count at 75, keep node caps at 2,500, add a plugin-side job record outside Eureka so a restarted host can ask Eureka for status. Schedule the stale 267 snapshot refresh as Wave 0 of the same plan set.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Select nodes, project room text | Plugin MCP server (local) | Room database (read only) | Only the plugin may read `room.db`, through `navigation.cjs` |
| Build pair-screen bundle | Plugin MCP server | Engine (`prepare_artifact_bundle`, max 2,500) | The engine is a pure function over what the host sends |
| Plan and digest | Engine (`scout_plan_pair_screen`) | Plugin (shows it) | The digest is of the exact request; the plugin must not edit the request after planning |
| Approval | Plugin gate ledger plus `gate_render`/`gate_answer` | Person | Engine cannot verify approval (`verified_by_engine: false`, CITED) |
| Run and rank | Engine (durable job, one worker thread) | - | Deterministic code, no LLM |
| Job record, 30-day store | Engine job store (`jobs.sqlite3`) | Plugin pointer record | Plugin keeps ids only, never text |
| Result verification (scope, hashes, label) | Plugin | - | Contract rule: the host checks `schema_version`, scope echo, file hashes |
| Filing, review, source resolution | Plugin | Person | Engine writes nothing to a room (`room_write: not_performed`, CITED) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@modelcontextprotocol/client` | installed in `node_modules/@modelcontextprotocol/client` | Stdio client to the engine child | Already used by all four spawn sites (PROVEN: `eureka-capability-run.cjs:11-12`, `eureka-capability-jobs.cjs:8-9`) |
| `zod` | ^3.25.76 per project CLAUDE.md | Tool input schemas | House standard |
| Node.js | 22.23.1 here, floor 22.18.0 | Runtime | PROVEN: `node --version` |
| `uv` | 0.9.4 here | Starts `eureka-mcp` | PROVEN: `uv --version` |

### Supporting
No new package. No package is installed by this phase.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Fold plan into `eureka_capability_start` | New tool `eureka_pair_screen_plan` | +1 tool, about 1,000 bytes (mean of 23 measured Eureka tools is 1,001 bytes). Clearer card contract, but moves the budget |
| Plugin job record file | Read Eureka `jobs.sqlite3` directly | Crosses the engine's private boundary; breaks when the schema moves. Do not do this |

**Package Legitimacy Audit:** Not required. This phase installs no external package. slopcheck was not run because there is nothing to check. Packages removed: none. Packages flagged: none.

## Verified Handoff Facts (claims from the Eureka session)

| Claim | Result |
|-------|--------|
| Engine registers 27 MCP tools incl. `scout_plan_pair_screen`, `scout_start_pair_screen` | PROVEN: 27 `@server.tool()` decorators in `opportunity_pairs/mcp_server.py`; both names present (lines 343-369) |
| Capability id `opportunity.run_pair_screen`, status experimental | PROVEN: catalog entry; `routes.mcp.tool = scout_start_pair_screen`, `plan_tool = scout_plan_pair_screen`; catalog has 68 entries, 60 with a route |
| Plan then start with `plan_digest` and `approval_ref` | PROVEN: `PairScreenInput.approval` (mcp_server.py:109), schema `pair-screen-input.v1.json` |
| Refusal is `status: refused` with a reason code | CITED (run contract table lines 180-198); 11 of 15 codes reach a host as refused, 2 are tool errors only, 2 come back as `status: blocked` |
| Result `eureka.pair-screen.v1` with `host_handoff` | PROVEN: output schema `$id`, `schema_version` const, `host_handoff` in required |
| Input 2 to 3,000 artifacts, `scope_id`, `snapshot_id` | PROVEN: `limits.py` `MAX_ARTIFACTS=3000`, `MAX_TOP_K=200`, schema `minItems 2 maxItems 3000` |
| Plan receipt lives 24 hours | PROVEN: `PLAN_TTL_SECONDS = 86400` (`host_run/contracts.py:48`). The receipt row is kept 30 days as an audit row (`RECEIPT_RETENTION_SECONDS`, line 49); the contract page says 24 hours. Minor doc gap |
| PLG-01 recorded Eureka side | PROVEN: `.planning/REQUIREMENTS.md:71` of the Eureka repo |
| Plugin still needs two routes, `routeGate` and caps | PROVEN and incomplete: see D3 and "Pitfall 1" |

## Exact Edit List (plugin, by file and current line)

All line numbers are from HEAD `62e2a4ec9` and will move; the planner must re-grep.

| # | File:line | Edit | Req |
|---|-----------|------|-----|
| E1 | `lib/mcp/tools/eureka-capability-run.cjs:15-22` | Add `scout_start_pair_screen` to `ALLOWED_MCP_ROUTES`. Add `scout_plan_pair_screen` to a new `PLAN_ROUTES` set (it is not a job route and not a start route) | ADAPT374 |
| E2 | `eureka-capability-run.cjs:92-100` (`resolveCapability`) | Today it accepts the catalog route only. Read `routes.mcp.plan_tool` and carry it in the resolved capability so the plan call can use the catalog value, never a hard-coded name | - |
| E3 | `eureka-capability-run.cjs:175-185` (`invokeCapabilityWithClient`) | The sync path starts a job only for `scout_start` and `scout_start_opportunity_signal_scout` (line 181). Add `scout_start_pair_screen` there, or refuse the sync path for it with `capability_requires_approval` so no run can start without a gate | - |
| E4 | `eureka-capability-run.cjs:24` and `:207` | `MAX_REQUEST_BYTES` (20 MiB) is enforced on the sync path only. Move the check into a shared helper and call it from the job start too (E7) | ADAPT374-02 |
| E5 | `eureka-capability-run.cjs:154,186` and `eureka-capability-jobs.cjs:182-193` | Add the pair-screen result verifier (schema_version, capability_id, scope_id and snapshot_id echo, `files[].sha256` against UTF-8 `content`, label, `completed_empty`, `caps_hit`, `warnings`). One shared module, for example `lib/mcp/eureka-pair-screen.cjs` | ADAPT374-04 |
| E6 | `lib/mcp/tools/eureka-capability-jobs.cjs:14` | Add `scout_start_pair_screen` to `ASYNC_ROUTES` | - |
| E7 | `eureka-capability-jobs.cjs:26-110` (`startCapability`) | (a) enforce the request size cap; (b) require string `scope_id` and `snapshot_id` in the request (today `args.request.scope_id || null`, line 83); (c) store `sessionKey` and `room_id` on the session record (line 80-85); (d) persist the job pointer record (see Job State); (e) pass `idempotency_key` through (already done at line 73) | ADAPT374-02, -04 |
| E8 | `eureka-capability-jobs.cjs:112-126` (`getSession`) | Today any caller with a `job_id` reaches any session in the process. Take the caller session key and the bound room id, refuse a mismatch with a typed `job_session_wrong_owner` | ADAPT374-02 |
| E9 | `eureka-capability-jobs.cjs:128-216` (`jobStatus`, `jobResult`, `cancelJob`) | When `getSession` finds nothing, read the plugin job record. If a record exists, open a short status-only child and call `scout_status` or `scout_result`. Run the verifier on the result (E5). Cancel for a recovered job returns `cancel_unavailable_after_restart` (the engine cannot cancel across processes) | ADAPT374-02 |
| E10 | `eureka-capability-jobs.cjs:188-189` | Make the scope check unconditional: refuse when the result has no `scope.scope_id` or `scope.snapshot_id`, or when they differ from the record | ADAPT374-04 |
| E11 | `lib/core/eureka/eureka-engine-requirements.cjs:111` and `:130` | Add `opportunity.run_pair_screen` to a new `PAIR_SCREEN_IDS` set and add a branch: `cell(['mcp-server', encoderExtra(env)], 'yes', 'no', 'engine-read', 'engine-read')`. Do NOT add it to `PAIR_IDS`: that set also drives the "embedding cache may be written" label in `eureka-tool-contract.cjs:271-274` and `eureka-capability-run.cjs:257`, and pair screen keeps no vectors (CITED: `derived_vectors` states none is kept) | - |
| E12 | `lib/mcp/eureka-tool-contract.cjs:140-161` (`routeGate`) | No code change needed if E11 lands: `routeGate` reads `needsForCall(toolName, args)` and `args.capability_id` for both capability tools. Add the new plan path to the tool-name test in `needsForCall` only if a new tool name is added | - |
| E13 | `eureka-tool-contract.cjs:49-53` | `JOB_LIFECYCLE_TOOLS` skips the engine gate for status, result and cancel. Recovery spawns a child from these tools, so the recovery path must call `engineRefusal` itself before it spawns | ADAPT374-02 |
| E14 | `lib/mcp/tools/eureka-graph-opportunity-scout.cjs:71` | `top_k` max 100 to 200 (engine accepts 200 for all three input models: `mcp_server.py:64,76,108` use `MAX_TOP_K`). Only if the planner wants the scout lifted too | PLG-01 |
| E15 | `eureka-graph-opportunity-scout.cjs:68,70`, `eureka-graph-prepare-artifacts.cjs:51,53`, `eureka-graph-projection.cjs:103`, `lib/core/navigation/engine-projection.cjs:10,86-87` | Node caps 2,500 to 3,000. NOT recommended in 374 (D3). If chosen: all five sites, plus Eureka must lift `graph.prepare_artifact_bundle` from 2,500 (Eureka-side), plus review the 12 MiB ceiling at `engine-projection.cjs:13` | PLG-01 |
| E16 | `lib/mcp/tools/eureka-capability-jobs.cjs:243-264` (descriptions) and `eureka-capability-run.cjs:272` | Descriptions say "Jobs cannot resume after the MindrianOS MCP process restarts". Rewrite once recovery lands. Changes tool-schema bytes: golden and snapshot refresh needed (see Tool Budget) | - |
| E17 | `eureka-capability-jobs.cjs:266-272` (`connectors`) | The four job tools declare `hitl_shape: 'none'`. The start tool now mints an approval gate for one capability. Re-declare per Part 11 and run `node scripts/build-connector-registry.cjs --check` | - |
| E18 | `commands/eureka.md` and the born-wired registries | New subcommand for the run (name is open question (a) in the run contract). Part 11 born-wired gates and `scripts/check-shape-declaration.cjs` apply | - |
| E19 | ADAPT374-05 | Cache the catalog and contracts per process in a module-level map keyed by engine root. Today every call spawns a child and calls `scout_capabilities` first. Invalidate on engine root change | ADAPT374-05 |

## Tool-Budget Decision (ADAPT374-01)

### Measured facts (PROVEN, run 2026-11-08)

Method: the same `tools/list` probe as `tests/test-270-tool-schema-budget.cjs` (hermetic HOME, real stdio server), bytes = description bytes plus `JSON.stringify(inputSchema)` bytes, tokens = bytes / 4. That divisor is a proxy (Phase 270 assumption A1), good only for comparing with other numbers from the same function.

| Measure | Value |
|---------|-------|
| `test-270-tool-schema-budget.cjs` run | 5 of 5 pass |
| Live tools | 75 |
| Live total bytes | 83,800 (36,269 description + 47,531 schema) |
| Live approx tokens | about 20,950 |
| Recorded AFTER (`test-270...cjs`, quick 261024-uqs) | 75 tools, 83,522 bytes, 20,881 tokens |
| Drift vs AFTER | +278 bytes, +0.33 percent |
| Eureka-family tools (`eureka_*`, `rs_*`) | 26 tools, 25,977 bytes, about 6,494 tokens, 31.0 percent of the surface |
| 17 `eureka_graph_*` tools | 16,953 bytes, about 4,238 tokens |
| 5 capability and job tools | 3,610 bytes, about 903 tokens (mean 722 each) |
| 3 job lifecycle tools | 1,341 bytes (mean 447 each) |
| Largest single tool | `eureka_hsi_interpret_whitespace`, 2,463 bytes |
| Tolerance headroom | AFTER 83,522 times 1.10 = 91,874 bytes; headroom 8,074 bytes, about 2,018 tokens |

The 25 tools added by commit `6bc8cfc55` (2026-10-24, beta.74 squash) cost about +6,126 tokens that day (recorded in the test header). That re-baseline already happened.

### What gates a new tool (PROVEN)

1. `tests/test-270-tool-schema-budget.cjs`: `toolCount` must equal `AFTER.toolCount` exactly; bytes must stay within 10 percent of `AFTER.totalBytes`. A new tool means editing `AFTER` and adding a dated comment block with measured numbers (the file's own protocol).
2. `tests/test-384-s7-mcp-start.cjs` parity group: full equality of `tools/list` (name, title, description, inputSchema, outputSchema, annotations) with `tests/fixtures/384-s7-tools-list-golden.json`. Run today: all pass. The golden holds 72 tools, not 75: 75 minus the 3 App tools (`room-dashboard`, `room-wiki`, `room-graph`) that the other harness registers. The 3-tool gap is arithmetic; the cause is not traced. Regenerate with `SPEED384_WRITE_GOLDEN=1 node tests/test-384-s7-mcp-start.cjs parity` (header of that test). Any description change on any tool needs this regeneration. A new tool file also adds a name to `health.registered` (37 names now).
3. The 267 wire snapshots (`tests/fixtures/267/wire-snapshot-zod3.json` and `-zod4.json`): stale now, see next section.
4. `node scripts/build-connector-registry.cjs --check` (born-wired, Part 11) and `scripts/check-shape-declaration.cjs` (advisory).
5. The 276 frozen sweep named in commit `3379e406c` for room tools (not re-run here; UNVERIFIED for eureka tools).

No rule in the repo caps the number of tools. No client-side limit was found in this session; a figure for the Claude hosts' tool limits is absent.

### How many tools may be added

Within the existing test tolerance, 8,074 bytes of headroom fits about 8 tools at the Eureka mean (1,001 bytes) or about 11 at the capability-tool mean (722). That is arithmetic on measured means, not a recommendation. Each added tool still forces an `AFTER` edit, a golden regeneration and a snapshot refresh.

### Recommendation

1. Do not build a router in 374. A router renames 23 shipped tools, which are pinned in 3 fixtures, 2 command docs and the skill. The token gain is bounded above by 16,953 bytes (the 17 graph tools) minus the router's own size, which is not measured. The 25 tools were already re-baselined on 2026-10-24.
2. Add 0 tools for the pair screen: the plan step is a branch of `eureka_capability_start` (no `approval` in the request means plan and mint a gate; the gate's resume function does the start).
3. One optional tool: `eureka_capability_job_forget`, wrapping `scout_delete_job`, so a person can delete the 30-day record (the contract's step 10). Estimated cost: about 450 bytes (mean of the three job tools). If the owner wants zero new tools, document the CLI delete path instead.
4. The router question belongs to a later phase with its own measurement. Record it as an owner decision (D1).

## Stale 267 Snapshot Arms (PROVEN, run today)

The handoff says 2 arms are red "since Phase 387". The measured picture differs:

| Test file | Red legs | Cause |
|-----------|----------|-------|
| `tests/test-267-mcpv2-dual-era.cjs` | 2 (era 2025, era 2026), `PASS=3 FAIL=2` | Live has 25 tools the snapshot lacks (all `:membership`); snapshot holds 50 tools |
| `tests/test-267-mcpv2-zod4-contract.cjs` | 1 (Check b), `PASS=3 FAIL=1` | Same 25 names appear as extras against the zod3 snapshot |
| `tests/test-267-mcpv2-clients.cjs` | 1 (`shim unbound ... snapshot tool count`), `4 passed, 1 failed` | `75 !== 50` |
| `tests/test-267-mcpv2-registration-api.cjs` | 17 (`PASS=74 FAIL=17`) | 16 "zero calls attributed to this file" (the Eureka and RS tool files register through `registerEurekaTool`, so the call is attributed to `eureka-tool-contract.cjs`) plus 1 count (75 vs 50) |
| `tests/test-267-mcpv2-lockstep.cjs` | green, `PASS=6 FAIL=0` | - |

Root cause: `wire-snapshot-zod4.json` was last moved by quick 261020-0ys / 372 (50 tools, header says "added room_create and room_startup, 48 -> 50"). Commit `6bc8cfc55` of 2026-10-24 added 25 tools and did not move the pins. So the arms are red since beta.74, not since Phase 387. `tests/fixtures/3696-known-failures.json` records `test-267-mcpv2-dual-era.cjs` and `test-267-mcpv2-registration-api.cjs` as known failures (the other two are not in that list: UNVERIFIED whether they are listed elsewhere).

Fix precedent: commits `3379e406c` (room tools, 48 to 50) and `224cc7b26` (moved pins in both `wire-snapshot-zod3.json` and `wire-snapshot-zod4.json`). Capture from the live wire, update both snapshots, record the add in `refreshed_by`. The registration-api attribution failure needs a code fix in the test (attribute `registerEurekaTool` calls to the calling tool file), not a snapshot move; the planner should treat it as a separate task. Schedule one snapshot refresh in Wave 0, after any description edits of this phase land, so the refresh is done once.

## Job State Across a Host Restart (ADAPT374-02)

### Where job records live today (PROVEN by reading)

| Store | Location | Holds | Lifetime |
|-------|----------|-------|----------|
| Engine job store | `MINDRIAN_EUREKA_DATA_DIR` or `~/.local/share/mindrian-eureka/jobs.sqlite3` (`jobs.py:26-28`). Files seen on this machine: `jobs.sqlite3`, `plan-receipts.sqlite3`, `embeddings.sqlite3`. Contents were not read | job row, request JSON until terminal, result JSON, events, reviews | `RETENTION_SECONDS` = 30 days; `expire_old()` at every store open |
| Plan receipts | `plan-receipts.sqlite3` in the same dir | digest, ids, times; no artifact text | 24 h live (`PLAN_TTL_SECONDS`), audit row 30 days |
| Plugin session table | in-process `Map` `sessions` (`eureka-capability-jobs.cjs:16`) | client handle (the child process), job id, scope ids | 30 min TTL (`:17`), max 8 (`:18`), lost on restart |
| Plugin gate ledger | in-process `Map` (`gate-ledger.cjs`), 30 min TTL, not restart-surviving; card contract is also recorded in the room by `gate-raised.cjs` | gate id, card, `resumeFn` | 30 min |

`resumeFn` closures are never persisted, so a gate minted before a restart cannot be answered after it (`unknown_gate`). The plan receipt, by contrast, survives a restart for 24 h, so a re-plan is cheap and the new digest is the same for the same request.

### What happens on restart (read from engine source)

1. The host dies. The stdio child gets end of input. Whether `eureka-mcp` exits at once is UNVERIFIED: `JobManager` uses a `ThreadPoolExecutor` (`jobs.py:347`), whose worker threads are joined at interpreter exit, so a running job may keep the child alive until it ends. This must be tested live (RED-first live test T12).
2. Any later `eureka-mcp` start runs `JobStore._init_db` which calls `_recover_interrupted` (`jobs.py:95,101-109`): every row with status `running` becomes `failed`, `progress='interrupted'`, `failure_code='server_restarted'`, request cleared. There is no owner check. Rows with status `queued` are re-submitted by the new process (`JobManager.__init__`, `jobs.py:352-353`), so two live processes can run the same queued job.
3. `transition()` (`jobs.py:~168-186`) has no terminal-state guard. A worker that finishes after its row was marked failed overwrites the row with `completed`.

Consequences for the plugin:
- A completed job survives a restart and its result is readable for 30 days from a fresh child. This is the recoverable case.
- A running job at restart is lost or doomed. Do not promise resume. Promise: "ask Eureka for its status", and report `failed / server_restarted` honestly.
- Today's design starts one child per job (`startCapability`) and one per graph workflow call (`callEurekaWorkflow`). Starting any second child while a pair-screen job runs fails the first job's row, then the first worker may overwrite it. This hazard exists now for the `scout_start` jobs too. It is the external gate "Eureka job-store lock and terminal-state guard".
- Interim plugin guard (until the lock lands, ASSUMED sufficient for one host process only): refuse to spawn an Eureka child for another call while `sessions.size > 0`, with a typed `engine_busy` answer. This does not protect against two host processes (CLI plus Desktop), so it is a mitigation, not the fix.
- Cross-process cancel does nothing: `request_cancel` sets `cancel_requested=1` (`jobs.py:192`) and `_execute` clears it at start (`:197` is the only other write); no worker reads it. Cancel works only through the `cancel_event` held by the process that started the job.

### What the plugin must persist (recommended)

One small JSON record per started job. Ids and hashes only. No artifact text, no title, no result body.

| Field | Purpose |
|-------|---------|
| `job_id`, `capability_id`, `route` | Ask Eureka for status |
| `scope_id`, `snapshot_id`, `room_id` | Bind the record to the room; refuse another room |
| `session_key_hash` | Bind to the MCP session (hash, never the raw id; the gate record already follows this rule, `gate-raised.cjs` header) |
| `request_sha256`, `artifact_count`, `top_k` | Prove a retry is the same request |
| `plan_digest`, `approval_ref` (the gate id), `idempotency_key` | Audit and safe retry (Eureka returns the same job for same key and same approval ref, CITED) |
| `started_at`, `engine_expires_at` (start plus 30 days) | Stop asking after expiry |
| `last_status`, `last_status_at`, `terminal` | Cheap answers without a spawn |
| `manifest_sha256` (after result) | Name the run in one value |

Location is owner decision D4. Recommended: a per-user directory such as `~/.mindrian/eureka-jobs/<room_id>/<job_id>.json` (owner-only mode, 30-day sweep), because (a) the Eureka job store is itself per user, not per room; (b) no room write scope is needed; (c) it follows the existing `~/.mindrian/` precedent (`answer-route.cjs:47`, release receipts). The alternative is `<room>/.mindrian/eureka-jobs/`, which keeps the pointer with the room but needs the room write scope check (`isRoomInWriteScope`) and travels with a room copy. Either way the file stays local and never reaches a Brain call.

Recovery rule: a record with `terminal: false` and a job unknown to the in-process table triggers one status-only child, closed after the call. The child start itself runs `_recover_interrupted`, so the first status after a restart may read `failed / server_restarted` for a job that was still running in a lingering child. State this limit in the tool answer.

## Part 8 Egress Consequences

- The canon rule is LOCAL to BRAIN: no. The Eureka child is local. Room text sent to it over stdio is not Brain egress, provided the child makes no network call. PROVEN for the plugin side: the child env is an allowlist (`EUREKA_CHILD_ENV_KEYS`, `eureka-capability-run.cjs:29-38`) with `UV_OFFLINE`, `HF_HUB_OFFLINE`, `TRANSFORMERS_OFFLINE` forced to `1` on this path (`:81-83`); the uv array carries `--no-sync --offline --locked --no-python-downloads` (`requirements.cjs` `uvRunArgs`). `tests/test-387-eureka-egress.cjs` proves this with a fake engine and a network counter (arms A1 to A10).
- What leaves the room: only the nodes the person selected by id, as artifact `id`, `source_ref`, `title`, `text` (capped at 4,096 characters per node by `MAX_TEXT_CHARS`, `engine-projection.cjs:11`), and `sha256`. Edges are not sent to the pair screen. The room path and `room.db` never cross (arm A5).
- Never send pair-screen result text (titles, source refs, excerpts) to Theo or Brain (CITED rule 273 of the run contract). The result carries room content. Guards: `tests/test-341-eureka-no-brain-reach.cjs` and `test-387-eureka-egress.cjs` P1 must cover the new module (add the file to their scan lists).
- Content now rests outside the room: the result (titles, source refs) stays in the engine job store for 30 days under the user's home directory. The approval card must say so in plain words, with the delete path (D2).
- A sealed or archived room is already refused by the projection (`eureka-graph-projection.cjs:20-37`, `GUARDRAIL.md`, registry state). The pair screen must build its bundle through that same `project()` so the rule holds. Do not add a second reader.
- The gate card is recorded in the room by `gate-raised.cjs` (card contract only, no session id). Keep the plan summary to counts and fixed sentences: no node titles on the card.
- `tests/test-234-free-core-network-scan.cjs` already fails on three files (`eureka-hsi-interpret-whitespace.cjs`, `identity.cjs`, `sensors.cjs`; recorded in 373 summaries as pre-existing). The new module must not add a fourth.
- One live-run caveat for Part 8: `MINDRIAN_EUREKA_ALLOW_NETWORK=1` lifts the offline forcing (`:81`). The pair screen needs no network. Refuse to start a pair-screen job when that opt-in is set, or state it on the card (ASSUMED rule; owner may prefer to allow).

## Approval Gate Wiring

Pattern to copy (PROVEN): `mintApprovalGate` in `lib/mcp/tools/research.cjs:152-235`. It renders the card through `gateRender.renderGate`, then calls `gateLedger.mintGate(gateId, { card, sessionId, kind: 'material_step', resumeFn, approving, renderer })`. `gate_answer` consumes the gate, checks that the verdict agrees with `approving`, then calls `resumeFn` (`gate.cjs:1067,1115,1797`). An inline elicitation answer consumes the gate in the same call. Gate ids are `'gate-' + 16 hex` (`gate-render.cjs:290`), which fits the engine's `approval_ref` pattern `^[A-Za-z0-9][A-Za-z0-9_.:#/-]{0,127}$` (pattern PROVEN in `pair-screen-input.v1.json`).

Flow:

1. Person selects nodes. `eureka_capability_start` is called with `capability_id: opportunity.run_pair_screen` and a request without `approval`.
2. Plugin builds the bundle through `project()`, runs `routeGate`, spawns one child, calls `scout_plan_pair_screen` with the request, closes the child. The plan receipt is stored by the engine.
3. If the plan is `blocked` (`local_model_unavailable`, `too_few_usable_records`) or `refused`, return a typed fixed-sentence refusal. No gate.
4. Otherwise mint a `material_step` gate whose card shows counts, dropped records, the two engines, the data statement, the expected files, the model state, the 30-day record and the delete path. `approving: ['approve_run']`. The `resumeFn` closure holds the request and `plan_digest`; it is the only code that calls `scout_start_pair_screen`.
5. `gate_answer` with an approve verdict runs `resumeFn`: it builds the start request with `approval: { plan_digest, approval_ref: <gate id> }`, an idempotency key, calls the existing session start, writes the job record, and returns the job id.
6. Reject or defer returns "nothing started" and keeps the receipt unused (it expires in 24 h).
7. Status, result and cancel use the existing job tools.

Rules the tests must pin: the request in step 5 is byte-equal to the planned request apart from `approval` (the digest covers everything else, CITED); a start never happens without a consumed gate; the gate is single use (second `gate_answer` is `unknown_gate`); `plan_consumed` is shown as is and not retried silently (run contract acceptance check 1); a restart between plan and answer gives `unknown_gate`, and the person re-plans.

Part 7 note: `detectClientCapabilities` already exists in three tool files (`stop-gate.cjs:33`, `chain.cjs:141`, `gate.cjs:616`) and `mintApprovalGate` is private to `research.cjs` (not in its exports, lines 891-897). Do not write a fourth copy. Extract `mintApprovalGate` into a shared module (for example `lib/mcp/approval-gate.cjs`) in a refactor task with its own test, then call it from both. Shape: `commands/eureka.md` uses F.6 for plan review and F.0 for grants. F.6 is the run contract's suggestion and is ASSUMED right (owner decision D5).

## Architecture Patterns

### System Architecture Diagram

```
person picks node ids
        |
        v
eureka_capability_start (capability_id = opportunity.run_pair_screen, no approval)
        |  routeGate (needs: mcp-server + encoder extra, model yes)
        v
project() ---- room.db read only, sealed room refused ----> bundle (2..2500 artifacts)
        |
        v
child #1: scout_plan_pair_screen(request) ---> plan + plan_digest (receipt in engine data dir, 24 h)
        |  blocked / refused ---> typed refusal, stop
        v
mintApprovalGate (material_step, approving=[approve_run]) --> card to the person
        |                                   |
        | gate_answer approve               | reject / defer: nothing started
        v
resumeFn: child #2 (retained session)
   scout_start_pair_screen(request + approval{plan_digest, approval_ref=gate id}, idempotency_key)
        |
        +--> plugin job record written (~/.mindrian/eureka-jobs/...)
        v
eureka_capability_job_status / _result / _cancel
        |  session table hit  --> same child (cancel works)
        |  session table miss --> job record --> status-only child --> scout_status / scout_result
        v
verifier: schema_version, capability_id, scope_id + snapshot_id echo, files[].sha256, label,
          caps_hit + warnings shown, room_write = not_performed
        v
host handoff: person reviews; filing only on a human decision (outside 374)
```

### Recommended Project Structure
```
lib/mcp/
├── eureka-pair-screen.cjs      # request builder, plan call, result verifier (new, pure functions)
├── approval-gate.cjs           # extracted mintApprovalGate (new, shared with research.cjs)
├── eureka-job-record.cjs       # plugin job pointer store (new, ids and hashes only)
└── tools/eureka-capability-*.cjs   # edited, no new tool file unless D1 says so
tests/
├── test-374-*.cjs              # new, RED first
└── run-all-374.sh              # globs test-374-* like run-all-387.sh
```

### Anti-Patterns to Avoid
- Hard-coding the plan tool name: read `routes.mcp.plan_tool` from the catalog.
- Adding the new id to `PAIR_IDS`: it flips the cache label and the engine-state label wrongly.
- Reading `jobs.sqlite3` from Node.
- Persisting the request or the result in the plugin job record.
- Treating `completed_empty` as proof of no opportunity (CITED rule).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Approval card and single-use gate | A new approval store | `gate-render.cjs` + `gate-ledger.cjs` `material_step` + `gate_answer` | One governed path (Part 3, Part 7) |
| Room projection and sealed-room refusal | A second room reader | `project()` in `eureka-graph-projection.cjs` | One reader; sealed rule lives there |
| Typed engine refusals | New refusal text | `typedRefusal`, `startFailureRefusal`, `refusalFromEngineText` (`eureka-tool-contract.cjs`) | Fixed sentences, no path leak (Phase 387) |
| Route needs | A new needs table | `needsForCall` in `eureka-engine-requirements.cjs` | One rule for extras, model, Node |
| Hash check of inline files | Custom compare | `crypto.createHash('sha256')` over UTF-8 bytes of `content` | Contract rule |
| Session key | Raw session id in a file | `ledgerSessionKey` / hash | Gate records already avoid raw ids |

## Common Pitfalls

### Pitfall 1: Raising plugin caps to 3,000 does nothing
**What goes wrong:** the plugin accepts 3,000 ids, then the engine's `graph.prepare_artifact_bundle` refuses with "max_artifacts must be an integer from 2 to 2500" (`runner.py:26`).
**Why:** the bundle builder is capped in the engine, the schemas, the projection core (2,500) and the 12 MiB output ceiling. 3,000 nodes at 4,096 characters is 12,288,000 bytes of text alone, against `MAX_OUTPUT_BYTES = 12 * 1024 * 1024 = 12,582,912` (arithmetic on constants), so a text-heavy room can hit the ceiling before edges are added.
**Avoid:** keep 2,500 (D3), or lift all layers together with a Eureka-side change.
**Warning sign:** `projection_rejected` with "exceeds the 12582912 byte output limit".

### Pitfall 2: A second Eureka child kills a running job
**What goes wrong:** a graph tool call during a pair-screen run marks the run `failed / server_restarted`.
**Why:** `_recover_interrupted` runs at every store open with no owner check.
**Avoid:** interim `engine_busy` guard; wait for the Eureka owner lock; live test T11.

### Pitfall 3: Plan and start requests differ
**What goes wrong:** `plan_mismatch`. **Why:** the digest is of the exact request. **Avoid:** build the request once, freeze it in the `resumeFn` closure, add only `approval`.

### Pitfall 4: Gate id lost on restart
**What goes wrong:** `unknown_gate` after a restart. **Why:** the ledger is in memory. **Avoid:** tell the person to re-plan; the receipt and digest are stable for 24 h.

### Pitfall 5: Memory at the top limit
**What goes wrong:** the OS stops a long-lived MCP process near 3,000 artifacts. **Why:** memory grows with the square of the record count: about 1.7 GB at 2,117 records, about 3.4 GB at 3,000 (the 3.4 GB value is ASSUMED by the engine, `limits.py`). Engine requirement LIM-01 (no guard) is open. **Avoid:** the 2,500 cap is a partial mitigation; do not claim a safe size.

### Pitfall 6: Large structured results
**What goes wrong:** a result near 0.5 MB (ASSUMED estimate in the run contract) trips the 256 KiB warning (`TEXT_WARNING_BYTES`) and fills model context. **Avoid:** return counts, the manifest hash, the label and the first N pairs inline; put the rest behind a paging argument on `eureka_capability_job_result` (ADAPT374-03). The warning is advisory only today.

### Pitfall 7: `engine_state_persistence` label
`response()` marks a result durable only when `persistence === 'eureka_job_store_only'` or the capability is in a two-id list (`eureka-tool-contract.cjs:271-274`). The pair-screen answers already set `persistence`, so the label is right; verify in a test rather than editing the list.

## Code Examples

Route additions (E1, E6), source lines `eureka-capability-run.cjs:15-22`, `eureka-capability-jobs.cjs:14`:

```js
const ALLOWED_MCP_ROUTES = new Set([
  'scout_run_workflow', 'scout_start', 'scout_sme_map',
  'decision_compare_sequence_patterns', 'decision_fit_sequence_patterns',
  'scout_start_opportunity_signal_scout',
  'scout_start_pair_screen',
]);
const PLAN_ROUTES = new Set(['scout_plan_pair_screen']);
// jobs file
const ASYNC_ROUTES = new Set(['scout_start', 'scout_start_opportunity_signal_scout', 'scout_start_pair_screen']);
```

Needs branch (E11), source `eureka-engine-requirements.cjs:111,130`:

```js
const PAIR_SCREEN_IDS = new Set(['opportunity.run_pair_screen']);
// inside the eureka_capability_run / eureka_capability_start branch:
if (PAIR_SCREEN_IDS.has(id)) return cell(['mcp-server', encoderExtra(env)], 'yes', 'no', 'engine-read', 'engine-read');
```

Start arguments (CITED, run contract lines 54-58): `{ request: { ...planned, approval: { plan_digest, approval_ref } }, idempotency_key }`. The job start at `eureka-capability-jobs.cjs:71-73` already builds `{ request, idempotency_key }` for non-workflow routes.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-tool dedicated graph adapters | 14 of 14 `graph.*` capabilities covered | Phases 373 and beta.74 | No graph tool left to add |
| Run only `opportunity.synthesize_discovery_signals` scout | `opportunity.run_pair_screen` (both engines, manifest, approval gate) | Eureka session 2026-11-07 | New plan-then-start protocol |
| In-process job sessions only | Plugin job record plus engine status read | This phase | Honest answers after a restart |

**Deprecated:** the sentence "Jobs cannot resume after the MindrianOS MCP process restarts" in tool descriptions (E16) once recovery lands. Completed jobs will be readable; running jobs will not resume.

## Runtime State Inventory

Not a rename or migration phase. Omitted, with one note: the engine job store (`~/.local/share/mindrian-eureka`) holds three files on this machine and the new plugin record dir is a new store. No existing state needs migration.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | After a host kill the `eureka-mcp` child may linger until its job ends (thread pool join) | Job State | The "running job survives" case changes; test T12 decides |
| A2 | The interim `engine_busy` guard is enough for one host process | Job State | Two host processes still corrupt rows until the Eureka lock lands |
| A3 | F.6 is the right card shape for the pair-screen approval | Approval | Part 11 shape declaration must change |
| A4 | Refusing a start when `MINDRIAN_EUREKA_ALLOW_NETWORK=1` is the right rule | Part 8 | Owner may prefer to allow it |
| A5 | The 3-tool gap between golden (72) and live (75) is the 3 App tools | Tool Budget | Only the explanation changes, not the arithmetic |
| A6 | Result size about 0.5 MB for 200 pairs per engine (run contract estimate, not measured) | Pitfall 6 | Paging design size |
| A7 | The Eureka lock and `budget_exceeded` status are not yet landed (the working tree I read shows neither; I could not see uncommitted or branch state) | Job State | Gate status may already be met |
| A8 | `PairScreenInput` limits equal the scout limits (3,000 and 200) because they import the same constants | E14 | The scout lift may need an engine change |

## Open Owner Decisions

| # | Decision | Recommendation |
|---|----------|----------------|
| D1 | Router or re-baseline for the Eureka family (26 tools, 31.0 percent of the surface) | Keep as is for 374; no router. Re-measure when a router is designed. Add 0 tools for the pair screen |
| D2 | Add `eureka_capability_job_forget` (+1 tool) or document the CLI delete path | Add the tool; it is the only path to honor "forget this run" inside the product |
| D3 | Node cap 2,500 or 3,000 | Keep 2,500 in 374. 3,000 needs Eureka to lift `prepare_artifact_bundle`, five plugin sites and a memory guard (LIM-01) |
| D4 | Job record location: per user `~/.mindrian/eureka-jobs/` or per room `.mindrian/eureka-jobs/` | Per user |
| D5 | Card shape (F.6 or F.0) and the subcommand name (`screen` suggested by the run contract); does it replace default `run` | F.6, new `screen` subcommand, do not replace `run` |
| D6 | Whether 374 waits for the Eureka owner lock, or ships with the `engine_busy` guard | Ship with the guard; mark the multi-host case UNVERIFIED in the summary |
| D7 | Paging above 256 KiB: handle vs page argument | Page argument on `eureka_capability_job_result` (0 new tools) |

## Open Questions

1. Does the Eureka lock landed in a branch I could not see? I read the working tree only and ran no git there. The planner should ask the Eureka session for the commit id.
2. Should the Eureka `scout_status` get a read path that does not run `_recover_interrupted`? Without it, every status-only child after a restart can fail a still-running row. Ask the Eureka session. This is the single most useful engine change for ADAPT374-02.
3. Does the 30-day plugin record sweep belong in the plugin or in `doctor`? Not decided.
4. Windows: the egress and fake-engine tests exit 77 on win32 (`test-387-eureka-egress.cjs`). Pair-screen behavior on Windows is UNVERIFIED (the engine page says the same for permissions).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | plugin, tests | yes | 22.23.1 | - |
| uv | engine start | yes | 0.9.4 | - |
| Engine tree | live tests | yes | `/home/jsagi/dev/mindrian-eureka` (not run) | fake engine `tests/fixtures/eureka-fake-engine-387` |
| `node_modules/@modelcontextprotocol/client` | bridge | yes | present | - |
| Local meaning model | real pair-screen run | not found: `MINDRIAN_EUREKA_RS_MODEL_PATH` unset; model presence not checked | - | Fake engine for unit tests; live run is `blocked: local_model_unavailable` without it |
| Network | none required | not used | - | - |

**Blocking for live acceptance:** a local model on disk. **With fallback:** everything else (fake engine). The fake engine serves 7 tools and has no pair-screen routes; extend it for T1 to T9 (a test fixture change, not product code).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | plain Node scripts with `node:assert`, aggregated by `tests/run-all-NNN.sh` |
| Config file | none; `tests/run-all-387.sh` globs `tests/test-387-*` (model for `run-all-374.sh`) |
| Quick run command | `node tests/test-374-<name>.cjs` |
| Full suite command | `bash tests/run-all-374.sh` (to create), plus the existing Eureka set below |

### Phase Requirements to Test Map (RED first)

Write each test before the code; confirm it fails on the current tree; only then change code.

| ID | Behavior | Type | Command (new) |
|----|----------|------|---------------|
| T1 | `scout_start_pair_screen` and `scout_plan_pair_screen` are accepted by the route sets; an unknown route is still `unsupported_mcp_route` | unit (fake client, pattern of `test-eureka-capability-run.cjs`) | `node tests/test-374-routes.cjs` |
| T2 | `needsForCall('eureka_capability_start', {capability_id:'opportunity.run_pair_screen'})` returns `mcp-server` + encoder extra, model yes, node no; `routeGate` refuses with `engine_extra_missing` when the group is absent (pattern of `test-387-eureka-route-needs.cjs` N-arms); the id is NOT in the pair-cache label list | unit | `node tests/test-374-route-needs.cjs` |
| T3 | Plan branch: no `approval` means plan call, gate minted, no start call recorded by the fake engine | unit | `node tests/test-374-plan-gate.cjs` |
| T4 | Approve runs exactly one `scout_start_pair_screen` with `approval.plan_digest` equal to the plan and `approval_ref` equal to the gate id; request byte-equal to the planned one apart from `approval` | unit | same file |
| T5 | Reject, defer, second `gate_answer`, expired gate: no start; blocked/refused plan: typed refusal, no gate | unit | same file |
| T6 | Request size cap and missing `scope_id` or `snapshot_id` refused on the job start (not only the sync path) | unit | `node tests/test-374-start-guards.cjs` |
| T7 | Result verifier: wrong `schema_version`, wrong capability, scope or snapshot mismatch or missing, bad file hash, missing label each refused; `completed_empty` is reported as an empty shortlist | unit | `node tests/test-374-verify-result.cjs` |
| T8 | Job owner binding: other session or other room gets `job_session_wrong_owner` | unit | `node tests/test-374-job-owner.cjs` |
| T9 | Job record: written at start, holds only the listed fields (assert no `text`, `title`, `source_ref` keys), owner-only mode, 30-day sweep | unit | `node tests/test-374-job-record.cjs` |
| T10 | Recovery: clear the in-process table, call status and result; the fake engine returns terminal state; the verifier runs; cancel returns `cancel_unavailable_after_restart` | unit | `node tests/test-374-recovery.cjs` |
| T11 | `engine_busy` while a retained session exists | unit | `node tests/test-374-engine-busy.cjs` |
| T12 | Live, idle host: start a job, kill the host process, read the job row state and whether the child lingers | live | `node tests/test-374-live-restart.cjs` (skips cleanly without model) |
| T13 | Catalog cached per process: two calls, one `scout_capabilities` on the fake engine | unit | `node tests/test-374-catalog-cache.cjs` |
| T14 | Part 8: pair-screen modules in the scan lists of `test-341-eureka-no-brain-reach.cjs` and `test-387-eureka-egress.cjs`; room folder and `room.db` hash unchanged after a run | unit | extend those two files |
| T15 | Paging above 256 KiB (D7) | unit | `node tests/test-374-paging.cjs` |

### Existing tests that must stay green (PROVEN to exist; pass state from 373 summaries, not all re-run here)
`test-eureka-capability-run`, `test-eureka-mcp-tools`, `test-eureka-graph-algorithm-services`, `test-eureka-graph-discovery-signals`, `test-eureka-graph-projection`, `test-eureka-graph-opportunity-scout`, `test-387-eureka-route-needs`, `test-387-eureka-egress`, `test-387-eureka-engine-states`, `test-387-eureka-installed-layout`, `test-eureka-373-02-*` (5 files), `test-270-tool-schema-budget` (re-run today: 5 of 5), `test-384-s7-mcp-start parity` (re-run today: pass). Live: `test-eureka-live-bridge`, `test-eureka-live-capability-jobs`, `test-eureka-live-capability-run`, `test-eureka-live-graph-algorithm-services` (ADAPT374-06; not run here, need an idle host).

### Sampling Rate
- Per task commit: the one new test plus `test-eureka-capability-run`.
- Per wave merge: `bash tests/run-all-374.sh`, `test-270-tool-schema-budget`, `test-384-s7-mcp-start parity`, `node scripts/build-connector-registry.cjs --check`.
- Phase gate: all of the above, the four 267 files green after the Wave 0 refresh, live tests on an idle host.

### Wave 0 Gaps
- [ ] `tests/run-all-374.sh` and the 15 test files above
- [ ] Fake engine fixture: add `scout_plan_pair_screen`, `scout_start_pair_screen`, a status path that returns terminal states, and a restart switch
- [ ] 267 snapshot refresh (both zod snapshots) and the registration-api attribution fix
- [ ] Golden regeneration for 384 S7 and the `AFTER` edit in test-270, after the last description edit

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | local stdio, no accounts |
| V3 Session Management | yes | bind job and gate to the MCP session key (hash) and room id |
| V4 Access Control | yes | one room per binding; sealed room refused; wrong-owner job refused |
| V5 Input Validation | yes | zod `.strict()` schemas; request size cap; scope and snapshot ids required |
| V6 Cryptography | yes | `sha256` through Node `crypto`; never hand-rolled |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A second session reads another room's job result | Information disclosure | owner binding (E8), record bound to `room_id` |
| Forged or replayed gate id starts a run | Spoofing, Elevation | ledger mint/consume doctrine (T-198-10); start only inside `resumeFn` |
| Engine text with a path or token reaches the model | Information disclosure | fixed-sentence refusals only; no raw engine text |
| Result text injected as instructions (titles, excerpts) | Tampering | treat as untrusted data (CITED rule); never forward to Theo or Brain |
| Result altered in transit | Tampering | verify `files[].sha256` against inline `content` |
| Job record leaks room text | Information disclosure | ids and hashes only (T9) |
| Network opt-in lifts offline forcing | Information disclosure | refuse or warn when `MINDRIAN_EUREKA_ALLOW_NETWORK=1` (A4) |

## Sources

### Primary (HIGH confidence, read or run in this session)
- `/home/jsagi/dev/MindrianOS-Plugin-release/lib/mcp/eureka-tool-contract.cjs`, `lib/mcp/tools/eureka-capability-run.cjs`, `eureka-capability-jobs.cjs`, `eureka-graph-opportunity-scout.cjs`, `eureka-graph-prepare-artifacts.cjs`, `eureka-graph-projection.cjs`, `lib/core/eureka/eureka-engine-requirements.cjs`, `lib/core/navigation/engine-projection.cjs`, `lib/mcp/gate-ledger.cjs`, `lib/mcp/tools/gate.cjs`, `lib/mcp/tools/research.cjs`
- `tests/test-270-tool-schema-budget.cjs` (run), `tests/test-384-s7-mcp-start.cjs` (run), `tests/test-267-mcpv2-*.cjs` (run), `tests/fixtures/384-s7-tools-list-golden.json`, `tests/fixtures/267/wire-snapshot-zod4.json`, `tests/fixtures/3696-known-failures.json`
- `.planning/ROADMAP.md` lines 3690-3730; `.planning/phases/373-*/373-01-SUMMARY.md`, `373-MVP-SUMMARY.md`; `.planning/phases/387-*/387-11-SUMMARY.md`
- Scratch probe (hermetic tools/list measure): `/tmp/claude-1000/-home-jsagi/edc3f75b-c68a-4709-865b-201cd4ae22d0/scratchpad/list.cjs`

### Secondary (read only, engine tree; not run)
- `/home/jsagi/dev/mindrian-eureka/docs/mos-eureka-engine-run-contract.md`, `docs/engine-jobs.md`, `docs/encoder-profiles.md`
- `/home/jsagi/dev/mindrian-eureka/src/mindrian_eureka/opportunity_pairs/jobs.py`, `mcp_server.py`, `host_run/api.py`, `host_run/contracts.py`, `limits.py`, `graph_relations/runner.py`, `data/capability-catalog.v1.json`, `data/schemas/pair-screen-*.json`, `graph-artifact-bundle-*.json`
- `/home/jsagi/dev/mindrian-eureka/.planning/REQUIREMENTS.md` (PLG-01, LIM-01)

### Tertiary (LOW confidence)
- Linger-after-kill behavior of the child: reasoning from `ThreadPoolExecutor` semantics, not tested.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (no new package; existing code read)
- Architecture: HIGH for the plugin flow; MEDIUM for engine job-store interactions (source read, not run)
- Pitfalls: HIGH for 1, 2, 3; MEDIUM for 5, 6

**Research date:** 2026-11-08
**Valid until:** 2026-11-15 (fast moving: the Eureka tree and the plugin tree both changed within the last day)
