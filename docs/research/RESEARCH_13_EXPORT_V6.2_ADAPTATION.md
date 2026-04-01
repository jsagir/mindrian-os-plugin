# RESEARCH 13: Export Snapshot v6.2 -- Post-Powerhouse Adaptation

Date: 2026-03-31
Status: Design vision, ready for milestone planning
Predecessor: docs/EXPORT-DESIGN-BRIEF.md (v5.2 original design)
Reference implementation: pws-website-wiki.vercel.app (PWS website room)

---

## The Key Insight

The PWS website wiki at pws-website-wiki.vercel.app proves that a MindrianOS room can represent ANY project -- not just a venture. That room adapted to a WEBSITE project: sections became page categories, artifacts became design decisions, the graph showed component relationships, and the hub presented web-specific metrics (pages, components, responsive breakpoints) instead of venture-specific ones (TAM, funding, team).

v6.2 must do the same: the Export Snapshot System should ADAPT its presentation to whatever the room contains. A venture room gets investor-ready output. A website room gets design-system output. A research room gets academic output. The room's content determines the presentation, not a hardcoded template.

---

## What Powerhouse v1.6.0 Adds to Export

### From v5.2 (pre-Powerhouse)
The original EXPORT-DESIGN-BRIEF.md designed a static generator that reads room data and produces branded HTML. It works but doesn't leverage any of the new infrastructure.

### v6.2 Gets These New Components

**1. Model Routing (Phase 39)**
- Cheap scanning (haiku) for data extraction from room artifacts
- Sonnet for synthesis (section summaries, insight extraction)
- Opus for the hub page narrative (the "story" of the room)
- Per-room config means each room's export uses appropriate model tier

**2. Parallel Agents (Phase 41)**
- Extract from all 8+ sections simultaneously using --swarm pattern
- Each section gets its own extraction agent running in parallel
- Synthesis agent combines all sections after parallel extraction completes
- Export generation time: ~30 seconds instead of ~5 minutes

**3. HSI Spectral Profiles (Spectral OM-HMM)**
- Each artifact has a spectral profile (spectral_gap, dominant_mode, mode_entropy)
- The graph visualization can color-code artifacts by thinking-mode diversity
- Breakthrough connections (high spectral_gap_avg) get visual emphasis
- Innovation differential displayed as edge thickness

**4. 12 KuzuDB Edge Types (Phases 39-45)**
- Original 5: INFORMS, CONTRADICTS, CONVERGES, ENABLES, INVALIDATES
- Reasoning: REASONING_INFORMS (section dependency graph)
- HSI: HSI_CONNECTION, REVERSE_SALIENT (innovation discovery)
- DbA: ANALOGOUS_TO, STRUCTURALLY_ISOMORPHIC, RESOLVES_VIA
- Graph view shows ALL 12 edge types with color coding per the De Stijl palette

**5. Design-by-Analogy Data (Phase 44-45)**
- ANALOGOUS_TO edges visualized as cross-domain bridges
- TRIZ principles shown on CONTRADICTS edges (resolution suggestions)
- SAPPhIRE functional encoding as metadata overlays
- "Innovation Opportunities" section showing top reverse salients

**6. Sentinel Snapshots (Phase 43)**
- room/.snapshots/ contains weekly STATE.md copies
- Export can include version history sidebar showing room evolution
- Week-over-week drift visualization (what changed since last snapshot)
- room/.intelligence/ digests embedded as "Intelligence Briefing" section

**7. MINTO Reasoning Per Section (existing + Phase 40 staleness)**
- Each section's REASONING.md provides governing thought + 3 MECE arguments
- Export uses governing thoughts as section lead paragraphs
- Confidence levels (high/medium/low) shown as visual indicators
- Stale reasoning flagged with "needs update" markers

**8. Deep Links (Phase 42)**
- Every section, artifact, and graph node gets a claude-cli:// deep link
- Click any element in the HTML export -> opens Claude Code at that exact room location
- Dashboard-to-CLI handoff is seamless
- "Edit in Claude Code" buttons throughout

**9. @include CLAUDE.md (Phase 42)**
- Export knows about modular architecture sections
- Can pull relevant architecture context into "About This Room" section

**10. Coordinator Mode Manifest (Phase 46)**
- Export includes team composition from .claude/teams/mindrian.json
- "AI Team" section showing which agents contributed to each section

---

## The Adaptive Hub Pattern (from PWS Website Room)

### How PWS Website Room Adapted

The PWS website room at pws-website-wiki.vercel.app demonstrated:

1. **Sections became page categories** -- problem-definition/ held "user needs analysis", solution-design/ held "component architecture", market-analysis/ held "competitor website analysis"

2. **Graph showed component relationships** -- nodes were pages/components, edges showed navigation flow and dependency (which component uses which)

3. **Hub metrics were web-specific** -- instead of TAM/SAM/SOM it showed pages count, component count, responsive breakpoints, accessibility score

