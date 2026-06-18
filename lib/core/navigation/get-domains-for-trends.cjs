'use strict';
/*
 * Phase 163-03 -- get-domains-for-trends: the getDomainsForTrendExtrapolation
 * graph-WALKING reader. This is the WAVE 3 FOUNDATION-C net-new (D-163-01 +
 * D-163-04): the reader the Wave-4 trend pipeline seeds itself from. It calls
 * navigation.getNeighborhood on a domain hub to WALK the hub to its related nodes
 * (PART_OF / TAGGED_WITH / DECOMPOSED_INTO / RELATED_TO neighbors) instead of
 * re-deriving the connective taxonomy from prose.
 *
 * TWO TIERS, per D-163-04 (Tier-2 FIRST is the built path; Tier-0 is a cold-start
 * stopgap ONLY):
 *
 *   Tier 2 (PRIMARY, D-163-04): when opts.db is supplied AND domain-type nodes
 *     exist, SELECT the domain nodes and for each call
 *     navigation.getNeighborhood(db, domainNodeId, opts) (the signature
 *     getNeighborhood(db, focusNodeId, opts) per neighborhood.cjs:48) to walk the
 *     hub to its related nodes. Returns { tier:2, domains:[{id, name, domainType,
 *     related:[...]}] }. This is the connective-taxonomy substrate made WALKABLE.
 *
 *   Tier 0 (COLD-START FALLBACK ONLY, when no domain nodes exist): parse recent
 *     explore-domains artifacts under room/problem-definition/domain-decomposition/
 *     + BRAIN.md concept handles, reusing the SHIPPED parseFrontmatter from
 *     opportunity-ops.cjs (Canon Part 7 -- do NOT hand-roll). Returns
 *     { tier:0, domains:[...] } -- the documented stopgap that does NOT satisfy
 *     D-163-01 but keeps a brand-new room moving. The cold-start BRAIN.md read is
 *     a LOCAL file read of an already-derived local cache, NEVER a live Brain call.
 *
 * SUBSTRATE CONTRACT (Canon Part 9): this module reaches room.db ONLY through
 *   the getNeighborhood chokepoint (required directly from ./neighborhood.cjs --
 *   the same non-circular pattern dashboard-helpers.cjs:33 uses; navigation.cjs
 *   re-exports getNeighborhood from exactly this module, so requiring the parent
 *   navigation.cjs would be a require cycle). The db handle is CALLER-OWNED
 *   (arrives via opts.db, opened by the caller through openRoomDb); the module
 *   NEVER opens or closes room.db and carries ZERO direct require of room-db.cjs /
 *   lazygraph-ops.cjs / node:sqlite. The ONLY query it issues directly against the
 *   caller-owned handle is the domain-node SELECT (a read of the nodes table the
 *   caller owns -- the same caller-owned-handle pattern getNeighborhood itself uses
 *   internally); it never opens a connection.
 *
 * REUSE (Canon Part 7): the Tier-0 cold-start parser is the SHIPPED
 *   opportunity-ops.parseFrontmatter, lazy-required INSIDE the cold-start function
 *   so the heavy opportunity-ops dependency chain (which transitively requires
 *   navigation.cjs via brain-client.cjs) never participates in this module's
 *   load-time graph -- avoiding a require cycle while still reusing the shipped
 *   parser (do NOT hand-roll).
 *
 * Canon Part 8: zero Brain egress. Tier 2 is a LOCAL graph walk; Tier 0 is a LOCAL
 *   filesystem read of already-derived artifacts. No fetch, no http, no Brain MCP.
 *
 * Defensive: NEVER throws on a missing db / missing artifacts (the futures
 *   orchestrator degrade contract). A missing db with no artifacts returns
 *   { tier:0, domains:[] }.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE). Uses hyphens.
 */

const fs = require('node:fs');
const path = require('node:path');

