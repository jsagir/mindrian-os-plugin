'use strict';
// Phase 400.5 plan 02 Task 2 (CONTEXT 5e (a)): the turn marker, the busy notes and the trace seam of the dispatcher.
//
//   node tests/test-400.5-dispatch-notes.cjs
//
// M1  no marker file: no note; after the run the file is {v:1, k:1, state:'done', pending:0, at}.
// M2  prior {k:3, started, pending 0}: the note for 1 earlier prompt comes first; after: {k:4, done, pending 0}.
// M3  prior {k:5, started, pending 1}: the note says 2 earlier prompt(s).
// M4  endTurn with elapsedMs 2600 writes nothing and notes turn_marker_late 2600; the next beginTurn carries 1.
// M5  block (E4) after {k:2, started, pending 0}: exit 2, no stdout, file {k:3, done, pending 1}; the next run shows 1.
// M6  session id '../x', empty, absent: no marker file, the note turn_marker_no_session, the normal output.
// M7  a corrupt marker file: no note, the stderr note turn_marker_corrupt, a valid file after the run.
// M8  every marker file the legs wrote has exactly the keys v, k, state, pending, at.
// B1  a trip in check 2 (child process): room_db_busy_trip for it, room_db_no_wait for each later room.db check.
// B2  no trip (child process): no busy note.
// R1  MOS_USERPROMPT_TRACE: one start line, a begin and an end line per check in CHECKS order, one exit line.
// R2  without MOS_USERPROMPT_TRACE no trace file is written.
//
// Temp HOME, MINDRIAN_HOME and MINDRIAN_ROOMS_HOME for every run (a fresh fixture copy). Hyphens only.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const parity = require(path.join(ROOT, 'tests', 'helpers', 'userprompt-parity-400-4.cjs'));
const { freshCopy, runDispatcher } = parity;

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log('PASS ' + name);
  else { failures++; console.log('FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}
function brief(o) { return JSON.stringify(o).slice(0, 500); }

let d = null;
try { d = require(path.join(ROOT, 'scripts', 'userprompt-dispatch.cjs')); } catch (e) { check('the dispatcher module loads', false, String(e && e.message || e)); }
if (!d || typeof d.beginTurn !== 'function' || typeof d.markerPath !== 'function') {
  check('M1 the dispatcher exports the turn marker (beginTurn, markerPath)', false, 'exports=' + (d ? Object.keys(d).join(',') : 'none'));
  console.log('FAILURES: ' + failures);
  process.exit(1);
}

const NOTE_RE = /^MindrianOS prompt help was skipped on (\d+) earlier prompt\(s\): hook_timeout/;
const WRITTEN = [];

function input(fx, sessionId, prompt) {
  const o = { prompt: prompt || 'what should I work on next for this venture', cwd: fx.cwd, hook_event_name: 'UserPromptSubmit' };
  if (sessionId !== undefined) o.session_id = sessionId;
  return JSON.stringify(o);
}
function markerFile(fx, sid) { return path.join(fx.home, '.mindrian', d.TURN_MARKER_DIRNAME, sid + '.json'); }
function readMarker(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_e) { return null; } }
function writeMarker(p, rec) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, typeof rec === 'string' ? rec : JSON.stringify(rec)); }
function contextOf(r) {
  try { const o = JSON.parse(r.stdout); return (o.hookSpecificOutput && o.hookSpecificOutput.additionalContext) || ''; } catch (_e) { return null; }
}
function noteCount(r) { const c = contextOf(r); const m = c ? NOTE_RE.exec(c) : null; return m ? Number(m[1]) : 0; }

// ---------- M1, M2, M3 ----------
(function legM1toM3() {
  const fx = freshCopy('room');
  try {
    const p = markerFile(fx, 's1');
    const r1 = runDispatcher(fx, input(fx, 's1'));
    const m1 = readMarker(p);
    WRITTEN.push(m1);
    check('M1 no marker: exit 0 and no skip note', r1.code === 0 && noteCount(r1) === 0, brief({ code: r1.code, ctx: (contextOf(r1) || '').slice(0, 120), err: r1.stderr.slice(0, 200) }));
    check('M1 the marker after the run is {v:1, k:1, state:done, pending:0, at:number}',
      !!m1 && m1.v === 1 && m1.k === 1 && m1.state === 'done' && m1.pending === 0 && typeof m1.at === 'number', brief(m1));

    writeMarker(p, { v: 1, k: 3, state: 'started', pending: 0 });
    const r2 = runDispatcher(fx, input(fx, 's1'));
    const c2 = contextOf(r2) || '';
    check('M2 prior started k 3: the context starts with the note for 1 earlier prompt and the separator',
      c2.startsWith(d.formatSkipNote(1) + d.CONTEXT_SEPARATOR) && c2.startsWith('MindrianOS prompt help was skipped on 1 earlier prompt(s): hook_timeout'), brief(c2.slice(0, 160)));
    const m2 = readMarker(p);
    WRITTEN.push(m2);
    check('M2 the marker after is {k:4, done, pending 0}', !!m2 && m2.k === 4 && m2.state === 'done' && m2.pending === 0, brief(m2));

    writeMarker(p, { v: 1, k: 5, state: 'started', pending: 1 });
    const r3 = runDispatcher(fx, input(fx, 's1'));
    check('M3 prior started with pending 1: the note says 2 earlier prompt(s)', noteCount(r3) === 2, brief((contextOf(r3) || '').slice(0, 120)));
    WRITTEN.push(readMarker(p));
  } finally { fx.cleanup(); }
})();

