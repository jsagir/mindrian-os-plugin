// MindrianOS Visual Operations — De Stijl symbol system, ANSI palette, formatting helpers
// Zero dependencies. Single import for all visual identity constants.
// Locked symbol system from .planning/phases/17-visual-identity/17-CONTEXT.md

'use strict';

// ═══════════════════════════════════════════════════════════════
// SYMBOLS — MindrianOS visual vocabulary (locked)
// ═══════════════════════════════════════════════════════════════

const SYMBOLS = {
  brand: '\u2B21',           // ⬡ MindrianOS hexagon
  stages: {
    preOpportunity: '\u25CC', // ◌
    discovery: '\u25CE',      // ◎
    validation: '\u25C9',     // ◉
    design: '\u25C6',         // ◆
    investmentReady: '\u2605' // ★
  },
  edges: {
    INFORMS: '\u2192',        // →
    CONTRADICTS: '\u2297',    // ⊗
    CONVERGES: '\u2295',      // ⊕
    ENABLES: '\u25B6',        // ▶
    INVALIDATES: '\u2298'     // ⊘
  },
  modes: {
    investigative: '?',
    blend: '\u21CC',          // ⇌
    insight: '!'
  },
  health: {
    populated: '\u25A0',      // ■
    empty: '\u25A1',          // □
    partial: '\u25AA'         // ▪
  },
  box: {
    tl: '\u250C', tr: '\u2510', bl: '\u2514', br: '\u2518',
    h: '\u2500', v: '\u2502',
    lt: '\u251C', rt: '\u2524', tt: '\u252C', bt: '\u2534', cross: '\u253C'
  }
};

// ═══════════════════════════════════════════════════════════════
// ANSI — De Stijl 24-bit true color palette
// ═══════════════════════════════════════════════════════════════

const ANSI = {
  red:      '\x1b[38;2;166;61;47m',    // ds-red #A63D2F
  blue:     '\x1b[38;2;30;58;110m',    // ds-blue #1E3A6E
  yellow:   '\x1b[38;2;200;164;60m',   // ds-yellow #C8A43C
  green:    '\x1b[38;2;45;107;74m',    // ds-green #2D6B4A
  sienna:   '\x1b[38;2;181;96;42m',    // ds-sienna #B5602A
  amethyst: '\x1b[38;2;107;78;139m',   // ds-amethyst #6B4E8B
  cyan:     '\x1b[38;2;42;107;94m',    // ds-teal #2A6B5E
  cream:    '\x1b[38;2;245;240;232m',  // ds-cream #F5F0E8
  muted:    '\x1b[38;2;160;154;144m',  // ds-muted #A09A90
  reset:    '\x1b[0m',
  bold:     '\x1b[1m',
  dim:      '\x1b[2m'
};

// ═══════════════════════════════════════════════════════════════
// ANSI_BASIC — 16-color fallback for limited terminals
// ═══════════════════════════════════════════════════════════════

const ANSI_BASIC = {
  red: '\x1b[31m', blue: '\x1b[34m', yellow: '\x1b[33m',
  green: '\x1b[32m', sienna: '\x1b[38;5;208m', amethyst: '\x1b[35m',
  cyan: '\x1b[36m', cream: '\x1b[37m', muted: '\x1b[2m',
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m'
};

// ═══════════════════════════════════════════════════════════════
// EDGE_COLORS — Semantic color mapping (edge type -> De Stijl color)
// ═══════════════════════════════════════════════════════════════

const EDGE_COLORS = {
  INFORMS: ANSI.blue,
  CONTRADICTS: ANSI.red,
  CONVERGES: ANSI.yellow,
  ENABLES: ANSI.green,
  INVALIDATES: ANSI.sienna
};

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Map stage name string to its symbol character.
 * Handles kebab-case, camelCase, and space-separated names.
 * @param {string} stageName - e.g. "discovery", "pre-opportunity", "investmentReady"
 * @returns {string} symbol character or '?' if unknown
 */
function stageSymbol(stageName) {
  if (!stageName) return '?';
  const normalized = stageName.toLowerCase().replace(/[\s-_]+/g, '');
  const map = {
    preopportunity: SYMBOLS.stages.preOpportunity,
    discovery: SYMBOLS.stages.discovery,
    validation: SYMBOLS.stages.validation,
    design: SYMBOLS.stages.design,
    investmentready: SYMBOLS.stages.investmentReady
  };
  return map[normalized] || '?';
}

/**
 * Map edge type string to its symbol character.
 * @param {string} edgeType - e.g. "INFORMS", "CONTRADICTS"
 * @returns {string} symbol character or '?' if unknown
 */
