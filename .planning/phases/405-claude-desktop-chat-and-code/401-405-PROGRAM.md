---
kind: program review (EGM elephant)
scope: Phases 400.1 and 401 to 405 as one set; upstream islands 400, 400.2, 400.2.1, 400.3, 400.3.1, 400.4, 400.5 and 367
date: 2026-11-27
base_read: worktree /home/jsagi/dev/MindrianOS-Plugin-405, branch work/405-desktop at 9fc8e26d4 (merge base with origin/main 1331fdeca; 7 commits behind origin/main, 5 ahead)
also_read: /home/jsagi/dev/MindrianOS-Plugin-367 (branch work/367-graph-writes-itself at 8cb094add, 32 commits ahead of origin/main); /home/jsagi/dev/MindrianOS-Plugin-release (main at acb4de477) for docs/CLAUDE-SURFACE-MODEL.md and SEED-173
design_read: 405-DESIGN.md r4 (62,949 bytes, 13:54) for sections 3.10, 3.11, 7, 8, 10, 12; 405-DESIGN-r3.md for the rest; Goldfish R3 implementation-readiness and codebase-details
marks: PROVEN = read in a file or run here. CITED = a planning file says it; not re-run. GUESS = inference. UNVERIFIED = not run.
rule: owner rulings are locked. This file says where a plan fails a ruling. It does not change a ruling. It changes no other file.
---

# Program review: Phases 400.1 and 401 to 405

Plain picture. Six phases are six islands. They stand in one sea: the same 22 files, 4 budgets and 1 release train. Five islands were sized before the sea changed (the efficiency study is from 2026-11-24; the chat and Cowork merge and the 405 rulings are from 2026-11-27). So the main risk is not inside an island. It is two islands that change the same file in two directions.

Short result:
- 23 contradictions between phases (section 2c). 6 of them need an owner answer.
- 405 is the only phase with a design. It is not ready to plan: Goldfish round 3 gave 8 Blockers and 24 Majors (405-GOLDFISH-R3-implementation-readiness.md header: 4 and 11; 405-GOLDFISH-R3-codebase-details.md header: 4 and 13).
- The OR-9 order holds in its main line. 4 steps need a move or a new slot (section 2e). They are OWNER items.
- Three defects that users see today wait behind 405 without a file reason: the card-fire broken promise, the session-start cap, and the frontmatter split (section 2e, E3 and E7).

---

## 1. ISLANDS

### 1.0 Upstream islands (short form)

| Phase | Status | What it leaves for 401 to 405 |
|---|---|---|
| 400 Job sentences, Cynefin layer | DONE. 15 of 15 plans (ROADMAP.md:4284 area, "15/15 plans complete"). Verification passed with 1 partial; owner sign-off 2026-11-25; labels stay provisional (400-VERIFICATION.md frontmatter). | (1) Deferred item 2: job keys sit after the first `# ---` line in all 17 agents and 12 standalone skills, so the host reads them as body text; "Phase 401 owns it" (400 deferred-items.md item 2). (2) Deferred item 1: 65 command comments hold line pointers that are 4 lines off; owner "a later quick task or Phase 401" (item 1). (3) Rule: job slots live in their own keys, never in `description:` (00-SYNTHESIS.md Notes). (4) Open human item: wicked cut-off not fitted (AX-02). (5) Provisional label lists: 142 capability sentences, 63 MCP tool sentences (400-VERIFICATION.md human item 5); any command or agent removed or merged by 401 or 403 changes these lists. |
| 400.1 Efficiency research | DONE as research. 0 plans. 2 owner items open (L-CW1, L-DT1). | See island 1.1. |
| 400.2 Persona, hats, research | DONE. 19 of 19 plans (ROADMAP.md, "19/19 plans complete"). | Cost input: one deep run is 16 agent runs and 4 stops, or 28 agent runs with 2 rebuilds per hat (400.2-OWNER-REVIEW.md:289, K-4). Each run loads the user CLAUDE.md and MEMORY.md today (400.1-RESEARCH.md K5). Deep mode refuses where no shell exists (requirement PL-04, ROADMAP.md:4374). Owner-accepted cost K-13: a hat search can leave the machine with no card (400.2-OWNER-REVIEW.md:297). |
| 400.2.1 Persona deep-run defects | NOT STARTED. 0 plans; marked CRITICAL (ROADMAP.md:4399 to 4408). | It edits the persona door and the persona-analyst contract. Phase 403 edits the same agent files. No order is written between them. |
| 400.3 Timeouts that lie | PARTLY DONE. 10 plans built (01, 02, 02b, 03, 03b, 05a, 05b, 06a, 06b, 06c: SUMMARY files in the phase folder). Plans 04, 07, 09 to 16 are unplanned; plan 08 is out of the phase (400.3-CONTEXT.md:12). The ROADMAP line is stale: it says "3 plans" (ROADMAP.md:4432 area). | (1) `artifact_file` indexes its own filing and returns `graph_index` and `partial` (plan 01; lib/mcp/tools/views.cjs:592-597 per 405-RESEARCH.md section 6). (2) Lock and busy rules: bounded 750 ms busy report (owner ruling C10 and OR-4), BEGIN IMMEDIATE owned by plan 06 (OR-2), the write door that opens a ready room without the write lock (06b). (3) Room marker: `.room-root` AND an existing `.mindrian/room.db` (D-03 amended). (4) D-10: no hook and no index call creates room.db. (5) Unplanned 400.3-09 "lands with Phase 402's card-fire stale-gate fix" (400.3-PROPOSAL.md:96). (6) Unplanned 400.3-08 moves the cascade off the foreground; known-open H5: 11 to 14 s hook wall time under a held lock (400.3-CONTEXT.md owner rulings after the build). (7) 05a: each Part 8 guard hook now runs as a parent plus an `--inner` child (400.3-CONTEXT.md OR-9 coordinator decision). |
| 400.3.1 Red tests on main | DONE. 1 plan (400.3.1-01-SUMMARY.md, status complete). | SEED-172: no release gate runs these 4 tests; the 353 L2 band is marked MOVING; test-vi3-icm-walk holds 31 byte pins (same SUMMARY). GUESS: a bulk edit of commands and skills (401) moves these pins again. |
| 400.4 Cold-start QA fixes | DONE. 13 of 13 plans; plan 13 moved to 400.5 (STATE.md:6). Verification `human_needed` with 5 human items (400.4-VERIFICATION.md frontmatter). | (1) Plan 12 `run()` exports: the base for 400.5. (2) 2 human items ask for card renders on CLI, Desktop and Cowork; "Cowork" no longer exists as a separate place. (3) The runner reports KNOWN=9 tests that fail at base (STATE.md:6; tests/run-all-400.4.sh:4-6). (4) Capped cortex context leg: the same builder family 405 calls from `room_bind` (405-DESIGN 3.4). |
| 400.5 Prompt hooks inside the server | DEFERRED. 0 plans. The coordinator states: deferred to the beta after 2.0.0-beta.95 by owner ruling; main is frozen for that cut. The ROADMAP still says "CRITICAL PATH: must land before the next release cut" (ROADMAP.md:4306). UNVERIFIED in repo files: no file on this branch records the deferral. | (1) One new MCP tool on the mindrian-os server, EXCLUDED under Part 11 and "counted in the tool budget" (ROADMAP.md 400.5 success criterion 3). (2) One `mcp_tool` UserPromptSubmit hook replaces 4 command hooks (criterion 1). (3) JSON `additionalContext` contract; plain text is silently dropped (criterion 2). (4) Process-wide state to reset per prompt in a long-lived server (400.5-INPUT-run-exports-state-to-manage.md). |
| 367 Graph writes itself | IN PROGRESS. On main: plans 01, 03, 05, 06 (405-CONTEXT.md, Evidence). On the branch: SUMMARY files for plans 01 to 12; plan 13 in work and blocked by a stale harness manifest (commit 8cb094add, D-367-08); plan 14 not started. Owner of the rest: jsagi-42. | (1) lib/mcp/graph-catchup-spawn.cjs, tests/test-367-governed-census.cjs and tests/test-367-catchup-mcp.cjs do not exist on work/405-desktop (PROVEN: `ls` fails). (2) PA-1 and PA-2 (405-CONTEXT.md). (3) Frozen lists GOVERNED (graph-catchup-spawn.cjs:40) and PURE_READ (:113); 405-CONTEXT gives the counts 69 and 7. 69 + 7 = 76 = the tool count pin of tests/test-270-tool-schema-budget.cjs:535. |

