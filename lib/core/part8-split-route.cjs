'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 386 plan 42 (E-SPROUT-DESIGN): the context-based split route.
 * Debug session: part8-no-split-route-for-bodies-and-private-claims.
 *
 * Owner direction (2026-11-06): a bare block does not work. A body of text, an
 * edge that fails a prose rule or a short private claim is not refused and
 * forgotten. It goes through a split route, like the meeting filing:
 *   1. the host model breaks the text into typed claims (the plugin has no model)
 *   2. the room claims stay local, filed as proposed claims (writeClaimNode)
 *   3. only generic sprouts go to the Brain, as ordinary typed read calls
 *      (route sprout_call: brain_ask and brain_search through brain-client)
 *   4. the answer is assembled locally from the Brain reply and the claims
 * The guard stays the backstop. When it sees a raw body it answers with the
 * typed outcome sprouts_required (sproutsRequiredResult): a plain 5 step guide,
 * never silent, never sending, never echoing the text.
 *
 * Reuse (Canon Part 7): the claim types are KNOWLEDGE_TYPES of
 * lib/core/navigation/typed-claim.cjs, the claim writer is writeClaimNode of the
 * same file, the sprout shape is lib/core/part8-sprout-shape.cjs, the wire is
 * lib/core/brain-client.cjs. This module holds no second list and no second
 * writer, and opens no network connection of its own. The guard, the claim
 * writer and the Brain client are required lazily inside the functions, so a
 * hook that only needs the sentinel loads nothing heavy.
 *
 * Every function returns a typed failure and never throws on a missing or
 * non-string argument.
 */

const SPROUTS_REQUIRED = 'sprouts_required';
const ROUTE = 'sprout_call';
const SPROUT_MAX_WORDS = 12;
const RUN_WORDS = 4;

const MESSAGE_HEAD = 'Canon Part 8: this call carries text that must stay in the room (reason ' + SPROUTS_REQUIRED + '). Nothing was sent. Split it instead.';

const SPLIT_GUIDE = Object.freeze([
  '1. Break the text into claims and type each one as fact, causal, heuristic, anomaly_cue, mental_model or assumption, the way /mos:file-meeting does.',
  '2. Keep the room claims in the room: file each as a proposed claim with claim_write.',
  '3. Pick the generic sprouts the Brain needs: a framework name, a problem type, or a few keywords, at most ' + SPROUT_MAX_WORDS + ' words each, with no names, numbers, places, quotes or room terms.',
  '4. Call the Brain again with the sprouts only (route ' + ROUTE + ').',
  '5. Build the answer here, from the Brain reply and your local claims. Never paste the claims into a Brain call.',
]);

const MESSAGE = MESSAGE_HEAD + ' ' + SPLIT_GUIDE.join(' ');

/**
 * The refusal text. A constant: it ignores every argument, so it can never
 * hold a payload byte.
 */
function refusalMessage() {
  return MESSAGE;
}

/**
 * The typed outcome sentinel. error stays egress_blocked so every consumer of
 * the existing refusal keeps working. It holds no payload byte; only the tool
 * name is read from the arguments.
 */
function sproutsRequiredResult(toolName) {
  const tool = typeof toolName === 'string' && /^[A-Za-z0-9_.:-]{1,80}$/.test(toolName) ? toolName : 'unknown';
  return {
    error: 'egress_blocked',
    tool: tool,
    egress_class: SPROUTS_REQUIRED,
    outcome: SPROUTS_REQUIRED,
    route: ROUTE,
    message: MESSAGE,
    split_guide: SPLIT_GUIDE.slice(),
  };
}

/**
 * Plan 386-27: true when the payload of an AMBIGUOUS call holds a string that
 * classifyShape calls edge or body, at any depth (objects, arrays). Strings
 * that are sprouts, numbers, booleans and null never count. The cypher key of
 * brain_query is not read: repo code paths (enrichCausalEdges,
 * suggestValidationSteps, hatAwareRecommend) send assembled Cypher templates
 * with no model to split them, and the guard reads that field on its own
 * raw-field rules. A depth cap and a node cap keep the walk bounded. Any
 * failure of the shape helper answers true, the safe class (the same stance as
 * the shape helper, where an unreadable value is a body): the caller then
 * refuses with the typed outcome and sends nothing. Never throws and never
 * returns a string of the payload.
 */
