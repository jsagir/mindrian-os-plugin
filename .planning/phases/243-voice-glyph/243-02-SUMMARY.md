---
phase: 243-voice-glyph
plan: 02
subsystem: statusline / Voice Signature (Canon Part 12) / RCA documentation
tags: [rca, doc-presence, phantom-citation, glyph-fabrication]

requires:
  - phase: 243-voice-glyph plan 01
    provides: "the V-1 fix (fabrication deleted) whose commit hashes and mutation-probe evidence this RCA cites as resolved-history"
provides:
  - "the RCA the repo has cited since 2026-06-28, now a real file at .planning/debug/voice-signature-dark-runtime.md"
  - "tests/test-243-rca-routing.cjs, a structural doc-presence gate for that RCA"
affects: []

tech-stack:
  added: []
  patterns:
    - "doc-presence test: assert structure (frontmatter, headings, cross-references), never prose wording"
    - "RCA Source-of-Truth Preamble + APPEND-only Evidence section"

key-files:
  created:
    - tests/test-243-rca-routing.cjs
    - .planning/debug/voice-signature-dark-runtime.md
  modified: []

key-decisions:
  - "F1 fork resolved: SC2's 'no new RCA file created' read as 'no SECOND RCA beside the one the repo already names', per the audit's own rethink verdict."
  - "status: investigating, not resolved -- V-2, V-3, the who-default finding, and the F5 residual all stay OPEN; the file does not move to .planning/debug/resolved/."
  - "The who: 'larry' default is filed for a navigator ruling (Part 10 vs Part 12), not fixed by this plan."

patterns-established:
  - "doc-presence gate idiom applied to an RCA file specifically (structure-only assertions so the document can keep accumulating Evidence/Eliminated entries without breaking the test)."

requirements-completed: [GLYPH-01]

duration: ~25min
completed: 2026-07-28
---

# Phase 243 Plan 02: Voice-Signature RCA Routing Summary

**Authored the phantom `.planning/debug/voice-signature-dark-runtime.md` RCA that six documents have cited since 2026-06-28 but that never existed, routing V-2/V-3 into it as open cross-referenced findings alongside V-1 (resolved-history), the `who:'larry'` default (filed for a navigator ruling), and the F5 permanent-dark residual.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2
- **Files modified:** 2 (both new)

## Accomplishments

- Landed `tests/test-243-rca-routing.cjs`, a structural doc-presence gate (existence, frontmatter keys, 8 required headings, V-1/V-2/V-3/GLYPH-01/REQUIREMENTS.md cross-references, no-em-dash), RED by design until the RCA existed, glob-discovered by `tests/run-all-243.sh` with zero harness edit.
- Authored `.planning/debug/voice-signature-dark-runtime.md`, resolving six dangling citations across `REQUIREMENTS.md`, `ROADMAP.md`, `182.1-CONTEXT.md`, `182.1-SUMMARY.md`, `v1.15.0-ROADMAP.md`, and `docs/CANON-PHASE-MAP.md` that have pointed at a non-existent file since Phase 182.1 (2026-06-28).
- The RCA carries V-1 as resolved-history (Phase 243 plan 01, commits `8cde7f0b`/`46eea09d`/`889b8cec`), V-2 and V-3 as open cross-referenced sub-findings sited by symbol, the `who:'larry'` default as a fourth open finding filed for a navigator ruling, and the F5 permanent-dark residual under its own named heading.

## Task Commits

Each task was committed atomically:

1. **Task 1: Land the RCA doc-presence gate (RED until the RCA exists)** - `879db83f` (test)
2. **Task 2: Author the RCA the repo has been citing since 2026-06-28** - `f3dd0392` (docs)

_No plan-metadata commit was made for STATE.md/ROADMAP.md/REQUIREMENTS.md -- per this plan's explicit critical scope boundary, phase-level rollup writes to those three files are the orchestrator's job, not this execution's. This SUMMARY.md itself is committed separately per the orchestrator's own close-out pass._

## Files Created/Modified

- `tests/test-243-rca-routing.cjs` - structural doc-presence gate for SC2 (21 assertions: existence, 6 frontmatter checks, 8 heading checks, 5 cross-reference checks, 1 no-em-dash check)
- `.planning/debug/voice-signature-dark-runtime.md` - the RCA, `kind: rca`, `status: investigating`, following `docs/RCA-TEMPLATE.md`'s exact section order including the mandatory Source-of-Truth Preamble

## Decisions Made

**The F1 fork, resolved in writing.** GLYPH-01's Success Criterion 2 says "no new RCA file created." Read literally, that criterion is unsatisfiable against a target that provably never existed (three independent verification commands -- `git log --all --oneline`, `find . -name "voice-signature*"`, and an `ls` of both `.planning/debug/` and `.planning/debug/resolved/` -- all returned nothing, re-run live at this plan's own authoring time as well as at research time). The reading this plan adopts, stated explicitly in the RCA's own "Citation repair" section so nobody has to guess later: SC2's "no new RCA file created" means "no SECOND RCA beside the one the repo already names." Creating the file six documents already cite is not spawning a competitor to an existing artifact; it is giving those six existing citations their referent. This is exactly what the audit's own rethink verdict said when it filed V-2 and V-3: "Findings 2 and 3 belong as additions to the still-open file." Anyone auditing SC2's literal text against this outcome would otherwise see an apparent contradiction -- the reasoning above is why there is none.

