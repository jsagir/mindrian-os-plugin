---
name: glyph-disambiguation
description: >
  ODD 4 resolution (Phase 121.5, 2026-05-16). Documents the 🎯 glyph overload
  (three surfaces, three meanings) and the "JTBD" word collision (Phase 37
  bash nudges vs Phase 100 typed engine) as explicit position-anchored
  exceptions in SKILL.md §3 -- mirroring the existing no-emoji + statusline
  carve-out pattern. The lower-risk path: document the seam, not move it.
  Renumbering / renaming deferred to v1.14.0 cleanup.
---

# Glyph + Word Disambiguation Rule (ODD 4 Resolution)

Phase 121.5 (Terminal Coherence Capstone) found two vocabulary collisions in
v1.13.0 that needed resolution before the final release gate. The lower-risk
path chosen 2026-05-16: DOCUMENT both as explicit position-anchored exceptions
in `skills/ui-system/SKILL.md` §3, mirroring the existing no-emoji +
statusline carve-out pattern. The pattern is: a global rule with a precisely-
named exception, position-anchored.

Renumbering the glyphs and renaming "JTBD" the word were considered and
deferred to v1.14.0. Rationale:

1. Phase 121.5 is consolidation, not expansion (Canon Part 7). Renaming "JTBD"
   the word ripples through 24+ files, Brain context packets, telemetry
   event types. Cost-benefit too high for the closing milestone.
2. The collisions are real but CONTEXT-DISAMBIGUATING: each occurrence is
   resolved by surface position. 🎯 in statusline Row 2 next to "JTBD" means
   "what job"; 🎯 in /mos:jtbd output means "broadcast"; 🎯 in
   EXPLORATION_LABELS means problem-definition. Each surface owns its
   position-anchored meaning.
3. Documenting the overload + carve-out is the SAME shape of exception the
   existing emoji carve-out (no-emoji rule with statusline exception) already
   does. We follow the same pattern.

Future v1.14.0 may renumber the glyphs OR rename "JTBD". For v1.13.0 final we
mark the seam, not move it.

---

## 1. The 🎯 glyph overload (three surfaces, three meanings)

The 🎯 emoji is used on three distinct surfaces with three distinct meanings.
Each surface owns its position-anchored meaning; the three meanings never
collide on the same surface at the same time.

| Surface                                          | 🎯 meaning                                                                        | Source path                                  |
|--------------------------------------------------|-----------------------------------------------------------------------------------|----------------------------------------------|
| Statusline Row 2 (the JTBD label prefix)          | "What job are you in right now."                                                  | `scripts/context-monitor`                    |
| `/mos:jtbd` command output + JTBD broadcast       | "This is the job we're proposing." (recommendation prefix)                       | `commands/jtbd.md` + JTBD nudge rendering    |
| `EXPLORATION_LABELS` problem-definition emoji     | "Where the wicked navigator starts." (stage emoji for problem-definition phase) | `lib/core/visual-ops.cjs` EXPLORATION_LABELS |

**Reader disambiguation rule.** Ask: WHERE is the 🎯?

  - Statusline row 2? -> active JTBD context (what job).
  - Command output / broadcast banner? -> JTBD recommendation (which job).
  - EXPLORATION_LABELS render path (visual ops, stage-labeled output)? ->
    problem-definition stage emoji.

The three surfaces are physically separate render paths; they never appear
together in the same line, the same paragraph, or the same selector block.

---

## 2. The "JTBD" word collision (two systems)

The acronym "JTBD" (Jobs-To-Be-Done) names two unrelated systems in the
plugin:

| System                          | Status                                       | Source path                                                       |
|---------------------------------|----------------------------------------------|-------------------------------------------------------------------|
| Phase 37 nudge templates        | Internal prompt-engineering layer (legacy)   | `lib/hmi/build-jtbd-nudges` (bash, prompt-engineering style)      |
| Phase 100 typed engine          | AUTHORITATIVE 13-JTBD taxonomy + verb engine | `lib/hmi/jtbd-taxonomy.json` (cues / methodology hooks / verbs)   |

**Resolution rule.** When SKILL.md, the Mindrian canon, or any user-facing
surface says "JTBD" without qualification, it means the **Phase 100 typed
engine** (`lib/hmi/jtbd-taxonomy.json` -- the 13-JTBD taxonomy with
methodology hooks, next_move_verbs, and completion patterns).

