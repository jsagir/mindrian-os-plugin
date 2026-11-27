# Quick 261127-bnd: SUMMARY

## OR-47, the 4 points for this build

Written before the first edit of a tracked file.

1. What a top professional does here that the tasks do not ask for.
   - Read each script path that a new flag touches from end to end before the edit, and confirm that a refused input exits before the first write or the first network call. The tasks state the order; a professional proves the order with a test that looks at the file system after the refusal.
   - Make each red test fail for the stated reason, not for a setup error. Read the red log line by line before the fix, and confirm that each red case names the defect.
   - Keep the diff of each script small and local, so that a reviewer reads one block per script.
   - Do not trust a pinned count from the plan without a fresh run. Measure the baseline again in this worktree before the first edit (Task 1 Step 6).

2. The rawest material that the build starts from.
   - The source files on origin/main at the base commit (scripts/rs-explain-command.cjs, lib/core/graph-ops.cjs, lib/core/lazygraph-ops.cjs, lib/mcp/tool-router.cjs, lib/core/intel-pipeline.cjs, the 9 scripts of the shell lines, the command files).
   - Real runs of each script in a temp home, with a payload file and a canary check, and real runs of the existing tests.
   - The acceptance roll-up output of this worktree (doctor-before.txt), not the summary in the plan.

3. The methods and the tools.
   - Test first: a new test file per group, a red log saved before each fix, then the fix, then the green run.
   - Child processes with a temp HOME, USERPROFILE, MINDRIAN_HOME and MINDRIAN_ROOMS_HOME; a stub fetch; a stub curl first on PATH; no network.
   - `bash -c` with a fixed line and temp paths only, to prove that a payload in a file runs nothing.
   - node:sqlite read-only handles and a first-keyword rule for graph-query.
   - The mirror generator scripts/build-skill-mirrors.cjs in write mode; never a hand edit of a mirror.
   - The verify commands of the plan through the helper file verify-prelude.sh; one commit per task with explicit paths and the pre-commit hook.

4. What, other than the builder and a reviewer, shows that the result is right.
   - The records of the section "Outside evidence" of the plan, made by the main session with probes written before the build: (a) the 15 shell lines with a `$(touch MARKER)` payload and a backtick payload, 0 MARKER files at HEAD and a MARKER file at origin/main; (b) the remote leg of rs-explain under a recorder of net, tls and fetch, 0 lines at HEAD; (c) the sha256 of a seeded room.db before and after an UPDATE, a DELETE and a VACUUM INTO through the CLI graph query; (d) the acceptance roll-up in the environment of the main session, 25 of 25.
   - The acceptance roll-up before and after in the same temp home (gate G4).
   - The pre-commit hook and the existing regression tests, which this build does not edit (except the 2 named assertion sets).
   - These records are OPEN. The builder does not write them.

## Build record

STATUS: DONE (Tasks 1 to 10 done; the SUMMARY is the last commit)

- Worktree: MindrianOS-Plugin-bnd. Branch: fix/261127-boundary. Base: 88c8306e7 (origin/main).
- `npm ci --ignore-scripts` changed no tracked file. Node v22.23.1. zod loads.

### Task 1 (no commit)
- Acceptance before the first edit, temp home doctor-home: `Acceptance full: 21/25 points passed; failed: install-state, version-of-record-published, session-start-active-version, activation-reached-the-wire.` The plan expected 20 of 25; deployment-surfaces passes here. The done rule uses the PASS set, so the gate now watches 21 points.
- Preflight verify: PREFLIGHT-OK (substrate 202, 5 generator checks, 12 red-before results, 52 anchors).

### Task 2, F1 rs-explain: commit 751ff6cf3
- Red: `261127-bnd rs-explain: 2 passed, 8 failed`. Green: `261127-bnd rs-explain: 10 passed, 0 failed`. 89.5-05 suite: `6/6 passed`.
- DEVIATION from the plan: the plan expected `3 passed, 7 failed` with D2 green today. D2 is red today: 2 fetch calls, the second is `brain_query` with `params.room_slug` = `solarlocker`, with CLAUDE_ACTIVE_ROOM set before the first require. Cause (PROVEN by code read): lib/core/brain-client.cjs `query()` classifies only `{ cypher }` with the Part 8 guard; the room slug travels in `params`, so the room lexicon never sees it. The fix (leg removed) makes D2 green. The verify of Task 2 ran with `red rs-explain 2 8` and printed TASK2-OK.
- Fetch calls before and after: D1 2 then 0; D2 2 then 0; D3 2 then 0; D4 2 then 0; D5 0 then 0.
- Moved assertion set 1 of 2: T3 of lib/memory/test-rs-explain-command.cjs, to the values of the plan.

