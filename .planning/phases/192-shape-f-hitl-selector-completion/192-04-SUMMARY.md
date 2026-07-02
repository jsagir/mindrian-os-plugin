---
phase: 192-shape-f-hitl-selector-completion
plan: 04
subsystem: statusline-cockpit + plurai-evals
tags: [SEED-042, posture-dial, statusline, voice-signature, plurai-gate, part8, part12]
requires:
  - lib/core/stance-state.cjs (192-03 readStance / forcedVoiceColorForStance)
  - lib/hmi/voice-color-mark.cjs (glyphForColor, the 5 De Stijl squares)
  - lib/statusline/cockpit-signals.cjs + cockpit-renderer.cjs (Phase 187 cockpit)
provides:
  - lib/statusline/cockpit-signals.cjs::readStanceState (folds stance into the signal set)
  - lib/statusline/cockpit-renderer.cjs [stance] chip + forced voice-color override
  - evals/plurai/09-posture-framing-fidelity.csv (posture-framing fidelity GATE)
  - evals/plurai/192-baseline.json (hand-labeled degrade baseline)
affects:
  - the CLI statusline render pass (additive, byte-stable by default)
  - the phase-level Plurai eval gate (192 does not close without it)
tech-stack:
  added: []
  patterns: [side-channel-read-then-fold, try-catch-degrade, additive-optional-segment, plurai-hand-label-degrade]
key-files:
  created:
    - tests/test-192-statusline-stance-chip.cjs
    - evals/plurai/09-posture-framing-fidelity.csv
    - evals/plurai/192-baseline.json
  modified:
    - lib/statusline/cockpit-signals.cjs
    - lib/statusline/cockpit-renderer.cjs
    - evals/plurai/README.md
decisions:
  - "The pole IS the voice glyph: forced red/blue overrides natural voice-mark detection in the SAME render pass, not a second signal"
  - "The [stance] chip is its own new optional segment (brainOn/risk/bar idiom), never a 4th chip on the WHO sub-segment (R3)"
  - "Plurai degrades to hand-labeled + deferred per the 196/201/204 precedent -- the interactive MCP flow cannot run in the sequential executor"
metrics:
  duration_min: 7
  tasks: 2
  files_touched: 6
  completed: 2026-07-02
---

# Phase 192 Plan 04: Statusline [stance] Chip + Plurai Posture-Framing Gate Summary

Wires SEED-042's posture dial onto the Phase 187 statusline cockpit (a passive, live-derived `[stance]` chip plus the locked red/blue voice-glyph override) and ships the Plurai eval GATE the phase does not close without: a 32-row synthetic posture-framing-fidelity CSV plus a hand-labeled baseline.

## What shipped

**Task 1 (TDD) - statusline stance chip + forced voice-color.**
- `cockpit-signals.cjs`: new `readStanceState()` requires `../core/stance-state.cjs` defensively (mirroring the `voiceMark` require) and delegates READ-ONLY to `readStance()` + `forcedVoiceColorForStance()`. It folds `{stance, stance_forced_color}` into `collectSignals()`'s returned object using the same `readVoiceSwitchState` try/catch-degrade spread idiom. Never throws (Part 8).
- `cockpit-renderer.cjs`: in the healthy/caution hero branch only, (a) an additive `[stance]` segment is pushed immediately after the identity segment and before orientation (the `brainOn`/`risk`/`bar` optional-segment idiom, NOT a 4th WHO chip), and (b) when `stance_forced_color` is set, `voiceMark.glyphForColor()` overrides the natural voice glyph in the same pass. The `ctx_cliff` and `doctor_fix` hero branches are untouched.

**Task 2 - Plurai posture-framing fidelity gate.**
- `09-posture-framing-fidelity.csv`: 32 SYNTHETIC rows, 8 per stance, 16 compliant / 16 violation. `Sample` is JSON-encoded `{declared_stance, larry_turn}`; each `Reasoning` names the framing tell that fired or was missing. Near-miss rows stress the boundary (a redteam turn that is only mildly skeptical, a tell-act turn that sneaks in a Socratic question, a research turn that pulls evidence but drops the hedge and issues a ship order).
- `192-baseline.json`: `method: "hand-labeled"`, `deferred: true`, `judge_model: "fable"`, plus a per-row `verdict_map` (compliant->pass, violation->flag) as the deterministic parity target. Mirrors the 204-baseline schema.
- `README.md`: one new table row (judge model fable, canon contract Part 12 + SEED-042).

