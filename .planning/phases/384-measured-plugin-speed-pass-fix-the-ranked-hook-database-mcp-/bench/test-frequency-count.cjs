'use strict';
// Check file for frequency-count.cjs (plan 384-09, T-384-40).
// Node built-ins only. Prints "frequency-count: ALL PASS" or "frequency-count: <n> FAILED".
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const COUNTER = path.join(__dirname, 'frequency-count.cjs');
let failed = 0;
function check(name, ok, detail) {
  if (!ok) {
    failed += 1;
    console.log('FAIL ' + name + (detail ? ' : ' + detail : ''));
  } else {
    console.log('ok   ' + name);
  }
}

function run(args) {
  return spawnSync(process.execPath, [COUNTER, ...args], { encoding: 'utf8' });
}

function line(o) {
  return JSON.stringify(o) + '\n';
}

function sessionText(opts) {
  const o = opts || {};
  let s = '';
  s += line({ type: 'user', message: { role: 'user', content: 'SECRETWORD-ALPHA' } });
  s += line({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'SECRETWORD-DELTA' }] } });
  s += line({
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [{ type: 'tool_use', id: 't1', name: 'Write', input: { file_path: '/' + 'tmp/secret-path-BETA/file-GAMMA.md', content: 'x' } }],
    },
  });
  s += line({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'SECRETWORD-ALPHA result' }] } });
  if (o.extra) {
    s += line({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't2', name: 'Bash', input: { command: 'echo SECRETWORD-ALPHA' } }] } });
    s += line({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't3', name: 'mcp__plugin_mos_mindrian-brain__brain_query', input: {} }] } });
    s += line({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't4', name: 'mcp__plugin_mos_mindrian-os__gate_answer', input: {} }] } });
  }
  s += 'this line is not json SECRETWORD-ALPHA\n';
  return s;
}

function makeProjects(sessions) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fq-root-ZETA-'));
  const sub = path.join(root, '-x-' + 'Mindrian' + 'Rooms-fixture-room');
  fs.mkdirSync(sub);
  const other = path.join(root, '-x-other-project');
  fs.mkdirSync(other);
  fs.writeFileSync(path.join(other, 'sess-OTHER-eeee.jsonl'), sessionText());
  for (let i = 0; i < sessions; i += 1) {
    fs.writeFileSync(path.join(sub, 'sess-THETA-' + i + '-uuid.jsonl'), sessionText({ extra: i === 0 }));
  }
  return root;
}

function cleanup(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (e) { /* ignore */ }
}

// FQ0: the counter exists.
check('FQ0 counter file exists', fs.existsSync(COUNTER));
if (!fs.existsSync(COUNTER)) {
  console.log('frequency-count: ' + failed + ' FAILED');
  process.exit(1);
}

// FQ3: no leak, counts right, one session.
{
  const root = makeProjects(1);
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fq-out-'));
  const out = path.join(outDir, 'frequency.json');
  const r = run(['--projects-dir', root, '--out', out]);
  check('FQ3 exit 0', r.status === 0, 'status ' + r.status + ' ' + r.stderr);
  let j = null;
  try { j = JSON.parse(fs.readFileSync(out, 'utf8')); } catch (e) { /* ignore */ }
  check('FQ3 output parses', !!j);
  const text = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  check('FQ3 one session counted (other folders skipped)', !!j && j.sessions === 1, JSON.stringify(j && j.sessions));
  check('FQ3 one prompt', !!j && j.totals && j.totals.prompts === 1, JSON.stringify(j && j.totals));
  check('FQ3 Write group is 1', !!j && j.totals && j.totals.tool_use && j.totals.tool_use.write_edit === 1, JSON.stringify(j && j.totals && j.totals.tool_use));
  check('FQ3 Bash group is 1', !!j && j.totals && j.totals.tool_use && j.totals.tool_use.bash === 1);
  check('FQ3 brain group is 1', !!j && j.totals && j.totals.tool_use && j.totals.tool_use.brain === 1);
  check('FQ3 gate_answer group is 1', !!j && j.totals && j.totals.tool_use && j.totals.tool_use.gate_answer === 1);
  const secrets = ['SECRETWORD-ALPHA', 'SECRETWORD-DELTA', 'secret-path-BETA', 'file-GAMMA', path.basename(root), 'sess-THETA', 'fixture-room', 'OTHER'];
  const all = text + '\n' + r.stdout + '\n' + r.stderr;
  for (const s of secrets) {
    check('FQ3 no leak of ' + s, !all.includes(s));
  }
  check('FQ3 stdout is basis and sessions only', /^basis: /m.test(r.stdout) && r.stdout.trim().split('\n').length <= 2, JSON.stringify(r.stdout));
  cleanup(root);
  cleanup(outDir);
}

