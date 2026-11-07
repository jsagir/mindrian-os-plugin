# Phase 390: Recalibrate or cut stale surfaces - Research

**Researched:** 2026-11-07
**Domain:** repo hygiene on a Claude Code plugin (commands, skills, agents, lib/core modules, born-wired registries, MCP tool surface). No external packages.
**Confidence:** HIGH for the caller facts (read or scanned at HEAD ce3886f73). MEDIUM for the cost of each cut (the generators were not run for a cut). LOW for anything about Desktop, Cowork, tester or student use (not observable here).

Provenance tags: PROVEN = I ran the command or read the file in this session at HEAD ce3886f73. UNVERIFIED = not run. ASSUMED = from the PRD or the parallel session, not re-checked. The PRD addendum 3 says HEAD 4b74ae939; the worktree HEAD is now ce3886f73 (Phase 384-20 revert commits). The scan counts did not change.

<user_constraints>
## User Constraints (from the Phase 390 PRD; there is no 390-CONTEXT.md)

### Locked Decisions
- KEEP: grade, deep-grade, grade-grant. The Eureka engine is the new `/home/jsagi/dev/mindrian-eureka`. Eureka is never removed.
- Pinecone: the dead inference module is gone (385-15). `rs-pinecone-bridge.cjs` is only a name for the shared cosine function; rename later, do not delete.
- 385-PROOF section 14: R9 and R10 ruling = "Keep everything and delete nothing" for test-only modules and other unwired items. Any cut of an orphan module needs a new per-module ruling.
- Phase 386 plan 41: transcribe-audio is left and documented.
- Rules: measure and prove first, one owner card per group of cuts, failing test first, Part 11 regeneration after any removal, no push/tag/release, `git commit --only`.
- Step 1 produces a keep / recalibrate / cut table. No surface is removed in step 1.
- Usage evidence (one machine, Claude Code only) chooses WHAT TO CHECK. It is never a reason to cut. "Never used" reads "NOT OBSERVED in this corpus".
- A cut needs a caller proof across CLI, Desktop, Cowork, hooks and tests.
- Do not remove the room-dashboard, room-wiki, room-graph MCP views without a Desktop check.

### Claude's Discretion
- The shape of the table and the plan breakdown. Wave order. Which proof commands to run.

### Deferred Ideas (OUT OF SCOPE)
- Theo shim exposure changes (PRD "Step 0"). No 390 task needs a new Theo tool exposure. Run Step 0 only if the owner adds an exposure to this phase.
- Phase 389 work (Pyramid, MVA family). Phase 391 work (Claude Code compatibility, radar fetch fix).
- Owner items still open and not decidable here: the 389 cards, the Pinecone key revoke, who runs the radar fetch.
</user_constraints>

<phase_requirements>
## Phase Requirements

The ROADMAP entry for Phase 390 lists `Requirements: TBD` and `Goal: [To be planned]` (PROVEN, .planning/ROADMAP.md lines 4113-4122). No requirement IDs exist. The planner should define them from the PRD. Suggested IDs: R390-TABLE (verified table filed), R390-FIX (no-regret fixes, if the owner approves), R390-CUT-n (one per owner-approved cut group).
</phase_requirements>

## Summary

Step 1 of the PRD is a table with no cuts. This research re-checked the table in `.planning/audits/PHASE-390-KEEP-RECALIBRATE-CUT-TABLE.md` against the code. Most rows hold. Five rows are wrong or overstated (listed in section "Row verdicts"). The strongest result: **no surface is safe to cut on caller proof alone**. Every orphan module is covered by the standing R9/R10 ruling "keep all, delete none". Every command group is wired into 13 generated data files, the MCP tool schemas, the UI registry and the room-skeleton templates.

Two changes of fact against the table. First, `/mos:present` is NOT a soft alias. Only `visualize` is deprecated (frontmatter `deprecated: true`, `deprecated_removal: "v1.14.0"`, repo version is 2.0.0-beta.80, so the stated removal date is long past). Second, render-coverage does NOT count `mullins-scaffold` as an unwired declaration: `check-render-coverage.cjs` reports 0 unwired at HEAD, and the code comment says those skills were stamped at merge time.

**Primary recommendation:** Plan 390 as (1) a Wave 0 that files the verified table and re-runs the scan, (2) a small set of no-regret fixes that each need one owner word (session-register wire-or-fix, stale prose), and (3) one owner decision card per cut group. Plan no deletion task until the owner answers its card. Each approved cut then follows the Phase 385 pattern: failing removal test first, caller proof re-run, generators run, one `git commit --only`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Command / skill / agent definitions | Plugin markdown (commands/, skills/, agents/) | Generated mirrors (dist/, skills mirror via build-skill-mirrors.cjs) | Source of truth is the md file; mirrors regenerate |
| Born-wired registry (Part 11) | Generated data (data/connector-registry.json, ledgers, projection) | Build-time gates (build-connector-registry --check) | A removal must regenerate, not hand-edit |
| MCP tool schema (router enums) | lib/mcp/tool-router.cjs | tests/fixtures/384-s7-tools-list-golden.json, test-270 budget | Router `z.enum(...)` lists put command names into tools/list |
| Desktop command registry | ui/mindrian-workspace-mod/assets/command-registry.json, ui/mos-face/hooks/commands.ts | lib/mos-face/dist/commands.js (built) | Desktop reads these, not the md files |
| Orphan lib/core modules | Local code (lib/core) | Tests as only caller | Planned-but-unwired contracts per R9 |
| Hooks | hooks/hooks.json | scripts/ | Only `mva-detect` and `session-start` touch candidates |

## Standard Stack

No library is installed or added in this phase. Tooling already in the repo: Node built-ins only.

