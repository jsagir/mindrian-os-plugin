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

## Room Structure (8 DD-Aligned Sections)

problem-definition, market-analysis, solution-design, business-model, competitive-analysis, team-execution, legal-ip, financial-model

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
