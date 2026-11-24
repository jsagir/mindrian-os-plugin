#!/usr/bin/env node
'use strict';
// Phase 399-06: the calibrated shortlist table (legs B1 to B6) and the per-turn lookup (legs S1 to S6, Task 3).
// v0 job-only data: the rows are keyed <job>|*|* only.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const BUILDER = path.join(ROOT, 'scripts', 'build-decision-advisor-table.cjs');
const TABLE_FILE = path.join(ROOT, 'data', 'decision-advisor-table.json');
const B = require(BUILDER);

let failed = 0;
let passed = 0;
function check(label, fn) {
  try {
    fn();
    passed += 1;
    console.log('ok: ' + label);
  } catch (e) {
    failed += 1;
    console.log('FAIL: ' + label + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}

const table = JSON.parse(fs.readFileSync(TABLE_FILE, 'utf8'));
const scope = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'run-step-capabilities.json'), 'utf8'));
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'da-table-'));

check('B1 fitIsotonic pools violators; applyCalibration is a monotone step function', () => {
  const fit = B.fitIsotonic([[0.1, 0], [0.2, 1], [0.3, 0], [0.4, 1]]);
  assert.deepEqual(fit, [[0.1, 0], [0.2, 0.5], [0.4, 1]]);
  // Non-decreasing for arbitrary input (deterministic pseudo-random).
  let s = 7;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const pts = [];
  for (let i = 0; i < 300; i += 1) pts.push([Math.round(rnd() * 100) / 100, rnd() < 0.3 ? 1 : 0]);
  const f2 = B.fitIsotonic(pts);
  for (let i = 1; i < f2.length; i += 1) {
    assert.ok(f2[i][1] >= f2[i - 1][1], 'y decreases');
    assert.ok(f2[i][0] > f2[i - 1][0], 'x not increasing');
  }
  assert.equal(B.applyCalibration(fit, 0.05), 0);
  assert.equal(B.applyCalibration(fit, 0.1), 0);
  assert.equal(B.applyCalibration(fit, 0.25), 0.5);
  assert.equal(B.applyCalibration(fit, 0.39), 0.5);
  assert.equal(B.applyCalibration(fit, 0.9), 1);
  let prev = -1;
  for (let p = 0; p <= 1.0001; p += 0.01) {
    const v = B.applyCalibration(f2, p);
    assert.ok(v >= prev);
    prev = v;
  }
});

check('B2 buildTable is byte-identical twice; --check exits 0 and exits 1 after a registry label change', () => {
  assert.equal(B.serialize(B.buildTable()), B.serialize(B.buildTable()));
  const ok = spawnSync(process.execPath, [BUILDER, '--check'], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'command-registry.json'), 'utf8'));
  const target = reg.commands.find((c) => Array.isArray(c.serves_jtbd) && !c.serves_jtbd.includes('validate-idea'));
  target.serves_jtbd = target.serves_jtbd.concat(['validate-idea']);
  const regPath = path.join(scratch, 'registry.json');
  fs.writeFileSync(regPath, JSON.stringify(reg));
  const bad = spawnSync(process.execPath, [BUILDER, '--check'], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, { MINDRIAN_COMMAND_REGISTRY: regPath }),
  });
  assert.equal(bad.status, 1, bad.stdout + bad.stderr);
  assert.match(bad.stdout, /DRIFT at /);
});

check('B3 header fields and frozen thresholds', () => {
  const { RECOMMENDED_CONFIDENCE_FLOOR } = require(path.join(ROOT, 'lib', 'core', 'navigation-engine.cjs'));
  const { BEHAVIORAL_CHANNEL_FLOOR, MAX_K } = require(path.join(ROOT, 'lib', 'workflow', 'f-selector-ranker.cjs'));
  assert.equal(table.schema, 'mos.decision-advisor-table/1');
  assert.equal(table.table_version, '399-v0');
  assert.equal(table.data_scope, 'v0 job-only data');
  assert.match(table._note, /v0 job-only data/);
  assert.equal(table.provider, 'gemini');
  assert.equal(table.model, 'gemini-decision-1');
  assert.equal(table.question_template, 'serves_job_v1');
  assert.deepEqual(table.key_order, ['job', 'definition_level', 'last_command']);
  assert.equal(table.conditioned_rows, false);
  for (const k of ['recorded_sha256', 'registry_labels_sha256', 'scope_sha256']) {
    assert.match(table.built_from[k], /^[0-9a-f]{64}$/, k);
  }
  assert.match(table.built_from.recorded_at, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(table.calibration.method, 'isotonic-pav');
  assert.match(table.calibration.label_source, /serves_jtbd/);
  assert.match(table.calibration.label_source, /26 labels/);
  assert.match(table.calibration.label_source, /D-07/);
  assert.match(table.calibration.label_source, /not an independent measure/);
  assert.ok(Array.isArray(table.calibration.breakpoints) && table.calibration.breakpoints.length >= 2);
  assert.deepEqual(table.thresholds, { strong: RECOMMENDED_CONFIDENCE_FLOOR, possible: BEHAVIORAL_CHANNEL_FLOOR });
  assert.equal(table.thresholds.strong, 0.7);
  assert.equal(table.thresholds.possible, 0.5);
  assert.equal(table.shortlist_k, MAX_K);
  assert.equal(table.shortlist_k, 3);
});

check('B4 rows: 13 job-only keys, scope commands only, sorted, calibrated values only', () => {
  const keys = Object.keys(table.rows);
  assert.equal(keys.length, 13);
  const ys = new Set(table.calibration.breakpoints.map((b) => b[1]));
  const scopeSet = new Set(scope.commands);
  for (const k of keys) {
    assert.match(k, /^[a-z-]+\|\*\|\*$/);
    const row = table.rows[k];
    assert.ok(row.length > 0 && row.length <= table.row_depth);
    for (let i = 0; i < row.length; i += 1) {
      assert.ok(scopeSet.has(row[i].command), 'out of scope: ' + row[i].command);
      assert.ok(ys.has(row[i].calibrated), 'raw value in row: ' + row[i].calibrated);
      assert.deepEqual(Object.keys(row[i]).sort(), ['calibrated', 'command']);
      if (i > 0) {
        const a = row[i - 1];
        const b = row[i];
        assert.ok(a.calibrated > b.calibrated || (a.calibrated === b.calibrated && a.command < b.command), 'order');
      }
    }
  }
});

check('B5 no metric keys, no built_at', () => {
  const banned = /^(p|raw|auc|brier|ece|recall|accuracy|built_at)$/;
  (function walk(v) {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') {
      for (const k of Object.keys(v)) {
        assert.ok(!banned.test(k), 'banned key ' + k);
        walk(v[k]);
      }
    }
  })(table);
  assert.ok(!('built_at' in table.built_from));
});

check('B6 --check with the recorded input absent exits 3 and says so', () => {
  const r = spawnSync(process.execPath, [BUILDER, '--check'], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, { MINDRIAN_DECISION_RECORDED: path.join(scratch, 'missing.json') }),
  });
  assert.equal(r.status, 3);
  assert.match(r.stdout + r.stderr, /recorded input absent/);
});

// <lookup legs S1-S6 are appended below by Task 3>

fs.rmSync(scratch, { recursive: true, force: true });
console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
