# 403-03 SUMMARY: close of slice A2

## OR-47, before the first edit

1. What a top professional also does: run the failing control (the copy of BASE) before each pass run, check each copy byte for byte against git, use a new scratch slug so that no earlier session state leaks in, and keep the transcripts on disk for a second reader. Report item (not built): a dispatch from a real command in a real room (that belongs to the real-room run of the version cut).
2. The rawest material: the 2 shipped files as `git show` gives them at BASE and at TIP, and the host subagent transcripts of the 4 runs, read by count and key-name commands only. Not the SUMMARY of plan 403-02.
3. Methods and tools: the live run method of this plan (scratch plugins probe403b and probe403a, scratch cwd with a project canary, a canary memory file under the new slug), `claude -p` with hooks off and `--strict-mcp-config`, `cmp`, `grep -c`, and a `node -e` key-path printer.
4. Outside evidence: for each of the 2 agents the BASE copy run holds the project canary and the TIP copy run does not, on the same host; a second reader re-counts the 4 transcripts.

Executor note: the lane session runs this plan itself. The Codex sandbox refuses child processes and cannot write the host session folders (the 403-01 precedent). This plan changes no code file.

## Task 1: gate and runner

- BASE: 4314d335ad4e40b87797623f6ebed1ddbaa8b821. TIP: 979c8dd35b663ccf555dba669b42fcd954a2d0df. PROVEN.
- 403-02-SUMMARY.md holds `STATUS: DONE`. BASE is an ancestor of TIP. `git status --short` printed nothing. PROVEN.
- `git diff --stat BASE TIP` outside .planning names the 12 files of the files_modified list of plan 403-02, plus tests/test-363-runner-contract.cjs. The .planning paths are the 403 plan files, 403-PROBE.md, 403-01-SUMMARY.md, 403-02-SUMMARY.md, plus .planning/quick/261128-pre-runner-contract-repin/261128-pre-SUMMARY.md. The 2 extra paths are the commit 4dddb97ed fix(403-pre), a decision of the main session (rule T2). Recorded exception; the gate holds otherwise. PROVEN.
- Runner on TIP (temp HOME, MINDRIAN_HOME, MINDRIAN_ROOMS_HOME, closed Brain port, NODE_PATH of the main checkout): exit 0, `PASSED=10 FAILED=0 SKIPPED=0 KNOWN=1`. Legs 1 to 10 PASSED; leg 11 (dist bundle stale check) KNOWN by the signature `dist bundle STALE`. PROVEN.
- `git diff --numstat BASE TIP` (names and counts only): 403-01-PLAN.md 234 0; 403-01-SUMMARY.md 56 0; 403-02-PLAN.md 311 0; 403-02-SUMMARY.md 117 0; 403-03-PLAN.md 215 0; 403-PROBE.md 41 0; 261128-pre-SUMMARY.md 10 0; 7 agent files 1 0 each; data/capability-ledger.json 3 3; tests/helpers/omit-claudemd-list.cjs 13 0; tests/run-all-403.sh 58 0; tests/test-363-runner-contract.cjs 16 3; tests/test-400-job-sentences.cjs 12 2; tests/test-403-omit-claudemd.cjs 115 0.

## Task 2: live runs (counts and key names only; no transcript line was printed)

- Scratch: 1 folder made with `mktemp -d`; the name check against the user name and the host name passed. slug: -tmp-tmp-Q5yoqltAUB-cwd (exactly 1 new folder after the warm-up run). The canary sizes: 19 and 18.
- `cmp` of the 4 copies against `git show`: 4 of 4 identical. The 2 BASE copies hold 0 key lines; the 2 TIP copies hold 1 each.
- Run flags: `-p`, `--plugin-dir <one scratch plugin>`, `--settings '{"disableAllHooks": true}'`, `--strict-mcp-config` with no `--mcp-config`, a new `--session-id`, MINDRIAN_HOME in the scratch folder, a time limit of 300 seconds. No forbidden flag. Each exit code 0. The only stderr line of each run is the host notice about no stdin data.
- Instructions container (from the first control run): attachment entry, `attachment.files.N.content` and `attachment.files.N.path`, also rendered in `attachment.rendered.N.content` and in the request record `api-request-blob.message.content.N.text`. No hit in the dispatch prompt or in a tool result.

plugin: probe403b
agent: chain-step-reviewer
transcript: ~/.claude/projects/-tmp-tmp-Q5yoqltAUB-cwd/4c76e63e-ce7d-4574-86e7-47cd046c033d/subagents/agent-ab6a38081cc175268.jsonl
project_canary: present
user_claude_md: present
memory_canary: absent
tools: Read, advisor
verdict: pass (control: the project canary and the user item are present)