// ---------- M4 (functions) ----------
(function legM4() {
  const fx = freshCopy('virgin');
  try {
    const notes = [];
    const info = d.beginTurn('s4', { home: fx.home, now: 1000, notes });
    const p = d.markerPath('s4', fx.home);
    check('M4 beginTurn on no record returns k 1 and carry 0', !!info && info.k === 1 && info.carry === 0 && info.path === p, brief(info));
    const wrote = d.endTurn(info, { delivered: true, elapsedMs: 2600, notes });
    const m = readMarker(p);
    WRITTEN.push(m);
    check('M4 endTurn at 2600 ms writes nothing (the record stays started)', wrote === false && !!m && m.state === 'started' && m.k === 1, brief(m));
    check('M4 endTurn at 2600 ms notes turn_marker_late 2600', notes.includes('turn_marker_late 2600'), brief(notes));
    const next = d.beginTurn('s4', { home: fx.home, now: 2000, notes });
    check('M4 the next beginTurn returns carry 1', !!next && next.carry === 1 && next.k === 2, brief(next));
    WRITTEN.push(readMarker(p));
  } finally { fx.cleanup(); }
})();

// ---------- M5 (block) ----------
(function legM5() {
  const fx = freshCopy('room');
  try {
    const p = markerFile(fx, 's5');
    writeMarker(p, { v: 1, k: 2, state: 'started', pending: 0 });
    const r = runDispatcher(fx, input(fx, 's5', '/mos:admin'));
    const m = readMarker(p);
    WRITTEN.push(m);
    check('M5 block: exit 2 and no stdout', r.code === 2 && r.stdout === '', brief({ code: r.code, out: r.stdout.slice(0, 100) }));
    check('M5 block: the stderr holds no skip note', !/MindrianOS prompt help was skipped/.test(r.stderr), brief(r.stderr.slice(0, 200)));
    check('M5 block: the marker after is {k:3, done, pending 1}', !!m && m.k === 3 && m.state === 'done' && m.pending === 1, brief(m));
    const r2 = runDispatcher(fx, input(fx, 's5'));
    const m2 = readMarker(p);
    WRITTEN.push(m2);
    check('M5 the next non-block run shows the note with 1', noteCount(r2) === 1, brief((contextOf(r2) || '').slice(0, 120)));
    check('M5 then the marker has pending 0', !!m2 && m2.k === 4 && m2.state === 'done' && m2.pending === 0, brief(m2));
  } finally { fx.cleanup(); }
})();

// ---------- M6 (unsafe or missing session id) ----------
(function legM6() {
  for (const [label, sid] of [['../x', '../x'], ['empty', ''], ['absent', undefined]]) {
    const fx = freshCopy('room');
    try {
      const r = runDispatcher(fx, input(fx, sid));
      const dir = path.join(fx.home, '.mindrian', d.TURN_MARKER_DIRNAME);
      const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
      let ok = false;
      try { ok = r.code === 0 && typeof JSON.parse(r.stdout) === 'object'; } catch (_e) { ok = false; }
      check('M6 session id ' + label + ': no marker file', files.length === 0, brief(files));
      check('M6 session id ' + label + ': the stderr note turn_marker_no_session', /turn_marker_no_session/.test(r.stderr), brief(r.stderr.slice(0, 200)));
      check('M6 session id ' + label + ': the normal output (exit 0, one JSON envelope)', ok, brief({ code: r.code, out: r.stdout.slice(0, 100) }));
      check('M6 session id ' + label + ': no file outside the marker dir from the id', !fs.existsSync(path.join(fx.home, '.mindrian', 'x.json')));
    } finally { fx.cleanup(); }
  }
})();

// ---------- M7 (corrupt file) ----------
(function legM7() {
  const fx = freshCopy('room');
  try {
    const p = markerFile(fx, 's7');
    writeMarker(p, 'not json {');
    const r = runDispatcher(fx, input(fx, 's7'));
    const m = readMarker(p);
    WRITTEN.push(m);
    check('M7 a corrupt marker gives no note', r.code === 0 && noteCount(r) === 0, brief((contextOf(r) || '').slice(0, 120)));
    check('M7 the stderr note turn_marker_corrupt', /turn_marker_corrupt/.test(r.stderr), brief(r.stderr.slice(0, 200)));
    check('M7 a valid file after the run', !!m && m.v === 1 && m.k === 1 && m.state === 'done' && m.pending === 0, brief(m));
  } finally { fx.cleanup(); }
})();

