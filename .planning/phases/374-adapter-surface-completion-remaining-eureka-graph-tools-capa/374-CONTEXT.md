# Phase 374: Adapter surface completion - Context

**Gathered:** 2026-11-08 by the planner from 374-RESEARCH.md, the Phase 374 entry in ROADMAP.md and the planning request. No discuss-phase ran. Every locked decision below is a ruling already given in the planning request or a standing project rule. The seven open owner decisions of the research (D1 to D7) are NOT decided here: they become cards in plan 374-07.

**Phase dependency:** Phase 374 depends on Phase 373 (done). Tree at planning time: HEAD 62e2a4ec9, repo version 2.0.0-beta.82. Siblings 388 and 390 and 389 are planned or executing in the same tree: a peer session may hold uncommitted files. Every plan checks `git diff --quiet HEAD -- PATH` before it edits a product file.

## What changed against the ROADMAP text (research findings)

The ROADMAP entry for Phase 374 was written before the research. These findings change it. The ROADMAP Goal and Requirements text are not edited (only the Plans lines are).

1. **"Remaining dedicated graph tools" is already done.** 14 of 14 `graph.*` catalog entries have a plugin tool (9 tool files plus the 5 services of `eureka-graph-discovery-signals.cjs`). PROVEN in 374-RESEARCH.md. No plan adds a graph tool.
2. **The real new work** is the pair-screen capability `opportunity.run_pair_screen`, job state that survives a host restart, the hardening of the generic path, and the stale 267 wire pins (red since beta.74, not since Phase 387).
3. **Raising the caps to 3,000 does nothing alone.** The engine caps `graph.prepare_artifact_bundle` at 2,500, the plugin projection core caps at 2,500 and at 12 MiB. The node cap stays 2,500 in this phase; `top_k` 200 is the only cap change, and both go through card OD-3.
4. **The Eureka job store is not safe for one child per job.** Every new `eureka-mcp` start marks all `running` rows failed. The Eureka owner lock is not in the engine tree that was read. This phase ships an interim `engine_busy` guard (card OD-6) and lists the engine asks as external dependencies.
5. **The tool budget has no hard cap.** The pair screen needs 0 new tools (a branch of `eureka_capability_start`). At most 1 new tool (`eureka_capability_job_forget`), only if card OD-2 says so. No router in this phase.
6. **ADAPT374-06 (live tests) cannot be run here.** No local model path exists on this machine. The live tests are written to skip with exit 77 and are left for the owner to run on an idle host. The requirement stays open.
7. **ROADMAP gates, status at planning time:** "beta.73 cut" is past (repo is at 2.0.0-beta.82, PROVEN by `node lib/core/repo-version.cjs`). "Plugin node_modules restored": present (PROVEN, `node_modules/@modelcontextprotocol/{client,core,ext-apps,node,server}`). "Eureka job-store lock and budget status": NOT landed in the engine tree that was read (UNVERIFIED for other branches), external, see EXT-01 and EXT-05. "Owner call on the 25-tool surface": card OD-1.

<decisions>
## Implementation Decisions (locked)

