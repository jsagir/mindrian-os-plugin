# Phase 359: Missed-fork detection (Larry poses a genuine decision in prose and no card fires) - Specification

**Created:** 2026-09-23
**Ambiguity score:** 0.18 (gate: <= 0.20)
**Requirements:** 10 locked
**Mode:** `/gsd-spec-phase 359 --auto` (every decision below marked `[auto]` in the Interview Log was picked by
Claude as the recommended default; the navigator has not ruled on them yet)

## Goal

When Larry poses a genuine fork in prose, the Stop hook finds a machine-readable fork declaration that Larry
emitted himself and forces the card. The hook never guesses a fork from free text. Measured three ways:
0 verdict changes on the 357 replay corpus (no new false blocks, no new misses), 100% correct verdicts on the
declared-fork fixtures, and forward missed forks cut by at least half on a fixed synthetic scenario set.

## Background

- **The gap, in one sentence.** `classifyCardFire` (`scripts/check-card-fire.cjs:523`) has exactly two ways to
  know a fork happened:
  - PRIMARY: a registry gate-reaching surface appears in `ran_entries`.
  - BACKSTOP: the output matches `ASCII_BOX_UNCONDITIONAL_RE` (a bracket box, or the "type 1, 2, or 3" literal).

  A fork Larry writes in plain prose ("research first, or build the plan?") trips neither, so the verdict is
  `no-gate-signal` and no card fires. This is the navigator's complaint: "not getting decision point cards in
  cli".
- **Why the hook must not read prose.** The Phase 209-07 numbered-prose arm tried to spot forks from text shape
  plus a nearby framing cue. On live evidence it was about 86% false positive: 6 of the 7 real backstop fires
  were benign (clarifying-question pairs, step lists, even a disclaimer saying "NOT options to pick between").
  It was retired on 2026-07-17 (`card-fire-relevance-check-gap`, `backstop-benign-list-defeats-relevance-gate`).
  238-RESEARCH later measured that a footnote list and a bracket-box gate are the same string. The retirement
  note hands prose forks back to "the MODEL's own SEED-021 judgment". intern-w1 (`.planning/debug/resolved/
  intern-w1-card-discipline-decay.md`) shows that judgment decays inside a session: 1 card on turn 1, then
  3 genuine two-way prose forks with no card. It names "free-flowing prose never matches the shape gate" as an
  explicit open gap.
- **357 leaves this gap open on purpose.** 357-SPEC R4 records prose forks with 0 extractable labels as
  `known_miss`. 357 builds the tool 359 measures with: the replay corpus (`tests/fixtures/card-fire-replay/`,
  4 sources, 45 or more entries), `scripts/replay-card-fire.cjs` (`--surface cli|mcp|both`,
  `--baseline write|compare`, `--code-root`), the dev-time Jev labeler with its `is-fork` Noul
  (`data/jev-policies/card-fire-replay.json`), and the D-06 navigator-ratified dogfood labels. As of this spec
  none of these exist on disk yet, because 357 has not executed.
- **The model already emits structured markers the hook can read.** Two exist today:
  - Every Larry turn opens with one De Stijl voice glyph (`lib/hmi/voice-color-mark.cjs::detectVoiceMark`).
    The black square means "gate".
  - The dial carries the `[AskUserQuestion contract: shape=F.X verbs=N]` trailer (`selector-dispatcher.cjs`).
    That one is minted by the hook, not by Larry, so it only covers registry gates.

  A local, count-only aggregate over 30 days of this machine's transcripts (2771 turns; no text was read or
  printed) found:
  - 137 turns open with the black square. 83 of them fired no card.
  - Of 435 turns that did fire a card, 381 opened with a different glyph, or with none.

  So the glyph names Larry's teaching move, not whether a fork is posed. It cannot be the fork declaration
  without rewriting the Part 12 voice doctrine.
- **Tri-Polar.** The MCP `stop_gate_check` (`lib/mcp/stop-gate-handler.cjs:464,489`) runs the same
  `deriveTurnSignals` -> `classifyCardFire` over `output_text`. A new arm reaches Desktop/Cowork through that
  handler automatically, as long as the handler passes the new fields through.
- **Rulings (2026-09-17, unchanged):**
  - Zero user text goes to Jev.
  - Jev never runs in a hook or at runtime.
  - Jev labels only synthetic fixtures, at dev time.

## Requirements

