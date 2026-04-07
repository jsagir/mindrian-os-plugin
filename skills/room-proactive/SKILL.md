---
name: room-proactive
description: >
  Proactive Data Room intelligence. Surfaces gaps, contradictions, and convergence
  signals. Active when room/ exists with entries.
activation: "resolve_room:active"
---

# Room Proactive -- Gap, Contradiction, and Convergence Detection

The Room is an active thinking partner. This skill surfaces what is missing, conflicting, and strengthening.

## Skill Activation

This skill activates when `scripts/resolve-room` finds any active room with entries. The resolver checks (in order): central registry at `~/MindrianRooms/.rooms/registry.json`, directory scan under `~/MindrianRooms/`, workspace registry, and legacy `room/` fallback. All analysis below operates on the resolved room path.

## Activation Triggers

| Trigger | Behavior |
|---------|----------|
| SessionStart | Max 2 HIGH findings. Prioritize 1 gap + 1 convergence (or contradiction). |
| /mos:status | All HIGH + MEDIUM findings grouped by type. |
| /mos:room --insights | Full analysis including LOW with interpretation. |
| Methodology session | NEVER interrupt. Save for next SessionStart. |

## Gap Detection

- **Single-lens:** All entries from same methodology. Suggest complementary.
- **Evidence gap:** Entries without validation/evidence markers.
- **Adjacent section:** Connected sections filled, bridging section empty.
- **Depth gap:** All entries at `depth: quick`.

Phrase as opportunities, not criticisms. Suggest specific commands.

### Team-Execution Leadership Signals

Detect these conditions in `room/team-execution/` and `room/team/`:

| Signal | Condition | Confidence | Message |
|--------|-----------|------------|---------|
| `GAP:TEAM:no_profiles` | team-execution/ has 0 member profiles AND team/members/ empty or missing | HIGH | "No team mapped yet. Leadership starts with knowing who you're leading. Try: /mos:leadership" |
| `GAP:TEAM:no_mentors` | team/mentors/ empty or missing AND 3+ team members exist | MEDIUM | "Team of [N] with no advisors mapped. Most ventures this size benefit from external perspective." |
| `GAP:TEAM:solo_founder` | Only 1 person in team/ AND venture_stage past Pre-Opportunity | MEDIUM | "Solo at [stage] stage. The question isn't if you need a team -- it's what kind." |
| `GAP:TEAM:no_assessment` | team-execution/ has member profiles but no leadership assessment artifact | MEDIUM | "Team profiles exist but no leadership assessment. Run /mos:leadership to diagnose team dynamics." |
| `GAP:TEAM:stale_assessment` | Leadership assessment artifact older than 30 days AND room has new entries | LOW | "Leadership assessment is [N] days old. Team dynamics shift -- worth revisiting." |

## Contradiction Detection

Scan for incompatible claims: customer type, market size, problem definition, timing assumptions.

Frame as tensions worth reconciling. Check `created:` dates -- natural evolution (old X -> recent Y) is progress, not contradiction.

### Team-Execution Contradictions

| Signal | Condition | Confidence | Message |
|--------|-----------|------------|---------|
| `CONTRADICT:TEAM:capacity_mismatch` | solution-design requires capabilities not present in any team profile | HIGH | "Solution design needs [capability] but no team member covers it. Hire, partner, or simplify?" |
| `CONTRADICT:TEAM:stage_mismatch` | Team structure suggests Ready to Build but venture_stage is Pre-Opportunity | MEDIUM | "Full team assembled but problem isn't validated yet. Building before validating is the #1 startup killer." |

## Convergence Detection

Same domain/customer/risk/theme in 3+ artifacts from different methodologies. Phrase as signal strength.

## Confidence Scoring

| Level | Criteria | Display |
|-------|----------|---------|
| HIGH | Direct structural evidence, 3+ entries, clear conflict | SessionStart |
| MEDIUM | 2 entries, keyword overlap, single-lens | /mos:status |
| LOW | Single entry inference, weak match | Explicit request only |

## Noise Gate

1. SessionStart: max 2 findings
2. Never interrupt methodology
3. Stage filtering: Pre-Opportunity suppresses financial/legal gaps. Investment elevates all gaps.
4. Never repeat unchanged findings consecutive sessions

## analyze-room Signal Format

- `GAP:STRUCTURAL:{section}:{confidence}:{message}`
- `GAP:SEMANTIC:{section}:{confidence}:{message}`
- `GAP:ADJACENT:{section}:{confidence}:{message}`
- `CONVERGE:{term}:{count}:{confidence}:{message}`
- `CONTRADICT:{section1}:{section2}:{confidence}:{message}`

Script catches structural patterns; add semantic interpretation from actual Room entries.

## Capability Suggestions

`CAPABILITY:{feature}:{confidence}:{message}` signals when room has enough data for features:

| Feature | Threshold | Command |
|---------|-----------|---------|
| DASHBOARD | 3+ artifacts | `/mos:room view` |
| EXPORT_DASHBOARD | 7+ artifacts | `/mos:room export` |
| WIKI | 5+ artifacts + 1+ meeting | `/mos:wiki` |
| MEETING_REPORT | 3+ artifacts + 2+ meetings | `/mos:export meeting-report` |
| THESIS | 10+ artifacts | `/mos:export thesis` |
| TEAM_VIEW | 2+ team profiles | `/mos:room view` |
| LEADERSHIP_COACHING | 2+ team members + no leadership artifact | `/mos:leadership` |

Max 1 capability suggestion per SessionStart. Natural voice. Never repeat used commands.

## Causal Discovery Surfacing (v1.7.0)

Surface causal discoveries when graph has 5+ CausalClaim nodes AND 3+ CASCADES_TO edges:
- CausalClaim + HSI_CONNECTION: explain the cause-effect behind similarity
- CausalClaim through REVERSE_SALIENT: show chain to bottleneck root
- CausalClaim + ANALOGOUS_TO: structural match prediction
- Overdue predictions: prompt review
- Cascade depth >3: warn about blast radius

## Dashboard Export Integrity

ALWAYS use `scripts/generate-standalone` or `scripts/serve-dashboard`. NEVER generate HTML by hand.
