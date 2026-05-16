#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 119-01 -- Session-start cascade scanner for orphaned F.1 directive files.
 * REVISION 2026-05-16 (Blocker 3 Option A; Step 2c of Task 3).
 *
 * Detects orphaned <roomDir>/.context/pending-naming-decision.md files left over
 * from a prior session where the user closed Claude before answering the F.1
 * selector. When found, prints a JSONL summary so the session-start router
 * can surface it back to Larry as a decision_gate_pending operator state.
 *
 * Precedent: scripts/check-onboard-statusline.cjs (Phase 106-05 hook template).
 *
 * Per CLAUDE.md tri-polar HARD RULE: the scan logic is identical across CLI /
 * Desktop / Cowork; the consumer (Larry / Desktop conversational paraphrase /
 * Cowork shared-state coordinator) decides how to render.
 *
 * Canon Part 8: pure-local scan; no Brain MCP coupling.
 * Em-dash discipline: uses `--` never the U+2014 character per HARD RULE.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function resolveRoomsHome() {
  if (process.env.MINDRIAN_ROOMS_HOME && fs.existsSync(process.env.MINDRIAN_ROOMS_HOME)) {
    return process.env.MINDRIAN_ROOMS_HOME;
  }
  const defaultHome = path.join(os.homedir(), 'MindrianRooms');
  if (fs.existsSync(defaultHome)) return defaultHome;
  return null;
}

function readActiveSlug(roomsHome) {
  try {
    const reg = JSON.parse(fs.readFileSync(path.join(roomsHome, '.rooms', 'registry.json'), 'utf8'));
    return (reg && typeof reg.active === 'string' && reg.active.length > 0) ? reg.active : null;
  } catch (_e) { return null; }
}

function scanRoom(roomDir) {
  const directivePath = path.join(roomDir, '.context', 'pending-naming-decision.md');
  if (!fs.existsSync(directivePath)) return null;
  try {
    const stat = fs.statSync(directivePath);
    return {
      directive_path: directivePath,
      room_dir: roomDir,
      slug: path.basename(roomDir),
      mtime_ms: stat.mtimeMs,
    };
  } catch (_e) { return null; }
}

function main() {
  const roomsHome = resolveRoomsHome();
  if (!roomsHome) {
    process.stdout.write(JSON.stringify({ pending_count: 0, reason: 'rooms_home_not_found' }) + '\n');
    process.exit(0);
  }
  const pending = [];
  // Scan the active room first (the common case).
  const activeSlug = readActiveSlug(roomsHome);
  if (activeSlug) {
    const found = scanRoom(path.join(roomsHome, activeSlug));
    if (found) pending.push(found);
  }
  // Defense-in-depth: scan every direct child directory that looks like a
  // placeholder slug (untitled-*). Bounded to placeholder rooms because they
  // are the only rooms expected to host pending-naming-decision.md.
  try {
    const entries = fs.readdirSync(roomsHome, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name.indexOf('untitled-') !== 0) continue;
      if (e.name === activeSlug) continue;
      const found = scanRoom(path.join(roomsHome, e.name));
      if (found) pending.push(found);
    }
  } catch (_e) { /* ignore scan failures */ }

  process.stdout.write(JSON.stringify({
    pending_count: pending.length,
    pending: pending,
  }) + '\n');
  process.exit(0);
}

process.on('uncaughtException', function () {
  process.stdout.write(JSON.stringify({ pending_count: 0, reason: 'uncaught' }) + '\n');
  process.exit(0);
});

main();
