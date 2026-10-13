#!/usr/bin/env node
'use strict';

/*
 * scripts/check-registry-drift.cjs -- Phase 341 Plan 04 (D-08), the folded
 * todo (.planning/todos/pending/2026-07-03-registry-drift-gate-...).
 *
 * WHAT: answers exactly one question -- did a command present in the
 * PREVIOUS release's data/command-registry.json vanish from the current one
 * without anyone saying so. Compares on the `command` key. A removal passes
 * only with a valid entry in data/command-deprecations.json, and the runner
 * prints each accepted removal by name.
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
 * DEPRECATIONS: data/command-deprecations.json is a hand-maintained object
 * { _note, deprecations: [...] }. Each entry has the required fields command,
 * retired_in, replaced_by (a command or null), reason, decided_by, date and
 * record. retired_in is the version of the first release that ships without
 * the command, written without a v prefix (2.0.0-beta.67). An entry whose
 * command is still in the current registry fails as STALE. A malformed entry
 * fails and accepts nothing. An absent file accepts nothing. An unreadable or
 * unparseable file fails closed. First use: quick 261012-v17 retired
 * /mos:query, and quick 261013-60k recorded it.
 *
 * Canon Part 8 (Graph Boundary): local filesystem plus one local `git show`
 * / `git describe` spawn, zero network, zero Brain reach.
 *
 * Test seam: CHECK_REGISTRY_DRIFT_BASELINE, per above; opts.registryPath and
 * opts.deprecationsPath override the two data files in check().
 *
 * House rule: hyphens only, no em-dashes, no emoji. CJS, process.argv
 * routing.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(REPO_ROOT, 'data', 'command-registry.json');
const DEPRECATIONS_PATH = path.join(REPO_ROOT, 'data', 'command-deprecations.json');
const REQUIRED_FIELDS = ['command', 'retired_in', 'replaced_by', 'reason', 'decided_by', 'date', 'record'];
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

function isPlainObject(x) {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function isFilledString(x) {
  return typeof x === 'string' && x.trim().length > 0;
}

/**
 * validateDeprecations(doc) -> { entries, errors }. Pure, no I/O. `entries`
 * holds only the entries with zero errors; `errors` has one string per
 * problem. A malformed entry is never put in `entries`, so it accepts nothing.
 */
function validateDeprecations(doc) {
  if (!isPlainObject(doc) || !Array.isArray(doc.deprecations)) {
    return { entries: [], errors: ['the file must be an object with a "deprecations" array'] };
  }
  const entries = [];
  const errors = [];
  const seen = new Set();
  doc.deprecations.forEach(function (e, i) {
    const own = [];
    const name = isPlainObject(e) && isFilledString(e.command) ? e.command : null;
    const tag = 'entry ' + i + (name ? ' (' + name + ')' : '') + ': ';
    if (!isPlainObject(e)) {
      own.push(tag + 'the element is not an object');
    } else {
      for (const f of REQUIRED_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(e, f)) own.push(tag + 'missing required field "' + f + '"');
      }
      for (const f of ['command', 'retired_in', 'reason', 'decided_by', 'date', 'record']) {
        if (Object.prototype.hasOwnProperty.call(e, f) && !isFilledString(e[f])) {
          own.push(tag + 'field "' + f + '" must be a non-empty string');
        }
      }
      if (Object.prototype.hasOwnProperty.call(e, 'replaced_by') && e.replaced_by !== null && !isFilledString(e.replaced_by)) {
        own.push(tag + 'field "replaced_by" must be null or a non-empty string');
      }
      if (isFilledString(e.retired_in) && !/^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/.test(e.retired_in)) {
        own.push(tag + 'field "retired_in" must be a version without a v prefix, for example 2.0.0-beta.67');
      }
      if (isFilledString(e.date) && !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) {
        own.push(tag + 'field "date" must be YYYY-MM-DD');
      }
      if (name) {
        if (seen.has(name)) own.push(tag + 'duplicate entry for ' + name);
        seen.add(name);
      }
    }
    if (own.length === 0) entries.push(e);
    for (const m of own) errors.push(m);
  });
  return { entries, errors };
}

/**
 * classifyRemovals(removed, current, entries) -> { accepted, unrecorded, stale }.
 * Pure. `entries` are the valid entries only.
 */
