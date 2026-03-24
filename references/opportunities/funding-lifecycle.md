# Funding Lifecycle

> Defines the 4-stage lifecycle for opportunities promoted from opportunity-bank to funding.
> Stages are sequential. Outcomes are separate from stages.

## Lifecycle Stages

```
Discovered  -->  Researched  -->  Applying  -->  Submitted
```

### Stage 1: Discovered

**Definition:** Opportunity identified and filed in opportunity-bank. Basic information captured (funder, program, amount range, deadline).

**Entry criteria:** User confirms filing from Larry's surfacing.

**Contents:** Source opportunity artifact in opportunity-bank/ with frontmatter.

**Transition to Researched:** User requests deeper analysis of this opportunity.

### Stage 2: Researched

**Definition:** Eligibility confirmed, fit assessed against room context, requirements documented in detail. Due diligence complete.

**Entry criteria:** Larry completes eligibility analysis and fit assessment.

**Contents:** research.md with eligibility analysis, fit assessment, requirements checklist.

**Transition to Applying:** User decides to pursue this opportunity and begin application.

### Stage 3: Applying

**Definition:** Application in progress. Narrative drafted, supporting materials gathered, submission requirements tracked.

**Entry criteria:** User initiates application process.

**Contents:** narrative.md with draft narrative, supporting documents referenced.

**Transition to Submitted:** Application submitted to funder.

### Stage 4: Submitted

**Definition:** Application sent to funder. Awaiting decision. No further action until response.

**Entry criteria:** Application confirmed submitted.

**Contents:** Submission confirmation, expected response timeline.

## Outcomes (NOT Stages)

Outcomes are a separate attribute from stage. An opportunity in any stage can receive an outcome.

| Outcome | Description |
|---------|-------------|
| `awarded` | Funding approved by funder |
| `rejected` | Application declined by funder |
| `withdrawn` | User withdrew application before decision |

**Important:** Awarded/Rejected are outcomes, NOT lifecycle stages. The `stage` field tracks WHERE in the process the opportunity is. The `outcome` field tracks the RESULT.

## STATUS.md Frontmatter Schema

Each funding entry folder contains a `STATUS.md` with this frontmatter:

```yaml
---
stage: discovered | researched | applying | submitted
outcome: null | awarded | rejected | withdrawn
source_opportunity: "[[opportunity-bank/YYYY-MM-DD-slug]]"
deadline: YYYY-MM-DD
last_updated: YYYY-MM-DD
transition_history:
  - stage: discovered
    date: YYYY-MM-DD
    note: "Initial filing from opportunity-bank"
  - stage: researched
    date: YYYY-MM-DD
    note: "Eligibility confirmed, fit assessed"
---
```

## Folder Structure

```
room/funding/
  STATE.md                      # Pipeline summary (aggregated from entries)
  nsf-sbir-phase1/              # Per-opportunity folder
    STATUS.md                   # Lifecycle stage + transition history
    research.md                 # Due diligence (Researched+)
    narrative.md                # Grant narrative (Applying+)
  doe-clean-energy/             # Another opportunity
    STATUS.md
```

## Cross-References

Funding entries link back to their source opportunity via wikilink:
```
source_opportunity: "[[opportunity-bank/2026-03-20-nsf-sbir]]"
```

This creates a graph edge between the funding lifecycle entry and its source in opportunity-bank, parseable by `build-graph`.
