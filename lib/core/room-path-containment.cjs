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

module.exports = {
  realRoomRoot,
  isRealpathContained,
  assertRealpathContained,
  writeFileContained,
};
