# Phase 9: Meeting Knowledge Graph - Research

**Researched:** 2026-03-24
**Domain:** Cytoscape.js graph visualization, bash graph generation, WeasyPrint PDF, dashboard UI
**Confidence:** HIGH

## Summary

Phase 9 transforms the existing knowledge graph dashboard from a simple section+artifact viewer into a three-layer graph (Structure / Content / Intelligence) with meeting nodes, speaker nodes, concept nodes from [[wikilinks]], layer toggles, timeline mode, preset views, and Minto-structured meeting-report PDF export. The codebase is well-prepared: `scripts/build-graph` already generates Cytoscape.js JSON with section group nodes, artifact nodes, and FEEDS_INTO/CONTRADICTS/CONVERGES/INFORMS edges. `dashboard/index.html` already has De Stijl styling, Cytoscape.js 3.33.1, a detail panel, and a chat panel. `scripts/render-pdf` already has the full Jinja2+WeasyPrint pipeline with TOC bookmarks. The compute chain (`compute-state` -> `compute-team` -> `compute-meetings-intelligence`) already produces MEETINGS-INTELLIGENCE.md and TEAM-STATE.md with convergence signals, contradictions, action items, and team patterns.

The primary work is extension, not creation: (1) extend `build-graph` to scan `meetings/` and `team/` directories and parse `[[wikilinks]]` from all room `.md` files, (2) extend `dashboard/index.html` with new node classes, layer toggles, preset views, timeline layout mode, and enhanced detail panel, (3) add `meeting-report` type to `render-pdf` and `export.md` command, (4) add `[[wikilink]]` auto-insertion to `file-meeting.md`.

**Primary recommendation:** Build in three waves -- (1) build-graph extensions for meeting/speaker/concept nodes + [[wikilink]] edges + intelligence layer reading, (2) dashboard UI extensions for layer toggles + timeline mode + preset views + enhanced detail panel, (3) meeting-report export template + command extension + [[wikilink]] auto-insert in file-meeting.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Three-layer graph: Structure (sections), Content (artifacts, meetings, speakers), Intelligence (concepts from [[wikilinks]], contradictions, convergence)
- [[Wikilinks]] in room artifacts -- Larry auto-inserts, build-graph parses into edges
- Lazy graph pattern: relationships first, metadata on demand. Unresolved [[concept]] links are "red" (discovery signals)
- Micro-knowledge: edges ARE the intelligence, connections reveal hidden patterns
- Source-typed edges (meeting vs methodology vs proactive) with different visual weight
- De Stijl palette for all node types
- Layer toggles + preset views (Room Overview, Meeting Map, Team Network, Intelligence Map)
- Timeline mode integrated in graph (X-axis chronological, Y-axis sections), not a separate view
- REINFORCES pulse green, CONTRADICTS pulse red in timeline
- Node click -> details panel + room chat context
- Edge labels on hover (clean by default)
- Persist positions + auto-layout new nodes
- build-graph reads existing intelligence files (MEETINGS-INTELLIGENCE.md, TEAM-STATE.md, cross-relationship patterns)
- Minto pyramid for meeting-report export (executive summary -> claim -> backbone -> evidence -> full analysis)
- Larry auto-inserts [[concept-name]] links when filing

### Claude's Discretion
- Unified edge taxonomy details (beyond the required SPOKE_IN, FILED_TO, ATTENDED, REINFORCES, CONTRADICTS, INFORMS, CONVERGES, INVALIDATES, ENABLES)
- Speaker attribution PDF design (within De Stijl constraints)
- Node sizing (by connection count, importance, or flat)
- Preset view definitions (which layers/filters each preset enables)
- How timeline mode handles non-meeting nodes