**Four items remain OPEN in the RCA.** V-2 (no writer exists for `~/.mindrian/voice-mark.json`, blocked on the session-keying design decision, not on effort), V-3 (the pure transition detector has zero production callers and the F.7 recalibration dial is unwired; the false-provenance comment at `cockpit-signals.cjs:216` was recorded but deliberately left unedited, since fixing it is V-4 territory), the `who:'larry'` default (a separate defect from the glyph fabrication, filed for a navigator ruling rather than fixed), and the F5 permanent-dark residual (the Tier-1 glyph is honestly dark in production, on every turn, on every install, permanently, until a session-keyed writer lands). Because these four stay open, the RCA's frontmatter is `status: investigating`, never `resolved`, and this plan does NOT move the file to `.planning/debug/resolved/` and does NOT add a `.planning/debug/knowledge-base.md` block. That move only happens once all four items clear.

**The one ask this RCA files for a human.** Which reading governs the statusline's `who` signal: Canon Part 10 ("the conversational surface IS Larry") or Canon Part 12 ("a turn with no Larry mark IS the native host speaking")? Both are canon text, both are quoted verbatim in the RCA's who-default finding along with `agents/larry-extended.md` and `lib/core/voice-transition-detector.cjs`'s own `deriveWho` implementation (which sides with Part 12), and the codebase currently runs the reading that contradicts Part 12's constitutional text. Flipping the default with no writer present would make every statusline on every install permanently render the host marker and permanently suppress the Brain chip -- a severe, universally-visible UX regression on a phase justified as smallest blast radius. Reconciling Part 10 and Part 12 is a navigator call, not an executor call, and it is now queued in exactly one findable place rather than scattered across three inline comments that each independently assert the Part 10 reading.

## Deviations from Plan

None - the plan's exact task sequence, RCA content sourcing (RESEARCH.md Findings F1/F2/F4/F5/F7 plus 243-01-SUMMARY.md only), and acceptance criteria were followed as written. One honest limitation, not a deviation from this plan's own declared scope, recorded below.

## Issues Encountered

**Dev-Research Compositing obligation: attempted, could not complete from this session.** Per CLAUDE.md's mandatory Dev-Research Compositing rule, the F1 phantom-RCA finding (a forward-referenced artifact path written into four downstream documents and never authored) is a durable process lesson that belongs in `~/MindrianRooms/rethinking-mindrianos/research/<dated-entry>/`, cross-linked back to this phase, in addition to living in the phase's own artifacts. This session confirmed READ access to that path (`ls ~/MindrianRooms/rethinking-mindrianos/research/` succeeded, and the existing `2026-07-28-hedge-fold-no-production-trigger` entry was read as a structural template) and drafted the full entry content, but the Write tool refused the write with an explicit worktree-isolation error: "This agent is isolated in the worktree ... Edit the worktree copy of this file instead of the shared-checkout path." This is a hard tool-level sandboxing boundary for this execution, not a permissions gap this session can work around -- the plan's own instructions anticipated this ("you do not need to actually write to that external room path yourself unless you have access; if you cannot reach it, say so plainly in the SUMMARY rather than claiming it was done"). Stated plainly, per that instruction: **the mirror to `rethinking-mindrianos/research/` was NOT performed by this session.** A `mkdir` made via Bash for the target directory (before the Write call failed) was removed afterward so no stray empty directory was left behind. The next session with write access outside this worktree (or the orchestrator, running unconstrained) should complete this mirroring; the drafted content covered the same lesson as this SUMMARY's "Decisions Made" section (forward-referenced citation as an undischarged commitment, inline-execution-mode's lack of a mechanism to hold that commitment open, and the "citation is unverified until dereferenced" carry-forward).

## Next Phase Readiness

- GLYPH-01 is now fully satisfied: SC1 (V-1's fix, plan 01) and SC2 (V-2/V-3 routed into a real RCA, this plan) are both done.
- `tests/run-all-243.sh` -> `PASS=2 FAIL=2`. The 2 passes are this phase's own tests (`test-243-voice-glyph-honest.cjs` 18/18, `test-243-rca-routing.cjs` 21/21). The 2 failures are the mandatory `run-all-192.sh` and `run-all-210.sh` regression legs run as whole scripts, and their failures are pre-existing and unrelated to Phase 243, confirmed identical in identity and count to what `243-01-SUMMARY.md` already documented (`192-01` help.md/mos.md two-axis wording; `210-D` fusion-router cross-frame edge assertion; `210-E3` stamp-firing-block sweep on 3 unrelated command files). Within both red aggregators, the specific sub-tests carrying this phase's own inverted contract (`test-voice-glyph-advisory.cjs` inside `run-all-210.sh`, `test-192-statusline-stance-chip.cjs` inside `run-all-192.sh`) both print PASSED.
- `node scripts/build-connector-registry.cjs --check` -> `connector-registry: OK`, exit 0 (this phase adds no invocable surface).
- `ls .planning/debug/*voice-signature* .planning/debug/resolved/*voice-signature* 2>/dev/null | wc -l` -> `1` (exactly one voice-signature RCA repo-wide, confirmed).
- Blockers for a future phase, both filed in the RCA, neither this plan's job to resolve: (1) the session-keying design decision that unblocks V-2's writer, (2) the navigator ruling on Part 10 vs Part 12 that unblocks the `who` default.
- The Dev-Research Compositing mirror to `~/MindrianRooms/rethinking-mindrianos/research/` remains undone (see Issues Encountered above) -- a follow-up task for whichever session has write access outside this worktree.

## Self-Check

- `tests/test-243-rca-routing.cjs`: FOUND (created, committed `879db83f`)
- `.planning/debug/voice-signature-dark-runtime.md`: FOUND (created, committed `f3dd0392`)
- Commit `879db83f`: FOUND in `git log`
- Commit `f3dd0392`: FOUND in `git log`

## Self-Check: PASSED

---
*Phase: 243-voice-glyph*
*Completed: 2026-07-28*
