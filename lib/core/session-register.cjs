'use strict';
/*
 * lib/core/session-register.cjs -- role_blend -> session-register resolver.
 * =========================================================================
 * Phase 204 roadmap branch (3): "the persona chosen at ignite (Phase 115
 * role_blend) SETS THE CONVERSATION REGISTER for the session." This is the
 * FUNCTIONAL-role axis (founder / researcher / operator / investor / mentor /
 * domain_expert / student, picked explicitly at ignite's B1). It is
 * deliberately ORTHOGONAL to the separate COMPETENCE-LEVEL axis (student /
 * practitioner / researcher / professor) shipped in persona-taxonomy.cjs
 * (ROLE_LEVELS / resolveElevationLean, Phase 205-05); this module does not
 * touch that axis.
 *
 * role_blend threads end-to-end into USER.md at birthRoom time (Phase 115,
 * lib/core/navigation/room-birth.cjs); shape-f1-renderer.cjs has carried an
 * UNWIRED `personaContext` parameter since Phase 88.2-03 ("the dispatcher
 * supplies the pre-computed string from readUserMd().role_blend"). No caller
 * ever computed that string. This module is exactly that missing resolver.
 *
 * Pure functions, zero I/O, zero npm deps, zero Brain reach (Canon Part 8:
 * LOCAL-only). It takes a role_blend OBJECT as input (a live readUserMd()
 * result OR a fixture) so callers own the USER.md read. The 7-key role
 * vocabulary and its display forms are NOT re-declared here -- they are the
 * two frozen, positionally-aligned sources of truth reused verbatim:
 *   - ROLE_BLEND_KEYS (persona-override.cjs): founder, researcher, operator,
 *     investor, mentor, domain_expert, student.
 *   - ROLE_BLEND_AXES (persona-taxonomy.cjs): Founder, Researcher, Operator,
 *     Investor, Mentor, Domain Expert, Student.
 *
 * Hyphens only, no em-dashes.
 */

const { ROLE_BLEND_KEYS } = require('./persona-override.cjs');
const { ROLE_BLEND_AXES } = require('./persona-taxonomy.cjs');

/**
 * True only for a plain object (not null, not an array, not a boxed string).
 * @param {*} v
 * @returns {boolean}
 */
function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * resolveTopRole -- pick the strictly-greatest-weight role.
 *
 * `role_blend` is expected to be an object keyed by the 7 ROLE_BLEND_KEYS with
 * numeric weights (the shape emptyUser().role_blend produces). Returns the key
 * (in ROLE_BLEND_KEYS declaration order for tie-breaking) with the strictly
 * greatest finite positive weight. Returns null when `role_blend` is not a
 * plain object, has no numeric weights, or every weight is <= 0 (cold start --
 * never fabricate a default persona).
 *
 * @param {object} role_blend
 * @returns {string|null}
 */
function resolveTopRole(role_blend) {
  if (!isPlainObject(role_blend)) return null;
  let bestKey = null;
  let bestWeight = 0; // strictly greater than 0 required to win.
  for (const key of ROLE_BLEND_KEYS) {
    const w = role_blend[key];
    if (typeof w !== 'number' || !Number.isFinite(w)) continue;
    // Strictly-greater keeps the first-declared key on a tie (declaration
    // order tie-break), because a later equal weight does not displace it.
    if (w > bestWeight) {
      bestWeight = w;
      bestKey = key;
    }
  }
  return bestKey;
}

/**
 * displayNameForRole -- coerce a role key to its display form.
 *
 * Looks up `roleKey`'s index in ROLE_BLEND_KEYS and returns the SAME index of
 * ROLE_BLEND_AXES (e.g. 'domain_expert' -> 'Domain Expert'). Returns null on an
 * unknown/absent key. Derived from the two frozen arrays' positional alignment;
 * no second key->display table is declared.
 *
 * @param {string} roleKey
 * @returns {string|null}
 */
function displayNameForRole(roleKey) {
  if (typeof roleKey !== 'string') return null;
  const i = ROLE_BLEND_KEYS.indexOf(roleKey);
  if (i < 0) return null;
  const display = ROLE_BLEND_AXES[i];
  return typeof display === 'string' ? display : null;
}

/**
 * composePersonaContext -- the display-form string for renderShapeF1.
 *
 * Returns displayNameForRole(resolveTopRole(role_blend)) -- i.e. null on cold
 * start, else the display-form string ready to hand straight into
 * renderShapeF1's `personaContext` parameter (which no-ops on null/empty, per
 * its own cold-start byte-for-byte contract).
 *
 * @param {object} role_blend
 * @returns {string|null}
 */
function composePersonaContext(role_blend) {
  return displayNameForRole(resolveTopRole(role_blend));
}

/**
 * resolveSessionRegister -- the full session-register object.
 *
 * Returns null on cold start (resolveTopRole is null). Otherwise returns
 * { role_key, display_name, persona_variant_key, weight } where
 * persona_variant_key is the identity-mapped role_key (the 7 ROLE_BLEND_KEYS
 * values are already 7 of the 10 keys in larry-extended.md's persona_variants
 * map) and weight is the winning numeric weight. Plan 204-03 threads this into
 * ignite.md's B1/B3 wiring and the room-resume greeting.
 *
 * @param {object} role_blend
 * @returns {{role_key: string, display_name: string, persona_variant_key: string, weight: number}|null}
 */
function resolveSessionRegister(role_blend) {
  const role_key = resolveTopRole(role_blend);
  if (role_key === null) return null;
  return {
    role_key,
    display_name: displayNameForRole(role_key),
    persona_variant_key: role_key,
    weight: role_blend[role_key],
  };
}

module.exports = {
  resolveTopRole,
  displayNameForRole,
  composePersonaContext,
  resolveSessionRegister,
};
