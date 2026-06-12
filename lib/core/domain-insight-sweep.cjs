/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 155-07 -- domain-insight-sweep.cjs (GAP-15, Decision 9 LOCKED 2026-06-12)
 *
 * THE single entry point for the Hooked variable-reward leg of the blank-slate
 * persona. Consumes generic domain keyword handles (from extractDomains in
 * shallow-doc-parser.cjs), drives a Tavily SIGNAL search per handle via the
 * existing fetchCorpus (research-corpus.cjs REUSE path), caches results in
 * research-cache.cjs, derives cross-domain adjacency insights LOCALLY, and
 * files them as proposed claims (writeClaimNode via navigation.cjs chokepoint)
 * and opportunity candidates (bankOpportunity via opportunity-ops.cjs).
 *
 * Canon Part 7 (reuse before build): fetchCorpus + research-cache + navigation
 * are all shipped substrate. No new npm dependencies. Zero Python subprocess.
 *
 * Canon Part 8 (graph boundary -- Part 8 hard lines enforced in implementation):
 *   CONSTRAINT 1 (LOCAL -> Brain: NO): sweepDomainInsights makes ZERO Brain MCP
 *   calls. fetchCorpus source='tavily' is a SIGNAL source (public web), not a
 *   Brain query. The Part 8 boundary (LOCAL -> Brain: NO) is preserved by design.
 *
 *   CONSTRAINT 2 (query = generic handle only): the `query` param passed to
 *   fetchCorpus is ALWAYS the generic keyword handle, never any room content,
 *   CV prose, or session ID. The auditQueryString chokepoint in fetchCorpus
 *   enforces this structurally -- any non-generic string throws
 *   ExternalEgressViolation before a byte leaves the process.
 *
 *   CONSTRAINT 3 (adjacency text = LOCAL template only): the adjacency text
 *   written to the claim and opportunity is a LOCAL template interpolation --
 *   no CV body text, no personal names, no institutional names enter the
 *   template. Only the domain handle (generic keyword) and a snippet excerpt
 *   (<= 80 chars, PII-stripped) from the Tavily public-web response.
 *
 * Tri-Polar note: extractDomains is sync + pure; sweepDomainInsights requires
 * an open db handle (post-birth, B3 slot only). Desktop/Cowork degradation:
 * if no db handle is available (pre-room, MCP extract_shallow path), call
 * extractDomains to get handles and surface them as text ('Your domains: X,
 * Y, Z -- sweep will run at birth') without filing claims.
 *
 * Pure CJS, 'use strict'. Zero new npm deps.
 */
'use strict';

const { auditQueryString } = require('./rs-egress-prompts.cjs');
const { fetchCorpus } = require('./research-corpus.cjs');
const { getCached, putCached } = require('./research-cache.cjs');
const navigation = require('./navigation.cjs');
const { bankOpportunity } = require('./opportunity-ops.cjs');

// Max handles to sweep in one B3 call (keeps the slot fast; user gets "three adjacencies").
const MAX_HANDLES = 3;

// Maximum snippet excerpt length for the LOCAL template interpolation.
const SNIPPET_MAX = 80;

// Simple PII strip for snippet excerpts from Tavily public-web responses.
// Removes email-like and URL-like tokens from public snippets before they
// enter the claim text.
function stripSnippetPii(s) {
  if (!s || typeof s !== 'string') return '';
  let r = s;
  // Remove email-like tokens
  r = r.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '');
  // Remove URL-like tokens
  r = r.replace(/https?:\/\/[^\s]+/g, '');
  r = r.replace(/www\.[^\s]+/g, '');
  // Collapse whitespace
  r = r.replace(/\s+/g, ' ').trim();
  return r;
}

// Derives the adjacency keyword from the top Tavily result title.
// Returns a generic domain keyword (not user content).
function deriveAdjacentDomain(title) {
  if (!title || typeof title !== 'string') return 'adjacent field';
  // Take the first 3 lowercase words from the title as the adjacent domain handle.
  const words = title.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  return words.slice(0, 3).join(' ') || 'adjacent field';
}

// Synthesizes a single-sentence adjacency insight from fetchCorpus results.
// CONSTRAINT 3: no CV body text, no personal names enter the template.
function synthesizeAdjacency(handle, results) {
  if (!Array.isArray(results) || results.length === 0) {
    return handle + ' connects to emerging adjacent fields -- see SIGNAL corpus for details';
  }
  const top = results[0];
  const adjacent = deriveAdjacentDomain(top.title || '');
  const raw = top.abstract || top.content || '';
  const stripped = stripSnippetPii(raw);
  const excerpt = stripped.slice(0, SNIPPET_MAX);
  return handle + ' connects to ' + adjacent + ' -- ' + excerpt;
}

