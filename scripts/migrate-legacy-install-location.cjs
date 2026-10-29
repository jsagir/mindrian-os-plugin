#!/usr/bin/env node
'use strict';

/*
 * scripts/migrate-legacy-install-location.cjs -- Phase 341 Plan 07 (D-13 step 3).
 *
 * WHAT: tears down the SECOND install location, ~/.claude/plugins/mindrian-os,
 * so one install location remains: the marketplace cache reached through
 * CLAUDE_PLUGIN_ROOT. The retired install.sh created the second location
 * (INSTALL_DIR) and wrote a SessionStart hook keyed to the marker
 * "mindrian-os" that points at it.
 *
 * WHY: the navigator teardown named this root cause B, "two answers to where
 * the plugin lives". The directory is a recursive delete of user state, so the
 * order of operations below IS the security control (threat T-341-05):
 *
 *   1. SCAN   scanLegacyReferences reads ~/.claude/settings.json (read only,
 *             never written) and lists every statusLine, hook command, env
 *             value and marker that resolves through the legacy directory.
 *   2. REFUSE if anything still resolves through it, if settings.json is
 *             unreadable or malformed (unknown is not safe), if the directory
 *             is a symlink, a dev clone (isLegacyDevClone) or dirty or has
 *             unpushed commits (legacyDirtyOrUnpushed). Those two helpers live
 *             in lib/core/doctor/shared.cjs. One authority, imported here.
 *   3. BACKUP copy the directory to ~/.mindrian/legacy-install-backup-<ISO>/
 *             and VERIFY file count and total byte size equal the source.
 *             A backup that was not verified is not a backup.
 *   4. GUARD  guardRemovalPath checks the RESOLVED path before the delete:
 *             exact derived path, ends in .claude/plugins/mindrian-os, is not
 *             home, is not the filesystem root, no ".." segment, not a symlink.
 *   5. REMOVE fs.rmSync on the guarded path. Only then.
 *   6. LINKS  (quick 261029-lcg) top-level symlinks in ~/.claude/agents,
 *             ~/.claude/commands/mos and ~/.claude/skills whose readlink target
 *             lies inside the removed directory are repointed at the same file
 *             in the active marketplace cache install, or removed when the cache
 *             has no such file. The manifest
 *             ~/.mindrian/legacy-symlink-manifest-<ISO>.json is written BEFORE
 *             any link changes. A dry run only lists the planned changes.
 *
 * The dirty and unpushed check (legacyDirtyOrUnpushed) applies only when the
 * legacy directory owns a git root. A directory with no .git of its own inside
 * a HOME that is a git repo is not a clone and is never refused for the HOME
 * repo's state.
 *
 * Already clean (directory absent) is a normal, silent success. The directory
 * is absent on most Linux boxes and present on Windows installs that ran
 * install.sh, so both must work without noise.
 *
 * Default is DRY RUN. Nothing is removed unless --apply is given.
 *
 * USAGE:
 *   node scripts/migrate-legacy-install-location.cjs              # dry run
 *   node scripts/migrate-legacy-install-location.cjs --dry-run
 *   node scripts/migrate-legacy-install-location.cjs --apply
 *   node scripts/migrate-legacy-install-location.cjs --apply --quiet --json
 *
 * Test seam: MOS_LEGACY_INSTALL_HOME overrides the home directory. Every path
 * this script touches (the legacy directory, settings.json, ~/.mindrian/)
 * derives from that ONE root. There is no second home resolution.
 *
 * Canon Part 7 (Reuse Before Build): this is the sibling of
 * scripts/migrate-stale-user-settings.cjs (dry-run versus --apply, same
 * flags), wired into the doctor Class I fix the same way
 * statusline-visibility-module.cjs spawns that migrator. It is not a new
 * mechanism. Canon Part 8 (Graph Boundary): local filesystem only, zero
 * network, zero Brain. T-341-25: it never prints settings.json whole and it
 * redacts the value of any key matching KEY, TOKEN, SECRET or PASSWORD.
 *
 * House rule: hyphens only, no em-dashes, no emoji. CJS, process.argv switch.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const HOME_SEAM = 'MOS_LEGACY_INSTALL_HOME';
const MARKER = 'mindrian-os';
const SECRET_KEY_RE = /KEY|TOKEN|SECRET|PASSWORD/i;
const MAX_VALUE_CHARS = 300;
const GUARD_SUFFIX = ['.claude', 'plugins', 'mindrian-os'];

// ---------------------------------------------------------------------------
// The one home resolution. Everything else derives from this value.
// ---------------------------------------------------------------------------

function resolveHome(home) {
  if (typeof home === 'string' && home.length > 0) return path.resolve(home);
  const seam = process.env[HOME_SEAM];
  if (typeof seam === 'string' && seam.length > 0) return path.resolve(seam);
  return path.resolve(os.homedir());
}

function legacyDirOf(home) {
  return path.join(home, ...GUARD_SUFFIX);
}

function settingsPathOf(home) {
  return path.join(home, '.claude', 'settings.json');
}

// ---------------------------------------------------------------------------
// Scan (read only, never throws)
// ---------------------------------------------------------------------------

function norm(s) {
  return String(s).replace(/\\/g, '/');
}

// True when a string resolves through the legacy directory: the full resolved
// path, or the install.sh path forms (plugins/mindrian-os, then a separator or
// the end of the string, so plugins/mindrian-os-plugin does not match).
function pointsAtLegacyDir(value, legacyDir) {
  if (typeof value !== 'string' || value.length === 0) return false;
  const v = norm(value);
  if (v.includes(norm(legacyDir))) return true;
  return /plugins\/mindrian-os(?:[\/\s"'`;|&)]|$)/.test(v);
}

function clip(value) {
  const s = String(value);
  return s.length > MAX_VALUE_CHARS ? s.slice(0, MAX_VALUE_CHARS) + '...' : s;
}

// Collect every string under `node` with a dotted location string.
function walkStrings(node, where, out, depthLeft) {
  if (depthLeft < 0) return;
  if (typeof node === 'string') {
    out.push({ where, key: where.split('.').pop().replace(/\[\d+\]$/, ''), value: node });
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((item, i) => walkStrings(item, where + '[' + i + ']', out, depthLeft - 1));
    return;
  }
  if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) {
      walkStrings(node[k], where ? where + '.' + k : k, out, depthLeft - 1);
    }
  }
}

function scanLegacyReferences(home) {
  const root = resolveHome(home);
  const legacyDir = legacyDirOf(root);
  const settingsPath = settingsPathOf(root);
  const result = {
    legacyDir,
    exists: false,
    references: [],
    settingsPath,
    settingsError: null,
  };
  try {
    const st = fs.lstatSync(legacyDir);
    result.exists = st.isDirectory() || st.isSymbolicLink();
    result.isSymlink = st.isSymbolicLink();
  } catch (_) { /* absent */ }

  let raw = null;
  try {
    raw = fs.readFileSync(settingsPath, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return result; // absent: zero references
    result.settingsError = 'settings.json unreadable: ' + (err && err.code ? err.code : 'error');
    return result;
  }
  let settings;
  try {
    settings = JSON.parse(raw);
  } catch (_) {
    result.settingsError = 'settings.json is not valid JSON';
    return result;
  }
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    result.settingsError = 'settings.json is not a JSON object';
    return result;
  }

  const refs = [];
  const add = (where, key, value) => {
    const shown = SECRET_KEY_RE.test(key || '') ? '[redacted:' + key + ']' : clip(value);
    refs.push({ where, value: shown });
  };

  // statusLine: any command string nested under it.
  if (settings.statusLine !== undefined) {
    const found = [];
    walkStrings(settings.statusLine, 'statusLine', found, 8);
    for (const s of found) {
      if (pointsAtLegacyDir(s.value, legacyDir)) {
        add(s.where, s.key, s.value);
      }
    }
  }

  // hooks: every string under every event. The bare marker counts here
  // because install.sh detects its own SessionStart hook by that marker.
  if (settings.hooks !== undefined) {
    const found = [];
    walkStrings(settings.hooks, 'hooks', found, 10);
    for (const s of found) {
      if (pointsAtLegacyDir(s.value, legacyDir) || s.value.includes(MARKER)) {
        add(s.where, s.key, s.value);
      }
    }
  }

  // env and every other top-level object (or string) value.
  for (const k of Object.keys(settings)) {
    if (k === 'statusLine' || k === 'hooks') continue;
    const v = settings[k];
    if (typeof v === 'string') {
      if (pointsAtLegacyDir(v, legacyDir)) add(k, k, v);
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const ik of Object.keys(v)) {
        if (typeof v[ik] === 'string' && pointsAtLegacyDir(v[ik], legacyDir)) {
          add(k + '.' + ik, ik, v[ik]);
        }
      }
    }
  }

  result.references = refs;
  return result;
}