4. **Visual ruling system adapted** -- same De Stijl aesthetic but content was web design (color palettes, typography scales, spacing systems) not venture metrics

5. **Intelligence was design-focused** -- contradictions were "mobile layout conflicts with desktop", convergences were "3 pages use the same card pattern"

### The Generalization Rule

The export hub page should:

1. **Read room STATE.md** to determine room TYPE (venture, website, research, product, course, etc.)
2. **Adapt stats bar** to room-specific metrics (ventures: sections/articles/connections/gaps/grants; websites: pages/components/breakpoints/issues/deployments; research: papers/citations/methodologies/findings/gaps)
3. **Adapt section cards** to room-specific language (ventures: "Problem Definition"; websites: "User Needs"; research: "Literature Review")
4. **Adapt intelligence** to room-specific signals (ventures: investor readiness; websites: design consistency; research: methodology coverage)
5. **Adapt graph view** to room-specific edge semantics (ventures: INFORMS between business sections; websites: DEPENDS_ON between components; research: CITES between papers)

### Implementation: Room Type Detection

```javascript
function detectRoomType(stateContent, sections) {
  // Check STATE.md for explicit type
  if (stateContent.includes('venture_type:')) return parseVentureType(stateContent);

  // Infer from section names and content
  const sectionNames = sections.map(s => s.name);

  if (sectionNames.includes('financial-model') && sectionNames.includes('competitive-analysis'))
    return 'venture';
  if (sectionNames.some(s => s.includes('component') || s.includes('page') || s.includes('design-system')))
    return 'website';
  if (sectionNames.some(s => s.includes('literature') || s.includes('methodology') || s.includes('findings')))
    return 'research';
  if (sectionNames.some(s => s.includes('curriculum') || s.includes('module') || s.includes('assessment')))
    return 'course';

  return 'general'; // Fallback: use generic labels
}
```

### Adaptive Config per Room Type

```javascript
const ROOM_TYPE_CONFIG = {
  venture: {
    statsBar: ['sections', 'articles', 'connections', 'gaps', 'grants'],
    hubTitle: 'Venture Data Room',
    sectionLabels: { 'problem-definition': 'Problem Definition', 'market-analysis': 'Market Analysis', ... },
    insightTypes: ['investor-readiness', 'competitive-gaps', 'financial-viability'],
    graphLabel: 'Venture Knowledge Graph',
  },
  website: {
    statsBar: ['pages', 'components', 'breakpoints', 'issues', 'deployments'],
    hubTitle: 'Design System Room',
    sectionLabels: { 'problem-definition': 'User Needs', 'solution-design': 'Component Architecture', ... },
    insightTypes: ['design-consistency', 'accessibility', 'performance'],
    graphLabel: 'Component Dependency Graph',
  },
  research: {
    statsBar: ['papers', 'citations', 'methodologies', 'findings', 'gaps'],
    hubTitle: 'Research Room',
    sectionLabels: { 'problem-definition': 'Research Question', 'market-analysis': 'Literature Review', ... },
    insightTypes: ['methodology-coverage', 'citation-network', 'finding-strength'],
    graphLabel: 'Research Knowledge Graph',
  },
  general: {
    statsBar: ['sections', 'articles', 'connections', 'gaps', 'opportunities'],
    hubTitle: 'Data Room',
    sectionLabels: {}, // Use section names as-is
    insightTypes: ['gaps', 'contradictions', 'convergences'],
    graphLabel: 'Knowledge Graph',
  },
};
```

---

## v6.2 Export Pipeline (Powerhouse-Enhanced)

### Stage 1: SCAN (parallel, haiku)
Dispatch parallel agents (one per section) to extract:
- Artifact count, total word count, methodology coverage
- MINTO governing thought (from REASONING.md)
- Confidence levels
- Key claims and their validity status
- Spectral profiles (mean OM-HMM, dominant mode)

### Stage 2: GRAPH (local, no model)
Read KuzuDB directly:
- All 12 edge types with properties
- HSI_CONNECTION pairs with spectral_gap_avg
- REVERSE_SALIENT opportunities with innovation thesis
- ANALOGOUS_TO cross-domain connections
- REASONING_INFORMS dependency chains

### Stage 3: INTELLIGENCE (sonnet)
Synthesize from scan + graph:
- Top 5 insights (priority: CONTRADICTS > REVERSE_SALIENT > CONVERGES > ANALOGOUS_TO > INFORMS)
- Room health score (section completeness x edge density x reasoning coverage)
- Innovation map (breakthrough connections highlighted)
- Sentinel digest (from room/.intelligence/ if exists)

### Stage 4: ADAPT (haiku)
Detect room type, apply config:
- Stats bar with room-specific metrics
- Section cards with adapted labels
- Intelligence framed for room type
- Graph styled for room-specific edge semantics

