# Meeting Join & Transcript Filing — Design Spec

**Date:** 2026-03-23
**Status:** Approved
**Priority:** Killer Feature

---

## The Vision

A user is in the middle of building their Data Room. They have a team meeting — a mentor giving advice, a researcher sharing findings, a team member pitching an idea, an investor asking hard questions.

After the meeting, the user tells Larry:

> "/mindrian-os:file-meeting"

Larry asks: "Got a transcript? Paste it, upload it, or point me to the file."

The user drops a transcript. Larry reads it, identifies who spoke, classifies what was said, and files each insight to the correct Data Room section — with the user confirming each filing.

**Result:** A 1-hour team meeting becomes 8-15 filed Data Room entries, each tagged with speaker, source, confidence, and room section. The knowledge graph gains edges. Gaps get filled. Contradictions get flagged. The Data Room grows from a meeting the way it grows from a methodology session.

---

## How It Works

### Input Sources

| Source | How | Example |
|--------|-----|---------|
| **Paste transcript** | User pastes text directly into chat | Copy from Zoom, Teams, Otter.ai, Google Meet |
| **Upload file** | User provides file path | `room/transcripts/team-meeting-2026-03-22.txt` |
| **Whisper/audio** | Future: process audio file directly | `.mp3`, `.m4a` via local Whisper |
| **Live join** | Future: join meeting via MCP (Joinly) | Real-time transcript + filing |

**v1 (now):** Paste or file path. Larry processes the text.
**v2 (future):** Audio transcription via Whisper. Live meeting join via Joinly MCP.

### Processing Pipeline

```
Transcript Input
    ↓
Step 1: SPEAKER IDENTIFICATION
    Larry identifies speakers by name/label
    Maps to known roles: mentor, team-member, investor, researcher, user
    Asks user to confirm: "I see 4 speakers: Tyler, Lawrence, Jonathan, Elena.
    Who are they? (e.g., Tyler = researcher, Lawrence = mentor)"
    ↓
Step 2: SEGMENT CLASSIFICATION
    For each speaker segment, Larry classifies:
    - insight (new idea, finding, connection)
    - advice (recommendation, guidance, lesson)
    - question (open question, challenge, concern)
    - decision (agreement, commitment, action item)
    - context (background info, status update)
    - noise (small talk, logistics, off-topic)
    ↓
Step 3: ROOM SECTION MAPPING
    Each non-noise segment gets mapped to a room section:
    - Mentor advice on market → market-analysis
    - Researcher finding on tech → solution-design
    - Investor question about competition → competitive-analysis
    - Team member idea for revenue → business-model
    - Funding opportunity mentioned → financial-model
    - IP concern raised → legal-ip
    - Hiring need identified → team-execution
    ↓
Step 4: FILING WITH CONFIRMATION
    Larry presents each proposed filing:
    "Tyler (researcher) said: 'The synthesis route using
    ionic liquids avoids the harsh acid entirely.'
    → File to: solution-design
    → Type: insight
    → Confidence: HIGH
    File this? [y/n/redirect to different section]"

    User confirms, redirects, or skips each one.
    ↓
Step 5: ARTIFACT CREATION
    Each confirmed filing becomes a room artifact:
    ---
    methodology: file-meeting
    created: 2026-03-23
    source: transcript
    speaker: Tyler Josephson
    speaker_role: researcher
    segment_type: insight
    confidence: 0.85
    meeting_date: 2026-03-22
    room_section: solution-design
    ---

    # Ionic Liquid Synthesis Route

    Tyler suggested that ionic liquids could replace hydroiodic
    acid in the synthesis process, avoiding harsh conditions
    entirely. This aligns with green chemistry principles and
    could reduce equipment costs.

    Source: Team meeting 2026-03-22
    ↓
Step 6: CROSS-REFERENCE DETECTION
    After all segments filed, Larry scans for:
    - Contradictions between speakers
    - Convergence (multiple speakers pointing to same insight)
    - Gaps (topics nobody mentioned but room needs)
    - Action items (decisions that need follow-up)

    "I noticed Tyler's synthesis suggestion contradicts
    Elena's cost estimate in business-model. Want to
    dig into that?"
```

### Speaker Role Types

| Role | What Larry Looks For | Filing Priority |
|------|---------------------|-----------------|
| **Mentor** | Advice, frameworks, warnings, reframes | HIGH — mentors see what you don't |
| **Investor** | Questions, concerns, deal-breakers, due diligence gaps | HIGH — these become competitive-analysis entries |
| **Researcher** | Findings, data, evidence, technical insights | HIGH — these become solution-design or problem-definition |
| **Team Member** | Ideas, status updates, blockers, proposals | MEDIUM — ideas file, status is noise |
| **Customer** | Pain points, needs, feedback, objections | HIGH — these become market-analysis entries |
| **Advisor** | Strategic guidance, connections, industry context | MEDIUM-HIGH — context for multiple sections |
| **User (self)** | Their own statements, commitments, decisions | LOW — they already know what they said |

