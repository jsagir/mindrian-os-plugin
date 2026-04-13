# Obsidian Vault Kit

This directory is the canonical, version-controlled source for the Obsidian
configuration kit used by `/mos:vault` (Phase 78). It contains the static
assets that must be copied verbatim into any exported vault's `.obsidian/`
folder so the vault immediately renders with MindrianOS De Stijl theme,
section-colored graph view, and four ready-to-use note templates.

## Contents

| Source                                 | Destination in vault                        | Purpose                                      |
|----------------------------------------|---------------------------------------------|----------------------------------------------|
| `snippets/mindrian-destijl.css`        | `.obsidian/snippets/mindrian-destijl.css`   | De Stijl dark theme (red/blue/gold/Mondrian) |
| `appearance.json`                      | `.obsidian/appearance.json`                 | Enables snippet + dark mode + fonts          |
| `app.json`                             | `.obsidian/app.json`                        | Sane defaults (live preview, shortest links) |
| `graph.json`                           | `.obsidian/graph.json`                      | Section color groups + force layout          |
| `templates/new-artifact.md`            | `.obsidian/templates/new-artifact.md`       | Content artifact template (RULES-08)         |
| `templates/new-meeting-note.md`        | `.obsidian/templates/new-meeting-note.md`   | Meeting note template (RULES-08)             |
| `templates/new-team-profile.md`        | `.obsidian/templates/new-team-profile.md`   | Team profile template (RULES-08)             |
| `templates/new-xref.md`                | `.obsidian/templates/new-xref.md`           | Cross-reference template (RULES-08)          |

## Requirement Traceability

- **KIT-01** De Stijl CSS snippet -- `snippets/mindrian-destijl.css` (verbatim from align-ecosystem, 297 lines)
- **KIT-02** Obsidian app defaults -- `app.json`
- **KIT-03** Section-colored graph view -- `graph.json` (>=11 colorGroups, hideUnresolved, showArrow)
- **KIT-04** Appearance enables snippet + dark mode -- `appearance.json`
- **KIT-05** Graph force layout tuning -- `graph.json` (linkDistance=180, centerStrength=0.4, repelStrength=12)
- **RULES-08** Four note templates matching `FRONTMATTER_SCHEMA` -- `templates/*.md`

## Phase 78 Contract

`/mos:vault` must rsync this directory's contents into the target vault's
`.obsidian/` folder (never mutate the files during copy). The kit is
intentionally a pure static asset set -- zero generators, zero templating.
