---
phase: quick-261104-fva
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [QUICK-261104-fva]
files_modified:
  # merge 1 (quick/261103-vi0-typecheck-strict)
  - tests/run-all-380.sh
  - tests/test-380-gate-wiring.cjs
  - .planning/quick/261103-vi0-typecheck-gate-strictness-when-deps-miss/261103-vi0-FINDINGS.md
  - .planning/quick/261103-vi0-typecheck-gate-strictness-when-deps-miss/261103-vi0-SUMMARY.md
  # merge 2 (quick/261030-intent-classifier)
  - lib/core/brain-client.cjs
  - lib/core/hook-compile-cache.cjs
  - scripts/intent-classifier
  - scripts/intent-classifier.cjs
  - scripts/minto-drain-on-prompt.cjs
  - tests/test-261030-a2s-classifier-parity.cjs
  - tests/test-261030-a2s-compile-cache.cjs
  # merge 3 (quick/section-job-room-declarations), net change against the merge 2 tree
  - CHANGELOG.md            # conflict only; resolved content equals the first parent
  - .planning/STATE.md      # conflict; one row added
  - data/doctor-modules.json
  - lib/core/doctor/section-ruling-module.cjs
  - lib/core/feyminto/next-move.cjs
  - lib/core/navigation-engine.cjs
  - lib/core/room-skeleton-scaffold.cjs
  - lib/core/section-registry.cjs
  - tests/run-all-353.sh
  - tests/test-353-doctor-section-ruling.cjs
  - tests/test-353-room-section-jobs.cjs
  - .planning/quick/261028-gmg-room-level-section-job-declarations/261028-gmg-PLAN.md
  - .planning/quick/261028-gmg-room-level-section-job-declarations/261028-gmg-SUMMARY.md
  - .planning/quick/261028-gmg-room-level-section-job-declarations/261028-gmg-VERIFICATION.md
  # written by the executor, committed by the orchestrator (not by the executor)
  - .planning/quick/261104-fva-plugin-release-integration-vi0-a2s-secti/261104-fva-SUMMARY.md

must_haves:
  truths:
    - "integration/release-next starts at a3a293c93d6b22bef1ecd24eb6566fe33007753f (origin/main) and ends at the merge 3 commit; SUMMARY records the final tip SHA (full 40 characters)"
    - "Merge 1 SHA is recorded; its parents are a3a293c93d6b22bef1ecd24eb6566fe33007753f and 11ad37af71e17f3c3b3059afb378a8f2f926521e; its tree is d444acbe3ba9e9a0f4b69d04903b02fefdd2c8b7"
    - "Merge 2 SHA is recorded; its parents are the merge 1 SHA and 233361b79923b5c908d47e2db21d8669257094de; its tree is 42d056f382773fae3493c61bf4db91c0992f6e36"
    - "Merge 3 SHA is recorded; its parents are the merge 2 SHA and 88aa00e041ad58f499bb08a8e11ee1c1325e14dc; its tree is c6d02fb2dc0cf4363bc373c36e2a0636714aeac7"
    - "Conflict note CHANGELOG.md: resolved to the integration side (blob c2b1672275872f39f9cddbe9676b78c5493f873a), which already holds all 5 bullets the branch side adds (2 Added, 2 Fixed, 1 Changed), each exactly once; no entry is lost and no entry is new"
    - "Conflict note .planning/STATE.md: both sides kept; the 261028-gmg row stands before the six 261029 rows (ascending quick id order); resolved blob c4e7e42be810b4f82ec030ed68a4d02b00e0277e; exactly 1 line added against the first parent"
    - "Test counts are recorded in SUMMARY and in each merge commit message: test-380-gate-wiring after merges 1 and 3; the two a2s tests after merges 2 and 3; test-353-room-section-jobs, test-353-doctor-section-ruling and test-doctor-mcp-write-path after merge 3"
    - "No code file is edited by hand; no em dash (U+2014) or en dash (U+2013) is written; no push, tag, release.sh or merge into main happens; no command names branch workspace/phase-369-6"
  artifacts:
    - path: ".planning/quick/261104-fva-plugin-release-integration-vi0-a2s-secti/261104-fva-SUMMARY.md"
      provides: "Merge SHAs, final tip SHA, conflict notes, PASSED/FAILED counts per test per merge"
      contains: "integration/release-next"
    - path: ".planning/STATE.md"
      provides: "Quick task table with both the 261028-gmg row and the six 261029 rows"
      contains: "| 261028-gmg |"
  key_links:
    - from: "merge 3 commit"
      to: "88aa00e041ad58f499bb08a8e11ee1c1325e14dc"
      via: "second parent"
      pattern: "git rev-parse HEAD^2"
    - from: "tests/test-353-room-section-jobs.cjs"
      to: "lib/core/section-registry.cjs"
      via: "getSectionJob(slug, roomDir) arrives with merge 3"
      pattern: "getSectionJob"
    - from: "tests/test-261030-a2s-classifier-parity.cjs"
      to: "scripts/intent-classifier"
      via: "OLD (05655557542ae068fb2f2368400d1899ff637d61) vs NEW parity run"
      pattern: "PARITY default"
