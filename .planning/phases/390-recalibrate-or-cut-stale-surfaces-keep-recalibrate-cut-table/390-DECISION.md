# Phase 390 decision cards: recalibrate or cut stale surfaces

Written: 2026-11-08 by plan 390-05. HEAD when written: f8cca1d52 (the sealed HEAD is on the machine line below). Repo version: 2.0.0-beta.82.

This card decides nothing. The owner answers one line per group.

Nothing is removed, renamed or edited by this phase until an answer is recorded. No push, tag or release follows from an answer. A removal reaches users only after a release is cut and picked up.

## How to answer

There are six groups, G1 to G6. Each group has one answer line. You can answer in one word per group, or pick items one by one.

- KEEP-ALL: change nothing in the group.
- RECOMMENDED: take the recommendation printed on every card of the group.
- CUSTOM: name one option for every item of the group, as OD-x=OPTION pairs.

```
G1 RECOMMENDED
G3 KEEP-ALL
G2 CUSTOM OD-4A=WIRE OD-4B=FIX-PROSE
```

The main session writes the token into the answer line of the group. The executor of this plan wrote no answer. Every answer line below reads PENDING.

## Words in this card

- R9 and R10: the 385 ruling of 2026-11-06 "keep everything and delete nothing" for test-only modules and other unwired items. A cut of any orphan module needs a new ruling for that module (D-04).
- Born-wired (Canon Part 11): a command, skill or agent is registered by a generator, not by hand. A removal must run the generators and the three --check gates.
- Orphan or dead set: a module with no production caller found by the 385 scan. The scan counts comments, so the caller matrix in 390-SCAN.md section 4 reads each line.
- Cowork: not observable from this machine, so Cowork is UNVERIFIED on every card.
- Tags: PROVEN means I ran the command or read the line in this session (2026-11-08). UNVERIFIED means I did not run it. Usage logs are never a reason for a cut (D-07).

## Summary at a glance

| Group | Subject | Items | Token for the recommendations | What RECOMMENDED would cause later |
|-------|---------|-------|-------------------------------|------------------------------------|
| G1 | Orphan modules in lib/core | 4 (OD-1, OD-2, OD-3, OD-14) | RECOMMENDED | A dated wire-or-cut deadline file for six modules (OD-2, 90 days). No product edit. Nothing is cut. |
| G2 | Behaviour gaps (prose says wired, code is not) | 2 (OD-4A, OD-4B) | RECOMMENDED | Prose fixes for /mos:ignite and /mos:ingest-methodology and the test that pins the ignite prose. No behaviour that ran is removed. |
| G3 | Skills | 2 (OD-5, OD-6) | KEEP-ALL | Nothing. RECOMMENDED here equals KEEP-ALL. |
| G4 | Agents | 6 (OD-7, OD-8A, OD-8B, OD-8C, OD-8D, OD-8F) | RECOMMENDED | One doc edit: a specialist table in agents/larry-extended.md, with a test. |
| G5 | Command groups | 5 (OD-9, OD-10, OD-11, OD-12, OD-15) | RECOMMENDED | Removal of the deprecated /mos:visualize alias only (OD-11, Desktop check CLEAN). Everything else stays. |
| G6 | Pinecone files | 1 (OD-13) | RECOMMENDED | One proof per file and one card per file. Deletes nothing. |

## Not on any card

- The grade family: grade, deep-grade, grade-grant (D-01).
- Eureka, and any cut of an rs-* command (D-02). The rs-* card (OD-10) offers a fold design only.
- /mos:radar (D-11). Phase 391 owns the radar fetch fix.
- The MVA family: mva-option, the mva-pipeline skill, the option router, the mva-detect hook (D-12). Phase 389 owns it. Phase 389 state, copied from 390-SCAN.md section 6 and re-read at write time (PROVEN, 05:35 UTC on 2026-11-08): 14 PLAN files and 4 SUMMARY files (389-01, 389-02, 389-03, 389-05). Verdict: part executed. The state is live and changes while executors work. A later wave that touches a surface the MVA family uses must re-check Phase 389 first.
- transcribe-audio (D-05): left and documented in Phase 386 plan 41.
- present: live, not deprecated (correction C1 of 390-TABLE.md). Only visualize is a deprecated alias.
- lib/core/rs-pinecone-bridge.cjs (D-03): six production requires; rename later, never delete.
- Theo shim exposure changes (D-13).
- The KEEP rows of 390-TABLE.md that have card NONE: fusion-router, voice-transition-detector, navigation/synthetic-expert.cjs (live), pws-methodology, intelligence-orchestrator, mos-deck-engine, grant-reviewer and the other wired agents, dashboard, wiki, publish, snapshot, deck.

Sequencing rule from Phase 389 (390-SCAN.md section 6): a later 390 wave that edits a file also edited by a 389 plan runs only after that 389 plan has a SUMMARY file. The cards OD-4A and OD-11 repeat it.

HEAD-AT-DECISION: da344de662a160ae718f3e9e996820c1ac3c4b57

## G1 Orphan modules in lib/core

Rule D-04: the 385 ruling R9 and R10 says keep all and delete none for test-only modules. A cut of any module needs a new ruling for that module. On OD-1 and OD-2 your answer is that per-module ruling. It is the ruling D-04 (385-PROOF R9 and R10) requires before any of them is cut.

### OD-1 tone-filter and nl-graph-queries

