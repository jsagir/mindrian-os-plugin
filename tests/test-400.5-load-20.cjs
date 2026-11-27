'use strict';
// Phase 400.5 plan 01: the G11 live load leg (CONTEXT 5e, the first acceptance gate of Path H).
//
//   node tests/test-400.5-load-20.cjs                       -> SKIP, exit 77 (no host starts)
//   node tests/test-400.5-load-20.cjs --self-test           -> legs S2 to S7, no host, no network
//   MOS_LIVE_LOAD=1 node tests/test-400.5-load-20.cjs --label base|dispatcher [--arm contention|held-lock]
//       [--prompts N] [--out FILE] [--smoke] [--seed-missed-turn] [--keep]
//
// The live run starts ONE long-lived `claude -p` stream-json host process on the 2,105-artifact large-room fixture
// (born room.db) under N busy loops (N = core count) and the room.db writer or lock holder of the arm, sends N prompts,
// and counts UserPromptSubmit hook_cancelled in three sources: S1 the session transcript, S2 the stream-json hook
// events, S3 the debug file. S4 is the dispatcher trace (MOS_USERPROMPT_TRACE). The result JSON holds reduced fields
// only (no reply text, no raw line). Exit 0 PASS, 1 FAIL, 2 INCONCLUSIVE.
// Safety: the host gets MINDRIAN_ROOMS_HOME=<scratch>/rooms; a before and after snapshot of ~/MindrianRooms fails the
// run with real_rooms_touched.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const { startCpuLoad } = require('./helpers/cpu-load-400-5.cjs');
const { holdLock, startWriter, stopChild, isBusyError } = require('./helpers/room-db-lock-400-5.cjs');

const PROMPT_LIMIT_MS = 180000;
const HOST_EXIT_WAIT_MS = 30000;
const LOCK_HOLD_MS = 6000;
const WRITER = { everyMs: 200, holdMs: 50 };
const ROOM_SLUG = 'load-room-400-5';
const SKIP_NOTE_TEXT = 'MindrianOS prompt help was skipped';
const VOICE_TEXT = 'Voice reminder:';
const NOTE_NAMES = ['skipped_deadline', 'over_deadline', 'room_db_busy_trip', 'room_db_no_wait', 'room_db_busy',
  'context_over_cap', 'check_load_failed', 'check_threw'];
const REMOVED_EXACT = ['CLAUDECODE', 'CLAUDE_CODE_SESSION_ID', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_PLUGIN_ROOT',
  'CLAUDE_PROJECT_DIR', 'CLAUDE_ACTIVE_ROOM'];
// The host command. '<repo root>', '<uuid>' and '<scratch>' are filled at run time; '--tools' gets one empty argument.
const HOST_ARGS = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose',
  '--include-hook-events', '--replay-user-messages', '--plugin-dir', '<repo root>', '--setting-sources', 'project',
  '--model', 'haiku', '--tools', '', '--session-id', '<uuid>', '--debug-file', '<scratch>/host-debug.log'];

// The text of a transcript or stream user message: a string, or the text blocks of an array.
function textOf(message) {
  if (!message) return '';
  const c = message.content !== undefined ? message.content : message;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map((b) => (b && typeof b.text === 'string' ? b.text : (typeof b === 'string' ? b : ''))).join('\n');
  return '';
}

function parseLine(l) {
  if (l && typeof l === 'object') return l;
  try { return JSON.parse(l); } catch (_e) { return null; }
}

// S1: map each UserPromptSubmit attachment to the latest earlier user entry whose text holds a token.
// Returns {prompts: [[attachment...] per token index], unmapped}.
function mapTranscript(lines, tokens) {
  const prompts = tokens.map(() => []);
  let current = -1; let unmapped = 0;
  for (const raw of lines) {
    const e = parseLine(raw);
    if (!e) continue;
    if (e.type === 'user' && e.message) {
      const text = textOf(e.message);
      const idx = tokens.findIndex((t) => text.includes(t));
      if (idx >= 0) current = idx;
      continue;
    }
    if (e.type === 'attachment' && e.attachment && e.attachment.hookEvent === 'UserPromptSubmit') {
      const a = e.attachment;
      const rec = {
        type: a.type, command: typeof a.command === 'string' ? a.command : '', durationMs: typeof a.durationMs === 'number' ? a.durationMs : null,
        timedOut: a.timedOut === true, exitCode: typeof a.exitCode === 'number' ? a.exitCode : null,
        text: [a.content, a.stdout].filter((x) => typeof x === 'string').join('\n'), stderr: typeof a.stderr === 'string' ? a.stderr : '',
      };
      if (current < 0) unmapped++;
      else prompts[current].push(rec);
    }
  }
  return { prompts, unmapped };
}

