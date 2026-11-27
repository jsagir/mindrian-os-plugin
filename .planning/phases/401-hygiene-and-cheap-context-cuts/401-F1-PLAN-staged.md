---
phase: quick-261127-f1a
quick_id: 261127-f1a
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/check-frontmatter-split.cjs
  - tests/test-401-frontmatter-split.cjs
  - scripts/build-new-surface.cjs
  - "commands/*.md"
  - "agents/*.md"
  - "skills/*/SKILL.md"
  - data/harness-manifest.json
  - tests/test-348-doctrine-present.cjs
  - tests/test-3696-skill-budget.cjs
  - tests/test-3696-voice-first-budget.cjs
  - .planning/phases/400-job-sentences-with-three-stored-slots-on-every-capability-a-/400-LABEL-REVIEW.md
autonomous: true
requirements: [QUICK-261127-f1a, F1]
owner_decision: "OR-14: Phase 401 plan F1 runs first"

must_haves:
  truths:
    - "node scripts/check-frontmatter-split.cjs --check reports 0 of 255 offending files (baseline at acb4de477: 253 of 255; commands 112 of 113, skills 124 of 125, agents 17 of 17; 383 lines)"
    - "For each of the 255 files the host view of the frontmatter equals the repo view; host-read key totals go from hitl_shape 197, hitl_stages 29, allowed-tools 118 to 210, 34, 227; no file loses a key in either view"
    - "Only column-0 comment lines inside frontmatter changed: for each file the non-comment frontmatter lines, the body and the line count are byte-identical before and after"
    - "A surface that scripts/build-new-surface.cjs renders from a normal spec holds no triple dash inside its frontmatter"
    - "Each gate has a recorded result before the change and after the change; a gate that was red before is reported as red before"
    - "Each test that pinned an old comment line or a digest of a changed file is re-pinned and the reason is written in the test"
  artifacts:
    - path: "scripts/check-frontmatter-split.cjs"
      provides: "Rule F1 as one module: --check, --fix, --census, --census-compare; pure exported functions"
      exports: ["listSurfaceFiles", "frontmatterBounds", "findOffenders", "rewriteLine", "rewriteText", "hostFrontmatter", "census"]
    - path: "tests/test-401-frontmatter-split.cjs"
      provides: "Test legs T1 to T5 for rule F1"
      min_lines: 80
    - path: "data/harness-manifest.json"
      provides: "Regenerated manifest (digests of agents/larry-extended.md and skills/larry-personality/SKILL.md changed)"
  key_links:
    - from: "tests/test-401-frontmatter-split.cjs"
      to: "scripts/check-frontmatter-split.cjs"
      via: "require of the rule module (one owner of the rule)"
      pattern: "check-frontmatter-split\\.cjs"
    - from: "tests/test-3696-skill-budget.cjs"
      to: "scripts/check-frontmatter-split.cjs"
      via: "rewriteText applied to the immutable base fixture before the S3 compare"
      pattern: "rewriteText"
    - from: "tests/test-401-frontmatter-split.cjs"
      to: "scripts/build-new-surface.cjs"
      via: "leg T4 renders a wired surface and an excluded expert skill and checks them with findOffenders"
      pattern: "renderExcludedExpertSkill"
---

<objective>
Close finding F1 of 400.1-RESEARCH.md (owner ruling OR-14: this plan runs first in Phase 401).

The host ends the frontmatter of a file at the first `---` after line 1. A comment line such as `# --- Phase 122 workflow-layer frontmatter ---` ends the frontmatter early. Each key below that line becomes body text. 253 of 255 surface files have such a line.

Purpose: the host must read each key that a file declares. Each invocation also stops carrying about 620 B of dead frontmatter as body text.

