---
title: Cross-Meeting Intelligence Detection
description: Protocols for convergence detection, contradiction tracking, and action item lifecycle across meetings
tier: 0
used_by:
  - commands/file-meeting.md (Step 0, Step 4, Step 6)
---

# Cross-Meeting Intelligence Detection

Protocols for detecting patterns ACROSS the full meeting history. While `cross-relationship-patterns.md` handles within-meeting cross-subsystem scans, this reference handles cross-MEETING intelligence: convergence signals, contradiction tracking, and action item lifecycle.

---

## 1. Action Item Triage Protocol (Step 0)

Before starting the filing pipeline, Larry checks for unfinished business from prior meetings.

### Load Open Items

Read `room/action-items.md` if it exists. This aggregated file is produced by `compute-meetings-intelligence` and contains all open/done action items across meetings.

**If the file does not exist or has zero open items:** Skip Step 0 entirely. Proceed to Step 1 silently -- do not mention action items.

### Present Quick Triage

Show open items as a pre-flight check, not an interrogation:

> "3 open items from your last meeting. Quick check -- any done?"
>
> | # | Owner | Task | From Meeting |
> |---|-------|------|--------------|
> | 1 | Lawrence | Review TAM analysis | 2026-03-15-mentoring |
> | 2 | Sarah | Send competitor deck | 2026-03-15-mentoring |
> | 3 | Tyler | Schedule user interviews | 2026-03-10-research |
>
> [mark done: 1,3 / skip / review all]

Keep it lightweight. The user is here to file a new meeting, not review old business. Quick in, quick out.

### Handle Responses

- **mark done (e.g., "1,3")**: Update each item's status from `open` to `done` in the SOURCE meeting's `action-items.md` file (e.g., `room/meetings/2026-03-15-mentoring/action-items.md`). Find the source meeting by the `Source Meeting` column in the aggregated table. Do NOT edit the aggregated `room/action-items.md` directly -- it gets rebuilt by `compute-state`.
- **skip**: Move on to Step 1. No changes made.
- **review all**: Show each item individually for yes/no confirmation.

Track items marked done for inclusion in this meeting's summary: "Cleared 2 action items from prior meetings."

### Lifecycle Rule

Action items follow a simple open/done lifecycle. No intermediate states. No auto-expiry. The user decides when something is done.

---

## 2. Cross-Reference During Filing Protocol (Step 4 Enhancement)

During segment filing (Step 4), if open action items remain (not all cleared in Step 0), compare each segment being filed against them.

### Detection Method

Use Larry's judgment -- not exact text matching. An action item about "Review TAM analysis" could be addressed by a segment discussing "Updated market size projections." Look for semantic overlap between the segment content and the action item task description.

### Confidence Threshold

Only surface when Larry is at least 70% confident that a segment addresses an open action item. False positives here interrupt the filing flow and erode trust.

### Surfacing

When a match is found:

> "This looks like progress on Lawrence's 'Review TAM analysis'. Mark as done?"

If user confirms: update the source meeting's `action-items.md` (same as Step 0 handling). If user declines: continue filing without changes.

### Rate Limiting

Surface at most 3 action item matches per filing session. If more are found, batch the remaining ones and present them at the end of Step 4: "I also noticed possible progress on 2 more items. Quick review?"

---

## 3. Cross-Meeting Convergence Detection Protocol (Step 6 Enhancement)

After the within-meeting cross-relationship scan (existing Step 6 behavior), perform a cross-meeting scan for convergence signals.

### Scan Protocol

1. **Extract key topics** from the current meeting's filed segments. These become the search terms.
2. **Grep `topics:` fields** in ALL `room/meetings/*/metadata.yaml` files. This is a pre-filter -- fast and cheap.
3. **Count topic frequency** across meetings. For each topic appearing in 3+ meetings (including the current one), generate a convergence signal.
4. **Surface each signal** in Larry's voice:

> "Market validation has been raised in 4 of your last 6 meetings. This is becoming a central theme."

> "Regulatory risk keeps coming up -- 3 meetings in a row now. Might be worth a dedicated session."

### Convergence Signal Format

Each convergence signal includes:
- The topic/theme that is converging
- How many meetings it appears in (and which ones)
- A brief interpretation of what the convergence means

