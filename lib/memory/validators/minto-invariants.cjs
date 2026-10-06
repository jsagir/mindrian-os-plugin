/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 88-13 first-in validator for the guardian registry.
 *
 * Thin adapter over lib/core/feynman-minto-invariants.cjs so the guardian
 * never requires that module directly. Downstream phases register their
 * own validators by dropping a .cjs file in this directory.
 *
 * Contract (shared with all validators):
 *   module.exports = {
 *     id:           string,     unique registry identifier
 *     severity_map: object,     reference numeric levels per severity name
 *     validate:     function,   (sectionDir) -> { severity, violations[] }
 *   }
 *
 * Each returned violation carries at minimum:
 *   { validator: 'minto-invariants', category, severity, message, field? }
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  validate: invariantsValidate,
  validateFeynmanBudget,
} = require('../../core/feynman-minto-invariants.cjs');

module.exports = {
  id: 'minto-invariants',
  severity_map: { critical: 3, error: 2, warning: 1, info: 0 },
  validate: function (sectionDir) {
    const mintoPath = path.join(sectionDir, 'MINTO.md');
    if (!fs.existsSync(mintoPath)) {
      // MINTO absence is handled by the guardian existence-check layer; this
      // validator is specifically about the content contract of an existing
      // MINTO.md. Returning null + empty here keeps aggregation deterministic.
      return { severity: null, violations: [] };
    }
    let result;
    try {
      result = invariantsValidate(mintoPath);
    } catch (e) {
      // Defensive: the invariants module itself must not crash the guardian.
      return {
        severity: 'error',
        violations: [{
          validator: 'minto-invariants',
          category: 'invariants_module_fault',
          severity: 'error',
          message: 'invariants validate() threw: ' + (e && e.message || String(e)),
        }],
      };
    }
    const violations = ((result && result.violations) || []).slice();
    let severity = result ? result.severity : null;
    // Phase 369.25 plan 12: FEYNMINTO-01 (1500 tokens) now guards the FEYNMAN face;
    // MINTO.md's own budget is FEYNMINTO-12 inside validate() above.
    const feynmanPath = path.join(sectionDir, 'FEYNMAN.md');
    if (fs.existsSync(feynmanPath)) {
      try {
        const fr = validateFeynmanBudget(feynmanPath);
        for (const v of fr.violations) violations.push(v);
        if (fr.severity === 'error' && severity !== 'critical') severity = 'error';
      } catch (e) {
        violations.push({
          category: 'invariants_module_fault',
          severity: 'error',
          message: 'validateFeynmanBudget() threw: ' + (e && e.message || String(e)),
        });
        if (severity !== 'critical') severity = 'error';
      }
    }
    const tagged = violations.map(function (v) {
      return Object.assign({}, v, { validator: 'minto-invariants' });
    });
    return {
      severity: severity,
      violations: tagged,
    };
  },
};
