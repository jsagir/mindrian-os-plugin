'use strict';
// Phase 402 slice 7 (plan 402-07, design 402-DESIGN.md r3.1 section 7 K3 row,
// section 8 row 7 AC7.1 to AC7.4). Test only: no hook, no script and no lib
// file changes in this plan.
//
// The K3 rule. The host reads hook stdout as JSON only when the trimmed
// stdout starts with a left brace and parses as one JSON object. Text that
// does not start with a left brace is plain text. A JSON object followed by
// a plain line is read as plain text, so the JSON part is lost. This test
// runs every command hook of hooks/hooks.json (read at run time) outside the
// UserPromptSubmit group, on 3 fixtures (bound, unbound, no_room), each run
// in a new sandbox, and asserts the stdout shape.
//
// Modes:
//   node tests/test-402-hook-stdout-shape.cjs                 all legs
//   node tests/test-402-hook-stdout-shape.cjs --self-check    C1 to C6 and S1
//   node tests/test-402-hook-stdout-shape.cjs --hooks-file F  H legs of file F
//
// Output: 1 line per leg (PASS, FAIL, SKIP, XFAIL, RECORD), then
// "passed=<n> failed=<n> skipped=<n> xfail=<n>". Exit 1 when failed > 0.
//
// Sandbox rule: every hook run has a new mkdtemp HOME, MINDRIAN_HOME, rooms
// home, TMPDIR and project repository. The child environment is an allow
// list, not a copy of process.env. No Brain key. Proxy variables point at an
// unused local port. Never run against the real ~/.mindrian or a real room.
//
// No em dash and no en dash in this file (hyphens only).

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const SELF = __filename;
const LIMIT_MS = 10000;
const CHILD_WAIT_MS = 5000;
const DEAD_URL = 'http://127.0.0.1:9';
const DISPATCHER = path.join(REPO, 'scripts', 'userprompt-dispatch.cjs');
const INVARIANT_TIER = ['admin-command-gate.cjs', 'first-install-router.cjs'];
const FIXTURES = ['bound', 'unbound', 'no_room'];

// ----- the shape rule ----------------------------------------------------------

// End index (exclusive) of the first balanced JSON object in t (t starts with
// a left brace), or -1 when the braces do not balance. String aware.
function firstObjectEnd(t) {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

function classify(stdout) {
  const t = String(stdout == null ? '' : stdout).trim();
  if (t === '') return { cls: 'empty' };
  if (t[0] !== '{') return { cls: 'plain' };
  try {
    const v = JSON.parse(t);
    if (v && typeof v === 'object' && !Array.isArray(v)) return { cls: 'json' };
  } catch (_e) { /* fall through to the violation reasons */ }
  const end = firstObjectEnd(t);
  if (end < 0) return { cls: 'violation', reason: 'starts_with_brace_not_json' };
  try { JSON.parse(t.slice(0, end)); } catch (_e) {
    return { cls: 'violation', reason: 'starts_with_brace_not_json' };
  }
  const rest = t.slice(end).trim();
  if (rest[0] === '{') return { cls: 'violation', reason: 'more_than_one_object' };
  return { cls: 'violation', reason: 'json_then_text' };
}

// ----- the leg ledger ----------------------------------------------------------

const counts = { passed: 0, failed: 0, skipped: 0, xfail: 0 };

function out(line) { process.stdout.write(line + '\n'); }

function leg(id, ok, text) {
  if (ok) { counts.passed += 1; out('PASS ' + id + ': ' + text); }
  else { counts.failed += 1; out('FAIL ' + id + ': ' + text); }
}

function skip(id, reason) { counts.skipped += 1; out('SKIP ' + id + ': ' + reason); }

// ----- the unit legs C1 to C6 --------------------------------------------------

function unitLegs() {
  const eq = function (got, cls, reason) {
    return got.cls === cls && (reason === undefined || got.reason === reason);
  };
  const show = function (g) { return g.cls + (g.reason ? '/' + g.reason : ''); };
  let g1 = classify(''); let g1b = classify('  \n');
  leg('C1', eq(g1, 'empty') && eq(g1b, 'empty'), 'empty and whitespace give empty (' + show(g1) + ', ' + show(g1b) + ')');
  let g2 = classify('{"continue":true}'); let g2b = classify('{"continue":true}\n');
  leg('C2', eq(g2, 'json') && eq(g2b, 'json'), 'one JSON object gives json (' + show(g2) + ', ' + show(g2b) + ')');
  let g3 = classify('plain words');
  leg('C3', eq(g3, 'plain'), 'plain words give plain (' + show(g3) + ')');
  let g4 = classify('{"continue":true}\nvoice reminder line\n');
  leg('C4', eq(g4, 'violation', 'json_then_text'), 'JSON then a plain line gives violation json_then_text (' + show(g4) + ')');
  let g5 = classify('{bad}');
  leg('C5', eq(g5, 'violation', 'starts_with_brace_not_json'), 'a brace that is not JSON gives violation starts_with_brace_not_json (' + show(g5) + ')');
  let g6 = classify('{"a":1}{"b":2}');
  leg('C6', eq(g6, 'violation', 'more_than_one_object'), 'two objects give violation more_than_one_object (' + show(g6) + ')');
}

// ----- the sandbox -------------------------------------------------------------

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'k3-shape-'));
const REAL_HOME = (function () { try { return os.userInfo().homedir; } catch (_e) { return os.homedir(); } })();

