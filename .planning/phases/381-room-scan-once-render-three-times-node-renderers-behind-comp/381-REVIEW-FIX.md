---
phase: 381-room-scan-once-render-three-times-node-renderers-behind-comp
fixed_at: 2026-10-30T05:20:00Z
review_path: .planning/phases/381-room-scan-once-render-three-times-node-renderers-behind-comp/381-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 381: Code Review Fix Report

**Fixed at:** 2026-10-30
**Source review:** .planning/phases/381-room-scan-once-render-three-times-node-renderers-behind-comp/381-REVIEW.md
**Iteration:** 1
**Worktree:** /home/jsagi/gsd-workspaces/phase-381/MindrianOS-Plugin, branch workspace/phase-381, base 5f9eccf68

**Scope (selected by the orchestrator):** HI-01, HI-02, ME-01, ME-02, ME-05, LO-08, and the CHANGELOG wording part of LO-09. Every other finding is out of scope and was not touched.

**Summary:**
- Findings in scope: 7
- Fixed: 7 (ME-01 and ME-05 are closed by the HI-01 commit)
- Skipped: 0

## Fixed Issues

### HI-01: Every renderer write follows a symlink out of the room

**Files modified:** `lib/core/room-scan.cjs`, `lib/core/room-render-team.cjs`, `lib/core/room-render-analyze.cjs`, `tests/test-381-known-divergence.cjs`
**Commit:** 0fe4261a9
**Applied fix:** New helper `safeRoomWrite(roomArg, target, data, label)` in room-scan.cjs. It runs lstat on every path component below the room. When a component is a symbolic link and the real path of the target leaves the real room path (or does not resolve), nothing is written and the result carries one stderr line `<script>: skipped writing <relative path>: it is a symbolic link`; the exit code stays 0. The bytes go to `<name>.tmp.<pid>.<8 hex>` (flag `wx`) in the target directory, then `renameSync` over the target. An existing target keeps its permission bits. A directory that refuses a new file (EACCES, EPERM, EROFS) falls back to an in-place write with O_NOFOLLOW and no O_CREAT, as the old truncating write did. All write sites use it: TEAM-STATE.md, the PROFILE.md rewrite, the bash profile fallback (the program now prints on stdout instead of `> "$2.tmp" && mv`), and the analyze wikilink sweep. The label is the script name (`compute-team`, `analyze-room`), the same prefix the modules already use on stderr.

**Deviation from decision 1, with reason (flag for the orchestrator):** decision 1 assumed that no gate room holds a symbolic link. The edge room of the parity gate holds two in-room links: `problem-definition/alias.md -> pd-1.md` and the section link `zz-linked -> notes v2` (tests/fixtures/room-381/build-fixture.cjs lines 222-223). The strict form (refuse every link) gave `parity: 1 diffs in 68 pairs`: `PARITY analyze-room edge-room DIFF NEW stderr is not empty while OLD stderr is empty: "analyze-room: skipped writing problem-definition/alias.md: it is a symbolic link\n"`. The shipped form refuses only a link whose real path leaves the room (the threat of HI-01). A link that stays inside the room is written at its real path, which is what OLD did, so parity stays at 0 diffs. A dangling link is refused.

**Tests:** `tests/test-381-known-divergence.cjs`, named divergence `symlink-target`, 3 legs (scratch rooms under os.tmpdir() only):
- `symlink-target (team): a TEAM-STATE.md link is not written through; one stderr line; exit 0`
- `symlink-target (team): a planted PROFILE.md.tmp link is never used; PROFILE.md stays a regular file` (no stderr line here: the unique temp name never opens the planted link, so nothing is skipped; the leg asserts empty stderr, the outside file unchanged, PROFILE.md a regular file, no temp file left)
- `symlink-target (analyze): the wikilink sweep does not write through a section .md link; one stderr line; exit 0`
All 3 legs failed before the fix (outside file changed) and pass after it. The bash profile fallback (a contribution file name with a backslash) was checked OLD against NEW on a scratch room: equal PROFILE.md bytes, equal exit code, equal stderr, no temp file left.