1. **Missed-fork label dimension**: the replay corpus can say whether an entry is a prose fork, and what that
   fork's labels are.
   - Current: 357 entries carry only `expected_verdict_class` (block/pass) and an optional `known_miss`.
     Nothing marks "this output poses a genuine navigator fork in prose with no card".
   - Target:
     - Every corpus entry may carry `prose_fork: true|false` plus `fork_labels: [..]` (2 or more labels when
       true).
     - A new fixture file `tests/fixtures/card-fire-replay/prose-forks-359.json` holds 15 or more synthetic
       prose-fork outputs and 15 or more synthetic non-fork prose controls. Every sanitized intern-w1 phrasing
       and every backstop-benign-list false-positive shape counts toward these, not on top of them.
     - The synthetic entries are labeled through 357's labeler and `is-fork` Noul (no new egress profile).
     - 357 dogfood entries get `prose_fork` locally (`label_origin: local` -> `human` at one navigator review).
   - Acceptance: the loader test asserts the file exists, the 15/15 floors hold, every `prose_fork: true` entry
     has 2 or more `fork_labels`, and the labeler refuses the dogfood source (357 test stays green).

2. **Baseline missed-fork metric**: the replay reports missed forks, and the pre-change count is recorded.
   - Current: `replay-card-fire.cjs` reports false_blocks, new_misses and known_misses. It has no missed-fork
     count.
   - Target: the replay reports `missed_forks`: entries with `prose_fork: true`, no card fired, and verdict
     pass. The pre-change value is written into `tests/fixtures/card-fire-replay/baseline.json` (or a 359
     sibling baseline), using `--code-root` against the pre-359 commit.
   - Acceptance: on the pre-359 code, `missed_forks` equals the count of `prose_fork: true` entries with no
     card (every prose fork is missed today). The number is recorded in the phase SUMMARY.

3. **Fork declaration contract**: a single, strict, machine-readable declaration Larry emits whenever he poses
   a fork.
   - Current: none. Larry has no deterministic way to tell the hook "I just posed a fork".
   - Target: one pure local CJS module owns the grammar and exports `parseForkDeclaration(outputText)`. It
     returns `{declared: true, labels: [...]}` or `{declared: false}`. Grammar constraints:
     - It sits on the last non-empty line of the output.
     - It has a fixed ASCII prefix.
     - It carries 2 to 5 labels, each capped at 80 characters.
     - It contains no De Stijl glyph, so `detectVoiceMark`'s exactly-one contract holds.
     - It cannot match `ASCII_BOX_UNCONDITIONAL_RE`.
     - It is at most 1 visible line.

     The parser never looks at any other line. The exact prefix, and whether the line is hidden, are
     discuss-phase decisions.
   - Acceptance: parser unit tests pass for:
     - valid 2-label and 5-label lines
     - a declaration line placed anywhere except last (not declared)
     - 1 label (not declared)
     - 6 labels, or an over-cap label (not declared)
     - a line carrying a De Stijl glyph (not declared)
     - the empty string and non-string input (not declared, no throw)

     The parser makes zero network calls.

4. **Declared-fork arm in the classifier**: a declared fork with no card is intercepted deterministically.
   - Current: `classifyCardFire` returns `no-gate-signal` whenever PRIMARY and BACKSTOP both miss.
   - Target: `deriveTurnSignals` threads `fork_declared` and `declared_labels` from `parseForkDeclaration`.
     `classifyCardFire` treats a declaration as a third gate signal. The verdict rules:
     - Card fired: pass (`card-fired`, unchanged precedence).
     - Session ceiling or `MAX_FORCE_RETRIES` reached: degrade, same bounded escape as today.
     - Declared labels are yes/no-shaped (`gateRelevance.isYesNoShapedGate`): pass (`gate-is-simple-binary`).
     - Otherwise: intercept, reason `declared-fork-no-card`.

     The relevance and already-answered heuristics do NOT apply to this arm. The declaration is Larry's own
     assertion, made in the current turn, that the fork is live. The retry key includes the declared labels.
   - Acceptance: fixture legs cover each rule. The legs are declared + no card -> block, declared + card ->
     pass, declared yes/no -> pass, declared at the retry ceiling -> degrade, and declared at the session
     ceiling -> degrade. Each asserts the exact reason string.

