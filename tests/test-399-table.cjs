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

// ---- Lookup legs S1 to S7 (Task 3) ----
const SHORTLIST = path.join(ROOT, 'lib', 'core', 'decision-advisor', 'shortlist.cjs');
const S = require(SHORTLIST);
const ENV_KEYS = ['MINDRIAN_DECISION_ADVISOR', 'MINDRIAN_DECISION_ADVISOR_TABLE'];
function withEnv(env, fn) {
  const saved = {};
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, env);
  try {
    return fn();
  } finally {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}
function writeFixtureTable(name, rows, extra) {
  const t = Object.assign(
    {
      schema: 'mos.decision-advisor-table/1',
      table_version: 'fixture',
      key_order: ['job', 'definition_level', 'last_command'],
      conditioned_rows: true,
      thresholds: { strong: 0.7, possible: 0.5 },
      shortlist_k: 3,
      rows,
    },
    extra || {}
  );
  const f = path.join(scratch2, name);
  fs.writeFileSync(f, JSON.stringify(t));
  return f;
}
const scratch2 = fs.mkdtempSync(path.join(os.tmpdir(), 'da-short-'));

check('S1 shipped table lookup: ranked, banded, k clamp, no_strong_pick state', () => {
  withEnv({}, () => {
    const jobs = Object.keys(table.rows).map((k) => k.split('|')[0]);
    let sawOk = false;
    for (const job of jobs) {
      const r = S.lookupShortlist({ jobId: job });
      assert.equal(r.key_used, job + '|*|*');
      assert.equal(r.table_version, '399-v0');
      assert.ok(r.options.length >= 1 && r.options.length <= 3);
      r.options.forEach((o, i) => {
        assert.equal(o.rank, i + 1);
        const want = o.calibrated >= 0.7 ? 'strong' : o.calibrated >= 0.5 ? 'possible' : 'weak';
        assert.equal(o.band, want);
        assert.deepEqual(Object.keys(o).sort(), ['band', 'calibrated', 'command', 'rank']);
      });
      const anyStrong = r.options.some((o) => o.band === 'strong');
      assert.equal(r.no_strong_pick, !anyStrong);
      assert.equal(r.state, anyStrong ? 'ok' : 'no_strong_pick');
      if (anyStrong) sawOk = true;
    }
    assert.ok(sawOk, 'no job in the shipped table has a strong option');
    assert.equal(S.lookupShortlist({ jobId: 'validate-idea', k: 1 }).options.length, 1);
    assert.equal(S.lookupShortlist({ jobId: 'validate-idea', k: 9 }).options.length, 3);
  });
  const f = writeFixtureTable('weak.json', {
    'explore|*|*': [
      { command: '/mos:a', calibrated: 0.4 },
      { command: '/mos:b', calibrated: 0.2 },
    ],
  });
  withEnv({ MINDRIAN_DECISION_ADVISOR_TABLE: f }, () => {
    const r = S.lookupShortlist({ jobId: 'explore' });
    assert.equal(r.state, 'no_strong_pick');
    assert.equal(r.no_strong_pick, true);
    assert.deepEqual(r.options.map((o) => o.band), ['weak', 'weak']);
  });
});

check('S2 fallback order: exact, job|level|*, job|*|last, job|*|*', () => {
  const rows = {
    'validate-idea|ill-defined|/mos:mullins': [{ command: '/mos:x1', calibrated: 0.9 }],
    'validate-idea|ill-defined|*': [{ command: '/mos:x2', calibrated: 0.9 }],
    'validate-idea|*|/mos:mullins': [{ command: '/mos:x3', calibrated: 0.9 }],
    'validate-idea|*|*': [{ command: '/mos:x4', calibrated: 0.9 }],
  };
  const f = writeFixtureTable('full.json', rows);
  withEnv({ MINDRIAN_DECISION_ADVISOR_TABLE: f }, () => {
    const q = { jobId: 'validate-idea', definitionLevel: 'ill-defined', lastCommand: '/mos:mullins' };
    let r = S.lookupShortlist(q);
    assert.equal(r.key_used, 'validate-idea|ill-defined|/mos:mullins');
    assert.equal(r.options[0].command, '/mos:x1');
    r = S.lookupShortlist({ jobId: 'validate-idea', definitionLevel: 'ill-defined', lastCommand: '/mos:other' });
    assert.equal(r.key_used, 'validate-idea|ill-defined|*');
    r = S.lookupShortlist({ jobId: 'validate-idea', definitionLevel: 'well-defined', lastCommand: '/mos:mullins' });
    assert.equal(r.key_used, 'validate-idea|*|/mos:mullins');
    r = S.lookupShortlist({ jobId: 'validate-idea', definitionLevel: 'well-defined', lastCommand: '/mos:other' });
    assert.equal(r.key_used, 'validate-idea|*|*');
    // An unknown level word is treated as null.
    r = S.lookupShortlist({ jobId: 'validate-idea', definitionLevel: 'nonsense' });
    assert.equal(r.key_used, 'validate-idea|*|*');
    assert.equal(S.scoreFor({ jobId: 'validate-idea', definitionLevel: 'ill-defined', lastCommand: '/mos:mullins' }, '/mos:x1'), 0.9);
  });
});