Output:
1. scripts/check-frontmatter-split.cjs: the rule, the fixer and the key census.
2. tests/test-401-frontmatter-split.cjs: fails when a surface file offends.
3. 253 surface files with rewritten comment lines (142 sources by the fixer, 111 mirrors by scripts/build-skill-mirrors.cjs). Form: `# == text ==`.
4. scripts/build-new-surface.cjs writes `# == text ==`.
5. Re-pinned tests, a regenerated data/harness-manifest.json, and a before and after table of each gate in the SUMMARY.

Not in this plan: a change of a frontmatter key or value; the unscoped tool-name sweep (K6); the mcp-server-brain removal; dist/ (250 of its 267 markdown files hold the old lines; generated from 2.0.0-beta.52; red before); the 18 copies under r-and-d/breakthrough-engines; tests/fixtures; a guard for a caller description that holds `---`; a test runner entry or a pre-commit entry for the new test.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/phases/400.1-efficiency-research-verify-the-2026-11-24-efficiency-finding/400.1-RESEARCH.md
@scripts/build-skill-mirrors.cjs
@scripts/build-new-surface.cjs
@scripts/check-shape-declaration.cjs
@tests/test-new-surface-generator.cjs
@tests/run-all-400.4.sh

Apply /home/jsagi/.claude/protocols/agent-interaction-protocol.md to each report.

## Rule F1

- Opening fence: line 1 is exactly `---`.
- Closing fence: the first later line that is exactly `---`. This is the rule of frontmatterBounds in scripts/build-skill-mirrors.cjs. The repo parsers use it.
- Host rule (400.1-RESEARCH.md, "New finding F1", assumption A1): the host ends frontmatter at the first `---` after the opening fence, also in the middle of a line.
- A file offends when a line between the two fences holds the substring `---`.

## Baseline that the planner measured at acb4de477 (PROVEN)

| Measure | Value |
|---|---|
| Files | 255 (commands 113, skills 125, agents 17) |
| Offending files | 253 (commands 112 of 113, skills 124 of 125, agents 17 of 17) |
| Offending lines | 383 (commands 177, skills 189, agents 17) |
| Line shapes | 375 exact `# --- text ---`; 8 lines of 4 two-line comment blocks; 0 non-comment lines; 0 indented lines |
| Clean files | commands/grade-grant.md, skills/grade-grant/SKILL.md |
| Sources | 142 files, 208 lines (commands 112 and 177; agents 17 and 17; hand-authored skills 13 and 14) |
| Mirrors | 111 files, 175 lines |
| Keys, repo view | hitl_shape 210, hitl_stages 34, allowed-tools 227 |
| Keys, host view | hitl_shape 197, hitl_stages 29, allowed-tools 118 |

Hand-authored skills (13): brain-connector, client-discovery-interview, context-engine, conversation-mode, intelligence-orchestrator, larry-personality, mos-deck-engine, mullins-scaffold, pws-methodology, room-passive, room-proactive, ui-system, trending-to-absurd (SKIP_LIST of the mirror builder).

## Gates (planner result before the change)

| Id | Command | Exit | Note |
|---|---|---|---|
| G1 | node scripts/build-skill-mirrors.cjs --check | 0 | 112 mirrors match |
| G2 | node scripts/build-connector-registry.cjs --check | 0 | exit 1 with no dependencies: ENV GAP |
| G3 | node scripts/check-shape-declaration.cjs --check | 0 | advisory, 55 violations |
| G3b | node scripts/check-shape-declaration.cjs | 2 | usage text only; the bare form runs no check |
| G4 | node scripts/build-orchestration-projection.cjs --check | 0 | |
| G5 | node scripts/build-harness-manifest.cjs --check | 1 | RED before: decide_engine digest drift |
| G6 | node scripts/check-render-coverage.cjs | 0 | 17 covered; 195 wired, 2 excluded, 0 unwired |
| G7 | node scripts/build-command-registry.cjs --check | 0 | pre-commit gate |
| G8 | node lib/core/command-registration-check.cjs | 0 | 113 scanned, 39 warnings; pre-commit gate |
| G9 | node scripts/check-reward-before-investment.cjs | 0 | 113 compliant; pre-commit gate |