5. **Inertness on the 357 corpus (0 new false blocks)**: the new arm changes no verdict on any output without a
   declaration.
   - Current: 357's post-phase replay verdicts are the baseline.
   - Target: every 357 corpus entry keeps the same verdict class and reason after 359. Historic outputs carry
     no declaration, so the arm is structurally unable to fire on them. `ASCII_BOX_GLYPH_RE` and
     `ASCII_BOX_UNCONDITIONAL_RE` stay byte-identical. No free-text fork heuristic is added: no new regex over
     `output_text` beyond the last-line declaration parser.
   - Acceptance:
     - `replay-card-fire.cjs --surface both --baseline compare` reports 0 verdict-class diffs, false_blocks = 0
       and new_misses = 0 against 357's post-phase baseline.
     - A tripwire test asserts both regex literals are byte-identical.
     - A tripwire test asserts that `classifyCardFire` reads `output_text` only through the existing helpers
       plus `parseForkDeclaration`.

6. **Declared-variant fixtures (the arm works)**: every prose fork from R1 is caught once it carries a
   declaration.
   - Current: none.
   - Target: for each `prose_fork: true` entry, the replay derives a declared variant (the same output plus a
     declaration line built from `fork_labels`). For each non-fork control, it derives a no-declaration
     variant. The replay reports `declared_catch_rate` and `control_false_blocks`.
   - Acceptance: `declared_catch_rate` = 100%, excluding yes/no-shaped label pairs, which are reported
     separately as `gate-is-simple-binary`. `control_false_blocks` = 0. `missed_forks` on the declared
     variants = 0.

7. **Tri-Polar parity**: Desktop/Cowork get the same verdict and a usable card payload.
   - Current: the MCP `stop_gate_check` shares the classifier, but has no declared-fork input.
   - Target: `handleStopEvent` passes the declaration fields through. On a `declared-fork-no-card` verdict,
     the returned `gate_render` payload carries the declared labels as its options.
   - Acceptance:
     - CLI and MCP verdict classes are identical on every R5 and R6 entry (MCP dedup excluded, as in 357 R5).
     - A test asserts that the MCP fire payload's option labels equal `declared_labels`.

8. **Larry declaration rule (prose, byte-capped)**: Larry is told to emit the declaration whenever he poses a
   fork in prose.
   - Current: `agents/larry-extended.md` "## Decision Gates" and the SKILL card span (about :216) say "fire the
     card on a genuine fork". Both are shrunk by 357 R6.
   - Target: both spans gain one rule: when a turn poses a navigator fork, fire the card. If for any reason the
     turn ends in prose, the last line is the fork declaration. The session-start `NAVIGATION CARD-FIRE
     CONTRACT` doctrine gains the same one-line rule. The MCP server instructions on hookless surfaces gain it
     too.
   - Acceptance:
     - The total bytes added across all surfaces is at most 400 B, measured against the post-357 files.
     - The 357 R-B pinned phrases survive: `## Decision Gates`, `no card, no picture (SEED-021)` and
       `AskUserQuestion`.
     - `tests/test-larry-voice-mark-182.cjs`, `tests/test-205-voice-mark-hybrid.cjs` and
       `tests/test-larry-handoff-seam.cjs` stay green.
     - `data/harness-manifest.json` is regenerated, so the pre-commit drift guard passes.

9. **Forward adoption measurement**: the declaration actually cuts missed forks on fresh output. This is not
   provable on historic text.
   - Current: no forward measure exists. Historic corpus text can never carry a declaration, so R5 and R6
     cannot show adoption.
   - Target: a dev-time script runs a fixed synthetic scenario set through headless Claude Code with the local
     plugin loaded:
     - 10 or more fork-eliciting scenarios and 10 or more non-fork control scenarios.
     - Authored text only. No user or dogfood text.
     - 3 runs each, both before and after the R8 prose change.

     A scenario turn counts as a forward missed fork when it poses a fork (judged by the scenario's own
     authored label, never at runtime) and it carries neither a fired card nor a declaration. The script is
     dev-only: it lives under `scripts/`, is never imported by `lib/` or `hooks/`, and is not part of CI.
   - Acceptance:
     - After the change, forward missed forks are at most 50% of the before count.
     - Control scenarios produce 0 `declared-fork-no-card` blocks across all post runs.
     - Both counts are recorded in the SUMMARY.
     - If the 50% bar fails, the phase records the declaration approach as falsified and opens a follow-on.
       R3 to R7 still ship, because they are inert without a declaration. R8 is reverted.

10. **Standing gate**: the declared arm and the missed-fork metric become permanent regression checks.
    - Current: none for this arm.
    - Target: the R1 fixtures, the R4 legs, the R5 inertness replay and the R6 declared-variant replay run
      inside `tests/run-all-359.sh` and the existing card-fire suite runner (the same runner 357 R7 wired).
    - Acceptance: two deliberate mutations each make the suite fail. The first removes the declared arm. The
      second adds any free-text fork regex that flips a control entry to block.

## Boundaries

