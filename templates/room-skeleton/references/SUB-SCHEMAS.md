# Sub-Schemas

The nested schemas inside individual sections. ICM Layer 3, same as its sibling
`SECTION-SCHEMA.md`. A section whose contract says "the full field list lives in
SUB-SCHEMAS.md" is pointing here.

## 1. funding: two orthogonal dimensions

This is two dimensions, not one, because collapsing them is the exact error the command's own
Design Note exists to prevent: stage answers WHERE in the process an entry is; outcome answers
WHAT the result was. An entry at Submitted can carry any of the three outcomes.

### Stage (sequential, enforced)

| Stage | What being there means |
|---|---|
| Discovered | The entry was just promoted from opportunity-bank; nothing has been researched yet. |
| Researched | The room owner has looked into the funder, the program, and the fit. |
| Applying | An application is actively being prepared. |
| Submitted | The application has been sent; the room owner is waiting on a result. |

Enforcement, stated verbatim: no skipping stages, no going backward, each transition is
recorded in `transition_history`.

### Outcome (orthogonal, not a stage)

| Outcome | What it means | When valid |
|---|---|---|
| awarded | The funder approved the application | only at Submitted |
| rejected | The funder declined the application | only at Submitted |
| withdrawn | The room owner withdrew | at any stage |

### Funding type

Two types, per the 2026-04-14 primary source: `dilutive` (equity and venture capital;
ownership is given up) and `non-dilutive` (grants and similar; ownership is retained).

Honestly: the command surface implements the non-dilutive half today. Dilutive tracking is a
named Phase 275 deferral. A dilutive entry, until that is built, is recorded as an ordinary
dated entry folder without a stage machine, not as a `funding/<slug>/STATUS.md` pipeline entry.

## 2. opportunity-bank: Knight position plus confidence

Quoted verbatim from `commands/opportunities.md`: every opportunity carries a Knight position
(risk vs uncertainty vs mixed) and a confidence score. Risk = known problem with quantifiable
odds. Uncertainty = unknown problem requiring exploration. Mixed = contradiction that could go
either way.

Field shape: `knight_position` is one of `risk`, `uncertainty`, `mixed`. `confidence` is a
number from 0.0 to 1.0.

Two source kinds, each populated differently: a grant-sourced opportunity gets `risk` (grants
are known risk) with confidence taken from its relevance score; a cascade-sourced opportunity
takes both `knight_position` and `confidence` from the framework that surfaced it.

The schema is load-bearing, not decorative: the `list` subcommand's filter flags consume these
fields directly, `--knight <position>` and `--min-confidence <N>`.

Why the distinction earns its place: risk and uncertainty are different problems requiring
different next moves, and a bank that does not distinguish them cannot tell you which
opportunities need a decision and which need exploration.

## 3. team-execution: Mentor-Profiles

This is where this document does work no existing file does. Define the record.

**Required fields:**

- `name`
- `domain` - what they actually know
- `answers` - the one question they are the right person to answer, stated as a question
- `last_consulted` - a date

**Optional fields:**

- `relationship` - how they came to be in this venture's orbit
- `access` - how to reach them and how much of their time is realistically available
- `open_asks` - what is currently outstanding with them

**Filing convention**, matching the L4 rule every section contract carries: one folder per
mentor at `team-execution/mentors/<mentor-slug>/<mentor-slug>.md`, never a list inlined into
`ROOM.md`.

**The human check that makes the schema worth having:** if the `answers` field is empty or
generic, the profile is a contact record, not a mentor profile, and it will not help anyone
decide who to call.

**The directory distinction**, because three spellings are live: `team-execution/` is the ICM
section, a scored destination for methodology content. `team/` is a structural directory
holding the people layer, including AI personas at `team/ai-personas/`. `meetings/` is the
other structural directory, a source that feeds sections rather than a destination.
