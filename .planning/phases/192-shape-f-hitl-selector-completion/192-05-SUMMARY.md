---
phase: 192-shape-f-hitl-selector-completion
plan: 05
subsystem: phase-gate-aggregator + adversarial-verdict
tags: [SFC-01, SFC-02, SFC-03, SFC-04, SFC-05, SFC-06, SFC-07, SFC-08, SFC-09, phase-gate, verdict, drift-fence, part8]
requires:
  - tests/test-192-menu-sweep-live-selectors.cjs (192-01)
  - tests/test-acpt-06-dial-atomic-emission.cjs + test-f7max-preview-confidence-bar.cjs + test-f7max-modifier-pane.cjs + test-dial-render-states.cjs (192-02)
  - tests/test-stance-state.cjs + test-stance-toggle-f0-gate.cjs + test-stance-voice-glyph-override.cjs (192-03)
  - tests/test-192-statusline-stance-chip.cjs (192-04)
  - tests/test-posture-ids-drift.cjs + test-reach-ids-drift.cjs (CARRIED fences)
  - scripts/build-connector-registry.cjs + scripts/check-render-coverage.cjs (repo gates)
provides:
  - tests/run-all-192.sh (the single PASS/FAIL/SKIP phase gate for shape-f-hitl-selector-completion)
  - .planning/phases/192-shape-f-hitl-selector-completion/192-VERDICT.md (the adversarial structured verdict)
affects:
  - the phase-completion decision (downstream doctor --acceptance / release.sh read this gate)
tech-stack:
  added: []
  patterns: [run-if-skip-on-absence, deferred-and-reported-plurai-leg, adversarial-verdict-with-command-and-literal-result, pre-phase-ref-baseline-diff]
key-files:
  created:
    - tests/run-all-192.sh
    - .planning/phases/192-shape-f-hitl-selector-completion/192-VERDICT.md
  modified:
    - .planning/phases/192-shape-f-hitl-selector-completion/deferred-items.md
decisions:
  - "The live Plurai posture-framing judge is a DEFERRED-and-REPORTED leg (never a silent SKIP): 192-baseline.json carries deferred:true and the hand-labeled verdict_map holds the line, mirroring the 203 precedent"
  - "The stance/posture collision check reports the RAW grep (2, both in doc-comments) AND the code-scoped grep (0) rather than hiding the nuance -- an adversarial verdict names what it found"
  - "The pre-existing em-dash in evals/plurai/README.md:1 is logged as a KNOWN DEBT, not fixed here, because that file is outside 192-05's exclusive ownership (R6) and is not a Phase-192 regression"
metrics:
  duration_min: 9
  tasks: 2
  files_touched: 3
  completed: 2026-07-02
---

# Phase 192 Plan 05: Phase-Gate Aggregator + Adversarial Verdict Summary

Closes phase 192 (shape-f-hitl-selector-completion) with one command and one written verdict: `tests/run-all-192.sh` composes every suite the four Wave-1/Wave-2 plans shipped plus the carried drift fences plus the two born-wired / render-coverage gates and exits 0 (PASS=13 FAIL=0 SKIP=0), and `192-VERDICT.md` records a per-leg PASS/FAIL table, four named-invariant checks each with its command and literal result, and the Part-8 Brain-egress sweep.

## What shipped

**Task 1 - tests/run-all-192.sh (the phase gate aggregator).**
Mirrors the `run-all-188.sh` / `run-all-200.sh` house pattern exactly: `set -uo pipefail`, `ROOT` resolution, `PASS`/`FAIL`/`SKIP` counters, `run()` + `run_if()` helpers, and a final tally with a non-zero exit on any FAIL. Composes, in order: (1) 192-01 menu-sweep, (2) 192-02 ACPT-06 + preview/bar + modifier pane + dial-render-states, (3) 192-03 stance-state + toggle-F0-gate + voice-glyph, (4) 192-04 statusline stance-chip, (5) the CARRIED `test-posture-ids-drift.cjs` (exactly 3) + `test-reach-ids-drift.cjs` (exactly 6) fences, (6) the born-wired (`build-connector-registry.cjs --check`) and render-coverage (`check-render-coverage.cjs`) gates as unconditional `run()` legs. Every suite leg is `run_if`-guarded on file existence (SKIP on absence, never FAIL). The live Plurai posture-framing judge is a deferred-and-reported leg (mirrors 203). Green end to end.