// FQ4: fewer than 3 files gives the ASSUMED model basis.
{
  const root = makeProjects(2);
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fq-out-'));
  const out = path.join(outDir, 'frequency.json');
  const r = run(['--projects-dir', root, '--out', out]);
  check('FQ4 exit 0', r.status === 0);
  const j = JSON.parse(fs.readFileSync(out, 'utf8'));
  check('FQ4 basis ASSUMED model', j.basis === 'ASSUMED model', j.basis);
  check('FQ4 model prompts 30 and ASSUMED', j.model && j.model.prompts_per_session === 30 && String(j.model.marker) === 'ASSUMED');
  check('FQ4 model Stop is derived from prompts', j.model && /derived/i.test(String(j.model.stop_note)));
  check('FQ4 model Read group 60 and Write group 20', j.model && j.model.read_grep_glob_per_session === 60 && j.model.write_edit_per_session === 20);
  cleanup(root);
  cleanup(outDir);
}

// FQ2: 3 files give a measured basis with a median and a p95.
{
  const root = makeProjects(3);
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fq-out-'));
  const out = path.join(outDir, 'frequency.json');
  const r = run(['--projects-dir', root, '--out', out]);
  check('FQ2 exit 0', r.status === 0);
  const j = JSON.parse(fs.readFileSync(out, 'utf8'));
  check('FQ2 basis measured from 3 session files', j.basis === 'measured from 3 session files', j.basis);
  check('FQ2 per_session prompts has median and p95', j.per_session && j.per_session.prompts && typeof j.per_session.prompts.median === 'number' && typeof j.per_session.prompts.p95 === 'number');
  check('FQ2 no model section when measured', !j.model);
  cleanup(root);
  cleanup(outDir);
}

// Missing projects folder: zero sessions, ASSUMED model, no crash.
{
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fq-out-'));
  const out = path.join(outDir, 'frequency.json');
  const r = run(['--projects-dir', path.join(outDir, 'does-not-exist'), '--out', out]);
  check('FQ5 missing folder exit 0', r.status === 0);
  const j = JSON.parse(fs.readFileSync(out, 'utf8'));
  check('FQ5 missing folder gives 0 sessions and ASSUMED', j.sessions === 0 && j.basis === 'ASSUMED model');
  cleanup(outDir);
}

// Usage: no --out exits 2.
{
  const r = run([]);
  check('FQ6 no --out exits 2', r.status === 2, 'status ' + r.status);
}

// ---------------------------------------------------------------------------
// Plan 384-11 (task 2): the all-projects mode. Checks F1 to F6.
// ---------------------------------------------------------------------------
function stamped(date, withTime) {
  // a session text whose first records carry a top-level timestamp
  const ts = date + (withTime ? 'T' + withTime + 'Z' : '');
  let s = '';
  s += line({ type: 'user', timestamp: ts, message: { role: 'user', content: 'hello' } });
  s += line({ type: 'assistant', timestamp: ts, message: { role: 'assistant', content: [{ type: 'tool_use', id: 'a', name: 'Read', input: {} }] } });
  s += line({ type: 'assistant', timestamp: ts, message: { role: 'assistant', content: [{ type: 'tool_use', id: 'b', name: 'Edit', input: {} }] } });
  return s;
}

function readOut(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } }

// F1: scope. One marker folder (1 file) and one other folder (2 files).
{
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fq-f1-'));
  const marker = path.join(root, '-x-' + 'Mindrian' + 'Rooms-fixture-room');
  const other = path.join(root, '-x-other');
  fs.mkdirSync(marker);
  fs.mkdirSync(other);
  fs.writeFileSync(path.join(marker, 'a.jsonl'), stamped('2026-01-05'));
  fs.writeFileSync(path.join(other, 'b.jsonl'), stamped('2026-01-06'));
  fs.writeFileSync(path.join(other, 'c.jsonl'), stamped('2026-02-01'));
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fq-out-'));
  const outAll = path.join(outDir, 'all.json');
  const outDef = path.join(outDir, 'def.json');
  const ra = run(['--all-projects', '--projects-dir', root, '--out', outAll]);
  const rd = run(['--projects-dir', root, '--out', outDef]);
  const ja = readOut(outAll);
  const jd = readOut(outDef);
  check('F1 all-projects mode exits 0', ra.status === 0, 'status ' + ra.status + ' ' + ra.stderr);
  check('F1 all-projects mode counts the files of every folder (3)', !!ja && ja.sessions === 3, JSON.stringify(ja && ja.sessions));
  check('F1 default mode counts the marker folder only (1)', rd.status === 0 && !!jd && jd.sessions === 1, JSON.stringify(jd && jd.sessions));
  check('F1 default mode file shape has no label, scope or dates', !!jd && jd.label === undefined && jd.scope === undefined && jd.dates === undefined && jd.project_folders === undefined && jd.unreadable_files === undefined);
  check('F1 default mode stdout is basis and sessions only', /^basis: /m.test(rd.stdout) && rd.stdout.trim().split('\n').length === 2, JSON.stringify(rd.stdout));
  cleanup(root);
  cleanup(outDir);
}

// F2 and F3: output fields and dates. Two folders with sessions, one empty folder, files in two months, one file with no timestamp.
{
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fq-f2-'));
  const p1 = path.join(root, '-x-one');
  const p2 = path.join(root, '-x-two');
  const p3 = path.join(root, '-x-empty');
  fs.mkdirSync(p1); fs.mkdirSync(p2); fs.mkdirSync(p3);
  fs.writeFileSync(path.join(p3, 'notes.txt'), 'not a session');
  fs.writeFileSync(path.join(p1, 's1.jsonl'), stamped('2026-03-04', '12:34:56.789'));
  fs.writeFileSync(path.join(p1, 's2.jsonl'), stamped('2026-03-04', '01:02:03.004'));
  fs.writeFileSync(path.join(p2, 's3.jsonl'), stamped('2026-04-10'));
  fs.writeFileSync(path.join(p2, 's4.jsonl'), line({ type: 'user', message: { role: 'user', content: 'no time here' } }));
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fq-out-'));
  const out = path.join(outDir, 'all.json');
  const r = run(['--all-projects', '--projects-dir', root, '--out', out]);
  const j = readOut(out);
  check('F2 exit 0 and the file parses', r.status === 0 && !!j, 'status ' + r.status + ' ' + r.stderr);
  check('F2 scope holds the words all project folders', !!j && j.scope === 'all project folders', JSON.stringify(j && j.scope));
  check('F2 label holds the words development sessions', !!j && j.label === 'development sessions');
  check('F2 project_folders is 2 (the empty folder is not counted)', !!j && j.project_folders === 2, JSON.stringify(j && j.project_folders));
  check('F2 unreadable_files is the integer 0', !!j && j.unreadable_files === 0);
  check('F2 four sessions and a measured basis, and no model section', !!j && j.sessions === 4 && j.basis === 'measured from 4 session files' && !j.model);
  const lines = r.stdout.trim().split('\n');
  check('F2 stdout holds only the lines basis, sessions, scope and project_folders', lines.length === 4 && /^basis: /.test(lines[0]) && /^sessions: 4$/.test(lines[1]) && /^scope: all project folders$/.test(lines[2]) && /^project_folders: 2$/.test(lines[3]), JSON.stringify(r.stdout));
  const d = (j && j.dates) || {};
  check('F3 dates.first and dates.last are the earliest and latest date', d.first === '2026-03-04' && d.last === '2026-04-10', JSON.stringify(d));
  check('F3 dates.active_days is 2 (two distinct dates)', d.active_days === 2, JSON.stringify(d.active_days));
  check('F3 dates.sessions_per_month has 2026-03 with 2 and 2026-04 with 1', !!d.sessions_per_month && d.sessions_per_month['2026-03'] === 2 && d.sessions_per_month['2026-04'] === 1, JSON.stringify(d.sessions_per_month));
  check('F3 dates.sessions_without_date is 1', d.sessions_without_date === 1);
  const sum = Object.keys(d.sessions_per_month || {}).reduce((s, k) => s + d.sessions_per_month[k], 0) + (d.sessions_without_date || 0);
  check('F3 sessions per month plus sessions without date add up to the sessions', !!j && sum === j.sessions, String(sum));
  check('F3 only the date is kept: no time of day in the file', !!j && !/\d{2}:\d{2}:\d{2}/.test(JSON.stringify(j)));
  cleanup(root);
  cleanup(outDir);
}