### Deferred Ideas (OUT OF SCOPE)
- Opportunity Bank (room/opportunity-bank/ section)
- AI Team Members (synthetic advisors from domain intelligence)
- Wiki-style Data Room Dashboard (hosted wiki view)
- Obsidian Plugin
- Room as Remote MCP
- CLI tools consolidation (single mindrian-tools CLI)
- Data Room level status bar
- HSI/Tier 1 semantic similarity (beyond Tier 0 keyword matching)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GRAP-01 | Each meeting becomes a node in knowledge graph, colored distinctly, connected to all artifacts it produced | build-graph extension to scan meetings/ directory, new `meeting` node class in Cytoscape stylesheet |
| GRAP-02 | Speaker nodes in graph, connected to meeting nodes AND room sections they contributed to | build-graph extension to scan team/ profiles, new `speaker` node class, SPOKE_IN + ATTENDED edges |
| GRAP-03 | build-graph reads meetings/ directory and generates meeting + speaker nodes + SPOKE_IN / FILED_TO / ATTENDED edges | Direct extension of existing build-graph bash script patterns |
| GRAP-04 | Cross-meeting edges: same speaker + same concept = REINFORCES; two speakers contradict = CONTRADICTS | build-graph reads MEETINGS-INTELLIGENCE.md for contradictions, parses meeting summaries for convergence |
| GRAP-05 | Meeting timeline view in dashboard | Cytoscape.js preset layout with computed positions (X=date, Y=section) |
| DASH-06 | Knowledge graph shows team members as nodes with edges to contributions | Same as GRAP-02, dashboard styling |
| DASH-07 | export supports meeting-report type | New Jinja2 template + render-pdf extension + export.md command update |
| DOCS-06 | Meeting summary PDFs with speaker attribution and section-colored filing indicators | Meeting-report template with per-speaker sections and section color bars |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Cytoscape.js | 3.33.1 | Graph rendering, layout, interaction | Already loaded via CDN in dashboard/index.html |
| WeasyPrint | (installed) | PDF generation from HTML/CSS | Already used in scripts/render-pdf |
| Jinja2 | (installed) | HTML templating for PDFs | Already used in scripts/render-pdf |
| PyMuPDF (fitz) | (installed) | TOC bookmarks in PDF | Already used in scripts/render-pdf |
| markdown2 | (installed) | Markdown to HTML conversion | Already used in scripts/render-pdf |
| Bash | 5.x | Graph building, data extraction | All scripts are bash (build-graph, compute-*) |

### No New Dependencies Required

Phase 9 requires zero new libraries. Everything builds on existing infrastructure:
- Graph: Cytoscape.js already loaded, just needs new stylesheet rules and layout functions
- PDF: WeasyPrint + Jinja2 already configured, just needs new template
- Data: Bash scripts with YAML frontmatter parsing already established

## Architecture Patterns

### Recommended Extension Structure
```
scripts/
  build-graph              # EXTEND: add meeting/speaker/concept node generation + [[wikilink]] parsing + intelligence reading
dashboard/
  index.html               # EXTEND: add layer toggles, timeline mode, preset views, enhanced detail panel, new node/edge styles
  graph.json               # OUTPUT: now includes meeting, speaker, concept nodes + new edge types
templates/
  meeting-report.html      # NEW: Minto pyramid structured meeting report template
commands/
  export.md                # EXTEND: add meeting-report type
  file-meeting.md          # EXTEND: add [[wikilink]] auto-insertion step
```

### Pattern 1: Three-Layer Node Classification

Each node in graph.json gets a `layer` field and a `classes` string for Cytoscape styling:

**Structure Layer** (always visible):
- `section-group` nodes (existing 8 sections) -- layer: "structure"

**Content Layer**:
- `artifact` nodes (existing room entries) -- layer: "content"
- `meeting` nodes (NEW) -- layer: "content", classes: "meeting"
- `speaker` nodes (NEW) -- layer: "content", classes: "speaker"

**Intelligence Layer**:
- `concept` nodes (NEW, from [[wikilinks]]) -- layer: "intelligence", classes: "concept"
- Intelligence edges: REINFORCES, CONTRADICTS, CONVERGES, INVALIDATES, ENABLES

**Node data schema extension:**
```json
{
  "data": {
    "id": "meeting/2026-03-15-mentoring",
    "label": "Mentoring Session",
    "layer": "content",
    "color": "#D4A843",
    "meeting_date": "2026-03-15",
    "speakers": ["Lawrence Aronhime", "Tyler"],
    "decisions_count": 3,
    "action_items_count": 2
  },
  "classes": "meeting"
}
```

### Pattern 2: [[Wikilink]] Parsing in build-graph

