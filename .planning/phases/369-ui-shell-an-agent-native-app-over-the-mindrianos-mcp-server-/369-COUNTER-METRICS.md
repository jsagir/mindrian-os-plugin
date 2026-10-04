# Phase 369 counter-metrics

Counts and milliseconds only (SEED-074). Nothing here names a person, a room's content or a path inside a room.

## Read copy (CM369-02)

Plan 369-23, `node tests/e2e-369/replica.cjs`, one recorded run: 2026-10-03, Node v22.23.1, Linux 6.18.33.2 WSL2 aarch64, 12 logical cores, the built shell (plugin-like tree, root node_modules only) and a hermetic flag-ON daemon, headless Chromium. The room under test holds 2,632 items by the end of the run (about 400 seeded across nodes, relations, artifacts, decisions and activity, then grown by the arms).

| Counter | Value | What it measures |
|---------|-------|------------------|
| catch_up_ms | 1190 | room opened in the page to the Browser copy row reading current with every one of the seeded items present (cold, 400 items over six collections) |
| live_update_ms | 145 | the commit of one claim in another process to that claim being in the copy, no reload (the commit time is read from the writing process, so process spawn is not in it) |
| burst_catch_up_ms | 224 | the last of 200 commits (10 writer processes, 20 commits each, all at once) to all 200 being in the copy |
| lost_writes | 0 | of those 200 burst writes, the number missing from the copy after it settled |
| restart_converge_ms | 5564 | the daemon killed and respawned, then 6 writes: the last write to all 6 being in the copy |
| restart_missing | 0 | of those 6 writes, the number missing after it settled |

Other counts from the same run (all arms PASS): warm reload pulled 0 change rows; a 2,000-write catch-up interrupted by a reload at 200 of 2,000 converged with 0 missing and 0 duplicate ids; two tabs on one room converged with exactly one tab issuing pulls; after compaction past the checkpoint the copy reset and rebuilt with 0 missing; the page contacted only 127.0.0.1 and held no iframe.

### Spread across the passing runs of the same test on the same day (about a dozen kept)

| Counter | Range |
|---------|-------|
| catch_up_ms | 686 to 2035 |
| live_update_ms | 90 to 208 |
| burst_catch_up_ms | 31 to 18051 (one outlier; host load average was about 12 with two other sessions running; every other run was 31 to 700) |
| lost_writes | 0 in every passing run |
| restart_converge_ms | 389 to 8976 (the wait for the shell's event-stream reader and the browser's own stream to reconnect after a kill dominates; the relay backs off 1 s, 2 s, 4 s) |
| restart_missing | 0 in every passing run |

Baselines these were set against: spike 006 P2 measured write-to-render p95 22 to 29 ms over a direct pull server with no relay hop; this path adds the shell relay and the daemon watcher, so 90 to 208 ms is the cost of going through the MindrianOS MCP server only (D-18). Spike 006 P5 measured 1.0 to 1.4 s convergence after a restart, with the room's own pull server surviving it; here the daemon itself is killed and the shell's MCP session is re-established, so the range is wider.

## Gate latency and recovery (CM369-03)

Plan 369-30, `node tests/e2e-369/journey.cjs`, one recorded run: 2026-10-04, Node v22.23.1, Linux 6.18.33.2 WSL2 aarch64, 12 logical cores, the built shell (`lib/ui-shell/dist`, started through `lib/ui-shell/launch.cjs`) and a hermetic flag-ON daemon, headless Chromium. The room under test holds 19 items at the end of the run (two rooms, the second untouched).

| Counter | Value | What it measures |
|---------|-------|------------------|
| gate_click_to_recorded_ms | 81 | the person's click on Approve to "Decision recorded in the room." being on screen; the line appears only after the room's answer is in hand (asserted in the run) |
| restart_catch_up_ms | 2857 | after the shell and the daemon were both stopped and started again, one write made to the room while the shell was down: choosing the room in a new sign-in to the browser copy being current with every one of the room's items |
| lost_writes | 0 | of the room's items (the approved decision, the write made while the shell was down, and everything else), the number missing from the browser copy after it settled; extra ids and duplicates were also 0 |

