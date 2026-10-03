#!/usr/bin/env node
'use strict';

/**
 * Phase 369-18 (BAKE369-03) -- the bake-off measurement harness
 * (ui/bakeoff/measure.cjs): scoring helpers on small temp fixtures, the slice
 * parity parser, and the results.json schema.
 *
 * Scoring arms (always): retainedLines on a two-file snapshot with one edited
 * file; countForbiddenIo flags require('fs') and child_process and ignores
 * comments; diffStorage; convergence with a missing sample; packagingSummary
 * counts nested files and traced node_modules; parseSliceActions.
 *
 * Schema arm: when ui/bakeoff/results.json exists, both candidates are present
 * and each of the nine measures plus the two extras is an object whose `value`
 * is a number or a boolean, or null with a written `not_measured` reason.
 * Exit 77 (reported as such) only when results.json is absent and every
 * scoring arm passed.
 *
 * Hermetic: temp dirs only, no network. No literal em-dash or en-dash in this
 * file (the characters are built at run time). CJS.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const REPO_ROOT = path.resolve(__dirname, '..');
const M = require(path.join(REPO_ROOT, 'ui', 'bakeoff', 'measure.cjs'));
const RESULTS = path.join(REPO_ROOT, 'ui', 'bakeoff', 'results.json');

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('  ok ' + name);
  } catch (err) {
    failed += 1;
    console.log('  FAIL ' + name);
    console.log('    ' + (err && err.message ? err.message : String(err)));
  }
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-369-18-test-'));
function put(rel, text) {
  const abs = path.join(TMP, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
  return abs;
}
function sha(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

console.log('test-369-bakeoff-measure');

test('retainedLines: a two-file snapshot with one edited file keeps only the untouched file', () => {
  const a = 'line one\nline two\nline three\n';
  const b = 'alpha\nbeta\n';
  const snapshot = {
    total_lines: 5,
    files: [
      { path: 'a.ts', lines: 3, sha256: sha(a) },
      { path: 'b.ts', lines: 2, sha256: sha(b) },
    ],
  };
  put('app1/a.ts', a);
  put('app1/b.ts', b + 'an added line\n'); // edited
  const r = M.retainedLines(snapshot, path.join(TMP, 'app1'));
  assert.equal(r.retained_lines, 3);
  assert.equal(r.retained_lines_same_path, 3);
  assert.equal(r.total_lines, 5);
  assert.equal(Number(r.share.toFixed(2)), 0.6);
  assert.deepEqual(r.retained_files, ['a.ts']);
});

test('retainedLines: a transplanted file (same bytes, new path) counts by content, not by path; node_modules is ignored', () => {
  const a = 'export const a = 1;\n';
  const snapshot = { total_lines: 1, files: [{ path: 'src/a.ts', lines: 1, sha256: sha(a) }] };
  put('app2/lib/moved-a.ts', a);
  put('app2/node_modules/pkg/a.ts', a);
  const r = M.retainedLines(snapshot, path.join(TMP, 'app2'));
  assert.equal(r.retained_lines, 1);
  assert.equal(r.retained_lines_same_path, 0);
  const none = M.retainedLines(snapshot, put('app3/readme.md', 'x\n') && path.join(TMP, 'app3'));
  assert.equal(none.retained_lines, 0);
});

test('countForbiddenIo: flags require(fs), node:fs imports and child_process; ignores comments and strings in comments', () => {
  const f1 = put(
    'io/a.ts',
    [
      "const fs = require('fs');",
      "import { readFileSync } from 'node:fs';",
      "import cp from 'node:child_process';",
      'execFileSync("ls");',
      '',
    ].join('\n')
  );
  const f2 = put(
    'io/b.ts',
    [
      "// const fs = require('fs');",
      '/* import cp from "child_process";',
      "   execFile('x') */",
      "const note = 'we do not use fs here';",
      "export const ok = 1; // require('child_process') in a comment",
      '',
    ].join('\n')
  );
  const r1 = M.countForbiddenIo([f1]);
  assert.equal(r1.count, 4, JSON.stringify(r1.hits));
  const r2 = M.countForbiddenIo([f2]);
  assert.equal(r2.count, 0, JSON.stringify(r2.hits));
  assert.equal(M.countForbiddenIo([f1, f2, path.join(TMP, 'io', 'missing.ts')]).count, 4);
  assert.equal(r1.hits[0].line, 1);
});

test('diffStorage: reports what was added and removed per kind and a total of added items', () => {
  const before = { cookies: ['a'], localStorage: [], sessionStorage: [], indexedDB: [], files: ['x', 'y'] };
  const after = { cookies: ['a', 'mos_sid'], localStorage: ['theme'], sessionStorage: [], indexedDB: ['rxdb-dexie-nodes'], files: ['x', 'z'] };
  const d = M.diffStorage(before, after);
  assert.deepEqual(d.added.cookies, ['mos_sid']);
  assert.deepEqual(d.added.localStorage, ['theme']);
  assert.deepEqual(d.added.indexedDB, ['rxdb-dexie-nodes']);
  assert.deepEqual(d.added.files, ['z']);
  assert.deepEqual(d.removed.files, ['y']);
  assert.equal(d.count, 4);
  assert.equal(M.diffStorage({}, {}).count, 0);
});