Extend build-graph to scan all `.md` files in room/ for `[[...]]` patterns:

```bash
# Regex to extract wikilinks from markdown content
grep -oP '\[\[([^\]]+)\]\]' "$filepath" | sed 's/\[\[//;s/\]\]//' | sort -u
```

Each extracted concept becomes:
1. A concept node (if not already created) with classes: "concept"
2. An INFORMS edge from the source artifact to the concept node

Unresolved concepts (no matching file in room/) get a special class: "concept unresolved" for red styling.

### Pattern 3: Timeline Layout via Cytoscape Preset

Timeline mode uses Cytoscape.js `preset` layout with a position function:

```javascript
// Timeline layout: meetings on X-axis (chronological), sections on Y-axis
const timelineLayout = {
  name: 'preset',
  positions: function(node) {
    if (node.hasClass('meeting')) {
      const date = new Date(node.data('meeting_date'));
      const x = dateToX(date); // map date range to pixel range
      const y = 100; // meetings on top row
      return { x, y };
    }
    if (node.hasClass('section-group')) {
      return { x: 0, y: sectionToY(node.data('id')) }; // fixed Y per section
    }
    // Artifacts near their section
    if (node.hasClass('artifact')) {
      const parentY = sectionToY(node.data('section'));
      return { x: dateToX(node.data('created')), y: parentY };
    }
    return null; // let Cytoscape decide
  },
  animate: true,
  animationDuration: 300
};
```

### Pattern 4: Position Persistence

Save node positions to localStorage on drag-end. Restore on load via preset layout:

```javascript
// Save positions
cy.on('dragfree', 'node', function(evt) {
  const pos = evt.target.position();
  const positions = JSON.parse(localStorage.getItem('graphPositions') || '{}');
  positions[evt.target.id()] = pos;
  localStorage.setItem('graphPositions', JSON.stringify(positions));
});

// Restore: use saved positions for known nodes, auto-layout for new ones
const saved = JSON.parse(localStorage.getItem('graphPositions') || '{}');
// For nodes with saved positions, use preset. For new nodes, run CoSE on just those nodes.
```

### Pattern 5: Layer Toggle via Cytoscape Selectors

Toggle layers by showing/hiding nodes by class:

```javascript
function toggleLayer(layer, visible) {
  const selector = `node[layer="${layer}"]`;
  if (visible) {
    cy.$(selector).show();
    cy.$(selector).connectedEdges().show();
  } else {
    cy.$(selector).hide();
    cy.$(selector).connectedEdges().hide();
  }
}
```

### Pattern 6: Edge Labels on Hover

```javascript
// Default: no label visible
{ selector: 'edge', style: { 'label': '' } }

// On hover: show edge type
cy.on('mouseover', 'edge', function(evt) {
  evt.target.style('label', evt.target.data('type'));
  evt.target.style('font-size', 10);
  evt.target.style('text-background-color', '#1A1A1A');
  evt.target.style('text-background-opacity', 0.8);
});
cy.on('mouseout', 'edge', function(evt) {
  evt.target.style('label', '');
});
```

### Pattern 7: Source-Typed Edges

Edges carry `source_type` field (meeting, methodology, proactive) for visual differentiation:

```json
{
  "data": {
    "source": "meeting/2026-03-15-mentoring",
    "target": "problem-definition/reframe-01",
    "type": "FILED_TO",
    "source_type": "meeting",
    "label": "filed to"
  },
  "classes": "filed-to meeting-source"
}
```