## Tests that the planner measured

- tests/test-348-doctrine-present.cjs: green; line 52 pins the old comment line of skills/larry-personality/SKILL.md.
- tests/test-3696-skill-budget.cjs: green; leg S3 compares the live frontmatter with the immutable fixture tests/fixtures/3696-persona-h/SKILL.md.
- tests/test-400-review-lists.cjs: green; 400-LABEL-REVIEW.md lines 82 to 84 pin count 27 and a list of 2.
- tests/test-3696-voice-first-budget.cjs: RED before (leg V7: 5 live lines are not in the base: 1 comment line of quick 261108-es3 and the 4 job keys).
- tests/test-201-harness-manifest.cjs: RED before (manifest stale).
- tests/test-234-dist-bundle.cjs: RED before (4 checks; dist/ is stale).

## Pre-commit hook facts (core.hooksPath is /home/jsagi/dev/MindrianOS-Plugin/.git/hooks)

- A staged commands, skills or agents file starts G2. G2 needs dependencies. The worktree has no node_modules.
- A staged commands or skills file starts G1. Sources and mirrors must be in one commit.
- A staged agents/larry-extended.md, skills/larry-personality/SKILL.md or data/harness-manifest.json starts G5. The manifest must be regenerated in that commit.
- A staged command starts G7, G8 and the staged form of G9.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Record the baseline, then add the rule module and the test (test red)</name>
  <files>scripts/check-frontmatter-split.cjs, tests/test-401-frontmatter-split.cjs</files>
  <read_first>scripts/build-skill-mirrors.cjs (frontmatterBounds, SKIP_LIST, module.exports), scripts/check-shape-declaration.cjs (CLI shape: usage and exit 2), scripts/build-new-surface.cjs (renderSurface, renderExcludedExpertSkill, CONNECTOR_KEYS), tests/test-new-surface-generator.cjs (validSpec near line 73), tests/run-all-400.4.sh (HOME, MINDRIAN_ROOMS_HOME and stdin isolation)</read_first>
  <behavior>
    - T1: findOffenders returns no entry for each file of listSurfaceFiles. The failure text holds the count for each class and the first 10 path:line pairs.
    - T2: for each file, hostFrontmatter equals the text between the fences, and the census host counts equal the repo counts.
    - T3: gray-matter parses each file; data.description is a string; the number of YAML top-level keys equals the number of column-0 key lines between the fences. When gray-matter does not load, the leg FAILS with the text "ENV GAP: gray-matter not resolvable". The leg never skips.
    - T4: renderSurface (kind command, a spec built from CONNECTOR_KEYS as validSpec does) and renderExcludedExpertSkill (kind skill, excluded true, an expert object with name, surname and hat) give text with 0 offenders.
    - T5: rewriteLine turns "# --- Phase 122 workflow-layer frontmatter ---" into "# == Phase 122 workflow-layer frontmatter =="; it rewrites the open line and the close line of a two-line comment block; a run of 5 hyphens becomes "=="; a second pass changes nothing; a body line "---" and a body line "# --- x ---" below the closing fence do not change; the line "description: a --- b" does not change and is reported unfixable; one real file text with "# --- x ---" put after line 1 gives 1 offender (mutation control).
  </behavior>
  <action>
