---
name: correct-reference-now
description: Correct the reference clock when the model-known date diverges from the seeded floor
help_jtbd: "Keep one trustworthy now so time deltas never drift."
body_shape: E
hitl_shape: "F.0"
hitl_why: "It surfaces one reference correction for a single approve-or-reject decision."
# Phase 267.3-06, ruled in 267.3-CLASSIFICATION.md (Row 4): first delivery at commands/correct-reference-now.md:76, a one-line confirmation that a LOCAL clock-seam correction was applied.
interactive_first_reward: "--none (diagnostic surface)"
argument-hint: "[YYYY-MM-DD]"
serves_jtbd: ["temporal-correction"]
teaching: "When you see today's real date diverge from what the room thinks now is, /mos:correct-reference-now writes the true calendar date into the reference seam so every delta Larry speaks (you raised this 3 days ago) stays honest. The SessionStart hook only seeds a Date.now() floor, and a hook subprocess may not see Claude Code's injected currentDate. This command is how Larry closes that gap."
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
# --- Phase 172-06 CIRS R1 exclude (Canon Part 11) ---
connector:
  excluded: true
  reason: "Lifecycle command. A reference-correction maintenance action the navigator runs deliberately to fix a citation; an upkeep surface, not a problem-state reach."
---

<!-- mos:firing-block v2 -->
At this command's Decision Gate, when the fork is genuinely unanswered and relevant to the
current conversation, fire the AskUserQuestion card natively rather than printing a bare
numbered menu or bullet list. Compose it with the SAME verb/option shape that
lib/hmi/shape-f1-renderer.cjs (renderShapeF1) produces and that lib/hmi/selector-dispatcher.cjs
(appendAskUserQuestionTrailer) fires, matching this command's declared hitl_shape. Do NOT fire
the card when the navigator already answered the question in plain text or the gate has no
connection to the current conversation: acknowledge the answer and proceed instead. Never
reproduce the selector as text and never hand-build a bespoke widget (SEED-021): when you do
fire, call the AskUserQuestion tool in this same response so the navigator picks a move instead
of re-typing a command. Any text list is preserved only as the non-interactive floor for
Desktop / Cowork / piped callers.
<!-- /mos:firing-block -->

# /mos:correct-reference-now

You are Larry. This tiny command corrects the LOCAL reference-now seam so the one
authoritative "now" matches the calendar date you actually see in your context.

## Why this exists (D-01 hybrid)

The SessionStart hook (`scripts/sessionstart-reference-now-seed.cjs`) seeds
`~/.mindrian/reference-now.json` with a `Date.now()` floor. But a hook subprocess
may not receive Claude Code's injected `currentDate` system-reminder. You DO see
it. When the model-known date diverges from the seeded floor, you correct the
seam here. This keeps every downstream delta (recency ranking, "you raised this 3
days ago", bitemporal valid-time) anchored to one trustworthy reference.

Canon Part 8: this is pure LOCAL bookkeeping. It writes one LOCAL file. It makes
ZERO Brain query and reads ZERO room data. Canon Part 7: all logic lives in
`lib/core/temporal/reference-now.cjs`; this command is a thin shell over
`applyCurrentDate` + `writeSeam`.

## What you do

1. Read the calendar date from your own context (Claude Code's injected
   `currentDate`, format `YYYY-MM-DD`). If the user passed an explicit
   `$ARGUMENTS` date, prefer that.

2. Compare it to the seeded floor. Read the current seam:

   ```bash
   node -e "const r=require('${CLAUDE_PLUGIN_ROOT}/lib/core/temporal/reference-now.cjs'); console.log(JSON.stringify(r.readSeam()||{}, null, 2))"
   ```

   If the seam's floor already lands on the same calendar date, tell the user the
   reference is already correct and STOP. Do not write redundantly.

3. If the dates diverge, correct the seam. Substitute the real date for
   `YYYY-MM-DD`:

   ```bash
   node -e "const r=require('${CLAUDE_PLUGIN_ROOT}/lib/core/temporal/reference-now.cjs'); const base=Date.now(); const corrected=r.applyCurrentDate('YYYY-MM-DD', base); if(corrected==null){console.error('bad date');process.exit(1);} const w=r.writeSeam(undefined,{floorMs:corrected,source:'currentDate'}); console.log(JSON.stringify({ok:w.ok, floorMs:corrected, iso:new Date(corrected).toISOString()}));"
   ```

4. Confirm the correction to the user in one calm line: the reference clock now
   reads the corrected date, and every time delta Larry speaks from here is
   anchored to it.

## Notes

- `applyCurrentDate` returns `null` on a malformed date string; the command above
  exits non-zero in that case, so a bad date never corrupts the seam.
- The seam degrades gracefully: if this command never runs, `getReferenceNow()`
  still returns the seeded `Date.now()` floor. This command only sharpens the
  calendar date when you can see it and the floor cannot.
