'use strict';
/*
 * Phase 131-03 -- source-comparison synthesizer.
 *
 * The source-family synthesis strategy the source-lens driver
 * (lib/lens-engine/source-lens-driver.cjs) passes to lens-engine.rotate(). It
 * mirrors the Phase 130-02 comparison-matrix idiom (Canon Part 7 reuse): a PURE
 * function over an array of TYPED lens-finding node objects that returns a
 * neutral structure (one row per lens / source) the renderer later turns into a
 * De Stijl table. It does NOT rank, dedup, or cap -- that is the driver's job
 * AFTER rotation. This strategy only projects each source-lens finding to a
 * comparison row (lens / source / finding count / a one-line lead).
 *
 * The columns are the source-family comparison dimensions: source, count, lead.
 *   source = the lens label (scholarly / industry / patent / brain / ...).
 *   count  = how many raw items the lens returned (from the finding payload).
 *   lead   = the lens finding's one-line summary (the strongest lead).
 *
 * PURE: no db handle, no fs, no require of room-db / sqlite / navigation, no
 * fetch. Defensive: empty input -> { columns: [...], rows: [] }; never throws.
 *
 * Canon Part 8: pure over typed node objects produced INSIDE the rotation; never
 *   reads raw user content from disk or db, never egresses.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE). Uses hyphens.
 */

const SOURCE_DIMENSIONS = Object.freeze(['source', 'count', 'lead']);

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// The per-lens item count lives on the typed finding node's raw payload (the
// driver's perLensFn attaches it as raw.item_count). Defensive scalar read.
function itemCount(node) {
  const raw = isPlainObject(node.raw) ? node.raw : {};
  const n = raw.item_count;
  return (typeof n === 'number' && Number.isFinite(n) && n >= 0) ? Math.floor(n) : 0;
}

function synthesizeSourceComparison(findingNodes) {
  const nodes = Array.isArray(findingNodes) ? findingNodes.filter(isPlainObject) : [];
  const rows = nodes.map((node) => {
    const lens = typeof node.lens === 'string' ? node.lens : '';
    const summary = typeof node.summary === 'string' ? node.summary : '';
    return {
      source: lens,
      finding_id: typeof node.id === 'string' ? node.id : '',
      cells: [lens, itemCount(node), summary],
    };
  });
  return { columns: SOURCE_DIMENSIONS.slice(), rows };
}

module.exports = { synthesizeSourceComparison, SOURCE_DIMENSIONS };
