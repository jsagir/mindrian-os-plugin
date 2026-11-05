'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 384 plan 10: self-test of bench/t02-t05-bench.cjs.
 * Group B1 to B6 (task 1, T02): usage and flag refusals, the reading rule, the registry shapes, a short timing run,
 * a short counting run, the report rows and the absence of paths.
 * Later groups (B7 to B18) are added by tasks 2 to 4.
 * Node built-ins only. Prints `t02-t05-bench: ALL PASS` or `t02-t05-bench: <n> FAILED`. Hyphens only.
 * Heavy checks must run under the 384 lock. Measurements are never taken here.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const BENCH = path.join(__dirname, 't02-t05-bench.cjs');
const HARNESS = path.join(REPO, 'tools', 'perf', 'perf-harness.cjs');

let failed = 0;
function check(name, ok, detail) {
  if (ok) process.stdout.write('  ok   ' + name + '\n');
  else { failed += 1; process.stdout.write('  FAIL ' + name + (detail ? ' :: ' + detail : '') + '\n'); }
}

const SCRATCH = process.env.MOS_T02T05_TEST_SCRATCH || os.tmpdir();
const TMP = fs.mkdtempSync(path.join(SCRATCH, 'mos-384-t02t05-test-'));
function cleanup() { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ } }
function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_e) { return null; } }
const SLASH = String.fromCharCode(47);
// the path prefixes that no output may hold (built at run time, so this file holds none of them)
const BAD_PREFIXES = [SLASH + 'home' + SLASH, SLASH + 'mnt' + SLASH + 'c' + SLASH, SLASH + 'tm' + 'p' + SLASH, ['Mindrian', 'Rooms'].join('')];
function hasBadPath(text) { return BAD_PREFIXES.filter((p) => String(text).indexOf(p) !== -1); }

if (!fs.existsSync(BENCH)) {
  check('B0 t02-t05-bench.cjs exists', false, 'missing file');
  cleanup();
  process.stdout.write('t02-t05-bench: ' + failed + ' FAILED\n');
  process.exit(1);
}

const bench = require(BENCH);
const runnerEnv = Object.assign({}, process.env, { MOS_PERF_SELFTEST: '1', MOS_PERF_LOCK_FILE: path.join(TMP, 'selftest.lock') });
const plainEnv = Object.assign({}, process.env);
delete plainEnv.MOS_PERF_SELFTEST;
const run = (args, env, timeout) => spawnSync(process.execPath, [BENCH].concat(args), { encoding: 'utf8', timeout: timeout || 600000, env: env || runnerEnv });

// ---- B0: the source holds no guarded literal and no dash character ----
{
  const src = fs.readFileSync(BENCH, 'utf8') + fs.readFileSync(__filename, 'utf8');
  const g1 = ['CREATE', 'TABLE'].join(' ');
  const g2 = ['node', 'sqlite'].join(':');
  check('B0 the bench and its check file hold neither the table-creation phrase nor the built-in module name', src.indexOf(g1) === -1 && src.indexOf(g2) === -1);
  const dash = new RegExp(String.fromCharCode(8211, 124, 8212));
  check('B0 no en dash and no em dash in the bench or the check file', !dash.test(src));
  check('B0 the bench source holds no path prefix', hasBadPath(fs.readFileSync(BENCH, 'utf8')).length === 0, hasBadPath(fs.readFileSync(BENCH, 'utf8')).join(','));
}

// ---- B1: usage and refusals ----
{
  const a = run([]);
  check('B1 no subcommand prints usage and exits 2', a.status === 2 && /usage/i.test(a.stderr), 'status ' + a.status);
  const b = run(['t02', '--out', path.join(TMP, 'x.json')]);
  check('B1 a subcommand without --tree exits 2', b.status === 2, 'status ' + b.status);
  const c = run(['t02', '--tree', REPO, '--out', path.join(TMP, 'x.json'), '--skip-gates'], plainEnv);
  check('B1 --skip-gates without MOS_PERF_SELFTEST=1 exits 2', c.status === 2, 'status ' + c.status);
  const d = run(['t02', '--tree', REPO, '--out', path.join(TMP, 'x.json'), '--mode', 'bogus']);
  check('B1 --mode accepts time or count only', d.status === 2, 'status ' + d.status);
}

