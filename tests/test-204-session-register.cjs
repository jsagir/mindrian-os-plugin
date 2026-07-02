'use strict';
/*
 * Phase 204-02 -- unit tests for lib/core/session-register.cjs.
 * =========================================================================
 * The role_blend -> session-register resolver. role_blend (Phase 115, the
 * FUNCTIONAL-role axis picked at ignite's B1) is a 7-key numeric weight map;
 * this resolver picks the strictly-greatest-weight role, coerces it to its
 * display form, and returns the full session-register object Plan 204-03
 * threads into ignite.md's B1/B3 wiring.
 *
 * Coverage:
 *   - resolveTopRole: clear single winner; tie -> ROLE_BLEND_KEYS declaration
 *     order tie-break; all-zero -> null (cold start, never fabricate);
 *     missing/undefined -> null; malformed (string, array) -> null, never
 *     throws (T-204-04).
 *   - displayNameForRole: every one of the 7 valid keys -> its axis form;
 *     unknown key -> null.
 *   - composePersonaContext: null on cold start; display string otherwise.
 *   - resolveSessionRegister: full four-field shape on a representative blend;
 *     null on cold start.
 *
 * Pure, zero I/O, zero Brain (Part 8). Hyphens only, no em-dashes.
 */

const assert = require('node:assert');

const {
  resolveTopRole,
  displayNameForRole,
  composePersonaContext,
  resolveSessionRegister,
} = require('../lib/core/session-register.cjs');

// The two frozen sources of truth this module reuses (never re-declared here).
const { ROLE_BLEND_KEYS } = require('../lib/core/persona-override.cjs');
const { ROLE_BLEND_AXES } = require('../lib/core/persona-taxonomy.cjs');

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass += 1; }
function eq(name, actual, expected) {
  assert.deepStrictEqual(actual, expected, name);
  console.log('  ok - ' + name);
  pass += 1;
}

// Build a full 7-key zero blend then overlay weights, mirroring the shape
// emptyUser().role_blend produces in user-md-ops.cjs.
function blend(overlay) {
  const b = {};
  for (const k of ROLE_BLEND_KEYS) b[k] = 0;
  return Object.assign(b, overlay);
}

// --------------------------------------------------------------------------
// resolveTopRole
// --------------------------------------------------------------------------
eq('resolveTopRole: clear single winner (investor)',
  resolveTopRole(blend({ founder: 0.2, investor: 0.8 })), 'investor');

eq('resolveTopRole: winner among several positives',
  resolveTopRole(blend({ founder: 0.1, researcher: 0.3, mentor: 0.9, student: 0.4 })), 'mentor');

// founder (index 0) and researcher (index 1) tie: declaration order wins.
eq('resolveTopRole: tie -> ROLE_BLEND_KEYS declaration order (founder before researcher)',
  resolveTopRole(blend({ founder: 0.5, researcher: 0.5 })), 'founder');

// operator (index 2) and investor (index 3) tie: operator wins on order.
eq('resolveTopRole: tie -> operator before investor',
  resolveTopRole(blend({ operator: 0.7, investor: 0.7 })), 'operator');

eq('resolveTopRole: all-zero blend -> null (cold start, never fabricate)',
  resolveTopRole(blend({})), null);

eq('resolveTopRole: undefined -> null', resolveTopRole(undefined), null);
eq('resolveTopRole: null -> null', resolveTopRole(null), null);
eq('resolveTopRole: string (malformed) -> null, no throw', resolveTopRole('founder'), null);
eq('resolveTopRole: array (malformed) -> null, no throw', resolveTopRole([1, 2, 3]), null);
eq('resolveTopRole: empty object -> null', resolveTopRole({}), null);
eq('resolveTopRole: negative-only weights -> null',
  resolveTopRole(blend({ founder: -0.3, investor: -0.9 })), null);
eq('resolveTopRole: non-numeric weights ignored -> null',
  resolveTopRole({ founder: 'high', investor: 'low' }), null);
eq('resolveTopRole: NaN weights ignored -> null',
  resolveTopRole(blend({ founder: NaN, investor: NaN })), null);

// --------------------------------------------------------------------------
// displayNameForRole -- every valid key + one unknown
// --------------------------------------------------------------------------
ROLE_BLEND_KEYS.forEach((key, i) => {
  eq('displayNameForRole: ' + key + ' -> ' + ROLE_BLEND_AXES[i],
    displayNameForRole(key), ROLE_BLEND_AXES[i]);
});
eq('displayNameForRole: unknown key -> null', displayNameForRole('philosopher'), null);
eq('displayNameForRole: undefined -> null', displayNameForRole(undefined), null);
eq('displayNameForRole: non-string -> null', displayNameForRole(42), null);

// --------------------------------------------------------------------------
// composePersonaContext
// --------------------------------------------------------------------------
eq('composePersonaContext: winner -> display string',
  composePersonaContext(blend({ domain_expert: 0.9, founder: 0.1 })), 'Domain Expert');
eq('composePersonaContext: cold start -> null', composePersonaContext(blend({})), null);
eq('composePersonaContext: malformed -> null', composePersonaContext('nope'), null);

// --------------------------------------------------------------------------
// resolveSessionRegister -- full four-field shape
// --------------------------------------------------------------------------
const reg = resolveSessionRegister(blend({ founder: 0.2, investor: 0.8, mentor: 0.1 }));
eq('resolveSessionRegister: role_key', reg.role_key, 'investor');
eq('resolveSessionRegister: display_name', reg.display_name, 'Investor');
eq('resolveSessionRegister: persona_variant_key (identity map)', reg.persona_variant_key, 'investor');
eq('resolveSessionRegister: weight (winning numeric weight)', reg.weight, 0.8);
ok('resolveSessionRegister: exactly four fields',
  Object.keys(reg).sort().join(',') === 'display_name,persona_variant_key,role_key,weight');

eq('resolveSessionRegister: cold start -> null', resolveSessionRegister(blend({})), null);
eq('resolveSessionRegister: malformed -> null', resolveSessionRegister([]), null);

console.log('\nAll ' + pass + ' session-register assertions passed.');
