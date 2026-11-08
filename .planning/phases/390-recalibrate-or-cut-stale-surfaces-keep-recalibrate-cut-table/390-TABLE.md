# Phase 390 step 1: verified keep / recalibrate / cut table

Filed: 2026-11-08 by plan 390-01 (research proof date 2026-11-07). HEAD at filing: 3002cf611. Repo version at filing: 2.0.0-beta.82.

Sources: 390-PRD.md, 390-RESEARCH.md, 390-CONTEXT.md, .planning/audits/PHASE-390-KEEP-RECALIBRATE-CUT-TABLE.md (relayed hypotheses), 390-table-check.cjs (the checks behind the corrections).

Tag rule: PROVEN = the command was run in this session. UNVERIFIED = not run. ASSUMED = taken from the PRD or the relayed audit without a re-check. A row with no tag carries the tag of its evidence cell.

This table decides nothing. The owner decides on the cards in 390-DECISION.md.

Rules that hold for every row (390-CONTEXT.md): no surface is deleted in step 1 (D-06). A zero count in one corpus reads "NOT OBSERVED in this corpus" and never chooses a verdict (D-07). A row may say CUT-CANDIDATE only if its evidence column lists the callers a later cut must still clear across CLI, Desktop, Cowork, hooks and tests (D-08).

Verdict words: KEEP, RECALIBRATE, CUT-CANDIDATE, FOLD-ONLY, FOLLOWS-389, FOLLOWS-391.

Line numbers in this file were re-checked with grep at HEAD 3002cf611 unless the Flags column says "carried". Two lines moved since the research: the mullins-scaffold entry in data/connector-registry.json is now at line 2258 (research said 2253), and the stamped-at-merge comment in scripts/build-render-coverage.cjs spans lines 368 to 371.

## A. lib/core modules

The counts of the module scan (565 modules, 20 in the dead set) belong to 390-SCAN.md (plan 390-02). This section holds verdicts only.

| Surface | Verdict | Card | Evidence (file:line) | Flags |
|---|---|---|---|---|
| expert-genesis | KEEP (R9) | OD-2 | no production require; comment at lib/core/synthetic-expert-construction-gate.cjs:40 (carried); tests/test-203-genesis-fanout.cjs; it requires navigation/synthetic-expert.cjs at lib/core/expert-genesis.cjs:44 | Part 11 planned contract; r-and-d copy not re-checked (ASSUMED) |
| synthetic-expert-construction-gate | KEEP (R9) | OD-2 | tests only (carried from the research) | decide with expert-genesis |
| synthetic-expert-behavior-gate | KEEP (R9) | OD-2 | tests only (carried) | decide with expert-genesis |
| ralph-loop-gate | KEEP (R9) | OD-2 | closure extra of the dead set (audit section G); comments only in card-fire-gate and the construction gate | loaded only by dead-set modules |
| cross-room-triggers | KEEP (R9) | OD-2 | no non-test reference (research); tests/test-195-triggers.cjs (carried) | planned-but-unwired |
| coverage-monitor | KEEP (R9) | OD-2 | no non-test reference (research); tests/test-coverage-rollup.cjs (carried) | planned-but-unwired |
| tone-filter | KEEP (R9), weak CUT-CANDIDATE | OD-1 | only caller tests/test-205-decision-axes.cjs:29 (require). Callers a later cut must clear: CLI none, Desktop none, Cowork none, hooks none (research grep), tests one | needs a new per-module ruling over R9 |
| nl-graph-queries | KEEP (R9), weak CUT-CANDIDATE | OD-1 | only caller tests/test-355-direction-readers.cjs:193 (require; also named at line 19 and 373); docs/BACKEND-MAP.md:203 (carried). Callers a later cut must clear: CLI none, Desktop none, Cowork none, hooks none, tests one (the direction readers). It is not the engine behind /mos:rs-explain | last commit 2026-09-24, so not abandoned code |
| grill-engine | KEEP | OD-3 | no production require. Required by tests/test-213-part8-boundary.cjs:51, tests/test-355-direction-readers.cjs:149, tests/test-205-grill-engine.cjs:35. See correction C3 | Part 8 test evidence rides on it |
| session-register | RECALIBRATE | OD-4A | commands/ignite.md:166 and skills/ignite/SKILL.md:162 tell Larry to call resolveSessionRegister(role_blend); no code requires the module | behaviour gap, not a cut. A prose fix also changes tests/test-204-ignite-wiring-grep.cjs (carried) |
| methodology-ingest | RECALIBRATE | OD-4B | commands/ingest-methodology.md:25 and :70 name lib/core/methodology-ingest.cjs as the wired engine; no code requires it | behaviour gap, not a cut |
| fusion-router | KEEP | NONE | documented seam: prose in commands/find-analogies.md and skills/find-analogies/SKILL.md; no require (research) | comment precedent in eureka adapters |
| voice-transition-detector | KEEP | NONE | named only in a comment at lib/core/fork-declaration.cjs:41 (carried); no require | documented precedent |
| navigation/synthetic-expert.cjs | KEEP | NONE | LIVE: lib/core/navigation.cjs:65, lib/core/expert-genesis.cjs:44, scripts/close-loop.cjs:44 | a glob synthetic-expert-* must not match it |
| observation-schema, card-fire-gate, subsystem-render, graph-refine-loop, ignite-branch-gate, larryreach-loop-health, memory-cortex-packet, ab-harness, recovery/controller, salient-governance, supersession-gate, artifact-brain-packet | KEEP (R9) | OD-14 | dead set of the 385 scan (audit section G, carried); R9 keeps all | covered by R9; the card states no new cut |

