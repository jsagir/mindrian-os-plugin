/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * (Business Source License 1.1; SPDX BUSL-1.1; see LICENSE.)
 *
 * Phase 94 Plan 05 -- Section-8 trace schema authority.
 *
 * The Section-8 decision-trace schema is forward-additive per the
 * Phase 91 navigation-engine invariant: writers may emit fields not
 * present in older readers; readers must tolerate unknown fields.
 * This module is the canonical schema authority that:
 *
 *   1. Documents the shape every writer must produce (intent_persona
 *      block, plus the new web_research_tier field added in Plan 94-05).
 *   2. Provides a machine-readable constant (SECTION_8_TRACE_SCHEMA)
 *      for downstream validators and the Plan 94-05 fixture suite
 *      (lib/memory/mcp-stack-fallback.test.cjs T6).
 *   3. Stays a tiny re-export shim. The active writer authority is
 *      lib/core/navigation-engine.cjs (buildIntentPersona at line ~337
 *      and ~429) plus scripts/rs-discovery-engine.cjs (decision-trace
 *      writer for the rs-fetch pipeline). This file does NOT hijack
 *      writer responsibility; it documents the contract those writers
 *      MUST honor.
 *
 * web_research_tier (Plan 94-05 amendment):
 *   - Type: string enum, one of 'paid' | 'native' | 'cache' | null
 *   - Where: intent_persona.web_research_tier
 *   - Producer: rs-fetcher-* envelope tier annotation (Plan 94-05),
 *     copied into the Section-8 trace by the decision-trace writer
 *     reading the envelope.tier field.
 *   - Why: Canon Part 4 (every choice is graph data). Tier transitions
 *     (paid -> native, native -> cache) become graph data in the
 *     Section-8 trace, so the navigator can review which research-tier
 *     produced their evidence.
 *
 * Forward-additive contract (Phase 91 invariant): adding new fields
 * to this schema does NOT break existing readers. Readers MUST treat
 * the schema as a superset, ignoring fields they don't recognize.
 *
 * Pure CJS, zero npm deps, zero filesystem surface.
 */
'use strict';

// ---------- Tier vocabulary ----------

// Canonical tier values for web research per Plan 94-05 amendment.
// 'paid'    : Tavily / Firecrawl / Exa / keyed academic API returned data.
// 'native'  : Anthropic native WebSearch (free fallback) returned data.
// 'cache'   : Read most-recent fetched_results.json from <room>/.mindrian/.
// 'derived' : Post-processor over an upstream fetcher (e.g. experts over
//             academic.papers). Not a direct network tier.
const WEB_RESEARCH_TIERS = Object.freeze(['paid', 'native', 'cache', 'derived']);

// Canonical source tags. These mirror the rs-fetcher-* envelope.source
// field. Any new source must be added here AND in the fetcher's SOURCES
// frozen array.
const WEB_RESEARCH_SOURCES = Object.freeze([
  'tavily', 'firecrawl', 'exa',
  'websearch', 'cache', 'derived',
  'openalex', 'arxiv', 'pubmed', 'scopus', 'ieee', 'nature',
  'google_patents', 'uspto',
]);

// ---------- SECTION_8_TRACE_SCHEMA ----------
//
// JSON-Schema-flavored literal documenting the Section-8 decision-trace
// shape. Forward-additive: writers may emit additional keys; readers
// MUST ignore unknown keys.
//
// The schema is intentionally narrow: only the intent_persona block is
// fully documented because that's where Plan 94-05 adds the new
// web_research_tier field. Other Section-8 trace blocks (decision_log,
// routing_source, brain_md_tier_mode, etc.) are out of scope for this
// plan and live in their owning phase's writer authority.

const SECTION_8_TRACE_SCHEMA = Object.freeze({
  $id: 'mindrian.section-8-trace.v1',
  type: 'object',
  description: 'Section-8 decision-trace per Canon Part 4. Forward-additive '
    + 'per Phase 91 invariant: readers tolerate unknown keys.',
  properties: {
    intent_persona: {
      type: 'object',
      description: 'Persona + intent classification block. Phase 91 navigation-'
        + 'engine writer authority (buildIntentPersona). Plan 94-05 adds the '
        + 'web_research_tier field.',
      properties: {
        // ---- Plan 94-05 amendment: new field ----
        web_research_tier: {
          type: ['string', 'null'],
          enum: ['paid', 'native', 'cache', 'derived', null],
          description: 'Web research tier that produced the evidence backing '
            + 'this decision. paid = Tavily / Firecrawl / Exa / keyed '
            + 'academic API; native = Anthropic native WebSearch; cache = '
            + 'read from fetched_results.json; derived = post-processor '
            + 'over an upstream fetcher; null = no web research run for '
            + 'this decision (e.g. methodology-only path). Producer: '
            + 'rs-fetcher-* envelope.tier annotation, copied by the '
            + 'decision-trace writer.',
          added_in_plan: '94-05',
        },
        // Other intent_persona fields (not exhaustive; documented elsewhere).
      },
      additionalProperties: true,
    },
  },
  additionalProperties: true,
});

// ---------- Helpers ----------

// Validate a candidate web_research_tier scalar. Returns true on null
// or one of the canonical tier values.
function isValidWebResearchTier(value) {
  if (value === null || value === undefined) return true;
  if (typeof value !== 'string') return false;
  return WEB_RESEARCH_TIERS.indexOf(value) >= 0;
}

// Validate a candidate web research source tag. Returns true on null
// or one of the canonical source values.
function isValidWebResearchSource(value) {
  if (value === null || value === undefined) return true;
  if (typeof value !== 'string') return false;
  return WEB_RESEARCH_SOURCES.indexOf(value) >= 0;
}

// ---------- Exports ----------

module.exports = {
  SECTION_8_TRACE_SCHEMA: SECTION_8_TRACE_SCHEMA,
  WEB_RESEARCH_TIERS: WEB_RESEARCH_TIERS,
  WEB_RESEARCH_SOURCES: WEB_RESEARCH_SOURCES,
  isValidWebResearchTier: isValidWebResearchTier,
  isValidWebResearchSource: isValidWebResearchSource,
  // Convenience field-name constant for downstream writers / readers
  // that want to refer to the new field without a string literal.
  WEB_RESEARCH_TIER_FIELD: 'web_research_tier',
};
