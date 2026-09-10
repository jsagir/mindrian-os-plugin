#!/usr/bin/env node
'use strict';

/*
 * scripts/collect-cold-install-evidence.cjs -- Phase 341 Plan 06 (D-13 step 2).
 *
 * WHAT: emits one JSON envelope proving a cold install of the npm-source
 * plugin artifact landed on this machine and that both bundled MCP servers
 * (mindrian-os, mindrian-brain) load. One command, run identically on
 * Windows, macOS and Linux, so a human operator on a machine this repo
 * cannot reach can paste the result back into a tracked proof document.
 *
 * WHY: there is no Windows box and no macOS box in this dev environment.
 * 341-RESEARCH names that as the phase's one hard external dependency with
 * no fallback (see 341-RESEARCH.md "Loader Ground Truth" F-2/F-3 and
 * assumption A1). The proof this collector produces is evidence, not a
 * claim: the fields below are what the D-13 gate actually reads.
 *
 * Canon Part 8 (Graph Boundary): local filesystem reads plus local spawns of
 * this repo's own scripts (node scripts/doctor.cjs). The ONE network touch
 * in the whole envelope is inherited from `doctor --acceptance`'s full-tier
 * points (the live `npm view` version-of-record check and the brain-smoke
 * wire probe) and from `doctor --eureka-smoke`'s optional model-cache read;
 * this is stated here, not hidden. Nothing in this file opens a socket
 * itself.
 *
 * MCP-server probe note (measured on this Linux dev box, both files read
 * before writing this probe per the plan's own instruction): neither
 * bin/mindrian-mcp-server.cjs nor bin/mindrian-brain-mcp-client.cjs exposes
 * a --version flag or any other CLI probe flag -- both call an unconditional
 * top-level main() that connects a StdioServerTransport. Measured behavior
 * differs from the plan's literal "require() + treat a clean exit as
 * loads:true" fallback: mindrian-brain-mcp-client.cjs happens to exit 0 on
 * stdin EOF, but mindrian-mcp-server.cjs does NOT -- it stays connected to
 * stdio by design (a healthy MCP stdio server never exits on its own) and
 * only stops when killed. A literal "clean exit only" probe would therefore
 * mis-report a HEALTHY mindrian-os server as not-loading. The narrowest
 * non-destructive probe each file actually supports is its own startup log
 * line to stderr (`... MCP server v<version> started ...`), written at the
 * point server.connect() succeeds. This collector spawns the real entry
 * file (not require(), since require() previously start it in-process too),
 * feeds it a closed stdin (input:''), captures stderr up to 2000 characters
 * bounded by an explicit timeout, and treats either a clean exit(0) OR the
 * presence of the entry's own "started" marker in stderr as loads:true. A
 * timeout-kill after a confirmed "started" marker is expected lifecycle for
 * a server that intentionally never exits on inspection, not a failure --
 * documented as a note either way for transparency.
 *
 * Version note: plugin_version is read via lib/core/repo-version.cjs (the
 * ONE sanctioned way to read this repo's own version, never a tree search --
 * see that module's header) when CLAUDE_PLUGIN_ROOT is unset (a dev
 * checkout), and directly from <CLAUDE_PLUGIN_ROOT>/package.json when it is
 * set (an installed copy), per the plan's own instruction.
 *
 * Every probe below is wrapped so a failure produces a recorded `null` (or
 * `false` where the field is boolean-shaped) plus a `notes` entry, never a
 * throw -- an evidence collector that crashes on an unhealthy install is
 * useless precisely when it is needed most.
 *
 * House rule: hyphens only, no em-dashes, no emoji. CJS, process.argv
 * routing.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const SCHEMA = 'mos-cold-install-evidence/1';

function usage() {
  return 'usage: node scripts/collect-cold-install-evidence.cjs [--json]';
}

// -- small helpers -----------------------------------------------------

function safe(notes, label, fn, fallback) {
  try {
    return fn();
  } catch (e) {
    notes.push(label + ': ' + (e && e.message ? e.message : String(e)));
    return fallback;
  }
}

function existsSafe(p) {
  try {
    return !!p && fs.existsSync(p);
  } catch {
    return false;
  }
}

function readJsonSafe(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// countInstalledPackages(nodeModulesDir): counts installed packages two
// levels deep for a scoped entry (@scope/name is ONE package, not two), one
// level deep otherwise. Skips dotfiles (.bin, .package-lock.json).
function countInstalledPackages(nodeModulesDir) {
  let count = 0;
  const top = fs.readdirSync(nodeModulesDir, { withFileTypes: true });
  for (const entry of top) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.')) continue;
    if (entry.name.startsWith('@')) {
      const scopeDir = path.join(nodeModulesDir, entry.name);
      let scoped;
      try {
        scoped = fs.readdirSync(scopeDir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const s of scoped) {
        if (s.isDirectory()) count += 1;
      }
    } else {
      count += 1;
    }
  }
  return count;
}

// longestRelativePath(rootDir): walks rootDir recursively (bounded, symlinks
// NOT followed to avoid a cycle) and returns { length, path } of the longest
// path relative to rootDir. Returns null on an unreadable root.
function longestRelativePath(rootDir) {
  let best = { length: 0, path: '' };
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      const rel = path.relative(rootDir, abs);
      if (rel.length > best.length) best = { length: rel.length, path: rel };
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) stack.push(abs);
    }
  }
  return best;
}

// probeMcpEntry(entryPath, notes, id): spawns the entry file directly with a
// closed stdin, capped stderr and a bounded timeout. loads:true when either
// the process exits cleanly OR its own startup marker appears in stderr
// before the timeout kills it (see the header comment for why).
function probeMcpEntry(entryPath, id, notes) {
  if (!existsSafe(entryPath)) {
    return { loads: false };
  }
  const scratchCwd = safe(notes, 'mcp-probe-' + id + '-scratch-dir', function () {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'mos-mcp-probe-'));
  }, os.tmpdir());
  const result = spawnSync(process.execPath, [entryPath], {
    cwd: scratchCwd,
    encoding: 'utf8',
    timeout: 5000,
    input: '',
  });
  const stderrTail = (result.stderr || '').slice(0, 2000);
  const startedMarker = /started/i.test(stderrTail);
  const cleanExit = result.status === 0 && !result.signal;
  if (result.signal) {
    notes.push('mcp-probe-' + id + ': killed by signal ' + result.signal + ' after timeout' +
      (startedMarker ? ' (startup marker seen first -- expected lifecycle for a server that never exits on inspection)' : ' (no startup marker seen -- probe inconclusive)'));
  }
  if (result.error) {
    notes.push('mcp-probe-' + id + ': spawn error: ' + result.error.message);
  }
  return { loads: !!(cleanExit || startedMarker) };
}

// spawnDoctorJson(pluginRoot, args, notes, label): spawns
// `node <pluginRoot>/scripts/doctor.cjs <args> --json`, and extracts the
// trailing JSON block from stdout (doctor.cjs's --acceptance path prints
// human-readable lines before the final JSON.stringify block; --eureka-smoke
// prints JSON only). Returns the parsed object, or null with a notes entry.
function spawnDoctorJson(pluginRoot, args, notes, label, timeoutMs) {
  const doctorPath = path.join(pluginRoot, 'scripts', 'doctor.cjs');
  if (!existsSafe(doctorPath)) {
    notes.push(label + ': doctor.cjs not found at ' + doctorPath);
    return null;
  }
  const result = spawnSync(process.execPath, [doctorPath].concat(args).concat(['--json']), {
    cwd: pluginRoot,
    encoding: 'utf8',
    timeout: timeoutMs,
    input: '',
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error) {
    notes.push(label + ': spawn error: ' + result.error.message);
    return null;
  }
  if (result.signal) {
    notes.push(label + ': killed by signal ' + result.signal + ' (timeout ' + timeoutMs + 'ms exceeded)');
    return null;
  }
  const stdout = result.stdout || '';
  const lines = stdout.split('\n');
  const startIdx = lines.findIndex(function (l) { return l.trim() === '{'; });
  if (startIdx === -1) {
    notes.push(label + ': no JSON block located in stdout (exit code ' + result.status + ')');
    return null;
  }
  const jsonText = lines.slice(startIdx).join('\n');
  try {
    return JSON.parse(jsonText);
  } catch (e) {
    notes.push(label + ': JSON.parse failed: ' + e.message);
    return null;
  }
}

// -- the collector -------------------------------------------------------

function collectEvidence(opts) {
  opts = opts || {};
  const notes = [];
  const home = os.homedir();

  const pluginRootEnv = process.env.CLAUDE_PLUGIN_ROOT || null;
  // baseRoot: the root this collector treats as "the plugin" for every
  // repo-relative read below (doctor.cjs, .mcp.json). Falls back to this
  // script's own repo when CLAUDE_PLUGIN_ROOT is unset (a dev checkout).
  const repoRoot = path.resolve(__dirname, '..');
  const baseRoot = pluginRootEnv && existsSafe(pluginRootEnv) ? pluginRootEnv : repoRoot;
  if (pluginRootEnv && !existsSafe(pluginRootEnv)) {
    notes.push('CLAUDE_PLUGIN_ROOT is set to a non-existent path (' + pluginRootEnv + '); falling back to this script\'s own repo root for local reads');
  }

  // -- claude_code_version --
  const claudeCodeVersion = safe(notes, 'claude_code_version', function () {
    const r = spawnSync('claude', ['--version'], { encoding: 'utf8', timeout: 5000, input: '' });
    if (r.error) throw r.error;
    if (r.status !== 0) throw new Error('exit ' + r.status);
    const m = /(\d+\.\d+\.\d+)/.exec((r.stdout || '') + (r.stderr || ''));
    if (!m) throw new Error('could not parse a version from claude --version output');
    return m[1];
  }, null);

  // -- plugin_version (per the plan: repo-version.cjs from a checkout, the
  // installed package.json from an install; never a tree search) --
  let pluginVersion = null;
  if (pluginRootEnv) {
    pluginVersion = safe(notes, 'plugin_version', function () {
      const pkg = readJsonSafe(path.join(pluginRootEnv, 'package.json'));
      if (!pkg.version) throw new Error('package.json at CLAUDE_PLUGIN_ROOT has no version field');
      return pkg.version;
    }, null);
  } else {
    pluginVersion = safe(notes, 'plugin_version', function () {
      const { readRepoVersion } = require(path.join(repoRoot, 'lib', 'core', 'repo-version.cjs'));
      return readRepoVersion().version;
    }, null);
  }

  // -- marketplace_source: the plugins[].source object for "mos" from the
  // cached marketplace catalog Claude Code itself reads from. --
  const marketplaceCatalogPath = path.join(home, '.claude', 'plugins', 'marketplaces', 'mindrian-marketplace', '.claude-plugin', 'marketplace.json');
  const marketplaceSource = safe(notes, 'marketplace_source', function () {
    const catalog = readJsonSafe(marketplaceCatalogPath);
    const entry = Array.isArray(catalog.plugins) ? catalog.plugins.find(function (p) { return p.name === 'mos'; }) : null;
    if (!entry) throw new Error('no "mos" entry in ' + marketplaceCatalogPath);
    if (!entry.source) throw new Error('"mos" entry has no source field');
    return entry.source;
  }, null);

  // -- npm_cache_present --
  const npmCachePath = path.join(home, '.claude', 'plugins', 'npm-cache');
  const npmCachePresent = existsSafe(npmCachePath);

  // -- cache_dir / node_modules_present / completion_record_present /
  // installed_package_count / longest_relative_path --
  let cacheDir = null;
  let nodeModulesPresent = false;
  let completionRecordPresent = false;
  let installedPackageCount = 0;
  let longestPath = { length: 0, path: '' };
  if (pluginVersion) {
    cacheDir = path.join(home, '.claude', 'plugins', 'cache', 'mindrian-marketplace', 'mos', pluginVersion);
    if (existsSafe(cacheDir)) {
      const nodeModulesDir = path.join(cacheDir, 'node_modules');
      nodeModulesPresent = existsSafe(nodeModulesDir);
      completionRecordPresent = existsSafe(path.join(nodeModulesDir, '.package-lock.json'));
      if (nodeModulesPresent) {
        installedPackageCount = safe(notes, 'installed_package_count', function () {
          return countInstalledPackages(nodeModulesDir);
        }, 0);
      }
      longestPath = safe(notes, 'longest_relative_path', function () {
        return longestRelativePath(cacheDir);
      }, { length: 0, path: '' });
    } else {
      notes.push('cache_dir does not exist yet: ' + cacheDir);
    }
  } else {
    notes.push('cache_dir could not be computed: plugin_version is unknown');
  }

  // -- mcp_servers: probe both .mcp.json entries --
  const mcpJsonPath = path.join(baseRoot, '.mcp.json');
  let mcpServers = [];
  const mcpConfig = safe(notes, 'mcp_servers', function () { return readJsonSafe(mcpJsonPath); }, null);
  if (mcpConfig && mcpConfig.mcpServers) {
    mcpServers = Object.keys(mcpConfig.mcpServers).map(function (id) {
      const def = mcpConfig.mcpServers[id];
      const rawArg = Array.isArray(def.args) && def.args.length ? def.args[0] : '';
      const entryPath = rawArg.replace('${CLAUDE_PLUGIN_ROOT}', baseRoot);
      const entryExists = existsSafe(entryPath);
      const probe = probeMcpEntry(entryPath, id, notes);
      return { id: id, entry_path: entryPath, entry_exists: entryExists, loads: entryExists && probe.loads };
    });
  } else {
    notes.push('mcp_servers: could not read ' + mcpJsonPath + ' (or it has no mcpServers block)');
  }

  // -- doctor_acceptance (full tier: the one network touch this envelope
  // documents, per the header comment) --
  const doctorAcceptanceRaw = spawnDoctorJson(baseRoot, ['--acceptance'], notes, 'doctor_acceptance', 180000);
  const doctorAcceptance = doctorAcceptanceRaw
    ? { ok: Array.isArray(doctorAcceptanceRaw.failed_points) && doctorAcceptanceRaw.failed_points.length === 0, failed_point_ids: doctorAcceptanceRaw.failed_points || [] }
    : { ok: false, failed_point_ids: [] };

  // -- eureka_smoke --
  const eurekaSmokeRaw = spawnDoctorJson(baseRoot, ['--eureka-smoke'], notes, 'eureka_smoke', 60000);
  const eurekaSmoke = eurekaSmokeRaw
    ? {
        ok: !!eurekaSmokeRaw.ok,
        layers: Array.isArray(eurekaSmokeRaw.layers)
          ? eurekaSmokeRaw.layers.map(function (l) { return { id: l.id, ok: !!l.ok, advisory: !!l.advisory }; })
          : [],
      }
    : { ok: false, layers: [] };

  const envelope = {
    schema: SCHEMA,
    collected_at: new Date().toISOString(),
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    os_release: os.release(),
    claude_code_version: claudeCodeVersion,
    plugin_root: pluginRootEnv,
    plugin_version: pluginVersion,
    marketplace_source: marketplaceSource,
    npm_cache_present: npmCachePresent,
    cache_dir: cacheDir,
    node_modules_present: nodeModulesPresent,
    completion_record_present: completionRecordPresent,
    installed_package_count: installedPackageCount,
    mcp_servers: mcpServers,
    doctor_acceptance: doctorAcceptance,
    eureka_smoke: eurekaSmoke,
    longest_relative_path: longestPath,
    first_install_seconds: opts.firstInstallSeconds != null ? opts.firstInstallSeconds : null,
    notes: opts.firstInstallSeconds == null
      ? notes.concat(['first_install_seconds is null by default -- the human operator records the wall-clock seconds the "claude plugin update mos@mindrian-marketplace" command took, per 341-RESEARCH Open Question 1'])
      : notes,
  };

  return envelope;
}

// -- CLI -------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  let json = false;
  for (const arg of args) {
    if (arg === '--json') { json = true; continue; }
    process.stderr.write(usage() + '\n');
    process.exit(2);
    return;
  }

  const envelope = collectEvidence({});

  if (json) {
    process.stdout.write(JSON.stringify(envelope) + '\n');
    process.exit(0);
    return;
  }

  console.log('Cold-install evidence (' + envelope.schema + ')');
  console.log('  platform: ' + envelope.platform + ' / ' + envelope.arch + ' / node ' + envelope.node);
  console.log('  plugin_version: ' + envelope.plugin_version);
  console.log('  marketplace_source: ' + JSON.stringify(envelope.marketplace_source));
  console.log('  node_modules_present: ' + envelope.node_modules_present + '  completion_record_present: ' + envelope.completion_record_present);
  console.log('  installed_package_count: ' + envelope.installed_package_count);
  console.log('  mcp_servers: ' + envelope.mcp_servers.map(function (s) { return s.id + '=' + (s.loads ? 'loads' : 'no-load'); }).join(', '));
  console.log('  doctor_acceptance.ok: ' + envelope.doctor_acceptance.ok);
  console.log('  eureka_smoke.ok: ' + envelope.eureka_smoke.ok);
  console.log('  longest_relative_path: ' + envelope.longest_relative_path.length + ' chars');
  console.log('');
  console.log(JSON.stringify(envelope, null, 2));
  process.exit(0);
}

module.exports = { collectEvidence };

if (require.main === module) {
  main();
}
