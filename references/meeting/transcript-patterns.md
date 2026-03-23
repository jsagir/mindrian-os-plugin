# Transcript Format Patterns -- Speaker Identification Reference

*Used by `file-meeting` to detect transcript format and extract speaker turns.*

---

## Format Detection Order

Larry tries each format in order. First match wins. If no format matches, treat as **Raw Paste**.

| Priority | Format | Detection Pattern | Confidence |
|----------|--------|-------------------|------------|
| 1 | Velma JSON | Valid JSON with `speaker_id` field | HIGH |
| 2 | Zoom | Lines matching `HH:MM:SS Speaker Name: text` | HIGH |
| 3 | Teams | Lines matching `[HH:MM:SS] Speaker Name` or `Speaker Name HH:MM:SS` | HIGH |
| 4 | Otter.ai | Lines matching `Speaker Name  HH:MM` (double-space) | MEDIUM |
| 5 | Google Meet | Lines matching `Speaker Name HH:MM:SS` (no colon after name) | MEDIUM |
| 6 | Raw Paste | No timestamps, no speaker labels detected | LOW |

---

## Zoom Format

**Pattern:** `HH:MM:SS Speaker Name: text`

```
00:02:15 Sarah Chen: I think we should focus on the enterprise segment first.
00:02:45 David Park: Agreed. The SMB numbers don't support the unit economics yet.
```

**Regex:**
```
^(\d{2}:\d{2}:\d{2})\s+([^:]+?):\s+(.+)$
```

- Group 1: Timestamp (`HH:MM:SS`)
- Group 2: Speaker name (trimmed)
- Group 3: Spoken text

**Edge cases:**
- Speaker names may contain spaces ("Sarah Chen")
- Colons in speech text are captured in Group 3 (greedy after first `:`)
- Some Zoom exports omit seconds: `00:02 Speaker Name: text` -- use fallback regex `^(\d{2}:\d{2}(?::\d{2})?)\s+([^:]+?):\s+(.+)$`

---

## Microsoft Teams Format

**Pattern A:** `[HH:MM:SS] Speaker Name`
**Pattern B:** `Speaker Name HH:MM:SS`

```
[00:02:15] Sarah Chen
I think we should focus on the enterprise segment first.

[00:02:45] David Park
Agreed. The SMB numbers don't support the unit economics yet.
```

Or:

```
Sarah Chen 00:02:15
I think we should focus on the enterprise segment first.

David Park 00:02:45
Agreed. The SMB numbers don't support the unit economics yet.
```

**Regex (Pattern A):**
```
^\[(\d{2}:\d{2}:\d{2})\]\s+(.+)$
```

**Regex (Pattern B):**
```
^(.+?)\s+(\d{2}:\d{2}:\d{2})$
```

- Teams format separates the speaker line from the text line
- Text follows on the next line(s) until the next speaker marker
- Blank lines often separate speaker turns

---

## Otter.ai Format

**Pattern:** `Speaker Name  HH:MM` (double-space separator)

```
Sarah Chen  0:02
I think we should focus on the enterprise segment first.

David Park  0:02
Agreed. The SMB numbers don't support the unit economics yet.
```

**Regex:**
```
^(.+?)\s{2,}(\d+:\d{2})$
```

- Group 1: Speaker name
- Group 2: Timestamp (`M:SS` or `MM:SS` -- Otter uses minutes, not hours)
- Double-space (2+) separates name from timestamp
- Text follows on subsequent lines until next speaker marker

**Edge cases:**
- Otter sometimes labels unknown speakers as "Speaker 1", "Speaker 2"
- Timestamps are minutes:seconds, not hours:minutes:seconds

---

## Google Meet Format

**Pattern:** `Speaker Name HH:MM:SS`

```
Sarah Chen 00:02:15
I think we should focus on the enterprise segment first.

David Park 00:02:45
Agreed. The SMB numbers don't support the unit economics yet.
```

**Regex:**
```
^(.+?)\s+(\d{2}:\d{2}:\d{2})$
```

- Similar to Teams Pattern B but Google Meet always uses `HH:MM:SS`
- Disambiguation from Teams: check if ALL timestamps have HH:MM:SS format (Meet) vs mixed (Teams)

**Disambiguation rule:** If the transcript has `[` brackets around timestamps, it is Teams. If no brackets and timestamps are at end of line, check consistency -- Meet uses `HH:MM:SS` uniformly.

---

## Raw Paste (No Labels)

**Detection:** No lines match any of the above patterns in the first 20 lines.

```
I think we should focus on the enterprise segment first.
Agreed. The SMB numbers don't support the unit economics yet.
What about the partnership with Acme Corp?
That fell through last week. We need a new distribution strategy.
```

**Handling:**
1. Larry CANNOT reliably identify speakers from raw text alone
2. **Ask the user:** "I don't see speaker labels in this transcript. Can you tell me who was in the meeting? I'll do my best to attribute statements."
3. If user provides speaker list, Larry uses contextual clues (first person references, expertise signals, role language) to attribute -- with LOW confidence on all attributions
4. All segments from raw paste get `confidence: 0.3` maximum unless user confirms attribution

---

## Velma Output (JSON)

**Detection:** File is valid JSON with `speaker_id` field in entries.

```json
{
  "meeting_id": "mtg_abc123",
  "duration_seconds": 3600,
  "segments": [
    {
      "speaker_id": "spk_001",
      "speaker_name": "Sarah Chen",
      "text": "I think we should focus on the enterprise segment first.",
      "start_time": 135.2,
      "end_time": 141.8,
      "emotions": ["confident", "analytical"],
      "confidence": 0.94
    },
    {
      "speaker_id": "spk_002",
      "speaker_name": "David Park",
      "text": "Agreed. The SMB numbers don't support the unit economics yet.",
      "start_time": 165.0,
      "end_time": 172.3,
      "emotions": ["agreement", "concern"],
      "confidence": 0.91
    }
  ]
}
```

**Schema:**
- `speaker_id`: Velma's internal speaker identifier (stable across the meeting)
- `speaker_name`: Resolved name (may be "Unknown Speaker 1" if Velma can't identify)
- `text`: Transcribed speech
- `start_time` / `end_time`: Seconds from meeting start (float)
- `emotions[]`: Velma's emotion detection (20+ categories)
- `confidence`: Velma's transcription confidence (0.0-1.0)

**Advantages over text formats:**
- Pre-segmented speaker turns (no regex needed)
- Emotion metadata enriches segment classification
- High confidence scores from Velma's diarization
- `source: velma` in artifact frontmatter (vs `source: transcript`)

---

## Ambiguity Resolution

When Larry cannot determine the format:

1. **Count pattern matches** across the first 20 lines for each format regex
2. **Highest match count wins** -- format with most matching lines
3. **Tie-breaking:** Prefer more specific formats (Zoom > Meet > Teams > Otter > Raw)
4. **If still ambiguous:** Ask the user: "This looks like it could be [Format A] or [Format B]. Which tool recorded this meeting?"
5. **Log the detection** in meeting summary: `format_detected: zoom` (or whichever)

---

## Speaker Name Normalization

After extraction, normalize speaker names:

1. **Trim whitespace** from both ends
2. **Collapse internal whitespace** to single spaces
3. **Title case** if all-caps or all-lowercase input
4. **Deduplicate:** "Sarah Chen" and "Sarah" in the same meeting likely refer to the same person -- ask user to confirm
5. **Map to existing profiles:** Check `room/team/` for existing speaker profiles by name match

Speaker names become folder names in `room/team/{role-plural}/{firstname-lastname}/` -- keep them filesystem-safe (lowercase, hyphens, no special characters).
