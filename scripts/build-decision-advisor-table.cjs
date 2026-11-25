#!/usr/bin/env node
'use strict';
/*
 * scripts/build-decision-advisor-table.cjs -- Phase 399 Plan 06 Task 2 (I-05, I-06).
 *
 * Builds data/decision-advisor-table.json offline. Inputs:
 *   - the recorded labels-only yes/no run (tests/fixtures/399/recorded-job-command-yes-no.json),
 *   - the command registry serves_jtbd labels (the calibration target, I-06),
 *   - the run-step scope (data/run-step-capabilities.json, D-05).
 *
 * The table holds calibrated values only. The raw recorded probabilities are
 * mapped through a monotone step function (isotonic regression, pool adjacent
 * violators) fitted on every recorded pair, then applied to the scope commands.
 * The table holds no accuracy metric and no wall-clock time. Determinism comes
 * from the hashes in built_from.
 *
 * v0 job-only data: the recorded run conditions on neither definition level nor
 * last command. Every row key is "<job>|*|*". The key format and the lookup
 * fallback order are built for finer rows; a later recorded run fills them.
 *
 * Modes:
 *   (default)             write data/decision-advisor-table.json
 *   --check               rebuild in memory and byte-compare (0 equal, 1 drift, 3 recorded input absent)
 *   --print-calibration   print the calibration breakpoints only
 *
 * Zero network. No model call. Dev-time only.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const TABLE_PATH = path.join(ROOT, 'data', 'decision-advisor-table.json');
const ROW_DEPTH = 12;

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function defaults() {
  return {
    recordedPath:
      process.env.MINDRIAN_DECISION_RECORDED ||
      path.join(ROOT, 'tests', 'fixtures', '399', 'recorded-job-command-yes-no.json'),
    registryPath: process.env.MINDRIAN_COMMAND_REGISTRY || path.join(ROOT, 'data', 'command-registry.json'),
    scopePath: path.join(ROOT, 'data', 'run-step-capabilities.json'),
    vocabularyPath: path.join(ROOT, 'data', 'job-vocabulary.json'),
  };
}

/**
 * Pool adjacent violators. points: [[x, y], ...]. Ties on x are pooled first.
 * Returns [[x_min, y], ...] with y non-decreasing.
 */
function fitIsotonic(points) {
  const sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const blocks = []; // { x, sum, w }
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    let sum = 0;
    while (j < sorted.length && sorted[j][0] === sorted[i][0]) {
      sum += sorted[j][1];
      j += 1;
    }
    blocks.push({ x: sorted[i][0], sum, w: j - i });
    i = j;
    while (blocks.length > 1) {
      const cur = blocks[blocks.length - 1];
      const prev = blocks[blocks.length - 2];
      if (prev.sum / prev.w >= cur.sum / cur.w) {
        blocks.splice(blocks.length - 2, 2, { x: prev.x, sum: prev.sum + cur.sum, w: prev.w + cur.w });
      } else break;
    }
  }
  return blocks.map((b) => [b.x, b.sum / b.w]);
}

/** Step function: the y of the last block whose x_min <= p; below the first block, the first y. */
function applyCalibration(breakpoints, p) {
  if (!breakpoints.length) return 0;
  let y = breakpoints[0][1];
  for (const [x, by] of breakpoints) {
    if (x <= p) y = by;
    else break;
  }
  return y;
}