### Stage 5: CHAT EMBED (existing infrastructure)
Embed the generative chat panel that queries LazyGraph:
- lib/chat/chat-panel.js already exists (BYOAPI chat with Larry from Phase 32)
- Chat queries KuzuDB via Cypher in real-time ("What contradicts my pricing?")
- User can ask questions about the room's graph FROM the export HTML
- Chat panel docked to bottom-right, expandable
- Connects to Claude API via user's own key (BYOAPI pattern)
- Falls back to "Connect API key to enable chat" CTA if no key configured
- Graph clicks inject context into chat: "Tell me about [clicked node]"
- This is the LIVING layer -- the export is not a static PDF, it's an interactive intelligence surface

### Stage 6: RENDER (no model)
Generate HTML using existing De Stijl template:
- Hub page with adaptive content
- 7 views: Dashboard, Wiki, Deck, Insights, Diagrams, Graph, Chat
- Deep links (claude-cli://) on every clickable element
- Version history sidebar (from room/.snapshots/)
- "Built with MindrianOS" footer
- Chat panel embedded in every view (docked bottom-right)

### Stage 6: EXPORT
Write to room/exports/{YYYY-MM-DD-HHmm}/:
- index.html (hub page)
- graph.html (interactive Cytoscape)
- wiki.html (article browser)
- deck.html (auto-generated slides)
- insights.html (intelligence briefing)
- diagrams.html (Mermaid/visual)
- manifest.json (rich metadata for version history)

---

## Reference Implementations

### PWS Website Room (pws-website-wiki.vercel.app)
- Shows room adapted to website project
- Sections = page categories, artifacts = design decisions
- Graph = component dependency map
- This is the PROOF that rooms are universal, not venture-specific

### ALIGN X Milken Room (align-x-milken-room.onrender.com)
- Shows room adapted to geopolitical investment thesis
- 30 pages, 295 edges, 7 views
- Graded A- by the system
- This is the PROOF that the export produces investor-ready output

### Demo Cancer Room
- Shows room adapted to research project
- Spectral OM-HMM tested here (7 spectral + 1 legacy profiles)
- This is the PROOF that scientific rooms work

---

## Moat Deepening Assessment

v6.2 Export deepens the moat because:

1. **Uses ALL 12 edge types in visualization** -- competitors would need the full KuzuDB schema
2. **Spectral profiles in graph coloring** -- competitors would need Markov chain analysis
3. **TRIZ principles on CONTRADICTS edges** -- competitors would need the TRIZ integration
4. **Adaptive room type detection** -- competitors would need the universal room architecture
5. **Deep links to CLI** -- competitors would need Claude Code integration
6. **Parallel extraction** -- competitors would need the model routing + agent swarm infrastructure
7. **Sentinel digest embedding** -- competitors would need the scheduled intelligence system

Every Powerhouse component feeds the export. The export becomes the PROOF of the integrated system.

---

## Milestone Structure (Proposed)

v6.2 Export Snapshot System (post-Powerhouse)

Phase 47: Adaptive Room Detection + Scan Pipeline
- Room type detection from STATE.md and sections
- Parallel extraction agents (one per section, haiku)
- ROOM_TYPE_CONFIG with venture/website/research/general presets

Phase 48: Graph Export + 12-Edge Visualization
- KuzuDB full export with all 12 edge types
- Cytoscape config per edge type (colors from De Stijl palette)
- Spectral profile visualization (node coloring by thinking mode)
- Breakthrough connections highlighted

Phase 49: Adaptive Hub Page
- Stats bar adapts to room type
- Section cards with MINTO governing thoughts
- Intelligence briefing (top 5 insights)
- Sentinel digest embedding
- Deep links throughout

Phase 50: 7 Views + Chat + Version History
- Wiki, Deck, Insights, Diagrams views (adapted per room type)
- Generative chat panel querying LazyGraph via Cypher (from lib/chat/chat-panel.js)
- Chat docked bottom-right, graph clicks inject context ("Tell me about [node]")
- BYOAPI pattern: user's Claude API key, falls back to CTA
- Version history sidebar from room/.snapshots/
- manifest.json with rich metadata
- Offline-capable (file:// protocol, chat requires API key)

Phase 51: Polish + Reference Room Testing
- Test on: demo-cancer-room (research), PWS website room (website), ALIGN room (venture)
- Responsive 375px-1440px
- CDN/offline toggle for Cytoscape
- "Built with MindrianOS" branded footer

---

## Files Referenced

- docs/EXPORT-DESIGN-BRIEF.md (v5.2 original design -- 661 lines, still valid for base requirements)
- docs/EXPORT-VISION-BRIEF.md (v5.2 vision -- 417 lines)
- docs/EXPORT-BUILD-PROMPT.md (v5.2 build prompt -- 313 lines)
- scripts/generate-snapshot.cjs (v5.2 partial implementation -- 368 lines, working)
- pws-website-wiki.vercel.app (PWS website room -- reference hub)
- align-x-milken-room.onrender.com (ALIGN room -- reference export)