1. Preconditions. `git rev-parse --show-toplevel` must print /home/jsagi/dev/MindrianOS-Plugin-401f1 and the session working directory must be that folder. `git rev-parse --abbrev-ref HEAD` must print work/401-f1-frontmatter. `git status --short` must print nothing. If a check fails, stop and report STATUS: BLOCKED. Do not use Bash to write a file that the Edit tool or the Write tool refuses.
2. Dependencies. Run `node -e "require('gray-matter');require('zod')"`. If it fails, run `export NODE_PATH=/home/jsagi/dev/MindrianOS-Plugin/node_modules` and run it again. If it fails again, stop and report STATUS: BLOCKED (ENV GAP). Do not run npm install. Keep NODE_PATH for each later command of this plan, also for `git commit`.
3. Evidence folder: .planning/quick/261127-f1a-frontmatter-split-fix/evidence/ with the folders before/ and after/. Git ignores it. Do not commit it.
4. Gate baseline. Run G1 to G9 and G3b from the context table. Save the output of each gate to evidence/before/G<id>.txt and add a last line `EXIT=<code>`. Compare each exit code with the context table. Record each difference; do not correct it.
5. Candidate list. Run `git ls-files 'tests/test-*.cjs' 'tests/*.test.cjs' 'scripts/*.test.cjs' 'lib/**/*.test.cjs' 'tests/test-*.sh' | sort -u | xargs grep -lE "commands|skills|agents|SKILL\.md|frontmatter|harness-manifest|build-new-surface|build-skill-mirrors"` and save the result to evidence/candidates.txt. The planner counted 690 paths (666 node, 24 bash).
6. Sweep before. For each path of candidates.txt, in order, run `timeout 120 node <path>` (for a .sh path: `timeout 120 bash <path>`) with stdin from /dev/null and with HOME and MINDRIAN_ROOMS_HOME set to 2 new temp folders. Append one line `<exit code><TAB><path>` to evidence/tests-before.tsv. Run the loop in the background and wait until it ends. Do not create a file of this plan before the loop ends.
7. Tree check. Run `git status --short`. If a tracked file changed, save the text to evidence/before/tree-after-sweep.txt, run `git restore .` and name the paths in the SUMMARY. List each new untracked file outside the evidence folder; do not delete it.
8. Create scripts/check-frontmatter-split.cjs. Use node:fs, node:path and node:crypto only. Use CommonJS, 'use strict', a process.argv switch and a require.main guard. Exports: listSurfaceFiles(root) returns a sorted list of { rel, cls } for commands/*.md, skills/<dir>/SKILL.md and agents/*.md. frontmatterBounds(text) returns { lines, fmEnd } or null with the rule of the context section. findOffenders(text) returns { line, text, fixable } for each line between the fences that holds `---`; line is 1-based; fixable is true when the line starts with `#` at column 0. rewriteLine(line) replaces each run of 3 or more hyphens with `==` when the line starts with `#` at column 0; it returns each other line unchanged. rewriteText(text) applies rewriteLine to the lines between the fences only and returns { text, changed, unfixable }. hostFrontmatter(text) returns the text from the end of line 1 to the first later `---`, or null when line 1 is not `---`. census(text) returns { lines, body_sha256, noncomment_sha256, repo, host }; repo and host hold the counts of hitl_shape, hitl_stages and allowed-tools; a key counts when a line starts with the key and a colon at column 0; repo uses the lines between the fences; host uses the lines of hostFrontmatter; body_sha256 is the sha256 of the text below the closing fence; noncomment_sha256 is the sha256 of the frontmatter lines that do not start with `#` at column 0.
9. CLI of that script. No flag or an unknown flag: print usage, exit 2. `--check`: print one line `path:line: text` for each offender, then `frontmatter-split: <N> of <M> files offend (commands a of b, skills c of d, agents e of f; <L> lines)` and exit 1; with 0 offenders print `frontmatter-split: OK (<M> files)` and exit 0; a file with no fence pair is an offender. `--fix`: rewrite source files only, which are commands/*.md, agents/*.md, and skills/<name>/SKILL.md when commands/<name>.md does not exist or <name> is in SKIP_LIST of scripts/build-skill-mirrors.cjs; do not write a mirror; write a file only when its text changed; print `fixed: <files> files, <lines> lines` and one line `UNFIXABLE path:line: text` for each unfixable line; exit 1 when an unfixable line exists. `--census`: print one JSON object { files, totals } to stdout. `--census-compare <file>`: exit 1 with one line for each violation when a file is missing or new, when lines, body_sha256 or noncomment_sha256 differ, when a repo count differs, when a host count is lower than before, or when a host count differs from the repo count of the same file; print the totals before and after.
10. Create tests/test-401-frontmatter-split.cjs with legs T1 to T5 of the behavior block. Require the rule module; do not copy the rule. Print one `ok:` or `FAIL:` line for each leg, then `test-401-frontmatter-split: <p> passed, <f> failed`. Exit 1 when a leg fails.
11. Run `node scripts/check-frontmatter-split.cjs --check`. The summary line must hold `253 of 255 files offend (commands 112 of 113, skills 124 of 125, agents 17 of 17; 383 lines)`. Run the test: T1, T2 and T4 fail; T3 and T5 pass. If a number differs, stop and report it.
12. Run `node scripts/check-frontmatter-split.cjs --census` and save stdout to evidence/census-before.json. Totals must be repo 210, 34, 227 and host 197, 29, 118 (hitl_shape, hitl_stages, allowed-tools).
13. Commit the 2 new files only. Message: `fix(401-f1): add the frontmatter split rule module and its test (red: 253 of 255 files)`. The message ends with the line `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`. Write no em dash in a file or a message.
  </action>
  <verify>
    <automated>node scripts/check-frontmatter-split.cjs --check | grep -qF "253 of 255 files offend" && ! node tests/test-401-frontmatter-split.cjs >/dev/null 2>&1 && test -s .planning/quick/261127-f1a-frontmatter-split-fix/evidence/census-before.json && test -s .planning/quick/261127-f1a-frontmatter-split-fix/evidence/tests-before.tsv</automated>
  </verify>
  <done>The baseline of G1 to G9, G3b and the test sweep is on disk before a surface file changes. The rule module reports 253 of 255. The test is red on T1, T2 and T4 and green on T3 and T5. census-before.json holds the totals of step 12. One commit holds the 2 new files.</done>
</task>

<task type="auto">
  <name>Task 2: Apply the fix (generator, sources, mirrors, manifest)</name>
  <files>scripts/build-new-surface.cjs, commands/*.md, agents/*.md, skills/*/SKILL.md, data/harness-manifest.json</files>
  <read_first>scripts/build-new-surface.cjs (lines 200 to 260), scripts/build-harness-manifest.cjs (LARRY_SURFACE_BINDINGS), scripts/build-skill-mirrors.cjs (usage block)</read_first>
  <action>
