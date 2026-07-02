# Quick Task: statusline-context-aware

**Date:** 2026-07-02
**Type:** GSD quick task (not a phase). Navigator co-design (Phase 121.5 rule satisfied -- these are the navigator's explicit rulings, 2026-07-02).
**Branch:** main (main tree, no worktree).
**Commit prefix:** `quick(statusline-context-aware)`

## Objective

Four navigator-ruled changes to the four-tier statusline cockpit, one pass, inside the locked design (docs/STATUSLINE-CONTRACT.md).

## The four changes

- **Ruling 1 -- DROP the static persona chip.** "👤 Larry" never changes; a static field earns no space. Remove it from the rendered line; the ⬡ hexagon alone carries brand identity. Keep the dynamic voice/stance chip (192-04) and the dynamic host / voice-switch markers.
- **Ruling 2 -- Brain chip is BINARY, never a bare mystery glyph.** Connected renders the labeled "🧠on"; offline/unconfigured OMITS the chip (chosen off-form, documented). Reuse the existing `brainConnected` signal.
- **Ruling 3 -- "Next:" is CONTEXT-AWARE + add a JTBD chip.**
  - (a) Persist the per-turn decide() cue to the existing `~/.mindrian/next-move.json` writer (EXTEND next-move-cache, do not fork): prefer `offer_next_step`, else the fired `fire_skill` as a suggested command.
  - (b) JTBD chip: render `🎯 <jtbd>` when set, nothing when absent (already wired by 106-D02 in context-monitor -- the allowed 🎯 surface; confirm, do not fence-break).
  - (c) Resolution order: routed offer -> per-turn decision cue -> jtbd -> honest `Next: --` (NEVER the lying "continue").
- **Bucket-1 (approved research adoptions):**
  - (d) Read the NATIVE context percentage (`context_window.used_percentage` / `exceeds_200k_tokens`) with the estimate as FALLBACK; guard null-after-/compact.
  - (e) refreshInterval -- gated on CC >= 2.1.97 IF wiring supports it, else document + skip.
  - (f) session-keyed room-health / room-name cache -- IF wiring supports it, else document + skip.

## Hard rules

- No em-dashes (hyphens). Statusline hot path = file reads only (no engine calls, no network). Byte-stable degrade with all caches absent. Part 7 reuse (extend, no parallel caches). Glyph fence (📊 🎯 ⚙️ only in the allowlist). Pre-commit gates active, never --no-verify. `node -c` every touched .cjs.
- Regression suites MUST stay green: 187 cockpit (124), 192-04 stance chip, quick(statusline-live).
- Extend the Plurai eval CSV (12-statusline-liveness-fidelity.csv) + keep the liveness gate in parity.
