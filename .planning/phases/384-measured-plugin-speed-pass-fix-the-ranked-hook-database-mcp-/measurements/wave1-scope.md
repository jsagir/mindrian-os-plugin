# Phase 384 Wave 1 scope list

Written by plan 384-03, 2026-11-05. Source: 384-PRD.md section "Smaller items" ("measure only if the top ten leave time") and 384-CONTEXT.md section "Evidence mark". The default is no. An item is marked yes only when a probe that plans 384-05, 384-06 or 384-07 build already shows it at no extra run.

hand-back reports: NOT AVAILABLE
Commands used to look for the five audit reports of 2026-11-05:
- `find .planning -name '*.md' -newermt 2026-11-05 ! -newermt 2026-11-06` and then `grep -l -i unread` on each file it lists. Only STATE.md, REQUIREMENTS.md, ROADMAP.md, the phase 383 plans and the phase 384 plans matched. The matches in the first three are older phase text or the word unreadable. None is an audit report.
- `grep -rl -i "unread module"` over the research folder of the dev-research room (read only, file names only). One file from July 2026 matched, which is a different topic.
So the lists of unread modules are not in any file on this host. No module family can be added to this list. The owner or the main session can supply the five reports; until then no unread module family is in scope for Wave 1.

## Items

busy-wait lock in lib/hmi/across-session-memory.cjs (up to 200 ms CPU) | 384-05 | in scope for Wave 1: no | The probe preload of 384-05 counts file calls and database opens by category. It does not count a spin on a lock. The per-hook CPU of 384-04 shows only the whole hook, so the spin cannot be told apart from the rest of the hook.

pending-tier1-regen.json growth without dedupe | 384-05 | in scope for Wave 1: no | The risk is growth over many sessions. No probe in plans 384-05 to 384-07 runs a long history or reads the file size over time. A count of file calls on one run would not show the growth.

_sessionDedupState never pruned (lib/mcp/stop-gate-handler.cjs) | 384-06 | in scope for Wave 1: no | The state grows only in a long-lived MCP process over many calls. The MCP probe of 384-06 starts a server for a short run, so it cannot show growth.

tool-router first-call module loads | 384-06 | in scope for Wave 1: yes | The MCP probe of 384-06 (check M7, opens per tool call) runs the probe preload with a SIGUSR2 snapshot before and after each tool call. A lib category in the preload path map shows the file reads of the first call against the second call of the same tool. 384-06 reads this at no extra run.

doctor-only cost, room.db copy per room | 384-07 | in scope for Wave 1: no | No plan in this phase times a doctor sweep over many rooms. 384-09 measures doctor --all on a rooms home with one room, so the copy per room is not isolated.

doctor-only cost, two MCP servers started in series | 384-06 | in scope for Wave 1: yes | 384-06 measures the start time of the mindrian-os server and of the brain client, each at n of 7 or more. Their two medians added give the series cost with no extra run. 384-06 reports the sum and states that doctor itself was not timed for this part.

doctor-only cost, git spawns | 384-07 | in scope for Wave 1: no | The exec counter of 384-04 counts the programs that hook events start. It does not run doctor. No probe in plans 384-05 to 384-07 counts the git calls of doctor.

Plans 384-04 to 384-07 read this file. An item marked yes is measured by the named plan with the same rules (constraint C2). An item marked no is not measured in Wave 1.
