# Phase 357: Gate-triad replay harness (Jev as dev-time teacher, deterministic code at runtime) - Specification

**Created:** 2026-09-23
**Ambiguity score:** 0.155 (gate: <= 0.20)
**Requirements:** 7 locked

> Title note: the ROADMAP title still says "ledger". Round 2 locked "no runtime ledger". The phase keeps its
> number and slug. The goal below supersedes the ROADMAP goal line and 357-BRIEF.md where they conflict.

## Goal

Replaying a labeled corpus of Stop events through the real CLI path (`deriveTurnSignals` -> `classifyCardFire`)
gives **0 false blocks** and **0 new missed forks** against today's baseline. Runtime stays pure local
deterministic code. Jev is used only at dev time, to label the synthetic and sanitized cases. Larry's gate prose
shrinks only after that bar is met.

## Background

- **The gate itself:** the Stop-hook card gate is `scripts/check-card-fire.cjs`. `classifyCardFire` (:523)
  runs roughly 11 ordered checks. The MCP `stop_gate_check` (Desktop/Cowork) runs the same classifier through
  `lib/mcp/stop-gate-handler.cjs:464,489`, plus an in-memory dedup.
- **Structural rules already cover most of the 10 resolved debug cases.** These are deterministic rules that
  do not depend on reading meaning: card-fired, corroboration by the side channel, gate existence, the
  `tool_result` source, record consumption, and the retry and session ceilings.
- **What remains is guessing done by regex and token overlap** in `lib/core/gate-relevance.cjs`:
  - `gateTopicallyRelevant` (:309) decides relevance by any shared token of 4+ characters, or a prefix match.
  - `gateAlreadyAnswered` (:267) decides "already answered" from an exact label, an ordinal, or a yes/no token.
  - `extractOptionLabels` / `isYesNoShapedGate` (:200, :238) decide the shape of the options.
- **Live observation, 2026-09-23** (`~/.mindrian/card-fire-intercepts.log`, session 56924067):
  - The verdict was `reached-registry-gate-no-card`, with an EMPTY `gate_signature`.
  - `ran_entries` was `[scripts/intent-classifier.cjs]`.
  - The output contained no options and no question. It was force-blocked by an unrelated F.1 reach (a fleet
    census) that the intent-classifier had minted that turn.
- **Why a runtime lookup table was rejected (round 1):** a closed 320-row feature table
  (arm x freshness x relevance-bucket x answer-match x label-shape) cannot separate the cases that depend on
  the text:
  - a benign numbered list vs a real fork
  - a fork written in prose with 0 extracted labels (intern-w1)
  - relevance expressed through paraphrase

  Jev spike 004 showed Jev matches the code once the rule is stated, not that it beats it. So Jev's value is
  labeling, not serving answers at runtime.
- **Existing assets to reuse:**
  - `tests/fixtures/card-fire-corpus-238.json`: 14 sanitized entries.
  - The direct-field envelope seam that `deriveTurnSignals` already accepts:
    - `ran_entries`
    - `output_text`
    - `preceding_user_text` and `preceding_user_text_source`
    - `gate_subject_text`
    - `reach_corroborated`
    - `sidechannel_health`
  - About 8 card-fire test files.
- **Rulings that bound this phase (2026-09-17, unchanged):**
  - Zero user text goes to Jev.
  - Jev never runs in a hook, and users carry no key.
  - Jev is never the egress guard.
- **Coordination (jsagi-a7, 2026-09-23):** one shared dev-time Jev client and one egress allow-list, shared by
  353 / 354-17 / 356 / 357.

## Requirements

1. **Replay corpus**: a single, versioned corpus of Stop-event envelopes, each labeled with its expected verdict.
   - Current: 14 entries in `card-fire-corpus-238.json`, with expected_fire only. The debug cases live as
     scattered test legs. Today's false block exists only in the intercept log.
   - Target: `tests/fixtures/card-fire-replay/` holds four sources:
     - (a) the 14 entries of the 238 corpus, migrated
     - (b) at least 1 envelope per each of the 10 resolved debug cases that `check-card-fire` owns. The files
       are backstop-benign-list, answered-gate-refires, block-surface, over-enforcement, relevance-check-gap,
       stale-f1-reach, option-shaped-prose, room-bind-notification, intern-w1 and reach-gate-stale-turn-input.
       reach-gate-stale-turn-input is intent-classifier-owned; record it only as a routed-in case.
     - (c) the 2026-09-23 no-fork false block
     - (d) at least 20 dogfood Stop events drawn from Jonathan's own dev-session transcripts

     Each entry records `source`, `expected_verdict_class` (block or pass), `label_origin` (jev, local or
     human) and `why`.
   - Acceptance: a loader test asserts all four sources are present, at least 45 entries in total, every entry
     has the 4 fields, and every entry has a `sanitization_statement` in meta.