**In scope:**
- The `prose_fork` / `fork_labels` label dimension, and the synthetic prose-fork + control fixture file
- The `missed_forks`, `declared_catch_rate` and `control_false_blocks` replay metrics, and the pre-359 baseline
- The fork declaration grammar module and its pure parser
- The declared-fork arm in `classifyCardFire`, with `deriveTurnSignals` threading
- MCP `stop_gate_check` passthrough, and a gate_render payload built from the declared labels
- The byte-capped declaration rule in the 2 Larry card spans, the session-start card-fire doctrine and the MCP
  server instructions
- The dev-only forward scenario run (pre/post)
- `tests/run-all-359.sh`, plus the card-fire suite wiring

**Out of scope:**
- Any runtime or hook Jev call, and any user or dogfood text to Jev. Barred by the 2026-09-17 rulings.
- Detecting forks from free prose with regex, token overlap or a classifier. This is the retired
  numbered-prose false-block class (about 86% false positive), and R5 tripwires it.
- Using the black-square voice glyph as the fork declaration. It names the teaching move, not the fork (381 of
  435 card turns opened with another glyph or none), and changing that would rewrite Part 12 voice doctrine.
- 357's own false-block fixes (D-07 harness source, D-08a F.1 chrome tokens) and its corpus, harness and
  labeler. 359 consumes them and does not rebuild them.
- 360's room-bind picker on harness turns. That is a separate hook (UserPromptSubmit).
- When Desktop/Cowork Larry calls `stop_gate_check` (today it skips chat-only turns). A prose fork on a
  hookless chat-only turn stays uncaught. This is recorded as a residual. Only verdict parity is in scope.
- intent-classifier minting of stale or unrelated F.1 reaches. This is the upstream cause 357 names.
- The other 13 Larry per-turn judgments (glyph, dial, problem type, elevation and so on).
- The user-level copy `~/.claude/agents/larry-extended.md`.

## Constraints

- **Sequencing:** execution waits for Phase 357 to complete (corpus, harness, labeler, D-06 labels and R6 prose
  shrink all on disk). R8's byte cap is measured against the post-357 files.
- **Runtime:** pure local CJS, zero network calls, no new file dependency, never throws. When no declaration is
  present, behavior is today's code (R5).
- **Part 8:** declared labels are this turn's own output, read locally by the hook. They never cross to Jev or
  Brain. Only the authored synthetic fixtures (R1) and scenarios (R9) may go to the dev-time Jev labeler, and
  only through 357's shared egress profile.
- **CR-06:** the block `reason` and `systemMessage` stay calm and human-safe. No internal slug and no
  model-directive text reaches the user. The new reason slug lives only in the local intercept log.
- **Canon Part 11 R15:** a genuine fork still gets a card. PRIMARY and BACKSTOP behavior is unchanged.
- **Canon Part 12 voice:** the declaration line adds no De Stijl glyph, and each turn keeps exactly one voice
  mark.
- **UX:** at most 1 visible line. It must read as plain navigator-facing text if it is not hidden. It must not
  look like an ASCII gate box (SEED-021).
- **Parallel sessions:** commit by explicit path only. Do not touch unowned diffs. New phase-dir files need
  `git add -f`.
- **No em-dashes** in any file this phase writes.

## Acceptance Criteria

- [ ] `prose-forks-359.json` exists with 15 or more prose forks and 15 or more controls. Every
      `prose_fork: true` entry has 2 or more `fork_labels`. The loader test passes.
- [ ] The pre-359 replay reports `missed_forks` equal to the count of no-card `prose_fork: true` entries, and
      the number is recorded
- [ ] `parseForkDeclaration` unit tests pass for all valid and invalid cases in R3, with no throw on bad input
- [ ] The R4 legs pass: declared + no card -> `declared-fork-no-card`; declared + card -> `card-fired`;
      yes/no -> `gate-is-simple-binary`; both ceilings -> degrade
- [ ] The 357 corpus replay (`--surface both --baseline compare`) shows 0 verdict-class diffs,
      false_blocks = 0 and new_misses = 0
- [ ] `ASCII_BOX_GLYPH_RE` and `ASCII_BOX_UNCONDITIONAL_RE` are byte-identical (tripwire passes)
- [ ] `declared_catch_rate` = 100% (excluding yes/no pairs) and `control_false_blocks` = 0
- [ ] CLI and MCP verdict classes are identical on every R5 and R6 entry. The MCP fire payload's options equal
      `declared_labels`.
- [ ] The Larry prose, session-start doctrine and MCP instructions add at most 400 B in total. The pinned
      phrases survive, and the voice-mark and handoff tests are green. The harness manifest is regenerated.
