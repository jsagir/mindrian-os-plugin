#!/usr/bin/env node
'use strict';
/*
 * Phase 400.5 plan 02 (Path H, CONTEXT 5e; the plan 13 contract, G3): the one UserPromptSubmit process.
 *
 * WHY. Under host IO pressure, six node cold starts per prompt each had to load a module graph inside 3 s, and all
 * six were killed together. This process pays one cold start for the six checks and runs them in-process, one at a
 * time, in the fixed order of CHECKS. What the host receives does not change (G10, the parity test).
 *
 * Contract (plan 13 planner decisions):
 * - One JSON envelope on stdout: {continue, stopReason?, systemMessage?, hookSpecificOutput: {hookEventName,
 *   additionalContext}}. additionalContext is the non-empty check contexts in check order joined with
 *   CONTEXT_SEPARATOR. systemMessage values join with "\n". The first continue false wins with its stopReason.
 *   With nothing to say: {"continue":true}.
 * - A joined context over CONTEXT_CAP_CHARS is never cut; the stderr note context_over_cap names each length.
 * - A block (code 2, or a JSON block decision) writes the block text to stderr, no stdout, exit 2, and no later
 *   check runs.
 * - DEADLINE_MS from process start. A check starts only before DEADLINE_MS minus OUTPUT_RESERVE_MS, else
 *   skipped_deadline <id>. An async check over its deadline is cut (over_deadline <id>) and gives no output. A
 *   synchronous check cannot be preempted; its output is kept only when it ends before the overall deadline.
 * - process.env is restored after each check, so each check sees the env it would see alone.
 * - The busy cap of plan 10 is set once per process, so the turn has one room.db busy wait (option a). The check
 *   that trips it gets the stderr note room_db_busy_trip <id>; each later room.db check gets room_db_no_wait <id>.
 * - Turn marker (CONTEXT 5e (a)): state started with k at process start; state done in the stdout write callback only
 *   when the process ends by DEADLINE_MS. The next prompt of the session puts a typed skip note first in its context
 *   when earlier turns have no done. The marker holds v, k, state, pending and at only (no prompt bytes).
 * - Trace seam (opt in, MOS_USERPROMPT_TRACE an absolute path): one JSON line per event, ids, times and codes only.
 *
 * Node built-ins plus lib/core/hook-busy-cap.cjs and lib/statusline/next-move-cache.cjs. No Brain call, no network (Canon Part 8).
 * Hook plumbing only, not an invocable surface (Canon Part 11). Hyphens only, no dash characters.
 */
if (require.main === module) {
  // The intent-classifier CLI enabled the per-user compile cache in its own process; this process keeps that.
  try { require('../lib/core/hook-compile-cache.cjs').enableHookCompileCache(); } catch (_e) { /* the cache stays off */ }
}

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const hookBusyCap = require('../lib/core/hook-busy-cap.cjs');
const nextMoveCache = require('../lib/statusline/next-move-cache.cjs');

const DEADLINE_MS = 2500;
const OUTPUT_RESERVE_MS = 100;
const CONTEXT_SEPARATOR = '\n\n';
const CONTEXT_CAP_CHARS = 10000;
const NOTE_PREFIX = '[userprompt-dispatch] ';
// CONTEXT 5e (a): one turn marker file per session, ~/.mindrian/userprompt-turns/<session_id>.json, one writer (this file).
const TURN_MARKER_DIRNAME = 'userprompt-turns';

// The six checks in the order of the old hooks.json entries. Each load holds one string-literal require, so the
// hook require-graph walker (tests/test-369-hook-require-graph.cjs) can follow it.
const CHECKS = Object.freeze([
  Object.freeze({ id: 'admin-command-gate', file: 'scripts/admin-command-gate.cjs', argv: Object.freeze([]), budgetMs: 300, load: () => require('./admin-command-gate.cjs') }),
  Object.freeze({ id: 'intent-classifier', file: 'scripts/intent-classifier.cjs', argv: Object.freeze([]), budgetMs: 1800, load: () => require('./intent-classifier.cjs') }),
  Object.freeze({ id: 'first-install-router', file: 'scripts/first-install-router.cjs', argv: Object.freeze([]), budgetMs: 500, load: () => require('./first-install-router.cjs') }),
  Object.freeze({ id: 'brain-derivation-drain', file: 'scripts/brain-derivation-drain.cjs', argv: Object.freeze([]), budgetMs: 1000, load: () => require('./brain-derivation-drain.cjs') }),
  Object.freeze({ id: 'jtbd-update', file: 'scripts/jtbd-update.cjs', argv: Object.freeze(['userprompt']), budgetMs: 400, load: () => require('./jtbd-update.cjs') }),
  Object.freeze({ id: 'auto-explore-drain', file: 'scripts/auto-explore-drain.cjs', argv: Object.freeze([]), budgetMs: 900, load: () => require('./auto-explore-drain.cjs') }),
]);