function git(args, cwd, env) {
  return spawnSync('git', args, { cwd: cwd, env: env, encoding: 'utf8', timeout: 10000 });
}

function writeRoom(roomDir) {
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  fs.writeFileSync(path.join(roomDir, 'ROOM.md'), '# Fixture Venture\n\nA synthetic room for the K3 shape test.\n');
  fs.writeFileSync(path.join(roomDir, 'STATE.md'), '---\nproject: Fixture Venture\n---\n# State\n');
  const sec = path.join(roomDir, 'problem-definition');
  fs.mkdirSync(sec, { recursive: true });
  fs.writeFileSync(path.join(sec, 'ROOM.md'), '# problem-definition\n\nIdentity text.\n');
  fs.writeFileSync(path.join(sec, 'note.md'), '---\ntitle: note\nstatus: active\n---\n# Note\n\nSynthetic text about a wedge market.\n');
}

// Make one sandbox for one hook run. Returns the paths and the child env.
function makeSandbox(fixture, key) {
  const base = fs.mkdtempSync(path.join(ROOT, 'run-'));
  const home = path.join(base, 'home');
  const mhome = path.join(base, 'mindrian-home');
  const rooms = path.join(base, 'rooms-home');
  const tmp = path.join(base, 'tmp');
  const project = path.join(base, 'project');
  [home, mhome, rooms, tmp, project].forEach(function (d) { fs.mkdirSync(d, { recursive: true }); });
  const env = {
    PATH: process.env.PATH || '/usr/bin:/bin',
    HOME: home,
    USERPROFILE: home,
    MINDRIAN_HOME: mhome,
    CARD_FIRE_SIDECHANNEL_PATH: path.join(mhome, 'card-fire-sidechannel.jsonl'),
    CLAUDE_PLUGIN_ROOT: REPO,
    MINDRIAN_ROOMS_HOME: rooms,
    MINDRIAN_ROOMS_ROOT: rooms,
    TMPDIR: tmp,
    TMP: tmp,
    TEMP: tmp,
    MINDRIAN_BRAIN_URL: DEAD_URL,
    HTTP_PROXY: DEAD_URL,
    HTTPS_PROXY: DEAD_URL,
    ALL_PROXY: DEAD_URL,
  };
  let cwd = project;
  let roomDir = null;
  let gitOk = true;
  const initRepo = function (dir) {
    const r1 = git(['init', '-q'], dir, env);
    const r2 = git(['config', 'user.email', 'fixture@example.invalid'], dir, env);
    const r3 = git(['config', 'user.name', 'k3 fixture'], dir, env);
    if (r1.status !== 0 || r2.status !== 0 || r3.status !== 0) gitOk = false;
  };
  if (fixture === 'bound' || fixture === 'unbound') {
    roomDir = path.join(rooms, 'venture');
    writeRoom(roomDir);
    fs.mkdirSync(path.join(rooms, '.rooms'), { recursive: true });
    const reg = { rooms: { venture: { path: roomDir, status: 'active', venture_name: 'Fixture Venture' } } };
    if (fixture === 'bound') reg.active = 'venture';
    fs.writeFileSync(path.join(rooms, '.rooms', 'registry.json'), JSON.stringify(reg, null, 2));
  }
  initRepo(project);
  if (fixture === 'bound') { cwd = roomDir; initRepo(roomDir); }
  let mdFile;
  if (roomDir) mdFile = path.join(roomDir, 'problem-definition', 'note.md');
  else {
    fs.mkdirSync(path.join(project, 'notes'), { recursive: true });
    mdFile = path.join(project, 'notes', 'note.md');
    fs.writeFileSync(mdFile, '# Note\n\nSynthetic text.\n');
  }
  const transcript = path.join(base, 'transcript.jsonl');
  const sid = 'k3-' + key + '-' + process.pid + '-' + Math.random().toString(36).slice(2, 10);
  fs.writeFileSync(transcript, [
    JSON.stringify({ type: 'user', sessionId: sid, cwd: cwd, message: { role: 'user', content: 'What is the next step for the wedge?' } }),
    JSON.stringify({ type: 'assistant', sessionId: sid, cwd: cwd, message: { role: 'assistant', content: [{ type: 'text', text: 'Test the pricing claim with 3 buyers.' }] } }),
  ].join('\n') + '\n');
  return { base: base, home: home, mhome: mhome, rooms: rooms, tmp: tmp, project: project, roomDir: roomDir,
    cwd: cwd, env: env, gitOk: gitOk, mdFile: mdFile, transcript: transcript, sid: sid };
}