// ---------------------------------------------------------------------------
// Delete guard (T-341-05, T-341-22)
// ---------------------------------------------------------------------------

function realOrNull(p) {
  try { return fs.realpathSync(p); } catch (_) { return null; }
}

// Returns { ok, reason }. ok:true only when `target` is exactly the legacy
// directory derived from `home`, and nothing about it looks redirected.
function guardRemovalPath(target, home) {
  if (typeof target !== 'string' || target.length === 0) {
    return { ok: false, reason: 'target path is empty' };
  }
  const root = resolveHome(home);
  if (norm(target).split('/').includes('..')) {
    return { ok: false, reason: 'target path contains a ".." segment' };
  }
  const resolved = path.resolve(target);
  if (norm(resolved).split('/').includes('..')) {
    return { ok: false, reason: 'resolved path contains a ".." segment' };
  }
  if (resolved === path.parse(resolved).root) {
    return { ok: false, reason: 'target is the filesystem root' };
  }
  if (resolved === root) {
    return { ok: false, reason: 'target is the home directory itself' };
  }
  const segs = norm(resolved).split('/').filter(Boolean);
  const tail = segs.slice(-GUARD_SUFFIX.length);
  if (tail.length !== GUARD_SUFFIX.length || tail.some((s, i) => s !== GUARD_SUFFIX[i])) {
    return { ok: false, reason: 'target does not end in .claude/plugins/mindrian-os' };
  }
  if (resolved !== legacyDirOf(root)) {
    return { ok: false, reason: 'target is not the legacy directory derived from the single home root' };
  }
  let st;
  try { st = fs.lstatSync(resolved); } catch (_) {
    return { ok: false, reason: 'target does not exist' };
  }
  if (st.isSymbolicLink()) {
    return { ok: false, reason: 'target is a symlink; refusing to follow it' };
  }
  if (!st.isDirectory()) {
    return { ok: false, reason: 'target is not a directory' };
  }
  // Parent-chain symlink check: the real path of the target must equal the
  // real path of home plus the fixed suffix.
  const realTarget = realOrNull(resolved);
  const realRoot = realOrNull(root);
  if (!realTarget || !realRoot || realTarget !== path.join(realRoot, ...GUARD_SUFFIX)) {
    return { ok: false, reason: 'real path of target differs from home plus .claude/plugins/mindrian-os' };
  }
  return { ok: true, reason: null };
}