function carriesEdgeOrBody(toolName, args) {
  try {
    const shape = require('./part8-sprout-shape.cjs');
    const skipCypher = typeof toolName === 'string' && /(?:^|__)brain_query$/.test(toolName);
    const seen = new Set();
    let budget = 2000;
    const walk = (v, depth, top, key) => {
      if (budget <= 0 || depth > 8) return false;
      budget -= 1;
      if (typeof v === 'string') {
        if (top && skipCypher && key === 'cypher') return false;
        return shape.classifyShape(v).kind !== 'sprout';
      }
      if (v === null || typeof v !== 'object') return false;
      if (seen.has(v)) return false;
      seen.add(v);
      const entries = Array.isArray(v) ? v.map((x, i) => [String(i), x]) : Object.keys(v).map((k) => [k, v[k]]);
      for (let i = 0; i < entries.length; i += 1) {
        if (walk(entries[i][1], depth + 1, false, entries[i][0])) return true;
      }
      return false;
    };
    if (args === null || typeof args !== 'object') return typeof args === 'string' ? walk(args, 0, false, '') : false;
    const topEntries = Array.isArray(args) ? args.map((x, i) => [String(i), x]) : Object.keys(args).map((k) => [k, args[k]]);
    for (let i = 0; i < topEntries.length; i += 1) {
      if (walk(topEntries[i][1], 1, true, topEntries[i][0])) return true;
    }
    return false;
  } catch (_e) {
    return true;
  }
}

let _claimTypes = null;
function _loadClaimTypes() {
  if (_claimTypes) return _claimTypes;
  try {
    const tc = require('./navigation/typed-claim.cjs');
    _claimTypes = Object.freeze(Array.from(tc.KNOWLEDGE_TYPES));
  } catch (_e) {
    _claimTypes = Object.freeze([]);
  }
  return _claimTypes;
}

function _isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function _normWords(s) {
  if (typeof s !== 'string') return [];
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').filter(Boolean);
}

function _claimText(c) {
  if (typeof c === 'string') return c;
  if (_isPlainObject(c) && typeof c.text === 'string') return c.text;
  return '';
}

/**
 * True when the sprout holds n or more words in a row (default 4) that also
 * appear in a row in any claim text, or when the whole normalized sprout equals
 * a whole normalized claim of fewer than n words. Both sides are normalized:
 * lower case, every run of non-letters and non-digits becomes one space.
 */
function sharesClaimRun(sprout, claims, n) {
  try {
    const size = Number.isInteger(n) && n > 0 ? n : RUN_WORDS;
    const sp = _normWords(sprout);
    if (sp.length === 0 || !Array.isArray(claims)) return false;
    const spJoined = sp.join(' ');
    for (let c = 0; c < claims.length; c += 1) {
      const cw = _normWords(_claimText(claims[c]));
      if (cw.length === 0) continue;
      if (cw.length < size && cw.join(' ') === spJoined) return true;
      if (sp.length < size) continue;
      const hay = ' ' + cw.join(' ') + ' ';
      for (let i = 0; i + size <= sp.length; i += 1) {
        if (hay.indexOf(' ' + sp.slice(i, i + size).join(' ') + ' ') !== -1) return true;
      }
    }
    return false;
  } catch (_e) {
    return false;
  }
}

/**
 * Each sprout must be a string of at most 12 words that the shape helper calls
 * a sprout (a first-person statement is not a sprout) and that the guard
 * allows. opts.classify is the guard classify (default: the real guard,
 * called as classify({ question }, { toolName: 'brain_ask', roomDir })).
 * Returns { ok, rejected: [{ index, class }] }. Never holds a text.
 */