check('S3 lastCommand and exclude are removed before the top k is taken', () => {
  const f = writeFixtureTable('excl.json', {
    'build|*|*': [
      { command: '/mos:a', calibrated: 0.95 },
      { command: '/mos:b', calibrated: 0.9 },
      { command: '/mos:c', calibrated: 0.85 },
      { command: '/mos:d', calibrated: 0.6 },
      { command: '/mos:e', calibrated: 0.1 },
    ],
  });
  withEnv({ MINDRIAN_DECISION_ADVISOR_TABLE: f }, () => {
    const r = S.lookupShortlist({ jobId: 'build', lastCommand: '/mos:a', exclude: ['/mos:c'] });
    assert.deepEqual(r.options.map((o) => o.command), ['/mos:b', '/mos:d', '/mos:e']);
    assert.deepEqual(r.options.map((o) => o.rank), [1, 2, 3]);
    assert.deepEqual(r.options.map((o) => o.band), ['strong', 'possible', 'weak']);
  });
});

check('S4 state words never throw: no_job, no_row, no_table, off', () => {
  withEnv({}, () => {
    for (const q of [undefined, null, {}, { jobId: '' }, { jobId: 42 }]) {
      const r = S.lookupShortlist(q);
      assert.equal(r.state, 'no_job');
      assert.deepEqual(r.options, []);
    }
    const r = S.lookupShortlist({ jobId: 'job-with-no-row' });
    assert.equal(r.state, 'no_row');
    assert.deepEqual(r.options, []);
  });
  withEnv({ MINDRIAN_DECISION_ADVISOR_TABLE: path.join(scratch2, 'absent.json') }, () => {
    const r = S.lookupShortlist({ jobId: 'validate-idea' });
    assert.equal(r.state, 'no_table');
    assert.deepEqual(r.options, []);
    assert.equal(S.tableMeta(), null);
  });
  const bad = path.join(scratch2, 'bad.json');
  fs.writeFileSync(bad, '{ not json');
  withEnv({ MINDRIAN_DECISION_ADVISOR_TABLE: bad }, () => {
    assert.equal(S.lookupShortlist({ jobId: 'validate-idea' }).state, 'no_table');
  });
  const odd = path.join(scratch2, 'odd.json');
  fs.writeFileSync(odd, JSON.stringify({ rows: [] }));
  withEnv({ MINDRIAN_DECISION_ADVISOR_TABLE: odd }, () => {
    assert.equal(S.lookupShortlist({ jobId: 'validate-idea' }).state, 'no_table');
  });
  withEnv({ MINDRIAN_DECISION_ADVISOR: 'off' }, () => {
    const r = S.lookupShortlist({ jobId: 'validate-idea' });
    assert.equal(r.state, 'off');
    assert.deepEqual(r.options, []);
    assert.equal(S.advisorEnabled(), false);
  });
  assert.deepEqual(Object.keys(S.STATES).sort(), ['no_job', 'no_row', 'no_strong_pick', 'no_table', 'off', 'ok']);
  assert.ok(Object.isFrozen(S.STATES));
});

check('S5 scoreFor, bandFor, tableMeta', () => {
  withEnv({}, () => {
    const top = table.rows['validate-idea|*|*'][0];
    assert.equal(S.scoreFor({ jobId: 'validate-idea' }, top.command), top.calibrated);
    assert.equal(S.scoreFor({ jobId: 'validate-idea' }, '/mos:not-there'), null);
    assert.equal(S.scoreFor({ jobId: 'no-such-job' }, top.command), null);
    const th = { strong: 0.7, possible: 0.5 };
    assert.equal(S.bandFor(0.7, th), 'strong');
    assert.equal(S.bandFor(0.699, th), 'possible');
    assert.equal(S.bandFor(0.5, th), 'possible');
    assert.equal(S.bandFor(0.499, th), 'weak');
    const m = S.tableMeta();
    assert.equal(m.version, '399-v0');
    assert.deepEqual(m.key_order, ['job', 'definition_level', 'last_command']);
    assert.deepEqual(m.thresholds, { strong: 0.7, possible: 0.5 });
    assert.equal(m.shortlist_k, 3);
    assert.equal(m.conditioned_rows, false);
  });
});

check('S6 source requires only node:fs and node:path; cold require plus one lookup is fast', () => {
  const src = fs.readFileSync(SHORTLIST, 'utf8');
  const reqs = Array.from(src.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)).map((m) => m[1]).sort();
  assert.deepEqual(reqs, ['node:fs', 'node:path']);
  assert.ok(!/\bimport\s*\(|\bfetch\s*\(/.test(src));
  const code =
    "const t=process.hrtime.bigint();const s=require(" + JSON.stringify(SHORTLIST) + ");" +
    "const r=s.lookupShortlist({jobId:'validate-idea'});" +
    "console.log(Number(process.hrtime.bigint()-t)/1e6+'|'+r.state);";
  const r = spawnSync(process.execPath, ['-e', code], { encoding: 'utf8', env: Object.assign({}, process.env, { MINDRIAN_DECISION_ADVISOR: '' }) });
  assert.equal(r.status, 0, r.stderr);
  const [ms, state] = r.stdout.trim().split('|');
  assert.equal(state, 'ok');
  console.log('S6 measured cold require plus one lookup: ' + Number(ms).toFixed(1) + ' ms (hook budget 200 ms)');
  assert.ok(Number(ms) < 200, 'too slow: ' + ms);
});

check('S7 the frozen level copy equals problem-axes DEFINITION_LEVELS', () => {
  const axes = require(path.join(ROOT, 'lib', 'core', 'problem-axes.cjs'));
  assert.deepEqual([...S.DEFINITION_LEVELS], [...axes.DEFINITION_LEVELS]);
  assert.ok(Object.isFrozen(S.DEFINITION_LEVELS));
});

fs.rmSync(scratch2, { recursive: true, force: true });

fs.rmSync(scratch, { recursive: true, force: true });
console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
