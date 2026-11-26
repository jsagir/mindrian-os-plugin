---
phase: 367
round: 4
target: 367-DESIGN.md r5 -> r6
reviewers:
  zoom_out: completed (1 Blocker, 4 Major, 5 Nit)
  design_critic: completed (1 Blocker, 8 Major, 9 Nit)
  codebase_details: completed (3 Blocker, 6 Major, 11 Nit)
  implementation_readiness: completed (1 Blocker, 7 Major, 10 Nit)
clean_round: false
---

# Goldfish review, round 4: resolution (FIXED in r6 unless marked)

Blockers
- DC-B1, CD-B1, IR-B1 `$WORK_DIR` unset at on-stop:48 under `set -u`: on-stop parses stdin `cwd` and `session_id` at :37; the line uses `${HOOK_CWD:-$PWD}`; AC1 runs with process cwd outside the room.
- ZO-1 gate-card skip loses an approval when gate_answer never runs: skip only when `decision:gate:<id>` exists; match on `header` + option labels from `gate_raised` rows; known duplicate limit stated.
- CD-B2 require cycle: walker in a new `lib/core/content-artifacts.cjs` with a lazy scaffold-predicate require; section-registry unchanged.
- CD-B3, IR-M2 isolation table: switch under `HOOK_SWITCHES['hooks/run-hook.cmd session-start']`, evidence lines re-pinned, no table key.

Majors
- DC-M1, IR-M1, CD-M1 room source: runner room set = cwd room + session.primary + --room + registry room (files are idempotent); card hook keeps cwd + session.primary, never registry; SessionStart line given.
- DC-M2 Cowork flag-OFF: wrapper follows `resolveMcpWriteRoom(...).ok`.
- DC-M3, CD-M3 gate match field: pinned (header + labels, gate_raised).
- DC-M4 room move: key from `.room-root` `{room, born}`; path fallback; risk stated.
- DC-M5, IR-N10 claim window: one `wx` spool file per answer (atomic, dedupe), no rename claim.
- ZO-2, DC-N1/N2 dirty token: CUT; flushPending spawns at teardown.
- ZO-3, DC-M6 quarantine: CUT; failed files counted each run; transaction errors fail the room, not the file.
- ZO-4 rejected file and retention: CUT; rejected spool files stay in place and are counted; held/ after 5 refusals (DC-N6).
- ZO-5, DC-N3 governed set drift: census test GOVERNED vs PURE_READ.
- ZO-6 Electron env: CUT; inherit env like the existing detached spawns.
- DC-M7 hold time: batches end at 10 files or 250 ms; content pre-read; AC10 measures the longest hold.
- DC-M8 status after release: final status written while holding the job lock.
- CD-M2, IR-N3 job-lock `error`: lock_io_error.
- CD-M4, IR-M7, ZO-M5 AC12: CUT (AC10 bounds the runner; RULE 10 unchanged; non-goal stated).
- CD-M5, IR-N2 backfill parity: new backfill set stated exactly.
- CD-M6, IR-M6 teardown call site: flushPending in exitAfterTeardown, listed.
- IR-M3 persona fixtures: removed from the file list (immutable snapshot).
- IR-M4 prose: exact before/after per site; destijl keeps memory_event and context_assemble; test-261125 listed.
- IR-M5 card DB handle: openRoomDbForCaller; PRAGMA legacy check first.
Nits fixed: --trigger flag name, extra as last arg, RegisteredTool return, unwrapped pure reads, timer unref, budget rule 700, statSync, isFile on every pass, lexical cursor, armBackstop limit, answeredVia not added, key creation via link, missing tool_use_id dropped, cwd vs bound room mismatch, null for unknown doctor values, warn rules, ISO times, Appendix D text, test-sqlite-ops known red re-based.