// Direct require of the getNeighborhood chokepoint primitive (non-circular).
// navigation.cjs re-exports getNeighborhood from this same module, so requiring
// the parent navigation.cjs here would create a require cycle (and Tier-2 would
// see an unresolved partial export). dashboard-helpers.cjs:33 uses this exact
// direct-require pattern.
const neighborhoodMod = require('./neighborhood.cjs');

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// Read the name + domainType off a domain node's properties JSON blob (the
// typed-domain.cjs:114-119 additive-JSON shape). Defensive scalar reads.
function parseDomainProps(propertiesJson) {
  let props = {};
  if (typeof propertiesJson === 'string' && propertiesJson.length > 0) {
    try {
      const parsed = JSON.parse(propertiesJson);
      if (isPlainObject(parsed)) props = parsed;
    } catch (_e) {
      // defensive: a malformed blob yields empty props, never a throw.
    }
  }
  return {
    name: typeof props.name === 'string' ? props.name : '',
    domainType: typeof props.domainType === 'string' ? props.domainType : '',
  };
}

// Tier 2: SELECT the domain-type nodes from the caller-owned handle, then WALK
// each via the navigation.getNeighborhood chokepoint. Returns the domains with
// their related node ids, or null when no domain nodes exist (signals cold start).
function tier2Walk(db, opts) {
  let rows;
  try {
    // The domain-node SELECT (a read of the caller-owned nodes table). Only the
    // three D-163-01 first-class taxonomy types are domain hubs.
    rows = db.prepare(
      "SELECT id, type, properties FROM nodes WHERE type IN ('domain','subdomain','focus_area')"
    ).all();
  } catch (_e) {
    // A missing nodes table / un-migrated schema is treated as cold start.
    return null;
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }
  const walkOpts = isPlainObject(opts) ? opts : {};
  const domains = rows.map((row) => {
    const { name, domainType } = parseDomainProps(row.properties);
    let related = [];
    try {
      const neighborhood = neighborhoodMod.getNeighborhood(db, row.id, {
        maxDepth: Number.isInteger(walkOpts.maxDepth) ? walkOpts.maxDepth : 2,
        topK: Number.isInteger(walkOpts.topK) ? walkOpts.topK : 20,
      });
      if (Array.isArray(neighborhood)) {
        related = neighborhood.map((n) => ({
          id: n.id,
          type: n.type,
          edgeTypeIn: n.edgeTypeIn,
          score: n.score,
        }));
      }
    } catch (_e) {
      // A walk failure on one hub never aborts the whole read; that hub returns
      // an empty related list (defensive degrade).
      related = [];
    }
    return {
      id: row.id,
      name: name,
      domainType: domainType || row.type,
      related: related,
    };
  });
  return { tier: 2, domains: domains };
}

// Read the names that look like domain / subdomain handles off a parsed
// frontmatter object. The explore-domains artifacts carry domain / subdomain /
// focus_area frontmatter keys (commands/explore-domains.md). Defensive: any
// shape that does not yield a string name is skipped.
function namesFromFrontmatter(fm) {
  const out = [];
  if (!isPlainObject(fm)) return out;
  const pushName = (v, kind) => {
    if (typeof v === 'string' && v.length > 0) out.push({ name: v, domainType: kind });
  };
  pushName(fm.domain, 'domain');
  pushName(fm.subdomain, 'subdomain');
  pushName(fm.focus_area, 'focus_area');
  // List-shaped keys (subdomains: [..]) are common in decomposition artifacts.
  if (Array.isArray(fm.subdomains)) {
    for (const s of fm.subdomains) {
      if (typeof s === 'string') pushName(s, 'subdomain');
      else if (isPlainObject(s) && typeof s.name === 'string') pushName(s.name, 'subdomain');
    }
  }
  return out;
}