| Tool | Path | Purpose |
|------|------|---------|
| No-caller scan | `.planning/phases/385-*/385-no-caller-scan.cjs` | Token-based caller scan. Read-only. Run: `nice -n 19 node .planning/phases/385-*/385-no-caller-scan.cjs` |
| Removal test pattern | `tests/test-385-*-removed.cjs` (for example `test-385-deep-links-removed.cjs`) | Asserts a path is not tracked and no file names it |
| Gates | `build-connector-registry.cjs --check`, `build-orchestration-projection.cjs --check`, `check-render-coverage.cjs` | Part 11 proofs |
| Generators | `build-command-registry.cjs`, `build-skill-mirrors.cjs`, `build-dist-bundles.cjs`, `build-render-coverage.cjs`, `build-ui-shell.cjs`, `build-command-irreversibility-ledger.cjs` | Regenerate after a removal |

Package Legitimacy Audit: not applicable. No external package is installed. Packages removed due to slopcheck: none.

## Row verdicts (the table checked against code)

Scan result at HEAD ce3886f73 (PROVEN, exit 0): lib/core 565 modules, 0 no-reference, 18 test-only (4268 lines), 2 closure extras (260 lines), 20 dead set (4528 lines). Scripts plus lib/hmi plus lib/workflow: 374 scanned, 8 no-reference (2004 lines), 38 test-only (14963 lines). This matches section G of the audit file.

Counts: `ls commands` = 113, `ls skills` = 126 directories, `ls agents` = 17 files (PROVEN).

### A. Orphan modules in lib/core

Common fact (PROVEN by `git grep`, excluding tests, docs, .planning, evals, CHANGELOG): none of these 13 modules has a `require` in production code. Nothing in ui/ or mcp-server-brain/ names any of them. The few dynamic `require(variable)` sites in lib, scripts, bin and hooks (for example `bin/local-chain-recommender.cjs:15`, `lib/brain/curation-batch.cjs:135`) do not build any of these names (PROVEN by grep of non-literal requires; the grep pattern could miss a path built from parts in a data file, see Assumptions A2).

| Module | Table claim | Verdict | Evidence |
|--------|-------------|---------|----------|
| expert-genesis | test-only, uses live synthetic-expert | HOLDS | Only a comment in synthetic-expert-construction-gate.cjs:40 and tests/test-203-genesis-fanout.cjs. It requires `./navigation/synthetic-expert.cjs` (expert-genesis.cjs:44). |
| synthetic-expert-construction-gate, -behavior-gate | tests only, decide with expert-genesis | HOLDS | No non-test file names the behavior gate except itself. |
| navigation/synthetic-expert.cjs | LIVE | HOLDS | Required at navigation.cjs:65, expert-genesis.cjs:44, scripts/close-loop.cjs:44. The glob `synthetic-expert-*` does not match it, but a loose `synthetic-expert*` would. |
| grill-engine | coupling to the egress guard closed list | OVERSTATED | The guard has comments at part8-egress-guard.cjs:1168 and 1241 and a one-member set `METHODOLOGY_TECHNIQUE_WORDS = {'premortem'}` plus a rule that skips hyphenated TitleCase words. No runtime link to grill-engine. BUT grill-engine is required by `tests/test-213-part8-boundary.cjs:51` (a Part 8 boundary test) and `tests/test-355-direction-readers.cjs:149`, plus test-205-grill-engine. Removal removes Part 8 test evidence. The GRILL gear string exists in `lib/core/sensors/sensor-circularity.cjs` as a label; that file does not require grill-engine. |
| fusion-router | keep, documented seam | HOLDS | Named in commands/find-analogies.md, skills/find-analogies/SKILL.md, three eureka/navigation comments. No `require`. |
| nl-graph-queries | weak cut candidate | HOLDS, with one correction | Zero non-test references of any kind. Only caller: tests/test-355-direction-readers.cjs:193. Not the engine behind `/mos:rs-explain` (that script requires `rs-nl-to-query.cjs` and `rs-query-to-text.cjs`, PROVEN scripts/rs-explain-command.cjs:45-46). Doc mention: docs/BACKEND-MAP.md:203. |
| methodology-ingest | keep or recalibrate with the command | HOLDS, and the gap is real | commands/ingest-methodology.md lines 25 and 70 say the engine is `lib/core/methodology-ingest.cjs` and "WIRED". No code requires it. scripts/methodology-ingest-local.sh does not call it (the file name appears only in its header comment, line 2: "methodology-ingest LOCAL step"). The command prose claims a wire that no code makes. |
| ralph-loop-gate | closure of dead set | HOLDS | Scan lists it as closure extra. |
| tone-filter | cut candidate, single test caller | HOLDS | Zero non-test references. Only tests/test-205-decision-axes.cjs. 147 lines (scan). |
| voice-transition-detector | keep for now | HOLDS | Named only in lib/core/fork-declaration.cjs (comment) and its own file. fork-declaration.cjs:41 says it "already does this exact guarded require", so the precedent is real but the module itself is unwired. |
| cross-room-triggers | keep (R9) | HOLDS | Zero non-test references. |
| coverage-monitor | keep (R9) | HOLDS | Zero non-test references. |
| session-register | recalibrate: behaviour gap | HOLDS | commands/ignite.md:80 and skills/ignite/SKILL.md:76 tell Larry to "call resolveSessionRegister(role_blend) (lib/core/session-register.cjs)". No code requires the module. tests/test-204-ignite-wiring-grep.cjs pins that the prose exists, so changing the prose also means changing that test. |

Dead-set modules the table does NOT cover (PROVEN, from the scan): behavioral/observation-schema, card-fire-gate, futures/subsystem-render, graph-refine-loop, ignite-branch-gate, metrics/larryreach-loop-health, navigation/memory-cortex-packet, reader/ab-harness, recovery/controller (1008 lines), salient-governance, temporal/supersession-gate, planning/artifact-brain-packet. The R9 ruling already classifies each as keep. 390 should state "covered by R9, no new card" or add them to a card.

