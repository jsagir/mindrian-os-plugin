/**
 * MindrianOS Plugin -- Futures Wheel subsystem + ring render (Phase 156, Wave 3)
 *
 * FW-07 (D-03): the subsystem PESTEL impact map is the DEFAULT view; the
 * concentric ring view is on demand. Both are produced by composing the
 * ui-system De Stijl 4-zone renderer (lib/render/render-v2.cjs) -- the SAME
 * formatter every /mos: command uses (Canon Part 7 reuse; CLAUDE.md Dashboard
 * Export Integrity: NEVER hand-roll raw HTML tag string literals).
 *
 * The instructor's usable fallback (156-SPEC) is a flatter, domain-organized
 * version of the wheel: group the consequences by PESTEL subsystem rather than
 * by causal ring. This module renders BOTH organizings through the one De Stijl
 * formatter so the output works across CLI / Desktop / Cowork (Tri-Polar text
 * render, not web-only).
 *
 * Pure Node.js built-ins only (zero npm deps). NO em-dashes (hyphens only).
 */

'use strict';

const path = require('path');
const { render } = require('../../render/render-v2.cjs');
const { PESTEL_DOMAIN_ENUM } = require('./orchestrator.cjs');

// The command-footer line that offers BOTH views (FW-07: subsystem map is the
// default, ring view is on demand). Rendered through the De Stijl footer zone.
const VIEW_TOGGLE_FOOTER = 'Subsystem map (default). Ring view on demand.';

/**
 * Group a consequence list by a key function, preserving the supplied key
 * ordering. Returns a Map from key -> consequence[] for present keys only.
 * @param {Array<Object>} consequences
 * @param {function(Object):string} keyFn
 * @param {Array<string>} order - preferred key ordering
 * @returns {Map<string, Array<Object>>}
 */
function groupBy(consequences, keyFn, order) {
  const list = Array.isArray(consequences) ? consequences : [];
  const buckets = new Map();
  for (const c of list) {
    if (!c || typeof c !== 'object') continue;
    const k = keyFn(c);
    if (k === null || k === undefined || k === '') continue;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(c);
  }
  // Re-key into the preferred order so present groups render deterministically.
  const ordered = new Map();
  const seen = new Set();
  for (const k of (Array.isArray(order) ? order : [])) {
    if (buckets.has(k)) {
      ordered.set(k, buckets.get(k));
      seen.add(k);
    }
  }
  // Append any present keys not covered by the preferred order (defensive).
  for (const [k, v] of buckets) {
    if (!seen.has(k)) ordered.set(k, v);
  }
  return ordered;
}

/**
 * Render one group block as plain De Stijl-friendly text lines: a domain (or
 * ring) header line followed by one bullet per consequence. NO HTML.
 * @param {string} heading
 * @param {Array<Object>} items
 * @returns {string}
 */
function renderGroupBlock(heading, items) {
  const lines = [];
  lines.push('## ' + heading);
  for (const c of items) {
    const label = String((c && c.label) || '(unlabeled)');
    const horizon = c && c.horizon ? c.horizon : '?';
    const conf = (c && typeof c.confidence === 'number') ? c.confidence : '?';
    lines.push('- ' + label + ' [horizon: ' + horizon + ', confidence: ' + conf + ']');
  }
  return lines.join('\n');
}

/**
 * renderSubsystemMap(consequences) -- the FW-07 D-03 DEFAULT view.
 *
 * Groups the consequences by their PESTEL `domain` (Political / Economic /
 * Social / Technological / Environmental / Legal), one block per PRESENT
 * domain, and composes them through the ui-system De Stijl 4-zone renderer.
 * For a seed whose consequences span >= 2 domains the output carries a distinct
 * header per present domain (the subsystem impact map).
 *
 * @param {Array<Object>} consequences - consequence objects (carry `domain`)
 * @param {Object} [opts]
 * @param {string} [opts.seed] - seed label for the header zone
 * @returns {{ rendered: string, domains: string[], view: string }}
 */
function renderSubsystemMap(consequences, opts) {
  opts = opts || {};
  const groups = groupBy(consequences, (c) => c.domain, PESTEL_DOMAIN_ENUM);
  const domains = Array.from(groups.keys());

  const bodyBlocks = [];
  for (const [domain, items] of groups) {
    bodyBlocks.push(renderGroupBlock(domain, items));
  }

  const seedLabel = opts.seed ? String(opts.seed) : 'seed';
  const envelope = render({
    zones: {
      header: 'Futures Wheel subsystem impact map: ' + seedLabel,
      body: bodyBlocks.join('\n\n') || 'No consequences to map yet.',
      signals: ['PESTEL subsystem view groups consequences by domain (FW-07 default).'],
      footer: VIEW_TOGGLE_FOOTER,
    },
    // METHODOLOGY/JUST_TALK would suppress or strip zones; DECISION_GATE keeps
    // the full 4-zone compose so the domain headers always render.
    operator: 'DECISION_GATE',
    tier: 1,
  });

  return { rendered: envelope.rendered, domains, view: 'subsystem' };
}

/**
 * renderRingView(consequences) -- the FW-07 D-03 ON-DEMAND concentric ring view.
 *
 * Groups the consequences by their `ring` (1 = direct / 2 = effects-of-effects
 * / 3 = deep systemic ripples), one block per present ring, composed through
 * the same De Stijl 4-zone renderer. No hand-rolled HTML.
 *
 * @param {Array<Object>} consequences - consequence objects (carry `ring`)
 * @param {Object} [opts]
 * @param {string} [opts.seed] - seed label for the header zone
 * @returns {{ rendered: string, rings: number[], view: string }}
 */
function renderRingView(consequences, opts) {
  opts = opts || {};
  const groups = groupBy(consequences, (c) => (Number.isFinite(c.ring) ? String(c.ring) : ''), ['1', '2', '3']);
  const rings = Array.from(groups.keys()).map((k) => Number(k));

  const bodyBlocks = [];
  for (const [ring, items] of groups) {
    bodyBlocks.push(renderGroupBlock('Ring ' + ring, items));
  }

  const seedLabel = opts.seed ? String(opts.seed) : 'seed';
  const envelope = render({
    zones: {
      header: 'Futures Wheel ring view: ' + seedLabel,
      body: bodyBlocks.join('\n\n') || 'No consequences to map yet.',
      signals: ['Concentric ring view groups consequences by causal order (FW-07 on demand).'],
      footer: VIEW_TOGGLE_FOOTER,
    },
    operator: 'DECISION_GATE',
    tier: 1,
  });

  return { rendered: envelope.rendered, rings, view: 'ring' };
}

module.exports = {
  renderSubsystemMap,
  renderRingView,
  VIEW_TOGGLE_FOOTER,
};
