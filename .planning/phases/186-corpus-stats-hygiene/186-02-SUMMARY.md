---
phase: 186-corpus-stats-hygiene
plan: 02
subsystem: docs
tags: [corpus-stats, tripwire, generated-artifact, canon-d4, historical-provenance, pre-commit-gate, release-gate, part-8]

# Dependency graph
requires:
  - phase: 186-corpus-stats-hygiene (Plan 01)
    provides: "scripts/build-corpus-stats.cjs generator + the reserved --check stub + data/corpus-stats-source.json (the three D1 magnitudes) + the generated artifact this --check byte-compares against"
provides:
  - "scripts/build-corpus-stats.cjs --check: artifact STALE byte-compare + a context-anchored LIVE-surface stale-literal scan with a documented historical-provenance exclude list (excludedRegion + the 12,401 substrate suppression)"
  - "Repointed LIVE fact surfaces (CLAUDE.md, .claude/includes/moat.md, docs/THE-BRAIN.md, docs/brain-setup.md, .planning/PROJECT.md, the live CANON-PHASE-MAP Engine-1 row) on 27,904 / 177 / 12,485 (1024-dim)"
  - "The --check tripwire wired into scripts/install-pre-commit.sh (splice + fresh paths) and scripts/release.sh Step 2.4 (HARD ABORT)"
  - "tests/run-all-186.sh - the one-command phase gate (artifact + both-direction tripwire + live --check)"
affects: [corpus-stats-drift-prevention, future-corpus-figures-correction, canon-part-8-boundary]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Context-anchored stale-literal tripwire: a number fires ONLY in MAGNITUDE form (number-then-noun) so a per-label breakdown (Framework (748)), a dated ratio (23/748), an edge/line count, or a directional sub-count cannot false-fire"
    - "Documented historical-provenance exclude list: excludedRegion() freezes everything at/after ## Appendix D (canon) and the ### Appendix D / ## Version history region (phase map); the .planning dated artifacts / autopsies / testers / generated artifact / named design docs are excluded BY OMISSION and enumerated in a self-documenting comment block"
    - "Literal-with-two-roles suppression: 12,401 is both the MethodologyChunk substrate constant (Canon D2 directional, legitimately kept) AND a stale Pinecone-vector form; it fires only as a vector form on lines with no substrate / semantic-index framing"

key-files:
  created:
    - tests/test-corpus-stats-artifact.cjs
    - tests/test-corpus-stats-tripwire.cjs
    - tests/run-all-186.sh
    - .planning/phases/186-corpus-stats-hygiene/deferred-items.md
  modified:
    - scripts/build-corpus-stats.cjs
    - scripts/install-pre-commit.sh
    - scripts/release.sh
    - CLAUDE.md
    - .claude/includes/moat.md
    - docs/THE-BRAIN.md
    - docs/brain-setup.md
    - .planning/PROJECT.md
    - docs/CANON-PHASE-MAP.md

key-decisions:
  - "12,401 is kept (not repointed, suppressed from firing) wherever it carries MethodologyChunk substrate / semantic-index framing (CLAUDE.md, THE-BRAIN.md, brain-setup.md, canon Part 2 lines 40/48) - it is the directional substrate count (Canon D2), not the 12,485 vector total"
  - "Canon Part 2 lines 40/48 (the Engine-1 12,401 methodology-node semantic index) are LEFT as-is and suppressed, not repointed and not given a new Appendix D entry - they describe the substrate, and the entry-31 self-binding clause forbids landing an Appendix D entry 32"
  - "Appendix D entries 13/16 and the version-history rows are byte-unchanged - historical provenance is frozen (D4)"
  - "Relationship companion counts on the oldest-set surfaces (moat.md 19,713; PROJECT.md 65K) were aligned to the live 19,987 to avoid shipping a self-contradictory pair next to a freshened node count (Rule 1 consistency)"

patterns-established:
  - "Pattern 1: a corpus literal stops drifting because a commit AND a release now fail on a stale number on a live surface, while dated history stays frozen via an explicit, unit-tested exclude list"
  - "Pattern 2: the tripwire is Brain-free by construction (node:fs + node:path only); a commit/release never hangs on or egresses to the Brain (Canon Part 8 / D5)"

requirements-completed: [CORPUS-02]

# Metrics
duration: 19min
completed: 2026-06-27
---

# Phase 186 Plan 02: Corpus Stats Hygiene Tripwire + LIVE Repoint Summary

**A context-anchored --check tripwire (artifact STALE byte-compare + a LIVE-surface stale-literal scan with a documented historical-provenance exclude list) wired into pre-commit and release, plus the LIVE fact surfaces repointed to 27,904 nodes / 177 frameworks / 12,485 Pinecone vectors while Canon Appendix D entries 13/16 stay byte-frozen.**

