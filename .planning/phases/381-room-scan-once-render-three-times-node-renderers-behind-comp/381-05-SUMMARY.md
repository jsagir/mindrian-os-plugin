---
phase: 381-room-scan-once-render-three-times-node-renderers-behind-comp
plan: 05
subsystem: infra
tags: [analyze-room, node-renderer, byte-parity, bash-assoc, spawn-budget, wikilink-sweep]
requires:
  - phase: 381-03
    provides: lib/core/room-scan.cjs (BashAssoc, globDirs, globFiles, findDepth1, readTexts, firstLineWithPrefix, sortLines, xargsEcho, isGrepWordChar, consoleLogText)
  - phase: 381-04
    provides: lib/core/room-render.cjs router and the renderer conventions
provides:
  - lib/core/room-render-analyze.cjs part 1 (renderAnalyze, termsOf, breToRegExp, FALLBACK_PROGRAMS, CORE_SECTIONS, NOISE_WORDS)
  - lib/core/room-render.cjs analyze mode
affects: [381-06, 381-07, 381-08, 381-09]
tech-stack:
  added: []
  patterns: [transliterate each bash block in bash order, BashAssoc per declare -A, plain-name fast path plus one argv grep per exotic name, in-process formatEdge and wikilink sweep]
key-files:
  created:
    - lib/core/room-render-analyze.cjs
  modified:
    - lib/core/room-render.cjs
key-decisions:
  - "renderAnalyze prints the first line of the next block (## Meeting Coverage) so the parity CLI --until cut compares equal; 381-06 continues block 4 from that line."
  - "The wikilink sweep count follows the bash line rule (printf | sort -u, read per line; a line that starts with -- fails as in wikilink-file.cjs argv parsing), not the unique path count."
  - "Section entry counts add one per LF in a found path (find | wc -l)."
  - "Section names lose trailing LFs ($(basename) rule), so the hostile nl-tail folder is the plain name nl-tail whose directory does not exist."
requirements-completed: [PERF381-01, PERF381-02]
duration: ~15min
completed: 2026-10-30
---

# Phase 381 Plan 05: analyze-room node renderer part 1 Summary

The first four blocks of analyze-room (Gaps, Convergence, Contradictions, Cross-References with the NATIVE-03 wikilink sweep) now run in one node process (`node lib/core/room-render.cjs analyze <room>`). The stdout bytes and the post-run tree are the same as the BASE_SHA oracle on all 22 gate rooms and on a copy of the real room. The real-room copy spawns 0 child processes. scripts/analyze-room is not changed: 381-06 adds the rest of the renderer and the wrapper.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | `cb226961e` | feat(381-05): port the analyze-room gaps, convergence and contradiction passes to node |
| 2 | `065cde929` | feat(381-05): port analyze-room cross-references with in-process edges and wikilink sweep |

Gate re-check (Task 1 Step 0, PROVEN):
- BASE_SHA `65aaf329f`, sc6 `4f470032b` and the hotfix `5a2dcfd4d` are ancestors of HEAD.
- Both quick SUMMARYs (261029-s9x, 261029-sc6) exist.
- `grep -nF "strptime('$datestr'"` on analyze-room and compute-team printed nothing.
- `git log BASE_SHA..HEAD` over the oracle inputs lists only `2b75159b8` (381-04, the compute-team wrapper). There is no foreign commit.

## Parity results (PROVEN; host arm64, node v22.23.1, bash 5.2.21; LC_ALL=C.UTF-8, TZ=UTC)

| Sweep | Command | Last line | Exit | uptime load1 (start / end) |
|-------|---------|-----------|------|------|
| 1 | `node tests/test-381-parity.cjs --direct --only analyze-room --until "## Cross-References" --no-tree` | `parity: 0 diffs in 22 pairs` | 0 | 1.02 / 1.36 |
| 2 | `node tests/test-381-parity.cjs --direct --only analyze-room --until "## Meeting Coverage"` (tree compare on) | `parity: 0 diffs in 22 pairs` | 0 | 1.25 / 1.13 |
| 3 | sweep 2 plus `--room <ROOM>` (harness `cp -a` copy under os.tmpdir()) | `parity: 0 diffs in 23 pairs` | 0 | 1.04 / 0.96 |

- Sweep 2: `PARITY analyze-room edge-room OK 2799 69` and `PARITY analyze-room hostile-room OK 685 66` (OLD ms, NEW ms).
- Sweep 3: `PARITY analyze-room room-copy:<ROOM> OK 7552 104`.
- The NOTE lines for the copy name only files under `.mindrian/` (room.db, room.db-shm, graph-derive-vectors.json) and one PDF in a section (`<file>.pdf`). These are ruling 2 shapes that the four blocks do not read as markdown.
- The hostile room (quick 261029-u8x payload folder names, a leading-dash name, a name ending in a backslash, a name ending in LF) gave equal EDGE bytes. No marker file appeared in any run cwd, and the net guard log stayed empty.
- The edge room covers the sweep writes. Its xref source files get team-name wikilinks, and the tree compare is equal.

## Spawn budget (sweep 4, in-process child_process recorder, PROVEN)

