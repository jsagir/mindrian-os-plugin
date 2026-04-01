/**
 * MindrianOS Plugin -- Constellation Graph Configuration
 * De Stijl color map, line styles, and Cytoscape stylesheet generator
 * for the 12-Thread Constellation view (VIEW-06).
 *
 * Exports: THREAD_COLORS, THREAD_STYLES, spectralColorScale,
 *          generateCytoscapeStylesheet, EDGE_TYPE_LABELS
 */

'use strict';

// --- De Stijl Thread Color Map (FABRIC-02) ---

const THREAD_COLORS = {
  INFORMS:                   '#2563EB',  // blue
  CONTRADICTS:               '#DC2626',  // red
  CONVERGES:                 '#D97706',  // amber/yellow
  ENABLES:                   '#16A34A',  // green
  INVALIDATES:               '#6B7280',  // gray
  BELONGS_TO:                '#9CA3AF',  // light gray, subtle
  REASONING_INFORMS:         '#7C3AED',  // purple
  HSI_CONNECTION:            '#F59E0B',  // gold, animated
  REVERSE_SALIENT:           '#EF4444',  // bright red, pulsing
  ANALOGOUS_TO:              '#06B6D4',  // cyan, dashed
  STRUCTURALLY_ISOMORPHIC:   '#8B5CF6',  // violet
  RESOLVES_VIA:              '#10B981',  // emerald, dotted
};

// --- Thread Line Styles ---

const THREAD_STYLES = {
  INFORMS:                   { lineStyle: 'solid',  width: 2,   arrow: true,  animated: false },
  CONTRADICTS:               { lineStyle: 'solid',  width: 3,   arrow: false, animated: false },
  CONVERGES:                 { lineStyle: 'solid',  width: 2.5, arrow: false, animated: false },
  ENABLES:                   { lineStyle: 'solid',  width: 2,   arrow: true,  animated: false },
  INVALIDATES:               { lineStyle: 'solid',  width: 2,   arrow: true,  animated: false },
  BELONGS_TO:                { lineStyle: 'solid',  width: 1,   arrow: false, animated: false },
  REASONING_INFORMS:         { lineStyle: 'solid',  width: 2,   arrow: true,  animated: false },
  HSI_CONNECTION:            { lineStyle: 'solid',  width: 2.5, arrow: false, animated: true  },
  REVERSE_SALIENT:           { lineStyle: 'solid',  width: 3,   arrow: false, animated: true  },
  ANALOGOUS_TO:              { lineStyle: 'dashed', width: 2,   arrow: false, animated: false },
  STRUCTURALLY_ISOMORPHIC:   { lineStyle: 'dashed', width: 2,   arrow: false, animated: false },
  RESOLVES_VIA:              { lineStyle: 'dotted', width: 2,   arrow: true,  animated: false },
};

// --- Human-Readable Thread Labels ---

const EDGE_TYPE_LABELS = {
  INFORMS:                   'Informs',
  CONTRADICTS:               'Contradicts',
  CONVERGES:                 'Converges',
  ENABLES:                   'Enables',
  INVALIDATES:               'Invalidates',
  BELONGS_TO:                'Belongs To',
  REASONING_INFORMS:         'Reasoning Informs',
  HSI_CONNECTION:            'Surprise',
  REVERSE_SALIENT:           'Bottleneck',
  ANALOGOUS_TO:              'Analogy Bridge',
  STRUCTURALLY_ISOMORPHIC:   'Structural Isomorphism',
  RESOLVES_VIA:              'Resolves Via',
};

// --- Spectral Color Scale (FABRIC-03) ---

/**
 * Map a spectral_gap value (0-1) to a color intensity.
 * Low spectral_gap = muted gray-blue, high = vivid gold-red.
 * Returns a hex color string.
 *
 * @param {number} spectralGap - Value between 0 and 1
 * @returns {string} Hex color
 */
