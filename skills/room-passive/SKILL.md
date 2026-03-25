---
name: room-passive
description: >
  Data Room awareness, filing intelligence, and passive monitoring. Active when
  room/ exists -- gives Larry project structure context and filing guidance.
---

# Room Passive -- Awareness + Filing Intelligence

## Room Awareness

When responding, be aware of the `room/` directory structure:
- Reference specific rooms when relevant to the conversation
- Note empty rooms as opportunities ("Your competitive-analysis room is empty -- want to explore that?")
- Use room entry counts to gauge venture completeness
- Read ROOM.md files for section purpose and starter questions

## Room Structure (8 DD-Aligned Sections + Team + Meetings)

problem-definition, market-analysis, solution-design, business-model, competitive-analysis, team-execution, legal-ip, financial-model

**Plus meeting infrastructure:**
- `team/` -- members/, mentors/, advisors/, and role-specific directories with ICM nested profiles
- `meetings/` -- YYYY-MM-DD-{name}/ archives with transcript.md, summary.md, filed-to/

## Filing Intelligence

When a methodology session produces an artifact:

1. **Suggest the correct room** based on the methodology's default room (see `references/methodology/index.md`)
2. **Confirm before filing** -- NEVER file silently. Show artifact summary, suggest "File this to {section}?", wait for user confirmation or redirect
3. **Handle uncertain classifications** -- if the PostToolUse hook reports "UNCERTAIN", analyze the artifact content in conversation context and suggest the best room section
4. **Cross-room relevance** -- when an artifact relates to multiple rooms, file to the primary section and mention secondary relevance

## Provenance Metadata

Every filed artifact MUST include YAML frontmatter:

```yaml
---
methodology: {command-name}
created: {YYYY-MM-DD}
depth: {quick|deep}
problem_type: {definition-level/complexity}
venture_stage: {stage}
room_section: {section}
---
```

Larry adds this automatically when filing. Never omit provenance.

## Meeting-Sourced Artifacts

When artifacts have `source: transcript` in frontmatter, they came from `/mos:file-meeting`. Be aware:

- **Meeting provenance**: These artifacts carry extended metadata: speaker, speaker_role, meeting_date, segment_type, confidence, assumptions, perspective, cascade_sections
- **Cross-referencing**: Meeting artifacts are cross-linked to both the topic section AND the speaker's profile under room/team/
- **Assumption tracking**: The `assumptions:` field lists claims extracted from the meeting. Track assumption validity across sessions -- flag when new information contradicts an existing assumption
- **Cascade awareness**: The `cascade_sections:` field lists other sections this artifact may impact. When filing new content to those sections, mention the potential cascade

### Filing Intelligence for Meeting Content

When a user mentions a meeting or conversation during a regular session (not file-meeting):
- Suggest `/mos:file-meeting` for structured filing
- Note that pasting fragments loses provenance -- the full pipeline captures speaker, role, and context

## Wiki Dashboard Awareness

When a room has 2+ sections with content, Larry should mention the wiki once per session:

> "By the way — your Data Room has a live wiki view. Run `/mos:wiki` to see it as interconnected Wikipedia-style pages with your knowledge graph visualized."

**When to mention:**
- After filing an artifact (the wiki auto-updates)
- After running analyze-room (the wiki shows the same intelligence visually)
- After the first methodology session produces output
- Never more than once per session

**Sharing option:** If the user asks about sharing the Data Room:
> "You can share your wiki with others. Run `/mos:wiki --export` to generate a static HTML bundle you can host on Render, Vercel, or send as a zip. Your data, your choice."
