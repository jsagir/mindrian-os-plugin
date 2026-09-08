---
phase: 298-seed-032-harness-as-code-declare-and-machine-enforce-the-min
plan: 02
subsystem: testing
tags: [fixture, room-scaffold, cjs, node-builtin, harness, no-egress]

requires:
  - phase: 298-01
    provides: "tests/run-all-298.sh aggregator + five anti-vacuous-pass stubs, including test-298-runner-idempotent.cjs which will read this fixture"
provides:
  - "data/harness-fixtures/converged-room/: 33 committed text files across 17 directories plus root, scaffold-born via scaffoldRoomSkeleton, STATE.md regenerated once via scripts/compute-state"
  - "the committed convergence baseline the runner (298-11) proves idempotence against: total_entries 13, venture_stage Investment, no current_room line, zero em-dash/en-dash/ANSI bytes"
affects: [298-05, 298-09, 298-11]

tech-stack:
  added: []
  patterns:
    - "build-once-by-hand, read-forever fixture: scaffoldRoomSkeleton + compute-state run exactly once outside the runner's write path, then scrubbed and committed; the runner never regenerates it"
    - "MINDRIAN_ROOMS_HOME pointed at a throwaway mktemp -d before compute-state, so the conditional current_room: line (compute-state:260) never bakes machine identity into a committed file"
    - "scripted node -e read/replace/write scrub with printed before/after counts, never a hand edit, for the two known visual-ops.cjs:529 defects (U+2014 em-dash, raw ANSI escapes)"

key-files:
  created:
    - data/harness-fixtures/converged-room/STATE.md
    - data/harness-fixtures/converged-room/MINTO.md
    - data/harness-fixtures/converged-room/USER.md
    - data/harness-fixtures/converged-room/{problem-definition,market-analysis,solution-design,business-model,competitive-analysis,team-execution,legal-ip,financial-model,opportunity-bank,funding,strategy}/{ROOM.md,CONTEXT.md}
    - data/harness-fixtures/converged-room/references/{ROOM.md,SECTION-SCHEMA.md,SUB-SCHEMAS.md}
    - data/harness-fixtures/converged-room/{team,assets,.intelligence,.snapshots,.context}/ROOM.md
  modified: []

key-decisions:
  - "Used the plan's exact recipe (scaffoldRoomSkeleton then compute-state with a scratch MINDRIAN_ROOMS_HOME) rather than hand-authoring 33 files; observed output matched every acceptance number in the plan (33 files, 18 dirs, total_entries 13, venture_stage Investment) with zero deviation"
  - "Scrub is scripted (node -e), not hand-edited, per Pitfall 3 option (a); before/after counts printed and captured below so the scrub is independently reproducible and auditable"
  - "NO_COLOR=1/MINDRIAN_NO_COLOR=1 were set on the compute-state invocation per the task action, but had no observable effect on the ANSI byte count -- scripts/compute-state:225 hard-codes useColor: true when calling renderRoomDiagram, so the two ANSI sequences (4 bytes) appeared regardless. This is why the plan requires a scripted scrub rather than relying on env-var suppression; documented as a non-blocking observation, not a deviation, since the plan's own acceptance criteria already assume the scrub step catches this."

requirements-completed: [R-04]

duration: 12min
completed: 2026-09-08
---

# Phase 298 Plan 02: Committed Converged-Room Fixture Summary

**Built the one-time, hand-scrubbed `data/harness-fixtures/converged-room/` fixture (33 text files, D-03) the harness runner will later prove idempotence against.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-08T04:02:00Z (approx)
- **Completed:** 2026-09-08T04:14:00Z (approx)
- **Tasks:** 2/2 completed
- **Files modified:** 33 created

## Accomplishments

