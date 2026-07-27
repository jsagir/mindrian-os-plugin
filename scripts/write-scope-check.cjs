#!/usr/bin/env node
'use strict';

/**
 * Phase 83-06: Filesystem write interception (Tier 1.5).
 *
 * PreToolUse hook for Write|Edit|MultiEdit. Reads the Claude Code hook
 * payload on stdin, parses the target file path, and blocks the tool
 * call when the write targets a MindrianRooms room that is not the
 * active room, or targets a sealed room (GUARDRAIL.md present) regardless
 * of the active room.
 *
 * Signaling: non-zero exit + stderr text. Exit 2 to block, exit 0 to allow.
 * On any parse/resolution failure: exit 0 (fail-open). A false block is
 * worse than a false allow for a safety hook shipping in a patch release.
 *
 * No dependencies. CJS only. Inline helpers.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

// The reserved dev-repo/no-room sentinel (mirrors intent-classifier NO_ROOM_SLUG).
// A write whose session-aware resolution yields this (or yields no room at all)
// is not room-scoped, so the set-membership guard must never block it.
const NO_ROOM_SLUG = '__no_room__';

// resolveSessionId -- COMPOSE the same precedence the intent-classifier uses
// (intent-classifier.cjs:783 resolveSessionId), NOT a re-derived third guesser
// (D-02 / the SEED-034 four-guessers lesson). CLAUDE_CODE_SESSION_ID is the
// real runtime env var Claude Code sets (confirmed live: CLAUDE_SESSION_ID is
// empty, CLAUDE_CODE_SESSION_ID holds the actual session UUID -- F-01), so it
// is checked first; CLAUDE_SESSION_ID is kept as a fallback/legacy alias so
// existing test fixtures that set it keep passing unchanged. The hook
// payload's session_id is a better fallback than a day-hash when both env
// names are absent; the sha256(root+day) tail mirrors the classifier's last
// resort so a missing env still lands on a stable per-day file. NEVER throws.
function resolveSessionId(payload, root) {
  const env = process.env.CLAUDE_CODE_SESSION_ID || process.env.CLAUDE_SESSION_ID;
  if (typeof env === 'string' && env.length > 0) return env;
  const pid = payload && typeof payload.session_id === 'string' && payload.session_id.length > 0
    ? payload.session_id
    : null;
  if (pid) return pid;
  try {
    const day = new Date().toISOString().slice(0, 10);
    return crypto.createHash('sha256').update((root || '') + day).digest('hex').slice(0, 12);
  } catch (_) {
    return 'unknown';
  }
}

// ---------------------------------------------------------------------------
// Helpers (inline per plan 83-06 task 2; may be factored to lib/core in 83-07).
// ---------------------------------------------------------------------------

function resolveMindrianRoomsRoot() {
  const envRoot = process.env.MINDRIAN_ROOMS_ROOT;
  if (envRoot && fs.existsSync(envRoot)) {
    return envRoot;
  }
  const home = process.env.HOME || os.homedir();
  if (!home) return null;
  const defaultRoot = path.join(home, 'MindrianRooms');
  if (fs.existsSync(defaultRoot)) {
    return defaultRoot;
  }
  // Home scan (maxdepth 2) to match 83-02 fallback behavior.
  try {
    const entries = fs.readdirSync(home, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name === 'MindrianRooms') {
        return path.join(home, e.name);
      }
      // one level deeper
      const sub = path.join(home, e.name);
      try {
        const subEntries = fs.readdirSync(sub, { withFileTypes: true });
        for (const s of subEntries) {
          if (s.isDirectory() && s.name === 'MindrianRooms') {
            return path.join(sub, s.name);
          }
        }
      } catch (_) { /* ignore */ }
    }
  } catch (_) { /* ignore */ }
  return null;
}

function readActiveRoom(root) {
  try {
    const regPath = path.join(root, '.rooms', 'registry.json');
    const raw = fs.readFileSync(regPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.active === 'string' && parsed.active.length > 0) {
      return parsed.active;
    }
    return null;
  } catch (_) {
    return null;
  }
}

function isSealed(root, roomName) {
  try {
    const guardrail = path.join(root, roomName, 'GUARDRAIL.md');
    return fs.existsSync(guardrail);
  } catch (_) {
    return false;
  }
}

// Resolve a path through realpath if it exists, otherwise return absolute.
// Used to defuse symlink tricks: target and root are both realpath'd before
// comparison.
function safeRealpath(p) {
  try {
    return fs.realpathSync(p);
  } catch (_) {
    return path.resolve(p);
  }
}

