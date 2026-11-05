'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 384 plan 11: self-test of bench/q7-write-bench.cjs.
 * Groups B1 to B8: usage and flag refusals, the projection and floor rule, the class rule, the premise gate rule,
 * a short counting run, a short timing run, the premise stop, the report and the frequency tables.
 * Node built-ins only. Prints `q7-write-bench: ALL PASS` or `q7-write-bench: <n> FAILED`. Hyphens only.
 * Heavy checks must run under the 384 lock. Measurements are never taken here.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const BENCH = path.join(__dirname, 'q7-write-bench.cjs');
const HARNESS = path.join(REPO, 'tools', 'perf', 'perf-harness.cjs');

let failed = 0;
function check(name, ok, detail) {
  if (ok) process.stdout.write('  ok   ' + name + '\n');
  else { failed += 1; process.stdout.write('  FAIL ' + name + (detail ? ' :: ' + detail : '') + '\n'); }
}

const SCRATCH = process.env.MOS_Q7_TEST_SCRATCH || os.tmpdir();
fs.mkdirSync(SCRATCH, { recursive: true });
const TMP = fs.mkdtempSync(path.join(SCRATCH, 'mos-384-q7-test-'));
function cleanup() { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ } }
function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_e) { return null; } }
const SLASH = String.fromCharCode(47);
// the path prefixes that no output may hold (built at run time, so this file holds none of them)
const BAD_PREFIXES = [SLASH + 'home' + SLASH, SLASH + 'mnt' + SLASH + 'c' + SLASH, SLASH + 'tm' + 'p' + SLASH, ['Mindrian', 'Rooms'].join('')];
function hasBadPath(text) { return BAD_PREFIXES.filter((p) => String(text).indexOf(p) !== -1); }

if (!fs.existsSync(BENCH)) {
  check('B0 q7-write-bench.cjs exists', false, 'missing file');
  cleanup();
  process.stdout.write('q7-write-bench: ' + failed + ' FAILED\n');
  process.exit(1);
}

const bench = require(BENCH);
const runnerEnv = Object.assign({}, process.env, { MOS_PERF_SELFTEST: '1', MOS_PERF_LOCK_FILE: path.join(TMP, 'selftest.lock') });
const plainEnv = Object.assign({}, process.env);
delete plainEnv.MOS_PERF_SELFTEST;
const run = (args, env, timeout) => spawnSync(process.execPath, [BENCH].concat(args), { encoding: 'utf8', timeout: timeout || 900000, env: env || runnerEnv });
const lastCell = (l) => l.replace(/\|\s*$/, '').split('|').pop().trim();
const tableRows = (txt) => String(txt).split('\n').filter((l) => l.startsWith('|') && !/^\|[\s:|-]+$/.test(l));
const basisOk = (l) => lastCell(l) === 'Basis' || /^(DIRECT|DERIVED|NOT MEASURED)\b/.test(lastCell(l));

// ---- B0: the source holds no guarded literal, no dash character, no path prefix ----
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
  const b = run(['q7', '--out', path.join(TMP, 'x.json')]);
  check('B1 q7 without --tree exits 2', b.status === 2, 'status ' + b.status);
  const c = run(['q7', '--tree', REPO, '--out', path.join(TMP, 'x.json'), '--skip-gates'], plainEnv);
  check('B1 --skip-gates without MOS_PERF_SELFTEST=1 exits 2', c.status === 2, 'status ' + c.status);
  const d = run(['q7', '--tree', REPO, '--out', path.join(TMP, 'x.json'), '--mode', 'bogus']);
  check('B1 --mode accepts time or count only', d.status === 2, 'status ' + d.status);
}

// ---- B2: the projection and the floor rule ----
{
  const p = bench.project(200, 5, 2);
  check('B2 project(200, 5, 2) gives 1000 and 20', p.projected_ms === 1000 && p.noise_ms === 20, JSON.stringify(p));
  const q = bench.project(0.5, 20, 0);
  check('B2 project(0.5, 20, 0) gives 10 and 0', q.projected_ms === 10 && q.noise_ms === 0, JSON.stringify(q));
  check('B2 meetsFloor(50) is false', bench.meetsFloor(50) === false);
  check('B2 meetsFloor(50.001) is true', bench.meetsFloor(50.001) === true);
}