2. **Replay harness**: one command replays the whole corpus through the real classifier and reports the metrics.
   - Current: no single replay. The tests assert individual legs.
   - Target: `node scripts/replay-card-fire.cjs [--json]` feeds each envelope to `deriveTurnSignals` then
     `classifyCardFire`, with no mocks of either. It prints the false-block count, the missed-fork count, the
     known-miss count and a per-entry diff. It makes no network call.
   - Acceptance:
     - Running it against the pre-phase commit reproduces today's false block as a FALSE_BLOCK.
     - The exit code is non-zero when false_blocks > 0 or new_misses > 0.
     - A test asserts both of those behaviors.

3. **Dev-time Jev labeling (teacher, Part 8 clean)**: Jev labels only the synthetic and sanitized entries.
   - Current: no labels exist beyond hand-set expected_fire.
   - Target: a dev-only labeler under `scripts/` (never `lib/`, never `hooks/`) asks independent Nouls:
     is-fork, already-answered and relevant, with the policy stated in each question. It asks them only for
     sources (a), (b) and (c). It uses the shared Jev client and egress allow-list (no forked guard).
     - Source (d) is never sent. It is labeled locally and reviewed by the navigator: `label_origin: local`,
       then `human` once confirmed.
     - A Jev label that disagrees with the hand label is surfaced for navigator ruling. It is never
       auto-applied.
   - Acceptance:
     - A test asserts the labeler refuses any entry whose source is dogfood.
     - `tests/test-353-tripwires.cjs` stays green.
     - `grep api.typesafe.ai lib/ hooks/` returns nothing.
     - The labeler runs keyless (degrades to "unlabeled") with exit 0.

4. **Deterministic runtime fix**: `check-card-fire` / `gate-relevance` change only as far as needed to meet the
   bar, using pure local code with no ledger file.
   - Current: the primary arm blocks on a reached registry gate even when the output has 0 option labels, no
     question and an empty gate_signature (the 2026-09-23 case).
   - Target: all false blocks in the corpus become pass. Every entry that blocks today and is labeled `block`
     still blocks.
   - Acceptance: the replay reports false_blocks = 0 and new_misses = 0. Text-dependent forks with 0
     extractable labels (intern-w1 prose fork) are allowed as `known_miss` entries, listed by id.

5. **Tri-Polar parity**: the MCP `stop_gate_check` path gets the same verdicts as the CLI hook.
   - Current: shared classifier, plus MCP-only dedup.
   - Target: the replay harness has a `--surface mcp` mode that routes through `handleStopEvent`.
   - Acceptance: CLI and MCP verdict classes are identical on every corpus entry, ignoring the
     dedup-already-fired outcome, which only MCP can produce.

6. **Metric-gated Larry prose shrink**: the card-rule prose shrinks only after R4 passes.
   - Current:
     - `agents/larry-extended.md` "Decision Gates -- fire the card" (:84-91) is 1751 B.
     - `skills/larry-personality/SKILL.md` has :216 (479 B) and :244 (606 B).
   - Target: those three spans shrink to a short rule deferring to the code verdict, while preserving the
     SEED-021 rules: never draw an ASCII box, fire the card on a genuine fork. The before/after byte delta is
     recorded in the SUMMARY.
   - Acceptance:
     - The combined bytes of the three spans fall by at least 50%.
     - The existing voice, card and handoff tests stay green (including `tests/test-larry-handoff-seam.cjs`).
     - If R4 does not pass, R6 is skipped and the reason is recorded. That is a legal outcome, not a phase
       failure.

7. **Regression permanence**: the replay becomes a standing gate.
   - Current: none.
   - Target: the replay runs inside the existing card-fire test suite (and `bash tests/run-all-357.sh`), so any
     future edit to `check-card-fire` / `gate-relevance` that reintroduces a false block fails CI.
   - Acceptance: a deliberately reverted R4 fix makes the suite fail.

## Boundaries

**In scope:**
- The replay corpus (4 sources) and its loader test
- `scripts/replay-card-fire.cjs` (CLI and MCP surfaces)
- The dev-only Jev labeler for synthetic and sanitized entries, on the shared client and allow-list
- The minimal deterministic fix in `check-card-fire.cjs` / `gate-relevance.cjs` needed to meet the bar
- The metric-gated shrink of the 3 card-rule prose spans
- Adding the replay to the standing test suite

**Out of scope:**
- A runtime Jev-scored ledger / `data/gate-triad-ledger.json`. Rejected in round 2; the text-dependent cases
  are not separable by closed features.
- Any runtime or hook Jev call. Barred by the 2026-09-17 rulings.
- Sending dogfood or any user text to Jev. Round 2 ruling: local labels only.
- The other 13 Larry per-turn judgments (glyph, dial, problem type, elevation, and so on). Candidate
  follow-on phases.
- Catching prose forks that have 0 extractable labels. These need text understanding, so they are recorded as
  known misses.
