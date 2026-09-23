'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 361-03 -- dominant-design evidence-pack: the D-06 validator, the D-13
 * tier map, the lane artifact renderer, and the EvidenceClaim filing-parameter
 * builder for the /mos:dominant-designs research path.
 *
 * D-06 (Canon Part 12 sourced-claims rule): every kept claim row carries the
 * five fields {claim, source_url, source_title, retrieved_at, quote_or_locator}
 * with an http(s) source_url and a parseable retrieved_at date. A claim
 * missing any of these, or whose source_url is not a clean http(s) URL, is
 * DROPPED, not hedged. A row carrying a score-like key (score, confidence,
 * strength, probability, rank, matched as a case-insensitive substring so
 * dominance_strength and relevance_score are also caught) is dropped as
 * tampering (T-361-10): agents narrate evidence, they do not grade it.
 *
 * D-13 (Canon Part 5 tier definitions): the evidence_tier is assigned HERE,
 * in code, from the row's source_type. peer_reviewed and standards_body ->
 * Academic; company_primary, regulatory_filing and market_data -> Operational;
 * press, blog, other (and any unrecognized type) -> Practitioner. The agent
 * cannot set evidence_tier directly; it is never a whitelisted input key
 * (T-361-14).
 *
 * D-07: an empty lane still renders a full artifact naming what was searched,
 * never a silent gap; a lane whose search did not run (raw.error) states so
 * explicitly and is never presented as a lane that searched and found
 * nothing.
 *
 * Canon Part 8: renderLaneArtifact runs untrusted web-returned prose (claim,
 * source_title, quote_or_locator) through the SHIPPED stripInjectionSpans
 * (lib/core/navigation/evidence-claim.cjs) before it can reach a rendered
 * artifact (T-361-12).
 *
 * Pure CJS: no fs, no network, no clock except the caller-supplied `date` /
 * `retrieved_at` render options. Zero npm deps.
 *
 * No em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const { stripInjectionSpans } = require('../navigation/evidence-claim.cjs');
const { LANES, LANE_IDS } = require('./lane-queries.cjs');

const DEFAULT_MAX_ROWS = 40;
const MAX_ENTITIES = 12;
const MAX_ENTITY_CHARS = 80;

// SOURCE_TYPES: the closed D-13 vocabulary. Order is the canonical order the
// D-13 ruling states them in (Academic pair, Operational trio, Practitioner
// trio).
const SOURCE_TYPES = Object.freeze([
  'peer_reviewed',
  'standards_body',
  'company_primary',
  'regulatory_filing',
  'market_data',
  'press',
  'blog',
  'other',
]);

const ACADEMIC_TYPES = new Set(['peer_reviewed', 'standards_body']);
const OPERATIONAL_TYPES = new Set(['company_primary', 'regulatory_filing', 'market_data']);

// TIER_RANK: internal ordering so toEvidenceClaimParams can pick the highest
// tier among rows grouped onto the same URL. Not exported: callers use tierFor
// and never assign a tier by hand.
const TIER_RANK = Object.freeze({ Academic: 3, Operational: 2, Practitioner: 1, None: 0 });

// FORBIDDEN_ROW_KEYS: the visible word list (T-361-10). Matched against every
// own key of a raw row as a CASE-INSENSITIVE SUBSTRING (not an exact-key
// match), so dominance_strength and relevance_score are also caught.
const FORBIDDEN_ROW_KEYS = Object.freeze(['score', 'confidence', 'strength', 'probability', 'rank']);
const FORBIDDEN_KEY_RE = new RegExp('(' + FORBIDDEN_ROW_KEYS.join('|') + ')', 'i');

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isHttpUrl(s) {
  if (typeof s !== 'string' || s.length === 0) return false;
  let u;
  try {
    u = new URL(s);
  } catch (_e) {
    return false;
  }
  return u.protocol === 'http:' || u.protocol === 'https:';
}

function parsesAsDate(s) {
  return typeof s === 'string' && Number.isFinite(Date.parse(s));
}

function hasForbiddenKey(row) {
  return Object.keys(row).some(function (k) { return FORBIDDEN_KEY_RE.test(k); });
}

function laneAbbrev(laneId) {
  const lane = LANES.find(function (l) { return l.id === laneId; });
  return lane ? lane.abbrev : 'XX';
}

function laneLabel(laneId) {
  const lane = LANES.find(function (l) { return l.id === laneId; });
  return lane ? lane.label : laneId;
}

// tierFor(sourceType) -- the D-13 tier map. An unrecognized or missing type
// is coerced to 'other', which is Practitioner: the code default is the
// SAFEST tier, never a guess upward.
function tierFor(sourceType) {
  if (ACADEMIC_TYPES.has(sourceType)) return 'Academic';
  if (OPERATIONAL_TYPES.has(sourceType)) return 'Operational';
  return 'Practitioner';
}

