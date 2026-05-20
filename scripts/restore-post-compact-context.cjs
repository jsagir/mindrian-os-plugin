#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 95.5 -- Post-Compact memory pipeline consumer (READ side).
 *
 * Per D-01: 9th SessionStart entry (registered by Plan 95.5-03).
 * Per D-02: staleness skip+delete (mtime>600s) AND post-consume forensic preserve.
 * Per D-03: hookSpecificOutput.additionalContext ONLY; silent re-injection.
 * Per D-04: stamp + validate (source_room_path + source_room_slug + written_at).
 * Per D-04b: belt-and-suspenders mtime vs registry.last_opened.
 * Per D-07: workspace guard direction REVERSE -- reads room state OUTSIDE plugin.
 *
 * Canon Part 8: zero network surface (LOCAL fs reads only).
 * Canon Part 9: per-room memory locality (no cross-room leak).
 * Phase 87 invariant: zero npm deps; Node built-ins + in-repo CJS modules.
 */

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
// Phase 128.1-03b: the canonical session-scoped active-room resolver.
// getActiveRoom's Strategy 1 inline `reg.active` read was a Bucket B-reader of
// the racing global string; it now routes through resolveActiveRoom (D-03).
const sessionBinding = require('../lib/core/session-binding.cjs');

const ENVELOPE_ALLOWED = new Set([
  'decision', 'reason', 'continue', 'stopReason',
  'suppressOutput', 'systemMessage', 'hookSpecificOutput',
]);

function emitEnvelope(obj) {
  const filtered = {};
  for (const k of Object.keys(obj || {})) {
    if (ENVELOPE_ALLOWED.has(k)) filtered[k] = obj[k];
  }
  if (filtered.continue === undefined) filtered.continue = true;
  try { process.stdout.write(JSON.stringify(filtered)); } catch (_) {}
  process.exit(0);
}
function emitEmpty() { emitEnvelope({ continue: true }); }
process.on('uncaughtException', () => emitEmpty());

const STALENESS_SECONDS = 600; // D-02 mtime threshold (matches scripts/post-compact:85)

// --- Step 1: side-channel read + staleness check (RESEARCH section "Code Examples") ---
function readSideChannel(roomDir) {
  const sidePath = path.join(roomDir, '.mindrian', 'last-post-compact.md');
  let stat;
  try { stat = fs.statSync(sidePath); } catch (_) { return null; }
  if (!stat || !stat.isFile()) return null;

  const ageSec = Math.floor((Date.now() - stat.mtimeMs) / 1000);
  if (ageSec > STALENESS_SECONDS) {
    // D-02: stale file is purged (no forensic preserve -- janitorial only).
    try { fs.unlinkSync(sidePath); } catch (_) {}
    return null;
  }
  let content;
  try { content = fs.readFileSync(sidePath, 'utf8'); } catch (_) { return null; }
  return { path: sidePath, mtimeMs: stat.mtimeMs, content };
}

