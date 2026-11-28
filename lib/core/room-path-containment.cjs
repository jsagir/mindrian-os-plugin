'use strict';
/**
 * lib/core/room-path-containment.cjs -- Phase 354-05 (SYS-01, CTX-SYMLINK).
 *
 * ONE realpath-containment helper for every room read/write site. Closes the
 * seam named in 354-CONTEXT.md: lib/mcp/tool-router.cjs's safeResolveSection
 * checked containment LEXICALLY (path.resolve + startsWith) while
 * lib/mcp/tools/views.cjs wrote through the RESOLVED filesystem path -- an
 * existing room/research symlink is lexically inside the room but its
 * realpath is not, so the lexical check passed and the write escaped.
 *
 * Symlink policy (decided in 354-05-PLAN.md, per CTX-SYMLINK "define a
 * symlink policy"): a directory symlink inside a room is followed only when
 * its realpath stays inside the room's realpath; any section, destination
 * or existing parent whose realpath leaves the room is refused; the final
 * file write never follows a symlink leaf (atomic temp-file plus rename
 * inside the contained parent replaces the directory entry instead of
 * writing through it).
 *
 * Mirrors the lexical assertContained/atomicWrite idiom already shipped in
 * lib/core/recovery/case-file.cjs (Canon Part 7: reuse before build), adding
 * the realpath leg that idiom does not need (case-file.cjs never deals with
 * a caller-controlled symlink inside its own scratch directory).
 *
 * CJS, zero npm dependencies. Hyphens only, no em-dashes (CLAUDE.md HARD RULE).
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

/**
 * resolveExistingRealpath(p) -> the canonical path p WOULD have, following
 * every symlink actually on disk, even when p itself (or any suffix of it)
 * does not exist yet. Walks up from p to find the deepest existing ancestor
 * (lstat, not stat -- a symlink itself counts as "existing" so its own
 * realpath is what gets resolved, never blindly followed one level early),
 * resolves THAT ancestor's realpath, then rejoins the non-existing
 * remainder (which cannot itself be a symlink, since it does not exist).
 * The walk always terminates: every absolute path's ancestor chain reaches
 * a filesystem root that exists.
 *
 * Returns null only if realpathSync itself fails on an existing ancestor
 * (permission error, race where it vanished mid-walk) -- callers treat null
 * as "cannot prove containment", i.e. refuse.
 *
 * @param {string} p
 * @returns {string|null}
 */
function resolveExistingRealpath(p) {
  const target = path.resolve(p);
  const remainder = [];
  let cursor = target;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let exists = false;
    try {
      fs.lstatSync(cursor);
      exists = true;
    } catch (_e) {
      exists = false;
    }
    if (exists) break;
    const parent = path.dirname(cursor);
    if (parent === cursor) {
      // Reached the filesystem root without finding an existing ancestor
      // (should not happen -- the root itself always exists -- but fails
      // closed rather than looping if it somehow does).
      break;
    }
    remainder.unshift(path.basename(cursor));
    cursor = parent;
  }

  let realExistingAncestor;
  try {
    realExistingAncestor = fs.realpathSync(cursor);
  } catch (_e) {
    return null;
  }

  return remainder.length > 0
    ? path.join(realExistingAncestor, ...remainder)
    : realExistingAncestor;
}

/**
 * realRoomRoot(roomDir) -> the canonical (symlink-resolved) absolute path
 * roomDir WOULD have on disk. Uses resolveExistingRealpath rather than a
 * bare fs.realpathSync so a not-yet-created roomDir (a legitimate caller
 * shape in this codebase's own test suite) still resolves deterministically
 * against its nearest existing ancestor, instead of throwing ENOENT.
 *
 * @param {string} roomDir
 * @returns {string}
 */
function realRoomRoot(roomDir) {
  const resolved = resolveExistingRealpath(roomDir);
  if (resolved === null) {
    throw new Error('room directory does not resolve: ' + roomDir);
  }
  return resolved;
}

/**
 * isRealpathContained(roomDir, absPath) -> true when absPath's realpath sits
 * inside roomDir's realpath. absPath may not exist yet (a destination file
 * that has not been written) -- see resolveExistingRealpath.
 *
 * @param {string} roomDir
 * @param {string} absPath - an already-absolute path (path.resolve'd by the caller)
 * @returns {boolean}
 */
function isRealpathContained(roomDir, absPath) {
  let root;
  try {
    root = realRoomRoot(roomDir);
  } catch (_e) {
    return false;
  }

  const rejoined = resolveExistingRealpath(absPath);
  if (rejoined === null) return false;

  return rejoined === root || rejoined.startsWith(root + path.sep);
}

/**
 * assertRealpathContained(roomDir, absPath, label) -> absPath when contained.
 * Throws an Error with code 'ROOM_PATH_ESCAPE' otherwise.
 *
 * @param {string} roomDir
 * @param {string} absPath
 * @param {string} label - identifies the call site in the thrown message
 * @returns {string} absPath, unchanged
 */
function assertRealpathContained(roomDir, absPath, label) {
  if (!isRealpathContained(roomDir, absPath)) {
    const err = new Error('room path escapes room via symlink: ' + label);
    err.code = 'ROOM_PATH_ESCAPE';
    throw err;
  }
  return absPath;
}

/**
 * writeFileContained(roomDir, filePath, content) -> writes content to
 * filePath, never following a symlink LEAF. The parent directory must
 * already be realpath-contained (asserted here as a final defense-in-depth
 * check, even though every caller should have asserted the section/scope
 * dir already). If filePath itself exists and is a symlink, the write still
 * proceeds -- by REPLACEMENT: content lands in a 'wx'-created temp file in
 * the contained parent directory, then fs.renameSync atomically swaps the
 * directory entry, which replaces a symlink leaf rather than writing
 * through it (rename() replaces whatever is at the destination path, it
 * does not dereference a symlink there).
 *
 * @param {string} roomDir
 * @param {string} filePath - absolute path to the file being written
 * @param {string} content
 * @returns {void}
 */