// ---- B2: the reading rule (R2) ----
{
  const r = bench.reading;
  check('B2 reading(10, 11, 2) is PASS', r(10, 11, 2) === 'PASS', String(r(10, 11, 2)));
  check('B2 reading(1, 1.5, 2) is FAIL', r(1, 1.5, 2) === 'FAIL', String(r(1, 1.5, 2)));
  check('B2 reading(10, 1, 2) is NOT RESOLVED', r(10, 1, 2) === 'NOT RESOLVED', String(r(10, 1, 2)));
  check('B2 reading(0, -1, 0) is FAIL', r(0, -1, 0) === 'FAIL', String(r(0, -1, 0)));
  check('B2 reading(0.1, 0.2, 0) is PASS', r(0.1, 0.2, 0) === 'PASS', String(r(0.1, 0.2, 0)));
}

// ---- B3: the registry shapes ----
{
  const g = bench.guardPassingRegistry('slug-x', path.join(TMP, 'room-x'));
  check('B3 guardPassingRegistry has active_room (a string) and rooms (an array of one entry with slug and abs_path)',
    typeof g.active_room === 'string' && Array.isArray(g.rooms) && g.rooms.length === 1 && g.rooms[0].slug === 'slug-x' && typeof g.rooms[0].abs_path === 'string');
  const sg = bench.shapeOf(g);
  check('B3 shapeOf of the guard-passing registry is true, true, true and has no other key',
    sg.has_active_room_key === true && sg.active_is_string === true && sg.rooms_is_array === true && Object.keys(sg).length === 3, JSON.stringify(sg));
  const sp = bench.shapeOf({ active: 'a', rooms: { a: { abs_path: 'x' } } });
  check('B3 shapeOf of a registry with active (a string) and rooms (an object) gives rooms_is_array false and has_active_room_key false',
    sp.rooms_is_array === false && sp.has_active_room_key === false && sp.active_is_string === true, JSON.stringify(sp));
}

