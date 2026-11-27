---
kind: handoff
date: 2026-11-27 (evening)
from: session jsagi-b3
for: the next session that runs the 401 to 405 overnight plan
---

# Handoff: restart the 401 to 405 run from here

## Read first (in this order)
1. `401-405-E2E-PLAN.md` (this folder): stages A to J, cuts 1 to 4, lanes L1 to L8, understandings U1 to U12, tonight's steps, safety rules.
2. `405-CONTEXT.md`: owner rulings OR-1 to OR-25 and peer agreements PA-1, PA-2 (all LOCKED).
3. `401-405-PROGRAM.md`: islands, the sea, contradictions, readiness (second pass).
4. `405-DESIGN.md` (r5; r5.1 was in work: Shape F contract v2 and the 15 research rules), `405-GENUI-RESEARCH.md`, Goldfish reports R1 to R4.

## Worktrees and branches (all pushed unless noted)
- `/home/jsagi/dev/MindrianOS-Plugin-405`, branch `work/405-desktop`: all planning files; merged with origin/main.
- `/home/jsagi/dev/MindrianOS-Plugin-401f1`, branch `work/401-f1-frontmatter`: F1 plan in `.planning/quick/261127-f1a-frontmatter-split-fix/` (check whether the plan file exists; not pushed).
- `/home/jsagi/dev/MindrianOS-Plugin-402small`, branch `work/402-cardfire-startcap`: K4 and F2 plan in `.planning/quick/261127-k4f-cardfire-and-start-cap/` (check; not pushed).

## State of each lane when the session stopped
- L1 405 design: r5.1 is DONE and committed (Shape F contract v2 in 3.12.2; the 15 research rules in 3.12.5; one click mechanism: the app-only tool `gate_click`; tool count 76 to 79). NEXT: one narrow Goldfish round 5 (codebase-details and implementation-readiness) on 3.2, 3.2b, 3.5, 3.11, 3.12.2, 3.12.3, 3.12.5 and slices 4b and 12 to 14; resolve; then thin plans for the build slices after the spike verdicts.
- L2 405 slice 0: plans `405-00a-PLAN.md` (offline kit) and `405-00b-PLAN.md` (owner script) were being written; check they exist, else re-plan from design section 6.
- L3 and L4: plans being written (see above); then gsd-executor on each branch; no merge before "CUT DONE".
- L5 designs: 401 and 402 Elephants were writing `401-*/` and `402-*/` CONTEXT, RESEARCH, DESIGN in the 405 worktree; check which files exist; then one Goldfish round each. 403 Plan B and 404 start after contract v2.

## Gates that still hold
- Main is frozen until jsagi-42 sends "CUT DONE" (beta.95). Branches only.
- No 405 build before 367-11 and 367-12 are on origin/main and before the owner's Desktop spike session.
- Owner still to do: the Desktop test session (kit from L2); answer O11 only if the ChatGPT leg needs a remote route.

## Open owner items
None waiting. O11 (remote route for ChatGPT web and mobile) stays unruled; default: not in 405.

## Update: Phase 401 design is written (2026-11-27 late)
- `.planning/phases/401-hygiene-and-cheap-context-cuts/`: 401-CONTEXT.md, 401-RESEARCH.md, 401-DESIGN.md (7 slices; F1 separate). Slice 1 (keep-list guard test and measuring script) may run any time; slice 2 (remove mcp-server-brain/) after F1 and owner items; slices 3 to 7 wait for the 405 foundation (table in the design).
- NEXT: one narrow Goldfish round on 401-DESIGN.md (attack points in its section 10).
- Owner items O1 to O7 for the next owner card (each with a recommendation in 401-DESIGN.md section 9): O1 keep the name mcp-server-brain in history and guard checks (yes); O2 /mos:admin runs one file in that folder: move it to scripts/ (move); O3 delete 2 one-time migration scripts and make the 2 Brain write tools answer "retired" (yes); O4 remove the retired Pinecone tool from 3 agent tool lists (yes); O5 remove 6 expired commands after the 405 foundation, 113 to 107 (yes); O6 description limit 300 B (300 B); O7 move the nav-block trims to Phase 402 (yes).
- Facts worth keeping: `stamp-firing-block --check` exits 1 today with 11 pending files (cause unverified); lib/memory/brain-server-resolution.test.cjs is red today (3 of 5); measured tool surface 86,250 B against the test-270 pin 85,599.

