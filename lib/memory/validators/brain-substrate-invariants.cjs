/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.1a Plan 02 -- Brain methodology substrate invariants validator.
 *
 * Registry-compatible drop-in for the Phase 88-13 guardian. Auto-
 * discovered by scripts/feynman-minto-guardian.cjs's validator loader
 * (walks lib/memory/validators/*.cjs). Zero guardian.cjs edits needed.
 *
 * Contract (see lib/memory/validators/README.md):
 *   module.exports = {
 *     id:           'brain-substrate-invariants',
 *     severity_map: { critical, error, warning, info },
 *     scope:        'room',
 *     validate(roomPath, ctx) -> { severity, violations[] },
 *   }
 *
 * Five checks:
 *   A) Cache missing -> zero violations (valid default)
 *   B) Cache unreadable / malformed / schema_version drift -> warning
 *   C) Cache substrate.length != embedding_count -> critical (partial pull, Pitfall 5)
 *   D) Cache substrate[].metadata body contains forbidden regex hit -> critical
 *      (Canon Part 8 Part 8 attack surface; Pitfall 4)
 *   E) Cache substrate[].embedding.length != 1024 OR non-finite values
 *      OR substrate[].id fails slug regex -> critical (shape corruption)
 *
 * Fail-open: unexpected throws are caught by the guardian's validator
 * runner. This validator does not swallow its own exceptions; the
 * guardian owns that contract. Individual I/O paths (readFileSync) are
 * wrapped defensively so a missing cache never produces a violation.
 *
 * Pure CJS, node built-ins only + re-export of prompts module for
 * FORBIDDEN_PATTERNS + SLUG_REGEX parity. Importing the canonical
 * vocabulary (rather than redefining) ensures any Canon Part 8
 * amendment at lib/core/cross-room-aggregator.cjs propagates through
 * lib/core/rs-brain-substrate-prompts.cjs to this validator with zero
 * code change.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const prompts = require('../../core/rs-brain-substrate-prompts.cjs');
const { FORBIDDEN_PATTERNS, SLUG_REGEX } = prompts;

// ---------- Constants ----------

const SEVERITY_MAP = Object.freeze({ critical: 3, error: 2, warning: 1, info: 0 });
const EXPECTED_EMBEDDING_DIM = 1024;
const CACHE_SCHEMA_VERSION = '1.0';
// Cap canon_boundary hits per validate() invocation so one poisoned
// cache cannot spam the invariant report. Five matches is the same
// threshold Plan 90-05 brain-md-invariants uses.
const MAX_CANON_HITS_REPORTED = 5;

// ---------- Severity aggregator ----------

function aggregateSeverity(violations) {
  if (!violations || violations.length === 0) return null;
  let max = 0;
  const inv = { 0: 'info', 1: 'warning', 2: 'error', 3: 'critical' };
  for (const v of violations) {
    const s = SEVERITY_MAP[v.severity];
    if (typeof s === 'number' && s > max) max = s;
  }
  return inv[max];
}

// ---------- validate (Checks A-E) ----------

function validate(roomPath, _ctx) {
  const violations = [];

  // Defensive guard: non-string roomPath -> zero violations (guardian
  // always passes a string, but the contract demands a structured
  // result on every path).
  if (typeof roomPath !== 'string' || roomPath.length === 0) {
    return { severity: null, violations: [] };
  }

  const cachePath = path.join(roomPath, '.mindrian', 'brain-substrate-cache.json');

  // --- Check A: cache absent -> zero violations (healthy default) ---
  if (!fs.existsSync(cachePath)) {
    return { severity: null, violations: [] };
  }

  // --- Check B: unreadable / malformed / schema drift ---
  let payload = null;
  try {
    const raw = fs.readFileSync(cachePath, 'utf8');
    payload = JSON.parse(raw);
  } catch (err) {
    violations.push({
      category: 'cache_unreadable',
      severity: 'warning',
      message: 'brain-substrate-cache.json unreadable: ' + String(err && err.message),
      action_hint: 'invalidate_cache',
    });
    return { severity: aggregateSeverity(violations), violations };
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    violations.push({
      category: 'cache_malformed_root',
      severity: 'warning',
      message: 'brain-substrate-cache.json root is not a plain object',
      action_hint: 'invalidate_cache',
    });
    return { severity: aggregateSeverity(violations), violations };
  }

  if (payload.schema_version !== CACHE_SCHEMA_VERSION) {
    violations.push({
      category: 'cache_schema_drift',
      severity: 'warning',
      message: 'schema_version expected ' + CACHE_SCHEMA_VERSION +
               ' got ' + String(payload.schema_version),
      action_hint: 'invalidate_cache',
    });
  }

  if (!Array.isArray(payload.substrate)) {
    violations.push({
      category: 'cache_malformed_substrate',
      severity: 'critical',
      message: 'substrate is not an array',
      action_hint: 'invalidate_cache',
    });
    return { severity: aggregateSeverity(violations), violations };
  }

  // --- Check C: completeness (embedding_count vs substrate.length) ---
  // Pitfall 5 partial-pull completeness guard. Defense-in-depth against
  // the reader-side check in lib/core/rs-brain-substrate.cjs readCache;
  // either layer alone blocks a partial cache.
  if (typeof payload.embedding_count === 'number' &&
      payload.substrate.length !== payload.embedding_count) {
    violations.push({
      category: 'cache_partial_pull',
      severity: 'critical',
      message: 'embedding_count ' + payload.embedding_count +
               ' != substrate.length ' + payload.substrate.length,
      action_hint: 'invalidate_cache',
    });
  }

  // --- Checks D + E: per-entry body scan + shape assertion ---
  let canonHitCount = 0;
  for (let i = 0; i < payload.substrate.length; i += 1) {
    const entry = payload.substrate[i];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      violations.push({
        category: 'substrate_entry_malformed',
        severity: 'critical',
        message: 'substrate[' + i + '] is not an object',
        action_hint: 'invalidate_cache',
      });
      continue;
    }

    // Check E.1: id slug regex
    if (typeof entry.id !== 'string' || !SLUG_REGEX.test(entry.id)) {
      violations.push({
        category: 'substrate_entry_bad_id',
        severity: 'critical',
        message: 'substrate[' + i + '].id fails slug regex',
        field: 'substrate[' + i + '].id',
        action_hint: 'invalidate_cache',
      });
    }

    // Check E.2: embedding dim
    if (!Array.isArray(entry.embedding) ||
        entry.embedding.length !== EXPECTED_EMBEDDING_DIM) {
      violations.push({
        category: 'substrate_entry_bad_embedding_dim',
        severity: 'critical',
        message: 'substrate[' + i + '].embedding.length != ' +
                 EXPECTED_EMBEDDING_DIM,
        field: 'substrate[' + i + '].embedding',
        action_hint: 'invalidate_cache',
      });
    } else {
      // Check E.3: embedding must be all finite numbers
      for (let j = 0; j < entry.embedding.length; j += 1) {
        const val = entry.embedding[j];
        if (typeof val !== 'number' || !Number.isFinite(val)) {
          violations.push({
            category: 'substrate_entry_bad_embedding_value',
            severity: 'critical',
            message: 'substrate[' + i + '].embedding[' + j + '] non-finite',
            field: 'substrate[' + i + '].embedding[' + j + ']',
            action_hint: 'invalidate_cache',
          });
          break; // one report per entry is enough
        }
      }
    }

    // Check D: Canon Part 8 metadata body scan (Pitfall 4 attack surface).
    // JSON.stringify the metadata so nested strings are visible to
    // FORBIDDEN_PATTERNS. Cap at MAX_CANON_HITS_REPORTED overall to
    // avoid report spam from a fully-poisoned cache.
    if (canonHitCount < MAX_CANON_HITS_REPORTED &&
        entry.metadata && typeof entry.metadata === 'object') {
      const s = JSON.stringify(entry.metadata);
      for (const re of FORBIDDEN_PATTERNS) {
        if (re.test(s)) {
          violations.push({
            category: 'canon_boundary',
            severity: 'critical',
            message: 'substrate[' + i + '].metadata matched forbidden regex ' +
                     re.source,
            field: 'substrate[' + i + '].metadata',
            action_hint: 'invalidate_cache',
          });
          canonHitCount += 1;
          break; // one match per entry is enough to fail the entry
        }
      }
    }
  }

  return { severity: aggregateSeverity(violations), violations };
}

// ---------- Exports ----------

module.exports = {
  id: 'brain-substrate-invariants',
  severity_map: SEVERITY_MAP,
  scope: 'room',
  validate,
  // Exported for downstream introspection + Phase 89.1a Plan 03
  // adversarial fixture suite. Not required by the registry loader.
  EXPECTED_EMBEDDING_DIM,
  CACHE_SCHEMA_VERSION,
  MAX_CANON_HITS_REPORTED,
};
