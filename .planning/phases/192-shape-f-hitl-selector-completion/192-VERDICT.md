# Phase 192 Verdict: Shape-F HITL Selector Completion (SFC-01..SFC-09)

**VERDICT: PASS**

Structured adversarial verdict for Wave 3 (192-05). `tests/run-all-192.sh` runs
every suite this phase shipped plus the carried drift fences and the two
born-wired / render-coverage gates to completion, and exits 0.

**Aggregator tally: PASS=13 FAIL=0 SKIP=0, exit 0** (plus 1 deferred-and-reported
live-Plurai leg).

This is not a celebration. Below are the four named invariant checks and the
Part-8 sweep, each with its command and its literal result, including one
pre-existing debt the sweep surfaced and did not paper over.

---

## Suite roll-up (one row per run-all-192.sh leg)

| # | Leg | Result | Assertions proven |
|---|-----|--------|-------------------|
| 1 | 192-01 menu-sweep live selectors | PASS | 2 blocks: SEED-020 gap-check ledger records all five surfaces; help.md live selector + mos.md router doctrine untouched |
| 2 | 192-02 ACPT-06 dial atomic emission | PASS | 5: production turn -> seam fuel -> engine source; dial text + AskUserQuestion card emitted atomically; cold-room emits neither; Part-8 sentinel never leaks; stub-guard unset |
| 3 | 192-02 F.7-max preview + confidence bar | PASS | 11: block-glyph bar never a bare NN%; cold-room "--" honesty; byte-stable width; opt-in preview only |
| 4 | 192-02 F.7-max Q2 multiSelect modifier pane | PASS | 5: exactly 3 modifier items multiSelect:true; Q1 stays single-select; no new typed-edge vocab; compose rides one card |
| 5 | 192-02 dial render-states regression | PASS | 14: S1-S5 marker states; zero ANSI in ReachList core; frozen body marker count; zero em-dash in header |
| 6 | 192-03 stance-state (pure LOCAL 4-pole dial) | PASS | 35: STANCES frozen [research, tell-act, ask, redteam]; read/write/next round-trips; tamper -> null; forced-color map; and three IN-SUITE code fences: no push_forward, no pull_back, no bare-hold posture-id literal |
| 7 | 192-03 stance toggle F.0 cycle-and-confirm gate | PASS | 16: hitl_shape F.0 + connector.excluded declared; cites pickShape('F.0', ...); never hand-builds raw questions JSON; wires read/next/writeStance |
| 8 | 192-03 stance locked voice-glyph override | PASS | 22: footer-offer doctrine; redteam->RED, tell-act->BLUE, research/ask no forced color; distinct-by-name from the Modality Remote and the Navigator posture; pre-existing headings preserved |
| 9 | 192-04 statusline [stance] chip + forced voice-color | PASS | 27: default byte-stability; forced red/blue glyph; natural detection on research/ask; chip position; never throws; zero em-dash |
| 10 | CARRIED posture-ids drift fence | PASS | LARRY-04 exactly-3 posture-id set, no 4th (the stance work minted no posture collision) |
| 11 | CARRIED reach-ids drift fence | PASS | LARRY-03 exactly-6 reach-id set, no 7th (this phase minted no new LarryReach) |
| 12 | born-wired gate (build-connector-registry --check) | PASS | connector-registry OK: commands/stance.md is WIRED-or-EXCLUDED, not dark |
| 13 | render-coverage gate (check-render-coverage) | PASS | 16 covered, 0 excluded, 0 gap |
| -- | live Plurai posture-framing judge | DEFERRED (reported) | 192-baseline.json deferred:true; re-run /evals:eval model=fable interactively; hand-labeled baseline + verdict_map hold the line |

**Total: 13/13 legs PASS, 0 FAIL, 0 SKIP, exit 0. One leg deferred-and-reported,
never silently skipped (mirrors the 203 precedent).**

---

## Named-invariant checklist (the four adversarial checks)

Pre-phase reference commit for every diff/baseline below: `61606a56`
(the last commit before the first Phase-192 commit `420c1c59`).

### (a) Stance / posture naming disambiguation held

- **Command:** `grep -c "push_forward\|pull_back" lib/core/stance-state.cjs`
- **Raw result: 2.** Both matches are on lines 11 and 30, and both are
  explanatory `//` doc-comments describing the Hierarchical Navigator /
  Usher-cycle read the stance dial is deliberately kept SEPARATE from. Neither
  is an identifier, a string literal, or a stance pole name.
- **Code-scoped result (comments stripped):**
  `grep -vE '^\s*//' lib/core/stance-state.cjs | grep -c "push_forward\|pull_back"`
  **= 0.**
- **The real pole vocabulary** is the frozen `STANCES` set at line 45:
  `['research', 'tell-act', 'ask', 'redteam']` -- zero overlap with the
  Navigator's `push_forward` / `pull_back` / bare `hold` triad.
- **Independent corroboration:** the `test-stance-state.cjs` suite (leg 6) itself
  asserts, as green code checks, "module code contains no push_forward token",
  "no pull_back token", and "no bare hold posture-id literal".
- **Disposition: PASS.** The naming firewall holds; the two raw hits are the
  comment that documents WHY it holds.

### (b) F.0 closed-vocab was never widened

- **Command:** `git diff --quiet 61606a56 HEAD -- lib/hmi/shape-f0-renderer.cjs`
- **Result: UNCHANGED** (exit 0, empty `--stat`). `lib/hmi/shape-f0-renderer.cjs`
  is BYTE-IDENTICAL across every Phase-192 commit. The /mos:stance toggle reuses
  the existing Approve/Reject/Defer F.0 renderer; it did not add a fourth verb or
  touch the closed vocabulary.