1. Generator. In scripts/build-new-surface.cjs, in the 2 lines.push calls that write a comment line (line 208 in renderSurface, line 253 in renderExcludedExpertSkill), change the start `# --- ` to `# == ` and the end ` ---` to ` ==`. Change no other line. Known limit: a caller description that holds `---` still gives a split file; this plan adds no guard; name the limit in the SUMMARY. Run the test: T4 passes. Commit this file only: `fix(401-f1): the new-surface generator writes no triple dash inside frontmatter`.
2. Sources. Run `node scripts/check-frontmatter-split.cjs --fix`. It must print `fixed: 142 files, 208 lines` and exit 0. Run it again. It must print `fixed: 0 files, 0 lines`. If it prints an UNFIXABLE line, stop and report the line; do not edit it by hand.
3. Mirrors. Run `node scripts/build-skill-mirrors.cjs`, then `node scripts/build-skill-mirrors.cjs --check` (exit 0). `git status --short skills | wc -l` must print 124. If a mirror offends after this step, stop and report; do not edit a mirror by hand.
4. Proof of the change. `node scripts/check-frontmatter-split.cjs --check` must print `frontmatter-split: OK (255 files)`. `git diff --numstat -- commands skills agents` must show 253 files, the same added count and deleted count in each row, and the totals 383 and 383.
5. Census. Run `node scripts/check-frontmatter-split.cjs --census-compare .planning/quick/261127-f1a-frontmatter-split-fix/evidence/census-before.json` and save the output to evidence/census-compare.txt. It must exit 0. Totals after: repo 210, 34, 227 and host 210, 34, 227.
6. Manifest. Run `node scripts/build-harness-manifest.cjs`, then `node scripts/build-harness-manifest.cjs --check` (exit 0). Read `git diff data/harness-manifest.json` and record which entries changed. Expected: cli_agent, personality_skill and decide_engine. The decide_engine change is the drift that was red before this plan; say so in the commit message and in the SUMMARY. If the check exits non-zero after the regeneration, stop and report the output.
7. Run `node tests/test-401-frontmatter-split.cjs`. It must exit 0 with 5 legs passed.
8. Commit A. Run `git add commands agents skills`, then `git restore --staged agents/larry-extended.md skills/larry-personality/SKILL.md`. `git diff --cached --name-only | wc -l` must print 251 and each staged path must be a commands, agents or skills markdown file. Message: `fix(401-f1): rewrite the triple-dash comment lines in commands, agents and skills; regenerate 111 skill mirrors`.
9. Commit B. Stage agents/larry-extended.md, skills/larry-personality/SKILL.md and data/harness-manifest.json only. Message: `fix(401-f1): rewrite the comment lines of the two Larry surfaces and regenerate the harness manifest`, with one body line that says the manifest check was red before on the decide_engine digest and that the regeneration takes that drift in.
10. Each commit message ends with `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`. Do not use `git add -A`. If the pre-commit hook refuses a commit, save its output to evidence/, do not use `--no-verify` or `COMMIT_NO_VERIFY=1`, stop and report STATUS: BLOCKED.
  </action>
  <verify>
    <automated>node scripts/check-frontmatter-split.cjs --check && node tests/test-401-frontmatter-split.cjs && node scripts/build-skill-mirrors.cjs --check && node scripts/build-harness-manifest.cjs --check && node scripts/check-frontmatter-split.cjs --census-compare .planning/quick/261127-f1a-frontmatter-split-fix/evidence/census-before.json</automated>
  </verify>
  <done>0 of 255 files offend. The numstat totals are 383 and 383 in 253 files. The census compare exits 0 with host totals 210, 34, 227. The mirror check and the manifest check exit 0. Three commits exist: generator, 251 surface files, 2 Larry surfaces with the manifest. No hook was bypassed.</done>