### Anti-Patterns to Avoid
- **Recomputing intelligence in build-graph:** Intelligence is already computed by compute-state chain. build-graph reads the computed files, it does not recompute. This avoids duplicate logic and keeps the computation chain clean.
- **Separate timeline view page:** Timeline is a layout MODE within the same graph, toggled by a button. Not a separate HTML page.
- **Heavy node metadata in graph.json:** Follow the lazy graph pattern. Node data in graph.json should be minimal (id, label, layer, color, key dates). Full content loads on-demand when clicked (detail panel reads from filesystem or chat context).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Graph layout | Custom position calculation from scratch | Cytoscape.js `preset` layout with position function + `cose` for freeform | Cytoscape handles animation, overlap avoidance, responsiveness |
| Wikilink parsing | Complex NLP extraction | Simple regex `\[\[([^\]]+)\]\]` in bash grep | [[wikilinks]] are explicit markers, not implicit concepts |
| PDF generation | Custom PDF builder | WeasyPrint + Jinja2 (existing pattern) | Already proven in 4 document types, just add template |
| Meeting data | Custom meeting parser | Read existing metadata.yaml + summary.md (already structured) | Phase 6-8 already structured all meeting data |
| Edge detection | New intelligence computation | Read MEETINGS-INTELLIGENCE.md + TEAM-STATE.md | compute chain already runs, build-graph just visualizes |

**Key insight:** The entire intelligence pipeline is already built (Phases 6-8). Phase 9 is a VISUALIZATION and EXPORT phase, not a computation phase. build-graph reads computed files; the dashboard renders them; the PDF template formats them.

## Common Pitfalls

### Pitfall 1: Compound Node Layout Confusion
**What goes wrong:** Cytoscape.js compound (parent) nodes interact poorly with some layouts. Current code uses `parent` field on artifact nodes to group them under section nodes. Adding meeting nodes that don't have a section parent will confuse the CoSE layout.
**Why it happens:** CoSE expects all nodes to participate in the compound hierarchy.
**How to avoid:** Meeting and speaker nodes should NOT be compound children. They connect to sections via edges (FILED_TO, ATTENDED), not via parent field. Only artifact nodes keep their `parent` field.
**Warning signs:** Meeting nodes rendering inside section boxes, or floating far away from the graph.

### Pitfall 2: Graph.json Size Explosion
**What goes wrong:** With meetings, speakers, concepts, and all their edges, graph.json can become large (1000+ elements), causing slow rendering.
**Why it happens:** Each meeting can produce 5-15 artifacts, each artifact can have 3+ [[wikilinks]], each speaker connects to multiple meetings and sections.
**How to avoid:** Limit concept nodes to those referenced in 2+ files. Single-reference [[wikilinks]] are still edges but don't create standalone concept nodes. Use Cytoscape.js filtering (hide/show) rather than loading subsets.
**Warning signs:** Dashboard taking >2 seconds to render, browser becoming sluggish.

### Pitfall 3: Timeline Layout Date Parsing in Bash
**What goes wrong:** build-graph (bash) needs to output meeting dates for timeline positioning, but bash date parsing is fragile across platforms.
**Why it happens:** Meeting directories use YYYY-MM-DD-name format; extracting and sorting dates in bash requires careful handling.
**How to avoid:** Pass raw date strings in graph.json. Let the JavaScript in dashboard/index.html handle date parsing and positioning via `new Date()`. Bash just copies the string.
**Warning signs:** Dates sorting incorrectly, timeline showing meetings out of order.

### Pitfall 4: Edge Hover Conflicting with Node Hover
**What goes wrong:** Existing node hover logic dims all non-connected elements. Adding edge hover labels creates visual conflicts when hovering over edges near nodes.
**Why it happens:** Both mouseover handlers fire in close proximity.
**How to avoid:** Edge hover labels only show when not in "node focused" mode. Check a state variable before showing edge labels.
**Warning signs:** Labels flickering, edges highlighting incorrectly.

### Pitfall 5: Persisted Positions Becoming Stale
**What goes wrong:** Positions saved in localStorage reference node IDs. If build-graph regenerates with different IDs (new meetings added), old positions no longer match.
**Why it happens:** Node IDs are derived from file paths; new files create new IDs.
**How to avoid:** Only apply saved positions for IDs that still exist in the current graph.json. New nodes get auto-placed via CoSE. Clear stale IDs on each load.
**Warning signs:** New nodes appearing at (0,0), old nodes jumping to wrong positions.

## Code Examples

