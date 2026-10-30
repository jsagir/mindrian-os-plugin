---
phase: 381-room-scan-once-render-three-times-node-renderers-behind-comp
verified: 2026-10-30T04:50:00Z
status: human_needed
score: 9/9 requirements verified in code and by running; 2 human items open
overrides_applied: 0
re_verification: false
head: 5f9eccf687e6a67943527ea428859f3c88ef76ba
base_sha: 65aaf329f9c514c71fff2f1a530cd366c0b87b66
gaps: []
human_verification:
  - test: "Run node tests/test-381-bash-assoc.cjs on an x86_64 machine (the release machine) before the cut"
    expected: "Leg G prints 'signed' and passes; all legs ok. This proves the signed-char hash branch of the bash hash-order emulation against live bash."
    why_human: "This host is aarch64 (unsigned char). The signed branch (BASH_SIGNED_CHAR true on x64/ia32) was never run against live bash. CONTEXT ruling 7 requires this run before the cut."
  - test: "Confirm the owner approval for plan 381-09 (legacy bash removal) was given"
    expected: "The owner approved removal after reading 381-PARITY.md and the After numbers."
    why_human: "The approval is recorded only as text in 381-09-SUMMARY.md ('approved by the owner via the checkpoint card in the main session, 2026-10-30'). A verifier cannot prove who approved from code. Order of commits is consistent (PARITY record 17a964e18 before removal ab1632bb7)."
---

# Phase 381: Room scan once, render three times - Verification Report

**Phase goal (ROADMAP):** make the room summary cheap at the root: one node room scan feeds three node renderers behind the unchanged bash entry points compute-state, compute-team and analyze-room, with byte-for-byte stdout parity proven by a diff harness and before/after hook timings measured on the real room.
**Verified:** 2026-10-30, work tree /home/jsagi/gsd-workspaces/phase-381/MindrianOS-Plugin, HEAD 5f9eccf68, host aarch64, node v22.23.1, GNU bash 5.2, WSL2.
**Status:** human_needed (all automated checks pass; two items need a human).
**Re-verification:** No. Initial verification.

Every result below was produced by running the command in this session. SUMMARY.md claims were used only to find where to look. The host load average was 6 to 13 during the runs (other sessions active). No timing claim in this file depends on those runs.

## Per-requirement table

