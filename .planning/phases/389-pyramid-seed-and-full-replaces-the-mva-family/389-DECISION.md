# Phase 389 decision card: replace the MVA family with the Pyramid Seed

## 1. Summary

- This card asks the owner 11 questions (D1 to D11). Each answer is one token. The card holds no answer yet: all 11 lines say PENDING.
- Recommended tokens: APPROVE on all 11 (D1 command-only entry, D2 first-install on the Seed, D3 to D6 retire the old surfaces, D7 rename mva-report, D8 soft alias for one release, D9 rename the surviving modules, D10 share opt-in and default off, D11 autonomous_safe stays true behind a card and a code refusal).
- A recommendation is not an answer. Only a token in the answer block at the end of the card is an answer.
- If nothing is answered, plans 06 to 13 each stop at their first task and change nothing. Plans 03, 04 and 05 add new code and change nothing that exists today.
- The checker is 389-decision.cjs. Plans 06 to 13 run its gate command first and act only on APPROVED (or on the alternative step their own text names: DROP for D10, FLAG-FALSE for D11).
- Numbers below come from 389-CALLERS.tsv (304 rows at plan 01, HEAD fb6266d83 at the time of this card) and 389-CALLERS.md answers (a) to (j).

<!-- items:start -->
## 2. The 11 items

### D1 ENTRY - how does a venture sentence reach the Seed?