### B. Skills

| Surface | Table claim | Verdict | Evidence |
|---------|-------------|---------|----------|
| client-discovery-interview | not stand-alone, belongs to /mos:discover | HOLDS | commands/discover.md lines 45, 83, 163 read its SKILL.md, question-bank.md and discovery-scaffold.json. Also named in 7 data files, scripts/build-render-coverage.cjs, tests/run-all-1434.sh (reads discovery-scaffold.json, line 112) and tests/test-209-declared-implies-wired.cjs:395. Also: `/mos:discover` movement 4 reuses `/mos:analyze-needs`, `/mos:user-needs`, `/mos:jtbd` (discover.md:109, 189) and the deck bridge uses `mos-deck-engine` (discover.md:178, 192). So a discover cut does not remove those; a cut of user-needs or analyze-needs does break discover. The off-mission call is the owner's. |
| pws-methodology | keep | HOLDS | scripts/verify-release:307 `REQUIRED_SKILLS=(larry-personality pws-methodology ...)`; tests/test-143.2-doctrine-presence.cjs:53; data/connector-out-of-spine-allowlist.json:59. Release gate fails without it. |
| intelligence-orchestrator | keep | HOLDS (not re-read in depth) | Core dispatcher per audit. render-coverage comment says it is `connector.excluded:true`. |
| mullins-scaffold | "1 caller"; "render-coverage already counts it as an unwired declaration" | PARTLY WRONG | (a) NOT unwired: `check-render-coverage.cjs` prints "17 covered, 0 excluded, 0 gap" and "198 wired, 2 excluded, 0 unwired" at HEAD (PROVEN). The comment at build-render-coverage.cjs:368 says the 3 skills were stamped at merge time and are not in the exclusion table. (b) It is born-wired: data/connector-registry.json:2253 (`brain_consult`, `mullins-scaffold`, `connects_to_spine: true`), data/connector-coverage-ledger.json:1444 (`wired`, `mechanical`), connector-out-of-spine-allowlist.json:62, hitl-shape-backfill.json:685, layer-backfill.json:679. (c) It has real tests: tests/test-143.2-doctrine-presence.cjs (lines 57, 58, 228), lib/core/mullins-scaffold.test.cjs, tests/run-all-1432.sh, tests/test-skills-have-skill-md.cjs. The module `lib/core/mullins-scaffold.cjs` has only its own test as a code caller (that part holds). Not recorded: any `commands/mullins.md` or `skills/mullins` reference (grep found none), so `/mos:mullins` does not point at the scaffold. |
| mos-deck-engine | keep while /mos:deck stays | HOLDS | commands/deck.md lines 52-56, 82 ("reuses the shipped mos-deck-engine 6-stage Feynman pipeline"); data/deck-aliases.json keeps the legacy handle `MOSDeckEngine` (Phase 175 deprecate-not-delete); discover.md:178. |
| mva-pipeline | follows Phase 389 | HOLDS | Phase 389 has only a PRD (no plans) and lists mva-option, the mva-pipeline skill and the option router as retire candidates. 390 must not touch the MVA family. Also see dependency note below. |

### C. Agents

PROVEN counts (grep of file names outside .planning, docs, dist, r-and-d, CHANGELOG; "prod" = commands, skills, lib, scripts, hooks, pipelines, data, teams, references):

| Agent | Production files naming it | Test files | PROACTIVELY | Last commit |
|-------|-----|-----|-----|------|
| analogy-query-fetcher | 8 | 0 | no | 2026-09-14 |
| competitor-watch-fetcher | 5 | 0 | no | 2026-09-14 |
| dominant-design-researcher | 5 | 4 | no | 2026-09-23 |
| research-lane-analyst | 6 | 2 | no | 2026-09-30 |
| vault-section-reviewer | 6 | 0 | no | 2026-09-14 |
| grant-reviewer | 8 | 0 | no | 2026-09-14 |
| chain-step-reviewer | 3 | 4 | no | 2026-09-15 |
| meeting-perspective-extractor | 10 | 0 | no | 2026-09-14 |
| investor / grading / opportunity-scanner | 95 / 89 / 13 | 55 / 24 / 5 | yes (1 each) | 2026-09-14 / 2026-11-05 / 2026-11-06 |

Verdicts:
- "Only 3 agents carry PROACTIVELY": HOLDS (investor, grading, opportunity-scanner).
- "larry-extended and agent-operations.md list no specialists": HOLDS. Zero matches for the 7 helper agent names in agents/larry-extended.md and references/personality/agent-operations.md (PROVEN).
- "6 helper agents have exactly ONE entry (their parent command)": WRONG as worded. The counts above show 5 to 8 production files each, but those are the command, its skill mirror, dist-free registries and `data/subagent-dispatch-grants.json`, which are all one logical entry (the parent command and its generated copies). The logical claim (reachable only through the parent command) HOLDS for analogy-query-fetcher (find-analogies, scout), competitor-watch-fetcher (scout), dominant-design-researcher (dominant-designs), research-lane-analyst (research), vault-section-reviewer (vault, commands/vault.md:218). I did not read each parent command to confirm the dispatch line. UNVERIFIED for all but vault.
- chain-step-reviewer "wired but never fed": HOLDS. lib/core/chain-step-dispatcher.cjs:441-447 dispatches only when `step.reviewer.kind === 'subagent'`. A grep of pipelines, data, commands, skills for a `subagent` reviewer kind found only the unrelated vault dispatch lines. The agent is named in data/brain-orchestration-projection.json and data/connector-coverage-ledger.json (born-wired) and pinned by tests/test-347-reviewer-honesty.cjs, test-347-reviewer-not-worker.cjs, test-347-layer-graph-declaration.cjs. Fold or cut touches those (Part 11).
- grant-reviewer: keep (owner ruling on grade-grant). reverse-salient-agent, framework-runner, persona-analyst, brain-query: not re-scanned in depth; large caller counts above for framework-runner (35 production files).
- Recalibration moves A to F: none is built. Move B (tie each trigger to a sensor signal) must stay inside the existing sensor path (`dispatchSensors` -> `decide()`); the CLAUDE.md "no second selection brain" rule applies. Move C (card before any external fetch, generic query only) and move D (ask Theo for a lead agent) touch Part 8 and must pass `lib/core/part8-egress-guard.cjs`. Move F (count launches for one month) needs a counter that does not exist; do not add a hook without an owner word.