// sweepDomainInsights -- the single exported entry point (GAP-15).
//
// @param {object} args
//   domains    {string[]}  Generic keyword handles from extractDomains.
//   roomDir    {string}    Absolute room directory path (cache base).
//   sessionId  {string}    Current session ID.
//   db         {object}    Open room.db handle (required; sweep runs post-birth B3 slot).
//
// @returns {object}
//   { ok, swept, handles, claims_filed, opportunities_banked, skipped_reason? }
//   Never throws; all errors degrade gracefully (the sweep is a reward, never a blocker).

async function sweepDomainInsights({ domains, roomDir, sessionId, db } = {}) {
  // Validate: if domains is empty or db is falsy, return graceful skip.
  if (!db) {
    return { ok: false, swept: 0, skipped_reason: 'no-domains-or-no-db' };
  }
  if (!Array.isArray(domains) || domains.length === 0) {
    return { ok: false, swept: 0, skipped_reason: 'no-domains-or-no-db' };
  }

  const handles = domains.slice(0, MAX_HANDLES);
  let swept = 0;
  let claims_filed = 0;
  let opportunities_banked = 0;
  const used_handles = [];

  for (const handle of handles) {
    // CONSTRAINT 2: audit the handle via auditQueryString.
    // On ExternalEgressViolation: log warn, skip this handle.
    // The audit IS the Part 8 egress gate -- only generic keyword strings
    // that pass the forbidden-pattern scan ever reach fetchCorpus.
    try {
      auditQueryString(handle, 'domain-insight-sweep');
    } catch (auditErr) {
      console.warn('[domain-insight-sweep] auditQueryString rejected handle:', handle, auditErr.message);
      continue;
    }

    let results = null;

    // Cache check (30-day TTL via research-cache.cjs).
    if (roomDir) {
      try {
        results = getCached(roomDir, 'tavily', handle);
      } catch (_cacheReadErr) {
        results = null; // cache miss / unreadable -- proceed to fetch
      }
    }

    // If cold (no fresh cache entry): call fetchCorpus(tavily).
    // CONSTRAINT 2: query is the generic keyword handle, never room/CV content.
    // CONSTRAINT 1: source='tavily' is SIGNAL (public web), not a Brain query.
    if (!Array.isArray(results)) {
      try {
        results = await fetchCorpus({ source: 'tavily', query: handle, limit: 5 });
      } catch (fetchErr) {
        console.warn('[domain-insight-sweep] fetchCorpus error for handle "' + handle + '":', fetchErr.message);
        continue; // graceful degradation -- next handle
      }
      // Write to cache.
      if (roomDir && Array.isArray(results)) {
        try {
          putCached(roomDir, 'tavily', handle, results);
        } catch (_putErr) {
          // Cache write failure is non-fatal.
        }
      }
    }

    if (!Array.isArray(results) || results.length === 0) {
      continue; // no results from this handle -- next
    }

    // CONSTRAINT 3: synthesize adjacency insight LOCALLY (template interpolation).
    // No CV body, no personal names, no institutional names enter the template.
    const adjacencyText = synthesizeAdjacency(handle, results);

    // File the insight as a proposed claim via navigation.writeClaimNode.
    // knowledge_type='heuristic' (not 'fact': SIGNAL-derived, not verified).
    // review_status='proposed' (Canon Part 9 role 4: Larry may propose, human confirms).
    try {
      navigation.writeClaimNode(db, {
        knowledge_type: 'heuristic',
        text: adjacencyText,
        sessionId: sessionId,
        sourceSegment: handle,
        valid_from: new Date().toISOString(),
      });
      claims_filed++;
    } catch (claimErr) {
      console.warn('[domain-insight-sweep] writeClaimNode failed for handle "' + handle + '":', claimErr.message);
      // Graceful degradation -- continue to bankOpportunity.
    }

    // Bank an opportunity via bankOpportunity (opportunity-ops.cjs).
    // confidence=0.4 signals low-bar SIGNAL evidence (navigator must confirm).
    if (roomDir) {
      try {
        bankOpportunity(roomDir, {
          problem: 'Cross-domain opportunity: ' + handle,
          mirror_solution: adjacencyText,
          domain: handle,
          evidence: 'tavily-signal',
          source_framework: 'domain-insight-sweep',
          knight_position: 'explorer',
          confidence: 0.4,
          created: new Date().toISOString().split('T')[0],
          status: 'proposed',
        });
        opportunities_banked++;
      } catch (bankErr) {
        console.warn('[domain-insight-sweep] bankOpportunity failed for handle "' + handle + '":', bankErr.message);
        // Graceful degradation.
      }
    }

    used_handles.push(handle);
    swept++;
  }

  return {
    ok: true,
    swept,
    handles: used_handles,
    claims_filed,
    opportunities_banked,
  };
}

module.exports = { sweepDomainInsights };
