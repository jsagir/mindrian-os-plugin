---
icm_layer: 3
purpose: Stable configuration for the Phase 80 vault import pipeline
audience: vault-import.cjs, classifier, router, enricher
editable: once per workspace
---

# Import Config -- Layer 3 Reference

This file is the single source of truth for classifier thresholds, role
detection keywords, and the frontmatter promotion map used by every stage
of the vault import pipeline (`scripts/vault-import.cjs` + `lib/import/*`).

It is Layer 3 in ICM terms: stable across runs, edited once per workspace,
consumed by stages as read-only reference data. Do NOT write per-run data
here -- per-run state lives in `imports/{id}/MANIFEST.json`.

---

## Confidence Thresholds

Confidence scores are floats in the inclusive range [0.0, 1.0]. The three
routing decisions are computed purely from the classifier-produced score.

| Decision | Confidence range   | Routing behavior                              |
|----------|--------------------|-----------------------------------------------|
| AUTO     | confidence >= 0.75 | Route directly to the suggested section      |
| SUGGEST  | 0.45 - 0.74        | Route to `inbox/suggested/{slug}/{slug}.md`  |
| INBOX    | confidence < 0.45  | Route to `inbox/unclassified/{slug}/{slug}.md` |

```json
{
  "auto_threshold": 0.75,
  "suggest_threshold": 0.45
}
```

Review-gate edits can override any row in `02-classify/output/classifications.md`.
The router reads the edited table, not the raw classifier output.

---

## Role Buckets

Person detection produces a role guess per detected person. The guess is
heuristic: the first bucket whose keyword list matches any mention context
wins. Unmatched people land in `unassigned`. Larry can reassign at the
review gate.

```yaml
role_buckets:
  core-team:
    keywords:
      - founder
      - co-founder
      - cofounder
      - CEO
      - CTO
      - COO
      - CFO
      - head of
      - VP
      - our team
      - we built
      - team lead
  consultants:
    keywords:
      - consultant
      - contractor
      - freelance
      - hired
      - retained
      - engaged
  advisors:
    keywords:
      - advisor
      - mentor
      - guidance
      - advised us
      - coach
  investors:
    keywords:
      - investor
      - VC
      - fund
      - angel
      - seed round
      - Series A
      - Series B
      - Series C
      - cap table
      - term sheet
  board:
    keywords:
      - board member
      - chairman
      - director
      - sits on the board
      - board seat
  unassigned:
    keywords: []
```

Matching is case-insensitive substring. Order matters: core-team is evaluated
first so an explicit "co-founder" wins over a stray "advised us" mention.

---

## Frontmatter Promotion Map

When an imported artifact has source frontmatter, a known subset is promoted
into the artifact folder's ROOM.md (Layer 0 identity). Unknown fields stay
in the artifact file's frontmatter untouched.

```yaml
promote_to_room_md:
  - title
  - aliases
  - tags
  - date
  - created
  - modified
  - author
  - attendees
```

Field semantics:

| Source key  | ROOM.md destination           | Notes                                      |
|-------------|-------------------------------|--------------------------------------------|
| title       | ROOM.md identity              | Falls back to filename stem if missing     |
| aliases     | ROOM.md identity              | Array preserved                            |
| tags        | ROOM.md metadata + tag index  | Merged with section defaults               |
| date        | ROOM.md metadata              | ISO-normalized                             |
| created     | ROOM.md metadata              | ISO-normalized                             |
| modified    | ROOM.md metadata              | ISO-normalized                             |
| author      | ROOM.md metadata + person feed| Triggers person detection tier 1           |
| attendees   | ROOM.md metadata + person feed| Triggers person detection tier 1           |

Any other frontmatter key is preserved verbatim on the artifact file and
NOT copied to ROOM.md.