### ME-01: The fixed PROFILE.md.tmp name races

**Files modified:** see HI-01
**Commit:** 0fe4261a9
**Applied fix:** The unique temp name plus rename of `safeRoomWrite` replaces the fixed `PROFILE.md.tmp` and the truncating TEAM-STATE.md write. The rest of ME-01 (no early return at the old line 511, skip a rewrite when the bytes are equal) was not in decision 1 and was not changed.

### ME-05: The wikilink sweep rewrites user files in place

**Files modified:** see HI-01
**Commit:** 0fe4261a9
**Applied fix:** The sweep writes through `safeRoomWrite` (temp file plus rename, same guard). The mtime and size re-check before the rename (the second half of the review fix) was not in decision 1 and was not added.

### HI-02: A failed compute-state writes "Error computing state." over STATE.md at Stop

**Files modified:** `scripts/on-stop-state`, `tests/test-381-onstop-failure.cjs` (new)
**Commit:** a3ae192b1
**Applied fix:** Both paths of on-stop-state (detached child and sync) now treat a non-zero exit or an empty output of compute-state as a failure. On a failure, a non-empty STATE.md stays byte-unchanged; the error text is written (through state-write.cjs, same bytes as before) only when STATE.md is missing or empty. The detached child logs `on-stop-state-bg failed reason=compute-failed elapsed_s=N`; the sync path logs `on-stop-state mode=sync reason=<trigger> reason=compute-failed`. The success paths and their log lines (`on-stop-state-bg done elapsed_s=N`) are unchanged. scripts/session-start-state only prints and never writes STATE.md, so it needed no change; a source leg pins that. The Node floor and the session-start preflight were not changed.
**Tests:** `tests/test-381-onstop-failure.cjs` (registered by the run-all-381.sh glob), forced with `MINDRIAN_TEST_MODE=1 MINDRIAN_TEST_NODE_VERSION=22.12.0`: legs `precondition`, `sync-keep`, `sync-missing`, `detached-keep`, `source pin`. Three legs failed before the fix and all pass after it.

### ME-02: The fan-out limit of 32 is not enforced in the state renderer

**Files modified:** `lib/core/room-render-state.cjs`, `tests/test-381-room-scan.cjs`
**Commit:** 18cd98215
**Applied fix:** A plain `pool(sections, FAN_OUT, ...)` over the sections is not enough, because each section ran its own inner pool of 32 (32 x 32 in flight). `lastUpdated` is replaced by `lastUpdatedAll`: three flat stages (depth-1 listing of every section, lstat of every candidate of every section in one list, date of the newest candidate per section), each through one `pool(..., FAN_OUT, ...)`. The per-section text, sort and date logic is unchanged.
**Tests:** new leg `fan-out (state renderer): renderState on 120 sections never exceeds 32 operations in flight` in tests/test-381-room-scan.cjs (it runs renderState, not scanRoom). Measured: 597 in flight before the fix, 32 after it (1,921 calls).

### LO-08: stop-gate-handler reports success when persistState skipped or failed

**Files modified:** `lib/mcp/stop-gate-handler.cjs`, `tests/test-381-stop-gate-persist.cjs`
**Commit:** 4c2dbbb05
**Applied fix:** `_closeOutStateMd` reads the persistState verdict. It returns true only for `status: 'ok'`; otherwise it returns false and writes one stderr line `[stop-gate-handler] STATE.md not written: persistState status=<status>`. The module had no logger of its own, so the line follows the lib/mcp `[module] message` stderr convention (register-core-tools, tree-watcher, session-catchup); stdout stays the MCP channel. It never throws; closeOutRoom ignores the value and keeps its return shape. persistState still writes its own `[state-version]` line too.
**Tests:** new leg `C behaviour: a persistState verdict other than ok is logged on stderr (review fix LO-08)` (gsd_state_version 99 forces version-mismatch; SKIP when compute-state runs past the 2 s budget). It failed before the fix and passes after it.

### LO-09 (wording part only): the CHANGELOG says the room is read once

