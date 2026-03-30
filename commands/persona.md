---
name: persona
description: Generate AI perspective lenses (De Bono Six Hats) from your room data
body_shape: C (Room Card)
---

# Persona -- AI Perspective Lenses

Generate persistent De Bono Six Thinking Hat perspective lenses from your room data.

## Important Distinction

**think-hats** is an INTERACTIVE METHODOLOGY SESSION. It walks you through the six hats in sequence as a facilitated exercise.

**persona** creates PERSISTENT PERSPECTIVE LENSES from your room data. Each persona file lives in your `personas/` section and can be invoked at any time to analyze artifacts, challenge assumptions, or provide a specific viewpoint.

## Subcommands

### generate

Create 6 hat-colored persona files from current room state.

```
/mos:persona generate
```

Reads your room sections, extracts domain signals, and generates one persona file per hat color in `personas/`. Each file contains the persona's perspective, focus areas, hat-specific questions, and inter-hat tensions -- all grounded in YOUR room content.

**Prerequisites:** Room must have 2+ populated sections (sections with at least one .md file). Thin rooms are rejected to prevent generic output.

### list

Show all generated personas in the room.

```
/mos:persona list
```

Returns each persona's hat color, label, domain, filename, and disclaimer.

### invoke [hat] [artifact]

Adopt a specific hat's perspective.

```
/mos:persona invoke black
/mos:persona invoke yellow path/to/artifact.md
```

Returns the persona content for the specified hat. When an artifact path is provided, the persona's perspective is applied to that specific document.

Hat colors: white (Facts & Data), red (Emotions & Intuition), black (Risks & Dangers), yellow (Benefits & Opportunities), green (Creativity & Alternatives), blue (Process & Meta).

### analyze [artifact]

Run all 6 perspectives against a single artifact.

```
/mos:persona analyze path/to/business-model.md
```

Returns all six hat perspectives on the artifact. Highlights where hats DISAGREE -- that tension is where insight lives.

## Personas Are Perspective Lenses, Not Expert Advisors

Every persona output includes a disclaimer. Personas synthesize from YOUR room data -- they never generate new domain facts. They are thinking tools that help you see your venture from structured angles, not authoritative opinions.

## Examples

**CLI:**
```bash
node bin/mindrian-tools.cjs persona generate ./room
node bin/mindrian-tools.cjs persona list ./room
node bin/mindrian-tools.cjs persona invoke ./room black
node bin/mindrian-tools.cjs persona analyze ./room path/to/artifact.md
```

**Natural language (Desktop/Cowork):**
- "Generate personas for my room"
- "What does the black hat think about my competitive analysis?"
- "Run all perspectives on my business model"
- "Show me my personas"