function edgeSymbol(edgeType) {
  if (!edgeType) return '?';
  return SYMBOLS.edges[edgeType.toUpperCase()] || '?';
}

/**
 * Return health symbol based on entry count.
 * @param {number} entryCount - number of entries in section
 * @param {boolean} [partial=false] - explicitly flag as partial
 * @returns {string} ■ (populated), □ (empty), or ▪ (partial)
 */
function healthSymbol(entryCount, partial) {
  if (partial) return SYMBOLS.health.partial;
  if (entryCount > 0) return SYMBOLS.health.populated;
  return SYMBOLS.health.empty;
}

/**
 * Wrap text in ANSI color code + reset.
 * @param {string} text - text to colorize
 * @param {string} colorName - key from ANSI palette (e.g. 'red', 'blue')
 * @returns {string} colorized text with reset suffix
 */
function colorize(text, colorName) {
  const color = ANSI[colorName];
  if (!color) return text;
  return color + text + ANSI.reset;
}

/**
 * Format an edge relationship between two sections.
 * Returns: "fromSection →INFORMS→ toSection" with colored edge symbol.
 * @param {string} fromSection
 * @param {string} toSection
 * @param {string} edgeType - e.g. "INFORMS", "CONTRADICTS"
 * @returns {string} formatted edge string with ANSI color
 */
function formatEdge(fromSection, toSection, edgeType) {
  const sym = edgeSymbol(edgeType);
  const color = EDGE_COLORS[edgeType.toUpperCase()] || ANSI.muted;
  return `${fromSection} ${color}${sym}${edgeType}${sym}${ANSI.reset} ${toSection}`;
}

/**
 * Format a section header with stage symbol, health, and artifact count.
 * Returns: "◎ problem-definition ■ 3 artifacts"
 * @param {string} sectionName
 * @param {number} entryCount
 * @param {string} [stage] - venture stage name for symbol prefix
 * @returns {string} formatted section header
 */
function formatSectionHeader(sectionName, entryCount, stage) {
  const stageSym = stage ? stageSymbol(stage) + ' ' : '';
  const healthSym = healthSymbol(entryCount);
  const label = entryCount === 1 ? 'artifact' : 'artifacts';
  return `${stageSym}${sectionName} ${healthSym} ${entryCount} ${label}`;
}

// ═══════════════════════════════════════════════════════════════
// MERMAID DIAGRAM GENERATORS
// ═══════════════════════════════════════════════════════════════

// De Stijl hex colors for Mermaid style directives (no ANSI in diagrams)
const DS_HEX = {
  red: '#A63D2F',
  blue: '#1E3A6E',
  yellow: '#C8A43C',
  green: '#2D6B4A',
  sienna: '#B5602A',
  amethyst: '#6B4E8B',
  cream: '#F5F0E8',
  muted: '#A09A90',
  bg: '#0D0D0D'
};

// Map stage names to hex colors for Mermaid
const STAGE_HEX = {
  preopportunity: DS_HEX.muted,
  discovery: DS_HEX.blue,
  validation: DS_HEX.yellow,
  design: DS_HEX.green,
  investmentready: DS_HEX.amethyst
};

// Map edge types to hex colors for Mermaid
const EDGE_HEX = {
  INFORMS: DS_HEX.blue,
  CONTRADICTS: DS_HEX.red,
  CONVERGES: DS_HEX.yellow,
  ENABLES: DS_HEX.green,
  INVALIDATES: DS_HEX.sienna
};

/**
 * Sanitize a name for use as a Mermaid node ID.
 * Strips non-alphanumeric chars and camelCases.
 * @param {string} name
 * @returns {string}
 */
function mermaidId(name) {
  return name.replace(/[^a-zA-Z0-9]+/g, '_').replace(/(^_|_$)/g, '');
}

/**
 * Generate Mermaid graph TD syntax for room sections.
 * @param {Array<{name: string, entryCount: number, stage: string, edges: Array<{to: string, type: string}>}>} sections
 * @returns {string} Valid Mermaid syntax
 */