- **Disposition: PASS.**

### (c) Frozen Part-3 scalars unchanged

- **Command:** literal-count `0.70`, `0.15`, `MAX_K`, `DIAL_REACH_K` in each
  dial surface, NOW vs the `61606a56` baseline (`git show 61606a56:<file>`).

  | File | Scalar | NOW | PRE |
  |------|--------|-----|-----|
  | lib/hmi/dial-presenter.cjs | 0.70 / 0.15 / MAX_K / DIAL_REACH_K | 1 / 2 / 4 / 3 | 1 / 2 / 4 / 3 |
  | lib/hmi/dial-reach-orchestrator.cjs | 0.70 / 0.15 / MAX_K / DIAL_REACH_K | 13 / 5 / 7 / 9 | 13 / 5 / 7 / 9 |

- **Result:** every count is identical to the pre-phase baseline. No scalar value
  changed. (`dial-reach-orchestrator.cjs` was not even in this phase's diff.)
- **Disposition: PASS.** MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate are frozen.

### (d) Em-dash sweep across every file this phase touched

- **Command:** `grep -rn "<em-dash>" <all 19 content files touched by 192-01..04>`
- **Result: 1 match** -- `evals/plurai/README.md:1`, the file TITLE line
  (`# Plurai AI Judge <em-dash> MindrianOS Eval CSVs`).
- **Adversarial disambiguation:** this em-dash is **PRE-EXISTING**. It is present
  in `git show 61606a56:evals/plurai/README.md` (count 1) -- it predates Phase
  192 entirely. Phase 192-04 only appended one judge-model table row to that
  README; the title was never in scope.
- **Phase-192-introduced em-dashes:**
  `git diff 61606a56 e4b67e36 | grep '^+' | grep -c "<em-dash>"` **= 0** across
  the ENTIRE phase diff (and 0 in the README diff specifically).
- **Disposition: PASS for the phase** (Phase 192 introduced zero em-dashes).
  The single pre-existing title em-dash is logged as a KNOWN DEBT below; it was
  NOT fixed here because `evals/plurai/README.md` is outside this plan's
  exclusive file ownership (192-05 owns only `run-all-192.sh` + this verdict; R6),
  and the em-dash is not a Phase-192 regression.

---

## Part 8 (Brain-egress) grep sweep across every lib file this phase touched

- **Command:** grep each phase-192 lib surface for
  `fetch(` / `node:http` / `node:https` / `require('https?')` / `XMLHttpRequest`
  / `brain-client` / `brain-mcp` / `buildBrainPacket` / `axios`.

  | File | Result |
  |------|--------|
  | lib/core/stance-state.cjs | CLEAN (zero network / Brain tokens) |
  | lib/hmi/dial-presenter.cjs | CLEAN |
  | lib/statusline/cockpit-renderer.cjs | CLEAN |
  | lib/statusline/cockpit-signals.cjs | CLEAN |

- **Positive assertion:** `lib/core/stance-state.cjs` requires only
  `node:fs` / `node:path` / `node:os` -- it is a pure LOCAL side-channel over
  `~/.mindrian/stance-state.json`. No user byte can egress to the Brain from any
  surface this phase added.
- **Disposition: PASS.** Canon Part 8 (LOCAL -> BRAIN: NO) holds.

---

## Disposition

**Phase 192 PASSES.** The Shape-F HITL selector family is closed: the menu-sweep
live selectors (192-01), the F.7-max dial with its atomic-emission contract,
preview panel, confidence bar, and modifier pane (192-02), the pure-LOCAL 4-pole
stance dial with its F.0 cycle-and-confirm toggle and locked voice-glyph override
(192-03), and the statusline [stance] chip plus the Plurai posture-framing gate
(192-04) all pass behind one command. The phase closes with **zero drift** against
the frozen posture-id set (exactly 3), the frozen reach-id set (exactly 6), the
frozen Part-3 scalars (MAX_K=3, DIAL_REACH_K=6, 0.70/0.15), and the F.0 closed
vocabulary (byte-unchanged). The born-wired and render-coverage gates stay green
with `commands/stance.md` included. Canon Part 8 holds on every new surface.

---

## Known debts (explicitly deferred, not defects of this phase)

1. **Live Plurai posture-framing judge (192-04).** The hosted `fable` judge over
   `evals/plurai/09-posture-framing-fidelity.csv` runs only through the
   interactive `/evals:eval` MCP flow, which cannot run in the sequential
   executor. `evals/plurai/192-baseline.json` carries `deferred:true` with a
   hand-labeled `verdict_map`; the local deterministic baseline holds the line
   until the judge is re-run interactively. Same precedent as phases 196/201/
   203/204.

2. **Pre-existing em-dash in `evals/plurai/README.md:1`.** The README title
   (`# Plurai AI Judge <em-dash> ...`) carries an em-dash that predates Phase 192
   (present at `61606a56`). Phase 192 introduced zero em-dashes. It was not fixed
   here because that file is outside this plan's exclusive ownership (R6); it is
   logged to `deferred-items.md` for a future doc-scoped pass.

3. **commands/rooms.md subcommands (192-01 scope note).** Per 192-01 Task 2's
   documented scope, the `rooms` list/where surfaces close with live F.1
   selectors; any residual terminal-text confirmations were intentionally left
   as-is and are not a Phase-192 gap.