### Task 3, F2 F3 F12 F14 F16 and the 2 twins: commit bec88e76c
- Red: `261127-bnd command-text: 2 passed, 10 failed` (red: B1 B3 B4 B5 B6 B7 W1 M1 M2 U1, as the plan). Green: `261127-bnd command-text: 12 passed, 0 failed`.
- tests/test-363-command-contract.cjs: `PASS: 4 FAIL: 4` without the allowance (P1 named commands/whitespace.md section `## Subcommand: external`), `PASS: 5 FAIL: 3` with it. Moved assertion set 2 of 2: the P1 allowance.
- Verify of Task 3: TASK3-OK.

### Task 4, shell lines A (research-speaker, room-registry, create-speaker-profile): commit da84360f3
- Red: `261127-bnd shell-args-bash: 4 passed, 11 failed` (red: S1 S2 S3 S5 R1 R2 R3 R5 R6 P1 P2, as the plan). S2 was red because S1 gave no token (the file form did not exist). Green: `15 passed, 0 failed`.
- The 8 instruction lines were copied from the plan section "New text (exact)" by line number, not typed. The 3 mirrors came from `node scripts/build-skill-mirrors.cjs`.
- Verify of Task 4: TASK4-OK (the 13 regression tests and tests/test-234 `18 passed, 1 failed`).

### Task 5, shell lines B (claim-checks, room-question, rs-experts): commit 6620d1648
- Red: `261127-bnd shell-args-text: 4 passed, 9 failed` (red: Q1 Q2 Q3 C1 C2 C4 X1 X2 D1, as the plan). Green: `13 passed, 0 failed`.
- The 11 instruction lines were copied from the plan section "New text (exact)" by line number. The 2 mirrors came from the generator.
- Verify of Task 5: TASK5-OK (the 11 regression tests; tests/test-358-b2-part8.cjs `passed=6 failed=1`).

### Task 6, shell lines C (bank-opportunity, version-log, file-pack): commit daaf370da
- Red: `261127-bnd shell-args-json: 3 passed, 9 failed` (red: B1 B2 B3 V1 V2 V3 F1 F2 D1, as the plan). Green: `12 passed, 0 failed`.
- The 5 instruction lines were copied from the plan section "New text (exact)" by line number. skills/conversation-mode/SKILL.md is hand-written; the generator left it as edited and wrote the 2 mirrors (bono, dominant-designs).
- close-loop: the 4 refusal reasons were added at the end of `REFUSAL_REASONS`; `version-log` now requires exactly one of `--topic` and `--topic-file` in `parseFlags` (UsageError, exit 2).
- Verify of Task 6: TASK6-OK (the 13 regression tests; tests/test-209 stays red).

### Task 7, F17 the first input: commit 08493ce74
- Scan before the edit: 390 files, 882 shell lines; P1 1 hit (references/personality/agent-operations.md:63); P2 16 pairs, 16 occurrences; P3 32 files, 38 lines; P4 0 hits; P5 12 entries, 12 lines. These are the counts and entries of the plan section "Scan rule for shell lines".
- Red: `261127-bnd shell-text: 8 passed, 2 failed` (red: X1 X2, as the plan). Green: `10 passed, 0 failed`.
- Lines 63, 64 and 69 of the reference are equal to the plan section "New text (exact)" (diff: no difference). The file keeps 89 lines.
- Verify of Task 7: TASK7-OK (354, 356, part8-leak, handoff, 115 keep their results; 359 `16 passed, 2 failed`, 3696-voice `PASS: 11 FAIL: 1`, 3696-doctrine `PASS: 25 FAIL: 1`).