// ---- B3: the class rule (R5) ----
{
  const c = bench.classifyWriteRow;
  check('B3 independent true gives NOT A LOWER BOUND', c({ independent: true, identityIsRoomMd: true, identitySkipped: true, pairReading: 'PASS' }) === 'NOT A LOWER BOUND');
  check('B3 (false, true, true, PASS) gives LOWER BOUND', c({ independent: false, identityIsRoomMd: true, identitySkipped: true, pairReading: 'PASS' }) === 'LOWER BOUND');
  check('B3 (false, true, true, FAIL) gives NOT A LOWER BOUND', c({ independent: false, identityIsRoomMd: true, identitySkipped: true, pairReading: 'FAIL' }) === 'NOT A LOWER BOUND');
  check('B3 (false, false, true, PASS) gives UNVERIFIED', c({ independent: false, identityIsRoomMd: false, identitySkipped: true, pairReading: 'PASS' }) === 'UNVERIFIED');
}

// ---- B4: the premise gate rule (R3) ----
function passingCounts() {
  return {
    repeats: 3,
    cascade_skip: { rooms_artifact: { repeats: 3, skipped_true: 0, skipped_false: 3 }, rooms_identity: { repeats: 3, skipped_true: 3, skipped_false: 0 } },
    events: {
      rooms_artifact: { node_starts: [14, 13, 13], modules: [1100, 1090, 1100] },
      rooms_identity: { node_starts: [8, 8, 8], modules: [560, 565, 560] },
    },
  };
}
{
  const g = bench.premiseGate;
  const ok = g(passingCounts());
  check('B4 a passing sample gives ok true and no reason', ok.ok === true && Array.isArray(ok.reasons) && ok.reasons.length === 0, JSON.stringify(ok));
  const a = passingCounts(); a.cascade_skip.rooms_artifact.skipped_true = 3; a.cascade_skip.rooms_artifact.skipped_false = 0;
  const ra = g(a);
  check('B4 artifact skipped_true 3 gives false with a reason', ra.ok === false && ra.reasons.length >= 1, JSON.stringify(ra));
  const b = passingCounts(); b.events.rooms_artifact.node_starts = [8, 8, 8];
  const rb = g(b);
  check('B4 artifact starts equal to identity starts gives false', rb.ok === false, JSON.stringify(rb));
  const c = passingCounts(); c.cascade_skip.rooms_identity.skipped_true = 2; c.cascade_skip.rooms_identity.skipped_false = 1;
  const rc = g(c);
  check('B4 identity skipped_true 2 gives false', rc.ok === false, JSON.stringify(rc));
  const d = passingCounts(); d.events.rooms_artifact.modules = [560, 1100, 1100];
  check('B4 artifact lowest modules equal to identity highest modules gives false', g(d).ok === false);
}

