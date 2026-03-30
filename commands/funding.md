---
name: funding
description: Track grant opportunities through the funding lifecycle
body_shape: B (Semantic Tree)
---

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
