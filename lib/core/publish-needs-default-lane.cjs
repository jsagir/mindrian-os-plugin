/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 173-01 -- publish-needs-default-lane.cjs (R6: persona-adaptive default lane).
 *
 * Maps a USER.md role_blend object -> the lane id the /mos:show selector (173-02)
 * opens first. Per SPEC R6 + Canon Part 2a (persona = role-blend x journey-stage):
 *   founder-dominant   -> 'get-into-world'  (the founder wants it shipped)
 *   researcher-dominant-> 'find-broken'     (the researcher wants the gap)
 *   investor-dominant  -> 'find-broken'     (thesis/red-team IS a find-what's-broken job)
 *   any other / cold-start / empty / all-zero / null -> DEFAULT_LANE ('know-stand')
 *
 * Dominant-role selection MIRRORS lib/core/reverse-salient-persona-suffix.suffixFor
 * VERBATIM (canonical-key filter, positive-weight strict-greater walk over SORTED
 * keys, default on no winner). The lane ids are the 4 frozen ids shared with
 * data/publish-needs.json _lanes; check-publish-needs.cjs validates the map's lane
 * set against the same 4 ids.
 *
 * Pure CJS, zero dependencies, never throws. Canon Part 8: reads no Brain, no
 * network; takes a role_blend OBJECT (the consumer reads USER.md via
 * lib/core/user-md-ops.readUserMd and passes role_blend in), never a path.
 */

'use strict';

// The 4 frozen lane ids -- shared verbatim with data/publish-needs.json _lanes.
const LANES = Object.freeze([
  'know-stand',
  'find-broken',
  'make-land',
  'get-into-world',
]);

// Cold-start / fallback lane (SPEC R6: "Know where I stand").
const DEFAULT_LANE = 'know-stand';

// Frozen role -> lane mapping (R6). Only roles that steer the opening lane appear;
// every other role (operator, mentor, student, domain_expert, ...) falls through
// to DEFAULT_LANE, which is the correct cold-start behavior.
const ROLE_TO_LANE = Object.freeze({
  founder:    'get-into-world',
  researcher: 'find-broken',
  investor:   'find-broken',
});

// Frozen canonical role-key list (alphabetical -- matches the lex tie-break the
// reverse-salient-persona-suffix precedent uses). These are the role_blend keys
// we will consider when picking the dominant role.
const CANONICAL_ROLES = Object.freeze([
  'domain_expert',
  'founder',
  'founder_grant',
  'investor',
  'mentor',
  'operator',
  'researcher',
  'researcher_ind',
  'student',
]);

/**
 * defaultLaneForRoleBlend(roleBlend) -> one of LANES.
 *
 * @param {object|null|undefined} roleBlend
 *   { founder?: number, researcher?: number, investor?: number, ... } per the
 *   Phase 115 USER.md schema.
 * @returns {string} A lane id from LANES; DEFAULT_LANE ('know-stand') on any
 *   failure / cold-start / empty / all-zero / unknown-dominant-role.
 */
function defaultLaneForRoleBlend(roleBlend) {
  try {
    if (roleBlend === null || roleBlend === undefined) return DEFAULT_LANE;
    if (typeof roleBlend !== 'object') return DEFAULT_LANE;

    const keys = Object.keys(roleBlend);
    if (keys.length === 0) return DEFAULT_LANE;

    // Canonical-only candidates with positive numeric weight; lex tie-break by
    // walking SORTED keys with a strict-greater comparison (alphabetical earlier
    // wins on ties because the earlier key was assigned first). Mirrors
    // reverse-salient-persona-suffix.suffixFor verbatim.
    const canonicalSorted = keys
      .filter((k) => CANONICAL_ROLES.indexOf(k) !== -1)
      .sort();

    let best = null;
    let bestWeight = 0;
    for (const k of canonicalSorted) {
      const w = roleBlend[k];
      if (typeof w === 'number' && Number.isFinite(w) && w > bestWeight) {
        best = k;
        bestWeight = w;
      }
    }
    if (best === null || bestWeight <= 0) return DEFAULT_LANE;

    // The dominant role steers the lane only if it is a lane-steering role
    // (founder / researcher / investor). Any other dominant role (operator,
    // mentor, researcher_ind, founder_grant, ...) falls through to DEFAULT_LANE.
    return ROLE_TO_LANE[best] || DEFAULT_LANE;
  } catch (_e) {
    return DEFAULT_LANE;
  }
}

module.exports = {
  defaultLaneForRoleBlend: defaultLaneForRoleBlend,
  LANES: LANES,
  DEFAULT_LANE: DEFAULT_LANE,
};