Question: should a venture sentence reach the Seed by command only (plus Larry's offer in conversation), or should the UserPromptSubmit hook scripts/mva-detect.cjs keep classifying every message?

Evidence (live):
- The hook row is hooks/hooks.json line 354, timeout 3 seconds. It is the only hook row for mva-detect. It starts one Node process on every user message.
- Plan 07 would touch 16 files for 18 hits (class: test 11, data 4, comment 2, path-string 1). They are: hooks/hooks.json, data/arbitration-rule-catalogue.json (lines 147 to 157), data/hooks-markers.json (line 23), tests/fixtures/369/hook-cold-start-baseline.json (line 692), scripts/mva-detect.cjs, scripts/first-install-router.cjs (the D2 part), lib/core/mva-detect.smoke.test.cjs, 7 test files under tests/, tests/run-all-118.sh and lib/memory/run-feynman-tests.cjs.
- LIVE-NON-FAMILY callers of mva-detect: only lib/memory/run-feynman-tests.cjs, line 1493 (a list of test paths). No other file requires or spawns it.
- Answer (i) of 389-CALLERS.md, PROVEN: today no code offers a venture sentence to a user with no room, except this hook. lib/core/venture-shape-nudge.cjs needs room.db (it returns no_room_db) and waits for 3 turns. Its only runtime caller, scripts/room-auto-create-nudge.cjs, is not named in hooks/hooks.json or scripts/session-start.
- The Mode 1 sentence in scripts/session-start (line 811) offers /mos:new-project when the user states a goal. It does not offer the Seed yet. Plan 07 adds one clause to that existing text.

Options:
- APPROVE: command-only entry. The hook row leaves hooks/hooks.json after D2 is done, together with its row in data/arbitration-rule-catalogue.json and in data/hooks-markers.json. Larry offers the Seed once through existing prompt text (the Mode 1 sentence in scripts/session-start and the first-install route). No new hook. Effect: one Node process less on every message (the cost class of Phase 384).
- KEEP-HOOK: the hook, its state file ~/.mindrian/mva/<session-id>.json and the pending record stay. Nothing changes for this item.

Honest limit to read before you answer: with APPROVE, the offer in conversation depends on Larry's judgment. There is no per-turn code that spots a venture sentence any more.

Recommended: APPROVE.
Reason: a hook that runs on every message costs speed, and the Seed has a command, so the person who wants it can ask for it and Larry can offer it.
Undo: git revert of the plan 07 commits restores the hook row and its files. Nothing is lost on disk: state files in ~/.mindrian/mva stay where they are.
Consumed by: plan 07 (APPROVE needs D2 APPROVE; coupling rule in section 3).

### D2 FIRST-INSTALL - how does the first-install reward survive?

Question: how does the first-install reward work after the old brief is gone?

Evidence (live):
- Today scripts/first-install-router.cjs reads the hook's pending record (_fireReward starts at line 446; it requires mva-state at lines 454 and 578, calls readPending at line 455, and spawns the hidden background process scripts/mva-run.cjs at line 480). The old brief is delivered one turn later.
- Answer (e) of 389-CALLERS.md, PROVEN: the router classifies for its own routing with lib/core/greeting-intent-detector.cjs (line 335), not with the MVA classifier. It gets the venture verdict only from the hook's pending record. Without the hook the reward path ends in the skip reason no_pending (SKIP_REASONS at line 444: no_pending, hebrew_refusal, already_running, pending_sentence_mismatch).
- Fact the owner should see: the old brief ignores the idea. It sends fixed Brain queries ("ventures comparable to early-stage consumer SaaS", "cross-domain analogy frameworks"), one fixed Tavily query, and a deck that prints only an 8-character hash marker (389-RESEARCH.md, finding 1, files data/mva-agent-prompts.json, lib/agents/mva/*.cjs, lib/core/mva-deck-builder.cjs). The reward the first-time user gets today is the same for every idea.
- Data record: data/first-reward-surfaces.json holds the text of session-start:FIRST_INSTALL (it names the MVA classifier and the detached pipeline). Plan 07 updates that text; the reward type stays instant_brief.
- Plan 07 touches the router together with D1 (see D1 for the file list). The router is a LIVE-NON-FAMILY caller of mva-state (2 requires) and of mva-run (1 spawn); no other file outside the family requires or spawns them.

Options:
- APPROVE: the router calls the sync heuristic of lib/core/mva-classifier.cjs (the function classify, no network, no Haiku call) on the first answer, stores a yes or no flag and no text, and on yes injects one instruction for Larry: write the draft pyramid now (Situation, Complication, Question, Answer, one page, no outside lookup, no tool call), then offer the evidence step in one line. No child process, no pending read, no sentence stored. On no it records the honest skip not_venture_shaped.
- KEEP-DETACHED: the router keeps the old path (pending record, detached mva-run.cjs). This needs D1 KEEP-HOOK and D6 NO, because the old path needs the hook and the old core.

Recommended: APPROVE.
Reason: the new reward writes a pyramid from the person's own sentence at once, with no hidden process, instead of a brief that is the same for everyone and arrives a turn late.
Undo: git revert of the plan 07 commits restores the router and the first-reward text.
Consumed by: plan 07.

### D3 PIPELINE-SKILL - retire skills/mva-pipeline?

Question: skills/mva-pipeline auto-activates from the hook's state file. Remove it?

Evidence (live):
- 19 hits for the token mva-pipeline, all fate plan 08. LIVE-NON-FAMILY callers: none (no file outside the family requires, spawns or reads it by path).
- Plan 08 (D3 and D4 together) touches 48 files. The largest groups are data 13, tests 5, commands 4, lib/core 2 and lib/conversation 2; the rest are single files such as skills/vault, skills/new-project, skills/mva-pipeline, skills/mva-option, tests/fixtures, ui/mos-face/hooks and ui/mindrian-workspace-mod/assets. The skill's out-of-spine allowlist row, its connector and coverage rows and its dist copies are in that list.
- With D1 APPROVE the trigger of this skill (the state file the hook wrote) is gone.

Options:
- APPROVE: remove the skill, its out-of-spine allowlist row, its connector and coverage rows and its dist copies. The born-wired registries are regenerated through their generators.
- NO: keep the skill. Nothing changes for this item.

Recommended: APPROVE (with D1 APPROVE its trigger is gone).
Reason: a skill that waits for a file that nobody writes any more can never start.
Undo: git revert of the plan 08 commits.
Consumed by: plan 08.

### D4 OPTION-ROUTER - retire /mos:mva-option, its skill and the router?

Question: /mos:mva-option, skills/mva-option and lib/core/mva-option-router.cjs route the 3-option footer pick. Remove them?

Evidence (live):
- 31 hits for mva-option and 20 hits for mva-option-router, all fate plan 08 (same plan 08 total of 48 files as D3).
- LIVE-NON-FAMILY callers of the router: only lib/memory/run-feynman-tests.cjs line 1510 (test list).
- Doc-class hits that plan 08 must edit: commands/ignite.md (lines 60 and 92), commands/new-project.md (lines 55 to 64), their skill mirrors, and commands/vault.md line 17 with skills/vault/SKILL.md line 19.
- The Decide gate now lives in /mos:structure-argument. The hand-off to /mos:ignite and /mos:new-project reads the Seed record through lib/core/pyramid-seed-record.cjs (plan 05, SHA8 check kept, old side file still read).
- Plan 01 fixed the stale "option 2 is a stub" text and the 5 stale router asserts (router test 18 of 18).

Options:
- APPROVE: remove the command, the skill, the router and their tests; add a deprecation entry for /mos:mva-option with replaced_by /mos:structure-argument.
- NO: keep them. Nothing changes for this item.

Recommended: APPROVE.
Reason: the pick it routes is a footer of the old brief, and the new Decide step already does this job.
Undo: git revert of the plan 08 commits restores the files and the registry rows.
Consumed by: plan 08.

### D5 BRIEF - retire /mos:mva-brief?

Question: /mos:mva-brief and skills/mva-brief run the old brief. Replace them by the Seed depth of /mos:structure-argument?

Evidence (live):
- 33 hits for mva-brief, fate plan 09 (27 files: data 19 hits, doc 9, test 4, path-string 1). The files include commands/mva-brief.md, skills/mva-brief/SKILL.md, 15 files under data/ (registries, ledgers and one fixture), the dist copies, the Desktop face files (lib/mos-face/dist/commands.js, ui/mos-face/hooks/commands.ts, ui/mindrian-workspace-mod/assets/command-registry.json) and scripts/room-naming-selector.cjs.
- LIVE-NON-FAMILY caller: scripts/room-naming-selector.cjs line 74 (path-string). It reads the file <room>/.mindrian/mva-brief.json. Answer (f) of 389-CALLERS.md: no writer of mva-brief.json exists in the tracked tree, so the sentence it reads is empty unless an older release wrote the file (UNVERIFIED for older releases).
- Answer (g), PROVEN: the sensor SENS-01 keeps 10 consumers after mva-brief leaves (data/connector-registry.json line 4187 holds 11 commands). No consumer is lost.

Options:
- APPROVE: /mos:mva-brief is replaced by the Seed depth of /mos:structure-argument. When D8 is APPROVE the command becomes a soft-alias stub for one release; otherwise it is removed with a deprecation entry.
- NO: keep the command and the skill. Nothing changes for this item.

Recommended: APPROVE.
Reason: the Seed gives the person a pyramid from their own sentence; the old brief gives everyone the same answer.
Undo: git revert of the plan 09 commits.
Consumed by: plan 09.

### D6 CORE - retire the old pipeline core?

Question: remove the old pipeline core: lib/core/mva-orchestrator, mva-state, mva-progressive-renderer and mva-telemetry; scripts/mva-run.cjs; lib/agents/mva/*; data/mva-agent-prompts.json; their tests and their rows in tests/run-all-118.sh and lib/memory/run-feynman-tests.cjs?

Evidence (live):
- Plan 10 would touch 47 files for 78 hits (class: test 30, comment 24, doc 7, require 7, path-string 5, data 4, spawn 1). By folder: tests 13, lib/core 12, lib/agents/mva 7, scripts 4, lib/core/telemetry 3, data 3, lib/core/recovery 2, and one each in lib/memory, lib/core/semantic-index and lib/core/doctor.
- LIVE-NON-FAMILY callers: scripts/first-install-router.cjs lines 454 and 578 (require of mva-state), line 480 (spawn of mva-run), and the test list in lib/memory/run-feynman-tests.cjs (lines 1501 to 1503). Answer (d) of 389-CALLERS.md DISPROVES the PRD claim that only the orchestrator requires mva-state: the router requires it too. This is why D6 APPROVE needs D2 APPROVE (after D2 the router has no require and no spawn).
- The 12 red-hat and black-hat questions of lib/agents/mva/six-hats-red-black.cjs are copied as text into the Seed reference by plan 06 before the old cell is deleted.

Effect on the room naming suggestion (read this): removing the old core removes the only trigger of scripts/room-naming-selector.cjs. The orchestrator block phase-119-01-naming-selector-hook (lib/core/mva-orchestrator.cjs lines 306 to 322) is the only caller that spawns that script, after the first brief. The script, its library (lib/core/room-naming-selector.cjs) and its test stay on disk, unreachable, and go to the Phase 390 table. The script also reads <room>/.mindrian/mva-brief.json, and no code writes that file (answer (f)), so the suggestion was already working from an empty sentence in the tracked tree.

Telemetry rule: the six mva_* event names leave lib/core/telemetry/schema.cjs (lines 79 to 85) and docs/TELEMETRY-SCHEMA.md only if plan 09 proves that an old ~/.mindrian/telemetry/v1.13/mva.jsonl line still parses after the change. Answer (j): the schema is mirrored by lib/core/telemetry/schema.test.cjs (lines 42 to 47, 60) and tests/test-121-01-scaffold.sh gate 3; the reader in lib/core/mva-option-router.cjs (lines 276 to 291) skips an unknown old line without an error. If the proof fails, the names stay frozen and are listed for Phase 390.

Options:
- APPROVE: remove the core as listed. Needs D1 APPROVE and D2 APPROVE.
- NO: keep the core. Nothing changes for this item.

Recommended: APPROVE.
Reason: once the hook and the router no longer feed it, nothing can start the old core, so it is weight with no job.
Undo: git revert of the plan 10 commits. The room naming suggestion does not come back unless something else spawns it.
Consumed by: plan 10.

### D7 SESSION-REPORT - rename /mos:mva-report?

Question: /mos:mva-report is a conversation receipt and has nothing to do with the pipeline. Rename it to /mos:session-report?

Evidence (live):
- 21 hits for mva-report, fate plan 11, in 21 files (data 15, doc 4, test 2). They are commands/mva-report.md, skills/mva-report/SKILL.md, 10 registry and ledger files under data/, the dist copies, scripts/migrate-skill-frontmatter.cjs, tests/fixtures/341-registry-drift-baseline.json, tests/test-192-menu-sweep-live-selectors.cjs and the Desktop face files.
- LIVE-NON-FAMILY callers: none.

Options:
- APPROVE: rename to /mos:session-report with the same report structure, the same connector exclusion and the same hitl_shape none. Tester documents that name it are updated. The old name follows D8.
- NO: keep the name. Nothing changes for this item.

Recommended: APPROVE.
Reason: the name says "venture pipeline" but the command only writes a receipt of the talk, so the name misleads.
Undo: git revert of the plan 11 commits.
Consumed by: plan 11.

### D8 ALIAS - how long do the old command names keep working?

Question: what happens when a person or a tester note types /mos:mva-brief, /mos:mva-report or /mos:mva-option after the change?

Evidence (live): plan 09 (33 hits, 27 files) and plan 11 (21 hits, 21 files) own the two command names. The pattern is scripts/soft-alias-runner.cjs, as in commands/heal.md. /mos:mva-option has no alias in this design because D4 retires it with a deprecation entry only.

Options:
- APPROVE: /mos:mva-brief and /mos:mva-report each keep a soft-alias stub for one release; /mos:mva-option gets a deprecation entry only.
- NO-ALIAS: hard cut, with a deprecation entry in data/command-deprecations.json for each retired name.

Recommended: APPROVE.
Reason: a tester who types the old name gets a short pointer to the new name instead of a dead end.
Undo: git revert of the plan 09 and plan 11 commits; the alias stub is also removed by the next release by design.
Consumed by: plans 09 and 11.

### D9 SURVIVORS - rename the modules that other code needs?

Question: rename the family modules that other code needs (names only, behavior byte equal)?

Evidence (live):
- Plan 13 would touch 40 files for 62 hits (class: test 28, comment 17, require 10, path-string 6, data 1). By folder: tests 14, lib/core 14, scripts 5, scripts/hooks 2, and one each in lib/workflow, lib/wiki, lib/memory, lib/core/semantic-index and data.
- Renames: lib/core/mva-classifier.cjs to venture-sentence-classifier.cjs (23 hits); lib/core/mva-rule-linter.cjs to reward-rule-linter.cjs (15 hits); mva-dispatcher.cjs, mva-budget.cjs and mva-agent-contract.cjs to pyramid-seed-dispatcher.cjs, pyramid-seed-budget.cjs and pyramid-seed-agent-contract.cjs (11, 6 and 7 hits). Their tests move with them.
- LIVE-NON-FAMILY callers of mva-classifier: lib/core/semantic-index/entity-classifier.cjs:53, lib/wiki/briefing.cjs:29, lib/workflow/selector-decisions.cjs:55, scripts/entity-extract.cjs:128, scripts/spike-366-prepare.cjs:133 (a require inside a generated string), lib/memory/run-feynman-tests.cjs:1492. These must be moved or renamed, never deleted.
- LIVE-NON-FAMILY callers of mva-rule-linter: scripts/check-reward-before-investment.cjs:71, scripts/verify-release:414 (it reads the output text "mva-rule-linter: scanning"; the rename must keep that prefix or edit the line in the same commit), lib/memory/run-feynman-tests.cjs:1512. The release gates scripts/hooks/pre-commit and scripts/verify-release call the new linter name.
- The mva_* telemetry event names are not renamed here.

Options:
- APPROVE: rename as listed.
- NO: keep the old names. The modules stay (they are still used) and the names keep the letters MVA. Nothing changes for this item.

Recommended: APPROVE.
Reason: other code needs these modules, so they stay, and a name that says what the module does is easier to find.
Undo: git revert of the plan 13 commits.
Consumed by: plan 13.

### D10 SHARE - the deck and the Vercel deploy

Question: what happens to the share step (lib/core/mva-deck-builder.cjs, mva-vercel-deploy.cjs, resolve-vercel-key.cjs)?

Privacy fact: today the deck holds a hash marker only (8 characters of the sentence hash). A page built from a Seed record holds the person's venture text. So the old default (on when a Vercel token exists) must not carry over.

Evidence (live): plan 12 would touch 9 files for 22 hits (class: test 11, comment 5, path-string 3, require 3): the three modules, their three tests, lib/memory/run-feynman-tests.cjs, tests/run-all-118.sh and tests/test-mva-dror-harness.cjs. LIVE-NON-FAMILY callers: only the test list in lib/memory/run-feynman-tests.cjs. resolve-vercel-key is required by mva-vercel-deploy only. Secrets: VERCEL_TOKEN.

Options:
- APPROVE: keep the share step as an optional last step, opt-in, default off. A card shows the exact page text and names Vercel before anything is sent. The page is built from the Seed record by a new entry in a new script. Nothing is sent without a confirmation bound to the hash of that page text.
- DROP: remove lib/core/mva-deck-builder.cjs, mva-vercel-deploy.cjs, resolve-vercel-key.cjs and their tests. Needs D6 APPROVE.
- NO: no change in this phase. The modules stay, unreachable, and go to the Phase 390 table.

Recommended: APPROVE.
Reason: sharing is useful, but only if the person sees what leaves the machine and says yes first.
Undo: git revert of the plan 12 commits. A page that was already sent to Vercel cannot be taken back by git.
Consumed by: plan 12 (the DROP step is written in its own text).

### D11 POSTURE - autonomous_safe on /mos:structure-argument

Question: structure-argument declares autonomous_safe: true (commands/structure-argument.md line 24, skills/structure-argument/SKILL.md line 25), which lets a chain run it without a gate. The Seed fetches outside evidence. Keep the flag true?

Evidence (live), answer (h) of 389-CALLERS.md:
- The resolver reads the flag per command row only. lib/workflow/command-resolver.cjs lines 233 to 243 (validateChainAutonomy) never reads sub_mode, so the Seed branch inherits true (sub_mode: pyramid-argument at commands/structure-argument.md line 36). lib/core/chain-executor.cjs lines 900 to 928 run a step without a gate when the flag is true.
- chain_run needs a bound room: lib/mcp/tools/chain.cjs lines 981 to 984 return no_bound_room for an unbound session. So a no-room Seed cannot run through chain_run. The CLI chain path (scripts/act-command.cjs, pipeline-command.cjs) was not traced: UNVERIFIED.
- Chains that name /mos:structure-argument (grep at HEAD): pipelines/thesis/CHAIN.md and 01-structure-argument.md, pipelines/PWS_grading/CHAIN.md and 04-structure-argument.md; also named in pipelines/thesis/02-challenge-assumptions.md, pipelines/PWS_grading/03-build-thesis.md and pipelines/analogy/04-transfer.md (not traced whether as a step).
- Precedent: /mos:research (card plus grant before a fetch).

Options:
- APPROVE: the flag stays true. The fetch sits behind an in-command card and behind a code refusal (the script refuses to fetch unless the confirmation matches the hash of the exact sprout list shown on the card). The Seed branch is taken only when no room is bound and never inside a chain run.
- FLAG-FALSE: autonomous_safe becomes false in the command and the skill. Every chain that includes structure-argument then halts before it (pipelines/thesis, pipelines/PWS_grading and any other found by grep).

Recommended: APPROVE.
Reason: the Seed fetch is the only part that leaves the machine, and a card plus a code refusal guards it without stopping the full chain for room users.
Undo: git revert of the plan 06 commits (the flag line and the guard).
Consumed by: plan 06 (the FLAG-FALSE step is written in its own text).
<!-- items:end -->

## 3. Ordering, coupling and allowed tokens

Allowed tokens per item (the recommended token is APPROVE for all 11):

| Item | Tokens |
|------|--------|
| D1 | APPROVE, KEEP-HOOK |
| D2 | APPROVE, KEEP-DETACHED |
| D3 | APPROVE, NO |
| D4 | APPROVE, NO |
| D5 | APPROVE, NO |
| D6 | APPROVE, NO |
| D7 | APPROVE, NO |
| D8 | APPROVE, NO-ALIAS |
| D9 | APPROVE, NO |
| D10 | APPROVE, DROP, NO |
| D11 | APPROVE, FLAG-FALSE |

Coupling rules (the code enforces them, even for an item that was not asked about):
- D1 APPROVE needs D2 APPROVE.
- D6 APPROVE needs D1 APPROVE and D2 APPROVE.
- D10 DROP needs D6 APPROVE.
- D2 KEEP-DETACHED needs D1 KEEP-HOOK and D6 NO.

Order of work: plan 07 (D1, D2), plan 08 (D3, D4), plan 09 (D5, D8), plan 10 (D6), plan 11 (D7, D8), plan 12 (D10), plan 13 (D9), plan 06 (D11, which comes first in time: it adds the Seed branch).

How a consuming plan reads the card:
- Run: node .planning/phases/389-pyramid-seed-and-full-replaces-the-mva-family/389-decision.cjs gate .planning/phases/389-pyramid-seed-and-full-replaces-the-mva-family/389-DECISION.md D<n>
- Exit 0 with the line "D<n> APPROVE APPROVED": the plan does the item.
- Exit 0 with the line "D<n> <token> ALTERNATIVE": for KEEP-HOOK, KEEP-DETACHED, NO and NO-ALIAS the plan changes nothing for that item and says so in its SUMMARY. For DROP (D10) and FLAG-FALSE (D11) the plan runs the alternative step written in its own text.
- Exit 1 for any other state (PENDING, UNKNOWN-TOKEN, HASH-MISMATCH, HEAD-NOT-ANCESTOR, COUPLING, BLOCKED): the plan changes nothing for that item and returns NEEDS_HUMAN.
- Matching is exact and case-sensitive. Only a line of the exact form "OWNER-ANSWER-D<n>: <TOKEN>" counts. approve, APPROVE-MOST, APPROVE with a trailing word, a token of another item, a duplicate line and a missing line are never a go.
- The ITEMS-SHA256 line is the hash of section 2 (between the two marker lines). If section 2 is edited after the answer, the gate reports HASH-MISMATCH and every plan stops. The answer edit is its own commit.

## 4. Answer block

The main session records the owner's tokens here, in one commit of this one file. Until then every line says PENDING.

OWNER-ANSWER-D1: APPROVE
OWNER-ANSWER-D2: APPROVE
OWNER-ANSWER-D3: APPROVE
OWNER-ANSWER-D4: APPROVE
OWNER-ANSWER-D5: APPROVE
OWNER-ANSWER-D6: APPROVE
OWNER-ANSWER-D7: APPROVE
OWNER-ANSWER-D8: APPROVE
OWNER-ANSWER-D9: APPROVE
OWNER-ANSWER-D10: APPROVE
OWNER-ANSWER-D11: APPROVE
HEAD-AT-DECISION: ce0babce792ee66b33c28eb1c4e0cce6f39e1de8
ITEMS-SHA256: b779dcef7c0da7da7d326fa8a4ce9d607e12e7b10b69b5938d86917c36e52a7f