### D. Command groups

Mirror rule: each command has a skill mirror (PROVEN: all 22 sampled names have both `commands/X.md` and `skills/X/`). For hyphenated names the counts below are tracked files naming the token outside .planning, docs, dist, r-and-d, CHANGELOG (PROVEN by git grep with word-boundary pattern; they include fixtures and prose, so they are cost indicators, not caller proofs). For generic words (futures, present, deck, wiki, dashboard, snapshot, publish) the same pattern gives noisy numbers (for example `present` 859 test files), so they are not quoted.

| Command | data files | test files | ui files | Last commit |
|---------|-----------|-----------|----------|------|
| macro-trends | 15 | 6 | 3 | 2026-09-14 |
| explore-trends | 15 | 9 | 4 | 2026-09-14 |
| explore-futures | 16 | 9 | 0 | 2026-09-14 |
| scenario-plan | 17 | 12 | 5 | 2026-09-14 |
| trending-to-absurd | 18 | 14 | 3 | 2026-11-05 |
| rs-experts | 18 | 8 | 2 | 2026-10-24 |
| rs-explain | 17 | 3 | 2 | 2026-11-05 |
| rs-fetch | 19 | 13 | 2 | 2026-11-05 |
| rs-thesis | 17 | 5 | 2 | 2026-11-05 |
| lean-canvas | 17 | 24 | 4 | 2026-09-14 |
| value-proposition | 11 | 5 | 1 | 2026-09-14 |
| user-needs | 17 | 9 | 4 | 2026-09-14 |
| analyze-needs | 17 | 16 | 3 | 2026-09-14 |

Exact cost of ONE name, `explore-trends` (PROVEN, `git grep -l`): 13 data JSON files (brain-orchestration-projection, command-irreversibility-ledger, command-registry, connector-coverage-ledger, connector-registry, help-groups, hitl-shape-backfill, jev-labels/command-irreversibility, layer-backfill, orchestration-command-ledger, render-coverage-registry, section-command-ledger, section-command-relevance), 2 harness-fixtures md files, lib/hmi/jtbd-taxonomy.json, lib/mcp/brain-router.cjs, prompts.cjs, tool-router.cjs, lib/mos-face/dist/advice.js and commands.js, lib/core/futures/orchestrator.cjs, lib/core/trending-to-absurd/stage7-roadmap.cjs, 4 scripts, templates/room-skeleton/section-contracts/market-analysis.md and references/SECTION-SCHEMA.md, ui/mindrian-workspace-mod/assets/command-registry.json, ui/mos-face/hooks/advice.ts and commands.ts, ui/shared/src/generated/mcp-adapter.ts. The table's "13 to 14 data registries" holds for explore-trends (13 JSON).

Group verdicts:
- Trend/futures set: row HOLDS (recalibrate or merge, not a clean cut). Four of the six names (macro-trends, explore-trends, explore-futures, scenario-plan) sit in `ANALYSIS_COMMANDS` at lib/mcp/tool-router.cjs:362-367 (PROVEN); the enum is used at line 1593. `futures` and `trending-to-absurd` are not in that list. That enum is part of `tools/list` output.
- rs-* set: row HOLDS but UNDERSTATES the risk. `rs-experts` and `rs-thesis` are the CLI forms of the MCP tools `rs_experts_find` and `rs_thesis_read` (lib/mcp/tools/rs-experts-find.cjs:76, rs-thesis-read.cjs:104). commands/eureka.md lines 306 and 312 define them as the Eureka contract. tests/test-387-eureka-installed-layout.cjs:128 pins `other_serving: ['research_run','rs_experts_find','rs_thesis_read']` and `distinct_total: 75`. tests/test-270-tool-schema-budget.cjs lines 474-481 count them in the 75-tool budget. The owner rule "Eureka is never removed" applies. Treat the rs-* set as OUT of the cut menu; only a fold into `/mos:eureka` as sub-modes is open, and that is an owner decision with Phase 387 scope.
- Dashboard/deck/wiki/radar/visualize/present/publish/snapshot: table WRONG on `present`, see below.
- lean-canvas, value-proposition, user-needs: row HOLDS (recalibrate). Overlap check: `user-needs` ("Map user needs with importance vs satisfaction") and `analyze-needs` ("Score customer jobs with importance and satisfaction") have near-identical descriptions and the same `hitl_shape: F.8` (PROVEN, frontmatter). Both are reused by /mos:discover. analyze-needs is also the target of an `output_to` in pipelines/discovery/02-think-hats.md:6, so it has a pipeline caller; user-needs has no pipeline caller (grep of pipelines found none).