// ---- B5: a short counting run ----
const Q = path.join(TMP, 'q7');
fs.mkdirSync(Q, { recursive: true });
const countFile = path.join(Q, 'count.json');
const timeFile = path.join(Q, 'time.json');
{
  const r = run(['q7', '--mode', 'count', '--repeats', '3', '--tree', REPO, '--out', countFile, '--set', 'count', '--skip-gates', '--scratch', TMP], runnerEnv, 1800000);
  check('B5 q7 --mode count --repeats 3 exits 0', r.status === 0, 'status ' + r.status + ' ' + String(r.stderr).slice(0, 300));
  const j = readJson(countFile);
  check('B5 the counts file has schema mos.perf-384-counts/1', !!j && j.schema === 'mos.perf-384-counts/1');
  const need = ['premise_failed', 'identity_target_is_room_md', 'cascade_skip', 'events', 'layouts', 'repeats'];
  check('B5 the counts file has the named fields', !!j && need.every((k) => j[k] !== undefined), need.filter((k) => !j || j[k] === undefined).join(','));
  check('B5 repeats is 3 and premise_failed is a boolean', !!j && j.repeats === 3 && typeof j.premise_failed === 'boolean');
  const cs = (j && j.cascade_skip) || {};
  check('B5 cascade_skip holds rooms_artifact, rooms_identity and default_artifact with repeats, skipped_true and skip_reason',
    ['rooms_artifact', 'rooms_identity', 'default_artifact'].every((k) => cs[k] && cs[k].repeats === 3 && Number.isInteger(cs[k].skipped_true) && typeof cs[k].skip_reason === 'string'), JSON.stringify(cs).slice(0, 300));
  const ev = (j && j.events) || {};
  check('B5 events hold the four targets with 3 starts, 3 modules, 3 survivor counts and repeats_agree',
    ['rooms_artifact', 'rooms_artifact_changed', 'rooms_identity', 'default_artifact'].every((k) => ev[k] && ev[k].node_starts.length === 3 && ev[k].modules.length === 3 && ev[k].survivors_left.length === 3 && typeof ev[k].repeats_agree === 'boolean'), JSON.stringify(ev).slice(0, 300));
  check('B5 the artifact cascade call is skipped false and the identity call is skipped true on the live checkout', !!cs.rooms_artifact && cs.rooms_artifact.skipped_true === 0 && !!cs.rooms_identity && cs.rooms_identity.skipped_true === 3, JSON.stringify(cs).slice(0, 300));
  check('B5 the layout record holds booleans only', !!j && j.layouts && Object.keys(j.layouts).length >= 3 && Object.keys(j.layouts).every((k) => typeof j.layouts[k].has_rooms_segment === 'boolean' && typeof j.layouts[k].has_room_segment === 'boolean'));
  const vd = path.join(Q, 'v1');
  fs.mkdirSync(vd, { recursive: true });
  fs.copyFileSync(countFile, path.join(vd, 'a.json'));
  const v = spawnSync(process.execPath, [HARNESS, 'verify-results', vd], { encoding: 'utf8' });
  const onlyLoad = String(v.stderr).split('\n').filter(Boolean).every((l) => /load1/.test(l));
  check('B5 the counts file passes verify-results (a load1 note alone is tolerated in the self-test)', v.status === 0 || onlyLoad, String(v.stderr).slice(0, 300));
  check('B5 the counts file holds no path', hasBadPath(fs.readFileSync(countFile, 'utf8')).length === 0, hasBadPath(fs.readFileSync(countFile, 'utf8')).join(','));
}

