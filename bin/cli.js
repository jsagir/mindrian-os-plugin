#!/usr/bin/env node
'use strict';
/*
 * MindrianOS installer + diagnostics CLI.
 *
 * npm package:        @mindrian_os/install   ->   `npx @mindrian_os/install` installs MindrianOS
 * installed command:  mindrian-os <install|doctor|update> [args]   (no subcommand = install)
 *
 * The package name is the verb: running it with no subcommand (or with only
 * flags, e.g. `npx @mindrian_os/install --version 1.13.0-beta.9`) does the
 * install. `doctor` and `update` are still explicit subcommands.
 *
 *   install   Install (or bring current) MindrianOS by driving Claude Code's
 *             own plugin CLI: registers the Mindrian marketplace, refreshes the
 *             catalog, then `claude plugin install` + `claude plugin update` on
 *             mos@mindrian-marketplace. Requires the `claude` CLI on PATH (prints
 *             how to get it if missing). Flags pass through to `claude plugin
 *             install` (e.g. `--version 1.13.0-beta.9`); when a version is pinned
 *             the update step is skipped. The Brain key stays a printed hint --
 *             writing it to the environment is the one side effect left to you.
 *   doctor    Run /mos:doctor's diagnostic from OUTSIDE Claude Code so you catch
 *             install/drift problems before a session. Resolves the installed
 *             plugin (marketplace cache, dev clone, or MINDRIAN_OS_ROOT), then
 *             `node <pluginRoot>/scripts/doctor.cjs <args...>`. If the plugin is
 *             not installed, says so plainly instead of throwing a node stack.
 *   update    Bring MindrianOS current. For a marketplace install: `claude plugin
 *             marketplace update` + `claude plugin update mos@mindrian-marketplace`.
 *             For a dev clone (MINDRIAN_OS_ROOT set): `git -C <root> pull --ff-only`
 *             + `bash <root>/install.sh`.
 *
 * GSD pattern: pure CJS, node built-ins only, zero npm deps. No CLI framework
 * (no commander/yargs/meow). process.argv switch-case routing, mirroring
 * bin/mindrian-tools.cjs and ~/.claude/get-shit-done/bin/gsd-tools.cjs.
 *
 * Plugin-root resolution order:
 *   1. MINDRIAN_OS_ROOT env var (tests, dev boxes, hand clones)
 *   2. marketplace install: ~/.claude/plugins/cache/<marketplace>/mos/<version>/
 *      (Claude Code's actual layout for a `claude plugin install mos@...`)
 *   3. legacy hand-clone: ~/.claude/plugins/mindrian-os/
 *   4. null -- not installed
 */

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');

const MARKETPLACE = 'jsagir/mindrian-marketplace';
const PLUGIN_SPEC = 'mos@mindrian-marketplace';

function run(cmd, args, opts) {
  return spawnSync(cmd, args, { stdio: 'inherit', ...opts });
}

function ok(result) {
  return result && typeof result.status === 'number' && result.status === 0;
}

function exitFrom(result) {
  // spawnSync sets status=null when the process was killed by a signal or
  // failed to launch; treat that as a generic failure.
  process.exit(result && typeof result.status === 'number' ? result.status : 1);
}

function hasDoctor(dir) {
  try {
    return !!dir && fs.existsSync(path.join(dir, 'scripts', 'doctor.cjs'));
  } catch {
    return false;
  }
}

