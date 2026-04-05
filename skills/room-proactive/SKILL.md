---
name: room-proactive
description: >
  Proactive Data Room intelligence. Surfaces gaps, contradictions, and convergence
  signals. Active when room/ exists with entries.
activation: "dir_exists:room"
---

# Room Proactive -- Gap, Contradiction, and Convergence Detection

The Room is an active thinking partner. This skill surfaces what is missing, conflicting, and strengthening.

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

## Contradiction Detection

Scan for incompatible claims: customer type, market size, problem definition, timing assumptions.

Frame as tensions worth reconciling. Check `created:` dates -- natural evolution (old X -> recent Y) is progress, not contradiction.

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
