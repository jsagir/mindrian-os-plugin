# 406-P1 Summary

## OR-47

1. A top professional would also verify the pinned spans against accepted commit diffs, exercise failure tripwires on a scratch tree, and run the complete stated gate.
2. Raw material: accepted diffs read with `git show`. Agent commits: 09139519d, 426f473f1, 4b1b9bab1, 2a772e4db. Skill commits: 0ed2f6d41, 4b1b9bab1, 2a772e4db. The agent diff adds the corrected quick note and four job keys, and changes the CIRS comment. The skill diff adds the Brain call pointer and four job keys, and changes the CIRS comment. No other line changed in these spans.
3. Methods and tools: reuse the test span extraction in Node and SHA-256; inspect accepted changes with `git show`; run isolated scratch tripwires; run the specified Node, Bash, and check commands with the requested temporary environment.
4. Outside evidence: red then green runs for the two pins; tripwires that make each pinned span or frontmatter check red again. Record exact gate output and changed files below.

## Red record

PROVEN by the orchestrator on base 4314d335a: test-359-prose-budget: 16 passed, 2 failed. The failing B5 legs were the agent outside the Decision Gates span and SKILL outside item 5. test-3696-voice-first-budget: PASS 11, FAIL 1 (V7).

## Diff map

PROVEN by the orchestrator with git log, git diff and git show:

- `git log 7eebf9979..HEAD -- agents/larry-extended.md`: 09139519d, 426f473f1, 4b1b9bab1, 2a772e4db. `git diff 7eebf9979 HEAD` on the agent: +1 quick 261108-es3 (SEED-147) line (added by 09139519d as SEED-145, changed to SEED-147 by merge 426f473f1); CIRS comment changes from `# --- Phase 172-06` to `# == Phase 172-06` (2a772e4db); +4 job keys (4b1b9bab1). No other line.
- `git log a695511d5..HEAD -- skills/larry-personality/SKILL.md`: 0ed2f6d41, 4b1b9bab1, 2a772e4db. `git diff a695511d5 HEAD` on the skill: CIRS comment changes (2a772e4db); +4 job keys (4b1b9bab1); `## Composing a Brain call`, blank, `Sprouts, not bodies: references/brain/sprout-split-route.md`, blank (0ed2f6d41). No other line.
- The five V7 lines are absent from `tests/fixtures/3696-immutable-sources.json` (grep count 0).
- A scratch check removing the five lines from live frontmatter equals `frontmatterOf(F1.rewriteText(base).text)` (PROVEN).
- RT1 of `tests/test-3696-operation-doctrine.cjs` stays out of P1 (400.5 plan 04).

## New hash values

- LARRY_OUTSIDE: `abeb94bf6dcdebba3912c27a4086cc1540d0e3f4912b7606d958c57a12dc2d5b`
- SKILL_OUTSIDE: `8b0989e84151ff8e59965b0344b5c993ec34ba702283cc7bc3267ffee11c9154`

## Tripwire results

PROVEN in a scratch copy of the tree (the real files were not changed; both pins green again after restore):
- 1 byte appended to the agent body outside the Decision Gates span: B5 (agent) FAIL.
- 1 byte appended to SKILL.md outside item 5: B5 (skill) FAIL.
- 1 new frontmatter line `x_tripwire: 1` in the agent: V7 FAIL.
- 1 byte changed in the accepted line `job_so:`: V7 FAIL, with the detail "accepted frontmatter line is present: job_so: ... (entry not found)".

## Gate results

Environment: temp HOME, MINDRIAN_HOME and MINDRIAN_ROOMS_HOME; MINDRIAN_BRAIN_URL=http://127.0.0.1:9. The worktree had no node_modules. A first G-402 run gave 2 failed legs (402 F2 S12, lx3 D8) with "Cannot find module '@modelcontextprotocol/client'" (ENV GAP). The fix: an untracked symlink node_modules to the stage worktree dependencies (same package.json and npm-shrinkwrap.json at 4314d335a, PROVEN by git diff --quiet). All results below are after that fix. PROVEN unless marked.

