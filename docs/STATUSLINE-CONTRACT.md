# MindrianOS Statusline Contract (v1)

Status: LOCKED 2026-06-28 (navigator co-design, Phase 121.5 statusline-co-design rule honored)
Serves: the NAVIGATOR (not the operator). Decided by Jonathan Sagir, 2026-06-28.
Canon: Part 10 (conversation as product / rooms are receipts), Part 12 (Voice Signature),
Part 5 + Part 10 entry 31 (welded two-gauge; Facilitator not Dealer). No canon amendment
required -- this is an APPLICATION of existing canon, so it does not trip the entry-31
self-binding clause.

Amended 2026-06-29 (navigator-LOCKED): Tier 4 copy moved from `Ctx <n>%` to NAVIGATOR language
(lane A -- name the move, not the gauge). See "The four tiers" + "Rendered states" below. A
copy/label change WITHIN the existing locked hierarchy and thresholds; the four tiers, the
reorder-at-cliff behavior, and INV-SL-1..5 are UNCHANGED.

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
| 4. Risk trigger | `🟢` (quiet) / `🟠 save soon` / `🔴 <file-move>` | "Warn me before I lose my thinking." | YES -- fires at the cliff |

Color is carried by EMOJI GLYPHS (host-independent), matching the Voice Signature finding
(2026-06-28: this host strips ANSI to literal text). ANSI background is progressive
enhancement only, where the host paints it; truecolor when the host supports it. The glyph
alone always carries the color.

---

## Rendered states (promote ONE thing that matters now)

```
healthy             ⬡ 🟦 · 📂 product-evolution ✅ · 🧠 · Next: validate edits · 🟢
caution (50-79%)    ⬡ 🟦 · 📂 product-evolution ✅ · 🧠 · Next: validate edits · 🟠 save soon
context cliff (>=80) 🔴 file this insight to the room before it compacts · 📂 prod
post-update drift    ⬡ 📂 product-evolution ⚠ · -> run /mos:doctor --fix · 🟢
```

REORDER-AT-CLIFF (resolved): at >=80% context the line PROMOTES the warning to the hero slot
and demotes orientation, because at that moment "do not lose your insight" outranks everything.
Below 80% the hero is `Next: <move>`. Post-update drift promotes the doctor-fix corrective.

Context thresholds (navigator-set 2026-06-28): `<50% green 🟢` / `50-79% orange 🟠` /
`>=80% red 🔴` (the cliff: file before compaction). Tier-4 COPY is navigator language, not
operator jargon (lane A, navigator-LOCKED 2026-06-29): the chip names the MOVE, not the gauge.
Green is QUIET (the dot alone = all clear; no manufactured glance, INV-SL-2). Orange is
`save soon`. Red is the imperative file-move (at the cliff, the file-message itself is the chip).
NO `Ctx` / `context` / `memory` / `room` noun -- each collides with a Mindrian term of art (the
Data Room, the 3 memory layers, the context window). The raw `%` is dropped: a navigator hires
this chip to NOT lose a thought, not to read a buffer gauge. (Supersedes the original
`Ctx <n>%` / "labeled Ctx, never a bare %" rule.)

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
| `🟢 / 🟠 save soon / 🔴 file` | "warn me before I lose my thinking" | Trigger (anxiety) -> Action (file) at the cliff |

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

---

## The Voice-Switch Tripwire + F.7 Recalibration Dial (PROPOSED v2 -- 2026-06-29)

Status: PROPOSED (navigator-directed 2026-06-29; "spec the tripwire first"). Extends the LOCKED v1
contract above; does NOT re-open it. This is an APPLICATION of Canon Part 12 (Voice Signature +
Modality Remote + F.1-as-Decision-Gate) and Part 3 (the F.7 dial), so it requires NO canon amendment.
Folds into Phase 182.1 (voice glyph) + Phase 187 (cockpit). House rule: hyphens only.

### Why this exists

Part 12 makes a HARD requirement of two things the statusline already half-carries: the navigator must
always be able to SEE whether they are hearing Larry or the native host (the Voice Signature glyph,
Tier 1), and the navigator must always be able to CHANGE Larry's modality (the Modality Remote: the
4-arrow ASK/TELL x challenge/converge control). Today the bar SHOWS the voice glyph but does nothing
when the voice SWITCHES. The switch is the most decision-relevant moment of all -- it is exactly when
the navigator might say "wait, I wanted Larry, not the raw tool" (or the reverse). This spec wires the
switch to a recalibration gate.

### The tripwire (detection)

A tripwire fires on the VOICE TRANSITION, in BOTH directions:

- `larry -> claude` (a Larry turn was followed by a native-host turn: the voice glyph went absent)
- `claude -> larry` (the host was speaking, now a Larry mark appears)

