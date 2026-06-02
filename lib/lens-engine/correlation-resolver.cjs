'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 131-04 -- correlation-resolver.cjs
 * ========================================
 * The CONSUMER-SIDE teaching-graph target resolver. It maps a single
 * teaching-graph target NAME (a framework / concept the Stage 7 wirer is about
 * to cascade an edge to) to ONE canonical correlation_id, so a cascade edge to a
 * teaching-graph target does NOT fork across cross-label duplicates (the
 * directive-3 / curation-audit no-fork concern, Canon Part 4).
 *
 * THIS IS THE RESOLVER. Phase 130.7 ships ONLY two REAL exports here:
 *   - lib/core/correlation.cjs            :: computeCorrelationId(name, label)
 *       (a pure, embedding-INDEPENDENT 2-arg hash; the LOCKED contract of record)
 *   - lib/core/correlation-label-index.cjs :: parseLabelIndex(sectionBody)
 *       (a pure parse of the correlation_labels index body into
 *        { name -> [ {primary_label, edge_degree}, ... ] })
 * There is NO tuple-returning resolver export on the correlation module in 130.7
 * (no such dotted helper exists). This module COMPOSES those two REAL exports
 * into resolveCorrelation. The wirer (lib/core/findings-wirer.cjs) defaults its
 * _resolveCorrelation seam to this module's resolveCorrelation; it NEVER
 * references a phantom dotted resolver on the correlation module.
 *
 * No-fork canonical pick (REUSED heuristic, Canon Part 7):
 * =======================================================
 * It reuses the SAME pick heuristic lib/brain/chain-recommender.cjs
 * recommendCanonicalTargets applies for a list of names, here for a SINGLE name:
 * among the index entries for that name, prefer the methodology label (Framework
 * over Concept / Tool / Book / DictionaryTerm / Product / Person), tie-break by
 * most-edged (highest edge_degree). A name ABSENT from the index defaults its
 * primary_label to 'Framework' (the methodology label) and treats the name as
 * its own canonical -- so the resolver is total and never forks to a raw name.
 *
 * Canon Part 8 (Graph Boundary): PURE over its inputs. No fs, no db, no Brain,
 * no network. The correlation_labels body is a LOCAL artifact (generic
 * methodology handles + label enums + integer degrees; zero user content). It
 * NEVER egresses toward the Brain. Never throws: every degraded path returns the
 * Framework-default tuple.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 *
 * License: BSL 1.1.
 */

const correlation = require('../core/correlation.cjs');               // computeCorrelationId (REAL 130.7 export)
const labelIndex = require('../core/correlation-label-index.cjs');    // parseLabelIndex (REAL 130.7 export)

// The default methodology label for a name absent from the index. Matches
// lib/brain/chain-recommender.cjs DEFAULT_PRIMARY_LABEL so the resolver and the
// recommender agree by construction (Canon Part 7 reuse: one heuristic).
const DEFAULT_PRIMARY_LABEL = 'Framework';

// Methodology-label preference order for the no-fork canonical pick (verbatim
// from chain-recommender.cjs LABEL_PREFERENCE per the 2026-05-17
// brain-curation-audit section 13 heuristic). Prefer Framework, then Concept,
// Tool, Book, DictionaryTerm, Product, Person; tie-break most-edged. A label NOT
// in this list falls to a stable lowest priority so a known methodology label
// always wins when present.
const LABEL_PREFERENCE = Object.freeze([
  'Framework',
  'Concept',
  'Tool',
  'Book',
  'DictionaryTerm',
  'Product',
  'Person',
]);

function labelRank(label) {
  const i = LABEL_PREFERENCE.indexOf(label);
  return i === -1 ? LABEL_PREFERENCE.length : i;
}