// Extract the target file path from tool_input, trying common field names.
function extractTargetPath(toolInput) {
  if (!toolInput || typeof toolInput !== 'object') return null;
  const candidates = ['file_path', 'path', 'filePath'];
  for (const k of candidates) {
    const v = toolInput[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return null;
}

// MAX_DEPTH bounds the .room-root walk-up so a pathological path never spins.
// 12 mirrors lib/core/room-root.cjs (the ONE shipped walk-up resolver we clone).
const ROOM_ROOT_MAX_DEPTH = 12;

// normSegments -- collapse a relative path to a forward-slash, segment-joined
// canonical form so a registry `path` field ("mindrian/mindrianOS") and a
// path.relative result compare equal regardless of separator or trailing slash.
function normSegments(rel) {
  if (typeof rel !== 'string') return '';
  return rel.split(/[\\/]/).filter(Boolean).join('/');
}

// walkUpToRoomRoot -- SEED-004 clone of lib/core/room-root.cjs:79-89. Walk UP
// from `start` (a resolved target path) to the nearest ancestor dir carrying a
// `.room-root` FILE sentinel WITHOUT walking above `root` (the MindrianRooms
// root). The FIRST sentinel hit is the DEEPEST room the write actually lands in,
// so a write into a sub-sub-room resolves to that sub-sub-room, not a parent.
// Tolerates unreadable dirs; returns null when no sentinel is found under root.
// Never throws (the hook must keep its fail-open exit-0 degrade).
function walkUpToRoomRoot(start, root) {
  try {
    let dir = start;
    // If start is an existing file, begin at its dirname; else treat as a dir
    // anchor (a not-yet-created leaf still walks up toward real ancestors).
    try {
      if (fs.existsSync(start) && fs.statSync(start).isFile()) {
        dir = path.dirname(start);
      }
    } catch (_e) {
      dir = start;
    }
    for (let hops = 0; hops < ROOM_ROOT_MAX_DEPTH; hops += 1) {
      // Never resolve a sentinel at or above the rooms root itself.
      const relToRoot = path.relative(root, dir);
      if (!relToRoot || relToRoot.startsWith('..') || path.isAbsolute(relToRoot)) {
        break;
      }
      try {
        if (fs.existsSync(path.join(dir, '.room-root'))) return dir;
      } catch (_e) { /* keep walking past an unreadable dir */ }
      const parent = path.dirname(dir);
      if (parent === dir) break; // hit the filesystem root
      dir = parent;
    }
    return null;
  } catch (_e) {
    return null;
  }
}

// slugForRoomDir -- reverse-match a resolved room dir against the registry
// `.rooms/registry.json` entry `path` fields and return the REGISTERED slug, or
// null. Symmetric with readActiveRoom (which reads the same registry): active
// resolution and target resolution now speak the same slug vocabulary. Never
// throws.
function slugForRoomDir(root, sentinelDir) {
  try {
    const relDir = normSegments(path.relative(root, sentinelDir));
    if (!relDir) return null;
    const regPath = path.join(root, '.rooms', 'registry.json');
    const parsed = JSON.parse(fs.readFileSync(regPath, 'utf8'));
    if (!parsed || !parsed.rooms || typeof parsed.rooms !== 'object') return null;
    for (const [slug, spec] of Object.entries(parsed.rooms)) {
      if (!spec || typeof spec.path !== 'string') continue;
      if (normSegments(spec.path) === relDir) return slug;
    }
    return null;
  } catch (_e) {
    return null;
  }
}

// resolveAncestorChain -- quick task 260728-051. Given a REGISTERED slug, return
// its ancestor slugs (immediate parent first, furthest ancestor last) by walking
// the registry `parent` field UPWARD. The write-guard feeds this to
// isRoomInWriteScope so a session bound to a PARENT room may write into that
// parent's own registered sub-rooms without a second, separate room_bind call.
//
// Deliberately reads the CHILD's own `parent` field bottom-up rather than the
// parent's `sub_rooms` array top-down: the live registry's `sub_rooms` lists are
// known-incomplete (motj-ecosystem.sub_rooms is missing jonathan-contractor-motj,
// whose own `parent` field is present and correct). That list-side data gap is a
// separate concern; this helper never edits the registry.
//
// Depth-bounded by ROOM_ROOT_MAX_DEPTH (the same constant the .room-root walk-up
// uses) and cycle-guarded by a seen-Set seeded with the starting slug, so a
// cyclic registry (A.parent=B, B.parent=A) breaks on the first repeat. Returns
// [] on any failure and NEVER throws (mirrors slugForRoomDir/walkUpToRoomRoot).
function resolveAncestorChain(root, slug) {
  try {
    if (typeof slug !== 'string' || slug.length === 0) return [];
    const regPath = path.join(root, '.rooms', 'registry.json');
    const parsed = JSON.parse(fs.readFileSync(regPath, 'utf8'));
    if (!parsed || !parsed.rooms || typeof parsed.rooms !== 'object') return [];
    const chain = [];
    const seen = new Set([slug]);
    let current = slug;
    for (let hops = 0; hops < ROOM_ROOT_MAX_DEPTH; hops += 1) {
      const spec = parsed.rooms[current];
      if (!spec || typeof spec !== 'object') break;
      const parent = spec.parent;
      if (typeof parent !== 'string' || parent.length === 0) break;
      if (seen.has(parent)) break; // cycle guard
      seen.add(parent);
      chain.push(parent);
      current = parent;
    }
    return chain;
  } catch (_e) {
    return [];
  }
}

// Given a realpath'd MindrianRooms root and a realpath'd target, return the
// REGISTERED room slug the target write lands in, or null if target is not under
// root.
//
// SEED-004 (Phase 195 Wave 0): the MindrianRooms tree is FRACTAL - a room can be
// nested many segments deep (mindrian/mindrianOS/...). The original flat
// first-segment split returned the TOP segment ("mindrian") for a nested write,
// so 194's set-membership check received the WRONG slug and false-blocked every
// write into a bound/active nested room (and would false-block born-wired
// sub-room seeding in Wave 2). Fix: walk UP to the DEEPEST `.room-root` sentinel
// (the room the write actually lands in), then reverse-match that dir against the
// registry `path` fields to recover the REGISTERED slug. This does NOT
// over-correct to silent-allow: a write into a DIFFERENT nested room than the
// bound/active one resolves to THAT room's slug and still BLOCKS downstream
// (the 95.1 drift-class-C hazard). Fail-open preserved: any resolution miss
// falls back to the original flat first-segment split.
function targetRoomUnderRoot(root, target) {
  const rel = path.relative(root, target);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    return null;
  }
  // Preferred: walk-up to the deepest .room-root + registry reverse-match.
  const sentinelDir = walkUpToRoomRoot(target, root);
  if (sentinelDir) {
    const slug = slugForRoomDir(root, sentinelDir);
    if (slug) return slug;
  }
  // Fallback (fail-open toward the pre-194 behavior): no sentinel or no registry
  // match -> the top segment, as before. Preserves semantics for flat
  // single-segment rooms, unregistered dirs, and root-level files (which the
  // downstream isRootLevelFile check classifies independently on the raw rel).
  const segments = rel.split(path.sep).filter(Boolean);
  if (segments.length === 0) return null;
  return segments[0];
}

// A depth-1 path under the MindrianRooms root that is NOT a directory is a
// root-level FILE (e.g. INDEX.md), not a room. Classifying it as a room
// produces the nonsense remediation "/mos:rooms switch INDEX.md". On stat
// error (nonexistent depth-1 path) we return true: an agent creating a new
// root-level FILE is the case this hook must catch; creating a new room
// directory goes through /mos:rooms new, not a raw Write.
function isRootLevelFile(root, target) {
  const rel = path.relative(root, target);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    return false;
  }
  const segments = rel.split(path.sep).filter(Boolean);
  if (segments.length !== 1) return false;
  try {
    return !fs.statSync(target).isDirectory();
  } catch (_) {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function readStdinSync() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch (_) {
    return '';
  }
}

function allow() { process.exit(0); }

// 88.1-03: systemMessage retrofit. Pre-emit a JSON envelope on stdout with
// the warning context BEFORE writing the block reason to stderr and exiting 2.
// v1.10.19 (hotfixes shipped 2026-04-26): Claude Code 2.x schema added `additionalProperties: false`,
// so top-level `systemMessage` is rejected. Wrap in `hookSpecificOutput` per
// the new schema. The stderr text remains the authoritative block reason.
// Silent on allow (no JSON emitted when everything is fine).
// LOCAL-only (Canon Part 8): room slugs only, no file payload echoed.
function emitSystemMessage(sysMsg) {
  if (!sysMsg) return;
  try {
    const payload = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext: String(sysMsg),
      },
    };
    process.stdout.write(JSON.stringify(payload) + '\n');
  } catch (_e) { /* best-effort */ }
}

