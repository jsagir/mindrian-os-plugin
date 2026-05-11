#!/usr/bin/env node
'use strict';
/*
 * Phase 95.6 D-05c -- MindrianOS CLI (Path B setup-wizard + Path C doctor parity).
 *
 * Usage: mindrian-os <install|doctor|update> [args]
 *
 *   install   Path B. Print the marketplace install instructions plus the
 *             optional Brain-key setup. A thin wrapper around the canonical
 *             marketplace flow -- no side effects, just guidance.
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
  console.log('mindrian-os <install|doctor|update>');
  console.log('  install   show install instructions + Brain-key setup (Path B)');
  console.log('  doctor    run the MindrianOS install/drift diagnostic (Path C; passes flags through to /mos:doctor)');
  console.log('  update    pull the latest plugin and re-run install registration');
}

const sub = process.argv[2];

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
    // Path B: wrap the marketplace install + a Brain-key prompt. No side
    // effects -- the user runs the printed commands inside Claude Code.
    console.log('To install MindrianOS in Claude Code:');
    console.log('  /plugin marketplace add jsagir/mindrian-marketplace');
    console.log('  /plugin install mos@mindrian-marketplace');
    console.log('');
    console.log('Or run the universal installer from a shell:');
    console.log('  curl -fsSL https://raw.githubusercontent.com/jsagir/mindrian-os-plugin/main/install.sh | bash');
    console.log('');
    console.log('Optional: set your Brain key for enriched intelligence:');
    console.log('  export MINDRIAN_BRAIN_KEY=<your-key>   (or add it to ~/.claude/.env)');
    console.log('');
    console.log('Then verify: mindrian-os doctor   (or /mos:doctor inside Claude Code)');
    process.exit(0);
    break;
  }

  default:
    printUsage();
    process.exit(sub ? 1 : 0);
}
