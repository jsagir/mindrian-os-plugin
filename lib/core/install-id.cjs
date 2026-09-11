#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick 260911-iko (D-01 through D-08) -- the opaque per-install id Theo
 * uses to bucket "one install calling twice" apart from "two installs
 * calling once", without ever learning who the install belongs to.
 *
 * WHAT IT IS FOR: Theo needs a bucket key. Today it has none, and every
 * substitute it could reach for instead (a key, a hostname, an account id)
 * would be user data crossing the Brain boundary, which Canon Part 8
 * forbids. A 128-bit coin flip minted locally and sent as a header is the
 * one answer that gives Theo the bucketing and gives the user nothing to
 * leak.
 *
 * WHY A CSPRNG VALUE IS A GENERIC HANDLE, NOT USER DATA (D-07): the value
 * is `crypto.randomBytes(16)`, 16 bytes straight out of the platform CSPRNG
 * with NO INPUT at all. There is no function from the user, the machine,
 * the account, the room, the path, the hostname, or the Brain key to this
 * value, so there is nothing to invert. A hash of an identifier would still
 * BE that identifier wearing a hat: the same user on two installs would
 * hash to the same bucket, and anyone holding the identifier could confirm
 * a match. A random 128-bit value cannot do either. It carries exactly one
 * bit of meaning: "the caller that sent this header before is the caller
 * sending it now."
 *
 * THE EXPLICIT FORBIDDEN LIST -- this module must NEVER derive the id from:
 *   - os.hostname()
 *   - os.userInfo() / os.userInfo().username
 *   - process.env.USER / process.env.USERNAME / process.env.LOGNAME
 *   - process.cwd()
 *   - a home directory path
 *   - a MAC address or machine id
 *   - an account id or room name
 *   - the Brain key (process.env.MINDRIAN_BRAIN_KEY, resolve-brain-key.cjs)
 *   - a hash of any of the above (crypto's createHash)
 * tests/test-339-install-id-header.cjs arm 9 scans THIS FILE with comments
 * stripped and fails the suite if any of those tokens appears outside this
 * prose -- so this comment is safe and LOAD-BEARING, and must stay.
 *
 * NEVER LOGGED, NEVER PRINTED IN FULL (D-03): doctor reports presence only,
 * and on rotation the word "rotated" -- never the value. The id itself is
 * the user's own to read from their own file.
 *
 * Posture copied deliberately from lib/core/brain-prewarm.cjs: this module
 * NEVER throws to its caller and NEVER writes to stdout, because it can run
 * inside an MCP stdio process where a stray stdout byte corrupts the
 * JSON-RPC transport. A single stderr line, guarded by MINDRIAN_DEBUG, is
 * permitted, and it prints the FILE PATH or an error message only, never
 * the id value.
 *
 * CJS only, no new dependencies: require only fs, path, os, crypto.
 * No em-dashes (hyphens only).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const INSTALL_ID_HEADER_NAME = 'x-theo-install-id';
const ID_SHAPE_RE = /^[a-f0-9]{32}$/;
const FILE_NAME = 'theo-install-id.json';

const debugLog = (msg) => {
  if (!process.env.MINDRIAN_DEBUG) return;
  try {
    process.stderr.write('[install-id] ' + msg + '\n');
  } catch (_e) {
    // swallow -- this function must never throw
  }
};

/**
 * installIdPath(homeDir) -- the on-disk location of the id file.
 *
 * Deliberately duplicates the SAME resolution expression as
 * lib/core/brain-prewarm.cjs::markerPath rather than extracting a shared
 * helper -- two call sites is below the threshold where coupling two
 * never-throws modules beats a duplicated two-line expression. Safety net:
 * tests/test-339-install-id-header.cjs arm 10 asserts both modules resolve
 * to the same directory (the drift guard). Extraction trigger: a THIRD
 * call site.
 *
 * @param {string} [homeDir] defaults to MINDRIAN_HOME or ~/.mindrian
 * @returns {string}
 */
function installIdPath(homeDir) {
  const home = homeDir || process.env.MINDRIAN_HOME || path.join(os.homedir(), '.mindrian');
  return path.join(home, FILE_NAME);
}

/**
 * Read the id file and return the id string, or null on any failure, any
 * shape mismatch, or a fresh homeDir with no file yet. Never mints, never
 * writes, never throws.
 * @param {string} filePath
 * @returns {string|null}
 */
function _readValidId(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.id === 'string' && ID_SHAPE_RE.test(parsed.id)) {
      return parsed.id;
    }
    return null;
  } catch (_e) {
    return null;
  }
}