// validateLaneResult(raw, opts) -- the D-06 chokepoint. raw is the agent's
// returned envelope for one lane: { lane, queries, claims:[...], error?,
// searched_not_found? }. opts.approvedQueries is the gate-approved query list
// this lane was allowed to run; opts.maxRows overrides the row cap (default
// 40, D-06 discretion).
function validateLaneResult(raw, opts) {
  const options = opts || {};
  const maxRows = Number.isFinite(options.maxRows) ? options.maxRows : DEFAULT_MAX_ROWS;

  if (!isPlainObject(raw) || !Array.isArray(raw.claims)) {
    return { ok: false, reason: 'bad_shape' };
  }
  if (typeof raw.lane !== 'string' || LANE_IDS.indexOf(raw.lane) === -1) {
    return { ok: false, reason: 'unknown_lane' };
  }

  const rawQueries = Array.isArray(raw.queries) ? raw.queries : [];
  if (Array.isArray(options.approvedQueries)) {
    const approved = options.approvedQueries;
    const sameLength = rawQueries.length === approved.length;
    const sameOrder = sameLength && rawQueries.every(function (q, i) { return q === approved[i]; });
    if (!sameOrder) {
      return { ok: false, reason: 'query_mismatch', lane: raw.lane };
    }
  }

  const abbrev = laneAbbrev(raw.lane);

  let droppedUnsourced = 0;
  let droppedScored = 0;
  const candidates = [];

  raw.claims.forEach(function (row) {
    if (!isPlainObject(row)) {
      droppedUnsourced += 1;
      return;
    }
    if (hasForbiddenKey(row)) {
      droppedScored += 1;
      return;
    }
    const fiveFieldsOk = isNonEmptyString(row.claim)
      && isNonEmptyString(row.source_title)
      && isNonEmptyString(row.quote_or_locator)
      && isHttpUrl(row.source_url)
      && parsesAsDate(row.retrieved_at);
    if (!fiveFieldsOk) {
      droppedUnsourced += 1;
      return;
    }
    candidates.push(row);
  });

  const capped = candidates.slice(0, maxRows);
  const droppedOverCap = candidates.length - capped.length;

  const rows = capped.map(function (row, idx) {
    let entities = [];
    if (Array.isArray(row.entities)) {
      entities = row.entities
        .filter(function (e) { return typeof e === 'string'; })
        .slice(0, MAX_ENTITIES)
        .map(function (e) { return e.slice(0, MAX_ENTITY_CHARS); });
    }
    return {
      id: 'E-' + abbrev + '-' + (idx + 1),
      claim: row.claim,
      source_url: row.source_url,
      source_title: row.source_title,
      retrieved_at: row.retrieved_at,
      quote_or_locator: row.quote_or_locator,
      source_type: typeof row.source_type === 'string' ? row.source_type : 'other',
      evidence_tier: tierFor(row.source_type),
      stated_date: isNonEmptyString(row.stated_date) ? row.stated_date : null,
      entities: entities,
    };
  });

  const suppliedSearchedNotFound = Array.isArray(raw.searched_not_found)
    ? raw.searched_not_found.filter(isNonEmptyString)
    : [];
  let searchedNotFound = suppliedSearchedNotFound;
  if (rows.length === 0 && suppliedSearchedNotFound.length === 0) {
    const queriesForMessage = Array.isArray(options.approvedQueries) ? options.approvedQueries : rawQueries;
    searchedNotFound = queriesForMessage.map(function (q) {
      return 'searched "' + q + '", found no sourced evidence';
    });
  }

  return {
    ok: true,
    lane: raw.lane,
    queries: rawQueries,
    rows: rows,
    counts: {
      received: raw.claims.length,
      kept: rows.length,
      dropped_unsourced: droppedUnsourced,
      dropped_scored: droppedScored,
      dropped_over_cap: droppedOverCap,
    },
    searched_not_found: searchedNotFound,
    error: (raw.error === undefined || raw.error === null) ? null : raw.error,
  };
}

// ---------- Rendering helpers ----------

function escapeCell(s) {
  const str = typeof s === 'string' ? s : String(s === null || s === undefined ? '' : s);
  return str.replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ').trim();
}

function cleanProse(s) {
  return escapeCell(stripInjectionSpans(typeof s === 'string' ? s : ''));
}

function sourceCell(row) {
  const title = cleanProse(row.source_title);
  const url = row.source_url;
  const cleanLinkable = isHttpUrl(url) && !/[\s()|]/.test(url);
  return cleanLinkable ? ('[' + title + '](' + url + ')') : title;
}

function yamlQueriesBlock(queries) {
  if (!Array.isArray(queries) || queries.length === 0) return 'queries: []\n';
  return 'queries:\n' + queries.map(function (q) { return '  - ' + JSON.stringify(q) + '\n'; }).join('');
}