---

<objective>
Merge three finished quick branches into integration/release-next, in a fixed order, with `git merge --no-ff --no-commit`, a targeted test run, and then `git commit`.

1. quick/261103-vi0-typecheck-strict (11ad37af7): the 380 typecheck leg fails, not skips, when TypeScript is missing.
2. quick/261030-intent-classifier (233361b79, quick 261030-a2s): one node start per prompt for the intent-classifier hook, a per-user compile cache, lazy ajv.
3. quick/section-job-room-declarations (88aa00e04, quicks 261028-gmg and 261026-s8c): room-level section job declarations. 8 of its 12 commits are already in main by patch-id.

Purpose: build one integration tip for the next release. The main session runs one heavy suite on that tip later. This plan runs only the targeted tests.
Output: 3 merge commits on integration/release-next, and the file 261104-fva-SUMMARY.md (not committed by the executor).

No design decision is made in this plan. No brand rule applies (no UI, copy, color, voice or motion change).
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@/home/jsagi/.claude/protocols/agent-interaction-protocol.md
@/home/jsagi/gsd-workspaces/integration-release/CLAUDE.md

Facts the planner measured on 2026-11-04 (PROVEN, read-only, with git merge-tree in memory):
- Worktree: /home/jsagi/gsd-workspaces/integration-release, branch integration/release-next, HEAD = origin/main = main = a3a293c93d6b22bef1ecd24eb6566fe33007753f, tracked tree clean.
- node_modules in the worktree is a symlink to /home/jsagi/dev/MindrianOS-Plugin-release/node_modules. It is excluded by .git/info/exclude. Never stage it.
- Branch tips: vi0 = 11ad37af71e17f3c3b3059afb378a8f2f926521e, a2s = 233361b79923b5c908d47e2db21d8669257094de, section = 88aa00e041ad58f499bb08a8e11ee1c1325e14dc.
- Simulated merge 1 tree: d444acbe3ba9e9a0f4b69d04903b02fefdd2c8b7 (clean, 4 files).
- Simulated merge 2 tree: 42d056f382773fae3493c61bf4db91c0992f6e36 (clean, 7 files).
- Simulated merge 3: conflicts in CHANGELOG.md and .planning/STATE.md only. data/doctor-modules.json auto-merges. With the resolution below, the tree is c6d02fb2dc0cf4363bc373c36e2a0636714aeac7 (13 files changed against the merge 2 tree).
- CHANGELOG.md conflict: the integration side already holds every bullet the branch side adds (2 bullets in "### Added", 2 in "### Fixed", 1 in "### Changed"), each exactly once. The resolved file is byte-equal to the first parent, blob c2b1672275872f39f9cddbe9676b78c5493f873a.
- .planning/STATE.md conflict: one hunk in the quick task table. Ours = six rows 261029-kqv, 261029-lx3, 261029-qef, 261029-s9x, 261029-sc6, 261029-u8x. Theirs = one row 261028-gmg. The table is in ascending quick id order, so 261028-gmg goes first. Resolved blob c4e7e42be810b4f82ec030ed68a4d02b00e0277e (the planner produced this blob with the resolver command in Task 3). Both parents hold 4 pre-existing em or en dashes in STATE.md and 107 in CHANGELOG.md; the resolution adds 0.
- Git hooks: core.hooksPath = /home/jsagi/dev/MindrianOS-Plugin/.git/hooks, which holds a pre-commit guard (room ROOM.md and MINTO.md guard plus born-wired gates).
- The parity test compares OLD = git archive of 05655557542ae068fb2f2368400d1899ff637d61 (an ancestor of HEAD) with NEW = the worktree. No commit between that sha and HEAD touches scripts/intent-classifier, scripts/intent-classifier.cjs, lib/core/brain-client.cjs, scripts/minto-drain-on-prompt.cjs, lib/core/hook-compile-cache.cjs or hooks/hooks.json.

