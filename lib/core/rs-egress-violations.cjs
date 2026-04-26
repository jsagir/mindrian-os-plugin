/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.2 Plan 01 -- Shared ExternalEgressViolation class.
 *
 * Canon Part 7 (Reuse Before Build): extracted from 89.1's per-module
 * sibling subclasses (rs-domain-analyzer.cjs + rs-query-matrix.cjs)
 * to a single source of truth so 89.2's 3 new external-egress
 * fetchers (academic, patents, industry) consume the same class.
 * The 89.1 sibling subclasses remain valid (back-compat) but
 * NEW callers MUST require this module.
 *
 * Back-compat strategy: 89.1's sibling subclasses in rs-domain-analyzer.cjs
 * (lines 44-50) and rs-query-matrix.cjs (lines 60-66) are NOT modified
 * by this plan. Both continue to work; their stack traces and audit log
 * lines remain unchanged. New code in 89.2 (academic / patents / industry
 * fetchers + the chokepoint helpers in rs-egress-prompts.cjs) MUST
 * require this shared module so the 4-fold drift risk is eliminated at
 * the seam where Wave-2 modules meet. Future cleanup (89.5 or later)
 * may convert the 89.1 siblings to thin re-exports of this shared class
 * once all egress consumers are migrated; that's a non-breaking change
 * because instanceof checks keep working through inheritance.
 *
 * Why a sibling of BrainBoundaryViolation (and not a single shared
 * "BoundaryViolation"): Brain-inbound and external-outbound surfaces
 * are semantically distinct. BrainBoundaryViolation guards inbound
 * queries to the strategic methodology repository; ExternalEgressViolation
 * guards outbound flow to public external fetchers (OpenAlex / arXiv /
 * Tavily / Scopus / PubMed / Patents / Crunchbase). Sharing the class
 * would conflate two different bottlenecks and complicate stack traces.
 *
 * meta convention (informal, not enforced): callers SHOULD populate
 *   meta.surface         (string)  the egress surface tag, e.g. 'academic'
 *   meta.matched_pattern (string)  the FORBIDDEN_PATTERNS regex.source hit
 *   meta.sample          (string)  optional first-40-char excerpt of input
 * These three keys form the audit triple downstream Phase Gate transcripts
 * and the v1.11.0 release-time security audit will scan for. The class
 * itself does not enforce shape so adversarial fixtures can probe edge
 * cases (default meta = {}, omitted meta, etc.) without instantiation
 * fighting them.
 *
 * Pure CJS, zero npm deps, no Node built-ins beyond core require.
 */
'use strict';

class ExternalEgressViolation extends Error {
  constructor(message, meta) {
    super(message);
    this.name = 'ExternalEgressViolation';
    this.meta = meta || {};
  }
}

module.exports = { ExternalEgressViolation };