Question: do you want to cut one or both of these two modules that only a test loads, or keep them?

Facts:
- tone-filter: 147 lines. Only caller is tests/test-205-decision-axes.cjs line 29 (require). No hook, Desktop source, MCP source or command names it. Last commit 2026-09-24. (PROVEN)
- nl-graph-queries: 187 lines. Only caller is tests/test-355-direction-readers.cjs line 193 (require; also lines 19 and 373). docs/BACKEND-MAP.md line 203 lists it ("NL->Cypher against room graph"). Last commit 2026-09-24. (PROVEN)
- nl-graph-queries is not the engine behind /mos:rs-explain. scripts/rs-explain-command.cjs requires rs-nl-to-query.cjs and rs-query-to-text.cjs (lines 45 and 46). (PROVEN)
- docs/CANON-PHASE-MAP.md and docs/MINDRIAN-CANON.md name neither module, so I found no planned-contract note. (PROVEN, grep)
- Caller matrix rows: both TEST-ONLY, HOOK 0, DESKTOP 0, MCPB 0 (390-SCAN.md section 4). 390-TABLE.md verdict: KEEP (R9), weak CUT-CANDIDATE.

Surfaces: CLI none. Desktop none. Cowork UNVERIFIED.

Cost of each non-KEEP option: delete the module file; edit or delete the test that loads it (test-205-decision-axes for tone-filter; the HSI legs of test-355 for nl-graph-queries, which also checks the direction rules); fix the BACKEND-MAP row; no registry row, no generator run. A cut of nl-graph-queries removes direction-reader test evidence from test-355 unless that leg is rewritten.

Recommendation: KEEP. Reason: R9 holds, the research found no gain from a cut, and the test evidence is real.

OPTIONS OD-1: KEEP | CUT-TONE-FILTER | CUT-NL-GRAPH-QUERIES | CUT-BOTH ; RECOMMENDED: KEEP

### OD-2 the planned-but-unwired set (six modules)

Question: do you want to keep these six unwired modules with a dated wire-or-cut deadline, keep them without one, or cut them?

Facts (PROVEN unless tagged):
- expert-genesis (437 lines): no production require. Comment at lib/core/synthetic-expert-construction-gate.cjs line 40. Test: tests/test-203-genesis-fanout.cjs. A copy exists in r-and-d/breakthrough-engines/engines/bono/lib/core/expert-genesis.cjs.
- synthetic-expert-construction-gate (170 lines) and synthetic-expert-behavior-gate (99 lines): tests only (test-203-construction-gate, test-203-behavior-gate, tests/run-all-203.sh) and the retired plurai baseline files under evals/plurai. No r-and-d copy.
- ralph-loop-gate (48 lines): only comments in two dead-set modules (card-fire-gate, the construction gate). Test: test-201-ralph-loop-gate. No r-and-d copy.
- cross-room-triggers (222 lines): tests/test-195-triggers.cjs only. coverage-monitor (183 lines): tests/test-coverage-rollup.cjs only. No r-and-d copy for either.
- navigation/synthetic-expert.cjs is LIVE and stays in every option. Its three requirers: lib/core/navigation.cjs line 65, lib/core/expert-genesis.cjs line 44, scripts/close-loop.cjs line 44.
- docs name only three of the six (the plurai usage report). No Canon contract text found for the other three (grep of docs/).

Surfaces: CLI none. Desktop none. Cowork UNVERIFIED.

What a DEADLINE answer does: a later plan writes one dated line per module (the answer date plus 30, 90 or 180 days) into a new file, .planning/390-DEADLINES.md, edits no product file, and plans a re-check on that date.
What CUT-SET-LISTED does: a later wave removes exactly the six listed modules, edits or deletes the tests that load them, and decides the r-and-d copy of expert-genesis. Cost: six files, six or seven test files (203, 201, 195, coverage-rollup), run-all-201 and run-all-203 lines. No registry row. Your answer to this item is the per-module ruling that D-04 (385-PROOF R9 and R10) requires before any of them is cut.

Recommendation: DEADLINE-90D. Reason: the audit suggests keep with a dated wire-or-cut deadline. The six are planned contracts under Canon Part 11 that nothing wires yet. A date forces a decision without a cut.

CUT-SET-LISTED means: removal of exactly six modules: expert-genesis, synthetic-expert-construction-gate, synthetic-expert-behavior-gate, ralph-loop-gate, cross-room-triggers, coverage-monitor.
OPTIONS OD-2: KEEP | DEADLINE-30D | DEADLINE-90D | DEADLINE-180D | CUT-SET-LISTED ; RECOMMENDED: DEADLINE-90D

### OD-3 grill-engine

Question: do you want to keep grill-engine as it is, wire it into a real code path, or cut it?

Facts:
- 463 lines. No production require. Required by tests/test-213-part8-boundary.cjs line 51, tests/test-213-touchpoints.cjs line 40, tests/test-355-direction-readers.cjs line 149 and tests/test-205-grill-engine.cjs line 35. (PROVEN)
- The link to the egress guard is comment-only (correction C3 of 390-TABLE.md): lib/core/part8-egress-guard.cjs lines 1168 and 1241 are comments. The closed list METHODOLOGY_TECHNIQUE_WORDS has one member. (PROVEN)
- A cut removes Part 8 boundary test evidence (test-213 and test-205) unless a replacement test exists.
- The GRILL gear label in lib/core/sensors/sensor-circularity.cjs stays in every option; that file does not require grill-engine. (PROVEN)