**Task 2 - 192-VERDICT.md (the adversarial closing verdict).**
Records the 13-leg PASS/FAIL/SKIP table, the D-01..D-06-style invariant checklist, and a closing PASS disposition. The four adversarial checks (against pre-phase ref `61606a56`):
- (a) **stance/posture collision:** raw `grep -c "push_forward\|pull_back" lib/core/stance-state.cjs` = 2 (both explanatory doc-comments); code-scoped (comment-stripped) grep = 0; the frozen `STANCES` set is `[research, tell-act, ask, redteam]`; the stance-state suite itself asserts zero push_forward/pull_back/bare-hold tokens. PASS.
- (b) **F.0 closed-vocab unwidened:** `git diff --quiet 61606a56 HEAD -- lib/hmi/shape-f0-renderer.cjs` = UNCHANGED (byte-identical). PASS.
- (c) **frozen Part-3 scalars:** `0.70`/`0.15`/`MAX_K`/`DIAL_REACH_K` literal counts in `dial-presenter.cjs` and `dial-reach-orchestrator.cjs` match the pre-phase baseline exactly. PASS.
- (d) **em-dash sweep:** phase introduced 0 (`git diff 61606a56 e4b67e36 | grep '^+' | grep -c em-dash` = 0); the single hit is a pre-existing README-title em-dash, logged as debt. PASS.

Plus the Part-8 Brain-egress sweep across all four phase-192 lib files (`stance-state.cjs`, `dial-presenter.cjs`, `cockpit-renderer.cjs`, `cockpit-signals.cjs`): CLEAN, zero network / Brain tokens; `stance-state.cjs` requires only `fs`/`path`/`os` (pure LOCAL side-channel).

## Verification

- `bash tests/run-all-192.sh; echo EXIT:$?` -> `Phase 192: PASS=13 FAIL=0 SKIP=0`, `EXIT:0`.
- `192-VERDICT.md` exists, records an explicit PASS disposition, and the aggregator it reports on exits 0.
- All four adversarial invariant checks pass; Part-8 sweep clean.
- Born-wired gate: `connector-registry: OK` (commands/stance.md WIRED). Render-coverage: 16 covered, 0 gap.

## must_haves satisfied

- **Truth 1 (one aggregator composes every suite + carried fences, exits 0 end to end):** YES. 13/13 legs PASS, exit 0.
- **Truth 2 (born-wired + render-coverage gates stay green with the new stance.md surface):** YES. connector-registry OK; 16 covered, 0 gap.
- **Truth 3 (structured verdict records per-suite PASS/FAIL, em-dash sweep, Part-8 sweep):** YES. All three present in 192-VERDICT.md.
- **Artifact run-all-192.sh (contains "run-all-192"):** YES.
- **Artifact 192-VERDICT.md (contains "VERDICT"):** YES.
- **key_link posture-ids-drift fence:** YES (leg 10, exactly 3).
- **key_link build-connector-registry --check (stance.md WIRED-or-EXCLUDED):** YES (leg 12).

## Deviations from Plan

None affecting logic. Two process notes:
1. **`.planning/` is gitignored** in this repo (per CLAUDE.md), so the new `192-VERDICT.md` required `git add -f` per the documented convention; `deferred-items.md` was already tracked.
2. **Pre-existing em-dash surfaced, not fixed (out of R6 ownership).** The em-dash sweep found one match in `evals/plurai/README.md:1` (the file title), present at the pre-phase ref and therefore NOT a Phase-192 regression. Per the scope boundary (192-05 owns only `run-all-192.sh` + the verdict) and the out-of-scope rule, it was logged to `deferred-items.md` and documented as a known debt in the verdict rather than edited.

## Known Stubs

None. Both artifacts are live: the aggregator runs real suites and real gates; the verdict cites real command output.

## Self-Check: PASSED

- Files exist: `tests/run-all-192.sh`, `192-VERDICT.md`, `192-05-SUMMARY.md` all FOUND.
- Commits exist: `c22a2b62` (aggregator), `3e7e270b` (deferred-items), `53926096` (verdict) all FOUND.
- Em-dash clean: 0 in all three plan-owned artifacts.