function namesUserPromptSubmit(o) {
  for (const k of Object.keys(o)) { if (typeof o[k] === 'string' && o[k] === 'UserPromptSubmit') return true; }
  for (const k of ['hook_event', 'hookEvent', 'hook_event_name', 'hook_name', 'hookName']) {
    if (typeof o[k] === 'string' && o[k].includes('UserPromptSubmit')) return true;
  }
  return false;
}
function isCancelResponse(o) {
  if (o.timed_out === true || o.timedOut === true || o.cancelled === true) return true;
  for (const k of ['outcome', 'status', 'result']) { if (typeof o[k] === 'string' && /cancel|timeout|timed[ _]?out/i.test(o[k])) return true; }
  return false;
}
// S2: stream system hook events of one prompt, [{t, line}]. One run per hook_started; a response that names a cancel or
// timeout is a cancel. overheadMs is the largest started-to-response delta (matched by hook_id).
function countStream(items) {
  let runs = 0; let cancels = 0; let overheadMs = null;
  const started = new Map();
  for (const it of items) {
    const o = parseLine(it.line);
    if (!o || o.type !== 'system' || typeof o.subtype !== 'string' || !o.subtype.startsWith('hook_')) continue;
    if (!namesUserPromptSubmit(o)) continue;
    if (o.subtype === 'hook_started') { runs++; if (o.hook_id) started.set(o.hook_id, it.t); }
    else if (o.subtype === 'hook_response') {
      if (isCancelResponse(o)) cancels++;
      if (o.hook_id && started.has(o.hook_id)) {
        const d = it.t - started.get(o.hook_id);
        overheadMs = overheadMs === null ? d : Math.max(overheadMs, d);
      }
    } else if (/cancel/i.test(o.subtype)) cancels++;
  }
  return { runs, cancels, overheadMs };
}

// The host env: process.env without the session and plugin keys and every MOS_ and MINDRIAN_ key, plus the 3 keys.
function hostEnv(src, scratch) {
  const env = {}; const removed = [];
  for (const k of Object.keys(src)) {
    if (REMOVED_EXACT.includes(k) || k.startsWith('MOS_') || k.startsWith('MINDRIAN_')) { removed.push(k); continue; }
    env[k] = src[k];
  }
  env.MINDRIAN_ROOMS_HOME = path.join(scratch, 'rooms');
  env.MINDRIAN_ADMIN_IDENTITY_PATH = path.join(scratch, 'no-admin-identity.json');
  env.MOS_USERPROMPT_TRACE = path.join(scratch, 'dispatch-trace.jsonl');
  return { env, removed: removed.sort() };
}

// verdict(summary, flags): INCONCLUSIVE, then FAIL, else PASS.
function verdict(summary, flags) {
  const f = flags || {};
  if (f.host_started === false || f.prompt_timeout === true || f.foreign_session === true || f.transcript_found === false) return 'INCONCLUSIVE';
  if ((summary.unmapped_attachments || 0) > 0) return 'INCONCLUSIVE';
  if ((summary.cancel_total || 0) > 0) return 'FAIL';
  if (summary.runs_source !== 'none' && (summary.prompts_with_runs_below_H || 0) > 0) return 'FAIL';
  if (summary.real_rooms_touched === true) return 'FAIL';
  return 'PASS';
}

// S3: classify one debug-file line. Only a hook status line of UserPromptSubmit counts; a line that carries hook output
// ('success:' with stdout or stderr text) never counts, so a context text with the word timeout is not a cancel.
function classifyDebugLine(l) {
  const s = String(l || '');
  if (!s.includes('UserPromptSubmit')) return null;
  if (/\bsuccess:/.test(s) || /finished with status 0\b/.test(s)) return 'ok';
  if (/cancel|timed out|timeout/i.test(s)) return 'cancel';
  if (/\b(running|executing|starting)\b/i.test(s)) return 'start';
  return null;
}

// The dispatcher stderr note names in a text (names only, no values).
function noteNames(text) {
  const out = [];
  const s = String(text || '');
  for (const n of NOTE_NAMES) { if (new RegExp('\\b' + n + '\\b').test(s) && !out.includes(n)) out.push(n); }
  const m = s.match(/\bturn_marker_[a-z_]+/g);
  if (m) for (const n of m) if (!out.includes(n)) out.push(n);
  return out;
}

