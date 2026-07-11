---
phase: 217-doctor-cjs-architecture-rethink-audit-all-14-check-classes-i
plan: 07
subsystem: infra
tags: [doctor, docs, doc-parity, regression-test, test-aggregator, d-04, close-out, human-verify]

# Dependency graph
requires:
  - phase: 217-01
    provides: cadence-gated accumulative engine (always vs once), lib/core/doctor/shared.cjs, spread-into-report.checks
  - phase: 217-02
    provides: D-03 hard-blocking contract-parity test (tests/test-doctor-module-contract-parity.cjs) + D-05 card-fire-health module
  - phase: 217-03
    provides: F/K/L/N migrated (ui-compliance, stale-first-touch-copy, deprecated-usage, plugin-enabled-state)
  - phase: 217-04
    provides: B/C/E migrated incl. the NEWLY WIRED class B --fix
  - phase: 217-05
    provides: G/H/D migrated (statusline-visibility, install-incomplete, verify-surface); class A left the sole hand-coded render path
  - phase: 217-06
    provides: I/J migrated (final registry wave, 14 entries) + the three sanctioned carve-outs (class A, brain-smoke M, eureka-smoke S) written as auditable justification comments
provides:
  - Fully reconciled commands/doctor.md (D-04 audit complete against post-migration code): argument-hint, class inventory A-N + P/Q/R/S + card-fire-health, bare-run behavior, --all set, TRUE --fix set (A,B,E,G,H,I,J), exit codes 0-4 + the classFlagsActive-forces-0 invariant + the two narrow exit-1 escalations, the module registry + cadence contract, the three carve-outs, Extension architecture
  - tests/test-doctor-doc-parity.cjs -- a permanent D-04 regression guard (doc-vs-code flag parity + --fix class parity), hard-blocking, registered in run-feynman-tests.cjs
  - tests/run-all-217.sh -- the 17-leg phase aggregator (the single PASS/FAIL/SKIP gate for Phase 217)
  - Navigator-approved real-room verdict (checkpoint:human-verify, gate="blocking") -- the watermark does not silence any migrated diagnostic across two consecutive --all runs (the Pitfall-1 kill shot, confirmed live on the real machine)
  - Phase 217 CLOSED -- all 7 plans complete, D-01 through D-05 delivered