The Phase 37 nudges are an internal prompt-engineering layer beneath the
engine. User-facing surfaces never name them directly. If a code path needs to
distinguish, the convention is:

  - "JTBD" (unqualified) -> Phase 100 engine.
  - "JTBD nudge template" / "build-jtbd-nudges" -> Phase 37 layer (internal
    reference only).

---

## 3. The carve-out pattern

This rule mirrors the structure of the existing emoji carve-out in
`skills/ui-system/SKILL.md` §3:

> Global rule: NO EMOJI. EVER.
> Carve-out: `scripts/context-monitor` statusline is excepted (position-
> anchored: the host terminal renders it as a passive signal surface, not a
> MindrianOS command output body).

ODD 4 follows the same shape:

> Global rule: One glyph -> one meaning. One word -> one system.
> Carve-out: 🎯 has three position-anchored meanings (statusline row 2 / `/mos:jtbd`
> output / EXPLORATION_LABELS). "JTBD" has two position-anchored systems
> (Phase 100 engine = authoritative; Phase 37 nudges = internal-only).

The pattern is: precision in the exception, anchored by surface position.
Future cleanup may move the seam; until then, the surfaces own the meaning.

---

## 4. The v1.14.0 cleanup proposal

A future v1.14.0 cleanup phase MAY:

  - Renumber the 🎯 glyph by SURFACE: e.g. statusline uses 🎯, broadcast uses
    `🔆` or a new 12-glyph CLI vocabulary entry, EXPLORATION_LABELS uses a
    distinct stage emoji.
  - Rename one of the two "JTBD" systems: e.g. Phase 37 nudges become
    "JTBD-nudges-v0" or "preinference-nudges"; Phase 100 engine retains "JTBD"
    unqualified.

Both are renaming exercises with ripple costs: ~24 files for "JTBD" rename,
3+ render paths for 🎯. Neither is in scope for v1.13.0. Track in
`docs/CANON-PHASE-MAP.md` v1.14.0 backlog under Canon Part 7 (Reuse Before
Build) -- the bar for renumbering is "this REPLACES / reconciles N existing
things," not "this is the N+1th."

---

## 5. Verification

This rule passes when:

1. SKILL.md §3 contains the "ODD 4 resolution" paragraph documenting both
   collisions (grep `ODD 4 resolution` returns >= 1 hit).
2. SKILL.md §3 still preserves the existing no-emoji + statusline carve-out
   (the ODD 4 paragraph is APPENDED, not replacing).
3. SKILL.md §3 cross-references this rule file
   (`skills/ui-system/rules/glyph-disambiguation.md`).
4. No new glyphs were added to the 12-glyph CLI vocabulary table in SKILL.md
   §3 (Canon Part 7 invariant: ZERO new glyphs in 121.5).
5. No code paths were renamed (Canon Part 7 invariant: ZERO concept renames
   in 121.5).

---

## 6. Canon Refs

- **Part 3 (UI Ruling System enforcement)** -- the carve-out is the
  documented exception in the ruling system's vocabulary contract.
- **Part 7 (Reuse Before Build)** -- consolidation only. ZERO new commands,
  glyphs, renames.
- **Part 8 (Graph Boundary)** -- no Brain query depends on the disambiguation;
  glyph + word use is LOCAL render-path concern.
- **Part 10 (Conversation as Product)** -- the terminal must coherently
  express its vocabulary. ODD 4 resolution closes a coherence gap before the
  v1.13.0 final gate.

---

## 7. See Also

- `skills/ui-system/SKILL.md` §3 -- the carve-out lives there in canonical
  form; this rule file is the expansion.
- `.planning/phases/121.5-terminal-coherence-capstone/121.5-CONTEXT.md` --
  ODD 4 (item 8 + "Open Design Decisions" section).
- `lib/hmi/jtbd-taxonomy.json` -- the authoritative Phase 100 JTBD system.
- `lib/hmi/build-jtbd-nudges` -- the Phase 37 layer (internal only).
- `scripts/context-monitor` -- statusline 🎯 (active JTBD prefix).
- `lib/core/visual-ops.cjs` -- EXPLORATION_LABELS 🎯 (problem-definition).