Rules for every task (read before Task 1):
- Work only in /home/jsagi/gsd-workspaces/integration-release. Use `git -C /home/jsagi/gsd-workspaces/integration-release` or absolute paths. Do not cd to /home/jsagi/dev/MindrianOS-Plugin.
- Forbidden: git push, git tag, scripts/release.sh, any merge into main, git stash, git reset --hard, git add -A, git add ., git commit -a, git commit --no-verify, git merge --abort, a checkout of another branch, and any command that names branch workspace/phase-369-6 (session jsagi-8f owns it).
- Do not edit any code file. The only file content change made by hand in this plan is the conflict region of .planning/STATE.md.
- Do not write an em dash (U+2014) or an en dash (U+2013) in any file or commit message.
- Run each test with a Bash timeout of 600000 ms. Send the output to a log file in the executor scratchpad directory and print the exit code.
- A test result counts as FAILED when the exit code is not 0. Exit code 77 from test-380-gate-wiring means SKIPPED (ENV GAP); record it and treat it as a stop.
- Stop rule: when a targeted test fails, a tree hash differs, a hook refuses the commit, or a precondition fails, do not commit, do not edit code, do not abort the merge. Record the test name, exit code and the last 40 lines of output in SUMMARY. Then return `NEEDS_HUMAN: <one question>`. Leave the in-progress merge in place for the main session.
- Write each commit message to a file in the executor scratchpad directory with the Write tool, then run `git commit -F <file>`. End each message with the line: Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
- The executor commits only the 3 merge commits. The orchestrator commits PLAN and SUMMARY. Do not stage .planning/quick/261104-fva-plugin-release-integration-vi0-a2s-secti/.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Merge quick/261103-vi0-typecheck-strict (merge 1)</name>
  <files>tests/run-all-380.sh, tests/test-380-gate-wiring.cjs, .planning/quick/261103-vi0-typecheck-gate-strictness-when-deps-miss/261103-vi0-FINDINGS.md, .planning/quick/261103-vi0-typecheck-gate-strictness-when-deps-miss/261103-vi0-SUMMARY.md</files>
  <action>
Preflight. Confirm all of these, and stop with NEEDS_HUMAN if one is false: `git rev-parse --abbrev-ref HEAD` prints integration/release-next; `git rev-parse HEAD` prints a3a293c93d6b22bef1ecd24eb6566fe33007753f; `git status --porcelain --untracked-files=no` prints nothing; `git rev-parse -q --verify MERGE_HEAD` prints nothing; the 3 branch tips equal the 3 full SHAs in the context block (`git rev-parse quick/261103-vi0-typecheck-strict quick/261030-intent-classifier quick/section-job-room-declarations`).

Merge. Run `git merge --no-ff --no-commit quick/261103-vi0-typecheck-strict`. The merge is clean. Run `git write-tree` and confirm it prints d444acbe3ba9e9a0f4b69d04903b02fefdd2c8b7. Run `git diff --cached --name-only HEAD` and confirm exactly the 4 files in this task.