Surfaces: CLI none. Desktop none. Cowork UNVERIFIED.

Cost of each non-KEEP option: WIRE is a later design plan with a failing test first, not part of this phase. CUT deletes the module, rewrites four tests and needs a replacement Part 8 boundary test.

Recommendation: KEEP. Reason: it holds Canon Part 8 test evidence and R9 applies.

OPTIONS OD-3: KEEP | WIRE | CUT ; RECOMMENDED: KEEP

### OD-14 the 12 other dead-set modules

Question: do you want a separate card for each of these 12 test-only modules, or keep them all under R9?

Facts:
- The 12 modules: behavioral/observation-schema (86 lines), card-fire-gate (107), futures/subsystem-render (164), graph-refine-loop (194), ignite-branch-gate (66), metrics/larryreach-loop-health (142), navigation/memory-cortex-packet (274), reader/ab-harness (177), recovery/controller (1008, the largest, 3 test files), salient-governance (315), temporal/supersession-gate (290), planning/artifact-brain-packet (212, a closure extra). Total 3035 lines. (PROVEN, wc)
- 390-SCAN.md section 4 matrix: 11 TEST-ONLY or COMMENT-ONLY rows, graph-refine-loop WIRED-IN-PROSE-ONLY (find-analogies prose at commands/find-analogies.md line 411 tells Larry to preview through it; no code loads it). HOOK, DESKTOP and MCPB are 0 for all 12.
- They are covered by R9 (385-PROOF section 10).

Surfaces: CLI none. Desktop none. Cowork UNVERIFIED.

Cost of CARD-EACH: a later pass writes up to 12 cards (one per module). No file changes.

Recommendation: KEEP. Reason: R9 already rules keep-all; a card per module adds no new fact.

OPTIONS OD-14: KEEP | CARD-EACH ; RECOMMENDED: KEEP

GROUP G1: OD-1, OD-2, OD-3, OD-14
GROUP-SHA256 G1: 6c567e55391ac50ed03b3c13b32ba4f78dd84802c11cdab3ae2089f7b31b8d1f
OWNER-ANSWER G1: RECOMMENDED

## G2 Behaviour gaps (prose says wired, code is not)

These are not cuts. The prose tells Larry something the code does not do (D-04, Canon Part 11).

### OD-4A session-register

Question: the ignite command tells Larry to call resolveSessionRegister, but no code loads that module. Do you want to wire it, or fix the prose?

Facts:
- commands/ignite.md lines 80, 166 and 198 and skills/ignite/SKILL.md lines 76, 162 and 194 say "call resolveSessionRegister(role_blend) (lib/core/session-register.cjs)" and pass composePersonaContext(roleBlend) into pickShape. (PROVEN)
- No file under lib, scripts or hooks requires the module. user-md-ops.cjs only names it in a comment. (PROVEN) Files that name resolveSessionRegister outside .planning: commands/ignite.md, skills/ignite/SKILL.md, two dist copies, docs/CANON-PHASE-MAP.md, the module and tests/test-204-session-register.cjs.
- tests/test-204-ignite-wiring-grep.cjs pins that commands/ignite.md contains the strings session-register.cjs and personaContext (lines 41 and 42). (PROVEN)
- The prose is an instruction to Larry, not a wire. The module has never run in production (SCAN row: WIRED-IN-PROSE-ONLY).
- Sequence rule: commands/ignite.md and skills/ignite/SKILL.md are also edited by Phase 389 plan 389-05 (390-SCAN.md section 6). That plan has a SUMMARY file today (re-read 2026-11-08). A later wave for this item runs only after the 389 plan editing the same file has a SUMMARY file; re-read the phase folder when the wave starts.

Surfaces: CLI affected (command prose). Desktop and Cowork read the same skill prose through the dist copies. Cowork UNVERIFIED.

Cost of each non-KEEP option: FIX-PROSE edits the command, the skill and the grep test; then build-skill-mirrors, build-dist-bundles and the three Part 11 --check gates. WIRE needs a failing test first, a real code path that calls the function (a script that ignite runs), and the grep test kept.

Recommendation: FIX-PROSE. Reason: the module never ran in production, so fixing the prose removes no behaviour that ran. WIRE adds a per-turn persona path for a feature nobody has seen work.

OPTIONS OD-4A: KEEP | WIRE | FIX-PROSE ; RECOMMENDED: FIX-PROSE

### OD-4B methodology-ingest

Question: the ingest-methodology command says its engine is lib/core/methodology-ingest.cjs and "WIRED", but no command code loads it. Do you want to wire it, or fix the prose?

Facts:
- commands/ingest-methodology.md line 25 ("ingestPlan step-5 ... It is WIRED"), line 70 ("The engine is lib/core/methodology-ingest.cjs (pure, tested)") and line 74; the skill copy at lines 22, 67 and 71. (PROVEN)
- "WIRED" there means born-wired in the Part 11 sense: the connector frontmatter registers the command (sub_mode methodology-ingest in data/connector-registry.json lines 682 and 2078). That part is true.
- What the local script really does (scripts/methodology-ingest-local.sh, 36 lines, PROVEN read): it runs four generator steps in order: refresh the framework-names snapshot, rebuild and check the command registry, the connector registry and the orchestration projection. It does not call the module. The file name appears only in its header comment, line 2.
- The module is a pure library with two tests (tests/test-methodology-ingest.cjs and tests/test-170-171-cirs-conformance.cjs). No production code requires it. (PROVEN)
- So the prose should say: the command is registered; the local step is the script; the library is tested and not loaded by this command.

