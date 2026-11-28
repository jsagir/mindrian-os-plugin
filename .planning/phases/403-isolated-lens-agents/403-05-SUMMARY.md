# 403-05 SUMMARY: slice A3b, persona-analyst

## OR-47, before the first edit

1. A top professional would also assess whether isolation removes useful style guidance from this reviewer. This may enlarge the task. Report it; do not build it.
2. The raw material is the base agent file, the review test and review file, and the host transcripts. The transcripts require an independent reader. Do not print transcript lines.
3. Use exact file anchors, focused tests, the phase runner, host runs, and a privacy scan. Run the extra gate set outside the sandbox in the lane session.
4. Outside evidence includes the host runs of the base and updated agent files, an independent transcript review, and the pointer completion check after its separate update. These checks are outside this Task 0 record.

## Task 0: position and pointer facts

- The only top-level key before `connector:` that holds a block list is `tools`.
- The last tools list item is at line 14.
- The next line starts with `# == Phase 144.1 connector frontmatter`.
- No top-level `omitClaudeMd` key exists.
- `- **EXTERNAL WEB (hat-scoped).**` occurs once, at line 58.

N1: 58
N2: 58
T: 58

Memory canary: the control runs did not contain it. Do not claim a memory saving.

## OR-47, red step

1. A top professional would check whether the rule keeps useful review guidance. Record this as a follow-up.
2. Start from the exact helper list and the focused test contract.
3. Add one list entry, then run the focused Node test in a temporary home folder.
4. Use the red test result and a second reader of the diff as outside evidence.

## OR-47, green step and pointer

1. Add the exact frontmatter line after the final tools item.
2. Read the shifted external web line number.
3. Update both review pointers to that line number.
4. Find and report any other tracked pointer outside planning and docs.

N: 59

## Executor note

Codex made the 3 edits and wrote the OR-47 points before each edit. The Codex sandbox cannot commit and refuses some child processes. The lane session ran every gate, the 2 live runs and the 3 commits outside the sandbox. PROVEN.

## Plan check (separate opus agent, read only, merged tree at 0bff293a1)

Text changes applied in this run:
- The comment line after the tools list is `# == Phase 144.1 connector frontmatter` (rewritten by F1), not `# --- Phase 144.1`.
- The review line in 400.2-OWNER-REVIEW.md is at line 391, not 383. Anchor on the text.
- The reference sweep adds tests/test-40021-persona-domain.cjs and tests/test-401-keep-list.cjs.
- Handoff H1 is made by the lane as a separate commit (orchestrator override; the 400.2 owner can overrule). The plan limit on the 2 pointer files and the PARTIAL stop of Task 2 Step 4 do not apply in this run.
- A dist rebuild is allowed in a separate commit when `build-dist-bundles.cjs --check-stale` goes red. It stayed green, so no dist commit exists.
- Finding F-1: record `memory_canary`, do not claim a memory saving.
- The extra gate set runs in the baseline and after the build.
- No test pins the list count of 9. check-tool-grants.cjs and check-frontmatter-split.cjs do not read the new key. dist holds no copy of the agent file. PROVEN by reading.

## Task 0: worktree and gates

- BASE5: 0bff293a1 (merge of stage/400.5-405 into work/403-isolated, no conflict). Branch work/403-isolated. The tip of 403-04 (cbf80f839) is an ancestor. Clean tree at start. PROVEN.
- Gate 1: 403-04-SUMMARY.md ends with `STATUS: DONE`. PROVEN.
- Gate 2: 400.2.1-VERIFICATION.md frontmatter holds `status: passed`. PROVEN.
- The list held 9 names. `s7_form: byte-compare`; S7 reads `OMIT_CLAUDE_MD`. PROVEN.

## Baseline and after (temp HOME, MINDRIAN_HOME, MINDRIAN_ROOMS_HOME, Brain address at a closed port)