### build-graph: Meeting Node Generation
```bash
# Scan meetings/ directory for meeting nodes
if [ -d "$ROOM_DIR/meetings" ]; then
  for meeting_dir in "$ROOM_DIR/meetings"/*/; do
    [ -d "$meeting_dir" ] || continue
    dir_name=$(basename "$meeting_dir")
    meeting_date="${dir_name:0:10}"
    meeting_name="${dir_name:11}"

    # Read metadata.yaml for speakers, counts
    metadata_file="${meeting_dir}metadata.yaml"
    speakers_str=""
    if [ -f "$metadata_file" ]; then
      speakers_str=$(grep '^speakers:' "$metadata_file" | head -1 | sed 's/^speakers: *//' | tr -d '[]')
    fi

    meeting_id="meeting/${dir_name}"
    node="{ \"data\": { \"id\": \"${meeting_id}\", \"label\": \"$(json_escape "$meeting_name")\", \"layer\": \"content\", \"color\": \"#D4A843\", \"meeting_date\": \"${meeting_date}\", \"speakers\": \"$(json_escape "$speakers_str")\" }, \"classes\": \"meeting\" }"
    nodes="${nodes},
    ${node}"
    node_count=$((node_count + 1))
  done
fi
```

### build-graph: [[Wikilink]] Parsing
```bash
# Scan all .md files for [[wikilinks]] -> concept edges
if [ -d "$ROOM_DIR" ]; then
  while IFS= read -r md_file; do
    [ -f "$md_file" ] || continue
    source_id=$(echo "$md_file" | sed "s|^$ROOM_DIR/||;s|\.md$||")

    # Extract [[concept]] patterns
    while IFS= read -r concept; do
      concept=$(echo "$concept" | sed 's/\[\[//;s/\]\]//')
      [ -z "$concept" ] && continue
      concept_id="concept/${concept}"

      # Create concept node if not seen
      if [ -z "${concept_seen[$concept_id]:-}" ]; then
        concept_seen[$concept_id]=1
        # Check if concept has a corresponding file (resolved vs unresolved)
        resolved_class="concept"
        # Search for matching file in room/
        if ! find "$ROOM_DIR" -name "${concept}.md" -type f 2>/dev/null | grep -q .; then
          resolved_class="concept unresolved"
        fi
        concept_node="{ \"data\": { \"id\": \"${concept_id}\", \"label\": \"$(json_escape "$concept")\", \"layer\": \"intelligence\", \"color\": \"#C8A43C\" }, \"classes\": \"${resolved_class}\" }"
        nodes="${nodes},
    ${concept_node}"
        node_count=$((node_count + 1))
      fi

      # Add edge from source to concept
      add_edge "$source_id" "$concept_id" "REFERENCES" "references" "references"
    done < <(grep -oP '\[\[[^\]]+\]\]' "$md_file" 2>/dev/null | sort -u)
  done < <(find "$ROOM_DIR" -name "*.md" -not -path "*/meetings/*/transcript.md" 2>/dev/null)
fi
```

### Dashboard: Layer Toggle UI
```html
<!-- Layer toggle buttons in header -->
<div class="layer-toggles">
  <button class="layer-btn active" data-layer="structure">Structure</button>
  <button class="layer-btn active" data-layer="content">Content</button>
  <button class="layer-btn active" data-layer="intelligence">Intelligence</button>
</div>

<!-- Preset view buttons -->
<div class="preset-views">
  <button class="preset-btn" data-preset="room-overview">Room</button>
  <button class="preset-btn" data-preset="meeting-map">Meetings</button>
  <button class="preset-btn" data-preset="team-network">Team</button>
  <button class="preset-btn" data-preset="intelligence-map">Intel</button>
</div>
```

