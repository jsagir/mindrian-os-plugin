'use strict';
// Phase 369 plan 13 (FEED369-02, D-13) -- room_artifact: one artifact's markdown
// from the bound room, for the shell's read-only BlockNote display.
//
// Part 7 justification (reuse before build): no existing surface returns a single
// artifact. room_search returns substring matches, room://section/{name} returns
// a whole section concatenated, room_content manages entities. The evidence
// reader needs one document by its room-relative path (the same path the
// `artifacts` collection's `file` field carries), and nothing else says that.
// Open question 1 is settled at its default: a tool in the status.cjs shape.
//
// Containment (T-369-13-01): an absolute path or any `..` segment is refused
// before the filesystem is touched; the resolved path must be lexically inside the
// room and then realpath-contained (lib/core/room-path-containment.cjs, the guard
// room://section uses), so a symlink that escapes the room is refused too.
//
// Part 8: local only. This module reaches no Brain host and makes no network
// call. Part 9: it never opens room.db. Part 11: born WIRED (`connectors` below).
//
// Answer shapes (JSON text, never thrown):
//   ok       { ok: true, path, bytes, markdown, truncated, modified_at }
//   refusals { ok: false, reason: 'room_unbound' | 'path_outside_room' | 'not_markdown'
//              | 'not_found' | 'read_error' }
//
// No em-dashes. CJS only.

const fs = require('node:fs');
const path = require('node:path');
const { z } = require('zod');

const { resolveEffectiveSessionId } = require('../../core/session-binding.cjs');
const { resolveMcpSessionRoom, describeRoomBinding } = require('../session-room.cjs');
const { isRealpathContained } = require('../../core/room-path-containment.cjs');

// Contract defaults: a 512 KiB default and a 2 MiB ceiling bound one artifact in
// one MCP text response; the 1024 floor keeps truncation meaningful.
const DEFAULT_MAX_BYTES = 524288;
const MAX_MAX_BYTES = 2097152;
const MIN_MAX_BYTES = 1024;
const MAX_PATH_CHARS = 400;

function textResponse(payload, isError) {
  const result = { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
  if (isError) result.isError = true;
  return result;
}

function resolveBoundRoom(ctx, extra) {
  const sessionId = resolveEffectiveSessionId(undefined, extra);
  // noFloor: an unbound session must not read some other room (T-369-13-02).
  const resolution = resolveMcpSessionRoom({ sessionId: sessionId, ctx: ctx, noFloor: true });
  const binding = describeRoomBinding(resolution);
  if (!resolution.dir || !(binding.bound || binding.operator_pinned)) return null;
  return { dir: resolution.dir, slug: resolution.slug || null };
}

// A relative path with no `..` segment, no NUL, no drive or UNC prefix.
function isSafeRelative(p) {
  if (typeof p !== 'string' || p.length === 0 || p.length > MAX_PATH_CHARS) return false;
  if (p.indexOf('\0') !== -1) return false;
  if (path.isAbsolute(p) || path.win32.isAbsolute(p) || /^[A-Za-z]:/.test(p)) return false;
  if (p.startsWith('/') || p.startsWith('\\')) return false;
  const segs = p.split(/[\\/]/);
  return !segs.some((s) => s === '..');
}

function handle(args, ctx, extra) {
  const a = args && typeof args === 'object' ? args : {};
  const rel = a.path;
  const room = resolveBoundRoom(ctx, extra);
  if (!room) {
    return textResponse({
      ok: false,
      reason: 'room_unbound',
      message: 'No room is bound to this session. Call room_list, then room_bind, then retry.',
    });
  }
  if (!isSafeRelative(rel)) {
    return textResponse({ ok: false, reason: 'path_outside_room', message: 'The path must be relative and stay inside the room.' });
  }
  if (!/\.md$/i.test(rel)) {
    return textResponse({ ok: false, reason: 'not_markdown', message: 'Only .md artifacts can be read.' });
  }
  const maxBytes = Number.isInteger(a.max_bytes)
    ? Math.min(MAX_MAX_BYTES, Math.max(MIN_MAX_BYTES, a.max_bytes))
    : DEFAULT_MAX_BYTES;

  const roomRoot = path.resolve(room.dir);
  const abs = path.resolve(roomRoot, rel);
  const lexical = abs.startsWith(roomRoot + path.sep);
  if (!lexical || !isRealpathContained(roomRoot, abs)) {
    return textResponse({ ok: false, reason: 'path_outside_room', message: 'The path resolves outside the room.' });
  }

  let fd = null;
  try {
    let st;
    try {
      st = fs.statSync(abs);
    } catch (e) {
      if (e && (e.code === 'ENOENT' || e.code === 'ENOTDIR')) {
        return textResponse({ ok: false, reason: 'not_found', path: rel, message: 'No such artifact in this room.' });
      }
      throw e;
    }
    if (!st.isFile()) {
      return textResponse({ ok: false, reason: 'not_found', path: rel, message: 'No such artifact in this room.' });
    }
    const want = Math.min(st.size, maxBytes);
    const buf = Buffer.alloc(want);
    fd = fs.openSync(abs, 'r');
    let got = 0;
    while (got < want) {
      const n = fs.readSync(fd, buf, got, want - got, got);
      if (n === 0) break;
      got += n;
    }
    const truncated = st.size > got;
    let markdown = buf.subarray(0, got).toString('utf8');
    // A cut can land inside a multi-byte character: drop the broken tail rather
    // than hand the reader a replacement glyph.
    if (truncated && markdown.endsWith('�')) markdown = markdown.slice(0, -1);
    return textResponse({
      ok: true,
      path: rel,
      bytes: got,
      markdown: markdown,
      truncated: truncated,
      modified_at: st.mtime.toISOString(),
    });
  } catch (err) {
    return textResponse({ ok: false, reason: 'read_error', path: rel, message: String((err && err.message) || err).slice(0, 200) }, true);
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch (_e) { /* already closed */ }
    }
  }
}

function register(server, ctx) {
  server.registerTool(
    'room_artifact',
    {
      title: 'Room Artifact',
      description: "Return one markdown artifact from the bound room by its room-relative path, for display. It never writes, and the path cannot leave the room; a long document is cut at max_bytes and says so.",
      inputSchema: z.object({
        path: z.string().min(1).max(MAX_PATH_CHARS).describe('Room-relative path of a .md artifact, for example evidence/interview-03/interview-03.md.'),
        max_bytes: z.number().int().min(MIN_MAX_BYTES).max(MAX_MAX_BYTES).optional().describe('Most bytes to return, default 524288.'),
      }),
    },
    // Block-bodied on purpose: scripts/check-tool-honesty.cjs only counts a handler
    // it can read as a block, and a read tool should be inside that sweep.
    async (args, extra) => {
      return handle(args, ctx, extra);
    }
  );
}

// Born-wired SOURCE of truth (Part 11 R1/R16). room_artifact is a pure read
// (hitl_shape 'none'). scripts/build-connector-registry.cjs discovers this export
// and regenerates data/mcp-tool-connectors.json + data/connector-registry.json;
// never hand-edit either generated file.
const connectors = [
  {
    tool: 'room_artifact',
    surface: 'room_artifact',
    connector: 'mcp-tool',
    hitl_shape: 'none',
    hitl_why: "Pure read: returns one artifact's markdown from the bound room for display, no fork.",
    layer: 'harness',
    layer_why: 'Local room file read inside the bound room, contained by realpath.',
  },
];

module.exports = {
  register,
  connectors,
  _internal: { handle, isSafeRelative, DEFAULT_MAX_BYTES, MAX_MAX_BYTES, MIN_MAX_BYTES },
};
