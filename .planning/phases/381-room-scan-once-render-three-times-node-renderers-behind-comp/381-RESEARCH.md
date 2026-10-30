# Phase 381: Room scan once, render three times - Research

**Researched:** 2026-10-29
**Domain:** Bash-to-Node transliteration of three room renderers with byte-for-byte stdout and written-file parity (fork-storm removal), on WSL2 + /mnt/c (9p) latency
**Confidence:** HIGH for the output contracts, callers, measured costs and parity traps (each read from source or run in a scratch copy). MEDIUM for the expected after-numbers (prototype only). LOW for x86_64 behaviour of the bash hash order (proven on aarch64 only).

Marks used in this file: PROVEN = seen in source or in a run in this session. ASSUMED = not run. Every scratch run used copies under `/tmp/claude-1000/-home-jsagi/3085a95e-3096-40f0-9da6-b0b39fab307a/scratchpad/` (the real room was only read, never written).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
(Copied from 381-CONTEXT.md "Implementation Decisions", "Phase Boundary", "Pinning tests" and "Sequencing and shared-tree rules".)

**Phase Boundary.** Replace the per-file bash loops inside `scripts/compute-state` (469 lines, 14 loops), `scripts/compute-team` (1,112 lines, 65 loops, 957 forks per run) and `scripts/analyze-room` (1,079 lines, 80 loops, 6,210 forks per run) with ONE node room scan and three node renderers, while every bash entry point and its stdout stay byte-for-byte identical. This is the root fix for the two largest measured costs: Stop 8.4-13.4 s (compute-state) and SessionStart 24-81 s (analyze-room then compute-state). Quick tasks 261029-kqv (Stop skip) and 261029-lx3 (SessionStart reuse) only skip the work on an unchanged room; this phase makes the work itself cheap, so the first start and every real change get the gain too.

Out of scope: `intent-classifier` (finding 4, a separate quick), `query-efficiency-telemetry` (change D, peer quick), hook timeout units (change B, peer quick 261029-qef), the ui-shell Next.js weight, anything in `lib/ui-shell`.

**Implementation Decisions (from fix-plan-js.md section C, javascript-pro informed)**
- **One scan, three renderers.** New `lib/core/room-scan.cjs`: walks the room once (fs/promises, bounded fan-out 32, skips dot dirs), parses each `.md` frontmatter once (`gray-matter` is already a dependency; check `lib/core/frontmatter-schemas.cjs` and `lib/core/folder-memory-shared.cjs` for the parser already in use and reuse it, Canon Part 7), returns a plain model `{ sections[], files[], meetings[], profiles[] }`.
- **Bash entry points stay.** `scripts/compute-state`, `scripts/compute-team`, `scripts/analyze-room` (and `scripts/compute-meetings-intelligence` if it shares the loops) become thin bash wrappers that call node renderers over that model. Their argv contract, exit codes and stdout stay byte-for-byte: `scripts/session-start` parses them, and so do `scripts/session-start-state`, `scripts/on-stop-state`, `scripts/on-cwd-changed`, `scripts/on-agent-complete`, `scripts/build-graph`, `scripts/state-write.cjs`, `scripts/heal-command.cjs`, `scripts/mindrian-tools.cjs`, `lib/core/folder-memory-shared.cjs`. Repo convention "Bash scripts in scripts/ stay authoritative; CJS wraps them" is honoured at the contract level: the bash file remains the entry point and owns the contract; the computation moves under it.
- **Parity harness is the gate.** A script runs the OLD renderer and the NEW renderer over (a) the real room above and (b) every test fixture the pinning tests use, and diffs stdout and the written files (STATE.md, TEAM-STATE, the analyze output). The phase lands only on zero diff. Keep the old bash bodies reachable (for example `scripts/legacy/` or a `MINDRIAN_LEGACY_COMPUTE=1` switch) until the parity run is recorded, then remove them in the last plan.
- **Order inside the phase:** compute-team first (5.1 s of the 8.4 s), then analyze-room's per-term loops, then the rest of compute-state. Each step is its own plan with its own parity run and measurement.
- **Incremental model cache is deferred** (`.mindrian/room-scan.json` keyed by per-file mtime+size); note it as a follow-up, do not build it here unless the single-pass scan misses the target.
- **Measurement protocol:** run `hook-bench-parallel.cjs` (copy it from the read-only audit dir into the phase dir or the session scratchpad; never edit the copy in `~/.mindrian/perf-audit-2026-10-29/`) on the real room, median of 3, Stop and SessionStart, with the room CHANGED (touch one artifact) so the skip paths do not hide the work. Record before and after in CHANGELOG.md Unreleased with real numbers only; no estimates, no hedged figures.

**Pinning tests (must stay green, extend with parity):** `tests/test-363.1-compute-state.cjs`, `tests/test-compute-state-persists.cjs` (if present), `tests/test-261029-kqv-stop-skip-recompute.cjs`, `tests/test-261029-lx3-sessionstart-skip.cjs`, `tests/test-266-room-state-description.cjs`, `tests/test-240.1-state-version-preserved.cjs`, `tests/test-240.1-state-version-drift-gate.cjs`, `tests/test-frontmatter-schema-reconcile.cjs`, `tests/test-phase-13.sh`, `tests/test-phase-27-room-structure.sh`, `tests/run-all-363.1.sh`, `tests/run-all-2401.sh`. Hooks stay `.cjs`; `tests/test-369-hook-require-graph.cjs` must still pass (no `.ts` reachable from a hook).

**Sequencing and shared-tree rules (binding for the executor)**
- Branch: `release/beta.77-changelog-panel` in `/home/jsagi/dev/MindrianOS-Plugin` (the only dev workspace). 17 commits ahead of origin at phase creation; push is held by the navigator's push gate.
- **No code write until peer session jsagi-7b reports the sha of quick D (telemetry walk cache) on HEAD.** It runs B (261029-qef, hook timeouts in seconds) then D in this same tree. Planning files under this phase directory are the only writes allowed before that sha.
- Phase 369.6 runs in the workspace `/home/jsagi/gsd-workspaces/phase-369-6` (branch `workspace/phase-369-6`). It edits `scripts/session-start` lines 367-372 (identity-prefix block) and adds one static line to `scripts/intent-classifier.cjs` (its plan 12). This phase must not restructure `scripts/session-start` beyond the call sites of the three scripts, so that merge stays small; whoever merges second re-pins `tests/test-359*`.
- Commit with `--only` / explicit paths. Never `git add -A`. Never push. Update STATE.md only through the phase's own execute steps, after D has landed.
- Canon: Part 6 (the plugin dogfoods its own room; measure on the real room), Part 7 (reuse the frontmatter parser and walker already in `lib/core`), Part 11 (no new invocable surface; `room-scan.cjs` is a library module, not a command), Part 8 untouched (no Brain call anywhere in these scripts).

### Claude's Discretion
CONTEXT.md has no explicit "Claude's Discretion" section. This research treats the items CONTEXT.md marks "for example" (the shape of the legacy switch) and everything not fixed above (module names, CLI entry shape, harness shape, fixture design) as discretion, and gives one recommendation for each.

### Deferred Ideas (OUT OF SCOPE)
- Incremental room-scan cache keyed by mtime+size (above).
- `analyze-room` semantic passes that are more than frontmatter (grep per term over bodies): if a pass cannot be made byte-identical in node in one plan, keep that pass in bash behind the wrapper and record the residual cost; do not block the phase on it.

### Conflict found between two locked decisions (needs a ruling, see Open Question 1)
The decision "parse frontmatter once with gray-matter / reuse the lib/core parser" and the decision "zero diff is the gate" cannot both hold. PROVEN on the real room: gray-matter disagrees with the bash extraction on 24 of 1,760 field reads across 110 files (12 dates become Date objects, 6 files throw on invalid YAML and lose every field, 6 block lists become arrays). No parser in `lib/core` reproduces the bash `sed`/`grep` dialect (details in "Frontmatter parser and walker reuse"). Recommendation: the zero-diff gate wins; build a bash-dialect line extractor in the new module and record the Part 7 justification in the plan.
</user_constraints>

## Project Constraints (from CLAUDE.md)

| Directive | Effect on this phase |
|-----------|----------------------|
| Hooks and the MCP server stay `.cjs`; `.ts` only in modules no hook reaches (`tests/test-369-hook-require-graph.cjs`) | `room-scan` and the renderers MUST be `.cjs`. The bash wrapper that calls them is followed by the graph test (token `${SCRIPT_DIR}/...`), so the renderer becomes a hook root. |
| CLI entry points parse `process.argv` with a switch-case router; no Commander or yargs | The renderer CLI arm is a switch on `argv[2]` (`state`, `team`, `analyze`), the `lib/core/scaffold-predicate.cjs:240-275` pattern. |
| Bash scripts in `scripts/` stay authoritative; CJS wraps them | Kept at the contract level (CONTEXT): the bash files stay the entry points; they `exec node`. |
| No new root `package.json` dependency (TypeScript/UI packages never enter it; `tests/test-341-shrinkwrap-no-dev.cjs`) | No new package. Node built-ins plus modules already in `lib/`. |
| Node >= 22.18.0 floor | `fs/promises`, `node:buffer` `isUtf8` (PROVEN present on v22.23.1), `vm` are available. |
| No em-dashes anywhere; hyphens only | Applies to code comments, tests, CHANGELOG. |
| Canon Part 8 (no Brain egress) | No network anywhere in the renderers; parity test installs the net guard (`tests/helpers/hygiene-355.cjs`). |
| Canon Part 7 (reuse before build) | Reuse `scaffold-predicate.cjs`, `visual-ops.cjs`, `lib/vault/room-scanner.cjs` + `wikilink-builder.cjs`; justify the bash-dialect extractor and the bash hash-order emulator as net-new. |
| Canon Part 11 (born-wired surfaces) | A `lib/core` module with a CLI arm is not a command/agent/pipeline/skill surface; nothing to register. |
| GSD owns dev work; commits `--only`; never push | Executor rule. |
| Verification: run the relevant suite; `bash tests/run-all-<phase>.sh` | Add `tests/run-all-381.sh`. |
| Dev-Research Compositing | File the parity and timing trail in the rethinking room when the write gate opens (CONTEXT canonical refs). |

## Summary

The three scripts are slow because every value is read by a separate process: `sed`, `head`, `grep`, `tr`, `wc`, `node -e` per file, per field, per section pair and per term. On the real room on ext4 (a scratch copy, aarch64 host) the old scripts took: compute-team 1.34 s, compute-state 3.47 s (it runs compute-team and compute-meetings-intelligence inside), analyze-room 13.02 s (PROVEN, one run each). On /mnt/c the audit measured 2-3x more. A read-only node prototype that reads exactly what the three renderers need from the real room on /mnt/c (17 dirs, 104 section `.md` files, 674 KB, 6 profiles) took 392-440 ms at fan-out 32 and 4,775-4,930 ms at fan-out 1 (PROVEN, 2 runs). So bounded async fan-out is required on /mnt/c, and the fork removal is the main gain.

The hard part is not speed. It is byte parity with bash behaviour that is accidental: bash associative-array iteration order (hash order) decides the order of CONVERGE, CONTRADICT, OPP_STATUS, FUND_STAGE, Recurring Concerns, Influence lines, and even WHICH person wins a tie in "Primary Voice"; the ERE `[^\n]` in analyze-room means "not backslash and not n", which is why the real room output has terms like `navigatio`, `sessio`, `evide`; `sed -n '/^---$/,/^---$/p'` also captures body sections after a `---` rule and ignores CRLF frontmatter; roles dedupe fails after the first item (`[advisor, founder, partner, partner, partner, partner]` in the real room); a section dir named `C:\Users\...` breaks the JSON for the Room Map, so the real STATE.md has no Room Map. All of this is reproducible in node: the bash hash order was emulated exactly in node for 100 keys, 5,000 keys (with table growth) and UTF-8 keys (PROVEN on aarch64).