Test. Run `node tests/test-380-gate-wiring.cjs` (W5 calls the Desktop payload check with a 280 s limit). Read the last line, `test-380-gate-wiring: N passed, N failed, N skipped`, and the exit code. Record PASSED, FAILED and SKIPPED. Then run `git diff --quiet` (working tree against index) to prove the test changed no tracked file.

Commit. Message subject: "Merge quick 261103-vi0: the 380 typecheck leg fails, not skips, when TypeScript is missing". Body: the branch name and tip 11ad37af7; the line "Targeted test: node tests/test-380-gate-wiring.cjs: P passed, F failed, S skipped" with the real numbers; a blank line; the Co-Authored-By line. Run `git commit -F <file>`. Record the merge 1 SHA.
  </action>
  <verify>
    <automated>cd /home/jsagi/gsd-workspaces/integration-release && test "$(git rev-parse HEAD^{tree})" = d444acbe3ba9e9a0f4b69d04903b02fefdd2c8b7 && test "$(git rev-parse HEAD^1)" = a3a293c93d6b22bef1ecd24eb6566fe33007753f && test "$(git rev-parse HEAD^2)" = 11ad37af71e17f3c3b3059afb378a8f2f926521e && test -z "$(git status --porcelain --untracked-files=no)" && git log -1 --format=%B | grep -q 'Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>' && echo MERGE1_OK</automated>
  </verify>
  <done>Merge 1 is committed with parents a3a293c93 and 11ad37af7 and tree d444acbe3. test-380-gate-wiring exits 0 with 0 failed; its counts are in the commit message and noted for SUMMARY. The merge 1 SHA is noted.</done>
</task>

<task type="auto">
  <name>Task 2: Merge quick/261030-intent-classifier (merge 2, quick 261030-a2s)</name>
  <files>lib/core/brain-client.cjs, lib/core/hook-compile-cache.cjs, scripts/intent-classifier, scripts/intent-classifier.cjs, scripts/minto-drain-on-prompt.cjs, tests/test-261030-a2s-classifier-parity.cjs, tests/test-261030-a2s-compile-cache.cjs</files>
  <action>
Merge. Run `git merge --no-ff --no-commit quick/261030-intent-classifier`. The merge is clean. Run `git write-tree` and confirm it prints 42d056f382773fae3493c61bf4db91c0992f6e36. Run `git diff --cached --name-only HEAD` and confirm exactly the 7 files in this task.

Test 1. Run `node tests/test-261030-a2s-classifier-parity.cjs` (default mode, OLD vs NEW). It prints one `PASS <case id>` line per equal case and ends with `PARITY default: N cases, M diffs`. Record PASSED as the count of lines that start with `PASS ` and FAILED as M. Record the exit code (0 only on 0 diffs).

Test 2. Run `node tests/test-261030-a2s-compile-cache.cjs`. It ends with `compile-cache: N passed, N failed`. Record both numbers and the exit code.

Then run `git diff --quiet` to prove the tests changed no tracked file.

If a test fails, apply the stop rule. Merge 1 stays committed. Leave merge 2 uncommitted and in progress. Return: `NEEDS_HUMAN: Merge 2 test <name> failed (<counts>); abort merge 2 with git merge --abort and continue with merge 3, or hold the integration?` Do not run Task 3.

