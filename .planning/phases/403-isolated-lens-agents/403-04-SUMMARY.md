# 403-04 SUMMARY: slice A3a, investor and grading

## OR-47, before the first edit

1. A top professional would also assess the risk that blind reviewers miss useful style instructions. This may enlarge the task. Report it; do not build it.
2. The raw material is the BASE4 versions of `agents/investor.md`, `agents/grading.md`, leg S7, and the host transcripts already recorded by the prior phase. Do not inspect private host files.
3. Use the repository state, frontmatter position checks, focused tests, phase runners, the reference sweep, and a privacy scan. Keep all required runtime folders temporary.
4. Outside evidence would be a second reader's review of the host transcripts and a live host run of the shipped file. Task 2 is excluded, so this evidence remains unverified.

Executor note: Codex made the 3 edits (red step and green step). The Codex sandbox refuses child processes, so its runner runs timed out (exit 124) and some legs gave EPERM. The lane session ran every gate, the sweep and the 2 live runs outside the sandbox. The sandbox results are not counted. PROVEN.

## Plan check (separate opus agent, read only, on the present tree)

- No stale fact. PROVEN.
- Text changes applied: the comment line after the tools list is `# == Phase 144.1 connector frontmatter ==` (not `# ---`); the helper key is `OMIT_CLAUDE_MD`; the 2 new lines go directly after `'dominant-design-researcher',`; the S7 red message form is `agent investor.md (omitClaudeMd lines: 0)`.
- Reference sweep count: 19 files, as the plan states. PROVEN.

## Task 0: worktree, gates, positions

- BASE4: 8df39807ce766c861fe27a145a46dcf3e2cf1652 (the merge of the staging branch into work/403-isolated). Branch work/403-isolated. Clean tree at start. PROVEN.
- Gate 1: 403-03-SUMMARY.md ends with `STATUS: DONE`. PROVEN. Its second reader step is ASSUMED done by the orchestrator.
- Gate 2: the executor prompt holds the sentence "the owner value was shown to the owner on 2026-11-28". Date: 2026-11-28.
- The list held the 7 names of plan 403-02. `s7_form: byte-compare`; S7 reads `OMIT_CLAUDE_MD`. PROVEN.
- agents/investor.md: `tools` is the only block list before `connector:`; last item `- Read` at line 11; next line is the comment line at column 0; no `omitClaudeMd` key; count of the Pinecone tool name: 1 (401 slice 3 is not in BASE4). PROVEN.
- agents/grading.md: `tools` is the only block list; last item `- Read` at line 10; next line is the comment line; no key. PROVEN.

## Baseline and after (temp HOME, MINDRIAN_HOME, MINDRIAN_ROOMS_HOME, Brain address at a closed port)

| Check | BASE4 | After |
|---|---|---|
| bash tests/run-all-403.sh | 0, PASSED=10 FAILED=0 SKIPPED=0 KNOWN=1 | 0, PASSED=10 FAILED=0 SKIPPED=0 KNOWN=1 |
| bash tests/run-all-401.sh | 0, PASSED=4 FAILED=0 | 0, PASSED=4 FAILED=0 |
| bash tests/run-all-261127-bnd.sh | 0, PASS=79 FAIL=0 | 0, PASS=79 FAIL=0 |
| bash tests/run-all-402.sh | 0, PASS=26 FAIL=0 SKIP=0 | 0, PASS=26 FAIL=0 SKIP=0 |
| bash tests/run-all-359.sh | 0, PASS=27 FAIL=0 SKIP=0 | 0, PASS=27 FAIL=0 SKIP=0 |
| node scripts/check-frontmatter-split.cjs --check | 0 | 0 |
| node scripts/check-tool-grants.cjs --check | 0 | 0 |
| node scripts/run-harness.cjs --check | 0, 12 pass 0 fail | 0, 12 pass 0 fail |
| 3 tests of AC-A6 | 0, 0, 0 | 0, 0, 0 |
| reference sweep, 19 files | 18 exit 0; tests/test-383-sourced-number.cjs exit 1 (leg U1) | the same 19 exit codes; test-383 fails the same leg U1 |

All results PROVEN. The test-383 red is pre-existing and is not touched by this plan. No tracked file changed by a run.

## Task 1: red, then green

