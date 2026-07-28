---
phase: 243-voice-glyph
plan: 01
subsystem: statusline / Voice Signature (Canon Part 12)
tags: [glyph-fabrication, honest-empty, mutation-gate, phase-210-supersession]
dependency_graph:
  requires: []
  provides:
    - "lib/statusline/cockpit-renderer.cjs: single-source voice glyph (resolveVoiceGlyph only)"
    - "tests/test-243-voice-glyph-honest.cjs: 18-row fixture + mutation gate"
    - "tests/run-all-243.sh: glob-discovering phase aggregator"
  affects:
    - "tests/test-voice-glyph-advisory.cjs (leg 3 inverted)"
    - "tests/test-192-statusline-stance-chip.cjs (cases b/c inverted)"
tech_stack:
  added: []
  patterns:
    - "honest-empty over plausible-default (Ruling 3c precedent)"
    - "invert, never delete, a superseded contract assertion"
    - "mutation-proven gate: run the mutation, do not reason about it"
key_files:
  created:
    - tests/test-243-voice-glyph-honest.cjs
    - tests/run-all-243.sh
    - .planning/phases/243-voice-glyph/deferred-items.md
  modified:
    - lib/statusline/cockpit-renderer.cjs
    - tests/test-voice-glyph-advisory.cjs
    - tests/test-192-statusline-stance-chip.cjs
decisions:
  - "Phase 243 supersedes the second half of Phase 210 item B (stance-fills-default dies; natural-detection-wins survives)."
  - "The three Phase 210/192 assertions were inverted, not deleted -- the inversion IS the mutation gate."
  - "Pre-existing, unrelated failures inside run-all-192.sh (help.md wording) and run-all-210.sh (fusion-router edges, stamp-firing-block sweep) are logged to deferred-items.md, not fixed -- out of this plan's declared files_modified scope."
metrics:
  duration: "~45 minutes"
  completed: 2026-07-28
---

# Phase 243 Plan 01: Voice-Glyph Honesty Summary

One-liner: deleted the 4-line stance-default-glyph fabrication in `cockpit-renderer.cjs`, proved by a real mutation run that the honest-empty gate bites, and inverted (not deleted) the three Phase 210/192 assertions that used to certify the fabrication as a feature.

## What shipped

1. **`tests/test-243-voice-glyph-honest.cjs`** (NEW) -- 18-row fixture: all 5 De Stijl glyphs (blue/red/yellow/black/white) through all 3 input shapes (`voice_glyph`/`voice_color`/`voice_move`) = 15 rows, plus 3 honest-empty rows (no stance; redteam-no-signal; tell-act-no-signal). No hard-coded glyph literals -- every glyph is resolved via `voiceMark.glyphForColor` / `COLOR_GLYPHS` / `VOICE_COLOR_MARKS`.
2. **`tests/run-all-243.sh`** (NEW) -- glob-discovering aggregator (`tests/test-243-*.cjs`/`.sh`), hard-fails on zero discovered tests, runs the mandatory `run-all-192.sh` and `run-all-210.sh` regression legs.
3. **`lib/statusline/cockpit-renderer.cjs`** -- deleted the branch that filled the voice glyph from the active stance's default color when natural voice-mark detection returned null. `voiceGlyph` is now `const`, resolved solely by `resolveVoiceGlyph(s)`. New comment block names Phase 243, GLYPH-01, Phase 210 item B, and Ruling 3c.
4. **`tests/test-voice-glyph-advisory.cjs`** -- leg 3 inverted from "PRESERVE FLOOR: stance color stays the default glyph" to "SUPERSEDED BY PHASE 243: stance color must NOT render a glyph". Assertion count unchanged (4 legs).
5. **`tests/test-192-statusline-stance-chip.cjs`** -- cases (b)/(c) glyph assertions inverted (`!== -1` -> `=== -1`); the `[redteam]`/`[tell-act]` chip assertions and the natural-yellow-wins assertions left untouched. Assertion count unchanged (27 passed).

## Governance: the Phase 210 item B supersession

Phase 243 REVERSES the second half of Phase 210 item B, a navigator-directed softening recorded at `.planning/STATE.md:2964`: *"210-03: voice-glyph precedence flipped at the consumer (cockpit-renderer) -- natural detection wins, stance color fills the default."*

- **What survives:** natural detection wins. Unchanged, and now the only rule.
- **What dies:** the stance color filling the default when detection is silent.
- **Why:** Phase 210 made that call assuming "natural detection yields nothing" was an OCCASIONAL state. It is the PERMANENT state -- zero writers exist for `~/.mindrian/voice-mark.json` (verified by grep: exactly two references repo-wide, both readers). A reasonable default over an occasional gap becomes a permanent lie over a permanent gap. This is a further SOFTENING, the same direction Phase 210 was travelling -- it removes a signal the system was asserting without evidence.
- **How it was carried, not erased:** the three assertions that encoded the old contract were INVERTED, never deleted. An inverted assertion IS the mutation gate SC1 requires.

## The F5 residual (carried forward, not left implicit)