Detection source is the existing LOCAL voice-mark side-channel (`~/.mindrian/voice-mark.json`, read via
`lib/hmi/voice-color-mark.cjs`; Phase 182.1). The tripwire compares the PRIOR turn's resolved voice
state to the CURRENT one; a change (present<->absent, or one of the 5 De Stijl moves<->host) is the
event. No new wire, no new color, no new reach: the transition is computed from data already on disk.
Part 8 clean (LOCAL only; the side-channel never egresses).

### What the tripwire invokes (the F.7 recalibration dial)

On fire, the system invokes the **F.7 selector dial** -- the Modality Remote made explicit as a
tri-context Decision Gate (Part 3 Shape F.7). This is the canonical realization of the Part 12 line
"the arrows are the navigator grabbing the wheel on a read Larry is already making."

ARCHITECTURAL CONSTRAINT (load-bearing): the STATUSLINE is a passive render surface (re-drawn every
~300ms, cannot capture arrow-keys/Enter). It therefore does NOT host the dial. The split is:

- STATUSLINE (passive): shows the switch happened -- e.g. `○ now: host (not Larry)` in Tier 1 -- and
  hints the recalibration is available. Detection + display only.
- CONVERSATION (interactive): the F.7 dial FIRES here as the AskUserQuestion gate. The dial is the
  decision surface; the bar is the signal.

### The dial contents

The dial recalibrates the navigator's intent about WHO they want and HOW. Drawn from the Part 12
Modality Remote + the canonical verb vocabulary; the free-text "Other / explain" slot is ALWAYS last
(the F.1/F.7 human-in-the-loop guarantee):

- WHO (the switch itself): `Back to Larry` (thinking partner) / `Stay with Claude` (raw tool).
- HOW, when Larry (the Modality Remote, the 4 arrows):
  - UP    = tell me / give me the call    (more TELL)
  - DOWN  = draw it out of me, slow down   (more ASK)
  - LEFT  = challenge me, re-open it        (pull back)
  - RIGHT = I am ready, advance / converge  (push forward)
- EXTRAS (optional, multi-select checkboxes; the "or more things?" the navigator asked for): zero or
  more modality flags layered on the pick (e.g. "shorter", "show your reasoning", "stay in this room").
- EXPLAIN (free-text, always last): the navigator types intent in their own words; Larry interprets and
  routes. This is the Part 3 Free-Text verb and the F.1 "Other / something else" standing preference.

### State update (Part 4 / Part 9)

Every recalibration is graph data. On commit the dial writes through the navigation.cjs chokepoint
(Part 9), using the EXISTING F.7 state-update hook -- no new edge type is minted:

- A modality/who pick that AGREES with the current read commits SELECTED_REACH (the resting-detent
  in-sync signal) + a `memory_event`.
- A pick that DISAGREES (the navigator overrides the read) commits PIVOTED (chosen vs declined) with
  ENUM-only props + the investment-scaled pivot decay, AND SELECTED_REACH to the chosen lane.
- Defer / Free-Text route through the existing selector-decisions path (DEFERRED / recordSelectorMiss).

This is the calibration discipline of Part 12: the override is the LOCAL, replayable record that proves
(or refutes) Larry's read before that read is allowed to steer.

### Invariants carried (anti-Dealer)

INV-SL-1..5 (above) apply unchanged. Specifically INV-SL-2: the tripwire's success metric is the
percentage of fires that lead to a REAL advancing action (a confirmed recalibration that changes the
next turn), NEVER fire-count or dial-interaction-rate. A tripwire that fires often and changes nothing
is the Dealer quadrant and is logged as a regression. The tripwire MUST be debounced so a normal
Larry-led session (where the host rarely speaks) does not nag: it fires on a genuine voice SWITCH, not
on every turn.

### What this does NOT change (frozen contracts)

Mints no new reach (the dial reuses the frozen F.7 / 6-reach bank), no new edge/node type (reuses
PIVOTED / SELECTED_REACH), no new De Stijl color (reuses the 5 Mondrian primaries), and opens no Brain
wire (LOCAL only). MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate, the single-marker body glyph, and the
F.1 keyboard contract are UNCHANGED. This is why no canon amendment is required: it is Part 12 + Part 3
applied, not extended.

### Open items (build, AFTER this spec locks)

1. The voice-mark WRITE-side hook (records Larry's last-turn move to `voice-mark.json`) -- the shared
   prerequisite with Phase 182.1; without it the tripwire cannot see a transition.
2. The transition detector (prior-vs-current voice state) + the debounce rule.
3. The Tier-1 statusline display of the switch (`○ now: host (not Larry)`), passive.
4. The F.7 recalibration dial wired to the existing AskUserQuestion / selector-dispatcher path, with the
   WHO + 4-arrow + checkbox + free-text slate.
5. The state-update binding (SELECTED_REACH / PIVOTED via navigation.cjs) + the INV-SL-2 honest
   exposures-to-advancing-action measurement for the tripwire specifically.
