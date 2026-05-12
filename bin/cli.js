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
 *   install   Path B. Actually install MindrianOS by driving Claude Code's
 *             own plugin CLI: registers the Mindrian marketplace, then runs
 *             `claude plugin install mos@mindrian-marketplace`. Requires the
 *             `claude` CLI on PATH (prints how to get it if missing). Any
 *             flags after `install` pass through to `claude plugin install`
 *             (e.g. `mindrian-os install --version 1.13.0-beta.9`). The Brain
 *             key stays a printed hint -- writing it to the environment is the
 *             one side effect we leave to the user.
 *   doctor    Path C. Run /mos:doctor's diagnostic logic from OUTSIDE Claude
 *             Code so users catch install/drift problems before a session.
 *             Spawns `node <pluginRoot>/scripts/doctor.cjs` with any extra
 *             args passed through (e.g. `mindrian-os doctor --all --fix`).
 *             Exits with doctor.cjs's exit code.
 *   update    Mirror /mos:update. `git -C <pluginRoot> pull --ff-only`, then
 *             re-run `bash <pluginRoot>/install.sh` to re-register agents,
 *             hooks, settings.json, and the statusLine block.
 *
 * GSD pattern: pure CJS, node built-ins only, zero npm deps. No CLI framework
 * (no commander/yargs/meow). process.argv switch-case routing, mirroring
 * bin/mindrian-tools.cjs and ~/.claude/get-shit-done/bin/gsd-tools.cjs.
 *
 * PLUGIN_ROOT resolution: MINDRIAN_OS_ROOT env var if set (tests, dev boxes),
 * else the canonical install cache at ~/.claude/plugins/mindrian-os.
 */

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const os = require('node:os');

const PLUGIN_ROOT = process.env.MINDRIAN_OS_ROOT
  || path.join(os.homedir(), '.claude', 'plugins', 'mindrian-os');

function run(cmd, args, opts) {
  return spawnSync(cmd, args, { stdio: 'inherit', ...opts });
}

function exitFrom(result) {
  // spawnSync sets status=null when the process was killed by a signal or
  // failed to launch; treat that as a generic failure.
  process.exit(result && typeof result.status === 'number' ? result.status : 1);
}

function printUsage() {
  console.log('mindrian-os <install|doctor|update>   (no subcommand = install)');
  console.log('  install   install MindrianOS via Claude Code (adds the marketplace, installs the mos plugin)');
  console.log('  doctor    run the MindrianOS install/drift diagnostic (Path C; passes flags through to /mos:doctor)');
  console.log('  update    pull the latest plugin and re-run install registration');
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
    // Path C: run /mos:doctor's logic from outside Claude Code.
    const doctorPath = path.join(PLUGIN_ROOT, 'scripts', 'doctor.cjs');
    const r = run(process.execPath, [doctorPath, ...process.argv.slice(3)]);
    exitFrom(r);
    break;
  }

  case 'update': {
    // Mirror /mos:update: fast-forward the plugin clone, then re-run install.sh
    // so agents, hooks, settings.json, and the statusLine block get re-stamped.
    run('git', ['-C', PLUGIN_ROOT, 'pull', '--ff-only']);
    const r = run('bash', [path.join(PLUGIN_ROOT, 'install.sh')]);
    exitFrom(r);
    break;
  }

  case 'install': {
    // Path B: actually install MindrianOS by driving Claude Code's plugin CLI.
    // Registers the Mindrian marketplace, then `claude plugin install mos@...`.
    // Flags after `install` (or leading flags when `install` is implied) pass
    // through to `claude plugin install` (e.g. `... install --version 1.13.0-beta.9`).
    const passthrough = process.argv.slice(argOffset);

    // 1. Claude Code must be on PATH -- it does the actual plugin install.
    const claudeCheck = spawnSync('claude', ['--version'], { stdio: 'ignore' });
    if (!claudeCheck || claudeCheck.status !== 0) {
      console.error('Claude Code is not installed (no `claude` command on your PATH).');
      console.error('Install it first:');
      console.error('  npm install -g @anthropic-ai/claude-code');
      console.error('Then re-run:');
      console.error('  npx @mindrian_os/install');
      process.exit(1);
    }

    // 2. Register the Mindrian marketplace. Best-effort: if it is already
    //    registered Claude Code may exit non-zero with "already added" -- that
    //    is fine, the install step below still works.
    console.log('Adding the Mindrian marketplace...');
    run('claude', ['plugin', 'marketplace', 'add', 'jsagir/mindrian-marketplace']);

    // 3. Install (or update) the plugin. This one's exit code matters.
    console.log('Installing the MindrianOS plugin...');
    const inst = run('claude', ['plugin', 'install', 'mos@mindrian-marketplace', ...passthrough]);
    if (!inst || inst.status !== 0) {
      console.error('');
      console.error('`claude plugin install mos@mindrian-marketplace` did not complete.');
      console.error('Finish it by hand inside Claude Code:');
      console.error('  /plugin marketplace add jsagir/mindrian-marketplace');
      console.error('  /plugin install mos@mindrian-marketplace');
      exitFrom(inst);
    }

    // 4. Done. Point at the Brain key + first run.
    console.log('');
    console.log('MindrianOS installed.');
    console.log('');
    console.log('Optional -- connect the Brain for enriched intelligence:');
    console.log('  inside Claude Code:  /mos:setup   (choose "Configure Brain", paste your key)');
    console.log('  or set it directly:  export MINDRIAN_BRAIN_KEY="<your-key>"   (or add it to ~/.claude/.env)');
    console.log('');
    console.log('Verify:  mindrian-os doctor   (or /mos:doctor inside Claude Code)');
    console.log('Start:   run `claude`, then  /mos:onboard');
    process.exit(0);
    break;
  }

  default:
    printUsage();
    process.exit(sub ? 1 : 0);
}