</task>

<task type="auto">
  <name>Task 3: Sweep after, re-pin with reasons, compare each gate, write the SUMMARY</name>
  <files>tests/test-348-doctrine-present.cjs, tests/test-3696-skill-budget.cjs, tests/test-3696-voice-first-budget.cjs, .planning/phases/400-job-sentences-with-three-stored-slots-on-every-capability-a-/400-LABEL-REVIEW.md</files>
  <read_first>tests/test-348-doctrine-present.cjs (lines 37 to 80), tests/test-3696-skill-budget.cjs (frontmatterOf and leg S3 near line 110), tests/test-3696-voice-first-budget.cjs (leg V7 near line 149), tests/test-400-review-lists.cjs (lines 159 to 170 and parseReview), 400-LABEL-REVIEW.md (lines 77 to 84), tests/fixtures/3696-immutable-sources.json</read_first>
  <action>
1. Sweep after. Run the loop of Task 1 step 6 again with the same candidates.txt and the same environment. Write evidence/tests-after.tsv. Then run `git status --short`; if a tracked file changed, save the text, run `git restore .` and name the paths in the SUMMARY.
2. Classify each test by the 2 exit codes: green-green, red-red, red-green, green-red. Run each green-red test one more time alone before the class is final.
3. Re-pin tests/test-348-doctrine-present.cjs: in EXPECTED_FRONTMATTER change line 52 to `# == Phase 172-06 CIRS R1 exclude (Canon Part 11) ==`. Add a comment above the array: Phase 401 plan F1 (quick 261127-f1a) rewrote this comment line because the host ends frontmatter at the first triple dash; no key changed.
4. Re-pin tests/test-3696-skill-budget.cjs leg S3: require scripts/check-frontmatter-split.cjs and compare the live frontmatter (job keys dropped, as now) with frontmatterOf of rewriteText(base).text. Do not change the fixture; tests/fixtures/3696-immutable-sources.json pins its sha256. Add a comment with the same reason and the words "the base fixture is immutable, so the same rewrite is applied to the base before the compare".
5. tests/test-3696-voice-first-budget.cjs leg V7 was red before this plan. Apply the same rewriteText call to the base side of V7 and add the reason comment. V7 stays red. Confirm that the live frontmatter holds exactly 5 lines that the rewritten base does not hold (the comment line of quick 261108-es3 and the 4 job keys). Do not correct those 5 lines. Report V7 as red before and red after with the same cause.
6. Re-pin 400-LABEL-REVIEW.md. Run `node tests/test-400-review-lists.cjs`; leg V1 prints the missing ids of the list job-lines-not-after-comment. Set line 82 to `- count (job-lines-after-comment): 0`. Set line 83 to the full sorted list of 29 paths (17 agents, 12 standalone skills) joined with a comma and a space. Set line 84 to `- count (job-lines-not-after-comment): 29`. Replace line 81 with: `- F1 frontmatter end: closed by Phase 401 plan F1 (quick 261127-f1a). The comment lines inside frontmatter hold no triple dash now, so a host that ends frontmatter at the first triple dash reads every job key. No key changed.` Change no other line of that file. Do not change the test.
7. Each other green-red test. A re-pin is permitted only when the test fails on (a) the text of an old comment line, (b) a digest or a byte count of a changed file, or (c) a byte compare with an older copy of a changed file. Write the reason in the test. For each other cause, stop, do not edit the test, and report STATUS: BLOCKED with the test path and its output.
8. Do not regenerate dist/. Report tests/test-234-dist-bundle.cjs as red before and red after and name the failing checks of each run.
9. Run the re-pinned tests alone: tests/test-348-doctrine-present.cjs, tests/test-3696-skill-budget.cjs and tests/test-400-review-lists.cjs exit 0.
10. Gates after. Run G1 to G9 and G3b again; save each output to evidence/after/G<id>.txt with the `EXIT=<code>` line. Expected: G5 goes from 1 to 0; each other exit code is the same as before; G3 still reports 55 advisory violations; G6 still reports 17 covered and 195 wired, 2 excluded, 0 unwired.
11. Commit the re-pinned files only: `fix(401-f1): re-pin the tests that held the old comment lines`, with one body line for each file and its reason. The message ends with `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`. Stage 400-LABEL-REVIEW.md by its path (it is a tracked file under an ignored folder).
12. Write the SUMMARY (see the output section). It must hold: the F1 count before and after; the table of G1 to G9 and G3b with exit before, exit after and a note; the 4 class counts of the sweep and the name of each red-red, red-green and green-red test; the census totals before and after; the list of each re-pin with its reason; the manifest entries that changed; the known limits of the objective; and this owner note: allowed-tools becomes host-read in 109 files (55 commands, 54 skills), with the tool totals Read 109, Bash 105, AskUserQuestion 96, Write 91, Glob 87, Task 12, WebFetch 6, WebSearch 4, Agent 4, MCP names 40.
13. Do not push. Do not merge.
  </action>
  <verify>
    <automated>node tests/test-401-frontmatter-split.cjs && node tests/test-348-doctrine-present.cjs && node tests/test-3696-skill-budget.cjs && node tests/test-400-review-lists.cjs && node scripts/build-skill-mirrors.cjs --check && node scripts/build-connector-registry.cjs --check && node scripts/check-shape-declaration.cjs --check && node scripts/build-orchestration-projection.cjs --check && node scripts/build-harness-manifest.cjs --check && node scripts/check-render-coverage.cjs</automated>
  </verify>
  <done>No test is green before and red after without a written re-pin reason. Each red-before test is named as red before in the SUMMARY. G1 to G4 and G6 to G9 have the same exit code as before; G5 is 0. The 3 re-pinned tests exit 0. V7 is red before and red after with the same 5 lines. One commit holds the re-pins. The branch is not pushed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| plugin file to host parser | After the fix the host reads each frontmatter key of 253 files, not only the top part |
