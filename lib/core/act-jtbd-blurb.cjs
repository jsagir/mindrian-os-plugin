'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 172-09 -- the LOCAL JTBD-blurb generator (INV-19 / D-172-j).
 * =================================================================
 * The always-on /mos:act standing suggestion (Phase 172-09, Canon Part 11
 * INV-19) renders a JTBD-contextualized blurb: WHAT /mos:act would do in this
 * problem-state, WHAT it helps with, and HOW (which framework/chain it would
 * run and why). This module composes that blurb from LOCAL state ONLY.
 *
 * Canon Part 8 (Graph Boundary) -- the load-bearing constraint:
 *   The blurb is composed LOCALLY. Inputs are the active JTBD (enum id +
 *   one_line from jtbd-taxonomy.json), STATE.md scalars (stage / problem-type
 *   / weakest-section), MINTO.md scalars (governing-thought presence / open
 *   tension count), and the framework/chain NAME from recommendFrameworkChain
 *   (framework names + problem-type enums only -- never user content). This
 *   module makes ZERO Brain/network calls: no fetch, no http, no brain-client
 *   require, no await. recommendFrameworkChain is itself synchronous and
 *   LOCAL-only (it walks already-parsed FEEDS_INTO edges; the live Brain branch
 *   is the 122-04 async path which this synchronous caller never reaches). A
 *   source-grep tripwire in the test asserts zero Brain tokens.
 *
 * Canon Part 11 INV-19: the blurb is render-only metadata for the pinned act
 * row. It carries ONLY enum/scalar + local-derived text. The "how" line names
 * a framework + a problem-type enum, never a user artifact, number, or name.
 *
 * Tier-0 resilient (Canon Part 3): with null/absent JTBD/STATE/MINTO the
 * generator degrades to a generic act blurb. It NEVER throws.
 *
 * No em-dashes anywhere (project hard rule). Hyphens only.
 *
 * Public API:
 *   buildActBlurb({ jtbd, state, minto, roomState? }) -> { what, helps_with, how }
 *
 * License: BSL 1.1.
 */

const path = require('node:path');

// recommendFrameworkChain is synchronous and LOCAL-only (it walks already-parsed
// FEEDS_INTO edges supplied via roomState; the live-Brain branch is the async
// 122-04 path this synchronous caller never reaches). We require it for the
// "how" line (framework names + problem-type enums only, Part 8). The require is
// guarded: a load failure degrades to the generic "how" line, never throws.
let _recommender = null;
function _loadRecommender() {
  if (_recommender !== null) return _recommender;
  try {
    _recommender = require(path.join(__dirname, '..', 'brain', 'chain-recommender.cjs'));
  } catch (_e) {
    _recommender = false; // sentinel: tried and failed
  }
  return _recommender;
}

// The generic, JTBD-agnostic blurb. The deepest degradation rung (Tier 0): no
// active JTBD, no STATE, no MINTO. Still truthful about what /mos:act does.
const GENERIC_BLURB = Object.freeze({
  what: 'Run the next move Larry recommends, without typing the /mos: command yourself.',
  helps_with: 'Keeping momentum when you know roughly where to go but not which command gets you there.',
  how: 'Larry picks the framework that fits your current room state and runs it through the governed path.',
});

function _isObj(v) { return v && typeof v === 'object'; }

// Pull the active JTBD enum id + one_line out of whatever shape the caller
// passed. Accepts:
//   - a jtbd-state getCurrent() row: { jtbd: '<id>', ... }
//   - a pre-resolved taxonomy entry: { id, one_line }
//   - a bare string id
// Returns { id, one_line } or null. Never throws.
function _resolveJtbd(jtbd) {
  if (!jtbd) return null;
  if (typeof jtbd === 'string' && jtbd.trim().length > 0) {
    return { id: jtbd.trim(), one_line: null };
  }
  if (_isObj(jtbd)) {
    const id = (typeof jtbd.jtbd === 'string' && jtbd.jtbd.trim().length > 0)
      ? jtbd.jtbd.trim()
      : (typeof jtbd.id === 'string' && jtbd.id.trim().length > 0 ? jtbd.id.trim() : null);
    if (!id) return null;
    const one_line = (typeof jtbd.one_line === 'string' && jtbd.one_line.trim().length > 0)
      ? jtbd.one_line.trim() : null;
    return { id: id, one_line: one_line };
  }
  return null;
}

// Pull the STATE scalars the blurb needs (stage / problem_type / weakest_section).
// Accepts a parsed object { stage?, problem_type?, weakest_section? } or null.
// Enum/scalar ONLY -- never raw STATE.md body text. Never throws.
function _resolveState(state) {
  if (!_isObj(state)) return { stage: null, problem_type: null, weakest_section: null };
  const pick = (k1, k2) => {
    const v = (typeof state[k1] === 'string' && state[k1].trim().length > 0) ? state[k1].trim()
      : (typeof state[k2] === 'string' && state[k2].trim().length > 0 ? state[k2].trim() : null);
    return v;
  };
  return {
    stage: pick('stage', 'journey_stage'),
    problem_type: pick('problem_type', 'problemType'),
    weakest_section: pick('weakest_section', 'weakestSection'),
  };
}