### 1.1 Phase 400.1 (efficiency research)

- Job: prove the numbers of the 2026-11-24 study, so that 401 to 404 plan on facts.
- In: checks K1 to K9, findings F1 and F2. Out: any code change (400.1-CONTEXT.md, "Not in scope").
- Entry: Phase 400 on the tree. Met.
- Exit (testable): 400.1-RESEARCH.md has one verdict per check. Met for K1, K3, K4, K6, K7, K9. Not met: K2 items L-DT1 and L-CW1 (NEEDS_HUMAN, 400.1-RESEARCH.md:97), the K5 live probe (UNVERIFIED, :142).
- Files touched: none in the product.
- Rulings: R1 to R4 (400.1-CONTEXT.md).
- EGM or thin plan: neither. No plan is needed. Close it with a short addendum (see risk 1).
- Size: 0 plans.
- Top 3 risks:
  1. The research is out of date on places. It names Cowork 17 times in K2 and K8 as a separate place (for example `mcp__workspace__bash`, 400.1-RESEARCH.md:197). The surface model removed that place on 2026-11-27. Phase 404 reads K8 as its pilot design.
  2. The validity date is 2026-12-08 (400.1-RESEARCH.md:402). By the OR-9 order, 402 and 404 build after that date. The version floors must be read again.
  3. The measured tree is 35afa6d (400.1-RESEARCH.md:6). 400.2, 400.3 and 400.4 landed after it (58, 62 and 67 commit subjects on this branch). The 31k baseline and the 8,825-character session-start figure are older than the tree 402 will change.

### 1.2 Phase 401 (hygiene and cheap context cuts)

- Job: remove dead and repeated text, and make the host read the frontmatter that the files already hold.
- In (ROADMAP.md:4447): F1 frontmatter split test and fix; 115 files with the unscoped mindrian-brain tool name; remove mcp-server-brain/ and its referencing files (R4); strip repeated `$schema` (4,332 B); shared includes; description cap; size test. Out: runtime changes (402), agents (403).
- Entry: 400.1 research. Per ROADMAP.md:4449 the plans that touch 405 files wait for the 405 foundation.
- Exit (testable):
  - `node tests/test-401-frontmatter-split.cjs` fails any file whose first `---` after line 1 is not the closing line (400.1-RESEARCH.md:347). Today 253 of 255 files fail (PROVEN here: commands 112 of 113, skills 124 of 125, agents 17 of 17).
  - `grep -rl "mcp-server-brain"` outside the folder returns 0 (today 54 files, PROVEN here; the research says 53).
  - No command, skill or agent prose calls `mcp__mindrian-brain__`; the Part 8 test fixtures keep it (see C6).
  - tests/test-270-tool-schema-budget.cjs AFTER moved by the measured `$schema` saving.