// Resolve where the installed MindrianOS plugin lives, or null if not found.
function resolvePluginRoot() {
  if (process.env.MINDRIAN_OS_ROOT) return process.env.MINDRIAN_OS_ROOT;
  const home = os.homedir();

  // Marketplace install (current Claude Code): the plugin is named `mos` and
  // lives at ~/.claude/plugins/cache/<marketplace>/mos/<version>/.
  const cacheBase = path.join(home, '.claude', 'plugins', 'cache');
  const found = [];
  try {
    for (const mk of fs.readdirSync(cacheBase, { withFileTypes: true })) {
      if (!mk.isDirectory()) continue;
      const mosDir = path.join(cacheBase, mk.name, 'mos');
      let versions;
      try {
        versions = fs.readdirSync(mosDir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const v of versions) {
        if (!v.isDirectory()) continue;
        const candidate = path.join(mosDir, v.name);
        if (hasDoctor(candidate)) found.push({ dir: candidate, ver: v.name });
      }
    }
  } catch {
    /* no cache dir -- fall through to legacy */
  }
  if (found.length) {
    found.sort((a, b) => String(a.ver).localeCompare(String(b.ver), undefined, { numeric: true }));
    return found[found.length - 1].dir;
  }

  // Legacy hand-clone layout.
  const legacy = path.join(home, '.claude', 'plugins', 'mindrian-os');
  if (hasDoctor(legacy)) return legacy;

  return null;
}

function printUsage() {
  console.log('mindrian-os <install|doctor|update>   (no subcommand = install)');
  console.log('  install   install / bring current via Claude Code (marketplace add + plugin install/update)');
  console.log('  doctor    run the MindrianOS install/drift diagnostic (passes flags through to /mos:doctor)');
  console.log('  update    bring MindrianOS current (marketplace update + plugin update; or git pull for a dev clone)');
}

function requireClaudeCli() {
  const check = spawnSync('claude', ['--version'], { stdio: 'ignore' });
  if (ok(check)) return true;
  console.error('Claude Code is not installed (no `claude` command on your PATH).');
  console.error('Install it first:');
  console.error('  npm install -g @anthropic-ai/claude-code');
  console.error('Then re-run:');
  console.error('  npx @mindrian_os/install');
  return false;
}

// No subcommand, or flags only (e.g. `npx @mindrian_os/install --version 1.13.0-beta.9`),
// means "install" -- the package name is the verb. Pass any leading flags through.
let sub = process.argv[2];
let argOffset = 3;
if (!sub || sub.startsWith('-')) {
  sub = 'install';
  argOffset = 2;
}

switch (sub) {
  case 'doctor': {
    const root = resolvePluginRoot();
    if (!root || !hasDoctor(root)) {
      console.error('MindrianOS does not appear to be installed (could not find scripts/doctor.cjs).');
      console.error('Looked under: ' + path.join(os.homedir(), '.claude', 'plugins') + (process.env.MINDRIAN_OS_ROOT ? ' and $MINDRIAN_OS_ROOT' : ''));
      console.error('Install it first:');
      console.error('  npx @mindrian_os/install');
      process.exit(1);
    }
    const r = run(process.execPath, [path.join(root, 'scripts', 'doctor.cjs'), ...process.argv.slice(argOffset)]);
    exitFrom(r);
    break;
  }

  case 'update': {
    // Dev clone (MINDRIAN_OS_ROOT or a legacy hand-clone): git pull + re-run install.sh.
    const root = resolvePluginRoot();
    const isDevClone = !!process.env.MINDRIAN_OS_ROOT
      || (root && fs.existsSync(path.join(root, '.git')) && fs.existsSync(path.join(root, 'install.sh')));
    if (isDevClone && root) {
      run('git', ['-C', root, 'pull', '--ff-only']);
      const r = run('bash', [path.join(root, 'install.sh')]);
      exitFrom(r);
      break;
    }
    // Marketplace install: use Claude Code's own update path.
    if (!requireClaudeCli()) process.exit(1);
    console.log('Refreshing the marketplace catalog...');
    run('claude', ['plugin', 'marketplace', 'update']);
    console.log('Updating the MindrianOS plugin...');
    const r = run('claude', ['plugin', 'update', PLUGIN_SPEC]);
    if (!ok(r)) {
      console.error('');
      console.error('`claude plugin update ' + PLUGIN_SPEC + '` did not complete.');
      console.error('Try inside Claude Code:  /plugin marketplace update   then   /plugin update ' + PLUGIN_SPEC);
      exitFrom(r);
    }
    console.log('');
    console.log('MindrianOS is up to date. Run `claude plugin list` to confirm the version.');
    console.log('Verify:  mindrian-os doctor   (or /mos:doctor inside Claude Code)');
    process.exit(0);
    break;
  }

  case 'install': {
    // Flags after `install` (or leading flags when `install` is implied) pass
    // through to `claude plugin install` (e.g. `... --version 1.13.0-beta.9`).
    const passthrough = process.argv.slice(argOffset);
    const pinned = passthrough.some((a) => a === '--version' || a.startsWith('--version='));

    if (!requireClaudeCli()) process.exit(1);

    // Register the Mindrian marketplace (idempotent) and refresh its catalog so
    // we resolve the current ref. Both are best-effort -- "already added" /
    // "already up to date" exit non-zero on some Claude Code versions; fine.
    console.log('Adding the Mindrian marketplace...');
    run('claude', ['plugin', 'marketplace', 'add', MARKETPLACE]);
    console.log('Refreshing the marketplace catalog...');
    run('claude', ['plugin', 'marketplace', 'update']);

    // Install. On an already-installed plugin Claude Code reports "already
    // installed" and still exits 0 -- the update step below then moves it
    // forward to the current ref (unless the caller pinned a version).
    console.log('Installing the MindrianOS plugin...');
    const inst = run('claude', ['plugin', 'install', PLUGIN_SPEC, ...passthrough]);
    let updated = false;
    if (!pinned) {
      console.log('Bringing the plugin to the current build...');
      const upd = run('claude', ['plugin', 'update', PLUGIN_SPEC]);
      updated = ok(upd);
    }

    if (!ok(inst) && !updated) {
      console.error('');
      console.error('Installing ' + PLUGIN_SPEC + ' did not complete.');
      console.error('Finish it by hand inside Claude Code:');
      console.error('  /plugin marketplace add ' + MARKETPLACE);
      console.error('  /plugin install ' + PLUGIN_SPEC);
      exitFrom(inst);
    }

    console.log('');
    console.log('MindrianOS is installed and current. Run `claude plugin list` to see the version.');
    console.log('');
    console.log('Optional -- connect the Brain for enriched intelligence:');
    console.log('  inside Claude Code:  /mos:setup   (choose "Configure Brain", paste your key)');
    console.log('  or set it directly:  export MINDRIAN_BRAIN_KEY="<your-key>"   (or add it to ~/.claude/.env)');
    console.log('');
    console.log('Verify:  mindrian-os doctor   (or /mos:doctor inside Claude Code)');
    console.log('Start:   open a fresh Claude Code session, then  /mos:onboard');
    process.exit(0);
    break;
  }

  default:
    printUsage();
    process.exit(sub ? 1 : 0);
}