### Dashboard: New Cytoscape Stylesheet Rules
```javascript
// Meeting nodes -- gold diamond
{
  selector: 'node.meeting',
  style: {
    'background-color': '#D4A843',
    'shape': 'diamond',
    'width': 50,
    'height': 50,
    'label': 'data(label)',
    'font-family': '"Inter", sans-serif',
    'font-size': 11,
    'color': '#F5F0E8',
    'text-valign': 'bottom',
    'text-margin-y': 8
  }
},
// Speaker nodes -- blue circle
{
  selector: 'node.speaker',
  style: {
    'background-color': '#1E3A6E',
    'shape': 'ellipse',
    'width': 40,
    'height': 40,
    'label': 'data(label)',
    'font-family': '"Inter", sans-serif',
    'font-size': 10,
    'color': '#F5F0E8',
    'text-valign': 'bottom',
    'text-margin-y': 6
  }
},
// Concept nodes -- yellow small square
{
  selector: 'node.concept',
  style: {
    'background-color': '#C8A43C',
    'shape': 'rectangle',
    'width': 30,
    'height': 30,
    'label': 'data(label)',
    'font-size': 9,
    'color': '#F5F0E8',
    'text-valign': 'bottom',
    'text-margin-y': 6
  }
},
// Unresolved concept -- red border (discovery signal)
{
  selector: 'node.concept.unresolved',
  style: {
    'border-width': 2,
    'border-color': '#A63D2F',
    'background-opacity': 0.5
  }
},
// REINFORCES edge -- green pulsing in timeline
{
  selector: 'edge.reinforces',
  style: {
    'line-color': '#2D6B4A',
    'target-arrow-shape': 'none',
    'curve-style': 'bezier',
    'width': 2,
    'line-style': 'solid'
  }
},
// SPOKE_IN edge
{
  selector: 'edge.spoke-in',
  style: {
    'line-color': '#A09A90',
    'target-arrow-color': '#A09A90',
    'target-arrow-shape': 'triangle',
    'curve-style': 'bezier',
    'width': 1
  }
},
// FILED_TO edge
{
  selector: 'edge.filed-to',
  style: {
    'line-color': '#5C5A56',
    'target-arrow-color': '#5C5A56',
    'target-arrow-shape': 'triangle',
    'curve-style': 'bezier',
    'width': 1
  }
}
```

### Minto Pyramid Meeting Report Template Structure
```html
{# meeting-report.html #}
{% extends "_base.html" %}
{% block content %}
{# Level 1: Executive Summary #}
<div class="minto-executive">
  <h2>Executive Summary</h2>
  {{ executive_summary|safe }}
</div>

{# Level 2: Logical Claim #}
<div class="minto-claim">
  <h2>What the Meetings Tell Us</h2>
  {{ logical_claim|safe }}
</div>

{# Level 3: Critical Backbone -- supporting arguments from key meetings #}
<div class="minto-backbone">
  <h2>Key Meeting Insights</h2>
  {% for meeting in key_meetings %}
  <div class="meeting-card" style="border-left: 4px solid {{ meeting.color }};">
    <h3>{{ meeting.name }} ({{ meeting.date }})</h3>
    <div class="speakers">{{ meeting.speakers }}</div>
    {{ meeting.highlights|safe }}
  </div>
  {% endfor %}
</div>

{# Level 4: Evidence -- contradictions, open items, unresolved debates #}
<div class="minto-evidence">
  <h2>Contradictions and Open Questions</h2>
  {{ contradictions_html|safe }}
  {{ open_questions_html|safe }}
</div>

{# Level 5: Full Analysis by Meeting #}
{% for meeting in all_meetings %}
<div class="meeting-full" style="page-break-before: always;">
  <h2>{{ meeting.name }}</h2>
  <div class="meeting-meta">
    <span class="date">{{ meeting.date }}</span>
    {% for speaker in meeting.speaker_list %}
    <span class="speaker-tag" style="border-color: {{ speaker.color }};">{{ speaker.name }} ({{ speaker.role }})</span>
    {% endfor %}
  </div>
  {# Section-colored filing indicators per DOCS-06 #}
  <div class="filings">
    {% for filing in meeting.filings %}
    <div class="filing-indicator" style="background: {{ filing.section_color }}20; border-left: 3px solid {{ filing.section_color }};">
      <span class="filing-section">{{ filing.section_label }}</span>
      <span class="filing-title">{{ filing.title }}</span>
    </div>
    {% endfor %}
  </div>
</div>
{% endfor %}
{% endblock %}
```

## De Stijl Color Palette for New Node Types

| Node Type | Color | CSS Var | Shape |
|-----------|-------|---------|-------|
| Section group | Per-section (8 colors) | existing | Rectangle |
| Artifact | Per-section (inherited) | existing | Rectangle |
| Meeting | Gold `#D4A843` | `--ds-meeting` | Diamond |
| Speaker | Deep blue `#1E3A6E` | `--ds-blue` | Circle |
| Concept (resolved) | Warm yellow `#C8A43C` | `--ds-yellow` | Small rectangle |
| Concept (unresolved) | Yellow + red border | `--ds-yellow` + `--ds-red` border | Small rectangle, dashed border |