// The checks that open room.db (the busy notes of Task 2 name only these).
const ROOM_DB_CHECKS = Object.freeze(['intent-classifier', 'brain-derivation-drain', 'jtbd-update', 'auto-explore-drain']);

function emptyView() {
  return { kind: 'none', context: null, systemMessage: null, stop: false, stopReason: null, blockText: null };
}

function trimEnd(s) { return String(s).replace(/\s+$/, ''); }

// hostView(result): what the host makes of one hook result {code, stdout, stderr}.
// kind is none, text, json or block. A context string loses its trailing whitespace.
function hostView(result) {
  const r = result || {};
  const code = Number.isInteger(r.code) ? r.code : 0;
  const stdout = typeof r.stdout === 'string' ? r.stdout : '';
  const stderr = typeof r.stderr === 'string' ? r.stderr : '';
  const v = emptyView();
  if (code === 2) { v.kind = 'block'; v.blockText = stderr; return v; }
  if (code !== 0) return v;
  const t = stdout.trim();
  if (!t) return v;
  if (t[0] === '{' && t[t.length - 1] === '}') {
    let o = null;
    try { o = JSON.parse(t); } catch (_e) { return v; } // a parse failure adds nothing
    if (!o || typeof o !== 'object' || Array.isArray(o)) return v;
    if (o.decision === 'block') { v.kind = 'block'; v.blockText = typeof o.reason === 'string' ? o.reason : ''; return v; }
    const hso = o.hookSpecificOutput;
    const ctx = hso && typeof hso === 'object' && typeof hso.additionalContext === 'string' ? trimEnd(hso.additionalContext) : '';
    if (ctx) v.context = ctx;
    if (typeof o.systemMessage === 'string' && o.systemMessage) v.systemMessage = o.systemMessage;
    if (o.continue === false) { v.stop = true; v.stopReason = typeof o.stopReason === 'string' ? o.stopReason : null; }
    v.kind = (v.context || v.systemMessage || v.stop) ? 'json' : 'none';
    return v;
  }
  const text = trimEnd(stdout);
  if (!text) return v;
  v.kind = 'text';
  v.context = text;
  return v;
}

// mergeViews(views, opts): the one host result of a list of views in check order. opts.skipNote (Task 2) is the first
// context when nothing blocks. Returns {block, code, blockText, stdout, envelope, contexts, joinedLength, lengths}.
function mergeViews(views, opts) {
  const o = opts || {};
  const list = Array.isArray(views) ? views : [];
  for (const v of list) {
    if (v && v.kind === 'block') {
      return { block: true, code: 2, blockText: v.blockText || '', stdout: '', envelope: null, contexts: [], joinedLength: 0, lengths: [] };
    }
  }
  const contexts = [];
  const lengths = [];
  const sys = [];
  let stop = null;
  if (typeof o.skipNote === 'string' && o.skipNote) { contexts.push(o.skipNote); lengths.push('skip_note=' + o.skipNote.length); }
  list.forEach((v, i) => {
    if (!v) return;
    if (v.context) { contexts.push(v.context); lengths.push((v.id || String(i)) + '=' + v.context.length); }
    if (v.systemMessage) sys.push(v.systemMessage);
    if (v.stop && !stop) stop = { stopReason: v.stopReason };
  });
  const envelope = { continue: !stop };
  if (stop && stop.stopReason) envelope.stopReason = stop.stopReason;
  if (sys.length) envelope.systemMessage = sys.join('\n');
  let joinedLength = 0;
  if (contexts.length) {
    const joined = contexts.join(CONTEXT_SEPARATOR);
    joinedLength = joined.length;
    envelope.hookSpecificOutput = { hookEventName: 'UserPromptSubmit', additionalContext: joined };
  }
  return { block: false, code: 0, blockText: null, stdout: JSON.stringify(envelope), envelope, contexts, joinedLength, lengths };
}

// The id of the check that runs now, and the abort of its race (the CLI uncaughtException handler uses both).
let _current = null;
let _abortCurrent = null;

