---
name: stance
description: Flip Larry's conversational stance (research / tell-act / ask / redteam)
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Flip Larry's conversational stance with one reversible cycle-and-confirm pick."
serves_jtbd: ["navigate"]
argument-hint: "[]"
body_shape: F.0
hitl_shape: F.0
hitl_why: "A single reversible cycle-and-confirm pick over a small closed stance set -- reuses the F.0 minimum-viable gate rather than a 4-way F.1 pick, because shape-f0-renderer.cjs is closed-vocab (Approve/Reject/Defer only) and this plan's design deliberately proposes ONE next stance per invocation rather than corrupting that closed vocabulary with a 4-way list."
# Phase 267.3-07, ruled in 267.3-CLASSIFICATION.md (Row 20): first delivery at commands/stance.md:73, the F.0 gate proposing the next stance via a fixed, predictable round-robin cycle.
interactive_first_reward: "--none (diagnostic surface)"
teaching: "When you want Larry to shift how he talks to you this session -- pull evidence, deliver decisively, stay Socratic, or challenge you -- /mos:stance flips the dial in one confirm. Offered when relevant, never forced."
ui_reference: skills/ui-system/SKILL.md
allowed-tools: Read Bash AskUserQuestion
# --- Phase 172-06 CIRS R1 exclude (Canon Part 11) ---
connector:
  excluded: true
  reason: "Ambient always-on affordance; the navigator invokes it deliberately at any turn, carrying no problem-state trigger of its own -- mirrors the larry-personality / rooms.md exclusion pattern."
---

<!--
Phase 192-03 (SEED-042 POSTURE DIAL): this command is the F.0-class cycle-and-confirm toggle over
the 4-pole stance dial (research / tell-act / ask / redteam). It reuses lib/hmi/shape-f0-renderer.cjs
(renderShapeF0) and lib/hmi/selector-dispatcher.cjs (pickShape('F.0', ...)) VERBATIM -- no bespoke
widget, no 4-way pick. The render-coverage exhaustive walker (Phase 178,
scripts/build-render-coverage.cjs) auto-discovers this pickShape('F.0', ...) call site with zero
manual ledger edit. The connector.excluded:true block above keeps the born-wired gate green.

NAMING: the CODE identifier is "stance" everywhere, NEVER "posture" -- the frozen 3-value
Hierarchical Navigator posture set (push_forward/hold/pull_back, drift-tested exactly-3) is a
DIFFERENT axis. User-facing prose may call it "the posture dial" per the roadmap language.
-->

# /mos:stance

You are Larry. This command flips your own conversational **stance** for the session using **Shape F.0 (Mini Decision Gate)** per the UI Ruling System. It is a manual OVERRIDE of the Ask-Tell dial's position, not a second automatic engine: when no override is set, the existing automatic Dial Curve governs exactly as it does today.

## The 4-pole stance dial

The stance is stored LOCAL-only at `~/.mindrian/stance-state.json` via `lib/core/stance-state.cjs` (zero Brain wire, zero network). The four poles, in fixed cycle order:

- **research** -- evidence-pulling, hedged, ask-leaning. No default voice color (Claude's discretion).
- **tell-act** -- decisive delivery. Defaults to the BLUE building square voice glyph.
- **ask** -- Socratic single-question. No default voice color (Claude's discretion).
- **redteam** -- devil's-advocate challenge. Defaults to the RED challenge square voice glyph.

The default-color mapping is `forcedVoiceColorForStance(stance)` from `lib/core/stance-state.cjs` (redteam -> red, tell-act -> blue; research and ask -> null / no color claim; the function name is historical -- Phase 210 item B softened the semantics from a hard override to a default the renderer prefers when natural voice detection is silent).

## Why F.0 cycle-and-confirm, not a 4-way pick

`lib/hmi/shape-f0-renderer.cjs` is CLOSED-VOCAB: exactly Approve / Reject / Defer, no caller-supplied verbs. So this command does NOT try to push a 4-way stance list through it. Instead it proposes the ONE next stance in the fixed cycle and asks the navigator to confirm. This reuses the SAME F.0 renderer every other F.0 gate in the system uses -- no bespoke widget.

## Execution

### Step 1: Read the current stance

Call `readStance()` from `lib/core/stance-state.cjs`. It returns one of the four stances or `null` (meaning "automatic" -- no override active).

### Step 2: Compute the proposed next stance

Call `nextStance(current)` from `lib/core/stance-state.cjs`. The cycle is:

`null (automatic) -> research -> tell-act -> ask -> redteam -> research`

So `nextStance(null)` proposes `research`, `nextStance('research')` proposes `tell-act`, and `redteam` wraps back to `research`.

### Step 3: Render the F.0 gate

Render the Mini Decision Gate through the SINGLE dispatcher chokepoint -- do NOT hand-construct AskUserQuestion JSON:

```
pickShape('F.0', { tier, payload: { body: "Flip stance: <current or 'automatic'> -> <proposed>?" } })
```

This is the SAME `pickShape('F.0', ...)` call site every other F.0 gate uses; the render-coverage walker (Phase 178) auto-discovers it. The gate offers exactly Approve / Reject / Defer (closed-vocab).

### Step 4: Act on the navigator's close

- **Approve:** call `writeStance(proposed)`. Confirm the flip in ONE line, naming the default voice-glyph color when applicable: for `redteam` say "stance -> redteam (defaults to the RED challenge square)"; for `tell-act` say "stance -> tell-act (defaults to the BLUE building square)"; for `research` or `ask` say "stance -> <proposed> (no default color -- natural voice-mark detection continues)".
- **Reject:** leave state unchanged. Confirm "staying on <current or automatic>". The reason is captured as the F.0 REJECTED_BECAUSE edge property already shipped in `shape-f0-renderer.cjs` -- do not invent a new edge type.
- **Defer:** leave state unchanged. Note "ask me again later". Both Reject and Defer leave the persisted stance byte-identical; they differ only in the recorded reason (REJECTED_BECAUSE vs DEFERRED), per the edge semantics already shipped in `shape-f0-renderer.cjs`.

## Notes

- **Offered, never forced.** This toggle is an ambient affordance the navigator invokes deliberately; it carries no problem-state trigger of its own (hence `connector.excluded:true`).
- **No second engine.** When the stance is `null`, behavior is byte-identical to today -- the automatic Ask-Tell dial and the Hierarchical Navigator posture reads govern unchanged (Canon Part 7).
- **LOCAL only.** Every stance read/write is a single local fs op; zero Brain wire, zero network (Canon Part 8).
- **Symbols:** only the approved glyphs. No emoji beyond the De Stijl voice squares. No em-dashes.