// ---- live run helpers ------------------------------------------------------------------------------------------
function readJsonLines(file) {
  try { return fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim()); } catch (_e) { return []; }
}
function realRoomsSnapshot() {
  const dir = path.join(os.homedir(), 'MindrianRooms');
  if (!fs.existsSync(dir)) return { exists: false, entries: [] };
  const entries = fs.readdirSync(dir).sort().map((n) => {
    const p = path.join(dir, n); let st = null;
    try { st = fs.statSync(p); } catch (_e) { return { n, missing: true }; }
    const e = { n, m: st.mtimeMs };
    if (st.isFile() && n.endsWith('.json')) { try { e.sha = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); } catch (_e) { e.sha = 'unreadable'; } }
    return e;
  });
  return { exists: true, entries };
}
function sampleLoad() {
  let la = null; let io = null;
  try { la = Number(fs.readFileSync('/proc/loadavg', 'utf8').split(/\s+/)[0]); } catch (_e) { /* none */ }
  try { const m = /some avg10=([0-9.]+)/.exec(fs.readFileSync('/proc/pressure/io', 'utf8')); if (m) io = Number(m[1]); } catch (_e) { /* none */ }
  return { la, io };
}
function findTranscript(uuid) {
  const base = path.join(os.homedir(), '.claude', 'projects');
  let dirs = [];
  try { dirs = fs.readdirSync(base); } catch (_e) { return null; }
  for (const d of dirs) { const p = path.join(base, d, uuid + '.jsonl'); if (fs.existsSync(p)) return p; }
  return null;
}
function maskLine(l, scratch, uuid) {
  let s = String(l);
  if (scratch) s = s.split(scratch).join('<SCRATCH>');
  s = s.split(ROOT).join('<REPO>').split(os.homedir()).join('<HOME>');
  if (uuid) s = s.split(uuid).join('<UUID>');
  s = s.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<ID>');
  return s.slice(0, 300);
}
function pctl(arr, p) {
  const a = arr.filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return null;
  return a[Math.min(a.length - 1, Math.max(0, Math.ceil((p / 100) * a.length) - 1))];
}
function parseArgs(argv) {
  const o = { label: null, arm: 'contention', prompts: 20, out: null, smoke: false, seed: false, keep: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--label') o.label = argv[++i];
    else if (a === '--arm') o.arm = argv[++i];
    else if (a === '--prompts') o.prompts = Number(argv[++i]);
    else if (a === '--out') o.out = argv[++i];
    else if (a === '--smoke') o.smoke = true;
    else if (a === '--seed-missed-turn') o.seed = true;
    else if (a === '--keep') o.keep = true;
  }
  if (o.smoke) o.prompts = 2;
  return o;
}
function countUserPromptHooks() {
  try { const h = JSON.parse(fs.readFileSync(path.join(ROOT, 'hooks', 'hooks.json'), 'utf8')).hooks.UserPromptSubmit || []; return h.reduce((n, g) => n + ((g && g.hooks) || []).length, 0); } catch (_e) { return null; }
}