function generateMermaidRoom(sections) {
  if (!sections || sections.length === 0) return 'graph TD\n  empty[No sections]';

  const lines = ['graph TD'];
  const styles = [];

  for (const section of sections) {
    const id = mermaidId(section.name);
    const sym = stageSymbol(section.stage || '');
    const healthSym = healthSymbol(section.entryCount || 0);
    const label = `${sym} ${section.name} ${healthSym} ${section.entryCount || 0}`;
    lines.push(`  ${id}["${label}"]`);

    // Style based on stage
    const normalized = (section.stage || '').toLowerCase().replace(/[\s-_]+/g, '');
    const fillColor = STAGE_HEX[normalized] || DS_HEX.muted;
    const borderStyle = (section.entryCount || 0) === 0 ? ',stroke-dasharray: 5 5' : '';
    styles.push(`  style ${id} fill:${fillColor},color:${DS_HEX.cream},stroke:${DS_HEX.cream}${borderStyle}`);

    // Edges
    if (section.edges) {
      for (const edge of section.edges) {
        const toId = mermaidId(edge.to);
        const edgeColor = EDGE_HEX[edge.type] || DS_HEX.muted;
        lines.push(`  ${id} -->|${edge.type}| ${toId}`);
        // Link styles added after all edges
      }
    }
  }

  lines.push('');
  lines.push(...styles);

  return lines.join('\n');
}

/**
 * Generate Mermaid graph LR syntax for knowledge graph data.
 * @param {Array<{id: string, type: string, label: string}>} nodes
 * @param {Array<{from: string, to: string, type: string}>} edges
 * @returns {string} Valid Mermaid syntax
 */
function generateMermaidGraph(nodes, edges) {
  if (!nodes || nodes.length === 0) return 'graph LR\n  empty[No graph data]';

  const lines = ['graph LR'];
  const styles = [];

  for (const node of nodes) {
    const id = mermaidId(node.id);
    const shape = node.type === 'Section' ? `(("${node.label}"))` : `["${node.label}"]`;
    lines.push(`  ${id}${shape}`);

    // Style by type
    const fill = node.type === 'Section' ? DS_HEX.blue : DS_HEX.green;
    styles.push(`  style ${id} fill:${fill},color:${DS_HEX.cream},stroke:${DS_HEX.cream}`);
  }

  if (edges) {
    for (const edge of edges) {
      const fromId = mermaidId(edge.from);
      const toId = mermaidId(edge.to);
      lines.push(`  ${fromId} -->|${edge.type}| ${toId}`);
    }
  }

  lines.push('');
  lines.push(...styles);

  return lines.join('\n');
}

/**
 * Generate Mermaid graph TD syntax for methodology chain.
 * @param {Array<{name: string, framework: string, status: string}>} steps
 * @returns {string} Valid Mermaid syntax
 */
function generateMermaidChain(steps) {
  if (!steps || steps.length === 0) return 'graph TD\n  empty[No chain data]';

  const lines = ['graph TD'];
  const styles = [];
  const statusColors = {
    complete: DS_HEX.green,
    running: DS_HEX.yellow,
    pending: DS_HEX.muted,
    failed: DS_HEX.red
  };

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const id = mermaidId(step.name || `step_${i}`);
    const fw = step.framework ? ` [${step.framework}]` : '';
    const label = `${step.name}${fw}`;
    lines.push(`  ${id}["${label}"]`);

    const fill = statusColors[(step.status || 'pending').toLowerCase()] || DS_HEX.muted;
    styles.push(`  style ${id} fill:${fill},color:${DS_HEX.cream},stroke:${DS_HEX.cream}`);

    // Chain arrows
    if (i > 0) {
      const prevId = mermaidId(steps[i - 1].name || `step_${i - 1}`);
      lines.push(`  ${prevId} --> ${id}`);
    }
  }

  lines.push('');
  lines.push(...styles);

  return lines.join('\n');
}

/**
 * Wrap Mermaid syntax in a complete HTML document with De Stijl dark theme.
 * @param {string} mermaidSyntax - Valid Mermaid diagram code
 * @param {string} title - Title for the page header
 * @returns {string} Complete HTML document string
 */
function wrapMermaidHtml(mermaidSyntax, title) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || 'MindrianOS Diagram'}</title>
  <style>
    body {
      background: ${DS_HEX.bg};
      color: ${DS_HEX.cream};
      font-family: 'IBM Plex Mono', 'Fira Code', monospace;
      margin: 0;
      padding: 2rem;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    h1 {
      font-size: 1.4rem;
      font-weight: 400;
      letter-spacing: 0.08em;
      margin-bottom: 2rem;
      color: ${DS_HEX.cream};
    }
    h1::before {
      content: '\\2B21 ';
      color: ${DS_HEX.blue};
    }
    .mermaid {
      max-width: 100%;
      overflow: auto;
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: 'dark',
      themeVariables: {
        primaryColor: '${DS_HEX.blue}',
        primaryTextColor: '${DS_HEX.cream}',
        primaryBorderColor: '${DS_HEX.cream}',
        lineColor: '${DS_HEX.muted}',
        secondaryColor: '${DS_HEX.green}',
        tertiaryColor: '${DS_HEX.amethyst}',
        background: '${DS_HEX.bg}',
        mainBkg: '${DS_HEX.bg}',
        nodeBorder: '${DS_HEX.cream}',
        clusterBkg: '#1a1a1a',
        titleColor: '${DS_HEX.cream}',
        edgeLabelBackground: '${DS_HEX.bg}'
      }
    });
  </script>
