---
id: SEED-123
title: "Doctrine ruling 2026-10-05 (Lawrence, proposed): keep the persona, kill the turn gating; the Theo contract loses its anti-persona line; the canon echoes stay in both copies with a parity test"
status: filed (proposed; the navigator confirms through a gate)
priority: high
filed: 2026-10-05
source: Lawrence's reply of 2026-10-05 22:40 and 22:47 (pasted by the navigator; filed in mindrian-os-study as claim:artifact:6ef453a45355); re-measured on HEAD d30eb4592
promotes_to: Phase 369.6 (the Larry contract) for the code readers and the voice contract; a theo-context repo task for the contract line; a navigator gate for the prose deletion timing. Navigator ruling 2026-10-05: the plugin keeps theo-mcp as its default origin; theo-context is an experiment, not yet a replacement; no call path opens here
---

# SEED-123: persona stays, turn gating dies

## Measured

- theo-context (0.6.0, seven tools, 23,961 characters of instructions, measured by Lawrence on 2026-10-05) carries interaction doctrine at lines 19 ("give the best supported assessment before requesting more information"), 32 ("do not end with a question by default"), 34 ("no Ask-Tell dial, no turn-count rules, earned answers, fixed questioning-to-delivery stages, observation blocks or simulated two-pass engine"), 38 ("questions serve inquiry; they are not a conversational ritual"), the anti-persona clause at line 9 ("adopt useful review practices, not a human persona, credentials, repeated closers or claims about what Larry would approve"), Part 8 restated at line 56 and Part 9 at lines 40 and 153. It self-subordinates to the host's instruction hierarchy. The plugin never calls it: `lib/core/brain-client.cjs:41` and the one-element THEO_ORIGINS allowlist (`:2081` on HEAD).
- The plugin's engine arbitrates on persisted role_blend (`lib/core/arbitration.cjs:229-232, :334`; `lib/core/navigation-engine.cjs:1410`) and carries no turn-count gate in those two files. Turn counts ARE read in six loop-layer files (insight-sensors 38 hits, venture-shape-nudge 14, projections 7, jtbd-state 10, across-session-memory 7, calibration-log 5). The turn staging and the earned-frameworks rule live in prose: `agents/larry-extended.md:91, :95`; `skills/larry-personality/SKILL.md:38, :43, :45, :61, :181`.

## The ruling (Lawrence, proposed)

1. Keep the persona: Larry, the glyph, the reframe, the GUIDED default. Line 9 of the Theo contract is overruled and removed from theo-context (the navigator's repo), because the persona belongs to the plugin.
2. Kill the turn gating: lines 19, 32, 34 and 38 are adopted inbound into the plugin's voice contract; the turn-count staging ("Turns 2-5", "Turn 5+", "Turn 8+", "earn them after 2-3 exchanges", "when the user has earned Insight") leaves the agent body and the personality skill.
3. The canon echoes (Part 8 at line 56, Part 9 at 40 and 153) stay in both copies, with a test that compares the two texts so they cannot drift.

## What the orchestrator adds (measured)

- The prose deletion is two files and cheap; whether it ships in beta.61 or in 369.6 is the navigator's call at the next gate (it changes Larry's visible behavior in a cut that otherwise carries research changes).
- The six code readers of turn_count are not prose and are not all gating: the saturation sensor, the nudge threshold and the D3 investment gradient use the count as a signal. Removing a reader without a map repeats the reader-map mistake Lawrence's own amendment 2 warns about. 369.6 maps them (what each reads, what it gates, what replaces it) before any is removed.
- One corpus, two conclusions: the same 2026-10-05 LarrAI review audit is cited by theo-context's line 9 (against a persona) and by SEED-121 (for a Larry review spine). The parity test above should also pin which conclusion each surface carries, by name, so the contradiction stays visible until one is withdrawn.

## Ruling 2026-10-05 night (navigator, at the plan 369.2-12 checkpoint card)

The turn-staging prose deletion lands in Phase 369.6, not in beta.61. beta.61 (cut 2026-10-05, tag v2.0.0-beta.61 at 3aac790dc) keeps its ruled scope: 369.2 wave 1 plus the ICM walk tool. Everything else in this seed stays proposed until its own gate; the six code readers of turn_count are mapped in 369.6 before any is removed.