function classifyRemovals(removed, current, entries) {
  const currCommands = Array.isArray(current && current.commands) ? current.commands : [];
  const currentNames = new Set();
  for (const c of currCommands) {
    if (c && typeof c.command === 'string') currentNames.add(c.command);
  }
  const byCommand = new Map();
  for (const e of entries) byCommand.set(e.command, e);

  const accepted = [];
  const unrecorded = [];
  for (const name of removed) {
    const e = byCommand.get(name);
    if (e) accepted.push({ command: e.command, replaced_by: e.replaced_by, retired_in: e.retired_in });
    else unrecorded.push(name);
  }
  const stale = [];
  for (const e of entries) {
    if (currentNames.has(e.command)) stale.push(e.command);
  }
  return { accepted, unrecorded, stale };
}

function acceptedLine(a) {
  return 'REMOVED with a deprecation entry: ' + a.command + ' -> ' +
    (a.replaced_by === null ? 'no replacement' : a.replaced_by) + ' (retired_in ' + a.retired_in + ')';
}

function labelFor(file) {
  const rel = path.relative(REPO_ROOT, file);
  return rel.startsWith('..') ? file : rel;
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
 * check(opts) -> { ok, findings, accepted, baselineSource }. `removed` is the
 * finding class that matters (a command disappeared). A removal with a valid
 * deprecation entry is listed in `accepted` and does not fail. A removal
 * without one, a stale entry and a malformed entry fail. `added` and
 * `visibilityChanged` are reported for context but never fail. Because the
 * rung is `logged` for one release, `check` returns findings and the
 * harness records them; the runner still exits non-zero on a failure so a
 * future promotion to `blocking` needs only the one-line rung edit.
 */
function check(opts) {
  opts = opts || {};
  const registryPath = opts.registryPath || REGISTRY_PATH;
  const deprecationsPath = opts.deprecationsPath || DEPRECATIONS_PATH;
  const findings = [];

  let current;
  try {
    current = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  } catch (e) {
    findings.push('could not read/parse the current registry at ' + registryPath + ': ' + e.message);
    return { ok: false, findings, accepted: [], baselineSource: null };
  }

  const baseline = resolveBaseline();
  if (!baseline.ok) {
    findings.push('could not resolve a baseline: ' + baseline.reason);
    return { ok: false, findings, accepted: [], baselineSource: baseline.source };
  }

  console.log('check-registry-drift: baseline source = ' + baseline.source + (baseline.path ? ' (' + baseline.path + ')' : ''));

  const label = labelFor(deprecationsPath);
  let doc = null;
  let absent = false;
  let readable = true;
  try {
    doc = JSON.parse(fs.readFileSync(deprecationsPath, 'utf8'));
  } catch (e) {
    if (e && e.code === 'ENOENT') {
      absent = true;
    } else {
      readable = false;
      findings.push('could not read/parse the deprecations file at ' + label + ': ' + e.message);
    }
  }

  let validation = { entries: [], errors: [] };
  if (readable && !absent) validation = validateDeprecations(doc);
  console.log(
    'check-registry-drift: deprecations source = ' + label +
      (absent ? ' (absent, 0 entries)' : readable ? ' (' + validation.entries.length + ' valid entries)' : ' (unreadable, 0 entries)')
  );

  const diff = diffRegistries(baseline.registry, current);
  const cls = classifyRemovals(diff.removed, current, validation.entries);

  if (cls.unrecorded.length) {
    findings.push(
      'commands present in the baseline but MISSING from the current registry: ' +
        cls.unrecorded.join(', ') +
        '. If this is intentional, add an explicit deprecation entry recording why.'
    );
  }
  if (cls.stale.length) {
    findings.push(
      'STALE deprecation entry: ' + cls.stale.join(', ') +
        ' is still in the current registry. Remove the command or remove its entry from ' + label + '.'
    );
  }
  for (const err of validation.errors) {
    findings.push('MALFORMED deprecation entry in ' + label + ': ' + err);
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

  const ok = readable && cls.unrecorded.length === 0 && cls.stale.length === 0 && validation.errors.length === 0;
  return { ok, findings, accepted: cls.accepted.map(acceptedLine), baselineSource: baseline.source };
}

function main() {
  const argv = process.argv.slice(2);

  if (argv.length === 1 && argv[0] === '--check') {
    const result = check();
    for (const line of result.accepted) {
      console.log('INFO: ' + line);
    }
    if (result.findings.length === 0) {
      console.log(
        'check-registry-drift: OK (0 findings, ' + result.accepted.length + ' accepted removal(s), baseline=' +
          result.baselineSource + ')'
      );
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

module.exports = { diffRegistries, check, validateDeprecations, classifyRemovals, DEPRECATIONS_PATH };