- Files and tests: commands/*.md (113), skills/*/SKILL.md (125), agents/*.md (17), scripts/build-skill-mirrors.cjs, scripts/build-new-surface.cjs:208 and :253 (it writes new `# --- ... ---` lines; PROVEN), scripts/backfill-hitl-shape.test.cjs:181 (pins one such line), scripts/release.sh:1122-1147 (names mcp-server-brain in the Step 9.5 payload check), .gitignore:93-94, tests/fixtures/341-release-step-block-hashes.txt (hashes each `# --- Step` block), dist/ (273 tracked generated files), data/command-registry.json, data/harness-manifest.json (digests agents/larry-extended.md and skills/larry-personality/SKILL.md; scripts/build-harness-manifest.cjs:174-190), tests/test-270-tool-schema-budget.cjs, lib/mcp tool schemas.
- Rulings: R4; "Brain = Theo"; owner ruling 2026-11-18 "retired means blocked, not ignored" for pws-brain-mcp (CLAUDE.md stack table; lib/core/brain-response-sanitize.cjs:144-147).
- EGM or thin plan: a NARROW EGM round, then a thin plan. Reason: 401-405-WORKFLOW.md lets a phase skip EGM only when it "does not touch Part 8, 9 or 11". 401 touches Part 11 (the frontmatter of every invocable surface; `allowed-tools` comes alive in 109 files, 400.1-RESEARCH.md:47) and stands next to Part 8 (the Brain tool names and the three pinned matchers). The round covers 2 items only: F1 and the Brain-name sweep. The rest is mechanical.
- Size: 7 plans (F1 test and fix with generators and mirrors; allowed-tools review per file; Brain-name and stale-URL sweep; R4 removal with release.sh; `$schema` strip; expired commands; includes, description cap and size test).
- Top 3 risks:
  1. F1 changes behaviour, not only size. After the fix the host parses `allowed-tools` in 55 commands and 54 skills that it ignores today (400.1-RESEARCH.md:242). 10 of them list a tool name that never exists (:162). Pre-approvals change on every local surface in one release.
  2. A blind sweep breaks Part 8 pins. `pws-brain-mcp` must stay in three byte-identical matchers (hooks/hooks.json:208 and :332; brain-response-sanitize.cjs:151), and 12 test files hold the unscoped tool name (PROVEN by grep here), several of them on purpose as matcher fixtures (for example tests/test-396-theo-route-matrix.cjs, tests/test-395-egress-leaks.cjs, tests/test-brain-response-sanitize.cjs).
  3. Shared includes can break the chat. A skill in the Desktop chat runs in a cloud sandbox; whether `CLAUDE_PLUGIN_ROOT` is set there is UNVERIFIED (405-RESEARCH.md section 5, spike SP1). An include that points outside the skill folder may not resolve.

### 1.3 Phase 402 (lighter runtime)

- Job: load 18 tools up front instead of 76, and fix the hooks that waste a turn or lose context.
- In (ROADMAP.md:4458): per-tool alwaysLoad for the hot 18 (about 15.5k tokens saved, floor Claude Code 2.1.285); one JSON object per hook output (K3); card-fire fix without `continue:false` (K4); session-start hard cap below 10,000 characters (F2); Eureka tools on enable; hook process consolidation; opt-in process skills. Out: the preloaded-skill trim saves 0 in main-thread mode (K1, 400.1-RESEARCH.md:92), so it is no longer a lever.
- Entry: 400.1 research; 405 foundation merged (ROADMAP.md:4460); a deferral verdict for the Desktop Code tab and the Desktop chat (R3: "after Desktop and Cowork deferral is checked").
- Exit (testable):
  - A host transcript (`api-request-shape`) of one CLI session shows 18 mindrian-os tools up front and the rest with `defer_loading`. The doctor row cannot show this (400.1-RESEARCH.md Pitfall 6).
  - `node tests/test-402-card-fire-envelope.cjs`: the block has no `continue:false` (today scripts/check-card-fire.cjs:876, PROVEN).
  - `node tests/test-402-session-start-cap.cjs`: output under 10,000 characters on a large fixture.
  - `node tests/test-402-hook-stdout-shape.cjs`: one JSON object or plain text only.
  - tests/test-114-mcp-alwaysload.sh rewritten: it requires `alwaysLoad === true` on mindrian-os today (:14-27, PROVEN).
- Files and tests: .mcp.json:6, lib/mcp tool registration (`_meta`), scripts/mindrian-mcp-server.cjs, tests/test-114-mcp-alwaysload.sh, tests/test-127-00-shim-handshake.sh:102-106 (pins the brain entry true; R3 keeps it), tests/test-270-tool-schema-budget.cjs, scripts/check-card-fire.cjs, scripts/intent-classifier.cjs:3696-3720, scripts/session-start, hooks/hooks.json (12 events, 41 hooks, 0 of type `mcp_tool` today; PROVEN), the Eureka tool registration, data/capability-ledger.json, the 367 census lists (branch).
- Rulings: R3. SEED-173 item (d) asks for an owner ruling on alwaysLoad per server; R3 answers it for mindrian-os only.
- EGM or thin plan: FULL EGM. It changes behaviour on more than one surface and touches Part 11 (tool registration, a conditional tool set) and Part 12 (card-fire).
- Size: 7 plans (alwaysLoad with test rewrites; Eureka on enable; card-fire envelope; session-start cap; hook stdout shape; hook consolidation; opt-in process skills).
- Top 3 risks:
  1. The saving may not reach the chat, and no spike measures it (C1, C2).
  2. Overlap with 400.5 and 400.3: K3 and "merge 4 small prompt hooks" are the 400.5 design; the Stop-gate wait is 400.3-09 (C16).
  3. Per-tool marks do not make startup wait for the server (400.1-RESEARCH.md:102). The Phase 114 cold-start window can reopen: the first prompt can arrive before the 18 tools exist.

### 1.4 Phase 403 (isolated lens agents)

- Job: make reviewer agents blind to the user's CLAUDE.md and memory, and fold 17 agent files into a few workers with modes.
- In (ROADMAP.md:4469): the K5 probe first; `omitClaudeMd` and `tools` limits placed before any `# ---` line; read-only reviewers; one lens-worker with modes; a generic review loop with a synthesizer. Out: any Desktop chat leg (agents do not load there).
- Entry: 400.1 research; Phase 401 plan F1.
- Exit (testable):
  - The K5 probe run (400.1-RESEARCH.md:149-154): the subagent transcript has no `instructions` attachment with the project or user CLAUDE.md; MEMORY.md result recorded.
  - Each reviewer agent has `omitClaudeMd: true` before the frontmatter close (today 0 of 17; 2 grep hits are prose).
  - `node scripts/build-connector-registry.cjs --check` and `node scripts/check-shape-declaration.cjs` green after the merges.
- Files and tests: agents/*.md (17), data/connector-registry.json, data/harness-manifest.json, lib/core/review-contract.cjs:174 (it builds a denylist from the agent file names at run time; PROVEN), lib/core/chain-executor.cjs:380 and :437 (fan-out), scripts/persona-hats.cjs (400.2 contracts), the 142 capability sentences of Phase 400.
- Rulings: none of its own. Canon Part 11 (an agent is an invocable surface, born wired). Developer rule: evals run through Jev.
- EGM or thin plan: SPLIT. Plan A (K5 probe plus `omitClaudeMd` on the existing reviewers) goes straight to a thin plan: one surface, no Part 8, 9 or 11 change. Plan B (the merge into lens-worker, the review loop) needs an EGM round: it removes and renames Part 11 surfaces and changes the contract that 400.2 and 404 call.
- Size: 5 plans.
- Top 3 risks:
  1. "May run any time" is not true in files. It depends on F1 (ROADMAP.md:4471), and F1 edits 405 files, so by ROADMAP.md:4449 F1 waits for the 405 foundation (C20).
  2. Phase 404 needs the lens-worker for its first pilot (400.1-RESEARCH.md:196), but the ROADMAP gives 404 no dependency on 403 (C9).
  3. K1 side effect: Larry's main-thread voice runs without the larry-personality skill today (400.1-RESEARCH.md:93). A merge that moves evaluator text can change voice with no test; the open question names a Jev voice run "in 402 or 403" (:319) and neither phase owns it.

### 1.5 Phase 404 (methodology commands as thin Theo recipes)

- Job: a methodology command reads its steps from Theo and runs them, in the terminal and in the Desktop chat, instead of carrying the method as prose.
- In (ROADMAP.md:4480): a shim step tool that fails closed on any key other than `framework`; a field whitelist (29 KB to 6.4 KB per call); labelled local fallback for 8 frameworks (R1); draft notice for 29 (R2); recipe steps run inside the local room server; pilots challenge-assumptions and root-cause; scenario evals through Jev; rollout. Out: a second resolver; a quick or deep branch from Theo marks (only 2 frameworks mark optional steps, 400.1-RESEARCH.md:177).
- Entry: 400.1 K7 and K8; 405 foundation merged; the overlapping parts of 401 and 402 (ROADMAP.md:4482).
- Exit (testable):
  - `node tests/test-404-shim-step-args.cjs`: any payload other than `{framework: <canonical name>}` is refused before `callTool` (the guard alone gives `ambiguous` and proceeds, 400.1-RESEARCH.md:185).
  - `node evals/recipes/run.cjs --offline` green, with the negative legs of 400.1-RESEARCH.md:210; the Jev leg exits 77 with no key.
  - Both pilots run in the CLI and, for 405 slice 11, in the Desktop chat through the extension with a receipt (405-DESIGN AC11.1).
- Files and tests: a step tool (place open, see C7), lib/core/brain-client.cjs:429, lib/core/part8-egress-guard.cjs:633, lib/core/chain-executor.cjs, lib/mcp/tools/chain.cjs, commands/challenge-assumptions.md and commands/root-cause.md with their mirrors, references/methodology (42 files, 6,602 lines), lib/core/enrichment-queue.cjs, scripts/jev-devtime-client.cjs:422 and :481, evals/recipes/, tests/test-270-tool-schema-budget.cjs, the 367 census.
- Rulings: R1, R2; "two sources of what runs next, no third"; OR-7, OR-8 and OR-9 of 405; Part 8; the Brain IP rule (step text in memory only).
- EGM or thin plan: FULL EGM. Three places, Part 8, Part 11, and a new tool.
- Size: 8 plans.
- Top 3 risks:
  1. No place in the chat holds the step tool as specified (C7), and the chat method route is a different Theo server (C8).
  2. The pilot fan-out needs subagents; the chat has none (C9). Its material gate needs a click proof that exists only if spike SP6 passes (C10).
  3. The K8 design is ASSUMED (400.1-RESEARCH.md:191) and was written for Cowork, which is gone (C11).

### 1.6 Phase 405 (Desktop chat and Desktop Code tab)

- Job: MindrianOS works as a first-class tool in the CLI, the Desktop Code tab and the Desktop chat; where no room is reachable it says so and still gives Theo method cards.
- In (405-DESIGN section 1, G1 to G8): capability facts and fingerprint; registered-room write rule and `/mos:rooms adopt`; receipts and idempotency on 6 writers; Part 8 text for chat; the `.mcpb` extension; click proof for material approvals; Theo cards; ordered schema floor (OR-10). Out (section 2): a remote room server; any change to the 367 runner; rewriting skills for chat; alwaysLoad timing; website edits; signed egress.
- Entry: a clean Goldfish round; slice 0 spikes done; 367-11 and 367-12 on origin/main (PA-1).
- Exit (testable): the ACs of 405-DESIGN section 7 with the test map of section 9; LIVE legs on Windows and macOS; `bash tests/run-all-405.sh`.
- Files and tests: 405-DESIGN section 8 (file table). The files shared with other phases are in section 2a below.
- Rulings: OR-1 to OR-10; PA-1, PA-2; Parts 3, 7, 8, 9, 11, 12.
- EGM or thin plan: EGM in progress (r4; r4.1 reserved for the codebase-details findings).
- Size: 14 plans (slices 0, 1, 2a, 2, 3, 4, 4b, 5a, 5b, 6, 7, 8, 10, 9, 11; 4b, 5a, 5b and 6 are built or dropped by spike verdicts).
- Top 3 risks:
  1. The branch is behind main. It lacks docs/CLAUDE-SURFACE-MODEL.md and SEED-173 (PROVEN: 7 commits behind, among them 9f8211d7b and d700f0ee1). The ROADMAP on this branch cites that file, and slice 7 AC7.2 edits it.
  2. The round is not clean, and 2 findings already go to the owner: CD3-M1 (how wide the registry rule is on the CLI) and CD3-M12 (RULE 5 place or artifact).
  3. r4 slice 9 adds `dist/` to .gitignore (405-DESIGN section 8, row 9). `dist/` is a tracked, generated tree: 273 tracked files; .gitignore:71-82 says it is GENERATED and COMMITTED (PROVEN). The line as written hides future generated bundles from git.

---

## 2. THE SEA

### 2a. Shared-file matrix

Cell = what the phase does to the file. Empty = no touch found. "400.x/367" names the upstream phase.

| # | File or generated artifact | 401 | 402 | 403 | 404 | 405 | 400.x / 367 |
|---|---|---|---|---|---|---|---|
| 1 | lib/mcp/runtime-instructions.cjs (served 2,000 B; budget 2,000; host cap 2,048; PROVEN by run) | "state repeated param rules once in the server instructions" (00-SYNTHESIS Phase A row 5) | none stated | none | GUESS: a recipe line | slice 7: new THEO and LOOP lines, 1,999 B | pins: tests/test-359-prose-budget.cjs:88, lib/mcp/no-instructions.test.cjs, data/harness-policies/contract-parity-larry.json:46 |
| 2 | .mcp.json (2 servers, both `alwaysLoad: true`, :6 and :11) | none | removes :6 | none | none unless the shim gains a tool | slice 10: adds theo-context, no alwaysLoad | tests/test-114 (:14-27), test-127 (:102-106); the mos-desktop copy; dist/generic-claude-dir/.mcp.json |
| 3 | Tool descriptions and schemas; tests/test-270-tool-schema-budget.cjs AFTER (:532-541); wire snapshots tests/fixtures/267 | `$schema` strip, nav and schema trims | `_meta` on 18 tools; Eureka tools conditional | none | 1 new tool | slice 3 (6 descriptions, 2 schemas), slice 6 (optional `room` on 12 call sites), slice 10 (room_list text) | 400.5: 1 new tool |
| 4 | scripts/build-skill-mirrors.cjs and the skill mirrors | F1, includes, expired commands | opt-in flags on process skills | none | recipe commands rewritten | slices 2, 5a, 10 (rooms, setup, doctor) | 400: job keys in mirrors |
| 5 | data/harness-manifest.json (digests 11 paths, among them agents/larry-extended.md, skills/larry-personality/SKILL.md, runtime-instructions.cjs, chain-executor.cjs, navigation-engine.cjs, both registries; PROVEN) | F1 edits 2 digested files | none stated | agent and registry changes | chain-executor, registries | slice 7 | 367-13 is blocked by a stale manifest (commit 8cb094add) |
| 6 | hooks/hooks.json (447 lines) | must not remove `pws-brain-mcp` | consolidation; Stop envelope | none | none | slice 10: rows :208 and :332 | 400.5: UserPromptSubmit rows (:342); 400.3-09: :156-162 |
| 7 | scripts/session-start and its output (8,825 characters at 35afa6d; cap 10,000) | nav-block trims | F2 hard cap; one process | none | none | none (3.4 uses the context builder as a function) | 367: runner spawn at :135; 400.3-06c |
| 8 | commands/*.md frontmatter | F1 in 112 files | none | none | 2 pilots, then rollout | commands/rooms.md, setup.md, doctor.md | 400: job keys; 65 stale pointers |
| 9 | Part 8 matchers: hooks.json:208, :332; brain-response-sanitize.cjs:151; 6 pinned tests and tests/fixtures/392-part8-replay/route-matrix.json | name sweeps must skip them | none | none | relies on part8-egress-guard.cjs:633 | slice 10: one new literal in 3 places | 400.3-05a: guard hook process shape |
| 10 | scripts/release.sh, tests/fixtures/341- and 310-release-step-block-hashes.txt, RULE 5 | R4: lines :1122-1147 | GUESS: a host floor check | none | none | slice 9: Step 6.8b, Step 9.x, `--mcpb` | none |
| 11 | scripts/mindrian-mcp-server.cjs | none | `_meta`, Eureka registration | none | tool registration | slices 1 and 5a (marker, heartbeat, parent probe) | 400.5 (hook tool, per-prompt state); 367-12 (wrapper install) |
| 12 | lib/mcp/tools/gate.cjs, chain.cjs; lib/core/chain-executor.cjs | none | none | fan-out seam | recipe gates and fan-out | slices 3, 4, 4b, 6 | 400.4: gate.cjs card wording |
| 13 | scripts/check-card-fire.cjs | none | K4 (:869-876) | none | none | none | 400.3-09 (:958-977) |
| 14 | scripts/intent-classifier.cjs | nav-block trims | K3 (:3696-3720) | none | none | none | 400.5 moves it into the server |
| 15 | agents/*.md (17) | F1 | none | all | calls the lens-worker | payload of the extension (3.7a) | 400.2 and 400.2.1: persona-analyst |
| 16 | dist/ (273 tracked files) | regenerates 36 files | none | none | none | slice 9 writes dist/*.mcpb and ignores dist/ | tests/test-234-dist-bundle.cjs |
| 17 | lib/core/room-db.cjs | none | none | none | none | slice 3 (`write_keys`), 3.11 (`mos_meta`, write-open refusal) | 400.3-06a, 06b |
| 18 | lib/mcp/session-room.cjs | none | none | none | none | slice 2 | 367: `classifyMcpWriteRoom` (branch :256-284) |
| 19 | data/connector-registry.json, data/command-registry.json | expired commands | conditional tools | agent merges | new tool, changed commands | `adopt` subcommand | 400.5: EXCLUDED hook tool |
| 20 | Tests that set `MINDRIAN_ROOM` or `fallbackRoomDir` (117 files, CD3-M3) | adds tests | adds tests | adds tests | adds tests | slice 2a migrates them | tests/test-270:65 sets the pin itself |
| 21 | 367 census lists GOVERNED and PURE_READ | none | Eureka tools conditional | none | 1 new tool | PA-2 leg (count moves by 0) | 400.5: 1 new tool |
| 22 | lib/core/part8-egress-guard.cjs, lib/core/brain-client.cjs | stale URL sweep (brain-client.cjs:24 is the one source of the URL) | none | none | step tool calls `callTool` | slice 10 reuses the initialize probe (CD3-N13) | 400.3-05b lexicon cache |

### 2b. Shared budgets and who spends them

| Budget | Limit and source | State today | Spenders | Verdict |
|---|---|---|---|---|
| Server instructions | 2,000 B file budget, 2,048 B host cap (runtime-instructions.cjs:10-27) | 2,000 B (PROVEN by run) | 405 slice 7 takes it to 1,999. 401 wants to add param rules. 404 has no line. | FULL. One byte is free after 405. Any other phase must trim before it adds. |
| mindrian-os tool surface | tests/test-270: exact tool count 76 (:535, :616); total 85,599 B with 10 percent drift (:538, :621-624) = about 8,560 B | 76 tools | 401: minus 4,332 B. 405: plus 384 B on descriptions (6 x 39 + 2 x 75, 405-DESIGN 3.3), plus 209 B (173 + 36), plus up to 12 `room` properties. 402: plus 18 `_meta` marks; minus 27 tools and 28,518 B when Eureka is off. 404: plus 1 tool. 400.5: plus 1 tool. | Five phases move one constant. The exact count pin breaks on 3 of them (402, 404, 400.5). Each re-base needs its plan and reason (the file's own rule, :243-262). |
| Doctor surface budget | 8,000 tokens (lib/core/doctor/mcp-surface-module.cjs:89) | about 21,400 tokens (test-270 AFTER); 2.8 times over (00-SYNTHESIS) | 402 | The doctor counts the whole tools/list and cannot see deferral (400.1-RESEARCH Pitfall 6). 402 must change the measure or the row stays red. |
| Session-start hook output | 10,000 characters per hook output; over it the host keeps a 2,000-character preview (400.1-RESEARCH.md:249) | 8,825 characters at 35afa6d | 402 (cap). 367 added a spawn in the same script. 400.5 moves prompt-time context out of command hooks. | 1,175 characters free. No hard cap in code (only a token variable, scripts/session-start:10, :1033). |
| Per-session context | about 31k tokens before the first prompt (400.1-RESEARCH.md:236) | derived estimate (A5) | 402 saves about 15.5k (deferral) plus up to 7.1k (Eureka); 401 about 1.1k (`$schema`); 405 adds theo-context tool names in every CLI session (CD3-N15) | The 402 figure is CLI-proven only as a size, not as a host result. |
| Skill and agent body bytes | no limit today; 24,000 B rule proposed (00-SYNTHESIS Phase A) | 165,546 B of frontmatter leaks into bodies (400.1-RESEARCH.md:242) | 401 F1 removes it; 400 added job keys (4 lines per file) | F1 first, or every later size number is wrong (400.1-RESEARCH.md:51). |
| Extension payload | 4,500 files and 180 MB reused from the Desktop copy check (CD3-N11); the real `.mcpb` limits are UNVERIFIED (SP7) | not measured | 405 slice 5a. 401 (R4, expired commands) and 404 (reference files become fallback or go) shrink it. 403 changes agents/ which the payload must hold. | Measure in slice 5a before SP7. |
| Release train | one cut per beta; main frozen for beta.95; RULE 5 lockstep; step-block hash fixtures | frozen | 405 slice 9 (2 new steps), 401 R4 (Step 9.5 block), each phase needs its own cut to be live | Every fixture re-base needs navigator authorization (405-DESIGN AC9.7). Two phases re-base the same 2 fixture files. |
| Owner live-test time | 405 slice 0: about 20 minutes (401-405-WORKFLOW.md step 2) | 0 used | 405 spikes; 400.1 L-DT1; 400 and 400.4 card renders on Desktop (7 human items in the two VERIFICATION files, 3 of them need Desktop) | One Desktop session can carry all of them if they are added to slice 0 now. |

### 2c. Contradictions between phases

Count: 23. Each has evidence. "Owner" marks the 6 that need an owner answer.

C1. 402 per-tool alwaysLoad against the 405 extension.
- 402 moves load control into `.mcp.json` (drop the server key) and into `_meta` per tool (400.1-RESEARCH.md:263). In the Desktop chat the room server comes from the `.mcpb` manifest, which has no `.mcp.json` and no alwaysLoad key (405-DESIGN 3.7a manifest list). The chat has its own "Tool access" mode per conversation (400.1-RESEARCH.md:106). "No page says whether chat or Cowork honors the per-tool `_meta` mark" (same line).
- Effect: the 15.5k saving is proven for no place yet and is unknown for the chat. The 2.1.285 floor is a Claude Code version; the chat is not Claude Code. The Code tab bundles 2.1.330 (400.1-RESEARCH.md:104), so the floor holds there.

C2. The 400.1 owner items are not in the 405 spikes. (Owner)
- ROADMAP.md:4412 says L-CW1 and L-DT1 "fold into the Phase 405 slice 0 spikes". ROADMAP.md:4460 says the alwaysLoad change must agree with "spike SP3".
- 405-DESIGN section 6: SP3 is the cloud Code session marker. No spike SP1 to SP8 asks "which tools can you call without searching" or serves a tool with the `_meta` mark. L-DT1 as written uses a different probe (`mos392probe` as a config server, 400.1-RESEARCH.md:281); the 405 spikes use the spike 012 probe as an extension.
- L-CW1 cannot run: the owner account has the merged experience ("B1 and B2 not applicable", docs/CLAUDE-SURFACE-MODEL.md, Field evidence).
- Effect: after slice 0, R3's condition is still open and 402 cannot start its main plan.

C3. The hot 18 against the chat loop.
- Hot set (03-mos-runtime-cost.md:56): artifact_file, room_bind, context_assemble, room_state, room_graph, room_list, orchestration, room_search, room_startup, status_read, gate_answer, gate_render, claim_write, claim_read, suggest_next, stop_gate_check, chain_resolve, room_create.
- Not in it: chain_run (named in the first instruction line, runtime-instructions.cjs:35), memory_event and graph_write (2 of the 6 receipt writers of 405-DESIGN 3.3), the room-dashboard view (named in the LOOP line), room_changes (the read-back route named in 405-RESEARCH.md section 6).
- The set was chosen from 60 days of the owner's CLI use (00-SYNTHESIS diagnosis). The chat loop is different: it has no hooks, so the model must call what hooks do in the CLI.

C4. 402 "Eureka tools on enable" against three count pins.
- Pins: tests/test-270 tool count 76 (:535); the 367 lists GOVERNED and PURE_READ (69 + 7); PA-2: "the pins move only by the count the 405 plan states".
- 402 makes 27 tools conditional (00-SYNTHESIS Phase B). The tool list then depends on the machine. 405 slice 4 AC4.5 asserts "tools added by 405 = 0, so GOVERNED 69 and PURE_READ 7 are unchanged".
- Also: `/mos:eureka enable` needs a shell. A chat-only user (extension only) can never enable it. 405 slice 4 already refuses Eureka engine starts on a hookless place (AC4.4). The two rules must be one rule.

C5. 401 stale-name removal against "retired means blocked". (Owner, light)
- 401 goal: remove stale pre-Theo Brain references; pws-brain-mcp is in 74 files (400.1-RESEARCH.md:237).
- The literal `pws-brain-mcp` must stay in hooks/hooks.json:208 and :332 and in BRAIN_SHAPED_TOOL_MATCHER (brain-response-sanitize.cjs:151), by owner ruling 2026-11-18 (comment at :144-147), and in data/theo-tool-classes.json `retired_servers`. 405 slice 10 writes a new literal that keeps it (405-DESIGN 3.10 item 4).
- Effect: 401 needs an explicit keep-list. Without it the sweep and slice 10 edit the same 3 strings in opposite directions.

C6. 401 unscoped-name rewrite against Part 8 fixtures and against the chat.
- 401 rewrites `mcp__mindrian-brain__` to `mcp__plugin_mos_mindrian-brain__` in 115 files (400.1-RESEARCH.md:257).
- 12 test files hold the unscoped name (PROVEN by grep). Several use it to prove that the matcher catches a user-level server (test-396-theo-route-matrix, test-395-egress-leaks, test-brain-response-sanitize). Those must not be rewritten; the 401 plan must sort the 12.
- In the chat no tool has the `plugin_mos_` prefix. The observed prefix is `mcp__remote-devices__<server>__<tool>` (surface model, Field evidence), and mindrian-brain is not in the chat at all (405-DESIGN 3.6, option c). Commands load there as skills, so the rewritten prose names a tool that does not exist in that place.
- UNVERIFIED: the prefix of the mos-desktop copy. Its plugin.json name is `mos` (PROVEN in the marketplace copy), while 405 AC10.2 tests `mcp__plugin_mos-desktop_...`.

C7. 404 step tool: no home in the chat as specified. (Owner)
- The study puts it on the mindrian-brain shim (00-SYNTHESIS Phase D row 1). 400.1 K8 also names a shell step `node scripts/framework-recipe.cjs` (400.1-RESEARCH.md:197).
- 405-DESIGN 3.6: the shim is not in the extension; it rides only in the config fallback or if the SP7 two-server leg passes. The chat has no shell on the user's computer.
- ROADMAP.md:4480 says "recipe steps run inside the local room server". Then the step tool is a new mindrian-os tool that calls `callTool` in process. That gives the extension a route to theo-mcp. The extension has no install-time entitlement step, and decision 1 (.claude/includes/decisions.md) puts the paid gate at install and update. OR-8 says "the install-time entitlement stays as it is".
- Effect: the place of the step tool is an owner decision, because it decides whether a one-click extension reaches the guarded Brain.

C8. Two Theo routes for method in the chat.
- 405: "method via Theo card tools, else guarded mindrian-brain" (405-DESIGN 3.6 THEO line); theo-context serves `framework_steps` and `framework_walkthrough` (data/theo-tool-classes.json lists both, class content; PROVEN).
- 404: steps come from theo-mcp `framework_step` through the guarded client (400.1-RESEARCH.md K7): 30 of 38 frameworks with steps, 29 draft.
- A recipe in the chat would read steps from one server while Larry shows a card from the other. Whether the two servers hold the same steps is UNVERIFIED. R2 (draft notice) and R1 (fallback label) are written for theo-mcp only.

C9. 404 pilot fan-out needs agents; the chat has none; 404 has no dependency on 403.
- Pilot 1: "5 lens-worker calls in framework-step mode" (400.1-RESEARCH.md:196). The lens-worker is a 403 deliverable (ROADMAP.md:4469).
- The chat ignores agents (surface model table); the server tells every host "assume no hooks, shell or subagents" (runtime-instructions.cjs:35).
- ROADMAP.md:4482 lists no 403 dependency for 404; 401-405-WORKFLOW.md puts 403 at "any time".
- Effect: 405 slice 11 (AC11.1) cannot pass with the pilot as designed. 404 needs a no-agent path (steps in the main thread, in order) as a stated second shape.

C10. Recipe gates in the chat need the click proof.
- Pilot gate G1 is a material step (400.1-RESEARCH.md:198). On a hookless place a material approval without attestation is refused `human_confirmation_required` (405-DESIGN 3.5). The app card exists only if SP6 legs a to c pass (slice 4b).
- If SP6 = B, a recipe can never pass G1 in the chat. OR-9 step 7 then fails by design. The workflow has no line for that case.

C11. 404 reads a pilot design written for Cowork.
- 400.1-RESEARCH.md:197 ("Cowork note": `mcp__workspace__bash`, Cowork subagents). The surface model: chat and Cowork are one cloud Claude; its shell is not the user's computer.

C12. 403 "independent of Phase 405" against the files.
- ROADMAP.md:4471. But lib/core/review-contract.cjs:174 reads agents/ at run time to build its denylist; the extension payload must hold every folder the server reads (405-DESIGN 3.7a, AC5a.3); data/harness-manifest.json digests agents/larry-extended.md. An agent merge changes all three.

C13. 403 against the "every feature works on three surfaces" rule.
- Project CLAUDE.md: a skip is "a deliberate, stated call". The ROADMAP states it for 403. It is not stated for the two callers: 400.2 deep mode (stated, PL-04) and 404 (not stated, C9).

C14. Instructions budget: 401 against 405.
- 405 leaves 1 byte. 00-SYNTHESIS Phase A wants repeated param rules "once in the server instructions". There is no room. The `$schema` strip can stand alone; the param-rule move cannot.

C15. 405 slice 9 against the tracked dist/ tree and 401.
- Stated in island 1.6 risk 3. 401 regenerates 36 dist files (400.1-RESEARCH.md:162, "dist 36, which is regenerated"). With `dist/` ignored, new generated files stop reaching git.

C16. Double ownership: 402 against 400.5 and 400.3. (Owner)
- K3 fix and "merge 4 small prompt hooks" (402) = 400.5 success criteria 1 and 2 (one `mcp_tool` hook for the 4 routable checks, JSON contract).
- Card-fire: 402 owns the envelope (K4); 400.3-09 owns the Stop wait and "lands with Phase 402's card-fire stale-gate fix" (400.3-PROPOSAL.md:96), but 400.3-09 is unplanned.
- On-stop batching (402, 00-SYNTHESIS Phase B) and the cascade off the foreground (400.3-08, out of the phase).
- Effect: 3 phases may edit scripts/intent-classifier.cjs, scripts/check-card-fire.cjs and hooks/hooks.json for the same defects.

C17. 400.5 has no place in the 401 to 405 workflow, and its ROADMAP text is stale. (Owner)
- ROADMAP.md:4306: "must land before the next release cut". Coordinator: deferred to the beta after beta.95. 401-405-WORKFLOW.md does not name 400.5.
- 400.5 adds 1 tool to the server that 405 packs into the extension and that 402 defers. On the Code tab the marked extension process serves 1 status tool only (405-DESIGN 3.7a "Code-tab collision"), so the hook must target the plugin server; that is consistent, but nobody wrote it.
- 405-DESIGN 3.4 cuts the per-turn navigation block on P4 as "no consumer". 400.5 builds that block inside the server. After 400.5 it is one tool call away in the chat. 405 does not use it and does not say why.

C18. 405 registry rule against tests that other phases add.
- Slice 2a migrates 117 test files that pin a room. 401 to 404 add tests while 405 builds. A new test that writes through an unregistered pin fails after slice 2. No shared rule tells the other phases to use the helper.

C19. 405 receipt against the 400.3 status words.
- 400.3: `artifact_file` returns `graph_index: {ok, reason}` and `partial: true`; top-level `ok` stays true when the file landed (400.3-CONTEXT.md D-04). 405: a receipt with `read_back` and `read_back_mismatch`; the index runs after `done` (CD3-M5).
- Two honesty reports on one reply. The design says only "slice 3 adds the receipt after the 400.3 index" (405-DESIGN section 10). No AC says how `partial` and `read_back` combine, or what `replayed: true` reports for `graph_index`.

C20. F1 order: ROADMAP against ROADMAP. (Owner)
- 401 goal: "F1 frontmatter split test and fix first" (ROADMAP.md:4447). 403 depends on F1 (ROADMAP.md:4471) and "may run any time".
- ROADMAP.md:4449: 401 plans that touch 405 files wait for the 405 foundation. F1 edits commands/rooms.md, commands/setup.md, commands/doctor.md and their mirrors, which 405 slices 2, 5a and 10 edit (405-DESIGN section 8).
- So by the written rule F1 waits for step 5, 403 waits with it, and 405 adds frontmatter to files with the split still open. commands/rooms.md is safe today (`argument-hint` at :5 and `allowed-tools` at :19 are before the comment at :25; PROVEN), but that is luck, not a rule.

C21. 405 fixture counts and 400.3.1 moving pins against the 401 bulk edit.
- GUESS: F1 changes bytes in 253 files; tests/test-vi3-icm-walk.cjs holds 31 byte pins and the 353 L2 band is marked MOVING (400.3.1-01-SUMMARY.md). SEED-172: no release gate runs them. They can go red on main again without a signal.

C22. 402 opt-in process skills and the 401 description cap against chat discovery.
- In the chat a command loads as a skill (surface model table). A skill is found there by its description. 401 caps descriptions at 200 B; 402 sets `disable-model-invocation` on process skills.
- GUESS: both reduce what the chat model can find. No spike reads the chat's skill listing. Project CLAUDE.md names "natural-language discoverability" as what matters most on Desktop.

C23. Workflow table against workflow rule on 367.
- 401-405-WORKFLOW.md step 3: "367 plans 11 to 14 reach origin/main". Its rule line and PA-1: only 367-11 and 367-12. Plan 13 is blocked today (commit 8cb094add). If step 3 means 14, the 405 build waits on a blocked plan.

### 2d. Interface contracts

What 405 must give 404 (so a recipe runs through the bridge):
1. A stated home for the step tool in the chat (C7): either the mindrian-os server, or the shim inside the extension (SP7 two-server leg A).
2. The receipt shape of 3.3 as a stable contract: field names, `replayed`, and the rule for `partial` (C19). A recipe files through `artifact_file` and must pass `client_write_id`.
3. The material-approval predicate `isMaterialApproval` with a row for a recipe halt (`material_step`), and the answer for SP6 = B (C10).
4. The shared-binding rule of 3.9: if SP4 = A, every recipe write call must carry `room`. 404 must know before it writes its step runner.
5. The typed refusals a recipe must pass through unchanged: `no_local_room_here`, `human_confirmation_required`, `local_session_required`, `room_schema_newer`, `write_in_progress`.
6. The fingerprint field that tells a recipe "hookless place" (`launcher`), so the no-agent path of C9 is chosen by a fact, not by a guess.
7. The Theo route rule for a recipe in the chat (C8): which server gives steps, and what Larry shows.

What 401 F1 must give 403 and 405 (before they add frontmatter keys):
1. The test tests/test-401-frontmatter-split.cjs on main, so a new key after a comment line fails the build.
2. The generators fixed: scripts/build-new-surface.cjs:208 and :253 and the mirror builder, so a new surface is born without `# ---`.
3. A per-file decision on `allowed-tools` (keep before the close, or drop), with the scoped tool name.
4. The scope rule: only markdown frontmatter. scripts/release.sh `# --- Step` headers are hashed by tests/fixtures/341-release-step-block-hashes.txt and must not change.

What 402 must not change under 405:
1. The served instructions (1,999 B after slice 7) and the BOUNDARIES paragraph.
2. The tools named in the instructions and the 6 receipt writers: they stay loaded up front (C3).
3. The tool list of a marked extension process: the same on every machine (C4).
4. The Part 8 guard hook rows :208 and :332 and their order, when hooks are consolidated.
5. The `.mcp.json` theo-context entry (no alwaysLoad) and the mos-desktop copy of the file.
6. The 367 runner spawn points in scripts/session-start:135 and scripts/on-stop:56.

What 400.5 must give 402 and 405:
1. The name and class of its hook tool, for the census, the tool count pin and the hot set.
2. The rule that the hook targets the plugin server, never a marked extension process.

What 403 must give 404: the lens-worker contract (mode names, input, output) before 404 plans pilot 1, or a written statement that pilot 1 runs without it.

### 2e. Dependency graph (edges with evidence) and the OR-9 order check

Edges into 401 to 405:

| Edge | Evidence |
|---|---|
| 400 -> 401 (F1 owns job keys after `# ---`; 65 stale pointers) | 400 deferred-items.md items 1 and 2 |
| 400 -> 401, 403 (provisional label lists change when a command or agent goes) | 400-VERIFICATION.md human item 5 |
| 400 -> 404 (the selector picks the command; a recipe runs after it) | 400.1-CONTEXT.md "Two sources", 00-SYNTHESIS |
| 400.1 -> 401, 402, 403, 404 (numbers, K8 design) | 400.1-RESEARCH.md "Inputs for 401, 402, 403, 404" |
| 400.1 -> 405 slice 0 (L-DT1, L-CW1) | ROADMAP.md:4412; not present in 405-DESIGN section 6 (C2) |
| 400.2 -> 403 (16 to 28 agent runs per deep run load CLAUDE.md and MEMORY.md) | 400.2-OWNER-REVIEW.md:289; 400.1-RESEARCH.md K5 |
| 400.2.1 -> 403 (same agent files, no order) | ROADMAP.md:4399 to 4408 |
| 400.3 -> 405 slice 3 (inline index, `graph_index`, `partial`; receipt after it) | 405-DESIGN section 10; 400.3-CONTEXT.md D-04 |
| 400.3 -> 405 slices 2 and 3 (room marker `.room-root` plus room.db; D-10; BEGIN IMMEDIATE owner; write door) | 400.3-CONTEXT.md D-03 amended, D-10, OR-2; CD3-B1 |
| 400.3 -> 402 (400.3-09 lands with the card-fire fix; 400.3-08 off-foreground cascade; 05a guard hook shape) | 400.3-PROPOSAL.md:96; 400.3-CONTEXT.md |
| 400.3.1 -> 401 (moving byte pins, no gate) | 400.3.1-01-SUMMARY.md; SEED-172 |
| 400.4 -> 400.5 (`run()` exports) | ROADMAP.md 400.5 "Depends on" |
| 400.4 -> 405 slices 0 and 8 (card renders on Desktop are open human items) | 400.4-VERIFICATION.md human items 1 and 2 |
| 400.5 -> 402 (K3, consolidation of prompt hooks) | ROADMAP.md 400.5 criteria 1, 2; C16 |
| 400.5 -> 405, 402, 404 (1 new server tool: count pin, census, hot set, extension) | ROADMAP.md 400.5 criterion 3; test-270:535 |
| 367 -> 405 foundation (wrapper, `classifyMcpWriteRoom`, census) | PA-1, PA-2 |
| 367 -> 402 (runner spawns in session-start and on-stop; census lists) | 405-RESEARCH.md section 3; graph-catchup-spawn.cjs:40, :113 |
| 367 -> 404 (a new governed tool must enter the census) | PA-1 condition 3 |
| 401 F1 -> 403 | ROADMAP.md:4471 |
| 401 F1 -> 405 slices 2, 5a, 10 (same command files) | 405-DESIGN section 8 |
| 403 -> 404 (lens-worker) | 400.1-RESEARCH.md:196 (missing in ROADMAP) |
| 405 foundation -> 402, 404 | ROADMAP.md:4460, :4482 |
| 405 SP6 = A -> 404 gates in chat -> 405 slice 11 | 405-DESIGN 3.5; C10 |
| 405 SP7 (two-server leg) -> 404 step tool home | 405-DESIGN section 6; C7 |
| 404 -> 405 slice 11 | OR-9 |

Order check against 401-405-WORKFLOW.md (the locked OR-9 order is not changed here):

| # | Finding | What moves | Kind |
|---|---|---|---|
| E1 | Step 2 (spikes) has no deferral leg, so the gate of step 5 (402) cannot close (C2). | Add 1 leg to SP7 and 1 to SP5: serve one tool with `_meta["anthropic/alwaysLoad"]: true` and one without; ask "which tools can you call without searching"; record the Tool access mode. No order change. | Fix inside step 2. OWNER item 1. |
| E2 | Step 3 says plans 11 to 14; the rule says 11 and 12 (C23). | State "11 and 12" in the table. | Text fix. |
| E3 | F1 is out of order (C20). It is a precondition for 403 and for the frontmatter that 405 slices 2, 5a and 10 add. By the written rule it sits at step 5. | Move F1 (one mechanical plan: test, fix, generators, mirrors) to the window between step 0 and step 4, while 405 waits for 367. | OWNER item 2 (it changes the reading of OR-9). |
| E4 | 400.5 has no slot (C17). It must land before 402 consolidates hooks, and its tool must be known to 405 slice 4 (census) and slice 5a. | Give it a slot: after step 3, before step 5. | OWNER item 3. |
| E5 | 403 is "any time", but 404 needs its lens-worker at step 6 (C9). | Either 403 Plan B finishes before step 6, or 404 states a no-agent path and drops the edge. | OWNER item 4 covers it. |
| E6 | The "any time" set of 401 is nearly empty. R4 touches release.sh (slice 9). The `$schema` strip touches test-270 AFTER (slices 3, 6, 10). Expired commands touch the registries and the harness manifest (slice 7). | Only test-only and doc-only 401 plans run in parallel with 405. | Note for the 401 planner. |
| E7 | Three 402 items touch no 405 file and fix defects users see today: K4 card-fire envelope (88 of 99 blocks ended the turn with no card, 400.1-RESEARCH.md:136), F2 session-start cap, and the K4 re-measure. They wait behind step 4 only because ROADMAP.md:4460 makes all of 402 depend on the 405 foundation. | Run K4 and F2 in parallel with steps 1 to 4, as their own small plans. | Parallel candidate. OWNER item 5. |
| E8 | Step 7 fails by design if SP6 = B (C10). | Add a rule line: "SP6 = B returns step 7 to the owner". | Text fix after the owner sees it. |
| E9 | Step 5 says "401 and 402, the parts that overlap 405 first (alwaysLoad and deferral, shared includes, description cap)". The Brain-name sweep overlaps slice 10 more than any of these (C5, C6). | Name the sweep in step 5 and order it after slice 10. | Text fix. |
| E10 | Each of steps 4, 5, 6, 7 is live only after its own cut ("not live until released"). The workflow names one cut (step 0). | State the cut after step 4 (slice 9 is a beta first, AC9.9) and after step 7. | Text fix. |

Result: the main line 405 foundation, then 401 and 402 overlap, then 404, then the 405 end slice is consistent with the edges. No edge runs against it. E3, E4, E5 and E7 are the OWNER items.

---

## 3. READINESS

"Ready for actual work?" per phase and per first step.

| Phase | Ready? | First step | Exact gate (what must be true) | Gate owner |
|---|---|---|---|---|
| 400.1 | DONE as research; not closed | Short addendum: Cowork lines marked superseded; L-DT1 rewritten as a slice 0 leg | Owner item 1 answered | Elephant of 405 writes; owner runs the leg |
| 401 | NO for the phase. YES for F1 alone if the owner moves it (item 2) | F1 plan: test first, then fix | (1) Owner item 2. (2) Main open after the beta.95 cut. (3) A narrow EGM note on `allowed-tools` coming alive in 109 files. (4) A keep-list for `pws-brain-mcp` and the Part 8 test files among the 12. | Owner (1); jsagi-42 (2); the 401 elephant (3, 4) |
| 402 | NO | CONTEXT, then EGM design | (1) The deferral leg run on Desktop (item 1). (2) Owner item 3 (400.5 split). (3) 405 foundation merged, except K4 and F2 if item 5 is yes. (4) Version floors read again (research valid until 2026-12-08). | Owner (1, 2, 5); the 405 build (3); the 402 elephant (4) |
| 402, K4 and F2 only | YES after the cut, if item 5 is yes | Thin plan or 2 quick tasks | Main open; tests named in 400.1-RESEARCH.md:349-350 written first | Owner; jsagi-42 for main |
| 403 Plan A (probe, omitClaudeMd) | NO; 1 gate | K5 probe run (5 steps, 400.1-RESEARCH.md:149-154) | F1 on main | The 401 F1 plan |
| 403 Plan B (merges, review loop) | NO | CONTEXT, then EGM design | Plan A verdict; owner item 4 (does 404 need the lens-worker); 400.2.1 order stated | Owner |
| 404 | NO | CONTEXT, then EGM design | (1) Owner item 4 (step tool home, Theo route, agent path). (2) SP6 and SP7 verdicts. (3) 405 foundation merged. (4) K8 rewritten for the surface model. | Owner (1); owner on Desktop (2); the 405 build (3); the 404 elephant (4) |
| 405 step 1 (EGM clean round) | IN WORK; not clean | r4.1, then a narrow round 4 | 0 Blocker and 0 Major open; CD3-M1 and CD3-M12 answered by the owner; the dist/ ignore line removed; the branch rebased onto origin/main (surface model doc and SEED-173 present) | The 405 elephant; owner for the 2 findings |
| 405 slice 0 (spikes) | NO; 2 gates | Thin plan for slice 0 | Step 1 clean; owner item 1 answered (the spike list changes) | The 405 elephant; owner |
| 405 foundation build | NO | Re-plan after spike verdicts | Slice 0 verdicts recorded in 405-SPIKES.md; 367-11 and 367-12 on origin/main; beta.95 cut done | Owner on Desktop; jsagi-42 |
| 405 slice 11 | NO | per 404 | 404 pilots done with a chat path; SP6 = A or an owner answer | 404; owner |
| 400.5 (upstream) | NO; deferred | /gsd-plan-phase 400.5 | ROADMAP text corrected; its slot set (item 3) | Owner |
| 367 plans 13, 14 (upstream) | BLOCKED on plan 13 | Regenerate the harness manifest | D-367-08 cleared | jsagi-42 |

The single next action for the owner: answer the 5 owner questions of section 4 on one card. Questions 1 and 4 change the spike list, so they come before the one Desktop session (slice 0, about 20 to 30 minutes with the added legs).

---

## 4. OWNER ITEMS and UNVERIFIED items

### Owner items (one question each; recommendation first)

1. Deferral check in the spikes. Recommendation: YES, add it.
   - Picture: the toolbox has 76 tools. Phase 402 wants to put 18 on the table and leave 58 in the drawer. Nobody has looked whether the Desktop chat opens the drawer by itself.
   - Question: add one leg to the Desktop spike session that shows which tools the chat and the Code tab can call without a search, and drop the separate Cowork test (there is no separate Cowork now)?
   - Why it matters: without it, Phase 402's main saving (about 15.5k tokens per session) stays unproven after the spikes, and your ruling R3 keeps it blocked.

2. Fix the frontmatter split now. Recommendation: YES, right after the cut, before the 405 build.
   - Picture: 253 of 255 instruction files have a note line that the host reads as "end of settings". Everything below that line is read as plain text.
   - Question: may the one mechanical fix (F1) run before the 405 foundation, although it touches 3 command files that 405 also edits?
   - Why it matters: 405 and 403 add settings to these files. Each new setting below the note line is lost without an error.

3. A slot for 400.5 and one owner per hook defect. Recommendation: 400.5 lands after 367 plans 11 and 12, before the 401 and 402 overlap; 400.5 owns the prompt hooks (K3, the merge of 4 hooks); 402 owns the card-fire envelope and the session-start cap; 400.3-09 folds into 402.
   - Picture: three crews are booked to repair the same three pipes.
   - Question: do you accept this split and this slot?
   - Why it matters: the ROADMAP still says 400.5 must land before the next cut. It adds one tool to the server that 405 packs and 402 defers.

4. How a recipe runs in the Desktop chat. Recommendation: the step tool lives on the room server; in the chat the steps come from theo-context cards (key-free, OR-8); the guarded Brain route stays CLI and Code tab only; the pilots get a no-agent path, so 404 does not wait for 403.
   - Picture: in the terminal a recipe asks the guarded Brain for steps and sends 5 helpers. In the chat there are no helpers, and the one-click extension has no paid check.
   - Question: may a chat recipe use theo-context as its step source, and run its steps one by one without helpers?
   - Why it matters: the other choice lets a free one-click install reach the guarded Brain. That changes decision 1 (the key gates install and update).

5. Two bug fixes out of the queue. Recommendation: YES.
   - Picture: a sign says "your choices are coming as a card" and then no card comes. This happened in 88 of 99 cases in 30 days.
   - Question: may the card-fire fix (drop `continue:false`) and the session-start size cap run now as small plans, apart from the rest of Phase 402?
   - Why it matters: they touch no 405 file. Today they wait behind the whole 405 foundation.

Carried from 405 Goldfish round 3 (already marked "send to the owner"; not counted above): CD3-M1 (does the registered-room rule also bind the CLI, or only pins and hookless places) and CD3-M12 (is the `.mcpb` a tenth lockstep place or a checked release artifact).

Unowned items found (no phase holds them; no question yet): SEED-173 items (e) the `cowork` label in 819 files and 2 enums, and (g) the doc sweep of the old three-surface text; the Jev voice run after K1 (400.1-RESEARCH.md:319); 400.3 plans 04, 07 and 10 to 16; the 5 open human items of 400.4-VERIFICATION.md and the wicked cut-off of Phase 400.

### UNVERIFIED items

1. Whether the Desktop chat or the Code tab honours `_meta["anthropic/alwaysLoad"]` from an extension server (C1, C2).
2. Whether theo-context and theo-mcp hold the same steps for a framework; theo-context coverage of the 38 registry frameworks (C8).
3. The tool prefix of the mos-desktop copy (`plugin_mos_` or `plugin_mos-desktop_`) (C6).
4. Whether the step-block hash of Step 9.5 changes when the mcp-server-brain lines go (the block holds release.sh:1122-1147; the hash file lists Step 9.5 at its line 134; the hash was not recomputed here).
5. Whether the 401 bulk edit moves the vi3 byte pins and the 353 band (C21, GUESS).
6. Whether an `mcp_tool` hook can call a deferred tool (400.5 against 402).
7. The owner ruling that defers 400.5: stated by the coordinator; not found in ROADMAP.md or STATE.md on this branch.
8. The counts GOVERNED 69 and PURE_READ 7: taken from 405-CONTEXT.md PA-2; the two arrays were located (graph-catchup-spawn.cjs:40, :113) but not counted here.
9. How the chat lists skills, and whether `disable-model-invocation` or a 200 B description cap hides a command there (C22).
10. Every 405 spike question SP1 to SP8 (405-DESIGN section 6) and the 20 items of 405-RESEARCH.md section 8.
11. The 400.1 numbers on today's tree: measured at 35afa6d; re-run here only for the frontmatter split (253 of 255), the instructions length (2,000 B), the `continue:false` line (:876), the unscoped-name file count (115) and the mcp-server-brain reference count (54).
12. No test suite was run for this review.
