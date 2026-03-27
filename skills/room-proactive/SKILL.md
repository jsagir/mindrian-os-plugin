---
name: room-proactive
description: >
  Proactive Data Room intelligence. Surfaces gaps, contradictions, and convergence
  signals. Active when room/ exists with entries.
---

# Room Proactive -- Gap, Contradiction, and Convergence Detection

The Room is not just storage -- it is an active thinking partner. This skill gives you the ability to surface what is missing, what conflicts, and what is strengthening across the user's venture work.

## When to Activate

| Trigger | Behavior |
|---------|----------|
| **SessionStart** | Run lightweight analysis. Surface at most 2 HIGH-confidence findings in greeting. Prioritize 1 gap + 1 convergence (or 1 contradiction). Keep it brief -- one sentence each. |
| **/mos:status** | Include all HIGH + MEDIUM findings in status output. Group by type (Gaps, Convergence, Contradictions). |
| **/mos:room --insights** | Full analysis including LOW confidence. Provide detailed interpretation and actionable suggestions. |
| **During methodology session** | NEVER interrupt a methodology session with proactive findings. The user is deep in focused work. Save findings for the next SessionStart or status check. |

## Gap Detection

Beyond structural gaps (empty sections detected by `compute-state`), detect semantic gaps:

- **Single-lens gap**: Section has entries but all from the same methodology. The user explored one angle but not others. Phrase as opportunity: "Your market-analysis has trend data but no customer evidence -- consider /mos:analyze-needs."
- **Evidence gap**: Section has entries but none with validation or evidence markers. Conceptual work without grounding.
- **Adjacent section gap**: Connected sections filled but bridging section empty. Problem and solution explored but no market analysis connecting them.
- **Depth gap**: Section has entries but all at `depth: quick`. No deep dives yet.

Always phrase gaps as opportunities, not criticisms. Suggest specific commands when possible.

## Contradiction Detection

Scan Room entries for incompatible claims across sections:

- **Customer type**: One section targets enterprise, another targets individual consumers
- **Market size**: Wildly different TAM/SAM assertions in different entries
- **Problem definition**: Core problem described differently across frameworks
- **Timing assumptions**: Some entries assume urgent market, others assume long horizon

**Phrasing rule**: Frame as tensions worth reconciling, not errors:
- Good: "Your Domain Explorer says 'enterprise IT' but your Lean Canvas targets 'individual developers' -- worth reconciling."
- Bad: "Error: contradictory customer types detected."

**Time-awareness**: Only flag contradictions between entries from similar time periods. If earlier entries say X and recent entries say Y, that is likely a pivot (progress), not a contradiction. Check the `created:` frontmatter date. Natural evolution is signal, not noise.

## Convergence Detection

Multiple frameworks reaching similar conclusions independently is a strong signal:

- **Domain convergence**: Same domain appears in 3+ artifacts from different methodologies
- **Customer convergence**: Same customer segment identified by different frameworks
- **Risk convergence**: Same risk flagged by multiple analyses
- **Theme convergence**: Same keyword or concept appears across different sections

Phrase as signal strength:
- "Three frameworks independently identified 'aging water infrastructure' -- this convergence suggests a strong problem signal."
- "Both your Domain Explorer and Lean Canvas point to 'small municipalities' as the target customer -- this alignment strengthens your focus."

## Confidence Scoring

| Level | Criteria | Display Rule |
|-------|----------|--------------|
| **HIGH** | Direct structural evidence (empty section, 3+ supporting entries, clear keyword conflict) | Show in SessionStart greeting |
| **MEDIUM** | 2 supporting entries, keyword overlap, single-lens detection | Show in /mos:status |
| **LOW** | Single entry inference, weak keyword match, speculative connection | Show only on explicit request (/mos:room --insights) |

## Noise Gate

Proactive intelligence must be helpful, not noisy. Strict gating rules:

1. **SessionStart**: Maximum 2 findings. Prioritize 1 gap + 1 convergence (or 1 contradiction if HIGH confidence). Never more than 2.
2. **Never interrupt methodology sessions**: If the user is running a methodology command, suppress all proactive output. Wait for the next SessionStart.
3. **Venture stage filtering**:
   - **Pre-Opportunity**: Suppress gap alerts for `financial-model` and `legal-ip` -- these are not relevant yet. Focus on problem and market gaps.
   - **Investment**: Elevate all empty section gap alerts to HIGH -- at this stage, gaps matter more.
4. **Repeat suppression**: Do not surface the same finding in consecutive sessions unless something changed. If the user saw "market-analysis is empty" yesterday and has not added entries, do not repeat it.

## Reading analyze-room Output

When the `analyze-room` script output is available in session context (injected by session-start hook), parse the structured lines and use them as starting points:

- `GAP:STRUCTURAL:{section}:{confidence}:{message}` -- Empty section. Add context about what the section needs.
- `GAP:SEMANTIC:{section}:{confidence}:{message}` -- Single-lens. Suggest complementary methodologies.
- `GAP:ADJACENT:{section}:{confidence}:{message}` -- Missing bridge. Explain why the connection matters.
- `CONVERGE:{term}:{count}:{confidence}:{message}` -- Theme convergence. Interpret what it means for the venture.
- `CONTRADICT:{section1}:{section2}:{confidence}:{message}` -- Structural conflict. Help the user reconcile.

The script catches structural patterns; you add semantic interpretation. Read the actual Room entries to provide specific, contextual advice beyond what the script can detect.

## Capability Suggestions

The `analyze-room` script also emits `CAPABILITY:` signals when the room has enough data to make visualization and export features meaningful. These surface commands the user may not know about.

### Signal Format

```
CAPABILITY:{feature}:{confidence}:{message with suggested command}
```

### Features Detected

| Feature | Threshold | Command |
|---------|-----------|---------|
| **DASHBOARD** | 3+ artifacts | `/mos:room view` -- interactive Cytoscape knowledge graph |
| **EXPORT_DASHBOARD** | 7+ artifacts | `/mos:room export` -- standalone shareable HTML |
| **WIKI** | 5+ artifacts + 1+ meeting | `/mos:wiki` -- searchable Wikipedia-style room browser |
| **MEETING_REPORT** | 3+ artifacts + 2+ meetings | `/mos:export meeting-report` -- Minto intelligence report |
| **THESIS** | 10+ artifacts | `/mos:export thesis` -- investment thesis PDF |
| **TEAM_VIEW** | 2+ team profiles | `/mos:room view` -- team nodes in the graph |

### Display Rules

- **SessionStart**: Include at most 1 CAPABILITY suggestion alongside the 2 intelligence findings. Choose the highest-confidence one. Frame it as a natural suggestion, not a sales pitch.
- **Example**: "Your room has 8 artifacts with convergence signals -- try `/mos:room view` to see the knowledge graph."
- **Never repeat**: If the user has already used the suggested command (check for `room/data-room-dashboard.html` existence for export, or `room/.lazygraph/` for wiki), do not suggest it again.
- **Natural voice**: Weave the suggestion into Larry's greeting, not as a separate block. It should feel like a mentor pointing out a tool on the workbench, not a feature announcement.

### CRITICAL: Dashboard Export Integrity

When a user asks for a dashboard, room visualization, or export:
- **ALWAYS** use `scripts/generate-standalone` or `scripts/serve-dashboard`
- **NEVER** generate HTML by hand -- the template at `dashboard/index.html` has the full Cytoscape graph, De Stijl styling, intelligence panel, layer toggles, preset views, timeline mode, and chat UI
- Improvised HTML will always be inferior to the real template
