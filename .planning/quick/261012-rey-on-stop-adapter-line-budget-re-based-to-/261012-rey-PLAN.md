---
phase: quick-261012-rey
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - tests/test-198-adapter-budget.test.cjs
  - tests/run-all-366.sh
  - lib/mcp/hook-adapter-audit.cjs
  - CHANGELOG.md
  - .planning/seeds/SEED-125-thin-on-stop-move-inline-close-out-into-scripts.md
autonomous: true
requirements: [QUICK-261012-REY]
canon_parts: [7, 8]
user_setup: []
must_haves:
  truths:
    - "node tests/test-198-adapter-budget.test.cjs exits 0 at the final HEAD; its last stdout line is `PASS: test-198-adapter-budget (15 of 15 tests passed)`; TAP says `# tests 15` and `# pass 15`."
    - "When any subtest fails, the test prints no line that starts with `PASS:`; its last line starts with `FAIL:` and gives the passed count, the total and the exit code."
    - "LINE_BUDGETS['scripts/on-stop'] equals the 198-09 margin rule applied to the on-stop line count measured at HEAD on 2026-10-12 (expected 658 lines, budget 680); the comment names the date, the measured commit and the growth reason (phases 241, 240.1, 369.25)."
    - "bash tests/run-all-198.sh reports `Failed: 0`."
    - "tests/run-all-366.sh, the aggregator that release.sh Step 0.6c runs through RELEASE_GATE_SUITES, runs the adapter-budget test as a hard leg: with the 570 budget the leg reads FAILED, with the re-based budget it reads PASSED, and no other leg verdict changes."
    - "node scripts/doctor.cjs --acceptance completes, and its set of failed point ids after the change equals the set before the change."
    - "SEED-125 records option (a), the thin on-stop refactor, with measured line ranges; scripts/on-stop and hooks/ are byte-unchanged."
    - "CHANGELOG.md has one new Fixed bullet under `## [Unreleased] -- v2.0.0-beta.66 (in progress)`; no version string changes anywhere."
  artifacts:
    - path: "lib/mcp/hook-adapter-audit.cjs"
      provides: "Re-based on-stop line budget with the measurement record in the comment"
      contains: "2026-10-12"
    - path: "tests/test-198-adapter-budget.test.cjs"
      provides: "Exit-code-aware summary line with a counted test total"
      contains: "process.on('exit'"
    - path: "tests/run-all-366.sh"
      provides: "Hard leg that runs the adapter-budget test inside the release suite"
      contains: "node tests/test-198-adapter-budget.test.cjs"
    - path: ".planning/seeds/SEED-125-thin-on-stop-move-inline-close-out-into-scripts.md"
      provides: "Seed for option (a), the thin on-stop refactor, with measured numbers"
      contains: "id: SEED-125"
    - path: "CHANGELOG.md"
      provides: "One Fixed bullet under the unreleased beta.66 heading"
      contains: "### Fixed"
  key_links:
    - from: "scripts/release.sh Step 0.6c (mos_suite_gate)"
      to: "tests/run-all-366.sh"
      via: "RELEASE_GATE_SUITES=(tests/run-all-366.sh) in scripts/release-lib/suite-gate.sh line 35 (unchanged)"
      pattern: "RELEASE_GATE_SUITES=\\(tests/run-all-366\\.sh\\)"
    - from: "tests/run-all-366.sh"
      to: "tests/test-198-adapter-budget.test.cjs"
      via: "hard run leg (exit code is the verdict)"
      pattern: "run \"198 SPEC-5 adapter budget"
    - from: "tests/test-198-adapter-budget.test.cjs subtest 2"
      to: "lib/mcp/hook-adapter-audit.cjs LINE_BUDGETS"
      via: "checkAdapterBudget() -> lineCountBudget() -> src.split('\\n').length <= budget"
      pattern: "'scripts/on-stop': [0-9]+"
---

<objective>
Close item 6 of the QA sweep search-surface-qa-sweep-20261012 by the navigator decision of 2026-10-12: option (b1) plus the gate wiring, with option (a) seeded.

1. Re-base `LINE_BUDGETS['scripts/on-stop']` (570) to the on-stop size measured today at HEAD plus the 198-09 margin rule.
2. Run the adapter-budget test inside the release suite, so the next breach stops a cut.
3. Make the test print a summary line that agrees with its exit code and its real test count.
4. File SEED-125 for option (a), the thin on-stop refactor. Do not implement it.
5. Add one Fixed bullet to CHANGELOG.md under the existing unreleased heading.