| Check | BASE5 | Tip |
|---|---|---|
| bash tests/run-all-403.sh | 0, PASSED=11 FAILED=0 SKIPPED=0 KNOWN=0 | 0, the same line |
| bash tests/run-all-40021.sh | 1 | 1, the same failing leg |
| bash tests/run-all-4002.sh | 1 | 1, the same failing leg |
| bash tests/run-all-401.sh, 261127-bnd, 402, 359, 404 | 0 each | 0 each |
| 3 tests of AC-A6 | 0, 0, 0 | 0, 0, 0 |
| node tests/test-4002-review-lists.cjs, test-bono-part8-leak.cjs | 0, 0 | 0, 0 |
| check-frontmatter-split --check, check-tool-grants --check | 0, 0 | 0, 0 |
| build-connector-registry --check, run-harness --check (12 pass 0 fail) | 0, 0 | 0, 0 |
| build-dist-bundles --check-stale | 0 (fresh) | 0 (fresh) |
| reference sweep, 9 files that name persona-analyst | 0 each | 0 each |

All results PROVEN. The 27 exit codes are identical. Known red, not touched by this plan: the 2 runners 40021 and 4002 fail only on tests/test-399-problem-axes.cjs leg A8 (through test-400-cause-effect-axis leg C4). Leg A8 pins lib/core/part8-egress-guard.cjs unchanged. Commit 1a7d6ad46 (404-03, on the staging branch) added 15 lines to that file. PROVEN. No tracked file changed by a run.

## Task 1: red, then green

- Red (list holds 10 names, agent file unchanged): test-403 exit 1, L1 FAIL `agents failing: persona-analyst`, L2 to L5 ok. test-400-job-sentences exit 1, S7 FAIL `agent persona-analyst.md (omitClaudeMd lines: 0)`. The red set equals the behavior list. PROVEN.
- Commit 4efd1599f test(403-05). No guard refused it. PROVEN.
- Green: `git diff --numstat` of the agent file is `1 0`. test-403 prints 5 `ok:` lines; S7 ok (15 passed, 0 failed). PROVEN.
- Commit 5189f14bf feat(403-05). `git diff --stat 0bff293a1 5189f14bf` names exactly the 2 files of files_modified. PROVEN.
- Privacy scan on every committed path and on this SUMMARY: 0 hits. PROVEN.

## Live runs of the shipped persona-analyst file (counts and key names only; no transcript line printed)

