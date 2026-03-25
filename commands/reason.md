---
command: mos:reason
description: Analyze room sections using Minto/MECE structured reasoning
usage: /mos:reason <subcommand> [section] [options]
---

# Reasoning Engine

Analyze room sections using Minto/MECE structured reasoning. Larry captures WHY each section matters, tracks confidence levels, and identifies cross-section dependencies.

## Usage

```
/mos:reason generate [section]    Generate REASONING.md for a section (or all sections)
/mos:reason get <section>         View existing reasoning for a section
/mos:reason verify <section>      Check verification criteria status
/mos:reason run <section>         Execute full methodology run (6 steps)
/mos:reason list                  Show reasoning status for all sections
/mos:reason frontmatter <section> [field]  Read/write reasoning frontmatter
```

### Subcommands

**generate** -- Create REASONING.md from template. Larry fills content during conversation.
- Without section argument: generates templates for ALL discovered sections
- With section: generates for that specific section only
- Overwrites existing REASONING.md (regenerate from fresh template)

**get** -- Read existing reasoning content and parsed frontmatter for a section.

**verify** -- Returns verification criteria (`must_be_true` list), dependency info (`requires`, `provides`, `affects`), and current verification status.

**run** -- Execute a full 6-step methodology run on a section:
1. Diagnose -- identify section state and gaps
2. Select framework -- choose appropriate methodology
3. Apply -- run the selected framework
4. File -- save reasoning artifacts
5. Cross-reference -- find dependencies with other sections
6. Update graph -- create REASONING_INFORMS edges in LazyGraph

**list** -- Show all sections with reasoning status, confidence summary, verification status, and Brain enrichment flag.

**frontmatter** -- Read or write individual frontmatter fields in a section's REASONING.md. Without a field argument, returns the full frontmatter object.

## Examples

```
# Generate reasoning templates for all sections
/mos:reason generate

# Generate for a specific section
/mos:reason generate problem-definition

# View reasoning for market analysis
/mos:reason get market-analysis

# Check what must be true for a section
/mos:reason verify solution-design

# Run full methodology analysis on a section
/mos:reason run competitive-analysis

# See reasoning status across the room
/mos:reason list

# Read a specific frontmatter field
/mos:reason frontmatter problem-definition confidence

# Check verification status
/mos:reason frontmatter team-execution verification
```

## How It Works

The reasoning engine provides STRUCTURE. Larry provides CONTENT.

1. `generate` creates a REASONING.md template with the locked Minto/MECE frontmatter schema
2. Larry fills it with specific analysis during conversation -- claims, confidence ratings, verification criteria
3. The filled reasoning persists in `.reasoning/{section}/REASONING.md`
4. Future sessions read `.reasoning/` artifacts to understand section state without re-analyzing
5. Cross-section dependencies (`requires`, `provides`, `affects`) feed LazyGraph edges

## Larry Integration

Larry reads existing `.reasoning/` artifacts at session start to understand section state without re-analyzing. The reasoning frontmatter (confidence levels, verification status, dependency graph) gives Larry immediate context about what is known, what is uncertain, and what connects where.

When Larry generates reasoning content, it follows the Minto Pyramid structure:
- **Situation** -- current state of affairs
- **Complication** -- what changed or challenges the situation
- **Question** -- the key question this section answers
- **Answer** -- the section's core argument

Claims are rated using MECE confidence levels (high/medium/low) with specific evidence citations.

## Tri-Surface Delivery

| Surface | How It Works |
|---------|-------------|
| **CLI** | `/mos:reason` commands with blockquote thinking traces |
| **Desktop** | MCP tools (`reasoning` tool group) + resources (`reasoning://state`, `reasoning://section/{name}`) + `reason-section` prompt |
| **Cowork** | Shared `.reasoning/` directory -- all team members see the same reasoning state |

---
*MindrianOS Reasoning Engine -- structured critical thinking as persistent artifacts.*
