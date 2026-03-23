# Meeting Summary Template -- Dual Storage Pattern

*Used by `file-meeting` to produce narrative + structured meeting summaries.*

---

## Dual Storage Pattern

Every filed meeting produces TWO summary artifacts:

| Artifact | Location | Purpose |
|----------|----------|---------|
| Full summary | `room/meetings/YYYY-MM-DD-{name}/summary.md` | Complete narrative + structured breakdown |
| Compact reference | `room/meeting-YYYY-MM-DD-{name}.md` | Quick-access one-paragraph + link + counts |

Plus supporting files in the meeting directory:

| File | Location | Purpose |
|------|----------|---------|
| Transcript | `room/meetings/YYYY-MM-DD-{name}/transcript.md` | Original transcript (preserved verbatim) |
| Filed-to index | `room/meetings/YYYY-MM-DD-{name}/filed-to/` | Links to where each artifact was filed |

---

## Full Summary Template

**Location:** `room/meetings/YYYY-MM-DD-{name}/summary.md`

```markdown
---
methodology: file-meeting
type: meeting-summary
meeting_date: {YYYY-MM-DD}
meeting_name: {human-readable name}
source: {transcript | velma}
format_detected: {zoom | teams | otter | meet | raw | velma}
duration_estimate: {minutes, if available}
speakers:
  - name: {speaker name}
    role: {speaker role}
    segments: {count}
  - name: {speaker name}
    role: {speaker role}
    segments: {count}
total_segments: {count}
filed_segments: {count}
skipped_segments: {count}
flagged_noise: {count}
rejected_segments: {count}
created: {YYYY-MM-DD}
---

# Meeting: {meeting_name}

{Narrative lead paragraph in Larry's voice. 2-4 sentences summarizing what
happened, what was decided, and what matters most. Written in third person
with Larry's characteristic directness. NOT a bland summary -- Larry's
personality comes through.}

## Key Decisions

{Numbered list of decisions made during the meeting. Each links to the
filed artifact. If no decisions were made, state: "No explicit decisions
were recorded in this meeting."}

1. **{Decision summary}** -- {speaker} ({role})
   Filed to: [[room/{section}/{artifact-name}.md]]

## Insights Filed

{Count} insights filed to {count} sections:

- **{section}**: {count} insights
  - {Brief insight summary} -- {speaker} ({role})
  - {Brief insight summary} -- {speaker} ({role})
- **{section}**: {count} insights
  - {Brief insight summary} -- {speaker} ({role})

## Contradictions Detected

{List any contradictions found between segments in this meeting, or between
meeting segments and existing room artifacts. If none: "No contradictions
detected."}

- **{Claim A}** ({speaker A}) vs **{Claim B}** ({speaker B})
  Affects: [{sections}]
  Status: Flagged for review

## Gaps Identified

{Questions raised during the meeting that represent knowledge gaps. These
are filed as gap entries in their target sections.}

- **{Gap description}** -- raised by {speaker} ({role})
  Filed to: [[room/{section}/gaps/{artifact-name}.md]]

## Action Items

{Extracted action items with owners. NEVER invent deadlines that were not
explicitly stated in the transcript.}

| Owner | Task | Deadline | Context |
|-------|------|----------|---------|
| {name} | {task description} | {date or "not specified"} | {why this matters} |

## Rejections

{Segments the user rejected during confirm-then-file, with captured reasons.
If none: "No segments were rejected."}

| Segment | Suggested Section | Rejection Reason |
|---------|-------------------|------------------|
| {brief text} | {section} | {user's reason} |

## Speakers

{Count} speakers identified:

| Speaker | Role | Segments | Key Contributions |
|---------|------|----------|-------------------|
| {name} | {role} | {count} | {1-sentence summary of their contributions} |

---

*Filed by MindrianOS `file-meeting` on {created date}.*
*Source: {source type} | Format: {format_detected}*
```

---

## Compact Reference Template

**Location:** `room/meeting-YYYY-MM-DD-{name}.md`

```markdown
---
type: meeting-reference
meeting_date: {YYYY-MM-DD}
meeting_name: {name}
full_summary: meetings/YYYY-MM-DD-{name}/summary.md
speakers: {count}
decisions: {count}
insights: {count}
actions: {count}
---

# {meeting_name} ({YYYY-MM-DD})

{One-paragraph summary -- same narrative lead from full summary.}

**Decisions:** {count} | **Insights:** {count} | **Actions:** {count} | **Speakers:** {count}

Full summary: [[meetings/YYYY-MM-DD-{name}/summary.md]]
```

This file lives at the root of the room directory for quick scanning. Users can `ls room/meeting-*.md` to see all meetings at a glance.

---

## Transcript Storage Template

**Location:** `room/meetings/YYYY-MM-DD-{name}/transcript.md`

```markdown
---
type: meeting-transcript
meeting_date: {YYYY-MM-DD}
meeting_name: {name}
source: {transcript | velma}
format_detected: {format}
speakers: [{speaker names}]
total_lines: {count}
---

# Transcript: {meeting_name}

{Original transcript preserved verbatim. No modifications.
If Velma source, converted from JSON to readable format with
timestamps and speaker labels.}
```

The transcript is stored EXACTLY as provided. No cleanup, no rewriting. The original is the source of truth. Larry's classifications and summaries are interpretations -- the transcript is evidence.

---

## Filed-To Index Pattern

**Location:** `room/meetings/YYYY-MM-DD-{name}/filed-to/`

Each filed artifact gets a reference entry:

```markdown
# room/meetings/YYYY-MM-DD-{name}/filed-to/{NNN}-{section}.md

Filed: [[room/{section}/{artifact-filename}.md]]
Speaker: {name} ({role})
Type: {segment_type}
Confidence: {confidence}
```

Where `{NNN}` is a zero-padded sequence number matching the filing order (priority-ordered).

This creates a bidirectional link: the artifact in the room section has `source: transcript` + `meeting_name` pointing back to the meeting, and the filed-to index points from the meeting to the artifact.

---

## Summary Sections -- Required vs Optional

| Section | Required | When to Include |
|---------|----------|-----------------|
| Key Decisions | YES | Always -- state "none recorded" if empty |
| Insights Filed | YES | Always -- show counts by section |
| Contradictions Detected | YES | Always -- state "none detected" if empty |
| Gaps Identified | YES | Always -- state "none identified" if empty |
| Action Items | YES | Always -- state "no action items" if empty |
| Rejections | YES | Always -- state "none rejected" if empty |
| Speakers | YES | Always -- list all identified speakers |

Every section is always present. This makes the summary format consistent and machine-parseable. Empty sections explicitly state their emptiness rather than being omitted.

---

## Meeting Name Convention

The `{name}` in paths is derived from the meeting name:

1. Lowercase
2. Replace spaces with hyphens
3. Remove special characters
4. Truncate to 50 characters

Examples:
- "Board Strategy Session Q1" -> `board-strategy-session-q1`
- "Mentor Check-in with Lawrence" -> `mentor-check-in-with-lawrence`
- "Investor Due Diligence Call" -> `investor-due-diligence-call`

---

## Cross-Reference

- Artifact format: `references/meeting/artifact-template.md`
- Segment classification: `references/meeting/segment-classification.md`
- Speaker profiles: `references/meeting/speaker-profile-template.md`
- Section routing: `references/meeting/section-mapping.md`
