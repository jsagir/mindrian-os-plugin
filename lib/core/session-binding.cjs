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

function writeSessionBinding(sessionId, binding, opts) {
  try {
    if (!isSafeSlug(sessionId)) return;
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
        fd = fs.openSync(tmpPath, 'wx');
      } else {
        return;
      }
    }
    try {
      fs.writeSync(fd, JSON.stringify(data, null, 2));
      try { fs.fsyncSync(fd); } catch (_) {
        // ENOTSUP on tmpfs / overlayfs -- best-effort durability is acceptable.
      }
    } finally {
      try { fs.closeSync(fd); } catch (_) {}
    }
    try {
      fs.renameSync(tmpPath, filePath);
    } catch (_) {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
    }
  } catch (_) {
    // Fire-and-forget: a write failure never rethrows into a hook.
  }
}

module.exports = { readSessionBinding, writeSessionBinding, isSafeSlug };