// renderLaneArtifact(valid, opts) -- valid is a validateLaneResult({ok:true})
// envelope. opts = { domain_slug, date, retrieved_at }.
function renderLaneArtifact(valid, opts) {
  const options = opts || {};
  const domainSlug = typeof options.domain_slug === 'string' ? options.domain_slug : '';
  const date = typeof options.date === 'string' ? options.date : '';
  const retrievedAt = typeof options.retrieved_at === 'string' ? options.retrieved_at : '';
  const label = laneLabel(valid.lane);

  let frontmatter = '---\n';
  frontmatter += 'methodology: dominant-designs\n';
  frontmatter += 'artifact_kind: evidence-lane\n';
  frontmatter += 'lane: ' + valid.lane + '\n';
  frontmatter += yamlQueriesBlock(valid.queries);
  frontmatter += 'searched_via: Tavily\n';
  frontmatter += 'retrieved_at: ' + JSON.stringify(retrievedAt) + '\n';
  frontmatter += 'claim_count: ' + valid.rows.length + '\n';
  frontmatter += 'dropped_unsourced_count: ' + valid.counts.dropped_unsourced + '\n';
  frontmatter += 'dropped_scored_count: ' + valid.counts.dropped_scored + '\n';
  frontmatter += 'room_section: competitive-analysis\n';
  if (valid.error) {
    frontmatter += 'error: ' + JSON.stringify(String(valid.error)) + '\n';
  }
  frontmatter += '---\n\n';

  let body = '# ' + label + ' Evidence - ' + domainSlug + '\n\n';

  if (valid.error) {
    body += 'Search did not run: ' + escapeCell(String(valid.error)) + '\n\n';
  }

  body += '| Id | Claim | Source | Type | Tier | Stated date | Quote or locator |\n';
  body += '| --- | --- | --- | --- | --- | --- | --- |\n';

  if (valid.rows.length > 0) {
    valid.rows.forEach(function (row) {
      body += '| ' + row.id
        + ' | ' + cleanProse(row.claim)
        + ' | ' + sourceCell(row)
        + ' | ' + escapeCell(row.source_type)
        + ' | ' + escapeCell(row.evidence_tier)
        + ' | ' + escapeCell(row.stated_date || '')
        + ' | ' + cleanProse(row.quote_or_locator)
        + ' |\n';
    });
  } else if (!valid.error) {
    body += '\nNo sourced evidence found for this lane.\n';
  }

  body += '\n## Searched, not found\n';
  if (valid.searched_not_found.length > 0) {
    valid.searched_not_found.forEach(function (line) {
      body += '- ' + escapeCell(line) + '\n';
    });
  } else {
    body += '- (nothing left unsearched; every approved query returned sourced evidence)\n';
  }

  return frontmatter + body;
}

// toEvidenceClaimParams(valid, opts) -- one fileEvidenceWithReadback param set
// per unique URL within a lane (Pitfall 3: two rows from one page never
// overwrite each other's node under a shared session key, but two DIFFERENT
// rows sharing a URL DO intentionally collapse into one filed claim per URL).
// opts = { sessionId, artifact_path? }.
function toEvidenceClaimParams(valid, opts) {
  const options = opts || {};
  const baseSessionId = typeof options.sessionId === 'string' ? options.sessionId : '';
  const sessionId = baseSessionId + ':dd-' + valid.lane;
  const label = laneLabel(valid.lane);
  const topic = 'Dominant design evidence: ' + label;

  const groups = new Map();
  valid.rows.forEach(function (row) {
    if (!groups.has(row.source_url)) {
      groups.set(row.source_url, []);
    }
    groups.get(row.source_url).push(row);
  });

  const params = [];
  groups.forEach(function (rows, url) {
    const first = rows[0];
    let bestTier = 'None';
    rows.forEach(function (r) {
      if (TIER_RANK[r.evidence_tier] > TIER_RANK[bestTier]) {
        bestTier = r.evidence_tier;
      }
    });
    const summary = rows.map(function (r) {
      return '[' + r.id + '] ' + r.claim;
    }).join('\n');
    const entry = {
      topic: topic,
      source: first.source_title,
      url: url,
      retrieved_at: first.retrieved_at,
      evidence_tier: bestTier,
      summary: summary,
      sessionId: sessionId,
    };
    if (typeof options.artifact_path === 'string' && options.artifact_path.length > 0) {
      entry.artifact_path = options.artifact_path;
    }
    params.push(entry);
  });

  return params;
}

// laneArtifactName(domain_slug, date, lane) -- the filing filename. Throws on
// a slug or date that does not match its expected shape (both are caller
// inputs derived earlier in the pipeline; a mismatch here is a bug upstream,
// not a degrade path).
function laneArtifactName(domainSlug, date, lane) {
  if (typeof domainSlug !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(domainSlug)) {
    throw new Error('laneArtifactName: invalid domain_slug: ' + String(domainSlug));
  }
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('laneArtifactName: invalid date: ' + String(date));
  }
  return domainSlug + '-' + date + '-evidence-' + lane + '.md';
}

module.exports = {
  SOURCE_TYPES,
  FORBIDDEN_ROW_KEYS,
  tierFor,
  validateLaneResult,
  renderLaneArtifact,
  toEvidenceClaimParams,
  laneArtifactName,
};