/**
 * peekInstallId({ homeDir }) -- read-only. Returns the id when the file
 * holds a valid one, otherwise null. NEVER mints, NEVER writes, NEVER
 * throws. This exists so the doctor can report presence without a
 * diagnostic run silently creating the thing it is diagnosing.
 * @param {{homeDir?: string}} [opts]
 * @returns {string|null}
 */
function peekInstallId(opts) {
  const o = opts || {};
  try {
    return _readValidId(installIdPath(o.homeDir));
  } catch (_e) {
    return null;
  }
}

/**
 * Atomically write { id, minted_at } to installIdPath(homeDir), mode 0600.
 * Every fs operation is wrapped; any failure returns false and leaves no
 * temp file behind.
 * @param {string} homeDir
 * @param {string} id
 * @returns {boolean}
 */
function _atomicWrite(homeDir, id) {
  const finalPath = installIdPath(homeDir);
  const dir = path.dirname(finalPath);
  const tmpPath = path.join(
    dir,
    FILE_NAME + '.tmp-' + process.pid + '-' + crypto.randomBytes(3).toString('hex')
  );
  const body = { id: id, minted_at: new Date().toISOString() };
  const json = JSON.stringify(body);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(tmpPath, json, { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmpPath, finalPath);
    if (process.platform !== 'win32') {
      try {
        fs.chmodSync(finalPath, 0o600);
      } catch (_e) {
        // belt only -- the write-time mode already applied it.
      }
    }
    debugLog('id written: ' + finalPath);
    return true;
  } catch (e) {
    debugLog('id write failed: ' + (e && e.message ? e.message : String(e)));
    try {
      fs.unlinkSync(tmpPath);
    } catch (_e) {
      // no temp file to clean up, or already gone.
    }
    return false;
  }
}

/**
 * getInstallId({ homeDir }) -- mint-once. peekInstallId first; on a hit
 * return it. On a miss, mint a fresh 32-hex id from crypto.randomBytes(16),
 * write it atomically, then RE-CHECK for a concurrent winner: two processes
 * making their first Brain call at the same instant must converge on ONE
 * bucket, not split it. Every failure returns null rather than throwing.
 *
 * Returning null rather than an unpersisted in-memory id on a write
 * failure is deliberate: a volatile id would send a different value on
 * every process and quietly break the one-install-one-id property the
 * whole header exists to provide.
 *
 * @param {{homeDir?: string}} [opts]
 * @returns {string|null}
 */
function getInstallId(opts) {
  const o = opts || {};
  const existing = peekInstallId(o);
  if (existing) return existing;

  const minted = crypto.randomBytes(16).toString('hex');
  const wrote = _atomicWrite(o.homeDir, minted);
  if (!wrote) {
    // Concurrent-winner re-check even on our own write failure: another
    // process may have won the race while we were failing.
    return peekInstallId(o);
  }

  // Concurrent-winner re-check: if another process's mint landed between
  // our write and this read, defer to it so both processes converge on one
  // bucket rather than splitting into two.
  const afterWrite = peekInstallId(o);
  if (afterWrite && afterWrite !== minted) {
    return afterWrite;
  }
  return afterWrite || minted;
}

/**
 * resetInstallId({ homeDir }) -- mints unconditionally and REPLACES,
 * skipping the concurrent-winner re-check (rotation must win over an
 * existing file by definition). Same atomic write, same mode, same
 * never-throws contract.
 * @param {{homeDir?: string}} [opts]
 * @returns {string|null}
 */
function resetInstallId(opts) {
  const o = opts || {};
  const minted = crypto.randomBytes(16).toString('hex');
  const wrote = _atomicWrite(o.homeDir, minted);
  return wrote ? minted : null;
}

module.exports = {
  installIdHeaderName: INSTALL_ID_HEADER_NAME,
  installIdPath: installIdPath,
  peekInstallId: peekInstallId,
  getInstallId: getInstallId,
  resetInstallId: resetInstallId,
};
