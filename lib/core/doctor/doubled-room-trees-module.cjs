'use strict';
/*
 * lib/core/doctor/doubled-room-trees-module.cjs -- doctor module for the doubled-path folders.
 * Phase 383 plan 10 (D-02, the existing-data half of QA383-10, SEED-117).
 *
 * WHAT IT FINDS. Before plan 383-03, a room born with an absolute path was seeded INSIDE the rooms
 * home as a copy of its own path: <home>/home/jsagi/MindrianRooms/axiom/ (POSIX) or <home>/C:/Users/..
 * (Windows). Such a folder holds exactly the four seed items of scripts/room-registry
 * _seed_room_bootstrap: ROOM.md, STATE.md, USER.md and an empty .mindrian directory.
 *
 * CONTRACT. check(ctx) is read only: it lists the folders and a digest of the listing and deletes
 * nothing. clean({ home, digest }) is the one delete. It is reached only through the sibling flag
 * --clean-doubled-rooms=<digest> of scripts/doctor.cjs (never through --fix, which this module does
 * not export), and the doctrine in commands/doctor.md puts the F.0 card in front of it.
 *
 * SAFETY. A folder is removed only when (1) it has exactly the seed shape: STATE.md and USER.md are
 * byte-equal to the templates below, ROOM.md matches the seed template with room_id equal to the
 * folder name, .mindrian is an empty directory, nothing else is present; and (2) its path mirrors a
 * real room (the copied path exists as a room, or is in the registry); and (3) the digest of the
 * current listing equals the digest the navigator approved. When the walk hits the entry cap or the depth
 * cap the listing is marked partial: the row says so and the digest covers that mark. No recursive delete anywhere: files go
 * with unlink, directories with rmdir (which fails on a non-empty directory). Symlinks are never
 * followed, and every parent folder of a leaf is checked as a real directory inside the rooms home before each delete. Canon Part 8: LOCAL filesystem only, no Brain call, no network.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { listRoomRoots } = require('../icm-forest.cjs');

const MAX_DEPTH = 16;
const MAX_ENTRIES = 5000;
const MAX_ROOM_MD_BYTES = 4096;

// Copied from scripts/room-registry _seed_room_bootstrap (heredocs STATE_EOF and USER_EOF).
const STATE_TEMPLATE = '---\ngsd_state_version: 1.0\nstatus: active\n---\n\n# State\n\n## Decisions\n\n(none yet)\n';
const USER_TEMPLATE = '---\ncanonical_role: null\njourney_stage: null\n---\n\n# User Profile\n\nRun /mos:profile-user to populate.\n';
// ROOM_EOF: room_id, venture_name, venture_stage, created, then the heading and the stage line.
const ROOM_RE = /^---\nroom_id: ([^\n]+)\nventure_name: ([^\n]+)\nventure_stage: ([^\n]+)\ncreated: [^\n]+\n---\n\n# ([^\n]+)\n\nStage: ([^\n]+)\n$/;

const SEED_NAMES = new Set(['ROOM.md', 'STATE.md', 'USER.md', '.mindrian']);
const DRIVE_TOP_RE = /^([A-Za-z])(?::|\uF03A)$/;

function lstatSafe(p) {
  try { return fs.lstatSync(p); } catch (_e) { return null; }
}

function readText(p, cap) {
  try {
    const st = fs.lstatSync(p);
    if (!st.isFile() || st.size > cap) return null;
    return fs.readFileSync(p, 'utf8');
  } catch (_e) { return null; }
}

function readRegistry(home) {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(home, '.rooms', 'registry.json'), 'utf8'));
    return (raw && typeof raw.rooms === 'object' && raw.rooms) ? raw.rooms : {};
  } catch (_e) { return {}; }
}

function hasRoomMarker(dir) {
  return fs.existsSync(path.join(dir, '.room-root')) || fs.existsSync(path.join(dir, '.mindrian', 'room.db'));
}

/**
 * seedShape(dir) -> true when dir holds exactly the seed items of room-registry create, unchanged.
 * Never follows a symlink.
 */