function spectralColorScale(spectralGap) {
  const t = Math.max(0, Math.min(1, spectralGap || 0));

  // Interpolate from cool muted (#4A5568) to vivid warm (#F59E0B)
  const r0 = 0x4A, g0 = 0x55, b0 = 0x68;
  const r1 = 0xF5, g1 = 0x9E, b1 = 0x0B;

  const r = Math.round(r0 + (r1 - r0) * t);
  const g = Math.round(g0 + (g1 - g0) * t);
  const b = Math.round(b0 + (b1 - b0) * t);

  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// --- Cytoscape Stylesheet Generator (VIEW-06) ---

/**
 * Generate a complete Cytoscape.js stylesheet array for the Constellation view.
 * Includes node styles (section-group, artifact), edge styles per Thread type,
 * spectral coloring, and special effects for Surprises and Bottlenecks.
 *
 * @returns {Array<object>} Cytoscape stylesheet array
 */
function generateCytoscapeStylesheet() {
  const styles = [];

  // -- Base node style --
  styles.push({
    selector: 'node',
    style: {
      'label':              'data(label)',
      'text-valign':        'bottom',
      'text-halign':        'center',
      'font-family':        'DM Sans, Inter, sans-serif',
      'font-size':          '11px',
      'color':              '#EEF0F4',
      'text-margin-y':      8,
      'background-color':   'data(color)',
      'border-width':       1,
      'border-color':       '#2A2A2A',
      'width':              'mapData(degree, 0, 20, 24, 56)',
      'height':             'mapData(degree, 0, 20, 24, 56)',
      'text-max-width':     '100px',
      'text-wrap':          'ellipsis',
      'text-background-color': '#0D0D0D',
      'text-background-opacity': 0.7,
      'text-background-padding': '2px',
      'overlay-opacity':    0,
      'transition-property': 'background-color, width, height, border-width',
      'transition-duration': '0.2s',
    },
  });

  // -- Section-group nodes --
  styles.push({
    selector: 'node.section-group',
    style: {
      'width':              48,
      'height':             48,
      'font-size':          '13px',
      'font-weight':        '700',
      'border-width':       3,
      'border-color':       'data(color)',
      'background-opacity': 0.85,
      'text-margin-y':      12,
      'shape':              'round-rectangle',
    },
  });

  // -- Artifact nodes --
  styles.push({
    selector: 'node.artifact',
    style: {
      'shape':              'ellipse',
      'background-opacity': 0.7,
    },
  });

  // -- Meeting nodes --
  styles.push({
    selector: 'node.meeting',
    style: {
      'shape':              'diamond',
      'background-opacity': 0.75,
      'width':              28,
      'height':             28,
    },
  });

  // -- Hovered/selected node --
  styles.push({
    selector: 'node:selected',
    style: {
      'border-width':       4,
      'border-color':       '#FFFFFF',
      'background-opacity': 1,
      'font-size':          '13px',
      'z-index':            999,
    },
  });

  // -- Dimmed state (when something is selected, others dim) --
  styles.push({
    selector: 'node.dimmed',
    style: {
      'opacity':            0.15,
    },
  });

  styles.push({
    selector: 'edge.dimmed',
    style: {
      'opacity':            0.05,
    },
  });

  // -- Base edge style --
  styles.push({
    selector: 'edge',
    style: {
      'width':              1.5,
      'line-color':         '#555',
      'target-arrow-color': '#555',
      'curve-style':        'bezier',
      'opacity':            0.5,
      'overlay-opacity':    0,
      'transition-property': 'opacity, width, line-color',
      'transition-duration': '0.2s',
    },
  });

  // -- Per-Thread-type edge styles --
  const edgeTypes = Object.keys(THREAD_COLORS);
  for (const type of edgeTypes) {
    const color = THREAD_COLORS[type];
    const ts = THREAD_STYLES[type];

    const edgeStyle = {
      'line-color':         color,
      'target-arrow-color': color,
      'width':              ts.width,
      'opacity':            type === 'BELONGS_TO' ? 0.2 : 0.6,
    };

    if (ts.lineStyle === 'dashed') {
      edgeStyle['line-style'] = 'dashed';
      edgeStyle['line-dash-pattern'] = [8, 4];
    } else if (ts.lineStyle === 'dotted') {
      edgeStyle['line-style'] = 'dashed';
      edgeStyle['line-dash-pattern'] = [3, 4];
    }

    if (ts.arrow) {
      edgeStyle['target-arrow-shape'] = 'triangle';
    } else {
      edgeStyle['target-arrow-shape'] = 'none';
    }

    // CSS class selector: edge type as lowercase-hyphen class
    const cssClass = type.toLowerCase().replace(/_/g, '-');
    styles.push({
      selector: `edge.${cssClass}`,
      style: edgeStyle,
    });
  }

  // -- HSI_CONNECTION (Surprise) edge highlight (FABRIC-04) --
  styles.push({
    selector: 'edge.hsi-connection.high-breakthrough',
    style: {
      'width':              4,
      'opacity':            0.9,
      'line-color':         '#F59E0B',
    },
  });

  // -- REVERSE_SALIENT (Bottleneck) edge highlight (FABRIC-05) --
  styles.push({
    selector: 'edge.reverse-salient',
    style: {
      'width':              3.5,
      'opacity':            0.85,
      'line-color':         '#EF4444',
    },
  });

  // -- ANALOGOUS_TO cross-domain bridge (FABRIC-06) --
  styles.push({
    selector: 'edge.analogous-to',
    style: {
      'line-style':         'dashed',
      'line-dash-pattern':  [10, 5],
      'width':              2.5,
      'opacity':            0.7,
      'line-color':         '#06B6D4',
    },
  });

  // -- Selected edge --
  styles.push({
    selector: 'edge:selected',
    style: {
      'width':              4,
      'opacity':            1,
      'z-index':            999,
    },
  });

  // -- Highlighted connected edges --
  styles.push({
    selector: 'edge.highlighted',
    style: {
      'opacity':            0.9,
      'width':              3,
    },
  });

  return styles;
}

module.exports = {
  THREAD_COLORS,
  THREAD_STYLES,
  EDGE_TYPE_LABELS,
  spectralColorScale,
  generateCytoscapeStylesheet,
};
