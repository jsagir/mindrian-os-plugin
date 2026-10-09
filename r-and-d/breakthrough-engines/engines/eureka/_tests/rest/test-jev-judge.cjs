'use strict';
const path = require('node:path'); const fs = require('node:fs'); const os = require('node:os'); const cp = require('node:child_process');
const S = require('./_stubs.cjs'); const check = S.check;
const pkg = path.join(__dirname, '../..');
const origRootScript = path.join(pkg, '../_baseline/orig/eureka/scripts/eureka-jev-judge.cjs');
const newScript = path.join(pkg, 'scripts/eureka-jev-judge.cjs');
function mkRoom() {
  const room = fs.mkdtempSync(path.join(os.tmpdir(), 'eureka-jev-'));
  fs.writeFileSync(path.join(room, 'nodes.json'), JSON.stringify({ n1: 'short', n2: 'a considerably longer excerpt body here', n3: 'medium text', n4: 'x', n5: 'costs', n6: 'q' }));
  fs.writeFileSync(path.join(room, 'cands.json'), JSON.stringify([
    { a: 'n1', b: 'n2', section_a: 's1', section_b: 's2', lanes: ['lexical'], shared_entities: [], title_a: 'valve', title_b: 'gate' },
    { a: 'n3', b: 'n4', section_a: 's1', section_b: 's2', lanes: ['icm_declared'], shared_entities: [], title_a: 'pump', title_b: 'heart' },
  ]));
  return room;
}
function run(script, room, args, env) {
  const r = cp.spawnSync(process.execPath, ['-r', path.join(__dirname, '_preload-jev.cjs'), script, '--room', room, '--tag', 't1'].concat(args || []), { encoding: 'utf8', env: Object.assign({}, process.env, env || {}) });
  let j = null; try { j = JSON.parse(r.stdout.trim().split('\n').pop()); } catch (e) { /* not json */ }
  return { code: r.status, out: r.stdout, err: r.stderr, json: j };
}
const verdicts = function (room) { return fs.readFileSync(path.join(room, 'run-t1', '03_judge', 'output', 'verdicts.jsonl'), 'utf8').trim().split('\n').map(JSON.parse); };

// 1. single run behaves like the original
let room = mkRoom(); const log1 = path.join(room, 'log.txt');
let o = run(origRootScript, room, [], { JEV_LOG: log1 });
// the original script lives under _baseline/orig so its REPO_ROOT is the orig tree; its modules are the pristine copies (stubbed paths ok)
check('original single run ok', o.json && o.json.ok === true, o.out + o.err);
const oRows = o.json && o.json.ok ? verdicts(room) : [];
fs.rmSync(path.join(room, 'run-t1'), { recursive: true, force: true });
let n = run(newScript, room, [], { JEV_LOG: path.join(room, 'log2.txt') });
check('2026 single run ok', n.json && n.json.ok === true, n.out + n.err);
const nRows = verdicts(room);
const strip = function (rows) { return rows.map(function (r) { const x = Object.assign({}, r); delete x.judged_at; delete x.agreement; return x; }); };
check('single-run verdict rows equal original (modulo timestamp/agreement)', JSON.stringify(strip(oRows)) === JSON.stringify(strip(nRows)), JSON.stringify(strip(nRows)).slice(0, 300));
check('provenance file written', n.json.provenance && fs.existsSync(n.json.provenance) && JSON.parse(fs.readFileSync(n.json.provenance, 'utf8')).model === 'pinned-model-x');
check('responses replay map keeps hash->response shape', Object.keys(JSON.parse(fs.readFileSync(path.join(room, 'run-t1', '03_judge', 'jev-responses.json'), 'utf8'))).every(function (k) { return /^[0-9a-f]{64}$/.test(k); }));

// 2. --check replay of recorded responses (no key needed)
let ck = run(newScript, room, ['--check'], { NOKEY: '1' });
check('--check replay works without a key', ck.json && ck.json.ok && ck.json.usage.replay === true, ck.out + ck.err);
check('no key live -> exit 3', run(newScript, mkRoom(), [], { NOKEY: '1' }).code === 3);

