#!/usr/bin/env node
'use strict';

/**
 * Phase 386 plan 34 (E-TEST): mutation proof for the Part 8 verdict tests.
 *
 * A test that asserts only "not allow" cannot tell block from ambiguous, and
 * ambiguous is sent on some routes. This proof runs each of 5 test files with no
 * preload (M0: must exit 0) and once per verdict mutation (the preload
 * tests/helpers/part8-verdict-mutation-386.cjs, MUTATE_MODE) and requires a
 * non-zero exit in every mode that the RCA table names for that file
 * (.planning/debug/part8-tests-assert-not-allow-only.md).
 *
 * The preload is passed as --require and also through NODE_OPTIONS, so a child
 * process that a test file spawns (the hook script) is mutated too. The preload
 * wraps the guard export through Module._load; no module on disk is edited.
 *
 * Node built-ins only. No network. No em dash, no en dash.
 */

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const PRELOAD = path.join(__dirname, 'helpers', 'part8-verdict-mutation-386.cjs');
const MODES = ['block-to-ambiguous', 'ambiguous-to-allow', 'allow-to-ambiguous', 'ambiguous-to-block'];

// file -> the modes that must make it fail (RCA table "Which files must fail in which mode").
const TABLE = [
  { file: 'tests/test-gct-process-step-id-parity.cjs', mustFail: ['ambiguous-to-allow', 'allow-to-ambiguous', 'ambiguous-to-block'] },
  { file: 'tests/test-361-egress-shapes.cjs', mustFail: ['ambiguous-to-allow', 'allow-to-ambiguous', 'ambiguous-to-block'] },
  { file: 'tests/test-354-taxonomy-ladder-casing.cjs', mustFail: ['ambiguous-to-allow', 'allow-to-ambiguous', 'ambiguous-to-block'] },
  { file: 'tests/test-354-egress-typed-question.cjs', mustFail: ['block-to-ambiguous', 'allow-to-ambiguous'] },
  { file: 'tests/test-254-ambiguous-disclosure.cjs', mustFail: ['block-to-ambiguous', 'ambiguous-to-allow', 'allow-to-ambiguous', 'ambiguous-to-block'] },
];

function run(file, mode) {
  const env = Object.assign({}, process.env);
  delete env.MUTATE_MODE;
  delete env.NODE_OPTIONS;
  const args = [];
  if (mode) {
    env.MUTATE_MODE = mode;
    env.NODE_OPTIONS = '--require ' + PRELOAD;
    args.push('--require', PRELOAD);
  }
  args.push(path.join(REPO, file));
  const r = spawnSync(process.execPath, args, { cwd: REPO, env: env, encoding: 'utf8', timeout: 240000 });
  return { status: r.status, signal: r.signal, out: (r.stdout || '') + (r.stderr || '') };
}

let failed = 0;
function line(ok, label, detail) {
  if (!ok) failed += 1;
  process.stdout.write((ok ? 'ok - ' : 'FAIL - ') + label + (detail ? ' :: ' + detail : '') + '\n');
}

TABLE.forEach(function (row) {
  const base = run(row.file, null);
  line(base.status === 0, 'M0 ' + row.file + ' passes with no preload', base.status === 0 ? '' : 'exit ' + base.status);
  MODES.forEach(function (mode) {
    const r = run(row.file, mode);
    const mustFail = row.mustFail.indexOf(mode) !== -1;
    if (mustFail) {
      line(r.status !== 0 && r.status !== null, mode + ' ' + row.file + ' must fail under the mutation', r.status === 0 ? 'SURVIVED (exit 0)' : 'exit ' + r.status);
    } else {
      process.stdout.write('skip - ' + mode + ' ' + row.file + ' (no case of the source verdict; exit ' + r.status + ')\n');
    }
  });
});

process.exit(failed === 0 ? 0 : 1);