// ---- B4 to B6: a short timing run, a short counting run, the report ----
const T2 = path.join(TMP, 't02');
fs.mkdirSync(T2, { recursive: true });
const t02time = path.join(T2, 't02-time.json');
const t02count = path.join(T2, 't02-count.json');
{
  const r = run(['t02', '--mode', 'time', '--tree', REPO, '--out', t02time, '--runs', '7', '--set', 's1', '--skip-gates', '--scratch', TMP], runnerEnv, 900000);
  check('B4 t02 --mode time --runs 7 exits 0', r.status === 0, 'status ' + r.status + ' ' + String(r.stderr).slice(0, 300));
  const j = readJson(t02time);
  const ids = ['t02:floor-node', 't02:floor-bash-node', 't02:module-load', 't02:ups:real-shape', 't02:ups:guard-passing', 't02:stop:real-shape', 't02:stop:guard-passing', 't02:post-read:real-shape', 't02:post-read:guard-passing',
    't02:d:real-minus-floor:ups', 't02:d:real-minus-floor:stop', 't02:d:real-minus-floor:post-read', 't02:d:guard-minus-real:ups', 't02:d:guard-minus-real:stop', 't02:d:guard-minus-real:post-read'];
  check('B4 the timing file has schema mos.perf-384/1', !!j && j.schema === 'mos.perf-384/1');
  const got = j ? (j.targets || []).map((t) => t.id) : [];
  check('B4 the timing file holds every named id', ids.every((i) => got.indexOf(i) !== -1), ids.filter((i) => got.indexOf(i) === -1).join(','));
  check('B4 every target has n of 7 or more', !!j && (j.targets || []).every((t) => t.n >= 7), JSON.stringify((j ? j.targets : []).map((t) => [t.id, t.n]).filter((x) => !(x[1] >= 7))));
  check('B4 the derived targets are labelled DERIVED', !!j && (j.targets || []).filter((t) => /^t02:d:/.test(t.id)).every((t) => t.derived === true));
  const vd = path.join(T2, 'v');
  fs.mkdirSync(vd, { recursive: true });
  fs.copyFileSync(t02time, path.join(vd, 'a.json'));
  const v = spawnSync(process.execPath, [HARNESS, 'verify-results', vd], { encoding: 'utf8' });
  const onlyLoad = String(v.stderr).split('\n').filter(Boolean).every((l) => /load1/.test(l));
  check('B4 the timing file passes verify-results (a load1 note alone is tolerated in the self-test)', v.status === 0 || onlyLoad, String(v.stderr).slice(0, 300));
  check('B4 the timing file holds no path', hasBadPath(fs.readFileSync(t02time, 'utf8')).length === 0, hasBadPath(fs.readFileSync(t02time, 'utf8')).join(','));
}
{
  const r = run(['t02', '--mode', 'count', '--tree', REPO, '--out', t02count, '--repeats', '3', '--set', 'count', '--skip-gates', '--scratch', TMP], runnerEnv, 900000);
  check('B5 t02 --mode count --repeats 3 exits 0', r.status === 0, 'status ' + r.status + ' ' + String(r.stderr).slice(0, 300));
  const j = readJson(t02count);
  check('B5 the counts file has schema mos.perf-384-counts/1', !!j && j.schema === 'mos.perf-384-counts/1');
  const need = ['registry_shapes', 'path_taken', 'modules', 'node_starts', 'repeats', 'repeats_agree'];
  check('B5 the counts file has the named fields', !!j && need.every((k) => j[k] !== undefined), need.filter((k) => !j || j[k] === undefined).join(','));
  check('B5 repeats is 3', !!j && j.repeats === 3);
  check('B5 the registry shape of the product is a boolean record and holds no text', !!j && j.registry_shapes && typeof j.registry_shapes.real.rooms_is_array === 'boolean' && typeof j.registry_shapes.guard_passing.rooms_is_array === 'boolean');
  const vd = path.join(T2, 'v2');
  fs.mkdirSync(vd, { recursive: true });
  fs.copyFileSync(t02count, path.join(vd, 'a.json'));
  const v = spawnSync(process.execPath, [HARNESS, 'verify-results', vd], { encoding: 'utf8' });
  const onlyLoad = String(v.stderr).split('\n').filter(Boolean).every((l) => /load1/.test(l));
  check('B5 the counts file passes verify-results', v.status === 0 || onlyLoad, String(v.stderr).slice(0, 300));
  check('B5 the counts file holds no path', hasBadPath(fs.readFileSync(t02count, 'utf8')).length === 0);
}
{
  const r = run(['report', '--task', 't02', '--s1', t02time, '--s2', t02time, '--counts', t02count]);
  check('B6 report --task t02 exits 0', r.status === 0, 'status ' + r.status + ' ' + String(r.stderr).slice(0, 300));
  const rows = String(r.stdout).split('\n').filter((l) => l.startsWith('|') && !/^\|[\s:|-]+$/.test(l));
  const lastCell = (l) => l.replace(/\|\s*$/, '').split('|').pop().trim();
  const dataRows = rows.filter((l) => lastCell(l) !== 'Basis');
  check('B6 every row ends with a Basis cell (DIRECT, DERIVED or NOT MEASURED)', dataRows.length > 0 && dataRows.every((l) => /^(DIRECT|DERIVED|NOT MEASURED)\b/.test(lastCell(l))), dataRows.filter((l) => !/^(DIRECT|DERIVED|NOT MEASURED)\b/.test(lastCell(l))).slice(0, 2).join(' / '));
  check('B6 every table header ends with the word Basis', rows.filter((l) => lastCell(l) === 'Basis').length >= 2);
  const pairRows = dataRows.filter((l) => /pending Q5b/.test(l));
  check('B6 the six pair rows hold a reading and the cell pending Q5b', pairRows.length >= 6 && pairRows.every((l) => /\b(PASS|FAIL|NOT RESOLVED)\b/.test(l)), String(pairRows.length));
  const targetRows = dataRows.filter((l) => /t02:/.test(l) && !/pending Q5b/.test(l));
  check('B6 every target has a row', targetRows.length >= 9, String(targetRows.length));
  check('B6 the report output holds no path', hasBadPath(r.stdout).length === 0, hasBadPath(r.stdout).join(','));
  check('B6 the report output holds no banned word', !/\b(faster|saves|gain|speedup)\b/i.test(r.stdout));
}

