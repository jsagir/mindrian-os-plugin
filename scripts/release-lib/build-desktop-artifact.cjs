#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * MindrianOS Plugin - Desktop payload builder (Phase 369.1, plan 05; D-10, D-11, D-13, D-14).
 *
 * WHAT IT BUILDS
 *   The Desktop copy of the plugin (marketplace entry `mos-desktop`, relative path
 *   ./plugins/mos-desktop): the npm payload minus the top-level bin/ directory.
 *
 * WHY
 *   Claude Desktop's plugin sync (claude.ai) refuses a plugin that carries a top-level
 *   bin/ directory. The CLI payload is the source of truth, so the Desktop copy is
 *   exactly `npm pack` of the source dir, extracted, with bin/ removed: Desktop never
 *   runs code the CLI does not run, and nothing outside the npm `files` allowlist (no
 *   .planning/, tests/, ui/ or Brain code) can enter it (RULE 9, D-08). The five runtime
 *   executables live at scripts/ since plan 369.1-04; bin/ holds forwarding shims only.
 *
 * LIMITS
 *   claude.ai accepts at most 5,000 files, 200 MB uncompressed and a 50:1 compression
 *   ratio per file per plugin. This builder gates at 4,500 files and 180,000,000 bytes
 *   so there is headroom (Pitfall 10), and at 50:1 per file.
 *
 * USAGE
 *   node build-desktop-artifact.cjs build --out <dir> [--source <dir>] [--version <v>] [--json]
 *   node build-desktop-artifact.cjs --check [--source <dir>]
 *   node build-desktop-artifact.cjs --help
 *   Exit: 0 clean, 1 on any violation (one `x <code>: <detail>` line each), 2 on bad usage.
 *
 * Dev-only: scripts/release-lib/ is excluded from the npm pack (`!scripts/release-lib`),
 * so this file ships in neither the npm payload nor the Desktop copy. Called by
 * release.sh Step 6.8 and the Step 2.4 gate (plan 369.1-14).
 *
 * npm pack always runs with --ignore-scripts and a --pack-destination under os.tmpdir().
 * Built-ins only, plus the repo's portable npm resolver. No network, no Brain call.
 * HARD RULE: hyphens only; no long dashes in this file.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { spawnSync } = require('node:child_process');

const { resolveNpmCli } = require('../../lib/core/npm-cli-resolve.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const LIMITS = Object.freeze({
  maxFiles: 4500,
  maxBytes: 180000000,
  maxRatio: 50,
  claudeAiMaxFiles: 5000,
  claudeAiMaxBytes: 200000000,
});

// Same six patterns as tests/test-369.1-bin-relocation.cjs (the artifact test checks for drift).
const RUNTIME_BIN_PATTERNS = [
  // (1) node bin/<name>
  /node\s+["']?bin\/(mindrian-[a-z-]+|local-chain-recommender)\.cjs/,
  // (2) a root anchor followed by /bin/<name>
  /(\$\{CLAUDE_PLUGIN_ROOT\}|\{plugin_root\}|\$\{?PLUGIN_ROOT\}?|\$\{MINDRIAN_OS_ROOT[^}]*\}\}?)\/bin\/(mindrian-[a-z-]+|local-chain-recommender)\.cjs/,
  // (3) path pieces 'bin', '<name>'
  /['"]bin['"]\s*,\s*['"](mindrian-[a-z-]+|local-chain-recommender)\.cjs['"]/,
  // (4) a relative require climbing into bin/
  /['"](\.\.\/)+bin\/(mindrian-|local-chain)/,
  // (5) path.join / path.resolve with a bin/<name> piece
  /path\.(join|resolve)\([^)]*['"]bin\/(mindrian-|local-chain)/,
  // (6) JSON string value "bin/<name>"
  /"bin\/(mindrian-[a-z-]+|local-chain-recommender)\.cjs"/,
];

// Historical records, not invocations (the bin-relocation gate's allow-list).
const RUNTIME_REF_ALLOW = new Set([
  'CHANGELOG.md',
  'lib/import/PRECONDITIONS.md',
  'data/capability-ledger.json',
]);

const MAX_SCAN_BYTES = 4 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Tree helpers (lstat only; links are never followed)
// ---------------------------------------------------------------------------

// Every non-directory entry under dir as { rel, abs, st } (symlinks included).
function walkEntries(dir) {
  const out = [];
  (function rec(d, rel) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const r = rel ? rel + '/' + e.name : e.name;
      const abs = path.join(d, e.name);
      if (e.isDirectory() && !e.isSymbolicLink()) rec(abs, r);
      else out.push({ rel: r, abs, st: fs.lstatSync(abs) });
    }
  })(dir, '');
  return out.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
}

