#!/usr/bin/env node
'use strict';
/**
 * scripts/release-lib/prune-shrinkwrap.cjs  (Phase 369.1 plan 08, D-16 / D-16a, navigator 2026-10-04)
 *
 * WHAT: removes the named optional subtree (default: `sharp`) from an npm lockfile by REACHABILITY, so
 * the shipped npm-shrinkwrap.json carries no package with an install script.
 *
 * WHY: next@16 declares sharp as an optional dependency, and sharp declares an install script. Every
 * supported installer runs `npm ci --ignore-scripts` (the Claude Code loader, documented at
 * code.claude.com/docs/en/plugins/loading "No lifecycle scripts", and the plugin's own self-install in
 * lib/core/mcp-dep-heal.cjs), so that script would never run and sharp would be silently broken; the
 * release-payload-ceiling gate therefore refuses any hasInstallScript entry, with no exemption. The two
 * other ways to keep sharp out fail (measured 2026-10-04): an npm `overrides` key makes the loader skip
 * the whole dependency install, and an omit-optional regeneration leaves every sharp entry in the
 * lockfile. Pruning the lockfile keeps package.json untouched and passes `npm ci --ignore-scripts`.
 *
 * HOW: (1) delete each named package from every entry's dependencies, optionalDependencies,
 * peerDependencies and peerDependenciesMeta maps; (2) keep only the entries reachable from the root ""
 * by walking those maps the way npm resolves a dependency (nested node_modules first, then each
 * ancestor, then the top level); (3) refuse (exit 1) when an entry with hasInstallScript:true remains.
 *
 * Usage:  node scripts/release-lib/prune-shrinkwrap.cjs <lockfile> [--check] [--names a,b]
 *   (no flag)  rewrite the lockfile in place when something changed; print what was pruned
 *   --check    write nothing; exit 1 when a prune would change the file or an install script remains
 *   --names    comma list of package names to cut (default: sharp); repeatable
 *
 * Deterministic and idempotent: key order is preserved, the file is written only when it changes,
 * a second run prints "nothing to prune". Built-ins only. Run by release.sh Step 6.7 through
 * scripts/release-lib/shrinkwrap-gate.sh on every cut; never edit npm-shrinkwrap.json by hand.
 */

const fs = require('node:fs');

const EDGE_MAPS = ['dependencies', 'optionalDependencies', 'peerDependencies'];

function parseArgs(argv) {
  const out = { file: '', check: false, names: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--check':
        out.check = true;
        break;
      case '--names': {
        const v = argv[++i];
        if (!v) throw new Error('--names needs a value');
        v.split(',').forEach(function (n) { if (n.trim()) out.names.push(n.trim()); });
        break;
      }
      default:
        if (a.indexOf('--') === 0) throw new Error('unknown flag ' + a);
        if (out.file) throw new Error('more than one lockfile given');
        out.file = a;
    }
  }
  if (!out.file) throw new Error('usage: prune-shrinkwrap.cjs <lockfile> [--check] [--names a,b]');
  if (out.names.length === 0) out.names.push('sharp');
  return out;
}

// The key npm would resolve dependency `name` to, starting from entry `fromKey`, or null.
function resolveDep(packages, fromKey, name) {
  let base = fromKey;
  for (;;) {
    const candidate = (base ? base + '/' : '') + 'node_modules/' + name;
    if (Object.prototype.hasOwnProperty.call(packages, candidate)) return candidate;
    if (!base) return null;
    // climb one level: strip the trailing node_modules/<name> or node_modules/@scope/<name>
    const idx = base.lastIndexOf('node_modules/');
    if (idx === -1) {
      base = '';
    } else {
      base = idx === 0 ? '' : base.slice(0, idx - 1);
    }
  }
}

