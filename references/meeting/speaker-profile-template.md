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
role: {speaker_role from 12-type taxonomy}
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

## Key Contributions

### From {meeting_name} ({YYYY-MM-DD})

- {Summary of their key segments from this meeting}
```

---

## PROFILE.md Field Definitions

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| name | string | -- | Full display name (with titles if applicable) |
| role | enum | unknown | One of the 12 speaker roles |
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

**Important:** Proactive web research runs AFTER the filing pipeline via `scripts/research-speaker`, NOT during filing. The filing pipeline should never block on external API calls. The profile is created with `research_status: pending` and a separate background process handles enrichment.

---

## Subfolder Purposes

### insights/

Filed insights attributed to this speaker. Each file is a symlink or copy of the artifact filed to the room section.

```
insights/
  2026-03-15-enterprise-growth-data.md
  2026-03-22-customer-acquisition-cost.md
```

Purpose: See everything this speaker has contributed as insights across all meetings.

### advice/

Filed advice attributed to this speaker. Advice is dual-filed (see segment-classification.md): once in the room section, once here.

```
advice/
  2026-03-15-reframe-the-problem.md
  2026-03-22-hire-vp-sales-first.md
```

Purpose: See all guidance this speaker has offered. Especially valuable for mentors and advisors.

### connections/

People, organizations, or resources this speaker has mentioned or introduced.

```
connections/
  acme-corp.md
  university-partnership.md
```

Purpose: Track the network this speaker brings to the venture.

### concerns/

Questions, risks, or objections this speaker has raised.

```
concerns/
  churn-rate-unknown.md
  sales-cycle-too-long.md
```

Purpose: Track what worries this speaker. Especially valuable for investor and customer profiles.

---

## Profile Updates Across Meetings

When a known speaker appears in a subsequent meeting:

1. **Increment** `meetings_attended` in PROFILE.md frontmatter
2. **Update** `last_updated` to today's date
3. **Append** a new "### From {meeting_name} ({date})" subsection under Key Contributions
4. **File** new insights, advice, connections, and concerns to the appropriate subfolders
5. **Do NOT overwrite** existing content -- profiles are append-only for contributions

---

## Role Changes

A speaker's role can change across meetings (e.g., advisor becomes investor after a funding round). Handle by:

1. **Keep the profile in its original directory** (don't move folders)
2. **Update the role field** in PROFILE.md frontmatter
3. **Add a note** in the Context section: "Role changed from advisor to investor as of {date}"
4. **Future filing** uses the updated role for routing priority calculations

---

## Unknown Speakers

When a speaker cannot be identified (raw paste format, unlabeled audio):

1. Create profile at `room/team/contacts/unknown-speaker-{N}/`
2. Set `research_status: pending`
3. Set `role: unknown`
4. After user identifies the speaker, rename the folder and update PROFILE.md
5. All filed artifacts maintain correct links via the `speaker` field in their frontmatter

---

## Cross-Reference

- Role taxonomy: `references/meeting/section-mapping.md` (12 roles defined)
- Segment types filed to subfolders: `references/meeting/segment-classification.md`
- Artifact format in subfolders: `references/meeting/artifact-template.md`
- Meeting summary links to profiles: `references/meeting/summary-template.md`
- Research enrichment: `scripts/research-speaker` (future -- Phase 6, Plan 03)