affects: [217-close, doctor-check-migration, future-doctor-module-additions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "a doc-vs-code parity test derives its 'truth' set programmatically from the same registry/parser the doc describes (data/doctor-modules.json fix_supported + scripts/doctor.cjs parseArgs case chain), never from a second hand-maintained list, so the test cannot itself drift from the code it audits"
    - "a hard-blocking regression test carries its own negative self-test (an invented flag, a tampered --fix letter set) as the FIRST assertions in the file, proving the gate bites before it is ever trusted to guard real drift (mirrors the 217-02 D-03 contract-test precedent)"
    - "a phase aggregator's excluded legs are named and reasoned in the header comment (known pre-existing failures logged to deferred-items.md; opt-in network-capable carve-outs) so an exclusion reads as a deliberate design choice, never a silent gap"

key-files:
  created:
    - tests/test-doctor-doc-parity.cjs
    - tests/run-all-217.sh
  modified:
    - commands/doctor.md
    - lib/memory/run-feynman-tests.cjs
    - .planning/phases/217-doctor-cjs-architecture-rethink-audit-all-14-check-classes-i/deferred-items.md
    - .planning/ROADMAP.md
    - .planning/STATE.md

key-decisions:
  - "The --fix class-letter truth for both commands/doctor.md and its parity test is DERIVED (class A carve-out unioned with every data/doctor-modules.json entry whose fix_supported is true, mapped through a fixed id-to-class-letter table), never a hand-typed literal list -- so the moment a future module flips fix_supported, both the doc claim and the test's expectation must be updated together or the test fails."
  - "--recursive is the one doc-only prose token allowlisted in the parity test (with a written reason: it is generate-section-intelligence.cjs's own flag, invoked BY the class-E --fix path, not a doctor.cjs parseArgs flag) rather than silently ignored or force-added to parseArgs."
  - "tests/run-all-217.sh deliberately excludes class-p/class-q (pre-existing failures confirmed unrelated by 260711-nrd) and the two async smokes (brain-smoke M, eureka-smoke S -- opt-in, network-capable) with the reasons written in the script header, following the 216/211 aggregator precedent of naming every exclusion."
  - "The stray pre-existing .planning/phases/217/ directory (containing only DRIFT.md, predates this plan) collides with the real phase directory in gsd-tools's findPhaseInternal token match, breaking roadmap.update-plan-progress. Routed around by editing .planning/ROADMAP.md directly for this close-out rather than fixing the collision -- out of scope for a doc-audit plan (deferred-items.md logs it for a future quick task)."
  - "The navigator's non-blocking observation (brain-smoke's skip row renders '⊘ undefined' under --all) was explicitly left as-is per the navigator's own instruction -- not gap-closed, not hot-patched past the approved checkpoint."

patterns-established:
  - "Phase 217 is fully closed: every doctor check (except the three sanctioned carve-outs) is registry-driven, D-03 hard-blocks declaration completeness, D-04 hard-blocks doc-vs-code drift, and one aggregator command (tests/run-all-217.sh) proves the whole phase in ~2 seconds, offline, zero network."

requirements-completed: [D-03, D-04]

# Metrics
duration: ~35min
completed: 2026-07-11
---

# Phase 217 Plan 07: D-04 Doc Audit + Doc-Parity Test + Phase Aggregator + Real-Room Gate Summary

**commands/doctor.md fully reconciled line-by-line against the post-migration registry code (D-04); a hard-blocking doc-parity test derives its truth set from data/doctor-modules.json + parseArgs so the doc can never silently rot again; a 17-leg tests/run-all-217.sh aggregator is the single PASS/FAIL/SKIP gate; the navigator's real-room checkpoint approved the migration verbatim, confirming the watermark never silences a diagnostic across two consecutive `--all` runs -- Phase 217 is CLOSED.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-07-11
- **Tasks:** 3 (2 auto + 1 checkpoint:human-verify, gate="blocking")
- **Files:** 6 (2 created, 4 modified across the working code + planning docs)

## Accomplishments

- **The full D-04 audit landed.** Every INCOMPLETE/STALE/WRONG/MISSING verdict row in 217-RESEARCH.md's line-by-line audit table now has a corrected line in `commands/doctor.md`: the complete 31-flag argument-hint, the true class inventory (A-N + P/Q/R/S + card-fire-health) naming the registry as source of truth, the accurate bare-run and `--all` sets, the TRUE `--fix` set (A, B, E, G, H, I, J -- class B newly real per Plan 04), the full exit-code table (0-4) plus the classFlagsActive-forces-0 invariant and the two narrow exit-1 escalations, every previously-undocumented surface (classes H/I/J/N/P/Q/R/S, the release-gate and lifecycle flags), the three Phase 217 carve-outs, and a new Extension architecture section describing the two-file "no engine edit" contract for future checks. Frontmatter keys (`name`, `hitl_shape`, `allowed-tools`, `connector`, etc.) verified untouched via `git diff` -- body + argument-hint only.
- **A doc-parity test that cannot itself drift.** `tests/test-doctor-doc-parity.cjs` extracts both sides of the parity check programmatically: the parsed-flag set comes from a regex over the actual `parseArgs` case-chain lines in `scripts/doctor.cjs`, and the `--fix` class-letter truth is derived from `data/doctor-modules.json`'s `fix_supported` booleans (unioned with the class-A carve-out), not from any hand-typed list. A single documented allowlist entry (`--recursive`, with a written reason) is the only permitted asymmetry. A negative self-test (an invented flag, a tampered `--fix` letter set) runs first and proves the gate bites before the real assertions run.
- **The phase aggregator.** `tests/run-all-217.sh` (built on the run-all-216.sh scaffold) chains all 17 legs the phase needs to prove itself green: the D-03 contract-parity gate, the module selector, the fix-renderer, card-fire-health, doc-parity, the ten migrated class regression tests (B, C, E, F, G, G-fix, H, H-fix, I, J), plugin-disabled-state, and UI self-compliance. Class-P/Q (known pre-existing, unrelated failures per 260711-nrd) and the two async smokes (network-capable, opt-in) are deliberately excluded with the reasons written in the header comment.
- **The real-room human gate, approved.** The navigator ran the checkpoint on the real machine: `node scripts/doctor.cjs --all` twice produced byte-identical rows both times (the Pitfall-1 watermark kill shot, confirmed live -- a migrated diagnostic never goes silent after the watermark advances), the bare run showed only class A + class N + the accumulative engine, and `bash tests/run-all-217.sh` printed `PASS=17 FAIL=0 SKIP=0`. The four drift rows (135 ui-compliance violations, 6 deprecated commands, 15 rooms missing `.room-root`, cascade-rooms-active silenced writes with active=jonathan-sagir) all matched the navigator's own known machine state. The navigator flagged one non-blocking observation (`brain-smoke`'s skip row rendering `⊘ undefined` under `--all`) and explicitly declined to gap-close it -- left as-is.
- **Phase 217 is CLOSED.** All 7 plans complete. D-01 (registry migration of all 13+ checks) through D-05 (card-fire-health module) are all delivered; D-03 (hard-blocking contract test) and D-04 (doc audit + parity guard) are this plan's own requirement IDs, both satisfied.

