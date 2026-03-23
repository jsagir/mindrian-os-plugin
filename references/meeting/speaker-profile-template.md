# Speaker Profile Template -- ICM Nested Folder Structure

*Used by `file-meeting` to create speaker profiles when a new speaker is encountered.*

---

## Directory Structure

When `file-meeting` encounters a speaker not yet in the room, it creates the following ICM nested folder profile:

```
room/team/{role-plural}/{firstname-lastname}/
  PROFILE.md
  insights/
  advice/
  connections/
  concerns/
```

---

## Role-to-Directory Mapping

| Speaker Role | Directory Plural | Example Path |
|-------------|-----------------|--------------|
| mentor | mentors | room/team/mentors/lawrence-aronhime/ |
| researcher | researchers | room/team/researchers/lisa-wong/ |
| team-member | members | room/team/members/david-park/ |
| investor | investors | room/team/investors/michael-torres/ |
| advisor | advisors | room/team/advisors/rachel-kim/ |
| customer | customers | room/team/customers/james-carter/ |
| founder | founders | room/team/founders/sarah-chen/ |
| partner | partners | room/team/partners/alex-johnson/ |
| domain-expert | domain-experts | room/team/domain-experts/maria-garcia/ |
| government | government | room/team/government/robert-smith/ |
| competitor | competitors | room/team/competitors/tom-wilson/ |
| unknown | contacts | room/team/contacts/unknown-speaker-1/ |

**Name formatting:** Lowercase, hyphenated. "Sarah Chen" becomes `sarah-chen`. Handle edge cases:
- Middle names: include or omit based on uniqueness needs
- Titles: strip "Dr.", "Prof.", "Mr.", "Ms." from folder name (preserve in PROFILE.md)
- Suffixes: strip "Jr.", "III", etc. from folder name (preserve in PROFILE.md)

---

## PROFILE.md Template

```markdown
---
name: {Full Name}
roles:
  - {speaker_role from 12-type taxonomy}
primary_role: {speaker_role from 12-type taxonomy}
role: {speaker_role from 12-type taxonomy}
status: active
last_active: {YYYY-MM-DD}
affiliation: {organization, if known}
first_meeting: {YYYY-MM-DD}
meetings_attended: 1
created_by: file-meeting
research_status: pending
last_updated: {YYYY-MM-DD}
---

# {Full Name}

**Role:** {role} | **Affiliation:** {affiliation or "Unknown"}

## Context

{How this person was encountered. Auto-generated from meeting context.}

First appeared in: [[meetings/YYYY-MM-DD-{meeting-name}/summary.md]]

## Expertise

{Inferred from their contributions. Updated across meetings.}

## Contributions

[Computed by compute-team -- do not edit manually]
```

---

## PROFILE.md Field Definitions

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| name | string | -- | Full display name (with titles if applicable) |
| roles | list | [{role}] | List of roles this speaker has held (Phase 7+) |
| primary_role | string | {role} | Current primary role from 12-type taxonomy (Phase 7+) |
| role | string | unknown | One of the 12 speaker roles (Phase 6 backward compat) |
| status | enum | active | Lifecycle status: active, inactive, archived (Phase 7+) |
| last_active | date | -- | Date of most recent meeting participation (Phase 7+) |
| affiliation | string | "Unknown" | Organization, company, or institution |
| first_meeting | date | -- | Date of the meeting where first encountered |
| meetings_attended | integer | 1 | Incremented each time the speaker appears |
| created_by | string | file-meeting | Always `file-meeting` for auto-created profiles |
| research_status | enum | pending | See research status values below |
| last_updated | date | -- | Date of most recent profile update |

### Research Status Values

| Status | Meaning |
|--------|---------|
| pending | Default -- no research has been done on this speaker |
| in-progress | `scripts/research-speaker` is running or was interrupted |
| complete | Web research has been performed and integrated |
| skipped | User chose to skip research for this speaker |

### Status Lifecycle Values

