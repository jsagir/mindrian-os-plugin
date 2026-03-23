# Artifact Template -- Meeting-Filed Entries

*Used by `file-meeting` to create wicked-problem-aware artifacts from classified transcript segments.*

---

## YAML Frontmatter Template

Every artifact filed from a meeting transcript MUST include this frontmatter:

```yaml
---
methodology: file-meeting
created: {YYYY-MM-DD}
source: transcript
attribution:
  speaker: {name}
  role: {role from 12-type taxonomy}
  profile_path: team/{role-plural}/{speaker-slug}
  meeting_date: {YYYY-MM-DD}
  meeting_id: {YYYY-MM-DD-meeting-slug}
segment_type: {type from 6-type taxonomy}
confidence: {0.0-1.0}
meeting_date: {YYYY-MM-DD}
meeting_name: {meeting identifier}
room_section: {target section from 8-section vocabulary}
assumptions:
  - claim: "{extracted assumption}"
    status: unvalidated
    impacts: [{affected sections}]
perspective: {speaker_role}
cascade_sections: [{sections this insight may affect}]
secondary_types: []
rejection: null
---
```

---

## Field Definitions

### Core Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| methodology | string | YES | Always `file-meeting` |
| created | date | YES | Date the artifact was filed (YYYY-MM-DD) |
| source | string | YES | `transcript` for text imports, `velma` for Velma-transcribed audio |
| segment_type | enum | YES | One of the 6 types from segment-classification.md |
| confidence | float | YES | 0.0-1.0 classification confidence |
| meeting_date | date | YES | When the meeting occurred |
| meeting_name | string | YES | Human-readable meeting identifier |
| room_section | string | YES | Target room section for filing |

### Attribution Block

The `attribution:` block replaces the Phase 6 flat `speaker:` and `speaker_role:` fields. It provides a complete provenance chain linking each artifact to its speaker and meeting.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| attribution.speaker | string | YES | Full name of the speaker |
| attribution.role | enum | YES | One of the 12 roles from section-mapping.md |
| attribution.profile_path | string | YES | Relative path to speaker profile (e.g., team/mentors/lawrence-aronhime) |
| attribution.meeting_date | date | YES | When the meeting occurred (duplicated for provenance chain) |
| attribution.meeting_id | string | YES | YYYY-MM-DD-{meeting-slug} unique meeting identifier |

**Backward Compatibility:** compute-team and other scanners must handle BOTH flat `speaker:` (Phase 6 legacy) and nested `attribution.speaker:` (Phase 7+). Grep for `^speaker:` OR `^  speaker:` (indented under attribution:).

### Wicked Problem Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| assumptions | list | YES | Extracted assumptions with validity tracking |
| perspective | string | YES | Matches speaker role -- frames the viewpoint |
| cascade_sections | list | YES | Sections this artifact may impact beyond its target |

### Optional Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| secondary_types | list | NO | Additional segment types detected (multi-type segments) |
| rejection | object | NO | Populated if user rejected a filing suggestion |
| emotions | list | NO | Velma-detected emotions (source: velma only) |
| velma_confidence | float | NO | Velma's transcription confidence (source: velma only) |

---

## Assumptions Field

Every segment implies assumptions. Larry extracts them during filing.

### Structure

```yaml
assumptions:
  - claim: "TAM is $190M"
    status: unvalidated
    impacts: [financial-model, market-analysis]
  - claim: "Enterprise sales cycles are 18 months"
    status: unvalidated
    impacts: [business-model, financial-model]
```

### Status Values

| Status | Meaning |
|--------|---------|
| unvalidated | Default -- claim extracted but not verified |
| validated | User or data confirmed the claim |
| invalidated | Contradicted by newer information |
| stale | Older than 90 days without revalidation |

### Fallback

When Larry cannot identify any assumptions in a segment:

```yaml
assumptions: none_detected
```

This is valid. Not every segment contains assumptions (e.g., pure action items like "Sarah will send the deck" imply no claims about the world).

---

## Cascade Sections Field

Identifies which room sections BEYOND the target section may be affected by this artifact.

### Cascade Detection Rules

1. **Financial claim** -- always cascades to `financial-model`
2. **Competitive mention** -- always cascades to `competitive-analysis`
3. **Team capability claim** -- cascades to `team-execution`
4. **Legal/regulatory mention** -- cascades to `legal-ip`
5. **Problem reframing** -- cascades to `problem-definition` and potentially all sections
6. **Market data** -- cascades to `market-analysis` and `business-model`

### Example

An advisor insight filed to `solution-design`:

```yaml
room_section: solution-design
cascade_sections: [financial-model, team-execution]
```

The insight suggests a technical architecture change that will affect costs (financial-model) and require new hires (team-execution).

---

## Examples by Segment Type

### decision

```yaml
---
methodology: file-meeting
created: 2026-03-15
source: transcript
attribution:
  speaker: Sarah Chen
  role: founder
  profile_path: team/founders/sarah-chen
  meeting_date: 2026-03-15
  meeting_id: 2026-03-15-board-strategy-q1
segment_type: decision
confidence: 0.92
meeting_date: 2026-03-15
meeting_name: Board Strategy Session Q1
room_section: solution-design
assumptions:
  - claim: "Enterprise segment is more viable than SMB"
    status: unvalidated
    impacts: [market-analysis, business-model, financial-model]
perspective: founder
cascade_sections: [market-analysis, business-model, financial-model]
---

We've decided to focus on the enterprise segment first. The SMB numbers don't support the unit economics yet. We'll pivot the product roadmap to enterprise features starting next sprint.
```