- Ran `scaffoldRoomSkeleton('data/harness-fixtures/converged-room', {placeholder_slug: 'converged-room'})` in-process; returned object matched the plan's expected shape exactly: `ok: true`, `sections_created` length 11, `identity_files_created` length 6, `state_written/minto_written/user_written: true`, `contracts_created` length 11, `reference_docs_created` length 2, `errors: []`.
- Regenerated `STATE.md` exactly once via `bash scripts/compute-state` with `MINDRIAN_ROOMS_HOME` pointed at a throwaway `mktemp -d` directory (removed immediately after the run), so the conditional `current_room:` line never landed. Observed `computed: 2026-09-08T04:07:00Z` (ISO timestamp, expected to differ on any future regeneration), `total_entries: 13`, `venture_stage: Investment` -- matching research Corrections 1-3 exactly.
- Confirmed no `.mindrian/`, no `room.db`, no `decision-traces/` were created by either the scaffold or compute-state.
- Scrubbed `STATE.md` in place via a `node -e` read/replace/write: 2 U+2014 em-dashes to hyphens (the `EMPTY - GAP` markers for the two zero-entry sections, `assets/` and `team/`), 4 raw ANSI escape bytes stripped (2 sequences: the `c.red`/`c.reset` pair wrapping each marker). Before/after counts printed and captured in this summary.
- Swept all 33 files with `grep -rlP '\x{2014}|\x{2013}'` and `grep -rlP '\x1b'`: zero hits anywhere in the tree after the STATE.md scrub.
- Confirmed all 33 paths pass `git check-ignore -q` (none ignored) before staging.
- Committed with `git add data/harness-fixtures/converged-room` (single explicit path, nothing else) and the required trailer. `git status --porcelain` empty afterward.
- `bash tests/run-all-298.sh` still exits 0, `PASS=6 FAIL=0 SKIP=1` -- unchanged from the Wave 0 baseline, since none of the five stub SUBJECTs (which live outside this plan's scope) exist yet.

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold the fixture and regenerate STATE.md under a scratch rooms home** - no commit (plan explicitly defers commit to Task 2; the plan text: "Do not commit in this task. Task 2 scrubs and commits.")
2. **Task 2: Scrub em-dashes and ANSI escapes, add the fixture note, commit** - `28f1dfc1` (feat)

**Plan metadata:** pending (this commit, made after this SUMMARY lands)

## Observed Values (verbatim)

**Scaffold return object:**
```json
{
  "ok": true,
  "sections_created": ["problem-definition","market-analysis","solution-design","business-model","competitive-analysis","team-execution","legal-ip","financial-model","opportunity-bank","funding","strategy"],
  "identity_files_created": ["team","references","assets",".intelligence",".snapshots",".context"],
  "state_written": true,
  "minto_written": true,
  "user_written": true,
  "thinness_acknowledged": true,
  "blueprint_family": null,
  "errors": [],
  "warnings": [],
  "contracts_created": ["problem-definition","market-analysis","solution-design","business-model","competitive-analysis","team-execution","legal-ip","financial-model","opportunity-bank","funding","strategy"],
  "reference_docs_created": ["SECTION-SCHEMA.md","SUB-SCHEMAS.md"]
}
```

**compute-state invocation:**
```bash
SCRATCH=$(mktemp -d)
MINDRIAN_ROOMS_HOME="$SCRATCH" NO_COLOR=1 MINDRIAN_NO_COLOR=1 \
  bash scripts/compute-state data/harness-fixtures/converged-room > data/harness-fixtures/converged-room/STATE.md
rm -rf "$SCRATCH"
```
Frontmatter observed: `computed: 2026-09-08T04:07:00Z`, `venture_stage: Investment`, `total_entries: 13`, zero `current_room:` lines.

**Scrub before/after counts:**
```json
{"emdashBefore": 2, "endashBefore": 0, "ansiBefore": 4, "emdashAfter": 0, "endashAfter": 0, "ansiAfter": 0}
```

**The 33-path file listing (committed, `git ls-files data/harness-fixtures/converged-room` returns 33):**
```
.context/ROOM.md
.intelligence/ROOM.md
.snapshots/ROOM.md
MINTO.md
STATE.md
USER.md
assets/ROOM.md
business-model/CONTEXT.md
business-model/ROOM.md
competitive-analysis/CONTEXT.md
competitive-analysis/ROOM.md
financial-model/CONTEXT.md
financial-model/ROOM.md
funding/CONTEXT.md
funding/ROOM.md
legal-ip/CONTEXT.md
legal-ip/ROOM.md
market-analysis/CONTEXT.md
market-analysis/ROOM.md
opportunity-bank/CONTEXT.md
opportunity-bank/ROOM.md
problem-definition/CONTEXT.md
problem-definition/ROOM.md
references/ROOM.md
references/SECTION-SCHEMA.md
references/SUB-SCHEMAS.md
solution-design/CONTEXT.md
solution-design/ROOM.md
strategy/CONTEXT.md
strategy/ROOM.md
team-execution/CONTEXT.md
team-execution/ROOM.md
team/ROOM.md
```

## Files Created/Modified

- `data/harness-fixtures/converged-room/STATE.md` - regenerated + scrubbed Layer 0 identity file the runner scans for convergence
- `data/harness-fixtures/converged-room/MINTO.md`, `USER.md` - scaffold identity files
- 11 section dirs (`ROOM.md` + `CONTEXT.md` each) - ICM Layer 0/2 per-section identity + contract
- `data/harness-fixtures/converged-room/references/{ROOM.md,SECTION-SCHEMA.md,SUB-SCHEMAS.md}` - ICM Layer 3 factory reference material
- `data/harness-fixtures/converged-room/{team,assets,.intelligence,.snapshots,.context}/ROOM.md` - non-ICM identity directories per Canon decision 15

## Decisions Made

- Followed the plan's exact build recipe with no substitution; every observed number (file count, dir count, total_entries, venture_stage) matched the plan's pre-declared expectations, so no judgment calls were required on the scaffold/compute-state side.
- Chose Pitfall 3 option (a) (scripted scrub in place) exactly as the plan mandated; did not touch `lib/core/visual-ops.cjs:529` (option (c), out of this phase's declared scope).

## Deviations from Plan

None - plan executed exactly as written. The NO_COLOR env vars not suppressing the ANSI bytes (noted above under key-decisions) is a documented observation about the tool's existing behavior, not a deviation from the plan's own instructions -- the plan already anticipated this by requiring a verification grep for `\x1b` and a mandatory scrub step regardless of env-var outcome.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None introduced by this plan. (The five pre-existing `tests/test-298-*.cjs` stubs from 298-01 remain unaffected; this plan's SUBJECT deliverable is a static fixture, not one of their tracked SUBJECTs.)

## Threat Flags

None. This plan's threat register (T-298-02, T-298-04, T-298-01, T-298-SC) was fully addressed by construction: the fixture is scaffold-born template text only (T-298-02); no `.mindrian/`/`room.db` exists so the read-only door cannot create anything (T-298-04); the em-dash/ANSI scrub was a scripted, printed-count node replace, re-verified by a whole-tree grep (T-298-01); zero package installs occurred (T-298-SC).

## Next Phase Readiness

- The committed fixture is ready for plan 298-11 (the runner) to prove idempotence against via `git status --porcelain` alone.
- `data/harness-policies/gate-graph-derive-health.json` (authored in 298-09) should cite this fixture's build recipe in its `notes` field per the plan's own instruction, rather than duplicating a `FIXTURE-NOTE.md` (deliberately not created; this SUMMARY is the durable record).
- No blockers.

---
*Phase: 298-seed-032-harness-as-code-declare-and-machine-enforce-the-min*
*Completed: 2026-09-08*

## Self-Check: PASSED

- FOUND: data/harness-fixtures/converged-room/STATE.md
- FOUND: data/harness-fixtures/converged-room/MINTO.md
- FOUND: data/harness-fixtures/converged-room/USER.md
- FOUND: data/harness-fixtures/converged-room/references/ROOM.md
- FOUND: .planning/phases/298-seed-032-harness-as-code-declare-and-machine-enforce-the-min/298-02-SUMMARY.md
- FOUND commit `28f1dfc1` (feat(298-02): add the committed converged-room fixture (D-03))