### Task 8, F7 graph-query: commit 5e7952ced
- Callers of graph-ops `queryGraph(roomDir, sql)`: exactly lib/mcp/tool-router.cjs and scripts/mindrian-tools.cjs (search over lib, scripts, bin, hooks, commands, agents, references, pipelines). The other hits are `lazygraph.queryGraph(conn, ...)`.
- Red: `261127-bnd graph-query: 5 passed, 11 failed` (red: Q1 Q2 Q3 Q4 Q5 Q6 Q9 Q10 Q12 Q14 Q16, as the plan). Green: `16 passed, 0 failed`. 0 fetch calls.
- graph-ops keeps the same count of `openGraph(` lines. lazygraph `queryGraph` is not edited.
- Verify of Task 8: TASK8-OK (the 11 regression tests equal their baselines; no fixture and no byte pin changed).

### Task 9, F8 intel-pipeline and F10 orchestration admin: commits e38c83df3 (A) and 8ebfc551b (B)
- Red: `261127-bnd intel-gate: 3 passed, 2 failed` (red: G1 G5) and `261127-bnd admin: 1 passed, 3 failed` (red: A1 A2 A3; A1 showed 15031 characters on cli), as the plan. Green: `5 passed, 0 failed` and `4 passed, 0 failed`.
- intel-pipeline: 1 line assigns `gateFn` (default `{ approved: false }`) and 1 new boolean `gateSupplied`; the calibrate gate halts with the fixed disclosure when no gate was supplied. The dry-run return stays before the first gate.
- tool-router: `ADMIN_NOT_AVAILABLE_LINE` near `NO_WRITE_MARKER`; the `admin` branch directly above the comment "All other orchestration commands use reference-based pattern". `ORCHESTRATION_COMMANDS`, the description and the schema are not edited.
- Verify of Task 9: TASK9-OK (the 9 regression tests keep their results; 267 `RESULT: PASS=2 FAIL=2`).

### Task 10, the runner and the gate: commit 6450a9113
- tests/run-all-261127-bnd.sh has 78 legs; each leg runs in its own temp home. The list of the 56 files of the dash leg is equal to `git diff --name-only origin/main..HEAD` plus the runner (diff: no difference), and to the frontmatter list `files_modified` of the plan.
- G2: the first run printed `PASS=77 FAIL=1`: the leg of the rs-explain test named a wrong file (tests/test-261127-bnd-rs-explain.cjs; the real file is tests/test-261127-bnd-rs-explain-local.cjs). The path was corrected before the commit. The second run printed `PASS=78 FAIL=0`.
- G3: acceptance after the last task commit, the same temp home doctor-home: `Acceptance full: 21/25 points passed; failed: install-state, version-of-record-published, session-start-active-version, activation-reached-the-wire.` (equal to the before-run).
- G4: prints nothing. The 21 points that passed before pass after.
- G5 at the end of Task 10: 10 lines, each with `(quick-261127-bnd)`. `git status --porcelain --untracked-files=no` printed nothing.
- The 12 red-before tests keep their results (the verify of Task 10).
- Verify of Task 10: TASK10-OK.

### Change of the commit count (decision of the main session)
- The SUMMARY is the last commit, after Task 10. So the commit count of gate G5 and of the Task 10 verify is "10 task commits plus 1 SUMMARY commit": `git log --format=%s origin/main..HEAD` prints 11 lines, each with `(quick-261127-bnd)`. The Task 10 verify ran (TASK10-OK) before the SUMMARY commit, when the count was 10.

### Decisions of the main session on the first report (recorded here as ordered)
- The Task 2 deviation is accepted: the red set of rs-explain is `2 passed, 8 failed`; the plan fact "the room lexicon blocks the room name" was false (the room slug went out in `params`, which the guard does not read). Use `red rs-explain 2 8` wherever a later verify reads that red log.
- The acceptance gate watches the 21 points that passed before the first edit.
- The commit count of gate G5 and of the Task 10 verify is "10 task commits plus 1 SUMMARY commit" (11 lines). The SUMMARY commit is the last commit, after Task 10.

### Open
- The records of the section "Outside evidence" (a) to (d): OPEN, for the main session.