After this plan lands, the Tier-1 voice glyph is **DARK in production -- on every turn, on every install, permanently -- until a session-keyed writer for `~/.mindrian/voice-mark.json` exists.** That is the correct honest state and it satisfies SC1. It is also, on its own, indistinguishable from the failure that created Phase 182.1: a green suite certifying a feature that does nothing.

**The voice glyph now reflects the actual turn IN FIXTURES; production is dark by design pending the write side.** No placeholder glyph was invented to fill the gap -- that would recreate the defect. Plan 243-02 files this same residual as a named OPEN item in the RCA (`.planning/debug/voice-signature-dark-runtime.md`).

## Mutation-probe run (the evidence, not a claim)

Executed for real in this session, exactly per the plan's Step 1-5 sequence:

**Step 1 (snapshot):** `cockpit-renderer.cjs` copied to the session scratchpad (`/tmp/claude-1000/.../scratchpad/cockpit-renderer.cjs.snapshot`); md5sum confirmed identical before mutation.

**Step 2 (mutate):** re-inserted the deleted 4-line branch verbatim (`if (isLarry && !voiceGlyph && voiceMark && typeof s.stance_forced_color === 'string' && s.stance_forced_color) { const stanceDefaultGlyph = voiceMark.glyphForColor(s.stance_forced_color); if (stanceDefaultGlyph) voiceGlyph = stanceDefaultGlyph; }`), reverted `const voiceGlyph` back to `let voiceGlyph`.

**Step 3 (observe) -- command run: `node tests/test-243-voice-glyph-honest.cjs`**

```
test-243-voice-glyph-honest: 16 passed, 2 failed
```
Exit code: **1** (non-zero). Failing rows, by name, exactly as predicted:
- `RED  (2b: redteam stance, no natural voice mark -> NO glyph fabricated; [redteam] chip stays)`
- `RED  (2c: tell-act stance, no natural voice mark -> NO glyph fabricated; [tell-act] chip stays)`

All 15 vocabulary rows and row 2a (no stance at all) stayed green under the mutation -- the fabrication only fires when `stance_forced_color` is set, confirming the fixture targets the right branch.

**Step 4 (restore):** snapshot copied back over the file; md5sum re-confirmed byte-identical to the pre-mutation state.

