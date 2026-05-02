---
phase: 104-per-command-jtbd-declarations
plan: "01"
subsystem: hmi-jtbd-declarations
tags: [jtbd, frontmatter-sweep, closed-vocab, canon-part-3, canon-part-7, canon-part-8]
canon_parts:
  - "Part 3 Tri-Context Decision Gate"
  - "Part 7 Reuse Before Build"
  - "Part 8 Graph Boundary"
requires:
  - "Phase 100-01 jtbd-taxonomy.json (13 canonical ids)"
  - "Phase 101-04 selector-dispatcher.cjs (already shipped; reads JTBD via pickShape)"
provides:
  - "serves_jtbd: declarations on every commands/*.md (84 total; 81 new + 3 preserved)"
  - "JTBD-to-command mapping matrix at .planning/phases/104-per-command-jtbd-declarations/104-01-mapping-matrix.md"
affects:
  - "F.6 vs F.1 dispatch decision per command (now data-driven from frontmatter)"
tech_stack_added: []
tech_stack_patterns:
  - "YAML frontmatter as the canonical declaration surface for command-level JTBD intent"
  - "Closed-vocabulary enforcement via reference to lib/hmi/jtbd-taxonomy.json"
key_files_created:
  - .planning/phases/104-per-command-jtbd-declarations/104-01-mapping-matrix.md
  - .planning/phases/104-per-command-jtbd-declarations/104-01-SUMMARY.md
key_files_modified:
  - "commands/*.md (81 files; one new line each)"
decisions:
  - "Insertion placement: after body_shape_detail (if present) -> after body_shape (if present) -> after argument-hint (if present) -> after description: (fallback). Mirrors the existing pattern in jtbd.md / memory.md / hmi-status.md."
  - "JSON-array form on a single line (serves_jtbd: [...]) for parseability and to mirror the 3 already-declaring files."
  - "value-proposition.md uses the file path mapping (serves_jtbd: [\"validate-idea\", \"prepare-pitch\"]) even though its frontmatter name field reads validate-proposition; the mapping is by file path per the matrix."
metrics:
  start: 2026-05-02T19:21:02Z
  end: 2026-05-02T19:29:47Z
  duration_minutes: 9
  task_count: 2
  file_count: 82  # 81 commands + 1 mapping matrix
completed: 2026-05-02
---

# Phase 104 Plan 01: Per-Command JTBD Declaration Sweep Summary

Wired Phase 100's JTBD signal into every /mos: command's frontmatter so the Phase 101-04 selector-dispatcher can route F.6 vs F.1 from data instead of hardcoded heuristics.

## What shipped

- **D-01 (sweep)**: 81 commands gained a `serves_jtbd:` declaration in YAML frontmatter, mapping each command to one or more of the 13 canonical JTBDs from `lib/hmi/jtbd-taxonomy.json`.
- **D-02 (matrix)**: Authoritative mapping artifact at `.planning/phases/104-per-command-jtbd-declarations/104-01-mapping-matrix.md` with 81 per-command rows, coverage summary table, and per-row rationale.
- **3 preserved**: `commands/jtbd.md`, `commands/memory.md`, `commands/hmi-status.md` left byte-identical (already declared in Phase 100-04 / 103-03 / 105-02).

## How it lands in the runtime

The selector-dispatcher (Phase 101-04, already shipped) calls `pickShape({ requestedShape: 'F', roomDir, payload })`. Before this plan, `pickShape` had to fall back to F.1 because no command declared its JTBD. After this plan, every command emits `serves_jtbd: [...]` in its frontmatter, the dispatcher reads it, and routes:

- **F.6 (JTBD-aware Next Move)** when at least one declared JTBD aligns with the room's active JTBD signal (LOCAL state).
- **F.1 (default Next Move)** when none align (graceful fallthrough).

Zero dispatcher logic was modified. The dispatcher's existing read path was already correct; it was simply reading nothing.

## Coverage (per-JTBD command counts after sweep)

| JTBD id              | Commands serving (verified post-sweep) |
|----------------------|----------------------------------------|
| decide-pursue        | 3 |
| find-problem         | 7 |
| understand-market    | 9 |
| find-bottleneck      | 9 |
| prepare-pitch        | 14 |
| validate-idea        | 7 |
| compare-options      | 7 |
| connect-domains      | 4 |
| surface-contradiction | 2 |
| plan-execution       | 5 |
| file-meeting         | 3 |
| audit-room           | 22 |
| explore              | 22 |

All 13 JTBD ids appear in at least one command (coverage invariant satisfied).

Note: counts differ from the matrix's pre-sweep predictions because (a) the 3 already-declaring files (jtbd, memory, hmi-status all serving "audit-room") add to the audit-room count, and (b) some commands declare multiple JTBDs, so the sum exceeds 81.

## Per-batch commit ledger

| Batch | Files | Range                         | Commit  |
|-------|-------|-------------------------------|---------|
| 0     | 1     | mapping-matrix.md (D-02)      | 5788b05 |
| 1     | 11    | act..challenge-assumptions    | 8626c6d |
| 2     | 13    | compare-ventures..file-meeting | 9cf088a |
| 3     | 11    | find-analogies..lean-canvas   | 3dc6b36 |
| 4     | 9     | macro-trends..opportunities   | eab9f12 |
| 5     | 8     | organize..reanalyze           | 69910ea |
| 6     | 8     | research..rs-thesis           | a1c2158 |
| 7     | 8     | scenario-plan..splash         | 760521b |
| 8     | 13    | status..wiki                  | 20ccb92 |
| **Total** | **81 commands + 1 matrix** |                       |         |