// ---------- M8 ----------
(function legM8() {
  const want = 'at,k,pending,state,v';
  const bad = WRITTEN.filter((m) => !m || Object.keys(m).sort().join(',') !== want);
  check('M8 every marker file written has exactly the keys v, k, state, pending, at (' + WRITTEN.length + ' files)', WRITTEN.length >= 8 && bad.length === 0, brief(bad));
})();

// ---------- B1, B2 (child processes: the trip is module state) ----------
function busyChild(trip) {
  const src = `'use strict';
const cap = require(${JSON.stringify(path.join(ROOT, 'lib', 'core', 'hook-busy-cap.cjs'))});
const d = require(${JSON.stringify(path.join(ROOT, 'scripts', 'userprompt-dispatch.cjs'))});
cap.setHookBusyCap(750);
const TRIP = ${trip ? 'true' : 'false'};
function f(id, busy) { return { id, file: 'fake/' + id, argv: [], budgetMs: 500, load: () => ({ run: async () => { if (busy) cap.noteBusy(); return { code: 0, stdout: '', stderr: '' }; } }) }; }
d.dispatch('', { checks: [f('first-install-router'), f('intent-classifier', TRIP), f('brain-derivation-drain'), f('admin-command-gate'), f('auto-explore-drain')] })
  .then((r) => { process.stdout.write(JSON.stringify(r.notes)); process.exit(0); });
`;
  const res = spawnSync('node', ['-e', src], { encoding: 'utf8', timeout: 60000, cwd: parity.TMP });
  try { return JSON.parse(res.stdout); } catch (_e) { return { fatal: res.stderr.slice(0, 300) }; }
}
(function legB() {
  const n1 = busyChild(true);
  check('B1 the trip is named: room_db_busy_trip intent-classifier', Array.isArray(n1) && n1.includes('room_db_busy_trip intent-classifier'), brief(n1));
  check('B1 each later room.db check is named: room_db_no_wait brain-derivation-drain and auto-explore-drain',
    Array.isArray(n1) && n1.includes('room_db_no_wait brain-derivation-drain') && n1.includes('room_db_no_wait auto-explore-drain'), brief(n1));
  check('B1 no busy note for the two checks that do not open room.db',
    Array.isArray(n1) && !n1.some((n) => /room_db_(busy_trip|no_wait) (first-install-router|admin-command-gate)$/.test(n)), brief(n1));
  const n2 = busyChild(false);
  check('B2 no trip: no room_db_busy_trip and no room_db_no_wait note', Array.isArray(n2) && !n2.some((n) => /room_db_busy_trip|room_db_no_wait/.test(n)), brief(n2));
})();

// ---------- R1, R2 (trace seam) ----------
(function legR() {
  const fx = freshCopy('room');
  try {
    const tracePath = path.join(fx.root, 'trace.jsonl');
    const r = runDispatcher(fx, input(fx, 'sr1'), { MOS_USERPROMPT_TRACE: tracePath });
    let lines = [];
    try { lines = fs.readFileSync(tracePath, 'utf8').trim().split('\n').map((l) => JSON.parse(l)); } catch (e) { lines = [{ fatal: e.message }]; }
    const ids = d.CHECKS.map((c) => c.id);
    const want = ['start'].concat(...ids.map((id) => ['begin:' + id, 'end:' + id])).concat(['exit']);
    const got = lines.map((l) => (l.ev === 'begin' || l.ev === 'end') ? l.ev + ':' + l.id : l.ev);
    check('R1 the trace has start, a begin and an end per check in CHECKS order, and exit', JSON.stringify(got) === JSON.stringify(want), brief(got));
    const allowed = new Set(['ev', 'k', 'id', 't', 'outcome', 'trip', 'code', 'elapsed_ms']);
    check('R1 each line has only the keys ev, k, id, t, outcome, trip, code, elapsed_ms', lines.every((l) => Object.keys(l).every((k) => allowed.has(k))), brief(lines.slice(0, 3)));
    const exit = lines[lines.length - 1] || {};
    check('R1 the exit line has the code and elapsed_ms', exit.ev === 'exit' && exit.code === r.code && typeof exit.elapsed_ms === 'number' && exit.k === 1, brief(exit));
    check('R1 the end lines hold an outcome', lines.filter((l) => l.ev === 'end').every((l) => typeof l.outcome === 'string' && typeof l.trip === 'boolean'), brief(lines.filter((l) => l.ev === 'end')));

    const tracePath2 = path.join(fx.root, 'trace2.jsonl');
    runDispatcher(fx, input(fx, 'sr2'));
    check('R2 without MOS_USERPROMPT_TRACE no trace file is written', !fs.existsSync(tracePath2) && fs.readdirSync(fx.root).filter((n) => /trace/.test(n)).length === 1);
  } finally { fx.cleanup(); }
})();

console.log(failures === 0 ? 'ALL PASS' : 'FAILURES: ' + failures);
process.exit(failures === 0 ? 0 : 1);
