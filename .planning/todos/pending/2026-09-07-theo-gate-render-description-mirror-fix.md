---
created: 2026-09-07T00:00:00.000Z
title: Mirror the gate_render description fix (plan 276-11) into Theo's own checkout
area: theo-coordination
files:
  - docs/2026-09-03-THEO-SEED-tool-honesty-ts-ast-port.md
  - /home/jsagi/Theo/src/mcp/operational/gate-render.ts (cross-repo target, NOT in this checkout)
---

## Problem

Phase 276 plan 276-11 (this repo) corrected `gate_render`'s tool description in
`lib/mcp/tools/gate.cjs` so it stops implying its minted gate_id is persistent
("Returns a gate_id minted into this server process's in-memory ledger, which
gate_answer must reference to ratify; nothing is persisted and the id does not
survive a restart.") -- D-276-3's ruling: an in-memory ledger mint is not
persistence, and the word "minted" alone reads as durable to a caller.

Theo ships its own copy of `gate_render` (`src/mcp/operational/gate-render.ts:89-93`,
`GATE_RENDER_DESCRIPTION`). This is one of the tools Theo absorbed from the plugin
(D-276-6: of Phase 276's 24 findings, `gate_render` is the only one landing on a
Theo-absorbed tool). Theo's copy still carries the PRE-fix text and has not moved.
Measured live against Theo checkout HEAD `dfb44b2` (full `dfb44b297b790b6b807b566d82f7d2389eb1da42`)
in plan 276-13: `GATE_RENDER_DESCRIPTION` differs at byte offset 266 (plugin 429
bytes / Theo 323 bytes).

The exact replacement text (verbatim, do not re-derive):

> "Render the Mindrian gate superset card (options + per-option descriptions + ranks
> + previews + single/multi-select) via the capability-detected 3-rung renderer
> ladder: MCP elicitation, Claude Code AskUserQuestion thin adapter, or headless
> structured text. Returns a gate_id minted into this server process's in-memory
> ledger, which gate_answer must reference to ratify; nothing is persisted and the
> id does not survive a restart."

Full context and the "why," already written up: `docs/2026-09-03-THEO-SEED-tool-honesty-ts-ast-port.md`,
Section 1 ("the owed mirror task (actionable, do this first)").

## Solution

1. Open the `/home/jsagi/Theo` checkout (a SEPARATE repo -- this fix cannot be applied
   from here; MindrianOS-Plugin's own D-04-equivalent rule and Theo's own D-04
   ("coordinated, never executed cross-repo") both forbid pushing this fix directly
   from a MindrianOS-Plugin session).
2. Run Theo's own `/gsd-capture` (or whatever GSD entry point that repo uses for a
   small, scoped fix) with this todo's content as the input, so the fix lands through
   THAT repo's own review/commit discipline, not a drive-by edit.
3. Update `GATE_RENDER_DESCRIPTION` in `src/mcp/operational/gate-render.ts:89-93` to
   the verbatim text above (whole-constant replacement, not a partial patch -- the
   quoted paragraph above is the entire description, so the mirror should replace all
   of it).
4. Re-measure both copies byte-for-byte (the same check plan 276-13 ran) to confirm
   the divergence is closed, and note the confirming commit hash back into
   `docs/2026-09-03-THEO-SEED-tool-honesty-ts-ast-port.md` or a follow-up entry.

No decision left to make here -- the text, the file, the line numbers, and the
reasoning are all already nailed down. This is pure execution, gated only on someone
being in the Theo checkout to do it.
