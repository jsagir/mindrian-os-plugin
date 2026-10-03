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