| codemod to 253 tracked files | A script rewrites lines in files that define commands, skills and agents |
| commit to shared pre-commit hook | The hook gates each commit of a surface file |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-401F1-01 | Elevation of privilege | allowed-tools becomes host-read in 109 files (Bash in 105, Write in 91) | accept | The keys are not edited (scope). The SUMMARY holds the file count and the tool totals for the owner to read before a release. The K6 plan of Phase 401 owns the per-file intent check. |
| T-401F1-02 | Tampering | codemod over 253 files | mitigate | rewriteLine acts only on column-0 comment lines between the fences. `--census-compare` proves equal lines, body_sha256, noncomment_sha256 and repo key counts for each file. numstat totals 383 and 383. |
| T-401F1-03 | Denial of service | the host parses the whole block; a YAML error can drop each key of a file | mitigate | Test leg T3 parses each of the 255 blocks with gray-matter and compares the key count. The leg fails when gray-matter does not load. |
| T-401F1-04 | Repudiation | a red gate hidden by the change | mitigate | evidence/before and evidence/after for G1 to G9, G3b and the 690-test sweep; the table goes in the SUMMARY. |
| T-401F1-05 | Tampering | bypass of the pre-commit hook | mitigate | No `--no-verify`, no `COMMIT_NO_VERIFY=1`. A refused commit stops the plan. |
| T-401F1-06 | Information disclosure | none: no user data, no Brain call (Canon Part 8 not touched) | accept | The change is local text in plugin files. |
| T-401F1-SC | Tampering | npm installs | mitigate | This plan installs no package. Dependencies resolve through NODE_PATH from the main checkout. |
</threat_model>

