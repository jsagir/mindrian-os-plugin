// lib/statusline/next-move-cache.cjs -- Quick task 20260702-statusline-live-signals
//
// The WRITE + READ side-channel that makes the statusline "Next:" cue LIVE. It
// closes the Phase 192-04 NAMED DEBT in cockpit-signals.cjs (deriveNextMove had no
// wire to the real routed next step, so it showed 'continue' forever).
//
// One tiny LOCAL file at ~/.mindrian/next-move.json carries the last routed offer
// the shipped router (navigation-engine-offer.suggestNext) produced:
//   { next_move: '<short cue>', command: '/mos:xxx', jtbd: '<label>', ts: <epoch> }
//
// The WRITE side is called from the router's runtime chokepoint (NOT the hot
// statusline path). The READ side is the hot-path-cheap single file read that
// deriveNextMove consults FIRST. Mirrors the room-health / stance / voice-mark
// side-channel idiom exactly: every fs op is try/caught, any failure degrades to
// the safe default (null on read -> caller falls back to jtbd / governing / 'continue').
//
// Canon Part 8 (Graph Boundary): LOCAL only. Zero network, zero Brain. The routed
// step is a generic command handle, never user-room content.
//
// Phase 400.4 plan 14 (QA-F12 D3, D4): the cue is one record per session at
// ~/.mindrian/next-move/<session_id>.json (version 2) holding the room slug, the move and its job phrase, worded
// 'challenge assumptions: an idea feels too clean'. The old global file is read only as a fallback. A record older
// than 24 h is ignored. A skill name is never written: the fire_skill leg is gone.
//
// House rule: hyphens only, no em-dashes.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function homeDir() {
  return process.env.HOME || process.env.USERPROFILE || os.homedir();
}

function mindrianDir() {
  return path.join(homeDir(), '.mindrian');
}

function cachePath() {
  return path.join(mindrianDir(), 'next-move.json');
}

// Max length of the rendered cue (matches the governing-thought truncation floor
// in cockpit-signals.deriveNextMove so the Tier-3 line stays a single hero cue).
const CUE_MAX = 48;

// QA-F12 D4: a record older than 24 h is ignored; a write removes records older than 7 days (at most 200 per write).
const CUE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const PRUNE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const PRUNE_MAX_FILES = 200;
// QA-F12 D3: the plain sentences, never '--' and never a skill name.
const NO_GOAL_CUE = 'set a goal job';
const NO_MOVE_CUE = 'no move for this job yet';
const NO_ROOM_CUE = 'no room for this session';
// A session id becomes a file name: letters, digits, hyphen and underscore, 1 to 128 characters (T-400.4-43).
const SAFE_SESSION_RE = /^[A-Za-z0-9_-]{1,128}$/;
// A phrase never ends on one of these words.
const STOP_WORDS = new Set(['and', 'or', 'but', 'with', 'the', 'a', 'an', 'to', 'of', 'for', 'in', 'on', 'that']);

/**
 * Turn a routed command slug into a short human "Next:" cue.
 *   '/mos:map-unknowns' -> 'map unknowns'
 *   'mullins'           -> 'mullins'
 * Returns '' for a non-string / empty command.
 * @param {string} command
 * @returns {string}
 */