function writeFileContained(roomDir, filePath, content) {
  const parentDir = path.dirname(path.resolve(filePath));
  assertRealpathContained(roomDir, parentDir, 'parent of ' + filePath);

  const base = path.basename(filePath);
  const tmpName = '.' + base + '.' + process.pid + '.' + crypto.randomBytes(6).toString('hex') + '.tmp';
  const tmpPath = path.join(parentDir, tmpName);

  let fd;
  try {
    fd = fs.openSync(tmpPath, 'wx');
    fs.writeSync(fd, typeof content === 'string' ? content : '');
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(tmpPath, filePath);
  } catch (e) {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch (_e2) { /* best-effort */ }
    }
    try { fs.unlinkSync(tmpPath); } catch (_e3) { /* best-effort cleanup */ }
    throw e;
  }

  // Re-assert after the rename: the rename can only have landed inside the
  // already-contained parent, but this is a cheap final floor consistent
  // with the module's own "assert, then act, then re-assert" discipline
  // (mirrors the TOCTOU re-assert the plan requires after mkdirSync).
  assertRealpathContained(roomDir, path.dirname(path.resolve(filePath)), 'parent of ' + filePath + ' (post-write)');
}

const MAX_REL_PATH_CHARS = 400;

// A relative path with no '..' segment, no NUL, no drive or UNC prefix.
// Same rules as lib/mcp/tools/artifact-read.cjs isSafeRelative.
function isSafeRelativePath(p) {
  if (typeof p !== 'string' || p.length === 0 || p.length > MAX_REL_PATH_CHARS) return false;
  if (p.indexOf('\0') !== -1) return false;
  if (path.isAbsolute(p) || path.win32.isAbsolute(p) || /^[A-Za-z]:/.test(p)) return false;
  if (p.startsWith('/') || p.startsWith('\\')) return false;
  return !p.split(/[\\/]/).some((seg) => seg === '..');
}

// Drop a leading YAML frontmatter block: the first line is three hyphens and a
// later line of three hyphens closes it. Anything else is returned unchanged.
function stripFrontmatter(text) {
  const m = /^---[ \t]*\r?\n/.exec(text);
  if (!m) return text;
  const rest = text.slice(m[0].length);
  const close = /^---[ \t]*(?:\r?\n|$)/m.exec(rest);
  if (!close) return text;
  return rest.slice(close.index + close[0].length);
}

/**
 * readContainedTextExcerpt(roomDir, relPath, opts) -> a bounded text excerpt of
 * one markdown file inside the room (Phase 400.4 plan 06, QA-F9). Local read
 * only. Applies the artifact-read containment rules: safe relative path, .md
 * only, lexical containment, realpath containment, regular file. Reads at most
 * maxChars * 4 bytes, drops a broken trailing character, removes frontmatter,
 * trims leading blank lines, cuts to maxChars. Never throws.
 *
 * @param {string} roomDir
 * @param {string} relPath - room-relative path ending in .md
 * @param {{maxChars?: number}} [opts]
 * @returns {{ok: true, text: string, truncated: boolean} | {ok: false, reason: string}}
 */
function readContainedTextExcerpt(roomDir, relPath, opts) {
  let fd = null;
  try {
    const o = opts && typeof opts === 'object' ? opts : {};
    const maxChars = Number.isInteger(o.maxChars) && o.maxChars > 0 ? Math.min(o.maxChars, 100000) : 4000;
    if (typeof roomDir !== 'string' || !roomDir || !isSafeRelativePath(relPath)) {
      return { ok: false, reason: 'path_outside_room' };
    }
    if (!/\.md$/i.test(relPath)) return { ok: false, reason: 'not_markdown' };
    const roomRoot = path.resolve(roomDir);
    const abs = path.resolve(roomRoot, relPath);
    if (!abs.startsWith(roomRoot + path.sep) || !isRealpathContained(roomRoot, abs)) {
      return { ok: false, reason: 'path_outside_room' };
    }
    let st;
    try {
      st = fs.statSync(abs);
    } catch (e) {
      if (e && (e.code === 'ENOENT' || e.code === 'ENOTDIR')) return { ok: false, reason: 'not_found' };
      return { ok: false, reason: 'read_error' };
    }
    if (!st.isFile()) return { ok: false, reason: 'not_found' };
    const want = Math.min(st.size, maxChars * 4);
    const buf = Buffer.alloc(want);
    fd = fs.openSync(abs, 'r');
    let got = 0;
    while (got < want) {
      const n = fs.readSync(fd, buf, got, want - got, got);
      if (n === 0) break;
      got += n;
    }
    const cutByBytes = st.size > got;
    let text = buf.subarray(0, got).toString('utf8');
    if (cutByBytes && text.endsWith('�')) text = text.slice(0, -1);
    text = stripFrontmatter(text).replace(/^(?:[ \t]*\r?\n)+/, '');
    const cutByChars = text.length > maxChars;
    if (cutByChars) text = text.slice(0, maxChars);
    return { ok: true, text, truncated: cutByBytes || cutByChars };
  } catch (_e) {
    return { ok: false, reason: 'read_error' };
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch (_e2) { /* already closed */ }
    }
  }
}

module.exports = {
  realRoomRoot,
  isRealpathContained,
  assertRealpathContained,
  writeFileContained,
  readContainedTextExcerpt,
};