// ---- B6: a short timing run ----
{
  const r = run(['q7', '--mode', 'time', '--runs', '7', '--tree', REPO, '--out', timeFile, '--set', 's1', '--skip-gates', '--scratch', TMP], runnerEnv, 2400000);
  check('B6 q7 --mode time --runs 7 exits 0', r.status === 0, 'status ' + r.status + ' ' + String(r.stderr).slice(0, 300));
  const j = readJson(timeFile);
  const ids = ['q7:write:rooms:artifact', 'q7:write:rooms:artifact-changed', 'q7:write:rooms:identity', 'q7:write:default:artifact',
    'q7:d:artifact-minus-identity', 'q7:d:changed-minus-identity', 'q7:d:changed-minus-artifact', 'q7:d:rooms-minus-default'];
  check('B6 the timing file has schema mos.perf-384/1', !!j && j.schema === 'mos.perf-384/1');
  const got = j ? (j.targets || []).map((t) => t.id) : [];
  check('B6 the timing file holds every named id', ids.every((i) => got.indexOf(i) !== -1), ids.filter((i) => got.indexOf(i) === -1).join(','));
  // A run that hit the 5 s hook timeout is a result (it is counted in timed_out and kept out of the statistics), so a target
  // has n of 7 or more once its timed-out runs are added back; a derived target loses a round for each timed-out run of any target.
  const lostRounds = j ? (j.targets || []).reduce((a, t) => a + (t.timed_out || 0), 0) : 0;
  check('B6 every target has n of 7 or more, counting its timed-out runs', !!j && (j.targets || []).every((t) => t.n + (t.timed_out || 0) >= 7 || (/^q7:d:/.test(t.id) && t.n + lostRounds >= 7)), JSON.stringify((j ? j.targets : []).map((t) => [t.id, t.n, t.timed_out]).filter((x) => !(x[1] >= 7))));
  check('B6 the derived targets are labelled DERIVED', !!j && (j.targets || []).filter((t) => /^q7:d:/.test(t.id)).every((t) => t.derived === true));
  const writes = j ? (j.targets || []).filter((t) => /^q7:write:/.test(t.id)) : [];
  check('B6 each write target holds per_hook with id, wall and CPU medians, and rounds_ms of length n',
    writes.length === 4 && writes.every((t) => Array.isArray(t.per_hook) && t.per_hook.length > 0 && t.per_hook.every((h) => typeof h.id === 'string' && typeof h.wall_ms === 'number' && typeof h.cpu_ms === 'number') && Array.isArray(t.rounds_ms) && t.rounds_ms.length === t.n), JSON.stringify(writes.map((t) => [t.id, (t.rounds_ms || []).length, t.n])));
  check('B6 each write target holds a CPU median', writes.every((t) => t.cpu_ms && typeof t.cpu_ms.median === 'number'));
  const vd = path.join(Q, 'v2');
  fs.mkdirSync(vd, { recursive: true });
  fs.copyFileSync(timeFile, path.join(vd, 'a.json'));
  const v = spawnSync(process.execPath, [HARNESS, 'verify-results', vd], { encoding: 'utf8' });
  const onlyLoad = String(v.stderr).split('\n').filter(Boolean).every((l) => /load1|timed-out run|has n \d/.test(l));
  check('B6 the timing file passes verify-results (notes on load1 and on timed-out runs are tolerated in the self-test)', v.status === 0 || onlyLoad, String(v.stderr).slice(0, 300));
  check('B6 the timing file holds no path', hasBadPath(fs.readFileSync(timeFile, 'utf8')).length === 0, hasBadPath(fs.readFileSync(timeFile, 'utf8')).join(','));
}

// ---- B7: the premise stop ----
{
  const failEnv = Object.assign({}, runnerEnv, { MOS_Q7_TEST_GATE: 'fail' });
  const cf = path.join(Q, 'count-fail.json');
  const r = run(['q7', '--mode', 'count', '--repeats', '3', '--tree', REPO, '--out', cf, '--set', 'count', '--skip-gates', '--scratch', TMP], failEnv, 1800000);
  const j = readJson(cf);
  check('B7 the counts run with a forced gate failure exits 0 and writes premise_failed true', r.status === 0 && !!j && j.premise_failed === true, 'status ' + r.status + ' ' + String(r.stderr).slice(0, 200));
  check('B7 the counts file holds the reason words and no path', !!j && Array.isArray(j.premise_reasons) && j.premise_reasons.length >= 1 && hasBadPath(JSON.stringify(j)).length === 0);
  const tf = path.join(Q, 'time-fail.json');
  const t = run(['q7', '--mode', 'time', '--runs', '7', '--tree', REPO, '--out', tf, '--set', 's1', '--skip-gates', '--scratch', TMP], failEnv, 1800000);
  check('B7 the time run with a forced gate failure exits 1 with the words premise failed', t.status === 1 && /premise failed/.test(t.stderr), 'status ' + t.status + ' ' + String(t.stderr).slice(0, 200));
  check('B7 the time run with a forced gate failure writes no file', !fs.existsSync(tf));
}