## Performance

- **Duration:** ~19 min
- **Started:** 2026-06-27T06:07:52Z
- **Completed:** 2026-06-27T06:27:43Z
- **Tasks:** 3
- **Files modified:** 9 modified, 4 created

## Accomplishments
- Filled the reserved `--check` branch of `scripts/build-corpus-stats.cjs`: it regenerates the artifact in memory and fails on a byte drift (STALE), then runs `scanLiveSurfaces()` - a pure, exported, context-anchored scanner that fires on stale magnitude literals on the seven LIVE surfaces and skips the documented historical regions via `excludedRegion()`. Exports `scanLiveSurfaces / excludedRegion / LIVE_SURFACES / STALE_PATTERNS`.
- The crux (D4) holds: the scan EXCLUDES everything at/after `## Appendix D` in the canon and the `### Appendix D` / `## Version history` region in the phase map; the 12,401 MethodologyChunk substrate is suppressed (Canon D2); the per-label `Framework (748)` breakdown and the `23/748` pre-cleanup ratio never fire (number-then-noun anchoring).
- Repointed the LIVE fact surfaces to 27,904 / 177 / 12,485 (1024-dim) with live-read date 2026-06-27; `node scripts/build-corpus-stats.cjs --check` exits 0.
- Wired the tripwire into `scripts/install-pre-commit.sh` (BOTH the splice path and the fresh HOOK_BODY path, path-scoped on the live surfaces + the source + the generated artifact) and `scripts/release.sh` Step 2.4 (HARD ABORT), mirroring the `build-connector-registry.cjs` guard without disturbing the existing gates or the release lockstep.
- Shipped `tests/run-all-186.sh` (3/3 green): the artifact behaviors, the both-direction tripwire (fires LIVE, silent in frozen history and on substrate), and the live `--check`.

## Task Commits

Each task was committed atomically:

1. **Task 1: --check tripwire + LIVE-surface repoint** - `a6e4e70a` (feat)
2. **Task 2: wire the tripwire into pre-commit + release** - `a2795cca` (feat)
3. **Task 3: the phase test (artifact + tripwire both directions + live --check)** - `13eb3972` (test)

_Note: Task 3 carries tdd="true"; see TDD Gate Compliance below for why the RED/GREEN ceremony collapses to a single test commit._

## Files Created/Modified
- `scripts/build-corpus-stats.cjs` - filled the --check branch; added LIVE_SURFACES, STALE_PATTERNS (context-anchored), excludedRegion, scanLiveSurfaces, and the top-of-file EXCLUDE contract comment block
- `scripts/install-pre-commit.sh` - corpus-stats guard in the splice + fresh paths (path-scoped, Canon Part 8)
- `scripts/release.sh` - Step 2.4 HARD ABORT corpus-stats gate alongside the three sibling --checks
- `CLAUDE.md` / `.claude/includes/moat.md` / `docs/THE-BRAIN.md` / `docs/brain-setup.md` / `.planning/PROJECT.md` / `docs/CANON-PHASE-MAP.md` - repointed LIVE magnitudes
- `tests/test-corpus-stats-artifact.cjs` / `tests/test-corpus-stats-tripwire.cjs` / `tests/run-all-186.sh` - the phase gate
- `.planning/phases/186-corpus-stats-hygiene/deferred-items.md` - DI-186-01 (pre-existing install-hook idempotency duplication)

## Decisions Made
- **12,401 is the MethodologyChunk substrate constant, not a stale vector everywhere.** On every CLAUDE.md / THE-BRAIN.md / brain-setup.md occurrence and on canon Part 2 lines 40/48 it is framed as substrate / methodology-node semantic index (Canon D2 directional). It is suppressed from firing and KEPT. It IS repointed only where it was a bare curriculum-embeddings total (`.claude/includes/moat.md` "12,401 embeddings" -> "12,485 Pinecone vectors").
- **Canon Part 2 lines 40/48 left as-is.** They describe the Engine-1 methodology-node semantic index (12,401), which is genuinely the substrate, not the 12,485 Pinecone total; repointing would corrupt a directional fact. A new dated Appendix D entry was deliberately NOT added (the entry-31 self-binding clause forbids an entry 32, and D3 says a figures-correction is not entry-32-class but should not force one either). Documented here instead.
- **THE-BRAIN.md curated-subset phrasing.** Line 72 read "a curated subset (~275) of the live graph's 748 :Framework nodes"; repointing 748 -> 177 made "(~275)" larger than the total, so the now-contradictory parenthetical count was dropped ("a curated subset of the live graph's 177 :Framework nodes").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Self-contradictory relationship companion counts on the oldest-set surfaces**
- **Found during:** Task 1 (repoint)
- **Issue:** `.claude/includes/moat.md` paired "15,298 nodes, 19,713 relationships" and `.planning/PROJECT.md` paired "21K nodes, 65K relationships". Repointing only the node magnitude would ship a fresh node count next to a stale, contradictory relationship count on a user-facing moat surface.
- **Fix:** Aligned the directional relationship companion to the live 19,987 on both surfaces (the figure already used on every other live surface). The tripwire never enforces relationship counts (D2); this is a correctness/consistency fix, not a new asserted magnitude.
- **Files modified:** .claude/includes/moat.md, .planning/PROJECT.md
- **Verification:** node scripts/build-corpus-stats.cjs --check exits 0; the moat block now reads "27,904 nodes, 19,987 relationships".
- **Committed in:** `a6e4e70a` (Task 1 commit)