Sub-rows:
- visualize: **cut-ready candidate and already excluded from Part 11.** commands/visualize.md frontmatter: `deprecated: true`, `deprecated_redirect: "dashboard --mermaid"`, `deprecated_removal: "v1.14.0"`, `connector: excluded: true`. It is a soft-alias stub run by scripts/soft-alias-runner.cjs (header lists "4 (heal/organize/hmi-status/visualize)"; lib/memory/soft-alias.test.cjs). Remaining references: data/help-groups.json:228, lib/mcp/tool-router.cjs (`visualize` in the room_graph CLI-name list at line 575; the `visualize-room/-graph/-chain` sub-commands are a different, live surface), tests: run-all-173, run-all-175, test-209, test-publish-needs-flow, shape-violations-baseline, 341-registry-drift-baseline. The soft alias window is overdue by the file's own date. Still an owner card (router name list, drift baseline fixture).
- present: **WRONG in the table.** commands/present.md description "Generate the 6-view presentation and open it"; not in soft-alias-runner; referenced by commands/dashboard.md:162 ("Want all 6 views? /mos:present"), lib/hmi/jtbd-taxonomy.json:144, scripts/build-jtbd-nudges:160, lib/mcp/tool-router.cjs EXPORT_COMMANDS, lib/mos-face/dist/commands.js:492, lib/core/navigation/graph-export.cjs:274. Not a cut candidate on any evidence found.
- radar: KEEP holds. lib/core/doctor/capability-ledger-module.cjs (lines 17, 133, 157) tells the user to run `/mos:radar --fetch` to refresh data/capability-ledger.json. Phase 391 owns the radar fetch fix. 390 must not touch radar.
- dashboard, wiki: KEEP until Desktop check holds. lib/mcp/app-views.cjs:326, 354 register `room-dashboard`, `room-wiki`; line 413 logs "MCP Apps registered: room-dashboard, room-wiki, room-graph". lib/mcp/app-html/rooms.html:296 calls `room-dashboard` (the room picker). lib/mcp/app-identity.js:18 whitelists the args. These are MCP App views; the md commands and the app views are different surfaces that share names. A command cut does not remove the app tools, but a "dashboard" cut in the sense of the MCP view is blocked until a Desktop check (owner locked rule).
- publish, snapshot: active (last commit 2026-11-05). `publish` is named in lib/core/sensors/sensor-show-share.cjs (lines 82, 93) and in tool-router EXPORT_COMMANDS. Keep.
- deck: follows mos-deck-engine, keep.

## Flags: what a cut touches

| Flag | Where it bites | Evidence |
|------|----------------|----------|
| Born-wired (Part 11) | Every skill, command, agent. Removal must regenerate: connector-registry, connector-coverage-ledger, brain-orchestration-projection, render-coverage-registry, hitl-shape-backfill, layer-backfill, out-of-spine-allowlist. mullins-scaffold, chain-step-reviewer, mos-deck-engine, pws-methodology, client-discovery-interview are all in these. | Gates pass at HEAD: connector-registry OK, orchestration-projection OK, render-coverage 0 gap / 0 unwired (PROVEN). tests/test-209-declared-implies-wired.cjs and the 341 registry drift baseline fail on drift. |
| MCP tool / tool-budget gates | Router enums put command names in `tools/list`: `ANALYSIS_COMMANDS` (tool-router.cjs:362, enum at 1593) and `EXPORT_COMMANDS` (line 500, enum at 1925). Removing a name changes the golden `tests/fixtures/384-s7-tools-list-golden.json` (checked by tests/test-384-s7-mcp-start.cjs P1) and the byte count in tests/test-270-tool-schema-budget.cjs (75 tools, about 83.5 KB of schema recorded, 10 percent drift tolerance; lines 474-500). `rs_experts_find`, `rs_thesis_read` are real tools (test-387 pins them). | PROVEN by reading. UNVERIFIED: running either test (they start a real server; the 384 lock applies). |
| Hooks | `mva-detect.cjs` is a UserPromptSubmit hook (hooks/hooks.json:354); it belongs to Phase 389 owner question 1. `scripts/session-start` names `dashboard` (line 1727, the session doctrine text). No orphan module and no rs-* command is named in hooks, settings.json or .claude-plugin (PROVEN grep). | |
| Release lockstep | RULE 5 places 7 (website sync, command string and counts reported by Step 9.6c), 8 (Theo command-layer re-emit against the version), 9 (`data/framework-names.json` stamp), and the section-command ledger rebuild (Step 2.3). A removed command must also leave Theo's command layer: Theo tools `commands_for_problem_type` and `recommend_chain` return command handles (their names appear in the egress guard and brain-client). Removing a command in one cut and not re-emitting leaves Theo advising a missing command. UNVERIFIED how Theo stores handles; needs a Theo-side check before any command cut. | docs/RELEASE-CEREMONY-RULING-SYSTEM.md RULE 5 lines 12-14 (PROVEN read) |
| Part 8 | grill-engine is exercised by tests/test-213-part8-boundary.cjs. Recalibration moves C and D add Brain or Tavily reach. Any new path must pass `lib/core/part8-egress-guard.cjs`. | |
| Desktop / room-skeleton | ui command registry, ui/mos-face/hooks/commands.ts, templates/room-skeleton/section-contracts (market-analysis names explore-trends). New rooms scaffold these; a cut leaves dead names in new rooms. | PROVEN for explore-trends |
| Eureka rule | rs-* set and Eureka MCP tools. | PRD ruling |

## Pinecone dead-file list (PRD, verify each)