## B. Skills

| Surface | Verdict | Card | Evidence (file:line) | Flags |
|---|---|---|---|---|
| client-discovery-interview | RECALIBRATE with the /mos:discover group | OD-5 | commands/discover.md:45, :83, :163 read its SKILL.md, question bank and discovery-scaffold.json; tests/run-all-1434.sh:28; tests/test-209-declared-implies-wired.cjs:395 | not a stand-alone skill. discover reuses analyze-needs, user-needs, jtbd (discover.md:109, :189) and mos-deck-engine (:178). Off-mission is the owner's call |
| mullins-scaffold | RECALIBRATE or KEEP | OD-6 | see correction C2. data/connector-registry.json:2258; data/connector-coverage-ledger.json:1444; tests/test-143.2-doctrine-presence.cjs:57 and :58 | born-wired and doctrine-tested; only code caller of lib/core/mullins-scaffold.cjs is its own test |
| pws-methodology | KEEP | NONE | scripts/verify-release:307 (REQUIRED_SKILLS); tests/test-143.2-doctrine-presence.cjs:53 | release gate needs it |
| intelligence-orchestrator | KEEP | NONE | core dispatcher; connector.excluded per the render-coverage comment (carried) | core |
| mos-deck-engine | KEEP while /mos:deck stays | NONE | commands/deck.md:56 and :82; commands/discover.md:178; data/deck-aliases.json keeps the legacy handle | follows the deck decision |
| mva-pipeline | FOLLOWS-389 | NONE | Phase 389 owns the MVA family | no card (D-12) |

## C. Agents

Production file counts per agent are in correction C4 (scope stated there).

| Surface | Verdict | Card | Evidence (file:line) | Flags |
|---|---|---|---|---|
| chain-step-reviewer | RECALIBRATE | OD-7 | lib/core/chain-step-dispatcher.cjs:435 gate on reviewer.kind subagent; no chain declares that kind (research grep); data/brain-orchestration-projection.json:3574; data/connector-coverage-ledger.json:700 | wired but never fed; test-347 trio pins it; Part 11 ledgers |
| analogy-query-fetcher | KEEP, recalibration move OD-8A | OD-8A | commands/find-analogies.md:218, commands/scout.md:171 | two parent commands. See C4 |
| competitor-watch-fetcher | KEEP, recalibration move | OD-8B | commands/scout.md:166 | one parent command. See C4 |
| dominant-design-researcher | KEEP, recalibration move | OD-8C | commands/dominant-designs.md:129 | one parent command. See C4 |
| research-lane-analyst | KEEP, recalibration move | OD-8D | commands/research.md:494 (prose dispatch sentence) | one parent command. See C4 |
| vault-section-reviewer | KEEP, recalibration move | OD-8E | commands/vault.md:218 | one parent command. See C4 |
| meeting-perspective-extractor | KEEP, recalibration move | OD-8F | commands/file-meeting.md:399, commands/scout.md:171 | two parent commands. See C4 |
| grant-reviewer | KEEP | NONE | owner ruling on grade-grant (D-01) | no cut offered |
| reverse-salient-agent, framework-runner, persona-analyst, brain-query, opportunity-scanner, investor, grading, larry-extended, research | KEEP | NONE | wired in teams, commands and lib (research) | investor, grading, opportunity-scanner carry PROACTIVELY (FACT-09) |

## D. Command groups

