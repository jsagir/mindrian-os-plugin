'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 209-06 (H3) -- the PRIMARY side-channel writer + reader.
 *
 * scripts/check-card-fire.cjs's PRIMARY (registry-keyed) detection has been
 * documented INERT since Phase 179: "a repo-wide grep finds ZERO producers
 * of ran_entries / reached_gate_entries" (its own doctrine header, :46-54).
 * This module is that producer's shared writer/reader, called from the
 * three places that mint a Shape-F gate envelope (H3's three sites):
 *   1. lib/hmi/selector-dispatcher.cjs's pickShape trailer door
 *   2. scripts/intent-classifier.cjs's engine-arm seam
 *   3. scripts/intent-classifier.cjs's emitBindingGate (F.8)
 *
 * SCHEMA NOTE (a deliberate departure from the plan's illustrative "surface#
 * shape" example): scripts/check-card-fire.cjs's gateReachingEntries() derives
 * its PRIMARY match set from data/render-coverage-registry.json's .cjs-
 * keyspace `entry` field, which is a BARE FILE PATH (e.g.
 * "lib/hmi/selector-dispatcher.cjs") with no "#shape" suffix (verified
 * live: every .cjs entry's `entry` value is the bare path). classifyCardFire
 * intersects `ran_entries` against that exact string set
 * (`ran.some(e => reaching.has(e))`). Recording "surface#shape" composite
 * strings would therefore NEVER intersect the registry and PRIMARY would
 * stay functionally inert despite being "wired" - the opposite of this
 * plan's purpose. So `readReachedGates` returns BARE surface-path strings
 * (matching the registry exactly); `shape` is still recorded and stored
 * per-entry for diagnostics, it is simply not concatenated into the
 * matched key.
 *
 * Never-throw contract (T-209-24): every fs operation is wrapped in
 * try/catch. A read failure (missing file, corrupt JSON, an oversized file)
 * degrades to []; a write failure is a silent no-op. Neither ever blocks the
 * 3000ms Stop-hook budget or crashes it.
 *
 * TTL (~10 minutes - a turn-scoped signal, generous for slow turns) +
 * size cap (~64KB, oldest-first truncation) keep the side-file bounded,
 * mirroring the existing card-fire-retries.json WR-02 discipline but with
 * an ADDITIONAL size cap (the retry store bounds only by TTL; this file can
 * also grow wide across many concurrent sessions, so both floors apply).
 * Writes are atomic (tmp file + rename) so a crash mid-write cannot corrupt
 * the file for a concurrent reader.
 *
 * Canon Part 8: records carry only { entry: <registry surface path>,
 * shape: <enum>, ts: <epoch ms> } - registry-keyed scalars, zero user text,
 * zero room content, LOCAL only (~/.mindrian). No Brain require, no
 * network. House rule: hyphens only, no em-dashes.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// WR-02-style TTL: a turn-scoped signal. 10 minutes is generous for a slow
// turn while keeping the side-file from accumulating stale sessions.
const TTL_MS = 10 * 60 * 1000;

// Oldest-first truncation kicks in above this size. Generous for many
// concurrent sessions' worth of entries while still bounding the file.
const SIZE_CAP_BYTES = 64 * 1024;

// A record with no resolvable session_id (the Stop stdin session_id is
// absent at the mint site) files under this degenerate bucket rather than
// being dropped silently, so the consumer can still see SOMETHING reached a
// gate even without a session key. Documented, not a silent gap.
const NO_SESSION_KEY = 'no-session';

/**
 * sideFilePath(opts) -- resolve the side-file path. Precedence: an explicit
 * opts.filePath (the test seam, mirroring room-chooser.cjs's
 * roomsHomeOverride idiom) > the CARD_FIRE_SIDECHANNEL_PATH env var (a
 * second test/ops seam) > the default ~/.mindrian/card-fire-reached.json
 * (MINDRIAN_HOME override honored, matching card-fire-retries.json).
 */
function sideFilePath(opts) {
  if (opts && typeof opts.filePath === 'string' && opts.filePath.length > 0) {
    return opts.filePath;
  }
  const envOverride = process.env.CARD_FIRE_SIDECHANNEL_PATH;
  if (typeof envOverride === 'string' && envOverride.length > 0) {
    return envOverride;
  }
  const home = process.env.MINDRIAN_HOME || path.join(os.homedir(), '.mindrian');
  return path.join(home, 'card-fire-reached.json');
}

/**
 * readStoreRaw(filePath) -- read + parse the side-file. Degrades to {} on
 * ANY fault: missing file, corrupt JSON, a non-object root, or a
 * pathologically oversized file (guarded well above the write-time cap so a
 * read never has to fully parse a multi-MB externally-corrupted blob).
 * Never throws.
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
        typeof rec.entry === 'string' &&
        Number.isFinite(rec.ts) &&
        t - rec.ts <= TTL_MS
      );
    });
    if (kept.length > 0) out[sid] = kept;
  }
  return out;
}

/**
 * enforceSizeCap(store) -- oldest-first truncation across ALL sessions
 * until the serialized store fits SIZE_CAP_BYTES. Mutates and returns a
 * plain object (safe: only ever called on a freshly-pruned store this
 * function owns). Never throws (JSON.stringify on this shape cannot throw).
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
 * tmp-file-plus-rename (atomic on the same filesystem, mirroring the
 * non-destructive-write idiom used elsewhere in this repo), so a crash
 * mid-write cannot leave a concurrent reader with a torn/partial file.
 * Best-effort: any failure is swallowed (T-209-24 - never block the hook).
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
 * recordReachedGate({ sessionId, surface, shape, filePath? }) -- append a
 * reached-gate record for this session. `surface` MUST be the bare registry
 * surface path (e.g. "lib/hmi/selector-dispatcher.cjs") so it intersects
 * gateReachingEntries()'s output exactly (see the SCHEMA NOTE above).
 * `shape` is stored for diagnostics only. A missing/empty surface is a
 * silent no-op (nothing meaningful to record). A missing sessionId files
 * under NO_SESSION_KEY rather than being dropped. Never throws.
 */
function recordReachedGate(opts) {
  try {
    const o = opts && typeof opts === 'object' ? opts : {};
    const surface = typeof o.surface === 'string' && o.surface.length > 0 ? o.surface : '';
    if (!surface) return;
    const sessionId =
      typeof o.sessionId === 'string' && o.sessionId.length > 0 ? o.sessionId : NO_SESSION_KEY;
    const shape = typeof o.shape === 'string' ? o.shape : '';

    const filePath = sideFilePath(o);
    const store = readStoreRaw(filePath);
    const list = Array.isArray(store[sessionId]) ? store[sessionId] : [];
    list.push({ entry: surface, shape: shape, ts: Date.now() });
    store[sessionId] = list;
    writeStoreAtomic(filePath, store);
  } catch (_e) {
    /* never throw out of a producer call site */
  }
}

/**
 * readReachedGates(sessionId, opts?) -- return the DEDUPED array of bare
 * surface-path strings recorded for this session, TTL-filtered. A missing/
 * empty sessionId reads the NO_SESSION_KEY bucket only. When sessionId IS
 * provided, the session-scoped bucket is UNIONED with the NO_SESSION_KEY
 * bucket: at least one producer site (the pickShape trailer door,
 * lib/hmi/selector-dispatcher.cjs) has no session_id in scope at its mint
 * point and always records under NO_SESSION_KEY (documented, not a silent
 * gap - see the module header). Without this union, that producer's records
 * would never surface to a session-scoped consumer lookup and PRIMARY
 * detection would stay functionally inert for that site specifically. Any
 * fault (missing file, corrupt JSON, oversized file) degrades to []. Never
 * throws.
 */
function readReachedGates(sessionId, opts) {
  try {
    const filePath = sideFilePath(opts);
    const raw = readStoreRaw(filePath);
    const pruned = pruneStore(raw, Date.now());
    const sid = typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : NO_SESSION_KEY;

    const lists = [Array.isArray(pruned[sid]) ? pruned[sid] : []];
    if (sid !== NO_SESSION_KEY) {
      lists.push(Array.isArray(pruned[NO_SESSION_KEY]) ? pruned[NO_SESSION_KEY] : []);
    }

    const seen = new Set();
    const out = [];
    for (const list of lists) {
      for (const rec of list) {
        if (rec && typeof rec.entry === 'string' && rec.entry.length > 0 && !seen.has(rec.entry)) {
          seen.add(rec.entry);
          out.push(rec.entry);
        }
      }
    }
    return out;
  } catch (_e) {
    return [];
  }
}

module.exports = {
  recordReachedGate: recordReachedGate,
  readReachedGates: readReachedGates,
  sideFilePath: sideFilePath,
  TTL_MS: TTL_MS,
  SIZE_CAP_BYTES: SIZE_CAP_BYTES,
  NO_SESSION_KEY: NO_SESSION_KEY,
};
