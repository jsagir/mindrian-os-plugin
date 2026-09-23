#!/usr/bin/env node
'use strict';

// Phase 358-04 Task 3 -- the cross-process child for the AT2 literal proof
// ("close everything, new session, reopen: the record is there and
// readable"). This file is a TEST FIXTURE, never a test itself, and it never
// requires another tests/ file.
//
// Usage: node tests/helpers/b1-358-child.cjs <mode> <roomDir> <sessionId> [query]
// Modes:
//   write      -- claim_write the bridge claim, then claim_verify it
//                 (against_id 'field note, exercise 02', rung 3, compare,
//                 contradicts) in the SAME session.
//   refile     -- the identical claim_write again, same session (proves the
//                 checking record survives a re-file across a fresh process,
//                 the cross-process face of the fix tests/test-358-b1-
//                 refile.cjs already regression-tests in-process).
//   file-again -- the identical claim_write, but in whatever session is
//                 given on the command line -- a NEW session re-filing the
//                 same sentence mints a NEW claim id (Pitfall 3), never a
//                 dedupe.
//   read       -- claim_read { query }.
//
// Inherits HOME / MINDRIAN_HOME / MINDRIAN_ROOMS_HOME from the parent
// process env (the test file sets these on a shared CHILD_ENV so every
// child, in every "session", resolves to the SAME room via the same
// hermetic rooms-home). MINDRIAN_MCP_FIRST and CLAUDE_ACTIVE_ROOM are
// deleted BEFORE any lib module is required, so the write-path gate below is
// decided purely by the stubbed claude-ai identity (the real Claude Desktop
// identity, per the 358-02 host-tier fix), never an inherited flag.
//
// Exactly one JSON line on stdout: { mode, ok, node_id?, payload? }. Exit 0
// on ok, 1 otherwise.
//
// No em-dashes.

delete process.env.MINDRIAN_MCP_FIRST;
delete process.env.CLAUDE_ACTIVE_ROOM;

const path = require('node:path');
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const { registerCoreTools } = require(path.join(REPO_ROOT, 'lib', 'mcp', 'register-core-tools.cjs'));

const BRIDGE_TEXT = 'The bridge at grid 42 is passable.';
const BRIDGE_SEGMENT = 'b1-358-bridge';

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
  const raw = await reg.handler(args, { sessionId: sessionId });
  const text = raw && raw.content && raw.content[0] && raw.content[0].text;
  return text ? JSON.parse(text) : null;
}

function emit(mode, ok, extra) {
  process.stdout.write(JSON.stringify(Object.assign({ mode: mode, ok: !!ok }, extra || {})) + '\n');
  process.exitCode = ok ? 0 : 1;
}

async function main() {
  const mode = process.argv[2];
  const roomDir = process.argv[3];
  const sessionId = process.argv[4];
  const query = process.argv[5];

  if (!mode || !roomDir || !sessionId) {
    emit(mode || null, false, { error: 'usage: <mode> <roomDir> <sessionId> [query]' });
    return;
  }

  const captured = registerAndCapture(roomDir);

  if (mode === 'write' || mode === 'refile') {
    const writePayload = await callTool(captured, 'claim_write', {
      knowledge_type: 'fact',
      text: BRIDGE_TEXT,
      source_segment: BRIDGE_SEGMENT,
    }, sessionId);
    if (!writePayload || writePayload.ok !== true) {
      emit(mode, false, { payload: writePayload });
      return;
    }
    const nodeId = writePayload.node_id;
    if (mode === 'refile') {
      emit(mode, true, { node_id: nodeId, payload: writePayload });
      return;
    }
    const verifyPayload = await callTool(captured, 'claim_verify', {
      claim_id: nodeId,
      against_id: 'field note, exercise 02',
      against_kind: 'observation',
      rung: 3,
      method: 'compare',
      result: 'contradicts',
    }, sessionId);
    emit(mode, !!(verifyPayload && verifyPayload.ok === true), { node_id: nodeId, payload: verifyPayload });
    return;
  }

  if (mode === 'file-again') {
    const writePayload = await callTool(captured, 'claim_write', {
      knowledge_type: 'fact',
      text: BRIDGE_TEXT,
      source_segment: BRIDGE_SEGMENT,
    }, sessionId);
    emit(mode, !!(writePayload && writePayload.ok === true), {
      node_id: writePayload && writePayload.node_id, payload: writePayload,
    });
    return;
  }

  if (mode === 'read') {
    const readPayload = await callTool(captured, 'claim_read', { query: query }, sessionId);
    emit(mode, !!(readPayload && readPayload.ok === true), { payload: readPayload });
    return;
  }

  emit(mode, false, { error: 'unknown mode' });
}

main().catch((e) => {
  emit(process.argv[2] || null, false, { error: String((e && e.message) || e) });
});
