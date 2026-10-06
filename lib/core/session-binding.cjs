'use strict';
// PSB-01 -- global per-session room binding file.
//
// Canon Part 8 (LOCAL only): this module reads and writes a single JSON per
// session under $MINDRIAN_ROOMS_HOME/.rooms/sessions/<sessionId>.json. It carries
// ZERO Brain egress and zero network token; the Part 8 local-only floor greps
// this file first. Every reader parses in try/catch and returns a frozen-shaped
// safe default (never throws into a hook); every writer is atomic (tmp + fsync +
// rename) and fire-and-forget. No em-dashes.
//
// Schema: { bound: [slug SET], primary: slug|null, sticky: bool, updated: ISO }.
// `bound` is a SET ("my rooms" this session may write to); `primary` is the
// default write target; `sticky` pins the primary across resolution. This is the
// GLOBAL binding -- distinct from the PER-ROOM presence ledger in
// session-presence.cjs (do not conflate the two files).

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// The shape a corrupt or missing binding file collapses to. A fresh object is
// returned on every call so a caller can never mutate a shared default
// (T-194-03: corrupt JSON -> safe default, never throw).
function safeDefault() {
  return { bound: [], primary: null, sticky: false };
}

function resolveHome(opts) {
  if (opts && typeof opts.home === 'string' && opts.home.length > 0) return opts.home;
  const env = process.env.MINDRIAN_ROOMS_HOME || process.env.MINDRIAN_ROOMS_ROOT;
  if (typeof env === 'string' && env.length > 0) return env;
  return path.join(os.homedir(), 'MindrianRooms');
}

function sessionsDir(home) {
  return path.join(home, '.rooms', 'sessions');
}

// Path-traversal guard (Security V5 / T-194-04): a slug that carries a `..`
// segment could climb out of the rooms root when later used as a write index.
// Reject it BEFORE it is accepted into bound/primary or used as a filename. The
// reserved dev-repo sentinel `__no_room__` is allowed (it has no `..`). This is a
// containment check, not an existence check: a slug naming a room not yet on disk
// still round-trips, so the on-disk existence gate stays at the resolver.
function isSafeSlug(slug) {
  if (typeof slug !== 'string' || slug.length === 0) return false;
  if (slug.indexOf('..') !== -1) return false;
  const segs = slug.split(/[\\/]/);
  for (const s of segs) {
    if (s === '..') return false;
  }
  return true;
}