// ---- helpers for the report checks (synthetic result files) ----
function synthTarget(id, med, extra) {
  return Object.assign({ id, n: 15, wall_ms: { median: med, p95: med + 1, min: med - 1, max: med + 2 }, wall_ms_fine: { median: med, p95: med + 1, min: med - 1, max: med + 2 } }, extra || {});
}
function synthSet(spec) {
  return { schema: 'mos.perf-384/1', targets: Object.keys(spec).map((id) => synthTarget(id, spec[id], /:d:/.test(id) ? { derived: true } : {})) };
}
function writeSynth(name, obj) { const f = path.join(TMP, name); fs.writeFileSync(f, JSON.stringify(obj)); return f; }

// ---- B7: the lazy edit text (task 2) ----
const LINE = "const timelineRunner = require('./feynman/timeline-runner.cjs');";
{
  const orig = ['// head', 'const fs = require(\'node:fs\');', '', LINE, 'function a(x) {', '  const p = timelineRunner.parseFrontmatter(x);', '  return timelineRunner.bodyOutsideSentinels(p.body);', '}', ''].join('\n');
  const out = bench.makeLazyText(orig);
  const oL = orig.split('\n');
  const nL = out.split('\n');
  const changed = nL.filter((l, i) => oL[i] !== l).length + Math.abs(nL.length - oL.length);
  check('B7 makeLazyText leaves no line that starts with the eager require', !nL.some((l) => l.startsWith('const timelineRunner = require(')));
  const reqLines = nL.filter((l) => l.indexOf("require('./feynman/timeline-runner.cjs')") !== -1);
  check('B7 the runner require appears only inside the new object (one line that opens the object)', reqLines.length === 1 && reqLines[0].startsWith('const timelineRunner = {'), String(reqLines.length));
  check('B7 the new object has the methods parseFrontmatter and bodyOutsideSentinels', /parseFrontmatter\s*:/.test(reqLines[0]) && /bodyOutsideSentinels\s*:/.test(reqLines[0]));
  check('B7 every other line is unchanged (one line changed)', changed === 1, String(changed));
  // the new text runs: a stand-in module is loaded on the first call only
  const stand = path.join(TMP, 'lazycheck');
  fs.mkdirSync(path.join(stand, 'feynman'), { recursive: true });
  fs.writeFileSync(path.join(stand, 'feynman', 'timeline-runner.cjs'), 'global.__loaded = (global.__loaded || 0) + 1; module.exports = { parseFrontmatter: (x) => ({ body: x }), bodyOutsideSentinels: (x) => x + "!" };\n');
  fs.writeFileSync(path.join(stand, 'user.cjs'), out.replace(/function a\(x\)/, 'function a(x)') + '\nmodule.exports = { a, loaded: () => global.__loaded || 0 };\n');
  const rr = spawnSync(process.execPath, ['-e', 'const u = require(process.argv[1]); const before = u.loaded(); const v = u.a("q"); process.stdout.write(JSON.stringify({ before, after: u.loaded(), v }));', path.join(stand, 'user.cjs')], { encoding: 'utf8' });
  let o = null;
  try { o = JSON.parse(rr.stdout); } catch (_e) { o = null; }
  check('B7 the edited text loads the runner on the first call and not at load', !!o && o.before === 0 && o.after === 1 && o.v === 'q!', rr.stdout + rr.stderr.slice(0, 200));
  let t1 = false; try { bench.makeLazyText('const x = 1;\n'); } catch (_e) { t1 = true; }
  check('B7 a text without the line throws', t1);
  let t2 = false; try { bench.makeLazyText(LINE + '\n' + LINE + '\n'); } catch (_e) { t2 = true; }
  check('B7 a text with the line twice throws', t2);
  let t3 = false; try { bench.makeLazyText(LINE + '\nfoo(timelineRunner.render(1));\n'); } catch (_e) { t3 = true; }
  check('B7 a text that calls a third method of timelineRunner throws', t3);
}