Three old behaviours should NOT be reproduced, and the parity gate must name them: (1) compute-team and analyze-room fall back to `python3 -c` with the frontmatter value pasted into the code, and a room file can run arbitrary Python (PROVEN in scratch: a `last_active:` value created a file); (2) analyze-room pastes section names into `node -e` source (ASSUMED injectable); (3) `echo "$content" | grep -q` under `pipefail` gives a false "no match" for files over the pipe buffer (PROVEN: 0 of 50 matches on a 200 KB file with an early match). Neither the real room nor any fixture triggers these today, so a zero diff on the real room and the fixtures is still reachable.

**Primary recommendation:** Transliterate, do not re-implement. Build `lib/core/room-scan.cjs` (bounded async reads of exactly what the bash reads, plus bash-semantics helpers: hash-order map, bash frontmatter dialect, byte-order sort, xargs/echo emulation, a per-file "legacy fallback" signal) and `lib/core/room-render.cjs` (three renderers that port each bash block line by line, with a switch-case CLI). Each bash script keeps its body and gets a 4-line `exec node` header behind `MINDRIAN_LEGACY_COMPUTE=1`. Prove parity with an OLD oracle extracted by `git archive` at the phase base sha, on fresh copies, under `LC_ALL=C.UTF-8 TZ=UTC`, before any renderer exists.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Entry point, argv, exit code, legacy switch | Bash wrapper (`scripts/compute-state`, `compute-team`, `analyze-room`) | - | Callers invoke these paths directly (`"${SCRIPT_DIR}/compute-state"`, `bash .../analyze-room`, `[ -x ... ]`); the file must stay executable bash. |
| Room read (dirents, stat, bytes) | Node library `lib/core/room-scan.cjs` | OS filesystem (9p on /mnt/c) | One process, overlapped async I/O; latency-bound on /mnt/c. |
| Bash-semantics emulation (hash order, sed/grep frontmatter dialect, xargs, sort order, date -d) | Node library (helpers in room-scan or a sibling) | Legacy spawn fallback for exotic bytes | Parity depends on it; isolated and unit-tested against live bash. |
| Rendering STATE/TEAM-STATE/analyze lines | Node `lib/core/room-render.cjs` | `lib/core/visual-ops.cjs` (in-process), `lib/core/scaffold-predicate.cjs` (in-process) | Pure functions over the scan model + clock. |
| Side-effect writes (team/TEAM-STATE.md, team/**/PROFILE.md, wikilink rewrites) | Node renderer | - | Same files, same bytes, same order as bash. |
| Meetings intelligence (MEETINGS-INTELLIGENCE.md, action-items.md) | Bash `scripts/compute-meetings-intelligence` (unchanged) | spawned once by the compute-state renderer | Different loops (meetings/*/metadata.yaml), 0.14 s on the real room copy; out of scope. |
| STATE.md persistence | `scripts/state-write.cjs` / `lib/core/state-version.cjs::persistState` | callers | compute-state never writes STATE.md; unchanged. |
| Cache invalidation of the analyze result | `scripts/session-start-state` | - | Its key must learn about the renderer module mtime. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:fs/promises` | Node v22.23.1 (floor 22.18.0) | `readdir({withFileTypes})`, `lstat`, `stat`, `readFile` with bounded fan-out | Measured 392-440 ms vs 4.8-4.9 s sequential on the real room (PROVEN). |
| `node:buffer` `isUtf8` | Node >= 18.14 | Detect files whose bytes are not valid UTF-8 (route them to the legacy fallback) | GNU grep in a UTF-8 locale treats such files as binary (PROVEN: `name:` read as empty). |
| `node:child_process` `spawnSync` | built-in | The rare exact fallbacks (`date -d` for non-ISO strings, `grep -lE` for non-plain section names, the meetings script) | One spawn per rare case instead of one per file. |
| `lib/core/scaffold-predicate.cjs` | in repo | `listContentFiles`, `isScaffoldFile` (the ONE scaffold definition, Phase 363.1) | Part 7. In-process instead of 2 CLI spawns. Costs 0.29-0.34 s to load (258 modules, pulls `node:sqlite` via room-birth) (PROVEN). |
| `lib/core/visual-ops.cjs` | in repo | `renderRoomDiagram`, `renderSparkline` (asciichart), `renderProgressBar`, `formatEdge` | Pure functions (PROVEN by reading); in-process removes 17 + 2 + N spawns. |
| `lib/vault/room-scanner.cjs` + `lib/vault/wikilink-builder.cjs` | in repo | The NATIVE-03 wikilink sweep (`scanRoom().teamProfiles`, `buildTeamLinks`) | Same code `scripts/wikilink-file.cjs` runs per file today. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:vm` | built-in | Only if the planner chooses to emulate `formatEdge` for names with a backslash; recommendation is NOT to (see Security) | Avoid. |
| `tests/helpers/hygiene-355.cjs` | in repo | `installNetGuard`, `scrubVendorKey` in the parity test | Proves Part 8 (zero network). |
| `tests/fixtures/large-room/build-fixture.cjs` | in repo | 2,105-artifact run-time room | Walk-cost check only (its files sit 2 levels deep, which the renderers mostly do not read). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| bash-dialect line extractor | `gray-matter` (dependency, 4.0.3, js-yaml 3.14.2) | Breaks parity on the real room (24 of 1,760 reads, PROVEN). Not usable for these renderers. |
| hash-order emulator | sort the hash-ordered blocks | Changes bytes and tie winners; violates the zero-diff gate. |
| in-process OLD oracle via the legacy switch only | `git archive <base> scripts lib references` into a temp tree | The archive oracle survives the legacy-body removal and cannot be mixed with new code; recommended as the primary oracle. |

**Installation:** none. No new package.

**Version verification:** not applicable (no external package). Runtime versions PROVEN on this host: node v22.23.1, bash 5.2.21 (aarch64-unknown-linux-gnu), GNU grep 3.11, GNU sed 4.9, GNU coreutils sort 9.4, GNU awk 5.2.1 (`/usr/bin/awk` -> gawk), python3 3.12.3, locale `LANG=C.UTF-8`, Ubuntu 24.04.3.

## Package Legitimacy Audit

No external package is installed by this phase. Nothing to run through slopcheck.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none) | - | - | - | - | - | - |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Output contracts of the three scripts (Research question 1)

### scripts/compute-state
- **argv:** `$1` = room dir, default `.` (`compute-state:20`). No flags.
- **env read:** `MINDRIAN_ROOMS_HOME` (default `$HOME/MindrianRooms`) for `.rooms/registry.json` (`:37-73`, python3 heredoc). Locale and `TZ` affect bytes (glob order, `date -r`).
- **missing dir:** prints `# Data Room State`, blank, `No room directory found.`; exit 0 (`:22-27`).
- **exit code:** 0 in every observed case (`set -euo pipefail`, but each risky step is guarded). The scaffold-predicate failure is a loud degrade on stderr: `compute-state: scaffold predicate unavailable; entry counts include scaffold files` (`:131`).
- **children (side effects):** `bash compute-team "$ROOM_DIR"` when `team/` exists and the `PROFILE.md` count > 0 (`:222-224`); `bash compute-meetings-intelligence "$ROOM_DIR"` when `meetings/*/` count > 0 (`:227-229`). Writes therefore are `team/TEAM-STATE.md`, every `team/**/PROFILE.md` with a `## Contributions`/`## Key Contributions` heading, `MEETINGS-INTELLIGENCE.md`, `action-items.md`. compute-state itself writes nothing (it prints; `:318-331`).
- **stdout, in order:**
  1. Frontmatter: `---`, `computed: <date -u +%Y-%m-%dT%H:%M:%SZ>`, `venture_stage: <stage>`, `total_entries: <N>`, `current_room: <slug>` (only when the registry's active room realpath equals the room dir realpath), `---` (`:332-337`).
  2. `# Data Room State`, blank.
  3. Room Map block only when the diagram output is non-empty: `## Room Map`, blank, diagram (ANSI truecolor, `useColor: true`), blank (`:342-347`). The diagram input is a JSON string concatenated in bash (`:283-288`); a section name with `\` or `"` makes `JSON.parse` throw and the block disappears (PROVEN on the real room: the dir `C:\Users\jsagi\...` exists, STATE.md has no Room Map).
  4. Sparkline block when non-empty: `Section Completeness` + asciichart, blank (`:349-352`).
  5. `## Sections` table header (2 fixed lines), one row per section: `| name | N | <bar> | Empty/Active/Well-developed | YYYY-MM-DD or - or unknown |` (`:354-371`). Bar = `renderProgressBar(N, max(5, maxN), 10)` via one `node -e` per section (`:366-369`).
  6. blank, `## Gaps`, one line per 0-entry section (8 known messages + generic) or `No gaps detected -- all sections have entries.` (`:376-396`).
  7. blank, `## Cross-References`, `- <section>/<file> references <target>` per (content file x other section) match, or `No cross-references detected yet.` (`:401-408`).
  8. blank; if meetings > 0: `## Meetings` block (count, last meeting = max of first 10 chars of meeting dir names), and if `MEETINGS-INTELLIGENCE.md` exists the `## Cross-Meeting Intelligence` block reading `^convergence_signals:`, `^unresolved_contradictions:`, `^open_action_items:` (ALL matching lines, no head) (`:413-433`).
  9. if team profile count > 0: `## Team` block reading `^roles_represented:`, `^active_members:` and any `CRITICAL` line from the freshly written TEAM-STATE.md (`:436-453`).
  10. `## Suggested Next Action` + one stage line (`:456-469`). Output ends with a newline.
- **Sections:** every non-hidden top-level dir from the glob `"$ROOM_DIR"/*/` (follows symlinks, sorted by bash in LC_COLLATE; codepoint order under C.UTF-8), including `meetings`, `team`, `assets`, `references` (`:104-113`).
- **Counts:** `scaffold-predicate --count-content` over all section dirs (`/\.md$/i`, `Dirent.isFile()` only, scaffold excluded) (`:119`, `lib/core/scaffold-predicate.cjs:208-231`). Degrade path: `find -maxdepth 1 -name "*.md" ! -name ROOM.md` (`:143`).
- **Last Updated:** newest `*.md` at depth 1 by `find -printf '%T@ %p'` + `sort -rn` + `date -r <file> +%Y-%m-%d` (local time, follows symlinks; `-` when none; `unknown` when `date -r` fails) (`:159-164`). Counted BEFORE compute-team writes.
- **Cross-references:** content list from `scaffold-predicate --list-content` (absolute, codepoint-sorted per section, section args in glob order) taken AFTER compute-team wrote `team/TEAM-STATE.md` (`:239`), then `grep -qE "\[\[$target\]\]|room/$target"` per file per other section, target NOT regex-escaped and with no word boundary (`:249-257`).
- **Venture stage:** fixed rule over the 5 core section counts (`:168-197`).

### scripts/compute-team
- **argv:** `$1` = room dir, default `.` (`:525`). **stdout:** empty. **exit:** 0 (`:1112`); 0 when `team/` is missing or no profile has `name:` (`:529-531`, `:604-606`). `set -e`, no `pipefail` (`:514`).
- **bash < 4:** `exec python3` fallback (`:11-512`) with DIFFERENT output (for example the Role Distribution separator line and sorted sections). A node renderer placed before this block also replaces the macOS path (behaviour change on macOS, toward the Linux bytes).
- **Profiles:** `find "$TEAM_DIR" -name PROFILE.md -type f | sort` (recursive, includes hidden dirs, sort in LC_COLLATE) (`:601`). Fields from `sed -n '/^---$/,/^---$/p' | head -50` then `grep '^key:' | head -1 | sed 's/^key: *//'` (`:553-584`). `roles:` inline list only (`tr -d '[]'`...) else `role:` else `unknown` (`:559-566`). Profile path relative via `sed "s|^$ROOM_DIR/||"` (regex built from the path) (`:587`).
- **Artifacts:** top-level `*.md` of every non-hidden dir except `team` and `meetings` (glob order), skipping `ROOM.md`, `TEAM-STATE.md`, `STATE.md` (`:615-632`). `speaker` from `^  speaker:` (2 spaces) then `^speaker:`; `segment_type` then `type` then `entry`; date from `^  meeting_date:` then `^date:` then the file name prefix `YYYY-MM-DD` then `unknown` (`:635-661`).
- **Writes `team/TEAM-STATE.md`** with a truncating redirect (`:824-1067`): frontmatter (`computed:`, `team_size:`, `active_members:`, `roles_represented: [..]`), then Expertise Distribution, Knowledge Gaps (one row per section in glob order; `CRITICAL`, `CONCENTRATION`, `Diverse`), Missing Perspectives (fixed role order), Role Distribution (fixed role order), Activity Patterns (trend from `date -d` epoch math against `date +%s`), Recurring Concerns, Influence Distribution, Influence Scores.
- **Rewrites every `PROFILE.md`** that has `^## Contributions` or `^## Key Contributions` via `awk -v new_section="$(echo -e "$contrib_table")"` into `PROFILE.md.tmp` then `mv` (`:1069-1110`). Content is often unchanged, but the mtime always moves (PROVEN: 6 of 6 profiles in the real room carry the heading).
- **Hash-ordered output (bash `declare -A` iteration):** `section_contributors` build (`:725`), Recurring Concerns (`:928`, `:962`), Influence Distribution rows and the tie winner (`:992`, `:1021`, `:1034`), Influence Scores (`:1045`).

### scripts/analyze-room
- **argv:** `$1` = room dir, default `./room` (`:569`). **missing dir:** prints `NO_ROOM`, exit 0 (`:572-575`). **exit:** 0 since lx3 commit d54e21bd3 (7 `|| true` added); still 1 when the `venture_stage` line of `STATE.md` holds an unmatched quote (`:585`, `xargs` with no `|| true` under `pipefail`) (ASSUMED by reading; not run).
- **bash < 4:** `exec python3` fallback (`:7-554`), output already differs from bash (for example `CONTRADICT` lines are sorted there).
- **Sections:** `ALL_SECTIONS` = 8 fixed core sections, then extended non-hidden dirs (glob order) that are not `meetings`/`team`/core and that hold `STATE.md` or any `*.md` (`find -maxdepth 1 -name "*.md" | head -1`) (`:592-612` region, `CORE_SECTIONS` and discovery loop).
- **Reads `$ROOM_DIR/STATE.md`** for `venture_stage` (`grep -i 'venture_stage:' | head -1`, `sed 's/.*venture_stage:[[:space:]]*//'`, `tr -d '"'`, `xargs`) (`:582-587`). This is the persisted STATE.md, not the fresh compute-state output.
- **stdout blocks, in order:** `## Gaps` (GAP:STRUCTURAL, GAP:SEMANTIC via `get_methodologies` = `grep -m1 '^methodology:'` per file + `sort -u`, STRUCTURAL_GAP for extended, GAP:ADJACENT), blank, `## Convergence` (CONVERGE lines in hash order, `:716`), blank, `## Contradictions` (nested hash order `:764-765`), blank, `## Cross-References` (EDGE INFORMS / CONTRADICTS lines with `formatEdge` ANSI output from one `node -e` per edge, `:798-821`), optional `WIKILINK_SWEEP:xref:N:...`, blank, `## Meeting Coverage`, blank, `## Opportunity Bank` (OPP_STATUS in hash order `:932`, OPP_TOP_RELEVANCE via `sort -t: -k1 -rn | head -3`, OPP_DEADLINE via `sort -t: -k1 | head -5`, FUND_STALE, FUND_STAGE in hash order `:1007`), blank, CAPABILITY lines, blank, `## End`.
- **Writes:** every xref source file is passed to `node scripts/wikilink-file.cjs ROOM src` (one process each, `sort -u` order), which may rewrite the file (team-name wikilinks) (`:835-849`); appends to the shared file `/tmp/analyze-room-wikilink.err`. On the real room copy no file changed (already linked), and `WIKILINK_SWEEP:xref:6` was printed (PROVEN).
- **Time and clock:** `date +%Y-%m-%d` (deadline filter), `date +%s` per fund dir, `date -d` for `last_updated`.

### Byte-affecting rules common to all three (PROVEN unless marked)
| Rule | Where | Node equivalent |
|------|-------|-----------------|
| Glob `*/`, `*.md` sorted by strcoll (LC_COLLATE); codepoint under C.UTF-8 | all loops | sort by `Buffer.compare` of UTF-8 bytes, not JS `<` (UTF-16 order differs for astral characters) |
| `sort`, `sort -u`, `sort -rn`, `sort -t: -k1` use LC_COLLATE; last-resort whole-line compare | team contributions, terms, methodologies, opp lines | byte compare; emulate `-k1` = whole line from field 1; ties by whole line, reversed under `-r` |
| `[[ a < b ]]` / `[[ a > b ]]` use strcoll | compute-state `:209`, compute-team recurring, analyze deadlines | byte compare under C.UTF-8 |
| `$(...)` strips ALL trailing newlines; `echo` adds one | every captured value | strip `/\n+$/` then append `\n` where bash echoes |
| `date -r`, `date +%Y-%m-%d`, `date -d YYYY-MM-DD` are local time (TZ) | dates, trends | `new Date(y, m-1, d)` local midnight; local getters; spawn `date -d` for strings that are not strict ISO |
| `tr '[:upper:]' '[:lower:]'` is byte-wise ASCII under C.UTF-8 | convergence | replace `/[A-Z]/g` only; never `toLowerCase()` |
| `${var:0:10}` counts characters | meeting date | `Array.from(s).slice(0,10).join('')` |
| `IFS='|' read -r a b` puts the rest (with inner `|`) in the last var; a single trailing `|` is dropped (`x|y|` -> b=`y`) | compute-team splits | emulate read splitting exactly (PROVEN table in "Common Pitfalls") |
| bash assoc iteration = FNV-1 32-bit hash, 1024 buckets, head insertion, grows x4 when entries >= 2 x buckets; key bytes as `char` (unsigned on aarch64) | all hash-ordered blocks | `BashAssoc` emulator (PROVEN identical for 100 keys, 5,000 keys, UTF-8 keys) |

## Callers and what they parse (Research question 2)

| Caller | Invokes | What it reads | Byte-sensitive? |
|--------|---------|---------------|-----------------|
| `scripts/session-start:442` via `scripts/session-start-state state` (`:100`) | `"${SCRIPT_DIR}/compute-state" "$ROOM_DIR"` (direct exec, needs +x) | Whole stdout, pasted into `[Room State]` of the model context (`session-start:510/523/544`). Reuse path strips `gsd_state_version`/`status` and requires line 1 `---`, a `computed:` key, and `# Data Room State` right after the closing fence (`session-start-state:81-90`). | YES, all bytes (model context; reuse format guard) |
| `scripts/session-start:521/542` via `session-start-state analyze` (`:107/138`) | `"${SCRIPT_DIR}/analyze-room"` | Whole stdout into `## Proactive Room Intelligence`; balanced tier keeps `head -30` (`session-start:563`), so line ORDER decides which CONVERGE lines the model sees. Cache file `.mindrian/analyze-room.cache` = stdout + `\n` on rc 0, non-empty, not `NO_ROOM` (`session-start-state:142-149`). | YES, all bytes and order |
| `scripts/on-stop-state:119/135` (detached child or sync) | `"$2/compute-state" "$1"` | Pipes stdout into `state-write.cjs`. | YES (persisted STATE.md) |
| `scripts/state-write.cjs` -> `lib/core/state-version.cjs::persistState` (`:281-340`) | none | Line 1 must be `---`; splices `gsd_state_version`, `status` after it; key lines split on first `:` (`:177-205`). | Frontmatter shape |
| `scripts/on-cwd-changed:108` | `"${SCRIPT_DIR}/compute-state" "$NEW_ROOM"` | Pasted into a Cursor-only context string; Claude path emits only a systemMessage. | Low |
| `scripts/on-agent-complete:149` (background) | `"${SCRIPT_DIR}/compute-state"` | Pipes into `state-write.cjs` if non-empty. | YES (persisted) |
| `scripts/on-task-complete:51` | same | same | YES |
| `lib/core/state-ops.cjs:52-61` (MCP `room_state compute-state`) | `bash compute-state` with `timeout: 10000` | `persistState(stdout)`; returns stdout to the model. | YES. Today exceeds 10 s on the real room (assumed timeout failure). |
| `lib/core/intelligence-cascade.cjs:507-540` step 8 | `bash compute-state` (`HSI_TIMEOUT_MS`) | `persistState`. | YES |
| `lib/mcp/stop-gate-handler.cjs:98-101` | `execFileSync('bash', [compute-state, room], {timeout: 2000})` | BARE `fs.writeFileSync(STATE.md)` (bypasses persistState). | YES. See Pitfall 9: the speed-up unmasks this bare write. |
| `scripts/heal-command.cjs:697-760` step 9 | `spawnSync bash compute-state`, 60 s | Non-zero exit = error; writes stdout to STATE.md via tmp+rename (bypasses persistState). | YES |
| `lib/core/navigation/room-birth.cjs:1414-1421` STEP 3 | `execFileSync(process.execPath, [compute-state, roomDir])` i.e. `node scripts/compute-state` | Nothing (stdout dropped; error tolerated). This call can never work (node parses bash). Pre-existing defect, out of scope. | No |
| `lib/wiki/room-home.cjs:80-140` | none | STATE.md frontmatter `venture_stage`, `total_entries` (gray-matter), `## Sections` pipe rows, `## Gaps` bullets. | Table shape |
| `lib/core/folder-memory-shared.cjs:217-258` `parseStateMd` | none | Regexes for `artifact_count|Artifacts|entries`, `gap_status|Status`, `completeness_score`, `last_activity` at line start; none match compute-state output today (table rows start with `|`). | No |
| `lib/core/folder-memory.cjs:450` `parseCurrentRoomField` | none | `current_room:` frontmatter line. | Key line |
| `scripts/run-harness.cjs:516-570` | none | `total_entries` and `computed` keys; re-implements the count rule. | Key lines |
| `scripts/build-graph:1067-1100` (bash) and `:320-360` (python) | `bash analyze-room` | `CONTRADICT:` lines (`IFS=':' read`), `CONVERGE:` lines (term, count). | Line shapes |
| `lib/core/proactive-intelligence.cjs:46-95` | none (fed analyze stdout) | Regexes for `GAP:(STRUCTURAL|SEMANTIC|ADJACENT):`, `CONVERGE:`, `CONTRADICT:`. | Line shapes |
| `lib/core/room-ops-sync.cjs:56-66`, `room-ops-async.cjs:59-76` | `bash analyze-room`, 10 s timeout | raw stdout (MCP `room analyze`). | YES. Today 13-81 s > 10 s on the real room (assumed timeout). |
| `scripts/generate-export.cjs:203-210`, `scripts/generate-presentation.cjs:759` | `bash analyze-room`, 5 s timeout | `parseIntelligence`. | Line shapes |
| `lib/core/meeting-ops.cjs:35-50` (`mindrian-tools meeting compute-team`) | `bash compute-team` | stdout (empty). | No |

Conclusion for the harness: compare the FULL stdout bytes, the exit code, and the full post-run tree (content of every file) of each script. Normalize only the `computed: <ISO>` line (STATE stdout and TEAM-STATE.md) and the `FUND_STALE:<slug>:<days>` digits if fixtures use a past `last_updated`.

## Frontmatter parser and walker reuse (Research question 3)

| Candidate | What it is | Matches the bash dialect? |
|-----------|-----------|---------------------------|
| `gray-matter` 4.0.3 (dependencies, not devDependencies; PROVEN in package.json) | Full YAML (js-yaml 3.14.2) | NO. Real room, 110 files, 16 keys = 1,760 reads: 12 `date:` values become `Date` objects, 6 reads lost because 2 strategy files throw on YAML (bash still reads `status:` and `type:`), 6 `roles:` block lists become arrays (bash reads `""` and falls back to `role:`) (PROVEN). Also: requires frontmatter at line 1; accepts CRLF; trims; unquotes; coerces numbers. |
| `lib/core/state-version.cjs:100-133` `readStateFrontmatter` | split on first `:`, `trim()` both sides, first fence only | NO: trims trailing spaces, stops at the first closing fence, last duplicate key wins. |
| `lib/core/folder-memory-shared.cjs:262-300` `unquote`/`parseMintoFrontmatter` | narrow YAML dialect for MINTO.md | NO: unquotes, lists. |
| `lib/vault/room-scanner.cjs` `parseFrontmatter` | vault scanner parser | NO (YAML-ish); but `scanRoom().teamProfiles` is REUSED for the wikilink sweep. |
| `lib/core/frontmatter-schemas.cjs` | schemas and validation only; no parser | n/a |
| `lib/core/part8-room-lexicon.cjs:169` `_readFrontmatterNames` | name extraction for the Part 8 lexicon | NO (different purpose). |
| `lib/core/scaffold-predicate.cjs` | scaffold classification + `listContentFiles` | REUSE in-process (it is the walker compute-state already depends on). |
| `lib/core/room-map.cjs` `safeReaddir`/`countArtifactFiles` | sync walkers for the ICM map | Not reusable as-is (sync, different filters). |
| `lib/core/verification-stamp.cjs:94-105` `pool(items, n, fn)` | hand-rolled bounded concurrency (copied from `scripts/jev-devtime-client.cjs`; not exported) | Pattern to copy (D-55 forbids requiring scripts/ from lib/). |
| `lib/core/folder-memory-async.cjs` | the only lib/core module already on `fs.promises` | Style reference. |

The bash dialect to implement once (PROVEN by runs in scratch):
1. `sed -n '/^---$/,/^---$/p'`: every range from a line exactly `---` to the next line exactly `---`, inclusive, repeated through the file. Frontmatter need not be at line 1. A body `---` rule starts a second range that runs to the next `---` or EOF, so body keys become visible (`name: B` after a body rule was returned). `---\r` never matches, so a CRLF file has NO frontmatter (all keys empty, the profile is skipped).
2. `| head -50`: keep the first 50 lines of that output (delimiter lines count).
3. `grep '^key:' | head -1 | sed 's/^key: *//'`: first line that starts with exactly `key:`; remove the key, the colon and following SPACES only (tabs kept); trailing spaces, quotes, `\r`, inline `# comments` kept (`[Spaces Kept  ]` PROVEN).
4. The nested variants match `^  speaker:` and `^  meeting_date:` (exactly two spaces).
5. GNU grep in a UTF-8 locale prints nothing for a matching line with invalid UTF-8 (and says `binary file matches` on stderr); under `LANG=C` it prints the line (PROVEN). So a file with invalid UTF-8 or NUL bytes must go to the legacy fallback, and the result is locale-dependent.

Walker rules that differ per renderer (do not unify them):
- compute-state sections: glob `*/` (follows symlinks, skips dot names). Team count: `find team -name PROFILE.md` (any type, recursive, INCLUDES hidden dirs). Counts and cross-ref list: scaffold-predicate (`/\.md$/i`, `isFile()` dirents only, so symlinked files are excluded).
- compute-team: `find team -name PROFILE.md -type f` (recursive, includes hidden dirs). Artifacts: glob `*.md` (case-sensitive, no dotfiles, follows symlinks, `[ -f ]`).
- analyze-room: `count_entries` uses `find -maxdepth 1 -name "*.md"` (includes dotfiles and dirs named `*.md`, does not follow a symlinked section dir as a start point), while every other loop uses the glob. Team count for CAPABILITY uses `team/{members,mentors,advisors}/*/`.
- Consequence for the CONTEXT decision "skips dot dirs": correct for the section glob, WRONG for the team `PROFILE.md` search. The scan must keep raw dirents (name, type, symlink target type) and let each renderer apply its own predicate.

## analyze-room passes (Research question 4)

| Pass | Lines | Inputs | Bash semantics that are hard in node | Recommendation |
|------|-------|--------|---------------------------------------|----------------|
| Gaps (structural, semantic) | `:615-660` region | counts, `grep -m1 '^methodology:'` first match in the WHOLE file, `sort -u`, `grep -c '.'`, `head -1` | an empty `methodology:` value sorts first and yields `Only analyzed via  -- consider`; `grep -c '.'` ignores invalid-UTF-8 lines | port exactly; fallback for invalid UTF-8 |
| Convergence | `:681-726` | each section file: `grep -oE '## [^\n]+|\*\*[^*]+\*\*'` | `[^\n]` = not `\` and not `n` (bracket expression), so `## Navigation` yields `navigatio`; `## ` matches anywhere in a line (also inside `###`); POSIX leftmost-longest (equivalent here because the two alternatives start with different characters) | JS `/## [^\\n]+|\*\*[^*]+\*\*/g` per LINE (split on `\n`, keep `\r`), then `^## ` strip, `**` strip, ASCII lowercase, `/[a-z]{5,}/g`, noise filter, byte-sorted unique |
| | | term -> sections | `echo "$existing" | grep -q "$section"` is an unanchored REGEX substring test: a section whose name is a substring (or regex match) of an already recorded section is not added; counted with `tr '|' '\n' | wc -l` | port the string-and-regex logic, not a Set |
| | `:716-723` | output order | hash order of `term_sections` (65 CONVERGE lines on the real room) | `BashAssoc` |
| Contradictions B2B/B2C | `:741-772` | `content=$(cat)` then `echo "$content" | grep -iqE '\bB2B\b|\benterprise\b'` | (a) `pipefail` + `grep -q` early exit = SIGPIPE false negative for content beyond the pipe buffer (PROVEN 0/50 on a 200 KB file); (b) GNU `\b` treats every Unicode letter/digit/underscore as a word char (Hebrew next to `enterprise` blocks the match; JS `\b` does not); (c) `-i` is Unicode case folding; (d) `$(cat)` drops NUL bytes and trailing newlines | `/(?<![\p{L}\p{N}_])(?:b2b|enterprise)(?![\p{L}\p{N}_])/iu` per line; documented divergence for files > 64 KiB (node is correct); fallback for invalid UTF-8/NUL |
| | `:764-771` | output | nested hash order over `b2b_sections` x `b2c_sections` | `BashAssoc` |
| Cross-ref INFORMS | `:798` | `grep -qE "\[\[$target\]\]|room/$target" "$f"` | target unescaped ERE; no word boundary (`room/market` matches `room/market-analysis`) | plain-name fast path when the name matches `/^[A-Za-z0-9_-]+$/`; otherwise one `grep -lE` spawn per exotic target over the file list |
| Contradiction proximity | `:811-821` | `echo "$content" | grep -iqE "contradict.*$target|conflict.*$target|inconsisten.*$target"` | per line; `.` matches `\r` and every valid character but not invalid bytes; same SIGPIPE issue | `[^\n]*` instead of `.*`, `iu`, per line; same fast path/fallback for names |
| EDGE formatting | `:801-821` | `node -e "...formatEdge('$section', '$target', ...)"` | section names are pasted into JS source; a name with `'` gives a SyntaxError and the plain fallback `"$section INFORMS $target"`; a name with `\` is escape-processed or breaks out of the literal | call `formatEdge` in-process for names without `'`, `\`, line terminators; for others print the plain fallback text and record it as an intentional, security-driven divergence |
| Wikilink sweep | `:835-849` | `sort -u` of xref files, one `node wikilink-file.cjs` each | each child runs a full `scanRoom()`; count = number of unique files whose child exited 0 (soft failures exit 0) | require `room-scanner` + `wikilink-builder` once; call `scanRoom` once (team profiles cannot change during the sweep: `team` is never in ALL_SECTIONS); same byte-sorted order; same write-if-changed rule |
| Meeting coverage | `:860-900` | `grep -q '^source: transcript'` (prefix, so `source: transcript-v2` counts) | python fallback uses exact line equality (already divergent on macOS) | port the bash rule |
| Opportunity bank | `:917-1012` | `grep -m1 '^status:'` + `sed 's/status:[[:space:]]*//'` + `tr -d '"'` + `xargs` | `xargs` splits on space/tab/newline only (`\r` kept: `active\r` stays a distinct key), processes `'` and `\` (`it's` -> empty, exit 1 -> `unknown`), then `/bin/echo` eats `-n`/`-e` (PROVEN table); `sort -t: -k1 -rn` ties; hash order of OPP_STATUS/FUND_STAGE | emulate xargs for values without `'`, `"`, `\` or a leading `-`; spawn `xargs` otherwise |

Measured cost by line on the real room copy (ext4, `bash -x` with `EPOCHREALTIME`, PROVEN, tracing inflates absolute numbers): proximity grep `:814` 1.79 s, cross-ref grep `:798` 1.69 s, term-section count `:718` 1.53 s, substring check `:707` 1.33 s, contradiction `cat` `:811` 0.64 s, term loop `:717` 0.56 s, extraction pipeline `:701/705` 0.74 s, B2B/B2C `:749-757` 0.55 s. compute-state: compute-team call `:223` 1.82 s, cross-ref greps `:254` 0.88 s (528 greps), progress-bar spawns `:369` 0.66 s (17 node spawns, 19 `node -e` total), meetings `:228` 0.22 s, predicate CLIs `:119/:239` 0.17 + 0.19 s.

## Fixtures and harness (Research question 5)

**Existing room fixtures (tracked, never write them in place):** `tests/fixtures/sample-room`, `sample-room-opp` (opportunity-bank + funding; `tests/test-phase-13.sh:233-259` runs analyze-room on it IN PLACE), `test-room-meeting` (meetings), `test-room-causal`, `test-room-reasoning`, `test-room-graph`, `wiki-room-232`, `sample-room-personas`, `icm-rooms/alpha-room` (meetings, sub-rooms), `272/room` (100 files, analyze-room 15.2 s on ext4 PROVEN; the heaviest fixture), `release-room*/sections/...`. NONE has `team/**/PROFILE.md` (PROVEN: `find tests lib -name PROFILE.md` is empty). The pinning tests build their rooms at run time with `mkdtemp` (`test-363.1-compute-state.cjs:54`, `test-240.1-*`, `test-compute-state-persists.cjs:73`, `test-365-falsify-*`, `lib/memory/statusline-active-room-write.test.cjs`).

**Large room:** `tests/fixtures/large-room/build-fixture.cjs` `buildLargeRoom(targetDir, {slug})` builds 2,105 artifacts, but 2,100 of them sit under `solution-design/generated-run-379/engine-input-room/` (depth 3), which the three scripts do not read except through `find team` and the dir globs. Useful as a "does not walk what it does not need" check, not as a render-coverage fixture.

**Real room:** `<ROOM>`, 406 files, 134 MB on disk after `cp -a` (PROVEN). It covers: 17 sections incl. a dir named `C:\Users\jsagi\MindrianRooms\<ROOM-GROUP>\<ROOM>` (no .md), 6 profiles with block-list `roles:`, 1 meeting, opportunity-bank with status-less files, funding/, 65 CONVERGE lines, EDGE CONTRADICTS duplicates, the wikilink sweep (6 files). `cp -a` of the room into the scratchpad took 6.0 s.

**New fixture needed (recommended, build at run time like large-room):** `tests/fixtures/room-381/build-fixture.cjs` that writes an "edge room": team profiles (inline and block `roles:`, `primary_role`, quoted values, a name with a comma, a speaker with `|`, a profile under a hidden dir, a dir named `PROFILE.md`), nested `attribution:` blocks with `  speaker:`, CRLF frontmatter, frontmatter not at line 1, a body `---` rule followed by `name:`, trailing spaces, `X.MD` upper case, a dotfile `.hidden.md`, a symlinked section (where symlinks are available), a section named with `.` (regex), headers with `## ...n...` to exercise `[^\n]`, B2B/consumer terms with Hebrew neighbours, `contradict ... <section>` lines, `[[section]]` and `room/section` references, opportunity statuses with `\r`, `-n`, and spaces, relevance ties, deadlines far in the future (2099) and the past, funding `STATUS.md` with past `last_updated`, `methodology:` empty and duplicated. Plus a separate "known divergence" room (invalid UTF-8, NUL, > 64 KiB with early B2B match, a section with `'`, a `last_active` that GNU date rejects) that the parity test expects to DIFFER, with each difference asserted by name.

**Running OLD vs NEW without mutating anything:**
1. OLD oracle: `git archive <BASE_SHA> scripts lib references package.json | tar -x -C $T/old-tree` and `ln -s <repo>/node_modules $T/old-tree/node_modules` (read-only on the repo). BASE_SHA = HEAD at the start of the phase, after quick D lands. This oracle stays valid after the legacy bodies are deleted.
2. For each room: `cp -a <room> $T/a` and `cp -a <room> $T/b` (cp -a keeps mtimes). Then set every file and dir mtime to one fixed epoch with `fs.utimesSync` so `Last Updated` is stable, except where a test needs ordering.
3. Run OLD on `a` and NEW on `b` with the same clean env: `env -i PATH=/usr/bin:/bin:<node dir> HOME=$T/home LANG=C.UTF-8 LC_ALL=C.UTF-8 TZ=UTC MINDRIAN_ROOMS_HOME=$T/rooms-home` and a registry whose `active` points at the copy under test (rewrite it between the two runs, so both emit `current_room:`; run a second pair with no registry so both omit it).
4. Compare: stdout bytes, exit code, and a content hash of every file in `a` vs `b` (relative paths). Normalize only `^computed: .*$` (STATE stdout, TEAM-STATE.md) and FUND_STALE digits. Run OLD twice first to prove OLD is deterministic on that room (catches SIGPIPE races).
5. Never run anything in the real room: copy it first (step 2). For /mnt/c timing without touching the room, copy it to a scratch dir on the same drive (for example `/mnt/c/Users/jsagi/AppData/Local/Temp/mos-381-<pid>/`) and time OLD and NEW there.

## Node patterns for this repo (Research question 6)

- **Floor:** `engines.node >=22.18.0` (package.json). Host v22.23.1. `fs.promises`, `Dirent`, `isUtf8`, `AbortSignal`, `structuredClone` available.
- **Bounded fan-out:** no exported helper exists. Copy the 12-line `pool(items, n, fn)` from `lib/core/verification-stamp.cjs:94-105` into `room-scan.cjs` (results keep input order; `n` workers pull from a shared index). Use `n = 32` (audit value; prototype PROVEN 392-440 ms on /mnt/c).
- **Ordering rule:** gather with the pool, then SORT with byte order before any rendering. Never rely on completion order.
- **CLI convention:** switch-case on `process.argv[2]` in a `require.main === module` arm, as `lib/core/scaffold-predicate.cjs:240-275`. Set `process.exitCode`, write with `process.stdout.write` once (one big string) to avoid partial writes on a closed pipe.
- **Hook require graph:** `tests/test-369-hook-require-graph.cjs:127-161` follows bash tokens matching `\$\{?(CLAUDE_PLUGIN_ROOT|PLUGIN_ROOT_FOR_NODE|PLUGIN_ROOT|SCRIPT_DIR)\}?\/[A-Za-z0-9_./-]+`. Name the wrapper variable exactly `SCRIPT_DIR` so the renderer becomes a checked root (a name like `SCRIPT_DIR_381` would hide it). Everything the renderer requires must be `.cjs`/`.js`/`.json`.
- **Load cost floor:** node start 0.04-0.05 s; `scaffold-predicate.cjs` require 0.29-0.34 s (PROVEN; 258 modules because `semantic-index/scaffold-template-index.cjs` loads `navigation/room-birth.cjs` and `feynman/feynman-seed-writer.cjs`, which pull `room-db.cjs`/`lazygraph-ops.cjs` and `node:sqlite`, which prints an ExperimentalWarning on stderr). `visual-ops` + asciichart 0.09 s; `room-scanner` + `wikilink-builder` 0.09 s; gray-matter alone 0.17 s. Lazy-require each by need (team block only when `team/` exists; wikilink modules only when an xref exists).
- **Writes:** keep the bash mechanics: TEAM-STATE.md truncating write (not tmp+rename), PROFILE.md via `PROFILE.md.tmp` + rename (same tmp name as bash).

## kqv and lx3 interplay (Research question 7)

- `scripts/on-stop` now only calls `bash "${SCRIPT_DIR}/on-stop-state" "$ROOM_DIR" "$SCRIPT_DIR"` (`on-stop:143-144`). `on-stop-state` decides skip / detached / locked / sync with one `find -newer STATE.md` (`:41-67`), and in `detached` mode runs `"$2/compute-state" "$1"` + `state-write.cjs` in a `setsid` child that logs `on-stop-state-bg done elapsed_s=<SECONDS>` to `.mindrian/session-close.log` (`:102-121`). Consequence: the Stop hook wall time no longer contains compute-state on a changed room (only in `sync` mode: STATE.md missing or no `.mindrian/`).
- `scripts/session-start-state` (`state` and `analyze` modes) prints STATE.md or the analyze cache when no room file is newer (`room_newer`, `:52`), with the lx3 ignore list: `STATE.md`, `STATE.md.tmp.*`, `FEYNMAN.md`, `MINTO.md`, `BRIEF.md`, root `MEETINGS-INTELLIGENCE.md`, root `action-items.md`, `team/TEAM-STATE.md`, and every hidden entry (`:38-52`; the same list is in `on-stop-state:53`). `team/**/PROFILE.md` is NOT in the list, and compute-team rewrites it on every run (mtime moves), so a compute-state run during `do_state` makes `do_analyze` see a newer file (ASSUMED contributor to the analyze misses lx3 reported). Do not change the write behaviour silently; list it as a follow-up.
- The analyze cache is invalidated when `"${SCRIPT_DIR}/analyze-room" -nt "$cache"` (`session-start-state:114`). After this phase the logic lives in `lib/core/room-render.cjs` and `room-scan.cjs`, so a change there would NOT invalidate the cache (up to 24 h of stale output). Add the two module paths to that check, each guarded by `[ -f ]` (the lx3 test uses a fake scripts dir without `../lib`, `tests/test-261029-lx3-sessionstart-skip.cjs:141-146`), and add one lx3 test case.
- `session-start` lines 441-563 are the only call sites; the plan touches none of them (phase 369.6 edits lines 367-372). The kqv test symlinks the real `lib/` into its temp plugin tree and replaces only `scripts/compute-state` with a fake (`test-261029-kqv-stop-skip-recompute.cjs:85-95`), so a wrapper that resolves `$SCRIPT_DIR/../lib/core/...` keeps working there.
- Peer quick B (`261029-qef`) sets the budgets in seconds: `session-start` 180, `on-stop` 20, `sessionstart-coordinator` 40 (`261029-qef-PLAN.md:103`). After B, a hook that runs past its budget is cancelled; SessionStart on a changed real room (24-81 s today) fits inside 180 s, but this phase removes the risk.

## Measurement protocol (Research question 8)

- **Harness invocation (read-only original):** `SCRATCH=<dir> node <copy>/hook-bench-parallel.cjs <pluginRoot> <roomCwd> <runs> <Event...>`; prints `"<Event> hooks=N wall median=X ms  min=Y  slowest: <a>=..ms, <b>=..ms"`; "slowest" is the MAXIMUM over the runs (`hook-bench-parallel.cjs:1-29`). `SCRATCH` is required (transcript path). It uses `bash -lc` and the real HOME.
- **The original cannot run SessionStart:** its `payloads` map has only UserPromptSubmit, PreToolUse, PostToolUse, Stop; `payloads.SessionStart` is undefined and the script throws (PROVEN by reading). The lx3 and qef runs used modified copies. The qef plan defines the variant (`261029-qef-PLAN.md:266`): add `SessionStart: {...base, hook_event_name: 'SessionStart', source: 'startup'}`, match SessionStart groups against `"startup"`, env `SKIP` regex drops hooks (use `SKIP=sessionstart-npm-reconcile`), env `TRANSCRIPT`, and one per-hook max line. That copy lives in a peer scratchpad (`/tmp/claude-1000/-home-jsagi/b995db30-.../scratchpad/qef/hook-bench-perhook.cjs`) and will disappear; make an own copy in the phase dir (`.planning/phases/381-.../bench/`) with the same changes and record the diff against the read-only original.
- **CHANGED room:** before each run, `touch` one content artifact (for example the newest file in `problem-definition/`). This defeats `room_newer` in both helpers. Record `uptime` per run (host load moved results 2x in lx3).
- **What each number means after kqv:** Stop on a changed room returns in `detached` mode, so the Stop median is NOT expected to move; the compute-state cost shows in `on-stop-state-bg done elapsed_s=` (integer seconds) in `<room>/.mindrian/session-close.log`. Record three numbers per plan: (1) per-script wall on a /mnt/c COPY of the room, median of 3 (ms precision, OLD and NEW); (2) SessionStart CHANGED median of 3 on the real room (the event that waits for both scripts); (3) Stop CHANGED median of 3 plus the detached `elapsed_s` lines.
- **Fresh "before":** measure the before numbers at the phase base (after kqv, lx3, B, D) with the same protocol; do not reuse the audit's 8.4-13.4 s / 24-81 s as the CHANGELOG "before" (they pre-date kqv and lx3).
- **CHANGELOG format:** `CHANGELOG.md` `## [Unreleased]` / `### Changed`, one bold first sentence, plain words, the mechanism in 1-2 sentences, "We measured ... Before: median X ms ... After: median Y ms ...", and the closing "Not live until a release carries it." (kqv entry at line 20, lx3 entry at line 21, PROVEN).

## Architecture Patterns

### System Architecture Diagram

```
 caller (hook / MCP / CLI)
   |  argv: <room-dir>
   v
 scripts/<name> (bash, +x)  --MINDRIAN_LEGACY_COMPUTE=1-->  legacy bash body (same file, below the exec line)
   |  exec node lib/core/room-render.cjs <state|team|analyze> "$@"
   v
 room-render CLI (switch on argv[2]) --> missing dir? --> fixed text, exit 0
   |
   v
 room-scan: phase A snapshot (bounded fan-out 32)
   top dirents -> section dirents -> stat + bytes of the files that renderer reads
   team/ recursive (hidden included) -> meetings/*/ -> opportunity-bank, funding/*/STATUS.md
   STATE.md (analyze only), registry.json (state only)
   |
   +--> per file: valid UTF-8 and no NUL? --no--> legacy per-file fallback (spawn the exact bash pipeline)
   |
   v
 renderer (pure port of the bash block, BashAssoc for every declare -A, byte sort, emulated xargs/date)
   |
   +-- team:    write team/TEAM-STATE.md, rewrite PROFILE.md files (bash order)
   +-- state:   [counts, dates from phase A] -> team render in-process -> spawn compute-meetings-intelligence
   |            -> phase B re-read: content list + TEAM-STATE.md + MEETINGS-INTELLIGENCE.md -> cross-refs -> stdout
   +-- analyze: blocks in bash order -> EDGE via formatEdge in-process -> wikilink sweep in-process -> stdout
   v
 one process.stdout.write(text); exit code as bash
```

### Recommended Project Structure
```
lib/core/
  room-scan.cjs          # bounded async snapshot + bash-semantics helpers (BashAssoc, bashFrontmatter,
                         #   byteSort, xargsEcho, dateDToEpoch, readSplit, isLegacyBytes); no CLI
  room-render.cjs        # renderState / renderTeam / renderAnalyze + switch-case CLI arm
scripts/
  compute-state          # 4-line exec header + unchanged legacy body (removed in the last plan)
  compute-team           # same
  analyze-room           # same
  compute-meetings-intelligence   # unchanged, spawned once by renderState
tests/
  test-381-bash-assoc.cjs        # emulator vs live bash (random keys, UTF-8, > 2,048 keys)
  test-381-bash-dialect.cjs      # frontmatter/xargs/sort/read emulation vs live bash
  test-381-parity.cjs            # OLD oracle (git archive) vs NEW on fixtures + edge room
  test-381-known-divergence.cjs  # the named intentional differences
  fixtures/room-381/build-fixture.cjs
  run-all-381.sh
.planning/phases/381-.../bench/hook-bench-381.cjs   # own copy of the harness with SessionStart + SKIP
```

### Pattern 1: Transliterate each bash block, keep its data structures
**What:** port the bash strings-with-separators, `,list,` containment tests and assoc arrays literally, not as idiomatic Sets/Maps.
**When:** every block. Example: `section_contributors` is a comma-joined string built in hash order and counted with `IFS=',' read -ra`; a person named `Smith, John` counts as 2 contributors in bash. A Set would print 1.

### Pattern 2: BashAssoc (exact `declare -A` iteration order)
```javascript
// Source: emulation PROVEN in this session against bash 5.2.21 (aarch64) for 100, 5,000 and UTF-8 keys.
// bash hashlib: FNV-1 32-bit (offset 2166136261, prime 16777619), bucket = hash & (nbuckets-1),
// new items at the HEAD of the bucket list, iteration = buckets 0..n-1, grow x4 when entries >= nbuckets*2.
const SIGNED_CHAR = process.arch === 'x64' || process.arch === 'ia32'; // ASSUMED for x86; proven unsigned on arm64
function bashHash(s) {
  let h = 2166136261 >>> 0;
  for (const b of Buffer.from(s, 'utf8')) {
    h = Math.imul(h, 16777619) >>> 0;
    h = (h ^ (SIGNED_CHAR && b > 127 ? b - 256 : b)) >>> 0;
  }
  return h;
}
class BashAssoc {
  constructor() { this.nb = 1024; this.buckets = Array.from({ length: 1024 }, () => []); this.n = 0; this.idx = new Map(); }
  set(k, v) {
    const hit = this.idx.get(k); if (hit) { hit.v = v; return; }          // update keeps position
    if (this.n >= this.nb * 2) this.grow();
    const it = { k, v }; this.buckets[bashHash(k) & (this.nb - 1)].unshift(it); this.idx.set(k, it); this.n += 1;
  }
  get(k) { const it = this.idx.get(k); return it ? it.v : undefined; }
  grow() { const old = this.buckets; this.nb *= 4; this.buckets = Array.from({ length: this.nb }, () => []);
    for (const b of old) for (const it of b) this.buckets[bashHash(it.k) & (this.nb - 1)].unshift(it); }
  keys() { const out = []; for (const b of this.buckets) for (const it of b) out.push(it.k); return out; }
}
```
The unit test must generate the expected order by running real bash on the CI host, so the x86 sign assumption is checked wherever the test runs.

### Pattern 3: Phased snapshot inside compute-state
**What:** compute-state reads in two phases. Phase A (before the team write): section list, counts, `Last Updated`, meetings count, team count. Phase B (after compute-team and the meetings script wrote): the scaffold content list for cross-refs (now includes a NEW `team/TEAM-STATE.md` on a first run), the cross-ref bytes, `MEETINGS-INTELLIGENCE.md`, `team/TEAM-STATE.md`.
**Why:** `scripts/compute-state:119,159` run before `:223-229`, and `:239` runs after. One snapshot for everything changes counts and cross-refs on a first run.

### Pattern 4: Fast path plus exact fallback
**What:** handle the common byte shapes in node; send the rare shapes to the original bash pipeline (one spawn per case, not per file).
**Cases:** files with invalid UTF-8 or NUL; section names outside `/^[A-Za-z0-9_-]+$/` in a regex (one `grep -lE` over the file list); date strings that are not strict `YYYY-MM-DD` (one `date -d` spawn); xargs inputs with `'`, `"`, `\` or a leading `-`; PROFILE.md tables whose fields hold a backslash (one `awk -v` run). Never fall back to `python3 -c` or `node -e` with pasted values (Security).

### Pattern 5: Wrapper header (bash 3.2 safe, before the python fallback)
```bash
#!/usr/bin/env bash
# compute-team: ... (existing header kept)
# Phase 381: the work runs in lib/core/room-render.cjs; MINDRIAN_LEGACY_COMPUTE=1 runs the bash body below.
if [ "${MINDRIAN_LEGACY_COMPUTE:-}" != "1" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  exec node "${SCRIPT_DIR}/../lib/core/room-render.cjs" team "$@"
fi
# ---- legacy body (byte-identical until plan 381-06 removes it) ----
```
`exec` keeps the PID, stdout, stderr and exit code. The legacy compute-state calls `bash "$SCRIPT_DIR/compute-team"`; the env var is inherited, so a legacy run stays fully legacy. Keep file mode 100755.

### Anti-Patterns to Avoid
- **gray-matter or any YAML parser in these renderers:** breaks parity (PROVEN mismatches).
- **One global "skip dot dirs" walker for all renderers:** breaks the team `PROFILE.md` search and counts.
- **`toLowerCase()`, JS `<` sort, `localeCompare`:** differ from `tr` and C.UTF-8 byte order.
- **A Set/Map where bash used a separator string or `declare -A`:** changes counts, order and tie winners.
- **Promise completion order as output order:** sort after the pool.
- **Running OLD and NEW on the same copy:** the wikilink sweep and the team writes mutate the copy.
- **Running the old scripts through the agent shell's `grep` function:** the Claude Code tool shell defines `grep` as a function that runs ugrep 7.8.4 (PROVEN with `type -a grep`). Child `bash` scripts use `/usr/bin/grep` (GNU 3.11), but ad-hoc pipelines typed in the tool shell do not. Use `env -i` in the harness.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Is this file scaffold?" | a new scaffold rule | `scaffold-predicate.cjs` `listContentFiles`/`isScaffoldFile` in-process | Phase 363.1 single definition; pinned by `test-363.1-*`. |
| Diagram, sparkline, progress bar, edge text | new formatters | `visual-ops.cjs` in-process | Byte source of the current output. |
| Team-name wikilinks | a new linker | `room-scanner.cjs` `scanRoom().teamProfiles` + `wikilink-builder.cjs` `buildTeamLinks` | Same code `wikilink-file.cjs` runs. |
| Meetings intelligence | a node port | spawn `scripts/compute-meetings-intelligence` once | Different loops, 0.14 s on the real room copy, own hash-order blocks; out of scope. |
| STATE.md persistence | a write in the renderer | callers + `state-write.cjs`/`persistState` | compute-state is a pure render by contract (`compute-state:318-331`). |
| Bounded concurrency | a new library | the 12-line `pool` pattern (`verification-stamp.cjs:94-105`) | No dependency allowed; proven pattern. |
| GNU `date -d` parsing | a date parser | strict ISO fast path + `date -d` spawn for anything else | `date -d` accepts many forms; exactness matters only for rare inputs. |

**Key insight:** in this phase the "spec" is the bash behaviour, including its defects. Any idiomatic node rewrite is a behaviour change. The only accepted changes are the named security and correctness divergences, each pinned by its own test.

## Runtime State Inventory

This is a refactor of runtime code, not a rename. No stored key, registered task or secret carries the script names.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `<room>/.mindrian/analyze-room.cache` holds analyze stdout (same bytes after the change). Its invalidation key is the bash file mtime only (`session-start-state:114`). | Code edit: add the renderer module mtimes to the key. No data migration (identical bytes). |
| Live service config | None. Verified: hooks.json commands call `run-hook.cmd on-stop` / `session-start`, not these scripts by name. | None. |
| OS-registered state | None. The detached child is ad hoc (`setsid`), not registered. | None. |
| Secrets/env vars | `MINDRIAN_ROOMS_HOME` (read), new `MINDRIAN_LEGACY_COMPUTE` (transitional). | Document the new var; remove it with the legacy bodies. |
| Build artifacts | Installed plugin copies under `~/.claude/plugins/...` keep the old scripts until a release is installed ("not live until released"). | None in this phase. |

## Common Pitfalls

### Pitfall 1: Hash order looks random, so someone sorts it
**What goes wrong:** CONVERGE/CONTRADICT/OPP_STATUS/FUND_STAGE/Recurring/Influence lines move; the "Primary Voice" tie winner changes. **How to avoid:** `BashAssoc` for every `declare -A`, with insertion order identical to the bash loop order. **Warning sign:** the real-room parity diff shows only reordered lines.

### Pitfall 2: Frontmatter read with a YAML parser
**What goes wrong:** dates, lists, quotes, CRLF and invalid YAML all change values. **Avoid:** the bash dialect extractor (rules 1-5 above). **Warning:** TEAM-STATE `roles_represented` stops repeating `partner`.

### Pitfall 3: `[^\n]` read as "not newline"
**What goes wrong:** the node port produces `navigation` where bash produces `navigatio`. **Avoid:** port the bracket literally: `[^\\n]` in JS. **Warning:** CONVERGE terms ending in `n` appear.

### Pitfall 4: One snapshot for compute-state
**What goes wrong:** the first run on a room without `team/TEAM-STATE.md` differs in cross-refs, and every run differs if counts are taken after the team write. **Avoid:** Pattern 3.

### Pitfall 5: Section-name regexes
**What goes wrong:** names with `.`, `+`, `(` behave as ERE in bash; `c++` is a JS SyntaxError. **Avoid:** plain-name fast path; `grep -lE` spawn for the rest.

### Pitfall 6: SIGPIPE false negatives are not deterministic
**What goes wrong:** OLD gives "no match" for big files with an early match (PROVEN 0/50), sometimes "match" near the boundary. **Avoid:** node gives the correct answer; the harness runs OLD twice and lists every file over 64 KiB in section dirs; the real room has none at depth 1 (PROVEN by `find -size +60k`).

### Pitfall 7: Locale and timezone
**What goes wrong:** OLD order depends on LC_COLLATE and on `tr`/`grep` locale; dates on TZ. **Avoid:** parity under `LC_ALL=C.UTF-8 TZ=UTC` (and once with the host TZ); node uses byte order regardless of locale. State the contract in the plan (Open Question 3).

### Pitfall 8: The analyze cache keeps old output
**What goes wrong:** a renderer change does not invalidate `.mindrian/analyze-room.cache`. **Avoid:** extend `session-start-state:114`.

### Pitfall 9: Faster compute-state unmasks a bare STATE.md write
**What goes wrong:** `lib/mcp/stop-gate-handler.cjs:98-101` runs compute-state with `timeout: 2000` and writes STATE.md with `fs.writeFileSync` (no persistState). Today the call times out on a real room, so nothing is written. After this phase it finishes inside 2 s and starts dropping `gsd_state_version`/`status` (the 240.1 contract). **Avoid:** route that write through `persistState` in the compute-state plan (one-line change), or get a ruling (Open Question 4). `heal-command.cjs:735-740` has the same bare write but already ran (60 s budget).

### Pitfall 10: Source pins in test-363.1
**What goes wrong:** `tests/test-363.1-compute-state.cjs:254-284` (leg D) asserts on the TEXT of `scripts/compute-state`: no `declare -A`, exactly one `scaffold-predicate.cjs" --count-content` line and one `--list-content` line, not inside a loop, and the degrade string present. While the legacy body stays, the pins pass. When the last plan deletes the body, leg D fails. **Avoid:** in the removal plan, re-pin leg D to the renderer (the predicate is required once; the degrade string lives in `room-render.cjs`), with the reason in the commit message.

### Pitfall 11: The `read` split rules
PROVEN on bash 5.2.21 with `IFS='|' read -r a b`: `x|y` -> a=x b=y; `x|y|` -> a=x b=y (single trailing delimiter dropped); `x|y|z` -> b=`y|z`; `x||` -> b=``; `|y` -> a=`` b=y. With 4 vars on `d|s|t|f|g|` the last var gets `f|g|`. A speaker with `|` therefore mis-splits in bash; the port must reproduce it.

### Pitfall 12: The harness bench copy cannot run SessionStart
**Avoid:** own modified copy (Measurement protocol); never edit `~/.mindrian/perf-audit-2026-10-29/`.

### Pitfall 13: macOS output changes
The bash < 4 python fallbacks already print different bytes. A node header placed first replaces them on macOS. Accept and note it (macOS output becomes the Linux output), or place the header after the fallback (keeps the slow macOS path). Recommendation: header first (Tri-Polar: one behaviour on every surface).

## Code Examples

### Bash frontmatter dialect (port of `sed -n '/^---$/,/^---$/p' | head -50` + `grep '^key:' | head -1 | sed 's/^key: *//'`)
```javascript
// Source: semantics PROVEN by scratch runs on GNU sed 4.9 / GNU grep 3.11 (see "Frontmatter parser and walker reuse").
function bashFmLines(text) {
  const lines = text.split('\n'); if (lines.length && lines[lines.length - 1] === '') lines.pop();
  const out = []; let inRange = false;
  for (const l of lines) {
    if (!inRange) { if (l === '---') { inRange = true; out.push(l); } }
    else { out.push(l); if (l === '---') inRange = false; }
    if (out.length >= 50) break;            // head -50
  }
  return out;                               // caller already routed invalid UTF-8 / NUL files to the fallback
}
function bashField(fmLines, key) {          // key may carry the literal '  ' prefix (nested speaker)
  const pre = key + ':';
  const hit = fmLines.find((l) => l.startsWith(pre));
  return hit === undefined ? '' : hit.slice(pre.length).replace(/^ */, '');
}
```

### Convergence term extraction for one file (port of `analyze-room:696-701`)
```javascript
const NOISE = new Set('analysis|framework|venture|methodology|section|evidence|definition|problem|market|solution|business|model|financial|competitive|approach|should|would|could|about|their|these|those|which|where|through|between|using|based|consider|important|different|provide'.split('|'));
function termsOf(text) {                                 // valid UTF-8, no NUL (else fallback)
  const terms = new Set();
  for (const line of text.split('\n')) {
    for (const m of line.matchAll(/## [^\\n]+|\*\*[^*]+\*\*/g)) {   // [^\n] in ERE = not '\' and not 'n'
      const s = m[0].replace(/^## /, '').replace(/\*\*/g, '').replace(/[A-Z]/g, (c) => c.toLowerCase());
      for (const t of s.match(/[a-z]{5,}/g) || []) if (!NOISE.has(t)) terms.add(t);
    }
  }
  return [...terms].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));   // sort -u, C.UTF-8
}
```
Note: `grep -o` then `sed 's/^## //'` works per match line; the `|` pipeline makes each match its own line, so `^## ` strips only a leading `## ` of each match. The port above follows that.

### Bounded pool (copy, do not require scripts/)
```javascript
// Source: lib/core/verification-stamp.cjs:94-105 (copied from scripts/jev-devtime-client.cjs)
async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    for (;;) { const k = i++; if (k >= items.length) return; out[k] = await fn(items[k], k); }
  }));
  return out;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| compute-state on every Stop, synchronous | skip on unchanged room, detached rebuild under a lock | 261029-kqv (2aeacd391) | Stop median 15,754 -> 4,764 ms on an unchanged room |
| analyze-room + compute-state on every SessionStart | reuse STATE.md and `.mindrian/analyze-room.cache` when unchanged | 261029-lx3 (abd946ae3, 36c8163c4) | 11,520 ms median on an unchanged room; a changed room still pays full cost |
| hooks.json timeouts in ms-scale values read as seconds | budgets in seconds | 261029-qef (in progress, 6022aaa8c RED test on HEAD) | a slow hook is cancelled at its budget |
| per-file forks | one node process, bounded async I/O | this phase | the work itself becomes cheap |

**Deprecated/outdated:** the audit's per-event "before" numbers pre-date kqv and lx3; re-measure at the phase base.

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | - |
| V3 Session Management | no | - |
| V4 Access Control | no | - |
| V5 Input Validation | yes | Room files and dir names are untrusted (shared rooms on Cowork, vault imports). Treat every value as data: no `python3 -c`, `node -e` or shell string built from room bytes; argv arrays only for the rare spawns. |
| V6 Cryptography | no | - |
| V12 Files and Resources | yes | Writes stay inside the room dir; tmp names as bash; no path built from frontmatter values. |
| V14 Configuration | yes | Part 8: zero network (net guard in the parity test). |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Code injection through `portable_date_to_epoch` python fallback (`compute-team:516-523`, `analyze-room` same helper at `:994`): a `last_active:` / `last_updated:` value that GNU date rejects is pasted into `python3 -c "...strptime('$datestr',...)"` | Tampering / Elevation of privilege | PROVEN in scratch: a crafted `last_active` created a file. It runs on every compute-state (Stop, SessionStart, SubagentStop, TaskCompleted). The node renderer must never spawn python; a value GNU date rejects maps to epoch 0 (`unknown`), a named divergence. Flag to the navigator: the released versions carry this today. |
| Code injection through `node -e "...formatEdge('$section', '$target', ...)"` (`analyze-room:801-821`) with section dir names containing `'` or ending in `\` | Tampering | ASSUMED (not run). In-process `formatEdge` call; plain fallback text for names with `'`, `\` or line terminators. |
| Regex built from dir names (`grep -E "...$target..."`, `sed "s|^$ROOM_DIR/||"`) | Denial of service (catastrophic patterns) | Plain-name fast path; exotic names go to GNU grep (linear-time engine), not to a JS regex built from the name. |
| Shared `/tmp/analyze-room-wikilink.err` append | Information disclosure (low) | In-process sweep writes nothing to /tmp; stderr only. |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node | renderers, harness | yes | v22.23.1 | none needed (hooks already require node) |
| bash | wrappers, OLD oracle | yes | 5.2.21 aarch64 | - |
| GNU grep / sed / sort / awk / date / xargs | OLD oracle, exact fallbacks | yes | grep 3.11, sed 4.9, coreutils 9.4, gawk 5.2.1 | - |
| python3 | OLD compute-state registry read; OLD fallbacks | yes | 3.12.3 | node replaces it in NEW |
| git (read-only `archive`) | OLD oracle | yes | (repo) | `git show <sha>:<path>` per file |
| strace / faketime / hyperfine | fork counts, fixed clock, timing | NO | - | `bash -x` + `EPOCHREALTIME` for profiles; fixed mtimes + far dates instead of a fake clock; the bench copy for timing |
| Real room on /mnt/c | Part 6 measurement | yes (read PROVEN) | 406 files | a copy under the scratchpad for parity; a copy on /mnt/c for timing |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** strace (use xtrace profiles), faketime (fixed mtimes and far-future/far-past fixture dates; normalize `computed:` and FUND_STALE digits).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | plain `node:assert/strict` CJS scripts, exit 0/1 (repo convention, for example `tests/test-363.1-compute-state.cjs`); runner `tests/run-all-381.sh` on the `run-all-363.1.sh` pattern (glob `tests/test-381-*.cjs`, PASS/FAIL/SKIP counts) |
| Config file | none (Wave 0 creates `tests/run-all-381.sh`) |
| Quick run command | `node tests/test-381-bash-assoc.cjs && node tests/test-381-bash-dialect.cjs` (target < 10 s) |
| Full suite command | `bash tests/run-all-381.sh` plus the pinning list: `node tests/test-363.1-compute-state.cjs`, `node tests/test-compute-state-persists.cjs`, `node tests/test-261029-kqv-stop-skip-recompute.cjs`, `node tests/test-261029-lx3-sessionstart-skip.cjs`, `node tests/test-266-room-state-description.cjs`, `bash tests/run-all-2401.sh`, `bash tests/run-all-363.1.sh`, `node tests/test-frontmatter-schema-reconcile.cjs`, `bash tests/test-phase-13.sh`, `bash tests/test-phase-27-room-structure.sh`, `node tests/test-369-hook-require-graph.cjs`, `node tests/test-369-installed-layout.cjs`, and the extra script-runners found here: `node tests/test-365-falsify-missing-five.cjs`, `node tests/test-365-falsify-contradiction.cjs`, `node lib/memory/statusline-active-room-write.test.cjs` |

Baseline status PROVEN green in this session: test-363.1-compute-state (6.3 s), test-compute-state-persists (4.3 s), test-240.1-state-version-preserved, test-240.1-state-version-drift-gate, test-frontmatter-schema-reconcile (2.5 s), test-369-hook-require-graph (0.2 s), test-365-falsify-missing-five (2 s), test-365-falsify-contradiction (2 s), statusline-active-room-write (8 s). Not run here: kqv and lx3 tests (green per their SUMMARYs), test-phase-13.sh and test-phase-27 (test-phase-13 runs analyze-room IN PLACE on a tracked fixture; run it only on a clean tree and check `git status` after).

### Proposed requirements (Requirements are TBD in ROADMAP; the planner may adopt these IDs)
| ID | Behavior |
|----|----------|
| PERF381-01 | `scripts/compute-team`, `compute-state`, `analyze-room` keep argv, exit codes, stdout bytes and written-file bytes identical to the OLD oracle on every fixture room, the edge room and a copy of the real room (normalized `computed:` only). |
| PERF381-02 | The three scripts spawn no per-file or per-section process on the common path (fallbacks only for named byte shapes). |
| PERF381-03 | `lib/core/room-scan.cjs` reads with bounded fan-out (32) and returns byte-ordered results. |
| PERF381-04 | Bash hash order is emulated and verified against live bash on the test host. |
| PERF381-05 | The named divergences (python/node-e injection, SIGPIPE false negatives, invalid UTF-8 handled by fallback) are pinned by tests. |
| PERF381-06 | The analyze cache invalidates when the renderer modules change. |
| PERF381-07 | Before/after numbers (per-script on a /mnt/c copy; SessionStart and Stop CHANGED on the real room, median of 3) are recorded in CHANGELOG Unreleased. |
| PERF381-08 | No `.ts` reachable from a hook; Part 8: zero network in the renderers. |
| PERF381-09 | Legacy bodies removed only after the recorded zero-diff run; test-363.1 leg D re-pinned. |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERF381-01 | OLD vs NEW parity on fixtures + edge room | integration | `node tests/test-381-parity.cjs` (about 40-60 s: OLD analyze-room alone is 15.2 s on `272/room`) | no, Wave 0 |
| PERF381-01 | parity on a real-room copy | manual-gated integration (room not in CI) | `node tests/test-381-parity.cjs --room <copy-of-real-room>` with the result filed as `381-PARITY.md` | no, Wave 0 |
| PERF381-02 | no per-file spawn | unit (spawn counter: wrap `child_process` in the renderer test and assert the count on the edge room) | `node tests/test-381-spawn-budget.cjs` | no |
| PERF381-03 | fan-out and order | unit | `node tests/test-381-room-scan.cjs` | no |
| PERF381-04 | hash order | unit vs live bash | `node tests/test-381-bash-assoc.cjs` | no |
| PERF381-05 | named divergences | unit/integration | `node tests/test-381-known-divergence.cjs` | no |
| PERF381-06 | cache key | integration | new case in `tests/test-261029-lx3-sessionstart-skip.cjs` | yes (extend) |
| PERF381-07 | timings | manual measurement | own bench copy, see Measurement protocol | n/a |
| PERF381-08 | require graph, net guard | static + unit | `node tests/test-369-hook-require-graph.cjs`; net guard inside `test-381-parity.cjs` | yes / no |
| PERF381-09 | legacy removal | static | re-pinned `node tests/test-363.1-compute-state.cjs` | yes (re-pin) |

### Sampling Rate
- **Per task commit:** quick run command (bash-assoc + bash-dialect), plus `node tests/test-381-parity.cjs --only <script>` for the script the task touched.
- **Per wave merge:** `bash tests/run-all-381.sh` + the pinning list.
- **Phase gate:** full suite green, real-room-copy parity zero diff recorded, measurements recorded, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/run-all-381.sh` - runner.
- [ ] `tests/fixtures/room-381/build-fixture.cjs` - edge room + known-divergence room (run-time, writes only under its target, refuses `~/MindrianRooms`, as `large-room/build-fixture.cjs` does).
- [ ] `tests/helpers/oracle-381.cjs` - `git archive <BASE_SHA>` OLD tree builder (BASE_SHA recorded in the plan), clean env, copy-twice, mtime pinning, normalization, tree hash diff.
- [ ] `tests/test-381-parity.cjs` - first run compares OLD vs OLD (determinism) and OLD vs current HEAD scripts (zero diff before any renderer exists), so the harness itself is proven before plan 381-03.
- [ ] `tests/test-381-bash-assoc.cjs`, `tests/test-381-bash-dialect.cjs` - written with the helpers in plan 381-02.
- [ ] `.planning/phases/381-.../bench/hook-bench-381.cjs` - own harness copy with SessionStart payload, `SKIP`, per-hook max lines.
- [ ] Before numbers at the phase base (per-script on a /mnt/c copy; SessionStart and Stop CHANGED on the real room).

## Recommended plan breakdown (for the planner)

| Plan | Wave | Content | Gate |
|------|------|---------|------|
| 381-01 | 0 | Harness, OLD oracle, edge fixture, runner, bench copy, before numbers | waits for the quick D sha on HEAD |
| 381-02 | 1 | `room-scan.cjs` + bash-semantics helpers + unit tests vs live bash | 381-01 |
| 381-03 | 2 | compute-team renderer + wrapper header; parity + per-script timing | 381-02 |
| 381-04 | 3 | analyze-room renderer (all passes, in-process EDGE and wikilink sweep) + wrapper + `session-start-state` cache key + lx3 test case; parity + timing | 381-03 (shares helpers) |
| 381-05 | 4 | compute-state renderer (phased snapshot, team in-process, meetings spawn, predicate and visual-ops in-process, registry in node) + wrapper + stop-gate-handler `persistState` fix (if ruled); parity + timing | 381-04 |
| 381-06 | 5 | real-room hook measurements (CHANGED, median of 3), CHANGELOG entry, real-room-copy parity record, remove legacy bodies, re-pin test-363.1 leg D, file the trail in the rethinking room | 381-05, human read of the parity record |

Each plan writes only its own files and commits with `--only`. 381-04 and 381-05 must not edit `scripts/session-start`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | On x86_64 bash hashes key bytes as signed `char` (so non-ASCII keys order differently than on aarch64) | Pattern 2 | Non-ASCII names/statuses in hash-ordered blocks reorder on x86 hosts. Mitigated: the unit test compares against live bash on the host that runs it. |
| A2 | Bash versions older than 5.2 use the same FNV-1 hash and growth rule | Pattern 2 | Users on older bash had a different order before; the node order matches 5.2. Low impact (ordering only). |
| A3 | analyze-room still exits 1 when the STATE.md `venture_stage` line holds an unmatched quote | Output contracts | One exit-code case differs if wrong; the edge room test will show it. |
| A4 | `formatEdge` interpolation in analyze-room is exploitable with crafted dir names | Security | If not exploitable, the divergence is still harmless (plain text). |
| A5 | `state-ops`, `room-ops-sync` and `stop-gate-handler` calls time out today on the real room | Callers | Only the description of current behaviour changes. |
| A6 | Git Bash on Windows converts the room path argv for node.exe as it does today for the scaffold predicate | Tri-Polar | Windows CLI wrapper could pass `/c/...` paths; existing predicate call is the precedent. |
| A7 | PROFILE.md mtime churn contributes to lx3 analyze-cache misses | kqv/lx3 interplay | Only the follow-up note changes. |
| A8 | The expected NEW cost on /mnt/c is about 1-1.5 s for compute-state and about 1 s for analyze-room (node start + 0.3 s predicate load + 0.4 s scan + writes + one meetings spawn) | Summary / measurement | An estimate for planning only; never for CHANGELOG. |

## Open Questions (RESOLVED)

1. **gray-matter vs zero diff (locked-decision conflict).**
   - What we know: gray-matter changes 24 of 1,760 real-room reads; no lib/core parser matches the bash dialect.
   - What's unclear: whether the navigator accepts a net-new bash-dialect extractor under Part 7.
   - Recommendation: accept it; the zero-diff gate is the stronger decision. NEEDS_HUMAN only if the navigator wants gray-matter output instead (that would be a behaviour change and a new gate).
   - RESOLVED: ruling 1 (381-CONTEXT.md)
2. **Named divergences.** Python injection fallback, `node -e` interpolation, SIGPIPE false negatives, invalid-UTF-8/NUL handling, macOS python-path output. Recommendation: node gives the safe/correct result; each is pinned in `test-381-known-divergence.cjs`; the real room and fixtures contain none, so their parity stays zero diff. Also report the python injection to the navigator as a live defect in released versions (a separate quick may want to patch the bash today).
   - RESOLVED: ruling 2 (381-CONTEXT.md)
3. **Locale contract.** OLD order depends on LC_COLLATE (C.UTF-8 here; en_US elsewhere). Recommendation: NEW uses byte order everywhere; parity is defined under `LC_ALL=C.UTF-8`.
   - RESOLVED: ruling 3 (381-CONTEXT.md)
4. **stop-gate-handler bare write.** Recommendation: switch to `persistState` inside 381-05 (one line), because the speed-up makes it start writing.
   - RESOLVED: ruling 4 (381-CONTEXT.md)
5. **compute-meetings-intelligence.** Recommendation: out of scope (different loops, 0.14 s here); measure it on the /mnt/c copy in 381-05; port later only if it dominates.
   - RESOLVED: ruling 5 (381-CONTEXT.md)
6. **PROFILE.md rewrite on every run.** Recommendation: keep (parity) and add a follow-up "write only when content changed" next to the lx3 follow-up.
   - RESOLVED: ruling 6 (381-CONTEXT.md)

## Sources

### Primary (HIGH confidence)
- Source reads: `scripts/compute-state` (1-469), `scripts/compute-team` (1-1112), `scripts/analyze-room` (1-1079), `scripts/session-start` (430-600), `scripts/session-start-state`, `scripts/on-stop-state`, `scripts/on-cwd-changed`, `scripts/on-agent-complete`, `scripts/on-task-complete`, `scripts/state-write.cjs`, `lib/core/state-version.cjs`, `lib/core/state-ops.cjs`, `lib/core/intelligence-cascade.cjs`, `lib/mcp/stop-gate-handler.cjs`, `scripts/heal-command.cjs`, `lib/core/navigation/room-birth.cjs`, `lib/core/scaffold-predicate.cjs`, `lib/core/visual-ops.cjs`, `lib/vault/room-scanner.cjs`, `lib/vault/wikilink-builder.cjs`, `scripts/wikilink-file.cjs`, `lib/core/proactive-intelligence.cjs`, `scripts/build-graph`, `lib/core/folder-memory-shared.cjs`, `lib/core/verification-stamp.cjs`, `tests/test-369-hook-require-graph.cjs`, `tests/test-363.1-compute-state.cjs`, kqv and lx3 tests, SUMMARYs and the qef PLAN.
- Runs in the scratchpad (PROVEN): OLD timings on the real-room copy; xtrace line profiles; gray-matter vs bash comparison; BashAssoc emulation vs bash; SIGPIPE test; invalid UTF-8 grep test; sed range tests; read split tests; xargs tests; python injection test; read-only node scan of the real room on /mnt/c; module load costs; pinning tests baseline.
- Audit files (read-only): `/home/jsagi/.mindrian/perf-audit-2026-10-29/{perf-audit-baseline.md,fix-plan-js.md,hook-bench-parallel.cjs}`.

### Secondary (MEDIUM confidence)
- bash `hashlib.c` behaviour (FNV-1, bucket head insertion, x4 growth at 2x load): inferred from training knowledge and CONFIRMED by the emulation matching bash 5.2.21 output exactly; the source file itself was not read in this session.

### Tertiary (LOW confidence)
- x86_64 signed-char hashing (A1); older bash versions (A2).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new package; reused modules read and load-timed.
- Architecture: HIGH - contracts and ordering rules read from source and checked by runs.
- Pitfalls: HIGH - most are PROVEN by runs; A1-A4 marked.
- Expected gains: MEDIUM - prototype scan measured; full renderers not built.

**Research date:** 2026-10-29
**Valid until:** 2026-11-12 (the tree moves fast: B and D land first; re-check `session-start-state`, `on-stop-state` and the three scripts for new commits before planning).

## RESEARCH COMPLETE
