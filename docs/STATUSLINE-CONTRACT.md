# MindrianOS Statusline Contract (v1)

Status: LOCKED 2026-06-28 (navigator co-design, Phase 121.5 statusline-co-design rule honored)
Serves: the NAVIGATOR (not the operator). Decided by Jonathan Sagir, 2026-06-28.
Canon: Part 10 (conversation as product / rooms are receipts), Part 12 (Voice Signature),
Part 5 + Part 10 entry 31 (welded two-gauge; Facilitator not Dealer). No canon amendment
required -- this is an APPLICATION of existing canon, so it does not trip the entry-31
self-binding clause.

---

## Purpose

The statusline is a ONE-GLANCE TRIGGER SURFACE that keeps the navigator oriented, warns of
room/context integrity risk, and presents the lowest-friction next action toward a validated
decision. It is a launch point, never a destination.

---

## The four tiers (hierarchy, not a pile)

Refinement 1 (navigator-directed): trust metadata is SEPARATED from behavioral triggers, so
the line has hierarchy instead of equal-weight cues.

| Tier | Chips | Role | Behavioral? |
|------|-------|------|-------------|
| 1. Identity / trust metadata | `⬡` (Mindrian) · `🟦/🟥/🟨/⬛/⬜` (Voice Signature glyph) · `🧠` (Brain backing) | "Who is speaking, and what backs it." | NO -- passive trust calibration, never a hook |
| 2. Orientation / integrity | `📂 <room>` · `✅/⚠/🔴` (room health) | "Where am I, and is it sound." | Trigger ONLY when degraded |
| 3. Action | `Next: <move>` | "The next step to a validated decision." The core JTBD / MVA cue. | YES -- the action prompt |
| 4. Risk trigger | `🟢/🟠/🔴 Ctx <n>%` | "Warn me before I lose my thinking." | YES -- fires at the cliff |

Color is carried by EMOJI GLYPHS (host-independent), matching the Voice Signature finding
(2026-06-28: this host strips ANSI to literal text). ANSI background is progressive
enhancement only, where the host paints it; truecolor when the host supports it. The glyph
alone always carries the color.

---

## Rendered states (promote ONE thing that matters now)

```
healthy             ⬡ 🟦 · 📂 product-evolution ✅ · 🧠 · Next: validate edits · 🟢 Ctx 36%
caution (50-79%)    ⬡ 🟦 · 📂 product-evolution ✅ · 🧠 · Next: validate edits · 🟠 Ctx 64%
context cliff (>=80) 🔴 Ctx 84% -- file this insight to the room before it compacts · 📂 prod
post-update drift    ⬡ 📂 product-evolution ⚠ · -> run /mos:doctor --fix · 🟢 Ctx 31%
```

REORDER-AT-CLIFF (resolved): at >=80% context the line PROMOTES the warning to the hero slot
and demotes orientation, because at that moment "do not lose your insight" outranks everything.
Below 80% the hero is `Next: <move>`. Post-update drift promotes the doctor-fix corrective.

Context thresholds (navigator-set 2026-06-28): `<50% green 🟢` / `50-79% orange 🟠` /
`>=80% red 🔴` (the cliff: file before compaction). The chip is labeled `Ctx`, never a bare
`%` or "progress."

Room-health (Tier 2): `✅` sound / `⚠` drift / `🔴` broken. The `⚠`/`🔴` state ALWAYS carries
its adjacent one-tap fix (`-> run /mos:doctor --fix`). Escalates loudest POST-UPDATE -- the
highest-drift moment (the install-cache / scaffold / statusline-visibility incident family).

---

## JTBD x Hooked mapping (why each chip earns its seat)

| Chip | JTBD (what the navigator hires it for) | Hooked phase |
|------|----------------------------------------|--------------|
| `🟦` voice glyph | "tell me it's Larry, not the raw tool" | Trust metadata (not a hook) |
| `📂` + `✅/⚠` health | "keep me oriented; tell me my room is sound; fix it if not -- esp. post-update" | Trigger (corrective) -> Action (`/mos:doctor --fix`) |
| `🧠` Brain | "how much help backs what Larry says" | Trust metadata (not a hook) |
| `Next: <move>` | "the next step to a validated decision" (the core job) | Action prompt (the MVA cue) |
| `🟢🟠🔴 Ctx` | "warn me before I lose my thinking" | Trigger (anxiety) -> Action (file) at the cliff |

The Hooked loop (Facilitator form): internal trigger = the navigator's itch ("am I advancing?
about to lose this? is my room sound?"); action = the one-tap fix shown beside every non-healthy
state (ability is the lever, not motivation); variable reward = Hunt + Self (a real fresh
next-move / caught contradiction / confirmed heal -- never color-motion or novelty); investment
= REAL room deposits (filed insight, accepted decision, healed graph) that make next session's
line smarter and reload the next trigger.

---

## Anti-Dealer product invariant (NORMATIVE -- not design intuition)

Refinement 2 (navigator-directed): written as binding rules, the practical line between
Facilitator and Dealer, downstream of canon entry 31 (welded two-gauge).

- **INV-SL-1 (Purpose).** The line MUST keep the navigator oriented, warn of integrity risk,
  and present the lowest-friction next action toward a validated decision.
- **INV-SL-2 (Primary success metric).** The line's success metric is the PERCENTAGE OF
  STATUSLINE EXPOSURES THAT LEAD TO A REAL ADVANCING ACTION within the session. Time-on-line,
  glance-count, and status-interaction-rate MUST NOT be optimization metrics. (This is Gauge 2,
  transfer-per-invocation, pointed at the line: the line earns its place only if its prompts
  advance real decisions.)
- **INV-SL-3 (Failure condition).** The line becoming a DESTINATION instead of a LAUNCH POINT
  is the failure mode, and is logged as a regression (the Dealer quadrant).
- **INV-SL-4 (Governing rule).** "A glance that leads to no move is the line failing, not
  succeeding." Therefore: EVERY non-healthy state MUST render its adjacent one-tap fix. A state
  that shows a problem without its action is a contract violation.
- **INV-SL-5 (Facilitator reward).** Rewards are substance (Hunt + Self), never interface
  novelty. Investment is real room deposits, never vanity counters.

---

## Open items (next, AFTER lock -- code)

1. Wire the four-tier renderer + the 4 states into the statusline script (co-design done; build next).
2. Source the `Ctx %` from the host's context signal; bind the 50/80 thresholds.
3. Source room-health from `/mos:doctor` (cached), with the post-update escalation.
4. Bind the Voice Signature glyph (Tier 1) to the current turn's move once the voice-mark
   detector is glyph-aware (the parallel SIGNAL fix).
5. INV-SL-2..4 need a LOCAL, honest measurement hook (exposures -> advancing-action), Part 8 clean.