// T-402-07-01: assert the sandbox before each spawn.
function assertSandbox(sb) {
  const keys = ['HOME', 'MINDRIAN_HOME', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_ROOMS_ROOT', 'TMPDIR'];
  const realMh = path.join(REAL_HOME, '.mindrian');
  const realRooms = path.join(REAL_HOME, 'MindrianRooms');
  for (const k of keys) {
    const v = sb.env[k];
    if (!v || !(v === sb.base || v.startsWith(sb.base + path.sep))) throw new Error('sandbox: ' + k + ' is not below the mkdtemp base');
    if (v === REAL_HOME || v === os.homedir()) throw new Error('sandbox: ' + k + ' is the real home');
    if (v === realMh || v.startsWith(realMh + path.sep) || v.startsWith(realRooms + path.sep)) throw new Error('sandbox: ' + k + ' is below a real MindrianOS folder');
  }
  for (const k of ['MINDRIAN_BRAIN_KEY', 'TYPESAFE_API_KEY', 'MINDRIAN_MCP_FIRST']) {
    if (k in sb.env) throw new Error('sandbox: ' + k + ' is set');
  }
}

function removeWithRetries(dir) {
  for (let i = 0; i < 5; i++) {
    try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); return; } catch (_e) {
      spawnSync(process.execPath, ['-e', 'setTimeout(function(){}, 200)']);
    }
  }
}

// ----- the hook list -----------------------------------------------------------

// Split a hooks.json command into argv. The text comes from hooks.json, not
// from fixture data. Double quotes group words; ${CLAUDE_PLUGIN_ROOT} becomes
// the repository root.
function splitCommand(cmd) {
  const s = cmd.split('${CLAUDE_PLUGIN_ROOT}').join(REPO);
  const argv = [];
  let cur = '';
  let inQ = false;
  let has = false;
  for (const c of s) {
    if (c === '"') { inQ = !inQ; has = true; continue; }
    if (!inQ && /\s/.test(c)) { if (has) { argv.push(cur); cur = ''; has = false; } continue; }
    cur += c; has = true;
  }
  if (has) argv.push(cur);
  return argv;
}