Commit. Message subject: "Merge quick 261030-a2s: one node start per prompt for the intent-classifier hook, per-user compile cache, lazy ajv". Body: the branch name and tip 233361b79; two lines with the real counts, one per test; a blank line; the Co-Authored-By line. Run `git commit -F <file>`. Record the merge 2 SHA.
  </action>
  <verify>
    <automated>cd /home/jsagi/gsd-workspaces/integration-release && test "$(git rev-parse HEAD^{tree})" = 42d056f382773fae3493c61bf4db91c0992f6e36 && test "$(git rev-parse HEAD^2)" = 233361b79923b5c908d47e2db21d8669257094de && test "$(git rev-parse HEAD^1^2)" = 11ad37af71e17f3c3b3059afb378a8f2f926521e && test -z "$(git status --porcelain --untracked-files=no)" && git log -1 --format=%B | grep -q 'Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>' && echo MERGE2_OK</automated>
  </verify>
  <done>Merge 2 is committed with parents merge 1 and 233361b79 and tree 42d056f38. The parity test reports 0 diffs and exit 0. The compile-cache test reports 0 failed and exit 0. Counts are in the commit message and noted for SUMMARY. The merge 2 SHA is noted.</done>
</task>

<task type="auto">
  <name>Task 3: Merge quick/section-job-room-declarations (merge 3), resolve CHANGELOG.md and STATE.md by keeping both sides, write SUMMARY</name>
  <files>CHANGELOG.md, .planning/STATE.md, data/doctor-modules.json, lib/core/doctor/section-ruling-module.cjs, lib/core/feyminto/next-move.cjs, lib/core/navigation-engine.cjs, lib/core/room-skeleton-scaffold.cjs, lib/core/section-registry.cjs, tests/run-all-353.sh, tests/test-353-doctor-section-ruling.cjs, tests/test-353-room-section-jobs.cjs, .planning/quick/261028-gmg-room-level-section-job-declarations/ (3 files), .planning/quick/261104-fva-plugin-release-integration-vi0-a2s-secti/261104-fva-SUMMARY.md</files>
  <action>
Merge. Run `git merge --no-ff --no-commit quick/section-job-room-declarations`. Expect git to report a content conflict in CHANGELOG.md and in .planning/STATE.md and nothing else. Run `git diff --name-only --diff-filter=U` and confirm exactly those 2 paths. If a third path conflicts, apply the stop rule.

Resolve CHANGELOG.md. The integration side already holds every bullet that the branch side adds: in "### Added" the `/mos:doctor` mcp-write-path bullet and the MCP client name and version bullet; in "### Fixed" the "Claude Code can now save to the room by default" bullet and the "write_path_disabled message" bullet; in "### Changed" the CLI MCP App views bullet. So the union of both sides equals the integration side. Run `git checkout --ours -- CHANGELOG.md` (a path checkout of stage 2, not a branch checkout), then `git add -- CHANGELOG.md`. Confirm `git hash-object CHANGELOG.md` prints c2b1672275872f39f9cddbe9676b78c5493f873a. Confirm each of the 5 branch bullets is present exactly once: for every line of `git diff 72b9dd17bc05110c1b49de0b7a7c4d7e76be1ed4 88aa00e041ad58f499bb08a8e11ee1c1325e14dc -- CHANGELOG.md` that starts with `+- `, `grep -cxF` of that line without its first character, against CHANGELOG.md, prints 1. Heading lines such as "### Fixed" repeat in every release section; do not count them.

Resolve .planning/STATE.md. Do not type the rows by hand. Run this resolver once; it moves the theirs block (the 261028-gmg row) in front of the ours block (the six 261029 rows), drops the 3 marker lines, keeps every byte of every row, and refuses (assertion error) if the file holds other than exactly 1 conflict region: `python3 -c "import sys; p=sys.argv[1]; L=open(p,encoding='utf-8',newline='').read().splitlines(keepends=True); a=[i for i,l in enumerate(L) if l.startswith('<<<<<<< ')]; m=[i for i,l in enumerate(L) if l.rstrip()=='=======']; z=[i for i,l in enumerate(L) if l.startswith('>>>>>>> ')]; assert len(a)==len(m)==len(z)==1 and a[0]<m[0]<z[0]; s,e,t=a[0],m[0],z[0]; open(p,'w',encoding='utf-8',newline='').write(''.join(L[:s]+L[e+1:t]+L[s+1:e]+L[t+1:]))" .planning/STATE.md`. If the assertion fails, apply the stop rule. The text "Not merged, not released." in the 261028-gmg row stays as it is: the task adds no new claim. Run `git add -f -- .planning/STATE.md`. Confirm `git hash-object .planning/STATE.md` prints c4e7e42be810b4f82ec030ed68a4d02b00e0277e, and `git diff --cached --numstat HEAD -- .planning/STATE.md` prints 1 added and 0 deleted.