- node tests/test-359-prose-budget.cjs: 18 passed, 0 failed (was 16 passed, 2 failed).
- node tests/test-3696-voice-first-budget.cjs: PASS: 12 FAIL: 0 (was PASS: 11 FAIL: 1).
- bash tests/run-all-402.sh: Phase 402: PASS=26 FAIL=0 SKIP=0. Both "359 prose budget" and "3696 voice-first budget" ran as run legs and PASSED.
- bash tests/run-all-359.sh: Phase 359: PASS=27 FAIL=0 SKIP=0.
- bash tests/run-all-401.sh: PASSED=4 FAILED=0 SKIPPED=0 KNOWN=0.
- bash tests/run-all-261127-bnd.sh: PASS=79 FAIL=0.
- bash tests/run-all-3696.sh: exit 1, Phase 369.6 verification: PASSED=125 FAILED=6 SKIPPED=2 KNOWN=18. Failed legs: isolation (369.6-02), operation doctrine (RT1, out of P1), tests/test-115-surfaces-grep.sh, tests/test-260917-rooms-home-precedence.cjs, tests/test-298-contract-parity.cjs, test-346-catalogue-schema.cjs, tests/test-36925-injection.cjs (J6). The runner also prints the self-test line "fake-extra: FAILED", which is its expected self-test result. Base comparison: a copy of the base 4314d335a (git archive, the same node_modules link) gave PASSED=113 FAILED=19; it holds each failed leg above except J6 of test-36925-injection. The base copy is not a git checkout, so its extra failures are not a fair base count (ASSUMED cause). J6 ("two sessions reading the same legacy room get byte-identical answers") passed 2 of 2 alone on the build tree and 2 of 2 on the base copy; it reads no P1 file (grep). Classified as a timing flake under machine load. Result: base or better; the voice-first and prose-budget legs changed from red to green.
- node scripts/check-frontmatter-split.cjs --check: exit 0.
- node scripts/check-tool-grants.cjs --check: exit 0.
- node scripts/build-connector-registry.cjs --check: exit 0.
- node scripts/run-harness.cjs --check: exit 0.
- After the gate, git status --short showed no tracked file changed outside the 4 plan files.

## Changed files

- tests/test-359-prose-budget.cjs
- tests/test-3696-voice-first-budget.cjs
- tests/run-all-402.sh
- tests/run-all-261127-bnd.sh
- .planning/phases/406-larry-skeleton-cut-1/406-P1-SUMMARY.md (this file)

Not edited: agents/larry-extended.md, skills/larry-personality/SKILL.md, tests/fixtures/, data/harness-manifest.json, tests/test-3696-operation-doctrine.cjs.

## Build notes

- The builder ran through Codex (codex exec, workspace-write). Codex wrote the 4 edits and ran the tripwires. The background time limit of the orchestrating session stopped Codex during the gate. The orchestrating session ran the gate again outside the Codex sandbox and added 2 comment lines (one per entry group) to ACCEPTED_AFTER_BASE, as the plan asks.
- Inside the Codex sandbox, leg K4 of G-402 failed (A1, A2, B1). Outside the sandbox it passed. Classified as a sandbox effect (ASSUMED cause).

## Plan check text changes

1. MINOR-1 plan line 56: the stage tip was 09beedc24 without F1 at planning time; F1 is now merged (merge 4314d335a); the base of this build is 4314d335a.
2. MINOR-2: the Task 1 check uses grep -q "16 passed, 2 failed".
3. MINOR-3: Task 3 Step 1 also updates the group comment of tests/run-all-402.sh lines 15 to 17.
4. MINOR-4: Task 2 Step 4 adds a skill tripwire (1 byte appended to SKILL.md outside item 5; B5 must fail).

Commits: c0ce4a654 (Task 2, B5 and V7), 258436087 (Task 3, G-402 legs), and the commit of this SUMMARY.