function toSpawnArgv(argv) {
  if (argv[0] === 'node') return [process.execPath].concat(argv.slice(1));
  // run-hook.cmd has no shebang line; the host runs it through a shell.
  if (/\.cmd$/.test(argv[0])) return ['/bin/sh'].concat(argv);
  return argv;
}

function commandTail(argv) {
  const i = argv.findIndex(function (a) { return /\.(cjs|js|cmd)$/.test(a); });
  if (i < 0) return argv.join(' ');
  return [path.basename(argv[i])].concat(argv.slice(i + 1)).join(' ');
}

function readHooks(file) {
  const h = JSON.parse(fs.readFileSync(file, 'utf8'));
  const rows = [];
  for (const [event, groups] of Object.entries(h.hooks || {})) {
    for (const g of groups) {
      for (const k of (g.hooks || [])) {
        const argv = splitCommand(String(k.command || ''));
        rows.push({ event: event, matcher: g.matcher || '', type: k.type, timeout: k.timeout, command: k.command,
          argv: argv, tail: commandTail(argv) });
      }
    }
  }
  return rows;
}

// ----- the stdin of each event -------------------------------------------------

// Names for matchers that are patterns with no plain name. One entry for each
// of the 4 pattern rows of hooks/hooks.json on the base; each name is checked
// against the pattern of its row before use.
const PATTERN_NAMES = [
  { name: 'mcp__plugin_mos_mindrian-brain__brain_ask', input: { question: 'Which framework fits an ill-defined problem?' } },
  { name: 'mcp__plugin_mos_mindrian-os__gate_answer', input: { gate_id: 'k3-gate', chosen: ['a'], verdict: 'defer' } },
  { name: 'WebSearch', input: { query: 'generic methodology term' } },
];

function plainMatcherName(m) {
  if (!/^[A-Za-z]+(\|[A-Za-z]+)*$/.test(m)) return null;
  return m.split('|')[0];
}

function toolFor(row, sb) {
  const plain = plainMatcherName(row.matcher);
  if (plain) {
    if (plain === 'Grep' || plain === 'Glob') return { name: plain, input: { pattern: 'wedge', path: sb.cwd } };
    return { name: plain, input: { file_path: sb.mdFile, content: fs.readFileSync(sb.mdFile, 'utf8'), old_string: 'wedge', new_string: 'wedge' } };
  }
  let re;
  try { re = new RegExp('^(?:' + row.matcher + ')$'); } catch (_e) { return null; }
  const hit = PATTERN_NAMES.find(function (p) { return re.test(p.name); });
  return hit ? { name: hit.name, input: hit.input } : null;
}

function stdinFor(row, sb) {
  const o = { session_id: sb.sid, transcript_path: sb.transcript, cwd: sb.cwd, hook_event_name: row.event, permission_mode: 'default' };
  let rule = true;
  switch (row.event) {
    case 'SessionStart': o.source = 'startup'; break;
    case 'PreCompact': o.trigger = 'manual'; o.custom_instructions = ''; break;
    case 'PostCompact': o.trigger = 'manual'; break;
    case 'Stop': case 'SubagentStop': o.stop_hook_active = false; o.last_assistant_message = 'Test the pricing claim with 3 buyers.'; break;
    case 'SessionEnd': o.reason = 'other'; break;
    case 'PreToolUse': case 'PostToolUse': {
      const t = toolFor(row, sb);
      if (!t) { rule = false; break; }
      o.tool_name = t.name; o.tool_input = t.input; o.tool_use_id = 'toolu_k3_' + sb.sid;
      if (row.event === 'PostToolUse') o.tool_response = { success: true, filePath: t.input.file_path || '' };
      break;
    }
    case 'FileChanged': o.file_path = sb.mdFile; o.change_type = 'change'; break;
    case 'CwdChanged': o.old_cwd = sb.project; o.new_cwd = sb.cwd; break;
    case 'TaskCompleted': o.task_id = 'k3-task'; o.task_subject = 'Fixture task'; break;
    case 'UserPromptSubmit': o.prompt = 'What is the next step for the wedge?'; break;
    default: rule = false;
  }
  return { stdin: JSON.stringify(o), rule: rule };
}