Purpose: the leg was red on main for 76 days (2026-07-28 to 2026-10-12) because no release step ran it and the test printed `PASS:` while it exited 1.
Output: 5 changed or new files, 3 commits, measurement logs in the quick directory.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@.planning/STATE.md
@.planning/debug/search-surface-qa-sweep-20261012/cluster-b/EVIDENCE.md
@lib/mcp/hook-adapter-audit.cjs
@tests/test-198-adapter-budget.test.cjs
@tests/run-all-366.sh
@scripts/release-lib/suite-gate.sh

Protocol: /home/jsagi/.claude/protocols/agent-interaction-protocol.md applies to the executor. Write STE-style English. Do not address the human. Return `NEEDS_HUMAN: <one question>` for a human decision.

Name used in every command below: Q = /home/jsagi/dev/MindrianOS-Plugin/.planning/quick/261012-rey-on-stop-adapter-line-budget-re-based-to-
Run every command from /home/jsagi/dev/MindrianOS-Plugin. Worktrees are off.

## Facts measured during planning (PROVEN at 63b25583d, 2026-10-12)

- scripts/on-stop: 657 lines by `wc -l`, 658 by `split('\n').length` (the test's measure). The last commit that touched it is 26629ecff (2026-10-06, feat(369.25-19)).
- node tests/test-198-adapter-budget.test.cjs: exit 1 in 0.83 s; TAP `# tests 15`, `# pass 14`, `# fail 1`; the failing subtest is line 98 ("checkAdapterBudget() passes against the real committed tree today"). The file prints `PASS: ... (17 assertions ...)` at line 360 at module load, so it is the FIRST stdout line, before any test runs.
- Node v22.23.1. A scratch probe proved the summary design below: a `process.on('exit', (code) => ...)` handler that writes with `fs.writeSync(1, ...)` prints after the TAP output and sees code 1 when a node:test subtest fails, code 0 when all pass.
- RELEASE_GATE_SUITES=(tests/run-all-366.sh) at scripts/release-lib/suite-gate.sh line 35. release.sh Step 0.6c calls mos_suite_gate on every real cut (previewed, not run, under --dry-run). tests/test-366-suite-gate.cjs line 118 pins the array to exactly `tests/run-all-366.sh`.
- tests/run-all-366.sh section (2b) (quick 261002-0n4) is the precedent that a quick task adds legs to this aggregator. Its dash fence (section 6) scans tests/run-all-366.sh itself.
- tests/test-198-local-only.test.cjs scans lib/mcp/hook-adapter-audit.cjs for the tokens `mindrian-brain`, `onrender`, `brain-router.cjs`, `brain-client.cjs`, `axios`. The new comment must contain none of them.
- Inline multi-line `node -e` blocks in scripts/on-stop: 241-247 (7 lines), 331-343 (13), 376-385 (10), 408-523 (116; snapshot write, stale-marker write, the 369.25 BRIEF render from line 483), 546-556 (11), 569-609 (41), 648-655 (8). Flag-ON thin-adapter span: sentinels at 47 and 136 (90 lines).
- CHANGELOG.md line 1: `## [Unreleased] -- v2.0.0-beta.66 (in progress)`, with only an `### Added` section. package.json and plugin.json are 2.0.0-beta.66.
- .planning/quick/ and .planning/seeds/ are gitignored (`.gitignore:97 .planning/*`); a new file there needs `git add -f`. The highest seed id is SEED-124; SEED-125 is free.

## Decisions taken in this plan (Claude's discretion, stated)

- Gate choice: add ONE hard `run` leg to tests/run-all-366.sh. The pattern reused is RELEASE_GATE_SUITES: release.sh Step 0.6c already runs tests/run-all-366.sh through mos_suite_gate on every real cut. Reason: it is the smallest change (one leg and a 3-line comment in one file). suite-gate.sh, release.sh and the line-118 pin stay untouched, and only the 0.83 s test enters the gate.
- Rejected: adding tests/run-all-198.sh to RELEASE_GATE_SUITES. It breaks the pin at tests/test-366-suite-gate.cjs line 118 (a second file) and pulls 16 unrelated legs, the legacy SPEC-8 Plurai gate included, into every cut.
- Rejected: a new doctor --acceptance blocker modeled on `harness-policies` (scripts/doctor.cjs line 1620). That pattern is a new point object in a 4968-line file, with a DOCTOR_TEST_FAIL_POINT hook and a parser for JSON output. This test emits TAP, not that JSON. Effect on the doctor acceptance tests: UNVERIFIED.
- Hard `run`, not `run_if`: a missing or red test file must fail the cut. A SKIP would be a new silent path, which is the defect this task closes.
- Margin rule: budget = the smallest multiple of 10 that is at least (measured + 20). The rule reproduces both 198-09 figures that carry no stated exception: 128 -> 150 (+22) and 547 -> 570 (+23). The coordinator (250 -> 280, +30) has its own stated reason and stays as it is. For 658 the rule gives 680 (+22). Do not copy 618 from the 369 documents; it is stale.
- Commit order keeps the release suite green at every commit: commit 1 holds the test file only; commit 2 holds the re-based budget, the run-all-366 leg and CHANGELOG together.

## Cross-platform and canon gates

- The test and the gate leg are Node (`node tests/test-198-adapter-budget.test.cjs`). run-all-366.sh is the existing bash release aggregator. `fs.writeSync(1, ...)` is synchronous on Linux, macOS and Windows. `split('\n')` gives the same count on a CRLF checkout.
- The bash hook scripts/on-stop is untouched, so Windows Git Bash behavior does not change. hooks/ is untouched.
- Tri-Polar: on-stop is a CLI hook; Desktop and Cowork have no hooks. The change is CLI-only by construction.
- Canon Part 8: no network, no Brain, no new package. Part 7: an existing gate pattern is reused; no new surface.
- Release lockstep: no release, no version bump, no push. The CHANGELOG bullet goes under the existing unreleased heading.

## Rules for every task

- Do not edit scripts/on-stop. Do not edit anything under hooks/. Do not edit scripts/release-lib/suite-gate.sh, scripts/release.sh or scripts/doctor.cjs.
- Before the first edit of each file, run `git status --short -- <file>`. If the file has a change you did not make, stop and return `NEEDS_HUMAN: <file> has an unowned change; proceed?`. Do not revert an unowned change.
- Commit with `git commit --only -m "<msg>" -- <explicit paths>`. Do not use `git add -A`, `git add .` or `git commit -a`. A file under .planning/ needs `git add -f <path>` first.
- Commit message: first line `fix(quick-261012-rey): ...`. Last line, after a blank line, is the Co-Authored-By trailer. The orchestrator prompt gave `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Warning: the trailer names a co-author; use the model name from the executor session's own attribution reminder if that model is not Fable 5.1, and record the choice in the SUMMARY.
- Do not use an em-dash or an en-dash in any file or commit message. Use hyphens.
- Do not push. Do not release. Do not bump a version.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Record the baselines, make the test summary line truthful, and prove the release suite sees the breach</name>
  <files>tests/test-198-adapter-budget.test.cjs, tests/run-all-366.sh</files>
  <behavior>
    - At the 570 budget: the test exits 1, prints no line that starts with `PASS:`, and its last stdout line is `FAIL: test-198-adapter-budget (14 of 15 tests passed, exit 1)`.
    - At a green tree (after Task 2): exit 0 and last line `PASS: test-198-adapter-budget (15 of 15 tests passed)`.
    - The SKIP exits at lines 50-51 and 59-60 still print only their SKIP line and exit 0 (the exit handler is registered after them).
    - tests/run-all-366.sh prints `>>> 198 SPEC-5 adapter budget (import audit + line-count): FAILED` while the budget is 570.
  </behavior>
  <action>
Step 1 (baselines, before any edit). Record `git rev-parse --short HEAD` in Q/261012-rey-baseline.txt. Run `node scripts/doctor.cjs --acceptance > Q/261012-rey-doctor-before.txt 2>&1` and record its exit code. Warning: the run can take several minutes; use run_in_background or a 600000 ms timeout, and do not edit any file until it ends (two points read the working tree). Append to the baseline file the summary line (`grep "^Acceptance " Q/261012-rey-doctor-before.txt`) and the sorted set of failed ids (`grep -o "\[acceptance\] [a-z0-9-]* done FAIL" Q/261012-rey-doctor-before.txt | sort -u`). If doctor does not complete, record the last `[acceptance]` line and continue; report it as UNVERIFIED.

Step 2 (side defect, tests/test-198-adapter-budget.test.cjs). Change the import at line 38 to `const { test: nodeTest } = require('node:test');`. Directly below the API guard (after line 61), define two counters, `declared` and `passed`, both 0. Define a local `function test(name, fn)` that increments `declared` and returns `nodeTest(name, async (t) => { await fn(t); passed += 1; })`, so every existing `test(...)` call site stays byte-identical and a subtest counts as passed only when its body resolves. Replace the comment block at lines 349-359 and the unconditional `console.log('PASS: ...')` at line 360. The new code registers `process.on('exit', (code) => { ... })`. The handler builds `PASS: test-198-adapter-budget (<passed> of <declared> tests passed)` only when `code === 0` AND `passed === declared`. In every other case it builds `FAIL: test-198-adapter-budget (<passed> of <declared> tests passed, exit <code>)`. It writes the line with `fs.writeSync(1, line + '\n')` inside try/catch (stdout can be a pipe on Windows or macOS, where console.log in an exit handler can drop the line). The new comment says, in hyphen-only prose: the exit code from node:test is the verdict; the line prints after the run, from the same exit code; the count comes from the run, not a literal; and quick 261012-rey replaced the earlier line, which printed PASS first and claimed 17 assertions against 15 tests. Do not change any test body, test name or assertion.

Step 3 (gate wiring, tests/run-all-366.sh). Insert a new section directly after section (2b) (after the `pin 363 run quick` leg, line 126) and before section (3). The section has a 3-line comment: `# --- (2c) quick 261012-rey: the Phase 198 SPEC-5 adapter budget rides the release suite ---`, then that the on-stop line budget was red on main from 2026-07-28 to 2026-10-12 because no release step ran the test, then that the leg is a hard run (not run_if), so a missing or red test fails the cut. The leg is: run "198 SPEC-5 adapter budget (import audit + line-count)" node tests/test-198-adapter-budget.test.cjs. Do not change any other line, including the header that says the file is written once (section 2b is the precedent).

Step 4 (red proof on the release path). Run the test and save the output to Q/261012-rey-t198-red.txt. Run `LC_ALL=C bash tests/run-all-366.sh > Q/261012-rey-366-red.txt 2>&1` (LC_ALL=C matches mos_suite_gate). The new leg must read FAILED. That proves the release suite now sees the 658 > 570 breach. Record every other leg that reads FAILED or KNOWN as pre-existing. Do not fix an unrelated leg.

Step 5 (commit 1, test file only). Run `git commit --only -m "fix(quick-261012-rey): adapter-budget test prints its verdict after the run, from the exit code, with the counted test total" -- tests/test-198-adapter-budget.test.cjs` with the trailer rule from the context. Do not commit tests/run-all-366.sh in this task; it stays modified in the working tree, so no commit carries a red release suite.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && Q=.planning/quick/261012-rey-on-stop-adapter-line-budget-re-based-to- && node tests/test-198-adapter-budget.test.cjs > $Q/261012-rey-t198-red.txt 2>&1; echo "test exit=$? (expect 1)"; echo "PASS lines: $(grep -c '^PASS:' $Q/261012-rey-t198-red.txt) (expect 0)"; tail -n 1 $Q/261012-rey-t198-red.txt; grep -E '^# (tests|pass|fail) ' $Q/261012-rey-t198-red.txt; echo "literal 17: $(grep -v '^\s*//' tests/test-198-adapter-budget.test.cjs | grep -c '17 assertions') (expect 0)"; grep -F '>>> 198 SPEC-5 adapter budget' $Q/261012-rey-366-red.txt; tail -n 1 $Q/261012-rey-366-red.txt; git log -1 --stat --format=%s | head -3; LC_ALL=C grep -cP '\xE2\x80\x94|\xE2\x80\x93' tests/test-198-adapter-budget.test.cjs tests/run-all-366.sh</automated>
  </verify>
  <done>
    - Q/261012-rey-baseline.txt holds the HEAD sha, the doctor exit code, the `Acceptance ...` summary line and the sorted set of failed doctor point ids (or the UNVERIFIED note).
    - The test exits 1. The output has 0 lines that start with `PASS:`. The last line is `FAIL: test-198-adapter-budget (14 of 15 tests passed, exit 1)`. TAP shows `# tests 15`, `# pass 14`, `# fail 1`.
    - Q/261012-rey-366-red.txt has `>>> 198 SPEC-5 adapter budget (import audit + line-count): FAILED`.
    - Commit 1 contains only tests/test-198-adapter-budget.test.cjs. tests/run-all-366.sh is modified and uncommitted.
    - The dash count is 0 for both files.
  </done>
</task>

<task type="auto">
  <name>Task 2: Re-base the on-stop budget from a fresh measurement, add the CHANGELOG bullet, and prove every gate is green</name>
  <files>lib/mcp/hook-adapter-audit.cjs, CHANGELOG.md, tests/run-all-366.sh</files>
  <action>
Step 1 (measure at HEAD, per decision b1). Run `node -e "process.stdout.write(String(require('fs').readFileSync('scripts/on-stop','utf8').split('\n').length))"`. Call the result M (expected 658). Run `git log -1 --format='%h %ad' --date=short -- scripts/on-stop` (expected `26629ecff 2026-10-06`) and `git rev-parse --short HEAD`. Compute B as the smallest multiple of 10 that is at least M + 20 (expected 680). Save M, B and both shas to Q/261012-rey-measure.txt. Do not copy 618 from the 369 documents. If M is not 658, use the measured M and record why it moved.

Step 2 (lib/mcp/hook-adapter-audit.cjs). Change line 62 from `'scripts/on-stop': 570,` to `'scripts/on-stop': B,` with the measured B. Do not change the statusline (150) or coordinator (280) entries or any function. Keep the existing on-stop comment (lines 49-58) as the 198-09 history. Append a re-base paragraph to that comment, in hyphen-only prose, that says:
- Re-based 2026-10-12 by quick 261012-rey (navigator decision, option b1 of sweep search-surface-qa-sweep-20261012 item 6).
- The measurement: M lines by split at HEAD <sha>; the last on-stop commit was 26629ecff.
- The rule: B is the smallest multiple of 10 that is at least M + 20, the rule that gives 150 from 128 and 570 from 547.
- The reason: phases 241 (8462f41ad, 0d02e112e, c7fb00dba), 240.1 (01c3ca19d) and 369.25 (26629ecff) grew the flag-OFF legacy body from 547 to M; the first breach was 8462f41ad on 2026-07-28; detail in .planning/debug/search-surface-qa-sweep-20261012/cluster-b/EVIDENCE.md.
- The leg now runs in the release suite (tests/run-all-366.sh).
- SEED-125 holds option (a), the thin on-stop refactor, which re-measures and lowers this budget.
Also edit the header sentence at lines 33-37 that says the 198-08 and 198-09 SUMMARY files cite these same figures: add that the on-stop figure was re-based on 2026-10-12, so those files keep the 198-09 history. Warning: the comment must not contain `mindrian-brain`, `onrender`, `brain-router.cjs`, `brain-client.cjs` or `axios`; tests/test-198-local-only.test.cjs fails on them.

Step 3 (CHANGELOG.md). Under `## [Unreleased] -- v2.0.0-beta.66 (in progress)`, after the existing `### Added` bullet and before `## [2.0.0-beta.65]`, add a `### Fixed` heading with one bullet in the file's style (bold lead sentence, then plain prose, hyphens only). Content: the Stop hook size check is green again and now runs before every release; scripts/on-stop had grown to M lines against a 570-line budget since 2026-07-28 (phases 241, 240.1 and 369.25) and no release step ran the check, so the red stayed hidden; the budget is re-measured at B (M lines plus the 198-09 margin rule); the check is a hard leg of the release suite (tests/run-all-366.sh); its summary line now says FAIL, not PASS, when a check fails; moving the inline close-out code out of the hook is filed for a later phase. Do not change any heading text or version string.

Step 4 (green proof). Run the test and save to Q/261012-rey-t198-green.txt. Run `bash tests/run-all-198.sh > Q/261012-rey-198-green.txt 2>&1`. Run `LC_ALL=C bash tests/run-all-366.sh > Q/261012-rey-366-green.txt 2>&1`. Compare the `>>> ` lines of the red run and the green run. Exactly one line pair may differ: the 198 SPEC-5 adapter budget leg, FAILED to PASSED. Then run the release path itself: `bash -c '. scripts/release-lib/suite-gate.sh; mos_suite_gate "$PWD" 0 0'` and save the output to Q/261012-rey-suite-gate.txt. If an unrelated leg was already FAILED in the red run, the suite gate reads FAIL for that leg. Record it as pre-existing with its leg name and do not fix it.

Step 5 (commit 2). Run `git commit --only -m "fix(quick-261012-rey): re-base the on-stop line budget to the measured size plus the 198-09 margin and run the adapter-budget leg in the release suite" -- lib/mcp/hook-adapter-audit.cjs tests/run-all-366.sh CHANGELOG.md` with the trailer rule from the context.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && Q=.planning/quick/261012-rey-on-stop-adapter-line-budget-re-based-to- && cat $Q/261012-rey-measure.txt; grep -n "'scripts/on-stop':" lib/mcp/hook-adapter-audit.cjs; node tests/test-198-adapter-budget.test.cjs > $Q/261012-rey-t198-green.txt 2>&1; echo "test exit=$? (expect 0)"; tail -n 1 $Q/261012-rey-t198-green.txt; grep -E '^# (tests|pass|fail) ' $Q/261012-rey-t198-green.txt; grep 'Passed:' $Q/261012-rey-198-green.txt; diff <(grep '^>>> ' $Q/261012-rey-366-red.txt) <(grep '^>>> ' $Q/261012-rey-366-green.txt); grep -F '>>> 198 SPEC-5 adapter budget' $Q/261012-rey-366-green.txt; tail -n 1 $Q/261012-rey-366-green.txt; cat $Q/261012-rey-suite-gate.txt; sed -n 1,8p CHANGELOG.md | cut -c1-120; git diff HEAD~1 --stat; git status --short -- scripts/on-stop hooks/; LC_ALL=C grep -cP '\xE2\x80\x94|\xE2\x80\x93' lib/mcp/hook-adapter-audit.cjs CHANGELOG.md</automated>
  </verify>
  <done>
    - Q/261012-rey-measure.txt records M (expected 658), B (expected 680), the HEAD sha and the last on-stop commit (26629ecff).
    - lib/mcp/hook-adapter-audit.cjs line 62 reads `'scripts/on-stop': B,`. The comment carries the date 2026-10-12, the measured sha, the rule and the growth reason. The other two budgets are unchanged.
    - The test exits 0. The last line is `PASS: test-198-adapter-budget (15 of 15 tests passed)`. TAP shows `# tests 15`, `# pass 15`, `# fail 0`.
    - tests/run-all-198.sh shows `Failed: 0` (expected `Passed: 17   Failed: 0   Skipped: 0`).
    - The red-versus-green diff of `>>> ` lines shows only the 198 SPEC-5 adapter budget leg changed, FAILED to PASSED. The run-all-366 PASSED count rose by 1, FAILED fell by 1, and SKIPPED and KNOWN did not change.
    - Q/261012-rey-suite-gate.txt shows `suite-gate: PASS -- tests/run-all-366.sh`, or a FAIL whose only cause is a leg recorded as pre-existing in Task 1.
    - CHANGELOG.md has `### Fixed` with one bullet under the beta.66 unreleased heading. No version string changed.
    - Commit 2 contains exactly lib/mcp/hook-adapter-audit.cjs, tests/run-all-366.sh and CHANGELOG.md. scripts/on-stop and hooks/ show no change. The dash count is 0.
  </done>
</task>

<task type="auto">
  <name>Task 3: File SEED-125 for the thin on-stop refactor and confirm doctor --acceptance has no new blocker</name>
  <files>.planning/seeds/SEED-125-thin-on-stop-move-inline-close-out-into-scripts.md</files>
  <action>
Step 1 (measure the refactor target at HEAD). Re-measure the inline multi-line `node -e` blocks of scripts/on-stop. Use `grep -n 'node -e' scripts/on-stop` for the start lines and the closing-quote line of each block for the end. Confirm or correct the planning values: 241-247, 331-343, 376-385, 408-523 (116 lines), 546-556, 569-609 (41 lines), 648-655. Confirm the sentinel lines 47 and 136 with `grep -n 'BEGIN-MCP-FIRST\|END-MCP-FIRST' scripts/on-stop`.

Step 2 (write the seed). Copy the frontmatter shape of SEED-122 to SEED-124 (keys id, title, status, priority, filed, source, depends_on, promotes_to). Values:
- id: SEED-125.
- title: "Thin on-stop: move the inline node -e close-out blocks into scripts/*.cjs and lower the on-stop line budget".
- status: filed.
- priority: medium.
- filed: 2026-10-12.
- source: quick 261012-rey (option a of item 6, sweep search-surface-qa-sweep-20261012, navigator decision 2026-10-12) and the sweep evidence file .planning/debug/search-surface-qa-sweep-20261012/cluster-b/EVIDENCE.md.
- depends_on: Phase 198 (D-06 thin adapter, SPEC-5 budget, SPEC-7 flag-OFF byte-identical parity), Phase 88 (the per-folder close-out on the Stop walk), Phase 369.25 plan 19 (the BRIEF.md render inside the line-408 block).
- promotes_to: a phase of its own; the navigator decides the slot at the next sequencing gate.

The body has these sections, in STE-style prose, hyphens only:
- "Measured": the whole-file count (wc -l and split), the commit measured, the old budget 570 (198-09), the re-based budget B (quick 261012-rey), the flag-ON span 47-136 (90 lines), the per-block line ranges from Step 1, and the growth history: 547 (7226232a7), 580 (8462f41ad, first breach), 605, 612, 618 (01c3ca19d), 658 (26629ecff).
- "The job": move each inline block, the 116-line block at line 408 first, into a scripts/*.cjs file that the bash calls with the same env inputs. Then re-measure and set LINE_BUDGETS['scripts/on-stop'] back down with the same margin rule. The target is at or under 570.
- "Constraints": SPEC-7 flag-OFF output stays byte-identical (tests/test-198-flag-off-parity.test.cjs); the flag-ON span and its bespoke audit stay unchanged; the 369.25 BRIEF tests stay green; the `|| true` failure funnel stays, so the hook exits 0; cold-start cost of the extra node processes is measured, because the line-408 comment says one node call amortizes cold start; Windows Git Bash through the polyglot run-hook.cmd is verified; CLI-only by construction (Tri-Polar); Part 8 untouched.
- "Done when": run-all-198 and run-all-366 are green with the lowered budget.
- "Not in scope": option b2 (measure only the flag-ON span), kept as a record and not chosen.

Step 3 (commit 3). Run `git add -f .planning/seeds/SEED-125-thin-on-stop-move-inline-close-out-into-scripts.md`. Then run `git commit --only -m "fix(quick-261012-rey): file SEED-125, the thin on-stop refactor, with measured block ranges" -- .planning/seeds/SEED-125-thin-on-stop-move-inline-close-out-into-scripts.md` with the trailer rule from the context.

Step 4 (doctor after). Run `node scripts/doctor.cjs --acceptance > Q/261012-rey-doctor-after.txt 2>&1` with the same timeout rule as Task 1. Compare the sorted set of failed point ids with the before set. The two sets must be equal. A difference in a point that reads the working tree (verify-release-clean-tree, working-tree-housekeeping, worktree-hygiene) must be traced to its finding text and recorded. Do not edit scripts/doctor.cjs.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && Q=.planning/quick/261012-rey-on-stop-adapter-line-budget-re-based-to- && S=.planning/seeds/SEED-125-thin-on-stop-move-inline-close-out-into-scripts.md && sed -n 1,12p $S && grep -c '408' $S && git ls-files --error-unmatch $S && git log -1 --stat --format=%s | head -3 && LC_ALL=C grep -cP '\xE2\x80\x94|\xE2\x80\x93' $S; grep '^Acceptance ' $Q/261012-rey-doctor-before.txt $Q/261012-rey-doctor-after.txt; diff <(grep -o '\[acceptance\] [a-z0-9-]* done FAIL' $Q/261012-rey-doctor-before.txt | sort -u) <(grep -o '\[acceptance\] [a-z0-9-]* done FAIL' $Q/261012-rey-doctor-after.txt | sort -u) && echo SAME-FAILED-SET; git log --oneline -3; git status --short -- scripts/on-stop hooks/ lib tests CHANGELOG.md</automated>
  </verify>
  <done>
    - SEED-125 exists, is tracked (git ls-files lists it), has the frontmatter keys of SEED-122 to SEED-124, cites the measured block ranges (the line-408 block included), M, B, 570 and the growth history, and has 0 dashes.
    - Commit 3 contains only the seed file.
    - Both doctor runs completed. The before and after sets of failed point ids are equal (SAME-FAILED-SET printed), or each difference is traced to its finding text and recorded.
    - git log shows the 3 quick-261012-rey commits on main, not pushed. git status shows no change in scripts/on-stop, hooks/, lib, tests or CHANGELOG.md.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| repo commit -> release cut | A tracked number (LINE_BUDGETS) and a test verdict decide whether release.sh Step 0.6c lets a cut proceed. |
| test process -> aggregator | The aggregator trusts the exit code of the test; a human reader trusts the printed summary line. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-261012-rey-01 | Tampering | lib/mcp/hook-adapter-audit.cjs LINE_BUDGETS | mitigate | The new on-stop figure comes from a recorded measurement (Q/261012-rey-measure.txt) and a stated rule. The comment names the date, the sha and the growth commits. SEED-125 holds the work that lowers it again. |
| T-261012-rey-02 | Repudiation | tests/test-198-adapter-budget.test.cjs summary line | mitigate | The line prints from the exit handler, gated on code 0 and the counted pass total. A failing run prints FAIL with the counts and the exit code. Task 1 proves the FAIL line at the 570 budget. |
| T-261012-rey-03 | Denial of Service | tests/run-all-366.sh release suite | accept | The new leg adds 0.83 s (measured) to a suite that already runs on every cut. No network call. |
| T-261012-rey-04 | Elevation of Privilege | release gate bypass by a SKIP | mitigate | The leg uses hard `run`, not `run_if`. A deleted or renamed test fails the cut instead of a silent SKIP. |
| T-261012-rey-05 | Information Disclosure | comment text in lib/mcp/hook-adapter-audit.cjs | mitigate | The comment avoids the tokens that tests/test-198-local-only.test.cjs forbids. run-all-198 leg "198 Part 8 local-only floor" checks it. No room data and no secrets are written. |
</threat_model>

<verification>
- node tests/test-198-adapter-budget.test.cjs: exit 0, last line `PASS: test-198-adapter-budget (15 of 15 tests passed)`.
- bash tests/run-all-198.sh: `Failed: 0`.
- LC_ALL=C bash tests/run-all-366.sh: the leg `198 SPEC-5 adapter budget (import audit + line-count)` reads PASSED. Against the red run, only that leg changed; PASSED +1, FAILED -1, SKIPPED and KNOWN unchanged.
- The release path `. scripts/release-lib/suite-gate.sh; mos_suite_gate "$PWD" 0 0` prints `suite-gate: PASS -- tests/run-all-366.sh`, or a FAIL caused only by a leg recorded as pre-existing.
- node scripts/doctor.cjs --acceptance completes before and after; the sets of failed point ids are equal.
- `git status --short -- scripts/on-stop hooks/` is empty.
- No em-dash or en-dash in any of the 5 files.
</verification>

<success_criteria>
- The on-stop budget equals the 198-09 margin rule applied to the size measured on 2026-10-12, with the record in the comment.
- The adapter-budget test runs on every real cut through RELEASE_GATE_SUITES. The red proof (570) and the green proof (B) are both on file in Q.
- The test never prints PASS on a non-zero exit, and its count equals the TAP test count.
- SEED-125 is filed and tracked. The refactor is not implemented.
- CHANGELOG.md carries one Fixed bullet under the unreleased beta.66 heading.
- 3 commits on main, not pushed, no release, no version bump.
</success_criteria>

<output>
Create Q/261012-rey-SUMMARY.md (Q = .planning/quick/261012-rey-on-stop-adapter-line-budget-re-based-to-) when done. Include M, B, the 3 commit shas, the red and green leg lines, the suite-gate line, the doctor before and after summary lines and failed-id sets, the trailer used, and these follow-ups for the main session:
- The 369 close-gate notes still quote "618 against 570".
- The header table of tests/run-all-3551.sh (line 38) still lists this leg as a documented red; its FAILED count drops by 1.
- .planning/debug/search-surface-qa-sweep-20261012.md item 6 Resolution and knowledge-base.md take a block when the sweep resolves.
</output>