function validateSprouts(sprouts, opts) {
  try {
    if (!Array.isArray(sprouts) || sprouts.length === 0) {
      return { ok: false, rejected: [], reason: 'invalid_sprouts' };
    }
    const o = _isPlainObject(opts) ? opts : {};
    let shape = null;
    let classifyFn = typeof o.classify === 'function' ? o.classify : null;
    try {
      shape = require('./part8-sprout-shape.cjs');
      if (!classifyFn) classifyFn = require('./part8-egress-guard.cjs').classify;
    } catch (_e) {
      return { ok: false, rejected: [], reason: 'guard_unavailable' };
    }
    const rejected = [];
    for (let i = 0; i < sprouts.length; i += 1) {
      const s = sprouts[i];
      if (typeof s !== 'string' || s.trim().length === 0) {
        rejected.push({ index: i, class: 'not_sprout' });
        continue;
      }
      const sh = shape.classifyShape(s);
      if (sh.kind !== 'sprout' || sh.words === 0 || sh.words > SPROUT_MAX_WORDS) {
        rejected.push({ index: i, class: 'not_sprout' });
        continue;
      }
      let v = null;
      try {
        v = classifyFn({ question: s }, { toolName: 'brain_ask', roomDir: o.roomDir || null });
      } catch (_e) {
        rejected.push({ index: i, class: 'guard_unavailable' });
        continue;
      }
      if (!v || v.verdict !== 'allow') {
        rejected.push({ index: i, class: (v && typeof v.class === 'string' && v.class) || 'blocked' });
      }
    }
    return { ok: rejected.length === 0, rejected: rejected };
  } catch (_e) {
    return { ok: false, rejected: [], reason: 'validate_failed' };
  }
}

/**
 * File the claims as proposed claims through writeClaimNode, all or nothing.
 * Every claim is validated first. One invalid claim writes nothing.
 */
function fileClaimsLocal(db, claims, opts) {
  try {
    if (!db || typeof db.exec !== 'function' || typeof db.prepare !== 'function') {
      return { ok: false, reason: 'invalid_db' };
    }
    if (!Array.isArray(claims) || claims.length === 0) {
      return { ok: false, reason: 'invalid_claims' };
    }
    const types = _loadClaimTypes();
    for (let i = 0; i < claims.length; i += 1) {
      const c = claims[i];
      if (!_isPlainObject(c) || typeof c.knowledge_type !== 'string' || types.indexOf(c.knowledge_type) === -1) {
        return { ok: false, reason: 'invalid_knowledge_type', index: i };
      }
      if (typeof c.text !== 'string' || c.text.trim().length === 0) {
        return { ok: false, reason: 'invalid_text', index: i };
      }
    }
    const o = _isPlainObject(opts) ? opts : {};
    const sessionId = typeof o.sessionId === 'string' && o.sessionId.length > 0 ? o.sessionId : 'split-route';
    const writeClaimNode = require('./navigation/typed-claim.cjs').writeClaimNode;
    // One transaction for the whole set. A caller that already opened one owns it.
    let owns = db.isTransaction !== true;
    if (owns) {
      try { db.exec('BEGIN IMMEDIATE'); } catch (_e) { owns = false; }
    }
    const ids = [];
    for (let i = 0; i < claims.length; i += 1) {
      const c = claims[i];
      const r = writeClaimNode(db, { knowledge_type: c.knowledge_type, text: c.text, sessionId: sessionId });
      if (!r || r.ok !== true) {
        if (owns) { try { db.exec('ROLLBACK'); } catch (_e) { /* nothing to undo */ } }
        return { ok: false, reason: (r && r.reason) || 'claim_write_failed', index: i };
      }
      ids.push(r.node_id);
    }
    if (owns) {
      try { db.exec('COMMIT'); } catch (_e) {
        try { db.exec('ROLLBACK'); } catch (_e2) { /* nothing to undo */ }
        return { ok: false, reason: 'commit_failed' };
      }
    }
    return { ok: true, ids: ids };
  } catch (_e) {
    return { ok: false, reason: 'file_claims_failed' };
  }
}

function _answerText(a) {
  if (typeof a === 'string') return a;
  if (_isPlainObject(a)) {
    if (a.error) return null;
    const keys = ['answer', 'text', 'message', 'summary'];
    for (let i = 0; i < keys.length; i += 1) {
      if (typeof a[keys[i]] === 'string' && a[keys[i]].length > 0) return a[keys[i]];
    }
    try { return JSON.stringify(a); } catch (_e) { return null; }
  }
  return null;
}

/**
 * Pure. Joins the Brain answers and the local claim texts under plain labels.
 * Returns { text, parts }.
 */