| Surface | Verdict | Card | Evidence (file:line) | Flags |
|---|---|---|---|---|
| macro-trends, explore-trends, explore-futures, scenario-plan, futures, trending-to-absurd | RECALIBRATE | OD-9 | four of the six sit in ANALYSIS_COMMANDS at lib/mcp/tool-router.cjs:362 (enum at :1593); explore-trends is named in 13 data JSON files (research count, carried) | MCP tools/list golden and test-270 budget move with any enum edit; room-skeleton templates name them; Theo re-emit |
| rs-experts, rs-explain, rs-fetch, rs-thesis | FOLD-ONLY | OD-10 | MCP tools rs_experts_find and rs_thesis_read; commands/eureka.md:306 and :312; tests/test-387-eureka-installed-layout.cjs:128 | D-02: a card may offer a fold into /mos:eureka, never a cut |
| visualize | CUT-CANDIDATE | OD-11 | commands/visualize.md frontmatter deprecated: true, deprecated_removal v1.14.0 (line 16); repo version is 2.0.0-beta.82, so the date is past. Callers a later cut must clear: CLI data/help-groups.json:228, lib/mcp/tool-router.cjs:575 (room_graph CLI-name list), scripts/soft-alias-runner.cjs:31; Desktop ui/mindrian-workspace-mod/assets/command-registry.json, ui/mos-face/hooks/commands.ts, lib/mos-face/dist/commands.js; Cowork same registry copies (UNVERIFIED, not run on Cowork); hooks none (git grep over hooks, .claude-plugin, settings.json); tests tests/run-all-173.sh, run-all-175.sh, run-all-347.sh, test-209-declared-implies-wired.cjs, test-347-visualize-real-chain.cjs, fixtures shape-violations-baseline.txt, 341-registry-drift-baseline.json, 384-s7-tools-list-golden.json | already Part 11 excluded; only deprecated alias in the group. See C1 |
| present | KEEP | NONE | live, not deprecated: commands/present.md frontmatter has no deprecated key; named by commands/dashboard.md:162, lib/hmi/jtbd-taxonomy.json:144, lib/mcp/tool-router.cjs:501 (EXPORT_COMMANDS), lib/mos-face/dist/commands.js:492 | see correction C1 |
| radar | KEEP, FOLLOWS-391 | NONE | lib/core/doctor/capability-ledger-module.cjs:152, :185, :202 tell the user to run /mos:radar --fetch | D-11: Phase 391 owns the fetch fix |
| dashboard, wiki | KEEP | NONE | MCP App views room-dashboard and room-wiki at lib/mcp/app-views.cjs:324 and :326; scripts/session-start:1727 | D-09: no change without a Desktop check |
| publish, snapshot, deck | KEEP | NONE | publish named in lib/core/sensors/sensor-show-share.cjs:82 and :93 and in EXPORT_COMMANDS (tool-router.cjs:501); deck follows mos-deck-engine | active, recent commits |
| user-needs, analyze-needs | RECALIBRATE | OD-12 | both hitl_shape F.8 (commands/user-needs.md:7, commands/analyze-needs.md:7); only analyze-needs has a pipeline caller (pipelines/discovery/02-think-hats.md:6); discover reuses both | overlap check: read both bodies side by side is still open |
| lean-canvas, value-proposition | KEEP | OD-15 | research: recalibrate rather than cut; many test and registry callers (carried) | card id OD-15 is written by plan 390-05 |
| /mos:discover with the discover skill | RECALIBRATE | OD-5 | see section B, client-discovery-interview | decide as one group |
| grade, deep-grade, grade-grant | KEEP | NONE | owner ruling D-01 | no cut offered |
| transcribe-audio | KEEP and documented | NONE | Phase 386 plan 41, D-05 | not a card item |

## E. Pinecone files

| Surface | Verdict | Card | Evidence (file:line) | Flags |
|---|---|---|---|---|
| scripts/export-pinecone-embeddings.cjs | KEEP until proof | OD-13 | file exists; named in scripts/load-embeddings-into-neo4j.cjs:7 (comment) and two fixtures under tests/fixtures/127.1 (carried) | D-03: own proof and the owner's separate word |
| scripts/consolidate-pinecone.py | KEEP until proof | OD-13 | file exists; pinned by tests/test-quick-261106-no-pinecone-key-literal.cjs (carried) | a delete needs that test changed |
| embedArtifact stub in lib/core/lazygraph-ops.cjs | KEEP until proof | OD-13 | defined near line 1013 (contract comment); asserted by tests/test-sqlite-ops.cjs (carried) | no production caller |
| mcp-server-brain/lib/pinecone-tools.cjs | KEEP until proof | OD-13 | file exists; named by mcp-server-brain/CLAUDE.md (carried) | not in the PRD list; not dead |
| lib/core/rs-pinecone-bridge.cjs | KEEP, rename later | NONE | 6 production requires. See correction C5 | D-03: never delete |
| lib/core/pinecone-inference.cjs | gone (385-15) | NONE | file does not exist at HEAD (PROVEN, ls) | tests/test-385-pinecone-inference-removed.cjs exists |

