'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 227 Plan-01 (D-01/D-02) -- the mode-select lane-pick side-channel
 * writer + reader.
 *
 * The session-start mode-selection Decision Gate (skills/conversation-mode/
 * SKILL.md, hitl_shape F.1) is today enforced by prose alone; nothing
 * anywhere records whether it fired or a default was explicitly stated, so a
 * silent skip is structurally invisible. This module is that producer's
 * shared writer/reader. Wiring the actual call sites
 * (lib/hmi/selector-dispatcher.cjs and conversation-mode.md's
 * default-stated branch) is plan 227-04, which depends on this plan's
 * exports existing first; lib/core/doctor/mode-select-checkpoint-module.cjs
 * (plan 227-01 task 2) is the reader-side consumer.
 *
 * PATTERN MIRROR, NOT FILE REUSE (D-01): this module mirrors
 * lib/core/card-fire-sidechannel.cjs's pattern exactly (session-scoped,
 * atomic tmp-file+rename writes, never-throw, size-capped, bare-key-scoped
 * record storage) but does NOT reuse that module's store file or its
 * ~10-minute turn-scoped TTL. card-fire-sidechannel.cjs's TTL is deliberately
 * short because it catches a skip within the same Stop-hook cycle. A
 * session-start lane-pick record needs to survive far longer than one
 * Stop-hook cycle -- it must live for the whole session, so this module uses
 * its own store file and a 24-hour, session-lifetime TTL ceiling instead (see
 * TTL_MS below).
 *
 * Never-throw contract: every fs operation is wrapped in try/catch. A read
 * failure (missing file, corrupt JSON, an oversized file) degrades to []; a
 * write failure is a silent no-op. Neither ever blocks a caller or crashes it.
 *
 * TTL (24 hours -- a session-lifetime ceiling, NOT card-fire-sidechannel.cjs's
 * 10-minute turn-scoped TTL, see D-02) + size cap (64KB, oldest-first
 * truncation) keep the side-file bounded. Writes are atomic (tmp file +
 * rename) so a crash mid-write cannot corrupt the file for a concurrent
 * reader.
 *
 * Canon Part 8: records carry only { lane: <permissive scalar>, ts: <epoch
 * ms> } -- zero user text, zero room content, LOCAL only (~/.mindrian). No
 * Brain require, no network. House rule: hyphens only, no em-dashes.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// D-02: a session-lifetime ceiling, deliberately NOT card-fire-sidechannel
// .cjs's 10-minute turn-scoped TTL -- this is a session-start lane-pick
// record that must survive far longer than one Stop-hook cycle.
const TTL_MS = 24 * 60 * 60 * 1000;

// Oldest-first truncation kicks in above this size, mirroring
// card-fire-sidechannel.cjs's own bound.
const SIZE_CAP_BYTES = 64 * 1024;

// A record with no resolvable sessionId files under this degenerate bucket
// rather than being dropped silently, mirroring card-fire-sidechannel.cjs's
// NO_SESSION_KEY idiom: at least one producer call site never has a
// sessionId in scope, and readLanePick unions this bucket into every read.
const NO_SESSION_KEY = 'no-session';

/**
 * sideFilePath(opts) -- resolve the side-file path. Precedence: an explicit
 * opts.filePath (the test seam) > the MODE_SELECT_SIDECHANNEL_PATH env var
 * (a second test/ops seam) > the default
 * ~/.mindrian/mode-select-lane-picks.json (MINDRIAN_HOME override honored,
 * matching card-fire-sidechannel.cjs's own resolution order).
 */
function sideFilePath(opts) {
  if (opts && typeof opts.filePath === 'string' && opts.filePath.length > 0) {
    return opts.filePath;
  }
  const envOverride = process.env.MODE_SELECT_SIDECHANNEL_PATH;
  if (typeof envOverride === 'string' && envOverride.length > 0) {
    return envOverride;
  }
  const home = process.env.MINDRIAN_HOME || path.join(os.homedir(), '.mindrian');
  return path.join(home, 'mode-select-lane-picks.json');
}

/**
 * readStoreRaw(filePath) -- read + parse the side-file. Degrades to {} on
 * ANY fault: missing file, corrupt JSON, a non-object root, or a
 * pathologically oversized file (guarded well above the write-time cap so a
 * read never has to fully parse a multi-MB externally-corrupted blob). Never
 * throws.
 */
function readStoreRaw(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    if (Buffer.byteLength(raw, 'utf8') > SIZE_CAP_BYTES * 4) {
      return {};
    }
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  } catch (_e) {
    return {};
  }
}

/**
 * pruneStore(store, now) -- drop entries older than TTL_MS; drop a session
 * key entirely once its record list is empty. Pure; never throws.
 */
function pruneStore(store, now) {
  const t = Number.isFinite(now) ? now : Date.now();
  const out = {};
  const src = store && typeof store === 'object' ? store : {};
  for (const sid of Object.keys(src)) {
    const list = Array.isArray(src[sid]) ? src[sid] : [];
    const kept = list.filter(function (rec) {
      return (
        rec &&
        typeof rec === 'object' &&
        typeof rec.lane === 'string' &&
        Number.isFinite(rec.ts) &&
        t - rec.ts <= TTL_MS
      );
    });
    if (kept.length > 0) out[sid] = kept;
  }
  return out;
}

