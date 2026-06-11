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

// Given a realpath'd MindrianRooms root and a realpath'd target, return the
// first path segment under root, or null if target is not under root.
// Uses path.relative + segment split to avoid substring false positives.
function targetRoomUnderRoot(root, target) {
  const rel = path.relative(root, target);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    return null;
  }
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