function isProbablyBinary(buf) {
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i += 1) if (buf[i] === 0) return true;
  return false;
}

function commentKind(rel) {
  const base = path.basename(rel);
  const ext = path.extname(base);
  if (['.cjs', '.js', '.mjs', '.ts', '.tsx'].includes(ext)) return 'js';
  if (ext === '.sh' || ext === '.bash' || ext === '') return 'sh';
  return 'none';
}

function deflateRatio(buf) {
  if (buf.length === 0) return 0;
  return buf.length / Math.max(zlib.deflateRawSync(buf).length, 1);
}

// Files, bytes and the worst deflate ratio of a tree.
function measureTree(dir) {
  let files = 0;
  let bytes = 0;
  let maxRatio = 0;
  let maxRatioFile = '';
  for (const e of walkEntries(dir)) {
    files += 1;
    if (e.st.isSymbolicLink()) continue;
    bytes += e.st.size;
    if (e.st.size === 0) continue;
    const ratio = deflateRatio(fs.readFileSync(e.abs));
    if (ratio > maxRatio) { maxRatio = ratio; maxRatioFile = e.rel; }
  }
  return { files, bytes, maxRatio, maxRatioFile };
}

// ---------------------------------------------------------------------------
// checkPayload: every violation, never throws on a bad payload
// ---------------------------------------------------------------------------
function checkPayload(dir, options) {
  const opts = options || {};
  const limits = opts.limits || LIMITS;
  const violations = [];
  const add = (code, detail) => violations.push({ code, detail });

  if (fs.existsSync(path.join(dir, 'bin'))) {
    add('top-level-bin', 'a top-level bin entry exists; claude.ai refuses a plugin with bin/');
  }

  const entries = walkEntries(dir);

  if (entries.length > limits.maxFiles) {
    add('too-many-files', entries.length + ' files exceeds ' + limits.maxFiles + ' (claude.ai limit ' + limits.claudeAiMaxFiles + ')');
  }

  let bytes = 0;
  const regs = RUNTIME_BIN_PATTERNS;
  for (const e of entries) {
    if (e.st.isSymbolicLink()) {
      add('symlink', e.rel + ' is a symlink -> ' + fs.readlinkSync(e.abs));
      continue;
    }
    bytes += e.st.size;
    if (e.st.size === 0) continue;
    const buf = fs.readFileSync(e.abs);
    const ratio = deflateRatio(buf);
    if (ratio > limits.maxRatio) {
      add('ratio', e.rel + ' has deflate ratio ' + ratio.toFixed(1) + ' over ' + limits.maxRatio);
    }
    // Runtime bin/ invocations: skip tests, the allow-list, huge and binary files.
    if (/\.test\.cjs$/.test(e.rel) || RUNTIME_REF_ALLOW.has(e.rel)) continue;
    if (buf.length > MAX_SCAN_BYTES || isProbablyBinary(buf)) continue;
    const kind = commentKind(e.rel);
    const lines = buf.toString('utf8').split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const t = lines[i].trim();
      if (kind === 'js' && (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'))) continue;
      if (kind === 'sh' && t.startsWith('#')) continue;
      if (regs.some((r) => r.test(lines[i]))) {
        add('runtime-bin-ref', e.rel + ':' + (i + 1) + ': ' + t.slice(0, 140));
      }
    }
  }
  if (bytes > limits.maxBytes) {
    add('too-many-bytes', bytes + ' bytes exceeds ' + limits.maxBytes + ' (claude.ai limit ' + limits.claudeAiMaxBytes + ')');
  }

  const pj = path.join(dir, '.claude-plugin', 'plugin.json');
  if (!fs.existsSync(pj)) {
    add('missing-plugin-json', '.claude-plugin/plugin.json is missing');
  } else if (opts.version) {
    let got = null;
    try { got = JSON.parse(fs.readFileSync(pj, 'utf8')).version; } catch (_e) { got = null; }
    if (got !== opts.version) {
      add('version-mismatch', 'plugin.json version ' + JSON.stringify(got) + ' differs from ' + JSON.stringify(opts.version));
    }
  }

  return violations;
}

function violationError(violations) {
  const err = new Error(violations.map((v) => 'x ' + v.code + ': ' + v.detail).join('\n'));
  err.violations = violations;
  return err;
}

// ---------------------------------------------------------------------------
// buildDesktopPayload: npm pack -> extract -> drop bin/ -> check -> replace out
// ---------------------------------------------------------------------------
function npmPack(sourceDir, packDest) {
  const npm = resolveNpmCli();
  const args = npm.baseArgs.concat(['pack', '--json', '--ignore-scripts', '--pack-destination', packDest]);
  const r = spawnSync(npm.command, args, {
    cwd: sourceDir, encoding: 'utf8', shell: npm.shell, timeout: 900000, maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error || r.status !== 0) {
    throw new Error('npm pack failed (' + (r.error ? r.error.code : r.status) + '): ' + String(r.stderr || '').trim().split('\n').slice(-3).join(' | ').slice(0, 300));
  }
  let name = null;
  try {
    const parsed = JSON.parse(r.stdout);
    name = parsed && parsed[0] && parsed[0].filename;
  } catch (_e) { name = null; }
  if (!name) {
    const tgz = fs.readdirSync(packDest).filter((f) => f.endsWith('.tgz'));
    if (tgz.length !== 1) throw new Error('npm pack produced ' + tgz.length + ' tarballs');
    name = tgz[0];
  }
  return path.join(packDest, path.basename(name));
}

function modeOf(st) { return st.mode & 0o777; }

// ---------------------------------------------------------------------------
// The --out guard (369.1-REVIEW WR-10). The builder removes whatever --out names, wholesale, so the
// guard compares REAL paths (a symlinked spelling cannot hide an ancestor) and refuses every
// directory the release must never replace.
// ---------------------------------------------------------------------------
// realpath of the deepest existing ancestor of p, with the not-yet-existing tail appended.
function realpathLoose(p) {
  let cur = path.resolve(p);
  const rest = [];
  for (;;) {
    try {
      const real = typeof fs.realpathSync.native === 'function' ? fs.realpathSync.native(cur) : fs.realpathSync(cur);
      return rest.length ? path.join(real, ...rest.reverse()) : real;
    } catch (_e) {
      const parent = path.dirname(cur);
      if (parent === cur) return cur;
      rest.push(path.basename(cur));
      cur = parent;
    }
  }
}

// True when `a` is `b` or contains it. A first segment that merely STARTS with two dots (a directory
// named "..weird") is a child, not a parent hop.
function isSameOrAncestor(a, b) {
  const rel = path.relative(a, b);
  return rel === '' || (rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel));
}

/**
 * Throws 'refusing to replace <out>: <why>' when --out must never be removed: a filesystem root, the
 * source or an ancestor of it, the home directory or an ancestor of it, a directory that contains
 * .git, or the top of a git work tree (unpushed commits live there).
 */
function assertSafeOutDir(outDir, sourceDir) {
  const out = realpathLoose(outDir);
  const src = realpathLoose(sourceDir);
  const refuse = (why) => { throw new Error('refusing to replace ' + path.resolve(outDir) + ': it is ' + why); };
  if (out === path.parse(out).root) refuse('a filesystem root');
  if (isSameOrAncestor(out, src)) refuse('the source dir or an ancestor of it');
  let home = null;
  try { home = realpathLoose(os.homedir()); } catch (_e) { home = null; }
  if (home && isSameOrAncestor(out, home)) refuse('the home directory or an ancestor of it');
  if (fs.existsSync(path.join(out, '.git'))) refuse('a git repository (it contains .git)');
  try {
    if (fs.statSync(out).isDirectory()) {
      const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: out, encoding: 'utf8', timeout: 20000 });
      if (!r.error && r.status === 0 && realpathLoose(String(r.stdout).trim()) === out) refuse('the top of a git work tree');
    }
  } catch (e) {
    if (e && /^refusing to replace/.test(e.message)) throw e;
    /* the directory does not exist yet: nothing to protect */
  }
}

