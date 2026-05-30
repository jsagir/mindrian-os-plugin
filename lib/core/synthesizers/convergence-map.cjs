'use strict';
/*
 * Phase 130-02 -- convergence-map synthesizer.
 *
 * The third synthesis pattern. synthesizeConvergenceMap(findingNodes) takes an
 * array of TYPED lens-finding node objects (the 130-CONTEXT pre-resolved
 * decision: synthesizers receive typed node IDs + parsed properties, NOT raw
 * per-lens output arrays) and returns clusters of THEMES that appear across 3+
 * lenses -- the convergence signal that the same idea surfaced independently
 * from multiple cognitive stances.
 *
 * Returns { clusters: [ { theme, lenses: [..], findings: [..], strength } ] }
 * where each cluster carries a theme token (a salient shared word/phrase), the
 * lenses it spans (>= 3), the contributing finding ids, and a strength scalar
 * (the lens count). PURE: no db handle, no fs, no require of room-db / sqlite.
 * Defensive: empty input -> { clusters: [] }; never throws.
 *
 * This mirrors CLAUDE.md decision 9 ("CONVERGES -- this artifact's themes appear
 * in 3+ other sections") at the lens-rotation layer: a theme is a convergence
 * when 3+ lenses independently raise it.
 *
 * Canon Part 8: pure over typed node objects; never reads raw user content from
 *   disk or db.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE). Uses hyphens.
 */

// The minimum number of distinct lenses a theme must span to count as a
// convergence cluster (Canon decision 9: "themes appear in 3+").
const CONVERGENCE_FLOOR = 3;

// Stopwords excluded from theme tokenization (scalar, generic; no NLP library).
const STOPWORDS = Object.freeze(new Set([
  'a', 'an', 'the', 'is', 'are', 'be', 'to', 'of', 'and', 'or', 'for', 'in',
  'on', 'at', 'as', 'it', 'this', 'that', 'these', 'those', 'with', 'by', 'from',
  'could', 'would', 'should', 'can', 'will', 'may', 'might', 'has', 'have', 'had',
  'we', 'they', 'their', 'our', 'its', 'but', 'not', 'so', 'than', 'then', 'each',
]));

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// Tokenize a summary into lowercased significant words + bigrams. Bigrams catch
// multi-word themes ("premium tier") that single tokens would miss.
function tokensOf(summary) {
  if (typeof summary !== 'string' || summary.length === 0) return [];
  const words = summary
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  const tokens = new Set(words);
  for (let i = 0; i < words.length - 1; i++) {
    tokens.add(words[i] + ' ' + words[i + 1]);
  }
  return Array.from(tokens);
}

function synthesizeConvergenceMap(findingNodes) {
  const nodes = Array.isArray(findingNodes) ? findingNodes.filter(isPlainObject) : [];
  if (nodes.length === 0) {
    return { clusters: [] };
  }
  // theme -> { lenses: Set, findings: Set }
  const byTheme = new Map();
  for (const node of nodes) {
    const lens = typeof node.lens === 'string' ? node.lens : '';
    const id = typeof node.id === 'string' ? node.id : '';
    if (!lens) continue;
    const seen = new Set(tokensOf(node.summary));
    for (const theme of seen) {
      if (!byTheme.has(theme)) {
        byTheme.set(theme, { lenses: new Set(), findings: new Set() });
      }
      const entry = byTheme.get(theme);
      entry.lenses.add(lens);
      if (id) entry.findings.add(id);
    }
  }
  const clusters = [];
  for (const [theme, entry] of byTheme) {
    if (entry.lenses.size >= CONVERGENCE_FLOOR) {
      clusters.push({
        theme: theme,
        lenses: Array.from(entry.lenses),
        findings: Array.from(entry.findings),
        strength: entry.lenses.size,
      });
    }
  }
  // Strongest convergence first; stable tie-break by theme for determinism.
  clusters.sort((x, y) => (y.strength - x.strength) || (x.theme < y.theme ? -1 : x.theme > y.theme ? 1 : 0));
  // Prefer the longer (bigram) theme when a single token is a strict subset of a
  // bigram cluster with the same lens span (drops noisy single-word duplicates).
  const filtered = clusters.filter((c, idx) => {
    if (c.theme.indexOf(' ') !== -1) return true;
    return !clusters.some((other, oIdx) =>
      oIdx !== idx
      && other.theme.indexOf(' ') !== -1
      && other.theme.indexOf(c.theme) !== -1
      && other.strength >= c.strength);
  });
  return { clusters: filtered };
}

module.exports = { synthesizeConvergenceMap, CONVERGENCE_FLOOR };