// Pure function: returns { lock, removed: [keys], remaining: [install-script keys] }. Does not touch disk.
function prune(lock, names) {
  const packages = lock && lock.packages;
  if (!packages || typeof packages !== 'object') throw new Error('lockfile has no "packages" map (need lockfileVersion 3)');
  const root = packages[''] || {};
  for (const n of names) {
    for (const m of EDGE_MAPS.concat(['devDependencies'])) {
      if (root[m] && Object.prototype.hasOwnProperty.call(root[m], n)) {
        throw new Error('the root package depends on "' + n + '" directly (' + m + '); refusing to prune a root dependency');
      }
    }
  }

  // Work on a deep copy so the caller's object is never mutated.
  const copy = JSON.parse(JSON.stringify(lock));
  const pk = copy.packages;

  // (1) cut the named edges everywhere
  for (const key of Object.keys(pk)) {
    const entry = pk[key];
    if (!entry || typeof entry !== 'object') continue;
    for (const m of EDGE_MAPS.concat(['peerDependenciesMeta'])) {
      if (!entry[m] || typeof entry[m] !== 'object') continue;
      for (const n of names) {
        if (Object.prototype.hasOwnProperty.call(entry[m], n)) delete entry[m][n];
      }
      if (Object.keys(entry[m]).length === 0) delete entry[m];
    }
  }

  // (2) reachability from the root
  const seen = new Set(['']);
  const queue = [''];
  while (queue.length) {
    const key = queue.shift();
    const entry = pk[key];
    if (!entry) continue;
    if (entry.link === true && typeof entry.resolved === 'string' && pk[entry.resolved] && !seen.has(entry.resolved)) {
      seen.add(entry.resolved);
      queue.push(entry.resolved);
    }
    const maps = key === '' ? EDGE_MAPS.concat(['devDependencies']) : EDGE_MAPS;
    for (const m of maps) {
      if (!entry[m]) continue;
      for (const dep of Object.keys(entry[m])) {
        const target = resolveDep(pk, key, dep);
        if (target && !seen.has(target)) {
          seen.add(target);
          queue.push(target);
        }
      }
    }
  }

  const removed = [];
  const kept = {};
  for (const key of Object.keys(pk)) {
    if (seen.has(key)) kept[key] = pk[key];
    else removed.push(key);
  }
  copy.packages = kept;

  const remaining = Object.keys(kept).filter(function (k) { return kept[k] && kept[k].hasInstallScript === true; });
  return { lock: copy, removed, remaining };
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    process.stderr.write('prune-shrinkwrap: ' + e.message + '\n');
    process.exit(2);
    return;
  }

  let text;
  let lock;
  try {
    text = fs.readFileSync(args.file, 'utf8');
    lock = JSON.parse(text);
  } catch (e) {
    process.stderr.write('prune-shrinkwrap: cannot read ' + args.file + ': ' + e.message + '\n');
    process.exit(2);
    return;
  }

  let result;
  try {
    result = prune(lock, args.names);
  } catch (e) {
    process.stderr.write('prune-shrinkwrap: ' + e.message + '\n');
    process.exit(1);
    return;
  }

  const next = JSON.stringify(result.lock, null, 2) + '\n';
  const changed = next !== text;

  if (!changed) {
    process.stdout.write('nothing to prune\n');
  } else if (args.check) {
    process.stdout.write('would prune ' + result.removed.length + ' entries: ' + result.removed.join(', ') + '\n');
  } else {
    fs.writeFileSync(args.file, next);
    process.stdout.write('pruned ' + result.removed.length + ' entries: ' + result.removed.join(', ') + '\n');
  }

  if (result.remaining.length) {
    process.stderr.write(
      'prune-shrinkwrap: install-script packages remain after the prune: ' + result.remaining.join(', ') +
        '. Every supported installer runs --ignore-scripts, so they would be silently broken.\n'
    );
    process.exit(1);
    return;
  }
  process.exit(args.check && changed ? 1 : 0);
}

if (require.main === module) main();

module.exports = { prune, resolveDep };