| Req | Behaviour | Status | Evidence (run by the verifier) |
|---|---|---|---|
| PERF381-01 | Byte parity of stdout, exit code and written tree, OLD vs NEW | VERIFIED | `node tests/test-381-parity.cjs`: "parity: 0 diffs in 68 pairs" (22 rooms, 3 scripts, plus mtime-equal and no-registry variants). `--tz host`: 0 diffs in 68 pairs. `--prove-fail`: "PROVE-FAIL OK (expected DIFF: stdout differs at line 92 ...)". I also took a fresh snapshot of the real room (461 files, without lock and wal files) and ran `--room <snapshot>`: 0 diffs in 71 pairs (compute-team, compute-state, analyze-room on the real-room copy all OK). Oracle: `tests/helpers/oracle-381.cjs` runs `git archive` of BASE_SHA (line 95); BASE_SHA is an ancestor of HEAD; the OLD compute-team is 1112 lines at BASE_SHA and 16 lines at HEAD, so OLD and NEW are different code. |
| PERF381-02 | No per-file or per-section spawn on the common path | VERIFIED | `node tests/test-381-spawn-budget.cjs`: all legs pass. Edge room spawn counts are exact and constant: team 9, analyze 5, state 11. Adding 50 artifacts does not change the count. Hostile payloads reach no python3, no node child, create no marker. Net guard log empty. |
| PERF381-03 | Bounded fan-out (32) and byte-ordered results | VERIFIED | `node tests/test-381-room-scan.cjs`: all legs ok, including "200 section files never exceed 32 operations in flight", "random delays give deep-equal models and byte-ordered lists", glob and find equivalence with bash, symlink loop safety, GENERATED_DIR scope. |
| PERF381-04 | Bash hash order emulated, checked against live bash | VERIFIED on aarch64; x86 open | `node tests/test-381-bash-assoc.cjs`: legs A to H ok (100, 5,000, 9,000 keys; growth boundaries 2047/2048/2049/8191/8192/8193; UTF-8 keys; separators; update keeps position). Leg G: "live bash on this host hashes with a unsigned char" and BASH_SIGNED_CHAR equals it. `BASH_SIGNED_CHAR` is derived from `process.arch` (lib/core/room-scan.cjs:52). The signed branch (x64) is untested. See human item 1. |
| PERF381-05 | Named divergences pinned | VERIFIED | `test-381-known-divergence.cjs` (9 legs: invalid UTF-8 team and analyze, NUL byte, SIGPIPE large file, room-path-sed, macOS python path, no experimental warning), `test-381-date-tz-matrix.cjs` (7 ok, `TZ=host` 26 values equal the BASE_SHA bash function), `test-compute-team-date-guard.cjs` ALL PASS, `test-analyze-room-edge-argv.cjs` ALL PASS, `test-381-bash-dialect.cjs` 162 ok. Per the ruling 2 amendment, the python-date and node-e injections are parity cases (NEW equals OLD), not divergences; the hostile-room pairs diff to zero. |
| PERF381-06 | Analyze cache key covers the renderer modules | VERIFIED | `scripts/session-start-state` adds three `-nt` checks (room-render.cjs, room-render-analyze.cjs, room-scan.cjs) giving `reason="renderer"`. `node tests/test-261029-lx3-sessionstart-skip.cjs`: ALL PASS, including "A3 miss: a renderer module newer than the cache" and "A3 reason ... reason=renderer". room-render-analyze.cjs requires only room-scan.cjs at the top level (lazy: visual-ops, vault scanner; the OLD script also used visual-ops), so the three modules cover the analyze output. |
| PERF381-07 | Measured before/after recorded, CHANGELOG matches | VERIFIED (with caveats below) | `381-MEASUREMENTS.md` has Before (HEAD e696981a3, scripts equal to BASE_SHA) and After (HEAD 17a964e18), median of 3, room CHANGED by touch, load gate recorded, raw lines kept. Every CHANGELOG Unreleased number appears there: SessionStart 26943 to 7775 ms; background rebuild 5 s to 0 s (whole seconds, as logged, note 12); compute-state 7977 to 1341 ms; analyze-room 22734 to 1231 ms. The Stop event wall did not move (4688 to 4851 ms) and the CHANGELOG does not claim it did; the measurements file explains why (note 13, ruling 10). No unmeasured claim found. "24 test rooms" matches the 24 gate-room labels in 381-PARITY.md. |
| PERF381-08 | No .ts reachable from a hook; zero network | VERIFIED | `node tests/test-369-hook-require-graph.cjs`: 5 passed, 0 failed. In `bash tests/run-all-381.sh`: "381 Part 8 source sweep: PASSED" (5 new lib modules clean of brain-client, fetch, http, curl and similar tokens) and the net guard is preloaded for every child (spawn-budget net log empty). `node scripts/build-connector-registry.cjs --check` OK and `node scripts/build-orchestration-projection.cjs --check` OK (no new invocable surface, Part 11). |
| PERF381-09 | Legacy bodies removed only after the recorded zero-diff run and owner approval; 363.1 leg D re-pinned | VERIFIED in code; approval is a human item | scripts/compute-team (16 lines), analyze-room (13), compute-state (12) are node-only wrappers: zero hits for python3, BASH_VERSINFO, declare -A, MINDRIAN_LEGACY_COMPUTE; each execs `lib/core/room-render.cjs <mode>`. Commit order: 381-PARITY.md at 17a964e18, removal at ab1632bb7, 363.1 re-pin at 477cdbdf5. `tests/test-363.1-compute-state.cjs` leg D is split into D1 to D4 pointing at room-render-state.cjs (D3 checks no spawn call names scaffold-predicate); it passes. 381-09-SUMMARY.md lines 46 to 48 hold the approval text. See human item 2. |

## Additional checks requested

| Check | Result |
|---|---|
| (a) `bash tests/run-all-381.sh` | PASS=10 FAIL=0 SKIP=0 (bash-assoc, bash-dialect, date-tz-matrix, known-divergence, parity, room-scan, spawn-budget, stop-gate-persist, Part 8 sweep, dash fence). 68 s. |
| (a) `bash tests/run-all-363.1.sh` | PASS=12 FAIL=0 SKIP=1. The skipped block is the optional regression block (needs RUN_363_1_REGRESSIONS=1); I did not run it. |
| Pinning tests from CONTEXT | All exit 0: test-363.1-compute-state, test-compute-state-persists, kqv stop-skip, 266 room-state-description, 240.1 preserved, 240.1 drift-gate, frontmatter-schema-reconcile, test-phase-13.sh (32 passed), test-phase-27-room-structure.sh (8 passed), run-all-2401.sh (PASS=8). |
| (c) session-start unchanged | `git diff --quiet 65aaf329f HEAD -- scripts/session-start` exits 0: byte-identical. |
| (d) `git diff --stat BASE..HEAD -- scripts hooks lib/mcp` | Six files: the three wrappers, `scripts/session-start-state` (+7, cache key), `scripts/PYTHON_GATES.md` (2 rows marked RETIRED), `lib/mcp/stop-gate-handler.cjs` (+4, `persistState`). No file under hooks/ changed. Intended and small. |
| Ruling 4 (stop-gate persistState) | `tests/test-381-stop-gate-persist.cjs`: source pin and behaviour leg pass. CHANGELOG has the matching entry. |
| Node floor 22.18 | `MINDRIAN_TEST_MODE=1 MINDRIAN_TEST_NODE_VERSION=22.17.0 bash scripts/compute-team /x` prints "needs Node.js 22.18.0 or later (found v22.17.0)", exit 1. Works, but see warning W1. |
| Debt markers (TBD/FIXME/XXX) in new or changed code | None. |
| Em-dashes in added CHANGELOG lines and new lib modules | None added. |
| (e) Privacy sweep of `git log -p BASE..HEAD` added lines (case-insensitive, all listed tokens) | 2 added lines, both in commit 0017dcf49 ("chore(381-02): add the phase hook bench copy and the per-script timing helper"): hard-coded real-room path constants (REAL_ROOM and DEFAULT_COPY) in the bench timing helper. They contain a real room folder name. Later commits b752d5202 and 6424f2ffb remove them (source room now comes from the environment, neutral default copy name); the HEAD tree has no hit in tests, lib, scripts, CHANGELOG, bench, MEASUREMENTS, PARITY or the SUMMARY files. No people names were found. Known and to be folded by the orchestrator before review. Two older hits at HEAD (a room name in a comment at line 8 of test-363.1-compute-state.cjs and test-363.1-placeholder-gt.cjs) predate BASE_SHA and are context lines, not added by this phase. |