<verification>
Run each command with the NODE_PATH of Task 1 step 2.

1. `node tests/test-401-frontmatter-split.cjs` exits 0 (5 legs).
2. `node scripts/check-frontmatter-split.cjs --check` prints `frontmatter-split: OK (255 files)`.
3. `node scripts/check-frontmatter-split.cjs --census-compare .planning/quick/261127-f1a-frontmatter-split-fix/evidence/census-before.json` exits 0; host totals 210, 34, 227; no file has a lower count of hitl_shape, hitl_stages or allowed-tools.
4. `node scripts/build-skill-mirrors.cjs --check` exits 0.
5. `node scripts/build-connector-registry.cjs --check` exits 0 (exit 1 with no dependencies is an ENV GAP; report it as such).
6. `node scripts/check-shape-declaration.cjs --check` exits 0 with 55 advisory violations (the bare form exits 2 and runs no check; report both).
7. `node scripts/build-orchestration-projection.cjs --check` exits 0.
8. `node scripts/build-harness-manifest.cjs --check` exits 0 after the regeneration (exit 1 before; the regeneration takes in the earlier decide_engine drift; say so).
9. `node scripts/check-render-coverage.cjs` exits 0 with the baseline numbers.
10. The sweep table: no green-red test without a re-pin reason; each red-before test is listed.
</verification>

<success_criteria>
- 0 of 255 surface files hold `---` between the fences (baseline 253).
- Host-read keys: hitl_shape 197 to 210, hitl_stages 29 to 34, allowed-tools 118 to 227; after is greater or equal for each file.
- Non-comment frontmatter lines and bodies are byte-identical for each file.
- The 2 generator lines write `# == text ==`.
- Each gate and each swept test has a before result and an after result in the SUMMARY; red-before items are named.
- 5 commits with the prefix `fix(401-f1)`; each ends with the Co-Authored-By line; no push.
</success_criteria>

<output>
Create `.planning/quick/261127-f1a-frontmatter-split-fix/261127-f1a-SUMMARY.md` when done. End the report with the fields STATUS, CHANGED, VERIFIED, UNVERIFIED, RISKS, NEXT.
</output>
