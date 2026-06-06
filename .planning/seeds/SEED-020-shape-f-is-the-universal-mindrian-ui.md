---
id: SEED-020
status: dormant
planted: 2026-06-06
planted_during: v1.13.1 LARRYREACH milestone, Phase 143.1 (dial-TUI) execution
trigger_when: any phase touching /mos:help, a command menu, a selector/picker surface, or a Canon Part 3 Shape F amendment; OR /gsd:new-milestone with a UI/UX or "Larry leads" theme; OR after the LARRYREACH milestone (143.1 -> 144 -> 146) closes
scope: medium
canon_parts: [Part 3, Part 10]
related_phases: [88.2, 143.1]
related_seeds: [SEED-008]
---

# SEED-020: Shape F (the AskUserQuestion card-selector) IS the universal Mindrian UI - apply it to /mos:help and every user-facing chooser, not only the internal dev-phase dial

## The navigator's decision (2026-06-06, Decision Gate)

During Phase 143.1 (dial-TUI) execution, Jonathan pointed at the live `AskUserQuestion` card-selector (the toggle/picker UI Larry uses to ask multi-option questions - label + description per card, arrow-navigable, Enter to select) and stated, verbatim in substance:

> "THE TOGGLE VIEW YOU ARE USING TO ASK ME THIS QUESTION IS THE STYLE I WANT FOR MINDRIAN. ALSO FOR THE /MOS:HELP, NOT ONLY [THE] 101-146 PHASES."

## What this means

1. **The host-native `AskUserQuestion` primitive IS the Mindrian UI style.** It is exactly Shape F (Canon Part 3; Phase 88.2 invariant). This RESOLVES the bespoke-widget tension cleanly: the style the navigator wants is the one that is already canon-legal and free - no raw-mode TUI, no custom keymap, no forking Claude Code, no AP1 violation. Up/Down + Enter are native to the host; the card label+description layout is the Shape F render.
2. **It must NOT be confined to the internal dev-phase dial (the 101-146 LARRYREACH/dev phases).** The navigator wants the SAME interactive card-selector as the real, user-facing product surface - starting with `/mos:help`.
3. **`/mos:help` today renders a TEXT list** ("selector-menu help: pick a lane, pick a command, run it (text view with --list)") - it must become a LIVE `AskUserQuestion` selector: pick a lane (card per lane) -> pick a command (card per command) -> run it. Three-tier interactive drill-down, each tier a Shape F block.
4. **Canon Part 3 already mandates this** and has been under-honored: "This gate is the universal UX primitive. Any feature that asks the user to choose something must route through the tri-context gate using one of the five F-sub-shapes. No bespoke dialogs." SEED-020 is the directive to actually enforce it at the command-menu surface.

## Scope when promoted

- **`/mos:help` as a live AskUserQuestion selector** (lane -> command -> run). The lane taxonomy already exists in the help skill; render each tier as a Shape F card block. Keep `--list` / `--text` as the TEXT fallback for non-interactive surfaces (Desktop/Cowork/`/rc`).
- **A sweep of the user-facing command menus** that today render text where a chooser is warranted (candidates: `/mos:help`, `/mos:mos`, `/mos:suggest-next`, `/mos:rooms`, `/mos:onboard` next-step menus) - route them through the Shape F selector primitive.
- **Reuse, not rebuild (Part 7):** the Phase 143.1 dial-TUI shipped the reusable pieces - the surface-agnostic reach-list/option-list core (no ANSI), `shape-f1-renderer.cjs` (`renderShapeF1`), the label composer, the F-sub-shape families. `/mos:help` is a NEW consumer of the SAME primitive, not a new widget.
- **Tri-polar:** CLI = the AskUserQuestion card picker (master); Desktop = Larry voices the lanes/commands conversationally + the same selector; Cowork = per-actor selection. The `--list` text fallback is the floor everywhere.
- **A canon note:** reinforce Canon Part 3 ("Shape F is the universal UX primitive") and Part 10 ("Conversation IS the surface; commands are internals") with this explicit "command menus render as live selectors, never bare text" rule.

## Sequencing (navigator's call 2026-06-06)

FINISH Phase 143.1 (the dial - it proves the selector pattern in the hardest case, and its reach-list renderer is the reusable core), THEN build `/mos:help` as the live selector. The dial is the proof; `/mos:help` is the first user-facing application.

## Why this matters

Per Canon Part 10 (Conversation as Product) the user-facing surface IS the product. A text-list `/mos:help` is the exact "command-driven, not conversation-driven" anti-shape Part 10 argues against. Making every chooser a live Shape F selector is the difference between "a CLI with commands" and "a thinking partner that offers you the next move." The navigator named the single most-used discoverability surface (`/mos:help`) as the place to start.