// Pull the MINTO scalars (governing-thought presence + open-tension count).
// Accepts { governing_thought?, open_tensions? } where open_tensions may be a
// count or an array. Scalar ONLY (a boolean presence flag + an integer count) --
// never the governing-thought prose or the tension bodies. Never throws.
function _resolveMinto(minto) {
  if (!_isObj(minto)) return { has_governing_thought: false, open_tension_count: 0 };
  const gt = minto.governing_thought;
  const has_gt = typeof gt === 'string' ? gt.trim().length > 0 : !!gt;
  let count = 0;
  const ot = minto.open_tensions;
  if (typeof ot === 'number' && isFinite(ot) && ot > 0) count = Math.floor(ot);
  else if (Array.isArray(ot)) count = ot.length;
  return { has_governing_thought: has_gt, open_tension_count: count };
}

// Compose the "how" line: which framework/chain act would run + why. Framework
// names + problem-type enum ONLY (Part 8). Degrades to the generic how line when
// the recommender is unavailable or returns nothing useful.
function _composeHow(jtbdId, problemType, roomState) {
  const rec = _loadRecommender();
  let chain = null;
  if (rec && typeof rec.recommendFrameworkChain === 'function') {
    try {
      chain = rec.recommendFrameworkChain({
        problemType: problemType || undefined,
        roomState: _isObj(roomState) ? roomState : (jtbdId ? { activeJtbd: jtbdId } : {}),
      });
    } catch (_e) {
      chain = null;
    }
  }
  if (!Array.isArray(chain) || chain.length === 0
      || typeof chain[0] !== 'string' || chain[0].length === 0) {
    return GENERIC_BLURB.how;
  }
  const seed = chain[0];
  const rest = chain.slice(1).filter((x) => typeof x === 'string' && x.length > 0);
  const ptClause = problemType ? (' for your ' + problemType + ' problem') : '';
  if (rest.length === 0) {
    return 'Larry would run ' + seed + ptClause
      + ', because that is the framework your room state points to next.';
  }
  return 'Larry would run ' + seed + ptClause + ', then chain into '
    + rest.join(' then ')
    + ', because that sequence fits where your room state is now.';
}

// Compose the "what" + "helps_with" lines from the active JTBD + STATE/MINTO
// scalars. All local-derived text; no Brain, no user content.
function _composeWhatAndHelps(jtbd, state, minto) {
  if (!jtbd) {
    return { what: GENERIC_BLURB.what, helps_with: GENERIC_BLURB.helps_with };
  }
  const jobPhrase = jtbd.one_line
    ? jtbd.one_line.replace(/\.$/, '')
    : ('your current job (' + jtbd.id + ')');

  const what = 'Run the next move toward ' + _lowerFirst(jobPhrase)
    + ', without typing the /mos: command yourself.';

  // helps_with leans on STATE/MINTO scalars when present (a weakest section, a
  // stage, an open-tension count) -- otherwise a generic momentum line.
  let helps;
  if (state && state.weakest_section) {
    helps = 'Closing the gap in your ' + state.weakest_section
      + ' section, the part of the room that is lagging right now.';
  } else if (minto && minto.open_tension_count > 0) {
    helps = 'Working through the ' + minto.open_tension_count
      + ' open tension' + (minto.open_tension_count === 1 ? '' : 's')
      + ' MINTO is tracking, one governed move at a time.';
  } else if (state && state.stage) {
    helps = 'Moving you forward from the ' + state.stage
      + ' stage without losing track of what is already decided.';
  } else {
    helps = GENERIC_BLURB.helps_with;
  }
  return { what: what, helps_with: helps };
}

function _lowerFirst(s) {
  if (typeof s !== 'string' || s.length === 0) return s;
  // Only lower the first char if it is not part of an acronym (next char lower).
  if (s.length > 1 && s[1] === s[1].toUpperCase() && s[1] !== s[1].toLowerCase()) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/**
 * buildActBlurb({ jtbd, state, minto, roomState? }) -> { what, helps_with, how }
 *
 * Pure / synchronous / LOCAL-only. Composes the per-state /mos:act standing
 * suggestion blurb from the active JTBD + STATE.md + MINTO.md scalars and the
 * recommendFrameworkChain framework names (problem-type enums only). Makes ZERO
 * Brain/network calls. Tier-0 resilient: with null/absent inputs it returns the
 * generic act blurb. NEVER throws.
 *
 * @param {{ jtbd?: any, state?: object, minto?: object, roomState?: object }} [opts]
 * @returns {{ what: string, helps_with: string, how: string }}
 */
function buildActBlurb(opts) {
  try {
    const o = _isObj(opts) ? opts : {};
    const jtbd = _resolveJtbd(o.jtbd);
    const state = _resolveState(o.state);
    const minto = _resolveMinto(o.minto);

    const wh = _composeWhatAndHelps(jtbd, state, minto);
    const how = _composeHow(jtbd ? jtbd.id : null, state.problem_type, o.roomState);

    return {
      what: typeof wh.what === 'string' && wh.what.length > 0 ? wh.what : GENERIC_BLURB.what,
      helps_with: typeof wh.helps_with === 'string' && wh.helps_with.length > 0
        ? wh.helps_with : GENERIC_BLURB.helps_with,
      how: typeof how === 'string' && how.length > 0 ? how : GENERIC_BLURB.how,
    };
  } catch (_e) {
    // Absolute Tier-0 floor: never throw, always a usable blurb.
    return { what: GENERIC_BLURB.what, helps_with: GENERIC_BLURB.helps_with, how: GENERIC_BLURB.how };
  }
}

module.exports = {
  buildActBlurb: buildActBlurb,
  // Exposed for the generic-degradation fixture introspection only.
  GENERIC_BLURB: GENERIC_BLURB,
};