## Acceptance criteria (all green)

- [x] Every commands/*.md has a `serves_jtbd:` line (`grep -L "^serves_jtbd:" commands/*.md` returns nothing).
- [x] The 3 already-declaring files are byte-identical (`git diff HEAD~9 HEAD -- commands/jtbd.md commands/memory.md commands/hmi-status.md` returns empty).
- [x] 81 files modified by this plan (`git diff --name-only HEAD~8 HEAD -- commands/*.md | wc -l` returns 81).
- [x] Closed vocabulary: every value across all serves_jtbd lines resolves to one of the 13 ids (verified via grep + sort -u, exactly 13 distinct ids appear; zero invented).
- [x] All 13 JTBDs covered (each appears in at least one commands/*.md).
- [x] No body content modified (every batch commit shows exactly N files changed, N insertions, 0 deletions; one new line per file).
- [x] No new emdashes (`git diff HEAD~9 HEAD -- commands/ | grep "^+serves_jtbd" | grep "—" | wc -l` returns 0).
- [x] YAML frontmatter still parses (`grep -L "^---$" commands/*.md` returns nothing).
- [x] Mapping matrix exists with 81 rows and full rationale column.

## Deviations from Plan

### None for the sweep itself

The mechanical sweep executed exactly as specified. Each of the 81 files received exactly one new line; values came verbatim from the matrix; the 3 preserved files were not touched.

### Workspace deviation (Rule 3 - Blocking)

- **Found during:** Task 1 (matrix file write).
- **Issue:** `.planning/` is gitignored at the repo root (`.gitignore:48`), but the plan demanded the mapping matrix be filed under `.planning/phases/104-per-command-jtbd-declarations/`.
- **Fix:** Used `git add -f` to force-add the matrix artifact (and this SUMMARY) past the ignore rule. This is consistent with how the parent repo's existing `.planning/phases/` files are tracked - they are all force-added.
- **Files modified:** none (only the add policy changed).
- **Commit:** 5788b05.

### File `commands/value-proposition.md` (Rule 2 - clarity note, not a fix)

The file `commands/value-proposition.md` carries `name: validate-proposition` in its frontmatter (likely a stale declaration). The matrix mapped by **file path** (`commands/value-proposition.md -> ["validate-idea", "prepare-pitch"]`), not by the `name:` field. I left the `name:` field untouched since this plan's contract is "frontmatter only, body untouched" but I am explicitly NOT modifying any other line. Surfacing the discrepancy here in case Plan 104-02's verification harness wants to flag name/path skew across commands.

### Observation: 3 commands without `# /mos:` H1 anchor

The plan's verification step suggests every commands/*.md keeps its `# /mos:` H1. Three files do NOT have a `# /mos:` H1, but never did:

- `commands/persona.md` -> `# Persona -- AI Perspective Lenses`
- `commands/export.md` -> no H1 immediately (body opens with prose)
- `commands/scheduled-tasks.md` -> `# Cowork Scheduled Tasks`

I verified via `git show HEAD~9:commands/export.md` that this is pre-existing structure, not a regression. My edits were strictly frontmatter-only and the bodies are unchanged. Surfacing here so the verifier in Plan 104-02 knows to relax the H1 check for these 3 files (or treat the matter separately).

## Tracking and follow-on

- Plan 104-02 will ship the verification harness (`tests/test-command-jtbd-coverage.cjs` + `tests/test-command-jtbd-declarations.cjs`) that exercises the closed-vocab + coverage invariants this sweep just satisfied.
- Plan 104-03 will verify the dispatcher fall-through behavior (commands without serves_jtbd: still route to F.1; declared commands route to F.6 when JTBD aligns).
- No selector-dispatcher edits in this plan (Phase 88.2-04 owns those).
- No new commands shipped (Canon Part 7 honored).
- Declarations are LOCAL frontmatter; never queried against Brain (Canon Part 8 honored).

## Self-Check: PASSED

Verified inline:

- `commands/*.md` count: 84 (file system) - confirmed.
- `serves_jtbd:` declarations: 84/84 present, 0 missing - confirmed.
- 3 preserved files byte-identical: `git diff HEAD~9 HEAD -- commands/jtbd.md commands/memory.md commands/hmi-status.md` empty - confirmed.
- 81 commands modified: `git diff --name-only HEAD~8 HEAD -- commands/*.md | wc -l` returned 81 - confirmed.
- All 13 JTBD ids appear, no invented ids: 13 distinct ids returned by `grep -h "^serves_jtbd:" commands/*.md | grep -oE '"[a-z-]+"' | tr -d '"' | sort -u` - confirmed.
- Mapping matrix file exists: `.planning/phases/104-per-command-jtbd-declarations/104-01-mapping-matrix.md` (125 lines) - confirmed.
- Matrix has exactly 81 per-command rows: `grep -c "^| commands/"` returned 81 - confirmed.
- Zero new emdashes: `git diff HEAD~9 HEAD -- commands/ | grep "^+serves_jtbd" | grep "—" | wc -l` returned 0 - confirmed.
- All commit hashes resolve in `git log --oneline HEAD~9..HEAD` - confirmed (9 commits: 5788b05, 8626c6d, 9cf088a, 3dc6b36, eab9f12, 69910ea, a1c2158, 760521b, 20ccb92).