// 3. seed + repeats: position-biased judge is exposed as unstable
fs.rmSync(path.join(room, 'run-t1'), { recursive: true, force: true });
const log3 = path.join(room, 'log3.txt');
let sr = run(newScript, room, ['--seed', 'S1', '--repeats', '2'], { JEV_LOG: log3 });
check('seeded repeat run ok (guard accepts swapped orientation in stub)', sr.json && sr.json.ok === true, sr.out + sr.err);
const sRows = verdicts(room);
check('position-biased judge flagged unstable on every pair', sRows.every(function (r) { return r.unstable === true && r.human_routed === true && r.agreement.modal_share === 0.5; }), JSON.stringify(sRows.map(function (r) { return [r.choice, r.unstable, r.agreement]; })));
check('both orientations were shown', fs.readFileSync(log3, 'utf8').trim().split('\n').length === 4);
check('summary reports repeats and seed', sr.json.summary.repeats === 2 && sr.json.summary.seed === 'S1' && sr.json.summary.unstable === 2);
check('provenance records seed/repeats', JSON.parse(fs.readFileSync(sr.json.provenance, 'utf8')).seed === 'S1');
// determinism: same seed same call log
fs.rmSync(path.join(room, 'run-t1'), { recursive: true, force: true });
const log4 = path.join(room, 'log4.txt'); run(newScript, room, ['--seed', 'S1', '--repeats', '2'], { JEV_LOG: log4 });
check('same seed -> same excerpt orientation sequence', fs.readFileSync(log3, 'utf8') === fs.readFileSync(log4, 'utf8'));

// 4. flags
const mx = run(newScript, room, ['--max'], {}); check('--max with no value falls back to 25 (no crash)', mx.json && mx.json.ok === true, mx.out + mx.err);
const mz = run(newScript, room, ['--max', '1'], {}); check('--max 1 judges one pair', mz.json && mz.json.summary.judged === 1);
const mn = run(newScript, room, ['--max', '-5'], {}); check('--max -5 clamps to 1', mn.json && mn.json.summary.judged === 1, mn.out);
check('missing flags -> exit 2', cp.spawnSync(process.execPath, ['-r', path.join(__dirname, '_preload-jev.cjs'), newScript], { encoding: 'utf8' }).status === 2);

// 5. error redaction and null db
const bad = run(newScript, room, [], { JEV_FAIL: '1' });
check('upstream failure does not kill the run (judgeFn error recorded)', bad.json && bad.json.ok === true && bad.json.summary.judge_errors >= 1, bad.out + bad.err);
check('failure text recorded in row without crashing', verdicts(room)[0].judge_error !== undefined);
const nodb = run(newScript, room, [], { JEV_NODB: '1' });
check('null room.db -> clean error JSON, exit 1', nodb.code === 1 && nodb.json && nodb.json.reason === 'error' && /could not be opened/.test(nodb.json.detail), nodb.out + nodb.err);
const R = (function () { const M = require('node:module'); return null; })();
// redact unit test via a child require (module is importable now)
const rr = cp.spawnSync(process.execPath, ['-r', path.join(__dirname, '_preload-jev.cjs'), '-e', 'const m=require(process.argv[1]);console.log(JSON.stringify([m.redact("fail sk-abc123 and Bearer tok.en-12345678 apiKey: ABCDEFGH12345"), typeof m.main, m.intFlag("7",1,1,9), m.intFlag(true,25,1,9)]))', newScript], { encoding: 'utf8' });
const rj = JSON.parse(rr.stdout.trim());
check('redact strips sk-, Bearer and apiKey values', !/abc123|tok\.en|ABCDEFGH/.test(rj[0]), rj[0]);
check('module importable without running (2026)', rr.status === 0 && rj[1] === 'function' && rj[2] === 7 && rj[3] === 25);
const ro = cp.spawnSync(process.execPath, ['-r', path.join(__dirname, '_preload-jev.cjs'), '-e', 'require(process.argv[1]); console.log("imported")', origRootScript], { encoding: 'utf8' });
check('ORIGINAL ran main() on import (exit 2 with no flags)', /room_and_tag_required/.test(ro.stdout) && ro.status === 2, ro.stdout);
S.done('test-jev-judge');