**2. [Rule 1 - Bug] Em-dashes on edited PROJECT.md lines**
- **Found during:** Task 1 (repoint)
- **Issue:** The three PROJECT.md lines I had to edit for the repoint carried em-dashes (CLAUDE.md Part 8 forbids em-dashes).
- **Fix:** Converted the em-dashes on the edited lines to " -- ". (Pre-existing em-dashes elsewhere in PROJECT.md/CLAUDE.md are out of scope and left untouched.)
- **Files modified:** .planning/PROJECT.md
- **Verification:** grep confirms none of my edited magnitude lines carry an em-dash.
- **Committed in:** `a6e4e70a` (Task 1 commit)

**3. [Rule 1 - Consistency] THE-BRAIN.md curated-subset count dropped (see Decisions)**
- **Found during:** Task 1 (repoint)
- **Issue:** Repointing 748 -> 177 on THE-BRAIN.md line 72 made the "(~275)" subset larger than the 177 total.
- **Fix:** Removed the now-contradictory "(~275)" parenthetical; the sentence reads "a curated subset of the live graph's 177 :Framework nodes".
- **Files modified:** docs/THE-BRAIN.md
- **Committed in:** `a6e4e70a` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (3 Rule 1 - correctness/consistency/style on the LIVE surfaces I was already editing)
**Impact on plan:** All three are corrections to the LIVE-surface repoint that ships in this plan; no scope creep. The tripwire, the exclude list, and the wiring land exactly as specified.

## TDD Gate Compliance
Task 3 carries `tdd="true"`. The implementation it tests (`scanLiveSurfaces`, `excludedRegion`, `renderMarkdown`, `loadSource`) shipped in Task 1 of THIS plan (Plan 01 reserved the `--check` as a stub; Task 1 here filled it). The literal RED phase therefore corresponds to the pre-Task-1 state where these pure functions did not exist and `--check` was a no-op stub. The Task 3 commit (`test(...)`) locks in the shipped behavior with both-direction assertions and a clean `scanLiveSurfaces()` end-to-end check. No separate RED commit was produced because the behavior was already correct when the test was authored; this is recorded honestly rather than manufacturing a throwaway failure.

## Deferred Issues
- **DI-186-01** (`.planning/phases/186-corpus-stats-hygiene/deferred-items.md`): the shared `install-pre-commit.sh` idempotency mechanism re-splices every guard on re-run (its contiguous-string grep never matches the quoted installed node-invocation). PRE-EXISTING, affects all sibling guards equally, harmless (the guards are idempotent local byte-compares), out of scope for CORPUS-02. The corpus-stats guard was wired to mirror the siblings exactly, so it inherits this behavior by design.

## Issues Encountered
- The 12,401 dual-role (substrate constant vs stale vector total) is the crux of the phase; resolved via per-line substrate/semantic-index suppression so substrate mentions are kept and only bare curriculum-embeddings totals fire.

## User Setup Required
None - the tripwire is local and Brain-free.

## Next Phase Readiness
- CORPUS-02 satisfied: the --check tripwire with the documented historical-provenance exclude list is wired into pre-commit + release; the LIVE surfaces carry 27,904 / 177 / 12,485; historical provenance is frozen; no directional sub-count is enforced; no em-dashes on edited lines.
- The phase (186) is complete: Plan 01 shipped the generator + artifact (CORPUS-01); Plan 02 shipped the tripwire + repoint + wiring + tests (CORPUS-02).

## Self-Check: PASSED

All four created files (the two test suites, run-all-186.sh, deferred-items.md) plus the SUMMARY exist on disk; the extended scripts/build-corpus-stats.cjs is present; all three task commits (`a6e4e70a`, `a2795cca`, `13eb3972`) are in git history.

---
*Phase: 186-corpus-stats-hygiene*
*Completed: 2026-06-27*
