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
function getActiveRoom(workDir) {
  try {
    const fm = require(path.join(__dirname, '..', 'lib', 'core', 'folder-memory.cjs'));
    if (typeof fm.getCurrentRoom === 'function') {
      const r = fm.getCurrentRoom(workDir);
      if (r && r.slug && r.path) {
        return { slug: r.slug, path: r.path, last_opened: null };
      }
    }
  } catch (_) {}
  // Fallback: read canonical registry directly.
  try {
    const registryPath = path.join(os.homedir(), 'MindrianRooms', '.rooms', 'registry.json');
    const reg = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    if (!reg || !reg.active || !reg.rooms || !reg.rooms[reg.active]) return null;
    const entry = reg.rooms[reg.active];
    let roomPath = entry.path;
    if (!path.isAbsolute(roomPath)) {
      const root = (reg.root || '~/MindrianRooms').replace(/^~/, os.homedir());
      roomPath = path.resolve(root, roomPath);
    }
    return {
      slug: reg.active,
      path: roomPath,
      last_opened: entry.last_opened || null,
    };
  } catch (_) { return null; }
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
};