function seedShape(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return false; }
  const names = entries.map(function (e) { return e.name; });
  if (names.length === 0 || names.length > SEED_NAMES.size) return false;
  for (const n of names) if (!SEED_NAMES.has(n)) return false;
  if (!names.includes('ROOM.md')) return false;
  const room = readText(path.join(dir, 'ROOM.md'), MAX_ROOM_MD_BYTES);
  if (room === null) return false;
  const m = ROOM_RE.exec(room);
  if (!m || m[1] !== path.basename(dir) || m[2] !== m[4] || m[3] !== m[5]) return false;
  if (names.includes('STATE.md') && readText(path.join(dir, 'STATE.md'), MAX_ROOM_MD_BYTES) !== STATE_TEMPLATE) return false;
  if (names.includes('USER.md') && readText(path.join(dir, 'USER.md'), MAX_ROOM_MD_BYTES) !== USER_TEMPLATE) return false;
  if (names.includes('.mindrian')) {
    const st = lstatSafe(path.join(dir, '.mindrian'));
    if (!st || !st.isDirectory() || st.isSymbolicLink()) return false;
    let inner;
    try { inner = fs.readdirSync(path.join(dir, '.mindrian')); } catch (_e) { return false; }
    if (inner.length !== 0) return false;
  }
  return true;
}

/** True when a directory holds any of the three seed markdown files (so it is "seed-like"). */
function seedLike(dir) {
  return ['ROOM.md', 'STATE.md', 'USER.md'].some(function (n) { return fs.existsSync(path.join(dir, n)); });
}

/** The path the folder copies: '/' + relative path, or a drive path when the top folder is C: or C+U+F03A. */
function mirrorPathOf(relParts) {
  const drive = DRIVE_TOP_RE.exec(relParts[0]);
  if (drive) return drive[1].toUpperCase() + ':/' + relParts.slice(1).join('/');
  return '/' + relParts.join('/');
}

function normSlash(p) {
  return String(p).replace(/\\/g, '/').replace(/\/+$/, '');
}

/**
 * mirrorIsRealRoom(mirror, home, regRooms, opts): the copied path is a directory that carries a room
 * marker or a ROOM.md, or it is the path of a registry entry.
 */
function mirrorIsRealRoom(mirror, home, regRooms, opts) {
  const isDir = opts && typeof opts.isDir === 'function' ? opts.isDir : function (p) {
    try { return fs.statSync(p).isDirectory(); } catch (_e) { return false; }
  };
  const exists = opts && typeof opts.exists === 'function' ? opts.exists : function (p) { return fs.existsSync(p); };
  const want = normSlash(mirror);
  if (isDir(mirror) && (exists(mirror + '/ROOM.md') || exists(mirror + '/.room-root') || exists(mirror + '/.mindrian/room.db'))) {
    return true;
  }
  for (const slug of Object.keys(regRooms || {})) {
    const p = regRooms[slug] && regRooms[slug].path;
    if (typeof p !== 'string' || !p) continue;
    const abs = path.isAbsolute(p) || /^[A-Za-z]:[\\/]/.test(p) ? normSlash(p) : normSlash(path.join(home, p));
    if (abs === want) return true;
  }
  return false;
}

/**
 * listDoubledTrees(home, opts) -> { home, leaves, tops, kept, truncated }
 *   leaves: relative paths (forward slashes, sorted) of folders that are safe to remove
 *   tops:   the top-level folder names that hold them
 *   kept:   [{ path, reason }] seed-like folders that are NOT removable, with the reason
 *   truncated: true when the walk hit the entry cap or the depth cap, so the list may be partial
 * Entries are sorted by name before the walk, so the order (and which leaves survive a cap) is the same on
 * every filesystem (review WR-03).
 * opts (tests only): isDir(p), exists(p) to model a mirror path that this host cannot hold;
 *   maxEntries, maxDepth to lower the caps.
 */