### action-item

```yaml
---
methodology: file-meeting
created: 2026-03-15
source: transcript
attribution:
  speaker: David Park
  role: team-member
  profile_path: team/members/david-park
  meeting_date: 2026-03-15
  meeting_id: 2026-03-15-board-strategy-q1
segment_type: action-item
confidence: 0.88
meeting_date: 2026-03-15
meeting_name: Board Strategy Session Q1
room_section: team-execution
assumptions: none_detected
perspective: team-member
cascade_sections: []
---

David will prepare the enterprise pricing deck by next Friday and share it with the advisory board for feedback before the investor meeting.

**Extracted action:**
- owner: David Park
- task: Prepare enterprise pricing deck
- deadline: Next Friday (2026-03-22)
- context: Needed before investor meeting
```

### insight

```yaml
---
methodology: file-meeting
created: 2026-03-15
source: transcript
attribution:
  speaker: Lisa Wong
  role: researcher
  profile_path: team/researchers/lisa-wong
  meeting_date: 2026-03-15
  meeting_id: 2026-03-15-board-strategy-q1
segment_type: insight
confidence: 0.85
meeting_date: 2026-03-15
meeting_name: Board Strategy Session Q1
room_section: market-analysis
assumptions:
  - claim: "Enterprise segment grew 34% last quarter"
    status: unvalidated
    impacts: [market-analysis, financial-model]
perspective: researcher
cascade_sections: [financial-model, business-model]
---

The enterprise segment grew 34% last quarter according to Gartner's latest report. That's almost double the SMB growth rate. The mid-market is actually shrinking.
```

### advice

```yaml
---
methodology: file-meeting
created: 2026-03-15
source: transcript
attribution:
  speaker: Prof. Lawrence Aronhime
  role: mentor
  profile_path: team/mentors/lawrence-aronhime
  meeting_date: 2026-03-15
  meeting_id: 2026-03-15-mentoring-session
segment_type: advice
confidence: 0.90
meeting_date: 2026-03-15
meeting_name: Mentoring Session
room_section: problem-definition
assumptions:
  - claim: "Problem framing determines solution space"
    status: validated
    impacts: [problem-definition, solution-design]
perspective: mentor
cascade_sections: [solution-design, market-analysis]
---

You should reframe the problem before jumping to solutions. Right now you're solving "how to sell to enterprises" but the real question might be "what problem do enterprises have that SMBs don't?" That reframing changes your entire approach.
```

### question

```yaml
---
methodology: file-meeting
created: 2026-03-15
source: transcript
attribution:
  speaker: Michael Torres
  role: investor
  profile_path: team/investors/michael-torres
  meeting_date: 2026-03-15
  meeting_id: 2026-03-15-board-strategy-q1
segment_type: question
confidence: 0.87
meeting_date: 2026-03-15
meeting_name: Board Strategy Session Q1
room_section: financial-model
assumptions: none_detected
perspective: investor
cascade_sections: [business-model]
---

What's your current churn rate for the enterprise customers you already have? And how does that compare to your SMB churn?

**Gap identified:** Enterprise churn rate data not available in current financial model.
```

### noise (flagged)

```yaml
---
methodology: file-meeting
created: 2026-03-15
source: transcript
attribution:
  speaker: Sarah Chen
  role: founder
  profile_path: team/founders/sarah-chen
  meeting_date: 2026-03-15
  meeting_id: 2026-03-15-board-strategy-q1
segment_type: noise
confidence: 0.55
meeting_date: 2026-03-15
meeting_name: Board Strategy Session Q1
room_section: competitive-analysis
assumptions: none_detected
perspective: founder
cascade_sections: []
---

FLAGGED_NOISE: "Oh by the way, I ran into the CEO of Acme Corp at that conference last week."
REASON: Contains competitor name "Acme Corp"
ACTION: User review required -- may contain buried insight about competitive landscape.
```

---

## Rejection Field

When a user rejects a filing suggestion during confirm-then-file, the rejection reason becomes data:

```yaml
rejection:
  action: rejected
  reason: "This was just small talk, not a real insight"
  timestamp: 2026-03-15T14:23:00Z
```

Or when deferred:

```yaml
rejection:
  action: deferred
  reason: "Need to verify the numbers first"
  timestamp: 2026-03-15T14:23:00Z
```

Rejection reasons become graph data. "Why not" teaches the system as much as "yes."

---

## Source Distinction

| Source Value | When Used | Extra Fields |
|-------------|-----------|--------------|
| transcript | Text transcript pasted or uploaded | -- |
| velma | Audio transcribed via Velma API | emotions, velma_confidence |

Velma-sourced artifacts include emotion metadata:

```yaml
source: velma
emotions: [confident, analytical]
velma_confidence: 0.94
```

---

## Cross-Reference

- Segment types: `references/meeting/segment-classification.md`
- Speaker roles and routing: `references/meeting/section-mapping.md`
- Transcript format detection: `references/meeting/transcript-patterns.md`
- Summary format: `references/meeting/summary-template.md`
- Speaker profiles: `references/meeting/speaker-profile-template.md`