// ---------------------------------------------------------------------------
// Backup with verification
// ---------------------------------------------------------------------------

function measureTree(dir) {
  let count = 0;
  let bytes = 0;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try { entries = fs.readdirSync(cur, { withFileTypes: true }); } catch (_) { continue; }
    for (const e of entries) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) {
        stack.push(full);
      } else {
        count += 1;
        if (e.isFile()) {
          try { bytes += fs.statSync(full).size; } catch (_) { /* counted, size 0 */ }
        }
      }
    }
  }
  return { count, bytes };
}

function timestamp() {
  // Filename-safe on Windows: no colon, no dot.
  return new Date().toISOString().replace(/[:.]/g, '').replace(/T/, '-');
}

function backupLegacyDir(legacyDir, root) {
  const backupPath = path.join(root, '.mindrian', 'legacy-install-backup-' + timestamp());
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.cpSync(legacyDir, backupPath, { recursive: true, verbatimSymlinks: true, errorOnExist: true });
  const src = measureTree(legacyDir);
  const dst = measureTree(backupPath);
  const verified = src.count === dst.count && src.bytes === dst.bytes;
  return { backupPath, verified, src, dst };
}

// ---------------------------------------------------------------------------
// Symlink repoint (quick 261029-lcg)
//
// The retired install.sh linked agents, commands and skills from ~/.claude
// into the legacy directory. After the directory is removed those links dangle.
// This step finds the top-level symlinks whose readlink target lies inside the
// legacy directory and either repoints them at the same relative file in the
// active marketplace cache install, or removes them when the cache has no such
// file. Matching is on the readlink string (no realpath), so a link into a
// sibling directory that only shares a name prefix is never touched.
// ---------------------------------------------------------------------------