Tree check. Run `git diff --name-only --diff-filter=U` (prints nothing) and `git write-tree` (prints c6d02fb2dc0cf4363bc373c36e2a0636714aeac7). Confirm no conflict marker remains: `git diff --cached HEAD | grep -c '^+\(<<<<<<<\|=======\|>>>>>>>\)'` prints 0. Confirm no dash was added: `git diff --cached HEAD -- CHANGELOG.md .planning/STATE.md | python3 -c "import sys; print(sum(1 for l in sys.stdin if l.startswith('+') and (chr(0x2014) in l or chr(0x2013) in l)))"` prints 0.

Test (6 runs; record PASSED, FAILED and the exit code for each). Run `node tests/test-353-room-section-jobs.cjs` and `node tests/test-353-doctor-section-ruling.cjs` (each ends with `PASS=N FAIL=N`). Run `node tests/test-doctor-mcp-write-path.cjs` (ends with `N passed, N failed`). Re-run `node tests/test-261030-a2s-classifier-parity.cjs`, `node tests/test-261030-a2s-compile-cache.cjs` and `node tests/test-380-gate-wiring.cjs`. Then run `git diff --quiet`. If a test fails, apply the stop rule and return: `NEEDS_HUMAN: Merge 3 test <name> failed (<counts>); hold merge 3 uncommitted for review, or abort it?`

Commit. Message subject: "Merge quick 261028-gmg and 261026-s8c: room-level section job declarations". Body, in this order: the branch name and tip 88aa00e04; "8 of the 12 branch commits are already in main by patch-id (git cherry shows -)."; "CHANGELOG.md conflict: kept the integration side, which already holds all 5 bullets the branch side adds (2 Added, 2 Fixed, 1 Changed). No entry lost, no entry added."; ".planning/STATE.md conflict: kept both sides; the 261028-gmg row stands before the six 261029 rows, in quick id order."; "No code file edited by hand."; one line per targeted test with the real counts; a blank line; the Co-Authored-By line. Run `git commit -F <file>`. Record the merge 3 SHA. It is the integration branch tip.

SUMMARY. Write .planning/quick/261104-fva-plugin-release-integration-vi0-a2s-secti/261104-fva-SUMMARY.md with the Write tool, in STE-style English, with no em or en dash. Include: the start SHA a3a293c93d6b22bef1ecd24eb6566fe33007753f; merge 1, merge 2 and merge 3 SHAs (full 40 characters) with their tree hashes; the final tip SHA of integration/release-next; the 2 conflict notes from this task; a table with one row per test run (merge, test file, PASSED, FAILED, SKIPPED, exit code); any untracked file a test left behind (`git status --porcelain` lines that start with "??", outside .planning/quick/261104-fva-plugin-release-integration-vi0-a2s-secti/); the note "No brand rule applies; no design decision made."; and the fields STATUS, CHANGED, VERIFIED, UNVERIFIED, RISKS, NEXT. Do not stage or commit SUMMARY.
  </action>
  <verify>
    <automated>cd /home/jsagi/gsd-workspaces/integration-release && test "$(git rev-parse HEAD^{tree})" = c6d02fb2dc0cf4363bc373c36e2a0636714aeac7 && test "$(git rev-parse HEAD^2)" = 88aa00e041ad58f499bb08a8e11ee1c1325e14dc && test "$(git rev-parse HEAD^1^2)" = 233361b79923b5c908d47e2db21d8669257094de && test "$(git rev-parse HEAD:CHANGELOG.md)" = c2b1672275872f39f9cddbe9676b78c5493f873a && test "$(git rev-parse HEAD:.planning/STATE.md)" = c4e7e42be810b4f82ec030ed68a4d02b00e0277e && test "$(git rev-list --count --merges --first-parent a3a293c93d6b22bef1ecd24eb6566fe33007753f..HEAD)" = 3 && test -z "$(git status --porcelain --untracked-files=no)" && test "$(git rev-parse HEAD)" = "$(git rev-parse integration/release-next)" && test -f .planning/quick/261104-fva-plugin-release-integration-vi0-a2s-secti/261104-fva-SUMMARY.md && python3 -c "import sys; d=open(sys.argv[1],encoding='utf-8').read(); sys.exit(1 if (chr(0x2014) in d or chr(0x2013) in d) else 0)" .planning/quick/261104-fva-plugin-release-integration-vi0-a2s-secti/261104-fva-SUMMARY.md && echo MERGE3_OK</automated>
  </verify>
  <done>Merge 3 is committed with parents merge 2 and 88aa00e04 and tree c6d02fb2d. CHANGELOG.md equals the first parent and holds each of the 5 branch bullets once. STATE.md holds the 261028-gmg row and the six 261029 rows. All 6 targeted test runs exit 0 with 0 failed. SUMMARY exists, uncommitted, with the 3 merge SHAs, the tip SHA, the conflict notes and the test table.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| quick branches -> integration/release-next | Branch content enters the release candidate tip |