## Update: Phase 402 design is written (2026-11-27 late)
- `.planning/phases/402-lighter-runtime/`: 402-CONTEXT.md, 402-RESEARCH.md, 402-DESIGN.md (r1, not reviewed; 11 slices). Group A now on branch work/402-cardfire-startcap (K4 plus 400.3-09; F2 cap). Group B after the 405 foundation, spike SP9 and a floor re-read. Group C also needs 400.5 plan 02 on main.
- NEXT: one Goldfish round on 402-DESIGN.md (reading list in its section 13).
- Owner items (recommendations in 402-DESIGN.md section 12): 1 hot list of 23 tools in place of 18 (accept); 2 keep the Eureka tools listed and deferred (keep); 3 host below the floor: doctor warning only (doctor only); 4 opt-in process skills: narrow (narrow).
- Fix for 405: design section 6 SP9 probe uses a guessed "deferral mark"; the correct mark is `_meta["anthropic/alwaysLoad"]: true` on the up-front tools, with no server-level key.
- Facts: measured deferral saving is about 13.7k tokens (not 15.5k); the 400.1 research expires 2026-12-08; test-127-00 has 2 failures at base (bin/ paths), not a 402 item.

## Update: 401 F1 plan is written, staged (2026-11-27 late)
- A hook (worktree path guard) stops a session whose cwd is the 405 worktree from writing into another worktree. The planner did not bypass it. The plan is staged at `.planning/phases/401-hygiene-and-cheap-context-cuts/401-F1-PLAN-staged.md` with `401-F1-PLAN-staged.README.md` (baselines, red-before tests, 8 risks).
- NEXT: start a session with cwd /home/jsagi/dev/MindrianOS-Plugin-401f1, copy the staged plan to `.planning/quick/261127-f1a-frontmatter-split-fix/261127-f1a-PLAN.md`, then run the executor there with `NODE_PATH=/home/jsagi/dev/MindrianOS-Plugin/node_modules` (the worktree has no node_modules; the pre-commit hook needs them). Same rule for the 402 small-fix branch: run its planner and executor with cwd /home/jsagi/dev/MindrianOS-Plugin-402small.
- Measured: 253 of 255 surface files offend (383 lines); host-read keys today: hitl_shape 197 of 210, hitl_stages 29 of 34, allowed-tools 118 of 227.
- OWNER NOTE before a release: after F1, allowed-tools becomes host-read in 109 more files (Bash in 105, Write in 91). The plan lists it in its SUMMARY; the owner reads it before the cut.
- Red before F1 (not caused by it): harness manifest check (decide_engine digest), tests/test-3696-voice-first-budget.cjs V7, tests/test-201-harness-manifest.cjs, tests/test-234-dist-bundle.cjs.

## Update: 405 slice 0 plans are written (2026-11-27 late, commit 419522569)
- `405-00a-PLAN.md` (autonomous: probe kit under .planning/spikes/405-desktop/, real payload measure, pack tool pin, 405-SPIKES.md with 30 verdict rows) and `405-00b-PLAN.md` (owner half: package check, pack, ONE Windows Desktop session of 61 numbered steps, verdicts). 30 legs (29 required plus the optional ChatGPT leg). They follow design r5.1.
- NEXT: run the plan checker, then execute 405-00a.
- OWNER DECISIONS before 00b: (1) approve installing the one new build tool `@anthropic-ai/mcpb` 2.1.2 (the plan has a blocking check; the .mcpb files do not exist until then); (2) the test session is realistically 2 to 3 hours, not 45 to 60 minutes (61 steps); (3) the measured payload may exceed the 4,500-file cap, which then comes to the owner before the session.
- Design gaps the planner reported (not filled; the design lane fixes them in an r5.2): G1 package names (the repo pins @modelcontextprotocol/server, core, client 2.1.0 and ext-apps 2.0.3), G3/G4 prune rules for the payload, G5 the real room server never runs on Desktop in slice 0, G7 mcpb 2.1.2 manifest facts (user_config needs description; one server per manifest, so the two-server leg SP7e is likely B), G8 `s1_where` should print the value of CLAUDE_CODE_ENTRYPOINT, G9 SP2b pass rule, G12 how the probe card loads the ext-apps client, G13 no LIVE check of the rooms-home setting, G17 raw owner-machine output must not go into a tracked file of a public repo, G18 session time.
- origin/main has 1 commit the 405 branch does not hold (75826d3cd); merge before building.