function buildDesktopPayload(args) {
  const sourceDir = path.resolve(args.sourceDir || REPO_ROOT);
  const outDir = path.resolve(args.outDir);
  const version = args.version
    || JSON.parse(fs.readFileSync(path.join(sourceDir, '.claude-plugin', 'plugin.json'), 'utf8')).version;

  // outDir is removed wholesale: refuse anything the release must never replace (WR-10).
  assertSafeOutDir(outDir, sourceDir);

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-desktop-'));
  try {
    const tgz = npmPack(sourceDir, work);
    const extractDir = path.join(work, 'x');
    fs.mkdirSync(extractDir, { recursive: true });
    const t = spawnSync('tar', ['-xzpf', tgz, '-C', extractDir], { encoding: 'utf8' });
    if (t.error || t.status !== 0) throw new Error('tar -xzf failed: ' + String(t.stderr || (t.error && t.error.message) || '').slice(0, 300));
    const root = path.join(extractDir, 'package');
    if (!fs.existsSync(root)) throw new Error('the tarball has no package/ root');

    fs.rmSync(path.join(root, 'bin'), { recursive: true, force: true });

    const violations = checkPayload(root, { version, limits: LIMITS });
    if (violations.length) throw violationError(violations);

    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(outDir), { recursive: true });
    fs.cpSync(root, outDir, { recursive: true, preserveTimestamps: false });

    // File modes must survive (hooks/run-hook.cmd and scripts/session-start stay executable).
    const bad = [];
    for (const e of walkEntries(root)) {
      const copy = path.join(outDir, e.rel);
      let st;
      try { st = fs.lstatSync(copy); } catch (_e) { bad.push({ code: 'mode-mismatch', detail: e.rel + ' missing from out' }); continue; }
      if (modeOf(st) !== modeOf(e.st)) {
        bad.push({ code: 'mode-mismatch', detail: e.rel + ' mode ' + modeOf(st).toString(8) + ' differs from packed ' + modeOf(e.st).toString(8) });
      }
    }
    if (bad.length) throw violationError(bad);

    const m = measureTree(outDir);
    return {
      files: m.files, bytes: m.bytes, maxRatio: m.maxRatio, maxRatioFile: m.maxRatioFile, version, outDir,
    };
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const USAGE = [
  'Usage:',
  '  build-desktop-artifact.cjs build --out <dir> [--source <dir>] [--version <v>] [--json]',
  '  build-desktop-artifact.cjs --check [--source <dir>]',
  '  build-desktop-artifact.cjs --help',
].join('\n');

function parseFlags(list) {
  const flags = { json: false };
  for (let i = 0; i < list.length; i += 1) {
    switch (list[i]) {
      case '--source': flags.source = list[i + 1]; i += 1; break;
      case '--out': flags.out = list[i + 1]; i += 1; break;
      case '--version': flags.version = list[i + 1]; i += 1; break;
      case '--json': flags.json = true; break;
      default: return { error: 'unknown argument: ' + list[i] };
    }
  }
  return flags;
}

function printFailure(err) {
  const text = err && err.message ? err.message : String(err);
  for (const line of text.split('\n')) console.error(line.startsWith('x ') ? line : 'x error: ' + line);
}

function main(argv) {
  const cmd = argv[0];
  switch (cmd) {
    case '--help':
    case '-h':
      console.log(USAGE);
      return 0;
    case 'build': {
      const flags = parseFlags(argv.slice(1));
      if (flags.error || !flags.out) {
        console.error((flags.error || '--out is required') + '\n' + USAGE);
        return 2;
      }
      try {
        const rep = buildDesktopPayload({ sourceDir: flags.source, outDir: flags.out, version: flags.version });
        if (flags.json) {
          console.log(JSON.stringify({
            files: rep.files, bytes: rep.bytes, maxRatio: rep.maxRatio, maxRatioFile: rep.maxRatioFile, version: rep.version,
          }));
        } else {
          console.log('files=' + rep.files + ' bytes=' + rep.bytes + ' maxRatio=' + rep.maxRatio.toFixed(1) + ' (' + rep.maxRatioFile + ') -> ' + rep.outDir);
        }
        return 0;
      } catch (err) {
        printFailure(err);
        return 1;
      }
    }
    case '--check': {
      const flags = parseFlags(argv.slice(1));
      if (flags.error) {
        console.error(flags.error + '\n' + USAGE);
        return 2;
      }
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-desktop-check-'));
      try {
        const rep = buildDesktopPayload({ sourceDir: flags.source, outDir: path.join(tmp, 'mos-desktop'), version: flags.version });
        console.log('files=' + rep.files + ' bytes=' + rep.bytes + ' maxRatio=' + rep.maxRatio.toFixed(1) + ' (' + rep.maxRatioFile + ')');
        console.log('headroom: ' + rep.files + '/' + LIMITS.claudeAiMaxFiles + ' files, ' + rep.bytes + '/' + LIMITS.claudeAiMaxBytes + ' bytes (gates ' + LIMITS.maxFiles + ' files, ' + LIMITS.maxBytes + ' bytes, ratio ' + LIMITS.maxRatio + ')');
        return 0;
      } catch (err) {
        printFailure(err);
        return 1;
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    }
    default:
      console.error((cmd ? 'unknown command: ' + cmd + '\n' : '') + USAGE);
      return 2;
  }
}

module.exports = { buildDesktopPayload, checkPayload, assertSafeOutDir, LIMITS, RUNTIME_BIN_PATTERNS };

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}
