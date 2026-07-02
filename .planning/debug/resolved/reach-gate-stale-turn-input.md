---
status: awaiting_human_verify
kind: rca
trigger: "tier_0 reach-gate routing appears to not re-evaluate against the current user turn. Repro: in a fresh no-room session, the engine's F.1 Decision Gate fired a cold-room candidate-reach list referencing memory_artifact:team-execution/2026-05-07-v1.14-the-visible-room-sprint-action-item:ROOM. Next turn, user typed ignite (expecting /mos:ignite new-room onboarding) -- the hook returned the byte-identical F.1 payload (same 6 ranked reaches, same stale team-execution artifact reference, same new-room framing), unrelated to ignite and unrelated to the actual session context (bound to dev-repo/no-room per an F.8 gate answered the turn before)."
issue_id: ""
severity: medium
surfaces: [cli]
brain_mode: tier-0
canon_parts: [3, 7]
created: 2026-07-02T16:49:41Z
updated: 2026-07-02T16:49:41Z
related: ignite-frontdoor-bypassed-methodology-overfire (sibling: also an F.1/ignite-adjacent gate-content defect, but that RCA is about Larry over-firing a methodology skill on an explore-invitation; this one is about the tier_0 candidate-reach list not being keyed to the current user turn at all -- different mechanism)
---

## Current Focus

CONFIRMED root cause (possibility (a) from the original hypothesis: the current user
message is structurally NOT threaded into the routing/decide/dial seed lane at all --
a pure staleness bug, NOT a memo cache).