## Edge Taxonomy (Unified)

| Edge Type | CSS Class | Source | Visual | Layer |
|-----------|-----------|-------|--------|-------|
| FEEDS_INTO | `feeds-into` | Pipeline stages | Gray arrow, taxi curve | Content |
| FILED_TO | `filed-to` | Meeting -> section artifact | Gray arrow, bezier | Content |
| SPOKE_IN | `spoke-in` | Speaker -> meeting | Light gray arrow | Content |
| ATTENDED | `attended` | Speaker -> meeting | Light dotted | Content |
| REFERENCES | `references` | Artifact -> concept (via [[wikilink]]) | Yellow dotted | Intelligence |
| REINFORCES | `reinforces` | Cross-meeting same concept | Green solid, pulse in timeline | Intelligence |
| CONTRADICTS | `contradicts` | Conflicting claims | Red dashed | Intelligence |
| CONVERGES | `converges` | Theme in 3+ sections | Yellow dotted | Intelligence |
| INVALIDATES | `invalidates` | Stale assumption | Red solid, thick | Intelligence |
| ENABLES | `enables` | Unblocking dependency | Green arrow | Intelligence |
| INFORMS | `informs` | Cross-section reference | Gray arrow | Intelligence |

## Preset View Definitions

| Preset | Layers Shown | Filter | Quick-Action |
|--------|-------------|--------|-------------|
| Room Overview | Structure + Content | All nodes visible, intelligence edges hidden | Default view |
| Meeting Map | Structure + Content (meetings only) | Hide artifacts, show meetings + speakers + FILED_TO edges | `cy.nodes('.artifact').hide()` |
| Team Network | Content (speakers only) | Show speakers + meetings + SPOKE_IN/ATTENDED edges | Focus on people |
| Intelligence Map | All three layers | Show concept nodes + intelligence edges, dim content | Reveal hidden patterns |

## Timeline Mode Design

**Toggle:** A "Timeline" button next to the layout controls. Switches between freeform (CoSE) and timeline (preset) layout.

**Position Calculation:**
- X-axis: Meeting dates mapped to pixel range (earliest date = left edge, latest = right edge)
- Y-axis: Sections at fixed vertical positions (8 rows, evenly spaced)
- Meeting nodes: Positioned at their date on X, at a dedicated "meetings" row on top
- Artifact nodes: Positioned at their meeting date on X, at their section's Y
- Speaker nodes: Hidden in timeline mode (reduce clutter) or grouped at bottom
- Non-meeting nodes (from methodology sessions): Positioned at their `created` date on X

**Edge Animation in Timeline:**
- REINFORCES edges: CSS animation pulsing green (`line-color` oscillation via `cy.animate()`)
- CONTRADICTS edges: CSS animation pulsing red
- Other edges: Static, shown on hover only