// raceDeadline(fn, deadlineAt): the withTimeout race of scripts/sessionstart-coordinator.cjs, with a typed result.
function raceDeadline(fn, deadlineAt) {
  let timer = null;
  return new Promise((resolve) => {
    let settled = false;
    function settle(r) { if (settled) return; settled = true; if (timer) clearTimeout(timer); _abortCurrent = null; resolve(r); }
    _abortCurrent = () => settle({ threw: true });
    timer = setTimeout(() => settle({ timedOut: true }), Math.max(0, deadlineAt - Date.now()));
    Promise.resolve().then(fn).then((value) => settle({ value }), () => settle({ threw: true }));
  });
}

function restoreEnv(snap) {
  for (const k of Object.keys(process.env)) { if (!(k in snap)) delete process.env[k]; }
  for (const k of Object.keys(snap)) { if (process.env[k] !== snap[k]) process.env[k] = snap[k]; }
}

function isTripped() {
  // A read with no side effect: with the hook cap set (HOOK_BUSY_MS 750), 0 means the cap tripped.
  try { return hookBusyCap.capBusyMs(1) === 0; } catch (_e) { return false; }
}

// dispatch(input, opts): run the checks one at a time. Resolves {views, envelope, code, stdout, stderr, notes}.
// opts.checks (test seam, the CHECKS shape), opts.skipNote (Task 2), opts.processStartMs (test seam), opts.onTrace.
async function dispatch(input, opts) {
  const o = opts || {};
  const checks = Array.isArray(o.checks) ? o.checks : CHECKS;
  const startMs = Number.isFinite(o.processStartMs) ? o.processStartMs : Date.now() - process.uptime() * 1000;
  const stopAt = startMs + DEADLINE_MS - OUTPUT_RESERVE_MS;
  const trace = typeof o.onTrace === 'function' ? o.onTrace : () => {};
  const text = typeof input === 'string' ? input : '';
  const notes = [];
  const errParts = [];
  const views = [];
  function note(n) { notes.push(n); errParts.push(NOTE_PREFIX + n + '\n'); }
  let blocked = null;

  for (const c of checks) {
    if (Date.now() >= stopAt) {
      note('skipped_deadline ' + c.id);
      views.push({ id: c.id, outcome: 'skipped_deadline', view: emptyView(), ms: 0 });
      trace({ ev: 'end', id: c.id, outcome: 'skipped_deadline', trip: isTripped() });
      continue;
    }
    const t0 = Date.now();
    const deadlineAt = Math.min(t0 + (Number.isFinite(c.budgetMs) ? c.budgetMs : 0), stopAt);
    const trippedBefore = isTripped();
    if (trippedBefore && ROOM_DB_CHECKS.includes(c.id)) note('room_db_no_wait ' + c.id);
    trace({ ev: 'begin', id: c.id });
    const envSnap = Object.assign({}, process.env);
    let outcome = 'ok';
    let result = null;
    _current = c.id;
    try {
      let mod = null;
      try { mod = c.load(); } catch (_e) { mod = null; }
      if (!mod || typeof mod.run !== 'function') {
        outcome = 'check_load_failed';
      } else {
        const r = await raceDeadline(() => mod.run(text, { argv: Array.from(c.argv || []), deadlineAt }), deadlineAt);
        if (r.timedOut) outcome = 'over_deadline';
        else if (r.threw) outcome = 'check_threw';
        else if (Date.now() > stopAt) outcome = 'over_deadline';
        else result = r.value;
      }
    } finally {
      restoreEnv(envSnap);
      _current = null;
    }
    const trippedAfter = isTripped();
    if (!trippedBefore && trippedAfter) note('room_db_busy_trip ' + c.id);
    const view = result ? hostView(result) : emptyView();
    if (result && typeof result.stderr === 'string' && result.stderr && view.kind !== 'block') errParts.push(result.stderr);
    if (outcome !== 'ok') note(outcome + ' ' + c.id);
    if (view.kind === 'block') outcome = 'block';
    views.push({ id: c.id, outcome, view, ms: Date.now() - t0 });
    trace({ ev: 'end', id: c.id, outcome, trip: trippedAfter });
    if (view.kind === 'block') { blocked = view; break; }
  }

  const merged = mergeViews(views.map((x) => Object.assign({ id: x.id }, x.view)), { skipNote: blocked ? undefined : o.skipNote });
  if (merged.block) {
    return { views, envelope: null, code: 2, stdout: '', stderr: merged.blockText, notes, merged };
  }
  if (merged.joinedLength > CONTEXT_CAP_CHARS) note('context_over_cap ' + merged.joinedLength + ': ' + merged.lengths.join(', '));
  return { views, envelope: merged.envelope, code: 0, stdout: merged.stdout, stderr: errParts.join(''), notes, merged };
}