## Live-derived confirmation (navigator feedback 2026-07-02)

The signals are NOT hardcoded placeholders. `collectSignals()` reads the real `~/.mindrian/stance-state.json` via `lib/core/stance-state.cjs` every render, so the chip and voice glyph change per turn as the LOCAL state changes. End-to-end demonstration (writing the real state file, then rendering):

- `null`     -> `⬡ 🟨 👤 Larry · 📂 Demo ✅ · Next: continue · 🟢`  (natural yellow glyph, NO chip -- byte-identical to pre-plan)
- `redteam`  -> `⬡ 🟥 👤 Larry · [redteam] · 📂 Demo ✅ · ...`  (forced RED square + chip)
- `tell-act` -> `⬡ 🟦 👤 Larry · [tell-act] · 📂 Demo ✅ · ...`  (forced BLUE square + chip)
- `research` -> `⬡ 🟨 👤 Larry · [research] · 📂 Demo ✅ · ...`  (chip, NO forced color -- natural detection governs)

The glyph flips 🟨 -> 🟥 -> 🟦 and the chip appears/vanishes purely from the LOCAL state; nothing is static.

## Verification

- `node tests/test-192-statusline-stance-chip.cjs` -> 27/27 pass, exit 0.
- Byte-stability manual diff: `renderCockpit(base) === renderCockpit({...base, stance:null, stance_forced_color:null})` -> BYTE-IDENTICAL.
- CSV: 32 data rows (>= 24), all 4 stance names present, both labels present, every `Sample` parses as valid JSON, zero em-dashes.
- `192-baseline.json` parses, carries `method`, `deferred:true`, `judge_model:fable`.
- Regressions: `test-statusline-cockpit-187.cjs` 124/124 pass; `test-192-menu-sweep-live-selectors.cjs` pass.

## Plurai gate: CSV + baseline conform to README + Part 8

Yes. The CSV follows the README `Sample,Label,Reasoning` schema (Sample JSON-encoded), the baseline records `method` + `precision`/`recall` + `verdict_map` mirroring `196/204-baseline.json`, and a README judge-prompt row was added. Every row is SYNTHETIC/manufactured (Canon Part 8, dogfood-only) -- no real names, emails, or room metrics.

## Deviations from Plan

**1. [Rule 3 - degrade, sanctioned by R6] Plurai baseline hand-labeled, not hosted-eval.**
- The Plurai eval is an interactive multi-turn MCP flow (`start_evaluator` + `ask_user` model choice + `ScheduleWakeup` + `get_results`) that cannot run non-interactively in the sequential executor (the same constraint documented in `196/201/204-baseline.json`). `uv` is present but the flow is not one-shot.
- Per R6 + the plan's explicit degrade path, `192-baseline.json` is hand-labeled deterministically from the Label column with `method: "hand-labeled"` and `deferred: true`. The phase is NOT blocked on Plurai availability. Re-run `/evals:eval` interactively after `/reload-plugins` to replace it with a hosted baseline.

## Deferred Issues (out of scope)

- `tests/test-statusline-glyph-isolation.cjs` FAILS on an UNTRACKED runtime cache `.mindrian/brain-substrate-cache.json` that embeds the exclusive D-02 glyphs (chart/target). This file is not tracked in git and is NOT in any 192-04 commit; my changed source files carry ZERO forbidden glyphs. Pre-existing, environmental, out of 192-04 scope. Logged to `deferred-items.md`.

## must_haves satisfaction

- [x] Truth 1: stance override -> persistent passive `[stance]` chip; default -> byte-identical render. VERIFIED (test a + manual diff).
- [x] Truth 2: forced voice-glyph color (redteam=red / tell-act=blue) reflected in the SAME render pass; the pole IS the voice glyph. VERIFIED (test b/c).
- [x] Truth 3: Plurai eval GATE ships (synthetic CSV + persisted baseline, 196-harness pattern). VERIFIED (32 rows + baseline).

## Threat surface

No new network endpoints, auth paths, or Brain wire introduced. Both new reads are LOCAL, try/catch-guarded (T-192-04-02/03 accepted per plan). The eval CSV is synthetic-only (T-192-04-01 mitigated). No threat flags.

## Self-Check: PASSED

All 7 declared files exist on disk; all 3 commit hashes (f041db48, adefd851, 317a1221) present in git history.
