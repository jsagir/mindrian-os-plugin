---
phase: 141
plan: 06
subsystem: per-turn-hot-path
tags: [retr-02, hot-path, conversation-seed, local-retrieval, canon-part-8, fence, d-03, d-03a]
requires:
  - 141-01 (tests/test-retrieval-seed.cjs RED + tests/test-room-context-part8-invariant.cjs)
  - 141-03 (getRoomContext + navigation.cjs getSessionHistory re-export -- the LOCAL seed consumer)
provides:
  - scripts/intent-classifier.cjs per-turn turn object carrying a real conversation seed (userText) on the LOCAL lane only
  - The conversation-to-retrieval loop fires per turn (insight seeds retrieval, not venture-state only)
affects:
  - The Navigation Engine turn now receives the last ~2 turns of prompt content; getRoomContext can seed retrieval from conversation
  - "do you remember X" mid-conversation is now seedable from the actual conversation
tech_stack:
  added: []
  patterns:
    - "windowed conversation seed (last ~2 fragments, char-capped) derived through the navigation chokepoint getSessionHistory"
    - "LOCAL-lane fence: seed rides the turn object into decide(), never into buildBrainPacket/brain-client (Canon Part 8 / D-03a)"
    - "seed derivation chained inside the existing 1200ms Promise.race envelope (no new blocking call, no budget widening)"
    - "defensive-default seed: any fault yields '' so the loop runs exactly as before"
key_files:
  created: []
  modified:
    - scripts/intent-classifier.cjs
decisions:
  - "Un-nulled userText by building the turn object AFTER roomDb opens, so the seed derives from the already-open caller-owned handle through the chokepoint -- no second db open"
  - "Seed window = last 2 fragments of the most recent session, each capped at 400 chars (SEED_TURN_COUNT=2, SEED_CHAR_CAP=400) -- matches getRoomContext SEED_FRAGMENT_COUNT and respects the latency budget"
  - "Seed derivation runs inside the same Promise chain that races decide() against NAV_HARD_TIMEOUT_MS (1200ms); deriveConversationSeed never rejects (faults -> '')"
  - "Fence held by construction: the seed only ever lands on turn.userText, which flows to navEngine.decide; it is never assigned into any Brain-bound payload"
metrics:
  duration: ~12 minutes
  completed: 2026-06-05
  tasks: 1
  files: 1
  commits: 1
---

# Phase 141 Plan 06: RETR-02 Hot-Path Conversation Seed Flip Summary

Flipped the live per-turn seed in `scripts/intent-classifier.cjs`: the hot path no longer hard-codes `userText: null` in the Navigation Engine turn object. It now forwards a real conversation seed -- the last ~2 turns of prompt content, windowed and char-capped -- on the LOCAL seed lane only. This closes the conversation-to-retrieval loop that the founding JTBD vision promised: insight now seeds retrieval per turn, so `getRoomContext` (Plan 03) has a conversation seed to walk the graph from, not venture-state alone. The Part-8 fence (D-03a) holds by construction: the seed rides `turn.userText` into `decide()` and never threads toward `buildBrainPacket` / the brain client, so the Brain keeps receiving generic handles only.

## What Was Built

| Change | File | Effect |
|--------|------|--------|
| Removed `userText: null` from the turn object at the ~line 1080 seam; left a doc-comment pointing to the new assembly site | `scripts/intent-classifier.cjs` | The null seam is gone; `grep -n "userText: null"` now returns nothing |
| Added `deriveConversationSeed(navMod, db)` module helper + `SEED_TURN_COUNT` / `SEED_CHAR_CAP` constants | `scripts/intent-classifier.cjs` | Reads the most recent session's last 2 fragments through the navigation chokepoint `getSessionHistory(db, 1)`, char-caps each, joins them; returns `Promise<string>` that never rejects (faults -> `''`) |
| Rebuilt the turn object after `roomDb` opens, with `userText: conversationSeed`, inside the existing `callDecideWithTimeout(...)` Promise chain | `scripts/intent-classifier.cjs` | The per-turn loop carries a real conversation seed on the LOCAL lane; decide() still races inside the 1200ms `NAV_HARD_TIMEOUT_MS` envelope |

