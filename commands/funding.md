---
name: funding
description: Track grant opportunities through their lifecycle
help_jtbd: "See the grants and funding paths matching your room."
argument-hint: "[list|add|update]"
body_shape: B (Semantic Tree)
hitl_shape: "F.8"
hitl_why: "Grant-lifecycle candidates are surfaced as an independent set the navigator triages in any order."
# Phase 267.3-06, ruled in 267.3-CLASSIFICATION.md (Row 13, navigator-ruled NEEDS-RULING): first delivery at commands/funding.md:57, a stage/deadline/staleness tracking report of the navigator's own pipeline, not the Tavily-sourced discovery flow the rule doc's worked example names.
interactive_first_reward: "--none (diagnostic surface)"
serves_jtbd: ["prepare-pitch", "decide-pursue"]
teaching: "When you need to track grants and investors as a real pipeline, /mos:funding manages the lifecycle from spotted to applied to decided. Funding is a process, not a one-shot event."
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - AskUserQuestion
# --- Phase 143.3 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: [SENS-07]
  reach_id: context_block
  sub_mode: funding
  framework: null
  posture: hold
  hierarchy_rank: 37
  filing: none
  plan_gated: false
  web_scope: null
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

# /mos:funding

> Track grant opportunities through the funding lifecycle. Promote discoveries from opportunity-bank, advance through stages, and monitor your funding pipeline.

## Subcommands

### `list`

Show funding pipeline: all entries grouped by stage with deadlines and days-since-update.

**Example:** "Show me my funding pipeline" or `/mos:funding list`

Larry displays entries organized by stage (Discovered > Researched > Applying > Submitted), highlights upcoming deadlines, and flags stale entries that haven't been updated in 14+ days.

### `create [opportunity-slug]`

Promote an opportunity from opportunity-bank to the funding pipeline. Creates a per-opportunity folder at `room/funding/{slug}/` with initial stage **Discovered**.

**Example:** "Start tracking the NSF SBIR grant" or `/mos:funding create nsf-sbir-phase1`

This creates:
- `STATUS.md` with stage: discovered, wikilink to source opportunity
- `metadata.yaml` with structured data from the opportunity artifact

The funding entry cross-references its source via `[[opportunity-bank/{source}]]` wikilink, creating a graph edge back to the discovery.

### `advance [slug]`

Move a funding entry to the next stage. Larry confirms the transition and asks for a note. Stage order is enforced:

```
Discovered  -->  Researched  -->  Applying  -->  Submitted
```

No skipping stages. No going backward. Each transition is recorded in `transition_history`.

**Example:** "Advance NSF SBIR to researched" or `/mos:funding advance nsf-sbir-phase1`

### `status [slug]`

Show detailed status of a specific funding entry including full transition history, source opportunity link, and metadata.

**Example:** "What's the status of the NSF SBIR?" or `/mos:funding status nsf-sbir-phase1`

### `outcome [slug] [awarded|rejected|withdrawn]`

Set the outcome attribute on a funding entry. **Outcomes are NOT stages** -- they are a separate attribute that records the result:

| Outcome | When |
|---------|------|
| `awarded` | Funder approved the application (only at Submitted stage) |
| `rejected` | Funder declined the application (only at Submitted stage) |
| `withdrawn` | User withdrew at any stage |

**Example:** "Mark NSF SBIR as awarded" or `/mos:funding outcome nsf-sbir-phase1 awarded`

## Design Note

The 4-stage lifecycle (Discovered > Researched > Applying > Submitted) tracks WHERE in the process an opportunity is. The outcome attribute tracks the RESULT. This separation is intentional -- an opportunity at "Submitted" stage can have outcome "awarded", "rejected", or "withdrawn". Stage and outcome answer different questions.

## Pipeline Intelligence

Run `/mos:funding list` regularly to see:
- Pipeline health (distribution across stages)
- Deadline pressure (upcoming deadlines sorted)
- Stale entries (14+ days without update need attention)

The `compute-opportunity-state` script aggregates all funding entries into `room/funding/STATE.md` for session-start intelligence.