function formatCommandCue(command) {
  if (typeof command !== 'string') return '';
  let s = command.trim();
  if (!s) return '';
  s = s.replace(/^\/?mos:/i, '').replace(/^\//, '');
  s = s.replace(/-/g, ' ').trim();
  if (s.length > CUE_MAX) s = s.slice(0, CUE_MAX - 1) + '…';
  return s;
}

/**
 * shortJobPhrase(command, jobWhen) -> the whole words of the job phrase that fit beside the command words inside
 * CUE_MAX, minus a trailing stop word, no ellipsis. '' when there is no phrase or no room for one.
 */
function shortJobPhrase(command, jobWhen) {
  try {
    if (typeof jobWhen !== 'string') return '';
    const words = formatCommandCue(command);
    const budget = CUE_MAX - words.length - 2; // ': ' between the command words and the phrase
    if (budget < 1) return '';
    const parts = jobWhen.trim().split(/\s+/).filter(Boolean);
    const kept = [];
    let len = 0;
    for (let i = 0; i < parts.length; i += 1) {
      const next = len + (kept.length > 0 ? 1 : 0) + parts[i].length;
      if (next > budget) break;
      kept.push(parts[i]);
      len = next;
    }
    while (kept.length > 0 && STOP_WORDS.has(kept[kept.length - 1].toLowerCase().replace(/[^a-z]/g, ''))) kept.pop();
    return kept.join(' ');
  } catch (_e) {
    return '';
  }
}

/**
 * formatMoveCue(command, jobWhen) -> '<command words>: <job phrase>', at most CUE_MAX characters; the command words
 * only when there is no job phrase. '' for a non-string or empty command.
 */
function formatMoveCue(command, jobWhen) {
  const words = formatCommandCue(command);
  if (!words) return '';
  const phrase = shortJobPhrase(command, jobWhen);
  return phrase ? words + ': ' + phrase : words;
}

function sessionDir() {
  return path.join(mindrianDir(), 'next-move');
}

/** The path of the record of one session, or null for an unsafe id (T-400.4-43). */
function sessionCuePath(sessionId) {
  if (typeof sessionId !== 'string' || !SAFE_SESSION_RE.test(sessionId)) return null;
  return path.join(sessionDir(), sessionId + '.json');
}

function pruneSessionDir(dir, keepFile) {
  try {
    const now = Date.now();
    const names = fs.readdirSync(dir).filter((n) => /\.json$/.test(n));
    let removed = 0;
    for (let i = 0; i < names.length && removed < PRUNE_MAX_FILES; i += 1) {
      const f = path.join(dir, names[i]);
      if (f === keepFile) continue;
      try {
        const st = fs.statSync(f);
        if (now - st.mtimeMs > PRUNE_AGE_MS) { fs.rmSync(f, { force: true }); removed += 1; }
      } catch (_e) { /* skip */ }
    }
  } catch (_e) { /* best effort */ }
}

/** Atomic write of one session record (tmp + rename). Never throws; true on success. */
function writeSessionCue(sessionId, record) {
  try {
    const p = sessionCuePath(sessionId);
    if (!p || !record || typeof record !== 'object') return false;
    const dir = sessionDir();
    try { fs.mkdirSync(dir, { recursive: true }); } catch (_e) { /* exists */ }
    const tmp = p + '.tmp-' + process.pid;
    fs.writeFileSync(tmp, JSON.stringify(record), 'utf8');
    fs.renameSync(tmp, p);
    pruneSessionDir(dir, p);
    return true;
  } catch (_e) {
    return false;
  }
}

function isFresh(data) {
  return !!data && typeof data.ts === 'number' && Number.isFinite(data.ts) && (Date.now() - data.ts) <= CUE_MAX_AGE_MS;
}

/** The fresh record of one session, or null when absent, malformed, unsafe or older than CUE_MAX_AGE_MS. */
function readSessionCue(sessionId) {
  try {
    const p = sessionCuePath(sessionId);
    if (!p) return null;
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!data || typeof data !== 'object' || !isFresh(data)) return null;
    if (typeof data.next_move !== 'string' || !data.next_move.trim()) return null;
    return data;
  } catch (_e) {
    return null;
  }
}

function jobWhenOf(command) {
  try { return require('../core/feyminto/next-move.cjs').jobWhenFor(command); } catch (_e) { return null; }
}

function sessionRecord(sessionId, opts, fields) {
  return Object.assign({
    version: 2,
    session_id: sessionId,
    room: opts && typeof opts.room === 'string' && opts.room ? opts.room : null,
    command: null,
    job_id: null,
    job_when: null,
    source: null,
    ts: Date.now(),
  }, fields);
}

/**
 * Persist the routed next step from a resolved offer (navigation-engine-offer
 * resolveOffer output: { command, jtbd, ... }). When offer is null / has no
 * command (the router abstained), CLEAR the cache so the statusline falls back to
 * jtbd / governing-thought / 'continue' rather than pinning a stale routed step.
 * Defensive: never throws; returns true on a successful write/clear, false on any
 * failure.
 * @param {Object|null} offer
 * @param {{sessionId?: string, room?: string}} [opts]
 * @returns {boolean}
 */
function persistNextMove(offer, opts) {
  try {
    const dir = mindrianDir();
    const p = cachePath();
    const command = offer && typeof offer.command === 'string' ? offer.command.trim() : '';
    const cue = formatCommandCue(command);

    // QA-F12 D4: with a safe session id the cue is that session's record; the global file is not written. An
    // abstention writes nothing here, so one session's abstention never clears another session's cue.
    if (opts && sessionCuePath(opts.sessionId)) {
      if (!cue) return true;
      const when = jobWhenOf(command);
      return writeSessionCue(opts.sessionId, sessionRecord(opts.sessionId, opts, {
        next_move: formatMoveCue(command, when),
        command: command,
        job_id: offer && typeof offer.jtbd === 'string' ? offer.jtbd : null,
        job_when: when,
        source: 'offer',
      }));
    }

    // Abstention (no routed command) -> clear to the byte-stable default.
    if (!cue) {
      try { fs.rmSync(p, { force: true }); } catch (_e) { /* already absent */ }
      return true;
    }

    const record = {
      next_move: cue,
      command: command,
      jtbd: offer && typeof offer.jtbd === 'string' ? offer.jtbd : null,
      ts: Date.now(),
    };
    return writeRecord(record);
  } catch (_e) {
    return false;
  }
}

