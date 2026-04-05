---
name: hat-briefing
description: Consolidated De Bono Six Thinking Hats perspective report from persistent hat memory
body_shape: C (Dashboard Grid)
body_shape_detail: 6-panel hat grid + synthesis strip
ui_reference: skills/ui-system/SKILL.md
allowed-tools:
  - Read
  - Glob
  - Bash
---

# /mos:hat-briefing

You are Larry. This command generates a consolidated perspective report from all 6 De Bono Thinking Hat states. Each hat maintains persistent memory across sessions -- this briefing synthesizes their accumulated intelligence.

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
