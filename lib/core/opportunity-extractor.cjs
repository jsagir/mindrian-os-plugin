/**
 * MindrianOS Plugin -- Opportunity Extraction Engine
 * Converts analyze-room GAP/CONVERGE/CONTRADICT signals into structured
 * opportunity objects with Knight risk/uncertainty classification.
 *
 * Consumes the same signal format that proactive-intelligence.cjs parseAnalyzeOutput() returns.
 * Opportunities persist via bankOpportunity() in opportunity-ops.cjs.
 *
 * Exports: extractOpportunities, opportunityHash, OPPORTUNITY_SCHEMA_FIELDS
 */

'use strict';

/**
 * Universal opportunity schema fields.
 * Every opportunity object MUST have all of these.
 * @type {string[]}
 */
const OPPORTUNITY_SCHEMA_FIELDS = [
  'problem',
  'mirror_solution',
  'domain',
  'evidence',
  'source_framework',
  'knight_position',
  'confidence',
  'created',
  'status',
];

/**
 * Confidence label to numeric mapping.
 * HIGH/MEDIUM/LOW from parseAnalyzeOutput -> 0.8/0.5/0.3.
 */
const CONFIDENCE_MAP = {
  HIGH: 0.8,
  MEDIUM: 0.5,
  LOW: 0.3,
};

/**
 * djb2 hash of a normalized problem string.
 * Normalizes: lowercase, trim, collapse whitespace.
 * Returns hex string for use as dedup key and filename component.
 *
 * @param {string} problem - Problem statement to hash
 * @returns {string} Hex hash string
 */
function opportunityHash(problem) {
  const normalized = (problem || '').toLowerCase().trim().replace(/\s+/g, ' ');
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash + normalized.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

/**
 * Map confidence string to numeric value.
 * HIGH -> 0.8, MEDIUM -> 0.5, LOW -> 0.3.
 * Falls back to parseFloat for numeric strings.
 *
 * @param {string} confidence - Confidence label or numeric string
 * @returns {number}
 */
function mapConfidence(confidence) {
  const upper = (confidence || '').toUpperCase();
  if (CONFIDENCE_MAP[upper] !== undefined) return CONFIDENCE_MAP[upper];
  const parsed = parseFloat(confidence);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Map a GAP insight to an opportunity object.
 * @param {Object} insight - Parsed GAP insight
 * @param {string} frameworkName - Source framework
 * @returns {Object} Opportunity object
 */
function mapGap(insight, frameworkName) {
  const subtypeLabels = {
    structural: 'Add structural coverage for this area',
    semantic: 'Deepen semantic analysis in this domain',
    adjacent: 'Explore adjacent connections to fill this gap',
  };
  return {
    problem: `Missing ${insight.subtype || 'unknown'} coverage in ${insight.section || 'unknown'}: ${insight.message || ''}`,
    mirror_solution: subtypeLabels[insight.subtype] || 'Investigate and fill the identified gap',
    domain: insight.section || 'unknown',
    evidence: insight.message || '',
    source_framework: frameworkName,
    knight_position: 'uncertainty',
    confidence: mapConfidence(insight.confidence),
    created: new Date().toISOString().split('T')[0],
    status: 'banked',
  };
}

/**
 * Map a CONVERGE insight to an opportunity object.
 * @param {Object} insight - Parsed convergence insight
 * @param {string} frameworkName - Source framework
 * @returns {Object} Opportunity object
 */
function mapConvergence(insight, frameworkName) {
  return {
    problem: `Convergence signal in ${insight.term || 'unknown'}: ${insight.message || ''}`,
    mirror_solution: `Leverage convergence across ${insight.count || 'multiple'} sections`,
    domain: insight.term || 'unknown',
    evidence: insight.message || '',
    source_framework: frameworkName,
    knight_position: 'risk',
    confidence: mapConfidence(insight.confidence),
    created: new Date().toISOString().split('T')[0],
    status: 'banked',
  };
}

/**
 * Map a CONTRADICT insight to an opportunity object.
 * @param {Object} insight - Parsed contradiction insight
 * @param {string} frameworkName - Source framework
 * @returns {Object} Opportunity object
 */
function mapContradiction(insight, frameworkName) {
  return {
    problem: `Contradiction between ${insight.section || 'unknown'} and ${insight.section2 || 'unknown'}: ${insight.message || ''}`,
    mirror_solution: 'Resolve contradiction to unlock coherent strategy',
    domain: `${insight.section || 'unknown'}/${insight.section2 || 'unknown'}`,
    evidence: insight.message || '',
    source_framework: frameworkName,
    knight_position: 'mixed',
    confidence: mapConfidence(insight.confidence),
    created: new Date().toISOString().split('T')[0],
    status: 'banked',
  };
}

/**
 * Extract opportunities from parsed analyze-room insights.
 * Takes the same insight format that parseAnalyzeOutput() returns from proactive-intelligence.cjs.
 *
 * @param {Array<{type: string, subtype?: string, section?: string, term?: string, section2?: string, count?: number, confidence: string, message: string}>} insights - Parsed insights
 * @param {string} frameworkName - Name of the framework that produced these insights
 * @param {string} roomDir - Absolute path to room directory (for context, not used for I/O here)
 * @returns {Array<Object>} Array of opportunity objects with all OPPORTUNITY_SCHEMA_FIELDS
 */
function extractOpportunities(insights, frameworkName, roomDir) {
  if (!Array.isArray(insights) || insights.length === 0) return [];

  const opportunities = [];

  for (const insight of insights) {
    let opp = null;

    switch (insight.type) {
      case 'gap':
        opp = mapGap(insight, frameworkName);
        break;
      case 'convergence':
        opp = mapConvergence(insight, frameworkName);
        break;
      case 'contradiction':
        opp = mapContradiction(insight, frameworkName);
        break;
      default:
        // Unknown insight type - skip
        continue;
    }

    // Filter: skip below 0.3 confidence floor (below LOW is noise)
    if (opp.confidence < 0.3) continue;

    opportunities.push(opp);
  }

  return opportunities;
}

module.exports = {
  extractOpportunities,
  opportunityHash,
  OPPORTUNITY_SCHEMA_FIELDS,
};
