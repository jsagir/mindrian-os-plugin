---
quick_id: 261127-f1a
plan: 401-F1-PLAN-r3.md (with the binding checker edits C1 to C4)
branch: work/401-f1
status: NEEDS_HUMAN (part 3 of 3 done; 1 open item: tests/test-391-agent-tools-naming.cjs leg A1)
---

# 261127-f1a SUMMARY (draft)

## OR-47 pass, Task 1

Written before the first edit of Task 1.

1. What a top professional does here that the task does not ask for: record the full baseline (acceptance, 13 gates, test sweep) before any new file exists, so each later difference has a cause. Write each rule once, in one module, and make every test and codemod require that module. Make each red leg carry a `count:` line, so a red test fails for the planned reason and not for a syntax error. Put a mutation arm on each rule, so the rule can fail.
2. The rawest material: the 255 surface files on disk at BASE (commands/*.md, skills/*/SKILL.md, agents/*.md), their bytes read through `git cat-file blob`, and the host rule that the host ends frontmatter at the first triple dash after line 1. Not a summary of another agent.
3. Methods and tools: node:fs, node:path, node:crypto and node:child_process only; byte compares on buffers (no text decode) for rule B; the `frontmatterBounds` and `computeExpectedMirror` functions of scripts/build-skill-mirrors.cjs for the mirror leg; awk counts of Task 0 as an independent second count; exact leg-line compares in the verifier.
4. What, other than the builder and the reviewer, shows that the result is right: the outside evidence (a) to (e) of the plan, run by the main session after the build: (a) a recorded headless host run for diagnose, scout and rs-explain at BASE and at the tip; (b) an independent fixture compare script with its own parser and the host rule, with rule B over 255 files; (c) both check scripts on a clean `git archive` export from another directory; (d) the live check AC3a.4; (e) the acceptance roll-up in the main session environment at the tip and at BASE. All 5 are OPEN.

## Task 0 values (PROVEN)

- Worktree: the f1 worktree; branch work/401-f1; tree clean.
- BASE: db86107751459055f0bfd086db45f2655ba41533 (= stage/400.5-405 = HEAD at start).
- Install: node_modules was present before this session (git ignores it). gray-matter and zod resolve. package.json and npm-shrinkwrap.json are unchanged. `npm ci --ignore-scripts` was NOT run: the executor limit says no network. Deviation recorded.
- Ancestry: 88c8306e7 is an ancestor (exit 0); fix/261127-boundary is an ancestor (exit 0); work/402-cardfire-startcap is an ancestor (exit 0).
- Boundary fix files: 4 of 4 exist. Card-fire fix files: 4 of 4 exist. Subject counts: `(quick-261127-bnd)` 14 (expected 10 or more); `fix(402-k4): card-fire block continues the turn` 1.
- Required files exist; the 5 forbidden paths do not exist.
- Counts: commands 113, skills 125, agents 17; offenders `253 files 383 lines`; allowed-tools 227; Brain entries `22 entries in 10 files`; `host-read 118 dead 109`; doctor.cjs mentions of the 2 checks 0; release.sh pre-tag lines 7.
- Shared surface files: 27, equal to the 27 paths of the plan; frontmatter bytes equal on both sides in 27 of 27. List: evidence/shared-surface.txt.

## Task 1 record (PROVEN)

- Acceptance before (temp home `doctor-home`): `Acceptance full: 21/25 points passed; failed: install-state, version-of-record-published, session-start-active-version, activation-reached-the-wire.` Difference from the plan: the plan ASSUMED 20 of 25 with deployment-surfaces red; here deployment-surfaces passes. Recorded, not corrected.
- Gates before (evidence/before/G*.txt): G1 to G13 all exit 0. G3: 55 advisory violations. G6: 195 wired, 2 excluded, 0 unwired. G8: 113 scanned, 39 warnings. G11: PASS=79 FAIL=0. G12: PASS=6 FAIL=0. G13: Phase 402: PASS=23 FAIL=0 SKIP=0. G2 exits 0 (dependencies present).
- Sweep before: 813 candidate tests; 96 non-zero (3 exit 77: test-261119-g5g-get-mindrian, test-380-build, test-380-installed-layout; 93 exit 1). List: evidence/red-before-list.tsv; failing lines per test: evidence/red-before.txt.
- Named red-before: test-3696-voice-first-budget red on leg V7 (as planned); test-201-harness-manifest green (as expected); test-234-dist-bundle red on 4 checks (as planned).
- Sweep dirt, restored: .planning/DRIFT.md (tracked, modified; diff saved to evidence/sweep-before-drift.diff), 6 deleted files under tests/fixtures/sample-room-personas/personas/ (restored), 1 untracked file test-fixtures/feynman/sections/fixture-small/problem-definition/BRIEF.md (deleted; it did not exist before the sweep). Text: evidence/sweep-before-dirt.txt.
- Fixture: `write-fixture: host-read 118 files 449 entries; pending 109 files 516 entries`. Leg G3 passes.
- Red leg lines equal the plan, byte for byte: T `FAIL: T1 FAIL: T2 ok: T3 FAIL: T4 ok: T5 ok: T6 ok: T7 ok: T8`; G `FAIL: G1 FAIL: G2 ok: G3 ok: G4 FAIL: G5 ok: G6 ok: G7`; Q `FAIL: Q1 FAIL: Q2 FAIL: Q3 ok: Q4 ok: Q5 ok: Q6`; R `FAIL: R1 ok: R2 FAIL: R3 ok: R4`. Counts: `count: G1 4 count: G2 109`, `count: Q1 22 count: Q2 22`. Q1 text: 22 lines in 10 commands, 10 lines in 10 skills. Q2 text: 22 entries in 10 commands, 22 in 10 skills, 0 in agents.
- check-frontmatter-split --check: `253 of 255 files offend (commands 112 of 113, skills 124 of 125, agents 17 of 17; 383 lines)`.
- Census before: repo hitl_shape 210, hitl_stages 34, allowed-tools 227, pending 0; host 197, 29, 118, 0.
- Rule B on the unchanged tree: `body-bytes: OK (255 files; 0 differ; base db8610775...)`.
- Commit: a9fa05b52 (11 files).

## Task 1 notes

- Pre-check of Tasks 2 and 3 on a temporary `git archive` export in /tmp (not the worktree): all planned counts of Task 2 step 2 to 5 and Task 3 steps 3 to 6 reproduced (22 deleted in 10; 55 renamed; numstat 57 files +55 -77; 56 mirrors; 54 pending mirrors; fix 142 files 208 lines; 124 skill files; census compare OK; host totals after 210, 34, 118, 109; body-bytes 0 differ). This is a dry run, not evidence for the branch.
- Defect found and fixed before the commit: `--census` and `--print` called process.exit after a large write, which cut piped output at 64 KiB. They now set process.exitCode.
- Leg G7 arm (f) failed once on the first run after the fixture write, then passed in 3 reruns. Cause not found. The failure text now prints both exit codes, both byte counts and the first differing line. Open item: watch arm (f).
- Leg T7 arm (a): a frontmatter line that is exactly three dashes is the closing fence, and a frontmatter with the pending key is never renamed. So the trap frontmatter holds the comment, the key and the Brain entry; the body holds all 4 trap forms. The tool-grants codemod is called with inPending true on that text.
- `--write-fixture` uses node:child_process for `git rev-parse HEAD` only (generated_from).

## OR-47 pass, Task 2

Written before the first edit of Task 2 (part 2 of 3; continuation run; Task 0 steps 1 to 6 passed again: BASE db8610775, ancestry exit 0 for 88c8306e7, fix/261127-boundary and work/402-cardfire-startcap; 8 of 8 fix files; subject counts 14 and 1; red state saved to red/task2-pre-*.txt and equal to the Task 1 lines).

1. What a top professional does here that the task does not ask for: change the grant state while the lists are still dead text, so no commit of the branch holds a live list that the fixture does not hold. Prove the shape of each changed line with `git diff -U0` (only a key line or a deleted Brain entry), not only the counts.
2. The rawest material: the 57 command files on disk and their 56 generated mirrors, and the fixture data/tool-grants.json of commit a9fa05b52.
3. Methods and tools: the 2 codemods of Task 1 (pure functions, `--write` then `--check`), the unchanged mirror generator, the exact-set check script, the body-bytes proof against BASE, gates G1 to G13 in the temp environment.
4. What, other than the builder and the reviewer, shows that the result is right: outside evidence (b) (an independent parser over BASE and the tip; checks 1 to 4 are the grant state of this task) and (c) (the check scripts on a clean export). Both OPEN.

## Task 2 record (PROVEN)

- Rule A1: brain-name-codemod `--write` reported `22 deleted entries in 10 commands`; second run `0 deleted entries in 0 commands`; numstat 10 files +0 -22.
- Pending key: tool-grants-codemod `--write` reported `55 changed files`; second run `0 changed files`; numstat 57 files +55 -77.
- Mirrors: build-skill-mirrors overwrote 56; `--check` OK (112 mirrors); `git status --short skills` 56; 54 mirrors with `^pending_tool_grants:`; skills/diagnose/SKILL.md has 0 `^allowed-tools:` lines.
- Leg lines: R `FAIL: R1 ok: R2 ok: R3 ok: R4`; G all 7 ok; Q `ok: Q1 ok: Q2 FAIL: Q3 ok: Q4 ok: Q5 ok: Q6`; T unchanged `FAIL: T1 FAIL: T2 ok: T3 FAIL: T4 ok: T5 ok: T6 ok: T7 ok: T8`.
- check-tool-grants --check: `tool-grants: OK (255 files; host-read 118 files 449 entries; pending 109 files 516 entries)`.
- Rule B (mid): `body-bytes: OK (255 files; 0 differ; base db8610775...)`; 27 of 27 shared paths have `body-equal` (evidence/mid/body-bytes.txt).
- Line shape: every changed line of the 57 commands is `-allowed-tools:`, `+pending_tool_grants:` or `-  - mcp__mindrian-brain__...`; 0 hunks below the closing fence.
- Census mid: repo hitl_shape 210, hitl_stages 34, allowed-tools 118, pending_tool_grants 109; host 197, 29, 118, 0.
- Gates mid (evidence/mid/): G1 to G10, G12, G13 exit 0 (equal to before). G3 55 violations; G6 195 wired, 2 excluded, 0 unwired; G8 113 scanned, 39 warnings (all equal to before). G11 exit 1 (`PASS=76 FAIL=3`), red legs: (1) tests/test-3692-four-commands.cjs FC1b, which compares the frontmatter with `git show HEAD`: it was red only before the commit; after commit dbcf159a0 it passes (13 of 13, evidence/mid/test-3692-after-commit.txt); (2) tests/296-rs-experts-degrade.test.cjs (line 50 reads the key `allowed-tools` of commands/rs-experts.md: cause (d)); (3) tests/test-361-command-contract.cjs (`allowed-tools must include Task`: cause (d)). Items 2 and 3 go to Task 4.
- Commit: dbcf159a0 (113 files; pre-commit hook passed).

## OR-47 pass, Task 3

Written before the first edit of Task 3.

1. What a top professional does here that the task does not ask for: run the grant check before and after the comment fix and require the same line, so the fix cannot turn a list live. Compare the census per file (lines, body digest, non-comment digest), not only totals. Keep the 2 Larry surfaces and the manifest in their own commit so the manifest digest change has one cause.
2. The rawest material: the 142 source files and the 111 mirrors on disk after commit dbcf159a0, and the 2 lines.push calls of scripts/build-new-surface.cjs.
3. Methods and tools: the fixer `--fix` of scripts/check-frontmatter-split.cjs (column-0 comment lines between the fences only), the unchanged mirror generator, `--census-compare` against census-mid.json, the body-bytes proof, build-harness-manifest.
4. What, other than the builder and the reviewer, shows that the result is right: outside evidence (a) (the host run for diagnose, scout and rs-explain, 25 of 25, 22 of 22 and 26 of 26 keys after), (b) and (c). All OPEN.

## Task 3 record (PROVEN)

- Guard before the first edit: check-tool-grants `--check` exit 0 (same line as Task 2). Red output of leg T4 saved: red/task3-pre-test-401-frontmatter-split.txt (`renderSurface 1 offenders, renderExcludedExpertSkill 1 offenders`).
- Generator: 2 lines.push calls of scripts/build-new-surface.cjs (lines 208 and 253) now write `# == ... ==`; numstat 2 +2 -2; leg T4 ok. Commit a3a7c2ea5. Tests that require the generator: test-203-skill-materialize, test-261127-bnd-shell-text, test-harness-167-part8-leak green; test-harness-167-verdict (D-167-06) and test-new-surface-generator (Test 3) red with the same failing legs as the base sweep; test-364-command-contract red on C1 and C11 (green at base): cause is the Task 2 key rename (scientific-roadmap is 1 of the 55), so cause (d), Task 4.
- Known limit: a caller description that holds `---` still gives a split file from the generator.
- Fixer: `fixed: 142 files, 208 lines` exit 0; second run `fixed: 0 files, 0 lines`; no UNFIXABLE line.
- Mirrors: 111 overwritten; `--check` OK (112); `git status --short skills` 124.
- check-frontmatter-split --check: `frontmatter-split: OK (255 files)`. Numstat: 253 files, +383 -383, 0 rows with unequal counts.
- census-compare against census-mid.json: `census-compare: OK` (evidence/after/census-compare.txt). Census after: repo and host both hitl_shape 210, hitl_stages 34, allowed-tools 118, pending_tool_grants 109 (evidence/census-after.json).
- Rule B (Task 3): `body-bytes: OK (255 files; 0 differ; base db8610775...)`; 27 of 27 shared paths `body-equal` (evidence/after/body-bytes-task3.txt).
- Grant state after the comment fix: `tool-grants: OK (255 files; host-read 118 files 449 entries; pending 109 files 516 entries)` (equal to Task 2).
- Manifest: `--check` exit 1 before regeneration, 0 after; 2 digests changed: cli_agent (agents/larry-extended.md) and personality_skill (skills/larry-personality/SKILL.md); no other entry (evidence/after/manifest.diff).
- test-401-frontmatter-split: 8 passed, 0 failed. Q leg line `ok: Q1 ok: Q2 FAIL: Q3 ok: Q4 ok: Q5 ok: Q6`.
- Commits: A f920ca620 (251 files, +381 -381); B 2a772e4db (3 files). Pre-commit hook passed for each. Task 3 automated verify exit 0.

## OR-47 pass, Task 4

Written before the first edit of Task 4 (part 3 of 3; continuation run; Task 0 steps 1 to 6 passed again: BASE db8610775, ancestry exit 0 for 88c8306e7, fix/261127-boundary and work/402-cardfire-startcap; 8 of 8 fix files; subject counts 14 and 1; tree clean).

1. What a top professional does here that the task does not ask for: re-pin a test by adding the second key to the read, never by removing an assertion, and prove each re-pinned test red before the edit and green after. Compare the failing leg names of every red-red test, not only the exit codes.
2. The rawest material: the saved outputs of the 813 swept tests at BASE (evidence/before/tests/), the same tests after the last commit, and the acceptance output of the same temp home.
3. Methods and tools: the sweep script and the gate script of bin/, the acceptance roll-up in the temp home doctor-home, comm over the 2 PASS sets (A4), the body-bytes proof against BASE, the 3 idempotence runs.
4. What, other than the builder and the reviewer, shows that the result is right: outside evidence (e) (the acceptance roll-up in the main session environment at the tip and at BASE) and (b) and (c). All OPEN.

## Task 4 record (PROVEN)

- Gate registration: scripts/doctor.cjs, point coverage-gate, 2 entries after `skill-mirrors` (`frontmatter-split`, `tool-grants`), the reason comment, and the 2 names in the label. numstat 1 file +8 -1. Red before: red/task4-pre-release-order.txt (`FAIL: R1`). After: `ok: R1 ok: R2 ok: R3 ok: R4`; tests/run-all-401.sh `PASSED=4 FAILED=0 SKIPPED=0 KNOWN=0`. Commit 02a5f2202.
- Sweep after (evidence/tests-after.tsv, evidence/after/tests/; classes in evidence/sweep-classes.tsv): 813 tests; green-green 704, red-red 96, red-green 0, green-red 13. Each green-red test was red again when run alone (evidence/after/rerun/).
- Sweep dirt after, restored by explicit path (the same paths as the before sweep): .planning/DRIFT.md (diff saved to evidence/sweep-after-drift.diff), the 6 files under tests/fixtures/sample-room-personas/personas/ (black, blue, green, red, white, yellow -healthbridge-marketplace.md), and the untracked file test-fixtures/feynman/sections/fixture-small/problem-definition/BRIEF.md (deleted).
- Red-red with a different set of failing legs (evidence/redred-diff.txt): tests/test-363-runner-contract.cjs (new leg K1) and tests/test-389-session-report.cjs (new Test 1 lines). Both were handled as green-red and re-pinned; after the re-pin each has the leg set of the base. Same leg names, changed text only: test-363-runner-contract K6 (the first offender is now scout.md, from the planned rule A1 deletion of its Brain entries), test-389-retire-brief Test 6 and test-389-session-report Test 5 (the offender list adds data/tool-grants.json, which names the mva files), test-3696-isolation B4d (marker path), test-384-perf-harness B9 (commit count).
- Re-pins (commit f6088ba98, 17 files, +73 -27; each red output is in evidence/after/tests/ or evidence/after/rerun/, each green output in evidence/after/repin/):
  - (a) tests/test-348-doctrine-present.cjs, the snapshot comment line.
  - (c) tests/test-3696-skill-budget.cjs leg S3; tests/test-3696-voice-first-budget.cjs leg V7 (stays red on exactly the 5 baseline lines: the quick 261108-es3 comment line and the 4 job keys); tests/test-400-job-sentences.cjs leg S7; tests/test-389-session-report.cjs Test 1.
  - (b) tests/test-370-commands.cjs leg C1: the frontmatter digests of grade and deep-grade; each live file equals the rename and the rewrite applied to its base blob (evidence/after/repin/370-commands-pin-proof.txt).
  - (d) tests/296-rs-experts-degrade.test.cjs, tests/test-361-command-contract.cjs, tests/test-364-command-contract.cjs (C1, C11), tests/test-4002-command-contract.cjs (C2), tests/test-265-swarm-task-grant.cjs, tests/test-289-menu-fence.cjs, tests/test-391-agent-tools-naming.cjs, tests/test-363-runner-contract.cjs (K1), tests/test-200-local-tier0.cjs (checker edit C2: both keys, comment lines skipped per checker edit C1, the block must not be empty; red proof red/task4-pre-test-200-empty-block.txt shows the empty block before).
  - (e) tests/test-370-doctor-gate.cjs leg G6, the label pin.
  - 400-LABEL-REVIEW.md lines 81 to 84 (0 after the comment; the 29 sorted paths; 29). tests/test-400-review-lists.cjs 4 passed.
  - tests/test-363-command-contract.cjs needed no re-pin (green after); leg P1 and the F12 allowance are unchanged.
- NEEDS_HUMAN item, not re-pinned: tests/test-391-agent-tools-naming.cjs leg A1 (`the scan read a plausible number of mcp__ tokens`, floor 40). Base 74 tokens; after this plan 30 with the cause (d) read (28 without it). 74 - 30 = 44 = the 22 Brain entries of the 10 commands plus the 22 of the 10 mirrors that rule A1 deleted. The floor depends on Brain entries in tool lists, so the plan rule "a test that expects a Brain entry in a tool list is not re-pinned here" applies. Legs before: all ok; after: A1 FAIL, the other 55 ok.
- Red before and red after, reported: tests/test-234-dist-bundle.cjs, the same 4 failing checks (generic bundle skill names, zed bundle skill names, bundled bodies byte-identical, shipped measurement); leg Q3 (dist/, 24 lines); lib/memory/brain-server-resolution.test.cjs red-red with the same failing legs.
- Gates after (evidence/after/gates/): G1 to G12 exit 0, equal to the base; G3 55 violations; G6 195 wired, 2 excluded, 0 unwired; G8 113 scanned, 39 warnings; G11 PASS=79 FAIL=0; G12 PASS=6 FAIL=0. G13: the first run exit 1 (`PASS=22 FAIL=1`; test-402-card-fire-lock-wait W2 latency above 4000 ms, L3 and L4 `holder did not start`) at a 15-minute load average of 14.8; 2 reruns alone exit 0 with `Phase 402: PASS=23 FAIL=0 SKIP=0` (G13-rerun1.txt, G13-rerun2.txt), equal to the base. This plan changes no file that this test reads. Leg G7 arm (f) did not fail in this part.
- Acceptance after (doctor-after.txt, same temp home): `Acceptance full: 21/25 points passed; failed: install-state, version-of-record-published, session-start-active-version, activation-reached-the-wire.` A4 printed nothing; the 2 PASS sets are equal (21 and 21). `PASS  coverage-gate:` with the 2 new names. Pre-tag JSON (doctor-pre-tag-after.json): rows frontmatter-split ok status 0 and tool-grants ok status 0.
- Final proofs: body-bytes `OK (255 files; 0 differ; base db8610775...)`, 27 of 27 shared paths body-equal (evidence/after/body-bytes-final.txt). Second runs: `fixed: 0 files, 0 lines`, `0 deleted entries in 0 commands`, `0 changed files`; `git status --short` empty. A5 prints 7. Task 4 automated verify (with checker edit C4) exit 0 (evidence/after/task4-verify.txt).

## Totals across the plan

- F1 offenders: 253 files 383 lines before; 0 after.
- Census: before host 197/29/118/0; mid host 197/29/118/0; after host 210/34/118/109 (hitl_shape/hitl_stages/allowed-tools/pending_tool_grants).
- Grants: host-read 118 files 449 entries and pending 109 files 516 entries, before and after the comment fix.
- Rule B: 0 differ at the 4 points (Task 1, Task 2, Task 3, final).
- Manifest entries changed: cli_agent and personality_skill (Task 3).
- Commits: a9fa05b52, dbcf159a0, a3a7c2ea5, f920ca620, 2a772e4db, 02a5f2202, f6088ba98.

## Known limits

- Checker edit C3: scripts/verify-release section 6, scripts/check-shape-declaration.cjs, scripts/build-render-coverage.cjs and scripts/stamp-firing-block.cjs read the key allowed-tools only; they do not see the 109 pending lists. The slice that turns a class on must run them on that class.
- The new-surface generator still writes a split file when a caller description holds `---`.
- `npm ci --ignore-scripts` was not run (no network); node_modules was present.

## EGM run data

- No subagent and no EGM agent ran in this build (3 executor parts). Tokens: not measured. Findings: the 13 green-red tests and the test-391 item above.

## Open items (carry to the end)

- Outside evidence (a), (b), (c), (d), (e): OPEN (main session).
- Item D-4 of 401-PLAN-INDEX.md: no mode adds the fixture row of a NEW surface file; not decided by this plan.
- Checker note: 13 Brain entries sit in the host-read `tools:` key of 5 agent files (brain-query, grading, investor, persona-analyst, research); rule A1 does not cover `tools:`. Open for slice 3a and owner ruling O8.
- NEEDS_HUMAN: tests/test-391-agent-tools-naming.cjs leg A1 floor of 40 mcp tokens (30 after the planned Brain deletion).
- Next: the main session runs the outside evidence (a) to (e).
