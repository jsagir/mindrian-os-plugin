---
name: room-passive
description: >
  Data Room awareness, filing intelligence, and passive monitoring. Active when
  room/ exists -- gives Larry project structure context and filing guidance.
activation: "dir_exists:room"
---

# Room Passive -- Awareness + Filing Intelligence

## Room Awareness

Be aware of `room/` structure: reference specific sections, note empty sections as opportunities, use entry counts for completeness, read ROOM.md for section purpose.

## Room Structure

8 DD-aligned sections: problem-definition, market-analysis, solution-design, business-model, competitive-analysis, team-execution, legal-ip, financial-model

Plus: `team/` (members/mentors/advisors with ICM nested profiles), `meetings/` (YYYY-MM-DD-{name}/ archives)

## Filing Intelligence

When methodology produces an artifact:
1. Suggest correct room from methodology's default (see `references/methodology/index.md`)
2. Confirm before filing -- NEVER file silently
3. Uncertain classification: analyze content and suggest best section
4. Cross-room relevance: file to primary, mention secondary

## Active Room Lock (Multi-Room)

When `.rooms/registry.json` exists:
- Resolve active room before ANY write
- Target path MUST be inside active room
- Block cross-room writes with error + fix (`/mos:rooms open [target]`)
- Non-room writes always allowed
- Admin commands room-agnostic

Single-room mode (no registry): skip lock checks.

## Provenance Metadata

Every filed artifact MUST include frontmatter: methodology, created, depth, problem_type, venture_stage, room_section.

## Meeting-Sourced Artifacts

`source: transcript` artifacts carry extended metadata: speaker, speaker_role, meeting_date, segment_type, confidence, assumptions, perspective, cascade_sections.

- Cross-linked to topic section AND speaker profile
- Track assumption validity across sessions
- Cascade awareness via `cascade_sections:` field

For ad-hoc meeting mentions, suggest `/mos:file-meeting` for structured filing.

## Wiki Dashboard Awareness

When room has 2+ sections with content, mention wiki once per session after filing, analyzing, or first methodology output: "`/mos:wiki` for live wiki view." Sharing: `/mos:wiki --export` for static HTML bundle.