// Pick the ONE canonical {primary_label, edge_degree} for a name from its index
// entries: lowest labelRank (methodology-preferred), tie-break highest
// edge_degree. Absent / empty entries -> the Framework default with degree 0.
function pickCanonicalLabel(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { primary_label: DEFAULT_PRIMARY_LABEL, edge_degree: 0 };
  }
  let best = null;
  for (const e of entries) {
    if (!e || typeof e.primary_label !== 'string' || e.primary_label.length === 0) continue;
    const cand = {
      primary_label: e.primary_label,
      edge_degree: Number.isFinite(Number(e.edge_degree)) ? Number(e.edge_degree) : 0,
    };
    if (best === null) { best = cand; continue; }
    const rankCand = labelRank(cand.primary_label);
    const rankBest = labelRank(best.primary_label);
    if (rankCand < rankBest) { best = cand; continue; }
    if (rankCand === rankBest && cand.edge_degree > best.edge_degree) { best = cand; }
  }
  return best || { primary_label: DEFAULT_PRIMARY_LABEL, edge_degree: 0 };
}

/**
 * resolveCorrelation(targetName, opts) -> { correlation_id, canonical_name, primary_label }
 *
 * Resolve a single teaching-graph target NAME to its ONE canonical correlation_id
 * by composing 130.7's REAL exports:
 *   1. parse opts.correlationLabelsSection via parseLabelIndex;
 *   2. look up targetName;
 *   3. if present (possibly under multiple labels), apply the no-fork pick
 *      (Framework-preferred, most-edged) to choose ONE {canonical_name, primary_label};
 *   4. if absent from the index, default primary_label to 'Framework' and use
 *      targetName as canonical_name;
 *   5. return { correlation_id: computeCorrelationId(canonical_name, primary_label),
 *               canonical_name, primary_label }.
 *
 * opts.correlationLabelsSection is the pre-loaded correlation_labels section body
 * (the wirer sources it from roomState.brainSections.correlation_labels). PURE:
 * no fs / no db / no Brain / no network. NEVER throws: a non-string name, a
 * missing section, or a parse failure all degrade to the Framework-default tuple.
 *
 * @param {string} targetName
 * @param {{ correlationLabelsSection?: string }} [opts]
 * @returns {{ correlation_id: string, canonical_name: string, primary_label: string }}
 */
function resolveCorrelation(targetName, opts) {
  const name = (typeof targetName === 'string' && targetName.trim().length > 0)
    ? targetName.trim()
    : '';
  const o = (opts && typeof opts === 'object') ? opts : {};

  // The Framework-default tuple is the floor for every degraded path.
  function frameworkDefault(canonicalName) {
    const cn = (typeof canonicalName === 'string' && canonicalName.length > 0) ? canonicalName : 'unnamed';
    return {
      correlation_id: correlation.computeCorrelationId(cn, DEFAULT_PRIMARY_LABEL),
      canonical_name: cn,
      primary_label: DEFAULT_PRIMARY_LABEL,
    };
  }

  if (name.length === 0) {
    return frameworkDefault('unnamed');
  }

  let indexMap = {};
  try {
    const body = (typeof o.correlationLabelsSection === 'string') ? o.correlationLabelsSection : '';
    indexMap = labelIndex.parseLabelIndex(body) || {};
  } catch (_e) {
    indexMap = {};
  }

  const entries = Object.prototype.hasOwnProperty.call(indexMap, name) ? indexMap[name] : null;
  if (!Array.isArray(entries) || entries.length === 0) {
    // Absent from the index: default to Framework, name is its own canonical.
    return frameworkDefault(name);
  }

  const picked = pickCanonicalLabel(entries);
  let id;
  try {
    id = correlation.computeCorrelationId(name, picked.primary_label);
  } catch (_e) {
    return frameworkDefault(name);
  }
  return {
    correlation_id: id,
    canonical_name: name,
    primary_label: picked.primary_label,
  };
}

module.exports = {
  resolveCorrelation: resolveCorrelation,
  DEFAULT_PRIMARY_LABEL: DEFAULT_PRIMARY_LABEL,
  LABEL_PREFERENCE: LABEL_PREFERENCE.slice(),
};
