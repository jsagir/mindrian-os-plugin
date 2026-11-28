---
phase: 403-isolated-lens-agents
plan: 01
slice: A1
base: 4314d335a
---

# 403-01 SUMMARY: the K5 probe

## OR-47, before the first edit

1. What a top professional also does: run the control leg P0 first so that a pass of P1 means something; record a host transcript per leg, not a builder table; make each run reproducible (fixed session id, fixed prompt, fixed flags); keep the evidence on disk for a second reader. Report item (not built): a repeat of P1 on a second host version.
2. The rawest material: the subagent transcripts that the host writes under the scratch slug folder, read by count and key-name commands only; the agent files as `git show 4314d335a:agents/<name>.md` gives them.
3. Methods and tools: probe method rules 1 to 11 of the plan; `claude -p` with `--plugin-dir`, `--settings '{"disableAllHooks": true}'`, `--strict-mcp-config`, `--session-id`; `grep -c`, `grep -l`, `ls` and `node -e` one-liners that print key names, entry types, tool names and the words present or absent.
4. Outside evidence: the P0 transcript holds the project canary and the P1 transcript does not (a failure that turns into a pass on the same host); a second reader re-counts the transcripts (open, main session); the room copy of the record (open, main session).

Deviation from the owner build rule: this plan changes no code, and it runs the logged-in host with `claude -p`. The lane session ran the probe itself, not through Codex, because the Codex sandbox cannot write the host session folders. ASSUMED that this is in the spirit of the rule (no build step exists here).

## Gate on BASE

- F1 gate: the awk check of `^# ---` inside the frontmatter of the 17 files of `git ls-tree 4314d335a agents/` printed nothing. PROVEN.
- The second half of the gate (leg S7 prints ok on BASE) needs a checkout; plan 403-02 Task 0 checks it.

## Scratch setup

- slug: -tmp-p403-vMzr0x-cwd (made by the warm-up run; exactly 1 new folder under the projects folder). Name check of the scratch path and the slug against the user name and the host name: pass.
- canary sizes (`wc -c`): project 19, memory 18. PROVEN.
- The `memory` folder of the slug did not exist before the probe. PROVEN.

## Leg results (counts and key names only; no transcript line was printed)

- V: `claude --version` = 2.1.332 (2.1.271 or later). pass. PROVEN.
- P0 (agent ctl, no key): the instructions container is the attachment entry of type `instructions` (key path `.attachment.files[]`, with file entry types User, Project, AutoMem). Project canary present (Project entry), memory canary present (AutoMem entry, the same container), user CLAUDE.md item present (User entry path ends with `/.claude/CLAUDE.md`). The dispatch prompt (entry 0) held no canary. The other hits are the rendered copy of the same attachment, the request blob and the answer of the agent. Tools: Read, advisor. verdict pass. PROVEN.
- P1 (agent iso, `omitClaudeMd: true` after the list): `grep -c` of the 2 canary tokens and of the user CLAUDE.md path in the subagent transcript = 0, 0, 0; no attachment entry of type `instructions` exists. Tools: Read, advisor (advisor is host-added). mcp_clause: not exercised. verdict pass. PROVEN.
- P2: memory_file_removed true; user_claude_md_removed true; bytes_removed_per_spawn 37; saving_case 1. Derived from P0 and P1.
- P3 (agent keys, the F1 host-read keys of agents/investor.md at BASE, no comment line): the agent loaded and ran (subagent transcript exists); counts 0, 0, 0; tools Read, advisor; stderr empty, so warnings none. verdict pass. The plan check found no 401 record of the same test, so the leg ran. PROVEN.

Runs: 1 warm-up, P0, P1, P3. Repeats: 0. Each run exit code 0. The only stderr line of any run is the host notice about no stdin data (P0), which is not a warning about the agent.

## Close

- Saving case 1. Scratch delta 37 bytes removed per spawn (canary files only). The scratch delta proves the mechanism; it is not the saving of a real user.
- The owner value is not in this file.
- Cleanup: the `memory` folder of the slug is deleted; the 4 session folders of the slug stay for the second reader. The 2 scratch folders are named in the hand-off to the main session only.

Outside evidence:
1. P0 fails the isolation check and P1 passes it on the same host: done (host transcripts on disk).
2. Second reader re-counts the 3 transcripts of 403-PROBE.md: open (main session).
3. Room copy of 403-PROBE.md: open (main session).

STATUS: DONE
CHANGED: 403-PROBE.md and this SUMMARY (one commit in the lane worktree)
VERIFIED: legs V, P0, P1, P3 by host runs; counts by `grep -c`; privacy scan of the 2 files
UNVERIFIED: the `mcp__` clause of P1 (no MCP server starts in the probe); a second host version
RISKS: the probe reads the real login folder; only the new slug folder changed
NEXT: read the 3 transcripts as the second reader; measure the owner value and show it to the owner in the conversation only; file the room copy of 403-PROBE.md
