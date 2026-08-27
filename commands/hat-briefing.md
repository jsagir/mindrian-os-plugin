---
name: hat-briefing
description: Consolidate Six Hats briefings from hat memory
help_jtbd: "Get a per-hat briefing from the AI team on your venture."
body_shape: C (Dashboard Grid)
hitl_shape: "F.8"
hitl_why: "Hat perspectives are consolidated from an independent set gathered in any order."
# Phase 267.3-06, ruled in 267.3-CLASSIFICATION.md (Row 15): first delivery at commands/hat-briefing.md:91, a per-hat panel synthesizing Larry's own accumulated Six-Hats analysis of the navigator's OWN venture material.
interactive_first_reward: methodology_reframe
body_shape_detail: 6-panel hat grid + synthesis strip
serves_jtbd: ["prepare-pitch"]
teaching: "When you have run several Six Hats sessions and need them consolidated, /mos:hat-briefing pulls the hat memory into one briefing. Best right before a stakeholder review."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["Six Thinking Hats"]
produces: "room/**/hat-briefing/*"
inputs: []
autonomous_safe: false
ui_reference: skills/ui-system/SKILL.md
# --- Phase 143.3 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: [SENS-07]
  reach_id: hats
  sub_mode: hat-briefing
  framework: "Six Thinking Hats"   # MUST match the existing frameworks: value
  posture: hold
  hierarchy_rank: 2
  filing: fileEvidenceWithReadback
  plan_gated: false
  web_scope: null
  surface: F.1
# --- Phase 130-03 lens-engine client frontmatter (READER, not rotator) ---
lens_type: cognitive
lens_set: six-hats
rotation_mode: consume
allowed-tools:
  - Read
  - Glob
  - Bash
  - AskUserQuestion
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

# /mos:hat-briefing

You are Larry. This command is a thin lens-engine READER, not a rotator. It does not run the rotation loop; it CONSUMES the prior lens output -- the six HatState nodes and the lens memory_event tail that think-hats and persona wrote through `lib/core/lens-engine.cjs` -- and consolidates them into one briefing. Each hat maintains persistent memory in its room.db HatState node across sessions; this briefing synthesizes their accumulated intelligence.

## Tri-Polar Design

- **CLI:** Full 6-panel briefing with synthesis, actionable next steps
- **Desktop:** Conversational summary with key tensions and opportunities highlighted
- **Cowork:** Shared briefing filed to room for team visibility

## Step 1: Load Hat States

Run the following to load all 6 hat states:

```bash
node -e "
  const { loadAllHatStates, getRecentLogs, HAT_LABELS } = require('./lib/core/hat-persistence.cjs');
  const roomDir = process.argv[1] || './room';
  const states = loadAllHatStates(roomDir);
  const logs = {};
  for (const color of Object.keys(states)) {
    logs[color] = getRecentLogs(roomDir, color, 7);
  }
  console.log(JSON.stringify({ states, logs, labels: HAT_LABELS }, null, 2));
" ./room
```

If all hat states show `session_count: 0` and no session logs exist, inform the user:

> "No hat perspectives have been recorded yet. Run `/mos:persona invoke {color}` on an artifact to start building hat memory, or run `/mos:persona analyze` for a full 6-hat sweep."

## Step 2: Build the Briefing

For each hat with active state (session_count > 0), create a panel:

### Panel Format (per hat)

```
## {Color} Hat -- {Label}
Sessions: {session_count} | Last: {last_analysis}
Focus: {current_focus}

**Top Concerns:**
{top_concerns as bullet list}

**Top Opportunities:**
{top_opportunities as bullet list}

**Recent Findings:**
{Summarize last 3 session log entries}
```

## Step 3: Synthesis Strip

After the 6 panels, generate a synthesis section:

### Key Tensions
Identify where hats disagree:
- Black Hat concerns vs Yellow Hat opportunities (risk-reward tension)
- White Hat data gaps vs Red Hat convictions (evidence-intuition tension)
- Green Hat alternatives vs Blue Hat process (creativity-structure tension)

### Convergence Signals
Where 2+ hats agree on the same insight from different angles, flag as high-confidence signal.

### Recommended Next Actions
Based on hat states, suggest:
1. Which hat perspective is most underdeveloped (lowest session_count)?
2. Which concerns need immediate investigation?
3. Which opportunities should be explored next?

## Step 4: Brain Enhancement (Optional)

If Brain MCP tools are not available, skip this step entirely and proceed to Output Format below.

If Brain is connected, run hat-aware framework recommendation:

```bash
node -e "
  const brain = require('./lib/core/brain-client.cjs');
  const roomDir = process.argv[1] || './room';
  brain.hatAwareRecommend(roomDir, 'general').then(r => console.log(JSON.stringify(r, null, 2)));
" ./room
```

If Brain returns results, add a section:

```
## Brain-Recommended Frameworks (Hat-Influenced)
{frameworks list with hat_score and why each was boosted/filtered}
```

## Output Format

Use Body Shape C (Dashboard Grid): 6 equal panels in a 2x3 or 3x2 layout, followed by the synthesis strip. Every panel uses the hat's De Stijl color association:

| Hat | Color Code |
|-----|-----------|
| White | Neutral/gray |
| Red | Mondrian red |
| Black | Dark/charcoal |
| Yellow | Mondrian yellow |
| Green | Growth green |
| Blue | Mondrian blue |

End with: *"Perspectives are lenses, not answers. The value is in the tensions between them."*