| File | Verdict | Evidence |
|------|---------|----------|
| lib/core/pinecone-inference.cjs | Gone | `test -f` = no. tests/test-385-pinecone-inference-removed.cjs exists. |
| scripts/export-pinecone-embeddings.cjs | Exists, no code importer, but NOT free to cut | Named in `scripts/load-embeddings-into-neo4j.cjs:7` (comment), tests/fixtures/127.1 (two fixture files). Last commit 2026-05-20. |
| scripts/consolidate-pinecone.py | Exists, no code importer | Pinned by tests/test-quick-261106-no-pinecone-key-literal.cjs (exit code 2 with a clear message when the key is missing). A delete requires deleting or rewriting that test. |
| Tier 2 stub in lazygraph-ops.cjs | Exists | `embedArtifact` at lines 1009-1040, exported at 1494, asserted by tests/test-sqlite-ops.cjs:215 and by the export list at line 383. No production caller. |
| rs-pinecone-bridge.cjs | Keep, rename later | Direct `require` lines in production: hsi-engine.cjs:99, hsi-lsa.cjs:122, rs-differential-scorer.cjs:94, rs-engine.cjs:57, semantic-index/embedding-spine.cjs:110, semantic-index/vector-store.cjs:60 (6). Two more files name it (scripts/rs-vector-bridge.cjs comment, sensors/sensor-content-relevance.cjs comment). The peer count "9 requirers" does not reproduce: 6 production requires, 8 production files with any mention. |
| mcp-server-brain/lib/pinecone-tools.cjs | Not in the PRD list | Exists, last commit 2026-05-23, named by mcp-server-brain/CLAUDE.md (brain_search, brain_stats rows) and a test comment. Add to the Pinecone steps 2 and 3 card; do not treat as dead. |

Steps 2 and 3 need their own proof and the owner's separate word (385-PROOF section 14). This research does not decide them.

## Architecture Patterns

### Flow of one approved cut

```
Owner card answered (per group)
   -> Wave 0 proof: re-run 385-no-caller-scan.cjs + name grep across CLI, Desktop registry, hooks, tests, MCP routers
   -> RED: tests/test-390-<group>-removed.cjs (path not tracked, no file names it) fails
   -> remove md/skill/lib files + edit tests that pin them
   -> regenerate: build-command-registry, build-skill-mirrors, build-dist-bundles, build-ui-shell, build-render-coverage, ledgers
   -> gates: build-connector-registry --check, build-orchestration-projection --check, check-render-coverage, test-209, 341 drift baseline, 384-s7 golden, test-270 budget
   -> ONE shell call: git rm + git add -f test + staged-set guard + git commit --only <explicit paths>
```

### Pattern: removal commit (from Phase 385 plan 15)
Source: `.planning/phases/385-*/385-15-PLAN.md` line 86 and 124. Join `git rm`, `git add -f <new test>`, the guard `git diff --cached --name-only` and `git commit --only -- <paths>` with `&&` in one call. The index is shared with peer sessions. On a failed guard, restore only your own staged paths and return `NEEDS_HUMAN`. `.planning/` files need `git add -f`.

### Anti-patterns
- Cutting from a zero count in the session logs. Proof must be a caller proof.
- Deleting a generated copy by hand (`dist/`, skill mirrors, registries). Run the generator.
- Treating a token hit in a comment as a caller (the 385 scan does; see below).
- Editing the router enum without moving the 384-s7 golden and the test-270 baseline in the same plan.

## Don't Hand-Roll

| Problem | Do not build | Use instead |
|---------|--------------|-------------|
| Caller scan | A new grep script | `385-no-caller-scan.cjs`, then a name grep for strings and commands (the scan misses prose-only and registry-only callers and over-counts comments) |
| Registry cleanup | Manual JSON edits | The generators listed in Standard Stack, then the `--check` gates |
| Removal proof | An ad-hoc check | A `test-390-*-removed.cjs` copied from `test-385-deep-links-removed.cjs` |

## Common Pitfalls

1. **Comment counts as a caller.** The scan counts any path-like token ending in `.cjs`, so fusion-router, grill-engine, methodology-ingest, session-register and voice-transition-detector look referenced (PROVEN, audit section G). The reverse is also true: a prose instruction such as ignite's "call resolveSessionRegister" looks like a wire but nothing executes it. Always read the line.
2. **Comparing the audit table to old text.** The `mullins-scaffold` "unwired" claim and the `present` soft-alias claim are both stale. Re-run the gates before relying on a table row.
3. **Router enum drift.** Removing a command from `EXPORT_COMMANDS` or `ANALYSIS_COMMANDS` changes `tools/list`. test-384-s7 P1 fails closed.
4. **Shared working tree.** A peer session has uncommitted files now (`388-measure.cjs`, `tests/run-all-388.sh`, `tests/test-388-ship-less.cjs`, PROVEN `git status`). Use `git commit --only` with explicit paths. Never `git add -A`.
5. **Theo command layer.** A removed command must be re-emitted in Theo before the next release or Theo can recommend it.
6. **Phase 389 dependency.** The ROADMAP says 390 depends on 389, and 389 has a PRD but no plan (PROVEN, `ls`). Do not plan any MVA-family cut in 390.
7. **Dist copies.** `dist/` is tracked and holds skill copies (for example dist/zed/.agents/skills/ignite/SKILL.md). Phase 388 (ship-less) is active and may change what ships. Re-check before a plan touches `dist/`.

## OWNER-DECISION items (research does not decide)

Each item needs one card. "Evidence" is the proof gathered; "Needs first" is what must be proven before a plan task deletes anything.

