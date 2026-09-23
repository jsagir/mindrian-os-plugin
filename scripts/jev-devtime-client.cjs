'use strict';
// ---------------------------------------------------------------------------
// Phase 356 (D-06..D-09, D-13): the one shared dev-time Jev client. Extracted
// from scripts/build-section-command-ledger.cjs so 356, 354-17 and 357 share
// one fetch wrapper and one per-profile egress guard instead of three copies.
//
// Dev-time only: no file under lib/ or hooks/ may require this module
// (tripwires enforce it). Pure and path-free (only node:fs and node:path)
// so a future Theo re-emission can vendor or port it without the plugin
// working tree (D-13).
//
// The key is never printed, logged, or returned in an error (T-356-05).
// One profile per builder, never a merged union: a union would widen any
// single builder's limits (D-08). Every guard refuses and never strips
// (D-09): a violation always throws, naming the offending key.
// ---------------------------------------------------------------------------
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';

// ---------------------------------------------------------------------------
// Key handling. Never printed, never logged, never written anywhere.
// ---------------------------------------------------------------------------
function loadKey(opts) {
  const o = opts || {};
  const env = o.env || process.env;
  if (env.TYPESAFE_API_KEY) return env.TYPESAFE_API_KEY;
  const secretsPath = o.secretsPath || path.join(require('node:os').homedir(), '.secrets', 'typesafe.env');
  try {
    const raw = fs.readFileSync(secretsPath, 'utf8');
    const m = raw.match(/^TYPESAFE_API_KEY=(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  } catch (_e) { /* fall through */ }
  return null;
}

// ---------------------------------------------------------------------------
// Egress guard error shape (D-09): a thrown Error naming the offending key,
// with err.code = 'EGRESS_REFUSED', err.profile, err.key.
// ---------------------------------------------------------------------------
function _refuse(profileId, key, message) {
  const err = new Error(message);
  err.code = 'EGRESS_REFUSED';
  err.profile = profileId;
  err.key = key;
  throw err;
}

// ---------------------------------------------------------------------------
// makeEgressGuard(profile, opts) -> guard(payload) returning true or throwing.
// Dispatches on profile.kind. opts.root is required only when the profile
// declares must_equal_file.
// ---------------------------------------------------------------------------
function _checkCandidatesV1(profile, payload) {
  const messagePrefix = profile.message_prefix || 'assertEgressCeiling';
  if (!payload || typeof payload !== 'object') {
    _refuse(profile.id, null, messagePrefix + ': payload must be an object');
  }
  const topKeys = new Set(profile.top_keys);
  for (const k of Object.keys(payload)) {
    if (!topKeys.has(k)) {
      _refuse(profile.id, k, messagePrefix + ': disallowed top-level key "' + k + '"');
    }
  }
  const state = payload.state || {};
  if (typeof state === 'object' && !Array.isArray(state)) {
    const stateKeys = new Set(profile.state_keys);
    for (const k of Object.keys(state)) {
      if (!stateKeys.has(k)) {
        _refuse(profile.id, k, messagePrefix + ': disallowed state key "' + k + '"');
      }
    }
    const candidates = state.candidates || {};
    const candidateKeys = new Set(profile.candidate_keys);
    const candidateMaxLen = profile.candidate_max_len;
    for (const cid of Object.keys(candidates)) {
      const c = candidates[cid] || {};
      for (const k of Object.keys(c)) {
        if (!candidateKeys.has(k)) {
          _refuse(profile.id, k, messagePrefix + ': disallowed candidate key "' + k + '" on ' + cid);
        }
        if (typeof candidateMaxLen === 'number' && typeof c[k] === 'string' && c[k].length > candidateMaxLen) {
          _refuse(profile.id, k, messagePrefix + ': candidate.' + cid + '.' + k + ' exceeds ' + candidateMaxLen + ' chars');
        }
      }
    }
  }
  // questions carry only instructions/criteria/type: no free-text room bytes.
  const questions = payload.questions || {};
  const judgeMaxLen = profile.judge_max_len;
  for (const qid of Object.keys(questions)) {
    const q = questions[qid] || {};
    if (typeof judgeMaxLen === 'number' && q.instructions && typeof q.instructions.judge === 'string' && q.instructions.judge.length > judgeMaxLen) {
      _refuse(profile.id, qid, messagePrefix + ': question ' + qid + ' instructions.judge unexpectedly long');
    }
  }
  return true;
}

function _checkExactStateV1(profile, payload) {
  if (!payload || typeof payload !== 'object') {
    _refuse(profile.id, null, 'egress refused (' + profile.id + '): payload must be an object');
  }
  const topKeys = new Set(profile.top_keys);
  for (const k of Object.keys(payload)) {
    if (!topKeys.has(k)) {
      _refuse(profile.id, k, 'egress refused (' + profile.id + '): disallowed top-level key "' + k + '"');
    }
  }
  if (typeof profile.model === 'string' && payload.model !== profile.model) {
    _refuse(profile.id, 'model', 'egress refused (' + profile.id + '): model must equal "' + profile.model + '"');
  }
  if (Array.isArray(profile.state_keys)) {
    const state = payload.state || {};
    if (typeof state !== 'object' || Array.isArray(state)) {
      _refuse(profile.id, 'state', 'egress refused (' + profile.id + '): state must be an object');
    }
    const requiredKeys = new Set(profile.state_keys);
    const seenKeys = new Set(Object.keys(state));
    for (const k of Object.keys(state)) {
      if (!requiredKeys.has(k)) {
        _refuse(profile.id, k, 'egress refused (' + profile.id + '): disallowed state key "' + k + '"');
      }
    }
    for (const k of requiredKeys) {
      if (!seenKeys.has(k)) {
        _refuse(profile.id, k, 'egress refused (' + profile.id + '): missing required state key "' + k + '"');
      }
    }
  }
  if (Array.isArray(profile.question_ids) || Array.isArray(profile.question_keys) || profile.question_type || Array.isArray(profile.instructions_keys) || Array.isArray(profile.criteria_keys)) {
    const questions = payload.questions || {};
    if (Array.isArray(profile.question_ids)) {
      const requiredIds = new Set(profile.question_ids);
      const seenIds = new Set(Object.keys(questions));
      for (const qid of Object.keys(questions)) {
        if (!requiredIds.has(qid)) {
          _refuse(profile.id, qid, 'egress refused (' + profile.id + '): disallowed question id "' + qid + '"');
        }
      }
      for (const qid of requiredIds) {
        if (!seenIds.has(qid)) {
          _refuse(profile.id, qid, 'egress refused (' + profile.id + '): missing required question "' + qid + '"');
        }
      }
    }
    for (const qid of Object.keys(questions)) {
      const q = questions[qid] || {};
      if (profile.question_type && q.type !== profile.question_type) {
        _refuse(profile.id, qid, 'egress refused (' + profile.id + '): question ' + qid + ' must have type "' + profile.question_type + '"');
      }
      if (Array.isArray(profile.question_keys)) {
        const allowedQKeys = new Set(profile.question_keys);
        for (const k of Object.keys(q)) {
          if (!allowedQKeys.has(k)) {
            _refuse(profile.id, k, 'egress refused (' + profile.id + '): disallowed question key "' + k + '" on ' + qid);
          }
        }
      }
      if (Array.isArray(profile.instructions_keys) && q.instructions && typeof q.instructions === 'object') {
        const allowedIKeys = new Set(profile.instructions_keys);
        for (const k of Object.keys(q.instructions)) {
          if (!allowedIKeys.has(k)) {
            _refuse(profile.id, k, 'egress refused (' + profile.id + '): disallowed instructions key "' + k + '" on ' + qid);
          }
        }
      }
      if (Array.isArray(profile.criteria_keys) && q.criteria && typeof q.criteria === 'object') {
        const allowedCKeys = new Set(profile.criteria_keys);
        for (const k of Object.keys(q.criteria)) {
          if (!allowedCKeys.has(k)) {
            _refuse(profile.id, k, 'egress refused (' + profile.id + '): disallowed criteria key "' + k + '" on ' + qid);
          }
        }
      }
    }
  }
  return true;
}

function _applyOptionalFields(profile, payload, fileCache) {
  const state = (payload && typeof payload.state === 'object' && !Array.isArray(payload.state)) ? payload.state : {};
  if (profile.max_len_by_key) {
    for (const k of Object.keys(profile.max_len_by_key)) {
      const n = profile.max_len_by_key[k];
      const v = state[k];
      if (typeof v === 'string' && v.length > n) {
        _refuse(profile.id, k, 'egress refused (' + profile.id + '): state.' + k + ' exceeds ' + n + ' chars');
      }
    }
  }
  if (profile.must_equal_file) {
    for (const k of Object.keys(profile.must_equal_file)) {
      const rel = profile.must_equal_file[k];
      const expectedBytes = fileCache[rel];
      const v = state[k];
      const ok = typeof v === 'string' && Buffer.from(v, 'utf8').equals(expectedBytes);
      if (!ok) {
        _refuse(profile.id, k, 'egress refused (' + profile.id + '): state.' + k + ' is not byte-identical to ' + rel);
      }
    }
  }
  return true;
}

function makeEgressGuard(profile, opts) {
  if (!profile || typeof profile !== 'object' || typeof profile.kind !== 'string') {
    throw new Error('makeEgressGuard: profile.kind is required');
  }
  const o = opts || {};
  let checkKind;
  if (profile.kind === 'candidates_v1') {
    checkKind = _checkCandidatesV1;
  } else if (profile.kind === 'exact_state_v1') {
    checkKind = _checkExactStateV1;
  } else {
    throw new Error('makeEgressGuard: unknown profile kind "' + profile.kind + '"');
  }

  // must_equal_file: read every referenced file's bytes ONCE, at construction.
  const fileCache = {};
  if (profile.must_equal_file) {
    if (!o.root) {
      throw new Error('makeEgressGuard: must_equal_file requires opts.root');
    }
    const root = path.resolve(o.root);
    for (const k of Object.keys(profile.must_equal_file)) {
      const rel = profile.must_equal_file[k];
      const abs = path.resolve(root, rel);
      const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
      if (abs !== root && !abs.startsWith(rootWithSep)) {
        throw new Error('makeEgressGuard: must_equal_file path "' + rel + '" escapes opts.root');
      }
      fileCache[rel] = fs.readFileSync(abs);
    }
  }

  return function guard(payload) {
    checkKind(profile, payload);
    _applyOptionalFields(profile, payload, fileCache);
    return true;
  };
}

// ---------------------------------------------------------------------------
// Jev client: near-verbatim port of the 353 builder's jev()/pool(). jev()
// refuses to run without a guard function (T-356-07): there is no unguarded
// fetch path in this module, by construction. fetchImpl is resolved at CALL
// time (never captured at module load), because tests swap globalThis.fetch
// after requiring the modules that use this client.
// ---------------------------------------------------------------------------
const _defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function jev(body, opts) {
  const o = opts || {};
  if (typeof o.guard !== 'function') {
    throw new Error('jev: a guard is required (no unguarded egress)');
  }
  o.guard(body);
  const endpoint = o.endpoint || DEFAULT_ENDPOINT;
  const sleepImpl = o.sleepImpl || _defaultSleep;
  let attempt = 0;
  for (;;) {
    const doFetch = o.fetchImpl || globalThis.fetch;
    const t0 = Date.now();
    let r;
    try {
      r = await doFetch(endpoint, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + o.key, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (e) {
      if (attempt++ < 3) { await sleepImpl(500 * 2 ** attempt); continue; }
      return { status: 0, ms: Date.now() - t0, json: null };
    }
    const ms = Date.now() - t0;
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_e) { /* leave json null */ }
    if ((r.status === 429 || r.status === 529) && attempt++ < 4) { await sleepImpl(400 * 2 ** attempt); continue; }
    return { status: r.status, ms: ms, json: json, text: text.slice(0, 200) };
  }
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    for (;;) {
      const k = i++;
      if (k >= items.length) return;
      out[k] = await fn(items[k], k);
    }
  }));
  return out;
}

// ---------------------------------------------------------------------------
// EGRESS_PROFILES: frozen object of frozen profile objects, one per builder,
// never a merged union (D-08). 356-07 adds material_step_ledger; 354-17 and
// 357 add their own profiles from their own builders.
// ---------------------------------------------------------------------------
const EGRESS_PROFILES = Object.freeze({
  section_command_ledger: Object.freeze({
    id: 'section_command_ledger',
    kind: 'candidates_v1',
    top_keys: Object.freeze(['model', 'state', 'questions']),
    state_keys: Object.freeze(['section', 'problem_type', 'stage', 'candidates']),
    candidate_keys: Object.freeze(['name', 'jtbd', 'glossary', 'description']),
    candidate_max_len: 140,
    judge_max_len: 400,
    message_prefix: 'assertEgressCeiling',
  }),
});

module.exports = { DEFAULT_ENDPOINT, loadKey, makeEgressGuard, jev, pool, EGRESS_PROFILES };