**Non-meeting node handling (Claude's discretion):**
- Methodology artifacts without a date get positioned at the left edge (earliest known date)
- Section group nodes become horizontal bands spanning the full timeline width

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 8 section nodes only | 8 sections + artifact nodes + edges | Phase 3.1 | Foundation for this phase |
| analyze-room for edges | compute chain + analyze-room | Phase 8 | Intelligence pre-computed, build-graph reads it |
| No meeting nodes | Meeting data in meetings/ directory | Phase 6-7 | Source data ready for graph nodes |

## Open Questions

1. **Node sizing strategy**
   - What we know: Connection count (degree centrality) is a natural metric
   - What's unclear: Whether flat sizing looks better at small graph sizes
   - Recommendation: Use degree centrality with min/max bounds. Nodes with 5+ connections get max size, 1 connection gets min size. Easy to adjust later.

2. **Concept node threshold**
   - What we know: Every [[wikilink]] creates an edge, but not every concept needs its own node
   - What's unclear: At what reference count a concept deserves a standalone node
   - Recommendation: Create concept nodes for concepts referenced in 2+ different files. Single-reference concepts get edges but no visible node (reduces clutter).

3. **Timeline animation performance**
   - What we know: Cytoscape.js can animate transitions between layouts
   - What's unclear: Performance with 100+ nodes transitioning simultaneously
   - Recommendation: Use `animate: true` with `animationDuration: 300`. If performance issues arise, disable animation for >200 nodes.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bash integration tests (existing pattern) |
| Config file | None -- tests are inline bash assertions |
| Quick run command | `bash scripts/build-graph ./room && echo "OK"` |
| Full suite command | `bash scripts/build-graph ./room && python3 scripts/render-pdf meeting-report --room room/ --no-open && echo "OK"` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GRAP-01 | Meeting nodes in graph.json | integration | `bash scripts/build-graph ./room && python3 -c "import json; d=json.load(open('dashboard/graph.json')); assert any(n['classes']=='meeting' for n in d['elements']['nodes'])"` | Wave 0 |
| GRAP-02 | Speaker nodes in graph.json | integration | `bash scripts/build-graph ./room && python3 -c "import json; d=json.load(open('dashboard/graph.json')); assert any(n['classes']=='speaker' for n in d['elements']['nodes'])"` | Wave 0 |
| GRAP-03 | SPOKE_IN/FILED_TO/ATTENDED edges | integration | `bash scripts/build-graph ./room && python3 -c "import json; d=json.load(open('dashboard/graph.json')); types=set(e['data']['type'] for e in d['elements']['edges']); assert 'SPOKE_IN' in types"` | Wave 0 |
| GRAP-04 | REINFORCES/CONTRADICTS cross-meeting edges | integration | `bash scripts/build-graph ./room && python3 -c "import json; d=json.load(open('dashboard/graph.json')); types=set(e['data']['type'] for e in d['elements']['edges']); assert 'REINFORCES' in types or 'CONTRADICTS' in types"` | Wave 0 |
| GRAP-05 | Timeline layout function exists | manual | Open dashboard in browser, click Timeline button | Manual |
| DASH-06 | Team member nodes visible | manual | Open dashboard, toggle Content layer, verify speaker nodes | Manual |
| DASH-07 | meeting-report export runs | integration | `python3 scripts/render-pdf meeting-report --room room/ --no-open` | Wave 0 |
| DOCS-06 | PDF has speaker attribution + section colors | manual | Open generated PDF, verify speaker names and colored bars | Manual |

### Sampling Rate
- **Per task commit:** `bash scripts/build-graph ./room && echo "graph OK"`
- **Per wave merge:** Full graph build + PDF render + visual dashboard check
- **Phase gate:** All 8 requirements verified, graph.json has all node types, PDF renders correctly

### Wave 0 Gaps
- [ ] Test room with meeting data: need a `room/meetings/2026-01-15-test/` directory with metadata.yaml, summary.md for testing build-graph
- [ ] `templates/meeting-report.html` -- new Jinja2 template (DOCS-06, DASH-07)
- [ ] render-pdf needs `meeting-report` added to DOC_TYPES dict

## Sources

### Primary (HIGH confidence)
- [Cytoscape.js official API](https://js.cytoscape.org/) -- preset layout, compound nodes, animation, styling
- Existing codebase: `scripts/build-graph`, `dashboard/index.html`, `scripts/render-pdf`, `scripts/compute-meetings-intelligence`, `scripts/compute-team`
- CONTEXT.md decisions (user locked)

### Secondary (MEDIUM confidence)
- [Cytoscape.js blog: Using layouts](https://blog.js.cytoscape.org/2020/05/11/layouts/) -- preset layout position function pattern
- [Cytoscape.js GitHub issues](https://github.com/cytoscape/cytoscape.js/issues/888) -- compound node visibility toggling

### Tertiary (LOW confidence)
- Timeline animation performance estimates (needs real-world testing with actual graph sizes)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all tools already in project, zero new dependencies
- Architecture: HIGH -- extending well-established patterns, all source data structures known
- Pitfalls: HIGH -- based on direct codebase analysis and Cytoscape.js documented behavior
- Timeline layout: MEDIUM -- preset layout approach is proven but specific performance characteristics depend on data volume

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable -- no fast-moving dependencies)