## F. Not offered on any card

- The MVA family (Phase 389, D-12).
- /mos:radar (Phase 391, D-11).
- The grade family: grade, deep-grade, grade-grant (D-01).
- Eureka and any cut of the rs-* set (D-02). Only a fold is open.
- Theo shim exposure changes (D-13).

## Corrections

The relayed audit and PRD held five wrong or overstated claims. The old text stays visible in the audit file and the PRD. Each row names the FACT check in 390-table-check.cjs that proves the verified value.

| ID | Where the old claim stands | Old claim | Verified value | Proof |
|---|---|---|---|---|
| C1 | audit section D, row "dashboard / deck / wiki / radar / visualize / present / publish / snapshot" | visualize and present are soft-aliased; present is a cut-candidate after the alias window | Only visualize is a deprecated soft alias (deprecated: true, redirect "dashboard --mermaid", removal v1.14.0, past against repo version 2.0.0-beta.82). present is live and not deprecated; it is named by commands/dashboard.md, lib/hmi/jtbd-taxonomy.json, scripts/build-jtbd-nudges, lib/mcp/tool-router.cjs EXPORT_COMMANDS and lib/mos-face/dist/commands.js | FACT-01 and FACT-02 |
| C2 | audit section B, row mullins-scaffold; PRD line "mullins-scaffold (1 caller)" | render-coverage already counts it as an unwired declaration | scripts/check-render-coverage.cjs reports 0 unwired (198 wired, 2 excluded). The skill is born-wired (data/connector-registry.json, connector-coverage-ledger.json, out-of-spine allowlist, hitl-shape-backfill, layer-backfill) and doctrine-tested (tests/test-143.2-doctrine-presence.cjs). The part of the old claim that holds: lib/core/mullins-scaffold.cjs has only its own test as a code caller | FACT-03 and FACT-04 |
| C3 | audit section A, row grill-engine | the egress guard keeps a closed list that mirrors grill-engine bias-technique strings | The link is comment-only (lib/core/part8-egress-guard.cjs lines 1168 and 1241 are comments). METHODOLOGY_TECHNIQUE_WORDS (line 1170) has one member, premortem. The real cost of a later cut is Part 8 test evidence: tests/test-213-part8-boundary.cjs:51 requires grill-engine, as do test-355 (line 149) and test-205 (line 35) | FACT-05 and FACT-06 |
| C4 | audit section C, finding paragraph | 6 helper agents have exactly ONE entry (their parent command) | Wrong as worded. Each agent is named in 7 to 15 tracked production files (counts below), made of the parent command, its skill mirror, registries and data/subagent-dispatch-grants.json. Two agents have two parent commands: analogy-query-fetcher (find-analogies and scout) and meeting-perspective-extractor (file-meeting and scout). The logical claim "reachable only through parent commands" holds. research-lane-analyst is named by commands/research.md line 494 in a prose dispatch sentence, not a code dispatch line. larry-extended and references/personality/agent-operations.md name none of the seven helpers; exactly 3 agents carry PROACTIVELY (investor, grading, opportunity-scanner) | FACT-07, FACT-08, FACT-09 |
| C5 | PRD line 9, "rs-pinecone-bridge.cjs ... 9 requirers by the peer's count" | 9 requirers | 6 production requires: lib/core/hsi-engine.cjs:99, hsi-lsa.cjs:122, rs-differential-scorer.cjs:94, rs-engine.cjs:57, semantic-index/embedding-spine.cjs:110, semantic-index/vector-store.cjs:60. Four test files also require it (lib/memory/test-rs-differential-scorer.cjs, lib/memory/test-rs-pinecone-bridge.cjs, tests/296-no-pinecone-internal.test.cjs, tests/test-211-embedding-spine.cjs). The count 9 does not reproduce. 6 production requires, not 9 | FACT-10 |

C4 production file counts, measured 2026-11-08 at HEAD 3002cf611 with git grep -l -F over commands, skills, lib, scripts, hooks, pipelines, data, teams, references and agents, with test files and docs excluded (PROVEN). The research used a narrower scope and got 5 to 10; the logical conclusion is the same.

| Agent | Production files | Test files | Parent commands |
|---|---|---|---|
| analogy-query-fetcher | 12 | 0 | find-analogies, scout |
| competitor-watch-fetcher | 8 | 0 | scout |
| dominant-design-researcher | 7 | 4 | dominant-designs |
| research-lane-analyst | 7 | 2 | research |
| vault-section-reviewer | 9 | 0 | vault |
| meeting-perspective-extractor | 15 | 0 | file-meeting, scout |
| chain-step-reviewer | 4 | 4 | none (wired but never fed) |