### Recording

Convergence signals are written to:
1. The current meeting's `summary.md` in the new `## Convergence Signals` section
2. Tracked in room-level state for compute-state to aggregate

---

## 4. Cross-Meeting Contradiction Detection Protocol (Step 6 Enhancement)

After convergence detection, scan for contradictions across the meeting history.

### Pre-Filter Step

Load metadata.yaml from recent meetings and identify those that share topics OR speakers with the current meeting. This avoids loading irrelevant meeting summaries.

### Scan Window

Load summaries from up to 10 matching prior meetings. If fewer than 10 share topics/speakers, load all matching ones. Never load more than 10 -- context window management per research pitfall #1.

### Detection Method

Use Larry's LLM reasoning to compare current meeting claims against prior meeting claims. Look for:
- **Position changes**: Same speaker said X before, now says Y
- **Speaker disagreements**: Speaker A said X in a prior meeting, Speaker B says not-X now
- **Numerical conflicts**: Different figures for the same metric across meetings
- **Strategy reversals**: Direction decided in one meeting contradicted in another

### Severity-Based Flagging

**HIGH-impact** (financials, strategy, key decisions):
Flag immediately during filing with specific references:

> "Lawrence said TAM was $190M in the March 15 meeting, but now says $120M. Which is current?"

The user resolves high-impact contradictions on the spot. Record the resolution.

**LOW-impact** (opinions, preferences, minor details):
Collect and include in the meeting summary's `## Cross-Meeting Contradictions` section only. Do not interrupt filing for low-impact contradictions.

### Resolution Tracking

When a high-impact contradiction is surfaced and the user resolves it (confirms which claim is current):
- Note the resolution in the current meeting's summary
- The resolved claim becomes the authoritative version
- The prior claim is marked as superseded (noted in the contradiction record)

---

## 5. Enhanced Meeting Summary Sections

The meeting summary (`summary.md`) gains two new sections, added AFTER the existing sections (Key Decisions, Insights Filed, Contradictions Detected, Gaps, Action Items, Rejections, Speakers):

### Convergence Signals Section

```markdown
## Convergence Signals

{Topics appearing in 3+ meetings across the meeting history. Only include this
section if convergence was detected. Skip entirely if none.}

- **{topic}**: Appeared in {count} meetings ({meeting-id-1}, {meeting-id-2}, {meeting-id-3})
  Interpretation: {what this convergence suggests}
```

### Cross-Meeting Contradictions Section

```markdown
## Cross-Meeting Contradictions

{Contradictions detected against prior meetings. Beyond the within-meeting
contradictions in the "Contradictions Detected" section above. Only include
this section if cross-meeting contradictions were found. Skip entirely if none.}

- **{Claim in current meeting}** vs **{Claim in prior meeting}**
  Prior meeting: {meeting-id}
  Speaker(s): {current speaker} vs {prior speaker}
  Severity: {HIGH | LOW}
  Resolution: {user's resolution, if provided, or "Unresolved"}
```

---

## 6. Context Window Management

Cross-meeting scanning can consume significant context. Follow these rules:

### Meeting Limit

Scan at most 10 prior meetings. For rooms with extensive meeting history, use the 10 most recent.

### Pre-Filter Before Loading

Use metadata.yaml grep to PRE-FILTER relevant meetings by topic and speaker BEFORE loading full summaries. Only load `summary.md` for meetings that share at least one topic or speaker with the current meeting.

### Efficient Scanning Pattern

1. Grep all `metadata.yaml` files for topic matches (fast, small files)
2. From matches, identify the most relevant 10 meetings
3. Load only those summaries for detailed comparison
4. Never load all meeting transcripts -- summaries contain sufficient signal

### Graceful Degradation

If the room has fewer than 3 prior meetings, skip convergence detection (threshold cannot be met). Contradiction detection still runs against any available prior meetings.

---

## Cross-Reference

- Within-meeting cross-relationships: `references/meeting/cross-relationship-patterns.md`
- Meeting summary template: `references/meeting/summary-template.md`
- Action item format: per-meeting `action-items.md` in meeting archive
- Aggregated action items: `room/action-items.md` (produced by `compute-meetings-intelligence`)
