'use strict';
/*
 * Phase 130-02 -- comparison-matrix synthesizer.
 *
 * The Body Shape D table generator. synthesizeComparisonMatrix(findingNodes)
 * takes an array of TYPED lens-finding node objects (the 130-CONTEXT pre-resolved
 * decision: synthesizers receive typed node IDs + parsed properties, NOT raw
 * per-lens output arrays) and returns a table structure where:
 *   rows    = the lenses (one row per lens-finding node)
 *   columns = the comparison dimensions (topic / stance / summary)
 *
 * The De Stijl Body Shape D table conventions are mirrored from visual-ops.cjs
 * (Canon Part 7 reuse): a columns[] header list and rows[] where each row carries
 * a lens label + a cell per column. The renderer (a separate surface) turns this
 * neutral structure into a De Stijl table; this synthesizer is PURE structure.
 *
 * PURE: no db handle, no fs, no require of room-db / sqlite. Defensive: empty
 * input -> { columns: [], rows: [] }; never throws.
 *
 * Canon Part 8: pure over typed node objects; never reads raw user content from
 *   disk or db.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE). Uses hyphens.
 */

// The comparison dimensions (columns) for the cognitive family. Each is a scalar
// projection over a lens-finding node. Extensible: a future family can pass its
// own dimension list, but the cognitive default is topic / stance / summary.
const DEFAULT_DIMENSIONS = Object.freeze(['topic', 'stance', 'summary']);

// Stance inference: a coarse scalar classification of a finding's posture from
// its lens label. Pure lookup; no NLP.
const LENS_STANCE = Object.freeze({
  'white-hat': 'facts',
  'red-hat': 'intuition',
  'black-hat': 'caution',
  'yellow-hat': 'benefits',
  'green-hat': 'creativity',
  'blue-hat': 'process',
});

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function cellFor(node, dimension) {
  if (dimension === 'topic') {
    return typeof node.topic === 'string' ? node.topic : '';
  }
  if (dimension === 'stance') {
    const lens = typeof node.lens === 'string' ? node.lens : '';
    return LENS_STANCE[lens] || 'unknown';
  }
  if (dimension === 'summary') {
    return typeof node.summary === 'string' ? node.summary : '';
  }
  // Generic projection for a caller-supplied dimension key.
  const v = node[dimension];
  return typeof v === 'string' ? v : '';
}

function synthesizeComparisonMatrix(findingNodes, opts) {
  const nodes = Array.isArray(findingNodes) ? findingNodes.filter(isPlainObject) : [];
  if (nodes.length === 0) {
    return { columns: [], rows: [] };
  }
  const options = isPlainObject(opts) ? opts : {};
  const columns = Array.isArray(options.dimensions) && options.dimensions.length > 0
    ? options.dimensions.slice()
    : DEFAULT_DIMENSIONS.slice();
  const rows = nodes.map((node) => {
    const lens = typeof node.lens === 'string' ? node.lens : '';
    return {
      lens: lens,
      finding_id: typeof node.id === 'string' ? node.id : '',
      cells: columns.map((dim) => cellFor(node, dim)),
    };
  });
  return { columns, rows };
}

module.exports = { synthesizeComparisonMatrix, DEFAULT_DIMENSIONS, LENS_STANCE };