plugin: probe403a
agent: chain-step-reviewer
transcript: ~/.claude/projects/-tmp-tmp-Q5yoqltAUB-cwd/8941fd0c-0ae8-4b64-8998-6b4344bdf257/subagents/agent-a7f80ba24a8d7d70f.jsonl
project_canary: absent
user_claude_md: absent
memory_canary: absent
tools: Read, advisor
verdict: pass

plugin: probe403b
agent: research-lane-analyst
transcript: ~/.claude/projects/-tmp-tmp-Q5yoqltAUB-cwd/c6f0dad0-48d1-42a9-bff1-b797635c91a6/subagents/agent-ae9996f0b66691797.jsonl
project_canary: present
user_claude_md: present
memory_canary: absent
tools: Read, advisor
verdict: pass (control)

plugin: probe403a
agent: research-lane-analyst
transcript: ~/.claude/projects/-tmp-tmp-Q5yoqltAUB-cwd/f62ef0ae-ab38-47d5-aa48-dbb71ec2c232/subagents/agent-a545c265dabcb8bee.jsonl
project_canary: absent
user_claude_md: absent
memory_canary: absent
tools: Read, advisor
verdict: pass

- Identification: each target transcript was found by the `agentType` key of its meta file (probe403b:chain-step-reviewer, probe403a:chain-step-reviewer, probe403b:research-lane-analyst, probe403a:research-lane-analyst). The third run also has a second subagent file with agentType Explore. The parent session spawned it before the target agent; it is not a target and it is not counted. PROVEN.
- Finding F-1 (memory canary): the memory canary is absent in all 4 runs, also in the 2 BASE control runs. The after runs agree with `memory_file_removed: true` of 403-PROBE.md. But on these 2 shipped files the memory part of the effect is not shown, because the control did not load the memory file either. In plan 403-01 the scratch agent of P0 did load it (as an attachment `systemPrompt` entry). ASSUMED cause: the host loads the memory file only for some agent definitions or session states; not checked. This does not fail a run (rule 10).
- Cleanup: the `memory/` folder of the new slug is deleted. The session folders and the scratch folder stay for the second reader.

## Task 3: measures of the design step (project rule "GSD with EGM")

| Step | Agent runs | Tokens |
|---|---|---|
| Elephant | not recorded | not recorded |
| Goldfish round 1 | not recorded | not recorded |
| Resolve | not recorded | not recorded |
| Goldfish round 2 | not recorded | not recorded |
| Codex review | not recorded | not recorded |
| Plan step | not recorded | not recorded |

- Findings (CITED from 403-DESIGN.md section 0): round 1 gave 26 source findings (2 Blockers, 24 Majors), merged into 17; round 2 gave 0 Blockers, 3 Majors, 7 Minors; the Codex review gave 0 Blockers, 0 Majors, 5 Minors; the plan step gave 6 planner findings.
- Live runs: plan 403-01: 1 warm-up and 3 leg runs (P0, P1, P3), 0 repeats (CITED, 403-01-SUMMARY.md). Plan 403-03: 1 warm-up and 4 runs, 0 repeats (PROVEN).
- Build runs of this lane (second run), PROVEN: Codex runs for fix(403-pre) 1, for 403-02 Task 0 and Task 1 3 (2 stopped: a sandbox spawn refusal, then a strict Step 2 stop), for 403-02 Task 2 2 (edits, then the L3 fix). Tokens per Codex run as printed by Codex: 34,715; 44,192; 43,342; 66,653; the last 2 runs not recorded.

## Saving

saving_case: 1
memory_file_removed: true
bytes_removed_per_spawn: 37

The scratch delta proves the mechanism. It is not the saving of a real user. The owner value is not in this file.

## Outside evidence

1. A failure that turns into a pass on the shipped files: done. For each of the 2 agents the BASE copy run holds the project canary and the user item, and the TIP copy run does not. The 4 transcripts are host records.
2. A second reader re-counts the 4 transcripts: open (main session, or a verifier that ran none of the 4 runs). Plan 403-04 does not start before this step.
3. A dispatch of one of the 7 agents from its real command in a real room: open. It belongs to the real-room run of the version cut (OR-51; design risk 10).

STATUS: DONE
CHANGED: this SUMMARY only (no tracked code file)
VERIFIED: bash tests/run-all-403.sh on TIP: PASSED=10 FAILED=0 SKIPPED=0 KNOWN=1; 4 live runs, 2 controls present, 2 passes absent
UNVERIFIED: the second reader re-count; the cause of finding F-1
RISKS: finding F-1 (the memory part of the effect is not shown on shipped files); the host can change the attachment layout in a later version
NEXT: (1) read the 4 transcripts as the second reader; (2) state in the executor prompt of plan 403-04 that the owner value was shown to the owner, with the date.
