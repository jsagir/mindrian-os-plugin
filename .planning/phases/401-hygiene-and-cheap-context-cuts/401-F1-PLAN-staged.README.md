# 401-F1-PLAN-staged.md: where this plan belongs

1. The file 401-F1-PLAN-staged.md in this folder is a staged copy. It is not in its final place.
2. Its final place is `.planning/quick/261127-f1a-frontmatter-split-fix/261127-f1a-PLAN.md` in worktree `/home/jsagi/dev/MindrianOS-Plugin-401f1` (branch `work/401-f1-frontmatter`).
3. Copy it there, unchanged, from a session whose cwd is that worktree.
4. Start the executor with cwd `/home/jsagi/dev/MindrianOS-Plugin-401f1`.
5. Start the executor with `NODE_PATH=/home/jsagi/dev/MindrianOS-Plugin/node_modules`.
6. Reason for the staged copy: the worktree path guard refused a Write from cwd 405 into worktree 401f1. The planner did not pass around the guard.

All numbers below are PROVEN. The planner measured them with read-only runs in worktree 401f1 at commit acb4de477 on 2026-11-27.

## Measured baseline

Rule: line 1 is `---`. The closing fence is the first later line that is exactly `---`. A file offends when a line between the fences holds the substring `---`.

| Measure | Value |
|---|---|
| Files | 255 (commands 113, skills 125, agents 17) |
| Offending files | 253 (commands 112 of 113, skills 124 of 125, agents 17 of 17) |
| Offending lines | 383 (commands 177, skills 189, agents 17); 39 different line texts |
| Line shapes | 375 exact `# --- text ---`; 8 lines of 4 two-line comment blocks; 0 non-comment lines; 0 indented lines |
| Clean files | commands/grade-grant.md, skills/grade-grant/SKILL.md |
| Sources / mirrors | sources 142 files, 208 lines (commands 112, agents 17, hand-authored skills 13); mirrors 111 files, 175 lines |
| Keys, repo view | hitl_shape 210, hitl_stages 34, allowed-tools 227 |
| Keys, host view now | hitl_shape 197, hitl_stages 29, allowed-tools 118 (lost in 13, 5 and 109 files) |
| YAML after the rewrite | 255 of 255 blocks parse (js-yaml and gray-matter); 0 duplicate keys; description is a string in 255 |
| Writers of such lines | scripts/build-new-surface.cjs:208 and :253 only (repo-wide grep) |
| Digest pins of surface files | data/harness-manifest.json only (agents/larry-extended.md, skills/larry-personality/SKILL.md) |

## Gate baseline

Dependencies came through NODE_PATH from the main checkout.

| Gate | Exit | Note |
|---|---|---|
| node scripts/build-skill-mirrors.cjs --check | 0 | 112 mirrors match |
| node scripts/build-connector-registry.cjs --check | 0 | exit 1 with no node_modules (20 mcp_tool GAP lines, 3 STALE lines): ENV GAP, not drift |
| node scripts/check-shape-declaration.cjs --check | 0 | advisory, 55 violations |
| node scripts/check-shape-declaration.cjs (bare, as in the brief) | 2 | prints usage only; it runs no check |
| node scripts/build-orchestration-projection.cjs --check | 0 | |
| node scripts/build-harness-manifest.cjs --check | 1 | RED before: decide_engine digest of lib/core/navigation-engine.cjs drifts |
| node scripts/check-render-coverage.cjs | 0 | 17 covered; 195 wired, 2 excluded, 0 unwired |
| node scripts/build-command-registry.cjs --check | 0 | pre-commit gate |
| node lib/core/command-registration-check.cjs | 0 | 113 scanned, 39 warnings; pre-commit gate |
| node scripts/check-reward-before-investment.cjs | 0 | 113 compliant; pre-commit gate |

## Tests that are red before the change

- tests/test-3696-voice-first-budget.cjs: leg V7. 5 live lines are not in the base (1 comment line of quick 261108-es3 and the 4 job keys).
- tests/test-201-harness-manifest.cjs: the manifest is stale (decide_engine digest).
- tests/test-234-dist-bundle.cjs: 4 checks. dist/ was generated from 2.0.0-beta.52; the live version is 2.0.0-beta.94.

Gate that is red before the change: `node scripts/build-harness-manifest.cjs --check` (exit 1).

Tests that are green now and go red after the fix (the plan re-pins them with a reason):

- tests/test-348-doctrine-present.cjs: line 52 pins `# --- Phase 172-06 CIRS R1 exclude (Canon Part 11) ---`.
- tests/test-3696-skill-budget.cjs: leg S3 compares the live frontmatter with an immutable fixture.
- tests/test-400-review-lists.cjs: 400-LABEL-REVIEW.md lines 82 to 84 pin count 27 and a list of 2. After the fix the values are 0 and 29.

## Risks (8)

1. An executor with cwd 405 cannot Edit or Write in 401f1. The same guard stops it. Start the executor with cwd 401f1.
2. Worktree 401f1 has no node_modules. The shared pre-commit hook runs the connector-registry gate when a commands, skills or agents file is staged. With no dependencies the gate exits 1 and the hook refuses the commit. NODE_PATH from the main checkout makes the gate green. The plan forbids a hook bypass.
3. The manifest check is red before the change. The plan regenerates data/harness-manifest.json in the commit of the 2 Larry surfaces. The regeneration takes in the earlier decide_engine drift. A later regeneration on main can conflict on that file.
4. After a release, allowed-tools is host-read in 109 files (55 commands, 54 skills). Tool totals that become pre-approved: Read 109, Bash 105 (unscoped), AskUserQuestion 96, Write 91, Glob 87, Task 12, WebFetch 6, WebSearch 4, Agent 4, MCP names 40. The plan does not edit the keys. This is an owner note before a release.
5. dist/ (250 of 267 markdown files), the 18 copies under r-and-d/breakthrough-engines and 5 files under tests/fixtures keep the old lines. dist/ is rebuilt only at a release.
6. No runner and no pre-commit entry runs the new test. A new offender is found only when the test is run.
7. The planner ran on model claude-fable-5-2. The memory rule "Never use the Fable model" applies to subagent spawns unless the owner asked for it in this instance.
8. 11 of 143 source bodies mention frontmatter. After the fix the model no longer sees the keys below the old split point as body text. The risk is low: commands/file-meeting.md:753 quotes its value in the same line.

Not verified: the duration of the 690-test sweep; the full set of tests that go red after the fix (3 are known, the sweep finds the rest); the host rule is assumption A1 of 400.1-RESEARCH.md (inferred from 3 host records).
