/**
 * MindrianOS Plugin -- Futures Wheel orchestrator (Phase 156, Wave 1 shell)
 *
 * This is the interface-first SHELL for the /mos:futures pipeline. It owns the
 * consequence frontmatter CONTRACT (horizon / confidence / PESTEL domain) and the
 * bounded depth / fan-out cap CONSTANTS that the later waves build against, so
 * Wave 2 receives the contract in-hand and never explores for it.
 *
 * Wave 1 scope (this file): the cap constants, the two frozen enums, and
 * validateConsequenceFrontmatter (FW-04). ZERO graph writes, ZERO HSI surface,
 * ZERO Larry generation loop -- those land in Waves 2-4 (clearly labeled stubs
 * below). Canon Part 8: everything local, zero Brain egress.
 *
 * Pure Node.js built-ins only (zero npm deps per Phase 10 decision).
 * Reuses opportunity-ops.parseFrontmatter for any frontmatter parsing
 * (Part 7: do NOT hand-roll a YAML parser).
 */

'use strict';

const { parseFrontmatter } = require('../opportunity-ops.cjs');

// --- Bounded caps (FW-02) ---
// The wheel "explodes in complexity, mathematically unmanageable without
// software" -- these caps keep it tractable. Navigator-overridable, but every
// override is CLAMPED to the cap maximum (a navigator may shrink, never exceed).
const FUTURES_DEPTH_CAP = 3;   // default + maximum number of rings
const FUTURES_FANOUT_CAP = 5;  // default + maximum children per node

// --- Frozen enums (FW-04) ---
const HORIZON_ENUM = Object.freeze(['near', 'mid', 'long']);
const PESTEL_DOMAIN_ENUM = Object.freeze([
  'Political',
  'Economic',
  'Social',
  'Technological',
  'Environmental',
  'Legal',
]);

/**
 * Resolve the effective depth cap, clamping a navigator override to the maximum.
 * A navigator may request fewer rings; never more than FUTURES_DEPTH_CAP.
 *
 * @param {Object} [opts]
 * @param {number} [opts.depth] - requested ring depth
 * @returns {number} effective depth (1..FUTURES_DEPTH_CAP)
 */
function resolveDepthCap(opts) {
  opts = opts || {};
  const requested = Number.isFinite(opts.depth) ? Math.floor(opts.depth) : FUTURES_DEPTH_CAP;
  if (requested < 1) return 1;
  if (requested > FUTURES_DEPTH_CAP) return FUTURES_DEPTH_CAP;
  return requested;
}

/**
 * Resolve the effective fan-out cap, clamping a navigator override to the maximum.
 *
 * @param {Object} [opts]
 * @param {number} [opts.fanout] - requested per-node fan-out
 * @returns {number} effective fan-out (1..FUTURES_FANOUT_CAP)
 */
function resolveFanoutCap(opts) {
  opts = opts || {};
  const requested = Number.isFinite(opts.fanout) ? Math.floor(opts.fanout) : FUTURES_FANOUT_CAP;
  if (requested < 1) return 1;
  if (requested > FUTURES_FANOUT_CAP) return FUTURES_FANOUT_CAP;
  return requested;
}

/**
 * Validate a consequence frontmatter object against the FW-04 contract:
 *   - horizon is in HORIZON_ENUM
 *   - confidence is a float in the inclusive range 0.0-1.0
 *   - domain is in PESTEL_DOMAIN_ENUM
 *
 * Advisory-free: this is a hard structural validator (the contract Wave 2's
 * generation loop writes against). It NEVER mutates the input.
 *
 * @param {Object} fm - the consequence frontmatter object (or a parsed string)
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateConsequenceFrontmatter(fm) {
  const errors = [];

  // Accept a raw markdown/frontmatter string by reusing the shipped parser.
  if (typeof fm === 'string') {
    fm = parseFrontmatter(fm);
  }
  if (!fm || typeof fm !== 'object') {
    return { valid: false, errors: ['frontmatter is not an object'] };
  }

  // horizon: enum
  if (!HORIZON_ENUM.includes(fm.horizon)) {
    errors.push(
      'horizon must be one of ' + HORIZON_ENUM.join(' / ') + ' (got ' + String(fm.horizon) + ')'
    );
  }

  // confidence: float in [0.0, 1.0]
  const conf = fm.confidence;
  if (typeof conf !== 'number' || Number.isNaN(conf)) {
    errors.push('confidence must be a number (got ' + String(conf) + ')');
  } else if (conf < 0 || conf > 1) {
    errors.push('confidence must be in the inclusive range 0.0-1.0 (got ' + conf + ')');
  }

  // domain: enum
  if (!PESTEL_DOMAIN_ENUM.includes(fm.domain)) {
    errors.push(
      'domain must be one of ' + PESTEL_DOMAIN_ENUM.join(' / ') + ' (got ' + String(fm.domain) + ')'
    );
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Wave 2-4 surface (STUBS -- not implemented in Wave 1)
//
// These functions are the seams the later waves fill. They are declared here so
// the contract is visible, but they intentionally do NOTHING in Wave 1 (zero
// graph writes, zero HSI surface). DO NOT implement them in this wave.
// ---------------------------------------------------------------------------

/**
 * Wave 2: generate one ring of consequences (Larry-driven), bounded by the caps.
 * Implemented in Wave 2 (guided-by-ring generation loop, FW-02).
 */
function generateRing() {
  throw new Error('generateRing is implemented in Wave 2 (FW-02); not available in the Wave 1 shell');
}

/**
 * Wave 2-3: file + register consequences as Artifact nodes, then run the HSI
 * scan (compute-hsi.py -> hsi-to-graph.cjs) and write cascade edges.
 * Implemented in Wave 2-3 (FW-05 / FW-06).
 */
function fileAndScan() {
  throw new Error('fileAndScan is implemented in Wave 2-3 (FW-05/FW-06); not available in the Wave 1 shell');
}

/**
 * Wave 3: run the per-ring Decision Gate (proposed -> confirmed via confirmNode).
 * Implemented in Wave 3 (FW-10, Part 9).
 */
function runRingGate() {
  throw new Error('runRingGate is implemented in Wave 3 (FW-10); not available in the Wave 1 shell');
}

module.exports = {
  // caps (FW-02)
  FUTURES_DEPTH_CAP,
  FUTURES_FANOUT_CAP,
  resolveDepthCap,
  resolveFanoutCap,
  // enums (FW-04)
  HORIZON_ENUM,
  PESTEL_DOMAIN_ENUM,
  // validator (FW-04)
  validateConsequenceFrontmatter,
  // Wave 2-4 stubs (not implemented in Wave 1)
  generateRing,
  fileAndScan,
  runRingGate,
};