function listDoubledTrees(home, opts) {
  const out = { home: home, leaves: [], tops: [], kept: [], truncated: false };
  const maxEntries = opts && typeof opts.maxEntries === 'number' ? opts.maxEntries : MAX_ENTRIES;
  const maxDepth = opts && typeof opts.maxDepth === 'number' ? opts.maxDepth : MAX_DEPTH;
  let topEntries;
  try { topEntries = fs.readdirSync(home, { withFileTypes: true }); } catch (_e) { return out; }
  const regRooms = readRegistry(home);
  let seen = 0;
  const leafSet = new Set();
  const topSet = new Set();
  const byName = function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; };

  for (const top of topEntries.slice().sort(byName)) {
    if (out.truncated && seen > maxEntries) break;
    if (!top.isDirectory() || top.isSymbolicLink() || top.name.startsWith('.')) continue;
    const topDir = path.join(home, top.name);
    if (hasRoomMarker(topDir) || Object.prototype.hasOwnProperty.call(regRooms, top.name)) continue;
    const stack = [{ dir: topDir, rel: [top.name], depth: 0 }];
    while (stack.length > 0) {
      const cur = stack.pop();
      if (cur.depth >= maxDepth) { out.truncated = true; continue; }
      let ents;
      try { ents = fs.readdirSync(cur.dir, { withFileTypes: true }); } catch (_e) { continue; }
      ents = ents.slice().sort(byName);
      for (const e of ents) {
        seen += 1;
        if (seen > maxEntries) { out.truncated = true; break; }
        if (!e.isDirectory() || e.isSymbolicLink() || e.name.startsWith('.')) continue;
        const dir = path.join(cur.dir, e.name);
        const rel = cur.rel.concat([e.name]);
        if (seedLike(dir)) {
          if (!seedShape(dir)) {
            out.kept.push({ path: rel.join('/'), reason: 'holds edited or extra files' });
          } else if (!mirrorIsRealRoom(mirrorPathOf(rel), home, regRooms, opts)) {
            out.kept.push({ path: rel.join('/'), reason: 'no matching real room' });
          } else {
            leafSet.add(rel.join('/'));
            topSet.add(top.name);
          }
        } else {
          stack.push({ dir: dir, rel: rel, depth: cur.depth + 1 });
        }
      }
      if (seen > maxEntries) break;
    }
  }
  out.leaves = Array.from(leafSet).sort();
  out.tops = Array.from(topSet).sort();
  out.kept.sort(function (a, b) { return a.path < b.path ? -1 : a.path > b.path ? 1 : 0; });
  return out;
}

/**
 * First 12 hex chars of sha256 over the sorted leaf list joined by newlines. A partial listing (a cap was hit)
 * adds a marker line, so a digest approved for a partial list never equals the digest of a complete one.
 */
function listingDigest(listing) {
  const leaves = (listing && Array.isArray(listing.leaves)) ? listing.leaves : [];
  const marker = listing && listing.truncated ? '\n#partial' : '';
  return crypto.createHash('sha256').update(leaves.join('\n') + marker).digest('hex').slice(0, 12);
}

function check(_ctx) {
  try {
    const home = listRoomRoots().home;
    if (!fs.existsSync(home)) return { status: 'skip', detail: 'no rooms home at ' + home };
    const listing = listDoubledTrees(home);
    const partialNote = listing.truncated
      ? 'partial listing: the scan stopped at ' + MAX_ENTRIES + ' entries or depth ' + MAX_DEPTH + ', so folders beyond that were not looked at'
      : '';
    if (listing.leaves.length === 0) {
      const keptNote = listing.kept.length > 0 ? ' (' + listing.kept.length + ' kept folder(s) hold edited or extra files or have no matching room; none is removable)' : '';
      if (listing.truncated) {
        return { status: 'warn', detail: 'no doubled-path folders found in the part of the rooms home that was scanned; ' + partialNote + keptNote, truncated: true };
      }
      return { status: 'ok', detail: 'no doubled-path folders under the rooms home' + keptNote };
    }
    const digest = listingDigest(listing);
    const line = 'Nothing is deleted without the navigator approval: after the F.0 card for digest ' + digest +
      ', run doctor --clean-doubled-rooms=' + digest;
    return {
      status: 'warn',
      detail: listing.leaves.length + ' doubled-path folder(s) under the rooms home (' + listing.tops.join(', ') + '); digest ' + digest +
        (listing.truncated ? ' (' + partialNote + ')' : '') +
        '; nothing is deleted without the navigator approval: doctor --clean-doubled-rooms=' + digest +
        (listing.kept.length > 0 ? '; ' + listing.kept.length + ' other seed-like folder(s) are kept' : ''),
      action_lines: [line],
      digest: digest,
      leaves: listing.leaves,
      truncated: listing.truncated,
      kept_count: listing.kept.length,
      kept: listing.kept.slice(0, 10),
    };
  } catch (err) {
    return { status: 'error', detail: 'doubled-room-trees check failed: ' + String((err && err.message) || err).slice(0, 160) };
  }
}

