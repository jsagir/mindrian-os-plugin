'use strict';
/*
 * Phase 163-03 -- domain-hierarchy synthesizer.
 *
 * The domain-family synthesis strategy the domain lens driver (and the Wave-4
 * trend agent) passes to lens-engine.rotate() by name ('domain-hierarchy'). It
 * mirrors the Phase 131-03 source-comparison idiom VERBATIM in structure (Canon
 * Part 7 reuse): a PURE function over an array of TYPED lens-finding node objects
 * that returns a neutral structure the renderer later turns into a De Stijl tree.
 * It does NOT rank, dedup, or cap, and it writes NOTHING -- the engine OWNS every
 * graph write (writeLensFinding / writeEdge per lens-engine.cjs:187-225). This
 * strategy only projects the five Engine-1 decomposition lens findings into the
 * domain -> subdomain -> focus_area tree plus the cross_links each lens surfaced.
 *
 * The output shape (the connective taxonomy made legible, D-163-01):
 *   {
 *     domain,                 the domain label (the rotation topic)
 *     subdomains: [           one row per subdomain a lens decomposed to
 *       { name, focus_areas:[...], lens, finding_id }
 *     ],
 *     cross_links: [          the related existing-node ids each lens surfaced
 *       { target_id, relation, lens, finding_id }
 *     ],
 *   }
 *
 * The typed lens_finding node arrives with the shape lens-engine.runOneLens
 * returns: { id, lens, lensType, topic, summary, raw }. The decomposition payload
 * the perLensFn attaches lives on raw:
 *   raw.domain          (optional) the domain label this lens decomposed
 *   raw.subdomains      (optional) [{ name, focus_areas:[...] }]  OR  ['name', ...]
 *   raw.cross_links     (optional) [{ target_id, relation }]      OR  ['nodeId', ...]
 *   raw.related         (optional) alias for cross_links (the reader convention)
 * Each is read defensively; a lens that returns none simply contributes nothing.
 *
 * PURE: no db handle, no fs, no require of room-db / sqlite / navigation, no
 * fetch. Defensive: empty input -> { domain:'', subdomains:[], cross_links:[] };
 * never throws.
 *
 * Canon Part 8: pure over typed node objects produced INSIDE the rotation; never
 *   reads raw user content from disk or db, never egresses. The cross_links carry
 *   ONLY node ids + a relation enum (never prose).
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE). Uses hyphens.
 */

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// Normalize a subdomain entry to { name, focus_areas:[...] }. A lens may emit a
// bare string (just the subdomain name) or an object carrying focus_areas.
function normalizeSubdomain(entry) {
  if (typeof entry === 'string' && entry.length > 0) {
    return { name: entry, focus_areas: [] };
  }
  if (isPlainObject(entry) && typeof entry.name === 'string' && entry.name.length > 0) {
    const focusAreas = Array.isArray(entry.focus_areas)
      ? entry.focus_areas.filter((f) => typeof f === 'string' && f.length > 0)
      : [];
    return { name: entry.name, focus_areas: focusAreas };
  }
  return null;
}

// Normalize a cross-link entry to { target_id, relation }. A lens may emit a bare
// node-id string (defaults the relation to 'related_to') or an object with an
// explicit relation enum. Scalar-only per Part 8 -- never carries prose.
function normalizeCrossLink(entry) {
  if (typeof entry === 'string' && entry.length > 0) {
    return { target_id: entry, relation: 'related_to' };
  }
  if (isPlainObject(entry) && typeof entry.target_id === 'string' && entry.target_id.length > 0) {
    const relation = typeof entry.relation === 'string' && entry.relation.length > 0
      ? entry.relation
      : 'related_to';
    return { target_id: entry.target_id, relation };
  }
  return null;
}

function synthesizeDomainHierarchy(findingNodes) {
  const nodes = Array.isArray(findingNodes) ? findingNodes.filter(isPlainObject) : [];

  // The domain label is the first non-empty topic / raw.domain across the lenses.
  let domain = '';
  for (const node of nodes) {
    const raw = isPlainObject(node.raw) ? node.raw : {};
    if (typeof raw.domain === 'string' && raw.domain.length > 0) {
      domain = raw.domain;
      break;
    }
    if (!domain && typeof node.topic === 'string' && node.topic.length > 0) {
      domain = node.topic;
    }
  }

  const subdomains = [];
  const crossLinks = [];

  for (const node of nodes) {
    const lens = typeof node.lens === 'string' ? node.lens : '';
    const findingId = typeof node.id === 'string' ? node.id : '';
    const raw = isPlainObject(node.raw) ? node.raw : {};

    const rawSubs = Array.isArray(raw.subdomains) ? raw.subdomains : [];
    for (const sub of rawSubs) {
      const norm = normalizeSubdomain(sub);
      if (norm) {
        subdomains.push({
          name: norm.name,
          focus_areas: norm.focus_areas,
          lens,
          finding_id: findingId,
        });
      }
    }

    // cross_links is the canonical key; related is the reader-side alias.
    const rawLinks = Array.isArray(raw.cross_links)
      ? raw.cross_links
      : (Array.isArray(raw.related) ? raw.related : []);
    for (const link of rawLinks) {
      const norm = normalizeCrossLink(link);
      if (norm) {
        crossLinks.push({
          target_id: norm.target_id,
          relation: norm.relation,
          lens,
          finding_id: findingId,
        });
      }
    }
  }

  return { domain, subdomains, cross_links: crossLinks };
}

module.exports = { synthesizeDomainHierarchy };