| ID | Decision | Evidence | Needs first | Flags |
|----|----------|----------|-------------|-------|
| OD-1 | Override R9/R10 for `tone-filter` and `nl-graph-queries` (cut or keep)? | Zero non-test references both (PROVEN). nl-graph-queries is read by test-355 (direction readers); tone-filter by test-205-decision-axes. | Rule on the two tests that load them; check Part 11 planned-contract status in docs/CANON-PHASE-MAP.md | R9 ruling; Part 11 planned-but-unwired |
| OD-2 | Planned-but-unwired group (expert-genesis, 2 synthetic-expert gates, ralph-loop-gate, cross-room-triggers, coverage-monitor): keep with a dated wire-or-cut deadline, or cut? | All test-only (scan). navigation/synthetic-expert.cjs stays regardless (3 live requirers). | R9 ruling stands; a deadline needs a date from the owner | Part 11; r-and-d copy of expert-genesis (named in the audit, not re-checked) |
| OD-3 | `grill-engine`: keep, wire, or cut? | No production require. Used by the Part 8 boundary test 213 and test 355. Guard coupling is comment-only. | Owner view on losing Part 8 test evidence; a replacement test if cut | Part 8 test; GRILL gear label stays |
| OD-4 | `session-register` and `methodology-ingest`: wire the code, or change the prose? | ignite prose tells Larry to call the module; ingest-methodology.md says "WIRED"; no code calls either (PROVEN). | Choose per module. If prose changes: edit commands/ignite.md, skills/ignite/SKILL.md, and tests/test-204-ignite-wiring-grep.cjs. If wire: a failing test first | Behaviour gap, not a cut. Part 11 (skill mirror regeneration) |
| OD-5 | `/mos:discover` group (command, discover skill, client-discovery-interview): keep, recalibrate, or cut as one? | Entangled with analyze-needs, user-needs, jtbd, mos-deck-engine (discover.md:109, 178, 189). Off-mission is a judgement. | Owner mission-fit word; check tests/run-all-1434.sh and test-209 | Part 11; 7 data files; Desktop registry |
| OD-6 | `mullins-scaffold` skill: keep, recalibrate, or cut? | Born-wired and doctrine-tested (see row B). Only code caller is its own test; Larry reads the skill. | Decide the Phase 143.2 MULL requirements first (tests 143.2 and run-all-1432) | Part 11; doctrine test |
| OD-7 | `chain-step-reviewer`: give it a real chain, fold into framework-runner, or leave? | No step declares `reviewer.kind: subagent` (PROVEN grep scope). Tested code path. | Name one chain that should be reviewed independently | Part 11 ledgers; test-347 trio |
| OD-8 | Helper-agent recalibration moves A to F: which to build? | No specialist table exists. 3 agents carry PROACTIVELY. | A is a doc edit to larry-extended (safe). B uses the sensor path. C and D add reach. F needs a counter. | Part 8 (C, D); hook budget (any new hook); Tri-polar |
| OD-9 | Trend/futures set (6 commands): merge plan or keep? | Each name sits in 13 or more data files and in the analysis router enum; chain calls between them (audit, ASSUMED not re-read). | A merge design card; the 384-s7 golden and test-270 baseline plan | MCP tool schema; Theo re-emit; room-skeleton templates; Desktop registry |
| OD-10 | rs-* set: fold into `/mos:eureka` as sub-modes, or keep? (cut is not offered) | `rs_experts_find`, `rs_thesis_read` are MCP tools pinned by test-387 and test-270; commands/eureka.md defines them. | Phase 387 owner input | MCP tool budget; Eureka never-removed rule |
| OD-11 | `visualize` removal and `present` status | visualize: deprecated, `deprecated_removal: v1.14.0` overdue, already Part 11 excluded. present: live, not an alias. | A removal date for visualize; confirm present stays | Router name list; 341 drift baseline; run-all-173/175 |
| OD-12 | `user-needs` vs `analyze-needs` overlap: merge, redirect, or keep both? | Same description shape and F.8 shape; discover uses both; only analyze-needs has a pipeline caller. | Read both bodies side by side (not done) | Part 11; discover group |
| OD-13 | Pinecone steps 2 and 3 (export-pinecone-embeddings, consolidate-pinecone.py, Tier 2 stub, mcp-server-brain/lib/pinecone-tools.cjs) | Table above. Each has a test or fixture pin. | Per-file proof; owner's separate word | 385-PROOF section 14 |
| OD-14 | The other dead-set modules not in the audit table (12 modules, section A) | Covered by R9 keep-all. | State "no new card" or add them | R9 |

## Runtime State Inventory

Not a rename phase, but cuts leave runtime state. Answered for the whole phase:

| Category | Items found | Action |
|----------|-------------|--------|
| Stored data | Rooms created from templates carry `explore-trends` etc. in section contracts and `ROOM.md` text. Not scanned in any real room. | UNVERIFIED. Check templates/room-skeleton only; never read a user room. |
| Live service config | Theo's command layer (handles returned by `recommend_chain`, `commands_for_problem_type`). | Theo re-emit at release (RULE 5 place 8). Needs Theo-side check. |
| OS-registered state | None found in hooks or settings for any candidate (PROVEN grep). | None |
| Secrets/env vars | None tied to candidates. PINECONE_API_KEY and PINECONE_INDEX only for the Pinecone items. | OD-13 |
| Build artifacts | `dist/` skill copies, `lib/mos-face/dist/*.js`, `ui/shared/src/generated/mcp-adapter.ts`, skill mirrors. | Regenerate with the generators; never hand-edit |

## Environment Availability

| Dependency | Required by | Available | Notes |
|------------|-------------|-----------|-------|
| node (with node:sqlite) | scan, gates, tests | yes | Gates ran at HEAD with an ExperimentalWarning for SQLite |
| git | scan, commits | yes | |
| Desktop app | Desktop check for dashboard/wiki/graph views | not checked in this session | The owner rule needs a Desktop check; a human step |
| Theo repo `/home/jsagi/Theo` | command-layer check | not checked | |

## Validation Architecture

`workflow.nyquist_validation` is `true` in .planning/config.json (PROVEN line 40).

| Property | Value |
|----------|-------|
| Framework | Node scripts with `node:assert`; no external runner. Phase scripts `tests/run-all-<phase>.sh` |
| Quick run | `node tests/test-390-<group>-removed.cjs` |
| Gates | `node scripts/build-connector-registry.cjs --check`, `node scripts/build-orchestration-projection.cjs --check`, `node scripts/check-render-coverage.cjs` (all pass now) |
| Heavy (server start) | `node tests/test-384-s7-mcp-start.cjs parity`, `node tests/test-270-tool-schema-budget.cjs`, `tests/test-387-eureka-installed-layout.cjs` (run under the 384 lock; UNVERIFIED) |