| integration worktree -> origin | A push would publish an unreviewed tip (forbidden in this plan) |
| this worktree -> shared object store and refs | Other sessions use the same repository (workspace/phase-369-6, the stash stack) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-261104-fva-01 | Tampering | branch tips | mitigate | Preflight compares each tip with the full SHA; every merge checks the predicted tree hash before commit and the parents after commit |
| T-261104-fva-02 | Tampering | conflict resolution | mitigate | Resolved blobs are checked against c2b16722 (CHANGELOG.md) and c4e7e42b (STATE.md); the STATE.md resolver asserts exactly 1 conflict region; marker and dash checks run on the staged diff |
| T-261104-fva-03 | Elevation of Privilege | git push, tag, release.sh, merge into main | mitigate | Forbidden list in the context block; the main session reviews every commit ahead of origin before any push |
| T-261104-fva-04 | Tampering | another session's work | mitigate | No stash, no reset --hard, no checkout of another branch, no command that names workspace/phase-369-6; staging names explicit paths only |
| T-261104-fva-05 | Repudiation | merge record | mitigate | Each merge commit message carries the branch tip, the test counts and, for merge 3, the conflict notes |
| T-261104-fva-06 | Information Disclosure | node_modules symlink | accept | Excluded by .git/info/exclude; `git add -A` and `git add .` are forbidden, so it cannot be staged |
</threat_model>

<verification>
- `git log --oneline --first-parent a3a293c93..integration/release-next` shows exactly 3 merge commits in the order vi0, a2s, section.
- `git rev-parse integration/release-next^{tree}` prints c6d02fb2dc0cf4363bc373c36e2a0636714aeac7.
- `git status --porcelain --untracked-files=no` prints nothing.
- `git log origin/main..integration/release-next --format=%H%x09%s` lists the 3 merges plus the branch commits that main does not hold; nothing is pushed.
- No command in this plan names branch workspace/phase-369-6. Its owner session (jsagi-8f) can move it during the run; a move by that session is not a failure of this plan.
</verification>

<success_criteria>
- 3 merge commits exist on integration/release-next with the predicted trees d444acbe3, 42d056f38 and c6d02fb2d.
- Every targeted test run exits 0 with 0 failed; the counts are in SUMMARY and in the commit messages.
- CHANGELOG.md and .planning/STATE.md keep the entries of both sides; no code file is edited by hand; no em or en dash is added.
- No push, tag, release.sh run, merge into main, stash or reset happened.
</success_criteria>

<output>
Write `.planning/quick/261104-fva-plugin-release-integration-vi0-a2s-secti/261104-fva-SUMMARY.md` when done. Do not commit it; the orchestrator commits PLAN and SUMMARY.
</output>