**Step 5 (confirm):**
- `grep -c stanceDefaultGlyph lib/statusline/cockpit-renderer.cjs` -> `0`
- `grep -c 'let voiceGlyph' lib/statusline/cockpit-renderer.cjs` -> `0`
- `node tests/test-243-voice-glyph-honest.cjs` -> exit `0`, `18 passed, 0 failed`
- `git diff --stat lib/statusline/cockpit-renderer.cjs` -> empty (Task 2's commit already captured the file; the mutation contributed nothing to the tree)

## Navigator-visible behavior change

A navigator with a stance set today (via `/mos:stance`) sees a fabricated red/blue voice glyph on their statusline right now. **After this ships, that glyph disappears.** They still see the `[redteam]`/`[tell-act]` chip -- only the glyph is gone, because it was never evidence of anything. This is the intended honest state, not a regression. Suggested one-line CHANGELOG entry: *"The voice glyph now appears only when a real voice mark is detected; the stance color no longer fills in a default glyph."*

## Release-lockstep reminder

Per the standing rule (`feedback_dev_repo_fix_not_live_until_released`), **this fix is NOT live for any running session after this commit**, and not after a release either until that session picks it up. v1.16.0 work ships as `v1.16.0-beta.N`, and no v1.16.0 cut happens before ROADMAP Gate 0 (the stable v1.15.0 close-out).

## Verification

**Green, mutation-proven, this plan's own contract:**
- `node tests/test-243-voice-glyph-honest.cjs` -> **18 passed, 0 failed, exit 0** (15 vocabulary rows + 3 honest-empty rows).
- Live before/after proof (RESEARCH.md's own reproduction command), run verbatim:
  ```
  node -e "const r=require('./lib/statusline/cockpit-renderer.cjs'); console.log(r.renderCockpit({room:'Demo',next_move:'x',stance:'redteam',stance_forced_color:'red'}));"
  ```
  Before Task 2: `⬡ 🟥 · [redteam] · 📂 Demo ✅ · Next: x`. After Task 2 (this session): `⬡ · [redteam] · 📂 Demo ✅ · Next: x`. The fabricated red square is gone; the `[redteam]` chip stays.
- `node tests/test-voice-glyph-advisory.cjs` -> **4 passed, 0 failed** (leg 3 inverted, count unchanged).
- `node tests/test-192-statusline-stance-chip.cjs` -> **PASSED: 27  FAILED: 0** (cases b/c inverted, count unchanged).
- `grep -c stanceDefaultGlyph lib/statusline/cockpit-renderer.cjs` -> `0`.
- `grep -cF 'const voiceGlyph = isLarry ? resolveVoiceGlyph(s) : null' lib/statusline/cockpit-renderer.cjs` -> `1`.
- `git diff --stat lib/core/stance-state.cjs lib/hmi/voice-color-mark.cjs lib/statusline/cockpit-signals.cjs scripts/context-monitor` -> empty (frozen producers byte-identical).
- No em-dashes on any executable line of any touched file (comment-stripped grep, all zero).
- `node scripts/build-connector-registry.cjs --check` -> `connector-registry: OK`, exit 0 (this phase adds no invocable surface; the CIRS ledger is unchanged).
- `git status --porcelain` after the mutation probe -> only `.planning/STATE.md` (a pre-existing orchestrator-owned modification present before this plan started, untouched by this plan's own work).

**RED at baseline, unrelated to Phase 243, logged to `deferred-items.md` (NOT fixed -- out of this plan's `files_modified` scope):**
- `bash tests/run-all-192.sh` -> `PASS=12 FAIL=1` (same count before and after this plan's changes). The one failure is `192-01 menu-sweep`, assertion B: `help.md`/`mos.md` still name the two-axis lanes-as-tabs model. Zero relation to the voice glyph.
- `bash tests/run-all-210.sh` -> `PASS=12 FAIL=2` (same count before and after). Failures: `210-D fusion-router suite` (a cross-frame Neo4j-edge-write assertion, `tests/test-205-fusion-router.cjs`) and `210-E3 stamp sweep clean --check` (3 command files pending `node scripts/stamp-firing-block.cjs`). Neither touches the statusline or the voice glyph.
- `bash tests/run-all-243.sh` -> `PASS=1 FAIL=2` for the same two reasons above (its own fixture leg passes; its two mandatory regression legs fail as whole scripts because of the pre-existing, unrelated content described above).
- **Confirmed pre-existing, not introduced by this plan:** both aggregators were run immediately after Task 1 (before any renderer or test-file edit) and showed the identical PASS/FAIL counts and the identical failure identities. This plan changes the FAIL count in neither aggregator. Full detail: `.planning/phases/243-voice-glyph/deferred-items.md`.
- Within both red aggregators, the SPECIFIC sub-tests carrying Phase 243's own inverted contract (`test-voice-glyph-advisory.cjs` inside `run-all-210.sh`; `test-192-statusline-stance-chip.cjs` inside `run-all-192.sh`) both print `PASSED` in the aggregator's own output, confirmed by direct log inspection this session.

This is recorded honestly rather than claimed as a fully green gate: the literal text of the plan's acceptance criteria ("`bash tests/run-all-192.sh` exits 0", "`bash tests/run-all-210.sh` exits 0", "`bash tests/run-all-243.sh` exits 0 with FAIL=0") cannot be satisfied without editing `help.md`/`mos.md`, `tests/test-205-fusion-router.cjs` (or its production counterpart), or running `node scripts/stamp-firing-block.cjs` against unrelated command files -- none of which sit inside this plan's declared `files_modified`, and all three predate this plan's first commit. The plan's own "File-handling note" anticipates exactly this class of pre-existing drift from a concurrent session and instructs the executor not to mis-attribute it here.

## Deviations from Plan

### Auto-fixed issues

None -- the plan's exact code/text was followed with two small load-bearing additions:

1. **[Rule 3 - blocking acceptance criterion] Added a second `GLYPH-01`/`Phase 243` mention in the renderer's comment block.** The acceptance criteria required `grep -c 'Phase 243\|GLYPH-01' lib/statusline/cockpit-renderer.cjs` to return 2 or more (grep -c counts matching LINES). The plan's own suggested comment text names both terms only once, on one line. Added one more line (`// GLYPH-01 (Phase 243): fixture proof at tests/test-243-voice-glyph-honest.cjs.`) to satisfy the literal grep count without changing the comment's meaning. Files: `lib/statusline/cockpit-renderer.cjs`. Commit: `46eea09d`.

### Not fixed, logged instead

2. **[Out of scope, pre-existing] Three unrelated failures inside `run-all-192.sh`/`run-all-210.sh`.** See Verification section above and `.planning/phases/243-voice-glyph/deferred-items.md` for full detail. Not a deviation from this plan's own work -- confirmed present before any Phase 243 change and unchanged by it.

## Known Stubs

None. No hardcoded empty values, placeholder text, or unwired data sources were introduced by this plan.

## Threat Flags

None. This plan mitigates T-243-01 (the self-inflicted spoofing threat named in the plan's own threat model) by deleting the fabrication branch; it introduces no new network endpoint, auth path, file-access pattern, or schema change at a trust boundary.

## Self-Check

- `tests/test-243-voice-glyph-honest.cjs`: FOUND (created, committed `8cde7f0b`)
- `tests/run-all-243.sh`: FOUND (created, committed `8cde7f0b`)
- `lib/statusline/cockpit-renderer.cjs`: FOUND, modified, committed `46eea09d`
- `tests/test-voice-glyph-advisory.cjs`: FOUND, modified, committed `46eea09d`
- `tests/test-192-statusline-stance-chip.cjs`: FOUND, modified, committed `46eea09d`
- `.planning/phases/243-voice-glyph/deferred-items.md`: FOUND (created, gitignored under `.planning/*`, will be force-added alongside this SUMMARY)
- Commit `8cde7f0b`: FOUND in `git log`
- Commit `46eea09d`: FOUND in `git log`

## Self-Check: PASSED