test('convergence: all expected seen gives the first time; a missing sample leaves a count missing', () => {
  const ok = M.convergence([{ ms: 100, seen: 2 }, { ms: 300, seen: 6 }, { ms: 200, seen: 4 }], 6);
  assert.equal(ok.converged, true);
  assert.equal(ok.ms, 300);
  assert.equal(ok.missing, 0);
  const short = M.convergence([{ ms: 100, seen: 2 }, { ms: 500, seen: 4 }], 6);
  assert.equal(short.converged, false);
  assert.equal(short.ms, null);
  assert.equal(short.missing, 2);
  const empty = M.convergence([], 6);
  assert.equal(empty.converged, false);
  assert.equal(empty.missing, 6);
});

test('packagingSummary: counts nested files, directories, bytes, traced node_modules and package names', () => {
  put('out/server.js', '1234567890');
  put('out/.next/static/a/b/c.js', 'abc');
  put('out/node_modules/next/index.js', 'x');
  put('out/node_modules/@scope/pkg/lib/z.js', 'yy');
  put('out/node_modules/next/node_modules/inner/i.js', 'z');
  const s = M.packagingSummary(path.join(TMP, 'out'));
  assert.equal(s.files, 5);
  assert.equal(s.node_modules_files, 3);
  assert.equal(s.has_node_modules, true);
  assert.deepEqual(s.node_modules_packages, ['@scope/pkg', 'inner', 'next']);
  assert.ok(s.dirs >= 8, 'dirs: ' + s.dirs);
  assert.equal(s.bytes, 10 + 3 + 1 + 2 + 1);
  put('clean/server.mjs', 'x');
  const c = M.packagingSummary(path.join(TMP, 'clean'));
  assert.equal(c.has_node_modules, false);
  assert.equal(c.files, 1);
});

test('parseSliceActions: reads name and exposure in both quote styles; the shipped candidates match the six-action map', () => {
  const m = M.parseSliceActions("defineShellAction({\n name: 'listRooms',\n exposure: 'both',\n}) defineShellAction({ name: \"openRoom\", exposure: \"human\" })");
  assert.deepEqual(m, { listRooms: 'both', openRoom: 'human' });
  for (const rel of [
    ['ui', 'bakeoff', 'workroom', 'overlay', 'src', 'server', 'slice-actions.ts'],
    ['ui', 'bakeoff', 'agent-native', 'overlay', 'server', 'lib', 'slice-actions.ts'],
  ]) {
    const f = path.join(REPO_ROOT, ...rel);
    const got = M.parseSliceActions(fs.readFileSync(f, 'utf8'));
    assert.deepEqual(got, M.EXPECTED_ACTIONS, rel.join('/'));
  }
});

test('the harness file and this test carry no literal long dash', () => {
  for (const f of [path.join(REPO_ROOT, 'ui', 'bakeoff', 'measure.cjs'), __filename, path.join(REPO_ROOT, 'ui', 'bakeoff', 'README.md')]) {
    if (!fs.existsSync(f)) continue;
    const src = fs.readFileSync(f, 'utf8');
    assert.ok(!src.includes(EM) && !src.includes(EN), f + ' has a long dash');
  }
});

// ------------------------------------------------------------------ schema arm

const NINE = [
  'architecture_distorted',
  'workroom_code_surviving',
  'selected_state_reaches_claude',
  'persistent_state',
  'reconnect',
  'startup_errors',
  'dependency_removal',
  'direct_file_write_replacement',
  'packaging',
];
const EXTRAS = ['gate_click_to_view_ms', 'csp_style_src_self'];

let schemaSkipped = false;
if (!fs.existsSync(RESULTS)) {
  schemaSkipped = true;
  console.log('  schema arm: ui/bakeoff/results.json is absent (run node ui/bakeoff/measure.cjs --candidate both)');
} else {
  const r = JSON.parse(fs.readFileSync(RESULTS, 'utf8'));
  for (const c of ['workroom', 'agent-native']) {
    test('results.json: ' + c + ' has the nine measures and the two extras with a number, a boolean, or a written reason', () => {
      assert.ok(r[c] && typeof r[c] === 'object', c + ' missing');
      for (const k of NINE.concat(EXTRAS)) {
        const m = r[c][k];
        assert.ok(m && typeof m === 'object', c + '.' + k + ' missing');
        assert.ok(typeof m.method === 'string' || typeof m.not_measured === 'string', c + '.' + k + ' states no method or reason');
        const v = m.value;
        const okValue = typeof v === 'number' || typeof v === 'boolean' || (v === null && typeof m.not_measured === 'string' && m.not_measured.length > 8);
        assert.ok(okValue, c + '.' + k + ' value is ' + JSON.stringify(v));
      }
      assert.notEqual(r[c].direct_file_write_replacement.value, undefined);
    });
  }
  test('results.json: parity was checked, both candidates, six actions', () => {
    assert.equal(r.meta.parity.ok, true);
    assert.deepEqual(r.meta.parity.actions, M.EXPECTED_ACTIONS);
  });
  test('results.json: no measure carries a literal long dash', () => {
    const txt = fs.readFileSync(RESULTS, 'utf8');
    assert.ok(!txt.includes(EM) && !txt.includes(EN));
  });
}

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ }

console.log('');
console.log('RESULT: PASS=' + passed + ' FAIL=' + failed + (schemaSkipped ? ' (schema arm SKIPPED: results.json absent)' : ''));
if (failed > 0) process.exit(1);
process.exit(schemaSkipped ? 77 : 0);