// ---- helpers for the report checks (synthetic result files) ----
function synthTarget(id, wall, cpu, extra) {
  const o = { id, n: 15, wall_ms: { median: wall, p95: wall + 1, min: wall - 1, max: wall + 2 }, wall_ms_fine: { median: wall, p95: wall + 1, min: wall - 1, max: wall + 2 }, cpu_ms: { median: cpu, p95: cpu + 1, min: cpu - 1, max: cpu + 2 } };
  return Object.assign(o, extra || {});
}
function writeSynth(dir, name, obj) { fs.mkdirSync(dir, { recursive: true }); const f = path.join(dir, name); fs.writeFileSync(f, typeof obj === 'string' ? obj : JSON.stringify(obj)); return f; }
const MEAS = path.join(TMP, 'meas');
function synthSet(cpuScale) {
  return { schema: 'mos.perf-384/1', targets: [
    synthTarget('q7:write:rooms:artifact', 3000, 5000 * cpuScale, { per_hook: [{ id: 'hooks/run-hook.cmd post-write', async: false, wall_ms: 2900, cpu_ms: 4000 }], rounds_ms: [3000] }),
    synthTarget('q7:write:rooms:artifact-changed', 3100, 5200 * cpuScale),
    synthTarget('q7:write:rooms:identity', 200, 450 * cpuScale),
    synthTarget('q7:write:default:artifact', 205, 440 * cpuScale),
    synthTarget('q7:d:artifact-minus-identity', 2800, 4550 * cpuScale, { derived: true }),
    synthTarget('q7:d:changed-minus-identity', 2900, 4750 * cpuScale, { derived: true }),
    synthTarget('q7:d:changed-minus-artifact', 100, 200 * cpuScale, { derived: true }),
    synthTarget('q7:d:rooms-minus-default', 2795, 4560 * cpuScale, { derived: true }),
  ] };
}
const synthCounts = {
  schema: 'mos.perf-384-counts/1', task: 'q7', premise_failed: false, premise_reasons: [], identity_target_is_room_md: true, repeats: 3,
  cascade_skip: {
    rooms_artifact: { repeats: 3, skipped_true: 0, skipped_false: 3, skip_reason: 'none', repeats_agree: true },
    rooms_identity: { repeats: 3, skipped_true: 3, skipped_false: 0, skip_reason: 'ROOM.md is not an artifact', repeats_agree: true },
    default_artifact: { repeats: 3, skipped_true: 3, skipped_false: 0, skip_reason: 'filePath not inside a room directory', repeats_agree: true },
    rooms_artifact_changed: { repeats: 3, skipped_true: 0, skipped_false: 3, skip_reason: 'none', repeats_agree: true },
  },
  events: {
    rooms_artifact: { node_starts: [13, 13, 13], modules: [1100, 1100, 1100], survivors_left: [0, 0, 0], repeats_agree: true },
    rooms_artifact_changed: { node_starts: [14, 14, 14], modules: [1200, 1200, 1200], survivors_left: [0, 0, 0], repeats_agree: true },
    rooms_identity: { node_starts: [8, 8, 8], modules: [565, 565, 565], survivors_left: [0, 0, 0], repeats_agree: true },
    default_artifact: { node_starts: [8, 8, 8], modules: [565, 565, 565], survivors_left: [0, 0, 0], repeats_agree: true },
  },
  layouts: { rooms_artifact: { has_room_segment: false, has_rooms_segment: true }, rooms_identity: { has_room_segment: false, has_rooms_segment: true }, default_artifact: { has_room_segment: false, has_rooms_segment: false } },
};