- Red (list holds 9 names, agent files unchanged): `node tests/test-403-omit-claudemd.cjs` exit 1; L1 FAIL `agents failing: investor, grading`; L2, L3, L4, L5 ok. `node tests/test-400-job-sentences.cjs` exit 1; 1 FAIL line, S7: `agent grading.md (omitClaudeMd lines: 0), agent investor.md (omitClaudeMd lines: 0)`. The red set equals the behavior list. PROVEN.
- Commit 80d7d3f09 test(403-04). No guard refused it; the named branch was not needed. PROVEN.
- Green: `git diff --numstat -- agents` printed 2 lines `1 0`. test-403 printed 5 `ok:` lines; S7 ok; the runner line is in the table. PROVEN.
- Commit cbf80f839 feat(403-04). PROVEN.
- Privacy scan on the 3 files: 0 hits. PROVEN.

## OR-47, green step

1. A top professional also evaluates whether blind review can miss useful style guidance.
2. The rawest material is the two agent frontmatters and the S7 test output.
3. Use exact anchor checks, one-line edits, `git diff --numstat`, and the focused test.
4. Outside evidence includes independent review and host behavior. Both remain open here.

## Task 2: live runs of the shipped grading file (counts and key names only; no transcript line printed)

- Host: claude 2.1.332. Scratch: 1 folder made with `mktemp -d`; the name check passed. Slug: -tmp-tmp-GWTYF0Fk45-cwd (exactly 1 new folder after the warm-up). Canary sizes: 19 and 18.
- `cmp`: the before copy equals `git show` of BASE4 (0 key lines); the after copy equals `git show` of cbf80f839 (1 key line). PROVEN.
- Run flags: `-p`, `--plugin-dir` with 1 scratch plugin, `--settings '{"disableAllHooks": true}'`, `--strict-mcp-config` with no `--mcp-config`, a new `--session-id`, temp MINDRIAN_HOME and MINDRIAN_ROOMS_HOME, the Brain address at a closed port, a time limit of 300 seconds. No forbidden flag. Both exit 0. The 1 stderr line of each run is the host notice about no stdin data.
- Identification: each transcript by the `agentType` key of its meta file (probe403b:grading, probe403a:grading). Containers of the project canary in the before run: `attachment.files.N.content`, `attachment.rendered.N.content`, `api-request-blob.message.content.N.text`. No hit in a dispatch prompt or a tool result.
- Tool names: `api-request-shape.shape.tools` holds DeferredToolPlaceholder, Read, advisor in both runs. DeferredToolPlaceholder and advisor are host-added. No name starts with `mcp__`.

plugin: probe403b
agent: grading
transcript: ~/.claude/projects/-tmp-tmp-GWTYF0Fk45-cwd/65862cc6-84ad-4095-8652-c63819635b11/subagents/agent-a25ea5a1a7684d01c.jsonl
project_canary: present
user_claude_md: present
memory_canary: absent
tools: Read, advisor
mcp_clause: not exercised
verdict: pass (control: the project canary and the user item are present)

plugin: probe403a
agent: grading
transcript: ~/.claude/projects/-tmp-tmp-GWTYF0Fk45-cwd/1664d45e-1e4f-42d6-90ec-1c40553b0eaa/subagents/agent-a1f35a29855ab9074.jsonl
project_canary: absent
user_claude_md: absent
memory_canary: absent
tools: Read, advisor
mcp_clause: not exercised
verdict: pass

- Finding F-1 again: the memory canary is absent in the before control run too. The memory part of the effect is not shown on the grading file. Do not claim a memory saving.
- Cleanup: the `memory/` folder of the new slug is deleted. The session folders and the scratch folder stay for the second reader.

## Outside evidence

1. A failure that turns into a pass in the tests: done (red L1 and S7, green 5 legs and S7; commits 80d7d3f09 and cbf80f839).
2. A failure that turns into a pass on the host: done. The BASE4 grading file holds the project canary and the user item in its subagent; the tip file does not.
3. A second reader re-counts the 2 transcripts: open. Plan 403-05 does not start before this step.
4. Open: the investor file has the same layout and no live run of its own; a dispatch of grading from /mos:grade in a real room belongs to the real-room run of the version cut (OR-51; design risk 10).

The owner value is not in this file.

STATUS: DONE
CHANGED: 80d7d3f09 (tests/helpers/omit-claudemd-list.cjs), cbf80f839 (agents/investor.md, agents/grading.md), this SUMMARY
VERIFIED: the table above; 2 live runs, control present, pass absent
UNVERIFIED: the second reader re-count; the cause of finding F-1; a live run of the investor file
RISKS: finding F-1; a language or style rule of the user file no longer reaches the 2 agents (accepted, ruling O2); 401 slice 3 must rebase over the investor line
NEXT: read the 2 transcripts as the second reader