function block(message, systemMessage) {
  if (systemMessage) emitSystemMessage(systemMessage);
  process.stderr.write(message);
  if (!message.endsWith('\n')) process.stderr.write('\n');
  process.exit(2);
}

function main() {
  const raw = readStdinSync();
  if (!raw || !raw.trim()) return allow();

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (_) {
    return allow();
  }
  if (!payload || typeof payload !== 'object') return allow();

  const targetPath = extractTargetPath(payload.tool_input);
  if (!targetPath) return allow();

  const root = resolveMindrianRoomsRoot();
  if (!root) return allow();

  const realRoot = safeRealpath(root);
  // For target, we resolve the closest existing ancestor so that writes to
  // not-yet-created files still resolve correctly. fs.realpathSync fails on
  // non-existent paths, so walk upward until an existing ancestor is found.
  let resolvedTarget;
  try {
    resolvedTarget = fs.realpathSync(targetPath);
  } catch (_) {
    let probe = path.resolve(targetPath);
    const parts = [];
    while (probe && probe !== path.dirname(probe)) {
      if (fs.existsSync(probe)) {
        const realProbe = safeRealpath(probe);
        resolvedTarget = path.join(realProbe, ...parts.reverse());
        break;
      }
      parts.push(path.basename(probe));
      probe = path.dirname(probe);
    }
    if (!resolvedTarget) resolvedTarget = path.resolve(targetPath);
  }

  const targetRoom = targetRoomUnderRoot(realRoot, resolvedTarget);
  if (!targetRoom) return allow();

  const activeRoom = readActiveRoom(realRoot);
  if (!activeRoom) return allow();

  // Root-level FILE classification runs before isSealed: probing
  // root/INDEX.md/GUARDRAIL.md (a path under a file) is nonsense, and the
  // root-file message must win over the cross-room message.
  if (isRootLevelFile(realRoot, resolvedTarget)) {
    return block(
      'Blocked: write to MindrianRooms root file ' + targetRoom + ' denied. The rooms root is a shared routing surface, not a room.\n' +
      'With explicit user approval, apply the edit via a shell command or /mos:rooms maintenance.',
      'blocked write to rooms-root file ' + targetRoom + ' (active: ' + activeRoom + ')'
    );
  }

  const sealed = isSealed(realRoot, targetRoom);

  if (sealed) {
    return block(
      'Blocked: write to sealed room ' + targetRoom + ' denied. This room is sealed by GUARDRAIL.md and cannot be written from another scope.\n' +
      'To authorize, run: /mos:rooms switch ' + targetRoom,
      'blocked write to sealed room ' + targetRoom + ' (active: ' + activeRoom + ')'
    );
  }

  // Session-aware set-membership (194-05, PSB-07 / D-04). A session may span
  // rooms (bound is a SET), so block only when the target is OUTSIDE that set.
  // isRoomInWriteScope also bypasses for a dev-repo/no-room binding, so a
  // no-room session never false-blocks. An UNBOUND session degrades to the
  // pre-194 single-active-room equality (safe fallback; the F.8 binding gate
  // graduates it to a bound set). Any resolution error falls through to the
  // equality path, never a hard block.
  let binding = null;
  try {
    const sessionBinding = require('../lib/core/session-binding.cjs');
    binding = sessionBinding.readSessionBinding(resolveSessionId(payload, realRoot));
    const isBound = binding && Array.isArray(binding.bound) && binding.bound.length > 0;
    if (isBound) {
      // 260728-051: a bound PARENT authorizes its registered sub-rooms. Resolved
      // only on the bound path (an unbound session never needs the chain).
      const ancestorChain = resolveAncestorChain(realRoot, targetRoom);
      if (sessionBinding.isRoomInWriteScope(targetRoom, binding, ancestorChain)) {
        return allow();
      }
      return block(
        'Blocked: write to ' + targetRoom + ' denied. This session is bound to [' + binding.bound.join(', ') + '].\n' +
        'To authorize, run: /mos:rooms switch ' + targetRoom + ' (or re-bind this session to include it).',
        'blocked write to ' + targetRoom + ': not in session bound set [' + binding.bound.join(', ') + ']'
      );
    }
  } catch (_) {
    // fall through to the pre-194 equality fallback (never hard-block on error)
  }

  if (targetRoom !== activeRoom) {
    return block(
      'Blocked: write to ' + targetRoom + ' denied. Active room is ' + activeRoom + '.\n' +
      'To authorize, run: /mos:rooms switch ' + targetRoom + '\n' +
      '(Or save the artifact in the active room if it belongs there.)',
      'blocked write to ' + targetRoom + ': active room is ' + activeRoom
    );
  }

  return allow();
}

try {
  main();
} catch (_) {
  // Fail-open on any unexpected error.
  process.exit(0);
}