// ----- one hook run ------------------------------------------------------------

function groupAlive(pid) {
  try { process.kill(-pid, 0); return true; } catch (_e) { return false; }
}

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function runOne(row, fixture, opts) {
  const o = opts || {};
  const sb = makeSandbox(fixture, row.tail.replace(/[^A-Za-z0-9]+/g, '-'));
  try {
    if (o.prep) o.prep(sb);
    assertSandbox(sb);
    const st = stdinFor(row, sb);
    if (o.prompt !== undefined) st.stdin = JSON.stringify(Object.assign(JSON.parse(st.stdin), { prompt: o.prompt }));
    const inFile = path.join(sb.base, 'stdin.json');
    const outFile = path.join(sb.base, 'stdout');
    const errFile = path.join(sb.base, 'stderr');
    fs.writeFileSync(inFile, st.stdin);
    const inFd = fs.openSync(inFile, 'r');
    const outFd = fs.openSync(outFile, 'w');
    const errFd = fs.openSync(errFile, 'w');
    const argv = toSpawnArgv(row.argv);
    let timedOut = false;
    let code = null;
    const t0 = Date.now();
    try {
      const child = spawn(argv[0], argv.slice(1), { cwd: sb.cwd, env: sb.env, stdio: [inFd, outFd, errFd], detached: true });
      code = await new Promise(function (resolve) {
        const timer = setTimeout(function () {
          timedOut = true;
          try { process.kill(-child.pid, 'SIGKILL'); } catch (_e) { try { child.kill('SIGKILL'); } catch (_e2) { /* gone */ } }
        }, LIMIT_MS);
        child.on('error', function (e) { clearTimeout(timer); resolve('spawn_error:' + e.code); });
        child.on('exit', function (c, sig) { clearTimeout(timer); resolve(c === null ? 'signal:' + sig : c); });
      });
      // Bounded wait for background children of the hook (same group).
      const tw = Date.now();
      while (child.pid && groupAlive(child.pid) && Date.now() - tw < CHILD_WAIT_MS) await sleep(100);
      if (child.pid && groupAlive(child.pid)) { try { process.kill(-child.pid, 'SIGKILL'); } catch (_e) { /* gone */ } }
    } finally {
      fs.closeSync(inFd); fs.closeSync(outFd); fs.closeSync(errFd);
    }
    const ms = Date.now() - t0;
    const stdout = fs.readFileSync(outFile, 'utf8');
    return { ms: ms, code: code, timedOut: timedOut, stdout: stdout, rule: st.rule, gitOk: sb.gitOk };
  } finally {
    removeWithRetries(sb.base);
  }
}

// ----- skip list and expected-fail marks ---------------------------------------

// AC7.1 skip list. Each entry has its reason. No other skip.
const SKIP_LIST = {
  'sessionstart-npm-reconcile.cjs': function () { return 'runs npm (150 s row)'; },
  'sessionstart-post-update-preflight.cjs': function () { return 'update path'; },
  'async-artifact-auto-commit.cjs': function (r) { return r && r.gitOk === false ? 'the temp repository cannot be made' : null; },
  'run-hook.cmd post-compact': function () {
    return COMPACTION_FIXTURE ? null : 'needs a compaction transcript; no fixture transcript of a compaction exists';
  },
};

// No compaction transcript fixture exists in tests/fixtures on the base.
const COMPACTION_FIXTURE = null;

// Expected-fail marks: label -> plan id. 402-07-D<n> is a K3 defect;
// 402-07-T<n> is a time finding (timeout_10s). The assert stays; a marked leg
// that passes fails with "XFAIL now passes: remove the mark".
const XFAIL = {
};

