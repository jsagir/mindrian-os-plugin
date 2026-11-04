'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick 261030-a2s win 2: a per-user Node compile cache for hook processes.
 *
 * A hook process starts cold on every prompt, so Node parses and compiles the same few hundred
 * module files every time. module.enableCompileCache(dir) (Node 22.1+) keeps the compiled code
 * on disk; the next start reads it instead of compiling again. Node checks each entry against
 * the source hash and recompiles an entry that does not match.
 *
 * Where the cache lives (threat T-1, code injection): compiled code from the cache runs inside
 * every prompt's hook, so the folder must belong to this user alone.
 *   - base: XDG_CACHE_HOME when it is an absolute path; else, on win32, LOCALAPPDATA when it is
 *     absolute; else <home>/.cache. Never os.tmpdir(), never a room, never the plugin tree.
 *   - dir:  <base>/mindrian-os/node-compile-cache/<process.version>, created with mode 0700.
 *   - POSIX checks on the 3 components that this module owns (mindrian-os, node-compile-cache,
 *     <version>): each is a directory, not a symlink, owned by the current uid, and not group or
 *     other writable. The base must be owned by the current uid or by root.
 *   - win32: the uid and mode checks are skipped (per-user LOCALAPPDATA ACLs).
 * Any doubt disables the cache silently. The hook output never changes either way.
 *
 * This module never throws, never writes to stdout or stderr, and never chmods or deletes
 * anything. Node built-ins only. Hyphens only.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function defaultHome(env) {
  if (typeof env.HOME === 'string') return env.HOME;
  try { return os.homedir(); } catch (_e) { return ''; }
}

// resolveCompileCacheDir(opts) -> { dir, reason }. dir is null when the cache must stay off.
// Seams in opts: env, homedir, getuid, platform, version (the defaults are the process values).
function resolveCompileCacheDir(opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  try {
    const env = o.env || process.env;
    const platform = o.platform || process.platform;
    const version = o.version || process.version;
    const getuid = Object.prototype.hasOwnProperty.call(o, 'getuid') ? o.getuid : process.getuid;

    let base = null;
    const xdg = env.XDG_CACHE_HOME;
    if (typeof xdg === 'string' && xdg && path.isAbsolute(xdg)) {
      base = xdg;
    } else if (platform === 'win32' && typeof env.LOCALAPPDATA === 'string' && env.LOCALAPPDATA && path.isAbsolute(env.LOCALAPPDATA)) {
      base = env.LOCALAPPDATA;
    } else {
      const home = Object.prototype.hasOwnProperty.call(o, 'homedir') ? o.homedir : defaultHome(env);
      if (typeof home !== 'string' || !home || !path.isAbsolute(home)) return { dir: null, reason: 'home' };
      base = path.join(home, '.cache');
    }

    const own1 = path.join(base, 'mindrian-os');
    const own2 = path.join(own1, 'node-compile-cache');
    const dir = path.join(own2, version);
    try {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    } catch (_e) {
      return { dir: null, reason: 'mkdir' };
    }

    if (platform !== 'win32' && typeof getuid === 'function') {
      const uid = getuid();
      for (const p of [own1, own2, dir]) {
        const st = fs.lstatSync(p);
        if (st.isSymbolicLink()) return { dir: null, reason: 'symlink' };
        if (!st.isDirectory()) return { dir: null, reason: 'type' };
        if (st.uid !== uid) return { dir: null, reason: 'owner' };
        if ((st.mode & 0o022) !== 0) return { dir: null, reason: 'mode' };
      }
      const bst = fs.statSync(base);
      if (bst.uid !== uid && bst.uid !== 0) return { dir: null, reason: 'base-owner' };
    }
    return { dir, reason: null };
  } catch (_e) {
    return { dir: null, reason: 'error' };
  }
}

// enableHookCompileCache(opts) -> { enabled, status?, dir?, reason? }. Never throws.
function enableHookCompileCache(opts) {
  try {
    const r = resolveCompileCacheDir(opts);
    if (!r.dir) return { enabled: false, reason: r.reason };
    const mod = require('node:module');
    if (typeof mod.enableCompileCache !== 'function') return { enabled: false, reason: 'unsupported' };
    const res = mod.enableCompileCache(r.dir);
    const S = (mod.constants && mod.constants.compileCacheStatus) || {};
    const status = res && res.status;
    return { enabled: status === S.ENABLED || status === S.ALREADY_ENABLED, status, dir: r.dir };
  } catch (_e) {
    return { enabled: false, reason: 'error' };
  }
}

module.exports = { resolveCompileCacheDir, enableHookCompileCache };
