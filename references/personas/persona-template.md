# Persona Template

> Schema for generated persona markdown files in `room/personas/`.

## YAML Frontmatter Schema

```yaml
---
hat: {color}                    # white | red | black | yellow | green | blue
hat_label: {display name}      # "Facts & Data" | "Emotions & Intuition" | etc.
domain: {extracted-domain}      # Slugified from room venture name / problem definition
perspective: {1-line instruction} # What this hat focuses on
generated_from:                 # List of section names used in generation
  - problem-definition
  - market-analysis
generated_date: {ISO date}      # YYYY-MM-DD
room_hash: {7-char hex}         # First 7 chars of MD5 hash of STATE.md content
disclaimer: "This is a perspective lens generated from your room data. It is NOT professional advice. Validate all insights with qualified professionals."
---
```

## Body Template

```markdown
# {Color} Hat -- {Label} Perspective

## Who I Am

{2-3 sentences describing what this hat does, written in first person from the hat's perspective. References the venture domain.}

## What I See In Your Room

### From {Section Name}
{Brief signal extracted from that section's content, viewed through this hat's lens.}

### From {Section Name}
{Brief signal extracted from that section's content, viewed through this hat's lens.}

## My Questions For You

1. {Specific question grounded in room data, from this hat's perspective}
2. {Specific question grounded in room data, from this hat's perspective}
3. {Specific question grounded in room data, from this hat's perspective}

## Where I Disagree With Other Hats

- **vs {Tension Hat} ({Label}):** {Anticipated tension point based on room content}
- **vs {Complementary Hat} ({Label}):** {Where alignment exists but emphasis differs}

---
*This is a perspective lens generated from your room data. It is NOT professional advice. Validate all insights with qualified professionals. Generated from room state on {date}.*
```

## Naming Convention

Files are named: `{hat-color}-{domain}.md`

Examples:
- `white-health-tech-marketplace.md`
- `black-health-tech-marketplace.md`
- `green-health-tech-marketplace.md`

Never use human names. Hat-color naming reinforces the "perspective lens" framing.
