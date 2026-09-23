#!/usr/bin/env node
'use strict';

// Phase 358-09 Task 2 -- the cross-process child for the close-everything
// persistence proof (B2-08): "close everything, reopen: the history is
// there". This file is a TEST FIXTURE, never a test itself, and it never
// requires another tests/ file (ported in shape from
// tests/helpers/b1-358-child.cjs).
//
// Usage: node tests/helpers/b2-358-child.cjs <tool> <roomDir> <sessionId> [jsonArgs]
//   tool      -- question_set or question_read
//   roomDir   -- the shared hermetic room every child in a run resolves to
//   sessionId -- the session this one call is made under
//   jsonArgs  -- optional JSON string, the tool's own args (e.g.
//                '{"text":"...","origin":"tasking"}')
//
// Inherits HOME / MINDRIAN_HOME / MINDRIAN_ROOMS_HOME from the parent
// process env (the test file sets these on a shared CHILD_ENV so every
// child, in every "session", resolves to the SAME room via the same
// hermetic rooms-home). MINDRIAN_MCP_FIRST and CLAUDE_ACTIVE_ROOM are
// deleted BEFORE any lib module is required, so the write-path gate below is
// decided purely by the stubbed claude-ai identity (the real Claude Desktop
// identity), never an inherited flag.
//
// Prints exactly one JSON line on stdout: { tool, ok, payload }. `ok` means
// a parseable payload came back over the tool's own response envelope; the
// PARENT is the one that asserts payload.ok (never trust a child's own
// success claim as the persistence proof -- the parent's own P7 direct
// room.db read is what proves persistence). Exit 0 when parseable, 1
// otherwise.
//
// No em-dashes.

delete process.env.MINDRIAN_MCP_FIRST;
delete process.env.CLAUDE_ACTIVE_ROOM;

const path = require('node:path');
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const { registerCoreTools } = require(path.join(REPO_ROOT, 'lib', 'mcp', 'register-core-tools.cjs'));

function registerAndCapture(roomDir) {
  const captured = new Map();
  const stubServer = {
    tool: (name, description, schema, handler) => {
      captured.set(name, { description: description, schema: schema, handler: handler });
    },
    server: { getClientVersion: () => ({ name: 'claude-ai', version: '0.1.0' }) },
  };
  registerCoreTools(stubServer, { fallbackRoomDir: roomDir, pluginRoot: REPO_ROOT, surface: 'desktop' });
  return captured;
}

async function callTool(captured, name, args, sessionId) {
  const reg = captured.get(name);
  if (!reg) throw new Error('tool not registered: ' + name);
  const raw = await reg.handler(args || {}, { sessionId: sessionId });
  const text = raw && raw.content && raw.content[0] && raw.content[0].text;
  return text ? JSON.parse(text) : null;
}

function emit(tool, ok, extra) {
  process.stdout.write(JSON.stringify(Object.assign({ tool: tool, ok: !!ok }, extra || {})) + '\n');
  process.exitCode = ok ? 0 : 1;
}

async function main() {
  const tool = process.argv[2];
  const roomDir = process.argv[3];
  const sessionId = process.argv[4];
  const rawArgs = process.argv[5];

  if (!tool || !roomDir || !sessionId) {
    emit(tool || null, false, { error: 'usage: <question_set|question_read> <roomDir> <sessionId> [jsonArgs]' });
    return;
  }
  if (tool !== 'question_set' && tool !== 'question_read') {
    emit(tool, false, { error: 'unknown tool: ' + tool });
    return;
  }

  let args = {};
  if (rawArgs !== undefined) {
    try {
      args = JSON.parse(rawArgs);
    } catch (e) {
      emit(tool, false, { error: 'bad jsonArgs: ' + String(e.message || e) });
      return;
    }
  }

  const captured = registerAndCapture(roomDir);
  let payload;
  try {
    payload = await callTool(captured, tool, args, sessionId);
  } catch (e) {
    emit(tool, false, { error: String((e && e.message) || e) });
    return;
  }
  emit(tool, payload !== null && payload !== undefined, { payload: payload });
}

main().catch((e) => {
  emit(process.argv[2] || null, false, { error: String((e && e.message) || e) });
});