/**
 * The ONE atomic write implementation (tmp + rename). Both the routed-offer
 * writer and the ratification fallback leg flow through here so there is a
 * single write path, not two (Canon Part 7: no second cache, no second writer).
 * Never throws; returns true on success, false on any failure.
 * @param {Object} record
 * @returns {boolean}
 */
function writeRecord(record) {
  try {
    const dir = mindrianDir();
    const p = cachePath();
    try { fs.mkdirSync(dir, { recursive: true }); } catch (_e) { /* exists */ }
    const tmp = p + '.tmp-' + process.pid;
    fs.writeFileSync(tmp, JSON.stringify(record), 'utf8');
    fs.renameSync(tmp, p);
    return true;
  } catch (_e) {
    return false;
  }
}

/**
 * Persist the LATEST per-turn navigation decision's actionable cue (Ruling 3a,
 * 2026-07-02). This WIDENS the live sources feeding the statusline "Next:" cue
 * beyond the offer-resolver: decide() computes fire_skill / offer_next_step /
 * the fired sensor reach every turn, and in a session with no routed offer +
 * no JTBD the old writer cleared the cache -> "Next: continue" felt dead. Now the
 * per-turn decision's cue is persisted through the SAME writer (persistNextMove --
 * no second cache), so "Next:" reflects what the engine actually did this turn.
 *
 * Resolution order (mirrors the renderer's Ruling 3c order):
 *   1. offer_next_step.command  -> the real routed command (preferred).
 *   2. (removed, QA-F12 D3: a fired skill name is not a move and is never written.)
 *   3. neither                  -> CLEAR to the honest byte-stable default (no
 *      stale pin; the reader falls back to jtbd -> "--").
 *
 * Runs where the engine already runs (the per-turn navigation hook), NEVER in the
 * hot statusline process. Reuses persistNextMove for the atomic write + clear-on-
 * abstain semantics. Defensive: never throws; returns persistNextMove's boolean.
 *
 * Opt-in fallback (Quick task 260705-ui4): the OPTIONAL second arg
 * `opts.fallbackProvider` is a zero-arg function consulted ONLY on the case-3
 * (clear / abstention) leg. When the engine routes nothing and the provider
 * returns a non-empty RAW cue string, that cue is persisted verbatim (bypassing
 * formatCommandCue, which would mangle a parenthetical count) with an additive
 * `source` marker, `command: null`. This is strictly opt-in: with NO opts the
 * behavior is byte-identical to before (the existing clear-semantics tests pass
 * unmodified). If the provider is absent, throws, or returns falsy/non-string,
 * the leg clears to the honest byte-stable default exactly as today.
 * readNextMove ignores unknown fields, so `source` is additive and safe.
 *
 * @param {Object|null} decision - navigation-engine.decide() output
 * @param {{fallbackProvider?: function(): (string|null)}} [opts]
 * @returns {boolean}
 */
function persistFromDecision(decision, opts) {
  try {
    const d = (decision && typeof decision === 'object') ? decision : null;
    const o = (opts && typeof opts === 'object') ? opts : {};
    // QA-F12 D3, D4, PD-5: with a safe session id, one record for that session, in this order: the selector move,
    // the offer command, the ratification cue of the session's room, then a plain sentence. fire_skill is never read.
    if (sessionCuePath(o.sessionId)) return persistSessionCue(d, o);
    if (!d) return persistFallbackOrClear(opts); // no decision -> fallback or honest default
    // 1. Prefer the routed offer (a real command).
    const ons = d.offer_next_step;
    if (ons && typeof ons === 'object'
        && typeof ons.command === 'string' && ons.command.trim()) {
      return persistNextMove({
        command: ons.command,
        jtbd: (typeof ons.jtbd === 'string') ? ons.jtbd : null,
      });
    }
    // 2. (QA-F12 D3, owner decision 2026-11-26: the cue never shows a skill name, so no fire_skill leg.)
    // 3. Neither -> opt-in fallback cue, else clear to the byte-stable default.
    return persistFallbackOrClear(opts);
  } catch (_e) {
    return false;
  }
}

