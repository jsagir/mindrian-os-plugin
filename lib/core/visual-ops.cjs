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
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
  SYMBOLS,
  ANSI,
  ANSI_BASIC,
  EDGE_COLORS,
  stageSymbol,
  edgeSymbol,
  healthSymbol,
  colorize,
  formatEdge,
  formatSectionHeader
};
