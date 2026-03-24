# Opportunity Artifact Template

> Standard frontmatter schema for filing opportunities to `room/opportunity-bank/`.
> Every opportunity artifact follows this template.

## Frontmatter Schema

```yaml
---
methodology: opportunity-scan
created: YYYY-MM-DD
source: grants-gov | simpler-grants | web-research | manual | brain
source_url: https://...
opportunity_id: "PROGRAM-YYYY-NNN"
funder: Organization Name
program: Program Name
amount_floor: 0
amount_ceiling: 275000
deadline: YYYY-MM-DD
eligibility:
  - small-business
  - us-entity
funding_category: science-technology
relevance_score: 0.85
relevance_reasoning: "Why this opportunity fits the room context"
room_connections:
  - section: problem-definition
    relationship: INFORMS
    reasoning: "How this connects"
  - section: financial-model
    relationship: ENABLES
    reasoning: "How this connects"
status: discovered
rejection: null
---
```

## Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `methodology` | string | yes | Always `opportunity-scan` |
| `created` | date | yes | Date opportunity was filed |
| `source` | enum | yes | Discovery source: grants-gov, simpler-grants, web-research, manual, brain |
| `source_url` | url | no | Direct link to opportunity listing |
| `opportunity_id` | string | no | External identifier from source system |
| `funder` | string | yes | Organization providing funding |
| `program` | string | yes | Specific program or grant name |
| `amount_floor` | number | no | Minimum award amount (0 if unknown) |
| `amount_ceiling` | number | no | Maximum award amount |
| `deadline` | date | no | Application deadline (null if rolling) |
| `eligibility` | list | no | Eligibility categories (small-business, nonprofit, university, etc.) |
| `funding_category` | string | no | Domain category (science-technology, health, education, etc.) |
| `relevance_score` | float | yes | 0.0-1.0 relevance to room context |
| `relevance_reasoning` | string | yes | Natural language explanation of relevance |
| `room_connections` | list | yes | Typed edges to room sections (section, relationship, reasoning) |
| `status` | enum | yes | discovered, filed, promoted, rejected |
| `rejection` | string | no | Reason if user rejected (rejection IS data) |

## Filing Instructions for Larry

1. Extract room context: problem domain, geography, venture stage, team profile
2. Generate search queries from room context (context-driven, NOT hardcoded)
3. Present discovered opportunities to user with relevance reasoning
4. User confirms -> file with full provenance using this template
5. User rejects -> capture rejection reason in `rejection` field
6. After filing, scan for cross-references to other room sections
7. File as `YYYY-MM-DD-{slug}.md` in `room/opportunity-bank/`

## Naming Convention

```
room/opportunity-bank/
  STATE.md                        # Section summary
  2026-03-20-nsf-sbir.md          # Filed opportunity
  2026-03-22-doe-clean-energy.md  # Filed opportunity
```

## Relationship Types

Use standard cross-relationship patterns from `references/meeting/cross-relationship-patterns.md`:
- **INFORMS** -- opportunity relates to a section's domain
- **ENABLES** -- funding would unblock progress in a section
- **CONVERGES** -- opportunity scope aligns with multiple sections