function persistSessionCue(d, o) {
  const sid = o.sessionId;
  const trace = d && d.decision_trace && typeof d.decision_trace === 'object' ? d.decision_trace : null;
  const sm = trace && trace.selector_next_move && typeof trace.selector_next_move === 'object' ? trace.selector_next_move : null;
  const ons = d && d.offer_next_step && typeof d.offer_next_step === 'object' ? d.offer_next_step : null;
  if (sm && typeof sm.command === 'string' && sm.command.trim()) {
    const when = typeof sm.job_when === 'string' && sm.job_when ? sm.job_when : jobWhenOf(sm.command);
    return writeSessionCue(sid, sessionRecord(sid, o, {
      next_move: formatMoveCue(sm.command, when),
      command: sm.command.trim(),
      job_id: typeof sm.job_id === 'string' ? sm.job_id : null,
      job_when: when || null,
      source: 'selector',
    }));
  }
  if (ons && typeof ons.command === 'string' && ons.command.trim()) {
    const when = jobWhenOf(ons.command);
    return writeSessionCue(sid, sessionRecord(sid, o, {
      next_move: formatMoveCue(ons.command, when),
      command: ons.command.trim(),
      job_id: typeof ons.jtbd === 'string' ? ons.jtbd : null,
      job_when: when || null,
      source: 'offer',
    }));
  }
  let ratified = null;
  if (typeof o.fallbackProvider === 'function') {
    try { ratified = o.fallbackProvider(); } catch (_e) { ratified = null; }
  }
  if (typeof ratified === 'string' && ratified.trim()) {
    return writeSessionCue(sid, sessionRecord(sid, o, { next_move: ratified.trim(), source: 'ratification' }));
  }
  let cue = NO_GOAL_CUE;
  let source = 'no_goal';
  if (o.roomless === true) { cue = NO_ROOM_CUE; source = 'no_room'; }
  else if (sm && typeof sm.job_id === 'string' && sm.job_id) { cue = NO_MOVE_CUE; source = 'no_move'; }
  return writeSessionCue(sid, sessionRecord(sid, o, {
    next_move: cue,
    job_id: sm && typeof sm.job_id === 'string' ? sm.job_id : null,
    source: source,
  }));
}

/**
 * The case-3 (abstention) leg. If a fallbackProvider is supplied and yields a
 * non-empty string cue, persist it RAW (no formatCommandCue mangling) with an
 * additive `source: 'ratification'` marker. Otherwise clear the cache exactly as
 * the pre-260705-ui4 writer did (persistNextMove(null)). Byte-identical to the
 * old behavior when opts is absent. Never throws.
 * @param {{fallbackProvider?: function(): (string|null)}} [opts]
 * @returns {boolean}
 */
function persistFallbackOrClear(opts) {
  const provider = opts && typeof opts.fallbackProvider === 'function' ? opts.fallbackProvider : null;
  if (provider) {
    let cue = null;
    try {
      cue = provider();
    } catch (_e) {
      cue = null; // provider threw -> fall through to clear
    }
    if (typeof cue === 'string' && cue.trim()) {
      return writeRecord({
        next_move: cue.trim(),
        command: null,
        jtbd: null,
        source: 'ratification',
        ts: Date.now(),
      });
    }
  }
  // No provider / falsy / non-string / threw -> honest byte-stable clear.
  return persistNextMove(null);
}

/**
 * Read the LOCAL routed-next-step cache. Hot-path cheap (one small file read).
 * Defensive: a missing / malformed / unreadable cache returns null (caller falls
 * back to jtbd -> governing-thought -> 'continue').
 * @param {{sessionId?: string}} [opts] the session whose own record is read first
 * @returns {string|null} the rendered cue, or null when absent.
 */
function readNextMove(opts) {
  try {
    const sid = opts && typeof opts === 'object' ? opts.sessionId : null;
    if (sid) {
      const rec = readSessionCue(sid);
      if (rec) return rec.next_move.trim();
    }
    const raw = fs.readFileSync(cachePath(), 'utf8');
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    if (!isFresh(data)) return null; // QA-F12 D4: the old global file counts only while it is fresh
    const cue = typeof data.next_move === 'string' ? data.next_move.trim() : '';
    return cue.length > 0 ? cue : null;
  } catch (_e) {
    return null;
  }
}

module.exports = {
  persistNextMove,
  persistFromDecision,
  readNextMove,
  formatCommandCue,
  formatMoveCue,
  shortJobPhrase,
  sessionCuePath,
  readSessionCue,
  writeSessionCue,
  cachePath,
  mindrianDir,
  CUE_MAX,
  CUE_MAX_AGE_MS,
  NO_GOAL_CUE,
  NO_MOVE_CUE,
  NO_ROOM_CUE,
};