- **D-01:** The Eureka repo (/home/jsagi/dev/mindrian-eureka) is not ours to edit. Read only; no git, no run there. Everything the plugin needs from it is listed as an external dependency (EXT-01 to EXT-05 below). No plan edits, runs or commits in that tree.
- **D-02:** No live engine run is planned. There is no local model path on this machine. Unit tests use in-process fake clients; end-to-end tests use the fake engine fixture. The live tests (T12 and the four existing live files) are written to skip with exit 77 and are left for the owner on an idle host. ADAPT374-06 stays open.
- **D-03:** `opportunity.run_pair_screen` goes in a separate `PAIR_SCREEN_IDS` set in `lib/core/eureka/eureka-engine-requirements.cjs`. It is never added to `PAIR_IDS`, because `PAIR_IDS` also drives the "embedding cache may be written" label and the pair screen keeps no vectors.
- **D-04:** The approval gate is extracted into one shared module, `lib/mcp/approval-gate.cjs`, with its own test. No fourth copy of `mintApprovalGate` (Canon Part 7). `research.cjs` calls the shared module.
- **D-05:** The owner decisions D1 to D7 are cards in `374-DECISION.md`, one OWNER-ANSWER line per card, every answer PENDING. Neither the planner nor an executor writes an answer. The card plan ends in ONE NEEDS_HUMAN line. Every gated plan starts with `node .planning/phases/374-adapter-surface-completion-remaining-eureka-graph-tools-capa/374-gate.cjs plan <plan id>` and stops on any exit code other than 0.
- **D-06:** `node_ids` stays capped at 2,500 and `max_artifacts` at 2,500. `top_k` goes from 100 to 200 only if card OD-3 resolves to TOPK-200. A node cap of 3,000 needs the Eureka-side lift (EXT-04), the five plugin sites and a memory guard: it has no plan in this set, and an answer of NODES-3000 stops plan 374-12 with a re-plan request.
- **D-07:** No plan adds a graph tool. The research proved 14 of 14 `graph.*` catalog entries are covered.
- **D-08:** Canon Part 8. Pair-screen modules join the scan lists of `tests/test-341-eureka-no-brain-reach.cjs` and `tests/test-387-eureka-egress.cjs`. No pair-screen result text (titles, source refs, excerpts) goes to Theo or Brain. The approval card holds counts and fixed sentences, never a node title. The plugin job record holds ids and hashes only. The bundle is built only through `project()` and `prepare()`: no second room reader.
- **D-09:** The stale 267 wire pins are refreshed in Wave 0 by the precedent of commits 3379e406c (new tools to the zod4 snapshot plus membership entries in `zod4-accepted-deltas.json`) and 224cc7b26 (small pin moves in both snapshots). The registration-api attribution failure is a test fix, not a snapshot move.
- **D-10:** The pair screen adds 0 tools. The plan step is a branch of `eureka_capability_start` (no `approval` in the request: plan and mint a gate). The only start of `scout_start_pair_screen` is inside the `resolve` function of that gate.
- **D-11:** Until the Eureka owner lock lands, the plugin ships the interim `engine_busy` guard (if card OD-6 says so). The guard covers one host process only. The multi-host case stays UNVERIFIED in the summary.
- **D-12:** The plugin job record stores ids, hashes, counts and times only: never the request, a title, a source ref or result text. It is bound to the room, and the job id is checked against a strict pattern before it becomes a file name.
- **D-13:** Commit hygiene. Stage with `git add -f` and exact paths; commit with `git commit --only` and the same paths; no push, tag or release; no `gsd-tools` write command on STATE.md, ROADMAP.md or REQUIREMENTS.md. Hyphens only, no em dashes, no en dashes.

### Claude's Discretion (choices made by the planner; each is written into the task that uses it)

- The pair-screen request that a caller gives to `eureka_capability_start` carries `node_ids`, `objective` and optional `top_k` (the fields of the existing scout tool). A caller-supplied `artifacts` list or `approval` block is refused, because the bundle must come from `project()` (sealed rooms refused) and the approval must come from the gate.
- A pair-screen start is refused when `MINDRIAN_EUREKA_ALLOW_NETWORK=1` is set (research assumption A4). The pair screen needs no network.
- The card shows `warnings` as a count only; the plan warning lines are returned in the structured answer as untrusted text.
- The catalog cache key is the engine root plus the modification time of its `pyproject.toml`, with a 30 minute lifetime.
- Recovery of a lost job is bound to the room, not to the MCP session id, because the session id does not survive a host restart.
- `eureka_capability_job_forget` (if card OD-2 says so) requires `confirm: true` in its input.
- The 30 day sweep of plugin job records runs inside the plugin (at job start and at recovery), not in `doctor`.
- The Part 8 scan-list additions (test-341-eureka-no-brain-reach and test-387-eureka-egress) are made by the plan that creates each module, not as one gated plan: `eureka-pair-screen.cjs` and `approval-gate.cjs` in 374-06 (ungated, because both modules are created without a card), `eureka-job-record.cjs` in 374-10 (behind card OD-4). A new module is never unguarded for longer than one plan.
- Answer-independent tests (T6, T7, T8, T13) are written RED in Wave 0 (plan 374-05). Answer-dependent tests (T1 to T5, T9 to T12, T14b, T15) are written RED first inside the gated plan that consumes the answer. Reason: they pin behaviour that an owner card can change, and a test written before the answer pins a guess. This is a deliberate narrowing of "all of T1 to T15 in Wave 0".