// ---- B8: the scratch guard ----
{
  const scratch = path.join(TMP, 'scratch-guard');
  fs.mkdirSync(scratch, { recursive: true });
  let ok1 = true; try { bench.assertInsideScratch(path.join(scratch, 'tree-b', 'x.cjs'), scratch); } catch (_e) { ok1 = false; }
  check('B8 a path inside the scratch folder is accepted', ok1);
  let t2 = false; try { bench.assertInsideScratch(path.join(TMP, 'elsewhere', 'x.cjs'), scratch); } catch (_e) { t2 = true; }
  check('B8 a path outside the scratch folder throws', t2);
  let t3 = false; try { bench.assertInsideScratch(path.join(REPO, 'lib', 'core', 'folder-memory.cjs'), REPO); } catch (_e) { t3 = true; }
  check('B8 a path inside the repo throws, even when the repo is named as the scratch folder', t3);
}

// ---- B9: the equivalence compare ----
{
  check('B9 countMismatches of equal lists is 0', bench.countMismatches(['a', 'b', 'c'], ['a', 'b', 'c']) === 0);
  check('B9 countMismatches with one differing entry is 1', bench.countMismatches(['a', 'b', 'c'], ['a', 'x', 'c']) === 1);
  check('B9 countMismatches with a length that differs by one is 1 or more', bench.countMismatches(['a', 'b'], ['a', 'b', 'c']) >= 1);
}