reasoning_checkpoint:
  hypothesis: "The per-turn reach-gate content is byte-identical across different user
    inputs because the current user message (STDIN_MESSAGE) never enters the routing seed
    lane. The engine decides on `deriveConversationSeed()` = the last ~2 PERSISTED session
    fragments from room.db (turn-independent at UserPromptSubmit time, since the current
    message is not stored yet), and the dial reach scores + {topic} grounding come from Leg
    D cortex (`SELECT ... ORDER BY created_at DESC`, purely DB-recency, turn-independent)."
  confirming_evidence:
    - "scripts/intent-classifier.cjs:1336-1357 deriveConversationSeed(navMod, db) returns
      ONLY navMod.getSessionHistory(db,1) fragments. STDIN_MESSAGE is never incorporated."
    - "scripts/intent-classifier.cjs:1590-1594 builds turn = { userText: conversationSeed }
      -- decide()'s turn.userText is the STALE history seed, not the current message."
    - "lib/core/insight-sensors.cjs:288-292 normalizeTurn reads text from base.userText
      (the hook fallback) -- so every turn-text-scanning sensor scans the stale seed."
    - "scripts/intent-classifier.cjs:1013-1043 renderEngineDecisionWithDial builds
      reachScores = buildReachScoresFromCortex(ctx.cortexNodes); cortexNodes = Leg D."
    - "lib/core/navigation/room-context.cjs:178-210 legD = SELECT ... FROM nodes WHERE type
      IN (cortex types) ORDER BY created_at DESC -- turn-independent DB snapshot."
    - "scripts/intent-classifier.cjs:969-989 buildDialSlotContext falls back to
      cortexNodes[0] for {topic} -> the stale `memory_artifact:team-execution/...:ROOM`
      the user saw (the most-recently-created cortex node in the dev-repo's own room.db)."
    - "hooks/hooks.json UserPromptSubmit order: intent-classifier is hook #2, BEFORE
      operator-update/jtbd-update -- so the current message is NOT yet persisted when
      deriveConversationSeed reads history."
  falsification_test: "If STDIN_MESSAGE were already in the seed, turn.userText would differ
    between the session-start turn and the 'ignite' turn. It does not -- both carry only the
    prior persisted fragments, so decide() input is byte-identical -> output byte-identical."
  fix_rationale: "Thread STDIN_MESSAGE as the freshest fragment into deriveConversationSeed
    so the current turn enters the LOCAL routing seed lane it was excluded from. This makes
    turn.userText (and getRoomContext seedFragments) carry the actual current message, so
    decide()/dispatchSensors decide on the real turn instead of stale history. It does NOT
    touch the frozen 6-reach bank / DIAL_REACH_K / 0.70-0.15 gate (Part 3) and does NOT make
    cortex scores word-reactive (Part 9: SQL room-state is by-design the dial prior) -- it
    fixes only the origin: the current turn being invisible to the engine."
  blind_spots: "The 6 canonical reaches are frozen by design, so their SCORES stay
    cortex-driven; the fix makes decide()/sensors/offer + turn.userText react to the current
    turn, not the cortex-derived dial-score ranking. Sensors that do not keyword-scan (e.g.
    'ignite' matches no show/diffusion sensor) may still not visibly flip on that exact word,
    but the engine input is no longer byte-identical and no longer blind to the turn."

## Eliminated

- hypothesis: "A memoization/cache keyed on session-start short-circuits per-turn
    recomputation (possibility (b))."
  evidence: "No memo/cache wraps the routing arm. emitEngineDecisionBlock recomputes
    deriveConversationSeed + getRoomContext + decide() every turn. next-move-cache.cjs is a
    statusline side-channel only, not the F.1 gate. The staleness is structural input
    exclusion, not caching."
  timestamp: 2026-07-02T17:10:00Z

## Evidence

- timestamp: 2026-07-02T17:05:00Z
  checked: "scripts/intent-classifier.cjs:1336-1357 (deriveConversationSeed) and the seed
    consumer at :1577-1631"
  found: "The routing seed = getSessionHistory(db,1) last ~2 fragments only. turn.userText
    and getRoomContext seedFragments are built from this seed; STDIN_MESSAGE is absent."
  implication: "decide() and every sensor decide on prior stored turns, never the current
    message. Root of the non-reactivity."

- timestamp: 2026-07-02T17:06:00Z
  checked: "lib/core/navigation/room-context.cjs:178-210 (legD) and
    lib/hmi/cortex-reach-adapter.cjs:194+ (buildReachScoresFromCortex)"
  found: "cortexNodes come from a turn-independent ORDER BY created_at DESC SELECT; reach
    scores fold only cortex node presence/enums. No turn text enters."
  implication: "Dial reach ranking is room-state-driven by design; the {topic} slot falls
    back to cortexNodes[0] -> the stale team-execution artifact reference."

- timestamp: 2026-07-02T17:08:00Z
  checked: "hooks/hooks.json UserPromptSubmit ordering + scripts/intent-classifier.cjs:2329"
  found: "intent-classifier is hook #2 (before operator-update/jtbd-update); routing arm
    gated on STDIN_MESSAGE non-empty, so the current message IS available in module scope
    but is only wired to the F.8 binding/pick consumers, never the routing seed."
  implication: "The current message can be threaded into the seed at zero extra I/O cost."

next_action: Thread STDIN_MESSAGE as the freshest seed fragment in deriveConversationSeed
  (scripts/intent-classifier.cjs), preserving the SEED_CHAR_CAP and the D-03a LOCAL-lane
  fence; then run the intent-classifier + navigation suites.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 1.15.3-beta.1 (post Phase 209 / v1.15.2 release)
- Reported by: Jonathan (live session, testing the Phase 209 Shape-F Native Fire fix)
- Date first observed: 2026-07-02
- Related debug sessions: ignite-frontdoor-bypassed-methodology-overfire.md (sibling family -- F.1/ignite gate content defects -- but a DIFFERENT mechanism: that RCA is skill-selection over-fire via loose `sensor_triggers`; this RCA is candidate-reach content not reacting to turn input under tier_0)

## Problem Statement

The F.1 "Choose next reach" Decision Gate, rendered under `tier_0` (BRAIN.md absent / Brain
offline) fallback, returns the identical candidate-reach payload across two turns with
materially different user input: turn 1 was a bare session-start (no user text), turn 2 was
the user typing "ignite" (a command that should route toward `/mos:ignite` new-room
onboarding). Both turns produced the same six ranked reaches, the same
`memory_artifact:team-execution/2026-05-07-v1.14-the-visible-room-sprint-action-item:ROOM`
reference (a stale artifact from an unrelated room -- the current session is bound to
dev-repo/no-room), and the same "new room, nothing to rank yet" framing.

This is a separate defect from Phase 209 (Shape-F Native Fire): the AskUserQuestion card
itself fired correctly as a real interactive picker on both turns (Phase 209's fix is
holding). The bug is that the CONTENT behind the card is not reacting to the current turn's
input under tier_0 fallback.

## Symptoms

expected: When the user types "ignite" in a dev-repo/no-room session, the routing engine
either surfaces reaches relevant to starting a new room (or the ignite F.1 starting-point
gate itself), or at minimum recomputes the candidate-reach ranking against the new turn.
actual: The engine returns the byte-identical F.1 payload from the prior (unrelated,
session-start) turn -- same six candidates, same stale `team-execution` memory_artifact
reference, same "cold room" framing -- regardless of the user typing "ignite".
errors: None surfaced to the user; this is a silent staleness/non-reactivity defect, not a
crash or visible error.
reproduction:
  1. Start a fresh Claude Code session with MindrianOS v1.15.2+ (BRAIN.md absent / tier_0).
  2. Answer the F.8 session-bind gate with "dev repo / no room".
  3. Observe the F.1 "Choose next reach" gate fire, referencing a
     `team-execution/2026-05-07-...` memory_artifact.
  4. Next turn, type "ignite".
  5. Observe the identical F.1 payload fire again (same candidates, same stale reference).
started: Unknown -- first observed 2026-07-02 while testing the Phase 209 fix in a live
session; not yet bisected against a specific phase/commit.

## Scope and Impact

- Affected surfaces: cli (observed in Claude Code CLI session; Desktop/Cowork status
  unknown -- needs check per Tri-Polar rule).
- Affected path: tier_0 fallback routing (BRAIN.md absent / Brain offline) -- the
  "context_block/hold" sensor-reach path per the NAVIGATION DECISION block
  (`routing_source: engine`, `fire_skill: Run Methodology`).
- Affected users: any user/session running without a populated BRAIN.md, i.e. every fresh
  or dev-repo/no-room session -- likely the common cold-start path, not an edge case.
- Version range: present in 1.15.3-beta.1; unconfirmed how far back (tier_0 fallback
  predates Phase 209; needs bisection).
- Severity: medium -- no crash, no wrong-room write (F.8 gate correctly kept this session
  unbound), but it means the very first "what do I do next" surface a cold-start user sees
  can be irrelevant/stale, undermining trust in the reach-gate mechanism Phase 209 just
  hardened.
- Blast radius: candidate-reach content generation under tier_0 only; the AskUserQuestion
  dispatch mechanism (Phase 209's scope) is confirmed unaffected.

## Resolution

root_cause: |
  The per-turn reach gate was fed STALE input because the CURRENT user turn was never
  threaded into the routing seed. On each UserPromptSubmit, scripts/intent-classifier.cjs
  builds the engine turn from deriveConversationSeed() (:1336-1357), which returned ONLY the
  last ~2 fragments of PERSISTED session history (navMod.getSessionHistory(db,1)). Because
  intent-classifier is UserPromptSubmit hook #2 (before operator-update/jtbd-update store the
  turn), the current message is not yet in history -- so the seed was turn-independent. That
  seed becomes turn.userText (:1590-1594), which dispatchSensors normalizeTurn reads as the
  sensor scan text (lib/core/insight-sensors.cjs:288-292), and it also feeds getRoomContext
  seedFragments (:1626-1631). Separately the dial reach SCORES come from Leg D cortex
  (lib/core/navigation/room-context.cjs:178-210, SELECT ... ORDER BY created_at DESC --
  turn-independent by design, Part 9 room-state prior) via buildReachScoresFromCortex, and the
  {topic} grounding falls back to cortexNodes[0] (buildDialSlotContext :969-989) -> the stale
  `memory_artifact:team-execution/...:ROOM` reference the user saw. Net: decide()'s input was
  byte-identical across the session-start turn and the "ignite" turn, so the F.1 reach payload
  was byte-identical. NOT a memo cache -- a structural exclusion of the current turn from the
  engine's input.
fix: |
  Thread the current turn (STDIN_MESSAGE) into deriveConversationSeed as the freshest (tail)
  seed fragment, capped at SEED_CHAR_CAP, via a withCurrentTurn() helper applied on every
  return path (missing navMod/db, empty history, fault, and the happy path). turn.userText and
  getRoomContext seedFragments now carry the actual current message, so decide()/dispatchSensors
  decide on the real turn instead of stale history. Byte-identical to the pre-fix history-only
  seed when STDIN_MESSAGE is empty (RETR-02 wiring + Part 8 D-03a LOCAL-lane fence preserved:
  the message rides turn.userText/seedFragments only, never buildBrainPacket). The frozen dial
  contract is untouched (DIAL_REACH_K=6 / 0.70-0.15 gate / 6-reach bank) -- the cortex-derived
  reach SCORES stay room-state-driven by design; the fix restores turn-reactivity to the engine
  input, sensor spine, and offer, which is the origin defect.
verification: |
  - New regression tests/test-reach-gate-stale-turn-input.cjs (subprocess, controlled stdin):
    (1) current turn present + freshest tail line + prior history preserved;
    (2) two different turns, identical history -> DIFFERENT seeds (byte-identical symptom gone);
    (3) empty turn -> byte-identical history-only seed (no RETR-02 regression). PASS.
  - Regressions green: test-retrieval-seed, test-195-inherit-seed, test-spine-navigates-decide,
    test-nav01-populated-room-engine-fires, test-150-5-sensor-firability, test-209-engine-arm-contract,
    test-158-reach-byte-stable, test-acpt-06-dial-atomic-emission, test-159-integration-2turn-suppress,
    test-meter-gate-reach, test-f7-dial-gap-zero-confirm, test-150-orphans, run-all-141 (9/9).
  - No em-dashes in changed files. No new invocable surface (export-only + seed wire), so the
    born-wired / shape-declaration gates are unaffected.
  - PENDING human-verify: confirm in a live fresh dev-repo/no-room session that a second turn
    with different text no longer renders the byte-identical F.1 payload.
files_changed:
  - scripts/intent-classifier.cjs (deriveConversationSeed threads STDIN_MESSAGE as freshest seed; export added for regression)
  - tests/test-reach-gate-stale-turn-input.cjs (new regression)