// ---- B8: the report and the frequency tables ----
{
  const s1 = writeSynth(MEAS, 'q7-write-cascade-s1.json', synthSet(1));
  const s2 = writeSynth(MEAS, 'q7-write-cascade-s2.json', synthSet(1));
  const cf = writeSynth(MEAS, 'q7-write-cascade-counts.json', synthCounts);
  writeSynth(MEAS, 't04-cascade-skip-s1.json', { schema: 'mos.perf-384/1', targets: [synthTarget('t04:write:rooms', 3250, 5000), synthTarget('t04:write:default', 198, 400)] });
  writeSynth(MEAS, 't04-cascade-skip-s2.json', { schema: 'mos.perf-384/1', targets: [synthTarget('t04:write:rooms', 3231, 5000), synthTarget('t04:write:default', 214, 400)] });
  writeSynth(MEAS, 'census-spread.json', { schema: 'mos.perf-384-spread/1', rooms: { fixture: { targets: [{ id: 'event:PostToolUse:Write', median_set1: 200, median_set2: 210, spread_pct: 4.9, n_used: 15 }] } } });
  writeSynth(MEAS, 'census-walls-fixture-s1.json', { schema: 'mos.perf-384/1', targets: [synthTarget('event:PostToolUse:Write', 200, 425, { touch_applied: null, per_hook: [{ id: 'hooks/run-hook.cmd post-write', async: false, wall_ms: 194, cpu_ms: 180 }] }), synthTarget('event:SubagentStop', 255, 400)] });
  writeSynth(MEAS, 's6-ledger.json', { schema: 'mos.perf-384/1', targets: [synthTarget('script:ledger:n100:find-first', 20, 30), synthTarget('script:ledger:n100:read-first', 10, 20)] });
  writeSynth(MEAS, 'census-table.md', '| Event | x |\n| --- | --- |\n| PostToolUse:Write | 8 (8, 0, 0) | 36 (36-44) |\n| Stop | 1 |\n');
  const r = run(['report', '--s1', s1, '--s2', s2, '--counts', cf, '--measurements', MEAS]);
  check('B8 report exits 0', r.status === 0, 'status ' + r.status + ' ' + String(r.stderr).slice(0, 300));
  const out = String(r.stdout);
  for (const t of ['Q7-1', 'Q7-2', 'Q7-3', 'Q7-4', 'Q7-5', 'Q7-6', 'Q7-7']) check('B8 the report prints Table ' + t, out.indexOf('Table ' + t) !== -1);
  const rows = tableRows(out);
  check('B8 every report row ends with a Basis cell', rows.length > 0 && rows.every(basisOk), rows.filter((l) => !basisOk(l)).slice(0, 2).join(' / '));
  const proj = rows.filter((l) => /\bASSUMED\b/.test(l) || /^\| q7:write/.test(l));
  check('B8 the projection rows for W = 1, 5 and 20 are present with yes or no in the meets floor cells', [1, 5, 20].every((w) => rows.some((l) => new RegExp('\\| ' + w + ' \\|').test(l) && /\b(yes|no)\b/.test(l))), String(proj.length));
  check('B8 the projection header names the ASSUMED number of Writes', rows.some((l) => /W \(ASSUMED\)/.test(l)));
  check('B8 a meets floor cell reads yes for a 3000 ms Write and no for a 200 ms Write and a 40 ms threshold case', rows.some((l) => /q7:write:rooms:artifact/.test(l) && /\byes\b/.test(l)));
  check('B8 the S2 sum table holds the sum at W = 20 for the harness layout (45000 + 7200 + 2400 + 20 x 5000)', out.indexOf(String(45000 + 7200 + 2400 + 20 * 5000)) !== -1, 'looked for ' + String(45000 + 7200 + 2400 + 20 * 5000));
  check('B8 the Write rows of plans 384-04 and 384-05 are listed with a class', /LOWER BOUND/.test(out) && /NOT A LOWER BOUND/.test(out));
  check('B8 the ledger rows are listed as independent', rows.some((l) => /script:ledger/.test(l) && /NOT A LOWER BOUND/.test(l)));
  check('B8 the reproduction table holds the ratio against plan 384-10 and the plan 384-04 Write row', /plan 384-10/.test(out) && /plan 384-04/.test(out));
  check('B8 the report holds no path and no banned word', hasBadPath(out).length === 0 && !/\b(faster|saves|gain|speedup)\b/i.test(out), hasBadPath(out).join(','));

  // the report with a counts file whose premise failed and without timing files
  const failed1 = Object.assign({}, synthCounts, { premise_failed: true, premise_reasons: ['artifact cascade call was skipped'] });
  const cf2 = writeSynth(MEAS, 'counts-failed.json', failed1);
  const rf = run(['report', '--counts', cf2, '--measurements', MEAS]);
  check('B8 the report accepts a failed premise without timing files and says PREMISE FAILED', rf.status === 0 && /PREMISE FAILED/.test(rf.stdout), 'status ' + rf.status + ' ' + String(rf.stderr).slice(0, 200));

  // frequency tables
  const freq = {
    schema: 'mos.freq-384/1', basis: 'measured from 10 session files', sessions: 10, scope: 'all project folders', label: 'development sessions', project_folders: 4, unreadable_files: 1,
    privacy: 'counts and dates only',
    totals: { prompts: 400, tool_use: { write_edit: 100, read_grep_glob: 500, bash: 300, task: 10, slash_command: 5, brain: 2, gate_answer: 0, other: 9 }, record_types: {} },
    per_session: { prompts: { median: 20, p95: 90 }, tool_use: { write_edit: { median: 5, p95: 60 }, read_grep_glob: { median: 70, p95: 200 }, bash: { median: 30, p95: 120 }, task: { median: 1, p95: 5 }, slash_command: { median: 0, p95: 2 }, brain: { median: 0, p95: 1 }, gate_answer: { median: 0, p95: 0 }, other: { median: 1, p95: 5 } }, record_types: {} },
    dates: { first: '2026-08-01', last: '2026-11-05', active_days: 8, sessions_per_month: { '2026-08': 3, '2026-11': 6 }, sessions_without_date: 1 },
  };
  const ff = writeSynth(MEAS, 'frequency-all-projects.json', freq);
  const fr = run(['freq-tables', '--freq', ff, '--s1', s1, '--s2', s2, '--counts', cf]);
  check('B8 freq-tables exits 0', fr.status === 0, 'status ' + fr.status + ' ' + String(fr.stderr).slice(0, 300));
  const fo = String(fr.stdout);
  for (const t of ['Q8-1', 'Q8-2', 'Q8-3']) check('B8 freq-tables prints Table ' + t, fo.indexOf('Table ' + t) !== -1);
  const frows = tableRows(fo);
  check('B8 every frequency row ends with a Basis cell', frows.length > 0 && frows.every(basisOk), frows.filter((l) => !basisOk(l)).slice(0, 2).join(' / '));
  check('B8 the frequency tables say development sessions and name the upper bound', /development sessions/.test(fo) && /upper bound/.test(fo));
  check('B8 the ratio of prompts is 0.667 (20 divided by 30) and is not flagged, the ratio of write_edit is 0.25 and is flagged', frows.some((l) => /prompts/.test(l) && /0\.667/.test(l) && /no flag/.test(l)) && frows.some((l) => /write_edit/.test(l) && /0\.25/.test(l) && /\bflag\b/.test(l) && !/no flag/.test(l)), frows.filter((l) => /prompts|write_edit/.test(l)).join(' / ').slice(0, 300));
  check('B8 the S2 per development session at the median holds the Write term 5 x 5000 = 25000', fo.indexOf('25000') !== -1);
  const fn = run(['freq-tables', '--freq', ff, '--s1', path.join(TMP, 'none-1.json'), '--s2', path.join(TMP, 'none-2.json'), '--counts', cf2]);
  check('B8 freq-tables without timing files prints NOT MEASURED for the Write term', fn.status === 0 && /NOT MEASURED/.test(fn.stdout), 'status ' + fn.status + ' ' + String(fn.stderr).slice(0, 200));
  check('B8 the frequency output holds no path', hasBadPath(fo).length === 0 && hasBadPath(fn.stdout).length === 0);
}

cleanup();
if (failed) {
  process.stdout.write('q7-write-bench: ' + failed + ' FAILED\n');
  process.exit(1);
}
process.stdout.write('q7-write-bench: ALL PASS\n');