| Room | grep spawns | Other spawns | Names |
|------|-------------|--------------|-------|
| edge room | 2 | 0 | `market.analysis` (`-lZE` INFORMS, `-liZE` CONTRADICTS) |
| hostile room | 6 | 0 | `back\` and the 2 payload names, 2 each |
| real-room copy (`cp -a` of <ROOM> into the session scratchpad, deleted after the run) | 0 | 0 | every section name is plain |

No spawn runs per file or per term. Every pattern is one argv element after `--`. There is no `node -e`, no python and no shell. FALLBACK_PROGRAMS is empty.

## Acceptance results (PROVEN)

Task 1:
- Sweep 1 exits 0 with `parity: 0 diffs in 22 pairs`.
- `grep -cF '[^\\n]'` gives 4 (at least 1).
- `grep -c "new BashAssoc"` gives 3.
- `grep -cE "toLowerCase\(\)|localeCompare"` gives 0.
- `git diff --quiet HEAD -- scripts/analyze-room` passes.

Task 2:
- Sweep 2 exits 0 with `parity: 0 diffs in 22 pairs` (stdout prefix and tree).
- Sweep 3 with `--room <ROOM>` exits 0 (last line above).
- The non-comment grep for `node -e|'-e'|python3|analyze-room-wikilink\.err|require\([^)]*scripts/` gives 0.
- `formatEdge(` count is 2, and `buildTeamLinks(` count is 1.
- The grep spawn counts are recorded above.

Suites (run once at the end, one at a time):
- `bash tests/run-all-381.sh`: exit 0, `Phase 381: PASS=9 FAIL=0 SKIP=0`, 58.6 s, load1 1.58 at start and 1.96 at end. The Part 8 sweep lists room-render-analyze.cjs as clean.
- Each of these exits 0:
  - test-analyze-room-edge-argv (ALL PASS)
  - test-369-hook-require-graph (5 passed)
  - test-363.1-compute-state
  - test-compute-state-persists (ALL PASS)
  - test-266-room-state-description (12 passed)
  - test-240.1-state-version-preserved (5 scenarios)
  - test-240.1-state-version-drift-gate (13 scenarios)
  - test-frontmatter-schema-reconcile
  - test-261029-kqv-stop-skip-recompute (ALL PASS)
  - test-261029-lx3-sessionstart-skip (ALL PASS)
  - test-phase-13.sh (32 passed)
  - test-phase-27-room-structure.sh (8 passed)
  - run-all-363.1.sh (PASS=12 FAIL=0 SKIP=1)
  - run-all-2401.sh (PASS=8 FAIL=0 SKIP=0)
- `git status --porcelain tests/fixtures` was empty after the suites.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] First line of the next block**
- **Found during:** Task 1, while reading the cutAtUntil function of tests/helpers/oracle-381.cjs (before the first parity run).
- **Issue:** cutAtUntil returns the whole buffer when the `--until` line is absent. A NEW output that stops at the blank line therefore holds one more trailing newline than the cut OLD, and parity cannot reach 0 diffs.
- **Fix:** In Task 1, renderAnalyze printed `## Cross-References` after the Contradictions block. In Task 2 it prints `## Meeting Coverage` after the blank line. This is the line that bash prints first in block 4, and 381-06 continues from it.
- **Files modified:** lib/core/room-render-analyze.cjs
- **Commits:** cb226961e, 065cde929

**2. [Rule 1 - Bug] Sweep count rule**
- **Issue:** The plan says count = unique paths. Bash reads `printf '%s' "$XREF_SOURCE_FILES" | sort -u` line by line, so a path with an LF splits into 2 soft no-op entries that both count. wikilink-file.cjs also reads an argv element that starts with `--` as an option and exits 1, so that entry does not count and bash prints `[analyze-room] wikilink-file failed for <src>` to stderr.
- **Fix:** The renderer splits on LF, applies sortLines unique and skips empty lines. It applies the `--` positional rule and writes the stderr line.
- **Commit:** 065cde929

**3. [Rule 1 - Bug] Entry count of a name with LF**
- **Issue:** `find | wc -l` counts lines.
- **Fix:** countEntries adds 1 for each LF in a found path.
- **Commit:** cb226961e

**4. [Rule 1 - Clarification] Section names lose trailing LFs**
- **Issue:** The plan text says a name that ends in LF loses that LF only at the end of the EDGE text. In bash, `dir_name=$(basename "$dir")` already drops it, as in 381-04. The hostile `nl-tail` folder therefore becomes the extended section `nl-tail`, whose directory does not exist, so it is a STRUCTURAL_GAP and never an EDGE source. Parity confirms this.
- **Commit:** cb226961e

### Notes

- The convergence BRE test also emulates `echo "$existing"`: an existing value made only of `-n`, `-e` and `-E` letters is read as echo options.

## Authentication gates

None.

## Known Stubs

None. renderAnalyze ends at the first line of block 4 by design. Plan 381-06 completes the renderer and the wrapper, and the router comment says so.

## Threat Flags

None. There is no new network path. The write targets are the same section files that bash passed to wikilink-file.cjs, and a file is written only when its content changed. The renderer writes nothing to /tmp. No program text is built from room data.

## Issues Encountered

- A coordinator HOLD (a timed Lighthouse run on the host) paused the full sweeps after both task commits. During the HOLD, each gate room was checked alone at nice -n 19 with a scratch probe (22 of 22 OK). The four sweeps ran after RELEASE.
- /tmp/analyze-room-wikilink.err exists on the host. The OLD oracle runs (bash body) write it, not NEW.

## Self-Check: PASSED

- lib/core/room-render-analyze.cjs exists. lib/core/room-render.cjs holds `case 'analyze'`.
- Commits cb226961e and 065cde929 are ancestors of HEAD.