- intent-classifier's minting of stale or unrelated F.1 reaches (the upstream cause). Cover it in the corpus;
  fix it only if the minimal card-fire fix can't absorb it (then split it out).
- The session-bind room-picker gate's firing policy (`scripts/session-start` / the UserPromptSubmit
  room-bind). This is a separate surface.
- Extracting the shared Jev client, if 354-17 or 356 executes first. Import it; don't rebuild it.

## Constraints

- The runtime is pure local CJS with zero network calls and no new file dependency. The fallback is the
  behavior of today's code.
- Part 8: only sources (a), (b) and (c) may cross to Jev, and only through the shared egress allow-list.
  Source (d) never leaves the machine.
- Jev questions are independent Nouls with the policy stated in each (spike 004 lesson). The three Nouls are
  never compared against each other (355-BRIEF: Noul and Choice are not comparable).
- Execution waits until Phase 354 finishes. Files 354 is executing (`brain-router.cjs`, `write-lock.cjs`,
  `part8-egress-guard.cjs`, `doctor.cjs`, `graph-ops.cjs`) are not edited. `part8-egress-guard` is read only.
- Tri-Polar: the CLI hook and the MCP `stop_gate_check` must agree (R5).
- The Canon Part 11 R15 render-coverage contract is unchanged: a genuine fork still gets a card.
- Dev-session transcripts are Jonathan's own. Sanitize them before they are committed to the repo (no real
  names of third parties, per the no-real-names rule).

## Acceptance Criteria

- [ ] The replay corpus has at least 45 entries across all 4 sources, and the loader test passes
- [ ] The replay on the pre-phase code flags the 2026-09-23 no-fork turn as FALSE_BLOCK
- [ ] The replay on the post-phase code reports false_blocks = 0
- [ ] The replay on the post-phase code reports new_misses = 0 against the pre-phase baseline
- [ ] The known misses are listed by id, and each carries a text-dependence reason
- [ ] The labeler refuses dogfood entries (test), and runs keyless with exit 0
- [ ] `grep -r api.typesafe.ai lib/ hooks/` is empty, and `tests/test-353-tripwires.cjs` passes
- [ ] The CLI and MCP replay verdict classes are identical on every entry (excluding MCP dedup)
- [ ] Reverting the R4 fix makes the standing suite fail
- [ ] Either the 3 prose spans shrink by at least 50% with the voice, card and handoff tests green, or the skip
      reason is recorded because R4 did not pass

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                        |
|--------------------|-------|------|--------|--------------------------------------------------------------|
| Goal Clarity       | 0.90  | 0.75 | ✓      | Measured e2e bar, 0/0                                        |
| Boundary Clarity   | 0.80  | 0.70 | ✓      | Ledger, runtime Jev and dogfood egress explicitly out        |
| Constraint Clarity | 0.85  | 0.65 | ✓      | Rulings, 354 sequencing, shared client                       |
| Acceptance Criteria| 0.80  | 0.70 | ✓      | 10 pass/fail checks; the dogfood count (>=20) is a floor, not a tuned number |
| **Ambiguity**      | 0.155 | <=0.20 | ✓    |                                                              |

## Interview Log

| Round | Perspective          | Question summary                                   | Decision locked                                                          |
|-------|----------------------|----------------------------------------------------|--------------------------------------------------------------------------|
| 1     | Researcher           | Scout: can a closed feature table fix the bugs?    | No: 320 rows can't separate text-dependent cases; most bugs are already structural |
| 1     | Researcher           | E2E goal shape?                                    | Navigator asked for "most token-effective and deterministic"             |
| 1     | Researcher           | Corpus sources?                                    | All 4: 238 corpus, 10 debug fixtures, today's block, dogfood             |
| 1     | Simplifier           | Keep prose shrink?                                 | Yes, gated on the metric                                                 |
| 2     | Simplifier           | Path lock                                          | Replay harness + Jev as dev-time teacher + deterministic runtime; no ledger |
| 2     | Boundary Keeper      | Dogfood vs the zero-user-text ruling               | Local labels only; the ruling is untouched                               |
| 2     | Failure Analyst      | Pass bar                                           | 0 false blocks, 0 new misses; text-only forks are known misses           |

---

*Phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re*
*Spec created: 2026-09-23*
*Next step: /gsd-discuss-phase 357 - implementation decisions (fixture format, the minimal fix's shape, labeler
question wording)*

## Amendments (navigator, 2026-09-23, post-research)

- R4 bar: `known_false_block` entries (text-dependent, labeled at the D-06 checkpoint) are excluded from the
  0-false-block count. See 357-CONTEXT R-C.
- R6: the shrink set is the two real card spans only (2230 B, 50% target is <=1115 B). SKILL :244 is out.
  See R-B.
- R3 labeler, R2 harness, R5 parity: follow 357-CONTEXT R-G, R-H and R-I.