// ---------- the turn marker (CONTEXT 5e (a)) ----------

function homeDir() {
  return process.env.HOME || process.env.USERPROFILE || os.homedir();
}

// markerPath(sessionId, home): the marker file of one session, or null for an unsafe or missing id.
function markerPath(sessionId, home) {
  if (typeof sessionId !== 'string' || !nextMoveCache.SAFE_SESSION_RE.test(sessionId)) return null;
  return path.join(home || homeDir(), '.mindrian', TURN_MARKER_DIRNAME, sessionId + '.json');
}

function isCount(n) { return Number.isInteger(n) && n >= 0; }

// readMarker(p): {record} for a valid file, {record: null} for no file, {record: null, corrupt: true} for a bad file.
function readMarker(p) {
  let raw = null;
  try { raw = fs.readFileSync(p, 'utf8'); } catch (_e) { return { record: null }; }
  try {
    const o = JSON.parse(raw);
    if (o && typeof o === 'object' && o.v === 1 && isCount(o.k) && (o.state === 'started' || o.state === 'done') && isCount(o.pending)) {
      return { record: o };
    }
  } catch (_e) { /* corrupt */ }
  return { record: null, corrupt: true };
}

function writeMarker(p, rec) {
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const tmp = p + '.tmp-' + process.pid;
    fs.writeFileSync(tmp, JSON.stringify({ v: 1, k: rec.k, state: rec.state, pending: rec.pending, at: rec.at }), 'utf8');
    fs.renameSync(tmp, p);
    return true;
  } catch (_e) {
    return false;
  }
}

function pushNote(notes, n) { if (Array.isArray(notes)) notes.push(n); }

// beginTurn(sessionId, {home, now, notes}): write state started with the next k. Returns {path, k, carry}, or null with
// the note turn_marker_no_session or turn_marker_write_failed. carry is the number of earlier prompts with no help.
// Never throws.
function beginTurn(sessionId, opts) {
  const o = opts || {};
  try {
    const p = markerPath(sessionId, o.home);
    if (!p) { pushNote(o.notes, 'turn_marker_no_session'); return null; }
    const got = readMarker(p);
    if (got.corrupt) pushNote(o.notes, 'turn_marker_corrupt');
    const prior = got.record;
    let carry = 0;
    if (prior && prior.state === 'started') carry = prior.pending + 1;
    else if (prior && prior.state === 'done') carry = prior.pending;
    const k = (prior ? prior.k : 0) + 1;
    const now = Number.isFinite(o.now) ? o.now : Date.now();
    if (!writeMarker(p, { k, state: 'started', pending: carry, at: now })) { pushNote(o.notes, 'turn_marker_write_failed'); return null; }
    if (k % 20 === 1) nextMoveCache.pruneSessionDir(path.dirname(p), p);
    return { path: p, k, carry };
  } catch (_e) {
    pushNote(o.notes, 'turn_marker_write_failed');
    return null;
  }
}

// formatSkipNote(n): the one typed note the model sees after a missed turn.
function formatSkipNote(n) {
  return 'MindrianOS prompt help was skipped on ' + n + ' earlier prompt(s): hook_timeout';
}

// endTurn(info, {delivered, elapsedMs, notes, now}): write state done when the process ends in time. Late: write
// nothing, so the record stays started and the next prompt counts this turn. Returns true when it wrote. Never throws.
function endTurn(info, opts) {
  const o = opts || {};
  if (!info) return false;
  const elapsed = Math.round(Number(o.elapsedMs) || 0);
  if (elapsed > DEADLINE_MS) { pushNote(o.notes, 'turn_marker_late ' + elapsed); return false; }
  const now = Number.isFinite(o.now) ? o.now : Date.now();
  return writeMarker(info.path, { k: info.k, state: 'done', pending: o.delivered ? 0 : info.carry, at: now });
}