const SYMLINK_DIRS = [
  ['.claude', 'agents'],
  ['.claude', 'commands', 'mos'],
  ['.claude', 'skills'],
];

function insideDir(target, dir) {
  const rel = path.relative(dir, target);
  return rel.length > 0 && !rel.startsWith('..') && !path.isAbsolute(rel);
}

// Pure scan. Returns planned entries { link, originalTarget, action, newTarget }.
function planLegacySymlinks(root, legacyDir, cacheRoot) {
  const planned = [];
  const legacyAbs = path.resolve(legacyDir);
  for (const segs of SYMLINK_DIRS) {
    const dir = path.join(root, ...segs);
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { continue; }
    for (const e of entries) {
      if (!e.isSymbolicLink()) continue;
      const link = path.join(dir, e.name);
      let raw;
      try { raw = fs.readlinkSync(link); } catch (_) { continue; }
      const target = path.resolve(dir, raw);
      if (!insideDir(target, legacyAbs)) continue;
      const rel = path.relative(legacyAbs, target);
      let action = 'remove';
      let newTarget = null;
      if (cacheRoot) {
        const candidate = path.join(cacheRoot, rel);
        if (fs.existsSync(candidate)) { action = 'repoint'; newTarget = candidate; }
      }
      planned.push({ link, originalTarget: raw, action, newTarget });
    }
  }
  return planned;
}

// apply=false: report only, touch nothing. apply=true: write the manifest
// FIRST, then change each link. Never throws; per-link failures go in errors.
function repointLegacySymlinks(root, legacyDir, cacheRoot, apply) {
  const out = { planned: [], manifestPath: null, changed: 0, errors: [] };
  out.planned = planLegacySymlinks(root, legacyDir, cacheRoot);
  if (apply !== true || out.planned.length === 0) return out;

  const manifestPath = path.join(root, '.mindrian', 'legacy-symlink-manifest-' + timestamp() + '.json');
  try {
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, JSON.stringify({
      created: new Date().toISOString(),
      legacyDir: path.resolve(legacyDir),
      cacheRoot: cacheRoot || null,
      entries: out.planned,
    }, null, 2) + '\n', { flag: 'wx' });
  } catch (err) {
    out.errors.push('manifest write failed, no symlink changed: ' + (err && err.message ? err.message : 'error'));
    return out;
  }
  out.manifestPath = manifestPath;

  for (const p of out.planned) {
    try {
      if (p.action === 'remove') {
        fs.unlinkSync(p.link);
      } else {
        const tmpLink = p.link + '.mos-lcg-tmp';
        try { fs.unlinkSync(tmpLink); } catch (_) { /* none */ }
        let type = 'file';
        try { if (fs.statSync(p.newTarget).isDirectory()) type = 'dir'; } catch (_) { /* keep file */ }
        fs.symlinkSync(p.newTarget, tmpLink, type);
        fs.renameSync(tmpLink, p.link);
      }
      out.changed += 1;
    } catch (err) {
      out.errors.push(p.link + ': ' + (err && err.message ? err.message : 'error'));
    }
  }
  return out;
}

