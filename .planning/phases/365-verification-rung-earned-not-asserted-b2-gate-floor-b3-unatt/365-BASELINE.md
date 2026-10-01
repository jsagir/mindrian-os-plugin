# Phase 365 Baseline

## What this file is

The human-readable baseline for Phase 365, written before any product code changes. It says what the acceptance tests and the property falsification tests measured at the phase base, and it holds the one test that needs people instead of code.

The machine records live elsewhere and are the source of truth for the numbers:

- `tests/fixtures/365-pre-phase.json` - what was observed at the phase base (never edited).
- `tests/fixtures/365-baseline-red.json` - the red list: which acceptance legs fail today, by token, and which plan heals each.
- `tests/fixtures/365-falsification-record.json` - the recorded outcome of each falsification test below, with the sha it was recorded at.

## Base

The falsification records were taken at `2ec0e555a7118b32d6751484065741ebdef11951` (the head before plan 365-03 made any edit). The acceptance red list carries its own base sha; plan 365-02 owns those numbers.

## Acceptance tests

Run first, expected to fail today. One line each, pointing at the red list (plan 365-02 owns the tokens):

1. Byte test: two claims with identical text, one checked against a located primary source, one by asking a model. Red tokens `RED-365-BYTE` (healed by 365-04) and `RED-365-BYTE-DERIVED` (healed by 365.1).
2. One-week test: approve a model-checked claim, later ask the room what it was checked against. Red tokens `RED-365-ONEWEEK-STATUS` (365-08) and `RED-365-ONEWEEK-STANDING` (365-15).
3. Floor test: floor at rung 3, approve a rung-2 claim. Red tokens `RED-365-FLOOR` and `RED-365-FLOOR-NOTICE` (both 365-08).

## Falsification tests

These are characterization tests. Each one passes while today's behavior matches the record and fails with `RECORD MISMATCH` if the behavior flips. Writing the record needs the explicit flag `RECORD_365_FALSIFICATION=1`, so a flip is never silently accepted. None of them sits in the red list, because none is a defect this phase fixes.

| # | Property in one line | Predicted | Observed | Code driven | File |
|---|----------------------|-----------|----------|-------------|------|
| 1 | Two navigators, same framework, same room: do the frames diverge as far as two unguided prompts? | not predicted | MANUAL / NOT RUN | people, see the protocol below | none (manual) |
| 2 | Remove the destination (governing thought and active JTBD): does next-move confidence stay unchanged? | UNKNOWN (characterization) | `no_confidence_emitted`; the active JTBD alone changes the top suggestion (a `jtbd_changed` reach appears), the governing thought alone changes nothing | the real `suggest_next` handler over `dispatchSensors` | `tests/test-365-falsify-destination.cjs` |
| 3 | The missing five: claims cover items 1-4 and 6-7 of a continuous seven-item set; does any gap scan name item 5? | FALSIFIED | FALSIFIED (as predicted): no scan names the missing day | `findUnsupportedClaims`, the research preflight `evidence_gaps`, `scripts/analyze-room` gap lines | `tests/test-365-falsify-missing-five.cjs` |
| 4 | Ask the room how it knows | same as acceptance test 2 | see acceptance test 2 (the one-week test) | `tests/test-365-acceptance-one-week.cjs` | `tests/test-365-acceptance-one-week.cjs` |
| 5 | Contradiction without shared wording: do the writers that create CONTRADICTS edges record it? | FALSIFIED | FALSIFIED (as predicted): zero CONTRADICT lines, zero CONTRADICTS edges on the real pair; the positive control produced one of each | `scripts/analyze-room` Sections 3 and 3b; `lib/core/graph-backfill.cjs` CUE_MAP through `graph-derivation.runDerivation` | `tests/test-365-falsify-contradiction.cjs` |

Notes on what each measured:

- Test 2. The tool emits no numeric confidence or score field at all, so "does confidence stay unchanged" has no value to compare. What does change: setting a JTBD makes the top suggestion a `context_block` reach with signal `jtbd_changed` (the sensor that notices a JTBD set or change). Without a JTBD there is no suggestion for the same question. The governing thought, written into every section's MINTO.md, moves nothing in `suggest_next`. So the destination is partly an input (the JTBD triggers a notice) and partly decoration (the governing thought is not read by this path).
- Test 3. The scans report claims that lack support (six here, one per day that was written down). They cannot report a day nobody wrote. That is the "gap scans map the record, not the world" prediction, now measured. `analyze-room` reported only empty-section gaps.
- Test 4 is acceptance test 2. It is not run separately; the one-week test is its single home.
- Test 5. `findContradictions` only reads edges that already exist, so the test drives the lexical writers instead. The pair was "The first units ship in March 2027." and "Nothing leaves the factory before 2029." Both writers stayed silent. A separate positive control room, where one text uses the cue word "contradicts", made both writers fire, which proves the zero on the real pair is not vacuous. Writers not driven: the graph-derivation LLM or score producer (the one that could pass this property; it needs a live model or the local encoder and the spec forbids a model grading these properties) and the writers that only record a contradiction someone already named (findings-wirer, reified-claim, unknowns verdict, the workflow reconcile and memory-cascade adapters, the temporal supersession gate, research-planner filing, typed-frame, close-loop-writer).

## Test 1 protocol (manual)

Status: NOT RUN. Owner: the navigator, together with the paper author (roles only). Out of scope for automation: it needs two people and a judgment that no script and no model may make.

What it asks: when two navigators use the same framework on the same room, do their frames end up as far apart as two unguided prompts would? If the framework really shapes the thinking, the two framed questions should be closer to each other than the two unguided prompts are.

Steps:

1. Use two navigators, the same framework command, and one copy of the same fixture room for each (identical content, separate copies).
2. Run the two sessions separately. Neither navigator sees the other's session.
3. Each navigator records the governing question and the frame they end with.
4. Each navigator then does a third run in a plain chat window with a notebook, no framework, on the same starting problem. This is the unguided comparison.
5. The two navigators and the paper author judge divergence together, against a rubric written before any run starts. The rubric compares the distance between the two framed questions with the distance between the two unguided prompts.
6. Record the rubric, the four artifacts (two framed, two unguided) and the verdict in this file under a dated heading. Do not overwrite this protocol.

The rubric is written first, on purpose: a rubric written after seeing the outputs can be bent to fit them.

## What a falsified property means here

A predicted failure is a finding, not a defect this phase fixes. Tests 3 and 5 are predicted to fail and do. This phase builds no repair for them, because the work that would address them (B4) is blocked on the ratified ladder. They are recorded, not hidden, so that nobody later mistakes them for reds that Phase 365 is meant to heal. If a recorded outcome flips in a later phase (for example a contradiction writer starts catching the no-shared-wording pair), the test fails with `RECORD MISMATCH`, and the navigator decides whether to update the record.