/**
 * enforceSizeCap(store) -- oldest-first truncation across ALL sessions until
 * the serialized store fits SIZE_CAP_BYTES. Mutates and returns a plain
 * object (safe: only ever called on a freshly-pruned store this function
 * owns). Never throws (JSON.stringify on this shape cannot throw).
 */
function enforceSizeCap(store) {
  let serialized = JSON.stringify(store);
  if (Buffer.byteLength(serialized, 'utf8') <= SIZE_CAP_BYTES) return store;

  const flat = [];
  for (const sid of Object.keys(store)) {
    for (const rec of store[sid]) {
      flat.push({ sid: sid, rec: rec });
    }
  }
  flat.sort(function (a, b) {
    return a.rec.ts - b.rec.ts;
  });

  let idx = 0;
  while (Buffer.byteLength(serialized, 'utf8') > SIZE_CAP_BYTES && idx < flat.length) {
    const victim = flat[idx];
    const list = store[victim.sid];
    if (Array.isArray(list)) {
      const pos = list.indexOf(victim.rec);
      if (pos !== -1) list.splice(pos, 1);
      if (list.length === 0) delete store[victim.sid];
    }
    idx += 1;
    serialized = JSON.stringify(store);
  }
  return store;
}

/**
 * writeStoreAtomic(filePath, store) -- prune + size-cap, then write via a
 * tmp-file-plus-rename (atomic on the same filesystem), so a crash mid-write
 * cannot leave a concurrent reader with a torn/partial file. Best-effort: any
 * failure is swallowed (never block a producer call site on a side-file
 * fault).
 */
function writeStoreAtomic(filePath, store) {
  try {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    const now = Date.now();
    const pruned = pruneStore(store, now);
    const capped = enforceSizeCap(pruned);
    const tmp = filePath + '.tmp-' + process.pid + '-' + now;
    fs.writeFileSync(tmp, JSON.stringify(capped), 'utf8');
    fs.renameSync(tmp, filePath);
  } catch (_e) {
    /* best-effort; never block a producer call site on a side-file fault */
  }
}

/**
 * recordLanePick({ lane, sessionId, filePath? }) -- append a lane-pick
 * record for this session. `lane` is a permissive, non-strictly-validated
 * scalar (for example 'card-fired' or 'default-stated', see plan 227-04's
 * call sites), mirroring card-fire-sidechannel.cjs's own permissive `shape`
 * field. A missing/empty lane is a silent no-op (nothing meaningful to
 * record). A missing sessionId files under NO_SESSION_KEY rather than being
 * dropped. Never throws.
 */
function recordLanePick(opts) {
  try {
    const o = opts && typeof opts === 'object' ? opts : {};
    const lane = typeof o.lane === 'string' && o.lane.length > 0 ? o.lane : '';
    if (!lane) return;
    const sessionId =
      typeof o.sessionId === 'string' && o.sessionId.length > 0 ? o.sessionId : NO_SESSION_KEY;

    const filePath = sideFilePath(o);
    const store = readStoreRaw(filePath);
    const list = Array.isArray(store[sessionId]) ? store[sessionId] : [];
    list.push({
      lane: lane,
      ts: Date.now(),
    });
    store[sessionId] = list;
    writeStoreAtomic(filePath, store);
  } catch (_e) {
    /* never throw out of a producer call site */
  }
}

/**
 * readLanePick(sessionId, opts?) -- return the TTL-filtered array of
 * { lane, ts } records recorded for this session. A missing/empty sessionId
 * reads the NO_SESSION_KEY bucket only. When sessionId IS provided, the
 * session-scoped bucket is UNIONED with the NO_SESSION_KEY bucket, mirroring
 * card-fire-sidechannel.cjs's readReachedGates union-read behavior: at least
 * one producer call site (plan 227-04's selector-dispatcher.cjs wiring) may
 * have no sessionId in scope at its mint point, and records under
 * NO_SESSION_KEY, so a session-scoped consumer lookup still surfaces it. Any
 * fault (missing file, corrupt JSON, oversized file) degrades to []. Never
 * throws.
 */
function readLanePick(sessionId, opts) {
  try {
    const filePath = sideFilePath(opts);
    const raw = readStoreRaw(filePath);
    const pruned = pruneStore(raw, Date.now());
    const sid = typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : NO_SESSION_KEY;

    const lists = [Array.isArray(pruned[sid]) ? pruned[sid] : []];
    if (sid !== NO_SESSION_KEY) {
      lists.push(Array.isArray(pruned[NO_SESSION_KEY]) ? pruned[NO_SESSION_KEY] : []);
    }

    const out = [];
    for (const list of lists) {
      for (const rec of list) {
        if (rec && typeof rec.lane === 'string' && rec.lane.length > 0) {
          out.push({ lane: rec.lane, ts: rec.ts });
        }
      }
    }
    return out;
  } catch (_e) {
    return [];
  }
}

module.exports = {
  recordLanePick: recordLanePick,
  readLanePick: readLanePick,
  sideFilePath: sideFilePath,
  TTL_MS: TTL_MS,
  SIZE_CAP_BYTES: SIZE_CAP_BYTES,
  NO_SESSION_KEY: NO_SESSION_KEY,
};