| Req | Behavior | Test | Exists |
|-----|----------|------|--------|
| R390-TABLE | The table file matches the code | a read-only check that re-runs the scan and compares counts (20 / 18 / 2 lib/core) | Wave 0 gap |
| R390-FIX | Ignite prose and code agree | extend tests/test-204-ignite-wiring-grep.cjs or add a behavior test for `resolveSessionRegister` | partial (grep test exists) |
| R390-CUT-n | Cut path not tracked, no name in tracked files, gates green | copy of test-385-deep-links-removed.cjs | Wave 0 gap per group |

Wave 0 gaps: no `tests/run-all-390.sh`; no 390 removal tests. Sampling: per task, the new removal test plus the three `--check` gates; per wave, `bash tests/run-all-390.sh` plus the heavy trio for any wave that touches a router enum; phase gate: `node scripts/doctor.cjs --acceptance`.

## Security Domain

`security_enforcement` is not set in config.json (grep found only nyquist), so treat as enabled.

| ASVS category | Applies | Control |
|---------------|---------|---------|
| V5 Input validation | yes, only for any recalibration that adds fetches (moves C, D) | `lib/core/part8-egress-guard.cjs`; zod schemas on MCP tools |
| V2/V3/V4/V6 | no | no auth, session, access or crypto change in this phase |

Threats: (1) a removal that disables a Part 8 guard test (grill-engine, test-213): keep the boundary test green. (2) A recalibration that sends room text to the Brain or Tavily: generic handles only. (3) Removing a hook-adjacent file the session-start path loads: only `scripts/session-start` and `mva-detect.cjs` touch candidates; both outside 390.

## State of the Art

| Old | Current | Impact |
|-----|---------|--------|
| Audit counted `present` a soft alias | Only `visualize` is | Fix the table |
| Audit: mullins-scaffold counted unwired by render-coverage | 0 unwired at HEAD | Fix the table |
| Audit: "9 requirers" of rs-pinecone-bridge | 6 production requires | Fix the PRD number |

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | The 6 helper agents are reachable only through their parent command (verified for vault only) | Agents | A cut or fold of a parent command may orphan an agent |
| A2 | No module is loaded by a path built from parts in a data file | Orphans | A "dead" module could be live. The grep of non-literal requires found none by name |
| A3 | Theo stores command handles that a command cut would leave stale | Flags | Release could advise a missing command |
| A4 | The trend commands chain into each other (audit statement, not re-read) | Command groups | Merge design may differ |
| A5 | The heavy tests (384-s7, 270, 387) pass now and will move with an enum edit | Flags | Plan may need a golden regeneration step |
| A6 | `r-and-d/` copies of expert-genesis and others exist (audit; not checked) | OD-2 | A cut orphans the r-and-d copy |

## Open Questions

1. Does Theo keep command handles, and how does the release re-emit remove one? Recommendation: ask Theo's repo owner session through the guarded path before any command-group plan.
2. Is `tools/list` golden regenerated by a documented command? The test header says `SPEED384_WRITE_GOLDEN=1 node tests/test-384-s7-mcp-start.cjs parity`. The planner should include it only for an enum edit.
3. Which owner cards come first? The research order in the audit file (section F) is reasonable: orphans, skills, agents, command groups.

## Sources

Primary (read at HEAD ce3886f73): `.planning/phases/390-.../390-PRD.md`; `.planning/audits/PHASE-390-KEEP-RECALIBRATE-CUT-TABLE.md`; `.planning/phases/385-.../385-PROOF.md` (sections 1, 10, 11, 14), `385-no-caller-scan.cjs`, `385-15-PLAN.md`; `.planning/ROADMAP.md` lines 4091-4135; `commands/discover.md`, `ignite.md`, `ingest-methodology.md`, `visualize.md`, `present.md`, `deck.md`, `eureka.md`; `lib/core/chain-step-dispatcher.cjs`, `part8-egress-guard.cjs`, `lib/mcp/tool-router.cjs`, `lib/mcp/app-views.cjs`; `data/connector-registry.json`, `connector-coverage-ledger.json`, `deck-aliases.json`; `tests/test-204-ignite-wiring-grep.cjs`, `test-270-tool-schema-budget.cjs`, `test-384-s7-mcp-start.cjs`, `test-387-eureka-installed-layout.cjs`, `test-213-part8-boundary.cjs`, `test-385-deep-links-removed.cjs`; `docs/RELEASE-CEREMONY-RULING-SYSTEM.md` RULE 5; `scripts/build-render-coverage.cjs`; project CLAUDE.md. Commands run: the 385 scan, the three Part 11 `--check` gates, `git grep` and `ls` counts.

Not consulted: Context7 and the web (no library question in this phase).

## Project Constraints (from CLAUDE.md)

- Part 8: user data never reaches the Brain; generic handles only. Part 7: reuse before build. Part 11: born-wired or excluded; the gate fails the build closed; surface count is enumerated at run time, never a frozen literal.
- No em-dashes anywhere. Feynman-simplified prose.
- All dev work runs through GSD. Release only through `scripts/release.sh`; never bump versions by hand. No push, no tag.
- Tri-polar: judge each cut on CLI, Desktop and Cowork.
- `.planning/` is gitignored but tracked files need `git add -f`; use `git commit --only`.
- Workspace: this tree is a worktree of the release checkout; a peer session has uncommitted 388 files.

## Metadata

Confidence: caller facts HIGH; cut cost MEDIUM; usage-based claims LOW (one machine, Claude Code only). Research date 2026-11-07. Valid until Phase 388 or 389 lands, or about 14 days (the tree moves fast).
