# Graph Visualization Standard

**Decision:** vis-network (vis.js) is the standard graph visualization library for ALL MindrianOS exports, snapshots, dashboards, and visual presentations.

**Decided:** 2026-04-06
**Supersedes:** Cytoscape.js for exports (Cytoscape.js retained for internal plugin dashboard only)

## Why vis-network

| Requirement | vis-network | Cytoscape.js |
|-------------|-------------|--------------|
| Physics simulation | Built-in ForceAtlas2, excellent | Available but less polished |
| Drag & drop | Excellent out-of-box | Good |
| Learning curve | Simple API | Steep |
| Clustering | Built-in | Requires extensions |
| Visual quality | Beautiful by default | Needs heavy styling |
| Setup | `new Network(container, data, options)` | Verbose config |

Cytoscape.js has superior graph algorithms (50+ built-in) but exports don't need algorithms -- they need beautiful interactive exploration.

## When to Use What

| Context | Library | Reason |
|---------|---------|--------|
| SnapshotHub exports | vis-network | Beauty + interaction for stakeholders |
| /mos:present views | vis-network | Same as SnapshotHub |
| /mos:dashboard live server | vis-network | Consistency with exports |
| /mos:visualize command | vis-network | Standard graph output |
| Plugin internal (Brain queries) | Cytoscape.js | Graph algorithms needed |

## Standard Configuration

```javascript
var options = {
  physics: {
    enabled: true,
    solver: 'forceAtlas2Based',
    forceAtlas2Based: {
      gravitationalConstant: -40,
      centralGravity: 0.008,
      springLength: 120,
      springConstant: 0.04,
      damping: 0.4
    },
    stabilization: { iterations: 200, fit: true }
  },
  interaction: {
    hover: true,
    tooltipDelay: 200,
    zoomView: true,
    dragView: true,
    keyboard: { enabled: true }
  },
  nodes: {
    font: {
      color: '#ccc',
      size: 11,
      face: 'Inter, system-ui, sans-serif',
      strokeWidth: 3,
      strokeColor: '#0a0a0f'
    },
    borderWidth: 2,
    shadow: { enabled: true, color: 'rgba(0,0,0,0.3)', size: 6 }
  },
  edges: {
    smooth: { type: 'continuous', roundness: 0.3 },
    hoverWidth: 2
  },
  layout: { improvedLayout: true }
};
```

## Node Shapes

| Node Type | Shape | Size | Description |
|-----------|-------|------|-------------|
| Section header | diamond | 20 | Room section nodes (problem-definition, market-analysis, etc.) |
| Artifact | dot | 12 | Individual entries/documents |
| Framework | triangle | 16 | Methodology framework nodes (for Brain views) |
| Person | square | 14 | Team member or speaker nodes |

## Edge Colors

| Edge Type | Color | Opacity | Description |
|-----------|-------|---------|-------------|
| CONVERGES | #2ECC71 | 0.4 | Themes align across sections |
| CONTRADICTS | #E74C3C | 0.4 | Tension detected between entries |
| INFORMS | #3498DB | 0.4 | One entry informs another |
| INVALIDATES | #E67E22 | 0.5 | One entry invalidates another |
| FEEDS_INTO | #9B59B6 | 0.5 | Framework chains (Brain views) |

## Section Colors

| Section | Color | Hex |
|---------|-------|-----|
| problem-definition | Red | #E74C3C |
| market-analysis | Yellow/Gold | #F39C12 |
| solution-design | Blue | #3498DB |
| business-model | Green | #2ECC71 |
| competitive-analysis | Orange | #E67E22 |
| team-execution | Purple | #9B59B6 |
| legal-ip | Gold | #D4AC0D |
| financial-model | Teal | #1ABC9C |
| personas | Deep Purple | #8E44AD |
| opportunity-bank | Forest Green | #27AE60 |
| meetings | Gray | #7F8C8D |

## CDN

```html
<script src="https://unpkg.com/vis-network@9.1.9/standalone/umd/vis-network.min.js"></script>
```

## Required UI Elements

Every graph view MUST include:

1. **Sidebar** with section filter toggles and edge type toggles
2. **Detail panel** that appears on node click (shows connections)
3. **Controls bar** at bottom: Fit, Zoom +/-, Physics toggle, Stabilize
4. **Back to Hub** link in top bar
5. **Mindrian branding** with Mondrian color bar
6. **Legend** explaining edge types and node shapes
7. **Stats** showing node/edge counts

## Dark Theme (Standard)

```css
body { background: #0a0a0f; }
sidebar { background: #0d0d14; border-right: 1px solid #1a1a2a; }
top-bar { background: #0d0d12; }
node-font-color: #ccc
node-font-stroke: #0a0a0f (3px outline for readability)
detail-panel: #12121a with backdrop-filter: blur(8px)
```

## Integration Points

- `scripts/generate-hub.cjs` -- embeds vis-network graph in SnapshotHub
- `scripts/generate-snapshot.cjs` -- constellation view uses vis-network
- `scripts/generate-presentation.cjs` -- graph view uses vis-network
- `lib/quickview/hub-server.cjs` -- live dashboard graph uses vis-network
- `dashboard/index.html` -- localhost dashboard uses vis-network