// --- Step 2: YAML frontmatter parse (RESEARCH "YAML Frontmatter Parse") ---
function parseStamp(content) {
  if (typeof content !== 'string' || content.indexOf('---') !== 0) return null;
  const rest = content.slice(content.indexOf('\n') + 1);
  const closeMatch = rest.match(/^---\s*$/m);
  if (!closeMatch) return null;
  const fmText = rest.slice(0, closeMatch.index);
  const stamp = {};
  for (const raw of fmText.split(/\r?\n/)) {
    if (!raw || /^\s*#/.test(raw)) continue;
    const m = raw.match(/^(source_room_path|source_room_slug|written_at|schema_version)\s*:\s*(.+?)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v[0] === '"' && v.endsWith('"')) || (v[0] === "'" && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    stamp[m[1]] = v;
  }
  if (!stamp.source_room_path || !stamp.source_room_slug || !stamp.written_at) return null;
  return stamp;
}

// --- Step 3: active-room resolution (RESEARCH Q4 recommendation) ---
//
// Resolution strategy:
//   1. Read canonical registry at ~/MindrianRooms/.rooms/registry.json --
//      this is the AUTHORITATIVE source for both room path AND last_opened
//      (D-04b belt-and-suspenders mtime cross-check).
//   2. Fall back to lib/core/folder-memory.cjs::getCurrentRoom(workDir) --
//      Phase 94-01 STATE.md contract. Returns { slug, path: <STATE.md
//      absolute path>, source }. We derive the room dir via dirname()
//      since in all 3 resolveCanonicalStateMd strategies, dirname(STATE.md)
//      is the room directory by construction. last_opened unavailable on
//      this path -- D-04b becomes a no-op (returns true / "trust file").
//
// Registry-first ordering is correct because:
//   (a) the registry is per-user globally canonical (cwd-independent)
//   (b) registry exposes last_opened; STATE.md does not
//   (c) STATE.md slug + cwd-relative resolution can mis-target if user's
//       cwd happens to contain a STATE.md unrelated to the active room.
function getActiveRoom(workDir) {
  // Strategy 1: session-scoped active-room binding.
  // Phase 128.1-03b (D-03): the prior inline `reg.active` read was a Bucket B
  // reader of the racing global string. resolveActiveRoom does the
  // session-keyed lookup plus the last_active/active fallback internally so
  // concurrent sessions resolve their own room. last_opened is not part of the
  // resolver contract, so it is read from the registry entry for the resolved
  // slug (D-04b belt-and-suspenders cross-check is preserved). The `tripwire`
  // signal is destructured but not acted on here -- Plan 05 owns it.
  try {
    const sid = sessionBinding.resolveSessionId();
    const { room: activeSlug, path: roomPath /* tripwire */ } =
      sessionBinding.resolveActiveRoom(sid);
    if (activeSlug && roomPath) {
      let lastOpened = null;
      try {
        const registryPath = path.join(os.homedir(), 'MindrianRooms', '.rooms', 'registry.json');
        const reg = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
        const entry = reg && reg.rooms && reg.rooms[activeSlug];
        if (entry && entry.last_opened) lastOpened = entry.last_opened;
      } catch (_) { /* last_opened unavailable -> D-04b becomes a no-op */ }
      return {
        slug: activeSlug,
        path: roomPath,
        last_opened: lastOpened,
      };
    }
  } catch (_) {}
  // Strategy 2: STATE.md anchor via folder-memory.cjs.
  try {
    const fm = require(path.join(__dirname, '..', 'lib', 'core', 'folder-memory.cjs'));
    if (typeof fm.getCurrentRoom === 'function') {
      const r = fm.getCurrentRoom(workDir);
      if (r && r.slug && r.path) {
        const roomDir = path.dirname(r.path);
        return { slug: r.slug, path: roomDir, last_opened: null };
      }
    }
  } catch (_) {}
  return null;
}

// --- Step 4: cross-room validation (D-04 + D-04b) ---
function validateRoomMatch(stamp, activeRoom) {
  if (!stamp || !activeRoom) return false;
  if (stamp.source_room_slug !== activeRoom.slug) return false;
  if (path.resolve(stamp.source_room_path) !== path.resolve(activeRoom.path)) return false;
  return true;
}

function isFreshComparedToRegistry(fileMtimeMs, activeRoom) {
  // D-04b: if registry shows a more recent room-switch than the file's
  // write time, treat as stale. Missing signal -> trust file.
  if (!activeRoom || !activeRoom.last_opened) return true;
  const switchMs = Date.parse(activeRoom.last_opened);
  if (!Number.isFinite(switchMs)) return true;
  return fileMtimeMs >= switchMs;
}

// --- Step 5: forensic rename (D-02 step 2) ---
function forensicRename(originalPath, kind) {
  const dir = path.dirname(originalPath);
  // Millisecond-precision ISO + epoch ms for race-safe collision avoidance
  // (RESEARCH Open Question 2 recommendation).
  const iso = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(dir, '.last-post-compact-' + kind + '-' + iso + '-' + Date.now() + '.md');
  try { fs.renameSync(originalPath, target); } catch (_) {}
  return target;
}

// --- Step 6: re-derive TRIPLE_CONTEXT via live readTriple (Pitfall 2 avoidance) ---
function buildTripleContextBlock(roomDir) {
  try {
    const fm = require(path.join(__dirname, '..', 'lib', 'core', 'folder-memory.cjs'));
    const fmt = require(path.join(__dirname, '..', 'lib', 'memory', 'triple-context-formatter.cjs'));
    const sections = {};
    let entries = [];
    try {
      entries = fs.readdirSync(roomDir, { withFileTypes: true })
        .filter(d => d.isDirectory() && d.name[0] !== '.');
    } catch (_) { entries = []; }
    for (const d of entries) {
      const sp = path.join(roomDir, d.name);
      try {
        if (!fs.existsSync(path.join(sp, 'ROOM.md'))) continue;
        sections[d.name] = fm.readTriple(sp);
      } catch (_) { /* skip */ }
    }
    // Optional pending-tier1-regen.json + minto-stale.json (88-09 pattern).
    let pendingTier1 = null;
    try {
      const ptp = path.join(roomDir, '.mindrian', 'pending-tier1-regen.json');
      if (fs.existsSync(ptp)) {
        const pj = JSON.parse(fs.readFileSync(ptp, 'utf8'));
        pendingTier1 = Array.isArray(pj) ? pj : (pj && pj.pending) || [];
      }
    } catch (_) {}
    let staleReport = null;
    try {
      const msp = path.join(roomDir, '.mindrian', 'minto-stale.json');
      if (fs.existsSync(msp)) {
        const sj = JSON.parse(fs.readFileSync(msp, 'utf8'));
        staleReport = Array.isArray(sj) ? sj : (sj && sj.sections) || [];
      }
    } catch (_) {}
    return fmt.formatTripleContext({ sections, pendingTier1, staleReport }) || '';
  } catch (_) {
    return '';
  }
}

// --- main() orchestration ---
function main() {
  const workDir = process.cwd();
  const activeRoom = getActiveRoom(workDir);
  if (!activeRoom || !activeRoom.path) {
    // Tier 0: no active room. Silent.
    return emitEmpty();
  }

  const sc = readSideChannel(activeRoom.path);
  if (!sc) {
    // No file, stale (purged), or unreadable. Silent.
    return emitEmpty();
  }

  const stamp = parseStamp(sc.content);
  if (!stamp) {
    // No stamp (legacy unstamped file, or parse failure). Silent skip.
    return emitEmpty();
  }

  // Cross-room HARD SKIP path (D-04).
  if (!validateRoomMatch(stamp, activeRoom)) {
    forensicRename(sc.path, 'cross-room-skip');
    return emitEmpty();
  }

  // Belt-and-suspenders D-04b.
  if (!isFreshComparedToRegistry(sc.mtimeMs, activeRoom)) {
    // Registry switched after file write -- treat as stale (skip + delete; not forensic).
    try { fs.unlinkSync(sc.path); } catch (_) {}
    return emitEmpty();
  }

  // Re-derive TRIPLE_CONTEXT live (Pitfall 2: do not parse body).
  const block = buildTripleContextBlock(activeRoom.path);

  // Forensic-rename to consumed BEFORE emit (so subsequent re-run cannot re-inject).
  forensicRename(sc.path, 'consumed');

  if (!block) {
    // Live walk produced nothing -- silent.
    return emitEmpty();
  }

  return emitEnvelope({
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: block,
    },
  });
}

if (require.main === module) {
  main();
}

// ----- Phase 121.5-00 contributor surface -----
// Compose the post-compact re-injection as a ContributorFragment for the
// SessionStart Coordinator. Side-effect order matches the legacy main():
// forensicRename happens BEFORE composing the fragment so a subsequent retry
// cannot re-inject the same context.

function contribute() {
  let fi;
  try { fi = require('../lib/sessionstart/contributor-interface.cjs'); }
  catch (_) { return { has_payload: false }; }
  try {
    let sc;
    try { sc = readSideChannel(); } catch (_) { return fi.emptyFragment(); }
    if (!sc || !sc.path) return fi.emptyFragment();
    let activeRoom;
    try { activeRoom = getActiveRoom(); } catch (_) { return fi.emptyFragment(); }
    if (!activeRoom) return fi.emptyFragment();
    try {
      if (!validateRoomMatch(sc, activeRoom)) {
        try { forensicRename(sc.path, 'stale'); } catch (_) {}
        return fi.emptyFragment();
      }
    } catch (_) { return fi.emptyFragment(); }
    if (!isFreshComparedToRegistry(sc.mtimeMs, activeRoom)) {
      try { fs.unlinkSync(sc.path); } catch (_) {}
      return fi.emptyFragment();
    }
    let block = null;
    try { block = buildTripleContextBlock(activeRoom.path); } catch (_) { block = null; }
    try { forensicRename(sc.path, 'consumed'); } catch (_) {}
    if (!block || typeof block !== 'string' || block.length === 0) {
      return fi.emptyFragment();
    }
    const pointer = 'Post-compact context restored -- prior room state available.';
    return fi.makeFragment({
      id: 'post-compact',
      priority: 10,
      full_payload: block,
      one_line_pointer: pointer,
    });
  } catch (_) {
    return fi.emptyFragment();
  }
}

module.exports = {
  ENVELOPE_ALLOWED,
  emitEnvelope,
  emitEmpty,
  readSideChannel,
  parseStamp,
  getActiveRoom,
  validateRoomMatch,
  isFreshComparedToRegistry,
  forensicRename,
  buildTripleContextBlock,
  main,
  contribute,
};
