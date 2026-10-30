# Phase 381 - Context

**Phase:** 381 - Room scan once, render three times: node renderers behind compute-state, compute-team and analyze-room (perf change C, the fork-storm rewrite)
**Gathered:** 2026-10-29 (from the 2026-10-29 JavaScript performance audit; the crashed audit session's report was rebuilt from its transcript)
**Status:** Ready for planning. Code writes are GATED on a peer commit (see Sequencing).

## Phase Boundary

Replace the per-file bash loops inside `scripts/compute-state` (469 lines, 14 loops), `scripts/compute-team` (1,112 lines, 65 loops, 957 forks per run) and `scripts/analyze-room` (1,079 lines, 80 loops, 6,210 forks per run) with ONE node room scan and three node renderers, while every bash entry point and its stdout stay byte-for-byte identical. This is the root fix for the two largest measured costs: Stop 8.4-13.4 s (compute-state) and SessionStart 24-81 s (analyze-room then compute-state). Quick tasks 261029-kqv (Stop skip) and 261029-lx3 (SessionStart reuse) only skip the work on an unchanged room; this phase makes the work itself cheap, so the first start and every real change get the gain too.

Out of scope: `intent-classifier` (finding 4, a separate quick), `query-efficiency-telemetry` (change D, peer quick), hook timeout units (change B, peer quick 261029-qef), the ui-shell Next.js weight, anything in `lib/ui-shell`.

## Measured baseline (source: /home/jsagi/.mindrian/perf-audit-2026-10-29/perf-audit-baseline.md, read-only copy; harness beside it)

Dev tree beta.76, hooks started in parallel as Claude Code does, cwd = the navigator's real room `<ROOM>` (338 files) on a Windows drive under WSL, median of 3:

| Event | Wall | Slowest hook |
|---|---|---|
| Stop (every turn end) | 15,754 ms | on-stop 19,110 ms (compute-state 8.4-13.4 s inside it) |
| SessionStart | 44,134 ms | session-start 30 s+ (analyze-room 24-81 s, 6,210 forks; then compute-state 9.9 s) |

compute-state alone: 584 processes per run; compute-team alone forks 957 (307 sed, 301 head, 222 grep) reading frontmatter file by file. On ext4 the same run is 3.6-7.4 s, so /mnt/c roughly doubles it, but the fork storm is the disease. A node walk of the same room with fs/promises and fan-out 32 measured 91 ms (fix-plan-js.md, "two measured facts").

After kqv + lx3 (already on the branch): Stop median 4,764 ms on an UNCHANGED room, SessionStart median 11,520 ms on an unchanged room; a start that must rebuild still pays the full analyze-room cost (41,682 ms observed).

## Implementation Decisions (from fix-plan-js.md section C, javascript-pro informed)

- **One scan, three renderers.** New `lib/core/room-scan.cjs`: walks the room once (fs/promises, bounded fan-out 32, skips dot dirs), parses each `.md` frontmatter once (`gray-matter` is already a dependency; check `lib/core/frontmatter-schemas.cjs` and `lib/core/folder-memory-shared.cjs` for the parser already in use and reuse it, Canon Part 7), returns a plain model `{ sections[], files[], meetings[], profiles[] }`.
- **Bash entry points stay.** `scripts/compute-state`, `scripts/compute-team`, `scripts/analyze-room` (and `scripts/compute-meetings-intelligence` if it shares the loops) become thin bash wrappers that call node renderers over that model. Their argv contract, exit codes and stdout stay byte-for-byte: `scripts/session-start` parses them, and so do `scripts/session-start-state`, `scripts/on-stop-state`, `scripts/on-cwd-changed`, `scripts/on-agent-complete`, `scripts/build-graph`, `scripts/state-write.cjs`, `scripts/heal-command.cjs`, `scripts/mindrian-tools.cjs`, `lib/core/folder-memory-shared.cjs`. Repo convention "Bash scripts in scripts/ stay authoritative; CJS wraps them" is honoured at the contract level: the bash file remains the entry point and owns the contract; the computation moves under it.
- **Parity harness is the gate.** A script runs the OLD renderer and the NEW renderer over (a) the real room above and (b) every test fixture the pinning tests use, and diffs stdout and the written files (STATE.md, TEAM-STATE, the analyze output). The phase lands only on zero diff. Keep the old bash bodies reachable (for example `scripts/legacy/` or a `MINDRIAN_LEGACY_COMPUTE=1` switch) until the parity run is recorded, then remove them in the last plan.
- **Order inside the phase:** compute-team first (5.1 s of the 8.4 s), then analyze-room's per-term loops, then the rest of compute-state. Each step is its own plan with its own parity run and measurement.
- **Incremental model cache is deferred** (`.mindrian/room-scan.json` keyed by per-file mtime+size); note it as a follow-up, do not build it here unless the single-pass scan misses the target.
- **Measurement protocol:** run `hook-bench-parallel.cjs` (copy it from the read-only audit dir into the phase dir or the session scratchpad; never edit the copy in `~/.mindrian/perf-audit-2026-10-29/`) on the real room, median of 3, Stop and SessionStart, with the room CHANGED (touch one artifact) so the skip paths do not hide the work. Record before and after in CHANGELOG.md Unreleased with real numbers only; no estimates, no hedged figures.

## Pinning tests (must stay green, extend with parity)

`tests/test-363.1-compute-state.cjs`, `tests/test-compute-state-persists.cjs` (if present), `tests/test-261029-kqv-stop-skip-recompute.cjs`, `tests/test-261029-lx3-sessionstart-skip.cjs`, `tests/test-266-room-state-description.cjs`, `tests/test-240.1-state-version-preserved.cjs`, `tests/test-240.1-state-version-drift-gate.cjs`, `tests/test-frontmatter-schema-reconcile.cjs`, `tests/test-phase-13.sh`, `tests/test-phase-27-room-structure.sh`, `tests/run-all-363.1.sh`, `tests/run-all-2401.sh`. Hooks stay `.cjs`; `tests/test-369-hook-require-graph.cjs` must still pass (no `.ts` reachable from a hook).

## Sequencing and shared-tree rules (binding for the executor)

- Branch: `release/beta.77-changelog-panel` in `/home/jsagi/dev/MindrianOS-Plugin` (the only dev workspace). 17 commits ahead of origin at phase creation; push is held by the navigator's push gate.
- **No code write until peer session jsagi-7b reports the sha of quick D (telemetry walk cache) on HEAD.** It runs B (261029-qef, hook timeouts in seconds) then D in this same tree. Planning files under this phase directory are the only writes allowed before that sha.
- Phase 369.6 runs in the workspace `/home/jsagi/gsd-workspaces/phase-369-6` (branch `workspace/phase-369-6`). It edits `scripts/session-start` lines 367-372 (identity-prefix block) and adds one static line to `scripts/intent-classifier.cjs` (its plan 12). This phase must not restructure `scripts/session-start` beyond the call sites of the three scripts, so that merge stays small; whoever merges second re-pins `tests/test-359*`.
- Commit with `--only` / explicit paths. Never `git add -A`. Never push. Update STATE.md only through the phase's own execute steps, after D has landed.
- Canon: Part 6 (the plugin dogfoods its own room; measure on the real room), Part 7 (reuse the frontmatter parser and walker already in `lib/core`), Part 11 (no new invocable surface; `room-scan.cjs` is a library module, not a command), Part 8 untouched (no Brain call anywhere in these scripts).

## Deferred Ideas

- Incremental room-scan cache keyed by mtime+size (above).
- `analyze-room` semantic passes that are more than frontmatter (grep per term over bodies): if a pass cannot be made byte-identical in node in one plan, keep that pass in bash behind the wrapper and record the residual cost; do not block the phase on it.

## Canonical refs

- Audit and fix plan (read-only): `/home/jsagi/.mindrian/perf-audit-2026-10-29/{perf-audit-baseline.md,fix-plan-js.md,hook-bench-parallel.cjs}`
- Source transcript of the audit session: `/home/jsagi/.claude/projects/-home-jsagi/f5142fde-6a56-4889-9ce0-822f4eb3c4d0.jsonl` (assistant text at 12:33:12Z)
- Landed siblings: `.planning/quick/261029-kqv-*/` (Stop skip, A), `.planning/quick/261029-lx3-*/` (SessionStart reuse, A2)
- Rethinking room composite (Dev-Research Compositing rule): file the audit trail under `~/MindrianRooms/rethinking-mindrianos/research/2026-10-29-js-perf-audit/` when the room write gate is open; cross-link here.
- Research mirror entry (source of record, Dev-Research Compositing): `~/MindrianOS/research/2026-10-29-js-perf-audit-hook-latency/` (ROOM.md, 01 baseline, 02 fix plan, 03 harness, 04 chain outcome); room copy pending the write-scope hook.

## Rulings on the research's open questions (orchestrator, 2026-10-29 19:40, binding for the planner)

Source: `381-RESEARCH.md` "Open Questions" and "Conflict found between two locked decisions". The navigator set the goal "e2e optimisation from the cut onward" and the zero-diff parity gate is the phase's contract, so the rulings follow the contract; each is reversible before execution if the navigator objects.

1. **Frontmatter parsing: build the bash-dialect line extractor, not gray-matter.** gray-matter changes 24 of 1,760 real-room field reads (dates become Date objects, 2 invalid-YAML files lose 6 reads, block lists become arrays) and no parser in lib/core matches the bash dialect (`sed -n '/^---$/,/^---$/p' | head -50` then `grep '^key:' | head -1`, including its accidents: body text after a `---` line is read, CRLF files yield nothing). Part 7 is satisfied by the documented search: the surface was enumerated, nothing matched, the net-new module is justified in writing here. The extractor is a small pure function with its own unit test (`tests/test-381-bash-dialect.cjs`) and lives in `lib/core/room-scan.cjs` or beside it.
2. **Named divergences are accepted; node gives the safe and correct result.** The python `-c` date fallback with the frontmatter value pasted into code (injection, PROVEN: a crafted `last_active:` created a file), the `node -e` interpolation of section names (ASSUMED injectable), `echo "$content" | grep -q` SIGPIPE false negatives under pipefail (PROVEN: 0 of 50 matches on a 200 KB file), invalid UTF-8 and NUL handling, and the macOS python-path output difference are NOT reproduced. Each is pinned in `tests/test-381-known-divergence.cjs`. The real room and the fixtures contain none of them, so the gate rooms still diff to zero. The python injection is filed separately as `.planning/debug/compute-team-analyze-room-python-date-fallback-injection.md` for a patch to the shipped bash ahead of this phase.
   Amendment 2026-10-29 (orchestrator, after quick 261029-u8x, commits c884dcbf7, 38535163f, d93706f69, 5a2dcfd4d): python date injection and node -e section-name injection are no longer divergences: the OLD oracle (BASE_SHA after quick 261029-u8x) is safe, so NEW must equal OLD (epoch 0, no marker file, same stdout bytes). Remaining named divergences: SIGPIPE false negatives, invalid UTF-8 and NUL (U+FFFD), room-path-sed, macOS python-path output. The corrected payloads live in tests/test-compute-team-date-guard.cjs and tests/test-analyze-room-edge-argv.cjs (the older RCA Symptoms payload does not fire); the phase reuses them as parity cases, not as divergences.
3. **Locale contract: parity is defined under `LC_ALL=C.UTF-8`.** NEW uses byte order everywhere; the oracle runs with `LC_ALL=C.UTF-8` and a pinned `TZ`.
4. **`lib/mcp/stop-gate-handler.cjs:98-101` bare STATE.md write: route it through `persistState` in the plan that lands the compute-state renderer (one-line change, its own acceptance criterion).** Today the 2 s timeout hides it; the speed-up unmasks it.
5. **`scripts/compute-meetings-intelligence` is out of scope** (different loops, 0.14 s here). Measure it on the /mnt/c copy in the measurement plan; port later only if it dominates.
6. **PROFILE.md rewrite on every run stays** (parity). Follow-up "write only when content changed" is recorded under Deferred Ideas.
7. **Bash hash order is emulated, never sorted.** `declare -A` iteration order (FNV-1, 1024 buckets, head insertion, x4 growth) decides CONVERGE, CONTRADICT, OPP_STATUS, FUND_STAGE line order, the Recurring and Influence rows and the "Primary Voice" tie. The emulation is verified against the live bash on the test host (`tests/test-381-bash-assoc.cjs`); x86_64 signed-char hashing is an open assumption (A1) and the test must run on the release machine before the cut.
8. **Requirement IDs PERF381-01 to PERF381-09 from the research are adopted** and written into the ROADMAP row so the coverage gate can check them.
9. **The oracle is `git archive <BASE_SHA>` of the OLD scripts** with BASE_SHA recorded in the plan; the parity harness proves itself first (OLD vs OLD determinism, then OLD vs HEAD before any renderer exists).
10. **Measurement protocol correction:** after kqv the Stop hook on a CHANGED room runs compute-state detached and does not wait, so the Stop median will not move; the real cost is the `on-stop-state-bg done elapsed_s=` line in `.mindrian/session-close.log`. Report per-script times on a /mnt/c copy, the session-close.log elapsed, and SessionStart CHANGED on the real room (median of 3) with the phase's own harness copy that has a SessionStart payload.