// finishDispatch(result, onFlushed, onExit): the order of finishCli of lib/core/hook-io.cjs (stdout, then stderr, then
// exit), with one call of onFlushed(wrote) for the turn marker. With stdout: onFlushed(true) runs synchronously in the
// stdout write callback, before the stderr write; a string it returns is added to stderr. With no stdout (a block, or
// nothing to say): onFlushed(false) runs in the stderr write callback, before the exit. onExit(code) runs just before
// process.exit.
function finishDispatch(result, onFlushed, onExit) {
  const r = result || {};
  const code = Number.isInteger(r.code) ? r.code : 0;
  const stdout = typeof r.stdout === 'string' ? r.stdout : '';
  let stderr = typeof r.stderr === 'string' ? r.stderr : '';
  let flushed = false;
  function flush(wrote) {
    if (flushed) return '';
    flushed = true;
    try { const extra = typeof onFlushed === 'function' ? onFlushed(wrote) : ''; return typeof extra === 'string' ? extra : ''; } catch (_e) { return ''; }
  }
  function done() {
    if (!stdout) flush(false);
    try { if (typeof onExit === 'function') onExit(code); } catch (_e) { /* the exit still happens */ }
    process.exit(code);
  }
  function writeErr() {
    if (!stderr) return done();
    try { process.stderr.write(stderr, done); } catch (_e) { done(); }
  }
  if (!stdout) return writeErr();
  try {
    process.stdout.write(stdout, () => { stderr += flush(true); writeErr(); });
  } catch (_e) { writeErr(); }
}

// ---------- the trace seam (plan 400.5-05 G11 diagnosis) ----------

function makeTracer(env, getK) {
  const p = env && env.MOS_USERPROMPT_TRACE;
  if (typeof p !== 'string' || !p || !path.isAbsolute(p)) return () => {};
  return (ev) => {
    try {
      const line = { ev: ev.ev, k: getK(), t: Math.round(process.uptime() * 1000) };
      if (ev.id !== undefined) line.id = ev.id;
      if (ev.outcome !== undefined) line.outcome = ev.outcome;
      if (ev.trip !== undefined) line.trip = !!ev.trip;
      if (ev.code !== undefined) line.code = ev.code;
      if (ev.elapsed_ms !== undefined) line.elapsed_ms = ev.elapsed_ms;
      fs.appendFileSync(p, JSON.stringify(line) + '\n');
    } catch (_e) { /* an append error is swallowed */ }
  };
}

function sessionIdOf(input) {
  try { const o = JSON.parse(input); return o && typeof o === 'object' && typeof o.session_id === 'string' ? o.session_id : null; } catch (_e) { return null; }
}

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch (_e) { return ''; }
}

if (require.main === module) {
  process.on('uncaughtException', () => {
    // A check threw outside its promise chain: end its race now, with no output from it.
    if (_abortCurrent) _abortCurrent();
  });
  const input = readStdin();
  let info = null;
  const trace = makeTracer(process.env, () => (info ? info.k : null));
  const preNotes = [];
  info = beginTurn(sessionIdOf(input), { notes: preNotes });
  trace({ ev: 'start' });
  hookBusyCap.setHookBusyCap(hookBusyCap.HOOK_BUSY_MS);
  const skipNote = info && info.carry > 0 ? formatSkipNote(info.carry) : undefined;
  const preText = preNotes.map((n) => NOTE_PREFIX + n + '\n').join('');
  const finish = (r) => {
    const heldNote = !!(skipNote && r.code === 0 && r.merged && r.merged.contexts && r.merged.contexts[0] === skipNote);
    const out = r.code === 2 ? r : Object.assign({}, r, { stderr: preText + (r.stderr || '') });
    finishDispatch(out, (wrote) => {
      const late = [];
      endTurn(info, { delivered: (wrote && (!skipNote || heldNote)) || !!(info && info.carry === 0), elapsedMs: process.uptime() * 1000, notes: late });
      return late.map((n) => NOTE_PREFIX + n + '\n').join('');
    }, (code) => trace({ ev: 'exit', code, elapsed_ms: Math.round(process.uptime() * 1000) }));
  };
  dispatch(input, { skipNote, onTrace: trace }).then(finish, () => finish({ code: 0, stdout: JSON.stringify({ continue: true }), stderr: '' }));
}

module.exports = {
  CHECKS, ROOM_DB_CHECKS, DEADLINE_MS, OUTPUT_RESERVE_MS, CONTEXT_SEPARATOR, CONTEXT_CAP_CHARS,
  TURN_MARKER_DIRNAME,
  hostView, mergeViews, dispatch, markerPath, beginTurn, endTurn, formatSkipNote, finishDispatch,
};
