#!/usr/bin/env node
'use strict';

/*
 * scripts/check-registry-drift.cjs -- Phase 341 Plan 04 (D-08), the folded
 * todo (.planning/todos/pending/2026-07-03-registry-drift-gate-...).
 *
 * WHAT: answers exactly one question -- did a command present in the
 * PREVIOUS release's data/command-registry.json vanish from the current one
 * without anyone saying so. Compares on the `command` key.
 *
 * WHY: 2026-07-03, a navigator believed the entire rs-family of commands had
 * been silently lost in a version update. It turned out to be a false
 * alarm (a terminal line-wrap artifact), but the underlying worry was
 * legitimate: there was no STRUCTURAL guarantee that a command present in
 * one release stays present, or gets an explicit deprecation entry, in the
 * next.
 *
 * BASELINE RESOLUTION, in this order:
 *   1. process.env.CHECK_REGISTRY_DRIFT_BASELINE (the test seam) -- a path
 *      to a baseline JSON.
 *   2. `git show <last-tag>:data/command-registry.json`, where <last-tag>
 *      comes from `git describe --tags --abbrev=0 --match=v*`, spawned with
 *      an argv array. This is a LOCAL git read, not a network call.
 *   3. tests/fixtures/341-registry-drift-baseline.json, the committed
 *      fallback, so the gate is never silently skipped on a fresh clone with
 *      no tags.
 * The runner always states which source it used; a gate that cannot say
 * what it compared against is not a gate.
 *
 * Canon Part 8 (Graph Boundary): local filesystem plus one local `git show`
 * / `git describe` spawn, zero network, zero Brain reach.
 *
 * Test seam: CHECK_REGISTRY_DRIFT_BASELINE, per above.
 *
 * House rule: hyphens only, no em-dashes, no emoji. CJS, process.argv
 * routing.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(REPO_ROOT, 'data', 'command-registry.json');
const FALLBACK_BASELINE_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', '341-registry-drift-baseline.json');

function usage() {
  return 'usage: node scripts/check-registry-drift.cjs --check';
}

/**
 * diffRegistries(baseline, current) -> { removed: [], added: [], visibilityChanged: [] }
 * Pure, no I/O, so a test can exercise it hermetically. Compares the
 * `commands` arrays keyed on the `command` field.
 */
function diffRegistries(baseline, current) {
  const baseCommands = Array.isArray(baseline && baseline.commands) ? baseline.commands : [];
  const currCommands = Array.isArray(current && current.commands) ? current.commands : [];

  const baseByName = new Map();
  for (const c of baseCommands) {
    if (c && typeof c.command === 'string') baseByName.set(c.command, c);
  }
  const currByName = new Map();
  for (const c of currCommands) {
    if (c && typeof c.command === 'string') currByName.set(c.command, c);
  }

  const removed = [];
  const visibilityChanged = [];
  for (const [name, baseEntry] of baseByName) {
    if (!currByName.has(name)) {
      removed.push(name);
      continue;
    }
    const currEntry = currByName.get(name);
    if (baseEntry.visibility !== currEntry.visibility) {
      visibilityChanged.push({ command: name, from: baseEntry.visibility, to: currEntry.visibility });
    }
  }

  const added = [];
  for (const name of currByName.keys()) {
    if (!baseByName.has(name)) added.push(name);
  }

  return { removed, added, visibilityChanged };
}

function resolveBaseline() {
  const envPath = process.env.CHECK_REGISTRY_DRIFT_BASELINE;
  if (envPath) {
    try {
      const raw = fs.readFileSync(envPath, 'utf8');
      return { ok: true, source: 'env', path: envPath, registry: JSON.parse(raw) };
    } catch (e) {
      return { ok: false, source: 'env', reason: 'could not read/parse CHECK_REGISTRY_DRIFT_BASELINE at ' + envPath + ': ' + e.message };
    }
  }

  const describe = spawnSync('git', ['describe', '--tags', '--abbrev=0', '--match=v*'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 30000,
  });
  if (!describe.error && describe.status === 0 && describe.stdout && describe.stdout.trim()) {
    const tag = describe.stdout.trim();
    const show = spawnSync('git', ['show', tag + ':data/command-registry.json'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      timeout: 30000,
    });
    if (!show.error && show.status === 0 && show.stdout && show.stdout.trim()) {
      try {
        return { ok: true, source: 'git-tag', path: tag, registry: JSON.parse(show.stdout) };
      } catch (e) {
        // Fall through to the fixture below on a parse failure.
      }
    }
  }

  try {
    const raw = fs.readFileSync(FALLBACK_BASELINE_PATH, 'utf8');
    return { ok: true, source: 'fixture', path: FALLBACK_BASELINE_PATH, registry: JSON.parse(raw) };
  } catch (e) {
    return { ok: false, source: 'fixture', reason: 'could not read/parse the committed fallback baseline at ' + FALLBACK_BASELINE_PATH + ': ' + e.message };
  }
}

/**
 * check(opts) -> { ok, findings, baselineSource }. `removed` is the finding
 * class that matters (a command disappeared); `added` and
 * `visibilityChanged` are reported for context but never fail. Because the
 * rung is `logged` for one release, `check` returns findings and the
 * harness records them; the runner still exits non-zero on a removal so a
 * future promotion to `blocking` needs only the one-line rung edit.
 */
function check(opts) {
  opts = opts || {};
  const registryPath = opts.registryPath || REGISTRY_PATH;
  const findings = [];

  let current;
  try {
    current = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  } catch (e) {
    findings.push('could not read/parse the current registry at ' + registryPath + ': ' + e.message);
    return { ok: false, findings, baselineSource: null };
  }

  const baseline = resolveBaseline();
  if (!baseline.ok) {
    findings.push('could not resolve a baseline: ' + baseline.reason);
    return { ok: false, findings, baselineSource: baseline.source };
  }

  console.log('check-registry-drift: baseline source = ' + baseline.source + (baseline.path ? ' (' + baseline.path + ')' : ''));

  const diff = diffRegistries(baseline.registry, current);

  if (diff.removed.length) {
    findings.push(
      'commands present in the baseline but MISSING from the current registry: ' +
        diff.removed.join(', ') +
        '. If this is intentional, add an explicit deprecation entry recording why.'
    );
  }
  if (diff.added.length) {
    findings.push('context: ' + diff.added.length + ' command(s) added since baseline: ' + diff.added.join(', '));
  }
  if (diff.visibilityChanged.length) {
    findings.push(
      'context: ' + diff.visibilityChanged.length + ' command(s) changed visibility: ' +
        diff.visibilityChanged.map(function (v) { return v.command + ' (' + v.from + ' -> ' + v.to + ')'; }).join(', ')
    );
  }

  return { ok: diff.removed.length === 0, findings, baselineSource: baseline.source };
}

function main() {
  const argv = process.argv.slice(2);

  if (argv.length === 1 && argv[0] === '--check') {
    const result = check();
    if (result.findings.length === 0) {
      console.log('check-registry-drift: OK (0 findings, baseline=' + result.baselineSource + ')');
    } else {
      for (const f of result.findings) {
        console.log((result.ok ? 'INFO: ' : 'FAIL: ') + f);
      }
    }
    process.exit(result.ok ? 0 : 1);
    return;
  }

  console.error(usage());
  process.exit(2);
}

if (require.main === module) {
  main();
}

module.exports = { diffRegistries, check };