</head>
<body>
  <h1>${title || 'MindrianOS Diagram'}</h1>
  <pre class="mermaid">
${mermaidSyntax}
  </pre>
</body>
</html>`;
}

/**
 * Wrap Mermaid syntax in a markdown fenced code block for embedding in .md files.
 * @param {string} mermaidSyntax - Valid Mermaid diagram code
 * @returns {string} Markdown fenced code block
 */
function generateMermaidBlock(mermaidSyntax) {
  return '```mermaid\n' + mermaidSyntax + '\n```';
}

// ═══════════════════════════════════════════════════════════════
// UNICODE DIAGRAM & CHART FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Render a Unicode box diagram of room sections in a 2-column grid.
 * Each section shows as a box with health indicator, artifact count, stage, and edges.
 *
 * @param {Array<{name: string, entryCount: number, stage?: string, edges?: Array<{to: string, type: string}>}>} sections
 * @param {Object} [opts] - options
 * @param {boolean} [opts.useColor=false] - use ANSI colors (disable for markdown safety)
 * @param {number} [opts.width=80] - total terminal width
 * @returns {string} multi-line Unicode box diagram
 */
function renderRoomDiagram(sections, opts) {
  if (!sections || sections.length === 0) return '';
  const useColor = (opts && opts.useColor) || false;
  const totalWidth = (opts && opts.width) || 80;
  const gap = 2;
  const boxWidth = Math.floor((totalWidth - gap) / 2);
  const innerWidth = boxWidth - 4; // account for "│ " and " │"

  const c = useColor ? ANSI : { red: '', blue: '', yellow: '', green: '', sienna: '', cream: '', muted: '', reset: '', bold: '', dim: '' };
  const ecols = useColor ? EDGE_COLORS : { INFORMS: '', CONTRADICTS: '', CONVERGES: '', ENABLES: '', INVALIDATES: '' };

  function pad(str, len) {
    const plain = str.replace(/\x1b\[[0-9;]*m/g, '');
    const diff = len - plain.length;
    if (diff > 0) return str + ' '.repeat(diff);
    return str;
  }

  function makeBox(section) {
    const name = section.name || 'unnamed';
    const count = section.entryCount || 0;
    const stage = section.stage || '';
    const edges = section.edges || [];

    // Top border: ┌─name─────┐
    const dashCount = innerWidth - name.length - 1;
    const topDashes = dashCount > 0 ? SYMBOLS.box.h.repeat(dashCount) : '';
    const top = SYMBOLS.box.tl + SYMBOLS.box.h + name + topDashes + SYMBOLS.box.h + SYMBOLS.box.tr;

    // Line 1: health + artifact count
    const healthSym = count > 0 ? SYMBOLS.health.populated : SYMBOLS.health.empty;
    let line1Content;
    if (count === 0) {
      const gapText = useColor ? (c.red + 'EMPTY \u2014 GAP' + c.reset) : 'EMPTY \u2014 GAP';
      line1Content = healthSym + ' ' + gapText;
    } else {
      const label = count === 1 ? 'artifact' : 'artifacts';
      line1Content = healthSym + ' ' + count + ' ' + label;
    }
    const line1 = SYMBOLS.box.v + ' ' + pad(line1Content, innerWidth) + ' ' + SYMBOLS.box.v;

    // Line 2: stage or edge summary
    let line2Content = '';
    if (edges.length > 0) {
      const edgeInfo = edges[0];
      const sym = SYMBOLS.edges[edgeInfo.type] || '?';
      const ecolor = ecols[edgeInfo.type] || '';
      const ereset = ecolor ? c.reset : '';
      if (edges.length > 1) {
        line2Content = ecolor + sym + ereset + ' ' + edges.length + ' cross-references';
      } else {
        line2Content = ecolor + sym + ereset + ' 1 ' + (edgeInfo.type || 'edge').toLowerCase();
      }
    } else if (stage) {
      const stageSym = stageSymbol(stage);
      const stageLabel = stage.charAt(0).toUpperCase() + stage.slice(1).replace(/-/g, ' ');
      line2Content = stageSym + ' ' + stageLabel;
    }
    const line2 = SYMBOLS.box.v + ' ' + pad(line2Content, innerWidth) + ' ' + SYMBOLS.box.v;

    // Bottom border
    const bottom = SYMBOLS.box.bl + SYMBOLS.box.h.repeat(innerWidth + 2) + SYMBOLS.box.br;

    return { top, line1, line2, bottom, edges };
  }

  const boxes = sections.map(makeBox);
  const lines = [];
  const spacer = ' '.repeat(gap);

  for (let i = 0; i < boxes.length; i += 2) {
    const left = boxes[i];
    const right = boxes[i + 1];

    if (right) {
      const hasEdgeToRight = left.edges && left.edges.some(function(e) {
        const rightName = sections[i + 1] && sections[i + 1].name;
        return e.to === rightName;
      });
      const connector = hasEdgeToRight ? '\u2192' : spacer.charAt(0);
      const connGap = spacer.length > 1 ? spacer.substring(1) : '';

      lines.push(left.top + spacer + right.top);
      lines.push(left.line1 + connector + connGap + right.line1);
      lines.push(left.line2 + spacer + right.line2);
      lines.push(left.bottom + spacer + right.bottom);
    } else {
      lines.push(left.top);
      lines.push(left.line1);
      lines.push(left.line2);
      lines.push(left.bottom);
    }

    // Show edge labels between row pairs
    if (i + 2 < boxes.length) {
      const leftEdges = (sections[i].edges || []).filter(function(e) {
        return sections.findIndex(function(s) { return s.name === e.to; }) >= i + 2;
      });
      const rightIdx = i + 1;
      const rightEdges = (sections[rightIdx] ? sections[rightIdx].edges || [] : []).filter(function(e) {
        return sections.findIndex(function(s) { return s.name === e.to; }) >= i + 2;
      });

      const leftLabel = leftEdges.length > 0
        ? '     \u2193 ' + leftEdges[0].type
        : '';
      const rightLabel = rightEdges.length > 0
        ? '     \u2193 ' + rightEdges[0].type
        : '';

      if (leftLabel || rightLabel) {
        const leftPadded = pad(leftLabel, boxWidth);
        lines.push(leftPadded + spacer + rightLabel);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Render an ASCII sparkline chart using asciichart (falls back to simple bars).
 * @param {number[]} values - array of numeric values
 * @param {Object} [opts] - options
 * @param {number} [opts.height=4] - chart height in lines
 * @param {string} [opts.label] - chart label
 * @returns {string} ASCII chart string
 */
function renderSparkline(values, opts) {
  if (!values || values.length === 0) return '';
  const height = (opts && opts.height) || 4;
  const label = (opts && opts.label) || '';

  var chart;
  try {
    var asciichart = require('asciichart');
    chart = asciichart.plot(values, { height: height });
  } catch (_e) {
    // Fallback: simple bar representation
    var max = Math.max.apply(null, values.concat([1]));
    var barWidth = 10;
    chart = values.map(function(v) {
      var filled = Math.round((v / max) * barWidth);
      var empty = barWidth - filled;
      var pct = Math.round((v / max) * 100);
      return '\u2588'.repeat(filled) + '\u2591'.repeat(empty) + ' ' + pct + '%';
    }).join('\n');
  }

  if (label) {
    return label + '\n' + chart;
  }
  return chart;
}

/**
 * Render a Unicode block progress bar.
 * @param {number} value - current value
 * @param {number} max - maximum value
 * @param {number} [width=10] - bar width in characters
 * @returns {string} progress bar like "████████░░ 80%"
 */
function renderProgressBar(value, max, width) {
  width = width || 10;
  max = max || 1;
  var ratio = Math.min(value / max, 1);
  var filled = Math.round(ratio * width);
  var empty = width - filled;
  var pct = Math.round(ratio * 100);
  return '\u2588'.repeat(filled) + '\u2591'.repeat(empty) + ' ' + pct + '%';
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
  SYMBOLS,
  ANSI,
  ANSI_BASIC,
  EDGE_COLORS,
  DS_HEX,
  stageSymbol,
  edgeSymbol,
  healthSymbol,
  colorize,
  formatEdge,
  formatSectionHeader,
  renderRoomDiagram,
  renderSparkline,
  renderProgressBar,
  generateMermaidRoom,
  generateMermaidGraph,
  generateMermaidChain,
  wrapMermaidHtml,
  generateMermaidBlock
};