// ---- B10: make-b and the pair rows of the T03 report ----
{
  const sc = path.join(TMP, 'scratch-mkb');
  const tb = path.join(sc, 'tree-b');
  fs.mkdirSync(path.join(tb, 'lib', 'core'), { recursive: true });
  for (const n of ['folder-memory.cjs', 'folder-memory-async.cjs']) fs.writeFileSync(path.join(tb, 'lib', 'core', n), '// head\n' + LINE + '\nfunction f(s) { return timelineRunner.parseFrontmatter(s); }\n');
  const mk = run(['t03', 'make-b', '--tree-b', tb, '--scratch', sc]);
  check('B10 t03 make-b edits the two files in the scratch copy', mk.status === 0 && fs.readFileSync(path.join(tb, 'lib', 'core', 'folder-memory.cjs'), 'utf8').indexOf('const timelineRunner = {') !== -1 && fs.readFileSync(path.join(tb, 'lib', 'core', 'folder-memory-async.cjs'), 'utf8').indexOf('const timelineRunner = {') !== -1, mk.stderr.slice(0, 200));
  let sum = null; try { sum = JSON.parse(mk.stdout); } catch (_e) { sum = null; }
  check('B10 t03 make-b prints the line counts only', !!sum && sum.files_changed === 2 && hasBadPath(mk.stdout).length === 0, mk.stdout.slice(0, 200));
  const bad = run(['t03', 'make-b', '--tree-b', tb, '--scratch', path.join(TMP, 'other-scratch')]);
  check('B10 t03 make-b refuses a tree-b outside the scratch folder', bad.status !== 0);

  const ids = ['t03:statusline:a', 't03:statusline:b', 't03:onstop:a', 't03:onstop:b', 't03:drain:a', 't03:drain:b', 't03:load:a', 't03:load:b', 't03:d:statusline', 't03:d:onstop', 't03:d:drain', 't03:d:load'];
  const spec = {};
  for (const id of ids) spec[id] = /:a$/.test(id) ? 100 : (/:b$/.test(id) ? 90 : 10);
  const s1 = writeSynth('t03-s1.json', synthSet(spec));
  const s2 = writeSynth('t03-s2.json', synthSet(spec));
  const mkCounts = (a, b) => {
    const m = {}; const ns = {};
    for (const t of ['statusline', 'onstop', 'drain', 'load']) { m[t] = { a: [a, a, a], b: [b, b, b] }; ns[t] = { a: [1, 1, 1], b: [1, 1, 1] }; }
    return { schema: 'mos.perf-384-counts/1', task: 't03', edit: { files_changed: 2, lines_changed: { 'folder-memory': 1, 'folder-memory-async': 1 } }, equivalence: { sections: 3, mismatches_sync: 0, mismatches_async: 0, feynman_nonempty_sections: 1 }, modules: m, modules_by_script: {}, node_starts: ns, stdout_bytes: { statusline: { a: 5, b: 5 } }, repeats: 3, repeats_agree: true };
  };
  const cEq = writeSynth('t03-counts-eq.json', mkCounts(30, 30));
  const cLow = writeSynth('t03-counts-low.json', mkCounts(30, 20));
  const rEq = run(['report', '--task', 't03', '--s1', s1, '--s2', s2, '--counts', cEq, '--readings-out', path.join(TMP, 'readings-t03-eq.json')]);
  const pairs = (txt) => String(txt).split('\n').filter((l) => l.startsWith('|') && /pending Q5b/.test(l));
  const eqRows = pairs(rEq.stdout);
  check('B10 report t03 with equal counts reads FAIL for each of the four pairs', rEq.status === 0 && eqRows.length === 4 && eqRows.every((l) => /\bFAIL\b/.test(l)), String(eqRows.length) + ' ' + rEq.stderr.slice(0, 200));
  const rLow = run(['report', '--task', 't03', '--s1', s1, '--s2', s2, '--counts', cLow, '--readings-out', path.join(TMP, 'readings-t03-low.json')]);
  const lowRows = pairs(rLow.stdout);
  check('B10 report t03 with lower counts in B gives the R2 reading of the timing files (PASS for the synthetic files)', rLow.status === 0 && lowRows.length === 4 && lowRows.every((l) => /\bPASS\b/.test(l)), lowRows.join(' / ').slice(0, 300));
  check('B10 the T03 pair rows show the module counts of both trees', lowRows.every((l) => /\b30\b/.test(l) && /\b20\b/.test(l)));
  const lastCell = (l) => l.replace(/\|\s*$/, '').split('|').pop().trim();
  const allRows = String(rLow.stdout).split('\n').filter((l) => l.startsWith('|') && !/^\|[\s:|-]+$/.test(l));
  check('B10 every T03 report row ends with a Basis cell', allRows.every((l) => lastCell(l) === 'Basis' || /^(DIRECT|DERIVED|NOT MEASURED)\b/.test(lastCell(l))), allRows.filter((l) => !(lastCell(l) === 'Basis' || /^(DIRECT|DERIVED|NOT MEASURED)\b/.test(lastCell(l)))).slice(0, 2).join(' / '));
  check('B10 the T03 report holds no path', hasBadPath(rLow.stdout).length === 0);
}

cleanup();
if (failed) {
  process.stdout.write('t02-t05-bench: ' + failed + ' FAILED\n');
  process.exit(1);
}
process.stdout.write('t02-t05-bench: ALL PASS\n');