function stdoutSample(s) {
  return s.slice(0, 200).replace(/(?:[A-Za-z]:)?(?:\/[^\s"'`:,;)\]}]+)+/g, '<path>').replace(/\s+/g, ' ');
}

async function hookLegs(rows) {
  for (const row of rows) {
    if (row.event === 'UserPromptSubmit') continue;
    for (const fx of FIXTURES) {
      const label = row.event + ':' + row.tail + ':' + fx;
      const pre = SKIP_LIST[row.tail];
      const preReason = pre ? pre(null) : null;
      if (preReason) { skip(label, preReason); continue; }
      if (row.type !== 'command') { skip(label, 'hook type ' + row.type + ' is not a command'); continue; }
      const r = await runOne(row, fx);
      if (pre) {
        const postReason = pre(r);
        if (postReason) { skip(label, postReason); continue; }
      }
      let bad = null;
      if (r.timedOut) bad = 'timeout_10s';
      else {
        const c = classify(r.stdout);
        if (c.cls === 'violation') bad = c.reason + ' stdout="' + stdoutSample(r.stdout) + '"';
      }
      const note = ' (' + r.ms + ' ms, exit ' + r.code + (r.rule ? '' : ', generic stdin: no rule') + ')';
      const mark = XFAIL[label];
      if (mark) {
        if (bad) { counts.xfail += 1; out('XFAIL ' + label + ': ' + mark + ' ' + bad + note); }
        else { counts.failed += 1; out('FAIL ' + label + ': XFAIL now passes: remove the mark ' + mark + note); }
        continue;
      }
      if (bad) { counts.failed += 1; out('FAIL ' + label + ': ' + bad + note); }
      else { counts.passed += 1; out('PASS ' + label + ': ' + classify(r.stdout).cls + note); }
    }
  }
}

// ----- U1: the UserPromptSubmit leg (AC7.3) ------------------------------------

async function promptLeg(rows) {
  const ups = rows.filter(function (r) { return r.event === 'UserPromptSubmit'; });
  const nodeHooks = ups.filter(function (r) { return r.argv[0] === 'node'; });
  const others = nodeHooks.filter(function (r) { return INVARIANT_TIER.indexOf(r.tail.split(' ')[0]) < 0; });
  const isOnly = others.length === 1 && path.resolve(others[0].argv[1] || '') === DISPATCHER;
  if (!fs.existsSync(DISPATCHER) || !isOnly) {
    skip('U1:UserPromptSubmit', 'owned by 400.5 (the dispatcher scripts/userprompt-dispatch.cjs is not yet the only UserPromptSubmit node hook besides the invariant tier)');
    return;
  }
  const row = others[0];
  for (const fx of FIXTURES) {
    const label = 'UserPromptSubmit:' + row.tail + ':' + fx;
    const r = await runOne(row, fx);
    const c = classify(r.stdout);
    const bad = r.timedOut ? 'timeout_10s' : (c.cls === 'violation' ? c.reason + ' stdout="' + stdoutSample(r.stdout) + '"' : null);
    const note = ' (' + r.ms + ' ms, exit ' + r.code + ')';
    if (bad) { counts.failed += 1; out('FAIL ' + label + ': ' + bad + note); }
    else { counts.passed += 1; out('PASS ' + label + ': ' + c.cls + note); }
  }
}

// ----- S1: the seeded red proof ------------------------------------------------

function seededStub() {
  const dir = fs.mkdtempSync(path.join(ROOT, 'stub-'));
  const stub = path.join(dir, 'k3-stub.cjs');
  fs.writeFileSync(stub, "process.stdout.write('{\"continue\":true}\\nvoice reminder line\\n');\n");
  const hooksFile = path.join(dir, 'hooks.json');
  fs.writeFileSync(hooksFile, JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: 'command', command: 'node "' + stub + '"', timeout: 5 }] }] } }, null, 2));
  return { dir: dir, hooksFile: hooksFile };
}