async function liveRun(o) {
  if (o.label !== 'base' && o.label !== 'dispatcher') { console.error('--label base|dispatcher is required in live mode'); return 2; }
  if (o.arm !== 'contention' && o.arm !== 'held-lock') { console.error('--arm contention|held-lock'); return 2; }
  if (o.seed && o.label !== 'dispatcher') { console.error('--seed-missed-turn needs --label dispatcher'); return 2; }
  const runId = crypto.randomBytes(3).toString('hex');
  const t0 = Date.now();
  const now = () => Date.now() - t0;
  // (1) preflight
  const cv = spawnSync('claude', ['--version'], { encoding: 'utf8' });
  const pre = {
    claude_version: (cv.stdout || '').trim() || null, node: process.version, cores: os.cpus().length,
    head: (spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout || '').trim(), H: countUserPromptHooks(),
    loadavg_start: (() => { try { return fs.readFileSync('/proc/loadavg', 'utf8').trim(); } catch (_e) { return null; } })(),
  };
  console.log('preflight ' + JSON.stringify(pre));
  // (2) real rooms snapshot
  const snapBefore = JSON.stringify(realRoomsSnapshot());
  // (3) scratch and the fixture
  const scratch = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mos-load-400-5-')));
  const forbidden = [path.join(os.homedir(), 'MindrianRooms'), path.join(os.homedir(), '.mindrian')];
  if (forbidden.some((f) => scratch === f || scratch.startsWith(f + path.sep))) { console.error('scratch under a real rooms path'); return 2; }
  const { buildLargeRoom } = require(path.join(ROOT, 'tests', 'fixtures', 'large-room', 'build-fixture.cjs'));
  const built = buildLargeRoom(scratch, { slug: ROOM_SLUG });
  const roomDir = built.roomDir;
  const roomsHome = path.join(scratch, 'rooms');
  {
    const previous = process.env.MINDRIAN_ROOMS_HOME;
    process.env.MINDRIAN_ROOMS_HOME = roomsHome;
    try {
      const birth = require(path.join(ROOT, 'lib', 'core', 'navigation', 'room-birth.cjs')).birthRoom({
        slug: ROOM_SLUG, roomDir, sessionId: 'load-leg-400-5', ventureText: 'a generated room that tests the prompt hooks under load',
        jtbd: '', approvedBy: 'load-leg-400-5', canonicalRole: 'founder', vname: ROOM_SLUG, vstage: 'Pre-Opportunity',
      });
      if (!birth || birth.ok !== true || !fs.existsSync(path.join(roomDir, '.mindrian', 'room.db'))) throw new Error('room_birth_failed');
    } finally {
      if (previous === undefined) delete process.env.MINDRIAN_ROOMS_HOME; else process.env.MINDRIAN_ROOMS_HOME = previous;
    }
  }
  console.log('fixture artifacts=' + built.artifacts);
  // (4) host env (5) session id
  const he = hostEnv(process.env, scratch);
  const uuid = crypto.randomUUID();
  const markerFile = path.join(os.homedir(), '.mindrian', 'userprompt-turns', uuid + '.json');
  const cueFile = path.join(os.homedir(), '.mindrian', 'next-move', uuid + '.json');
  if (o.seed) {
    fs.mkdirSync(path.dirname(markerFile), { recursive: true });
    fs.writeFileSync(markerFile, JSON.stringify({ v: 1, k: 7, state: 'started', pending: 0, at: Date.now() }));
  }
  // (6) load
  const samples = [];
  const sampler = setInterval(() => samples.push(sampleLoad()), 1000);
  samples.push(sampleLoad());
  const load = o.smoke ? null : startCpuLoad(os.cpus().length);
  let writer = null;
  if (!o.smoke && o.arm === 'contention') { writer = startWriter(roomDir, WRITER); await writer.ready; }
  // (7) host
  const args = HOST_ARGS.map((a) => (a === '<repo root>' ? ROOT : a === '<uuid>' ? uuid : a === '<scratch>/host-debug.log' ? path.join(scratch, 'host-debug.log') : a));
  console.log('host command: claude ' + args.map((a) => (a === '' ? '""' : a)).join(' '));
  const flags = { host_started: false, prompt_timeout: false, foreign_session: false, transcript_found: false };
  const stream = []; // {t, line(obj)}
  const sessionIds = new Set();
  let initPlugins = null;
  const host = spawn('claude', args, { cwd: roomDir, env: he.env, stdio: ['pipe', 'pipe', 'pipe'] });
  let hostErr = '';
  host.stderr.on('data', (d) => { if (hostErr.length < 20000) hostErr += d.toString(); });
  let buf = '';
  let waiter = null;
  host.stdout.on('data', (d) => {
    buf += d.toString();
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      if (!line.trim()) continue;
      const obj = parseLine(line);
      if (!obj) continue;
      flags.host_started = true;
      stream.push({ t: now(), line: obj });
      if (obj.session_id) sessionIds.add(obj.session_id);
      if (obj.type === 'system' && obj.subtype === 'init' && Array.isArray(obj.plugins)) {
        initPlugins = obj.plugins.map((p) => ({ name: p && p.name, is_repo_root: !!(p && typeof p.path === 'string' && path.resolve(p.path) === ROOT) }));
      }
      if (obj.type === 'result' && waiter) { const w = waiter; waiter = null; w(obj); }
    }
  });
  let hostExited = false;
  host.on('exit', () => { hostExited = true; if (waiter) { const w = waiter; waiter = null; w(null); } });
  host.on('error', () => { hostExited = true; if (waiter) { const w = waiter; waiter = null; w(null); } });
  // (8) prompts
  const tokens = []; const writes = []; const results = [];
  for (let i = 1; i <= o.prompts; i++) {
    if (hostExited) break;
    const token = 't4005-' + runId + '-' + i;
    tokens.push(token);
    let holder = null;
    if (!o.smoke && o.arm === 'held-lock') holder = await holdLock(roomDir, LOCK_HOLD_MS);
    const text = 'Prompt ' + i + ' of ' + o.prompts + ', token ' + token + ': what should I work on next for this venture? Reply in one short sentence. Do not use any tool.';
    const got = new Promise((resolve) => {
      waiter = resolve;
      setTimeout(() => { if (waiter === resolve) { waiter = null; resolve('timeout'); } }, PROMPT_LIMIT_MS);
    });
    const tw = now();
    writes.push(tw);
    host.stdin.write(JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text }] } }) + '\n');
    const r = await got;
    const tr = now();
    if (r === 'timeout') { flags.prompt_timeout = true; results.push({ t: tr, ok: false }); }
    else results.push({ t: tr, ok: !!r, is_error: r ? r.is_error === true : null });
    if (holder) await new Promise((res) => { if (holder.exitCode !== null) return res(); holder.on('exit', () => res()); });
    console.log('prompt ' + i + ' ' + (r === 'timeout' ? 'TIMEOUT' : r ? 'result' : 'host-exit') + ' ' + (tr - tw) + ' ms');
    if (r === 'timeout' || !r) break;
  }
  // (9) close
  try { host.stdin.end(); } catch (_e) { /* closed */ }
  await new Promise((res) => {
    if (hostExited) return res();
    const k = setTimeout(() => { try { host.kill('SIGTERM'); } catch (_e) { /* gone */ } res(); }, HOST_EXIT_WAIT_MS);
    host.on('exit', () => { clearTimeout(k); res(); });
  });
  const writerCounts = writer ? await writer.stop() : { cycles: 0, busy: 0, other: 0 };
  if (load) await load.stop();
  clearInterval(sampler);
  samples.push(sampleLoad());
  for (const s of sessionIds) if (s !== uuid) flags.foreign_session = true;
  // (10) sources
  await new Promise((r) => setTimeout(r, 1000));
  const tpath = findTranscript(uuid);
  flags.transcript_found = !!tpath;
  const s1 = mapTranscript(tpath ? readJsonLines(tpath) : [], tokens);
  // S2: map each stream hook event to the prompt whose write came before it and whose result had not come yet.
  const s2ByPrompt = tokens.map(() => []);
  const s2Subtypes = new Set(); const s2Fields = new Set();
  for (const it of stream) {
    const ob = it.line;
    if (!(ob.type === 'system' && typeof ob.subtype === 'string' && ob.subtype.startsWith('hook_'))) continue;
    if (!namesUserPromptSubmit(ob)) continue;
    s2Subtypes.add(ob.subtype);
    Object.keys(ob).forEach((k) => s2Fields.add(k));
    let idx = -1;
    for (let j = 0; j < writes.length; j++) { if (writes[j] <= it.t && (!results[j] || results[j].t >= it.t)) idx = j; }
    if (idx >= 0) s2ByPrompt[idx].push(it);
  }
  // S3: debug-file lines that hold UserPromptSubmit, mapped by their leading timestamp to the prompt window.
  const dbgLines = (() => { try { return fs.readFileSync(path.join(scratch, 'host-debug.log'), 'utf8').split('\n'); } catch (_e) { return []; } })();
  const s3ByPrompt = tokens.map(() => ({ cancels: 0, starts: 0 }));
  let s3Unmapped = 0; const s3Sample = [];
  for (const l of dbgLines) {
    if (!l.includes('UserPromptSubmit')) continue;
    if (s3Sample.length < 3) s3Sample.push(maskLine(l, scratch, uuid));
    const kind = classifyDebugLine(l);
    const isCancel = kind === 'cancel';
    const isStart = kind === 'start';
    const m = /^(\d{4}-\d{2}-\d{2}T[0-9:.]+Z)/.exec(l.trim());
    let idx = -1;
    if (m) {
      const tl = Date.parse(m[1]) - t0;
      for (let j = 0; j < writes.length; j++) { if (writes[j] - 50 <= tl && (!results[j] || results[j].t >= tl)) idx = j; }
    }
    if (idx < 0) { if (isCancel) s3Unmapped++; continue; }
    if (isCancel) s3ByPrompt[idx].cancels++;
    if (isStart) s3ByPrompt[idx].starts++;
  }
  // S4: the dispatcher trace, grouped by k in ascending order.
  const traceByK = new Map();
  for (const l of readJsonLines(he.env.MOS_USERPROMPT_TRACE)) {
    const e = parseLine(l); if (!e || typeof e.k !== 'number') continue;
    if (!traceByK.has(e.k)) traceByK.set(e.k, []);
    traceByK.get(e.k).push(e);
  }
  const traceTurns = Array.from(traceByK.keys()).sort((a, b) => a - b).map((k) => traceByK.get(k));
  // per-prompt metrics
  const H = pre.H;
  const perHook = {};
  const prompts = tokens.map((token, j) => {
    const atts = s1.prompts[j] || [];
    const s2 = countStream(s2ByPrompt[j]);
    const turn = traceTurns[j] || null;
    const traceExits = turn ? turn.filter((e) => e.ev === 'exit').length : 0;
    let runs = null; let runsSource = 'none';
    if (s2ByPrompt[j].some((x) => x.line.subtype === 'hook_started')) { runs = s2.runs; runsSource = 's2_hook_started'; }
    else if (o.label === 'dispatcher' && turn) { runs = turn.filter((e) => e.ev === 'start').length; runsSource = 's4_trace'; }
    else if (s3ByPrompt[j].starts > 0) { runs = s3ByPrompt[j].starts; runsSource = 's3_debug'; }
    const cancelsS1 = atts.filter((a) => a.type === 'hook_cancelled' || a.timedOut).length;
    const cancelsS2 = s2.cancels; const cancelsS3 = s3ByPrompt[j].cancels;
    const s1Dur = atts.map((a) => a.durationMs).filter((x) => typeof x === 'number');
    let overhead = null; let overheadSource = 'none';
    if (s1Dur.length) { overhead = Math.max.apply(null, s1Dur); overheadSource = 's1_durationMs'; }
    if (o.label === 'base' && s2.overheadMs !== null && (overhead === null || s2.overheadMs > overhead)) { overhead = s2.overheadMs; overheadSource = 's2_started_to_response'; }
    if (overhead === null && s2.overheadMs !== null) { overhead = s2.overheadMs; overheadSource = 's2_started_to_response'; }
    const ctx = atts.map((a) => a.text).join('\n') + '\n' + s2ByPrompt[j].map((x) => [x.line.output, x.line.stdout].filter((v) => typeof v === 'string').join('\n')).join('\n');
    const errText = atts.map((a) => a.stderr).join('\n') + '\n' + s2ByPrompt[j].map((x) => (typeof x.line.stderr === 'string' ? x.line.stderr : '')).join('\n');
    for (const a of atts) {
      const key = a.command || '(no command)';
      perHook[key] = perHook[key] || { runs: 0, cancels: 0, durations: [] };
      perHook[key].runs++;
      if (a.type === 'hook_cancelled' || a.timedOut) perHook[key].cancels++;
      if (typeof a.durationMs === 'number') perHook[key].durations.push(a.durationMs);
    }
    return {
      i: j + 1, token, runs, runs_source: runsSource, cancels: Math.max(cancelsS1, cancelsS2, cancelsS3),
      cancels_s1: cancelsS1, cancels_s2: cancelsS2, cancels_s3: cancelsS3, overhead_ms: overhead, overhead_source: overheadSource,
      skip_note: ctx.includes(SKIP_NOTE_TEXT), has_voice_reminder: ctx.includes(VOICE_TEXT), notes: noteNames(errText + '\n' + ctx),
      trace_exit: o.label === 'dispatcher' ? traceExits > 0 : null, wall_ms: results[j] ? results[j].t - writes[j] : null,
    };
  });
  const perHookOut = {};
  for (const k of Object.keys(perHook)) perHookOut[k] = { runs: perHook[k].runs, cancels: perHook[k].cancels, p95_duration_ms: pctl(perHook[k].durations, 95) };
  // (11) real rooms again
  const realTouched = JSON.stringify(realRoomsSnapshot()) !== snapBefore;
  const sources = prompts.map((p) => p.runs_source);
  const summary = {
    prompts_sent: writes.length, results: results.filter((r) => r.ok).length,
    cancel_total: prompts.reduce((n, p) => n + p.cancels, 0) + s3Unmapped,
    prompts_with_runs_below_H: prompts.filter((p) => p.runs !== null && H !== null && p.runs < H).length,
    runs_source: sources.every((s) => s === sources[0]) ? (sources[0] || 'none') : 'mixed',
    p50_overhead_ms: pctl(prompts.map((p) => p.overhead_ms), 50), p95_overhead_ms: pctl(prompts.map((p) => p.overhead_ms), 95),
    skip_note_prompts: prompts.filter((p) => p.skip_note).map((p) => p.i),
    loadavg_min: pctl(samples.map((s) => s.la), 0) === null ? null : Math.min.apply(null, samples.map((s) => s.la).filter((x) => x !== null)),
    loadavg_max: samples.some((s) => s.la !== null) ? Math.max.apply(null, samples.map((s) => s.la).filter((x) => x !== null)) : null,
    io_pressure_avg10_max: samples.some((s) => s.io !== null) ? Math.max.apply(null, samples.map((s) => s.io).filter((x) => x !== null)) : null,
    writer: writerCounts, host_pids: host.pid ? 1 : 0, session_ids: Array.from(sessionIds).map((s) => (s === uuid ? 'own' : 'other')),
    real_rooms_touched: realTouched, unmapped_attachments: s1.unmapped,
  };
  if (prompts.length < o.prompts) flags.prompt_timeout = flags.prompt_timeout || !flags.host_started || hostExited;
  const v = verdict(summary, flags);
  let firstNotOk = null;
  if (v !== 'PASS') {
    const f = [];
    for (const k of Object.keys(flags)) if ((k === 'host_started' || k === 'transcript_found') ? !flags[k] : flags[k]) f.push(k);
    if (summary.unmapped_attachments) f.push('unmapped_attachments=' + summary.unmapped_attachments);
    if (summary.cancel_total) f.push('cancel_total=' + summary.cancel_total);
    if (summary.prompts_with_runs_below_H) f.push('prompts_with_runs_below_H=' + summary.prompts_with_runs_below_H);
    if (summary.real_rooms_touched) f.push('real_rooms_touched');
    if (prompts.length < o.prompts) f.push('prompts_answered=' + prompts.length + '/' + o.prompts);
    if (!flags.host_started && hostErr) f.push('host_stderr=' + maskLine(hostErr.split('\n')[0], scratch, uuid));
    firstNotOk = f.join('; ');
  }
  const outObj = {
    label: o.label, arm: o.arm, smoke: o.smoke, head: pre.head, claude_version: pre.claude_version, node: pre.node, cores: pre.cores, H,
    host_command: 'claude ' + HOST_ARGS.map((a) => (a === '' ? '""' : a)).join(' '), removed_env_keys: he.removed,
    plugins: initPlugins, seed_missed_turn: o.seed, prompts, per_hook: perHookOut, summary,
    sources: { s1_path: tpath ? maskLine(tpath, scratch, uuid) : null, s2_subtypes_seen: Array.from(s2Subtypes).sort(), s2_field_names: Array.from(s2Fields).sort(), s3_sample_masked: s3Sample, s3_unmapped_cancels: s3Unmapped, s4_turns: traceTurns.length },
    trace_turns: o.label === 'dispatcher' ? traceTurns.map((turn) => turn.map((e) => { const r = {}; for (const k of ['ev', 'k', 'id', 't', 'outcome', 'trip', 'code', 'elapsed_ms']) if (e[k] !== undefined) r[k] = e[k]; return r; })) : null,
    marker_after: (() => { try { const m = JSON.parse(fs.readFileSync(markerFile, 'utf8')); return { k: m.k, state: m.state, pending: m.pending }; } catch (_e) { return null; } })(),
    flags, loadavg_start: pre.loadavg_start, verdict: v, first_not_ok: firstNotOk,
  };
  // (12) clean up
  for (const f of [markerFile, cueFile]) { try { fs.rmSync(f, { force: true }); } catch (_e) { /* gone */ } }
  if (!o.keep) fs.rmSync(scratch, { recursive: true, force: true });
  else console.log('kept scratch ' + scratch);
  console.log('transcript ' + (tpath || 'NOT FOUND'));
  if (o.out) fs.writeFileSync(path.resolve(o.out), JSON.stringify(outObj, null, 2) + '\n');
  console.log('summary ' + JSON.stringify(summary));
  console.log('VERDICT ' + v + (firstNotOk ? ' :: ' + firstNotOk : ''));
  return v === 'PASS' ? 0 : v === 'FAIL' ? 1 : 2;
}

