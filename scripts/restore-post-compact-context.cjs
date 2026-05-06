#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 95.5 -- Post-Compact memory pipeline consumer (READ side).
 *
 * NOTE: This file uses ASCII `--` (two hyphens) throughout. NO Unicode
 * em-dashes (U+2014) or en-dashes (U+2013).
 *
 * Per D-01: NEW parallel CJS hook at scripts/restore-post-compact-context.cjs.
 *           Registers as 9th SessionStart entry in hooks/hooks.json (Plan 95.5-03).
 *           Mirrors 95.2 Finding C precedent (preflight-doctor.cjs is 8th entry).
 *
 * Per D-01a: Does NOT edit the load-bearing scripts/session-start Bash banner.
 *
 * Per D-02: Staleness check (mtime >600s = skip + delete) PLUS post-consume
 *           forensic rename to <roomDir>/.mindrian/.last-post-compact-consumed-<ISO>.md.
 *
 * Per D-03: hookSpecificOutput.additionalContext ONLY. NO systemMessage. Silent.
 *
 * Per D-04: Stamp + validate. Side-channel file carries YAML frontmatter
 *           (source_room_path + source_room_slug + written_at). Consumer reads
 *           ~/MindrianRooms/.rooms/registry.json, compares stamp to active room.
 *           HARD SKIP + forensic-rename to .last-post-compact-cross-room-skip-<ISO>.md
 *           on mismatch.
 *
 * Per D-04b: Belt-and-suspenders mtime vs registry.last_opened comparison.
 *
 * Per D-07: Workspace guard direction REVERSE from 95.2. This hook lives in
 *           the plugin but reads/writes room state at <roomDir>/.mindrian/
 *           OUTSIDE /home/jsagi/MindrianOS-Plugin/.
 *
 * Canon Part 8: zero network surface. No remote calls, no Brain access.
 *
 * WAVE 0 STUB: emits `{"continue":true}` only. Plan 95.5-02 implements full logic:
 *   1. Resolve active room via lib/core/folder-memory.cjs::getCurrentRoom(process.cwd()).
 *   2. Read side-channel file at <roomDir>/.mindrian/last-post-compact.md.
 *   3. Staleness check (mtime > 600s = skip + delete).
 *   4. Parse YAML frontmatter stamp.
 *   5. Validate stamp.source_room_path === activeRoom.path AND stamp.source_room_slug === activeRoom.slug.
 *   6. Belt-and-suspenders: file mtime >= registry.last_opened.
 *   7. Cross-room mismatch -> forensic rename + silent envelope.
 *   8. Match -> emit hookSpecificOutput.additionalContext + forensic rename to consumed.
 */

// eslint-disable-next-line no-unused-vars
const path = require('node:path');
// eslint-disable-next-line no-unused-vars
const fs = require('node:fs');
// eslint-disable-next-line no-unused-vars
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

function main() {
  // Wave 0 stub: no-op silent envelope. Plan 95.5-02 fills in the read-side
  // pipeline (resolve active room + read side-channel + staleness check +
  // YAML frontmatter parse + cross-room validation + envelope emit + forensic
  // rename). At Wave 0 the consumer is intentionally inert so the 9 D-05
  // tests stay RED until the implementation lands.
  return emitEmpty();
}

if (require.main === module) {
  main();
}

module.exports = {
  ENVELOPE_ALLOWED,
  emitEnvelope,
  emitEmpty,
};