| Status | Meaning |
|--------|---------|
| active | Speaker has participated in a meeting within the last 90 days |
| inactive | No meeting participation in 90+ days (computed by compute-team) |
| archived | Manually archived by user -- excluded from active team scans |

**Important:** Proactive web research runs AFTER the filing pipeline via `scripts/research-speaker`, NOT during filing. The filing pipeline should never block on external API calls. The profile is created with `research_status: pending` and a separate background process handles enrichment.

### Backward Compatibility

Phase 6 profiles have `role:` (singular). Phase 7 adds `roles:` (list) and `primary_role:`. compute-team reads `roles:` first, falls back to `role:` as single-element list.

When scanning profiles, use this resolution order:
1. Read `roles:` -- if present, use as the role list
2. If `roles:` is absent, read `role:` and wrap as a single-element list: `[{role}]`
3. `primary_role:` is always the current active role for routing and display

---

## Computed Contributions Section

The `## Contributions` section in PROFILE.md is **computed by compute-team**, not maintained manually or by file-meeting.

compute-team rebuilds this section by scanning all room artifacts for matching `attribution.speaker` or `speaker` fields, then generating a per-meeting contribution summary:

```markdown
## Contributions

### From Board Strategy Session Q1 (2026-03-15)
- **decision** in solution-design: Focus on enterprise segment first
- **insight** in market-analysis: Enterprise grew 34% last quarter

### From Mentoring Session (2026-03-22)
- **advice** in problem-definition: Reframe the problem before solving
```

This replaces the Phase 6 pattern of manually filing copies to speaker subfolders (insights/, advice/, etc.). The subfolders are retained for backward compatibility but file-meeting no longer writes to them.

---

## Subfolder Purposes (Legacy)

The subdirectories (insights/, advice/, connections/, concerns/) are created for backward compatibility with Phase 6 profiles. As of Phase 7, file-meeting no longer creates copies in these subfolders. Speaker contributions are tracked via the computed Contributions section above.

### insights/

Filed insights attributed to this speaker. Legacy -- no new files created by file-meeting in Phase 7+.

### advice/

Filed advice attributed to this speaker. Legacy -- no new files created by file-meeting in Phase 7+.

### connections/

People, organizations, or resources this speaker has mentioned or introduced.

### concerns/

Questions, risks, or objections this speaker has raised.

---

## Profile Updates Across Meetings

When a known speaker appears in a subsequent meeting:

1. **Increment** `meetings_attended` in PROFILE.md frontmatter
2. **Update** `last_updated` to today's date
3. **Update** `last_active` to today's date
4. **Do NOT overwrite** existing content -- profiles are append-only for contributions
5. Contributions are computed by compute-team, not filed manually

---

## Role Changes

A speaker's role can change across meetings (e.g., advisor becomes investor after a funding round). Handle by:

1. **Keep the profile in its original directory** (don't move folders)
2. **Update the `primary_role` field** in PROFILE.md frontmatter
3. **Append the new role** to the `roles:` list (preserves role history)
4. **Update the `role` field** to match `primary_role` (backward compat)
5. **Add a note** in the Context section: "Role changed from advisor to investor as of {date}"
6. **Future filing** uses the updated role for routing priority calculations

---

## Unknown Speakers

When a speaker cannot be identified (raw paste format, unlabeled audio):

1. Create profile at `room/team/contacts/unknown-speaker-{N}/`
2. Set `research_status: pending`
3. Set `role: unknown` and `roles: [unknown]`
4. After user identifies the speaker, rename the folder and update PROFILE.md
5. All filed artifacts maintain correct links via the `attribution.speaker` field in their frontmatter

---

## Cross-Reference

- Role taxonomy: `references/meeting/section-mapping.md` (12 roles defined)
- Segment types filed to subfolders: `references/meeting/segment-classification.md`
- Artifact format in subfolders: `references/meeting/artifact-template.md`
- Meeting summary links to profiles: `references/meeting/summary-template.md`
- Research enrichment: `scripts/research-speaker` (future -- Phase 6, Plan 03)