// ---- self-test ---------------------------------------------------------------------------------------------------
async function selfTest() {
  let failures = 0;
  const check = (name, cond, detail) => {
    if (cond) console.log('PASS ' + name);
    else { failures++; console.log('FAIL ' + name + (detail ? ' :: ' + detail : '')); }
  };

  // S2: transcript mapping by token position.
  {
    const tokens = ['t4005-x-1', 't4005-x-2'];
    const att = (type) => JSON.stringify({ type: 'attachment', attachment: { type, hookEvent: 'UserPromptSubmit', command: 'node "${CLAUDE_PLUGIN_ROOT}/scripts/a.cjs"', durationMs: 10, timedOut: type === 'hook_cancelled' } });
    const lines = [
      att('hook_success'),
      JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text: 'Prompt 1 token t4005-x-1' }] } }),
      att('hook_success'), att('hook_success'),
      JSON.stringify({ type: 'user', message: { role: 'user', content: 'Prompt 2 token t4005-x-2' } }),
      att('hook_cancelled'),
    ];
    const m = mapTranscript(lines, tokens);
    const p1 = m.prompts[0] || []; const p2 = m.prompts[1] || [];
    check('S2 prompt 1 has two hook records and 0 cancels', p1.length === 2 && p1.filter((a) => a.type === 'hook_cancelled').length === 0, JSON.stringify(m));
    check('S2 prompt 2 has one cancel', p2.filter((a) => a.type === 'hook_cancelled').length === 1, JSON.stringify(m));
    check('S2 an attachment before the first token is unmapped', m.unmapped === 1, String(m.unmapped));
  }

  // S3: stream hook events.
  {
    const ev = (subtype, extra) => Object.assign({ type: 'system', subtype, hook_id: 'h' + Math.random(), hook_name: 'UserPromptSubmit', hook_event: 'UserPromptSubmit' }, extra || {});
    const s = countStream([
      { t: 0, line: ev('hook_started') }, { t: 5, line: ev('hook_started') },
      { t: 30, line: ev('hook_response', { outcome: 'success' }) },
      { t: 40, line: ev('hook_response', { outcome: 'cancelled' }) },
      { t: 41, line: { type: 'system', subtype: 'hook_started', hook_event: 'Stop', hook_name: 'Stop' } },
    ]);
    check('S3 one run per hook_started event of UserPromptSubmit', s.runs === 2, JSON.stringify(s));
    check('S3 a response that names a cancel counts as a cancel', s.cancels === 1, JSON.stringify(s));
    const t = countStream([{ t: 0, line: ev('hook_started') }, { t: 9, line: ev('hook_response', { outcome: 'error', timed_out: true }) }]);
    check('S3 a response that names a timeout counts as a cancel', t.cancels === 1, JSON.stringify(t));
    const okLine = '2026-11-27T11:16:08.533Z [DEBUG] "Hook UserPromptSubmit (UserPromptSubmit) success:\\nMindrianOS prompt help was skipped on 1 earlier prompt(s): hook_timeout"';
    check('S3 a debug success line with the word timeout in its output is not a cancel', classifyDebugLine(okLine) === 'ok', classifyDebugLine(okLine));
    check('S3 a debug line that names a UserPromptSubmit timeout is a cancel', classifyDebugLine('2026-11-27T11:16:08.533Z [DEBUG] Hooks: UserPromptSubmit [node x] timed out after 3000ms') === 'cancel');
  }

  // S4: CPU load start and stop.
  {
    const load = startCpuLoad(2, { maxMs: 60000 });
    const alive = load.pids.filter((p) => { try { process.kill(p, 0); return true; } catch (_e) { return false; } });
    const t0 = Date.now();
    await load.stop();
    const ms = Date.now() - t0;
    const dead = load.pids.every((p) => { try { process.kill(p, 0); return false; } catch (_e) { return true; } });
    check('S4 startCpuLoad(2) gives 2 live pids', alive.length === 2, String(alive.length));
    check('S4 stop() ends both within 2,000 ms', dead && ms <= 2000, ms + ' ms');
  }

  // S5 and S6: a temp WAL database.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-load-400-5-selftest-'));
  try {
    const { DatabaseSync } = require('node:sqlite');
    fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
    const dbPath = path.join(tmp, '.mindrian', 'room.db');
    const db0 = new DatabaseSync(dbPath);
    db0.exec('PRAGMA journal_mode=WAL; PRAGMA user_version = 1;');
    db0.close();
    const holder = await holdLock(tmp, 1000);
    let err = null;
    try { const db = new DatabaseSync(dbPath, { timeout: 0 }); try { db.exec('BEGIN IMMEDIATE'); db.exec('ROLLBACK'); } finally { db.close(); } } catch (e) { err = e; }
    await stopChild(holder);
    check('S5 holdLock makes a second connection with timeout 0 fail', err !== null);
    check('S5 isBusyError of that error is true through errcode', !!err && typeof err.errcode === 'number' && (err.errcode & 0xff) === 5 && isBusyError(err), err && String(err.errcode));
    check('S5 isBusyError of the message form is true', isBusyError({ message: 'database is locked' }) === true);
    check('S5 isBusyError of another error is false', isBusyError(new Error('x')) === false);

    const w = startWriter(tmp, { everyMs: 200, holdMs: 50 });
    await w.ready;
    await new Promise((r) => setTimeout(r, 1200));
    const counts = await w.stop();
    check('S6 startWriter reports at least 3 cycles in 1,200 ms', counts.cycles >= 3, JSON.stringify(counts));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  // S7: verdict and hostEnv.
  {
    const base = { prompts_sent: 20, results: 20, cancel_total: 0, prompts_with_runs_below_H: 0, runs_source: 's2_hook_started', session_ids: ['u'], real_rooms_touched: false, unmapped_attachments: 0 };
    const ok = { host_started: true, prompt_timeout: false, foreign_session: false, transcript_found: true };
    check('S7 verdict PASS', verdict(base, ok) === 'PASS', verdict(base, ok));
    check('S7 verdict FAIL on a cancel', verdict(Object.assign({}, base, { cancel_total: 1 }), ok) === 'FAIL');
    check('S7 verdict FAIL on runs below H', verdict(Object.assign({}, base, { prompts_with_runs_below_H: 1 }), ok) === 'FAIL');
    check('S7 verdict ignores runs below H when runs_source is none', verdict(Object.assign({}, base, { prompts_with_runs_below_H: 3, runs_source: 'none' }), ok) === 'PASS');
    check('S7 verdict FAIL on real_rooms_touched', verdict(Object.assign({}, base, { real_rooms_touched: true }), ok) === 'FAIL');
    check('S7 verdict INCONCLUSIVE when the host did not start', verdict(base, Object.assign({}, ok, { host_started: false })) === 'INCONCLUSIVE');
    check('S7 verdict INCONCLUSIVE on a prompt timeout', verdict(base, Object.assign({}, ok, { prompt_timeout: true })) === 'INCONCLUSIVE');
    check('S7 verdict INCONCLUSIVE on another session id', verdict(base, Object.assign({}, ok, { foreign_session: true })) === 'INCONCLUSIVE');
    check('S7 verdict INCONCLUSIVE with no transcript', verdict(base, Object.assign({}, ok, { transcript_found: false })) === 'INCONCLUSIVE');
    check('S7 verdict INCONCLUSIVE with unmapped attachments', verdict(Object.assign({}, base, { unmapped_attachments: 1 }), ok) === 'INCONCLUSIVE');
    const src = { CLAUDECODE: '1', CLAUDE_CODE_SESSION_ID: 's', CLAUDE_CODE_ENTRYPOINT: 'cli', MOS_X: '1', MINDRIAN_Y: '2', PATH: '/bin', HOME: '/h' };
    const h = hostEnv(src, '/scratch');
    const keys = Object.keys(h.env);
    check('S7 hostEnv removes the session keys and every MOS_ and MINDRIAN_ key',
      !keys.includes('CLAUDECODE') && !keys.includes('CLAUDE_CODE_SESSION_ID') && !keys.includes('CLAUDE_CODE_ENTRYPOINT') && !keys.includes('MOS_X') && !keys.includes('MINDRIAN_Y') && h.env.PATH === '/bin',
      keys.join(','));
    check('S7 hostEnv sets the three harness keys',
      h.env.MINDRIAN_ROOMS_HOME === path.join('/scratch', 'rooms') && h.env.MINDRIAN_ADMIN_IDENTITY_PATH === path.join('/scratch', 'no-admin-identity.json') && h.env.MOS_USERPROMPT_TRACE === path.join('/scratch', 'dispatch-trace.jsonl'),
      JSON.stringify(h.env));
    check('S7 hostEnv records the removed key names, not the values', h.removed.includes('MOS_X') && !JSON.stringify(h.removed).includes('/bin'));
  }

  console.log(failures === 0 ? 'SELF_TEST OK' : 'SELF_TEST FAIL ' + failures);
  return failures === 0 ? 0 : 1;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--self-test')) return selfTest();
  if (process.env.MOS_LIVE_LOAD !== '1') { console.log('SKIP live load leg (set MOS_LIVE_LOAD=1)'); return 77; }
  return liveRun(parseArgs(argv));
}

if (require.main === module) {
  // Exit explicitly: a per-prompt limit timer or a closed host pipe must not keep the process alive after the result.
  main().then((code) => { process.exit(code); }, (e) => { console.error(e && e.stack ? e.stack : String(e)); process.exit(2); });
}

module.exports = { HOST_ARGS, textOf, mapTranscript, countStream, hostEnv, verdict, noteNames, classifyDebugLine };
