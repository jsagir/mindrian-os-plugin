'use strict';
/*
 * tests/helpers/fixture-room-354.cjs -- Phase 354-01 Task 2: shared scratch-
 * room fixture and captured-tool-server helper for every Phase 354 test.
 *
 * makeScratchRoom(label): mkdtemps a root under os.tmpdir() named
 * `mos-354-<label>-`, sets process.env.MINDRIAN_ROOMS_HOME to
 * `<root>/rooms-home`, creates `<root>/<label>` as the room directory, opens
 * then closes its room.db through lib/core/room-db.cjs openRoomDb/closeRoomDb
 * (the docs/reviews/phase-354-probes/persistence.cjs makeRoom() idiom, reused
 * per Canon Part 7), and returns { root, room, cleanup }. cleanup removes
 * ONLY the mkdtemp root this call created (T-354-31: never a caller-supplied
 * path).
 *
 * captureToolServer(): returns { server, handlers } where server.tool(name,
 * description, schema, handler) and server.registerTool(name, config,
 * handler) both store the handler in the shared handlers Map -- both real
 * MCP SDK registration idioms exist across this repo's tool files
 * (lib/mcp/tools/*.cjs use server.tool(); bin/mindrian-brain-mcp-client.cjs
 * uses server.registerTool()), so a fixture that only stubbed one would miss
 * half the surface under test.
 *
 * SKIP_EXIT_CODE = 77: the shared ENV GAP sentinel every Phase 354 test and
 * tests/run-all-354.sh itself agree on (exit 77 means SKIPPED, never PASSED).
 *
 * CJS, zero npm dependencies (node:fs, node:os, node:path plus the in-repo
 * lib/core/room-db.cjs). Hyphens only, no em-dashes (CLAUDE.md HARD RULE).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { openRoomDb, closeRoomDb } = require('../../lib/core/room-db.cjs');

const SKIP_EXIT_CODE = 77;

/**
 * makeScratchRoom(label) -> { root, room, cleanup }
 *
 * label -- a short, filesystem-safe string identifying the caller (e.g. the
 *          test file's own short name). Used only in the mkdtemp prefix.
 */
function makeScratchRoom(label) {
  const safeLabel = (typeof label === 'string' && label.length > 0) ? label : 'anon';
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-354-' + safeLabel + '-'));
  process.env.MINDRIAN_ROOMS_HOME = path.join(root, 'rooms-home');
  const room = path.join(root, safeLabel);
  fs.mkdirSync(room, { recursive: true });
  const db = openRoomDb(room);
  closeRoomDb(db);
  return {
    root,
    room,
    cleanup: function cleanup() {
      try { fs.rmSync(root, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
    },
  };
}

/**
 * captureToolServer() -> { server, handlers }
 *
 * server.tool(name, description, schema, handler) and
 * server.registerTool(name, config, handler) both store the resolved
 * handler function into `handlers` (a Map<string, Function>), so a caller
 * that registers real MCP tools against this fake server can later invoke
 * `handlers.get('tool_name')(params, extra)` directly, exactly the idiom
 * docs/reviews/phase-354-probes/persistence.cjs already uses.
 */
function captureToolServer() {
  const handlers = new Map();
  const server = {
    tool: function tool(name, _description, _schema, handler) {
      handlers.set(name, handler);
    },
    registerTool: function registerTool(name, _config, handler) {
      handlers.set(name, handler);
    },
  };
  return { server, handlers };
}

module.exports = {
  SKIP_EXIT_CODE,
  makeScratchRoom,
  captureToolServer,
};