Spread across six passing runs of the same test on the same day: gate_click_to_recorded_ms 66 to 108, restart_catch_up_ms 2846 to 2872, lost_writes 0 in every run.

What the restart_catch_up_ms figure is made of: the browser copy was kept by the browser (a warm reload), so the time is the new sign-in, the new room binding and one catch-up pull, not a rebuild; the 2.8 s is dominated by the shell reaching the restarted daemon and re-establishing its event stream, as in the restart arm of the read-copy run above.

## Gap closure counts (2026-10-04, plans 369-33 to 369-46)

Plan 369-46, `node tests/e2e-369/journey.cjs` (eight steps), ten consecutive runs on one tree: HEAD 0224da0d6 (the commit that carries the eight-step journey), `git status --short -- lib bin scripts ui` empty at the start and at the end of every run, so no run is void and none was dropped. Node v22.23.1, Linux 6.18.33.2 WSL2 aarch64, 12 logical cores, the built shell (`lib/ui-shell/dist`, source hash 539768ed075ce362, started through `lib/ui-shell/launch.cjs`) and a hermetic flag-ON daemon, headless Chromium. Every start asserted the launcher printed no sign-in code (CR-01). The decision in step 4 is reached through the shell's own Ask Larry control; the decision in step 5 is raised by a Claude Code shaped stdio process and answered in the browser; the CLI's own answer on its own gate id replayed answered_elsewhere in every run; the old gate id read "This decision was already recorded." after both servers restarted in every run, and the room replayed it with one node.

| Run | Exit | gate_click_to_recorded_ms | raised_to_listed_ms | restart_catch_up_ms | lost_writes | answered_elsewhere_replays | items in the copy | Void |
|-----|------|---------------------------|---------------------|---------------------|-------------|----------------------------|-------------------|------|
| 1 | 0 | 81 | 810 | 2805 | 0 | 1 | 32 | no |
| 2 | 0 | 64 | 814 | 2793 | 0 | 1 | 32 | no |
| 3 | 0 | 115 | 800 | 2805 | 0 | 1 | 32 | no |
| 4 | 0 | 66 | 808 | 2803 | 0 | 1 | 32 | no |
| 5 | 0 | 74 | 807 | 2809 | 0 | 1 | 32 | no |
| 6 | 0 | 53 | 825 | 2815 | 0 | 1 | 32 | no |
| 7 | 0 | 62 | 822 | 2802 | 0 | 1 | 32 | no |
| 8 | 0 | 67 | 800 | 2805 | 0 | 1 | 32 | no |
| 9 | 0 | 66 | 681 | 2806 | 0 | 1 | 32 | no |
| 10 | 0 | 69 | 815 | 2796 | 0 | 1 | 32 | no |

| Counter | Median | Range over the ten runs | What it measures |
|---------|--------|-------------------------|------------------|
| gate_click_to_recorded_ms | 66.5 | 53 to 115 | the person's click on Approve (the Ask Larry gate) to "Decision recorded in the room." on screen, after the room's answer is in hand (asserted in every run) |
| raised_to_listed_ms | 809 | 681 to 825 | the CLI path's gate_render returning to the gate being listed under "Waiting for you" with "Raised by Larry outside this browser.", page not reloaded (bound 10 000 ms asserted); dominated by the list's one-read-a-second pace |
| restart_catch_up_ms | 2805 | 2793 to 2815 | both servers restarted and one write made while the shell was down: choosing the room in a new sign-in to the browser copy holding every item (the step is bounded at 60 s; it never came near it) |
| lost_writes | 0 | 0 in every run | the room's items missing from the browser copy after it settled; extra ids and duplicates were also 0 |
| answered_elsewhere_replays | 1 | 1 in every run | the CLI's own gate_answer on the gate the browser answered: ok, replayed, answered_elsewhere, the recorded verdict (approve) and no new decision node |

Gap 3 (the step that restarts both servers, 60 s bound, flaked before plan 369-34): ten of ten passed, with no STEP-EVIDENCE line and no DAEMON-EXIT-UNEXPECTED line. VOID-RUN count: 0 of 10.
