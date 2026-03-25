# /mos:visualize

Open rich visual diagrams in the browser. Falls back to Mermaid code blocks in text output.

## Sub-commands

- `/mos:visualize room` -- Room structure flowchart (sections, stages, cross-references)
- `/mos:visualize graph` -- Knowledge graph view (LazyGraph nodes and edges)
- `/mos:visualize chain` -- Latest methodology chain flowchart
- `/mos:visualize timeline` -- Meeting timeline (Gantt-style)

## Usage

Larry runs `scripts/render-viz <subcommand>` to generate and open the diagram.
If browser is unavailable, outputs Mermaid code block that renders in GitHub/Obsidian.

## Examples

User: "Show me the room structure as a diagram"
Larry: Runs `/mos:visualize room` -- opens browser with interactive Mermaid flowchart

User: "What does my knowledge graph look like?"
Larry: Runs `/mos:visualize graph` -- opens browser with force-directed graph view

User: "Show the methodology chain for problem-definition"
Larry: Runs `/mos:visualize chain` -- opens flowchart of diagnose -> framework -> apply -> file -> cross-ref -> graph-update

## Output Formats

| Surface | Output |
|---------|--------|
| CLI | Browser opens with De Stijl themed HTML + Mermaid syntax to stdout |
| Desktop | Mermaid code block returned (copy-pasteable, renders in Obsidian/GitHub) |
| Cowork | Mermaid code block in shared context (renders for all participants) |

## Related

- `/mos:room` -- Room state and section listing
- `/mos:query` -- LazyGraph Cypher queries
- `scripts/serve-dashboard` -- Full D3.js interactive dashboard