// F4: no leak, run in the all-projects mode over folders that do not hold the marker.
{
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fq-f4-ROOTSECRET-'));
  const folder = path.join(root, '-home-someone-FOLDERSECRET-project');
  fs.mkdirSync(folder);
  const fileName = 'sessionfile-FILESECRET-0001.jsonl';
  let s = '';
  s += line({ type: 'user', timestamp: '2026-03-04T12:34:56.789Z', message: { role: 'user', content: 'TEXTSECRET message body' } });
  s += line({ type: 'assistant', timestamp: '2026-03-04T12:35:10.000Z', message: { role: 'assistant', content: [{ type: 'text', text: 'TEXTSECRET reply' }, { type: 'tool_use', id: 'w', name: 'Write', input: { file_path: '/' + 'var/PATHSECRET/notes.md', content: 'TEXTSECRET' } }] } });
  s += line({ type: 'user', timestamp: '2026-03-04T12:35:11.000Z', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'w', content: 'TEXTSECRET done' }] } });
  s += 'not json TEXTSECRET and 12:34:56\n';
  for (let i = 0; i < 3; i += 1) fs.writeFileSync(path.join(folder, i === 0 ? fileName : 'x-' + i + '.jsonl'), s);
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fq-out-'));
  const out = path.join(outDir, 'all.json');
  const r = run(['--all-projects', '--projects-dir', root, '--out', out]);
  const text = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  const j = readOut(out);
  check('F4 exit 0 and three sessions counted', r.status === 0 && !!j && j.sessions === 3, 'status ' + r.status + ' ' + r.stderr);
  const all = text + '\n' + r.stdout + '\n' + r.stderr;
  const planted = ['FOLDERSECRET', 'FILESECRET', 'TEXTSECRET', 'PATHSECRET', 'ROOTSECRET', 'someone', path.basename(root), path.basename(folder), '12:34:56', '12:35:10', '34:56', 'sessionfile', 'x-1'];
  for (const p of planted) check('F4 no leak of ' + p, !all.includes(p));
  check('F4 the planted date appears and the time of day does not', text.includes('2026-03-04'));
  cleanup(root);
  cleanup(outDir);
}

// F5: an unreadable file is counted in unreadable_files, is not a session, and does not enter the statistics.
{
  const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
  if (isRoot) {
    console.log('skip F5 (the check runs as root, so mode 000 does not block a read)');
  } else {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fq-f5-'));
    const p1 = path.join(root, '-x-one');
    fs.mkdirSync(p1);
    for (let i = 0; i < 3; i += 1) fs.writeFileSync(path.join(p1, 'ok' + i + '.jsonl'), stamped('2026-05-0' + (i + 1)));
    const bad = path.join(p1, 'bad.jsonl');
    fs.writeFileSync(bad, stamped('2026-05-09'));
    fs.chmodSync(bad, 0);
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fq-out-'));
    const out = path.join(outDir, 'all.json');
    const r = run(['--all-projects', '--projects-dir', root, '--out', out]);
    const j = readOut(out);
    check('F5 exit 0', r.status === 0, 'status ' + r.status);
    check('F5 unreadable_files is 1', !!j && j.unreadable_files === 1, JSON.stringify(j && j.unreadable_files));
    check('F5 the unreadable file is not a session (3 sessions)', !!j && j.sessions === 3, JSON.stringify(j && j.sessions));
    check('F5 the unreadable file is not in the statistics (3 prompts in total, the date 2026-05-09 absent)', !!j && j.totals.prompts === 3 && !JSON.stringify(j).includes('2026-05-09'), JSON.stringify(j && j.totals && j.totals.prompts));
    fs.chmodSync(bad, 0o600);
    cleanup(root);
    cleanup(outDir);
  }
}

// F6: usage. An unknown flag exits 2; --all-projects alone (no --out) exits 2.
{
  const a = run(['--all-projects']);
  check('F6 --all-projects without --out exits 2', a.status === 2, 'status ' + a.status);
  const b = run(['--out', path.join(os.tmpdir(), 'fq-never.json'), '--bogus']);
  check('F6 an unknown flag exits 2', b.status === 2, 'status ' + b.status);
}

if (failed === 0) {
  console.log('frequency-count: ALL PASS');
  process.exit(0);
}
console.log('frequency-count: ' + failed + ' FAILED');
process.exit(1);