- Host: claude 2.1.332. Scratch: 1 folder made with `mktemp -d`; the name check passed. Slug: -tmp-tmp-IfopcEDSFS-cwd (exactly 1 new folder after the warm-up). Canary sizes: 19 and 18.
- `cmp`: the before copy equals `git show` of 0bff293a1 (0 key lines); the after copy equals `git show` of 5189f14bf (1 key line). PROVEN.
- Run flags: `-p`, `--plugin-dir` with 1 scratch plugin, `--settings '{"disableAllHooks": true}'`, `--strict-mcp-config` with no `--mcp-config`, `--disallowedTools Write WebSearch WebFetch`, a new `--session-id`, temp MINDRIAN_HOME and MINDRIAN_ROOMS_HOME, the Brain address at a closed port, a time limit of 300 seconds. No forbidden flag. Both exit 0. The 1 stderr line of each run is the host notice about no stdin data.
- Before run: containers of the project canary are `attachment.files.N.content`, `attachment.rendered.N.content`, `api-request-blob.message.content.N.text`; the user CLAUDE.md item is in `attachment.files.N.path`.
- After run: the project canary is in no attachment and no request blob. It occurs only in entry 21 (a `tool_result` of the agent's own Read call) and entry 27 (the agent answer). By rule 10 these hits do not count. The dispatch prompt (entry 0) holds no hit. PROVEN.
- Tool names in both runs: Read, DeferredToolPlaceholder, Glob, advisor. DeferredToolPlaceholder and advisor are host-added. Write and the web tools are removed by the flag; the 2 Brain tools are absent because no MCP server starts. The 2 sets are equal. PROVEN.

plugin: probe403b
agent: persona-analyst
transcript: ~/.claude/projects/-tmp-tmp-IfopcEDSFS-cwd/c9120020-30d7-454a-86a2-d264894bbfb8/subagents/agent-a010ffb922d6c8ce1.jsonl
project_canary: present
user_claude_md: present
memory_canary: absent
tools: Read, Glob, advisor
mcp_clause: not exercised
verdict: pass (control: the project canary and the user item are present)

plugin: probe403a
agent: persona-analyst
transcript: ~/.claude/projects/-tmp-tmp-IfopcEDSFS-cwd/45898407-d3e7-4af2-80de-f7277199c953/subagents/agent-ae6a8fd67e6b937d0.jsonl
project_canary: absent
user_claude_md: absent
memory_canary: absent
tools: Read, Glob, advisor
mcp_clause: not exercised
verdict: pass

- Finding F-1 again: the memory canary is absent in the before control run too. Do not claim a memory saving.
- Cleanup: the `memory/` folder of the new slug is deleted. The session folders and the scratch folder stay for the second reader.

## HANDOFF H1 (made by the lane under orchestrator override)

- Reason: plan 403-05 inserted 1 frontmatter line above the target (owner ruling O2). The text `- **EXTERNAL WEB (hat-scoped).**` moved from line 58 to line 59.
- File 1, tests/test-4002-review-lists.cjs, list `REPORTED_PART8_COMMENTS`: `'agents/persona-analyst.md:58'` became `'agents/persona-analyst.md:59'`.
- File 2, 400.2-OWNER-REVIEW.md, the line that starts `- names (reported-part8-comments):`: `agents/persona-analyst.md:58` became `agents/persona-analyst.md:59`.
- Both files changed in 1 commit, so leg V1 of the review test stays green.
- Authority: the orchestrator session authorized this one pointer update, because the owner of Phase 400.2 is not available. The owner of Phase 400.2 can overrule it. The commit message says so.
- No other tracked file outside .planning and docs points to `agents/persona-analyst.md:58`. PROVEN by search.

N: 59
pointer_update_commit: d7458f375

Completion record: the automated check of Task 2 exits 0 at d7458f375. `git show --stat` of d7458f375 names both files. `node tests/test-4002-review-lists.cjs` exits 0 and `bash tests/run-all-403.sh` exits 0 after the commit. PROVEN.

## Outside evidence

1. A failure that turns into a pass in the tests: done (red L1 and S7, green 5 legs and S7; commits 4efd1599f and 5189f14bf).
2. A failure that turns into a pass on the host: done. The BASE5 persona-analyst file holds the project canary and the user item in its subagent; the tip file does not.
3. A check that this builder cannot make pass by its own edit: open. The pointer update was made by the lane under the override, so no independent owner check exists. The owner of Phase 400.2 can review commit d7458f375.
4. A second reader re-counts the 2 transcripts: open.
5. Open: a persona deep run from /mos:persona in a real room belongs to the real-room run of the version cut (OR-51; design risk 10).

The owner value is not in this file.

STATUS: DONE
CHANGED: 4efd1599f (tests/helpers/omit-claudemd-list.cjs), 5189f14bf (agents/persona-analyst.md), d7458f375 (pointer update, 2 files), this SUMMARY
VERIFIED: the table above; 2 live runs, control present, tip absent; the H1 completion check exits 0
UNVERIFIED: the second reader re-count; the cause of finding F-1; a dispatch from /mos:persona in a real room
RISKS: finding F-1; a language or style rule of the user file no longer reaches the hat prose (accepted, ruling O2); the pointer commit has no review by the 400.2 owner; the known red leg A8 of test-399 on the staging branch
NEXT: read the 2 transcripts as the second reader