### Deferred Ideas (OUT OF SCOPE)

- A tool router (card OD-1 may open it as its own later phase).
- A projection handle tool and paging of the projection tools `eureka_graph_project` and `eureka_graph_prepare_artifacts` (card OD-7 options HANDLE-TOOL and PAGE-ARG-PROJECTION; no plan consumes them).
- A node cap of 3,000 (D-06).
- Phases 375 to 378 and 379. The provenance gap marks (HOST-02) are a host-owned room write and are not part of 374.
- Any change in the Eureka repo (D-01).
- The 276 tool-honesty sweep (5 failures at planning time, navigator-owned rows, frozen sweep 47/142 against live 49/144). Not caused by this phase. Plans 374-12 and 374-13 only prove the count of failing lines does not grow.
</decisions>

## External dependencies (asks to the Eureka session; the Eureka repo is not edited by this phase)

| ID | Ask | Why the plugin needs it | What the plugin does until it lands |
|----|-----|-------------------------|-------------------------------------|
| EXT-01 | Job-store owner lock and a terminal-state guard (`_recover_interrupted` at `opportunity_pairs/jobs.py:101-109` has no owner check; `transition()` has no terminal guard) | A second `eureka-mcp` child must not fail a running row | Interim `engine_busy` guard (plan 374-11, card OD-6) |
| EXT-02 | A status read path that does not run `_recover_interrupted` | A status-only child after a host restart can fail a still-running row | Plan 374-10 states the limit in the answer |
| EXT-03 | Workers read `cancel_requested` (today only `request_cancel` writes it) | Cross-process cancel | Recovered job: `cancel_unavailable_after_restart` |
| EXT-04 | Lift `graph.prepare_artifact_bundle` above 2,500 (`graph_relations/runner.py:26`) and a memory guard (LIM-01) | Only if the owner answers NODES-3000 on card OD-3 | Node cap stays 2,500 |
| EXT-05 | The commit id of the owner lock and of a distinct `budget_exceeded` status, if they exist on a branch the research could not see (research assumption A7) | ROADMAP gate "lock and budget status landed" | Gate stays open; recorded in the summaries |

## Source coverage audit (all four source types)

| Source | Item | Covered by |
|--------|------|-----------|
| GOAL | Complete the adapter surface; tool budget decided; job state survives a restart | Plans 374-06 to 374-14 |
| REQ | ADAPT374-01 budget decision with token figure | 374-07 (card OD-1), 374-14 (record, 374-BUDGET.md) |
| REQ | ADAPT374-02 sessions bound to session and room, size cap, recovery by asking Eureka | 374-06 (size cap, owner binding), 374-10 (record, recovery), 374-11 (guard) |
| REQ | ADAPT374-03 projection handle or paging above 256 KiB | 374-12 (job result paging; projection tools deferred by card OD-7, see Deferred) |
| REQ | ADAPT374-04 generic path refuses results without scope and snapshot ids | 374-06 (unconditional lineage check), 374-08 (pair-screen verifier wired) |
| REQ | ADAPT374-05 catalog cached per process | 374-06 |
| REQ | ADAPT374-06 live tests pass on an idle host | 374-10 (T12 written, skips), 374-14 (owner-run commands in the summary). NOT RUN here (D-02). Requirement stays open |
| RESEARCH | Edit list E1 to E3, E6, E11, E12, E17 | 374-08 |
| RESEARCH | E4, E5 (module), E7 (a, b, c), E8, E10, E19 | 374-06 |
| RESEARCH | E5 (wiring), E9, E7 (d), E13 | 374-08 and 374-10 |
| RESEARCH | E14 | 374-12 |
| RESEARCH | E15 (node cap 3,000) | NOT planned: needs EXT-04. Card OD-3 option NODES-3000 triggers a re-plan |
| RESEARCH | E16 | 374-13 |
| RESEARCH | E18 | 374-09 |
| RESEARCH | Stale 267 arms and the registration-api attribution fix | 374-01 |
| RESEARCH | Shared approval gate (Part 7 note) | 374-03 |
| RESEARCH | Tests T1, T2, T3 to T5 | 374-08 |
| RESEARCH | T6, T7, T8, T13 | written 374-05, made green 374-06 |
| RESEARCH | T9, T10, T12 | 374-10 |
| RESEARCH | T11 | 374-11 |
| RESEARCH | T14 (scan lists) | 374-06 and 374-10; (hash unchanged after a run) 374-08 |
| RESEARCH | T15 | 374-12 |
| RESEARCH | Pitfalls 1 to 7 | 1: 374-12 (D-06). 2: 374-11. 3 and 4: 374-08. 5: noted in 374-12 (cap stays 2,500). 6: 374-12. 7: 374-08 |
| RESEARCH | Owner decisions D1 to D7 | 374-07 cards OD-1 to OD-7 (D5 is OD-5A and OD-5B) |
| RESEARCH | Open questions 1 and 2 | EXT-05, EXT-02. Question 3: discretion above. Question 4 (Windows): UNVERIFIED, carried in 374-14 |
| CONTEXT | D-01 to D-13 | cited in the plan objectives and actions |

