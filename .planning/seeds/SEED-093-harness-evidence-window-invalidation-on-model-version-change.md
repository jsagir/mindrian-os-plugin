---
id: SEED-093
status: dormant
planted: 2026-09-08
planted_during: "Phase 298 (SEED-032: Harness-as-Code), wave 1 execution"
trigger_when: "when the Claude model or version behind Larry changes on any surface (a new default model in Claude Code, Desktop, or Cowork; a plugin release that pins a different model); or when 298-08's evaluatePromotion first reads an evidence window that spans a model change; or when SEED-085 (EvoHarness) is scoped, since a learned harness needs the same invalidation"
scope: small
---

# SEED-093: A harness policy's evidence log is fitted to one model version; invalidate or partition the promotion window when the model behind Larry changes

## Why This Matters

Phase 298 ships an append-only evidence log per policy (D-04, JSONL under MINDRIAN_HOME) and
a promotion_rule read over a window of runs (window_runs, max_false_positive_rate,
min_true_positives). A human reads that window before editing a policy's rung. The window is
implicitly assumed to describe ONE model's behavior.

It does not have to. If the model behind Larry changes mid-window (Claude Code updates its
default, a user switches surfaces, a release pins a new model), the rows before and after the
change measure two different systems. A rule that failed under the old model may hold under
the new one, or the reverse. A promotion decision read across the seam is a decision about a
model that no longer answers.

The navigator-supplied "Nine Techniques" reference (2026-09-08) states the general form of
this in its prompt-optimization section: an optimized prompt is fitted to a specific model
version, and the optimizer must be re-run when the model updates; a tuned prompt is never
portable. MindrianOS's persona surfaces are optimized prompts in exactly that sense, and the
298 contract-parity checks (298-13: the frozen-phrase set, the 1,950-byte served budget) pin
the prompt bytes but say nothing about the model those bytes were tuned against.

Nothing in lib/ today records which model produced a given turn (a grep for model-version
handles in lib/core/*.cjs and lib/hmi/*.cjs finds only the pitch-feedback and skillopt
schemas, neither of which the harness reads). So the seam is invisible in the log.

## When to Surface

**Trigger:** see frontmatter. The cheapest moment is when 298-08's evaluatePromotion is first
used in anger on a real window; the seam question will come up on its own then.

## Scope Estimate

**Small**: (1) stamp each evidence-log row with the model identifier the Stop hook can read
from its stdin envelope or session metadata, if the host exposes one (verify against the
Claude Code hook contract via the claude-api skill / claude-code-guide before assuming the
field exists; if no host exposes it, record "unknown" and say so in the doctor line); (2)
make evaluatePromotion partition the window by that stamp and refuse to promote across a
seam, or require window_runs to be satisfied within the newest partition alone; (3) one
doctor-module line naming the active partition. No new policy, no new shape, no Brain wire.

## Breadcrumbs

- lib/hmi/voice-style-log.cjs (298-07/08): appendVoiceStyleRow, readVoiceStyleRows, evaluatePromotion, the window this seed partitions
- lib/core/doctor/voice-style-log-module.cjs (298-08): the never-warn doctor line that would report the partition
- data/harness-policies/_schema.json (298-09): promotion_rule keys window_runs / max_false_positive_rate / min_true_positives
- scripts/build-harness-manifest.cjs runContractChecks (298-13): pins prompt bytes, not model identity
- scripts/check-voice-style.cjs (298-07): the Stop hook whose stdin envelope is the only place a model id could be read
- .planning/seeds/SEED-085-evoharness-rl-cost-aware-learned-harness-access.md: a learned harness inherits the same invalidation need
- .planning/phases/298-.../298-CONTEXT.md D-04 / D-04a: the evidence-log decision and the statusline-chip proposal

## Notes

Captured during Phase 298 wave 1 from a Larry review of the navigator-supplied "Nine
Techniques to Master Modern AI Systems" reference. Sibling seed: SEED-092 (grounding-grader
harness policy). The langtalks corpus has no entry for DSPy or prompt-optimization-as-search
yet; the "fitted to a model version" claim is the reference's, relayed here, not corpus-grounded.