### Meeting Summary Artifact

After all individual filings, Larry creates a summary artifact:

```markdown
---
methodology: file-meeting
created: 2026-03-23
source: transcript
meeting_type: team-sync
participants: [Tyler Josephson (researcher), Lawrence Aronhime (mentor), Jonathan Sagir (user)]
room_section: problem-definition
---

# Meeting Summary: 2026-03-22 Team Sync

## Key Decisions
1. Pursue ionic liquid synthesis route (Tyler's recommendation)
2. Defer patent filing until proof-of-concept complete (Lawrence's advice)

## Insights Filed (8)
- solution-design: Ionic liquid synthesis route (Tyler, HIGH)
- market-analysis: Green chemistry regulatory advantage (Lawrence, HIGH)
- competitive-analysis: No competing ionic liquid approaches in literature (Tyler, HIGH)
- business-model: Equipment cost reduction from mild conditions (Tyler, MEDIUM)
- problem-definition: Reframe from "replace acid" to "design mild process" (Lawrence, HIGH)
- financial-model: SBIR Phase I opportunity for green chemistry (Jonathan, MEDIUM)
- team-execution: Need analytical chemistry expertise (Lawrence, HIGH)
- legal-ip: Prior art search needed for ionic liquid route (Tyler, MEDIUM)

## Contradictions Detected
- Tyler's cost estimate ($50K equipment) vs Elena's projection ($120K) in business-model

## Gaps Identified
- No discussion of timeline or milestones
- legal-ip section still thin after this meeting

## Action Items
- [ ] Tyler: Literature review on ionic liquid synthesis by Friday
- [ ] Jonathan: Submit SBIR Phase I pre-proposal
- [ ] Lawrence: Connect team with Dr. Chen (ionic liquids expert at MIT)
```

---

## Plugin Files Needed

### New Files
- `commands/file-meeting.md` — the slash command
- `references/meeting/transcript-patterns.md` — speaker identification + classification patterns
- `scripts/parse-transcript` — optional helper to pre-process raw transcript text

### Modified Files
- `skills/room-passive/SKILL.md` — add transcript source awareness to filing intelligence
- `commands/help.md` — add /file-meeting to infrastructure commands
- `references/methodology/index.md` — add file-meeting to command list

### Room Directory Addition
- `room/transcripts/` — optional folder for storing raw transcripts (not filed to sections, just archived)

---

## Tri-Polar Surface Behavior

| Surface | Behavior |
|---------|----------|
| **CLI** | Paste transcript or provide file path. Larry processes in conversation. |
| **Desktop** | Same — paste or file path. Desktop conversation with Larry. |
| **Cowork** | Multiple team members can paste THEIR meeting transcripts. Each person's filings go to the shared room. Team sees who contributed what. |

---

## Connection to V4 Features

From the V4 analysis:

| V4 Feature | Plugin Equivalent |
|------------|-------------------|
| `source_type: transcript` in DataRoomEntry | `source: transcript` in YAML frontmatter |
| Moment Detection on transcript content | analyze-room convergence/contradiction detection runs after filing |
| Team Gap Detection (NER + skills[]) | Larry identifies missing expertise from transcript ("You need an analytical chemist") |
| @ Mention system | Speaker tags in artifacts enable `speaker: Tyler Josephson` search |
| Living Data Room soft/hard edits | Confirm-then-file UX (soft edit) → user can edit after filing (hard edit) |

---

## Future: Live Meeting Join

V4 designed a Joinly MCP integration for real-time meeting joining. For the plugin:

1. **Joinly MCP** connects to Zoom/Teams/Meet
2. **Real-time transcript** streams into Larry's context
3. **Larry listens silently** — doesn't interrupt the meeting
4. **After meeting ends:** Larry processes the full transcript through the pipeline above
5. **Proactive:** Larry can ping the user mid-meeting via side channel: "The investor just mentioned a concern that contradicts your market analysis. You might want to address it."

This is v2. For now, post-meeting transcript filing is the core feature.

---

## Implementation Priority

**Phase 1 (now):** `/mindrian-os:file-meeting` command — paste/file transcript, speaker identification, segment classification, confirm-then-file, meeting summary artifact.

**Phase 2 (soon):** Audio transcription via local Whisper. Speaker diarization.

**Phase 3 (future):** Live meeting join via Joinly MCP. Real-time silent listening + post-meeting filing.
