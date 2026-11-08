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

HEAD-AT-DECISION: 0000000000000000000000000000000000000000

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
GROUP-SHA256 G1: 0000000000000000000000000000000000000000000000000000000000000000
OWNER-ANSWER G1: PENDING

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
GROUP-SHA256 G2: 0000000000000000000000000000000000000000000000000000000000000000
OWNER-ANSWER G2: PENDING

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
GROUP-SHA256 G3: 0000000000000000000000000000000000000000000000000000000000000000
OWNER-ANSWER G3: PENDING

<!-- gsd:write-continue -->
