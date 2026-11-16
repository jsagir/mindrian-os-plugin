#!/usr/bin/env node
'use strict';
// Phase 395-09: the selection measure (evals/selection). Plain Node script.
// Exit 0 when all checks pass, 1 when one fails. One line per check: "ok:" or "FAIL:".
//
// This test checks the MEASURE, not the selector: the case file is well formed, the options are built outside the
// selector, the scorer runs on a fixture room and is stable, and the judge leg sends nothing without its flags.
// It does NOT check the pass bar. The scorer measures; it is not a gate.
// No network. The judge is started with no flag and with --dry-run only.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const H = require('./helpers/isolated-home-36925.cjs');
const DIR = path.join(ROOT, 'evals', 'selection');
const FILES = ['cases.json', 'score.cjs', 'judge.cjs', 'README.md'].map((f) => path.join(DIR, f)).concat([__filename]);

let failed = 0;
function check(name, fn) {
  try {
    fn();
    console.log('ok: ' + name);
  } catch (e) {
    failed += 1;
    console.log('FAIL: ' + name + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}

const strip = (n) => String(n).replace(/^\/mos:/, '');

function main() {
  const doc = JSON.parse(fs.readFileSync(path.join(DIR, 'cases.json'), 'utf8'));
  const cases = Array.isArray(doc.cases) ? doc.cases : [];
  const vocabulary = require(path.join(ROOT, 'lib', 'core', 'section-registry.cjs')).JOB_VOCABULARY;
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'command-registry.json'), 'utf8')).commands
    .filter((c) => c && typeof c.command === 'string').map((c) => strip(c.command));
  const cap = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'capability.cjs')).capabilityFor;
  const runnable = (name, surface) => { const k = cap(name, { kind: 'command' }); return !!k && k.known !== false && k[surface] === 'runnable'; };

  // ---- A. the case file ----
  check('A1. the file says who wrote the labels: a model, not reviewed by the owner, synthetic content', () => {
    assert.strictEqual(doc.schema, 'mos.selection-cases/1');
    assert.strictEqual(doc.label_origin, 'model');
    assert.strictEqual(doc.owner_reviewed, false);
    assert.strictEqual(doc.synthetic, true);
    assert.ok(typeof doc.note === 'string' && doc.note.indexOf('written by a model') !== -1, 'the note names the author');
  });

  check('A2. at least 24 cases, unique ids, and every job id of the vocabulary has a case', () => {
    assert.ok(cases.length >= 24, 'cases: ' + cases.length);
    assert.strictEqual(new Set(cases.map((c) => c.id)).size, cases.length, 'ids are unique');
    assert.strictEqual(vocabulary.length, 20, 'the vocabulary holds 20 job ids');
    const covered = new Set(cases.map((c) => c.job_id));
    assert.deepStrictEqual(vocabulary.filter((j) => !covered.has(j)), [], 'jobs with no case');
  });

  check('A3. every job id is in the vocabulary, and job_id is the goal job or else the section job', () => {
    cases.forEach((c) => {
      const s = c.state;
      assert.ok(vocabulary.indexOf(c.job_id) !== -1, c.id + ': job_id ' + c.job_id);
      assert.ok(s.section_job === null || vocabulary.indexOf(s.section_job) !== -1, c.id + ': section_job ' + s.section_job);
      assert.ok(s.goal_job === null || vocabulary.indexOf(s.goal_job) !== -1, c.id + ': goal_job ' + s.goal_job);
      assert.strictEqual(c.job_id, s.goal_job || s.section_job, c.id + ': job_id is the goal job or the section job');
      assert.ok(c.surface === 'mcp' || c.surface === 'cli', c.id + ': surface');
      assert.ok(s.section_kind === 'core' || s.section_kind === 'custom', c.id + ': section_kind');
      assert.ok(/^[a-z0-9-]+$/.test(s.section), c.id + ': section slug');
      assert.ok(['undefined', 'ill-defined', 'well-defined'].indexOf(s.definition) !== -1, c.id + ': definition');
      assert.ok(['simple', 'complicated', 'complex', 'wicked'].indexOf(s.complexity) !== -1, c.id + ': complexity');
      assert.ok(['high', 'medium', 'low'].indexOf(c.label_confidence) !== -1, c.id + ': label_confidence');
      assert.ok(s.holds && typeof s.holds.summary === 'string' && s.holds.summary.length >= 10, c.id + ': holds.summary');
      assert.ok(Number.isInteger(s.holds.open_counterevidence) && Number.isInteger(s.holds.open_assumptions), c.id + ': holds counts');
    });
  });

  check('A4. every command of a case is in the registry or is marked absent; each has a reason; the lists do not overlap', () => {
    cases.forEach((c) => {
      const e = c.expected;
      const seen = new Set();
      ['right', 'acceptable', 'wrong', 'not_runnable_right'].forEach((k) => {
        assert.ok(Array.isArray(e[k]), c.id + ': ' + k + ' is a list');
        e[k].forEach((x) => {
          assert.ok(registry.indexOf(x.command) !== -1, c.id + ': ' + k + ' names ' + x.command + ', which is not in the registry');
          assert.ok(typeof x.reason === 'string' && x.reason.length >= 10, c.id + ': ' + x.command + ' has a reason');
          assert.ok(!seen.has(x.command), c.id + ': ' + x.command + ' is in two lists');
          seen.add(x.command);
        });
      });
      assert.ok(Array.isArray(e.absent), c.id + ': absent is a list');
      e.absent.forEach((x) => {
        assert.ok(typeof x.method === 'string' && x.method.length > 0 && x.command === undefined, c.id + ': an absent entry names a method, not a command');
        assert.ok(registry.indexOf(x.method) === -1, c.id + ': the absent method ' + x.method + ' is a command of the registry');
        assert.ok(typeof x.reason === 'string' && x.reason.length >= 10, c.id + ': the absent method has a reason');
      });
    });
  });

  check('A5. a right or acceptable command runs on the surface of the case; a not_runnable_right command does not', () => {
    cases.forEach((c) => {
      c.expected.right.concat(c.expected.acceptable).forEach((x) => assert.ok(runnable(x.command, c.surface), c.id + ': ' + x.command + ' does not run on ' + c.surface));
      c.expected.not_runnable_right.forEach((x) => assert.ok(!runnable(x.command, c.surface), c.id + ': ' + x.command + ' runs on ' + c.surface));
    });
  });

  check('A6. none_of_these is true exactly when the right list is empty; at least 3 such cases; each names a wrong command', () => {
    cases.forEach((c) => assert.strictEqual(c.expected.none_of_these, c.expected.right.length === 0, c.id));
    const none = cases.filter((c) => c.expected.none_of_these === true);
    assert.ok(none.length >= 3, 'none of these cases: ' + none.length);
    cases.forEach((c) => assert.ok(c.expected.wrong.length >= 1, c.id + ': at least 1 wrong command'));
  });

  check('A7. no em dash and no en dash in the files of this plan', () => {
    assert.deepStrictEqual(H.dashGuard(FILES), []);
  });

  // ---- B. options built outside the selector ----
  const score = require(path.join(DIR, 'score.cjs'));
  check('B1. the option list of a surface is every runnable command of the registry plus "none of these"', () => {
    ['mcp', 'cli'].forEach((s) => {
      const want = registry.filter((n) => runnable(n, s)).sort().concat([score.NONE]);
      assert.deepStrictEqual(score.optionsFor(s), want, s);
      assert.ok(want.length > 20, s + ': more than 20 options, so the list is not the shortlist of the selector: ' + want.length);
    });
  });

  check('B2. the pass bar in the scorer is the bar of the plan', () => {
    assert.deepStrictEqual(Object.assign({}, score.BAR), { right_min: 0.7, wrong_max: 0, right_or_acceptable_min: 0.85, none_named_max: 0 });
  });

  // ---- C. the scorer runs the real selector and is stable ----
  const first = score.runScore({ head: 'test' });
  const second = score.runScore({ head: 'test' });
  check('C1. two runs on one tree give the same bytes', () => {
    assert.strictEqual(JSON.stringify(second), JSON.stringify(first));
    assert.strictEqual(score.toMarkdown(second), score.toMarkdown(first));
  });

  check('C2. every case has an outcome, the fixture matched the case, and the pool check held', () => {
    assert.strictEqual(first.cases.length, cases.length);
    const known = ['right', 'acceptable', 'wrong', 'other', 'no_primary', 'none_correct', 'none_named_acceptable', 'none_named_wrong', 'none_named_other'];
    first.cases.forEach((r) => {
      assert.ok(known.indexOf(r.outcome) !== -1, r.id + ': outcome ' + r.outcome);
      assert.strictEqual(r.fixture_ok, true, r.id + ': the fixture did not match the case');
      assert.deepStrictEqual(r.pool_rebuild_mismatch, [], r.id + ': the selector named a command that is not in the pool the scorer built; add the new pool source to rebuildPool in evals/selection/score.cjs');
      if (r.primary !== null) assert.strictEqual(r.primary_is_option, true, r.id + ': the primary is not in the option list');
    });
  });

  check('C3. the counts add up', () => {
    const s = first.summary;
    assert.strictEqual(s.cases, cases.length);
    assert.strictEqual(s.cases_with_a_right_command + s.cases_none_of_these, s.cases);
    assert.strictEqual(s.primary_right + s.primary_acceptable + s.primary_wrong + s.primary_other + s.no_primary, s.cases_with_a_right_command);
    assert.strictEqual(s.none_correct + s.none_named_acceptable + s.none_named_wrong + s.none_named_other, s.cases_none_of_these);
    assert.strictEqual(s.limit_pool + s.limit_order, s.cases_with_a_right_command - s.primary_right);
    assert.strictEqual(typeof first.bar.pass, 'boolean');
  });

  check('C4. the output holds no time and no temporary path', () => {
    const text = JSON.stringify(first) + score.toMarkdown(first);
    assert.ok(text.indexOf(require('node:os').tmpdir()) === -1, 'a temporary path is in the output');
    assert.ok(!/20\d\d-\d\d-\d\dT\d\d:/.test(text), 'a time is in the output');
  });

  check('C5. the scorer file opens no connection', () => {
    const src = fs.readFileSync(path.join(DIR, 'score.cjs'), 'utf8');
    ['fetch(', 'node:http', 'node:https', 'node:net', 'child_process'].forEach((t) => assert.ok(src.indexOf(t) === -1, 'score.cjs holds ' + t));
  });

  // ---- D. the judge leg is off ----
  const env = Object.assign({}, process.env);
  delete env.MINDRIAN_DECISION_KEY_FILE;
  const judge = (args) => spawnSync(process.execPath, [path.join(DIR, 'judge.cjs')].concat(args), { env, encoding: 'utf8', input: '', timeout: 60000 });

  check('D1. the judge with no flag exits with code 2', () => {
    const r = judge([]);
    assert.strictEqual(r.status, 2, 'status ' + r.status);
    assert.ok(r.stderr.indexOf('sends nothing without an explicit flag') !== -1, r.stderr);
    assert.strictEqual(r.stdout, '');
  });

  check('D2. --send alone, and --send with no key file, exit with code 2', () => {
    const a = judge(['--send']);
    assert.strictEqual(a.status, 2, 'status ' + a.status);
    assert.ok(a.stderr.indexOf('--i-read-the-dry-run') !== -1, a.stderr);
    const out = path.join(require('node:os').tmpdir(), 'test-395-measure-judge-' + process.pid + '.json');
    const b = judge(['--send', '--i-read-the-dry-run', '--out', out]);
    assert.strictEqual(b.status, 2, 'status ' + b.status);
    assert.ok(b.stderr.indexOf('no key') !== -1, b.stderr);
    assert.ok(!fs.existsSync(out), 'no result file is written');
  });

  check('D3. --dry-run prints every case and the labels are not in it', () => {
    const r = judge(['--dry-run']);
    assert.strictEqual(r.status, 0, 'status ' + r.status + ' ' + r.stderr);
    assert.ok(r.stdout.indexOf('DRY RUN. Nothing is sent. No key is read.') === 0, r.stdout.slice(0, 80));
    cases.forEach((c) => assert.ok(r.stdout.indexOf('[' + c.id + ', ' + c.surface + ']') !== -1, c.id + ' is in the dry run'));
    assert.ok(r.stdout.indexOf('none_of_these: ') !== -1, 'the option none_of_these is listed');
    cases.forEach((c) => c.expected.right.concat(c.expected.wrong).forEach((x) => assert.ok(r.stdout.indexOf(x.reason) === -1, c.id + ': a label reason is in the dry run')));
  });

  check('D4. the judge reads the key from a file named by an environment variable and never prints it', () => {
    const src = fs.readFileSync(path.join(DIR, 'judge.cjs'), 'utf8');
    assert.ok(src.indexOf("KEY_FILE_ENV = 'MINDRIAN_DECISION_KEY_FILE'") !== -1);
    assert.ok(!/AIza[0-9A-Za-z_-]{10,}/.test(src), 'a key-shaped text is in judge.cjs');
    // A line that writes output must not pass the variable `key` to the write (string literals are removed first).
    const printed = src.split('\n').filter((l) => /(stdout|stderr)\.write|writeFileSync|console\./.test(l) && /[+,(]\s*key\s*[+,)]/.test(l.replace(/'[^']*'/g, '')));
    assert.deepStrictEqual(printed, [], 'a line writes the key');
    assert.strictEqual((src.match(/headers\['x-goog-api-key'\] = key/g) || []).length, 1, 'the key is used in 1 request header');
  });
}

try {
  main();
} catch (e) {
  failed += 1;
  console.log('FAIL: the test did not run to its end -- ' + (e && e.stack ? e.stack : String(e)));
}
if (failed > 0) {
  console.log('FAILED: ' + failed + ' check(s)');
  process.exit(1);
}
console.log('PASSED: all checks');
process.exit(0);