## Owner decision map (research id, card id, group, consuming plan)

| Research | Card item | Group | Options (KEEP first) | Recommended | Consuming plan |
|----------|-----------|-------|----------------------|-------------|----------------|
| D1 router or re-baseline | OD-1 | G1 | KEEP, ROUTER-NEXT | KEEP | 374-14 |
| D2 forget tool | OD-2 | G2 | KEEP, ADD-FORGET-TOOL | ADD-FORGET-TOOL | 374-13 (read by 374-08) |
| D3 caps | OD-3 | G3 | KEEP, TOPK-200, NODES-3000 | TOPK-200 | 374-12 |
| D4 job record location | OD-4 | G4 | KEEP, USER-DIR, ROOM-DIR | USER-DIR | 374-10 |
| D5 card shape | OD-5A | G5 | KEEP, F6, F0 | F6 | 374-08 |
| D5 subcommand | OD-5B | G5 | KEEP, SCREEN | SCREEN | 374-09 |
| D6 interim guard | OD-6 | G6 | KEEP, ENGINE-BUSY-GUARD | ENGINE-BUSY-GUARD | 374-11 |
| D7 paging | OD-7 | G7 | KEEP, PAGE-ARG, PAGE-ARG-PROJECTION, HANDLE-TOOL | PAGE-ARG | 374-12 |

## Waves

Wave names follow the sibling phases: "Wave 0" is the first group of autonomous plans (frontmatter wave 1).

- **Wave 1 (autonomous, file-disjoint):** 374-01 (267 pins), 374-02 (fake engine), 374-03 (shared approval gate), 374-04 (answer gate wrapper), 374-05 (RED tests and aggregator).
- **Wave 2:** 374-06 (generic path hardening, autonomous), 374-07 (owner cards, `autonomous: false`, ends in one NEEDS_HUMAN line).
- **Waves 3 to 8 (gated by the cards; each starts with the 374-gate.cjs check):** 374-08 pair-screen route and approval flow (wave 3); 374-09 `/mos:eureka screen` and 374-10 job record and recovery (wave 4); 374-11 engine_busy guard (wave 5); 374-12 caps and paging (wave 6); 374-13 forget tool, honest tool descriptions and the final pin moves (wave 7); 374-14 budget decision record, engine guide, release suite registration and close-out (wave 8). The chain is serial because plans 374-08, 374-10, 374-11, 374-12 and 374-13 all edit `lib/mcp/tools/eureka-capability-jobs.cjs`.

## Canonical References

- .planning/phases/374-adapter-surface-completion-remaining-eureka-graph-tools-capa/374-RESEARCH.md
- .planning/ROADMAP.md (Phase 374 entry), CLAUDE.md (Canon Parts 3, 7, 8, 11)
- .planning/phases/390-recalibrate-or-cut-stale-surfaces-keep-recalibrate-cut-table/390-gate.cjs and 390-05-PLAN.md (answer gate and owner card model)
- .planning/phases/388-ship-less-keep-tests-and-dead-weight-out-of-the-install/388-04-PLAN.md (gate-first plan model)
- /home/jsagi/dev/mindrian-eureka/docs/mos-eureka-engine-run-contract.md (read only)
- Precedent commits 3379e406c and 224cc7b26 (267 pin moves)
</content>