Surfaces: CLI affected (maintainer command, disable-model-invocation). Desktop and Cowork UNVERIFIED.

Cost of each non-KEEP option: FIX-PROSE edits the command and the skill, runs build-skill-mirrors and build-dist-bundles, then the Part 11 gates. No test pins the "engine" sentence that I found (UNVERIFIED beyond the two tests above). WIRE needs a failing test first and a code path in the script that calls the module.

Recommendation: FIX-PROSE. Reason: the script already does the real work; the prose should describe it.

OPTIONS OD-4B: KEEP | WIRE | FIX-PROSE ; RECOMMENDED: FIX-PROSE

GROUP G2: OD-4A, OD-4B
GROUP-SHA256 G2: 2ebad5ea4fccf43f13fc9719fd3079471d3db39d618ecc1ff5832a9092a258f1
OWNER-ANSWER G2: RECOMMENDED

## G3 Skills

### OD-5 the /mos:discover group

Question: is client website, brand and UX discovery part of the MindrianOS mission? If not, the whole /mos:discover group goes; if yes, it stays.

The mission judgement is yours. Usage logs are not a reason (D-07).

Facts:
- /mos:discover (commands/discover.md) reads the client-discovery-interview skill (lines 45, 83 and 163): its SKILL.md, question-bank.md and discovery-scaffold.json. The skill is not stand-alone: removing it breaks the command. (PROVEN)
- Movement 4 reuses /mos:analyze-needs, /mos:user-needs and /mos:jtbd (lines 109 and 189). The deck bridge uses the mos-deck-engine skill (lines 178 and 192). A cut of the group does not remove those; a cut of user-needs or analyze-needs would break discover. (PROVEN)
- Data files naming client-discovery-interview: 7. Pins: tests/run-all-1434.sh (line 112 reads discovery-scaffold.json), tests/test-209-declared-implies-wired.cjs (line 395) and the unwired-declaration comment in scripts/build-render-coverage.cjs (lines 368 to 371). (PROVEN)
- Tracked files a cut removes (command, skill folders and dist copies): 13: commands/discover.md, skills/discover (1), skills/client-discovery-interview (3), dist/zed (4), dist/generic-claude-dir (4). Last commit 2026-09-14.
- Desktop rows: ui/mindrian-workspace-mod/assets/command-registry.json line 486 and ui/mos-face/hooks/commands.ts (several rows). Cowork UNVERIFIED.

Cost of CUT-GROUP: the generators (build-command-registry, build-skill-mirrors, build-dist-bundles, build-ui-shell, build-render-coverage), the Part 11 gates, a Theo re-emit at release, three test files (1434, 209, discover tests). It does not remove analyze-needs, user-needs or jtbd. RECALIBRATE means you state at planning time what to change.

Recommendation: KEEP. Reason: no evidence of harm, born-wired, tested; the mission call is yours.

OPTIONS OD-5: KEEP | RECALIBRATE | CUT-GROUP ; RECOMMENDED: KEEP

### OD-6 mullins-scaffold

Question: do you want to keep the mullins-scaffold skill, recalibrate it, or cut it?

Facts:
- Correction C2 of 390-TABLE.md: the skill is born-wired and doctrine-tested. check-render-coverage reports 0 unwired. (PROVEN, FACT-03 and FACT-04)
- Registry rows: data/connector-registry.json line 2253 (surface skill:mullins-scaffold), data/connector-coverage-ledger.json line 1444. 7 data files name it.
- tests/test-143.2-doctrine-presence.cjs names skills/mullins-scaffold/scaffold.json (line 57), the skill (line 58) and the module (line 228). tests/run-all-1432.sh is the Phase 143.2 gate. (PROVEN)
- Requirements MULL-01 (Brain-driven cross-framework folders) and MULL-02 (Ackoff up-down structure) are in .planning/phases/143.2-larry-operates-and-pushes-prompt-reconciliation/143.2-CONTEXT-ADDENDUM-conv-mull-ackoff.md.
- The module lib/core/mullins-scaffold.cjs has only its own test (lib/core/mullins-scaffold.test.cjs) and the doctrine test as code callers. commands/mullins.md (the 7-Domains command) does not point to the scaffold. (PROVEN)

Surfaces: CLI and Desktop: Larry reads the skill. Cowork UNVERIFIED.

Cost of each non-KEEP option: a cut first needs a ruling on MULL-01 and MULL-02. Then it removes the skill folder (2 files plus dist copies), the module and its test, the registry and ledger rows, and edits test-143.2 and run-all-1432. It needs the generators, the Part 11 gates and a Theo re-emit at release.

Recommendation: KEEP. Reason: born-wired, doctrine-tested, and the MULL requirements are not ruled.

OPTIONS OD-6: KEEP | RECALIBRATE | CUT ; RECOMMENDED: KEEP

GROUP G3: OD-5, OD-6
GROUP-SHA256 G3: 716adecf9d9a5a17889f7b8be2c329e9fff2aeb19bc412e2b41a2fce2da0c3e1
OWNER-ANSWER G3: KEEP-ALL