function readSessionBinding(sessionId, opts) {
  try {
    if (!isSafeSlug(sessionId)) return safeDefault();
    const home = resolveHome(opts);
    const filePath = path.join(sessionsDir(home), sessionId + '.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return safeDefault();
    const bound = Array.isArray(parsed.bound) ? parsed.bound.filter(isSafeSlug) : [];
    const primary = (typeof parsed.primary === 'string' && isSafeSlug(parsed.primary))
      ? parsed.primary
      : null;
    const sticky = parsed.sticky === true;
    return { bound: bound, primary: primary, sticky: sticky };
  } catch (_) {
    // Missing file, non-JSON, or any other read failure -> safe default. Never
    // throw into the calling hook (mirrors resolve-active-room null-on-parse-fail).
    return safeDefault();
  }
}

// The reserved dev-repo/no-room sentinel. A session that chose "dev repo / no
// room" writes nowhere room-scoped, so the write-guard must never block it.
const NO_ROOM_SLUG = '__no_room__';

// isRoomInWriteScope -- the ONE set-membership predicate the PSB-07 write-guard
// composes (Part 11: born WIRED, no new selector shape). A room is in write
// scope iff it is a MEMBER of this session's bound SET, with three fail-OPEN
// carve-outs so the guard tightens ONLY on a genuine off-bound write:
//   1. the reserved `__no_room__` sentinel is ALWAYS in scope (a dev-repo/no-room
//      write targets nothing room-scoped -- never block it);
//   2. a session whose bound SET carries `__no_room__` chose dev-repo/no-room, so
//      it does not gate room writes (the false plugin-CLAUDE.md block is gone);
//   3. an UNBOUND session (empty bound) degrades to the pre-194 allow-all -- the
//      per-session guard only bites once the session has declared its room set.
//   4. (quick task 260728-051) ANCESTOR-CHAIN widening: a room whose ANCESTOR is
//      bound is in scope, via the optional 3rd param `ancestorChain`. Live root
//      cause: a session bound to `motj-ecosystem` could not write into its own
//      registered sub-room `jonathan-contractor-motj` without a SECOND, separate
//      room_bind call, because this predicate was flat while the TARGET side of
//      the guard (write-scope-check.cjs targetRoomUnderRoot) was already
//      nesting-aware via SEED-004. Binding to a parent now reasonably extends
//      write scope to that parent's own registered children. The caller resolves
//      the chain (write-scope-check.cjs resolveAncestorChain walks the registry
//      `parent` field); this predicate only tests membership, so it stays the one
//      pure set-membership shape. Purely additive: a 2-arg call site is
//      unchanged, and an empty/absent/non-array chain widens nothing.
// This is the write-guard dual of resolve-active-room.resolveSessionScope: the
// tripwire's `onScope` fires the F.8 gate on an unbound session, but the
// write-guard must NOT hard-block one (fail-open, PSB-06). NEVER throws.
function isRoomInWriteScope(room, binding, ancestorChain) {
  try {
    if (room === NO_ROOM_SLUG) return true;
    const bound = (binding && Array.isArray(binding.bound)) ? binding.bound : [];
    if (bound.indexOf(NO_ROOM_SLUG) !== -1) return true;
    if (bound.length === 0) return true;
    // Exact match wins first: a directly bound room needs no ancestor lookup.
    if (bound.indexOf(room) !== -1) return true;
    // Ancestor widening. Coerce defensively: a non-array (undefined from a 2-arg
    // call site, or a malformed value) degrades to zero widening, never a throw.
    const chain = Array.isArray(ancestorChain) ? ancestorChain : [];
    for (const ancestor of chain) {
      if (bound.indexOf(ancestor) !== -1) return true;
    }
    return false;
  } catch (_) {
    // Fail-open: any predicate failure allows the write (a false block is worse
    // than a false allow). Mirrors the 83-06 write-guard contract.
    return true;
  }
}

// resolveEffectiveSessionId -- the ONE shared implementation of the MCP-`extra`
// session-id precedence: explicit param > SDK extra.sessionId > env var >
// process-scoped stdio key > null.
// RCA registry-active-room-concurrent-session-collision: on the stdio transport
// (local Claude Code CLI) the MCP SDK never populates extra.sessionId, so a bare
// `(extra && extra.sessionId) || undefined` fails to resolve a session id and
// falls through to the wrong machine-wide path. room_bind already carried this
// 3-tier fallback (tool-router.cjs, the effectiveSessionId computation); this
// helper extracts it verbatim so room_bind and all 20 sibling call sites share
// ONE copy (Canon Part 7, reuse before build). Returns null (never undefined,
// never throws) when nothing resolves, matching room_bind's no_session_id
// fail-closed contract. Distinct name from the 3 hook/CLI resolveSessionId
// resolvers (SEED-034, the four-guessers lesson) -- this one is MCP-extra-scoped.
//
// RCA desktop-session-binding-fallback (navigator ruling 2026-10-02): the 4th
// tier. Claude Desktop is stdio with NO session id anywhere (no env var, no SDK
// extra.sessionId), so tiers 1-3 all came up empty and room_bind failed with
// no_session_id; a binding written under a model-invented explicit id was
// orphaned because no later call could present that key; and every unbound
// write fell through to the machine-wide registry `active` room. A stdio server
// process serves exactly ONE client connection, so one key minted once per
// process IS that conversation's identity: naturally per-window, distinct across
// Desktop windows. Only the stdio serve path registers it
// (registerStdioProcessSession, called from bin/mindrian-mcp-server.cjs). A
// process that never registers one (a web-transport daemon serving many clients,
// an in-process test, a CLI script) still resolves null, so no_session_id and
// every caller that depends on it are unchanged. The key is LOCAL only (Canon
// Part 8/9): it names a binding file under .rooms/sessions and nothing else.
function resolveEffectiveSessionId(explicitSessionId, extra) {
  return explicitSessionId
    || (extra && extra.sessionId)
    || process.env.CLAUDE_CODE_SESSION_ID
    || _stdioProcessSessionKey
    || null;
}

// The ONE process-scoped stdio session key. Module state (not an env var) on
// purpose: a spawned child process must never inherit it and bind as this
// conversation.
let _stdioProcessSessionKey = null;

// registerStdioProcessSession -- mint the key once for this process and return
// it. Idempotent: a second call returns the SAME key. Shape
// `stdio-<pid>-<12 hex>`: the pid makes a stale binding file attributable to a
// dead process, the random tail keeps a recycled pid from inheriting an old
// conversation's binding. isSafeSlug-clean by construction (no `..`, no slash).
function registerStdioProcessSession() {
  if (_stdioProcessSessionKey) return _stdioProcessSessionKey;
  let tail = '';
  try {
    tail = require('node:crypto').randomBytes(6).toString('hex');
  } catch (_e) {
    tail = (Date.now().toString(16) + Math.random().toString(16).slice(2)).slice(0, 12);
  }
  _stdioProcessSessionKey = 'stdio-' + process.pid + '-' + tail;
  return _stdioProcessSessionKey;
}

// getStdioProcessSessionKey -- the registered key, or null when this process
// never registered one. Read-only; never mints.
function getStdioProcessSessionKey() {
  return _stdioProcessSessionKey;
}

// writeSessionBinding -- the atomic writer. Never throws into a hook. Phase 369.25
// (RFT-03, research Pitfall 10): it now RETURNS a result instead of swallowing every
// failure, so a caller can tell "the file was written" from "the write did not
// happen". { ok:true, file } | { ok:false, reason:'unsafe_session_id' } |
// { ok:false, reason:'binding_write_failed', detail }. Callers that ignore the
// return keep the old fire-and-forget behavior.
function writeSessionBinding(sessionId, binding, opts) {
  try {
    if (!isSafeSlug(sessionId)) return { ok: false, reason: 'unsafe_session_id' };
    const home = resolveHome(opts);
    const dir = sessionsDir(home);
    try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
    const filePath = path.join(dir, sessionId + '.json');

    const src = (binding && typeof binding === 'object') ? binding : {};

    // `bound` is a SET (D-01): dedupe on write, drop any traversal slug.
    const seen = new Set();
    const bound = [];
    const rawBound = Array.isArray(src.bound) ? src.bound : [];
    for (const slug of rawBound) {
      if (!isSafeSlug(slug)) continue;
      if (seen.has(slug)) continue;
      seen.add(slug);
      bound.push(slug);
    }
    const primary = (typeof src.primary === 'string' && isSafeSlug(src.primary))
      ? src.primary
      : null;
    const sticky = src.sticky === true;

    const data = {
      bound: bound,
      primary: primary,
      sticky: sticky,
      updated: new Date().toISOString(),
    };

    // Atomic tmp + fsync + rename, cloned from intent-classifier
    // persistDecisionTrace: a crash mid-write never corrupts the live file.
    const rnd = Math.random().toString(36).slice(2, 10);
    const tmpPath = filePath + '.tmp.' + process.pid + '.' + rnd + '.bind';
    let fd;
    try {
      fd = fs.openSync(tmpPath, 'wx');
    } catch (e) {
      if (e && e.code === 'EEXIST') {
        try { fs.unlinkSync(tmpPath); } catch (_) {}
        try {
          fd = fs.openSync(tmpPath, 'wx');
        } catch (e2) {
          return { ok: false, reason: 'binding_write_failed', detail: String((e2 && e2.message) || e2).slice(0, 160) };
        }
      } else {
        return { ok: false, reason: 'binding_write_failed', detail: String((e && e.message) || e).slice(0, 160) };
      }
    }
    try {
      fs.writeSync(fd, JSON.stringify(data, null, 2));
      try { fs.fsyncSync(fd); } catch (_) {
        // ENOTSUP on tmpfs / overlayfs -- best-effort durability is acceptable.
      }
    } catch (e) {
      try { fs.closeSync(fd); } catch (_) {}
      try { fs.unlinkSync(tmpPath); } catch (_) {}
      return { ok: false, reason: 'binding_write_failed', detail: String((e && e.message) || e).slice(0, 160) };
    }
    try { fs.closeSync(fd); } catch (_) {}
    try {
      fs.renameSync(tmpPath, filePath);
    } catch (e) {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
      return { ok: false, reason: 'binding_write_failed', detail: String((e && e.message) || e).slice(0, 160) };
    }
    return { ok: true, file: filePath };
  } catch (e) {
    // Never rethrows into a hook; the failure is reported, not hidden.
    return { ok: false, reason: 'binding_write_failed', detail: String((e && e.message) || e).slice(0, 160) };
  }
}

// addSessionRoom -- the ONE add-and-primary verb (369.25 RID-10, ruling 2026-10-06:
// birth, room_bind and openRoom all ADD the room to the session's bound set and make
// it primary). Appends the slug when absent (order of first add kept), makes it
// primary, keeps sticky, writes, then READS BACK before it reports effective, so a
// binding that did not persist is never reported as one. Never throws.
// Returns { ok, effective, bound, primary, reason? }.
function addSessionRoom(sessionId, slug, opts) {
  try {
    if (!isSafeSlug(sessionId)) return { ok: false, effective: false, bound: [], primary: null, reason: 'unsafe_session_id' };
    if (!isSafeSlug(slug)) return { ok: false, effective: false, bound: [], primary: null, reason: 'unsafe_slug' };
    const prior = readSessionBinding(sessionId, opts);
    const bound = prior.bound.indexOf(slug) === -1 ? prior.bound.concat([slug]) : prior.bound.slice();
    const wrote = writeSessionBinding(sessionId, { bound: bound, primary: slug, sticky: prior.sticky }, opts);
    if (!wrote || wrote.ok !== true) {
      return {
        ok: false,
        effective: false,
        bound: prior.bound,
        primary: prior.primary,
        reason: (wrote && wrote.reason) || 'binding_write_failed',
      };
    }
    const back = readSessionBinding(sessionId, opts);
    const effective = back.primary === slug && back.bound.indexOf(slug) !== -1;
    const out = { ok: true, effective: effective, bound: back.bound, primary: back.primary };
    if (!effective) out.reason = 'binding_readback_failed';
    return out;
  } catch (e) {
    return { ok: false, effective: false, bound: [], primary: null, reason: 'binding_write_failed' };
  }
}

// unbindSessionRoom -- the only removal verb (ruling 2026-10-06: a room leaves the
// set only by an explicit unbind). When the removed room was primary, primary becomes
// the last remaining member, or null when the set is empty. A slug that is not in the
// set returns { ok:true, changed:false } and writes nothing. Reads back after the
// write. Never throws. Returns { ok, changed, bound, primary, reason? }.
function unbindSessionRoom(sessionId, slug, opts) {
  try {
    if (!isSafeSlug(sessionId)) return { ok: false, changed: false, bound: [], primary: null, reason: 'unsafe_session_id' };
    if (!isSafeSlug(slug)) return { ok: false, changed: false, bound: [], primary: null, reason: 'unsafe_slug' };
    const prior = readSessionBinding(sessionId, opts);
    if (prior.bound.indexOf(slug) === -1) {
      return { ok: true, changed: false, bound: prior.bound, primary: prior.primary };
    }
    const bound = prior.bound.filter(function (b) { return b !== slug; });
    let primary = prior.primary;
    if (primary === slug || (primary !== null && bound.indexOf(primary) === -1)) {
      primary = bound.length > 0 ? bound[bound.length - 1] : null;
    }
    const wrote = writeSessionBinding(sessionId, { bound: bound, primary: primary, sticky: prior.sticky }, opts);
    if (!wrote || wrote.ok !== true) {
      return { ok: false, changed: false, bound: prior.bound, primary: prior.primary, reason: (wrote && wrote.reason) || 'binding_write_failed' };
    }
    const back = readSessionBinding(sessionId, opts);
    const gone = back.bound.indexOf(slug) === -1;
    const out = { ok: true, changed: gone, bound: back.bound, primary: back.primary };
    if (!gone) { out.ok = false; out.reason = 'binding_readback_failed'; }
    return out;
  } catch (e) {
    return { ok: false, changed: false, bound: [], primary: null, reason: 'binding_write_failed' };
  }
}

// Phase 360 (N-2): exported so lib/core/room-bind-picker-policy.cjs has one
// definition of the sentinel to compose, never a re-typed literal of its own.
module.exports = { readSessionBinding, writeSessionBinding, addSessionRoom, unbindSessionRoom, isSafeSlug, isRoomInWriteScope, resolveEffectiveSessionId, registerStdioProcessSession, getStdioProcessSessionKey, NO_ROOM_SLUG };