function cacheRootOf(shared, root) {
  try {
    const mc = shared && typeof shared.detectMarketplaceCacheInstall === 'function'
      ? shared.detectMarketplaceCacheInstall(root) : null;
    return mc && mc.root ? mc.root : null;
  } catch (_) { return null; }
}

// ---------------------------------------------------------------------------
// migrate
// ---------------------------------------------------------------------------

function result(ok, action, extra) {
  return Object.assign({ ok, action, backupPath: null, references: [], detail: '' }, extra || {});
}

function migrate(opts) {
  const o = opts || {};
  const apply = o.apply === true;
  const root = resolveHome(o.home);

  // a. SCAN
  const scan = scanLegacyReferences(root);
  if (!scan.exists) {
    return result(true, 'already-clean', {
      detail: 'legacy install location absent: ' + scan.legacyDir,
    });
  }

  // b. REFUSE on live references or unknown settings state
  if (scan.settingsError) {
    return result(false, 'refused', {
      references: scan.references,
      detail: scan.settingsError + ' at ' + scan.settingsPath
        + '. Unknown is not safe. Repair or remove that file, then run again.',
    });
  }
  if (scan.references.length > 0) {
    return result(false, 'refused', {
      references: scan.references,
      detail: scan.references.length + ' setting(s) still resolve through ' + scan.legacyDir
        + '. Clear those settings first (for example run node scripts/migrate-stale-user-settings.cjs --apply, or edit '
        + scan.settingsPath + '), then run again.',
    });
  }
  if (scan.isSymlink) {
    return result(false, 'refused', {
      detail: scan.legacyDir + ' is a symlink; refusing to follow it',
    });
  }

  // c. Existing Class I safety belts (one authority, in doctor shared.cjs)
  let shared = null;
  try { shared = require('../lib/core/doctor/shared.cjs'); } catch (_) { shared = null; }
  if (!shared || typeof shared.isLegacyDevClone !== 'function' || typeof shared.legacyDirtyOrUnpushed !== 'function') {
    return result(false, 'refused', {
      detail: 'safety helpers (isLegacyDevClone, legacyDirtyOrUnpushed) could not be loaded; refusing',
    });
  }
  if (shared.isLegacyDevClone(scan.legacyDir)) {
    return result(false, 'refused', {
      detail: 'origin remote points at mindrian-os-plugin OR MINDRIAN_OS_ROOT is set; treating as a dev clone, NOT removing',
    });
  }
  const dirty = shared.legacyDirtyOrUnpushed(scan.legacyDir);
  if (dirty && dirty.dirty) {
    return result(false, 'refused', { detail: dirty.reason });
  }

  const preGuard = guardRemovalPath(scan.legacyDir, root);
  if (!preGuard.ok) {
    return result(false, 'refused', { detail: 'path guard: ' + preGuard.reason });
  }

  const cacheRoot = cacheRootOf(shared, root);

  if (!apply) {
    const plan = repointLegacySymlinks(root, scan.legacyDir, cacheRoot, false);
    return result(true, 'dry-run', {
      symlinks: plan,
      detail: 'would back up ' + scan.legacyDir + ' to ' + path.join(root, '.mindrian', 'legacy-install-backup-<ISO>')
        + ' and then remove it'
        + (plan.planned.length > 0
          ? ', then repoint or remove ' + plan.planned.length + ' symlink(s) that still point into it'
          : '')
        + '. Nothing was changed. Run with --apply to do it.',
    });
  }

  // d. BACKUP and verify
  let backup;
  try {
    backup = backupLegacyDir(scan.legacyDir, root);
  } catch (err) {
    return result(false, 'refused', { detail: 'backup failed: ' + (err && err.message ? err.message : 'error') + '; nothing was removed' });
  }
  if (!backup.verified) {
    return result(false, 'refused', {
      backupPath: backup.backupPath,
      detail: 'backup verification failed (source ' + backup.src.count + ' files / ' + backup.src.bytes
        + ' bytes, backup ' + backup.dst.count + ' files / ' + backup.dst.bytes + ' bytes); nothing was removed',
    });
  }

  // e. GUARD again on the resolved path, then REMOVE
  const guard = guardRemovalPath(scan.legacyDir, root);
  if (!guard.ok) {
    return result(false, 'refused', { backupPath: backup.backupPath, detail: 'path guard: ' + guard.reason });
  }
  try {
    fs.rmSync(scan.legacyDir, { recursive: true, force: true });
  } catch (err) {
    return result(false, 'refused', {
      backupPath: backup.backupPath,
      detail: 'remove failed: ' + (err && err.message ? err.message : 'error') + '; backup kept at ' + backup.backupPath,
    });
  }

  // f. symlinks that pointed into the removed directory: manifest first, then
  // repoint or remove. A failure here never undoes the removal (the backup and
  // the manifest hold the way back); it is reported in the detail.
  const symlinks = repointLegacySymlinks(root, scan.legacyDir, cacheRoot, true);
  let linkNote = '';
  if (symlinks.planned.length > 0) {
    linkNote = '; symlinks: ' + symlinks.changed + ' of ' + symlinks.planned.length + ' repointed or removed'
      + (symlinks.manifestPath ? ', manifest at ' + symlinks.manifestPath : '')
      + (symlinks.errors.length > 0 ? ', ' + symlinks.errors.length + ' error(s): ' + symlinks.errors.join(' | ') : '');
  }

  // g. report
  return result(true, 'removed', {
    backupPath: backup.backupPath,
    symlinks,
    detail: 'removed ' + scan.legacyDir + '; verified backup (' + backup.src.count + ' files, ' + backup.src.bytes
      + ' bytes) at ' + backup.backupPath + linkNote,
  });
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const USAGE = 'usage: node scripts/migrate-legacy-install-location.cjs [--dry-run | --apply] [--quiet] [--json]';

function main() {
  const argv = process.argv.slice(2);
  const known = new Set(['--dry-run', '--apply', '--quiet', '--json']);
  for (const a of argv) {
    if (!known.has(a)) {
      process.stderr.write(USAGE + '\n');
      process.exit(2);
    }
  }
  // Dry run is the default, and it wins over --apply if both are given.
  const apply = argv.includes('--apply') && !argv.includes('--dry-run');
  const quiet = argv.includes('--quiet');
  const json = argv.includes('--json');

  let res;
  try {
    res = migrate({ apply });
  } catch (err) {
    res = result(false, 'refused', { detail: 'unexpected error: ' + (err && err.message ? err.message : 'error') });
  }

  if (json) {
    process.stdout.write(JSON.stringify(res) + '\n');
  } else if (res.action === 'already-clean') {
    process.stdout.write('migrate-legacy-install-location: already-clean\n');
  } else {
    process.stdout.write('migrate-legacy-install-location: ' + res.action + ' - ' + res.detail + '\n');
    if (!quiet) {
      for (const r of res.references) {
        process.stdout.write('  reference: ' + r.where + ' = ' + r.value + '\n');
      }
      if (res.symlinks) {
        for (const s of res.symlinks.planned) {
          process.stdout.write('  symlink ' + s.action + ': ' + s.link + (s.newTarget ? ' -> ' + s.newTarget : '') + '\n');
        }
      }
    }
  }
  process.exit(res.ok ? 0 : 1);
}

if (require.main === module) main();

module.exports = { scanLegacyReferences, migrate, guardRemovalPath, repointLegacySymlinks };