- [ ] Forward run: post-change missed forks are at most 50% of pre-change, and control blocks = 0, OR the
      falsification outcome is recorded with R8 reverted and a follow-on opened
- [ ] Removing the declared arm fails the standing suite. Adding a free-text fork regex fails the standing
      suite.
- [ ] `grep -r api.typesafe.ai lib/ hooks/` is empty, and the R9 script is not imported from `lib/` or
      `hooks/`

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                                                       |
|--------------------|-------|------|--------|---------------------------------------------------------------------------------------------|
| Goal Clarity       | 0.85  | 0.75 | ✓      | Three measured bars: inertness 0/0, declared catch 100%, forward misses cut by at least half |
| Boundary Clarity   | 0.85  | 0.70 | ✓      | Free-text detection, glyph-as-declaration, runtime Jev, 357 fixes and 360 all explicitly out |
| Constraint Clarity | 0.75  | 0.65 | ✓      | The R9 forward run is nondeterministic (3 runs, authored scenarios); declaration prefix and hidden-vs-visible left to discuss |
| Acceptance Criteria| 0.80  | 0.70 | ✓      | 12 pass/fail checks; R9 has an explicit falsification branch instead of a vague "improves"  |
| **Ambiguity**      | 0.18  | <=0.20 | ✓    | 1 - (0.35x0.85 + 0.25x0.85 + 0.20x0.75 + 0.20x0.80)                                           |

Status: ✓ = met minimum. No dimension is below minimum.

## Interview Log

| Round | Perspective     | Question summary | Decision locked |
|-------|-----------------|------------------|-----------------|
| 1 | Researcher | What exists today for a prose fork? | Nothing: PRIMARY needs a registry surface, BACKSTOP needs a bracket box, and the numbered-prose arm was retired at about 86% false positive. intern-w1 names free prose as the open gap. 357 records it as `known_miss`. |
| 1 | Researcher | Is the 357 instrument on disk? | No. 357 has not executed, so 359 is sequenced after it (Constraint). |
| 2 | Researcher | Does Larry already emit a usable marker? | Measured locally, count-only: the black-square gate glyph leads 137 of 2771 turns, 83 of them with no card, and 381 of 435 card turns lead with another glyph. [auto] The glyph is NOT the declaration: it names the teaching move, not the fork, and changing that rewrites Part 12. |
| 2 | Simplifier | Hook guesses from prose, or model declares? | [auto] The model declares and the hook checks deterministically. Reason: any text guesser re-enters the retired false-block class. A declaration makes the new arm structurally inert on every historic output (R5), so 0 new false blocks holds by construction, not by tuning. |
| 3 | Boundary Keeper | Do relevance and already-answered apply to a declared fork? | [auto] No. The declaration is Larry's own assertion, made this turn, that the fork is live, so there is no stale subject. Yes/no-shaped declarations still pass (keeping the 2026-07-05 simple-binary ruling). Both ceilings still apply (loop safety). |
| 3 | Boundary Keeper | Desktop/Cowork? | [auto] Verdict parity plus a gate_render payload from the declared labels are in. When hookless Larry calls `stop_gate_check` is out, recorded as a residual. |
| 4 | Failure Analyst | Can the 357 corpus prove the fix works? | [auto] No, and the spec says so. Historic text never carries a declaration, so the corpus proves inertness (R5), declared variants prove the arm (R6), and only a forward scenario run proves adoption (R9). |
| 4 | Failure Analyst | What if Larry decays on the declaration exactly like he decays on the card? | [auto] R9 is the falsification test: the bar is at least 50% fewer forward misses and 0 control blocks. On failure, R8 is reverted, R3 to R7 ship inert, and a follow-on opens. That is a legal outcome. |
| 5 | Seed Closer | Prose cost vs 357's 50% shrink? | [auto] The cap is 400 B added across all surfaces, measured after 357, and the 357 R-B pinned phrases must survive. |
| 5 | Seed Closer | Declaration syntax? | [auto] Constraints are locked (last line, fixed ASCII prefix, 2 to 5 labels, 80-character cap, no De Stijl glyph, cannot match the box regex, at most 1 visible line). The exact prefix and hidden-vs-visible go to discuss-phase. |

---

*Phase: 359-missed-fork-detection-larry-poses-a-genuine-decision-in-pros*
*Spec created: 2026-09-23*
*Next step: /gsd-discuss-phase 359 - implementation decisions (declaration prefix and visibility, parser
module location, forward-run harness shape)*
