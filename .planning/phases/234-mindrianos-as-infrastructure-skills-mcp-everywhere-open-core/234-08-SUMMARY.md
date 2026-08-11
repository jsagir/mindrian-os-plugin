---
phase: 234-mindrianos-as-infrastructure-skills-mcp-everywhere-open-core
plan: 08
subsystem: infra
tags: [canon-part-8, open-core, free-core, egress-scan, adversarial-grep, self-proving-gate, checkpoint-pending]
status: IN PROGRESS - BLOCKED AT TASK 2 CHECKPOINT (human-verify, gate=blocking)

# Dependency graph
requires:
  - phase: 234-01
    provides: tests/run-all-234.sh (the glob-discovering harness this plan's test joins), the PART8_RE pattern text this scan reuses verbatim, and the MEASURED resolution that lib/core/resolve-brain-key.cjs needs no allow-list entry
  - phase: 234-05
    provides: the two-axis host-tier + write-path chokepoints (surface-detect.cjs, mcp-first-flag.cjs) already under the harness Part 8 sweep, so this scan extends a clean baseline
  - phase: 234-06
    provides: MINDRIAN_OS_ROOT-first skill bodies, without which a foreign host could not be asked to load the catalog at all (Task 2's precondition)
  - phase: 234-07
    provides: dist/generic-claude-dir/ and dist/zed/, the artifacts Task 2's human verification actually installs
  - phase: 233
    provides: the run-all-233.sh Part 8 negative-self-test-first idiom and the exact regex text, reused rather than re-derived (Canon Part 7)
provides:
  - tests/test-234-free-core-network-scan.cjs - the 234-scoped instance of the Canon Part 8 adversarial grep, glob-discovered by tests/run-all-234.sh
affects: [D-08, D-09, D-11, 234-08 Task 2 checkpoint, any future lib/mcp/tools/ module added]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Glob-discover a growing directory rather than freezing a target list: a stale target list prints the same green as a clean codebase"
    - "Discovering ZERO files is a hard failure, not a vacuous pass"
    - "Reuse a settled measurement as an ASSERTION, not as an allow-list entry: an allowance blinds the gate forever, an assertion keeps it sharp and proves the reasoning still holds"
    - "Assert pattern parity with the sibling harness by parsing the harness file, so a future strengthening of one cannot leave the other behind"
    - "An empty allow-list is a stronger claim than a populated one, and every future entry must carry a written reason enforced by the gate itself"

key-files:
  created:
    - tests/test-234-free-core-network-scan.cjs
  modified: []

decisions:
  - "The regex text is copied from tests/run-all-234.sh verbatim (only the mechanical JS slash-escaping differs) and a parity check FAILS the test if the two ever drift"
  - "lib/mcp/tools/*.cjs is glob-discovered; lib/core/navigation.cjs and lib/core/resolve-brain-key.cjs stay explicitly named, and a missing named file fails the leg rather than skipping"
  - "The allow-list is deliberately EMPTY: all 10 swept files are clean with zero exceptions carved out"
  - "234-01's resolve-brain-key.cjs finding is reused as a must-not-catch self-test case, not as an allowance"

metrics:
  tasks_completed: 1
  tasks_total: 3
  duration: ~35 min (Task 1 only)
  completed: null
---

# Phase 234 Plan 08: Phase Close-Out Summary (PARTIAL - Task 1 of 3)

**Status: IN PROGRESS. Task 1 is complete and committed. Task 2 is a blocking human-verify checkpoint that has NOT been attempted, and Task 3 is gated behind it and has NOT been started.**

The free-core / paid-Brain boundary is now proved clean by an automated, self-proving scan across the whole local MCP tool surface, and the full phase-234 gate suite runs green end to end at 11 legs. What remains is the one thing no automated agent in this environment can do: install a real third-party AI coding host on this machine and watch it load the catalog.

## What Shipped (Task 1)

**`tests/test-234-free-core-network-scan.cjs`** - the 234-scoped instance of the Canon Part 8 adversarial grep that 234-VALIDATION.md's D-08/D-09 row asks for.

In plain words: the business model only works if the two halves stay separated. The free core runs entirely on the user's machine and reaches nothing; the Brain is the paid layer and is a READ service that never sees a byte of user content. Those are the same sentence read from two directions. D-08/D-09 is the commercial reading, Canon Part 8 (Graph Boundary) is the constitutional reading, and ONE measurement settles both, which is why this single artifact closes D-08, D-09 and D-11 together. If a network token ever appears on an executable line in these files, both readings break at once: the free tier stops being free-standing AND user data acquires a way out.

**Result: 10 files swept, ZERO network tokens on any executable line.** 8 glob-discovered modules under `lib/mcp/tools/` (chain, gate, graph, room, sensors, status, stop-gate, views) plus `lib/core/navigation.cjs` and `lib/core/resolve-brain-key.cjs`. PASS=17 FAIL=0.

Four design choices worth recording:

1. **Glob, not a fixed list.** `run-all-233.sh` and `run-all-234.sh` both use a fixed `PART8_TARGETS` array, which is right for "the files this plan touched" - a closed, known set. `lib/mcp/tools/` is different in kind: a directory of small per-tool modules that grows every time a tool is added. A fixed list there goes stale silently, and a stale target list looks exactly like a clean codebase. So the tool modules are glob-discovered, and discovering ZERO of them is a hard failure rather than a vacuous pass.

2. **Pattern parity is asserted, not trusted.** The test parses `PART8_RE="..."` out of `tests/run-all-234.sh`, undoes the shell double-quote escaping and the one mechanical JS slash-escape, and requires byte-identical equality. The plan said "reuse the SAME regex text, do not invent a new one"; this makes that mechanically true forever instead of true on the day it was written.

3. **234-01's `resolve-brain-key.cjs` finding is reused as an ASSERTION, not an allowance.** 234-01 anticipated that file would trip the case-sensitive lowercase `brain` token, measured it, and found it does not (its identifiers are `resolveBrainKey` and `MINDRIAN_BRAIN_KEY`, both uppercase-B, and its only lowercase `brain` occurrences sit on comment lines the stripper removes). That resolution is carried forward as two must-not-catch self-test cases rather than an allow-list entry, because an allowance would blind the gate to a real lowercase-`brain` egress shape in that file forever, whereas an assertion keeps the gate sharp AND proves the case-sensitivity reasoning still holds.

4. **The allow-list is deliberately EMPTY**, and a hygiene check requires any future entry to carry a written reason of at least 20 characters. An empty allow-list is a stronger claim than a populated one.

## Verification (Behavioral, Not Inspection)

**Self-test first, then the sweep.** All 9 forbidden token shapes are planted on synthetic executable lines and each is confirmed caught (`fetch(`, `https://`, `require('node:https`, `curl`, `wget`, `axios`, `onrender`, `api.anthropic`, case-sensitive `brain`), plus 4 must-not-catch shapes. A grep gate that quietly stopped matching is indistinguishable from a codebase with nothing to find; both print green. The gate earns the right to be believed before it is believed.

**Four mutation probes, each planted then reverted, each confirmed to bite:**

| Probe | What was planted | Result |
|-------|------------------|--------|
| A | `require('axios')` appended to the real `lib/core/navigation.cjs` | FAILED as intended: "FORBIDDEN network token on an executable line in: lib/core/navigation.cjs" |
| B | `PART8_RE`'s `fetch\(` token replaced with a never-matching literal | FAILED as intended, on BOTH the parity check and the `fetch(` self-test case |
| C | A brand-new `lib/mcp/tools/zz-probe-delete-me.cjs` carrying `fetch('https://...onrender.com/mcp')` | Glob count rose 8 -> 9 and the file was caught. This is the direct proof of the maintenance-free glob claim: a tool module added in a future phase is swept automatically |
| D | `lib/core/resolve-brain-key.cjs` temporarily moved aside | FAILED as intended: "MISSING sweep target", proving a vanished named target fails rather than silently skipping |

All four were reverted; `git status --porcelain` on the touched paths returned zero entries afterward, and the clean re-run returned PASS=17 FAIL=0.

**Full phase suite: `bash tests/run-all-234.sh` -> PASS=11 FAIL=0 SKIP=0.** Every leg green:

| Leg | Result |
|-----|--------|
| test-234-adoption-engine-gate.cjs (D-10) | PASSED |
| test-234-dist-bundle.cjs | PASSED |
| **test-234-free-core-network-scan.cjs (new, D-08/D-09/D-11)** | **PASSED** |
| test-234-host-tier.cjs (W0-06/W0-07) | PASSED |
| test-234-plugin-root-migrated.cjs (W0-09) | PASSED |
| test-234-tool-description-floor.cjs (W0-05) | PASSED |
| no-instructions.test.cjs (W0-03) | PASSED |
| check-skill-spec --check (W0-01) | PASSED - 125 skills conform, the phase's expected-red leg is now green |
| check-skill-spec --catalog-budget (W0-02) | PASSED - 12965 / 51200 bytes (25%) |
| Part 8 self-test | PASSED |
| Part 8 sweep | PASSED |

The new test was picked up by the harness's `tests/test-234-*.cjs` glob with no edit to `run-all-234.sh`, which is the `key_links` contract the plan declared.

## Repo-Wide Gates (Task 1 acceptance criterion 4)

| Gate | Result | Attribution |
|------|--------|-------------|
| `node scripts/build-connector-registry.cjs --check` | `connector-registry: OK`, exit 0 | Clean |
| `node scripts/check-shape-declaration.cjs --check` | exit 0, **55 advisory WARNs** | **PRE-EXISTING, not phase 234.** See below |
| `node scripts/doctor.cjs --acceptance` | exit 1, **14/15 points**, one FAIL: `verify-release-clean-tree` | **CAUSED BY A CONCURRENT UNRELATED SESSION.** See below |

### Pre-existing failure 1: `check-shape-declaration` - 55 advisory WARNs

All 55 are the same violation class: a surface declaring `hitl_shape` (a genuine Decision-Gate fork) AND `connector.excluded:true` (the no-fork exemption) simultaneously, which Canon Part 11 forbids. Distribution: 28 `skills/`, 26 `commands/`, 1 `agents/`.

**Proved pre-existing by measurement, not assumed.** For each of the 55 warned files, the `hitl_shape` / `hitl_why` / `connector` / `excluded` lines were extracted at the pre-phase-234 baseline commit `29aac493` (the parent of `814b991c`, phase 234's first commit) and compared against HEAD: **content drift = 0 of 55.** Phase 234 shifted those lines' NUMBERS (234-03/04 added `license:` and `name:` fields above them) but changed not one byte of their content. This is Phase 210 advisory-mode output, exits 0, and does not block. It is a genuine standing item for a future phase, and it is NOT phase 234's to fix.

### Pre-existing failure 2: `doctor --acceptance` - `verify-release-clean-tree`

Reported as "tracked-file drift: 7 file(s)". The exact 7, all belonging to a concurrent, unrelated statusline / context-monitor session running in this same working tree:

```
 M lib/statusline/ctx-window.cjs
 M package-lock.json
 M scripts/context-monitor
 M scripts/statusline-fallback-echo.cjs
 M tests/test-context-monitor-d02-broadcast.cjs
 M tests/test-fallback-echo-compose.cjs
 M tests/test-statusline-context-aware.cjs
```

Not one is a phase-234 file. This gate measures working-tree cleanliness at release time, so it will read clean once that other session commits or reverts. Recorded here by exact identity so it is never silently conflated with phase-234 work, and equally so it is never quietly ignored.

## Deviations from Plan

**None for Task 1.** The plan was executed as written. The one judgement call the plan explicitly delegated ("only if 234-01's harness work surfaced this distinction as needing an explicit allow - reuse whatever resolution 234-01 already established") was resolved by reading 234-01-SUMMARY.md deviation 5 and reusing its measured finding: no allowance needed, encoded as an assertion instead.

## Known Stubs

None. No placeholder, empty-return, or TODO path was introduced.

## Threat Flags

None. `tests/test-234-free-core-network-scan.cjs` is read-only (it reads files and exits), opens no network socket, spawns no process, and writes nothing.

T-234-16 (Information Disclosure: free core reaching the network under any code path) is **mitigated as planned** by this artifact.

---

# TASK 2: PARTIALLY ATTEMPTED, STILL BLOCKING - one leg closed, one leg not

**This section exists to state plainly what has and has not been observed, so no later reader mistakes partial success for a full pass, or dismisses real evidence gathered since the "not attempted" state above.**

Updated 2026-07-28, navigator-driven live session, foreign host: **Antigravity** (Google's Gemini-based agentic IDE; not one of the plan's three named recommendations — VS Code+Copilot, Cursor, Goose — but genuinely independent of Anthropic/Claude Code, so it satisfies the checkpoint's actual intent: a host that implements the Agent Skills + MCP spec on its own).

## What WAS observed, live, with real evidence

**Skill catalog: CONFIRMED loading, unprompted.** Antigravity was installed and pointed at `dist/zed` (the flat `.agents/skills/` bundle -- Antigravity uses the same `.agents/skills/<name>/SKILL.md` convention as Zed, confirmed against its own docs before testing). Asked plainly "what tools and skills do you have available?", its agent response listed a long, accurate set of real MindrianOS skill names (`ignite`, `brain-connector`, `pws-methodology`, `larry-personality`, `room`, `mos-deck-engine`, dozens more) under a clearly-labeled "MindrianOS & Methodology Suite" heading, with zero parse-error indication. This is real, unfabricated evidence: the response was not primed with the skill names, and it correctly separated them from Antigravity's own native built-in tools (file ops, terminal, web search) in the same answer.

## What was NOT closed, despite real, sustained effort

**MCP connection: NOT confirmed.** The `mindrian-os` server never showed as connected in Antigravity's own MCP Tools settings panel, across multiple genuinely distinct configuration attempts, each one correcting a real, diagnosed defect in the previous attempt rather than blindly retrying:

1. First config (`command: node`, direct Linux path) -- Antigravity resolved it as a **native Windows process**, mangling the path to `C:\home\jsagi\dev\MindrianOS-Plugin\bin\mindrian-mcp-server.cjs` (a nonexistent Windows path) and failing with `MODULE_NOT_FOUND`. Confirms Antigravity has no automatic WSL-path remoting (unlike VS Code's Remote-WSL layer).
2. Second config, bridged through `wsl.exe -d Ubuntu -- bash -lc "..."` -- got further: it genuinely launched inside WSL this time, but resolved a stale system Node (`v20.19.5`) lacking the `node:sqlite` built-in this codebase needs (>=22.5), via `ERR_UNKNOWN_BUILTIN_MODULE`.
3. Third config, using the exact absolute path to the working nvm-managed Node (`v22.23.1`, independently sanity-checked in this same session to start the real server cleanly: `[mindrian-os] MCP server v1.15.3-beta.51 started`) plus explicit `export MINDRIAN_OS_ROOT=...` -- after this fix, the MCP Tools panel returned to showing **zero entries at all**, not even an error entry for `mindrian-os`.
4. A full process kill (every Antigravity process ended via Task Manager, not just window-close) and clean relaunch was performed specifically to rule out stale in-memory config -- the panel was still empty afterward.

**Root cause of step 3/4's regression is unresolved.** The config file was independently verified valid JSON matching Antigravity's own shipped schema (`.../extensions/antigravity/schemas/mcp_config.schema.json`) at every step, written to all three candidate config paths this install exposes (`~/.gemini/antigravity/`, `~/.gemini/antigravity-ide/`, `~/.gemini/config/`) to rule out picking the wrong one. Whether this specific install caches config more aggressively than a process restart clears, silently rejects the `wsl.exe`-as-command shape client-side, or something else entirely was not determined -- debugging an Electron app's internal config-loading behavior via screenshot relay, with no direct access to its logs, hit a real, honest limit.

**D-06 (proprietary-content spot-check) and D-12 (axis-language review) were not reached** -- both depend on Task 2's tool-visibility step succeeding first, per the checkpoint's own ordering.

## What this means for the checkpoint

The acceptance criteria require BOTH the catalog loading AND the MCP server connecting with the three specific tools visible. One is genuinely met; the other is not. **Task 2 is not closed.** The honest path forward, in priority order:

1. **Cursor** (the plan's second-recommended host, never attempted) -- likely simpler than Antigravity specifically, since its MCP config (`.cursor/mcp.json`) is a plain file Cursor reads directly with no Electron-settings-UI layer to fight, and no evidence yet suggests it shares Antigravity's WSL-path or config-caching behavior.
2. Revisit Antigravity with actual log access (its own app logs, not just the chat panel's self-reported errors) if it remains the host of interest.
3. Zed itself was also attempted this session and never produced a visible window at all (a separate WSLg/display issue, unrelated to the MCP question) -- not re-attempted after Antigravity became the focus.

Everything phase 234 proved before this session, across all 8 plans, was proved by **static analysis and automated tests driving JSON-RPC by hand** -- real, substantial evidence, but explicitly not a live foreign-host observation, per 234-RESEARCH.md's own caveat:

> "no foreign host is installed on this machine... every Tier-0 portability claim in this research is derived from specifications and from static analysis of the repo, not from a live run on VS Code, Cursor, Goose, or Zed."

**That caveat is now half-closed, not fully closed.** The skill-catalog half of RESEARCH's Assumption A2 concern is answered (catalogs do load correctly on a real foreign host). The MCP-tool-visibility-and-callability half is not.

The checkpoint's own verification steps (host install, catalog load, MCP connect, `graph_write` / `memory_event` / `artifact_file` visibility AND callability, plus the D-06 proprietary-content review and the D-12 axis-language review) are specified in full in `234-08-PLAN.md` Task 2 and are not restated here.

# TASK 3: NOT STARTED

Task 3 (filing the Dev-Research Compositing entry into `~/MindrianRooms/rethinking-mindrianos/research/`) is gated behind Task 2 (`gate="blocking"`) and was deliberately not started. The `mindrianOS/research/` mirror question that Task 3's acceptance criteria ask about is therefore also unanswered at this point.

## Self-Check

- `tests/test-234-free-core-network-scan.cjs` FOUND on disk.
- Commit hash verified present in `git log` (see the plan-level commit record).
- Task 2 marked NOT ATTEMPTED, Task 3 marked NOT STARTED, both accurately.

## Self-Check: PASSED

## Task 2 checkpoint: GATE 0 OBSERVATION RECORDED (2026-08-11, Cursor on Windows)

Navigator-relayed live evidence from the Windows machine (a Cursor agent session
performed the install; the navigator pasted its report):

- **Host:** Cursor (Windows). Plugin refreshed via `npx @mindrian_os/cli` to
  mos@mindrian-marketplace **v2.0.0-beta.5**.
- **MCP config:** both servers wired in `C:\Users\jsagi\.cursor\mcp.json` -
  `mindrian-os` (full plugin) and `mindrian-brain` (key from `~/.mindrian.env`).
- **Callability evidence (the previously-unobserved half):** a real room
  (`MindrianRooms/lunar-water-site`) was created through the MCP surface from Cursor,
  and the session documented the working /mos:* -> MCP tool mapping (new-project ->
  room_content, diagnose -> methodology, find-bottlenecks/systems-thinking -> analysis,
  whitespace -> whitespace_scan). Cross-surface behavioral note worth keeping: on
  Cursor the MCP tools return Larry's framework INSTRUCTIONS and the host agent
  executes them - vs Claude Code where /mos:* runs directly. Tri-polar data point.
- **Brain leg:** one `tier_0_brain_unreachable` BEFORE the required Cursor restart -
  consistent with config-not-yet-loaded, not a server fault (the deployed Brain was
  simultaneously green from this machine).
- **Remaining to FULLY close the checkpoint:** post-restart green/ready confirmation
  for both servers, the 5-step chain run filing artifacts into the room, and explicit
  graph_write/memory_event/artifact_file visibility+callability confirmation.
  Status moves: catalog half CLOSED (prior session), callability half OBSERVED-PARTIAL
  (room creation proves the write path executed once; systematic check pending).