## G4 Agents

Rule D-04 and the Tri-Polar rule. No agent is offered for a cut except through the chain-step-reviewer fold (OD-7). The items OD-8A to OD-8F are the recalibration moves of the PRD (move E is part of OD-7).

### OD-7 chain-step-reviewer (also PRD move E)

Question: the chain-step-reviewer agent has working code but no chain ever asks for it. Do you want to keep it, fold it into framework-runner, or name one chain that uses it?

Facts:
- lib/core/chain-step-dispatcher.cjs builds a dispatch to this agent only for a step with reviewer.kind subagent (function at line 439, agent name at line 447). lib/core/chain-executor.cjs reads the same key (lines 659 and 668). (PROVEN)
- No declaration of that kind exists in any pipeline, data file, command or skill. The 4 pipelines/*/CHAIN.md files hold no reviewer key (git grep returned 0 files). (PROVEN)
- It is pinned by tests/test-347-reviewer-honesty.cjs, test-347-reviewer-not-worker.cjs and test-347-layer-graph-declaration.cjs (and tests/run-all-347.sh). Named in data/brain-orchestration-projection.json line 3574 and data/connector-coverage-ledger.json line 700 (born-wired). 4 production files and 4 test files name it (correction C4). (PROVEN)
- No parent command (wired but never fed).

Surfaces: CLI only, through a chain step. Desktop none. Cowork UNVERIFIED.

Cost of each non-KEEP option: FOLD-INTO-FRAMEWORK-RUNNER removes the agent file, edits the dispatcher and the test-347 trio, and runs the generators, the Part 11 gates and a Theo re-emit at release. NAME-CHAIN means you name one chain at planning time and a later plan adds the declaration with a test.

Recommendation: KEEP. Reason: it is tested, born-wired and costs nothing while idle; a fold needs a design for the independent-critic rule.

OPTIONS OD-7: KEEP | FOLD-INTO-FRAMEWORK-RUNNER | NAME-CHAIN ; RECOMMENDED: KEEP

### OD-8A a specialist table in larry-extended (PRD move A)

Question: do you want a short table in agents/larry-extended.md that names each helper agent and when Larry should use it?

Facts:
- agents/larry-extended.md and references/personality/agent-operations.md name none of the seven helper agents (analogy-query-fetcher, competitor-watch-fetcher, dominant-design-researcher, research-lane-analyst, vault-section-reviewer, meeting-perspective-extractor, chain-step-reviewer). (PROVEN, git grep count 0; FACT-08)
- Only investor, grading and opportunity-scanner carry PROACTIVELY. (PROVEN; FACT-09)
- Each helper is reached only through its parent command (find-analogies and scout, scout, dominant-designs, research, vault, file-meeting and scout). Production file counts are in correction C4.

Surfaces: CLI and Desktop: Larry reads the agent file. Cowork UNVERIFIED.

Cost of BUILD: edit the two files; run build-skill-mirrors and build-dist-bundles; add a test that the table lists every helper agent that agents/*.md defines; run the Part 11 gates. It is a documentation edit and adds no hook and no reach.

Recommendation: BUILD. Reason: a safe doc edit that makes the helpers discoverable.

OPTIONS OD-8A: KEEP | BUILD ; RECOMMENDED: BUILD

### OD-8B tie each trigger to a sensor signal (PRD move B)

Question: do you want each helper trigger tied to a sensor signal, so Larry fires helpers on a signal?

Facts: it depends on OD-8A. It adds work on every turn, which touches the Phase 384 speed budget. The project rule allows one reach path only: dispatchSensors then decide(), and no second selection brain (CLAUDE.md, Connector Spine). (PROVEN, read)

Surfaces: CLI hooks and sensors. Desktop and Cowork UNVERIFIED.

Cost of BUILD: a new sensor mapping inside the existing path, a failing test, a speed check. No new hook is allowed.

Recommendation: KEEP. Reason: do OD-8A first and see whether Larry uses the table.

OPTIONS OD-8B: KEEP | BUILD ; RECOMMENDED: KEEP

### OD-8C a card before any external fetch (PRD move C)

Question: do you want a decision card before a helper agent fetches from the outside, with a generic query only?

Facts: it adds reach, so it must pass lib/core/part8-egress-guard.cjs and the Part 3 gate (CLAUDE.md, Canon Parts 3 and 8). The fetcher agents are competitor-watch-fetcher and analogy-query-fetcher (parents: scout, find-analogies). No such card exists today. (PROVEN, read)

Surfaces: CLI, Desktop and Cowork all fetch through the host. Cowork UNVERIFIED.

Cost of BUILD: edit two or more commands, a Part 3 card, an egress-guard test, generators and the Part 11 gates.

Recommendation: KEEP. Reason: new reach needs its own design and a Part 8 proof.

OPTIONS OD-8C: KEEP | BUILD ; RECOMMENDED: KEEP

### OD-8D ask Theo to name a lead agent (PRD move D)

Question: do you want Larry to ask Theo for a lead agent beside the framework?

Facts: it adds a Theo exposure. PRD Step 0 applies (read-only in effect, generic handles only, egress guard), and D-13 puts exposure changes out of this phase unless you add one. (PROVEN, read of the PRD and CONTEXT)

Surfaces: CLI and Desktop through the guarded mindrian-brain shim. Cowork UNVERIFIED.

Cost of BUILD: a Theo-side change, a shim exposure, Step 0 proof, egress-guard test, generators.

Recommendation: KEEP. Reason: D-13 keeps exposure changes out of this phase.

OPTIONS OD-8D: KEEP | BUILD ; RECOMMENDED: KEEP

### OD-8F count agent launches for one month (PRD move F)

Question: do you want a counter that records agent launches for one month, to get real usage evidence?

Facts: no counter exists. A counter needs a hook, and no hook may be added without your word. The session logs the PRD used come from one machine and Claude Code only (D-07). (PROVEN, read)

Surfaces: CLI hook only. Desktop and Cowork UNVERIFIED.

Cost of BUILD: a new hook entry (hook budget), a counter file with a privacy review (names and counts only), a test.

Recommendation: KEEP. Reason: no hook without your word.

OPTIONS OD-8F: KEEP | BUILD ; RECOMMENDED: KEEP

GROUP G4: OD-7, OD-8A, OD-8B, OD-8C, OD-8D, OD-8F
GROUP-SHA256 G4: 86c496efab44fc5f2c968064683e1240c56a53e8d8e02676b8531b193d5e49f9
OWNER-ANSWER G4: RECOMMENDED

## G5 Command groups

Open questions that apply to every command cut in this group (A3 of 390-RESEARCH.md): (1) Theo stores command handles (tools commands_for_problem_type and recommend_chain return them), so a removed command can leave Theo advising a missing command. UNVERIFIED how Theo stores them. A Theo-side check through your Theo session is needed before any command-group plan. (2) The golden for the tools list is regenerated by SPEED384_WRITE_GOLDEN=1 node tests/test-384-s7-mcp-start.cjs parity, only for a router enum edit, under the 384 lock.

### OD-9 the trend and futures set

Question: six commands overlap in subject (macro-trends, explore-trends, explore-futures, scenario-plan, futures, trending-to-absurd). Do you want a merge design, or keep them all?

Facts:
- explore-trends alone sits in 15 tracked data files, 9 test files and 4 ui files (PROVEN, git grep -l). Other names: lib/hmi/jtbd-taxonomy.json, lib/mcp/brain-router.cjs, lib/mcp/prompts.cjs, lib/mcp/tool-router.cjs, lib/mos-face/dist, templates/room-skeleton/section-contracts/market-analysis.md, data/harness-fixtures (two md files), tests/fixtures (wire snapshots, registry drift baseline).
- Four of the six names (macro-trends, explore-trends, explore-futures, scenario-plan) are in ANALYSIS_COMMANDS in lib/mcp/tool-router.cjs lines 362 to 367; the enum is used at line 1593. It feeds the tools/list golden tests/fixtures/384-s7-tools-list-golden.json and the baseline in tests/test-270-tool-schema-budget.cjs. futures and trending-to-absurd are not in the list. (PROVEN)
- The commands do call each other: commands/futures.md lines 75 to 77 hand off to explore-futures, scenario-plan and explore-trends. (PROVEN) The audit said scenario-plan feeds value-proposition. I did not find that: commands/scenario-plan.md never names value-proposition; commands/value-proposition.md line 115 offers scenario-plan as a fallback. (PROVEN, corrected)
- Last commits 2026-09-14, trending-to-absurd 2026-11-05.

Surfaces: CLI, Desktop registry and MCP router names all carry the six. Cowork UNVERIFIED.

Cost of MERGE-DESIGN: a later plan writes a merge design and deletes nothing. A real merge later costs 15 or more data files per name, the router enum, the golden and test-270 baseline, the room-skeleton templates, the Desktop registry, generators, Part 11 gates and a Theo re-emit.

Recommendation: KEEP. Reason: heavy cost, chain links exist and the room templates name them; there is no evidence of harm.

OPTIONS OD-9: KEEP | MERGE-DESIGN ; RECOMMENDED: KEEP

### OD-10 the rs-* set

Question: do you want a design that folds the four rs-* commands into /mos:eureka as sub-modes, or keep them? A cut is not offered (D-02).

Facts:
- rs-experts and rs-thesis are the CLI form of the MCP tools rs_experts_find (lib/mcp/tools/rs-experts-find.cjs line 76) and rs_thesis_read (rs-thesis-read.cjs line 104). commands/eureka.md lines 306 and 312 define them. (PROVEN)
- tests/test-387-eureka-installed-layout.cjs line 128 pins other_serving including both tools; tests/test-270-tool-schema-budget.cjs lines 474 to 481 count them in the 75-tool budget. (PROVEN)
- Scripts: scripts/rs-experts-command.cjs, rs-explain-command.cjs, rs-fetch-command.cjs, rs-thesis-command.cjs. Recent commits 2026-10-24 to 2026-11-05: active work.

Surfaces: CLI and MCP (Desktop) both. Cowork UNVERIFIED.

Cost of FOLD-DESIGN: a later design plan with Phase 387 owner input; it changes no file. A real fold later touches the MCP tool budget and the Eureka install-layout test.

Recommendation: KEEP. Reason: D-02 and recent active work.

OPTIONS OD-10: KEEP | FOLD-DESIGN ; RECOMMENDED: KEEP

### OD-11 visualize

Question: /mos:visualize is a deprecated alias for /mos:dashboard --mermaid, and its removal date has passed. Do you want it removed?

Desktop check (PROVEN, 2026-11-08): git grep -n -w visualize -- ui lib/mos-face lib/mcp -> 15 hits in 5 files; 6 name the bare word (lib/mcp/tool-router.cjs lines 222 and 575, lib/mos-face/dist/commands.js line 520, ui/mindrian-workspace-mod/assets/command-registry.json lines 2232 and 2247, ui/mos-face/hooks/commands.ts line 532) and 9 name the live visualize-room, visualize-graph and visualize-chain sub-commands (tool-router.cjs 8, ui/shared/src/generated/mcp-adapter.ts 1) -> CLEAN

How I read that result: the ui and lib/mos-face hits are the deprecated entry itself or a generated copy, each labelled "Deprecated alias", so no source under ui/ or lib/mos-face/ offers visualize as a live command. The router hit at line 575 is one name in ALL_TOOL_COMMANDS (the parity pin array of test-205-surface-fence); line 222 is a comment. The nine sub-command hits are a different, live surface and stay in every option. Desktop run-time behaviour was not observed (UNVERIFIED).

Facts:
- commands/visualize.md frontmatter has deprecated true, deprecated_redirect "dashboard --mermaid", deprecated_removal "v1.14.0" (line 16) and connector.excluded true. The repo version is 2.0.0-beta.82 (node lib/core/repo-version.cjs), so the removal date is long past. Last commit 2026-09-14. It runs through scripts/soft-alias-runner.cjs. (PROVEN)
- Other callers: data/help-groups.json line 228; skills/visualize/SKILL.md; dist copies (2). Tests: tests/run-all-173.sh, run-all-175.sh, run-all-347.sh, test-209-declared-implies-wired.cjs (lines 167 and 177), test-publish-needs-flow.cjs (header comment), test-347-visualize-real-chain.cjs, and the fixtures shape-violations-baseline.txt, 341-registry-drift-baseline.json and 384-s7-tools-list-golden.json. Hooks: none. (PROVEN)
- present is live and not on this card (correction C1).
- Sequence rule: data/help-groups.json is also edited by Phase 389 plans (the planner saw 389-08, 389-09 and 389-11; re-derived from 390-SCAN.md section 6, plus the shared generated registries in 389-06). A later wave for this item runs only after the 389 plans editing the same files have a SUMMARY file; none of those four has one at 05:35 UTC today.

Surfaces: CLI affected. Desktop: registry entry and label only. Cowork UNVERIFIED.

Cost of CUT-VISUALIZE: delete commands/visualize.md and skills/visualize and the dist copies; edit help-groups and the soft-alias runner list; edit the router name list (tool-router.cjs line 575) and the 66-member pin in test-205-surface-fence; edit test-209 and the other tests above; regenerate the registries, ui command registry and fixtures; run the 384-s7 parity test, test-270 and test-387 under the 384 lock (UNVERIFIED whether the golden moves, because the bare name is not an enum entry and the visualize-* names stay); Part 11 gates; Theo re-emit at release. Open questions A3 and the golden regeneration command apply (see the top of G5).

Recommendation: CUT-VISUALIZE (the Desktop check is CLEAN). Reason: the alias is deprecated, past its own date, already excluded from Part 11 and redirects to a live command.

OPTIONS OD-11: KEEP | CUT-VISUALIZE ; RECOMMENDED: CUT-VISUALIZE

### OD-12 user-needs and analyze-needs

Question: the two commands have close descriptions. Do you want one to become an alias of the other, or keep both?

Side-by-side (PROVEN, both files read in full):

| Point | /mos:user-needs (78 lines) | /mos:analyze-needs (79 lines) |
|-------|----------------------------|-------------------------------|
| Method | Understanding User Needs: map a real process, rate each step by importance and satisfaction | Jobs To Be Done: customer, job statement, progress over features |
| Reference file | references/methodology/user-needs.md (199 lines) | references/methodology/analyze-needs.md (135 lines) |
| Inputs | none declared | a customer segment defined |
| Output section written | room/market-analysis/user-needs/ | room/market-analysis/jtbd-analysis/ |
| Sensors and posture | SENS-06, hold, rank 43, sub_mode user-needs-jtbd | SENS-05 and SENS-06, push_forward, rank 15, sub_mode needs-jtbd |
| HITL shape | F.8 | F.8 |
| Pipeline callers | none | pipelines/discovery/02-think-hats.md line 6 (output_to) and 03-analyze-needs.md |
| Used by /mos:discover | yes (movement 4) | yes (movement 4) |

Result: the inputs, outputs and written sections differ, and the methods differ. Only the shape and the topic are close. This does not meet the test for a redirect.

Surfaces: CLI and Desktop registry rows for both. Cowork UNVERIFIED.

Cost of REDIRECT: user-needs becomes a soft alias of analyze-needs; both names sit in METHODOLOGY_COMMANDS (tool-router.cjs lines 352 to 356, enum at line 1540), so removing the user-needs entry is an enum edit and moves the tools-list golden and the test-270 baseline; the generators, Part 11 gates, the discover command edit, a Theo re-emit and a loss of the process-mapping method. MERGE costs more.

Recommendation: KEEP. Reason: my side-by-side read shows different methods and different room sections.

OPTIONS OD-12: KEEP | REDIRECT | MERGE ; RECOMMENDED: KEEP

### OD-15 lean-canvas and value-proposition

Question: do you want to recalibrate or cut lean-canvas and value-proposition, or keep them? (user-needs is in OD-12.)

Facts (PROVEN, git grep -l with word match):
- lean-canvas: 17 data files, 25 test files, 4 ui files. value-proposition: 11 data files, 5 test files, 1 ui file. Last commit 2026-09-14.
- Other callers of lean-canvas: lib/core/rs-chain-feeder.cjs line 98 (spawn /mos:lean-canvas), commands analyze-needs, discover, export, user-needs, validate and value-proposition, lib/mcp/tool-router.cjs line 353 (METHODOLOGY_COMMANDS, an enum at line 1540), lib/hmi/jtbd-taxonomy.json and the Desktop command registry. value-proposition is named in commands/value-proposition.md only among commands and pipelines, plus lib/hmi/jtbd-taxonomy.json and the Desktop registry.
- No pipeline names either command. No evidence supports a cut.

Surfaces: CLI, Desktop registry and the MCP methodology list (lean-canvas). Cowork UNVERIFIED.

Cost of CUT-BOTH: command and skill files and dist copies, 17 and 11 data files, 25 and 5 test files, the router METHODOLOGY_COMMANDS entry for lean-canvas (an enum edit, so the golden and test-270 move), rs-chain-feeder, the Desktop registry, generators, Part 11 gates and a Theo re-emit. RECALIBRATE means you state at planning time what to change.

Recommendation: KEEP. Reason: wide callers and no evidence of harm.

OPTIONS OD-15: KEEP | RECALIBRATE | CUT-BOTH ; RECOMMENDED: KEEP

GROUP G5: OD-9, OD-10, OD-11, OD-12, OD-15
GROUP-SHA256 G5: 459bd19f459cb3ebef87881f2b5353b513e9dcda05e9694e69b1a06505655425
OWNER-ANSWER G5: RECOMMENDED

## G6 Pinecone files

Rule D-03: steps 2 and 3 of 385-PROOF section 14 need their own proof and your separate word. lib/core/rs-pinecone-bridge.cjs stays. Your statement of 2026-11-06 "we are not using pinecone in the mos build" overrode the old rule for the dead inference module only (step 1, done in 385-15). It does not approve steps 2 and 3 by itself.

### OD-13 the four Pinecone files

Question: do you want a separate proof and a separate card for each of the four Pinecone files, or leave them as they are?

Facts (PROVEN unless tagged):
- scripts/export-pinecone-embeddings.cjs (516 lines, last commit 2026-05-20): no code importer. Named in scripts/load-embeddings-into-neo4j.cjs line 7 (comment) and two fixtures under tests/fixtures/127.1.
- scripts/consolidate-pinecone.py (268 lines, last commit 2026-11-06): pinned by tests/test-quick-261106-no-pinecone-key-literal.cjs (line 4 and line 41; the script must exit 2 with a clear message when the key is missing). A delete means changing that test.
- embedArtifact stub in lib/core/lazygraph-ops.cjs: defined at line 1019 (contract comment from line 1009), exported at line 1494, asserted by tests/test-sqlite-ops.cjs line 215 and the export list at line 383. No production caller.
- mcp-server-brain/lib/pinecone-tools.cjs (90 lines, last commit 2026-05-23): not in the PRD list. It is not dead: mcp-server-brain/server.cjs line 8 requires it and registers the tools (registerPineconeTools). Named by mcp-server-brain/CLAUDE.md (brain_search, brain_stats). This corrects the research, which said only the CLAUDE.md names it.
- rs-pinecone-bridge.cjs is not on this card (6 production requires, correction C5).

Surfaces: CLI scripts and the Brain MCP server (MCPB). Desktop none. Cowork UNVERIFIED.

Cost of PROVE-FIRST: a later plan writes one proof per file and one card per file. It deletes nothing. A later cut of any file costs the pinned tests above and, for pinecone-tools.cjs, the server registration.

Recommendation: PROVE-FIRST. Reason: you said Pinecone is not used in the build, but each file has a pin or a live require, and D-03 asks for proof before a delete.

OPTIONS OD-13: KEEP | PROVE-FIRST ; RECOMMENDED: PROVE-FIRST

GROUP G6: OD-13
GROUP-SHA256 G6: a737e16035be71691231db3ba5c89e808732e4c55e11ad20f2b254051e46b23d
OWNER-ANSWER G6: RECOMMENDED

## What happens after your answer

- A group answered KEEP-ALL gets no later plan. Nothing changes.
- A group answered RECOMMENDED or CUSTOM gets a plan set of its own, planned after your answer. These plans are not written yet.
- Each later plan follows the flow of one approved cut: re-run the caller proof, write a failing removal test, make the change, run the generators, run the three Part 11 --check gates, run the heavy trio (tools-list golden, test-270 budget, test-387) for a router enum edit, then one git commit --only on exact paths.
- Each later plan starts with the gate command for its item (gate-item in 390-gate.cjs) and stops on exit 1 (blocked) or exit 2 (you said keep).
- A later wave that edits a file also edited by a Phase 389 plan runs only after that 389 plan has a SUMMARY file (OD-4A and OD-11).
- Nothing is pushed, tagged or released by these plans. A removal reaches users only after a release is cut and picked up.

## How the answer is recorded

The main session writes your token into the answer line of each group and commits that one edit with git commit --only on this one path. The options and the hash on the group lines are sealed: if an option line changes after your answer, the gate refuses the answer and asks again.