function selfCheckLeg() {
  const s = seededStub();
  const res = spawnSync(process.execPath, [SELF, '--hooks-file', s.hooksFile], { encoding: 'utf8', timeout: 120000, env: process.env });
  const lines = (res.stdout || '').split('\n');
  const fails = lines.filter(function (l) { return /^FAIL Stop:k3-stub\.cjs:/.test(l) && l.indexOf('json_then_text') >= 0; });
  leg('S1', res.status === 1 && fails.length === FIXTURES.length,
    'the seeded K3 stub fails on every fixture through the hook spawn path (exit ' + res.status + ', ' + fails.length + ' FAIL json_then_text lines)');
  removeWithRetries(s.dir);
}

// ----- the RECORD probe of the real K3 site ------------------------------------

// Record only, not a gate (Task 1 Step 6). Probe 1: a plain prompt. Probe 2:
// the prompt is the slug of a second registered room (the strict-mode route
// of main(), which writes one JSON envelope); the voice line follows it.
async function recordProbe() {
  const row = { event: 'UserPromptSubmit', matcher: '', type: 'command', argv: ['node', path.join(REPO, 'scripts', 'intent-classifier.cjs')], tail: 'intent-classifier.cjs' };
  const show = function (name, r) {
    const c = classify(r.stdout);
    out('RECORD K3 site intent-classifier.cjs (' + name + '): class=' + c.cls + (c.reason ? ' reason=' + c.reason : '') +
      ' exit=' + r.code + ' ms=' + r.ms + ' stdout_head="' + stdoutSample(r.stdout).slice(0, 160) + '"');
  };
  show('bound, plain prompt', await runOne(row, 'bound'));
  const second = function (sb) {
    const other = path.join(sb.rooms, 'harbor-lab');
    writeRoom(other);
    const regFile = path.join(sb.rooms, '.rooms', 'registry.json');
    const reg = JSON.parse(fs.readFileSync(regFile, 'utf8'));
    reg.rooms['harbor-lab'] = { path: other, status: 'active', venture_name: 'Harbor Lab' };
    fs.writeFileSync(regFile, JSON.stringify(reg, null, 2));
  };
  show('bound, prompt is the slug of a second room', await runOne(row, 'bound', { prep: second, prompt: 'harbor-lab' }));
}

function realHomeStamp() {
  try { return fs.statSync(path.join(REAL_HOME, '.mindrian')).mtimeMs; } catch (_e) { return null; }
}

// ----- main --------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const hfIdx = args.indexOf('--hooks-file');
  try {
    if (args.indexOf('--self-check') >= 0) {
      unitLegs();
      selfCheckLeg();
    } else if (hfIdx >= 0) {
      const file = path.resolve(args[hfIdx + 1] || '');
      await hookLegs(readHooks(file));
    } else {
      const stamp0 = realHomeStamp();
      unitLegs();
      selfCheckLeg();
      const rows = readHooks(path.join(REPO, 'hooks', 'hooks.json'));
      const inScope = rows.filter(function (r) { return r.event !== 'UserPromptSubmit'; }).length;
      out('RECORD hooks.json: ' + rows.length + ' hooks, ' + inScope + ' outside UserPromptSubmit');
      await hookLegs(rows);
      await promptLeg(rows);
      await recordProbe();
      const stamp1 = realHomeStamp();
      out('RECORD real MINDRIAN_HOME modification time ' + (stamp0 === stamp1 ? 'unchanged' : 'changed (other sessions on the machine also write it)'));
    }
  } finally {
    removeWithRetries(ROOT);
  }
  out('passed=' + counts.passed + ' failed=' + counts.failed + ' skipped=' + counts.skipped + ' xfail=' + counts.xfail);
  process.exit(counts.failed > 0 ? 1 : 0);
}

module.exports = { classify: classify };

if (require.main === module) {
  main().catch(function (e) {
    out('FAIL main: ' + (e && e.message ? e.message : String(e)));
    process.exit(1);
  });
}