## Goal-backward assessment

- One scan, three renderers, bash entry points unchanged: VERIFIED. `lib/core/room-scan.cjs` (743 lines), room-render.cjs router, three renderers; wrappers keep argv and exit contract; parity proves stdout and tree bytes.
- Byte-for-byte parity proven by a harness that can fail: VERIFIED (prove-fail, OLD vs OLD determinism recorded in 381-PARITY.md run (e), fresh real-room-copy run by me).
- Before/after on the real room: VERIFIED by the record. I did not re-measure the real room (the room is the owner's live room and the host load was 6 to 13 during this verification; a timing run now would be noise). The numbers are internally consistent: the same-run OLD vs NEW block shows 2603 to 362, 7937 to 1341, 21993 to 1231 ms.
- Spot check of the stated cost on this host, from the parity run on the real-room copy (ext4 scratch, loaded host): compute-team 1502 vs 79 ms, compute-state 3256 vs 315 ms, analyze-room 9773 vs 143 ms (OLD vs NEW). Direction and size agree with the record.

## Warnings (not blockers)

- **W1 Node floor refusal has no test.** `MINDRIAN_TEST_NODE_VERSION` is used only in lib/core/room-render.cjs; no test file references it. The behaviour works (checked by hand above) but a regression would not be caught. Suggest a small test leg.
- **W2 The After numbers were taken at HEAD 17a964e18, before the legacy removal (ab1632bb7).** The renderers are the same code, and I re-ran full parity on the final HEAD (0 diffs), so correctness holds. Timing of the final HEAD was not re-measured. Expected effect: none or smaller (the wrapper no longer reads a switch).
- **W3 The CHANGELOG Before/After per-script medians come from two separate runs** (Before from plan 381-02, After from plan 381-08). The same-run OLD numbers (7937 and 21993 ms) are lower than the Before numbers (7977 and 22734 ms). The claim stays true and the file discloses it, but the CHANGELOG says "Before: median 22734 ms" without that context.
- **W4 SessionStart event time is not the sum of its parts** (MEASUREMENTS note 8, cause not investigated). The Stop event wall is unchanged (about 4.7 to 4.9 s) because the slow part is `on-stop-phase88` and `on-stop-brief`, outside this phase. The ROADMAP goal sentence mentions "Stop 8.4-13.4 s"; only the detached background rebuild improved (5 s to 0 s). The CHANGELOG states this correctly. The Stop hook wall-clock the user feels is not improved by this phase.
- **W5 ROADMAP bookkeeping.** The plan list for Phase 381 in .planning/ROADMAP.md still shows unchecked boxes ("- [ ] 381-01-PLAN.md ..."). Not a goal item.
- **W6 Real-room parity on a snapshot, not on the live room.** Both the recorded run (d) and my run used a copy without the transient lock and wal files. The room.db and one PDF carry binary bytes; parity is still 0 diffs (noted as ruling 2 shape in the harness output).

## Not covered by any test

- Node floor refusal (W1).
- x86_64 signed-char hash order (human item 1).
- Real-room timing is not repeatable in CI by design (the room is not in CI).
- The incremental model cache and the PROFILE.md write-only-if-changed follow-up are deferred by CONTEXT; nothing to verify.

## Gaps Summary

No blocker gap. All nine requirements hold in code and by execution. Status is human_needed only because two items cannot be closed by a verifier: the x86 run of the hash-order test before the cut, and the owner approval of the legacy removal, which exists as text only.

---

_Verified: 2026-10-30_
_Verifier: Claude (gsd-verifier)_