function round3(v) {
  return Math.round(v * 1000) / 1000;
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// A deprecated command is never offered. Its scope seat goes to the command that replaced it
// (frontmatter deprecated_redirect), so the advisor names the live command. A deprecated command
// with no replacement leaves the scope. A redirect with a subcommand ("rooms organize") names its
// command by the first word. Read from commands/<name>.md at build time.
function resolveDeprecated(commands, commandsDir) {
  const out = [];
  const seen = new Set();
  let resolved = 0;
  for (const c of commands) {
    let name = c;
    const file = path.join(commandsDir, c.replace(/^\/mos:/, '') + '.md');
    if (fs.existsSync(file)) {
      const text = fs.readFileSync(file, 'utf8');
      const end = text.indexOf('\n---', 3);
      const fm = end > 0 ? text.slice(0, end) : '';
      if (/^deprecated:\s*true\s*$/m.test(fm)) {
        const m = fm.match(/^deprecated_redirect:\s*"?([a-z0-9-]+)/m);
        name = m ? '/mos:' + m[1] : null;
        resolved += 1;
      }
    }
    if (name && !seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return { commands: out, resolved };
}

function buildTable(opts) {
  const o = Object.assign(defaults(), opts || {});
  if (!fs.existsSync(o.recordedPath)) {
    const err = new Error('recorded input absent');
    err.code = 'RECORDED_ABSENT';
    throw err;
  }
  const recordedBytes = fs.readFileSync(o.recordedPath);
  const recorded = JSON.parse(recordedBytes.toString('utf8'));
  const registry = readJson(o.registryPath);
  const scope = readJson(o.scopePath);
  const vocab = readJson(o.vocabularyPath);
  const vocabIds = new Set(vocab.ids);

  // Frozen constants, read from their homes at build time and written into the table.
  const { RECOMMENDED_CONFIDENCE_FLOOR } = require(path.join(ROOT, 'lib', 'core', 'navigation-engine.cjs'));
  const { BEHAVIORAL_CHANNEL_FLOOR, MAX_K } = require(path.join(ROOT, 'lib', 'workflow', 'f-selector-ranker.cjs'));

  // Calibration target: registry serves_jtbd holds the job (label 1) or not (label 0).
  const served = new Map();
  const labelLines = [];
  for (const c of registry.commands) {
    const jobs = Array.isArray(c.serves_jtbd) ? c.serves_jtbd : [];
    served.set(c.command, new Set(jobs));
    for (const j of jobs) labelLines.push(c.command + '|' + j);
  }
  labelLines.sort();

  const pairs = recorded.pairs;
  const points = pairs.map((pr) => [pr.p, served.has(pr.command) && served.get(pr.command).has(pr.job) ? 1 : 0]);
  const breakpoints = fitIsotonic(points).map(([x, y]) => [x, round3(y)]);

  const live = resolveDeprecated(scope.commands, o.commandsDir || path.join(ROOT, 'commands'));
  const scopeSet = new Set(live.commands);
  const jobs = Array.from(new Set(pairs.map((pr) => pr.job))).sort();
  for (const j of jobs) {
    if (!vocabIds.has(j)) throw new Error('recorded job not in vocabulary: ' + j);
  }

  const rows = {};
  for (const job of jobs) {
    const list = pairs
      .filter((pr) => pr.job === job && scopeSet.has(pr.command))
      .map((pr) => ({ command: pr.command, calibrated: applyCalibration(breakpoints, pr.p) }));
    list.sort((a, b) => b.calibrated - a.calibrated || (a.command < b.command ? -1 : 1));
    rows[job + '|*|*'] = list.slice(0, ROW_DEPTH);
  }

  return {
    schema: 'mos.decision-advisor-table/1',
    table_version: '399-v0',
    data_scope: 'v0 job-only data',
    _note:
      'Phase 399 I-05 and I-06. v0 job-only data: every row is keyed <job>|*|* because the recorded run conditions on neither ' +
      'definition level nor last command. The key order and the fallback order are built for finer rows; they are not live. ' +
      'The values are calibrated by a monotone step function; no raw probability and no accuracy metric is stored. ' +
      'A deprecated scope command is replaced by the command it redirects to, so no row offers a retired name. ' +
      'Rebuild: node scripts/build-decision-advisor-table.cjs. Check: node scripts/build-decision-advisor-table.cjs --check.',
    provider: recorded.provider,
    model: recorded.model,
    question_template: recorded.question_template,
    key_order: ['job', 'definition_level', 'last_command'],
    conditioned_rows: false,
    row_depth: ROW_DEPTH,
    built_from: {
      recorded_sha256: sha256(recordedBytes),
      registry_labels_sha256: sha256(labelLines.join('\n')),
      scope_sha256: sha256(scope.commands.join('\n')),
      live_scope_sha256: sha256(live.commands.join('\n')),
      deprecated_resolved: live.resolved,
      recorded_at: recorded.recorded_at,
    },
    calibration: {
      method: 'isotonic-pav',
      label_source:
        'The registry serves_jtbd of each command at build time. It includes the 26 labels accepted under D-07 from the same ' +
        'model run, so it is not an independent measure.',
      breakpoints,
    },
    thresholds: { strong: RECOMMENDED_CONFIDENCE_FLOOR, possible: BEHAVIORAL_CHANNEL_FLOOR },
    shortlist_k: MAX_K,
    rows,
  };
}

function serialize(table) {
  return JSON.stringify(table, null, 2) + '\n';
}

function firstDiff(a, b, prefix) {
  prefix = prefix || '';
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = Array.from(new Set(Object.keys(a).concat(Object.keys(b))));
    for (const k of keys) {
      const d = firstDiff(a[k], b[k], prefix ? prefix + '.' + k : k);
      if (d) return d;
    }
  }
  return prefix || '(root)';
}

function main(argv) {
  const mode = argv[0] || '';
  if (!['', '--check', '--print-calibration'].includes(mode)) {
    process.stderr.write('usage: build-decision-advisor-table.cjs [--check | --print-calibration]\n');
    return 2;
  }
  let table;
  try {
    table = buildTable();
  } catch (e) {
    if (e && e.code === 'RECORDED_ABSENT') {
      process.stderr.write('decision-advisor-table: recorded input absent\n');
      process.stdout.write('recorded input absent\n');
      return 3;
    }
    process.stderr.write('decision-advisor-table: ' + (e && e.message ? e.message : String(e)) + '\n');
    return 1;
  }
  if (mode === '--print-calibration') {
    process.stdout.write(JSON.stringify(table.calibration.breakpoints) + '\n');
    return 0;
  }
  const text = serialize(table);
  if (mode === '--check') {
    let onDisk = '';
    try {
      onDisk = fs.readFileSync(TABLE_PATH, 'utf8');
    } catch (_e) {
      process.stdout.write('decision-advisor-table: DRIFT (file absent)\n');
      return 1;
    }
    if (onDisk === text) {
      process.stdout.write('decision-advisor-table: OK\n');
      return 0;
    }
    let where = '(unparseable)';
    try {
      where = firstDiff(JSON.parse(onDisk), table) || '(whitespace)';
    } catch (_e) {
      /* keep default */
    }
    process.stdout.write('decision-advisor-table: DRIFT at ' + where + '\n');
    return 1;
  }
  fs.writeFileSync(TABLE_PATH, text);
  process.stdout.write(
    'decision-advisor-table: wrote ' + Object.keys(table.rows).length + ' rows, ' + table.calibration.breakpoints.length + ' breakpoints\n'
  );
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { fitIsotonic, applyCalibration, buildTable, serialize, resolveDeprecated };