## Task Commits

1. **Task 1: Rewrite commands/doctor.md against the post-migration code (the full D-04 audit)** - `328b1e80` (docs)
2. **Task 2: Create the doc-parity regression test + the phase aggregator** - `81d597f3` (test)
3. **Task 3: Real-room smoke** - `checkpoint:human-verify`, gate="blocking" -- APPROVED verbatim by the navigator (no code commit; the checkpoint itself is the gate)

**Plan metadata:** this commit (docs: complete 217-07 plan)

## Files Created/Modified

- `commands/doctor.md` - Full D-04 rewrite: complete argument-hint, class inventory A-N + P/Q/R/S + card-fire-health, bare-run + `--all` sets, TRUE `--fix` set (A,B,E,G,H,I,J), exit codes 0-4 + invariants, the three carve-outs, Extension architecture section. Frontmatter untouched.
- `tests/test-doctor-doc-parity.cjs` - NEW. Hard-blocking D-04 regression guard: cross-parses parseArgs flags vs documented flags (both directions, one written allowlist entry) + `--fix` class letters vs the registry-derived truth. Negative self-test proves the gate bites. Registered in `lib/memory/run-feynman-tests.cjs`.
- `tests/run-all-217.sh` - NEW. 17-leg phase aggregator on the run-all-216.sh scaffold; excludes class-p/class-q + the async smokes with written reasons; `chmod +x`.
- `lib/memory/run-feynman-tests.cjs` - Registered `tests/test-doctor-doc-parity.cjs` alongside the existing D-03/D-05 Phase 217 Wave-0 gates.
- `.planning/phases/217-doctor-cjs-architecture-rethink-audit-all-14-check-classes-i/deferred-items.md` - Logged the stray `.planning/phases/217/` directory collision (pre-existing, out of scope).
- `.planning/ROADMAP.md` - Phase 217 header marked COMPLETE (7/7 plans); 217-07 checkbox checked with a full completion summary; Plans line updated.
- `.planning/STATE.md` - Prepended the Phase 217 close-out narrative entry; Current Position marked COMPLETE (7/7); two decisions recorded; session recorded; metric recorded.

## Decisions Made

See `key-decisions` in frontmatter: the derived (never hand-typed) `--fix` truth set, the one written `--recursive` allowlist entry, the named aggregator exclusions, routing around the pre-existing `.planning/phases/217/` collision rather than fixing it (out of scope), and leaving the navigator-flagged `brain-smoke` skip-row cosmetic as-is per explicit instruction.

## Deviations from Plan

### Auto-fixed Issues

None that altered the plan's deliverables. One out-of-scope discovery was logged, not fixed:

**1. [Scope boundary -- logged, not fixed] Stray `.planning/phases/217/` directory collides with the real phase directory in gsd-tools tooling**
- **Found during:** Task 3 close-out (running `roadmap.update-plan-progress 217` for the final metadata commit).
- **Issue:** A pre-existing directory literally named `.planning/phases/217/` (containing only `DRIFT.md`, predating this plan) sorts before `.planning/phases/217-doctor-cjs-architecture-rethink-audit-all-14-check-classes-i/` in `gsd-tools`'s `findPhaseInternal` token match, so `roadmap update-plan-progress 217` read the empty stray directory (`plans: []`, `summaries: []`) instead of the real one and reported "No plans found."
- **Fix:** Routed around by editing `.planning/ROADMAP.md` directly (the Phase 217 header + the 217-07 checkbox + the Plans line) rather than relying on the broken tool call. Logged to `deferred-items.md` for a future quick task (either rename/remove the stray dir after verifying nothing else depends on it, or teach `phaseTokenMatches` to prefer a directory prefixed with `<num>-` over a bare numeric directory).
- **Files modified:** `.planning/ROADMAP.md` (manual edit), `.planning/phases/217-doctor-cjs-architecture-rethink-audit-all-14-check-classes-i/deferred-items.md` (log entry).
- **Not committed as a code fix:** this is a tooling observation, not a doctor.cjs / doctor.md change; out of scope for this plan's D-04 deliverable.

---

**Total deviations:** 0 auto-fixed; 1 out-of-scope discovery logged to deferred-items.md.
**Impact on plan:** None on the deliverable. The doc audit, doc-parity test, and aggregator all landed exactly as specified; the tooling collision only affected how the CLOSING metadata commit was assembled, and was routed around, not worked into the code changes.

## Issues Encountered

None beyond the tooling collision documented above. The three automated tasks (Task 1 doc rewrite, Task 2 test + aggregator, Task 3 evidence-gathering for the checkpoint) all completed cleanly on the first attempt; every verification command in the plan passed without iteration.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 217 is fully closed. Every doctor check (except the three sanctioned, written carve-outs: class A install-cache, brain-smoke M, eureka-smoke S) runs through the ONE registry-driven path (`data/doctor-modules.json` + `lib/core/doctor/<id>-module.cjs` runners), with structural print + fix wiring, a cadence gate that keeps per-invocation diagnostics watermark-immune, a hard-blocking D-03 contract test, a truthful `commands/doctor.md` guarded by a hard-blocking D-04 doc-parity test, and the new D-05 card-fire-health module.
- A future check addition is genuinely two files (one `data/doctor-modules.json` entry + one runner) and no `scripts/doctor.cjs` edit -- the Extension architecture section in `commands/doctor.md` documents the contract for whoever adds the next one.
- One cosmetic, explicitly-deferred item remains by navigator instruction: `brain-smoke`'s skip row renders `⊘ undefined` under `--all`. Not gap-closed; if it is ever addressed, it belongs to a future `/gsd-plan-phase 217 --gaps` pass, not a hot patch.
- The stray `.planning/phases/217/` directory (DRIFT.md only) remains on disk, logged in `deferred-items.md` for a future quick task; it does not affect any doctor.cjs behavior, only `gsd-tools`'s own phase-lookup tooling.

## Self-Check: PASSED

- FOUND: `commands/doctor.md`, `tests/test-doctor-doc-parity.cjs`, `tests/run-all-217.sh`
- FOUND commits: `328b1e80` (Task 1), `81d597f3` (Task 2)
- FOUND: `bash tests/run-all-217.sh` -> `PASS=17 FAIL=0 SKIP=0`
- FOUND: `node tests/test-doctor-doc-parity.cjs` -> `ALL PASS (3 assertions)`
- FOUND: `grep -c test-doctor-doc-parity lib/memory/run-feynman-tests.cjs` -> `1`

---
*Phase: 217-doctor-cjs-architecture-rethink-audit-all-14-check-classes-i*
*Completed: 2026-07-11*
