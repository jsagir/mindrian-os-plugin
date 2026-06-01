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
 * Plugin-root resolution is delegated to lib/core/active-plugin-root.cjs (the
 * single source of truth: MINDRIAN_OS_ROOT -> installed_plugins.json -> newest
 * marketplace-cache mos/<version>/ -> legacy clone -> not-found). doctor and
 * update both read from it; scripts/statusline-mos shells out to its CLI form.
 */

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
// The ONE plugin-root resolver: installed_plugins.json (temporal truth) first,
// then the pre-release-tolerant marketplace-cache scan, then a legacy clone.
const { resolveActivePluginRoot } = require('../lib/core/active-plugin-root.cjs');

const MARKETPLACE = 'jsagir/mindrian-marketplace';
const PLUGIN_SPEC = 'mos@mindrian-marketplace';

// On Windows, npm-global CLIs are installed as `.cmd` shims (e.g. `claude.cmd`),
// not bare executables. Node's spawnSync does NOT consult PATHEXT, so spawning
// 'claude' directly fails with ENOENT even when `claude --version` works in the
// user's interactive shell. Routing through the shell (cmd.exe) on win32 lets
// PATHEXT resolve the `.cmd` shim. POSIX is unaffected -- shell stays false there.
//
// IMPORTANT: shell is scoped to `claude` spawns ONLY (via runClaude below), NOT
// applied to the generic run() helper. run() is also called as
// run(process.execPath, ...) in the doctor subcommand, and on Windows
// process.execPath is `C:\Program Files\nodejs\node.exe` (contains a space).
// With shell:true Node passes the command unquoted to cmd.exe, which would parse
// `C:\Program` as the command and break. node/git resolve fine WITHOUT shell.
const isWindows = process.platform === 'win32';

function run(cmd, args, opts) {
  return spawnSync(cmd, args, { stdio: 'inherit', ...opts });
}

// Spawn the `claude` CLI, shelling out on Windows so the `claude.cmd` shim
// resolves via PATHEXT. All `claude` invocations MUST go through this wrapper.
function runClaude(args, opts) {
  return run('claude', args, { shell: isWindows, ...opts });
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

function printUsage() {
  console.log('mindrian-os <install|doctor|update>   (no subcommand = install)');
  console.log('  install   install / bring current via Claude Code (marketplace add + plugin install/update)');
  console.log('  doctor    run the MindrianOS install/drift diagnostic (passes flags through to /mos:doctor)');
  console.log('  update    bring MindrianOS current (marketplace update + plugin update; or git pull for a dev clone)');
}

function requireClaudeCli() {
  const check = spawnSync('claude', ['--version'], { stdio: 'ignore', shell: isWindows });
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
    const { root } = resolveActivePluginRoot();
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
    const { root } = resolveActivePluginRoot();
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
    runClaude(['plugin', 'marketplace', 'update']);
    console.log('Updating the MindrianOS plugin...');
    const r = runClaude(['plugin', 'update', PLUGIN_SPEC]);
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
    runClaude(['plugin', 'marketplace', 'add', MARKETPLACE]);
    console.log('Refreshing the marketplace catalog...');
    runClaude(['plugin', 'marketplace', 'update']);

    // Install. On an already-installed plugin Claude Code reports "already
    // installed" and still exits 0 -- the update step below then moves it
    // forward to the current ref (unless the caller pinned a version).
    console.log('Installing the MindrianOS plugin...');
    const inst = runClaude(['plugin', 'install', PLUGIN_SPEC, ...passthrough]);
    let updated = false;
    if (!pinned) {
      console.log('Bringing the plugin to the current build...');
      const upd = runClaude(['plugin', 'update', PLUGIN_SPEC]);
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