/**
 * pathIsReal(home, parts) -> true when every component from the rooms home down to parts[last] is a real
 * directory (not a symlink) and the resolved path stays inside the real rooms home (review WR-04).
 * lstat on the leaf alone follows a symlinked parent, so each component is checked on its own.
 */
function pathIsReal(home, parts) {
  let realHome;
  try { realHome = fs.realpathSync(home); } catch (_e) { return false; }
  let cur = home;
  for (const part of parts) {
    cur = path.join(cur, part);
    const st = lstatSafe(cur);
    if (!st || !st.isDirectory() || st.isSymbolicLink()) return false;
  }
  let real;
  try { real = fs.realpathSync(cur); } catch (_e) { return false; }
  return real === path.join(realHome, ...parts);
}

/** rmdir each empty parent of rel, stopping before the home. Each parent is verified first. */
function pruneParents(home, relParts) {
  for (let i = relParts.length - 1; i >= 1; i--) {
    const parts = relParts.slice(0, i);
    if (!pathIsReal(home, parts)) return;
    try { fs.rmdirSync(path.join(home, ...parts)); } catch (_e) { return; }
  }
}

/**
 * clean({ home, digest }) -> { ok, removed, kept, reason?, detail? }
 * The one delete. Deletes nothing when the digest differs from the current listing.
 * Test seam: opts.beforeDelete(rel) runs after the digest check and before the checks on that leaf.
 */
function clean(opts) {
  const o = opts || {};
  const home = o.home || listRoomRoots().home;
  const listing = listDoubledTrees(home, o.listOpts);
  if (listing.leaves.length === 0) {
    return { ok: true, removed: [], kept: listing.kept, detail: 'nothing to remove', truncated: listing.truncated };
  }
  const current = listingDigest(listing);
  if (typeof o.digest !== 'string' || o.digest !== current) {
    return {
      ok: false, reason: 'digest_mismatch', removed: [], kept: listing.kept, current_digest: current,
      detail: 'the digest does not match the current listing; nothing was deleted',
    };
  }
  const removed = [];
  const skipped = [];
  for (const rel of listing.leaves) {
    const parts = rel.split('/');
    const leaf = path.join(home, ...parts);
    if (typeof o.beforeDelete === 'function') o.beforeDelete(rel);
    // Re-check the shape and the symlink state of the whole path right before the delete: every parent, not
    // only the leaf, must be a real directory inside the rooms home.
    const st = lstatSafe(leaf);
    if (!pathIsReal(home, parts) || !st || !st.isDirectory() || st.isSymbolicLink() || !seedShape(leaf)) {
      skipped.push({ path: rel, reason: 'changed since the listing' });
      continue;
    }
    try {
      for (const f of ['ROOM.md', 'STATE.md', 'USER.md']) {
        if (fs.existsSync(path.join(leaf, f))) {
          if (!pathIsReal(home, parts)) throw Object.assign(new Error('parent changed'), { code: 'PARENT_CHANGED' });
          fs.unlinkSync(path.join(leaf, f));
        }
      }
      if (!pathIsReal(home, parts)) throw Object.assign(new Error('parent changed'), { code: 'PARENT_CHANGED' });
      if (fs.existsSync(path.join(leaf, '.mindrian'))) fs.rmdirSync(path.join(leaf, '.mindrian'));
      if (!pathIsReal(home, parts)) throw Object.assign(new Error('parent changed'), { code: 'PARENT_CHANGED' });
      fs.rmdirSync(leaf);
      removed.push(rel);
      pruneParents(home, parts);
    } catch (e) {
      skipped.push({ path: rel, reason: 'could not remove: ' + String((e && e.code) || e) });
    }
  }
  return { ok: skipped.length === 0, removed: removed, kept: listing.kept.concat(skipped), detail: removed.length + ' folder(s) removed', truncated: listing.truncated };
}

module.exports = { listDoubledTrees, listingDigest, check, clean };