## How It Works (the seam)

1. The hot path already opens a caller-owned `roomDb` handle through the allow-listed navigation chokepoint (`openRoomDbForCaller`).
2. `deriveConversationSeed(navigationMod, roomDb)` calls `navigationMod.getSessionHistory(roomDb, 1)` (sync-backed sqlite under a resolved Promise), takes the most recent session's last `SEED_TURN_COUNT` (2) fragments, char-caps each at `SEED_CHAR_CAP` (400), and joins them into a seed string.
3. The turn object is built with `userText: conversationSeed` and passed to `callDecideWithTimeout(navEngine.decide, turn, context, NAV_HARD_TIMEOUT_MS)` -- the same 1200ms `Promise.race` envelope as before. No new blocking call, no budget widening.
4. The seed only ever lands on `turn.userText` (the LOCAL seed lane). It is never assigned into any payload that reaches `buildBrainPacket` or the brain client.

## Verification

- `node tests/test-retrieval-seed.cjs` -> `PASS` (exit 0). Asserts (a) no hard-coded `userText: null`, (b) the turn object still carries a `userText` key, (c) no line referencing `userText` also references `buildBrainPacket` / `brain-client` / `brainClient` (the D-03a fence).
- `node tests/test-room-context-part8-invariant.cjs` -> `PASS` (exit 0). The Brain still receives generic handles only; the RETR-03 source sweep over `room-context.cjs` stays clean.
- `node --check scripts/intent-classifier.cjs` -> `SYNTAX OK`.
- `grep -n "userText: null" scripts/intent-classifier.cjs` -> returns nothing (the null seam is gone).
- `grep -c $'—' scripts/intent-classifier.cjs` -> `0` (no em-dashes).
- `bash tests/run-all-141.sh` -> **9/9 PASSED, 0 FAILED**. RETR-04 latency suite reports 1.8ms (well inside the 1200ms budget), confirming the seed derivation adds no measurable cost.
- Regression: `node tests/test-135-decide-wiring-e2e.cjs` -> `2/2 passed`. The Phase 135 decide-wiring flow (turn -> decide -> offer with a real `[[section]]` reason) is intact after the turn-object restructuring.

## Threat Model Disposition

| Threat ID | Disposition | How addressed |
|-----------|-------------|---------------|
| T-141-11 (userText leaking to the Brain) | mitigated | The seed only lands on `turn.userText` (LOCAL lane); fence asserted by `test-retrieval-seed.cjs` line-by-line check that no `userText` line touches the Brain path |
| T-141-12 (seeding blows the 1200ms budget) | mitigated | Windowed to last 2 fragments, each capped at 400 chars; derived inside the existing Promise.race; RETR-04 latency suite shows 1.8ms |
| T-141-SC (npm/pip/cargo installs) | mitigated | Zero packages installed; in-place edit to an existing script |

## Deviations from Plan

None - plan executed exactly as written. The seam was un-nulled by relocating the turn-object construction to after the existing `roomDb` open (which the plan's interfaces section anticipated, since the seed must come from data already available in the hot path), keeping the change inside the 1200ms envelope per the plan's hard fence.

## Known Stubs

None. The seed is wired to live data (recent session fragments through the chokepoint); it is not a hardcoded placeholder. On a cold-start room with no fragments the seed is an empty string by design, which is the same behavior the loop had before this plan (the engine reads `typeof t.userText === 'string' ? t.userText : ''`).

## Self-Check: PASSED

- `.planning/phases/141-local-retrieval-spine-and-capability-dial/141-06-SUMMARY.md` -> FOUND
- Task commit `b5c59adc` (feat) -> FOUND in git log
- Docs commit `09b2314a` (docs) -> FOUND in git log
- `bash tests/run-all-141.sh` -> 9/9 PASSED