**Files modified:** `CHANGELOG.md`
**Commit:** 868171b1e
**Applied fix:** In the Unreleased bullet, "built in one pass over your room" became "built inside one program per script", and "Now the plugin reads the room once and writes" became "Now each of these scripts reads your room files directly inside one node program and writes". Every number, the zero-differences sentence and "Not live until a release carries it." are unchanged (checked by a diff of the numbers). No em-dash, no name. The rest of LO-09 (delete scanRoom, correct docs/ENV-TUNING.md) was out of scope and was not changed.

## Verification after all fixes

Load average at the time (from /proc/loadavg): 1.31 before the suite, 1.71 before parity, 2.10 before parity --tz host, 1.99 at the end.

| Command | Result |
|---------|--------|
| `bash tests/run-all-381.sh` | PASS=11 FAIL=0 SKIP=0 (new test-381-onstop-failure.cjs discovered by the glob; Part 8 sweep and dash fence PASSED) |
| `node tests/test-381-parity.cjs` | `parity: 0 diffs in 68 pairs` |
| `node tests/test-381-parity.cjs --tz host` | `parity: 0 diffs in 68 pairs` |
| `node tests/test-381-parity.cjs --legacy-switch` | `SKIP legacy bodies removed (381-09)`, exit 0 |

Pinning list from 381-VALIDATION.md, every one exit 0:
`node tests/test-363.1-compute-state.cjs`, `node tests/test-compute-state-persists.cjs`, `node tests/test-261029-kqv-stop-skip-recompute.cjs`, `node tests/test-261029-lx3-sessionstart-skip.cjs`, `node tests/test-266-room-state-description.cjs`, `bash tests/run-all-2401.sh`, `bash tests/run-all-363.1.sh`, `node tests/test-frontmatter-schema-reconcile.cjs`, `bash tests/test-phase-13.sh` (git status clean after it), `bash tests/test-phase-27-room-structure.sh`, `node tests/test-369-hook-require-graph.cjs`, `node tests/test-369-installed-layout.cjs`, `node tests/test-365-falsify-missing-five.cjs`, `node tests/test-365-falsify-contradiction.cjs`, `node lib/memory/statusline-active-room-write.test.cjs`.

Also run after the on-stop-state and stop-gate-handler changes, all exit 0: test-261029-s9x-token-estimate-cache, test-198-adapter-budget, test-240.1-state-version-preserved, test-261029-qef-hook-timeouts, test-198-local-only, test-198-stop-gate-retry-ceiling, test-209-primary-sidechannel, test-241-guardian-tripolar-parity, test-248-resolver-census, test-248-room-bind-session-authoritative, test-3551-concurrency, test-3551-mcp-fire-once, test-3551-part8-egress, test-3551-tri-polar, test-359-mcp-declared, test-h27-gate-card-node-fields.

Hooks stay .cjs; no new dependency; no new file under lib/; no em-dash or en-dash in any changed file.

## Open items (not done, for the orchestrator)

- **test-362-disposition D6 fails (pre-existing, not caused by this work).** D6 asserts `git diff --quiet 00fb9599f HEAD` over 6 gate runtime files. Before this work the range already held changes to lib/core/fork-declaration.cjs and the 381-07 commit 80a3559b7 to lib/mcp/stop-gate-handler.cjs (shown by `git diff --stat 00fb9599f HEAD`); the LO-08 commit adds one more change to that file. The test was not run at 5f9eccf68 itself; the cause is derived from the diff (CODE).
- **Decision 1 deviation:** in-room symbolic links are written at their real path (see HI-01). The strict form needs a named divergence for the edge room and a change to the parity harness, which this task did not allow.
- **Same class, outside the renderer write sites:** scripts/compute-meetings-intelligence (run by compute-state) writes MEETINGS-INTELLIGENCE.md and action-items.md with a plain `>` redirect, so a planted link there is still followed. Not in the selected scope.
- **Open decision (from HI-02, not changed):** the session-start preflight accepts Node 22.5.0 and later; the renderer floor is 22.18.0.
- **Commit trailer:** the commits carry the trailer the task named (`Claude Sonnet 5.5`); the session model is Opus 5.5.

---

_Fixed: 2026-10-30_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