function assembleLocal(claims, brainAnswers) {
  const answers = Array.isArray(brainAnswers) ? brainAnswers : [];
  const local = [];
  (Array.isArray(claims) ? claims : []).forEach((c) => {
    const t = _claimText(c);
    if (t) local.push({ knowledge_type: _isPlainObject(c) && typeof c.knowledge_type === 'string' ? c.knowledge_type : '', text: t });
  });
  const brain = [];
  let unavailable = 0;
  answers.forEach((a) => {
    const t = _answerText(a);
    if (t) brain.push(t); else unavailable += 1;
  });
  const lines = ['What the Brain said:'];
  if (brain.length === 0) lines.push('- The Brain gave no usable answer.');
  brain.forEach((t) => lines.push('- ' + t));
  lines.push('What stays in the room:');
  if (local.length === 0) lines.push('- No local claims.');
  local.forEach((c) => lines.push('- ' + (c.knowledge_type ? '[' + c.knowledge_type + '] ' : '') + c.text));
  return { text: lines.join('\n'), parts: { brain: brain, local: local, brain_unavailable: unavailable } };
}

async function _defaultCallBrain(sprout) {
  const bc = require('./brain-client.cjs');
  return bc.ask(sprout);
}

/**
 * The whole route. Order: check every sprout (shape, leak against the claims,
 * guard); any rejection returns { ok: false, rejected } with no claim filed and
 * no call made. Then file the claims. Then call callBrain once per sprout, in
 * order. Then assemble. callBrain is injected; the default is brain-client ask().
 */
async function runSplitRoute(args) {
  try {
    if (!_isPlainObject(args)) return { ok: false, reason: 'invalid_args' };
    const claims = args.claims;
    const sprouts = args.sprouts;
    if (!Array.isArray(claims) || claims.length === 0) return { ok: false, reason: 'invalid_claims' };
    if (!Array.isArray(sprouts) || sprouts.length === 0) return { ok: false, reason: 'invalid_sprouts' };

    const v = validateSprouts(sprouts, { classify: args.classify, roomDir: args.roomDir });
    if (v.reason) return { ok: false, rejected: [], reason: v.reason };
    const byIndex = new Map();
    v.rejected.forEach((r) => byIndex.set(r.index, r.class));
    for (let i = 0; i < sprouts.length; i += 1) {
      if (typeof sprouts[i] === 'string' && sharesClaimRun(sprouts[i], claims, RUN_WORDS)) {
        byIndex.set(i, 'not_sprout');
      }
    }
    if (byIndex.size > 0) {
      const rejected = Array.from(byIndex.keys()).sort((a, b) => a - b).map((i) => ({ index: i, class: byIndex.get(i) }));
      return { ok: false, rejected: rejected };
    }

    const filed = fileClaimsLocal(args.db, claims, { sessionId: args.sessionId });
    if (!filed.ok) return { ok: false, reason: filed.reason, rejected: [] };

    const callBrain = typeof args.callBrain === 'function' ? args.callBrain : _defaultCallBrain;
    const answers = [];
    for (let i = 0; i < sprouts.length; i += 1) {
      try {
        answers.push(await callBrain(sprouts[i]));
      } catch (_e) {
        answers.push({ error: 'brain_call_failed' });
      }
    }
    return { ok: true, ids: filed.ids, answers: answers, assembled: assembleLocal(claims, answers) };
  } catch (_e) {
    return { ok: false, reason: 'route_failed' };
  }
}

module.exports = {
  SPROUTS_REQUIRED: SPROUTS_REQUIRED,
  ROUTE: ROUTE,
  SPLIT_GUIDE: SPLIT_GUIDE,
  refusalMessage: refusalMessage,
  sproutsRequiredResult: sproutsRequiredResult,
  carriesEdgeOrBody: carriesEdgeOrBody,
  validateSprouts: validateSprouts,
  sharesClaimRun: sharesClaimRun,
  fileClaimsLocal: fileClaimsLocal,
  assembleLocal: assembleLocal,
  runSplitRoute: runSplitRoute,
};

// CLAIM_TYPES is read lazily from KNOWLEDGE_TYPES (no second list), so it is a
// getter and the claim writer loads only when someone reads it.
Object.defineProperty(module.exports, 'CLAIM_TYPES', {
  enumerable: true,
  get: function () { return _loadClaimTypes(); },
});
