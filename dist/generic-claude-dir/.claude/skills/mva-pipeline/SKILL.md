---
name: mva-pipeline
description: Auto-activates when UserPromptSubmit detection classifies the user's prompt as a venture sentence; relays the 30-second MVA brief in Larry's voice
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
auto-activate: state-file
state-file: ~/.mindrian/mva/<session-id>.json
state-condition: pending && !running
interactive_first_reward: instant_brief
canon_parts: [Part 2, Part 8, Part 10]
# --- Phase 143.3 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: context_block
  sub_mode: mva-pipeline
  posture: push_forward
  hierarchy_rank: 12
  filing: memory_event_only
  plan_gated: false
  web_scope: null
  surface: F.1
hitl_shape: "F.1"
hitl_why: "The 30-second brief closes with a numbered option-or-free-text choice (1/2/3/free-text), the canonical F.1 Next Move shape."
---

<!-- mos:firing-block v2 -->
At this skill's Decision Gate, when the fork is genuinely unanswered and relevant to the
current conversation, fire the AskUserQuestion card natively rather than printing a bare
numbered menu or bullet list. Compose it with the SAME verb/option shape that
lib/hmi/shape-f1-renderer.cjs (renderShapeF1) produces and that lib/hmi/selector-dispatcher.cjs
(appendAskUserQuestionTrailer) fires, matching this skill's declared hitl_shape. Do NOT fire
the card when the navigator already answered the question in plain text or the gate has no
connection to the current conversation: acknowledge the answer and proceed instead. Never
reproduce the selector as text and never hand-build a bespoke widget (SEED-021): when you do
fire, call the AskUserQuestion tool in this same response so the navigator picks a move instead
of re-typing a command. Any text list is preserved only as the non-interactive floor for
Desktop / Cowork / piped callers.
<!-- /mos:firing-block -->

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

## Routing the 3-option footer (after the brief renders)

Once `/mos:mva-brief` (or the orchestrator) has rendered the brief to the user,
the user's next message is most likely an option selection. Recognition rule:

- User types exactly `1`, `2`, or `3` -> invoke `/mos:mva-option <N>` (no sha8
  argument needed; the command auto-resolves via `resolveCurrentSha8()`)
- User types `/mos:mva-option N` explicitly -> invoke `/mos:mva-option <N>`
  (sha8 still optional; auto-resolved when omitted)
- User types anything else -> handle as a normal conversation turn (do NOT
  route through `mva-option`)

The sha8 argument is OPTIONAL because the router auto-discovers the most
recent brief via `resolveCurrentSha8()` -> `~/.mindrian/mva/state.json` (the
manifest written by Plan 118-03's orchestrator after `mva_brief_rendered`).

### Per-option behavior

Option 1 -- "Just tell me what's new" (stay in tell-me mode):
- Acknowledgment: "Keeping the brief visible. Ask me anything about what you just saw."
- Operator: transitions to `JUST_TALK`
- Brief stays in scrollback; follow-up questions about any of the 6 cells are welcome

Option 2 -- "Build a room around this" (invest, deferred):
- Show the stub message verbatim from `STUB_MESSAGE_119`:
  "Building a room around this is the next layer; shipping in beta.18 (Phase 119). For now, press option 1 to keep this brief visible, or option 3 to go deeper."
- Operator: no transition (option 2 is stubbed for v1.13.0)
- In v1.13.0-beta.18 (Phase 119), this routes to `/mos:new-project --from-brief <sha8>`

Option 3 -- "Challenge me -- Devil's Advocate" (go deeper):
- Bridge text: "Going deeper. Pulling the brief into a Devil's Advocate pass."
- Operator: transitions to `METHODOLOGY`
- Invoke: `/mos:challenge-assumptions --from-brief <sha8>`

### Edge cases

- Brief data expired (side-file missing): tell the user the brief expired and
  offer to re-run by typing their venture sentence again.
- Brief is still rendering (`mva_brief_rendered` event not yet emitted): hold
  the option, tell the user "Brief is still rendering -- options will activate
  when it completes".
- No `state.json` exists (fresh install or Hebrew refusal path): tell the user
  "No recent brief found. Type your venture sentence to fire the pipeline."
- Invalid option (`4`, `99`, etc.): treat as free-text and route normally.

### Do NOT

- Do NOT autonomously pick an option for the user.
- Do NOT pre-summarize what option 2 "would do" -- the stub message says it.
- Do NOT add em-dashes to any rendered option text -- use `--` only.
- Do NOT invoke `/mos:new-project` for option 2 in v1.13.0 -- that wiring
  lands in Phase 119 (beta.18).
