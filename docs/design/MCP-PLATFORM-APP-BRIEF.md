# MindrianOS MCP Platform App -- Design Brief

**Date:** 2026-04-11
**Status:** Ready to build
**Context:** Brainstorming session output -- Brain + UI/UX Pro Max + UI Ruling System

---

## Architecture Decision

**One universal app with modes** (Brain's Platform Thinking recommendation)

Single HTML shell (`mindrian-platform.html`) renders all views based on tool data.
10 goal-oriented tools feed data into the same platform. The tool decides WHAT to show.
The platform decides HOW to show it.

Source: Neo4j Brain -- "Tools vs Platforms Innovation" framework:
- "A framework for understanding the evolution from single-purpose tools to flexible platforms that enable ecosystems of possibility"
- Process steps: Spot Platform Opportunities -> Develop Platform -> Enable Innovation
- REQUIRES: Ecosystem Thinking

## Design System (UI/UX Pro Max)

**Style:** Dark Mode (OLED) -- WCAG AAA, eye-friendly
**Typography:** Fira Code (data/mono) + Fira Sans (text) -- dashboard/analytics product
**Colors (semantic):**
- Primary: #2563EB (blue)
- Accent/CTA: #F97316 (orange-amber)
- Success: #22C55E
- Warning: #EAB308
- Danger: #EF4444
- Surface: #1A1A1A (dark), #2A2A2A (card)
- Text: #F8F6F0 (primary), #8A8478 (muted)
- Mondrian palette (brand decoration only, NOT semantic): Red #C23B22, Blue #2A5DB0, Yellow #F2C12E

**Key corrections from UI/UX Pro Max audit:**
1. Use semantic color tokens, not raw hex
2. Minimum 44x44px touch targets on ALL interactive elements
3. Mullins cells should be Bullet Charts (value + target + qualitative zones), not simple fill bars
4. Focus states on every interactive element (2-4px visible ring)
5. Tab transitions: 150-300ms ease-out
6. Use containerDimensions from host (ext-apps 0.3.0), not fixed 600px height
7. Respect prefers-reduced-motion
8. No emoji anywhere (SVG icons: Lucide)

## Brand Continuity: CLI to MCP App

| Element | CLI (UI Ruling System) | MCP App (HTML) |
|---------|----------------------|----------------|
| Mondrian grid | ASCII box chars | CSS grid with 3px gaps + colored borders |
| Progress bars | 10-char filled/dot | Bullet chart SVG (value + target + zones) |
| Tree structure | branch/last-branch glyphs | Nested collapsible divs |
| Color meaning | 5 ANSI colors, fixed meaning | Same 5 semantic tokens in CSS vars |
| Glyphs | 12 text glyphs | SVG equivalents (Lucide icons) |
| Action footer | /mos: commands in cyan | Clickable buttons that send intents |
| Intelligence strip | Glyph + one-line, max 3 | Alert cards with action buttons |

## Five Views (Tab-based navigation)

### 1. Mullins (Home)
- Three columns: Is It Real? (blue) / Can We Win? (amber) / Is It Worth It? (red)
- Each cell: question + bullet chart (current evidence vs target) + artifact count
- Click cell: drill-down showing evidence artifacts + gap questions
- Bottom: Brain-suggested next framework for weakest area + "Run It" intent button
- This is PWS Value Proposition -- the hub (16 inbound, 17 outbound FEEDS_INTO)

### 2. Room (Command Center)
- Cascade alerts at top: APPROVE/REJECT/DEFER buttons (contradiction, convergence, invalidation)
- Mondrian section grid: cards with health indicators, artifact counts, click-to-explore
- Section cards: larger card = more content, health dot = gap/warning/good

### 3. Graph (Knowledge Explorer)
- Cytoscape.js interactive graph
- Edge type filter buttons (All, Tensions, Patterns, HSI, Causal)
- Click node: show artifact details + connections
- Search input for filtering

### 4. Chain (Framework Explorer)
- FEEDS_INTO chain visualization from Brain
- Click any framework node to see: what feeds into it, what it feeds, why it matters
- Current chain highlighted based on room state + venture stage

### 5. Claims (Assumption Tracker)
- Card grid: one card per assumption
- Color-coded validity: green=supported, red=contradicted, gray=untested, yellow=stale
- Each card shows: claim text, section, evidence count for/against
- Click to see full evidence trail

## Interaction Pattern: Shopify Intent Model

UI elements NEVER execute actions directly. Every interaction sends an INTENT to Larry:

```javascript
// User clicks "Run It" on Mullins suggested framework
app.updateContext({
  type: 'user-intent',
  data: { action: 'run-methodology', framework: 'financial-feasibility' }
});
// Larry receives intent, runs framework with full conversation context
```

```javascript
// User clicks APPROVE on cascade alert
app.callServerTool({
  name: 'file_artifact',
  arguments: { action: 'approve', target: cascadeId }
});
// Server processes, returns updated room state, app re-renders
```

## MCP App Communication (ext-apps 0.3.0)

```javascript
import { App } from '@modelcontextprotocol/ext-apps';
const app = new App({ name: 'MindrianOS', version: '2.0.0' });
app.connect();

// Receive data from tool call
app.ontoolresult = (result) => {
  const data = JSON.parse(result.content.find(c => c.type === 'text').text);
  switchView(data.view);     // Which tab to activate
  renderView(data);           // Populate with data
};

// Call back to server
app.callServerTool({ name: 'whats_weak', arguments: {} });

// Send intent to Larry
app.updateContext({ type: 'user-intent', data: { ... } });
```

## Model-Adaptive Server Instructions

| Model | Larry Variant | Lines | Key Differences |
|-------|--------------|-------|-----------------|
| Claude | Full Larry | ~300 | Decimal dial, mode-adaptive traces, voice modulation, cross-domain instinct |
| GPT | Simplified Larry | ~200 | 3-mode system, explicit tool chains, harder length caps, example-based learning |
| Gemini | Core Larry | ~150 | Core voice + tool guidance only |
| Unknown | Core Larry | ~150 | Safe default |

Selection: `detectHostModel(transport)` at connection time.

## Known Client Bugs to Guard Against

1. **ChatGPT strips _meta from tool-result** -- don't rely on viewUUID for state
2. **ChatGPT doesn't replay ontoolresult on refresh** -- app must detect stale state and re-fetch
3. **Claude.ai postMessage injection** -- guard all message handlers for non-JSON-RPC messages

## File Location

Production: `lib/mcp/app-html/mindrian-platform.html`
Prototype: `lib/mcp/app-html/mindrian-platform.html` (current -- needs rebuild)
Preview: `C:\Users\jsagi\Downloads\mindrian-platform-preview.html`

## Next Steps

1. Rebuild mindrian-platform.html with all UI/UX Pro Max corrections
2. Wire to ext-apps App class with real callServerTool
3. Register as MCP App resource in mindrian-product-server.cjs
4. Test on Claude Desktop first, ChatGPT second
