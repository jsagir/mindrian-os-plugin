---
name: mva-pipeline
description: Auto-activates when UserPromptSubmit detection classifies the user's prompt as a venture sentence; relays the 30-second MVA brief in Larry's voice
auto-activate: state-file
state-file: ~/.mindrian/mva/<session-id>.json
state-condition: pending && !running
interactive_first_reward: instant_brief
canon_parts: [Part 2, Part 8, Part 10]
---

# The 30-second MVA skill

## When this activates

When Plan 118-00's UserPromptSubmit detection writes a pending state with
`pipeline_status: 'pending'` (or `hebrew_refusal: true`), this skill fires on
the NEXT model turn. The skill is the bridge between Plan 118-00's classifier
and Plan 118-03's orchestrator: it makes Larry the GUIDED narrator of the
brief without baking the orchestrator into Claude Code's hook protocol.

## What to do

1. Run `/mos:mva-brief` (or invoke `node scripts/mva-run.cjs` via Bash directly).
2. Relay the stdout to the user VERBATIM, in your normal Larry voice (no extra
   framing). The renderer already speaks in Larry's GUIDED voice; double-voicing
   breaks the pedagogical contract.
3. Wait for the user's option selection (1, 2, 3, or free-text).
4. Route per the footer behavior:
   - 1 -> stay in JUST_TALK; the brief stays visible; user can ask follow-ups
     about any cell ("tell me more about the Honeydue case", "what was the
     Gottman analogy?", etc.)
   - 2 -> invoke /mos:new-project (Phase 119 wrapper; in v1.13.0 this surfaces
     a stub message that the full room-build flow lands in beta.18)
   - 3 -> invoke /mos:challenge-assumptions against the brief

## What NOT to do (per feedback_larry_pedagogical_guided_first.md)

- Do NOT add commentary or "I noticed..." preamble before the rendered output.
  The renderer already opens with "Scanning for precedents..." in Larry's
  GUIDED voice.
- Do NOT interpret findings autonomously ("This means you should..."). The
  rendered output IS GUIDED -- it asks the user to think; the renderer
  surfaces what's in the graph and lets the navigator chew on it.
- Do NOT skip the 3-option footer. Even if all agents failed, the
  sharp-question fallback substitutes for the footer (per binding decision B7);
  the renderer handles this -- you just relay verbatim.
- Do NOT pre-pick an option. The user picks. That's the decision gate.

## Canon parts implemented

- Part 2 (team around navigator -- 6 agents as a parallel team, with the skill
  being the surface Larry uses to relay the team's output)
- Part 8 (boundary -- the agents send ONLY generic handles to Brain and
  Tavily; the renderer + skill never re-introduce user content)
- Part 10 sub-claim 3 (room as receipt -- the brief IS the reward delivered
  BEFORE the user is asked to invest in setting up a room; option 2 is the
  ask-for-investment that comes AFTER the reward, per Hooked sequencing)

## State file contract

Read from `~/.mindrian/mva/<session-id>.json` (the Plan 118-00 wire):

```
{
  "sentence_sha256":       "<64-hex>",      // NEVER the raw sentence
  "classified_at":         <epoch_ms>,
  "classifier_source":     "heuristic" | "heuristic_fallback" | "haiku-4-5",
  "classifier_confidence": "high" | "medium" | "low",
  "locale":                "en" | "he",
  "hebrew_refusal":        true,            // optional, set on LD1 short-circuit
  "pipeline_status":       "pending" | "running" | "complete"
}
```

On `hebrew_refusal:true`, the orchestrator renders the bilingual refusal block
and DOES NOT fire the dispatcher (per LD1 in 118-CONTEXT.md).