// Tier 0 cold-start fallback: parse the recent domain-decomposition artifacts +
// BRAIN.md concept handles under roomDir. LOCAL filesystem only; reuses the
// shipped parseFrontmatter. Defensive: a missing roomDir / missing dir returns [].
function tier0ColdStart(roomDir) {
  const domains = [];
  if (typeof roomDir !== 'string' || roomDir.length === 0) {
    return { tier: 0, domains: domains };
  }
  const base = roomDir.replace(/\/+$/, '');

  // Lazy-require the SHIPPED parser (Canon Part 7 reuse) ONLY on the cold-start
  // path, so the heavy opportunity-ops chain (which transitively requires
  // navigation.cjs) never joins this module's load-time require graph. Defensive:
  // if the parser cannot be loaded, the cold-start path still returns [] cleanly.
  let parseFrontmatter;
  try {
    parseFrontmatter = require('../opportunity-ops.cjs').parseFrontmatter;
  } catch (_e) {
    parseFrontmatter = null;
  }
  if (typeof parseFrontmatter !== 'function') {
    return { tier: 0, domains: domains };
  }

  // Source 1: the explore-domains decomposition artifacts.
  const decompDir = path.join(base, 'problem-definition', 'domain-decomposition');
  try {
    if (fs.existsSync(decompDir) && fs.statSync(decompDir).isDirectory()) {
      const walkArtifacts = (dir) => {
        let entries = [];
        try {
          entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch (_e) {
          return;
        }
        for (const ent of entries) {
          const full = path.join(dir, ent.name);
          if (ent.isDirectory()) {
            walkArtifacts(full);
          } else if (ent.isFile() && ent.name.endsWith('.md')) {
            let content = '';
            try {
              content = fs.readFileSync(full, 'utf8');
            } catch (_e) {
              continue;
            }
            const fm = parseFrontmatter(content);
            for (const d of namesFromFrontmatter(fm)) {
              domains.push({ id: '', name: d.name, domainType: d.domainType, related: [], source: 'artifact' });
            }
          }
        }
      };
      walkArtifacts(decompDir);
    }
  } catch (_e) {
    // defensive: an artifact-scan failure never throws.
  }

  // Source 2: the BRAIN.md concept handles (a LOCAL read of an already-derived
  // local cache, never a live Brain call). The problem-definition section's
  // BRAIN.md is the most-relevant derived cache for domain handles.
  const brainPath = path.join(base, 'problem-definition', 'BRAIN.md');
  try {
    if (fs.existsSync(brainPath)) {
      let content = '';
      try {
        content = fs.readFileSync(brainPath, 'utf8');
      } catch (_e) {
        content = '';
      }
      const fm = parseFrontmatter(content);
      for (const d of namesFromFrontmatter(fm)) {
        domains.push({ id: '', name: d.name, domainType: d.domainType, related: [], source: 'brain.md' });
      }
    }
  } catch (_e) {
    // defensive: a BRAIN.md read failure never throws.
  }

  return { tier: 0, domains: domains };
}

/**
 * getDomainsForTrendExtrapolation(roomDir, opts) -- the graph-walking domain reader.
 *
 * @param {string} roomDir  the room directory (used by the Tier-0 cold-start path).
 * @param {object} [opts]   { db, maxDepth, topK }. When opts.db is supplied AND
 *                          domain nodes exist, the Tier-2 walk runs; otherwise the
 *                          Tier-0 cold-start fallback runs.
 * @returns {{tier:number, domains:Array}}  tier 2 walked domains, or tier 0
 *                          cold-start domains. NEVER throws.
 */
function getDomainsForTrendExtrapolation(roomDir, opts) {
  const options = isPlainObject(opts) ? opts : {};
  const db = options.db || null;

  // Tier 2 PRIMARY (D-163-04): walk the domain hubs when a db handle is present
  // AND domain nodes exist. tier2Walk returns null on cold start (no domain nodes).
  if (db) {
    let walked = null;
    try {
      walked = tier2Walk(db, options);
    } catch (_e) {
      walked = null;
    }
    if (walked && Array.isArray(walked.domains) && walked.domains.length > 0) {
      return walked;
    }
  }

  // Tier 0 COLD-START fallback ONLY (no db handle, or no domain nodes yet).
  return tier0ColdStart(roomDir);
}

module.exports = { getDomainsForTrendExtrapolation };
